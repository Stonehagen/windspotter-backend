const mongoose = require('mongoose');
const util = require('util');
const grib2json = require('grib2json').default;
const { Spot, Forecast } = require('../../models');
const { calculateDataValue } = require('../../methods/calculateValues');
const { updateSpotForecast } = require('../../methods/updateDatabase');
const {
  getforecastHeader,
} = require('../../methods/forecastInfos');

const getJson = util.promisify(grib2json);

const populateSpots = async (
  filename,
  spots,
  forecastInfo,
  forecastConfigName,
) => {
  const forecastJson = await getJson(filename, {
    scriptPath: './src/convert_grib/grib2json/src/bin/grib2json',
    names: true, // (default false): Return descriptive names too
    data: true, // (default false): Return data, not just headers
  });

  // get grib info from header
  const forecastHeader = getforecastHeader(
    forecastJson[0].header,
    filename,
    forecastConfigName,
  );

  // Calculate data values for all spots in parallel
  const dataValuePromises = spots.map((spot) => {
    return calculateDataValue(spot, forecastHeader, forecastJson[0].data);
  });

  // Wait for all dataValue promises to resolve
  const dataValues = await Promise.all(dataValuePromises);

  // Update spot forecasts with calculated data values
  spots.forEach((spot, index) => {
    if (dataValues[index] !== null) {
      updateSpotForecast(spot, forecastInfo, forecastHeader, dataValues[index]);
    }
  });
};

const addEmptyForecastToSpots = async (forecastInfo) => {
  // get forecastInfo document from db or create new one
  const spots = await Spot.find({}).populate('forecasts').exec();
  if (!spots) {
    return false;
  }
  try {
    for (const spot of spots) {
      // check if forecast already exists
      const forecastFound = spot.forecasts.find(
        (spotForecast) =>
          spotForecast.forecastInfo.toString() === forecastInfo._id.toString(),
      );

      // if not create new forecast
      if (!forecastFound) {
        const forecastData = new Forecast({
          _id: new mongoose.Types.ObjectId(),
          forecastInfo,
          time: forecastInfo.time,
        });
        spot.forecasts.push(forecastData);

        await forecastData.save();
      }
    }
    for (const spot of spots) {
      await spot.save();
    }
  } catch (err) {
    console.log(err);
    return false;
  }
  return true;
};

const convertGribToJson = async (
  filenames,
  forecastInfo,
  forecastConfigName,
) => {
  const spots = await Spot.find({}).populate('forecasts').exec();
  if (!spots) {
    return false;
  }
  try {
    for (const filename of filenames) {
      await populateSpots(
        `./grib_data/${filename}`,
        spots,
        forecastInfo,
        forecastConfigName,
      );
    }
    for (const spot of spots) {
      await spot.save();
    }
  } catch (err) {
    console.log(err);
    return false;
  }
  return true;
};

module.exports = {
  convertGribToJson,
  addEmptyForecastToSpots,
};

const mongoose = require('mongoose');
const util = require('util');
const grib2json = require('grib2json').default;
const { Spot, Forecast } = require('../../models');
const { calculateDataValue } = require('../../methods/calculateValues');
const { updateSpotForecast } = require('../../methods/updateDatabase');
const { getforecastHeader } = require('../../methods/forecastInfos');

const getJson = util.promisify(grib2json);

const populateSpots = async (
  filename,
  spots,
  forecastInfo,
  forecastConfigName,
  lastValues,
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

  const rawDataValues = {
    dataValues: [...dataValues],
    forecastTime: forecastHeader.forecastTime,
  };

  // convert accumulated rain to rain per hour
  // If the forecastHeader.forecastType is 'rain_con' oder 'rain_gsp'
  // and the lastValues array is not empty, calculate the difference
  // between the current and the last forecast and divide it by the
  // difference between the current and the last forecast time
  if (forecastHeader.forecastType === 'rain_gsp') {
    if (lastValues.dataValues.length > 0) {
      for (const [index, value] of dataValues.entries()) {
        if (value !== null) {
          dataValues[index] =
            (value - lastValues.dataValues[index]) /
            ((forecastHeader.forecastTime - lastValues.forecastTime) / 60);
        }
      }
    }
  }
  // Update spot forecasts with calculated data values
  for (const [index, spot] of spots.entries()) {
    if (dataValues[index]) {
      await updateSpotForecast(
        spot,
        forecastInfo,
        forecastHeader,
        dataValues[index],
      );
    }
  }
  return rawDataValues;
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
    let lastValues = {
      dataValues: [],
      forecastTime: null,
    };
    for (const [index, filename] of filenames.entries()) {
      lastValues = await populateSpots(
        `./grib_data_${forecastConfigName}/${filename}`,
        spots,
        forecastInfo,
        forecastConfigName,
        lastValues,
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

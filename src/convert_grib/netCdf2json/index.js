const mongoose = require('mongoose');
const { readFileSync } = require('fs');
const { NetCDFReader } = require('netcdfjs');
const { Forecast, Spot } = require('../../models');
const { calculateDataValue } = require('../../methods/calculateValues');
const { updateSpotForecast } = require('../../methods/updateDatabase');
const {
  getForecastHeaderCWAM,
  getForecastHeaderGFS,
} = require('../../methods/forecastInfos');

const populateSpots = async (
  filename,
  spots,
  forecastInfo,
  forecastConfigName,
) => {
  // if more than only cwam - add a contition to check for right headerGenerator
  const forecastHeader =
    forecastConfigName === 'cwam'
      ? getForecastHeaderCWAM(filename, forecastInfo, forecastConfigName)
      : getForecastHeaderGFS(filename, forecastInfo, forecastConfigName);

  const NcData = readFileSync(`./grib_data_${forecastConfigName}/${filename}`);
  const reader = new NetCDFReader(NcData);
  const variableName = reader.header.variables[3].name;
  const valueArray = reader.getDataVariable(variableName)[0];

  // Calculate data values for all spots in parallel
  const dataValuePromises = spots.map((spot) => {
    return calculateDataValue(spot, forecastHeader, valueArray);
  });

  // Wait for all dataValue promises to resolve
  const dataValues = await Promise.all(dataValuePromises);
  // Update spot forecasts with calculated data values
  for (const [index, spot] of spots.entries()) {
    if (dataValues[index] !== null) {
      await updateSpotForecast(
        spot,
        forecastInfo,
        forecastHeader,
        dataValues[index],
      );
    }
  }
};

const addEmptyForecastToSpotsNetCDF = async (forecastInfo) => {
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

const convertNetCDFToJson = async (
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
      await populateSpots(filename, spots, forecastInfo, forecastConfigName);
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
  convertNetCDFToJson,
  addEmptyForecastToSpotsNetCDF,
};

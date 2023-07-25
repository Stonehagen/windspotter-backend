const fs = require('fs');
require('dotenv/config');
const { dataValues } = require('../config');
const { downloadFiles } = require('../ftp');
// eslint-disable-next-line no-unused-vars
const { decompressFiles } = require('../extract');
const { convertGrib } = require('../convert_grib');
const { Forecast } = require('../models');

const getLastForecastTime = async (forecastName) => {
  const forecast = await Forecast.findOne({ name: forecastName });
  if (!forecast) {
    return new Date(new Date().getTime() - 7 * 60 * 60 * 1000);
  }
  return forecast.timestamp;
};

const getFiles = (filePath) => {
  let files = fs.readdirSync(filePath);

  // remove hidden files from fileList
  files = files.filter((file) => file.slice(0, 1) !== '.');
  return files;
};

const sortFiles = (files, value) => {
  const regex = /(?<=_[0-9]+_[0-9]+_[0-9]+_)[A-Za-z]+(?=.grib)/;
  return files.filter((file) => file.match(regex)[0] === value);
};

const updateDatabase = async (server, dict, forecastName) => {
  const lastForecastTime = await getLastForecastTime(forecastName);

  console.log('get files');
  const newForecasTime = await downloadFiles(server, dict, lastForecastTime);
  if (!newForecasTime) {
    return false;
  }
  console.log('download complete');

  const gribFiles = getFiles('./grib_data');
  console.log('update Database');
  // eslint-disable-next-line no-restricted-syntax
  for (const value of dataValues) {
    const sortetFiles = sortFiles(gribFiles, value);
    // eslint-disable-next-line no-await-in-loop
    await convertGrib(sortetFiles, './grib_data');
  }
  // eslint-disable-next-line no-restricted-syntax
  for (const file of gribFiles) {
    // eslint-disable-next-line no-await-in-loop
    await fs.unlinkSync(`./grib_data/${file}`);
  }

  // eslint-disable-next-line no-console
  return console.log('updated Database');
};

module.exports = {
  updateDatabase,
};

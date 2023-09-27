/* eslint-disable function-paren-newline */
/* eslint-disable implicit-arrow-linebreak */
/* eslint-disable no-console */
const fs = require('fs');
const config = require('../config');
const { downloadFiles } = require('../ftp');
const { convertGrib, addEmptyForecastToSpots } = require('../convert_grib');
const { ForecastInfo } = require('../models');

const getFiles = (filePath) => {
  const files = fs.readdirSync(filePath);
  // remove hidden files from fileList
  console.log('here');
  return files.filter((file) => !file.startsWith('.'));
};

const sortFiles = (files, value, forecastConfigName) => {
  const regex = config[forecastConfigName].regexNameValue;
  return files.filter(
    (file) => file.match(regex)[0].toLowerCase() === value.toLowerCase(),
  );
};

const deleteFiles = async (files) => {
  if (!files) {
    return;
  }
  const unlinkPromises = files.map((file) =>
    fs.promises.unlink(`./grib_data/${file}`),
  );
  await Promise.all(unlinkPromises);
};

const convertAllGrib = async (filesList, forecastConfigName) => {
  const forecastName = config[forecastConfigName].forecastName;
  await addEmptyForecastToSpots(
    `./grib_data/${filesList[0][0]}`,
    forecastConfigName,
  );
  const convertPromises = filesList.map((files) =>
    convertGrib(files, './grib_data', forecastConfigName),
  );
  await Promise.all(convertPromises);
};

const updateDatabase = async (forecastConfigName) => {
  forecastName = config[forecastConfigName].forecastName;
  dataValues = config[forecastConfigName].dataValues;

  console.log('delete old files');
  await deleteFiles(getFiles('./grib_data'));
  console.log('deleted old files');

  const forecastInfo = await ForecastInfo.findOne({ name: forecastName });

  console.log('download files');
  const newForecastTime = await downloadFiles(
    forecastInfo ? forecastInfo.time : new Date(0),
    forecastConfigName,
  );
  if (!newForecastTime) {
    return false;
  }
  console.log('download complete');
  console.log('update Database');
  const files = getFiles('./grib_data');
  const sortedFiles = dataValues.map((value) =>
    sortFiles(files, value, forecastConfigName),
  );
  await convertAllGrib(sortedFiles, forecastConfigName);
  console.log('updated Database');

  console.log('delete files');
  await deleteFiles(getFiles('./grib_data'));
  console.log('deleted files');
  console.log('Database is up to date');
  return true;
};

module.exports = {
  updateDatabase,
};

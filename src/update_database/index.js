/* eslint-disable function-paren-newline */
/* eslint-disable implicit-arrow-linebreak */
/* eslint-disable no-console */
const fs = require('fs');
const config = require('../config');
const { downloadFiles } = require('../ftp');
const { convertGribToJson, addEmptyForecastToSpots } = require('../convert_grib');
const { ForecastInfo } = require('../models');
let gribPath = process.env['GRIB_DATA_PATH'] ? process.env['GRIB_DATA_PATH'] : './grib_data';

const getFiles = (filePath) => {
  const files = fs.readdirSync(filePath);
  // remove hidden files from fileList
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
    fs.promises.unlink(`${gribPath}/${file}`),
  );
  await Promise.all(unlinkPromises);
};

const convertAllGribToJSON = async (filesList, forecastConfigName) => {
  await addEmptyForecastToSpots(
    `${gribPath}/${filesList[0][0]}`,
    forecastConfigName,
  );
  const convertPromises = filesList.map((files) =>
    convertGribToJson(files, gribPath, forecastConfigName),
  );
  await Promise.all(convertPromises);
};

const updateDatabase = async (forecastConfigName, wgrib2) => {
  forecastName = config[forecastConfigName].forecastName;
  dataValues = config[forecastConfigName].dataValues;

  console.log('delete old files');
  await deleteFiles(getFiles(gribPath));
  console.log('deleted old files');

  const forecastInfo = await ForecastInfo.findOne({ name: forecastName });

  console.log('download files');
  const newForecastTime = await downloadFiles(
    forecastInfo ? forecastInfo.time : new Date(0),
    forecastConfigName,
    gribPath,
  );
  if (!newForecastTime) {
    return false;
  }
  console.log('download complete');
  console.log('update Database');
  const files = getFiles(gribPath);
  const sortedFiles = dataValues.map((value) =>
    sortFiles(files, value, forecastConfigName),
  );
  if (wgrib2) {
    console.log('wgrib2');
    // Placeholder for wgrib2
  } else {
    console.log('grib2json');
    await convertAllGribToJSON(sortedFiles, forecastConfigName);
  }
  console.log('updated Database');

  console.log('delete files');
  await deleteFiles(getFiles(gribPath));
  console.log('deleted files');
  console.log('Database is up to date');
  return true;
};

module.exports = {
  updateDatabase,
};

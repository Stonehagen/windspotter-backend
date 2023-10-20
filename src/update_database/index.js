/* eslint-disable function-paren-newline */
/* eslint-disable implicit-arrow-linebreak */
/* eslint-disable no-console */
const fs = require('fs');
const config = require('../config');
const { downloadFiles } = require('../ftp');
const {
  convertGribToJson,
  addEmptyForecastToSpots,
} = require('../convert_grib/grib2json');
const { convertWGrib2ToNetcdf } = require('../convert_grib/wgrib2');
const {
  convertNetCDFToJson,
  addEmptyForecastToSpotsNetCDF,
} = require('../convert_grib/netCdf2json');
const { ForecastInfo } = require('../models');
const { getForecastInfo } = require('../methods/forecastInfos');

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
    fs.promises.unlink(`./grib_data/${file}`),
  );
  await Promise.all(unlinkPromises);
};

const convertAllWGrib2 = async (filesList, forecastConfigName) => {
  const convertPromises = filesList.map((files) =>
    convertWGrib2ToNetcdf(files, forecastConfigName),
  );
  await Promise.all(convertPromises);
};

const convertAllNetCDFToJSON = async (filesList, forecastConfigName) => {
  const forecastInfo = await getForecastInfo(
    filesList[0][0],
    forecastConfigName,
  );
  await addEmptyForecastToSpotsNetCDF(forecastInfo);
  const convertPromises = filesList.map((files) =>
    convertNetCDFToJson(files, forecastInfo, forecastConfigName),
  );
  await Promise.all(convertPromises);
};

const convertAllGribToJSON = async (filesList, forecastConfigName) => {
  const forecastInfo = await getForecastInfo(
    filesList[0][0],
    forecastConfigName,
  );
  await addEmptyForecastToSpots(forecastInfo);
  const convertPromises = filesList.map((files) =>
    convertGribToJson(files, forecastInfo, forecastConfigName),
  );
  await Promise.all(convertPromises);
};

const updateDatabase = async (forecastConfigName, wgrib2) => {
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
  if (wgrib2) {
    console.log('wgrib2');
    await convertAllWGrib2(sortedFiles, forecastConfigName);
    const ncFiles = getFiles('./grib_data');
    const sortedNcFiles = dataValues.map((value) =>
      sortFiles(ncFiles, value, forecastConfigName),
    );
    await convertAllNetCDFToJSON(sortedNcFiles, forecastConfigName);
  } else {
    console.log('grib2json');
    await convertAllGribToJSON(sortedFiles, forecastConfigName);
  }
  // update forecastInfo
  await forecastInfo.save();
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

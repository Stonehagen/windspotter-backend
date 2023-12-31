const fs = require('fs');
const config = require('../config');
const {
  downloadFiles,
  downloadFilesGfsAWS,
} = require('../ftp');
const {
  convertGribToJson,
  addEmptyForecastToSpots,
} = require('../convert_grib/grib2json');
const { convertGrib2Jpeg } = require('../convert_grib/grib2jpeg');
const {
  convertWGrib2ToNetcdf,
  splitWGrib2ToNetcdf,
} = require('../convert_grib/wgrib2');
const {
  convertNetCDFToJson,
  addEmptyForecastToSpotsNetCDF,
} = require('../convert_grib/netCdf2json');
const { ForecastInfo } = require('../models');
const { getForecastInfo } = require('../methods/forecastInfos');
const { compileSpotForecasts } = require('../methods/updateDatabase');

const getFiles = (filePath) => {
  const files = fs.readdirSync(filePath);
  // remove hidden files from fileList
  return files.filter((file) => !file.startsWith('.'));
};

const sortFilesByValue = (files, value, forecastConfigName) => {
  const regex = config[forecastConfigName].regexNameValue;
  return files.filter(
    (file) => file.match(regex)[0].toLowerCase() === value.toLowerCase(),
  );
};

const sortFilesByTime = (files, forecastConfigName) => {
  const regex = config[forecastConfigName].regexTimeValue;
  const times = [...new Set(files.map((file) => file.match(regex)[0]))];
  return times.map((time) =>
    files.filter((file) => file.match(regex)[0] === time),
  );
};

const deleteFiles = async (path) => {
  const files = await getFiles(path);
  if (!files) {
    return;
  }
  const unlinkPromises = files.map((file) =>
    fs.promises.unlink(`${path}/${file}`),
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

const convertAllGribToJSON = async (
  filesList,
  forecastConfigName,
  forecastMap,
) => {
  const forecastInfo = await getForecastInfo(
    filesList[0][0],
    forecastConfigName,
  );
  await addEmptyForecastToSpots(forecastInfo);
  const convertPromises = filesList.map((files) =>
    convertGribToJson(files, forecastInfo, forecastConfigName),
  );
  await Promise.all(convertPromises);

  // remap filelist to just have the u_10m and v_10m files
  let files = [];
  for (const folders of filesList) {
    const regex = config[forecastConfigName].regexNameValue;
    files = files.concat(
      folders.filter(
        (file) =>
          file.match(regex)[0].toLowerCase() === 'u_10m' ||
          file.match(regex)[0].toLowerCase() === 'v_10m',
      ),
    );
  }
  const sortedFiles = sortFilesByTime(files, forecastConfigName);
  if (forecastMap) {
    await convertGrib2Jpeg(sortedFiles, forecastConfigName);
  }
};

const convertAllGfsToJSON = async (
  filesList,
  forecastConfigName,
  forecastMap,
) => {
  const forecastInfo = await getForecastInfo(filesList[0], forecastConfigName);
  await addEmptyForecastToSpotsNetCDF(forecastInfo);
  await convertNetCDFToJson(filesList, forecastInfo, forecastConfigName);
};

const stitchForecasts = async () => {};

const updateDatabase = async (forecastConfigName, wgrib2, forecastMap) => {
  forecastName = config[forecastConfigName].forecastName;
  dataValues = config[forecastConfigName].dataValues;

  console.log('delete old files');
  await deleteFiles(`./grib_data_${forecastConfigName}`);
  console.log('deleted old files');

  const forecastInfo = await ForecastInfo.findOne({ name: forecastName });

  let newForecastTime;
  console.log('download files');
  if (forecastConfigName === 'gfsAWS') {
    newForecastTime = await downloadFilesGfsAWS(
      forecastInfo ? forecastInfo.time : new Date(0),
      forecastConfigName,
    );
  } else {
    newForecastTime = await downloadFiles(
      forecastInfo ? forecastInfo.time : new Date(0),
      forecastConfigName,
    );
  }

  if (!newForecastTime) {
    return false;
  }
  console.log('download complete');
  console.log('update Database');
  const files = getFiles(`./grib_data_${forecastConfigName}`);
  if (forecastConfigName === 'gfsAWS') {
    console.log('gfsAWS to json');
    await splitWGrib2ToNetcdf(files, forecastConfigName);
    const ncFiles = getFiles(`./grib_data_${forecastConfigName}`);
    await convertAllGfsToJSON(ncFiles, forecastConfigName);
  } else {
    const sortedFiles = dataValues.map((value) =>
      sortFilesByValue(files, value, forecastConfigName),
    );
    if (wgrib2) {
      console.log('wgrib2');
      await convertAllWGrib2(sortedFiles, forecastConfigName);
      const ncFiles = getFiles(`./grib_data_${forecastConfigName}`);
      const sortedNcFiles = dataValues.map((value) =>
        sortFilesByValue(ncFiles, value, forecastConfigName),
      );
      await convertAllNetCDFToJSON(sortedNcFiles, forecastConfigName);
    } else {
      console.log('grib to json');
      await convertAllGribToJSON(sortedFiles, forecastConfigName, forecastMap);
    }
  }

  console.log('updated Database');
  console.log('delete files');
  await deleteFiles(`./grib_data_${forecastConfigName}`);
  console.log('deleted files');
  console.log('stiching Forecasts');
  await compileSpotForecasts();
  console.log('stiched Forecasts');
  console.log('Database is up to date');
  return true;
};

module.exports = {
  updateDatabase,
};

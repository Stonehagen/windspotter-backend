/* eslint-disable arrow-body-style */
/* eslint-disable no-await-in-loop */
/* eslint-disable no-param-reassign */
/* eslint-disable operator-linebreak */
/* eslint-disable object-curly-newline */
/* eslint-disable implicit-arrow-linebreak */
const util = require('util');
const mongoose = require('mongoose');
const grib2json = require('grib2json').default;
const { ModelData, Forecast } = require('../models');

const getJson = util.promisify(grib2json);

const getGribTimestamp = (gribTimeStr) => {
  const year = gribTimeStr.slice(0, 4);
  const month = gribTimeStr.slice(4, 6);
  const day = gribTimeStr.slice(6, 8);
  const hour = gribTimeStr.slice(8, 10);
  return new Date(`${year}-${month}-${day}T${hour}:00:00+02:00`);
};

const getForecastInfo = (forecastHeader) => {
  const { lo1, lo2, la1, la2, dx, dy } = forecastHeader;
  return { lo1, lo2, la1, la2, dx, dy };
};

const populateDatabase = async (filename) => {
  // get forecast info from filename
  const regex = /(?<=_)[0-9]+_[0-9]+_[0-9]+_[A-Za-z]+(?=.grib)/;
  const regex2 = /(?<=\/)[A-Za-z]+(?=_)/;
  const fileInfos = filename.match(regex)[0].split('_');
  const forecastName = filename.match(regex2)[0];
  const gribTimeStr = fileInfos[0];
  const forecastTime = fileInfos[1];
  const forecastType = fileInfos[3];
  const gribTimestamp = getGribTimestamp(gribTimeStr);

  const forecastJson = await getJson(filename, {
    scriptPath: './src/convert_grib/grib2json/src/bin/grib2json',
    names: true, // (default false): Return descriptive names too
    data: true, // (default false): Return data, not just headers
  });

  // get grib info from header
  const forecastInfo = getForecastInfo(forecastJson[0].header);

  let forecast = await Forecast.findOne({ name: forecastName });
  if (!forecast) {
    forecast = new Forecast({
      _id: new mongoose.Types.ObjectId(),
      timestamp: gribTimestamp,
      name: forecastName,
      lo1: forecastInfo.lo1,
      lo2: forecastInfo.lo2,
      la1: forecastInfo.la1,
      la2: forecastInfo.la2,
      dy: forecastInfo.dy,
      dx: forecastInfo.dx,
      datasets: [],
    });
  } else {
    forecast.timestamp = gribTimestamp;
    forecast.lo1 = forecastInfo.lo1;
    forecast.lo2 = forecastInfo.lo2;
    forecast.la1 = forecastInfo.la1;
    forecast.la2 = forecastInfo.la2;
    forecast.dy = forecastInfo.dy;
    forecast.dx = forecastInfo.dx;
  }

  let dataset = forecast.datasets.find(
    (d) => d.time === forecastTime && d.datatype === forecastType,
  );
  if (!dataset) {
    dataset = {
      time: forecastTime,
      datatype: forecastType,
      data: new mongoose.Types.ObjectId(),
    };
    forecast.datasets.push(dataset);
  }

  let modelData = await ModelData.findById(dataset.data);
  if (!modelData) {
    modelData = new ModelData({
      _id: dataset.data,
      values: [],
    });
  }
  modelData.values = forecastJson[0].data;

  await forecast.save();
  await modelData.save();
};

const convertGrib = async (filenames, path) => {
  try {
    // eslint-disable-next-line no-restricted-syntax
    for (const filename of filenames) {
      // eslint-disable-next-line no-await-in-loop
      await populateDatabase(`${path}/${filename}`);
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.log(err);
    return false;
  }
  return true;
};
module.exports = {
  convertGrib,
};

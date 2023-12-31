const { readFileSync } = require('fs');
const { NetCDFReader } = require('netcdfjs');
const util = require('util');
const grib2json = require('grib2json').default;
const dotenv = require('dotenv');
dotenv.config({ path: __dirname + '/../.env' });
const config = require('../config');
const { ForecastInfo } = require('../models');

const getJson = util.promisify(grib2json);

const roundTo = (digits, n) => {
  const multiplicator = Math.pow(10, digits);
  return Math.round(n * multiplicator) / multiplicator;
};

const getDateFromString = (dateString) => {
  return new Date(
    `${dateString.slice(0, 4)}-${dateString.slice(4, 6)}-${dateString.slice(
      6,
      8,
    )}T${dateString.slice(8, 10)}:00:00.000Z`,
  );
};

const getForecastNameCWAM = (filename) => {
  const regex = /^[^_]+(?=_)/;
  return filename.match(regex)[0];
};

const getForecastTypeCWAM = (filename) => {
  const regex = /^[^_]+(?=_)/;
  return filename
    .replace(`${getForecastNameCWAM(filename)}_`, '')
    .match(regex)[0];
};

const getRefTimeCWAM = (filename) => {
  const regex = /^[^_]+(?=_)/;
  const refTimeRaw = filename
    .replace(
      `${getForecastNameCWAM(filename)}_${getForecastTypeCWAM(filename)}_`,
      '',
    )
    .match(regex)[0];
  return getDateFromString(refTimeRaw);
};

// add hours to refTime string
const getRefTimeGFS = (filename, forecastConfigName) => {
  const regexDate = config[forecastConfigName].regexRefTimeDateNc;
  const regexHours = config[forecastConfigName].regexRefTimeHoursNc;
  const date = filename.match(regexDate)[0];
  const hours = filename.match(regexHours)[0].substring(0, 2);
  return getDateFromString(`${date}${hours}`);
};

const getForecastTimeCWAM = (filename) => {
  const forecastMinutes = +filename.replace('.nc', '').split('_').pop() * 60;
  return forecastMinutes;
};

const getForecastTimeGFS = (filename, forecastConfigName) => {
  const regexMinutes = config[forecastConfigName].regexRefTimeMinutesNc;
  const minutes = filename.match(regexMinutes)[0];
  const forecastMinutes = +minutes * 60;
  return forecastMinutes;
};

const getForecastHeaderCWAM = (filename, forecastInfo, forecastConfigName) => {
  const forecastTime = getForecastTimeCWAM(filename);

  const forecastHeader = getforecastHeader(
    {
      lo1: forecastInfo.lo1,
      lo2: forecastInfo.lo2,
      la1: forecastInfo.la1,
      la2: forecastInfo.la2,
      dx: forecastInfo.dx,
      dy: forecastInfo.dy,
      refTime: forecastInfo.time,
      forecastTime,
      nx: null,
      ny: null,
    },
    filename,
    forecastConfigName,
  );

  return forecastHeader;
};

const getForecastHeaderGFS = (filename, forecastInfo, forecastConfigName) => {
  const forecastTime = getForecastTimeGFS(filename, forecastConfigName);

  const forecastHeader = getforecastHeader(
    {
      lo1: forecastInfo.lo1,
      lo2: forecastInfo.lo2,
      la1: forecastInfo.la1,
      la2: forecastInfo.la2,
      dx: forecastInfo.dx,
      dy: forecastInfo.dy,
      refTime: forecastInfo.time,
      forecastTime,
      nx: null,
      ny: null,
    },
    filename,
    forecastConfigName,
  );

  return forecastHeader;
};

const getforecastHeader = (
  { lo1, lo2, la1, la2, dx, dy, refTime, forecastTime, nx, ny },
  filename,
  forecastConfigName,
) => {
  const regex = config[forecastConfigName].regexNameValue;
  const forecastType = filename.match(regex)[0].toLowerCase();
  return {
    forecastName: config[forecastConfigName].forecastName,
    forecastType,
    refTime,
    forecastTime,
    lo1,
    lo2,
    la1,
    la2,
    dx,
    dy,
    nx,
    ny,
  };
};

const getForecastInfo = async (filename, forecastConfigName) => {
  if (
    forecastConfigName === 'cwam' ||
    forecastConfigName === 'gfs' ||
    forecastConfigName === 'gfsAWS'
  ) {
    return getForecastInfoFromNetCDF(filename, forecastConfigName);
  } else {
    return getForecastInfoFromGrib(filename, forecastConfigName);
  }
};

const getForecastInfoFromGrib = async (filename, forecastConfigName) => {
  const scriptPath =
    process.env.ENV == 'DEV'
      ? './src/convert_grib/grib2json/src/bin/grib2jsondev'
      : './src/convert_grib/grib2json/src/bin/grib2json';
  const forecastJson = await getJson(
    `./grib_data_${forecastConfigName}/${filename}`,
    {
      scriptPath,
      names: true, // (default false): Return descriptive names too
      data: true, // (default false): Return data, not just headers
    },
  );

  // get grib info from header
  const forecastHeader = getforecastHeader(
    forecastJson[0].header,
    filename,
    forecastConfigName,
  );
  const { forecastName, refTime, lo1, lo2, la1, la2, dy, dx, nx, ny } =
    forecastHeader;

  // check if forecast already exists - if not create new forecast
  const forecastInfo = await ForecastInfo.findOneAndUpdate(
    { name: forecastName },
    {
      name: forecastName,
      time: refTime,
      lo1,
      lo2,
      la1,
      la2,
      dy,
      dx,
      nx,
      ny,
    },
    { upsert: true, new: true },
  );

  return forecastInfo;
};

const getForecastInfoFromNetCDF = async (filename, forecastConfigName) => {
  const data = readFileSync(`./grib_data_${forecastConfigName}/${filename}`);
  const reader = new NetCDFReader(data);
  const lonName = reader.header.variables[1].name;
  const latName = reader.header.variables[0].name;
  const loLength = reader.getDataVariable(lonName).length;
  const laLength = reader.getDataVariable(latName).length;

  const name = config[forecastConfigName].forecastName;
  const time =
    forecastConfigName === 'cwam'
      ? getRefTimeCWAM(filename)
      : getRefTimeGFS(filename, forecastConfigName);

  const lo1 = roundTo(5, reader.getDataVariable(lonName)[0]);
  const lo2 = roundTo(5, reader.getDataVariable(lonName)[loLength - 1]);
  const dx = roundTo(7, (lo2 - lo1) / (loLength - 1));
  const la1 = roundTo(5, reader.getDataVariable(latName)[0]);
  const la2 = roundTo(5, reader.getDataVariable(latName)[laLength - 1]);
  const dy = roundTo(7, (la2 - la1) / (laLength - 1));
  const nx = loLength;
  const ny = laLength;

  const forecastInfo = await ForecastInfo.findOneAndUpdate(
    { name },
    { name, time, lo1, lo2, la1, la2, dy, dx, nx, ny },
    { upsert: true, new: true },
  );

  return forecastInfo;
};

module.exports = {
  getForecastInfo,
  getforecastHeader,
  getForecastHeaderCWAM,
  getForecastHeaderGFS,
};

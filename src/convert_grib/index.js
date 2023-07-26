/* eslint-disable arrow-body-style */
/* eslint-disable no-await-in-loop */
/* eslint-disable no-param-reassign */
/* eslint-disable operator-linebreak */
/* eslint-disable object-curly-newline */
/* eslint-disable implicit-arrow-linebreak */
const util = require('util');
const mongoose = require('mongoose');
const grib2json = require('grib2json').default;
const { Spot, Forecast } = require('../models');

const getJson = util.promisify(grib2json);

const getAbsoluteLon = (lonStart, lonEnd) => {
  return lonStart > lonEnd ? lonEnd + 360 : lonEnd;
};

const getForecastInfo = (
  { lo1, lo2, la1, la2, dx, dy, refTime, forecastTime },
  filename,
) => {
  const regex = /(?<=_)[0-9]+_[0-9]+_[0-9]+_[A-Za-z]+(?=.grib)/;
  const regex2 = /(?<=\/)[A-Za-z]+(?=_)/;
  const forecastType = filename.match(regex)[0].split('_')[3];
  const forecastName = filename.match(regex2)[0];
  return {
    forecastName,
    forecastType,
    refTime,
    forecastTime,
    lo1,
    lo2,
    la1,
    la2,
    dx,
    dy,
  };
};

const getGribIndex = (forecastInfo, spot) => {
  // check if end value for longitute is lower than start value
  const lo2 = getAbsoluteLon(forecastInfo.lo1, forecastInfo.lo2);
  const spotLon = getAbsoluteLon(forecastInfo.lo1, spot.lon);

  const latRow = (spot.lat - forecastInfo.la1) / forecastInfo.dy;
  const latWidth = (lo2 - forecastInfo.lo1) / forecastInfo.dx + 1;
  const lonPos = (spotLon - forecastInfo.lo1) / forecastInfo.dx;
  return latRow * latWidth + lonPos;
};

const isBetween = (x, min, max) => {
  return x >= min && x <= max;
};

const inGrid = (spot, forecastInfo) => {
  const lo2 = getAbsoluteLon(forecastInfo.lo1, forecastInfo.lo2);
  const spotLon = getAbsoluteLon(forecastInfo.lo1, spot.lon);

  return (
    isBetween(spot.lat, forecastInfo.la1, forecastInfo.la2) &&
    isBetween(spotLon, forecastInfo.lo1, lo2)
  );
};

const getMinPoint = (point, delta) => {
  return point % delta === 0 ? point : point - (point % delta);
};

const getMaxPoint = (point, delta) => {
  return point % delta === 0 ? point : point - (point % delta) + delta;
};

const calculateDataValue = (spot, forecastInfo, forecastData) => {
  const spotLon = getAbsoluteLon(forecastInfo.lo1, spot.lon);

  const minLon = getMinPoint(spotLon, forecastInfo.dx);
  const maxLon = getMaxPoint(spotLon, forecastInfo.dx);
  const minLat = getMinPoint(spot.lat, forecastInfo.dy);
  const maxLat = getMaxPoint(spot.lat, forecastInfo.dy);

  const posA = { lon: minLon, lat: minLat };
  const posB = { lon: maxLon, lat: minLat };
  const posC = { lon: maxLon, lat: maxLat };
  const posD = { lon: minLon, lat: maxLat };

  const valueA = forecastData[Math.round(getGribIndex(forecastInfo, posA))];
  const valueB = forecastData[Math.round(getGribIndex(forecastInfo, posB))];
  const valueC = forecastData[Math.round(getGribIndex(forecastInfo, posC))];
  const valueD = forecastData[Math.round(getGribIndex(forecastInfo, posD))];

  const valueAB =
    valueA + ((valueB - valueA) * (spotLon - minLon)) / forecastInfo.dx;
  const valueDC =
    valueD + ((valueC - valueD) * (spotLon - minLon)) / forecastInfo.dx;

  return (
    valueAB + ((valueDC - valueAB) * (spot.lat - minLat)) / forecastInfo.dy
  );
};

const populateSpots = async (filename, spots) => {
  const forecastJson = await getJson(filename, {
    scriptPath: './src/convert_grib/grib2json/src/bin/grib2json',
    names: true, // (default false): Return descriptive names too
    data: true, // (default false): Return data, not just headers
  });

  // get grib info from header and filename
  const forecastInfo = getForecastInfo(forecastJson[0].header, filename);

  // eslint-disable-next-line no-restricted-syntax
  spots.forEach((spot) => {
    // check if spot is in model boarders
    if (!inGrid(spot, forecastInfo)) {
      return;
    }
    // calculate value
    const dataValue = calculateDataValue(
      spot,
      forecastInfo,
      forecastJson[0].data,
    );

    spot.timestamp = new Date();
    if (spot[forecastInfo.forecastType]) {
      const tempForecastObject = { ...spot[forecastInfo.forecastType] };
      tempForecastObject[
        `${forecastInfo.forecastName}_${forecastInfo.forecastTime}`
      ] = dataValue;
      spot[forecastInfo.forecastType] = tempForecastObject;
    } else {
      spot[forecastInfo.forecastType] = {
        [`${forecastInfo.forecastName}_${forecastInfo.forecastTime}`]:
          dataValue,
      };
    }
  });

  let forecast = await Forecast.findOne({ name: forecastInfo.forecastName });
  if (!forecast) {
    forecast = new Forecast({
      _id: new mongoose.Types.ObjectId(),
      timestamp: forecastInfo.refTime,
      name: forecastInfo.forecastName,
      lo1: forecastInfo.lo1,
      lo2: forecastInfo.lo2,
      la1: forecastInfo.la1,
      la2: forecastInfo.la2,
      dy: forecastInfo.dy,
      dx: forecastInfo.dx,
    });
  } else {
    forecast.timestamp = forecastInfo.refTime;
    forecast.lo1 = forecastInfo.lo1;
    forecast.lo2 = forecastInfo.lo2;
    forecast.la1 = forecastInfo.la1;
    forecast.la2 = forecastInfo.la2;
    forecast.dy = forecastInfo.dy;
    forecast.dx = forecastInfo.dx;
  }
  await forecast.save();
};

const convertGrib = async (filenames, path) => {
  const spots = await Spot.find({});
  if (!spots) {
    return false;
  }
  try {
    // eslint-disable-next-line no-restricted-syntax
    for (const filename of filenames) {
      // eslint-disable-next-line no-await-in-loop
      await populateSpots(`${path}/${filename}`, spots);
    }
    // eslint-disable-next-line no-restricted-syntax
    for (const spot of spots) {
      await spot.save();
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

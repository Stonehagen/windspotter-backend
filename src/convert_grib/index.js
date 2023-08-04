/* eslint-disable implicit-arrow-linebreak */
/* eslint-disable no-underscore-dangle */
/* eslint-disable arrow-body-style */
/* eslint-disable object-curly-newline */
/* eslint-disable no-console */
/* eslint-disable no-restricted-syntax */
/* eslint-disable no-await-in-loop */
const mongoose = require('mongoose');
const util = require('util');
const grib2json = require('grib2json').default;
const { Spot, Forecast, ForecastInfo } = require('../models');

const getJson = util.promisify(grib2json);

const getforecastHeader = (
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

const getForecastInfo = async (forecastHeader) => {
  const { forecastName, refTime, lo1, lo2, la1, la2, dy, dx } = forecastHeader;

  // check if forecast already exists
  // if not create new forecast
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
    },
    { upsert: true, new: true },
  );

  return forecastInfo;
};

const getAbsoluteLon = (lonStart, lonEnd) => {
  return lonStart > lonEnd ? lonEnd + 360 : lonEnd;
};

const isBetween = (x, min, max) => {
  return x >= min && x <= max;
};

const inGrid = (spot, forecastHeader) => {
  const lo2 = getAbsoluteLon(forecastHeader.lo1, forecastHeader.lo2);
  const spotLon = getAbsoluteLon(forecastHeader.lo1, spot.lon);

  return (
    isBetween(spot.lat, forecastHeader.la1, forecastHeader.la2) &&
    isBetween(spotLon, forecastHeader.lo1, lo2)
  );
};

const getMinPoint = (point, delta) => {
  return point % delta === 0 ? point : point - (point % delta);
};

const getMaxPoint = (point, delta) => {
  return point % delta === 0 ? point : point - (point % delta) + delta;
};

const getGribIndex = (forecastHeader, spot) => {
  // check if end value for longitute is lower than start value
  const lo2 = getAbsoluteLon(forecastHeader.lo1, forecastHeader.lo2);
  const spotLon = getAbsoluteLon(forecastHeader.lo1, spot.lon);

  const latRow = (spot.lat - forecastHeader.la1) / forecastHeader.dy;
  const latWidth = (lo2 - forecastHeader.lo1) / forecastHeader.dx + 1;
  const lonPos = (spotLon - forecastHeader.lo1) / forecastHeader.dx;
  return Math.round(latRow * latWidth + lonPos);
};

const calculateDataValue = (spot, forecastHeader, forecastData) => {
  // bilinear interpolation for 4 points around spot position
  // https://en.wikipedia.org/wiki/Bilinear_interpolation
  const x = getAbsoluteLon(forecastHeader.lo1, spot.lon);
  const y = spot.lat;
  const x1 = getMinPoint(x, forecastHeader.dx);
  const x2 = getMaxPoint(x, forecastHeader.dx);
  const y1 = getMinPoint(y, forecastHeader.dy);
  const y2 = getMaxPoint(y, forecastHeader.dy);

  const Q11 = forecastData[getGribIndex(forecastHeader, { lon: x1, lat: y1 })];
  const Q21 = forecastData[getGribIndex(forecastHeader, { lon: x2, lat: y1 })];
  const Q22 = forecastData[getGribIndex(forecastHeader, { lon: x2, lat: y2 })];
  const Q12 = forecastData[getGribIndex(forecastHeader, { lon: x1, lat: y2 })];

  const R1 = ((x2 - x) / (x2 - x1)) * Q11 + ((x - x1) / (x2 - x1)) * Q21;
  const R2 = ((x2 - x) / (x2 - x1)) * Q12 + ((x - x1) / (x2 - x1)) * Q22;

  const P = ((y2 - y) / (y2 - y1)) * R1 + ((y - y1) / (y2 - y1)) * R2;

  return P;
};

const updateSpotForecast = async (
  spot,
  forecastInfo,
  forecastHeader,
  dataValue,
) => {
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
      time: forecastHeader.refTime,
      [forecastHeader.forecastType]: {
        [forecastHeader.forecastTime]: dataValue,
      },
    });
    spot.forecasts.push(forecastData);

    await forecastData.save();
  } else {
    // if forecast exists update data
    forecastFound[forecastHeader.forecastType] = {
      ...forecastFound[forecastHeader.forecastType],
      [forecastHeader.forecastTime]: dataValue,
    };
    await forecastFound.save();
  }
  await spot.populate({
    path: 'forecasts',
    match: { forecastInfo: forecastInfo._id },
  });
};

const populateSpots = async (filename, spots) => {
  const forecastJson = await getJson(filename, {
    scriptPath: './src/convert_grib/grib2json/src/bin/grib2json',
    names: true, // (default false): Return descriptive names too
    data: true, // (default false): Return data, not just headers
  });

  // get grib info from header
  const forecastHeader = getforecastHeader(forecastJson[0].header, filename);
  // get forecastInfo document from db or create new one
  const forecastInfo = await getForecastInfo(forecastHeader);

  // Calculate data values for all spots in parallel
  const dataValuePromises = spots.map((spot) => {
    // check if spot is in model borders
    if (inGrid(spot, forecastHeader)) {
      return calculateDataValue(spot, forecastHeader, forecastJson[0].data);
    }
    return null;
  });

  // Wait for all dataValue promises to resolve
  const dataValues = await Promise.all(dataValuePromises);

  // Update spot forecasts with calculated data values
  spots.forEach((spot, index) => {
    if (dataValues[index] !== null) {
      updateSpotForecast(spot, forecastInfo, forecastHeader, dataValues[index]);
    }
  });

  await forecastInfo.save();
};

const convertGrib = async (filenames, path) => {
  const spots = await Spot.find({}).populate('forecasts').exec();
  if (!spots) {
    return false;
  }
  try {
    for (const filename of filenames) {
      await populateSpots(`${path}/${filename}`, spots);
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
  convertGrib,
};

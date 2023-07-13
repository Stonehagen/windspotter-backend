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

const populateDatabase = async (filename, spots) => {
  // get forecast info from filename
  const regex = /(?<=_)[0-9]+_[0-9]+_[0-9]+_[A-Za-z]+(?=.grib)/;
  const gribTime = filename.match(regex)[0].split('_')[0];
  const forecastTime = filename.match(regex)[0].split('_')[1];
  const forecastType = filename.match(regex)[0].split('_')[3];
  const regex2 = /(?<=\/)[A-Za-z]+(?=_)/;
  const forecastName = filename.match(regex2)[0];
  const gribTimestamp = new Date(
    `${gribTime.slice(0, 4)}-${gribTime.slice(4, 6)}-${gribTime.slice(
      6,
      8,
    )}T${gribTime.slice(8, 10)}:00:00+02:00`,
  );

  const forecastJson = await getJson(filename, {
    scriptPath: './src/convert_grib/grib2json/src/bin/grib2json',
    names: true, // (default false): Return descriptive names too
    data: true, // (default false): Return data, not just headers
  });

  // get grib info from header
  let { lo2 } = forecastJson[0].header;
  const { lo1, la1, la2, dx, dy } = forecastJson[0].header;

  // eslint-disable-next-line no-restricted-syntax
  spots.forEach((spot) => {
    // check if end value for longitute is lower than start value
    const spotLon = lo1 > spot.lon ? spot.lon + 360 : spot.lon;
    lo2 = lo1 > lo2 ? lo2 + 360 : lo2;

    const latRow = (spot.lat - la1) / dy;
    const latWidth = (lo2 - lo1) / dx + 1;
    const lonPos = (spotLon - lo1) / dx;
    const gribIndex = latRow * latWidth + lonPos;

    spot.timestamp = new Date();
    if (spot[forecastType]) {
      const tempForecastObject = { ...spot[forecastType] };
      tempForecastObject[`${forecastName}_${forecastTime}`] =
        forecastJson[0].data[Math.round(gribIndex)];
      spot[forecastType] = tempForecastObject;
    } else {
      spot[forecastType] = {
        [`${forecastName}_${forecastTime}`]:
          forecastJson[0].data[Math.round(gribIndex)],
      };
    }
  });

  let forecast = await Forecast.findOne({ name: forecastName });
  if (!forecast) {
    forecast = new Forecast({
      _id: new mongoose.Types.ObjectId(),
      timestamp: gribTimestamp,
      name: forecastName,
      lo1,
      lo2,
      la1,
      la2,
      dy,
      dx,
    });
  } else {
    forecast.timestamp = gribTimestamp;
    forecast[lo1] = lo1;
    forecast[lo2] = lo2;
    forecast[la1] = la1;
    forecast[la2] = la2;
    forecast[dy] = dy;
    forecast[dx] = dx;
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
      await populateDatabase(`${path}/${filename}`, spots);
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

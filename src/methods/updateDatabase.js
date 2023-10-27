const mongoose = require('mongoose');
const { Forecast } = require('../models');

const updateSpotForecast = async (
  spot,
  forecastInfo,
  forecastHeader,
  dataValue,
) => {
  // check if forecast already exists
  const forecastData = spot.forecasts.find(
    (spotForecast) =>
      spotForecast.forecastInfo.toString() === forecastInfo._id.toString(),
  );

  const forecastTime = new Date(
    // add forecastTime in minutes to refTime to get timestamp of forecast
    new Date(forecastHeader.refTime).getTime() +
      forecastHeader.forecastTime * 60000,
  );

  const twoDaysBefore = new Date(
    new Date().getTime() - 2 * 24 * 60 * 60 * 1000,
  );

  // if not create new forecast
  if (!forecastData) {
    const forecastData = new Forecast({
      _id: new mongoose.Types.ObjectId(),
      forecastInfo,
      time: forecastHeader.refTime,
      [forecastHeader.forecastType]: {
        [forecastTime.toUTCString()]: dataValue,
      },
    });
    spot.forecasts.push(forecastData);
    await forecastData.save();
  } else {
    // if forecast exists remove data that is to old
    for (const key in forecastData[forecastHeader.forecastType]) {
      const dateFromKey = new Date(key);
      if (dateFromKey.getTime() < twoDaysBefore.getTime()) {
        delete forecastData[forecastHeader.forecastType][key];
      }
    }

    // update data
    forecastData.time = forecastHeader.refTime;
    forecastData[forecastHeader.forecastType] = {
      ...forecastData[forecastHeader.forecastType],
    };
    (forecastData[forecastHeader.forecastType][forecastTime.toUTCString()] =
      dataValue),
    await forecastData.save();
  }
  await spot.populate({
    path: 'forecasts',
    match: { forecastInfo: forecastInfo._id.toString() },
  });
};

module.exports = {
  updateSpotForecast,
};

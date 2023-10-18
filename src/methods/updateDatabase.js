const mongoose = require('mongoose');
const { Forecast } = require('../models');

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

  const forecastTime = new Date(
    // add forecastTime in minutes to refTime to get timestamp of forecast
    new Date(forecastHeader.refTime).getTime() +
      forecastHeader.forecastTime * 60000,
  );

  // if not create new forecast
  if (!forecastFound) {
    const forecastData = new Forecast({
      _id: new mongoose.Types.ObjectId(),
      forecastInfo,
      time: forecastHeader.refTime,
      [forecastHeader.forecastType]: {
        [forecastTime]: dataValue,
      },
    });
    spot.forecasts.push(forecastData);

    await forecastData.save();
  } else {
    // if forecast exists update data
    forecastFound.time = forecastHeader.refTime;
    forecastFound[forecastHeader.forecastType] = {
      ...forecastFound[forecastHeader.forecastType],
      [forecastTime]: dataValue,
    };
    await forecastFound.save();
  }
  await spot.populate({
    path: 'forecasts',
    match: { forecastInfo: forecastInfo._id.toString() },
  });
};

module.exports = {
  updateSpotForecast,
}
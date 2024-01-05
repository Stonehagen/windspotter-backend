const mongoose = require('mongoose');
const { Forecast, Spot } = require('../models');
const moment = require('moment');

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
    const newForecastData = new Forecast({
      _id: new mongoose.Types.ObjectId(),
      forecastInfo,
      time: forecastHeader.refTime,
      [forecastHeader.forecastType]: {
        [forecastTime.toUTCString()]: dataValue,
      },
    });
    spot.forecasts.push(newForecastData);
    await newForecastData.save();
  } else if (!forecastData[forecastHeader.forecastType]) {
    // if forecast exists but forecastType does not create new forecastType
    forecastData[forecastHeader.forecastType] = {
      [forecastTime.toUTCString()]: dataValue,
    };
    await Forecast.updateOne(
      { _id: forecastData._id },
      {
        $set: {
          [forecastHeader.forecastType]:
            forecastData[forecastHeader.forecastType],
        },
      },
    );
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
    forecastData[forecastHeader.forecastType][forecastTime.toUTCString()] =
      dataValue;
    await Forecast.updateOne(
      { _id: forecastData._id },
      {
        $set: {
          time: forecastHeader.refTime,
          [forecastHeader.forecastType]:
            forecastData[forecastHeader.forecastType],
        },
      },
    );
  }
  await spot.populate({
    path: 'forecasts',
    match: { forecastInfo: forecastInfo._id.toString() },
  });
};

const compileSpotForecasts = async () => {
  // get all spot ids
  const spotIds = await Spot.find().select('_id');
  // compress all spot forecasts
  for (const spotId of spotIds) {
    await compressSpotForecast(spotId);
  }
};

const compressSpotForecast = async (id) => {
  const getWindDirection = (v, u) => {
    return (270 - Math.atan2(v, u) * (180 / Math.PI)) % 360;
  };

  const getWindSpeed = (v, u) => {
    return Math.sqrt(Math.pow(u, 2) + Math.pow(v, 2));
  };

  const getTemperature = (t) => {
    return t - 273.15;
  };

  const getLastForecastDay = (forecast) => {
    if (!forecast) {
      return new Date(0);
    }
    const lastDay = Object.keys(forecast)
      .sort((a, b) => new Date(a) - new Date(b))
      .pop();

    return lastDay;
  };

  const spot = await Spot.findById(id).populate({
    path: 'forecasts',
    populate: { path: 'forecastInfo', model: 'ForecastInfo' },
  });

  // get the waveForecast cwam
  let waveForecast = spot.forecasts.filter(
    (forecast) => forecast.forecastInfo.name === 'cwam',
  )[0];

  // get the shortRangeWeather icon-d2
  let shortRangeWeather = {
    ...spot.forecasts.filter(
      (forecast) => forecast.forecastInfo.name === 'icon-d2',
    ),
  }[0];

  // get the midRangeWeather: Icon-eu
  let midRangeWeather = {
    ...spot.forecasts.filter(
      (forecast) => forecast.forecastInfo.name === 'icon-eu',
    ),
  }[0];

  let longRangeWeather = {
    ...spot.forecasts.filter(
      (forecast) => forecast.forecastInfo.name === 'gfsAWS',
    ),
  }[0];

  if (
    !waveForecast &&
    !shortRangeWeather &&
    !midRangeWeather &&
    !longRangeWeather
  ) {
    return;
  }

  if (!waveForecast) {
    waveForecast = {
      mwd: [],
      swh: [],
      tm10: [],
      forecastInfo: { time: new Date(0) },
    };
  }

  if (!shortRangeWeather) {
    shortRangeWeather = {
      t_2m: [],
      v_10m: [],
      u_10m: [],
      vmax_10m: [],
      clct_mod: [],
      rain_gsp: [],
      forecastInfo: { time: new Date(0) },
    };
  }

  if (!midRangeWeather) {
    midRangeWeather = {
      t_2m: [],
      v_10m: [],
      u_10m: [],
      vmax_10m: [],
      clct_mod: [],
      rain_gsp: [],
      forecastInfo: { time: new Date(0) },
    };
  }

  if (!longRangeWeather) {
    longRangeWeather = {
      t_2m: [],
      v_10m: [],
      u_10m: [],
      vmax_10m: [],
      clct_mod: [],
      rain_gsp: [],
      forecastInfo: { time: new Date(0) },
    };
  }

  const spotForecast = {
    forecastModels: {},
    forecast: {
      mwd: waveForecast.mwd ? waveForecast.mwd : [],
      swh: waveForecast.swh ? waveForecast.swh : [],
      tm10: waveForecast.tm10 ? waveForecast.tm10 : [],
      t_2m: shortRangeWeather.t_2m ? shortRangeWeather.t_2m : [],
      v_10m: shortRangeWeather.v_10m ? shortRangeWeather.v_10m : [],
      u_10m: shortRangeWeather.u_10m ? shortRangeWeather.u_10m : [],
      vmax_10m: shortRangeWeather.vmax_10m ? shortRangeWeather.vmax_10m : [],
      clct_mod: shortRangeWeather.clct_mod ? shortRangeWeather.clct_mod : [],
      rain_gsp: shortRangeWeather.rain_gsp ? shortRangeWeather.rain_gsp : [],
    },
  };

  const midRangeForecast = {
    t_2m: midRangeWeather.t_2m ? midRangeWeather.t_2m : [],
    v_10m: midRangeWeather.v_10m ? midRangeWeather.v_10m : [],
    u_10m: midRangeWeather.u_10m ? midRangeWeather.u_10m : [],
    vmax_10m: midRangeWeather.vmax_10m ? midRangeWeather.vmax_10m : [],
    clct_mod: midRangeWeather.clct_mod ? midRangeWeather.clct_mod : [],
    rain_gsp: midRangeWeather.rain_gsp ? midRangeWeather.rain_gsp : [],
  };

  const longRangeForecast = {
    t_2m: longRangeWeather.tmp ? longRangeWeather.tmp : [],
    v_10m: longRangeWeather.vgrd ? longRangeWeather.vgrd : [],
    u_10m: longRangeWeather.ugrd ? longRangeWeather.ugrd : [],
    vmax_10m: longRangeWeather.gust ? longRangeWeather.gust : [],
    clct_mod: longRangeWeather.tcdc ? longRangeWeather.tcdc : [],
    rain_gsp: longRangeWeather.apcp ? longRangeWeather.apcp : [],
  };

  let lastShortRangeForecastDay;
  let lastMidRangeForecastDay;
  // go through the midRangeForecast
  // delete all days that are in the shortRangeForecast
  // combine the objects in short and midrange forecast
  for (const [key, value] of Object.entries(midRangeForecast)) {
    // get the end of the short forecast term
    lastShortRangeForecastDay = getLastForecastDay(shortRangeWeather[key]);
    for (const [date, data] of Object.entries(value)) {
      if (
        new Date(date).getTime() > new Date(lastShortRangeForecastDay).getTime()
      ) {
        spotForecast.forecast[key][date] = data;
      }
    }
  }

  // go through the longRangeForecast
  // delete all days that are in the midRangeForecast
  // combine the objects in mid and longrange forecast
  for (const [key, value] of Object.entries(longRangeForecast)) {
    // get the end of the mid forecast term
    lastMidRangeForecastDay = getLastForecastDay(midRangeWeather[key]);
    for (const [date, data] of Object.entries(value)) {
      if (
        new Date(date).getTime() > new Date(lastMidRangeForecastDay).getTime()
      ) {
        spotForecast.forecast[key][date] = data;
      }
    }
  }

  spotForecast.forecastModels = {
    shortRange: {
      name: 'ICON D2',
      time: shortRangeWeather.forecastInfo.time,
      lastDay: lastShortRangeForecastDay,
    },
    midRange: {
      name: 'ICON EU',
      time: midRangeWeather.forecastInfo.time,
      lastDay: lastMidRangeForecastDay,
    },
    longRange: { name: 'GFS', time: longRangeWeather.forecastInfo.time },
    wave: { name: waveForecast.forecastInfo.name },
  };

  lastShortRangeForecastDay = new Date(
    spotForecast.forecastModels.shortRange.lastDay,
  );
  lastMidRangeForecastDay = new Date(
    spotForecast.forecastModels.midRange.lastDay,
  );

  const getForecastModel = (timestamp, forecastModels) => {
    const time = new Date(timestamp);
    if (time.getTime() <= lastShortRangeForecastDay.getTime()) {
      return forecastModels.shortRange;
    } else if (
      time.getTime() > lastShortRangeForecastDay.getTime() &&
      time.getTime() <= lastMidRangeForecastDay.getTime()
    ) {
      return forecastModels.midRange;
    } else {
      return forecastModels.longRange;
    }
  };

  const newForecastArray = [];

  // get current date
  const today = new Date().setHours(0, 0, 0, 0);

  // sort forecast by date
  // v_10m: Wind at 10m above ground is leading value
  const sortedDates = Object.keys(spotForecast.forecast.v_10m).sort((a, b) => {
    return new Date(a) - new Date(b);
  });

  // get last day of forecast
  const lastTimestamp = new Date(sortedDates[sortedDates.length - 1]);
  const lastDay = +moment(lastTimestamp).format('DD');

  for (const time of sortedDates) {
    const forecastTimestamp = new Date(time);

    // only add forecast values for today and the future
    if (forecastTimestamp.getTime() >= today) {
      // if forecast value is not available, use last available value or 0
      const lastForecast = newForecastArray[newForecastArray.length - 1]
        ? newForecastArray[newForecastArray.length - 1]
        : {
            t: 0,
            dir: 0,
            ws: 0,
            wsMax: 0,
            clouds: 0,
            rain: 0,
            waveDir: 0,
            waveHeight: 0,
            wavePeriod: 0,
          };

      const forecastModel = getForecastModel(
        forecastTimestamp,
        spotForecast.forecastModels,
      );

      // add forecast values to array
      newForecastArray.push({
        time: forecastTimestamp,
        hour: +moment(forecastTimestamp).format('HH'),
        day: +moment(forecastTimestamp).format('DD'),
        model: forecastModel.name,
        modelTime: forecastModel.time,
        t: spotForecast.forecast.t_2m[time]
          ? getTemperature(spotForecast.forecast.t_2m[time])
          : lastForecast.t,
        dir: getWindDirection(
          spotForecast.forecast.v_10m[time],
          spotForecast.forecast.u_10m[time],
        ),
        ws: getWindSpeed(
          spotForecast.forecast.v_10m[time],
          spotForecast.forecast.u_10m[time],
        ),
        wsMax: spotForecast.forecast.vmax_10m[time]
          ? spotForecast.forecast.vmax_10m[time]
          : getWindSpeed(
              spotForecast.forecast.v_10m[time],
              spotForecast.forecast.u_10m[time],
            ),
        clouds: spotForecast.forecast.clct_mod[time]
          ? spotForecast.forecast.clct_mod[time]
          : 0,
        rain: spotForecast.forecast.rain_gsp[time]
          ? spotForecast.forecast.rain_gsp[time]
          : 0,
        waveDir: spotForecast.forecast.mwd[time]
          ? spotForecast.forecast.mwd[time]
          : 0,
        waveHeight: spotForecast.forecast.swh[time]
          ? spotForecast.forecast.swh[time]
          : 0,
        wavePeriod: spotForecast.forecast.tm10[time]
          ? spotForecast.forecast.tm10[time]
          : 0,
      });
    }
  }

  spot.forecast = newForecastArray;
  await spot.save();
};

module.exports = {
  updateSpotForecast,
  compileSpotForecasts,
};

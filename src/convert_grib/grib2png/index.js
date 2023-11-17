const dotenv = require('dotenv');
dotenv.config({ path: __dirname + '/../.env' });
const util = require('util');
const mongoose = require('mongoose');
const cloudinary = require('cloudinary').v2;
const PNG = require('pngjs').PNG;
const grib2json = require('grib2json').default;
const getJson = util.promisify(grib2json);

const { getforecastHeader } = require('../../methods/forecastInfos');
const { MapForecast, ForecastInfo } = require('../../models');

cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.CLOUD_API_KEY,
  api_secret: process.env.CLOUD_API_SECRET,
});

// get max value of array
const getMax = (arr) => {
  let len = arr.length;
  let max = -Infinity;
  while (len--) {
    max = arr[len] > max ? arr[len] : max;
  }
  return max;
};

// get min value of array
const getMin = (arr) => {
  let len = arr.length;
  let min = Infinity;
  while (len--) {
    min = arr[len] < min ? arr[len] : min;
  }
  return min;
};

// get JSON from grib file
const getForecastJSON = async (filename, forecastConfigName) => {
  const forecastJson = await getJson(filename, {
    scriptPath: './src/convert_grib/grib2json/src/bin/grib2json',
    names: true, // (default false): Return descriptive names too
    data: true, // (default false): Return data, not just headers
  });

  // get grib info from header
  const forecastHeader = getforecastHeader(
    forecastJson[0].header,
    filename,
    forecastConfigName,
  );

  return {
    header: forecastHeader,
    dataValues: forecastJson[0].data,
    forecastRefTime: forecastHeader.refTime,
    forecastName: forecastHeader.forecastName,
    forecastTime: forecastHeader.forecastTime,
    forecastType: forecastHeader.forecastType,
  };
};

// update forecastMaps in DB
const updateForecastMap = async (mapData, url, firstFile) => {
  const forecastTime = new Date(
    // add forecastTime in minutes to refTime to get timestamp of forecast
    new Date(mapData.refTime).getTime() + mapData.forecastTime * 60000,
  );

  // get date two days before
  const twoDaysBefore = new Date(
    new Date().getTime() - 2 * 24 * 60 * 60 * 1000,
  );

  // get ForecastInfo
  const forecastInfo = await ForecastInfo.findOne({
    name: mapData.forecastName,
  });

  // get forecastMap
  const mapForecast = await MapForecast.findOne({
    forecastInfo: forecastInfo._id,
  });

  // if not create new forecastMap
  if (!mapForecast) {
    const newMapForecast = new MapForecast({
      _id: new mongoose.Types.ObjectId(),
      forecastInfo,
      forecastMaps: {
        [forecastTime.toUTCString()]: {
          data: mapData,
          url,
        },
      },
    });
    await newMapForecast.save();
  } else {
    // if forecast exists remove data that is to old on the first file
    if (firstFile) {
      for (const key in mapForecast.forecastMaps) {
        const dateFromKey = new Date(key);
        if (dateFromKey.getTime() < twoDaysBefore.getTime()) {
          // delete file from cloudanary
          const public_id = mapForecast.forecastMaps[key].url.split('/').pop();
          await cloudinary.api
            .delete_resources([public_id], {
              type: 'upload',
              resource_type: 'image',
            })
            .then(console.log);

          // delete forecastMap from DB
          delete mapForecast.forecastMaps[key];
        }
      }
    }

    // update data in forecastMap
    mapForecast.forecastMaps[forecastTime.toUTCString()] = {
      data: mapData,
      url,
    };
    await MapForecast.updateOne(
      { _id: mapForecast._id },
      {
        $set: {
          forecastMaps: mapForecast.forecastMaps,
        },
      },
    );
  }
};

// convert JSON to PNG and upload to cloudinary
const convertJSON2PNG = async (forecastUandV, firstFile) => {
  const u = forecastUandV['u_10m'];
  const v = forecastUandV['v_10m'];

  const mapData = {
    forecastName: forecastUandV.forecastHeader.forecastName,
    forecastTime: forecastUandV.forecastHeader.forecastTime,
    refTime: forecastUandV.forecastHeader.refTime,
    height: forecastUandV.forecastHeader.ny,
    width: forecastUandV.forecastHeader.nx,
    lo1: forecastUandV.forecastHeader.lo1,
    la1: forecastUandV.forecastHeader.la1,
    lo2: forecastUandV.forecastHeader.lo2,
    la2: forecastUandV.forecastHeader.la2,
    nx: forecastUandV.forecastHeader.nx,
    ny: forecastUandV.forecastHeader.ny,
    dx: forecastUandV.forecastHeader.dx,
    dy: forecastUandV.forecastHeader.dy,
    uMin: getMin(u),
    uMax: getMax(u),
    vMin: getMin(v),
    vMax: getMax(v),
  };

  // create new PNG with size of the forecast
  const map = new PNG({
    width: mapData.width,
    height: mapData.height,
    colorType: 2,
    filterType: 4,
  });

  // set rgba values for each pixel of the PNG depending on u and v values
  for (let y = 0; y < mapData.height; y++) {
    for (let x = 0; x < mapData.width; x++) {
      const i = (y * mapData.width + x) * 4;
      const k = y * mapData.width + x;
      const uValue = u[k];
      const vValue = v[k];
      // scale values from 0-255 depending on min and max values
      map.data[i + 0] = Math.round(
        ((uValue - mapData.uMin) / (mapData.uMax - mapData.uMin)) * 255,
      );
      map.data[i + 1] = Math.round(
        ((vValue - mapData.vMin) / (mapData.vMax - mapData.vMin)) * 255,
      );
      map.data[i + 2] = 0;
      map.data[i + 3] = 255;
    }
  }

  // create public_id for cloudinary (filename)
  const public_id = (() => {
    const forecastTime =
      // add forecastTime in minutes to refTime to get timestamp of forecast
      new Date(mapData.refTime).getTime() + mapData.forecastTime * 60000;
    return `${mapData.forecastName}_${forecastTime}`;
  })();

  // upload PNG to cloudinary as Promise
  const uploadStream = async (map) => {
    return new Promise((res, rej) => {
      const theTransformStream = cloudinary.uploader.upload_stream(
        {
          public_id,
          overwrite: true,
          invalidate: true,
          resource_type: 'image',
        },
        (err, result) => {
          if (err) return rej(err);
          res(result);
        },
      );
      map.pack().pipe(theTransformStream);
    });
  };

  // upload PNG to cloudinary and get response
  const response = await uploadStream(map);

  // update forecastMap in DB with url of PNG and mapData
  await updateForecastMap(mapData, response.url, firstFile);
};

// convert grib files to png and upload to cloudinary
const convertGrib2Png = async (windFiles, forecastConfigName) => {
  try {
    let firstFile = true;
    for (const [_, filenames] of windFiles.entries()) {
      const forecastUandV = {};
      for (const filename of filenames) {
        const forecastJSON = await getForecastJSON(
          `./grib_data_${forecastConfigName}/${filename}`,
          forecastConfigName,
        );

        forecastUandV[forecastJSON.forecastType] = forecastJSON.dataValues;
        if (forecastUandV.forecastRefTime === undefined) {
          forecastUandV.forecastHeader = forecastJSON.header;
          forecastUandV.forecastRefTime = forecastJSON.forecastRefTime;
          forecastUandV.forecastTime = forecastJSON.forecastTime;
          forecastUandV.forecastName = forecastJSON.forecastName;
        }
      }
      // convert JSON to PNG and upload to cloudinary and delete old files
      await convertJSON2PNG(forecastUandV, firstFile);
      firstFile = false;
    }
  } catch (err) {
    console.log(err);
    return false;
  }
  return true;
};

module.exports = {
  convertGrib2Png,
};

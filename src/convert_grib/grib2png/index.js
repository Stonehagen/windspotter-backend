const util = require('util');
const grib2json = require('grib2json').default;
const { getforecastHeader } = require('../../methods/forecastInfos');
const PNG = require('pngjs').PNG;
const fs = require('fs');
const chroma = require('chroma-js');

//+ forecastHeader:
// json: {
//+   "refTime": "2016-04-30T06:00:00.000Z",
//+   "forecastTime": 0,
//+   "nx": 360,
//+   "ny": 181,
//+   "lo1": 0.0,
//+   "la1": 90.0,
//+   "dx": 1.0,
//+   "dy": 1.0
// }

const getJson = util.promisify(grib2json);

const getMax = (arr) => {
  let len = arr.length;
  let max = -Infinity;
  while (len--) {
    max = arr[len] > max ? arr[len] : max;
  }
  return max;
};

const getMin = (arr) => {
  let len = arr.length;
  let min = Infinity;
  while (len--) {
    min = arr[len] < min ? arr[len] : min;
  }
  return min;
};

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

const convertJSON2PNG = (forecastUandV) => {
  const forecastHeader = forecastUandV.forecastHeader;

  const forecastTime = new Date(
    // add forecastTime in minutes to refTime to get timestamp of forecast
    new Date(forecastHeader.refTime).getTime() +
      forecastHeader.forecastTime * 60000,
  );
  const filename = `${forecastUandV.forecastName}_${forecastTime}`;

  const u = forecastUandV['u_10m'];
  const v = forecastUandV['v_10m'];

  const uMin = getMin(u);
  const uMax = getMax(u);
  const vMin = getMin(v);
  const vMax = getMax(v);

  // compress this later
  const getAbsoluteLon = (lonStart, lonEnd) => {
    return lonStart > lonEnd ? lonEnd + 360 : lonEnd;
  };
  const lo2 = getAbsoluteLon(forecastHeader.lo1, forecastHeader.lo2);
  const width = Math.round((lo2 - forecastHeader.lo1) / forecastHeader.dx + 1);
  const height =
    Math.round((forecastHeader.la2 - forecastHeader.la1) / forecastHeader.dy) +
    1;

  fs.writeFileSync(
    filename + '.json',
    JSON.stringify(
      {
        refTime: forecastHeader.refTime,
        forecastTime: forecastHeader.forecastTime,
        nx: forecastHeader.nx,
        ny: forecastHeader.ny,
        lo1: forecastHeader.lo1,
        la1: forecastHeader.la1,
        lo2: forecastHeader.lo2,
        la2: forecastHeader.la2,
        dx: forecastHeader.dx,
        dy: forecastHeader.dy,
        width: width,
        height: height,
        uMin: uMin,
        uMax: uMax,
        vMin: vMin,
        vMax: vMax,
      },
      null,
      2,
    ) + '\n',
  );

  const png = new PNG({
    width: width,
    height: height,
    colorType: 2,
    filterType: 4,
  });

  console.log(forecastHeader);

  const uLen = u.length;
  const vLen = v.length;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const k = y * width + (width - x);
      const uValue = u[uLen - k];
      const vValue = v[vLen - k];

      if (uValue === 'NaN' || vValue === 'NaN') {
        png.data[i + 0] = 0;
        png.data[i + 1] = 0;
        png.data[i + 2] = 0;
        png.data[i + 3] = 0;
        continue;
      } else {
        // scale values from 0-255 depending on min and max values
        png.data[i + 0] = Math.round(((uValue - uMin) / (uMax - uMin)) * 255);
        png.data[i + 1] = Math.round(((vValue - vMin) / (vMax - vMin)) * 255);
        png.data[i + 2] = 0;
        png.data[i + 3] = 255;
      }
    }
  }

  png.pack().pipe(fs.createWriteStream(filename + '.png'));
};

const convertGrib2Png = async (windFiles, forecastConfigName) => {
  try {
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
      await convertJSON2PNG(forecastUandV);
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

/* eslint-disable no-param-reassign */
/* eslint-disable operator-linebreak */
/* eslint-disable object-curly-newline */
/* eslint-disable implicit-arrow-linebreak */
const util = require('util');
const grib2json = require('grib2json').default;

const getJson = util.promisify(grib2json);

const generateEmptyArray = async (filename) => {
  const arrayBlueprint = await getJson(filename, {
    scriptPath: './src/convert_grib/grib2json/src/bin/grib2json',
    names: true, // (default false): Return descriptive names too
    data: true, // (default false): Return data, not just headers
  })
    .then((json) => {
      let { lo2 } = json[0].header;
      const { lo1, la1, la2, dx, dy } = json[0].header;
      // check if end value for longitute is lower than start value
      lo2 = lo1 > lo2 ? lo2 + 360 : lo2;
      const empty2D = [];
      // generate empty 2d Array
      for (let y = la1; y <= la2; y += dy) {
        const emptylon = [];
        for (let x = lo1; x <= lo2; x += dx) {
          emptylon.push({
            lat: y.toFixed(2),
            lon: x >= 360 ? (x - 360).toFixed(2) : x.toFixed(2),
          });
        }
        empty2D.push(emptylon);
      }
      return empty2D;
    })
    .catch((err) => console.log(err));

  return arrayBlueprint;
};

const populateBlueprint = async (filename, blueprint) => {
  // let dataArrayBuffer = [...blueprint];
  await getJson(filename, {
    scriptPath: './src/convert_grib/grib2json/src/bin/grib2json',
    names: true, // (default false): Return descriptive names too
    data: true, // (default false): Return data, not just headers
  }).then((json) => {
    const regex = /(?<=_)[0-9]+_[0-9]+_[0-9]+_[A-Za-z]+(?=.grib)/;
    const forecastType = filename.match(regex)[0].split('_')[3];
    // convert 1d array to 2d array
    let valuePointer = 0;
    blueprint.forEach((row, indexRow) => {
      row.forEach((point, indexPoint) => {
        if (json[0].data[valuePointer] !== 'NaN') {
          if (blueprint[indexRow][indexPoint][forecastType]) {
            blueprint[indexRow][indexPoint][forecastType].push(
              json[0].data[valuePointer],
            );
          } else {
            blueprint[indexRow][indexPoint][forecastType] = [
              json[0].data[valuePointer],
            ];
          }
        }
        valuePointer += 1;
      });
    });
  });
};

const convertGrib = async (filenames, path) => {
  try {
    const dataArray = await generateEmptyArray(`${path}/${filenames[0]}`);
    // eslint-disable-next-line no-restricted-syntax
    for (const filename of filenames) {
      // eslint-disable-next-line no-await-in-loop
      await populateBlueprint(`${path}/${filename}`, dataArray);
    }
    return dataArray;
  } catch (err) {
    console.log(err);
  }
};
module.exports = {
  convertGrib,
};

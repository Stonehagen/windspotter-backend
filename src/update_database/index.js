const fs = require('fs');
require('dotenv/config');
const { dataValues } = require('../config');
const { downloadGribFiles } = require('../ftp');
const { decompressFiles } = require('../extract');
const { convertGrib } = require('../convert_grib');

let files = fs.readdirSync('./grib_data/21');
files = files.filter((file) => file.slice(0, 1) !== '.');
const regex = /(?<=_[0-9]+_[0-9]+_[0-9]+_)[A-Za-z]+(?=.grib)/;

const updateDatabase = async (server, dict) => {
  // await downloadGribFiles(server, dict);

  // await decompressFiles(files, './grib_data/21/');
  // eslint-disable-next-line no-restricted-syntax
  for (const value of dataValues) {
    const sortetFiles = files.filter((file) => {
      const forecastType = file.match(regex)[0];
      return forecastType === value;
    });
    // eslint-disable-next-line no-await-in-loop
    const sortedData = await convertGrib(sortetFiles, './grib_data/21');
    console.log(`update MongoDB ${sortedData}`);
  }
};

module.exports = {
  updateDatabase,
};

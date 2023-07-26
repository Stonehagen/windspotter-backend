/* eslint-disable operator-linebreak */
/* eslint-disable no-await-in-loop */
/* eslint-disable no-restricted-syntax */
const fs = require('fs');
const ftp = require('basic-ftp');
const decompress = require('decompress');
const decompressBzip2 = require('decompress-bzip2');

const { dataValues, fCModel, fCHeight } = require('../config');

const getNextForecastTime = (forecastTimes) => {
  // convert Strings into Numbers
  const forecastTimesNumbers = forecastTimes.map((hour) => parseInt(hour, 10));
  // get the hour of the current time
  const hourNow = new Date().getUTCHours();
  // get the latest forcastTime to hour current time
  const nextForecastTime = Math.max(
    ...forecastTimesNumbers.filter((hour) => hour <= hourNow),
  );
  // return the number as string with leading zeros
  return String(nextForecastTime).padStart(2, '0');
};

const getFileTimestamps = (files) => {
  const dateNow = new Date();
  return files.map((file) => {
    // split the date Sting and create a timestamp from it
    const modDateArr = file.rawModifiedAt.split(' ');
    const timestamp = new Date(
      `${modDateArr[0]} ${modDateArr[1]}, ${dateNow.getFullYear()} ${
        modDateArr[2]
      }+00:00`,
    );
    // Jan 01 cornercase
    if (timestamp > dateNow) {
      timestamp.setFullYear(timestamp.getFullYear() - 1);
    }
    return timestamp;
  });
};

const decompressFile = async (file, path) => {
  const regex = /.*(?=.bz2)/;
  await decompress(`${path}/${file}`, './', {
    plugins: [
      decompressBzip2({
        path: `${path}/${file.match(regex)[0]}`,
      }),
    ],
  });
  await fs.unlinkSync(`${path}/${file}`);
  fs.chmodSync(`${path}/${file.match(regex)[0]}`, 0o755);
};

const getServerTimestamp = (fileList) => {
  // reduce array to only get the required values
  const sortedFiles = fileList.filter((file) => dataValues.includes(file.name));
  const fileTimestamps = getFileTimestamps(sortedFiles);
  // return latest Timestamp from folder
  return new Date(Math.max(...fileTimestamps));
};

const downloadFiles = async (databaseTimestamp = new Date(0)) => {
  const server = 'opendata.dwd.de';
  const dict = 'weather/nwp/icon-d2/grib';
  const client = new ftp.Client();

  try {
    await client.access({
      host: server,
    });
    // get a list of folders from the given ftp path
    const dirList = await client.list(dict);
    // convert list of folders to list of folderNames (forecastTimes)
    const forecastTimes = dirList.map((folderInfo) => folderInfo.name);
    // get the latest forecast folder name
    const nextForecastTime = getNextForecastTime(forecastTimes);
    await client.cd(`${dict}/${nextForecastTime}`);
    const fileList = await client.list();
    // get the last update time from the requested files
    const serverTimestamp = getServerTimestamp(fileList);
    // check if the files are older than the data in our database
    if (
      serverTimestamp.get < databaseTimestamp ||
      serverTimestamp - new Date() < 5 * 60 * 1000
    ) {
      console.log('database is up to date');
      client.close();
      return null;
    }

    // create a list of the files und download them
    for (const value of dataValues) {
      let clientList = await client.list(`./${value}`);
      // filter out the unwanted files
      clientList = clientList
        .map((file) => file.name)
        .filter((name) => name.includes(fCModel) && name.includes(fCHeight));
      // download file per file
      for (const file of clientList) {
        await client.downloadTo(`./grib_data/${file}`, `./${value}/${file}`);
        await decompressFile(file, './grib_data/');
      }
    }
    console.log('download complete');
    client.close();
    return nextForecastTime;
  } catch (err) {
    console.log(err);
    return false;
  }
};

module.exports = {
  downloadFiles,
};

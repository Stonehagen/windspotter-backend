const fs = require('fs');
const ftp = require('basic-ftp');
const decompress = require('decompress');
const decompressBzip2 = require('decompress-bzip2');

const config = require('../config');

const getNextForecastTimeHour = (forecastTimes) => {
  // convert Strings into Numbers
  const forecastTimesNumbers = forecastTimes.map((hour) => parseInt(hour, 10));
  // get the hour of the current time
  const hourNow = new Date().getUTCHours();
  // get the latest forcastTime to hour current time
  const nextForecastTimeHour = Math.max(
    ...forecastTimesNumbers.filter((hour) => hour <= hourNow),
  );
  // return the number as string with leading zeros
  return String(nextForecastTimeHour).padStart(2, '0');
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

const decompressFile = async (file) => {
  const regex = /.*(?=.bz2)/;
  await decompress(`./grib_data/${file}`, './', {
    plugins: [
      decompressBzip2({
        path: `./grib_data/${file.match(regex)[0]}`,
      }),
    ],
  });
  await fs.unlinkSync(`./grib_data/${file}`);
  fs.chmodSync(`./grib_data/${file.match(regex)[0]}`, 0o755);
};

const getServerTimestamp = (fileList) => {
  // reduce array to only get the required values
  const sortedFiles = fileList.filter((file) => dataValues.includes(file.name));
  const fileTimestamps = getFileTimestamps(sortedFiles);
  // return latest Timestamp from folder
  return new Date(Math.max(...fileTimestamps));
};

const downloadFiles = async (databaseTimestamp, forecastConfigName) => {
  const server = config[forecastConfigName].server;
  const dict = config[forecastConfigName].dict;
  const dataValues = config[forecastConfigName].dataValues;
  const fCModel = config[forecastConfigName].fCModel;
  const fCHeight = config[forecastConfigName].fCHeight;
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
    let nextForecastTimeHour = getNextForecastTimeHour(forecastTimes);
    const fileList = await client.list(`${dict}/${nextForecastTimeHour}`);
    // get the last update time from the requested files
    const serverTimestamp = getServerTimestamp(fileList);
    // check if the files are older than the data in our database
    if (
      serverTimestamp < databaseTimestamp ||
      new Date() - serverTimestamp < 5 * 60 * 1000
    ) {
      // get one forecast time before
      const forecastTimesBefore = forecastTimes.filter(
        (time) => time < nextForecastTimeHour,
      );
      // check for day shift
      let prevForecastTimeHour =
        forecastTimesBefore.length !== 0
          ? getNextForecastTimeHour(forecastTimesBefore)
          : forecastTimes[forecastTimes.length - 1];

      const nexForecasstFileList = await client.list(
        `${dict}/${prevForecastTimeHour}`,
      );
      // get the last update time from the requested files
      const nextServerTimestamp = getServerTimestamp(nexForecasstFileList);
      // check if the files are older than the data in our database
      if (
        nextServerTimestamp < databaseTimestamp ||
        (databaseTimestamp.getUTCHours() == prevForecastTimeHour &&
          databaseTimestamp.getUTCDate() == nextServerTimestamp.getUTCDate())
      ) {
        console.log('database is up to date');
        client.close();
        return null;
      }
      await client.cd(`${dict}/${prevForecastTimeHour}`);
      nextForecastTimeHour = prevForecastTimeHour;
    } else {
      await client.cd(`${dict}/${nextForecastTimeHour}`);
    }
    // create a list of the files und download them
    for (const value of dataValues) {
      let clientList = await client.list(`./${value}`);
      // filter out the unwanted files
      clientList = clientList
        .map((file) => file.name)
        .filter((name) => name.includes(fCModel) && name.includes(fCHeight));
      //check for actual data
      const latestModiefedAtDate = Math.max(
        ...clientList.map((file) => {
          const tenDigitsRegex = /(?<!\d)\d{10}(?!\d)/;
          return file.match(tenDigitsRegex)[0];
        }),
      );
      //filter out old files
      clientList = clientList.filter((file) =>
        file.includes(latestModiefedAtDate),
      );

      // download file per file
      for (const file of clientList) {
        await client.downloadTo(`./grib_data/${file}`, `./${value}/${file}`);
        await decompressFile(file);
      }
    }
    client.close();
    //convert nextForecastTimeHour to Date
    return nextForecastTimeHour;
  } catch (err) {
    console.log(err);
    return false;
  }
};

module.exports = {
  downloadFiles,
};

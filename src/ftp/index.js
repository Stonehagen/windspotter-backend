/* eslint-disable operator-linebreak */
const ftp = require('basic-ftp');
const { dataValues, fCModel, fCHeight } = require('../config');

const serverDataTimeDelay = 5 * 60 * 1000;

const getNextForecastTime = (lastForecastTime, updateTimes) => {
  const lastHour = lastForecastTime.getHours();
  const lastTimeIndex = updateTimes.indexOf(lastHour.toString());
  const newTimeIndex = (lastTimeIndex + 1) % updateTimes.length;
  return updateTimes[newTimeIndex];
};

const getServerTimestamp = (fileList, dateNow) => {
  // reduce array to only get the important values
  // eslint-disable-next-line arrow-body-style
  const sortedFiles = fileList.filter((file) => {
    return dataValues.includes(file.name);
  });

  const fileTimestamps = sortedFiles.map((file) => {
    const modDateArr = file.rawModifiedAt.split(' ');
    const timestamp = new Date(
      `${modDateArr[0]} ${modDateArr[1]}, ${dateNow.getFullYear()} ${
        modDateArr[2]
      }+02:00`,
    );
    // Jan 01 cornercase
    if (timestamp > dateNow) {
      timestamp.setFullYear(timestamp.getFullYear() - 1);
    }
    return timestamp;
  });
  // return latest Timestamp from folder
  return new Date(Math.max.apply(null, fileTimestamps));
};

const downloadFiles = async (server, dict, lastForecastTime) => {
  const dateNow = new Date();

  const client = new ftp.Client();
  // enable logging to the console
  client.ftp.verbose = false;

  let nextForecastTime;

  try {
    await client.access({
      host: server,
    });
    let fileList = await client.list(dict);
    const forecastTimes = fileList.map((fileInfo) => fileInfo.name);
    nextForecastTime = getNextForecastTime(lastForecastTime, forecastTimes);
    await client.cd(`${dict}/${nextForecastTime}`);
    fileList = await client.list();
    const serverTimestamp = getServerTimestamp(fileList, dateNow);

    // check if new data is available
    if (
      serverTimestamp > lastForecastTime &&
      serverTimestamp - dateNow < serverDataTimeDelay
    ) {
      // eslint-disable-next-line no-restricted-syntax
      for (const value of dataValues) {
        // eslint-disable-next-line no-await-in-loop
        fileList = await client.list(`./${value}`);
        fileList = fileList
          .map((file) => file.name)
          .filter((name) => name.includes(fCModel) && name.includes(fCHeight));
        // eslint-disable-next-line no-restricted-syntax
        for (const file of fileList) {
          // eslint-disable-next-line no-await-in-loop
          await client.downloadTo(
            `./grib_data/${nextForecastTime}/${file}`,
            `./${value}/${file}`,
          );
        }
      }
    } else {
      console.log('database is up to date');
      return false;
    }
  } catch (err) {
    console.log(err);
    return false;
  }
  client.close();
  console.log('new files has been downloaded');
  return { nextForecastTime };
};

module.exports = {
  downloadFiles,
};

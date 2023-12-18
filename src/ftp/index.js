const fs = require('fs');
const ftp = require('basic-ftp');
const {
  S3Client,
  GetObjectCommand,
  ListObjectsCommand,
} = require('@aws-sdk/client-s3');
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

const decompressFile = async (file, forecastConfigName) => {
  const regex = /.*(?=.bz2)/;
  await decompress(`./grib_data_${forecastConfigName}/${file}`, './', {
    plugins: [
      decompressBzip2({
        path: `./grib_data_${forecastConfigName}/${file.match(regex)[0]}`,
      }),
    ],
  });
  await fs.unlinkSync(`./grib_data_${forecastConfigName}/${file}`);
  fs.chmodSync(
    `./grib_data_${forecastConfigName}/${file.match(regex)[0]}`,
    0o755,
  );
};

const getYearMonthDay = (nDays) => {
  // get the current date and set the time to 00:00:00:00 and subtract an amount of days
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  date.setDate(date.getDate() - nDays);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return { year, month, day };
};

const getLatestHourPrefix = async (client, forecastConfigName, prefix) => {
  const command = new ListObjectsCommand({
    Bucket: config[forecastConfigName].bucket,
    Delimiter: '/',
    Prefix: `${prefix}/`,
    MaxKeys: 1000,
  });
  const hourprefixes = (await client.send(command)).CommonPrefixes;
  if (!hourprefixes) return null;
  const times = hourprefixes.map(
    (prefix) => +prefix.Prefix.match(/(?<=gfs\.[0-9]{8}\/)[0-9]{2}(?=\/)/)[0],
  );
  if (times.length === 0) return null;
  const latestHourPrefix = Math.max(...times)
    .toString()
    .padStart(2, '0');
  return {
    hourPrefix: `${prefix}/${latestHourPrefix}`,
    hours: latestHourPrefix,
  };
};

const getLatestPrefix = async (client, forecastConfigName) => {
  // try to get the latest prefix if not try one day before after 5 days reutnr null
  for (let i = 0; i < 5; i++) {
    const { year, month, day } = getYearMonthDay(i);
    const prefix = `gfs.${year}${month}${day}`;
    const command = new ListObjectsCommand({
      Bucket: config[forecastConfigName].bucket,
      Delimiter: '/',
      Prefix: prefix,
      MaxKeys: 1000,
    });
    const prefixes = (await client.send(command)).CommonPrefixes;
    if (prefixes) {
      //here we check if hours are available and if not we try the next day
      const { hourPrefix, hours } = await getLatestHourPrefix(
        client,
        forecastConfigName,
        prefix,
      );
      if (hourPrefix) {
        const { yearB, monthB, dayB } = getYearMonthDay(i - 1);
        const datebeforePrefix = `gfs.${yearB}${monthB}${dayB}`;
        const hourPrefixBefore = hourPrefix.replace(prefix, datebeforePrefix);
        return { hourPrefix, hours, hourPrefixBefore };
      }
    }
  }
  return null;
};

const getAWSForecastKeys = async (
  client,
  forecastConfigName,
  prefix,
  hours,
) => {
  const filesnamePrefix = `gfs.t${hours}z.pgrb2.0p25.f`;
  const command = new ListObjectsCommand({
    Bucket: config[forecastConfigName].bucket,
    Prefix: `${prefix}${filesnamePrefix}`,
    MaxKeys: 1000,
  });
  const files = await client.send(command);

  // check if files are available
  if (!files.Contents) return null;

  // filter out the index files
  const filesList = files.Contents.map((file) => file.Key).filter(
    (file) => !file.includes('.idx'),
  );

  // check if all files are available
  if (filesList.length < 205) return null;
  return filesList;
};

const downloadFilesGfsAWS = async (databaseTimestamp, forecastConfigName) => {
  const client = new S3Client({
    region: 'us-east-1',
    signer: {
      sign: async (request) => request,
    },
  });
  const { hourPrefix, hours, hourPrefixBefore } = await getLatestPrefix(
    client,
    forecastConfigName,
  );
  let forecastHour = hours;
  let endPrefix = `${hourPrefix}/atmos/`;
  let files = await getAWSForecastKeys(
    client,
    forecastConfigName,
    endPrefix,
    hours,
  );
  if (files === null) {
    if (hours != '00') {
      const newhour = (+hours - 6).toString().padStart(2, '0');
      const newPrefix = hourPrefix.replace(hours, newhour);
      endPrefix = `${newPrefix}/atmos/`;
      files = await getAWSForecastKeys(
        client,
        forecastConfigName,
        endPrefix,
        newhour,
      );
      forecastHour = newhour;
    } else {
      const newhour = '18';
      const newPrefix = hourPrefixBefore.replace(hours, newhour);
      endPrefix = `${newPrefix}/atmos/`;
      files = await getAWSForecastKeys(
        client,
        forecastConfigName,
        endPrefix,
        newhour,
      );
      forecastHour = newhour;
    }
  }
  if (files === null) return null;
  forecastHour = '06';
  const forecastDate = hourPrefix.match(/(?<=gfs\.)[0-9]{8}/)[0];
  // get timestamp from forecastDate and hour
  const dateSting = `${forecastDate.slice(0, 4)}-${forecastDate.slice(
    4,
    6,
  )}-${forecastDate.slice(6, 8)}T`;
  const forecastTimestamp = new Date(`${dateSting}${forecastHour}:00:00.000Z`);

  //check if timestemp is newer than databaseTimestamp
  console.log(databaseTimestamp);
  console.log(forecastTimestamp);
  if (
    forecastTimestamp < databaseTimestamp ||
    (databaseTimestamp.getUTCHours() == forecastHour &&
      databaseTimestamp.getUTCDate() == forecastTimestamp.getUTCDate())
  ) {
    console.log('database is up to date');
    return null;
  }

  // download the files in bundles of 5 files parralel and log the progress to the console
  const filesList = [];
  for (let i = 0; i < files.length; i += 5) {
    filesList.push(files.slice(i, i + 5));
  }
  const date = hourPrefix.match(/(?<=gfs\.)[0-9]{8}/)[0];
  for (const files of filesList) {
    const downloadPromises = [];
    for (let i = 0; i < files.length; i += 5) {
      const filesBundle = files.slice(i, i + 5);
      const downloadPromise = Promise.all(
        filesBundle.map((file) => {
          const command = new GetObjectCommand({
            Bucket: config[forecastConfigName].bucket,
            Key: file,
          });
          const filename = file.split('/').pop();
          return client.send(command).then((data) => {
            return fs.promises.writeFile(
              `./grib_data_${forecastConfigName}/${date}_${filename}.grb2`,
              data.Body,
            );
          });
        }),
      );
      downloadPromises.push(downloadPromise);
    }
    await Promise.all(downloadPromises);
  }

  return hours;
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
        await client.downloadTo(
          `./grib_data_${forecastConfigName}/${file}`,
          `./${value}/${file}`,
        );
        await decompressFile(file, forecastConfigName);
      }
    }
    client.close();
    return nextForecastTimeHour;
  } catch (err) {
    console.log(err);
    return false;
  }
};

module.exports = {
  downloadFiles,
  downloadFilesGfsAWS,
};

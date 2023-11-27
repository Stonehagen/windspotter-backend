const fs = require('fs');
const ftp = require('basic-ftp');
const https = require('https');
const { JSDOM } = require('jsdom');
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

const getServerTimestamp = (fileList) => {
  // reduce array to only get the required values
  const sortedFiles = fileList.filter((file) => dataValues.includes(file.name));
  const fileTimestamps = getFileTimestamps(sortedFiles);
  // return latest Timestamp from folder
  return new Date(Math.max(...fileTimestamps));
};

const getDom = async (server) => {
  return new Promise((resolve, reject) => {
    https.get(server, (res) => {
      const chunks = [];
      res.on('data', (chunk) => {
        chunks.push(chunk);
      });
      res.on('end', async () => {
        const dom = new JSDOM(Buffer.concat(chunks).toString());
        resolve(dom);
      });
    });
  });
};

const getLinkList = async (server) => {
  const dom = await getDom(server);
  const folderList = dom.window.document.querySelectorAll('a');
  const folderNames = [];
  for (const folder of folderList) {
    folderNames.push(folder.textContent);
  }
  return folderNames;
};

const getGrb2Files = (filesList) =>
  filesList
    .filter((filename) => filename.match(/^gfs/))
    .filter((filename) => !filename.match(/\.inv$/));

const getGfsRefTimes = (files, regex) => {
  const refTimes = [
    ...new Set(
      files.map((file) => {
        const match = file.match(regex);
        return match[0];
      }),
    ),
  ];
  return refTimes;
};

const getListOfGfsFiles = async (databaseTimestamp, server, regexRefTime) => {
  try {
    // get a list of folders from the given ftp path
    const monthLinkList = await getLinkList(server);
    // filter out the unwanted folders and convert them to numbers qnd sort them
    const monthList = monthLinkList
      .filter((month) => month.match(/^[0-9]{6}/))
      .map((month) => parseInt(month, 10))
      .sort((a, b) => a - b);
    // get the latest forecast folder name
    const nextForecastMonth = monthList[monthList.length - 1];

    // get a list of folders from the given ftp path
    const dayLinkList = await getLinkList(`${server}${nextForecastMonth}/`);
    // filter out the unwanted folders and convert them to numbers and sort them
    const dayList = dayLinkList
      .filter((day) => day.match(/^[0-9]{8}/))
      .map((month) => parseInt(month, 10))
      .sort((a, b) => a - b);
    // get the latest forecast folder name
    const nextForecastDay = dayList[dayList.length - 1];

    // get a list of folders from the given ftp path
    const filesList = await getLinkList(
      `${server}${nextForecastMonth}/${nextForecastDay}/`,
    );
    // filter out the unwanted folders
    const files = getGrb2Files(filesList);

    // get the different refTimes from the files
    const refTimes = getGfsRefTimes(files, regexRefTime);

    // sort the files by refTime
    const sortedFiles = refTimes.map((refTime) => {
      const refTimeFiles = files.filter((file) => file.includes(refTime));
      const count = refTimeFiles.length;
      return {
        refTime,
        files: refTimeFiles,
        count,
      };
    });

    //check if there is more than one refTime ->
    // if not get more refTimes from the day before
    if (refTimes.length === 1) {
      if (dayList.length > 1) {
        const prevForecastDay = dayList[dayList.length - 2];
        // get a list of folders from the given ftp path
        const filesList = await getLinkList(
          `${server}${nextForecastMonth}/${prevForecastDay}/`,
        );
        // filter out the unwanted folders
        const files = getGrb2Files(filesList);

        // get the different refTimes from the files
        const refTimesPrev = getGfsRefTimes(files, regexRefTime);

        // get the highest refTime from the day before
        const refTimePrev = Math.max(
          ...refTimesPrev.map((refTime) => parseInt(refTime, 10)),
        );

        // get the files from the last RefTime of the day before
        const refTimePrevFiles = files.filter((file) =>
          file.includes(refTimePrev),
        );

        // add the files from the day before to the sortedFiles
        sortedFiles.unshift({
          refTime: refTimePrev,
          files: refTimePrevFiles,
          count: refTimePrevFiles.length,
        });
      } else {
        // get a list of folders from the given ftp path
        const monthLinkList = await getLinkList(server);
        // filter out the unwanted folders and convert them to numbers qnd sort them
        const monthList = monthLinkList
          .filter((month) => month.match(/^[0-9]{6}/))
          .map((month) => parseInt(month, 10))
          .sort((a, b) => a - b);
        // get the latest forecast folder name
        const prevForecastMonth = monthList[monthList.length - 2];

        // get a list of folders from the given ftp path
        const dayLinkList = await getLinkList(`${server}${prevForecastMonth}/`);
        // filter out the unwanted folders and convert them to numbers and sort them
        const dayList = dayLinkList
          .filter((day) => day.match(/^[0-9]{8}/))
          .map((month) => parseInt(month, 10))
          .sort((a, b) => a - b);
        // get the latest forecast folder name
        const prevForecastDay = dayList[dayList.length - 1];

        // get a list of folders from the given ftp path
        const filesList = await getLinkList(
          `${server}${prevForecastMonth}/${prevForecastDay}/`,
        );
        // filter out the unwanted folders
        const files = getGrb2Files(filesList);

        // get the different refTimes from the files
        const refTimesPrev = getGfsRefTimes(files, regexRefTime);

        // get the highest refTime from the day before
        const refTimePrev = Math.max(
          ...refTimesPrev.map((refTime) => parseInt(refTime, 10)),
        );

        // get the files from the last RefTime of the day before
        const refTimePrevFiles = files.filter((file) =>
          file.includes(refTimePrev),
        );

        // add the files from the day before to the sortedFiles
        sortedFiles.unshift({
          refTime: refTimePrev,
          files: refTimePrevFiles,
          count: refTimePrevFiles.length,
        });
      }
    }

    // get the forecastTime with the highest count
    const latestRefTime = sortedFiles.reduce((prev, current) =>
      prev.count > current.count ? prev : current,
    );

    // generate the list of urls
    const urlList = latestRefTime.files.map(
      (file) => `${server}${nextForecastMonth}/${nextForecastDay}/${file}`,
    );

    // get a timestamp from the latest RefTime
    const dateRegex = /(?<=gfs_[0-9]_)[0-9]+(?=_[0-9]+_[0-9]+\.grb2)/;
    const dateArray = [...latestRefTime.files[0].match(dateRegex)[0]];
    const year = dateArray.slice(0, 4).join('');
    const month = dateArray.slice(4, 6).join('');
    const day = dateArray.slice(6, 8).join('');
    const hour = latestRefTime.refTime.slice(0, 2);
    const timestamp = new Date(`${year}-${month}-${day}T${hour}:00:00Z`);

    // check if the files are older than the data in our database
    if (timestamp <= databaseTimestamp) {
      console.log('database is up to date');
      return null;
    }

    return urlList;
  } catch (err) {
    console.log(err);
    return false;
  }
};

const downloadFilesGFS = async (databaseTimestamp, forecastConfigName) => {
  const server = config[forecastConfigName].server;
  const regexRefTime = config[forecastConfigName].regexRefTimeValue;

  //get the most recent GFS forecast from the server
  const latestGfsFiles = await getListOfGfsFiles(
    databaseTimestamp,
    server,
    regexRefTime,
  );

  if (!latestGfsFiles) {
    return null;
  }

  //download files at the same time
  const promises = latestGfsFiles.map((file) => {
    return new Promise((resolve, reject) => {
      const fileName = file.split('/').pop();
      const fileStream = fs.createWriteStream(
        `./grib_data_${forecastConfigName}/${fileName}`,
      );
      https.get(file, (response) => {
        response.pipe(fileStream);
        fileStream.on('finish', () => {
          fileStream.close(resolve(true));
        });
      });
    });
  });
  await Promise.all(promises);

  return true;
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
  downloadFilesGFS,
};

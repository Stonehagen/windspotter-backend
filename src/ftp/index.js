const ftp = require('basic-ftp');

const dataValues = ['t', 'v', 'u'];
const serverDataTimeDelay = 5 * 60 * 1000;

const getNextTime = (lastTime, timeArray) => {
  const lastTimeIndex = timeArray.indexOf(lastTime.toString());
  const newTimeIndex = (lastTimeIndex + 1) % timeArray.length;
  return timeArray[newTimeIndex];
};

const getLatestUploadDate = (dirList, today) => {
  // reduce array to only get the important values
  // eslint-disable-next-line arrow-body-style
  const dirArray = dirList.filter((fileInfo) => {
    return dataValues.includes(fileInfo.name);
  });

  const modifiedTimes = dirArray.map((fileInfo) => {
    const modDate = fileInfo.rawModifiedAt.split(' ');
    const d = new Date(
      `${modDate[0]} ${modDate[1]}, ${today.getFullYear()} ${modDate[2]}+02:00`,
    );
    // Jan 01 cornercase
    if (d > today) {
      d.setFullYear(d.getFullYear() - 1);
    }
    return d;
  });

  return new Date(Math.max.apply(null, modifiedTimes));
};

const downloadGribFiles = async (server, dict, databaseTimestamp) => {
  let status;
  let data;
  const lastHour = databaseTimestamp.getHours();
  const dateNow = new Date();
  const client = new ftp.Client();

  // enable logging to the console
  client.ftp.verbose = true;

  try {
    await client.access({
      host: server,
    });
    let dirList = await client.list(dict);
    const updateTimes = dirList.map((fileInfo) => fileInfo.name);
    const nextUpdate = getNextTime(lastHour, updateTimes);
    await client.cd(`${dict}/${nextUpdate}`);
    dirList = await client.list();
    const serverTimestamp = getLatestUploadDate(dirList, dateNow);

    // check if new data is available
    if (serverTimestamp > databaseTimestamp) {
      if (serverTimestamp - dateNow < serverDataTimeDelay) {
        status = 'new';
        console.log('database shall be updated');
      } else {
        status = 'uploading';
        console.log('database is up to date');
      }
    } else {
      status = 'old';
      console.log('database is up to date');
    }
  } catch (err) {
    console.log(err);
  }
  client.close();
  return { status, data };
};

module.exports = {
  downloadGribFiles,
};

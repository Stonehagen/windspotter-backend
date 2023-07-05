// url for the grib forecast files
// https://opendata.dwd.de/weather/nwp/icon-d2/grib

const ftp = require('basic-ftp');

const downloadGribFiles = async () => {
  const client = new ftp.Client();

  // enable logging to the console
  client.ftp.verbose = true;

  try {
    await client.access({
      host: 'opendata.dwd.de',
    });
    await client.cd('weather/nwp/icon-d2/grib');
    console.log(await client.list());
  } catch (err) {
    console.log(err);
  }
  client.close();
};

module.exports = {
  downloadGribFiles,
};

require('dotenv/config');

const ftp = require('basic-ftp');

const downloadGribFiles = async (lastUpdate) => {
  const client = new ftp.Client();

  // enable logging to the console
  client.ftp.verbose = true;

  try {
    await client.access({
      host: process.env.GRIB_SERVER,
    });
    await client.cd(process.env.GRIB_DICT);
    console.log(await client.list());
  } catch (err) {
    console.log(err);
  }
  client.close();
};

module.exports = {
  downloadGribFiles,
};

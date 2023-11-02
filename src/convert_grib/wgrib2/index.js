const shell = require('shelljs');
const fs = require('fs');
const dotenv = require('dotenv');
dotenv.config({ path: __dirname + '/../.env' });

const wgrib2 = process.env.WGRIB2_PATH;

const convertWGrib2ToNetcdf = async (filenames, forecastConfigName) => {
  try {
    for (const filename of filenames) {
      const pathGribFile = `./grib_data_${forecastConfigName}/${filename}`;
      const pathNetcdfFile = pathGribFile.replace('.grib2', '.nc');

      if (
        shell.exec(`${wgrib2} ${pathGribFile} -netcdf ${pathNetcdfFile}`)
          .code !== 0
      ) {
        shell.echo('Error: wgrib2 failed');
        shell.exit(1);
      }
      await fs.unlinkSync(`./grib_data_${forecastConfigName}/${filename}`);
    }
  } catch (err) {
    console.log(err);
    return false;
  }
  return true;
};

module.exports = {
  convertWGrib2ToNetcdf,
};

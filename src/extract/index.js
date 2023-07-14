const decompress = require('decompress');
const decompressBzip2 = require('decompress-bzip2');
const fs = require('fs');

const decompressFiles = async (files, path) => {
  // eslint-disable-next-line no-restricted-syntax
  for (const file of files) {
    const regex = /.*(?=.bz2)/;
    // eslint-disable-next-line no-await-in-loop
    await decompress(`${path}/${file}`, './', {
      plugins: [
        decompressBzip2({
          path: `${path}/${file.match(regex)[0]}`,
        }),
      ],
    });
    // eslint-disable-next-line no-await-in-loop
    await fs.unlinkSync(`${path}/${file}`);
    fs.chmodSync(`${path}/${file.match(regex)[0]}`, 0o755);
  }
  // eslint-disable-next-line no-console
  console.log('Files extract');
};

module.exports = {
  decompressFiles,
};

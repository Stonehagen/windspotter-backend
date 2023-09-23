const cwam = {
  forecastName: 'cwam',
  dataValues: ['swh', 'mwd', 'tm10'],
  fCModel: '_',
  fCHeight: '_',
  serverDataTimeDelay: 5 * 60 * 1000,
  server: 'opendata.dwd.de',
  dict: 'weather/maritime/wave_models/cwam/grib',
  regexNameValue: /(?<=CWAM_).+(?=_[0-9]+_[0-9]+.grib)/,
};

module.exports = {
  cwam,
};

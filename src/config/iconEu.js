const iconEu = {
  forecastName: 'icon-eu',
  dataValues: ['t_2m', 'v_10m', 'u_10m', 'vmax_10m', 'clct_mod', 'rain_con'],
  fCModel: 'regular-lat-lon_',
  fCHeight: '_single-level_',
  serverDataTimeDelay: 5 * 60 * 1000,
  server: 'opendata.dwd.de',
  dict: 'weather/nwp/icon-eu/grib',
  regexNameValue: /(?<=_[0-9]+_[0-9]+_).+(?=\.grib)/,
};

module.exports = {
  iconEu,
};

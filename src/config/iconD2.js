const iconD2 = {
  forecastName: 'icon-d2',
  //dataValues: ['t_2m', 'v_10m', 'u_10m', 'vmax_10m', 'clct_mod', 'rain_gsp'],
  dataValues: ['v_10m', 'u_10m'],
  fCModel: 'regular-lat-lon_',
  fCHeight: '_2d_',
  serverDataTimeDelay: 5 * 60 * 1000,
  server: 'opendata.dwd.de',
  dict: 'weather/nwp/icon-d2/grib',
  regexNameValue: /(?<=_[0-9]+_[0-9]+_[a-zA-Z0-9]+_).+(?=\.grib)/,
  regexTimeValue: /(?<=_[0-9]+_)[0-9]+(?=_[a-zA-Z0-9]+_.+grib)/,
};

module.exports = {
  iconD2,
};

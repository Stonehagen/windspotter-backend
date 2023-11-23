const gfs = {
  forecastName: 'gfs',
  // check values dataValues: ['t_2m', 'v_10m', 'u_10m', 'vmax_10m', 'clct_mod', 'rain_gsp'],
  // check name fCModel: 'regular-lat-lon_',
  // check height fCHeight: '_2d_',
  serverDataTimeDelay: 5 * 60 * 1000,
  server: 'https://www.ncei.noaa.gov/',
  dict: 'data/global-forecast-system/access/grid-004-0.5-degree/forecast/',
  // set the regext for the name regexNameValue: /(?<=_[0-9]+_[0-9]+_[a-zA-Z0-9]+_).+(?=\.grib)/,
  // set regex for the time regexTimeValue: /(?<=_[0-9]+_)[0-9]+(?=_[a-zA-Z0-9]+_.+grib)/,
}

module.exports = {
  gfs
};
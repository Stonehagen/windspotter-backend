const gfs = {
  forecastName: 'gfs',
  dataValues: ['t_2m', 'v_10m', 'u_10m', 'vmax_10m', 'clct_mod', 'rain_gsp'],
  serverDataTimeDelay: 5 * 60 * 1000,
  server: 'https://www.ncei.noaa.gov',
  dict: 'data/global-forecast-system/access/grid-004-0.5-degree/forecast/',
  regexRefTimeValue: /(?<=[a-zA-Z0-9]_[0-9]_[0-9]+_)[0-9]+(?=_[0-9]+\.grib)/,
}

module.exports = {
  gfs
};
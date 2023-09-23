const icon = {
  forecastName: 'icon-eu',
  dataValues: ['t_2m', 'v_10m', 'u_10m', 'vmax_10m', 'clct_mod', 'prr_gsp'],
  fCModel: 'regular-lat-lon_',
  fCHeight: '_2d_',
  serverDataTimeDelay: 5 * 60 * 1000,
  server: 'opendata.dwd.de',
  dict: 'weather/nwp/icon-d2/grib',
}

module.exports = {
  icon
};

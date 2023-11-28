const gfs = {
  forecastName: 'gfs',
  dataValues: [
    ':TMP:2 m above',
    ':VGRD:10 m above',
    ':UGRD:10 m above',
    ':TCDC:entire',
    ':PRES:surface',
    ':CRAIN:surface',
  ],
  serverDataTimeDelay: 5 * 60 * 1000,
  server:
    'https://ncei.noaa.gov/data/global-forecast-system/access/grid-004-0.5-degree/forecast/',
  regexRefTimeValue: /(?<=gfs_[0-9]_[0-9]+_)[0-9]+(?=_[0-9]+\.grb2)/,
  regexRefTimeDateNc: /(?<=gfs_[0-9]_)[0-9]+(?=_[0-9]+_[0-9]+_[a-zA-Z0-9]+\.nc)/,
  regexRefTimeHoursNc: /(?<=gfs_[0-9]_[0-9]+_)[0-9]+(?=_[0-9]+_[a-zA-Z0-9]+\.nc)/,
  regexRefTimeMinutesNc: /(?<=gfs_[0-9]_[0-9]+_[0-9]+_)[0-9]+(?=_[a-zA-Z0-9]+\.nc)/,
  regexNameValue: /(?<=gfs_[0-9]_[0-9]+_[0-9]+_[0-9]+_).+(?=\.nc)/,
};

module.exports = {
  gfs,
};

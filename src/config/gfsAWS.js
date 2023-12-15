const gfsAWS = {
  forecastName: 'gfsAWS',
  dataValues: [
    ':TMP:2 m above',
    ':VGRD:10 m above',
    ':UGRD:10 m above',
    ':GUST:surface',
    ':TCDC:entire',
    ':PRES:surface',
    ':APCP:surface',
  ],
  serverDataTimeDelay: 5 * 60 * 1000,
  bucket: 'noaa-gfs-bdp-pds',
  regexRefTimeValue: /(?<=gfs\.t)[0-9]{2}(?=z\.pgrb2\.0p25\.f[0-9]{3}\.grb2)/,
  regexRefTimeDateNc:
    /[0-9]+(?=_gfs\.t[0-9]{2}z\.pgrb2\.0p25\.f[0-9]{3}_[a-zA-Z0-9]+\.nc)/,
  regexRefTimeHoursNc:
    /(?<=[0-9]+_gfs\.t)[0-9]{2}(?=z\.pgrb2\.0p25\.f[0-9]{3}_[a-zA-Z0-9]+\.nc)/,
  regexRefTimeMinutesNc:
    /(?<=[0-9]+_gfs\.t[0-9]{2}z\.pgrb2\.0p25\.f)[0-9]{3}(?=_[a-zA-Z0-9]+\.nc)/,
  regexNameValue:
    /(?<=[0-9]+_gfs\.t[0-9]{2}z\.pgrb2\.0p25\.f[0-9]{3}_)[a-zA-Z0-9]+(?=\.nc)/,
};

module.exports = {
  gfsAWS,
};

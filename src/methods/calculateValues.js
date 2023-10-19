const getAbsoluteLon = (lonStart, lonEnd) => {
  return lonStart > lonEnd ? lonEnd + 360 : lonEnd;
};

const isBetween = (x, min, max) => {
  return x >= min && x <= max;
};

const inGrid = (spot, forecastHeader) => {
  const lo2 = getAbsoluteLon(forecastHeader.lo1, forecastHeader.lo2);
  const spotLon = getAbsoluteLon(forecastHeader.lo1, spot.lon);

  return (
    isBetween(spot.lat, forecastHeader.la1, forecastHeader.la2) &&
    isBetween(spotLon, forecastHeader.lo1, lo2)
  );
};

const getMinPoint = (point, delta) => {
  return point % delta === 0 ? point : point - (point % delta);
};

const getMaxPoint = (point, delta) => {
  return point % delta === 0 ? point : point - (point % delta) + delta;
};

const getGribIndex = (forecastHeader, spot) => {
  // check if end value for longitute is lower than start value
  const lo2 = getAbsoluteLon(forecastHeader.lo1, forecastHeader.lo2);
  const spotLon = getAbsoluteLon(forecastHeader.lo1, spot.lon);

  const latRow = Math.round((spot.lat - forecastHeader.la1) / forecastHeader.dy);
  const latWidth = Math.round((lo2 - forecastHeader.lo1) / forecastHeader.dx + 1);
  const lonPos = Math.round((spotLon - forecastHeader.lo1) / forecastHeader.dx);
  return Math.round(latRow * latWidth + lonPos);
};

const calculateDataValue = (spot, forecastHeader, forecastData) => {
  if (!inGrid(spot, forecastHeader)) {
    return null;
  }
  // bilinear interpolation for 4 points around spot position
  // https://en.wikipedia.org/wiki/Bilinear_interpolation
  const x = getAbsoluteLon(forecastHeader.lo1, spot.lon);
  const y = spot.lat;
  const x1 = getMinPoint(x, forecastHeader.dx);
  const x2 = getMaxPoint(x, forecastHeader.dx);
  const y1 = getMinPoint(y, forecastHeader.dy);
  const y2 = getMaxPoint(y, forecastHeader.dy);
  let Q11 = forecastData[getGribIndex(forecastHeader, { lon: x1, lat: y1 })];
  let Q21 = forecastData[getGribIndex(forecastHeader, { lon: x2, lat: y1 })];
  let Q22 = forecastData[getGribIndex(forecastHeader, { lon: x2, lat: y2 })];
  let Q12 = forecastData[getGribIndex(forecastHeader, { lon: x1, lat: y2 })];

  Q11 = Q11 > 9999999 ? 0 : Q11;
  Q21 = Q21 > 9999999 ? 0 : Q21;
  Q22 = Q22 > 9999999 ? 0 : Q22;
  Q12 = Q12 > 9999999 ? 0 : Q12;

  const R1 = ((x2 - x) / (x2 - x1)) * Q11 + ((x - x1) / (x2 - x1)) * Q21;
  const R2 = ((x2 - x) / (x2 - x1)) * Q12 + ((x - x1) / (x2 - x1)) * Q22;

  const P = ((y2 - y) / (y2 - y1)) * R1 + ((y - y1) / (y2 - y1)) * R2;
  return P;

};

module.exports = {
  inGrid,
  calculateDataValue,
}
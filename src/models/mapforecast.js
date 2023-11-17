const mongoose = require('mongoose');

const { Schema } = mongoose;

const MapForecastSchema = new Schema({
  forecastInfo: { type: Schema.Types.ObjectId, ref: 'Forecast' },
  forecastMaps: { type: Object },
});

module.exports = mongoose.model('MapForecast', MapForecastSchema);

const mongoose = require('mongoose');

const { Schema } = mongoose;

const ForecastSchema = new Schema({
  forecastInfo: { type: Schema.Types.ObjectId, ref: 'Forecast' },
  time: { type: Date, required: true },
  t: { type: Object },
  v: { type: Object },
  u: { type: Object },
});

module.exports = mongoose.model('Forecast', ForecastSchema);

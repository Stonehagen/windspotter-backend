const mongoose = require('mongoose');

const { Schema } = mongoose;

const ForecastSchema = new Schema({
  forecastInfo: { type: Schema.Types.ObjectId, ref: 'Forecast' },
  time: { type: Date, required: true },
  t_2m: { type: Object },
  v_10m: { type: Object },
  u_10m: { type: Object },
});

module.exports = mongoose.model('Forecast', ForecastSchema);

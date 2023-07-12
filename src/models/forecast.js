const mongoose = require('mongoose');

const { Schema } = mongoose;

const ForecastSchema = new Schema({
  name: { type: String, required: true, maxLength: 100 },
  timestamp: { type: Date, default: null },
  lo1: { type: Number, required: true },
  lo2: { type: Number, required: true },
  la1: { type: Number, required: true },
  la2: { type: Number, required: true },
  dy: { type: Number, required: true },
  dx: { type: Number, required: true },
});

module.exports = mongoose.model('Forecast', ForecastSchema);

const mongoose = require('mongoose');

const { Schema } = mongoose;

const ForecastSchema = new Schema({
  text: { type: String, required: true, maxLength: 1000 },
  timestamp: { type: Date, default: Date.now },
  la1: { type: Number, required: true },
  la2: { type: Number, required: true },
  lo1: { type: Number, required: true },
  lo2: { type: Number, required: true },
  dx: { type: Number, required: true },
  dy: { type: Number, required: true },
  forecast: [{ type: Schema.Types.ObjectId, ref: 'Point' }],
});

module.exports = mongoose.model('Forecast', ForecastSchema);

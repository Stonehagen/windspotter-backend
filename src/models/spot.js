const mongoose = require('mongoose');

const { Schema } = mongoose;

const SpotSchema = new Schema({
  name: { type: String, required: true, maxLength: 100 },
  searchName: { type: String, required: true, maxLength: 100 },
  lat: { type: Number, required: true },
  lon: { type: Number, required: true },
  forecasts: [{ type: Schema.Types.ObjectId, ref: 'Forecast' }],
  windDirections: [{ type: String }],
});

module.exports = mongoose.model('Spot', SpotSchema);

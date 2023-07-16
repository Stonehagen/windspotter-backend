const mongoose = require('mongoose');

const { Schema } = mongoose;

const SpotSchema = new Schema({
  name: { type: String, required: true, maxLength: 100 },
  timestamp: { type: Date, default: null },
  lat: { type: Number, required: true },
  lon: { type: Number, required: true },
});

module.exports = mongoose.model('Spot', SpotSchema);

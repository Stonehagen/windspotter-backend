const mongoose = require('mongoose');

const { Schema } = mongoose;

const SpotSchema = new Schema({
  name: { type: String, required: true, maxLength: 100 },
  lat: { type: Number, required: true },
  lon: { type: Number, required: true },
});

module.exports = mongoose.model('Spot', SpotSchema);

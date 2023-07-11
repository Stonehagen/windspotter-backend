const mongoose = require('mongoose');

const { Schema } = mongoose;

const PointSchema = new Schema({
  lat: { type: Number, required: true },
  lon: { type: Number, required: true },
  t: [{ type: Number }],
  v: [{ type: Number }],
  u: [{ type: Number }],
});

module.exports = mongoose.model('Point', PointSchema);

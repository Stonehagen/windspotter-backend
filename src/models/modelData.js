const mongoose = require('mongoose');

const { Schema } = mongoose;

const ModelDataSchema = new Schema({
  timestamp: { type: Date, default: null },
  values: { type: [Number] },
});

module.exports = mongoose.model('ModelData', ModelDataSchema);

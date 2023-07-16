const mongoose = require('mongoose');

const { Schema } = mongoose;

const ModelDataSchema = new Schema({
  values: { type: [Number] },
});

module.exports = mongoose.model('ModelData', ModelDataSchema);

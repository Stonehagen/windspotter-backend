const mongoose = require('mongoose');
const { CronJob } = require('cron');
require('dotenv/config');
const { updateDatabase } = require('./update_database');

// eslint-disable-next-line operator-linebreak
const mongoDB = process.env.MONGODB_URI;
mongoose.connect(mongoDB, { useUnifiedTopology: true, useNewUrlParser: true });
const db = mongoose.connection;
// eslint-disable-next-line no-console
db.on('error', console.error.bind(console, 'mongo connection error'));

// eslint-disable-next-line no-unused-vars
const job = new CronJob(
  '*/30 * * * *',
  updateDatabase(process.env.GRIB_SERVER, process.env.GRIB_DICT, 'grib'),
  null,
  true,
  'Europe/Berlin',
);

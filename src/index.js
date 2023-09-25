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

updateDatabase('iconD2');

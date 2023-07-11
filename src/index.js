const cors = require('cors');
const mongoose = require('mongoose');
const express = require('express');
const http = require('http');
const { CronJob } = require('cron');
require('dotenv/config');
const { updateDatabase } = require('./update_database');

// eslint-disable-next-line no-unused-vars
const job = new CronJob(
  '*/30 * * * *',
  updateDatabase(process.env.GRIB_SERVER, process.env.GRIB_DICT),
  null,
  true,
  'Europe/Berlin',
);

// eslint-disable-next-line operator-linebreak
// const mongoDB = process.env.MONGODB_URI;
// mongoose.connect(mongoDB, { useUnifiedTopology: true, useNewUrlParser: true });
// const db = mongoose.connection;
// eslint-disable-next-line no-console
// db.on('error', console.error.bind(console, 'mongo connection error'));

const app = express();
// http because in a future version i want to implement socket.io
const httpServer = http.createServer(app);

// this is where the routes will be imported
// const routes = require('./routes');

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// this is there the routes are listed
// app.use('/forecast', routes.forecast);

// eslint-disable-next-line arrow-body-style
httpServer.listen(process.env.PORT, () => {
  // eslint-disable-next-line no-console
  return console.log(`app listening on port ${process.env.PORT}!`);
});

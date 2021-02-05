const bookings = require('./updateBookings.js');

const axios = require("axios");
const express = require('express')
const path = require('path');
const moment = require('moment');
const http = require("http");
const { Pool } = require('pg');

const port = process.env.PORT || 8080;

// seconds in a day
const DAY_TO_SECONDS = 86400;

const app = express();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: Boolean(Number(process.env.SSL))
});


// set the view engine to ejs
app.set('view engine', 'ejs');
app.use(express.static(path.join(__dirname, 'public')));

app.listen(port, () => {
  console.log(`Listening on ${port}`);
});

app.use('*', function(req, res, next) {
  checkTimestamp().then(() => {
    next();
  });
});

app.get('/', async (req, res) => {
    try {
      const client = await pool.connect();
      let currentDate = moment();
      let currentTime = currentDate.format("HH:mm");

      querySelect = `SELECT *, start_time < '${currentTime}' as free_now FROM bookings
         WHERE
         date = CURRENT_DATE
         AND end_time >= '${currentTime}'
         AND free
         ORDER BY
         start_time ASC,
         end_time DESC;`;

      const result = await client.query(querySelect);
      let listOfRooms = result['rows'];

      // convert military time to standard time
      for(tempRoom in listOfRooms) {
        let startTime = listOfRooms[tempRoom].start_time;
        let endTime = listOfRooms[tempRoom].end_time;

        const newStartTime = moment(startTime, 'HH:mm').format('h:mm a');
        const newEndTime = moment(endTime, 'HH:mm').format('h:mm a');

        listOfRooms[tempRoom].start_time = newStartTime;
        listOfRooms[tempRoom].end_time = newEndTime;
      }
      res.render('index', { roomList: listOfRooms })
      client.release();
    } catch(err) {
      console.log(err);
    }
});

app.get('/free-rooms', async (req, res) => {
  try {
    const client = await pool.connect();

    let querySelect = "";
    let illegalRequest = false;

    if ('start_time' in req.query && 'end_time' in req.query) {
      let startTime = req.query.start_time;
      let endTime = req.query.end_time;

      const validTimeFormats = ["YYYY-MM-DD HH:mm", "YYYY-MM-DD H:mm"]
      const startTimeValid = moment("2019-01-10 " + startTime, validTimeFormats, true).isValid();
      const endTimeValid = moment("2019-01-10 " + endTime, validTimeFormats, true).isValid();

      if (startTimeValid && endTimeValid) {
        querySelect = `SELECT * FROM bookings
           WHERE
           date = CURRENT_DATE
           AND start_time >= '${startTime}'
           AND end_time <= '${endTime}'
           AND free
           ORDER BY
           start_time ASC,
           end_time DESC;`;
      } else {
        illegalRequest = true;
      }

    } else if (Object.keys(req.query).length == 0) {
      let currentDate = moment();
      let currentTime = currentDate.format("HH:mm");

      querySelect = `SELECT * FROM bookings
         WHERE
         date = CURRENT_DATE
         AND end_time >= '${currentTime}'
         AND free
         ORDER BY
         start_time ASC,
         end_time DESC;`;
    }

    let listOfRooms = {};

    if(!illegalRequest) {
      const result = await client.query(querySelect);
      listOfRooms = result['rows'];
    }

    res.send('<pre>' + JSON.stringify(listOfRooms, null, '\t') + '</pre>');

    client.release();
  } catch (err) {
    console.log(err);
  }
});

app.get('/rooms', async (req, res) => {
  try {
    const client = await pool.connect()
    const result = await client.query('SELECT * FROM rooms');

    let listOfRooms = result['rows'];

    res.send('<pre>' + JSON.stringify(listOfRooms, null, '\t') + '</pre>');
    client.release();
  } catch (err) {
    console.error(err);
  }
});

async function checkTimestamp() {
  try {
    const client = await pool.connect();

    const currentDate = moment();
    const currentTimestamp = currentDate.unix();

    querySelect = 'SELECT timestamp FROM misc;';
    const result = await client.query(querySelect);

    let timestamp = result['rows'][0].timestamp;

    const timeElapsed = Math.abs(currentTimestamp - timestamp);

    if(timeElapsed >= DAY_TO_SECONDS) {
      let queryUpdate = `UPDATE ONLY misc SET timestamp=${currentTimestamp} WHERE timestamp=${timestamp};`;
      await client.query(queryUpdate);
      // update bookings once a day
      await bookings.updateAllBookings();
    }
    client.release();
    
  } catch(err) {
    console.log(err);
  }
}

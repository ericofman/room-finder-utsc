const generate = require('./requestGenerator.js');
const scheduleParser = require('./scheduleParser.js')
const axios = require("axios");
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: Boolean(Number(process.env.SSL))
});

// holds the year, month, day and formulated URL
const requestData = generate.endpoint();

function updateAllBookings() {
  return new Promise(function(resolve, reject) {
    scheduleParser.parse(requestData.url).then(async (schedules) => {
      const client = await pool.connect();

      let queryCreate = "CREATE TABLE IF NOT EXISTS bookings (" +
        "room_name VARCHAR(40) REFERENCES rooms(room_name)," +
        "date date NOT NULL," +
        "start_time time without time zone ," +
        "end_time time without time zone ," +
        "course VARCHAR(100) NOT NULL," +
        "professor VARCHAR(100) NOT NULL," +
        "free BOOLEAN NOT NULL" +
        ");";
      await client.query(queryCreate);

      // truncate and populate again
      let queryTruncate = 'TRUNCATE ONLY bookings;';
      await client.query(queryTruncate);

      for (const [roomName, roomKey] of Object.entries(schedules)) {

        let queryInsert = "INSERT INTO bookings (room_name, date, start_time, end_time, course, professor, free) VALUES ";

        for (const [day, chunks] of Object.entries(roomKey)) {
          for (tempChunk of chunks) {
            if (tempChunk.occupier === undefined) {
              tempChunk.occupier = 'null@null';
            }

            const courseNames = getCourseNames(tempChunk.occupier);
            const profName = getProfName(tempChunk.occupier);

            const date_month = day.split(" ")[0];
            const date_day = day.split(" ")[1];
            let date = `${requestData.year}-${getMonth(date_month)}-${date_day}`;

            const currStartTime = tempChunk.startTime;
            const currEndTime = tempChunk.endTime;

            const isFree = tempChunk.free;

            queryInsert += `(
  			      '${roomName}',
  			      '${date}',
  			      '${currStartTime}',
  						'${currEndTime}',
  						'${courseNames}',
  						'${profName}',
  			       ${isFree}),`;
          }
        }

        // close off the query
        queryInsert = queryInsert.substring(0, queryInsert.length - 1);
        queryInsert += ';';

        // insert each room seperately
        await client.query(queryInsert);
      }
      client.release();
      resolve("SUCCESS");

    }).catch((err) => console.error(err));
  });
}

function getMonth(monthStr) {
  return new Date(monthStr + '-1-01').getMonth() + 1;
}

function getProfName(occupier) {
  // remove apostrophes in prof names (temp fix)
  // example: S. O'Sullivan
  let profName = occupier.replace(/'/g, '');

  profName = profName.split("@")[1];
  if (profName === undefined) {
    profName = 'null';
  }

  return profName;
}

function getCourseNames(occupier) {
  let courseName = occupier.split("@")[0];
  if (courseName === undefined) {
    courseName = 'null';
  }

  return courseName;
}

exports.updateAllBookings = updateAllBookings;

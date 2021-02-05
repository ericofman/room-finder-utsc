const axios = require("axios");
const cheerio = require("cheerio");
const util = require('util');
const fs = require('fs');
const moment = require('moment');
const { Client } = require('pg');

const ROOM_SCHEDULES_URL = 'https://www.utsc.utoronto.ca/regoffice/timetable/room_schd.php';

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: Boolean(Number(process.env.SSL))
});

function Room(roomName, capacity, description, accessibility) {
  this.roomName = roomName;
  this.capacity = capacity;
  this.description = description;
  this.accessibility = accessibility;
}

Room.prototype.isAccessible = function() {
  return this.accessibility === "Yes" ? true : false;
}

const fetchRooms = async url => {
  try {
    let rooms = [];

    const response = await axios.get(url);
    const html = response.data;

    const $ = cheerio.load(html);

    $("#listRooms table tr").each(function(i, elem) {
      let roomChildren = $(this).children();

      let roomName = roomChildren.eq(1).text();
      let roomCapacity = roomChildren.eq(2).text();
      let roomDesc = roomChildren.eq(3).text();
      let roomAccess = roomChildren.eq(5).text();

      let newRoom = new Room(roomName, roomCapacity, roomDesc, roomAccess);
      rooms.push(newRoom);
    });
    return rooms;

  } catch (error) {
    console.log(error.response.data);
    console.log(error.response.status);
    console.log(error.response.headers);
  }
};

fetchRooms(ROOM_SCHEDULES_URL).then(async (roomsList) => {
  await client.connect();

  let queryCreate = "CREATE TABLE IF NOT EXISTS rooms(" +
    "room_name VARCHAR(40) PRIMARY KEY," +
    "capacity INT NOT NULL CHECK (capacity > 0)," +
    "description VARCHAR(255) NOT NULL," +
    "accessible BOOLEAN NOT NULL" +
    ");";

  await client.query(queryCreate);

  let queryInsert = 'INSERT INTO rooms (room_name, capacity, description, accessible) VALUES ';

  for (tempRoom of roomsList) {
    if (tempRoom.capacity >= 0) {
      let roomName = tempRoom.roomName.split(" ");
      roomName = roomName[0] + '-' + roomName[1];

      queryInsert += `(
          '${roomName}',
           ${tempRoom.capacity},
          '${tempRoom.description}',
           ${tempRoom.isAccessible()}),`;
    }
  }

  const readFile = util.promisify(fs.readFile);
  let unlistedRoomsJSON = await readFile('./unlistedRooms.json');
  let unlistedRooms = JSON.parse(unlistedRoomsJSON);
  for (tempRoom of unlistedRooms) {
    queryInsert += `(
      '${tempRoom.roomName}',
       ${tempRoom.capacity},
      '${tempRoom.desc}',
       ${tempRoom.accessible}),`;
  }

  // remove the last comma
  queryInsert = queryInsert.substring(0, queryInsert.length - 1);
  // close off the query
  queryInsert += ';';

  await client.query(queryInsert);

  // pass on the client connection
  return client;
}).then(async (client) => {
  let queryCreate = "CREATE TABLE IF NOT EXISTS misc (" +
    "timestamp BIGINT NOT NULL" +
    ");";

  await client.query(queryCreate);

  currentDate = moment();
  let currentUnixTime = currentDate.unix();

  let queryInsert = 'INSERT INTO misc (timestamp) VALUES ';
  queryInsert += '(' + currentUnixTime + ');';

  await client.query(queryInsert);

  client.end();
}).catch((err) => console.error(err));

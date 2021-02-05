const cheerio = require('cheerio'),
  cheerioTableparser = require('cheerio-tableparser');
const axios = require("axios");

const FREE_SPACE_NAME = "Free-Space";

function TableChunks(occupier, startTime, endTime, free) {
  this.occupier = occupier;
  this.startTime = startTime;
  this.endTime = endTime;
  this.free = free;
}

const fetchSchedules = async url => {
  try {
    const response = await axios.get(url);
    const data = response.data;

    return data;
  } catch (error) {
    console.log(error.response.data);
    console.log(error.response.status);
    console.log(error.response.headers);
  }
};

function parse(url) {
  return new Promise(function(resolve, reject) {
    fetchSchedules(url).then((roomList) => {
      let roomSchedules = {};

      for (room in roomList) {
        // init the rooms
        roomSchedules[room] = {};

        // changed html breaks to @ to make parsing easier down the road
        const modifiedRoomHTML = roomList[room].replace(/<br\/>/g, '@');

        $ = cheerio.load(modifiedRoomHTML);
        cheerioTableparser($);
        let roomScheduleTable = $(".caltable").parsetable(true, true, true);

        // init the dates
        // i = 1 because we're skipping the empty left corner
        for (let i = 1; i < roomScheduleTable.length; i++) {
          let currDay = String(roomScheduleTable[i][0].split(',')[1]).trim();
          roomSchedules[room][currDay] = [];
        }

        // init occupier to the very first field
        let occupier = roomScheduleTable[1][1];
        if (occupier === '') {
          occupier = FREE_SPACE_NAME;
        }
        let lastOccupier = occupier;

        // init to 8am
        let startTime = roomScheduleTable[0][1];
        let endTime = roomScheduleTable[0][1];

        // i = 1 because we're skipping the schedule time column
        // j = 1 because we're skipping the dates row
        for (let i = 1; i < roomScheduleTable.length; i++) {
          for (let j = 1; j < roomScheduleTable[0].length; j++) {
            let isFree = false;
            let currDate = String(roomScheduleTable[i][0].split(',')[1]).trim();

            lastOccupier = occupier;

            if (roomScheduleTable[i][j] === '') {
              occupier = FREE_SPACE_NAME;
            } else {
              occupier = roomScheduleTable[i][j];
            }

            // if we hit the end of the column
            if (j === roomScheduleTable[0].length - 1 &&
              lastOccupier === occupier) {
              if (lastOccupier === FREE_SPACE_NAME) isFree = true;

              endTime = roomScheduleTable[0][j];
              roomSchedules[room][currDate].push(new TableChunks(lastOccupier, startTime, endTime, isFree));
              startTime = roomScheduleTable[0][1]; // reset to 8am

              // while the column is not the sunday column
              if(i !== roomScheduleTable.length - 1) {
                let nextColumn = i + 1;
                // reset occupier to the first field in the next column
                occupier = roomScheduleTable[nextColumn][1];
              }
            } else if (occupier !== lastOccupier) {
              if (lastOccupier === FREE_SPACE_NAME) isFree = true;

              endTime = roomScheduleTable[0][j];
              roomSchedules[room][currDate].push(new TableChunks(lastOccupier, startTime, endTime, isFree));
              startTime = endTime;
            }
          }
        }
      }
      resolve(roomSchedules);
    }).catch((err) => reject(err));
  });
}

exports.parse = parse;

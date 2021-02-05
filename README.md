# get-a-room

## Ideas/plan
- rest api
- Nodejs
- Every morning request [https://intranet.utsc.utoronto.ca/intranet2/RegistrarService?&room=AA-209&day=2018-11-11&callback=] (with every room in the request)
- Parse response to make it into a db

- Db has two tables
  1. Holds all classrooms and their identifiers and info
  2. Holds all bookings of all classrooms
  
| room_name        | date           | start-time  | end-time  | course | professor | free|
| ------------- |:-------------:| -----:| --------- | --------- | --------- | --- |
|HW-216      | 2019-01-07 | 08:00:00 | 09:30:00 |  MATA29 | Smith| false |
|HW-216      | 2019-01-07 | 09:30:00 | 10:00:00 |  Free-Space | null| true |

- Get endpoints:
  - Free-rooms-right-now:
`Select * from bookings where day = today and free = true and start-time < now and endTime > now`
    - should return a json with some meta-info and a list of Booking objects of the format: 
    
`
{
  givenTimeWasFound : true;
  numberOfRooms : 2;
  rooms : 
  [
    HW-216: {
      start-time: 09:30:00,
      end-time: 10:00:00
    },
    SW-219: {
      start-time: 9:00:00,
      end-time: 10:00:00
    }
  ]
}
`
    - if there's no rooms that are free right now, then keep rerunning the search with now + 30 minutes until it returns something, then return that, with givenTimeWasFound: false.

  - free-rooms-time
    - in the request body there should be a Date object. Should return a json like the one above. No need to rerun if no room was found.

  - Free-rooms-today:
    `Select * from bookings where day = today and free = true`
    - return json like the one above, preferably with the bookings sorted chronologically.



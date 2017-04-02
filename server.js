const path = require('path');
const express = require('express');
const fileUpload = require('express-fileupload');
const app = express();
const PORT = process.env.PORT || 8080;
const server = require('http').createServer(app);
const io = require('socket.io')(server);
const settings = require("./settings"); // settings.json
const knexSettings = require("./knexfile.js");
const pg = require("pg");
const index = require('./e_search/index.js');
const util = require('util');
const fs = require('fs');
const matchingFunction = require('./e_search/matching-function.js')

app.use(fileUpload());

let connection = knexSettings.development;

if (process.env.NODE_ENV === 'production'){
  connection = knexSettings.production;
}

const knex = require('knex')(
  connection);

let currentUsers = {}

// using webpack-dev-server and middleware in development environment
if (process.env.NODE_ENV !== 'production') {
  const webpackDevMiddleware = require('webpack-dev-middleware');
  const webpackHotMiddleware = require('webpack-hot-middleware');
  const webpack = require('webpack');
  const config = require('./webpack.config');
  const compiler = webpack(config);

  app.use(webpackDevMiddleware(compiler, { noInfo: true, publicPath: config.output.publicPath }));
  app.use(webpackHotMiddleware(compiler));
}

app.use(express.static(path.join(__dirname, 'dist')));
app.use(express.static(path.join(__dirname, '/src/assets/images')));



app.get('/', function(req, res) {
  res.sendFile(__dirname + '/dist/index.html')
});

app.post('/upload', function(req, res, next) {
   // let tempPath = req.file.path;
  console.log(req.files)
  for (file in req.files){
    fs.writeFile(__dirname + `/src/assets/images/${file}`, req.files[file].data, {flag: "w"}, (err) => {
      if (err) throw err;
        console.log('The file has been saved!');
    });
  }
  res.status(201).send()
});


io.on('connection', function(client) {
  console.log('client connected!');
  client.on('join', function(data) {
    client.emit("message", "leave me alone");
  });

  // Indexing 'users' data when logging in
  client.on('indexingData', () => {
    index.queryAllUsers()
    .then(index.indexing, (err) => {console.log(err)})
    .then(() => {client.emit('indexingData', "Indexing is done")}, (err) => {console.log(err)})
  });

  // TODO - Matching should happen when entering an event, BUT now is every login
  client.on('elasticsearch', (userId) => {
    let userNormalId;
    let matchResultsUserIdTemp = [];
    matchingFunction.findUserById(userId)
    .then((user) => {
      console.log("User -->",user);
      userNormalId = user[0].id;
      return user;
    }, (err) => {console.log(err)})
    .then(matchingFunction.runMatching, (err) => {console.log(err)})
    .then((matchResults) => {
      console.log("Match results -->", matchResults.hits.hits)
      matchResultsUserIdTemp = [];
      console.log("Temporary match results should be empty first", matchResultsUserIdTemp);
      matchResults.hits.hits.forEach((hit) => {
        let arrInput = {
          user_id2: hit._source.id,
          score: hit._score
        };
        matchResultsUserIdTemp.push(arrInput);
      });
      console.log("Temporary match results after", matchResultsUserIdTemp);
      return matchingFunction.updateUserPoints(matchResults, userNormalId)
    }, (err) => {console.log(err)})
    .then((updateResults) => {
      console.log("Update results -->", updateResults);
      return matchingFunction.insertNewPair(updateResults, matchResultsUserIdTemp, userNormalId)
    }, (err) => {console.log(err)})
    .then(() => {
      // console.log("Same data as previous'then'?", data);
      client.emit('elasticsearch', 'Matching is done');
    }, (err) => {console.log(err)})
  })

  client.on('getEvent', function(data){
    let randomUsers = [];
    knex.column('id').table('users').where('linkedin_id', data.userId)
      .then(function(id){
        knex.select( 'event_users.event_id',
                      'user_id1',
                      'user_id2',
                      'users.id',
                      'users.linkedin_id',
                      'users.first_name',
                      'users.email_address',
                      'users.last_name',
                      'users.headline',
                      'users.picture_url',
                      'users.industry',
                      'users.location',
                      'users.public_profile_url',
                      'points.points').from('points')
        .join('users', function(){
          this.on('points.user_id2','users.id')
        })
        .join('event_users', function(){
          this.on('event_users.user_id', 'users.id')
        })
        .where('event_users.event_id', data.event)
        .andWhere('points.user_id1', id[0].id)
        .union(function() {
          this.select('event_users.event_id',
                      'user_id1',
                      'user_id2',
                      'users.id',
                      'users.linkedin_id',
                      'users.first_name',
                      'users.email_address',
                      'users.last_name',
                      'users.headline',
                      'users.picture_url',
                      'users.industry',
                      'users.location',
                      'users.public_profile_url',
                      'points.points').from('points')
        .join('users', function(){
          this.on('points.user_id1','users.id')
        })
        .join('event_users', function(){
          this.on('event_users.user_id', 'users.id')
        })
        .where('event_users.event_id', data.event)
        .andWhere('points.user_id2', id[0].id)
        })
        .orderBy('points', 'desc').limit(5)
        .then(function(result){
          if (result.length < 5) {
            knex.select('event_users.event_id',
                        'users.id',
                        'users.linkedin_id',
                        'users.first_name',
                        'users.email_address',
                        'users.last_name',
                        'users.headline',
                        'users.picture_url',
                        'users.industry',
                        'users.location',
                        'users.public_profile_url')
                        .table('event_users')
            .join('users', function(){
              this.on('user_id', 'users.id')
            })
            .join('events', function(){
              this.on('events.id', data.event)
            })
            .where('event_users.event_id', data.event)
            .andWhere('users.id', '<>', id[0].id)
            .limit(5 - result.length)
            .then(function(result){
              knex.select().table('events').where('id', data.event)
              .then(function(eventResult){
                let send = {
                  event: eventResult[0],
                  users: result
                }
              client.emit('responseGetEvent', send);
              })
            })
          } else {
            knex.select().table('events').where('id', data.event)
            .then(function(event){
              let send = {
                event: event[0],
                users: result
              }
              client.emit('responseGetEvent', send);
            })
          }
        })
      })
  });

  client.on('reject', function(data) {
    let response = data;
    response.message.push("User doesn't want to talk to you!");
    let receiverID = currentUsers[data.linkedin_id];
    io.sockets.connected[receiverID].emit('responseMessage', response);
  });

  client.on('message', function(data) {
    let response = data;
    let id;
    id = data.user_id1;
    if(data.id === data.user_id1){
      id = data.user_id2;
    }
    let receiverID = currentUsers[data.linkedin_id];
    if(!receiverID){
      response.message.push("User isn't online. Get a life!")
      client.emit('responseMessage', response)
    } else {
      knex.select( 'event_users.event_id',
                    'user_id1',
                    'user_id2',
                    'users.id',
                    'users.linkedin_id',
                    'users.first_name',
                    'users.email_address',
                    'users.last_name',
                    'users.headline',
                    'users.picture_url',
                    'users.industry',
                    'users.location',
                    'users.public_profile_url',
                    'points.points').from('points')
      .join('users', function(){
        this.on('points.user_id2','users.id')
      })
      .join('event_users', function(){
        this.on('event_users.user_id', 'users.id')
      }).where('event_users.event_id', data.event_id)
      .andWhere('points.user_id1', data.user_id1)
      .andWhere('points.user_id2', data.user_id2)
      .andWhere('users.id', id)
      .union(function() {
          this.select( 'event_users.event_id',
                      'user_id1',
                      'user_id2',
                      'users.id',
                      'users.linkedin_id',
                      'users.first_name',
                      'users.email_address',
                      'users.last_name',
                      'users.headline',
                      'users.picture_url',
                      'users.industry',
                      'users.location',
                      'users.public_profile_url',
                      'points.points').from('points')
        .join('users', function(){
          this.on('points.user_id1','users.id')
        })
        .join('event_users', function(){
          this.on('event_users.user_id', 'users.id')
        }).where('event_users.event_id', data.event_id)
        .andWhere('points.user_id1', data.user_id1)
        .andWhere('points.user_id2', data.user_id2)
        .andWhere('users.id', id)
      })
      .then(function(result){
        let dataSend = result[0];
        dataSend['message'] = data.message;
        io.sockets.connected[receiverID].emit('OMGmessage', dataSend);
        client.emit('responseMessage', response)
      })


    }
  });

  client.on('userLogin', function(data) {
    currentUsers[data.userId] = client.id;
    let sendData;
    knex.column('id').table('users').where('linkedin_id', data.userId)
      .then(function(id){
        console.log('this is id ========>', id)
      knex.select().table(knex.raw(`(SELECT * FROM "event_users" WHERE "user_id" = ${id[0].id}) AS "eventUsers"`))
      .rightOuterJoin('events', function(){
        this.on('eventUsers.event_id', 'events.id')
      }).where('user_id', null)
      .then(function(dat){
        knex.column('id').table('users').where('linkedin_id', data.userId)
        .then(function(id){
          knex.table('event_users').join('events', 'event_id', '=', 'events.id').where('user_id', id[0].id)
          .then(function(userEvent){
            console.log(userEvent);
            sendData = {allEvent: dat, userEvent: userEvent}
            client.emit("responseUserLogin", sendData);
          })
        });
      });
    });
  });

  client.on('getData', function(data) {
    knex.select().table('events')
    .then(function(dat){
      client.emit('responseGetData', {allEvent: dat})
    });
  });

  client.on('addEvent', function(data) {
    knex.column('id').table('users').where('linkedin_id', data.userId)
    .then(function(dat){
      knex.select().table('event_users').where('event_id', data.eventId).andWhere('user_id', dat[0].id)
      .then(function(events){
        if (events.length === 0){
          knex('event_users').insert({event_id: data.eventId, user_id: dat[0].id})
          .then(function(){
            client.emit('eventAdded');
          })
        }
      })
    })
  });

  client.on('leaveEvent', function(data) {
    knex.column('id').table('users').where('linkedin_id', data.userId)
    .then(function(dat){
      knex.table('event_users').where('event_id', data.eventId).andWhere('user_id', dat[0].id).del()
      .then(function(){
        client.emit('eventLeft');
      })
    })
  });



  client.on('user', function(data) {
    let position_company_name = [];
    let position_company_industry = [];
    let position_company_type = [];
    let position_company_location = [];
    let position_company_summary = [];
    let position_company_title = [];
    if (data.positions.values) {
      data.positions.values.forEach((position) => {
        position_company_name.push(position.company.name);
        position_company_industry.push(position.company.industry);
        position_company_type.push(position.company.type);
        position_company_location.push(position.location.name);
        position_company_summary.push(position.summary);
        position_company_title.push(position.title);
      })
    }

    let headline = !data.headline ? '' : data.headline;
    let location = !data.location ? '' : data.location.name;
    let industry = !data.industry ? '' : data.industry;
    let current_share = !data.currentShare ? '' : data.currentShare.content.description;
    let summary = !data.summary ? '' : data.summary;
    let picture_url = !data.pictureUrls.values ? '' : data.pictureUrls.values[0];

    let insertData = {
        linkedin_id: data.id,
        first_name: data.firstName,
        last_name: data.lastName,
        headline: headline,
        industry: industry,
        location: location,
        summary: summary,
        num_connections: data.numConnections,
        picture_url: picture_url,
        public_profile_url: data.publicProfileUrl,
        current_share: current_share,
        positions: data.positions._total,
        position_company_name: JSON.stringify(position_company_name),
        position_company_industry: JSON.stringify(position_company_industry),
        position_company_type: JSON.stringify(position_company_type),
        position_company_location: JSON.stringify(position_company_location),
        position_company_summary: JSON.stringify(position_company_summary),
        position_company_title: JSON.stringify(position_company_title)
        };
    let insert = knex('users').insert(insertData).toString();
    let update = knex('users').update(insertData).whereRaw('users.linkedin_id = ' + "'" + insertData.linkedin_id + "'").toString();
    let query = util.format('%s ON CONFLICT (linkedin_id) DO UPDATE SET %s', insert, update.replace(/^update\s.*\sset\s/i, ''));

  knex.raw(query)
      .then((data)=> {
        // console.log("---->", data);
        // index.indexing();
      })
      .catch(err => console.log(err))
  });

  client.on('createEvent', function(data) {
    console.log(data.filename);
    let insertData = {
      name: data.formInput.name,
      description: data.formInput.description,
      venue: data.formInput.venue,
      creator_name: data.creator_name,
      creator_picture_url: data.creator_picture_url,
      picture_url: data.formInput.imageName,
      start_time: data.formInput.start,
      end_time: data.formInput.end
    }
    let insert = knex('events').insert(insertData).toString();
    knex.raw(insert).catch((err) => {
      console.error(err);
    });
    console.log('Create event comes here')
    console.log('This is data', data.formInput)

  })

  client.on('destroy', function(data){
    console.log(data)
    console.log(currentUsers)
    delete currentUsers[data];
    console.log(currentUsers)
  })

  client.on('disconnect', function() {
    console.log("disconnect")
    for (remove in currentUsers) {
      if (currentUsers[remove] === client.id){
        delete currentUsers[remove];
      }
    }
    console.log(client.id)
  });
});

server.listen(PORT, function(error) {
  if (error) {
    console.error(error);
  } else {
    console.info('==> 🌎  Listening on port %s. Visit http://localhost:%s/ in your browser.', PORT, PORT);
  }
});
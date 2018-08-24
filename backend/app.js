"use strict";
var _ = require('underscore');
var express = require('express');
var validator = require('express-validator');
var app=express();
var mongoose= require('mongoose');
var passport = require('passport')
var cookieSession = require('cookie-session');
var Models = require('./models');
var User = Models.User;
var DailyLog = Models.DailyLog;
var initialSuggestions = require('./initialSuggestions').initialSuggestions;
var emotionInfo = require('./emotionInfo').emotionInfo;
const localStrategy = require ('passport-local').Strategy;
var hashPassword = (password) => (password + process.env.SECRETHASH );
// require('./services/passport.js')

mongoose.connect(process.env.MONGODB_URI);

mongoose.connection.on('connected', function() {
  console.log('Success: connected to MongoDb!');
});
mongoose.connection.on('error', function() {
  console.log('Error connecting to MongoDb. Check MONGODB_URI in env.sh');
  process.exit(1);
});

var fs = require('fs');
var bodyParser = require('body-parser');


app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use(cookieSession({
  maxAge: 30 * 24 * 60 * 60 * 1000,
  keys: [process.env.COOKIEKEY]
}))

app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser((user, done) => {
  done(null, user._id)
})

passport.deserializeUser((id, done) => {
  User.findById(id)
  .then(user => {
    if(!user) {
      console.log('hi')
      return done(null, null)
    }
    done(null, user)
  })
})

passport.use(new localStrategy(
  function(username, password, done) {
    User.findOne({username: username})
    .then(user => {
      if(!user){
        console.log('1')
        return done(null, false)
      }
      if(user.password !== hashPassword(password)){
        console.log('2')
        return done(null, false)
      }
      console.log('3')
      return done(null, user)
    })
  }
))

/**
------------------HELPER FUNCTIONS --------------
**/
//total logs
var getLogCount = (userId) => {
  console.log('in log count')
  return DailyLog.find({
    owner: userId
  })
  .then(results => {
    let count = results.length
    return count;
  }).catch(err => console.log (err));
}

//most used suggestion
var getMostUsedSuggestion = (userId) => {
  console.log('in most used')
  return User.findById(userId)
  .then(user => {
    let sugs = user.suggestions.slice();
    sugs.sort((a,b) => b.count - a.count);
    return sugs[0].name;
  }).catch(err => console.log (err));
}



//most frequent detailed emotions
var getTopEmos = (userId) => {
  console.log('in top emos')
  return DailyLog.find({
    owner: userId
  })
  .then(logs => {
    console.log('logs are' + logs)
    let emoCounter = {}
    logs.forEach(log => {
      log.oldDetailedEmotions.forEach(emo => {
        emoCounter[emo.name] = (emoCounter[emo.name] || 0) + emo.intensity
      })
    })
    var sortable = [];
    console.log('emoCounter is' + JSON.stringify(emoCounter))
    for (var emo in emoCounter) {
        sortable.push([emo, emoCounter[emo]]);
    }
    sortable.sort(function(a, b) {
        return b[1] - a[1];
    });
    let sorted = []
    let len = 0;
    if (sortable.length >= 5){
      len = 5
    }
    else {
      len = sortable.length
    }
    for (let i = 0; i < len; i++) {
      sorted.push(sortable[i][0])
    }
    for (let i = 0; i < len; i++) {
      sorted.push(sortable[i][0])
    }
    return sorted;
  }).catch(err => console.log (err));
}
/**



**/
//most frequent reasons
var getTopReasons = (userId) => {
  return DailyLog.find({
    owner: userId
  })
  .then(logs => {
    let reasons = [];
    logs.forEach(log => {
      reasons = [...reasons, ...log.reasons]
    })
    let counter = {}
    reasons.forEach(word => {
      counter[word] = (counter[word] || 0) + 1;
    });
    var sortable = [];
    for (var reason in counter) {
        sortable.push([reason, counter[reason]]);
    }
    sortable.sort(function(a, b) {
        return b[1] - a[1];
    });
    let sorted = []
    let len = 0
    if (sortable.length >= 3){
      len = 3
    }
    else {
      len = sortable.length
    }
    for (let i = 0; i < len; i++) {
      sorted.push(sortable[i][0])
    }
    return sorted;
  }).catch(err => console.log (err));
}
/**


**/
//most productive activity
var getMostProductiveActivity = (userId) => {
  let suggestions = [];
  return User.findById(userId)
  .then(result => {
    let sugs = result.suggestions.slice();
    sugs.sort((a,b) => b.score - a.score);
    return sugs[0].name;
  }).catch(err => console.log({"error": err}));
}

/**
---------------END HELPER FUNCTIONS --------------
**/


app.post('/login', passport.authenticate('local', { failureRedirect: '/'}), (req, res) => {
  res.send(req.user._id);
})


app.get('/', function(req, res){
  res.send('error')
})

app.post('/register', (req, res)=> {
  let name = req.body.name;
  let username = req.body.username;
  let password = hashPassword(req.body.password);
  let email = req.body.email;
  let phoneNumber = req.body.phoneNumber;

  User.findOne({username: username})
  .then(result => {

    if (!result) {
      let newUser = new User({
        name: name,
        username: username,
        password: password,
        phoneNumber: phoneNumber,
        email: email,
        suggestions: initialSuggestions,
        friends: []
      });

      newUser.save()
      .then(result => {
        res.json(result._id);
      })
      .catch(err => res.json(err));
    }
    else {
      res.json({"error": 'username is already taken!'});
    }

  }).catch(err=> res.json({"error": err}));
});


app.get('/:userid', (req, res)=> {
  let userId = req.params.userid;
  User.findById(userId)
  .then(result => {
    let returnObj = {
      "name": result.name,
      "username": result.username
    };
    res.json(returnObj);
  })
  .catch(err => res.status(400).json({"error": err}));
});


//shows all logs...use for "old entries"
app.get('/:userid/oldLogs', (req, res)=> {
  let userId = req.params.userid;
  DailyLog.find({
    owner: userId
  })
  .then (results => {
    res.json(results);
  })
  .catch(err => res.status(400).json({"error": err}));
});

//to get a single log...for "show log"
app.get('/:userid/showLastLog', (req, res)=> {
  let userId = req.params.userid
  DailyLog.find({
    owner: userId
  })
  .then (results => {
    let log = results[results.length-1]
    res.json(log);
  })
  .catch(err => res.status(400).json({"error": err}));
});

app.get('/:logid/showSingleLog', (req, res)=> {
  let logid = req.params.logid
  DailyLog.findById(logid)
  .then (result => {
    res.json(result);
  })
  .catch(err => res.status(400).json({"error": err}));
});


app.get('/:userid/showSuggestions', (req, res) => {
  User.findById(req.params.userid)
  .then(result => {
    let suggestions = [];
    result.suggestions.map(sug => {
      suggestions.push({
        "name":sug.name,
        "description":sug.description
      })
    })
    res.json(suggestions)
  })
  .catch(err => res.status(400).json({"error": err}))
})


app.get('/:userid/stats', async (req, res) => {
  let userid = req.params.userid;
  res.json({
    mostProductiveActivity: await getMostProductiveActivity(userid), //noGood
    totalLogs: await getLogCount(userid), //good
    topEmotions: await getTopEmos(userid), //idk
    topReasons: await getTopReasons(userid), //idk
    mostUsedSuggestion: await getMostUsedSuggestion(userid) //good
  });
});


app.post('/:userid/addSuggestion', (req, res) => {
  let userid = req.params.userid;
  let name = req.body.name;
  let description = req.body.description;
  let tags = req.body.tags;

  User.findById(userid)
  .then(user => {
    let sugs = user.suggestions.slice();
    sugs.push({
      name: name,
      description: description,
      count: 1,
      score: 1,
      tags: tags
    });
    user.suggestions = sugs;
    user.save()
    res.json({"status": 200, "suggestions": sugs});
  }).catch(err => res.json({'error': err}))
})


app.post('/:userid/deleteSuggestion', (req, res) => {
  let suggestionToDelete = req.body.suggestion;
  let userid = req.params.userid;

  User.findById(userid)
  .then(result => {
    result.suggestions = result.suggestions.filter(sug => sug.name !== suggestionToDelete);

    res.json({"status": 200, "suggestions": result.suggestions});
    result.save();
  }).catch(err=> res.json({"error": err}));
})


app.post('/:userid/reEvaluate', (req, res)=> {
  let newDetailedEmotions = req.body.emotions;
  let completedSuggestion = req.body.completedSuggestion;
  let score = req.body.score;

  DailyLog.find({
    owner: req.params.userid
  }).then(results => {
    results[results.length-1].newDetailedEmotions = newDetailedEmotions;
    results[results.length-1].completedSuggestion = completedSuggestion;
    return results[results.length-1].save()
  }).then(() => {
    User.findById(req.params.userid)
    .then(user=> {
      let updatedSuggestions = [];
      user.suggestions.forEach(sug => {
        if (sug.name !== completedSuggestion){
          updatedSuggestions.push(sug);
        }else{
          let oldAverage = Number(sug.count) * Number(sug.score);
          let newCount = Number(sug.count)+1;
          let newScore = ((Number (oldAverage) + Number(req.body.score))/newCount);
          updatedSuggestions.push({
            tags: sug.tags,
            _id: sug._id,
            name: sug.name,
            description: sug.description,
            count: newCount,
            score: newScore
          });
        }
      })
      user.suggestions = updatedSuggestions;
      user.save();
      res.json({"status": 200});
    })
  }).catch(err => res.json({'error': err}));
})


  app.post('/:userid/newLog', (req, res) => {
    let error = '';

    let userid = req.params.userid;
    let color = req.body.value;
    let oldDetailedEmotions = req.body.emotions;
    let reasons = req.body.reasons;
    let journalBody = req.body.journalBody;


    let newDailyLog = new DailyLog({
      owner: userid,
      journalBody: journalBody,
      oldDetailedEmotions: oldDetailedEmotions,
      emotionColor: color,
      reasons: reasons,
      creationTime: new Date()
    });

    newDailyLog.save(err => error=err);



    //sorting all emotions into the big 5
    oldDetailedEmotions.forEach(emotion => {
      _.forEach(emotionInfo, bigEmotion => {
        if(bigEmotion.items.includes(emotion.name)) {
          bigEmotion.sum += emotion.intensity
        }
      })
    });

    //average for each of the big 5
    emotionInfo.forEach(emotion => {
      emotion.average = emotion.sum / emotion.items.length
    });

    //sort emotionInfo by highest average (highest = most experienced emotion)
    emotionInfo.sort((a, b) => (b.average - a.average));
    let e1=emotionInfo[0].name;
    let e2=emotionInfo[1].name;


    if (e1 === 'happy'){
      User.findById(userid)
      .then(user=> {
        user.currentEmotionColor = color
        user.save()
        res.json('you are happy you donut need our help!');
      })
    }else{
      let suggestionsByOwner = [];

      //setting this person's suggestions to suggestionsByOwner
      User.findById(userid)
      .then(user=> {
        user.currentEmotionColor = color
        user.save()
        suggestionsByOwner = user.suggestions;
        let suggestionsByEmotion = suggestionsByOwner.filter(function(suggestion){
          return suggestion.tags.includes(e1) || suggestion.tags.includes(e2);
        });
        suggestionsByEmotion.sort((a,b) => b.score - a.score);
        if (error){
          res.json({"error": error});
        }else{
          suggestionsByEmotion = suggestionsByEmotion.map((sug)=> {
            return {
              name: sug.name,
              description: sug.description
            }
          });
          let topRecs = suggestionsByEmotion.slice(0,3)
          res.json({
            suggestion: topRecs
          });
        }
      }).catch (err=> error= err);
    }
  });





  /**

  FRIEND STUFF

  **/

  app.post('/:userid/friendRequestSend', (req, res) => {
    User.findOne({username: req.body.username})
    .then((result) => {
      User.requestFriend(req.params.userid, result._id)
    })
    .then(() => {
      res.json({"status": 200})
      console.log('sent!')
    })
    .catch(err => console.log(err))
  })


app.post('/:userid/friendRequestAccept', (req, res) => {
  User.requestFriend(req.params.userid, req.body.id)
  res.json({"status": 200})
  // .then(() => res.json({"status": 200}))
  // .catch((err) => console.log(err))
})

//Don't use the library!
app.get('/:userid/getFriends', (req, res) => {
  User.findById(req.params.userid, {friends: 1})
  .then((result) => {
    let friendArr = [];
    // result.friends.forEach(friend => {
    //   friend.status === 'accepted' ?
    //   User.findById(friend._id)
    //   .then(result => {
    //     name = result.name
    //     id = friend._id
    //     return id
    //   })
    //   .then((id) => {
    //     DailyLog.find({owner: id})
    //   })
    //   .then(results => {
    //     if (results){
    //       emo = results[results.length-1].emotionColor
    //     }
    //     return
    //   })
    //   .then(() => {
    //     friendArr.push({
    //       id: id,
    //       name: name,
    //       emo: emo
    //     })
    //   })
    //   .catch(err => console.log(err))
    //    : null
    // })
    // res.json({"friends": friendArr})
    let accepted = _.filter(result.friends, friend => friend.status === 'accepted')
    Promise.all(accepted.map(friend => User.findById(friend._id)))
    .then(results => {
      results.forEach(friend => {
        friendArr.push({
          name: friend.name,
          id: friend._id,
          emo: friend.currentEmotionColor
        })
      })
      return friendArr
    })
    .then(Arr => res.json(Arr))
    .catch(err => console.log(err))
  }).catch((err) => {
    console.log(err)
    res.json({"status": 400})
  })
})



app.get('/:userid/getPending', (req, res) => {
  let friendArr = [];
  User.findById(req.params.userid, {friends: 1})
  .then((result) => {
    // let name = '';
    // let id = '';
    // result.friends.forEach(friend => {
    //   friend.status === 'pending' ?
    //   User.findById(friend._id)
    //   .then(result => {
    //     name = result.name
    //     id = friend._id
    //     friendArr.push({
    //       id: id,
    //       name: name,
    //     })
    //   })
    //   .catch(err => console.log(err))
    //    : friendArr = [];
    // })
    //
    // res.json({"pending": friendArr})
  let filtered =  _.filter(result.friends, friend => friend.status === 'pending')
  return filtered
  })
  .then((arr) => {
    return Promise.all(arr.map(friend => {
      return User.findById(friend._id)
    }))
  })//result of Promise.all is undefined
  .then(result => {
    result.forEach(friend => {
      friendArr.push({
        id: friend._id,
        name: friend.name
      })
    })
    return friendArr
  })
  .then(result => {
    res.json(result)
  })
  .catch((err) => {
    console.log(err.message)
    res.json({"status": 400})
  })
})


app.post('/:userid/removeFriend', (req, res) => {
  User.findById(req.body.id, {friends: 1})
  .then(result => {
    result.friends = _.reject(result.friends.slice(), (friend) => friend.id === req.params.userid);
    result.save()
    return User.findById(req.params.userid, {friends: 1})
  })
  .then(result => {
    result.friends = _.reject(result.friends.slice(), (friend) => friend.id === req.body.id);
    result.save()
    res.json({"status": 200});
  })
  .catch(err => console.log(err))
})

var port = process.env.PORT || 3000;
console.log('Server running at http://localhost:%d/', port);
app.listen(port);

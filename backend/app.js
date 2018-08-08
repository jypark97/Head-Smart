"use strict";

var _ = require('underscore');
var express = require('express');
var validator = require('express-validator');
var app=express();
var mongoose= require('mongoose');
var Models = require('./models');
var User = Models.User;
var DailyLog = Models.DailyLog;
var initialSuggestions = require('./initialSuggestions').initialSuggestions;
var emotionInfo = require('./emotionInfo').emotionInfo;


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

/**
------------------HELPER FUNCTIONS --------------
**/
var hashPassword = (password) => (password + process.env.SECRETHASH );

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
    let highest = 0;
    let name = '';
    user.suggestions.forEach(sug => {
      if(sug.count > highest){
        console.log('high count is -------' + sug.count)
        console.log('high count is -------' + sug.name)
        highest = sug.count;
        name = sug.name;
      }
    })
    return name;
  }).catch(err => console.log (err));
}



//most frequent detailed emotions
var getTopEmos = (userId) => {
  console.log('in top emos')
  return DailyLog.find({
    owner: userId
  })
  .then(logs => {
    let emos = [];
    logs.forEach(log => {
      emos.concat(log.oldDetailedEmotions.name)
    })
    console.log('emos array is -----------' + emos)
    let counter = {}
    emos.forEach(function(word) {
      counter[word] = (counter[word] || 0) + 1;
    });
    console.log('counter object is ---------------' + counter)
    emos.sort(function(x, y) {
      return counter[y] - counter[x];
    });
    let uniqueEmos = _.unique(emos, true)
    console.log('unique emos is ---------------' + uniqueEmos)
    var topEmos = uniqueEmos.slice(0, 5);
    return topEmos;
  }).catch(err => console.log (err));
}
/**



**/
//most frequent reasons
var getTopReasons = (userId) => {
  console.log('in top reaons')
  return DailyLog.find({
    owner: userId
  })
  .then(logs => {
    let reasons = [];
    logs.forEach(log => {
      reasons.concat(log.reasons)
    })
    let counter = {}
    reasons.forEach(function(word) {
      counter[word] = (counter[word] || 0) + 1;
    });
    reasons.sort(function(x, y) {
      return counter[y] - counter[x];
    });
    let uniqueReasons = _.unique(reasons, true);
    let topReasons = uniqueReasons.slice(0, 5);
    return topReasons;
  }).catch(err => console.log (err));
}
/**


**/
//most productive activity
var getMostProductiveActivity = (userId) => {
  console.log('in most productive')
  let suggestions= [];
  return User.findById(userId)
  .then(result => {
    let sug = result.suggestions;
    sug.forEach(suggestion => {
      suggestions.push ({
        name: suggestion.name,
        avgDelta: 0,
        count: 0
      });
    });
    return suggestions;
  }).then(suggestions => {
    let happyBlock = emotionInfo[emotionInfo.length-1];
    DailyLog.find({owner: userId})
    .then(results => {
      results.forEach(log => {
        let oldHappySum = 0;
        let oldNegSum = 0;
        let oldDelta = 0;
        let newHappySum = 0;
        let newNegSum = 0;
        let newDelta = 0;
        let ULTIMATE_DELTA = 0;
        log.oldDetailedEmotions.forEach(emotion => {
          if (happyBlock.items.includes(emotion)){
            happySum += emotion.intensity;
          }else{
            negSum += emotion.intensity;
          }
        })

        log.newDetailedEmotions.forEach(emotion => {
          if (happyBlock.items.includes(emotion)){
            happySum += emotion.intensity;
          }else{
            negSum += emotion.intensity;
          }
        })

        oldDelta = oldHappySum - oldNegSum;
        newDelta = newHappySum - newNegSum;
        ULTIMATE_DELTA = newDelta - oldDelta;

        console.log("suggestions here is " + suggestions);

        let oldAvg = suggestions[log.name].avgDelta * suggestions[log.name].count;
        suggestions[log.name].count++;
        suggestions[log.name].avgDelta = ((oldAvg + ULTIMATE_DELTA) / suggestions[log.name].count);
        console.log("average is " + suggestions[log.name].avgDelta);
      })
    })

    suggestions.sort((a,b) => b.avgDelta - a.avgDelta);
    console.log('most productive activity', suggestions[0].name);
    return suggestions[0].name;

  }).catch(err => console.log({"error": err}));
}

/**
---------------END HELPER FUNCTIONS --------------
**/


app.get('/', function(req, res){
  res.send('hello');
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
        suggestions: initialSuggestions,
        friends: []
      });

      newUser.save()
      .then(result => {
        console.log(result);
        res.json(result);
      })
      .catch(err => res.status(400).json({"error":err}));
    }
    else {
      res.json({"error": 'username is already taken!'});
    }

  }).catch(err=> res.json({"error": err}));
});


app.post('/login', (req, res)=> {
  let username = req.body.username;
  let password = req.body.password;

  User.findOne({username: username})
  .then(result=> {
    if (result.password === hashPassword(password)){
      console.log('id', result._id);
      res.json({"userid": result._id});
    }
  })
  .catch(err => res.status(400).json({"error": err}));
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
  console.log('in showlog backend')
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

  console.log('in stats')

  res.json({
    mostProductiveActivity: await getMostProductiveActivity(userid),
    totalLogs: await getLogCount(userid),
    topEmotions: await getTopEmos(userid),
    topReasons: await getTopReasons(userid),
    mostUsedSuggestion: await getMostUsedSuggestion(userid)
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
    console.log(sugs)
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
          console.log('sug that was used is ----------' + sug.name + completedSuggestion)
          let oldAverage = Number(sug.count) * Number(sug.score);
          let newCount = Number(sug.count)+1;
          let newScore = ((Number (oldAverage) + Number(req.body.score))/newCount);
          console.log('old average is ----' + oldAverage + 'new count is ----' + newCount + 'newScore is ----' + newScore)
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

  //
  // app.post('/:userid/addJournal', (req, res)=> {
  //   let journalBody = req.body.journalBody;
  //   DailyLog.find({
  //     owner: req.params.userid
  //   })
  //   .then(results => {
  //     results[results.length-1].journalBody = journalBody;
  //     results[results.length-1].save()
  //     res.json({"status": 200});
  //   }).catch(err=> res.json({"error": err}));
  // });


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
      res.json('you are happy you donut need our help!');
    }else{
      let suggestionsByOwner = [];

      //setting this person's suggestions to suggestionsByOwner
      User.findById(userid)
      .then(user=> {
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
    User.findOne({name: req.body.name, phoneNumber: req.body.phoneNumber})
    .then((result) => User.requestFriend(req.params.userid, result._id))
    .then(() => {
      res.json({"status": 200})
      console.log('sent!')
    })
  })


app.post('/:userid/friendRequestAccept', (req, res) => {
  User.findOne({username: req.body.username})
.then((result) => {
  User.requestFriend(req.params.userid, result._id)})
  .then(() => res.json("request sent"))
 .catch((err) => console.log(err))
})

app.get('/:userid/getFriends', (req, res) => {
  User.findById(req.params.userid)
  .then((result) => {
    result.getAcceptedFriends()})
  .then((result) => {
  }).catch((err) => console.log(err))
})






app.post('/:userid/removeFriend', (req, res) => {
  User.removeFriend(req.params.userid, req.body.friendId)
  .then((doc) => res.json({"friend": doc}))
  .catch(err => res.json({"error": err}))
})

var port = process.env.PORT || 3000;
console.log('Server running at http://localhost:%d/', port);
app.listen(port);

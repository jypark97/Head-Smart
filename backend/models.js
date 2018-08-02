var mongoose = require('mongoose');
var connect = process.env.MONGODB_URI;
mongoose.connect(connect);
var friends = require('mongoose-friends');

var userSchema = mongoose.Schema({
  name: String,
  phoneNumber: String,
  email: String,
  username: String,
  password: String,
  currentEmotionColor: {
    type: Number,
    public: Boolean
  },                              //will have same value as most recent Emotion Color
  suggestions: [{
    name: String,
    description: String,
    count: Number,
    score: Number,
    tags: []
  }],                             //will be filled with Suggestion objects
  friends: []                      //will be filled with Friend objects (that contain User objects)
});

userSchema.plugin(friends());
var User = mongoose.model('User', userSchema);


var dailyLogSchema = mongoose.Schema({
  owner: {
    type: mongoose.Schema.ObjectId,
    required: true,
    ref: "User"
  },                             //User who owns this log
  journalBody: String,
  emotionColor: Number,
  reasons: [],
  newDetailedEmotions: [{
    name: String,
    intensity: Number
  }],
  oldDetailedEmotions: [{
    name: String,
    intensity: Number
  }],                           //will be filled with objects for each emotion (name, intensity)
  completedSuggestion: String,
  creationTime: Date
});

var DailyLog = mongoose.model('DailyLog', dailyLogSchema);



var models = {
  User: User,
  DailyLog: DailyLog
};

module.exports = models;

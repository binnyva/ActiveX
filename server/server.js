const express = require('express');
const app = express();
const Promise = require('bluebird');
const moment = require('moment');

const MongoClient = require('mongodb').MongoClient;
// var ObjectId = require('mongodb').ObjectID;

var db;
//var connect = Promise.promisify(MongoClient.connect);
//connect('mongodb://localhost:27017/ActiveX').then(main, handleError);
MongoClient.connect('mongodb://localhost:27017/ActiveX', main);

app.set('view engine', 'ejs');
app.set('view options', { open: '<?', close: '?>', delimiter: '?'});
app.use(express.static('client/public'));
app.use(express.static('node_modules/'));

hide_words = ['smplayer', '9gag', 'vlc', 'overwatch'];

function main(err, database) {
	if(err) return handleError(err);
	db = database;

	app.listen(3001, function() {
	  console.log('listening on 3001')
	});


	app.get('/', function(req, res) {
		require('./index.js').main(req, res, app, db, moment);
	});
}

// Error handling from everywhere.
function handleError(err) {
	if (err) {
		console.log(err);
		if(db) db.close();
		return false;
	}
	return true;
}

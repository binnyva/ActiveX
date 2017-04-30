const ObjectId = require('mongodb').ObjectID;
var sync = require('synchronize');

console.log("Index");

var snapshots = [];
function main(req, res, app, db, moment) {
	var full_disclosure = (typeof req.query.full_disclosure != "undefined") ? req.query.full_disclosure : true;
	var date_raw = (typeof req.query.date != "undefined") ? req.query.date : false;
	var date = moment();
	if(date_raw) date = moment(date_raw);

	var where = {taken_at: {$gte: date.startOf('day').toDate(), $lt: date.endOf('day').toDate()}};
	var query = db.collection('Snapshot').find(where).sort({'taken_at': -1});

	sync.fiber(function() {
		var result = sync.await(query.toArray(sync.defer())); // This await/defer syntax will make this code syncronomous. Otherwise, callback hell.

	 	for(var i=0; i<result.length; i++) {
			var windows = sync.await(db.collection('SnapshotWindow').find({snapshot: ObjectId(result[i]._id)}).toArray(sync.defer()));
			result[i].windows = windows;
		}

		res.render('layout/page.ejs', {
			snapshots: result,
			moment: moment, 
			date: date,
			full_disclosure: full_disclosure,
			view: 'index.ejs', 
			config: {'site_url': '', site_title: "ActiveX", 'site_home': '/'}
		});
	});
}
module.exports.main = main;


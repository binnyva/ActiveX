const ObjectId = require('mongodb').ObjectID;
//var sync = require('synchronize');

console.log("Index");

var snapshots = [];
async function main(req, res, app, db, moment) {
	var full_disclosure = (typeof req.query.full_disclosure != "undefined") ? req.query.full_disclosure : true;
	var date_raw = (typeof req.query.date != "undefined") ? req.query.date : false;
	var date = moment();
	if(date_raw) date = moment(date_raw);

	var where = {taken_at: {$gte: date.startOf('day').toDate(), $lt: date.endOf('day').toDate()}};
	var query = db.collection('Snapshot').find(where).sort({'taken_at': 1});

	console.log(`Finding data on ${date_raw} `, where);

	var response = await query.toArray(); // This await/defer syntax will make this code syncronomous. Otherwise, callback hell.
	if(response.err) throw response.err;
	else {
		var result = response;
		console.log(`Got ${result.length} snapshots`);
	 	for(var i=0; i<result.length; i++) {
			var windows = await db.collection('SnapshotWindow').find({snapshot: ObjectId(result[i]._id)}).toArray();
			// console.log(`Got ${windows.length} windows`);
			result[i].windows = windows;
		}

		res.render('layout/page.ejs', {
			snapshots: result,
			moment: moment, 
			date: date,
			full_disclosure: full_disclosure,
			view: 'index.ejs', 
			res: res,
			config: {'site_url': '', site_title: "ActiveX", 'site_home': '/'}
		});
	}
	
	return true;
}
module.exports.main = main;

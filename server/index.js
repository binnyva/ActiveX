console.log("Index");

function main(req, res, app, db, moment) {
	var full_disclosure = (typeof req.query.full_disclosure != "undefined") ? req.query.full_disclosure : false;
	var date_raw = (typeof req.query.date != "undefined") ? req.query.date : false;
	var date = moment();
	if(date_raw) date = moment(date_raw);

	var where = {taken_at: {$gte: date.startOf('day').toDate(), $lt: date.endOf('day').toDate()}};

	db.collection('Snapshot').find(where).sort({'taken_at': -1}).limit(50).toArray(function(err, result) {
		res.render('layout/page.ejs', {
			snapshots: result,
			moment: moment, 
			date: date,
			full_disclosure: full_disclosure,
			view: 'index.ejs', 
			config: {'site_url': '', site_title: "ActiveX", 'site_home': '/'}});
	});
}

module.exports.main = main;
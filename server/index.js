console.log("Index");

function main(res, db, moment, app) {
	db.collection('Snapshot').find().sort({'taken_at': -1}).limit(50).toArray(function(err, result) {
		res.render('layout/page.ejs', {snapshots: result, moment: moment, view: 'index.ejs', config: {'site_url': '', site_title: "ActiveX", 'site_home': '/'}});
	});
}

module.exports.main = main;
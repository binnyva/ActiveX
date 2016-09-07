const Promise = require('bluebird');
var exec = Promise.promisify(require('child_process').exec);

var mongodb = require('mongodb');
var MongoClient = mongodb.MongoClient;
var ObjectID = require('mongodb').ObjectID;
var db;
var connect = Promise.promisify(MongoClient.connect);
connect('mongodb://localhost:27017/ActiveX').then(main, handleError);

var active_window;

function main(database) {
	db = database;

	exec("xdotool getwindowfocus getwindowname").then(function (stdout, stderr) { 
		active_window = stdout.trim();

		exec('wmctrl -l').then(getAllWindows).catch(handleError);

	}).catch(handleError);
}

function getAllWindows(stdout, stderr) {
	var lines = stdout.split("\n");
	var active_window_data, all_windows = [];

	for(var i=0; i<lines.length; i++) {
		var matches = lines[i].match(/0x\w+\s+(-?\d+)\s+[\w\-]+\s*(.*)/);

		if(!matches || matches[1] == "-1") continue; // Background processes

		var window = matches[2];
		var desktop = matches[1];

		var parts = window.split(/\s+[\-\–]\s+/);
		var app, title;

		if(parts.length == 2) {
			title = parts[0];
			app = parts[1];

		} else if(parts.length > 2) {
			app = parts[parts.length - 1];
			title = parts.slice(0, -1).join(" - ");
		} else {
			title = matches[2];
			app = '';
		}

		var active = false;
		if(matches[2] == active_window) {
			active = true;
			active_window_data = {
				"active_window": window,
				"software": app,
				"title": title,
				"active_desktop": desktop,
			}
		}

		var window_data = {
			"window": window,
			"software": app,
			"title": title,
			"desktop": desktop,
			"active": active
		};
		all_windows.push(window_data);
	}

	// Insert active window
	var snapshot = active_window_data;
	snapshot._id = new ObjectID();
	snapshot.taken_at = new Date();
	snapshot.tags = [];

	var snapshot_collection = db.collection("Snapshot");
	snapshot_collection.insertOne(snapshot, {}).then(function() {
		// Go thru all windows
		var snapshot_window = db.collection("SnapshotWindow");
		for(var i = 0; i < all_windows.length; i++) {
			all_windows[i]._id = new ObjectID();
			all_windows[i].snapshot = snapshot._id;
		}
		
		// Insert all - with insert id of the active windows
		snapshot_window.insertMany(all_windows, {}).then(allDone).catch(handleError);
	}).catch(handleError);
}

function allDone() {
	db.close();
}

function handleError(err) {
	if (err) {
		console.log('Error: '+ err);
		db.close();
		return false;
	}
	return true;
}


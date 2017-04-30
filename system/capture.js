const Promise = require('bluebird');
var exec = Promise.promisify(require('child_process').exec);

var mongodb = require('mongodb');
var MongoClient = mongodb.MongoClient;
var ObjectID = require('mongodb').ObjectID;
var db;
var connect = Promise.promisify(MongoClient.connect);
connect('mongodb://localhost:27017/ActiveX').then(main, handleError);

var active_window, tty = 'terminal';

function main(database) {
	db = database;

	exec("cat /sys/class/tty/tty0/active").then(function(stdout, stderr) {
		var active_tty = stdout.trim();
		if(active_tty == 'tty7') tty = 'gui';

		exec("xdotool getwindowfocus getwindowname").then(function (stdout, stderr) { 
			active_window = stdout.trim();

			exec('wmctrl -l').then(getAllWindows).catch(handleError);
		}).catch(handleError);
	}).catch(handleError);
}

function getAllWindows(stdout, stderr) {
	var lines = stdout.split("\n");
	var active_window_data, all_windows = [];

	for(var i=0; i<lines.length; i++) {
		// Example...
		// Something   Dekstop  Machine  Title 
		// 0x02600177 -1 binnyva-desktop plasma-desktop
		// 0x05600072  0 binnyva-desktop Assign Teachers to 'Sunday 04:00 PM' Batch - Mozilla Firefox
		// 0x06200002  0 binnyva-desktop ActiveX - Google Chrome
		// 0x06800015  3 binnyva-desktop Tiker – Konqueror
		// 0x06a00b89  0 binnyva-desktop /mnt/x/Data/www/Projects/ActiveX/system/capture.js - Sublime Text (UNREGISTERED)
		// 0x06c0001a  0 binnyva-desktop ActiveX : nodejs – Konsole
		// 0x06c00038  0 binnyva-desktop server : bash – Konsole

		var matches = lines[i].match(/0x\w+\s+(-?\d+)\s+[\w\-]+\s*(.*)/);

		if(!matches || matches[1] == "-1") continue; // Background processes

		var window = matches[2];
		var desktop = matches[1];
		if(tty == 'terminal') desktop = -1; // If we have left the system, it must be in terminal mode. Mark desktop as negative. 

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

	console.log(snapshot);

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


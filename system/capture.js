const Promise = require('bluebird');
var exec = Promise.promisify(require('child_process').exec);
//  var sync = require('synchronize');

var mongodb = require('mongodb');
var MongoClient = mongodb.MongoClient;
var ObjectID = require('mongodb').ObjectID;
var db;
var connect = Promise.promisify(MongoClient.connect);
connect('mongodb://localhost:27017/ActiveX').then(main, handleError);

var active_window, tty = 'terminal';
var ruleset = require("../config/ruleset.json");

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

	var concentration_details = [];
	var concentration_score = 5; // Default sore is 5.

	for (var index in ruleset) {
		var rule = ruleset[index];
		var score = matchSoftware(rule, snapshot, all_windows);
		if(score) {
			concentration_details.push(index + ": " + score);
			concentration_score += Number(score);
		}
	}

	// Score should be 1-10
	if(concentration_score > 10) concentration_score = 10;
	else if(concentration_score < 1) concentration_score = 1;

	snapshot.concentration = concentration_score;

	// Figure out the daily average for concentration
	var start = new Date(); start.setHours(0,0,0,0);
	var end = new Date(); end.setHours(23,59,59,999);
	var where = {taken_at: {$gte: start, $lt: end}}; // All Snapshots for today.
	var query = db.collection('Snapshot').find(where);
	var total_concentration = 0;
	var concentration_snapshot_count = 0;


	query.toArray(function(err, result) {
		if(err) throw err;

	 	for(var i=0; i<result.length; i++) {
	 		var snap = result[i];
			if(snap.active_desktop != -1) {
				total_concentration += snap.concentration;
				concentration_snapshot_count++;
			}
		}

		var factor = 100; // Round till 2 decimals - 10 ^ 2.
		var temp_number = (total_concentration / concentration_snapshot_count) * factor;
		var concentration_avg = Math.round(temp_number) / factor;

		exec("kdialog --passivepopup 'Score : "+concentration_score + "\nDaily Average: "+concentration_avg+"\n" + concentration_details.join("\n") + "' 3");
	});

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
	// allDone();
}

function matchSoftware(rule, snapshot, all_windows) {
	var active_desktop = snapshot.active_desktop;

	// Check active window if we have an active rule
	if(rule.point.hasOwnProperty("active")) {
		var match = isMatchSoftwareAndTitle(snapshot, rule);
		if(match) return rule.point.active;
	}

	// Check other windows.
	if(rule.point.hasOwnProperty("active_desktop") || rule.point.hasOwnProperty("other_desktop")) {
		for(var j=0; j<all_windows.length; j++) { // Go thur each window in the open list.
			var window = all_windows[j];
			var match = isMatchSoftwareAndTitle(window, rule);
			if(match) {
				// We have a software that matches the software in the rule - and it is on the active desktop
				if(rule.point.hasOwnProperty("active_desktop") && window.desktop == active_desktop) {
					return rule.point.active_desktop;
				}

				// Software that matches the software in the rule - and it is NOT on the active desktop
				if(rule.point.hasOwnProperty("other_desktop") && window.desktop != active_desktop) {
					return rule.point.other_desktop;
				}
			}
		}
	}
}

function isMatchSoftwareAndTitle(window, rule) {
	for (var i = 0; i < rule.software.length; i++) { // Go thru all the softwares given in the rule...
		if(window.software.toLowerCase().indexOf(rule.software[i].toLowerCase()) !== -1) { // Got a software match.
			// Since we got a software match, go thru the titles...
			if(rule.title.length == 0) return true; // No title rule.

			// IF there is a title check, the check for title matches
			for (var j = 0; j < rule.title.length; j++) { 
				if(window.title.toLowerCase().indexOf(rule.title[j].toLowerCase()) !== -1) { // Got a title.
					return true;
				}
			}
		}
	}

	return false;
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


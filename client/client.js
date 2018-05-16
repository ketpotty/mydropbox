const fs = require('fs');
const path = require('path');
const watch = require('node-watch');
const mkdirp = require('mkdirp');
const walkSync = (d) => fs.statSync(d).isDirectory() ? fs.readdirSync(d).map(f => walkSync(path.join(d, f))).reduce((a, b) => a.concat(b), []) : d;

const thedir = 'dropbox';
const onlydir = "/home/vagrant/apps/done/mydropbox/client/dropbox";

// ------------------------------------------------------------
// client.js - base code copyied from https://www.npmjs.com/package/socket.io-client
// ------------------------------------------------------------
var socket = require('socket.io-client')('http://192.168.10.2:3000');

var fnQueue = [];
var syncTimeout = null;
var queueItem = null;

var dowatch = true;

/**
 * Start sync for the queue
 */
function startSync() {
	if (fnQueue.length == 0) {
		return;
	};
	if (queueItem != null) {
		return setTimeout(startSync, 1000);
	}
	queueItem = fnQueue.shift();
	//console.log((new Date()).toISOString() + ' - ' + queueItem.filename);

	fs.stat(queueItem.filename, (err, stat) => {
		//console.log("Deleted", queueItem.filename);
		if (err) {
			if (err.errno != -2) {
				console.error(err);
				// the rest is silence... :)
				queueItem = null;
				return setTimeout(startSync, 0);
			}
			console.log((new Date()).toISOString() + ' - Deleted ' + queueItem.filename);
			socket.emit('delete', {
				filename: queueItem.filename.replace(thedir + '/', '')
			});
			queueItem = null;
			return setTimeout(startSync, 0);
		};
		
		//console.log("Modified", queueItem.filename);
		fs.readFile(queueItem.filename, (err, filecontent) => {
			if (err) {
				console.error(err);
				// the rest is silence... :)
				queueItem = null;
				return setTimeout(startSync, 0);
			};
			console.log((new Date()).toISOString() + ' - Modified ' + queueItem.filename);
			socket.emit('mod', {
				filename: queueItem.filename.replace(thedir + '/', ''),
				content: filecontent
			});
			queueItem = null;
			return setTimeout(startSync, 0);
		});
	});
};

function initialSync() {
	var hasfiles = walkSync(thedir);
	socket.emit('initsync', {
		files: hasfiles.map(e => e.substr(thedir.length + 1))
	});
	// hasfiles.map(e => addItem(e)) rövidebben (fancy :) hasfiles.map(addItem)
	hasfiles.map(addItem);
};

/**
 * Main watch
 */
function addItem(filename) {
	if (fnQueue.filter(e => (e.filename == filename)).length > 0) {
		return;
	};

	fnQueue.push({
		filename: filename
	});
	
	if (syncTimeout !== null) {
		clearTimeout(syncTimeout);
	};
	
	syncTimeout = setTimeout(startSync, 200);
};

watch(thedir, {recursive: true}, (et, filename) => {
	if (dowatch) {
		addItem(filename);
	};
});


// ------------------------------------------------------------
socket.on('connect', function(){
	console.log("Connected");
});

socket.once('connect', function(){
	console.log("Initial sync starting...");
	initialSync();
});

socket.on('save', function(data){
	//console.log((new Date()).toISOString() + ' - Save ', data);
	var filename = thedir + '/' + data.filename;
	var filerel = path.resolve(filename);
	// ensure dir
	if (filerel.substr(0, onlydir.length) != onlydir) {
		return console.log("NONONONONO!");
	};
	dowatch = false;
	mkdirp(path.dirname(filerel), function (err) {
		if (err != null && err.errno != -17) {
			return console.error(err);
		};
		//console.log("Debug before writeFile: ", filename, queueItem);
		fs.writeFile(filename, data.content, (err) => {
			dowatch = true;
			if (err != null && err.errno != -17) {
				return console.error(err);
			};
			// file write done
			return console.log((new Date()).toISOString() + ' - ' + filename + ' successfully written');
		});
	});
});

socket.on('disconnect', function(){

});

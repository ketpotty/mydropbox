const fs = require('fs');
const watch = require('node-watch');
const thedir = 'dropbox';

// ------------------------------------------------------------
// client.js - base code copyied from https://www.npmjs.com/package/socket.io-client
// ------------------------------------------------------------
var socket = require('socket.io-client')('http://192.168.10.2:3000');

socket.on('connect', function(){
	console.log("Connected");
});

/*
socket.on('news', function(data){
	console.log("News: ", data);
	socket.emit('newsres', "random");
});
*/

socket.on('disconnect', function(){

});

var fnQueue = [];
var syncTimeout = null;
var queueItem = null;

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

/**
 * Main watch
 */
watch(thedir, {recursive: true}, (et, filename) => {
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
});

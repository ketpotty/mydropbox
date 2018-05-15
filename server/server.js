const fs = require('fs');
const path = require('path');

var app = require('express')();
var server = require('http').Server(app);
var io = require('socket.io')(server);

const store = 'store';
const onlydir = "/home/vagrant/shared/mydropbox/server/store/";

server.listen(3000);

app.get('/', function (req, res) {
	res.sendfile(__dirname + '/static/index.html');
});

var fnQueue = [];
var queueItem = null;

function processQueue() {
	if (fnQueue.length == 0) {
		return;
	};
	if (queueItem != null) {
		return setTimeout(processQueue, 50);
	};

	var end = function () {
		queueItem = null;
		return setTimeout(processQueue);
	};

	queueItem = fnQueue.shift();
	console.log((new Date()).toISOString() + ' - processing: ', queueItem);
	// process - mod
	if (queueItem.action == 'mod') {
		fs.writeFile(store + '/' + queueItem.data.filename, queueItem.data.content, (err) => {
			if (err) {
				console.error(err);
				return end();
			};
			// file write done
			return end();
		});	
		return end();
	};
	// process - delete
	if (queueItem.action == 'delete') {
		var filerel = path.resolve(store + '/' + queueItem.data.filename);
		//console.log(filerel);
		if (filerel.substr(0, onlydir.length) != onlydir) {
			return console.log("NONONONONO!");
		};
		fs.unlink(filerel, (err) => {
			if (err) {
				console.error(err);
				return end();
			};
			// file delete done
			return end();
		});
		return end();
	};
	return end();
};

io.on('connection', function (socket) {
	console.log("Client connected");
	//socket.emit('mod', { hello: 'world' });
	socket.on('mod', function (data) {
		console.log(data);
		// rövidített írásmód: data kulcshoz data tartalom fog érkezni :)
		fnQueue.push({
			action: 'mod',
			data
		});
		return setTimeout(processQueue, 0);
	});
	socket.on('delete', function (data) {
		console.log(data);
		fnQueue.push({
			action: 'delete',
			data
		});
		return setTimeout(processQueue, 0);
	});
});

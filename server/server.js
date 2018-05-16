const fs = require('fs');
const path = require('path');
const walkSync = (d) => fs.statSync(d).isDirectory() ? fs.readdirSync(d).map(f => walkSync(path.join(d, f))).reduce((a, b) => a.concat(b), []) : d;
const mkdirp = require('mkdirp');

var app = require('express')();
var server = require('http').Server(app);
var io = require('socket.io')(server);

const store = 'store';
const onlydir = "/home/vagrant/shared/mydropbox/server/store";

app.set('view engine', 'ejs'); 

server.listen(3000);

app.get('/', function (req, res) {
	var params = {
		files: walkSync(store).map(e => e.substr(store.length + 1))
	};
	res.render('index', params);
});

app.get('/dl', function (req, res, next) {
	var filename = __dirname + "/" + store + "/" + req.param('id');
	console.log(filename);
	res.sendFile(filename);
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
	// --------------------------------------------------------
	console.log((new Date()).toISOString() + ' - processing ' + queueItem.action, queueItem.data);
	var filename = store + '/' + queueItem.data.filename;
	var filerel = path.resolve(filename);
	//console.log(filerel);
	// ensure dir
	if (filerel.substr(0, onlydir.length) != onlydir) {
		return console.log("NONONONONO!");
	};
	// process - mod
	if (queueItem.action == 'mod') {
		//console.log("Debug before mkdirp: ", filerel, queueItem);
		mkdirp(path.dirname(filerel), function (err) {
			//console.log("Debug during mkdirp: ", err, queueItem);
			if (err != null && err.errno != -17) {
				console.error(err);
				return end();
			};
			//console.log("Debug before writeFile: ", filename, queueItem);
			fs.writeFile(filename, queueItem.data.content, (err) => {
				if (err != null && err.errno != -17) {
					console.error(err);
					return end();
				};
				// file write done
				return end();
			});	
		});
	};
	// process - delete
	if (queueItem.action == 'delete') {
		fs.unlink(filerel, (err) => {
			if (err) {
				console.error(err);
				return end();
			};
			// file delete done
			return end();
		});
	};
	// process - initsync
	if (queueItem.action == 'initsync') {
		var atserver = walkSync(store).map(e => e.substr(store.length + 1));
		var atclient = queueItem.data.files;
		var needToSync = atserver.filter(e => atclient.indexOf(e) == -1);
		//console.log('Need to sync: ', needToSync);
		needToSync.forEach(function(item) {
			fnQueue.push({
				action: 'sendToClient',
				data: {
					filename: item
				},
				socket: queueItem.socket
			});
		});
		return end();
	};
	// process - sendToClient
	if (queueItem.action == 'sendToClient') {
		fs.readFile(filename, (err, filecontent) => {
			if (err) {
				console.error(err);
				// the rest is silence... :)
				queueItem = null;
				return setTimeout(startSync, 0);
			};
			console.log((new Date()).toISOString() + ' - Sending to client ' + filename);
			queueItem.socket.emit('save', {
				filename: filename.substr(store.length + 1),
				content: filecontent
			});
			return end();
		});
	};
};

io.on('connection', function (socket) {
	console.log("Client connected");
	//socket.emit('mod', { hello: 'world' });
	socket.on('mod', function (data) {
		// rövidített írásmód: data kulcshoz data tartalom fog érkezni :)
		fnQueue.push({
			action: 'mod',
			data,
			socket
		});
		return setTimeout(processQueue, 0);
	});
	socket.on('delete', function (data) {
		fnQueue.push({
			action: 'delete',
			data,
			socket
		});
		return setTimeout(processQueue, 0);
	});
	socket.on('initsync', function(data) {
		fnQueue.push({
			action: 'initsync',
			data,
			socket
		});
		return setTimeout(processQueue, 0);
	});
});

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
	var filename = store + '/' + queueItem.data.filename;
	var filerel = path.resolve(filename);
	if (filerel.substr(0, onlydir.length) != onlydir) {
		return console.log("NONONONONO!");
	};
	console.log((new Date()).toISOString() + ' - processing: ', queueItem);
	// process - mod
	if (queueItem.action == 'mod') {
		// ensure dir
		//console.log("Debug before mkdirp: ", filerel, queueItem);
		mkdirp(path.dirname(filerel), function (err) {
			console.log("Debug during mkdirp: ", err, queueItem);
			if (err != null && err.errno != -17) {
				console.error(err);
				return end();
			};
			console.log("Debug before writeFile: ", filename, queueItem);
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
	};
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

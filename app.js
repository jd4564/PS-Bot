var WebSocket = require('ws');
var fs = require('fs');
require('sugar');
global.sqlite3 = require('sqlite3');
try {
	global.Config = require('./config/config.js');
} catch (err) {
	if (err.code !== 'MODULE_NOT_FOUND') throw err;
	fs.writeFileSync('config/config.js', fs.readFileSync('config/config-example.js'));
	return console.log("Please edit config/config.js before running the bot");
}
if (Config.servers['exampleserver']) return console.log("Please edit config/config.js before running the bot");
global.Parser = require('./parser.js');
global.Servers = {};

if (Config.watchconfig) {
	fs.watchFile('config/config.js', function (curr, prev) {
		if (curr.mtime <= prev.mtime) return;
		try {
			delete require.cache[require.resolve('./config/config.js')];
			global.Config = require('./config/config.js');
			console.log('Reloaded config/config.js');
		} catch (e) {}
	});
}

global.toId = function (text) {
	return text.toLowerCase().replace(/[^a-z0-9]+/g, '');
};

global.sanitize = function (message) {
	if (message.charAt(0) === '/') message = '/' + message;
	if (message.charAt(0) === '!' || message.substr(0, 2) === '>>') message = ' ' + message;
	return message;
};

for (var server in Config.servers) {
	for (var room in Config.servers[server].rooms) {
		Config.servers[server].rooms[room] = toId(Config.servers[server].rooms[room]);
	}
	for (var room in Config.servers[server].privaterooms) {
		Config.servers[server].privaterooms[room] = toId(Config.servers[server].privaterooms[room]);
	}
}


var Server = (function () {
	function Server(server) {
		for (var u in server) this[u] = server[u];
		var self = this;
		this.parser = new Parser(server.id);
		this.roomList = {'official': [], 'chat': []};
		this.connected = false;
		this.joinedRooms = false;

		this.connection = new WebSocket('ws://' + this.ip + ':' + this.port + '/showdown/websocket');

		this.connection.on('open', function () {
			log('Connected to ' + self.id, self.id);
			console.log('Connected to ' + self.id);
			self.connected = true;
		});

		this.connection.on('error', function (error) {
			log('Error: ' + error, self.id, true);
		});

		this.connection.on('message', function (data) {
			log('> [' + self.id + '] ' + data, self.id);
			var roomid = 'lobby';
			if (data.charAt(0) === '>') {
				roomid = data.substr(1, data.indexOf('\n') - 1);
				data = data.substr(data.indexOf('\n') + 1, data.length);
			}
			if (roomid.substr(0, 6) === 'battle') {
				var split = data.split('\n');
				for (var line in split) {
					self.parser.parse(roomid, split[line], Servers[self.id]);
				}
				return;
			}
			self.parser.parse(roomid, data, Servers[self.id]);
		});

		this.connection.on('close', function (code, message) {
			console.log('Disconnected from ' + self.id + ': ' + code);
			if (self.disconnecting) return;
			log('Connection lost to ' + self.id + ': ' + message, self.id);
			delete Servers[self.id];
			if (!self.autoreconnect) return;
			log('Reconnecting to ' + self.id + ' in one minute.', self.id);
			var reconnect = setTimeout(function () {
				connect(self.id);
				clearInterval(reconnect);
			}, 60 * 1000);
		});

		if (server.ping) { // this is needed to stay connected to tbt and I'm not sure why
			this.ping = setInterval(function () {
				if (!self.connected) return clearInterval(self.ping);
				self.connection.ping();
			}, server.ping);
		}
	}

	Server.prototype.lastMessageTime = 0;
	Server.prototype.chatQueue = [];

	Server.prototype.send = function (message, room) {
		if (!this.connected) return false;
		var self = this;
		if ((Date.now() - this.lastMessageTime) < 600) {
			if (this.chatQueue.length < 1) {
				this.processingChatQueue = setInterval(function () {
					self.processChatQueue();
				}, 600);
			}
			return this.chatQueue.push([message, room]);
		}
		if (!room) room = '';
		try {
			this.connection.send(room + '|' + message);
		} catch (e) {
			log('Sending "' + room + '|' + message + '" crashed: ' + e.stack, this.id);
		}
		this.lastMessageTime = Date.now();
		log('> [' + this.id + '] ' + (room !== '' ? '[' + room + '] ' : '[] ') + message, self.id);
	};

	Server.prototype.processChatQueue = function () {
		if (this.chatQueue.length < 1 || (Date.now() - this.lastMessageTime) < 600) return;
		this.send(this.chatQueue[0][0], this.chatQueue[0][1]);
		this.lastMessageTime = Date.now();
		this.chatQueue.splice(0, 1);
		if (this.chatQueue.length < 1) clearInterval(this.processingChatQueue);
	};

	return Server;
})();

global.log = function (text, serverid, error) {
	if (error) {
		fs.appendFile('logs/error.txt', '[' + serverid + '] ' + text);
		console.log(text);
	} else if (Config.debug) {
		console.log(text);
	}
	if (Config.log >= 2) fs.appendFile('logs/' + serverid + '.log', text + '\n');
};

function connect(server) {
	if (!Config.servers[server]) return console.log('Server "' + server + '" not found.');
	server = Config.servers[server];
	if (server.disabled) return;
	log('Connecting to ' + server.id + '.', server.id);
	if (Servers[server.id]) return log('Already connected to ' + server.id + '. Connection aborted.', server.id);
	Servers[server.id] = new Server(server);
	log('Connecting to ' + server.id, server.id);
	console.log('Connecting to ' + server.id);
}
global.connect = connect;

function disconnect(server, reconnect) {
	var serverid = toId(server);
	if (!Servers[serverid]) return log('Not connected to ' + serverid + '.', serverid);
	Servers[serverid].connection.close();
	this.connected = false;
	this.disconnecting = true;
	if (Servers[serverid].ping) clearInterval(Servers[serverid].ping);
	delete Servers[serverid];
	log("Disconnected from " + serverid + ".", serverid);
	if (reconnect) connect(serverid);
}
global.disconnect = disconnect;

var count = 0;
var connectTimer = setInterval(function () {
	if (!Object.keys(Config.servers)[count]) return clearInterval(connectTimer);
	connect(Object.keys(Config.servers)[count]);
	count++;
}, 5000); // this delay is to avoid problems logging into multiple servers so quickly


/*for (var server in Config.servers) {
	if (Config.servers[server].disabled) continue;
	connect(Config.servers[server]);
}*/



/*
 * static web server for displaying chat logs with the viewlogs command.
 */

var nodestatic = require('node-static');
var staticserver = new nodestatic.Server('./static');
var app = require('http').createServer();
var staticRequestHandler = function (request, response) {
	request.resume();
	request.addListener('end', function () {
		if (/^\/([A-Za-z0-9][A-Za-z0-9-]*)\/?$/.test(request.url)) {
			request.url = '/';
		}
		staticserver.serve(request, response, function (e, res) {
			if (e && (e.status === 404)) {
				staticserver.serveFile('404.html', 404, {}, request, response);
			}
		});
	});
};
app.on('request', staticRequestHandler);
app.listen(Config.webport);

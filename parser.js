var request = require('request');
var fs = require('fs');
global.Commands = require('./commands.js');
fs.readdirSync('./plugins/').forEach(function (file) {
	if (file.substr(-3) === '.js') Object.merge(Commands.commands, require('./plugins/' + file).commands);
});

module.exports = (function () {
	function Parser(serverid) {
		this.serverid = serverid;
	}

	Parser.prototype.parse = function (roomid, data) {
		var server = Servers[this.serverid];
		var parts = data.split('|');
		switch (parts[1]) {
		case 'challstr':
			this.challengekeyid = parts[2];
			this.challenge = parts[3];
			this.login(server.name, server.pass);
			break;
		case 'c:':
			this.parseChat(roomid, parts[3], parts.slice(4).join('|'), '');
			this.logChat(toId(roomid), data);
			updateSeen(parts[3].substr(1, parts[2].length), 'talking', server.id, (~server.privaterooms.indexOf(roomid) ? "a private room" : roomid));
			sendTell(parts[3].substr(1, parts[2].length), server);
			break;
		case 'c':
			this.parseChat(roomid, parts[2], parts.slice(3).join('|'), '');
			this.logChat(toId(roomid), data);
			updateSeen(parts[2].substr(1, parts[2].length), 'talking', server.id, (~server.privaterooms.indexOf(roomid) ? "a private room" : roomid));
			sendTell(parts[2].substr(1, parts[2].length), server);
			break;
		case 'updateuser':
			if (toId(parts[2]) !== toId(server.name)) return;
			server.send('/cmd rooms');
			if (!server.joinedRooms && parts[3] === '1') {
				if (typeof server.rooms === "object") {
					for (var u in server.rooms) server.send('/join ' + server.rooms[u]);
					server.joinedRooms = true;
				}
				for (var i in server.privaterooms) server.send('/join ' + server.privaterooms[i]);
			}
			break;
		case 'pm':
			if (~parts[4].indexOf('/invite') && Commands.hasPermission(parts[2], 'invite')) return server.send('/join ' + parts[4].remove('/invite '));
			this.parseChat(roomid, parts[2], parts.slice(4).join('|'), '/msg ' + parts[2] + ', ');
			sendTell(parts[2].substr(1, parts[2].length), server);
			break;
		case 'join':
		case 'j':
		case 'J':
			updateSeen(parts[2].substr(1, parts[2].length), 'joining', server.id, (~server.privaterooms.indexOf(roomid) ? "a private room" : roomid));
			sendTell(parts[2].substr(1, parts[2].length), server);
			this.logChat(toId(roomid), data);
			break;
		case 'l':
		case 'L':
			updateSeen(parts[2].substr(1, parts[2].length), 'leaving', server.id, (~server.privaterooms.indexOf(roomid) ? "a private room" : roomid));
			this.logChat(toId(roomid), data);
			break;
		case 'raw':
		case 'html':
			this.logChat(toId(roomid), data);
			break;
		case 'queryresponse':
			switch (parts[2]) {
			case 'rooms':
				if (parts[3] === 'null') break;

				var roomData = JSON.parse(parts.slice(3).join('|'));
				server.roomList = {
					'official': [],
					'chat': []
				};
				for (var a in roomData['official']) {
					server.roomList['official'].push(roomData['official'][a].title);
				}
				for (var b in roomData['chat']) {
					server.roomList['chat'].push(roomData['chat'][b].title);
				}
				if (!server.joinedRooms) {
					if (server.rooms === 'all') {
						this.joinAllRooms(true);
						server.joinedRooms = true;
					} else if (server.rooms === 'official') {
						this.joinAllRooms(false);
						server.joinedRooms = true;
					}
				}
				break;
			}
			break;
		default:
			this.logChat(toId(roomid), data);
			break;
		}
	};

	Parser.prototype.joinAllRooms = function (chat) {
		var server = Servers[this.serverid];
		if (!server.roomList) return;
		for (var c in server.roomList.official) {
			server.send('/join ' + server.roomList.official[c]);
		}
		if (chat) {
			for (var d in server.roomList.chat) {
				server.send('/join ' + server.roomList.chat[d]);
			}
		}
	};

	Parser.prototype.parseChat = function (room, user, message, pm) {
		var server = Servers[this.serverid];
		if (!pm) pm = '';
		if (message.charAt(0) === Config.trigger) {
			var command = toId(message.substr(1, (~message.indexOf(' ') ? message.indexOf(' ') : message.length)));
			var target = (~message.indexOf(' ') ? message.substr(message.indexOf(' '), message.length) : '');
			if (Commands.commands[command]) {
				while (typeof Commands.commands[command] !== 'function') {
					command = Commands.commands[command];
				}
				if (typeof Commands.commands[command] === 'function') {
					try {
						Commands.commands[command].call(server, target, room, user, pm);
					} catch (e) {
						server.send(pm + e.stack.substr(0, e.stack.indexOf('\n')), room);
						log(e.stack, server.id, true);
					}
				}
			}
		}
	};

	Parser.prototype.logChat = function (room, data) {
		if (Config.log < 1) return;
		// I'm sure there's a better way to do this instead of a bunch of try-catch
		// but this will work for now
		var date = new Date();
		try {
			fs.statSync('logs/chat');
		} catch (e) {
			fs.mkdirSync('logs/chat', '0755');
		}
		try {
			fs.statSync('logs/chat/' + this.serverid);
		} catch (e) {
			fs.mkdirSync('logs/chat/' + this.serverid, '0755');
		}
		try {
			fs.statSync('logs/chat/' + this.serverid + '/' + room);
		} catch (e) {
			fs.mkdirSync('logs/chat/' + this.serverid + '/' + room, '0755');
		}
		try {
			fs.statSync('logs/chat/' + this.serverid + '/' + room + '/' + date.format('{yyyy}-{MM}'));
		} catch (e) {
			fs.mkdirSync('logs/chat/' + this.serverid + '/' + room + '/' + date.format('{yyyy}-{MM}'), '0755');
		}
		fs.appendFile('logs/chat/' + this.serverid + '/' + room + '/' + date.format('{yyyy}-{MM}') + '/' + date.format('{yyyy}-{MM}-{dd}') + '.txt', data + '\n');
	};

	Parser.prototype.login = function (name, pass) {
		var server = Servers[this.serverid];
		var self = this;
		var options;
		if (pass !== '') {
			options = {
				headers: {
					'content-type': 'application/x-www-form-urlencoded'
				},
				url: 'http://play.pokemonshowdown.com/action.php',
				body: "act=login&name=" + encodeURIComponent(name) + "&pass=" + encodeURIComponent(pass) + "&challengekeyid=" + this.challengekeyid + "&challenge=" + this.challenge
			};
			request.post(options, callback);
		} else {
			options = {
				url: 'http://play.pokemonshowdown.com/action.php?act=getassertion&userid=' + toId(name) + '&challengekeyid=' + this.challengekeyid + '&challenge=' + this.challenge
			};
			request(options, callback);
		}

		function callback(error, response, body) {
			if (body === ';') return log('Failed to log in, name is registered', self.serverid);
			if (body.length < 50) return log('Failed to log in: ' + body, self.serverid);
			if (~body.indexOf('heavy load')) {
				log('Failed to log in - login server is under heavy load. Retrying in one minute.', self.serverid);
				setTimeout(function () {
					self.login(name, pass);
				}, 60 * 1000);
				return;
			}
			if (body.substr(0, 16) === '<!DOCTYPE html>') {
				log('Connection error 522 - retrying in one minute', self.serverid);
				setTimeout(function () {
					self.login(name, pass);
				}, 60 * 1000);
				return;
			}
			try {
				var json = JSON.parse(body.substr(1, body.length));
				if (json.actionsuccess) {
					server.send('/trn ' + name + ',0,' + json['assertion']);
				} else {
					log('Could not log in: ' + JSON.stringify(json), self.serverid);
				}
			} catch (e) {
				server.send('/trn ' + name + ',0,' + body);
			}
		}
	};
	return Parser;
})();

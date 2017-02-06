'use strict';

const https = require('https');
const fs = require('fs');
const querystring = require('querystring');
const moment = require('moment');

let db;

if (Config.mysql) {
	const mysql = require('mysql');
	db = mysql.createConnection({
		host: Config.mysql.host,
		port: Config.mysql.port,
		user: Config.mysql.user,
		password: Config.mysql.password,
	});

	db.connect(function (err) {
		if (err) {
			return console.error('(parser.js) error connecting to mysql server: ' + err.stack);
		}

		db.query('CREATE DATABASE IF NOT EXISTS ' + Config.mysql.dbName + ';', function (error, results, fields) {
			if (error) throw error;
			db.changeUser({database: Config.mysql.dbName}, function (err) {
				if (err) throw err;
				db.query('CREATE TABLE IF NOT EXISTS logs (id INT PRIMARY KEY AUTO_INCREMENT, date BIGINT, server VARCHAR(32), room VARCHAR(100), user VARCHAR(32), userid VARCHAR(19), messageType VARCHAR(20), message TEXT)', function (error, results, fields) {
					if (err) throw err;
				});
			});
		});
	});
}

global.Commands = require('./commands.js');
fs.readdirSync('./plugins/').forEach(function (file) {
	if (file.substr(-3) === '.js') Object.assign(Commands.commands, require('./plugins/' + file).commands);
});

let ranks = [' ', '+', '\u2605', '%', '@', '#', '&', '~', 'admin'];
let permissions = Config.defaultPermissions;

try {
	permissions = JSON.parse(fs.readFileSync('config/permissions.json', 'utf8'));
} catch (e) {
	fs.writeFileSync('config/permissions.json', JSON.stringify(Config.defaultPermissions));
}

module.exports = class Parser {
	constructor(serverid) {
		this.serverid = serverid;
		this.server = Servers[serverid];

		try {
			this.ignoreList = JSON.parse(fs.readFileSync('config/ignore.json', 'utf8'));
			for (let u in this.ignoreList) {
				if (this.ignoreList[u] < Date.now()) delete this.ignoreList[u];
			}
		} catch (e) {
			this.ignoreList = {};
		}
	}

	parse(roomid, data) {
		let server = Servers[this.serverid];
		if (!server) return;
		if (data.charAt(0) !== '|') data = '||' + data;
		let parts = data.split('|');
		switch (parts[1]) {
		case 'challstr':
			this.challenge = parts.splice(2).join('|');
			server.send('/cmd rooms');
			if (server.name !== '') this.login(server.name, server.pass);
			if (server.name === '') {
				if (typeof server.rooms === "object") {
					for (let u in server.rooms) server.send('/join ' + server.rooms[u]);
					server.joinedRooms = true;
				}
			}
			break;
		case 'c:':
			this.parseChat(roomid, parts[3], parts.slice(4).join('|'), '');
			this.logChat(toId(roomid), data);
			if (Tools.updateSeen) Tools.updateSeen(parts[3].substr(1, parts[2].length), 'talking', server.id, (~server.privaterooms.indexOf(roomid) ? "a private room" : roomid));
			if (Tools.sendTell) Tools.sendTell(parts[3].substr(1, parts[2].length), server);
			break;
		case 'c':
			this.parseChat(roomid, parts[2], parts.slice(3).join('|'), '');
			this.logChat(toId(roomid), data);
			if (Tools.updateSeen) Tools.updateSeen(parts[2].substr(1, parts[2].length), 'talking', server.id, (~server.privaterooms.indexOf(roomid) ? "a private room" : roomid));
			if (Tools.sendTell) Tools.sendTell(parts[2].substr(1, parts[2].length), server);
			break;
		case 'updateuser':
			if (toId(parts[2]) !== toId(server.name)) return;
			if (!server.joinedRooms && parts[3] === '1') {
				if (typeof server.rooms === "object") {
					for (let u in server.rooms) server.send('/join ' + server.rooms[u]);
					server.joinedRooms = true;
				}
				for (let i in server.privaterooms) server.send('/join ' + server.privaterooms[i]);
			}
			break;
		case 'pm':
			if (~parts[4].indexOf('/invite')) {
				this.pm = "/msg " + parts[2] + ", ";
				this.user = parts[2];
				this.room = parts[4];
				if (this.can('invite')) {
					return server.send('/join ' + parts[4].substr(8));
				}
			}
			this.parseChat(roomid, parts[2], parts.slice(4).join('|'), '/msg ' + parts[2] + ', ');
			if (Tools.sendTell) Tools.sendTell(parts[2].substr(1, parts[2].length), server);
			break;
		case 'join':
		case 'j':
		case 'J':
			if (Tools.updateSeen) Tools.updateSeen(parts[2].substr(1, parts[2].length), 'joining', server.id, (~server.privaterooms.indexOf(roomid) ? "a private room" : roomid));
			if (Tools.sendTell) Tools.sendTell(parts[2].substr(1, parts[2].length), server);
			this.logChat(toId(roomid), data);
			break;
		case 'l':
		case 'L':
			if (Tools.updateSeen) Tools.updateSeen(parts[2].substr(1, parts[2].length), 'leaving', server.id, (~server.privaterooms.indexOf(roomid) ? "a private room" : roomid));
			this.logChat(toId(roomid), data);
			break;
		case 'raw':
		case 'html':
			if (data.substr(0, 50) !== '<div class="infobox"><div class="infobox-limited">') {
				this.logChat(toId(roomid), data);
			}
			if (data.match(new RegExp(toId(server.name) + "\<\/font\>\<\/b\> has [0-9]+ bucks")) && this.transferAllBucks) {
				let amount = data.match(/[0-9]+ buck/g)[0].replace(/[a-z]/gi, '').trim();
				this.send("/transferbucks " + this.transferAllBucks + ", " + amount);
				delete this.transferAllBucks;
			}
			break;
		case 'popup':
			let message = parts.slice(2).join('|');
			if (message.match(/You were kicked from (.*) by (.*)./)) {
				let kickedRoom = message.replace(/You were kicked from /, '').replace(/\bby(.*)/, '').trim();
				let kicker = message.replace(/You were kicked from (.*) by/, '').trim().slice(0, -1);
				Tools.log('Kicked from ' + kickedRoom + ' by ' + kicker, server.id);
			}
			break;
		case 'queryresponse':
			switch (parts[2]) {
			case 'rooms':
				if (parts[3] === 'null') break;

				let roomData = JSON.parse(parts.slice(3).join('|'));
				server.roomList = {
					'official': [],
					'chat': [],
				};
				for (let a in roomData['official']) {
					server.roomList['official'].push(toId(roomData['official'][a].title));
				}
				for (let b in roomData['chat']) {
					server.roomList['chat'].push(toId(roomData['chat'][b].title));
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
		case 'N':
			if (~data.indexOf('\n')) {
				this.logChat(toId(roomid), parts[1], data.trim());
			}
			if (toId(parts[3]) !== toId(parts[2])) Tools.updateSeen(toId(parts[3]), "changing names to " + parts[2].substr(1), this.serverid, roomid);
			break;
		case 'init':
			Tools.log('Joined "' + roomid + '" on ' + this.serverid, this.serverid);
			break;
		case 'deinit':
			if (server.leaving) {
				server.leaving = false;
			} else if (server.rejoinOnKick && ~server.roomList.official.indexOf(toId(roomid))) {
				Tools.log("Attempting to rejoin " + roomid, server.id);
				server.send('/join ' + roomid);
			}
			break;
		case '':
			this.logChat(toId(roomid), parts.slice(2).join('|'));
			break;
		}
	}

	joinAllRooms(chat) {
		let server = Servers[this.serverid];
		if (!server.roomList) return;
		for (let c in server.roomList.official) {
			server.send('/join ' + server.roomList.official[c]);
		}
		if (chat) {
			for (let d in server.roomList.chat) {
				server.send('/join ' + server.roomList.chat[d]);
			}
		}
	}

	send(message, room) {
		if (!room) room = '';
		Servers[this.serverid].send(message, room);
	}

	sendReply(message) {
		if (!this.can('broadcast')) this.pm = "/msg " + this.user.substr(1) + ", ";
		this.send(this.pm + message, this.room);
	}

	disconnect(reconnect) {
		if (!Servers[this.serverid]) return Tools.log('Not connected to ' + this.serverid + '.', this.serverid);
		Servers[this.serverid].disconnecting = true;
		Servers[this.serverid].connection.close();
		Servers[this.serverid].connected = false;
		if (Servers[this.serverid].ping) clearInterval(Servers[this.serverid].ping);
		delete Servers[this.serverid];
		Tools.log("Disconnected from " + this.serverid + ".", this.serverid);
		if (reconnect) connect(this.serverid);
	}

	can(permission) {
		if (Config.admins.includes(toId(this.user))) return true;
		if (!permissions[permission]) return false;
		if (ranks.indexOf(this.user.charAt(0)) >= ranks.indexOf(permissions[permission])) return true;
		return false;
	}

	parseChat(room, user, message, pm) {
		if (this.ignoreList[toId(user)] && this.ignoreList[toId(user)] < Date.now()) {
			delete this.ignoreList[toId(user)];
			fs.writeFileSync('config/ignore.json', JSON.stringify(this.ignoreList));
		}
		if (this.ignoreList[toId(user)]) return;
		let server = Servers[this.serverid];
		if (!pm) pm = '';
		if (message.charAt(0) === server.trigger && !server.noReply && server.name !== '') {
			let command = toId(message.substr(1, (~message.indexOf(' ') ? message.indexOf(' ') : message.length)));
			let target = (~message.indexOf(' ') ? message.substr(message.indexOf(' '), message.length) : '').trim();

			let commandHandler;
			let curCommands = Commands.commands;

			do {
				if (curCommands[command]) {
					commandHandler = curCommands[command];
				} else {
					commandHandler = undefined;
				}
				if (typeof commandHandler === 'string') {
					// in case someone messed up, don't loop
					commandHandler = curCommands[commandHandler];
				}
				if (commandHandler && typeof commandHandler === 'object') {
					console.log('aaa');
					let spaceIndex = target.indexOf(' ');
					if (spaceIndex > 0) {
						command = target.substr(0, spaceIndex).toLowerCase().trim();
						target = target.substr(spaceIndex + 1);
						commandHandler = commandHandler[command];
						console.log('command1: ' + command);
					} else {
						command = target.toLowerCase().trim();
						target = '';
						console.log('command: ' + command);
						commandHandler = commandHandler[command];
					}
					curCommands = commandHandler;
				}
			} while (commandHandler && typeof commandHandler === 'object');

			if (typeof commandHandler === 'function') {
				try {
					this.pm = pm;
					this.user = user;
					this.room = room;
					commandHandler.call(this, target, room, user, pm);
				} catch (e) {
					server.send(pm + e.stack.substr(0, e.stack.indexOf('\n')), room);
					Tools.log(e.stack, server.id, true);
				}
			}
		}
	}

	logChat(room, data) {
		let server = Servers[this.serverid];
		if (!server.logchat || (server.logchat && typeof server.logchat === 'object' && !server.logchat.includes(room))) return;
		if (!Config.mysql) {
			// I'm sure there's a better way to do this instead of a bunch of try-catch
			// but this will work for now
			let date = new Date();
			let month = moment(date).format('MM-YYYY');
			let fullDate = moment(date).format('DD-MM-YYYY');
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
				fs.statSync('logs/chat/' + this.serverid + '/' + room + '/' + month);
			} catch (e) {
				fs.mkdirSync('logs/chat/' + this.serverid + '/' + room + '/' + month, '0755');
			}
			fs.appendFileSync('logs/chat/' + this.serverid + '/' + room + '/' + month + '/' + fullDate + '.txt', data + '\n');
		} else {
			let user = '';
			let userid = '';
			let message = '';
			if (data.charAt(0) !== '|') data = '||' + data;
			let parts = data.split('|');
			let messageType = parts[1];

			switch (parts[1]) {
			case 'c':
				user = parts[2].substr(1);
				message = parts.slice(3).join('|');
				break;
			case 'c:':
				user = parts[3].substr(1);
				message = parts.slice(4).join('|');
				break;
			case 'L':
			case 'l':
			case 'J':
			case 'j':
				user = parts[2].substr(1);
				break;
			case 'raw':
			case 'html':
				message = parts.slice(2).join('|');
				break;
			}
			if (user !== '') userid = toId(user);
			let query = 'INSERT INTO logs (date, server, room, user, userid, messageType, message) VALUES (' + Date.now() + ', ' + db.escape(this.serverid) +
				', ' + db.escape(room) + ', ' + db.escape(user) + ', "' + userid + '", ' + db.escape(messageType) + ', ' + db.escape(message) + ')';
			db.query(query, function (err) {
				if (err) {
					fs.appendFileSync('logs/error.txt', 'logChat: ' + err + '\n');
					return console.log('logChat: ' + err);
				}
			});
		}
	}

	login(name, pass) {
		Tools.log('Logging in to "' + this.serverid + '" as ' + (name === '' ? 'a guest.' : name + '.'), this.serverid);
		let server = Servers[this.serverid];
		let options;

		if (pass !== '') {
			let postData = querystring.stringify({
				'act': 'login',
				'name': toId(name),
				'pass': encodeURIComponent(pass),
				'challstr': this.challenge,
			});
			options = {
				hostname: 'play.pokemonshowdown.com',
				port: 443,
				path: '/action.php',
				method: 'POST',
				headers: {
					'Content-Type': 'application/x-www-form-urlencoded',
					'Content-Length': Buffer.byteLength(postData),
				},
			};
			let req = https.request(options, res => {
				let data = '';
				res.setEncoding('utf8');
				res.on('data', chunk => {
					data += chunk;
				});
				res.on('end', () => {
					this.finishLogin(data, name, pass, server);
				});
			});

			req.on('error', e => {
				Tools.log('Failed to login to "' + this.serverid + '": ' + e.message, this.serverid, true);
			});

			req.write(postData);
			req.end();
		} else {
			https.get('https://play.pokemonshowdown.com/action.php?act=getassertion&userid=' + toId(name) + '&challstr=' + this.challenge, res => {
				let data = '';

				res.on('data', chunk => {
					data += chunk;
				}).on('end', () => {
					this.finishLogin(data, name, pass, server);
				});
			}).on('error', e => {
				Tools.log('Failed to log in to "' + this.serverid + '": ' + e, this.serverid, true);
			});
		}
	}

	finishLogin(body, name, pass, server) {
		if (body === ';') return Tools.log('Failed to log in to "' + this.serverid + '", name is registered', this.serverid, true);
		if (body.includes('guest')) return Tools.log('Failed to log in to "' + this.serverid + '", invalid password.', this.serverid, true);
		if (body.length < 50) return Tools.log('Failed to log in to "' + this.serverid + '": ' + body, this.serverid, true);
		if (~body.indexOf('heavy load')) {
			Tools.log('Failed to log in to "' + this.serverid + '"- login server is under heavy load. Retrying in one minute.', this.serverid, true);
			setTimeout(() => {
				this.login(name, pass);
			}, 60 * 1000);
			return;
		}
		if (body.substr(0, 16) === '<!DOCTYPE html>') {
			Tools.log('Connection error 522 - retrying in one minute (' + this.serverid + ')', this.serverid, true);
			setTimeout(() => {
				this.login(name, pass);
			}, 60 * 1000);
			return;
		}
		try {
			let json = JSON.parse(body.substr(1, body.length));
			if (json.actionsuccess) {
				server.send('/trn ' + name + ',0,' + json['assertion']);
			} else {
				Tools.log('Could not log in to "' + this.serverid + '": ' + JSON.stringify(json), this.serverid, true);
			}
		} catch (e) {
			server.send('/trn ' + name + ',0,' + body);
		}
	}

	ignore(user, duration) {
		this.ignoreList[user] = Date.now() + duration;
		fs.writeFileSync('config/ignore.json', JSON.stringify(this.ignoreList));
	}
};

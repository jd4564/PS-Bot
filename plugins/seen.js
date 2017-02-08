'use strict';

let db;

if (!Config.mysql) {
	db = new sqlite3.Database('./config/seen.db', function () {
		db.run("CREATE TABLE IF NOT EXISTS users (userid TEXT PRIMARY KEY, name TEXT, lastOnline INTEGER, lastOnlineServer TEXT, lastOnlineAction TEXT, room TEXT)");
	});
} else {
	const mysql = require('mysql');
	db = mysql.createConnection({
		host: Config.mysql.host,
		port: Config.mysql.port,
		user: Config.mysql.user,
		password: Config.mysql.password,
	});

	db.connect(function (err) {
		if (err) {
			return console.error('(seen) error connecting to mysql server: ' + err.stack);
		}

		db.query('CREATE DATABASE IF NOT EXISTS ' + Config.mysql.dbName + ';', function (error, results, fields) {
			if (error) throw error;
			db.changeUser({database: Config.mysql.dbName}, function (err) {
				if (err) throw err;
				db.query('CREATE TABLE IF NOT EXISTS users (id VARCHAR(32), firstSeen BIGINT, userid VARCHAR(19) PRIMARY KEY, name VARCHAR(32), lastOnline BIGINT, lastOnlineServer VARCHAR(32), lastOnlineAction VARCHAR(100), room VARCHAR(100))', function (error, results, fields) {
					if (err) throw err;
				});
			});
		});
	});
}

const moment = require('moment');
const uuid = require('uuid/v4');

let lastUpdated = {};

function lastSeen(user, callback) {
	if (!Config.mysql) {
		db.all("SELECT * FROM users WHERE userid=$userid", {$userid: toId(user)}, function (err, rows) {
			if (err) return console.log(err);
			callback((rows[0] ? {name: rows[0].name, date: rows[0].lastOnline, action: rows[0].lastOnlineAction, room: rows[0].room, server: rows[0].lastOnlineServer} : false));
		});
	} else {
		db.query("SELECT * FROM users WHERE userid='" + toId(user) + "';", function (err, rows, fields) {
			console.log('abc: ' + JSON.stringify(rows));
			callback((rows[0] ? {name: rows[0].name, date: rows[0].lastOnline, action: rows[0].lastOnlineAction, room: rows[0].room, server: rows[0].lastOnlineServer} : false));
		});
	}
}

function updateSeen(user, action, server, room) {
	if (!Servers[toId(server)].enableSeen) return;
	let userid = toId(user);
	if (userid === toId(Servers[toId(server)].name) || userid.substr(0, 5) === 'guest') return;
	let date = Date.now();
	if (lastUpdated[userid] && (date - lastUpdated[userid]) < 1000) return;
	lastUpdated[userid] = date;
	if (!Config.mysql) {
		db.run("INSERT OR IGNORE INTO users (userid, name, lastOnline, lastOnlineServer, lastOnlineAction, room) VALUES ($userid, $name, $lastOnline, $lastOnlineServer, $lastOnlineAction, $room)",
		{$userid: userid, $name: user, $lastOnline: date, $lastOnlineServer: Servers[toId(server)].serverName, $lastOnlineAction: action, $room: room}, function (err) {
			if (err) return console.log('updateSeen 1: ' + err);
			db.run("UPDATE users SET name = $name, lastOnline = $lastOnline, lastOnlineServer = $lastOnlineServer, lastOnlineAction = $lastOnlineAction, room = $room WHERE userid=$userid",
			{$userid: userid, $name: user, $lastOnline: date, $lastOnlineServer: Servers[toId(server)].serverName, $lastOnlineAction: action, $room: room}, function (err) {
				if (err) console.log('updateSeen 2: ' + err);
			});
		});
	} else {
		let mysqlQuery = 'INSERT INTO users (id, firstSeen, userid, name, lastOnline, lastOnlineServer, lastOnlineAction, room) VALUES (' + db.escape(uuid()) + ', ' + date +
			', "' + userid + '", ' + db.escape(user) + ', ' + date + ', ' + db.escape(Servers[toId(server)].serverName) + ', ' + db.escape(action) + ', ' + db.escape(room) + ') ' +
			'ON DUPLICATE KEY UPDATE name=' + db.escape(user) + ', lastOnline=' + date + ', lastOnlineServer=' + db.escape(Servers[toId(server)].serverName) + ', lastOnlineAction=' + db.escape(action) +
			', room=' + db.escape(room);

		db.query(mysqlQuery, function (err, results, fields) {
			if (err) return console.log('updateSeen 3: ' + err);
			if (action.includes('changing names')) {
				let newName = action.replace(/changing names to /, '');
				let mysqlQuery2 = 'INSERT INTO users (id, firstSeen, userid, name, lastOnline, lastOnlineServer, lastOnlineAction, room) VALUES (' + db.escape(uuid()) + ', ' + date +
					', "' + toId(newName) + '", ' + db.escape(newName) + ', ' + date + ', ' + db.escape(Servers[toId(server)].serverName) + ', "changing names from ' + db.escape(user) + '", ' + db.escape(room) + ') ' +
					'ON DUPLICATE KEY UPDATE name=' + db.escape(newName) + ', lastOnline=' + date + ', lastOnlineServer=' + db.escape(Servers[toId(server)].serverName) + ', lastOnlineAction="changing names from ' + db.escape(user) + '"' +
					', room=' + db.escape(room);
				db.query(mysqlQuery2, function (err) {
					if (err) return console.log('updateSeen 4: ' + err);
					db.query('SELECT * FROM users WHERE userid="' + userid + '" OR userid="' + toId(newName) + '";', function (err, rows) {
						if (err) throw err;
						if (rows[0].firstSeen < rows[1].firstSeen) {
							db.query('UPDATE users SET id=' + db.escape(rows[0].id) + ' WHERE id=' + db.escape(rows[1].id), function (err) {
								if (err) return console.log('updateSeen 5: ' + err);
							});
						} else {
							db.query('UPDATE users SET id=' + db.escape(rows[1].id) + ' WHERE id=' + db.escape(rows[0].id), function (err) {
								if (err) return console.log('updateSeen 6: ' + err);
							});
						}
					});
				});
			}
		});
	}
}

Tools.lastSeen = lastSeen;
Tools.updateSeen = updateSeen;

exports.commands = {
	seen: function (target, room, user, pm) {
		if (!target) return this.sendReply("Usage: " + Config.trigger + "seen [user]");
		let targetid = toId(target);
		if (targetid < 1 || targetid > 19) return this.sendReply(Config.trigger + "seen - [user] may not be less than one character or greater than 19.");

		if (target.trim() === '!usercount' || target.trim() === '!seencount') {
			if (!Config.mysql) {
				db.all("SELECT COUNT(*) FROM users", (err, rows) => {
					if (err) return this.sendReply("Error getting seen data: " + err);
					this.sendReply("There have been " + rows[0]['COUNT(*)'] + " names recorded in the seen database.");
				});
			} else {
				db.query("SELECT COUNT(*) FROM users", (err, rows) => {
					if (err) return this.sendReply("Error getting seen data: " + err);
					this.sendReply("There have been " + rows[0]['COUNT(*)'] + " names recorded in the seen database.");
				});
			}
		} else {
			lastSeen(targetid, data => {
				if (!data) return this.sendReply(Tools.sanitize(target) + " has never been seen before.");
				return this.sendReply(Tools.sanitize(data.name) + " was last seen " + data.action + (data.action !== "joining" && data.action !== "leaving" ? " in " : " ") + " **" + data.room + "** on **" + data.server + "** " + moment(data.date).fromNow());
			});
		}
	},

	alts: function (target, room, user, pm) {
		if (!this.can('admin')) return this.sendReply("Access denied.");
		if (!target) return this.sendReply("Usage: " + this.server.trigger + "alts [user]");
		let targetId = toId(target);

		if (targetId < 1 || targetId > 1) return this.sendReply("Names may not be less than one character or greater than 19.");

		if (!Config.mysql) {
			return this.sendReply("This command is only available if you use mysql.");
		} else {
			db.query('SELECT id, name FROM users WHERE userid="' + targetId + '";', (err, rows) => {
				if (err) return this.sendReply("Error getting alts: " + err);
				if (rows.length < 1) return this.sendReply("User not found.");
				let name = rows[0].name;
				db.query('SELECT GROUP_CONCAT(name) FROM users WHERE id="' + rows[0].id + '";', (err, rows) => {
					if (err) return this.sendReply("Error getting alts (2): " + err);
					let alts = rows[0]['GROUP_CONCAT(name)'].split(',');
					alts.splice(alts.indexOf(targetId), 1);
					return this.sendReply("Alts of " + name + ": " + alts.join(', '));
				});
			});
		}
	},
};

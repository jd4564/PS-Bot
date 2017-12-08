'use strict';

const moment = require('moment');
const uuid = require('uuid/v4');
const mysql = require('mysql');

let lastUpdated = {};

function lastSeen(user, callback) {
	if (!Config.mysql) {
		Tools.query("SELECT * FROM users WHERE userid=$userid", {$userid: toId(user)}, function (err, rows) {
			if (err) {
				console.log('lastSeen err: ' + err);
				return callback(false);
			}
			callback((rows && rows[0]) ? {name: rows[0].name, date: rows[0].lastOnline, action: rows[0].lastOnlineAction, room: rows[0].room, server: rows[0].lastOnlineServer} : false);
		});
	} else {
		Tools.query("SELECT * FROM users WHERE userid='" + toId(user) + "';", function (err, rows, fields) {
			if (err) {
				console.log('lastSeen mysql err: ' + err);
				return callback(false);
			}
			return callback((rows && rows[0] ? {name: rows[0].name, date: rows[0].lastOnline, action: rows[0].lastOnlineAction, room: rows[0].room, server: rows[0].lastOnlineServer} : false));
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
		Tools.query("INSERT OR IGNORE INTO users (userid, name, lastOnline, lastOnlineServer, lastOnlineAction, room) VALUES ($userid, $name, $lastOnline, $lastOnlineServer, $lastOnlineAction, $room)",
			{$userid: userid, $name: user, $lastOnline: date, $lastOnlineServer: Servers[toId(server)].serverName, $lastOnlineAction: action, $room: room}, function (err) {
				if (err) return console.log('updateSeen 1: ' + err);
				Tools.query("UPDATE users SET name = $name, lastOnline = $lastOnline, lastOnlineServer = $lastOnlineServer, lastOnlineAction = $lastOnlineAction, room = $room WHERE userid=$userid",
					{$userid: userid, $name: user, $lastOnline: date, $lastOnlineServer: Servers[toId(server)].serverName, $lastOnlineAction: action, $room: room}, function (err) {
						if (err) return console.log('updateSeen 2: ' + err);
					});
			});
	} else {
		let mysqlQuery = `INSERT INTO users (id, firstSeen, userid, name, lastOnline, lastOnlineServer, lastOnlineAction, room) VALUES (${mysql.escape(uuid())}, ` +
		`${date}, "${userid}", ${mysql.escape(user)}, ${date}, ${mysql.escape(Servers[toId(server)].serverName)}, ${mysql.escape(action)}, ${mysql.escape(room)}) ` +
		`ON DUPLICATE KEY UPDATE name=${mysql.escape(user)}, lastOnline=${date}, lastOnlineServer=${mysql.escape(Servers[toId(server)].serverName)}, ` +
		`lastOnlineAction=${mysql.escape(action)}, room=${mysql.escape(room)}`;

		Tools.query(mysqlQuery, function (err, results) {
			if (err) return console.log('updateSeen 3: ' + err);
			if (action.includes('changing names')) {
				let newName = action.replace(/changing names to /, '');
				let mysqlQuery2 = `INSERT INTO users (id, firstSeen, userid, name, lastOnline, lastOnlineServer, lastOnlineAction, room) VALUES (${mysql.escape(uuid())}, ${date}` +
				`, "${toId(newName)}", ${mysql.escape(newName)}, ${date}, ${mysql.escape(Servers[toId(server)].serverName)}, "changing names from ${mysql.escape(user)}", ` +
				`${mysql.escape(room)}) ON DUPLICATE KEY UPDATE name=${mysql.escape(newName)}, lastOnline=${date}, lastOnlineServer=${mysql.escape(Servers[toId(server)].serverName)}, ` +
				`lastOnlineAction="changing names from ${mysql.escape(user)}", room=${mysql.escape(room)}`;
				Tools.query(mysqlQuery2, function (err) {
					if (err) return console.log('updateSeen 4: ' + err);
					Tools.query(`SELECT * FROM users WHERE userid="${userid}" OR userid="${toId(newName)}";`, function (err, rows) {
						if (err) throw err;
						if (rows[0].firstSeen < rows[1].firstSeen) {
							Tools.query(`UPDATE users SET id=${mysql.escape(rows[0].id)} WHERE id=${mysql.escape(rows[1].id)}`, function (err) {
								if (err) return console.log('updateSeen 5: ' + err);
							});
						} else {
							Tools.query(`UPDATE users SET id=${mysql.escape(rows[1].id)} WHERE id=${mysql.escape(rows[0].id)}`, function (err) {
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
			Tools.query("SELECT COUNT(*) FROM users", (err, rows) => {
				if (err) return this.sendReply("Error getting seen data: " + err);
				if (!rows || rows.length < 1) return this.sendReply("No users have been seen.");
				this.sendReply("There have been " + rows[0]['COUNT(*)'] + " names recorded in the seen database.");
			});
		} else {
			lastSeen(targetid, data => {
				if (!data) return this.sendReply(Tools.sanitize(target) + " has never been seen before.");
				return this.sendReply(Tools.sanitize(data.name) + " was last seen " + data.action + (data.action !== "joining" && data.action !== "leaving" ? " in " : " ") + " **" + data.room + "** on **" + data.server + "** " + moment(data.date).fromNow());
			});
		}
	},

	alts: function (target, room, user, pm) {
		if (!this.can('admin')) return this.sendReply("Access denied.");
		if (!target) return this.sendReply("Usage: " + Servers[this.serverid].trigger + "alts [user]");
		let targetId = toId(target);

		if (targetId < 1 || targetId > 1) return this.sendReply("Names may not be less than one character or greater than 19.");

		if (!Config.mysql) {
			return this.sendReply("This command is only available if you use mysql.");
		} else {
			Tools.query('SELECT id, name FROM users WHERE userid="' + targetId + '";', (err, rows) => {
				if (err) return this.sendReply("Error getting alts: " + err);
				if (rows.length < 1) return this.sendReply("User not found.");
				let name = rows[0].name;
				Tools.query('SELECT GROUP_CONCAT(name) FROM users WHERE id="' + rows[0].id + '";', (err, rows) => {
					if (err) return this.sendReply("Error getting alts (2): " + err);
					let alts = rows[0]['GROUP_CONCAT(name)'].split(',');
					alts.splice(alts.indexOf(targetId), 1);
					return this.sendReply("Alts of " + name + ": " + alts.join(', '));
				});
			});
		}
	},
};

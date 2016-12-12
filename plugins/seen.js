'use strict';

const db = new sqlite3.Database('./config/seen.db', function () {
	db.run("CREATE TABLE IF NOT EXISTS users (userid TEXT PRIMARY KEY, name TEXT, lastOnline INTEGER, lastOnlineServer TEXT, lastOnlineAction TEXT, room TEXT)");
});
const moment = require('moment');

function lastSeen(user, callback) {
	db.all("SELECT * FROM users WHERE userid=$userid", {$userid: toId(user)}, function (err, rows) {
		if (err) return console.log(err);
		callback((rows[0] ? {name: rows[0].name, date: rows[0].lastOnline, action: rows[0].lastOnlineAction, room: rows[0].room, server: rows[0].lastOnlineServer} : false));
	});
}

function updateSeen(user, action, server, room) {
	if (!Servers[toId(server)].enableSeen) return;
	let userid = toId(user);
	if (userid === toId(Servers[toId(server)].name) || userid.substr(0, 5) === 'guest') return;
	let date = Date.now();
	db.run("INSERT OR IGNORE INTO users (userid, name, lastOnline, lastOnlineServer, lastOnlineAction, room) VALUES ($userid, $name, $lastOnline, $lastOnlineServer, $lastOnlineAction, $room)",
	{$userid: userid, $name: user, $lastOnline: date, $lastOnlineServer: server, $lastOnlineAction: action, $room: room}, function (err) {
		if (err) return console.log('updateSeen 1: ' + err);
		db.run("UPDATE users SET name = $name, lastOnline = $lastOnline, lastOnlineServer = $lastOnlineServer, lastOnlineAction = $lastOnlineAction, room = $room WHERE userid=$userid",
		{$userid: userid, $name: user, $lastOnline: date, $lastOnlineServer: server, $lastOnlineAction: action, $room: room}, function (err) {
			if (err) console.log('updateSeen 2: ' + err);
		});
	});
}

Tools.lastSeen = lastSeen;
Tools.updateSeen = updateSeen;

exports.commands = {
	seen: function (target, room, user, pm) {
		if (!target) return this.sendReply("Usage: " + Config.trigger + "seen [user]");
		let targetid = toId(target);
		if (targetid < 1 || targetid > 19) return this.sendReply(Config.trigger + "seen - [user] may not be less than one character or greater than 19.");

		if (target.trim() === '!usercount' || target.trim() === '!seencount') {
			db.all("SELECT COUNT(*) FROM users", (err, rows) => {
				if (err) return this.sendReply("Error getting seen data: " + err);
				this.sendReply("There have been " + rows[0]['COUNT(*)'] + " names recorded in the seen database.");
			});
		} else {
			lastSeen(targetid, data => {
				if (!data) return this.sendReply(Tools.sanitize(target) + " has never been seen before.");
				return this.sendReply(Tools.sanitize(data.name) + " was last seen " + data.action + (data.action === "talking" ? " in " : " ") + " **" + data.room + "** on **" + data.server + "** " + moment(data.date).fromNow());
			});
		}
	},
};

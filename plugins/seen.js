'use strict';

const db = new sqlite3.Database('./config/seen.db', function () {
	db.run("CREATE TABLE if not exists users (userid TEXT, name TEXT, lastOnline INTEGER, lastOnlineServer TEXT, lastOnlineAction TEXT, room TEXT)");
});

function lastSeen(user, callback) {
	db.all("SELECT * FROM users WHERE userid=$userid", {$userid: toId(user)}, function (err, rows) {
		if (err) return console.log(err);
		callback((rows[0] ? {name: rows[0].name, date: rows[0].lastOnline, action: rows[0].lastOnlineAction, room: rows[0].room, server: rows[0].lastOnlineServer} : false));
	});
}

function updateSeen(user, action, server, room) {
	let userid = toId(user);
	let date = Date.now();
	db.all("SELECT * FROM users WHERE userid=$userid", {$userid: userid}, function (err, rows) {
		if (err) return Tools.log('updateSeen err: ' + err, server, true);
		if (!rows || rows.length < 1) {
			db.run("INSERT INTO users(userid, name, lastOnline, lastOnlineServer, lastOnlineAction, room) VALUES ($userid, $name, $lastOnline, $lastOnlineServer, $lastOnlineAction, $room)",
				{$userid: userid, $name: user, $lastOnline: date, $lastOnlineServer: server, $lastOnlineAction: action, $room: room}, function (err) {
					if (err) return Tools.log(err, server, true);
				});
		} else {
			db.run("UPDATE users SET userid=$userid WHERE userid=$userid", {$userid: userid});
			db.run("UPDATE users SET name=$name WHERE userid=$userid", {$userid: userid, $name: user});
			db.run("UPDATE users SET lastOnline=$lastOnline WHERE userid=$userid", {$userid: userid, $lastOnline: date});
			db.run("UPDATE users SET lastOnlineServer=$lastOnlineServer WHERE userid=$userid", {$userid: userid, $lastOnlineServer: server});
			db.run("UPDATE users SET lastOnlineAction=$lastOnlineAction WHERE userid=$userid", {$userid: userid, $lastOnlineAction: action});
			db.run("UPDATE users SET room=$room WHERE userid=$userid", {$userid: userid, $room: room});
		}
	});
}

Tools.lastSeen = lastSeen;
Tools.updateSeen = updateSeen;

exports.commands = {
	seen: function (target, room, user, pm) {
		if (!target) return this.sendReply("Usage: " + Config.trigger + "seen [user]");
		let targetid = toId(target);
		if (targetid < 1 || targetid > 19) return this.sendReply(Config.trigger + "seen - [user] may not be less than one character or greater than 19.");

		lastSeen(targetid, data => {
			if (!data) return this.sendReply(Tools.sanitize(target) + " has never been seen before.");
			let seconds = Math.floor(((Date.now() - data.date) / 1000));
			let minutes = Math.floor((seconds / 60));
			let hours = Math.floor((minutes / 60));
			let days = Math.floor((hours / 24));

			let secondsWord = (((seconds % 60) > 1 || (seconds % 60) === 0) ? 'seconds' : 'second');
			let minutesWord = (((minutes % 60) > 1 || (minutes % 60) === 0) ? 'minutes' : 'minute');
			let hoursWord = ((hours > 1 || hours === 0) ? 'hours' : 'hour');
			let daysWord = ((days === 1 ? 'day' : 'days'));
			let lastSeen;

			if (minutes < 1) {
				lastSeen = seconds + ' ' + secondsWord;
			}
			if (minutes > 0 && minutes < 60) {
				lastSeen = minutes + ' ' + minutesWord + ' ' + (seconds % 60) + ' ' + secondsWord;
			}
			if (hours > 0 && days < 1) {
				lastSeen = hours + ' ' + hoursWord + ' ' + (minutes % 60) + ' ' + minutesWord;
			}
			if (days > 0) lastSeen = days + ' ' + daysWord + ' ' + (hours % 24) + ' ' + hoursWord;
			return this.sendReply(Tools.sanitize(data.name) + " was last seen " + data.action + (data.action === "talking" ? " in " : " ") + " **" + data.room + "** on **" + data.server + "** " + lastSeen + " ago.");
		});
	},
};

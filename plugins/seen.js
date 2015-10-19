//var sqlite3 = require('sqlite3');
var db = new sqlite3.Database('./config/seen.db', function () {
	db.run("CREATE TABLE if not exists users (userid TEXT, name TEXT, lastOnline INTEGER, lastOnlineServer TEXT, lastOnlineAction TEXT, room TEXT)");
});

function lastSeen(user, callback) {
	db.all("SELECT * FROM users WHERE userid=$userid", {$userid: toId(user)}, function (err, rows) {
		if (err) return console.log(err);
		callback((rows[0] ? {name: rows[0].name, date: rows[0].lastOnline, action: rows[0].lastOnlineAction, room: rows[0].room, server: rows[0].lastOnlineServer} : false));
	});
}

function updateSeen(user, action, server, room) {
	var userid = toId(user);
	var date = Date.now();
	db.all("SELECT * FROM users WHERE userid=$userid", {$userid: userid}, function (err, rows) {
		if (err) return log('updateSeen err: ' + err, server, true);
		if (!rows || rows.length < 1) {
			db.run("INSERT INTO users(userid, name, lastOnline, lastOnlineServer, lastOnlineAction, room) VALUES ($userid, $name, $lastOnline, $lastOnlineServer, $lastOnlineAction, $room)",
				{$userid: userid, $name: user, $lastOnline: date, $lastOnlineServer: server, $lastOnlineAction: action, $room: room}, function (err) {
				if (err) return log(err, server, true);
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

global.lastSeen = lastSeen;
global.updateSeen = updateSeen;

exports.commands = {
	seen: function (target, room, user, pm) {
		if (!Commands.hasPermission(user, 'broadcast') && pm === '') pm = "/msg " + user + ", ";
		if (!target) return this.send(pm + "Usage: " + Config.trigger + "seen [user]");
		var targetid = toId(target);
		if (targetid < 1 || targetid > 19) return this.send(pm + Config.trigger + "seen - [user] may not be less than one character or greater than 19.", room);
		var self = this;
		lastSeen(targetid, function (data) {
			if (!data) return self.send(pm + sanitize(target) + " has never been seen before.", room);
			var seconds = Math.floor(((Date.now() - data.date) / 1000));
			var minutes = Math.floor((seconds / 60));
			var hours = Math.floor((minutes / 60));
			var days = Math.floor((hours / 24));

			var secondsWord = (((seconds % 60) > 1 || (seconds % 60) === 0) ? 'seconds' : 'second');
			var minutesWord = (((minutes % 60) > 1 || (minutes % 60) === 0) ? 'minutes' : 'minute');
			var hoursWord = ((hours > 1 || hours === 0) ? 'hours' : 'hour');
			var daysWord = ((days === 1 ? 'day' : 'days'));
			var lastSeen;

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

			return self.send(pm + sanitize(data.name) + " was last seen " + data.action + (data.action === "talking" ? " in " : " ") + " **" + data.room + "** on **" + data.server + "** " + lastSeen + " ago.", room);
		});
	}
};

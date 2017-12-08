'use strict';

const moment = require('moment');
const mysql = require('mysql');

const MAX_PENDING_TELLS = 10;

function sendTell(user, server) {
	if (toId(server.name) === '') return;
	if (!Config.mysql) {
		Tools.query("SELECT * FROM tells WHERE userid=$userid", {$userid: toId(user)}, function (err, rows) {
			if (err) return console.log("sendTell: " + err);
			if (!rows || rows.length < 1) return;
			Tools.query("DELETE FROM tells WHERE userid=$userid", {$userid: toId(user)}, function (err) {
				if (err) console.log("sendTell 2: " + err);
			});
			let messages = [];
			for (let u in rows) {
				messages.push(moment(rows[u].date).format("(dddd, MMMM Do YYYY, h:mm:ss A) ") + rows[u].sender + " said: " + rows[u].message);
			}
			if (messages.length < 4) {
				for (let u in messages) server.send("/msg " + user + ", " + messages[u]);
			} else {
				Tools.uploadToHastebin(messages.join('\n'), function (url) {
					server.send("/msg " + user + ", You have " + messages.length + " pending tells to read: " + url);
				});
			}
		});
	} else {
		Tools.query(`SELECT * FROM tells WHERE userid='${toId(user)}'`, function (err, rows) {
			if (err) return console.log("sendTell: " + err);
			if (!rows || rows.length < 1) return;
			Tools.query(`DELETE FROM tells WHERE userid='${toId(user)}'`, function (err) {
				if (err) console.log("sendTell 2: " + err);
			});
			let messages = [];
			for (let u in rows) {
				messages.push(moment(rows[u].date).format("(dddd, MMMM Do YYYY, h:mm:ss A) ") + rows[u].sender + " said: " + rows[u].message);
			}
			if (messages.length < 4) {
				for (let u in messages) server.send("/msg " + user + ", " + messages[u]);
			} else {
				Tools.uploadToHastebin(messages.join('\n'), function (url) {
					server.send("/msg " + user + ", You have " + messages.length + " pending tells to read: " + url);
				});
			}
		});
	}
}
Tools.sendTell = sendTell;

exports.commands = {
	tell: function (target, room, user, pm) {
		if (!target || !~target.indexOf(',')) return this.sendReply("Usage: " + Config.trigger + "tell [user], [message]");
		let splitTarget = target.split(',');
		for (let u in splitTarget) splitTarget[u] = splitTarget[u].trim();

		if (!toId(splitTarget[0]) || toId(splitTarget[0]).length > 19) return this.sendReply('"' + splitTarget[0] + '" is not a valid username.');
		if (splitTarget[1].length > 250) return this.sendReply("Tells may not be longer than 250 characters.");

		let targetId = toId(splitTarget[0]);
		if (!Config.mysql) {
			Tools.query("SELECT COUNT(*) FROM tells WHERE userid=$userid", {$userid: targetId}, (err, rows) => {
				if (err) return this.sendReply("Error sending tell: " + err);
				if (rows[0] && rows[0]['COUNT(*)'] >= MAX_PENDING_TELLS) return this.sendReply("That users mailbox is currently full.");
				Tools.query("INSERT INTO tells (userid, sender, message, date) VALUES ($userid, $sender, $message, $date)", {$userid: targetId, $sender: user, $message: splitTarget[1], $date: Date.now()}, err => {
					if (err) return this.sendReply("Error sending tell: " + err);
					this.sendReply("Your message has been sent.");
				});
			});
		} else {
			Tools.query(`SELECT COUNT(*) FROM tells WHERE userid=${mysql.escape(targetId)}`, (err, rows) => {
				if (err) return this.sendReply("Error sending tell: " + err);
				if (rows[0] && rows[0]['COUNT(*)'] >= MAX_PENDING_TELLS) return this.sendReply("That users mailbox is currently full.");
				Tools.query(`INSERT INTO tells (userid, sender, message, date) VALUES (${mysql.escape(targetId)}, ${mysql.escape(user)}, ${mysql.escape(splitTarget[1])}, ${mysql.escape(Date.now())})`, err => {
					if (err) return this.sendReply("Error sending tell: " + err);
					this.sendReply("Your message has been sent.");
				});
			});
		}
	},
};

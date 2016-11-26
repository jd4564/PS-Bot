'use strict';

const dateFormat = require('dateformat');
const fs = require('fs');
let tells = {};

function loadData() {
	try {
		tells = JSON.parse(fs.readFileSync('./config/tells.json', 'utf8'));
	} catch (e) {}
}
loadData();

function saveData() {
	fs.writeFileSync('./config/tells.json', JSON.stringify(tells));
}

function sendTell(user, server) {
	if (!tells[toId(user)]) return;
	let userid = toId(user);
	let reply = '';
	for (let tell in tells[userid]) {
		reply = dateFormat(tells[userid][tell].date, "(dddd, mmmm d, yyyy hh:MMTT Z) (") + tells[userid][tell].server + ") " + tells[userid][tell].sender + ' said: "' + tells[userid][tell].message + '"';
		server.send('/msg ' + user + ', ' + reply);
		tells[userid].splice(tell, 1);
	}
	if (tells[userid].length < 1) delete tells[userid];
	saveData();
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
		if (!tells[targetId]) tells[targetId] = [];

		tells[targetId].push({
			message: splitTarget[1],
			sender: user,
			date: Date.now(),
			server: this.serverid,
		});
		saveData();
		return this.sendReply("Your message has been sent.");
	},
};

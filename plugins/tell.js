var fs = require('fs');
var dateFormat = require('dateformat');
var tells = {};

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
	var userid = toId(user);
	var reply = '';
	for (var tell in tells[userid]) {
		reply = dateFormat(tells[userid][tell].date, "(dddd, mmmm d, yyyy hh:MMTT Z) (") + tells[userid][tell].server + ") " + tells[userid][tell].sender + ' said: "' + tells[userid][tell].message + '"';
		server.send('/msg ' + user + ', ' + reply);
		tells[userid].splice(tell, 1);
	}
	if (tells[userid].length < 1) delete tells[userid];
	saveData();
}
global.sendTell = sendTell;

exports.commands = {
	tell: function (target, room, user, pm) {
		if (!Commands.hasPermission(user, 'broadcast') && pm === '') pm = "/msg " + user + ", ";
		if (!target || !~target.indexOf(',')) return this.send(pm + "Usage: " + Config.trigger + "tell [user], [message]", room);
		var splitTarget = target.split(',');
		for (var u in splitTarget) splitTarget[u] = splitTarget[u].trim();

		if (!toId(splitTarget[0]) || toId(splitTarget[0]).length > 19) return this.send(pm + '"' + splitTarget[0] + '" is not a valid username.', room);
		if (splitTarget[1].length > 250) return this.send(pm + "Tells may not be longer than 250 characters.", room);

		var targetId = toId(splitTarget[0]);
		if (!tells[targetId]) tells[targetId] = [];

		tells[targetId].push({
			message: splitTarget[1],
			sender: user,
			date: Date.now(),
			server: this.id
		});
		saveData();
		return this.send(pm + "Your message has been sent.", room);
	}
};

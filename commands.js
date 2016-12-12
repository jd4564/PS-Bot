/* Commands
 * In here you'll find the majority of the commands for the bot.
 * Alternatively, you may add commands via a plugin in the plugins directory.
 */
'use strict';

const fs = require('fs');
const moment = require('moment');

exports.commands = {
	// informational commands
	credits: 'about',
	about: function (target, room, user, pm) {
		this.sendReply("PS Bot by jd (https://github.com/jd4564/PS-Bot)");
	},

	uptime: function (target, room, user, pm) {
		let uptime = process.uptime();
		let uptimeText;
		if (uptime > 24 * 60 * 60) {
			let uptimeDays = Math.floor(uptime / (24 * 60 * 60));
			uptimeText = uptimeDays + " " + (uptimeDays === 1 ? "day" : "days");
			let uptimeHours = Math.floor(uptime / (60 * 60)) - uptimeDays * 24;
			if (uptimeHours) uptimeText += ", " + uptimeHours + " " + (uptimeHours === 1 ? "hour" : "hours");
		} else {
			uptimeText = Tools.toDurationString(uptime * 1000);
		}
		this.sendReply("Uptime: **" + uptimeText + "**");
	},

	memusage: function (target, room, user, pm) {
		return this.sendReply("Memory Usage: " + Math.round((process.memoryUsage().rss / 1024) / 1024) + " MB");
	},

	regdate: function (target, room, user, pm) {
		let targetid = toId(target);
		if (targetid.length < 1 || targetid.length > 19) return this.sendReply(Config.trigger + "regdate [user] - [user] may not be less than one character or longer than 19");

		Tools.regdate(targetid, date => {
			this.sendReply(Tools.sanitize(target) + (date ? " was registered on " + moment(date).format("dddd, MMMM DD, YYYY HH:mmA ZZ") : " is not registered."));
		});
	},

	// TODO: refactor viewlogs
	viewlogs: function (target, room, user, pm) {
		if (!target) return this.sendReply("Usage: " + Config.trigger + "viewlogs [server], [room], [DD-MM-YYYY]");
		let targets = target.split(',');
		for (let u in targets) targets[u] = targets[u].trim();
		if (!targets[2]) return this.sendReply("Usage: " + Config.trigger + " viewlogs [server], [room], [DD-MM-YYYY]");
		if (!Config.server[targets[0]] && !this.can('admin')) return this.sendReply("Access denied.");
		if (Config.server[targets[0]] && Config.server[targets[0]].privaterooms.includes(toId(targets[1])) && !this.can('admin')) return this.sendReply("Access denied.");
		if (toId(targets[2]) === 'today' || toId(targets[2]) === 'yesterday') {
			let date = new Date();
			if (toId(targets[2]) === 'yesterday') date.setDate(date.getDate() - 1);
			targets[2] = date.format('{dd}-{MM}-{yyyy}');
		}
		let dateSplit = targets[2].split('-');
		if (!dateSplit[2]) return this.sendReply("Incorrect date format.");
		let path = "logs/chat/" + toId(targets[0]) + "/" + toId(targets[1]) + "/" + dateSplit[2] + "-" + dateSplit[1] + "/" + dateSplit[2] + "-" + dateSplit[1] + "-" + dateSplit[0] + ".txt";
		let filename = Tools.randomString(8) + '.txt';

		fs.readFile(path, (err, data) => {
			if (err) return this.sendReply("Error reading logfile");
			fs.writeFile('static/logs/' + filename, data, err => {
				if (err) return this.sendReply("Error writing logfile");
				this.sendReply("You can view the logs at http://" + Config.ip + ":" + Config.webport + "/logviewer.html?logfile=" + filename.substr(0, filename.length - 4) + "&server=" + toId(targets[0]) +
					"&room=" + toId(targets[1]) + "&date=" + encodeURIComponent(targets[2]));
				setTimeout(function () {
					fs.unlink('static/logs/' + filename);
				}, 1 * 1000 * 60);
			});
		});
	},

	// Developer commands
	js: 'eval',
	eval: function (target, room, user, pm) {
		if (!this.can('admin') || !Servers[this.serverid].trusted) return this.sendReply("Access denied.");
		if (!target) return this.sendReply("Usage: " + Config.trigger + "eval [target]");
		try {
			let result = eval(target);
			this.sendReply(JSON.stringify(result));
		} catch (e) {
			this.sendReply(e.name + ": " + e.message);
		}
		devLog(user + " used eval. Eval: " + target);
	},

	kill: function (target, room, user, pm) {
		if (!this.can('admin') || !Servers[this.serverid].trusted) return this.sendReply("Access denied.");
		devLog(user + " used " + Config.trigger + "kill");
		setTimeout(function () {
			process.exit();
		}, 10);
	},

	reload: function (target, room, user, pm) {
		if (!this.can('admin') || !Servers[this.serverid].trusted) return this.sendReply("Access denied.");
		try {
			uncacheTree('./commands.js');
			uncacheTree('./parser.js');
			uncacheTree('./tools.js');
			global.Tools = require('./tools.js');
			global.Parser = require('./parser.js');
			devLog(user + " used " + Config.trigger + "reload");
			return this.sendReply("Commands reloaded.");
		} catch (e) {
			return this.sendReply("Error reloading commands: " + e);
		}
	},

	// TODO: refactor permission system
	/*permission: function (target, room, user, pm) {
		if (!hasPermission(user, 'admin')) return this.send("/msg " + user.substr(1) + ", Access denied.", room);
		if (!target || !~target.indexOf(',')) return this.send(pm + "Usage: " + Config.trigger + "permission [permission], [rank]", room);
		let targetSplit = target.split(',');
		for (let u in targetSplit) targetSplit[u] = targetSplit[u].trim();

		if (!~ranks.indexOf(targetSplit[1])) return this.send(pm + targetSplit[1] + " is not a valid rank.", room);
		if (targetSplit[0] === 'admin') return this.send(pm + "For security reasons, you may not change the admin permission.", room);

		permissions[targetSplit[0]] = targetSplit[1];
		savePermissions();
		return this.send(pm + "Permission \"" + targetSplit[0] + "\" has been set to \"" + targetSplit[1] + "\".", room);
	},*/

	reconnect: function (target, room, user, pm) {
		if (!this.can('admin')) return this.sendReply("Access denied.");
		devLog(user + " used " + Config.trigger + "reconnect on the \"" + this.id + "\" server.");
		this.disconnecting = true;
		this.disconnect(true);
	},

	// Misc Commands
	transferallbucks: function (target, room, user, pm) {
		if (!this.can('transferbucks')) return this.sendReply("Access denied.");
		if (!target) return this.sendReply("Usage: " + Config.trigger + "transferallbucks [user]");

		let id = toId(target);
		if (id.length < 1 || id.length > 19) return this.sendReply("That's not a valid username.");

		this.transferAllBucks = target;
		this.send('/atm ' + toId(Servers[this.serverid].name));
	},

	custom: function (target, room, user, pm) {
		if (!this.can('custom')) return this.sendReply("Access denied.");
		if (!target) return this.sendReply("Usage: " + Config.trigger + "custom [room], message");
		let parts = target.split(',');
		for (let u in parts) parts[u] = parts[u].trim();
		let message = parts.slice(1).join(',');
		this.send(message, (toId(parts[0]) === "" ? room : parts[0]));
	},

	join: function (target, room, user, pm) {
		if (!this.can('invite')) return this.sendReply("Access denied.");
		if (!target) return this.sendReply("Usage: " + Config.trigger + "join [room]");
		this.send("/join " + target);
	},

	leave: function (target, room, user, pm) {
		if (!this.can('leave')) return this.sendReply("Access denied.");
		this.send("/leave " + room, room);
	},

	say: function (target, room, user, pm) {
		if (!this.can('say')) return this.sendReply("Access denied.");
		if (!target) return this.sendReply("Usage: " + Config.trigger + "say [message]");
		this.sendReply(Tools.sanitize(target));
	},

	pickrandom: 'pick',
	choose: 'pick',
	pick: function (target, room, user, pm) {
		if (target.length < 3 || !~target.indexOf(',')) return this.send(pm + "Usage: " + Config.trigger + "pick [option], [option], ... - picks a random [option].  Requires at least two options.", room);
		let targets = target.split(',');
		let pick = targets[Math.floor(Math.random() * targets.length)];
		this.sendReply("Randomly selected: " + pick);
	},

	helix: function (target, room, user, pm) {
		let helix = ["Signs point to yes.", "Yes.", "Reply hazy, try again.",
			"Without a doubt.", "As I see it, yes.", "You may rely on it.",
			"Concentrate and ask again.", "Outlook not so good.", "It is decidedly so.",
			"Better not tell you now.", "Very doubtful.", "Yes - definitely.", "It is certain.",
			"Cannot predict now.", "Most likely.", "Ask again later.", "My reply is no.", "Outlook good.",
			"Don't count on it."];
		this.sendReply(helix[Math.floor(Math.random() * helix.length)]);
	},
};

function devLog(text) {
	fs.appendFileSync('logs/dev.log', '[' + new Date() + '] ' + text + '\n');
}

function uncacheTree(root) {
	let uncache = [require.resolve(root)];
	do {
		let newuncache = [];
		for (let i of uncache) {
			if (require.cache[i]) {
				newuncache.push.apply(newuncache,
					require.cache[i].children.map(function (module) {
						return module.filename;
					})
				);
				delete require.cache[i];
			}
		}
		uncache = newuncache;
	} while (uncache.length);
}

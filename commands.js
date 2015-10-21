/* Commands
 * In here you'll find the majority of the commands for the bot.
 * Alternatively, you may add commands via a plugin in the plugins directory.
 */

var fs = require('fs');
var request = require('request');
var http = require('http');
var dateFormat = require('dateformat');
var ranks = [' ', '+', '\u2605', '%', '@', '#', '&', '~', 'admin'];
var regdateCache = {};
var permissions = {};

exports.commands = {
	// informational commands
	credits: 'about',
	about: function (target, room, user, pm) {
		if (!hasPermission(user, 'broadcast')) pm = "/msg " + user.substr(1) + ", ";
		this.send(pm + "PS Bot by jd (https://github.com/jd4564/PS-Bot)", room);
	},

	uptime: function (target, room, user, pm) {
		if (!hasPermission(user, 'broadcast')) pm = "/msg " + user.substr(1) + ", ";
		var uptime = process.uptime();
		var uptimeText;
		if (uptime > 24 * 60 * 60) {
			var uptimeDays = Math.floor(uptime / (24 * 60 * 60));
			uptimeText = uptimeDays + " " + (uptimeDays === 1 ? "day" : "days");
			var uptimeHours = Math.floor(uptime / (60 * 60)) - uptimeDays * 24;
			if (uptimeHours) uptimeText += ", " + uptimeHours + " " + (uptimeHours === 1 ? "hour" : "hours");
		} else {
			uptimeText = uptime.seconds().duration();
		}
		this.send(pm + "Uptime: **" + uptimeText + "**", room);
	},

	memusage: function (target, room, user, pm) {
		if (!hasPermission(user, 'broadcast')) pm = "/msg " + user.substr(1) + ", ";
		return this.send(pm + "Memory Usage: " + Math.round((process.memoryUsage().rss / 1024) / 1024) + " MB", room);
	},

	regdate: function (target, room, user, pm) {
		if (!hasPermission(user, 'broadcast')) pm = "/msg " + user + ", ";
		var targetid = toId(target);
		if (targetid.length < 1 || targetid.length > 19) return this.send(pm + Config.trigger + "regdate [user] - [user] may not be less than one character or longer than 19", room);
		if (regdateCache[targetid]) {
			reply(regdateCache[targetid]);
		} else {
			request('http://pokemonshowdown.com/users/' + targetid + '.json', function (error, response, body) {
				var data = JSON.parse(body);
				var date = data['registertime'];
				if (date !== 0 && date.toString().length < 13) {
					while (date.toString().length < 13) {
						date = Number(date.toString() + '0');
					}
				}
				reply(date);
			});
		}
		var self = this;

		function reply(date) {
			if (date === 0) return self.send(pm + sanitize(target) + " is not registered.", room);
			self.send(pm + sanitize(target) + " was registered on " + dateFormat(date, "dddd, mmmm d, yyyy hh:MMTT Z"), room);
		}
	},

	viewlogs: function (target, room, user, pm) {
		if (!hasPermission(user, 'viewlogs')) pm = "/msg " + user.substr(1) + ", ";
		if (!target) return this.send(pm + "Usage: " + Config.trigger + "viewlogs [server], [room], [DD-MM-YYYY]", room);
		if (~this.privaterooms.indexOf(toId(target)) && !hasPermission(user, 'admin')) return this.send(pm + "Access denied", room);
		var targets = target.split(',');
		for (var u in targets) targets[u] = targets[u].trim();
		if (!targets[2]) return this.send(pm + "Usage: " + Config.trigger + " viewlogs [server], [room], [DD-MM-YYYY]", room);
		if (toId(targets[2]) === 'today' || toId(targets[2]) === 'yesterday') {
			var date = new Date();
			if (toId(targets[2]) === 'yesterday') date.setDate(date.getDate() - 1);
			targets[2] = date.format('{dd}-{MM}-{yyyy}');
		}
		var dateSplit = targets[2].split('-');
		if (!dateSplit[2]) return this.send(pm + "Incorrect date format.", room);
		var path = "logs/chat/" + toId(targets[0]) + "/" + toId(targets[1]) + "/" + dateSplit[2] + "-" + dateSplit[1] + "/" + dateSplit[2] + "-" + dateSplit[1] + "-" + dateSplit[0] + ".txt";
		var self = this;
		var filename = require('crypto').randomBytes(8).toString('hex') + '.txt';
		fs.readFile(path, function (err, data) {
			if (err) return self.send(pm + "Error reading logfile", room);
			fs.writeFile('static/logs/' + filename, data, function (err) {
				if (err) return self.send(pm + "Error writing logfile", room);
				self.send(pm + "You can view the logs at http://" + Config.ip + ":" + Config.webport + "/logviewer.html?logfile=" + filename.substr(0, filename.length - 4) + "&server=" + toId(targets[0]) +
					"&room=" + toId(targets[1]) + "&date=" + encodeURIComponent(targets[2]), room);
				var deleteFile = setTimeout(function () {
					fs.unlink('static/logs/' + filename);
				}, 1 * 1000 * 60);
			});
		});
	},

	// Developer commands
	js: 'eval',
	eval: function (target, room, user, pm) {
		if (!hasPermission(user, 'admin')) return this.send("/msg " + user.substr(1) + ", Access denied.", room);
		if (!target) return this.send(pm + "Usage: " + Config.trigger + "eval [target]", room);
		try {
			var result = eval(target);
			this.send(pm + JSON.stringify(result), room);
		} catch (e) {
			this.send(pm + e.name + ": " + e.message, room);
		}
		devLog(user + " used eval. Eval: " + target);
	},

	kill: function (target, room, user, pm) {
		if (!hasPermission(user, 'admin')) return this.send("/msg " + user.substr(1) + ", Access denied.", room);
		devLog(user + " used " + Config.trigger + "kill");
		setTimeout(function () {
			process.exit();
		}, 10);
	},

	reload: function (target, room, user, pm) {
		if (!hasPermission(user, 'admin')) return this.send("/msg " + user.substr(1) + ", Access denied.", room);
		try {
			uncacheTree('./commands.js');
			uncacheTree('./parser.js');
			global.Parser = require('./parser.js');
			devLog(user + " used " + Config.trigger + "reload");
			return this.send(pm + "Commands reloaded.", room);
		} catch (e) {
			return this.send(pm + "Error reloading commands: " + e, room);
		}
	},

	permission: function (target, room, user, pm) {
		if (!hasPermission(user, 'admin')) return this.send("/msg " + user.substr(1) + ", Access denied.", room);
		if (!target || !~target.indexOf(',')) return this.send(pm + "Usage: " + Config.trigger + "permission [permission], [rank]", room);
		var targetSplit = target.split(',');
		for (var u in targetSplit) targetSplit[u] = targetSplit[u].trim();

		if (!~ranks.indexOf(targetSplit[1])) return this.send(pm + targetSplit[1] + " is not a valid rank.", room);
		if (targetSplit[0] === 'admin') return this.send(pm + "For security reasons, you may not change the admin permission.", room);

		permissions[targetSplit[0]] = targetSplit[1];
		savePermissions();
		return this.send(pm + "Permission \"" + targetSplit[0] + "\" has been set to \"" + targetSplit[1] + "\".", room);
	},

	reconnect: function (target, room, user, pm) {
		if (!hasPermission(user, 'admin')) return this.send("/msg " + user.substr(1) + ", Access denied.", room);
		devLog(user + " used " + Config.trigger + "reconnect on the \"" + this.id + "\" server.");
		this.disconnecting = true;
		disconnect(this.id, true);
	},

	// Misc Commands
	custom: function (target, room, user, pm) {
		if (!hasPermission(user, 'custom')) return this.send("/msg " + user.substr(1) + ", Access denied.", room);
		if (!target) return this.send(pm + "Usage: " + Config.trigger + "custom [room], message", room);
		var parts = target.split(',');
		for (var u in parts) parts[u] = parts[u].trim();
		var message = parts.slice(1).join(',');
		this.send(message, (toId(parts[0]) === "" ? room : parts[0]));
	},

	join: function (target, room, user, pm) {
		if (!hasPermission(user, 'invite')) return this.send("/msg " + user.substr(1) + ", Access denied.", room);
		if (!target) return this.send(pm + "Usage: " + Config.trigger + "join [room]", room);
		this.send("/join " + target);
	},

	leave: function (target, room, user, pm) {
		if (!hasPermission(user, 'leave')) return this.send("/msg " + user.substr(1) + ", Access denied.", room);
		this.send("/leave " + room, room);
	},

	say: function (target, room, user, pm) {
		if (!hasPermission(user, 'say')) return this.send("/msg " + user.substr(1) + ", Access denied.", room);
		if (!target) return this.send(pm + "Usage: " + Config.trigger + "say [message]", room);
		this.send(pm + " " + sanitize(target), room);
	},

	pickrandom: 'pick',
	choose: 'pick',
	pick: function (target, room, user, pm) {
		if (!hasPermission(user, 'broadcast')) pm = "/msg " + user.substr(1) + ", ";
		if (target.length < 3 || !~target.indexOf(',')) return this.send(pm + "Usage: " + Config.trigger + "pick [option], [option], ... - picks a random [option].  Requires at least two options.", room);
		this.send(pm + "Randomly selected: " + target.split(',').sample(), room);
	},

	helix: function (target, room, user, pm) {
		if (!hasPermission(user, 'broadcast')) pm = "/msg " + user.substr(1) + ", ";
		var helix = ["Signs point to yes.", "Yes.", "Reply hazy, try again.", "Without a doubt.", "As I see it, yes.", "You may rely on it.", "Concentrate and ask again.", "Outlook not so good.", "It is decidedly so.", "Better not tell you now.", "Very doubtful.", "Yes - definitely.", "It is certain.", "Cannot predict now.", "Most likely.", "Ask again later.", "My reply is no.", "Outlook good.", "Don't count on it."].sample();
		this.send(pm + helix, room);
	}
};

// uploadToHastebin function by TalkTakesTime (https://github.com/TalkTakesTime/Pokemon-Showdown-Bot)
function uploadToHastebin(toUpload, callback) {
	if (typeof callback !== 'function') return false;
	var reqOpts = {
		hostname: 'hastebin.com',
		method: 'POST',
		path: '/documents'
	};

	var req = http.request(reqOpts, function (res) {
		res.on('data', function (chunk) {
			// CloudFlare can go to hell for sending the body in a header request like this
			if (typeof chunk === 'string' && chunk.substr(0, 15) === '<!DOCTYPE html>') return callback('Error uploading to Hastebin.');
			var filename = JSON.parse(chunk.toString()).key;
			callback('http://hastebin.com/raw/' + filename);
		});
	});
	req.on('error', function (e) {
		callback('Error uploading to Hastebin: ' + e.message);
	});

	req.write(toUpload);
	req.end();
}

function loadRegdateCache() {
	try {
		regdateCache = JSON.parse(fs.readFileSync('config/regdate.json', 'utf8'));
	} catch (e) {}
}

function saveRegdateCache() {
	fs.writeFileSync('config/regdate.json', JSON.stringify(regdateCache));
}

function devLog(text) {
	fs.appendFile('logs/dev.log', '[' + new Date() + '] ' + text + '\n');
}

function hasPermission(user, permission) {
	if (~Config.admins.indexOf(toId(user))) return true;
	if (!permissions[permission]) return false;
	if (ranks.indexOf(user.charAt(0)) >= ranks.indexOf(permissions[permission])) return true;
	return false;
}
exports.hasPermission = hasPermission;

function loadPermissions() {
	try {
		JSON.parse(fs.readFileSync('config/permissions.json', 'utf8'));
	} catch (e) {
		fs.writeFileSync('config/permissions', Config.defaultPermissions);
	}
}
loadPermissions();

function savePermissions() {
	fs.writeFileSync('config/permissions.json', JSON.stringify(permissions));
}

function uncacheTree(root) {
	var uncache = [require.resolve(root)];
	do {
		var newuncache = [];
		for (var i of uncache) {
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

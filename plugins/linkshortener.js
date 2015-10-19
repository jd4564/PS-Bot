var TinyURL = require('tinyurl');

exports.commands = {
	shorten: function (target, room, user, pm) {
		if (!Commands.hasPermission(user, 'broadcast')) return false;
		if (this.id === 'showdown') return this.send("Link shorteners are not allowed on this server, unfortunately.", room);
		if (!target) return this.send("You did not specify a link to shorten.", room);
		var self = this;
		try {
			TinyURL.shorten(target.remove(' '), function (res) {
				return self.send(res, room);
			});
		} catch (e) {
			return this.send("Something went wrong when trying to shorten the link you provided...", room);
		}
	}
};

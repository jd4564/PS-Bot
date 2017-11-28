'use strict';

const fs = require('fs');
const https = require('https');

let regdateCache = {};
try {
	regdateCache = JSON.parse(fs.readFileSync('config/regdate.json', 'utf8'));
} catch (e) {}

module.exports = {
	sanitize: function (message) {
		if (message.charAt(0) === '/') message = '/' + message;
		if (message.charAt(0) === '!' || message.substr(0, 2) === '>>') message = ' ' + message;
		return message.replace(/\n/g, '');
	},
	log: function (text, serverid, error) {
		if (error) {
			fs.appendFileSync('logs/error.txt', '[' + serverid + '] ' + text);
		}
		fs.appendFileSync('logs/' + serverid + '.log', text + '\n');
		console.log(text);
	},
	randomString: function (length) {
		return Math.round((Math.pow(36, length + 1) - Math.random() * Math.pow(36, length))).toString(36).slice(1);
	},
	toTimeStamp: function (date, options) {
		// Return a timestamp in the form {yyyy}-{MM}-{dd} {hh}:{mm}:{ss}.
		// Optionally reports hours in mod-12 format.
		const isHour12 = options && options.hour12;
		let parts = [date.getFullYear(), date.getMonth() + 1, date.getDate(), date.getHours(), date.getMinutes(), date.getSeconds()];
		if (isHour12) {
			parts.push(parts[3] >= 12 ? 'pm' : 'am');
			parts[3] = parts[3] % 12 || 12;
		}
		parts = parts.map(val => val < 10 ? '0' + val : '' + val);
		return parts.slice(0, 3).join("-") + " " + parts.slice(3, 6).join(":") + (isHour12 ? " " + parts[6] : "");
	},
	regdate: function (target, callback) {
		target = toId(target);
		if (regdateCache[target]) return callback(regdateCache[target]);
		let options = {
			host: 'pokemonshowdown.com',
			port: 443,
			path: '/users/' + target + '.json',
			method: 'GET',
		};
		https.get(options, function (res) {
			let data = '';
			res.on('data', function (chunk) {
				data += chunk;
			}).on('end', function () {
				if (data.charAt(0) !== '{') data = JSON.stringify({registertime: 0});
				data = JSON.parse(data);
				let date = data['registertime'];
				if (date !== 0 && date.toString().length < 13) {
					while (date.toString().length < 13) {
						date = Number(date.toString() + '0');
					}
				}
				if (date !== 0) {
					regdateCache[target] = date;
					fs.writeFileSync('config/regdate.json', JSON.stringify(regdateCache));
				}
				callback((date === 0 ? false : date));
			});
		});
	},
	// toDurationString from: https://github.com/Zarel/Pokemon-Showdown/blob/master/chat.js
	toDurationString: function (number, options) {
		// TODO: replace by Intl.DurationFormat or equivalent when it becomes available (ECMA-402)
		// https://github.com/tc39/ecma402/issues/47
		const date = new Date(+number);
		const parts = [date.getUTCFullYear() - 1970, date.getUTCMonth(), date.getUTCDate() - 1, date.getUTCHours(), date.getUTCMinutes(), date.getUTCSeconds()];
		const unitNames = ["second", "minute", "hour", "day", "month", "year"];
		const positiveIndex = parts.findIndex(elem => elem > 0);
		if (options && options.hhmmss) {
			let string = parts.slice(positiveIndex).map(value => value < 10 ? "0" + value : "" + value).join(":");
			return string.length === 2 ? "00:" + string : string;
		}
		return parts.slice(positiveIndex).reverse().map((value, index) => value ? value + " " + unitNames[index] + (value > 1 ? "s" : "") : "").reverse().join(" ").trim();
	},
	// uploadToHastebin function by TalkTakesTime (https://github.com/TalkTakesTime/Pokemon-Showdown-Bot)
	uploadToHastebin: function (toUpload, callback) {
		if (typeof callback !== 'function') return false;
		let reqOpts = {
			hostname: 'hastebin.com',
			port: 443,
			method: 'POST',
			path: '/documents',
		};

		let req = https.request(reqOpts, function (res) {
			res.on('data', function (chunk) {
				// CloudFlare can go to hell for sending the body in a header request like this
				if (typeof chunk === 'string' && chunk.substr(0, 15) === '<!DOCTYPE html>') return callback('Error uploading to Hastebin.');
				let filename = JSON.parse(chunk.toString()).key;
				callback('http://hastebin.com/raw/' + filename);
			});
		});
		req.on('error', function (e) {
			callback('Error uploading to Hastebin: ' + e.message);
		});

		req.write(toUpload);
		req.end();
	},
};

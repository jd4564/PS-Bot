'use strict';

// Example configuration file

// The external IP address or domain of the server hosting your bot
// Used with the viewlogs command
exports.ip = '127.0.0.1';

// The port you want the web server to run on
exports.webport = 8000;

// A list of users that has full access to the bot
exports.admins = ['user1', 'user2'];

// This is the symbol that goes in front of all commands
exports.trigger = '.';

// Default permissions the bot will use if no permission file exists
exports.defaultPermissions = {
	'broadcast': '+',
	'viewlogs': '+',
	'say': '#',
	'leave': '#',
	'invite': '%',
};

/*exports.mysql = {
	host: 'localhost',
	port: 3306,
	dbName: 'psbot',
	user: 'username',
	password: 'password',
};*/

// A list of servers you want your bot to connect to
exports.servers = {
	"exampleserver": { // Put the servers id here. The id is the name with spaces removed and letters converted to lowercase
		id: 'exampleserver', // Put the server id here as well
		serverName: 'Example Server',
		ip: '127.0.0.1',
		port: 8000,
		ssl: false, // change to true if connecting via ssl
		autoreconnect: true,
		// You can either specify each room you want the bot to join
		// or you can have it join all official/unofficial rooms by using
		// rooms: 'all' or rooms: 'official'
		rooms: ['room1', 'room2', 'room3'],
		// Private rooms are hidden from the seen command and prevents non-admins from using viewlogs on them
		privaterooms: ['aprivateroom'],
		name: 'example-bot',
		pass: 'example-pass',
		trigger: '.', // This is the symbol that goes in front of all commands
		logchat: true, // required for viewlogs command.
		trusted: false, // change to true to enable developer commands on this server
		enableSeen: true, // whether tracking names for seen should be enabled on this server.
	},
	"anotherserver": {
		id: 'anotherserver',
		serverName: 'Another Server',
		ip: '127.0.0.2',
		port: 8000,
		autoreconnect: true,
		rooms: ['justarandomroom'],
		privaterooms: ['secretroom'],
		name: 'Another Example Bot',
		pass: 'Another Example Password',
		trigger: '*', // This is the symbol that goes in front of all commands
		logchat: ['lobby'], // only log chat in the room 'lobby'
	},
};

// This example use's synchronous file read and writes, in a real world
// environment you should use the asynchronous alternatives.

var SDSDS = require('../index.js');
var fs = require('fs');

var data = JSON.parse(fs.readFileSync("example.db"));
var sdsds = new SDSDS(undefined, undefined, data);
sdsds.on('listening', function() {
	console.log(sdsds.get("somethingToBeSaved"));
	sdsds.set("somethingToBeSaved", {something: "saved"});

	setInterval(function() {
		fs.writeFileSync("example.db", JSON.stringify(sdsds.getAll()));
	}, 1000);
});
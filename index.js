var JsonSocket = require('json-socket');
var dgram = require("dgram");
var net = require("net");
var util = require("util");
var os = require("os");

module.exports = SDSDS = function(host, port, data, udpSwarmPort, debugLevel) {
	var instance = this;
	
	this.host = host || this.findFirstNetworkInterfaceAddress();
	this.port = port || 9000;
	this.data = data || {};
	this.udpSwarmPort = udpSwarmPort || 18468;
	
	this.debugLevel = debugLevel || "ERR";
	
	
	var events = {};
	this.on = function(eventName, callback) {
		events[eventName] = events[eventName] || [];
		events[eventName].push(callback);
	};
	this.fire = function(eventName, _) {
		var args = Array.prototype.slice.call(arguments, 1);
		
		instance.debug("DBG", "firing event: " + eventName);

		if(!events[eventName])
			return;

		for(var i = 0, length = events[eventName].length; i < length; i++)
			events[eventName][i].apply(instance, args);
	}
	
	this.hostInformation = {
		name: this.host + ":" + this.port,
		host: this.host,
		port: this.port
	};
	
	this.hosts = {};
	this.connectedOutNodes = {};
	this.connectedInNodes = {};
	
	this.udp4 = dgram.createSocket("udp4");
	
	this.udp4.on('error', function(err) {
		instance.error(err);
	});
	
	this.udp4.on('close', function() {
		instance.close();
	});
	
	this.udp4.on('message', function(incoming_msg, rinfo) {
		try {
			var msg = JSON.parse(incoming_msg);
			if(msg.host == instance.hostInformation.host && msg.port == instance.hostInformation.port)
				return; // This is a message to ourselves!

			instance.debug("ALL", "udp message: " + incoming_msg);
			instance.connectToSwarmNode(msg);
		} catch(e) { }
	});
	
	this.udp4.on('listening', function() {
		var address = instance.udp4.address();
		instance.debug("DBG", "udp server listening " + address.address + ":" + address.port);
		setInterval(instance.sendHostBeacon.bind(instance), 5000);
	});
	
	this.udp4.bind(this.udpSwarmPort, function() {
		instance.udp4.setBroadcast(true);
		
		instance.tcp4 = net.createServer(function(socket) {
			socket = new JsonSocket(socket);
			socket.sendMessage({type: "handshake_start"});
			socket.on('error', function(err) { console.log("tcp4server - error", err); });
			socket.on('message', function(data) {
				instance.processInHandshake(socket, data);
			});
		}).listen(instance.hostInformation.port, undefined, undefined, function() {
			instance.debug("DBG", "tcp server listening " + instance.hostInformation.port);
			instance.fire('listening');
		});
	});
};

SDSDS.prototype.findFirstNetworkInterfaceAddress = function() {
	var ifaces = os.networkInterfaces();
	for(var iface in ifaces)
		for(var d in ifaces[iface])
			if(ifaces[iface][d].family == "IPv4")
				return ifaces[iface][d].address;
				
	return "127.0.0.1";
};

SDSDS.prototype.debug = function(level, message) {
	var instance = this;
	var levels = ["ERR", "WRN", "DBG", "ALL"];
	if(levels.indexOf(level) > levels.indexOf(this.debugLevel)) return;
	console.log(message);
};

SDSDS.prototype.error = function(err) {
	var instance = this;
	this.debug("ERR", err);
	this.close();
	this.fire("error", err);
};

SDSDS.prototype.close = function() {
	var instance = this;
	if(this.udp4) this.udp4.close();
	if(this.tcp4) this.tcp4.close();
	this.fire("close");
};

SDSDS.prototype.sendHostBeacon = function() {
	var instance = this;
	if(!this.udp4 || !this.tcp4) return;
	
	var message = new Buffer(JSON.stringify(this.hostInformation));
	this.udp4.send(message, 0, message.length, this.udpSwarmPort, "255.255.255.255", function(err, bytes) {
		if(err) instance.error(err);
		instance.debug("ALL", "udp broadcast beacon sent");
	});
};

SDSDS.prototype.connectToSwarmNode = function(nodeInformation) {
	var instance = this;
	if(this.connectedOutNodes[nodeInformation.name]) return;
	
	this.debug("DBG", "connecting to new node: " + nodeInformation.name);
	var socket = new net.Socket();
	socket.connect(nodeInformation.port, nodeInformation.host, function() {
		socket = new JsonSocket(socket);
		socket.name = nodeInformation.name;
		nodeInformation.socket = socket;
		instance.connectedOutNodes[socket.name] = {
			name: nodeInformation.name,
			host: nodeInformation.host,
			port: nodeInformation.port,
			socket: socket
		};
	});
	
	socket.on('message', function(data) {
		console.log("message", data);
		instance.processOut(instance.connectedOutNodes[socket.name], socket, data);
	});
	
	socket.on('error', function(err) { console.log("tcp4client - error", err); });
	
	socket.on('close', function() {
		instance.fire('disconnected', instance.connectedOutNodes[socket.name]);
		delete instance.connectedOutNodes[socket.name];
	});
};

SDSDS.prototype.processOut = function(node, socket, data) {
	var instance = this;
	
	this.debug("ALL", "> recieved handshake data from " + socket.name + ", " + data);	
	if(!data.type) return;
	
	switch(data.type) {
		case "handshake_start":
			socket.sendMessage({
				type: "host_details",
				host: instance.hostInformation
			});
			return;
		case "sync":
			this.processIncomingSync(node, data);
			socket.sendMessage({type: "handshake_end"});
			instance.fire('connected', node);
			return
	}
};

SDSDS.prototype.processInHandshake = function(socket, data) {
	var instance = this;
	
	this.debug("ALL", "< recieved handshake data from " + (socket.name ? socket.name : "unnamed socket") + ", " + data);	
	if(!data.type) return;
	
	switch(data.type) {		
		case "host_details":
			socket.name = data.host.name;
			instance.connectedInNodes[socket.name] = {
				name: socket.name,
				host: data.host.host,
				port: data.host.port,
				socket: socket
			};
			socket.sendMessage({
				type: "sync",
				data: instance.data
			});
			socket.on('error', function(err) {
				console.log("tcp4client - error", err);
				delete instance.connectedInNodes[socket.name];
				instance.fire('left', socket.name);
			});
			instance.fire('joined', socket.name);
			return;

		case "handshake_end":			
			socket._socket.removeAllListeners('message');
			socket.on('message', function(data) {
				instance.processIn(socket, data);
			});
			instance.debug("DBG", "connected to swarm node: " + socket.name);
			return;
	}
};

SDSDS.prototype.processIn = function(socket, data) {
	var instance = this;
	
	var node = this.connectedInNodes[socket.name];
	if(!node) return;
	
	this.debug("ALL", "< recieved data from " + socket.name + ", " + data);	
	if(!data.type) return;
	
	switch(data.type) {
		case "sync":
			return this.processIncomingSync(node, data);
			
		case "write":
			return this.processIncomingWrite(node, data);
	}
};

SDSDS.prototype.processIncomingSync = function(node, data) {
	this.debug("ALL", "syncing data with node " + node.name);
	for(var key in data.data) {
		data.data[key].timestamp = Date.now();
		if(this.data[key] === undefined) {
			this.data[key] = data.data[key];
		} else if(this.data[key].timestamp < data.data[key].timestamp) {
			this.data[key] = data.data[key];
		}
	}
	this.fire('data_sync', node, this.data);
};

SDSDS.prototype.processIncomingWrite = function(node, data) {
	this.debug("ALL", "writing data from node " + node.name);
	if(this.data[data.key] === undefined) {
		this.data[data.key] = data.value;
	} else if(this.data[data.key].timestamp < data.value.timestamp) {
		this.data[data.key] = data.value;
	}
	this.fire('data_write', node, data.key, data.value);
};

SDSDS.prototype.get = function(key) {
	var instance = this;
	return this.data[key];
};

SDSDS.prototype.set = function(key, value) {
	var instance = this;
	this.data[key] = value;
	this.data[key].timestamp = Date.now();
	for(var node in this.connectedOutNodes) {
		this.connectedOutNodes[node].socket.sendMessage({
			type: "write",
			key: key,
			value: this.data[key]
		});
	}
	
	return true;
};

SDSDS.prototype.getAll = function(data) {
	var instance = this;
	return this.data;
};
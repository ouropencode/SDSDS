# Self Discovering Synchronized Data Store
SDSDS is a data storage system that automatically discovers peers in the same subnet (using UDP broadcast) and synchronizes (over TCP) a shared data object between them. Changes propagate to all nodes and each node acts as a redundant to the other nodes. This system requires no central point of failure (other than the network itself).

## Installing
SDSDS only requires one other module, and does not require compilation. To get started with SDSDS should be as simple as: `npm install sdsds`

## Notes

 - Any data you store in the data store HAS to be an object and will have a 'timestamp' key added to it, this is to allow nodes to determine the last modified time.
 - You should frequently checkpoint the stored data to a file (or database), and load this file when the library starts. SDSDS does not manage persistance of the data, only sharing the data. (an example of howto checkpoint is provided in the 'examples' directory)

## Example
```
var SDSDS = require('sdsds');

var sdsds = new SDSDS();
sdsds.on('listening', function() {
    // from this point onwards, we can assume we have access to the data store.
    // however, this does not ensure we have synchronized with any nodes,
    // we may even be the first active node on the network.
	
	// any data you store in the data store HAS to be an object and will have
	// a 'timestamp' key added to it, this is to allow nodes to determine the
	// last modified time.
	
	sdsds.set("key", {"value":123});
	sdsds.get("key"); // => {"value":123, "timestamp": xxxxxx}
	sdsds.getAll();   // => {"key": {"value":123, "timestamp":xxxxxx}}
});
```

## How does SDSDS work?
SDSDS is a combination of a TCP server, a TCP client, a UDP client and a UDP server.

### Node Discovery
Nodes are discovered using UDP broadcast packets to discover other nodes in the same subnet. This is achieved through the use of beacon packets that are sent every five (5) seconds. After a node receives the knowledge of a previously unknown (or a no longer connected) node, it attempts to make a connection and switches to the TCP protocol for handling data transfer.

### Data Transfer
Internally there are two methods of data transfer over TCP. We current support a 'full synchronization' and a 'write notify'.

### Full Synchronization
The system will fully synchronize the whole shared data object whenever a new node connects to it. As a connection is made to the TCP server, the server sends the enter data object to the client. The client then decides which data is relevant compared to the data it initialized with. (Eventually the system may send periodic full synchronization packets to confirm the data store is still intact)

### Write Notify
After a key has been set or modified in the data store, the node will transmit to all other connected nodes that this write operation has been applied. The receiving nodes will then decide if the data is relevant compared to it's current data.

### Data relevancy
A node will decide upon receiving data if this data is relevant compared to the current data it has. This is all based around a unix timestamp, if the incoming data is older than the data the node currently has, it will be rejected. This poses an issue if the node's clocks are out of sync, however this isn't really an issue if data isn't being rapidly fired.

## Documentation
### Constructor
`new SDSDS([host], [port], [data], [udpSwarmPort], [debugLevel]); // => SDSDS instance`

**host**: The IP address/hostname of this machine (has to be accessible from the other nodes). If this is omitted the system will attempt to discover the IP address from your first network interface (this may be incorrect!)

**port**: The port that the TCP transfer runs upon.

**data**: An object containing the initial data for this node, if a node has crashed an is rebooting, this should contain the last data it knew about, if ommitted the data will remain empty until changed, or another node is connected.

**debugLevel**: This dictates the level of debugging output to console. It defaults to only errors ("ERR"), but the valid options are: "ERR", "WRN", "DBG" and "ALL".

### Methods
#### sdsds.get(key)
Retrieve data from the data store. Returns the data object, or undefined if the key was not found.

**key**: the unique key that your data is attached to. 

#### sdsds.set(key, value)
Set or modify data stored in the data store. Returns true if the data was saved successfully.

**key**: the unique key that your data is attached to.

**value**: an object that contains the data (a 'timestamp' key will be added to this object to track synchronization.

#### sdsds.getAll()
Retrieve all data stored in the data store. Returns the entire data store object.

#### sdsds.close()
Closes all open TCP and UDP connections. The instance of SDSDS is useless from this point and should be discarded.

#### sdsds.on(eventName, callback)
Listens for an event and executes the callback upon firing.

**eventName**: the event name (see 'Events' for a list of events).
**callback**: a function to call when the event fires.

#### sdsds.fire(eventName[, arguments])
Fires an event to all listeners. SDSDS does not internally listen for events, firing 'close' will NOT close SDSDS. This is mainly useful for triggering other code that is listening for SDSDS events.

**eventName**: the event name (see 'Events' for a list of events).
**arguments**: any number of arguments can be passed to the event (it's recommended to match the arguments that are usually provided by the event).


### Events
#### listening()
Fired when both the TCP and UDP servers have started.

#### error(errorMessage)
Fired when an internal error occurs (this should also pass through any TCP/UDP server/client errors)

#### close()
Fired when both the TCP and UDP servers have been closed.

#### disconnected(nodeInstance)
Fired when the current node disconnects from a remote node's TCP server.

**nodeInstance**: an object describing the node that the event applies to.

#### connected(nodeInstance)
Fired when the current node connects (and the handshake completes) to a remote node's TCP server.

**nodeInstance**: an object describing the node that the event applies to.

#### joined(nodeInstance)
Fired when a remote node connects to the current node's TCP server.

**nodeInstance**: an object describing the node that the event applies to.

#### left(nodeInstance)
Fired when a remote node connects to the current node's TCP server.

**nodeInstance**: an object describing the node that the event applies to.

#### data_sync(nodeInstance, data)
Fired when the whole data object has been synchronized with a remote object.

**nodeInstance**: an object describing the node that the event applies to.
**data**: the whole shared data object (after sync)

#### data_write(nodeInstance, key, value)
Fired when a data entry has been written to from a remote object.

**nodeInstance**: an object describing the node that the event applies to.
**key**: the key that was written too.
**value**: the value that was written.

## Contributing
SDSDS is currently a small project, maintained by a small team. We would welcome any contributions to the codebase.

## Maintainers
 - **Peter Corcoran** (peter@lemondigits.com)
 
## Licence & Copyright
SDSDS is an open source project licenced under the LGPLv3 licences, you can find more details regarding this licence in the 'LICENCE' file.
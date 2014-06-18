var SDSDS = require('../index.js');

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
const os = require('os');
const nets = os.networkInterfaces();
for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
        // Skip over non-IPv4 and internal (i.e. 127.0.0.1)
        if (net.family === 'IPv4' && !net.internal) {
            console.log(net.address);
        }
    }
}

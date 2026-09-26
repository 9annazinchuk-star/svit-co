const args=process.argv.slice(2);
const portIndex=args.indexOf('--port');
if(portIndex!==-1&&args[portIndex+1])process.env.PORT=args[portIndex+1];
require('../server.cjs');

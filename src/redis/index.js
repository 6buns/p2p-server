const { createClient } = require("redis");
require('dotenv').config()

const pubClient = createClient({ url: `redis://:${process.env.REDIS_PASS}@${process.env.REDIS_URL}` });
const subClient = pubClient.duplicate();
const client = pubClient.duplicate();

Promise.all([pubClient.connect(), subClient.connect()]).then(() => {
    io.adapter(createAdapter(pubClient, subClient));
}).catch(err => console.error(err));

Promise.all([client.connect()]).then(() => console.log('Redis Client Connected')).catch(err => console.error(err))

module.exports = {
    pubClient,
    subClient,
    client
}

const cors = require('cors');
const crypto = require('crypto');
const express = require("express");
const socket = require("socket.io");
const { createAdapter } = require("@socket.io/redis-adapter");
const { createClient } = require("redis");
const { Firestore } = require("@google-cloud/firestore");
require('dotenv').config()
require('@google-cloud/debug-agent').start({ serviceContext: { enableCanary: true } });

// App setup
const PORT = process.env.PORT || 8080;
const app = express();
const server = app.listen(PORT, function () {
    console.log(`Listening on port ${PORT}`);
    console.log(`http://localhost:${PORT}`);
});
const db = new Firestore();
const keyStoreRef = db.collection('keyStore')

// Static files
app.use(express.static("public"));

app.use(express.json())
app.use(express.urlencoded({ extended: false }))

app.use(cors())

app.get('/test', (req, res) => res.json({ 'yay': true }))

const getTURNCredentials = (name, secret) => {
    let unixTimeStamp = parseInt(Date.now() / 1000) + 24 * 3600,
        // this credential would be valid for the next 24 hours
        username = [unixTimeStamp, name].join(':'),
        password,
        hmac = crypto.createHmac('sha1', secret);
    hmac.setEncoding('base64');
    hmac.write(username);
    hmac.end();
    password = hmac.read();
    return {
        username,
        credential: password
    };
}

// Socket setup
const io = socket(server, {
    cors: {
        origin: ['*'],
    }
});

const pubClient = createClient({ url: `redis://:${process.env.REDIS_PASS}@${process.env.REDIS_URL}` });
const subClient = pubClient.duplicate();
const client = pubClient.duplicate();

Promise.all([pubClient.connect(), subClient.connect(), client.connect()]).then(() => {
    io.adapter(createAdapter(pubClient, subClient));
}).catch(err => console.error(err));

/**
 * charge the stripe_id for each new room creation.
 */

io.use((socket, next) => {
    verifyAPIKey(socket.handshake.auth.key).then(({ api_key, stripe_id }) => {
        socket.data.stripe_id = stripe_id
        socket.data.api_key = api_key
        next()
    }).catch((err) => next(err))
})

io.on("connection", function (socket) {
    console.log('Socket Joined : ', socket.id, socket.uid);

    socket.emit('connection', socket.id, io.of("/").adapter.rooms.size, [
        { urls: 'turn:stun.6buns.com', ...getTURNCredentials(socket.id, process.env.TURN_GCP_SECRET) }
    ]);

    socket.broadcast.emit('new-peer-connected', socket.id)

    socket.on('join-room', async (roomId, callback) => {
        // charge here room is new.
        let room;
        try {
            room = await getRoomFromRedis(roomId, socket.data.api_key)
        } catch (error) {
            callback('Room not present')
        }
        socket.join(room)
        for (const [roomName, id] of io.of("/").adapter.rooms) {
            if (roomName === room && id !== socket.id) {
                callback([...id])
            }
        }
        callback([])
    })

    socket.on('data', ({ to, from, data }) => {
        console.log(`From : ${from} :: To : ${to} :: sdp : ${data?.sdp?.type} :: candidate : ${data?.candidate}`)
        if (to) {
            io.to(to).emit('data', { to, from, data })
        } else {
            socket.emit('error', 'You are alone nobody to connect to.');
        }
    })

    socket.on('track-update', ({ id, update, room }) => {
        console.log(`Track : ${id} :: room : ${room} :: update : ${update}`)
        socket.to(room).emit('track-update', { id, update });
    })

    socket.on('disconnect', () => {
        console.log('Socket Left : ', socket.id, socket.adapter.sids)
    })
});

io.of('/').adapter.on('create-room', (room) => {
    console.log(`room ${room} was created.`);
})

io.of('/').adapter.on('delete-room', (room) => {
    console.log(`room ${room} was deleted.`)
})

io.of('/').adapter.on('join-room', (room, id) => {
    console.log(`socket ${id} has joined room ${room}`);
})

io.of('/').adapter.on('leave-room', (room, id) => {
    console.log(`socket ${id} has left room ${room}`);
    io.in(room).emit('peer-disconnected', id)
})

/**
 * Verify API key, create a room with provided room name.
 */
app.post('/room', async (req, res) => {
    const { apiKey, roomId } = req.body
    try {
        const { stripe_id } = await verifyAPIKey(apiKey);
        const { redis_response, record } = await createRoomInRedis(roomId, apiKey, stripe_id)
        res.status(200).json({ redis_response, record })
    } catch (error) {
        res.status(500).json({ error })
    }
})

const verifyAPIKey = async (apiKey) => {
    return new Promise(async (resolve, reject) => {
        const apiHash = crypto.createHash('md5').update(apiKey).digest('hex');
        const doc = await keyStoreRef.doc(apiHash).get();
        if (doc.exists) {
            resolve(doc.data());
        } else {
            reject('Document does not exsists')
        }
    })
}

const getRoomFromRedis = (roomId, apiKey) => {
    return new Promise((resolve, reject) => {
        const roomKeyHash = crypto.createHash('md5').update(`${apiKey}${roomId}`).digest('hex')

        client.get(roomKeyHash, (err, data) => {
            if (data) resolve(data)
            else reject(err)
        })
    })
}

const createRoomInRedis = (roomId, apiKey, stripe_id) => {
    return new Promise(async (resolve, reject) => {
        const validTill = Date.now() + (60 * 30 * 1000)
        const roomKeyHash = crypto.createHash('md5').update(`${apiKey}${roomId}`).digest('hex')
        let redis_response, record;
        try {
            redis_response = await client.set(roomKeyHash, JSON.stringify({
                roomId,
                createdAt: Date.now(),
                validTill,
            }), {
                PXAT: validTill,
                NX: true
            })
            record = await chargeUser(stripe_id)
        } catch (error) {
            reject(error)
        }
        resolve({ redis_response, record })
    });
}

const chargeUser = (stripe_id) => {
    return new Promise(async (resolve, reject) => {
        try {
            const stripe = require('stripe')('sk_test_51KNlK1SCiwhjjSk0Wh83gIWl21JdXWfH9Gs9NjQr4sos7VTNRocKbvipbqO0LfpnB6NvattHJwLJaajmxNbyAKT900X1bNAggO');

            const subscription_list = await stripe.subscriptions.list({
                customer: stripe_id
            })

            const subscription_status = subscription_list.data[0].status
            const subscription_id = subscription_list.data[0].items.data[0].id

            if (subscription_status !== 'active') {
                reject(`Subscription should be active but is ${subscription_status}`)
            }

            const usageRecord = await stripe.subscriptionItems.createUsageRecord(
                subscription_id,
                { quantity: 1, timestamp: Date.now() }
            );

            if (usageRecord) resolve(usageRecord)
            else reject('Unable to create usage record.')
        } catch (error) {
            reject(error)
        }
    })
}

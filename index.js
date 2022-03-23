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

    console.log('Socket Joined : ', socket.id, socket.data.api_key);

    socket.emit('connection', socket.id, io.of("/").adapter.rooms.size, [
        { urls: 'turn:stun.6buns.com', ...getTURNCredentials(socket.id, process.env.TURN_GCP_SECRET) }
    ]);

    socket.on('update-socket-id', ({ room, data }) => {
        console.log(`Socket ID update :: room : ${room} :: name : ${data.name} :: ID : ${data.id}`)
        socket.to(room).emit('socket-update', data);
    })

    socket.on('join-room', async ({ roomId, name }, callback) => {
        // charge here room is new.
        let room;
        try {
            const dataJson = await getRoomFromRedis(roomId, socket.data.api_key);
            if (!dataJson) {
                callback({
                    error: 'Room not present'
                })
                socket.disconnect(true)
            } else {
                room = dataJson.id
                socket.data.room = { ...dataJson }
                socket.join(room)
                // socket.broadcast.emit('new-peer-connected', socket.id)
                for (const [roomName, id] of io.of("/").adapter.rooms) {
                    if (roomName === room && id !== socket.id) {
                        callback({
                            res: [...id]
                        })
                    }
                }
                socket.data.join = Date.now()
                socket.data.name = name
            }
        } catch (error) {
            error ? callback({ error }) : callback({ error: 'Room not present' })
            socket.disconnect(true)
        }
    })

    socket.on('connection-request', ({ from, to, data }) => {
        io.to(to).emit('peer-connection-request', { from, to, data })
        console.log(`Connection Request from ${from} to ${(to)}.`)
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
        socket.data.left = Date.now()
        socket.data.socketId = socket.id
        saveSession(socket.data)
    })
});

io.of('/').adapter.on('create-room', (room) => {
    console.log(`room ${room} was created.`);
})

io.of('/').adapter.on('delete-room', (room) => {
    console.log(`room ${room} was deleted.`)
    chargeRoom(room, Date.now())
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
    console.log(await client.ping())
    try {
        const { stripe_id } = await verifyAPIKey(apiKey);
        const { redis_response, record } = await createRoomInRedis(roomId, apiKey, stripe_id)
        res.status(200).json({ redis_response, record })
    } catch (error) {
        res.status(500).json({ error })
    }
})

app.post('/room/get', async (req, res) => {
    const { apiKey, roomId } = req.body
    console.log(await client.ping())
    try {
        await verifyAPIKey(apiKey);
        const data = await getRoomFromRedis(roomId, apiKey)
        res.status(200).json({ data })
    } catch (error) {
        res.status(500).json({ error })
    }
})

app.post('/room/update', async (req, res) => {
    const { apiKey, roomId } = req.body
    try {
        const { stripe_id } = await verifyAPIKey(apiKey);
        const { redis_response, record } = await updateRoomInRedis(roomId, apiKey, stripe_id)
        res.status(200).json({ redis_response, record })
    } catch (error) {
        res.status(500).send(error)
    }
})

const verifyAPIKey = async (apiKey) => {
    return new Promise(async (resolve, reject) => {
        const apiHash = crypto.createHash('md5').update(apiKey).digest('hex');
        try {
            const doc = await keyStoreRef.doc(apiHash).get();
            if (doc.exists) {
                resolve(doc.data());
            } else {
                reject('Document does not exsists')
            }
        } catch (error) {
            reject(error.message)
        }
    })
}

const getRoomFromRedis = (roomId, apiKey) => {
    return new Promise(async (resolve, reject) => {
        const roomKeyHash = crypto.createHash('md5').update(`${apiKey}${roomId}`).digest('hex')
        try {
            console.log(await client.ping())
            const data = JSON.parse(await client.get(roomKeyHash))
            console.log(`Cached room ${data.roomId} from redis expiring in ${data.validTill}.`, data)
            resolve({ ...data })
        } catch (error) {
            reject(error.message)
        }
    })
}

const createRoomInRedis = (roomId, apiKey, stripe_id) => {
    return new Promise(async (resolve, reject) => {
        const apiHash = crypto.createHash('md5').update(apiKey).digest('hex')
        const roomHash = crypto.createHash('md5').update(roomId).digest('hex')
        const createdAt = Date.now()
        const validTill = Date.now() + 86400000
        const sessionId = crypto.randomBytes(20).toString('hex').slice(0, 20)
        const roomKeyHash = crypto.createHash('md5').update(`${roomId}`).digest('hex')
        let redis_response, record;
        try {
            redis_response = await client.set(roomKeyHash, JSON.stringify({
                id: roomId,
                apiHash,
                sessionId,
                createdAt,
                validTill,
            }), {
                NX: true
            })
            console.log(`Created room ${roomId} in redis expiring in ${validTill}.`)
            // record = await chargeUser(stripe_id)
            await keyStoreRef.doc(apiHash).collection('rooms').doc(roomHash).collection('sessions').doc(sessionId).set({
                createdAt,
                validTill,
                peers: []
            })
        } catch (error) {
            reject(error)
        }
        resolve({ redis_response, record })
    });
}

const updateRoomInRedis = (roomId, apiKey, stripe_id) => {
    return new Promise(async (resolve, reject) => {
        const roomKeyHash = crypto.createHash('md5').update(`${apiKey}${roomId}`).digest('hex')
        try {
            await client.del(roomKeyHash)
            const data = await createRoomInRedis(roomId, apiKey, stripe_id)
            resolve(data)
        } catch (error) {
            reject(error.message)
        }
    })

}

const chargeUser = (stripe_id, quantity) => {
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
                { quantity, timestamp: Math.ceil(Date.now() / 1000) }
            );

            if (usageRecord) resolve(usageRecord)
            else reject('Unable to create usage record.')
        } catch (error) {
            reject(error.message)
        }
    })
}

const saveSession = async (roomData) => {
    const { stripe_id, api_key, name, socketId, room, join, left } = roomData
    const apiHash = crypto.createHash('md5').update(api_key).digest('hex')
    const roomHash = crypto.createHash('md5').update(room.id).digest('hex')

    const peer = {
        name: name,
        socketId: socketId,
        join: join,
        left: left
    }

    try {
        await keyStoreRef.doc(apiHash).collection('rooms').doc(roomHash).collection('sessions').doc(room.sessionId).update({
            peers: Firestore.FieldValue.arrayUnion({ ...peer })
        })
    } catch (error) {
        console.error(error)
    }
}

const chargeRoom = async (room, endedTime) => {
    const roomHash = crypto.createHash('md5').update(`${room}`).digest('hex')
    try {
        // fetch room and its details.
        console.log(await client.ping())
        const { apiHash, sessionId } = JSON.parse(await client.get(roomHash))

        const sessionData = await keyStoreRef.doc(apiHash).collection('rooms').doc(roomHash).collection('sessions').doc(sessionId).get();
        if (!sessionData.exists) {
            console.error(`Room Data Does not exsist for :
                room : ${room},
                apiHash: ${apiHash},
                sessionId: ${sessionId}
            `)
        }
        const { createdAt, validTill, peers } = sessionData.data()
        const time = 0;
        peers.forEach(peer => {
            if (peer.left && peer.join) {
                time += (peer.left - peer.join)
            } else {
                time += endedTime - createdAt
            }
        })

        const quantity = Math.ceil(time / 60000)
        const apiData = await keyStoreRef.doc(apiHash).get()
        if (!apiData.exists) {
            console.error(`Unable to fetch API Data : ${apiHash}`)
        }

        const { stripe_id } = apiData.data()

        chargeUser(stripe_id, quantity).then(() => {
            console.log(`User Charged`)
        }).catch(console.error)
    } catch (error) {
        console.error(error)
    }
}

// const room = {
//   roomId: {
//     apiKey: "",
//     createdAt: "",
//     endedAt: "",
//     peers: [
//       {
//         peerId: {
//           join: "",
//           left: "",
//         },
//       },
//     ],
//   },
// };

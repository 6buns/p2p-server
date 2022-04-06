const cors = require('cors');
const crypto = require('crypto');
const express = require("express");
const socket = require("socket.io");
const { createAdapter } = require("@socket.io/redis-adapter");
const { createClient } = require("redis");
const { Firestore } = require("@google-cloud/firestore");
require('dotenv').config()
require('@google-cloud/debug-agent').start({ serviceContext: { enableCanary: true } });
const jose = require('jose')

// App setup
const PORT = process.env.PORT || 8080;
const app = express();
const server = app.listen(PORT, function () {
    console.log(`Listening on port ${PORT}`);
    console.log(`http://localhost:${PORT}`);
});
const db = new Firestore();
const keyStoreRef = db.collection('keyStore')
const sessionsRef = db.collection('sessions')

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

Promise.all([pubClient.connect(), subClient.connect()]).then(() => {
    io.adapter(createAdapter(pubClient, subClient));
}).catch(err => console.error(err));

Promise.all([client.connect()]).then(() => console.log('Redis Client Connected')).catch(err => console.error(err))

/**
 * charge the customerId for each new room creation.
 */

io.use((socket, next) => {
    if (socket.handshake.auth.key === 'DEMO') {
        next(socket)
        // if (!(socket.io.engine.hostname.match('6buns.com/demo'))) {
        // }
    }
    verifySecretKey(socket.handshake.auth.key).then(({ apiKey, customerId, secretKey }) => {
        socket.data.customerId = customerId
        socket.data.apiKey = apiKey
        socket.data.secret = secretKey
        next()
    }).catch((err) => next(err))
})

io.on("connection", function (socket) {

    console.log('Socket Joined : ', socket.id, socket.data.apiKey);

    socket.emit('connection', socket.id, io.of("/").adapter.rooms.size, [
        { urls: 'turn:stun.6buns.com', ...getTURNCredentials(socket.id, process.env.TURN_GCP_SECRET) }
    ]);

    socket.on('message', () => handleMessage({ type, from, to, room, token }, func, socket))

    const stats =

        socket.on('disconnect', () => {
            console.log('Socket Left : ', socket.id, socket.adapter.sids)
            socket.data.left = Date.now()
            socket.data.socketId = socket.id
            saveSession(socket.data)
        })
});

const handleMessage = async ({ type, from, to, room, token }, func, socket) => {
    let messageType = undefined;

    if (room) {
        messageType = 'announce';
    }
    if ((from && to)) {
        messageType = 'direct';
    }
    if (type === 'PONG') {
        messageType = 'process';
    }
    if (func || type === 'room-join') {
        messageType = 'callback';
    }

    switch (messageType) {
        case 'direct': {
            if (type === 'connection-request') {
                if (to) {
                    io.to(to).emit('message', { type: 'peer-connection-request', from, to, room, token })
                } else {
                    socket.emit('error', 'You are alone nobody to connect to.');
                }
            } else {
                if (to) {
                    io.to(to).emit('message', { type, from, to, room, token })
                } else {
                    socket.emit('error', 'You are alone nobody to connect to.');
                }
            }
            break;
        }
        case 'announce': {
            if (type === 'update-socket-id') {
                socket.to(room).emit('message', { type: 'socket-update', from, to, room, token });
            } else {
                socket.to(room).emit('message', { type, from, to, room, token });
            }
            break;
        }
        case 'callback': {
            // charge here room is new.
            let room;
            try {
                const dataJson = await getRoomFromRedis(room, socket.data.apiKey);
                if (!dataJson) {
                    func({
                        error: 'Room not present'
                    })
                    socket.disconnect(true)
                } else {
                    room = dataJson.id
                    socket.data.room = { ...dataJson }
                    socket.join(room)
                    io.in(room).emit('ping')

                    for (const [roomName, id] of io.of("/").adapter.rooms) {
                        if (roomName === room && id !== socket.id) {
                            func({
                                res: [...id]
                            })
                        }
                    }
                    socket.data.join = Date.now()
                    socket.data.name = dataJson.name
                }
            } catch (error) {
                error ? func({ error }) : func({ error: 'Room not present' })
                socket.disconnect(true)
            }
            break;
        }
        case 'process': {
            if (type === 'PONG') {
                try {
                    const data = await jose.jwtVerify(token, socket.data.secret)
                    saveToDB(data, socket.data)
                } catch (error) {
                    console.error(error)
                }
            }
            break;
        }
        default:
            break;
    }
}

io.of('/').adapter.on('create-room', (room) => {
    console.log(`room ${room} was created.`);
})

io.of('/').adapter.on('delete-room', (room) => {
    console.log(`room ${room} was deleted.`)
    removeRoom(room)
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

app.post('/secret', async (req, res) => {
    const { apiKey } = req.body
    if (!apiKey) {
        res.status(500).send('API Key Missing')
    }
    try {
        await verifyAPIKey(apiKey)
        const secretKey = await generateSecret(apiKey)
        res.status(200).json({ secretKey })
    } catch (error) {
        res.status(500).json({
            message: "Invalid or Incorrect API key",
            error
        })
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

const verifySecretKey = async (secret) => {
    console.log(secret)
    return await keyStoreRef.where('secretKey', '==', secret).get().then((docs) => {
        console.log(docs.empty, docs[0]);
        return docs[0].data();
    }).catch(console.error)
}

const getRoomFromRedis = (roomId, apiKey) => {
    return new Promise(async (resolve, reject) => {
        const roomKeyHash = crypto.createHash('md5').update(`${roomId}`).digest('hex')
        let data = {};
        try {
            console.log(await client.ping())
            data = JSON.parse(await client.get(roomKeyHash))
            if (!data) {
                // no room data
                data = await createRoomInRedis(roomId, apiKey)
            }
            console.log(`Cached room ${data.roomId} from redis expiring in ${data.validTill}.`, data)
            resolve({ ...data })
        } catch (error) {
            reject(error.message)
        }
    })
}

const generateSecret = async (apiKey) => {
    const apiHash = crypto.createHash('md5').update(apiKey).digest('hex')
    const secretKey = await jose.generateSecret('ES256')

    return keyStoreRef.doc(apiHash).set({
        secretKey,
    }, { merge: true }).then(() => {
        return secretKey
    }).catch(console.error)
}

const createRoomInRedis = (roomId, apiKey) => {
    return new Promise(async (resolve, reject) => {
        if (!roomId) {
            roomId = crypto.randomBytes(5).toString('hex').slice(0, 5)
        }
        const apiHash = crypto.createHash('md5').update(apiKey).digest('hex')
        const createdAt = Date.now()
        const validTill = Date.now() + 86400000
        const sessionId = crypto.randomBytes(20).toString('hex').slice(0, 20)
        const sessionHash = crypto.createHash('md5').update(sessionId).digest('hex')
        const roomKeyHash = crypto.createHash('md5').update(`${roomId}`).digest('hex')
        let redis_response, record;
        const roomData = {
            id: roomId,
            apiHash,
            sessionId,
            createdAt,
            validTill,
        }
        try {
            redis_response = await client.set(roomKeyHash, JSON.stringify({ ...roomData }), {
                NX: true
            })
        } catch (error) {
            reject(error)
        }

        try {
            console.log(`Created room ${roomId} in redis expiring in ${validTill}.`)
            const firestore_response = await sessionsRef.doc(sessionHash).set({
                ...roomData,
                peers: []
            })
        } catch (error) {
            reject(error)
        }
        resolve({ redis_response, firestore_response, roomData })
    });
}

const chargeUser = (customerId, quantity) => {
    return new Promise(async (resolve, reject) => {
        try {
            const stripe = require('stripe')('sk_test_51KNlK1SCiwhjjSk0Wh83gIWl21JdXWfH9Gs9NjQr4sos7VTNRocKbvipbqO0LfpnB6NvattHJwLJaajmxNbyAKT900X1bNAggO');

            const subscription_list = await stripe.subscriptions.list({
                customer: customerId
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
    const { customerId, apiKey, name, socketId, room, join, left } = roomData
    const apiHash = crypto.createHash('md5').update(apiKey).digest('hex')
    const roomHash = crypto.createHash('md5').update(room.id).digest('hex')

    const peer = {
        name: name,
        socketId: socketId,
        join: join,
        left: left
    };

    let time = 0;

    try {
        await keyStoreRef.doc(apiHash).collection('rooms').doc(roomHash).collection('sessions').doc(room.sessionId).update({
            peers: Firestore.FieldValue.arrayUnion({ ...peer })
        })
    } catch (error) {
        console.error(error)
    }

    try {
        if (left && join) {
            time += (left - join)
        } else {
            time += Date.now() - room.createdAt
        }
        const quantity = Math.ceil(time / 60000)
        await chargeUser(customerId, quantity)
    } catch (error) {
        console.error(error)
    }
}

const removeRoom = async (room) => {
    try {
        const res = await client.del(roomHash)
        if (res === 1) {
            console.log(`Redis Room Deleted : ${room}`)
        } else {
            console.log(`Unable to delete Redis Room : ${room}`)
        }
    } catch (error) {
        console.error(error)
    }
}

const saveToDB = async (data, user) => {
    // apiKey, customerId, secret, join, left, name, room: { id: roomId, apiHash, sessionId, createdAt, validTill }
    const { room: { sessionId } } = user;

    const sessionHash = crypto.createHash('md5').update(sessionId).digest('hex')
    return await sessionsRef.doc(sessionHash).collection('stats').add({
        ...data
    })
}

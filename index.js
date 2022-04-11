import { handleMessage } from './src/handleMessage.js';
import { verifyAPIKey } from './verifyAPIKey';
import { verifySecretKey } from './src/firestore/verifySecretKey';
import { generateSecret } from './generateSecret';
import { saveSession } from './saveSession';
import { removeRoom } from './removeRoom';

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
export const keyStoreRef = db.collection('keyStore')
export const sessionsRef = db.collection('sessions')

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
export const io = socket(server, {
    cors: {
        origin: ['*'],
    }
});

const pubClient = createClient({ url: `redis://:${process.env.REDIS_PASS}@${process.env.REDIS_URL}` });
const subClient = pubClient.duplicate();
export const client = pubClient.duplicate();

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

    socket.on('message', ({ type, from, to, room, token }, func) => handleMessage({ type, from, to, room, token }, func, socket))

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

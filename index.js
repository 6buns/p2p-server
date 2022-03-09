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

// Static files
app.use(express.static("public"));

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
        origin: ['p2p.6buns.com'],
    }
});

const pubClient = createClient({ url: `redis://:${process.env.REDIS_PASS}@${process.env.REDIS_URL}` });
const subClient = pubClient.duplicate();
const keyStoreRef = db.collection('keyStore')

Promise.all([pubClient.connect(), subClient.connect()]).then(() => {
    io.adapter(createAdapter(pubClient, subClient));
}).catch(err => console.error(err));

io.use((socket, next) => {
    const apiHash = crypto.createHash('md5').update(socket.handshake.auth.key).digest('hex');
    keyStoreRef.doc(apiHash).get().then(doc => {
        if (doc.exists) {
            const { uid } = doc.data();
            socket.uid = uid
            next()
        } else {
            next(new Error("Unauthorized"))
        }
    }).catch(err => next(new Error(err)));
})

io.on("connection", function (socket) {
    console.log('Socket Joined : ', socket.id);

    socket.emit('connection', socket.id, io.of("/").adapter.rooms.size, [
        { urls: 'turn:stun.6buns.com', ...getTURNCredentials(socket.id, process.env.TURN_GCP_SECRET) }
    ]);

    socket.broadcast.emit('new-peer-connected', socket.id)

    socket.on('join-room', (room, callback) => {
        socket.join(room)
        let peerList = []
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
        socket.to(room).emit({ id, update });
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

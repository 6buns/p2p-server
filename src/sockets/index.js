
const { saveSession } = require("../firestore/saveSession");
const { verifySecretKey } = require("../firestore/verifySecretKey");
const { getTURNCredentials } = require("../getTURNCredentials");
const { handleMessage } = require("../handleMessage");
const { removeRoom } = require("../redis/removeRoom");

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

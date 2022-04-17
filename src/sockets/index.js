
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
        console.log(`Host : ${socket.handshake.headers.host} :: ORIGIN : ${socket.handshake.headers.origin} :: Address : ${socket.handshake.headers['x-forwarded-for']}`)
        if ((socket.handshake.headers.host === 'p2p.6buns.com') && ['http://localhost:5555', 'https://6buns.com'].includes(socket.handshake.headers.origin)) {
            socket.data = {
                ...socket?.data,
                apiKey: 'DEMO',
                customerId: 'DEMO',
                secretKey: 'DEMO'
            }
            next()
        } else {
            next(new Error('Unauthorised Access'))
        }
    }
    else {
        verifySecretKey(socket.handshake.auth.key).then(({ apiKey, customerId, secretKey }) => {
            socket.data = { ...socket?.data, apiKey, customerId, secretKey };
            console.log(`SOCKET DATA :: CUSTOMER ID : ${socket.data.customerId} :: API KEY : ${socket.data.apiKey} :: SECRET : ${socket.data.secret} `)
            next()
        }).catch((err) => next(err))
    }
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
        saveSession({ ...socket.data })
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

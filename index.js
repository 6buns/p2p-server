const { verifyAPIKey } = require('./src/firestore/verifyAPIKey');
const { generateSecret } = require('./src/firestore/generateSecret');

const cors = require('cors');
const express = require("express");
const socket = require('socket.io');
const { create } = require('./src/redis/room/set');
const { remove } = require('./src/redis/room/delete');
const { io } = require('socket.io-client');
require('@google-cloud/debug-agent').start({ serviceContext: { enableCanary: true } });

// App setup
const PORT = process.env.PORT || 8080;
const app = express();

const server = app.listen(PORT, function () {
    console.log(`Listening on port ${PORT}`);
    console.log(`http://localhost:${PORT}`);
});

// Static files
app.use(express.static("public"));

app.use(express.json())
app.use(express.urlencoded({ extended: false }))

app.use(cors())

// Socket setup
global.io = socket(server, {
    cors: {
        origin: ['*'],
    },
    pingTimeout: 30000,
});

require("./src/sockets");

app.get('/test', (req, res) => res.json({ 'yay': true }))

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

app.post('/room/create', (req, res) => {
    // verify credentials
    const { room: { id, passcode, permissions, size, bypass }, api: { key, secret } } = req.body;
    let room_data;
    try {
        await verifyAPIKey(key, secret)
    } catch (error) {
        res.json(error)
    }
    // create room
    // store in redis
    try {
        ({ room_data } = await create({ id, passcode, permissions, size, bypass }));
    } catch (error) {
        res.json({ error })
    }    // return
    res.json({ room_data })
})

app.post('/room/delete', (req, res) => {
    // verify credentials
    const { room: { id }, api: { key, secret } } = req.body;
    try {
        await verifyAPIKey(key, secret)
    } catch (error) {
        res.json(error)
    }

    // remove room
    try {
        let response = await remove(id)
        res.json({ response })
    } catch (error) {
        res.json(error)
    }
})

app.post('/room/remove/peer', (req, res) => {
    const { room: { id }, peers, api: { key, secret } } = req.body;
    try {
        await verifyAPIKey(key, secret)
    } catch (error) {
        res.json(error)
    }

    try {
        await io.in(id).socketsLeave([...peers]);
    } catch (error) {
        res.json(error)
    }

    res.sendStatus(200)
})

const { verifyAPIKey } = require('./src/firestore/verifyAPIKey');
const { generateSecret } = require('./src/firestore/generateSecret');

const cors = require('cors');
const express = require("express");
const socket = require('socket.io');
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
    }
});

require("./src/sockets")();

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

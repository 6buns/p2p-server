
const { getRoomFromRedis } = require("./redis/getRoomFromRedis");
const { getDemoRoomsRedis } = require("./redis/getDemoRoomsRedis")
const { saveToDB } = require("./firestore/saveToDB");
const { decrypt } = require("./helper");
const has = require('has-value');
const { saveStats } = require("./redis/saveStats");

exports.handleMessage = async ({ type, from, to, room, token }, func, socket) => {
    let messageType = undefined;
    /**
     * announce - update-socket-id, track-update,
     * direct - connection-request, data
     * callback - room-join,
     * process - set-stats
     */

    if (['update-socket-id', 'track-update'].includes(type)) {
        messageType = 'announce'
    } else if (['connection-request', 'data'].includes(type)) {
        messageType = 'direct'
    } else if (['room-join'].includes(type)) {
        messageType = 'callback'
    } else if (['set-stats'].includes(type)) {
        messageType = 'process'
    }

    switch (messageType) {
        case 'direct': {
            if (type === 'connection-request') {
                if (to) {
                    io.to(to).emit('message', { type: 'peer-connection-request', from, to, room, token });
                } else {
                    socket.emit('error', 'You are alone nobody to connect to.');
                }
            } else {
                if (to) {
                    io.to(to).emit('message', { type, from, to, room, token });
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
            const { name } = decrypt(token)
            let roomData = {};

            try {
                if (socket.data.apiKey === 'DEMO') {
                    roomData = await getDemoRoomsRedis();
                } else {
                    if (has(room)) {
                        try {
                            roomData = await getRoomFromRedis(room, socket.data.apiKey);
                        } catch (error) {
                            console.log(error)
                            error ? func({ error }) : func({ error: 'Room not present' });
                            socket.disconnect(true);
                        }
                    } else {
                        room = randomBytes(6).toString('hex').slice(0, 6);
                        ({ roomData } = await createRoomInRedis(room, apiKey));
                    }
                }
                console.log(`ROOM : ${roomData.id} :: VALID TILL : ${roomData.validTill}`, roomData);
                room = roomData.id;
                socket.data.room = roomData;
                socket.join(room);
                const sockets = await io.of("/").in(room).fetchSockets();
                console.log(`Sockets : ${sockets.map(e => e.id)}`)
                func({
                    res: sockets.map(e => e.id),
                    room: roomData.id
                });
                socket.data.join = Date.now();
                socket.data.name = name
            } catch (error) {
                console.log(error)
                error ? func({ error }) : func({ error: 'Error in accessing room.' });
                socket.disconnect(true);
            }
            break;
        }
        case 'process': {
            if (type === 'set-stats') {
                try {
                    const data = JSON.parse(atob(token));
                    saveStats(room, socket.data.name, data);
                } catch (error) {
                    console.error(error);
                }
            }
            break;
        }
        default:
            break;
    }
};


const { getRoomFromRedis } = require("./redis/getRoomFromRedis");
const { getDemoRoomsRedis } = require("./redis/getDemoRoomsRedis")
const { saveToDB } = require("./firestore/saveToDB");
const { decrypt } = require("./helper");
const has = require('has-value');
const { saveStats } = require("./redis/saveStats");
const { createRoomInRedis } = require("./redis/createRoomInRedis");
const { updateRoom } = require("./redis/updateRoom");

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
            const { name, passcode, permissions, size, bypass } = decrypt(token)
            let roomData = {};

            try {
                // Getting Room Data from Redis
                if (socket.data.apiKey === 'DEMO') {
                    roomData = await getDemoRoomsRedis();
                } else {
                    if (has(room)) {
                        try {
                            roomData = await getRoomFromRedis(room, socket.data.apiKey);
                        } catch (error) {
                            console.log(error)
                            error ? func({ error: error.message }) : func({ error: 'Room not present' });
                            socket.disconnect(true);
                        }
                    } else {
                        id = randomBytes(6).toString('hex').slice(0, 6);
                        ({ roomData } = await createRoomInRedis({ id, passcode, permissions, size, bypass }, apiKey));
                    }
                }
                // Joining Room, if conditions are met.
                const result = checkConditions(roomData, passcode)
                console.log(`CONDITIONS CHECK :`, { ...result })
                if (result.state) {
                    console.log(`ROOM : ${roomData.id} :: VALID TILL : ${roomData.validTill}`, roomData);
                    room = roomData.id;
                    socket.data.room = { ...roomData };
                    socket.join(room);
                    const sockets = await io.of("/").in(room).fetchSockets();
                    console.log(`Sockets : ${sockets.map(e => e.id)}`)
                    socket.data.join = Date.now();
                    socket.data.name = name;
                    roomData.currentUserCount += 1;
                    updateRoom({ ...roomData });
                    func({
                        res: sockets.map(e => e.id),
                        room: {
                            id,
                            permissions: roomData.permissions
                        },
                    });
                } else {
                    func({ error: `Following room conditions did not meet the requirements. ${result.conditions}` })
                }
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

const checkConditions = (roomData, passcode) => {
    if (roomData.conditions.bypass) return { state: true }
    const conditions = roomData['conditions']
    const conditionsNotMet = [];
    for (const type of conditions) {
        // check if user count is less than or equal to size.
        if (!(roomData.currentUserCount + 1 <= conditions["size"])) {
            conditionsNotMet.push(type)
        }
        // check if passcode is equal to pass code provided to the user.
        if (conditions['passcode'] === '' || passcode !== conditions["passcode"]) {
            conditionsNotMet.push(type);
        }
    }
    if (conditionsNotMet.length > 0) return {
        state: false,
        conditionsNotMet
    }
    else return { state: true }
}

const updateCurrentUserCount = (roomData) => {

}

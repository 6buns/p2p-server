const { decrypt } = require("./helper");
const has = require('has-value');
const { get, get_demo } = require("./redis/room/get");
const { save_stats, create, update } = require("./redis/room/set");

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
            let room_data = {};

            try {
                // Getting Room Data from Redis
                if (socket.data.apiKey === 'DEMO') {
                    // roomData = await getDemoRoomsRedis();
                    room_data = await get_demo();
                } else {
                    if (has(room)) {
                        try {
                            // roomData = await getRoomFromRedis(room, socket.data.apiKey);
                            room_data = await get(room, socket.data.apiKey);
                        } catch (error) {
                            console.log(error)
                            error ? func({ error: error.message }) : func({ error: 'Room not present' });
                            socket.disconnect(true);
                        }
                    } else {
                        // id = randomBytes(6).toString('hex').slice(0, 6);
                        // ({ room_data } = await createRoomInRedis({ id, passcode, permissions, size, bypass }, apiKey));
                        // ({ room_data } = await create({ id, passcode, permissions, size, bypass }));
                        func({ error: 'Room does not exsists.' });
                    }
                }
                // Joining Room, if conditions are met.
                const result = checkRoomConditions(room_data, passcode)
                console.log(`CONDITIONS CHECK :`, { ...result })
                if (result.state) {
                    console.log(`ROOM : ${room_data.id} :: VALID TILL : ${room_data.validTill}`, room_data);
                    room = room_data.id;
                    socket.data.room = { ...room_data };
                    socket.join(room);
                    const sockets = await io.of("/").in(room).fetchSockets();
                    console.log(`Sockets : ${sockets.map(e => e.id)}`)
                    socket.data.join = Date.now();
                    socket.data.name = name;
                    room_data.currentUserCount += 1;
                    // updateRoom({ ...room_data });
                    update({ ...room_data });
                    func({
                        res: sockets.map(e => e.id),
                        room: {
                            room,
                            permissions: room_data.conditions.permissions
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
                    // saveStats(room, socket.data.name, data);
                    save_stats(room, socket.data.name, data);
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

const checkRoomConditions = (room_data, passcode) => {
    if (room_data.conditions.bypass) return { state: true }
    const conditions = room_data['conditions']
    const conditionsNotMet = [];
    for (const type of conditions) {
        // check if user count is less than or equal to size.
        if (!(room_data.currentUserCount + 1 <= conditions["size"])) {
            conditionsNotMet.push(type);
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

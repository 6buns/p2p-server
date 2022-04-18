
const { getRoomFromRedis } = require("./redis/getRoomFromRedis");
const { saveToDB } = require("./firestore/saveToDB");
const { decrypt } = require("./helper");

exports.handleMessage = async ({ type, from, to, room, token }, func, socket) => {
    let messageType = undefined;

    if ((from && to)) {
        messageType = 'direct';
    }
    if (room) {
        messageType = 'announce';
    }
    if (type === 'room-join') {
        messageType = 'callback';
    }
    if (type === 'PONG') {
        messageType = 'process';
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
                if (room.contains('demo')) {
                    roomData = await getDemoRoomsFromRedis(room);
                } else {
                    roomData = await getRoomFromRedis(room, socket.data.apiKey);
                }
                console.log(`ROOM : ${roomData.id} :: VALID TILL : ${roomData.validTill}`, roomData);
                room = roomData.id;
                socket.data.room = roomData;
                socket.join(room);
                const sockets = await io.of("/").in(room).fetchSockets();
                console.log(`Sockets : ${sockets.map(e => e.id)}`)
                func({
                    res: sockets.map(e => e.id)
                });
                socket.data.join = Date.now();
                socket.data.name = name
            } catch (error) {
                console.log(error)
                error ? func({ error }) : func({ error: 'Room not present' });
                socket.disconnect(true);
            }
            break;
        }
        case 'process': {
            // if (type === 'PONG') {
            //     try {
            //         const data = JSON.parse(atob(token));
            //         saveToDB(data, socket.data);
            //     } catch (error) {
            //         console.error(error);
            //     }
            // }
            break;
        }
        default:
            break;
    }
};

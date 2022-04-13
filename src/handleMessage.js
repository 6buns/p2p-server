
const { getRoomFromRedis } = require("./redis/getRoomFromRedis");
const { saveToDB } = require("./firestore/saveToDB");
const { io } = require("./sockets");
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
            let room;
            try {
                const dataJson = await getRoomFromRedis(room, socket.data.apiKey);
                if (!dataJson) {
                    func({
                        error: 'Room not present'
                    });
                    socket.disconnect(true);
                } else {
                    room = dataJson.id;
                    socket.data.room = { ...dataJson };
                    socket.join(room);

                    for (const [roomName, id] of io.of("/").adapter.rooms) {
                        if (roomName === room && id !== socket.id) {
                            func({
                                res: [...id]
                            });
                        }
                    }
                    const { name } = decrypt(token)
                    socket.data.join = Date.now();
                    socket.data.name = name;
                    console.table({ ...socket.data });
                }
            } catch (error) {
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

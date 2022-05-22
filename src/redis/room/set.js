const { createHash } = require('crypto');
const { client } = require('.');
const { createRoomObject } = require('../createRoomObject');

exports.create = ({ id, passcode, permissions = { video: true, audio: true, data: true }, size = 3, bypass = false }) => {
    return new Promise(async (resolve, reject) => {
        try {
            let validTill, roomKeyHash, redis_response, roomData;

            roomKeyHash = createHash('md5').update(`${id}`).digest('hex');
            roomData = createRoomObject({ id, passcode, permissions, size, bypass })
            redis_response = await client.set(roomKeyHash, JSON.stringify({ ...roomData }), {
                NX: true
            });
            console.log(`ROOM CREATED : ${id} :: VALIDITY : ${validTill}`);
            resolve({ ...roomData });
        } catch (error) {
            reject(error);
        }
    });
};

exports.update = (roomData) => {
    return new Promise(async (resolve, reject) => {
        const roomKeyHash = createHash('md5').update(`${roomData.id}`).digest('hex');
        let result = "";
        try {
            console.log(`UPDATE ROOM : ${roomData.id}`, { ...roomData });
            result = await client.set(roomKeyHash, JSON.stringify({ ...roomData }), {
                XX: true
            });
        } catch (error) {
            reject(error.message);
        }
        resolve(result);
    });
};

exports.save_stats = (roomId, name, stats) => {
    return new Promise(async (resolve, reject) => {
        const roomKeyHash = createHash('md5').update(`${roomId}`).digest('hex');
        let roomData = {};
        if (!roomId.includes('demo')) {
            try {
                const data = await client.get(roomKeyHash)
                roomData = JSON.parse(data);
                if (roomData.hasOwnProperty(stats)) {
                    roomData[stats][name] = {};
                    roomData[stats][name] = stats;
                } else {
                    roomData[stats] = {}
                    roomData[stats][name] = {};
                    roomData[stats][name] = stats;
                }
                await client.set(roomKeyHash, { ...roomData })
                resolve();
            } catch (error) {
                reject(error)
            }
        }
    });
}

const { createHash } = require('crypto');
const { client } = require('.');
const { createRoomInRedis } = require('./createRoomInRedis')

exports.getRoomFromRedis = (roomId) => {
    return new Promise(async (resolve, reject) => {
        const roomKeyHash = createHash('md5').update(`${roomId}`).digest('hex');
        let roomData = {};
        try {
            console.log(`GET ROOM : ${roomId}`);
            roomData = JSON.parse(await client.get(roomKeyHash));
            resolve({ ...roomData });
        } catch (error) {
            reject(error.message);
        }
    });
};

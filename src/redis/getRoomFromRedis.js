const { createHash } = require('crypto');
const { client } = require('.');
const { createRoomInRedis } = require('./createRoomInRedis')

exports.getRoomFromRedis = (roomId, apiKey) => {
    return new Promise(async (resolve, reject) => {
        const roomKeyHash = createHash('md5').update(`${roomId}`).digest('hex');
        let roomData = {};
        try {
            console.log(`GET ROOM : ${roomId} :: API KEY : ${apiKey}`);
            roomData = JSON.parse(await client.get(roomKeyHash));
            if (!roomData) {
                // no room data
                ({ roomData } = await createRoomInRedis(roomId, apiKey));
            }
            console.log(`ROOM : ${roomData.roomId} :: VALID TILL : ${roomData.validTill}`, roomData);
            resolve({ ...roomData });
        } catch (error) {
            reject(error.message);
        }
    });
};

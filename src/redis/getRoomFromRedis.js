const { createHash } = require('crypto');
const { client } = require('.');
const { createRoomInRedis } = require('./createRoomInRedis')

exports.getRoomFromRedis = (roomId, apiKey) => {
    return new Promise(async (resolve, reject) => {
        const roomKeyHash = createHash('md5').update(`${roomId}`).digest('hex');
        let data = {};
        try {
            console.log(`GET ROOM : ${roomId} :: API KEY : ${apiKey}`);
            data = JSON.parse(await client.get(roomKeyHash));
            if (!data) {
                console.log(`CREATE ROOM : ${roomId} :: API KEY : ${apiKey}`);
                // no room data
                data = await createRoomInRedis(roomId, apiKey);
            }
            console.log(`ROOM : ${data.roomId} :: VALID TILL : ${data.validTill}`, data);
            resolve({ ...data });
        } catch (error) {
            reject(error.message);
        }
    });
};

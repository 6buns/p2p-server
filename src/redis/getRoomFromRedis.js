const { createHash } = require('crypto');
const { client } = require('.');
const { createRoomInRedis } = require('./createRoomInRedis')

exports.getRoomFromRedis = (roomId, apiKey) => {
    return new Promise(async (resolve, reject) => {
        const roomKeyHash = createHash('md5').update(`${roomId}`).digest('hex');
        let data = {};
        try {
            console.log(await client.ping());
            data = JSON.parse(await client.get(roomKeyHash));
            if (!data) {
                // no room data
                data = await createRoomInRedis(roomId, apiKey);
            }
            console.log(`Cached room ${data.roomId} from redis expiring in ${data.validTill}.`, data);
            resolve({ ...data });
        } catch (error) {
            reject(error.message);
        }
    });
};

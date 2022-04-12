const crypto = require('crypto');
import { client } from '../../index';
import { createRoomInRedis } from './createRoomInRedis'

export const getRoomFromRedis = (roomId, apiKey) => {
    return new Promise(async (resolve, reject) => {
        const roomKeyHash = crypto.createHash('md5').update(`${roomId}`).digest('hex');
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

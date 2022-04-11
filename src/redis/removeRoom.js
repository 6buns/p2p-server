const crypto = require('crypto');
import { client } from './index';

export const removeRoom = async (room) => {
    const roomHash = crypto.createHash('md5').update(`${room}`).digest('hex');
    try {
        const res = await client.del(roomHash);
        if (res === 1) {
            console.log(`Redis Room Deleted : ${room}`);
        } else {
            console.log(`Unable to delete Redis Room : ${room}`);
        }
    } catch (error) {
        console.error(error);
    }
};

const { createHash } = require('crypto');
const { client } = require('.');

exports.remove = async (room) => {
    return new Promise((resolve, reject) => {
        const roomHash = createHash('md5').update(`${room}`).digest('hex');
        try {
            await io.in("room1").disconnectSockets(true);
            const res = await client.del(roomHash);
            if (res === 1) {
                resolve(`Redis Room Deleted : ${room}`);
            } else {
                resolve(`Unable to delete Redis Room : ${room}`);
            }
        } catch (error) {
            reject(error);
        }
    });
};

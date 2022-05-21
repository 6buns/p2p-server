const { createHash } = require('crypto');
const { client } = require('.');

exports.updateRoom = (roomData) => {
    return new Promise(async (resolve, reject) => {
        const roomKeyHash = createHash('md5').update(`${roomData.id}`).digest('hex');
        try {
            console.log(`UPDATE ROOM : ${roomData.id}`, { ...roomData });
            resolve(await client.set(roomKeyHash, { ...roomData }));
        } catch (error) {
            reject(error.message);
        }
    });
};

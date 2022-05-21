const { createHash } = require('crypto');
const { client } = require('.');

exports.updateRoom = (roomData) => {
    return new Promise(async (resolve, reject) => {
        const roomKeyHash = createHash('md5').update(`${roomData.id}`).digest('hex');
        let result = "";
        try {
            console.log(`UPDATE ROOM : ${roomData.id}`, { ...roomData });
            result = await client.set(roomKeyHash, { ...roomData }, {
                XX: true
            });
        } catch (error) {
            reject(error.message);
        }
        resolve(result);
    });
};

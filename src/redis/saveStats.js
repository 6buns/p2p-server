const { createHash } = require('crypto');
const { client } = require('.');

exports.saveStats = (roomId, name, stats) => {
    return new Promise((resolve, reject) => {
        const roomKeyHash = createHash('md5').update(`${roomId}`).digest('hex');
        try {
            roomData = JSON.parse(await client.get(roomKeyHash));
            roomData.stats[name] = stats;
            resolve(await client.set(roomKeyHash, { ...roomData }));
        } catch (error) {
            reject(error)
        }
    });
}

const { createHash } = require('crypto');
const { client } = require('.');

exports.saveStats = (roomId, name, stats) => {
    return new Promise((resolve, reject) => {
        const roomKeyHash = createHash('md5').update(`${roomId}`).digest('hex');
        let roomData = {};
        try {
            roomData = JSON.parse(await client.get(roomKeyHash));
            roomData.stats[name] = stats;
            await client.set(roomKeyHash, { ...roomData })
            resolve();
        } catch (error) {
            reject(error)
        }
    });
}

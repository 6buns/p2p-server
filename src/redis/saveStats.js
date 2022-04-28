const { createHash } = require('crypto');
const { client } = require('.');

exports.saveStats = (roomId, name, stats) => {
    return new Promise(async (resolve, reject) => {
        const roomKeyHash = createHash('md5').update(`${roomId}`).digest('hex');
        let roomData = {};
        if (!roomId.includes('demo')) {
            try {
                const data = await client.get(roomKeyHash)
                roomData = JSON.parse(data);
                if (roomData.hasOwnProperty(stats)) {
                    roomData[stats][name] = {};
                    roomData[stats][name] = stats;
                } else {
                    roomData[stats] = {}
                    roomData[stats][name] = {};
                    roomData[stats][name] = stats;
                }
                await client.set(roomKeyHash, { ...roomData })
                resolve();
            } catch (error) {
                reject(error)
            }
        }
    });
}

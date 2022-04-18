const { createHash, randomBytes } = require('crypto');
const { client } = require('.');

exports.getDemoRoomsRedis = (roomId) => {
    return new Promise(async (resolve, reject) => {
        try {
            const clients = await client.LLEN('demo_rooms')
            if (clients > 2) {
                resolve({ ...await client.LPOP('demo_rooms') })
            } else {
                try {
                    if (!roomId) roomId = `demo_${randomBytes(5).toString('hex').slice(0, 5)}`
                    createdAt = Date.now();
                    roomKeyHash = createHash('md5').update(`${roomId}`).digest('hex');
                    roomData = {
                        id: roomId,
                        apiHash: '',
                        sessionId: randomBytes(20).toString('hex').slice(0, 20),
                        createdAt,
                        validTill: createdAt + 86400000,
                    };
                    await client.RPUSH('demo_rooms', JSON.stringify({ ...roomData }))
                } catch (error) {
                    reject(error)
                }

                resolve({ ...roomData })
            }
        } catch (error) {
            reject(error)
        }

    });
};

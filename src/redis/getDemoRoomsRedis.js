const { createHash, randomBytes } = require('crypto');
const { client } = require('.');

exports.getDemoRoomsRedis = (roomId) => {
    return new Promise(async (resolve, reject) => {
        try {
            const clients = await client.LLEN('demo')
            console.log(`DEMO ROOMS : ${clients}`)
            if (clients > 2) {
                const client = await client.LPOP('demo')
                console.log(`DEMO ROOM POPPED : `, { ...client })
                resolve({ ...client })
            } else {
                try {
                    createdAt = Date.now();
                    roomKeyHash = createHash('md5').update(`${roomId}`).digest('hex');
                    roomData = {
                        id: `demo_${randomBytes(5).toString('hex').slice(0, 5)}`,
                        apiHash: '',
                        sessionId: randomBytes(20).toString('hex').slice(0, 20),
                        createdAt,
                        validTill: createdAt + 86400000,
                    };
                    await client.RPUSH('demo', JSON.stringify({ ...roomData }))
                    console.log(`DEMO ROOM PUSHED`, { ...roomData })
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

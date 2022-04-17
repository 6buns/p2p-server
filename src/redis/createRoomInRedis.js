const { randomBytes, createHash } = require('crypto');
const { client } = require('.');

exports.createRoomInRedis = (roomId, apiKey) => {
    return new Promise(async (resolve, reject) => {
        if (!roomId || roomId == '' || roomId == undefined) {
            roomId = randomBytes(5).toString('hex').slice(0, 5);
        }
        const apiHash = createHash('md5').update(apiKey).digest('hex');
        const createdAt = Date.now();
        const validTill = Date.now() + 86400000;
        const sessionId = randomBytes(20).toString('hex').slice(0, 20);
        const roomKeyHash = createHash('md5').update(`${roomId}`).digest('hex');
        let redis_response, record;
        const roomData = {
            id: roomId,
            apiHash,
            sessionId,
            createdAt,
            validTill,
        };
        try {
            redis_response = await client.set(roomKeyHash, JSON.stringify({ ...roomData }), {
                NX: true
            });
        } catch (error) {
            reject(error);
        }

        try {
            console.log(`ROOM CREATED : ${roomId} :: VALIDITY : ${validTill}`);
            resolve({ redis_response, roomData });
        } catch (error) {
            reject(error);
        }
    });
};

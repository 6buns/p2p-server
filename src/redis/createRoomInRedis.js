const { randomBytes, createHash } = require('crypto');
const { client } = require('.');

exports.createRoomInRedis = (roomId, apiKey) => {
    return new Promise(async (resolve, reject) => {
        try {
            let apiHash, createdAt, validTill, sessionId, roomKeyHash, redis_response, roomData;

            if (!roomId || roomId == '' || roomId == undefined) {
                roomId = randomBytes(5).toString('hex').slice(0, 5);
            }
            apiHash = createHash('md5').update(apiKey).digest('hex');
            createdAt = Date.now();
            validTill = Date.now() + 86400000;
            sessionId = randomBytes(20).toString('hex').slice(0, 20);
            roomKeyHash = createHash('md5').update(`${roomId}`).digest('hex');
            roomData = {
                id: roomId,
                apiHash,
                sessionId,
                createdAt,
                validTill,
            };

            redis_response = await client.set(roomKeyHash, JSON.stringify({ ...roomData }), {
                NX: true
            });

            console.log(`ROOM CREATED : ${roomId} :: VALIDITY : ${validTill}`);
            resolve({ redis_response, roomData });
        } catch (error) {
            reject(error);
        }

    });
};

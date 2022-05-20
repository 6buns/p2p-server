const { randomBytes, createHash } = require('crypto');
const { client } = require('.');
const { createRoomObject } = require('../createRoomObject');

exports.createRoomInRedis = (
    { id, passcode, permissions = { video: true, audio: true, data: true }, size = 3, bypass = false },
    apiKey) => {
    return new Promise(async (resolve, reject) => {
        try {
            let apiHash,
                // createdAt,
                validTill,
                // sessionId,
                roomKeyHash, redis_response, roomData;

            // if (!id || id == '' || id == undefined) {
            //     id = randomBytes(5).toString('hex').slice(0, 5);
            // }
            // apiHash = createHash('md5').update(apiKey).digest('hex');
            // createdAt = Date.now();
            // validTill = Date.now() + 86400000;
            // sessionId = randomBytes(20).toString('hex').slice(0, 20);
            roomKeyHash = createHash('md5').update(`${id}`).digest('hex');
            // roomData = {
            //     id,
            //     // apiHash,
            //     sessionId,
            //     createdAt,
            //     validTill,
            //     conditions: {
            //         bypass,
            //         size,
            //         passcode,
            //         permissions,
            //     },
            //     currentUserCount: 0,
            //     stats: {}
            // };

            roomData = createRoomObject({ id, passcode, permissions, size, bypass })

            redis_response = await client.set(roomKeyHash, JSON.stringify({ ...roomData }), {
                NX: true
            });

            console.log(`ROOM CREATED : ${id} :: VALIDITY : ${validTill}`);
            resolve({ ...roomData });
        } catch (error) {
            reject(error);
        }

    });
};

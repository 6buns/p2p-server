const { createHash, randomBytes } = require('crypto');
const { client } = require('.');
const { createRoomObject } = require('../createRoomObject');
const { createRoomInRedis } = require('./createRoomInRedis');
const { getRoomFromRedis } = require('./updateRoom');

exports.getDemoRoomsRedis = () => {
    return new Promise(async (resolve, reject) => {
        let roomData,
            // roomKeyHash,
            createdAt,
            roomId = `demo_${randomBytes(5).toString('hex').slice(0, 5)}`;
        try {
            const clients = await client.LLEN('demo')
            console.log(`DEMO ROOMS : ${clients}`)
            if (clients > 0) {
                roomId = JSON.parse(await client.LPOP('demo'))
                roomData = await getRoomFromRedis(roomId)
                console.log(`DEMO ROOM POPPED : `, roomData)
                resolve(roomData)
            } else {
                try {
                    createdAt = Date.now();
                    // roomKeyHash = createHash('md5').update(`${roomId}`).digest('hex');
                    // roomData = {
                    //     id: roomId,
                    //     apiHash: '',
                    //     sessionId: randomBytes(20).toString('hex').slice(0, 20),
                    //     createdAt,
                    //     validTill: createdAt + 86400000,
                    // };
                    roomData = await createRoomInRedis({ id: roomId, size: 2, bypass: true })
                    await client.RPUSH('demo', roomId)
                    console.log(`DEMO ROOM PUSHED`, roomId)
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

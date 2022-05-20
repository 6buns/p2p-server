const { createHash, randomBytes } = require('crypto');
const { client } = require('.');
const { createRoomObject } = require('../createRoomObject');

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
                roomData = JSON.parse(await client.LPOP('demo'))
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
                    roomData = createRoomObject({ id: roomId, bypass: true })
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


const popRoom = () => {

}

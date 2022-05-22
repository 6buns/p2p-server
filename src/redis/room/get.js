const { createHash, randomBytes } = require('crypto');
const { client } = require('.');
const { createRoomInRedis } = require('./createRoomInRedis');
const { getRoomFromRedis } = require('./getRoomFromRedis');
const { create } = require('./set');

exports.get = (roomId) => {
    return new Promise(async (resolve, reject) => {
        const roomKeyHash = createHash('md5').update(`${roomId}`).digest('hex');
        let roomData = {};
        try {
            console.log(`GET ROOM : ${roomId}`);
            roomData = JSON.parse(await client.get(roomKeyHash));
            resolve({ ...roomData });
        } catch (error) {
            reject(error.message);
        }
    });
};

exports.get_demo = () => {
    return new Promise(async (resolve, reject) => {
        let roomData, createdAt, roomId = `demo_${randomBytes(5).toString('hex').slice(0, 5)}`;
        try {
            const clients = await client.LLEN('demo')
            console.log(`DEMO ROOMS : ${clients}`)
            if (clients > 0) {
                roomId = await client.LPOP('demo')
                roomData = await this.get(roomId)
                console.log(`DEMO ROOM POPPED : `, roomData)
                resolve(roomData)
            } else {
                try {
                    createdAt = Date.now();
                    roomData = await create({ id: roomId, size: 2, bypass: true })
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

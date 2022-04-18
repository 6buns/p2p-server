const { createHash } = require('crypto');
const { client } = require('.');

exports.getDemoRoomsRedis = () => {
    return new Promise(async (resolve, reject) => {
        const clients = await client.sendCommand('LLEN', 'demo_rooms')
        if (clients > 2) {
            return { roomData: await client.sendCommand('LPOP', 'demo_rooms') }
        } else {
            roomId = `demo_${randomBytes(5).toString('hex').slice(0, 5)}`
            createdAt = Date.now();
            roomKeyHash = createHash('md5').update(`${roomId}`).digest('hex');
            roomData = {
                id: roomId,
                apiHash: '',
                sessionId: randomBytes(20).toString('hex').slice(0, 20),
                createdAt,
                validTill: createdAt + 86400000,
            };
            await client.sendCommand('RPUSH', 'demo_rooms', JSON.stringify({ ...roomData }))

            return { ...roomData }
        }

    });
};

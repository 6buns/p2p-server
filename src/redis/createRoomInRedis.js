const crypto = require('crypto');
import { client, sessionsRef } from '../../index';


export const createRoomInRedis = (roomId, apiKey) => {
    return new Promise(async (resolve, reject) => {
        if (!roomId) {
            roomId = crypto.randomBytes(5).toString('hex').slice(0, 5);
        }
        const apiHash = crypto.createHash('md5').update(apiKey).digest('hex');
        const createdAt = Date.now();
        const validTill = Date.now() + 86400000;
        const sessionId = crypto.randomBytes(20).toString('hex').slice(0, 20);
        const sessionHash = crypto.createHash('md5').update(sessionId).digest('hex');
        const roomKeyHash = crypto.createHash('md5').update(`${roomId}`).digest('hex');
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
            console.log(`Created room ${roomId} in redis expiring in ${validTill}.`);
            const firestore_response = await sessionsRef.doc(sessionHash).set({
                ...roomData,
                peers: []
            });
        } catch (error) {
            reject(error);
        }
        resolve({ redis_response, firestore_response, roomData });
    });
};

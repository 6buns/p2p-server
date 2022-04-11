const crypto = require('crypto');
const { Firestore } = require("@google-cloud/firestore");
import { keyStoreRef, chargeUser } from './index';

export const saveSession = async (roomData) => {
    const { customerId, apiKey, name, socketId, room, join, left } = roomData;
    const apiHash = crypto.createHash('md5').update(apiKey).digest('hex');
    const roomHash = crypto.createHash('md5').update(room.id).digest('hex');

    const peer = {
        name: name,
        socketId: socketId,
        join: join,
        left: left
    };

    let time = 0;

    try {
        await keyStoreRef.doc(apiHash).collection('rooms').doc(roomHash).collection('sessions').doc(room.sessionId).update({
            peers: Firestore.FieldValue.arrayUnion({ ...peer })
        });
    } catch (error) {
        console.error(error);
    }

    try {
        if (left && join) {
            time += (left - join);
        } else {
            time += Date.now() - room.createdAt;
        }
        const quantity = Math.ceil(time / 60000);
        await chargeUser(customerId, quantity);
    } catch (error) {
        console.error(error);
    }
};

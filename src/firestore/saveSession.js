const { createHash } = require('crypto');
const { FieldValue } = require("@google-cloud/firestore");
const { chargeUser } = require('../stripe/chargeUser');
const { keyStoreRef } = require('.');

exports.saveSession = async ({ customerId, name, socketId, room, join, left }) => {
    const { id, apiHash, sessionId, createdAt } = room;
    const roomHash = createHash('md5').update(id).digest('hex');

    if (customerId === 'DEMO') return

    if (!sessionId) {
        console.log(`No Session ID present`)
        return
    }
    const peer = {
        name: name || '',
        socketId: socketId,
        join: join,
        left: left
    };

    let time = 0;

    try {
        console.log(`PEER : ${name}`)
        await keyStoreRef.doc(apiHash).collection('rooms').doc(roomHash).collection('sessions').doc(sessionId).update({
            peers: FieldValue.arrayUnion({ ...peer })
        });
    } catch (error) {
        console.error(error);
    }

    try {
        if (left && join) {
            time += (left - join);
        } else {
            time += Date.now() - createdAt;
        }
        const quantity = Math.ceil(time / 60000);
        await chargeUser(customerId, quantity);
    } catch (error) {
        console.error(error);
    }
};

const { createHash } = require('crypto');
const { sessionsRef } = require('.');


exports.saveToDB = async (data = {}, user) => {
    // apiKey, customerId, secret, join, left, name, room: { id: roomId, apiHash, sessionId, createdAt, validTill }
    const { room: { sessionId } } = user;

    const sessionHash = createHash('md5').update(sessionId).digest('hex');
    return await sessionsRef.doc(sessionHash).collection('stats').add({
        ...data
    });
};

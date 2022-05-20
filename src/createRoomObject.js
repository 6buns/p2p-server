exports.createRoomObject = ({ id, passcode = '', permissions: { video = true, audio = true, data = true }, size = 3, bypass = false }) => {
    if (!id || id == '' || id == undefined) {
        id = randomBytes(5).toString('hex').slice(0, 5);
    }

    createdAt = Date.now();
    validTill = Date.now() + 86400000;
    sessionId = randomBytes(20).toString('hex').slice(0, 20);

    return {
        id,
        // apiHash,
        sessionId,
        createdAt,
        validTill,
        conditions: {
            bypass,
            size,
            passcode,
            permissions,
        },
        currentUserCount: 0,
        stats: {}
    };
}

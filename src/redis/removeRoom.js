const { createHash } = require('crypto');
const { client } = require('../../index');

exports.removeRoom = async (room) => {
    const roomHash = createHash('md5').update(`${room}`).digest('hex');
    try {
        const res = await client.del(roomHash);
        if (res === 1) {
            console.log(`Redis Room Deleted : ${room}`);
        } else {
            console.log(`Unable to delete Redis Room : ${room}`);
        }
    } catch (error) {
        console.error(error);
    }
};

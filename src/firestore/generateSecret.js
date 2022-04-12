const { randomBytes, createHash } = require('crypto');
const { keyStoreRef } = require('.');

exports.generateSecret = async (apiKey) => {
    const apiHash = createHash('md5').update(apiKey).digest('hex');
    const secretKey = randomBytes(9).toString('hex').slice(0, 9);

    await keyStoreRef.doc(apiHash).set({
        secretKey,
    }, { merge: true }).then(() => {
        console.log(secretKey);
    }).catch((e) => { return e; });

    return secretKey;
};

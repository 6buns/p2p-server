const { createHash } = require('crypto');
const { keyStoreRef } = require('.');

exports.verifyAPIKey = async (apiKey, apiSecret) => {
    return new Promise(async (resolve, reject) => {
        const apiHash = createHash('md5').update(apiKey).digest('hex');
        try {
            const doc = await keyStoreRef.doc(apiHash).get();
            if (doc.exists) {
                if (apiSecret) {
                    const apiDetails = doc.data();
                    const apiSecretHash = createHash('md5').update(apiSecret).digest('hex')
                    apiDetails.secretKeyHash === apiSecretHash ? resolve(true) : reject(new Error("Secret Key does not match."))
                } else resolve(doc.data());
            } else {
                reject('API does not exsists');
            }
        } catch (error) {
            reject(error.message);
        }
    });
};

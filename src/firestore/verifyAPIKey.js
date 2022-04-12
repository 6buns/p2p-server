const crypto = require('crypto');
import { keyStoreRef } from '../../index';

export const verifyAPIKey = async (apiKey) => {
    return new Promise(async (resolve, reject) => {
        const apiHash = crypto.createHash('md5').update(apiKey).digest('hex');
        try {
            const doc = await keyStoreRef.doc(apiHash).get();
            if (doc.exists) {
                resolve(doc.data());
            } else {
                reject('Document does not exsists');
            }
        } catch (error) {
            reject(error.message);
        }
    });
};

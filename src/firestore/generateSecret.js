const crypto = require('crypto');
import { keyStoreRef } from './index';

export const generateSecret = async (apiKey) => {
    const apiHash = crypto.createHash('md5').update(apiKey).digest('hex');
    const secretKey = crypto.randomBytes(9).toString('hex').slice(0, 9);

    await keyStoreRef.doc(apiHash).set({
        secretKey,
    }, { merge: true }).then(() => {
        console.log(secretKey);
    }).catch((e) => { return e; });

    return secretKey;
};

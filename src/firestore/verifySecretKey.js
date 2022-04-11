import { keyStoreRef } from '../../index';

export const verifySecretKey = async (secret) => {
    console.log(secret);
    try {
        const snapshot = await keyStoreRef.where('secretKey', '==', secret).get();
        if (snapshot.empty) {
            return new Error('No Data related to Secret present');
        }
        snapshot.forEach(doc => {
            console.log(doc.id, '=>', doc.data());
        });
        return snapshot[0].data();
    } catch (error) {
        return error;
    }

};

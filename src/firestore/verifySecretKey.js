const { keyStoreRef } = require(".");

exports.verifySecretKey = async (secret) => {
    console.log(secret);
    try {
        const snapshot = await keyStoreRef.where('secretKey', '==', secret).get();
        if (snapshot.empty) {
            return new Error('No Data related to Secret present');
        }
        snapshot.forEach(doc => {
            console.log(doc.id, '=>', doc.data());
            return { ...doc.data() };
        });
    } catch (error) {
        return error;
    }

};

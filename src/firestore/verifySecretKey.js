const { keyStoreRef } = require(".");

exports.verifySecretKey = async (secret) => {
    console.log(secret);
    let apiKey, secretKey, userId, customerId, active;
    try {
        const snapshot = await keyStoreRef.where('secretKey', '==', secret).get();
        if (snapshot.empty) {
            return new Error('No Data related to Secret present');
        }
        snapshot.forEach(doc => {
            console.log(doc.id, '=>', doc.data());
            ({ apiKey, secretKey, userId, customerId, active } = doc.data());
        });

        if (active) {
            return { apiKey, secretKey, userId, customerId, active }
        } else {
            return new Error('Inactive API Key')
        }
    } catch (error) {
        return error;
    }

};

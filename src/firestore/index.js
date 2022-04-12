
const { Firestore } = require("@google-cloud/firestore");
const db = new Firestore();
const keyStoreRef = db.collection('keyStore')
const sessionsRef = db.collection('sessions')

module.exports = {
    keyStoreRef,
    sessionsRef
}

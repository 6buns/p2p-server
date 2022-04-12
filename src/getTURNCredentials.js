const crypto = require('crypto');

const getTURNCredentials = (name, secret) => {
    let unixTimeStamp = parseInt(Date.now() / 1000) + 24 * 3600,
        // this credential would be valid for the next 24 hours
        username = [unixTimeStamp, name].join(':'), password, hmac = crypto.createHmac('sha1', secret);
    hmac.setEncoding('base64');
    hmac.write(username);
    hmac.end();
    password = hmac.read();
    return {
        username,
        credential: password
    };
};

module.exports = {
    getTURNCredentials
}

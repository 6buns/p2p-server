exports.crypt = (data) => {
    return btoa(JSON.stringify({ ...data }))
}

exports.decrypt = (token) => {
    return JSON.parse(atob(token))
}

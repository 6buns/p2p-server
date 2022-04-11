export const crypt = (data) => {
    return btoa(JSON.stringify({ ...data }))
}

export const decrypt = (token) => {
    return JSON.parse(atob(token))
}

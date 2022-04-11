# Test Structure
1. Socket
    1. verification
        ```js
        io.use()
        ```
    2. Socket Events
        1. connection
        2. message
        3. handleMessage
        4. disconnect
    5. Adapter Events
        1. create-room
        2. delete-room
        3. join-room
        4. leave-room
2. Functions interacting with
    - firestore
        1. generateSecret
        2. verifyAPIKey
        3. verifySecretKey
        4. saveSession
        5. saveToDB
    - redis
        1. getRoomFromRedis
        2. createRoomInRedis
        3. removeRoom
    - stripe
        1. chargeUser
3. HTTP API Functions
    1. POST /secret

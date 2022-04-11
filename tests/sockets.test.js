import { createServer } from "http";
import { Server } from "socket.io";
import Client from "socket.io-client";
import { handleMessage } from "../src/handleMessage.js";
import { crypt, decrypt } from "./helper";


describe("my awesome project", () => {
    let io, serverSocket, clientSocket, clientSocket2;

    beforeAll((done) => {
        const httpServer = createServer();
        io = new Server(httpServer);
        httpServer.listen(() => {
            const port = httpServer.address().port;
            clientSocket = new Client(`http://localhost:${port}`);
            clientSocket2 = new Client(`http://localhost:${port}`);
            io.on("connection", (socket) => {
                serverSocket = socket;
            });
            clientSocket.on("connect", done);
        });
    });

    afterAll(() => {
        io.close();
        clientSocket.close();
        clientSocket2.close();
    });

    test("should work", (done) => {
        clientSocket.on("hello", (arg) => {
            expect(arg).toBe("world");
            done();
        });
        serverSocket.emit("hello", "world");
    });

    test("should work (with ack)", (done) => {
        serverSocket.on("hi", (cb) => {
            cb("hola");
        });
        clientSocket.emit("hi", (arg) => {
            expect(arg).toBe("hola");
            done();
        });
    });

    test("shoulc work (direct)", (done) => {
        clientSocket.on("message", ({ type, from, to, room, token }) => {
            expect(decrypt(token)).toBe("hello");
            done();
        })
        serverSocket.on("message", async ({ type, from, to, room, token }, func) => await handleMessage({ type, from, to, room, token }, func, serverSocket))
        clientSocket2.emit("message", {
            type: 'data',
            from: clientSocket2.id,
            to: clientSocket.id,
            room: 'abc',
            token: crypt("hello"),
        })
    });
});

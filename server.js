const WebSocket = require("ws");

const server = new WebSocket.Server({
    port: 8080
});

server.on("connection", (socket) => {
    console.log("A user connected!");

    socket.send("Welcome to the group chat!");

    socket.on("message", (message) => {
        console.log("User says:", message.toString());
    });

    socket.on("close", () => {
        console.log("A user disconnected.");
    });
});

console.log("WebSocket server running at ws://localhost:8080");

const http = require("http");
const fs = require("fs");
const path = require("path");
const WebSocket = require("ws");


// ================================
// HTTP SERVER
// ================================

const server = http.createServer((req, res) => {

    const filePath = path.join(__dirname, "public", "index.html");

    fs.readFile(filePath, (error, data) => {

        if (error) {
            res.writeHead(500);
            res.end("Could not load index.html");
            return;
        }

        res.writeHead(200, {
            "Content-Type": "text/html"
        });

        res.end(data);
    });

});


// ================================
// WEBSOCKET SERVER
// ================================

const wss = new WebSocket.Server({
    server: server
});


wss.on("connection", (socket) => {

    console.log("A user connected");

    // Send welcome message
    socket.send("Welcome to the group chat!");


    // Receive message
    socket.on("message", (message) => {

    console.log("User says:", message.toString());

    wss.clients.forEach((client) => {

        if (client.readyState === WebSocket.OPEN) {

            client.send(message.toString());

        }

    });

});


    // User disconnects
    socket.on("close", () => {

        console.log("A user disconnected");

    });

});


// ================================
// START SERVER
// ================================

server.listen(process.env.PORT || 8080, () => {
    console.log("Server started");
});

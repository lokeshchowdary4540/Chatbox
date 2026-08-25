require("dotenv").config();

const http = require("http");
const fs = require("fs");
const path = require("path");
const WebSocket = require("ws");
const { MongoClient } = require("mongodb");


// =================================
// MONGODB
// =================================

const mongoClient = new MongoClient(
    process.env.MONGODB_URI
);

let messagesCollection;


// =================================
// CONNECTED USERS
// =================================

const connectedUsers = new Map();


// =================================
// HTTP SERVER
// =================================

const server = http.createServer((req, res) => {

    const filePath = path.join(
        __dirname,
        "public",
        "index.html"
    );

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


// =================================
// WEBSOCKET SERVER
// =================================

const wss = new WebSocket.Server({
    server: server
});


wss.on("connection", (socket) => {

    console.log("A user connected");


    // =================================
    // RECEIVE MESSAGE
    // =================================

    socket.on("message", async (message) => {

        let data;

        try {

            data = JSON.parse(
                message.toString()
            );

        } catch (error) {

            console.log(
                "Invalid message received"
            );

            return;
        }


        // =================================
        // JOIN
        // =================================

        if (data.type === "join") {

            const username =
                data.username.trim();


            if (username === "") {

                socket.send(
                    JSON.stringify({
                        type: "join_error",
                        message:
                            "Username cannot be empty."
                    })
                );

                return;
            }


            // Check username

            if (connectedUsers.has(username)) {

                socket.send(
                    JSON.stringify({
                        type: "join_error",
                        message:
                            "Username is already in use."
                    })
                );

                return;
            }


            // Save connected user

            connectedUsers.set(
                username,
                socket
            );

            socket.username = username;


            console.log(
                `${username} joined the chat`
            );


            // Tell user join succeeded

            socket.send(
                JSON.stringify({
                    type: "join_success",
                    username: username
                })
            );


            // =================================
            // SEND LAST 1 HOUR OF MESSAGES
            // =================================

            try {

                const oneHourAgo =
                    new Date(
                        Date.now() - 60 * 60 * 1000
                    );


                const oldMessages =
                    await messagesCollection
                        .find({
                            createdAt: {
                                $gte: oneHourAgo
                            }
                        })
                        .sort({
                            createdAt: 1
                        })
                        .toArray();


                for (
                    const oldMessage
                    of oldMessages
                ) {

                    socket.send(
                        JSON.stringify({
                            type: "chat",
                            username:
                                oldMessage.username,
                            message:
                                oldMessage.message
                        })
                    );

                }

            } catch (error) {

                console.error(
                    "Could not load old messages:",
                    error
                );

            }


            // Update online count

            broadcastOnlineCount();


            return;
        }


        // =================================
        // CHAT MESSAGE
        // =================================

        if (data.type === "chat") {


            // User must join first

            if (!socket.username) {
                return;
            }


            const chatMessage = {

                type: "chat",

                username:
                    socket.username,

                message:
                    data.message

            };


            console.log(
                `${socket.username}: ${data.message}`
            );


            // =================================
            // SAVE TO MONGODB
            // =================================

            try {

                await messagesCollection.insertOne({

                    username:
                        socket.username,

                    message:
                        data.message,

                    createdAt:
                        new Date()

                });

            } catch (error) {

                console.error(
                    "Could not save message:",
                    error
                );

            }


            // =================================
            // SEND TO EVERYONE
            // =================================

            wss.clients.forEach(
                (client) => {

                    if (
                        client.readyState ===
                        WebSocket.OPEN
                    ) {

                        client.send(
                            JSON.stringify(
                                chatMessage
                            )
                        );

                    }

                }
            );


            return;
        }

    });


    // =================================
    // DISCONNECT
    // =================================

    socket.on("close", () => {

        if (socket.username) {

            connectedUsers.delete(
                socket.username
            );


            console.log(
                `${socket.username} disconnected`
            );


            broadcastOnlineCount();

        } else {

            console.log(
                "A user disconnected"
            );

        }

    });

});


// =================================
// ONLINE COUNT
// =================================

function broadcastOnlineCount() {

    const count =
        connectedUsers.size;


    wss.clients.forEach(
        (client) => {

            if (
                client.readyState ===
                WebSocket.OPEN
            ) {

                client.send(
                    JSON.stringify({
                        type: "online_count",
                        count: count
                    })
                );

            }

        }
    );

}


// =================================
// START EVERYTHING
// =================================

async function startServer() {

    try {

        // Connect MongoDB

        await mongoClient.connect();

        console.log(
            "Connected to MongoDB"
        );


        // Select database

        const database =
            mongoClient.db("chatbox");


        // Select collection

        messagesCollection =
            database.collection("messages");


        // =================================
        // TTL INDEX
        // =================================
        //
        // MongoDB automatically removes
        // documents 1 hour after createdAt.
        //

        await messagesCollection.createIndex(
            { createdAt: 1 },
            { expireAfterSeconds: 3600 }
        );


        console.log(
            "MongoDB messages collection ready"
        );


        // =================================
        // START HTTP + WEBSOCKET SERVER
        // =================================

        server.listen(process.env.PORT || 8080, () => {
    console.log("Server started");
});

    } catch (error) {

        console.error(
            "Failed to start server:"
        );

        console.error(error);

    }

}


startServer();

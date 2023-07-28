const express = require('express');
// Express initializes app to be a function handler 
// that you can supply to an HTTP server
const app = express();
const http = require('http');
const server = http.createServer(app);
// initializes a new instance of socket.io by passing
// server to it.
const { Server } = require("socket.io");
const io = new Server(server);
const users = {};

// call app.use so node.js loads the css files (which
// are static files)
app.use(express.static("public"))

// Serves the html content in index.html when a get
// request to the homepage is made.
// __dirname returns the directory that the currently executing script is in.
app.get('/', (req, res) => {
    res.sendFile(__dirname + 'public/index.html');
});

app.get('/users', (req, res) => {
    // Object.values returns an array of the objects string-keyed
    // property values (the values in the object) 
    res.send(Object.values(users));
});

// Listen on the connection event for incoming sockets
// and log it to console. socket.io-client is loaded 
// in main.js
io.on('connection', (socket) => {
    console.log('connected', socket.id);
    socket.on('user-connected', (user) => {
        // save this user to an object, users, with their
        // corresponding socket.id as the key
        users[socket.id] = {...user, id: socket.id};
        console.log('connected user', users[socket.id]);

        // on the server side, tell all clients that the user list has changed
        socket.broadcast.emit('users-changed', Object.values(users));
    });

    // alert the appropriate recipient that a message was received
    socket.on('new-chat-message', (message) => {
        console.log("new chat message");
        // use socket.to to send to a message from the backend to a 
        // specific client
        socket.to(message.recipientId).emit('new-chat-message',{
            text: message.text,
            senderId: socket.id,
        });
    });

    // alert the appropriate recipient that a user is typing
    socket.on('typing-status', (notif) => {
        console.log(users[notif.recipientId].name, 'is typing');
        // send to the recipient that user (socket.id) is typing
        socket.to(notif.recipientId).emit('typing-status', {
            typingStatus: notif.typingStatus,
            senderId: socket.id,
        });
    })

    socket.on('disconnect', () => {
        delete users[socket.id];

        // on the server side, tell all clients that the user list has changed
        socket.broadcast.emit('users-changed', Object.values(users));
    });
});

server.listen(3000, () => {
    console.log('listening on *:3000');
});
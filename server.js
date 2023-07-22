const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors'); // Import cors module
const cookieParser = require('cookie-parser');

const port = process.env.PORT || 3000;
const { v4: uuidv4 } = require('uuid'); // Import uuid to generate unique user IDs

const app = express();

app.use(express.json()); // To parse JSON payloads
app.use(cors()); // Use cors middleware
app.use(cookieParser());

const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: process.env.NODE_ENV === "production" ? "https://flag-battle-client.vercel.app" : "http://localhost:8080", 
        credentials: true // Allow credentials
    }
});

// Load JSON data
const countries = require('./countries.json');

let correctFlag = null;
let flags = [];
// Keep track of users and their scores
let users = {};
let roundActive = true;

// Initial flags
setNewFlags();



io.on('connection', (socket) => {
    console.log('Client connected');
    // const userId = socket.handshake.headers.cookie ? socket.handshake.headers.cookie.replace('userId=', '') : uuidv4(); 
    socket.emit('getUserId');
    // Set the user ID cookie with a 1 year expiry
    emitFlags();

    socket.on('getUserId', (userIdCookie) => {
        console.log('User ID: ' + userIdCookie);
        userId = userIdCookie.replace('userId=', '');
        if (users[userId] === undefined ) {
            userId = uuidv4();
            // Set the user ID cookie with a 1 year expiry
            socket.emit('setUserId', userId);
            console.log('Prompting for username');
            users[userId] = {
                username: "Anonymous",
                score: 0
            };
            // Prompt  the user for a username
            socket.emit('setUsername');
        }
        socket.userId = userId;
        console.log('Client connected with username ' + users[userId].username);
    });

    socket.on('setUsername', (username) => {
        // Check that username is not empty and that it is not already taken
        if (username === "" || Object.values(users).some(user => user.username === username)) {
            socket.emit('setUsername');
            return;
        }
        console.log(`Username set: ${username}`);
        users[socket.userId].username = username;
        io.emit('users', users);
        console.log(users);
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected');
    });

    socket.on('answer', (countryCode) => {
        if (roundActive) {
            roundActive = false;
            console.log(`User ${users[userId].username} answered ${countryCode}`);

            //sleep for 2 seconds
            if (countryCode === correctFlag.code) {
                console.log('Correct answer!');
                users[socket.userId].score++;
            } else {
                users[socket.userId].score--;
            }
            io.emit('correctAnswer', correctFlag.code);

            setTimeout(() => {
                // Handle the event...
                flags = getRandomCountries(countries, 16);
                // Choose the first country as the correct answer
                correctFlag = flags[0];
                // Shuffle the new countries
                flags.sort(() => Math.random() - 0.5);
                // Send the new countries to all clients
                io.emit('newFlags', flags);
                io.emit('setQuestion', correctFlag.name);
                io.emit('users', users);
                roundActive = true;
            }, 3000);
        }    
      });

});

function getRandomCountries(countries, count) {
    let tempCountries = [...countries]
    let selectedCountries = [];
    while (selectedCountries.length < count && tempCountries.length > 0) {
        let randomIndex = Math.floor(Math.random() * tempCountries.length);
        selectedCountries.push(tempCountries.splice(randomIndex, 1)[0]);
    }
    return selectedCountries;
}

function setNewFlags() {
    flags = getRandomCountries(countries, 16);
    // Choose the first country as the correct answer
    correctFlag = flags[0];
    // Shuffle the new countries
    flags.sort(() => Math.random() - 0.5);
    // Send the new countries to all clients
    emitFlags();
}

function emitFlags() {
    io.emit('newFlags', flags);
    io.emit('setQuestion', correctFlag.name);
    io.emit('users', users);
}



server.listen(port, () => console.log('Listening on port ' + port + ' and waiting for clients to connect...'));

// Export the Express API
module.exports = server;
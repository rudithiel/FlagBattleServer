const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors'); // Import cors module

const app = express();
app.use(cors()); // Use cors middleware

const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*", // Allow all origins
        methods: ["GET", "POST"], // Allow GET and POST methods
        credentials: true // Allow credentials
    }
});

// Load JSON data
const countries = require('./countries.json');

let currentFlag = null;

// Initial flags
let flags = getRandomCountries(countries, 20);

// Keep track of users and their scores
let users = {};


io.on('connection', (socket) => {
    
    io.emit('newFlags', flags);
    console.log('New client connected with username ' + users[socket.id]);
    if (users[socket.id] === undefined) {
        users[socket.id] = 'Anonymous';
        // Prompt  the user for a username
        socket.emit('setUsername');
    }

    if (currentFlag) {
        socket.emit('new flag', currentFlag);
    }

    socket.on('answer', (data) => {
        // Handle the answer received from a client.
    });

    socket.on('setUsername', (username) => {
        console.log(`Username set: ${username}`);
        users[socket.id] = username;
        io.emit('users', users);
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected');
    });

    socket.on('flagClicked', (countryCode) => {
        console.log(`Flag clicked: ${countryCode}`);
        // Handle the event...
        newCountries = getRandomCountries(countries, 20);
        // Choose the first country as the correct answer
        correctFlag = newCountries[0];
        // Send the new countries to all clients
        io.emit('newFlags', newCountries);
      });

});

function getRandomCountries(countries, count) {
    // Create a copy of the original array
    let tempCountries = [...countries];

    // Array to hold the selected countries
    let selectedCountries = [];

    // Continue until we've selected the desired number of countries
    while (selectedCountries.length < count && tempCountries.length > 0) {
        // Generate a random index
        let randomIndex = Math.floor(Math.random() * tempCountries.length);

        // Splice the country out of the temp array, and push it to the selected array
        selectedCountries.push(tempCountries.splice(randomIndex, 1)[0]);
    }

    return selectedCountries;
}




server.listen(4000, () => console.log('Listening on port 4000'));

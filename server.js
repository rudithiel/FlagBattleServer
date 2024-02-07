const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const fetch = require('node-fetch'); // Make sure to install node-fetch or axios
const { v4: uuidv4 } = require('uuid');

const port = process.env.PORT || 3000;
const app = express();

app.use(express.json());
app.use(cors());

const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: process.env.NODE_ENV === "production" ? "https://flag-battle-client.vercel.apps" : "http://localhost:8080", 
        credentials: true
    }
});

let users = {};
let scores = { player1: 0, player2: 0 };
let currentRound = 0;
const totalRounds = 10;

async function fetchQuestion() {
    const response = await fetch('https://opentdb.com/api.php?amount=1&type=multiple');
    const data = await response.json();
    return data.results[0];
}

io.on('connection', (socket) => {
    console.log('Client connected');

    socket.on('getUserId', async (userId) => {
        if (!users[userId]) {
            userId = uuidv4();
            users[userId] = { score: 0, username: "Anonymous" };
            socket.emit('setUserId', userId);
        }

        if (Object.keys(users).length === 2 && currentRound === 0) {
            startGame();
        }
    });

    async function startGame() {
        for (currentRound = 1; currentRound <= totalRounds; currentRound++) {
            const question = await fetchQuestion();
            io.emit('newQuestion', question);
            // Wait for both users to submit their answers and then evaluate
            // This is a simplified logic, you'll need to implement the answer handling and scoring
        }
        // After 10 rounds, determine winner and reset game
        console.log('Game Over');
        // Send game over message with scores
        io.emit('gameOver', scores);
        // Reset game state for next match
        resetGame();
    }

    function resetGame() {
        users = {};
        scores = { player1: 0, player2: 0 };
        currentRound = 0;
    }
});

server.listen(port, () => console.log(`Listening on port ${port} and waiting for clients to connect...`));

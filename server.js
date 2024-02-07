import express from 'express';
import http from 'http';
import { Server as socketIo } from 'socket.io';
import cors from 'cors';
import fetch from 'node-fetch'; // fetch is already using import
import { v4 as uuidv4 } from 'uuid';
import { start } from 'repl';

const port = process.env.PORT || 3000;
const app = express();


app.use(express.json());
app.use(cors());

const server = http.createServer(app);
const io = new socketIo(server, {
    cors: {
        origin: process.env.NODE_ENV === "production" ? "https://humblebraggers-quiz-game.vercel.app" : "http://localhost:8080", 
        credentials: true
    }
});

let users = {};
let questions = [];
let scores = {};
let currentRound = 0;
let roundActive = false;
let userOrder = [];
const totalRounds = 10;

async function fetchQuestions() {
    const response = await fetch('https://opentdb.com/api.php?amount=10&category=9&type=multiple');
    const data = await response.json();
    console.log(data);
    return data.results;
}

io.on('connection', (socket) => {
    console.log('Client connected');
    socket.emit('getUserId');
    emitQuestion();
    socket.on('getUserId', (userIdCookie) => {
        console.log('User ID: ' + userIdCookie);
        let userId = userIdCookie.replace('userId=', '');
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
            userOrder.push(userId);
            // Check if user has score, else set to 0
            if (scores[userId] === undefined) {
                scores[userId] = 0;
            }
            console.log("userOrder: " + userOrder);
        }
        console.log(users[userId]);
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
        startGame();
    });

    socket.on('answer', (answer) => {
        // Evaluate answer and update scores
        // This is a simplified logic, you'll need to implement the answer handling and scoring
        console.log('Answer received: ' + answer);
        console.log('Correct answer: ' + questions[currentRound].correct_answer);

        if ((answer === questions[currentRound].correct_answer) && roundActive) {
            roundActive = false;
            console.log('Correct answer!');
            users[socket.userId].score += 1;
            io.emit('correctUser', users[socket.userId].username); // Notify all users that the answer was correct
            io.emit('correctAnswer', answer); // Notify all users that the answer was correct
            nextRoundCounter();
        } else if (roundActive) {
            users[socket.userId].score -= 1;
            console.log('Wrong answer');
            socket.emit('wrongAnswer', answer); // Notify the specific user that the answer was wrong
            io.emit('disableAnswer', answer); // Notify all users to disable this answer
        }
        console.log(scores);
        io.emit('users', users);
    });

    async function startGame() {
        const questions = await fetchQuestions();
        roundActive = true;
    }

    function emitQuestion() {
        emitRoundInfo();
        // If questions is empty, fetch new questions
        if (questions.length === 0) {
            fetchQuestions().then((data) => {
                questions = data;
                console.log(questions);
                io.emit('newQuestion', questions[currentRound]);
            });
        } else {
            io.emit('newQuestion', questions[currentRound]);
        }
    }

    function nextRoundCounter(increaseRound = true) {
        emitRoundInfo();
        // Check if the game is over
        if (currentRound+1 === totalRounds) {
            // Find winner based on highest score in users object
            let winner = Object.keys(users).reduce((a, b) => users[a].score > users[b].score ? a : b);

            io.emit('gameOver', users[winner].username);
            resetGame();
            return;
        }
        // Emit a 5 second countdown to the next round
        let counter = 5;
        const interval = setInterval(() => {
            io.emit('nextRoundCounter', counter);
            counter--;
            if (counter < 0) {
                clearInterval(interval);
                if (increaseRound) {
                    currentRound++;
                }
                roundActive = true;
                io.emit('newRound');
                emitQuestion();
            }
        }, 1000);
    }

    function emitRoundInfo() {
        io.emit('roundInfo', "Round " + (currentRound +1) + " of " + totalRounds);
    }

    function resetGame() {
        for (let user in users) {
            users[user].score = 0;
        }
        currentRound = 0;
        roundActive = true;
        // Wait 5 seconds before starting the next round
        startGame();
        nextRoundCounter(false);
    }
});

server.listen(port, () => console.log(`Listening on port ${port} and waiting for clients to connect...`));

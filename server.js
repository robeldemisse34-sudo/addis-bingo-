const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const TelegramBot = require('node-telegram-bot-api');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*" }
});

const token = process.env.TELEGRAM_BOT_TOKEN || "8784582049:AAGWUEzt7q70yRm2BgldnNiBTRmfz6Anhys";

// Error-handled bot instance to prevent 409 conflict crashes
const bot = new TelegramBot(token, { 
    polling: {
        autoStart: true,
        params: { timeout: 10 }
    }
});

bot.on('polling_error', (error) => {
    if (error.code === 'ETELEGRAM' && error.message.includes('409 Conflict')) {
        return; // Ignore temporary deploy transitions on Render
    }
    console.error('Polling error:', error);
});

app.use(express.static('.'));

// --- USER DATABASE STORAGE (LOCAL) ---
const users = {};

// --- TELEGRAM BOT HANDLERS (EXACT USER CODE) ---
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    
    // Welcome image and exact original button grid
    bot.sendPhoto(chatId, "https://i.ibb.co/3sS8M3f/addis-bingo.jpg", {
        caption: "Welcome to Addis Bingo! Choose an option below:",
        reply_markup: {
            keyboard: [
                [{ text: "Play Bingo 🎮", web_app: { url: "https://addis-bingo-green.vercel.app" } }, { text: "Play Spin 🎰" }],
                [{ text: "Register 📝" }, { text: "Deposit 💵" }],
                [{ text: "Check Balance 💰" }, { text: "Contact Support 📞" }],
                [{ text: "Instruction 📖" }, { text: "Invite ✉️" }]
            ],
            resize_keyboard: true
        }
    }).catch(() => {
        // Fallback message if image URL fails
        bot.sendMessage(chatId, "Welcome to Addis Bingo! Choose an option below:", {
            reply_markup: {
                keyboard: [
                    [{ text: "Play Bingo 🎮", web_app: { url: "https://addis-bingo-green.vercel.app" } }, { text: "Play Spin 🎰" }],
                    [{ text: "Register 📝" }, { text: "Deposit 💵" }],
                    [{ text: "Check Balance 💰" }, { text: "Contact Support 📞" }],
                    [{ text: "Instruction 📖" }, { text: "Invite ✉️" }]
                ],
                resize_keyboard: true
            }
        });
    });
});

// Text buttons matching exact layout
bot.on('message', (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;

    if (text === "Deposit 💵" || text === "💰 Deposit") {
        bot.sendMessage(chatId, 
            "💰 *Telebirr Deposit Instructions*\n\n" +
            "Transfer funds via Telebirr to:\n" +
            "📱 *Number:* `0900071279`\n" +
            "👤 *Account Name:* robel\n\n" +
            "Your balance will be updated after verification.", { parse_mode: "Markdown" });
    } else if (text === "Check Balance 💰" || text === "📊 Check Balance") {
        const bal = users[chatId]?.balance || 0.38;
        bot.sendMessage(chatId, `📊 Your current wallet balance is: ${bal.toFixed(2)} ETB`);
    } else if (text === "Register 📝") {
        bot.sendMessage(chatId, "Please use the /register command or share your contact number to register.");
    }
});

// --- WEBSOCKET MULTIPLAYER GAME ENGINE ---
const MIN_CARDS = 3;
const MAX_CARDS = 100;

let gameState = {
    status: 'WAITING', 
    reservedCards: {}, 
    drawnBalls: [],
    availableBalls: Array.from({ length: 75 }, (_, i) => i + 1),
    countdown: 30,
    currentBall: null
};

let countdownInterval = null;
let ballDrawInterval = null;

io.on('connection', (socket) => {
    socket.emit('syncState', {
        status: gameState.status,
        reservedCards: gameState.reservedCards,
        drawnBalls: gameState.drawnBalls,
        currentBall: gameState.currentBall,
        countdown: gameState.countdown,
        activeCardCount: Object.keys(gameState.reservedCards).length
    });

    socket.on('reserveCard', (cardId) => {
        if (gameState.status === 'IN_PROGRESS') return socket.emit('errorMsg', 'Game in progress!');
        if (gameState.reservedCards[cardId]) return socket.emit('errorMsg', `Card #${cardId} taken!`);

        gameState.reservedCards[cardId] = socket.id;
        const activeCount = Object.keys(gameState.reservedCards).length;
        io.emit('cardReserved', { cardId, socketId: socket.id, activeCount });

        if (activeCount >= MIN_CARDS && gameState.status === 'WAITING') {
            startCountdown();
        }
    });

    socket.on('unreserveCard', (cardId) => {
        if (gameState.reservedCards[cardId] === socket.id && gameState.status !== 'IN_PROGRESS') {
            delete gameState.reservedCards[cardId];
            const activeCount = Object.keys(gameState.reservedCards).length;
            io.emit('cardUnreserved', { cardId, activeCount });

            if (activeCount < MIN_CARDS && gameState.status === 'COUNTDOWN') {
                clearInterval(countdownInterval);
                gameState.status = 'WAITING';
                gameState.countdown = 30;
                io.emit('countdownAborted', 'Waiting for minimum 3 cards...');
            }
        }
    });

    socket.on('disconnect', () => {
        if (gameState.status !== 'IN_PROGRESS') {
            for (let cardId in gameState.reservedCards) {
                if (gameState.reservedCards[cardId] === socket.id) {
                    delete gameState.reservedCards[cardId];
                    const activeCount = Object.keys(gameState.reservedCards).length;
                    io.emit('cardUnreserved', { cardId, activeCount });
                }
            }
        }
    });
});

function startCountdown() {
    gameState.status = 'COUNTDOWN';
    gameState.countdown = 30;

    countdownInterval = setInterval(() => {
        gameState.countdown--;
        const activeCount = Object.keys(gameState.reservedCards).length;
        io.emit('countdownTick', { timeLeft: gameState.countdown, activeCount });

        if (activeCount === MAX_CARDS || gameState.countdown <= 0) {
            clearInterval(countdownInterval);
            startBallDraw();
        }
    }, 1000);
}

function startBallDraw() {
    gameState.status = 'IN_PROGRESS';
    gameState.drawnBalls = [];
    gameState.availableBalls = Array.from({ length: 75 }, (_, i) => i + 1);

    io.emit('gameStarted');

    ballDrawInterval = setInterval(() => {
        if (gameState.availableBalls.length === 0) {
            clearInterval(ballDrawInterval);
            return;
        }

        const randomIndex = Math.floor(Math.random() * gameState.availableBalls.length);
        const ball = gameState.availableBalls.splice(randomIndex, 1)[0];
        gameState.drawnBalls.push(ball);
        gameState.currentBall = ball;

        io.emit('ballDrawn', { ball, drawnBalls: gameState.drawnBalls });
    }, 3000);
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));

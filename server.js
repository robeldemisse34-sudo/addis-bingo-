const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const TelegramBot = require('node-telegram-bot-api');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*" }
});

const token = process.env.BOT_TOKEN || "8784582049:AAEBE7wiZ1ifz2cfbaULSvDaOg_u0m3z0a0";


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

// --- ADMIN & STORAGE CONFIGURATION ---
const ADMIN_CHAT_ID = 123456789; // Replace with your numeric Telegram User ID from @userinfobot

const users = {};
const userDepositState = {};
const pendingDeposits = {};

function getUserBalance(chatId) {
    if (users[chatId] === undefined) {
        users[chatId] = { balance: 0.00 };
    }
    return users[chatId].balance;
}

function getWelcomeCaption(chatId) {
    const bal = getUserBalance(chatId);
    return `Welcome to Addis Bingo! Choose an option below:\n\n💰 *Live Balance:* \`${bal.toFixed(2)} ETB\``;
}

function resetDepositState(chatId) {
    delete userDepositState[chatId];
}

// --- TELEGRAM BOT /start HANDLER (CHANNEL CHECK REMOVED) ---
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    const photoUrl = "https://i.ibb.co/3sS8M3f/addis-bingo.jpg";

    bot.sendPhoto(chatId, photoUrl, {
        caption: getWelcomeCaption(chatId),
        parse_mode: "Markdown",
        reply_markup: {
            keyboard: [
                [
                    { text: "Play Bingo 🎮", web_app: { url: "https://addis-bingo-green.vercel.app" } }, 
                    { text: "Play Spin 🎰" }
                ],
                [
                    { text: "Register 📝" }, 
                    { text: "Deposit 💵" }
                ],
                [
                    { text: "Check Balance 💰" }, 
                    { text: "Contact Support 📞" }
                ],
                [
                    { text: "Instruction 📖" }, 
                    { text: "Invite ✉️" }
                ]
            ],
            resize_keyboard: true
        }
    }).catch(() => {
        bot.sendMessage(chatId, getWelcomeCaption(chatId), {
            parse_mode: "Markdown",
            reply_markup: {
                keyboard: [
                    [
                        { text: "Play Bingo 🎮", web_app: { url: "https://addis-bingo-green.vercel.app" } }, 
                        { text: "Play Spin 🎰" }
                    ],
                    [
                        { text: "Register 📝" }, 
                        { text: "Deposit 💵" }
                    ],
                    [
                        { text: "Check Balance 💰" }, 
                        { text: "Contact Support 📞" }
                    ],
                    [
                        { text: "Instruction 📖" }, 
                        { text: "Invite ✉️" }
                    ]
                ],
                resize_keyboard: true
            }
        });
    });
});

// --- MESSAGE HANDLERS (NAVIGATION & TWO-STEP DEPOSIT) ---
bot.on('message', (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text ? msg.text.trim() : "";

    if (!text || text.startsWith('/')) return;

    // Menu Actions
    if (text.includes("Check Balance")) {
        const bal = getUserBalance(chatId);
        return bot.sendMessage(chatId, `💰 *Live Balance Tracker*\n\nYour current wallet balance is: \`${bal.toFixed(2)} ETB\``, { parse_mode: "Markdown" });
    } else if (text.includes("Register")) {
        return bot.sendMessage(chatId, "⚠️ You are already registered!");
    } else if (text.includes("Instruction")) {
        return bot.sendMessage(chatId, "📖 Select cards, place your bet, and mark off numbers as they are called to complete lines!");
    } else if (text.includes("Invite")) {
        return bot.sendMessage(chatId, `✉️ Share your referral link with friends:\nhttps://t.me/AddisBingoBot?start=${chatId}`);
    } else if (text.includes("Contact Support")) {
        return bot.sendMessage(chatId, "📞 For support, please reach out to: @your_support_username");
    }

    // Step 1: Click "Deposit" -> Bot asks for amount
    if (text.includes("Deposit")) {
        userDepositState[chatId] = { step: 'AWAITING_AMOUNT' };
        return bot.sendMessage(chatId, "💵 *Enter Deposit Amount*\n\nPlease reply with the amount you wish to deposit in ETB (e.g., `50`, `100`, `500`):", { parse_mode: "Markdown" });
    }

    // Step 2: Input Amount -> Bot shows payment details & asks for Txn ID
    if (userDepositState[chatId]?.step === 'AWAITING_AMOUNT') {
        const amount = parseFloat(text);
        if (isNaN(amount) || amount <= 0) {
            return bot.sendMessage(chatId, "❌ Invalid amount. Please enter a valid number (e.g., `100`):");
        }

        userDepositState[chatId] = { step: 'AWAITING_TXN_ID', amount: amount };

        return bot.sendMessage(chatId, 
            `💰 *Telebirr Deposit Details*\n\n` +
            `Requested Amount: *${amount.toFixed(2)} ETB*\n\n` +
            `Please transfer *${amount.toFixed(2)} ETB* via Telebirr to:\n` +
            `📱 *Number:* \`0900071279\`\n` +
            `👤 *Account Name:* robel\n\n` +
            `👇 *After sending the money, reply here with your Telebirr Transaction ID (or send a screenshot):*`, 
            { parse_mode: "Markdown" }
        );
    }

    // Step 3: Input Txn ID -> Forward request to Admin
    if (userDepositState[chatId]?.step === 'AWAITING_TXN_ID') {
        const amount = userDepositState[chatId].amount;
        const depositId = `DEP-${Date.now()}`;

        pendingDeposits[depositId] = {
            userId: chatId,
            amount: amount,
            txnId: text,
            userName: msg.from.first_name || "User"
        };

        resetDepositState(chatId);

        bot.sendMessage(chatId, `⏳ *Deposit Request Received!*\n\nAmount: *${amount.toFixed(2)} ETB*\nTransaction ID: \`${text}\`\n\nYour payment is being verified by admin. You will be notified shortly.`, { parse_mode: "Markdown" });

        return bot.sendMessage(ADMIN_CHAT_ID, 
            `📥 *New Deposit Verification Request*\n\n` +
            `👤 *User:* ${msg.from.first_name} (@${msg.from.username || 'N/A'})\n` +
            `🆔 *User ID:* \`${chatId}\`\n` +
            `💰 *Expected Amount:* *${amount.toFixed(2)} ETB*\n` +
            `📄 *Submitted Txn ID:* \`${text}\`\n` +
            `🔖 *Ref Code:* \`${depositId}\``, 
            {
                parse_mode: "Markdown",
                reply_markup: {
                    inline_keyboard: [
                        [
                            { text: `✅ Approve ${amount.toFixed(2)} ETB`, callback_data: `approve_${depositId}` },
                            { text: "❌ Reject", callback_data: `reject_${depositId}` }
                        ]
                    ]
                }
            }
        );
    }
});

// Photo upload handler for deposit screenshots
bot.on('photo', (msg) => {
    const chatId = msg.chat.id;

    if (userDepositState[chatId]?.step === 'AWAITING_TXN_ID') {
        const amount = userDepositState[chatId].amount;
        const depositId = `DEP-${Date.now()}`;
        const photoId = msg.photo[msg.photo.length - 1].file_id;

        pendingDeposits[depositId] = {
            userId: chatId,
            amount: amount,
            txnId: "Screenshot attached",
            userName: msg.from.first_name || "User"
        };

        resetDepositState(chatId);

        bot.sendMessage(chatId, "⏳ *Screenshot Received!* Your deposit is under review.", { parse_mode: "Markdown" });

        bot.sendPhoto(ADMIN_CHAT_ID, photoId, {
            caption: `📥 *New Screenshot Deposit Request*\n\n` +
                     `👤 *User:* ${msg.from.first_name}\n` +
                     `🆔 *User ID:* \`${chatId}\`\n` +
                     `💰 *Expected Amount:* *${amount.toFixed(2)} ETB*\n` +
                     `🔖 *Ref Code:* \`${depositId}\``,
            parse_mode: "Markdown",
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: `✅ Approve ${amount.toFixed(2)} ETB`, callback_data: `approve_${depositId}` },
                        { text: "❌ Reject", callback_data: `reject_${depositId}` }
                    ]
                ]
            }
        });
    }
});

// --- ADMIN CALLBACK BUTTON HANDLERS ---
bot.on('callback_query', (query) => {
    const data = query.data;

    if (data.startsWith('approve_')) {
        const depositId = data.replace('approve_', '');
        const deposit = pendingDeposits[depositId];

        if (!deposit) {
            return bot.answerCallbackQuery(query.id, { text: "Request already processed or expired." });
        }

        const targetUserId = deposit.userId;
        const amount = deposit.amount;

        users[targetUserId] = users[targetUserId] || { balance: 0.00 };
        users[targetUserId].balance += amount;

        bot.sendMessage(ADMIN_CHAT_ID, `✅ *Approved!* Credited *${amount.toFixed(2)} ETB* to User \`${targetUserId}\`. New Balance: *${users[targetUserId].balance.toFixed(2)} ETB*`, { parse_mode: "Markdown" });
        bot.sendMessage(targetUserId, `🎉 *Deposit Approved!*\n\nYour account has been credited with *${amount.toFixed(2)} ETB*.\n💰 Current Balance: *${users[targetUserId].balance.toFixed(2)} ETB*`, { parse_mode: "Markdown" });

        delete pendingDeposits[depositId];
        bot.answerCallbackQuery(query.id, { text: "Deposit Approved!" });

    } else if (data.startsWith('reject_')) {
        const depositId = data.replace('reject_', '');
        const deposit = pendingDeposits[depositId];

        if (!deposit) {
            return bot.answerCallbackQuery(query.id, { text: "Request already processed or expired." });
        }

        const targetUserId = deposit.userId;

        bot.sendMessage(ADMIN_CHAT_ID, `❌ Rejected deposit request \`${depositId}\`.`, { parse_mode: "Markdown" });
        bot.sendMessage(targetUserId, `❌ *Deposit Rejected*\nWe could not verify your payment transaction ID. Please contact support if you need assistance.`, { parse_mode: "Markdown" });

        delete pendingDeposits[depositId];
        bot.answerCallbackQuery(query.id, { text: "Deposit Rejected" });
    }
});

// --- WEBSOCKET ENGINE ---
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

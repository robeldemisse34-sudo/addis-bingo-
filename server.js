const path = require('path');
const fs = require('fs');
const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const admin = require('firebase-admin');

const app = express();
app.use(express.json());

// Firebase Setup
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: `https://${serviceAccount.project_id}-default-rtdb.firebaseio.com`
});
const db = admin.database();

const token = process.env.TELEGRAM_BOT_TOKEN;
const PORT = process.env.PORT || 10000;
const bot = new TelegramBot(token);

// Main Menu Keyboard Layout
const mainMenu = {
  reply_markup: {
    keyboard: [
      [{ text: "Play Bingo" }, { text: "Play Spin" }],
      [{ text: "Register" }, { text: "Deposit" }, { text: "Withdraw" }],
      [{ text: "Check Balance" }, { text: "Contact Support" }],
      [{ text: "Instruction" }, { text: "Invite" }]
    ],
    resize_keyboard: true
  }
};

// Serve static files
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});
app.get('/style.css', (req, res) => {
  res.sendFile(path.join(__dirname, 'style.css'));
});
app.get('/game.js', (req, res) => {
  res.sendFile(path.join(__dirname, 'game.js'));
});

// Telegram Webhook
app.post(`/bot${token}`, (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

// Message Handler
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;
  const userId = String(msg.from.id);

  if (msg.contact) {
    const phoneNumber = msg.contact.phone_number;
    await db.ref(`users/${userId}`).update({
      phone: phoneNumber,
      registeredAt: Date.now(),
      username: msg.from.username || msg.from.first_name || "User"
    });
    
    const balanceRef = db.ref(`users/${userId}/balance`);
    const snap = await balanceRef.once('value');
    if (!snap.exists()) await balanceRef.set(0);

    return bot.sendMessage(chatId, "You are registered successfully!", mainMenu);
  }

  if (text === '/start' || text === 'Back to Menu') {
    return bot.sendMessage(chatId, "Welcome to Addis Bingo!", mainMenu);
  }

  if (text === 'Register') {
    return bot.sendMessage(chatId, "Please tap the button below to share your contact and complete registration:", {
      reply_markup: {
        keyboard: [
          [{ text: "Share Contact", request_contact: true }],
          [{ text: "Back to Menu" }]
        ],
        resize_keyboard: true,
        one_time_keyboard: true
      }
    });
  }

  if (text === 'Play Bingo') {
    return bot.sendMessage(chatId, "Tap below to play:", {
      reply_markup: {
        inline_keyboard: [
          [{ text: "Play", web_app: { url: "https://addis-bingo-bot-v2.onrender.com" } }]
        ]
      }
    });
  }

  if (text === 'Play Spin') {
    return bot.sendMessage(chatId, "Spin game is coming soon!");
  }

  if (text === 'Deposit') {
    return bot.sendMessage(chatId, "To deposit funds, please contact support or send your transaction receipt to the admin.");
  }

  if (text === 'Withdraw') {
    return bot.sendMessage(chatId, "To withdraw your winnings, ensure your balance is sufficient and contact support.");
  }

  if (text === 'Check Balance') {
    const snap = await db.ref(`users/${userId}/balance`).once('value');
    const balance = snap.exists() ? snap.val() : 0;
    return bot.sendMessage(chatId, `Your current balance is: ${Number(balance).toFixed(2)} ETB`);
  }

  if (text === 'Contact Support') {
    return bot.sendMessage(chatId, "For any issues or questions, please contact our support team.");
  }

  if (text === 'Instruction') {
    return bot.sendMessage(chatId, "How to Play:\n1. Register your contact.\n2. Tap Play Bingo to open the app.\n3. Choose your card and start playing!");
  }

  if (text === 'Invite') {
    return bot.sendMessage(chatId, "Invite your friends using your link: https://t.me/addis_bingo_bot");
  }
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

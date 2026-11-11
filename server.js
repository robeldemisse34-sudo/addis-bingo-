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

// Serve index.html directly and handle css/js files from root
app.get('/', (req, res) => {
  const filePath = path.join(__dirname, 'index.html');
  fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) {
      res.status(404).send("Index.html not found on server root");
    } else {
      res.send(data);
    }
  });
});

// Serve style.css and game.js directly if requested
app.get('/style.css', (req, res) => {
  res.sendFile(path.join(__dirname, 'style.css'));
});

app.get('/game.js', (req, res) => {
  res.sendFile(path.join(__dirname, 'game.js'));
});

// Telegram Webhook Endpoint
app.post(`/bot${token}`, (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

// Handle Inline Buttons (Approve / Reject)
bot.on('callback_query', async (query) => {
  const chatId = query.message.chat.id;
  const data = query.data;

  try {
    await bot.answerCallbackQuery(query.id, { text: "Processing..." });
  } catch (err) {
    console.error("Callback error:", err);
  }

  if (data.startsWith('approve_')) {
    const [, userId, amount] = data.split('_');
    try {
      const userRef = db.ref(`users/${userId}/balance`);
      await userRef.transaction((curr) => (curr || 0) + parseFloat(amount));

      await bot.sendMessage(chatId, `Approved ${amount} ETB for User ${userId}`);
      await bot.sendMessage(userId, `Your deposit of ${amount} ETB was approved!`);
      await bot.editMessageText(`Approved: ${amount} ETB (User: ${userId})`, {
        chat_id: chatId,
        message_id: query.message.message_id
      });
    } catch (err) {
      console.error(err);
      await bot.sendMessage(chatId, "Failed to update Firebase.");
    }
  }
});

// Handle Commands and Menu Options
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;
  const userId = String(msg.from.id);

  // Helper function for main keyboard layout
  const mainMenuKeyboard = {
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

  // Handle Shared Contact
  if (msg.contact) {
    const phoneNumber = msg.contact.phone_number;
    const userRef = db.ref(`users/${userId}`);
    
    await userRef.update({
      phone: phoneNumber,
      registeredAt: Date.now(),
      username: msg.from.username || msg.from.first_name || "User"
    });

    userRef.child('balance').once('value', async (snapshot) => {
      if (!snapshot.exists()) {
        await userRef.child('balance').set(0);
      }
    });

    return bot.sendMessage(chatId, "You are registered successfully!", mainMenuKeyboard);
  }

  if (text === '/start') {
    return bot.sendMessage(chatId, "Welcome to Addis Bingo!", mainMenuKeyboard);
  }

  // 1. Register Button
  if (text === 'Register') {
    return bot.sendMessage(chatId, "Please tap the button below to share your contact and complete registration:", {
      reply_markup: {
        keyboard: [
          [{ text: "Share Contact", request_contact: true }],
          [{ text:

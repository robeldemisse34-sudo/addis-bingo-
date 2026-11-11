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

// Initialize bot for webhooks
const bot = new TelegramBot(token, { polling: false });

// Set Webhook URL
const RENDER_URL = process.env.RENDER_EXTERNAL_URL || "https://addis-bingo-bot-v2.onrender.com";
bot.setWebHook(`${RENDER_URL}/bot${token}`).then(() => {
  console.log(`Webhook active: ${RENDER_URL}/bot${token}`);
});

// Set Menu Commands
bot.setMyCommands([
  { command: 'start', description: 'Start the bot' },
  { command: 'playbingo', description: 'Play Bingo' },
  { command: 'register', description: 'Register account' },
  { command: 'balance', description: 'Check balance' }
]);

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/style.css', (req, res) => res.sendFile(path.join(__dirname, 'style.css')));
app.get('/game.js', (req, res) => res.sendFile(path.join(__dirname, 'game.js')));

// Webhook Route
app.post(`/bot${token}`, (req, res) => {
  res.sendStatus(200);
  try {
    bot.processUpdate(req.body);
  } catch (err) {
    console.error("Update error:", err);
  }
});

// Main Message Handler
bot.on('message', async (msg) => {
  try {
    const chatId = msg.chat.id;
    const text = msg.text ? msg.text.trim().toLowerCase() : '';
    const userId = String(msg.from.id);

    // 1. Handle Contact Sharing
    if (msg.contact) {
      const phoneNumber = msg.contact.phone_number;
      const userRef = db.ref(`users/${userId}`);
      const snap = await userRef.once('value');

      if (snap.exists() && snap.val().phone) {
        return bot.sendMessage(chatId, "You are already registered!", {
          reply_markup: { remove_keyboard: true }
        });
      } else {
        await userRef.update({ 
          phone: phoneNumber, 
          registeredAt: Date.now(), 
          balance: snap.exists() && snap.val().balance !== undefined ? snap.val().balance : 0 
        });
        return bot.sendMessage(chatId, "You are registered successfully!", {
          reply_markup: { remove_keyboard: true }
        });
      }
    }

    // 2. Handle /start or /register
    if (text.startsWith('/start') || text.startsWith('/register')) {
      const snap = await db.ref(`users/${userId}`).once('value');
      
      if (!snap.exists() || !snap.val().phone) {
        return bot.sendMessage(chatId, "Welcome to Addis Bingo! Please tap below to share your contact and register:", {
          reply_markup: {
            keyboard: [[{ text: "Share Contact", request_contact: true }]],
            resize_keyboard: true,
            one_time_keyboard: true
          }
        });
      } else {
        return bot.sendMessage(chatId, "Welcome back to Addis Bingo!", {
          reply_markup: { remove_keyboard: true }
        });
      }
    }

    // 3. Handle /playbingo
    if (text.startsWith('/playbingo')) {
      const snap = await db.ref(`users/${userId}`).once('value');
      
      if (!snap.exists() || !snap.val().phone) {
        return bot.sendMessage(chatId, "⚠️ You must register your account before playing! Tap below to share your contact:", {
          reply_markup: {
            keyboard: [[{ text: "Share Contact", request_contact: true }]],
            resize_keyboard: true,
            one_time_keyboard: true
          }
        });
      }

      return bot.sendMessage(chatId, "Tap below to play:", {
        reply_markup: {
          inline_keyboard: [[{ text: "Play", web_app: { url: "https://addis-bingo-bot-v2.onrender.com" } }]]
        }
      });
    }

    // 4. Handle /balance
    if (text.startsWith('/balance')) {
      const snap = await db.ref(`users/${userId}/balance`).once('value');
      const balance = snap.exists() ? snap.val() : 0;
      return bot.sendMessage(chatId, `Your current balance is: ${Number(balance).toFixed(2)} ETB`, {
        reply_markup: { remove_keyboard: true }
      });
    }

  } catch (err) {
    console.error("Error:", err);
  }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

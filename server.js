const path = require('path');
const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const admin = require('firebase-admin');

const app = express();
app.use(express.json());

// Serve static frontend files from the "public" folder
app.use(express.static(path.join(__dirname, 'public')));

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

// Serve the WebApp HTML on root route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
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

      await bot.sendMessage(chatId, `✅ Approved ${amount} ETB for User ${userId}`);
      await bot.sendMessage(userId, `🎉 Your deposit of ${amount} ETB was approved!`);
      await bot.editMessageText(`✅ Approved: ${amount} ETB (User: ${userId})`, {
        chat_id: chatId,
        message_id: query.message.message_id
      });
    } catch (err) {
      console.error(err);
      await bot.sendMessage(chatId, "❌ Failed to update Firebase.");
    }
  }
});

// Handle Commands and Menu Options
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;

  if (text === '/start') {
    return bot.sendMessage(chatId, "Welcome to Addis Bingo!", {
      reply_markup: {
        keyboard: [
          [{ text: "Play Bingo 🎰" }, { text: "Play Spin 🎰" }],
          [{ text: "Register 📝" }, { text: "Deposit 💵" }, { text: "Withdraw 🏧" }],
          [{ text: "Check Balance 💰" }, { text: "Contact Support 📞" }],
          [{ text: "Instruction 📖" }, { text: "Invite ✉️" }]
        ],
        resize_keyboard: true
      }
    });
  }

  if (text === 'Register 📝' || text === 'Play Bingo 🎰' || text === 'Play Spin 🎰') {
    return bot.sendMessage(chatId, "Tap below to launch Addis Bingo:", {
      reply_markup: {
        inline_keyboard: [
          [{ text: "🚀 Launch Game", web_app: { url: "https://addis-bingo-bot-v2.onrender.com" } }]
        ]
      }
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

const TelegramBot = require('node-telegram-bot-api');
const admin = require('firebase-admin');
const express = require('express');

const app = express();
app.use(express.json());

// Initialize Firebase Admin
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: `https://${serviceAccount.project_id}-default-rtdb.firebaseio.com`
});
const db = admin.database();

// Initialize Telegram Bot
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN);
const PORT = process.env.PORT || 10000;

// Webhook endpoint for Telegram
app.post(`/bot${process.env.TELEGRAM_BOT_TOKEN}`, (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

// Inline Button Handler (Approve / Reject)
bot.on('callback_query', async (query) => {
  const chatId = query.message.chat.id;
  const data = query.data;

  // Always answer callback immediately to stop spinning loading icon
  try {
    await bot.answerCallbackQuery(query.id, { text: "Processing..." });
  } catch (err) {
    console.error("Callback answer error:", err);
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

// Main Message Handler
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
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log("Firebase Admin SDK connected successfully.");
});

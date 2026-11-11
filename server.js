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
  const userId = String(msg.from.id);

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

  // 1. Register Button
  if (text === 'Register 📝') {
    const userRef = db.ref(`users/${userId}`);
    userRef.once('value', async (snapshot) => {
      if (!snapshot.exists()) {
        await userRef.set({
          balance: 0,
          bonus: 0,
          registeredAt: Date.now(),
          username: msg.from.username || msg.from.first_name || "User"
        });
        await bot.sendMessage(chatId, "🎉 Registration successful! Your account has been created with 0.00 ETB balance.");
      } else {
        await bot.sendMessage(chatId, "ℹ️ You are already registered in the system!");
      }
    });
    return;
  }

  // 2. Play Bingo Button
  if (text === 'Play Bingo 🎰') {
    return bot.sendMessage(chatId, "Tap below to play:", {
      reply_markup: {
        inline_keyboard: [
          [{ text: "Play", web_app: { url: "https://addis-bingo-bot-v2.onrender.com" } }]
        ]
      }
    });
  }

  // 3. Play Spin Button
  if (text === 'Play Spin 🎰') {
    return bot.sendMessage(chatId, "🎰 Spin game is coming soon!");
  }

  // 4. Deposit Button
  if (text === 'Deposit 💵') {
    return bot.sendMessage(chatId, "💳 To deposit funds, please contact our support or send your transaction receipt to the admin to top up your balance.");
  }

  // 5. Withdraw Button
  if (text === 'Withdraw 🏧') {
    return bot.sendMessage(chatId, "🏧 To withdraw your winnings, ensure your balance is sufficient and contact support with your account details.");
  }

  // 6. Check Balance Button
  if (text === 'Check Balance 💰') {
    const userRef = db.ref(`users/${userId}/balance`);
    userRef.once('value', (snapshot) => {
      const balance = snapshot.exists() ? snapshot.val() : 0;
      bot.sendMessage(chatId, `💰 Your current balance is: ${Number(balance).toFixed(2)} ETB`);
    });
    return;
  }

  // 7. Contact Support Button
  if (text === 'Contact Support 📞') {
    return bot.sendMessage(chatId, "📞 For any issues or questions, please contact our admin support team.");
  }

  // 8. Instruction Button
  if (text === 'Instruction 📖') {
    return bot.sendMessage(chatId, "📖 **How to Play Addis Bingo:**\n1. Register an account.\n2. Tap Play Bingo to open the game.\n3. Select your card number and start playing to win!");
  }

  // 9. Invite Button
  if (text === 'Invite ✉️') {
    const botUsername = "addis_bingo_bot"; // You can change this to your actual bot username
    return bot.sendMessage(chatId, `✉️ Invite your friends to Addis Bingo and earn bonuses!\n\nShare your referral link: https://t.me/${botUsername}`);
  }
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

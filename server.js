const TelegramBot = require('node-telegram-bot-api');
const admin = require('firebase-admin');
const express = require('express');

const app = express();
app.use(express.json());

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: `https://${serviceAccount.project_id}-default-rtdb.firebaseio.com`
});
const db = admin.database();

const token = process.env.TELEGRAM_BOT_TOKEN;
const PORT = process.env.PORT || 10000;
const bot = new TelegramBot(token);

// User state tracking for multi-step prompts (e.g. Deposit amount)
const userStates = {};

app.post(`/bot${token}`, (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

// Inline Buttons Handler (Approve / Reject)
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

// All Menu Buttons & Text Messages
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;
  const userId = msg.from.id;

  // 1. Send Main Menu Command
  if (text === '/start') {
    delete userStates[chatId];
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

  // 2. Register / Play Bingo (Open WebApp)
  if (text === 'Register 📝' || text === 'Play Bingo 🎰' || text === 'Play Spin 🎰') {
    delete userStates[chatId];
    return bot.sendMessage(chatId, "Tap below to launch Addis Bingo App:", {
      reply_markup: {
        inline_keyboard: [
          [{ text: "🚀 Open Web App", web_app: { url: "https://addis-bingo-bot-v2.onrender.com" } }]
        ]
      }
    });
  }

  // 3. Check Balance
  if (text === 'Check Balance 💰') {
    delete userStates[chatId];
    const snapshot = await db.ref(`users/${userId}/balance`).once('value');
    const balance = snapshot.val() || 0;
    return bot.sendMessage(chatId, `💰 Your current balance is: ${balance} ETB`);
  }

  // 4. Deposit Initiated
  if (text === 'Deposit 💵') {
    userStates[chatId] = { step: 'AWAITING_AMOUNT' };
    return bot.sendMessage(chatId, "💳 Enter the amount you wish to deposit (in ETB):");
  }

  // 5. Handle Deposit Steps
  if (userStates[chatId] && userStates[chatId].step === 'AWAITING_AMOUNT') {
    const amount = parseFloat(text);
    if (isNaN(amount) || amount <= 0) {
      return bot.sendMessage(chatId, "Please enter a valid positive number for deposit.");
    }

    userStates[chatId] = { step: 'AWAITING_TXID', amount: amount };
    return bot.sendMessage(chatId, `💵 Deposit Amount: ${amount} ETB\n\nPlease send your Telebirr Transaction ID or receipt screenshot:`);
  }

  if (userStates[chatId] && userStates[chatId].step === 'AWAITING_TXID') {
    const amount = userStates[chatId].amount;
    delete userStates[chatId];

    // Forward to Admin
    const adminChatId = process.env.ADMIN_CHAT_ID;
    if (adminChatId) {
      await bot.sendMessage(adminChatId, `📥 *New Deposit Request*\nUser: ${userId}\nAmount: ${amount} ETB\nDetails/TxID: ${text}`, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: "✅ Approve", callback_data: `approve_${userId}_${amount}` }]
          ]
        }
      });
    }

    return bot.sendMessage(chatId, "✅ Your deposit request has been sent to Admin for approval!");
  }

  // 6. Support & Instructions
  if (text === 'Contact Support 📞') {
    delete userStates[chatId];
    return bot.sendMessage(chatId, "📞 Support contact: @AddisBingoSupport");
  }

  if (text === 'Instruction 📖') {
    delete userStates[chatId];
    return bot.sendMessage(chatId, "📖 Rules: Deposit ETB, buy tickets in the WebApp, match 5 numbers to win!");
  }
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

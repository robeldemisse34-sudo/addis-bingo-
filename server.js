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

// Register popup commands for the Menu button
bot.setMyCommands([
  { command: 'start', description: 'Start the bot' },
  { command: 'playbingo', description: 'Start playing Bingo' },
  { command: 'playspin', description: 'Start playing Spin' },
  { command: 'register', description: 'Register for an account' },
  { command: 'balance', description: 'Check account balance' },
  { command: 'deposit', description: 'Deposit funds' },
  { command: 'withdraw', description: 'Withdraw winnings' },
  { command: 'support', description: 'Contact support' },
  { command: 'instruction', description: 'How to play' },
  { command: 'invite', description: 'Invite friends' }
]);

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

// Message & Command Handler
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text ? msg.text.trim() : '';
  const userId = String(msg.from.id);

  // Helper object to remove keyboards completely
  const clearKeyboard = { reply_markup: { remove_keyboard: true } };

  // 1. Handle Contact Sharing
  if (msg.contact) {
    const phoneNumber = msg.contact.phone_number;
    const userRef = db.ref(`users/${userId}`);
    
    try {
      const snapshot = await userRef.once('value');
      const userData = snapshot.val();

      if (userData && userData.phone) {
        return bot.sendMessage(chatId, "You are already registered!", clearKeyboard);
      } else {
        await userRef.update({
          phone: phoneNumber,
          registeredAt: Date.now(),
          username: msg.from.username || msg.from.first_name || "User",
          balance: userData && userData.balance !== undefined ? userData.balance : 0
        });
        return bot.sendMessage(chatId, "You are registered successfully!", clearKeyboard);
      }
    } catch (err) {
      console.error("Firebase error on contact save:", err);
      return bot.sendMessage(chatId, "Registration error. Please try again.", clearKeyboard);
    }
  }

  // 2. /start command
  if (text === '/start') {
    const snapshot = await db.ref(`users/${userId}`).once('value');
    const userData = snapshot.val();

    if (!userData || !userData.phone) {
      return bot.sendMessage(chatId, "Welcome to Addis Bingo! Please register your account by sharing your contact:", {
        reply_markup: {
          keyboard: [
            [{ text: "Share Contact", request_contact: true }]
          ],
          resize_keyboard: true,
          one_time_keyboard: true
        }
      });
    } else {
      return bot.sendMessage(chatId, "Welcome back to Addis Bingo! Tap the Menu button to view options.", clearKeyboard);
    }
  }

  // 3. /register command
  if (text === '/register' || text === 'Register') {
    return bot.sendMessage(chatId, "Please tap the button below to share your contact and complete registration:", {
      reply_markup: {
        keyboard: [
          [{ text: "Share Contact", request_contact: true }]
        ],
        resize_keyboard: true,
        one_time_keyboard: true
      }
    });
  }

  // 4. /playbingo command
  if (text === '/playbingo' || text === 'Play Bingo') {
    const snapshot = await db.ref(`users/${userId}`).once('value');
    const userData = snapshot.val();

    if (!userData || !userData.phone) {
      return bot.sendMessage(chatId, "⚠️ You must register your account before playing! Tap below to share your contact:", {
        reply_markup: {
          keyboard: [
            [{ text: "Share Contact", request_contact: true }]
          ],
          resize_keyboard: true,
          one_time_keyboard: true
        }
      });
    }

    return bot.sendMessage(chatId, "Tap below to play:", {
      reply_markup: {
        inline_keyboard: [
          [{ text: "Play", web_app: { url: "https://addis-bingo-bot-v2.onrender.com" } }]
        ]
      },
      ...clearKeyboard.reply_markup
    });
  }

  // Other commands (All use clearKeyboard to wipe the button)
  if (text === '/playspin' || text === 'Play Spin') {
    return bot.sendMessage(chatId, "Spin game is coming soon!", clearKeyboard);
  }
  if (text === '/deposit' || text === 'Deposit') {
    return bot.sendMessage(chatId, "To deposit funds, please contact support or send your transaction receipt to the admin.", clearKeyboard);
  }
  if (text === '/withdraw' || text === 'Withdraw') {
    return bot.sendMessage(chatId, "To withdraw your winnings, ensure your balance is sufficient and contact support.", clearKeyboard);
  }
  if (text === '/balance' || text === 'Check Balance') {
    const snap = await db.ref(`users/${userId}/balance`).once('value');
    const balance = snap.exists() ? snap.val() : 0;
    return bot.sendMessage(chatId, `Your current balance is: ${Number(balance).toFixed(2)} ETB`, clearKeyboard);
  }
  if (text === '/support' || text === 'Contact Support') {
    return bot.sendMessage(chatId, "For any issues or questions, please contact our support team.", clearKeyboard);
  }
  if (text === '/instruction' || text === 'Instruction') {
    return bot.sendMessage(chatId, "How to Play:\n1. Register your contact via /register.\n2. Tap /playbingo to open the app.\n3. Choose your card and start playing!", clearKeyboard);
  }
  if (text === 'Invite') {
    return bot.sendMessage(chatId, "Invite your friends using your link: https://t.me/addis_bingo_bot", clearKeyboard);
  }
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

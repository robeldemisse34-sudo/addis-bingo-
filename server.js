const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const TelegramBot = require('node-telegram-bot-api');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

const token = process.env.TELEGRAM_BOT_TOKEN || "8784582049:AAEBE7wiZ1ifz2cfbaULSvDaOg_uOm3z0a0";const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID || "7936173420";

// Bot instance with polling error handling
const bot = new TelegramBot(token, {
  polling: {
    autoStart: true,
    params: { timeout: 10 }
  }
});

bot.on('polling_error', (error) => {
  if (error.code === 'ETELEGRAM' && error.message.includes('409 Conflict')) {
    return; // Ignore temporary deploy transitions
  }
  console.error('Polling error:', error);
});

app.use(express.static('.'));
app.use(express.json());

// In-memory user state storage
const userStates = {};
const userBalances = {};

// Keyboard Layouts
const mainKeyboard = {
  reply_markup: {
    keyboard: [
      [{ text: "Play Bingo 🎰" }, { text: "Play Spin 🎰" }],
      [{ text: "Register 📝" }, { text: "Deposit 💵" }],
      [{ text: "Check Balance 💰" }, { text: "Contact Support 📞" }],
      [{ text: "Instruction 📖" }, { text: "Invite ✉️" }]
    ],
    resize_keyboard: true
  }
};

// /start command handler
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const firstName = msg.from.first_name || "Player";
  
  if (!userBalances[chatId]) {
    userBalances[chatId] = 0;
  }

  const welcomeMessage = `👋 Welcome to Addis Bingo, ${firstName}!\n\n` +
    `💰 Current Balance: ${userBalances[chatId]} ETB\n\n` +
    `Choose an option below to get started:`;

  bot.sendMessage(chatId, welcomeMessage, mainKeyboard);
});

// Incoming message router
bot.on('message', (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;

  if (!text || text.startsWith('/')) return;

  // Handle active deposit flow steps
  if (userStates[chatId] === 'AWAITING_DEPOSIT_AMOUNT') {
    const amount = parseFloat(text);
    if (isNaN(amount) || amount <= 0) {
      return bot.sendMessage(chatId, "❌ Invalid amount. Please enter a valid number (e.g., 100):");
    }
    userStates[chatId] = { step: 'AWAITING_PROOF', amount: amount };
    return bot.sendMessage(chatId, `💵 Deposit Amount: ${amount} ETB\n\nPlease send your transaction ID or a screenshot of your payment receipt:`);
  }

  if (userStates[chatId] && userStates[chatId].step === 'AWAITING_PROOF') {
    const depositAmount = userStates[chatId].amount;
    delete userStates[chatId];

    // Notify user
    bot.sendMessage(chatId, "✅ Your deposit receipt has been submitted for review! You will be notified once approved.", mainKeyboard);

    // Notify Admin
    const adminMsg = `🚨 *New Deposit Request*\n\n` +
      `👤 User: ${msg.from.first_name} (@${msg.from.username || 'N/A'})\n` +
      `🆔 User ID: \`${chatId}\`\n` +
      `💵 Amount: *${depositAmount} ETB*\n` +
      `📄 Ref/Details: ${text || 'Photo Receipt Submitted'}`;

    const approveOptions = {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [
            { text: "✅ Approve", callback_data: `approve_${chatId}_${depositAmount}` },
            { text: "❌ Reject", callback_data: `reject_${chatId}` }
          ]
        ]
      }
    };

    if (msg.photo) {
      const photoId = msg.photo[msg.photo.length - 1].file_id;
      return bot.sendPhoto(ADMIN_CHAT_ID, photoId, { caption: adminMsg, ...approveOptions });
    } else {
      return bot.sendMessage(ADMIN_CHAT_ID, adminMsg, approveOptions);
    }
  }

  // Handle main keyboard options
  switch (text) {
    case "Deposit 💵":
      userStates[chatId] = 'AWAITING_DEPOSIT_AMOUNT';
      bot.sendMessage(chatId, "💳 Enter the amount you wish to deposit (in ETB):");
      break;

    case "Check Balance 💰":
      const balance = userBalances[chatId] || 0;
      bot.sendMessage(chatId, `💰 Your current balance is: *${balance} ETB*`, { parse_mode: 'Markdown' });
      break;

    case "Register 📝":
      bot.sendMessage(chatId, "✅ You are already registered and ready to play!");
      break;

    case "Contact Support 📞":
      bot.sendMessage(chatId, "📞 For support, please contact @AddisBingoSupport");
      break;

    case "Instruction 📖":
      bot.sendMessage(chatId, "📖 Select a game (Bingo or Spin) from the menu, deposit funds, and start playing instantly!");
      break;

    case "Invite ✉️":
      bot.sendMessage(chatId, `✉️ Invite your friends using your link:\nhttps://t.me/Adissbingoobot?start=${chatId}`);
      break;

    case "Play Bingo 🎰":
    case "Play Spin 🎰":
      bot.sendMessage(chatId, "🎰 Launching game session...");
      break;

    default:
      bot.sendMessage(chatId, "Please select an option from the menu below:", mainKeyboard);
      break;
  }
});

// Admin callback query handler (Approve / Reject)
bot.on('callback_query', (query) => {
  const data = query.data;
  const queryId = query.id;

  if (data.startsWith('approve_')) {
    const [, targetUserId, amountStr] = data.split('_');
    const amount = parseFloat(amountStr);

    userBalances[targetUserId] = (userBalances[targetUserId] || 0) + amount;

    bot.answerCallbackQuery(queryId, { text: "Deposit Approved!" });
    bot.sendMessage(ADMIN_CHAT_ID, `✅ Approved ${amount} ETB deposit for user ${targetUserId}`);
    bot.sendMessage(targetUserId, `🎉 Your deposit of *${amount} ETB* has been approved!\n💰 New Balance: *${userBalances[targetUserId]} ETB*`, { parse_mode: 'Markdown' });
  } else if (data.startsWith('reject_')) {
    const [, targetUserId] = data.split('_');

    bot.answerCallbackQuery(queryId, { text: "Deposit Rejected!" });
    bot.sendMessage(ADMIN_CHAT_ID, `❌ Rejected deposit for user ${targetUserId}`);
    bot.sendMessage(targetUserId, "❌ Your deposit request was rejected. Please contact support if you think this is an error.");
  }
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

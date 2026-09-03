const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const TelegramBot = require('node-telegram-bot-api');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

const token = process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN || "8784582049:AAEBE7wiZ1ifz2cfbaULSvDaOg_uOm3z0a0";
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID || "7936173420";

const bot = new TelegramBot(token, {
  polling: {
    autoStart: true,
    params: { timeout: 10 }
  }
});

bot.on('polling_error', (error) => {
  if (error.code === 'ETELEGRAM' && error.message.includes('409 Conflict')) {
    return;
  }
  console.error('Polling error:', error);
});

app.use(express.static('.'));
app.use(express.json());

const userStates = {};
const userBalances = {};
const processedTransactions = new Set();

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

bot.on('message', (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text ? msg.text.trim() : '';

  if (text.startsWith('/')) return;

  if (userStates[chatId] === 'AWAITING_DEPOSIT_AMOUNT') {
    const amount = parseFloat(text);
    if (isNaN(amount) || amount <= 0) {
      return bot.sendMessage(chatId, "❌ Invalid amount. Please enter a valid number (e.g., 100):");
    }
    userStates[chatId] = { step: 'AWAITING_PROOF', amount: amount };
    return bot.sendMessage(chatId, `💵 Deposit Amount: *${amount} ETB*\n\nPlease send your Telebirr Transaction ID (e.g. \`DI38EQPZ4Y\`) or a screenshot of your receipt:`, { parse_mode: 'Markdown' });
  }

  if ((userStates[chatId] && userStates[chatId].step === 'AWAITING_PROOF') || (msg.photo && userStates[chatId])) {
    const depositAmount = userStates[chatId].amount || "Unspecified";
    const txId = text.toUpperCase();

    if (txId && processedTransactions.has(txId)) {
      return bot.sendMessage(chatId, "⚠️ This Telebirr Transaction ID has already been submitted and processed!");
    }

    if (txId && txId.length >= 6) {
      processedTransactions.add(txId);
    }

    delete userStates[chatId];

    bot.sendMessage(chatId, "⏳ Your Telebirr transaction verification request has been sent to Admin! You will be notified instantly once approved.", mainKeyboard);

    const adminMsg = `🚨 *NEW TELEBIRR DEPOSIT REQUEST*\n\n` +
      `👤 *User:* ${msg.from.first_name} (@${msg.from.username || 'N/A'})\n` +
      `🆔 *User ID:* \`${chatId}\`\n` +
      `💵 *Amount Requested:* *${depositAmount} ETB*\n` +
      `📄 *Tx ID / Details:* \`${text || 'Screenshot Attached'}\``;

    const adminButtons = {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [
            { text: "✅ Approve Deposit", callback_data: `approve_${chatId}_${depositAmount}_${txId || 'NONE'}` },
            { text: "❌ Reject", callback_data: `reject_${chatId}` }
          ]
        ]
      }
    };

    if (msg.photo) {
      const photoId = msg.photo[msg.photo.length - 1].file_id;
      return bot.sendPhoto(ADMIN_CHAT_ID, photoId, { caption: adminMsg, ...adminButtons });
    } else {
      return bot.sendMessage(ADMIN_CHAT_ID, adminMsg, adminButtons);
    }
  }

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
      bot.sendMessage(chatId, "✅ You are registered and ready to play!");
      break;

    case "Contact Support 📞":
      bot.sendMessage(chatId, "📞 For support, contact @AddisBingoSupport");
      break;

    case "Instruction 📖":
      bot.sendMessage(chatId, "📖 Select Bingo or Spin, deposit funds via Telebirr, and start playing!");
      break;

    case "Invite ✉️":
      bot.sendMessage(chatId, `✉️ Referral link:\nhttps://t.me/Adissbingoobot?start=${chatId}`);
      break;

        case "Play Bingo 🎰":
      bot.sendMessage(chatId, "🎰 Click below to launch Addis Bingo:", {
        reply_markup: {
          inline_keyboard: [
            [{ text: "🎰 Play Bingo", web_app: { url: "https://addis-bingo-bot-v2.onrender.com" } }]
          ]
        }
      });
      break;

    case "Play Spin 🎰":
      bot.sendMessage(chatId, "🎰 Click below to launch Addis Spin:", {
        reply_markup: {
          inline_keyboard: [
            [{ text: "🎰 Play Spin", web_app: { url: "https://addis-bingo-bot-v2.onrender.com" } }]
          ]
        }
      });
      break;

      bot.sendMessage(chatId, "🎰 Launching game session...");
      break;

    default:
      if (userStates[chatId]) return;
      bot.sendMessage(chatId, "Please select an option from the menu below:", mainKeyboard);
      break;
  }
});

bot.on('callback_query', (query) => {
  const data = query.data;
  const queryId = query.id;
  const fromAdminId = query.from.id.toString();

  if (fromAdminId !== ADMIN_CHAT_ID) {
    return bot.answerCallbackQuery(queryId, { text: "🚫 Unauthorized! Only the main Admin can approve transactions.", show_alert: true });
  }

  if (data.startsWith('approve_')) {
    const [, targetUserId, amountStr, txId] = data.split('_');
    const amount = parseFloat(amountStr) || 0;

    userBalances[targetUserId] = (userBalances[targetUserId] || 0) + amount;

    bot.answerCallbackQuery(queryId, { text: "Deposit Approved!" });
    bot.editMessageText(`✅ *APPROVED*\nAmount: ${amount} ETB added to User ID \`${targetUserId}\` (Tx: ${txId})`, {
      chat_id: ADMIN_CHAT_ID,
      message_id: query.message.message_id,
      parse_mode: 'Markdown'
    });

    bot.sendMessage(targetUserId, `🎉 *Deposit Approved!*\n\n💰 *${amount} ETB* has been added to your balance.\nNew Balance: *${userBalances[targetUserId]} ETB*`, { parse_mode: 'Markdown' });
  } else if (data.startsWith('reject_')) {
    const [, targetUserId] = data.split('_');

    bot.answerCallbackQuery(queryId, { text: "Deposit Rejected!" });
    bot.editMessageText(`❌ *REJECTED*\nDeposit request for User ID \`${targetUserId}\` was declined.`, {
      chat_id: ADMIN_CHAT_ID,
      message_id: query.message.message_id,
      parse_mode: 'Markdown'
    });

    bot.sendMessage(targetUserId, "❌ Your deposit request was rejected. If you believe this is an error, please reach out to Support.");
  }
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

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
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID || "461465625";

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

// In-memory data store
const userStates = {};
const userBalances = {};
const processedTransactions = new Set();
const processedCallbacks = new Set(); // Prevents duplicate clicks on the same button

const mainKeyboard = {
  reply_markup: {
    keyboard: [
      [{ text: "Play Bingo 🎰" }, { text: "Play Spin 🎰" }],
      [{ text: "Register 📝" }, { text: "Deposit 💵" }, { text: "Withdraw 🏧" }],
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

  delete userStates[chatId];

  const welcomeMessage = `👋 Welcome to Addis Bingo, ${firstName}!\n\n` +
    `💰 Current Balance: ${userBalances[chatId]} ETB\n\n` +
    `Choose an option below to get started:`;

  bot.sendMessage(chatId, welcomeMessage, mainKeyboard);
});

bot.on('message', (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text ? msg.text.trim() : '';

  if (text.startsWith('/')) return;

  // DEPOSIT FLOW: Step 1 - Amount
  if (userStates[chatId] === 'AWAITING_DEPOSIT_AMOUNT') {
    const amount = parseFloat(text);
    if (isNaN(amount) || amount <= 0) {
      return bot.sendMessage(chatId, "❌ Invalid amount. Please enter a valid number (e.g., 100):");
    }
    userStates[chatId] = { step: 'AWAITING_PROOF', amount: amount };
    return bot.sendMessage(chatId, `💵 Deposit Amount: *${amount} ETB*\n\nPlease send a valid 10-character Telebirr Transaction ID (e.g., \`DI38EQPZ4Y\`) or a screenshot of your payment receipt:`, { parse_mode: 'Markdown' });
  }

  // DEPOSIT FLOW: Step 2 - Proof Verification
  if (userStates[chatId] && userStates[chatId].step === 'AWAITING_PROOF') {
    const depositAmount = userStates[chatId].amount;

    // Handle Photo Receipts
    if (msg.photo) {
      delete userStates[chatId]; // Instantly clear state

      const reqId = Date.now(); // Unique request ID
      bot.sendMessage(chatId, "⏳ Your Telebirr screenshot receipt has been submitted to Admin for verification!", mainKeyboard);

      const photoId = msg.photo[msg.photo.length - 1].file_id;
      const adminMsg = `🚨 *NEW DEPOSIT RECEIPT SCREENSHOT*\n\n` +
        `👤 *User:* ${msg.from.first_name} (@${msg.from.username || 'N/A'})\n` +
        `🆔 *User ID:* \`${chatId}\`\n` +
        `💵 *Amount:* *${depositAmount} ETB*`;

      const adminButtons = {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [
              { text: "✅ Approve Deposit", callback_data: `approve_${chatId}_${depositAmount}_PHOTO_${reqId}` },
              { text: "❌ Reject", callback_data: `reject_${chatId}_${reqId}` }
            ]
          ]
        }
      };

      return bot.sendPhoto(ADMIN_CHAT_ID, photoId, { caption: adminMsg, ...adminButtons });
    }

    // Handle Text Transaction IDs
    const txId = text.toUpperCase();
    const telebirrRegex = /^[A-Z0-9]{9,12}$/;

    if (!telebirrRegex.test(txId)) {
      return bot.sendMessage(chatId, "❌ *Invalid Transaction ID format!*\n\nTelebirr Transaction IDs must be alphanumeric (e.g., `DI38EQPZ4Y`). Please enter a valid ID or send a photo receipt:", { parse_mode: 'Markdown' });
    }

    if (processedTransactions.has(txId)) {
      return bot.sendMessage(chatId, "⚠️ *This Telebirr Transaction ID has already been submitted!*", { parse_mode: 'Markdown' });
    }

    processedTransactions.add(txId);
    delete userStates[chatId]; // Instantly clear state

    const reqId = Date.now();
    bot.sendMessage(chatId, "⏳ Your Telebirr deposit verification request has been sent to Admin!", mainKeyboard);

    const adminMsg = `🚨 *NEW TELEBIRR DEPOSIT REQUEST*\n\n` +
      `👤 *User:* ${msg.from.first_name} (@${msg.from.username || 'N/A'})\n` +
      `🆔 *User ID:* \`${chatId}\`\n` +
      `💵 *Amount:* *${depositAmount} ETB*\n` +
      `📄 *Tx ID:* \`${txId}\``;

    const adminButtons = {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [
            { text: "✅ Approve Deposit", callback_data: `approve_${chatId}_${depositAmount}_${txId}_${reqId}` },
            { text: "❌ Reject", callback_data: `reject_${chatId}_${reqId}` }
          ]
        ]
      }
    };

    return bot.sendMessage(ADMIN_CHAT_ID, adminMsg, adminButtons);
  }

  // WITHDRAWAL FLOW
  if (userStates[chatId] === 'AWAITING_WITHDRAW_AMOUNT') {
    const amount = parseFloat(text);
    const currentBalance = userBalances[chatId] || 0;

    if (isNaN(amount) || amount <= 0) {
      return bot.sendMessage(chatId, "❌ Invalid amount. Please enter a valid number (e.g., 100):");
    }

    if (amount > currentBalance) {
      return bot.sendMessage(chatId, `❌ Insufficient balance! Your balance is *${currentBalance} ETB*. Enter a smaller amount:`, { parse_mode: 'Markdown' });
    }

    userStates[chatId] = { step: 'AWAITING_WITHDRAW_PHONE', amount: amount };
    return bot.sendMessage(chatId, `🏧 Withdrawal Amount: *${amount} ETB*\n\nPlease enter your Telebirr Phone Number (e.g., \`0912345678\`):`, { parse_mode: 'Markdown' });
  }

  if (userStates[chatId] && userStates[chatId].step === 'AWAITING_WITHDRAW_PHONE') {
    const phoneRegex = /^(09|07|\+2519|\+2517)[0-9]{8}$/;
    if (!phoneRegex.test(text.replace(/\s+/g, ''))) {
      return bot.sendMessage(chatId, "❌ *Invalid Ethiopian phone number!* Please enter a valid number (e.g., `0912345678`):", { parse_mode: 'Markdown' });
    }

    const withdrawAmount = userStates[chatId].amount;
    const phone = text;
    delete userStates[chatId];

    const reqId = Date.now();
    bot.sendMessage(chatId, `⏳ Your withdrawal request of *${withdrawAmount} ETB* to *${phone}* has been sent to Admin.`, { parse_mode: 'Markdown', ...mainKeyboard });

    const adminMsg = `🏧 *NEW WITHDRAWAL REQUEST*\n\n` +
      `👤 *User:* ${msg.from.first_name} (@${msg.from.username || 'N/A'})\n` +
      `🆔 *User ID:* \`${chatId}\`\n` +
      `💵 *Amount:* *${withdrawAmount} ETB*\n` +
      `📱 *Telebirr Phone:* \`${phone}\`\n` +
      `💰 *User Current Balance:* ${userBalances[chatId] || 0} ETB`;

    const adminButtons = {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [
            { text: "✅ Confirm Paid & Deduct", callback_data: `wdapprove_${chatId}_${withdrawAmount}_${reqId}` },
            { text: "❌ Reject", callback_data: `wdreject_${chatId}_${reqId}` }
          ]
        ]
      }
    };

    return bot.sendMessage(ADMIN_CHAT_ID, adminMsg, adminButtons);
  }

  // Navigation Menu
  switch (text) {
    case "Deposit 💵":
      userStates[chatId] = 'AWAITING_DEPOSIT_AMOUNT';
      bot.sendMessage(chatId, "💳 Enter the amount you wish to deposit (in ETB):");
      break;

    case "Withdraw 🏧":
      const balance = userBalances[chatId] || 0;
      if (balance <= 0) {
        return bot.sendMessage(chatId, "❌ You have 0 ETB balance. Deposit or play to earn funds before withdrawing!");
      }
      userStates[chatId] = 'AWAITING_WITHDRAW_AMOUNT';
      bot.sendMessage(chatId, `💰 Available Balance: *${balance} ETB*\n\nEnter withdrawal amount (in ETB):`, { parse_mode: 'Markdown' });
      break;

    case "Check Balance 💰":
      const currentBal = userBalances[chatId] || 0;
      bot.sendMessage(chatId, `💰 Your current balance is: *${currentBal} ETB*`, { parse_mode: 'Markdown' });
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

    default:
      if (userStates[chatId]) return;
      bot.sendMessage(chatId, "Please select an option from the menu below:", mainKeyboard);
      break;
  }
});

// Admin Callback Handlers
bot.on('callback_query', (query) => {
  const data = query.data;
  const queryId = query.id;
  const fromAdminId = query.from.id.toString();

  if (fromAdminId !== ADMIN_CHAT_ID) {
    return bot.answerCallbackQuery(queryId, { text: "🚫 Unauthorized!", show_alert: true });
  }

  // Lock duplicate callback executions
  if (processedCallbacks.has(data)) {
    return bot.answerCallbackQuery(queryId, { text: "⚠️ This request has already been processed!", show_alert: true });
  }

  if (data.startsWith('approve_')) {
    processedCallbacks.add(data);
    const [, targetUserId, amountStr, txId] = data.split('_');
    const amount = parseFloat(amountStr) || 0;

    userBalances[targetUserId] = (userBalances[targetUserId] || 0) + amount;

    bot.answerCallbackQuery(queryId, { text: "Deposit Approved!" });
    bot.editMessageText(`✅ *APPROVED DEPOSIT*\nAmount: ${amount} ETB added to User ID \`${targetUserId}\` (Tx: ${txId})`, {
      chat_id: ADMIN_CHAT_ID,
      message_id: query.message.message_id,
      parse_mode: 'Markdown'
    });

    bot.sendMessage(targetUserId, `🎉 *Deposit Approved!*\n\n💰 *${amount} ETB* has been added to your balance.\nNew Balance: *${userBalances[targetUserId]} ETB*`, { parse_mode: 'Markdown' });
  } else if (data.startsWith('reject_')) {
    processedCallbacks.add(data);
    const [, targetUserId] = data.split('_');

    bot.answerCallbackQuery(queryId, { text: "Deposit Rejected!" });
    bot.editMessageText(`❌ *REJECTED DEPOSIT*\nDeposit request for User ID \`${targetUserId}\` was declined.`, {
      chat_id: ADMIN_CHAT_ID,
      message_id: query.message.message_id,
      parse_mode: 'Markdown'
    });

    bot.sendMessage(targetUserId, "❌ Your deposit request was rejected.");
  } else if (data.startsWith('wdapprove_')) {
    processedCallbacks.add(data);
    const [, targetUserId, amountStr] = data.split('_');
    const amount = parseFloat(amountStr) || 0;

    userBalances[targetUserId] = (userBalances[targetUserId] || 0) - amount;

    bot.answerCallbackQuery(queryId, { text: "Withdrawal Approved!" });
    bot.editMessageText(`✅ *WITHDRAWAL COMPLETED*\nAmount: ${amount} ETB deducted from User ID \`${targetUserId}\`.`, {
      chat_id: ADMIN_CHAT_ID,
      message_id: query.message.message_id,
      parse_mode: 'Markdown'
    });

    bot.sendMessage(targetUserId, `✅ *Withdrawal Successful!*\n\n💸 *${amount} ETB* sent to your Telebirr account.\nRemaining Balance: *${userBalances[targetUserId]} ETB*`, { parse_mode: 'Markdown' });
  } else if (data.startsWith('wdreject_')) {
    processedCallbacks.add(data);
    const [, targetUserId] = data.split('_');

    bot.answerCallbackQuery(queryId, { text: "Withdrawal Rejected!" });
    bot.editMessageText(`❌ *WITHDRAWAL REJECTED*\nWithdrawal request for User ID \`${targetUserId}\` was declined.`, {
      chat_id: ADMIN_CHAT_ID,
      message_id: query.message.message_id,
      parse_mode: 'Markdown'
    });

    bot.sendMessage(targetUserId, "❌ Your withdrawal request was declined.");
  }
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

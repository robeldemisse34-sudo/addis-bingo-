const http = require('http');
const PORT = process.env.PORT || 3000;

http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Addis Bingo Bot is active!\n');
}).listen(PORT, () => {
  console.log(`HTTP server listening on port ${PORT}`);
});

const TelegramBot = require('node-telegram-bot-api');

const TOKEN = process.env.BOT_TOKEN || '8784582049:AAGWUEzt7q70yRm2BgldnNiBTRmfz6Anhys';
const bot = new TelegramBot(TOKEN, { polling: true });

const BINGO_APP_URL = 'https://addis-bingo-green.vercel.app/';
const photoUrl = 'https://raw.githubusercontent.com/robeldemisse34-sudo/addis-bingo-/main/IMG_20260901_224307_224.jpg';

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;

  bot.sendPhoto(chatId, photoUrl, {
    caption: "Welcome to Addis Bingo! Choose an option below:",
    reply_markup: {
      inline_keyboard: [
        [
          { text: "Play Bingo 🎮", web_app: { url: BINGO_APP_URL } },
          { text: "Play Spin 🎰", web_app: { url: BINGO_APP_URL } }
        ],
        [
          { text: "Register 📝", callback_data: "action_register" },
          { text: "Deposit 💵", callback_data: "action_deposit" }
        ],
        [
          { text: "Check Balance 💰", callback_data: "action_balance" },
          { text: "Contact Support 📞", url: "https://t.me/your_support_username" }
        ]
      ]
    }
  });
});
    bot.sendMessage(chatId, "Your current balance is: 100.00 ETB");
  }

  bot.answerCallbackQuery(query.id);
});

console.log("Addis Bingo Bot is running...");
// 2. /playbingo Command
bot.onText(/\/playbingo/, (msg) => {
  bot.sendMessage(msg.chat.id, "Click below to open the Bingo Arena:", {
    reply_markup: {
      inline_keyboard: [
        [{ text: "Launch Bingo Game 🎰", web_app: { url: BINGO_APP_URL } }]
      ]
    }
  });
});

// 3. /balance Command
bot.onText(/\/balance/, (msg) => {
  bot.sendMessage(msg.chat.id, "💰 *Account Balance*\n\nMain Wallet: *0.00 ETB*\nBonus Wallet: *0.00 ETB*", { parse_mode: 'Markdown' });
});

// 4. /deposit Command
bot.onText(/\/deposit/, (msg) => {
  bot.sendMessage(msg.chat.id, "💳 *Deposit Funds*\n\n1. Send Telebirr P2P to Agent: `0912345678`\n2. Enter your 127 SMS Txn ID in the Mini App to verify.", { parse_mode: 'Markdown' });
});

// 5. /withdraw Command
bot.onText(/\/withdraw/, (msg) => {
  bot.sendMessage(msg.chat.id, "🏦 *Withdraw Funds*\n\nPlease open the Bingo Mini App and submit your withdrawal request directly from your wallet menu.");
});

// 6. /instruction Command
bot.onText(/\/instruction/, (msg) => {
  bot.sendMessage(msg.chat.id, "📖 *How to Play*\n\n1. Select your card (Card #001 to #100).\n2. Lock in your card with your balance.\n3. Complete 5 numbers in a line to hit BINGO!", { parse_mode: 'Markdown' });
});

// 7. /support Command
bot.onText(/\/support/, (msg) => {
  bot.sendMessage(msg.chat.id, "📞 Contact support directly at: @your_support_username");
});

// Handle Inline Buttons (Callback Queries)
bot.on('callback_query', (query) => {
  const chatId = query.message.chat.id;
  const action = query.data;

  if (action === 'action_deposit') {
    bot.sendMessage(chatId, "💳 *Deposit Funds*\n\nSend Telebirr P2P to Agent: `0912345678` and submit your 127 SMS Txn ID.", { parse_mode: 'Markdown' });
  } else if (action === 'action_balance') {
    bot.sendMessage(chatId, "💰 *Your Balance:* 0.00 ETB", { parse_mode: 'Markdown' });
  } else if (action === 'action_instructions') {
    bot.sendMessage(chatId, "📖 *Rules:* Pick a card (1-100), lock it in, and match drawn numbers to win.");
  } else if (action === 'action_register') {
    bot.sendMessage(chatId, "📝 Your phone number is automatically registered with your Telegram account.");
  }

  bot.answerCallbackQuery(query.id);
});

console.log("Addis Bingo Bot is running...");

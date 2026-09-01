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

// 1. /start Command with Image and Full Buttons
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
        ],
        [
          { text: "Instruction 📖", callback_data: "action_instruction" },
          { text: "Invite ✉️", callback_data: "action_invite" }
        ]
      ]
    }
  });
});

// 2. Callback Listener to respond when non-link buttons are clicked
bot.on('callback_query', (query) => {
  const chatId = query.message.chat.id;
  const data = query.data;

  // Acknowledge click to stop loading animation
  bot.answerCallbackQuery(query.id);

  if (data === 'action_register') {
    bot.sendMessage(chatId, "📝 Please use the Mini App to complete your registration.");
  } else if (data === 'action_deposit') {
    bot.sendMessage(chatId, "💵 Deposit options will be processed inside the Mini App.");
  } else if (data === 'action_balance') {
    bot.sendMessage(chatId, "💰 Your current balance is: 0.00 ETB");
  } else if (data === 'action_instruction') {
    bot.sendMessage(chatId, "📖 *Instructions*:\n1. Tap 'Play Bingo' to launch the game.\n2. Select your card and start playing!", { parse_mode: 'Markdown' });
  } else if (data === 'action_invite') {
    bot.sendMessage(chatId, `✉️ Share this bot link with friends:\nhttps://t.me/Adissbingoobot`);
  }
});

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

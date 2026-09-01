const TelegramBot = require('node-telegram-bot-api');
const token = process.env.TELEGRAM_BOT_TOKEN || "8784582049:AAGWUEzt7q70yRm2BgldnNiBTRmfz6Anhys";
const bot = new TelegramBot(token, { polling: true });

const users = {};

bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    
    // Send your welcome image and exact original button grid
    bot.sendPhoto(chatId, "YOUR_IMAGE_URL_OR_FILE_ID", {
        caption: "Welcome to Addis Bingo! Choose an option below:",
        reply_markup: {
            keyboard: [
                [{ text: "Play Bingo 🎮", web_app: { url: "https://addis-bingo-green.vercel.app" } }, { text: "Play Spin 🎰" }],
                [{ text: "Register 📝" }, { text: "Deposit 💵" }],
                [{ text: "Check Balance 💰" }, { text: "Contact Support 📞" }],
                [{ text: "Instruction 📖" }, { text: "Invite ✉️" }]
            ],
            resize_keyboard: true
        }
    });
});

// Handle text buttons matching your exact layout
bot.on('message', (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;

    if (text === "Deposit 💵" || text === "💰 Deposit") {
        bot.sendMessage(chatId, 
            "💰 *Telebirr Deposit Instructions*\n\n" +
            "Transfer funds via Telebirr to:\n" +
            "📱 *Number:* `0900071279`\n" +
            "👤 *Account Name:* robel\n\n" +
            "Your balance will be updated after verification.", { parse_mode: "Markdown" });
    } else if (text === "Check Balance 💰" || text === "📊 Check Balance") {
        const bal = users[chatId]?.balance || 0.38;
        bot.sendMessage(chatId, `📊 Your current wallet balance is: ${bal.toFixed(2)}`);
    } else if (text === "Register 📝") {
        bot.sendMessage(chatId, "Please use the /register command or share your contact number to register.");
    }
});

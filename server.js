const TelegramBot = require('node-telegram-bot-api');
const token = process.env.TELEGRAM_BOT_TOKEN || "8784582049:AAGWUEzt7q70yRm2BgldnNiBTRmfz6Anhys";
const bot = new TelegramBot(token, { polling: true });

const users = {};

bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, "Welcome to Addis Bingo! 🎲 Choose an option below:", {
        reply_markup: {
            keyboard: [
                [{ text: "🎮 Play Bingo", web_app: { url: "https://addis-bingo-green.vercel.app" } }],
                [{ text: "💰 Deposit" }, { text: "🏦 Withdraw" }],
                [{ text: "📊 Check Balance" }, { text: "📝 Register" }]
            ],
            resize_keyboard: true
        }
    });
});

bot.onText(/\/register/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, "Click the button below to share your contact number for registration:", {
        reply_markup: {
            keyboard: [[{ text: "📱 Share Phone Number", request_contact: true }]],
            one_time_keyboard: true,
            resize_keyboard: true
        }
    });
});

bot.on('contact', (msg) => {
    const chatId = msg.chat.id;
    const phone = msg.contact.phone_number;
    users[chatId] = { phone: phone, balance: 0.38 };
    bot.sendMessage(chatId, `✅ Thank you! Your phone number (${phone}) has been registered successfully.`);
});

bot.onText(/\/deposit/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, 
        "💰 *Telebirr Deposit Instructions*\n\n" +
        "Transfer funds via Telebirr to:\n" +
        "📱 *Number:* `0900071279`\n" +
        "👤 *Account Name:* robel\n\n" +
        "Your balance will be updated after verification.", { parse_mode: "Markdown" });
});

bot.onText(/\/withdraw/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, 
        "🏦 *Withdrawal Request*\n\n" +
        "To withdraw your funds, please open the Mini App or contact support with your registered phone number.");
});

bot.onText(/\/balance/, (msg) => {
    const chatId = msg.chat.id;
    const bal = users[chatId]?.balance || 0.38;
    bot.sendMessage(chatId, `📊 Your current wallet balance is: ${bal.toFixed(2)}`);
});

bot.on('message', (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;

    if (text === "💰 Deposit") {
        bot.sendMessage(chatId, 
            "💰 *Telebirr Deposit*\n\n" +
            "Transfer via Telebirr to:\n" +
            "📱 *Number:* `0900071279`\n" +
            "👤 *Account Name:* robel", { parse_mode: "Markdown" });
    } else if (text === "🏦 Withdraw") {
        bot.sendMessage(chatId, "🏦 To withdraw funds, please submit your request through support.");
    } else if (text === "📊 Check Balance") {
        const bal = users[chatId]?.balance || 0.38;
        bot.sendMessage(chatId, `📊 Your current wallet balance is: ${bal.toFixed(2)}`);
    } else if (text === "📝 Register") {
        bot.sendMessage(chatId, "Please use the /register command to share your phone number.");
    }
});

// --- ADMIN CONFIGURATION ---
const ADMIN_CHAT_ID = 123456789; // Replace with your numeric Telegram User ID from @userinfobot

// Local storage for pending deposit sessions and submitted requests
const userDepositState = {};
const pendingDeposits = {};

// Helper to clear user deposit steps
function resetDepositState(chatId) {
    delete userDepositState[chatId];
}

bot.on('message', (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text ? msg.text.trim() : "";

    if (!text || text.startsWith('/')) return;

    // STEP 1: User clicks "Deposit 💵" -> Bot asks for Amount
    if (text.includes("Deposit")) {
        userDepositState[chatId] = { step: 'AWAITING_AMOUNT' };
        
        return bot.sendMessage(chatId, 
            "💵 *Enter Deposit Amount*\n\n" +
            "Please reply with the amount you wish to deposit in ETB (e.g., `50`, `100`, `500`):", 
            { parse_mode: "Markdown" }
        );
    }

    // STEP 2: User sends Amount -> Bot shows Telebirr Info & asks for Txn ID
    if (userDepositState[chatId]?.step === 'AWAITING_AMOUNT') {
        const amount = parseFloat(text);

        if (isNaN(amount) || amount <= 0) {
            return bot.sendMessage(chatId, "❌ Invalid amount. Please enter a valid number (e.g., `100`):");
        }

        userDepositState[chatId] = {
            step: 'AWAITING_TXN_ID',
            amount: amount
        };

        return bot.sendMessage(chatId, 
            `💰 *Telebirr Deposit Details*\n\n` +
            `Requested Amount: *${amount.toFixed(2)} ETB*\n\n` +
            `Please transfer *${amount.toFixed(2)} ETB* via Telebirr to:\n` +
            `📱 *Number:* \`0900071279\`\n` +
            `👤 *Account Name:* robel\n\n` +
            `👇 *After sending the money, reply here with your Telebirr Transaction ID (or send a screenshot):*`, 
            { parse_mode: "Markdown" }
        );
    }

    // STEP 3: User sends Transaction ID -> Bot notifies Admin
    if (userDepositState[chatId]?.step === 'AWAITING_TXN_ID') {
        const amount = userDepositState[chatId].amount;
        const depositId = `DEP-${Date.now()}`;

        pendingDeposits[depositId] = {
            userId: chatId,
            amount: amount,
            txnId: text,
            userName: msg.from.first_name || "User"
        };

        resetDepositState(chatId);

        // Confirmation to User
        bot.sendMessage(chatId, 
            `⏳ *Deposit Request Received!*\n\n` +
            `Amount: *${amount.toFixed(2)} ETB*\n` +
            `Transaction ID: \`${text}\`\n\n` +
            `Your payment is being verified by admin. You will be notified shortly.`, 
            { parse_mode: "Markdown" }
        );

        // Alert to Admin with dynamic Approve/Reject buttons
        return bot.sendMessage(ADMIN_CHAT_ID, 
            `📥 *New Deposit Verification Request*\n\n` +
            `👤 *User:* ${msg.from.first_name} (@${msg.from.username || 'N/A'})\n` +
            `🆔 *User ID:* \`${chatId}\`\n` +
            `💰 *Expected Amount:* *${amount.toFixed(2)} ETB*\n` +
            `📄 *Submitted Txn ID:* \`${text}\`\n` +
            `🔖 *Ref Code:* \`${depositId}\``, 
            {
                parse_mode: "Markdown",
                reply_markup: {
                    inline_keyboard: [
                        [
                            { text: `✅ Approve ${amount.toFixed(2)} ETB`, callback_data: `approve_${depositId}` },
                            { text: "❌ Reject", callback_data: `reject_${depositId}` }
                        ]
                    ]
                }
            }
        );
    }
});

// Support screenshot submissions for Step 3
bot.on('photo', (msg) => {
    const chatId = msg.chat.id;

    if (userDepositState[chatId]?.step === 'AWAITING_TXN_ID') {
        const amount = userDepositState[chatId].amount;
        const depositId = `DEP-${Date.now()}`;
        const photoId = msg.photo[msg.photo.length - 1].file_id;

        pendingDeposits[depositId] = {
            userId: chatId,
            amount: amount,
            txnId: "Screenshot attached",
            userName: msg.from.first_name || "User"
        };

        resetDepositState(chatId);

        bot.sendMessage(chatId, "⏳ *Screenshot Received!* Your deposit is under review.", { parse_mode: "Markdown" });

        bot.sendPhoto(ADMIN_CHAT_ID, photoId, {
            caption: `📥 *New Screenshot Deposit Request*\n\n` +
                     `👤 *User:* ${msg.from.first_name}\n` +
                     `🆔 *User ID:* \`${chatId}\`\n` +
                     `💰 *Expected Amount:* *${amount.toFixed(2)} ETB*\n` +
                     `🔖 *Ref Code:* \`${depositId}\``,
            parse_mode: "Markdown",
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: `✅ Approve ${amount.toFixed(2)} ETB`, callback_data: `approve_${depositId}` },
                        { text: "❌ Reject", callback_data: `reject_${depositId}` }
                    ]
                ]
            }
        });
    }
});

// --- ADMIN APPROVAL CALLBACK HANDLER ---
bot.on('callback_query', (query) => {
    const data = query.data;

    if (data.startsWith('approve_')) {
        const depositId = data.replace('approve_', '');
        const deposit = pendingDeposits[depositId];

        if (!deposit) {
            return bot.answerCallbackQuery(query.id, { text: "Request already processed or expired." });
        }

        const targetUserId = deposit.userId;
        const amount = deposit.amount;

        users[targetUserId] = users[targetUserId] || { balance: 0.00 };
        users[targetUserId].balance += amount;

        bot.sendMessage(ADMIN_CHAT_ID, `✅ *Approved!* Credited *${amount.toFixed(2)} ETB* to User \`${targetUserId}\`. New Balance: *${users[targetUserId].balance.toFixed(2)} ETB*`, { parse_mode: "Markdown" });
        bot.sendMessage(targetUserId, `🎉 *Deposit Approved!*\n\nYour account has been credited with *${amount.toFixed(2)} ETB*.\n💰 Current Balance: *${users[targetUserId].balance.toFixed(2)} ETB*`, { parse_mode: "Markdown" });

        delete pendingDeposits[depositId];
        bot.answerCallbackQuery(query.id, { text: "Deposit Approved!" });

    } else if (data.startsWith('reject_')) {
        const depositId = data.replace('reject_', '');
        const deposit = pendingDeposits[depositId];

        if (!deposit) {
            return bot.answerCallbackQuery(query.id, { text: "Request already processed or expired." });
        }

        const targetUserId = deposit.userId;

        bot.sendMessage(ADMIN_CHAT_ID, `❌ Rejected deposit request \`${depositId}\`.`, { parse_mode: "Markdown" });
        bot.sendMessage(targetUserId, `❌ *Deposit Rejected*\nWe could not verify your payment transaction ID. Please contact support if you need assistance.`, { parse_mode: "Markdown" });

        delete pendingDeposits[depositId];
        bot.answerCallbackQuery(query.id, { text: "Deposit Rejected" });
    }
});

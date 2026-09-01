// Game & Lobby Configuration
const MIN_REQUIRED_CARDS = 3;   // Minimum cards needed to trigger countdown
const MAX_TOTAL_CARDS = 100;    // Maximum capacity (1 card per grid slot)

let reservedCardsMap = {};      // Tracks which card IDs are booked: { cardId: userId }
let activeCardCount = 0;        // Total cards booked across all players
let countdownStarted = false;

// Updated Reserve Card Function
function reserveCard() {
    if (!selectedCardNumber) {
        alert("Please select a card from the grid first.");
        return;
    }

    if (reservedCardsMap[selectedCardNumber]) {
        alert(`Card #${selectedCardNumber} is already reserved by another player!`);
        return;
    }

    if (walletBalance < STAKE_AMOUNT) {
        alert("Insufficient balance. Minimum 10 ETB required.");
        openDepositModal();
        return;
    }

    if (!isReserved) {
        walletBalance -= STAKE_AMOUNT;
        isReserved = true;
        
        // Lock card in lobby map
        reservedCardsMap[selectedCardNumber] = "CURRENT_USER";
        activeCardCount++;

        updateWalletDisplay();

        // Mark reserved status on grid (Orange)
        const btn = document.getElementById(`card-btn-${selectedCardNumber}`);
        if (btn) {
            btn.style.backgroundColor = "#ff9800";
            btn.style.color = "#ffffff";
        }

        document.getElementById("startBtn").style.display = "none";
        document.getElementById("leaveBtn").style.display = "inline-block";

        updateLobbyUI();

        // Trigger 30s countdown only once when minimum threshold (3 cards) is reached
        if (activeCardCount >= MIN_REQUIRED_CARDS && !countdownStarted) {
            start30SecCountdown();
        }
    }
}

// Updated Leave & Refund Function
function leaveGame() {
    if (isReserved) {
        walletBalance += STAKE_AMOUNT;
        isReserved = false;

        delete reservedCardsMap[selectedCardNumber];
        activeCardCount = Math.max(0, activeCardCount - 1);

        updateWalletDisplay();

        // Reset Card Grid Button
        const btn = document.getElementById(`card-btn-${selectedCardNumber}`);
        if (btn) {
            btn.style.backgroundColor = "#e0e0e0";
            btn.style.color = "#000000";
        }

        document.getElementById("startBtn").style.display = "inline-block";
        document.getElementById("leaveBtn").style.display = "none";
        document.getElementById("bingoCallBtn").style.display = "none";

        updateLobbyUI();

        // Abort countdown if total reserved cards drop below 3 before game start
        if (activeCardCount < MIN_REQUIRED_CARDS && countdownStarted) {
            clearInterval(countdownTimer);
            countdownStarted = false;
            document.getElementById("timerDisplay").innerText = "Waiting for minimum 3 cards...";
        }
    }
}

// Updated Lobby Counter Display
function updateLobbyUI() {
    document.getElementById("playerCount").innerText = `Cards Booked: ${activeCardCount}/${MAX_TOTAL_CARDS} (Min: ${MIN_REQUIRED_CARDS})`;
}

// Updated 30-Second Countdown Engine
function start30SecCountdown() {
    countdownStarted = true;
    let timeLeft = 30;
    document.getElementById("timerDisplay").innerText = `Game starting in ${timeLeft}s (More players can still join!)`;

    countdownTimer = setInterval(() => {
        timeLeft--;
        document.getElementById("timerDisplay").innerText = `Game starting in ${timeLeft}s (${activeCardCount} Cards Booked)`;

        // If capacity hits 100, start immediately
        if (activeCardCount === MAX_TOTAL_CARDS) {
            clearInterval(countdownTimer);
            beginBingoGame();
            return;
        }

        if (timeLeft <= 0) {
            clearInterval(countdownTimer);
            beginBingoGame();
        }
    }, 1000);
}

// Dynamic Prize Pool Allocation on Win
function claimBingoWin() {
    let hasWinningLine = checkLines();

    if (hasWinningLine) {
        clearInterval(ballDrawInterval);
        
        // Total pot calculated dynamically based on total active cards booked
        const totalPrizePool = activeCardCount * STAKE_AMOUNT;
        walletBalance += totalPrizePool;
        
        alert(`🎉 BINGO VERIFIED! You won the entire pot of ${totalPrizePool.toFixed(2)} ETB!`);
        updateWalletDisplay();
        resetGameSession();
    } else {
        alert("❌ Invalid Bingo Call! Your card does not have a complete line with called numbers.");
    }
}

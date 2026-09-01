let selectedCharAt = 1;
const cardDataStore = {};

async function fetchUserWallet() {
    try {
        const telegramId = window.Telegram?.WebApp?.initDataUnsafe?.user?.id || "default_user";
        const response = await fetch(`/api/user?telegramId=${telegramId}`);
        const data = await response.json();
        if (data.balance !== undefined) {
            document.getElementById('walletBalance').innerText = data.balance.toFixed(2);
        }
    } catch (error) {
        console.error("Failed to load live wallet balance:", error);
    }
}

function generateCardSelector() {
    const grid = document.getElementById('cardSelectorGrid');
    grid.innerHTML = '';
    
    for (let i = 1; i <= 100; i++) {
        const cell = document.createElement('div');
        cell.classList.add('selector-cell');
        cell.innerText = i;
        if (i === selectedCharAt) cell.classList.add('selected');

        cell.addEventListener('click', () => {
            document.querySelectorAll('.selector-cell').forEach(c => c.classList.remove('selected'));
            cell.classList.add('selected');
            selectedCharAt = i;
            loadCardNumbers(i);
        });

        grid.appendChild(cell);
    }
    loadCardNumbers(selectedCharAt);
}

function getUniqueRandomNumbers(min, max, count) {
    let arr = [];
    while(arr.length < count) {
        let r = Math.floor(Math.random() * (max - min + 1)) + min;
        if(arr.indexOf(r) === -1) arr.push(r);
    }
    return arr;
}

function loadCardNumbers(cardId) {
    const cardContainer = document.getElementById('bingoCard');
    cardContainer.innerHTML = '';

    if (!cardDataStore[cardId]) {
        let colB = getUniqueRandomNumbers(1, 15, 5);
        let colI = getUniqueRandomNumbers(16, 30, 5);
        let colN = getUniqueRandomNumbers(31, 45, 4);
        let colG = getUniqueRandomNumbers(46, 60, 5);
        let colO = getUniqueRandomNumbers(61, 75, 5);

        colN.splice(2, 0, "FREE");

        let gridNumbers = [];
        for (let row = 0; row < 5; row++) {
            gridNumbers.push(colB[row]);
            gridNumbers.push(colI[row]);
            gridNumbers.push(colN[row]);
            gridNumbers.push(colG[row]);
            gridNumbers.push(colO[row]);
        }

        cardDataStore[cardId] = gridNumbers;
    }

    let currentCardNumbers = cardDataStore[cardId];

    currentCardNumbers.forEach((num, index) => {
        const cell = document.createElement('div');
        cell.classList.add('bingo-cell');
        cell.innerText = num;

        if (num === "FREE") {
            cell.classList.add('daubed');
        }

        cell.addEventListener('click', () => {
            if (num !== "FREE") {
                cell.classList.toggle('daubed');
            }
        });

        cardContainer.appendChild(cell);
    });
}

function randomizeSelectedCard() {
    delete cardDataStore[selectedCharAt];
    loadCardNumbers(selectedCharAt);
}

function startGame() {
    alert(`Game started with Card #${selectedCharAt}!`);
}

// Deposit Modal Functions
function openDepositModal() {
    document.getElementById('depositModal').style.display = 'flex';
}

function closeDepositModal() {
    document.getElementById('depositModal').style.display = 'none';
}

window.onload = () => {
    if (window.Telegram?.WebApp) {
        window.Telegram.WebApp.ready();
    }
    fetchUserWallet();
    generateCardSelector();
};

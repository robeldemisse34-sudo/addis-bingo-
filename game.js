let selectedCharAt = 1;
const cardDataStore = {};

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

function loadCardNumbers(cardId) {
    const cardContainer = document.getElementById('bingoCard');
    cardContainer.innerHTML = '';

    if (!cardDataStore[cardId]) {
        let numbers = [];
        while(numbers.length < 25) {
            let r = Math.floor(Math.random() * 75) + 1;
            if(numbers.indexOf(r) === -1) numbers.push(r);
        }
        cardDataStore[cardId] = numbers;
    }

    let currentCardNumbers = cardDataStore[cardId];

    currentCardNumbers.forEach((num, index) => {
        const cell = document.createElement('div');
        cell.classList.add('bingo-cell');
        cell.innerText = num;

        if (index === 12) {
            cell.innerText = "*";
            cell.classList.add('daubed');
        }

        cell.addEventListener('click', () => {
            if (index !== 12) {
                cell.classList.toggle('daubed');
            }
        });

        cardContainer.appendChild(cell);
    });
}

function randomizeSelectedCard() {
    let numbers = [];
    while(numbers.length < 25) {
        let r = Math.floor(Math.random() * 75) + 1;
        if(numbers.indexOf(r) === -1) numbers.push(r);
    }
    cardDataStore[selectedCharAt] = numbers;
    loadCardNumbers(selectedCharAt);
}

function startGame() {
    alert(`Game started with Card #${selectedCharAt}!`);
}

window.onload = () => {
    generateCardSelector();
};

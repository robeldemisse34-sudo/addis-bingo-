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

// Helper to generate random numbers within a specific range without duplicates
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
        // Standard 75-ball column distribution:
        // Col 1 (B): 1-15
        // Col 2 (I): 16-30
        // Col 3 (N): 31-45 (Middle is Free)
        // Col 4 (G): 46-60
        // Col 5 (O): 61-75
        let colB = getUniqueRandomNumbers(1, 15, 5);
        let colI = getUniqueRandomNumbers(16, 30, 5);
        let colN = getUniqueRandomNumbers(31, 45, 4); // 4 numbers + 1 free space
        let colG = getUniqueRandomNumbers(46, 60, 5);
        let colO = getUniqueRandomNumbers(61, 75, 5);

        // Insert free space in the middle of column N (index 2)
        colN.splice(2, 0, "FREE");

        // Transpose columns into row-by-row 25-cell array for the grid
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

window.onload = () => {
    generateCardSelector();
};

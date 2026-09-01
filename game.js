// Generate Master Board (1 to 75 numbers)
function generateMasterBoard() {
    const board = document.getElementById('masterBoard');
    board.innerHTML = '';
    for (let i = 1; i <= 75; i++) {
        const cell = document.createElement('div');
        cell.classList.add('board-cell');
        cell.id = `master-${i}`;
        cell.innerText = i;
        board.appendChild(cell);
    }
}

// Generate Player's 5x5 Mini Card
function generateMiniCard() {
    const card = document.getElementById('miniCard');
    card.innerHTML = '';
    
    let numbers = [];
    while(numbers.length < 25) {
        let r = Math.floor(Math.random() * 75) + 1;
        if(numbers.indexOf(r) === -1) numbers.push(r);
    }

    numbers.forEach((num, index) => {
        const cell = document.createElement('div');
        cell.classList.add('mini-cell');
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

        card.appendChild(cell);
    });
}

function refreshCard() {
    generateMiniCard();
}

function startGame() {
    alert("Game started! Watch for called numbers.");
}

// Initialize on load
window.onload = () => {
    generateMasterBoard();
    generateMiniCard();
};

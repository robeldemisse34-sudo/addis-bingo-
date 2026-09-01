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

function generatePlayerCard() {
    const card = document.getElementById('bingoCard');
    card.innerHTML = '';
    
    let numbers = [];
    while(numbers.length < 25) {
        let r = Math.floor(Math.random() * 75) + 1;
        if(numbers.indexOf(r) === -1) numbers.push(r);
    }

    numbers.forEach((num, index) => {
        const cell = document.createElement('div');
        cell.classList.add('bingo-cell');
        cell.innerText = num;
        
        if (index === 12) {
            cell.innerText = "★";
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
    generatePlayerCard();
}

function declareBingo() {
    alert("BINGO claimed!");
}

window.onload = () => {
    generateMasterBoard();
    generatePlayerCard();
};

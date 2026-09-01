// Generate a random 5x5 Bingo Card with numbers 1 to 75
function generateCard() {
    const card = document.getElementById('bingoCard');
    card.innerHTML = '';
    
    // Simple random number generator for 25 unique cells
    let numbers = [];
    while(numbers.length < 25) {
        let r = Math.floor(Math.random() * 75) + 1;
        if(numbers.indexOf(r) === -1) numbers.push(r);
    }

    numbers.forEach((num, index) => {
        const cell = document.createElement('div');
        cell.classList.add('bingo-cell');
        cell.innerText = num;
        
        // Center space can be free
        if (index === 12) {
            cell.innerText = "FREE";
            cell.classList.add('daubed');
        }

        // Allow manual touch daubing at any time
        cell.addEventListener('click', () => {
            if (index !== 12) {
                cell.classList.toggle('daubed');
            }
        });

        card.appendChild(cell);
    });
}

// Manual Bingo Button Action
function declareBingo() {
    alert("BINGO claimed! Verifying card pattern...");
}

// Initialize card on load
window.onload = generateCard;

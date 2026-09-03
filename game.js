document.addEventListener("DOMContentLoaded", () => {
  const grid = document.getElementById("cardSelectorGrid");
  const preview = document.getElementById("bingoCardPreview");
  const refreshBtn = document.getElementById("refreshBtn");
  const startBtn = document.getElementById("startBtn");

  // State
  let selectedCardIndex = 1;

  // 1. Generate 100 selector cells
  function render100Grid() {
    if (!grid) return;
    grid.innerHTML = "";

    for (let i = 1; i <= 100; i++) {
      const cell = document.createElement("div");
      cell.className = "selector-cell";
      cell.textContent = i;

      if (i === selectedCardIndex) {
        cell.classList.add("selected");
      }

      cell.addEventListener("click", () => {
        document.querySelectorAll(".selector-cell").forEach(c => c.classList.remove("selected"));
        cell.classList.add("selected");
        selectedCardIndex = i;
        generatePreviewCard();
      });

      grid.appendChild(cell);
    }
  }

  // 2. Generate 5x5 Bingo Preview Card
  function generatePreviewCard() {
    if (!preview) return;
    preview.innerHTML = "";

    // Pseudo-random numbers seeded by selected card index for unique card previews
    const numbers = [];
    while (numbers.length < 25) {
      const rand = Math.floor(Math.random() * 75) + 1;
      if (!numbers.includes(rand)) numbers.push(rand);
    }

    numbers.forEach((num, index) => {
      const cell = document.createElement("div");
      cell.className = "bingo-cell";
      
      // Middle cell is FREE
      if (index === 12) {
        cell.textContent = "FREE";
        cell.classList.add("daubed");
      } else {
        cell.textContent = num;
      }

      preview.appendChild(cell);
    });
  }

  // 3. Event Listeners
  if (refreshBtn) {
    refreshBtn.addEventListener("click", () => {
      generatePreviewCard();
    });
  }

  if (startBtn) {
    startBtn.addEventListener("click", () => {
      alert(`Starting game with Card #${selectedCardIndex}!`);
    });
  }

  // Initialize UI
  render100Grid();
  generatePreviewCard();
});

const size = 4;
const grid = document.querySelector('.grid-container');
const scoreElement = document.getElementById('score');
const restartButton = document.getElementById('restart-button');
const messageBox = document.getElementById('message-box');
const messageTitle = document.getElementById('message-title');
const messageContent = document.getElementById('message-content');
const finalScore = document.getElementById('final-score');
const closeMessageBtn = document.getElementById('close-message');

let score = 0;
let hasWon = false;
let gameWon = false;

const gameBoard = [];
for (let i = 0; i < size; i++) {
    gameBoard[i] = [];
    for (let j = 0; j < size; j++) {
        gameBoard[i][j] = 0;
    }
}

function setupGame() {
    // 隐藏弹窗
    messageBox.style.display = 'none';
    score = 0;
    scoreElement.textContent = score;
    hasWon = false;
    gameWon = false;
    // 清空棋盘数据
    for (let i = 0; i < size; i++) {
        for (let j = 0; j < size; j++) {
            gameBoard[i][j] = 0;
        }
    }
    grid.innerHTML = '';
    for (let i = 0; i < size; i++) {
        for (let j = 0; j < size; j++) {
            const cell = document.createElement('div');
            cell.className = 'grid-cell';
            grid.appendChild(cell);
        }
    }
    addNewTile();
    addNewTile();
    updateGrid();
    // 生成数字后再检测Game Over
    setTimeout(() => checkGameOver(), 100);
}

function addNewTile() {
    const emptyCells = [];
    for (let i = 0; i < size; i++) {
        for (let j = 0; j < size; j++) {
            if (gameBoard[i][j] === 0) {
                emptyCells.push({ row: i, col: j });
            }
        }
    }
    
    if (emptyCells.length === 0) return;
    
    const randomCell = emptyCells[Math.floor(Math.random() * emptyCells.length)];
    const value = Math.random() < 0.9 ? 2 : 4;
    gameBoard[randomCell.row][randomCell.col] = value;
    
    const cell = grid.children[randomCell.row * size + randomCell.col];
    const tile = document.createElement('div');
    tile.className = `tile tile-${value}`;
    tile.textContent = value;
    cell.appendChild(tile);
    
    tile.style.transform = 'scale(0)';
    setTimeout(() => {
        tile.style.transform = 'scale(1)';
    }, 0);
}

function moveTiles(direction) {
    let moved = false;
    let merged = false;
    
    const moves = {
        up: () => moveUp(),
        down: () => moveDown(),
        left: () => moveLeft(),
        right: () => moveRight()
    };
    
    function moveUp() {
        for (let col = 0; col < size; col++) {
            for (let row = 0; row < size; row++) {
                if (gameBoard[row][col] !== 0) {
                    let newRow = row;
                    while (newRow > 0 && gameBoard[newRow - 1][col] === 0) {
                        newRow--;
                        moved = true;
                    }
                    if (newRow > 0 && gameBoard[newRow - 1][col] === gameBoard[row][col] && !merged) {
                        gameBoard[newRow - 1][col] *= 2;
                        score += gameBoard[newRow - 1][col];
                        gameBoard[row][col] = 0;
                        moved = true;
                        merged = true;
                        if (gameBoard[newRow - 1][col] === 2048 && !hasWon) {
                            hasWon = true;
                            gameWon = true;
                            showWinMessage();
                        }
                    } else if (newRow !== row) {
                        gameBoard[newRow][col] = gameBoard[row][col];
                        gameBoard[row][col] = 0;
                        moved = true;
                    }
                }
            }
            merged = false;
        }
    }

    function moveDown() {
        for (let col = 0; col < size; col++) {
            for (let row = size - 1; row >= 0; row--) {
                if (gameBoard[row][col] !== 0) {
                    let newRow = row;
                    while (newRow < size - 1 && gameBoard[newRow + 1][col] === 0) {
                        newRow++;
                        moved = true;
                    }
                    if (newRow < size - 1 && gameBoard[newRow + 1][col] === gameBoard[row][col] && !merged) {
                        gameBoard[newRow + 1][col] *= 2;
                        score += gameBoard[newRow + 1][col];
                        gameBoard[row][col] = 0;
                        moved = true;
                        merged = true;
                        if (gameBoard[newRow + 1][col] === 2048 && !hasWon) {
                            hasWon = true;
                            gameWon = true;
                            showWinMessage();
                        }
                    } else if (newRow !== row) {
                        gameBoard[newRow][col] = gameBoard[row][col];
                        gameBoard[row][col] = 0;
                        moved = true;
                    }
                }
            }
            merged = false;
        }
    }

    function moveLeft() {
        for (let row = 0; row < size; row++) {
            for (let col = 0; col < size; col++) {
                if (gameBoard[row][col] !== 0) {
                    let newCol = col;
                    while (newCol > 0 && gameBoard[row][newCol - 1] === 0) {
                        newCol--;
                        moved = true;
                    }
                    if (newCol > 0 && gameBoard[row][newCol - 1] === gameBoard[row][col] && !merged) {
                        gameBoard[row][newCol - 1] *= 2;
                        score += gameBoard[row][newCol - 1];
                        gameBoard[row][col] = 0;
                        moved = true;
                        merged = true;
                        if (gameBoard[row][newCol - 1] === 2048 && !hasWon) {
                            hasWon = true;
                            gameWon = true;
                            showWinMessage();
                        }
                    } else if (newCol !== col) {
                        gameBoard[row][newCol] = gameBoard[row][col];
                        gameBoard[row][col] = 0;
                        moved = true;
                    }
                }
            }
            merged = false;
        }
    }

    function moveRight() {
        for (let row = 0; row < size; row++) {
            for (let col = size - 1; col >= 0; col--) {
                if (gameBoard[row][col] !== 0) {
                    let newCol = col;
                    while (newCol < size - 1 && gameBoard[row][newCol + 1] === 0) {
                        newCol++;
                        moved = true;
                    }
                    if (newCol < size - 1 && gameBoard[row][newCol + 1] === gameBoard[row][col] && !merged) {
                        gameBoard[row][newCol + 1] *= 2;
                        score += gameBoard[row][newCol + 1];
                        gameBoard[row][col] = 0;
                        moved = true;
                        merged = true;
                        if (gameBoard[row][newCol + 1] === 2048 && !hasWon) {
                            hasWon = true;
                            gameWon = true;
                            showWinMessage();
                        }
                    } else if (newCol !== col) {
                        gameBoard[row][newCol] = gameBoard[row][col];
                        gameBoard[row][col] = 0;
                        moved = true;
                    }
                }
            }
            merged = false;
        }
    }

    moves[direction]();
    
    if (moved) {
        updateGrid();
        addNewTile();
        checkGameOver();
    }
}

function updateGrid() {
    scoreElement.textContent = score;
    for (let i = 0; i < size; i++) {
        for (let j = 0; j < size; j++) {
            const cell = grid.children[i * size + j];
            cell.innerHTML = '';
            if (gameBoard[i][j] !== 0) {
                const tile = document.createElement('div');
                tile.className = `tile tile-${gameBoard[i][j]}`;
                tile.textContent = gameBoard[i][j];
                cell.appendChild(tile);
            }
        }
    }
}

function checkGameOver() {
    let gameOver = true;
    for (let i = 0; i < size; i++) {
        for (let j = 0; j < size; j++) {
            if (gameBoard[i][j] === 0) {
                gameOver = false;
                break;
            }
            if (i < size - 1 && gameBoard[i][j] === gameBoard[i + 1][j]) {
                gameOver = false;
                break;
            }
            if (j < size - 1 && gameBoard[i][j] === gameBoard[i][j + 1]) {
                gameOver = false;
                break;
            }
        }
        if (!gameOver) break;
    }

    if (gameOver) {
        showGameOverMessage();
    }
}

function showWinMessage() {
    messageTitle.textContent = 'You Win!';
    messageContent.innerHTML = 'Congratulations! You reached 2048!<br>Your final score: <span id="final-score">' + score + '</span>';
    messageBox.style.display = 'block';
}

function showGameOverMessage() {
    messageTitle.textContent = 'Game Over!';
    messageContent.innerHTML = 'Your final score: <span id="final-score">' + score + '</span>';
    messageBox.style.display = 'block';
}

function handleKeyPress(event) {
    if (gameWon) return;
    
    switch (event.key) {
        case 'ArrowUp':
            moveTiles('up');
            break;
        case 'ArrowDown':
            moveTiles('down');
            break;
        case 'ArrowLeft':
            moveTiles('left');
            break;
        case 'ArrowRight':
            moveTiles('right');
            break;
    }
}

restartButton.addEventListener('click', setupGame);
document.addEventListener('keydown', handleKeyPress);

// 移动端滑动手势支持
let touchStartX = 0;
let touchStartY = 0;
let touchEndX = 0;
let touchEndY = 0;

function isMobile() {
    return /Mobi|Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
}

if (isMobile()) {
    grid.addEventListener('touchstart', function(e) {
        if (e.touches.length === 1) {
            touchStartX = e.touches[0].clientX;
            touchStartY = e.touches[0].clientY;
        }
    });
    grid.addEventListener('touchmove', function(e) {
        if (e.touches.length === 1) {
            touchEndX = e.touches[0].clientX;
            touchEndY = e.touches[0].clientY;
        }
    });
    grid.addEventListener('touchend', function(e) {
        const dx = touchEndX - touchStartX;
        const dy = touchEndY - touchStartY;
        if (Math.abs(dx) < 30 && Math.abs(dy) < 30) return; // 忽略小滑动
        if (Math.abs(dx) > Math.abs(dy)) {
            if (dx > 0) moveTiles('right');
            else moveTiles('left');
        } else {
            if (dy > 0) moveTiles('down');
            else moveTiles('up');
        }
    });
}

closeMessageBtn.addEventListener('click', setupGame);

setupGame();

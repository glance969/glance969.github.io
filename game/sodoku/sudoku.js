// --- 配置常量 ---
const CONFIG = {
    // 默认值
    DEFAULT_SIZE: 4,

    // Toast 提示配置
    TOAST: {
        DURATION_DEFAULT: 3000,      // 默认显示时长（毫秒）
        DURATION_SUCCESS: 5000,      // 成功提示显示时长
        DURATION_PRINT: 4000,        // 打印成功提示时长
        ANIMATION_DURATION: 300      // 动画时长
    },

    // Loading 配置
    LOADING: {
        UI_RENDER_DELAY: 100         // UI渲染延迟（让loading先显示）
    },

    // 自动检查配置
    AUTO_CHECK: {
        DELAY: 60                    // 输入后延迟检查时间（毫秒）
    },

    // 单元格尺寸配置
    CELL_SIZE: {
        INTERACTIVE: {
            SIZE_3: '90px',
            SIZE_4: '70px',
            SIZE_9: '40px'
        },
        PRINT: {
            SIZE_3: '55px',
            SIZE_4: '50px',
            SIZE_9: '32px'
        }
    },

    // 宫格尺寸配置
    BOX_SIZE: {
        SIZE_3: 0,                   // 3x3 无宫格
        SIZE_4: 2,                   // 4x4 为 2x2 宫格
        SIZE_9: 3                    // 9x9 为 3x3 宫格
    },

    // 题目生成配置
    PUZZLE_GENERATION: {
        // 3x3 配置
        SIZE_3: {
            EASY_HOLES_PER_LINE: 1,
            MEDIUM_HOLES_PER_LINE: 2,
            SHUFFLE_ITERATIONS: 10
        },

        // 4x4 配置
        SIZE_4: {
            EASY_MIN_EMPTY: 5,
            EASY_MAX_EMPTY: 10,
            MEDIUM_MAX_EMPTY: 10,
            HARD_MIN_EMPTY: 11,
            MAX_ATTEMPTS: 40
        },

        // 9x9 配置
        SIZE_9: {
            EASY_HOLES_PER_LINE: 3,
            MEDIUM_HOLES_PER_LINE: 5,
            HARD_HOLES_PER_LINE: 5,
            HARD_EXTRA_HOLES: 8,
            MAX_ATTEMPTS: 50,            // 优化后可以增加尝试次数
            MAX_ATTEMPTS_PRINT: 500,     // 打印时可以更多尝试
            // 优化参数
            SYMMETRIC_DIGGING: true,     // 使用对称挖空策略
            MIN_CLUES_EASY: 36,          // 简单模式最少提示数
            MIN_CLUES_MEDIUM: 28,        // 中等模式最少提示数
            MIN_CLUES_HARD: 22           // 困难模式最少提示数
        },

        // 通用配置
        SOLUTION_LIMIT: 2                // 唯一性检测时最多找2个解
    },

    // 打印配置
    PRINT: {
        COUNT_3x3: 60,
        COUNT_4x4: 60,
        COUNT_9x9: 12,                   // 9x9 生成慢，限制数量

        ITEMS_PER_PAGE: {
            SIZE_3: 12,
            SIZE_4: 12,
            SIZE_9: 6
        },

        PRINT_DELAY: 500                 // 打印前延迟（等待toast显示）
    }
};

// --- 全局变量 ---
let currentSolution = [];
let currentSize = CONFIG.DEFAULT_SIZE;
let fourEasyMasks = null;
let autoCheckTimer = null;

// --- 撤销/重做历史记录 ---
let historyStack = [];      // 历史记录栈
let historyIndex = -1;      // 当前历史位置
const MAX_HISTORY = 100;    // 最大历史记录数

// 记录当前状态到历史
function saveToHistory() {
    const boardEl = document.getElementById('board');
    if (!boardEl || !boardEl.children.length) return;

    const state = [];
    for (let i = 0; i < boardEl.children.length; i++) {
        const cell = boardEl.children[i];
        if (cell.classList.contains('fixed')) {
            state.push(null); // null 表示固定格
        } else {
            const input = cell.querySelector('input');
            state.push(input ? input.value : '');
        }
    }

    // 如果当前不在历史末尾，删除后面的记录
    if (historyIndex < historyStack.length - 1) {
        historyStack = historyStack.slice(0, historyIndex + 1);
    }

    // 添加新状态
    historyStack.push(state);

    // 限制历史记录数量
    if (historyStack.length > MAX_HISTORY) {
        historyStack.shift();
    } else {
        historyIndex++;
    }
}

// 恢复指定历史状态
function restoreFromHistory(index) {
    if (index < 0 || index >= historyStack.length) return;

    const boardEl = document.getElementById('board');
    if (!boardEl || !boardEl.children.length) return;

    const state = historyStack[index];
    historyIndex = index;

    for (let i = 0; i < boardEl.children.length; i++) {
        const cell = boardEl.children[i];
        if (state[i] === null) continue; // 跳过固定格

        const input = cell.querySelector('input');
        if (input) {
            input.value = state[i];
            cell.classList.remove('invalid', 'conflict', 'hint-revealed');
        }
    }

    // 更新按钮状态
    updateUndoRedoButtons();
}

// 撤销
function undo() {
    if (historyIndex > 0) {
        restoreFromHistory(historyIndex - 1);
        showToast('↶ 已撤销', 'success', 1500);
    } else {
        showToast('没有可撤销的操作', 'warning', 1500);
    }
}

// 重做
function redo() {
    if (historyIndex < historyStack.length - 1) {
        restoreFromHistory(historyIndex + 1);
        showToast('↷ 已重做', 'success', 1500);
    } else {
        showToast('没有可重做的操作', 'warning', 1500);
    }
}

// 更新撤销/重做按钮状态
function updateUndoRedoButtons() {
    const undoBtn = document.getElementById('undo-btn');
    const redoBtn = document.getElementById('redo-btn');

    if (undoBtn) {
        undoBtn.disabled = historyIndex <= 0;
        undoBtn.style.opacity = historyIndex <= 0 ? '0.5' : '1';
    }
    if (redoBtn) {
        redoBtn.disabled = historyIndex >= historyStack.length - 1;
        redoBtn.style.opacity = historyIndex >= historyStack.length - 1 ? '0.5' : '1';
    }
}

// 清空历史记录（新游戏时调用）
function clearHistory() {
    historyStack = [];
    historyIndex = -1;
    updateUndoRedoButtons();
}

// 键盘快捷键支持
document.addEventListener('keydown', function (e) {
    // Ctrl+Z 撤销
    if (e.ctrlKey && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
    }
    // Ctrl+Y 或 Ctrl+Shift+Z 重做
    if ((e.ctrlKey && e.key === 'y') || (e.ctrlKey && e.shiftKey && e.key === 'z')) {
        e.preventDefault();
        redo();
    }
});

// --- 游戏进度保存/加载 (localStorage) ---
const STORAGE_KEY = 'sudoku_game_state';

// 保存游戏状态到 localStorage
function saveGameState() {
    const boardEl = document.getElementById('board');
    if (!boardEl || !boardEl.children.length) return;

    const cells = [];
    for (let i = 0; i < boardEl.children.length; i++) {
        const cell = boardEl.children[i];
        if (cell.classList.contains('fixed')) {
            cells.push({ fixed: true, value: parseInt(cell.getAttribute('data-val') || cell.innerText, 10) });
        } else {
            const input = cell.querySelector('input');
            cells.push({ fixed: false, value: input ? input.value : '' });
        }
    }

    const state = {
        size: currentSize,
        difficulty: document.getElementById('diff-select').value,
        solution: currentSolution,
        cells: cells,
        timestamp: Date.now()
    };

    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
        console.warn('无法保存游戏进度:', e);
    }
}

// 从 localStorage 加载游戏状态
function loadGameState() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (!saved) return null;

        const state = JSON.parse(saved);

        // 验证数据完整性
        if (!state.size || !state.cells || !state.solution) return null;

        return state;
    } catch (e) {
        console.warn('无法加载游戏进度:', e);
        return null;
    }
}

// 恢复保存的游戏
function restoreGameState() {
    const state = loadGameState();
    if (!state) return false;

    currentSize = state.size;
    currentSolution = state.solution;

    // 更新选择器
    document.getElementById('size-select').value = state.size;
    document.getElementById('diff-select').value = state.difficulty;

    // 重建棋盘
    const grid = [];
    for (let r = 0; r < state.size; r++) {
        const row = [];
        for (let c = 0; c < state.size; c++) {
            const cell = state.cells[r * state.size + c];
            row.push(cell.fixed ? cell.value : 0);
        }
        grid.push(row);
    }

    renderBoard(grid, state.size, 'board', true);

    // 恢复用户输入
    const boardEl = document.getElementById('board');
    for (let i = 0; i < state.cells.length; i++) {
        const cellData = state.cells[i];
        if (!cellData.fixed && cellData.value) {
            const cell = boardEl.children[i];
            const input = cell.querySelector('input');
            if (input) {
                input.value = cellData.value;
            }
        }
    }

    // 初始化历史记录
    clearHistory();
    saveToHistory();

    return true;
}

// 清除保存的进度
function clearSavedGame() {
    try {
        localStorage.removeItem(STORAGE_KEY);
        showToast('已清除保存的进度', 'success', 2000);
    } catch (e) {
        console.warn('无法清除进度:', e);
    }
}

// 检查是否有保存的游戏
function hasSavedGame() {
    return loadGameState() !== null;
}

// --- Web Worker 管理 ---
let sudokuWorker = null;
let workerReady = false;
let pendingCallbacks = new Map();
let callbackId = 0;

function initWorker() {
    if (sudokuWorker) return;

    try {
        sudokuWorker = new Worker('sudoku-worker.js');

        sudokuWorker.onmessage = function (e) {
            const { type, id, data } = e.data;

            switch (type) {
                case 'ready':
                    workerReady = true;
                    console.log('Web Worker 已就绪');
                    break;

                case 'puzzleGenerated':
                case 'batchGenerated':
                    if (pendingCallbacks.has(id)) {
                        const callback = pendingCallbacks.get(id);
                        pendingCallbacks.delete(id);
                        callback(null, data);
                    }
                    break;

                case 'batchProgress':
                    // 更新进度显示
                    const { current, total } = data;
                    const loadingText = document.getElementById('loading-text');
                    if (loadingText) {
                        loadingText.textContent = `正在生成题目... (${current}/${total})`;
                    }
                    break;

                case 'error':
                    console.error('Worker 错误:', data.message);
                    if (pendingCallbacks.has(id)) {
                        const callback = pendingCallbacks.get(id);
                        pendingCallbacks.delete(id);
                        callback(new Error(data.message), null);
                    }
                    break;
            }
        };

        sudokuWorker.onerror = function (error) {
            console.error('Worker 加载失败:', error);
            workerReady = false;
            sudokuWorker = null;
        };

    } catch (error) {
        console.warn('Web Worker 不支持，将使用主线程生成:', error);
        sudokuWorker = null;
        workerReady = false;
    }
}

function generatePuzzleAsync(size, difficulty, callback) {
    if (!sudokuWorker || !workerReady) {
        // 降级到同步生成
        try {
            const solution = generateCompleteBoard(size);
            const puzzle = createPuzzle(solution, size, difficulty);
            callback(null, { solution, puzzle, info: {}, elapsed: 0 });
        } catch (error) {
            callback(error, null);
        }
        return;
    }

    const id = ++callbackId;
    pendingCallbacks.set(id, callback);

    sudokuWorker.postMessage({
        type: 'generatePuzzle',
        id,
        data: { size, difficulty }
    });
}

function generateBatchAsync(size, difficulty, count, callback) {
    if (!sudokuWorker || !workerReady) {
        // 降级到同步生成
        try {
            const solution = generateCompleteBoard(size);
            const puzzles = generateAllUniquePuzzles(solution, size, difficulty, count);
            callback(null, { puzzles, elapsed: 0, count: puzzles.length });
        } catch (error) {
            callback(error, null);
        }
        return;
    }

    const id = ++callbackId;
    pendingCallbacks.set(id, callback);

    sudokuWorker.postMessage({
        type: 'generateBatch',
        id,
        data: { size, difficulty, count }
    });
}

// 初始化 Worker
initWorker();

// --- Toast 提示功能 ---
function showToast(message, type = 'success', duration = CONFIG.TOAST.DURATION_DEFAULT) {
    const container = document.getElementById('toast-container');

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    const iconMap = {
        success: '✓',
        warning: '⚠',
        error: '✕'
    };

    toast.innerHTML = `
                <span class="toast-icon">${iconMap[type] || '✓'}</span>
                <span class="toast-message">${message}</span>
                <span class="toast-close">×</span>
            `;

    container.appendChild(toast);

    const closeBtn = toast.querySelector('.toast-close');
    const closeToast = () => {
        toast.classList.add('hiding');
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, CONFIG.TOAST.ANIMATION_DURATION);
    };

    closeBtn.addEventListener('click', closeToast);

    if (duration > 0) {
        setTimeout(closeToast, duration);
    }
}

// --- Loading 遮罩层功能 ---
function showLoading(text = '正在生成题目...') {
    const overlay = document.getElementById('loading-overlay');
    const loadingText = document.getElementById('loading-text');
    loadingText.textContent = text;
    overlay.classList.add('show');
}

function hideLoading() {
    const overlay = document.getElementById('loading-overlay');
    overlay.classList.remove('show');
}

// --- 核心算法 ---

function generateCompleteBoard(size) {
    if (size === 3) {
        let board = [[1, 2, 3], [2, 3, 1], [3, 1, 2]];
        return shuffleLatinSquare(board);
    }

    let board = Array.from({ length: size }, () => Array(size).fill(0));
    solveBacktrack(board, size);
    return board;
}

function shuffleLatinSquare(board) {
    for (let i = 0; i < CONFIG.PUZZLE_GENERATION.SIZE_3.SHUFFLE_ITERATIONS; i++) {
        let r1 = Math.floor(Math.random() * 3);
        let r2 = Math.floor(Math.random() * 3);
        [board[r1], board[r2]] = [board[r2], board[r1]];
    }
    let map = [1, 2, 3].sort(() => Math.random() - 0.5);
    for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) {
            let val = board[r][c];
            board[r][c] = map[val - 1];
        }
    }
    return board;
}

function solveBacktrack(board, size) {
    for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
            if (board[r][c] === 0) {
                let nums = Array.from({ length: size }, (_, i) => i + 1);
                nums.sort(() => Math.random() - 0.5);

                for (let num of nums) {
                    if (isValid(board, r, c, num, size)) {
                        board[r][c] = num;
                        if (solveBacktrack(board, size)) return true;
                        board[r][c] = 0;
                    }
                }
                return false;
            }
        }
    }
    return true;
}

function isValid(board, row, col, num, size) {
    for (let i = 0; i < size; i++) {
        if (board[row][i] === num) return false;
        if (board[i][col] === num) return false;
    }
    if (size === 4 || size === 9) {
        let boxW = size === 4 ? 2 : 3;
        let boxH = size === 4 ? 2 : 3;
        let startR = Math.floor(row / boxH) * boxH;
        let startC = Math.floor(col / boxW) * boxW;
        for (let i = 0; i < boxH; i++) {
            for (let j = 0; j < boxW; j++) {
                if (board[startR + i][startC + j] === num) return false;
            }
        }
    }
    return true;
}

// --- 挖空生成题目 (修复版) ---
function createPuzzle(solvedBoard, size, difficulty) {
    if (size === 3) {
        // 简单: 每行挖1个 (更多提示)
        // 中等: 每行优选挖2个，且剩余 3 格数字全部不同（uniqueCount === 3）
        // 困难: 只保留 3 个数字（位置不限），且这 3 个数字满足 uniqueCount === 2（例如 1,1,2）

        const holesPerLine = (difficulty === 'easy') ? 1 : (difficulty === 'medium' ? 2 : null);
        const isHard = (difficulty === 'hard');
        const isMedium = (difficulty === 'medium');

        const allPatterns = [
            [0, 1, 2], [0, 2, 1],
            [1, 0, 2], [1, 2, 0],
            [2, 0, 1], [2, 1, 0]
        ];
        const shuffled = allPatterns.slice().sort(() => Math.random() - 0.5);
        // all combinations of 3 cell indices (0..8) for hard mode where preserved 3 cells can be anywhere
        const allCombos = (function () {
            const combos = [];
            const indices = Array.from({ length: 9 }, (_, i) => i);
            for (let i = 0; i < 7; i++) for (let j = i + 1; j < 8; j++) for (let k = j + 1; k < 9; k++) combos.push([i, j, k]);
            return combos;
        })();
        const shuffledCombos = allCombos.slice().sort(() => Math.random() - 0.5);

        let selectedBoard = null;
        let selectedUniqueCount = 0;

        const applyPattern = (pattern, holesMode) => {
            const candidate = JSON.parse(JSON.stringify(solvedBoard));
            const hp = (typeof holesMode !== 'undefined') ? holesMode : holesPerLine;
            if (hp === 1) {
                for (let r = 0; r < 3; r++) {
                    candidate[r][pattern[r]] = 0;
                }
            } else if (hp === 2) {
                for (let r = 0; r < 3; r++) {
                    for (let c = 0; c < 3; c++) {
                        if (c !== pattern[r]) {
                            candidate[r][c] = 0;
                        }
                    }
                }
            } else {
                // holesMode === null (no restriction): prefer 2-hole pattern but allow 1-hole fallback
                for (let r = 0; r < 3; r++) {
                    for (let c = 0; c < 3; c++) {
                        if (c !== pattern[r]) candidate[r][c] = 0;
                    }
                }
            }
            return candidate;
        };

        for (const pattern of shuffled) {
            if (holesPerLine === 1) {
                selectedBoard = applyPattern(pattern, 1);
                break;
            } else if (holesPerLine === 2) {
                const candidate = applyPattern(pattern, 2);
                const uniqueCount = getUniqueNonZeroCount(candidate);
                if (isHard && uniqueCount === 2) {
                    selectedBoard = candidate;
                    selectedUniqueCount = uniqueCount;
                    break;
                }
                if (isMedium && uniqueCount === 3) {
                    selectedBoard = candidate;
                    selectedUniqueCount = uniqueCount;
                    break;
                }
                if (!isHard && !isMedium) {
                    selectedBoard = candidate;
                    selectedUniqueCount = uniqueCount;
                    break;
                }
            } else {
                // holesPerLine === null -> hard mode: we must preserve exactly 3 cells anywhere
                for (const combo of shuffledCombos) {
                    // build candidate with only these three positions kept
                    const candidate = Array.from({ length: 3 }, (_, r) => Array(3).fill(0));
                    for (let idx = 0; idx < 9; idx++) {
                        const rr = Math.floor(idx / 3), cc = idx % 3;
                        if (combo.includes(idx)) candidate[rr][cc] = solvedBoard[rr][cc];
                    }
                    const uniqueCount = getUniqueNonZeroCount(candidate);
                    if (uniqueCount === 2) {
                        selectedBoard = candidate;
                        selectedUniqueCount = uniqueCount;
                        break;
                    }
                }
                if (selectedBoard) break;
            }
        }

        if (!selectedBoard) {
            // fallback: prefer 2-hole pattern when available, otherwise 1-hole
            if (holesPerLine === 1) selectedBoard = applyPattern(allPatterns[0], 1);
            else if (holesPerLine === 2) selectedBoard = applyPattern(allPatterns[0], 2);
            else {
                // hard fallback: pick first combo that matches uniqueCount===2
                for (const combo of allCombos) {
                    const candidate = Array.from({ length: 3 }, (_, r) => Array(3).fill(0));
                    for (let idx = 0; idx < 9; idx++) {
                        const rr = Math.floor(idx / 3), cc = idx % 3;
                        if (combo.includes(idx)) candidate[rr][cc] = solvedBoard[rr][cc];
                    }
                    if (getUniqueNonZeroCount(candidate) === 2) { selectedBoard = candidate; break; }
                }
                if (!selectedBoard) selectedBoard = applyPattern(allPatterns[0], 2);
            }
            selectedUniqueCount = getUniqueNonZeroCount(selectedBoard);
        }

        // 之前的难度重分类逻辑不再适用（hard 的定义已修改），因此移除。

        return selectedBoard;
    }
    else if (size === 4 && difficulty === 'easy') {
        return generate4EasyPuzzle(solvedBoard);
    }
    else if (size === 4 && (difficulty === 'medium' || difficulty === 'hard')) {
        return generate4StrongPuzzle(solvedBoard, difficulty);
    }
    else if (size === 9) {
        // 使用优化的 9x9 生成算法
        return generate9x9PuzzleOptimized(solvedBoard, difficulty);
    }
    else {
        // Generic fallback for other sizes
        console.warn('Unexpected size in createPuzzle:', size);
        return JSON.parse(JSON.stringify(solvedBoard));
    }
}

function wouldViolateConstraints(board, toRemove, size, newR, newC) {
    let tempRemove = new Set(toRemove);
    tempRemove.add(`${newR}-${newC}`);

    let rowEmpty = true;
    for (let c = 0; c < size; c++) {
        if (!tempRemove.has(`${newR}-${c}`)) {
            rowEmpty = false;
            break;
        }
    }
    if (rowEmpty) return true;

    let colEmpty = true;
    for (let r = 0; r < size; r++) {
        if (!tempRemove.has(`${r}-${newC}`)) {
            colEmpty = false;
            break;
        }
    }
    if (colEmpty) return true;

    return false;
}

function passes4EasyConstraint(rowHoles, colHoles, boxHoles) {
    let linesWithThree = 0;
    for (let i = 0; i < rowHoles.length; i++) {
        if (rowHoles[i] === 1) linesWithThree++;
    }
    for (let i = 0; i < colHoles.length; i++) {
        if (colHoles[i] === 1) linesWithThree++;
    }

    let boxesWithThree = 0;
    for (let i = 0; i < boxHoles.length; i++) {
        if (boxHoles[i] === 1) boxesWithThree++;
    }

    if (linesWithThree > 1 || boxesWithThree > 1) return false;
    if (linesWithThree >= 1 && boxesWithThree >= 1) return false;
    return true;
}

function get4EasyMasks() {
    if (fourEasyMasks) return fourEasyMasks;

    const masks = [];
    const total = 16;

    for (let mask = 0; mask < (1 << total); mask++) {
        const emptyCount = countBits(mask);
        // easy 保持一个合理的空格区间（可调整），这里用 5..10
        if (emptyCount < 5 || emptyCount > 10) continue;

        const rowEmpty = Array(4).fill(0);
        const colEmpty = Array(4).fill(0);
        const boxEmpty = Array(4).fill(0);

        for (let idx = 0; idx < total; idx++) {
            if ((mask & (1 << idx)) === 0) continue;
            const r = Math.floor(idx / 4);
            const c = idx % 4;
            rowEmpty[r]++;
            colEmpty[c]++;
            const boxIdx = Math.floor(r / 2) * 2 + Math.floor(c / 2);
            boxEmpty[boxIdx]++;
        }

        // 计算每行/列/宫的已填数量
        const rowFilled = rowEmpty.map(e => 4 - e);
        const colFilled = colEmpty.map(e => 4 - e);
        const boxFilled = boxEmpty.map(e => 4 - e);

        // easy 规则: 只有一条线（行或列）或者只有一个子宫格 有 3 个已填数字
        // 且 任意一条线 与 任意子宫格 不能同时存在 3 个数字
        let linesWithThree = 0;
        for (let i = 0; i < 4; i++) {
            if (rowFilled[i] === 3) linesWithThree++;
            if (colFilled[i] === 3) linesWithThree++;
        }
        let boxesWithThree = 0;
        for (let i = 0; i < 4; i++) {
            if (boxFilled[i] === 3) boxesWithThree++;
        }

        // 不允许任何行/列/宫已填为 4 个
        let anyFull = false;
        for (let i = 0; i < 4; i++) {
            if (rowFilled[i] === 4 || colFilled[i] === 4 || boxFilled[i] === 4) { anyFull = true; break; }
        }
        if (anyFull) continue;

        // 必须且仅能有一个（行/列 或 子宫格）包含 3 个已填数字
        if ((linesWithThree + boxesWithThree) !== 1) continue;

        // 其他行/列/宫已填数不能大于 3（理论上不会），允许全空（filled==0）
        const coords = [];
        for (let idx = 0; idx < total; idx++) {
            if ((mask & (1 << idx)) !== 0) {
                coords.push([Math.floor(idx / 4), idx % 4]);
            }
        }
        masks.push(coords);
    }

    fourEasyMasks = masks;
    return masks;
}

function countBits(num) {
    let n = num;
    let count = 0;
    while (n) {
        count += n & 1;
        n >>= 1;
    }
    return count;
}

// --- 解的计数与唯一性检测（用于保证 puzzle 只有唯一解） ---
function possibleCandidates(board, row, col, size) {
    const candidates = [];
    for (let num = 1; num <= size; num++) {
        if (isValid(board, row, col, num, size)) candidates.push(num);
    }
    return candidates;
}

function findEmptyWithFewestCandidates(board, size) {
    let best = null;
    for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
            if (board[r][c] === 0) {
                const cand = possibleCandidates(board, r, c, size);
                if (cand.length === 0) return { r, c, cand };
                if (!best || cand.length < best.cand.length) best = { r, c, cand };
            }
        }
    }
    return best;
}

function countSolutions(board, size, limit = 2) {
    // DFS with MRV heuristic, early exit when count >= limit
    let count = 0;

    function dfs(b) {
        if (count >= limit) return;
        const cell = findEmptyWithFewestCandidates(b, size);
        if (!cell) { // no empty -> found one solution
            count++;
            return;
        }
        const { r, c, cand } = cell;
        if (!cand || cand.length === 0) return; // dead end
        for (let num of cand) {
            b[r][c] = num;
            dfs(b);
            b[r][c] = 0;
            if (count >= limit) return;
        }
    }

    const copy = JSON.parse(JSON.stringify(board));
    dfs(copy);
    return count;
}

// ===== 9x9 性能优化模块 =====

// 优化的唯一性检测 - 使用位运算加速候选数计算
function countSolutionsFast(board, limit = 2) {
    const size = 9;
    let count = 0;

    // 预计算每行、列、宫的已用数字（位掩码）
    const rowUsed = Array(9).fill(0);
    const colUsed = Array(9).fill(0);
    const boxUsed = Array(9).fill(0);

    for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
            const val = board[r][c];
            if (val !== 0) {
                const bit = 1 << val;
                rowUsed[r] |= bit;
                colUsed[c] |= bit;
                boxUsed[Math.floor(r / 3) * 3 + Math.floor(c / 3)] |= bit;
            }
        }
    }

    function getCandidates(r, c) {
        const boxIdx = Math.floor(r / 3) * 3 + Math.floor(c / 3);
        const used = rowUsed[r] | colUsed[c] | boxUsed[boxIdx];
        const candidates = [];
        for (let num = 1; num <= 9; num++) {
            if ((used & (1 << num)) === 0) {
                candidates.push(num);
            }
        }
        return candidates;
    }

    function findBestEmpty() {
        let best = null;
        let minCand = 10;
        for (let r = 0; r < size; r++) {
            for (let c = 0; c < size; c++) {
                if (board[r][c] === 0) {
                    const cand = getCandidates(r, c);
                    if (cand.length === 0) return { r, c, cand };
                    if (cand.length < minCand) {
                        minCand = cand.length;
                        best = { r, c, cand };
                    }
                }
            }
        }
        return best;
    }

    function dfs() {
        if (count >= limit) return;
        const cell = findBestEmpty();
        if (!cell) {
            count++;
            return;
        }
        const { r, c, cand } = cell;
        if (cand.length === 0) return;

        const boxIdx = Math.floor(r / 3) * 3 + Math.floor(c / 3);
        for (const num of cand) {
            const bit = 1 << num;
            board[r][c] = num;
            rowUsed[r] |= bit;
            colUsed[c] |= bit;
            boxUsed[boxIdx] |= bit;

            dfs();

            board[r][c] = 0;
            rowUsed[r] &= ~bit;
            colUsed[c] &= ~bit;
            boxUsed[boxIdx] &= ~bit;

            if (count >= limit) return;
        }
    }

    dfs();
    return count;
}

// 对称挖空策略生成 9x9 题目
function generate9x9PuzzleOptimized(solvedBoard, difficulty) {
    const size = 9;
    const config = CONFIG.PUZZLE_GENERATION.SIZE_9;

    // 根据难度确定目标提示数和最大尝试次数
    let targetClues, maxAttempts;
    switch (difficulty) {
        case 'easy':
            targetClues = config.MIN_CLUES_EASY;
            maxAttempts = config.MAX_ATTEMPTS;
            break;
        case 'medium':
            targetClues = config.MIN_CLUES_MEDIUM;
            maxAttempts = config.MAX_ATTEMPTS;
            break;
        case 'hard':
            targetClues = config.MIN_CLUES_HARD;
            maxAttempts = config.MAX_ATTEMPTS;
            break;
        default:
            targetClues = config.MIN_CLUES_MEDIUM;
            maxAttempts = config.MAX_ATTEMPTS;
    }

    console.time('generate9x9-optimized');

    let bestBoard = null;
    let bestClues = 81;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const board = JSON.parse(JSON.stringify(solvedBoard));
        let currentClues = 81;

        // 生成随机挖空顺序（对称挖空）
        const positions = [];
        for (let r = 0; r < size; r++) {
            for (let c = 0; c < size; c++) {
                positions.push([r, c]);
            }
        }

        // 使用对称挖空：优先从对称位置挖空
        if (config.SYMMETRIC_DIGGING) {
            // 打乱位置顺序但保持对称性
            const shuffled = [];
            const used = new Set();
            const center = [4, 4];

            // 先处理中心点
            shuffled.push(center);
            used.add('4-4');

            // 处理对称点对
            const pairs = [];
            for (let r = 0; r < size; r++) {
                for (let c = 0; c < size; c++) {
                    if (used.has(`${r}-${c}`)) continue;
                    const symR = 8 - r;
                    const symC = 8 - c;
                    if (r === symR && c === symC) {
                        shuffled.push([r, c]);
                    } else if (!used.has(`${symR}-${symC}`)) {
                        pairs.push([[r, c], [symR, symC]]);
                        used.add(`${r}-${c}`);
                        used.add(`${symR}-${symC}`);
                    }
                }
            }

            // 打乱对称对的顺序
            pairs.sort(() => Math.random() - 0.5);
            for (const pair of pairs) {
                shuffled.push(pair[0], pair[1]);
            }

            positions.length = 0;
            positions.push(...shuffled);
        } else {
            positions.sort(() => Math.random() - 0.5);
        }

        // 逐个尝试挖空
        for (const [r, c] of positions) {
            if (currentClues <= targetClues) break;
            if (board[r][c] === 0) continue;

            const backup = board[r][c];
            board[r][c] = 0;

            // 对称挖空：同时挖掉对称位置
            const symR = 8 - r;
            const symC = 8 - c;
            let symBackup = 0;
            if (config.SYMMETRIC_DIGGING && (r !== symR || c !== symC) && board[symR][symC] !== 0) {
                symBackup = board[symR][symC];
                board[symR][symC] = 0;
            }

            // 快速唯一性检测
            const solutions = countSolutionsFast(board, 2);

            if (solutions === 1) {
                // 唯一解，保持挖空
                currentClues = symBackup ? currentClues - 2 : currentClues - 1;
            } else {
                // 多解或无解，恢复
                board[r][c] = backup;
                if (symBackup) {
                    board[symR][symC] = symBackup;
                }
            }
        }

        // 检查是否满足目标提示数
        if (currentClues <= targetClues + 5) {
            // 验证最终唯一性
            const finalCheck = countSolutionsFast(board, 2);
            if (finalCheck === 1) {
                console.timeEnd('generate9x9-optimized');
                console.log(`9x9 puzzle generated: ${currentClues} clues, attempt ${attempt + 1}`);
                return board;
            }
        }

        // 记录最佳结果
        if (currentClues < bestClues) {
            bestBoard = JSON.parse(JSON.stringify(board));
            bestClues = currentClues;
        }
    }

    console.timeEnd('generate9x9-optimized');

    // 返回最佳结果或最后尝试
    if (bestBoard) {
        const check = countSolutionsFast(bestBoard, 2);
        if (check === 1) {
            console.log(`9x9 puzzle (best): ${bestClues} clues`);
            return bestBoard;
        }
    }

    console.warn('Failed to generate unique 9x9 puzzle, using fallback');
    return generate9x9PuzzleFallback(solvedBoard, difficulty);
}

// 9x9 后备生成方法（原始算法改进版）
function generate9x9PuzzleFallback(solvedBoard, difficulty) {
    const size = 9;
    let holesPerLine;

    if (difficulty === 'easy') holesPerLine = 3;
    else if (difficulty === 'medium') holesPerLine = 5;
    else holesPerLine = 5;

    const maxAttempts = 20;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const board = JSON.parse(JSON.stringify(solvedBoard));
        const toRemove = new Set();

        // 每行每列至少挖指定数量的洞
        for (let r = 0; r < size; r++) {
            const cols = Array.from({ length: size }, (_, i) => i);
            cols.sort(() => Math.random() - 0.5);
            for (let i = 0; i < holesPerLine; i++) {
                toRemove.add(`${r}-${cols[i]}`);
            }
        }

        for (let c = 0; c < size; c++) {
            let colHoles = 0;
            for (let r = 0; r < size; r++) {
                if (toRemove.has(`${r}-${c}`)) colHoles++;
            }
            while (colHoles < holesPerLine) {
                const r = Math.floor(Math.random() * size);
                if (!toRemove.has(`${r}-${c}`)) {
                    toRemove.add(`${r}-${c}`);
                    colHoles++;
                }
            }
        }

        // 困难模式额外挖空
        if (difficulty === 'hard') {
            let extra = 8;
            let tries = 30;
            while (extra > 0 && tries > 0) {
                const r = Math.floor(Math.random() * size);
                const c = Math.floor(Math.random() * size);
                if (!toRemove.has(`${r}-${c}`)) {
                    toRemove.add(`${r}-${c}`);
                    extra--;
                }
                tries--;
            }
        }

        for (const key of toRemove) {
            const [r, c] = key.split('-').map(Number);
            board[r][c] = 0;
        }

        // 唯一性检测
        const solutions = countSolutionsFast(board, 2);
        if (solutions === 1) {
            return board;
        }
    }

    // 最终后备：直接返回简单挖空
    const board = JSON.parse(JSON.stringify(solvedBoard));
    for (let r = 0; r < size; r++) {
        for (let c = 0; c < 3; c++) {
            board[r][c] = 0;
        }
    }
    return board;
}

// 检查是否所有可填格都已填（不立即触发 check），返回 true/false
function autoCheckIfComplete() {
    const boardEl = document.getElementById('board');
    const cells = boardEl && boardEl.children;
    if (!cells || cells.length === 0) return false;

    for (let i = 0; i < cells.length; i++) {
        const cell = cells[i];
        if (cell.classList.contains('fixed')) continue;
        const input = cell.querySelector('input');
        if (!input) return false; // interactive not ready
        if (!input.value || input.value.toString().trim() === '') return false; // still empty
    }

    return true;
}

// 带延迟的调度，避免在输入渲染前触发检查（防止提示过早）
function scheduleAutoCheck(delay = CONFIG.AUTO_CHECK.DELAY) {
    if (autoCheckTimer) clearTimeout(autoCheckTimer);
    autoCheckTimer = setTimeout(() => {
        autoCheckTimer = null;
        if (autoCheckIfComplete()) checkGame();
    }, delay);
}

// --- 实时冲突检测 ---
function validateCellRealtime(cellIndex, inputValue) {
    const boardEl = document.getElementById('board');
    const cells = boardEl.children;
    const size = currentSize;

    // 计算行列位置
    const row = Math.floor(cellIndex / size);
    const col = cellIndex % size;

    // 清除所有冲突高亮
    for (let i = 0; i < cells.length; i++) {
        cells[i].classList.remove('conflict');
    }

    if (!inputValue || inputValue < 1 || inputValue > size) return;

    const conflicts = new Set();

    // 读取当前棋盘状态
    const board = [];
    for (let i = 0; i < cells.length; i++) {
        const cell = cells[i];
        if (cell.classList.contains('fixed')) {
            board.push(parseInt(cell.getAttribute('data-val') || cell.innerText, 10));
        } else {
            const input = cell.querySelector('input');
            board.push(input && input.value ? parseInt(input.value, 10) : 0);
        }
    }

    // 检查行冲突
    for (let c = 0; c < size; c++) {
        if (c !== col) {
            const idx = row * size + c;
            if (board[idx] === inputValue) {
                conflicts.add(cellIndex);
                conflicts.add(idx);
            }
        }
    }

    // 检查列冲突
    for (let r = 0; r < size; r++) {
        if (r !== row) {
            const idx = r * size + col;
            if (board[idx] === inputValue) {
                conflicts.add(cellIndex);
                conflicts.add(idx);
            }
        }
    }

    // 检查宫格冲突 (4x4 和 9x9)
    if (size === 4 || size === 9) {
        const boxSize = size === 4 ? 2 : 3;
        const startR = Math.floor(row / boxSize) * boxSize;
        const startC = Math.floor(col / boxSize) * boxSize;

        for (let r = startR; r < startR + boxSize; r++) {
            for (let c = startC; c < startC + boxSize; c++) {
                if (r !== row || c !== col) {
                    const idx = r * size + c;
                    if (board[idx] === inputValue) {
                        conflicts.add(cellIndex);
                        conflicts.add(idx);
                    }
                }
            }
        }
    }

    // 高亮冲突单元格
    for (const idx of conflicts) {
        cells[idx].classList.add('conflict');
    }
}

// --- 提示功能 ---
function showHint() {
    const boardEl = document.getElementById('board');
    const cells = boardEl.children;
    const size = currentSize;

    if (!currentSolution || currentSolution.length === 0) {
        showToast('无法提供提示', 'warning');
        return;
    }

    // 找到一个空格或错误的格子
    const emptyCells = [];
    for (let i = 0; i < cells.length; i++) {
        const cell = cells[i];
        if (cell.classList.contains('fixed')) continue;

        const input = cell.querySelector('input');
        if (!input) continue;

        const r = Math.floor(i / size);
        const c = i % size;
        const correctVal = currentSolution[r][c];
        const currentVal = input.value ? parseInt(input.value, 10) : 0;

        if (currentVal !== correctVal) {
            emptyCells.push({ index: i, input, correctVal });
        }
    }

    if (emptyCells.length === 0) {
        showToast('所有格子都已正确填写！', 'success');
        return;
    }

    // 随机选择一个格子给出提示
    const hint = emptyCells[Math.floor(Math.random() * emptyCells.length)];
    hint.input.value = hint.correctVal;
    hint.input.parentNode.classList.add('hint-revealed');

    // 触发验证
    const cellIndex = hint.index;
    validateCellRealtime(cellIndex, hint.correctVal);
    scheduleAutoCheck();

    showToast(`提示: 填入 ${hint.correctVal}`, 'success', 2000);
}

function generate4EasyPuzzle(solvedBoard) {
    const masks = get4EasyMasks();
    if (!masks.length) return JSON.parse(JSON.stringify(solvedBoard));

    // 尝试不同的完整解 + 掩码组合，优先返回第一个唯一解（attempts 上限避免卡住）
    const maxAttempts = 40;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        // 尝试第一次使用传入的 solvedBoard，后续尝试生成新的完整解
        const baseSolution = (attempt === 0) ? JSON.parse(JSON.stringify(solvedBoard)) : generateCompleteBoard(4);

        const shuffledMasks = masks.slice().sort(() => Math.random() - 0.5);
        for (const pattern of shuffledMasks) {
            const board = JSON.parse(JSON.stringify(baseSolution));
            for (const [r, c] of pattern) board[r][c] = 0;
            const sols = countSolutions(board, 4, 2);
            if (sols === 1) return board;
        }
    }

    // 若多次尝试仍未找到唯一解，退回到随机掩码（与之前行为一致）
    const fallback = JSON.parse(JSON.stringify(solvedBoard));
    const pat = masks[Math.floor(Math.random() * masks.length)];
    for (const [r, c] of pat) fallback[r][c] = 0;
    return fallback;
}

// --- 4x4 强约束掘题（用于中等/困难） ---
const fourStrongMasksCache = {};

function get4StrongMasks(minEmpty, maxEmpty, enforceMaxTwo) {
    const key = `${minEmpty}-${maxEmpty}-${enforceMaxTwo ? 1 : 0}`;
    if (fourStrongMasksCache[key]) return fourStrongMasksCache[key];

    const masks = [];
    const total = 16;

    for (let mask = 0; mask < (1 << total); mask++) {
        const emptyCount = countBits(mask);
        if (emptyCount < minEmpty || emptyCount > maxEmpty) continue;

        const rowEmpty = Array(4).fill(0);
        const colEmpty = Array(4).fill(0);
        const boxEmpty = Array(4).fill(0);

        for (let idx = 0; idx < total; idx++) {
            if ((mask & (1 << idx)) === 0) continue;
            const r = Math.floor(idx / 4);
            const c = idx % 4;
            rowEmpty[r]++;
            colEmpty[c]++;
            const boxIdx = Math.floor(r / 2) * 2 + Math.floor(c / 2);
            boxEmpty[boxIdx]++;
        }

        let valid = true;
        // 如果 enforceMaxTwo 为 true，则每行/列/宫 的已填数必须 <= 2
        if (enforceMaxTwo) {
            for (let i = 0; i < 4; i++) {
                if (rowEmpty[i] < 2) { valid = false; break; } // filled > 2
                if (colEmpty[i] < 2) { valid = false; break; }
                if (boxEmpty[i] < 2) { valid = false; break; }
            }
            if (!valid) continue;
        } else {
            // 默认强约束：仅禁止已填为4（即 empty === 0），允许 empty === 4（全空）
            for (let i = 0; i < 4; i++) {
                if (rowEmpty[i] === 0 || colEmpty[i] === 0) { valid = false; break; }
            }
            if (!valid) continue;
            for (let i = 0; i < 4; i++) {
                if (boxEmpty[i] === 0) { valid = false; break; }
            }
            if (!valid) continue;
        }

        const coords = [];
        for (let idx = 0; idx < total; idx++) {
            if ((mask & (1 << idx)) !== 0) {
                coords.push([Math.floor(idx / 4), idx % 4]);
            }
        }
        masks.push(coords);
    }

    fourStrongMasksCache[key] = masks;
    return masks;
}

function generate4StrongPuzzle(solvedBoard, difficulty) {
    // 中等：空格最多10个（<=10）; 困难：空格至少11个 (>=11)
    const maxEmpty = (difficulty === 'medium') ? 10 : 16;
    const minEmpty = (difficulty === 'hard') ? 11 : 0;

    // 对 medium / hard 启用 "每行/列/宫 已填 <= 2" 的约束
    const enforceMaxTwo = (difficulty === 'medium' || difficulty === 'hard');

    const masks = get4StrongMasks(minEmpty, maxEmpty, enforceMaxTwo);
    if (!masks || !masks.length) return JSON.parse(JSON.stringify(solvedBoard));

    const maxAttempts = 40;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const baseSolution = (attempt === 0) ? JSON.parse(JSON.stringify(solvedBoard)) : generateCompleteBoard(4);
        const shuffledMasks = masks.slice().sort(() => Math.random() - 0.5);
        for (const pattern of shuffledMasks) {
            const board = JSON.parse(JSON.stringify(baseSolution));
            for (const [r, c] of pattern) board[r][c] = 0;
            const sols = countSolutions(board, 4, 2);
            if (sols === 1) return board;
        }
    }

    // fallback: return first mask applied to original solvedBoard
    const pat = masks[0];
    const fallback = JSON.parse(JSON.stringify(solvedBoard));
    for (const [r, c] of pat) fallback[r][c] = 0;
    return fallback;
}

// --- 渲染与交互 ---

function initGame() {
    const size = parseInt(document.getElementById('size-select').value);
    const difficulty = document.getElementById('diff-select').value;
    currentSize = size;

    // 显示加载状态
    showLoading('正在生成题目...');

    // 使用 Web Worker 异步生成（如果可用）
    generatePuzzleAsync(size, difficulty, (error, data) => {
        if (error) {
            showToast('生成题目时出错，请重试', 'error');
            console.error('Error in initGame:', error);
            hideLoading();
            return;
        }

        const { solution, puzzle, info, elapsed } = data;
        currentSolution = solution;

        if (info && info.clues > 0) {
            console.log(`题目生成完成: ${info.clues} 个提示, 耗时 ${elapsed.toFixed(0)}ms`);
        }

        renderBoard(puzzle, size, 'board', true);
        // 重置历史记录并保存初始状态
        clearHistory();
        saveToHistory();
        // 保存游戏状态到 localStorage
        saveGameState();
        hideLoading();
    });
}

function renderBoard(grid, size, containerId, interactive) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';

    container.style.gridTemplateColumns = `repeat(${size}, 1fr)`;

    // 根据尺寸和交互模式选择单元格大小
    let cellSize;
    if (interactive) {
        cellSize = size === 9 ? CONFIG.CELL_SIZE.INTERACTIVE.SIZE_9 :
            (size === 4 ? CONFIG.CELL_SIZE.INTERACTIVE.SIZE_4 : CONFIG.CELL_SIZE.INTERACTIVE.SIZE_3);
    } else {
        cellSize = size === 9 ? CONFIG.CELL_SIZE.PRINT.SIZE_9 :
            (size === 4 ? CONFIG.CELL_SIZE.PRINT.SIZE_4 : CONFIG.CELL_SIZE.PRINT.SIZE_3);
    }

    // 根据尺寸选择宫格大小
    const boxSize = size === 9 ? CONFIG.BOX_SIZE.SIZE_9 :
        (size === 4 ? CONFIG.BOX_SIZE.SIZE_4 : CONFIG.BOX_SIZE.SIZE_3);
    let boxW = boxSize;
    let boxH = boxSize;

    for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
            const cell = document.createElement('div');
            cell.className = 'cell';
            if (size === 3 || size === 4) cell.classList.add(`size-${size}`);

            cell.style.width = cellSize;
            cell.style.height = cellSize;

            if (boxW > 0) {
                if ((c + 1) % boxW === 0 && c !== size - 1) cell.classList.add('thick-right');
                if ((r + 1) % boxH === 0 && r !== size - 1) cell.classList.add('thick-bottom');
            }

            const val = grid[r][c];
            if (val !== 0) {
                cell.classList.add('fixed');
                cell.innerText = val;
                cell.setAttribute('data-val', val);
            } else if (interactive) {
                const input = document.createElement('input');
                input.type = 'number';
                input.pattern = '[0-9]*';
                input.maxLength = 1;
                // 存储单元格索引用于实时验证
                const cellIndex = r * size + c;
                input.dataset.cellIndex = cellIndex;
                input.oninput = (e) => {
                    if (e.target.value.length > 1) e.target.value = e.target.value.slice(0, 1);
                    e.target.parentNode.classList.remove('invalid');
                    e.target.parentNode.classList.remove('hint-revealed');
                    // 实时冲突检测
                    const idx = parseInt(e.target.dataset.cellIndex, 10);
                    const val = e.target.value ? parseInt(e.target.value, 10) : 0;
                    validateCellRealtime(idx, val);
                    // 保存到历史记录
                    saveToHistory();
                    updateUndoRedoButtons();
                    // 自动保存游戏进度
                    saveGameState();
                    // 延迟检查完成状态
                    scheduleAutoCheck();
                };
                cell.appendChild(input);
            } else {
                cell.setAttribute('data-val', '');
            }
            container.appendChild(cell);
        }
    }
}

function checkGame() {
    const boardEl = document.getElementById('board');
    const cells = boardEl.children;
    if (!cells.length) return;

    const size = currentSize;
    const board = Array.from({ length: size }, () => Array(size).fill(0));
    const fixedMap = Array.from({ length: size }, () => Array(size).fill(false));
    const invalidPos = new Set();

    let index = 0;
    let allFilled = true;

    for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
            const cell = cells[index];
            if (cell.classList.contains('fixed')) {
                const fixedVal = parseInt(cell.getAttribute('data-val') || cell.innerText, 10);
                board[r][c] = fixedVal;
                fixedMap[r][c] = true;
            } else {
                const input = cell.querySelector('input');
                const val = parseInt(input.value, 10);
                if (Number.isNaN(val)) {
                    board[r][c] = 0;
                    allFilled = false;
                } else if (val < 1 || val > size) {
                    board[r][c] = 0;
                    invalidPos.add(`${r}-${c}`);
                    allFilled = false;
                } else {
                    board[r][c] = val;
                }
            }
            index++;
        }
    }

    const markDuplicates = (positions) => {
        for (const pos of positions) {
            const [r, c] = pos.split('-').map(Number);
            if (!fixedMap[r][c]) invalidPos.add(pos);
        }
    };

    // Row validation
    for (let r = 0; r < size; r++) {
        const map = {};
        for (let c = 0; c < size; c++) {
            const val = board[r][c];
            if (val === 0) continue;
            if (!map[val]) map[val] = [];
            map[val].push(`${r}-${c}`);
        }
        for (const key in map) {
            if (map[key].length > 1) markDuplicates(map[key]);
        }
    }

    // Column validation
    for (let c = 0; c < size; c++) {
        const map = {};
        for (let r = 0; r < size; r++) {
            const val = board[r][c];
            if (val === 0) continue;
            if (!map[val]) map[val] = [];
            map[val].push(`${r}-${c}`);
        }
        for (const key in map) {
            if (map[key].length > 1) markDuplicates(map[key]);
        }
    }

    // Box validation for 4x4 / 9x9
    if (size === 4 || size === 9) {
        const boxSize = size === 4 ? 2 : 3;
        for (let startR = 0; startR < size; startR += boxSize) {
            for (let startC = 0; startC < size; startC += boxSize) {
                const map = {};
                for (let r = startR; r < startR + boxSize; r++) {
                    for (let c = startC; c < startC + boxSize; c++) {
                        const val = board[r][c];
                        if (val === 0) continue;
                        if (!map[val]) map[val] = [];
                        map[val].push(`${r}-${c}`);
                    }
                }
                for (const key in map) {
                    if (map[key].length > 1) markDuplicates(map[key]);
                }
            }
        }
    }

    // Update UI
    index = 0;
    for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
            const cell = cells[index];
            if (!cell.classList.contains('fixed')) {
                if (invalidPos.has(`${r}-${c}`)) {
                    cell.classList.add('invalid');
                } else {
                    cell.classList.remove('invalid');
                }
            }
            index++;
        }
    }

    if (allFilled && invalidPos.size === 0) {
        showToast('🎉 恭喜!答案正确!', 'success', CONFIG.TOAST.DURATION_SUCCESS);
    }
}

// --- 打印逻辑 (穷举不重复版) ---

function handlePrint() {
    const size = parseInt(document.getElementById('size-select').value);
    const difficulty = document.getElementById('diff-select').value;
    const printSection = document.getElementById('print-section');
    printSection.innerHTML = '';

    // 显示加载状态
    const count = (size === 9) ? CONFIG.PRINT.COUNT_9x9 :
        (size === 4) ? CONFIG.PRINT.COUNT_4x4 : CONFIG.PRINT.COUNT_3x3;
    showLoading(`正在生成 ${count} 个题目，请稍候...`);

    // 渲染打印结果的函数
    const renderPrintResults = (puzzles) => {
        if (puzzles.length === 0) {
            showToast('生成题目失败,请重试', 'error');
            hideLoading();
            return;
        }

        let itemsPerPage;
        if (size === 3) itemsPerPage = CONFIG.PRINT.ITEMS_PER_PAGE.SIZE_3;
        if (size === 4) itemsPerPage = CONFIG.PRINT.ITEMS_PER_PAGE.SIZE_4;
        if (size === 9) itemsPerPage = CONFIG.PRINT.ITEMS_PER_PAGE.SIZE_9;

        const totalPages = Math.ceil(puzzles.length / itemsPerPage);

        for (let pageIdx = 0; pageIdx < totalPages; pageIdx++) {
            const page = document.createElement('div');
            page.className = 'print-page';

            if (size === 3) {
                page.style.gridTemplateColumns = '1fr 1fr 1fr 1fr';
                page.style.gap = '15px';
            } else if (size === 4) {
                page.style.gridTemplateColumns = '1fr 1fr 1fr';
                page.style.gap = '20px';
            } else if (size === 9) {
                page.style.gridTemplateColumns = '1fr 1fr';
                page.style.gap = '25px';
            }

            const startIdx = pageIdx * itemsPerPage;
            const endIdx = Math.min(startIdx + itemsPerPage, puzzles.length);

            for (let i = startIdx; i < endIdx; i++) {
                const wrapper = document.createElement('div');
                wrapper.className = 'print-item';

                const boardDiv = document.createElement('div');
                boardDiv.className = 'sudoku-board';
                boardDiv.id = `p-board-${i}`;
                wrapper.appendChild(boardDiv);

                page.appendChild(wrapper);
            }

            printSection.appendChild(page);
        }

        for (let i = 0; i < puzzles.length; i++) {
            renderBoard(puzzles[i], size, `p-board-${i}`, false);
        }

        hideLoading();
        showToast(`已生成 ${puzzles.length} 个不重复题目,共 ${totalPages} 页`, 'success', CONFIG.TOAST.DURATION_PRINT);
        setTimeout(() => window.print(), CONFIG.PRINT.PRINT_DELAY);
    };

    // 对于 9x9 使用 Worker 批量生成
    if (size === 9 && sudokuWorker && workerReady) {
        generateBatchAsync(size, difficulty, count, (error, data) => {
            if (error) {
                hideLoading();
                showToast('生成打印题目时出错，请重试', 'error');
                console.error('Error in handlePrint:', error);
                return;
            }
            console.log(`批量生成完成: ${data.count} 个题目, 耗时 ${data.elapsed.toFixed(0)}ms`);
            renderPrintResults(data.puzzles);
        });
    } else {
        // 对于 3x3/4x4 或 Worker 不可用时，使用同步生成
        setTimeout(() => {
            try {
                const solution = generateCompleteBoard(size);
                const puzzles = generateAllUniquePuzzles(solution, size, difficulty, count);
                renderPrintResults(puzzles);
            } catch (error) {
                hideLoading();
                showToast('生成打印题目时出错，请重试', 'error');
                console.error('Error in handlePrint:', error);
            }
        }, 100);
    }
}

// 生成所有本质不同的3x3 Latin Square
function generateAll3x3LatinSquares() {
    // 标准化的12种3x3 Latin Square
    return [
        [[1, 2, 3], [2, 3, 1], [3, 1, 2]],
        [[1, 2, 3], [3, 1, 2], [2, 3, 1]],
        [[1, 3, 2], [2, 1, 3], [3, 2, 1]],
        [[1, 3, 2], [3, 2, 1], [2, 1, 3]],
        [[2, 1, 3], [1, 3, 2], [3, 2, 1]],
        [[2, 1, 3], [3, 2, 1], [1, 3, 2]],
        [[2, 3, 1], [1, 2, 3], [3, 1, 2]],
        [[2, 3, 1], [3, 1, 2], [1, 2, 3]],
        [[3, 1, 2], [1, 2, 3], [2, 3, 1]],
        [[3, 1, 2], [2, 3, 1], [1, 2, 3]],
        [[3, 2, 1], [1, 3, 2], [2, 1, 3]],
        [[3, 2, 1], [2, 1, 3], [1, 3, 2]]
    ];
}

function generateAllUniquePuzzles(solution, size, difficulty, maxCount) {
    const puzzles = [];
    const seen = new Set();

    if (size === 3) {
        const holesPerLine = (difficulty === 'easy') ? 1 : (difficulty === 'medium' ? 2 : null);
        const isHard = (difficulty === 'hard');
        const isMedium = (difficulty === 'medium');

        const holePatterns = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]];
        const allCombos = (function () {
            const combos = [];
            for (let i = 0; i < 7; i++) for (let j = i + 1; j < 8; j++) for (let k = j + 1; k < 9; k++) combos.push([i, j, k]);
            return combos;
        })();
        const shuffledCombos = allCombos.slice().sort(() => Math.random() - 0.5);
        const allSquares = generateAll3x3LatinSquares();

        const processBoard = (board) => {
            if (isMedium || isHard) {
                const uniqueCount = getUniqueNonZeroCount(board);
                // medium: 要求剩余3格数字全不同 -> uniqueCount === 3
                if (isMedium && uniqueCount !== 3) return;
                // hard: 要求剩余3格数字既不全相同也不全不同 -> uniqueCount === 2
                if (isHard && uniqueCount !== 2) return;
            }
            const hash = getBoardHash(board);
            if (!seen.has(hash)) {
                seen.add(hash);
                puzzles.push(board);
            }
        };

        for (let square of allSquares) {
            if (puzzles.length >= maxCount) break;

            for (let pattern of holePatterns) {
                if (puzzles.length >= maxCount) break;

                let board = JSON.parse(JSON.stringify(square));

                if (holesPerLine === 1) {
                    for (let r = 0; r < 3; r++) {
                        board[r][pattern[r]] = 0;
                    }
                    processBoard(board);
                } else if (holesPerLine === 2) {
                    for (let r = 0; r < 3; r++) {
                        for (let c = 0; c < 3; c++) {
                            if (c !== pattern[r]) {
                                board[r][c] = 0;
                            }
                        }
                    }
                    processBoard(board);
                } else {
                    // hard: preserve exactly 3 cells anywhere (use combos)
                    for (const combo of shuffledCombos) {
                        let b = Array.from({ length: 3 }, () => Array(3).fill(0));
                        for (let idx = 0; idx < 9; idx++) {
                            const rr = Math.floor(idx / 3), cc = idx % 3;
                            if (combo.includes(idx)) b[rr][cc] = square[rr][cc];
                        }
                        processBoard(b);
                        if (puzzles.length >= maxCount) break;
                    }
                }
            }
        }

        if (puzzles.length < maxCount) {
            let attempts = 0;
            const maxAttempts = (maxCount - puzzles.length) * 10;

            while (puzzles.length < maxCount && attempts < maxAttempts) {
                const newSolution = generateCompleteBoard(3);

                if (holesPerLine === 1 || holesPerLine === 2) {
                    for (let pattern of holePatterns) {
                        if (puzzles.length >= maxCount) break;
                        let board = JSON.parse(JSON.stringify(newSolution));
                        if (holesPerLine === 1) {
                            for (let r = 0; r < 3; r++) board[r][pattern[r]] = 0;
                        } else {
                            for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) if (c !== pattern[r]) board[r][c] = 0;
                        }
                        processBoard(board);
                    }
                } else {
                    // hard: try all 3-cell combos
                    for (const combo of shuffledCombos) {
                        if (puzzles.length >= maxCount) break;
                        let b = Array.from({ length: 3 }, () => Array(3).fill(0));
                        for (let idx = 0; idx < 9; idx++) {
                            const rr = Math.floor(idx / 3), cc = idx % 3;
                            if (combo.includes(idx)) b[rr][cc] = newSolution[rr][cc];
                        }
                        processBoard(b);
                    }
                }
                attempts++;
            }
        }
    }
    else if (size === 4 || size === 9) {
        let attempts = maxCount * 50;

        while (puzzles.length < maxCount && attempts > 0) {
            const puzzle = createPuzzle(solution, size, difficulty);
            // for 9x9 ensure puzzle has unique solution before accepting
            if (size === 9) {
                const sols = countSolutions(puzzle, 9, 2);
                if (sols !== 1) { attempts--; continue; }
            }
            const hash = getBoardHash(puzzle);

            if (!seen.has(hash)) {
                seen.add(hash);
                puzzles.push(puzzle);
            }
            attempts--;
        }

        if (puzzles.length < 20 && attempts === 0) {
            console.warn('题目生成较少,可能存在重复模式');
        }
    }

    // 如果为 3x3 的 hard 模式仍未生成题目，使用随机化回退搜索以提高命中率
    if (size === 3 && difficulty === 'hard' && puzzles.length === 0) {
        const combos = (function () { const c = []; for (let i = 0; i < 7; i++) for (let j = i + 1; j < 8; j++) for (let k = j + 1; k < 9; k++) c.push([i, j, k]); return c; })();
        let attempts = 0;
        const maxAttempts = 2000;
        while (puzzles.length < Math.min(maxCount, 30) && attempts < maxAttempts) {
            const sol = generateCompleteBoard(3);
            const combo = combos[Math.floor(Math.random() * combos.length)];
            let b = Array.from({ length: 3 }, () => Array(3).fill(0));
            for (let idx = 0; idx < 9; idx++) {
                const rr = Math.floor(idx / 3), cc = idx % 3;
                if (combo.includes(idx)) b[rr][cc] = sol[rr][cc];
            }
            if (getUniqueNonZeroCount(b) === 2) {
                const hash = getBoardHash(b);
                if (!seen.has(hash)) { seen.add(hash); puzzles.push(b); }
            }
            attempts++;
        }
    }

    return puzzles;
}

function getBoardHash(board) {
    return board.map(row => row.join(',')).join(';');
}

function getUniqueNonZeroCount(board) {
    const set = new Set();
    for (let r = 0; r < board.length; r++) {
        for (let c = 0; c < board[r].length; c++) {
            const val = board[r][c];
            if (val !== 0) set.add(val);
        }
    }
    return set.size;
}

initGame();
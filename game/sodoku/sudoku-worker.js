// sudoku-worker.js - Web Worker for background puzzle generation

// ===== 配置常量 =====
const CONFIG = {
    PUZZLE_GENERATION: {
        SIZE_3: {
            SHUFFLE_ITERATIONS: 10
        },
        SIZE_9: {
            MAX_ATTEMPTS: 50,
            SYMMETRIC_DIGGING: true,
            MIN_CLUES_EASY: 36,
            MIN_CLUES_MEDIUM: 28,
            MIN_CLUES_HARD: 22
        },
        SOLUTION_LIMIT: 2
    }
};

// ===== 核心算法 =====

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

// 位运算加速的唯一性检测
function countSolutionsFast(board, limit = 2) {
    const size = 9;
    let count = 0;

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
            if ((used & (1 << num)) === 0) candidates.push(num);
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
        if (!cell) { count++; return; }
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

// 优化的 9x9 生成
function generate9x9PuzzleOptimized(solvedBoard, difficulty) {
    const size = 9;
    const config = CONFIG.PUZZLE_GENERATION.SIZE_9;

    let targetClues;
    switch (difficulty) {
        case 'easy': targetClues = config.MIN_CLUES_EASY; break;
        case 'medium': targetClues = config.MIN_CLUES_MEDIUM; break;
        case 'hard': targetClues = config.MIN_CLUES_HARD; break;
        default: targetClues = config.MIN_CLUES_MEDIUM;
    }

    const maxAttempts = config.MAX_ATTEMPTS;
    let bestBoard = null;
    let bestClues = 81;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const board = JSON.parse(JSON.stringify(solvedBoard));
        let currentClues = 81;

        // 对称挖空
        const positions = [];
        const used = new Set();
        positions.push([4, 4]);
        used.add('4-4');

        const pairs = [];
        for (let r = 0; r < size; r++) {
            for (let c = 0; c < size; c++) {
                if (used.has(`${r}-${c}`)) continue;
                const symR = 8 - r, symC = 8 - c;
                if (r === symR && c === symC) {
                    positions.push([r, c]);
                } else if (!used.has(`${symR}-${symC}`)) {
                    pairs.push([[r, c], [symR, symC]]);
                    used.add(`${r}-${c}`);
                    used.add(`${symR}-${symC}`);
                }
            }
        }
        pairs.sort(() => Math.random() - 0.5);
        for (const pair of pairs) positions.push(pair[0], pair[1]);

        for (const [r, c] of positions) {
            if (currentClues <= targetClues) break;
            if (board[r][c] === 0) continue;

            const backup = board[r][c];
            board[r][c] = 0;

            const symR = 8 - r, symC = 8 - c;
            let symBackup = 0;
            if ((r !== symR || c !== symC) && board[symR][symC] !== 0) {
                symBackup = board[symR][symC];
                board[symR][symC] = 0;
            }

            const solutions = countSolutionsFast(board, 2);
            if (solutions === 1) {
                currentClues = symBackup ? currentClues - 2 : currentClues - 1;
            } else {
                board[r][c] = backup;
                if (symBackup) board[symR][symC] = symBackup;
            }
        }

        if (currentClues <= targetClues + 5) {
            const finalCheck = countSolutionsFast(board, 2);
            if (finalCheck === 1) {
                return { board, clues: currentClues, attempt: attempt + 1 };
            }
        }

        if (currentClues < bestClues) {
            bestBoard = JSON.parse(JSON.stringify(board));
            bestClues = currentClues;
        }
    }

    if (bestBoard) {
        const check = countSolutionsFast(bestBoard, 2);
        if (check === 1) return { board: bestBoard, clues: bestClues, attempt: maxAttempts };
    }

    return { board: generate9x9Fallback(solvedBoard, difficulty), clues: -1, attempt: maxAttempts };
}

function generate9x9Fallback(solvedBoard, difficulty) {
    const size = 9;
    let holesPerLine = difficulty === 'easy' ? 3 : 5;

    for (let attempt = 0; attempt < 20; attempt++) {
        const board = JSON.parse(JSON.stringify(solvedBoard));
        const toRemove = new Set();

        for (let r = 0; r < size; r++) {
            const cols = Array.from({ length: size }, (_, i) => i).sort(() => Math.random() - 0.5);
            for (let i = 0; i < holesPerLine; i++) toRemove.add(`${r}-${cols[i]}`);
        }

        for (let c = 0; c < size; c++) {
            let colHoles = 0;
            for (let r = 0; r < size; r++) if (toRemove.has(`${r}-${c}`)) colHoles++;
            while (colHoles < holesPerLine) {
                const r = Math.floor(Math.random() * size);
                if (!toRemove.has(`${r}-${c}`)) { toRemove.add(`${r}-${c}`); colHoles++; }
            }
        }

        for (const key of toRemove) {
            const [r, c] = key.split('-').map(Number);
            board[r][c] = 0;
        }

        if (countSolutionsFast(board, 2) === 1) return board;
    }

    const board = JSON.parse(JSON.stringify(solvedBoard));
    for (let r = 0; r < size; r++) for (let c = 0; c < 3; c++) board[r][c] = 0;
    return board;
}

// 简单的 3x3/4x4 生成（主要用于批量打印）
function createSimplePuzzle(solvedBoard, size, difficulty) {
    if (size === 9) {
        const result = generate9x9PuzzleOptimized(solvedBoard, difficulty);
        return result.board;
    }
    // 3x3 和 4x4 直接返回（比较简单，不需要后台处理）
    return solvedBoard;
}

// ===== Worker 消息处理 =====

self.onmessage = function (e) {
    const { type, data, id } = e.data;

    switch (type) {
        case 'generatePuzzle': {
            const { size, difficulty } = data;
            const startTime = performance.now();

            try {
                const solution = generateCompleteBoard(size);
                let puzzle, info;

                if (size === 9) {
                    const result = generate9x9PuzzleOptimized(solution, difficulty);
                    puzzle = result.board;
                    info = { clues: result.clues, attempt: result.attempt };
                } else {
                    puzzle = createSimplePuzzle(solution, size, difficulty);
                    info = { clues: -1, attempt: 1 };
                }

                const elapsed = performance.now() - startTime;

                self.postMessage({
                    type: 'puzzleGenerated',
                    id,
                    data: { solution, puzzle, info, elapsed }
                });
            } catch (error) {
                self.postMessage({
                    type: 'error',
                    id,
                    data: { message: error.message }
                });
            }
            break;
        }

        case 'generateBatch': {
            const { size, difficulty, count } = data;
            const startTime = performance.now();
            const puzzles = [];

            try {
                for (let i = 0; i < count; i++) {
                    const solution = generateCompleteBoard(size);
                    let puzzle;

                    if (size === 9) {
                        const result = generate9x9PuzzleOptimized(solution, difficulty);
                        puzzle = result.board;
                    } else {
                        puzzle = createSimplePuzzle(solution, size, difficulty);
                    }

                    puzzles.push(puzzle);

                    // 发送进度更新
                    if ((i + 1) % 5 === 0 || i === count - 1) {
                        self.postMessage({
                            type: 'batchProgress',
                            id,
                            data: { current: i + 1, total: count }
                        });
                    }
                }

                const elapsed = performance.now() - startTime;

                self.postMessage({
                    type: 'batchGenerated',
                    id,
                    data: { puzzles, elapsed, count: puzzles.length }
                });
            } catch (error) {
                self.postMessage({
                    type: 'error',
                    id,
                    data: { message: error.message }
                });
            }
            break;
        }

        default:
            self.postMessage({
                type: 'error',
                id,
                data: { message: 'Unknown message type: ' + type }
            });
    }
};

// 通知主线程 Worker 已准备就绪
self.postMessage({ type: 'ready' });

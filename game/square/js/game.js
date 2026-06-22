// 游戏控制器（H5 版）：全局 state + setData + 事件处理 + 回合流程 + 浮层 + 启动
// 由 index.js 的 Page({}) 移植而来：this.data -> state，this.setData -> setData，wx.* -> platform。

let state = {};  // 延迟初始化：等待所有常量加载完毕后，在 init() 中再赋值

function setData(partial) {
    Object.assign(state, partial);
    renderAll();
}

function showMessage(message, duration = 1500) {
    toast(message, duration);
}

// ---------------- 开局 / 重开 / 计时 ----------------
function startGame() {
    if (state.timer) clearInterval(state.timer);

    const updateData = {
        board: deepCopy(INITIAL_BOARD),
        currentPlayer: 0,
        dragPiece: null,
        blackCount: 0,
        whiteCount: 0,
        extraMoves: 0,
        gamePhase: GAME_PHASES.PLACING,
        isGameStarted: true,
        isGameOver: false,
        message: '',
        elapsedTime: '00:00',
        isExchangeRemoving: false,
        lastTapTime: null,
        blackLastMovedPiece: null,
        whiteLastMovedPiece: null,
        lastActionResult: null,
        isAnimationInProgress: false,
        flashPiece: { row: null, col: null },
        boardRectCache: null
    };

    const timer = setInterval(updateElapsedTime, 1000);
    updateData.timer = timer;

    if (state.isDebug) {
        const userMessage = saveUserMessageToHistory("placing", "black", GAMEHISTORY, '', updateData.board);
        updateData.gameHistory = userMessage.gameHistory;
    }

    setData(updateData);

    handleAITurn(GAME_PHASES.PLACING, PLAYERS[state.currentPlayer]);
    showMessage("开局布子");
}

function updateElapsedTime() {
    const [minutes, seconds] = (state.elapsedTime || '00:00').split(':').map(Number);
    let newSeconds = seconds + 1;
    let newMinutes = minutes;
    if (newSeconds >= 60) {
        newSeconds = 0;
        newMinutes += 1;
    }
    const formatted = `${String(newMinutes).padStart(2, '0')}:${String(newSeconds).padStart(2, '0')}`;
    setData({ elapsedTime: formatted });
}

function restartGame() {
    if (state.timer) clearInterval(state.timer);
    startGame();
}

// ---------------- 胜负判断（精简：无战绩/成就） ----------------
async function checkGameOver() {
    const currentColor = state.players[state.currentPlayer];
    const opponentColor = currentColor === 'black' ? 'white' : 'black';
    const opponent = currentColor === 'black' ? '白方' : '黑方';
    const player = currentColor === 'black' ? '黑方' : '白方';

    const conditions = [
        { check: () => state[`${currentColor}Count`] < NUMBERS.MIN_PIECES_TO_WIN, winner: opponent },
        { check: () => state.extraMoves > 0 && state.extraMoves + NUMBERS.MIN_PIECES_TO_WIN > state[`${opponentColor}Count`], winner: player },
        { check: () => state.gamePhase === GAME_PHASES.MOVING && !hasValidMoves(currentColor, state.board), winner: opponent }
    ];

    for (const { check, winner } of conditions) {
        if (check()) {
            if (state.timer) clearInterval(state.timer);
            setData({ isGameOver: true, isGameStarted: false, timer: null, gameHistory: [] });
            showGameOver(`游戏结束，获胜方: ${winner}`);
            return winner;
        }
    }
    return null;
}

function showGameOver(message) {
    showModal({ title: message, confirmText: '重新开始', showCancel: false }).then(() => restartGame());
}

// ---------------- 手动下棋 ----------------
function handleDragStart(row, col, color) {
    if (state.gamePhase !== GAME_PHASES.MOVING) return;
    const currentColor = state.players[state.currentPlayer];
    if (color !== currentColor) {
        showMessage('只能移动己方棋子');
        return;
    }
    if (state.playerConfig[currentColor].playerType !== 'self') return;
    setData({ dragPiece: { color, startRow: row, startCol: col } });
}

function handleTouchEnd(e) {
    console.log('=== handleTouchEnd 触发 ===');
    console.log('游戏已开始:', state.isGameStarted);
    console.log('当前阶段:', state.gamePhase);
    console.log('动画进行中:', state.isAnimationInProgress);

    if (!state.isGameStarted) return;
    if (state.isAnimationInProgress) {
        showMessage('动画未结束，请稍后再试');
        return;
    }
    if (state.gamePhase === GAME_PHASES.MOVING && !state.dragPiece) {
        showMessage('请选中要移动的棋子拖动');
        return;
    }

    const position = getBoardPosition(e);
    if (!position) return;
    const { boardX, boardY, boardRect } = position;

    const cellSize = boardRect.width / 5; // 棋盘总宽度除以5个格子
    const pieceRadius = cellSize * 0.32;  // 容差，随棋盘尺寸缩放

    const minX = -pieceRadius;
    const maxX = boardRect.width + pieceRadius;
    const minY = -pieceRadius;
    const maxY = boardRect.height + pieceRadius;
    if (boardX < minX || boardX > maxX || boardY < minY || boardY > maxY) return;

    let targetCol = Math.round(boardX / cellSize);
    let targetRow = Math.round(boardY / cellSize);
    targetCol = Math.max(0, Math.min(5, targetCol));
    targetRow = Math.max(0, Math.min(5, targetRow));

    console.log('点击位置:', { targetRow, targetCol });

    const clickX = targetCol * cellSize;
    const clickY = targetRow * cellSize;
    const tolerance = pieceRadius;
    if (Math.abs(boardX - clickX) > tolerance || Math.abs(boardY - clickY) > tolerance) {
        console.log('点击位置超出容差范围');
        return;
    }

    const currentColor = state.players[state.currentPlayer];
    console.log('当前玩家颜色:', currentColor);
    console.log('玩家类型:', state.playerConfig[currentColor].playerType);

    if (state.playerConfig[currentColor].playerType !== 'self') {
        console.log('不是玩家自己操作，忽略');
        return;
    }

    const targetPosition = { targetRow, targetCol };
    console.log('进入 switch，阶段:', state.gamePhase);

    switch (state.gamePhase) {
        case GAME_PHASES.PLACING:
            console.log('→ 执行 handlePlace');
            handlePlace(currentColor, targetPosition);
            break;
        case GAME_PHASES.MOVING: {
            console.log('→ 执行 handleMove');
            const { startRow, startCol } = state.dragPiece;
            handleMove(currentColor, { startRow, startCol, targetRow, targetCol });
            break;
        }
        case GAME_PHASES.REMOVING:
            console.log('→ 执行 handleRemove');
            handleRemove(currentColor, targetPosition);
            break;
        default:
            console.log('→ 未知阶段');
            showMessage('当前阶段不支持此操作');
            break;
    }
}

function getBoardPosition(e) {
    let rect = state.boardRectCache;
    if (!rect) {
        rect = els.board.getBoundingClientRect();
        state.boardRectCache = rect; // 直接缓存，无需触发渲染
    }
    return {
        boardX: e.clientX - rect.left,
        boardY: e.clientY - rect.top,
        boardRect: rect
    };
}

function handlePlace(currentColor, targetPosition) {
    if (!validatePosition(targetPosition, state.gamePhase, currentColor, state.board)) {
        showMessage(`${currentColor === 'black' ? '黑方' : '白方'}上次放置的位置无效，请重新选择`);
        return;
    }
    handlePlaceDrop(currentColor, targetPosition);
}

function handlePlaceDrop(currentColor, targetPosition) {
    const { targetRow, targetCol } = targetPosition;
    const newBoard = updateBoard(currentColor, null, null, targetRow, targetCol, state.board);
    const formationUpdate = checkFormation(targetRow, targetCol, currentColor, newBoard);

    let updateData = {
        board: newBoard,
        [`${currentColor}Count`]: state[`${currentColor}Count`] + 1,
    };

    if (formationUpdate) {
        formationUpdate.formationPositions.forEach(pos => {
            if (newBoard[pos.row] && newBoard[pos.row][pos.col] && newBoard[pos.row][pos.col].isFormation === false) {
                newBoard[pos.row][pos.col].isFormation = true;
            }
        });
        showMessage('形成了' + formationUpdate.formationType);
        Object.assign(updateData, formationUpdate);
        updateData.lastActionResult = `你上次落子的位置[${targetRow},${targetCol}]形成了'${formationUpdate.formationType}'阵型，获得了${formationUpdate.extraMoves}次额外落子机会。`;
    }

    if (isBoardWillFull(state.blackCount, state.whiteCount)) {
        Object.assign(updateData, {
            extraMoves: 1,
            message: `请移除${state.currentPlayer === 1 ? '黑方' : '白方'}棋子`,
            isExchangeRemoving: true
        });
    } else if (state.extraMoves > 0) {
        updateData.extraMoves = state.extraMoves - 1;
        if (updateData.extraMoves === 0) updateData.currentPlayer = 1 - state.currentPlayer;
    } else if (!formationUpdate) {
        updateData.currentPlayer = 1 - state.currentPlayer;
    }

    updateData.flashPiece = { row: targetRow, col: targetCol };
    updateData.isAnimationInProgress = true;

    if (state.isDebug) {
        const decision = { action: GAME_PHASES.PLACING, position: [targetRow, targetCol] };
        updateData.gameHistory = [...state.gameHistory, { role: "assistant", content: JSON.stringify(decision) }];
    }

    setData(updateData);
}

function handleMove(color, movePositions) {
    if (!validatePosition(movePositions, state.gamePhase, color, state.board)) return;
    handleMoveDrop(color, movePositions);
}

function handleMoveDrop(color, movePositions) {
    const { startRow, startCol, targetRow, targetCol } = movePositions;
    const newBoard = updateBoard(color, startRow, startCol, targetRow, targetCol, state.board);
    const formationUpdate = checkFormation(targetRow, targetCol, color, newBoard);

    let updateData = { board: newBoard };

    const formationUpdateDestroy = checkFormation(startRow, startCol, color, state.board);
    if (formationUpdateDestroy && Array.isArray(formationUpdateDestroy.formationPositions)) {
        formationUpdateDestroy.formationPositions.forEach(pos => {
            if (newBoard[pos.row][pos.col]) {
                const still = isStillInFormation(pos.row, pos.col, color, newBoard);
                if (!still) newBoard[pos.row][pos.col].isFormation = false;
            }
        });
    }

    if (formationUpdate) {
        formationUpdate.formationPositions.forEach(pos => {
            if (newBoard[pos.row] && newBoard[pos.row][pos.col] && newBoard[pos.row][pos.col].isFormation === false) {
                newBoard[pos.row][pos.col].isFormation = true;
            }
        });
        showMessage('形成' + formationUpdate.formationType);
        Object.assign(updateData, formationUpdate);
        updateData.lastActionResult = `你上次移动到的位置[${targetRow},${targetCol}]形成了'${formationUpdate.formationType}'阵型，获得了${formationUpdate.extraMoves}次吃子机会。`;
        updateData.message = `请移除${state.currentPlayer === 1 ? '黑方' : '白方'}棋子`;
    } else {
        updateData.currentPlayer = 1 - state.currentPlayer;
        updateData.message = `请${state.currentPlayer === 1 ? '黑方' : '白方'}移动棋子`;
        updateData.extraMoves = 0;
    }

    const historyKey = color === 'black' ? 'blackLastMovedPiece' : 'whiteLastMovedPiece';
    updateData[historyKey] = { startRow, startCol, targetRow, targetCol };

    updateData.flashPiece = { row: targetRow, col: targetCol };
    updateData.isAnimationInProgress = true;
    updateData.dragPiece = null;

    if (state.isDebug) {
        const decision = { action: GAME_PHASES.MOVING, position: [startRow, startCol], newPosition: [targetRow, targetCol] };
        const currentHistory = Array.isArray(state.gameHistory) ? state.gameHistory : [];
        updateData.gameHistory = [...currentHistory, { role: "assistant", content: JSON.stringify(decision) }];
    }

    setData(updateData);
}

function handleRemove(currentColor, targetPosition) {
    const now = Date.now();
    const lastTap = state.lastTapTime;
    const diff = lastTap ? now - lastTap : null;

    console.log('=== handleRemove 调用 ===');
    console.log('当前颜色:', currentColor);
    console.log('目标位置:', targetPosition);
    console.log('lastTapTime:', lastTap);
    console.log('时间差:', diff ? diff + 'ms' : 'null');

    if (!state.lastTapTime) {
        // 第一次点击：静默等待，启动定时器
        state.lastTapTime = Date.now();
        console.log('→ 第一次点击，启动1500ms定时器');

        // 1500ms后如果还没点第二次，则提示并重置
        state.removeTapTimer = setTimeout(() => {
            if (state.lastTapTime) {
                console.log('→ 定时器到期，提示用户点击第二次');
                showMessage('请再点击一次移除对方的棋子');
                state.lastTapTime = null;
            }
        }, 1500);
    } else if (Date.now() - state.lastTapTime < 1500) {
        // 第二次点击：取消定时器，执行移除
        console.log('→ 第二次点击，取消定时器');
        if (state.removeTapTimer) {
            clearTimeout(state.removeTapTimer);
            state.removeTapTimer = null;
        }

        if (!validatePosition(targetPosition, state.gamePhase, currentColor, state.board)) {
            console.log('→ 验证失败，位置无效');
            showMessage('该位置无效，有更优先的棋子可移除，请重新选择');
            state.lastTapTime = null;
            return;
        }
        console.log('→ 验证成功，执行移除');
        handleRemovePhase(targetPosition);
        state.lastTapTime = null;
    } else {
        // 超时后的新点击：视为新的第一次点击
        console.log('→ 超时，视为新的第一次点击');
        state.lastTapTime = Date.now();

        if (state.removeTapTimer) {
            clearTimeout(state.removeTapTimer);
        }
        state.removeTapTimer = setTimeout(() => {
            if (state.lastTapTime) {
                console.log('→ 定时器到期，提示用户点击第二次');
                showMessage('请再点击一次移除对方的棋子');
                state.lastTapTime = null;
            }
        }, 1500);
    }
}

function handleRemovePhase(targetPosition) {
    setData({
        flashPiece: { row: targetPosition.targetRow, col: targetPosition.targetCol },
        isAnimationInProgress: true
    });
}

async function onAnimationEnd(e) {
    // 仅处理棋子的 flash 动画结束（事件委托在 .board 上）
    if (!e.target || !e.target.classList || !e.target.classList.contains('piece')) return;

    let updateData = { flashPiece: { row: null, col: null }, isAnimationInProgress: false };

    if (state.gamePhase === GAME_PHASES.MOVING) {
        const winner = await checkGameOver();
        if (winner) return;
        updateData.gamePhase = state.extraMoves > 0 ? GAME_PHASES.REMOVING : GAME_PHASES.MOVING;
        if (state.isDebug) {
            const userMessage = saveUserMessageToHistory(updateData.gamePhase, state.players[state.currentPlayer], state.gameHistory, state.lastActionResult, state.board);
            updateData.gameHistory = userMessage.gameHistory;
        }
        updateData.lastActionResult = null;
        setData(updateData);
        handleAITurn(state.gamePhase, state.players[state.currentPlayer]);
    } else if (state.gamePhase === GAME_PHASES.PLACING) {
        if (isMaxPiecesCount(state.blackCount, state.whiteCount)) {
            showMessage("棋盘已满，开始提子！");
            updateData.gamePhase = GAME_PHASES.REMOVING;
        } else {
            updateData.gamePhase = GAME_PHASES.PLACING;
        }
        if (state.isDebug) {
            const userMessage = saveUserMessageToHistory(updateData.gamePhase, state.players[state.currentPlayer], state.gameHistory, state.lastActionResult, state.board);
            updateData.gameHistory = userMessage.gameHistory;
        }
        updateData.lastActionResult = null;
        setData(updateData);
        handleAITurn(state.gamePhase, state.players[state.currentPlayer]);
    } else {
        // removing：被移除的棋子动画结束
        const row = Number(e.target.dataset.row);
        const col = Number(e.target.dataset.col);
        const color = e.target.dataset.color;
        handleAfterRemove(row, col, color);
    }
}

async function handleAfterRemove(row, col, color) {
    let newBoard = updateBoard(null, row, col, null, null, state.board);

    let updateData = {
        board: newBoard,
        flashPiece: { row: null, col: null },
        [`${color}Count`]: state[`${color}Count`] - 1,
        isAnimationInProgress: false
    };

    const formationUpdateDestroy = checkFormation(row, col, color, state.board);
    if (formationUpdateDestroy && formationUpdateDestroy.formationPositions) {
        formationUpdateDestroy.formationPositions.forEach(pos => {
            if (newBoard[pos.row][pos.col]) {
                const still = isStillInFormation(pos.row, pos.col, color, newBoard);
                if (!still) newBoard[pos.row][pos.col].isFormation = false;
            }
        });
    }

    if (!state.isExchangeRemoving) {
        if (state.extraMoves === 1) {
            updateData = {
                ...updateData,
                currentPlayer: 1 - state.currentPlayer,
                gamePhase: GAME_PHASES.MOVING,
                message: `请${state.currentPlayer === 1 ? '黑方' : '白方'}移动棋子`,
                extraMoves: state.extraMoves - 1
            };
        } else {
            updateData = {
                ...updateData,
                message: `请继续移除${state.currentPlayer === 1 ? '黑方' : '白方'}棋子`,
                extraMoves: state.extraMoves - 1
            };
        }
    } else {
        updateData = {
            ...updateData,
            isExchangeRemoving: false,
            currentPlayer: 1 - state.currentPlayer,
            extraMoves: 1,
            message: `请移除${state.currentPlayer === 0 ? '黑方' : '白方'}棋子`,
        };
    }

    if (state.isDebug) {
        const decision = { action: GAME_PHASES.REMOVING, position: [row, col] };
        updateData.gameHistory = [...state.gameHistory, { role: "assistant", content: JSON.stringify(decision) }];
    }

    setData(updateData);

    const winner = await checkGameOver();
    if (winner) return;

    if (state.isDebug) {
        const userMessage = saveUserMessageToHistory(state.gamePhase, state.players[state.currentPlayer], state.gameHistory, '', state.board);
        setData({ gameHistory: userMessage.gameHistory });
    }

    handleAITurn(state.gamePhase, state.players[state.currentPlayer]);
}

// ---------------- AI 处理 ----------------
function processAIDecision(phase, aicolor, decision) {
    if (phase === GAME_PHASES.PLACING) {
        handlePlaceDrop(aicolor, { targetRow: decision.position[0], targetCol: decision.position[1] });
    } else if (phase === GAME_PHASES.REMOVING) {
        setFlashPiece(decision.position[0], decision.position[1]);
    } else if (phase === GAME_PHASES.MOVING) {
        handleMoveDrop(aicolor, {
            startRow: decision.position[0],
            startCol: decision.position[1],
            targetRow: decision.newPosition[0],
            targetCol: decision.newPosition[1]
        });
    }
}

function setFlashPiece(row, col) {
    setData({ flashPiece: { row, col }, isAnimationInProgress: true });
}

// ---------------- 悔棋 ----------------
function undoMove(color) {
    if (!state.gameHistory || state.gameHistory.length < 2) {
        toast('没有足够的操作可以撤销');
        return;
    }

    let newBoard = state.board;
    let updateData = {};
    updateData.gameHistory = deepCopy(state.gameHistory);

    for (let i = state.gameHistory.length - 1; i >= 0; i--) {
        const record = state.gameHistory[i];
        if (record.role === "assistant") {
            const userMessage = state.gameHistory[i - 1];
            const match = userMessage && userMessage.content.match(/你的棋子颜色:\s*(\w+)/);
            const playerColor = match ? match[1] : null;
            const assistantAction = JSON.parse(record.content);
            revertAction(assistantAction, newBoard, updateData, playerColor);
        }
        if (record.role === "user" && record.content.includes(`你的棋子颜色: ${color}`) && i < state.gameHistory.length - 1) {
            break;
        }
        updateData.gameHistory.pop();
    }

    updateData.board = newBoard;
    updateData.currentPlayer = state.players.indexOf(color);

    setData(updateData);
    toast(`${color === 'black' ? '黑方' : '白方'}悔棋成功`);
}

function revertAction(assistantAction, board, updateData, playerColor) {
    const { action, position, newPosition } = assistantAction;

    if (action === GAME_PHASES.PLACING) {
        const [row, col] = position;
        const color = board[row][col].color;
        board[row][col] = null;
        updateData[`${color}Count`] = (updateData[`${color}Count`] || state[`${color}Count`]) - 1;
    } else if (action === GAME_PHASES.MOVING) {
        const [startRow, startCol] = position;
        const [targetRow, targetCol] = newPosition;
        board[startRow][startCol] = board[targetRow][targetCol];
        board[targetRow][targetCol] = null;
    } else if (action === GAME_PHASES.REMOVING) {
        const [row, col] = position;
        const targetPosition = { targetRow: row, targetCol: col };
        const opponentColor = playerColor === 'black' ? 'white' : 'black';
        handlePlaceDrop(opponentColor, targetPosition);
        updateData[`${opponentColor}Count`] = (updateData[`${opponentColor}Count`] || state[`${opponentColor}Count`]) + 1;
    }
}

// ---------------- 浮层：规则 / 设置 ----------------
function openRules() { els.rulesOverlay.style.display = 'flex'; }
function closeRules() { els.rulesOverlay.style.display = 'none'; }

function openSettings(color) {
    state.settingsColor = color;
    const cfg = loadPlayerConfig()[color];
    els.settingsTitle.textContent = color === 'black' ? '黑方设置' : '白方设置';
    els.ptSelf.checked = cfg.playerType === 'self';
    els.ptLocal.checked = cfg.playerType !== 'self';
    const diff = cfg.difficulty || 'easy';
    els.diffEasy.checked = diff === 'easy';
    els.diffMedium.checked = diff === 'medium';
    els.diffHard.checked = diff === 'hard';
    updateSettingsVisibility();
    els.settingsOverlay.style.display = 'flex';
}

function updateSettingsVisibility() {
    els.difficultyGroup.style.display = els.ptLocal.checked ? '' : 'none';
}

function closeSettings() { els.settingsOverlay.style.display = 'none'; }

function saveSettings() {
    const color = state.settingsColor;
    const playerType = els.ptSelf.checked ? 'self' : 'local';
    const difficulty = els.diffEasy.checked ? 'easy' : (els.diffMedium.checked ? 'medium' : 'hard');
    updatePlayerConfig(color, { playerType, difficulty, aiConfig: { url: '', model: '', apiKey: '' } });
    setData({ playerConfig: loadPlayerConfig() });
    closeSettings();

    // 若设置后正好轮到本机一方且处于空闲，触发其行动
    if (state.isGameStarted && !state.isGameOver && !state.isAnimationInProgress) {
        const currentColor = state.players[state.currentPlayer];
        if (state.playerConfig[currentColor].playerType === 'local') {
            handleAITurn(state.gamePhase, currentColor);
        }
    }
}

// ---------------- 事件绑定 / 启动 ----------------
function onActionBtn(color) {
    const btn = color === 'black' ? els.blackActionBtn : els.whiteActionBtn;
    if (btn.dataset.role === 'undo') undoMove(color);
    else openSettings(color);
}

function onBoardPointerDown(e) {
    const t = e.target;
    if (t && t.classList && t.classList.contains('piece')) {
        handleDragStart(Number(t.dataset.row), Number(t.dataset.col), t.dataset.color);
    }
}

function wireEvents() {
    els.board.addEventListener('pointerdown', onBoardPointerDown);
    els.board.addEventListener('pointerup', handleTouchEnd);
    els.board.addEventListener('animationend', onAnimationEnd);

    els.startButton.addEventListener('click', () => state.isGameOver ? restartGame() : startGame());
    els.restartButton.addEventListener('click', restartGame);

    els.rulesButton.addEventListener('click', openRules);
    els.rulesClose.addEventListener('click', closeRules);

    els.blackSettingBtn.addEventListener('click', () => openSettings('black'));
    els.whiteSettingBtn.addEventListener('click', () => openSettings('white'));
    els.blackActionBtn.addEventListener('click', () => onActionBtn('black'));
    els.whiteActionBtn.addEventListener('click', () => onActionBtn('white'));

    els.settingsSave.addEventListener('click', saveSettings);
    els.settingsClose.addEventListener('click', closeSettings);
    els.ptSelf.addEventListener('change', updateSettingsVisibility);
    els.ptLocal.addEventListener('change', updateSettingsVisibility);

    window.addEventListener('resize', () => { state.boardRectCache = null; });
}

function init() {
    // 初始化 state 对象（延迟到此处，确保所有常量都已加载）
    state = {
        players: PLAYERS,
        message: INIT_MESG,
        gameHistory: [],
        isDebug: true,
        isGameStarted: false,
        isGameOver: false,
        boardRectCache: null,
        board: null,
        currentPlayer: 0,
        blackCount: 0,
        whiteCount: 0,
        extraMoves: 0,
        gamePhase: GAME_PHASES.PLACING,
        elapsedTime: '00:00',
        flashPiece: { row: null, col: null },
        isExchangeRemoving: false,
        lastTapTime: null,
        blackLastMovedPiece: null,
        whiteLastMovedPiece: null,
        lastActionResult: null,
        isAnimationInProgress: false,
        dragPiece: null,
        timer: null,
        playerConfig: null,
        settingsColor: null
    };

    cacheEls();
    buildBoard();
    buildRules();
    state.board = deepCopy(INITIAL_BOARD);
    state.playerConfig = loadPlayerConfig();
    wireEvents();
    renderAll();
}

document.addEventListener('DOMContentLoaded', init);

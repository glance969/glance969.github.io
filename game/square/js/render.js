// 渲染层（H5 版）：根据全局 state 构建/更新 DOM，替代小程序的 .wxml 数据绑定。
// 采用"持久 DOM + 局部更新"：棋盘格子只创建一次，渲染时按需增删/改 class，
// className 不变就不重设——从而不会打断正在播放的 flash 动画。

const RULES = [
    "1. 棋盘由六竖六横组成，两方各执一色棋子，落棋于每个交叉点上。",
    "2. 落子规则：黑方方先落子，放在棋盘36个交叉点的任意一处均可。玩家可以摆成几种阵型以赢得多落子的机会。",
    "大方：在棋盘任何位置的一个格上，组成一个格子的四个点位上全部放上自己的棋子就叫大方，可以在组成大方后再落一子。",
    "三斜：连续三个棋子串连，而且形成一个斜线，但斜线的两端必须都在棋盘的边线点位上，可以在组成三斜后再落一子。",
    "四斜：连续四个棋子串连，规则同上！ 可以在组成四斜后再落两子。",
    "五斜：连续五个棋子串连，规则同上！ 可以在组成五斜后再落三子。",
    "六斜：连续六个棋子串连，即六格正方形的对角线，规则同上！ 可以在组成六斜后再落四子。",
    "大龙：横竖六个一样的棋子连成一条线，四条边不计入“龙”，可以多落四子。",
    "3. 落子限制：组成阵型获得多落子机会，阵型越多，多落子机会越多，可以多阵型叠加。利用多落子机会，重新形成的阵型，不可以获得多落子机会。比如：先形成大方，获得一个多落子机会，但再落一子时又形成了大方，不可以再多落子了。",
    "4. 在整个棋盘放满棋子的时候由最后落子的一方去除对方的一个棋子，然后由另一方也去除对方的一个棋子，接着就进入了移动走棋阶段。",
    "5. 移动规则：移动阶段只能移动己方棋子，移动棋子只能横平竖直走一格，走动棋子只是为了形成新的阵型，形成阵型后可以摘除对方的棋子，比如形成新的大方后可以摘除对方一枚棋子，形成三斜乃至龙等，可以摘除对方上述数量的棋子，规则同上。",
    "6. 吃子的限制： 优先移除不在阵型中的棋子； 如果没有不在阵型中的棋子，可再移除对方没有形成大方阵型的棋子，比如仅形成斜线或龙阵型中的棋子； 最后才能移除大方阵型中的棋子。",
    "7. 游戏输赢：当棋盘上一方棋子的数量少于3颗时，或者无棋子可移动时，则对方获胜，游戏结束。"
];

const els = {};
const cellSlots = [];   // 6x6 交叉点容器引用
let boardBuilt = false;

function cacheEls() {
    const ids = [
        'status-text', 'extra-moves', 'black-count', 'white-count',
        'black-arrow', 'white-arrow', 'black-action-btn', 'white-action-btn',
        'black-setting-btn', 'white-setting-btn',
        'start-button', 'board-overlay', 'board', 'h-lines', 'v-lines',
        'restart-button', 'timer', 'timer-text', 'rules-button',
        'rules-overlay', 'rules-list', 'rules-close',
        'settings-overlay', 'settings-title', 'settings-save', 'settings-close',
        'pt-self', 'pt-local', 'difficulty-group', 'diff-easy', 'diff-medium', 'diff-hard'
    ];
    ids.forEach(id => {
        const key = id.replace(/-([a-z])/g, (_, ch) => ch.toUpperCase());
        els[key] = document.getElementById(id);
    });
}

// 一次性构建棋盘：横竖线 + 36 个交叉点槽位（按百分比定位，随棋盘尺寸自适应）
function buildBoard() {
    if (boardBuilt) return;
    const pct = i => (i * 20) + '%'; // 0/20/40/60/80/100

    for (let i = 0; i < 6; i++) {
        const h = document.createElement('div');
        h.className = 'horizontal-line';
        h.style.top = pct(i);
        els.hLines.appendChild(h);

        const v = document.createElement('div');
        v.className = 'vertical-line';
        v.style.left = pct(i);
        els.vLines.appendChild(v);
    }

    for (let r = 0; r < 6; r++) {
        cellSlots[r] = [];
        for (let c = 0; c < 6; c++) {
            const slot = document.createElement('div');
            slot.className = 'intersection';
            slot.style.left = pct(c);
            slot.style.top = pct(r);
            slot.dataset.row = r;
            slot.dataset.col = c;
            els.board.appendChild(slot);
            cellSlots[r][c] = slot;
        }
    }
    boardBuilt = true;
}

function buildRules() {
    if (els.rulesList.childElementCount > 0) return;
    RULES.forEach(text => {
        const item = document.createElement('div');
        item.className = 'rule-item';
        item.textContent = text;
        els.rulesList.appendChild(item);
    });
}

// ---- 各分区渲染 ----
function renderStatus() {
    els.statusText.textContent = state.message || (state.currentPlayer === 0 ? '黑方回合' : '白方回合');
    if (state.extraMoves > 0) {
        els.extraMoves.style.display = '';
        els.extraMoves.textContent = `剩余次数: ${state.extraMoves}`;
    } else {
        els.extraMoves.style.display = 'none';
    }
}

function renderCounts() {
    els.blackCount.textContent = state.blackCount || 0;
    els.whiteCount.textContent = state.whiteCount || 0;
}

function renderArrows() {
    els.blackArrow.classList.toggle('active', state.currentPlayer === 0);
    els.whiteArrow.classList.toggle('active', state.currentPlayer === 1);
}

function renderPlayerButtons() {
    if (!state.playerConfig) return;
    ['black', 'white'].forEach(color => {
        const btn = color === 'black' ? els.blackActionBtn : els.whiteActionBtn;
        const cfg = state.playerConfig[color];
        if (!cfg || cfg.playerType === 'self') {
            btn.style.display = '';
            btn.textContent = '悔　　棋';
            btn.dataset.role = 'undo';
        } else if (cfg.playerType === 'local') {
            btn.style.display = '';
            const diff = cfg.difficulty;
            btn.textContent = diff === 'easy' ? '容　　易' : (diff === 'medium' ? '中等难度' : '困　　难');
            btn.dataset.role = 'settings';
        } else {
            btn.style.display = 'none';
        }
    });
}

function renderControls() {
    const started = state.isGameStarted;
    els.startButton.style.display = started ? 'none' : '';
    els.boardOverlay.style.display = started ? 'none' : '';
    els.restartButton.style.display = started ? '' : 'none';
    els.timer.style.display = started ? '' : 'none';
}

function renderBoard() {
    if (!boardBuilt) return;
    for (let r = 0; r < 6; r++) {
        for (let c = 0; c < 6; c++) {
            const slot = cellSlots[r][c];
            const cell = state.board && state.board[r] ? state.board[r][c] : null;
            let piece = slot.firstChild;

            if (!cell) {
                if (piece) slot.removeChild(piece);
                continue;
            }
            if (!piece) {
                piece = document.createElement('div');
                piece.dataset.row = r;
                piece.dataset.col = c;
                slot.appendChild(piece);
            }
            piece.dataset.color = cell.color;
            const cls = ['piece', cell.color];
            if (cell.isFormation) cls.push('formation-border');
            if (state.flashPiece && state.flashPiece.row === r && state.flashPiece.col === c) cls.push('flash');
            const desired = cls.join(' ');
            if (piece.className !== desired) piece.className = desired; // 仅在变化时重设，避免打断动画
        }
    }
}

function renderTimer() {
    els.timerText.textContent = state.elapsedTime || '00:00';
}

function renderAll() {
    renderStatus();
    renderCounts();
    renderArrows();
    renderPlayerButtons();
    renderControls();
    renderBoard();
    renderTimer();
}

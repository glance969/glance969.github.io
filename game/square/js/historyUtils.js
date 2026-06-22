// 历史记录与日志（H5 版，全局作用域）
// 仅保留悔棋所需的内存历史与 debugLog；去掉原版写文件的 exportGameHistory。

function saveUserMessageToHistory(phase, playerColor, updatedHistory, lastActionResult, board) {
    const boardState = getBoardState(board);
    const feedback = lastActionResult || '';

    const messageTemplate = `当前棋盘状态: ${JSON.stringify(boardState)} ，你的棋子颜色: ${playerColor}，` +
        `当前阶段: '${phase}'` +
        '。请根据当前棋局给出最佳决策。';

    return {
        gameHistory: [...updatedHistory, {
            role: "user",
            content: feedback + messageTemplate
        }]
    };
}

function saveAssistantMessageToHistory(gameHistory, content) {
    return [...gameHistory, {
        role: "assistant",
        content: typeof content === 'string' ? content : JSON.stringify(content)
    }];
}

// 获取当前棋盘状态（精简为 color/isFormation）
function getBoardState(board) {
    if (!board) {
        board = INITIAL_BOARD;
    }
    return board.map(row => row.map(cell => cell ? {
        color: cell.color,
        isFormation: cell.isFormation
    } : null));
}

function debugLog(isDebug, message, data, ...args) {
    if (isDebug) {
        console.log(message, JSON.stringify(data), ...args);
    }
}

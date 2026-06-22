// AI 回合处理（H5 版：仅本地规则 AI，已移除远程 OpenAI/Ollama 调用）
// 由于本版所有模块共享全局作用域，这里直接使用全局 state / showMessage / processAIDecision，
// 调用方只需 handleAITurn(phase, aicolor)。

async function handleAITurn(phase, aicolor) {
    if (state.isGameOver || state.playerConfig[aicolor].playerType === 'self') {
        return; // 轮到真人，等待手动操作
    }

    try {
        const decision = getLocalDecision(phase, aicolor);
        processAIDecision(phase, aicolor, decision);
    } catch (error) {
        console.error(`${aicolor}-AI决策失败:`, error);
        showMessage(`AI决策失败: ${error.message || error}`);
    }
}

// 本地决策：从 getValidPositions 给出的候选里随机选择一个
function getLocalDecision(phase, aicolor) {
    const validPositions = getValidPositions(phase, aicolor, state);
    if (!validPositions || validPositions.length === 0) {
        throw new Error('没有可用决策');
    }

    let decision;
    if (validPositions.length === 1) {
        decision = validPositions[0];
    } else {
        const randomIndex = Math.floor(Math.random() * validPositions.length);
        decision = validPositions[randomIndex];
        // 移动阶段避免与上一步来回重复
        if (phase === GAME_PHASES.MOVING && isRepeatingMove(aicolor, decision, state)) {
            decision = validPositions[validPositions.length - 1 - randomIndex];
        }
    }

    if (!isDecisionValid(decision, validPositions)) {
        throw new Error('AI 决策无效');
    }
    debugLog(CONFIG.DEBUG, `${aicolor === 'black' ? '黑方' : '白方'}, 决策 =`, decision);
    return decision;
}

function isDecisionValid(decision, validPositions) {
    const isPositionValid = (position) => {
        return Array.isArray(position) &&
            position.length === 2 &&
            typeof position[0] === 'number' &&
            typeof position[1] === 'number';
    };

    if (!decision || !decision.action || !decision.position || !isPositionValid(decision.position) ||
        (decision.newPosition && !isPositionValid(decision.newPosition))) {
        return false;
    }

    switch (decision.action) {
        case 'placing':
        case 'removing':
            return validPositions.some(pos => pos.action === decision.action && pos.position[0] === decision.position[0] && pos.position[1] === decision.position[1]);
        case 'moving':
            return validPositions.some(move => move.action === decision.action && move.position[0] === decision.position[0] && move.position[1] === decision.position[1] && move.newPosition[0] === decision.newPosition[0] && move.newPosition[1] === decision.newPosition[1]);
        default:
            return false;
    }
}

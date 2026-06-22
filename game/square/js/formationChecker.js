// 阵型检查（H5 版，全局作用域）

function checkFormation(row, col, currentColor, newBoard) {
    // 生成缓存 key
    const cacheKey = cacheManager.generateKey(row, col, currentColor, newBoard);

    // 命中缓存则直接返回（用 has 判断，null 结果也能正确命中）
    if (cacheManager.has(cacheKey)) {
        return cacheManager.get(cacheKey);
    }

    let extraMoves = 0;
    let formationPositions = [];
    let formationType = '';

    // 检查大方
    const squareResult = checkSquare(row, col, currentColor, newBoard);
    if (squareResult.squareCount > 0) {
        extraMoves += squareResult.squareCount; // 每个大方增加1次额外落子
        formationPositions.push(...squareResult.formationPositions);
        formationType += squareResult.squareCount > 1 ? `${squareResult.squareCount}个大方 ` : '大方 ';
    }

    // 检查斜线
    const diagonalResult = checkDiagonal(row, col, currentColor, newBoard);
    if (diagonalResult.diagonalCounts.length > 0) {
        const uniqueDiagonalCounts = diagonalResult.diagonalCounts;
        for (const count of uniqueDiagonalCounts) {
            extraMoves += count - 2; // 每个斜线增加 (count - 2) 次额外落子
            formationPositions.push(...diagonalResult.formationPositions);
            formationType += `${count}斜 `;
        }
    }

    // 检查龙
    const dragonResult = checkDragon(row, col, currentColor, newBoard);
    if (dragonResult.dragonCount > 0) {
        extraMoves += dragonResult.dragonCount * 4; // 每条龙增加4次额外落子
        formationPositions.push(...dragonResult.formationPositions);
        formationType += dragonResult.dragonCount > 1 ? '双龙 ' : '大龙 ';
    }

    const result = extraMoves > 0 ? {
        extraMoves: extraMoves,
        formationPositions: formationPositions,
        formationType: formationType
    } : null;

    cacheManager.set(cacheKey, result);
    return result;
}

function checkSquare(row, col, currentColor, newBoard) {
    const board = newBoard;
    let squareCount = 0;
    let formationPositions = [];

    for (let pattern of DIRECTIONS.SQUARE_PATTERNS) {
        let isSquare = true;
        let tempFormationPositions = [];
        for (let [dx, dy] of pattern) {
            const newRow = row + dx;
            const newCol = col + dy;
            if (!isInBoard(newRow, newCol) ||
                !board[newRow][newCol] ||
                board[newRow][newCol].color !== currentColor) {
                isSquare = false;
                break;
            }
            tempFormationPositions.push({ row: newRow, col: newCol });
        }
        if (isSquare) {
            squareCount++;
            formationPositions.push(...tempFormationPositions);
            // 只添加一次中心点
            if (squareCount === 1) {
                formationPositions.push({ row: row, col: col });
            }
        }
    }

    return { squareCount: squareCount, formationPositions: formationPositions };
}

function checkDiagonal(row, col, currentColor, newBoard) {
    const board = newBoard;
    let diagonalCounts = []; // 记录所有斜线的连续棋子数量
    let formationPositions = []; // 记录所有斜线的棋子位置
    for (const dir of DIRECTIONS.DIAGONAL_PATTERNS) {
        const { dx, dy } = dir;

        let startRow = row, startCol = col;
        let endRow = row, endCol = col;
        let count = 1;
        let tempFormationPositions = [];

        // 向起点方向查找
        while (isInBoard(startRow - dx, startCol - dy) && board[startRow - dx][startCol - dy]?.color === currentColor) {
            count++;
            startRow -= dx;
            startCol -= dy;
            tempFormationPositions.push({ row: startRow, col: startCol });
        }

        // 向终点方向查找
        while (isInBoard(endRow + dx, endCol + dy) && board[endRow + dx][endCol + dy]?.color === currentColor) {
            count++;
            endRow += dx;
            endCol += dy;
            tempFormationPositions.push({ row: endRow, col: endCol });
        }

        // 只有当起点和终点都在棋盘边线上时，才符合斜线规则
        if (isOnEdge(startRow, startCol) && isOnEdge(endRow, endCol)) {
            if (count >= 3) { // 只记录3斜及以上的斜线
                diagonalCounts.push(count);
                if (formationPositions.length === 0) {
                    formationPositions.push({ row: row, col: col });
                }
                formationPositions.push(...tempFormationPositions);
            }
        }
    }

    return { diagonalCounts: diagonalCounts, formationPositions: formationPositions };
}

function checkDragon(row, col, currentColor, newBoard) {
    const board = newBoard;

    let dragonCount = 0; // 记录形成龙的数量
    let formationPositions = []; // 记录所有龙的棋子位置
    for (const dir of DIRECTIONS.DRAGON_PATTERNS) {
        const { dx, dy } = dir;

        let r = row + dx;
        let c = col + dy;
        let count = 1;
        let edgeCount = isOnEdge(row, col) ? 1 : 0; // 统计边线上的棋子数量
        let tempFormationPositions = [];

        while (isInBoard(r, c) && board[r][c]?.color === currentColor) {
            count++;
            if (isOnEdge(r, c)) edgeCount++;
            if (edgeCount === 3) break;
            tempFormationPositions.push({ row: r, col: c });
            r += dx;
            c += dy;
        }

        // 向相反方向检查
        r = row - dx;
        c = col - dy;
        while (isInBoard(r, c) && board[r][c]?.color === currentColor) {
            count++;
            if (isOnEdge(r, c)) edgeCount++;
            if (edgeCount === 3) break;
            tempFormationPositions.push({ row: r, col: c });
            r -= dx;
            c -= dy;
        }

        // 检查是否形成6个连续棋子，并且不全部在边线上
        if (count === 6 && edgeCount < 3) {
            dragonCount++;
            formationPositions.push(...tempFormationPositions);
            if (dragonCount === 1) {
                formationPositions.push({ row: row, col: col });
            }
        }
    }

    return { dragonCount: dragonCount, formationPositions: formationPositions };
}

function hasNonFormationPieces(opponentColor, board) {
    for (let row = 0; row < 6; row++) {
        for (let col = 0; col < 6; col++) {
            if (board[row][col] && board[row][col].color === opponentColor) {
                if (!board[row][col].isFormation) {
                    return true;
                }
            }
        }
    }
    return false;
}

function isStillInFormation(row, col, currentColor, newBoard) {
    const squareResult = checkSquare(row, col, currentColor, newBoard);
    if (squareResult.squareCount > 0) return true;

    const diagonalResult = checkDiagonal(row, col, currentColor, newBoard);
    if (diagonalResult.diagonalCounts.length > 0) return true;

    const dragonResult = checkDragon(row, col, currentColor, newBoard);
    if (dragonResult.dragonCount > 0) return true;

    return false;
}

function hasNonSquarePieces(currentColor, formationPositions, row = 0, col = 0, board) {
    if (board[row][col] && board[row][col].color === currentColor) {
        const isInFormation = formationPositions.some(pos => pos.row === row && pos.col === col);
        if (!isInFormation) {
            const squareResult = checkSquare(row, col, currentColor, board);
            if (squareResult.squareCount === 0) {
                return true;
            } else {
                formationPositions.push(...squareResult.formationPositions);
            }
        }
    }

    if (col < 5) {
        return hasNonSquarePieces(currentColor, formationPositions, row, col + 1, board);
    } else if (row < 5) {
        return hasNonSquarePieces(currentColor, formationPositions, row + 1, 0, board);
    }

    return false;
}

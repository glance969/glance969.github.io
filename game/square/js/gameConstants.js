// 游戏常量定义（H5 版：经典脚本，全局作用域，无 import/export）

// 方向常量
const DIRECTIONS = {
    ADJACENT: [
        { dx: -1, dy: 0 },  // 上
        { dx: 1, dy: 0 },   // 下
        { dx: 0, dy: -1 },  // 左
        { dx: 0, dy: 1 }    // 右
    ],
    NEIGHBORS: [
        [-1, -1], [-1, 0], [0, -1], [0, 1], [-1, 1], [1, -1], [1, 1], [1, 0]  // 8个相邻点
    ],
    CORNERPOSITIONS: [
        { pos: [1, 1], adjacent: [[1, 2], [2, 1]] },
        { pos: [1, 4], adjacent: [[1, 3], [2, 4]] },
        { pos: [4, 1], adjacent: [[3, 1], [4, 2]] },
        { pos: [4, 4], adjacent: [[3, 4], [4, 3]] }
    ],  // 四个角落及其相邻位置
    SQUARE_PATTERNS: [
        [[-1, -1], [-1, 0], [0, -1]],  // 左上大方
        [[-1, 0], [-1, 1], [0, 1]],    // 右上大方
        [[0, -1], [1, -1], [1, 0]],    // 左下大方
        [[0, 1], [1, 0], [1, 1]]       // 右下大方
    ], // 大方方向
    DIAGONAL_PATTERNS: [
        { dx: 1, dy: 1 },   // 左上到右下
        { dx: 1, dy: -1 }   // 右上到左下
    ],  // 斜线方向
    DRAGON_PATTERNS: [
        { dx: 0, dy: 1 },   // 水平方向
        { dx: 1, dy: 0 }    // 垂直方向
    ], // 定义水平和垂直方向
};

// 位置权重
const WEIGHTS = [
    [0, 0.5, 0.7, 0.7, 0.5, 0],
    [0.5, 1, 0.9, 0.9, 1, 0.5],
    [0.7, 0.9, 0.8, 0.8, 0.9, 0.7],
    [0.7, 0.9, 0.8, 0.8, 0.9, 0.7],
    [0.5, 1, 0.9, 0.9, 1, 0.5],
    [0, 0.5, 0.7, 0.7, 0.5, 0],
];

// 对局历史的初始系统消息（仅用于本地悔棋时的历史记录种子）
const GAMEHISTORY = [{
    role: "system",
    content: "大方棋：6横6竖交叉点棋盘，黑白两方轮流落子，形成阵型可获得额外机会。"
}];

const NUMBERS = {
    MIN_PIECES_TO_WIN: 3,
    MAX_PIECES_COUNT: 36,
};

const INITIAL_BOARD = Array.from({ length: 6 }, () => new Array(6).fill(null));

const PLAYERS = ['black', 'white'];

const GAME_PHASES = {
    PLACING: 'placing',
    MOVING: 'moving',
    REMOVING: 'removing'
};

const DEFAULT_PLAYER_CONFIG = {
    black: {
        playerType: 'self',
        difficulty: 'easy',
        aiConfig: { url: '', model: '', apiKey: '' }
    },
    white: {
        playerType: 'local',
        difficulty: 'easy',
        aiConfig: { url: '', model: '', apiKey: '' }
    }
};

const INIT_MESG = "点击中间按钮，从黑方开始轮流布子";

const CONFIG = {
    DEBUG: false, // H5 版静音算法日志（悔棋历史由 state.isDebug 控制，二者独立）
};

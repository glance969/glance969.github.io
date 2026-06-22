// 棋手配置管理（H5 版，全局作用域，使用 platform.storage 替代 wx storage）

function loadPlayerConfig() {
    const playerConfig = storage.get('playerConfig') || DEFAULT_PLAYER_CONFIG;
    return playerConfig;
}

function updatePlayerConfig(color, config) {
    const currentConfig = loadPlayerConfig();
    const oppositeColor = color === 'black' ? 'white' : 'black';

    // 创建新的配置对象
    const newPlayerConfig = {
        ...currentConfig,
        [color]: config
    };

    // 处理 playerType 的切换逻辑（DEBUG 下不自动切换对方）
    if (!CONFIG.DEBUG && config.playerType !== currentConfig[color].playerType) {
        if (config.playerType === 'self') {
            newPlayerConfig[oppositeColor] = {
                ...newPlayerConfig[oppositeColor],
                playerType: currentConfig[color].playerType
            };
        } else if (currentConfig[color].playerType === 'self') {
            newPlayerConfig[oppositeColor] = {
                ...newPlayerConfig[oppositeColor],
                playerType: 'self'
            };
        }
    }

    if (typeof newPlayerConfig === 'object' && newPlayerConfig !== null) {
        storage.set('playerConfig', newPlayerConfig);
    } else {
        console.error('PlayerConfig 格式错误:', newPlayerConfig);
    }
}

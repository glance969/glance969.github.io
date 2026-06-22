// 阵型检查缓存（H5 版：纯内存 Map，无文件/storage 落盘）
// 修复原版两个问题：
//   1) 原版用 if(cachedResult) 判命中，导致"无阵型"的 null 结果永远不命中、反复重算；
//      这里改为 has() 判命中，null 也能正确缓存。
//   2) 原版每次 set 都同步写 storage + 写文件，频繁调用时极慢；这里只存内存。
class CacheManager {
    constructor() {
        this.cache = new Map();
    }

    generateKey(row, col, currentColor, board) {
        return JSON.stringify({ row, col, currentColor, board });
    }

    has(key) {
        return this.cache.has(key);
    }

    get(key) {
        return this.cache.get(key);
    }

    set(key, value) {
        this.cache.set(key, value);
    }

    clear() {
        this.cache.clear();
    }
}

const cacheManager = new CacheManager();

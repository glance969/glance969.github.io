// 平台垫片（H5 版）：用浏览器原生能力替代 wx.* —— storage / toast / 模态框
// 全局暴露：storage、toast(message, duration)、showModal({...}) => Promise<boolean>

const storage = {
    get(key) {
        try {
            const raw = localStorage.getItem(key);
            if (raw === null || raw === undefined) return null;
            return JSON.parse(raw);
        } catch (e) {
            console.error('storage.get 解析失败:', key, e);
            return null;
        }
    },
    set(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch (e) {
            console.error('storage.set 失败:', key, e);
        }
    },
    remove(key) {
        try {
            localStorage.removeItem(key);
        } catch (e) { /* ignore */ }
    }
};

// ---- Toast（替代 wx.showToast）----
let _toastTimer = null;
function toast(message, duration = 1500) {
    if (!message) return;
    let el = document.getElementById('toast');
    if (!el) {
        el = document.createElement('div');
        el.id = 'toast';
        el.className = 'toast';
        document.body.appendChild(el);
    }
    el.textContent = message;
    el.classList.add('show');
    if (_toastTimer) clearTimeout(_toastTimer);
    _toastTimer = setTimeout(() => {
        el.classList.remove('show');
    }, duration);
}

// ---- 模态框（替代 wx.showModal）----
// 返回 Promise<boolean>：true 表示点击确认，false 表示取消
function showModal({ title = '', content = '', confirmText = '确定', cancelText = '取消', showCancel = false } = {}) {
    return new Promise(resolve => {
        const mask = document.createElement('div');
        mask.className = 'modal-mask';

        const box = document.createElement('div');
        box.className = 'modal-box';

        if (title) {
            const t = document.createElement('div');
            t.className = 'modal-title';
            t.textContent = title;
            box.appendChild(t);
        }
        if (content) {
            const c = document.createElement('div');
            c.className = 'modal-content';
            c.textContent = content; // 用 textContent 保留换行需配合 CSS white-space
            box.appendChild(c);
        }

        const btns = document.createElement('div');
        btns.className = 'modal-buttons';

        const finish = (result) => {
            if (mask.parentNode) mask.parentNode.removeChild(mask);
            resolve(result);
        };

        if (showCancel) {
            const cancelBtn = document.createElement('button');
            cancelBtn.className = 'modal-btn modal-cancel';
            cancelBtn.textContent = cancelText;
            cancelBtn.addEventListener('click', () => finish(false));
            btns.appendChild(cancelBtn);
        }

        const okBtn = document.createElement('button');
        okBtn.className = 'modal-btn modal-confirm';
        okBtn.textContent = confirmText;
        okBtn.addEventListener('click', () => finish(true));
        btns.appendChild(okBtn);

        box.appendChild(btns);
        mask.appendChild(box);
        document.body.appendChild(mask);
    });
}

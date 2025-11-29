/**
 * 诗词填字小游戏
 * 适合5岁小朋友的可爱风格游戏
 */

/**
 * 多音字发音映射表
 * 根据儿歌语境，将多音字映射到正确发音的同音替代字
 * 格式: { "诗句": { "多音字": "替代字" } }
 */
const POLYPHONIC_MAP = {
    '背上小书包': { '背': '悲' },      // bēi (背负)，用"悲"引导发音，非 bèi
    '我跳着去追': { '着': '着' },      // zhe (助词)，保持原字让TTS根据上下文判断
    '数星眨眼睛': { '数': '属' },      // shǔ (动词，数数)，用"属"引导发音，非 shù
    '铅笔写数字': { '数': '术' },      // shù (名词，数字)，用"术"引导发音
    '筷子夹豆角': { '角': '脚' },      // jiǎo (豆角)，用"脚"引导发音，非 jué
    '捉迷藏真妙': { '藏': '藏' },      // cáng (隐藏)，保持原字让TTS根据上下文判断
    '关灯睡觉觉': { '觉': '叫' },      // jiào (睡觉)，用"叫"引导发音，非 jué
    '梦里游太空': { '空': '空' }       // kōng (太空)，保持原字让TTS根据上下文判断
};

class PoetryGame {
    constructor(config = {}) {
        this.sections = [];       // 诗句按章节分组
        this.currentLines = [];   // 当前选中的两行诗
        this.removedChars = [];   // 被移除的字符及其位置信息
        this.stateR = null;       // 状态R的快照
        this.lastDragAction = null; // 最近一次拖拽操作，用于撤销
        
        // 游戏配置
        this.lineLength = config.lineLength || 5;      // 每行字数
        this.removeCount = config.removeCount || 4;    // 移除字数
        
        this.init();
    }
    
    async init() {
        await this.loadPoems();
        this.bindEvents();
        this.startGame();
    }
    
    /**
     * 加载诗词文件
     */
    async loadPoems() {
        try {
            const response = await fetch('poet.txt');
            const text = await response.text();
            // 按"==="分割章节
            const rawSections = text.trim().split('===');
            this.sections = rawSections.map(section => {
                return section.trim().split('\n').filter(line => line.trim().length === this.lineLength);
            }).filter(section => section.length >= 2); // 只保留至少有2行的章节
        } catch (error) {
            console.error('加载诗词失败:', error);
            // 如果加载失败，使用默认诗句
            this.sections = [
                [
                    '太阳哈哈笑',
                    '背上小书包',
                    '路上遇花猫',
                    '蝴蝶飞呀飞'
                ]
            ];
        }
    }
    
    /**
     * 绑定事件
     */
    bindEvents() {
        document.getElementById('restartBtn').addEventListener('click', () => {
            this.startGame();
        });
        
        document.getElementById('undoBtn').addEventListener('click', () => {
            this.undoLastDrag();
        });
    }
    
    /**
     * 发音功能 - 使用Web Speech API朗读汉字
     * 支持多音字根据语境正确发音
     */
    speakChar(char, lineText = null) {
        if ('speechSynthesis' in window) {
            // 取消之前的语音
            window.speechSynthesis.cancel();
            
            // 检查是否需要处理多音字
            let speakText = char;
            if (lineText && POLYPHONIC_MAP[lineText] && POLYPHONIC_MAP[lineText][char]) {
                speakText = POLYPHONIC_MAP[lineText][char];
            }
            
            const utterance = new SpeechSynthesisUtterance(speakText);
            utterance.lang = 'zh-CN';
            utterance.rate = 0.8;
            utterance.pitch = 1.2;
            window.speechSynthesis.speak(utterance);
        }
    }
    
    /**
     * 撤销上一次拖拽操作
     */
    undoLastDrag() {
        if (!this.lastDragAction) {
            return;
        }
        
        const { card, dragChar, char } = this.lastDragAction;
        
        // 恢复卡片为空白状态
        if (card) {
            card.className = 'char-card empty';
            card.textContent = '';
            card.dataset.filled = 'false';
            delete card.dataset.filledChar;
        }
        
        // 显示拖拽字符
        if (dragChar) {
            dragChar.classList.remove('hidden');
        }
        
        // 清除最近操作记录
        this.lastDragAction = null;
        this.updateUndoButtonState();
    }
    
    /**
     * 更新撤销按钮状态
     */
    updateUndoButtonState() {
        const undoBtn = document.getElementById('undoBtn');
        if (undoBtn) {
            undoBtn.disabled = !this.lastDragAction;
        }
    }
    
    /**
     * 开始游戏
     */
    startGame() {
        this.lastDragAction = null; // 重置撤销记录
        this.selectRandomLines();
        this.renderPoem();
        this.removeRandomChars();
        this.saveStateR();
        this.clearMessage();
        this.updateUndoButtonState();
    }
    
    /**
     * 随机选择连续的两行诗（不跨越章节）
     */
    selectRandomLines() {
        if (this.sections.length === 0) {
            this.currentLines = ['太阳哈哈笑', '背上小书包'];
            return;
        }
        
        // 随机选择一个章节
        const sectionIndex = Math.floor(Math.random() * this.sections.length);
        const section = this.sections[sectionIndex];
        
        // 从该章节中随机选择连续的两行
        const maxIndex = section.length - 2;
        const startIndex = Math.floor(Math.random() * (maxIndex + 1));
        this.currentLines = [section[startIndex], section[startIndex + 1]];
    }
    
    /**
     * 渲染诗句到页面
     */
    renderPoem() {
        const line1El = document.getElementById('line1');
        const line2El = document.getElementById('line2');
        
        line1El.innerHTML = '';
        line2El.innerHTML = '';
        
        // 渲染第一行
        for (let i = 0; i < this.currentLines[0].length; i++) {
            const card = this.createCharCard(this.currentLines[0][i], 0, i);
            line1El.appendChild(card);
        }
        
        // 渲染第二行
        for (let i = 0; i < this.currentLines[1].length; i++) {
            const card = this.createCharCard(this.currentLines[1][i], 1, i);
            line2El.appendChild(card);
        }
    }
    
    /**
     * 创建字符卡片
     */
    createCharCard(char, lineIndex, charIndex) {
        const card = document.createElement('div');
        card.className = 'char-card filled';
        card.textContent = char;
        card.dataset.line = lineIndex;
        card.dataset.index = charIndex;
        card.dataset.char = char;
        card.dataset.lineText = this.currentLines[lineIndex]; // 保存完整诗句用于多音字发音
        
        // 点击发音
        card.addEventListener('click', () => {
            if (card.textContent) {
                this.speakChar(card.textContent, card.dataset.lineText);
            }
        });
        
        return card;
    }
    
    /**
     * 随机移除字符
     */
    removeRandomChars() {
        this.removedChars = [];
        
        // 创建所有位置的列表
        const allPositions = [];
        for (let line = 0; line < 2; line++) {
            for (let index = 0; index < this.lineLength; index++) {
                allPositions.push({ line, index });
            }
        }
        
        // 随机打乱位置
        for (let i = allPositions.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [allPositions[i], allPositions[j]] = [allPositions[j], allPositions[i]];
        }
        
        // 选择位置移除
        const positionsToRemove = allPositions.slice(0, this.removeCount);
        
        positionsToRemove.forEach(pos => {
            const lineEl = document.getElementById(pos.line === 0 ? 'line1' : 'line2');
            const card = lineEl.children[pos.index];
            const char = card.dataset.char;
            
            // 记录被移除的字符信息，包括诗句上下文用于多音字发音
            this.removedChars.push({
                char: char,
                line: pos.line,
                index: pos.index,
                lineText: this.currentLines[pos.line]  // 保存完整诗句用于多音字发音
            });
            
            // 将卡片变为空白
            card.className = 'char-card empty';
            card.textContent = '';
            card.dataset.filled = 'false';
            
            // 添加拖放事件
            this.setupDropZone(card);
        });
        
        // 打乱被移除字符的顺序用于显示
        const shuffledChars = [...this.removedChars];
        for (let i = shuffledChars.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffledChars[i], shuffledChars[j]] = [shuffledChars[j], shuffledChars[i]];
        }
        
        // 渲染可拖拽的字符
        this.renderDragChars(shuffledChars);
    }
    
    /**
     * 渲染可拖拽的字符
     */
    renderDragChars(chars) {
        const dragCharsEl = document.getElementById('dragChars');
        dragCharsEl.innerHTML = '';
        
        chars.forEach((charInfo, index) => {
            const charEl = document.createElement('div');
            charEl.className = 'drag-char';
            charEl.textContent = charInfo.char;
            charEl.draggable = true;
            charEl.dataset.char = charInfo.char;
            charEl.dataset.dragIndex = index;
            charEl.dataset.lineText = charInfo.lineText;  // 保存完整诗句用于多音字发音
            
            // 点击发音
            charEl.addEventListener('click', (e) => {
                // 只有在不拖拽时才发音
                if (!charEl.classList.contains('dragging')) {
                    this.speakChar(charInfo.char, charInfo.lineText);
                }
            });
            
            // 拖拽开始
            charEl.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('text/plain', charInfo.char);
                e.dataTransfer.setData('dragIndex', index.toString());
                charEl.classList.add('dragging');
            });
            
            // 拖拽结束
            charEl.addEventListener('dragend', () => {
                charEl.classList.remove('dragging');
            });
            
            // 触摸支持
            this.setupTouchDrag(charEl);
            
            dragCharsEl.appendChild(charEl);
        });
    }
    
    /**
     * 设置放置区域
     */
    setupDropZone(card) {
        card.addEventListener('dragover', (e) => {
            e.preventDefault();
            card.classList.add('drag-over');
        });
        
        card.addEventListener('dragleave', () => {
            card.classList.remove('drag-over');
        });
        
        card.addEventListener('drop', (e) => {
            e.preventDefault();
            card.classList.remove('drag-over');
            
            if (card.dataset.filled === 'true') {
                return; // 已经填充的位置不能再放
            }
            
            const char = e.dataTransfer.getData('text/plain');
            const dragIndex = e.dataTransfer.getData('dragIndex');
            
            // 隐藏拖拽区域中对应的字符
            const dragCharsEl = document.getElementById('dragChars');
            const dragChar = dragCharsEl.querySelector(`[data-drag-index="${dragIndex}"]`);
            
            // 保存此次操作用于撤销
            this.lastDragAction = {
                card: card,
                dragChar: dragChar,
                char: char
            };
            this.updateUndoButtonState();
            
            // 填充字符
            card.textContent = char;
            card.dataset.filledChar = char;
            card.dataset.filled = 'true';
            card.className = 'char-card filled';
            
            if (dragChar) {
                dragChar.classList.add('hidden');
            }
            
            // 检查是否所有空格都已填充
            this.checkCompletion();
        });
    }
    
    /**
     * 设置触摸拖拽支持
     */
    setupTouchDrag(charEl) {
        let touchStartX, touchStartY;
        let clone = null;
        
        charEl.addEventListener('touchstart', (e) => {
            const touch = e.touches[0];
            touchStartX = touch.clientX;
            touchStartY = touch.clientY;
            
            // 创建克隆元素跟随手指
            clone = charEl.cloneNode(true);
            clone.style.position = 'fixed';
            clone.style.zIndex = '1000';
            clone.style.pointerEvents = 'none';
            clone.style.opacity = '0.8';
            document.body.appendChild(clone);
            
            charEl.classList.add('dragging');
        });
        
        charEl.addEventListener('touchmove', (e) => {
            e.preventDefault();
            if (!clone) return;
            
            const touch = e.touches[0];
            clone.style.left = (touch.clientX - 30) + 'px';
            clone.style.top = (touch.clientY - 30) + 'px';
            
            // 检测是否在空白卡片上方
            const elementBelow = document.elementFromPoint(touch.clientX, touch.clientY);
            document.querySelectorAll('.char-card.empty').forEach(card => {
                card.classList.remove('drag-over');
            });
            if (elementBelow && elementBelow.classList.contains('empty')) {
                elementBelow.classList.add('drag-over');
            }
        });
        
        charEl.addEventListener('touchend', (e) => {
            if (clone) {
                document.body.removeChild(clone);
                clone = null;
            }
            
            charEl.classList.remove('dragging');
            
            const touch = e.changedTouches[0];
            const elementBelow = document.elementFromPoint(touch.clientX, touch.clientY);
            
            if (elementBelow && elementBelow.classList.contains('empty') && elementBelow.dataset.filled !== 'true') {
                // 填充字符
                const char = charEl.dataset.char;
                
                // 保存此次操作用于撤销
                this.lastDragAction = {
                    card: elementBelow,
                    dragChar: charEl,
                    char: char
                };
                this.updateUndoButtonState();
                
                elementBelow.textContent = char;
                elementBelow.dataset.filledChar = char;
                elementBelow.dataset.filled = 'true';
                elementBelow.className = 'char-card filled';
                elementBelow.classList.remove('drag-over');
                
                // 隐藏拖拽的字符
                charEl.classList.add('hidden');
                
                // 检查是否完成
                this.checkCompletion();
            }
            
            document.querySelectorAll('.char-card.empty').forEach(card => {
                card.classList.remove('drag-over');
            });
        });
    }
    
    /**
     * 检查是否完成
     */
    checkCompletion() {
        const emptyCards = document.querySelectorAll('.char-card.empty');
        const filledCards = document.querySelectorAll('.char-card[data-filled="true"]');
        
        // 如果还有空格未填充，直接返回
        if (emptyCards.length > 0 || filledCards.length < this.removeCount) {
            return;
        }
        
        // 检查所有填充是否正确
        let allCorrect = true;
        filledCards.forEach(card => {
            const originalChar = card.dataset.char;
            const filledChar = card.dataset.filledChar;
            if (originalChar !== filledChar) {
                allCorrect = false;
            }
        });
        
        if (allCorrect) {
            this.showSuccess();
        } else {
            this.showError();
            // 延迟恢复到状态R
            setTimeout(() => {
                this.restoreStateR();
            }, 1500);
        }
    }
    
    /**
     * 保存状态R
     */
    saveStateR() {
        this.stateR = {
            line1HTML: document.getElementById('line1').innerHTML,
            line2HTML: document.getElementById('line2').innerHTML,
            dragCharsHTML: document.getElementById('dragChars').innerHTML,
            removedChars: [...this.removedChars]
        };
    }
    
    /**
     * 恢复到状态R
     */
    restoreStateR() {
        if (!this.stateR) return;
        
        document.getElementById('line1').innerHTML = this.stateR.line1HTML;
        document.getElementById('line2').innerHTML = this.stateR.line2HTML;
        document.getElementById('dragChars').innerHTML = this.stateR.dragCharsHTML;
        
        // 重新绑定事件
        this.rebindEvents();
        this.clearMessage();
    }
    
    /**
     * 重新绑定拖放事件
     */
    rebindEvents() {
        // 重置撤销记录
        this.lastDragAction = null;
        this.updateUndoButtonState();
        
        // 绑定空白卡片的放置事件
        document.querySelectorAll('.char-card.empty').forEach(card => {
            this.setupDropZone(card);
        });
        
        // 绑定所有卡片的点击发音事件
        document.querySelectorAll('.char-card').forEach(card => {
            card.addEventListener('click', () => {
                if (card.textContent) {
                    this.speakChar(card.textContent, card.dataset.lineText);
                }
            });
        });
        
        // 绑定拖拽字符的事件
        document.querySelectorAll('.drag-char').forEach((charEl, index) => {
            // 点击发音
            charEl.addEventListener('click', () => {
                if (!charEl.classList.contains('dragging')) {
                    this.speakChar(charEl.dataset.char, charEl.dataset.lineText);
                }
            });
            
            charEl.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('text/plain', charEl.dataset.char);
                e.dataTransfer.setData('dragIndex', charEl.dataset.dragIndex);
                charEl.classList.add('dragging');
            });
            
            charEl.addEventListener('dragend', () => {
                charEl.classList.remove('dragging');
            });
            
            this.setupTouchDrag(charEl);
        });
    }
    
    /**
     * 显示成功消息
     */
    showSuccess() {
        const messages = [
            '🎉 太棒了！你真聪明！',
            '🌟 真厉害！全对了！',
            '👏 好极了！你是小天才！',
            '🏆 完美！继续加油！',
            '💪 你太棒了！真了不起！'
        ];
        const messageEl = document.getElementById('message');
        messageEl.textContent = messages[Math.floor(Math.random() * messages.length)];
        messageEl.className = 'message success';
    }
    
    /**
     * 显示错误消息
     */
    showError() {
        const messages = [
            '😊 再试一次吧！',
            '💪 别灰心，再来一次！',
            '🤔 想一想，再试试！',
            '👀 仔细看看，再试一次！'
        ];
        const messageEl = document.getElementById('message');
        messageEl.textContent = messages[Math.floor(Math.random() * messages.length)];
        messageEl.className = 'message error';
    }
    
    /**
     * 清除消息
     */
    clearMessage() {
        const messageEl = document.getElementById('message');
        messageEl.textContent = '';
        messageEl.className = 'message';
    }
}

// 页面加载完成后初始化游戏
let gameInstance = null;
document.addEventListener('DOMContentLoaded', () => {
    gameInstance = new PoetryGame();
});

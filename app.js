// app.js

function sudokuGame() {
    return {
        currentPuzzleString: '',
        currentSolutionString: '',
        board: [],
        message: '',
        messageClass: '', 
        isNoteMode: false, 
        selectedCell: null, 
        selectedDifficulty: 'medium',
        errorCount: 0,
        timer: 0,
        timerInterval: null,
        gameState: 'menu', 
        showStats: false,
        maxErrors: 3,
        relatedCells: [], 
        highlightedNumberCells: [], 
        version: '1.3.0',

        // PWA 更新相關
        updateAvailable: false,
        registration: null,
        
        getDefaultStats() { 
            return { currentStreak: 0, bestStreak: 0, levels: {'easy': { played: 0, won: 0, bestTime: null, totalTime: 0 }, 'medium': { played: 0, won: 0, bestTime: null, totalTime: 0 }, 'hard': { played: 0, won: 0, bestTime: null, totalTime: 0 }, 'very-hard': { played: 0, won: 0, bestTime: null, totalTime: 0 }, 'insane': { played: 0, won: 0, bestTime: null, totalTime: 0 }, }, recentGames: [] }
        },
        stats: {}, 

        // --- 統計與計時器函式 (不變) ---
        formatTime(seconds) { 
             if (seconds === null || typeof seconds === 'undefined') return 'N/A'; const mins = Math.floor(seconds / 60); const secs = Math.floor(seconds % 60); return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        },
        formatDate(isoString) { 
            if (!isoString) return 'N/A'; const date = new Date(isoString); return date.toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' });
        },
        startTimer() { 
            if (this.timerInterval) return; this.timerInterval = setInterval(() => { this.timer++; }, 1000);
        },
        stopTimer() { 
            if (this.timerInterval) { clearInterval(this.timerInterval); this.timerInterval = null; }
        },
        loadStats() {
              const storedStats = localStorage.getItem('sudokuStats'); const defaultStats = this.getDefaultStats(); if (storedStats) { const parsedStats = JSON.parse(storedStats); this.stats = { ...defaultStats, ...parsedStats, levels: { ...defaultStats.levels, ...(parsedStats.levels || {}) }, recentGames: parsedStats.recentGames || [] }; } else { this.stats = defaultStats; }
        },

        // 檢查 PWA 更新
        checkForUpdates() {
            if ('serviceWorker' in navigator) {
                navigator.serviceWorker.register('sw.js')
                    .then(registration => {
                        this.registration = registration;

                        // 檢查是否有新的 Service Worker 在等待
                        if (registration.waiting) {
                            this.updateAvailable = true;
                        }

                        // 監聽新的 Service Worker 安裝完成
                        registration.addEventListener('updatefound', () => {
                            const newWorker = registration.installing;
                            newWorker.addEventListener('statechange', () => {
                                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                                    this.updateAvailable = true;
                                }
                            });
                        });
                    })
                    .catch(error => {
                        console.log('ServiceWorker registration failed: ', error);
                    });
            }
        },

        // 更新 PWA
        updatePWA() {
            if (this.registration && this.registration.waiting) {
                this.registration.waiting.postMessage({ type: 'SKIP_WAITING' });
            }
        },

        // 確保選中的格子保持聚焦
        remainSelected() {
            if (this.selectedCell) {
                setTimeout(() => {
                    const selectedElement = document.querySelector(`[data-row="${this.selectedCell.row}"][data-col="${this.selectedCell.col}"]`);
                    if (selectedElement) {
                        selectedElement.focus();
                    }
                }, 0);
            }
        },

        // 將難度英文轉換為中文
        getDifficultyText(difficulty) {
            const difficultyMap = {
                'easy': '簡單',
                'medium': '中等',
                'hard': '困難',
                'very-hard': '極難',
                'insane': '瘋狂'
            };
            return difficultyMap[difficulty] || difficulty;
        },
        saveStats() { 
            localStorage.setItem('sudokuStats', JSON.stringify(this.stats));
        },
        recordGame(status) { 
             if (this.timer === 0 && status === 'lost') return; const gameRecord = { date: new Date().toISOString(), difficulty: this.selectedDifficulty, time: this.timer, status: status, errors: this.errorCount }; this.stats.recentGames.unshift(gameRecord); if (this.stats.recentGames.length > 10) this.stats.recentGames.pop(); 
        },
        clearStats() { 
            if (confirm('你確定要清空所有遊玩紀錄嗎？此動作無法復原。')) { localStorage.removeItem('sudokuStats'); this.stats = this.getDefaultStats(); }
        },
        toggleStats(state) { 
             this.showStats = state; if (state) { this.loadStats(); if (this.gameState === 'playing') this.stopTimer(); } else { if (this.gameState === 'playing') this.startTimer(); }
        },
        
        // --- 遊戲流程函式 (不變) ---
        startGame(level) { 
            this.selectedDifficulty = level; this.initGame(); this.gameState = 'playing'; this.showStats = false; 
        },
        pauseGame() { 
            if (this.gameState !== 'playing') return; this.stopTimer(); this.gameState = 'paused'; 
        },
        resumeGame() { 
            if (this.gameState !== 'paused') return; this.startTimer(); this.gameState = 'playing'; 
        },
        buildBoard() { 
            this.stopTimer(); this.timer = 0; 
            const newBoard = []; let row = [];
            for (let i = 0; i < this.currentPuzzleString.length; i++) {
                const char = this.currentPuzzleString[i]; const value = (char === '.' ? 0 : parseInt(char)); const isGiven = (char !== '.');
                row.push(this.createCell(value, isGiven)); 
                if ((i + 1) % 9 === 0) { newBoard.push(row); row = []; }
            }
            this.board = newBoard; this.message = '遊戲開始！'; this.messageClass = 'text-blue-600';
            this.isNoteMode = false; this.selectedCell = null; this.errorCount = 0; 
            this.clearHighlights(); this.startTimer(); 
        },
        initGame() { 
            this.stats.levels[this.selectedDifficulty].played++;
            try {
                this.currentPuzzleString = sudoku.generate(this.selectedDifficulty); this.currentSolutionString = sudoku.solve(this.currentPuzzleString);
                this.buildBoard(); 
            } catch (e) { console.error("生成數獨時發生錯誤:", e); this.message = '載入謎題失敗，請重試。'; this.messageClass = 'text-red-600'; }
        },
        restartGame() { 
             this.buildBoard(); this.gameState = 'playing'; 
        },
        onNewGameClick() { 
             if (this.gameState === 'playing' || this.gameState === 'gameOver') { this.recordGame('lost'); this.stats.currentStreak = 0; }
             this.saveStats(); this.stopTimer(); this.gameState = 'menu'; this.showStats = false; 
        },
        
        // --- 核心邏輯修改 ---

        createCell(value, isGiven) {
            return {
                value: value, 
                isGiven: isGiven, 
                isError: false, 
                isLocked: false, 
                notes: Array(9).fill(false) 
            }
        },

        updateRelatedCells(r, c) { 
            this.relatedCells = []; const relatedSet = new Set();
            for (let col = 0; col < 9; col++) relatedSet.add(`${r}-${col}`);
            for (let row = 0; row < 9; row++) relatedSet.add(`${row}-${c}`);
            const startRow = Math.floor(r / 3) * 3; const startCol = Math.floor(c / 3) * 3;
            for (let row = startRow; row < startRow + 3; row++) { for (let col = startCol; col < startCol + 3; col++) relatedSet.add(`${row}-${col}`); }
            relatedSet.forEach(coord => { const [rr, cc] = coord.split('-').map(Number); this.relatedCells.push({ r: rr, c: cc }); });
        },
        
        clearHighlights() { 
            this.relatedCells = [];
            this.highlightedNumberCells = []; 
        },

        isRelated(r, c) { 
            if (this.gameState === 'menu' || this.gameState === 'paused') return false; 
            return this.relatedCells.some(cell => cell.r === r && cell.c === c);
        },
        
        isHighlightedNumber(r, c) {
            if (this.gameState === 'menu' || this.gameState === 'paused') return false; 
            return this.highlightedNumberCells.some(cell => cell.r === r && cell.c === c);
        },

        updateHighlightedNumberCells(r, c) {
            this.highlightedNumberCells = []; 
            if (!this.selectedCell || this.gameState === 'menu' || this.gameState === 'paused') return;
            const selectedValue = this.board[r][c].value;
            if (selectedValue === 0) return; 
            for (let rr = 0; rr < 9; rr++) {
                for (let cc = 0; cc < 9; cc++) {
                    if (this.board[rr][cc].value === selectedValue) {
                        this.highlightedNumberCells.push({ r: rr, c: cc });
                    }
                }
            }
        },
        
        getPeers(r, c) {
            const peers = []; const peerSet = new Set();
            for (let col = 0; col < 9; col++) if (col !== c) peerSet.add(`${r}-${col}`);
            for (let row = 0; row < 9; row++) if (row !== r) peerSet.add(`${row}-${c}`);
            const startRow = Math.floor(r / 3) * 3; const startCol = Math.floor(c / 3) * 3;
            for (let row = startRow; row < startRow + 3; row++) { for (let col = startCol; col < startCol + 3; col++) { if (row !== r || col !== c) peerSet.add(`${row}-${col}`); } }
            peerSet.forEach(coord => { const [rr, cc] = coord.split('-').map(Number); peers.push({ r: rr, c: cc }); });
            return peers;
        },

        hasNoteConflict(r, c, noteNum) { 
            const peers = this.getPeers(r, c);
            for (const peer of peers) { if (this.board[peer.r][peer.c].value !== 0 && this.board[peer.r][peer.c].value === noteNum) { return true; } }
            return false;
        },

        // --- 修改後的 Input 和 Click 函式 ---

        handleKeydown(event) {
             if (event.key.toLowerCase() === 'p' && this.gameState === 'playing') { event.preventDefault(); this.pauseGame(); return; }
             if ((event.key === 'Escape' || event.key.toLowerCase() === 'p') && this.gameState === 'paused') { event.preventDefault(); this.resumeGame(); return; }
             if (event.key === 'Escape' && this.showStats) { event.preventDefault(); this.toggleStats(false); return; }
             if ((this.gameState === 'won' || this.gameState === 'gameOver') && event.key === 'Escape' && this.selectedCell) { this.selectedCell = null; this.clearHighlights(); return; } 
             if (this.gameState !== 'playing') return;
             if (event.key.toLowerCase() === 'n') { event.preventDefault(); this.isNoteMode = !this.isNoteMode; return; }
             if (!this.selectedCell) return;
             const { row, col } = this.selectedCell; const cell = this.board[row][col];
             if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) { event.preventDefault(); this.moveSelection(event.key); return; }
             if (cell.isGiven || cell.isLocked) return;
             if (event.key >= '1' && event.key <= '9') { event.preventDefault(); this.handleNumberInput(parseInt(event.key)); } 
             else if (event.key === '0' || event.key === 'Backspace' || event.key === 'Delete') { event.preventDefault(); this.handleNumberInput(0); }
        },
        
        moveSelection(direction) { 
            if (this.gameState === 'menu' || this.gameState === 'paused' || !this.selectedCell) return;
            let { row, col } = this.selectedCell;
            if (direction === 'ArrowUp')    row = Math.max(0, row - 1);
            if (direction === 'ArrowDown')  row = Math.min(8, row + 1);
            if (direction === 'ArrowLeft')  col = Math.max(0, col - 1);
            if (direction === 'ArrowRight') col = Math.min(8, col + 1);
            this.selectedCell = { row, col }; this.updateRelatedCells(row, col); this.updateHighlightedNumberCells(row, col); 
        },
        
        isSelected(r, c) { 
            return this.selectedCell && this.selectedCell.row === r && this.selectedCell.col === c;
        },

        handleCellClick(r, c) { 
            if (this.gameState === 'paused' || this.gameState === 'menu') { this.selectedCell = null; this.clearHighlights(); return; }
            this.selectedCell = { row: r, col: c }; this.updateRelatedCells(r, c); this.updateHighlightedNumberCells(r, c); 
        },

        // 【修改】
        handleNumberInput(num) {
            if (this.gameState !== 'playing' || !this.selectedCell) return;
            const { row, col } = this.selectedCell;
            const cell = this.board[row][col];

            if (cell.isGiven || cell.isLocked) return;

            const oldValue = cell.value;

            if (this.isNoteMode) {
                // --- 筆記模式 ---
                if (num === 0) {
                    cell.notes = Array(9).fill(false);
                    if (oldValue !== 0) { cell.value = 0; cell.isError = false; }
                } else {
                    if (this.hasNoteConflict(row, col, num)) {
                        this.message = `筆記 ${num} 與已有數字衝突`; this.messageClass = 'text-orange-600';
                        setTimeout(() => { if (this.message === `筆記 ${num} 與已有數字衝突`) { this.message = ''; this.messageClass = ''; } }, 1500);
                        this.remainSelected(row, col);
                        return;
                    }
                    const newNotes = [...cell.notes]; newNotes[num - 1] = !newNotes[num - 1]; cell.notes = newNotes;
                    if (oldValue !== 0) { cell.value = 0; cell.isError = false; }
                }

            } else {
                // --- 數字模式 ---
                if (num === 0) { // Delete number
                    if (oldValue !== 0) { cell.value = 0; cell.isError = false; }
                } else { // Enter number 1-9
                    if (oldValue === num) return;

                    cell.value = num;
                    cell.notes = Array(9).fill(false);

                    const index = row * 9 + col;
                    const correctVal = parseInt(this.currentSolutionString[index]);

                    if (num === correctVal) {
                        // --- 正確答案 ---
                        cell.isLocked = true;
                        cell.isError = false;

                        // 【新增】清除 Peers 中衝突的筆記
                        const peers = this.getPeers(row, col);
                        peers.forEach(peer => {
                            const peerCell = this.board[peer.r][peer.c];
                            if (peerCell.notes[num - 1]) { // 如果 peer 有這個數字的筆記
                                const newNotes = [...peerCell.notes];
                                newNotes[num - 1] = false;
                                peerCell.notes = newNotes;
                            }
                        });

                    } else {
                        // --- 錯誤答案 ---
                        cell.isLocked = false;
                        cell.isError = true;
                        this.errorCount++;

                        if (this.errorCount >= this.maxErrors) {
                            this.stopTimer(); this.gameState = 'gameOver';
                            this.message = '錯誤次數過多，遊戲失敗！'; this.messageClass = 'text-red-600';
                            this.recordGame('lost'); this.saveStats();
                            this.selectedCell = null; this.clearHighlights();
                            return;
                        }
                    }
                }
                // 檢查棋盤是否已滿
                const isBoardFull = this.board.every(r => r.every(c => c.value !== 0));
                if (isBoardFull) {
                    this.checkSolution(); // 自動檢查
                }
            }

            this.updateHighlightedNumberCells(row, col);

            // 確保焦點回到當前選中的格子
            this.remainSelected(row, col);
        },
        
        // --- 檢查和解答函式 (不變) ---
        checkSolution() { 
            if (this.gameState === 'won' || this.gameState === 'gameOver') return; 
            if (this.gameState === 'playing') {
                let isComplete = true; let hasErrors = false;
                for (let r=0; r<9; r++) for (let c=0; c<9; c++) if (!this.board[r][c].isGiven && !this.board[r][c].isLocked) this.board[r][c].isError = false; 
                for (let r = 0; r < 9; r++) { for (let c = 0; c < 9; c++) { const cell = this.board[r][c]; const index = r * 9 + c; const correctVal = parseInt(this.currentSolutionString[index]); if (!cell.isLocked && cell.value === 0) isComplete = false; else if (!cell.isLocked && cell.value !== correctVal) { hasErrors = true; cell.isError = true; } } }
                if (isComplete && !hasErrors) { this.stopTimer(); this.gameState = 'won'; this.message = `恭喜你！完成時間 ${this.formatTime(this.timer)}`; this.messageClass = 'text-green-600'; this.selectedCell = null; this.clearHighlights(); const stats = this.stats.levels[this.selectedDifficulty]; stats.won++; stats.totalTime += this.timer; if (stats.bestTime === null || this.timer < stats.bestTime) stats.bestTime = this.timer; this.stats.currentStreak++; if (this.stats.currentStreak > this.stats.bestStreak) this.stats.bestStreak = this.stats.currentStreak; this.recordGame('won'); this.saveStats(); } 
                else if (isComplete && hasErrors) { this.message = '已完成，但仍有錯誤。'; this.messageClass = 'text-red-600'; } 
                else { for (let r=0; r<9; r++) for (let c=0; c<9; c++) if (!this.board[r][c].isGiven && !this.board[r][c].isLocked) this.board[r][c].isError = false; this.message = '尚未完成，請繼續。'; this.messageClass = 'text-yellow-600'; }
            }
         },
        showSolution() { 
             this.stopTimer(); if (this.gameState === 'playing') { this.recordGame('lost'); this.stats.currentStreak = 0; this.saveStats(); } this.gameState = 'gameOver'; this.clearHighlights(); 
             for (let r = 0; r < 9; r++) { for (let c = 0; c < 9; c++) { const index = r * 9 + c; const solutionVal = parseInt(this.currentSolutionString[index]); const isGiven = (this.currentPuzzleString[index] !== '.'); this.board[r][c].value = solutionVal; this.board[r][c].isGiven = isGiven; this.board[r][c].isError = false; this.board[r][c].notes = Array(9).fill(false); this.board[r][c].isLocked = true; } }
             this.message = '已顯示解答。'; this.messageClass = 'text-blue-600';
        },

        remainSelected(row, col){
            setTimeout(() => {
                const selectedElement = document.querySelector(`[data-row="${row}"][data-col="${col}"]`);
                if (selectedElement) {
                    selectedElement.click();
                }
            }, 0);
        }
    } 
}
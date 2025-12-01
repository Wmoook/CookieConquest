// Cookie Conquest - Multiplayer Game Client
// Matches Tutorial UI style exactly

class MultiplayerGame {
    constructor() {
        this.socket = io();
        this.playerId = null;
        this.lobbyCode = null;
        this.playerName = null;
        this.gameState = null;
        this.isGameActive = false;
        
        // Click tracking for CPS
        this.clickTimes = [];
        this.currentCPS = 0;
        this.clickMultiplier = 1;
        
        // Chart state for smooth animations
        this.chartState = {};
        this.chartViewport = {};
        this.displayValues = {};
        this.lastChartTime = performance.now();
        
        // Cookie history tracking (for charts)
        this.playerHistory = {}; // playerId -> { cookies: [], velocity: [] }
        
        // Leverage per target
        this.targetLeverage = {}; // playerId -> leverage
        
        this.init();
    }
    
    // Helper to find the current player in game state
    getMe() {
        if (!this.gameState) return null;
        return this.gameState.players.find(p => 
            p.name.toLowerCase() === this.playerName?.toLowerCase() || p.id === this.playerId
        );
    }
    
    // Helper to check if a player is me
    isMe(player) {
        if (!player) return false;
        return player.name.toLowerCase() === this.playerName?.toLowerCase() || player.id === this.playerId;
    }
    
    init() {
        // Get lobby info from sessionStorage
        this.lobbyCode = sessionStorage.getItem('lobbyCode');
        this.playerName = sessionStorage.getItem('playerName');
        
        console.log('Game init - lobbyCode:', this.lobbyCode, 'playerName:', this.playerName);
        
        if (!this.lobbyCode || !this.playerName) {
            console.log('Missing session data, redirecting to home');
            window.location.href = '/';
            return;
        }
        
        this.bindSocketEvents();
        this.bindUIEvents();
        
        console.log('Emitting lobby:join with code:', this.lobbyCode, 'name:', this.playerName);
        
        // Rejoin the lobby/game
        this.socket.emit('lobby:join', { 
            code: this.lobbyCode, 
            playerName: this.playerName 
        });
        
        // Show loading state
        this.showLoading('Connecting to game...');
    }
    
    bindSocketEvents() {
        this.socket.on('connect', () => {
            console.log('Connected to server:', this.socket.id);
            this.playerId = this.socket.id;
        });
        
        this.socket.on('lobby:joined', (lobby) => {
            console.log('Joined lobby:', lobby);
            this.lobbyCode = lobby.code;
            
            // If game already started, wait for game:started
            if (lobby.inGame) {
                this.showLoading('Rejoining game...');
            }
        });
        
        this.socket.on('lobby:error', (error) => {
            console.error('Lobby error received:', error);
            console.error('Current state - lobbyCode:', this.lobbyCode, 'playerName:', this.playerName);
            alert('Error: ' + error);
            window.location.href = '/';
        });
        
        this.socket.on('game:started', (gameState) => {
            console.log('Game started:', gameState);
            this.gameState = gameState;
            this.isGameActive = true;
            
            // Find my player in the game state
            const myPlayer = gameState.players.find(p => p.name.toLowerCase() === this.playerName.toLowerCase());
            if (myPlayer) {
                this.playerId = myPlayer.id;
                console.log('Found my player ID:', this.playerId);
            } else {
                console.log('Could not find my player, using socket ID:', this.playerId);
            }
            
            this.hideLoading();
            try {
                this.initializeGame();
            } catch (e) {
                console.error('Error initializing game:', e);
                alert('Error loading game: ' + e.message);
            }
        });
        
        this.socket.on('game:state', (gameState) => {
            this.gameState = gameState;
            this.updateFromServerState();
        });
        
        this.socket.on('game:positionOpened', ({ by }) => {
            this.showNotification(`👁️ ${by} opened a position on YOU!`, 'warning');
        });
        
        this.socket.on('game:notification', ({ type, message }) => {
            // Market impact notifications
            this.showNotification(message, type === 'market' ? 'info' : 'info');
        });
        
        this.socket.on('game:liquidated', ({ position }) => {
            console.log('RECEIVED game:liquidated', position);
            this.showNotification(`💀 LIQUIDATED! Lost ${position.stake}🍪 on ${position.targetName}!`, 'error');
        });
        
        this.socket.on('game:youLiquidatedSomeone', ({ from, amount }) => {
            console.log('RECEIVED game:youLiquidatedSomeone', from, amount);
            this.showNotification(`🎉 You LIQUIDATED ${from}! Gained ${amount}🍪!`, 'success');
        });
        
        this.socket.on('game:maxPayout', ({ position, amount }) => {
            console.log('RECEIVED game:maxPayout', position, amount);
            this.showNotification(`🎯 MAX PAYOUT on ${position.targetName}! Won ${amount}🍪!`, 'success');
        });
        
        this.socket.on('game:winner', (winner) => {
            this.isGameActive = false;
            const isMe = winner.id === this.playerId;
            this.showVictoryScreen(winner.name, winner.cookies, isMe);
        });
        
        this.socket.on('disconnect', () => {
            console.log('Disconnected from server');
            this.showNotification('Connection lost! Reconnecting...', 'error');
        });
    }
    
    bindUIEvents() {
        // Global click handler for close buttons (using document-level delegation)
        document.addEventListener('click', (e) => {
            const btn = e.target.closest('.close-position-btn');
            if (btn) {
                e.preventDefault();
                e.stopPropagation();
                const positionId = btn.getAttribute('data-close-main-position');
                console.log('GLOBAL: Close button clicked, positionId:', positionId);
                this.closePosition(positionId);
            }
        });
        
        // Cookie click
        const cookie = document.getElementById('big-cookie');
        if (cookie) {
            console.log('Cookie button found, binding click handler');
            cookie.addEventListener('click', (e) => {
                console.log('Cookie clicked!');
                this.handleCookieClick(e);
            });
        } else {
            console.error('Cookie button not found!');
        }
        
        // Tab clicks
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => this.handleTabClick(btn.dataset.tab));
        });
        
        // Generator clicks
        document.querySelectorAll('.generator-btn:not(.click-upgrade-btn)').forEach(btn => {
            btn.addEventListener('click', () => this.handleGeneratorClick(btn.dataset.generator));
        });
        
        // Click power upgrade button
        const upgradeClickBtn = document.getElementById('upgrade-click');
        if (upgradeClickBtn) {
            upgradeClickBtn.addEventListener('click', () => this.handleClickUpgrade());
        }
        
        // Give up button
        const giveUpBtn = document.getElementById('give-up-btn');
        if (giveUpBtn) {
            giveUpBtn.addEventListener('click', () => this.giveUp());
        }
    }
    
    initializeGame() {
        console.log('Initializing game with state:', this.gameState);
        console.log('My playerName:', this.playerName, 'My playerId:', this.playerId);
        
        // Display lobby code
        const lobbyCodeEl = document.getElementById('lobby-code');
        if (lobbyCodeEl) {
            lobbyCodeEl.textContent = 'LOBBY: ' + this.lobbyCode;
        }
        
        // Initialize chart data for all players - use player NAME as key for stability
        this.gameState.players.forEach(player => {
            const isMe = this.isMe(player);
            const chartId = isMe ? 'you' : player.name; // Use name instead of id
            
            console.log(`Player ${player.name} (${player.id}): isMe=${isMe}, chartId=${chartId}`);
            
            this.playerHistory[player.name] = {
                cookies: [player.cookies || 0],
                fullCookies: [player.cookies || 0],
                velocity: [player.cps || 0],
                fullVelocity: [player.cps || 0]
            };
            
            this.chartState[chartId] = { smoothData: [] };
            this.chartViewport[chartId] = { viewStart: 0, viewEnd: null, zoom: 1, isDragging: false, lastX: 0, isAll: true };
            this.displayValues[player.name] = player.cookies || 0;
            this.targetLeverage[player.id] = 2; // Default to 2x leverage
        });
        
        // Create player cards
        this.createPlayerCards();
        
        // Start animation loop
        this.startChartSystem();
        
        // Start CPS tracking
        this.startCPSTracking();
    }
    
    createPlayerCards() {
        const playersGrid = document.getElementById('players-grid');
        if (!playersGrid) {
            console.error('players-grid element not found!');
            return;
        }
        
        playersGrid.innerHTML = '';
        
        // Sort players: me first, then others (match by name since socket ID may have changed)
        const me = this.getMe();
        const others = this.gameState.players.filter(p => !this.isMe(p));
        const sortedPlayers = me ? [me, ...others] : others;
        
        console.log('Creating cards for players:', sortedPlayers.map(p => p.name));
        
        sortedPlayers.forEach((player, index) => {
            const isMe = this.isMe(player);
            const chartId = isMe ? 'you' : player.name; // Use name for chart ID
            
            const card = document.createElement('div');
            card.className = `player-stock-card ${isMe ? 'you' : 'tradeable'}`;
            card.id = `card-${player.name}`;
            
            card.innerHTML = `
                <div class="stock-header">
                    <div class="stock-header-left">
                        <div class="player-rank" id="rank-${chartId}">#${index + 1}</div>
                        <span class="player-name" style="color:${isMe ? '#2ecc71' : '#e74c3c'}">${isMe ? 'YOU' : player.name}</span>
                    </div>
                    <div class="stock-stats">
                        <span class="stat-total" id="score-${chartId}">${player.cookies || 0} 🍪</span>
                        ${isMe ? `<span class="stat-locked" id="locked-margin">🔒 0</span>` : ''}
                        <span class="stat-velocity up" id="vel-${chartId}">+0/s</span>
                    </div>
                </div>
                
                <div class="chart-container" data-chart="${chartId}">
                    <canvas class="chart-canvas" id="chart-${chartId}"></canvas>
                    <div class="chart-overlay"></div>
                    <div class="chart-change flat" id="change-${chartId}">0%</div>
                    <div class="chart-controls">
                        <button class="zoom-btn zoom-in" data-chart="${chartId}">+</button>
                        <button class="zoom-btn zoom-out" data-chart="${chartId}">−</button>
                        <button class="zoom-btn zoom-all" data-chart="${chartId}">ALL</button>
                        <button class="zoom-btn zoom-live" data-chart="${chartId}">LIVE</button>
                    </div>
                </div>
                
                ${!isMe ? `
                    <div class="card-actions">
                        <div class="trade-controls">
                            <div class="leverage-select">
                                ${[2,5,10].map(lev => 
                                    `<button class="lev-btn ${lev === 2 ? 'active' : ''}" data-lev="${lev}" data-target="${player.name}">${lev}x</button>`
                                ).join('')}
                            </div>
                            <div class="stake-row">
                                <input type="number" class="stake-input" id="stake-${player.name}" value="10" min="1">
                                <button class="max-stake-btn" data-target="${player.name}">MAX</button>
                            </div>
                        </div>
                        <div class="quick-trade-btns">
                            <button class="quick-trade-btn long" data-target="${player.name}" data-action="long">
                                <span class="btn-label">📈 LONG</span>
                                <span class="btn-leverage" id="lev-display-${player.name}">2x</span>
                            </button>
                            <button class="quick-trade-btn short" data-target="${player.name}" data-action="short">
                                <span class="btn-label">📉 SHORT</span>
                                <span class="btn-leverage">2x</span>
                            </button>
                        </div>
                        <div class="active-position" id="pos-${player.name}"></div>
                    </div>
                ` : `
                    <div class="positions-on-me-section">
                        <div class="positions-on-me-header">📊 Positions on YOU</div>
                        <div class="positions-on-me-list" id="positions-on-me-list"></div>
                    </div>
                `}
            `;
            
            playersGrid.appendChild(card);
        });
        
        // Bind trading controls
        this.bindTradingControls();
        this.bindZoomControls();
    }
    
    bindTradingControls() {
        // Leverage buttons
        document.querySelectorAll('.lev-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const lev = parseInt(btn.dataset.lev);
                const targetId = btn.dataset.target;
                
                // Update active state
                btn.closest('.leverage-select').querySelectorAll('.lev-btn').forEach(b => {
                    b.classList.remove('active');
                });
                btn.classList.add('active');
                
                this.targetLeverage[targetId] = lev;
                
                // Update leverage display on trade buttons
                const card = btn.closest('.player-stock-card');
                card.querySelectorAll('.btn-leverage').forEach(el => {
                    el.textContent = lev + 'x';
                });
            });
        });
        
        // MAX stake buttons
        document.querySelectorAll('.max-stake-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const targetId = btn.dataset.target;
                const maxStake = this.calculateMaxStake(targetId);
                const stakeInput = document.getElementById(`stake-${targetId}`);
                if (stakeInput && maxStake > 0) {
                    stakeInput.value = maxStake;
                    this.showNotification(`Max stake: ${maxStake}🍪`, 'info');
                } else if (maxStake <= 0) {
                    this.showNotification(`Can't trade on this player yet!`, 'error');
                }
            });
        });
        
        // Quick trade buttons
        document.querySelectorAll('.quick-trade-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const targetId = btn.dataset.target;
                const action = btn.dataset.action;
                this.executeQuickTrade(targetId, action);
            });
        });
    }
    
    bindZoomControls() {
        // For each chart container
        document.querySelectorAll('.chart-container').forEach(container => {
            const chartId = container.dataset.chart;
            const canvas = container.querySelector('canvas');
            if (!canvas || !chartId) return;
            
            // Mouse wheel = zoom
            container.addEventListener('wheel', (e) => {
                e.preventDefault();
                const vp = this.chartViewport[chartId];
                if (!vp) return;
                
                if (e.deltaY < 0) {
                    vp.zoom = Math.min(5, vp.zoom * 1.2);
                } else {
                    vp.zoom = Math.max(0.2, vp.zoom / 1.2);
                }
            }, { passive: false });
            
            // Mouse drag = pan
            container.addEventListener('mousedown', (e) => {
                if (e.button !== 0) return;
                const vp = this.chartViewport[chartId];
                if (!vp) return;
                
                vp.isDragging = true;
                vp.lastX = e.clientX;
                container.style.cursor = 'grabbing';
                e.preventDefault();
            });
            
            container.addEventListener('mousemove', (e) => {
                const vp = this.chartViewport[chartId];
                if (!vp || !vp.isDragging) return;
                
                const deltaX = e.clientX - vp.lastX;
                vp.lastX = e.clientX;
                
                const fullLen = this.getFullHistoryLength(chartId);
                const visiblePoints = Math.max(10, Math.floor(60 / vp.zoom));
                const pointsPerPixel = visiblePoints / 300;
                const pointsDelta = deltaX * pointsPerPixel;
                
                if (vp.viewEnd === null) {
                    vp.viewEnd = fullLen;
                }
                
                vp.viewEnd = Math.max(visiblePoints, Math.min(fullLen, vp.viewEnd - pointsDelta));
                vp.isAll = false; // Dragging exits ALL mode
                
                if (vp.viewEnd >= fullLen - 1) {
                    vp.viewEnd = null;
                }
            });
            
            const stopDrag = () => {
                const vp = this.chartViewport[chartId];
                if (vp) vp.isDragging = false;
                container.style.cursor = 'crosshair';
            };
            
            container.addEventListener('mouseup', stopDrag);
            container.addEventListener('mouseleave', stopDrag);
            container.style.cursor = 'crosshair';
        });
        
        // Zoom buttons
        document.querySelectorAll('.zoom-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                const chartId = btn.dataset.chart;
                if (!chartId) return;
                
                const vp = this.chartViewport[chartId];
                if (!vp) return;
                
                const fullLen = this.getFullHistoryLength(chartId);
                
                if (btn.classList.contains('zoom-in')) {
                    vp.zoom = Math.min(5, vp.zoom * 1.5);
                    vp.isAll = false;
                } else if (btn.classList.contains('zoom-out')) {
                    vp.zoom = Math.max(0.01, vp.zoom / 1.5);
                    vp.isAll = false;
                } else if (btn.classList.contains('zoom-all')) {
                    // Show ALL history - this mode auto-adjusts zoom as data grows
                    vp.isAll = true;
                    vp.viewEnd = null; // Keep live
                } else if (btn.classList.contains('zoom-live')) {
                    // Go live - show most recent data at normal zoom
                    vp.viewEnd = null;
                    vp.zoom = 1;
                    vp.isAll = false;
                }
            });
        });
    }
    
    getFullHistoryLength(chartId) {
        // chartId is either 'you' or player name
        const playerName = chartId === 'you' ? this.playerName : chartId;
        const history = this.playerHistory[playerName];
        return history ? history.fullCookies.length : 60;
    }
    
    getViewportData(chartId) {
        const vp = this.chartViewport[chartId];
        if (!vp) return { data: [], isLive: true };
        
        // chartId is either 'you' or player name
        const playerName = chartId === 'you' ? this.playerName : chartId;
        const history = this.playerHistory[playerName];
        if (!history) return { data: [], isLive: true };
        
        const fullData = history.fullCookies;
        const fullLen = fullData.length;
        
        // In ALL mode, dynamically adjust zoom to show everything
        if (vp.isAll) {
            vp.zoom = 60 / Math.max(60, fullLen);
        }
        
        const visiblePoints = Math.floor(60 / vp.zoom);
        
        const endIdx = vp.viewEnd !== null ? vp.viewEnd : fullLen;
        const startIdx = Math.max(0, endIdx - visiblePoints);
        
        if (vp.viewEnd === null) {
            vp.viewStart = startIdx;
        }
        
        return {
            data: fullData.slice(startIdx, endIdx),
            isLive: vp.viewEnd === null,
            startIdx,
            endIdx,
            fullLen
        };
    }
    
    calculateMaxStake(targetName) {
        if (!this.gameState) return 0;
        
        const me = this.getMe();
        const target = this.gameState.players.find(p => p.name === targetName);
        if (!me || !target) return 0;
        
        const MIN_ENTRY_PRICE = 100;
        if (target.cookies < MIN_ENTRY_PRICE) return 0;
        
        // Available = my cookies - locked in positions
        const lockedMargin = me.positions.reduce((sum, p) => sum + p.stake, 0);
        const available = me.cookies - lockedMargin;
        
        const maxFromTarget = Math.floor(target.cookies * 0.5);
        
        // Check if already have position on target
        const existingPos = me.positions.find(p => p.targetName === targetName);
        if (existingPos) {
            const maxAdd = maxFromTarget - existingPos.stake;
            return Math.max(0, Math.min(maxAdd, Math.floor(available)));
        }
        
        return Math.min(maxFromTarget, Math.floor(available));
    }
    
    executeQuickTrade(targetName, action) {
        if (!this.gameState) return;
        
        const stakeInput = document.getElementById(`stake-${targetName}`);
        const stake = parseInt(stakeInput?.value) || 10;
        const leverage = this.targetLeverage[targetName] || 2;
        
        const me = this.getMe();
        const target = this.gameState.players.find(p => p.name === targetName);
        
        if (!me || !target) {
            console.log('executeQuickTrade: Could not find me or target', { me, targetName, players: this.gameState.players.map(p => p.name) });
            return;
        }
        
        // Validate
        const lockedMargin = me.positions.reduce((sum, p) => sum + p.stake, 0);
        const available = me.cookies - lockedMargin;
        
        if (stake > available) {
            this.showNotification(`Not enough available cookies! (${Math.floor(available)} free)`, 'error');
            return;
        }
        
        if (stake < 1) {
            this.showNotification('Minimum stake is 1 cookie', 'error');
            return;
        }
        
        const MIN_ENTRY_PRICE = 100;
        if (target.cookies < MIN_ENTRY_PRICE) {
            this.showNotification(`${target.name} needs at least ${MIN_ENTRY_PRICE}🍪 to trade on!`, 'error');
            return;
        }
        

        
        // Send to server using targetName (stable identifier)
        this.socket.emit('game:openPosition', {
            targetName,
            type: action,
            stake,
            leverage
        });
        
        this.showNotification(`Opening ${action.toUpperCase()} on ${target.name} - ${stake}🍪 @ ${leverage}x`, 'info');
    }
    
    closePosition(positionId) {
        console.log('closePosition called with positionId:', positionId);
        this.socket.emit('game:closePosition', positionId);
    }
    
    startChartSystem() {
        this.resizeCharts();
        window.addEventListener('resize', () => this.resizeCharts());
        this.animateCharts();
    }
    
    resizeCharts() {
        document.querySelectorAll('.chart-canvas').forEach(canvas => {
            const container = canvas.parentElement;
            if (container) {
                const rect = container.getBoundingClientRect();
                canvas.width = rect.width * window.devicePixelRatio;
                canvas.height = rect.height * window.devicePixelRatio;
                canvas.style.width = rect.width + 'px';
                canvas.style.height = rect.height + 'px';
                
                const ctx = canvas.getContext('2d');
                ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
            }
        });
    }
    
    animateCharts() {
        if (!this.isGameActive) return;
        
        const now = performance.now();
        const dt = (now - this.lastChartTime) / 1000;
        this.lastChartTime = now;
        
        const smoothFactor = Math.min(1, dt * 6);
        
        // Smooth cookie display values
        if (this.gameState) {
            this.gameState.players.forEach(player => {
                const unrealizedPnl = this.calculateUnrealizedPnl(player);
                const targetCookies = player.cookies + unrealizedPnl;
                this.displayValues[player.name] = this.displayValues[player.name] || 0;
                this.displayValues[player.name] += (targetCookies - this.displayValues[player.name]) * smoothFactor;
            });
        }
        
        // Render each player's chart
        if (this.gameState) {
            this.gameState.players.forEach((player, index) => {
                const isMe = this.isMe(player);
                const chartId = isMe ? 'you' : player.name;
                
                const viewport = this.getViewportData(chartId);
                this.updateSmoothData(chartId, viewport.data, dt, viewport.isLive);
                
                const smoothCookies = this.displayValues[player.name] || 0;
                const history = this.playerHistory[player.name];
                const velocityData = history ? history.velocity : [];
                
                // Always use green for "you", red for opponents
                const chartColor = isMe ? '#2ecc71' : '#e74c3c';
                this.renderSmoothChart(`chart-${chartId}`, this.chartState[chartId]?.smoothData || [], chartColor, chartId, smoothCookies, velocityData, player, viewport);
            });
        }
        
        // Update displays
        this.updateSmoothDisplays();
        this.updateScoreboard();
        this.updatePositionsPanel();
        
        requestAnimationFrame(() => this.animateCharts());
    }
    
    updateSmoothData(id, rawData, dt, isLive) {
        if (!this.chartState[id]) {
            this.chartState[id] = { smoothData: [] };
        }
        
        const state = this.chartState[id];
        const targetData = rawData || [];
        
        if (!isLive) {
            state.smoothData = [...targetData];
            return;
        }
        
        if (state.smoothData.length === 0 && targetData.length > 0) {
            state.smoothData = [...targetData];
        }
        
        const lerp = Math.min(1, dt * 10);
        
        while (state.smoothData.length < targetData.length) {
            const prevVal = state.smoothData.length > 0 ? state.smoothData[state.smoothData.length - 1] : targetData[state.smoothData.length];
            state.smoothData.push(prevVal);
        }
        
        while (state.smoothData.length > targetData.length) {
            state.smoothData.shift();
        }
        
        for (let i = 0; i < state.smoothData.length && i < targetData.length; i++) {
            state.smoothData[i] += (targetData[i] - state.smoothData[i]) * lerp;
        }
    }
    
    renderSmoothChart(canvasId, data, color, labelId, totalCookies, velocityData, player, viewport) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) {
            console.warn('Canvas not found:', canvasId);
            return;
        }
        
        const ctx = canvas.getContext('2d');
        const W = canvas.width / window.devicePixelRatio;
        const H = canvas.height / window.devicePixelRatio;
        
        const MARGIN_LEFT = 45;
        const CHART_W = W - MARGIN_LEFT;
        
        // Clear
        ctx.clearRect(0, 0, W, H);
        
        // Background
        const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
        bgGrad.addColorStop(0, '#0a0a14');
        bgGrad.addColorStop(1, '#050508');
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, W, H);
        
        if (!data || data.length < 2) {
            ctx.fillStyle = 'rgba(255,255,255,0.3)';
            ctx.font = '12px Arial';
            ctx.fillText('Loading...', W/2 - 30, H/2);
            return;
        }
        
        // Calculate bounds - allow negative values for debt display
        let min = Math.min(...data);
        let max = Math.max(...data);
        const padding = (max - min) * 0.15 || 10;
        min = min - padding; // Allow negative values
        max += padding;
        const range = max - min || 1;
        
        // Y-axis labels
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.font = '10px Arial';
        ctx.textAlign = 'right';
        
        for (let i = 0; i <= 4; i++) {
            const price = min + (range * (4 - i) / 4);
            const y = (i / 4) * H;
            
            let priceText;
            if (price >= 10000) {
                priceText = (price / 1000).toFixed(1) + 'K';
            } else if (price >= 1000) {
                priceText = (price / 1000).toFixed(2) + 'K';
            } else {
                priceText = Math.floor(price).toString();
            }
            
            ctx.fillStyle = 'rgba(255,255,255,0.5)';
            ctx.fillText(priceText, MARGIN_LEFT - 5, y + 4);
            
            ctx.strokeStyle = 'rgba(255,255,255,0.08)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(MARGIN_LEFT, y);
            ctx.lineTo(W, y);
            ctx.stroke();
        }
        
        // Y-axis line
        ctx.strokeStyle = 'rgba(255,255,255,0.2)';
        ctx.beginPath();
        ctx.moveTo(MARGIN_LEFT, 0);
        ctx.lineTo(MARGIN_LEFT, H);
        ctx.stroke();
        
        // Draw zero line if chart includes negative values
        if (min < 0) {
            const zeroY = H - ((0 - min) / range) * H;
            ctx.strokeStyle = 'rgba(231, 76, 60, 0.6)';
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 5]);
            ctx.beginPath();
            ctx.moveTo(MARGIN_LEFT, zeroY);
            ctx.lineTo(W, zeroY);
            ctx.stroke();
            ctx.setLineDash([]);
            
            // Label
            ctx.fillStyle = '#e74c3c';
            ctx.font = 'bold 10px Arial';
            ctx.textAlign = 'left';
            ctx.fillText('DEBT', MARGIN_LEFT + 5, zeroY + 15);
        }
        
        // Draw liquidation zones if player has position on this target
        const me = this.getMe();
        if (me && player && !this.isMe(player)) {
            const position = me.positions.find(p => p.target === player.id);
            if (position && position.liquidationPrice) {
                const liqY = H - ((position.liquidationPrice - min) / range) * H;
                const entryY = H - ((position.entryPrice - min) / range) * H;
                
                if (position.type === 'long') {
                    const dangerGrad = ctx.createLinearGradient(0, liqY, 0, H);
                    dangerGrad.addColorStop(0, 'rgba(231,76,60,0.4)');
                    dangerGrad.addColorStop(1, 'rgba(231,76,60,0.05)');
                    ctx.fillStyle = dangerGrad;
                    ctx.fillRect(MARGIN_LEFT, liqY, CHART_W, H - liqY);
                    
                    const safeGrad = ctx.createLinearGradient(0, 0, 0, entryY);
                    safeGrad.addColorStop(0, 'rgba(46,204,113,0.15)');
                    safeGrad.addColorStop(1, 'rgba(46,204,113,0.02)');
                    ctx.fillStyle = safeGrad;
                    ctx.fillRect(MARGIN_LEFT, 0, CHART_W, entryY);
                } else {
                    const dangerGrad = ctx.createLinearGradient(0, 0, 0, liqY);
                    dangerGrad.addColorStop(0, 'rgba(231,76,60,0.05)');
                    dangerGrad.addColorStop(1, 'rgba(231,76,60,0.4)');
                    ctx.fillStyle = dangerGrad;
                    ctx.fillRect(MARGIN_LEFT, 0, CHART_W, liqY);
                    
                    const safeGrad = ctx.createLinearGradient(0, entryY, 0, H);
                    safeGrad.addColorStop(0, 'rgba(46,204,113,0.02)');
                    safeGrad.addColorStop(1, 'rgba(46,204,113,0.15)');
                    ctx.fillStyle = safeGrad;
                    ctx.fillRect(MARGIN_LEFT, entryY, CHART_W, H - entryY);
                }
                
                // Liquidation line
                ctx.setLineDash([4, 4]);
                ctx.strokeStyle = '#e74c3c';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(MARGIN_LEFT, liqY);
                ctx.lineTo(W, liqY);
                ctx.stroke();
                
                ctx.fillStyle = '#e74c3c';
                ctx.font = 'bold 9px Arial';
                ctx.fillText('💀 LIQ', W - 45, liqY - 3);
                
                // Entry line
                ctx.strokeStyle = '#f39c12';
                ctx.beginPath();
                ctx.moveTo(MARGIN_LEFT, entryY);
                ctx.lineTo(W, entryY);
                ctx.stroke();
                
                ctx.fillStyle = '#f39c12';
                ctx.fillText('ENTRY', W - 38, entryY - 3);
                
                ctx.setLineDash([]);
            }
        }
        
        // Calculate chart points
        const points = [];
        for (let i = 0; i < data.length; i++) {
            const x = MARGIN_LEFT + (i / (data.length - 1)) * CHART_W;
            const y = H - ((data[i] - min) / range) * H;
            points.push({ x, y });
        }
        
        // Draw gradient fill
        const fillGrad = ctx.createLinearGradient(0, 0, 0, H);
        fillGrad.addColorStop(0, color + '40');
        fillGrad.addColorStop(0.5, color + '15');
        fillGrad.addColorStop(1, color + '00');
        
        ctx.beginPath();
        ctx.moveTo(MARGIN_LEFT, H);
        points.forEach(p => ctx.lineTo(p.x, p.y));
        ctx.lineTo(W, H);
        ctx.lineTo(MARGIN_LEFT, H);
        ctx.closePath();
        ctx.fillStyle = fillGrad;
        ctx.fill();
        
        // Draw line with glow
        ctx.shadowColor = color;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.strokeStyle = color;
        ctx.lineWidth = 2.5;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        
        ctx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length - 1; i++) {
            const xc = (points[i].x + points[i + 1].x) / 2;
            const yc = (points[i].y + points[i + 1].y) / 2;
            ctx.quadraticCurveTo(points[i].x, points[i].y, xc, yc);
        }
        if (points.length > 1) {
            ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);
        }
        ctx.stroke();
        ctx.shadowBlur = 0;
        
        // Pulsing dot if live
        const isLive = viewport && viewport.isLive;
        if (isLive) {
            const lastPoint = points[points.length - 1];
            const pulse = Math.sin(performance.now() / 200) * 0.3 + 1;
            
            ctx.beginPath();
            ctx.arc(lastPoint.x, lastPoint.y, 8 * pulse, 0, Math.PI * 2);
            ctx.fillStyle = color + '30';
            ctx.fill();
            
            ctx.beginPath();
            ctx.arc(lastPoint.x, lastPoint.y, 4, 0, Math.PI * 2);
            ctx.fillStyle = color;
            ctx.fill();
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 1.5;
            ctx.stroke();
        }
        
        // LIVE/HISTORY badge
        if (viewport) {
            ctx.font = 'bold 9px Arial';
            if (isLive) {
                ctx.fillStyle = '#e74c3c';
                ctx.fillRect(W - 35, 4, 32, 14);
                ctx.fillStyle = '#fff';
                ctx.fillText('LIVE', W - 30, 14);
            } else {
                ctx.fillStyle = 'rgba(100,200,255,0.8)';
                ctx.fillRect(W - 55, 4, 52, 14);
                ctx.fillStyle = '#fff';
                ctx.fillText('HISTORY', W - 52, 14);
            }
            
            ctx.fillStyle = 'rgba(255,255,255,0.4)';
            ctx.font = '8px Arial';
            ctx.textAlign = 'left';
            ctx.fillText(`${viewport.fullLen} pts`, MARGIN_LEFT + 4, H - 4);
        }
        
        // Update UI elements
        const currentCookies = data[data.length - 1] || 0;
        const oldCookies = data.length > 5 ? data[data.length - 5] : data[0];
        const pctChange = oldCookies > 0 ? ((currentCookies - oldCookies) / oldCookies) * 100 : 0;
        
        const priceEl = document.getElementById('price-' + labelId);
        if (priceEl) {
            if (currentCookies >= 10000) {
                priceEl.textContent = (currentCookies / 1000).toFixed(1) + 'K';
            } else if (currentCookies >= 1000) {
                priceEl.textContent = (currentCookies / 1000).toFixed(2) + 'K';
            } else {
                priceEl.textContent = Math.floor(currentCookies);
            }
        }
        
        const changeEl = document.getElementById('change-' + labelId);
        if (changeEl) {
            if (pctChange > 1) {
                changeEl.textContent = '+' + pctChange.toFixed(1) + '%';
                changeEl.className = 'chart-change up';
            } else if (pctChange < -1) {
                changeEl.textContent = pctChange.toFixed(1) + '%';
                changeEl.className = 'chart-change down';
            } else {
                changeEl.textContent = '0%';
                changeEl.className = 'chart-change flat';
            }
        }
        
        const velEl = document.getElementById('vel-' + labelId);
        if (velEl && velocityData && velocityData.length > 0) {
            const currentVel = velocityData[velocityData.length - 1] || 0;
            velEl.textContent = '+' + currentVel.toFixed(1) + '/s';
            velEl.className = 'stat-velocity up';
        }
        
        // Update score display in card header
        const scoreEl = document.getElementById('score-' + labelId);
        if (scoreEl) {
            const displayCookies = totalCookies || currentCookies;
            if (displayCookies >= 10000) {
                scoreEl.textContent = (displayCookies / 1000).toFixed(1) + 'K 🍪';
            } else if (displayCookies >= 1000) {
                scoreEl.textContent = (displayCookies / 1000).toFixed(2) + 'K 🍪';
            } else {
                scoreEl.textContent = Math.floor(displayCookies) + ' 🍪';
            }
        }
    }
    
    calculateUnrealizedPnl(player) {
        if (!this.gameState || !this.isMe(player)) return 0;
        
        let totalPnl = 0;
        player.positions.forEach(pos => {
            const target = this.gameState.players.find(p => p.name === pos.targetName);
            if (!target) return;
            
            const currentPrice = target.cookies;
            const priceChange = currentPrice - pos.entryPrice;
            const pnlMultiplier = pos.type === 'long' ? 1 : -1;
            const pnl = Math.floor((priceChange / (pos.entryPrice || 1)) * pos.stake * pos.leverage * pnlMultiplier);
            totalPnl += pnl;
        });
        return totalPnl;
    }
    
    // Calculate generator value (90% of what you paid - collateral value)
    calculateGeneratorValue(player) {
        if (!player || !player.generators) return 0;
        
        const basePrices = { grandma: 15, bakery: 100, factory: 500, mine: 2000, bank: 10000, temple: 50000 };
        let totalValue = 0;
        
        for (const [genType, count] of Object.entries(player.generators)) {
            for (let i = 0; i < count; i++) {
                // Each generator is worth 90% of purchase price
                totalValue += Math.floor(basePrices[genType] * Math.pow(1.15, i) * 0.9);
            }
        }
        
        return totalValue;
    }
    
    // Calculate PNL for any position
    calculatePositionPnl(position) {
        const target = this.gameState.players.find(p => p.name === position.targetName);
        if (!target) return 0;
        
        const currentPrice = target.cookies;
        const priceChange = currentPrice - position.entryPrice;
        const pnlMultiplier = position.type === 'long' ? 1 : -1;
        return Math.floor((priceChange / (position.entryPrice || 1)) * position.stake * position.leverage * pnlMultiplier);
    }
    
    updateSmoothDisplays() {
        if (!this.gameState) return;
        
        const me = this.getMe();
        if (!me) return;
        
        // Calculate unrealized PNL
        const unrealizedPnl = this.calculateUnrealizedPnl(me);
        
        // Use player.name as key (stable across reconnections)
        // Include unrealized PNL in cookie display
        const baseCookies = this.displayValues[me.name] || me.cookies || 0;
        const smoothCookies = Math.floor(baseCookies);
        
        // Update main cookie count (includes unrealized PNL since displayValues already accounts for it)
        const cookieCount = document.getElementById('cookie-count');
        if (cookieCount) {
            cookieCount.textContent = smoothCookies.toLocaleString();
        }
        
        // Update goal progress
        const WIN_GOAL = 1000000;
        const progressPercent = Math.min(100, (smoothCookies / WIN_GOAL) * 100);
        const goalProgress = document.getElementById('goal-progress');
        const goalFill = document.getElementById('goal-fill');
        const goalPercent = document.getElementById('goal-percent');
        const goalPercentLeft = document.getElementById('goal-percent-left');
        
        if (goalProgress) goalProgress.style.width = progressPercent.toFixed(2) + '%';
        if (goalFill) goalFill.style.width = progressPercent.toFixed(2) + '%';
        if (goalPercent) goalPercent.textContent = progressPercent.toFixed(1) + '%';
        if (goalPercentLeft) goalPercentLeft.textContent = progressPercent.toFixed(1) + '%';
        
        // Update CPS
        const cpsValue = document.getElementById('cps-value');
        if (cpsValue) cpsValue.textContent = me.cps || 0;
        
        // Calculate and display Net Worth (cookies + generator value + unrealized PNL)
        const generatorValue = this.calculateGeneratorValue(me);
        const netWorth = me.cookies + generatorValue + unrealizedPnl;
        const networthEl = document.getElementById('networth-value');
        if (networthEl) {
            networthEl.textContent = Math.floor(netWorth).toLocaleString();
        }
        
        // Calculate locked margin (stake + unrealized PNL)
        const lockedStake = me.positions.reduce((sum, p) => sum + p.stake, 0);
        const lockedWithPnl = lockedStake + unrealizedPnl;
        
        // Update available cookies (base cookies minus locked stake)
        const availableValue = document.getElementById('available-value');
        if (availableValue) {
            const available = me.cookies - lockedStake;
            availableValue.textContent = Math.floor(available);
        }
        
        const lockedEl = document.getElementById('locked-margin');
        const lockedValue = document.getElementById('locked-value');
        if (lockedEl) {
            if (lockedStake > 0) {
                lockedEl.textContent = `🔒 ${Math.floor(lockedWithPnl)}`;
                lockedEl.style.display = 'inline-block';
            } else {
                lockedEl.style.display = 'none';
            }
        }
        if (lockedValue) {
            // Show locked value including unrealized PNL
            const displayLocked = Math.floor(lockedWithPnl);
            lockedValue.textContent = displayLocked;
            // Color based on PNL
            if (unrealizedPnl > 0) {
                lockedValue.style.color = '#2ecc71';
            } else if (unrealizedPnl < 0) {
                lockedValue.style.color = '#e74c3c';
            } else {
                lockedValue.style.color = '#f1c40f';
            }
        }
        
        // Update total PNL
        const headerPnl = document.getElementById('total-pnl');
        if (headerPnl) {
            headerPnl.textContent = 'PNL: ' + (unrealizedPnl >= 0 ? '+' : '') + unrealizedPnl;
            headerPnl.style.color = unrealizedPnl > 0 ? '#2ecc71' : unrealizedPnl < 0 ? '#e74c3c' : '#888';
        }
        
        // Update generator buttons
        this.updateGeneratorButtons();
    }
    
    updateScoreboard() {
        if (!this.gameState) return;
        
        // Sort players by cookies
        const players = this.gameState.players.map(p => ({
            id: p.id,
            name: p.name,
            cookies: p.cookies
        }));
        players.sort((a, b) => b.cookies - a.cookies);
        
        const ranks = ['#1', '#2', '#3', '#4'];
        
        players.forEach((p, idx) => {
            const chartId = this.isMe(p) ? 'you' : p.name;
            const rankEl = document.getElementById(`rank-${chartId}`);
            if (rankEl) rankEl.textContent = ranks[idx];
        });
    }
    
    updatePositionsPanel() {
        if (!this.gameState) return;
        
        const me = this.getMe();
        console.log('updatePositionsPanel - me:', me?.name, 'positions count:', me?.positions?.length);
        if (!me) return;
        
        // Update card position indicators (inline on player cards)
        this.gameState.players.forEach(player => {
            if (this.isMe(player)) return;
            
            const posEl = document.getElementById(`pos-${player.name}`);
            if (!posEl) return;
            
            const position = me.positions.find(p => p.targetName === player.name);
            
            if (position) {
                const currentPrice = player.cookies;
                const priceChange = currentPrice - position.entryPrice;
                const pnlMultiplier = position.type === 'long' ? 1 : -1;
                const pnl = Math.floor((priceChange / (position.entryPrice || 1)) * position.stake * position.leverage * pnlMultiplier);
                
                const pnlClass = pnl >= 0 ? 'profit' : 'loss';
                const pnlText = pnl >= 0 ? `+${pnl}` : `${pnl}`;
                
                posEl.className = `active-position ${position.type}`;
                posEl.style.display = 'block';
                posEl.innerHTML = `
                    <div class="pos-header">
                        <span class="pos-type ${position.type}">${position.type.toUpperCase()} ${position.leverage}x</span>
                        <span class="pos-pnl ${pnlClass}">${pnlText}🍪</span>
                    </div>
                    <div class="pos-details">
                        <span>Stake: ${position.stake}</span>
                        <span>Entry: ${Math.floor(position.entryPrice)}</span>
                    </div>
                `;
            } else {
                posEl.style.display = 'none';
            }
        });
        
        // Update positions on me (under my chart)
        this.updatePositionsOnMeDisplay(me);
        
        // Update Live Positions in left panel (who has position on whom)
        this.updateLivePositionsDisplay();
        
        // Update MAIN positions panel in center (with close buttons)
        this.updateMainPositionsPanel(me);
    }
    
    updatePositionsOnMeDisplay(me) {
        const container = document.getElementById('positions-on-me-list');
        if (!container) return;
        
        const positionsOnMe = me.positionsOnMe || [];
        
        if (positionsOnMe.length === 0) {
            container.innerHTML = '<div class="no-positions-on-me">No one is trading on you yet</div>';
            return;
        }
        
        container.innerHTML = positionsOnMe.map(pos => {
            const currentPrice = me.cookies;
            const priceChange = currentPrice - pos.entryPrice;
            const pnlMultiplier = pos.type === 'long' ? 1 : -1;
            const pnl = Math.floor((priceChange / (pos.entryPrice || 1)) * pos.stake * pos.leverage * pnlMultiplier);
            
            // Show their PNL with standard colors: green if up, red if down
            const theirPnlClass = pnl >= 0 ? 'positive' : 'negative';
            const theirPnlText = pnl >= 0 ? `+${pnl}` : `${pnl}`;
            
            return `
                <div class="position-on-me-item ${pos.type}">
                    <span class="pom-trader">${pos.ownerName}</span>
                    <span class="pom-type ${pos.type}">${pos.type.toUpperCase()} ${pos.leverage}x</span>
                    <span class="pom-stake">${pos.stake}🍪</span>
                    <span class="pom-pnl ${theirPnlClass}">${theirPnlText}</span>
                </div>
            `;
        }).join('');
    }
    
    // Update the live positions section showing who's targeting who
    updateLivePositionsDisplay() {
        const container = document.getElementById('live-positions-list');
        if (!container) return;
        
        const me = this.getMe();
        if (!me) return;
        
        const allPositions = [];
        
        // My positions on other players
        for (const pos of me.positions) {
            const pnl = this.calculatePositionPnl(pos);
            allPositions.push({
                trader: 'YOU',
                target: pos.targetName,
                isPlayer: true,
                isOpponentOnMe: false,
                pnl: pnl,
                type: pos.type
            });
        }
        
        // Other players' positions on me
        for (const pos of (me.positionsOnMe || [])) {
            // Calculate PNL from opponent's perspective (they have position on me)
            const currentPrice = me.cookies;
            const priceChange = currentPrice - pos.entryPrice;
            const pnlMultiplier = pos.type === 'long' ? 1 : -1;
            const pnl = Math.floor((priceChange / (pos.entryPrice || 1)) * pos.stake * pos.leverage * pnlMultiplier);
            
            allPositions.push({
                trader: pos.ownerName,
                target: 'YOU',
                isPlayer: false,
                isOpponentOnMe: true,
                pnl: pnl,
                type: pos.type
            });
        }
        
        // Other players' positions on each other
        this.gameState.players.forEach(player => {
            if (this.isMe(player)) return;
            
            for (const pos of player.positions || []) {
                // Skip positions on me (already handled above)
                if (pos.targetName.toLowerCase() === me.name.toLowerCase()) continue;
                
                // Calculate their PNL
                const target = this.gameState.players.find(p => p.name === pos.targetName);
                if (!target) continue;
                
                const currentPrice = target.cookies;
                const priceChange = currentPrice - pos.entryPrice;
                const pnlMultiplier = pos.type === 'long' ? 1 : -1;
                const pnl = Math.floor((priceChange / (pos.entryPrice || 1)) * pos.stake * pos.leverage * pnlMultiplier);
                
                allPositions.push({
                    trader: player.name,
                    target: pos.targetName,
                    isPlayer: false,
                    isOpponentOnMe: false,
                    pnl: pnl,
                    type: pos.type
                });
            }
        });
        
        if (allPositions.length === 0) {
            container.innerHTML = '<div class="no-positions">No open positions</div>';
            return;
        }
        
        container.innerHTML = allPositions.map(pos => {
            let classes = 'position-item';
            if (pos.isPlayer) classes += ' player-position';
            if (pos.isOpponentOnMe) classes += ' opponent-on-me';
            
            const pnlClass = pos.pnl >= 0 ? 'profit' : 'loss';
            const pnlText = pos.pnl >= 0 ? `+${pos.pnl}` : `${pos.pnl}`;
            const typeIcon = pos.type === 'long' ? '📈' : '📉';
            
            return `<div class="${classes}">
                <span class="trader">${pos.trader}</span>
                <span class="arrow">${typeIcon}</span>
                <span class="target">${pos.target}</span>
                <span class="pos-pnl-mini ${pnlClass}">${pnlText}🍪</span>
            </div>`;
        }).join('');
    }
    
    updateMainPositionsPanel(me) {
        const list = document.getElementById('main-positions-list');
        const totalPnlEl = document.getElementById('main-positions-pnl');
        if (!list) return;
        
        if (!me || me.positions.length === 0) {
            // Only update if needed
            if (!list.querySelector('.no-positions')) {
                list.innerHTML = '<div class="no-positions">No open positions - Trade on opponent charts!</div>';
            }
            if (totalPnlEl) {
                totalPnlEl.textContent = 'PNL: 0🍪';
                totalPnlEl.className = 'positions-pnl neutral';
            }
            this._lastPositionIds = [];
            return;
        }
        
        // Check if positions changed (different IDs) - only rebuild HTML then
        const currentIds = me.positions.map(p => p.id).sort().join(',');
        const needsRebuild = this._lastPositionIds !== currentIds;
        
        if (needsRebuild) {
            this._lastPositionIds = currentIds;
            
            // Build HTML with buttons
            list.innerHTML = me.positions.map(pos => {
                const target = this.gameState.players.find(p => p.name === pos.targetName);
                if (!target) return '';
                
                return `
                    <div class="position-row ${pos.type}" data-pos-id="${pos.id}">
                        <div class="pos-icon ${pos.type}">${pos.type === 'long' ? '📈' : '📉'}</div>
                        <div class="pos-info">
                            <div class="pos-name" style="color:#e74c3c">${target.name}</div>
                            <div class="pos-meta">${pos.type.toUpperCase()} ${pos.leverage}x | Entry: ${Math.floor(pos.entryPrice)}</div>
                            <div class="pos-liq">💀 LIQ: <span class="liq-value">${Math.floor(pos.liquidationPrice)}</span> (<span class="liq-dist">0</span>%)</div>
                        </div>
                        <div class="pos-values">
                            <div class="pos-current-pnl">0🍪</div>
                            <div class="pos-stake">🔒 ${pos.stake}</div>
                        </div>
                        <div class="pos-actions">
                            <button class="close-position-btn" data-position-id="${pos.id}">CLOSE</button>
                        </div>
                    </div>
                `;
            }).join('');
            
            // Bind click handlers to buttons ONCE after creating them
            list.querySelectorAll('.close-position-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const posId = btn.getAttribute('data-position-id');
                    console.log('Close button clicked! Position ID:', posId);
                    this.closePosition(posId);
                });
            });
        }
        
        // Now just update the PNL values (not the whole HTML)
        let totalPnl = 0;
        me.positions.forEach(pos => {
            const row = list.querySelector(`[data-pos-id="${pos.id}"]`);
            if (!row) return;
            
            const target = this.gameState.players.find(p => p.name === pos.targetName);
            if (!target) return;
            
            const currentPrice = target.cookies;
            const priceChange = currentPrice - pos.entryPrice;
            const pnlMultiplier = pos.type === 'long' ? 1 : -1;
            const pnl = Math.floor((priceChange / (pos.entryPrice || 1)) * pos.stake * pos.leverage * pnlMultiplier);
            totalPnl += pnl;
            
            const pnlClass = pnl >= 0 ? 'profit' : 'loss';
            const pnlText = pnl >= 0 ? `+${pnl}` : `${pnl}`;
            
            const distToLiq = pos.type === 'long' 
                ? ((currentPrice - pos.liquidationPrice) / currentPrice * 100).toFixed(1)
                : ((pos.liquidationPrice - currentPrice) / currentPrice * 100).toFixed(1);
            const liqDanger = parseFloat(distToLiq) < 10 ? 'danger' : parseFloat(distToLiq) < 25 ? 'warning' : 'safe';
            
            // Update just the text content, not the HTML structure
            const pnlEl = row.querySelector('.pos-current-pnl');
            if (pnlEl) {
                pnlEl.textContent = pnlText + '🍪';
                pnlEl.className = 'pos-current-pnl ' + pnlClass;
            }
            
            const liqEl = row.querySelector('.pos-liq');
            if (liqEl) {
                liqEl.className = 'pos-liq ' + liqDanger;
                const liqDistEl = row.querySelector('.liq-dist');
                if (liqDistEl) liqDistEl.textContent = distToLiq;
            }
        });
        
        if (totalPnlEl) {
            totalPnlEl.textContent = 'PNL: ' + (totalPnl >= 0 ? '+' : '') + totalPnl + '🍪';
            totalPnlEl.className = 'positions-pnl ' + (totalPnl > 0 ? 'profit' : totalPnl < 0 ? 'loss' : 'neutral');
        }
    }
    
    updateFromServerState() {
        if (!this.gameState) return;
        
        // Update history for all players - use name as key
        this.gameState.players.forEach(player => {
            if (!this.playerHistory[player.name]) {
                this.playerHistory[player.name] = {
                    cookies: [],
                    fullCookies: [],
                    velocity: [],
                    fullVelocity: []
                };
            }
            
            const history = this.playerHistory[player.name];
            history.cookies.push(player.cookies);
            if (history.cookies.length > 1000) history.cookies.shift();
            history.fullCookies.push(player.cookies);
            
            history.velocity.push(player.cps || 0);
            if (history.velocity.length > 1000) history.velocity.shift();
            history.fullVelocity.push(player.cps || 0);
        });
    }
    
    startCPSTracking() {
        // CPS tracking runs on interval to keep indicator updated
        setInterval(() => {
            this.updateClickSpeed();
        }, 100);
    }
    
    updateCPSIndicator() {
        let cpsIndicator = document.getElementById('cps-indicator');
        if (!cpsIndicator) {
            cpsIndicator = document.createElement('div');
            cpsIndicator.id = 'cps-indicator';
            cpsIndicator.style.cssText = 'position: fixed; top: 60px; right: 10px; background: rgba(0,0,0,0.8); padding: 5px 10px; border-radius: 5px; z-index: 80; font-size: 0.8em; pointer-events: none;';
            document.body.appendChild(cpsIndicator);
        }
        
        const color = this.currentCPS >= 10 ? '#f39c12' : (this.currentCPS >= 5 ? '#2ecc71' : '#fff');
        cpsIndicator.innerHTML = `
            <div style="color: ${color};">${this.currentCPS} CPS</div>
            <div style="color: #888; font-size: 0.8em;">${this.clickMultiplier.toFixed(1)}x</div>
        `;
    }
    
    handleCookieClick(e) {
        console.log('handleCookieClick called, socket connected:', this.socket.connected);
        this.clickTimes.push(Date.now());
        
        // Update click speed for multiplier
        this.updateClickSpeed();
        
        // Get click power from current player state
        const me = this.getMe();
        const clickPower = me?.clickPower || 1;
        
        const cookiesEarned = Math.floor(clickPower * this.clickMultiplier);
        console.log('Emitting game:click with multiplier:', this.clickMultiplier, 'clickPower:', clickPower);
        
        // Send to server WITH multiplier (server will also multiply by clickPower)
        this.socket.emit('game:click', { multiplier: Math.floor(this.clickMultiplier) });
        
        this.showClickFeedback(e, cookiesEarned);
    }
    
    updateClickSpeed() {
        const now = Date.now();
        // Remove clicks older than 1 second
        this.clickTimes = this.clickTimes.filter(t => now - t < 1000);
        this.currentCPS = this.clickTimes.length;
        
        // Calculate exponential multiplier based on CPS (same as tutorial)
        // 1-3 CPS = 1x, 4-6 = 1.5x, 7-9 = 2x, 10+ = exponential
        if (this.currentCPS <= 3) {
            this.clickMultiplier = 1;
        } else if (this.currentCPS <= 6) {
            this.clickMultiplier = 1.5;
        } else if (this.currentCPS <= 9) {
            this.clickMultiplier = 2;
        } else {
            // Exponential: 10 CPS = 2.5x, 15 CPS = 4x, 20 CPS = 8x
            this.clickMultiplier = Math.pow(1.15, this.currentCPS - 9) * 2;
        }
        
        // Update CPS display
        this.updateCPSIndicator();
    }
    
    showClickFeedback(e, amount) {
        const feedback = document.createElement('div');
        feedback.className = 'click-feedback';
        feedback.textContent = '+' + amount;
        
        // Get the cookie button, not whatever was clicked inside it
        const cookieBtn = document.getElementById('big-cookie');
        if (!cookieBtn) return;
        
        const rect = cookieBtn.getBoundingClientRect();
        // Random position around where clicked
        const offsetX = (Math.random() - 0.5) * 60;
        const offsetY = (Math.random() - 0.5) * 30;
        feedback.style.left = (e.clientX - rect.left + offsetX) + 'px';
        feedback.style.top = (e.clientY - rect.top + offsetY) + 'px';
        
        if (this.clickMultiplier > 1.5) {
            feedback.style.color = '#f39c12';
            feedback.style.fontSize = '1.8em';
        }
        
        cookieBtn.appendChild(feedback);
        
        setTimeout(() => feedback.remove(), 800);
    }
    
    handleTabClick(tabId) {
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.tab-panel').forEach(panel => panel.classList.remove('active'));
        
        const btn = document.querySelector(`[data-tab="${tabId}"]`);
        const panel = document.getElementById(tabId + '-panel');
        
        if (btn) btn.classList.add('active');
        if (panel) panel.classList.add('active');
    }
    
    handleGeneratorClick(genId) {
        this.socket.emit('game:buy', genId);
    }
    
    handleClickUpgrade() {
        this.socket.emit('game:upgradeClick');
    }
    
    updateGeneratorButtons() {
        if (!this.gameState) return;
        
        const me = this.getMe();
        if (!me) return;
        
        const lockedMargin = me.positions.reduce((sum, p) => sum + p.stake, 0);
        const available = me.cookies - lockedMargin;
        
        const generatorData = {
            grandma: { baseCost: 15, cps: 1 },
            bakery: { baseCost: 100, cps: 5 },
            factory: { baseCost: 500, cps: 20 },
            mine: { baseCost: 2000, cps: 100 },
            bank: { baseCost: 10000, cps: 500 },
            temple: { baseCost: 50000, cps: 2500 }
        };
        
        Object.keys(generatorData).forEach(genId => {
            const btn = document.getElementById(`generator-${genId}`);
            if (!btn) return;
            
            const owned = me.generators[genId] || 0;
            const data = generatorData[genId];
            const currentCost = Math.floor(data.baseCost * Math.pow(1.15, owned));
            
            const costSpan = btn.querySelector('.cost-value');
            if (costSpan) costSpan.textContent = currentCost;
            
            const levelSpan = btn.querySelector('.gen-level');
            if (levelSpan) levelSpan.textContent = `Lv.${owned}`;
            
            if (available >= currentCost) {
                btn.classList.remove('locked');
            } else {
                btn.classList.add('locked');
            }
        });
        
        // Update click power upgrade button
        this.updateClickUpgradeButton(me, available);
    }
    
    updateClickUpgradeButton(me, available) {
        const btn = document.getElementById('upgrade-click');
        if (!btn) return;
        
        const clickPower = me.clickPower || 1;
        const currentLevel = clickPower - 1;
        const basePrice = 50;
        const cost = Math.floor(basePrice * Math.pow(2, currentLevel));
        const nextPower = clickPower + 1;
        
        const costSpan = btn.querySelector('.click-power-cost');
        if (costSpan) costSpan.textContent = cost;
        
        const levelSpan = btn.querySelector('.click-power-level');
        if (levelSpan) levelSpan.textContent = `Lv.${clickPower}`;
        
        const descSpan = btn.querySelector('.click-power-desc');
        if (descSpan) descSpan.textContent = `+${clickPower} per click → +${nextPower}`;
        
        if (available >= cost) {
            btn.classList.remove('locked');
        } else {
            btn.classList.add('locked');
        }
    }
    
    giveUp() {
        if (confirm('Are you sure you want to give up? You will forfeit the match!')) {
            window.location.href = '/';
        }
    }
    
    showLoading(message) {
        const overlay = document.getElementById('loading-overlay');
        const text = document.getElementById('loading-text');
        if (overlay) overlay.style.display = 'flex';
        if (text) text.textContent = message;
    }
    
    hideLoading() {
        const overlay = document.getElementById('loading-overlay');
        if (overlay) overlay.style.display = 'none';
    }
    
    showVictoryScreen(winnerName, cookies, isPlayer) {
        const overlay = document.createElement('div');
        overlay.className = 'victory-overlay';
        overlay.innerHTML = `
            <div class="victory-modal">
                <div class="victory-icon">${isPlayer ? '🏆' : '😢'}</div>
                <h1 class="victory-title">${isPlayer ? 'VICTORY!' : 'DEFEAT!'}</h1>
                <div class="victory-winner">${winnerName} reached 1 MILLION cookies!</div>
                <div class="victory-cookies">🍪 ${cookies.toLocaleString()} 🍪</div>
                <button class="victory-btn" id="play-again-btn">Play Again</button>
            </div>
        `;
        document.body.appendChild(overlay);
        
        document.getElementById('play-again-btn').addEventListener('click', () => {
            sessionStorage.clear();
            window.location.href = '/';
        });
    }
    
    showNotification(message, type = 'info') {
        console.log('showNotification called:', message, type);
        
        // Add to activity feed
        const feed = document.getElementById('notif-feed');
        if (feed) {
            const notif = document.createElement('div');
            notif.className = 'notif-item ' + type;
            notif.textContent = message;
            
            // Add to top of feed
            feed.insertBefore(notif, feed.firstChild);
            
            // Keep only last 10 notifications
            while (feed.children.length > 10) {
                feed.removeChild(feed.lastChild);
            }
            
            // Auto-remove after 15 seconds
            setTimeout(() => {
                if (notif.parentNode) {
                    notif.style.opacity = '0';
                    setTimeout(() => notif.remove(), 300);
                }
            }, 15000);
        }
        
        // Also show a floating toast for important notifications
        if (type === 'success' || type === 'error') {
            this.showToast(message, type);
        }
    }
    
    showToast(message, type = 'info') {
        // Create floating toast container if it doesn't exist
        let toastContainer = document.getElementById('toast-container');
        if (!toastContainer) {
            toastContainer = document.createElement('div');
            toastContainer.id = 'toast-container';
            toastContainer.style.cssText = 'position: fixed; top: 80px; right: 20px; z-index: 9999; display: flex; flex-direction: column; gap: 10px;';
            document.body.appendChild(toastContainer);
        }
        
        const toast = document.createElement('div');
        const bgColor = type === 'success' ? 'rgba(46,204,113,0.95)' : 
                       type === 'error' ? 'rgba(231,76,60,0.95)' :
                       type === 'warning' ? 'rgba(243,156,18,0.95)' : 'rgba(52,152,219,0.95)';
        
        toast.style.cssText = `
            background: ${bgColor};
            color: white;
            padding: 15px 25px;
            border-radius: 8px;
            font-weight: bold;
            font-size: 1em;
            box-shadow: 0 4px 15px rgba(0,0,0,0.3);
            animation: toastSlideIn 0.3s ease;
            max-width: 350px;
        `;
        toast.textContent = message;
        
        toastContainer.appendChild(toast);
        
        // Remove after 4 seconds
        setTimeout(() => {
            toast.style.animation = 'toastSlideOut 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, 4000);
    }
}

// Add animations
const style = document.createElement('style');
style.textContent = `
@keyframes slideIn {
    from { transform: translateX(100%); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
}
@keyframes slideOut {
    from { transform: translateX(0); opacity: 1; }
    to { transform: translateX(100%); opacity: 0; }
}
`;
document.head.appendChild(style);

// Initialize game when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.game = new MultiplayerGame();
});

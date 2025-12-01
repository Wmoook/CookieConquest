// Cookie Conquest - Tutorial with AI Bots
// Full game engine tutorial with guided lessons

class TutorialGame {
    constructor() {
        this.cookies = 0;
        this.cps = 0;
        this.generators = { grandma: 0, bakery: 0, factory: 0, mine: 0, bank: 0, temple: 0 };
        this.positions = [];
        this.clickTimes = [];
        this.currentCPS = 0;
        this.clickMultiplier = 1;
        
        // Chart data
        this.playerHistory = {};
        this.chartState = {};
        this.chartViewport = {};
        this.displayValues = {};
        this.lastChartTime = performance.now();
        
        // Bot players
        this.bots = [
            { name: 'CookieBot', cookies: 100, cps: 2, generators: { grandma: 2, bakery: 0, factory: 0, mine: 0, bank: 0, temple: 0 }, positions: [], positionsOnMe: [], isBot: true },
            { name: 'TraderBot', cookies: 100, cps: 1, generators: { grandma: 1, bakery: 0, factory: 0, mine: 0, bank: 0, temple: 0 }, positions: [], positionsOnMe: [], isBot: true }
        ];
        
        // Player data
        this.player = {
            name: 'You',
            cookies: 0,
            cps: 0,
            generators: { grandma: 0, bakery: 0, factory: 0, mine: 0, bank: 0, temple: 0 },
            positions: [],
            positionsOnMe: []
        };
        
        this.allPlayers = [this.player, ...this.bots];
        this.isGameActive = true;
        
        this.init();
    }
    
    init() {
        // Initialize history for all players
        this.allPlayers.forEach(p => {
            this.playerHistory[p.name] = {
                cookies: [p.cookies],
                fullCookies: [p.cookies],
                velocity: [p.cps],
                fullVelocity: [p.cps]
            };
            this.displayValues[p.name] = p.cookies;
        });
        
        this.bindEvents();
        this.renderPlayerCards();
        this.startGameLoop();
        this.startBotAI();
    }
    
    bindEvents() {
        // Cookie click
        const cookie = document.getElementById('big-cookie');
        if (cookie) {
            cookie.addEventListener('click', (e) => this.handleCookieClick(e));
        }
        
        // Generator clicks
        document.querySelectorAll('.generator-btn').forEach(btn => {
            btn.addEventListener('click', () => this.buyGenerator(btn.dataset.generator));
        });
        
        // Tab clicks
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => this.handleTabClick(btn.dataset.tab));
        });
        
        // Back button
        const backBtn = document.getElementById('give-up-btn');
        if (backBtn) {
            backBtn.addEventListener('click', () => {
                if (confirm('Leave tutorial?')) {
                    window.location.href = '/';
                }
            });
        }
    }
    
    handleCookieClick(e) {
        if (!this.isGameActive) return;
        
        // Track click times for CPS calculation
        const now = Date.now();
        this.clickTimes.push(now);
        this.clickTimes = this.clickTimes.filter(t => now - t < 1000);
        this.currentCPS = this.clickTimes.length;
        
        // Calculate multiplier based on CPS
        if (this.currentCPS >= 10) {
            this.clickMultiplier = Math.min(5, 2 + (this.currentCPS - 10) * 0.1);
        } else if (this.currentCPS >= 7) {
            this.clickMultiplier = 2;
        } else if (this.currentCPS >= 4) {
            this.clickMultiplier = 1.5;
        } else {
            this.clickMultiplier = 1;
        }
        
        const cookiesEarned = Math.floor(this.clickMultiplier);
        this.player.cookies += cookiesEarned;
        this.cookies = this.player.cookies;
        
        // Visual feedback
        this.showClickFeedback(e, cookiesEarned);
        this.updateMultiplierDisplay();
        
        // Notify tutorial manager
        if (window.tutorialManager) {
            window.tutorialManager.onCookieClick(cookiesEarned);
        }
    }
    
    showClickFeedback(e, amount) {
        const feedback = document.createElement('div');
        feedback.className = 'click-feedback';
        feedback.textContent = '+' + amount;
        feedback.style.cssText = `
            position: absolute;
            left: ${e.clientX}px;
            top: ${e.clientY}px;
            color: #2ecc71;
            font-weight: bold;
            font-size: 1.5rem;
            pointer-events: none;
            animation: floatUp 0.8s ease-out forwards;
            z-index: 100;
        `;
        document.body.appendChild(feedback);
        setTimeout(() => feedback.remove(), 800);
    }
    
    updateMultiplierDisplay() {
        const el = document.getElementById('click-multiplier');
        if (el) {
            el.textContent = this.clickMultiplier.toFixed(1) + 'x';
            el.style.color = this.clickMultiplier > 1 ? '#2ecc71' : '#888';
        }
    }
    
    buyGenerator(genId) {
        const generatorData = {
            grandma: { baseCost: 15, cps: 1 },
            bakery: { baseCost: 100, cps: 5 },
            factory: { baseCost: 500, cps: 20 },
            mine: { baseCost: 2000, cps: 100 },
            bank: { baseCost: 10000, cps: 500 },
            temple: { baseCost: 50000, cps: 2500 }
        };
        
        const data = generatorData[genId];
        if (!data) return;
        
        const owned = this.player.generators[genId] || 0;
        const cost = Math.floor(data.baseCost * Math.pow(1.15, owned));
        
        const lockedMargin = this.player.positions.reduce((sum, p) => sum + p.stake, 0);
        const available = this.player.cookies - lockedMargin;
        
        if (available >= cost) {
            this.player.cookies -= cost;
            this.player.generators[genId]++;
            this.player.cps = this.player.generators.grandma * 1 + 
                             this.player.generators.bakery * 5 + 
                             this.player.generators.factory * 20 +
                             this.player.generators.mine * 100 +
                             this.player.generators.bank * 500 +
                             this.player.generators.temple * 2500;
            this.cookies = this.player.cookies;
            this.cps = this.player.cps;
            
            // Notify tutorial
            if (window.tutorialManager) {
                window.tutorialManager.onGeneratorBuy(genId);
            }
        }
        
        this.updateGeneratorButtons();
    }
    
    updateGeneratorButtons() {
        const generatorData = {
            grandma: { baseCost: 15, cps: 1 },
            bakery: { baseCost: 100, cps: 5 },
            factory: { baseCost: 500, cps: 20 },
            mine: { baseCost: 2000, cps: 100 },
            bank: { baseCost: 10000, cps: 500 },
            temple: { baseCost: 50000, cps: 2500 }
        };
        
        const lockedMargin = this.player.positions.reduce((sum, p) => sum + p.stake, 0);
        const available = this.player.cookies - lockedMargin;
        
        Object.keys(generatorData).forEach(genId => {
            const btn = document.getElementById(`generator-${genId}`);
            if (!btn) return;
            
            const owned = this.player.generators[genId] || 0;
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
    }
    
    handleTabClick(tab) {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
        
        document.querySelector(`[data-tab="${tab}"]`)?.classList.add('active');
        document.getElementById(`${tab}-panel`)?.classList.add('active');
    }
    
    openPosition(targetName, type, stake, leverage) {
        const target = this.allPlayers.find(p => p.name === targetName);
        if (!target || target.name === 'You') return false;
        
        const lockedMargin = this.player.positions.reduce((sum, p) => sum + p.stake, 0);
        const available = this.player.cookies - lockedMargin;
        
        if (stake > available) return false;
        if (target.cookies < 100) return false;
        if (stake > target.cookies * 0.5) return false;
        
        const entryPrice = target.cookies;
        const liquidationPercent = 1 / leverage;
        let liquidationPrice;
        
        if (type === 'long') {
            liquidationPrice = entryPrice * (1 - liquidationPercent);
            if (liquidationPrice < 10) return false;
        } else {
            liquidationPrice = entryPrice * (1 + liquidationPercent);
        }
        
        const position = {
            id: Date.now() + '-' + Math.random().toString(36).substr(2, 9),
            ownerName: 'You',
            targetName: target.name,
            type,
            stake,
            leverage,
            entryPrice,
            liquidationPrice,
            openTime: Date.now()
        };
        
        this.player.positions.push(position);
        target.positionsOnMe.push(position);
        
        // Market impact
        const impactPercent = (stake * leverage) / (target.cookies * 10);
        const impactAmount = Math.floor(target.cookies * Math.min(impactPercent, 0.1));
        
        if (type === 'long' && impactAmount > 0) {
            target.cookies += impactAmount;
            this.showNotification(`📈 Your LONG pushed ${target.name} UP +${impactAmount}🍪!`, 'success');
        } else if (type === 'short' && impactAmount > 0) {
            target.cookies = Math.max(10, target.cookies - impactAmount);
            this.showNotification(`📉 Your SHORT pushed ${target.name} DOWN -${impactAmount}🍪!`, 'warning');
        }
        
        // Notify tutorial
        if (window.tutorialManager) {
            window.tutorialManager.onPositionOpen(type, targetName);
        }
        
        return true;
    }
    
    closePosition(positionId) {
        const posIndex = this.player.positions.findIndex(p => p.id === positionId);
        if (posIndex === -1) return false;
        
        const position = this.player.positions[posIndex];
        const target = this.allPlayers.find(p => p.name === position.targetName);
        if (!target) return false;
        
        // Calculate PNL
        const currentPrice = target.cookies;
        const priceChange = currentPrice - position.entryPrice;
        const pnlMultiplier = position.type === 'long' ? 1 : -1;
        const pnl = Math.floor((priceChange / (position.entryPrice || 1)) * position.stake * position.leverage * pnlMultiplier);
        
        // Return stake first
        this.player.cookies += position.stake;
        
        if (pnl > 0) {
            const actualPnl = Math.min(pnl, target.cookies);
            this.player.cookies += actualPnl;
            target.cookies -= actualPnl;
            this.showNotification(`🎉 Closed for +${actualPnl}🍪 profit!`, 'success');
        } else if (pnl < 0) {
            const loss = Math.min(Math.abs(pnl), position.stake);
            this.player.cookies -= loss;
            target.cookies += loss;
            this.showNotification(`😢 Closed for -${loss}🍪 loss`, 'error');
        } else {
            this.showNotification(`Closed at breakeven`, 'info');
        }
        
        // Remove position
        this.player.positions.splice(posIndex, 1);
        target.positionsOnMe = target.positionsOnMe.filter(p => p.id !== positionId);
        
        this.cookies = this.player.cookies;
        
        // Notify tutorial
        if (window.tutorialManager) {
            window.tutorialManager.onPositionClose(pnl);
        }
        
        return true;
    }
    
    showNotification(message, type) {
        const container = document.getElementById('live-positions-list');
        if (!container) return;
        
        // Flash the message
        const el = document.createElement('div');
        el.className = 'position-item';
        el.style.background = type === 'success' ? 'rgba(46, 204, 113, 0.3)' : 
                              type === 'error' ? 'rgba(231, 76, 60, 0.3)' :
                              type === 'warning' ? 'rgba(243, 156, 18, 0.3)' : 'rgba(100, 100, 100, 0.3)';
        el.style.padding = '8px';
        el.style.borderRadius = '6px';
        el.style.marginBottom = '5px';
        el.style.fontSize = '0.8em';
        el.textContent = message;
        
        container.insertBefore(el, container.firstChild);
        setTimeout(() => el.remove(), 3000);
    }
    
    renderPlayerCards() {
        const grid = document.getElementById('players-grid');
        if (!grid) return;
        
        grid.innerHTML = this.allPlayers.map((player, idx) => {
            const isMe = player.name === 'You';
            const chartId = isMe ? 'you' : player.name;
            
            return `
                <div class="player-stock-card ${isMe ? 'you' : 'tradeable'}" id="card-${chartId}">
                    <div class="stock-header">
                        <div class="stock-header-left">
                            <span class="player-rank" id="rank-${chartId}">#${idx + 1}</span>
                            <span class="player-name" style="color: ${isMe ? '#2ecc71' : '#e74c3c'}">
                                ${player.name}${player.isBot ? ' <span class="bot-badge">🤖 BOT</span>' : ''}
                            </span>
                        </div>
                        <div class="stock-stats">
                            <span class="stat-total" id="total-${chartId}">${player.cookies}🍪</span>
                            <span class="stat-velocity up" id="vel-${chartId}">+${player.cps}/s</span>
                        </div>
                    </div>
                    <div class="chart-container" id="chart-container-${chartId}" data-chart="${chartId}">
                        <div class="chart-controls">
                            <button class="zoom-btn zoom-in" data-chart="${chartId}">+</button>
                            <button class="zoom-btn zoom-out" data-chart="${chartId}">-</button>
                            <button class="zoom-btn zoom-all" data-chart="${chartId}">ALL</button>
                            <button class="zoom-btn zoom-live" data-chart="${chartId}">LIVE</button>
                        </div>
                        <canvas class="chart-canvas" id="chart-${chartId}"></canvas>
                        <div class="chart-overlay"></div>
                    </div>
                    ${!isMe ? `
                    <div class="card-actions">
                        <div class="trade-controls">
                            <div class="leverage-select" id="lev-select-${chartId}">
                                <button class="lev-btn" data-lev="2">2x</button>
                                <button class="lev-btn active" data-lev="5">5x</button>
                                <button class="lev-btn" data-lev="10">10x</button>
                            </div>
                            <div class="stake-row">
                                <input type="number" class="stake-input" id="stake-${chartId}" value="10" min="1">
                                <button class="max-stake-btn" onclick="game.setMaxStake('${chartId}')">MAX</button>
                            </div>
                        </div>
                        <div class="quick-trade-btns">
                            <button class="quick-trade-btn long" onclick="game.quickTrade('${player.name}', 'long')">
                                <span>📈 LONG</span>
                            </button>
                            <button class="quick-trade-btn short" onclick="game.quickTrade('${player.name}', 'short')">
                                <span>📉 SHORT</span>
                            </button>
                        </div>
                    </div>
                    ` : `
                    <div class="card-actions" id="positions-on-me-section" style="padding: 10px;">
                        <div style="text-align: center; color: #2ecc71; margin-bottom: 8px;">
                            <strong>This is YOU! 🎯</strong>
                        </div>
                        <div id="positions-on-me-list" style="font-size: 0.75em;"></div>
                    </div>
                    `}
                </div>
            `;
        }).join('');
        
        // Bind leverage buttons
        this.allPlayers.forEach(player => {
            if (player.name === 'You') return;
            const chartId = player.name;
            const levSelect = document.getElementById(`lev-select-${chartId}`);
            if (levSelect) {
                levSelect.querySelectorAll('.lev-btn').forEach(btn => {
                    btn.addEventListener('click', () => {
                        levSelect.querySelectorAll('.lev-btn').forEach(b => b.classList.remove('active'));
                        btn.classList.add('active');
                    });
                });
            }
        });
        
        // Initialize chart viewports
        this.allPlayers.forEach(player => {
            const chartId = player.name === 'You' ? 'you' : player.name;
            this.chartViewport[chartId] = { viewStart: 0, viewEnd: null, zoom: 1, isDragging: false, lastX: 0, isAll: true };
        });
        
        // Initialize canvases
        this.resizeCharts();
        
        // Bind zoom controls
        this.bindZoomControls();
    }
    
    quickTrade(targetName, type) {
        const chartId = targetName;
        const stakeInput = document.getElementById(`stake-${chartId}`);
        const levSelect = document.getElementById(`lev-select-${chartId}`);
        
        const stake = parseInt(stakeInput?.value) || 10;
        const activeBtn = levSelect?.querySelector('.lev-btn.active');
        const leverage = parseInt(activeBtn?.dataset.lev) || 5;
        
        const success = this.openPosition(targetName, type, stake, leverage);
        if (!success) {
            this.showNotification('Cannot open position - check your balance!', 'error');
        }
    }
    
    setMaxStake(chartId) {
        const lockedMargin = this.player.positions.reduce((sum, p) => sum + p.stake, 0);
        const available = Math.floor((this.player.cookies - lockedMargin) * 0.9);
        const input = document.getElementById(`stake-${chartId}`);
        if (input) input.value = Math.max(1, available);
    }
    
    startGameLoop() {
        this.lastGameTime = performance.now();
        this.lastHistoryUpdate = performance.now();
        
        const gameLoop = () => {
            if (!this.isGameActive) {
                requestAnimationFrame(gameLoop);
                return;
            }
            
            const now = performance.now();
            const dt = (now - this.lastGameTime) / 1000; // Delta time in seconds
            this.lastGameTime = now;
            
            // Add fractional CPS to all players (smooth accumulation)
            this.allPlayers.forEach(player => {
                player.cookies += player.cps * dt;
            });
            
            this.cookies = this.player.cookies;
            this.cps = this.player.cps;
            
            // Check liquidations
            this.checkLiquidations();
            
            // Update history every second
            if (now - this.lastHistoryUpdate >= 1000) {
                this.updateHistory();
                this.lastHistoryUpdate = now;
            }
            
            // Update UI
            this.updateUI();
            
            requestAnimationFrame(gameLoop);
        };
        
        requestAnimationFrame(gameLoop);
        
        // Animation loop for charts (separate for smooth rendering)
        this.animateCharts();
    }
    
    checkLiquidations() {
        // Check player positions
        this.player.positions = this.player.positions.filter(pos => {
            const target = this.allPlayers.find(p => p.name === pos.targetName);
            if (!target) return false;
            
            const currentPrice = target.cookies;
            let isLiquidated = false;
            
            if (pos.type === 'long' && currentPrice <= pos.liquidationPrice) {
                isLiquidated = true;
            } else if (pos.type === 'short' && currentPrice >= pos.liquidationPrice) {
                isLiquidated = true;
            }
            
            if (isLiquidated) {
                target.cookies += pos.stake;
                this.showNotification(`💀 LIQUIDATED on ${pos.targetName}! Lost ${pos.stake}🍪`, 'error');
                
                if (window.tutorialManager) {
                    window.tutorialManager.onLiquidation();
                }
                
                return false;
            }
            return true;
        });
    }
    
    updateHistory() {
        this.allPlayers.forEach(player => {
            const history = this.playerHistory[player.name];
            if (history) {
                history.cookies.push(player.cookies);
                history.fullCookies.push(player.cookies);
                history.velocity.push(player.cps);
                history.fullVelocity.push(player.cps);
                
                // Keep last 60 for display, full history for scrolling
                if (history.cookies.length > 60) {
                    history.cookies.shift();
                    history.velocity.shift();
                }
            }
            this.displayValues[player.name] = player.cookies;
        });
    }
    
    calculateUnrealizedPnl(player) {
        if (player.name !== 'You') return 0;
        
        let totalPnl = 0;
        this.player.positions.forEach(pos => {
            const target = this.allPlayers.find(p => p.name === pos.targetName);
            if (!target) return;
            
            const currentPrice = target.cookies;
            const priceChange = currentPrice - pos.entryPrice;
            const pnlMultiplier = pos.type === 'long' ? 1 : -1;
            const pnl = Math.floor((priceChange / (pos.entryPrice || 1)) * pos.stake * pos.leverage * pnlMultiplier);
            totalPnl += pnl;
        });
        return totalPnl;
    }
    
    updateUI() {
        // Update cookie display
        const cookieEl = document.getElementById('cookie-count');
        if (cookieEl) cookieEl.textContent = Math.floor(this.player.cookies);
        
        const cpsEl = document.getElementById('cps-value');
        if (cpsEl) cpsEl.textContent = this.player.cps;
        
        // Update locked margin
        const lockedMargin = this.player.positions.reduce((sum, p) => sum + p.stake, 0);
        const lockedEl = document.getElementById('locked-margin');
        const lockedVal = document.getElementById('locked-value');
        if (lockedEl && lockedVal) {
            if (lockedMargin > 0) {
                lockedEl.style.display = 'block';
                lockedVal.textContent = lockedMargin;
            } else {
                lockedEl.style.display = 'none';
            }
        }
        
        // Update generator buttons
        this.updateGeneratorButtons();
        
        // Update player card stats
        this.allPlayers.forEach((player, idx) => {
            const chartId = player.name === 'You' ? 'you' : player.name;
            const totalEl = document.getElementById(`total-${chartId}`);
            if (totalEl) totalEl.textContent = Math.floor(player.cookies) + '🍪';
            
            const velEl = document.getElementById(`vel-${chartId}`);
            if (velEl) {
                velEl.textContent = '+' + player.cps + '/s';
                velEl.className = 'stat-velocity up';
            }
        });
        
        // Update positions panel
        this.updatePositionsPanel();
        
        // Update live positions
        this.updateLivePositions();
    }
    
    updatePositionsPanel() {
        const list = document.getElementById('main-positions-list');
        const pnlEl = document.getElementById('main-positions-pnl');
        if (!list) return;
        
        if (this.player.positions.length === 0) {
            list.innerHTML = '<div class="no-positions">No open positions - Trade on opponent charts!</div>';
            if (pnlEl) {
                pnlEl.textContent = 'PNL: 0🍪';
                pnlEl.className = 'positions-pnl neutral';
            }
            return;
        }
        
        let totalPnl = 0;
        
        // Only rebuild if positions changed
        const currentIds = this.player.positions.map(p => p.id).join(',');
        if (this._lastPositionIds !== currentIds) {
            this._lastPositionIds = currentIds;
            
            list.innerHTML = this.player.positions.map(pos => {
                const target = this.allPlayers.find(p => p.name === pos.targetName);
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
            
            // Bind close buttons
            list.querySelectorAll('.close-position-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    this.closePosition(btn.dataset.positionId);
                });
            });
        }
        
        // Update PNL values
        this.player.positions.forEach(pos => {
            const row = list.querySelector(`[data-pos-id="${pos.id}"]`);
            if (!row) return;
            
            const target = this.allPlayers.find(p => p.name === pos.targetName);
            if (!target) return;
            
            const currentPrice = target.cookies;
            const priceChange = currentPrice - pos.entryPrice;
            const pnlMultiplier = pos.type === 'long' ? 1 : -1;
            const pnl = Math.floor((priceChange / (pos.entryPrice || 1)) * pos.stake * pos.leverage * pnlMultiplier);
            totalPnl += pnl;
            
            const pnlEl = row.querySelector('.pos-current-pnl');
            if (pnlEl) {
                pnlEl.textContent = (pnl >= 0 ? '+' : '') + pnl + '🍪';
                pnlEl.className = 'pos-current-pnl ' + (pnl >= 0 ? 'profit' : 'loss');
            }
            
            const distToLiq = pos.type === 'long' 
                ? ((currentPrice - pos.liquidationPrice) / currentPrice * 100).toFixed(1)
                : ((pos.liquidationPrice - currentPrice) / currentPrice * 100).toFixed(1);
            
            const liqDistEl = row.querySelector('.liq-dist');
            if (liqDistEl) liqDistEl.textContent = distToLiq;
            
            const liqEl = row.querySelector('.pos-liq');
            if (liqEl) {
                liqEl.className = 'pos-liq ' + (parseFloat(distToLiq) < 10 ? 'danger' : parseFloat(distToLiq) < 25 ? 'warning' : 'safe');
            }
        });
        
        if (pnlEl) {
            pnlEl.textContent = 'PNL: ' + (totalPnl >= 0 ? '+' : '') + totalPnl + '🍪';
            pnlEl.className = 'positions-pnl ' + (totalPnl > 0 ? 'profit' : totalPnl < 0 ? 'loss' : 'neutral');
        }
    }
    
    updateLivePositions() {
        const container = document.getElementById('live-positions-list');
        if (!container) return;
        
        // Collect all positions
        const allPositions = [];
        this.allPlayers.forEach(player => {
            player.positions.forEach(pos => {
                allPositions.push({
                    trader: player.name,
                    target: pos.targetName,
                    type: pos.type,
                    isPlayer: player.name === 'You',
                    isOpponentOnMe: pos.targetName === 'You'
                });
            });
        });
        
        if (allPositions.length === 0) {
            // Keep notifications, just don't show "no positions"
            return;
        }
        
        // Update positions on me display
        this.updatePositionsOnMe();
    }
    
    updatePositionsOnMe() {
        const list = document.getElementById('positions-on-me-list');
        if (!list) return;
        
        if (this.player.positionsOnMe.length === 0) {
            list.innerHTML = '<div style="color: rgba(255,255,255,0.5); text-align:center;">No one trading on you</div>';
            return;
        }
        
        list.innerHTML = this.player.positionsOnMe.map(pos => {
            const owner = this.allPlayers.find(p => p.name === pos.ownerName);
            if (!owner) return '';
            
            // Calculate their PNL (negative = bad for you)
            const currentPrice = this.player.cookies;
            const priceChange = currentPrice - pos.entryPrice;
            const pnlMultiplier = pos.type === 'long' ? 1 : -1;
            const theirPnl = Math.floor((priceChange / (pos.entryPrice || 1)) * pos.stake * pos.leverage * pnlMultiplier);
            
            const pnlClass = theirPnl > 0 ? 'color:#e74c3c' : 'color:#2ecc71'; // Red if they profit (bad for you)
            const pnlText = theirPnl >= 0 ? `+${theirPnl}` : `${theirPnl}`;
            
            return `
                <div style="background:rgba(231,76,60,0.2); padding:6px; border-radius:4px; margin-bottom:4px; display:flex; justify-content:space-between; align-items:center;">
                    <span>🤖 ${pos.ownerName}</span>
                    <span style="color:${pos.type === 'long' ? '#2ecc71' : '#e74c3c'}">${pos.type.toUpperCase()}</span>
                    <span style="${pnlClass}">${pnlText}🍪</span>
                </div>
            `;
        }).join('');
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
                vp.isAll = false;
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
                vp.isAll = false;
                
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
                
                if (btn.classList.contains('zoom-in')) {
                    vp.zoom = Math.min(5, vp.zoom * 1.5);
                    vp.isAll = false;
                } else if (btn.classList.contains('zoom-out')) {
                    vp.zoom = Math.max(0.01, vp.zoom / 1.5);
                    vp.isAll = false;
                } else if (btn.classList.contains('zoom-all')) {
                    vp.isAll = true;
                    vp.viewEnd = null;
                } else if (btn.classList.contains('zoom-live')) {
                    vp.viewEnd = null;
                    vp.zoom = 1;
                    vp.isAll = false;
                }
            });
        });
    }
    
    getFullHistoryLength(chartId) {
        const playerName = chartId === 'you' ? 'You' : chartId;
        const history = this.playerHistory[playerName];
        return history ? history.fullCookies.length : 60;
    }
    
    getViewportData(chartId) {
        const vp = this.chartViewport[chartId];
        if (!vp) return { data: [], isLive: true, fractionalProgress: 0 };
        
        const playerName = chartId === 'you' ? 'You' : chartId;
        const history = this.playerHistory[playerName];
        if (!history) return { data: [], isLive: true, fractionalProgress: 0 };
        
        const fullData = history.fullCookies;
        const fullLen = fullData.length;
        
        // Calculate fractional progress since last history update (0 to 1)
        const timeSinceUpdate = performance.now() - this.lastHistoryUpdate;
        const fractionalProgress = Math.min(1, timeSinceUpdate / 1000);
        
        if (vp.isAll) {
            return { data: fullData.slice(), isLive: true, fractionalProgress };
        }
        
        const visiblePoints = Math.max(10, Math.floor(60 / vp.zoom));
        const endIdx = vp.viewEnd !== null ? Math.floor(vp.viewEnd) : fullLen;
        const startIdx = Math.max(0, endIdx - visiblePoints);
        
        return {
            data: fullData.slice(startIdx, endIdx),
            isLive: vp.viewEnd === null,
            fractionalProgress
        };
    }
    
    // This runs every frame - keeps smooth data continuously updated
    updateSmoothData(id, rawData, dt, isLive, liveCookies, fractionalProgress) {
        if (!this.chartState[id]) {
            this.chartState[id] = { 
                smoothData: [], 
                lastRawLength: 0,
                scrollOffset: 0 // Tracks smooth scrolling between updates
            };
        }
        
        const state = this.chartState[id];
        const targetData = rawData ? [...rawData] : [];
        
        // Detect when a new point was added to raw data
        if (targetData.length > state.lastRawLength && state.lastRawLength > 0) {
            // New point just added - reset scroll offset
            state.scrollOffset = 0;
        }
        state.lastRawLength = targetData.length;
        
        // Keep scroll offset tracking the fractional progress (0 to 1)
        // This creates the smooth scrolling effect
        if (isLive) {
            state.scrollOffset = fractionalProgress || 0;
        }
        
        // Initialize smooth data if empty
        if (state.smoothData.length === 0 && targetData.length > 0) {
            state.smoothData = [...targetData];
        }
        
        // Resize array to match target
        while (state.smoothData.length < targetData.length) {
            const prevVal = state.smoothData.length > 0 
                ? state.smoothData[state.smoothData.length - 1] 
                : targetData[0];
            state.smoothData.push(prevVal);
        }
        while (state.smoothData.length > targetData.length) {
            state.smoothData.shift();
        }
        
        // Super fast lerp for smooth value updates
        const lerp = Math.min(1, dt * 20);
        
        // Lerp all points toward their targets
        for (let i = 0; i < state.smoothData.length && i < targetData.length; i++) {
            state.smoothData[i] += (targetData[i] - state.smoothData[i]) * lerp;
        }
        
        // Last point always tracks live value when live
        if (isLive && liveCookies !== undefined && state.smoothData.length > 0) {
            state.smoothData[state.smoothData.length - 1] = liveCookies;
        }
    }
    
    animateCharts() {
        if (!this.isGameActive) return;
        
        const now = performance.now();
        const dt = (now - this.lastChartTime) / 1000;
        this.lastChartTime = now;
        
        const smoothFactor = Math.min(1, dt * 6);
        
        // Smooth cookie display values
        this.allPlayers.forEach(player => {
            const unrealizedPnl = this.calculateUnrealizedPnl(player);
            const targetCookies = player.cookies + unrealizedPnl;
            this.displayValues[player.name] = this.displayValues[player.name] || 0;
            this.displayValues[player.name] += (targetCookies - this.displayValues[player.name]) * smoothFactor;
        });
        
        // Render each player's chart with smooth data
        this.allPlayers.forEach(player => {
            const isMe = player.name === 'You';
            const chartId = isMe ? 'you' : player.name;
            
            const viewport = this.getViewportData(chartId);
            
            // Get the live smoothed cookie value
            const liveCookies = this.displayValues[player.name] || player.cookies;
            
            // Update smooth data, passing live value and fractional progress
            this.updateSmoothData(chartId, viewport.data, dt, viewport.isLive, liveCookies, viewport.fractionalProgress);
            
            const smoothData = this.chartState[chartId]?.smoothData || viewport.data;
            const scrollOffset = this.chartState[chartId]?.scrollOffset || 0;
            const chartColor = isMe ? '#2ecc71' : '#e74c3c';
            this.renderChart(`chart-${chartId}`, smoothData, chartColor, player, viewport, scrollOffset);
        });
        
        requestAnimationFrame(() => this.animateCharts());
    }
    
    renderChart(canvasId, data, color, player, viewport, scrollOffset = 0) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;
        
        const isLive = viewport ? viewport.isLive : true;
        
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
        
        // Calculate bounds
        let min = Math.min(...data);
        let max = Math.max(...data);
        const padding = (max - min) * 0.15 || 10;
        min = Math.max(0, min - padding);
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
        
        // Draw liquidation zones if player has position on this target
        if (player && player.name !== 'You') {
            const position = this.player.positions.find(p => p.targetName === player.name);
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
                ctx.textAlign = 'left';
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
        
        // Calculate chart points with smooth scrolling
        // scrollOffset goes from 0 to 1 as time progresses between history updates
        // The LAST point (live dot) always stays at right edge
        // Other points slide left as scrollOffset increases
        const points = [];
        const numPoints = data.length;
        
        if (numPoints < 2) {
            // Not enough points to draw
            return;
        }
        
        for (let i = 0; i < numPoints; i++) {
            let x;
            if (i === numPoints - 1) {
                // Last point (live dot) - ALWAYS at right edge
                x = MARGIN_LEFT + CHART_W;
            } else {
                // Historical points slide left as scrollOffset increases
                // When scrollOffset=0: points fill the chart normally
                // When scrollOffset=1: all points have moved left by one "slot"
                // The spacing compresses as we make room for the incoming new point
                const totalSlots = numPoints - 1 + scrollOffset; // increases from (n-1) to n
                const slotWidth = CHART_W / totalSlots;
                x = MARGIN_LEFT + (i * slotWidth);
            }
            const y = H - ((data[i] - min) / range) * H;
            points.push({ x, y });
        }
        
        // Filter out points that slid off the left edge
        const visiblePoints = points.filter(p => p.x >= MARGIN_LEFT - 5);
        
        if (visiblePoints.length < 2) return;
        
        // Draw gradient fill
        const fillGrad = ctx.createLinearGradient(0, 0, 0, H);
        fillGrad.addColorStop(0, color + '40');
        fillGrad.addColorStop(0.5, color + '15');
        fillGrad.addColorStop(1, color + '00');
        
        ctx.beginPath();
        ctx.moveTo(MARGIN_LEFT, H);
        visiblePoints.forEach(p => ctx.lineTo(p.x, p.y));
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
        
        ctx.moveTo(visiblePoints[0].x, visiblePoints[0].y);
        for (let i = 1; i < visiblePoints.length - 1; i++) {
            const xc = (visiblePoints[i].x + visiblePoints[i + 1].x) / 2;
            const yc = (visiblePoints[i].y + visiblePoints[i + 1].y) / 2;
            ctx.quadraticCurveTo(visiblePoints[i].x, visiblePoints[i].y, xc, yc);
        }
        if (visiblePoints.length > 1) {
            ctx.lineTo(visiblePoints[visiblePoints.length - 1].x, visiblePoints[visiblePoints.length - 1].y);
        }
        ctx.stroke();
        ctx.shadowBlur = 0;
        
        // Pulsing dot at current value (always at right edge)
        const lastPoint = visiblePoints[visiblePoints.length - 1];
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
        
        // LIVE badge
        ctx.font = 'bold 9px Arial';
        ctx.fillStyle = '#e74c3c';
        ctx.fillRect(W - 35, 4, 32, 14);
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'left';
        ctx.fillText('LIVE', W - 30, 14);
        
        // Data points count
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.font = '8px Arial';
        ctx.fillText(`${data.length} pts`, MARGIN_LEFT + 4, H - 4);
    }
    
    startBotAI() {
        // Bots generate cookies and occasionally trade
        setInterval(() => {
            if (!this.isGameActive) return;
            
            this.bots.forEach(bot => {
                // Random generator purchase
                if (bot.cookies > 20 && Math.random() < 0.1) {
                    const cost = 15 * Math.pow(1.15, bot.generators.grandma);
                    if (bot.cookies > cost) {
                        bot.cookies -= cost;
                        bot.generators.grandma++;
                        bot.cps = bot.generators.grandma * 1 + bot.generators.bakery * 5;
                    }
                }
                
                // Occasionally open position on player if they have enough cookies
                if (bot.cookies > 150 && this.player.cookies > 200 && Math.random() < 0.02) {
                    const stake = Math.floor(Math.min(bot.cookies * 0.1, 30));
                    const type = Math.random() < 0.5 ? 'long' : 'short';
                    
                    const position = {
                        id: Date.now() + '-bot-' + Math.random().toString(36).substr(2, 9),
                        ownerName: bot.name,
                        targetName: 'You',
                        type,
                        stake,
                        leverage: 2,
                        entryPrice: this.player.cookies,
                        liquidationPrice: type === 'long' ? this.player.cookies * 0.5 : this.player.cookies * 1.5,
                        openTime: Date.now()
                    };
                    
                    bot.positions.push(position);
                    bot.cookies -= stake;
                    this.player.positionsOnMe.push(position);
                    
                    this.showNotification(`🤖 ${bot.name} opened ${type.toUpperCase()} on YOU!`, 'warning');
                }
                
                // Occasionally close profitable positions on player
                const posOnPlayer = bot.positions.filter(p => p.targetName === 'You');
                posOnPlayer.forEach(pos => {
                    const currentPrice = this.player.cookies;
                    const priceChange = currentPrice - pos.entryPrice;
                    const pnlMultiplier = pos.type === 'long' ? 1 : -1;
                    const pnl = Math.floor((priceChange / (pos.entryPrice || 1)) * pos.stake * pos.leverage * pnlMultiplier);
                    
                    // Close if profitable or randomly after 10 seconds
                    const age = Date.now() - pos.openTime;
                    if ((pnl > pos.stake * 0.5 && Math.random() < 0.1) || (age > 15000 && Math.random() < 0.05)) {
                        this.botClosePosition(bot, pos);
                    }
                });
            });
        }, 2000);
    }
    
    botClosePosition(bot, position) {
        // Bot closes their position on the player
        const posIndex = bot.positions.findIndex(p => p.id === position.id);
        if (posIndex === -1) return;
        
        const currentPrice = this.player.cookies;
        const priceChange = currentPrice - position.entryPrice;
        const pnlMultiplier = position.type === 'long' ? 1 : -1;
        const pnl = Math.floor((priceChange / (position.entryPrice || 1)) * position.stake * position.leverage * pnlMultiplier);
        
        // Return stake to bot
        bot.cookies += position.stake;
        
        if (pnl > 0) {
            // Bot profits - player pays
            const actualPnl = Math.min(pnl, this.player.cookies);
            
            if (actualPnl < pnl) {
                // BANKRUPTCY! Player can't pay full amount!
                this.showNotification(`💸 BANKRUPTCY! ${bot.name} took ALL your ${actualPnl}🍪!`, 'error');
                bot.cookies += actualPnl;
                this.player.cookies = 0;
            } else {
                bot.cookies += actualPnl;
                this.player.cookies -= actualPnl;
                this.showNotification(`🤖 ${bot.name} closed PROFITABLE position! You paid ${actualPnl}🍪`, 'warning');
            }
        } else if (pnl < 0) {
            // Bot loses - bot pays player
            const loss = Math.min(Math.abs(pnl), position.stake);
            this.player.cookies += loss;
            this.showNotification(`🎉 ${bot.name} closed at LOSS! You gained ${loss}🍪!`, 'success');
        } else {
            this.showNotification(`🤖 ${bot.name} closed position at breakeven`, 'info');
        }
        
        // Remove position
        bot.positions.splice(posIndex, 1);
        this.player.positionsOnMe = this.player.positionsOnMe.filter(p => p.id !== position.id);
        
        this.cookies = this.player.cookies;
    }
}

// Tutorial Manager
class TutorialManager {
    constructor() {
        this.currentStep = 0;
        this.taskCompleted = false;
        this.clickCount = 0;
        this.cookiesFromClicks = 0;
        
        this.steps = [
            // Step 0: Welcome
            {
                title: '🍪 Welcome to Cookie Conquest!',
                text: 'Learn to click, build, and <strong>TRADE</strong> your way to victory!<br><br>You\'ll compete against <span class="gold">AI Bots</span> to learn all the mechanics.',
                button: "Let's Begin! 🚀",
                action: null
            },
            // Step 1: Clicking
            {
                title: '👆 Step 1: Click the Cookie!',
                text: 'Click the big cookie to earn cookies!<br><br><span class="green">Click faster</span> for a multiplier bonus!<br>Goal: Get <strong>20 cookies</strong>',
                button: 'Got it!',
                action: 'startClickTask',
                task: 'Click to get 20 cookies!',
                checkComplete: () => game.player.cookies >= 20
            },
            // Step 2: Generators
            {
                title: '🏭 Step 2: Buy Generators!',
                text: 'Generators produce cookies <strong>automatically</strong>!<br><br>Buy a <span class="gold">Grandma</span> (costs 15🍪) to earn +1/sec!',
                button: 'Got it!',
                action: 'highlightGenerators',
                task: 'Buy a Grandma generator!',
                checkComplete: () => game.player.generators.grandma >= 1
            },
            // Step 3: Charts explained
            {
                title: '📈 Step 3: Understanding Charts',
                text: 'Each player has a <strong>chart</strong> showing their cookie count over time.<br><br><span class="green">Your chart is GREEN</span><br><span class="red">Opponents are RED</span><br><br>You can <strong>trade</strong> on opponent charts!',
                button: 'Show me trading!',
                action: null
            },
            // Step 4: Long position
            {
                title: '📈 Step 4: Going LONG',
                text: '<span class="green"><strong>LONG</strong></span> = Bet cookies will go <strong>UP</strong>!<br><br>If the opponent\'s cookies increase, you <span class="green">profit</span>!<br><br>⚡ <strong>Market Impact:</strong> Opening a LONG pushes their price UP!<br><br>Open a <strong>LONG</strong> on any bot!',
                button: 'Got it!',
                action: 'highlightTrading',
                task: 'Open a LONG position on a bot!',
                checkComplete: () => game.player.positions.some(p => p.type === 'long')
            },
            // Step 5: Short position
            {
                title: '📉 Step 5: Going SHORT',
                text: '<span class="red"><strong>SHORT</strong></span> = Bet cookies will go <strong>DOWN</strong>!<br><br>If the opponent\'s cookies decrease, you <span class="green">profit</span>!<br><br>⚡ <strong>Market Impact:</strong> Opening a SHORT pushes their price DOWN!<br><br>Open a <strong>SHORT</strong> on any bot!',
                button: 'Got it!',
                action: 'highlightTrading',
                task: 'Open a SHORT position on a bot!',
                checkComplete: () => game.player.positions.some(p => p.type === 'short')
            },
            // Step 6: Leverage explained
            {
                title: '⚡ Step 6: Leverage',
                text: '<strong>Leverage</strong> multiplies your gains AND losses!<br><br>• <span class="gold">2x</span> = Safe, but smaller profits<br>• <span class="gold">5x</span> = Balanced risk/reward<br>• <span class="gold">10x</span> = High risk, high reward!<br><br>⚠️ Higher leverage = closer liquidation!',
                button: 'I understand!',
                action: null
            },
            // Step 7: Liquidation warning
            {
                title: '💀 Step 7: Liquidation',
                text: 'If the price moves <strong>against you</strong> too far, you get <span class="red">LIQUIDATED</span>!<br><br>You lose your entire stake!<br><br>Watch the <strong>LIQ price</strong> on your positions!',
                button: 'Scary but got it!',
                action: null
            },
            // Step 8: Closing positions
            {
                title: '✅ Step 8: Closing Positions',
                text: 'Click <strong>CLOSE</strong> to exit a position and lock in your profit/loss!<br><br>Try closing one of your positions now!',
                button: 'Got it!',
                action: 'highlightClose',
                task: 'Close any position!',
                checkComplete: () => this._positionClosed
            },
            // Step 9: Others trading on YOU
            {
                title: '🎯 Step 9: Others Trade on YOU!',
                text: 'Other players can open positions <strong>on YOUR chart</strong>!<br><br>If they go <span class="green">LONG</span> on you and you go UP, <strong>you pay them</strong>!<br>If they go <span class="red">SHORT</span> on you and you go DOWN, <strong>you pay them</strong>!<br><br>Watch - a bot will trade on you now!',
                button: 'Got it!',
                action: 'triggerBotTradeOnPlayer',
                task: 'Wait for a bot to open a position on you...',
                checkComplete: () => game.player.positionsOnMe.length > 0
            },
            // Step 10: Bankruptcy mechanic
            {
                title: '💸 Step 10: Bankruptcy Mechanic!',
                text: 'If someone closes a position on you and you <strong>can\'t pay</strong> the full amount...<br><br>You pay <span class="red">ALL your cookies</span> to them!<br><br>⚠️ This can wipe you out! Build up cookies and generators to survive!',
                button: 'Scary!',
                action: 'demoBankruptcy',
                task: null
            },
            // Step 11: Win condition
            {
                title: '🏆 Step 11: How to Win',
                text: 'First player to reach <span class="gold">1,000,000 cookies</span> wins!<br><br>Combine:<br>• 👆 Clicking<br>• 🏭 Generators<br>• 📈 Smart trading<br><br>to dominate!',
                button: 'Ready to compete!',
                action: null
            },
            // Step 12: Final
            {
                title: '🎉 Tutorial Complete!',
                text: 'You\'ve learned all the mechanics!<br><br>Now practice against the bots, or jump into <strong>real multiplayer</strong>!<br><br>Good luck, cookie trader! 🍪',
                button: 'Finish Tutorial',
                action: 'completeTutorial'
            }
        ];
        
        this.renderProgress();
        this.showStep(0);
        
        // Bind button click
        const btn = document.getElementById('tutorial-btn');
        if (btn) {
            btn.addEventListener('click', () => this.nextStep());
        }
    }
    
    renderProgress() {
        const container = document.getElementById('tutorial-progress');
        if (!container) return;
        
        container.innerHTML = this.steps.map((_, i) => 
            `<div class="progress-dot ${i === 0 ? 'active' : ''}" id="dot-${i}"></div>`
        ).join('');
    }
    
    showStep(stepNum) {
        this.currentStep = stepNum;
        const step = this.steps[stepNum];
        if (!step) return;
        
        // Update overlay
        const titleEl = document.getElementById('tutorial-title');
        const textEl = document.getElementById('tutorial-text');
        const btnEl = document.getElementById('tutorial-btn');
        const overlayEl = document.getElementById('tutorial-overlay');
        
        if (titleEl) titleEl.innerHTML = step.title;
        if (textEl) textEl.innerHTML = step.text;
        if (btnEl) btnEl.textContent = step.button;
        if (overlayEl) overlayEl.classList.remove('hidden');
        
        // Update progress dots
        this.steps.forEach((_, i) => {
            const dot = document.getElementById(`dot-${i}`);
            if (dot) {
                dot.className = 'progress-dot';
                if (i < stepNum) dot.classList.add('completed');
                if (i === stepNum) dot.classList.add('active');
            }
        });
        
        // Hide task elements (with null checks)
        const taskEl = document.getElementById('tutorial-task');
        const arrowEl = document.getElementById('tutorial-arrow');
        if (taskEl) taskEl.style.display = 'none';
        if (arrowEl) arrowEl.style.display = 'none';
    }
    
    nextStep() {
        const step = this.steps[this.currentStep];
        
        // Hide overlay
        document.getElementById('tutorial-overlay').classList.add('hidden');
        
        // Execute action
        if (step.action) {
            this[step.action]();
        }
        
        // If there's a task, show it
        if (step.task) {
            this.showTask(step.task);
            this.startTaskCheck(step.checkComplete);
        } else {
            // Move to next step after delay
            setTimeout(() => {
                if (this.currentStep < this.steps.length - 1) {
                    this.showStep(this.currentStep + 1);
                }
            }, 500);
        }
    }
    
    showTask(taskText) {
        const taskEl = document.getElementById('tutorial-task');
        const textEl = document.getElementById('task-text');
        const progressEl = document.getElementById('task-progress');
        
        if (taskEl && textEl) {
            taskEl.style.display = 'block';
            textEl.textContent = taskText;
            progressEl.textContent = '';
        }
    }
    
    startTaskCheck(checkFn) {
        this.taskCheckInterval = setInterval(() => {
            if (checkFn()) {
                clearInterval(this.taskCheckInterval);
                document.getElementById('task-progress').textContent = '✅ Complete!';
                
                setTimeout(() => {
                    document.getElementById('tutorial-task').style.display = 'none';
                    this.showStep(this.currentStep + 1);
                }, 1000);
            }
        }, 100);
    }
    
    // Actions
    startClickTask() {
        // Highlight the cookie
        const cookie = document.getElementById('big-cookie');
        if (cookie) {
            cookie.classList.add('highlight-element');
        }
    }
    
    highlightGenerators() {
        const gen = document.getElementById('generator-grandma');
        if (gen) {
            gen.classList.add('highlight-element');
        }
    }
    
    highlightTrading() {
        // Remove previous highlights
        document.querySelectorAll('.highlight-element').forEach(el => el.classList.remove('highlight-element'));
        
        // Highlight trade buttons on first bot
        const card = document.getElementById('card-CookieBot');
        if (card) {
            card.classList.add('highlight-element');
        }
    }
    
    highlightClose() {
        // Will highlight when position exists
        this._positionClosed = false;
    }
    
    triggerBotTradeOnPlayer() {
        // Force a bot to open a position on the player for demonstration
        const bot = game.bots[0]; // CookieBot
        
        // Make sure player has some cookies first
        if (game.player.cookies < 50) {
            game.player.cookies = 100;
        }
        
        // Bot opens a LONG on player
        setTimeout(() => {
            const stake = 20;
            const position = {
                id: Date.now() + '-demo-' + Math.random().toString(36).substr(2, 9),
                ownerName: bot.name,
                targetName: 'You',
                type: 'long',
                stake,
                leverage: 2,
                entryPrice: game.player.cookies,
                liquidationPrice: game.player.cookies * 0.5,
                openTime: Date.now()
            };
            
            bot.positions.push(position);
            game.player.positionsOnMe.push(position);
            bot.cookies -= stake;
            
            game.showNotification(`🤖 ${bot.name} opened LONG on YOU for ${stake}🍪!`, 'warning');
        }, 1500);
    }
    
    demoBankruptcy() {
        // Show a demonstration of what happens when you can't pay
        // Create a mock scenario visualization
        const message = `
            <strong>Example Scenario:</strong><br><br>
            • You have <span class="gold">50🍪</span><br>
            • Bot has LONG position that's +200🍪 in profit<br>
            • Bot closes position...<br><br>
            <span class="red">You can't pay 200🍪!</span><br>
            <span class="red">→ You pay ALL 50🍪 instead!</span><br><br>
            The bot gets your entire balance! 💀
        `;
        
        // Update the tutorial text to show this
        const textEl = document.getElementById('tutorial-text');
        if (textEl) {
            textEl.innerHTML += `<div style="margin-top:15px; padding:10px; background:rgba(231,76,60,0.2); border-radius:8px; font-size:0.85em;">${message}</div>`;
        }
    }
    
    completeTutorial() {
        document.getElementById('tutorial-task').style.display = 'none';
        
        // Show victory screen
        document.getElementById('final-cookies').textContent = Math.floor(game.player.cookies);
        document.getElementById('victory-overlay').style.display = 'flex';
    }
    
    // Event callbacks
    onCookieClick(amount) {
        this.clickCount++;
        this.cookiesFromClicks += amount;
        
        if (this.currentStep === 1) {
            document.getElementById('task-progress').textContent = 
                `${Math.floor(game.player.cookies)} / 20 cookies`;
        }
        
        // Remove highlight after first few clicks
        if (this.clickCount > 5) {
            document.getElementById('big-cookie')?.classList.remove('highlight-element');
        }
    }
    
    onGeneratorBuy(genId) {
        document.getElementById(`generator-${genId}`)?.classList.remove('highlight-element');
    }
    
    onPositionOpen(type, target) {
        document.querySelectorAll('.highlight-element').forEach(el => el.classList.remove('highlight-element'));
    }
    
    onPositionClose(pnl) {
        this._positionClosed = true;
    }
    
    onLiquidation() {
        // Could show a special message
    }
}

// Initialize
let game;
let tutorialManager;

// Add float animation
const style = document.createElement('style');
style.textContent = `
@keyframes floatUp {
    0% { opacity: 1; transform: translateY(0); }
    100% { opacity: 0; transform: translateY(-50px); }
}
`;
document.head.appendChild(style);

document.addEventListener('DOMContentLoaded', () => {
    game = new TutorialGame();
    window.game = game;
    
    tutorialManager = new TutorialManager();
    window.tutorialManager = tutorialManager;
});

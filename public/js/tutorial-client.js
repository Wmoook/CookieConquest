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
        this.targetLeverage = {};
        
        // Bot players
        this.bots = [
            { name: 'CookieBot', cookies: 600, cps: 2, generators: { grandma: 2, bakery: 0, factory: 0, mine: 0, bank: 0, temple: 0 }, positions: [], positionsOnMe: [], isBot: true },
            { name: 'TraderBot', cookies: 600, cps: 1, generators: { grandma: 1, bakery: 0, factory: 0, mine: 0, bank: 0, temple: 0 }, positions: [], positionsOnMe: [], isBot: true }
        ];
        
        // Player data
        this.player = {
            name: 'You',
            cookies: 0,
            cps: 0,
            clickPower: 1,
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
        
        // Generator clicks (exclude click upgrade button)
        document.querySelectorAll('.generator-btn:not(.click-upgrade-btn)').forEach(btn => {
            btn.addEventListener('click', () => this.buyGenerator(btn.dataset.generator));
        });
        
        // Click power upgrade button
        const upgradeClickBtn = document.getElementById('upgrade-click');
        if (upgradeClickBtn) {
            upgradeClickBtn.addEventListener('click', () => this.upgradeClickPower());
        }
        
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
        
        const clickLevel = this.player.clickPower || 1;
        const clickPower = Math.pow(2, clickLevel - 1); // Exponential: 1, 2, 4, 8...
        const cookiesEarned = Math.floor(this.clickMultiplier * clickPower);
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
    
    upgradeClickPower() {
        const clickLevel = this.player.clickPower || 1;
        const basePrice = 100;
        const cost = Math.floor(basePrice * Math.pow(5, clickLevel - 1));
        
        const lockedMargin = this.player.positions.reduce((sum, p) => sum + p.stake, 0);
        const available = this.player.cookies - lockedMargin;
        
        if (available >= cost) {
            this.player.cookies -= cost;
            this.player.clickPower = clickLevel + 1;
            this.cookies = this.player.cookies;
            
            // Notify tutorial
            if (window.tutorialManager) {
                window.tutorialManager.onClickUpgrade(this.player.clickPower);
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
        
        // Update click power upgrade button
        this.updateClickUpgradeButton(available);
    }
    
    updateClickUpgradeButton(available) {
        const btn = document.getElementById('upgrade-click');
        if (!btn) return;
        
        const clickLevel = this.player.clickPower || 1;
        const currentPower = Math.pow(2, clickLevel - 1);
        const basePrice = 100;
        const cost = Math.floor(basePrice * Math.pow(5, clickLevel - 1));
        const nextLevel = clickLevel + 1;
        const nextPower = Math.pow(2, nextLevel - 1);
        
        const costSpan = btn.querySelector('.click-power-cost');
        if (costSpan) costSpan.textContent = cost;
        
        const levelSpan = btn.querySelector('.click-power-level');
        if (levelSpan) levelSpan.textContent = `Lv.${clickLevel}`;
        
        const descSpan = btn.querySelector('.click-power-desc');
        if (descSpan) descSpan.textContent = `+${currentPower} per click → +${nextPower}`;
        
        if (available >= cost) {
            btn.classList.remove('locked');
        } else {
            btn.classList.add('locked');
        }
    }
    
    handleTabClick(tab) {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
        
        document.querySelector(`[data-tab="${tab}"]`)?.classList.add('active');
        document.getElementById(`${tab}-panel`)?.classList.add('active');
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
    
    // Force player to pay amount - can go into debt up to generator value, then sells all
    forcePayment(player, amount) {
        if (amount <= 0) return { paid: 0, generatorsSold: 0, debt: 0 };
        
        // Calculate how much generator value (debt limit) they have
        const generatorValue = this.calculateGeneratorValue(player);
        
        // Current net worth = cookies + generator value
        const currentNetWorth = player.cookies + generatorValue;
        
        // After paying, what would net worth be?
        const newNetWorth = currentNetWorth - amount;
        
        if (newNetWorth >= 0) {
            // Can pay without going bankrupt - just deduct from cookies (can go negative)
            player.cookies -= amount;
            return { paid: amount, generatorsSold: 0, debt: player.cookies < 0 ? -player.cookies : 0 };
        }
        
        // Would go below 0 net worth - FULL BANKRUPTCY!
        // Sell ALL generators and set cookies to 0
        const generatorOrder = ['grandma', 'bakery', 'factory', 'mine', 'bank', 'temple'];
        let generatorsSold = 0;
        
        for (const genType of generatorOrder) {
            generatorsSold += player.generators[genType] || 0;
            player.generators[genType] = 0;
        }
        
        // Update CPS to 0 (no generators)
        player.cps = 0;
        
        // Set cookies to 0 (full bankruptcy)
        player.cookies = 0;
        player.isBankrupt = true;
        
        this.showNotification(`💀 FULL BANKRUPTCY! All generators liquidated!`, 'error');
        
        return { paid: currentNetWorth, generatorsSold, debt: 0, bankrupt: true };
    }

    openPosition(targetName, type, stake, leverage) {
        const target = this.allPlayers.find(p => p.name === targetName);
        if (!target || target.name === 'You') return false;
        
        const lockedMargin = this.player.positions.reduce((sum, p) => sum + p.stake, 0);
        const available = this.player.cookies - lockedMargin;
        
        if (stake > available) {
            this.showNotification(`Not enough available cookies! Have ${Math.floor(available)}`, 'error');
            return false;
        }
        
        if (target.cookies < 500) {
            this.showNotification(`${target.name} needs at least 500🍪 to trade on!`, 'error');
            return false;
        }
        
        // Calculate target's net worth for position limits
        const targetNetWorth = target.cookies + this.calculateGeneratorValue(target);
        
        // Max total stake on target = 50% of their net worth (regardless of leverage)
        const existingStakes = this.player.positions
            .filter(p => p.targetName === targetName)
            .reduce((sum, p) => sum + p.stake, 0);
        const newTotalStake = existingStakes + stake;
        const maxTotalStake = Math.floor(targetNetWorth * 0.5);
        if (newTotalStake > maxTotalStake) {
            this.showNotification(`Max stake on ${target.name} is ${maxTotalStake}🍪 (50% of net worth)`, 'error');
            return false;
        }
        
        const entryPrice = target.cookies;
        const liquidationPercent = 1 / leverage;
        let liquidationPrice;
        
        if (type === 'long') {
            liquidationPrice = entryPrice * (1 - liquidationPercent);
            if (liquidationPrice < 10) return false;
        } else {
            liquidationPrice = entryPrice * (1 + liquidationPercent);
        }
        
        // Check if there's an existing position with same type and leverage to add to
        const existingPos = this.player.positions.find(p => 
            p.targetName === targetName && p.type === type && p.leverage === leverage
        );
        
        if (existingPos) {
            // Add to existing position - calculate new weighted average entry price
            const totalStake = existingPos.stake + stake;
            const weightedEntry = (existingPos.entryPrice * existingPos.stake + entryPrice * stake) / totalStake;
            existingPos.entryPrice = weightedEntry;
            existingPos.stake = totalStake;
            
            // Recalculate liquidation price based on new entry
            if (type === 'long') {
                existingPos.liquidationPrice = weightedEntry * (1 - (1 / leverage));
            } else {
                existingPos.liquidationPrice = weightedEntry * (1 + (1 / leverage));
            }
            
            this.showNotification(`Added ${stake}🍪 to ${type.toUpperCase()} position on ${targetName}!`, 'success');
            
            if (window.tutorialManager) {
                window.tutorialManager.onPositionOpen(type, targetName);
            }
            
            return true;
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
        
        // Calculate PNL using total value (cookies + generators)
        const currentPrice = target.cookies;
        const priceChange = currentPrice - position.entryPrice;
        const pnlMultiplier = position.type === 'long' ? 1 : -1;
        const pnl = Math.floor((priceChange / (position.entryPrice || 1)) * position.stake * position.leverage * pnlMultiplier);
        
        // Don't add stake back - it was never deducted from player.cookies
        // Just apply the PNL
        if (pnl > 0) {
            // Force the target to pay - sell their generators if needed, go into debt
            this.forcePayment(target, pnl);
            this.player.cookies += pnl;
            this.showNotification(`🎉 Closed for +${pnl}🍪 profit!`, 'success');
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
        // Add to activity feed
        const feed = document.getElementById('notif-feed');
        if (feed) {
            const notif = document.createElement('div');
            notif.className = 'notif-item ' + type;
            notif.style.cssText = `
                padding: 8px 10px;
                margin-bottom: 5px;
                border-radius: 6px;
                font-size: 0.85em;
                animation: slideIn 0.3s ease;
                background: ${type === 'success' ? 'rgba(46, 204, 113, 0.2)' : 
                             type === 'error' ? 'rgba(231, 76, 60, 0.2)' :
                             type === 'warning' ? 'rgba(243, 156, 18, 0.2)' : 'rgba(100, 100, 100, 0.2)'};
                border-left: 3px solid ${type === 'success' ? '#2ecc71' : 
                                        type === 'error' ? '#e74c3c' :
                                        type === 'warning' ? '#f39c12' : '#888'};
            `;
            notif.textContent = message;
            
            // Add to top of feed
            feed.insertBefore(notif, feed.firstChild);
            
            // Keep only last 15 notifications
            while (feed.children.length > 15) {
                feed.removeChild(feed.lastChild);
            }
            
            // Auto-remove after 20 seconds
            setTimeout(() => {
                if (notif.parentNode) {
                    notif.style.opacity = '0';
                    notif.style.transition = 'opacity 0.3s';
                    setTimeout(() => notif.remove(), 300);
                }
            }, 20000);
        }
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
                            ${!isMe ? `<span class="stat-networth-small" id="networth-${chartId}" style="color: #9b59b6; font-size: 0.75em;">💎 ${player.cookies}</span>` : ''}
                            <span class="stat-velocity up" id="vel-${chartId}">+${player.cps}/s</span>
                        </div>
                    </div>
                    <div class="chart-controls">
                        <button class="zoom-btn zoom-in" data-chart="${chartId}">+</button>
                        <button class="zoom-btn zoom-out" data-chart="${chartId}">-</button>
                        <button class="zoom-btn zoom-all" data-chart="${chartId}">ALL</button>
                        <button class="zoom-btn zoom-live" data-chart="${chartId}">LIVE</button>
                    </div>
                    <div class="chart-container" id="chart-container-${chartId}" data-chart="${chartId}">
                        <canvas class="chart-canvas" id="chart-${chartId}"></canvas>
                        <div class="chart-overlay"></div>
                    </div>
                    ${!isMe ? `
                    <div class="card-actions">
                        <div class="trade-controls">
                            <div class="leverage-select" id="lev-select-${chartId}">
                                <button class="lev-btn" data-lev="2">2x</button>
                                <button class="lev-btn" data-lev="3">3x</button>
                                <button class="lev-btn" data-lev="4">4x</button>
                                <button class="lev-btn active" data-lev="5">5x</button>
                                <button class="lev-btn" data-lev="6">6x</button>
                                <button class="lev-btn" data-lev="7">7x</button>
                                <button class="lev-btn" data-lev="8">8x</button>
                                <button class="lev-btn" data-lev="9">9x</button>
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
                    <div class="positions-on-me-section">
                        <div class="positions-on-me-header">📊 Positions on YOU</div>
                        <div class="positions-on-me-list" id="positions-on-me-list"></div>
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
                // Initialize default leverage (5x is active by default)
                this.targetLeverage[chartId] = 5;
                levSelect.querySelectorAll('.lev-btn').forEach(btn => {
                    btn.addEventListener('click', () => {
                        levSelect.querySelectorAll('.lev-btn').forEach(b => b.classList.remove('active'));
                        btn.classList.add('active');
                        this.targetLeverage[chartId] = parseInt(btn.dataset.lev) || 5;
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
        const target = this.allPlayers.find(p => {
            const tid = p.name === 'You' ? 'you' : p.name;
            return tid === chartId;
        });
        if (!target || target.name === 'You') return;
        
        // Available cookies
        const lockedMargin = this.player.positions.reduce((sum, p) => sum + p.stake, 0);
        const available = this.player.cookies - lockedMargin;
        
        // Target's net worth
        const targetNetWorth = target.cookies + this.calculateGeneratorValue(target);
        
        // Max stake = 50% of target's net worth (regardless of leverage)
        const maxFromNetWorth = Math.floor(targetNetWorth * 0.5);
        
        // Subtract existing stakes on this target
        const existingStakes = this.player.positions
            .filter(p => p.targetName === target.name)
            .reduce((sum, p) => sum + p.stake, 0);
        const remainingAllowed = maxFromNetWorth - existingStakes;
        
        // Take minimum of available cookies and remaining allowed
        const maxStake = Math.max(1, Math.min(available, remainingAllowed));
        
        const input = document.getElementById(`stake-${chartId}`);
        if (input) input.value = maxStake;
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
        // Check player positions - also check for bot bankruptcy (can't pay)
        this.player.positions = this.player.positions.filter(pos => {
            const target = this.allPlayers.find(p => p.name === pos.targetName);
            if (!target) return false;
            
            // Use total value (cookies + generators) for price
            const currentPrice = target.cookies;
            let isLiquidated = false;
            
            if (pos.type === 'long' && currentPrice <= pos.liquidationPrice) {
                isLiquidated = true;
            } else if (pos.type === 'short' && currentPrice >= pos.liquidationPrice) {
                isLiquidated = true;
            }
            
            if (isLiquidated) {
                // Player loses stake - actually deduct it!
                this.player.cookies -= pos.stake;
                target.cookies += pos.stake;
                this.showNotification(`💀 LIQUIDATED on ${pos.targetName}! Lost ${pos.stake}🍪`, 'error');
                
                if (window.tutorialManager) {
                    window.tutorialManager.onLiquidation();
                }
                
                return false;
            }
            
            // Check if bot would go bankrupt (can't pay out your winning position)
            if (target.isBot) {
                const priceChange = currentPrice - pos.entryPrice;
                const pnlMultiplier = pos.type === 'long' ? 1 : -1;
                const pnl = Math.floor((priceChange / (pos.entryPrice || 1)) * pos.stake * pos.leverage * pnlMultiplier);
                
                // If PNL exceeds what bot can pay, auto-close (bot bankruptcy)
                if (pnl > 0 && pnl >= target.cookies) {
                    const payout = target.cookies; // Take everything the bot has
                    this.player.cookies += pos.stake + payout;
                    this.showNotification(`💸 ${target.name} BANKRUPT! You gained ${pos.stake + payout}🍪!`, 'success');
                    target.cookies = 0;
                    return false;
                }
            }
            
            return true;
        });
        
        // Check bot positions on player - bots get liquidated too!
        let botLiquidated = false;
        this.bots.forEach(bot => {
            bot.positions = bot.positions.filter(pos => {
                if (pos.targetName !== 'You') return true;
                
                // Use total value (cookies + generators) for price
                const currentPrice = this.player.cookies;
                let isLiquidated = false;
                
                // 2x leverage = liquidated at 50% price drop (long) or 50% price rise (short)
                if (pos.type === 'long' && currentPrice <= pos.liquidationPrice) {
                    isLiquidated = true;
                } else if (pos.type === 'short' && currentPrice >= pos.liquidationPrice) {
                    isLiquidated = true;
                }
                
                if (isLiquidated) {
                    // Bot loses their stake - player gets it
                    this.player.cookies += pos.stake;
                    this.showNotification(`💀 ${bot.name} LIQUIDATED! You gained ${pos.stake}🍪!`, 'success');
                    
                    // Remove from player's positionsOnMe
                    this.player.positionsOnMe = this.player.positionsOnMe.filter(p => p.id !== pos.id);
                    botLiquidated = true;
                    
                    return false;
                }
                return true;
            });
        });
        
        // Update UI if any bot was liquidated
        if (botLiquidated) {
            this.updatePositionsOnMe();
        }
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
            
            // Use total value (cookies + generators) as the price
            const currentPrice = target.cookies;
            const priceChange = currentPrice - pos.entryPrice;
            const pnlMultiplier = pos.type === 'long' ? 1 : -1;
            const pnl = Math.floor((priceChange / (pos.entryPrice || 1)) * pos.stake * pos.leverage * pnlMultiplier);
            totalPnl += pnl;
        });
        return totalPnl;
    }
    
    updateUI() {
        // Calculate locked stake and unrealized PNL
        const lockedStake = this.player.positions.reduce((sum, p) => sum + p.stake, 0);
        const unrealizedPnl = this.calculateUnrealizedPnl(this.player);
        
        // player.cookies = base cookies (stakes are NOT deducted from this)
        // Total value = base cookies + unrealized PNL (stakes are already part of base)
        const totalValue = this.player.cookies + unrealizedPnl;
        
        // Update cookie display - show TOTAL VALUE (base + unrealized PNL)
        const cookieEl = document.getElementById('cookie-count');
        if (cookieEl) cookieEl.textContent = Math.floor(totalValue);
        
        const cpsEl = document.getElementById('cps-value');
        if (cpsEl) cpsEl.textContent = this.player.cps;
        
        // Calculate and display Net Worth (totalValue + generator value)
        // Use totalValue which already includes unrealized PNL for consistency with cookie display
        const generatorValue = this.calculateGeneratorValue(this.player);
        const netWorth = Math.floor(totalValue) + generatorValue;
        const networthEl = document.getElementById('networth-value');
        if (networthEl) {
            networthEl.textContent = Math.floor(netWorth).toLocaleString();
        }
        
        // Calculate Real Balance (what you'd have if all positions on you closed now)
        const positionsOnMe = this.player.positionsOnMe || [];
        let opponentsPotentialProfit = 0;
        for (const pos of positionsOnMe) {
            const currentPrice = this.player.cookies;
            const priceChange = currentPrice - pos.entryPrice;
            const pnlMultiplier = pos.type === 'long' ? 1 : -1;
            const theirPnl = Math.floor((priceChange / (pos.entryPrice || 1)) * pos.stake * pos.leverage * pnlMultiplier);
            if (theirPnl > 0) {
                opponentsPotentialProfit += theirPnl;
            }
        }
        
        const realBalance = this.player.cookies - opponentsPotentialProfit;
        const realBalanceContainer = document.getElementById('real-balance-container');
        const realBalanceValue = document.getElementById('real-balance-value');
        
        if (realBalanceContainer && realBalanceValue) {
            if (opponentsPotentialProfit > 0) {
                realBalanceContainer.style.display = 'block';
                realBalanceValue.textContent = Math.floor(realBalance).toLocaleString();
                
                // Color code: red if would go negative, orange if low, white if still good
                if (realBalance < 0) {
                    realBalanceValue.style.color = '#e74c3c';
                } else if (realBalance < this.player.cookies * 0.5) {
                    realBalanceValue.style.color = '#f39c12';
                } else {
                    realBalanceValue.style.color = '#e74c3c';
                }
            } else {
                realBalanceContainer.style.display = 'none';
            }
        }
        
        // Update available (base cookies minus what's locked in positions)
        const availableEl = document.getElementById('available-value');
        if (availableEl) {
            availableEl.textContent = Math.floor(this.player.cookies - lockedStake);
        }
        
        // Locked shows: stake + unrealized PNL (value of your positions)
        const lockedWithPnl = lockedStake + unrealizedPnl;
        
        // Main locked display in stats
        const lockedDisplay = document.getElementById('locked-display');
        const lockedVal = document.getElementById('locked-value');
        if (lockedDisplay && lockedVal) {
            if (lockedStake > 0) {
                lockedDisplay.style.display = 'block';
                lockedVal.textContent = Math.floor(lockedWithPnl);
                // Color based on PNL like main game
                if (unrealizedPnl > 0) {
                    lockedVal.style.color = '#2ecc71';
                } else if (unrealizedPnl < 0) {
                    lockedVal.style.color = '#e74c3c';
                } else {
                    lockedVal.style.color = '#f1c40f';
                }
            } else {
                lockedDisplay.style.display = 'none';
            }
        }
        
        // Also update locked-margin if it exists (player card)
        const lockedMarginEl = document.getElementById('locked-margin');
        if (lockedMarginEl) {
            if (lockedStake > 0) {
                lockedMarginEl.textContent = `🔒 ${Math.floor(lockedWithPnl)}`;
                lockedMarginEl.style.display = 'inline-block';
                if (unrealizedPnl > 0) {
                    lockedMarginEl.style.color = '#2ecc71';
                } else if (unrealizedPnl < 0) {
                    lockedMarginEl.style.color = '#e74c3c';
                } else {
                    lockedMarginEl.style.color = '#f1c40f';
                }
            } else {
                lockedMarginEl.style.display = 'none';
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
            
            // Update net worth display for other players (cookies + generator value)
            // Use floored cookies for consistency with cookie display
            if (player.name !== 'You') {
                const generatorValue = this.calculateGeneratorValue(player);
                const flooredCookies = Math.floor(player.cookies);
                const netWorth = flooredCookies + generatorValue;
                const networthEl = document.getElementById(`networth-${chartId}`);
                if (networthEl) {
                    networthEl.textContent = `💎 ${netWorth.toLocaleString()}`;
                }
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
            
            // Use total value (cookies + generators) as the price
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
        const container = document.getElementById('positions-on-me-list');
        if (!container) return;
        
        const positionsOnMe = this.player.positionsOnMe || [];
        
        if (positionsOnMe.length === 0) {
            container.innerHTML = '<div class="no-positions-on-me">No one is trading on you yet</div>';
            return;
        }
        
        container.innerHTML = positionsOnMe.map(pos => {
            const currentPrice = this.player.cookies;
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
        
        // Calculate bounds - allow negative values for debt display
        let min = Math.min(...data);
        let max = Math.max(...data);
        
        // Expand bounds to include liquidation prices on player's chart
        if (player && player.name === 'You' && this.player.positionsOnMe && this.player.positionsOnMe.length > 0) {
            this.player.positionsOnMe.forEach(pos => {
                if (pos.liquidationPrice) {
                    min = Math.min(min, pos.liquidationPrice);
                    max = Math.max(max, pos.liquidationPrice);
                }
            });
        }
        
        // Expand bounds to include liquidation prices on target charts
        if (player && player.name !== 'You') {
            const position = this.player.positions.find(p => p.targetName === player.name);
            if (position && position.liquidationPrice) {
                min = Math.min(min, position.liquidationPrice);
                max = Math.max(max, position.liquidationPrice);
            }
        }
        
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
        
        // Draw liquidation zones for positions ON the player (others betting on you)
        if (player && player.name === 'You' && this.player.positionsOnMe && this.player.positionsOnMe.length > 0) {
            this.player.positionsOnMe.forEach((pos, idx) => {
                if (!pos.liquidationPrice) return;
                
                const liqY = H - ((pos.liquidationPrice - min) / range) * H;
                
                // Liquidation line for this position
                ctx.setLineDash([3, 3]);
                ctx.strokeStyle = pos.type === 'long' ? '#e74c3c' : '#2ecc71';
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.moveTo(MARGIN_LEFT, liqY);
                ctx.lineTo(W, liqY);
                ctx.stroke();
                ctx.setLineDash([]);
                
                // Label with owner name
                ctx.fillStyle = pos.type === 'long' ? '#e74c3c' : '#2ecc71';
                ctx.font = 'bold 8px Arial';
                ctx.textAlign = 'left';
                const offset = idx * 12; // Stagger labels if multiple
                ctx.fillText(`${pos.ownerName} LIQ`, MARGIN_LEFT + 5 + offset, liqY - 3);
            });
        }
        
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
                
                // Occasionally open position on player if they have enough cookies (need 100+ to be traded on)
                // Bots need player to have 100+ total value to trade on
                const playerValue = this.player.cookies;
                if (bot.cookies > 150 && playerValue >= 100 && Math.random() < 0.02) {
                    const stake = Math.floor(Math.min(bot.cookies * 0.1, 30));
                    const type = Math.random() < 0.5 ? 'long' : 'short';
                    
                    const position = {
                        id: Date.now() + '-bot-' + Math.random().toString(36).substr(2, 9),
                        ownerName: bot.name,
                        targetName: 'You',
                        type,
                        stake,
                        leverage: 2,
                        entryPrice: playerValue,
                        liquidationPrice: type === 'long' ? playerValue * 0.5 : playerValue * 1.5,
                        openTime: Date.now()
                    };
                    
                    bot.positions.push(position);
                    bot.cookies -= stake;
                    this.player.positionsOnMe.push(position);
                    
                    this.showNotification(`🤖 ${bot.name} opened a position on YOU!`, 'warning');
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
            // Bot profits - force player to pay (sell generators, go into debt)
            this.forcePayment(this.player, pnl);
            bot.cookies += pnl;
            this.showNotification(`🤖 ${bot.name} closed position! You paid ${pnl}🍪`, 'warning');
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
    
    closeAllPositionsOnPlayer() {
        // Close all positions that bots have on the player (bankruptcy)
        this.bots.forEach(bot => {
            const positionsOnPlayer = bot.positions.filter(p => p.targetName === 'You');
            positionsOnPlayer.forEach(pos => {
                // Return stake to bot without paying PNL (already bankrupted)
                bot.cookies += pos.stake;
                bot.positions = bot.positions.filter(p => p.id !== pos.id);
            });
        });
        this.player.positionsOnMe = [];
        this.showNotification(`All positions on you have been closed!`, 'info');
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
                text: 'Generators produce cookies <strong>automatically</strong>!<br><br>Buy a <span class="gold">Grandma</span> (costs 15🍪) to earn +1/sec!<br><br>⚡ Generators also count towards your <strong>Net Worth</strong>!',
                button: 'Got it!',
                action: 'highlightGenerators',
                task: 'Buy a Grandma generator!',
                checkComplete: () => game.player.generators.grandma >= 1
            },
            // Step 3: Click Power Upgrade
            {
                title: '⬆️ Step 3: Click Power Upgrade!',
                text: 'Below generators is the <span class="red">Click Power</span> upgrade!<br><br>• Increases cookies earned per click<br>• Cost doubles each level (50, 100, 200...)<br><br>⚠️ <strong>WARNING:</strong> These cookies are <span class="red">LOST FOREVER</span> - they don\'t count as net worth like generators!',
                button: 'Risky but powerful!',
                action: 'highlightClickUpgrade',
                task: null
            },
            // Step 4: Charts explained
            {
                title: '📈 Step 4: Understanding Charts',
                text: 'Each player has a <strong>chart</strong> showing their cookie count over time.<br><br><span class="green">Your chart is GREEN</span><br><span class="red">Opponents are RED</span><br><br>You can <strong>trade</strong> on opponent charts!',
                button: 'Show me trading!',
                action: null
            },
            // Step 5: Long position
            {
                title: '📈 Step 5: Going LONG',
                text: '<span class="green"><strong>LONG</strong></span> = Bet cookies will go <strong>UP</strong>!<br><br>If the opponent\'s cookies increase, you <span class="green">profit</span>!<br><br>Open a <strong>LONG</strong> on any bot!',
                button: 'Got it!',
                action: 'highlightTrading',
                task: 'Open a LONG position on a bot!',
                checkComplete: () => game.player.positions.some(p => p.type === 'long')
            },
            // Step 6: Short position
            {
                title: '📉 Step 6: Going SHORT',
                text: '<span class="red"><strong>SHORT</strong></span> = Bet cookies will go <strong>DOWN</strong>!<br><br>If the opponent\'s cookies decrease, you <span class="green">profit</span>!<br><br>Open a <strong>SHORT</strong> on any bot!',
                button: 'Got it!',
                action: 'highlightTrading',
                task: 'Open a SHORT position on a bot!',
                checkComplete: () => game.player.positions.some(p => p.type === 'short')
            },
            // Step 7: Leverage explained
            {
                title: '⚡ Step 7: Leverage & Limits',
                text: '<strong>Leverage</strong> multiplies your gains AND losses!<br><br>• <span class="gold">2x</span> = Safe, but smaller profits<br>• <span class="gold">5x</span> = Balanced risk/reward<br>• <span class="gold">10x</span> = High risk, high reward!<br><br>⚠️ <strong>LIMIT:</strong> You can only bet up to <span class="gold">50%</span> of someone\'s net worth!<br>Use the <strong>MAX</strong> button to calculate your maximum stake.',
                button: 'I understand!',
                action: null
            },
            // Step 8: Liquidation warning
            {
                title: '💀 Step 8: Liquidation',
                text: 'If the price moves <strong>against you</strong> too far, you get <span class="red">LIQUIDATED</span>!<br><br>You lose your entire stake!<br><br>Watch the <strong>LIQ price</strong> on your positions!',
                button: 'Scary but got it!',
                action: null
            },
            // Step 9: Closing positions
            {
                title: '✅ Step 9: Closing Positions',
                text: 'Click <strong>CLOSE</strong> to exit a position and lock in your profit/loss!<br><br>Try closing one of your positions now!',
                button: 'Got it!',
                action: 'highlightClose',
                task: 'Close any position!',
                checkComplete: () => this._positionClosed
            },
            // Step 10: Others trading on YOU
            {
                title: '🎯 Step 10: Others Trade on YOU!',
                text: 'Other players can open positions <strong>on YOUR chart</strong>!<br><br>If they go <span class="green">LONG</span> on you and you go UP, <strong>you pay them</strong>!<br>If they go <span class="red">SHORT</span> on you and you go DOWN, <strong>you pay them</strong>!<br><br>Watch - a bot will trade on you now!',
                button: 'Got it!',
                action: 'triggerBotTradeOnPlayer',
                task: 'Wait for a bot to open a position on you...',
                checkComplete: () => game.player.positionsOnMe.length > 0
            },
            // Step 11: Debt mechanic
            {
                title: '📉 Step 11: Going Into DEBT!',
                text: 'When you <strong>lose on a position</strong> or someone profits from trading on you...<br><br>Your cookies can go <span class="red">NEGATIVE</span>!<br><br>This is <strong>debt</strong> - you owe cookies!<br><br>But don\'t panic - your generators still produce income to pay it back!',
                button: 'So I can owe cookies?',
                action: null
            },
            // Step 12: Generators as collateral
            {
                title: '🏭 Step 12: Generators = Collateral!',
                text: 'Your generators have <strong>value</strong> (90% of purchase price)!<br><br>This value is your <span class="gold">NET WORTH</span> = Cookies + Generator Value<br><br>You can go into debt as long as your <strong>net worth stays positive</strong>!<br><br>Generators protect you from bankruptcy!',
                button: 'Build generators to survive!',
                action: null
            },
            // Step 13: Bankruptcy mechanic
            {
                title: '💀 Step 13: BANKRUPTCY!',
                text: 'If your <span class="red">NET WORTH goes negative</span>...<br><br>💥 <strong>FULL BANKRUPTCY!</strong> 💥<br><br>• ALL generators are sold<br>• Cookies set to 0<br>• Everything goes to the winner<br><br>Build generators as insurance against big losses!',
                button: 'Scary!',
                action: 'demoBankruptcy',
                task: null
            },
            // Step 14: Win condition
            {
                title: '🏆 Step 14: How to Win',
                text: 'First player to reach <span class="gold">100,000,000 cookies</span> wins!<br><br>Combine:<br>• 👆 Clicking (+ Click Power upgrades)<br>• 🏭 Generators (passive income + protection)<br>• 📈 Smart trading (profit from others)<br><br>to dominate!',
                button: 'Ready to compete!',
                action: null
            },
            // Step 15: Final
            {
                title: '🎉 Tutorial Complete!',
                text: 'You\'ve learned all the mechanics!<br><br>Remember:<br>• <span class="green">Generators</span> = Income + Protection<br>• <span class="red">Click Power</span> = Power but no protection<br>• <span class="gold">Net Worth</span> = Your survival buffer<br><br>Good luck, cookie trader! 🍪',
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
    
    highlightClickUpgrade() {
        // Remove previous highlights
        document.querySelectorAll('.highlight-element').forEach(el => el.classList.remove('highlight-element'));
        
        const upgradeBtn = document.getElementById('upgrade-click');
        if (upgradeBtn) {
            upgradeBtn.classList.add('highlight-element');
            // Scroll to make it visible
            upgradeBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
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
            • Bot has LONG on you, unrealized PNL: +60🍪<br><br>
            <span class="red">Their PNL > Your cookies!</span><br>
            <span class="red">→ INSTANT BANKRUPTCY!</span><br>
            <span class="red">→ They take ALL 50🍪 automatically!</span><br><br>
            No closing needed - it happens instantly! 💀
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

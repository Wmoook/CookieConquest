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
        
        // Multiplayer cursor tracking
        this.otherCursors = {}; // playerName -> cursor DOM element
        this.lastCursorUpdate = 0;
        
        // Screen tint timeout tracker
        this.screenTintTimeout = null;
        
        this.init();
    }
    
    // Screen tint effect for money gain/loss
    showScreenTint(type, duration = 500) {
        const tint = document.getElementById('screen-tint');
        if (!tint) return;
        
        // Clear any existing timeout
        if (this.screenTintTimeout) {
            clearTimeout(this.screenTintTimeout);
        }
        
        // Remove existing classes
        tint.classList.remove('green', 'red', 'active');
        
        // Add the appropriate color class
        tint.classList.add(type);
        
        // Force reflow to restart animation
        tint.offsetHeight;
        
        // Activate
        tint.classList.add('active');
        
        // Fade out after duration
        this.screenTintTimeout = setTimeout(() => {
            tint.classList.remove('active');
            // Clean up class after fade
            setTimeout(() => {
                tint.classList.remove('green', 'red');
            }, 150);
        }, duration);
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
            // Log significant changes to help debug
            if (this.gameState) {
                for (const player of gameState.players) {
                    const oldPlayer = this.gameState.players.find(p => p.name === player.name);
                    if (oldPlayer) {
                        // Log cookie changes
                        if (Math.abs(player.cookies - oldPlayer.cookies) > 1) {
                            const diff = player.cookies - oldPlayer.cookies;
                            console.log(`[COOKIE_CHANGE] ${player.name}: ${oldPlayer.cookies.toFixed(0)} → ${player.cookies.toFixed(0)} (${diff > 0 ? '+' : ''}${diff.toFixed(0)})`);
                        }
                        // Log CPS changes
                        if (player.cps !== oldPlayer.cps) {
                            console.log(`[CPS_CHANGE] ${player.name}: ${oldPlayer.cps} → ${player.cps}`);
                        }
                        // Log generator changes
                        for (const gen of Object.keys(player.generators || {})) {
                            if (player.generators[gen] !== (oldPlayer.generators || {})[gen]) {
                                console.log(`[GENERATOR_CHANGE] ${player.name}: ${gen} ${(oldPlayer.generators || {})[gen] || 0} → ${player.generators[gen]}`);
                            }
                        }
                    }
                }
                // Log position changes
                if (gameState.positions.length !== this.gameState.positions.length) {
                    console.log(`[POSITIONS_CHANGE] ${this.gameState.positions.length} → ${gameState.positions.length} positions`);
                }
            }
            this.gameState = gameState;
            this.updateFromServerState();
        });
        
        this.socket.on('game:positionOpened', ({ by }) => {
            this.showNotification(`👁️ ${by} opened a position on YOU!`, 'warning');
        });
        
        this.socket.on('game:error', ({ message }) => {
            this.showNotification(message, 'error');
        });
        
        this.socket.on('game:notification', ({ type, message }) => {
            // Market impact notifications
            this.showNotification(message, type === 'market' ? 'info' : 'info');
        });
        
        this.socket.on('game:liquidated', ({ position }) => {
            console.log('RECEIVED game:liquidated', position);
            this.showNotification(`💀 LIQUIDATED! Lost ${position.stake}🍪 on ${position.targetName}!`, 'error');
            this.showScreenTint('red', 800); // Red tint when YOU get liquidated (lose money)
        });
        
        this.socket.on('game:youLiquidatedSomeone', ({ from, amount }) => {
            console.log('RECEIVED game:youLiquidatedSomeone', from, amount);
            this.showNotification(`🎉 You LIQUIDATED ${from}! Gained ${amount}🍪!`, 'success');
            this.showScreenTint('green', 800); // Green tint when you liquidate someone (gain money)
        });
        
        this.socket.on('game:maxPayout', ({ position, amount }) => {
            console.log('RECEIVED game:maxPayout', position, amount);
            this.showNotification(`🎯 MAX PAYOUT on ${position.targetName}! Won ${amount}🍪!`, 'success');
            this.showScreenTint('green', 600); // Green tint for max payout win
        });
        
        this.socket.on('game:positionClosed', ({ type, message, amount }) => {
            console.log('RECEIVED game:positionClosed', type, message, amount);
            const notifType = type === 'profit' ? 'success' : type === 'loss' ? 'error' : 'info';
            this.showNotification(message, notifType);
            // Screen tint based on profit/loss
            if (type === 'profit' && amount > 0) {
                this.showScreenTint('green', 500);
            } else if (type === 'loss' && amount < 0) {
                this.showScreenTint('red', 500);
            }
        });
        
        // Click activity indicator for other players
        this.socket.on('game:playerClicked', ({ playerName }) => {
            const indicator = document.getElementById(`click-ind-${playerName}`);
            if (indicator) {
                indicator.style.display = 'inline';
                // Clear any existing timeout
                if (indicator.hideTimeout) clearTimeout(indicator.hideTimeout);
                // Hide after 0.5 seconds
                indicator.hideTimeout = setTimeout(() => {
                    indicator.style.display = 'none';
                }, 500);
            }
        });
        
        // Remote cursor updates
        this.socket.on('game:cursor', ({ playerName, color, x, y }) => {
            console.log('Received cursor from', playerName, 'at', x, y);
            this.updateRemoteCursor(playerName, color, x, y);
        });
        
        // King of the Hill winner notification
        this.socket.on('game:kothWinner', ({ winnerName, winnerColor, timeOnCookie, totalBuffs }) => {
            const isMe = winnerName === this.playerName;
            const timeSeconds = (timeOnCookie / 1000).toFixed(1);
            const buffPercent = totalBuffs * 5;
            
            if (isMe) {
                this.showNotification(`👑 YOU are the Cookie King! +5% buff (now +${buffPercent}% total)`, 'profit');
                this.screenTint('gold', 500);
            } else {
                this.showNotification(`👑 ${winnerName} is the Cookie King! (${timeSeconds}s on cookie, now +${buffPercent}%)`, 'info');
            }
        });
        
        // Freeze ability events
        this.socket.on('game:playerFrozen', ({ frozenBy, frozenPlayer, duration }) => {
            const isMe = frozenPlayer === this.playerName;
            if (isMe) {
                this.showNotification(`🥶 You were FROZEN by ${frozenBy}! (${duration}s)`, 'error');
                this.screenTint('cyan', 500);
                this.showFrozenOverlay(duration);
            } else if (frozenBy === this.playerName) {
                this.showNotification(`🥶 You froze ${frozenPlayer}!`, 'profit');
            } else {
                this.showNotification(`🥶 ${frozenBy} froze ${frozenPlayer}!`, 'info');
            }
        });
        
        // Invisibility events
        this.socket.on('game:youAreInvisible', ({ duration }) => {
            this.showNotification(`👻 You are now INVISIBLE! (${duration}s)`, 'profit');
            this.showInvisibleIndicator(duration);
        });
        
        this.socket.on('game:playerInvisible', ({ playerName, duration }) => {
            this.showNotification(`👻 ${playerName} went invisible!`, 'info');
            this.hideRemoteCursor(playerName, duration);
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
        // VERY FIRST: Debug handler to catch ALL clicks at earliest possible point
        document.addEventListener('mousedown', (e) => {
            console.log('MOUSEDOWN on:', e.target.tagName, e.target.className, e.target);
        }, true);
        
        document.addEventListener('click', (e) => {
            console.log('CLICK on:', e.target.tagName, e.target.className);
        }, true);
        
        // Cookie click
        const cookie = document.getElementById('big-cookie');
        if (cookie) {
            console.log('Cookie button found, binding click handler');
            cookie.addEventListener('click', (e) => {
                console.log('Cookie clicked!');
                this.handleCookieClick(e);
            });
            
            // King of the Hill - track cursor on cookie
            cookie.addEventListener('mouseenter', () => {
                this.cursorOnCookie = true;
                this.socket.emit('game:cursorOnCookie', { onCookie: true });
            });
            cookie.addEventListener('mouseleave', () => {
                this.cursorOnCookie = false;
                this.socket.emit('game:cursorOnCookie', { onCookie: false });
            });
        } else {
            console.error('Cookie button not found!');
        }
        
        // Ability buttons
        const freezeBtn = document.getElementById('ability-freeze');
        if (freezeBtn) {
            freezeBtn.addEventListener('click', () => this.showFreezeTargetPicker());
        }
        
        const invisBtn = document.getElementById('ability-invisible');
        if (invisBtn) {
            invisBtn.addEventListener('click', () => this.useInvisibility());
        }
        
        // Track mouse movement for cursor sharing (throttled to ~20fps)
        // Send as percentages RELATIVE TO GAME WRAPPER for cross-resolution accuracy
        document.addEventListener('mousemove', (e) => {
            const now = Date.now();
            if (now - this.lastCursorUpdate > 50) {
                this.lastCursorUpdate = now;
                // Get game wrapper position (fixed 1600x900, but scaled via CSS zoom)
                const wrapper = document.getElementById('game-wrapper');
                if (wrapper) {
                    const rect = wrapper.getBoundingClientRect();
                    const zoom = parseFloat(wrapper.style.zoom) || 1;
                    
                    // With CSS zoom, getBoundingClientRect returns screen coordinates
                    // but the actual element is 1600x900 * zoom on screen
                    // We need to convert mouse position to percentage of the 1600x900 design
                    
                    // Get position relative to wrapper's top-left corner (in screen coords)
                    const relativeX = e.clientX - rect.left;
                    const relativeY = e.clientY - rect.top;
                    
                    // The wrapper appears as (1600*zoom) x (900*zoom) on screen
                    // So to get percentage of the 1600x900 design:
                    // percent = (relativeScreenPos / (designSize * zoom)) * 100
                    // which is the same as: (relativeScreenPos / zoom) / designSize * 100
                    const xPercent = (relativeX / zoom / 1600) * 100;
                    const yPercent = (relativeY / zoom / 900) * 100;
                    
                    // Clamp to 0-100 to avoid sending out-of-bounds cursor
                    const clampedX = Math.max(0, Math.min(100, xPercent));
                    const clampedY = Math.max(0, Math.min(100, yPercent));
                    
                    this.socket.emit('game:cursor', { x: clampedX, y: clampedY });
                }
            }
        });
        
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
        
        // Sort players ALPHABETICALLY by name - same order for ALL players
        const sortedPlayers = [...this.gameState.players].sort((a, b) => a.name.localeCompare(b.name));
        
        console.log('Creating cards for players:', sortedPlayers.map(p => p.name));
        
        sortedPlayers.forEach((player, index) => {
            const isMe = this.isMe(player);
            const chartId = isMe ? 'you' : player.name; // Use name for chart ID
            // Use green for self, player's assigned color for others
            const displayColor = isMe ? '#2ecc71' : (player.color || '#e74c3c');
            
            // Create a row container for card + positions sidebar
            const row = document.createElement('div');
            row.className = 'player-row';
            row.id = `row-${player.name}`;
            
            // Create the card
            const card = document.createElement('div');
            card.className = `player-stock-card ${isMe ? 'you' : 'tradeable'}`;
            card.id = `card-${player.name}`;
            card.dataset.playerColor = displayColor; // Store for chart rendering
            
            card.innerHTML = `
                <div class="stock-header" style="border-left: 4px solid ${displayColor};">
                    <div class="stock-header-left">
                        <div class="player-rank" id="rank-${chartId}">#${index + 1}</div>
                        <span class="player-color-dot" style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background: ${displayColor}; margin-right: 5px;"></span>
                        <span class="player-name" style="color:${displayColor}">${isMe ? 'YOU' : player.name}</span>
                        <span class="frozen-badge" id="frozen-badge-${player.name}" style="display:none; background: #00bfff; color: #fff; padding: 2px 6px; border-radius: 4px; font-size: 0.7em; margin-left: 5px; animation: frozenPulse 1s infinite;">🥶 FROZEN</span>
                        ${!isMe ? `<span class="click-indicator" id="click-ind-${player.name}" style="display:none;">🖱️</span>` : ''}
                    </div>
                    <div class="stock-stats">
                        <span class="stat-total" id="score-${chartId}">${player.cookies || 0} 🍪</span>
                        ${isMe ? `<span class="stat-locked" id="locked-margin">🔒 0</span>` : `<span class="stat-networth-small" id="networth-${chartId}" style="color: #9b59b6; font-size: 0.75em;">💎 ${player.cookies || 0}</span>`}
                        <span class="stat-velocity up" id="vel-${chartId}">+0/s</span>
                    </div>
                </div>
                
                <div class="chart-controls">
                    <button class="zoom-btn zoom-in" data-chart="${chartId}">+</button>
                    <button class="zoom-btn zoom-out" data-chart="${chartId}">−</button>
                    <button class="zoom-btn zoom-all" data-chart="${chartId}">ALL</button>
                    <button class="zoom-btn zoom-live" data-chart="${chartId}">LIVE</button>
                </div>
                <div class="chart-container" data-chart="${chartId}">
                    <canvas class="chart-canvas" id="chart-${chartId}"></canvas>
                    <div class="chart-overlay"></div>
                </div>
                
                ${!isMe ? `
                    <div class="card-actions">
                        <div class="trade-controls">
                            <div class="leverage-select">
                                ${[2,3,4,5,6,7,8,9,10].map(lev => 
                                    `<button class="lev-btn ${lev === 2 ? 'active' : ''}" data-lev="${lev}" data-target="${player.name}">${lev}x</button>`
                                ).join('')}
                            </div>
                        </div>
                        <div class="stake-slider-row">
                            <span class="stake-label">Stake:</span>
                            <input type="range" class="stake-slider" id="slider-${player.name}" min="1" max="100" value="10" data-target="${player.name}">
                            <span class="stake-value" id="stake-display-${player.name}">10🍪</span>
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
                    </div>
                ` : ''}
            `;
            
            // Create the positions sidebar for this player
            const sidebar = document.createElement('div');
            sidebar.className = 'player-positions-sidebar';
            sidebar.id = `positions-sidebar-${player.name}`;
            sidebar.innerHTML = `
                <div class="player-positions-header">
                    <span>📊 On ${isMe ? 'YOU' : player.name}</span>
                    <span class="player-positions-pnl neutral" id="pnl-sidebar-${player.name}">0🍪</span>
                </div>
                <div class="player-positions-list" id="positions-list-${player.name}">
                    <div class="no-positions-small">No positions</div>
                </div>
            `;
            
            row.appendChild(card);
            row.appendChild(sidebar);
            playersGrid.appendChild(row);
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
                
                // Update slider max when leverage changes
                this.updateSliderMax(targetId);
            });
        });
        
        // Stake sliders
        document.querySelectorAll('.stake-slider').forEach(slider => {
            slider.addEventListener('input', () => {
                const targetId = slider.dataset.target;
                const value = parseInt(slider.value);
                const display = document.getElementById(`stake-display-${targetId}`);
                if (display) {
                    display.textContent = `${value}🍪`;
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
        
        // Initial slider max update
        this.updateAllSliderMaxes();
    }
    
    updateSliderMax(targetId) {
        const leverage = this.targetLeverage[targetId] || 2;
        const maxStake = this.calculateMaxStake(targetId, leverage);
        const slider = document.getElementById(`slider-${targetId}`);
        const display = document.getElementById(`stake-display-${targetId}`);
        
        if (slider) {
            // Always update the max value
            const newMax = Math.max(1, maxStake); // Minimum 1 to keep slider functional
            slider.max = newMax;
            
            // If current value exceeds new max, adjust it down
            const currentValue = parseInt(slider.value);
            if (currentValue > newMax) {
                slider.value = newMax;
                if (display) display.textContent = `${newMax}🍪`;
            }
            
            // Disable slider if max stake is 0 or less
            if (maxStake <= 0) {
                slider.disabled = true;
                slider.value = 1;
                if (display) display.textContent = `0🍪`;
            } else {
                slider.disabled = false;
            }
        }
    }
    
    updateAllSliderMaxes() {
        // Update all sliders with current max stakes
        this.gameState.players.forEach(player => {
            if (!this.isMe(player)) {
                this.updateSliderMax(player.name);
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
        
        // In ALL mode, show everything from start to end
        if (vp.isAll) {
            return {
                data: fullData,
                isLive: true,
                startIdx: 0,
                endIdx: fullLen,
                fullLen
            };
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
    
    calculateMaxStake(targetName, leverage = 2) {
        if (!this.gameState) return 0;
        
        const me = this.getMe();
        const target = this.gameState.players.find(p => p.name === targetName);
        if (!me || !target) return 0;
        
        const MIN_ENTRY_PRICE = 500;
        if (target.cookies < MIN_ENTRY_PRICE) return 0;
        
        // Available = my cookies - locked in positions
        const lockedMargin = me.positions.reduce((sum, p) => sum + p.stake, 0);
        const available = me.cookies - lockedMargin;
        
        // Max stake = 50% of target's COOKIES (not net worth)
        const maxFromCookies = Math.floor(target.cookies * 0.5);
        
        // Subtract existing stakes on this target
        const existingStakes = me.positions
            .filter(p => p.targetName === targetName)
            .reduce((sum, p) => sum + p.stake, 0);
        const remainingAllowed = maxFromCookies - existingStakes;
        
        // Take minimum of available cookies and remaining allowed
        return Math.max(0, Math.min(available, remainingAllowed));
    }
    
    executeQuickTrade(targetName, action) {
        if (!this.gameState) return;
        
        const slider = document.getElementById(`slider-${targetName}`);
        const stake = parseInt(slider?.value) || 10;
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
        
        const MIN_ENTRY_PRICE = 500;
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
                
                // Use green for self, player's assigned color for others
                const chartColor = isMe ? '#2ecc71' : (player.color || '#e74c3c');
                this.renderSmoothChart(`chart-${chartId}`, this.chartState[chartId]?.smoothData || [], chartColor, chartId, smoothCookies, velocityData, player, viewport);
            });
        }
        
        // Update displays
        this.updateSmoothDisplays();
        this.updateScoreboard();
        
        // Throttle positions panel updates to prevent button destruction during click
        if (!this.lastPositionsUpdate || now - this.lastPositionsUpdate > 500) {
            this.lastPositionsUpdate = now;
            this.updatePositionsPanel();
        }
        
        // Update slider max values every 200ms for accuracy
        if (!this.lastSliderUpdate || now - this.lastSliderUpdate > 200) {
            this.lastSliderUpdate = now;
            this.updateAllSliderMaxes();
        }
        
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
        
        // Draw OTHER players' liquidation prices on YOUR chart
        if (player && this.isMe(player) && this.gameState) {
            // Find all positions where opponents have positions ON YOU
            const positionsOnYou = player.positionsOnMe || [];
            
            positionsOnYou.forEach((pos, idx) => {
                if (pos.liquidationPrice) {
                    const liqY = H - ((pos.liquidationPrice - min) / range) * H;
                    
                    // Draw liquidation line for this opponent
                    ctx.setLineDash([3, 3]);
                    ctx.strokeStyle = pos.type === 'long' ? '#e74c3c' : '#2ecc71';
                    ctx.lineWidth = 1.5;
                    ctx.beginPath();
                    ctx.moveTo(MARGIN_LEFT, liqY);
                    ctx.lineTo(W, liqY);
                    ctx.stroke();
                    ctx.setLineDash([]);
                    
                    // Label with opponent name
                    ctx.fillStyle = pos.type === 'long' ? '#e74c3c' : '#2ecc71';
                    ctx.font = 'bold 8px Arial';
                    ctx.textAlign = 'left';
                    const offset = idx * 12; // Stagger labels if multiple
                    ctx.fillText(`${pos.ownerName} LIQ`, MARGIN_LEFT + 5 + offset, liqY - 3);
                }
            });
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
        
        const basePrices = { grandma: 15, bakery: 100, factory: 500, mine: 2000, bank: 10000, temple: 50000, wizard: 200000, portal: 1000000, prism: 5000000, universe: 25000000 };
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
        const WIN_GOAL = 100000000;
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
        
        // Update CPS under cookie - show detailed breakdown
        const cookieCps = document.getElementById('cookie-cps');
        if (cookieCps) {
            const generatorCps = me.cps || 0;
            const buffs = me.powerBuffs || 0;
            const buffMultiplier = 1 + buffs * 0.05;
            
            // Calculate cookies per second from clicking (clicks * power * buff * multiplier)
            const clickLevel = me.clickPower || 1;
            const clickPower = Math.pow(2, clickLevel - 1);
            const clickCookiesPerSec = Math.floor(this.currentCPS * clickPower * buffMultiplier * this.clickMultiplier);
            
            // Generator CPS with buff applied
            const buffedGeneratorCps = Math.floor(generatorCps * buffMultiplier);
            
            const multiplierText = this.clickMultiplier > 1 ? ` (${this.clickMultiplier.toFixed(1)}x combo)` : '';
            const buffText = buffs > 0 ? ` <span style="color:#f1c40f;">(+${buffs * 5}% buff)</span>` : '';
            
            cookieCps.innerHTML = `
                <div style="font-size: 0.85em; color: #2ecc71;">🖱️ +${clickCookiesPerSec.toLocaleString()}/sec from clicks${multiplierText}</div>
                <div style="font-size: 0.85em; color: #f39c12; margin-top: 2px;">🏭 +${buffedGeneratorCps.toLocaleString()}/sec from generators${buffText}</div>
            `;
        }
        
        // Calculate and display Net Worth (smoothed cookies + generator value)
        // Use smoothCookies (which already includes unrealizedPnl from displayValues)
        const generatorValue = this.calculateGeneratorValue(me);
        const netWorth = smoothCookies + generatorValue;
        const networthEl = document.getElementById('networth-value');
        if (networthEl) {
            networthEl.textContent = Math.floor(netWorth).toLocaleString();
        }
        
        // Calculate Real Balance (what you'd have if all positions on you closed now)
        const positionsOnMe = me.positionsOnMe || [];
        let opponentsPotentialProfit = 0;
        for (const pos of positionsOnMe) {
            const currentPrice = me.cookies;
            const priceChange = currentPrice - pos.entryPrice;
            const pnlMultiplier = pos.type === 'long' ? 1 : -1;
            const theirPnl = Math.floor((priceChange / (pos.entryPrice || 1)) * pos.stake * pos.leverage * pnlMultiplier);
            if (theirPnl > 0) {
                opponentsPotentialProfit += theirPnl;
            }
        }
        
        const realBalance = me.cookies - opponentsPotentialProfit;
        const realNetWorth = netWorth - opponentsPotentialProfit; // Net worth if positions closed
        const realBalanceContainer = document.getElementById('real-balance-container');
        const realBalanceValue = document.getElementById('real-balance-value');
        const realNetworthValue = document.getElementById('real-networth-value');
        
        if (realBalanceContainer && realBalanceValue) {
            if (opponentsPotentialProfit > 0) {
                realBalanceContainer.style.display = 'block';
                realBalanceValue.textContent = Math.floor(realBalance).toLocaleString();
                
                // Update real net worth
                if (realNetworthValue) {
                    realNetworthValue.textContent = Math.floor(realNetWorth).toLocaleString();
                    // Color based on how low it is
                    if (realNetWorth <= 0) {
                        realNetworthValue.style.color = '#e74c3c';
                    } else if (realNetWorth < netWorth * 0.3) {
                        realNetworthValue.style.color = '#f39c12';
                    } else {
                        realNetworthValue.style.color = '#e74c3c';
                    }
                }
                
                // Color code: red if would go negative, orange if low, white if still good
                if (realBalance < 0) {
                    realBalanceValue.style.color = '#e74c3c';
                } else if (realBalance < me.cookies * 0.5) {
                    realBalanceValue.style.color = '#f39c12';
                } else {
                    realBalanceValue.style.color = '#e74c3c';
                }
            } else {
                realBalanceContainer.style.display = 'none';
            }
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
            
            // Update net worth display for other players (cookies + generator value)
            // Use floored displayValues for consistency with cookie display
            if (!this.isMe(p)) {
                const fullPlayer = this.gameState.players.find(fp => fp.name === p.name);
                const generatorValue = fullPlayer ? this.calculateGeneratorValue(fullPlayer) : 0;
                const smoothCookies = Math.floor(this.displayValues[p.name] || p.cookies);
                const netWorth = smoothCookies + generatorValue;
                const networthEl = document.getElementById(`networth-${chartId}`);
                if (networthEl) {
                    networthEl.textContent = `💎 ${netWorth.toLocaleString()}`;
                }
            }
        });
    }
    
    updatePositionsPanel() {
        if (!this.gameState) return;
        
        const me = this.getMe();
        console.log('updatePositionsPanel - me:', me?.name, 'positions count:', me?.positions?.length);
        if (!me) return;
        
        // Update per-player position sidebars
        this.updatePlayerPositionsSidebars(me);
        
        // Update Live Positions in left panel (who has position on whom)
        this.updateLivePositionsDisplay();
    }
    
    // Update sidebar for each player showing positions ON that player
    updatePlayerPositionsSidebars(me) {
        // For each player, show all positions targeting them
        this.gameState.players.forEach(targetPlayer => {
            const listEl = document.getElementById(`positions-list-${targetPlayer.name}`);
            const pnlEl = document.getElementById(`pnl-sidebar-${targetPlayer.name}`);
            if (!listEl) return;
            
            // Collect all positions targeting this player
            const positionsOnTarget = [];
            
            // Check each player's positions
            this.gameState.players.forEach(owner => {
                (owner.positions || []).forEach(pos => {
                    if (pos.targetName === targetPlayer.name) {
                        const currentPrice = targetPlayer.cookies;
                        const priceChange = currentPrice - pos.entryPrice;
                        const pnlMultiplier = pos.type === 'long' ? 1 : -1;
                        const pnl = Math.floor((priceChange / (pos.entryPrice || 1)) * pos.stake * pos.leverage * pnlMultiplier);
                        
                        positionsOnTarget.push({
                            id: pos.id,
                            ownerName: owner.name,
                            isMyPosition: this.isMe(owner),
                            type: pos.type,
                            leverage: pos.leverage,
                            stake: pos.stake,
                            entryPrice: pos.entryPrice,
                            liquidationPrice: pos.liquidationPrice,
                            currentPrice: currentPrice,
                            pnl: pnl
                        });
                    }
                });
            });
            
            if (positionsOnTarget.length === 0) {
                listEl.innerHTML = '<div class="no-positions-small">No positions</div>';
                if (pnlEl) {
                    pnlEl.textContent = '0🍪';
                    pnlEl.className = 'player-positions-pnl neutral';
                }
                return;
            }
            
            // Calculate total PNL for MY positions on this target
            let myTotalPnl = 0;
            positionsOnTarget.forEach(pos => {
                if (pos.isMyPosition) myTotalPnl += pos.pnl;
            });
            
            // Update PNL display
            if (pnlEl) {
                const pnlClass = myTotalPnl > 0 ? 'profit' : myTotalPnl < 0 ? 'loss' : 'neutral';
                const pnlText = myTotalPnl >= 0 ? `+${myTotalPnl}` : `${myTotalPnl}`;
                pnlEl.textContent = `${pnlText}🍪`;
                pnlEl.className = `player-positions-pnl ${pnlClass}`;
            }
            
            // Render positions
            listEl.innerHTML = positionsOnTarget.map(pos => {
                const pnlClass = pos.pnl >= 0 ? 'profit' : 'loss';
                const pnlText = pos.pnl >= 0 ? `+${pos.pnl}` : `${pos.pnl}`;
                const ownerDisplay = pos.isMyPosition ? 'YOU' : pos.ownerName;
                const ownerColor = pos.isMyPosition ? '#2ecc71' : '#e74c3c';
                
                // Distance to liquidation
                const distToLiq = pos.type === 'long' 
                    ? ((pos.currentPrice - pos.liquidationPrice) / pos.currentPrice * 100).toFixed(0)
                    : ((pos.liquidationPrice - pos.currentPrice) / pos.currentPrice * 100).toFixed(0);
                
                return `
                    <div class="player-pos-item ${pos.type}">
                        <div>
                            <span class="pos-trader" style="color:${ownerColor}">${ownerDisplay}</span>
                            <span class="pos-type-badge ${pos.type}">${pos.type.toUpperCase()} ${pos.leverage}x</span>
                        </div>
                        <div class="pos-details-row">
                            <span>🔒${pos.stake}</span>
                            <span class="pos-pnl-small ${pnlClass}">${pnlText}🍪</span>
                        </div>
                        <div class="pos-details-row" style="font-size:0.85em">
                            <span>💀${distToLiq}%</span>
                            <span style="color:#888">E:${Math.floor(pos.entryPrice)}</span>
                        </div>
                        ${pos.isMyPosition ? `<button class="close-btn-small" onmousedown="closePosition('${pos.id}')">CLOSE</button>` : ''}
                    </div>
                `;
            }).join('');
        });
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
            
            // Update frozen badge for all players
            this.updateFrozenBadge(player);
        });
        
        // Update stake slider max values
        this.updateAllSliderMaxes();
        
        // Update King of the Hill display
        this.updateKothDisplay();
    }
    
    updateFrozenBadge(player) {
        const badge = document.getElementById(`frozen-badge-${player.name}`);
        if (!badge) return;
        
        const frozenSecondsLeft = player.frozenSecondsLeft || 0;
        if (frozenSecondsLeft > 0) {
            badge.textContent = `🥶 FROZEN (${Math.ceil(frozenSecondsLeft)}s)`;
            badge.style.display = 'inline';
        } else {
            badge.style.display = 'none';
        }
    }
    
    updateKothDisplay() {
        if (!this.gameState) return;
        
        const me = this.getMe();
        if (!me) return;
        
        // Calculate time remaining in round using elapsed time from server
        const roundDuration = this.gameState.kothRoundDuration || 60000;
        const roundElapsed = this.gameState.kothRoundElapsed || 0;
        const remaining = Math.max(0, roundDuration - roundElapsed);
        const remainingSeconds = Math.ceil(remaining / 1000);
        const progress = (remaining / roundDuration) * 100;
        
        // Update timer
        const timeLeftEl = document.getElementById('koth-time-left');
        const timerFillEl = document.getElementById('koth-timer-fill');
        if (timeLeftEl) timeLeftEl.textContent = `${remainingSeconds}s`;
        if (timerFillEl) timerFillEl.style.width = `${progress}%`;
        
        // Update your time on cookie
        const yourTimeEl = document.getElementById('koth-your-time');
        const myTime = (me.cookieZoneTime || 0) / 1000;
        if (yourTimeEl) yourTimeEl.textContent = `${myTime.toFixed(1)}s`;
        
        // Update KotH leaderboard
        this.updateKothLeaderboard();
        
        // Update buff display
        const buffEl = document.getElementById('koth-buff-display');
        const abilitiesEl = document.getElementById('koth-abilities');
        if (buffEl) {
            const buffs = me.powerBuffs || 0;
            if (buffs > 0) {
                buffEl.textContent = `👑 ${buffs} buff${buffs > 1 ? 's' : ''} (+${buffs * 5}% to everything)`;
                buffEl.style.color = '#f1c40f';
                // Show abilities if player has buffs
                if (abilitiesEl) abilitiesEl.style.display = 'block';
            } else {
                buffEl.textContent = 'Keep cursor on cookie to win!';
                buffEl.style.color = '#888';
                // Hide abilities if no buffs
                if (abilitiesEl) abilitiesEl.style.display = 'none';
            }
        }
        
        // Update frozen state display from server's frozenSecondsLeft
        const frozenOverlay = document.getElementById('frozen-overlay');
        const frozenSecondsLeft = me.frozenSecondsLeft || 0;
        if (frozenOverlay) {
            if (frozenSecondsLeft > 0) {
                frozenOverlay.style.display = 'flex';
                const timerEl = document.getElementById('frozen-timer');
                if (timerEl) timerEl.textContent = `${Math.ceil(frozenSecondsLeft)}s`;
                
                // Also show frozen notification if not already showing
                this.showFrozenNotification(frozenSecondsLeft);
            } else {
                frozenOverlay.style.display = 'none';
                // Remove frozen notification
                const frozenNotif = document.getElementById('frozen-notification');
                if (frozenNotif) frozenNotif.remove();
            }
        }
    }
    
    showFrozenNotification(secondsLeft) {
        let frozenNotif = document.getElementById('frozen-notification');
        if (!frozenNotif) {
            frozenNotif = document.createElement('div');
            frozenNotif.id = 'frozen-notification';
            frozenNotif.style.cssText = `
                position: fixed; top: 20px; left: 50%; transform: translateX(-50%);
                background: linear-gradient(135deg, #00bfff, #0080ff); 
                padding: 15px 30px; border-radius: 15px; color: #fff; 
                font-size: 1.5em; font-weight: bold; z-index: 10001;
                box-shadow: 0 0 30px rgba(0, 191, 255, 0.8);
                animation: frozenPulse 0.5s infinite;
                text-align: center;
            `;
            document.body.appendChild(frozenNotif);
        }
        frozenNotif.innerHTML = `🥶 FROZEN! 🥶<br><span style="font-size: 0.7em;">Cannot click, trade, or earn CPS</span><br><span style="font-size: 1.2em;">${Math.ceil(secondsLeft)}s</span>`;
    }
    
    updateKothLeaderboard() {
        const listEl = document.getElementById('koth-leaderboard-list');
        if (!listEl || !this.gameState) return;
        
        // Sort players by cookie zone time (descending)
        const sorted = [...this.gameState.players].sort((a, b) => 
            (b.cookieZoneTime || 0) - (a.cookieZoneTime || 0)
        );
        
        let html = '';
        sorted.forEach((player, index) => {
            const isMe = this.isMe(player);
            const displayColor = isMe ? '#2ecc71' : (player.color || '#e74c3c');
            const time = (player.cookieZoneTime || 0) / 1000;
            
            // Check if player is invisible - hide their time from others
            const isInvisible = (player.invisibleSecondsLeft || 0) > 0;
            const showTime = isMe || !isInvisible; // Always show your own time
            
            const displayTime = showTime ? `${time.toFixed(1)}s` : '👻 ???';
            const displayName = isMe ? 'YOU' : player.name;
            
            // Show crown for leader
            const crown = index === 0 && time > 0 ? '👑 ' : '';
            
            html += `<div style="display: flex; justify-content: space-between; padding: 2px 4px; background: ${index === 0 ? 'rgba(241,196,15,0.2)' : 'rgba(0,0,0,0.2)'}; border-radius: 3px; margin-bottom: 2px;">
                <span style="color: ${displayColor};">${crown}${displayName}</span>
                <span style="color: ${showTime ? '#f1c40f' : '#9b59b6'};">${displayTime}</span>
            </div>`;
        });
        
        listEl.innerHTML = html || '<div style="color: #555; text-align: center;">No activity yet</div>';
    }
    
    startCPSTracking() {
        // CPS tracking runs on interval to keep indicator updated
        setInterval(() => {
            this.updateClickSpeed();
        }, 100);
    }
    
    updateCPSIndicator() {
        // CPS indicator is now shown under cookie, no floating indicator needed
    }
    
    handleCookieClick(e) {
        console.log('handleCookieClick called, socket connected:', this.socket.connected);
        this.clickTimes.push(Date.now());
        
        // Update click speed for multiplier
        this.updateClickSpeed();
        
        // Get click power from current player state (exponential: 2^(level-1))
        const me = this.getMe();
        const clickLevel = me?.clickPower || 1;
        const clickPower = Math.pow(2, clickLevel - 1);
        
        // Include buff in display (server applies buff too)
        const buffs = me?.powerBuffs || 0;
        const buffMultiplier = 1 + buffs * 0.05;
        
        const cookiesEarned = Math.floor(clickPower * this.clickMultiplier * buffMultiplier);
        console.log('Emitting game:click with multiplier:', this.clickMultiplier, 'clickLevel:', clickLevel, 'clickPower:', clickPower, 'buffMultiplier:', buffMultiplier);
        
        // Send to server WITH multiplier (server will also multiply by clickPower and buff)
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
            temple: { baseCost: 50000, cps: 2500 },
            wizard: { baseCost: 200000, cps: 10000 },
            portal: { baseCost: 1000000, cps: 50000 },
            prism: { baseCost: 5000000, cps: 250000 },
            universe: { baseCost: 25000000, cps: 1000000 }
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
        
        const clickLevel = me.clickPower || 1;
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
        // Stop any ongoing updates
        this.isGameActive = false;
        
        const cookieDisplay = typeof cookies === 'number' ? cookies.toLocaleString() : '100,000,000';
        const goalReached = '100 MILLION';
        
        const overlay = document.createElement('div');
        overlay.className = 'victory-overlay';
        overlay.style.cssText = 'display: flex; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.95); z-index: 9999; justify-content: center; align-items: center;';
        overlay.innerHTML = `
            <div class="victory-modal" style="background: linear-gradient(135deg, #1a1a2e, #0a0a14); padding: 40px 60px; border-radius: 20px; border: 2px solid #f39c12; text-align: center; max-width: 90vw;">
                <div class="victory-icon" style="font-size: 5rem; margin-bottom: 20px;">${isPlayer ? '🏆' : '😢'}</div>
                <h1 class="victory-title" style="font-size: 2.5rem; font-weight: 800; color: #f39c12; margin-bottom: 10px;">${isPlayer ? 'VICTORY!' : 'DEFEAT!'}</h1>
                <div class="victory-winner" style="font-size: 1.2rem; color: #888; margin-bottom: 20px;">${winnerName} reached ${goalReached} cookies!</div>
                <div class="victory-cookies" style="font-size: 2rem; color: #F6D49B; margin-bottom: 30px;">🍪 ${cookieDisplay} 🍪</div>
                <button class="victory-btn" id="play-again-btn" style="padding: 15px 40px; background: linear-gradient(135deg, #f39c12, #e67e22); border: none; border-radius: 10px; color: #000; font-size: 1.2rem; font-weight: 700; cursor: pointer;">Play Again</button>
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
            
            // Keep only last 50 notifications (no auto-remove)
            while (feed.children.length > 50) {
                feed.removeChild(feed.lastChild);
            }
        }
    }
    
    updateRemoteCursor(playerName, color, xPercent, yPercent) {
        // Don't show our own cursor
        if (playerName === this.playerName) return;
        
        // Get game wrapper for positioning - cursor will be INSIDE this element
        const wrapper = document.getElementById('game-wrapper');
        if (!wrapper) return;
        
        // Convert percentage to pixels based on FIXED design size (1600x900)
        // The wrapper is always 1600x900 internally, just scaled via CSS zoom
        const x = (xPercent / 100) * 1600;
        const y = (yPercent / 100) * 900;
        
        let cursor = this.otherCursors[playerName];
        
        if (!cursor) {
            // Create new cursor element INSIDE the wrapper
            cursor = document.createElement('div');
            cursor.className = 'remote-cursor';
            // The SVG cursor tip starts at point (4,4) in the path, so offset the container
            cursor.innerHTML = `
                <svg width="24" height="24" viewBox="0 0 24 24" style="filter: drop-shadow(0 2px 4px rgba(0,0,0,0.5));">
                    <path d="M4 4 L4 20 L9 15 L14 22 L16 21 L11 14 L18 14 Z" fill="${color}" fill-opacity="0.8" stroke="#fff" stroke-width="1.5"/>
                </svg>
                <span class="cursor-label" style="background: ${color}; opacity: 0.9;">${playerName}</span>
            `;
            cursor.style.cssText = `
                position: absolute;
                pointer-events: none;
                z-index: 99999;
                transition: left 0.05s linear, top 0.05s linear;
                opacity: 0.85;
                transform: translate(-8px, -8px);
            `;
            // Append to wrapper, not body - cursor inherits the zoom scale
            wrapper.appendChild(cursor);
            this.otherCursors[playerName] = cursor;
            console.log('Created cursor for', playerName, 'with color', color);
        }
        
        // Use pixel positioning based on fixed 1600x900 design
        cursor.style.left = x + 'px';
        cursor.style.top = y + 'px';
        
        // Remove cursor if player is inactive for 3 seconds
        if (cursor.timeout) clearTimeout(cursor.timeout);
        cursor.timeout = setTimeout(() => {
            cursor.remove();
            delete this.otherCursors[playerName];
        }, 3000);
    }
    
    // ==================== ABILITIES ====================
    
    showFreezeTargetPicker() {
        // Create a modal to pick target player
        const me = this.getMe();
        if (!me || (me.powerBuffs || 0) < 1) {
            this.showNotification('You need at least 1 buff to use Freeze!', 'error');
            return;
        }
        
        const otherPlayers = this.gameState.players.filter(p => p.name !== this.playerName);
        if (otherPlayers.length === 0) {
            this.showNotification('No other players to freeze!', 'error');
            return;
        }
        
        // Create picker modal
        let existingPicker = document.getElementById('freeze-picker');
        if (existingPicker) existingPicker.remove();
        
        const picker = document.createElement('div');
        picker.id = 'freeze-picker';
        picker.style.cssText = `
            position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
            background: rgba(20, 20, 40, 0.95); padding: 20px; border-radius: 10px;
            border: 2px solid #00bfff; z-index: 10000; min-width: 200px; text-align: center;
        `;
        picker.innerHTML = `
            <div style="color: #00bfff; font-weight: bold; margin-bottom: 15px;">🥶 Select Target to Freeze</div>
            <div id="freeze-targets" style="display: flex; flex-direction: column; gap: 8px;"></div>
            <button onclick="this.parentElement.remove()" style="margin-top: 15px; padding: 8px 16px; background: #333; border: 1px solid #555; color: #fff; border-radius: 5px; cursor: pointer;">Cancel</button>
        `;
        
        const targetsDiv = picker.querySelector('#freeze-targets');
        otherPlayers.forEach(p => {
            const btn = document.createElement('button');
            btn.style.cssText = `
                padding: 10px; background: linear-gradient(135deg, #1a3a5a, #0a2a4a);
                border: 1px solid #00bfff; border-radius: 5px; color: #fff; cursor: pointer;
                font-weight: bold;
            `;
            btn.textContent = `❄️ ${p.name}`;
            btn.onclick = () => {
                this.socket.emit('game:useFreeze', { targetName: p.name });
                picker.remove();
            };
            targetsDiv.appendChild(btn);
        });
        
        document.body.appendChild(picker);
    }
    
    useInvisibility() {
        const me = this.getMe();
        if (!me || (me.powerBuffs || 0) < 1) {
            this.showNotification('You need at least 1 buff to use Invisibility!', 'error');
            return;
        }
        
        this.socket.emit('game:useInvisible');
    }
    
    showFrozenOverlay(duration) {
        // The frozen overlay and notification are now managed by updateKothDisplay()
        // which reads frozenSecondsLeft from the server state
        // This function is just called once when first frozen to show initial feedback
        const overlay = document.getElementById('frozen-overlay');
        if (overlay) overlay.style.display = 'flex';
    }
    
    showInvisibleIndicator(duration) {
        let indicator = document.getElementById('invisible-indicator');
        if (!indicator) {
            indicator = document.createElement('div');
            indicator.id = 'invisible-indicator';
            indicator.className = 'invisible-indicator';
            document.body.appendChild(indicator);
        }
        
        // Duration is now in seconds from server
        let remaining = duration;
        const updateIndicator = () => {
            indicator.textContent = `👻 INVISIBLE (${Math.ceil(remaining)}s)`;
            remaining -= 0.1;
            if (remaining <= 0) {
                indicator.remove();
            } else {
                setTimeout(updateIndicator, 100);
            }
        };
        updateIndicator();
    }
    
    hideRemoteCursor(playerName, duration) {
        const cursor = this.otherCursors[playerName];
        if (cursor) {
            cursor.style.display = 'none';
            // Duration is now in seconds from server
            setTimeout(() => {
                if (this.otherCursors[playerName]) {
                    this.otherCursors[playerName].style.display = 'block';
                }
            }, duration * 1000);
        }
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
    window.gameClient = window.game; // Expose for onclick handlers
    
    // Global close function for onclick handlers
    window.closePosition = function(positionId) {
        console.log('window.closePosition called with:', positionId);
        if (window.game && window.game.closePosition) {
            window.game.closePosition(positionId);
        } else {
            console.error('Game not initialized!');
        }
    };
});

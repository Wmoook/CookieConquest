// UI Manager - Handles all UI updates and interactions
class UIManager {
    constructor() {
        this.screens = {
            mainMenu: document.getElementById('main-menu'),
            lobbyBrowser: document.getElementById('lobby-browser'),
            matchLobby: document.getElementById('match-lobby'),
            gameScreen: document.getElementById('game-screen'),
            resultsScreen: document.getElementById('results-screen')
        };
        
        this.modals = {
            balance: document.getElementById('balance-modal'),
            create: document.getElementById('create-modal')
        };
        
        this.elements = {};
        this.selectedBuyIn = 1;
        this.selectedMaxPlayers = 6;
        this.selectedTarget = null;
        this.lastPerfectClickTime = 0;
        
        this.cacheElements();
        this.bindEvents();
    }
    
    cacheElements() {
        // Main menu
        this.elements.playerBalance = document.getElementById('player-balance');
        this.elements.playerName = document.getElementById('player-name');
        this.elements.setNameBtn = document.getElementById('set-name-btn');
        this.elements.addBalanceBtn = document.getElementById('add-balance-btn');
        this.elements.quickPlayBtn = document.getElementById('quick-play-btn');
        this.elements.createMatchBtn = document.getElementById('create-match-btn');
        this.elements.browsLobbiesBtn = document.getElementById('browse-lobbies-btn');
        
        // Balance modal
        this.elements.customAmount = document.getElementById('custom-amount');
        this.elements.addCustomBtn = document.getElementById('add-custom-btn');
        
        // Create modal
        this.elements.matchName = document.getElementById('match-name');
        this.elements.confirmCreateBtn = document.getElementById('confirm-create-btn');
        
        // Lobby browser
        this.elements.lobbyList = document.getElementById('lobby-list');
        this.elements.refreshLobbiesBtn = document.getElementById('refresh-lobbies-btn');
        this.elements.backToMenuBtn = document.getElementById('back-to-menu-btn');
        
        // Match lobby
        this.elements.lobbyMatchName = document.getElementById('lobby-match-name');
        this.elements.lobbyPrizePool = document.getElementById('lobby-prize-pool');
        this.elements.lobbyPlayers = document.getElementById('lobby-players');
        this.elements.startMatchBtn = document.getElementById('start-match-btn');
        this.elements.leaveLobbyBtn = document.getElementById('leave-lobby-btn');
        
        // Game screen
        this.elements.phaseName = document.getElementById('phase-name');
        this.elements.gameTimer = document.getElementById('game-timer');
        this.elements.gamePrizePool = document.getElementById('game-prize-pool');
        this.elements.playerCookies = document.getElementById('player-cookies');
        this.elements.playerPublicCookies = document.getElementById('player-public-cookies');
        this.elements.generatorsList = document.getElementById('generators-list');
        this.elements.defensesList = document.getElementById('defenses-list');
        this.elements.mainCookie = document.getElementById('main-cookie');
        this.elements.perfectIndicator = document.getElementById('perfect-indicator');
        this.elements.critIndicator = document.getElementById('crit-indicator');
        this.elements.streakDisplay = document.getElementById('streak-display');
        this.elements.clickFeedback = document.getElementById('click-feedback');
        this.elements.opponentsList = document.getElementById('opponents-list');
        this.elements.bluffList = document.getElementById('bluff-list');
        this.elements.sabotageList = document.getElementById('sabotage-list');
        this.elements.sabotageTarget = document.getElementById('sabotage-target');
        this.elements.activeEffects = document.getElementById('active-effects');
        this.elements.notifications = document.getElementById('notifications');
        this.elements.goldenCookie = document.getElementById('golden-cookie');
        
        // Results screen
        this.elements.resultsTitle = document.getElementById('results-title');
        this.elements.winnerName = document.getElementById('winner-name');
        this.elements.winnerCookies = document.getElementById('winner-cookies');
        this.elements.prizeWon = document.getElementById('prize-won');
        this.elements.standingsList = document.getElementById('standings-list');
        this.elements.backToMenuResultsBtn = document.getElementById('back-to-menu-results-btn');
    }
    
    bindEvents() {
        // Main menu
        this.elements.setNameBtn.addEventListener('click', () => this.handleSetName());
        this.elements.playerName.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.handleSetName();
        });
        
        this.elements.addBalanceBtn.addEventListener('click', () => this.showModal('balance'));
        this.elements.quickPlayBtn.addEventListener('click', () => this.handleQuickPlay());
        this.elements.createMatchBtn.addEventListener('click', () => this.showModal('create'));
        this.elements.browsLobbiesBtn.addEventListener('click', () => this.showLobbyBrowser());
        
        // Balance modal
        document.querySelectorAll('.balance-option').forEach(btn => {
            btn.addEventListener('click', () => {
                const amount = parseFloat(btn.dataset.amount);
                gameClient.addBalance(amount);
                this.hideModal('balance');
            });
        });
        
        this.elements.addCustomBtn.addEventListener('click', () => {
            const amount = parseFloat(this.elements.customAmount.value);
            if (amount > 0) {
                gameClient.addBalance(amount);
                this.hideModal('balance');
            }
        });
        
        // Create modal
        document.querySelectorAll('.buyin-option').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.buyin-option').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.selectedBuyIn = parseFloat(btn.dataset.buyin);
            });
        });
        
        document.querySelectorAll('.player-option').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.player-option').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.selectedMaxPlayers = parseInt(btn.dataset.players);
            });
        });
        
        this.elements.confirmCreateBtn.addEventListener('click', () => this.handleCreateMatch());
        
        // Modal close buttons
        document.querySelectorAll('.modal-close').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.modal').forEach(m => m.classList.remove('active'));
            });
        });
        
        // Lobby browser
        this.elements.refreshLobbiesBtn.addEventListener('click', () => gameClient.getLobbies());
        this.elements.backToMenuBtn.addEventListener('click', () => this.showScreen('mainMenu'));
        
        // Match lobby
        this.elements.startMatchBtn.addEventListener('click', () => gameClient.startMatch());
        this.elements.leaveLobbyBtn.addEventListener('click', () => {
            gameClient.leaveMatch();
            this.showScreen('mainMenu');
        });
        
        // Game - Cookie clicking
        this.elements.mainCookie.addEventListener('click', (e) => this.handleCookieClick(e));
        this.elements.mainCookie.addEventListener('mousedown', () => {
            this.elements.mainCookie.classList.add('clicked');
        });
        this.elements.mainCookie.addEventListener('mouseup', () => {
            this.elements.mainCookie.classList.remove('clicked');
        });
        
        // Action tabs
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
                document.getElementById(`${btn.dataset.tab}-tab`).classList.remove('hidden');
            });
        });
        
        // Golden cookie
        this.elements.goldenCookie.addEventListener('click', () => this.handleGoldenCookieClick());
        
        // Results
        this.elements.backToMenuResultsBtn.addEventListener('click', () => {
            this.showScreen('mainMenu');
            gameClient.currentMatch = null;
        });
    }
    
    showScreen(screenName) {
        Object.values(this.screens).forEach(screen => {
            screen.classList.remove('active');
        });
        this.screens[screenName].classList.add('active');
    }
    
    showModal(modalName) {
        this.modals[modalName].classList.add('active');
    }
    
    hideModal(modalName) {
        this.modals[modalName].classList.remove('active');
    }
    
    handleSetName() {
        const name = this.elements.playerName.value.trim();
        if (name) {
            gameClient.setName(name);
        }
    }
    
    handleQuickPlay() {
        // For now, just create a match with default settings
        this.showModal('create');
    }
    
    handleCreateMatch() {
        const name = this.elements.matchName.value.trim() || `${gameClient.playerName}'s Game`;
        gameClient.createMatch({
            name,
            buyIn: this.selectedBuyIn,
            maxPlayers: this.selectedMaxPlayers
        });
        this.hideModal('create');
    }
    
    showLobbyBrowser() {
        this.showScreen('lobbyBrowser');
        gameClient.getLobbies();
    }
    
    handleCookieClick(e) {
        // Calculate timing for perfect click
        const now = Date.now();
        const timing = gameClient.gameState?.perfectClickWindow ? 
            (now - this.lastPerfectClickTime) / 1000 : null;
        
        // Get crit bar position from visual element
        const critPosition = parseFloat(this.elements.critIndicator.style.left) || 0;
        
        gameClient.click(timing, critPosition);
        
        // Visual feedback
        audioManager.playClick();
    }
    
    handleGoldenCookieClick() {
        if (gameClient.gameState?.goldenCookie) {
            // Award bonus cookies (handled server-side in full implementation)
            this.elements.goldenCookie.classList.add('hidden');
            audioManager.playGoldenCookie();
            this.showNotification('Golden Cookie! +100 cookies!', 'success');
        }
    }
    
    updateBalance(balance) {
        this.elements.playerBalance.textContent = balance.toFixed(2);
    }
    
    enableMenuButtons() {
        this.elements.quickPlayBtn.disabled = false;
        this.elements.createMatchBtn.disabled = false;
        this.elements.browsLobbiesBtn.disabled = false;
    }
    
    updateLobbies(lobbies) {
        if (lobbies.length === 0) {
            this.elements.lobbyList.innerHTML = '<div class="no-lobbies">No matches available. Create one!</div>';
            return;
        }
        
        this.elements.lobbyList.innerHTML = lobbies.map(lobby => `
            <div class="lobby-item" data-id="${lobby.id}">
                <div class="lobby-info">
                    <div class="lobby-name">${this.escapeHtml(lobby.name)}</div>
                    <div class="lobby-details">
                        <span class="lobby-detail">Host: <span>${this.escapeHtml(lobby.host)}</span></span>
                        <span class="lobby-detail">Buy-in: <span>$${lobby.buyIn}</span></span>
                        <span class="lobby-detail">Players: <span>${lobby.playerCount}/${lobby.maxPlayers}</span></span>
                    </div>
                </div>
                <button class="btn btn-primary btn-small join-lobby-btn">JOIN</button>
            </div>
        `).join('');
        
        // Bind join buttons
        document.querySelectorAll('.join-lobby-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const lobbyItem = e.target.closest('.lobby-item');
                gameClient.joinMatch(lobbyItem.dataset.id);
            });
        });
    }
    
    updateMatchLobby(data) {
        this.elements.lobbyMatchName.textContent = data.name;
        this.elements.lobbyPrizePool.textContent = data.prizePool;
        
        // Update players grid
        const playersHtml = data.players.map(player => {
            const isHost = player.id === data.hostId;
            const isYou = player.id === gameClient.playerId;
            let classes = 'player-slot filled';
            if (isHost) classes += ' host';
            if (isYou) classes += ' you';
            
            return `
                <div class="${classes}">
                    <div class="player-avatar">${player.name.charAt(0).toUpperCase()}</div>
                    <div class="player-name-lobby">${this.escapeHtml(player.name)}</div>
                    ${isHost ? '<div class="player-tag">HOST</div>' : ''}
                    ${isYou ? '<div class="player-tag" style="color: var(--primary);">YOU</div>' : ''}
                </div>
            `;
        }).join('');
        
        // Add empty slots
        const emptySlots = data.maxPlayers ? data.maxPlayers - data.players.length : 0;
        let emptySlotsHtml = '';
        for (let i = 0; i < emptySlots; i++) {
            emptySlotsHtml += `
                <div class="player-slot">
                    <div class="player-avatar">?</div>
                    <div class="player-name-lobby">Waiting...</div>
                </div>
            `;
        }
        
        this.elements.lobbyPlayers.innerHTML = playersHtml + emptySlotsHtml;
        
        // Show start button for host
        if (data.hostId === gameClient.playerId) {
            this.elements.startMatchBtn.style.display = 'block';
            this.elements.startMatchBtn.disabled = data.players.length < 2;
        } else {
            this.elements.startMatchBtn.style.display = 'none';
        }
    }
    
    updateGameState(state) {
        // Update timer
        const minutes = Math.floor(state.timeRemaining / 60);
        const seconds = Math.floor(state.timeRemaining % 60);
        this.elements.gameTimer.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        
        // Timer warning colors
        if (state.timeRemaining <= 10) {
            this.elements.gameTimer.classList.add('danger');
            this.elements.gameTimer.classList.remove('warning');
        } else if (state.timeRemaining <= 30) {
            this.elements.gameTimer.classList.add('warning');
            this.elements.gameTimer.classList.remove('danger');
        } else {
            this.elements.gameTimer.classList.remove('warning', 'danger');
        }
        
        // Update phase
        const phaseNames = {
            early: 'EARLY GAME',
            mid: 'MID GAME',
            conflict: 'CONFLICT',
            bakeoff: 'BAKE-OFF',
            ended: 'ENDED'
        };
        this.elements.phaseName.textContent = phaseNames[state.phase] || state.phase.toUpperCase();
        
        if (state.phase === 'bakeoff') {
            this.elements.phaseName.style.color = 'var(--danger)';
            document.querySelector('.game-container').classList.add('danger-zone');
        }
        
        // Update prize pool
        this.elements.gamePrizePool.textContent = state.prizePool;
        
        // Update player stats
        this.elements.playerCookies.textContent = Math.floor(state.player.cookies);
        this.elements.playerPublicCookies.textContent = state.player.publicCookies;
        
        // Update streak
        this.elements.streakDisplay.querySelector('.streak-value').textContent = state.player.perfectClickStreak;
        
        // Update perfect click indicator
        if (state.perfectClickWindow) {
            this.elements.perfectIndicator.classList.add('active');
            this.lastPerfectClickTime = Date.now();
        } else {
            this.elements.perfectIndicator.classList.remove('active');
        }
        
        // Update crit bar
        this.elements.critIndicator.style.left = `${state.critBarPosition}%`;
        
        // Update generators
        this.updateGenerators(state.player.generators, state.generatorCosts, state.player.cookies);
        
        // Update defenses
        this.updateDefenses(state.player.defenses, state.defenseCosts, state.player.cookies);
        
        // Update opponents
        this.updateOpponents(state.opponents);
        
        // Update bluffs
        this.updateBluffs(state.bluffCosts, state.player.cookies, state.player.activeBluffs);
        
        // Update sabotages
        this.updateSabotages(state.sabotageCosts, state.player.cookies);
        
        // Update active effects
        this.updateActiveEffects(state.player);
        
        // Golden cookie
        if (state.goldenCookie) {
            this.elements.goldenCookie.classList.remove('hidden');
            this.elements.goldenCookie.style.left = `${state.goldenCookie.x}%`;
            this.elements.goldenCookie.style.top = `${state.goldenCookie.y}%`;
        } else {
            this.elements.goldenCookie.classList.add('hidden');
        }
    }
    
    updateGenerators(owned, costs, cookies) {
        const generators = ['oven', 'kitchen', 'factory', 'aiBaker'];
        const names = {
            oven: 'Oven',
            kitchen: 'Kitchen',
            factory: 'Factory',
            aiBaker: 'AI Baker'
        };
        
        this.elements.generatorsList.innerHTML = generators.map(gen => {
            const info = costs[gen];
            const count = owned[gen] || 0;
            const affordable = cookies >= info.cost;
            
            return `
                <div class="generator-item ${affordable ? 'affordable' : ''}" data-type="${gen}">
                    <div class="item-info">
                        <div class="item-name">${names[gen]}</div>
                        <div class="item-output">+${info.output}/sec</div>
                    </div>
                    <span class="item-count">${count}</span>
                    <span class="item-cost ${affordable ? 'affordable' : ''}">${info.cost}</span>
                </div>
            `;
        }).join('');
        
        // Bind click events
        document.querySelectorAll('.generator-item').forEach(item => {
            item.addEventListener('click', () => {
                gameClient.buyGenerator(item.dataset.type);
            });
        });
    }
    
    updateDefenses(owned, costs, cookies) {
        const defenses = ['antivirus', 'coolingSystem', 'firewall', 'reinforcedDisplay', 'precisionGloves', 'shield', 'sabotageTrap'];
        
        this.elements.defensesList.innerHTML = defenses.map(def => {
            const info = costs[def];
            if (!info) return '';
            const count = owned[def] || 0;
            const affordable = cookies >= info.cost;
            
            return `
                <div class="defense-item ${affordable ? 'affordable' : ''}" data-type="${def}">
                    <div class="item-info">
                        <div class="item-name">${info.name}</div>
                    </div>
                    <span class="item-count">${count}</span>
                    <span class="item-cost ${affordable ? 'affordable' : ''}">${info.cost}</span>
                </div>
            `;
        }).join('');
        
        // Bind click events
        document.querySelectorAll('.defense-item').forEach(item => {
            item.addEventListener('click', () => {
                gameClient.buyDefense(item.dataset.type);
            });
        });
    }
    
    updateOpponents(opponents) {
        this.elements.opponentsList.innerHTML = opponents.map(opp => `
            <div class="opponent-item ${opp.beingSabotaged ? 'sabotaged' : ''}" data-id="${opp.id}">
                <div class="opponent-avatar">${opp.name.charAt(0).toUpperCase()}</div>
                <div class="opponent-info">
                    <div class="opponent-name">${this.escapeHtml(opp.name)}</div>
                    <div class="opponent-cookies">${opp.cookies}</div>
                    ${opp.beingSabotaged ? '<div class="opponent-status">Under Attack!</div>' : ''}
                </div>
                <button class="call-btn">CALL</button>
            </div>
        `).join('');
        
        // Update sabotage target dropdown
        this.elements.sabotageTarget.innerHTML = opponents.map(opp => 
            `<option value="${opp.id}">${this.escapeHtml(opp.name)}</option>`
        ).join('');
        
        // Bind call buttons
        document.querySelectorAll('.call-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const oppItem = e.target.closest('.opponent-item');
                gameClient.cookieCall(oppItem.dataset.id);
            });
        });
    }
    
    updateBluffs(bluffs, cookies, activeBluffs) {
        const bluffTypes = ['inflate10', 'inflate20', 'inflate50', 'deflate10', 'deflate20', 'deflate50', 'statMask', 'falseCrisis'];
        
        this.elements.bluffList.innerHTML = bluffTypes.map(type => {
            const info = bluffs[type];
            if (!info) return '';
            const affordable = cookies >= info.cost;
            const active = activeBluffs.includes(type);
            
            return `
                <div class="bluff-item ${affordable ? 'affordable' : ''} ${active ? 'active-pulse' : ''}" data-type="${type}">
                    <span class="action-name">${info.name}</span>
                    <span class="action-cost ${affordable ? 'affordable' : ''}">${info.cost}</span>
                </div>
            `;
        }).join('');
        
        // Bind click events
        document.querySelectorAll('.bluff-item').forEach(item => {
            item.addEventListener('click', () => {
                gameClient.activateBluff(item.dataset.type);
            });
        });
    }
    
    updateSabotages(sabotages, cookies) {
        const sabotageTypes = ['cookieWorm', 'ovenOverload', 'fogOfWar', 'sugarBomb', 'staleBatch'];
        
        this.elements.sabotageList.innerHTML = sabotageTypes.map(type => {
            const info = sabotages[type];
            if (!info) return '';
            const affordable = cookies >= info.cost;
            
            return `
                <div class="sabotage-item ${affordable ? 'affordable' : ''}" data-type="${type}">
                    <span class="action-name">${info.name}</span>
                    <span class="action-cost ${affordable ? 'affordable' : ''}">${info.cost}</span>
                </div>
            `;
        }).join('');
        
        // Bind click events
        document.querySelectorAll('.sabotage-item').forEach(item => {
            item.addEventListener('click', () => {
                const targetId = this.elements.sabotageTarget.value;
                if (targetId) {
                    gameClient.useSabotage(targetId, item.dataset.type);
                }
            });
        });
    }
    
    updateActiveEffects(player) {
        let html = '';
        
        player.activeBluffs.forEach(bluff => {
            html += `<div class="effect-badge bluff">${bluff}</div>`;
        });
        
        player.activeDebuffs.forEach(debuff => {
            html += `<div class="effect-badge debuff">${debuff}</div>`;
        });
        
        player.activeSabotages.forEach(sab => {
            html += `<div class="effect-badge debuff">${sab}</div>`;
        });
        
        this.elements.activeEffects.innerHTML = html;
    }
    
    showClickFeedback(result) {
        const popup = document.createElement('div');
        popup.className = 'click-popup';
        
        if (result.isPerfect) {
            popup.classList.add('perfect');
            popup.textContent = `PERFECT! +${result.cookies}`;
            audioManager.playPerfectClick();
        } else if (result.isCrit) {
            popup.classList.add('crit');
            popup.textContent = `CRIT! +${result.cookies}`;
            audioManager.playCritClick();
        } else {
            popup.textContent = `+${result.cookies}`;
        }
        
        // Random position around cookie
        const angle = Math.random() * Math.PI * 2;
        const distance = 100 + Math.random() * 50;
        popup.style.left = `calc(50% + ${Math.cos(angle) * distance}px)`;
        popup.style.top = `calc(50% + ${Math.sin(angle) * distance}px)`;
        
        this.elements.clickFeedback.appendChild(popup);
        
        // Remove after animation
        setTimeout(() => popup.remove(), 800);
        
        // Update streak display with animation
        if (result.isPerfect) {
            this.elements.streakDisplay.classList.add('streak-pop');
            setTimeout(() => this.elements.streakDisplay.classList.remove('streak-pop'), 200);
        }
    }
    
    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        
        this.elements.notifications.appendChild(notification);
        audioManager.playNotification();
        
        // Remove after 3 seconds
        setTimeout(() => {
            notification.style.animation = 'slideOutRight 0.3s ease forwards';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }
    
    showResults(data) {
        this.showScreen('resultsScreen');
        
        const isWinner = data.results.winner.id === gameClient.playerId;
        
        if (isWinner) {
            this.elements.resultsTitle.textContent = 'VICTORY!';
            this.elements.resultsTitle.style.color = 'var(--gold)';
            audioManager.playVictory();
        } else {
            this.elements.resultsTitle.textContent = 'MATCH COMPLETE';
            this.elements.resultsTitle.style.color = 'var(--primary)';
        }
        
        this.elements.winnerName.textContent = data.results.winner.name;
        this.elements.winnerCookies.textContent = `${data.results.winner.cookies} cookies`;
        this.elements.prizeWon.textContent = data.prizePool;
        
        // Show standings
        this.elements.standingsList.innerHTML = data.results.standings.map((player, i) => {
            let rankClass = '';
            if (i === 0) rankClass = 'first';
            else if (i === 1) rankClass = 'second';
            else if (i === 2) rankClass = 'third';
            
            return `
                <div class="standing-item">
                    <span class="standing-rank ${rankClass}">#${player.rank}</span>
                    <span class="standing-name">${this.escapeHtml(player.name)}${player.id === gameClient.playerId ? ' (You)' : ''}</span>
                    <span class="standing-cookies">${player.cookies}</span>
                </div>
            `;
        }).join('');
        
        // Create confetti for winner
        if (isWinner) {
            this.createConfetti();
        }
    }
    
    createConfetti() {
        const colors = ['#ff6b35', '#4ecdc4', '#ffe66d', '#ffd700', '#ff4757'];
        
        for (let i = 0; i < 50; i++) {
            const confetti = document.createElement('div');
            confetti.className = 'confetti-piece';
            confetti.style.left = `${Math.random() * 100}%`;
            confetti.style.top = '-10px';
            confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
            confetti.style.animationDelay = `${Math.random() * 2}s`;
            confetti.style.animationDuration = `${2 + Math.random() * 2}s`;
            
            document.body.appendChild(confetti);
            
            setTimeout(() => confetti.remove(), 5000);
        }
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Global UI manager instance
window.uiManager = new UIManager();

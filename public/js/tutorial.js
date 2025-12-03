// Cookie Conquest - Tutorial Mode
// Simulates a game with bots to teach the player

class TutorialGame {
    constructor() {
        // Player state - start with 0 cookies, will receive starting bonus later
        this.cookies = 0;
        this.cps = 0; // cookies per second from generators
        this.clickPower = 1;
        this.clickPowerLevel = 1;
        this.clickMultiplier = 1; // Multiplier based on click speed
        this.generators = { grandma: 0, bakery: 0, factory: 0, mine: 0 };
        this.positions = []; // Player's open positions
        this.playerBuffs = 0; // KotH ability points for abilities
        
        // Bot positions on the player (for liquidation tutorial)
        this.botPositions = []; // Positions bots have opened on the player
        
        // Bots - start at 0, will get bonus later along with player
        this.bots = [
            { name: 'CookieBot', cookies: 0, cps: 2, color: '#e74c3c', history: [0] },
            { name: 'ChipMaster', cookies: 0, cps: 1, color: '#9b59b6', history: [0] }
        ];
        
        // Tutorial state
        this.tutorialStep = 0;
        this.tutorialComplete = false;
        this.tutorialSteps = [
            // INTRO
            {
                title: "Welcome to Cookie Conquest! 🍪",
                text: "This is a <span class='highlight'>competitive multiplayer game</span> where you race to reach <span class='highlight'>100 million cookies</span> first!<br><br>But there's a twist: you can <span class='warning'>trade on other players</span> to steal their cookies!",
                action: null,
                highlight: null
            },
            // CLICKING
            {
                title: "Click the Cookie! 🖱️",
                text: "Click the big cookie on the left to earn cookies manually.<br><br>Try clicking to get <span class='highlight'>10 cookies</span>.",
                action: 'click',
                target: 10,
                highlight: '#big-cookie'
            },
            // GENERATORS
            {
                title: "Buy Generators 🏭",
                text: "Clicking is slow! <span class='highlight'>Generators</span> automatically produce cookies for you.<br><br>Buy a <span class='highlight'>Grandma</span> (costs 15🍪) to earn +1 cookie/sec!",
                action: 'buy-generator',
                target: 'grandma',
                highlight: '#generator-grandma'
            },
            {
                title: "Generators Scale Up! 📈",
                text: "Each generator you buy costs more, but gives the same boost.<br><br>Better generators (Bakery, Factory, Mine) cost more but produce faster!<br><br>Click <span class='highlight'>Got it!</span> to continue.",
                action: null,
                highlight: null
            },
            // CLICK POWER
            {
                title: "Click Power! 💪",
                text: "You can also upgrade your <span class='highlight'>Click Power</span> to earn more per click!<br><br>Each upgrade doubles your click power but cost quadruples (50, 200, 800...).<br><br>⚠️ <span class='warning'>WARNING:</span> These cookies are SPENT - they don't add to net worth like generators!<br><br>Buy the <span class='highlight'>Click Power</span> upgrade!",
                action: 'buy-click-power',
                highlight: '#upgrade-click'
            },
            // STARTING BONUS
            {
                title: "Starting Bonus! 💰",
                text: "Nice work! Now let's learn about <span class='highlight'>trading</span>.<br><br>Here's <span class='highlight'>500 cookies</span> to get you started - everyone in the game gets this!<br><br>The bots also received 500🍪 each.",
                action: 'give-starting-bonus',
                highlight: null
            },
            // LOOKING AT CHARTS
            {
                title: "The Stock Market 📊",
                text: "Look at the center panel - you can see <span class='highlight'>everyone's cookie count as a chart</span>!<br><br>• <span style='color:#2ecc71'>Green chart</span> = YOU<br>• <span style='color:#e74c3c'>Red/Purple charts</span> = Other players (bots in tutorial)<br><br>Watch how the charts move as cookies are earned!",
                action: null,
                highlight: null
            },
            // TRADING INTRO
            {
                title: "Trading Basics 💰",
                text: "Here's where it gets interesting! You can <span class='highlight'>bet on other players' charts</span>:<br><br>• <span class='highlight'>LONG 📈</span> = Bet their cookies go UP (you profit when they rise)<br>• <span class='warning'>SHORT 📉</span> = Bet their cookies go DOWN (you profit when they fall)<br><br>Your bet is called your <span class='highlight'>STAKE</span> - it gets locked while the position is open.",
                action: null,
                highlight: null
            },
            // LEVERAGE
            {
                title: "Leverage ⚡",
                text: "See the buttons like <span class='highlight'>2x, 3x, 5x, 10x</span>? That's <span class='highlight'>LEVERAGE</span>!<br><br>• Higher leverage = <span class='highlight'>bigger profits</span> but also <span class='warning'>bigger losses</span><br>• At 10x leverage, a 10% price move = 100% profit OR loss!<br><br>⚠️ High leverage is risky but can lead to huge gains!",
                action: null,
                highlight: null
            },
            // STAKE SLIDER
            {
                title: "Setting Your Stake 🎚️",
                text: "Use the <span class='highlight'>stake slider</span> to choose how many cookies to bet.<br><br>• More stake = more potential profit (and loss)<br>• Your stake gets <span class='warning'>locked</span> until you close the position<br>• <span class='warning'>Max stake = 50%</span> of target's current 🍪 (not net worth!)<br><br>This limit applies at ANY leverage level!",
                action: null,
                highlight: null
            },
            // OPEN A LONG - STEP 1: SET STAKE
            {
                title: "Set Your Stake! 🎚️",
                text: "Before opening a position, set how much you want to bet!<br><br>Move the <span class='highlight'>stake slider</span> on CookieBot's card.<br><br><span class='warning'>Bet at least 50 cookies!</span>",
                action: 'set-stake',
                target: 'CookieBot',
                minStake: 50,  // Require at least 50 cookies
                highlight: null
            },
            // OPEN A LONG - STEP 2: CLICK LONG
            {
                title: "Open Your First Position! 📈",
                text: "Great! Now open a <span class='highlight'>LONG position</span> on CookieBot.<br><br>Click the <span class='highlight'>📈 LONG</span> button!<br><br>With a LONG, you profit when CookieBot's cookies go UP!<br><br><span class='warning'>Bet at least 50 cookies!</span>",
                action: 'open-position',
                target: 'CookieBot',
                positionType: 'long',
                minStake: 50,  // Require at least 50 cookies
                highlight: null
            },
            // LIQUIDATION PRICE
            {
                title: "Liquidation Price! 💀",
                text: "Look at CookieBot's chart - see the <span class='warning'>red dashed line</span> labeled <span class='warning'>💀 LIQ</span>?<br><br>That's your <span class='warning'>LIQUIDATION PRICE</span>!<br><br>• If the price drops to that line, you <span class='warning'>LOSE YOUR ENTIRE STAKE</span><br>• Higher leverage = liquidation price is closer = more dangerous!<br><br>The <span class='highlight'>yellow ENTRY line</span> shows where you opened the position.",
                action: null,
                highlight: null
            },
            // WATCHING PNL
            {
                title: "Watching Your Profit/Loss 💵",
                text: "Look at the <span class='highlight'>positions sidebar</span> next to CookieBot's chart.<br><br>• You can see your position with <span class='highlight'>real-time P&L</span> (profit/loss)<br>• <span style='color:#2ecc71'>Green = profit</span>, <span style='color:#e74c3c'>Red = loss</span><br><br>The total P&L for all positions on that player shows at the top!",
                action: null,
                highlight: null
            },
            // CLOSE POSITION
            {
                title: "Closing a Position ✅",
                text: "To take your profit (or cut your losses), you need to <span class='highlight'>CLOSE</span> the position.<br><br>Click the <span class='highlight'>CLOSE</span> button on your position to close it now!<br><br>You'll get back: <span class='highlight'>Stake + Profit</span> (or Stake - Loss)",
                action: 'close-position',
                highlight: null
            },
            // BEING TARGETED
            {
                title: "When Others Trade on YOU! ⚔️",
                text: "Other players can open positions on <span class='highlight'>YOUR</span> chart too!<br><br>• If someone <span class='warning'>SHORTs you</span>, they profit when your cookies DROP<br>• If you get <span class='warning'>liquidated</span>, THEY WIN YOUR STAKE!<br><br>Watch your own chart (green) for liquidation lines from opponents!",
                action: null,
                highlight: null
            },
            // BOT SHORTS YOU
            {
                title: "You've Been Shorted! 😱",
                text: "CookieBot just opened a <span class='warning'>SHORT position</span> on YOU!<br><br>Look at YOUR chart (green) - see the <span class='warning'>red liquidation line</span> labeled 💀?<br><br>That's THEIR liquidation! If your cookies <span class='highlight'>GO UP</span> past that line, CookieBot gets liquidated and YOU win their stake!",
                action: 'bot-shorts-you',
                highlight: null
            },
            // LIQUIDATE THE BOT
            {
                title: "Liquidate Them! 💀",
                text: "Time for revenge! <span class='highlight'>Click the cookie and grow your cookies</span> to push CookieBot's position past THEIR liquidation price!<br><br>When their position gets liquidated, <span class='highlight'>you WIN their stake!</span><br><br>Keep clicking until CookieBot gets liquidated!",
                action: 'liquidate-bot',
                highlight: '#big-cookie'
            },
            // STRATEGY - SHORTING - STEP 1: SET STAKE
            {
                title: "Now Try Shorting! 📉",
                text: "Great job liquidating CookieBot! Now let's try opening a <span class='warning'>SHORT position</span>.<br><br>First, set your stake on ChipMaster's card.<br><br><span class='warning'>Bet at least 50 cookies!</span>",
                action: 'set-stake-short',
                target: 'ChipMaster',
                minStake: 50,
                highlight: null
            },
            // STRATEGY - SHORTING - STEP 2: CLICK SHORT
            {
                title: "Open the Short! 📉",
                text: "Now click the <span class='warning'>📉 SHORT</span> button on ChipMaster!<br><br>With a SHORT, you profit when ChipMaster's cookies go <span class='warning'>DOWN</span>!<br><br><span class='warning'>Bet at least 50 cookies!</span>",
                action: 'open-short',
                target: 'ChipMaster',
                minStake: 50,
                highlight: null
            },
            // PLAYER GETS LIQUIDATED
            {
                title: "Uh Oh... 😰",
                text: "ChipMaster is growing fast! Your SHORT position is in trouble...<br><br>Watch your position - if ChipMaster's cookies rise past your <span class='warning'>liquidation price</span>, you'll lose your stake!",
                action: 'player-gets-liquidated',
                target: 'ChipMaster',
                highlight: null
            },
            // YOU GOT LIQUIDATED
            {
                title: "You Got Liquidated! 💀",
                text: "Ouch! Your SHORT position got <span class='warning'>LIQUIDATED</span>!<br><br>ChipMaster's cookies went UP past your liquidation price, so you <span class='warning'>lost your entire stake</span>!<br><br>This is the risk of trading - especially with high leverage!",
                action: null,
                highlight: null
            },
            // BOT LONGS YOU
            {
                title: "You've Been Longed! 📈",
                text: "ChipMaster just opened a <span class='highlight'>LONG position</span> on YOU!<br><br>They're betting your cookies will <span class='highlight'>GO UP</span>! If they do, ChipMaster profits from YOUR growth!<br><br>Look at YOUR chart - the <span class='warning'>red liquidation line</span> is THEIR liquidation. If your cookies <span class='warning'>DROP</span> to that line, they lose!",
                action: 'bot-longs-you',
                highlight: null
            },
            // DEFEND AGAINST LONG
            {
                title: "Defend by Spending! 💸",
                text: "To liquidate their LONG, you need to <span class='warning'>LOWER your cookie count</span>!<br><br>How? <span class='highlight'>Buy a generator!</span> Spending cookies lowers your count instantly!<br><br>⚠️ Act fast! If you don't, they'll <span class='warning'>close the position</span> and take profit from you!<br><br>Buy any generator NOW to drop your cookies!",
                action: 'defend-against-long',
                highlight: '#generator-grandma'
            },
            // STRATEGY - DEFENSE
            {
                title: "Defensive Strategy 🛡️",
                text: "When someone <span class='warning'>trades on YOU</span>, you can fight back!<br><br><span class='highlight'>Against SHORTS</span> (they bet you'll shrink):<br>• <span class='highlight'>Click faster</span> + <span class='highlight'>buy generators</span> to grow!<br><br><span class='highlight'>Against LONGS</span> (they bet you'll grow):<br>• <span class='warning'>Spend cookies</span> on generators to shrink your count!<br>• This can push THEIR position to liquidation!<br><br>⚠️ Note: You can go into <span class='warning'>debt</span> if someone closes a profitable position on you and it eats into your cookies!",
                action: null,
                highlight: null
            },
            // COOKIES GOAL
            {
                title: "The 100 Million Goal! 🎯",
                text: "The goal is <span class='highlight'>100 MILLION COOKIES</span>!<br><br>• Your 🍪 count is what matters for victory<br>• Generators help you get there faster<br>• Trading profits add to your cookies<br>• Trading losses subtract from your cookies<br><br>First to 100M cookies wins the game!",
                action: null,
                highlight: '#cookie-display'
            },
            // KING OF THE HILL
            {
                title: "King of the Hill! 👑",
                text: "In multiplayer, there's a <span class='highlight'>King of the Hill</span> mini-game!<br><br>• Keep your cursor on the big cookie to earn time<br>• Every 60 seconds, whoever has the most time wins a <span class='highlight'>+5% buff</span>!<br>• Buffs boost EVERYTHING: clicks, CPS, and trading profits!<br><br>Stack buffs to dominate the game!",
                action: null,
                highlight: '#koth-display'
            },
            // ABILITIES
            {
                title: "Abilities! ⚡",
                text: "Spend your <span class='highlight'>ability points</span> on powerful abilities:<br><br>🥶 <span style='color:#00bfff'>Freeze</span> (1 pt) - Stop a player for 15 seconds!<br>👻 <span style='color:#9b59b6'>Invisible</span> (1 pt) - Hide your standings for 15 seconds<br>📉 <span style='color:#e74c3c'>Market Crash</span> (2 pts) - Target loses 20% cookies!<br><br>Use abilities strategically to sabotage opponents!",
                action: null,
                highlight: null
            },
            // BUFF STRATEGY DEMO - STEP 1: Setup
            {
                title: "Pro Combo Strategy! 💪",
                text: "Let's practice a <span class='warning'>devastating combo</span>!<br><br>Here are <span class='highlight'>2 ability points</span> to use. The strategy:<br>1️⃣ Short a player with <span class='highlight'>5x leverage</span><br>2️⃣ Hit them with <span class='warning'>Market Crash</span><br>3️⃣ Close for massive profit!<br><br>⚡ <span class='warning'>BE FAST</span> in multiplayer - others can see your cursor hovering over their card!<br><br>First, click <span class='highlight'>5x</span> on " + this.bots[0].name + "'s card!",
                action: 'buff-strategy-setup',
                highlight: null,
                waitForLeverage: 5
            },
            // BUFF STRATEGY DEMO - STEP 2: Set Stake
            {
                title: "Set a BIG Stake! 💰",
                text: "Now click <span class='highlight'>MAX</span> to bet ALL your cookies!<br><br>Higher stake = bigger profits from this combo!<br><br>Don't worry, the Market Crash will make this a safe bet!",
                action: 'buff-strategy-stake',
                highlight: null
            },
            // BUFF STRATEGY DEMO - STEP 3: Short
            {
                title: "Open the Short! 📉",
                text: "Great! Now <span class='warning'>SHORT</span> " + this.bots[0].name + "!<br><br>With 5x leverage, when they lose 20% from Market Crash, your position will profit 100%!<br><br>Click the <span class='warning'>SHORT</span> button!",
                action: 'buff-strategy-short',
                highlight: null,
                waitForShort: true
            },
            // BUFF STRATEGY DEMO - STEP 4: Market Crash
            {
                title: "Market Crash! 📉💥",
                text: "Perfect! Now use <span class='warning'>Market Crash</span> on " + this.bots[0].name + "!<br><br>Click their <span class='warning'>📉 Crash (2)</span> button to make them lose 20% of their cookies!<br><br>Your short position will profit instantly!",
                action: 'buff-strategy-crash',
                highlight: null,
                waitForCrash: true
            },
            // BUFF STRATEGY DEMO - STEP 5: Close
            {
                title: "Take Profits! 💰",
                text: "BOOM! 💥 Look at that profit!<br><br>Now click <span class='highlight'>CLOSE</span> on your position to lock in the gains!<br><br>This combo is a great way to use your ability points aggressively!",
                action: 'buff-strategy-close',
                highlight: '#positions-list',
                waitForClose: true
            },
            // ZOOM CONTROLS
            {
                title: "Chart Controls 🔍",
                text: "Each chart has zoom controls:<br><br>• <span class='highlight'>+/-</span> = Zoom in/out on recent data<br>• <span class='highlight'>ALL</span> = See entire game history<br>• <span class='highlight'>LIVE</span> = Follow the latest data<br><br>Use these to analyze trends and time your trades!",
                action: null,
                highlight: null
            },
            // WINNING
            {
                title: "Winning the Game! 🏆",
                text: "First player to <span class='highlight'>100 MILLION cookies</span> wins!<br><br>Winning strategies:<br>• Build a strong generator economy<br>• <span class='highlight'>Long</span> players who are growing fast<br>• <span class='warning'>Short</span> players who are struggling<br>• Win KotH rounds for ability points<br>• Don't get liquidated!",
                action: null,
                highlight: null
            },
            // FINAL - FREE PLAY
            {
                title: "Free Play! 🎮",
                text: "Tutorial complete! Now it's time to practice!<br><br><span class='highlight'>Race to 10,000 cookies first to win!</span><br><br>Use everything you learned:<br>• 🍪 Click and buy generators<br>• 📈📉 Trade on the bots<br>• 💀 Don't get liquidated!<br><br><span class='warning'>Good luck!</span>",
                action: null,
                highlight: null,
                final: true
            }
        ];
        
        // Chart state
        this.playerHistory = [this.cookies];
        this.chartState = {};
        this.chartViewport = {};
        this.lastChartTime = performance.now();
        
        // Generator costs and CPS
        this.generatorData = {
            grandma: { baseCost: 15, cps: 1 },
            bakery: { baseCost: 100, cps: 5 },
            factory: { baseCost: 500, cps: 20 },
            mine: { baseCost: 2000, cps: 100 }
        };
        
        // Click tracking
        this.clickTimes = [];
        this.currentCPS = 0;
        
        // Leverage selection per target
        this.targetLeverage = {};
        
        // MAX stake mode per target (tracks which players have MAX locked)
        this.maxStakeMode = {};
        
        this.init();
    }
    
    init() {
        this.createPlayerCards();
        this.bindUIEvents();
        this.bindZoomControls();
        this.startGameLoop();
        this.showTutorialStep(0);
    }
    
    // Create player cards (you + bots)
    createPlayerCards() {
        const grid = document.getElementById('players-grid');
        if (!grid) return;
        
        grid.innerHTML = '';
        
        // Create player's card (YOU)
        const youRow = this.createPlayerRow('YOU', true, '#2ecc71');
        grid.appendChild(youRow);
        
        // Create bot cards
        this.bots.forEach(bot => {
            const row = this.createPlayerRow(bot.name, false, bot.color);
            grid.appendChild(row);
        });
    }
    
    createPlayerRow(name, isMe, color) {
        const row = document.createElement('div');
        row.className = 'player-row';
        row.id = `row-${name}`;
        
        const chartId = isMe ? 'you' : name;
        
        // Create the card
        const card = document.createElement('div');
        card.className = `player-stock-card ${isMe ? 'you' : 'tradeable'}`;
        card.id = `card-${name}`;
        
        card.innerHTML = `
            <div class="stock-header">
                <div class="stock-header-left">
                    <div class="player-rank" id="rank-${chartId}">#${isMe ? '1' : '2'}</div>
                    <span class="player-name" style="color:${color}">${isMe ? 'YOU' : name}</span>
                </div>
                <div class="stock-stats">
                    ${!isMe ? `
                        <button class="header-ability-btn header-freeze-btn locked" id="freeze-btn-${name}" data-target="${name}" title="Freeze: 15s (1 buff)">🥶 Freeze <span class="ability-cost">(1)</span></button>
                        <button class="header-ability-btn header-crash-btn locked" id="crash-btn-${name}" data-target="${name}" title="Crash: -20% cookies (2 pts)">📉 Crash <span class="ability-cost">(2)</span></button>
                    ` : ''}
                    <span class="stat-total" id="score-${chartId}">0 🍪</span>
                    ${isMe ? `<span class="stat-locked" id="locked-margin">🔒 0</span>` : `<span class="stat-networth-small" id="networth-${chartId}" style="color: #9b59b6; font-size: 0.75em;">💎 0</span>`}
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
                                `<button class="lev-btn ${lev === 2 ? 'active' : ''}" data-lev="${lev}" data-target="${name}">${lev}x</button>`
                            ).join('')}
                        </div>
                    </div>
                    <div class="stake-slider-row">
                        <span class="stake-label">Stake:</span>
                        <input type="range" class="stake-slider" id="slider-${name}" min="1" max="100" value="10" data-target="${name}">
                        <span class="stake-value" id="stake-display-${name}">10🍪</span>
                        <button class="max-stake-btn" id="max-btn-${name}" data-target="${name}" title="Set to maximum stake">MAX</button>
                    </div>
                    <div class="quick-trade-btns">
                        <button class="quick-trade-btn long" data-target="${name}" data-action="long">
                            <span class="btn-label">📈 LONG</span>
                            <span class="btn-leverage" id="lev-display-${name}">2x</span>
                        </button>
                        <button class="quick-trade-btn short" data-target="${name}" data-action="short">
                            <span class="btn-label">📉 SHORT</span>
                            <span class="btn-leverage" id="lev-display-short-${name}">2x</span>
                        </button>
                    </div>
                </div>
            ` : ''}
        `;
        
        // Create positions sidebar
        const sidebar = document.createElement('div');
        sidebar.className = 'player-positions-sidebar';
        sidebar.id = `positions-sidebar-${name}`;
        sidebar.innerHTML = `
            <div class="player-positions-header">
                <span>📊 On ${name}</span>
                <span class="player-positions-pnl neutral" id="pnl-sidebar-${name}">0🍪</span>
            </div>
            <div class="player-positions-list" id="positions-list-${name}">
                <div class="no-positions-small">No positions</div>
            </div>
        `;
        
        row.appendChild(card);
        row.appendChild(sidebar);
        
        // Initialize chart viewport - start in ALL mode to show full chart
        this.chartViewport[chartId] = { zoom: 1, offset: 0, isDragging: false, isAll: true };
        
        return row;
    }
    
    bindUIEvents() {
        // Cookie click
        const cookie = document.getElementById('big-cookie');
        if (cookie) {
            cookie.addEventListener('click', (e) => this.handleCookieClick(e));
        }
        
        // Generator buttons
        document.querySelectorAll('.generator-btn[data-generator]').forEach(btn => {
            btn.addEventListener('click', () => {
                const gen = btn.dataset.generator;
                this.buyGenerator(gen);
            });
        });
        
        // Click upgrade
        const upgradeClick = document.getElementById('upgrade-click');
        if (upgradeClick) {
            upgradeClick.addEventListener('click', () => this.upgradeClickPower());
        }
        
        // Tab system
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
                btn.classList.add('active');
                const tabId = btn.dataset.tab + '-panel';
                document.getElementById(tabId)?.classList.add('active');
            });
        });
        
        // Leverage buttons
        document.querySelectorAll('.lev-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const target = btn.dataset.target;
                const lev = parseInt(btn.dataset.lev);
                
                // Update active state
                document.querySelectorAll(`.lev-btn[data-target="${target}"]`).forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                // Store leverage
                this.targetLeverage[target] = lev;
                
                // Update display on both LONG and SHORT buttons
                const levDisplayLong = document.getElementById(`lev-display-${target}`);
                const levDisplayShort = document.getElementById(`lev-display-short-${target}`);
                if (levDisplayLong) levDisplayLong.textContent = `${lev}x`;
                if (levDisplayShort) levDisplayShort.textContent = `${lev}x`;
                
                // Check tutorial progress (for buff strategy steps)
                this.checkTutorialProgress();
            });
        });
        
        // Stake sliders
        document.querySelectorAll('.stake-slider').forEach(slider => {
            slider.addEventListener('input', () => {
                const target = slider.dataset.target;
                const display = document.getElementById(`stake-display-${target}`);
                const maxBtn = document.getElementById(`max-btn-${target}`);
                if (display) display.textContent = `${slider.value}🍪`;
                // Remove MAX mode if manually changed
                if (maxBtn) maxBtn.classList.remove('active');
                this.maxStakeMode[target] = false;
                // Check tutorial progress for set-stake step
                this.checkTutorialProgress();
            });
        });
        
        // MAX stake buttons - toggle mode that continuously updates stake
        document.querySelectorAll('.max-stake-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const target = btn.dataset.target;
                const slider = document.getElementById(`slider-${target}`);
                const display = document.getElementById(`stake-display-${target}`);
                
                // Toggle MAX mode
                const isActive = btn.classList.contains('active');
                if (isActive) {
                    // Turn off MAX mode
                    btn.classList.remove('active');
                    this.maxStakeMode[target] = false;
                } else {
                    // Turn on MAX mode
                    btn.classList.add('active');
                    this.maxStakeMode[target] = true;
                    
                    // Immediately update to max (capped at 50% of target's cookies)
                    if (slider && display) {
                        const bot = this.bots.find(b => b.name === target);
                        const targetCookies = bot ? bot.cookies : Infinity;
                        const maxBet = Math.floor(targetCookies * 0.5);
                        const maxStake = Math.min(Math.floor(this.cookies), maxBet);
                        slider.max = Math.max(1, maxStake);
                        slider.value = Math.max(1, maxStake);
                        display.textContent = `${slider.value}🍪`;
                    }
                }
                
                // Check tutorial progress (for buff strategy stake step)
                this.checkTutorialProgress();
            });
        });
        
        // Trade buttons
        document.querySelectorAll('.quick-trade-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const target = btn.dataset.target;
                const action = btn.dataset.action;
                this.openPosition(target, action);
            });
        });
        
        // Ability buttons - Freeze
        document.querySelectorAll('.header-freeze-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const target = btn.dataset.target;
                this.useFreeze(target);
            });
        });
        
        // Ability buttons - Crash
        document.querySelectorAll('.header-crash-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const target = btn.dataset.target;
                this.useCrash(target);
            });
        });
        
        // Tutorial buttons
        document.getElementById('tutorial-next-btn')?.addEventListener('click', () => {
            this.advanceTutorial();
        });
        
        document.getElementById('skip-tutorial')?.addEventListener('click', () => {
            this.completeTutorial();
        });
    }
    
    handleCookieClick(e) {
        // Calculate total click power with multiplier
        const clickAmount = Math.floor(this.clickPower * this.clickMultiplier);
        this.cookies += clickAmount;
        
        // Track click for CPS calculation
        const now = Date.now();
        this.clickTimes.push(now);
        this.clickTimes = this.clickTimes.filter(t => now - t < 1000);
        this.currentCPS = this.clickTimes.length;
        
        // Calculate multiplier based on CPS (same as real game)
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
        
        // Visual feedback
        this.showClickFeedback(e, clickAmount);
        
        // Check if we liquidated any bot positions on us
        this.checkBotPositionLiquidations();
        
        // Check tutorial progress
        this.checkTutorialProgress();
        
        // Update displays
        this.updateDisplays();
    }
    
    showClickFeedback(e, amount) {
        const cookie = document.getElementById('big-cookie');
        if (!cookie) return;
        
        const feedback = document.createElement('div');
        feedback.className = 'click-feedback';
        feedback.textContent = `+${amount || this.clickPower}`;
        feedback.style.left = (e.offsetX || 60) + 'px';
        feedback.style.top = (e.offsetY || 60) + 'px';
        
        // Make it bigger/different color if multiplier is active
        if (this.clickMultiplier > 1.5) {
            feedback.style.color = '#f39c12';
            feedback.style.fontSize = '1.8em';
        }
        
        cookie.parentElement.appendChild(feedback);
        setTimeout(() => feedback.remove(), 800);
    }
    
    buyGenerator(gen) {
        const data = this.generatorData[gen];
        if (!data) return;
        
        const cost = this.getGeneratorCost(gen);
        if (this.cookies < cost) return;
        
        this.cookies -= cost;
        this.generators[gen]++;
        this.cps += data.cps;
        
        this.showNotification(`Bought ${gen}! +${data.cps}/sec`, 'success');
        
        // Check if buying lowered cookies enough to liquidate bot positions (e.g. LONG positions)
        this.checkBotPositionLiquidations();
        
        this.updateDisplays();
        this.checkTutorialProgress();
    }
    
    getGeneratorCost(gen) {
        const data = this.generatorData[gen];
        if (!data) return Infinity;
        return Math.floor(data.baseCost * Math.pow(1.15, this.generators[gen]));
    }
    
    // Spotlight system - dims page and highlights only the target element
    setSpotlight(elementOrSelector, isCircle = false) {
        const dimOverlay = document.getElementById('tutorial-dim-overlay');
        
        // Clear any existing spotlight
        this.clearSpotlight();
        
        if (!elementOrSelector) {
            return;
        }
        
        // Activate dim overlay
        if (dimOverlay) {
            dimOverlay.classList.add('active');
        }
        
        // Support array of selectors (can be strings or {selector, noGlow} objects)
        const selectors = Array.isArray(elementOrSelector) ? elementOrSelector : [elementOrSelector];
        
        for (const item of selectors) {
            let selector = item;
            let noGlow = false;
            let useCircle = isCircle;
            
            // Support object format: {selector: '#foo', noGlow: true}
            if (typeof item === 'object' && item.selector) {
                selector = item.selector;
                noGlow = item.noGlow || false;
            }
            
            let el = selector;
            if (typeof selector === 'string') {
                // Check if it's the cookie - use circle
                if (selector === '#big-cookie') {
                    useCircle = true;
                }
                el = document.querySelector(selector);
            }
            
            if (!el) continue;
            
            // Spotlight the element
            if (noGlow) {
                el.classList.add('tutorial-spotlight-no-glow');
            } else {
                el.classList.add('tutorial-spotlight');
                if (useCircle) {
                    el.classList.add('tutorial-spotlight-circle');
                }
            }
        }
    }
    
    clearSpotlight() {
        const dimOverlay = document.getElementById('tutorial-dim-overlay');
        if (dimOverlay) {
            dimOverlay.classList.remove('active');
        }
        
        // Reset tracked target
        this._currentSpotlightTarget = null;
        
        // Remove spotlight from all elements
        document.querySelectorAll('.tutorial-spotlight, .tutorial-spotlight-no-glow').forEach(el => {
            el.classList.remove('tutorial-spotlight');
            el.classList.remove('tutorial-spotlight-no-glow');
            el.classList.remove('tutorial-spotlight-circle');
        });
    }
    
    // Update spotlight for steps that depend on affordability
    updateDynamicSpotlight() {
        const stepData = this.tutorialSteps[this.tutorialStep];
        if (!stepData || !stepData.action) return;
        
        let newTarget = null;
        
        // Handle buy-click-power: spotlight cookie if can't afford, else spotlight upgrade button
        if (stepData.action === 'buy-click-power') {
            const cost = this.getClickUpgradeCost();
            if (this.cookies >= cost) {
                newTarget = '#upgrade-click';
            } else {
                // Cookie with cookie count visible
                newTarget = ['#big-cookie', {selector: '#cookie-count', noGlow: true}];
            }
        }
        
        // Handle buy-generator: spotlight cookie if can't afford, else spotlight generator
        if (stepData.action === 'buy-generator') {
            const cost = this.getGeneratorCost(stepData.target);
            if (this.cookies >= cost) {
                newTarget = `#generator-${stepData.target}`;
            } else {
                // Cookie with cookie count visible
                newTarget = ['#big-cookie', {selector: '#cookie-count', noGlow: true}];
            }
        }
        
        // Handle defend-against-long: spotlight best affordable generator or cookie
        // Also show player's chart and sidebar since they've been longed
        if (stepData.action === 'defend-against-long') {
            const genOrder = ['mine', 'factory', 'bakery', 'grandma'];
            let bestGen = null;
            for (const gen of genOrder) {
                const cost = this.getGeneratorCost(gen);
                if (this.cookies >= cost) {
                    bestGen = gen;
                    break;
                }
            }
            if (bestGen) {
                newTarget = [
                    `#generator-${bestGen}`,
                    {selector: '#card-YOU', noGlow: true},
                    {selector: '#positions-sidebar-YOU', noGlow: true}
                ];
            } else {
                // Cookie with cookie count visible, plus player's chart and sidebar
                newTarget = [
                    '#big-cookie',
                    {selector: '#cookie-count', noGlow: true},
                    {selector: '#card-YOU', noGlow: true},
                    {selector: '#positions-sidebar-YOU', noGlow: true}
                ];
            }
        }
        
        // Handle close-position: keep the close button spotlighted (it gets re-rendered)
        // Force re-apply since the button HTML is recreated each update
        if (stepData.action === 'close-position') {
            const currentPos = this.positions[0];
            const closeTarget = currentPos ? currentPos.targetName : this.bots[0]?.name;
            // Always re-apply for close-position since button is re-rendered
            this.setSpotlight([
                '.close-btn-small',
                {selector: `#card-${closeTarget}`, noGlow: true},
                {selector: `#positions-sidebar-${closeTarget}`, noGlow: true}
            ]);
            return;
        }
        
        // Handle buff-strategy-close: keep the close button spotlighted
        // Force re-apply since the button HTML is recreated each update
        if (stepData.action === 'buff-strategy-close') {
            this.setSpotlight([
                '.close-btn-small',
                {selector: `#card-${this.bots[0].name}`, noGlow: true},
                {selector: `#positions-sidebar-${this.bots[0].name}`, noGlow: true}
            ]);
            return;
        }
        
        // Only update spotlight if target changed (convert to string for comparison)
        const targetKey = JSON.stringify(newTarget);
        if (newTarget && targetKey !== this._currentSpotlightTarget) {
            this._currentSpotlightTarget = targetKey;
            this.setSpotlight(newTarget);
        }
    }
    
    updateDefendLongHighlight() {
        // Now handled by updateDynamicSpotlight
    }

    upgradeClickPower() {
        const cost = this.getClickUpgradeCost();
        if (this.cookies < cost) return;
        
        this.cookies -= cost;
        this.clickPowerLevel++;
        this.clickPower = this.clickPowerLevel;
        
        this.showNotification(`Click power upgraded to +${this.clickPower}!`, 'success');
        this.updateDisplays();
    }
    
    getClickUpgradeCost() {
        // Price scales: 50, 200, 800, 3200, etc.
        return Math.floor(50 * Math.pow(4, this.clickPowerLevel - 1));
    }
    
    // Helper to get total locked cookies from open positions
    getLockedCookies() {
        return this.positions.reduce((sum, pos) => sum + pos.stake, 0);
    }
    
    // Helper to get available (unlocked) cookies
    getAvailableCookies() {
        return this.cookies - this.getLockedCookies();
    }
    
    openPosition(targetName, type) {
        const bot = this.bots.find(b => b.name === targetName);
        if (!bot) return;
        
        const slider = document.getElementById(`slider-${targetName}`);
        const stake = parseInt(slider?.value || 10);
        const leverage = this.targetLeverage[targetName] || 2;
        
        // Check minimum stake for tutorial step (both open-position and open-short)
        const stepData = this.tutorialSteps[this.tutorialStep];
        if (stepData && (stepData.action === 'open-position' || stepData.action === 'open-short') && stepData.minStake && stake < stepData.minStake) {
            this.showNotification(`Bet at least ${stepData.minStake} cookies!`, 'error');
            return;
        }
        
        // Check available (unlocked) cookies
        const lockedAmount = this.getLockedCookies();
        const available = this.cookies - lockedAmount;
        
        if (stake > available) {
            this.showNotification('Not enough available cookies!', 'error');
            return;
        }
        
        // Stake is locked but stays in balance (will be tracked via positions)
        
        // Create position
        const position = {
            id: Date.now() + '-' + Math.random().toString(36).substr(2, 9),
            targetName: targetName,
            type: type,
            stake: stake,
            leverage: leverage,
            entryPrice: bot.cookies,
            liquidationPrice: type === 'long' 
                ? bot.cookies * (1 - 1/leverage)
                : bot.cookies * (1 + 1/leverage)
        };
        
        this.positions.push(position);
        
        this.showNotification(`Opened ${type.toUpperCase()} on ${targetName} - ${stake}🍪 @ ${leverage}x`, 'info');
        this.updateDisplays();
        this.checkTutorialProgress();
    }
    
    closePosition(positionId) {
        const posIndex = this.positions.findIndex(p => p.id === positionId);
        if (posIndex === -1) return;
        
        const pos = this.positions[posIndex];
        const bot = this.bots.find(b => b.name === pos.targetName);
        if (!bot) return;
        
        // Calculate PNL
        const currentPrice = bot.cookies;
        const priceChange = currentPrice - pos.entryPrice;
        const pnlMultiplier = pos.type === 'long' ? 1 : -1;
        const pnl = Math.floor((priceChange / (pos.entryPrice || 1)) * pos.stake * pos.leverage * pnlMultiplier);
        
        // Only add/subtract PNL (stake was never removed, just locked)
        // If loss exceeds stake, we lose at most the stake
        const actualPnl = Math.max(-pos.stake, pnl);
        this.cookies += actualPnl;
        
        // If we profited, take from the bot. If we lost, give to the bot.
        if (actualPnl > 0) {
            bot.cookies = Math.max(0, bot.cookies - actualPnl);
        } else if (actualPnl < 0) {
            bot.cookies += Math.abs(actualPnl);
        }
        
        // Remove position
        this.positions.splice(posIndex, 1);
        
        const pnlText = pnl >= 0 ? `+${pnl}` : `${pnl}`;
        this.showNotification(`Closed position: ${pnlText}🍪`, pnl >= 0 ? 'success' : 'error');
        
        // Screen tint effect
        this.showScreenTint(pnl >= 0 ? 'green' : 'red');
        
        this.updateDisplays();
        this.checkTutorialProgress();
    }
    
    // Screen tint effect for money gain/loss
    showScreenTint(type, duration = 500) {
        const tint = document.getElementById('screen-tint');
        if (!tint) return;
        
        // Clear any existing timeout
        if (this.screenTintTimeout) {
            clearTimeout(this.screenTintTimeout);
        }
        
        tint.classList.remove('green', 'red', 'active');
        
        // Add the color class
        tint.classList.add(type);
        
        // Force reflow
        tint.offsetHeight;
        
        // Activate
        tint.classList.add('active');
        
        // Remove after duration
        this.screenTintTimeout = setTimeout(() => {
            tint.classList.remove('active');
            setTimeout(() => {
                tint.classList.remove('green', 'red');
            }, 150);
        }, duration);
    }
    
    useFreeze(targetName) {
        // Check if player has enough buffs
        if (this.playerBuffs < 1) {
            this.showNotification('Need 1 ability point to freeze!', 'error');
            return;
        }
        
        const bot = this.bots.find(b => b.name === targetName);
        if (!bot) return;
        
        // Use buff
        this.playerBuffs -= 1;
        
        // Freeze the bot for 15 seconds
        bot.frozen = true;
        bot.frozenUntil = Date.now() + 15000;
        
        this.showNotification(`🥶 Froze ${targetName} for 15 seconds!`, 'success');
        this.updateUI();
        this.checkTutorialProgress();
        
        // Auto-unfreeze after 15 seconds
        setTimeout(() => {
            if (bot.frozen) {
                bot.frozen = false;
                this.showNotification(`${targetName} unfroze!`, 'info');
                this.updateUI();
            }
        }, 15000);
    }
    
    useCrash(targetName) {
        // Check if player has enough buffs
        if (this.playerBuffs < 2) {
            this.showNotification('Need 2 ability points to crash!', 'error');
            return;
        }
        
        const bot = this.bots.find(b => b.name === targetName);
        if (!bot) return;
        
        // Check if bot has at least 500 cookies
        if (bot.cookies < 500) {
            this.showNotification(`${targetName} has less than 500🍪 - can't crash!`, 'error');
            return;
        }
        
        // Use buffs
        this.playerBuffs -= 2;
        
        // Crash the bot - lose 20% cookies
        const crashAmount = Math.floor(bot.cookies * 0.2);
        bot.cookies -= crashAmount;
        
        // Mark crash used for tutorial
        this.buffStrategyCrashUsed = true;
        
        this.showNotification(`📉💥 Market Crashed ${targetName}! -${crashAmount}🍪`, 'success');
        this.updateUI();
        this.updateDisplays();
        this.checkTutorialProgress();
    }
    
    updateUI() {
        // Update ability button states based on player buffs
        document.querySelectorAll('.header-freeze-btn').forEach(btn => {
            if (this.playerBuffs >= 1) {
                btn.classList.remove('locked');
            } else {
                btn.classList.add('locked');
            }
        });
        
        document.querySelectorAll('.header-crash-btn').forEach(btn => {
            if (this.playerBuffs >= 2) {
                btn.classList.remove('locked');
            } else {
                btn.classList.add('locked');
            }
        });
        
        // Update buff display (if we had one - add to left panel later)
        const buffDisplay = document.getElementById('buff-count');
        if (buffDisplay) {
            buffDisplay.textContent = this.playerBuffs;
        }
    }
    
    // Game loop
    startGameLoop() {
        this.lastTick = performance.now();
        this.gameLoop();
    }
    
    gameLoop() {
        const now = performance.now();
        const dt = (now - this.lastTick) / 1000;
        this.lastTick = now;
        
        // Check if tutorial dialog is showing - pause game updates
        const overlay = document.getElementById('tutorial-overlay');
        const isPaused = overlay && !overlay.classList.contains('hidden');
        
        if (!isPaused) {
            // Add CPS cookies
            if (this.cps > 0) {
                this.cookies += this.cps * dt;
            }
            
            // Update bots
            this.updateBots(dt);
            
            // Check liquidations
            this.checkLiquidations();
            
            // Update history - throttle to 10 times per second for smooth charts
            if (!this.lastHistoryUpdate || now - this.lastHistoryUpdate > 100) {
                this.lastHistoryUpdate = now;
                this.playerHistory.push(this.cookies);
                if (this.playerHistory.length > 1000) this.playerHistory.shift();
                
                this.bots.forEach(bot => {
                    bot.history.push(bot.cookies);
                    if (bot.history.length > 1000) bot.history.shift();
                });
            }
            
            // Update displays
            this.updateDisplays();
            this.renderCharts();
        }
        
        requestAnimationFrame(() => this.gameLoop());
    }
    
    updateBots(dt) {
        this.bots.forEach(bot => {
            // Bots earn cookies from CPS (slower in free play to make it easier for player)
            const cpsMultiplier = this.freePlayMode ? 0.7 : 1;
            bot.cookies += bot.cps * dt * cpsMultiplier;
            
            // Add some randomness to make it interesting (less in free play)
            if (Math.random() < 0.02) {
                const change = (Math.random() - 0.5) * (this.freePlayMode ? 10 : 20);
                bot.cookies = Math.max(10, bot.cookies + change);
            }
            
            // Occasionally boost their CPS (simulate buying generators) - slower in free play
            const buyChance = this.freePlayMode ? 0.002 : 0.005;
            if (Math.random() < buyChance && bot.cookies > 50) {
                bot.cps += 1;
                bot.cookies -= 15;
            }
        });
        
        // Free play bot trading AI
        if (this.freePlayMode) {
            this.updateBotTrading();
        }
    }
    
    updateBotTrading() {
        // Each bot has a chance to make a trade each frame
        this.bots.forEach(bot => {
            // Don't trade too often - check every ~3 seconds on average
            if (Math.random() > 0.01) return;
            
            // Bot can open a position on the player
            const hasPositionOnPlayer = this.botPositions.some(p => p.ownerName === bot.name);
            
            if (!hasPositionOnPlayer && bot.cookies > 100) {
                // Decide to long or short the player
                // Bots are not very smart - they make random decisions (easy for player)
                const positionType = Math.random() > 0.5 ? 'long' : 'short';
                const stake = Math.floor(Math.min(50, bot.cookies * 0.1)); // Small stakes - easy mode
                const leverage = 2; // Low leverage - easy mode
                
                if (stake >= 10) {
                    if (positionType === 'long') {
                        this.botLongsPlayer(bot.name, stake, leverage);
                    } else {
                        this.botShortsPlayer(bot.name, stake, leverage);
                    }
                }
            }
            
            // Bot might close their position if profitable or cut losses
            const botPosition = this.botPositions.find(p => p.ownerName === bot.name);
            if (botPosition && Math.random() < 0.05) {
                // Calculate PnL
                const currentPrice = this.cookies;
                const priceChange = currentPrice - botPosition.entryPrice;
                const pnlMultiplier = botPosition.type === 'long' ? 1 : -1;
                const pnl = (priceChange / botPosition.entryPrice) * botPosition.stake * botPosition.leverage * pnlMultiplier;
                
                // Close if profitable (50% chance) or big loss (30% chance)
                if ((pnl > botPosition.stake * 0.2 && Math.random() < 0.5) || 
                    (pnl < -botPosition.stake * 0.3 && Math.random() < 0.3)) {
                    this.botClosesPosition(bot.name);
                }
            }
        });
    }
    
    botClosesPosition(botName) {
        const posIndex = this.botPositions.findIndex(p => p.ownerName === botName);
        if (posIndex === -1) return;
        
        const pos = this.botPositions[posIndex];
        const bot = this.bots.find(b => b.name === botName);
        if (!bot) return;
        
        // Calculate PnL
        const currentPrice = this.cookies;
        const priceChange = currentPrice - pos.entryPrice;
        const pnlMultiplier = pos.type === 'long' ? 1 : -1;
        const pnl = Math.floor((priceChange / pos.entryPrice) * pos.stake * pos.leverage * pnlMultiplier);
        
        // Bot gets back stake + pnl (or stake - loss)
        const actualPnl = Math.max(-pos.stake, pnl);
        bot.cookies += pos.stake + actualPnl;
        
        // If bot profited, player loses. If bot lost, player gains.
        if (actualPnl > 0) {
            this.cookies -= actualPnl;
            this.showNotification(`${botName} closed position: +${actualPnl}🍪 profit from you!`, 'warning');
        } else if (actualPnl < 0) {
            this.cookies += Math.abs(actualPnl);
            this.showNotification(`${botName} closed position: lost ${Math.abs(actualPnl)}🍪 to you!`, 'success');
        } else {
            this.showNotification(`${botName} closed position: broke even`, 'info');
        }
        
        // Remove position
        this.botPositions.splice(posIndex, 1);
        this.updateDisplays();
    }
    
    checkLiquidations() {
        this.positions = this.positions.filter(pos => {
            const bot = this.bots.find(b => b.name === pos.targetName);
            if (!bot) return false;
            
            const currentPrice = bot.cookies;
            const isLiquidated = pos.type === 'long' 
                ? currentPrice <= pos.liquidationPrice
                : currentPrice >= pos.liquidationPrice;
            
            if (isLiquidated) {
                // Player loses their stake - deduct from cookies
                this.cookies -= pos.stake;
                // Bot wins the stake
                bot.cookies += pos.stake;
                
                this.showNotification(`💀 Position on ${pos.targetName} LIQUIDATED! Lost ${pos.stake}🍪`, 'error');
                this.showScreenTint('red', 800);
                // Mark that player was liquidated for tutorial progress
                this.playerWasLiquidated = true;
                return false;
            }
            return true;
        });
    }
    
    // Check if bot positions on the player should be liquidated
    checkBotPositionLiquidations() {
        this.botPositions = this.botPositions.filter(pos => {
            const currentPrice = this.cookies;
            // Bot has a SHORT on us, so they get liquidated if price goes UP past their liq price
            const isLiquidated = pos.type === 'short' 
                ? currentPrice >= pos.liquidationPrice
                : currentPrice <= pos.liquidationPrice;
            
            if (isLiquidated) {
                // Bot gets liquidated - we win their stake!
                this.cookies += pos.stake;
                this.showNotification(`🎉 ${pos.ownerName}'s position LIQUIDATED! You won ${pos.stake}🍪!`, 'success');
                this.showScreenTint('green', 800);
                this.checkTutorialProgress();
                return false;
            }
            return true;
        });
    }
    
    // Bot opens a short position on the player
    botShortsPlayer(botName, stake, leverage) {
        const bot = this.bots.find(b => b.name === botName);
        if (!bot) return;
        
        const entryPrice = this.cookies;
        // For a short, liquidation is when price goes UP by (1/leverage) * 100%
        const liquidationPrice = Math.floor(entryPrice * (1 + 1 / leverage));
        
        const position = {
            id: Date.now(),
            ownerName: botName,
            type: 'short',
            stake: stake,
            leverage: leverage,
            entryPrice: entryPrice,
            liquidationPrice: liquidationPrice
        };
        
        this.botPositions.push(position);
        bot.cookies -= stake; // Bot locks their stake
        
        this.showNotification(`⚠️ ${botName} opened a SHORT on YOU! ${stake}🍪 @ ${leverage}x`, 'warning');
        this.updateDisplays();
    }
    
    // Bot opens a long position on the player
    botLongsPlayer(botName, stake, leverage) {
        const bot = this.bots.find(b => b.name === botName);
        if (!bot) return;
        
        const entryPrice = this.cookies;
        // For a long, liquidation is when price goes DOWN by (1/leverage) * 100%
        const liquidationPrice = Math.floor(entryPrice * (1 - 1 / leverage));
        
        const position = {
            id: Date.now(),
            ownerName: botName,
            type: 'long',
            stake: stake,
            leverage: leverage,
            entryPrice: entryPrice,
            liquidationPrice: liquidationPrice
        };
        
        this.botPositions.push(position);
        bot.cookies -= stake; // Bot locks their stake
        
        this.showNotification(`⚠️ ${botName} opened a LONG on YOU! ${stake}🍪 @ ${leverage}x`, 'warning');
        this.updateDisplays();
    }
    
    updateDisplays() {
        // Cookie count
        const cookieEl = document.getElementById('cookie-count');
        if (cookieEl) cookieEl.textContent = Math.floor(this.cookies).toLocaleString();
        
        // Net worth
        const netWorth = this.cookies + this.calculateGeneratorValue();
        const networthEl = document.getElementById('networth-value');
        if (networthEl) networthEl.textContent = Math.floor(netWorth).toLocaleString();
        
        // CPS display - show cookies per second from clicks (like real game)
        const cpsEl = document.getElementById('cookie-cps');
        if (cpsEl) {
            const clickCPS = Math.floor(this.currentCPS * this.clickPower * this.clickMultiplier);
            const multiplierText = this.clickMultiplier > 1 ? ` (${this.clickMultiplier.toFixed(1)}x)` : '';
            cpsEl.innerHTML = `
                <div style="font-size: 0.7em; color: #2ecc71;">🖱️ ${clickCPS} cookies/sec${multiplierText}</div>
                <div style="font-size: 0.7em; color: #f39c12;">🏭 +${this.cps} from generators</div>
            `;
        }
        
        // Locked value
        const lockedValue = this.positions.reduce((sum, p) => sum + p.stake, 0);
        const lockedEl = document.getElementById('locked-value');
        if (lockedEl) lockedEl.textContent = lockedValue;
        
        // Update generator buttons
        Object.keys(this.generatorData).forEach(gen => {
            const btn = document.getElementById(`generator-${gen}`);
            if (!btn) return;
            
            const cost = this.getGeneratorCost(gen);
            const canAfford = this.cookies >= cost;
            
            btn.classList.toggle('locked', !canAfford);
            btn.querySelector('.gen-level').textContent = `Lv.${this.generators[gen]}`;
            btn.querySelector('.cost-value').textContent = cost.toLocaleString();
        });
        
        // Update click power button
        const clickBtn = document.getElementById('upgrade-click');
        if (clickBtn) {
            const cost = this.getClickUpgradeCost();
            const canAfford = this.cookies >= cost;
            clickBtn.classList.toggle('locked', !canAfford);
            clickBtn.querySelector('.click-power-level').textContent = `Lv.${this.clickPowerLevel}`;
            clickBtn.querySelector('.click-power-cost').textContent = cost.toLocaleString();
            clickBtn.querySelector('.click-power-desc').textContent = `+${this.clickPower} per click → +${this.clickPower + 1}`;
        }
        
        // Update slider max values (capped at 50% of target's cookies)
        this.bots.forEach(bot => {
            const slider = document.getElementById(`slider-${bot.name}`);
            if (slider) {
                const maxBet = Math.floor(bot.cookies * 0.5); // Can't bet more than 50% of target's cookies
                const maxStake = Math.min(Math.floor(this.cookies), maxBet);
                slider.max = Math.max(1, maxStake);
                
                // If MAX mode is locked for this target, update value to max
                if (this.maxStakeMode[bot.name]) {
                    slider.value = Math.max(1, maxStake);
                } else if (parseInt(slider.value) > maxStake) {
                    slider.value = maxStake;
                }
                slider.disabled = maxStake < 1;
                
                const display = document.getElementById(`stake-display-${bot.name}`);
                if (display) display.textContent = `${slider.value}🍪`;
            }
        });
        
        // Update scoreboard
        this.updateScoreboard();
        
        // Update positions sidebars
        this.updatePositionsSidebars();
        
        // Update goal progress (based on cookies, not net worth)
        const goalTarget = this.freePlayGoal || 10000;
        const progress = Math.min(100, (this.cookies / goalTarget) * 100);
        const goalFill = document.getElementById('goal-fill');
        const goalPercent = document.getElementById('goal-percent');
        if (goalFill) goalFill.style.width = progress + '%';
        if (goalPercent) goalPercent.textContent = Math.floor(progress) + '%';
        
        // Update dynamic spotlight for steps that depend on affordability
        this.updateDynamicSpotlight();
    }
    
    calculateGeneratorValue() {
        let value = 0;
        Object.keys(this.generators).forEach(gen => {
            const count = this.generators[gen];
            const data = this.generatorData[gen];
            for (let i = 0; i < count; i++) {
                value += Math.floor(data.baseCost * Math.pow(1.15, i));
            }
        });
        return value;
    }
    
    updateScoreboard() {
        // Update YOU score
        const youScore = document.getElementById('score-you');
        if (youScore) youScore.textContent = `${Math.floor(this.cookies)} 🍪`;
        
        const youVel = document.getElementById('vel-you');
        if (youVel) {
            const vel = this.cps + this.currentCPS;
            youVel.textContent = `+${vel}/s`;
            youVel.className = `stat-velocity ${vel > 0 ? 'up' : 'flat'}`;
        }
        
        // Update locked margin for player
        const lockedEl = document.getElementById('locked-margin');
        if (lockedEl) {
            const lockedValue = this.positions.reduce((sum, p) => sum + p.stake, 0);
            lockedEl.textContent = `🔒 ${lockedValue}`;
        }
        
        // Update bot scores and net worth
        this.bots.forEach(bot => {
            const scoreEl = document.getElementById(`score-${bot.name}`);
            if (scoreEl) scoreEl.textContent = `${Math.floor(bot.cookies)} 🍪`;
            
            // Bot net worth (cookies + simulated generator value)
            const networthEl = document.getElementById(`networth-${bot.name}`);
            if (networthEl) {
                // Simulate bot net worth as cookies * some multiplier
                const botNetworth = Math.floor(bot.cookies * 1.5);
                networthEl.textContent = `💎 ${botNetworth}`;
            }
            
            const velEl = document.getElementById(`vel-${bot.name}`);
            if (velEl) {
                velEl.textContent = `+${bot.cps}/s`;
                velEl.className = `stat-velocity ${bot.cps > 0 ? 'up' : 'flat'}`;
            }
        });
    }
    
    updatePositionsSidebars() {
        // Update sidebar for each player
        ['YOU', ...this.bots.map(b => b.name)].forEach(name => {
            const listEl = document.getElementById(`positions-list-${name}`);
            const pnlEl = document.getElementById(`pnl-sidebar-${name}`);
            if (!listEl) return;
            
            // Get positions targeting this player
            const positionsOnTarget = this.positions.filter(p => p.targetName === name);
            
            // For the YOU sidebar, also include bot positions on the player
            const botPositionsOnYou = (name === 'YOU') ? this.botPositions : [];
            
            if (positionsOnTarget.length === 0 && botPositionsOnYou.length === 0) {
                listEl.innerHTML = '<div class="no-positions-small">No positions</div>';
                if (pnlEl) {
                    pnlEl.textContent = '0🍪';
                    pnlEl.className = 'player-positions-pnl neutral';
                }
                return;
            }
            
            // Calculate total PNL for player's positions
            let totalPnl = 0;
            const positionsHtml = positionsOnTarget.map(pos => {
                const bot = this.bots.find(b => b.name === pos.targetName);
                const currentPrice = bot ? bot.cookies : this.cookies;
                const priceChange = currentPrice - pos.entryPrice;
                const pnlMultiplier = pos.type === 'long' ? 1 : -1;
                const pnl = Math.floor((priceChange / (pos.entryPrice || 1)) * pos.stake * pos.leverage * pnlMultiplier);
                totalPnl += pnl;
                
                const pnlClass = pnl >= 0 ? 'profit' : 'loss';
                const pnlText = pnl >= 0 ? `+${pnl}` : `${pnl}`;
                
                return `
                    <div class="player-pos-item ${pos.type}">
                        <div>
                            <span class="pos-trader" style="color:#2ecc71">YOU</span>
                            <span class="pos-type-badge ${pos.type}">${pos.type.toUpperCase()} ${pos.leverage}x</span>
                        </div>
                        <div class="pos-details-row">
                            <span>🔒${pos.stake}</span>
                            <span class="pos-pnl-small ${pnlClass}">${pnlText}🍪</span>
                        </div>
                        <button class="close-btn-small" onmousedown="tutorial.closePosition('${pos.id}')">CLOSE</button>
                    </div>
                `;
            }).join('');
            
            // Add bot positions on YOU (these show who is trading against the player)
            const botPositionsHtml = botPositionsOnYou.map(pos => {
                const currentPrice = this.cookies;
                const priceChange = currentPrice - pos.entryPrice;
                const pnlMultiplier = pos.type === 'long' ? 1 : -1;
                const botPnl = Math.floor((priceChange / (pos.entryPrice || 1)) * pos.stake * pos.leverage * pnlMultiplier);
                
                // Show the BOT's PnL - when bot is losing (negative), that's good for player
                const pnlClass = botPnl >= 0 ? 'profit' : 'loss';
                const pnlText = botPnl >= 0 ? `+${botPnl}` : `${botPnl}`;
                
                const bot = this.bots.find(b => b.name === pos.ownerName);
                const botColor = bot ? bot.color : '#e74c3c';
                
                return `
                    <div class="player-pos-item ${pos.type}" style="border-left-color: ${botColor};">
                        <div>
                            <span class="pos-trader" style="color:${botColor}">${pos.ownerName}</span>
                            <span class="pos-type-badge ${pos.type}">${pos.type.toUpperCase()} ${pos.leverage}x</span>
                        </div>
                        <div class="pos-details-row">
                            <span>🔒${pos.stake}</span>
                            <span class="pos-pnl-small ${pnlClass}">${pnlText}🍪</span>
                        </div>
                        <div style="font-size: 0.8em; color: #888; margin-top: 2px;">⚠️ vs YOU</div>
                    </div>
                `;
            }).join('');
            
            listEl.innerHTML = positionsHtml + botPositionsHtml;
            
            if (pnlEl) {
                const pnlClass = totalPnl > 0 ? 'profit' : totalPnl < 0 ? 'loss' : 'neutral';
                const pnlText = totalPnl >= 0 ? `+${totalPnl}` : `${totalPnl}`;
                pnlEl.textContent = `${pnlText}🍪`;
                pnlEl.className = `player-positions-pnl ${pnlClass}`;
            }
        });
    }
    
    bindZoomControls() {
        document.querySelectorAll('.zoom-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const chartId = btn.dataset.chart;
                const viewport = this.chartViewport[chartId];
                if (!viewport) return;
                
                if (btn.classList.contains('zoom-in')) {
                    viewport.zoom = Math.min(viewport.zoom * 1.5, 10);
                    viewport.isAll = false;
                } else if (btn.classList.contains('zoom-out')) {
                    viewport.zoom = Math.max(viewport.zoom / 1.5, 0.5);
                    viewport.isAll = false;
                } else if (btn.classList.contains('zoom-all')) {
                    viewport.isAll = true;
                    viewport.zoom = 1;
                } else if (btn.classList.contains('zoom-live')) {
                    viewport.isAll = false;
                    viewport.zoom = 1;
                }
            });
        });
    }
    
    getViewportData(chartId) {
        // Default to ALL mode if viewport not found
        const viewport = this.chartViewport[chartId] || { zoom: 1, isAll: true };
        let history;
        
        if (chartId === 'you') {
            history = this.playerHistory;
        } else {
            const bot = this.bots.find(b => b.name === chartId);
            history = bot ? bot.history : [];
        }
        
        if (!history || history.length === 0) {
            return { data: [], isLive: false };
        }
        
        // In ALL mode, show the entire history
        if (viewport.isAll) {
            return { data: [...history], isLive: false };
        }
        
        // Show last N points based on zoom
        const basePoints = 100;
        const visiblePoints = Math.max(20, Math.floor(basePoints / viewport.zoom));
        const data = history.slice(-visiblePoints);
        
        return { data, isLive: true };
    }
    
    renderCharts() {
        // Render player chart
        const youViewport = this.getViewportData('you');
        this.renderChart('chart-you', youViewport.data, '#2ecc71', 'you', youViewport.isLive);
        
        // Render bot charts
        this.bots.forEach(bot => {
            const viewport = this.getViewportData(bot.name);
            this.renderChart(`chart-${bot.name}`, viewport.data, bot.color, bot.name, viewport.isLive);
        });
    }
    
    renderChart(canvasId, data, color, labelId, isLive = true) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        const rect = canvas.parentElement.getBoundingClientRect();
        
        // Set canvas size
        canvas.width = rect.width * window.devicePixelRatio;
        canvas.height = rect.height * window.devicePixelRatio;
        canvas.style.width = rect.width + 'px';
        canvas.style.height = rect.height + 'px';
        ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
        
        const W = rect.width;
        const H = rect.height;
        const MARGIN_LEFT = 45;
        const CHART_W = W - MARGIN_LEFT;
        
        // Clear & background
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
        let min = Math.min(...data) * 0.95;
        let max = Math.max(...data) * 1.05;
        
        // For YOUR chart, expand bounds to include bot liquidation prices
        if (labelId === 'you' && this.botPositions && this.botPositions.length > 0) {
            this.botPositions.forEach(pos => {
                if (pos.liquidationPrice) {
                    if (pos.liquidationPrice > max) max = pos.liquidationPrice;
                    if (pos.liquidationPrice < min) min = pos.liquidationPrice;
                }
            });
        }
        
        // For BOT charts, expand bounds to include YOUR liquidation prices on them
        if (labelId !== 'you' && this.positions && this.positions.length > 0) {
            // Find bot name from labelId (e.g., 'chipmaster' -> 'ChipMaster')
            const bot = this.bots.find(b => b.name.toLowerCase().replace(/\s+/g, '') === labelId.toLowerCase());
            if (bot) {
                const positionsOnBot = this.positions.filter(p => p.targetName === bot.name);
                positionsOnBot.forEach(pos => {
                    if (pos.liquidationPrice) {
                        if (pos.liquidationPrice > max) max = pos.liquidationPrice;
                        if (pos.liquidationPrice < min) min = pos.liquidationPrice;
                    }
                });
            }
        }
        
        const padding = (max - min) * 0.1 || 10;
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
            
            // Grid line
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
        
        // Draw liquidation zones if player has position on this bot
        const bot = this.bots.find(b => b.name === labelId);
        if (bot) {
            const position = this.positions.find(p => p.targetName === labelId);
            if (position && position.liquidationPrice) {
                const liqY = H - ((position.liquidationPrice - min) / range) * H;
                const entryY = H - ((position.entryPrice - min) / range) * H;
                
                if (position.type === 'long') {
                    // Danger zone below liquidation
                    const dangerGrad = ctx.createLinearGradient(0, liqY, 0, H);
                    dangerGrad.addColorStop(0, 'rgba(231,76,60,0.4)');
                    dangerGrad.addColorStop(1, 'rgba(231,76,60,0.05)');
                    ctx.fillStyle = dangerGrad;
                    ctx.fillRect(MARGIN_LEFT, liqY, CHART_W, H - liqY);
                    
                    // Safe zone above entry
                    const safeGrad = ctx.createLinearGradient(0, 0, 0, entryY);
                    safeGrad.addColorStop(0, 'rgba(46,204,113,0.15)');
                    safeGrad.addColorStop(1, 'rgba(46,204,113,0.02)');
                    ctx.fillStyle = safeGrad;
                    ctx.fillRect(MARGIN_LEFT, 0, CHART_W, entryY);
                } else {
                    // Danger zone above liquidation (short)
                    const dangerGrad = ctx.createLinearGradient(0, 0, 0, liqY);
                    dangerGrad.addColorStop(0, 'rgba(231,76,60,0.05)');
                    dangerGrad.addColorStop(1, 'rgba(231,76,60,0.4)');
                    ctx.fillStyle = dangerGrad;
                    ctx.fillRect(MARGIN_LEFT, 0, CHART_W, liqY);
                    
                    // Safe zone below entry
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
        
        // Draw bot positions on player's chart (when bots short the player)
        if (labelId === 'you' && this.botPositions.length > 0) {
            this.botPositions.forEach(pos => {
                const liqY = H - ((pos.liquidationPrice - min) / range) * H;
                const entryY = H - ((pos.entryPrice - min) / range) * H;
                
                // Danger zone gradient based on position type
                if (pos.type === 'short') {
                    // Bot SHORT on us - their liquidation is ABOVE, safe zone above liq
                    const safeGrad = ctx.createLinearGradient(0, 0, 0, liqY);
                    safeGrad.addColorStop(0, 'rgba(46,204,113,0.3)');
                    safeGrad.addColorStop(1, 'rgba(46,204,113,0.05)');
                    ctx.fillStyle = safeGrad;
                    ctx.fillRect(MARGIN_LEFT, 0, CHART_W, liqY);
                } else {
                    // Bot LONG on us - their liquidation is BELOW, safe zone below liq
                    const safeGrad = ctx.createLinearGradient(0, liqY, 0, H);
                    safeGrad.addColorStop(0, 'rgba(46,204,113,0.05)');
                    safeGrad.addColorStop(1, 'rgba(46,204,113,0.3)');
                    ctx.fillStyle = safeGrad;
                    ctx.fillRect(MARGIN_LEFT, liqY, CHART_W, H - liqY);
                }
                
                // Bot's liquidation line - always RED
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
                ctx.fillText(`💀 ${pos.ownerName} LIQ`, MARGIN_LEFT + 5, liqY - 3);
                
                // Bot's entry line - always YELLOW
                ctx.strokeStyle = '#f39c12';
                ctx.beginPath();
                ctx.moveTo(MARGIN_LEFT, entryY);
                ctx.lineTo(W, entryY);
                ctx.stroke();
                
                ctx.fillStyle = '#f39c12';
                ctx.fillText(`${pos.ownerName} ENTRY`, MARGIN_LEFT + 5, entryY - 3);
                
                ctx.setLineDash([]);
            });
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
        if (isLive && points.length > 0) {
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
    }
    
    showNotification(message, type = 'info') {
        const feed = document.getElementById('notif-feed');
        if (!feed) return;
        
        const item = document.createElement('div');
        item.className = `notif-item ${type}`;
        item.textContent = message;
        
        feed.insertBefore(item, feed.firstChild);
        
        // Keep only last 10
        while (feed.children.length > 10) {
            feed.removeChild(feed.lastChild);
        }
    }
    
    // Tutorial system
    showTutorialStep(step) {
        this.tutorialStep = step;
        const stepData = this.tutorialSteps[step];
        if (!stepData) return;
        
        const overlay = document.getElementById('tutorial-overlay');
        const dialog = document.getElementById('tutorial-dialog');
        const title = document.getElementById('tutorial-title');
        const text = document.getElementById('tutorial-text');
        const btn = document.getElementById('tutorial-next-btn');
        
        if (title) title.textContent = stepData.title;
        if (text) text.innerHTML = stepData.text;
        if (btn) btn.textContent = stepData.final ? 'Start Playing! 🎮' : 'Got it! ✓';
        
        overlay?.classList.remove('hidden');
        
        // Handle special actions when step is shown
        if (stepData.action === 'give-starting-bonus') {
            // Give player and bots 500 cookies each
            this.cookies += 500;
            this.bots.forEach(bot => {
                bot.cookies += 500;
                bot.history.push(bot.cookies);
            });
            stepData.completed = true;
            this.showNotification('💰 Received 500 starting cookies!', 'success');
            this.showScreenTint('green', 600);
            this.updateDisplays();
        }
        
        if (stepData.action === 'bot-shorts-you') {
            // Mark as completed immediately - this is just an informational step
            stepData.completed = true;
            
            // Bot shorts the player if not already done
            if (this.botPositions.length === 0) {
                const stake = Math.min(20, Math.max(10, Math.floor(this.cookies * 0.3)));
                setTimeout(() => {
                    this.botShortsPlayer('CookieBot', stake, 2);
                    this.renderCharts(); // Refresh charts to show liquidation line
                }, 500);
            }
        }
        
        // Bot longs the player for defense demonstration
        if (stepData.action === 'bot-longs-you') {
            // Mark as completed immediately - this is just an informational step
            stepData.completed = true;
            
            // Only add the long if there are no SHORT positions (meaning the short was liquidated)
            const hasShortOnPlayer = this.botPositions.some(p => p.type === 'short');
            if (!hasShortOnPlayer) {
                // ChipMaster longs the player
                const stake = Math.min(50, Math.max(20, Math.floor(this.cookies * 0.2)));
                setTimeout(() => {
                    this.botLongsPlayer('ChipMaster', stake, 3);
                    this.renderCharts(); // Refresh charts to show liquidation line
                }, 500);
            }
        }
        
        // Player gets liquidated - DON'T trigger yet, wait for user to click Okay
        // The actual liquidation will happen in advanceTutorial when they click Okay
        if (stepData.action === 'player-gets-liquidated') {
            // Just show the warning message, don't do anything yet
            // The liquidation will be triggered when they advance from this step
        }
        
        // Defend against long - initialize tracker
        if (stepData.action === 'defend-against-long') {
            this.defendLongInitialGenerators = Object.values(this.generators).reduce((sum, g) => sum + g, 0);
            // Spotlight will be updated dynamically by updateDynamicSpotlight
        }
        
        // Initialize trackers when action steps are shown
        if (stepData.action === 'close-position') {
            this.closePositionInitialCount = this.positions.length;
        }
        if (stepData.action === 'liquidate-bot') {
            this.liquidateBotInitialCount = this.botPositions.length;
        }
        if (stepData.action === 'defend-against-long') {
            this.defendLongInitialCount = this.botPositions.filter(p => p.type === 'long').length;
        }
        if (stepData.action === 'buff-strategy-close') {
            this.buffStrategyCloseInitialCount = this.positions.length;
        }
        
        // Give buffs when buff strategy step is shown
        if (stepData.action === 'buff-strategy-setup') {
            this.playerBuffs = 2;
            this.updateUI();
        }
        
        // Set up spotlight for action steps
        if (stepData.action) {
            setTimeout(() => {
                this.setupActionSpotlight(stepData);
            }, 100);
        } else {
            // No action required - clear spotlight
            this.clearSpotlight();
        }
        
        // Update step counter - HIDDEN (uncomment to show)
        // const stepCounter = document.getElementById('step-counter');
        // if (stepCounter) {
        //     stepCounter.textContent = `${step + 1} / ${this.tutorialSteps.length}`;
        // }
        
        // Update progress dots
        document.querySelectorAll('.tutorial-progress .step').forEach((dot, i) => {
            dot.classList.remove('done', 'active');
            if (i < step) dot.classList.add('done');
            if (i === step) dot.classList.add('active');
        });
        
        // Update the hint box based on current action
        this.updateHintBox(stepData.action);
    }
    
    setupActionSpotlight(stepData) {
        // Clear any existing spotlight first
        this.clearSpotlight();
        
        const action = stepData.action;
        
        switch (action) {
            case 'click':
                // Spotlight cookie with glow, cookie count under it without glow
                this.setSpotlight([
                    '#big-cookie',
                    {selector: '#cookie-count', noGlow: true}
                ]);
                break;
            case 'buy-generator':
                // Will be handled by updateDynamicSpotlight
                this.updateDynamicSpotlight();
                break;
            case 'buy-click-power':
                // Will be handled by updateDynamicSpotlight
                this.updateDynamicSpotlight();
                break;
            case 'set-stake':
                const targetBot = stepData.target || this.bots[0]?.name;
                // Spotlight slider with glow, stake display without glow
                this.setSpotlight([`#slider-${targetBot}`, {selector: `#stake-display-${targetBot}`, noGlow: true}]);
                break;
            case 'set-stake-short':
                const targetBotShort = stepData.target || this.bots[1]?.name;
                // Spotlight slider with glow, stake display without glow
                this.setSpotlight([`#slider-${targetBotShort}`, {selector: `#stake-display-${targetBotShort}`, noGlow: true}]);
                break;
            case 'open-position':
                const longTarget = stepData.target || this.bots[0]?.name;
                // Spotlight ONLY the LONG button with glow
                this.setSpotlight([
                    `.quick-trade-btn.long[data-target="${longTarget}"]`
                ]);
                break;
            case 'open-short':
                const shortTarget = stepData.target || this.bots[1]?.name;
                // Spotlight ONLY the SHORT button with glow
                this.setSpotlight([
                    `.quick-trade-btn.short[data-target="${shortTarget}"]`
                ]);
                break;
            case 'player-gets-liquidated':
                // Spotlight the target bot's chart to watch for liquidation
                const liqTarget = stepData.target || this.bots[1]?.name;
                this.setSpotlight([
                    {selector: `#card-${liqTarget}`, noGlow: true},
                    {selector: `#positions-sidebar-${liqTarget}`, noGlow: true}
                ]);
                break;
            case 'close-position':
                // Spotlight close button with glow, find the target from current position
                const currentPos = this.positions[0];
                const closeTarget = currentPos ? currentPos.targetName : this.bots[0]?.name;
                this.setSpotlight([
                    '.close-btn-small',
                    {selector: `#card-${closeTarget}`, noGlow: true},
                    {selector: `#positions-sidebar-${closeTarget}`, noGlow: true}
                ]);
                break;
            case 'liquidate-bot':
                // Spotlight cookie with glow, player's card/chart and "On YOU" sidebar without glow
                this.setSpotlight([
                    '#big-cookie',
                    {selector: '#cookie-count', noGlow: true},
                    {selector: '#card-YOU', noGlow: true},
                    {selector: '#positions-sidebar-YOU', noGlow: true}
                ]);
                break;
            case 'defend-against-long':
                // Will be handled by updateDynamicSpotlight
                this.updateDynamicSpotlight();
                break;
            case 'buff-strategy-setup':
                this.setSpotlight(`.lev-btn[data-lev="5"][data-target="${this.bots[0].name}"]`);
                break;
            case 'buff-strategy-stake':
                this.setSpotlight(`#max-btn-${this.bots[0].name}`);
                break;
            case 'buff-strategy-short':
                // Spotlight SHORT button with glow, target's card and sidebar without glow
                this.setSpotlight([
                    `.quick-trade-btn.short[data-target="${this.bots[0].name}"]`,
                    {selector: `#card-${this.bots[0].name}`, noGlow: true},
                    {selector: `#positions-sidebar-${this.bots[0].name}`, noGlow: true}
                ]);
                break;
            case 'buff-strategy-crash':
                this.setSpotlight(`#crash-btn-${this.bots[0].name}`);
                break;
            case 'buff-strategy-close':
                // Spotlight close button with glow, target's card and sidebar without glow
                this.setSpotlight([
                    '.close-btn-small',
                    {selector: `#card-${this.bots[0].name}`, noGlow: true},
                    {selector: `#positions-sidebar-${this.bots[0].name}`, noGlow: true}
                ]);
                break;
            default:
                // No spotlight for unknown actions
                break;
        }
    }
    
    updateHintBox(action) {
        const hintBox = document.getElementById('tutorial-hint-box');
        const hintText = document.getElementById('tutorial-hint-text');
        if (!hintBox || !hintText) return;
        
        // Map actions to clear hint text with specific bot names
        const botName = this.bots[0]?.name || 'CookieBot';
        const botName2 = this.bots[1]?.name || 'ChipMaster';
        const hintMessages = {
            'click': '<span class="action">Click</span> the <span class="target">cookie</span> 10 times',
            'buy-generator': '<span class="action">Buy</span> a <span class="target">generator</span> (Grandma, Farm, or Factory)',
            'buy-click-power': '<span class="action">Buy</span> the <span class="target">Click Power</span> upgrade',
            'set-stake': `<span class="action">Move</span> the <span class="target">stake slider</span> on ${botName} - bet at least 50!`,
            'set-stake-short': `<span class="action">Move</span> the <span class="target">stake slider</span> on ${botName2} - bet at least 50!`,
            'open-position': `<span class="action">LONG</span> <span class="target">${botName}</span> - click the LONG button`,
            'close-position': '<span class="action">Click</span> the <span class="target">Close</span> button on your position',
            'liquidate-bot': '<span class="action">Click the cookie</span> to grow and <span class="target">liquidate CookieBot\'s SHORT</span>',
            'open-short': `<span class="action">SHORT</span> <span class="target">${botName2}</span> - click the SHORT button`,
            'player-gets-liquidated': `<span class="warning">Watch</span> your position on <span class="target">${botName2}</span>...`,
            'defend-against-long': '<span class="action">Buy</span> a <span class="target">generator</span> to liquidate <span class="target">ChipMaster\'s LONG</span>',
            'buff-strategy-setup': `<span class="action">Click</span> the <span class="target">5x leverage</span> button on ${botName}`,
            'buff-strategy-stake': `<span class="action">Click</span> the <span class="target">MAX</span> button on ${botName}`,
            'buff-strategy-short': `<span class="action">SHORT</span> <span class="target">${botName}</span> - click the SHORT button`,
            'buff-strategy-crash': `<span class="action">Click</span> <span class="target">Market Crash</span> ability on ${botName}`,
            'buff-strategy-close': '<span class="action">Click</span> the <span class="target">Close</span> button on your position'
        };
        
        if (action && hintMessages[action]) {
            hintText.innerHTML = hintMessages[action];
            hintBox.classList.add('visible');
        } else {
            hintBox.classList.remove('visible');
        }
    }
    
    advanceTutorial() {
        const stepData = this.tutorialSteps[this.tutorialStep];
        
        // If this step requires an action, check if it's done
        if (stepData.action && !stepData.completed) {
            // Special case: player-gets-liquidated step - trigger the liquidation animation when they click Okay
            if (stepData.action === 'player-gets-liquidated') {
                this.triggerPlayerLiquidation(stepData.target);
                return; // Don't advance yet, the liquidation callback will advance
            }
            
            // Don't advance, hide overlay to let them do the action
            document.getElementById('tutorial-overlay')?.classList.add('hidden');
            
            // Spotlight is already set up by showTutorialStep
            return;
        }
        
        // Move to next step
        if (this.tutorialStep < this.tutorialSteps.length - 1) {
            this.showTutorialStep(this.tutorialStep + 1);
        } else {
            this.completeTutorial();
        }
    }
    
    // Trigger the player liquidation animation - called when player clicks Okay on the liquidation step
    triggerPlayerLiquidation(targetName) {
        const targetBot = this.bots.find(b => b.name === targetName);
        const playerShortPosition = this.positions.find(p => p.targetName === targetName && p.type === 'short');
        
        if (!targetBot || !playerShortPosition) {
            // No position to liquidate, just advance
            this.playerWasLiquidated = true;
            this.tutorialSteps[this.tutorialStep].completed = true;
            this.showTutorialStep(this.tutorialStep + 1);
            return;
        }
        
        // Hide the tutorial overlay so player can watch the chart
        document.getElementById('tutorial-overlay')?.classList.add('hidden');
        
        // Get the liquidation price and stake
        const liquidationPrice = playerShortPosition.liquidationPrice;
        const stake = playerShortPosition.stake;
        const botStartPrice = targetBot.cookies;
        const botEndPrice = Math.ceil(liquidationPrice * 1.05); // Go 5% above liquidation
        const playerStartCookies = this.cookies;
        
        // Animate the bot's cookies rising over 2 seconds
        const duration = 2000;
        const startTime = performance.now();
        let liquidationTriggered = false;
        
        this.showNotification(`⚠️ ${targetBot.name} is surging!`, 'warning');
        
        const animateLiquidation = () => {
            const now = performance.now();
            const elapsed = now - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // Ease-in-out animation
            const eased = progress < 0.5 
                ? 2 * progress * progress 
                : 1 - Math.pow(-2 * progress + 2, 2) / 2;
            
            // Update bot cookies (rising)
            targetBot.cookies = Math.floor(botStartPrice + (botEndPrice - botStartPrice) * eased);
            
            // Check if we've hit liquidation price and trigger the cookie transfer
            if (!liquidationTriggered && targetBot.cookies >= liquidationPrice) {
                liquidationTriggered = true;
                // This is when liquidation happens - player loses stake, bot gains it
                // The actual transfer will happen in checkLiquidations, but we want to show it visually
            }
            
            // Update displays and charts
            this.renderCharts();
            this.updateDisplays();
            
            if (progress < 1) {
                requestAnimationFrame(animateLiquidation);
            } else {
                // Animation complete - now trigger the actual liquidation
                // This will deduct stake from player and add to bot
                this.checkLiquidations();
                this.playerWasLiquidated = true;
                this.tutorialSteps[this.tutorialStep].completed = true;
                
                // Update charts one more time to show the final state
                this.renderCharts();
                this.updateDisplays();
                
                // Wait a moment then show the "You Got Liquidated" step
                setTimeout(() => {
                    this.showTutorialStep(this.tutorialStep + 1);
                }, 800);
            }
        };
        
        requestAnimationFrame(animateLiquidation);
    }
    
    checkTutorialProgress() {
        const stepData = this.tutorialSteps[this.tutorialStep];
        if (!stepData || !stepData.action) return;
        
        let completed = false;
        
        switch (stepData.action) {
            case 'click':
                completed = this.cookies >= stepData.target;
                break;
            case 'buy-generator':
                completed = this.generators[stepData.target] > 0;
                break;
            case 'buy-click-power':
                completed = this.clickPowerLevel > 1;
                break;
            case 'set-stake':
                // Check if stake slider for target is at least minStake
                const stakeSlider = document.getElementById(`slider-${stepData.target}`);
                if (stakeSlider) {
                    completed = parseInt(stakeSlider.value) >= stepData.minStake;
                }
                break;
            case 'set-stake-short':
                // Check if stake slider for target is at least minStake (for short position)
                const stakeSliderShort = document.getElementById(`slider-${stepData.target}`);
                if (stakeSliderShort) {
                    completed = parseInt(stakeSliderShort.value) >= stepData.minStake;
                }
                break;
            case 'open-position':
                completed = this.positions.some(p => p.targetName === stepData.target && p.type === 'long');
                // If just completed, boost the bot so player profits
                if (completed && !this.longPositionBoosted) {
                    this.longPositionBoosted = true;
                    const bot = this.bots.find(b => b.name === stepData.target);
                    if (bot) {
                        // Boost bot by 15% so player sees profit
                        bot.cookies = Math.floor(bot.cookies * 1.15);
                    }
                }
                break;
            case 'open-short':
                completed = this.positions.some(p => p.targetName === stepData.target && p.type === 'short');
                // If just completed, start the liquidation timer
                if (completed && !this.shortPositionOpened) {
                    this.shortPositionOpened = true;
                }
                break;
            case 'player-gets-liquidated':
                // Complete when player's SHORT position on the target is liquidated
                // The position will be removed from this.positions when liquidated
                const hasShortOnTarget = this.positions.some(p => p.targetName === stepData.target && p.type === 'short');
                completed = !hasShortOnTarget && this.playerWasLiquidated;
                break;
            case 'close-position':
                // Complete when ANY position is closed (initial count set when step is shown)
                // If no positions exist, auto-complete (can't close what doesn't exist)
                if (this.closePositionInitialCount === 0 || this.positions.length === 0) {
                    completed = true;
                } else {
                    completed = this.positions.length < this.closePositionInitialCount;
                }
                break;
            case 'bot-shorts-you':
                // This is triggered when the step is shown, auto-complete to move forward
                // The bot shorting happens in showTutorialStep
                completed = this.botPositions.length > 0;
                break;
            case 'bot-longs-you':
                // This is triggered when the step is shown, auto-complete to move forward
                // The bot longing happens in showTutorialStep
                completed = this.botPositions.some(p => p.type === 'long');
                break;
            case 'defend-against-long':
                // Complete when the bot's LONG position is liquidated (no more long positions on player)
                // Track the initial long position count when step is shown
                if (this.defendLongInitialCount === undefined) {
                    this.defendLongInitialCount = this.botPositions.filter(p => p.type === 'long').length;
                }
                const currentLongCount = this.botPositions.filter(p => p.type === 'long').length;
                completed = currentLongCount < this.defendLongInitialCount || currentLongCount === 0;
                break;
            case 'liquidate-bot':
                // Complete when there are no more SHORT positions on the player
                const shortPositions = this.botPositions.filter(p => p.type === 'short');
                completed = shortPositions.length === 0;
                break;
            case 'buff-strategy-setup':
                // Check if 5x is selected (buffs given when step is shown)
                const currentLev = this.targetLeverage[this.bots[0].name] || 2;
                completed = currentLev === 5;
                break;
            case 'buff-strategy-stake':
                // Check if MAX button was clicked (slider is at max value)
                const slider = document.getElementById(`slider-${this.bots[0].name}`);
                const maxBtn = document.getElementById(`max-btn-${this.bots[0].name}`);
                // Complete if MAX is active or stake is high (over 50% of cookies)
                if (maxBtn && maxBtn.classList.contains('active')) {
                    completed = true;
                } else if (slider && parseInt(slider.value) >= Math.floor(this.cookies * 0.5)) {
                    completed = true;
                }
                break;
            case 'buff-strategy-short':
                // Wait for user to open a short position (highlight added in showTutorialStep)
                completed = this.positions.some(p => p.targetName === this.bots[0].name && p.type === 'short');
                break;
            case 'buff-strategy-crash':
                // Wait for user to use market crash (highlight added in showTutorialStep)
                // Check if market crash was used (bot lost 10% cookies)
                completed = this.buffStrategyCrashUsed === true;
                break;
            case 'buff-strategy-close':
                // Wait for user to close the position (highlight added in showTutorialStep)
                if (this.buffStrategyCloseInitialCount === 0 || this.positions.length === 0) {
                    completed = true;
                } else {
                    completed = this.positions.length < this.buffStrategyCloseInitialCount;
                }
                break;
        }
        
        if (completed && !stepData.completed) {
            stepData.completed = true;
            // Reset all trackers for next steps
            this.closePositionInitialCount = undefined;
            this.liquidateBotInitialCount = undefined;
            this.defendLongInitialCount = undefined;
            this.buffStrategyCloseInitialCount = undefined;
            
            // Clear spotlight
            this.clearSpotlight();
            
            // Show next step
            setTimeout(() => {
                this.showTutorialStep(this.tutorialStep + 1);
            }, 500);
        }
    }
    
    completeTutorial() {
        this.tutorialComplete = true;
        this.freePlayMode = true;
        this.freePlayGoal = 10000;
        
        // Clear spotlight
        this.clearSpotlight();
        
        // Hide tutorial elements
        document.getElementById('tutorial-overlay')?.classList.add('hidden');
        document.getElementById('tutorial-progress')?.remove();
        document.getElementById('skip-tutorial')?.remove();
        document.getElementById('tutorial-hint-box')?.classList.remove('visible');
        
        // Show free play goal notification
        this.showNotification('🎮 Free Play! Race to 10,000 cookies to win!', 'success');
        
        // Start checking for win condition
        this.checkFreePlayWin();
    }
    
    checkFreePlayWin() {
        if (!this.freePlayMode) return;
        
        // Check if player won
        if (this.cookies >= this.freePlayGoal) {
            this.freePlayMode = false;
            this.showNotification('🏆 YOU WIN! You reached 10,000 cookies!', 'success');
            
            // Show victory screen
            const victory = document.getElementById('victory');
            if (victory) {
                const victoryText = victory.querySelector('h2');
                if (victoryText) {
                    victoryText.textContent = '🏆 You Win!';
                }
                const victorySubtext = victory.querySelector('p');
                if (victorySubtext) {
                    victorySubtext.textContent = `You reached ${Math.floor(this.cookies).toLocaleString()} cookies first!`;
                }
                victory.classList.add('show');
            }
            return;
        }
        
        // Check if any bot won
        for (const bot of this.bots) {
            if (bot.cookies >= this.freePlayGoal) {
                this.freePlayMode = false;
                this.showNotification(`💀 ${bot.name} reached 10,000 cookies first!`, 'error');
                
                // Show defeat screen
                const victory = document.getElementById('victory');
                if (victory) {
                    const victoryText = victory.querySelector('h2');
                    if (victoryText) {
                        victoryText.textContent = '💀 You Lose!';
                    }
                    const victorySubtext = victory.querySelector('p');
                    if (victorySubtext) {
                        victorySubtext.textContent = `${bot.name} reached ${Math.floor(bot.cookies).toLocaleString()} cookies first!`;
                    }
                    victory.classList.add('show');
                }
                return;
            }
        }
        
        // Keep checking
        requestAnimationFrame(() => this.checkFreePlayWin());
    }
}

// Initialize tutorial
let tutorial;
document.addEventListener('DOMContentLoaded', () => {
    tutorial = new TutorialGame();
    window.tutorial = tutorial; // Expose for close button onclick
});

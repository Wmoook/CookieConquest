// Cookie Conquest - Interactive Tutorial System
// Uses SVG graphics, no emojis
// Features: Cookie Stock Market with LONG/SHORT trading
// GOAL: First to 1 Million Cookies WINS!

class TutorialManager {
    constructor() {
        this.currentStep = 0;
        this.isActive = false;
        this.gameInterval = null;
        this.gameEnded = false; // Win condition flag
        
        // Game state
        this.playerCookies = 0;
        this.playerCPS = 0;
        this.playerClicks = 0;
        this.generators = { grandma: 0, bakery: 0, factory: 0 };
        
        // Click speed tracking (for exponential display)
        this.clickTimes = [];
        this.currentCPS = 0; // Clicks per second
        this.clickMultiplier = 1;
        
        // Round timing (60 second rounds)
        this.roundTime = 60;
        this.roundRemaining = 60;
        
        // ==================== COOKIE STOCK MARKET ====================
        // Chart data - tracks cookie velocity over time
        this.playerChartData = [];  // Array of {time, velocity} for last 60 seconds
        this.botChartData = [];
        this.chartMaxPoints = 60;
        
        // Player's market manipulation (PUMP/DUMP)
        this.playerManipulation = {
            active: false,
            type: null,       // 'pump' or 'dump'
            duration: 30,     // 30 second manipulation window
            timeRemaining: 0,
            fakeVelocity: 0   // Added/subtracted velocity shown on chart
        };
        
        // Bot's market manipulation (legacy - matches player manipulation structure)
        this.botManipulation = {
            pump: { active: false, multiplier: 1.5, timeRemaining: 0 },
            dump: { active: false, multiplier: 0.5, timeRemaining: 0 }
        };
        
        // Trading positions
        this.playerPositions = {
            onBot: null  // { type: 'long'/'short', stake: X, entryVelocity: Y, timeRemaining: 30 }
        };
        this.botPositions = {
            onPlayer: null
        };
        
        // Active shorts/longs against player (for display)
        this.activeShortsOnPlayer = 0;
        this.activeLongsOnPlayer = 0;
        
        // Trading cooldown
        this.tradeCooldown = 0;
        this.tradeBaseCooldown = 10;
        
        // Manipulation cooldown
        this.manipulationCooldown = 0;
        this.manipulationBaseCooldown = 45;
        
        // Player's cookie history for chart (total cookies over time)
        this.cookieHistory = [0];
        
        // FULL HISTORY - Store all data from start for zoom out (DEX Screener style)
        this.fullCookieHistory = [0];
        
        // Player's velocity history (for trading calculations)
        this.velocityHistory = [0, 0.1, 0.2, 0.1, 0, 0.1, 0.2, 0.3, 0.2, 0.1];
        this.fullVelocityHistory = [0, 0.1, 0.2, 0.1, 0, 0.1, 0.2, 0.3, 0.2, 0.1];
        
        // Chart viewport state - DEX Screener style pan/zoom
        // viewStart = index in full history where viewport starts (0 = beginning of time)
        // viewEnd = index where viewport ends (null = follow live/latest)
        // When viewEnd is null, chart auto-scrolls to follow new data
        this.chartViewport = {
            you: { viewStart: 0, viewEnd: null, zoom: 1, isDragging: false, lastX: 0 },
            bot1: { viewStart: 0, viewEnd: null, zoom: 1, isDragging: false, lastX: 0 },
            bot2: { viewStart: 0, viewEnd: null, zoom: 1, isDragging: false, lastX: 0 },
            bot3: { viewStart: 0, viewEnd: null, zoom: 1, isDragging: false, lastX: 0 }
        };
        
        // Trading cooldowns (for pump/dump)
        this.tradingCooldowns = {
            pump: 0,
            dump: 0
        };
        
        // ========== NEW TRADING SYSTEM ==========
        // Active positions (can have multiple)
        this.activePositions = []; // { botIndex, type: 'long'/'short', stake, leverage, entryVelocity, currentPnl }
        this.totalPnl = 0;
        this.isBankrupt = false;
        this.selectedLeverage = 2;
        
        // Bot positions ON PLAYER (bots can trade against you!)
        this.botPositionsOnPlayer = []; // { botIndex, botName, type: 'long'/'short', stake, leverage, entryPrice }
        
        // Bot vs Bot positions (bots trade each other too!)
        this.botVsBotPositions = []; // { traderIndex, traderName, targetIndex, targetName, type, stake, leverage, entryPrice }
        
        // Trade modal state
        this.pendingTrade = null; // { botIndex, type }
        
        // Market manipulation (PUMP/DUMP on YOUR chart)
        this.manipulation = {
            pump: { active: false, timeRemaining: 0, cooldown: 0 },
            dump: { active: false, timeRemaining: 0, cooldown: 0 }
        };
        
        // 3 Bot opponents for 4-player game
        // Initialize with cookie history so charts display immediately
        this.bots = [
            { 
                name: 'ChefBot', 
                cookies: 0, 
                cps: 1, 
                displayedCookies: 0,
                color: '#e74c3c',
                cookieHistory: [0],  // Track total cookies over time
                fullCookieHistory: [0],  // Full history for zoom out
                velocityHistory: [1, 1.2, 0.9, 1.1, 1, 1.3, 0.8, 1.2, 1.1, 1],
                fullVelocityHistory: [1, 1.2, 0.9, 1.1, 1, 1.3, 0.8, 1.2, 1.1, 1],
                currentVelocity: 1,
                manipulation: { pump: { active: false, multiplier: 1.5, timeRemaining: 0 }, dump: { active: false, multiplier: 0.5, timeRemaining: 0 } }
            },
            { 
                name: 'BakerBot', 
                cookies: 0, 
                cps: 2, 
                displayedCookies: 0,
                color: '#3498db',
                cookieHistory: [0],  // Track total cookies over time
                fullCookieHistory: [0],  // Full history for zoom out
                velocityHistory: [2, 2.3, 1.8, 2.1, 2, 2.4, 1.9, 2.2, 2.1, 2],
                fullVelocityHistory: [2, 2.3, 1.8, 2.1, 2, 2.4, 1.9, 2.2, 2.1, 2],
                currentVelocity: 2,
                manipulation: { pump: { active: false, multiplier: 1.5, timeRemaining: 0 }, dump: { active: false, multiplier: 0.5, timeRemaining: 0 } }
            },
            { 
                name: 'CookieBot', 
                cookies: 0, 
                cps: 1, 
                displayedCookies: 0,
                color: '#9b59b6',
                cookieHistory: [0],  // Track total cookies over time
                fullCookieHistory: [0],  // Full history for zoom out
                velocityHistory: [1, 1.1, 0.9, 1.2, 1, 1.1, 0.8, 1.3, 1.0, 1],
                fullVelocityHistory: [1, 1.1, 0.9, 1.2, 1, 1.1, 0.8, 1.3, 1.0, 1],
                currentVelocity: 1,
                manipulation: { pump: { active: false, multiplier: 1.5, timeRemaining: 0 }, dump: { active: false, multiplier: 0.5, timeRemaining: 0 } }
            }
        ];
        
        // Selected target for trading (which bot to LONG/SHORT)
        this.selectedTarget = 0; // Index of selected bot
        
        // Legacy bot state (for compatibility)
        this.botCookies = 0;
        this.botCPS = 1;
        this.botRealVelocity = 1;
        this.botDisplayedVelocity = 1;
        this.botDisplayedCookies = 0;
        this.lastBotCookies = 0;
        this.botSpikeVisible = false;
        this.botHasShield = false;
        
        // Bot bluff state (legacy support - mostly unused now)
        this.botBluff = { active: false, type: null, timeRemaining: 0 };
        
        // Player bluff state (legacy support - mostly unused now)
        this.playerBluff = {
            active: false,
            type: null,
            startTime: null,
            timeRemaining: 0,
            successful: true
        };
        this.displayedCookies = 0;
        this.bluffTimerInterval = null;
        this.bluffDuration = 30;
        
        // Player velocity
        this.playerRealVelocity = 0;
        this.playerDisplayedVelocity = 0;
        
        // REMOVED: Sabotage system (deprecated)
        // REMOVED: Defense system (deprecated)
        
        // SVG icons
        this.icons = {
            arrow: `<svg viewBox="0 0 24 24" fill="#F6D49B"><path d="M12 2L6 8h4v14h4V8h4L12 2z"/></svg>`,
            robot: `<svg viewBox="0 0 24 24"><path d="M12 2a2 2 0 012 2v1h4a2 2 0 012 2v10a2 2 0 01-2 2h-4v1a2 2 0 01-4 0v-1H6a2 2 0 01-2-2V7a2 2 0 012-2h4V4a2 2 0 012-2zm-3 8a1.5 1.5 0 100 3 1.5 1.5 0 000-3zm6 0a1.5 1.5 0 100 3 1.5 1.5 0 000-3zm-5 6h4v2h-4v-2z"/></svg>`,
            cookie: `<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="45" fill="#D2691E"/><circle cx="50" cy="50" r="42" fill="#CD853F"/><circle cx="30" cy="35" r="6" fill="#5D3A1A"/><circle cx="55" cy="25" r="5" fill="#5D3A1A"/><circle cx="70" cy="45" r="6" fill="#5D3A1A"/><circle cx="60" cy="65" r="5" fill="#5D3A1A"/><circle cx="35" cy="60" r="6" fill="#5D3A1A"/><circle cx="25" cy="50" r="4" fill="#5D3A1A"/></svg>`
        };
        
        // Tutorial steps removed - go straight to gameplay
        this.steps = [];
    }
    
    init() {
        this.createUI();
        this.createStockMarketUI();
        this.bindEvents();
        this.setupResizeHandler();
        this.start();
        
        // Start chart system AFTER everything else is ready
        const self = this;
        setTimeout(function() {
            self.initChartSystem();
        }, 500);
    }
    
    // ==================== SMOOTH CHART SYSTEM - DEX SCREENER STYLE ====================
    initChartSystem() {
        console.log('=== INITIALIZING DEX-STYLE CHARTS ===');
        
        // Chart state for smooth animations
        this.chartState = {
            you: { smoothData: [], lastUpdate: 0 },
            bot1: { smoothData: [], lastUpdate: 0 },
            bot2: { smoothData: [], lastUpdate: 0 },
            bot3: { smoothData: [], lastUpdate: 0 }
        };
        
        // Smooth display values for cookie counts (animated counters)
        this.displayValues = {
            playerCookies: 0,
            bot0Cookies: 0,
            bot1Cookies: 0,
            bot2Cookies: 0
        };
        
        // Set up canvases to fill their containers
        this.resizeCharts();
        window.addEventListener('resize', () => this.resizeCharts());
        
        // Start smooth animation loop at 60fps
        this.lastChartTime = performance.now();
        this.animateCharts();
    }
    
    resizeCharts() {
        const canvases = document.querySelectorAll('.chart-canvas');
        canvases.forEach(canvas => {
            const container = canvas.parentElement;
            if (container) {
                // Use container size for crisp rendering
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
    
    // Update chart data at high frequency for smooth charts
    updateChartData() {
        // Player chart data
        const playerVelocity = this.playerCPS + this.currentCPS;
        
        // Update cookie history (keep 1000 points for ultra-smooth display at 20 points/sec = 50 seconds visible)
        this.cookieHistory.push(this.playerCookies);
        if (this.cookieHistory.length > 1000) this.cookieHistory.shift();
        
        this.fullCookieHistory.push(this.playerCookies);
        
        this.velocityHistory.push(playerVelocity);
        if (this.velocityHistory.length > 1000) this.velocityHistory.shift();
        this.fullVelocityHistory.push(playerVelocity);
        
        // Bot chart data
        if (this.bots) {
            this.bots.forEach(bot => {
                bot.cookieHistory.push(bot.cookies);
                if (bot.cookieHistory.length > 1000) bot.cookieHistory.shift();
                bot.fullCookieHistory.push(bot.cookies);
                
                const botVel = bot.cps + (bot.clicksThisTick || 0) + (Math.random() * 0.5);
                bot.velocityHistory.push(botVel);
                if (bot.velocityHistory.length > 1000) bot.velocityHistory.shift();
                bot.fullVelocityHistory.push(botVel);
            });
        }
    }
    
    animateCharts() {
        const now = performance.now();
        const dt = (now - this.lastChartTime) / 1000;
        this.lastChartTime = now;
        
        // Smooth interpolation factor (higher = smoother but slower)
        const smoothFactor = Math.min(1, dt * 6);
        
        // Smooth cookie display values
        if (this.displayValues) {
            const playerUnrealizedPnl = this.calculateUnrealizedPnl();
            const targetPlayerCookies = this.playerCookies + playerUnrealizedPnl;
            this.displayValues.playerCookies += (targetPlayerCookies - this.displayValues.playerCookies) * smoothFactor;
            
            if (this.bots) {
                this.bots.forEach((bot, i) => {
                    const botUnrealizedPnl = this.calculateBotUnrealizedPnl(i);
                    const targetBotCookies = bot.cookies + botUnrealizedPnl;
                    const key = `bot${i}Cookies`;
                    this.displayValues[key] += (targetBotCookies - this.displayValues[key]) * smoothFactor;
                });
            }
            
            // Update smooth sidebar cookie display
            this.updateSmoothDisplays();
        }
        
        // Get viewport data for each chart - DEX Screener style
        // IMPORTANT: We pass the viewport data directly to render now
        const youVP = this.getViewportData('you');
        this.updateSmoothData('you', youVP.data, dt, youVP.isLive);
        
        // Use smooth display value for player
        const smoothPlayerCookies = this.displayValues ? this.displayValues.playerCookies : this.playerCookies;
        this.renderSmoothChart('chart-you', this.chartState.you.smoothData, '#2ecc71', 'you', smoothPlayerCookies, this.velocityHistory, -1, youVP);
        
        if (this.bots) {
            this.bots.forEach((bot, i) => {
                const chartId = 'bot' + (i+1);
                const botVP = this.getViewportData(chartId);
                this.updateSmoothData(chartId, botVP.data, dt, botVP.isLive);
                
                // Use smooth display value for bot
                const smoothBotCookies = this.displayValues ? this.displayValues[`bot${i}Cookies`] : bot.cookies;
                this.renderSmoothChart('chart-' + chartId, this.chartState[chartId].smoothData, bot.color, chartId, smoothBotCookies, bot.velocityHistory, i, botVP);
            });
        }
        
        requestAnimationFrame(() => this.animateCharts());
    }
    
    updateSmoothData(id, rawData, dt, isLive) {
        const state = this.chartState[id];
        if (!state) return;
        
        // Use all viewport data
        const targetData = rawData || [];
        
        // If viewing historical data (not live), skip smoothing for responsiveness
        if (!isLive) {
            state.smoothData = [...targetData];
            return;
        }
        
        // Initialize smooth data if empty
        if (state.smoothData.length === 0 && targetData.length > 0) {
            state.smoothData = [...targetData];
        }
        
        // Interpolate towards target data (smooth easing)
        // dt * 8 = responsive, dt * 2 = very smooth
        const lerp = Math.min(1, dt * 10);
        
        // Match array lengths smoothly
        while (state.smoothData.length < targetData.length) {
            // When adding new points, interpolate from previous value
            const prevVal = state.smoothData.length > 0 ? state.smoothData[state.smoothData.length - 1] : targetData[state.smoothData.length];
            state.smoothData.push(prevVal);
        }
        // When removing points, just shift (data scrolls left)
        while (state.smoothData.length > targetData.length) {
            state.smoothData.shift();
        }
        
        // Smooth interpolation for all points
        for (let i = 0; i < state.smoothData.length && i < targetData.length; i++) {
            state.smoothData[i] += (targetData[i] - state.smoothData[i]) * lerp;
        }
    }
    
    renderSmoothChart(canvasId, data, color, labelId, totalCookies, velocityData, botIndex, viewport) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        const W = canvas.width / window.devicePixelRatio;
        const H = canvas.height / window.devicePixelRatio;
        
        // Reserve space for Y-axis labels
        const MARGIN_LEFT = 45;
        const CHART_W = W - MARGIN_LEFT;
        
        // Clear
        ctx.clearRect(0, 0, W, H);
        
        // Background gradient
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
        
        // Calculate bounds with padding
        let min = Math.min(...data);
        let max = Math.max(...data);
        const padding = (max - min) * 0.15 || 10;
        min = Math.max(0, min - padding);
        max += padding;
        const range = max - min || 1;
        
        // === DRAW Y-AXIS PRICE LABELS ===
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.font = '10px Arial';
        ctx.textAlign = 'right';
        
        // Draw 5 price levels
        for (let i = 0; i <= 4; i++) {
            const price = min + (range * (4 - i) / 4);
            const y = (i / 4) * H;
            
            // Format price
            let priceText;
            if (price >= 10000) {
                priceText = (price / 1000).toFixed(1) + 'K';
            } else if (price >= 1000) {
                priceText = (price / 1000).toFixed(2) + 'K';
            } else {
                priceText = Math.floor(price).toString();
            }
            
            // Draw label
            ctx.fillStyle = 'rgba(255,255,255,0.5)';
            ctx.fillText(priceText, MARGIN_LEFT - 5, y + 4);
            
            // Draw grid line
            ctx.strokeStyle = 'rgba(255,255,255,0.08)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(MARGIN_LEFT, y);
            ctx.lineTo(W, y);
            ctx.stroke();
        }
        
        // Draw Y-axis line
        ctx.strokeStyle = 'rgba(255,255,255,0.2)';
        ctx.beginPath();
        ctx.moveTo(MARGIN_LEFT, 0);
        ctx.lineTo(MARGIN_LEFT, H);
        ctx.stroke();
        
        // === DRAW LIQUIDATION HEATMAP ZONES ===
        if (botIndex >= 0 && this.activePositions) {
            const position = this.activePositions.find(p => p.botIndex === botIndex);
            if (position && position.liquidationPrice) {
                // Calculate Y position for liquidation price
                const liqY = H - ((position.liquidationPrice - min) / range) * H;
                const entryY = H - ((position.entryPrice - min) / range) * H;
                
                // Draw liquidation zone (danger area)
                if (position.type === 'long') {
                    // For longs, danger zone is BELOW liquidation price
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
                    // For shorts, danger zone is ABOVE liquidation price
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
                
                // Draw liquidation line
                ctx.setLineDash([4, 4]);
                ctx.strokeStyle = '#e74c3c';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(MARGIN_LEFT, liqY);
                ctx.lineTo(W, liqY);
                ctx.stroke();
                
                // Liquidation label (on right side now)
                ctx.fillStyle = '#e74c3c';
                ctx.font = 'bold 9px Arial';
                ctx.fillText('💀 LIQ', W - 45, liqY - 3);
                
                // Draw entry price line
                ctx.strokeStyle = '#f39c12';
                ctx.beginPath();
                ctx.moveTo(MARGIN_LEFT, entryY);
                ctx.lineTo(W, entryY);
                ctx.stroke();
                
                // Entry label (on right side)
                ctx.fillStyle = '#f39c12';
                ctx.fillText('ENTRY', W - 38, entryY - 3);
                
                ctx.setLineDash([]);
            }
        }
        
        // Calculate points (offset by left margin)
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
        
        // Draw smooth line with glow
        ctx.shadowColor = color;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.strokeStyle = color;
        ctx.lineWidth = 2.5;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        
        // Use bezier curves for smoothness
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
        
        // Only show pulsing dot if we're viewing LIVE data
        const isLive = viewport && viewport.isLive;
        
        if (isLive) {
            // Pulsing dot at end
            const lastPoint = points[points.length - 1];
            const pulse = Math.sin(performance.now() / 200) * 0.3 + 1;
            
            // Outer glow
            ctx.beginPath();
            ctx.arc(lastPoint.x, lastPoint.y, 8 * pulse, 0, Math.PI * 2);
            ctx.fillStyle = color + '30';
            ctx.fill();
            
            // Inner dot
            ctx.beginPath();
            ctx.arc(lastPoint.x, lastPoint.y, 4, 0, Math.PI * 2);
            ctx.fillStyle = color;
            ctx.fill();
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 1.5;
            ctx.stroke();
        }
        
        // Draw LIVE indicator or time range indicator (top right of chart area)
        if (viewport) {
            ctx.font = 'bold 9px Arial';
            if (isLive) {
                // LIVE badge
                ctx.fillStyle = '#e74c3c';
                ctx.fillRect(W - 35, 4, 32, 14);
                ctx.fillStyle = '#fff';
                ctx.fillText('LIVE', W - 30, 14);
            } else {
                // Historical view - show range
                ctx.fillStyle = 'rgba(100,200,255,0.8)';
                ctx.fillRect(W - 55, 4, 52, 14);
                ctx.fillStyle = '#fff';
                ctx.fillText('HISTORY', W - 52, 14);
            }
            
            // Show total data points in bottom left (in chart area)
            ctx.fillStyle = 'rgba(255,255,255,0.4)';
            ctx.font = '8px Arial';
            ctx.textAlign = 'left';
            ctx.fillText(`${viewport.fullLen} pts`, MARGIN_LEFT + 4, H - 4);
        }
        
        // Update DEX-style UI elements
        // Chart shows COOKIE COUNT, so calculate percentage gain
        const currentCookies = data[data.length - 1] || 0;
        const oldCookies = data.length > 5 ? data[data.length - 5] : data[0];
        const pctChange = oldCookies > 0 ? ((currentCookies - oldCookies) / oldCookies) * 100 : 0;
        
        // Price display - show total cookies formatted nicely
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
        
        // Change badge - percentage change in cookies
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
        
        // Velocity display in header - show actual cookies per second rate
        const velEl = document.getElementById('vel-' + labelId);
        if (velEl && velocityData && velocityData.length > 0) {
            const currentVel = velocityData[velocityData.length - 1] || 0;
            velEl.textContent = '+' + currentVel.toFixed(1) + '/s';
            velEl.className = 'stat-velocity up'; // Always green since it's a rate
        }
        
        // Total cookies display (header stat)
        const scoreEl = document.getElementById(labelId === 'you' ? 'your-score' : labelId + '-score');
        if (scoreEl) {
            if (totalCookies >= 10000) {
                scoreEl.textContent = (totalCookies / 1000).toFixed(1) + 'K 🍪';
            } else if (totalCookies >= 1000) {
                scoreEl.textContent = (totalCookies / 1000).toFixed(2) + 'K 🍪';
            } else {
                scoreEl.textContent = Math.floor(totalCookies) + ' 🍪';
            }
        }
        
        // Update locked margin display for player
        if (labelId === 'you') {
            this.updateLockedMarginDisplay();
        }
    }
    
    // Legacy functions - kept empty for compatibility
    renderAllCharts() {}
    drawSimpleChart() {}

    createUI() {
        // Tutorial dialog removed - no step-by-step messages
        // Just create highlight and arrow for potential future use
        
        // Highlight ring (hidden by default)
        const highlight = document.createElement('div');
        highlight.id = 'tutorial-highlight';
        highlight.className = 'tutorial-highlight';
        highlight.style.display = 'none';
        document.body.appendChild(highlight);
        
        // Arrow pointer (hidden by default)
        const arrow = document.createElement('div');
        arrow.id = 'tutorial-arrow';
        arrow.className = 'tutorial-arrow';
        arrow.style.display = 'none';
        arrow.innerHTML = this.icons.arrow;
        document.body.appendChild(arrow);
        
        // REMOVED: Legacy bot-display UI (now using charts in scoreboard)
    }
    
    bindEvents() {
        // Tutorial dialog buttons removed - no step-by-step anymore
        
        // Cookie click
        const cookie = document.getElementById('big-cookie');
        if (cookie) {
            cookie.addEventListener('click', (e) => this.handleCookieClick(e));
        }
        
        // Tab clicks
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => this.handleTabClick(btn.dataset.tab));
        });
        
        // Generator clicks
        document.querySelectorAll('.generator-btn').forEach(btn => {
            btn.addEventListener('click', () => this.handleGeneratorClick(btn.dataset.generator));
        });
        
        // REMOVED: Bluff, Cookie Call, Sabotage, Defense buttons (deprecated systems)
    }
    
    // ==================== DEPRECATED SYSTEMS REMOVED ====================
    // Sabotage, Defense, Bluff, and Cookie Call systems have been removed
    // The game now focuses on the Cookie Stock Market (LONG/SHORT trading)
    
    showBotReaction(message) {
        // Legacy function - bot-display removed, just show notification instead
        this.showNotification(`Bot: ${message}`, 'info');
    }
    
    start() {
        this.isActive = true;
        // No tutorial steps - just start playing
        this.startGameLoop();
    }
    
    startGameLoop() {
        // Track time for accurate CPS calculation
        this.lastCpsTime = performance.now();
        this.lastChartDataTime = performance.now();
        this.chartDataInterval = 50; // Add new data point every 50ms (20 points per second)
        
        // High-frequency CPS loop (runs at 60fps for smooth cookie accumulation)
        this.cpsInterval = setInterval(() => {
            const now = performance.now();
            const dt = (now - this.lastCpsTime) / 1000; // Delta time in seconds
            this.lastCpsTime = now;
            
            // Apply player CPS smoothly (fractional cookies per frame)
            if (this.playerCPS > 0) {
                this.playerCookies += this.playerCPS * dt;
            }
            
            // Apply bot CPS smoothly
            if (this.bots) {
                this.bots.forEach(bot => {
                    if (bot.cps > 0) {
                        bot.cookies += bot.cps * dt;
                    }
                });
            }
            
            // Update chart data more frequently for smoother charts
            if (now - this.lastChartDataTime >= this.chartDataInterval) {
                this.lastChartDataTime = now;
                this.updateChartData();
            }
        }, 16); // ~60fps for smooth accumulation
        
        // Main game loop (every 500ms for game logic updates)
        this.gameInterval = setInterval(() => {
            // CPS now applied continuously above, not here
            // Chart data also updated continuously above
            
            // Calculate click speed (exponential bonus display)
            this.updateClickSpeed();
            
            // ========== STOCK MARKET VELOCITY TRACKING ==========
            // Calculate current velocity (cookies per second)
            let playerVelocity = this.playerCPS + this.currentCPS; // CPS + click rate
            let botVelocity = this.botCPS + (Math.random() * 2); // Bot CPS + simulated clicks
            
            // Apply manipulation effects
            if (this.manipulation.pump.active) {
                playerVelocity *= this.manipulation.pump.multiplier;
                this.manipulation.pump.timeRemaining--;
                if (this.manipulation.pump.timeRemaining <= 0) {
                    this.manipulation.pump.active = false;
                    this.showNotification('PUMP ended!', 'info');
                }
            }
            if (this.manipulation.dump.active) {
                playerVelocity *= this.manipulation.dump.multiplier;
                this.manipulation.dump.timeRemaining--;
                if (this.manipulation.dump.timeRemaining <= 0) {
                    this.manipulation.dump.active = false;
                    this.showNotification('DUMP ended!', 'info');
                }
            }
            
            // Bot manipulation (random)
            if (this.botManipulation.pump.active) {
                botVelocity *= this.botManipulation.pump.multiplier;
                this.botManipulation.pump.timeRemaining--;
                if (this.botManipulation.pump.timeRemaining <= 0) {
                    this.botManipulation.pump.active = false;
                }
            }
            if (this.botManipulation.dump.active) {
                botVelocity *= this.botManipulation.dump.multiplier;
                this.botManipulation.dump.timeRemaining--;
                if (this.botManipulation.dump.timeRemaining <= 0) {
                    this.botManipulation.dump.active = false;
                }
            }
            
            // Chart data now updated in high-frequency loop via updateChartData()
            
            // === CHECK LIQUIDATIONS ===
            this.checkLiquidations();
            
            // === CHECK WIN CONDITION - First to 1 Million Cookies! ===
            this.checkWinCondition();
            
            // Update positions panel and card indicators
            this.updatePositionsPanel();
            this.updateCardPositions();
            
            // Update displayed cookies if bluffing (legacy)
            if (this.playerBluff.active) {
                const adjustment = Math.floor(this.playerCookies * 0.5);
                if (this.playerBluff.type === 'inflate') {
                    this.displayedCookies = this.playerCookies + adjustment;
                } else if (this.playerBluff.type === 'deflate') {
                    this.displayedCookies = Math.max(0, this.playerCookies - adjustment);
                } else {
                    this.displayedCookies = this.playerCookies;
                }
            } else {
                this.displayedCookies = this.playerCookies;
            }
            
            // Reduce trading cooldowns only (sabotage/defense removed)
            Object.keys(this.tradingCooldowns).forEach(key => {
                if (this.tradingCooldowns[key] > 0) this.tradingCooldowns[key]--;
            });
            
            // Update trading UI
            this.updateTradingUI();
            
            // ========== UPDATE ALL 3 BOTS - SMART AI ==========
            this.bots.forEach((bot, index) => {
                // === BOT CLICKING - Simulates actual clicks ===
                // Each bot has different click patterns based on personality
                const personalities = [
                    { clickRate: 3, burstChance: 0.1, upgradeThreshold: 15 },   // ChefBot - steady clicker
                    { clickRate: 5, burstChance: 0.15, upgradeThreshold: 25 },  // BakerBot - fast clicker
                    { clickRate: 2, burstChance: 0.2, upgradeThreshold: 10 }    // CookieBot - burst clicker
                ];
                const personality = personalities[index] || personalities[0];
                
                // Simulate clicking (random clicks per tick based on personality)
                let clicksThisTick = Math.floor(Math.random() * personality.clickRate) + 1;
                
                // Burst clicking - sometimes bots go crazy
                if (Math.random() < personality.burstChance) {
                    clicksThisTick += Math.floor(Math.random() * 8) + 5;
                    bot.isBursting = true;
                } else {
                    bot.isBursting = false;
                }
                
                // Add cookies from clicks (CPS is now applied continuously in cpsInterval)
                bot.cookies += clicksThisTick;
                bot.clicksThisTick = clicksThisTick;
                
                // CPS is now applied smoothly in the high-frequency cpsInterval loop
                // (removed: bot.cookies += bot.cps * 0.5)
                
                // === SMART UPGRADES ===
                // Bots buy upgrades when they have enough cookies
                if (bot.cookies >= personality.upgradeThreshold && Math.random() < 0.15) {
                    const upgradeCost = Math.floor(personality.upgradeThreshold * (1 + bot.cps * 0.5));
                    if (bot.cookies >= upgradeCost) {
                        bot.cookies -= upgradeCost;
                        bot.cps += 1;
                        // Small notification for bot upgrades (optional visual feedback)
                    }
                }
                
                // === VELOCITY CALCULATION ===
                // Velocity = CPS + click rate + some randomness
                let botVel = bot.cps + clicksThisTick + (Math.random() * 1.5 - 0.5);
                
                // Clamp to reasonable values
                botVel = Math.max(0.5, botVel);
                
                // Bot manipulation effects
                if (bot.manipulation.pump.active) {
                    botVel *= 1.5;
                    bot.manipulation.pump.timeRemaining--;
                    if (bot.manipulation.pump.timeRemaining <= 0) {
                        bot.manipulation.pump.active = false;
                    }
                }
                if (bot.manipulation.dump.active) {
                    botVel *= 0.5;
                    bot.manipulation.dump.timeRemaining--;
                    if (bot.manipulation.dump.timeRemaining <= 0) {
                        bot.manipulation.dump.active = false;
                    }
                }
                
                // Store current velocity for trading calculations
                bot.currentVelocity = botVel;
                // Chart data now updated in high-frequency updateChartData()
                
                // === SMART MANIPULATION ===
                // Bots strategically pump/dump based on situation
                if (!bot.manipulation.pump.active && !bot.manipulation.dump.active) {
                    // Check if player is watching (has position on this bot)
                    const playerHasPosition = this.activePositions.some(p => p.botIndex === index);
                    
                    if (playerHasPosition) {
                        // If player is LONG on us, we might DUMP to hurt them
                        const playerPosition = this.activePositions.find(p => p.botIndex === index);
                        if (playerPosition && playerPosition.type === 'long' && Math.random() < 0.08) {
                            bot.manipulation.dump = { active: true, multiplier: 0.5, timeRemaining: 10 };
                        }
                        // If player is SHORT on us, we might PUMP to hurt them  
                        else if (playerPosition && playerPosition.type === 'short' && Math.random() < 0.08) {
                            bot.manipulation.pump = { active: true, multiplier: 1.5, timeRemaining: 10 };
                        }
                    } else {
                        // Random manipulation when no pressure
                        if (Math.random() < 0.02) {
                            if (Math.random() < 0.6) {
                                bot.manipulation.pump = { active: true, multiplier: 1.5, timeRemaining: 8 };
                            } else {
                                bot.manipulation.dump = { active: true, multiplier: 0.5, timeRemaining: 6 };
                            }
                        }
                    }
                }
                
                // === BOT TRADING ON PLAYER ===
                // Each bot might open a position on the player
                const existingBotPosition = this.botPositionsOnPlayer.find(p => p.botIndex === index);
                
                if (!existingBotPosition && bot.cookies >= 50 && Math.random() < 0.02) {
                    // Bot decides to trade on player!
                    const tradeType = Math.random() < 0.5 ? 'long' : 'short';
                    const stake = Math.floor(bot.cookies * (0.1 + Math.random() * 0.15)); // 10-25% of cookies
                    const leverage = Math.floor(Math.random() * 5) + 1; // 1-5x leverage
                    
                    this.botPositionsOnPlayer.push({
                        botIndex: index,
                        botName: bot.name,
                        botColor: bot.color,
                        type: tradeType,
                        stake: stake,
                        leverage: leverage,
                        entryPrice: this.playerCookies
                    });
                    
                    // Notify player that someone opened a position on them!
                    this.showNotification(`👁️ ${bot.name} opened a position on YOU!`, 'warning');
                }
                
                // Check and close bot positions on player
                this.checkBotPositionsOnPlayer(index, bot);
                
                // === BOT VS BOT TRADING ===
                // Bots might trade on other bots too!
                const hasPositionOnOtherBot = this.botVsBotPositions.some(p => p.traderIndex === index);
                if (!hasPositionOnOtherBot && bot.cookies >= 100 && Math.random() < 0.015) {
                    // Pick a random other bot to trade on
                    const otherBots = this.bots.filter((_, i) => i !== index);
                    const targetBot = otherBots[Math.floor(Math.random() * otherBots.length)];
                    const targetIndex = this.bots.indexOf(targetBot);
                    
                    const tradeType = Math.random() < 0.5 ? 'long' : 'short';
                    const stake = Math.floor(bot.cookies * (0.05 + Math.random() * 0.1)); // 5-15% of cookies
                    const leverage = Math.floor(Math.random() * 3) + 1; // 1-3x leverage
                    
                    this.botVsBotPositions.push({
                        traderIndex: index,
                        traderName: bot.name,
                        targetIndex: targetIndex,
                        targetName: targetBot.name,
                        type: tradeType,
                        stake: stake,
                        leverage: leverage,
                        entryPrice: targetBot.cookies
                    });
                }
                
                // Check and close bot vs bot positions
                this.checkBotVsBotPositions();
                
                bot.displayedCookies = bot.cookies;
            });
            
            // Legacy bot state (use first bot for compatibility)
            this.botCookies = this.bots[0].cookies;
            this.botCPS = this.bots[0].cps;
            this.botDisplayedCookies = this.bots[0].displayedCookies;
            this.botVelocityHistory = this.bots[this.selectedTarget].velocityHistory;
            
            this.updateDisplays();
            this.updateScoreboard();
        }, 500); // Update every 500ms for smoother charts
    }
    
    updateScoreboard() {
        // Sort all players by cookies
        const players = [
            { name: 'You', cookies: this.playerCookies, isPlayer: true },
            ...this.bots.map((b, i) => ({ name: b.name, cookies: b.cookies, index: i, isPlayer: false }))
        ];
        players.sort((a, b) => b.cookies - a.cookies);
        
        // Update rankings with #1, #2, etc format
        const ranks = ['#1', '#2', '#3', '#4'];
        
        // Update player score (now uses formatted display from chart system)
        // Score updates handled by renderSmoothChart
        
        // Update ranks
        players.forEach((p, idx) => {
            if (p.isPlayer) {
                const rankEl = document.getElementById('rank-you');
                if (rankEl) rankEl.textContent = ranks[idx];
            } else {
                const rankEl = document.getElementById(`rank-bot${p.index + 1}`);
                if (rankEl) rankEl.textContent = ranks[idx];
            }
        });
    }
    
    // ==================== NEW STOCK MARKET SYSTEM (Charts in Scoreboard) ====================
    
    // Calculate total margin locked in active positions (stake + unrealized PNL, up or down)
    getLockedMargin() {
        let total = 0;
        for (const pos of this.activePositions) {
            const currentPrice = this.bots[pos.botIndex].cookies;
            const priceChange = currentPrice - pos.entryPrice;
            const pnlMultiplier = pos.type === 'long' ? 1 : -1;
            const pnl = (priceChange / (pos.entryPrice || 1)) * pos.stake * pos.leverage * pnlMultiplier;
            // Locked = stake + unrealized PNL (goes up when winning, down when losing until liq)
            // Minimum is 0 (at liquidation the position is closed)
            total += Math.max(0, pos.stake + pnl);
        }
        return total;
    }
    
    // Get available cookies (total - locked)
    getAvailableCookies() {
        return this.playerCookies - this.getLockedMargin();
    }
    
    // Calculate player's unrealized PNL from all active positions
    calculateUnrealizedPnl() {
        let totalPnl = 0;
        for (const pos of this.activePositions) {
            const bot = this.bots[pos.botIndex];
            if (!bot) continue;
            const currentPrice = bot.cookies;
            const priceChange = currentPrice - pos.entryPrice;
            const pnlMultiplier = pos.type === 'long' ? 1 : -1;
            const pnl = Math.floor((priceChange / (pos.entryPrice || 1)) * pos.stake * pos.leverage * pnlMultiplier);
            totalPnl += pnl;
        }
        return totalPnl;
    }
    
    // Calculate a bot's unrealized PNL from positions on the player
    calculateBotUnrealizedPnl(botIndex) {
        const pos = this.botPositionsOnPlayer.find(p => p.botIndex === botIndex);
        if (!pos) return 0;
        
        const currentPrice = this.playerCookies;
        const priceChange = currentPrice - pos.entryPrice;
        const pnlMultiplier = pos.type === 'long' ? 1 : -1;
        const pnl = Math.floor((priceChange / (pos.entryPrice || 1)) * pos.stake * pos.leverage * pnlMultiplier);
        return pnl;
    }
    
    // Update the locked margin display
    updateLockedMarginDisplay() {
        const locked = this.getLockedMargin();
        
        // Update header display
        const lockedEl = document.getElementById('locked-margin');
        if (lockedEl) {
            if (locked > 0) {
                lockedEl.textContent = `🔒 ${Math.floor(locked)}`;
                lockedEl.style.display = 'inline-block';
            } else {
                lockedEl.style.display = 'none';
            }
        }
        
        // Update left sidebar locked display
        const lockedDisplay = document.getElementById('locked-cookies-display');
        const lockedValue = document.getElementById('locked-cookies-value');
        if (lockedDisplay && lockedValue) {
            if (locked > 0) {
                lockedValue.textContent = Math.floor(locked);
                lockedDisplay.style.display = 'block';
            } else {
                lockedDisplay.style.display = 'none';
            }
        }
        
        // Update live positions display
        this.updateLivePositionsDisplay();
    }
    
    // Update the live positions section showing who's targeting who
    updateLivePositionsDisplay() {
        const container = document.getElementById('live-positions-list');
        if (!container) return;
        
        const allPositions = [];
        
        // Player's positions on bots
        for (const pos of this.activePositions) {
            const botName = this.bots[pos.botIndex]?.name || `Bot ${pos.botIndex + 1}`;
            allPositions.push({
                trader: 'You',
                target: botName,
                isPlayer: true,
                isBotOnPlayer: false
            });
        }
        
        // Bot positions on player
        for (const pos of this.botPositionsOnPlayer) {
            allPositions.push({
                trader: pos.botName,
                target: 'You',
                isPlayer: false,
                isBotOnPlayer: true
            });
        }
        
        // Bot positions on other bots (simulated - bots trade each other too!)
        if (this.botVsBotPositions) {
            for (const pos of this.botVsBotPositions) {
                allPositions.push({
                    trader: pos.traderName,
                    target: pos.targetName,
                    isPlayer: false,
                    isBotOnPlayer: false
                });
            }
        }
        
        if (allPositions.length === 0) {
            container.innerHTML = '<div class="no-positions">No open positions</div>';
            return;
        }
        
        container.innerHTML = allPositions.map(pos => {
            let classes = 'position-item';
            if (pos.isPlayer) classes += ' player-position';
            if (pos.isBotOnPlayer) classes += ' bot-on-player';
            return `<div class="${classes}">
                <span class="trader">${pos.trader}</span>
                <span class="arrow">➜</span>
                <span class="target">${pos.target}</span>
            </div>`;
        }).join('');
    }

    createStockMarketUI() {
        // Bind all trading-related events 
        this.bindInlineTrading();
        this.bindGiveUpButton();
        
        // Initialize leverage per bot
        this.botLeverage = { 0: 2, 1: 2, 2: 2 };
        
        // Bind zoom controls after a short delay to ensure DOM is ready
        setTimeout(() => this.bindZoomControls(), 100);
    }
    
    bindZoomControls() {
        console.log('Binding zoom controls...');
        
        // For each chart container
        ['you', 'bot1', 'bot2', 'bot3'].forEach(chartId => {
            const container = document.querySelector(`.chart-container[data-chart="${chartId}"]`);
            if (!container) {
                console.log('Container not found for', chartId);
                return;
            }
            
            const canvas = container.querySelector('canvas');
            if (!canvas) {
                console.log('Canvas not found for', chartId);
                return;
            }
            
            console.log('Setting up zoom for', chartId);
            
            // Mouse wheel = zoom in/out
            container.addEventListener('wheel', (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                const vp = this.chartViewport[chartId];
                if (!vp) return;
                
                // Zoom in or out
                if (e.deltaY < 0) {
                    vp.zoom = Math.min(5, vp.zoom * 1.2);
                } else {
                    vp.zoom = Math.max(0.2, vp.zoom / 1.2);
                }
                
                console.log('Zoom:', chartId, vp.zoom);
            }, { passive: false });
            
            // Mouse down = start drag
            container.addEventListener('mousedown', (e) => {
                if (e.button !== 0) return; // Left click only
                const vp = this.chartViewport[chartId];
                if (!vp) return;
                
                vp.isDragging = true;
                vp.lastX = e.clientX;
                container.style.cursor = 'grabbing';
                e.preventDefault();
            });
            
            // Mouse move = pan if dragging
            container.addEventListener('mousemove', (e) => {
                const vp = this.chartViewport[chartId];
                if (!vp || !vp.isDragging) return;
                
                const deltaX = e.clientX - vp.lastX;
                vp.lastX = e.clientX;
                
                // Convert pixels to data points (negative because drag left = go back in time)
                const fullLen = this.getFullHistoryLength(chartId);
                const visiblePoints = Math.max(10, Math.floor(60 / vp.zoom));
                const pointsPerPixel = visiblePoints / 300; // approximate width
                const pointsDelta = deltaX * pointsPerPixel;
                
                // Update viewStart (offset from end)
                if (vp.viewEnd === null) {
                    // First time leaving live mode
                    vp.viewEnd = fullLen;
                }
                
                vp.viewEnd = Math.max(visiblePoints, Math.min(fullLen, vp.viewEnd - pointsDelta));
                
                // Snap to live if we're at the end
                if (vp.viewEnd >= fullLen - 1) {
                    vp.viewEnd = null;
                }
            });
            
            // Mouse up/leave = stop drag
            const stopDrag = () => {
                const vp = this.chartViewport[chartId];
                if (vp) {
                    vp.isDragging = false;
                }
                container.style.cursor = 'crosshair';
            };
            
            container.addEventListener('mouseup', stopDrag);
            container.addEventListener('mouseleave', stopDrag);
            
            // Set default cursor
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
                } else if (btn.classList.contains('zoom-out')) {
                    vp.zoom = Math.max(0.01, vp.zoom / 1.5);
                } else if (btn.classList.contains('zoom-all')) {
                    // Show ALL history from the very beginning - no minimum limit
                    vp.zoom = 60 / Math.max(60, fullLen);
                    vp.viewEnd = null;
                } else if (btn.classList.contains('zoom-live')) {
                    // Snap back to live
                    vp.viewEnd = null;
                    vp.zoom = 1;
                }
                
                console.log('Button click:', chartId, btn.className, vp.zoom);
            });
        });
        
        console.log('Zoom controls bound!');
    }
    
    getFullHistoryLength(chartId) {
        if (chartId === 'you') {
            return this.fullCookieHistory.length;
        } else {
            const botIndex = parseInt(chartId.replace('bot', '')) - 1;
            if (this.bots[botIndex]) {
                return this.bots[botIndex].fullCookieHistory.length;
            }
        }
        return 60;
    }
    
    getViewportData(chartId) {
        const vp = this.chartViewport[chartId];
        if (!vp) return { data: [], isLive: true };
        
        let fullData;
        if (chartId === 'you') {
            fullData = this.fullCookieHistory;
        } else {
            const botIndex = parseInt(chartId.replace('bot', '')) - 1;
            fullData = this.bots[botIndex]?.fullCookieHistory || [];
        }
        
        const fullLen = fullData.length;
        const visiblePoints = Math.floor(60 / vp.zoom);
        
        // If viewEnd is null, follow live data
        const endIdx = vp.viewEnd !== null ? vp.viewEnd : fullLen;
        const startIdx = Math.max(0, endIdx - visiblePoints);
        
        // Auto-scroll start when following live
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
    
    bindInlineTrading() {
        // Leverage buttons
        document.querySelectorAll('.lev-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const lev = parseInt(btn.dataset.lev);
                const botIndex = parseInt(btn.dataset.bot);
                
                // Update active state for this bot's leverage buttons
                btn.closest('.leverage-select').querySelectorAll('.lev-btn').forEach(b => {
                    b.classList.remove('active');
                });
                btn.classList.add('active');
                
                // Store leverage for this bot
                this.botLeverage[botIndex] = lev;
                
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
                const botIndex = parseInt(btn.dataset.bot);
                const maxStake = this.calculateMaxStake(botIndex);
                const stakeInput = document.getElementById(`stake-bot${botIndex}`);
                if (stakeInput && maxStake > 0) {
                    stakeInput.value = maxStake;
                    this.showNotification(`Max stake: ${maxStake}🍪`, 'info');
                } else if (maxStake <= 0) {
                    this.showNotification(`Can't trade on this bot yet!`, 'error');
                }
            });
        });
        
        // Quick trade buttons (LONG/SHORT)
        document.querySelectorAll('.quick-trade-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const botIndex = parseInt(btn.dataset.bot);
                const action = btn.dataset.action;
                this.executeQuickTrade(botIndex, action);
            });
        });
    }
    
    // Calculate maximum stake allowed for a bot
    calculateMaxStake(botIndex) {
        const bot = this.bots[botIndex];
        if (!bot) return 0;
        
        const entryPrice = bot.cookies;
        const MIN_ENTRY_PRICE = 100;
        
        if (entryPrice < MIN_ENTRY_PRICE) return 0;
        
        // Max is 50% of target's cookies OR player's available cookies, whichever is less
        const maxFromTarget = Math.floor(entryPrice * 0.5);
        const available = this.getAvailableCookies();
        
        // Also check if adding to existing position
        const existingPos = this.activePositions.find(p => p.botIndex === botIndex);
        if (existingPos) {
            // Can only add up to the max total
            const currentStake = existingPos.stake;
            const maxAdd = maxFromTarget - currentStake;
            return Math.max(0, Math.min(maxAdd, Math.floor(available)));
        }
        
        return Math.min(maxFromTarget, Math.floor(available));
    }
    
    executeQuickTrade(botIndex, action) {
        const stakeInput = document.getElementById(`stake-bot${botIndex}`);
        const stake = parseInt(stakeInput?.value) || 10;
        const leverage = this.botLeverage[botIndex] || 1;
        
        // Check if player has enough AVAILABLE cookies (not locked in positions)
        const available = this.getAvailableCookies();
        if (stake > available) {
            this.showNotification(`Not enough available cookies! (${Math.floor(available)} free)`, 'error');
            return;
        }
        
        if (stake < 1) {
            this.showNotification('Minimum stake is 1 cookie', 'error');
            return;
        }
        
        // Check if already have position on this bot
        const existingPos = this.activePositions.find(p => p.botIndex === botIndex);
        if (existingPos) {
            // Can add to existing position if same direction
            if (existingPos.type === action) {
                // Add to existing position - calculate new average entry
                const oldValue = existingPos.stake;
                const newValue = stake;
                const totalStake = oldValue + newValue;
                
                // Weighted average entry price
                const bot = this.bots[botIndex];
                const currentPrice = bot.cookies;
                
                // Check minimum price for adding too
                const MIN_ENTRY_PRICE = 100;
                if (currentPrice < MIN_ENTRY_PRICE) {
                    this.showNotification(`${bot.name} needs at least ${MIN_ENTRY_PRICE}🍪 to add to position!`, 'error');
                    return;
                }
                
                // Check max stake (50% of target's cookies)
                const maxStakePercent = 0.5;
                const maxStake = Math.floor(currentPrice * maxStakePercent);
                if (totalStake > maxStake) {
                    this.showNotification(`Max total stake on ${bot.name} is ${maxStake}🍪 (50% of their cookies)`, 'error');
                    return;
                }
                
                existingPos.entryPrice = ((existingPos.entryPrice * oldValue) + (currentPrice * newValue)) / totalStake;
                existingPos.stake = totalStake;
                
                // Use max leverage between old and new
                existingPos.leverage = Math.max(existingPos.leverage, leverage);
                
                // Recalculate liquidation price
                const liquidationPercent = 1 / existingPos.leverage;
                if (action === 'long') {
                    existingPos.liquidationPrice = existingPos.entryPrice * (1 - liquidationPercent);
                } else {
                    existingPos.liquidationPrice = existingPos.entryPrice * (1 + liquidationPercent);
                }
                
                this.showNotification(`Added ${stake}🍪 to ${action.toUpperCase()} on ${bot.name} | Total: ${totalStake}🍪`, 'success');
                this.updatePositionsPanel();
                this.updateCardPositions();
                this.updateLockedMarginDisplay();
                return;
            } else {
                this.showNotification(`Already have a ${existingPos.type.toUpperCase()} on this bot! Close it first.`, 'error');
                return;
            }
        }
        
        // ISOLATED MARGIN: Don't deduct from playerCookies - it's just locked
        // The stake is tracked in the position and shown as "locked"
        
        // Get current bot velocity for entry price
        const bot = this.bots[botIndex];
        const entryPrice = bot.cookies; // Use cookie count as "price"
        
        // Minimum entry price to prevent free-money exploits at low cookies
        const MIN_ENTRY_PRICE = 100;
        if (entryPrice < MIN_ENTRY_PRICE) {
            this.showNotification(`${bot.name} needs at least ${MIN_ENTRY_PRICE}🍪 to trade on!`, 'error');
            return;
        }
        
        // Max stake is 50% of target's cookies - prevents risk-free positions
        // With 1x leverage on a LONG, you get liquidated if price drops 100%
        // So we need the target to be able to drop enough to hit liquidation
        const maxStakePercent = 0.5; // 50% of target
        const maxStake = Math.floor(entryPrice * maxStakePercent);
        if (stake > maxStake) {
            this.showNotification(`Max stake on ${bot.name} is ${maxStake}🍪 (50% of their cookies)`, 'error');
            return;
        }
        
        // Calculate liquidation price based on leverage
        // At 10x leverage, 10% move against you = liquidation (100% loss)
        // liquidation distance = 1 / leverage = 100% / leverage
        const liquidationPercent = 1 / leverage;
        let liquidationPrice;
        if (action === 'long') {
            // Long: liquidation if price drops by (100/leverage)%
            liquidationPrice = entryPrice * (1 - liquidationPercent);
        } else {
            // Short: liquidation if price rises by (100/leverage)%
            liquidationPrice = entryPrice * (1 + liquidationPercent);
        }
        
        // LONG positions need liquidation price > 10 to have real risk
        // Otherwise you can never get liquidated (cookies can't go negative)
        if (action === 'long' && liquidationPrice < 10) {
            const minLeverage = Math.ceil(1 / (1 - 10/entryPrice));
            this.showNotification(`Need at least ${minLeverage}x leverage for LONG on ${bot.name} (liq must be > 10)`, 'error');
            return;
        }
        
        // Create position
        const position = {
            botIndex,
            botName: bot.name,
            botColor: bot.color,
            type: action,
            stake,
            leverage,
            entryPrice,
            liquidationPrice,
            currentPnl: 0,
            openTime: Date.now()
        };
        
        this.activePositions.push(position);
        
        // Show notification with liquidation price
        this.showNotification(`Opened ${action.toUpperCase()} on ${bot.name} - ${stake}🍪 @ ${leverage}x | LIQ: ${Math.floor(liquidationPrice)}`, 'success');
        
        // Update displays
        this.updatePositionsPanel();
        this.updateCardPositions();
        this.updateLockedMarginDisplay();
    }
    
    closePosition(botIndex) {
        console.log('closePosition called with botIndex:', botIndex);
        console.log('activePositions:', this.activePositions);
        
        const posIndex = this.activePositions.findIndex(p => p.botIndex === botIndex);
        console.log('Found position at index:', posIndex);
        
        if (posIndex === -1) {
            console.log('Position not found!');
            return;
        }
        
        const position = this.activePositions[posIndex];
        
        // Calculate final PNL
        const bot = this.bots[position.botIndex];
        const currentPrice = bot.cookies;
        const priceChange = currentPrice - position.entryPrice;
        const pnlMultiplier = position.type === 'long' ? 1 : -1;
        const pnl = Math.floor((priceChange / (position.entryPrice || 1)) * position.stake * position.leverage * pnlMultiplier);
        
        console.log('PNL calculated:', pnl);
        
        // === ISOLATED MARGIN: Apply PNL ===
        // Stake was locked, not deducted - so we only add/subtract PNL
        // If you profit, you gain cookies (taken from bot)
        // If you lose, you lose cookies (capped at stake) 
        
        if (pnl > 0) {
            // You won! Add profit to your cookies, take from bot
            this.playerCookies += pnl;
            bot.cookies = Math.max(0, bot.cookies - pnl);
            this.showNotification(`💰 Won ${pnl}🍪 from ${position.botName}!`, 'success');
        } else if (pnl < 0) {
            // You lost! Deduct loss from your cookies (capped at stake)
            const actualLoss = Math.min(Math.abs(pnl), position.stake);
            this.playerCookies -= actualLoss;
            bot.cookies += actualLoss;
            this.showNotification(`😢 Lost ${actualLoss}🍪 to ${position.botName}`, 'error');
        } else {
            // Break even
            this.showNotification(`Closed even on ${position.botName}`, 'info');
        }
        
        // Remove position (unlocks the margin)
        this.activePositions.splice(posIndex, 1);
        console.log('Position removed. Remaining:', this.activePositions.length);
        
        // Update displays
        this.updatePositionsPanel();
        this.updateCardPositions();
        this.updateLockedMarginDisplay();
    }
    
    checkLiquidations() {
        // Check all positions for liquidation OR max payout
        const toRemove = [];
        
        for (let i = 0; i < this.activePositions.length; i++) {
            const pos = this.activePositions[i];
            const bot = this.bots[pos.botIndex];
            const currentPrice = bot.cookies;
            
            // Calculate current PNL
            const priceChange = currentPrice - pos.entryPrice;
            const pnlMultiplier = pos.type === 'long' ? 1 : -1;
            const pnl = Math.floor((priceChange / (pos.entryPrice || 1)) * pos.stake * pos.leverage * pnlMultiplier);
            
            let liquidated = false;
            let maxPayout = false;
            
            if (pos.type === 'long' && currentPrice <= pos.liquidationPrice) {
                // Long liquidated - price dropped below liquidation
                liquidated = true;
            } else if (pos.type === 'short' && currentPrice >= pos.liquidationPrice) {
                // Short liquidated - price rose above liquidation
                liquidated = true;
            }
            
            // Check if profit exceeds what target can pay
            if (pnl > 0 && pnl >= bot.cookies) {
                maxPayout = true;
            }
            
            if (liquidated) {
                // ISOLATED MARGIN LIQUIDATION:
                // The stake was LOCKED (not deducted), now it's lost entirely
                // Bot gets the stake as profit
                bot.cookies += pos.stake;
                
                // Player loses the stake (deduct it now since it was just locked before)
                this.playerCookies -= pos.stake;
                
                // Ensure playerCookies doesn't go below 0
                if (this.playerCookies < 0) this.playerCookies = 0;
                
                this.showNotification(`💀 LIQUIDATED on ${pos.botName}! Lost ${pos.stake}🍪`, 'error');
                toRemove.push(i);
            } else if (maxPayout) {
                // Position auto-closes because target can't pay more
                const maxProfit = bot.cookies; // Take all they have
                this.playerCookies += maxProfit;
                bot.cookies = 0;
                
                this.showNotification(`🎯 MAX PAYOUT on ${pos.botName}! Won ${maxProfit}🍪 (all they had!)`, 'success');
                toRemove.push(i);
            }
        }
        
        // Remove liquidated/closed positions (reverse order to not mess up indices)
        for (let i = toRemove.length - 1; i >= 0; i--) {
            this.activePositions.splice(toRemove[i], 1);
        }
        
        // Update locked margin display if any were removed
        if (toRemove.length > 0) {
            this.updateLockedMarginDisplay();
            this.updatePositionsPanel();
            this.updateCardPositions();
        }
    }
    
    checkBotPositionsOnPlayer(botIndex, bot) {
        // Find if this bot has a position on player
        const posIndex = this.botPositionsOnPlayer.findIndex(p => p.botIndex === botIndex);
        if (posIndex === -1) return;
        
        const pos = this.botPositionsOnPlayer[posIndex];
        const currentPrice = this.playerCookies;
        const priceChange = currentPrice - pos.entryPrice;
        const pnlMultiplier = pos.type === 'long' ? 1 : -1;
        const pnl = Math.floor((priceChange / (pos.entryPrice || 1)) * pos.stake * pos.leverage * pnlMultiplier);
        
        // Bot closes position if:
        // 1. Made good profit (>30% of stake)
        // 2. Losing too much (>50% of stake)
        // 3. Random chance after some time
        const profitPercent = (pnl / pos.stake) * 100;
        
        let shouldClose = false;
        if (profitPercent > 30 && Math.random() < 0.15) shouldClose = true;  // Take profit
        if (profitPercent < -50) shouldClose = true;  // Stop loss
        if (Math.random() < 0.005) shouldClose = true;  // Random close
        
        if (shouldClose) {
            // Bot closes position
            if (pnl > 0) {
                // Bot won - takes from player
                bot.cookies += pnl;
                this.playerCookies = Math.max(0, this.playerCookies - pnl);
                this.showNotification(`😤 ${bot.name} closed a position and took ${pnl}🍪 from you!`, 'error');
            } else if (pnl < 0) {
                // Bot lost - player gains
                const gain = Math.abs(pnl);
                this.playerCookies += gain;
                bot.cookies = Math.max(0, bot.cookies - gain);
                this.showNotification(`😎 ${bot.name} closed a losing position! You gained ${gain}🍪!`, 'success');
            } else {
                this.showNotification(`${bot.name} closed their position on you (break even)`, 'info');
            }
            
            // Remove position
            this.botPositionsOnPlayer.splice(posIndex, 1);
        }
    }
    
    // Check and close bot vs bot positions
    checkBotVsBotPositions() {
        const toRemove = [];
        
        for (let i = 0; i < this.botVsBotPositions.length; i++) {
            const pos = this.botVsBotPositions[i];
            const traderBot = this.bots[pos.traderIndex];
            const targetBot = this.bots[pos.targetIndex];
            
            if (!traderBot || !targetBot) {
                toRemove.push(i);
                continue;
            }
            
            const currentPrice = targetBot.cookies;
            const priceChange = currentPrice - pos.entryPrice;
            const pnlMultiplier = pos.type === 'long' ? 1 : -1;
            const pnl = Math.floor((priceChange / (pos.entryPrice || 1)) * pos.stake * pos.leverage * pnlMultiplier);
            
            const profitPercent = (pnl / pos.stake) * 100;
            
            let shouldClose = false;
            if (profitPercent > 25 && Math.random() < 0.1) shouldClose = true;
            if (profitPercent < -60) shouldClose = true;
            if (Math.random() < 0.003) shouldClose = true;
            
            if (shouldClose) {
                // Transfer cookies between bots
                if (pnl > 0) {
                    traderBot.cookies += pnl;
                    targetBot.cookies = Math.max(0, targetBot.cookies - pnl);
                } else if (pnl < 0) {
                    const loss = Math.abs(pnl);
                    targetBot.cookies += loss;
                    traderBot.cookies = Math.max(0, traderBot.cookies - loss);
                }
                toRemove.push(i);
            }
        }
        
        // Remove closed positions (in reverse to maintain indices)
        for (let i = toRemove.length - 1; i >= 0; i--) {
            this.botVsBotPositions.splice(toRemove[i], 1);
        }
    }
    
    checkWinCondition() {
        const WIN_GOAL = 1000000; // 1 Million cookies to win!
        
        // Check if game already ended
        if (this.gameEnded) return;
        
        // Check player
        if (this.playerCookies >= WIN_GOAL) {
            this.gameEnded = true;
            this.showVictoryScreen('You', this.playerCookies, true);
            return;
        }
        
        // Check bots
        for (const bot of this.bots) {
            if (bot.cookies >= WIN_GOAL) {
                this.gameEnded = true;
                this.showVictoryScreen(bot.name, bot.cookies, false);
                return;
            }
        }
    }
    
    showVictoryScreen(winnerName, cookies, isPlayer) {
        // Stop all game loops
        if (this.gameInterval) {
            clearInterval(this.gameInterval);
        }
        if (this.cpsInterval) {
            clearInterval(this.cpsInterval);
        }
        
        // Create victory overlay
        const overlay = document.createElement('div');
        overlay.className = 'victory-overlay';
        overlay.innerHTML = `
            <div class="victory-modal">
                <div class="victory-icon">${isPlayer ? '🏆' : '😢'}</div>
                <h1 class="victory-title">${isPlayer ? 'VICTORY!' : 'DEFEAT!'}</h1>
                <div class="victory-winner">${winnerName} reached 1 MILLION cookies!</div>
                <div class="victory-cookies">🍪 ${cookies.toLocaleString()} 🍪</div>
                <div class="victory-stats">
                    <div>Your Cookies: ${Math.floor(this.playerCookies).toLocaleString()}</div>
                    <div>Your CPS: ${this.playerCPS}</div>
                    <div>Total Clicks: ${this.playerClicks}</div>
                </div>
                <button class="victory-btn" id="play-again-btn">Play Again</button>
            </div>
        `;
        document.body.appendChild(overlay);
        
        // Add play again listener
        document.getElementById('play-again-btn').addEventListener('click', () => {
            window.location.reload();
        });
    }
    
    updatePositionsPanel() {
        const list = document.getElementById('positions-list');
        if (!list) return;
        
        if (this.activePositions.length === 0) {
            list.innerHTML = '<div class="no-positions">No open positions - Trade on bot charts above!</div>';
        } else {
            let totalPnl = 0;
            list.innerHTML = this.activePositions.map(pos => {
                const bot = this.bots[pos.botIndex];
                const currentPrice = bot.cookies;
                const priceChange = currentPrice - pos.entryPrice;
                const pnlMultiplier = pos.type === 'long' ? 1 : -1;
                const pnl = Math.floor((priceChange / (pos.entryPrice || 1)) * pos.stake * pos.leverage * pnlMultiplier);
                totalPnl += pnl;
                
                const pnlClass = pnl >= 0 ? 'profit' : 'loss';
                const pnlText = pnl >= 0 ? `+${pnl}` : `${pnl}`;
                
                // Calculate distance to liquidation
                const distToLiq = pos.type === 'long' 
                    ? ((currentPrice - pos.liquidationPrice) / currentPrice * 100).toFixed(1)
                    : ((pos.liquidationPrice - currentPrice) / currentPrice * 100).toFixed(1);
                const liqDanger = parseFloat(distToLiq) < 10 ? 'danger' : parseFloat(distToLiq) < 25 ? 'warning' : 'safe';
                
                return `
                    <div class="position-row">
                        <div class="pos-icon ${pos.type}">${pos.type === 'long' ? '📈' : '📉'}</div>
                        <div class="pos-info">
                            <div class="pos-name" style="color:${pos.botColor}">${pos.botName}</div>
                            <div class="pos-meta">${pos.type.toUpperCase()} @ ${pos.leverage}x | Entry: ${Math.floor(pos.entryPrice)}</div>
                            <div class="pos-liq ${liqDanger}">💀 LIQ: ${Math.floor(pos.liquidationPrice)} (${distToLiq}% away)</div>
                        </div>
                        <div class="pos-values">
                            <div class="pos-current-pnl ${pnlClass}">${pnlText}🍪</div>
                            <div class="pos-stake">🔒 ${pos.stake}</div>
                        </div>
                        <div class="pos-actions">
                            <button class="pos-action-btn close" data-close-bot="${pos.botIndex}">CLOSE</button>
                        </div>
                    </div>
                `;
            }).join('');
            
            // Attach close button event listeners
            list.querySelectorAll('[data-close-bot]').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const botIndex = parseInt(e.target.getAttribute('data-close-bot'));
                    this.closePosition(botIndex);
                });
            });
            
            // Update total PNL
            const totalPnlEl = document.getElementById('total-positions-pnl');
            if (totalPnlEl) {
                totalPnlEl.textContent = (totalPnl >= 0 ? '+' : '') + totalPnl + '🍪';
                totalPnlEl.className = 'positions-pnl ' + (totalPnl > 0 ? 'profit' : totalPnl < 0 ? 'loss' : 'neutral');
            }
            
            // Update header PNL too
            const headerPnl = document.getElementById('total-pnl');
            if (headerPnl) {
                headerPnl.textContent = 'PNL: ' + (totalPnl >= 0 ? '+' : '') + totalPnl;
                headerPnl.style.color = totalPnl > 0 ? '#2ecc71' : totalPnl < 0 ? '#e74c3c' : '#888';
            }
        }
    }
    
    updateCardPositions() {
        // Update position indicators on each card
        for (let i = 0; i < 3; i++) {
            const posEl = document.getElementById(`pos-bot${i}`);
            if (!posEl) continue;
            
            const position = this.activePositions.find(p => p.botIndex === i);
            
            if (position) {
                const bot = this.bots[i];
                const currentPrice = bot.cookies;
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
                    <button class="pos-close-btn" data-close-bot="${position.botIndex}">Close Position</button>
                `;
                // Attach event listener for close button
                posEl.querySelector('.pos-close-btn').addEventListener('click', () => {
                    this.closePosition(position.botIndex);
                });
            } else {
                posEl.style.display = 'none';
            }
        }
    }
    
    // REMOVED: Pump/Dump manipulation buttons
    // bindManipulationButtons() { ... }
    
    bindTradeModal() {
        // Modal removed - using inline trading now
        const leverageSelect = document.getElementById('leverage-select');
        if (leverageSelect) {
            leverageSelect.addEventListener('change', () => {
                this.selectedLeverage = parseInt(leverageSelect.value);
                this.updateTradePreview();
            });
        }
    }
    
    bindGiveUpButton() {
        const giveUpBtn = document.getElementById('give-up-btn');
        if (giveUpBtn) {
            giveUpBtn.addEventListener('click', () => this.giveUp());
        }
    }
    
    showTradeModal(botIndex, action) {
        const modal = document.getElementById('trade-modal');
        if (!modal) return;
        
        // Check if already have position on this bot
        if (this.activePositions.find(p => p.botIndex === botIndex)) {
            this.showNotification('Already have position on this bot!', 'warning');
            return;
        }
        
        this.pendingTrade = { botIndex, type: action };
        const bot = this.bots[botIndex];
        
        // Update modal content
        document.getElementById('trade-modal-title').textContent = `Open ${action.toUpperCase()} Position`;
        document.getElementById('trade-modal-target').textContent = `Target: ${bot.name}`;
        document.getElementById('trade-modal-type').textContent = action.toUpperCase();
        document.getElementById('trade-modal-type').className = `trade-type ${action}`;
        document.getElementById('available-cookies').textContent = Math.floor(this.playerCookies);
        document.getElementById('stake-amount').value = Math.min(10, Math.floor(this.playerCookies));
        document.getElementById('stake-amount').max = Math.floor(this.playerCookies);
        
        // Reset leverage
        const leverageSelect = document.getElementById('leverage-select');
        if (leverageSelect) leverageSelect.value = '2';
        this.selectedLeverage = 2;
        
        this.updateTradePreview();
        modal.style.display = 'flex';
    }
    
    hideTradeModal() {
        const modal = document.getElementById('trade-modal');
        if (modal) modal.style.display = 'none';
        this.pendingTrade = null;
    }
    
    updateTradePreview() {
        if (!this.pendingTrade) return;
        
        const stake = parseInt(document.getElementById('stake-amount').value) || 0;
        const maxProfit = stake * this.selectedLeverage;
        const maxLoss = stake; // Can only lose stake (leveraged loss = liquidation)
        
        document.getElementById('max-profit').textContent = `+${maxProfit}`;
        document.getElementById('max-loss').textContent = `-${maxLoss}`;
        
        // Show liquidation warning for high leverage
        const warning = document.getElementById('liquidation-warning');
        if (warning) {
            const liquidationPct = (100 / this.selectedLeverage).toFixed(0);
            warning.textContent = `⚠️ Liquidation if velocity moves ${liquidationPct}% against you!`;
            warning.style.display = this.selectedLeverage > 1 ? 'block' : 'none';
        }
    }
    
    confirmTrade() {
        if (!this.pendingTrade) return;
        
        const botIndex = this.pendingTrade.botIndex;
        const type = this.pendingTrade.type;
        const stake = parseInt(document.getElementById('stake-amount').value) || 0;
        
        if (stake <= 0) {
            this.showNotification('Enter a valid stake amount!', 'error');
            return;
        }
        
        if (stake > this.playerCookies) {
            this.showNotification('Not enough cookies!', 'error');
            return;
        }
        
        // Get current velocity
        const bot = this.bots[botIndex];
        const currentVelocity = bot.velocityHistory.length > 0 ? 
            bot.velocityHistory[bot.velocityHistory.length - 1] : bot.cps;
        
        // Create position
        const position = {
            botIndex,
            type, // 'long' or 'short'
            stake,
            leverage: this.selectedLeverage,
            entryVelocity: currentVelocity,
            currentPnl: 0,
            maxLoss: stake // Lose stake on liquidation
        };
        
        // Deduct stake
        this.playerCookies -= stake;
        this.activePositions.push(position);
        
        this.showNotification(`${type.toUpperCase()} ${bot.name} - ${stake} @ ${this.selectedLeverage}x!`, 'success');
        this.hideTradeModal();
        this.updateDisplays();
        this.updatePositionsDisplay();
    }
    
    // REMOVED: Duplicate closePosition and showClosePositionModal - using the one above
    
    updateAllPositionsPNL() {
        for (let i = this.activePositions.length - 1; i >= 0; i--) {
            const position = this.activePositions[i];
            const bot = this.bots[position.botIndex];
            
            const currentVelocity = bot.velocityHistory.length > 0 ?
                bot.velocityHistory[bot.velocityHistory.length - 1] : bot.cps;
            
            const priceChange = (currentVelocity - position.entryVelocity) / position.entryVelocity;
            
            if (position.type === 'long') {
                position.currentPnl = position.stake * priceChange * position.leverage;
            } else {
                position.currentPnl = position.stake * (-priceChange) * position.leverage;
            }
            
            // Check for liquidation - if loss >= stake, liquidate
            if (position.currentPnl <= -position.stake) {
                this.liquidatePosition(i);
            }
        }
    }
    
    liquidatePosition(positionIndex) {
        const position = this.activePositions[positionIndex];
        if (!position) return;
        
        const bot = this.bots[position.botIndex];
        
        // Player loses entire stake to the bot
        bot.cookies += position.stake;
        this.totalPnl -= position.stake;
        
        this.showNotification(`💀 LIQUIDATED! Lost ${position.stake} on ${bot.name}!`, 'error');
        
        // Flash the card red
        const card = document.getElementById(`bot${position.botIndex + 1}-card`);
        if (card) {
            card.style.animation = 'liquidation-flash 0.5s ease-in-out';
            setTimeout(() => card.style.animation = '', 500);
        }
        
        // Remove position
        this.activePositions.splice(positionIndex, 1);
        
        // Check for bankruptcy
        if (this.playerCookies <= 0 && this.activePositions.length === 0) {
            this.handleBankruptcy();
        }
        
        this.updatePositionsDisplay();
    }
    
    updatePositionsDisplay() {
        // Update total PNL display
        const totalPnlEl = document.getElementById('total-pnl');
        if (totalPnlEl) {
            const pnlColor = this.totalPnl >= 0 ? '#2ecc71' : '#e74c3c';
            const pnlStr = this.totalPnl >= 0 ? `+${Math.floor(this.totalPnl)}` : `${Math.floor(this.totalPnl)}`;
            totalPnlEl.textContent = `PNL: ${pnlStr}`;
            totalPnlEl.style.color = pnlColor;
        }
        
        // Update position indicators on each bot card
        for (let i = 0; i < 3; i++) {
            const indicator = document.getElementById(`position-bot${i + 1}`);
            const card = document.getElementById(`bot${i + 1}-card`);
            if (!indicator) continue;
            
            const position = this.activePositions.find(p => p.botIndex === i);
            
            if (position) {
                const pnlColor = position.currentPnl >= 0 ? '#2ecc71' : '#e74c3c';
                const pnlPct = ((position.currentPnl / position.stake) * 100).toFixed(0);
                const arrow = position.type === 'long' ? '📈' : '📉';
                
                indicator.innerHTML = `
                    <span style="color: ${position.type === 'long' ? '#27ae60' : '#c0392b'}">
                        ${arrow} ${position.type.toUpperCase()} ${position.leverage}x
                    </span>
                    <span style="color: ${pnlColor}; font-weight: bold;">
                        ${position.currentPnl >= 0 ? '+' : ''}${Math.floor(position.currentPnl)} (${pnlPct}%)
                    </span>
                `;
                indicator.style.display = 'block';
                
                // Highlight card based on position
                if (card) {
                    card.classList.add('has-position');
                    card.classList.remove('position-profit', 'position-loss');
                    card.classList.add(position.currentPnl >= 0 ? 'position-profit' : 'position-loss');
                }
            } else {
                indicator.innerHTML = '';
                indicator.style.display = 'none';
                if (card) {
                    card.classList.remove('has-position', 'position-profit', 'position-loss');
                }
            }
        }
        
        // Update player velocity display
        const velocityYou = document.getElementById('velocity-you');
        if (velocityYou && this.velocityHistory.length > 0) {
            velocityYou.textContent = `+${this.velocityHistory[this.velocityHistory.length - 1].toFixed(1)}/s`;
        }
        
        // Update bot velocity displays
        for (let i = 0; i < this.bots.length; i++) {
            const velocityEl = document.getElementById(`velocity-bot${i + 1}`);
            if (velocityEl && this.bots[i].velocityHistory.length > 0) {
                velocityEl.textContent = `+${this.bots[i].velocityHistory[this.bots[i].velocityHistory.length - 1].toFixed(1)}/s`;
            }
        }
    }
    
    handleBankruptcy() {
        this.isBankrupt = true;
        
        // Sell all generators
        let generatorValue = 0;
        Object.keys(this.generators).forEach(key => {
            const gen = this.generators[key];
            generatorValue += Math.floor(gen.cost * gen.owned * 0.5); // 50% value
            this.playerCPS -= gen.cps * gen.owned;
            gen.owned = 0;
        });
        
        if (generatorValue > 0) {
            this.playerCookies = generatorValue;
            this.showNotification(`💸 BANKRUPTCY! Generators sold for ${generatorValue} cookies!`, 'error');
        } else {
            this.playerCookies = 10; // Small bailout
            this.showNotification('💸 BANKRUPTCY! Starting over with 10 cookies...', 'error');
        }
        
        this.isBankrupt = false;
        this.updateDisplays();
    }
    
    giveUp() {
        if (confirm('Are you sure you want to give up? You will forfeit the match!')) {
            this.stopGameLoop();
            
            // Determine winner
            const players = [
                { name: 'You', cookies: this.playerCookies },
                ...this.bots.map(b => ({ name: b.name, cookies: b.cookies }))
            ];
            players.sort((a, b) => b.cookies - a.cookies);
            const winner = players[0];
            
            setTimeout(() => {
                alert(`GAME OVER - You Gave Up!\n\n` +
                      `Winner: ${winner.name} with ${Math.floor(winner.cookies)} cookies!\n\n` +
                      `Your Stats:\n` +
                      `Cookies: ${Math.floor(this.playerCookies)}\n` +
                      `Total Trading PNL: ${Math.floor(this.totalPnl)}`);
                window.location.href = '/';
            }, 500);
        }
    }
    
    // OLD updateCharts/drawChart REMOVED - using new chart system in initChartSystem()
    
    handleLong() {
        // Check if already have a position
        if (this.positions.long.active || this.positions.short.active) {
            this.showNotification('Already have an active position!', 'warning');
            return;
        }
        
        // Check cooldown
        if (this.tradingCooldowns.long > 0) {
            this.showNotification(`LONG cooldown: ${this.tradingCooldowns.long}s`, 'warning');
            return;
        }
        
        // Need minimum cookies to stake
        const stake = Math.floor(this.playerCookies * 0.2);
        if (stake < 10) {
            this.showNotification('Need more cookies to stake!', 'error');
            return;
        }
        
        // Get current bot velocity
        const currentVelocity = this.botVelocityHistory.length > 0 ? 
            this.botVelocityHistory[this.botVelocityHistory.length - 1] : 1;
        
        this.positions.long = {
            active: true,
            stake: stake,
            entryVelocity: currentVelocity,
            startTime: Date.now(),
            timeRemaining: this.positionSettleTime
        };
        
        this.playerCookies -= stake; // Lock the stake
        this.showNotification(`LONG position opened! Staked ${stake} cookies`, 'success');
        this.updateTradingUI();
    }
    
    handleShort() {
        // Check if already have a position
        if (this.positions.long.active || this.positions.short.active) {
            this.showNotification('Already have an active position!', 'warning');
            return;
        }
        
        // Check cooldown
        if (this.tradingCooldowns.short > 0) {
            this.showNotification(`SHORT cooldown: ${this.tradingCooldowns.short}s`, 'warning');
            return;
        }
        
        // Need minimum cookies to stake
        const stake = Math.floor(this.playerCookies * 0.2);
        if (stake < 10) {
            this.showNotification('Need more cookies to stake!', 'error');
            return;
        }
        
        // Get current bot velocity
        const currentVelocity = this.botVelocityHistory.length > 0 ? 
            this.botVelocityHistory[this.botVelocityHistory.length - 1] : 1;
        
        this.positions.short = {
            active: true,
            stake: stake,
            entryVelocity: currentVelocity,
            startTime: Date.now(),
            timeRemaining: this.positionSettleTime
        };
        
        this.playerCookies -= stake; // Lock the stake
        this.showNotification(`SHORT position opened! Staked ${stake} cookies`, 'success');
        this.updateTradingUI();
    }
    
    handlePump() {
        // Check cooldown
        if (this.tradingCooldowns.pump > 0) {
            this.showNotification(`PUMP cooldown: ${this.tradingCooldowns.pump}s`, 'warning');
            return;
        }
        
        // Check if already manipulating
        if (this.manipulation.pump.active || this.manipulation.dump.active) {
            this.showNotification('Already manipulating!', 'warning');
            return;
        }
        
        // Activate pump
        this.manipulation.pump = {
            active: true,
            timeRemaining: 8,
            multiplier: 1.5
        };
        
        this.tradingCooldowns.pump = 30;
        this.showNotification('PUMP activated! Your velocity will appear 50% higher for 8s', 'success');
        this.updateTradingUI();
    }
    
    handleDump() {
        // Check cooldown
        if (this.tradingCooldowns.dump > 0) {
            this.showNotification(`DUMP cooldown: ${this.tradingCooldowns.dump}s`, 'warning');
            return;
        }
        
        // Check if already manipulating
        if (this.manipulation.pump.active || this.manipulation.dump.active) {
            this.showNotification('Already manipulating!', 'warning');
            return;
        }
        
        // Activate dump
        this.manipulation.dump = {
            active: true,
            timeRemaining: 8,
            multiplier: 0.5
        };
        
        this.tradingCooldowns.dump = 30;
        this.showNotification('DUMP activated! Your velocity will appear 50% lower for 8s', 'success');
        this.updateTradingUI();
    }
    
    updatePositions() {
        // Update LONG position
        if (this.positions.long.active) {
            this.positions.long.timeRemaining--;
            
            if (this.positions.long.timeRemaining <= 0) {
                // Settle the position
                const currentVelocity = this.botVelocityHistory.length > 0 ? 
                    this.botVelocityHistory[this.botVelocityHistory.length - 1] : 1;
                const change = (currentVelocity - this.positions.long.entryVelocity) / this.positions.long.entryVelocity;
                
                // WIN if velocity increased by 10%+
                if (change >= 0.10) {
                    const profit = Math.floor(this.positions.long.stake * 2);
                    this.playerCookies += profit;
                    this.showNotification(`LONG WIN! +${profit} cookies (${(change * 100).toFixed(0)}% increase)`, 'success');
                } else {
                    // LOSE - stake is lost
                    this.showNotification(`LONG LOST! Velocity didn't rise 10%+ (${(change * 100).toFixed(0)}%)`, 'error');
                }
                
                this.positions.long = { active: false, stake: 0, entryVelocity: 0, startTime: null, timeRemaining: 0 };
                this.tradingCooldowns.long = 15;
            }
        }
        
        // Update SHORT position
        if (this.positions.short.active) {
            this.positions.short.timeRemaining--;
            
            if (this.positions.short.timeRemaining <= 0) {
                // Settle the position
                const currentVelocity = this.botVelocityHistory.length > 0 ? 
                    this.botVelocityHistory[this.botVelocityHistory.length - 1] : 1;
                const change = (currentVelocity - this.positions.short.entryVelocity) / this.positions.short.entryVelocity;
                
                // WIN if velocity decreased by 10%+
                if (change <= -0.10) {
                    const profit = Math.floor(this.positions.short.stake * 2);
                    this.playerCookies += profit;
                    this.showNotification(`SHORT WIN! +${profit} cookies (${(change * 100).toFixed(0)}% decrease)`, 'success');
                } else {
                    // LOSE - stake is lost
                    this.showNotification(`SHORT LOST! Velocity didn't fall 10%+ (${(change * 100).toFixed(0)}%)`, 'error');
                }
                
                this.positions.short = { active: false, stake: 0, entryVelocity: 0, startTime: null, timeRemaining: 0 };
                this.tradingCooldowns.short = 15;
            }
        }
    }
    
    updateTradingUI() {
        // Update pump/dump button states only (new trading uses modal)
        const pumpBtn = document.querySelector('.pump-btn');
        const dumpBtn = document.querySelector('.dump-btn');
        
        if (pumpBtn) {
            const disabled = this.manipulation.pump.active || this.manipulation.dump.active || this.tradingCooldowns.pump > 0;
            pumpBtn.disabled = disabled;
            pumpBtn.style.opacity = disabled ? '0.5' : '1';
            
            if (this.manipulation.pump.active) {
                pumpBtn.textContent = `PUMP ${this.manipulation.pump.timeRemaining}s`;
            } else if (this.tradingCooldowns.pump > 0) {
                pumpBtn.textContent = `CD ${this.tradingCooldowns.pump}s`;
            } else {
                pumpBtn.textContent = 'PUMP';
            }
        }
        
        if (dumpBtn) {
            const disabled = this.manipulation.pump.active || this.manipulation.dump.active || this.tradingCooldowns.dump > 0;
            dumpBtn.disabled = disabled;
            dumpBtn.style.opacity = disabled ? '0.5' : '1';
            
            if (this.manipulation.dump.active) {
                dumpBtn.textContent = `DUMP ${this.manipulation.dump.timeRemaining}s`;
            } else if (this.tradingCooldowns.dump > 0) {
                dumpBtn.textContent = `CD ${this.tradingCooldowns.dump}s`;
            } else {
                dumpBtn.textContent = 'DUMP';
            }
        }
    }
    
    updateClickSpeed() {
        const now = Date.now();
        // Remove clicks older than 1 second
        this.clickTimes = this.clickTimes.filter(t => now - t < 1000);
        this.currentCPS = this.clickTimes.length;
        
        // Calculate exponential multiplier based on CPS
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
    
    showSpikeIndicator() {
        // Legacy function - bot-display removed
        // Spikes are now visible on the charts directly
    }
    
    stopGameLoop() {
        if (this.gameInterval) {
            clearInterval(this.gameInterval);
            this.gameInterval = null;
        }
        if (this.cpsInterval) {
            clearInterval(this.cpsInterval);
            this.cpsInterval = null;
        }
        if (this.bluffTimerInterval) {
            clearInterval(this.bluffTimerInterval);
            this.bluffTimerInterval = null;
        }
    }
    
    showStep(index) {
        if (index < 0 || index >= this.steps.length) return;
        
        this.currentStep = index;
        const step = this.steps[index];
        
        // Update dialog
        document.getElementById('step-num').textContent = index + 1;
        document.getElementById('dialog-title').textContent = step.title;
        document.getElementById('dialog-message').textContent = step.message;
        
        // Handle button
        const nextBtn = document.getElementById('next-btn');
        const progressContainer = document.getElementById('progress-container');
        
        if (step.action === 'continue') {
            nextBtn.textContent = 'Next';
            nextBtn.disabled = false;
            progressContainer.style.display = 'none';
        } else if (step.action === 'click') {
            nextBtn.textContent = 'Click the cookie!';
            nextBtn.disabled = true;
            step.progress = 0;
            this.updateProgress(step);
            progressContainer.style.display = 'block';
        } else if (step.action === 'tab') {
            nextBtn.textContent = 'Click the tab';
            nextBtn.disabled = true;
            progressContainer.style.display = 'none';
        } else if (step.action === 'buy') {
            // Make sure generators tab is active for buying
            this.activateTab('generators');
            nextBtn.textContent = `Need ${step.cost} cookies`;
            nextBtn.disabled = true;
            progressContainer.style.display = 'none';
            // Re-highlight after tab switch with delay
            setTimeout(() => this.updateHighlight(step.target), 100);
        } else if (step.action === 'practice') {
            nextBtn.textContent = 'Practice!';
            nextBtn.disabled = true;
            progressContainer.style.display = 'none';
            this.startPractice(step.duration);
        } else if (step.action === 'finish') {
            nextBtn.textContent = 'Start Playing!';
            nextBtn.disabled = false;
        }
        
        // Handle highlight
        this.updateHighlight(step.target);
    }
    
    activateTab(tabId) {
        // Activate the specified tab
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.tab-panel').forEach(panel => panel.classList.remove('active'));
        
        const tabBtn = document.querySelector(`[data-tab="${tabId}"]`);
        const panel = document.getElementById(tabId + '-panel');
        
        if (tabBtn) tabBtn.classList.add('active');
        if (panel) panel.classList.add('active');
    }
    
    updateHighlight(selector) {
        const highlight = document.getElementById('tutorial-highlight');
        const arrow = document.getElementById('tutorial-arrow');
        
        // Store current selector for repositioning
        this.currentHighlightSelector = selector;
        
        if (!selector) {
            highlight.classList.remove('visible');
            arrow.classList.remove('visible');
            return;
        }
        
        const element = document.querySelector(selector);
        if (!element) {
            console.warn('Tutorial: Element not found:', selector);
            highlight.classList.remove('visible');
            arrow.classList.remove('visible');
            return;
        }
        
        // Position highlight immediately, then reposition after a moment
        this.positionHighlight(element, highlight, arrow);
        
        // Reposition after a short delay to handle any layout shifts
        setTimeout(() => {
            this.positionHighlight(element, highlight, arrow);
        }, 200);
    }
    
    positionHighlight(element, highlight, arrow) {
        const rect = element.getBoundingClientRect();
        
        // Check if element is actually visible (has dimensions)
        if (rect.width === 0 || rect.height === 0) {
            highlight.classList.remove('visible');
            arrow.classList.remove('visible');
            return;
        }
        
        const padding = 10;
        
        highlight.style.left = (rect.left - padding) + 'px';
        highlight.style.top = (rect.top - padding) + 'px';
        highlight.style.width = (rect.width + padding * 2) + 'px';
        highlight.style.height = (rect.height + padding * 2) + 'px';
        highlight.classList.add('visible');
        
        // Position arrow above the element
        arrow.style.left = (rect.left + rect.width / 2 - 18) + 'px';
        arrow.style.top = (rect.top - 50) + 'px';
        arrow.classList.add('visible');
    }
    
    // Reposition highlight when window resizes
    setupResizeHandler() {
        window.addEventListener('resize', () => {
            if (this.currentHighlightSelector) {
                this.updateHighlight(this.currentHighlightSelector);
            }
        });
    }
    
    // Smooth display updates (called from animation loop at 60fps)
    updateSmoothDisplays() {
        if (!this.displayValues) return;
        
        const smoothCookies = Math.floor(this.displayValues.playerCookies);
        
        // Update main cookie count with smooth value
        const cookieCount = document.getElementById('cookie-count');
        if (cookieCount) {
            cookieCount.textContent = smoothCookies.toLocaleString();
        }
        
        // Update locked margin display in real-time as cookies change
        this.updateLockedMarginDisplay();
        
        // Update goal progress smoothly
        const WIN_GOAL = 1000000;
        const progressPercent = Math.min(100, (this.displayValues.playerCookies / WIN_GOAL) * 100);
        const goalProgress = document.getElementById('goal-progress');
        const goalPercent = document.getElementById('goal-percent');
        if (goalProgress) goalProgress.style.width = progressPercent.toFixed(2) + '%';
        if (goalPercent) goalPercent.textContent = progressPercent.toFixed(1) + '%';
    }
    
    updateProgress(step) {
        const pct = (step.progress / step.goal) * 100;
        document.getElementById('progress-fill').style.width = pct + '%';
        document.getElementById('progress-text').textContent = step.progress + '/' + step.goal;
    }
    
    updateDisplays() {
        const cpsValue = document.getElementById('cps-value');
        const clickCount = document.getElementById('click-count');
        const botCookies = document.getElementById('bot-cookies');
        const botCpsDisplay = document.getElementById('bot-cps-display');
        
        // Cookie count now updated smoothly in updateSmoothDisplays()
        // Only update non-animated values here
        if (cpsValue) cpsValue.textContent = this.playerCPS;
        if (clickCount) clickCount.textContent = this.playerClicks;
        
        // Show bot's displayed cookies (might be bluffed)
        const shownBotCookies = this.botBluff.active ? this.botDisplayedCookies : this.botCookies;
        if (botCookies) botCookies.textContent = Math.floor(shownBotCookies) + ' cookies';
        if (botCpsDisplay) botCpsDisplay.textContent = '+' + this.botCPS + '/sec';
        
        // Show real cookie count in a subtle way if bluffing
        if (this.playerBluff.active) {
            let realIndicator = document.getElementById('real-cookie-indicator');
            if (!realIndicator) {
                realIndicator = document.createElement('div');
                realIndicator.id = 'real-cookie-indicator';
                realIndicator.style.cssText = 'position: absolute; bottom: -20px; left: 50%; transform: translateX(-50%); color: #888; font-size: 0.7em;';
                const cookieDisplay = document.querySelector('.cookie-display');
                if (cookieDisplay) {
                    cookieDisplay.style.position = 'relative';
                    cookieDisplay.appendChild(realIndicator);
                }
            }
            if (realIndicator) realIndicator.textContent = '(Real: ' + Math.floor(this.playerCookies) + ')';
        } else {
            const realIndicator = document.getElementById('real-cookie-indicator');
            if (realIndicator) realIndicator.remove();
        }
        
        // Update generator button affordability
        this.updateGeneratorButtons();
    }
    
    updateGeneratorButtons() {
        // Use AVAILABLE cookies (not locked in positions)
        const available = this.getAvailableCookies();
        
        // Generator base costs and scaling
        const generatorData = {
            grandma: { baseCost: 15, cps: 1 },
            bakery: { baseCost: 100, cps: 5 },
            factory: { baseCost: 500, cps: 20 }
        };
        
        Object.keys(generatorData).forEach(genId => {
            const btn = document.getElementById(`generator-${genId}`);
            if (!btn) return;
            
            const owned = this.generators[genId] || 0;
            const data = generatorData[genId];
            // Price increases by 15% each level
            const currentCost = Math.floor(data.baseCost * Math.pow(1.15, owned));
            
            // Update cost display
            const costSpan = btn.querySelector('.cost-value');
            if (costSpan) costSpan.textContent = currentCost;
            
            // Update level display
            const levelSpan = btn.querySelector('.gen-level');
            if (levelSpan) levelSpan.textContent = `Lv.${owned}`;
            
            // Update locked state
            if (available >= currentCost) {
                btn.classList.remove('locked');
            } else {
                btn.classList.add('locked');
            }
        });
    }
    
    getGeneratorCost(genId) {
        const baseCosts = { grandma: 15, bakery: 100, factory: 500 };
        const owned = this.generators[genId] || 0;
        return Math.floor(baseCosts[genId] * Math.pow(1.15, owned));
    }
    
    handleNext() {
        const step = this.steps[this.currentStep];
        
        if (step.action === 'finish') {
            this.completeTutorial();
            return;
        }
        
        if (this.currentStep < this.steps.length - 1) {
            this.showStep(this.currentStep + 1);
        }
    }
    
    handleCookieClick(e) {
        // Track click time for CPS calculation
        this.clickTimes.push(Date.now());
        
        // Calculate cookies with multiplier
        const cookiesEarned = Math.floor(1 * this.clickMultiplier);
        this.playerCookies += cookiesEarned;
        this.playerClicks += 1;
        
        // Visual feedback with multiplier
        this.showClickFeedback(e, cookiesEarned);
        
        // Check step progress (only if tutorial steps exist)
        const step = this.steps[this.currentStep];
        if (step && step.action === 'click') {
            step.progress += 1;
            this.updateProgress(step);
            
            if (step.progress >= step.goal) {
                document.getElementById('next-btn').disabled = false;
                document.getElementById('next-btn').textContent = 'Next';
                setTimeout(() => this.handleNext(), 500);
            }
        }
        
        this.updateDisplays();
    }
    
    showClickFeedback(e, amount = 1) {
        const indicator = document.getElementById('click-indicator');
        if (indicator) {
            const text = amount > 1 ? `+${amount}` : '+1';
            const color = amount >= 3 ? '#f39c12' : (amount >= 2 ? '#2ecc71' : '#ffd700');
            indicator.textContent = text;
            indicator.style.color = color;
            indicator.style.opacity = '1';
            indicator.style.transform = amount > 1 ? 'translate(-50%, -50%) scale(1.3)' : 'translate(-50%, -50%) scale(1)';
            setTimeout(() => {
                indicator.style.opacity = '0';
                indicator.style.transform = 'translate(-50%, -50%) scale(1)';
            }, 300);
        }
    }
    
    handleTabClick(tabId) {
        // Use the centralized activateTab method
        this.activateTab(tabId);
        
        // Check step
        const step = this.steps[this.currentStep];
        if (step.action === 'tab' && step.tabId === tabId) {
            document.getElementById('next-btn').disabled = false;
            document.getElementById('next-btn').textContent = 'Next';
            setTimeout(() => this.handleNext(), 300);
        }
    }
    
    handleGeneratorClick(generatorId) {
        // Use AVAILABLE cookies (not locked in positions)
        const available = this.getAvailableCookies();
        
        // Generator data
        const generatorData = {
            grandma: { baseCost: 15, cps: 1 },
            bakery: { baseCost: 100, cps: 5 },
            factory: { baseCost: 500, cps: 20 }
        };
        
        const data = generatorData[generatorId];
        if (!data) return;
        
        const owned = this.generators[generatorId] || 0;
        const cost = Math.floor(data.baseCost * Math.pow(1.15, owned));
        
        if (available >= cost) {
            this.playerCookies -= cost;
            this.generators[generatorId] += 1;
            this.playerCPS += data.cps;
            
            // Update UI
            const genBtn = document.getElementById(`generator-${generatorId}`);
            if (genBtn) {
                const levelSpan = genBtn.querySelector('.gen-level');
                if (levelSpan) levelSpan.textContent = `Lv.${this.generators[generatorId]}`;
                
                // Update cost to next level
                const newCost = Math.floor(data.baseCost * Math.pow(1.15, this.generators[generatorId]));
                const costSpan = genBtn.querySelector('.cost-value');
                if (costSpan) costSpan.textContent = newCost;
            }
            
            this.showNotification(`${generatorId.charAt(0).toUpperCase() + generatorId.slice(1)} Lv.${this.generators[generatorId]}! +${data.cps}/sec`, 'success');
            this.updateDisplays();
        } else {
            this.showNotification(`Need ${cost} cookies (${Math.floor(available)} available)`, 'warning');
        }
    }
    
    startPractice(duration) {
        this.roundRemaining = duration;
        
        // Create round timer display
        this.createRoundTimerUI();
        
        // Bot will try to bluff at random times
        this.scheduleBotBluff();
        
        const countdown = setInterval(() => {
            this.roundRemaining -= 1;
            this.updateRoundTimerUI();
            document.getElementById('next-btn').textContent = 'Round: ' + this.roundRemaining + 's';
            
            // Bot might start a new bluff randomly
            if (!this.botBluff.active && Math.random() < 0.03) {
                this.startBotBluff();
            }
            
            if (this.roundRemaining <= 0) {
                clearInterval(countdown);
                this.endPractice();
            }
        }, 1000);
    }
    
    createRoundTimerUI() {
        let timerUI = document.getElementById('round-timer-ui');
        if (!timerUI) {
            timerUI = document.createElement('div');
            timerUI.id = 'round-timer-ui';
            timerUI.style.cssText = 'position: fixed; top: 20px; left: 50%; transform: translateX(-50%); background: rgba(0,0,0,0.9); padding: 10px 30px; border-radius: 30px; border: 2px solid #3498db; z-index: 100; text-align: center;';
            document.body.appendChild(timerUI);
        }
        this.updateRoundTimerUI();
    }
    
    updateRoundTimerUI() {
        const timerUI = document.getElementById('round-timer-ui');
        if (!timerUI) return;
        
        const pct = (this.roundRemaining / this.roundTime) * 100;
        const color = this.roundRemaining <= 10 ? '#e74c3c' : (this.roundRemaining <= 30 ? '#f39c12' : '#3498db');
        
        timerUI.innerHTML = `
            <div style="color: #fff; font-size: 0.8em; margin-bottom: 5px;">ROUND TIME</div>
            <div style="color: ${color}; font-size: 2em; font-weight: bold;">${this.roundRemaining}s</div>
            <div style="background: #333; height: 4px; border-radius: 2px; margin-top: 5px; width: 150px;">
                <div style="background: ${color}; height: 100%; width: ${pct}%; border-radius: 2px; transition: width 1s linear;"></div>
            </div>
        `;
    }
    
    scheduleBotBluff() {
        // Bot will bluff 10-20 seconds into the round
        const bluffDelay = 10000 + Math.random() * 10000;
        setTimeout(() => {
            if (this.roundRemaining > 35) {
                this.startBotBluff();
            }
        }, bluffDelay);
    }
    
    startBotBluff() {
        if (this.botBluff.active) return;
        
        this.botBluff = {
            active: true,
            type: Math.random() < 0.5 ? 'inflate' : 'deflate',
            timeRemaining: 30
        };
        
        // Create a spike in displayed cookies
        const adjustment = Math.floor(this.botCookies * 0.5);
        const oldDisplay = this.botDisplayedCookies;
        
        if (this.botBluff.type === 'inflate') {
            this.botDisplayedCookies = this.botCookies + adjustment;
        } else {
            this.botDisplayedCookies = Math.max(0, this.botCookies - adjustment);
        }
        
        // Show spike indicator
        this.botSpikeVisible = true;
        this.showSpikeIndicator();
    }
    
    endPractice() {
        // Clean up
        const timerUI = document.getElementById('round-timer-ui');
        if (timerUI) timerUI.remove();
        
        // Cancel any active player bluff (if they were in the middle of one)
        if (this.playerBluff.active && this.playerBluff.timeRemaining > 0) {
            // Didn't finish the bluff - no bonus
            this.cancelBluff();
        }
        
        // Reveal bluffs and calculate final scores
        let resultMessage = '<div style="text-align: center; padding: 20px;">';
        resultMessage += '<h2 style="color: #f39c12; margin-bottom: 20px;">ROUND OVER!</h2>';
        
        // Bot bluff result
        if (this.botBluff.active) {
            const botBonus = Math.floor(this.botCookies * 0.25);
            this.botCookies += botBonus;
            resultMessage += `<div style="color: #e74c3c; margin: 10px 0; padding: 10px; background: rgba(231,76,60,0.2); border-radius: 8px;">
                <strong>CookieBot's ${this.botBluff.type.toUpperCase()} bluff succeeded!</strong><br>
                You didn't call it! They earned +${botBonus} cookies
            </div>`;
        } else {
            resultMessage += `<div style="color: #888; margin: 10px 0;">CookieBot wasn't bluffing this round.</div>`;
        }
        
        // Final scores
        resultMessage += `<div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #555;">
            <div style="color: #fff; font-size: 1.2em; margin-bottom: 10px;">Final Scores:</div>
            <div style="color: #2ecc71; margin: 5px 0; font-size: 1.3em;">You: ${Math.floor(this.playerCookies)} cookies</div>
            <div style="color: #e74c3c; margin: 5px 0; font-size: 1.3em;">CookieBot: ${Math.floor(this.botCookies)} cookies</div>
        </div>`;
        
        // Winner
        if (this.playerCookies > this.botCookies) {
            resultMessage += '<div style="color: #f1c40f; font-size: 1.5em; margin-top: 15px;">YOU WIN!</div>';
        } else if (this.botCookies > this.playerCookies) {
            resultMessage += '<div style="color: #e74c3c; font-size: 1.5em; margin-top: 15px;">CookieBot Wins!</div>';
        } else {
            resultMessage += '<div style="color: #3498db; font-size: 1.5em; margin-top: 15px;">TIE!</div>';
        }
        
        resultMessage += '</div>';
        
        // Show results modal
        this.showResultsModal(resultMessage);
        
        document.getElementById('next-btn').disabled = false;
        document.getElementById('next-btn').textContent = 'Finish Tutorial';
    }
    
    showResultsModal(content) {
        const modal = document.createElement('div');
        modal.id = 'results-modal';
        modal.style.cssText = 'position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: linear-gradient(135deg, #1a1a2e, #16213e); padding: 30px; border-radius: 15px; border: 3px solid #f39c12; z-index: 200; min-width: 350px; box-shadow: 0 0 50px rgba(243, 156, 18, 0.5);';
        modal.innerHTML = content + '<button onclick="this.parentElement.remove()" style="margin-top: 20px; padding: 10px 30px; background: #f39c12; border: none; border-radius: 5px; color: #000; font-weight: bold; cursor: pointer;">Got it!</button>';
        document.body.appendChild(modal);
    }
    
    showNotification(message, type = 'success') {
        const feed = document.getElementById('notif-feed');
        if (!feed) return;
        
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
    
    skipTutorial() {
        if (confirm('Skip the tutorial?')) {
            this.completeTutorial();
        }
    }
    
    completeTutorial() {
        this.stopGameLoop();
        this.isActive = false;
        
        // Clean up UI
        document.getElementById('tutorial-dialog')?.remove();
        document.getElementById('tutorial-highlight')?.remove();
        document.getElementById('tutorial-arrow')?.remove();
        
        // Save completion
        localStorage.setItem('cc_tutorial_complete', 'true');
        
        // Show final message
        this.showNotification('Tutorial complete! Redirecting...', 'success');
        
        // Redirect
        setTimeout(() => {
            window.location.href = '/dashboard';
        }, 2000);
    }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    window.tutorialManager = new TutorialManager();
    window.tutorialManager.init();
});

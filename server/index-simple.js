const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ['GET', 'POST']
    }
});

// Static files
app.use(express.static(path.join(__dirname, '../public')));

// ==================== LOBBY SYSTEM ====================
const lobbies = new Map(); // lobbyCode -> { players: [], gameState: null, host: null }
const playerLobby = new Map(); // socketId -> lobbyCode

function generateLobbyCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 4; i++) {
        code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
}

function createLobby(hostSocket, hostName) {
    let code = generateLobbyCode();
    while (lobbies.has(code)) {
        code = generateLobbyCode();
    }
    
    const lobby = {
        code,
        host: hostSocket.id,
        players: [{
            id: hostSocket.id,
            name: hostName,
            ready: false,
            cookies: 0,
            cps: 0,
            color: '#2ecc71' // Green for player 1
        }],
        gameState: null,
        inGame: false,
        createdAt: Date.now()
    };
    
    lobbies.set(code, lobby);
    playerLobby.set(hostSocket.id, code);
    hostSocket.join(code);
    
    return lobby;
}

function joinLobby(socket, code, playerName) {
    const lobby = lobbies.get(code.toUpperCase());
    if (!lobby) {
        console.log(`Lobby not found: ${code}`);
        return { error: 'Lobby not found' };
    }
    
    console.log(`Player "${playerName}" trying to join lobby ${code}, inGame: ${lobby.inGame}`);
    
    // If game is in progress, try to reconnect as existing player
    if (lobby.inGame) {
        // Find player by name in game state (case insensitive)
        const existingPlayer = lobby.gameState.players.find(p => 
            p.name.toLowerCase() === playerName.toLowerCase()
        );
        console.log(`Looking for player "${playerName}" in game. Found:`, existingPlayer ? existingPlayer.name : 'NOT FOUND');
        console.log('Current players:', lobby.gameState.players.map(p => p.name));
        
        if (existingPlayer) {
            // Update socket ID for reconnection
            const oldId = existingPlayer.id;
            existingPlayer.id = socket.id;
            
            // Update positions references
            lobby.gameState.positions.forEach(pos => {
                if (pos.owner === oldId) pos.owner = socket.id;
                if (pos.target === oldId) pos.target = socket.id;
            });
            
            // Update lobby player list
            const lobbyPlayer = lobby.players.find(p => p.name === playerName);
            if (lobbyPlayer) lobbyPlayer.id = socket.id;
            
            playerLobby.set(socket.id, code.toUpperCase());
            socket.join(code.toUpperCase());
            
            return { success: true, lobby, reconnected: true };
        }
        console.log(`Cannot reconnect player "${playerName}" - not found in game`);
        return { error: 'Game already in progress' };
    }
    
    if (lobby.players.length >= 4) {
        return { error: 'Lobby is full (max 4 players)' };
    }
    
    // Check if player name already exists
    const existingPlayer = lobby.players.find(p => p.name === playerName);
    if (existingPlayer) {
        // Update socket ID (reconnection to lobby)
        existingPlayer.id = socket.id;
        playerLobby.set(socket.id, code.toUpperCase());
        socket.join(code.toUpperCase());
        return { success: true, lobby };
    }
    
    const colors = ['#2ecc71', '#e74c3c', '#3498db', '#f39c12'];
    const player = {
        id: socket.id,
        name: playerName,
        ready: false,
        cookies: 0,
        cps: 0,
        color: colors[lobby.players.length]
    };
    
    lobby.players.push(player);
    playerLobby.set(socket.id, code.toUpperCase());
    socket.join(code.toUpperCase());
    
    return { success: true, lobby };
}

function leaveLobby(socket) {
    const code = playerLobby.get(socket.id);
    if (!code) return;
    
    const lobby = lobbies.get(code);
    if (!lobby) {
        playerLobby.delete(socket.id);
        return;
    }
    
    // If game is in progress, don't remove players - they can reconnect
    if (lobby.inGame) {
        playerLobby.delete(socket.id);
        socket.leave(code);
        return;
    }
    
    // Remove player from lobby
    lobby.players = lobby.players.filter(p => p.id !== socket.id);
    playerLobby.delete(socket.id);
    socket.leave(code);
    
    // If lobby is empty, delete it
    if (lobby.players.length === 0) {
        lobbies.delete(code);
        return;
    }
    
    // If host left, assign new host
    if (lobby.host === socket.id && lobby.players.length > 0) {
        lobby.host = lobby.players[0].id;
    }
    
    // Notify remaining players
    io.to(code).emit('lobby:update', lobby);
}

// ==================== GAME STATE ====================
function initGameState(lobby) {
    const gameState = {
        startTime: Date.now(),
        players: lobby.players.map(p => ({
            id: p.id,
            name: p.name,
            color: p.color,
            cookies: 0,
            cps: 0,
            clickPower: 1, // Base click power (level 1)
            lastClickTime: 0, // Track last click for activity indicator
            generators: { grandma: 0, bakery: 0, factory: 0, mine: 0, bank: 0, temple: 0, wizard: 0, portal: 0, prism: 0, universe: 0 },
            positions: [], // Positions this player has on others
            positionsOnMe: [] // Positions others have on this player
        })),
        positions: [], // All active positions: { owner, target, type, stake, leverage, entryPrice, liquidationPrice }
        winner: null,
        winGoal: 100000000
    };
    return gameState;
}

// Calculate generator value (90% of what you paid - collateral value)
function calculateGeneratorValue(player) {
    if (!player || !player.generators) return 0;
    
    const basePrices = { grandma: 15, bakery: 100, factory: 500, mine: 2000, bank: 10000, temple: 50000 };
    let totalValue = 0;
    
    for (const [genType, count] of Object.entries(player.generators)) {
        for (let i = 0; i < count; i++) {
            totalValue += Math.floor(basePrices[genType] * Math.pow(1.15, i) * 0.9);
        }
    }
    
    return totalValue;
}

// Force a player to pay an amount - can go into debt up to generator value, then sells all
function forcePayment(player, amount) {
    if (amount <= 0) return;
    
    // Calculate how much generator value (debt limit) they have
    const generatorValue = calculateGeneratorValue(player);
    
    // Current net worth = cookies + generator value
    const currentNetWorth = player.cookies + generatorValue;
    
    // After paying, what would net worth be?
    const newNetWorth = currentNetWorth - amount;
    
    if (newNetWorth >= 0) {
        // Can pay without going bankrupt - just deduct from cookies (can go negative)
        player.cookies -= amount;
        return;
    }
    
    // Would go below 0 net worth - FULL BANKRUPTCY!
    // Sell ALL generators and set cookies to 0
    const generatorOrder = ['grandma', 'bakery', 'factory', 'mine', 'bank', 'temple', 'wizard', 'portal', 'prism', 'universe'];
    
    for (const genType of generatorOrder) {
        player.generators[genType] = 0;
    }
    
    // Update CPS to 0 (no generators)
    player.cps = 0;
    
    // Set cookies to 0 (full bankruptcy)
    player.cookies = 0;
    player.isBankrupt = true;
}

// ==================== SOCKET HANDLERS ====================
io.on('connection', (socket) => {
    console.log(`Player connected: ${socket.id}`);
    
    // Create lobby
    socket.on('lobby:create', (playerName) => {
        const lobby = createLobby(socket, playerName || 'Player');
        socket.emit('lobby:created', lobby);
    });
    
    // Join lobby
    socket.on('lobby:join', ({ code, playerName }) => {
        const result = joinLobby(socket, code, playerName || 'Player');
        if (result.error) {
            console.log('Sending lobby:error to', socket.id, ':', result.error);
            socket.emit('lobby:error', result.error);
        } else {
            // If reconnecting to in-progress game, send game state
            if (result.reconnected && result.lobby.inGame) {
                console.log('Player reconnected, sending game:started to', socket.id);
                socket.emit('lobby:joined', result.lobby);
                socket.emit('game:started', result.lobby.gameState);
            } else {
                socket.emit('lobby:joined', result.lobby);
                io.to(code.toUpperCase()).emit('lobby:update', result.lobby);
            }
        }
    });
    
    // Leave lobby
    socket.on('lobby:leave', () => {
        leaveLobby(socket);
    });
    
    // Toggle ready
    socket.on('lobby:ready', (ready) => {
        const code = playerLobby.get(socket.id);
        if (!code) return;
        
        const lobby = lobbies.get(code);
        if (!lobby) return;
        
        const player = lobby.players.find(p => p.id === socket.id);
        if (player) {
            player.ready = ready;
            io.to(code).emit('lobby:update', lobby);
        }
    });
    
    // Start game (host only)
    socket.on('game:start', () => {
        const code = playerLobby.get(socket.id);
        if (!code) return;
        
        const lobby = lobbies.get(code);
        if (!lobby || lobby.host !== socket.id) return;
        
        // For testing, allow 1 player - change to 2 for production
        if (lobby.players.length < 1) {
            socket.emit('lobby:error', 'Need at least 2 players to start');
            return;
        }
        
        // Check all players ready (host doesn't need to ready)
        const allReady = lobby.players.every(p => p.id === lobby.host || p.ready);
        if (!allReady && lobby.players.length > 1) {
            socket.emit('lobby:error', 'All players must be ready');
            return;
        }
        
        console.log('Starting game for lobby', code, 'with players:', lobby.players.map(p => p.name));
        
        // Initialize game
        lobby.inGame = true;
        lobby.gameState = initGameState(lobby);
        
        io.to(code).emit('game:started', lobby.gameState);
    });
    
    // ==================== IN-GAME EVENTS ====================
    
    // Cookie click - with multiplier support
    socket.on('game:click', (data) => {
        const code = playerLobby.get(socket.id);
        if (!code) {
            console.log('game:click - no lobby code for socket', socket.id);
            return;
        }
        
        const lobby = lobbies.get(code);
        if (!lobby || !lobby.gameState) {
            console.log('game:click - no lobby or game state for code', code);
            return;
        }
        
        const player = lobby.gameState.players.find(p => p.id === socket.id);
        if (!player) {
            console.log('game:click - player not found for socket', socket.id);
            console.log('Players in game:', lobby.gameState.players.map(p => ({name: p.name, id: p.id})));
            return;
        }
        
        // Support multiplier from client (validated to reasonable range), multiplied by click power
        const multiplier = Math.min(20, Math.max(1, data?.multiplier || 1));
        const clickLevel = player.clickPower || 1;
        // Exponential click power: level 1 = 1, level 2 = 2, level 3 = 4, level 4 = 8, etc.
        const clickPower = Math.pow(2, clickLevel - 1);
        player.cookies += Math.floor(multiplier * clickPower);
        player.lastClickTime = Date.now();
        
        // Broadcast click activity to other players
        socket.to(code).emit('game:playerClicked', { playerName: player.name });
        
        io.to(code).emit('game:state', lobby.gameState);
    });
    
    // Cursor position relay - broadcast to other players
    socket.on('game:cursor', ({ x, y }) => {
        const code = playerLobby.get(socket.id);
        if (!code) return;
        
        const lobby = lobbies.get(code);
        if (!lobby || !lobby.gameState) return;
        
        const player = lobby.gameState.players.find(p => p.id === socket.id);
        if (!player) return;
        
        // Broadcast cursor to other players in the room
        console.log('Broadcasting cursor from', player.name, 'to room', code);
        socket.to(code).emit('game:cursor', {
            playerName: player.name,
            color: player.color || '#ffffff',
            x,
            y
        });
    });
    
    // Buy generator
    socket.on('game:buy', (generatorType) => {
        const code = playerLobby.get(socket.id);
        if (!code) return;
        
        const lobby = lobbies.get(code);
        if (!lobby || !lobby.gameState) return;
        
        const player = lobby.gameState.players.find(p => p.id === socket.id);
        if (!player) return;
        
        const prices = {
            grandma: 15 * Math.pow(1.15, player.generators.grandma),
            bakery: 100 * Math.pow(1.15, player.generators.bakery),
            factory: 500 * Math.pow(1.15, player.generators.factory),
            mine: 2000 * Math.pow(1.15, player.generators.mine),
            bank: 10000 * Math.pow(1.15, player.generators.bank),
            temple: 50000 * Math.pow(1.15, player.generators.temple),
            wizard: 200000 * Math.pow(1.15, player.generators.wizard),
            portal: 1000000 * Math.pow(1.15, player.generators.portal),
            prism: 5000000 * Math.pow(1.15, player.generators.prism),
            universe: 25000000 * Math.pow(1.15, player.generators.universe)
        };
        
        const cpsValues = { grandma: 1, bakery: 5, factory: 20, mine: 100, bank: 500, temple: 2500, wizard: 10000, portal: 50000, prism: 250000, universe: 1000000 };
        
        const price = Math.floor(prices[generatorType]);
        if (player.cookies >= price) {
            player.cookies -= price;
            player.generators[generatorType]++;
            player.cps = player.generators.grandma * 1 + 
                         player.generators.bakery * 5 + 
                         player.generators.factory * 20 +
                         player.generators.mine * 100 +
                         player.generators.bank * 500 +
                         player.generators.temple * 2500 +
                         player.generators.wizard * 10000 +
                         player.generators.portal * 50000 +
                         player.generators.prism * 250000 +
                         player.generators.universe * 1000000;
            
            io.to(code).emit('game:state', lobby.gameState);
        }
    });
    
    // Upgrade click power - cookies are spent permanently (not part of net worth)
    socket.on('game:upgradeClick', () => {
        const code = playerLobby.get(socket.id);
        if (!code) return;
        
        const lobby = lobbies.get(code);
        if (!lobby || !lobby.gameState) return;
        
        const player = lobby.gameState.players.find(p => p.id === socket.id);
        if (!player) return;
        
        // Price scales exponentially: 100, 500, 2500, 12500, etc.
        const basePrice = 100;
        const currentLevel = player.clickPower || 1;
        const price = Math.floor(basePrice * Math.pow(5, currentLevel - 1));
        
        if (player.cookies >= price) {
            player.cookies -= price;
            player.clickPower = currentLevel + 1;
            io.to(code).emit('game:state', lobby.gameState);
        }
    });
    
    // Open position - now uses targetName for stability
    socket.on('game:openPosition', ({ targetName, type, stake, leverage }) => {
        console.log('game:openPosition received:', { targetName, type, stake, leverage });
        
        const code = playerLobby.get(socket.id);
        if (!code) {
            console.log('openPosition: no lobby code');
            return;
        }
        
        const lobby = lobbies.get(code);
        if (!lobby || !lobby.gameState) {
            console.log('openPosition: no lobby or gameState');
            return;
        }
        
        // Find player by socket ID (current connection)
        const player = lobby.gameState.players.find(p => p.id === socket.id);
        // Find target by NAME (stable identifier)
        const target = lobby.gameState.players.find(p => p.name === targetName);
        
        if (!player || !target || player.name === target.name) {
            console.log('openPosition failed:', { player: player?.name, targetName, found: !!target });
            return;
        }
        
        // Validation
        const available = player.cookies - player.positions.reduce((sum, p) => sum + p.stake, 0);
        if (stake > available) {
            console.log('openPosition: stake > available', { stake, available });
            socket.emit('game:error', { message: `Not enough available cookies! Have ${Math.floor(available)}` });
            return;
        }
        if (target.cookies < 500) {
            console.log('openPosition: target cookies < 500', { targetCookies: target.cookies });
            socket.emit('game:error', { message: `${target.name} needs at least 500🍪 to trade on!` });
            return;
        }
        
        // Max total stake on target = 50% of their COOKIES (not net worth)
        const existingStakes = player.positions
            .filter(p => p.targetName === target.name)
            .reduce((sum, p) => sum + p.stake, 0);
        const newTotalStake = existingStakes + stake;
        const maxTotalStake = Math.floor(target.cookies * 0.5);
        
        console.log('openPosition: stake check', { 
            targetName: target.name,
            targetCookies: target.cookies,
            existingStakes, 
            newTotalStake, 
            maxTotalStake, 
            willReject: newTotalStake > maxTotalStake 
        });
        
        if (newTotalStake > maxTotalStake) {
            console.log('openPosition: REJECTING - stake too large', { newTotalStake, maxTotalStake });
            socket.emit('game:error', { message: `Max stake on ${target.name} is ${maxTotalStake}🍪 (50% of cookies)` });
            return;
        }
        
        const entryPrice = target.cookies;
        const liquidationPercent = 1 / leverage;
        let liquidationPrice;
        
        if (type === 'long') {
            liquidationPrice = entryPrice * (1 - liquidationPercent);
            if (liquidationPrice < 10) {
                console.log('openPosition: LONG liquidation < 10', { liquidationPrice, entryPrice, leverage });
                return;
            }
        } else {
            liquidationPrice = entryPrice * (1 + liquidationPercent);
        }
        
        // Check if there's an existing position with same type and leverage to add to
        const existingPos = player.positions.find(p => 
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
            
            console.log('openPosition: added to existing position', { totalStake, weightedEntry });
            
            io.to(code).emit('game:state', lobby.gameState);
            io.to(target.id).emit('game:positionOpened', { by: player.name });
            return;
        }
        
        console.log('openPosition: creating position', { type, stake, leverage, entryPrice, liquidationPrice });
        
        const position = {
            id: Date.now() + '-' + Math.random().toString(36).substr(2, 9),
            owner: socket.id,
            ownerName: player.name,
            target: target.id,
            targetName: target.name,
            type,
            stake,
            leverage,
            entryPrice,
            liquidationPrice,
            openTime: Date.now()
        };
        
        player.positions.push(position);
        target.positionsOnMe.push(position);
        lobby.gameState.positions.push(position);
        
        io.to(code).emit('game:state', lobby.gameState);
        // Notify target using their current socket ID
        io.to(target.id).emit('game:positionOpened', { by: player.name });
    });
    
    // Close position
    socket.on('game:closePosition', (positionId) => {
        console.log('game:closePosition received:', positionId, 'from socket:', socket.id);
        
        const code = playerLobby.get(socket.id);
        if (!code) {
            console.log('closePosition: no lobby code found for socket');
            return;
        }
        
        const lobby = lobbies.get(code);
        if (!lobby || !lobby.gameState) {
            console.log('closePosition: lobby or gameState not found');
            return;
        }
        
        // Find position by ID, owner can be by current socket.id OR by name
        const player = lobby.gameState.players.find(p => p.id === socket.id);
        if (!player) {
            console.log('closePosition: player not found for socket.id:', socket.id);
            console.log('Players:', lobby.gameState.players.map(p => ({id: p.id, name: p.name})));
            return;
        }
        
        const posIndex = lobby.gameState.positions.findIndex(p => p.id === positionId && p.ownerName === player.name);
        if (posIndex === -1) {
            console.log('closePosition: position not found. Looking for id:', positionId, 'ownerName:', player.name);
            console.log('All positions:', lobby.gameState.positions.map(p => ({id: p.id, ownerName: p.ownerName})));
            return;
        }
        
        console.log('closePosition: found position, closing...');
        
        const position = lobby.gameState.positions[posIndex];
        const target = lobby.gameState.players.find(p => p.name === position.targetName);
        
        if (!target) {
            console.log('closePosition: target not found');
            return;
        }
        
        // Calculate PNL
        const currentPrice = target.cookies;
        const priceChange = currentPrice - position.entryPrice;
        const pnlMultiplier = position.type === 'long' ? 1 : -1;
        const pnl = Math.floor((priceChange / (position.entryPrice || 1)) * position.stake * position.leverage * pnlMultiplier);
        
        console.log('closePosition: PNL calculation', {
            currentPrice,
            entryPrice: position.entryPrice,
            priceChange,
            type: position.type,
            stake: position.stake,
            leverage: position.leverage,
            pnl
        });
        
        // NOTE: Stake is NOT deducted when opening (uses locked margin), so don't add it back here
        const oldPlayerCookies = player.cookies;
        const oldTargetCookies = target.cookies;
        
        if (pnl > 0) {
            // Player is in profit - force target to pay (sell generators, go into debt)
            forcePayment(target, pnl);
            player.cookies += pnl;
            console.log('closePosition: PROFIT', { 
                pnl, 
                playerGot: pnl, 
                targetPaid: pnl 
            });
        } else if (pnl < 0) {
            // Player is in loss - their stake was already locked, just transfer loss to target
            // DON'T call forcePayment on player - stake is already locked
            const loss = Math.min(Math.abs(pnl), position.stake);
            target.cookies += loss;
            console.log('closePosition: LOSS', { 
                pnlLoss: pnl, 
                actualLoss: loss, 
                targetGot: loss 
            });
        } else {
            console.log('closePosition: BREAKEVEN');
        }
        
        console.log('closePosition: Final cookies', {
            player: player.name,
            playerOld: oldPlayerCookies,
            playerNew: player.cookies,
            target: target.name,
            targetOld: oldTargetCookies,
            targetNew: target.cookies
        });
        
        // Remove position
        lobby.gameState.positions.splice(posIndex, 1);
        player.positions = player.positions.filter(p => p.id !== positionId);
        target.positionsOnMe = target.positionsOnMe.filter(p => p.id !== positionId);
        
        // Send notifications about the closed position
        const targetSocket = lobby.gameState.players.find(p => p.name === target.name);
        if (pnl > 0) {
            // Trader won, target lost
            socket.emit('game:positionClosed', { 
                type: 'profit',
                message: `💰 Closed ${position.type.toUpperCase()} on ${target.name}: +${pnl}🍪 profit!`,
                amount: pnl,
                targetName: target.name
            });
            if (targetSocket && targetSocket.id) {
                io.to(targetSocket.id).emit('game:positionClosed', {
                    type: 'loss',
                    message: `😢 ${player.name} took ${pnl}🍪 from you!`,
                    amount: pnl,
                    fromPlayer: player.name
                });
            }
        } else if (pnl < 0) {
            // Trader lost, target won
            const loss = Math.min(Math.abs(pnl), position.stake);
            socket.emit('game:positionClosed', {
                type: 'loss',
                message: `😢 Closed ${position.type.toUpperCase()} on ${target.name}: -${loss}🍪 loss`,
                amount: loss,
                targetName: target.name
            });
            if (targetSocket && targetSocket.id) {
                io.to(targetSocket.id).emit('game:positionClosed', {
                    type: 'profit',
                    message: `💰 ${player.name} lost ${loss}🍪 to you!`,
                    amount: loss,
                    fromPlayer: player.name
                });
            }
        } else {
            // Breakeven
            socket.emit('game:positionClosed', {
                type: 'neutral',
                message: `Closed ${position.type.toUpperCase()} on ${target.name}: breakeven`,
                amount: 0,
                targetName: target.name
            });
        }
        
        io.to(code).emit('game:state', lobby.gameState);
    });
    
    // Disconnect
    socket.on('disconnect', () => {
        console.log(`Player disconnected: ${socket.id}`);
        leaveLobby(socket);
    });
});

// ==================== GAME TICK ====================
setInterval(() => {
    lobbies.forEach((lobby, code) => {
        if (!lobby.inGame || !lobby.gameState) return;
        
        const gs = lobby.gameState;
        
        // Apply CPS to all players
        gs.players.forEach(player => {
            if (player.cps > 0) {
                player.cookies += player.cps * 0.5; // 500ms tick
            }
        });
        
        // Check positions for liquidation and max payout
        // First, collect all positions that need to be settled and sort by profitability
        const positionsToCheck = [];
        
        for (let i = gs.positions.length - 1; i >= 0; i--) {
            const pos = gs.positions[i];
            const owner = gs.players.find(p => p.name === pos.ownerName);
            const target = gs.players.find(p => p.name === pos.targetName);
            
            if (!owner || !target) continue;
            
            const currentPrice = target.cookies;
            const priceChange = currentPrice - pos.entryPrice;
            const pnlMultiplier = pos.type === 'long' ? 1 : -1;
            const pnl = Math.floor((priceChange / (pos.entryPrice || 1)) * pos.stake * pos.leverage * pnlMultiplier);
            
            positionsToCheck.push({ pos, owner, target, currentPrice, pnl, index: i });
        }
        
        // Process liquidations first (owner loses)
        for (const { pos, owner, target, currentPrice, pnl, index } of positionsToCheck) {
            if ((pos.type === 'long' && currentPrice <= pos.liquidationPrice) ||
                (pos.type === 'short' && currentPrice >= pos.liquidationPrice)) {
                // Owner loses stake - stake was already locked (not deducted), so just transfer to target
                // DON'T call forcePayment - the stake is already "removed" from available balance
                target.cookies += pos.stake;
                console.log(`Position liquidated: ${owner.name} loses stake ${pos.stake} to ${target.name}`);
                
                // Remove position
                const posIdx = gs.positions.findIndex(p => p.id === pos.id);
                if (posIdx >= 0) gs.positions.splice(posIdx, 1);
                owner.positions = owner.positions.filter(p => p.id !== pos.id);
                target.positionsOnMe = target.positionsOnMe.filter(p => p.id !== pos.id);
                
                // Notify owner they got liquidated (lost)
                io.to(owner.id).emit('game:liquidated', { position: pos });
                // Notify target they won (liquidated someone)
                io.to(target.id).emit('game:youLiquidatedSomeone', { position: pos, from: owner.name, amount: pos.stake });
            }
        }
        
        // Recalculate positions after liquidations
        // Now handle profitable positions - force payment from targets
        const profitableByTarget = {};
        
        for (const { pos, owner, target, pnl } of positionsToCheck) {
            // Skip already removed positions
            if (!gs.positions.find(p => p.id === pos.id)) continue;
            if (pnl <= 0) continue;
            
            if (!profitableByTarget[target.name]) {
                profitableByTarget[target.name] = [];
            }
            profitableByTarget[target.name].push({ pos, owner, target, pnl });
        }
        
        // For each target, check if they need to pay - use forcePayment
        for (const [targetName, positions] of Object.entries(profitableByTarget)) {
            const target = gs.players.find(p => p.name === targetName);
            if (!target) continue;
            
            const totalOwed = positions.reduce((sum, p) => sum + p.pnl, 0);
            
            // Calculate target's debt limit (generator value)
            const generatorValue = calculateGeneratorValue(target);
            const netWorthAfterPaying = target.cookies + generatorValue - totalOwed;
            
            // Only force close if paying would exceed debt limit (net worth goes negative)
            if (netWorthAfterPaying < 0) {
                // Force close all positions - target can't recover
                for (const { pos, owner, pnl } of positions) {
                    // Force the target to pay (will trigger bankruptcy)
                    forcePayment(target, pnl);
                    // NOTE: Stake was never deducted (locked margin), don't add it back
                    owner.cookies += pnl;
                    
                    console.log(`Auto-close: ${owner.name} gets pnl ${pnl} from ${target.name}`);
                    
                    // Remove position
                    const posIdx = gs.positions.findIndex(p => p.id === pos.id);
                    if (posIdx >= 0) gs.positions.splice(posIdx, 1);
                    owner.positions = owner.positions.filter(p => p.id !== pos.id);
                    target.positionsOnMe = target.positionsOnMe.filter(p => p.id !== pos.id);
                    
                    io.to(owner.id).emit('game:maxPayout', { position: pos, amount: pnl });
                }
            }
        }
        
        // Check win condition
        const winner = gs.players.find(p => p.cookies >= gs.winGoal);
        if (winner && !gs.winner) {
            gs.winner = winner;
            io.to(code).emit('game:winner', winner);
        }
        
        // Send state update
        io.to(code).emit('game:state', gs);
    });
}, 500);

// ==================== PAGE ROUTES ====================
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.get('/game', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/pages/game.html'));
});

// 404
app.use((req, res) => {
    res.status(404).send('Page not found');
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`
    🍪 ═══════════════════════════════════════════ 🍪
    
         COOKIE CONQUEST - MULTIPLAYER
         
         Port: ${PORT}
         Open http://localhost:${PORT}
         
    🍪 ═══════════════════════════════════════════ 🍪
    `);
});

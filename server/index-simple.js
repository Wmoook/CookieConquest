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
            generators: { grandma: 0, bakery: 0, factory: 0, mine: 0, bank: 0, temple: 0 },
            positions: [], // Positions this player has on others
            positionsOnMe: [] // Positions others have on this player
        })),
        positions: [], // All active positions: { owner, target, type, stake, leverage, entryPrice, liquidationPrice }
        winner: null,
        winGoal: 1000000
    };
    return gameState;
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
        
        // Support multiplier from client (validated to reasonable range)
        const multiplier = Math.min(20, Math.max(1, data?.multiplier || 1));
        player.cookies += Math.floor(multiplier);
        io.to(code).emit('game:state', lobby.gameState);
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
            temple: 50000 * Math.pow(1.15, player.generators.temple)
        };
        
        const cpsValues = { grandma: 1, bakery: 5, factory: 20, mine: 100, bank: 500, temple: 2500 };
        
        const price = Math.floor(prices[generatorType]);
        if (player.cookies >= price) {
            player.cookies -= price;
            player.generators[generatorType]++;
            player.cps = player.generators.grandma * 1 + 
                         player.generators.bakery * 5 + 
                         player.generators.factory * 20 +
                         player.generators.mine * 100 +
                         player.generators.bank * 500 +
                         player.generators.temple * 2500;
            
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
            return;
        }
        if (target.cookies < 100) {
            console.log('openPosition: target cookies < 100', { targetCookies: target.cookies });
            return;
        }
        if (stake > target.cookies * 0.5) {
            console.log('openPosition: stake > 50% of target', { stake, targetCookies: target.cookies });
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
        
        // MARKET IMPACT: Opening positions affect target's cookies
        // Long = buying pressure = pushes price UP
        // Short = selling pressure = pushes price DOWN
        const impactPercent = (stake * leverage) / (target.cookies * 10); // ~1% per 10% of target's cookies
        const impactAmount = Math.floor(target.cookies * Math.min(impactPercent, 0.1)); // Cap at 10% max impact
        
        if (type === 'long' && impactAmount > 0) {
            target.cookies += impactAmount;
            console.log('MARKET IMPACT: LONG opened, target +', impactAmount, 'cookies');
            io.to(code).emit('game:notification', { 
                type: 'market', 
                message: `📈 ${player.name} LONG on ${target.name} pushed price UP +${impactAmount}🍪!` 
            });
        } else if (type === 'short' && impactAmount > 0) {
            target.cookies = Math.max(10, target.cookies - impactAmount); // Don't go below 10
            console.log('MARKET IMPACT: SHORT opened, target -', impactAmount, 'cookies');
            io.to(code).emit('game:notification', { 
                type: 'market', 
                message: `📉 ${player.name} SHORT on ${target.name} pushed price DOWN -${impactAmount}🍪!` 
            });
        }
        
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
        
        // Return stake first
        const oldPlayerCookies = player.cookies;
        const oldTargetCookies = target.cookies;
        
        player.cookies += position.stake;
        
        if (pnl > 0) {
            // Player is in profit - take from target (capped at what target has)
            const actualPnl = Math.min(pnl, target.cookies);
            player.cookies += actualPnl;
            target.cookies -= actualPnl;
            console.log('closePosition: PROFIT', { 
                requestedPnl: pnl, 
                actualPnl, 
                playerGot: position.stake + actualPnl, 
                targetLost: actualPnl 
            });
        } else if (pnl < 0) {
            // Player is in loss - give to target (capped at stake)
            const loss = Math.min(Math.abs(pnl), position.stake);
            player.cookies -= loss;
            target.cookies += loss;
            console.log('closePosition: LOSS', { 
                pnlLoss: pnl, 
                actualLoss: loss, 
                playerNet: position.stake - loss, 
                targetGot: loss 
            });
        } else {
            console.log('closePosition: BREAKEVEN', { playerGot: position.stake });
        }
        
        console.log('closePosition: Final cookies', {
            player: player.name,
            playerOld: oldPlayerCookies,
            playerNew: player.cookies,
            target: target.name,
            targetOld: oldTargetCookies,
            targetNew: target.cookies
        });
        
        // MARKET IMPACT: Closing positions have reverse effect
        // Closing Long = selling = pushes price DOWN
        // Closing Short = buying back = pushes price UP
        const impactPercent = (position.stake * position.leverage) / (target.cookies * 10);
        const impactAmount = Math.floor(target.cookies * Math.min(impactPercent, 0.05)); // Cap at 5% for closes
        
        if (position.type === 'long' && impactAmount > 0) {
            target.cookies = Math.max(10, target.cookies - impactAmount);
            console.log('MARKET IMPACT: LONG closed, target -', impactAmount, 'cookies');
        } else if (position.type === 'short' && impactAmount > 0) {
            target.cookies += impactAmount;
            console.log('MARKET IMPACT: SHORT closed, target +', impactAmount, 'cookies');
        }
        
        // Remove position
        lobby.gameState.positions.splice(posIndex, 1);
        player.positions = player.positions.filter(p => p.id !== positionId);
        target.positionsOnMe = target.positionsOnMe.filter(p => p.id !== positionId);
        
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
                // Owner loses stake to target
                target.cookies += pos.stake;
                console.log(`Position liquidated: ${owner.name} on ${target.name}, stake ${pos.stake} goes to target`);
                
                // Remove position
                const posIdx = gs.positions.findIndex(p => p.id === pos.id);
                if (posIdx >= 0) gs.positions.splice(posIdx, 1);
                owner.positions = owner.positions.filter(p => p.id !== pos.id);
                target.positionsOnMe = target.positionsOnMe.filter(p => p.id !== pos.id);
                
                io.to(owner.id).emit('game:liquidated', { position: pos });
            }
        }
        
        // Recalculate positions after liquidations
        // Now handle profitable positions - pay out proportionally if target can't cover all
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
        
        // For each target, check if they can pay all profitable positions
        for (const [targetName, positions] of Object.entries(profitableByTarget)) {
            const target = gs.players.find(p => p.name === targetName);
            if (!target) continue;
            
            const totalOwed = positions.reduce((sum, p) => sum + p.pnl, 0);
            
            if (totalOwed >= target.cookies && target.cookies > 0) {
                // Target can't pay everyone - distribute proportionally
                const availableCookies = target.cookies;
                
                for (const { pos, owner, pnl } of positions) {
                    // Calculate this position's share
                    const share = pnl / totalOwed;
                    const payout = Math.floor(availableCookies * share);
                    
                    // Return stake + proportional payout
                    owner.cookies += pos.stake + payout;
                    
                    console.log(`Max payout (proportional): ${owner.name} gets stake ${pos.stake} + payout ${payout} from ${target.name}`);
                    
                    // Remove position
                    const posIdx = gs.positions.findIndex(p => p.id === pos.id);
                    if (posIdx >= 0) gs.positions.splice(posIdx, 1);
                    owner.positions = owner.positions.filter(p => p.id !== pos.id);
                    target.positionsOnMe = target.positionsOnMe.filter(p => p.id !== pos.id);
                    
                    io.to(owner.id).emit('game:maxPayout', { position: pos, amount: payout });
                }
                
                // Target loses all cookies
                target.cookies = 0;
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

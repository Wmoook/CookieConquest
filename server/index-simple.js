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

function createLobby(hostSocket, hostName, gameMode = 'solos') {
    let code = generateLobbyCode();
    while (lobbies.has(code)) {
        code = generateLobbyCode();
    }
    
    const lobby = {
        code,
        host: hostSocket.id,
        gameMode: gameMode, // 'solos' or 'duos'
        players: [{
            id: hostSocket.id,
            name: hostName,
            ready: false,
            cookies: 0,
            cps: 0,
            color: '#e74c3c', // Red - green is reserved for client-side 'you'
            team: null // Must pick team manually in duos
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
    
    console.log(`Player "${playerName}" trying to join lobby ${code}, inGame: ${lobby.inGame}, gameMode: ${lobby.gameMode}`);
    
    // If game is in progress, try to reconnect as existing player
    if (lobby.inGame) {
        // Find player by name in game state (case insensitive)
        // Check gameMode from lobby OR from gameState
        const gameMode = lobby.gameMode || lobby.gameState?.gameMode || 'solos';
        let existingPlayer = null;
        
        console.log(`[RECONNECT] Game mode: ${gameMode}, looking for "${playerName}"`);
        
        if (gameMode === 'duos') {
            // In duos, find the team that has this player as a member
            console.log(`[RECONNECT] Duos mode - searching memberNames for "${playerName}"`);
            for (const team of lobby.gameState.players) {
                console.log(`[RECONNECT] Checking team:`, team.name, 'isTeam:', team.isTeam, 'memberNames:', team.memberNames);
                if (team.isTeam && team.memberNames) {
                    const found = team.memberNames.some(n => n.toLowerCase() === playerName.toLowerCase());
                    if (found) {
                        existingPlayer = team;
                        console.log(`[RECONNECT] Found player in team:`, team.name);
                        break;
                    }
                }
            }
        } else {
            // In solos, find by exact name match
            existingPlayer = lobby.gameState.players.find(p => 
                p.name.toLowerCase() === playerName.toLowerCase()
            );
        }
        
        console.log(`Looking for player "${playerName}" in game. Found:`, existingPlayer ? existingPlayer.name : 'NOT FOUND');
        console.log('Current players:', lobby.gameState.players.map(p => p.name));
        
        if (existingPlayer) {
            // Update socket ID for reconnection
            const oldId = existingPlayer.id;
            
            // In duos, update the memberIds array
            if (existingPlayer.isTeam && existingPlayer.memberIds) {
                const memberIndex = existingPlayer.memberNames.findIndex(n => 
                    n.toLowerCase() === playerName.toLowerCase()
                );
                console.log(`[RECONNECT] Updating memberIds[${memberIndex}] from`, existingPlayer.memberIds[memberIndex], 'to', socket.id);
                if (memberIndex !== -1) {
                    existingPlayer.memberIds[memberIndex] = socket.id;
                }
            } else {
                existingPlayer.id = socket.id;
            }
            
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
            
            console.log(`[RECONNECT] Success! Player "${playerName}" reconnected`);
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
    
    // Colors for players - green (#2ecc71) is reserved for client-side 'you' display
    const colors = ['#e74c3c', '#3498db', '#f39c12', '#9b59b6', '#1abc9c', '#e91e63', '#00bcd4', '#ff5722'];
    
    const player = {
        id: socket.id,
        name: playerName,
        ready: false,
        cookies: 0,
        cps: 0,
        color: colors[lobby.players.length % colors.length],
        team: null // Must pick team manually in duos
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
    const now = Date.now();
    const isDuos = lobby.gameMode === 'duos';
    
    // For DUOS: Create teams instead of individual players
    let gameEntities = [];
    
    if (isDuos) {
        // Group players by team
        const team1Players = lobby.players.filter(p => p.team === 1);
        const team2Players = lobby.players.filter(p => p.team === 2);
        
        // Create team entities - teams share EVERYTHING
        gameEntities = [
            {
                id: 'team1',
                isTeam: true,
                teamNumber: 1,
                name: `${team1Players[0]?.name || 'Player1'} + ${team1Players[1]?.name || 'Player2'}`,
                memberIds: team1Players.map(p => p.id),
                memberNames: team1Players.map(p => p.name),
                color: '#e74c3c', // Red team
                cookies: 0,
                cps: 0,
                baseCps: 0,
                clickPower: 1,
                lastClickTime: 0,
                generators: { grandma: 0, bakery: 0, factory: 0, mine: 0, bank: 0, temple: 0, wizard: 0, portal: 0, prism: 0, universe: 0 },
                positions: [],
                positionsOnMe: [],
                powerBuffs: 0,
                cookieZoneTime: 0,
                frozenSecondsLeft: 0,
                invisibleSecondsLeft: 0
            },
            {
                id: 'team2',
                isTeam: true,
                teamNumber: 2,
                name: `${team2Players[0]?.name || 'Player3'} + ${team2Players[1]?.name || 'Player4'}`,
                memberIds: team2Players.map(p => p.id),
                memberNames: team2Players.map(p => p.name),
                color: '#3498db', // Blue team
                cookies: 0,
                cps: 0,
                baseCps: 0,
                clickPower: 1,
                lastClickTime: 0,
                generators: { grandma: 0, bakery: 0, factory: 0, mine: 0, bank: 0, temple: 0, wizard: 0, portal: 0, prism: 0, universe: 0 },
                positions: [],
                positionsOnMe: [],
                powerBuffs: 0,
                cookieZoneTime: 0,
                frozenSecondsLeft: 0,
                invisibleSecondsLeft: 0
            }
        ];
    } else {
        // Solos mode - individual players
        gameEntities = lobby.players.map(p => ({
            id: p.id,
            name: p.name,
            color: p.color,
            cookies: 0,
            cps: 0,
            baseCps: 0,
            clickPower: 1,
            lastClickTime: 0,
            generators: { grandma: 0, bakery: 0, factory: 0, mine: 0, bank: 0, temple: 0, wizard: 0, portal: 0, prism: 0, universe: 0 },
            positions: [],
            positionsOnMe: [],
            powerBuffs: 0,
            cookieZoneTime: 0,
            frozenSecondsLeft: 0,
            invisibleSecondsLeft: 0
        }));
    }
    
    const gameState = {
        startTime: now,
        serverTime: now,
        gameMode: lobby.gameMode, // 'solos' or 'duos'
        players: gameEntities, // In duos, these are teams not individual players
        positions: [],
        winner: null,
        winGoal: 100000000,
        kothRoundElapsed: 0,
        kothRoundDuration: 60000
    };
    return gameState;
}

// Helper: Find a player's entity (in duos, find their team)
function findPlayerEntity(gameState, socketId) {
    if (gameState.gameMode === 'duos') {
        // In duos, find the team this socket belongs to
        return gameState.players.find(team => 
            team.isTeam && team.memberIds && team.memberIds.includes(socketId)
        );
    } else {
        // In solos, find the player directly
        return gameState.players.find(p => p.id === socketId);
    }
}

// Calculate generator value (90% of what you paid - collateral value)
function calculateGeneratorValue(player) {
    if (!player || !player.generators) return 0;
    
    const basePrices = { 
        grandma: 15, 
        bakery: 100, 
        factory: 500, 
        mine: 2000, 
        bank: 10000, 
        temple: 50000, 
        wizard: 200000, 
        portal: 1000000, 
        prism: 5000000, 
        universe: 25000000 
    };
    let totalValue = 0;
    
    for (const [genType, count] of Object.entries(player.generators)) {
        const basePrice = basePrices[genType];
        if (!basePrice) continue; // Skip unknown generator types
        for (let i = 0; i < count; i++) {
            totalValue += Math.floor(basePrice * Math.pow(1.15, i) * 0.9);
        }
    }
    
    return totalValue;
}

// Force a player to pay an amount - can go into debt up to generator value, then sells all
function forcePayment(player, amount, reason = 'unknown') {
    if (amount <= 0) return;
    
    console.log(`[FORCE_PAYMENT] ${player.name}: amount=${amount}, reason=${reason}, cookies_before=${player.cookies}`);
    
    // Calculate how much generator value (debt limit) they have
    const generatorValue = calculateGeneratorValue(player);
    
    // Current net worth = cookies + generator value
    const currentNetWorth = player.cookies + generatorValue;
    
    // After paying, what would net worth be?
    const newNetWorth = currentNetWorth - amount;
    
    console.log(`[FORCE_PAYMENT] ${player.name}: generatorValue=${generatorValue}, currentNetWorth=${currentNetWorth}, newNetWorth=${newNetWorth}`);
    
    if (newNetWorth >= 0) {
        // Can pay without going bankrupt - just deduct from cookies (can go negative)
        player.cookies -= amount;
        console.log(`[FORCE_PAYMENT] ${player.name}: paid ${amount}, cookies_after=${player.cookies}`);
        return;
    }
    
    // Would go below 0 net worth - FULL BANKRUPTCY!
    console.log(`[BANKRUPTCY] ${player.name}: FULL BANKRUPTCY! Selling all generators.`);
    console.log(`[BANKRUPTCY] ${player.name}: generators_before=`, JSON.stringify(player.generators));
    
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
    
    console.log(`[BANKRUPTCY] ${player.name}: generators_after=`, JSON.stringify(player.generators), 'cps=0, cookies=0');
}

// ==================== SOCKET HANDLERS ====================
io.on('connection', (socket) => {
    console.log(`Player connected: ${socket.id}`);
    
    // Create lobby
    socket.on('lobby:create', (data) => {
        // Support both old format (string) and new format (object)
        const playerName = typeof data === 'string' ? data : (data?.playerName || 'Player');
        const gameMode = typeof data === 'object' ? (data?.gameMode || 'solos') : 'solos';
        const lobby = createLobby(socket, playerName, gameMode);
        socket.emit('lobby:created', lobby);
    });
    
    // Select team (duos mode)
    socket.on('lobby:selectTeam', (team) => {
        const code = playerLobby.get(socket.id);
        if (!code) return;
        
        const lobby = lobbies.get(code);
        if (!lobby || lobby.gameMode !== 'duos') return;
        
        const player = lobby.players.find(p => p.id === socket.id);
        if (!player) return;
        
        // Check if team is full (max 2 per team)
        const teamCount = lobby.players.filter(p => p.team === team && p.id !== socket.id).length;
        if (teamCount >= 2) {
            socket.emit('lobby:error', 'Team is full!');
            return;
        }
        
        player.team = team;
        io.to(code).emit('lobby:update', lobby);
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
        
        // For duos, validate teams
        if (lobby.gameMode === 'duos') {
            const team1Count = lobby.players.filter(p => p.team === 1).length;
            const team2Count = lobby.players.filter(p => p.team === 2).length;
            const noTeam = lobby.players.filter(p => !p.team).length;
            
            if (noTeam > 0) {
                socket.emit('lobby:error', 'All players must pick a team!');
                return;
            }
            if (team1Count !== 2 || team2Count !== 2) {
                socket.emit('lobby:error', 'Each team must have exactly 2 players!');
                return;
            }
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
        
        const player = findPlayerEntity(lobby.gameState, socket.id);
        if (!player) {
            console.log('game:click - player/team not found for socket', socket.id);
            console.log('Players in game:', lobby.gameState.players.map(p => ({name: p.name, id: p.id, memberIds: p.memberIds})));
            return;
        }
        
        // Check if player is frozen
        if ((player.frozenSecondsLeft || 0) > 0) {
            return; // Can't click while frozen
        }
        
        // Support multiplier from client (validated to reasonable range), multiplied by click power
        const multiplier = Math.min(20, Math.max(1, data?.multiplier || 1));
        const clickLevel = player.clickPower || 1;
        // Exponential click power: level 1 = 1, level 2 = 2, level 3 = 4, level 4 = 8, etc.
        const clickPower = Math.pow(2, clickLevel - 1);
        // Apply power buff (+5% per buff)
        const buffMultiplier = 1 + (player.powerBuffs || 0) * 0.05;
        player.cookies += Math.floor(multiplier * clickPower * buffMultiplier);
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
        
        // In duos mode, we need to check team invisibility but use individual player info
        const teamEntity = findPlayerEntity(lobby.gameState, socket.id);
        
        // Don't broadcast cursor if team is invisible
        if (teamEntity && (teamEntity.invisibleSecondsLeft || 0) > 0) return;
        
        // Get individual player info from lobby (not game state)
        const individualPlayer = lobby.players.find(p => p.id === socket.id);
        if (!individualPlayer) return;
        
        // Broadcast cursor with individual player name and color
        socket.to(code).emit('game:cursor', {
            playerName: individualPlayer.name,
            color: individualPlayer.color || '#ffffff',
            x,
            y,
            // Also send team info for duos mode so clients know if same team
            teamName: teamEntity ? teamEntity.name : null
        });
    });
    
    // King of the Hill - track cursor on cookie
    socket.on('game:cursorOnCookie', ({ onCookie }) => {
        const code = playerLobby.get(socket.id);
        if (!code) return;
        
        const lobby = lobbies.get(code);
        if (!lobby || !lobby.gameState) return;
        
        const player = findPlayerEntity(lobby.gameState, socket.id);
        if (!player) return;
        
        // Store whether player's cursor is on cookie (used by tick to accumulate time)
        player.cursorOnCookie = onCookie;
    });
    
    // Ability: Freeze a player for 15 seconds
    socket.on('game:useFreeze', ({ targetName }) => {
        const code = playerLobby.get(socket.id);
        if (!code) return;
        
        const lobby = lobbies.get(code);
        if (!lobby || !lobby.gameState) return;
        
        const player = findPlayerEntity(lobby.gameState, socket.id);
        if (!player) return;
        
        // Check if player has ability points to use
        if ((player.powerBuffs || 0) < 1) {
            socket.emit('game:error', { message: 'You need at least 1 ability point to use Freeze!' });
            return;
        }
        
        // Find target player/team by name
        const target = lobby.gameState.players.find(p => p.name === targetName);
        if (!target || target.id === player.id) {
            socket.emit('game:error', { message: 'Invalid target!' });
            return;
        }
        
        // Can't freeze someone who's already frozen
        if ((target.frozenSecondsLeft || 0) > 0) {
            socket.emit('game:error', { message: `${targetName} is already frozen!` });
            return;
        }
        
        // Consume 1 buff and freeze target for 15 seconds
        player.powerBuffs = Math.max(0, (player.powerBuffs || 0) - 1);
        target.frozenSecondsLeft = 15;
        
        console.log(`[FREEZE] ${player.name} froze ${target.name} for 15 seconds (buffs remaining: ${player.powerBuffs})`);
        
        // Notify everyone
        io.to(code).emit('game:playerFrozen', {
            frozenBy: player.name,
            frozenPlayer: target.name,
            duration: 15
        });
        
        io.to(code).emit('game:state', lobby.gameState);
    });
    
    // Ability: Go invisible for 15 seconds
    socket.on('game:useInvisible', () => {
        const code = playerLobby.get(socket.id);
        if (!code) return;
        
        const lobby = lobbies.get(code);
        if (!lobby || !lobby.gameState) return;
        
        const player = findPlayerEntity(lobby.gameState, socket.id);
        if (!player) return;
        
        // Check if player has ability points to use
        if ((player.powerBuffs || 0) < 1) {
            socket.emit('game:error', { message: 'You need at least 1 ability point to use Invisibility!' });
            return;
        }
        
        // Can't use if already invisible
        if ((player.invisibleSecondsLeft || 0) > 0) {
            socket.emit('game:error', { message: 'You are already invisible!' });
            return;
        }
        
        // Consume 1 buff and go invisible for 15 seconds
        player.powerBuffs = Math.max(0, (player.powerBuffs || 0) - 1);
        player.invisibleSecondsLeft = 15;
        
        console.log(`[INVISIBLE] ${player.name} went invisible for 15 seconds (buffs remaining: ${player.powerBuffs})`);
        
        // Notify the player who went invisible
        socket.emit('game:youAreInvisible', { duration: 15 });
        
        // Notify others that this player disappeared
        socket.to(code).emit('game:playerInvisible', {
            playerName: player.name,
            duration: 15
        });
        
        io.to(code).emit('game:state', lobby.gameState);
    });
    
    // Ability: Market Crash - Target loses 10% of cookies (costs 2 ability points)
    socket.on('game:useMarketCrash', ({ targetName }) => {
        const code = playerLobby.get(socket.id);
        if (!code) return;
        
        const lobby = lobbies.get(code);
        if (!lobby || !lobby.gameState) return;
        
        const player = findPlayerEntity(lobby.gameState, socket.id);
        if (!player) return;
        
        // Check if player has enough ability points (costs 2)
        if ((player.powerBuffs || 0) < 2) {
            socket.emit('game:error', { message: 'You need at least 2 ability points to use Market Crash!' });
            return;
        }
        
        // Find target player/team by name
        const target = lobby.gameState.players.find(p => p.name === targetName);
        if (!target || target.id === player.id) {
            socket.emit('game:error', { message: 'Invalid target!' });
            return;
        }
        
        // Can't crash someone with less than 500 cookies
        if (target.cookies < 500) {
            socket.emit('game:error', { message: `${targetName} has less than 500🍪 - can't crash!` });
            return;
        }
        
        // Can't crash someone who's shielded (future-proofing)
        if ((target.shieldSecondsLeft || 0) > 0) {
            socket.emit('game:error', { message: `${targetName} is shielded!` });
            return;
        }
        
        // Consume 2 buffs and crash target's cookies by 10%
        player.powerBuffs = Math.max(0, (player.powerBuffs || 0) - 2);
        const crashAmount = Math.floor(target.cookies * 0.10);
        target.cookies = Math.max(0, target.cookies - crashAmount);
        
        console.log(`[MARKET CRASH] ${player.name} crashed ${target.name}'s market! Lost ${crashAmount} cookies (buffs remaining: ${player.powerBuffs})`);
        
        // Notify everyone
        io.to(code).emit('game:marketCrash', {
            crashedBy: player.name,
            crashedPlayer: target.name,
            amountLost: crashAmount
        });
        
        // Send notification to target (in duos, send to all team members)
        const targetIds = target.isTeam ? target.memberIds : [target.id];
        targetIds.forEach(tid => {
            io.to(tid).emit('game:positionClosed', {
                type: 'loss',
                message: `📉 ${player.name} CRASHED your market! Lost ${crashAmount}🍪!`,
                amount: crashAmount
            });
        });
        
        // Send notification to attacker
        socket.emit('game:notification', {
            type: 'success',
            message: `📉 Market Crash hit ${target.name} for ${crashAmount}🍪!`
        });
        
        io.to(code).emit('game:state', lobby.gameState);
    });
    
    // Buy generator
    socket.on('game:buy', (generatorType) => {
        const code = playerLobby.get(socket.id);
        if (!code) return;
        
        const lobby = lobbies.get(code);
        if (!lobby || !lobby.gameState) return;
        
        const player = findPlayerEntity(lobby.gameState, socket.id);
        if (!player) return;
        
        // Check if player is frozen
        if ((player.frozenSecondsLeft || 0) > 0) {
            socket.emit('game:error', { message: 'You cannot buy generators while frozen!' });
            return;
        }
        
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
        
        const player = findPlayerEntity(lobby.gameState, socket.id);
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
        
        // Find player's entity (team in duos, individual in solos)
        const player = findPlayerEntity(lobby.gameState, socket.id);
        // Find target by NAME (stable identifier)
        const target = lobby.gameState.players.find(p => p.name === targetName);
        
        if (!player || !target || player.name === target.name) {
            console.log('openPosition failed:', { player: player?.name, targetName, found: !!target });
            return;
        }
        
        // Check if player is frozen
        if ((player.frozenSecondsLeft || 0) > 0) {
            socket.emit('game:error', { message: 'You cannot trade while frozen!' });
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
        
        // Find player's entity (team in duos, individual in solos)
        const player = findPlayerEntity(lobby.gameState, socket.id);
        if (!player) {
            console.log('closePosition: player/team not found for socket.id:', socket.id);
            console.log('Players:', lobby.gameState.players.map(p => ({id: p.id, name: p.name, memberIds: p.memberIds})));
            return;
        }
        
        // Check if player is frozen
        if ((player.frozenSecondsLeft || 0) > 0) {
            socket.emit('game:error', { message: 'You cannot trade while frozen!' });
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
            // Player is in loss - use forcePayment to allow debt before bankruptcy
            const loss = Math.min(Math.abs(pnl), position.stake);
            forcePayment(player, loss);
            target.cookies += loss;
            console.log('closePosition: LOSS', { 
                pnlLoss: pnl, 
                actualLoss: loss, 
                playerLost: loss, 
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
const TICK_INTERVAL = 100; // milliseconds per tick for smooth updates
setInterval(() => {
    lobbies.forEach((lobby, code) => {
        if (!lobby.inGame || !lobby.gameState) return;
        
        const gs = lobby.gameState;
        
        // Don't process if game already has a winner
        if (gs.winner) return;
        
        // Update server time for client sync
        gs.serverTime = Date.now();
        
        // ==================== DECREMENT ABILITY TIMERS ====================
        // Decrement frozen and invisible timers (0.1 seconds per tick)
        gs.players.forEach(player => {
            if ((player.frozenSecondsLeft || 0) > 0) {
                player.frozenSecondsLeft = Math.max(0, player.frozenSecondsLeft - (TICK_INTERVAL / 1000));
            }
            if ((player.invisibleSecondsLeft || 0) > 0) {
                player.invisibleSecondsLeft = Math.max(0, player.invisibleSecondsLeft - (TICK_INTERVAL / 1000));
            }
        });
        
        // ==================== KING OF THE HILL ====================
        // Accumulate KotH round elapsed time
        gs.kothRoundElapsed = (gs.kothRoundElapsed || 0) + TICK_INTERVAL;
        
        // Accumulate time for players whose cursor is on the cookie (not frozen)
        gs.players.forEach(player => {
            // Only count time if cursor on cookie AND not frozen
            if (player.cursorOnCookie && !((player.frozenSecondsLeft || 0) > 0)) {
                player.cookieZoneTime = (player.cookieZoneTime || 0) + TICK_INTERVAL; // ms per tick
            }
        });
        
        // Check if KotH round is over (60 seconds)
        if (gs.kothRoundElapsed >= gs.kothRoundDuration) {
            // Find the winner (most time on cookie)
            let winner = null;
            let maxTime = 0;
            let isTied = false;
            
            gs.players.forEach(player => {
                const playerTime = player.cookieZoneTime || 0;
                if (playerTime > maxTime) {
                    maxTime = playerTime;
                    winner = player;
                    isTied = false;
                } else if (playerTime === maxTime && playerTime > 0) {
                    // Exact tie - in duos mode (or any mode), ties mean no one wins
                    isTied = true;
                }
            });
            
            if (isTied || maxTime === 0) {
                // Tie or no one participated - no winner
                console.log(`[KOTH] Round ended in a TIE! No buff awarded.`);
                io.to(code).emit('game:kothTie', {
                    message: 'King of the Hill ended in a tie! No ability points awarded.'
                });
            } else if (winner) {
                winner.powerBuffs = (winner.powerBuffs || 0) + 1;
                console.log(`[KOTH] ${winner.name} wins the round with ${maxTime}ms! Now has ${winner.powerBuffs} buff(s)`);
                
                // Emit KotH winner event
                io.to(code).emit('game:kothWinner', {
                    winnerName: winner.name,
                    winnerColor: winner.color,
                    timeOnCookie: maxTime,
                    totalBuffs: winner.powerBuffs
                });
            }
            
            // Reset for next round
            gs.kothRoundElapsed = 0;
            gs.players.forEach(player => {
                player.cookieZoneTime = 0;
            });
        }
        
        // ==================== CPS APPLICATION ====================
        // Apply CPS to all players (with power buff multiplier, unless frozen)
        gs.players.forEach(player => {
            // Skip CPS if player is frozen
            if ((player.frozenSecondsLeft || 0) > 0) return;
            
            if (player.cps > 0) {
                // Power buff: +5% per buff to everything
                const buffMultiplier = 1 + (player.powerBuffs || 0) * 0.05;
                const gain = player.cps * (TICK_INTERVAL / 1000) * buffMultiplier; // scale by tick interval
                player.cookies += gain;
                // Log occasionally (every ~10 seconds)
                if (Math.random() < 0.01) {
                    console.log(`[CPS_TICK] ${player.name}: +${gain.toFixed(1)} (cps=${player.cps}, buff=${buffMultiplier.toFixed(2)}x), cookies=${player.cookies.toFixed(1)}`);
                }
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
                console.log(`[LIQUIDATION] Position ${pos.id}: ${owner.name}'s ${pos.type} on ${target.name}`);
                console.log(`[LIQUIDATION] currentPrice=${currentPrice}, liqPrice=${pos.liquidationPrice}, stake=${pos.stake}`);
                console.log(`[LIQUIDATION] owner cookies_before=${owner.cookies}, target cookies_before=${target.cookies}`);
                
                // Owner loses stake - use forcePayment to allow debt before bankruptcy
                forcePayment(owner, pos.stake, `liquidation_${pos.type}_on_${target.name}`);
                target.cookies += pos.stake;
                console.log(`Position liquidated: ${owner.name} loses stake ${pos.stake} to ${target.name}`);
                console.log(`[LIQUIDATION] owner cookies_after=${owner.cookies}, target cookies_after=${target.cookies}`);
                
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
                console.log(`[MAX_PAYOUT] Target ${target.name}: totalOwed=${totalOwed}, generatorValue=${generatorValue}, netWorthAfterPaying=${netWorthAfterPaying}`);
                
                // Force close all positions - target can't recover
                for (const { pos, owner, pnl } of positions) {
                    console.log(`[MAX_PAYOUT] Closing position ${pos.id}: ${owner.name}'s ${pos.type} on ${target.name}, pnl=${pnl}`);
                    console.log(`[MAX_PAYOUT] target cookies_before=${target.cookies}, owner cookies_before=${owner.cookies}`);
                    
                    // Force the target to pay (will trigger bankruptcy)
                    forcePayment(target, pnl, `max_payout_to_${owner.name}`);
                    // NOTE: Stake was never deducted (locked margin), don't add it back
                    owner.cookies += pnl;
                    
                    console.log(`Auto-close: ${owner.name} gets pnl ${pnl} from ${target.name}`);
                    console.log(`[MAX_PAYOUT] target cookies_after=${target.cookies}, owner cookies_after=${owner.cookies}`);
                    console.log(`[MAX_PAYOUT] target generators=`, JSON.stringify(target.generators), 'cps=', target.cps);
                    
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
}, TICK_INTERVAL);

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

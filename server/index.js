const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const GameManager = require('./game/GameManager');
const PlayerManager = require('./game/PlayerManager');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Serve static files
app.use(express.static(path.join(__dirname, '../public')));
app.use(express.json());

// Game managers
const gameManager = new GameManager();
const playerManager = new PlayerManager();

// Player balances (in-memory for v1, would be database in production)
const playerBalances = new Map();

// WebSocket connection handling
wss.on('connection', (ws) => {
    const playerId = uuidv4();
    ws.playerId = playerId;
    
    console.log(`Player connected: ${playerId}`);
    
    // Initialize player balance
    playerBalances.set(playerId, 100); // Starting balance of $100
    
    // Send welcome message
    ws.send(JSON.stringify({
        type: 'welcome',
        playerId: playerId,
        balance: playerBalances.get(playerId)
    }));
    
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            handleMessage(ws, playerId, data);
        } catch (error) {
            console.error('Error parsing message:', error);
        }
    });
    
    ws.on('close', () => {
        console.log(`Player disconnected: ${playerId}`);
        const player = playerManager.getPlayer(playerId);
        if (player && player.matchId) {
            const match = gameManager.getMatch(player.matchId);
            if (match) {
                match.removePlayer(playerId);
                broadcastToMatch(match.id, {
                    type: 'player_left',
                    playerId: playerId
                });
            }
        }
        playerManager.removePlayer(playerId);
    });
});

function handleMessage(ws, playerId, data) {
    switch (data.type) {
        case 'set_name':
            handleSetName(ws, playerId, data);
            break;
        case 'add_balance':
            handleAddBalance(ws, playerId, data);
            break;
        case 'get_lobbies':
            handleGetLobbies(ws);
            break;
        case 'create_match':
            handleCreateMatch(ws, playerId, data);
            break;
        case 'join_match':
            handleJoinMatch(ws, playerId, data);
            break;
        case 'leave_match':
            handleLeaveMatch(ws, playerId);
            break;
        case 'start_match':
            handleStartMatch(ws, playerId);
            break;
        case 'click':
            handleClick(ws, playerId, data);
            break;
        case 'buy_generator':
            handleBuyGenerator(ws, playerId, data);
            break;
        case 'activate_bluff':
            handleActivateBluff(ws, playerId, data);
            break;
        case 'cookie_call':
            handleCookieCall(ws, playerId, data);
            break;
        case 'use_sabotage':
            handleUseSabotage(ws, playerId, data);
            break;
        case 'buy_defense':
            handleBuyDefense(ws, playerId, data);
            break;
        default:
            console.log('Unknown message type:', data.type);
    }
}

function handleSetName(ws, playerId, data) {
    const player = playerManager.createPlayer(playerId, data.name || 'Anonymous');
    player.ws = ws;
    ws.send(JSON.stringify({
        type: 'name_set',
        name: player.name
    }));
}

function handleAddBalance(ws, playerId, data) {
    const amount = parseFloat(data.amount);
    if (amount > 0 && amount <= 1000) {
        const currentBalance = playerBalances.get(playerId) || 0;
        playerBalances.set(playerId, currentBalance + amount);
        ws.send(JSON.stringify({
            type: 'balance_updated',
            balance: playerBalances.get(playerId)
        }));
    }
}

function handleGetLobbies(ws) {
    const lobbies = gameManager.getOpenMatches().map(match => ({
        id: match.id,
        name: match.name,
        buyIn: match.buyIn,
        playerCount: match.players.size,
        maxPlayers: match.maxPlayers,
        host: match.hostName
    }));
    ws.send(JSON.stringify({
        type: 'lobbies_list',
        lobbies: lobbies
    }));
}

function handleCreateMatch(ws, playerId, data) {
    const player = playerManager.getPlayer(playerId);
    if (!player) {
        ws.send(JSON.stringify({ type: 'error', message: 'Please set your name first' }));
        return;
    }
    
    const buyIn = data.buyIn || 5;
    const balance = playerBalances.get(playerId) || 0;
    
    if (balance < buyIn) {
        ws.send(JSON.stringify({ type: 'error', message: 'Insufficient balance' }));
        return;
    }
    
    const match = gameManager.createMatch({
        name: data.name || `${player.name}'s Game`,
        buyIn: buyIn,
        maxPlayers: data.maxPlayers || 10,
        duration: data.duration || 360, // 6 minutes default
        hostId: playerId,
        hostName: player.name
    });
    
    // Deduct buy-in
    playerBalances.set(playerId, balance - buyIn);
    
    // Add player to match
    match.addPlayer(player);
    player.matchId = match.id;
    
    ws.send(JSON.stringify({
        type: 'match_created',
        matchId: match.id,
        balance: playerBalances.get(playerId)
    }));
    
    broadcastMatchState(match);
}

function handleJoinMatch(ws, playerId, data) {
    const player = playerManager.getPlayer(playerId);
    if (!player) {
        ws.send(JSON.stringify({ type: 'error', message: 'Please set your name first' }));
        return;
    }
    
    const match = gameManager.getMatch(data.matchId);
    if (!match) {
        ws.send(JSON.stringify({ type: 'error', message: 'Match not found' }));
        return;
    }
    
    if (match.state !== 'waiting') {
        ws.send(JSON.stringify({ type: 'error', message: 'Match already started' }));
        return;
    }
    
    const balance = playerBalances.get(playerId) || 0;
    if (balance < match.buyIn) {
        ws.send(JSON.stringify({ type: 'error', message: 'Insufficient balance' }));
        return;
    }
    
    // Deduct buy-in
    playerBalances.set(playerId, balance - match.buyIn);
    
    match.addPlayer(player);
    player.matchId = match.id;
    
    ws.send(JSON.stringify({
        type: 'match_joined',
        matchId: match.id,
        balance: playerBalances.get(playerId)
    }));
    
    broadcastMatchState(match);
}

function handleLeaveMatch(ws, playerId) {
    const player = playerManager.getPlayer(playerId);
    if (!player || !player.matchId) return;
    
    const match = gameManager.getMatch(player.matchId);
    if (!match) return;
    
    // Refund buy-in if match hasn't started
    if (match.state === 'waiting') {
        const balance = playerBalances.get(playerId) || 0;
        playerBalances.set(playerId, balance + match.buyIn);
        ws.send(JSON.stringify({
            type: 'balance_updated',
            balance: playerBalances.get(playerId)
        }));
    }
    
    match.removePlayer(playerId);
    player.matchId = null;
    
    ws.send(JSON.stringify({ type: 'match_left' }));
    
    if (match.players.size === 0) {
        gameManager.removeMatch(match.id);
    } else {
        broadcastMatchState(match);
    }
}

function handleStartMatch(ws, playerId) {
    const player = playerManager.getPlayer(playerId);
    if (!player || !player.matchId) return;
    
    const match = gameManager.getMatch(player.matchId);
    if (!match) return;
    
    if (match.hostId !== playerId) {
        ws.send(JSON.stringify({ type: 'error', message: 'Only host can start match' }));
        return;
    }
    
    if (match.players.size < 2) {
        ws.send(JSON.stringify({ type: 'error', message: 'Need at least 2 players' }));
        return;
    }
    
    match.start();
    
    // Set up game loop
    match.gameInterval = setInterval(() => {
        match.tick();
        broadcastGameState(match);
        
        if (match.state === 'ended') {
            clearInterval(match.gameInterval);
            handleMatchEnd(match);
        }
    }, 100); // 10 updates per second
    
    broadcastToMatch(match.id, {
        type: 'match_started',
        duration: match.duration
    });
}

function handleClick(ws, playerId, data) {
    const player = playerManager.getPlayer(playerId);
    if (!player || !player.matchId) return;
    
    const match = gameManager.getMatch(player.matchId);
    if (!match || match.state !== 'playing') return;
    
    const matchPlayer = match.getPlayer(playerId);
    if (!matchPlayer) return;
    
    const result = match.processClick(playerId, data.timing, data.critPosition);
    
    ws.send(JSON.stringify({
        type: 'click_result',
        ...result
    }));
}

function handleBuyGenerator(ws, playerId, data) {
    const player = playerManager.getPlayer(playerId);
    if (!player || !player.matchId) return;
    
    const match = gameManager.getMatch(player.matchId);
    if (!match || match.state !== 'playing') return;
    
    const result = match.buyGenerator(playerId, data.generatorType);
    
    ws.send(JSON.stringify({
        type: 'generator_result',
        ...result
    }));
}

function handleActivateBluff(ws, playerId, data) {
    const player = playerManager.getPlayer(playerId);
    if (!player || !player.matchId) return;
    
    const match = gameManager.getMatch(player.matchId);
    if (!match || match.state !== 'playing') return;
    
    const result = match.activateBluff(playerId, data.bluffType);
    
    ws.send(JSON.stringify({
        type: 'bluff_result',
        ...result
    }));
}

function handleCookieCall(ws, playerId, data) {
    const player = playerManager.getPlayer(playerId);
    if (!player || !player.matchId) return;
    
    const match = gameManager.getMatch(player.matchId);
    if (!match || match.state !== 'playing') return;
    
    const result = match.cookieCall(playerId, data.targetId);
    
    // Notify all players of the cookie call
    broadcastToMatch(match.id, {
        type: 'cookie_call_result',
        callerId: playerId,
        targetId: data.targetId,
        ...result
    });
}

function handleUseSabotage(ws, playerId, data) {
    const player = playerManager.getPlayer(playerId);
    if (!player || !player.matchId) return;
    
    const match = gameManager.getMatch(player.matchId);
    if (!match || match.state !== 'playing') return;
    
    const result = match.useSabotage(playerId, data.targetId, data.sabotageType);
    
    if (result.success) {
        broadcastToMatch(match.id, {
            type: 'sabotage_used',
            attackerId: playerId,
            targetId: data.targetId,
            sabotageType: data.sabotageType,
            blocked: result.blocked
        });
    }
    
    ws.send(JSON.stringify({
        type: 'sabotage_result',
        ...result
    }));
}

function handleBuyDefense(ws, playerId, data) {
    const player = playerManager.getPlayer(playerId);
    if (!player || !player.matchId) return;
    
    const match = gameManager.getMatch(player.matchId);
    if (!match || match.state !== 'playing') return;
    
    const result = match.buyDefense(playerId, data.defenseType);
    
    ws.send(JSON.stringify({
        type: 'defense_result',
        ...result
    }));
}

function handleMatchEnd(match) {
    const results = match.getResults();
    const prizePool = match.buyIn * match.players.size;
    
    // Award prize to winner
    if (results.winner) {
        const currentBalance = playerBalances.get(results.winner.id) || 0;
        playerBalances.set(results.winner.id, currentBalance + prizePool);
    }
    
    broadcastToMatch(match.id, {
        type: 'match_ended',
        results: results,
        prizePool: prizePool
    });
    
    // Clean up after delay
    setTimeout(() => {
        match.players.forEach((p, id) => {
            const player = playerManager.getPlayer(id);
            if (player) {
                player.matchId = null;
                if (player.ws) {
                    player.ws.send(JSON.stringify({
                        type: 'balance_updated',
                        balance: playerBalances.get(id)
                    }));
                }
            }
        });
        gameManager.removeMatch(match.id);
    }, 10000);
}

function broadcastMatchState(match) {
    const state = {
        type: 'match_state',
        matchId: match.id,
        name: match.name,
        state: match.state,
        buyIn: match.buyIn,
        prizePool: match.buyIn * match.players.size,
        hostId: match.hostId,
        players: Array.from(match.players.values()).map(p => ({
            id: p.id,
            name: p.name,
            ready: p.ready
        }))
    };
    
    broadcastToMatch(match.id, state);
}

function broadcastGameState(match) {
    match.players.forEach((matchPlayer, playerId) => {
        const player = playerManager.getPlayer(playerId);
        if (!player || !player.ws) return;
        
        const gameState = match.getGameStateForPlayer(playerId);
        player.ws.send(JSON.stringify({
            type: 'game_state',
            ...gameState
        }));
    });
}

function broadcastToMatch(matchId, message) {
    const match = gameManager.getMatch(matchId);
    if (!match) return;
    
    match.players.forEach((matchPlayer, playerId) => {
        const player = playerManager.getPlayer(playerId);
        if (player && player.ws && player.ws.readyState === WebSocket.OPEN) {
            player.ws.send(JSON.stringify(message));
        }
    });
}

// REST endpoints
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Cookie Conquest server running on port ${PORT}`);
});

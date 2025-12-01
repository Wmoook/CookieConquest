// Game Client - WebSocket communication and game state
class GameClient {
    constructor() {
        this.ws = null;
        this.playerId = null;
        this.playerName = null;
        this.balance = 0;
        this.currentMatch = null;
        this.gameState = null;
        this.isHost = false;
        
        this.handlers = {};
    }
    
    connect() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}`;
        
        this.ws = new WebSocket(wsUrl);
        
        this.ws.onopen = () => {
            console.log('Connected to server');
            this.emit('connected');
        };
        
        this.ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                this.handleMessage(data);
            } catch (e) {
                console.error('Error parsing message:', e);
            }
        };
        
        this.ws.onclose = () => {
            console.log('Disconnected from server');
            this.emit('disconnected');
            // Attempt reconnection after 3 seconds
            setTimeout(() => this.connect(), 3000);
        };
        
        this.ws.onerror = (error) => {
            console.error('WebSocket error:', error);
        };
    }
    
    send(data) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(data));
        }
    }
    
    on(event, handler) {
        if (!this.handlers[event]) {
            this.handlers[event] = [];
        }
        this.handlers[event].push(handler);
    }
    
    emit(event, data) {
        if (this.handlers[event]) {
            this.handlers[event].forEach(handler => handler(data));
        }
    }
    
    handleMessage(data) {
        switch (data.type) {
            case 'welcome':
                this.playerId = data.playerId;
                this.balance = data.balance;
                this.emit('welcome', data);
                break;
                
            case 'name_set':
                this.playerName = data.name;
                this.emit('name_set', data);
                break;
                
            case 'balance_updated':
                this.balance = data.balance;
                this.emit('balance_updated', data);
                break;
                
            case 'lobbies_list':
                this.emit('lobbies_list', data.lobbies);
                break;
                
            case 'match_created':
                this.currentMatch = data.matchId;
                this.isHost = true;
                this.balance = data.balance;
                this.emit('match_created', data);
                break;
                
            case 'match_joined':
                this.currentMatch = data.matchId;
                this.isHost = false;
                this.balance = data.balance;
                this.emit('match_joined', data);
                break;
                
            case 'match_state':
                this.emit('match_state', data);
                break;
                
            case 'player_left':
                this.emit('player_left', data);
                break;
                
            case 'match_started':
                this.emit('match_started', data);
                break;
                
            case 'game_state':
                this.gameState = data;
                this.emit('game_state', data);
                break;
                
            case 'click_result':
                this.emit('click_result', data);
                break;
                
            case 'generator_result':
                this.emit('generator_result', data);
                break;
                
            case 'bluff_result':
                this.emit('bluff_result', data);
                break;
                
            case 'cookie_call_result':
                this.emit('cookie_call_result', data);
                break;
                
            case 'sabotage_used':
                this.emit('sabotage_used', data);
                break;
                
            case 'sabotage_result':
                this.emit('sabotage_result', data);
                break;
                
            case 'defense_result':
                this.emit('defense_result', data);
                break;
                
            case 'match_ended':
                this.emit('match_ended', data);
                break;
                
            case 'match_left':
                this.currentMatch = null;
                this.isHost = false;
                this.emit('match_left', data);
                break;
                
            case 'error':
                this.emit('error', data);
                break;
                
            default:
                console.log('Unknown message type:', data.type);
        }
    }
    
    // API Methods
    setName(name) {
        this.send({ type: 'set_name', name });
    }
    
    addBalance(amount) {
        this.send({ type: 'add_balance', amount });
    }
    
    getLobbies() {
        this.send({ type: 'get_lobbies' });
    }
    
    createMatch(options) {
        this.send({ type: 'create_match', ...options });
    }
    
    joinMatch(matchId) {
        this.send({ type: 'join_match', matchId });
    }
    
    leaveMatch() {
        this.send({ type: 'leave_match' });
    }
    
    startMatch() {
        this.send({ type: 'start_match' });
    }
    
    click(timing, critPosition) {
        this.send({ type: 'click', timing, critPosition });
    }
    
    buyGenerator(generatorType) {
        this.send({ type: 'buy_generator', generatorType });
    }
    
    activateBluff(bluffType) {
        this.send({ type: 'activate_bluff', bluffType });
    }
    
    cookieCall(targetId) {
        this.send({ type: 'cookie_call', targetId });
    }
    
    useSabotage(targetId, sabotageType) {
        this.send({ type: 'use_sabotage', targetId, sabotageType });
    }
    
    buyDefense(defenseType) {
        this.send({ type: 'buy_defense', defenseType });
    }
}

// Global game client instance
window.gameClient = new GameClient();

const { v4: uuidv4 } = require('uuid');
const Match = require('./Match');

class GameManager {
    constructor() {
        this.matches = new Map();
    }
    
    createMatch(options) {
        const matchId = uuidv4();
        const match = new Match({
            id: matchId,
            ...options
        });
        this.matches.set(matchId, match);
        return match;
    }
    
    getMatch(matchId) {
        return this.matches.get(matchId);
    }
    
    removeMatch(matchId) {
        this.matches.delete(matchId);
    }
    
    getOpenMatches() {
        return Array.from(this.matches.values()).filter(m => m.state === 'waiting');
    }
    
    getAllMatches() {
        return Array.from(this.matches.values());
    }
}

module.exports = GameManager;

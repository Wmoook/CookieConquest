class PlayerManager {
    constructor() {
        this.players = new Map();
    }
    
    createPlayer(id, name) {
        const player = {
            id: id,
            name: name,
            matchId: null,
            ws: null
        };
        this.players.set(id, player);
        return player;
    }
    
    getPlayer(id) {
        return this.players.get(id);
    }
    
    removePlayer(id) {
        this.players.delete(id);
    }
    
    getAllPlayers() {
        return Array.from(this.players.values());
    }
}

module.exports = PlayerManager;

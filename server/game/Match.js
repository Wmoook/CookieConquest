const GENERATORS = require('./generators');
const BLUFFS = require('./bluffs');
const SABOTAGES = require('./sabotages');
const DEFENSES = require('./defenses');

class Match {
    constructor(options) {
        this.id = options.id;
        this.name = options.name;
        this.buyIn = options.buyIn;
        this.maxPlayers = options.maxPlayers;
        this.duration = options.duration; // in seconds
        this.hostId = options.hostId;
        this.hostName = options.hostName;
        
        this.state = 'waiting'; // waiting, playing, bakeoff, ended
        this.players = new Map();
        this.startTime = null;
        this.currentTime = 0;
        this.perfectClickWindow = null;
        this.critBarPosition = 0;
        this.critBarDirection = 1;
        this.goldenCookieActive = false;
        this.goldenCookiePosition = null;
        this.gameInterval = null;
    }
    
    addPlayer(player) {
        const matchPlayer = {
            id: player.id,
            name: player.name,
            ready: false,
            cookies: 0,  // True Cookie Count
            publicCookies: 0, // Public Cookie Count (what others see)
            generators: {
                oven: 0,
                kitchen: 0,
                factory: 0,
                aiBaker: 0
            },
            defenses: {
                antivirus: 0,
                coolingSystem: 0,
                firewall: 0,
                reinforcedDisplay: 0,
                precisionGloves: 0,
                shield: 0,
                decoy: 0,
                sabotageTrap: 0,
                revealScanner: 0,
                autoShield: 0
            },
            activeBluffs: [],
            activeDebuffs: [],
            activeSabotages: [],
            perfectClickStreak: 0,
            totalClicks: 0,
            perfectClicks: 0,
            lastClickTime: 0,
            failedSabotages: 0
        };
        this.players.set(player.id, matchPlayer);
    }
    
    removePlayer(playerId) {
        this.players.delete(playerId);
    }
    
    getPlayer(playerId) {
        return this.players.get(playerId);
    }
    
    start() {
        this.state = 'playing';
        this.startTime = Date.now();
        this.currentTime = 0;
        this.spawnPerfectClickWindow();
    }
    
    tick() {
        const now = Date.now();
        this.currentTime = (now - this.startTime) / 1000;
        
        // Check for phase transitions
        const timeRemaining = this.duration - this.currentTime;
        
        if (timeRemaining <= 30 && this.state === 'playing') {
            this.state = 'bakeoff';
        }
        
        if (timeRemaining <= 0) {
            this.state = 'ended';
            return;
        }
        
        // Update crit bar position
        this.critBarPosition += this.critBarDirection * 2;
        if (this.critBarPosition >= 100 || this.critBarPosition <= 0) {
            this.critBarDirection *= -1;
        }
        
        // Spawn perfect click windows
        if (!this.perfectClickWindow && Math.random() < 0.03) { // ~3% chance per tick
            this.spawnPerfectClickWindow();
        }
        
        // Expire perfect click window
        if (this.perfectClickWindow && now > this.perfectClickWindow.expires) {
            this.perfectClickWindow = null;
        }
        
        // Golden cookie in bakeoff
        if (this.state === 'bakeoff' && !this.goldenCookieActive && Math.random() < 0.01) {
            this.spawnGoldenCookie();
        }
        
        // Process passive income for all players
        this.players.forEach((player, playerId) => {
            // Generator income
            let passiveIncome = 0;
            passiveIncome += player.generators.oven * GENERATORS.oven.output;
            passiveIncome += player.generators.kitchen * GENERATORS.kitchen.output;
            passiveIncome += player.generators.factory * GENERATORS.factory.output;
            passiveIncome += player.generators.aiBaker * GENERATORS.aiBaker.output;
            
            // Check for generator shutdown debuff
            const generatorShutdown = player.activeDebuffs.find(d => d.type === 'generatorShutdown');
            if (!generatorShutdown) {
                player.cookies += passiveIncome / 10; // /10 because we tick 10 times per second
            }
            
            // Check for cookie worm drain
            const cookieWorm = player.activeSabotages.find(s => s.type === 'cookieWorm');
            if (cookieWorm) {
                const drainAmount = player.cookies * 0.0015; // 15% per 10 seconds
                player.cookies = Math.max(0, player.cookies - drainAmount);
            }
            
            // Update public cookies based on bluffs
            this.updatePublicCookies(player);
            
            // Process debuff/sabotage expiration
            player.activeDebuffs = player.activeDebuffs.filter(d => now < d.expires);
            player.activeSabotages = player.activeSabotages.filter(s => now < s.expires);
            player.activeBluffs = player.activeBluffs.filter(b => now < b.expires);
        });
    }
    
    spawnPerfectClickWindow() {
        this.perfectClickWindow = {
            active: true,
            expires: Date.now() + 1500 // 1.5 seconds to hit it
        };
    }
    
    spawnGoldenCookie() {
        this.goldenCookieActive = true;
        this.goldenCookiePosition = {
            x: 20 + Math.random() * 60,
            y: 20 + Math.random() * 60
        };
        setTimeout(() => {
            this.goldenCookieActive = false;
            this.goldenCookiePosition = null;
        }, 3000);
    }
    
    processClick(playerId, timing, critPosition) {
        const player = this.players.get(playerId);
        if (!player) return { success: false };
        
        const now = Date.now();
        
        // Rate limiting - max 20 clicks per second
        if (now - player.lastClickTime < 50) {
            return { success: false, reason: 'Too fast' };
        }
        player.lastClickTime = now;
        player.totalClicks++;
        
        let cookiesEarned = 1;
        let multiplier = 1;
        let isPerfect = false;
        let isCrit = false;
        
        // Check precision gloves debuff (stale batch sabotage)
        const staleBatch = player.activeDebuffs.find(d => d.type === 'staleBatch');
        if (staleBatch && !player.defenses.precisionGloves) {
            multiplier *= 0.5;
        }
        
        // Perfect click timing
        if (this.perfectClickWindow && this.perfectClickWindow.active) {
            if (timing && Math.abs(timing) < 0.15) { // 150ms window
                cookiesEarned = 5;
                isPerfect = true;
                player.perfectClicks++;
                player.perfectClickStreak++;
                this.perfectClickWindow = null;
                
                // Streak bonus from Oven
                if (player.generators.oven > 0 && player.perfectClickStreak >= 3) {
                    multiplier *= 1 + (player.perfectClickStreak * 0.1 * player.generators.oven);
                }
            }
        } else {
            player.perfectClickStreak = 0;
        }
        
        // Crit click zone
        if (critPosition !== undefined) {
            const critDiff = Math.abs(critPosition - this.critBarPosition);
            if (critDiff < 5) {
                multiplier *= 4;
                isCrit = true;
            } else if (critDiff < 15) {
                multiplier *= 2;
                isCrit = true;
            }
        }
        
        // Bakeoff bonus
        if (this.state === 'bakeoff') {
            multiplier *= 2;
        }
        
        const totalCookies = Math.floor(cookiesEarned * multiplier);
        player.cookies += totalCookies;
        
        return {
            success: true,
            cookies: totalCookies,
            isPerfect,
            isCrit,
            multiplier,
            streak: player.perfectClickStreak
        };
    }
    
    buyGenerator(playerId, generatorType) {
        const player = this.players.get(playerId);
        if (!player) return { success: false };
        
        const generator = GENERATORS[generatorType];
        if (!generator) return { success: false, reason: 'Invalid generator' };
        
        const count = player.generators[generatorType] || 0;
        const cost = Math.floor(generator.baseCost * Math.pow(1.15, count));
        
        if (player.cookies < cost) {
            return { success: false, reason: 'Not enough cookies' };
        }
        
        player.cookies -= cost;
        player.generators[generatorType] = count + 1;
        
        return {
            success: true,
            generatorType,
            count: player.generators[generatorType],
            cost
        };
    }
    
    activateBluff(playerId, bluffType) {
        const player = this.players.get(playerId);
        if (!player) return { success: false };
        
        const bluff = BLUFFS[bluffType];
        if (!bluff) return { success: false, reason: 'Invalid bluff' };
        
        if (player.cookies < bluff.cost) {
            return { success: false, reason: 'Not enough cookies' };
        }
        
        player.cookies -= bluff.cost;
        player.activeBluffs.push({
            type: bluffType,
            ...bluff,
            expires: Date.now() + bluff.duration
        });
        
        return { success: true, bluffType };
    }
    
    cookieCall(callerId, targetId) {
        const caller = this.players.get(callerId);
        const target = this.players.get(targetId);
        
        if (!caller || !target) return { success: false };
        if (callerId === targetId) return { success: false, reason: 'Cannot call yourself' };
        
        // Check if target is bluffing
        const isBluffing = target.activeBluffs.length > 0;
        
        if (isBluffing) {
            // Caller wins - steals 10%
            const stolenAmount = Math.floor(target.cookies * 0.1);
            target.cookies -= stolenAmount;
            caller.cookies += stolenAmount;
            
            // Clear target's bluffs
            target.activeBluffs = [];
            
            // Apply debuff to target
            target.activeDebuffs.push({
                type: 'exposed',
                expires: Date.now() + 10000
            });
            
            return {
                success: true,
                correct: true,
                stolenAmount,
                callerName: caller.name,
                targetName: target.name
            };
        } else {
            // Caller loses - loses 10%
            const lostAmount = Math.floor(caller.cookies * 0.1);
            caller.cookies -= lostAmount;
            
            // Target gets buff
            target.activeBluffs.push({
                type: 'vindicated',
                multiplier: 1.2,
                expires: Date.now() + 10000
            });
            
            return {
                success: true,
                correct: false,
                lostAmount,
                callerName: caller.name,
                targetName: target.name
            };
        }
    }
    
    useSabotage(attackerId, targetId, sabotageType) {
        const attacker = this.players.get(attackerId);
        const target = this.players.get(targetId);
        
        if (!attacker || !target) return { success: false };
        if (attackerId === targetId) return { success: false, reason: 'Cannot sabotage yourself' };
        
        const sabotage = SABOTAGES[sabotageType];
        if (!sabotage) return { success: false, reason: 'Invalid sabotage' };
        
        let cost = sabotage.cost;
        if (this.state === 'bakeoff') {
            cost = Math.floor(cost * 0.5);
        }
        
        if (attacker.cookies < cost) {
            return { success: false, reason: 'Not enough cookies' };
        }
        
        attacker.cookies -= cost;
        
        // Check for defenses
        const defenseKey = sabotage.counter;
        if (target.defenses[defenseKey] > 0) {
            target.defenses[defenseKey]--;
            attacker.failedSabotages++;
            
            // Check for sabotage trap
            if (target.defenses.sabotageTrap > 0) {
                target.defenses.sabotageTrap--;
                this.applySabotageEffect(attacker, sabotageType, sabotage);
                return { success: true, blocked: true, reflected: true };
            }
            
            return { success: true, blocked: true };
        }
        
        // AI Baker auto-counter
        if (target.generators.aiBaker > 0 && Math.random() < 0.3) {
            return { success: true, blocked: true, autoBlocked: true };
        }
        
        this.applySabotageEffect(target, sabotageType, sabotage);
        
        return { success: true, blocked: false };
    }
    
    applySabotageEffect(target, sabotageType, sabotage) {
        switch (sabotageType) {
            case 'cookieWorm':
                target.activeSabotages.push({
                    type: 'cookieWorm',
                    expires: Date.now() + 10000
                });
                break;
            case 'ovenOverload':
                target.activeDebuffs.push({
                    type: 'generatorShutdown',
                    expires: Date.now() + 5000
                });
                break;
            case 'fogOfWar':
                target.activeDebuffs.push({
                    type: 'fogOfWar',
                    expires: Date.now() + 8000
                });
                break;
            case 'sugarBomb':
                target.publicCookies = Math.floor(target.publicCookies * 0.5);
                break;
            case 'staleBatch':
                target.activeDebuffs.push({
                    type: 'staleBatch',
                    expires: Date.now() + 8000
                });
                break;
        }
    }
    
    buyDefense(playerId, defenseType) {
        const player = this.players.get(playerId);
        if (!player) return { success: false };
        
        const defense = DEFENSES[defenseType];
        if (!defense) return { success: false, reason: 'Invalid defense' };
        
        if (player.cookies < defense.cost) {
            return { success: false, reason: 'Not enough cookies' };
        }
        
        player.cookies -= defense.cost;
        player.defenses[defenseType] = (player.defenses[defenseType] || 0) + 1;
        
        return {
            success: true,
            defenseType,
            count: player.defenses[defenseType]
        };
    }
    
    updatePublicCookies(player) {
        let publicCookies = player.cookies;
        
        for (const bluff of player.activeBluffs) {
            switch (bluff.type) {
                case 'inflate10':
                    publicCookies *= 1.1;
                    break;
                case 'inflate20':
                    publicCookies *= 1.2;
                    break;
                case 'inflate50':
                    publicCookies *= 1.5;
                    break;
                case 'deflate10':
                    publicCookies *= 0.9;
                    break;
                case 'deflate20':
                    publicCookies *= 0.8;
                    break;
                case 'deflate50':
                    publicCookies *= 0.5;
                    break;
                case 'statMask':
                    publicCookies = bluff.maskedValue || player.cookies;
                    break;
                case 'falseCrisis':
                    // Shows fake "being sabotaged" status
                    break;
            }
        }
        
        player.publicCookies = Math.floor(publicCookies);
    }
    
    getGameStateForPlayer(playerId) {
        const player = this.players.get(playerId);
        if (!player) return null;
        
        const timeRemaining = Math.max(0, this.duration - this.currentTime);
        const phase = this.getPhase();
        
        // Get opponent info (with bluffed stats)
        const opponents = [];
        this.players.forEach((p, id) => {
            if (id !== playerId) {
                const isFogged = player.activeDebuffs.some(d => d.type === 'fogOfWar');
                opponents.push({
                    id: p.id,
                    name: p.name,
                    cookies: isFogged ? '???' : p.publicCookies,
                    isBluffing: false, // Never reveal this directly
                    beingSabotaged: p.activeBluffs.some(b => b.type === 'falseCrisis') || p.activeSabotages.length > 0
                });
            }
        });
        
        return {
            phase,
            timeRemaining,
            state: this.state,
            player: {
                cookies: Math.floor(player.cookies),
                publicCookies: player.publicCookies,
                generators: player.generators,
                defenses: player.defenses,
                activeBluffs: player.activeBluffs.map(b => b.type),
                activeDebuffs: player.activeDebuffs.map(d => d.type),
                activeSabotages: player.activeSabotages.map(s => s.type),
                perfectClickStreak: player.perfectClickStreak
            },
            opponents,
            perfectClickWindow: this.perfectClickWindow ? true : false,
            critBarPosition: this.critBarPosition,
            goldenCookie: this.goldenCookieActive ? this.goldenCookiePosition : null,
            prizePool: this.buyIn * this.players.size,
            generatorCosts: this.getGeneratorCosts(player),
            defenseCosts: DEFENSES,
            sabotageCosts: this.getSabotageCosts(),
            bluffCosts: BLUFFS
        };
    }
    
    getPhase() {
        if (this.state === 'ended') return 'ended';
        if (this.state === 'bakeoff') return 'bakeoff';
        
        const elapsed = this.currentTime;
        if (elapsed < 60) return 'early';
        if (elapsed < 240) return 'mid';
        if (elapsed < 360) return 'conflict';
        return 'bakeoff';
    }
    
    getGeneratorCosts(player) {
        const costs = {};
        for (const [key, gen] of Object.entries(GENERATORS)) {
            const count = player.generators[key] || 0;
            costs[key] = {
                ...gen,
                cost: Math.floor(gen.baseCost * Math.pow(1.15, count)),
                count
            };
        }
        return costs;
    }
    
    getSabotageCosts() {
        const costs = {};
        for (const [key, sab] of Object.entries(SABOTAGES)) {
            let cost = sab.cost;
            if (this.state === 'bakeoff') {
                cost = Math.floor(cost * 0.5);
            }
            costs[key] = { ...sab, cost };
        }
        return costs;
    }
    
    getResults() {
        const players = Array.from(this.players.values())
            .sort((a, b) => b.cookies - a.cookies);
        
        const winner = players[0];
        
        // Tiebreaker logic
        if (players.length > 1 && players[0].cookies === players[1].cookies) {
            // First tiebreaker: perfect click accuracy
            const accuracy0 = players[0].perfectClicks / players[0].totalClicks || 0;
            const accuracy1 = players[1].perfectClicks / players[1].totalClicks || 0;
            
            if (accuracy0 !== accuracy1) {
                players.sort((a, b) => {
                    const accA = a.perfectClicks / a.totalClicks || 0;
                    const accB = b.perfectClicks / b.totalClicks || 0;
                    return accB - accA;
                });
            } else {
                // Second tiebreaker: fewest failed sabotages
                players.sort((a, b) => a.failedSabotages - b.failedSabotages);
            }
        }
        
        return {
            winner: {
                id: players[0].id,
                name: players[0].name,
                cookies: Math.floor(players[0].cookies)
            },
            standings: players.map((p, i) => ({
                rank: i + 1,
                id: p.id,
                name: p.name,
                cookies: Math.floor(p.cookies),
                perfectClicks: p.perfectClicks,
                totalClicks: p.totalClicks
            }))
        };
    }
}

module.exports = Match;

const DEFENSES = {
    antivirus: {
        name: 'Antivirus',
        cost: 50,
        description: 'Blocks Cookie Worm attack.'
    },
    coolingSystem: {
        name: 'Cooling System',
        cost: 75,
        description: 'Prevents Oven Overload shutdown.'
    },
    firewall: {
        name: 'Firewall',
        cost: 40,
        description: 'Blocks Fog of War.'
    },
    reinforcedDisplay: {
        name: 'Reinforced Display',
        cost: 60,
        description: 'Prevents Sugar Bomb damage.'
    },
    precisionGloves: {
        name: 'Precision Gloves',
        cost: 45,
        description: 'Blocks Stale Batch debuff.'
    },
    shield: {
        name: 'Shield',
        cost: 100,
        description: 'Blocks any one sabotage.'
    },
    decoy: {
        name: 'Decoy',
        cost: 35,
        description: 'Creates fake PCC spike to bait calls.'
    },
    sabotageTrap: {
        name: 'Sabotage Trap',
        cost: 150,
        description: 'Reflects 50% of sabotage back at attacker.'
    },
    revealScanner: {
        name: 'Reveal Scanner',
        cost: 80,
        description: 'Reveals if a player is bluffing.'
    },
    autoShield: {
        name: 'Auto-Shield',
        cost: 200,
        description: 'Automatically blocks next 3 sabotages.'
    }
};

module.exports = DEFENSES;

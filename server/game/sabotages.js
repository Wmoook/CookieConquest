const SABOTAGES = {
    cookieWorm: {
        name: 'Cookie Worm',
        cost: 100,
        description: '15% passive drain for 10 seconds.',
        counter: 'antivirus'
    },
    ovenOverload: {
        name: 'Oven Overload',
        cost: 150,
        description: 'Shuts off generators for 5 seconds.',
        counter: 'coolingSystem'
    },
    fogOfWar: {
        name: 'Fog of War',
        cost: 80,
        description: 'Hides all opponent stats for 8 seconds.',
        counter: 'firewall'
    },
    sugarBomb: {
        name: 'Sugar Bomb',
        cost: 120,
        description: 'Halves target public cookie count.',
        counter: 'reinforcedDisplay'
    },
    staleBatch: {
        name: 'Stale Batch',
        cost: 90,
        description: 'Debuffs clicking accuracy for 8 seconds.',
        counter: 'precisionGloves'
    }
};

module.exports = SABOTAGES;

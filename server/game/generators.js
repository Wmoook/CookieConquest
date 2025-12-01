const GENERATORS = {
    oven: {
        name: 'Oven',
        baseCost: 10,
        output: 1, // per second
        description: 'Basic cookie oven. Perfect-click streak bonus.'
    },
    kitchen: {
        name: 'Kitchen',
        baseCost: 50,
        output: 5,
        description: 'Full kitchen setup. Rhythm boost minigame.'
    },
    factory: {
        name: 'Factory',
        baseCost: 200,
        output: 15,
        description: 'Industrial cookie factory. Efficiency minigame.'
    },
    aiBaker: {
        name: 'AI Baker',
        baseCost: 600,
        output: 50,
        description: 'Artificial intelligence baker. Auto-counters sabotages.'
    }
};

module.exports = GENERATORS;

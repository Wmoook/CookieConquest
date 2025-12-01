const BLUFFS = {
    inflate10: {
        name: 'Inflate +10%',
        cost: 20,
        duration: 30000,
        description: 'Show 10% more cookies than you have.'
    },
    inflate20: {
        name: 'Inflate +20%',
        cost: 40,
        duration: 25000,
        description: 'Show 20% more cookies than you have.'
    },
    inflate50: {
        name: 'Inflate +50%',
        cost: 80,
        duration: 20000,
        description: 'Show 50% more cookies than you have.'
    },
    deflate10: {
        name: 'Deflate -10%',
        cost: 15,
        duration: 30000,
        description: 'Show 10% fewer cookies. Look weak.'
    },
    deflate20: {
        name: 'Deflate -20%',
        cost: 30,
        duration: 25000,
        description: 'Show 20% fewer cookies. Bait attacks.'
    },
    deflate50: {
        name: 'Deflate -50%',
        cost: 60,
        duration: 20000,
        description: 'Show 50% fewer cookies. Major deception.'
    },
    statMask: {
        name: 'Stat Mask',
        cost: 50,
        duration: 15000,
        description: 'Show a static number, no updates.'
    },
    falseCrisis: {
        name: 'False Crisis',
        cost: 25,
        duration: 20000,
        description: 'Show fake "being sabotaged" notification.'
    }
};

module.exports = BLUFFS;

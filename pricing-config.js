// ============================================================
// YassClean Pricing Configuration
// Edit this file to change pricing, add-ons, or run promotions.
// No other files need to be touched for price changes.
// ============================================================

const CONFIG = {

    // -------------------- CORE SERVICE PRICING --------------------
    // Format: 'beds-baths': price
    pricing: {
        maintenance: {
            '1-1': 150, '2-1': 178, '2-2': 214,
            '3-1': 205, '3-2': 242, '3-3': 279,
            '4-1': 233, '4-2': 270, '4-3': 306, '4-4': 343
        },
        deepClean: {
            '1-1': 225, '2-1': 266, '2-2': 321,
            '3-1': 308, '3-2': 363, '3-3': 418,
            '4-1': 349, '4-2': 404, '4-3': 459, '4-4': 515
        },
        moveInOut: {
            '1-1': 299, '2-1': 355, '2-2': 428,
            '3-1': 410, '3-2': 483, '3-3': 557,
            '4-1': 465, '4-2': 539, '4-3': 612, '4-4': 686
        }
    },

    // -------------------- SQFT TIER MATRIX --------------------
    // Adjusts pricing when actual sqft is significantly above/below average
    tierMatrix: {
        '1-1': { baselineSqft: 700,  downMax: 560,  upMin: 840,  downTo: null,  upTo: '2-1' },
        '2-1': { baselineSqft: 900,  downMax: 720,  upMin: 1080, downTo: '1-1', upTo: '2-2' },
        '2-2': { baselineSqft: 1050, downMax: 840,  upMin: 1260, downTo: '2-1', upTo: '3-1' },
        '3-1': { baselineSqft: 1200, downMax: 960,  upMin: 1440, downTo: '2-1', upTo: '3-2' },
        '3-2': { baselineSqft: 1450, downMax: 1160, upMin: 1740, downTo: '3-1', upTo: '3-3' },
        '3-3': { baselineSqft: 1750, downMax: 1400, upMin: 2100, downTo: '3-2', upTo: '4-2' },
        '4-1': { baselineSqft: 1650, downMax: 1320, upMin: 1980, downTo: '3-2', upTo: '4-2' },
        '4-2': { baselineSqft: 1950, downMax: 1560, upMin: 2340, downTo: '4-1', upTo: '4-3' },
        '4-3': { baselineSqft: 2300, downMax: 1840, upMin: 2760, downTo: '4-2', upTo: '4-4' },
        '4-4': { baselineSqft: 2800, downMax: 2240, upMin: 3360, downTo: '4-3', upTo: null  }
    },

    // -------------------- CLEANING ADD-ONS --------------------
    extras: [
        { name: 'Interior Window Detailing', price: 50 },
        { name: 'Additional Bathroom', price: 40, multiQty: true },
        { name: 'Additional Room', price: 28 },
        { name: 'Finished Basement', price: 28 },
        { name: 'Tile & Grout Detailing', price: 35, multiQty: true, perUnit: 'per room' },
        { name: 'Inside Fridge', price: 55, multiQty: true },
        { name: 'Inside Oven', price: 35, multiQty: true }
    ],

    // -------------------- CARPET SERVICES --------------------
    carpet: {
        'Basic Deep Extraction': { '1-2 Rooms': 150, '3-4 Rooms': 299, '5+ Rooms': 449 },
        'Basic + Stain & Odor':  { '1-2 Rooms': 196, '3-4 Rooms': 380, '5+ Rooms': 564 },
        'Ultimate + Stain Guard': { '1-2 Rooms': 219, '3-4 Rooms': 426, '5+ Rooms': 633 }
    },

    carpetDescriptions: {
        'Basic Deep Extraction': 'Experience the difference of professional hot water extraction — the gold standard in carpet care. Our system penetrates deep into carpet fibers to flush out dirt, grime, and allergens that regular vacuums leave behind. With powerful dual-action suction, we remove nearly all moisture for faster dry times. The result: carpets that look brighter, feel softer, and create a healthier environment for your family and pets.',
        'Basic + Stain & Odor': 'For noticeable wear, spots, pet stains, and odors. Includes a deodorizer with enzymes to break down scents and oxidizers to remove stains. Requires multiple passes for best results.',
        'Ultimate + Stain Guard': 'Our most complete service: deep extraction cleaning, professional stain guard, and a deodorizing finish that neutralizes odors at the source. Perfect for pet owners or anyone who wants carpets that look, feel, and smell fresh.'
    },

    carpetExtras: [
        { name: 'Extra Room (100 sqft)', price: 58 },
        { name: 'Hallway Cleaning', price: 29 },
        { name: 'Landing / Walk-In Closet', price: 23 },
        { name: 'Staircase (per flight)', price: 52 },
        { name: 'Extra Deodorizer (per room)', price: 29 },
        { name: 'Extra Stain Guard (per room)', price: 58 }
    ],

    // -------------------- FREQUENCY / DISCOUNT TIERS --------------------
    frequencyTiers: [
        { key: 'oneTime', label: 'One-Time', discount: 0, badge: null },
        { key: 'monthly', label: 'Monthly', discount: 0.10, badge: null },
        { key: 'biweekly', label: 'Bi-Weekly', discount: 0.15, badge: { text: 'Most Popular', cls: 'badge-popular' } },
        { key: 'weekly', label: 'Weekly', discount: 0.20, badge: { text: 'Best Value', cls: 'badge-best' } }
    ],

    // -------------------- PROMOTIONS --------------------
    // Global promotion — shown on ALL pages (set to null to disable)
    promotion: null,

    // -------------------- OFFERS (URL-BASED) --------------------
    // Path-based offers — only activate when user lands on that URL
    // Update seasonally; no code changes needed, just edit this config.
    offers: {
        '/offer': {
            name: 'Spring Refresh',
            headline: 'Your Offer Has Been Unlocked',
            tagline: 'Spring Refresh Special — Limited Time Only',
            freeAddons: ['Tile & Grout Detailing', 'Inside Oven'],
            partnerPerk: {
                text: 'Get $50 off exterior yard cleanup from our partner',
                condition: 'when you set up recurring service'
            },
            urgencyNote: 'This exclusive offer is only available through this link'
        }
    }
};

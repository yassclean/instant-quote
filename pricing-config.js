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
            '1-1': 150, '1-2': 187, '1-3': 224, '1-4': 261, '1-5': 298, '1-6': 335, 
            '2-1': 178, '2-2': 215, '2-3': 252, '2-4': 289, '2-5': 326, '2-6': 363, 
            '3-1': 206, '3-2': 243, '3-3': 280, '3-4': 317, '3-5': 354, '3-6': 391, 
            '4-1': 234, '4-2': 271, '4-3': 308, '4-4': 345, '4-5': 382, '4-6': 419, 
            '5-1': 262, '5-2': 299, '5-3': 336, '5-4': 373, '5-5': 410, '5-6': 447, 
            '6-1': 290, '6-2': 327, '6-3': 364, '6-4': 401, '6-5': 438, '6-6': 475
        },
        deepClean: {
            '1-1': 225, '1-2': 280, '1-3': 335, '1-4': 390, '1-5': 445, '1-6': 500, 
            '2-1': 266, '2-2': 321, '2-3': 376, '2-4': 431, '2-5': 486, '2-6': 541, 
            '3-1': 307, '3-2': 362, '3-3': 417, '3-4': 472, '3-5': 527, '3-6': 582, 
            '4-1': 348, '4-2': 403, '4-3': 458, '4-4': 513, '4-5': 568, '4-6': 623, 
            '5-1': 389, '5-2': 444, '5-3': 499, '5-4': 554, '5-5': 609, '5-6': 664, 
            '6-1': 430, '6-2': 485, '6-3': 540, '6-4': 595, '6-5': 650, '6-6': 705
        },
        moveInOut: {
            '1-1': 299, '1-2': 373, '1-3': 447, '1-4': 521, '1-5': 595, '1-6': 669, 
            '2-1': 355, '2-2': 429, '2-3': 503, '2-4': 577, '2-5': 651, '2-6': 725, 
            '3-1': 411, '3-2': 485, '3-3': 559, '3-4': 633, '3-5': 707, '3-6': 781, 
            '4-1': 467, '4-2': 541, '4-3': 615, '4-4': 689, '4-5': 763, '4-6': 837, 
            '5-1': 523, '5-2': 597, '5-3': 671, '5-4': 745, '5-5': 819, '5-6': 893, 
            '6-1': 579, '6-2': 653, '6-3': 727, '6-4': 801, '6-5': 875, '6-6': 949
        }
    },


    // -------------------- SQFT TIER MATRIX --------------------
    // Adjusts pricing when actual sqft is significantly above/below average
    tierMatrix: {
        '1-1': { baselineSqft: 700, downMax: 560, upMin: 840, downTo: null, upTo: '1-2' },
        '1-2': { baselineSqft: 850, downMax: 680, upMin: 1020, downTo: '1-1', upTo: '1-3' },
        '1-3': { baselineSqft: 1000, downMax: 800, upMin: 1200, downTo: '1-2', upTo: '1-4' },
        '1-4': { baselineSqft: 1150, downMax: 920, upMin: 1380, downTo: '1-3', upTo: '1-5' },
        '1-5': { baselineSqft: 1300, downMax: 1040, upMin: 1560, downTo: '1-4', upTo: '1-6' },
        '1-6': { baselineSqft: 1450, downMax: 1160, upMin: 1740, downTo: '1-5', upTo: '2-6' },
        '2-1': { baselineSqft: 900, downMax: 720, upMin: 1080, downTo: '1-1', upTo: '2-2' },
        '2-2': { baselineSqft: 1050, downMax: 840, upMin: 1260, downTo: '2-1', upTo: '2-3' },
        '2-3': { baselineSqft: 1200, downMax: 960, upMin: 1440, downTo: '2-2', upTo: '2-4' },
        '2-4': { baselineSqft: 1350, downMax: 1080, upMin: 1620, downTo: '2-3', upTo: '2-5' },
        '2-5': { baselineSqft: 1500, downMax: 1200, upMin: 1800, downTo: '2-4', upTo: '2-6' },
        '2-6': { baselineSqft: 1650, downMax: 1320, upMin: 1980, downTo: '2-5', upTo: '3-6' },
        '3-1': { baselineSqft: 1100, downMax: 880, upMin: 1320, downTo: '2-1', upTo: '3-2' },
        '3-2': { baselineSqft: 1250, downMax: 1000, upMin: 1500, downTo: '3-1', upTo: '3-3' },
        '3-3': { baselineSqft: 1400, downMax: 1120, upMin: 1680, downTo: '3-2', upTo: '3-4' },
        '3-4': { baselineSqft: 1550, downMax: 1240, upMin: 1860, downTo: '3-3', upTo: '3-5' },
        '3-5': { baselineSqft: 1700, downMax: 1360, upMin: 2040, downTo: '3-4', upTo: '3-6' },
        '3-6': { baselineSqft: 1850, downMax: 1480, upMin: 2220, downTo: '3-5', upTo: '4-6' },
        '4-1': { baselineSqft: 1300, downMax: 1040, upMin: 1560, downTo: '3-1', upTo: '4-2' },
        '4-2': { baselineSqft: 1450, downMax: 1160, upMin: 1740, downTo: '4-1', upTo: '4-3' },
        '4-3': { baselineSqft: 1600, downMax: 1280, upMin: 1920, downTo: '4-2', upTo: '4-4' },
        '4-4': { baselineSqft: 1750, downMax: 1400, upMin: 2100, downTo: '4-3', upTo: '4-5' },
        '4-5': { baselineSqft: 1900, downMax: 1520, upMin: 2280, downTo: '4-4', upTo: '4-6' },
        '4-6': { baselineSqft: 2050, downMax: 1640, upMin: 2460, downTo: '4-5', upTo: '5-6' },
        '5-1': { baselineSqft: 1500, downMax: 1200, upMin: 1800, downTo: '4-1', upTo: '5-2' },
        '5-2': { baselineSqft: 1650, downMax: 1320, upMin: 1980, downTo: '5-1', upTo: '5-3' },
        '5-3': { baselineSqft: 1800, downMax: 1440, upMin: 2160, downTo: '5-2', upTo: '5-4' },
        '5-4': { baselineSqft: 1950, downMax: 1560, upMin: 2340, downTo: '5-3', upTo: '5-5' },
        '5-5': { baselineSqft: 2100, downMax: 1680, upMin: 2520, downTo: '5-4', upTo: '5-6' },
        '5-6': { baselineSqft: 2250, downMax: 1800, upMin: 2700, downTo: '5-5', upTo: '6-6' },
        '6-1': { baselineSqft: 1700, downMax: 1360, upMin: 2040, downTo: '5-1', upTo: '6-2' },
        '6-2': { baselineSqft: 1850, downMax: 1480, upMin: 2220, downTo: '6-1', upTo: '6-3' },
        '6-3': { baselineSqft: 2000, downMax: 1600, upMin: 2400, downTo: '6-2', upTo: '6-4' },
        '6-4': { baselineSqft: 2150, downMax: 1720, upMin: 2580, downTo: '6-3', upTo: '6-5' },
        '6-5': { baselineSqft: 2300, downMax: 1840, upMin: 2760, downTo: '6-4', upTo: '6-6' },
        '6-6': { baselineSqft: 2450, downMax: 1960, upMin: 2940, downTo: '6-5', upTo: null }
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

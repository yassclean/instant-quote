/* ============================================================
   YassClean — App Logic
   Pricing engine, Google Maps autocomplete, step navigation
   ============================================================ */

// ==================== PRICING DATA ====================
const PRICING = {
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
};

const CARPET = {
    'Basic Deep Extraction': { '1-2 Rooms': 150, '3-4 Rooms': 299, '5+ Rooms': 449 },
    'Basic + Stain & Odor': { '1-2 Rooms': 196, '3-4 Rooms': 380, '5+ Rooms': 564 },
    'Ultimate + Stain Guard': { '1-2 Rooms': 219, '3-4 Rooms': 426, '5+ Rooms': 633 }
};

const EXTRAS = [
    { name: 'Deep Clean Add-On', price: 100 },
    { name: 'Interior Window Detailing', price: 50 },
    { name: 'Additional Bathroom', price: 40 },
    { name: 'Additional Room', price: 28 },
    { name: 'Finished Basement', price: 28 },
    { name: 'Tile & Grout Cleaning', price: 35 },
    { name: 'Inside Fridge', price: 55 },
    { name: 'Inside Oven', price: 35 }
];

const CARPET_EXTRAS = [
    { name: 'Extra Room (100 sqft)', price: 58 },
    { name: 'Hallway Cleaning', price: 29 },
    { name: 'Landing / Walk-In Closet', price: 23 },
    { name: 'Staircase (per flight)', price: 52 },
    { name: 'Extra Deodorizer (per room)', price: 29 },
    { name: 'Extra Stain Guard (per room)', price: 58 }
];

const FREQUENCY_TIERS = [
    { key: 'oneTime', label: 'One-Time', discount: 0, badge: null },
    { key: 'monthly', label: 'Monthly', discount: 0.10, badge: null },
    { key: 'biweekly', label: 'Bi-Weekly', discount: 0.15, badge: { text: 'Most Popular', cls: 'badge-popular' } },
    { key: 'weekly', label: 'Weekly', discount: 0.20, badge: { text: 'Best Value', cls: 'badge-best' } }
];

// ==================== STATE ====================
const state = {
    currentStep: 1,
    address: '',
    beds: null,
    baths: null,
    sqft: null
};

// ==================== DOM REFS ====================
const $ = id => document.getElementById(id);
const stepSections = [null, $('step1'), $('step2'), $('step3')];
const stepDots = document.querySelectorAll('.step-dot');
const stepLines = document.querySelectorAll('.step-line');

// ==================== GOOGLE MAPS AUTOCOMPLETE ====================
let autocomplete;

function initAutocomplete() {
    const input = $('addressInput');
    autocomplete = new google.maps.places.Autocomplete(input, {
        types: ['address'],
        componentRestrictions: { country: 'us' },
        fields: ['formatted_address', 'address_components', 'geometry']
    });

    autocomplete.addListener('place_changed', () => {
        const place = autocomplete.getPlace();
        if (place && place.formatted_address) {
            state.address = place.formatted_address;
            $('getQuoteBtn').disabled = false;
        }
    });

    // Also enable button on manual typing (if > 10 chars)
    input.addEventListener('input', () => {
        $('getQuoteBtn').disabled = input.value.trim().length < 10;
    });
}
// Expose globally for Google Maps callback
window.initAutocomplete = initAutocomplete;

// ==================== STEP NAVIGATION ====================
function goToStep(n) {
    // Hide current
    stepSections[state.currentStep].classList.remove('active');
    // Show next
    stepSections[n].classList.add('active');

    // Update dots
    stepDots.forEach((dot, i) => {
        const stepNum = i + 1;
        dot.classList.remove('active', 'done');
        if (stepNum === n) dot.classList.add('active');
        else if (stepNum < n) dot.classList.add('done');
    });

    // Update lines
    stepLines.forEach((line, i) => {
        line.classList.toggle('active', i + 1 < n);
    });

    state.currentStep = n;
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ==================== PROPERTY LOOKUP (OPTION C) ====================
function simulatePropertyLookup() {
    const loader = $('lookupLoader');
    const form = $('propertyForm');

    loader.style.display = 'flex';
    form.classList.add('hidden');
    $('selectedAddressDisplay').textContent = state.address;

    // Simulate API search (replace with real API call)
    setTimeout(() => {
        loader.style.display = 'none';
        form.classList.remove('hidden');
        $('addressConfirm').innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;color:var(--accent);flex-shrink:0"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg> ${state.address}`;
    }, 2200);
}

// ==================== PRICING ENGINE ====================
function getPrice(category, beds, baths) {
    const key = `${beds}-${baths}`;
    if (PRICING[category] && PRICING[category][key]) {
        return PRICING[category][key];
    }
    // Fallback: cap baths at beds
    const cappedBaths = Math.min(baths, beds);
    const fallbackKey = `${beds}-${cappedBaths}`;
    return PRICING[category] ? PRICING[category][fallbackKey] || null : null;
}

function applyDiscount(price, discount) {
    return +(price * (1 - discount)).toFixed(2);
}

function formatPrice(amount) {
    const dollars = Math.floor(amount);
    const cents = Math.round((amount - dollars) * 100);
    return { dollars, cents: cents.toString().padStart(2, '0') };
}

// ==================== RENDER PRICING ====================
function renderPricing() {
    const { beds, baths, sqft } = state;

    // Property Summary
    const summary = $('propertySummary');
    let summaryHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;color:var(--accent)">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
        </svg>
        <span style="max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${state.address}</span>
        <span class="divider"></span>
        <span>${beds} Bed${beds > 1 ? 's' : ''}</span>
        <span class="divider"></span>
        <span>${baths} Bath${baths > 1 ? 's' : ''}</span>`;
    if (sqft) summaryHTML += `<span class="divider"></span><span>${Number(sqft).toLocaleString()} sqft</span>`;
    summary.innerHTML = summaryHTML;

    // 1. Deep Clean Hero Card
    const deepPrice = getPrice('deepClean', beds, baths);
    const dp = formatPrice(deepPrice);
    $('deepCleanCard').innerHTML = `
        <div class="hero-card-info">
            <div class="hero-card-badge">✨ Recommended First Visit</div>
            <div class="hero-card-title">Residential Deep Clean</div>
            <div class="hero-card-desc">A thorough, top-to-bottom cleaning of your entire home. Perfect for first-time customers or seasonal refreshes.</div>
        </div>
        <div class="hero-card-price">
            <div class="price-large price-animate">$${dp.dollars}<span class="price-cents">.${dp.cents}</span></div>
            <div class="price-label">one-time service</div>
        </div>`;

    // 2. Maintenance Frequency Cards
    const baseMaintenancePrice = getPrice('maintenance', beds, baths);
    let freqHTML = '';
    FREQUENCY_TIERS.forEach(tier => {
        const price = tier.discount > 0 ? applyDiscount(baseMaintenancePrice, tier.discount) : baseMaintenancePrice;
        const p = formatPrice(price);
        const featured = tier.key === 'biweekly' ? ' featured' : '';
        const badgeHTML = tier.badge
            ? `<div class="freq-badge ${tier.badge.cls}">${tier.badge.text}</div>` : '';

        const savingsHTML = tier.discount > 0
            ? `<div class="freq-discount">Save ${Math.round(tier.discount * 100)}%</div>`
            : `<div class="freq-discount" style="color:var(--text-muted)">Base price</div>`;

        const originalHTML = tier.discount > 0
            ? `<div class="freq-original">$${baseMaintenancePrice.toFixed(2)}</div>` : '';

        freqHTML += `
            <div class="freq-card${featured}">
                ${badgeHTML}
                <div class="freq-title">${tier.label}</div>
                ${savingsHTML}
                <div class="freq-price price-animate">$${p.dollars}<span class="cents">.${p.cents}</span></div>
                <div class="freq-per">per visit</div>
                ${originalHTML}
                <ul class="freq-features">
                    <li>Same dedicated team</li>
                    <li>Flexible scheduling</li>
                    ${tier.discount >= 0.15 ? '<li>Priority booking</li>' : ''}
                    ${tier.discount >= 0.20 ? '<li>Free supplies included</li>' : ''}
                </ul>
            </div>`;
    });
    $('maintenanceCards').innerHTML = freqHTML;

    // 3. Move In/Out Card
    const movePrice = getPrice('moveInOut', beds, baths);
    const mp = formatPrice(movePrice);
    $('moveInOutCard').innerHTML = `
        <div class="single-info">
            <div class="single-title">Move In / Out Cleaning</div>
            <div class="single-desc">Comprehensive cleaning for move days. Every surface, appliance, and corner — ready for the next chapter.</div>
        </div>
        <div class="single-price price-animate">$${mp.dollars}<span class="cents">.${mp.cents}</span></div>`;

    // 4. Add-Ons
    let addonsHTML = '';
    EXTRAS.forEach(e => {
        addonsHTML += `
            <div class="addon-item">
                <span class="addon-name">${e.name}</span>
                <span class="addon-price">+$${e.price}</span>
            </div>`;
    });
    $('addOnsGrid').innerHTML = addonsHTML;

    // 5. Carpet Cleaning
    let carpetHTML = '';
    Object.entries(CARPET).forEach(([tier, sizes]) => {
        let rowsHTML = '';
        Object.entries(sizes).forEach(([rooms, price]) => {
            rowsHTML += `
                <div class="carpet-row">
                    <span class="carpet-rooms">${rooms}</span>
                    <span class="carpet-price">$${price}</span>
                </div>`;
        });
        carpetHTML += `
            <div class="carpet-card">
                <div class="carpet-tier">${tier.includes('Ultimate') ? '<span class="carpet-tier-accent">★ </span>' : ''}${tier}</div>
                ${rowsHTML}
            </div>`;
    });

    // Carpet extras
    carpetHTML += `<div class="carpet-card">
        <div class="carpet-tier">Extras & Add-Ons</div>
        ${CARPET_EXTRAS.map(e => `
            <div class="carpet-row">
                <span class="carpet-rooms">${e.name}</span>
                <span class="carpet-price">+$${e.price}</span>
            </div>`).join('')}
    </div>`;

    $('carpetCards').innerHTML = carpetHTML;
}

// ==================== EVENT LISTENERS ====================
document.addEventListener('DOMContentLoaded', () => {

    // Step 1 → Step 2
    $('getQuoteBtn').addEventListener('click', () => {
        if (!state.address) state.address = $('addressInput').value.trim();
        goToStep(2);
        simulatePropertyLookup();
    });

    // Step 2 → Step 1
    $('backToStep1').addEventListener('click', () => goToStep(1));

    // Step 3 → Step 2
    $('backToStep2').addEventListener('click', () => goToStep(2));

    // Bed selector
    document.querySelectorAll('#bedSelector .selector-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('#bedSelector .selector-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.beds = parseInt(btn.dataset.value);
            checkStep2Ready();
        });
    });

    // Bath selector
    document.querySelectorAll('#bathSelector .selector-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('#bathSelector .selector-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.baths = parseInt(btn.dataset.value);
            checkStep2Ready();
        });
    });

    // Sqft input
    $('sqftInput').addEventListener('input', (e) => {
        state.sqft = e.target.value ? parseInt(e.target.value) : null;
    });

    // Step 2 → Step 3
    $('seePricingBtn').addEventListener('click', () => {
        renderPricing();
        goToStep(3);
    });

    // Enter key on address triggers Get Quote
    $('addressInput').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const btn = $('getQuoteBtn');
            if (!btn.disabled) btn.click();
        }
    });
});

function checkStep2Ready() {
    $('seePricingBtn').disabled = !(state.beds && state.baths);
}

// Fallback if Google Maps fails to load
window.gm_authFailure = function () {
    console.warn('Google Maps auth failed — using plain text input.');
};
// If initAutocomplete never gets called (script blocked), enable manual mode
setTimeout(() => {
    if (typeof google === 'undefined') {
        console.warn('Google Maps API unavailable — using plain text input.');
        const input = $('addressInput');
        input.addEventListener('input', () => {
            $('getQuoteBtn').disabled = input.value.trim().length < 10;
        });
    }
}, 5000);

/* ============================================================
   YassClean — App Logic
   Pricing engine, Google Maps autocomplete, step navigation
   ============================================================ */

// ==================== PRICING DATA (from pricing-config.js) ====================
const PRICING = CONFIG.pricing;
const TIER_MATRIX = CONFIG.tierMatrix;
const CARPET = CONFIG.carpet;
const CARPET_DESCRIPTIONS = CONFIG.carpetDescriptions;
const EXTRAS = CONFIG.extras;
const CARPET_EXTRAS = CONFIG.carpetExtras;
const FREQUENCY_TIERS = CONFIG.frequencyTiers;

// ==================== PROMOTION ENGINE ====================
function getActivePromotion() {
    const promo = CONFIG.promotion;
    if (!promo) return null;
    if (promo.expiresAt && new Date(promo.expiresAt) < new Date()) return null;
    return promo;
}

function applyPromoDiscount(price, category) {
    const promo = getActivePromotion();
    if (!promo || !promo.appliesTo.includes(category)) return { price, hasPromo: false };
    const discounted = +(price * (1 - promo.discount)).toFixed(2);
    return { price: discounted, originalPrice: price, hasPromo: true, promoLabel: promo.banner };
}

// ==================== STATE ====================
const state = {
    currentStep: 1,
    address: '',
    beds: null,
    baths: null,
    sqft: null,
    selectedServices: [],  // { id, name, price }
    apiProperty: { beds: null, baths: null, sqft: null, source: null }  // API-populated values
};

// Capture UTM params & fbclid on page load for attribution
(function captureAttribution() {
    const params = new URLSearchParams(window.location.search);
    state.attribution = {
        utm_source: params.get('utm_source') || '',
        utm_medium: params.get('utm_medium') || '',
        utm_campaign: params.get('utm_campaign') || '',
        utm_content: params.get('utm_content') || '',
        utm_term: params.get('utm_term') || '',
        fbclid: params.get('fbclid') || '',
        gclid: params.get('gclid') || '',
        landing_page: window.location.href,
        referrer: document.referrer || ''
    };
})();

// ==================== DOM REFS ====================
const $ = id => document.getElementById(id);
const stepSections = [null, $('step1'), $('step2'), $('step3'), $('step4')];
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
            state.addressConfirmed = true;

            // Service area check — 25 mile radius from Lake Hopatcong
            const SERVICE_CENTER = { lat: 40.9631, lng: -74.6107 };
            const MAX_MILES = 25;

            if (place.geometry && place.geometry.location) {
                const lat = place.geometry.location.lat();
                const lng = place.geometry.location.lng();
                const distance = haversineDistance(SERVICE_CENTER.lat, SERVICE_CENTER.lng, lat, lng);

                if (distance > MAX_MILES) {
                    state.addressConfirmed = false;
                    $('getQuoteBtn').disabled = true;
                    showAreaMessage(`We currently serve within ${MAX_MILES} miles of Lake Hopatcong, NJ. Your address is about ${Math.round(distance)} miles away — but give us a call, we may still be able to help!`, true);
                    return;
                }
                hideAreaMessage();
            }

            $('getQuoteBtn').disabled = false;
        }
    });

    // If user edits the text after selecting, clear the confirmed address
    input.addEventListener('input', () => {
        state.addressConfirmed = false;
        state.address = '';
        $('getQuoteBtn').disabled = true;
        hideAreaMessage();
    });
}

// Haversine formula — returns distance in miles between two lat/lng points
function haversineDistance(lat1, lon1, lat2, lon2) {
    const R = 3958.8; // Earth radius in miles
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function showAreaMessage(msg, showCall) {
    let el = $('areaMessage');
    if (!el) {
        el = document.createElement('div');
        el.id = 'areaMessage';
        el.className = 'area-message';
        $('getQuoteBtn').parentElement.insertBefore(el, $('getQuoteBtn'));
    }
    const callBtn = showCall
        ? `<a href="tel:9739750177" class="area-call-btn"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.362 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.574 2.81.7A2 2 0 0 1 22 16.92z"/></svg> (973) 975-0177</a>`
        : '';
    el.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;flex-shrink:0"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg><span>${msg}${callBtn}</span>`;
    el.style.display = 'flex';
}

function hideAreaMessage() {
    const el = $('areaMessage');
    if (el) el.style.display = 'none';
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

    // Fire Meta Pixel events for funnel step tracking
    if (typeof fbq === 'function') {
        if (n === 2) fbq('trackCustom', 'PropertyLookup');
        if (n === 3) fbq('track', 'ViewContent', { content_name: 'Pricing' });
        if (n === 4) fbq('track', 'InitiateCheckout');
    }

    // Fire GA4 events for funnel step tracking
    if (typeof gtag === 'function') {
        if (n === 2) gtag('event', 'begin_property_lookup', { event_category: 'funnel' });
        if (n === 3) gtag('event', 'view_pricing', { event_category: 'funnel' });
        if (n === 4) gtag('event', 'begin_checkout', { event_category: 'funnel' });
    }
}

// ==================== PROPERTY LOOKUP ====================
async function performPropertyLookup() {
    const loader = $('lookupLoader');
    const form = $('propertyForm');

    loader.style.display = 'flex';
    form.classList.add('hidden');
    $('selectedAddressDisplay').textContent = state.address;

    let lookupResult = null;

    try {
        const res = await fetch('/api/lookup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ address: state.address })
        });
        if (res.ok) {
            lookupResult = await res.json();
        }
    } catch (err) {
        console.warn('Property lookup failed:', err);
    }

    // Minimum 1.5s so the loader doesn't flash
    await new Promise(r => setTimeout(r, 1500));

    loader.style.display = 'none';
    form.classList.remove('hidden');

    // Build the address confirmation with verification status
    const verified = lookupResult && lookupResult.confidence && lookupResult.confidence !== 'none';
    const statusHTML = verified
        ? `<span class="lookup-status lookup-verified">
               <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><path d="M12 2L3 7v5c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-9-5zm-1 15l-4-4 1.41-1.41L11 14.17l6.59-6.59L19 9l-8 8z"/></svg>
               Property verified via ${lookupResult.source || 'public records'}
           </span>`
        : `<span class="lookup-status lookup-unverified">Enter your property details below</span>`;

    $('addressConfirm').innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;color:var(--accent);flex-shrink:0">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
        </svg>
        ${state.address}
        ${statusHTML}`;

    // Pre-fill selectors if we got data
    if (lookupResult) {
        console.log('Lookup result:', JSON.stringify(lookupResult));
        // Store API-populated values for the booking payload
        state.apiProperty = {
            beds: lookupResult.beds || null,
            baths: lookupResult.baths || null,
            sqft: lookupResult.sqft || null,
            source: lookupResult.source || null
        };
        // Use setTimeout to ensure DOM has fully rendered after step transition
        setTimeout(() => {
            if (lookupResult.beds) prefillSelector('bedSelector', lookupResult.beds);
            if (lookupResult.baths) prefillSelector('bathSelector', lookupResult.baths);
            if (lookupResult.sqft) {
                $('sqftInput').value = lookupResult.sqft;
                state.sqft = lookupResult.sqft;
            }
            checkStep2Ready();
        }, 100);
    }
}

function prefillSelector(selectorId, value) {
    // Cap at 4 (our max button value)
    const cappedValue = Math.min(value, 4);
    const buttons = document.querySelectorAll(`#${selectorId} .selector-btn`);
    console.log(`prefillSelector: #${selectorId} found ${buttons.length} buttons, looking for value ${cappedValue}`);
    buttons.forEach(btn => {
        btn.classList.remove('active');
        if (parseInt(btn.dataset.value) === cappedValue) {
            btn.classList.add('active');
            console.log(`prefillSelector: activated button with value ${cappedValue} in ${selectorId}`);
            if (selectorId === 'bedSelector') state.beds = cappedValue;
            if (selectorId === 'bathSelector') state.baths = cappedValue;
        }
    });
}

// ==================== PRICING ENGINE ====================

// Resolve a bed/bath combo key, capping baths at beds for missing combos
function resolveComboKey(beds, baths) {
    const key = `${beds}-${baths}`;
    if (TIER_MATRIX[key]) return key;
    const cappedBaths = Math.min(baths, beds);
    return `${beds}-${cappedBaths}`;
}

// Apply square-footage tier adjustment.
// Returns { key, shifted, customSurcharge } where:
//   key = the (possibly shifted) combo key to price from
//   shifted = true if sqft caused a tier change
//   customSurcharge = true if the property exceeds the largest tier
function adjustTierForSqft(comboKey, sqft) {
    const tier = TIER_MATRIX[comboKey];
    if (!tier || !sqft) return { key: comboKey, shifted: false, customSurcharge: false };

    if (sqft < tier.downMax && tier.downTo) {
        return { key: tier.downTo, shifted: true, customSurcharge: false };
    }
    if (sqft > tier.upMin) {
        if (!tier.upTo) {
            return { key: comboKey, shifted: false, customSurcharge: true };
        }
        return { key: tier.upTo, shifted: true, customSurcharge: false };
    }
    return { key: comboKey, shifted: false, customSurcharge: false };
}

function getPrice(category, beds, baths, sqft) {
    const comboKey = resolveComboKey(beds, baths);
    const { key, shifted, customSurcharge } = adjustTierForSqft(comboKey, sqft);

    const basePrice = PRICING[category] ? PRICING[category][key] || null : null;
    return { price: basePrice, comboKey: key, shifted, customSurcharge };
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

    // Promotion Banner
    const promo = getActivePromotion();
    const promoBanner = $('promoBanner');
    if (promo) {
        promoBanner.innerHTML = `<span class="promo-icon">🎉</span> ${promo.banner}${promo.promoCode ? ` — Code: <strong>${promo.promoCode}</strong>` : ''}`;
        promoBanner.style.display = 'flex';
    } else {
        promoBanner.style.display = 'none';
    }

    // 1. Deep Clean Hero Card
    const deepResult = getPrice('deepClean', beds, baths, sqft);
    const dp = formatPrice(deepResult.price);
    const deepTierNote = deepResult.shifted ? `<div class="tier-note">Adjusted for ${Number(sqft).toLocaleString()} sqft</div>` : '';
    const deepSurcharge = deepResult.customSurcharge ? `<div class="tier-note surcharge-note">Custom pricing — please call for a quote</div>` : '';
    const deepCleanEl = $('deepCleanCard');
    deepCleanEl.classList.add('selectable');
    deepCleanEl.dataset.serviceId = 'deepClean';
    deepCleanEl.dataset.serviceName = 'Residential Deep Clean';
    deepCleanEl.dataset.servicePrice = deepResult.customSurcharge ? 'Custom' : deepResult.price;
    deepCleanEl.innerHTML = `
        <div class="select-check"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg></div>
        <div class="hero-card-info">
            <div class="hero-card-badge">✨ Recommended First Visit</div>
            <div class="hero-card-title">Residential Deep Clean</div>
            <div class="hero-card-desc">A thorough, top-to-bottom cleaning of your entire home. Perfect for first-time customers or seasonal refreshes.</div>
            <div class="deep-clean-faq-toggle" onclick="event.stopPropagation();this.classList.toggle('open');this.nextElementSibling.classList.toggle('open')">
                What's Included? <span class="faq-arrow">▾</span>
            </div>
            <div class="deep-clean-faq-content">
                <div class="deep-clean-faq-inner">
                    <strong>Why a deep clean?</strong> Your first visit takes extra time because we bring everything to a maintainable baseline. Homes without regular professional cleaning need 2–3× more time.
                    <br><br>
                    <strong>What's covered:</strong>
                    <div class="faq-includes">
                        <span>Kitchen, baths &amp; floors</span>
                        <span>Baseboards &amp; trim</span>
                        <span>Switch plates &amp; outlets</span>
                        <span>Light fixtures</span>
                        <span>Door frames &amp; handles</span>
                        <span>High-touch surfaces</span>
                        <span>Full dusting throughout</span>
                    </div>
                    <br>
                    <em style="color:var(--text-muted)">After the deep clean, maintenance visits keep everything fresh at a lower price.</em>
                </div>
            </div>
        </div>
        <div class="hero-card-price">
            <div class="price-large price-animate">${deepResult.customSurcharge ? 'Custom' : `$${dp.dollars}<span class="price-cents">.${dp.cents}</span>`}</div>
            <div class="price-label">one-time service</div>
            ${deepTierNote}${deepSurcharge}
        </div>`;

    // 2. Maintenance Frequency Cards
    const maintResult = getPrice('maintenance', beds, baths, sqft);
    const baseMaintenancePrice = maintResult.price;
    const maintTierNote = maintResult.shifted ? `<div class="tier-note">Adjusted for ${Number(sqft).toLocaleString()} sqft</div>` : '';
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
            <div class="freq-card${featured} selectable" data-service-id="maintenance-${tier.key}" data-service-name="Maintenance — ${tier.label}" data-service-price="${maintResult.customSurcharge ? 'Custom' : price}">
                <div class="select-check"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg></div>
                ${badgeHTML}
                <div class="freq-title">${tier.label}</div>
                ${savingsHTML}
                <div class="freq-price price-animate">${maintResult.customSurcharge ? 'Custom' : `$${p.dollars}<span class="cents">.${p.cents}</span>`}</div>
                <div class="freq-per">per visit</div>
                ${originalHTML}
                ${maintTierNote}
                <ul class="freq-features">
                    <li>Same dedicated team</li>
                    <li>Flexible scheduling</li>
                    <li>Priority booking</li>
                    <li>Free supplies included</li>
                </ul>
            </div>`;
    });
    $('maintenanceCards').innerHTML = freqHTML;

    // 3. Move In/Out Card
    const moveResult = getPrice('moveInOut', beds, baths, sqft);
    const mp = formatPrice(moveResult.price);
    const moveTierNote = moveResult.shifted ? `<div class="tier-note">Adjusted for ${Number(sqft).toLocaleString()} sqft</div>` : '';
    const moveSurcharge = moveResult.customSurcharge ? `<div class="tier-note surcharge-note">Custom pricing — please call for a quote</div>` : '';
    const moveEl = $('moveInOutCard');
    moveEl.classList.add('selectable');
    moveEl.dataset.serviceId = 'moveInOut';
    moveEl.dataset.serviceName = 'Move In / Out Cleaning';
    moveEl.dataset.servicePrice = moveResult.customSurcharge ? 'Custom' : moveResult.price;
    moveEl.innerHTML = `
        <div class="select-check"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg></div>
        <div class="single-info">
            <div class="single-title">Move In / Out Cleaning</div>
            <div class="single-desc">Comprehensive cleaning for move days — includes inside fridge, oven, and window detailing. Every surface, appliance, and corner — ready for the next chapter.</div>
        </div>
        <div class="move-price-wrapper">
            <div class="single-price price-animate">${moveResult.customSurcharge ? 'Custom' : `$${mp.dollars}<span class="cents">.${mp.cents}</span>`}</div>
            ${moveTierNote}${moveSurcharge}
        </div>`;

    // 4. Add-Ons
    let addonsHTML = '';
    EXTRAS.forEach(e => {
        const addonId = `addon-${e.name.replace(/\s+/g, '-').toLowerCase()}`;
        if (e.multiQty) {
            // Multi-quantity: stepper buttons
            const unitLabel = e.perUnit ? ` ${e.perUnit}` : ' each';
            addonsHTML += `
                <div class="addon-item has-qty" data-service-id="${addonId}" data-service-name="${e.name}" data-service-price="${e.price}">
                    <span class="addon-name">${e.name}</span>
                    <span class="addon-price">$${e.price}${unitLabel}</span>
                    <div class="addon-qty">
                        <button type="button" class="addon-qty-btn" data-dir="-1" data-addon-id="${addonId}">−</button>
                        <span class="addon-qty-count" id="qty-${addonId}">0</span>
                        <button type="button" class="addon-qty-btn" data-dir="1" data-addon-id="${addonId}">+</button>
                    </div>
                </div>`;
        } else {
            // Simple toggle
            addonsHTML += `
                <div class="addon-item selectable" data-service-id="${addonId}" data-service-name="${e.name}" data-service-price="${e.price}">
                    <span class="addon-name">${e.name}</span>
                    <span class="addon-price">+$${e.price}</span>
                    <div class="select-check"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg></div>
                </div>`;
        }
    });
    $('addOnsGrid').innerHTML = addonsHTML;
    // Generate filtered add-ons for Move In/Out (fridge & oven already included)
    const MOVE_EXCLUDED = ['Inside Fridge', 'Inside Oven'];
    let moveAddonsHTML = '';
    EXTRAS.filter(e => !MOVE_EXCLUDED.includes(e.name)).forEach(e => {
        const addonId = `addon-${e.name.replace(/\s+/g, '-').toLowerCase()}-move`;
        if (e.multiQty) {
            const unitLabel = e.perUnit ? ` ${e.perUnit}` : ' each';
            moveAddonsHTML += `
                <div class="addon-item has-qty" data-service-id="${addonId}" data-service-name="${e.name}" data-service-price="${e.price}">
                    <span class="addon-name">${e.name}</span>
                    <span class="addon-price">$${e.price}${unitLabel}</span>
                    <div class="addon-qty">
                        <button type="button" class="addon-qty-btn" data-dir="-1" data-addon-id="${addonId}">−</button>
                        <span class="addon-qty-count" id="qty-${addonId}">0</span>
                        <button type="button" class="addon-qty-btn" data-dir="1" data-addon-id="${addonId}">+</button>
                    </div>
                </div>`;
        } else {
            moveAddonsHTML += `
                <div class="addon-item selectable" data-service-id="${addonId}" data-service-name="${e.name}" data-service-price="${e.price}">
                    <span class="addon-name">${e.name}</span>
                    <span class="addon-price">+$${e.price}</span>
                    <div class="select-check"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg></div>
                </div>`;
        }
    });
    $('addOnsGridMove').innerHTML = moveAddonsHTML;

    // 5. Carpet Cleaning (informational only — not selectable)
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
                <div class="carpet-details-toggle" onclick="this.nextElementSibling.classList.toggle('open');this.classList.toggle('open')">
                    Details <span class="toggle-arrow">▾</span>
                </div>
                <div class="carpet-desc">${CARPET_DESCRIPTIONS[tier] || ''}</div>
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
    // Clone carpet HTML for the Move In/Out section
    $('carpetCardsMove').innerHTML = carpetHTML;

    // Reset selections and service type
    state.selectedServices = [];
    state.serviceType = null;
    updateSelectionUI();

    // Attach click handlers to all selectable cards
    document.querySelectorAll('.selectable').forEach(card => {
        card.addEventListener('click', () => toggleServiceSelection(card));
    });

    // Attach quantity stepper handlers
    document.querySelectorAll('.addon-qty-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const addonId = btn.dataset.addonId;
            const dir = parseInt(btn.dataset.dir);
            adjustQty(addonId, dir);
        });
    });

    // Attach service-type selector handlers
    document.querySelectorAll('.service-type-card').forEach(card => {
        card.addEventListener('click', () => {
            selectServiceType(card.dataset.serviceType);
        });
    });
}

// ==================== SERVICE TYPE SELECTION ====================
function selectServiceType(type) {
    state.serviceType = type;

    // Clear any previous selections when switching types
    state.selectedServices = [];
    document.querySelectorAll('.selectable.selected').forEach(el => el.classList.remove('selected'));
    document.querySelectorAll('.addon-qty-count').forEach(el => el.textContent = '0');
    document.querySelectorAll('.addon-item.has-qty.selected').forEach(el => el.classList.remove('selected'));

    // Update active state on type cards
    document.querySelectorAll('.service-type-card').forEach(c => {
        c.classList.toggle('active', c.dataset.serviceType === type);
    });

    // Show/hide the pricing sections
    const sections = {
        deepClean: $('sectionDeepClean'),
        moveInOut: $('sectionMoveInOut'),
        customQuote: $('sectionCustomQuote')
    };
    Object.entries(sections).forEach(([key, el]) => {
        el.style.display = key === type ? 'block' : 'none';
    });

    // Show the CTA section
    $('ctaSection').style.display = 'flex';

    // For custom quote, auto-select the card
    if (type === 'customQuote') {
        const customCard = $('customQuoteCard');
        toggleServiceSelection(customCard);
    }

    // Scroll to the revealed content
    const targetSection = sections[type];
    if (targetSection) {
        setTimeout(() => {
            targetSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 50);
    }

    updateSelectionUI();
}

// ==================== SERVICE SELECTION ====================
function toggleServiceSelection(card) {
    const id = card.dataset.serviceId;
    const name = card.dataset.serviceName;
    const price = card.dataset.servicePrice;

    // Skip multi-qty items — they use stepper buttons instead
    if (card.classList.contains('has-qty')) return;

    // For maintenance cards, only allow one frequency selected at a time
    if (id.startsWith('maintenance-')) {
        const wasSelected = card.classList.contains('selected');
        document.querySelectorAll('.freq-card.selected').forEach(el => {
            el.classList.remove('selected');
        });
        state.selectedServices = state.selectedServices.filter(s => !s.id.startsWith('maintenance-'));
        if (wasSelected) {
            updateSelectionUI();
            return;
        }
    }

    // Deep Clean, Move In/Out, and Custom Quote are mutually exclusive
    const exclusiveIds = ['deepClean', 'moveInOut', 'customQuote'];
    if (exclusiveIds.includes(id)) {
        exclusiveIds.filter(eid => eid !== id).forEach(otherId => {
            const otherCard = document.querySelector(`[data-service-id="${otherId}"]`);
            if (otherCard && otherCard.classList.contains('selected')) {
                otherCard.classList.remove('selected');
                state.selectedServices = state.selectedServices.filter(s => s.id !== otherId);
            }
        });
    }

    const idx = state.selectedServices.findIndex(s => s.id === id);
    if (idx >= 0) {
        state.selectedServices.splice(idx, 1);
        card.classList.remove('selected');
    } else {
        state.selectedServices.push({ id, name, price });
        card.classList.add('selected');
    }

    updateSelectionUI();
}

// Stepper for multi-quantity add-ons
function adjustQty(addonId, dir) {
    const card = document.querySelector(`[data-service-id="${addonId}"]`);
    const countEl = document.getElementById(`qty-${addonId}`);
    if (!card || !countEl) return;

    let current = parseInt(countEl.textContent) || 0;
    current = Math.max(0, Math.min(10, current + dir));
    countEl.textContent = current;

    const name = card.dataset.serviceName;
    const unitPrice = parseFloat(card.dataset.servicePrice);

    // Remove old entry
    state.selectedServices = state.selectedServices.filter(s => s.id !== addonId);
    card.classList.remove('selected');

    // Add with quantity if > 0
    if (current > 0) {
        const totalPrice = unitPrice * current;
        state.selectedServices.push({
            id: addonId,
            name: current > 1 ? `${name} ×${current}` : name,
            price: totalPrice.toString(),
            qty: current,
            unitPrice
        });
        card.classList.add('selected');
    }

    updateSelectionUI();
}

function updateSelectionUI() {
    const btn = $('continueToBookBtn');
    const hint = $('selectionHint');
    const todayServices = state.selectedServices.filter(s => !s.id.startsWith('maintenance-'));
    const recurringPlan = state.selectedServices.find(s => s.id.startsWith('maintenance-'));
    const todayCount = todayServices.length;
    const hasAnything = state.selectedServices.length > 0;

    btn.disabled = !hasAnything;

    if (!hasAnything) {
        hint.textContent = "Tap the services above to select what you'd like to book";
    } else if (todayCount === 0 && recurringPlan) {
        hint.textContent = "Recurring plan selected — add a deep clean to book your first visit";
    } else if (todayCount > 0 && recurringPlan) {
        hint.textContent = `${todayCount} service${todayCount > 1 ? 's' : ''} selected + recurring plan for after`;
    } else {
        hint.textContent = `${todayCount} service${todayCount > 1 ? 's' : ''} selected`;
    }
}

// ==================== BOOKING SUMMARY & SUBMISSION ====================
function renderBookingSummary() {
    // Separate today's services from recurring plan selection
    const todayServices = state.selectedServices.filter(s => !s.id.startsWith('maintenance-'));
    const recurringPlan = state.selectedServices.find(s => s.id.startsWith('maintenance-'));

    let html = '<div class="booking-summary-title">Today\'s Booking</div>';
    let total = 0;
    let hasCustom = false;

    if (todayServices.length === 0 && recurringPlan) {
        html += `<div class="booking-summary-note">A deep clean is required before starting a recurring plan. Go back to select one.</div>`;
    }

    todayServices.forEach(s => {
        const isCustom = s.price === 'Custom';
        if (isCustom) hasCustom = true;
        else total += parseFloat(s.price);

        html += `
            <div class="booking-summary-item">
                <span class="booking-summary-name">${s.name}</span>
                <span class="booking-summary-price">${isCustom ? 'Custom' : '$' + parseFloat(s.price).toFixed(2)}</span>
            </div>`;
    });

    html += `
        <div class="booking-summary-total">
            <span>Due at First Visit</span>
            <span class="booking-summary-price">${hasCustom ? 'From $' + total.toFixed(2) + '+' : '$' + total.toFixed(2)}</span>
        </div>`;

    // Show recurring plan as separate informational section
    if (recurringPlan) {
        const isCustom = recurringPlan.price === 'Custom';
        html += `
            <div class="booking-summary-recurring">
                <div class="booking-summary-title" style="margin-top:1rem">
                    Recurring Plan
                    <span class="recurring-badge">Starts Later</span>
                </div>
                <div class="booking-summary-item">
                    <span class="booking-summary-name">${recurringPlan.name}</span>
                    <span class="booking-summary-price recurring-price-dim">${isCustom ? 'Custom' : '$' + parseFloat(recurringPlan.price).toFixed(2) + '/visit'}</span>
                </div>
                <div class="booking-summary-recurring-note">Not included in today's total. After your first clean, we'll reach out to set up your recurring schedule.</div>
            </div>`;
    }

    $('bookingSummary').innerHTML = html;

    // Set min date to tomorrow and block Sundays
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    // If tomorrow is Sunday, push to Monday
    if (tomorrow.getDay() === 0) tomorrow.setDate(tomorrow.getDate() + 1);
    const minDate = tomorrow.toISOString().split('T')[0];
    $('slot1Date').min = minDate;
    $('slot2Date').min = minDate;

    // Disable Sundays in date pickers
    const blockSundays = (e) => {
        const date = new Date(e.target.value + 'T12:00:00');
        if (date.getDay() === 0) {
            e.target.value = '';
            e.target.setCustomValidity('We are closed on Sundays');
            e.target.reportValidity();
            setTimeout(() => e.target.setCustomValidity(''), 2000);
        }
    };
    $('slot1Date').addEventListener('change', blockSundays);
    $('slot2Date').addEventListener('change', blockSundays);
}

function toggleFirstAvailable() {
    const checked = $('firstAvailable').checked;
    const slot1Row = $('slot1Date').closest('.slot-row');
    const slot2Group = document.getElementById('slot2Group');

    if (checked) {
        slot1Row.style.display = 'none';
        slot2Group.style.display = 'none';
        // Set values so validation passes
        $('slot1Date').value = 'first-available';
        $('slot1Time').value = 'Any Time';
        $('slot2Date').value = 'first-available';
        $('slot2Time').value = 'Any Time';
    } else {
        slot1Row.style.display = '';
        slot2Group.style.display = '';
        $('slot1Date').value = '';
        $('slot1Time').value = '';
        $('slot2Date').value = '';
        $('slot2Time').value = '';
    }
    checkBookingReady();
}

function checkBookingReady() {
    const name = $('contactName').value.trim();
    const phone = $('contactPhone').value.trim();
    const email = $('contactEmail').value.trim();
    const firstAvail = $('firstAvailable').checked;

    let slotsReady = firstAvail;
    if (!firstAvail) {
        const slot1Date = $('slot1Date').value;
        const slot1Time = $('slot1Time').value;
        const slot2Date = $('slot2Date').value;
        const slot2Time = $('slot2Time').value;
        slotsReady = slot1Date && slot1Time && slot2Date && slot2Time;
    }

    const ready = name && phone && email && slotsReady;
    $('submitBookingBtn').disabled = !ready;
}

async function submitBooking() {
    const todayServices = state.selectedServices.filter(s => !s.id.startsWith('maintenance-'));
    const recurringPlan = state.selectedServices.find(s => s.id.startsWith('maintenance-'));
    const totalDueToday = todayServices.reduce((sum, s) => sum + (s.price === 'Custom' ? 0 : parseFloat(s.price)), 0);

    const bookingData = {
        name: $('contactName').value.trim(),
        phone: $('contactPhone').value.trim(),
        email: $('contactEmail').value.trim(),
        address: state.address,
        property: {
            beds_api: state.apiProperty.beds,
            baths_api: state.apiProperty.baths,
            sqft_api: state.apiProperty.sqft,
            beds_entered: state.beds,
            baths_entered: state.baths,
            sqft_entered: state.sqft,
            lookup_source: state.apiProperty.source
        },
        services: {
            today: todayServices.map(s => ({ name: s.name, price: s.price === 'Custom' ? 'Custom' : parseFloat(s.price) })),
            recurring: recurringPlan ? { name: recurringPlan.name, price: recurringPlan.price === 'Custom' ? 'Custom' : parseFloat(recurringPlan.price) } : null,
            total_due_today: totalDueToday
        },
        preferred_slots: {
            first_available: $('firstAvailable').checked,
            slot1: { date: $('slot1Date').value, time: $('slot1Time').value },
            slot2: { date: $('slot2Date').value, time: $('slot2Time').value }
        },
        source: state.selectedServices.some(s => s.id === 'customQuote') ? 'custom-quote' : 'instant-quote',
        custom_notes: $('customNotes') ? $('customNotes').value.trim() : '',
        submitted_at: new Date().toISOString(),
        attribution: state.attribution,
        // Bot protection fields
        _hp: $('hpField').value,
        _ts: state.step4Timestamp ? (Date.now() - state.step4Timestamp) : 0
    };

    // Show loading state
    const btn = $('submitBookingBtn');
    const originalHTML = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `<span class="btn-spinner"></span> Submitting...`;

    try {
        const res = await fetch('/api/book', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(bookingData)
        });
        const result = await res.json();
        console.log('Booking response:', result);
    } catch (err) {
        console.warn('Booking submission error:', err);
        // Continue to confirmation anyway — graceful degradation
    }

    // Fire Meta Pixel Lead event
    if (typeof fbq === 'function') {
        fbq('track', 'Lead', {
            content_name: todayServices.map(s => s.name).join(', '),
            value: totalDueToday,
            currency: 'USD'
        });
    }

    // Fire Google Analytics 4 lead/conversion event
    if (typeof gtag === 'function') {
        gtag('event', 'generate_lead', {
            currency: 'USD',
            value: totalDueToday
        });
        gtag('event', 'conversion', {
            send_to: 'AW-11119987979/-vkaCJLQxY0cEIuatrYp',
            value: totalDueToday,
            currency: 'USD'
        });
    }

    // Show confirmation
    const isFirstAvailable = $('firstAvailable').checked;
    const formatDate = (d) => d === 'first-available' ? 'First Available' : new Date(d + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

    const slotsHTML = isFirstAvailable
        ? 'First available date & time'
        : `1. ${formatDate(bookingData.preferred_slots.slot1.date)} — ${bookingData.preferred_slots.slot1.time}<br>
        2. ${formatDate(bookingData.preferred_slots.slot2.date)} — ${bookingData.preferred_slots.slot2.time}`;

    $('confirmationDetails').innerHTML = `
        <strong>${bookingData.name}</strong><br>
        ${bookingData.phone}<br>${bookingData.email}<br><br>
        <strong>Preferred times:</strong><br>
        ${slotsHTML}<br><br>
        <strong>Services:</strong><br>
        ${bookingData.services.today.map(s => s.name).join('<br>')}
        ${bookingData.services.recurring ? '<br><em>' + bookingData.services.recurring.name + ' (starts later)</em>' : ''}
    `;

    // Hide form, show confirmation
    document.querySelectorAll('#step4 .form-group, #step4 .booking-summary, #step4 .section-sub, #step4 .section-title, #step4 .back-btn, #submitBookingBtn').forEach(el => el.style.display = 'none');
    $('bookingConfirmation').style.display = 'block';
}

// ==================== EVENT LISTENERS ====================
document.addEventListener('DOMContentLoaded', () => {

    // Step 1 → Step 2
    $('getQuoteBtn').addEventListener('click', () => {
        if (!state.addressConfirmed || !state.address) {
            $('addressInput').focus();
            return;
        }
        goToStep(2);
        performPropertyLookup();
    });

    // Auto-focus address input for ad traffic
    setTimeout(() => $('addressInput').focus(), 500);

    // Step 2 → Step 1
    $('backToStep1').addEventListener('click', () => goToStep(1));

    // Step 3 → Step 2
    $('backToStep2').addEventListener('click', () => goToStep(2));

    // Step 3 → Step 4
    $('continueToBookBtn').addEventListener('click', () => {
        renderBookingSummary();
        goToStep(4);
        state.step4Timestamp = Date.now();
        // Show/hide custom notes based on whether custom quote is selected
        const isCustom = state.selectedServices.some(s => s.id === 'customQuote');
        $('customQuoteNotes').style.display = isCustom ? 'block' : 'none';
        // Pre-check 'First Available' by default to reduce friction
        if (!$('firstAvailable').checked) {
            $('firstAvailable').checked = true;
            toggleFirstAvailable();
        }
    });

    // Step 4 → Step 3
    $('backToStep3').addEventListener('click', () => goToStep(3));

    // Booking form validation
    ['slot1Date', 'slot1Time', 'slot2Date', 'slot2Time', 'contactName', 'contactPhone', 'contactEmail'].forEach(id => {
        $(id).addEventListener('input', checkBookingReady);
        $(id).addEventListener('change', checkBookingReady);
    });

    // Submit booking
    $('submitBookingBtn').addEventListener('click', submitBooking);

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

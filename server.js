/* ============================================================
   YassClean — Backend Server
   Serves static files & proxies property lookups via Perplexity
   ============================================================ */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.text({ type: 'text/plain' }));
app.use(express.static(path.join(__dirname)));

// Serve index.html for /offer (promo landing page)
app.get('/offer', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Serve index.html for /embed (iframe-embeddable version)
app.get('/embed', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// ==================== ADDRESS CACHE ====================
const addressCache = new Map();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours
const CACHE_MAX = 500;

function normalizeAddress(addr) {
    return addr.trim().toLowerCase().replace(/\s+/g, ' ');
}

function getCached(address) {
    const key = normalizeAddress(address);
    const entry = addressCache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.ts > CACHE_TTL) {
        addressCache.delete(key);
        return null;
    }
    return entry.data;
}

function setCache(address, data) {
    if (addressCache.size >= CACHE_MAX) {
        const oldest = addressCache.keys().next().value;
        addressCache.delete(oldest);
    }
    addressCache.set(normalizeAddress(address), { data, ts: Date.now() });
}

// ==================== PROPERTY LOOKUP ENDPOINT ====================
app.post('/api/lookup', async (req, res) => {
    const { address } = req.body;

    if (!address || address.trim().length < 5) {
        return res.status(400).json({ error: 'Address is required' });
    }

    // Check cache first
    const cached = getCached(address);
    if (cached) {
        console.log(`\n  Looking up: ${address}`);
        console.log('  ✓ Cache hit');
        return res.json(cached);
    }

    try {
        const result = await lookupProperty(
            address,
            process.env.PERPLEXITY_API_KEY,
            process.env.RENTCAST_API_KEY
        );
        setCache(address, result);
        res.json(result);
    } catch (err) {
        console.error('Lookup error:', err.message);
        res.json({
            beds: null, baths: null, sqft: null,
            source: null, confidence: 'none',
            message: 'Could not verify property details.'
        });
    }
});

// ==================== ALERT HELPER ====================
async function sendAlert(alertType, severity, message, details = {}) {
    const alertUrl = process.env.ALERT_WEBHOOK_URL;
    if (!alertUrl) return;
    try {
        await fetch(alertUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                alert_type: alertType, severity, message, details,
                timestamp: new Date().toISOString()
            })
        });
    } catch (err) {
        console.error('Alert delivery failed:', err.message);
    }
}

// ==================== EVENT LOGGING HELPER ====================
async function logEvent(eventData) {
    const eventUrl = process.env.EVENT_WEBHOOK_URL;
    if (!eventUrl) return;
    try {
        await fetch(eventUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(eventData)
        });
    } catch (err) {
        console.error('Event logging failed:', err.message);
    }
}

// ==================== TRACKING ENDPOINT ====================
app.post('/api/track', async (req, res) => {
    // Handle sendBeacon's text/plain content-type — body may arrive as raw string
    let body = req.body;
    if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch (e) {
            return res.status(400).json({ error: 'Invalid JSON body' });
        }
    }

    const events = Array.isArray(body) ? body : [body];
    if (!events.length || !events[0]?.event_type) {
        return res.status(400).json({ error: 'event_type is required' });
    }

    const clientIP = req.headers['x-forwarded-for'] || req.ip || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';

    for (const event of events) {
        event.ip = clientIP;
        event.user_agent = userAgent;
        event.server_timestamp = new Date().toISOString();
        logEvent(event);
    }

    console.log(`  📊 Tracked ${events.length} event(s): ${events.map(e => e.event_type).join(', ')}`);
    res.json({ success: true, logged: events.length });
});

// ==================== BOOKING ENDPOINT ====================
app.post('/api/book', async (req, res) => {
    const data = req.body;

    if (!data || !data.phone) {
        return res.status(400).json({ error: 'Booking data with phone is required' });
    }

    // ==================== BOT PROTECTION ====================
    if (data._hp) {
        console.warn('  Bot detected (honeypot):', data.phone);
        return res.json({ success: true, message: 'Booking received' });
    }
    if (data._ts && data._ts < 3000) {
        console.warn('  Bot detected (too fast):', data._ts, 'ms');
        return res.json({ success: true, message: 'Booking received' });
    }
    const clientIP = req.headers['x-forwarded-for'] || req.ip || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';
    if (!global._bookingRateMap) global._bookingRateMap = new Map();
    const rateData = global._bookingRateMap.get(clientIP) || { count: 0, resetAt: Date.now() + 3600000 };
    if (Date.now() > rateData.resetAt) { rateData.count = 0; rateData.resetAt = Date.now() + 3600000; }
    rateData.count++;
    global._bookingRateMap.set(clientIP, rateData);
    if (rateData.count > 5) {
        console.warn('  Rate limited:', clientIP);
        return res.status(429).json({ error: 'Too many requests' });
    }
    delete data._hp;
    delete data._ts;

    console.log(`\n  \ud83d\udccb New booking from: ${data.name} (${data.phone})`);
    console.log('  Services:', data.services?.today?.map(s => s.name).join(', '));
    console.log('  Total due today: $' + data.services?.total_due_today);

    // Flatten nested data into simple strings for GHL field mapping
    const todayList = (data.services?.today || []);
    data.services_list = todayList.map(s => s.name).join(', ');
    data.services_with_prices = todayList.map(s => `${s.name} ($${s.price})`).join(', ');
    data.recurring_plan = data.services?.recurring ? `${data.services.recurring.name} — $${data.services.recurring.price}/visit` : 'None';
    data.quote_total = data.services?.total_due_today || 0;
    data.first_available = data.preferred_slots?.first_available || false;
    data.slot1_formatted = data.first_available ? 'First Available' : (data.preferred_slots?.slot1 ? `${data.preferred_slots.slot1.date} at ${data.preferred_slots.slot1.time}` : '');
    data.slot2_formatted = data.first_available ? 'First Available' : (data.preferred_slots?.slot2 ? `${data.preferred_slots.slot2.date} at ${data.preferred_slots.slot2.time}` : '');
    data.bedrooms = data.property?.beds_entered || null;
    data.bathrooms = data.property?.baths_entered || null;
    data.sqft = data.property?.sqft_entered || null;

    // Flatten attribution for GHL
    data.utm_source = data.attribution?.utm_source || '';
    data.utm_medium = data.attribution?.utm_medium || '';
    data.utm_campaign = data.attribution?.utm_campaign || '';
    data.utm_content = data.attribution?.utm_content || '';
    data.fbclid = data.attribution?.fbclid || '';
    data.gclid = data.attribution?.gclid || '';
    data.landing_page = data.attribution?.landing_page || '';
    data.referrer = data.attribution?.referrer || '';

    // Enrich with server-side metadata
    data._meta = { ip: clientIP, user_agent: userAgent, received_at: new Date().toISOString() };

    const webhookUrl = process.env.GHL_WEBHOOK_URL;

    if (!webhookUrl || webhookUrl === 'your-webhook-url-here') {
        console.error('CRITICAL: GHL_WEBHOOK_URL not configured — booking LOST');
        console.log('Booking data:', JSON.stringify(data, null, 2));
        await sendAlert('Webhook Not Configured', '🔴 CRITICAL',
            `GHL_WEBHOOK_URL is missing. Booking from *${data.name}* (${data.phone}) was NOT forwarded.`,
            { customer: data.name, phone: data.phone, email: data.email, address: data.address, services: data.services_list, total: data.quote_total, ip: clientIP }
        );
        return res.json({ success: true, message: 'Booking received (webhook not configured)' });
    }

    try {
        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        if (!response.ok) {
            const errText = await response.text();
            console.error('  GHL webhook error:', response.status, errText);
            await sendAlert('GHL Webhook Failed', '🔴 CRITICAL',
                `GHL webhook returned HTTP ${response.status}. Booking from *${data.name}* (${data.phone}) may not have been received.`,
                { customer: data.name, phone: data.phone, http_status: response.status, error_body: errText?.substring(0, 500), ip: clientIP }
            );
            return res.json({ success: true, message: 'Booking received' });
        }

        console.log('  GHL webhook: OK');
        await sendAlert('New Booking Received', '✅ INFO',
            `Booking from *${data.name}* (${data.phone}) successfully forwarded to GHL.`,
            { customer: data.name, phone: data.phone, email: data.email, address: data.address, services: data.services_list, recurring: data.recurring_plan, total: `$${data.quote_total}`, source: data.booking_source || 'instant-quote', utm_source: data.utm_source || 'direct', ip: clientIP }
        );
    } catch (err) {
        console.error('  Webhook error:', err.message);
        await sendAlert('Webhook Network Error', '🔴 CRITICAL',
            `Could not reach GHL webhook: ${err.message}. Booking from *${data.name}* (${data.phone}) was NOT delivered.`,
            { customer: data.name, phone: data.phone, email: data.email, error: err.message, ip: clientIP }
        );
    }

    res.json({ success: true, message: 'Booking received' });
});

// ==================== RENTCAST API (fallback — only called when fields are missing) ====================
async function lookupViaRentcast(address, apiKey) {
    const url = `https://api.rentcast.io/v1/properties?address=${encodeURIComponent(address)}&limit=1`;
    const response = await fetch(url, {
        headers: { 'X-Api-Key': apiKey, 'Accept': 'application/json' }
    });

    if (response.status === 404 || response.status === 422) return null;

    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Rentcast API ${response.status}: ${errText}`);
    }

    const data = await response.json();
    const prop = Array.isArray(data) ? data[0] : data;
    if (!prop) return null;

    const beds = sanitizeInt(prop.bedrooms, 1, 10);
    const baths = sanitizeBaths(prop.bathrooms, 1, 10);
    const sqft = sanitizeInt(prop.squareFootage, 100, 50000);

    // Return whatever Rentcast found — even partial data is valuable
    if (!beds && !baths && !sqft) return null;

    return { beds, baths, sqft, source: 'rentcast.io' };
}

// ==================== PERPLEXITY API (primary — cheap, AI-powered) ====================
async function lookupViaPerplexity(address, apiKey) {
    if (!apiKey || apiKey === 'your-key-here') return null;

    const response = await fetch('https://api.perplexity.ai/chat/completions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model: 'sonar',
            messages: [
                {
                    role: 'system',
                    content: 'You look up residential property details. Search real estate websites to find accurate data. Always end your response with a JSON object on its own line.'
                },
                {
                    role: 'user',
                    content: `Find the property listing for: ${address}\n\nSearch Zillow, Realtor.com, Redfin, Trulia, or county tax/assessor records to find how many bedrooms, bathrooms, and the square footage.\n\nAfter searching, respond with ONLY this JSON (use null for any value you cannot confirm, NEVER use 0):\n{"beds":NUMBER_OR_NULL,"baths":NUMBER_OR_NULL,"sqft":NUMBER_OR_NULL}`
                }
            ],
            max_tokens: 200
        })
    });

    if (!response.ok) throw new Error(`Perplexity ${response.status}`);

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    console.log('  Perplexity raw:', content);

    // Try JSON extraction first
    let beds = null, baths = null, sqft = null, source = 'zillow.com';
    const jsonMatch = content.match(/\{[\s\S]*?\}/);
    if (jsonMatch) {
        try {
            const parsed = JSON.parse(jsonMatch[0]);
            beds = sanitizeInt(parsed.beds, 1, 10);
            baths = sanitizeBaths(parsed.baths, 1, 10);
            sqft = sanitizeInt(parsed.sqft, 100, 50000);
            if (typeof parsed.source === 'string') source = parsed.source;
        } catch (e) { /* JSON parse failed, fall through to text parsing */ }
    }

    // Fallback: extract numbers from natural language text
    if (!beds) {
        const bedMatch = content.match(/(\d+)\s*(?:bed|br\b|bedroom)/i);
        if (bedMatch) beds = sanitizeInt(bedMatch[1], 1, 10);
    }
    if (!baths) {
        const bathMatch = content.match(/(\d+(?:\.\d+)?)\s*(?:bath|ba\b|bathroom)/i);
        if (bathMatch) baths = sanitizeBaths(parseFloat(bathMatch[1]), 1, 10);
    }
    if (!sqft) {
        const sqftMatch = content.match(/([\d,]+)\s*(?:sq|sqft|square)/i);
        if (sqftMatch) sqft = sanitizeInt(sqftMatch[1].replace(/,/g, ''), 100, 50000);
    }

    return { beds, baths, sqft, source, confidence: (beds && baths) ? 'medium' : 'low' };
}

// ==================== ORCHESTRATION (Perplexity first, Rentcast gap-filler) ====================
async function lookupProperty(address, perplexityKey, rentcastKey) {
    let merged = { beds: null, baths: null, sqft: null, source: null, confidence: 'none' };

    // 1. Try Perplexity first (cheap — ~$0.01/call)
    const MAX_RETRIES = 2;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        if (merged.beds && merged.baths && merged.sqft) break;

        try {
            console.log(`  Perplexity attempt ${attempt}/${MAX_RETRIES}...`);
            const pp = await lookupViaPerplexity(address, perplexityKey);
            if (pp) {
                console.log(`  Perplexity found (attempt ${attempt}):`, JSON.stringify(pp));
                if (!merged.beds && pp.beds) merged.beds = pp.beds;
                if (!merged.baths && pp.baths) merged.baths = pp.baths;
                if (!merged.sqft && pp.sqft) merged.sqft = pp.sqft;
                if (!merged.source) merged.source = pp.source;
                if (merged.beds && merged.baths) break;
            }
        } catch (err) {
            console.warn(`  Perplexity error (attempt ${attempt}):`, err.message);
        }

        if (attempt < MAX_RETRIES && (!merged.beds || !merged.baths)) {
            await new Promise(r => setTimeout(r, 1000));
        }
    }

    // 2. Only call Rentcast if fields are still missing (expensive — $0.20/call)
    const needsMore = !merged.beds || !merged.baths || !merged.sqft;
    if (needsMore && rentcastKey && rentcastKey !== 'your-key-here') {
        try {
            console.log('  Perplexity incomplete — trying Rentcast for missing fields...');
            const rc = await lookupViaRentcast(address, rentcastKey);
            if (rc) {
                console.log('  Rentcast found:', JSON.stringify(rc));
                if (!merged.beds && rc.beds) merged.beds = rc.beds;
                if (!merged.baths && rc.baths) merged.baths = rc.baths;
                if (!merged.sqft && rc.sqft) merged.sqft = rc.sqft;
                if (merged.source) {
                    merged.source = merged.source + ' + rentcast.io';
                } else {
                    merged.source = 'rentcast.io';
                }
            } else {
                console.log('  Rentcast: no results');
            }
        } catch (err) {
            console.warn('  Rentcast error:', err.message);
        }
    } else if (!needsMore) {
        console.log('  ✓ All fields found — skipping Rentcast');
    }

    // Set confidence based on how much we found
    const found = [merged.beds, merged.baths, merged.sqft].filter(Boolean).length;
    merged.confidence = found === 3 ? 'high' : found >= 1 ? 'medium' : 'none';

    return merged;
}

// Helper: pick only non-null values from an object
function pickNonNull(obj) {
    const out = {};
    for (const [k, v] of Object.entries(obj)) {
        if (v !== null && v !== undefined) out[k] = v;
    }
    return out;
}

function sanitizeInt(val, min, max) {
    if (val === null || val === undefined) return null;
    const n = parseInt(val, 10);
    if (isNaN(n) || n < min || n > max) return null;
    return n;
}

// Half baths round UP (2.5 → 3, 1.5 → 2)
function sanitizeBaths(val, min, max) {
    if (val === null || val === undefined) return null;
    const f = parseFloat(val);
    if (isNaN(f)) return null;
    const n = Math.ceil(f);
    if (n < min || n > max) return null;
    return n;
}

// ==================== START SERVER ====================
app.listen(PORT, () => {
    console.log(`\n  🧹 YassClean server running at http://localhost:${PORT}\n`);
    const pp = process.env.PERPLEXITY_API_KEY;
    const rc = process.env.RENTCAST_API_KEY;
    if (pp && pp !== 'your-key-here') {
        console.log('  ✓ Perplexity API (primary — cheap)');
    } else {
        console.log('  ⚠ Set PERPLEXITY_API_KEY in .env for property lookups');
    }
    if (rc && rc !== 'your-key-here') {
        console.log('  ✓ Rentcast API (fallback — fills missing fields)');
    } else {
        console.log('  ⚠ Set RENTCAST_API_KEY in .env for fallback lookups');
    }
    console.log('');
});

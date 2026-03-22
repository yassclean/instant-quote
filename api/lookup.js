// Vercel serverless function for property lookup
// Priority: Cache → Perplexity (cheap) → Rentcast (expensive, gap-filler only)

// ==================== ADDRESS CACHE ====================
// Persists across warm invocations on Vercel; resets on cold start
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
    // Evict oldest entries if at capacity
    if (addressCache.size >= CACHE_MAX) {
        const oldest = addressCache.keys().next().value;
        addressCache.delete(oldest);
    }
    addressCache.set(normalizeAddress(address), { data, ts: Date.now() });
}

module.exports = async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

    const { address } = req.body || {};
    if (!address) return res.status(400).json({ error: 'Address required' });

    console.log(`\n  Looking up: ${address}`);

    // Check cache first
    const cached = getCached(address);
    if (cached) {
        console.log('  ✓ Cache hit');
        return res.json(cached);
    }

    const rentcastKey = process.env.RENTCAST_API_KEY;
    const perplexityKey = process.env.PERPLEXITY_API_KEY;

    try {
        const result = await lookupProperty(address, perplexityKey, rentcastKey);
        setCache(address, result);
        res.json(result);
    } catch (err) {
        console.error('Lookup error:', err);
        res.status(500).json({ error: 'Lookup failed' });
    }
}

// ==================== RENTCAST API (fallback — only called when fields are missing) ====================
async function lookupViaRentcast(address, apiKey) {
    if (!apiKey || apiKey === 'your-key-here') return null;

    const response = await fetch(
        `https://api.rentcast.io/v1/properties?address=${encodeURIComponent(address)}&limit=1`,
        { headers: { 'X-Api-Key': apiKey, 'Accept': 'application/json' } }
    );

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

    let beds = null, baths = null, sqft = null, source = 'zillow.com';
    const jsonMatch = content.match(/\{[\s\S]*?\}/);
    if (jsonMatch) {
        try {
            const parsed = JSON.parse(jsonMatch[0]);
            beds = sanitizeInt(parsed.beds, 1, 10);
            baths = sanitizeBaths(parsed.baths, 1, 10);
            sqft = sanitizeInt(parsed.sqft, 100, 50000);
            if (typeof parsed.source === 'string') source = parsed.source;
        } catch (e) { /* fall through to text parsing */ }
    }

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

    const found = [merged.beds, merged.baths, merged.sqft].filter(Boolean).length;
    merged.confidence = found === 3 ? 'high' : found >= 1 ? 'medium' : 'none';

    return merged;
}

function pickNonNull(obj) {
    const out = {};
    for (const [k, v] of Object.entries(obj)) {
        if (v !== null && v !== undefined) out[k] = v;
    }
    return out;
}

function sanitizeInt(val, min, max) {
    const n = parseInt(val, 10);
    if (isNaN(n) || n < min || n > max) return null;
    return n;
}

// Half baths round UP (2.5 → 3, 1.5 → 2)
function sanitizeBaths(val, min, max) {
    const f = parseFloat(val);
    if (isNaN(f)) return null;
    const n = Math.ceil(f);
    if (n < min || n > max) return null;
    return n;
}

// Vercel serverless function for property lookup
// Merges Rentcast (sqft) + Perplexity (beds/baths)

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

    const rentcastKey = process.env.RENTCAST_API_KEY;
    const perplexityKey = process.env.PERPLEXITY_API_KEY;

    try {
        const result = await lookupProperty(address, perplexityKey, rentcastKey);
        res.json(result);
    } catch (err) {
        console.error('Lookup error:', err);
        res.status(500).json({ error: 'Lookup failed' });
    }
}

// ==================== RENTCAST API (primary) ====================
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
    const baths = sanitizeInt(prop.bathrooms, 1, 10);
    const sqft = sanitizeInt(prop.squareFootage, 100, 50000);

    if (!beds && !baths && !sqft) return null;

    return { beds, baths, sqft, source: 'rentcast.io' };
}

// ==================== PERPLEXITY API (fallback) ====================
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
                    content: 'You are a property data assistant. Return ONLY a JSON object with numeric values, nothing else.'
                },
                {
                    role: 'user',
                    content: `How many bedrooms, bathrooms, and square feet is the home at ${address}? Search Zillow, Realtor.com, Redfin, county tax records, or any real estate site. Reply ONLY with: {"beds":NUMBER,"baths":NUMBER,"sqft":NUMBER}`
                }
            ],
            max_tokens: 150
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
            baths = sanitizeInt(parsed.baths, 1, 10);
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
        if (bathMatch) baths = sanitizeInt(Math.round(parseFloat(bathMatch[1])), 1, 10);
    }
    if (!sqft) {
        const sqftMatch = content.match(/([\d,]+)\s*(?:sq|sqft|square)/i);
        if (sqftMatch) sqft = sanitizeInt(sqftMatch[1].replace(/,/g, ''), 100, 50000);
    }

    return { beds, baths, sqft, source, confidence: (beds && baths) ? 'medium' : 'low' };
}

// ==================== ORCHESTRATION (merge strategy) ====================
async function lookupProperty(address, perplexityKey, rentcastKey) {
    let merged = { beds: null, baths: null, sqft: null, source: null, confidence: 'none' };

    if (rentcastKey && rentcastKey !== 'your-key-here') {
        try {
            const rc = await lookupViaRentcast(address, rentcastKey);
            if (rc) {
                merged = { ...merged, ...pickNonNull(rc), source: 'rentcast.io' };
                console.log('  Rentcast found:', JSON.stringify(rc));
            } else {
                console.log('  Rentcast: no results');
            }
        } catch (err) {
            console.warn('  Rentcast error:', err.message);
        }
    }

    // 2. If any fields are still missing, try Perplexity (with retries for reliability)
    const MAX_RETRIES = 3;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        if (merged.beds && merged.baths && merged.sqft) break; // All found, stop

        try {
            console.log(`  Perplexity attempt ${attempt}/${MAX_RETRIES}...`);
            const pp = await lookupViaPerplexity(address, perplexityKey);
            if (pp) {
                console.log(`  Perplexity found (attempt ${attempt}):`, JSON.stringify(pp));
                if (!merged.beds && pp.beds) merged.beds = pp.beds;
                if (!merged.baths && pp.baths) merged.baths = pp.baths;
                if (!merged.sqft && pp.sqft) merged.sqft = pp.sqft;
                if (merged.source && merged.source !== pp.source) {
                    merged.source = merged.source + ' + ' + (pp.source || 'web search');
                } else if (!merged.source) {
                    merged.source = pp.source;
                }
                if (merged.beds && merged.baths) break;
            }
        } catch (err) {
            console.warn(`  Perplexity error (attempt ${attempt}):`, err.message);
        }

        // Wait 1 second before retrying
        if (attempt < MAX_RETRIES && (!merged.beds || !merged.baths)) {
            await new Promise(r => setTimeout(r, 1000));
        }
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

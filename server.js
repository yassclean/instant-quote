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
app.use(express.static(path.join(__dirname)));

// ==================== PROPERTY LOOKUP ENDPOINT ====================
app.post('/api/lookup', async (req, res) => {
    const { address } = req.body;

    if (!address || address.trim().length < 5) {
        return res.status(400).json({ error: 'Address is required' });
    }

    try {
        const result = await lookupProperty(
            address,
            process.env.PERPLEXITY_API_KEY,
            process.env.RENTCAST_API_KEY
        );
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

// ==================== RENTCAST API (primary) ====================
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
    const baths = sanitizeInt(prop.bathrooms, 1, 10);
    const sqft = sanitizeInt(prop.squareFootage, 100, 50000);

    // Return whatever Rentcast found — even partial data is valuable
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

    // Try JSON extraction first
    let beds = null, baths = null, sqft = null, source = 'zillow.com';
    const jsonMatch = content.match(/\{[\s\S]*?\}/);
    if (jsonMatch) {
        try {
            const parsed = JSON.parse(jsonMatch[0]);
            beds = sanitizeInt(parsed.beds, 1, 10);
            baths = sanitizeInt(parsed.baths, 1, 10);
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

    // 1. Try Rentcast first (structured property records)
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

    // 2. If any fields are still missing, try Perplexity to fill gaps
    if (!merged.beds || !merged.baths || !merged.sqft) {
        try {
            const pp = await lookupViaPerplexity(address, perplexityKey);
            if (pp) {
                console.log('  Perplexity found:', JSON.stringify(pp));
                // Only fill in what's still missing
                if (!merged.beds && pp.beds) merged.beds = pp.beds;
                if (!merged.baths && pp.baths) merged.baths = pp.baths;
                if (!merged.sqft && pp.sqft) merged.sqft = pp.sqft;
                // Update source to show both if we used both
                if (merged.source && merged.source !== pp.source) {
                    merged.source = merged.source + ' + ' + (pp.source || 'web search');
                } else if (!merged.source) {
                    merged.source = pp.source;
                }
            }
        } catch (err) {
            console.warn('  Perplexity error:', err.message);
        }
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

// ==================== START SERVER ====================
app.listen(PORT, () => {
    console.log(`\n  🧹 YassClean server running at http://localhost:${PORT}\n`);
    const rc = process.env.RENTCAST_API_KEY;
    const pp = process.env.PERPLEXITY_API_KEY;
    if (rc && rc !== 'your-key-here') {
        console.log('  ✓ Rentcast API (primary)');
    } else {
        console.log('  ⚠ Set RENTCAST_API_KEY in .env for best results');
    }
    if (pp && pp !== 'your-key-here') {
        console.log('  ✓ Perplexity API (fallback)');
    } else {
        console.log('  ⚠ Set PERPLEXITY_API_KEY in .env for fallback lookups');
    }
    console.log('');
});

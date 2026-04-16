// Vercel serverless function — lightweight event tracking endpoint
// Endpoint: POST /api/track
// Receives analytics events from frontend and other API endpoints,
// enriches with server-side metadata, forwards to n8n Event Logger

module.exports = async function handler(req, res) {
    // CORS headers (needed for frontend fetch calls)
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

    // Handle sendBeacon's text/plain content-type — body arrives as a raw string
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

    // Enrich each event with server-side metadata
    const clientIP = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';

    const enrichedEvents = events.map(event => ({
        ...event,
        ip: clientIP,
        user_agent: userAgent,
        server_timestamp: new Date().toISOString()
    }));

    // Forward to n8n Event Logger webhook (fire-and-forget)
    const eventUrl = process.env.EVENT_WEBHOOK_URL;
    if (eventUrl) {
        // Send each event individually for clean n8n execution history
        for (const event of enrichedEvents) {
            try {
                await fetch(eventUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(event)
                });
            } catch (err) {
                console.error('Event logging failed:', err.message);
            }
        }
    }

    return res.json({ success: true, logged: enrichedEvents.length });
};

// Vercel serverless function — receives booking data, forwards to GHL webhook
// Endpoint: POST /api/book

module.exports = async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

    const data = req.body;
    if (!data || !data.phone) {
        return res.status(400).json({ error: 'Booking data with phone is required' });
    }

    // ==================== BOT PROTECTION ====================
    // 1. Honeypot — real users never fill this hidden field
    if (data._hp) {
        console.warn('  Bot detected (honeypot filled):', data.phone);
        // Return fake success so bots think it worked
        return res.json({ success: true, message: 'Booking received' });
    }

    // 2. Timing gate — real users take ≥3 seconds to fill Step 4
    if (data._ts && data._ts < 3000) {
        console.warn('  Bot detected (submitted too fast):', data._ts, 'ms');
        return res.json({ success: true, message: 'Booking received' });
    }

    // 3. Rate limiting per IP (max 5 bookings/hour)
    const clientIP = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || 'unknown';
    const now = Date.now();
    if (!global._bookingRateMap) global._bookingRateMap = new Map();
    const rateData = global._bookingRateMap.get(clientIP) || { count: 0, resetAt: now + 3600000 };
    if (now > rateData.resetAt) { rateData.count = 0; rateData.resetAt = now + 3600000; }
    rateData.count++;
    global._bookingRateMap.set(clientIP, rateData);
    if (rateData.count > 5) {
        console.warn('  Rate limited:', clientIP);
        return res.status(429).json({ error: 'Too many requests' });
    }

    // Strip bot protection fields before forwarding
    delete data._hp;
    delete data._ts;

    // Flatten nested data into simple strings for GHL field mapping
    const todayList = (data.services?.today || []);
    data.services_list = todayList.map(s => s.name).join(', ');
    data.services_with_prices = todayList.map(s => `${s.name} ($${s.price})`).join(', ');
    data.recurring_plan = data.services?.recurring ? `${data.services.recurring.name} — $${data.services.recurring.price}/visit` : 'None';
    data.quote_total = data.services?.total_due_today || 0;
    data.first_available = data.preferred_slots?.first_available || false;
    data.slot1_formatted = data.first_available ? '' : (data.preferred_slots?.slot1 ? `${data.preferred_slots.slot1.date} at ${data.preferred_slots.slot1.time}` : '');
    data.slot2_formatted = data.first_available ? '' : (data.preferred_slots?.slot2 ? `${data.preferred_slots.slot2.date} at ${data.preferred_slots.slot2.time}` : '');
    data.bedrooms = data.property?.beds_entered || null;
    data.bathrooms = data.property?.baths_entered || null;
    data.sqft = data.property?.sqft_entered || null;
    data.bedrooms_api = data.property?.beds_api || null;
    data.bathrooms_api = data.property?.baths_api || null;
    data.sqft_api = data.property?.sqft_api || null;
    data.lookup_source = data.property?.lookup_source || '';

    // Flatten attribution for GHL
    data.utm_source = data.attribution?.utm_source || '';
    data.utm_medium = data.attribution?.utm_medium || '';
    data.utm_campaign = data.attribution?.utm_campaign || '';
    data.utm_content = data.attribution?.utm_content || '';
    data.fbclid = data.attribution?.fbclid || '';
    data.landing_page = data.attribution?.landing_page || '';
    data.referrer = data.attribution?.referrer || '';

    // Custom quote notes (already top-level from frontend, ensure present)
    data.custom_notes = data.custom_notes || '';
    data.booking_source = data.source || 'instant-quote';

    // Build formatted quote summary for email notifications
    let summaryLines = [];
    summaryLines.push(`<b>Property:</b> ${data.address}`);
    summaryLines.push(`${data.bedrooms} bed / ${data.bathrooms} bath${data.sqft ? ' · ' + data.sqft + ' sqft' : ''}`);
    summaryLines.push('');
    summaryLines.push('<b>Services Today:</b>');
    todayList.forEach(s => {
        summaryLines.push(`  • ${s.name} — $${s.price}`);
    });
    if (data.services?.recurring) {
        summaryLines.push('');
        summaryLines.push(`<b>Recurring Plan:</b> ${data.services.recurring.name}`);
        summaryLines.push(`  $${data.services.recurring.price}/visit`);
    }
    summaryLines.push('');
    summaryLines.push(`<b>Total Due Today: $${data.quote_total}</b>`);
    summaryLines.push('');
    summaryLines.push('<b>Preferred Times:</b>');
    if (data.first_available) {
        summaryLines.push('  ⚡ First Available');
    } else {
        summaryLines.push(`  1. ${data.slot1_formatted}`);
        summaryLines.push(`  2. ${data.slot2_formatted}`);
    }
    if (data.custom_notes) {
        summaryLines.push('');
        summaryLines.push(`<b>Notes:</b> ${data.custom_notes}`);
    }
    // API vs User property comparison
    if (data.bedrooms_api && (data.bedrooms != data.bedrooms_api || data.bathrooms != data.bathrooms_api)) {
        summaryLines.push('');
        summaryLines.push(`⚠️ <b>Property Mismatch:</b> API found ${data.bedrooms_api}bd/${data.bathrooms_api}ba${data.sqft_api ? '/' + data.sqft_api + 'sqft' : ''}, user entered ${data.bedrooms}bd/${data.bathrooms}ba${data.sqft ? '/' + data.sqft + 'sqft' : ''}`);
    }
    data.quote_summary = summaryLines.join('<br>');

    const webhookUrl = process.env.GHL_WEBHOOK_URL || process.env.MAKECOM_WEBHOOK_URL;

    if (!webhookUrl || webhookUrl === 'your-webhook-url-here') {
        console.warn('GHL_WEBHOOK_URL not configured — logging booking data only');
        console.log('Booking data:', JSON.stringify(data, null, 2));
        return res.json({ success: true, message: 'Booking received (webhook not configured)' });
    }

    try {
        console.log(`\n  Forwarding booking to GHL for: ${data.name} (${data.phone})`);

        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        if (!response.ok) {
            const errText = await response.text();
            console.error('  GHL webhook error:', response.status, errText);
            // Still return success to the user — we don't want their experience to break
            // if the webhook has a temporary issue
            return res.json({ success: true, message: 'Booking received' });
        }

        console.log('  GHL webhook: OK');
        return res.json({ success: true, message: 'Booking received' });

    } catch (err) {
        console.error('  Webhook error:', err.message);
        // Graceful degradation — booking is still "received" from user's perspective
        return res.json({ success: true, message: 'Booking received' });
    }
};

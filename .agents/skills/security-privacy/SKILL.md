---
name: Security & Data Privacy
description: Security best practices for handling customer PII in service-business apps — covers input validation, API key protection, CORS hardening, XSS prevention, data minimization, and privacy compliance. Tailored for quote/booking flows that collect name, phone, email, and address.
---

# Security & Data Privacy Skill

## 1. PII Handling

### Data Classification
This app collects and processes the following PII:

| Field | Sensitivity | Storage | Exposure Risk |
| ----- | ----------- | ------- | ------------- |
| Full name | Medium | Webhook only | Low (no DB) |
| Phone number | High | Webhook only | Medium |
| Email address | High | Webhook only | Medium |
| Home address | High | Webhook + API calls | High (sent to 3rd parties) |
| Property details | Low | Webhook only | Low |

### Data Flow Security
```
User → [HTTPS] → Vercel CDN → [HTTPS] → Serverless Function
                                              ↓ [HTTPS]
                                         Rentcast API (address only)
                                         Perplexity API (address only)
                                         GHL Webhook (full payload)
```

### Rules
- **Never store PII in logs** beyond what's needed to debug (name + phone for identification is OK; full address in logs is acceptable for debugging)
- **Never return PII in error responses** — generic error messages only
- **Minimize data sent to third-party APIs** — Rentcast and Perplexity receive only the address, not contact info
- **The webhook receives everything** — ensure the GHL endpoint uses HTTPS

---

## 2. API Key Protection

### Current Keys
| Key | Risk if Leaked | Mitigation |
| --- | -------------- | ---------- |
| `RENTCAST_API_KEY` | Usage charges, rate limit abuse | Server-side only, env var |
| `PERPLEXITY_API_KEY` | AI API charges | Server-side only, env var |
| `MAKECOM_WEBHOOK_URL` | Spam bookings to CRM | Server-side only, env var |
| Google Maps API Key | Usage charges | Client-side (restricted by HTTP referrer in Google Console) |

### Protection Rules
- **Server-side API keys** must NEVER appear in client-side code (`app.js`, `index.html`)
- **Google Maps key** is inherently client-side — restrict it:
  - Google Cloud Console → API Key → Application Restrictions → HTTP referrers
  - Add: `quote.yassclean.com/*`, `localhost:*` (for dev)
- **`.env` in `.gitignore`** — verify this exists and includes `.env`
- **No hardcoded keys anywhere** — always use `process.env.KEY_NAME`
- **Sentinel values** (`'your-key-here'`) to safely handle unconfigured keys

### Vercel Environment Variables
- Set via Dashboard → Project → Settings → Environment Variables
- Different values for Preview vs. Production if needed
- Keys are encrypted at rest in Vercel

---

## 3. Input Validation

### Client-Side Validation (UX only, not security)
```javascript
// Progressive CTA enabling
const ready = name && phone && email && slotsReady;
$('submitBookingBtn').disabled = !ready;
```

### Server-Side Validation (Security)
```javascript
// Always validate on the server — client validation is easily bypassed
if (!data || !data.phone) {
    return res.status(400).json({ error: 'Phone is required' });
}

// Sanitize numeric inputs
function sanitizeInt(val, min, max) {
    const n = parseInt(val, 10);
    if (isNaN(n) || n < min || n > max) return null;
    return n;
}
```

### Validation Checklist
| Field | Client Check | Server Check |
| ----- | ------------ | ------------ |
| Address | Length > 10 chars | Length > 5, < 200 |
| Beds/Baths | Button selection (1-4) | `sanitizeInt(val, 1, 10)` |
| Sqft | Optional, numeric | `sanitizeInt(val, 100, 50000)` |
| Name | Non-empty | Non-empty, < 100 chars |
| Phone | Non-empty | Non-empty, strip non-digits, 7-15 digits |
| Email | Non-empty | Non-empty, regex or validator library |
| Dates | `min` attr set to tomorrow | Verify date is in future |

---

## 4. XSS Prevention

### Risks in This App
The app uses `innerHTML` extensively for dynamic content rendering. This is safe when:
- Data comes from **hardcoded constants** (pricing, extras, descriptions) ✅
- Data comes from **user input** that's been sanitized ⚠️

### High-Risk Patterns
```javascript
// ⚠ Address comes from user/Google — could be manipulated
$('addressConfirm').innerHTML = `... ${state.address} ...`;

// ⚠ Property summary includes user-entered address
summary.innerHTML = `... ${state.address} ...`;

// ⚠ Confirmation details include user-entered name, phone, email
$('confirmationDetails').innerHTML = `<strong>${bookingData.name}</strong>...`;
```

### Mitigation
```javascript
// Escape HTML entities before inserting user data via innerHTML
function escapeHtml(str) {
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
}

// Usage
$('addressConfirm').innerHTML = `... ${escapeHtml(state.address)} ...`;
$('confirmationDetails').innerHTML = `<strong>${escapeHtml(bookingData.name)}</strong>...`;
```

### Or use `textContent` where possible:
```javascript
// Safe — doesn't parse HTML
element.textContent = userInput;
```

---

## 5. CORS Security

### Current Configuration
```json
{ "key": "Access-Control-Allow-Origin", "value": "*" }
```
This allows **any origin** to call the API. This is acceptable when:
- The API has no authentication
- The API is public-facing (anyone can get a quote)
- There's no session or cookie-based auth

### When to Tighten
If you later add:
- User accounts / authentication → restrict to your domain
- Admin endpoints → strict origin checking
- Payment processing → restrict + add CSRF protection

```javascript
// Tightened CORS
const ALLOWED_ORIGINS = [
    'https://quote.yassclean.com',
    'https://yassclean.com'
];
const origin = req.headers.origin;
if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
}
```

---

## 6. Rate Limiting & Abuse Prevention

### Current Risks
| Endpoint | Abuse Scenario | Impact |
| -------- | -------------- | ------ |
| `/api/lookup` | Mass property lookups | Rentcast/Perplexity API charges |
| `/api/book` | Spam bookings | CRM pollution, notification spam |

### Mitigation Options
1. **Vercel WAF Rate Limiting** (easiest):
   ```json
   // vercel.json — not yet supported in headers, use Vercel Dashboard
   // Dashboard → Firewall → Rate Limiting Rules
   // Rule: /api/* → 20 requests per minute per IP
   ```

2. **In-Function Rate Limiting** (with `@vercel/firewall`):
   ```javascript
   const { ipRateLimit } = require('@vercel/firewall');
   const result = await ipRateLimit(req, { limit: 20, window: '1m' });
   if (result.limited) return res.status(429).json({ error: 'Too many requests' });
   ```

3. **Honeypot field** (anti-bot, client-side):
   ```html
   <!-- Hidden field — bots fill it, humans don't -->
   <input type="text" name="website" style="display:none" tabindex="-1" autocomplete="off">
   ```
   ```javascript
   // Server-side: reject if honeypot is filled
   if (data.website) return res.status(400).json({ error: 'Invalid submission' });
   ```

---

## 7. Security Headers

### Recommended Headers for Static Assets
Add to `vercel.json`:
```json
{
    "headers": [
        {
            "source": "/(.*)",
            "headers": [
                { "key": "X-Content-Type-Options", "value": "nosniff" },
                { "key": "X-Frame-Options", "value": "DENY" },
                { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" }
            ]
        }
    ]
}
```

### Content Security Policy (CSP)
If you add a CSP, ensure it allows:
- Google Maps: `maps.googleapis.com`, `maps.gstatic.com`
- Google Fonts: `fonts.googleapis.com`, `fonts.gstatic.com`
- Meta Pixel: `connect.facebook.net`
- GHL Tracking: `links.yassclean.com`
- Inline scripts (for Meta Pixel): `'unsafe-inline'` or nonce-based

---

## 8. Privacy Compliance

### Data Minimization
- Only collect what's needed for the booking
- Address is needed for quoting and service delivery
- Email is needed for confirmation
- Phone is needed for scheduling
- Name is needed for service delivery

### User Communication
- "We'll confirm one of your preferred time slots within 24 hours" — sets expectation
- No mention of data sharing with third parties (consider adding a privacy note)

### Future Considerations
- **Cookie consent banner** if using Meta Pixel + Google Maps (both set cookies)
- **Privacy policy link** in the footer
- **Data deletion process** — how to remove a user's data from GHL
- **CCPA compliance** if serving California residents — "Do Not Sell" link

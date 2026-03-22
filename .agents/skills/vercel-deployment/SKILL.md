---
name: Vercel Deployment & Serverless
description: Best practices for deploying Node.js apps on Vercel — covers serverless function architecture, environment variables, CORS, caching, cold starts, logging, and production debugging. Tailored for Express-to-serverless migration patterns.
---

# Vercel Deployment & Serverless Skill

## 1. Project Architecture

### Dual-Mode Structure
This project runs in two modes: local Express server and Vercel serverless functions. Both must stay in sync.

```
instant-quote/
├── server.js           # Local Express server (dev mode)
├── api/
│   ├── lookup.js       # Vercel serverless function — property lookup
│   └── book.js         # Vercel serverless function — booking submission
├── vercel.json         # Serverless config (rewrites, headers, duration)
├── index.html          # Static frontend (served by Vercel CDN)
├── styles.css
├── app.js
└── .env                # Local-only env vars (never deployed)
```

### Rules
- **API logic must be duplicated**: `server.js` routes ↔ `api/*.js` serverless functions
- When modifying API behavior, **always update both files**
- Serverless functions export `module.exports = async function handler(req, res)`
- Express routes use `app.post('/api/...', async (req, res) => ...)`
- Keep both implementations functionally identical

---

## 2. Serverless Function Patterns

### Function Anatomy
```javascript
module.exports = async function handler(req, res) {
    // 1. CORS headers (always first)
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // 2. Preflight handling
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

    // 3. Input validation
    const { field } = req.body || {};
    if (!field) return res.status(400).json({ error: 'Field required' });

    // 4. Business logic + external API calls
    try {
        const result = await doWork(field);
        res.json(result);
    } catch (err) {
        console.error('Error:', err);
        res.status(500).json({ error: 'Internal error' });
    }
};
```

### Cold Start Optimization
- **Minimize imports** — only require what you need, no heavy frameworks
- **No Express in serverless** — use raw `req`/`res`, Express adds cold start overhead
- **Lazy-load heavy dependencies** — require inside the handler if rarely used
- **Keep function files small** — split large logic into separate files

### Function Duration Limits
Configure in `vercel.json`:
```json
{
    "functions": {
        "api/lookup.js": { "maxDuration": 30 },  // Property lookup can be slow (API retries)
        "api/book.js": { "maxDuration": 10 }      // Booking should be fast
    }
}
```
- Default Vercel timeout: 10s (Hobby), 60s (Pro)
- Set `maxDuration` to match expected worst-case time
- Lookup with 3 Perplexity retries + Rentcast = up to ~25s, so 30s is appropriate

---

## 3. Environment Variables

### Management
```bash
# Local development
.env file (loaded by dotenv)

# Production (Vercel)
Vercel Dashboard → Settings → Environment Variables
# Or CLI: vercel env add RENTCAST_API_KEY
```

### Current Variables
| Variable | Purpose | Required |
| -------- | ------- | -------- |
| `RENTCAST_API_KEY` | Property data lookup (primary) | Yes |
| `PERPLEXITY_API_KEY` | Property data lookup (fallback) | Yes |
| `MAKECOM_WEBHOOK_URL` | Forward bookings to GHL CRM | Yes |

### Rules
- **Never commit `.env`** — verify `.gitignore` includes it
- **Validate env vars at startup** in `server.js`:
  ```javascript
  if (!process.env.RENTCAST_API_KEY || process.env.RENTCAST_API_KEY === 'your-key-here') {
      console.warn('⚠ RENTCAST_API_KEY not configured');
  }
  ```
- **Use sentinel values** (`'your-key-here'`) to differentiate "not set" from "empty string"
- **In serverless functions**, `process.env` vars are available directly (Vercel injects them)

---

## 4. CORS Configuration

### Vercel Headers (vercel.json)
```json
{
    "headers": [{
        "source": "/api/(.*)",
        "headers": [
            { "key": "Access-Control-Allow-Origin", "value": "*" },
            { "key": "Access-Control-Allow-Methods", "value": "POST, OPTIONS" },
            { "key": "Access-Control-Allow-Headers", "value": "Content-Type" }
        ]
    }]
}
```

### In-Function CORS (belt and suspenders)
Always also set CORS headers in the function itself — `vercel.json` headers may not cover preflight:
```javascript
res.setHeader('Access-Control-Allow-Origin', '*');
if (req.method === 'OPTIONS') return res.status(200).end();
```

### Security Note
- `"*"` is fine for public-facing APIs with no auth
- If you add authentication later, restrict to your domain: `"https://quote.yassclean.com"`

---

## 5. Rewrites & Routing

```json
{
    "rewrites": [
        { "source": "/api/(.*)", "destination": "/api/$1" }
    ]
}
```
- This maps `/api/lookup` → `api/lookup.js` and `/api/book` → `api/book.js`
- Static files (`index.html`, `styles.css`, `app.js`) are served from CDN automatically
- No need for `express.static()` in serverless — Vercel handles it

---

## 6. Logging & Debugging

### Serverless Logging
- `console.log()` and `console.error()` output to Vercel Function Logs
- View in: Vercel Dashboard → Project → Logs (or `vercel logs --follow`)
- **Log key decision points**, not every variable:
  ```javascript
  console.log(`Looking up: ${address}`);
  console.log('Rentcast found:', JSON.stringify(rc));
  console.error('Webhook error:', err.message);
  ```

### Structured Logging Pattern
```javascript
console.log(JSON.stringify({
    event: 'booking_submitted',
    name: data.name,
    services: data.services_list,
    total: data.quote_total,
    timestamp: new Date().toISOString()
}));
```

### Common Debugging Issues
| Problem | Cause | Fix |
| ------- | ----- | --- |
| 500 on `/api/lookup` | Missing env var | Check Vercel env settings |
| CORS error in browser | Missing preflight handler | Add `OPTIONS` handler in function |
| Function timeout | Perplexity retries too slow | Reduce `MAX_RETRIES` or `maxDuration` |
| Stale code after deploy | Vercel cache | Redeploy or clear cache |
| `require('dotenv')` error | Dotenv not needed in serverless | Only use in `server.js` |

---

## 7. Deployment Checklist

Before every deploy, verify:
- [ ] `.env` is in `.gitignore`
- [ ] All env vars are set in Vercel Dashboard
- [ ] `api/*.js` functions match `server.js` logic
- [ ] `vercel.json` has correct `maxDuration` for each function
- [ ] No `require('dotenv')` in serverless functions
- [ ] CORS headers are set both in `vercel.json` and in each function
- [ ] Test both `/api/lookup` and `/api/book` endpoints locally before pushing
- [ ] Check Vercel build logs for warnings after deploy

---

## 8. Local Development

```bash
# Install dependencies
npm install

# Start local server
npm run dev
# → http://localhost:3000

# OR use Vercel CLI for serverless simulation
npx vercel dev
```

- `npm run dev` uses `server.js` (Express) — faster iteration
- `vercel dev` simulates serverless — use to test function behavior before deploy
- Always test both paths if changing API logic

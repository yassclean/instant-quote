---
name: API Resilience & Orchestration
description: Patterns for building reliable multi-API workflows — covers retry strategies, fallback chains, merge orchestration, timeout handling, graceful degradation, input sanitization, and error boundaries. Tailored for property lookup and webhook integrations.
---

# API Resilience & Orchestration Skill

## 1. Multi-API Architecture

### Current Data Flow
```
User enters address
       ↓
┌─── Rentcast API (primary) ───┐
│  Structured property records  │
│  Returns: beds, baths, sqft   │
└──────────────────────────────┘
       ↓ (if any fields missing)
┌─── Perplexity API (fallback) ──┐
│  AI-powered web search          │
│  Searches Zillow/Redfin/etc.    │
│  Up to 3 retries                │
└─────────────────────────────────┘
       ↓
Merged result → Frontend
```

### Merge Strategy Rules
1. **Primary wins** — Rentcast data is always preferred (structured records)
2. **Fill gaps only** — Perplexity only fills `null` fields, never overwrites Rentcast
3. **Source attribution** — Track which API provided each value (`"rentcast.io + zillow.com"`)
4. **Confidence scoring** — `high` (3 fields), `medium` (1-2 fields), `none` (0 fields)

```javascript
function mergeResult(primary, fallback) {
    return {
        beds: primary.beds || fallback.beds || null,
        baths: primary.baths || fallback.baths || null,
        sqft: primary.sqft || fallback.sqft || null,
        source: [primary.source, fallback.source].filter(Boolean).join(' + '),
        confidence: /* calculate from field count */
    };
}
```

---

## 2. Retry Strategies

### When to Retry
| Scenario | Retry? | Why |
| -------- | ------ | --- |
| 500 Internal Server Error | Yes | Temporary server issue |
| 429 Too Many Requests | Yes (with backoff) | Rate limited |
| Network timeout | Yes | Transient |
| 400 Bad Request | No | Our input is wrong |
| 401/403 Unauthorized | No | Key is invalid |
| 404 Not Found | No | Data doesn't exist |
| 422 Unprocessable | No | Valid but no results |

### Retry Pattern with Backoff
```javascript
const MAX_RETRIES = 3;
for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
        const result = await apiCall();
        if (result) return result;
    } catch (err) {
        console.warn(`Attempt ${attempt}/${MAX_RETRIES} failed: ${err.message}`);
    }
    // Only wait if we'll retry
    if (attempt < MAX_RETRIES) {
        await new Promise(r => setTimeout(r, 1000 * attempt));  // 1s, 2s, 3s
    }
}
```

### Rules
- **Cap retries at 3** for user-facing requests (anything more = too slow)
- **Back off exponentially** — 1s, 2s, 3s (or 1s, 2s, 4s for aggressive)
- **Exit early on success** — `if (merged.beds && merged.baths) break;`
- **Never retry on auth failures** — they won't resolve without intervention
- **Log every retry attempt** with the attempt number for debugging

---

## 3. Timeout Management

### Setting Timeouts
```javascript
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 8000); // 8s timeout

try {
    const response = await fetch(url, {
        signal: controller.signal,
        // ...other options
    });
    clearTimeout(timeoutId);
    return response;
} catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
        console.warn('Request timed out');
    }
    throw err;
}
```

### Timeout Guidelines
| API | Recommended Timeout | Rationale |
| --- | ------------------- | --------- |
| Rentcast | 8s | Structured API, should be fast |
| Perplexity | 12s | AI model, can be slow |
| GHL Webhook | 5s | Just forwarding data |
| Google Maps (client) | 5s | CDN-served, fast |

### Serverless Duration Budget
With `maxDuration: 30` for lookup:
- Rentcast: up to 8s
- Perplexity retry 1: up to 12s
- 1s wait
- Perplexity retry 2: up to 12s → **33s** (over budget!)
- → Keep MAX_RETRIES at 2 for perplexity, or reduce per-call timeout to 10s

---

## 4. Graceful Degradation

### Principle: Never Block the User
Every external API failure should degrade gracefully, never crash the funnel.

### Degradation Cascade
```
Full success     → Pre-fill all fields, show "Property verified"
Partial data     → Pre-fill what we have, show editable form
API failure      → Show empty form, "Enter your property details below"
Webhook failure  → Log error, return success to user anyway
Maps API failure → Fall back to plain text input
```

### Implementation Pattern
```javascript
// Frontend: always catch and continue
try {
    const res = await fetch('/api/lookup', { /* ... */ });
    if (res.ok) lookupResult = await res.json();
} catch (err) {
    console.warn('Property lookup failed:', err);
    // lookupResult stays null — form shows empty
}

// Backend: webhook failure = still return success
try {
    await fetch(webhookUrl, { /* ... */ });
} catch (err) {
    console.error('Webhook error:', err.message);
}
res.json({ success: true, message: 'Booking received' });
```

### UX During Degradation
- Show a **spinner with contextual text** during lookups ("Searching property records...")
- Minimum **1.5s loader** to prevent flash of content
- If lookup fails, **pre-focus** the first empty field
- Show **"Enter your property details below"** instead of an error message

---

## 5. Input Sanitization

### Server-Side Sanitization
```javascript
function sanitizeInt(val, min, max) {
    if (val === null || val === undefined) return null;
    const n = parseInt(val, 10);
    if (isNaN(n) || n < min || n > max) return null;
    return n;
}
```

### Sanitization Rules
| Field | Type | Min | Max | Fallback |
| ----- | ---- | --- | --- | -------- |
| beds | int | 1 | 10 | null |
| baths | int | 1 | 10 | null |
| sqft | int | 100 | 50,000 | null |
| address | string | 5 chars | 200 chars | reject |
| phone | string | 7 chars | 20 chars | reject |
| email | string | valid email | — | reject |

### AI Response Parsing (Perplexity)
AI responses are unpredictable. Always:
1. Try JSON extraction first (`content.match(/\{[\s\S]*?\}/)`)
2. Fall back to regex patterns for natural language
3. Sanitize every extracted value through `sanitizeInt()`
4. Return `null` for any value that doesn't pass validation

---

## 6. Webhook Integration

### Booking Webhook Architecture
```
Frontend (app.js)
    ↓ POST /api/book (JSON payload)
Serverless Function (api/book.js)
    ↓ Flatten nested data for CRM fields
    ↓ POST to GHL webhook URL
GHL / Make.com
    ↓ Create contact, assign pipeline, send notifications
```

### Data Flattening for CRM
CRMs typically need flat key-value pairs, not nested JSON:
```javascript
// Transform nested → flat
data.services_list = todayList.map(s => s.name).join(', ');
data.services_with_prices = todayList.map(s => `${s.name} ($${s.price})`).join(', ');
data.slot1_formatted = `${slot1.date} at ${slot1.time}`;
data.bedrooms = data.property?.beds_entered || null;
data.utm_source = data.attribution?.utm_source || '';
```

### Webhook Reliability
- **Always return success to the user** even if webhook fails
- **Log webhook failures** with enough detail to replay manually
- **Include timestamp** in webhook payload for ordering
- **Consider a dead-letter queue** for failed webhooks (future enhancement)

---

## 7. Error Boundary Checklist

For every external integration, verify:

- [ ] **Timeout set** — no unbounded waits
- [ ] **Retries capped** — max 3 with backoff
- [ ] **Auth failure short-circuit** — don't retry 401/403
- [ ] **Graceful fallback** — user flow continues on failure
- [ ] **Error logged** — with enough context to debug
- [ ] **No error details leaked** to frontend — generic messages only
- [ ] **Input sanitized** — ranges checked, types validated
- [ ] **Response parsed safely** — try/catch around JSON parse

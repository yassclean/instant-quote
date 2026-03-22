---
name: Conversion Rate Optimization
description: Strategies for maximizing booking conversions in multi-step quote funnels — covers funnel psychology, form UX, social proof, urgency, A/B testing, and analytics event tracking. Tailored for service-business booking flows.
---

# Conversion Rate Optimization (CRO) Skill

## 1. Funnel Psychology

### The Commitment Ladder
Users who take small, low-friction steps are far more likely to complete the full journey. Structure the funnel to escalate commitment gradually:

| Step | Commitment Level | User Effort | Psychological Trigger |
| ---- | --------------- | ----------- | --------------------- |
| 1    | Low             | Type address | Curiosity ("see my price") |
| 2    | Medium          | Confirm details | Investment (they've started, sunk cost) |
| 3    | Medium-High     | Select services | Ownership (comparing options = picturing the result) |
| 4    | High            | Enter contact + submit | Urgency + trust |

### Rules
- **Start with the easiest action** — never ask for name/email/phone on step 1
- **Show value before asking for commitment** — the quote must appear before the booking form
- **Progress indicators boost completion by 20–30%** — always show step dots in the navbar
- **Never move backwards** unless the user explicitly clicks back — preserve momentum

---

## 2. Form UX for Conversions

### Field Reduction
Every field you add reduces conversion rate by 4–8%. Ruthlessly cut:
- Remove any field that can be auto-filled or looked up
- Make non-essential fields optional with visible "optional" tags
- Group fields logically (address → property → services → contact)

### Button Copy
Generic "Submit" buttons convert 3% worse than action-specific copy:
| ❌ Bad | ✅ Good |
| ------ | ------- |
| Submit | Get My Quote |
| Next | See My Pricing |
| Book | Request Booking |
| Continue | Continue to Book |

### Input Patterns That Convert
- **Selector buttons** (`1 2 3 4+`) instead of dropdowns for < 5 options
- **Date pickers** with `min` set to tomorrow (prevent past dates)
- **"First Available"** checkbox to skip date selection entirely
- **Phone field** with `type="tel"` and placeholder format `(555) 123-4567`
- **Auto-focus** the first input on each step
- **Real-time validation** — enable the CTA button instantly when all fields pass
- **Disable on submit** with spinner to prevent double-submission

### Progressive Disclosure
- Show add-ons and extras AFTER the primary service is selected
- Collapse detailed descriptions behind "Details ▾" toggles
- Show the recurring plan section separately with a "Starts Later" badge to reduce decision anxiety

---

## 3. Social Proof & Trust

### Trust Badge Placement
Place trust signals at two critical points:
1. **Below the hero CTA** (Step 1) — reduces initial hesitation
2. **Near the booking button** (Step 4) — reassures at the final commitment moment

### Effective Trust Elements
| Element | Impact | Where |
| ------- | ------ | ----- |
| "Licensed & Insured" | High | Step 1 hero |
| "5-Star Rated" + star icons | High | Step 1 hero |
| "Serving Your Area" | Medium | Step 1 hero |
| Review count ("200+ reviews") | High | Near booking CTA |
| Google review widget | Very High | Pricing page or landing |
| "Same dedicated team" feature | Medium | Maintenance plan cards |
| Money-back guarantee | High | Near booking CTA |

### Social Proof Patterns
- Show **real numbers** ("200+ five-star reviews") not vague claims
- Use **third-party logos** (Google, Yelp) for borrowed trust
- Include **"most popular" badges** on the most-selected plan
- Show **savings percentages** prominently on discounted plans

---

## 4. Urgency & Scarcity (Use Ethically)

### Legitimate Urgency
- "We'll confirm your time slot within 24 hours"
- "Limited availability this week" (if true)
- Set `min` date on date pickers to tomorrow — subtle urgency

### Pricing Anchoring
- Show struck-through original price next to discounted maintenance plans
- Present the "Best Value" plan with a distinctive badge
- Display savings as percentage ("Save 20%") not dollar amount (percentage feels larger for services)

### AVOID
- Fake countdown timers
- "Only 2 slots left!" when untrue
- Artificial price increases
- Any dishonest urgency — it destroys trust permanently

---

## 5. Analytics Event Tracking

### Critical Funnel Events
Track these events to measure where users drop off:

```javascript
// Step progression
fbq('track', 'ViewContent', { content_name: 'Step 1 - Address' });
fbq('track', 'ViewContent', { content_name: 'Step 2 - Property Details' });
fbq('track', 'ViewContent', { content_name: 'Step 3 - Pricing' });
fbq('track', 'Lead');  // Booking submitted

// Micro-conversions
fbq('trackCustom', 'AddressEntered');
fbq('trackCustom', 'PropertyConfirmed');
fbq('trackCustom', 'ServiceSelected', { service: 'Deep Clean' });
fbq('trackCustom', 'AddOnSelected', { addon: 'Inside Fridge' });
```

### UTM Attribution
Always capture and forward UTM parameters through the entire funnel:
```javascript
const params = new URLSearchParams(window.location.search);
state.attribution = {
    utm_source: params.get('utm_source') || '',
    utm_medium: params.get('utm_medium') || '',
    utm_campaign: params.get('utm_campaign') || '',
    fbclid: params.get('fbclid') || '',
    landing_page: window.location.href,
    referrer: document.referrer
};
```

### Key Metrics to Monitor
| Metric | Target | How to Improve |
| ------ | ------ | -------------- |
| Step 1 → Step 2 | > 65% | Simplify address input, improve hero copy |
| Step 2 → Step 3 | > 80% | Pre-fill property data, reduce fields |
| Step 3 → Step 4 | > 40% | Improve pricing presentation, add trust signals |
| Step 4 → Submitted | > 60% | Reduce form fields, add "First Available" |
| Overall funnel | > 12% | Optimize weakest step first |

---

## 6. Mobile Conversion Boosters

- **Full-width CTAs** on mobile — thumb-friendly
- **Sticky bottom CTA bar** for pricing page (scrolling past cards)
- **Larger touch targets** — minimum 44×44px
- **Reduce typing** — use selector buttons, checkboxes, and pre-filled values
- **Click-to-call** phone number in confirmation
- **Shorter copy** on mobile — reduce hero subtitle, trim descriptions

---

## 7. A/B Testing Priorities

Test these elements in order of expected impact:

1. **Hero headline** — test value prop vs. speed vs. trust angle
2. **CTA button copy** — "Get My Quote" vs. "See My Price" vs. "Get Started"
3. **Number of steps** — 3-step vs. 4-step funnel
4. **Service card layout** — horizontal vs. vertical, with/without descriptions
5. **Trust badge presence** — with vs. without, different positions
6. **"First Available" default** — checkbox checked vs. unchecked by default
7. **Add-on presentation** — grid vs. list, pre-selected vs. opt-in

### Testing Rules
- Test ONE variable at a time
- Need minimum ~200 conversions per variant for significance
- Run tests for at least 2 full weeks (weekday/weekend behavior differs)
- Always have a control (current version)

---
name: App Design, UX & Frontend Design
description: Comprehensive guidelines for building premium, modern web UIs — covers visual design, UX patterns, component architecture, responsive design, animations, accessibility, and performance. Tailored for YassClean's dark-theme design system.
---

# App Design, UX & Frontend Design Skill

## 1. Design Philosophy

### Core Principles
1. **Premium over functional** — Every surface should feel intentional and polished. Never ship "works but ugly."
2. **Dark-first, accent-driven** — Use deep backgrounds with a vibrant accent color for energy. Let whitespace breathe.
3. **Motion as language** — Animations aren't decoration; they communicate state changes, hierarchy, and responsiveness.
4. **Progressive disclosure** — Don't overwhelm. Reveal complexity only when the user is ready (multi-step flows, expandable sections).
5. **Mobile-first, always** — Design for the smallest screen. Desktop is an enhancement.

### Visual Identity Checklist
Before shipping any UI, verify:
- [ ] Consistent color palette (no ad-hoc hex values)
- [ ] One font family with clear weight hierarchy
- [ ] Proper spacing rhythm (base unit × multiples)
- [ ] Interactive states for ALL clickable elements (hover, active, disabled, focus)
- [ ] Dark mode text contrast ratios ≥ 4.5:1 (WCAG AA)
- [ ] No orphaned elements (everything is visually grouped)

---

## 2. Design System Tokens

### Defining a Token System
Always define design tokens in CSS custom properties at `:root`. This is non-negotiable.

```css
:root {
    /* Colors */
    --bg:            #0a0a0a;
    --bg-card:       rgba(255, 255, 255, 0.035);
    --bg-card-hover: rgba(255, 255, 255, 0.06);
    --border:        rgba(255, 255, 255, 0.08);
    --border-active: rgba(221, 255, 0, 0.4);
    --text:          #ffffff;
    --text-dim:      rgba(255, 255, 255, 0.55);
    --text-muted:    rgba(255, 255, 255, 0.3);
    --accent:        #ddff00;
    --accent-dim:    rgba(221, 255, 0, 0.15);
    --accent-glow:   rgba(221, 255, 0, 0.25);

    /* Spacing & Radii */
    --radius:    16px;
    --radius-sm: 10px;
    --radius-xs: 8px;

    /* Typography */
    --font: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;

    /* Animation */
    --transition: 0.3s cubic-bezier(.4, 0, .2, 1);
}
```

### Rules
- **Never use raw hex values outside `:root`.** Always reference `var(--token)`.
- **Borders on dark themes** should be semi-transparent white, not gray. `rgba(255,255,255,0.08)` reads cleaner than `#222`.
- **Accent dim variants** are essential for backgrounds behind accent-colored text.
- **Use cubic-bezier for transitions**, never plain `ease`. The default `cubic-bezier(.4, 0, .2, 1)` (Material ease-out) feels professional.

---

## 3. Typography

### Hierarchy
| Element           | Size                         | Weight | Color          | Spacing         |
| ----------------- | ---------------------------- | ------ | -------------- | --------------- |
| Hero title        | `clamp(2.2rem, 6vw, 3.6rem)` | 900   | `--text`       | `-0.03em`       |
| Section title     | `clamp(1.5rem, 4vw, 2rem)`   | 800   | `--text`       | `-0.02em`       |
| Subsection title  | `1.25rem`                    | 700   | `--text`       | normal          |
| Body              | `1rem`                       | 400   | `--text`       | normal          |
| Subtitle / desc   | `0.9rem`                     | 300–400| `--text-dim`   | normal          |
| Label             | `0.85rem`                    | 600   | `--text-dim`   | `0.06em` upper  |
| Badge / tag       | `0.75rem`                    | 600   | `--accent`     | `0.08em` upper  |
| Fine print        | `0.65rem`                    | 500   | `--text-muted` | `0.05em` upper  |

### Rules
- Use `clamp()` for responsive heading sizes — never fixed `px`.
- Negative `letter-spacing` on headings tightens them for a modern feel.
- Positive `letter-spacing` on labels/badges for readability at small sizes.
- Always set `-webkit-font-smoothing: antialiased` on `body`.
- Use `line-height: 1.1` for headings, `1.6` for body text.

---

## 4. Color & Theming

### Dark Theme Best Practices
1. **Background layers** — Use distinct opacity levels, not distinct grays:
   - Page: `#0a0a0a` (near-black)
   - Cards: `rgba(255,255,255, 0.035)` (subtle lift)
   - Card hover: `rgba(255,255,255, 0.06)` (gentle feedback)
2. **Accent usage** — The accent color (`#ddff00`) should appear in:
   - Active states, selected states, CTAs
   - Icon tints, badges, focus rings
   - Background glow effects (radial gradients)
   - **Never** as body text on dark backgrounds (poor readability)
3. **Status colors** — Keep semantic:
   - Success: `#00e676`
   - Warning: `#ffab00`
   - Error: `#ff5252`
   - Each with a `rgba()` dim variant for backgrounds

### Glassmorphism / Blur Effects
- `backdrop-filter: blur(20px)` for navbar, modals, overlays
- Combine with `rgba()` backgrounds (e.g., `rgba(10,10,10,0.75)`)
- Add subtle `border-bottom: 1px solid var(--border)` for definition

---

## 5. Layout Patterns

### Container Strategy
```css
.step-inner {
    width: 100%;
    max-width: 540px;        /* Forms and content */
    margin: 0 auto;
    padding: 3rem 1.5rem 4rem;
}
.step-inner--wide {
    max-width: 820px;        /* Grids, pricing tables */
}
```
- Forms: `max-width: 540px`
- Content grids: `max-width: 820px`
- Full-width sections: `max-width: 1200px`
- Always center with `margin: 0 auto`

### Grid Patterns
- **Pricing cards**: CSS Grid, `repeat(auto-fill, minmax(220px, 1fr))`
- **Add-on items**: CSS Grid, `repeat(auto-fill, minmax(240px, 1fr))`
- **Trust badges**: Flexbox, `flex-wrap: wrap`, `gap: 1.25rem`
- Use `gap` instead of margins between grid children

### Responsive Breakpoints
```css
@media (max-width: 600px) { /* Mobile */ }
@media (max-width: 480px) { /* Small mobile */ }
@media (min-width: 768px) { /* Tablet+ */ }
```
- Mobile adjustments: reduce padding, stack columns, shrink fonts
- Never hide functionality on mobile — restructure, don't remove

---

## 6. Component Patterns

### Buttons

**Primary button anatomy:**
```css
.btn-primary {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    padding: 0 32px;
    height: 56px;
    background: var(--accent);
    color: #000;
    font-weight: 700;
    border: none;
    border-radius: var(--radius);
    cursor: pointer;
    transition: var(--transition);
    position: relative;
    overflow: hidden;
}
```

**Required states:**
| State     | Effect                                                         |
| --------- | -------------------------------------------------------------- |
| Default   | Accent background, dark text                                   |
| Hover     | Subtle light gradient overlay, glow shadow, `translateY(-2px)` |
| Active    | Reduced shadow, `translateY(0)`                                |
| Disabled  | `opacity: 0.3`, `cursor: not-allowed`, no hover effects       |
| Loading   | Replace text with spinner, keep same dimensions                |

- Always include an icon/arrow alongside text on CTAs
- Use `::before` pseudo-element for hover gradient overlays
- Animate arrow icon on hover: `translateX(3px)`

### Cards

**Card anatomy:**
- Background: `var(--bg-card)` with border `var(--border)`
- Border-radius: `var(--radius)` (16px)
- Padding: `1.5rem` to `2rem`
- Hover: shift border to accent, subtle glow
- Selected: accent border, accent background dim, checkmark indicator

**Selectable cards** need:
1. A `.select-check` visual indicator (animated checkmark)
2. `.selected` class with accent border + accent-dim background
3. Click handler that toggles the `selected` class
4. Mutual exclusion logic for grouped options (radio-like behavior)

### Form Inputs
- Height: `56px` (matching button height for alignment)
- Background: `var(--bg-card)`
- Border: `1.5px solid var(--border)` → on focus: `border-color: var(--accent)` + `box-shadow: 0 0 0 4px var(--accent-dim)`
- Dark theme selects need `option { background: #1a1a1a; color: #fff; }`

### Selector Buttons (Pill Groups)
- Flexbox row with equal-width buttons
- Active state: accent dim background + accent border + accent text
- Only one active at a time (radio behavior)

---

## 7. Animations & Micro-interactions

### Page/Step Transitions
```css
@keyframes fadeSlideIn {
    from { opacity: 0; transform: translateY(24px); }
    to   { opacity: 1; transform: translateY(0); }
}
.step.active {
    animation: fadeSlideIn 0.5s ease forwards;
}
```

### Background Effects
1. **Dot grid** — Radial gradient pattern with slow drift animation
2. **Glow orb** — Large radial gradient circle, pulsing opacity + scale
3. These run on `position: fixed` layers with `pointer-events: none`

### Interaction Animations
| Trigger         | Animation                                          |
| --------------- | -------------------------------------------------- |
| Button hover    | `translateY(-2px)`, glow shadow, gradient overlay   |
| Card select     | Scale bounce (0.97 → 1.0), border color transition  |
| Step transition | Fade + slide up, 0.5s                               |
| Loading         | Spinner rotation, pulsing dot text                   |
| Price reveal    | Number count-up or scale-in                          |
| Arrow icon      | `translateX(3px)` on parent hover                    |

### Animation Rules
- Always use `cubic-bezier(.4, 0, .2, 1)` for UI transitions
- `0.2s–0.3s` for micro-interactions (hovers, toggles)
- `0.4s–0.6s` for page transitions
- `> 1s` only for ambient background effects
- Never animate `width`, `height`, or `top/left` — use `transform` and `opacity`
- Add `will-change: transform` to heavily animated elements
- Use `prefers-reduced-motion` media query to disable non-essential animations

---

## 8. UX Patterns

### Multi-Step Forms
1. **Step indicator in navbar** — Numbered dots + connecting lines
2. **Back button** — Circle button, top-left of each step
3. **Progressive validation** — CTA button starts disabled, enables when form is valid
4. **Smooth scroll to top** on step change: `window.scrollTo({ top: 0, behavior: 'smooth' })`
5. **Loading states** — Show a spinner with contextual message during async operations (minimum 1.5s to avoid flashing)

### Selection UX
- **Tap-to-select** cards with visual checkmark feedback
- **Mutual exclusion** for conflicting options (e.g., Deep Clean vs Move In/Out)
- **Radio-like selection** for grouped options (e.g., one maintenance frequency at a time)
- **Running summary** that updates dynamically as selections change
- **Smart hints** that change based on current selection state

### Form UX
- Group related fields with clear section headers
- Use icon + label pattern for form labels
- Show "optional" tags on non-required fields
- Set `min` dates dynamically (e.g., tomorrow for booking)
- Phone input: `type="tel"` with placeholder format
- Email input: `type="email"` with validation
- **Checkbox alternatives**: Styled custom checkboxes (hide native, use `::after` for checkmark)

### Error & Empty States
- Never show a blank screen — always have a fallback message
- Graceful API failure: continue flow with manual input
- Timeouts for third-party scripts (Google Maps fallback)

---

## 9. Responsive Design

### Mobile-Specific Adjustments
```css
@media (max-width: 600px) {
    .navbar { padding: 0 1rem; height: 56px; }
    .hero-title { font-size: clamp(1.8rem, 7vw, 2.4rem); }
    .step-inner { padding: 2rem 1rem 3rem; }
    .btn-primary { width: 100%; }
    .pricing-grid { grid-template-columns: 1fr; }
    .slot-row { flex-direction: column; }
}
```

### Mobile Interaction Rules
- Minimum touch target: `44px × 44px`
- Full-width buttons on mobile
- Stack horizontal layouts vertically below 600px
- Increase padding around interactive elements
- Test all dropdowns/selects on iOS Safari (known styling issues)

---

## 10. Accessibility

### Minimum Requirements
1. **Color contrast**: 4.5:1 for normal text, 3:1 for large text
2. **Focus indicators**: Visible focus ring on all interactive elements (accent border + glow)
3. **Semantic HTML**: Use `<nav>`, `<main>`, `<section>`, `<button>`, `<label>`
4. **ARIA attributes**: `aria-hidden="true"` on decorative elements
5. **Form labels**: Every input must have an associated `<label>`
6. **Keyboard navigation**: Tab order, Enter/Space activation
7. **Screen reader text**: Visually hidden text for icon-only buttons

### Focus Ring Pattern
```css
:focus-visible {
    outline: none;
    border-color: var(--accent);
    box-shadow: 0 0 0 4px var(--accent-dim);
}
```

---

## 11. Performance

### CSS Performance
- Use `transform` and `opacity` for all animations (GPU-composited)
- Avoid animating `box-shadow` directly — animate `opacity` of a pseudo-element shadow instead
- Use `will-change` sparingly (only on elements that animate frequently)
- Minimize `backdrop-filter` usage on mobile (expensive)

### Loading Strategy
- Preconnect to Google Fonts: `<link rel="preconnect" href="https://fonts.googleapis.com">`
- Load fonts with `display=swap`
- Load third-party scripts (`async defer`)
- Show content skeleton/spinner during data fetches (minimum 1.5s)

### Image Guidelines
- Use WebP format when possible
- Lazy-load below-fold images: `loading="lazy"`
- Set explicit `width` and `height` to prevent layout shift
- Use `object-fit: cover` for hero images

---

## 12. SEO & Meta

### Every Page Must Have
```html
<title>Descriptive Page Title | Brand</title>
<meta name="description" content="Compelling 150-160 char description">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<link rel="canonical" href="https://...">
```

### Semantic Structure
- Single `<h1>` per page
- Logical heading hierarchy: `h1` → `h2` → `h3`
- Unique, descriptive `id` attributes on all interactive elements
- `<button>` for actions, `<a>` for navigation — never mix

---

## 13. Code Organization

### CSS File Structure
```
/* 1. Reset & Base */
/* 2. Design Tokens (:root) */
/* 3. Layout (Navbar, Main, Steps) */
/* 4. Shared Components (Buttons, Inputs, Cards) */
/* 5. Section-Specific Styles (Step 1, Step 2, etc.) */
/* 6. State Styles (.active, .selected, .disabled) */
/* 7. Animations (@keyframes) */
/* 8. Responsive (@media queries) */
```

### Naming Conventions
- **BEM-light**: `.block-element` (no double underscores, use hyphens)
- **State modifiers**: `.card.selected`, `.step.active`, `.btn-primary:disabled`
- **Utility classes**: Keep to a minimum. Prefer semantic class names.
- **JS hooks**: Use `id` for JavaScript, `class` for styling

### HTML Structure
- Semantic sections with clear comments: `<!-- ===== STEP 1: ADDRESS ===== -->`
- Group related form fields in `<div class="form-group">`
- Use SVG inline for icons (not icon fonts) — allows CSS color control
- Keep SVGs concise: `viewBox`, `fill="none"`, `stroke="currentColor"`

---

## Quick Reference: Dark Theme Card Recipe

```css
.card {
    background: var(--bg-card);
    border: 1.5px solid var(--border);
    border-radius: var(--radius);
    padding: 1.5rem;
    transition: var(--transition);
}
.card:hover {
    background: var(--bg-card-hover);
    border-color: rgba(255, 255, 255, 0.15);
}
.card.selected {
    background: var(--accent-dim);
    border-color: var(--accent);
    box-shadow: 0 0 20px var(--accent-glow);
}
```

## Quick Reference: Glow Button Recipe

```css
.btn {
    background: var(--accent);
    color: #000;
    border: none;
    border-radius: var(--radius);
    font-weight: 700;
    cursor: pointer;
    transition: var(--transition);
    position: relative;
    overflow: hidden;
}
.btn::before {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(135deg, rgba(255,255,255,0.2), transparent);
    opacity: 0;
    transition: var(--transition);
}
.btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 0 30px var(--accent-glow), 0 8px 25px rgba(0,0,0,0.3);
}
.btn:hover::before { opacity: 1; }
.btn:disabled {
    opacity: 0.3;
    cursor: not-allowed;
    transform: none !important;
    box-shadow: none !important;
}
```

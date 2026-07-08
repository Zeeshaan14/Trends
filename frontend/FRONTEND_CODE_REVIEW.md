# NU Jerseys — Frontend Code Review Report

**Reviewer perspective:** Senior frontend engineer / security-focused production readiness review  
**Scope:** Entire `frontend/` directory (Next.js 16 App Router, React 19, TypeScript)  
**Date:** July 4, 2026  
**Goal:** Identify bugs, security vulnerabilities, performance gaps, and production-readiness blockers with actionable fixes.

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Critical Issues](#critical-issues)
3. [High Priority Issues](#high-priority-issues)
4. [Medium Priority Issues](#medium-priority-issues)
5. [Low Priority / Polish](#low-priority--polish)
6. [Performance Enhancements](#performance-enhancements)
7. [Security Hardening Roadmap](#security-hardening-roadmap)
8. [Production Readiness Checklist](#production-readiness-checklist)
9. [Architecture & Maintainability](#architecture--maintainability)
10. [Accessibility (a11y)](#accessibility-a11y)
11. [Testing & CI Gaps](#testing--ci-gaps)
12. [Dependency & Supply Chain](#dependency--supply-chain)
13. [What's Already Good](#whats-already-good)

---

## Executive Summary

The frontend is a well-structured Next.js storefront with a clean component hierarchy, typed API layer, Razorpay checkout integration, and a functional admin panel. The UI is polished and the cart/checkout flow is largely complete.

However, **the app is not production-ready from a security and reliability standpoint** without addressing several critical items:

| Category | Count (approx.) |
|---|---|
| Critical | 8 |
| High | 14 |
| Medium | 18 |
| Low | 12 |

**Top blockers before production:**

1. Admin JWT + refresh tokens stored in `localStorage` (XSS = full account compromise)
2. No Next.js middleware protecting `/admin/*` routes
3. Razorpay checkout amount computed on the client instead of using server `order.total`
4. Cart cleared when user dismisses Razorpay modal (data loss + broken retry flow)
5. Missing static assets (`/placeholder.svg`, hero images) — broken images in production
6. Next.js 16.0.10 has multiple known CVEs — upgrade required
7. No security headers (CSP, HSTS, X-Frame-Options) in `next.config.ts`
8. Order lookup email passed in URL query string (PII leakage via logs/history)

---

## Critical Issues

### CRIT-01: Admin tokens stored in `localStorage`

**Files:** `app/admin/page.tsx`, `app/admin/dashboard/page.tsx`, `app/admin/orders/page.tsx`, `app/admin/jerseys/page.tsx`

```typescript
localStorage.setItem("adminUser", JSON.stringify(session))
// session includes accessToken + refreshToken
```

**Risk:** Any XSS vulnerability anywhere on the site allows an attacker to steal admin JWTs and call admin APIs. `localStorage` is readable by any JavaScript on the page. Refresh tokens make the blast radius worse (long-lived compromise).

**Fix:**
- Move admin auth to **HttpOnly, Secure, SameSite=Strict cookies** set by the backend (or Next.js Route Handlers as a BFF proxy).
- Never expose refresh tokens to client-side JavaScript.
- Implement token refresh server-side.
- Add CSRF protection if using cookies (double-submit cookie or SameSite + custom header).

---

### CRIT-02: No server-side route protection for admin pages

**Files:** No `middleware.ts` exists. All admin auth checks are client-side `useEffect` redirects.

**Risk:**
- Admin UI HTML/JS bundles are publicly downloadable.
- Flash of admin content before redirect.
- Next.js 16 has known **middleware bypass CVEs** (GHSA-26hh-7cqf-hhc6) — when you add middleware, you must upgrade Next.js first.

**Fix:**
```typescript
// middleware.ts (after Next.js upgrade)
export function middleware(request: NextRequest) {
  const token = request.cookies.get("admin_session")?.value
  if (request.nextUrl.pathname.startsWith("/admin") &&
      request.nextUrl.pathname !== "/admin") {
    if (!token) return NextResponse.redirect(new URL("/admin", request.url))
  }
  return NextResponse.next()
}
export const config = { matcher: ["/admin/:path*"] }
```

Also create `app/admin/layout.tsx` without public navbar/footer.

---

### CRIT-03: Razorpay amount mismatch — client vs server

**File:** `app/checkout/page.tsx` (line ~106)

```typescript
amount: Math.round(finalTotal * 100), // Expected in paise
```

The order is created server-side with authoritative pricing (`order.total`), but Razorpay is opened with **frontend-calculated** `finalTotal` from cart localStorage prices.

**Risk:**
- If cart prices are stale/tampered, Razorpay charge amount may not match the backend order.
- Payment verification may fail or cause reconciliation issues.
- Regulatory/accounting mismatch.

**Fix:**
```typescript
amount: Math.round(order.total * 100),
currency: "INR",
order_id: order.razorpayOrderId,
```
Same fix needed in `app/order/[id]/page.tsx` retry flow (already uses `order.total` — good).

---

### CRIT-04: Cart cleared when user cancels Razorpay payment

**File:** `app/checkout/page.tsx` (modal `ondismiss` handler)

```typescript
ondismiss: function () {
    setIsProcessing(false)
    // ...
    clearCart()  // ← BUG
    router.push(`/order/${order.id}`)
}
```

**Risk:** User dismisses payment → cart is wiped → order is PENDING → user cannot easily retry with same items. Contradicts the toast message "You can retry payment from the order page."

**Fix:** Remove `clearCart()` from `ondismiss`. Only clear cart after successful `verifyPayment`.

---

### CRIT-05: Missing critical static assets

**Public folder contains only:** `nu3.png`

**Referenced but missing:**
- `/placeholder.svg` (used in 10+ components)
- `/basketball-player-in-action-dramatic-lighting-dark.png` (hero)
- `/professional-basketball-jersey-floating-with-drama.png` (hero)

**Risk:** Broken images across the entire site in production. Next.js `<Image>` will 404.

**Fix:** Add fallback assets to `public/` or use a CDN placeholder service. Add `onError` handlers or a shared `<SafeImage>` component.

---

### CRIT-06: PII (email) in URL query string for order lookup

**File:** `app/order/[id]/page.tsx`

```typescript
fetch(`${API_BASE}/orders/${orderId}?email=${encodeURIComponent(lastEmail)}`)
```

**Risk:**
- Email appears in browser history, server access logs, analytics, referrer headers.
- GDPR/privacy compliance issue.
- Easier credential stuffing / order enumeration when combined with UUID guessing.

**Fix:**
- Use POST with email in body (backend already supports email verification pattern on download endpoint).
- Or store a short-lived order access token returned at checkout in an HttpOnly cookie.
- Add `getOrderById()` to `lib/api.ts` instead of inline fetch.

---

### CRIT-07: Vulnerable Next.js version (16.0.10)

**File:** `package.json`

`npm audit` reports **multiple high-severity CVEs** including:
- Middleware/proxy bypass (GHSA-26hh-7cqf-hhc6) — **confidentiality impact**
- Server Components DoS (GHSA-q4gf-8mx6-v5v3, GHSA-8h8q-6873-q5fj)
- XSS with CSP nonces (GHSA-ffhc-5mcf-pf4q)
- Image optimizer DoS (GHSA-9g9p-9gw9-jx7f) — relevant given broad `remotePatterns`

**Fix:** Upgrade to **Next.js ≥ 16.2.6** (or latest stable 16.x) and re-run audit.

---

### CRIT-08: Overly permissive `next/image` remotePatterns

**File:** `next.config.ts`

```typescript
hostname: '*.amazonaws.com',
hostname: '*.r2.dev',
hostname: '*.unsplash.com',
```

**Risk:** Combined with Image Optimizer DoS CVE, attackers can force your server to fetch/optimize arbitrary images from any S3/R2 bucket, causing cost and DoS.

**Fix:**
- Restrict to your exact R2 public domain(s) only.
- Remove unused patterns (Unsplash, Cloudinary, AWS wildcard if not needed).
- Consider `images.unoptimized: true` for R2 public URLs (serve directly from CDN).

---

## High Priority Issues

### HIGH-01: No Content Security Policy or security headers

**File:** `next.config.ts` — no `headers()` configuration.

**Missing headers:**
- `Content-Security-Policy`
- `Strict-Transport-Security`
- `X-Frame-Options` / `frame-ancestors`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy`
- `Permissions-Policy`

**Fix:**
```typescript
async headers() {
  return [{
    source: "/(.*)",
    headers: [
      { key: "X-Frame-Options", value: "DENY" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
      { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self' https://checkout.razorpay.com; ..." },
    ],
  }]
}
```
Tune CSP for Razorpay checkout script and your R2 image domains.

---

### HIGH-02: API base URL default mismatch

**File:** `lib/api.ts`

```typescript
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api"
```

**README says:** `http://localhost:8000/api`

**Risk:** Silent failures in dev/staging if env var is missing. Production build without env = calls wrong host.

**Fix:** Fail fast at build time if `NEXT_PUBLIC_API_URL` is unset in production:
```typescript
if (!process.env.NEXT_PUBLIC_API_URL && process.env.NODE_ENV === "production") {
  throw new Error("NEXT_PUBLIC_API_URL is required")
}
```

---

### HIGH-03: Refresh token received but never used

**File:** `lib/api.ts` — `AdminLoginResponse` includes `refreshToken` but no refresh logic exists.

**Risk:** Admin sessions expire silently; poor UX; tokens sit in localStorage unused.

**Fix:** Implement refresh via secure HttpOnly cookie + silent refresh before API calls, or re-login prompt on 401.

---

### HIGH-04: Admin pages render inside public layout (navbar + cart)

**File:** `app/layout.tsx` wraps ALL routes including `/admin/*`.

**Risk:** Admin pages show shopping cart, public nav links, and brand chrome — confusing and unprofessional. Increases XSS surface on admin pages.

**Fix:** Create `app/admin/layout.tsx` with minimal admin shell (sidebar, no cart).

---

### HIGH-05: `clearCart()` before single-item checkout on product page

**File:** `app/jerseys/[id]/page.tsx`

```typescript
const handleDownload = () => {
    clearCart()
    addItem({ ... })
    router.push("/checkout")
}
```

**Risk:** User loses existing cart items when buying from product detail page.

**Fix:** Remove `clearCart()` or ask user to confirm replacing cart.

---

### HIGH-06: Client-side price/tax inconsistencies

| Location | GST/Tax behavior |
|---|---|
| `cart-sheet.tsx` | Shows GST 18% label but calculates `totalPrice * 0` |
| `cart-sheet.tsx` | Has hidden `shipping = 10` and `tax = 0.08` variables never displayed |
| `checkout/page.tsx` | GST 18% label, tax = 0 |
| Backend | tax = 0 |

**Risk:** Legal/trust issue — UI shows "GST (18%)" with ₹0.00. Misleading customers.

**Fix:** Align all displays with backend tax logic. Remove dead shipping/tax code from cart sheet.

---

### HIGH-07: No input validation on checkout form

**File:** `app/checkout/page.tsx`

Only checks non-empty strings. No:
- Email format validation (beyond `type="email"`)
- Phone number format (Indian mobile: 10 digits)
- Company name length/sanitization
- Rate limiting on client (backend has rate limits — good)

**Fix:** Use **Zod** (already in dependencies but unused):
```typescript
const checkoutSchema = z.object({
  companyName: z.string().min(2).max(100),
  email: z.string().email(),
  phone: z.string().regex(/^[6-9]\d{9}$/, "Invalid Indian mobile number"),
})
```

---

### HIGH-08: `badgeColor` rendered as raw CSS class

**Files:** `components/jersey-card.tsx`, `app/jerseys/[id]/page.tsx`, admin jerseys

```typescript
<Badge className={`${badgeColor} text-xs font-semibold`}>
```

**Risk:** If admin enters `"><script>...` or arbitrary classes, this is stored XSS/UI defacement vector. React escapes text content but class names are applied directly.

**Fix:** Backend whitelist allowed badge colors. Frontend map to predefined Tailwind classes:
```typescript
const BADGE_COLORS: Record<string, string> = {
  red: "bg-red-500 text-white",
  primary: "bg-primary text-primary-foreground",
}
```

---

### HIGH-09: Order page duplicates API logic outside `lib/api.ts`

**File:** `app/order/[id]/page.tsx` — inline `fetch()` with duplicated `API_BASE` fallback.

**Risk:** Inconsistent error handling, harder to maintain, no central auth header support.

**Fix:** Add `getOrderById(orderId, email)` to `lib/api.ts`.

---

### HIGH-10: `notFound()` called conditionally during client render

**Files:** `app/jerseys/[id]/page.tsx`, `app/categories/[category]/page.tsx`

```typescript
if (notFoundState) {
    notFound()
}
```

**Risk:** Works in Next.js but causes full navigation during client render; bad for UX and may flash content. SEO gets soft 404 instead of proper HTTP 404 if not server-rendered.

**Fix:** Use server components with `generateStaticParams` / server-side fetch, or return a dedicated "Not Found" UI without calling `notFound()` mid-hydration.

---

### HIGH-11: No error boundaries (`error.tsx`) or loading UI (`loading.tsx`)

**Risk:** Unhandled runtime errors crash entire app shell. No graceful degradation.

**Fix:** Add route-level `error.tsx` and `loading.tsx` for:
- `/checkout`
- `/order/[id]`
- `/admin/*`
- `/jerseys/[id]`

---

### HIGH-12: Razorpay script loaded without Subresource Integrity (SRI)

**File:** `lib/razorpay.ts`

```typescript
script.src = "https://checkout.razorpay.com/v1/checkout.js"
```

**Risk:** CDN compromise = supply chain attack on payment flow.

**Fix:** Razorpay may not publish SRI hashes — mitigate with strict CSP (`script-src https://checkout.razorpay.com`), monitor script load, consider Razorpay's npm package if available.

---

### HIGH-13: Payment failure handler only logs to console

**File:** `lib/razorpay.ts`

```typescript
rzp.on('payment.failed', function (response: any) {
    console.error("Payment failed", response.error)
})
```

**Fix:** Accept optional `onPaymentFailed` callback; show user-facing toast; track analytics event.

---

### HIGH-14: Admin jersey list fetched without auth token

**File:** `app/admin/jerseys/page.tsx`

```typescript
getJerseys({ limit: 100 })  // public endpoint, no token
```

**Risk:** Not a direct vulnerability (public catalog), but admin page shouldn't depend on public API limits. Use authenticated admin endpoint with pagination.

---

## Medium Priority Issues

### MED-01: Entire app is client-rendered for data pages

Most pages use `"use client"` + `useEffect` fetch instead of React Server Components.

**Impact:**
- Poor SEO (product/category pages invisible to crawlers without JS)
- Slower Time to First Byte / LCP
- No caching via Next.js `fetch` cache / ISR

**Fix:** Convert catalog pages to Server Components:
```typescript
// app/jerseys/page.tsx (server component)
export default async function JerseysPage() {
  const jerseys = await getJerseys({ limit: 20 })
  return <JerseyGrid jerseys={jerseys.data} />
}
```

---

### MED-02: Duplicate data fetching on homepage

`FeaturedCategories` and `TrendingJerseys` each call `getCategories()` / `getJerseys()` independently on the same page.

**Fix:** Fetch once in `app/page.tsx` (server component) and pass as props.

---

### MED-03: No per-page metadata (SEO)

Only root `layout.tsx` has `metadata`. Product, category, and jersey pages lack:
- `title`, `description`, `openGraph`, `twitter` cards
- Canonical URLs
- JSON-LD structured data (Product schema)

**Fix:** Add `generateMetadata()` to dynamic routes.

---

### MED-04: Non-functional UI elements (dead interactions)

| Element | File | Issue |
|---|---|---|
| "Filters" button | `categories/[category]/page.tsx` | No handler |
| "Load More Jerseys" | `categories/[category]/page.tsx` | No handler |
| "Browse Designs" hero CTA | `hero-section.tsx` | No `href` or `onClick` |
| "Watch Film" button | `hero-section.tsx` | No action |
| "Shop Now" navbar button | `navbar.tsx` | No link |
| Search / Account buttons | `navbar.tsx` (mobile) | Placeholder only |
| Wishlist heart buttons | `jersey-card.tsx`, jersey detail | Non-functional |
| Footer support/company links | `footer.tsx` | All `href="#"` |

**Fix:** Wire up or remove to avoid user frustration.

---

### MED-05: Newsletter is a fake subscription

**File:** `components/newsletter.tsx`

Submits to nowhere — sets local state only. No API, no validation, no GDPR consent record.

**Fix:** Integrate with email provider (Resend, Mailchimp) or remove until ready.

---

### MED-06: Cart localStorage tampering (display integrity)

**File:** `context/cart-context.tsx`

Cart prices stored client-side can be edited in DevTools. Server recalculates on order (good), but UX shows wrong totals until checkout.

**Fix:** Optionally re-validate cart against API prices before checkout:
```typescript
const serverPrices = await getJerseysByIds(cart.map(i => i.id))
// reconcile prices before payment
```

---

### MED-07: `parseInt(id)` without NaN guard

**File:** `app/jerseys/[id]/page.tsx`

`/jerseys/abc` → `NaN` → API error → notFound. Works but messy.

**Fix:**
```typescript
const jerseyId = Number(id)
if (!Number.isInteger(jerseyId) || jerseyId <= 0) notFound()
```

---

### MED-08: Hardcoded category colors duplicated 3×

**Files:** `featured-categories.tsx`, `categories/page.tsx`, `categories/[category]/page.tsx`

**Fix:** Extract to `lib/category-colors.ts`.

---

### MED-09: `featured-players.tsx` is dead code

Component exists but is never imported on any page.

**Fix:** Remove or integrate into homepage.

---

### MED-10: Typo in branding — "jerserys"

**Files:** `app/layout.tsx` metadata, `footer.tsx` copyright

**Fix:** Standardize to "NU Jerseys" everywhere.

---

### MED-11: `suppressHydrationWarning` on `<html>` and `<body>`

**File:** `app/layout.tsx`

Masks real hydration bugs. Often added for theme toggles but no theme provider exists.

**Fix:** Remove unless truly needed; fix underlying mismatch.

---

### MED-12: Mobile nav uses `<a href>` instead of Next.js `<Link>`

**File:** `components/navbar.tsx`

**Impact:** Full page reloads on mobile navigation instead of client-side transitions.

**Fix:** Replace with `<Link href={link.link}>`.

---

### MED-13: No `robots.txt`, `sitemap.xml`, or `manifest.json`

**Impact:** SEO and PWA readiness.

**Fix:** Add `app/robots.ts` and `app/sitemap.ts` (Next.js metadata routes).

---

### MED-14: Inline fetch in order page bypasses `ApiError` class

Errors may not expose `.status` consistently compared to centralized client.

---

### MED-15: Admin login has no brute-force protection on frontend

Backend should rate-limit (verify). Frontend should add:
- Exponential backoff on failed attempts
- CAPTCHA after N failures

---

### MED-16: File upload accepts any size on admin jersey form

**File:** `app/admin/jerseys/page.tsx`

Shows file size in UI but no max size validation before upload.

**Fix:** Reject files > 10MB client-side; enforce server-side too.

---

### MED-17: `isProcessing` state not reset on successful checkout redirect

**File:** `app/checkout/page.tsx`

After successful payment, `setIsProcessing(true)` is called in handler but page navigates away — minor leak if navigation fails.

---

### MED-18: Mixed package managers

Both `package-lock.json` and `pnpm-lock.yaml` exist. README recommends pnpm.

**Fix:** Pick one lockfile, delete the other, document in README.

---

## Low Priority / Polish

1. **Package name** `my-v0-project` in `package.json` — rename to `nu-jerseys-frontend`
2. **Unused dependencies** — `recharts`, `sonner`, `react-hook-form`, `@hookform/resolvers`, `zod`, many `@radix-ui/*` packages appear unused (tree-shaken but bloat install)
3. **ESLint config exists** but `eslint` is not in `devDependencies` — `pnpm lint` may fail on clean install
4. **`Filter` icon imported** in `jerseys/page.tsx` but unused
5. **`Image` imported** in `footer.tsx` but unused
6. **`Star` rating props** passed to `JerseyCard` but never rendered
7. **`rating` / `reviewCount`** in types — always displayed? Verify backend data or remove from UI
8. **Geist Mono font** loaded in layout but `_geistMono` variable never applied
9. **Inconsistent currency formatting** — mix of `.toFixed(0)` and `.toFixed(2)`
10. **Admin orders page** — `updateOrderStatus` API exists but UI doesn't use it
11. **No dark/light mode toggle** despite dark-theme CSS variables
12. **Analytics** (`@vercel/analytics`) included — ensure GDPR consent banner if serving EU users

---

## Performance Enhancements

### PERF-01: Add `sizes` prop to all `<Image fill />` components

Without `sizes`, Next.js downloads oversized images.

```typescript
<Image fill sizes="(max-width: 768px) 50vw, 25vw" ... />
```

### PERF-02: Prefer Server Components for static catalog content

Reduces JS bundle sent to browser. Current homepage ships framer-motion + all section logic client-side.

### PERF-03: Dynamic import heavy libraries

```typescript
const motion = dynamic(() => import("framer-motion").then(m => m.motion))
```

Or limit framer-motion to above-the-fold sections only.

### PERF-04: API response caching

Centralize fetch with Next.js cache tags:
```typescript
fetch(url, { next: { revalidate: 60, tags: ["jerseys"] } })
```

### PERF-05: Cart context re-renders

`CartProvider` value object recreated every render. Memoize with `useMemo`:
```typescript
const value = useMemo(() => ({ items, addItem, ... }), [items, ...])
```

### PERF-06: Pagination vs "Load More"

Category page loads 50 jerseys at once. Use cursor pagination aligned with `/jerseys` page pattern.

### PERF-07: Prefetch product links

Next.js `<Link>` prefetches by default — ensure heavy pages don't prefetch unnecessarily (`prefetch={false}` on admin links).

### PERF-08: Font optimization

Three Google fonts loaded; `_geistMono` unused. Reduce to Inter + Oswald only.

### PERF-09: Bundle analysis

Add `@next/bundle-analyzer` to identify radix bloat.

### PERF-10: Service Worker / offline cart (optional)

Cache static assets; cart already in localStorage.

---

## Security Hardening Roadmap

Recommended priority order for production:

```
Phase 1 (Week 1) — Blockers
├── Upgrade Next.js to ≥ 16.2.6
├── Fix Razorpay amount to use order.total
├── Fix clearCart on payment dismiss
├── Add missing public assets
├── Restrict next/image remotePatterns
└── Add security headers + CSP

Phase 2 (Week 2) — Auth
├── Move admin auth to HttpOnly cookies
├── Add middleware for /admin/*
├── Separate admin layout
├── Remove tokens from localStorage
└── Implement token refresh (server-side)

Phase 3 (Week 3) — Privacy & Hardening
├── Stop passing email in URL query strings
├── Add Zod validation on all forms
├── Whitelist badgeColor values
├── Add error boundaries
└── Add rate limiting UX on login

Phase 4 (Ongoing)
├── E2E tests for checkout flow
├── Penetration test on admin + order endpoints
├── CSP tuning with Razorpay
└── GDPR consent for analytics/newsletter
```

---

## Production Readiness Checklist

| Item | Status |
|---|---|
| Environment variables documented | ⚠️ Partial (missing `.env.example` in frontend) |
| Fail-fast on missing env in prod | ❌ |
| HTTPS enforced | ⚠️ Depends on hosting |
| Security headers | ❌ |
| CSP configured | ❌ |
| Admin auth secured | ❌ |
| Payment flow tested end-to-end | ⚠️ Needs verification |
| Error monitoring (Sentry etc.) | ❌ |
| Logging (no PII in client logs) | ⚠️ console.error in prod |
| SEO metadata | ❌ |
| Accessibility audit | ❌ |
| Unit / E2E tests | ❌ |
| CI pipeline (lint, build, test) | ❌ |
| Bundle size budget | ❌ |
| Dependency audit clean | ❌ |
| Static assets complete | ❌ |
| Legal pages (terms, privacy) | ✅ Present |
| Analytics | ✅ Vercel Analytics |
| TypeScript strict mode | ✅ Enabled |
| `.gitignore` for env files | ✅ |

---

## Architecture & Maintainability

### Strengths
- Clear folder structure (`app/`, `components/`, `lib/`, `context/`)
- Central API module with typed responses
- Shared UI via shadcn/ui pattern
- Consistent design language (Oswald headings, primary color)

### Gaps
- **No hooks folder** despite `components.json` alias for `@/hooks`
- **No shared auth context** — admin session logic duplicated in 4 files
- **No shared `useAdminSession` hook**
- **Client/server boundary** not leveraged — everything is client-heavy
- **API layer incomplete** — order fetch duplicated inline

### Recommended refactors

1. **`lib/auth/admin-session.ts`** — single source for admin session read/write/clear
2. **`hooks/use-admin-session.ts`** — redirect if unauthenticated
3. **`components/admin/admin-shell.tsx`** — sidebar layout
4. **`lib/validators.ts`** — Zod schemas for checkout, admin forms
5. **`components/safe-image.tsx`** — fallback for broken images

---

## Accessibility (a11y)

| Issue | Location |
|---|---|
| Wishlist/heart buttons have no `aria-label` | `jersey-card.tsx` |
| Icon-only cart button lacks accessible name | `cart-sheet.tsx` |
| Form inputs missing `htmlFor` ↔ `id` associations | checkout, admin login |
| Color contrast on muted text | review with WCAG tool |
| Keyboard trap in mobile nav | test focus management |
| Loading states not announced to screen readers | add `aria-live="polite"` regions |
| Delete jersey dialog | ✅ Uses AlertDialog (good) |

---

## Testing & CI Gaps

**Current state:** No tests, no CI config in frontend.

**Minimum recommended test suite:**

```
tests/
├── e2e/
│   ├── checkout-flow.spec.ts      # add to cart → checkout → razorpay mock
│   ├── admin-login.spec.ts
│   └── order-download.spec.ts
├── unit/
│   ├── cart-context.test.ts
│   ├── api.test.ts
│   └── validators.test.ts
```

**CI pipeline:**
```yaml
- pnpm install --frozen-lockfile
- pnpm lint
- pnpm build
- pnpm test
- npm audit --audit-level=high
```

---

## Dependency & Supply Chain

| Package | Issue |
|---|---|
| `next@16.0.10` | Multiple CVEs — upgrade urgently |
| `postcss` (via next) | Moderate XSS advisory |
| `recharts@2.15.4` | Deprecated branch, unused |
| 20+ `@radix-ui/*` | Many unused — prune |
| `framer-motion` | Large bundle — use selectively |
| Dual lockfiles | Pick pnpm OR npm |

**Unused but installed (candidates for removal):**
- `recharts`, `sonner`, `react-hook-form`, `@hookform/resolvers` (unless planning forms refactor)
- Many radix packages with no corresponding `components/ui/*` file

---

## What's Already Good

These are genuine strengths — preserve them during refactors:

1. **TypeScript strict mode enabled** — strong foundation for safe refactors
2. **Centralized API client (`lib/api.ts`)** with custom `ApiError` class and typed responses
3. **Typed domain models (`lib/types.ts`)** aligned with backend schemas
4. **Cart SSR safety** — guards `typeof window`, hydration flag (`isHydrated`), graceful localStorage fallback
5. **Checkout terms checkbox** — legal consent before payment
6. **Server-authoritative pricing on order creation** — client sends only `jerseyId` + `quantity`, not prices
7. **Payment verification flow** — calls backend `/payments/verify` with Razorpay signature (don't trust client-only)
8. **Presigned download URLs** — frontend requests short-lived URL from backend, doesn't expose R2 keys
9. **Admin 401 handling** — dashboard clears session and redirects on auth failure
10. **Rate limiting awareness** — backend limits order creation; frontend should surface 429 errors gracefully
11. **shadcn/ui component quality** — AlertDialog for destructive delete, Sheet for cart, toast notifications
12. **Loading skeletons** — good UX on jerseys, categories, trending sections
13. **Pagination** on `/jerseys` page
14. **`.gitignore` properly excludes** `.env*` and secrets
15. **Vercel Analytics** integrated for production observability
16. **Responsive design** — mobile nav, grid layouts, sticky checkout summary
17. **Digital product UX** — clear messaging about download delivery, file formats, non-refund policy
18. **Privacy policy & terms pages** exist with structured content
19. **Image remote patterns configured** (just need tightening, not absent)
20. **Razorpay lazy script loading** — only loads checkout SDK when needed
21. **Admin file upload UX** — shows file name and size for design/preview uploads
22. **Order retry payment** — order status page allows paying pending orders
23. **eslint-config-next** with core-web-vitals rules configured

---

## Summary Priority Matrix

| Priority | Action | Effort |
|---|---|---|
| P0 | Upgrade Next.js | Low |
| P0 | Fix Razorpay amount + clearCart bug | Low |
| P0 | Add missing static assets | Low |
| P0 | Secure admin auth (cookies + middleware) | Medium |
| P0 | Add security headers / CSP | Medium |
| P1 | Move order email to POST body | Low |
| P1 | Admin layout separation | Low |
| P1 | Zod form validation | Medium |
| P1 | error.tsx / loading.tsx | Low |
| P2 | Server Components for catalog | Medium |
| P2 | SEO metadata | Medium |
| P2 | Remove dead code & unused deps | Low |
| P2 | E2E tests for checkout | High |
| P3 | Full a11y audit | Medium |
| P3 | Newsletter integration | Medium |

---

*This report was generated from a full read-through of the frontend codebase. Backend security (JWT implementation, CORS, rate limits) complements but is outside this document's scope — several frontend fixes (cookie auth, POST order lookup) require coordinated backend changes.*

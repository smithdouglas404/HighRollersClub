# HARDCODED VALUES AUDIT — HighRollersClub

**Date:** 2026-04-05  
**Severity:** This is a real-money poker platform. Every item below is a liability.

---

## EMERGENCY: EXPOSED SECRETS IN GIT HISTORY

### 1. Alchemy API Key Hardcoded in Source
**File:** `contracts/hardhat.config.ts:4,20`
```
https://polygon-mainnet.g.alchemy.com/v2/oYq5cymBhdX5N-HCNydIx
https://polygon-amoy.g.alchemy.com/v2/oYq5cymBhdX5N-HCNydIx
```
**Risk:** Anyone with repo access can use this key to make blockchain calls or exhaust your quota.
**Fix:** Remove fallback URLs entirely. Require `POLYGON_RPC_URL` env var. Fail hard if missing. Rotate this API key immediately.

### 2. Private Wallet Key in Settings History
**File:** `.claude/settings.local.json:239`
```
POLYGON_WALLET_KEY=0x513adffc4f36fb094944638d7bfa1b358eeb4c6c37a7c22dc41765b9227538c6
```
**Risk:** This is a private key in plaintext in the repo. Anyone can drain the wallet.
**Fix:** Rotate this wallet key IMMEDIATELY. Use `git filter-repo` or BFG to scrub from history. Add `.claude/settings.local.json` to `.gitignore`.

### 3. Dummy Private Key Fallback
**File:** `contracts/hardhat.config.ts:5`
```
const DEPLOYER_KEY = process.env.POLYGON_WALLET_KEY || "0x000...0001"
```
**Fix:** No fallback. Fail hard if missing.

### 4. VRF Coordinator/Key Hash Fallbacks
**File:** `contracts/scripts/deploy.ts:16,19`
```
VRF_COORDINATOR || "0xec0Ed46f36576541C75739E915ADbCb3DE24bD77"
VRF_KEY_HASH || "0x719ed7d7664abc3001c18aac8130a2265e1e70b7e036ae20f3ca8b92b3154d86"
```
**Fix:** No fallback. Require env vars. Wrong address = wrong chain = lost funds.

---

## CRITICAL: DUPLICATED TIER CONFIGS (Single Source of Truth Violations)

The central `TIER_DEFINITIONS` exists in `server/routes.ts:141-260`. But **5 route files duplicate these values independently**. If you update one, the others are wrong.

### 5. Daily Bonus — Duplicated
**Source of truth:** `server/routes.ts` (lines 149,171,194,218,242)
**Duplicate:** `server/routes/wallet-routes.ts:6-8`
```typescript
const TIER_DAILY_BONUS: Record<string, number> = {
  free: 500, bronze: 1000, silver: 2500, gold: 5000, platinum: 10000,
};
```
**Fix:** Import from central config. Delete duplicate.

### 6. Deposit Limits — Duplicated
**Source of truth:** `server/routes.ts` depositLimitDaily per tier
**Duplicate:** `server/routes/wallet-routes.ts:9-11`
```typescript
const TIER_DEPOSIT_LIMIT_DAILY: Record<string, number> = {
  free: 0, bronze: 20000, silver: 100000, gold: 500000, platinum: 2500000,
};
```
**Risk:** CRITICAL — real money. If these diverge, deposits bypass limits.
**Fix:** Import from central config. Delete duplicate.

### 7. Withdrawal Limits — Duplicated
**Source of truth:** `server/routes.ts` withdrawLimitWeekly per tier
**Duplicate:** `server/routes/wallet-routes.ts:12-14`
```typescript
const TIER_WITHDRAW_LIMIT_WEEKLY: Record<string, number> = {
  free: 0, bronze: 50000, silver: 250000, gold: 1000000, platinum: 5000000,
};
```
**Risk:** CRITICAL — real money.
**Fix:** Import from central config. Delete duplicate.

### 8. Max Big Blind (Stake Limits) — Duplicated
**Source of truth:** `server/routes.ts` maxBigBlind per tier
**Duplicate:** `server/routes/game-routes.ts:103-105`
```typescript
const TIER_MAX_BIG_BLIND: Record<string, number> = {
  free: 0, bronze: 10, silver: 50, gold: 400, platinum: 0,
};
```
**Fix:** Import from central config. Delete duplicate.

### 9. Tournament Buy-In Max — Duplicated
**Source of truth:** `server/routes.ts` tournamentBuyInMax per tier
**Duplicate:** `server/routes/tournament-routes.ts:112-114`
```typescript
const TIER_TOURNAMENT_BUYIN_MAX: Record<string, number> = {
  free: 0, bronze: 2500, silver: 20000, gold: 0, platinum: 0,
};
```
**Fix:** Import from central config. Delete duplicate.

### 10. Club Creation/Member Limits — Duplicated
**Source of truth:** `server/routes.ts` clubCreateLimit/clubMemberLimit per tier
**Duplicate:** `server/routes/club-routes.ts:366-371`
```typescript
const TIER_CLUB_CREATE_LIMIT: Record<string, number> = { ... };
const TIER_CLUB_MEMBER_LIMIT: Record<string, number> = { ... };
```
**Fix:** Import from central config. Delete duplicate.

---

## CRITICAL: MULTI-TABLE LIMIT NOT ENFORCED

### 11. Client Hardcoded to 4
**File:** `client/src/pages/MultiTable.tsx:235,350`
```typescript
if (tables.length >= 4) return;  // Line 235
{tables.length < 4 && (          // Line 350
```
**What it should be:** Free=1, Bronze=1, Silver=4, Gold=4, Platinum=8 (from TIER_DEFINITIONS)
**Fix:** Fetch user's `multiTableLimit` from server. Replace hardcoded `4`.

### 12. Server Has No Multi-Table Enforcement
**File:** No enforcement found in `game-routes.ts`, `websocket.ts`, or `table-manager.ts`
**Risk:** CRITICAL — any user can join unlimited tables regardless of tier.
**Fix:** Add server-side check in table join logic: count user's active tables, compare against `getTierDef(tier).multiTableLimit`.

---

## CRITICAL: RAKEBACK NOT TIER-BASED IN ADMIN PROCESSING

### 13. Admin Rakeback Defaults to Flat 20%
**File:** `server/routes/admin-routes.ts:245`
```typescript
const { rakebackPercent = 20, days = 7 } = req.body;
```
**File:** `server/routes/admin-platform-routes.ts:224`
```typescript
const { rakebackPercent = 20, days = 7 } = req.body;
```
**File:** `client/src/pages/AdminDashboard.tsx:432`
```typescript
body: JSON.stringify({ rakebackPercent: 20, days: 7 }),
```
**What it should be:** Free=0%, Bronze=0%, Silver=10%, Gold=20%, Platinum=30%
**Fix:** Remove `rakebackPercent` from admin input. Process rakeback per-user using their tier's `rakebackPercent` from TIER_DEFINITIONS. Admin should only trigger the job, not set the rate.

---

## CRITICAL: HARDCODED STARTING CHIP BALANCE

### 14. 10,000 Chips Hardcoded in 3 Places
**File:** `server/auth.ts:199,270,488`
```typescript
chipBalance: 10000,  // Guest signup
chipBalance: 10000,  // Member registration
chipBalance: 10000,  // Firebase auth sync
```
**Fix:** Move to TIER_DEFINITIONS or env var `INITIAL_CHIP_BALANCE`. Must be consistent.

---

## CRITICAL: LOTTERY SNG MULTIPLIER TABLE

### 15. Multiplier Weights Hardcoded
**File:** `server/game/lottery-sng-lifecycle.ts:14-22`
```typescript
export const MULTIPLIER_TABLE = [
  { multiplier: 2, weight: 7500 },    // 75%
  { multiplier: 3, weight: 1200 },    // 12%
  { multiplier: 5, weight: 800 },     // 8%
  { multiplier: 10, weight: 300 },    // 3%
  { multiplier: 25, weight: 150 },    // 1.5%
  { multiplier: 100, weight: 40 },    // 0.4%
  { multiplier: 1000, weight: 10 },   // 0.1%
];
```
**Risk:** Gambling regulations require audit trails for RNG configuration changes. Hardcoded = no audit trail.
**Fix:** Move to database `lottery_config` table with versioning and admin audit log.

### 16. Lottery Buy-In Tiers Hardcoded
**File:** `server/game/lottery-sng-lifecycle.ts:27`
```typescript
[100, 250, 500, 1000, 2500, 5000]
```
**Fix:** Move to database or platform_settings.

---

## HIGH: PAYMENT VALUES

### 17. Chip-to-Currency Ratio Hardcoded (1 chip = 1 cent)
**File:** `server/payments/payment-service.ts:100`
```typescript
const chipAmount = amountCents; // 1 cent = 1 chip (configurable)
```
**File:** `server/payments/payment-service.ts:289`
```typescript
let amountFiat = chipAmount; // 1 chip = 1 cent by default
```
Comment says "configurable" but NO CONFIG EXISTS.
**Fix:** Create `platform_settings.chips_per_usd_cent` in database.

### 18. Confirmation Counts Hardcoded
**File:** `server/payments/direct-wallet-gateway.ts:31-36`
```typescript
const CONFIRMATIONS = { BTC: 3, ETH: 12, USDT: 12, SOL: 1 };
```
**File:** `server/payments/payment-service.ts:129` (same logic inline)
**Fix:** Move to database `supported_currencies` table.

### 19. Payment Expiry Hardcoded (1 hour)
**File:** `server/payments/direct-wallet-gateway.ts:59`
```typescript
expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
```
**Fix:** Move to env var `PAYMENT_EXPIRY_MINUTES`.

### 20. Stripe Webhook Tolerance Hardcoded (300 seconds)
**File:** `server/payments/stripe-gateway.ts:312`
```typescript
if (timestampAge > 300) { throw new Error("Stripe webhook timestamp too old"); }
```
**Fix:** Move to env var `STRIPE_WEBHOOK_TOLERANCE_SECONDS`.

### 21. Marketplace Fee Hardcoded (2.9% / 2.0%)
**File:** `server/routes/marketplace-routes.ts:174`
```typescript
const feePercent = tierRank(user.tier) >= tierRank("platinum") ? 0.02 : 0.029;
```
**Fix:** Store in TIER_DEFINITIONS as `marketplaceFeePercent`. Currently tier-based but hardcoded.

### 22. Premium Subscription Cost Hardcoded
**File:** `server/routes/wallet-routes.ts:519-520`
```typescript
const PREMIUM_COST_CHIPS = 5000;
const PREMIUM_DURATION_MS = 30 * 24 * 60 * 60 * 1000;
```
**Fix:** Move to database `platform_settings`.

---

## HIGH: LOCALHOST FALLBACKS STILL IN PAYMENT CODE

### 23. Stripe Gateway Localhost Fallback (Dev Only)
**File:** `server/payments/stripe-gateway.ts:115,126`
```typescript
|| (process.env.NODE_ENV === "production" ? (() => { throw ... })() : "http://localhost:5000");
```
**Status:** Throws in production (GOOD), but localhost fallback still exists for dev.
**Concern:** If `NODE_ENV` is accidentally unset in production, localhost is used.
**Fix:** Throw in ALL environments if `WEBHOOK_BASE_URL` is missing. Dev should set it too.

### 24. Payment Service Localhost Fallback
**File:** `server/payments/payment-service.ts:466`
Same pattern. Same fix.

---

## HIGH: TOURNAMENT SCHEDULE HARDCODED

### 25. Daily Tournament Schedule
**File:** `server/scheduler.ts:18-22`
```typescript
const DEFAULT_SCHEDULE = [
  { name: "Morning Freeroll",    buyIn: 0,    startingChips: 1000,  maxPlayers: 50 },
  { name: "Afternoon Grind",     buyIn: 500,  startingChips: 5000,  maxPlayers: 30 },
  { name: "Evening Main Event",  buyIn: 2000, startingChips: 10000, maxPlayers: 100 },
  { name: "Late Night Turbo",    buyIn: 1000, startingChips: 3000,  maxPlayers: 20 },
];
```
**Fix:** Move to database `scheduled_tournaments` table. Admin-configurable.

---

## HIGH: SHOP ITEMS ALL HAVE NULL IMAGES

### 26. All 39 Seed Items Have imageUrl: null
**File:** `server/seed.ts:42-105`
Every single shop item has `imageUrl: null`. Shop renders items with no images.
**Fix:** Add actual image URLs or remove items until images exist.

---

## HIGH: CLUB MEMBER LIMIT NOT ENFORCED

### 27. No Check on Club Join
**File:** `server/routes/club-routes.ts` — join and accept-invitation flows
When a user joins a club (public join or invitation accept), the code does NOT check if the club has exceeded its `clubMemberLimit`.
**Fix:** Add check: count current members, compare against `getTierDef(ownerTier).clubMemberLimit`.

---

## MEDIUM: BLIND SCHEDULE PRESETS HARDCODED

### 28. Four Blind Schedules with ~100 Values
**File:** `server/game/blind-presets.ts`
Standard, Turbo, Hyper-Turbo, and MTT blind schedules are all hardcoded arrays.
**Fix:** Move to database for admin configurability.

---

## MEDIUM: SESSION SECRET STILL WARN-ONLY

### 29. No Throw in Production
**File:** `server/auth.ts:88-91`
```typescript
if (!s || s === "poker-platform-dev-secret-change-me-in-prod") {
  console.warn("[SECURITY] SESSION_SECRET not set or using default...");
}
return s || require("crypto").randomBytes(32).toString("hex");
```
**Fix:** Throw in production if SESSION_SECRET is missing or is the default string.

---

## MEDIUM: GEOFENCE USES HTTP (NOT HTTPS)

### 30. IP-API Free Tier is HTTP Only
**File:** `server/middleware/geofence.ts:42` (approx)
Uses `http://ip-api.com` — geolocation data sent unencrypted.
**Fix:** Upgrade to ip-api pro (HTTPS) or switch to a provider with free HTTPS.

---

## MEDIUM: HARDCODED LEGAL PAGE DATES

### 31. Privacy/Terms Last-Updated Dates
**File:** `client/src/pages/Privacy.tsx:4`, `client/src/pages/Terms.tsx:4`
```typescript
const LAST_UPDATED = "April 1, 2026";
```
**Fix:** Pull from database or a config file that legal team can update.

---

## MEDIUM: ADMIN LEDGER ROUNDING TOLERANCE

### 32. 1-Chip Tolerance Hardcoded
**File:** `server/routes/admin-routes.ts:220`
```typescript
const healthy = Math.abs(discrepancy) <= 1;
```
At high stakes, 1 chip could be significant. Should be configurable.

---

## SUMMARY: ACTION ITEMS BY PRIORITY

### IMMEDIATE (Do Today)
| # | Item | Risk |
|---|------|------|
| 1 | Rotate Alchemy API key, remove from hardhat.config.ts | CRITICAL — exposed secret |
| 2 | Rotate wallet private key, scrub from git history | CRITICAL — wallet drain risk |
| 3 | Remove VRF coordinator/key hash fallbacks | CRITICAL — wrong chain = lost funds |
| 4 | Remove hardhat dummy private key fallback | CRITICAL |

### THIS WEEK (Consolidate Tier Config)
| # | Item | Risk |
|---|------|------|
| 5-10 | Export TIER_DEFINITIONS from central module, delete 5 duplicate configs | CRITICAL — divergence = bypass |
| 11-12 | Enforce multi-table limit server-side + make client tier-aware | CRITICAL — no enforcement |
| 13 | Make rakeback processing per-user-tier, not flat 20% | HIGH |
| 14 | Move starting chips to config | HIGH |
| 27 | Enforce club member limits on join | HIGH |

### THIS SPRINT (Financial Config)
| # | Item | Risk |
|---|------|------|
| 15-16 | Move lottery multiplier table to database with audit trail | CRITICAL — gambling regulation |
| 17 | Make chip-to-currency ratio configurable | HIGH |
| 18 | Move crypto confirmation counts to database | HIGH |
| 21 | Move marketplace fees to tier config | HIGH |
| 22 | Move premium subscription cost to database | HIGH |
| 23-24 | Remove localhost fallbacks entirely | HIGH |
| 25 | Move tournament schedule to database | HIGH |
| 29 | Make SESSION_SECRET throw in production | HIGH |

### NEXT SPRINT (Polish)
| # | Item | Risk |
|---|------|------|
| 19-20 | Move payment expiry and webhook tolerance to env vars | MEDIUM |
| 26 | Add shop item images or remove imageless items | MEDIUM |
| 28 | Move blind presets to database | MEDIUM |
| 30-32 | Fix geofence HTTPS, legal dates, ledger tolerance | MEDIUM |

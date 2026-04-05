# HighRollersClub — Subscription, KYC & Monetization Model

**Date:** 2026-04-05  
**Purpose:** Redesign the tier/subscription/KYC structure to maximize value delivery, regulatory compliance, and revenue

---

## The Problem with the Current Model

| Issue | Detail |
|-------|--------|
| **KYC is tier-gated, not risk-gated** | KYC only required at Gold ($15k chips). A player can deposit real money via Stripe/crypto at Free tier with zero identity verification |
| **Tiers are one-time chip purchases, not subscriptions** | Player pays 50k chips for Platinum once, gets forever access. No recurring revenue |
| **Premium is separate from tiers** | Two overlapping systems (tiers + premium subscription) confuse users. Which one do I need? |
| **Free tier gets almost everything** | Cash games, video chat, AI commentary, analytics, clubs — all free. Very little incentive to upgrade |
| **No deposit/withdrawal limits tied to KYC** | A completely unverified user can deposit and withdraw unlimited amounts |
| **No anti-fraud gate on real money** | Guest accounts with zero verification can make crypto deposits |

---

## Proposed Model: Unified Tiers with Progressive KYC

### Design Principles
1. **KYC follows the money, not the features** — verify identity based on financial risk, not gameplay access
2. **Everyone plays for free** — never gate basic poker behind payment
3. **Pay for power, not permission** — subscriptions unlock premium tools, not basic access
4. **Progressive verification** — each KYC level unlocks higher financial limits
5. **One system, not two** — merge tiers + premium into a single clear structure

---

## Tier Structure

### FREE — Play & Learn
**Cost:** $0  
**KYC:** Email verification only (Didit email + IP analysis, ~$0.03)

| Category | What You Get |
|----------|-------------|
| **Play** | Cash games (play chips only), practice mode, bot tables |
| **Social** | Join clubs, club chat, emotes, video chat at table |
| **Stats** | Basic stats (hands played, win rate, best streak) |
| **Cosmetics** | 5 starter avatars, default table theme, dye shop |
| **Tournaments** | Freeroll tournaments only (0 buy-in) |
| **Limits** | 10,000 starting chips, no real-money deposit/withdrawal |

**Why it works:** Players can fully experience the game. They'll naturally want more when they see premium avatars, advanced stats, and real-money tables.

---

### BRONZE — $4.99/month (or $47.99/year)
**KYC:** Passive liveness + face match (Didit, ~$0.18)

| Category | What You Get |
|----------|-------------|
| **Everything in Free** | + |
| **Real Money** | Deposit up to **$200/day**, withdraw up to **$500/week** |
| **Play** | Real-money cash games (micro stakes: up to 5/10 blinds) |
| **Tournaments** | SNG + tournaments up to $25 buy-in |
| **Coaching** | AI hand analysis (free), live coaching overlay (included, no per-hand fee) |
| **Stats** | Session analytics, win/loss graphs, position breakdown |
| **Cosmetics** | Unlock rare avatars in shop, 1 free avatar/month |
| **Social** | Create 1 club (up to 25 members) |
| **Replay** | Hand replay + sharing |

**Deposit limit rationale:** $200/day = ~$6,000/month max. Low enough to not require full KYC under most jurisdictions. Passive liveness confirms a real human, not a bot farm.

---

### SILVER — $14.99/month (or $143.99/year)
**KYC:** Phone verification + age estimation (Didit, ~$0.32)

| Category | What You Get |
|----------|-------------|
| **Everything in Bronze** | + |
| **Real Money** | Deposit up to **$1,000/day**, withdraw up to **$2,500/week** |
| **Play** | Mid-stakes cash games (up to 25/50 blinds) |
| **Tournaments** | Tournaments up to $200 buy-in, guaranteed prize pools |
| **Multi-Table** | Play up to 4 tables simultaneously |
| **Staking** | Back players or get backed in tournaments |
| **Cosmetics** | Unlock epic avatars, custom card backs, table themes |
| **Social** | Create up to 3 clubs (up to 100 members each) |
| **Marketplace** | Buy items on marketplace |
| **Insurance** | All-in equity insurance (1% fee) |
| **Run It Twice** | Enabled |
| **Rakeback** | 10% rakeback (credited weekly to bonus wallet) |

**Why Silver is the sweet spot:** This is where most serious recreational players land. Multi-table, staking, insurance, and run-it-twice are the features that keep grinders engaged.

---

### GOLD — $29.99/month (or $287.99/year)
**KYC:** Full KYC — ID verification + proof of address + AML screening (Didit, ~$0.87)

| Category | What You Get |
|----------|-------------|
| **Everything in Silver** | + |
| **Real Money** | Deposit up to **$5,000/day**, withdraw up to **$10,000/week** |
| **Play** | High-stakes cash games (up to 200/400 blinds) |
| **Tournaments** | Unlimited buy-in tournaments, host tournaments with custom rake |
| **Clubs** | Create up to 5 clubs (up to 500 members), club wars, league creation |
| **Marketplace** | Sell items on marketplace (10% platform fee → reduced to 5%) |
| **Cosmetics** | Unlock legendary avatars, premium table themes, 3D full-body avatars |
| **Analytics** | Advanced analytics: VPIP/PFR breakdown, leak detection, coaching reports |
| **Commentary** | AI commentary with premium voices |
| **Rakeback** | 20% rakeback |
| **Priority** | Priority table seating, tournament early registration |
| **Blockchain** | On-chain hand verification, provably fair proof downloads |
| **Support** | Priority support (24-hour response) |

**Why Gold requires full KYC:** At $5k/day deposits and high-stakes play, regulations in most jurisdictions require identity verification, AML screening, and proof of address. This is non-negotiable for a real-money platform.

---

### PLATINUM — $79.99/month (or $767.99/year)
**KYC:** Enhanced KYC — NFC passport + active liveness + biometric auth + database validation (Didit, ~$1.37)

| Category | What You Get |
|----------|-------------|
| **Everything in Gold** | + |
| **Real Money** | Deposit up to **$25,000/day**, withdraw up to **$50,000/week** |
| **Play** | Nosebleed stakes (unlimited), premium VIP tables with full-body 3D |
| **Tournaments** | VIP-only invitational tournaments, private high-roller events |
| **Marketplace** | Reduced platform fee (2.5%), exclusive 1/1 marketplace listings |
| **Cosmetics** | Mythic avatars, exclusive card backs, animated table themes |
| **Rakeback** | 30% rakeback |
| **API** | API access for hand history export, stat integration |
| **Concierge** | Dedicated VIP manager, same-day support |
| **Bonuses** | 2x daily bonus, monthly chip grant (10,000 chips) |
| **Ad-Free** | Complete ad-free experience |
| **Blockchain** | Full blockchain dashboard access, settlement verification |

**Why Enhanced KYC:** At $25k/day, this is high-roller territory. NFC passport verification and active liveness prevent identity fraud. Biometric auth adds ongoing security. Database validation cross-references PEP/sanctions lists.

---

## KYC-to-Limit Mapping (The Key Table)

| Tier | KYC Level | Didit Features | Cost | Deposit Limit | Withdraw Limit | Max Stakes |
|------|-----------|----------------|------|--------------|----------------|------------|
| Free | Email only | Email + IP analysis | ~$0.03 | $0 (play chips only) | $0 | Play chips only |
| Bronze | Basic identity | + Passive liveness + face match | ~$0.18 | $200/day | $500/week | Micro (5/10) |
| Silver | Phone + age | + Phone verification + age estimation | ~$0.32 | $1,000/day | $2,500/week | Mid (25/50) |
| Gold | Full KYC | + ID verification + proof of address + AML | ~$0.87 | $5,000/day | $10,000/week | High (200/400) |
| Platinum | Enhanced | + NFC passport + active liveness + biometric + DB validation | ~$1.37 | $25,000/day | $50,000/week | Unlimited |

---

## Revenue Model

### Subscription Revenue (Monthly Recurring)

| Tier | Monthly | Yearly | Break-Even Players |
|------|---------|--------|-------------------|
| Bronze | $4.99 | $47.99 | — |
| Silver | $14.99 | $143.99 | — |
| Gold | $29.99 | $287.99 | — |
| Platinum | $79.99 | $767.99 | — |

**Yearly discount:** ~20% (incentivizes annual commitment)

### Rake Revenue

| Tier | Rake Rate | Rakeback | Net Rake to House |
|------|-----------|----------|-------------------|
| Free | 5% (play chips only) | 0% | 5% |
| Bronze | 5% | 0% | 5% |
| Silver | 5% | 10% | 4.5% |
| Gold | 5% | 20% | 4% |
| Platinum | 5% | 30% | 3.5% |

### Other Revenue Streams

| Stream | Rate | Notes |
|--------|------|-------|
| Marketplace fees | 10% (Gold: 5%, Platinum: 2.5%) | On every item sold |
| Tournament admin fees | 5-10% (configurable) | Host-set fee on tournament buy-ins |
| Insurance fees | 1% of equity cash-out | On every insurance purchase |
| Cosmetic shop | Variable (500-10,000 chips) | Pure margin on digital goods |

---

## Feature Unlock Matrix

| Feature | Free | Bronze | Silver | Gold | Platinum |
|---------|------|--------|--------|------|----------|
| Cash games (play chips) | Y | Y | Y | Y | Y |
| Cash games (real money) | — | Micro | Mid | High | Unlimited |
| Freeroll tournaments | Y | Y | Y | Y | Y |
| Paid tournaments | — | $25 max | $200 max | Unlimited | Unlimited + VIP |
| Practice mode / bots | Y | Y | Y | Y | Y |
| Join clubs | Y | Y | Y | Y | Y |
| Create clubs | — | 1 (25 members) | 3 (100 members) | 5 (500 members) | Unlimited |
| Club wars | — | — | Y | Y | Y |
| Leagues/alliances | — | — | Y | Y + create | Y + create |
| Multi-table | — | — | 4 tables | 4 tables | 8 tables |
| Hand replay | — | Y | Y | Y | Y |
| Share replays | — | Y | Y | Y | Y |
| Basic stats | Y | Y | Y | Y | Y |
| Advanced analytics | — | — | — | Y | Y |
| AI hand analysis | — | Y | Y | Y | Y |
| Live coaching | — | Y | Y | Y | Y |
| AI commentary | — | — | Y | Y + premium voices | Y + premium voices |
| Insurance | — | — | Y | Y | Y |
| Run it twice | — | — | Y | Y | Y |
| Staking | — | — | Y | Y | Y |
| Marketplace buy | — | — | Y | Y | Y |
| Marketplace sell | — | — | — | Y (5% fee) | Y (2.5% fee) |
| Video chat | Y | Y | Y | Y | Y |
| Emotes/taunts | Basic | Full | Full | Full + premium | Full + premium |
| Avatars | 5 starter | + Rare tier | + Epic tier | + Legendary tier | + Mythic tier |
| Table themes | Default | Standard | Standard + custom | Premium themes | Animated themes |
| Dye shop | Y | Y | Y | Y | Y |
| Blockchain verification | — | — | — | Y | Y + dashboard |
| API access | — | — | — | — | Y |
| Rakeback | 0% | 0% | 10% | 20% | 30% |
| Priority seating | — | — | — | Y | Y |
| Support | Community | Email (72hr) | Email (48hr) | Priority (24hr) | Concierge (same-day) |
| Daily bonus | 500 chips | 1,000 chips | 2,500 chips | 5,000 chips | 10,000 chips |

---

## Why This Works

### For Players
- **Free is genuinely free** — full poker experience with play chips, social features, video chat
- **Clear value at every tier** — each step up unlocks meaningful features, not just higher limits
- **KYC feels natural** — "verify to unlock higher stakes" makes sense to players (like leveling up)
- **No feature confusion** — one system, one upgrade path, one subscription

### For the Business
- **Recurring revenue** — monthly subscriptions instead of one-time chip purchases
- **KYC scales with risk** — cheapest verification for lowest risk, expensive verification only for whales
- **Rake + subscriptions** — two revenue streams that compound (more engaged players = more rake)
- **Regulatory compliance** — KYC levels map directly to financial risk thresholds
- **Retention hooks** — rakeback, daily bonuses, and cosmetics create daily engagement

### For Compliance
- **No unverified real-money** — Free tier is play-chips only, zero regulatory exposure
- **Progressive KYC matches FATF guidelines** — risk-based approach, not one-size-fits-all
- **AML screening at Gold** — catches PEPs and sanctioned individuals before high-value transactions
- **Enhanced due diligence at Platinum** — NFC passport + biometric for highest-risk accounts
- **Deposit/withdrawal limits enforce verification** — can't move money without matching KYC level
- **Self-exclusion and responsible gambling** — available at all tiers (regulatory requirement)
- **Geofencing** — jurisdiction blocking at infrastructure level

---

## Implementation Priority

### Phase 1 — Foundation (Week 1-2)
1. Merge tiers + premium into single subscription system
2. Implement deposit/withdrawal limits per tier (server-side enforcement)
3. Gate real-money deposits behind Bronze+ (minimum passive liveness)
4. Add Didit SDK integration for email verification (Free tier)
5. Update Wallet.tsx to show tier limits and upgrade prompts

### Phase 2 — Identity (Week 3-4)
6. Integrate Didit passive liveness + face match (Bronze)
7. Integrate Didit phone verification + age estimation (Silver)
8. Integrate Didit full KYC — ID + PoA + AML (Gold)
9. Integrate Didit enhanced KYC — NFC + biometric (Platinum)
10. Build KYC status dashboard showing verification progress

### Phase 3 — Subscription Billing (Week 5-6)
11. Implement Stripe subscription billing (monthly + annual plans)
12. Add subscription management UI (upgrade, downgrade, cancel)
13. Implement grace period for expired subscriptions (7 days)
14. Add rakeback processing tied to subscription tier
15. Implement daily bonus system tied to tier

### Phase 4 — Feature Gating (Week 7-8)
16. Gate tournament buy-ins by tier
17. Gate table stakes by tier
18. Gate club creation limits by tier
19. Gate marketplace sell by tier
20. Gate multi-table by tier
21. Update all UI to show locked features with upgrade prompts

---

## Didit Integration Architecture

```
User Registration (Free)
  └── Didit: Email verification + IP analysis ($0.03)
       └── Result: email_verified = true
       └── Unlocks: Play-chip games, clubs, basic features

Upgrade to Bronze ($4.99/mo)
  └── Didit: Passive liveness + face match ($0.18)
       └── Result: kyc_level = "basic"
       └── Unlocks: Real-money micro-stakes, $200/day deposit

Upgrade to Silver ($14.99/mo)
  └── Didit: + Phone verification + age estimation ($0.32)
       └── Result: kyc_level = "standard"
       └── Unlocks: Mid-stakes, $1,000/day deposit

Upgrade to Gold ($29.99/mo)
  └── Didit: + ID verification + proof of address + AML ($0.87)
       └── Result: kyc_level = "full"
       └── Unlocks: High-stakes, $5,000/day deposit

Upgrade to Platinum ($79.99/mo)
  └── Didit: + NFC passport + active liveness + biometric + DB ($1.37)
       └── Result: kyc_level = "enhanced"
       └── Unlocks: Unlimited stakes, $25,000/day deposit
```

Each KYC level is incremental — Silver doesn't re-do Bronze checks, it adds phone + age on top of existing liveness verification.

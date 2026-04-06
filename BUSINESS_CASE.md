# Sanctum — Investment Business Case

**Confidential | April 2026**

---

## 1. Executive Summary

Sanctum is a blockchain-verified, community-first online poker platform that combines the social dynamics of club-based poker with the transparency of provably fair gaming and the accessibility of cryptocurrency payments.

The global online poker market is valued at $8.2B (2025) and growing at 11.5% CAGR. The crypto gambling market exceeds $50B in annual wagers. Yet no platform credibly combines club ownership, provably fair gameplay, multi-currency support, and progressive identity verification in a single product.

Sanctum fills this gap. Club owners run their own poker rooms on our infrastructure — setting their own rake, inviting their communities, and monetizing their player base. Every hand is cryptographically committed to the Polygon blockchain before cards are dealt, giving players verifiable proof that the deck wasn't manipulated. Players deposit via credit card, Bitcoin, Ethereum, Solana, or 200+ other cryptocurrencies.

**The platform is built.** The full-stack application includes a provably fair poker engine supporting 5 game variants, club management with wars and leagues, a 5-tier subscription model with progressive KYC, a loyalty program, an NFT marketplace, AI coaching, and real-time video chat at tables.

**The Ask:** $2.5M seed round to fund regulatory licensing, marketing launch, team expansion, and 18 months of runway.

---

## 2. Market Opportunity

### Online Poker Market
| Metric | Value | Source |
|--------|-------|--------|
| Global online poker market (2025) | $8.2B | Grand View Research |
| Projected market (2030) | $15.8B | Grand View Research |
| CAGR | 11.5% | Grand View Research |
| Global online poker players | ~120M | Statista |
| Mobile poker growth | +18% YoY | H2 Gambling Capital |

### Crypto Gambling Market
| Metric | Value | Source |
|--------|-------|--------|
| Total crypto wagers (2025 est.) | $50B+ | DappRadar / Dune Analytics |
| Crypto gambling market growth | +25% YoY | Chainalysis |
| Stake.com annual revenue (est.) | $2.5B+ | Industry estimates |
| Crypto poker specifically | Underserved | Minimal credible competition |

### Club Poker Market
| Metric | Value | Source |
|--------|-------|--------|
| PPPoker/ClubGG/PokerBros combined players | 5M+ | App store data |
| Club poker market growth | +30% YoY | Industry analysis |
| Average club revenue per month | $2,000-$50,000 | Operator data |
| Club model retention rate | 3x higher than open platforms | PPPoker investor data |

### The Convergence Opportunity
No existing platform sits at the intersection of all three markets. The poker player who wants crypto payments, provably fair games, AND a community club experience has no home today. Sanctum is that home.

---

## 3. The Problem

### Trust Is Broken in Online Poker
- **Ultimate Bet / Absolute Poker (2007-2008):** Insiders used "superuser" accounts to see opponents' cards. $50M+ stolen from players.
- **Full Tilt Poker (2011):** $440M in player funds misappropriated by executives. Players waited years for refunds.
- **Opaque RNG:** No major poker site lets players verify that the deck shuffle was fair. Players must trust the operator.
- **Black Friday (2011):** US DOJ seized PokerStars, Full Tilt, and Cereus. Players lost access to funds overnight.

### Platform Lock-In
- Traditional poker sites own the player relationship. Club hosts on PPPoker/ClubGG can lose their entire community if the platform bans them or changes terms.
- No portability of player data, reputation, or assets between platforms.
- Rake structures are dictated by the platform with no transparency.

### Payment Friction
- Traditional sites: bank wire (3-5 days), credit card (high decline rates), limited to USD/EUR.
- Crypto-native players have no legitimate, well-built poker option.
- Unbanked populations globally (~1.7B adults) are completely excluded.

---

## 4. Our Solution

### Sanctum: Where Every Hand Is Verified

**Provably Fair by Default**
Every hand uses a cryptographic commitment scheme:
1. Server commits to a shuffled deck (SHA-256 hash published before deal)
2. Players contribute entropy seeds
3. Chainlink VRF provides on-chain randomness
4. After showdown, server reveals the seed — players verify the hash matches
5. Hand proof committed to Polygon blockchain permanently

This is not a feature toggle. It's the architecture. Every hand, every table, every time.

**Club Marketplace**
Club owners are entrepreneurs on our platform:
- Create a club, set their own rake (0-10%), invite their community
- Earn revenue from rake, tournament admin fees, and membership growth
- Compete in club wars with ELO ratings
- Form alliances and leagues with other clubs
- Eventually: white-label their club as a standalone branded experience

**Crypto-Native, Fiat-Friendly**
- Deposit: Visa/Mastercard (Stripe), Bitcoin, Ethereum, Solana, USDT, and 200+ cryptocurrencies
- Withdraw: Same rails, admin-approved for AML compliance
- Multi-wallet system: Main, Cash Game, SNG, Tournament, Bonus wallets
- Progressive KYC: Play-chips free tier → full KYC at higher deposit limits

---

## 5. Product Overview

### Gameplay
| Feature | Status |
|---------|--------|
| Texas Hold'em (NL/PL/FL) | Built |
| Omaha (PLO, PLO5) | Built |
| Short Deck Hold'em | Built |
| Cash Games | Built |
| Sit & Go | Built |
| Multi-Table Tournaments | Built |
| Lottery SNG (Spin & Go) | Built |
| Fast-Fold (Rush) Poker | Built |
| Bomb Pot mode | Built |
| Run It Twice/Three | Built |
| All-In Insurance (equity cashout) | Built |

### Social & Clubs
| Feature | Status |
|---------|--------|
| Club creation with custom branding | Built |
| Member management (roles, invites, kick) | Built |
| Club wars (ELO-based competitive) | Built |
| Leagues & alliances | Built |
| Club chat (real-time WebSocket) | Built |
| Club tournaments | Built |
| Club leaderboards | Built |
| Club announcements & events | Built |
| Staking/backing system | Built |

### Economy
| Feature | Status |
|---------|--------|
| 5-tier subscription ($0-$79.99/mo) | Built |
| Loyalty program (10 levels, HRP points) | Built |
| 120+ cosmetic shop items (10 categories) | Built |
| NFT marketplace (Polygon) | Built |
| Battle pass (seasonal) | Built |
| Daily login rewards (7-day cycle) | Built |
| Referral program (4 milestones) | Built |
| Rakeback (tier-based 0-30%) | Built |

### Security & Trust
| Feature | Status |
|---------|--------|
| Provably fair shuffle (rejection sampling) | Built |
| On-chain hand verification (Polygon) | Built |
| Chainlink VRF randomness | Built |
| Card encryption (AES-256-GCM) | Built |
| Progressive KYC (5 levels) | Planned (Didit) |
| Anti-cheat engine | Built |
| Collusion detection | Built |
| Bot detection | Built |
| Geofencing | Built |
| Responsible gambling tools | Built |

---

## 6. Business Model & Revenue Streams

### Revenue Stream Breakdown

| Stream | Description | Estimated % of Revenue |
|--------|-------------|----------------------|
| **Rake** | 5% of cash game pots, net of rakeback | 45% |
| **Subscriptions** | 5 tiers: $0/$4.99/$14.99/$29.99/$79.99 per month | 20% |
| **Tournament Fees** | Registration fees + admin fees on hosted tournaments | 15% |
| **Marketplace Fees** | 2-2.9% on P2P cosmetic sales | 5% |
| **Battle Pass** | $9.99/month seasonal premium track | 5% |
| **Cosmetic Shop** | Direct chip-purchase of avatars, card backs, effects | 8% |
| **Insurance Fees** | 1% on all-in equity cashouts | 2% |

### Unit Economics

| Metric | Conservative | Target |
|--------|-------------|--------|
| Monthly ARPU (paying users) | $18 | $32 |
| Monthly ARPU (all users) | $4.50 | $8.00 |
| Customer Acquisition Cost (CAC) | $25 | $15 |
| Lifetime Value (LTV) — 18-month avg | $81 | $144 |
| LTV:CAC Ratio | 3.2x | 9.6x |
| Gross Margin | 78% | 82% |
| Churn (monthly, paying) | 8% | 5% |

### Subscription Tier Economics

| Tier | Price | Est. Conversion | Revenue/1000 Users |
|------|-------|-----------------|-------------------|
| Free | $0 | 60% of users | $0 (rake only) |
| Bronze | $4.99/mo | 20% | $998/mo |
| Silver | $14.99/mo | 12% | $1,799/mo |
| Gold | $29.99/mo | 6% | $1,799/mo |
| Platinum | $79.99/mo | 2% | $1,600/mo |
| **Total subscription** | | | **$6,196/mo per 1K users** |

---

## 7. Go-to-Market Strategy

### Phase 1: Club Owners First (Months 1-6)
**Target:** 200 club owners, each bringing 20-50 players = 4,000-10,000 players.

- **Club owner onboarding program:** Free Gold-tier subscription for 6 months for clubs that bring 25+ active players
- **Rake revenue share:** Club owners earn 50% of the rake generated at their tables (first 6 months)
- **Crypto poker communities:** Target Telegram/Discord groups of existing crypto poker players (est. 500K+ globally)
- **Influencer partnerships:** Partner with 5-10 poker streamers/YouTubers for club creation

### Phase 2: Crypto Poker Migration (Months 6-12)
**Target:** 25,000 active players.

- **Provably fair marketing:** "Verify every hand" campaign targeting crypto-native audience
- **Tournament series:** $100K guaranteed tournament series with crypto buy-ins
- **Referral flywheel:** 500 HRP + 2,000 chips per referred player who plays 100 hands
- **Content marketing:** Blog/video series: "Why Your Poker Site Can't Prove Fair Play"

### Phase 3: Traditional Poker Migration (Months 12-24)
**Target:** 100,000 active players.

- **PokerStars/GGPoker pain points:** Lower rake, better rakeback, club ownership, provable fairness
- **Affiliate program:** Standard CPA + revenue share for poker affiliates
- **Regulated market entry:** Apply for licenses in Malta (MGA), Curacao, Isle of Man
- **Sponsored live events:** Sanctum-branded tables at WSOP, EPT, WPT side events

---

## 8. Competitive Landscape

| Feature | Sanctum | PokerStars | GGPoker | ClubGG | CoinPoker | Virtue Poker |
|---------|---------|-----------|---------|--------|-----------|-------------|
| Provably fair (on-chain) | Yes | No | No | No | Partial | Yes |
| Crypto deposits (200+) | Yes | No | No | No | 10 coins | ETH only |
| Fiat deposits | Yes | Yes | Yes | No | No | No |
| Club ownership | Yes | No | No | Yes | No | No |
| Club marketplace vision | Yes | No | No | Partial | No | No |
| Rake customization | Yes | No | No | Yes | No | No |
| Progressive KYC | Yes | Binary | Binary | None | None | ETH wallet |
| Loyalty/battle pass | Yes | Yes | Yes | No | No | No |
| AI coaching | Yes | No | No | No | No | No |
| Video chat at table | Yes | No | No | No | No | No |
| NFT marketplace | Yes | No | No | No | No | Planned |
| Mobile-first responsive | Yes | App | App | App | Web | No |
| Open platform (no app store) | Yes | No | No | No | Yes | Yes |

### Key Differentiators
1. **Only platform with provably fair + club ownership + crypto + fiat** — No competitor has all four.
2. **Club marketplace model** — Club owners are distribution partners, not just users. They acquire players for us.
3. **Progressive KYC** — Players start immediately (play chips), verify incrementally as they deposit more. No other platform does this.
4. **No app store dependency** — Web-first PWA means no 30% Apple/Google tax and no store removal risk.

---

## 9. Technology Moat

1. **Provably Fair Engine:** Rejection-sampling shuffle with multi-party entropy, Chainlink VRF, and on-chain commitment/reveal. 18 months of development. Not trivially replicable.

2. **Multi-Gateway Payment Rail:** Stripe (fiat), NOWPayments (200+ cryptos), direct wallet (BTC/ETH/SOL with on-chain confirmation tracking). Integrated with 5-wallet internal ledger.

3. **Progressive KYC Architecture:** 5-tier verification (email → passive liveness → phone → full ID → NFC passport) with deposit/withdrawal limits mapped to each level. Designed for Didit integration.

4. **Real-Time Game Engine:** Custom WebSocket-based poker engine supporting 5 variants, side pots, insurance, run-it-multiple, all-in equity calculation, and sub-second action processing.

5. **AI Systems:** GPT-powered hand analysis, live coaching overlay with EV calculations, dual AI commentary (play-by-play + analyst).

---

## 10. Financial Projections (5-Year)

### User Growth

| Year | Monthly Active Users | Paying Users (est. 40%) | Clubs |
|------|---------------------|------------------------|-------|
| Y1 | 15,000 | 6,000 | 300 |
| Y2 | 75,000 | 30,000 | 1,500 |
| Y3 | 250,000 | 100,000 | 5,000 |
| Y4 | 500,000 | 200,000 | 10,000 |
| Y5 | 1,000,000 | 400,000 | 20,000 |

### Revenue Projections

| Year | Rake | Subscriptions | Tournaments | Other | Total Revenue |
|------|------|--------------|------------|-------|--------------|
| Y1 | $360K | $216K | $108K | $116K | **$800K** |
| Y2 | $2.7M | $1.6M | $810K | $890K | **$6.0M** |
| Y3 | $10.8M | $6.5M | $3.2M | $3.5M | **$24.0M** |
| Y4 | $24.0M | $14.4M | $7.2M | $7.4M | **$53.0M** |
| Y5 | $50.0M | $30.0M | $15.0M | $15.0M | **$110.0M** |

### Path to Profitability

| Year | Revenue | Operating Costs | EBITDA | EBITDA Margin |
|------|---------|----------------|--------|--------------|
| Y1 | $800K | $2.5M | ($1.7M) | -213% |
| Y2 | $6.0M | $5.5M | $500K | 8% |
| Y3 | $24.0M | $14.4M | $9.6M | 40% |
| Y4 | $53.0M | $26.5M | $26.5M | 50% |
| Y5 | $110.0M | $49.5M | $60.5M | 55% |

**Break-even:** Month 18-20 (mid-Year 2).

### Key Assumptions
- Average rake per active cash game player: $2/day
- Subscription conversion: 40% of MAU (club model drives higher conversion)
- Monthly churn: 6% (lower than industry 8-10% due to club stickiness)
- CAC decreases from $25 (Y1) to $8 (Y5) as club owners drive organic acquisition
- Operating costs: 60% engineering/product, 25% marketing, 15% G&A

---

## 11. Team & Execution

*[To be completed by founder]*

| Role | Name | Background |
|------|------|-----------|
| Founder/CEO | | |
| CTO | | |
| Head of Product | | |
| Head of Compliance | | |

**Key hires needed (funded by seed round):**
- VP Engineering (game systems experience)
- Head of Compliance (online gambling licensing)
- Community Manager (poker community background)
- 2x Full-Stack Engineers
- 1x Blockchain Engineer
- 1x Security Engineer
- 1x Designer (UI/UX)

---

## 12. The Ask

### Seed Round: $2.5M

| Use of Funds | Amount | % |
|-------------|--------|---|
| **Regulatory Licensing** (Malta MGA or Curacao) | $500K | 20% |
| **Engineering Team** (6 hires, 18 months) | $900K | 36% |
| **Marketing & User Acquisition** | $500K | 20% |
| **Infrastructure & Security Audits** | $200K | 8% |
| **Legal & Compliance** | $200K | 8% |
| **Working Capital** | $200K | 8% |
| **Total** | **$2.5M** | **100%** |

### Milestones for Seed Capital

| Milestone | Target Date | KPI |
|-----------|-------------|-----|
| Regulatory license obtained | Month 6 | MGA or Curacao license |
| Public launch | Month 8 | Platform live with real money |
| 200 active clubs | Month 10 | Club owners onboarded |
| 10,000 MAU | Month 12 | Active player base |
| $50K MRR | Month 14 | Revenue traction |
| Series A readiness | Month 18 | $200K+ MRR, 50K MAU |

### Series A Trigger: $200K+ MRR with 50K MAU and regulatory license in hand.

---

## 13. Risk Factors & Mitigations

| Risk | Severity | Mitigation |
|------|----------|-----------|
| **Regulatory uncertainty** | High | Apply for MGA license early. Progressive KYC satisfies most jurisdictions. Geofencing blocks restricted markets. Legal counsel retained. |
| **Competition from incumbents** | Medium | Club marketplace model creates network effects they can't easily replicate. Provable fairness is architectural — can't be bolted on. |
| **Crypto regulatory crackdown** | Medium | Fiat payments via Stripe as primary rail. Crypto is an option, not a requirement. Dual-rail reduces dependency. |
| **Security breach** | High | AES-256-GCM card encryption, CSRF protection, rate limiting, anti-cheat engine, third-party security audit budgeted. No hot wallet with significant funds — admin-approved withdrawals. |
| **Player liquidity (cold start)** | High | Club owner program solves this — each club brings their own players. Bot tables fill empty lobbies during ramp. Guaranteed tournament prize pools. |
| **Technology risk** | Low | Platform is fully built and functional. Not vaporware. Technical debt documented and prioritized. |
| **Key person risk** | Medium | Comprehensive technical documentation (architecture, specification) ensures continuity. Codebase is well-structured TypeScript — hireable skill set. |

---

## Appendix: Platform Screenshots

*[To be added — Landing page, Lobby, Game Table, Club Dashboard, Wallet, Shop]*

---

**Contact:** *[Founder contact information]*

**Confidentiality Notice:** This document contains proprietary information intended solely for the recipient. Do not distribute without written consent.

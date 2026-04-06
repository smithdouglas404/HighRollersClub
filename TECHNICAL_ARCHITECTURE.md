# Sanctum — Technical Architecture

**Version 1.0 | April 2026**

---

## 1. System Overview

### Architecture Style
Sanctum uses a **modular monolith** architecture that can be decomposed into independent services via the `SERVICE_MODE` environment variable. In default mode, all services run in a single Node.js process. For horizontal scaling, services split into:

```
┌─────────────────────────────────────────────────────────┐
│                     Load Balancer                        │
│                  (Cloudflare / nginx)                    │
└──────────┬──────────┬──────────┬───────────┬────────────┘
           │          │          │           │
    ┌──────▼──┐ ┌─────▼────┐ ┌──▼─────┐ ┌──▼──────┐
    │ API     │ │ Game     │ │Payment │ │ Jobs    │
    │ Server  │ │ Server   │ │Worker  │ │ Worker  │
    │ (REST)  │ │ (WS+Game)│ │(Crypto)│ │(Cron)   │
    └────┬────┘ └────┬─────┘ └───┬────┘ └───┬─────┘
         │           │           │           │
    ┌────▼───────────▼───────────▼───────────▼────┐
    │              Redis (Pub/Sub + Cache)          │
    └────────────────────┬────────────────────────-┘
                         │
    ┌────────────────────▼─────────────────────────┐
    │            PostgreSQL (Primary DB)             │
    └───────────────────────────────────────────────┘
                         │
    ┌────────────────────▼─────────────────────────┐
    │         Polygon Blockchain (L2)               │
    │    ┌──────────┐  ┌──────────┐  ┌──────────┐  │
    │    │HandVerify│  │VRF       │  │NFT       │  │
    │    │Contract  │  │Consumer  │  │Marketplace│  │
    │    └──────────┘  └──────────┘  └──────────┘  │
    └───────────────────────────────────────────────┘
```

### Service Modes
| Mode | Process | Responsibility |
|------|---------|---------------|
| `api` | `node dist/index.js` | REST API, session auth, route handling |
| `game` | `node dist/game-server.js` | WebSocket, game engine, table management |
| `payments` | `node dist/payment-worker.js` | Crypto deposit monitoring, withdrawal processing, webhook handling |
| `jobs` | `node dist/jobs-worker.js` | Tournament scheduler, rakeback processing, daily bonus, cleanup |
| *(none)* | All-in-one monolith | All services in single process |

Communication between split services uses **Redis pub/sub** via the API Gateway (`server/api-gateway.ts`).

---

## 2. Technology Stack

### Frontend
| Technology | Version | Purpose |
|-----------|---------|---------|
| React | 18.x | UI framework |
| TypeScript | 5.x | Type safety |
| Vite | 5.x | Build tool & dev server |
| Tailwind CSS | 4.x | Utility-first styling |
| Framer Motion | 12.x | Animations |
| Three.js / R3F | 9.x | 3D table rendering |
| TanStack React Query | 5.x | Server state management |
| Zustand | — | Client state (game, replay, scene) |
| Wouter | — | Client-side routing |
| Radix UI | — | Accessible component primitives |
| Lucide React | — | Icon system |

### Backend
| Technology | Version | Purpose |
|-----------|---------|---------|
| Node.js | 20.x | Runtime |
| Express | 4.x | HTTP framework |
| TypeScript | 5.x | Type safety |
| WebSocket (ws) | — | Real-time game communication |
| Drizzle ORM | 0.39.x | Type-safe database queries |
| Zod | — | Runtime validation |
| esbuild | — | Production bundling |

### Database & Cache
| Technology | Purpose |
|-----------|---------|
| PostgreSQL | Primary datastore (users, games, transactions, clubs) |
| Redis (ioredis) | Pub/sub, session cache, rate limit state |
| Drizzle Kit | Schema migrations (push-based) |

### Blockchain
| Technology | Purpose |
|-----------|---------|
| Polygon (Amoy/Mainnet) | L2 chain for hand verification, NFTs |
| Solidity | Smart contracts |
| Hardhat | Contract development & deployment |
| ethers.js 6.x | Blockchain client |
| Chainlink VRF v2 | Verifiable random function for shuffle entropy |

### External Services
| Service | Purpose |
|---------|---------|
| Stripe | Fiat card payments |
| NOWPayments | 200+ cryptocurrency payments |
| Firebase | Google OAuth, push notifications |
| Didit *(planned)* | Progressive KYC (liveness, ID, NFC) |
| Daily.co | Video chat at tables |
| OpenAI | AI hand analysis & coaching |
| Anthropic | AI commentary engine |
| ElevenLabs | Text-to-speech for commentary |
| ip-api | Geolocation for geofencing |

---

## 3. Game Engine

### Hand Lifecycle

```
1. SHUFFLE
   ├── Server generates random seed (crypto.randomBytes)
   ├── Request Chainlink VRF randomness (on-chain)
   ├── Collect player entropy seeds
   ├── Combine all entropy sources
   ├── Fisher-Yates shuffle with rejection sampling (eliminates modulo bias)
   ├── Compute SHA-256 commitment hash
   └── Publish commitment hash to all players BEFORE dealing

2. DEAL
   ├── Encrypt each player's hole cards (AES-256-GCM, per-session key)
   ├── Obfuscate card data (4-layer anti-scraping)
   ├── Send encrypted cards via WebSocket
   └── Commit hand to Polygon blockchain

3. BETTING ROUNDS (Pre-flop → Flop → Turn → River)
   ├── Track active players, pot, side pots
   ├── Validate each action (fold/check/call/raise/all-in)
   ├── Calculate minimum raise, pot-size bet
   ├── Manage time bank and auto-fold
   └── Support: straddle, bomb pot, run-it-twice

4. SHOWDOWN
   ├── Evaluate hands (dual evaluator: fast prime-product + descriptive)
   ├── Calculate side pot distribution
   ├── Determine winners
   ├── Reveal server seed — players verify commitment hash
   └── Reveal hand on Polygon blockchain

5. POST-HAND
   ├── Deduct rake (configurable per table/club)
   ├── Record hand to database (gameHands, handPlayers, handActions)
   ├── Award loyalty points (HRP)
   ├── Update player statistics
   ├── Check achievement progress
   └── Broadcast hand summary to all players
```

### Hand Evaluator
Two independent evaluators ensure correctness:

1. **Fast Evaluator** (`fast-evaluator.ts`): Prime-product algorithm. Each card mapped to a unique prime number. 7-card evaluation via lookup tables. Used for **winner determination**.

2. **Descriptive Evaluator** (`hand-evaluator.ts`): Combination-based evaluator. Generates human-readable hand descriptions ("Two Pair, Aces and Kings"). Used for **UI display**.

A startup self-test runs both evaluators against a known hand set and asserts agreement.

### Supported Game Formats
| Format | Description |
|--------|------------|
| Cash Game | Continuous play, flexible buy-in/cashout |
| Sit & Go | Fixed buy-in, starts when full, escalating blinds |
| Multi-Table Tournament | Scheduled start, blind schedule, payout structure |
| Lottery SNG | 3-player hyper-turbo with random prize multiplier (2x-1000x) |
| Fast-Fold | Fold → instantly moved to new table with new hand |
| Bomb Pot | Every Nth hand, all players post ante, flop dealt immediately |

### Poker Variants
| Variant | Cards | Description |
|---------|-------|------------|
| NLHE | 2 hole, 5 community | No-Limit Texas Hold'em |
| PLO | 4 hole, 5 community | Pot-Limit Omaha (must use exactly 2) |
| PLO5 | 5 hole, 5 community | 5-Card Pot-Limit Omaha |
| Short Deck | 2 hole, 5 community | 6+ Hold'em (cards below 6 removed) |

---

## 4. Cryptographic Systems

### Provably Fair Shuffle
```
Server Seed ──────┐
Player Seeds ─────┤──→ Combined Entropy ──→ Fisher-Yates Shuffle ──→ Deck Order
Chainlink VRF ────┘    (rejection sampling)

Commitment: SHA-256(serverSeed + deckOrder) published BEFORE dealing
Verification: After hand, reveal serverSeed → player recomputes hash → must match
```

**Rejection sampling** eliminates modulo bias in the Fisher-Yates shuffle. Standard `random() % n` has bias when the random range isn't divisible by n. Rejection sampling discards biased values and redraws.

### Card Encryption
4 layers protect card data in transit:

| Layer | Technology | Purpose |
|-------|-----------|---------|
| 1. AES-256-GCM | Per-session symmetric key | Encrypts card values |
| 2. Obfuscation | Byte-level card encoding | Prevents pattern analysis |
| 3. Canvas rendering | Cards drawn to HTML Canvas | Prevents DOM scraping |
| 4. WebSocket TLS | WSS (TLS 1.3) | Prevents network sniffing |

Session keys are generated per-connection using `crypto.randomBytes(32)` and exchanged over the encrypted WebSocket.

### On-Chain Verification
Three Solidity contracts on Polygon:

1. **PokerHandVerifier**: Stores commitment hashes before deal, reveal hashes after showdown. Anyone can verify.
2. **PokerVRFConsumer**: Interfaces with Chainlink VRF v2 to request and receive verifiable random numbers.
3. **PokerNFTMarketplace**: ERC-721 NFTs for cosmetic items with on-chain trading.

---

## 5. Real-Time Communication

### WebSocket Architecture
```
Client ←──WSS──→ Server (ws library)
                    │
                    ├── Authentication (session cookie validation)
                    ├── Rate limiting (20 msg/sec global)
                    ├── Message routing by type
                    └── Redis pub/sub for cross-process broadcast
```

### Key Message Types
| Direction | Type | Payload |
|-----------|------|---------|
| Client → Server | `join_table` | tableId, buyIn, password? |
| Client → Server | `player_action` | action, amount |
| Client → Server | `chat` | message |
| Server → Client | `game_state` | Full table state (encrypted cards) |
| Server → Client | `session_key` | AES-256 key for card decryption |
| Server → Client | `seed_reveal` | Server seed for provable fairness verification |
| Server → Client | `hand_complete` | Summary, winners, pot distribution |
| Server → Client | `onchain_proof` | Blockchain transaction hashes |

### Reconnection Strategy
- Client: Exponential backoff (1s → 2s → 4s → ... → 30s max)
- Server: Tracks disconnected players for 60 seconds
- On reconnect: Full state sync, auto-rejoin active table (password stored in sessionStorage)

---

## 6. Payment Infrastructure

### Multi-Gateway Architecture
```
Deposit Request
     │
     ├── USD (Stripe Checkout) ──→ Card payment ──→ Webhook confirmation
     ├── BTC (NOWPayments) ──→ Generate address ──→ Monitor confirmations
     ├── ETH/USDT (Direct Wallet) ──→ Alchemy monitoring ──→ Confirm on-chain
     └── SOL (Direct Wallet) ──→ Helius monitoring ──→ Confirm on-chain
```

### Confirmation Requirements
| Currency | Confirmations | Approx. Time |
|----------|--------------|-------------|
| BTC | 3 | ~30 minutes |
| ETH/USDT | 12 | ~3 minutes |
| SOL | 1 | ~400ms |
| USD (Stripe) | Instant | Instant |

### Wallet System
Each user has 5 separate wallets:

| Wallet | Purpose | Funding |
|--------|---------|---------|
| Main | Deposits & withdrawals | External deposits |
| Cash Game | Ring game buy-ins | Transfer from Main |
| SNG | Sit & Go entries | Transfer from Main |
| Tournament | MTT entries | Transfer from Main |
| Bonus | Rakeback, rewards, referrals | System-generated |

Transfers between wallets are instant and free. Withdrawals only from Main wallet.

### Withdrawal Flow
1. Player initiates withdrawal (amount, currency, address)
2. Address validated against currency-specific regex
3. Chips deducted from Main wallet (atomic operation)
4. Withdrawal request created with `pending` status
5. Admin reviews and approves/rejects
6. If approved: funds sent via appropriate gateway
7. If rejected: chips returned to Main wallet

---

## 7. Database Schema

### Entity Groups

| Domain | Tables | Key Fields |
|--------|--------|-----------|
| **Users** | `users`, `playerStats` | id, tier, kycLevel, loyaltyPoints, chipBalance |
| **Clubs** | `clubs`, `clubMembers`, `clubInvitations`, `clubAnnouncements`, `clubEvents`, `clubAlliances`, `leagueSeasons` | clubId, ownerId, rakePercent, eloRating |
| **Games** | `tables`, `tablePlayers`, `gameHands`, `handPlayers`, `handActions` | tableId, handNumber, potTotal, totalRake |
| **Economy** | `wallets`, `transactions`, `payments`, `withdrawalRequests`, `marketplaceListings` | userId, walletType, balance, amount |
| **Tournaments** | `tournaments`, `tournamentRegistrations` | buyIn, prizePool, status, payoutStructure |
| **Shop** | `shopItems`, `userInventory`, `wishlists` | category, rarity, price, earnableAtLevel |
| **Loyalty** | `achievements`, `userAchievements`, `battlePasses`, `battlePassRewards`, `userBattlePasses`, `dailyLoginRewards`, `referrals`, `hrpTransactions` | loyaltyPoints, level, hrpAmount, source |

### Indexing Strategy
- All foreign key columns indexed
- Composite unique indexes on (userId, walletType), (userId, itemId), (userId, achievementId)
- Timestamp indexes on transactions and payments for range queries
- Text search via ILIKE with escaped wildcards

---

## 8. Security Architecture

### Authentication
| Method | Flow |
|--------|------|
| Session (primary) | Express-session with PostgreSQL store (connect-pg-simple) |
| Firebase OAuth | Google Sign-In → Firebase token → server session creation |
| Guest | Instant account with random username, 10K play chips |

### Defense Layers
| Layer | Implementation |
|-------|---------------|
| CSRF | Double-submit cookie pattern (csrf-token cookie + X-CSRF-Token header) |
| XSS | Helmet with CSP allowlist, input sanitization |
| Rate Limiting | Per-IP login/registration limits (in-memory, Redis in production) |
| Session Security | httpOnly, secure, sameSite=lax cookies, 24h expiry |
| Card Security | AES-256-GCM encryption + canvas rendering (not DOM) |
| Geofencing | IP-based country blocking via ip-api |

### Anti-Cheat Systems
| System | Detection Method |
|--------|-----------------|
| **Collusion Detector** | Tracks chip flow between player pairs. Flags one-directional chip dumping (5+ hands, weak hand folding pattern). |
| **Bot Detection** | Analyzes action timing (ms precision). Flags inhuman consistency or robotic patterns. |
| **Multi-Account Detection** | Device fingerprinting (canvas hash + UA + screen + timezone). Connection tracking per IP. |
| **Risk Scoring** | Composite score from all signals. Escalating response: warning → cooldown → ban. |

### Progressive KYC (Planned — Didit Integration)
| Level | Verification | Deposit Limit |
|-------|-------------|--------------|
| Email | Email + IP analysis | $0 (play chips) |
| Basic | Passive liveness + face match | $200/day |
| Standard | Phone + age estimation | $1,000/day |
| Full | ID + proof of address + AML | $5,000/day |
| Enhanced | NFC passport + biometric + database | $25,000/day |

---

## 9. AI Systems

### Hand Analysis Engine
- Backend calls OpenAI GPT-4 with structured hand context (cards, position, pot, actions)
- Returns: EV by action (raise/call/fold), optimal play rating, leak identification
- Results cached per hand to avoid redundant API calls

### Live Coaching Overlay
- Real-time analysis during player's turn
- Shows recommended action with confidence percentage and plain-English reasoning
- 50 chips/hand fee (included for Bronze+ subscribers)

### AI Commentary
- Dual commentator system: LON (play-by-play) and NORMAN (analyst)
- Generates natural language commentary based on game state
- Optional text-to-speech via ElevenLabs
- Runs in "omniscient mode" — sees all hole cards for dramatic narration

---

## 10. Scaling Strategy

### Current Architecture (0-10K users)
Single Node.js process (monolith mode) on Railway. PostgreSQL via Neon. No Redis required (in-memory pub/sub and cache).

### Phase 2 (10K-100K users)
- Split into 4 services via `SERVICE_MODE`
- Add Redis for pub/sub and rate limiting
- Multiple game server instances behind WebSocket load balancer
- PostgreSQL read replicas for API queries
- Game state checkpointing to database every action

### Phase 3 (100K+ users)
- Kubernetes orchestration
- Dedicated game server pods auto-scaling by table count
- CDN for static assets
- Regional deployment (US, EU, APAC)
- Sharded game state by table ID across Redis cluster

---

## 11. Build & Deployment

### Build Pipeline
```bash
# Development
npm run dev          # tsx server/index.ts + Vite HMR

# Production build
npm run build        # Vite (client) + esbuild (server)

# Production run
npm run start        # node dist/index.js (monolith)
npm run start:api    # SERVICE_MODE=api
npm run start:game   # SERVICE_MODE=game
npm run start:payments
npm run start:jobs
```

### Deployment Topology (Current)
```
Railway
├── Web Service (Procfile: web: node dist/index.js)
├── PostgreSQL (Neon serverless)
└── Redis (Railway addon, optional)
```

### Auto-Migration
On startup, `drizzle-kit push --force` synchronizes the schema. For new tables (loyalty, achievements, etc.), `autoMigrate()` in `db.ts` runs `CREATE TABLE IF NOT EXISTS` and `ALTER TABLE ADD COLUMN IF NOT EXISTS` statements.

### Graceful Shutdown
- `SIGTERM`/`SIGINT` → stop accepting connections → drain database pool → force exit after 5 seconds

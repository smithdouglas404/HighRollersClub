# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Frontend**: React + Vite + Tailwind CSS v4 + Framer Motion
- **Routing**: Wouter
- **Auth**: Clerk (primary) + express-session (game session bridging)
- **Design System**: "The Neon Vault" — cyberpunk glassmorphic aesthetic

## Structure

```text
artifacts-monorepo/
├── artifacts/              # Deployable applications
│   ├── api-server/         # Express API server
│   ├── poker/              # React+Vite frontend (Stitch Poker)
│   └── mockup-sandbox/     # Component preview server
├── lib/                    # Shared libraries
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
├── scripts/                # Utility scripts (single workspace package)
│   └── src/                # Individual .ts scripts
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── tsconfig.json
└── package.json
```

## Design System — The Neon Vault

- **Background**: Deep obsidian (#0e0e0e)
- **Primary**: Cyan (#81ecff → #00e3fd gradient)
- **Secondary**: Green (#3fff8b) — positive/success actions
- **Destructive**: Red (#ff7076) — risk/destructive actions
- **Gold/Metallic**: #c9a84c → #f0d48a — used on poker table UI elements (buttons, labels, admin panels)
- **Surfaces**: Stacking glass layers (5% → 16% lightness)
- **Borders**: Ghost borders (white at 15% opacity)
- **Poker Table**: Immersive dark green felt with gold metallic UI elements matching the "High Rollers Club" design
- **Fonts**: Space Grotesk (headings), Manrope (body)
- **Effects**: Glassmorphism (backdrop-blur-2xl), neon glows, noise texture overlay
- **Custom utilities**: `.glass-panel`, `.glass-ghost`, `.neon-text-glow`, `.neon-box-glow`, `.gradient-primary`

## Stitch Poker App

### Authentication System
- **Primary Auth**: Clerk (Google OAuth, email/password) — handles sign-in/sign-up UI
- **Session Bridge**: On Clerk sign-in, `/api/auth/clerk-sync` creates/links a database user and establishes an express-session
- **WebSocket Auth**: Uses express-session cookies (set during Clerk sync) for WebSocket connection authentication
- **DB Schema**: `users` table has `clerk_id` column linking to Clerk user IDs
- **Auth Flow**: Clerk sign-in → clerk-sync API call → express-session created → WebSocket + API access via session cookie
- **Protected Routes**: `<Show when="signed-in">` for frontend, `requireAuth` middleware checks both session and Clerk tokens
- **Welcome Bonus**: New users receive 10,000 chips via transaction ledger
- **Landing Page**: Home route (`/`) shows public landing page for unauthenticated users, game lobby for authenticated users

### Pages
- **Landing** (`/`) — Public welcome page with Sign In / Create Account buttons (unauthenticated), game lobby (authenticated)
- **Sign In** (`/sign-in`) — Clerk-powered sign-in with Google OAuth + email/password
- **Sign Up** (`/sign-up`) — Clerk-powered sign-up with Google OAuth + email/password
- **Home** (`/`) — Hero section, game mode selection, active tables grid (authenticated)
- **Clubs** (`/clubs`) — Club cards with member counts, avg buy-ins
- **Club Detail** (`/clubs/:id`) — Club info, member list, stats
- **Club Create** (`/clubs/new`) — Form to create new club
- **Tournaments** (`/tournaments`) — Tournament listings with prize pools
- **Poker Table** (`/table/:id`) — Full-screen immersive poker gameplay
- **Profile** (`/profile`) — Player stats (bankroll, win rate, hands played)

### Components
- `NeonButton`, `GlassCard`, `GhostInput` — Design system primitives (`components/ui/neon.tsx`)
- `PlayingCard` — Animated playing card with face-up/face-down states
- `AppLayout` — Main layout with nav, sign-out button, balance display

### Database Tables
- `users` — Player accounts with clerk_id, password_hash, level, stats, is_admin flag
- `transactions` — Immutable transaction ledger (amount, balance_after, type, reference)
- `game_sessions` — Active game sessions per table (phase, pot, dealer, deck state)
- `game_players` — Players seated at a game (chips, hole_cards, status, bets)
- `hand_history` — Completed hand records (actions, community cards, winner)
- `clubs` — Poker clubs with membership limits
- `club_members` — Club membership with roles (owner/admin/member)
- `poker_tables` — Active tables with game types, stakes, player counts
- `tournaments` — Scheduled events with prize pools, buy-ins
- `user_sessions` — Server-side session storage (connect-pg-simple)

### Server-Side Game Engine
- **Deck**: Cryptographically shuffled, serialized server-side only
- **Hand Evaluator**: Full Texas Hold'em hand evaluation (Royal Flush → High Card)
- **Game Phases**: waiting → preflop → flop → turn → river → showdown → finished
- **Actions**: fold, check, call, raise, all_in with server-side validation
- **Blinds**: Automatic SB/BB posting based on dealer rotation
- **Authorization**: Only seated players can start hands or perform actions

### Wallet / Transaction Ledger
- **Atomic Operations**: All balance changes use PostgreSQL transactions with row-level locking
- **Immutable Ledger**: Every chip movement creates a transaction record
- **Balance**: Derived from latest transaction's `balance_after` field
- **Types**: deposit, buy_in, cash_out, win, loss
- **Race Protection**: SELECT FOR UPDATE prevents concurrent balance corruption

### API Routes (mounted at `/api`)
- `POST /auth/clerk-sync` — Sync Clerk user to database, create session
- `POST /auth/register` — Legacy: Create account with username/password
- `POST /auth/login` — Legacy: Authenticate with username/password
- `POST /auth/logout` — Destroy session
- `GET /auth/me` — Get current authenticated user (checks session + Clerk token)
- `GET /users/me` — Get current user with balance
- `GET /wallet/balance` — Get chip balance
- `GET /wallet/transactions` — Get transaction history
- `GET /tables` — List tables
- `POST /tables` — Create table
- `GET /tables/:tableId` — Get table details
- `GET /tables/:tableId/game` — Get game state (auth required)
- `POST /tables/:tableId/join` — Join table (auth required)
- `POST /tables/:tableId/leave` — Leave table (auth required)
- `POST /tables/:tableId/start` — Start hand (auth + seated required)
- `POST /tables/:tableId/action` — Perform game action (auth + turn required)
- `GET /clubs` — List clubs
- `POST /clubs` — Create club
- `GET /tournaments` — List tournaments
- `GET /health` — Health check

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists all packages as project references. This means:

- **Always typecheck from the root** — run `pnpm run typecheck` (which runs `tsc --build --emitDeclarationOnly`). This builds the full dependency graph so that cross-package imports resolve correctly. Running `tsc` inside a single package will fail if its dependencies haven't been built yet.
- **`emitDeclarationOnly`** — we only emit `.d.ts` files during typecheck; actual JS bundling is handled by esbuild/tsx/vite...etc, not `tsc`.
- **Project references** — when package A depends on package B, A's `tsconfig.json` must list B in its `references` array. `tsc --build` uses this to determine build order and skip up-to-date packages.

## Root Scripts

- `pnpm run build` — runs `typecheck` first, then recursively runs `build` in all packages that define it
- `pnpm run typecheck` — runs `tsc --build --emitDeclarationOnly` using project references

## Packages

### `artifacts/api-server` (`@workspace/api-server`)

Express 5 API server with Clerk auth, game engine, and wallet.

- Entry: `src/index.ts` — reads `PORT`, starts Express
- App setup: `src/app.ts` — mounts Clerk proxy, CORS, JSON parsing, clerkMiddleware, session middleware, routes at `/api`
- Auth: `src/lib/auth.ts` — bcrypt hashing, session middleware, requireAuth guard (checks session + Clerk)
- Clerk Proxy: `src/middlewares/clerkProxyMiddleware.ts` — production proxy for Clerk Frontend API
- Game Engine: `src/lib/game-engine.ts` — server-side poker logic
- Hand Evaluator: `src/lib/hand-evaluator.ts` — Texas Hold'em hand ranking
- Wallet: `src/lib/wallet.ts` — atomic chip transactions with row locking
- WebSocket: `src/lib/websocket.ts` — real-time game state broadcasting via session-based auth
- Routes: `src/routes/` — auth (with clerk-sync), users, games, wallet, tables, clubs, tournaments
- Depends on: `@workspace/db`, `@workspace/api-zod`, @clerk/express, bcrypt, express-session, connect-pg-simple, http-proxy-middleware

### `artifacts/poker` (`@workspace/poker`)

React + Vite frontend for Stitch Poker with Clerk authentication.

- Entry: `src/main.tsx`
- App: `src/App.tsx` — ClerkProvider wraps Wouter routes, Show-based auth gating
- Auth: `src/hooks/use-auth.tsx` — AuthContext syncs Clerk user to backend, provides user/balance
- API Client: `src/lib/api.ts` — fetch wrapper with credentials for all API calls (includes clerk-sync)
- Pages: `src/pages/` — home, clubs, tournaments, poker-table, profile (sign-in/sign-up handled by Clerk components)
- Components: `src/components/` — ui (neon, shadcn), layout, poker
- Depends on: @clerk/react

### `lib/db` (`@workspace/db`)

Database layer using Drizzle ORM with PostgreSQL.

- `src/index.ts` — creates a `Pool` + Drizzle instance, exports schema and pool
- `src/schema/` — users (with clerk_id), clubs, tables, tournaments, transactions, game-sessions
- Exports: `.` (pool, db, schema), `./schema` (schema only)

### `lib/api-spec` (`@workspace/api-spec`)

Owns the OpenAPI 3.1 spec (`openapi.yaml`) and the Orval config (`orval.config.ts`).

### `lib/api-zod` (`@workspace/api-zod`)

Generated Zod schemas from the OpenAPI spec.

### `lib/api-client-react` (`@workspace/api-client-react`)

Generated React Query hooks and fetch client. Custom fetch includes `credentials: "include"` for cookie auth.

### `scripts` (`@workspace/scripts`)

Utility scripts package. Run via `pnpm --filter @workspace/scripts run <script>`.

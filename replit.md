# High Rollers Club - Replit Agent Guide

## Overview

High Rollers Club is a full-stack online poker platform with a cyberpunk "Neo-Vegas" aesthetic. It features real-time multiplayer Texas Hold'em poker with WebSocket-based gameplay, 3D table rendering, provably fair card shuffling, club/social systems, and a virtual economy. The app supports both single-player (with bots) and multiplayer modes, user authentication, and a dashboard with lobby, shop, club management, and member pages.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend (React + Vite)

- **Framework:** React with TypeScript, bundled by Vite
- **Routing:** Wouter (lightweight client-side router)
- **State Management:** TanStack React Query for server state; React context for auth and sound
- **UI Components:** shadcn/ui (New York style) built on Radix UI primitives with Tailwind CSS
- **3D Rendering:** React Three Fiber (@react-three/fiber) with drei helpers and postprocessing effects for the poker table scene
- **Animations:** Framer Motion for UI transitions and game animations
- **Styling:** Tailwind CSS v4 with custom dark theme (CSS variables), custom fonts (Inter, Roboto Mono, Orbitron)
- **Sound:** Fully synthesized audio using Web Audio API — no external audio files. Sound engine is a singleton class with context provider
- **WebSocket Client:** Custom auto-reconnecting WebSocket client (`ws-client.ts`) for real-time game communication
- **Path aliases:** `@/` maps to `client/src/`, `@shared/` maps to `shared/`, `@assets/` maps to `attached_assets/`

### Backend (Express + Node.js)

- **Runtime:** Node.js with TypeScript (tsx for dev, esbuild for production)
- **Framework:** Express.js
- **Authentication:** Passport.js with local strategy, express-session with MemoryStore. Supports guest accounts, registration, and login. Passwords hashed with SHA-256 + UUID salt (no bcrypt)
- **WebSocket:** `ws` library attached to the HTTP server, with session-aware authentication via shared session middleware
- **Game Engine:** Server-authoritative poker engine (`server/game/engine.ts`) handling game phases, betting rounds, side pots, and showdowns
- **Bot System:** AI bot players (`server/game/bot-player.ts`) that make decisions based on hand strength evaluation
- **Table Management:** `TableManager` singleton manages active game instances, bot lifecycle, and state broadcasting
- **API Pattern:** REST endpoints under `/api/` for CRUD operations (tables, clubs, auth, wallet). WebSocket for real-time game state

### Database

- **ORM:** Drizzle ORM with PostgreSQL dialect
- **Schema:** Defined in `shared/schema.ts` using Drizzle's `pgTable` — shared between client and server
- **Tables:** `users`, `clubs`, `clubMembers`, `tables`, `tablePlayers`, `transactions`, `gameHands`, `tournaments`
- **Validation:** Zod schemas generated from Drizzle schemas via `drizzle-zod`
- **Connection:** Uses `pg` (node-postgres) Pool. Connection via `DATABASE_URL` environment variable
- **Fallback:** In-memory storage implementation exists for development without a database (`hasDatabase()` check in `server/db.ts`)
- **Migrations:** Drizzle Kit with `db:push` command for schema sync

### Key Design Decisions

1. **Server-authoritative game logic:** All poker game state lives on the server. The client receives sanitized state (opponent cards hidden). This prevents cheating.

2. **Dual game modes:** The client has both a local game engine (`game-engine.ts`) for single-player/demo and a multiplayer engine (`multiplayer-engine.ts`) that syncs via WebSocket. The multiplayer engine translates server state format to client format.

3. **Synthesized audio over audio files:** All sound effects are generated programmatically via Web Audio API oscillators and noise buffers. This eliminates asset loading and keeps the bundle small.

4. **3D + 2D hybrid UI:** The poker table defaults to 3D mode (Three.js) with quality levels (low/medium/high), while HUD elements (controls, panels, overlays) remain 2D React components overlaid on top. A 2D "image" fallback mode is available via toggle. Cards use pure CSS rendering (no DALL-E images) for crisp display at any size.

5. **Shared constants:** Table seat positions, dealer positions, and quality configs live in `client/src/lib/table-constants.ts` (separate from React components to avoid HMR issues).

6. **Shared schema:** The `shared/` directory contains types and schemas used by both frontend and backend, ensuring type safety across the stack.

7. **In-game admin panel:** Table creators and global admins can access a settings panel (gear icon in top bar) during gameplay to adjust blinds, table rules (straddle, run-it-twice, rabbit hunting, etc.), speed/timing, rake, and bot settings. Changes apply at the start of the next hand. Access is gated by `tables.createdById === user.id || user.role === "admin"`. Offline mode always has admin access. Component: `client/src/components/game/InGameAdminPanel.tsx`.

8. **GameSetup wizard:** The pre-game setup screen (`GameSetup.tsx`) is a 6-step wizard: Avatar → Game Type → Stakes → Table Rules → Speed & Extras → Review. Each step has its own screen with animated transitions and a progress indicator. The Review step shows a full summary before launching. Practice Mode quick-start button available on the Review step.

11. **Portrait-style player seats:** Seat.tsx renders players as tall portrait cards (`.portrait-card` CSS class using container queries) with the avatar image filling the card, name/chips overlaid at the bottom with gradient fade, and a gold accent rail at the bottom edge. Cards render below the portrait. The neon glow ring wraps the entire portrait card.

12. **Expanded avatar collection:** 24 cyberpunk character avatars (6 legendary, 8 epic, 10 rare) defined in `AvatarSelect.tsx`. All images are webp files in `attached_assets/generated_images/avatars/`. The avatar grid in GameSetup shows 8 columns on large screens.

9. **AI Commentary System:** Two-voice poker broadcast using ElevenLabs TTS + Anthropic Claude. Play-by-play ("Adam"/LON) and analyst ("Josh"/NORMAN) commentate showdowns, big pots, all-ins, blind increases, player eliminations, and player tendencies. Server: `server/game/commentary-engine.ts` + `server/game/tts-engine.ts`. Client: `client/src/components/poker/CommentaryOverlay.tsx` (subtitles + controls panel). Currently multiplayer-only toggle in top bar (mic icon). Requires `ELEVENLABS_API_KEY` and `ANTHROPIC_API_KEY` secrets.

10. **Premium UI pages:** Profile (hero banner, rank tiers, animated stat counters, 64px achievement badges with progress bars, taunt voice picker), Members (gold/silver/bronze podium styling for top 3, trend indicators, gradient invite panel), Club Dashboard (club logo picker, animated stat cards, alliance info, tab animations), Browse Clubs (featured clubs section, sort options, club logos, activity indicators), Lobby (hot tables section, format tab counts, seat dot indicators, gradient table cards).

### Project Structure

```
client/              # Frontend React app
  src/
    components/      # UI components (poker/, auth/, lobby/, ui/)
    pages/           # Route pages (Landing, Lobby, Game, Shop, Members, etc.)
    lib/             # Core logic (auth, game engines, sound, WebSocket, utils)
    hooks/           # React hooks
server/              # Backend Express server
  game/              # Poker game engine, bot AI, hand evaluator, table manager
  auth.ts            # Authentication setup
  routes.ts          # API route definitions
  storage.ts         # Data access layer (DB + in-memory fallback)
  websocket.ts       # WebSocket server setup
  db.ts              # Database connection
shared/              # Shared between client and server
  schema.ts          # Drizzle ORM schema + Zod validators
attached_assets/     # Generated images (avatars, backgrounds, textures)
migrations/          # Drizzle database migrations
```

## External Dependencies

### Database
- **PostgreSQL** via `DATABASE_URL` environment variable (Neon serverless driver available as `@neondatabase/serverless` but primary connection uses `pg` Pool)

### Key NPM Packages
- **Frontend:** React 18, Vite, Tailwind CSS v4, Framer Motion, React Three Fiber, Three.js, Wouter, TanStack React Query, shadcn/ui (Radix primitives), Zod
- **Backend:** Express, Passport.js, express-session, ws (WebSocket), Drizzle ORM, drizzle-kit, pg (node-postgres)
- **Shared:** drizzle-zod for schema-to-validator generation

### Environment Variables Required
- `DATABASE_URL` — PostgreSQL connection string (required for persistent storage)
- `SESSION_SECRET` — Optional; auto-generated if not set

### External Services
- No third-party API integrations currently active (blockchain/VRF features described in spec are not yet implemented)
- Asset generation scripts reference Puter.js and Pollinations AI for image generation (development tooling only, not runtime)

### Dev Tooling
- Replit-specific Vite plugins for dev banner, cartographer, and runtime error overlay
- TypeScript with strict mode, bundler module resolution
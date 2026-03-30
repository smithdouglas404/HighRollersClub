# High Rollers Club vs. Stitch Poker Reference - Comprehensive To-Do List

> **Purpose:** Side-by-side comparison of our current project against the Stitch Poker reference files.
> Items marked with decision points need your input before implementation.

---

## LEGEND
- **[NEW]** = Feature we don't have at all
- **[UPGRADE]** = We have this but the reference does it better
- **[CONTENT]** = Content/copy/data changes, not structural
- **[DESIGN]** = Visual/UX improvement from reference
- **[KEEP OURS]** = Our version is superior, no change needed

---

## 1. GAME VARIANT SUPPORT

### 1.1 [NEW] Add Multiple Poker Variants
**Reference has:** Texas Hold'em, Omaha, Short Deck, PLO5 - each with images, descriptions, player count ranges
**We have:** Texas Hold'em only

**Decision needed:**
- Do we want to add Omaha, Short Deck, and/or PLO5?
- This is a MAJOR engine change (hand evaluation, dealing rules, betting rules differ per variant)
- The reference only has UI for variant selection - their engine doesn't actually support them either
- **Priority consideration:** This is the biggest feature gap but also the biggest effort

### 1.2 [NEW] Game Mode Selector on Home/Lobby Page
**Reference has:** 4 clickable game mode cards (with images) that filter the table list
**We have:** Format tab bar (Cash, SNG, Heads Up, Tournament, Bomb Pot) but no variant filtering

**Decision needed:**
- Add game variant cards to the lobby as a visual filter?
- Or keep our format-based filtering and add variant as a secondary filter?

---

## 2. TABLE CREATION

### 2.1 [UPGRADE] Multi-Step Table Creation Wizard
**Reference has:** 8-step wizard with dedicated screens for each setting group:
1. Game Type (visual selector with images)
2. Stakes & Buy-in (auto-calculated BB, buy-in range in BB multiples)
3. Players & Seating (visual elliptical table preview with seat dots positioned trigonometrically)
4. Timer & Blind Structure (button grids for turn timer + time bank)
5. Advanced Rules (straddle, run-it-twice, bomb pots toggles with descriptions)
6. Table Theme (6 color themes with swatches: Neon Vault, Emerald, Crimson, Phantom, Gold Rush, Obsidian)
7. Privacy (public/private with animated password input)
8. Review & Create (summary table of all 12 settings)

**We have:** CreateTableModal - a single modal dialog with all settings

**Decision needed:**
- Replace our modal with a full-page multi-step wizard?
- Or keep the modal but organize it into collapsible sections?
- The wizard approach gives much better UX for mobile and makes each decision feel deliberate

### 2.2 [NEW] Per-Table Theme Selection
**Reference has:** 6 table color themes users pick during creation (each with name, description, color swatch)
**We have:** Table themes exist in our Shop but aren't selectable at table creation time

**Decision needed:**
- Allow theme selection during table creation?
- Use themes from user's inventory, or make base themes free?

### 2.3 [NEW] Visual Seat Preview During Setup
**Reference has:** When selecting max players, an elliptical table graphic shows seat positions as dots
**We have:** Just a number selector

**Decision needed:**
- Add the visual table preview? Nice UX touch, relatively small effort

---

## 3. TOURNAMENT SYSTEM

### 3.1 [NEW] Dedicated Tournament Listing Page
**Reference has:** `/tournaments` page with:
- List of all tournaments as horizontal cards
- Each shows: game type badge, registration status ("Reg Open" with flame icon), tournament name, start time, prize pool (large gradient text), buy-in, registered/max players, Register button
- Prize pool auto-calculated as `buyIn * maxPlayers` if not set
- "Create Tournament" button linking to creation wizard

**We have:** Tournaments are managed within ClubDashboard as a tab, no standalone page

**Decision needed:**
- Create a dedicated `/tournaments` page for all public tournaments?
- Keep club tournaments separate, or merge into one listing?

### 3.2 [NEW] Tournament Creation Wizard
**Reference has:** A completely different visual theme (gold/luxury instead of cyan/neon) with:
- Custom gold navigation bar with "High Rollers Club" crest
- 4 tabs: General, Structure, Financials, Rules
- 4-column layout with separate panels:
  - **Basic Info:** Name, date/time, buy-in, registration fee, reg close time, late registration toggle, number of levels
  - **Structure:** Starting stack, blind level interval (10/15/20/30 min), break schedule with "Add Break"
  - **Financials:** Payout structure dropdown (Top 15%/10%/20%/Winner Take All), guaranteed prize, admin fee %
  - **Rules:** Auto-away on timeout toggle, time bank config, operating hours
- Sticky sidebar "Tournament Summary" showing calculated prize pool, total buy-in, settings overview, "Draft" status
- "Save & Publish" gold gradient button

**We have:** No dedicated tournament creation page

**Decision needed:**
- Build a tournament creation wizard?
- Use the gold luxury theme for tournaments specifically (nice brand differentiation)?
- Include the financial settings (registration fee, admin fee, payout structure)?
- How much of this do we want - simple version or full feature set?

---

## 4. CLUB SYSTEM

### 4.1 [UPGRADE] Club Creation Wizard
**Reference has:** 4-step wizard:
1. **Identity:** Cover image upload, name, description (with char counter)
2. **Configuration:** Max members button grid [10, 25, 50, 100, 200, 500], standard buy-in, summary card
3. **Privacy & Access:** Public/Private radio cards (with Globe/Lock icons and descriptions), admin approval checkbox
4. **Review:** Preview card with cover image, summary table, "Launch Club" button

**We have:** Inline form in ClubDashboard with name, description, logo picker, public/private checkbox

**Decision needed:**
- Upgrade to a multi-step wizard?
- Add cover image upload?
- Add the "require admin approval" option?
- Our logo picker (6 options) is nice - keep it and add to the wizard?

### 4.2 [UPGRADE] Club Detail Page Structure
**Reference has:** 5-tab layout: Overview, Members, Tables, Activity, Settings
- **Overview:** Split view with club tables list + recent activity feed
- **Members:** Search + table with role icons (Crown/Star) + member options (MoreVertical)
- **Tables:** Table list with join/open buttons
- **Activity:** Full activity feed (join events, game events with color coding)
- **Settings:** Inline form (name, description, max members, buy-in)

**We have:** ClubDashboard with 3 tabs (Members, Tournaments, Leaderboard) + separate ClubSettings page

**Decision needed:**
- Merge club tables, activity feed, and overview into ClubDashboard?
- Our Members tab already has more features (role management, kick, search, filters)
- Our separate ClubSettings page has more features (transfer ownership, danger zone, delete)
- Consider adding an "Overview" tab as the landing tab?
- Consider adding a club "Activity" feed?

### 4.3 [KEEP OURS] Club Feature Depth
**Our advantages over reference:**
- Alliance system (multi-club leagues)
- Club events/tournaments
- Club announcements
- Join request management
- Role-based permissions with promote/demote/kick
- Club leaderboard
- Online member tracking
- Logo picker with 6 themed options
- **No changes needed - our club system is deeper**

---

## 5. WALLET SYSTEM

### 5.1 [KEEP OURS] Multi-Wallet Architecture
**Reference has:** No wallet page at all - just a `chips` field on the user
**We have:** 5 separate wallets (Main, Cash Game, SNG, Tournament, Bonus), crypto deposit/withdraw, transfer between wallets, allocation presets, full transaction history

**No changes needed from reference - ours is far superior**

### 5.2 [CONTENT] Wallet Terminology/Framing
**Reference uses:** Simple chip balance displayed in navbar at all times

**Decision needed:**
- Should we add the chip balance to the main navigation bar (always visible)?
- Currently balance is only visible on the Wallet page and Profile page

---

## 6. NAVIGATION & LAYOUT

### 6.1 [UPGRADE] Persistent Chip Balance in Navbar
**Reference has:** User's chip balance always visible in the top navigation bar next to their avatar
**We have:** Chip balance only shown on Wallet and Profile pages

**Decision needed:**
- Add chip balance to the main nav/sidebar? This is a common pattern in poker apps
- Show total across all wallets, or just main wallet?

### 6.2 [DESIGN] App Layout Navigation Style
**Reference has:** Fixed top navigation bar (80px) with:
- Logo with neon glow hover effect
- Horizontal nav links (Lobby, Clubs, Tournaments) with active state neon glow
- Search input (pill-shaped, hidden on mobile)
- User profile pill (avatar + name + chips)

**We have:** DashboardLayout with sidebar navigation

**Decision needed:**
- Keep our sidebar layout (works well for our feature count)?
- Or switch to top nav for a more game-like feel?
- Our sidebar makes sense given we have ~15+ pages vs their 10 routes

### 6.3 [NEW] Global Table Search
**Reference has:** Search input in nav bar with "Search tables..." placeholder
**We have:** Search within the Lobby page only

**Decision needed:**
- Add global table search to the main navigation?
- Or is lobby-level search sufficient?

---

## 7. HOME/LOBBY PAGE

### 7.1 [UPGRADE] Stake-Level Classification System
**Reference has:** Filter pills for stake levels: Micro (BB <= 10), Low (BB 11-50), Mid (BB 51-200), High (BB > 200)
**We have:** No stake-level filtering

**Decision needed:**
- Add stake-level filter pills to the Lobby page?
- Define our own thresholds or use theirs?

### 7.2 [DESIGN] Hero Banner on Lobby
**Reference has:** Full-width hero banner with tagline "High Stakes. Zero Limits.", large "SELECT YOUR GAME MODE" heading, subtitle, all entry-animated
**We have:** Banner carousel (3 rotating banners) + quick play cards

**Decision needed:**
- Our banner carousel is more dynamic - keep it?
- Add a static hero section above or below the carousel?

### 7.3 [KEEP OURS] Quick Play & Hot Tables
**We have:** Quick Match (auto-join), Sit & Go shortcut, Private Game shortcut, Hot Tables section (top 3 by players)
**Reference has:** Just the table list with filters

**No changes needed - our quick play features are better**

---

## 8. POKER TABLE (GAME VIEW)

### 8.1 [DESIGN] Table Visual Polish From Reference
**Reference has:**
- Multi-layered gradient felt surface with CSS
- 7px dark border frame
- 2.5px gold inner rail with glow
- Inner decorative ring
- Subtle light reflection gradient
- Brand watermark at 12% opacity on the felt
- Gold-themed pot display badge
- Custom card back design (dark blue with diagonal pattern, concentric circles, "S" logo)

**We have:** 3D table with Three.js/React Three Fiber, custom card components, ImageTable with felt textures

**Decision needed:**
- Our 3D approach is more advanced technically
- Cherry-pick specific visual elements? (gold rail, brand watermark, reflection gradient)
- The reference's CSS-only approach is lighter weight and may perform better on low-end devices

### 8.2 [NEW] In-Game Admin Controls Panel
**Reference has:**
- Pause/Resume Game toggle
- "Manage Table" button (opens settings modal with wallet limit, blind adjustments)
- "Approve Players" button (opens waiting list panel with player profiles and approve buttons)
- Game Paused modal overlay

**We have:** Some admin controls but may not have:
- Mid-game blind adjustment
- Waiting list approval panel with player details
- Formal game pause overlay

**Decision needed:**
- Review what admin controls we actually have in-game
- Add waiting list approval panel if missing?
- Add mid-game table settings (wallet limit, blind changes)?

### 8.3 [NEW] In-Game Chat Sidebar
**Reference has:** Right sidebar with live chat messages (username in cyan + message text) and chat input
**We have:** ChatPanel.tsx component exists

**Decision needed:**
- Is our ChatPanel already visible in the game view?
- Does it match the reference's always-visible sidebar approach?

### 8.4 [NEW] In-Game Hand History Sidebar
**Reference has:** Right sidebar section below chat showing real-time action log, color-coded (gold for winners, cyan for phase changes, muted for regular actions)
**We have:** HandHistoryDrawer.tsx exists

**Decision needed:**
- Is our hand history drawer already integrated into the game view?
- Should it be always-visible (sidebar) or toggle-open (drawer)?

### 8.5 [KEEP OURS] Game Engine Depth
**Our advantages over reference:**
- Full server-side game engine (69KB engine.ts)
- Provably fair cryptographic shuffling
- AI bot engine with difficulty levels
- Insurance & equity calculator
- Run-it-multiple times
- Video conferencing (Daily.co)
- AI commentary with TTS
- Taunts and emotes
- Hand replay system
- Bomb pot support
- Straddle & big blind ante

**The reference runs a CLIENT-SIDE simulation only - no real game engine. No changes needed from reference for game logic.**

---

## 9. PROFILE PAGE

### 9.1 [UPGRADE] Level/Title System Display
**Reference has:** "Level X Enforcer" title with level badge
**We have:** Rank tier badges (Bronze/Silver/Gold/Platinum/Diamond) based on hands played

**Decision needed:**
- Add a title/class system alongside our tier badges?
- Or is our tier system sufficient?

### 9.2 [CONTENT] Transaction History Button
**Reference has:** "Transaction History" button on profile page
**We have:** Transaction history is in the Wallet page

**Decision needed:**
- Add a quick link to transaction history from the Profile page?
- Our Profile already has "Quick Links" section with a Wallet link - may be sufficient

### 9.3 [KEEP OURS] Profile Depth
**Our advantages:**
- 8 achievement badges with progress bars
- VPIP/PFR statistics
- Taunt voice picker with preview
- Quick navigation links
- Detailed stats breakdown

**Reference profile is very basic (3 stats, no badges, no settings). Keep ours.**

---

## 10. DESIGN SYSTEM

### 10.1 [DESIGN] Neon Vault Design System Components
**Reference defines:**
- `NeonButton` with 6 variants (primary, secondary, destructive, success, ghost, **gold**)
- `GlassCard` with `glass-card` utility class (glassmorphism with gradient overlay)
- `GhostInput` with animated bottom border that expands on focus (neon glow)
- `LuxuryInput` with gold-themed focus state (for tournament pages)
- CSS utilities: `glass-panel`, `glass-ghost`, `neon-text-glow`, `neon-box-glow`, `neon-border-glow`, `gradient-primary`, `gradient-gold`, `gold-glow`, `cyan-glow`, `red-glow`
- Design tokens: 5-level surface system (`surface-lowest` through `surface-highest`)
- Noise texture body background
- Font system: Space Grotesk (display) + Manrope (body)

**We have:** Radix UI components + Tailwind + custom styling

**Decision needed:**
- Adopt any of their design utility classes?
- The `gold` button variant and `LuxuryInput` are useful for tournament/VIP sections
- The 5-level surface system is well-thought-out
- Their noise texture background adds subtle depth

### 10.2 [DESIGN] Playing Card Component
**Reference has:** Elegant card component with:
- Custom card back design (diagonal stripes + concentric circles in gold)
- Spring-physics flip animation (stiffness 200, damping 20)
- Face-up with rank+suit in corners and large center suit

**We have:** Card.tsx component

**Decision needed:**
- Compare our card component to theirs
- Cherry-pick the spring-physics flip animation if we don't have it?

### 10.3 [DESIGN] Framer Motion Animation Patterns
**Reference uses consistently:**
- Staggered fade-up card entry animations
- `AnimatePresence` with `popLayout` mode for list transitions
- Slide transitions between wizard steps
- Scale-up hover effects on cards
- Spring physics for card dealing

**Decision needed:**
- Audit our animation consistency across pages
- Adopt their stagger pattern for lists/grids if we're not doing it

---

## 11. MISSING PAGES (Reference Has, We Don't)

### 11.1 [NEW] Standalone Tournaments Page (`/tournaments`)
**Status:** We show tournaments inside ClubDashboard only
**Recommendation:** Create a dedicated page for browsing all public tournaments

### 11.2 [NEW] Tournament Creation Page (`/tournaments/new`)
**Status:** No dedicated tournament creation flow
**Recommendation:** Build a multi-step or multi-tab wizard

### 11.3 We already have these pages that the reference DOESN'T:
- **Wallet** - Multi-wallet with crypto
- **Shop** - Cosmetics/items store with rarity system
- **Analytics** - Full play style assessment
- **Leaderboard** - Multi-metric rankings
- **AdminDashboard** - Collusion detection, withdrawal management
- **Leagues** - Alliance/season system
- **AllianceDetail** - Multi-club management
- **Members** - Dedicated membership page
- **HandReplay** - Visual hand history viewer
- **LeagueDetail** - League season details

---

## 12. API & DATA MODEL DIFFERENCES

### 12.1 [CONTENT] Game Type Enum
**Reference supports:** `texas_holdem`, `omaha`, `short_deck`, `plo5`
**We support:** Primarily `texas_holdem` + format types (cash, sng, heads_up, tournament, bomb_pot)

**Decision needed:**
- Are game variants (Omaha, etc.) on the roadmap?
- If so, the schema and engine both need updates

### 12.2 [UPGRADE] OpenAPI Specification
**Reference has:** Full OpenAPI 3.1.0 spec (`openapi.yaml`) as single source of truth, with auto-generated TypeScript types via Orval
**We have:** Schema definitions in `shared/schema.ts` using Drizzle + Zod

**Decision needed:**
- Adopt OpenAPI spec as documentation/contract?
- Our approach works but lacks API documentation
- Not urgent but good practice for team collaboration

---

## 13. PRIORITY RANKING (Suggested)

### High Priority (Big impact, reasonable effort)
1. **Persistent chip balance in nav** (6.1) - Quick win, improves UX
2. **Stake-level filtering in Lobby** (7.1) - Quick win, better table discovery
3. **Standalone Tournaments page** (11.1) - Major missing page
4. **Tournament Creation wizard** (3.2) - Major missing flow
5. **Visual table seat preview in setup** (2.3) - Nice UX, moderate effort

### Medium Priority (Good improvements, moderate effort)
6. **Multi-step Table Creation wizard** (2.1) - Better UX than modal
7. **Club Creation wizard upgrade** (4.1) - Better than inline form
8. **In-game admin controls panel** (8.2) - Important for table hosts
9. **Club Overview tab with activity feed** (4.2) - Better club landing
10. **Per-table theme selection** (2.2) - Connects shop to gameplay

### Lower Priority (Nice to have, or big effort)
11. **Gold luxury theme for tournaments** (Design differentiation)
12. **Game variant support** (1.1) - MAJOR engine work
13. **Global table search in nav** (6.3) - Minor UX improvement
14. **Spring-physics card animations** (10.2) - Visual polish
15. **OpenAPI spec documentation** (12.2) - Developer experience
16. **Noise texture background** (10.1) - Subtle visual depth

---

## 14. THINGS WE SHOULD ABSOLUTELY KEEP (Don't Replace With Reference)

| Our Feature | Why It's Better |
|---|---|
| Multi-wallet system | Reference has no wallet at all |
| Provably fair shuffling | Reference has no fairness system |
| AI bot engine | Reference has no AI opponents |
| Video conferencing | Reference has no video |
| Commentary engine + TTS | Reference has nothing like this |
| Hand replay system | Reference has no replay |
| Insurance & run-it-multiple | Reference has no advanced poker features |
| Taunts & emotes system | Reference has no social features |
| Shop with rarity system | Reference has no cosmetics |
| Analytics with play style | Reference has no analytics |
| Leagues & alliances | Reference has no competitive seasons |
| Admin dashboard + collusion | Reference has no admin tools |
| Crypto payments | Reference has no payment system |
| DashboardLayout sidebar | Better for our 15+ page count |
| Banner carousel in Lobby | More dynamic than static hero |
| Quick play shortcuts | Reference has no quick actions |
| Achievement badges | Reference has no achievements |

---

*Generated: 2026-03-30 | Compare: High Rollers Club (current) vs. Stitch Poker reference files*

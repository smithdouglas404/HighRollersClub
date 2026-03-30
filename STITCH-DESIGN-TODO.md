# Stitch Poker Design Match — Comprehensive Screen-by-Screen TODO

> Every Stitch reference screenshot mapped to our current implementation.
> **Design System**: "The Neon Vault" — Dark obsidian (#0e0e0e), Primary cyan (#81ecff), Secondary green (#3fff8b), Tertiary red (#ff7076), Gold (#d4af37).
> **Fonts**: Space Grotesk (display/headlines), Manrope (body).
> **Rules**: No 1px borders. Glassmorphism (backdrop-blur ≥20px). Surface tier hierarchy. No divider lines.

---

## GLOBAL DESIGN SYSTEM (applies to ALL screens)

| # | Item | Status | Notes |
|---|------|--------|-------|
| G1 | Import Space Grotesk + Manrope fonts | NOT DONE | Currently using system/tailwind defaults |
| G2 | Replace all `border` with ghost-borders (15% opacity) or surface tiers | NOT DONE | Many screens use `1px solid rgba(...)` borders |
| G3 | Background color → #0e0e0e (obsidian) | PARTIAL | Some pages use it, others use varied dark blues |
| G4 | Primary accent → #81ecff (cyan) everywhere | PARTIAL | We use mixed cyan/purple/blue accents |
| G5 | Gold (#d4af37) for premium/highlighted elements | PARTIAL | Some gold usage exists |
| G6 | Glassmorphism on all containers (semi-transparent + backdrop-blur ≥20px) | PARTIAL | Some panels have it, most don't |
| G7 | Button style: sharp corners (≤0.125rem), gradient primary CTAs | NOT DONE | We use rounded-lg everywhere |
| G8 | Input fields: ghost-style, surface_container_highest bg, glowing bottom-border on focus | NOT DONE | Standard inputs currently |
| G9 | Status chips: full roundness (9999px) | PARTIAL | Some chips are rounded |
| G10 | Remove all Material Design shadows, use ambient tinted shadows | NOT DONE | Mixed shadow styles |

---

## POKER TABLE (12 reference screens)

### Table 6: Active Poker Table — Pre-Flop
**Reference**: `full_body_avatar_poker_table_6/screen.png`
**Our Page**: `client/src/pages/Game.tsx` + `client/src/components/poker/Seat.tsx`

| # | Feature | Reference | Our Status | Gap |
|---|---------|-----------|------------|-----|
| T1 | Full-body 3D avatars seated around table | Full character models in varied outfits | NOT DONE — we have portrait card thumbnails | Need full-body avatar images or 3D renders |
| T2 | Green oval felt table with gold trim | Realistic felt texture, gold/bronze edge | PARTIAL — we have felt texture, no gold trim | Add gold trim ring around table |
| T3 | Atmospheric ambient lighting | Soft glow effects around table | PARTIAL — added glow orbs | Enhance to match reference depth |
| T4 | Player name + chip count below avatar | Clean label beneath each character | PARTIAL — Seat.tsx shows name/chips in glass panel | Layout needs to match reference positioning |
| T5 | Dealer button (white circle, gold border) | Small disc near dealing player | DONE | Updated in Seat.tsx |
| T6 | Community cards centered on felt | Cards on the table surface | DONE | Card component exists |
| T7 | Bottom action bar (glass-morphic, 40px blur) | Persistent betting controls bar | PARTIAL — Controls.tsx exists | Needs glass-morphic styling per design system |
| T8 | Pot indicator (display-md, primary color, glass plane) | Floating pot display | PARTIAL — pot shown | Needs styling update to match |
| T9 | Player turn glow (luminous primary edge) | Active player has bright ring | PARTIAL — we have glow | Needs primary (#81ecff) luminous edge specifically |
| T10 | Winner gold glow effect | Gold aura on winning player | DONE | Added gold glow to Seat.tsx |

### Table 7: Flop State with Community Cards
**Reference**: `full_body_avatar_poker_table_7/screen.png`

| # | Feature | Reference | Our Status | Gap |
|---|---------|-----------|------------|-----|
| T11 | 3 community cards on felt center | Flop cards displayed | DONE | Card rendering works |
| T12 | Updated chip positions after betting | Chips moved to pot area | PARTIAL | Chip animation exists but positioning may differ |
| T13 | Player card peek (hero hole cards) | Hero's 2 cards visible | DONE | CardSqueeze + hole card display works |

### Table 1: Hand History Log Modal
**Reference**: `full_body_avatar_poker_table_1/screen.png`

| # | Feature | Reference | Our Status | Gap |
|---|---------|-----------|------------|-----|
| T14 | Hand history modal with detailed log | Dark overlay, scrollable text log, X close button | PARTIAL — HandHistoryDrawer exists | Needs styling to match gold text on dark dialog |

### Table 2: Join Game Confirmation Dialog
**Reference**: `full_body_avatar_poker_table_2/screen.png`

| # | Feature | Reference | Our Status | Gap |
|---|---------|-----------|------------|-----|
| T15 | "APPROVE & SIT" modal with avatar | Player avatar, game details, gold button | NOT DONE | We join games directly, no confirmation modal |

### Table 3: Table Settings Configuration Modal
**Reference**: `full_body_avatar_poker_table_3/screen.png`

| # | Feature | Reference | Our Status | Gap |
|---|---------|-----------|------------|-----|
| T16 | In-game settings modal (Blinds, Stack, Ante, Tournament) | Slider controls, gold labels | PARTIAL — InGameAdminPanel exists | Needs visual overhaul to match gold label sliders |

### Table 4 & 9: Game Paused by Admin
**Reference**: `full_body_avatar_poker_table_4/screen.png`, `full_body_avatar_poker_table_9/screen.png`

| # | Feature | Reference | Our Status | Gap |
|---|---------|-----------|------------|-----|
| T17 | "GAME PAUSED BY ADMIN" overlay | Centered text + gold "RESUME GAME" button | NOT DONE | No pause overlay in our game |

### Table 5: Comprehensive Admin Settings Modal
**Reference**: `full_body_avatar_poker_table_5/screen.png`

| # | Feature | Reference | Our Status | Gap |
|---|---------|-----------|------------|-----|
| T18 | Advanced admin settings (Rake, Max Value, Timing rules) | Complex form with dropdowns/toggles | PARTIAL — InGameAdminPanel has some | Missing: rake limits, max value limits, game timing rules |

### Table 8: Player Detail Report Modal
**Reference**: `full_body_avatar_poker_table_8/screen.png`

| # | Feature | Reference | Our Status | Gap |
|---|---------|-----------|------------|-----|
| T19 | Player detail report (win/loss stats, hand outcomes) | Stats grid with color-coded cells | NOT DONE | We have no in-game player detail modal |

### Table 10: Player Kick/Ban Confirmation
**Reference**: `full_body_avatar_poker_table_10/screen.png`

| # | Feature | Reference | Our Status | Gap |
|---|---------|-----------|------------|-----|
| T20 | Kick/Ban dialog with reason dropdown, red kick button | Avatar shown, gold "SAVE TO CLUB" | NOT DONE | Admin controls exist but no kick/ban confirmation dialog |

### Table 11: Global Dashboard (Club Management)
**Reference**: `full_body_avatar_poker_table_11/screen.png`

| # | Feature | Reference | Our Status | Gap |
|---|---------|-----------|------------|-----|
| T21 | Club dashboard with stat cards + 3 table previews | Total Members, Active Tables, Volume stats | PARTIAL — ClubDashboard.tsx exists | Missing: table preview thumbnails, sidebar nav matching reference |

### Table 12: Tournament Leaderboard
**Reference**: `full_body_avatar_poker_table_12/screen.png`

| # | Feature | Reference | Our Status | Gap |
|---|---------|-----------|------------|-----|
| T22 | Tournament leaderboard with top 3 podium avatars | Gold-bordered avatars, ranking table | PARTIAL — Leaderboard.tsx exists | Missing: podium-style top 3, gold avatar borders, prize pool display |

---

## SETUP SCREENS 1-15

### Setup 1: Club Overview / Tournament Center
**Reference**: `detailed_private_table_setup_1/screen.png`
**Our Page**: `client/src/pages/ClubDashboard.tsx`

| # | Feature | Reference | Our Status | Gap |
|---|---------|-----------|------------|-----|
| S1 | 5 gold-bordered stat cards at top | Active Tournaments, Prize Pools, Registered Players, Revenue | PARTIAL — we have overview tab | Need: gold-bordered stat cards, tournament alert sidebar |
| S2 | Tabs: Live Events / Upcoming / Completed / Drafts | Tabbed tournament grid | NOT DONE — tournaments tab exists separately | Need inline tabbed tournament grid |
| S3 | Tournament Alerts sidebar | Notifications about final tables | NOT DONE | Need alert sidebar panel |

### Setup 2: Join Private Game Dialog
**Reference**: `detailed_private_table_setup_2/screen.png`
**Our Page**: None specific

| # | Feature | Reference | Our Status | Gap |
|---|---------|-----------|------------|-----|
| S4 | "Join Table with Code" modal | 6-digit code input, table preview | NOT DONE | Need: join-by-code modal in Lobby |

### Setup 3: Sponsorship Payout Details
**Reference**: `detailed_private_table_setup_3/screen.png`
**Our Page**: None

| # | Feature | Reference | Our Status | Gap |
|---|---------|-----------|------------|-----|
| S5 | Sponsorship payout report | Total Paid, Next Payout, transaction table | NOT DONE | Need: sponsorship/finance report page |

### Setup 4: Global Announcement Control Center
**Reference**: `detailed_private_table_setup_4/screen.png`
**Our Page**: None

| # | Feature | Reference | Our Status | Gap |
|---|---------|-----------|------------|-----|
| S6 | Announcement manager with text input + target audience | Broadcast Now button, live preview | NOT DONE | Need: admin announcement broadcast page |

### Setup 5: Club Overview with Active Tables
**Reference**: `detailed_private_table_setup_5/screen.png`
**Our Page**: `client/src/pages/ClubDashboard.tsx`

| # | Feature | Reference | Our Status | Gap |
|---|---------|-----------|------------|-----|
| S7 | Top stat cards + filterable table grid + activity feed | Featured Tables, Upcoming Tournaments tabs | PARTIAL — overview tab has members/stats | Need: active table cards, filter tabs, activity feed panel |

### Setup 6: Club Member Invite Flow
**Reference**: `detailed_private_table_setup_6/screen.png`
**Our Page**: `client/src/pages/ClubInvitations.tsx`

| # | Feature | Reference | Our Status | Gap |
|---|---------|-----------|------------|-----|
| S8 | Invite form (email/wallet, credit limit), welcome card, pending table | Assigns initial credit, shows welcome certificate | PARTIAL — ClubInvitations page exists | Need: initial credit assignment, welcome card visual, gold styling |

### Setup 7: Club Owner Public Table Browser
**Reference**: `detailed_private_table_setup_7/screen.png`
**Our Page**: `client/src/pages/Lobby.tsx`

| # | Feature | Reference | Our Status | Gap |
|---|---------|-----------|------------|-----|
| S9 | 12-card grid of tables with images, blinds, status, JOIN button | Filter tabs (Stakes, Game Type, Available Seats) | PARTIAL — Lobby has table cards | Need: table image thumbnails, LIVE status badge, gold styling |

### Setup 8: Advanced Table Access Configuration
**Reference**: `detailed_private_table_setup_8/screen.png`
**Our Page**: `client/src/pages/TableSetup.tsx` (Privacy step)

| # | Feature | Reference | Our Status | Gap |
|---|---------|-----------|------------|-----|
| S10 | Toggle switches for access restrictions, role-based access | Detailed permission toggles | PARTIAL — TableSetup has privacy step | Need: expanded access control with role toggles |

### Setup 9: Comprehensive Global Club Settings
**Reference**: `detailed_private_table_setup_9/screen.png`
**Our Page**: `client/src/pages/ClubSettings.tsx`

| # | Feature | Reference | Our Status | Gap |
|---|---------|-----------|------------|-----|
| S11 | Club Preferences (timezone, language) | Dropdowns for TZ, language | NOT DONE in settings | Need: timezone/language settings |
| S12 | Financial Defaults (rake %, max buy-in caps) | Input fields | NOT DONE | Need: financial defaults section |
| S13 | Security (2FA toggle, admin roles, moderator roles) | Toggle + dropdowns | NOT DONE | Need: security settings section |
| S14 | Club Branding (logo upload, theme selection) | Upload + theme picker | PARTIAL — ClubCreate has logo | Need: branding section in settings |
| S15 | Integration & API (external wallet connection) | Connect button | NOT DONE | Need: API/wallet integration section |

### Setup 10: Revenue Reports Dashboard
**Reference**: `detailed_private_table_setup_10/screen.png`
**Our Page**: `client/src/pages/Analytics.tsx`

| # | Feature | Reference | Our Status | Gap |
|---|---------|-----------|------------|-----|
| S16 | Revenue stat cards (Total Revenue, Net Profit, Rake, Tournament Fees) | 5 gold stat cards | PARTIAL — Analytics page exists | Need: gold-bordered cards matching reference |
| S17 | Daily Revenue Trends line chart | Growth chart | PARTIAL — may have charts | Need: styling to match gold/dark theme |
| S18 | Revenue Sources pie chart (Cash 65% / Tournaments 35%) | Pie chart | NOT DONE | Need: revenue sources visualization |
| S19 | Detailed Transaction Log table | Date, Source, Amount, Status | PARTIAL | Need: styled transaction log |

### Setup 11: Breaking News Modal Alert
**Reference**: `detailed_private_table_setup_11/screen.png`
**Our Page**: None

| # | Feature | Reference | Our Status | Gap |
|---|---------|-----------|------------|-----|
| S20 | In-game breaking news modal popup | Alert icon, bold message, close button | NOT DONE | Need: news/announcement modal component |

### Setup 12: Club Member Invitation System
**Reference**: `detailed_private_table_setup_12/screen.png`
**Our Page**: `client/src/pages/ClubInvitations.tsx`

| # | Feature | Reference | Our Status | Gap |
|---|---------|-----------|------------|-----|
| S21 | Invite form with role assignment + sent invites table | Recipient, Role, Status, Actions | PARTIAL — basic invite exists | Need: role assignment dropdown, welcome certificate, resend actions |

### Setup 13: Classic Public Game Browser
**Reference**: `detailed_private_table_setup_13/screen.png`
**Our Page**: `client/src/pages/Lobby.tsx`

| # | Feature | Reference | Our Status | Gap |
|---|---------|-----------|------------|-----|
| S22 | 3×3 grid of table cards in modal with stake filters | High Stakes Elite cards, LIVE badge | PARTIAL — Lobby cards exist | Need: modal version, table images, LIVE badges, gold JOIN buttons |

### Setup 14: Avatar Marketplace and Tiers
**Reference**: `detailed_private_table_setup_14/screen.png`
**Our Page**: `client/src/pages/Shop.tsx`

| # | Feature | Reference | Our Status | Gap |
|---|---------|-----------|------------|-----|
| S23 | Avatar grid with tier levels + purchase summary sidebar | Character cards with tier names, pricing | PARTIAL — Shop has avatar tab | Need: tier system, purchase summary sidebar, gold styling |

### Setup 15: Comprehensive Player Profile Dashboard (Account Setup)
**Reference**: `detailed_private_table_setup_15/screen.png`
**Our Page**: `client/src/pages/Profile.tsx`

| # | Feature | Reference | Our Status | Gap |
|---|---------|-----------|------------|-----|
| S24 | Account creation form + initial avatar selection grid | Profile Name, Email, Password + 4 avatar options | NOT DONE — our profile is post-login | Need: onboarding flow with avatar selection |

---

## SETUP SCREENS 16-30

### Setup 16: Comprehensive Player Profile Dashboard
**Reference**: `detailed_private_table_setup_16/screen.png`
**Our Page**: `client/src/pages/Profile.tsx`

| # | Feature | Reference | Our Status | Gap |
|---|---------|-----------|------------|-----|
| S25 | Large golden avatar + Personal Bio & Stats card | Shows chips, games, performance | PARTIAL — Profile shows stats | Need: large avatar display, golden styling, bio section |
| S26 | Performance Dashboard card with graphs | Charts showing game performance | PARTIAL — basic stats exist | Need: performance graphs |
| S27 | Recent Transactions card | Cash in/out details | DONE — transaction history added | Need: gold styling to match |

### Setup 17: Prize Pool & Tournament Analytics
**Reference**: `detailed_private_table_setup_17/screen.png`
**Our Page**: `client/src/pages/Tournaments.tsx` (partially)

| # | Feature | Reference | Our Status | Gap |
|---|---------|-----------|------------|-----|
| S28 | Tournament overview with financial stats | Prize amounts, player rankings | PARTIAL — tournament list exists | Need: analytics view, payout distribution pie chart |

### Setup 18: Premium Account Upgrade Experience
**Reference**: `detailed_private_table_setup_18/screen.png`
**Our Page**: None

| # | Feature | Reference | Our Status | Gap |
|---|---------|-----------|------------|-----|
| S29 | Premium upgrade page with golden robot avatar | Premium perks list, Monthly/Yearly toggle, UPGRADE button | NOT DONE | Need: premium upgrade page |

### Setup 19: Premium Avatar Marketplace
**Reference**: `detailed_private_table_setup_19/screen.png`
**Our Page**: `client/src/pages/Shop.tsx`

| # | Feature | Reference | Our Status | Gap |
|---|---------|-----------|------------|-----|
| S30 | Premium exclusive avatars with 3D preview | Grid of mythic/legendary avatar cards, pricing in chips/ETH | PARTIAL — Shop exists | Need: premium tier section, 3D preview indicator, ETH pricing |

### Setup 20: Public Lobby / Club Table Listing
**Reference**: `detailed_private_table_setup_20/screen.png`
**Our Page**: `client/src/pages/Lobby.tsx` / `client/src/pages/BrowseClubs.tsx`

| # | Feature | Reference | Our Status | Gap |
|---|---------|-----------|------------|-----|
| S31 | Club/table list with capacity, buy-in, owner avatar | Clean list layout, Join buttons | PARTIAL — Lobby exists | Need: club owner avatar, compact list design |

### Setup 21: Player Security Dashboard
**Reference**: `detailed_private_table_setup_21/screen.png`
**Our Page**: `client/src/pages/Profile.tsx` (partially)

| # | Feature | Reference | Our Status | Gap |
|---|---------|-----------|------------|-----|
| S32 | 3-tab layout: Profile & Edit / Security & Privacy / Financials & Wallets | Avatar edit, 2FA, linked socials, wallet balances | NOT DONE as unified view | Need: security dashboard page or profile tabs |
| S33 | Password Reset option | Reset password flow | NOT DONE | Need: password reset |
| S34 | 2FA toggle (ENABLED) | Two-factor auth toggle | NOT DONE | Need: 2FA management |
| S35 | Linked Social Accounts (Google, Facebook) | Social account icons | NOT DONE | Need: social linking |
| S36 | Connected wallets (MetaMask 5.4 ETH, Coinbase 2.1 ETH) | Wallet balances | NOT DONE | Need: wallet connection display |

### Setup 22: Purchase Success Screen
**Reference**: `detailed_private_table_setup_22/screen.png`
**Our Page**: None

| # | Feature | Reference | Our Status | Gap |
|---|---------|-----------|------------|-----|
| S37 | "PURCHASE SUCCESSFUL!" celebration overlay | Gold effects, VIEW IN WARDROBE / BACK TO MARKET buttons | NOT DONE | Need: purchase confirmation overlay |

### Setup 23: Nano Banana AI Avatar Customizer
**Reference**: `detailed_private_table_setup_23/screen.png`
**Our Page**: None

| # | Feature | Reference | Our Status | Gap |
|---|---------|-----------|------------|-----|
| S38 | Avatar customization lab + high-fidelity render preview | Side-by-side preview, RENDER button | NOT DONE | Need: avatar customization page (complex feature) |

### Setup 24: Club Member Analytics Dashboard
**Reference**: `detailed_private_table_setup_24/screen.png`
**Our Page**: `client/src/pages/Analytics.tsx`

| # | Feature | Reference | Our Status | Gap |
|---|---------|-----------|------------|-----|
| S39 | Active Members line chart | Growth trend | PARTIAL — analytics exists | Need: member-specific analytics |
| S40 | Total Table Volume bar chart | Monthly data | PARTIAL | Need: volume chart |
| S41 | New vs Returning Players pie chart (33%/57%) | Pie chart | NOT DONE | Need: player retention chart |
| S42 | Member Activity table (player names, last active, total stakes) | Activity log | PARTIAL — member data exists | Need: styled activity table |

### Setup 25: Nano Banana Rendering Progress
**Reference**: `detailed_private_table_setup_25/screen.png`
**Our Page**: None

| # | Feature | Reference | Our Status | Gap |
|---|---------|-----------|------------|-----|
| S43 | Avatar rendering progress screen | Glowing figure outline, progress bars | NOT DONE | Need: rendering progress page (tied to AI avatar feature) |

### Setup 26: 2FA Setup Authentication
**Reference**: `detailed_private_table_setup_26/screen.png`
**Our Page**: None

| # | Feature | Reference | Our Status | Gap |
|---|---------|-----------|------------|-----|
| S44 | 2FA setup with QR code + backup codes | Step-by-step guide, ACTIVATE 2FA button | NOT DONE | Need: 2FA setup wizard page |

### Setup 27: Premium Wallet Connection Interface
**Reference**: `detailed_private_table_setup_27/screen.png`
**Our Page**: `client/src/pages/Wallet.tsx`

| # | Feature | Reference | Our Status | Gap |
|---|---------|-----------|------------|-----|
| S45 | 4 wallet cards (MetaMask, Coinbase, WalletConnect, Phantom) | CONNECT button on each, security notice | PARTIAL — Wallet page has crypto support | Need: wallet provider cards with CONNECT buttons |

### Setup 28: Account Recovery Center
**Reference**: `detailed_private_table_setup_28/screen.png`
**Our Page**: None

| # | Feature | Reference | Our Status | Gap |
|---|---------|-----------|------------|-----|
| S46 | 3 recovery methods (crypto wallet, email, backup codes) | Verify Wallet / Send Email / Use Backup Code | NOT DONE | Need: account recovery page |

### Setup 29: Avatar Wardrobe Hub
**Reference**: `detailed_private_table_setup_29/screen.png`
**Our Page**: None (Shop inventory is different)

| # | Feature | Reference | Our Status | Gap |
|---|---------|-----------|------------|-----|
| S47 | Avatar wardrobe with equipped gear display | Main avatar center, outfit cards around, SAVE PRESET | NOT DONE | Need: wardrobe/inventory page with avatar preview |

### Setup 30: Avatar Dye Shop Customization
**Reference**: `detailed_private_table_setup_30/screen.png`
**Our Page**: None

| # | Feature | Reference | Our Status | Gap |
|---|---------|-----------|------------|-----|
| S48 | Dye shop with color pickers + dye packs | Primary/Secondary/Accent color rows, gold/chrome/neon packs | NOT DONE | Need: dye customization shop page |

---

## OTHER REFERENCE SCREENS

### Game Mode Selection Lobby
**Reference**: `game_mode_selection_lobby/screen.png`
**Our Page**: `client/src/pages/Lobby.tsx`

| # | Feature | Reference | Our Status | Gap |
|---|---------|-----------|------------|-----|
| O1 | 3 large game mode cards (Private / Public / Tournament) | Image cards with gold borders, descriptions, CTA buttons | NOT DONE — our lobby is a table list | Need: game mode selection view before table list |
| O2 | "Back to Dashboard" top-left button | Navigation back | DONE — sidebar handles this |
| O3 | Footer links (About, Terms, Privacy, socials) | Footer row | NOT DONE | Need: footer component |

### Comprehensive Tournament Setup
**Reference**: `comprehensive_tournament_setup/screen.png`
**Our Page**: `client/src/pages/TournamentCreate.tsx`

| # | Feature | Reference | Our Status | Gap |
|---|---------|-----------|------------|-----|
| O4 | 4-tab tournament form (General / Structure / Financials / Rules) | Gold tabs, organized inputs | DONE — TournamentCreate has these tabs | Need: gold styling to match |
| O5 | Tournament Summary sidebar (Est. Prize Pool, Players, Duration) | Right sidebar with live calculations | PARTIAL — TournamentCreate has summary | Need: gold-bordered summary card |

### Club Owner Management Hub
**Reference**: `club_owner_management_hub/screen.png`
**Our Page**: `client/src/pages/ClubDashboard.tsx` + `client/src/pages/Members.tsx`

| # | Feature | Reference | Our Status | Gap |
|---|---------|-----------|------------|-----|
| O6 | Sidebar: Dashboard / Tables / Tournaments / Members / Financials | Left nav with gold icons | PARTIAL — DashboardLayout sidebar exists | Need: gold icon styling |
| O7 | Top bar: Club bankroll ($2,540,000), Online Members (128/500) | Header stats | PARTIAL — sidebar shows chip balance | Need: club bankroll display in top bar |
| O8 | Members table (Avatar, Name, Join Date, Contribution, Actions) | Edit/Kick/Promote buttons per row | PARTIAL — Members.tsx exists | Need: contribution column, action buttons |
| O9 | Quick Stats panel (Most Active Table, Top Winners) | Right sidebar | NOT DONE | Need: quick stats sidebar |

### Initial Club Setup Screen
**Reference**: `initial_club_setup_screen/screen.png`
**Our Page**: `client/src/pages/ClubCreate.tsx`

| # | Feature | Reference | Our Status | Gap |
|---|---------|-----------|------------|-----|
| O10 | 4 numbered sections (Identity / Branding / Membership / Financials) | Single-page form with all sections visible | PARTIAL — ClubCreate is multi-step wizard | Need: consider showing all sections or match gold/parchment styling |
| O11 | Logo upload area with circular preview | Upload + preview frame | PARTIAL — ClubCreate has logo grid selection | Need: actual upload option + preview |
| O12 | Color picker (3 swatches) | Brand color selection | NOT DONE | Need: color picker for club branding |
| O13 | Club Type dropdown (Private/Semi-Private/Public) | Dropdown | PARTIAL — privacy step in ClubCreate | Need: dropdown style, semi-private option |
| O14 | Default Player Credit Limit input ($110,000) | Financial field | NOT DONE | Need: credit limit input |

---

## SUMMARY SCORECARD

| Category | Total Items | Done | Partial | Not Done |
|----------|-------------|------|---------|----------|
| Global Design System | 10 | 0 | 4 | 6 |
| Poker Table (12 screens) | 22 | 5 | 10 | 7 |
| Setup Screens 1-15 | 24 | 1 | 10 | 13 |
| Setup Screens 16-30 | 20 | 0 | 5 | 15 |
| Other Screens (4) | 14 | 1 | 7 | 6 |
| **TOTAL** | **90** | **7 (8%)** | **36 (40%)** | **47 (52%)** |

---

## PRIORITY ORDER FOR IMPLEMENTATION

### Phase 1: Design System Foundation (affects everything)
1. G1-G10: Fonts, colors, glassmorphism, buttons, inputs, shadows

### Phase 2: Core Game Table (highest user visibility)
2. T1: Full-body avatars
3. T2: Gold table trim
4. T7: Glass-morphic action bar
5. T8-T9: Pot indicator + turn glow
6. T15: Join game confirmation modal
7. T17: Game paused overlay
8. T19: Player detail report
9. T20: Kick/ban confirmation

### Phase 3: Lobby & Navigation
10. O1: Game mode selection cards
11. S4: Join with code modal
12. S9/S22: Table cards with images + LIVE badges

### Phase 4: Club Management
13. S1-S3: Club overview with tournament center
14. O6-O9: Management hub layout
15. S8/S21: Member invite flow with roles

### Phase 5: Profile & Security
16. S25-S27: Enhanced profile dashboard
17. S32-S36: Security dashboard (2FA, wallets, socials)
18. S44: 2FA setup wizard

### Phase 6: Shop & Avatars
19. S23/S30: Avatar marketplace with tiers
20. S47: Avatar wardrobe hub
21. S37: Purchase success overlay

### Phase 7: Advanced Features (lower priority)
22. S5: Sponsorship payouts
23. S6/S20: Announcement system
24. S29: Premium upgrade page
25. S38/S43: Nano Banana AI customizer
26. S48: Dye shop
27. S46: Account recovery center

---

## NEW PAGES NEEDED

| Page | Reference | Status |
|------|-----------|--------|
| Avatar Wardrobe | Setup 29 | NOT STARTED |
| Avatar Dye Shop | Setup 30 | NOT STARTED |
| Premium Upgrade | Setup 18 | NOT STARTED |
| 2FA Setup Wizard | Setup 26 | NOT STARTED |
| Account Recovery | Setup 28 | NOT STARTED |
| Sponsorship Reports | Setup 3 | NOT STARTED |
| Announcement Manager | Setup 4 | NOT STARTED |
| Player Security Dashboard | Setup 21 | NOT STARTED |
| Avatar AI Customizer | Setup 23 | NOT STARTED |
| AI Render Progress | Setup 25 | NOT STARTED |

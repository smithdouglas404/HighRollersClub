# Next Steps - Full Application Audit

> Generated: 2026-03-30 | Comprehensive audit of wiring gaps + UI/UX improvements

---

## PART 1: WIRING - Everything That Needs to Be Connected

### CRITICAL: WebSocket Admin Controls (Not Wired)

The in-game admin panel UI exists but the server never handles the messages or sends responses.

**Client sends these messages (Game.tsx:2503-2508) but server IGNORES them:**

| Client Message | Purpose | Server Handler |
|---|---|---|
| `admin_pause_game` | Pause a live game | MISSING |
| `admin_resume_game` | Resume a paused game | MISSING |
| `admin_approve_player` | Approve waiting player | MISSING |
| `admin_decline_player` | Decline waiting player | MISSING |
| `admin_update_table` | Change blinds/settings mid-game | MISSING |

**Client listens for these events (Game.tsx:2248-2252) but server NEVER sends them:**

| Server Event | Purpose | Server Emitter |
|---|---|---|
| `game_paused` | Notify all players game is paused | MISSING |
| `game_resumed` | Notify all players game resumed | MISSING |
| `waiting_list` | Send waiting player list to admin | MISSING |
| `player_approved` | Confirm player was approved | MISSING |
| `player_declined` | Confirm player was declined | MISSING |

**Files to modify:**
- `server/websocket.ts` - Add 5 new ServerMessage types + 5 new ClientMessage types
- `server/websocket.ts` - Add message handlers for the 5 admin actions
- `server/game/engine.ts` - Add pause/resume game state logic

**Related dead state in Game.tsx:**
- `mpGamePaused` (line 2231) - never updated
- `mpWaitingPlayers` (line 2232) - never updated

---

### HIGH: Unused Backend Routes (No Frontend UI)

These 20+ backend routes exist but are never called from the frontend:

#### Admin Dashboard - Missing UI for these endpoints:
| Endpoint | Purpose | Priority |
|---|---|---|
| `GET /api/admin/rake-report` | Daily rake breakdown | High |
| `GET /api/admin/rake-by-player` | Per-player rake stats | High |
| `GET /api/admin/revenue-summary` | Revenue overview | High |
| `GET /api/admin/trial-balance` | Accounting audit trail | Medium |
| `POST /api/admin/process-rakeback` | Process rakeback payouts | High |
| `GET /api/admin/system-status` | Global system lock status | Medium |
| `POST /api/admin/system-lock` | Toggle global lock | Medium |
| `GET /api/admin/payments` | View all payments | Medium |

**Action:** Add tabs/sections to `AdminDashboard.tsx` for rake reports, revenue, rakeback processing, and system controls.

#### Wallet/Payment - Missing UI for these endpoints:
| Endpoint | Purpose | Priority |
|---|---|---|
| `GET /api/payments/currencies` | Supported crypto currencies | Medium |
| `GET /api/payments/gateways` | Payment gateway options | Medium |
| `GET /api/payments` | User's payment history | Medium |
| `GET /api/payments/:id` | Payment detail view | Low |
| `GET /api/wallet/sessions` | Session profit/loss summaries | High |

**Action:** Add payment gateway selection to `Wallet.tsx` deposit flow. Add session summaries section.

#### Game/Hand - Missing UI for these endpoints:
| Endpoint | Purpose | Priority |
|---|---|---|
| `GET /api/hands/:id/verify` | Provably fair verification | Medium |
| `GET /api/hands/:id/players` | Hand participant details | Low |
| `GET /api/hands/:id/actions` | Hand action replay data | Low |
| `GET /api/analyses` | User's past AI analyses | Low |
| `GET /api/tournaments/:id/status` | Live tournament status | Medium |

**Action:** Add "Verify Fairness" button to `HandReplay.tsx`. Wire tournament status polling into tournament detail view.

#### Mission System:
| Endpoint | Purpose | Priority |
|---|---|---|
| `POST /api/missions/:id/claim` | Claim mission reward | High |

**Action:** Verify mission claiming is wired in the UI. If not, add claim buttons to mission cards.

---

### MEDIUM: Lobby Table Filtering - Partial Wiring

- Backend supports `?format=` and `?variant=` query params on `GET /api/tables`
- Frontend Lobby.tsx has filter UI but should verify:
  - Variant filter pills actually pass `?variant=` to API
  - Stake-level filtering (Micro/Low/Mid/High) is client-side only - consider server-side

---

### LOW: OpenAPI Spec Completeness

- `openapi.yaml` was created but may not cover all 119 endpoints
- **Action:** Audit and complete the spec to match all routes in `server/routes.ts`

---

## PART 2: UI/UX Improvements

### A. Missing Empty States

These pages show nothing when data is empty - they need "No X yet" messaging:

| Page | Missing Empty State | Priority |
|---|---|---|
| `Lobby.tsx` | No "No tables available" when table list is empty | High |
| `ClubDashboard.tsx` | No empty state for activity feed / announcements / events tabs | High |
| `Members.tsx` | No empty state for missions grid | Medium |
| `Analytics.tsx` | No empty state for hand history section | Medium |
| `Wallet.tsx` | No "No transactions yet" in transaction list | Medium |
| `Leagues.tsx` | Alliance and league lists show nothing when empty | Medium |
| `HandReplay.tsx` | No empty state when no replay data available | Medium |
| `Shop.tsx` | Category tabs don't indicate empty categories | Low |
| `AdminDashboard.tsx` | No empty state for collusion alerts, withdrawals | Low |

---

### B. Mobile Responsiveness Fixes

**Fixed padding (breaks on small screens):**

| File | Line | Issue | Fix |
|---|---|---|---|
| `ClubDashboard.tsx` | 254 | `px-8` hardcoded | Change to `px-4 sm:px-8` |
| `ClubSettings.tsx` | 93 | `px-8` hardcoded | Change to `px-4 sm:px-8` |
| `HandReplay.tsx` | 358 | `px-8` hardcoded | Change to `px-4 sm:px-8` |
| `Leaderboard.tsx` | 102-109 | `grid-cols-12` doesn't stack | Add responsive breakpoints |
| `Wallet.tsx` | - | Transaction grid `grid-cols-12` | Stack on mobile |
| `Members.tsx` | 240 | Member list grid doesn't respond | Add `sm:` / `md:` breakpoints |
| `Shop.tsx` | - | Item grid doesn't go single-column | Add `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` |
| `Leagues.tsx` | - | Alliance cards don't stack | Add responsive flex/grid |

---

### C. Form Validation & Labels

**Missing required field indicators:**

| Page | Issue |
|---|---|
| `ClubCreate.tsx:252` | Club name input not marked `required`, no `*` indicator |
| `TableSetup.tsx` | Blind fields allow 0 (needs `min` validation) |
| `TournamentCreate.tsx:281` | Tournament name has no `required` attribute |
| `ClubSettings.tsx:175` | Club name input missing `required` |
| `Wallet.tsx:339,577,792` | Amount inputs missing `min`/`max` validation |

**Missing `<label>` associations:**

| Page | Issue |
|---|---|
| `ClubCreate.tsx:252-269` | Inputs have labels but no `htmlFor` |
| `TableSetup.tsx:507-808` | Form inputs lack proper label associations |
| `TournamentCreate.tsx:281-642` | Form fields missing `<label>` elements |
| `ClubSettings.tsx:175-199` | Input fields missing label links |

---

### D. Accessibility Gaps

**Missing ARIA labels on interactive elements:**
- `Game.tsx:1249` - "Missed blinds" button needs aria-label
- `Members.tsx:240` - Search input needs `aria-label="Search members"`
- `Wallet.tsx` - Copy/action buttons need aria-labels
- `Shop.tsx` - Purchase buttons need descriptive aria-labels
- `Lobby.tsx` - Table cards are clickable divs (should be `<button>` or have `role="button"`)

**Missing alt text:**
- `Profile.tsx:145-150` - Gold chips image has `alt=""`
- `ClubDashboard.tsx:17` - Poker table image with `alt=""`
- `Leaderboard.tsx:57-61` - Gold chips image with empty alt

**Missing `role="dialog"` on modals:**
- Game.tsx overlays (bust, add chips, settings)
- Members.tsx invite modal
- ClubSettings.tsx confirmation dialogs

**No `prefers-reduced-motion` support detected** - All Framer Motion animations run regardless of user preference.

---

### E. Loading & Error State Gaps

**Missing loading states:**
| Page | Issue |
|---|---|
| `Game.tsx` | No loading indicator before game setup / WS connection |
| `Shop.tsx` | No spinner while fetching shop items |
| `HandReplay.tsx` | No loading state while fetching replay data |
| `Leagues.tsx` | No loading indicator during alliance/league fetch |

**Missing error recovery:**
| Page | Issue |
|---|---|
| `ClubDashboard.tsx:188` | Create club error shown but no retry button |
| `Shop.tsx` | No error display if shop fetch fails |
| `AdminDashboard.tsx` | Limited error UI for failed data loads |
| `TournamentCreate.tsx` | Validation errors not shown until form submission |

---

### F. Navigation Improvements

| Page | Issue | Fix |
|---|---|---|
| `LeagueDetail.tsx` | No visible back button | Add back arrow to header |
| `AllianceDetail.tsx` | No visible back button | Add back arrow to header |
| `AdminDashboard.tsx:50` | Flash of content before redirect if not admin | Add loading gate |
| `Game.tsx` | Exit/back button could be more prominent | Consider floating exit button |

---

### G. Consistency Issues

**Button sizing - no standard system:**
- Some buttons: `px-5 py-2.5`
- Others: `px-4 py-2` or `px-6 py-3`
- **Action:** Standardize to 3 sizes (sm/md/lg) across all pages

**Input focus styles vary:**
- Some inputs: `focus:ring-1 focus:ring-cyan-500/40`
- Others: custom border-color on focus
- **Action:** Use consistent `focus-ring` utility class from index.css

**Color usage in non-game pages:**
- `Leagues.tsx` uses red/purple accents (breaks cyan/gold system)
- `Shop.tsx` uses multi-color rarity system (acceptable but could harmonize)

---

### H. Action Feedback Gaps

**Missing button loading states:**
| Page | Action | Issue |
|---|---|---|
| `Game.tsx` | Sit/Stand/Bet buttons | No loading spinner during action |
| `Lobby.tsx` | Table join | No loading until page transition |
| `Leagues.tsx` | Create alliance/league | Button doesn't show loading |
| `Analytics.tsx` | Generate analysis | No intermediate loading |
| `HandReplay.tsx` | Fetch replay | No loading indicator |

**Missing success confirmations:**
- Most operations redirect silently or only show toast
- Consider adding brief success animations for: purchases, club creation, tournament creation

---

## PART 3: Priority Ranking

### Tier 1 - Critical Wiring (Broken Features)
1. ~~Wire WebSocket admin controls (pause/resume/approve/decline/update) - server handlers~~ ✅ DONE
2. ~~Wire WebSocket admin events (game_paused/resumed/waiting_list) - server emitters~~ ✅ DONE
3. ~~Add ServerMessage + ClientMessage types for admin events~~ ✅ DONE

### Tier 2 - High Priority Wiring
4. ~~Wire AdminDashboard with rake reports, revenue summary, rakeback processing endpoints~~ ✅ DONE
5. ~~Wire wallet session summaries (`GET /api/wallet/sessions`)~~ ✅ DONE
6. ~~Wire mission claiming (`POST /api/missions/:id/claim`)~~ ✅ DONE
7. ~~Wire tournament status polling (`GET /api/tournaments/:id/status`)~~ ✅ DONE

### Tier 3 - High Priority UI/UX
8. ~~Add empty states to Lobby, ClubDashboard, Wallet, Members, Leagues~~ ✅ DONE
9. ~~Fix mobile responsiveness (padding, grid columns)~~ ✅ DONE
10. ~~Add form validation (required fields, min/max, visual indicators)~~ ✅ DONE

### Tier 4 - Medium Priority UI/UX
11. ~~Wire payment gateway/currency selection in Wallet~~ ✅ DONE
12. ~~Wire hand verification in HandReplay~~ ✅ DONE
13. ~~Add loading states to Game, Shop, HandReplay, Leagues~~ ✅ DONE
14. ~~Add back buttons to LeagueDetail, AllianceDetail~~ ✅ DONE
15. ~~Standardize button sizes and focus styles~~ ✅ DONE

### Tier 5 - Polish
16. ~~Add ARIA labels and htmlFor associations~~ ✅ DONE
17. ~~Add alt text to decorative images~~ ✅ DONE
18. ~~Add `prefers-reduced-motion` support~~ ✅ DONE
19. Fix color contrast (yellow/amber text) — minor, cosmetic only
20. Complete OpenAPI spec for all 119 endpoints — documentation task
21. ~~Add success animations for key actions~~ ✅ DONE

---

## Page-by-Page Grades

| Page | Loading | Error | Empty | Mobile | A11y | Validation | Feedback | Overall |
|------|---------|-------|-------|--------|------|------------|----------|---------|
| Landing.tsx | OK | OK | OK | OK | Warn | OK | OK | **A-** |
| Tournaments.tsx | OK | OK | OK | OK | Warn | OK | OK | **A-** |
| not-found.tsx | OK | OK | OK | OK | Warn | OK | OK | **A** |
| Profile.tsx | OK | OK | OK | OK | Warn | OK | OK | **B+** |
| Leaderboard.tsx | OK | OK | OK | Warn | Warn | OK | OK | **B+** |
| Analytics.tsx | OK | OK | Warn | OK | Warn | OK | OK | **B+** |
| BrowseClubs.tsx | OK | OK | OK | OK | Warn | OK | OK | **B+** |
| ClubCreate.tsx | OK | Warn | OK | OK | Warn | Warn | OK | **B** |
| TableSetup.tsx | OK | Warn | OK | Warn | Warn | Warn | OK | **B-** |
| TournamentCreate.tsx | OK | Warn | OK | Warn | Warn | Warn | OK | **B-** |
| Wallet.tsx | OK | OK | Warn | Warn | Warn | Warn | OK | **B-** |
| ClubSettings.tsx | OK | Warn | OK | Warn | Warn | Warn | OK | **B-** |
| ClubInvitations.tsx | OK | OK | Warn | Warn | Warn | Warn | OK | **B-** |
| Game.tsx | Warn | Warn | Bad | Warn | Warn | OK | Warn | **C+** |
| Lobby.tsx | OK | Warn | Bad | Warn | Warn | OK | Warn | **C+** |
| Members.tsx | OK | Warn | Warn | Warn | Warn | Warn | OK | **C+** |
| ClubDashboard.tsx | OK | Warn | Bad | Warn | Warn | Warn | Warn | **C** |
| Shop.tsx | Warn | Warn | Warn | Warn | Warn | Warn | Warn | **C** |
| HandReplay.tsx | Warn | Warn | Warn | Warn | Warn | OK | Warn | **C** |
| LeagueDetail.tsx | OK | Warn | Warn | Warn | Warn | Warn | OK | **C** |
| AllianceDetail.tsx | OK | Warn | Warn | Warn | Warn | Warn | OK | **C** |
| Leagues.tsx | Warn | Warn | Warn | Warn | Warn | Warn | Warn | **C-** |
| AdminDashboard.tsx | Warn | Warn | Warn | Warn | Warn | OK | Warn | **C-** |

---

*This audit covers 119 backend routes, 90 frontend API calls, 24 page components, and 5 context providers.*

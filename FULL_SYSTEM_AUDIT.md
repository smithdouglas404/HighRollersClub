# Full System Audit Report

**Date:** 2026-02-27
**Scope:** Complete end-to-end audit of ALL features
**Total Issues Found:** 118

---

## CRITICAL (Data Loss / Security Breach) — 4 Issues

| # | System | File | Description |
|---|--------|------|-------------|
| 1 | Profile | `routes.ts:506` | `PUT /api/profile/avatar` returns full user object **including password hash** to client |
| 2 | Hand History | `routes.ts:676` | `/api/hands/:id/players` exposes ALL players' hole cards to **unauthenticated** users — enables cheating |
| 3 | Wallet | `routes.ts:549` | Daily bonus claim **race condition** — two concurrent requests both pass time-check, double-crediting chips |
| 4 | Wallet | `routes.ts:959` | Shop purchase **race condition** — concurrent purchases can go negative balance |

---

## HIGH Severity — 25 Issues

### Security / Authorization
| # | System | File | Description |
|---|--------|------|-------------|
| 5 | Clubs | `routes.ts:398` | Any user can join **private clubs** without invitation via direct POST to `/join` |
| 6 | Clubs | `routes.ts:476` | Club event creation has **no admin/owner role check** — any member can create events |
| 7 | Clubs | `routes.ts:318` | Any authenticated user can accept/decline **any** invitation (no ownership check on `invId`) |
| 8 | Leagues | `routes.ts:1343-1422` | **All 5 league routes** (create/edit/delete/standings/complete) have no role check — any logged-in user can modify any league |
| 9 | Lobby | `websocket.ts:21` | Private table **password never sent** over WebSocket — password check is REST-only, WS join bypasses it entirely |
| 10 | Auth | `auth.ts:193` | **No character validation** on username — HTML special chars allowed (XSS vector in non-React contexts) |
| 11 | Auth | `auth.ts:59` | `SESSION_SECRET` regenerated on every restart when env var not set — invalidates all sessions |

### Data Integrity
| # | System | File | Description |
|---|--------|------|-------------|
| 12 | Clubs | `routes.ts:258` | **Ownership transfer silently broken** — `ownerId` destructured but never passed to `updateClub()` |
| 13 | Clubs | `routes.ts:158` | `GET /api/clubs` returns **no `memberCount`** — Browse Clubs shows blank/0 for all clubs |
| 14 | Clubs | `routes.ts:148` | `GET /api/me/clubs` also **missing `memberCount`** — Dashboard shows wrong counts |
| 15 | Leagues | `Leagues.tsx:213` | Alliance member count shows **NaN** — raw `memberCount` is undefined in club data |
| 16 | Wallet | `Wallet.tsx:62` | Transaction filter `"buy_in"` never matches — server stores as `"buyin"` (no underscore) |
| 17 | Engine | `engine.ts:1329` | `state.pot` **not zeroed** after `endHandLastStanding` — stale pot broadcast to clients |
| 18 | Engine | `engine.ts:952` | Run-it-multiple: **no deck bounds check** — `undefined` cards pushed when deck exhausted |
| 19 | Table Mgr | `table-manager.ts:598` | Bot replacement **race condition**: fold + forceRemove during active hand corrupts engine state |
| 20 | Table Mgr | `table-manager.ts:780` | **Non-atomic cashout** — concurrent cashouts double-credit wallet balance |
| 21 | Table Mgr | `table-manager.ts:684` | Multiple `hand_countdown` timers **stack** — bots joining cause multiple `startHand` callbacks |
| 22 | WebSocket | `websocket.ts:282` | Table-switching sets `tableId=null` **before** new join succeeds — player orphaned if join fails |
| 23 | Multiplayer | `multiplayer-engine.ts:44` | Server `"waiting"` phase remapped to `"pre-flop"` — incorrect phase labels in UI |
| 24 | Game UI | `Game.tsx:717` | `minBet` prop passes `minRaise` — slider allows **0-chip raise** when no current bet |
| 25 | Wallet | `routes.ts:1095` | Tournament registration chip deduction is **non-atomic** (TOCTOU) |
| 26 | Wallet | `routes.ts:860` | Mission reward **double-spend** — no atomic guard on concurrent claims |

---

## MEDIUM Severity — 38 Issues

### Clubs & Organizations
| # | Description |
|---|-------------|
| 27 | Private clubs exposed to unauthenticated users in browse list API |
| 28 | Duplicate invitations created — no uniqueness check on `(clubId, userId, type, status)` |
| 29 | No auth on `GET /api/clubs/:id/members` and `/members/stats` — privacy leak |
| 30 | `handleInvitation` uses active club ID, may not match invitation's actual club |
| 31 | Any authenticated user can read another club's invitation list |
| 32 | Transfer ownership shows no error feedback on failure (empty catch) |
| 33 | "manager" role shown in UI but never assignable (dead UI state) |
| 34 | `sendError` in ClubInvitations is dead code — context `sendInvite` never throws |
| 35 | Alliance `remove-club` missing `clubId` guard — undefined not rejected |
| 36 | Race condition — double-create alliance for same club possible |
| 37 | Missing validation in announcement creation — 500 instead of 400 on empty title |

### Game Engine & Gameplay
| # | Description |
|---|-------------|
| 38 | Ante posting doesn't set `p.currentBet` — wrong call amount on pre-flop |
| 39 | `removePlayer` for all-in player orphans their pot contribution (chip leakage) |
| 40 | `buyTime` adds to `totalBetThisHand` — corrupts side-pot distribution |
| 41 | Bot stagger: `delay * i` produces exponential delays (up to 16s for last bot) |
| 42 | Disconnect auto-fold timer captures player ref, not hand number — can fold wrong hand |
| 43 | SNG bot buy-in inflates prize pool — bots pay no real chips but add to pool |
| 44 | SNG leave forfeits even between hands — chip balance not returned |
| 45 | Concurrent `join_table` messages can trigger double atomic deduction |
| 46 | `timeLeft` uses time-bank remaining, not actual turn deadline — timer ring shows wrong value |
| 47 | Controls not explicitly disabled during `collecting-seeds` phase |
| 48 | Bot raise below `minRaise` silently rejected → turn timer fires → unexpected fold |
| 49 | Stale AI result can act if bot is thinking again in next hand |
| 50 | No "cancel countdown" when player leaves below minimum — client countdown goes stale |
| 51 | Table `status` never updated to "playing" — all tables show "Waiting" in lobby |
| 52 | Lobby `playerCount` excludes bots — table appears emptier than it is |
| 53 | `evaluateHand` with <5 cards pads with dummy 2-of-spades — can create false pairs/flushes |
| 54 | Table password stored in sessionStorage before validation |
| 55 | `add_chips` allows stacking above maxBuyIn — no headroom check |

### Profile / Analytics / Auth
| # | Description |
|---|-------------|
| 56 | VPIP/PFR treated as raw percentages in Analytics — should divide by handsPlayed |
| 57 | Profile "Hand History" button routes to /analytics (wrong page) |
| 58 | Profile stats fetch ignores 401 (session expiry) — shows zeros with no error |
| 59 | Login rate limiter count not incremented on success path — interleaved resets |
| 60 | Session cookie missing `sameSite` attribute in development |
| 61 | Auth context `logout()` silently clears local state even if server fails |
| 62 | Hand history sort order inconsistent between MemStorage and DatabaseStorage |
| 63 | HandHistoryDrawer stale closure — doesn't re-fetch on tableId change |
| 64 | "Add Chips" button condition has JavaScript operator precedence issue |

---

## LOW Severity — 28 Issues

| # | Description |
|---|-------------|
| 65 | Full reload on every invite — if reload fails, UI stale |
| 66 | "Browse Alliances" button navigates to leagues page, not alliances tab |
| 67 | Browse list doesn't refresh memberCount after joining |
| 68 | Dashboard fetches all alliances instead of using `/api/clubs/:id/alliance` |
| 69 | Invite failure shows no inline error in Members.tsx |
| 70 | No explicit nav or error state after club creation fails |
| 71 | Old accepted/declined invitations accumulate — no cleanup |
| 72 | Alliance `remove-club` silently succeeds if clubId not in alliance |
| 73 | Leave Alliance 403 shows generic toast, no specific message |
| 74 | Auth check before schema validation in PUT alliance |
| 75 | Empty standings array gives unhelpful 400 error |
| 76 | `checkEligibility` calls N serial fetches instead of parallel |
| 77 | WalletBar ignores error message from context |
| 78 | Daily status not refreshed after balance operations |
| 79 | `staleTime: Infinity` in React Query prevents automatic data refresh |
| 80 | AuthUser type missing `lastDailyClaim`, stale session chipBalance |
| 81 | No profile edit UI despite Edit icon imported |
| 82 | Leaderboard: 401 treated same as "no data" |
| 83 | Win rate metric uses raw pot-won count (1-hand player tops leaderboard) |
| 84 | All hand history routes have no authentication |
| 85 | Null hand summary not distinguished from missing data in replay |
| 86 | Analytics page silently swallows all errors |
| 87 | `requireAdmin` defined twice (inline + separate const) |
| 88 | `/api/tables` unauthenticated — private table metadata visible to anonymous |
| 89 | "NEW HAND" button has no onClick — purely decorative |
| 90 | Spatial sound uses array index not visual seat index — wrong position |
| 91 | `hand_countdown` uses uncorrected setInterval — drifts |
| 92 | `betAmount` not reset on new hand — accidental overbet possible |

---

## Bug Pattern Summary

| Pattern | Count | Examples |
|---------|-------|---------|
| **Race conditions / TOCTOU** | 8 | Daily bonus, shop, cashout, tournament, mission, alliance create, join_table |
| **Missing auth/role checks** | 12 | Leagues (all 5 routes), club events, members, invitations, hand history |
| **Stale state / no refresh** | 10 | memberCount, wallet balance, phase mapping, countdown, betAmount |
| **Data field mismatches** | 5 | buy_in vs buyin, memberCount undefined, VPIP raw vs %, pot not zeroed |
| **Silent error swallowing** | 8 | Logout, analytics, profile, invite, ownership transfer |
| **Missing input validation** | 4 | Username chars, announcements, clubId guard, password bypass |
| **Chip integrity issues** | 6 | Pot not zeroed, orphaned contributions, buyTime in totalBet, SNG bot inflation |

---

## Recommended Fix Priority

### Immediate (Security)
1. Strip password hash from `/api/profile/avatar` response
2. Add auth + ownership check to `/api/hands/:id/players`
3. Add password field to WebSocket `join_table` message
4. Fix all race conditions with atomic operations
5. Add role checks to all league routes

### High Priority (Data Integrity)
6. Add `memberCount` enrichment to club list APIs
7. Fix transaction type mismatch (`buyin` vs `buy_in`)
8. Zero `state.pot` after `endHandLastStanding`
9. Fix bot replacement race condition
10. Add deck bounds check in run-it-multiple

### Medium Priority (UX)
11. Fix phase mapping (`waiting` → `pre-flop`)
12. Fix timer ring calculation (use turnDeadline, not timeBank)
13. Fix bot stagger timing formula
14. Add cancel-countdown mechanism
15. Fix VPIP/PFR display in Analytics

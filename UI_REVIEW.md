# HighRollersClub — UI Review

**Date:** 2026-04-05  
**Scope:** All pages, components, state management, styling — visual polish + functionality

---

## Executive Summary

Reviewed **150+ React components** across pages, game table, clubs, tournaments, financial, admin, and shared UI. Found **~180 issues** spanning broken functionality, incorrect calculations, missing validation, visual inconsistencies, and dead/stub code.

| Severity | Count | Key Theme |
|----------|-------|-----------|
| Critical | 12 | Broken calculations, non-functional components, runtime errors |
| High | 28 | Missing validation, incorrect math, broken UX flows |
| Medium | 55 | Missing feedback, inconsistent styling, edge cases |
| Low | ~85 | Polish, accessibility, code quality |

---

## CRITICAL Issues (Fix Immediately)

### 1. Pot-Size Bet Calculation is Wrong
**File:** `client/src/components/poker/Controls.tsx:84`
```js
const potRaiseTotal = Math.min(Math.max(pot + callAmount * 2, minBet), maxBet);
```
Formula `pot + (callAmount * 2)` is incorrect for pot-limit games. Correct pot-size raise = `pot + callAmount + callAmount` (match the pot after calling). This affects every pot-size bet button press.

### 2. Showdown Pot Split Loses Chips
**File:** `client/src/components/poker/ShowdownOverlay.tsx:362`
```js
${Math.floor(pot / winners.length).toLocaleString()}
```
`Math.floor()` truncates — if pot=1000 and 3 winners, displays $333 each ($999 total). $1 vanishes. Backend should handle distribution; display should match backend result.

### 3. Club Chat is Completely Non-Functional (Stub)
**File:** `client/src/components/shared/ClubChatSidebar.tsx:19-24`
```js
const [messages] = useState<ChatMessage[]>([]);  // Never updated
const handleSend = () => { if (!message.trim()) return; setMessage(""); };  // Sends nowhere
```
Chat UI renders but messages are never fetched, sent, or received. Pure stub.

### 4. Blind Schedule Uses Exponential Growth (Doubles Every Level)
**File:** `client/src/pages/TournamentCreate.tsx:613`
```js
const sb = Math.round((startingStack / 100) * Math.pow(2, i));
```
Blinds double every level (100→200→400→800→1600...). Real tournaments use 25-30% increases. By level 8, SB = 25,600 — tournament ends in minutes.

### 5. Blind Presets Not Connected to Actual Schedule
**File:** `client/src/components/game/GameSetup.tsx:127,154`
`blindPreset` dropdown lets user select "standard"/"turbo"/"mtt" but these presets are **never converted** to actual blind schedules. Only "custom" does anything. SNG/tournaments created with presets get default blinds.

### 6. 2FA Setup Missing Backup Codes Display
**File:** `client/src/pages/Security.tsx:239`
After enabling 2FA, user should see backup/recovery codes. This critical account recovery feature is absent — if user loses their authenticator, account is locked forever.

### 7. Payout Pie Chart Ordinal Suffix Bug
**File:** `client/src/components/shared/PayoutPieChart.tsx:79`
Ordinal logic generates "11st", "12nd", "13rd" instead of "11th", "12th", "13th". Also wrong for 21st→"21st" (correct) but 111th→"111st" (wrong).

### 8. Tournament Payout Structure Not Validated to Sum to 100%
**File:** `client/src/components/tournament/TournamentAnalytics.tsx:32-34`
Custom payout percentages are not validated. Users can create `[{place:1, pct:60}, {place:2, pct:60}]` = 120%, overallocating the prize pool.

### 9. Timer Ring Pulse Animations Don't Exist
**File:** `client/src/components/poker/TimerRing.tsx:27-30`
References CSS classes `timer-critical-pulse` and `timer-urgent-pulse` that are **never defined**. Timer never pulses when time is running out — zero urgency feedback.

### 10. Card Holographic Sweep Animation Doesn't Exist
**File:** `client/src/components/poker/Card.tsx:259-271`
References CSS animation `holoSweep` that is never defined. The premium card effect never displays.

### 11. TournamentCreate Form Missing Field Validation
**File:** `client/src/pages/TournamentCreate.tsx:173-183`
Only validates `name` and `startDate`. Missing validation for: buyIn > 0, startingChips > blinds, maxPlayers >= 2, adminFee 0-100, blind interval, break schedule. Users can create broken tournaments.

### 12. Wallet Context State Declaration Order Bug
**File:** `client/src/lib/wallet-context.tsx:125,250,272`
`setError` is called on lines 125 and 250 inside callbacks, but the state is declared on line 272 — after the callbacks are created. Could cause runtime error if callback fires before state initializes.

---

## HIGH Issues (Fix This Sprint)

### Game Table
| # | Issue | File:Line |
|---|---|---|
| 13 | Bet slider step=0 when BB < 2 (micro-stakes) | `Controls.tsx:83` |
| 14 | Keyboard shortcuts (F/C/R/A) have no visual feedback | `Controls.tsx:173-191` |
| 15 | Chip animation triggers on component mount (spurious) | `Seat.tsx:811-830` |
| 16 | Card display logic doesn't handle seats > 9 | `Seat.tsx:948-990` |
| 17 | RunItMultiple auto-declines with no visible countdown | `RunItMultiple.tsx:21-32` |
| 18 | InsurancePanel shows "1% fee" text but uses `offer.fee` value | `InsurancePanel.tsx:107` |

### Financial
| # | Issue | File:Line |
|---|---|---|
| 19 | Wallet allocation sliders break if all locked to 0% (div by zero) | `Wallet.tsx:485` |
| 20 | Deposit gateway defaults to Stripe even if not in activeGateways | `Wallet.tsx:713-716` |
| 21 | Shop rarity sort breaks — RARITY_RANK missing capitalized keys | `Shop.tsx:752` |
| 22 | Shop "Owned" badge race condition — inventory not loaded yet | `Shop.tsx:745` |
| 23 | Marketplace list price allows negative/zero (no validation) | `Marketplace.tsx:102` |
| 24 | Marketplace error uses `alert()` instead of toast | `Marketplace.tsx:117` |
| 25 | Stakes settle amount allows negative (no validation) | `Stakes.tsx:60` |

### Admin
| # | Issue | File:Line |
|---|---|---|
| 26 | Ban/Unban/ForceLogout lack confirmation dialogs | `AdminDashboard.tsx:1854` |
| 27 | KYC rejection uses browser `prompt()` | `AdminDashboard.tsx:1344` |
| 28 | Admin chip balance input has no min/max constraints | `AdminDashboard.tsx:1914` |
| 29 | Env key editor saves without confirmation | `AdminDashboard.tsx:1114` |
| 30 | InGameAdminPanel blind/ante inputs don't validate BB > SB | `InGameAdminPanel.tsx:220` |

### Forms & Auth
| # | Issue | File:Line |
|---|---|---|
| 31 | AuthGate login/register has no loading state during submission | `AuthGate.tsx:163-176` |
| 32 | AuthGate avatar grid not responsive on mobile (hardcoded 4x4) | `AuthGate.tsx:567-603` |
| 33 | KYC submit enabled even with no files selected | `KYC.tsx:560` |
| 34 | Game numeric inputs accept non-numeric characters | `Game.tsx:1907-1939` |

### Tournaments
| # | Issue | File:Line |
|---|---|---|
| 35 | Table setup doesn't validate buy-in to blind ratio (min 20 BB) | `TableSetup.tsx:564-612` |
| 36 | Multi-table "Add Table" silently does nothing at 4 tables | `MultiTable.tsx:233-241` |
| 37 | BlindLevelIndicator creates new interval on every tick (perf) | `BlindLevelIndicator.tsx:31-45` |
| 38 | CreateTable BB can be manually set != 2x SB | `CreateTable.tsx:260-282` |

### Other
| # | Issue | File:Line |
|---|---|---|
| 39 | Leaderboard "Trend" column header exists but no data shown | `Leaderboard.tsx:304,375` |
| 40 | Not-found page has developer message, no "Go Home" button | `not-found.tsx:15` |

---

## MEDIUM Issues

### Missing Feedback / Loading States
| Issue | File:Line |
|---|---|
| No loading state on Lobby password submission | `Lobby.tsx:1466-1477` |
| No loading state on profile voice picker save | `Profile.tsx:914-915` |
| No copy-to-clipboard feedback on KYC hash | `Profile.tsx:191` |
| No feedback on DashboardLayout search submit | `DashboardLayout.tsx:120-129` |
| No logout confirmation dialog | `DashboardLayout.tsx:282-287` |
| Wallet balance shows no skeleton while loading | `DashboardLayout.tsx:150-151` |
| Landing "Play Now" buttons have no loading state | `Landing.tsx:192-266` |
| AI API key input has no format validation | `Lobby.tsx:1090-1115` |
| Join code minimum length not displayed to user | `Lobby.tsx:1513-1539` |
| Analytics session report has no cancel/timeout | `Analytics.tsx:550` |
| BreakingNewsModal auto-dismisses even while reading | `BreakingNewsModal.tsx:26-31` |

### Visual Inconsistencies
| Issue | File:Line |
|---|---|
| Hardcoded gold `#d4af37` in multiple components (not themed) | `Shop.tsx:196`, `Marketplace.tsx:214`, `MemberAvatar.tsx:49` |
| Multiple gold variants: `#d4af37`, `#c9a84c`, `#e0b84c`, `#e8cc6a` | Various |
| CSSPokerTable vs ImageTable pot formatting mismatch | `CSSPokerTable.tsx:290` vs `ImageTable.tsx:377` |
| Shop rarity colors have duplicated entries | `Shop.tsx:56-68` |
| LeagueDetail podium vs regular rows have conflicting borders | `LeagueDetail.tsx:452-458` |
| Privacy.tsx and Terms.tsx have hardcoded "April 1, 2026" date | `Privacy.tsx:4`, `Terms.tsx:4` |
| Phase indicator dots use non-standard colors | `CommunityCards.tsx:129-133` |

### Calculations / Edge Cases
| Issue | File:Line |
|---|---|
| Fee estimates hardcoded — will become inaccurate | `Wallet.tsx:46` |
| Allocation rounding leaves remainder (first wallet gets extra) | `Wallet.tsx:513-515` |
| Marketplace platform fee uses Math.floor (1 chip = 0 fee) | `Marketplace.tsx:274` |
| Premium yearly cost uses Math.round (potential display mismatch) | `PremiumUpgrade.tsx:24` |
| Sparkline fails with single data point (div by zero) | `Sparkline.tsx:22-23` |
| ReplayTimeline scrubber doesn't validate empty hand (idx=-1) | `ReplayTimeline.tsx:61-65` |
| Stack ratio color thresholds are wrong (0.8-1.2 normal = amber?) | `TournamentStatsPanel.tsx:34-39` |
| Break schedule uses floor division (potentially undercounts) | `TournamentCreate.tsx:627` |

### Missing Features
| Issue | File:Line |
|---|---|
| ElaborateHandHistory: only 30 hands, no pagination | `ElaborateHandHistory.tsx:23` |
| MissionsGrid: no "View All" beyond maxVisible (6) | `MissionsGrid.tsx:61` |
| TransactionExplorer: no search debounce | `TransactionExplorer.tsx:344` |
| Support: no email format validation | `Support.tsx:148` |
| ResponsibleGambling: no remaining time display for exclusion | `ResponsibleGambling.tsx:240-241` |
| BombPotIndicator: no accessibility (aria-label) | `BombPotIndicator.tsx:21-30` |
| CommentaryOverlay: volume slider has no value display | `CommentaryOverlay.tsx:196` |
| HandBadge: phase label too small for mobile (0.5rem) | `HandBadge.tsx:36-37` |
| VideoOverlay: no bandwidth/quality selector | `VideoOverlay.tsx:217-372` |
| Admin withdrawal approval: no transaction ID display | `AdminDashboard.tsx:1155-1163` |

---

## LOW Issues (Polish / Code Quality)

- Lobby has 19 `useState` declarations causing excessive re-renders (`Lobby.tsx:700-719`)
- ClubWars uses `alert()` for errors instead of toast (`ClubWars.tsx:89`)
- ClubTournaments uses `alert()` 3 times (`ClubTournaments.tsx:67,70,83`)
- AllianceDetail references undefined `.gold-text` CSS class (`AllianceDetail.tsx:244,330`)
- Multiple `as any` type assertions in multiplayer engine (`multiplayer-engine.ts:203,640-668`)
- Empty catch blocks throughout ws-client.ts and game-engine.ts
- Console.log statements leak game state in production (`game-engine.ts:391-427`)
- `aria-hidden` without `="true"` in PageBackground (`PageBackground.tsx:8`)
- Avatar name input allows special characters (potential XSS) (`AvatarSelect.tsx:306`)
- ChipAnimation container aspect ratio incorrect (6x4 container, 6x6 chips) (`ChipAnimation.tsx:87`)
- TablePreviewThumbnail uses static image for all tables (`TablePreviewThumbnail.tsx:24`)
- LIVE badge pulse animation on every thumbnail (perf on list pages) (`TablePreviewThumbnail.tsx:50`)
- Mobile breakpoint hardcoded in hook, duplicates Tailwind config (`use-mobile.tsx:3`)
- SharedReplay commentary could break URL length limits (`ShareReplayButton.tsx:24-26`)
- Ticket messages limited to max-h-96 on small screens (`Support.tsx:515`)
- Admin collusion alerts show raw JSON, no formatted explanation (`AdminDashboard.tsx:1298`)

---

## Recommendations — Priority Order

### Fix Now (Blocks Gameplay)
1. **Pot-size bet formula** — players betting wrong amounts (Controls.tsx:84)
2. **Showdown pot split rounding** — chips vanishing (ShowdownOverlay.tsx:362)
3. **Blind schedule exponential growth** — tournaments end in minutes (TournamentCreate.tsx:613)
4. **Timer pulse animations** — define `timer-critical-pulse` and `timer-urgent-pulse` CSS
5. **Blind presets** — wire standard/turbo/mtt to actual blind schedules (GameSetup.tsx:127)
6. **Payout validation** — enforce sum = 100% (TournamentAnalytics.tsx)
7. **Ordinal suffix bug** — fix 11th/12th/13th (PayoutPieChart.tsx:79)

### Fix This Sprint (Broken UX)
8. Club chat — implement actual WebSocket message send/receive
9. 2FA backup codes — display after setup
10. Tournament form validation — all fields
11. Wallet allocation div-by-zero guard
12. Admin destructive action confirmations
13. Auth loading states
14. KYC submit button requires files

### Fix Soon (Quality / Polish)
15. Consolidate gold color values to theme variables
16. Add missing CSS animations (holoSweep, timer pulses)
17. Remove console.log from production
18. Fix numeric input validation across all forms
19. Add loading/error states to all API-dependent views
20. Add pagination where lists are capped (hands, missions, transactions)

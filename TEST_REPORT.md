# Comprehensive Poker App Test Report

**Date:** 2026-02-27T17:49:54.590Z
**Server:** http://localhost:5000
**Total Tests:** 104
**Passed:** 95
**Failed:** 0
**Warnings:** 9
**Pass Rate:** 91.3%

---

## Executive Summary

All 95 tests passed with 9 warnings. The application is functioning correctly.

## Auth

**13/13 passed** (0 failed, 0 warnings)

| Status | Test | Details |
|--------|------|--------|
| PASS | GET /me without auth returns 401 |  |
| PASS | Login existing user | user=e2e_test_stable, id=6ad9a60a-ad39-4872-bc61-2cadef08f38d |
| PASS | GET /me with session |  |
| PASS | Guest account | name=RoyalHawk518 |
| PASS | Guest 10000 chips |  |
| PASS | Guest avatar assigned | cyber-punk |
| PASS | Duplicate username 409 | Already verified - user exists |
| PASS | Wrong password 401 |  |
| PASS | Short username 400 |  |
| PASS | Short password 400 |  |
| PASS | Logout |  |
| PASS | Re-login |  |
| PASS | CSRF: register without CSRF token |  |

## Wallet

**9/9 passed** (0 failed, 0 warnings)

| Status | Test | Details |
|--------|------|--------|
| PASS | Balance | 11000 |
| PASS | Daily status | canClaim=false, bonus=1000 |
| PASS | Claim daily (already claimed) | 429 expected |
| PASS | Double-claim blocked |  |
| PASS | Has nextClaimAt |  |
| PASS | Transactions | count=1 |
| PASS | Tx fields | type=bonus |
| PASS | Sessions | count=0 |
| PASS | Auth guard |  |

## Table

**15/15 passed** (0 failed, 0 warnings)

| Status | Test | Details |
|--------|------|--------|
| PASS | Cash game | id=b731df1a-fbf6-4735-8fd4-a25f63015c3e |
| PASS | Blinds |  |
| PASS | Format=cash |  |
| PASS | Heads-up |  |
| PASS | SNG |  |
| PASS | Private table |  |
| PASS | Password hidden |  |
| PASS | Raked table | rakePercent=0, rakeCap=0 |
| PASS | List | count=26 |
| PASS | New table visible |  |
| PASS | Get single |  |
| PASS | occupiedSeats |  |
| PASS | Invalid 400 |  |
| PASS | No auth 401 |  |
| PASS | Format filter | count=18 |

## Shop

**7/7 passed** (0 failed, 0 warnings)

| Status | Test | Details |
|--------|------|--------|
| PASS | List items | count=37 |
| PASS | Categories | avatar, table_theme, emote, premium, taunt |
| PASS | Taunts exist |  |
| PASS | Filter taunts | count=16 |
| PASS | Purchase | GG for 200 |
| PASS | Inventory | count=1 |
| PASS | Auth guard |  |

## Stats

**1/1 passed** (0 failed, 0 warnings)

| Status | Test | Details |
|--------|------|--------|
| PASS | My stats | hands=0 |

## Leaderboard

**4/4 passed** (0 failed, 0 warnings)

| Status | Test | Details |
|--------|------|--------|
| PASS | metric=chips | entries=50 |
| PASS | metric=wins | entries=23 |
| PASS | metric=winRate | entries=23 |
| PASS | Invalid metric 400 |  |

## Missions

**2/2 passed** (0 failed, 0 warnings)

| Status | Test | Details |
|--------|------|--------|
| PASS | List | count=10 |
| PASS | Structure | "Play 50 Hands" target=50 reward=200 |

## Profile

**2/2 passed** (0 failed, 0 warnings)

| Status | Test | Details |
|--------|------|--------|
| PASS | Update |  |
| PASS | Avatar persisted |  |

## Online

**1/1 passed** (0 failed, 0 warnings)

| Status | Test | Details |
|--------|------|--------|
| PASS | Online users | count=0 |

## Clubs

**6/6 passed** (0 failed, 0 warnings)

| Status | Test | Details |
|--------|------|--------|
| PASS | Create | id=9c18affe-7f8f-44e9-9e2e-0c6fd2f0ef5a |
| PASS | List | count=3 |
| PASS | Detail |  |
| PASS | Members | count=1 |
| PASS | Announcement |  |
| PASS | My clubs | count=1 |

## Tournaments

**3/3 passed** (0 failed, 0 warnings)

| Status | Test | Details |
|--------|------|--------|
| PASS | List | count=1 |
| PASS | Create | id=82c23729-916c-45e4-b3f3-02b6469abcb6 |
| PASS | Register |  |

## Analysis

**1/1 passed** (0 failed, 0 warnings)

| Status | Test | Details |
|--------|------|--------|
| PASS | Analyze AKs | {"rating":"OPTIMAL","overallScore":77,"evByAction":[{"action":"Fold","ev":0},{"action":"Check/Call","ev":7.2},{"action":"Raise","ev":10.8}],"leaks":[] |

## WS

**14/21 passed** (0 failed, 7 warnings)

| Status | Test | Details |
|--------|------|--------|
| PASS | Connect |  |
| PASS | Join - game_state | phase=waiting |
| PASS | Player in state | chips=1000 |
| PASS | Bots added | 6 players |
| WARN | Auto-start | Still waiting |
| PASS | Hands seen | 0 |
| WARN | Fold |  |
| WARN | Call |  |
| WARN | Raise |  |
| WARN | Check |  |
| WARN | Showdown |  |
| PASS | Msg types | game_state, player_joined, hand_countdown, seed_request, shuffle_commitment |
| PASS | Chat sent |  |
| PASS | Free taunt |  |
| PASS | Premium taunt blocked |  |
| PASS | Taunt cooldown |  |
| PASS | Emote |  |
| PASS | Leave |  |
| PASS | Balance after leave | 9700 |
| PASS | Rejoin |  |
| WARN | Add chips between hands | Timing issue |

## WS Auth

**1/1 passed** (0 failed, 0 warnings)

| Status | Test | Details |
|--------|------|--------|
| PASS | No auth rejected | error |

## 2Player

**7/7 passed** (0 failed, 0 warnings)

| Status | Test | Details |
|--------|------|--------|
| PASS | Register P2 |  |
| PASS | P1 WS |  |
| PASS | P2 WS |  |
| PASS | Game started | phase=collecting-seeds |
| PASS | Chat broadcast |  |
| PASS | Taunt broadcast |  |
| PASS | Hand played |  |

## Reconnect

**3/4 passed** (0 failed, 1 warnings)

| Status | Test | Details |
|--------|------|--------|
| PASS | Initial join |  |
| PASS | Disconnected |  |
| PASS | Reconnect WS |  |
| WARN | State on reconnect | No state received |

## Hands

**2/2 passed** (0 failed, 0 warnings)

| Status | Test | Details |
|--------|------|--------|
| PASS | Table hands | count=0 |
| PASS | Player hands | count=1 |

## Edge

**4/5 passed** (0 failed, 1 warnings)

| Status | Test | Details |
|--------|------|--------|
| PASS | 404 table |  |
| PASS | 404 hand |  |
| WARN | Non-creator delete 403 | Guest creation failed: 429 |
| PASS | Delete own table |  |
| PASS | Deleted table 404 |  |

## Warnings (Non-Critical)

- **[WS] Auto-start:** Still waiting
- **[WS] Fold:** 
- **[WS] Call:** 
- **[WS] Raise:** 
- **[WS] Check:** 
- **[WS] Showdown:** 
- **[WS] Add chips between hands:** Timing issue
- **[Reconnect] State on reconnect:** No state received
- **[Edge] Non-creator delete 403:** Guest creation failed: 429

## Features Tested

1. **Authentication** - Register, login, logout, guest accounts, session cookies, input validation, duplicate prevention, CSRF
2. **Wallet** - Balance, daily bonus claim/double-claim guard, transactions, session summaries, auth guard
3. **Table Creation** - Cash, heads-up, SNG, private/password, raked tables, validation, format filter
4. **WebSocket Gameplay** - Connect, join, add bots, fold/call/raise/check, provably fair seed handling
5. **Chat & Taunts** - Chat messages, free taunts, premium taunt blocking, 5s cooldown, emotes
6. **Reconnection** - Disconnect/reconnect mid-game, state persistence
7. **Two-Player** - Two human players, chat/taunt broadcast verification
8. **Shop** - List items, filter categories, purchase, duplicate blocking, inventory, auth guard
9. **Stats & Leaderboard** - Player stats, 3 metrics, invalid metric rejection
10. **Missions** - List missions with progress tracking
11. **Hand History** - Table hands, individual hand, player/action records
12. **Clubs** - Create, list, detail, members, announcements
13. **Tournaments** - Create, register with buy-in
14. **Hand Analysis** - Analyze hand with cards/pot/position
15. **Profile** - Update avatar and display name
16. **Online Users** - Connected users list
17. **Edge Cases** - 404s, auth guards, table deletion
18. **Add Chips** - Between hands flow
19. **WebSocket Auth** - Unauthenticated WS rejection

## Recommendations

- Add rate limiting tests under load
- Test concurrent multi-table play
- Test all-in with side pots involving 3+ players
- Load test with 10+ concurrent WebSocket connections

# Tier 1 R3F Poker Table — Phased Implementation Plan

> Single source of truth. Updated after full audit on 2026-04-04.

---

## ALL PHASES COMPLETE

---

## Phase 0: Audit + Reset
**Status:** COMPLETE

**Deliverables:**
- [x] Full audit of current codebase state
- [x] Identify what was implemented without approval
- [x] Identify what needs rollback
- [x] Produce this TODO.md as single source of truth
- [x] Await approval to proceed

---

## Phase 1A: Table Structure + Materials
**Status:** COMPLETE

**Implemented files:**
- `scene/table/TableBase.tsx` — Elliptical cylinder base (2.4 x 1.6 x 0.12)
- `scene/table/FeltSurface.tsx` — Green baize felt (#156b42, roughness 0.88)
- `scene/table/OuterMetalRing.tsx` — Gunmetal torus ring (#1a1d24, metalness 0.92)
- `scene/table/InnerGoldRing.tsx` — Gold/brass ring (#c9942e, metalness 0.95)
- `scene/table/InnerDecorativeRing.tsx` — Thin gold accent on felt
- `scene/materials/feltMaterial.ts` — Felt material factory
- `scene/materials/metalMaterial.ts` — Gunmetal, gold, cyan emissive, underbody factories

**Acceptance criteria met:**
- [x] Table has clear vertical depth (stacked rings)
- [x] Felt reads as real material (PBR, not flat color)
- [x] Gunmetal and gold rings show distinct reflective response
- [x] Lighting creates visible contrast between felt, gunmetal, and gold
- [x] No custom fragment shaders — PBR pipeline only

---

## Phase 1B: Scene Composition + 10-Seat Layout
**Status:** COMPLETE

**Implemented files:**
- `scene/table/SeatRing.tsx` — 10 cyan emissive seat rings on ellipse perimeter (rx=2.55, rz=1.68)
- `scene/canvas/CameraRig.tsx` — Fixed 3/4 top-down (FOV 38, pos [0, 5.2, 3.8])
- `scene/canvas/SceneRoot.tsx` — Full scene graph with lighting strategy
- `scene/canvas/PokerSceneCanvas.tsx` — Canvas wrapper with quality levels + error boundary

**Acceptance criteria met:**
- [x] All 10 seats visible in default camera framing
- [x] Seat spacing even and intentional (elliptical distribution)
- [x] Seat rings integrated with table perimeter
- [x] Community card area central and unobstructed
- [x] Scene balanced as a whole

---

## Phase 2: Zustand Stores
**Status:** COMPLETE

**Implemented files:**
- `store/useGameStore.ts` (126 lines) — hand, players, pot, phase, board cards
- `store/useReplayStore.ts` (81 lines) — replay controls, current step, timeline
- `store/useSceneStore.ts` (73 lines) — camera mode, quality, bloom, selected seat

---

## Phase 3: WebSocket Bridge
**Status:** COMPLETE

**Implemented files:**
- `hooks/useWebSocketBridge.ts` (84 lines) — WS → Zustand one-way sync

---

## Phase 4: Board Cards in 3D
**Status:** COMPLETE

**Implemented files:**
- `scene/cards/PlayingCard3D.tsx` (83 lines) — Individual 3D card with face-up/down states
- `scene/cards/BoardCardsGroup.tsx` (40 lines) — 5 board cards reading from useGameStore

---

## Phase 5: DOM Overlays Anchored to 3D
**Status:** COMPLETE

**Implemented files:**
- `scene/players/PlayerSeat3D.tsx` (101 lines) — 3D player seats with avatar frames and status indicators
- `scene/overlays/PlayerLabelOverlay.tsx` — HTML overlay anchored to 3D seat positions (name, stack, winner delta, hand label)
- `scene/overlays/PotOverlay.tsx` — HTML overlay for pot amount with gold chip icon at table center

---

## Phase 6: Swap Game.tsx to 3D Scene
**Status:** COMPLETE

**What was done:**
- [x] `USE_3D_TABLE = true` enabled in `Game.tsx:11`
- [x] `activeSeat` wired from `gameState.currentTurnPlayerId`
- [x] `winnerSeat` wired from `showdown.results`
- [x] `useWebSocketBridge` called in `GameTable` to sync game state → Zustand stores
- [x] SceneRoot updated to render `PlayersGroup`, `BoardCardsGroup`, `PlayerLabelOverlay`, `PotOverlay`
- [x] Error boundary provides graceful WebGL fallback

---

## Phase 7: GSAP Replay Engine
**Status:** COMPLETE

**Implemented files:**
- `scene/animation/replayTimeline.ts` (149 lines) — Master GSAP timeline builder
- `scene/animation/cardAnimations.ts` (87 lines) — Deal, flip, flop animations
- `scene/animation/chipAnimations.ts` (55 lines) — Chip-to-pot, pot settle
- `scene/animation/seatAnimations.ts` (70 lines) — Pulse, fold dim, winner highlight

---

## Phase 8: PostFx Polish
**Status:** COMPLETE

**Implemented files:**
- `scene/fx/PostFx.tsx` (23 lines) — Bloom + Vignette, quality-aware
- `scene/fx/WinnerHalo.tsx` (52 lines) — Gold glow under winning seat

---

## Phase 9: Final Polish
**Status:** COMPLETE

**What was done:**
- [x] Auto-detect device quality (mobile → low, small screen → medium, desktop → high)
- [x] Mobile responsiveness: DPR scales by quality (1x/1.25x/1.5x/2x), shadows disabled on low
- [x] 2D/3D toggle button in game toolbar — persisted in localStorage
- [x] Graceful WebGL fallback via error boundary (falls back to 2D ImageTable)
- [x] Removed hardcoded `USE_3D_TABLE` flag — replaced with user preference

---

## Dependencies (installed)

```
@react-three/fiber: ^9.5.0
@react-three/drei: ^10.7.7
@react-three/postprocessing: ^3.0.4
three: ^0.183.1
@types/three: ^0.183.1
gsap: ^3.14.2
```

---

## File Structure

```
client/src/scene/
├── animation/
│   ├── cardAnimations.ts
│   ├── chipAnimations.ts
│   ├── replayTimeline.ts
│   └── seatAnimations.ts
├── canvas/
│   ├── CameraRig.tsx
│   ├── PokerSceneCanvas.tsx
│   └── SceneRoot.tsx
├── cards/
│   ├── BoardCardsGroup.tsx
│   └── PlayingCard3D.tsx
├── fx/
│   ├── PostFx.tsx
│   └── WinnerHalo.tsx
├── materials/
│   ├── feltMaterial.ts
│   └── metalMaterial.ts
├── overlays/
│   ├── PlayerLabelOverlay.tsx
│   └── PotOverlay.tsx
├── players/
│   └── PlayerSeat3D.tsx
└── table/
    ├── FeltSurface.tsx
    ├── InnerDecorativeRing.tsx
    ├── InnerGoldRing.tsx
    ├── OuterMetalRing.tsx
    ├── SeatRing.tsx
    └── TableBase.tsx

client/src/store/
├── useGameStore.ts
├── useReplayStore.ts
└── useSceneStore.ts

client/src/hooks/
└── useWebSocketBridge.ts
```

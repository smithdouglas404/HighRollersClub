# Tier 1 R3F Poker Table — Phased Implementation Plan

> Single source of truth. No phase proceeds without explicit APPROVED message.

---

## CURRENT ACTIVE PHASE: Phase 0 (Audit)

---

## Phase 0: Audit + Reset
**Status:** IN PROGRESS

**Deliverables:**
- [x] Full audit of current codebase state
- [x] Identify what was implemented without approval
- [x] Identify what needs rollback
- [ ] Produce this TODO.md as single source of truth
- [ ] Await approval to proceed

**Acceptance criteria:**
- Audit report delivered
- TODO.md written and reviewed
- User confirms current state is understood

**STOP POINT:** Do not proceed past Phase 0 without: APPROVED PHASE 0

---

## Phase 1A: Table Structure + Materials
**Status:** LOCKED — DO NOT START

**Deliverables:**
- [ ] Describe exact table mesh structure (layers, thicknesses, mesh count)
- [ ] Describe exact materials per mesh (PBR parameters, no custom shaders)
- [ ] Describe exact lighting setup (positions, intensities, colors)
- [ ] Describe environment map strategy for metal reflections
- [ ] Get approval on all of the above BEFORE writing any code
- [ ] Implement approved table structure
- [ ] Provide screenshot proving premium materials render correctly

**Acceptance criteria:**
- Table has clear vertical depth (stacked rings, not flat)
- Felt reads as a real material (not flat color)
- Gunmetal and gold rings show distinct reflective response
- Lighting creates visible contrast between felt, gunmetal, and gold
- No custom fragment shaders — PBR pipeline only
- Screenshot matches reference visual composition

**STOP POINT:** Do not proceed past Phase 1A without: APPROVED PHASE 1A

---

## Phase 1B: Scene Composition + 10-Seat Layout
**Status:** LOCKED — DO NOT START

**Deliverables:**
- [ ] Define exact 10 seat anchor positions (world coordinates)
- [ ] Define camera position + FOV
- [ ] Define scale compensation per seat group
- [ ] Define DOM overlay strategy for names/stacks
- [ ] Get approval on all of the above BEFORE writing any code
- [ ] Implement approved seat layout
- [ ] Provide screenshot proving all 10 seats visible, evenly spaced, integrated with table

**Acceptance criteria:**
- All 10 seats visible in default camera framing
- No seats cropped, hidden, or compressed
- Seat spacing feels even and intentional
- Seat rings integrated with table perimeter (not floating)
- Community card area central and unobstructed
- Far-side seats legible for future avatar display
- Scene balanced as a whole

**STOP POINT:** Do not proceed past Phase 1B without: APPROVED PHASE 1B

---

## Phase 2: Zustand Stores
**Status:** LOCKED — DO NOT START

**Deliverables:**
- [ ] store/useGameStore.ts (hand, players, pot, phase, board cards)
- [ ] store/useReplayStore.ts (replay controls, current step, timeline)
- [ ] store/useSceneStore.ts (camera mode, quality, bloom, selected seat)

**STOP POINT:** Do not proceed without: APPROVED PHASE 2

---

## Phase 3: WebSocket Bridge
**Status:** LOCKED — DO NOT START

**Deliverables:**
- [ ] hooks/useWebSocketBridge.ts (WS → Zustand one-way sync)

**STOP POINT:** Do not proceed without: APPROVED PHASE 3

---

## Phase 4: Board Cards in 3D
**Status:** LOCKED — DO NOT START

**Deliverables:**
- [ ] scene/cards/PlayingCard3D.tsx
- [ ] scene/cards/BoardCardsGroup.tsx

**STOP POINT:** Do not proceed without: APPROVED PHASE 4

---

## Phase 5: DOM Overlays Anchored to 3D
**Status:** LOCKED — DO NOT START

**Deliverables:**
- [ ] overlays/PlayerLabelOverlay.tsx
- [ ] overlays/PotOverlay.tsx

**STOP POINT:** Do not proceed without: APPROVED PHASE 5

---

## Phase 6: Swap Game.tsx to 3D Scene
**Status:** LOCKED — DO NOT START

**STOP POINT:** Do not proceed without: APPROVED PHASE 6

---

## Phase 7: GSAP Replay Engine
**Status:** LOCKED — DO NOT START

**STOP POINT:** Do not proceed without: APPROVED PHASE 7

---

## Phase 8: PostFx Polish
**Status:** LOCKED — DO NOT START

**STOP POINT:** Do not proceed without: APPROVED PHASE 8

---

## Phase 9: Final Polish
**Status:** LOCKED — DO NOT START

**STOP POINT:** Do not proceed without: APPROVED PHASE 9

---

## Approval Protocol

Valid approval formats:
- APPROVED PHASE 0
- APPROVED PHASE 1A
- APPROVED PHASE 1B
- APPROVED PHASE 2 (etc.)
- APPROVED PROCEED

No phase advances without one of these exact messages.

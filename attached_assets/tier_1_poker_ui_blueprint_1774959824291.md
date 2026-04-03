# Tier 1 Blueprint: React + Three.js Premium Poker Experience

## Objective
Build a flagship poker replay and verification experience that feels materially different from standard web apps by combining a premium React application shell with a cinematic real-time 3D rendering layer.

This blueprint is optimized for implementation with Claude Code.

---

## 1. Product Goal

### What this must feel like
- Not a dashboard
- Not a flat casino UI
- Not a basic game client
- A premium, cinematic, trust-forward hand viewer and replay surface

### Core product promise
A user can open a verified poker hand and immediately experience:
- premium visual presence
- crystal-clear game-state understanding
- trust through blockchain verification
- dramatic but disciplined replay motion

### Design principles
1. **Rendered environment, not static layout**
2. **UI supports the scene; it does not compete with it**
3. **Motion communicates state, not decoration**
4. **Materials matter: felt, metal, glass, neon, cards, chips**
5. **Trust surfaces must feel authoritative and legible**

---

## 2. Recommended Stack

### Core framework
- React
- TypeScript
- Vite or Next.js

### 3D / rendering
- React Three Fiber
- Three.js
- Drei
- @react-three/postprocessing

### Animation
- GSAP for deterministic timeline control
- Framer Motion for panel and HUD transitions only

### State management
- Zustand

### Styling / UI shell
- Tailwind CSS or CSS Modules with design tokens

### Utilities
- Zod for schema validation
- React Query if replay or hand data is fetched from APIs
- Vitest for unit testing
- Playwright for interaction and visual regression coverage

### Optional later
- Leva for internal scene tuning controls
- Sentry for runtime monitoring
- Storybook for shell components

---

## 3. Architecture Overview

## Top-level system

```text
App Shell (React)
├── Header / Controls / Panels / Metadata
├── HUD Layout / Overlay System
├── Replay Controls
├── Verification & Hand History UI
└── Shared State Store (Zustand)
     ├── hand state
     ├── player state
     ├── animation state
     ├── camera state
     └── UI state

Render Surface (React Three Fiber)
├── Table Scene
├── Materials / Lighting / Effects
├── Cards / Chips / Seat Rings / Avatars
├── Winner / Focus / Turn Highlights
└── Replay Animation Timeline (GSAP)
```

## Separation of responsibility

### React owns
- information architecture
- controls
- textual data
- action history
- verification details
- layout responsiveness
- accessibility

### Three.js owns
- table geometry
- cards and chips in space
- lighting
- bloom/glow
- material response
- seat framing
- animated movement
- visual drama

### Zustand owns
- single source of truth for current hand snapshot
- replay index
- active street
- active player
- selected player
- winner state
- verification status
- camera mode

---

## 4. Rendering Strategy

## Recommended rendering model
Use a **hybrid 2.5D cinematic table scene**, not a fully explorable 3D game world.

That means:
- fixed or semi-fixed camera angles
- carefully staged lighting
- rich materials and depth
- deterministic movement paths
- strong performance on desktop

This is the best tradeoff between spectacle and control.

## Why not full free-camera 3D
You do not need open-world camera freedom. It adds complexity without improving comprehension. The product should feel directed, premium, and legible.

## Camera modes
1. **Hero Overview**
   - default mode
   - slightly elevated cinematic angle
   - all players and board visible

2. **Replay Focus**
   - subtle camera pushes during key actions
   - focus on acting player or pot area

3. **Showdown Focus**
   - tighter framing on winning hand / board / player badge

4. **Verification Focus**
   - slight shift or visual pulse when blockchain status is highlighted

---

## 5. Scene Graph Blueprint

```text
<Canvas>
  <SceneRoot>
    <EnvironmentLights />
    <PostFx />
    <TableRoot>
      <TableBase />
      <FeltSurface />
      <OuterMetalRing />
      <InnerGoldRing />
      <SeatRingGroup />
      <BoardZone />
      <PotZone />
      <AmbientGridFx />
    </TableRoot>

    <PlayersGroup>
      <PlayerSeat seat="1" />
      <PlayerSeat seat="2" />
      ...
      <PlayerSeat seat="10" />
    </PlayersGroup>

    <BoardCardsGroup />
    <PotChipsGroup />
    <DealerButton />
    <ActionHighlights />
    <WinnerEffects />
    <CameraRig />
  </SceneRoot>
</Canvas>
```

## Key scene entities

### TableBase
- elliptical geometry
- dark structural underbody
- premium silhouette

### FeltSurface
- custom shader or textured material
- subtle grid / scanline / woven felt depth
- center-weighted lighting falloff

### OuterMetalRing
- brushed dark gunmetal
- soft cyan edge reflections

### InnerGoldRing
- warm metallic contrast
- restrained premium accent

### SeatRingGroup
- 10 seat positions
- emissive cyan rings
- optional gold highlight for active or winning seat

### BoardCardsGroup
- flop / turn / river positions
- animated entrance
- physically grounded spacing

### PotChipsGroup
- stylized stacks
- slight bounce / settle animation on update

### PlayerSeat
Each player seat contains:
- avatar frame anchor
- seat ring
- local card anchor
- label anchor
- action highlight anchor

---

## 6. Folder Structure

```text
src/
  app/
    App.tsx
    routes/
    providers/

  components/
    shell/
      HeaderBar.tsx
      ReplayControls.tsx
      ActionLogPanel.tsx
      VerificationPanel.tsx
      FooterActions.tsx
    overlays/
      PlayerLabelOverlay.tsx
      TooltipOverlay.tsx
      ModalOverlay.tsx

  features/
    hand-replay/
      components/
      hooks/
      selectors/
      store/
      types/
      utils/
    blockchain-verification/
      components/
      api/
      types/

  scene/
    canvas/
      PokerSceneCanvas.tsx
      SceneRoot.tsx
      CameraRig.tsx
    table/
      TableBase.tsx
      FeltSurface.tsx
      SeatRing.tsx
      PotZone.tsx
    players/
      PlayerSeat.tsx
      PlayerAvatarFrame.tsx
      PlayerCards3D.tsx
      PlayerSeatHighlight.tsx
    cards/
      PlayingCard3D.tsx
      BoardCardsGroup.tsx
      CardMaterials.ts
    chips/
      ChipStack3D.tsx
      PotChipsGroup.tsx
    fx/
      PostFx.tsx
      GlowPulse.tsx
      AmbientParticles.tsx
      WinnerHalo.tsx
    materials/
      feltMaterial.ts
      metalMaterial.ts
      neonMaterial.ts
      glassMaterial.ts
    animation/
      replayTimeline.ts
      seatAnimations.ts
      cardAnimations.ts
      chipAnimations.ts

  store/
    useAppStore.ts
    useReplayStore.ts
    useSceneStore.ts

  types/
    hand.ts
    player.ts
    replay.ts
    verification.ts

  data/
    mockHand.ts

  assets/
    textures/
    env/
    card-faces/
    avatars/
```

---

## 7. State Model

## Core store slices

### hand slice
- handId
- timestamp
- potAmount
- boardCards
- street
- dealerPosition
- currentActionIndex
- actions[]
- winners[]
- verification

### players slice
For each player:
- id
- seatIndex
- displayName
- avatar
- stackStart
- stackCurrent
- holeCards
- status (active, folded, all-in, out)
- result (win, loss, neutral)
- amountDelta
- handLabel

### replay slice
- isPlaying
- speed
- currentStep
- currentStreet
- focusedSeat
- focusedEntity
- timelineStatus

### scene slice
- cameraMode
- bloomStrength
- qualityLevel
- selectedSeat
- hoveredSeat
- showAmbientFx

### UI slice
- selectedPanel
- actionLogExpanded
- verificationExpanded
- tooltipsEnabled

---

## 8. Data Contracts

## Hand payload shape

```ts
interface HandReplayData {
  handId: string;
  timestampUtc: string;
  pot: number;
  table: {
    maxSeats: number;
    gameType: string;
    blinds?: { small: number; big: number };
  };
  players: PlayerState[];
  board: {
    flop: Card[];
    turn?: Card;
    river?: Card;
  };
  actions: ReplayAction[];
  winners: WinnerState[];
  verification: {
    status: 'verified' | 'pending' | 'failed';
    hash: string;
    network?: string;
    explorerUrl?: string;
  };
}
```

## Replay action shape

```ts
interface ReplayAction {
  id: string;
  street: 'preflop' | 'flop' | 'turn' | 'river' | 'showdown';
  actorSeat: number;
  type: 'post_blind' | 'check' | 'call' | 'bet' | 'raise' | 'fold' | 'reveal' | 'win';
  amount?: number;
  potAfter?: number;
  targetSeat?: number;
  cards?: Card[];
  timestampOffsetMs?: number;
}
```

## Key rule
Do not let the render layer invent game state. It should render exactly what the state model declares.

---

## 9. UI Composition Blueprint

## Shell layout

```text
+-----------------------------------------------------------+
| Header: hand meta | export | replay                       |
|                                                           |
| Left Rail: action log     Center: rendered table          |
|                           Right Rail: verification        |
|                                                           |
| Bottom: CTA / filters / blockchain action / replay scrub  |
+-----------------------------------------------------------+
```

## Recommended layout rules
- Keep panels slightly translucent and visually secondary to the table
- Reserve the brightest values for actionable state and winner state
- Avoid oversized text blocks inside the scene area
- Keep typography disciplined and crisp

## Overlay rules
- Player labels should be anchored to scene positions but rendered in React DOM
- That keeps text sharp and responsive
- Three.js should render the table and scene objects, not dense text panels

---

## 10. Visual Language Blueprint

## Primary palette
- Graphite / near-black background
- Premium cyan for interactive neon
- Warm gold for trust, premium framing, and winner emphasis
- Deep casino green felt
- White used sparingly for top legibility

## Materials

### Felt
- rich woven look
- subtle procedural noise
- center-bright, edge-dark
- optional animated low-amplitude shimmer for futuristic identity

### Metal
- gunmetal outer ring
- brushed anisotropic feel if possible
- gold inner rim as prestige cue

### Glass HUD panels
- smoky translucent panels
- soft inner border
- restrained glow edge

### Cards
- slightly beveled
- real shadow separation from table
- clean casino-grade printing

### Glow principles
- use glow as hierarchy, not decoration
- bloom should emphasize focus points
- never let every element glow equally

---

## 11. Motion Blueprint

## Motion philosophy
Motion should explain the hand.

## Required animation moments

### On load
- table ambient lights settle in
- subtle camera establish
- panels fade/slide in with restraint

### Street reveal
- flop deals with sequential motion
- turn and river land with small emphasis
- pot responds subtly

### Betting events
- acting seat pulses
- chip motion travels to pot
- action log advances in sync

### Fold
- player ring dims
- cards retract or desaturate
- label updates to folded state

### Showdown
- remaining hands reveal
- winning player receives gold highlight
- camera subtly tightens

### Verification emphasis
- verified badge pulses softly once
- no constant aggressive motion

## Animation tech split
- GSAP: deterministic replay sequences and synchronized multi-object animation
- Framer Motion: panel entrances, overlays, subtle UI transitions
- R3F frame updates: ambient scene movement and shader uniforms

---

## 12. Performance Strategy

## Target
- smooth desktop experience first
- graceful fallback on lower-powered devices

## Performance rules
1. Keep geometry simple and materials rich
2. Prefer stylized realism over excessive polygon count
3. Use instancing for chips where possible
4. Limit real-time shadows; fake where needed
5. Use postprocessing carefully; bloom is expensive
6. Offer graphics presets: low / medium / high / cinematic

## Suggested quality toggles
- bloom intensity
- ambient particles on/off
- reflection resolution
- shadow softness
- animated background FX on/off

---

## 13. MVP Scope for Claude Code

## Phase 1: Signature Proof
Claude should build:
- React shell with correct layout
- R3F canvas in center
- elliptical table geometry
- felt material
- cyan and gold rim lighting
- 10 seat rings
- board cards
- 4 visible players
- winner highlight
- left action log
- right verification panel

## Phase 2: Replay Engine
Claude should add:
- Zustand replay store
- GSAP replay timeline
- chip movements
- street reveals
- fold states
- seat highlighting
- replay controls wired to state

## Phase 3: Premium Finish
Claude should add:
- postprocessing bloom
- custom shader improvements
- polished card materials
- camera pushes
- real overlay anchoring
- performance presets

---

## 14. Claude Code Build Prompts

## Prompt 1: App skeleton
Create a React + TypeScript + Vite app for a premium poker hand replay interface. Use React Three Fiber for the center rendering surface, Zustand for shared state, and a clean component architecture separating the UI shell from the 3D scene.

## Prompt 2: Scene foundation
Implement a cinematic elliptical poker table scene in React Three Fiber with a green felt center, a dark gunmetal outer ring, a gold inner ring, cyan emissive accents, and ten evenly spaced seat rings. The camera should be fixed in a premium three-quarter top-down perspective.

## Prompt 3: State architecture
Create a Zustand store for poker hand replay state, including players, board cards, pot, action timeline, active seat, winner state, verification status, and replay controls. Keep the render layer fully driven by store state.

## Prompt 4: Replay system
Implement a GSAP-driven replay timeline that can animate street reveals, player turn highlights, chip movement to the pot, fold state changes, showdown reveals, and winner emphasis. Synchronize the left action log and the 3D scene.

## Prompt 5: Overlays
Render player labels, stack values, and result badges as crisp DOM overlays anchored to scene coordinates rather than rendering dense text inside the Three.js scene.

## Prompt 6: Visual polish
Add restrained bloom, better felt shading, premium card materials, subtle environmental lighting, and a premium HUD style that feels cinematic rather than arcade-like.

---

## 15. Non-Negotiables for Implementation

1. **Do not build this as pure HTML/CSS pretending to be cinematic**
2. **Do not put dense UI text inside WebGL when DOM overlays are better**
3. **Do not let every element glow equally**
4. **Do not overdo motion**
5. **Do not make the camera freely draggable by default**
6. **Do not let mock data and visual state drift apart**
7. **Do not optimize too early before proving the visual direction**

---

## 16. Recommended Delivery Sequence

### Sprint 1
- scene scaffold
- shell layout
- table materials
- 10 seat positions
- static board and player examples

### Sprint 2
- store structure
- data contracts
- wired overlays
- replay controls
- verification panel states

### Sprint 3
- GSAP timeline
- action log sync
- winner flow
- bloom and shader refinement

### Sprint 4
- responsive tuning
- performance modes
- API integration
- testing and hardening

---

## 17. Definition of Success

You know Tier 1 is working when:
- the table looks premium before any motion starts
- the UI feels subordinate to the scene, not dominant over it
- replay actions are easy to understand instantly
- the product feels expensive and differentiated
- screenshots look branded and memorable even without explanation

---

## 18. Final Recommendation

For your use case, the best implementation path is:

**React + TypeScript + React Three Fiber + Drei + Zustand + GSAP + Postprocessing**

That is the strongest balance of:
- elite visuals
- maintainability
- implementation speed
- future extensibility

If Claude Code follows this blueprint, it should build a real Tier 1 foundation instead of another flat dashboard mockup.


# High Rollers Club - Project Specification

## 1. The "Mega Prompt"
*Use this prompt to recreate or describe the vision of this project to an AI or development team.*

> **Act as a Senior Design Engineer and Frontend Architect.**
> 
> **Goal:** Build "High Rollers Club," the world's most immersive, high-fidelity online poker interface. The aesthetic must be a fusion of "Luxury Casino" and "Cyberpunk Future."
> 
> **Visual Direction:**
> - **Atmosphere:** Dark, moody, high-contrast. Deep blacks, rich teals, and electric gold accents.
> - **Table Design:** A photorealistic 3D perspective view of a premium oval poker table. Features include a deep leather rail with embedded LED lighting, a custom "Golden Lion" heraldic logo on a textured felt surface, and dynamic lighting effects.
> - **Avatars:** No generic circles. Use high-resolution, generated 3D avatars with a cyberpunk aesthetic (neon visors, cybernetic implants, luxury fashion). Avatars must have animated status rings (timers) and "float" in 3D space around the table.
> - **UI Elements:** Glassmorphism panels, holographic data overlays (Matrix rain effect), and crisp, monospace typography for data integrity.
> 
> **Functional Requirements:**
> - **Provably Fair Panel:** A slide-out dashboard showing real-time cryptographic hashes, seeds, and server RNG verification to appeal to crypto-native users.
> - **Immersive Gameplay:** Cards must have 3D transforms when dealt. Chips should stack visually. The active player must have a spotlight effect.
> - **Tech Stack:** React 19, Tailwind CSS v4 (using `@theme` blocks), Lucide React for icons, and Framer Motion for complex entrance/exit animations. Use CSS 3D transforms (`perspective`, `rotateX`, `transform-style: preserve-3d`) to achieve the tabletop depth without a heavy WebGL library.

---

## 2. Business Specification

### **Executive Summary**
**High Rollers Club** is a next-generation online poker platform designed for the Web3 and high-stakes community. It addresses the "boring, flat" UI of incumbent platforms (PokerStars, GG) by offering a cinematic, immersive experience that feels like a high-end video game.

### **Target Audience**
- **Crypto Whales & Degen Traders:** Users who value aesthetics, status, and "provable fairness."
- **Gen Z / Millennial Players:** Gamers accustomed to high-fidelity UI/UX in video games who find traditional poker software dated.
- **Streamers & Content Creators:** The visually striking UI is designed to look incredible on Twitch/YouTube streams.

### **Unique Selling Propositions (USP)**
1.  **"Cinema-Grade" Immersion:** Moving away from 2D top-down views to an angled, 3D perspective that mimics sitting at a real high-stakes table.
2.  **Provably Fair Transparency:** Unlike black-box servers, every hand's RNG is verifiable client-side (mocked in prototype, planned for production).
3.  **Digital Identity:** Players don't just have usernames; they have unique, generative 3D avatars that act as status symbols.

### **Monetization Strategy**
- **Rake:** Standard % taken from cash game pots.
- **NFT Avatars:** Sale of exclusive "Cyberpunk" avatar collections that grant access to VIP tables.
- **Table Skins:** Premium felt textures and rail designs purchasable as cosmetic upgrades.

---

## 3. Technical Specification

### **Frontend Architecture**
- **Framework:** React 19 (Functional Components + Hooks).
- **Build Tool:** Vite (for instant HMR and optimized bundling).
- **Routing:** `wouter` (Lightweight, sufficient for SPA game apps).
- **State Management:** React `useState`/`useReducer` for immediate game state; `TanStack Query` for server state synchronization.

### **UI/UX System**
- **Styling Engine:** Tailwind CSS v4.
    - **Theme:** Custom configuration in `index.css` using CSS variables for "Felt Green," "Gold," and "Cyberpunk Neon."
    - **3D Engine:** CSS3 `transform` properties (`perspective: 1200px`, `rotateX(30deg)`) are used to create the 3D table effect. This is lighter than Three.js for this specific use case but maintains high visual fidelity.
    - **Animations:** `framer-motion` handles card dealing, chip movements, and UI panel slides.

### **Key Components**
1.  **`Game.tsx` (Container):** Manages the 3D scene context and camera perspective.
2.  **`Seat.tsx`:** A complex component handling:
    - Avatar rendering.
    - Counter-rotation logic (to keep avatars facing the screen while the table is tilted).
    - Status indicators (Timer ring, dealer button, action badges).
3.  **`CommunityCards.tsx`:** Displays the Flop/Turn/River with "floating" 3D effects.
4.  **`ProvablyFairPanel.tsx`:** A dedicated UI for displaying RNG verification data.
5.  **`MatrixOverlay.tsx`:** Canvas-based background effect for the "hacker" aesthetic.

### **Data Structures (TypeScript Interfaces)**
```typescript
interface Player {
  id: string;
  name: string;
  chips: number;
  avatar: string;
  cards: [Card, Card];
  status: 'thinking' | 'folded' | 'all-in' | 'checked';
  timeLeft: number; // 0-100 percentage for the ring
}

interface GameState {
  pot: number;
  communityCards: Card[];
  currentTurnPlayerId: string;
  dealerId: string;
}
```

### **Future Roadmap (Post-Prototype)**
1.  **Real Backend:** Node.js/Express + Socket.io for real-time multiplayer state.
2.  **Database:** PostgreSQL for user accounts and hand history.
3.  **Web3 Integration:** WalletConnect for login and crypto deposits.
4.  **Sound Engine:** Spatial audio for chips clinking and card shuffles.

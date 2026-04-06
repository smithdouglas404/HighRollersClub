# Design System Strategy: The Neon Vault

### 1. Overview & Creative North Star
The Creative North Star for this design system is **"The Neon Vault."** 

This system represents a high-stakes digital sanctuary—an exclusive, futuristic server room where luxury meets the underground. We move beyond "template" design by treating the UI as a series of floating, luminous data planes suspended in a deep, atmospheric void. To break the traditional rigid grid, we utilize intentional asymmetry, overlapping glass panels, and a high-contrast typographic scale that mirrors technical readouts found in high-end surveillance tech. Every element should feel like it is projected in a three-dimensional space, prioritizing tonal depth over flat structural lines.

---

### 2. Colors
Our palette is anchored in the deep obsidian of the `background` (#0e0e0e), punctuated by high-frequency accents that signify wealth and action.

*   **The "No-Line" Rule:** We do not use 1px solid borders for sectioning. Structural boundaries must be defined through background shifts using the `surface-container` tiers or via subtle tonal transitions. A section should be distinguished from the background by moving from `surface` to `surface_container_low`.
*   **Surface Hierarchy & Nesting:** Treat the UI as layers of stacked frosted glass. Use `surface_container_lowest` for the base background and progress through `surface_container_high` for nested cards. This creates a natural "lift" that feels integrated into the environment.
*   **The "Glass & Gradient" Rule:** All primary containers must utilize Glassmorphism. This involves using semi-transparent surface colors with a heavy backdrop-blur (minimum 20px). Main CTAs and hero elements should utilize a signature gradient transitioning from `primary` (#81ecff) to `primary_container` (#00e3fd) to provide a "soul" and luminosity that flat colors cannot achieve.
*   **Action Tones:** Use `secondary` (#3fff8b) exclusively for positive growth and confirmation (Success/Approve), and `tertiary` (#ff7076) for high-stakes risk and destructive actions (Decline/Fold).

---

### 3. Typography
The typographic system creates a tension between technical brutalism and editorial refinement.

*   **Display & Headlines (Space Grotesk):** These are our "hero" technical readouts. The wide, geometric architecture of Space Grotesk feels like high-end terminal data. Use `display-lg` for chip counts and `headline-md` for section headers to establish authority.
*   **Body & Titles (Manrope):** We use Manrope for all functional content. Its clean, humanist sans-serif qualities ensure maximum readability during fast-paced gameplay. 
*   **Hierarchy as Identity:** Scale is our primary tool. A massive `display-lg` number next to a small `label-md` caption creates a professional, data-rich aesthetic found in premium financial interfaces.

---

### 4. Elevation & Depth
In "The Neon Vault," depth is a product of light and transparency, not drop shadows.

*   **The Layering Principle:** Achieve hierarchy by "stacking" surface tiers. Place a `surface_container_highest` card on top of a `surface_container_low` section. This creates a soft, natural separation without the need for archaic borders.
*   **Ambient Shadows:** When a "floating" element requires a shadow, it must be extra-diffused. Use a blur of 30px-60px with a 5% opacity, tinted with the `surface_tint` (#81ecff) to mimic the glow of the screen reflecting off the server room walls.
*   **The "Ghost Border" Fallback:** If a container requires a edge for accessibility, use a "Ghost Border." This is the `outline_variant` token at 15% opacity. It should look like a faint light-leak on the edge of a glass pane, never a solid line.
*   **Luminous Edges:** For high-priority active containers (like a player’s turn), apply a 1px inner glow using the `primary` color. This simulates the edge-lighting of a fiber-optic panel.

---

### 5. Components
Our components are high-fidelity glass objects. They should feel tactile and reactive.

*   **Buttons:**
    *   **Primary:** A vibrant gradient of `primary` to `primary_container`. Text should be `on_primary_fixed` for maximum contrast. No rounded corners beyond `sm` (0.125rem) to maintain a sharp, technical look.
    *   **Secondary/Tertiary:** Use a "Ghost Border" style with `on_surface` text. On hover, the background should fill with a 10% opacity of the accent color.
*   **Input Fields:** Ghost-style containers with `surface_container_highest` backgrounds. The "active" state is indicated by a `primary` glowing bottom-border only.
*   **Cards & Lists:** **Strictly prohibit divider lines.** Separate list items using `Spacing 4` (1rem) or by alternating background shifts between `surface_container_low` and `surface_container`.
*   **Avatars:** Character avatars should be framed in a `primary` glowing border with a subtle `xl` (0.75rem) corner radius. They should feel like premium, holographic IDs.
*   **Chips:** Use `full` (9999px) roundness for status chips (e.g., "Online," "In-Hand") to contrast against the sharper, more aggressive square corners of the main layout containers.
*   **Poker Specifics:**
    *   **Pot Indicator:** Use `display-md` in `primary` color, centered and floating on a glass plane.
    *   **Action Bar:** A persistent glass-morphic bar at the bottom, using `surface_container_highest` with a 40px backdrop blur.

---

### 6. Do's and Don'ts

**Do:**
*   **DO** use varying opacities of `primary` to create depth within a single glass panel.
*   **DO** leave ample white space (using `Spacing 12` or `16`) to let the background server room imagery breathe.
*   **DO** align text to the "technical grid"—labels should feel like they belong to a sophisticated HUD.

**Don't:**
*   **DON'T** use 100% opaque black for containers. It kills the glassmorphism effect.
*   **DON'T** use standard Material Design drop shadows. They look "cheap" in a cyberpunk context.
*   **DON'T** use rounded corners larger than `md` (0.375rem) for main structural panels; keep the aesthetic sharp and aggressive.
*   **DON'T** use high-contrast dividers. If you can’t separate content with space or tone, the layout is too crowded.
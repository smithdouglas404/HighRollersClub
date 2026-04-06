// ── Shared Design Tokens ─────────────────────────────────────────────────────
// Single source of truth for card styling, buttons, panels, and rarity colors.

// Standard card
export const CARD_CLASSES = "rounded-xl bg-black/30 backdrop-blur-xl border border-white/10";
export const CARD_HOVER = "hover:border-primary/20 hover:shadow-[0_0_20px_rgba(212,175,55,0.15)] transition-all duration-300";

// Standard gold button
export const BTN_GOLD = "bg-gradient-to-r from-[#9a7b2c] via-[#d4af37] to-[#f3e2ad] text-black font-bold rounded-xl px-5 py-2.5";
export const BTN_GOLD_HOVER = "hover:shadow-[0_0_20px_rgba(212,175,55,0.3)] hover:scale-[1.02] active:scale-[0.98] transition-all";

// Standard glass panel
export const GLASS_PANEL = "rounded-xl bg-white/[0.03] backdrop-blur-xl border border-white/[0.06]";

// Standard headings
export const HEADING_LG = "text-lg font-black uppercase tracking-wider";
export const HEADING_SM = "text-sm font-bold uppercase tracking-wider text-gray-400";

// Standard page container
export const PAGE_CONTAINER = "max-w-6xl mx-auto px-4 md:px-0 pb-8";

// Rarity system (shared across Shop, Marketplace, Wardrobe, DyeShop)
export const RARITY = {
  common:    { text: "text-gray-400",    bg: "bg-gray-500/10",    border: "border-gray-500/20",    glow: "rgba(156,163,175,0.2)" },
  uncommon:  { text: "text-green-400",   bg: "bg-green-500/10",   border: "border-green-500/20",   glow: "rgba(34,197,94,0.2)" },
  rare:      { text: "text-blue-400",    bg: "bg-blue-500/10",    border: "border-blue-500/20",    glow: "rgba(96,165,250,0.2)" },
  epic:      { text: "text-purple-400",  bg: "bg-purple-500/10",  border: "border-purple-500/20",  glow: "rgba(168,85,247,0.2)" },
  legendary: { text: "text-amber-400",   bg: "bg-amber-500/10",   border: "border-amber-500/20",   glow: "rgba(245,158,11,0.3)" },
  mythic:    { text: "text-fuchsia-400", bg: "bg-fuchsia-500/10", border: "border-fuchsia-500/20", glow: "rgba(217,70,239,0.3)" },
} as const;

export type Rarity = keyof typeof RARITY;

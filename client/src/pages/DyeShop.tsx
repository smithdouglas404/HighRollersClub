import { useState } from "react";
import { motion } from "framer-motion";
import { DashboardLayout } from "@/components/DashboardLayout";
import {
  Palette, Paintbrush, Check, Sparkles, Shield, Star,
  Clock, Wand2, Shirt, Sword, Crown
} from "lucide-react";
import { GoldButton, GoldCard, NumberTicker, SectionHeader, GoldDivider, SpotlightCard } from "@/components/premium/PremiumComponents";

/* ── Color Palettes ── */
const PRIMARY_SWATCHES = ["#c9a84c", "#e74c3c", "#3498db", "#2ecc71", "#9b59b6", "#e67e22", "#1abc9c", "#f1c40f"];
const SECONDARY_SWATCHES = ["#1a1a2e", "#2d1b69", "#0a3d62", "#1e3a2f", "#3d0c02", "#2c2c3e", "#0d0d1a", "#1b1b2f"];
const ACCENT_SWATCHES = ["#ff6b6b", "#ffd93d", "#6bcb77", "#4d96ff", "#ff6f91", "#845ec2", "#00c9a7", "#ffc75f"];

/* ── Dye Packs ── */
interface DyePack {
  name: string;
  primary: string;
  secondary: string;
  accent: string;
}

const DYE_PACKS: DyePack[] = [
  { name: "Gold Leaf", primary: "#d4af37", secondary: "#1a1a2e", accent: "#ffd700" },
  { name: "Midnight Chrome", primary: "#c0c0c0", secondary: "#0d0d1a", accent: "#4d96ff" },
  { name: "Sentinel Blue", primary: "#2563eb", secondary: "#0f172a", accent: "#60a5fa" },
  { name: "Crimson Fury", primary: "#dc2626", secondary: "#1a0000", accent: "#ff4444" },
  { name: "Phantom Purple", primary: "#7c3aed", secondary: "#1e1040", accent: "#a78bfa" },
  { name: "Emerald Shadow", primary: "#059669", secondary: "#0a1f15", accent: "#34d399" },
  { name: "Arctic Frost", primary: "#06b6d4", secondary: "#0c1a2e", accent: "#e0f2fe" },
  { name: "Solar Flare", primary: "#ea580c", secondary: "#1c0a00", accent: "#fbbf24" },
];

/* ── Recently Equipped Placeholder Items ── */
const RECENT_ITEMS = [
  { name: "Obsidian Helm", icon: Crown, tier: "legendary" as const },
  { name: "Void Chestplate", icon: Shield, tier: "epic" as const },
  { name: "Ember Gauntlets", icon: Sword, tier: "rare" as const },
  { name: "Shadow Cloak", icon: Shirt, tier: "rare" as const },
];

const TIER_COLORS = {
  legendary: "text-amber-400",
  epic: "text-purple-400",
  rare: "text-blue-400",
};

/* ── localStorage persistence ── */
const STORAGE_KEY = "poker-avatar-dye";

function loadSavedDye(): { primary: string; secondary: string; accent: string } {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch {}
  return { primary: "#c9a84c", secondary: "#1a1a2e", accent: "#ff6b6b" };
}

/* ── Color Picker Row Component ── */
function ColorPickerRow({
  label,
  swatches,
  value,
  onChange,
}: {
  label: string;
  swatches: string[];
  value: string;
  onChange: (color: string) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[0.6875rem] font-bold text-white uppercase tracking-wider">{label}</span>
        <span className="text-[0.5625rem] font-mono text-gray-500 uppercase">{value}</span>
      </div>
      <div className="flex items-center gap-2">
        {swatches.map((color) => (
          <button
            key={color}
            onClick={() => onChange(color)}
            className={`w-8 h-8 rounded-lg border-2 transition-all hover:scale-110 relative shrink-0 ${
              value === color
                ? ""
                : "border-transparent hover:border-white/20"
            }`}
            style={value === color ? { borderColor: "#d4af37", boxShadow: "0 0 10px rgba(212,175,55,0.35)", backgroundColor: color } : { backgroundColor: color }}
          >
            {value === color && (
              <Check className="w-3 h-3 text-white absolute inset-0 m-auto drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]" />
            )}
          </button>
        ))}
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-8 h-8 rounded-lg border border-white/10 cursor-pointer bg-transparent shrink-0 [&::-webkit-color-swatch-wrapper]:p-0.5 [&::-webkit-color-swatch]:rounded"
          title="Custom color"
        />
      </div>
    </div>
  );
}

/* ── Style Score Ring SVG ── */
function StyleScoreRing({ score }: { score: number }) {
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="relative w-28 h-28 mx-auto">
      <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
        {/* Background ring */}
        <circle cx="50" cy="50" r={radius} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="6" />
        {/* Progress ring */}
        <motion.circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke="url(#scoreGradient)"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.2, delay: 0.3 }}
        />
        <defs>
          <linearGradient id="scoreGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#d4af37" />
            <stop offset="100%" stopColor="#f59e0b" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-black text-amber-400">{score}</span>
        <span className="text-[0.5rem] text-gray-500 uppercase tracking-wider font-bold">Style</span>
      </div>
    </div>
  );
}

/* ── Main Component ── */
export default function DyeShop() {
  const saved = loadSavedDye();
  const [primary, setPrimary] = useState(saved.primary);
  const [secondary, setSecondary] = useState(saved.secondary);
  const [accent, setAccent] = useState(saved.accent);
  const [applied, setApplied] = useState(false);

  const handleApply = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ primary, secondary, accent }));
    setApplied(true);
    setTimeout(() => setApplied(false), 2000);
  };

  const handlePackSelect = (pack: DyePack) => {
    setPrimary(pack.primary);
    setSecondary(pack.secondary);
    setAccent(pack.accent);
  };

  // Calculated scores
  const styleScore = 72;
  const armorRating = 85;

  return (
    <DashboardLayout title="Dye Shop">
      <div className="px-4 md:px-8 pb-8 space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-4"
        >
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500/15 to-purple-500/15 border border-amber-500/20 flex items-center justify-center">
            <Palette className="w-6 h-6 text-amber-400" />
          </div>
          <div>
            <h2 className="text-lg font-display font-bold text-white tracking-tight">Avatar Dye Shop</h2>
            <p className="text-[0.625rem] text-muted-foreground">Customize your avatar colors with dyes and preset packs.</p>
          </div>
        </motion.div>

        {/* Main 3-Column Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr_260px] gap-6">
          {/* ── Left Panel: Avatar Preview ── */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="vault-card rounded-xl p-5 flex flex-col items-center"
          >
            <h3 className="text-xs font-bold uppercase tracking-wider gold-text mb-4">Live Preview</h3>

            {/* Avatar Preview with live colors */}
            <motion.div
              key={`${primary}-${secondary}-${accent}`}
              initial={{ scale: 0.97, opacity: 0.8 }}
              animate={{ scale: 1, opacity: 1 }}
              className="w-48 h-60 rounded-2xl overflow-hidden border-2 mb-4 relative gold-border"
              style={{ borderWidth: "2px" }}
              style={{
                backgroundColor: secondary,
                boxShadow: `0 0 30px ${primary}33, 0 8px 32px rgba(0,0,0,0.5)`,
              }}
            >
              <svg viewBox="0 0 120 160" className="w-full h-full">
                {/* Head */}
                <circle cx="60" cy="38" r="18" fill={primary} opacity="0.9" />
                {/* Visor / eye line */}
                <rect x="46" y="35" width="28" height="4" rx="2" fill={accent} opacity="0.7" />
                {/* Neck */}
                <rect x="54" y="54" width="12" height="8" rx="3" fill={primary} opacity="0.85" />
                {/* Body / Torso */}
                <path d="M33 66 Q33 58 60 58 Q87 58 87 66 L90 112 Q90 124 60 124 Q30 124 30 112 Z" fill={primary} opacity="0.85" />
                {/* Armor accent lines */}
                <path d="M42 72 L78 72" stroke={accent} strokeWidth="2" opacity="0.6" />
                <path d="M44 80 L76 80" stroke={accent} strokeWidth="1.5" opacity="0.45" />
                <path d="M46 88 L74 88" stroke={accent} strokeWidth="1" opacity="0.35" />
                {/* Shoulder pads */}
                <ellipse cx="33" cy="66" rx="8" ry="5" fill={primary} opacity="0.75" />
                <ellipse cx="87" cy="66" rx="8" ry="5" fill={primary} opacity="0.75" />
                {/* Accent circle on chest */}
                <circle cx="60" cy="76" r="5" fill="none" stroke={accent} strokeWidth="1.5" opacity="0.5" />
                <circle cx="60" cy="76" r="2" fill={accent} opacity="0.6" />
                {/* Arms */}
                <path d="M33 68 L20 98 L26 100 L36 76" fill={primary} opacity="0.8" />
                <path d="M87 68 L100 98 L94 100 L84 76" fill={primary} opacity="0.8" />
                {/* Legs */}
                <path d="M42 120 L38 155 L48 155 L50 120" fill={primary} opacity="0.75" />
                <path d="M70 120 L72 155 L82 155 L78 120" fill={primary} opacity="0.75" />
                {/* Glow ring around head */}
                <circle cx="60" cy="38" r="22" fill="none" stroke={accent} strokeWidth="0.6" opacity="0.3" />
              </svg>
            </motion.div>

            {/* Color Summary */}
            <div className="w-full space-y-2">
              {[
                { label: "Primary", color: primary },
                { label: "Secondary", color: secondary },
                { label: "Accent", color: accent },
              ].map(({ label, color }) => (
                <div key={label} className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded border border-white/10 shrink-0" style={{ backgroundColor: color }} />
                  <span className="text-[0.6875rem] text-gray-400 flex-1">{label}</span>
                  <span className="text-[0.5625rem] text-gray-500 font-mono uppercase">{color}</span>
                </div>
              ))}
            </div>
          </motion.div>

          {/* ── Center Panel: Dye Customization ── */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="space-y-5"
          >
            {/* Color Pickers */}
            <div className="vault-card rounded-xl p-5">
              <h3 className="text-xs font-bold uppercase tracking-wider gold-text mb-5 flex items-center gap-2">
                <Paintbrush className="w-4 h-4" style={{ color: "#d4af37" }} />
                Dye Customization
              </h3>
              <div className="space-y-5">
                <ColorPickerRow label="Primary" swatches={PRIMARY_SWATCHES} value={primary} onChange={setPrimary} />
                <ColorPickerRow label="Secondary" swatches={SECONDARY_SWATCHES} value={secondary} onChange={setSecondary} />
                <ColorPickerRow label="Accent" swatches={ACCENT_SWATCHES} value={accent} onChange={setAccent} />
              </div>
            </div>

            {/* Dye Packs Grid */}
            <div className="vault-card rounded-xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <Sparkles className="w-4 h-4" style={{ color: "#d4af37" }} />
                <h3 className="text-xs font-bold uppercase tracking-wider gold-text">Dye Packs</h3>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {DYE_PACKS.map((pack) => {
                  const isActive = primary === pack.primary && secondary === pack.secondary && accent === pack.accent;
                  return (
                    <button
                      key={pack.name}
                      onClick={() => handlePackSelect(pack)}
                      className={`flex flex-col items-center gap-2 p-3 rounded-lg border transition-all text-center ${
                        isActive
                          ? "gold-border bg-amber-500/10 shadow-[0_0_12px_rgba(212,175,55,0.2)]"
                          : "border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/10"
                      }`}
                    >
                      {/* Color dots */}
                      <div className="flex gap-1">
                        <span className="w-4 h-4 rounded-full border border-white/10" style={{ backgroundColor: pack.primary }} />
                        <span className="w-4 h-4 rounded-full border border-white/10" style={{ backgroundColor: pack.secondary }} />
                        <span className="w-4 h-4 rounded-full border border-white/10" style={{ backgroundColor: pack.accent }} />
                      </div>
                      <span className="text-[0.625rem] font-bold text-white leading-tight">{pack.name}</span>
                      {isActive && (
                        <Check className="w-3 h-3 text-amber-400" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Bottom Action Buttons */}
            <div className="flex gap-3">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleApply}
                className={`flex-1 py-3 rounded-xl text-sm font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
                  applied
                    ? "bg-green-500/20 text-green-400 border border-green-500/30"
                    : "gold-btn"
                }`}
              >
                {applied ? (
                  <>
                    <Check className="w-4 h-4" />
                    Dye Applied!
                  </>
                ) : (
                  <>
                    <Paintbrush className="w-4 h-4" />
                    Apply Dye
                  </>
                )}
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="px-6 py-3 rounded-xl text-sm font-black uppercase tracking-wider gold-btn transition-all flex items-center gap-2 shadow-[0_0_25px_rgba(212,175,55,0.3)]"
              >
                <Wand2 className="w-4 h-4" />
                NANO BANANA RENDER
              </motion.button>
            </div>
          </motion.div>

          {/* ── Right Panel: Stats + Recent Items ── */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="space-y-5"
          >
            {/* Quick Stats */}
            <div className="vault-card rounded-xl p-5">
              <h3 className="text-xs font-bold uppercase tracking-wider gold-text mb-4 flex items-center gap-2">
                <Star className="w-4 h-4" style={{ color: "#d4af37" }} />
                Quick Stats
              </h3>

              {/* Style Score Ring */}
              <StyleScoreRing score={styleScore} />

              {/* Armor Rating */}
              <div className="mt-4">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[0.6875rem] font-bold text-white flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5 text-blue-400" />
                    Armor Rating
                  </span>
                  <span className="text-sm font-black text-blue-400">{armorRating}</span>
                </div>
                <div className="w-full h-2 rounded-full bg-white/5 overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${armorRating}%` }}
                    transition={{ delay: 0.5, duration: 0.8 }}
                    className="h-full rounded-full bg-gradient-to-r from-blue-500 to-blue-400"
                  />
                </div>
              </div>
            </div>

            {/* Recently Equipped */}
            <div className="vault-card rounded-xl p-5">
              <h3 className="text-xs font-bold uppercase tracking-wider gold-text mb-4 flex items-center gap-2">
                <Clock className="w-4 h-4" style={{ color: "#d4af37" }} />
                Recently Equipped
              </h3>
              <div className="space-y-2">
                {RECENT_ITEMS.map((item) => {
                  const ItemIcon = item.icon;
                  return (
                    <div
                      key={item.name}
                      className="flex items-center gap-3 p-2.5 rounded-lg gold-border bg-white/[0.02] hover:bg-white/[0.04] transition-all"
                    >
                      <div className="w-8 h-8 rounded-lg bg-white/5 gold-border flex items-center justify-center">
                        <ItemIcon className={`w-4 h-4 ${TIER_COLORS[item.tier]}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[0.6875rem] font-bold text-white truncate">{item.name}</div>
                        <div className={`text-[0.5625rem] font-bold uppercase tracking-wider ${TIER_COLORS[item.tier]}`}>
                          {item.tier}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </DashboardLayout>
  );
}

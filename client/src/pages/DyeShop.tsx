import { useState } from "react";
import { motion } from "framer-motion";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Palette, Check, Coins, Sparkles } from "lucide-react";

/* ── Color Presets ─────────────────────────────────────────── */

const COLOR_SWATCHES = [
  "#E53E3E", "#DD6B20", "#D69E2E", "#38A169",
  "#3182CE", "#805AD5", "#D53F8C", "#2D3748",
];

interface DyePack {
  id: string;
  name: string;
  primary: string;
  secondary: string;
  accent: string;
  price: number;
}

const DYE_PACKS: DyePack[] = [
  { id: "gold-chrome",    name: "Gold Chrome",    primary: "#D4A843", secondary: "#C9A84C", accent: "#FFD700", price: 2000 },
  { id: "neon-cyber",     name: "Neon Cyber",     primary: "#00FFE0", secondary: "#0D0D2B", accent: "#FF00FF", price: 1500 },
  { id: "shadow-stealth", name: "Shadow Stealth", primary: "#1A1A2E", secondary: "#16213E", accent: "#0F3460", price: 500 },
  { id: "royal-purple",   name: "Royal Purple",   primary: "#7C3AED", secondary: "#4C1D95", accent: "#A78BFA", price: 1000 },
];

/* ── Swatch Button ─────────────────────────────────────────── */

function SwatchButton({ color, selected, onClick }: { color: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`w-9 h-9 rounded-lg border-2 transition-all hover:scale-110 flex items-center justify-center ${
        selected ? "border-white shadow-[0_0_8px_rgba(255,255,255,0.3)]" : "border-white/10 hover:border-white/30"
      }`}
      style={{ backgroundColor: color }}
    >
      {selected && <Check className="w-4 h-4 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]" />}
    </button>
  );
}

/* ── Main Component ────────────────────────────────────────── */

export default function DyeShop() {
  const [primaryColor, setPrimaryColor] = useState(COLOR_SWATCHES[0]);
  const [secondaryColor, setSecondaryColor] = useState(COLOR_SWATCHES[4]);
  const [accentColor, setAccentColor] = useState(COLOR_SWATCHES[3]);

  const applyDyePack = (pack: DyePack) => {
    setPrimaryColor(pack.primary);
    setSecondaryColor(pack.secondary);
    setAccentColor(pack.accent);
  };

  return (
    <DashboardLayout title="Dye Shop">
      <div className="px-4 md:px-8 pb-8 space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-4"
        >
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-pink-500/15 to-purple-500/15 border border-pink-500/20 flex items-center justify-center">
            <Palette className="w-6 h-6 text-pink-400" />
          </div>
          <div>
            <h2 className="text-lg font-display font-bold text-white tracking-tight">
              Avatar Dye Shop
            </h2>
            <p className="text-[0.625rem] text-muted-foreground">
              Customize your avatar colors with swatches or pre-made dye packs.
            </p>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* ── Preview Area ── */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            className="lg:col-span-1 flex flex-col items-center justify-center rounded-xl p-8 bg-surface-high/50 backdrop-blur-xl border border-primary/15"
          >
            <div
              className="w-32 h-32 rounded-2xl border border-primary/20 flex items-center justify-center mb-4 relative overflow-hidden"
              style={{
                background: `linear-gradient(135deg, ${primaryColor}33, ${secondaryColor}33)`,
              }}
            >
              <div
                className="w-20 h-20 rounded-full border-4 flex items-center justify-center"
                style={{
                  backgroundColor: primaryColor,
                  borderColor: accentColor,
                }}
              >
                <span className="text-3xl">&#x1F464;</span>
              </div>
              <div className="absolute inset-0 rounded-2xl bg-primary/5 blur-xl -z-10" />
            </div>
            <div className="text-sm font-bold text-white mb-1">Preview</div>
            <div className="flex items-center gap-2 mt-2">
              <div className="w-5 h-5 rounded-full border border-white/20" style={{ backgroundColor: primaryColor }} title="Primary" />
              <div className="w-5 h-5 rounded-full border border-white/20" style={{ backgroundColor: secondaryColor }} title="Secondary" />
              <div className="w-5 h-5 rounded-full border border-white/20" style={{ backgroundColor: accentColor }} title="Accent" />
            </div>
          </motion.div>

          {/* ── Color Pickers ── */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="lg:col-span-2 space-y-5"
          >
            {/* Primary */}
            <div className="rounded-xl p-5 bg-surface-high/50 border border-white/[0.06]">
              <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">Primary Color</h4>
              <div className="flex flex-wrap gap-2">
                {COLOR_SWATCHES.map((c) => (
                  <SwatchButton key={`p-${c}`} color={c} selected={primaryColor === c} onClick={() => setPrimaryColor(c)} />
                ))}
              </div>
            </div>

            {/* Secondary */}
            <div className="rounded-xl p-5 bg-surface-high/50 border border-white/[0.06]">
              <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">Secondary Color</h4>
              <div className="flex flex-wrap gap-2">
                {COLOR_SWATCHES.map((c) => (
                  <SwatchButton key={`s-${c}`} color={c} selected={secondaryColor === c} onClick={() => setSecondaryColor(c)} />
                ))}
              </div>
            </div>

            {/* Accent */}
            <div className="rounded-xl p-5 bg-surface-high/50 border border-white/[0.06]">
              <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">Accent Color</h4>
              <div className="flex flex-wrap gap-2">
                {COLOR_SWATCHES.map((c) => (
                  <SwatchButton key={`a-${c}`} color={c} selected={accentColor === c} onClick={() => setAccentColor(c)} />
                ))}
              </div>
            </div>
          </motion.div>
        </div>

        {/* ── Dye Packs ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-4 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-500/70" />
            Dye Packs
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {DYE_PACKS.map((pack) => (
              <button
                key={pack.id}
                onClick={() => applyDyePack(pack)}
                className="relative rounded-xl p-5 border border-white/[0.06] bg-surface-high/40 hover:border-white/15 hover:scale-[1.02] transition-all text-left group"
              >
                {/* Color preview dots */}
                <div className="flex items-center gap-1.5 mb-3">
                  <div className="w-6 h-6 rounded-full border border-white/20" style={{ backgroundColor: pack.primary }} />
                  <div className="w-6 h-6 rounded-full border border-white/20" style={{ backgroundColor: pack.secondary }} />
                  <div className="w-6 h-6 rounded-full border border-white/20" style={{ backgroundColor: pack.accent }} />
                </div>
                <div className="text-xs font-bold text-white mb-1">{pack.name}</div>
                <div className="flex items-center gap-1 text-[0.625rem] text-amber-400 font-bold">
                  <Coins className="w-3 h-3" />
                  {pack.price.toLocaleString()} chips
                </div>
              </button>
            ))}
          </div>
        </motion.div>

        {/* ── Apply Button ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="flex justify-center"
        >
          <button className="flex items-center gap-2 px-8 py-3 rounded-lg text-sm font-bold uppercase tracking-wider gradient-gold text-black border border-[#c9a84c]/40 hover:opacity-90 transition-all shadow-[0_0_15px_rgba(212,168,67,0.2)]">
            <Palette className="w-4 h-4" />
            Apply Colors
          </button>
        </motion.div>
      </div>
    </DashboardLayout>
  );
}

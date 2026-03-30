import { useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { DashboardLayout } from "@/components/DashboardLayout";
import {
  User, Coins, Wand2, ChevronDown,
  Sparkles, Shirt, Swords, SmilePlus,
} from "lucide-react";

/* -- Configuration Options ------------------------------------------------ */

const STYLES = ["Cyberpunk", "Fantasy", "Sci-Fi", "Steampunk", "Gothic"] as const;
type AvatarStyle = (typeof STYLES)[number];

const BODY_TYPES = ["Athletic", "Slim", "Heavy", "Standard"] as const;
type BodyType = (typeof BODY_TYPES)[number];

const HAIR_COLORS = [
  { label: "Black",    hex: "#1a1a2e" },
  { label: "Blonde",   hex: "#D4A843" },
  { label: "Red",      hex: "#C0392B" },
  { label: "Blue",     hex: "#3182CE" },
  { label: "Silver",   hex: "#A0AEC0" },
  { label: "Purple",   hex: "#805AD5" },
] as const;

const OUTFITS = ["Battle Armor", "Street Wear", "Royal Garments", "Tech Suit"] as const;
type Outfit = (typeof OUTFITS)[number];

const EXPRESSIONS = ["Confident", "Fierce", "Mysterious", "Calm"] as const;
type Expression = (typeof EXPRESSIONS)[number];

const RENDER_COST = 2500;

/* -- Style-to-gradient mapping for the preview area ----------------------- */

const STYLE_GRADIENTS: Record<AvatarStyle, { from: string; to: string }> = {
  Cyberpunk:  { from: "#00FFE0", to: "#FF00FF" },
  Fantasy:    { from: "#7C3AED", to: "#D69E2E" },
  "Sci-Fi":   { from: "#3182CE", to: "#00E3FD" },
  Steampunk:  { from: "#9C7C2E", to: "#C0392B" },
  Gothic:     { from: "#1a1a2e", to: "#805AD5" },
};

const EXPRESSION_EMOJI: Record<Expression, string> = {
  Confident:  "\u{1F60E}",
  Fierce:     "\u{1F525}",
  Mysterious: "\u{1F576}\uFE0F",
  Calm:       "\u{1F9D8}",
};

/* -- Select Dropdown ------------------------------------------------------ */

function SelectField({
  label,
  icon: Icon,
  value,
  options,
  onChange,
}: {
  label: string;
  icon: any;
  value: string;
  options: readonly string[];
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="label-luxury flex items-center gap-1.5">
        <Icon className="w-3 h-3 text-primary/60" />
        {label}
      </label>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full input-ghost appearance-none pr-8 cursor-pointer"
        >
          {options.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
        <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
      </div>
    </div>
  );
}

/* -- Radio Button Group --------------------------------------------------- */

function RadioGroup({
  label,
  icon: Icon,
  value,
  options,
  onChange,
}: {
  label: string;
  icon: any;
  value: string;
  options: readonly string[];
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="label-luxury flex items-center gap-1.5">
        <Icon className="w-3 h-3 text-primary/60" />
        {label}
      </label>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => (
          <button
            key={opt}
            onClick={() => onChange(opt)}
            className={`px-3 py-2 rounded-lg text-[0.625rem] font-bold uppercase tracking-wider transition-all border ${
              value === opt
                ? "bg-primary/15 text-primary border-primary/25 neon-box-glow"
                : "bg-white/5 text-gray-400 border-white/10 hover:bg-white/10 hover:text-gray-300"
            }`}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}

/* -- Main Component ------------------------------------------------------- */

export default function AvatarCustomizer() {
  const [, navigate] = useLocation();
  const [style, setStyle] = useState<AvatarStyle>("Cyberpunk");
  const [bodyType, setBodyType] = useState<BodyType>("Standard");
  const [hairColor, setHairColor] = useState<string>(HAIR_COLORS[0].hex);
  const [outfit, setOutfit] = useState<Outfit>("Battle Armor");
  const [expression, setExpression] = useState<Expression>("Confident");

  const gradient = STYLE_GRADIENTS[style];

  const handleRender = () => {
    navigate("/avatar-render");
  };

  return (
    <DashboardLayout title="Avatar Customizer">
      <div className="px-4 md:px-8 pb-8 space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-4"
        >
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/15 to-purple-500/15 border border-primary/20 flex items-center justify-center">
            <Wand2 className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-display font-bold text-white tracking-tight">
              Avatar Customization Lab
            </h2>
            <p className="text-[0.625rem] text-muted-foreground">
              Design your AI-generated avatar. Choose a style, body type, and more.
            </p>
          </div>
        </motion.div>

        {/* Two-panel layout */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* ---- Left Panel: Preview ---- */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            className="lg:col-span-2 flex flex-col items-center justify-center rounded-xl p-8 bg-surface-high/50 backdrop-blur-xl border border-primary/15 relative overflow-hidden"
          >
            {/* Ambient background gradient */}
            <div
              className="absolute inset-0 opacity-20 blur-3xl -z-10 transition-all duration-700"
              style={{
                background: `radial-gradient(ellipse at center, ${gradient.from}40, ${gradient.to}20, transparent 70%)`,
              }}
            />

            {/* Avatar silhouette */}
            <div
              className="w-40 h-40 rounded-2xl border-2 flex items-center justify-center mb-5 relative transition-all duration-500"
              style={{
                borderColor: `${gradient.from}60`,
                background: `linear-gradient(135deg, ${gradient.from}15, ${gradient.to}15)`,
                boxShadow: `0 0 40px ${gradient.from}20, inset 0 0 30px ${gradient.from}10`,
              }}
            >
              {/* Hair color ring */}
              <div
                className="w-24 h-24 rounded-full border-4 flex items-center justify-center transition-all duration-300"
                style={{
                  borderColor: hairColor,
                  background: `linear-gradient(135deg, ${hairColor}20, transparent)`,
                }}
              >
                <span className="text-4xl">{EXPRESSION_EMOJI[expression]}</span>
              </div>
              {/* Glow backdrop */}
              <div
                className="absolute inset-0 rounded-2xl blur-xl -z-10 transition-all duration-700"
                style={{ background: `${gradient.from}08` }}
              />
            </div>

            <div className="text-sm font-bold text-white mb-1">{style} Avatar</div>
            <div className="text-[0.5625rem] text-gray-500 mb-3">
              {bodyType} / {outfit}
            </div>

            {/* Config summary chips */}
            <div className="flex flex-wrap items-center justify-center gap-1.5">
              <span className="px-2 py-1 rounded-md text-[0.5rem] font-bold uppercase tracking-wider bg-primary/10 text-primary/80 border border-primary/20">
                {style}
              </span>
              <span className="px-2 py-1 rounded-md text-[0.5rem] font-bold uppercase tracking-wider bg-white/5 text-gray-400 border border-white/10">
                {bodyType}
              </span>
              <span className="px-2 py-1 rounded-md text-[0.5rem] font-bold uppercase tracking-wider bg-white/5 text-gray-400 border border-white/10">
                {expression}
              </span>
            </div>
          </motion.div>

          {/* ---- Right Panel: Controls ---- */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="lg:col-span-3 space-y-5"
          >
            {/* Style */}
            <div className="rounded-xl p-5 bg-surface-high/50 border border-white/[0.06]">
              <SelectField
                label="Style"
                icon={Sparkles}
                value={style}
                options={STYLES}
                onChange={(v) => setStyle(v as AvatarStyle)}
              />
            </div>

            {/* Body Type */}
            <div className="rounded-xl p-5 bg-surface-high/50 border border-white/[0.06]">
              <RadioGroup
                label="Body Type"
                icon={User}
                value={bodyType}
                options={BODY_TYPES}
                onChange={(v) => setBodyType(v as BodyType)}
              />
            </div>

            {/* Hair Color */}
            <div className="rounded-xl p-5 bg-surface-high/50 border border-white/[0.06]">
              <label className="label-luxury flex items-center gap-1.5 mb-3">
                <User className="w-3 h-3 text-primary/60" />
                Hair Color
              </label>
              <div className="flex flex-wrap gap-2.5">
                {HAIR_COLORS.map((hc) => (
                  <button
                    key={hc.hex}
                    onClick={() => setHairColor(hc.hex)}
                    title={hc.label}
                    className={`w-9 h-9 rounded-lg border-2 transition-all hover:scale-110 flex items-center justify-center ${
                      hairColor === hc.hex
                        ? "border-white shadow-[0_0_8px_rgba(255,255,255,0.3)] scale-110"
                        : "border-white/10 hover:border-white/30"
                    }`}
                    style={{ backgroundColor: hc.hex }}
                  >
                    {hairColor === hc.hex && (
                      <svg className="w-4 h-4 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Outfit */}
            <div className="rounded-xl p-5 bg-surface-high/50 border border-white/[0.06]">
              <SelectField
                label="Outfit"
                icon={Shirt}
                value={outfit}
                options={OUTFITS}
                onChange={(v) => setOutfit(v as Outfit)}
              />
            </div>

            {/* Expression */}
            <div className="rounded-xl p-5 bg-surface-high/50 border border-white/[0.06]">
              <RadioGroup
                label="Expression"
                icon={SmilePlus}
                value={expression}
                options={EXPRESSIONS}
                onChange={(v) => setExpression(v as Expression)}
              />
            </div>
          </motion.div>
        </div>

        {/* ---- Bottom: Cost + Render Button ---- */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2"
        >
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <Coins className="w-4 h-4 text-amber-400" />
            <span className="font-bold text-white tabular-nums">
              {RENDER_COST.toLocaleString()}
            </span>
            <span className="text-[0.625rem] text-gray-500">chips to render</span>
          </div>

          <button
            onClick={handleRender}
            className="flex items-center gap-2 px-8 py-3 rounded-lg text-sm font-bold uppercase tracking-wider gradient-gold text-black border border-[#c9a84c]/40 hover:opacity-90 transition-all shadow-[0_0_15px_rgba(212,168,67,0.2)] btn-neon"
          >
            <Swords className="w-4 h-4" />
            Render Avatar
          </button>
        </motion.div>
      </div>
    </DashboardLayout>
  );
}

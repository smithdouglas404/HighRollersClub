import { useState, useEffect } from "react";
import { Link } from "wouter";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useAuth } from "@/lib/auth-context";
import { Palette, Paintbrush, Check, Sparkles } from "lucide-react";

const PRIMARY_COLORS = [
  "#c9a84c", "#e74c3c", "#3498db", "#2ecc71", "#9b59b6",
  "#e67e22", "#1abc9c", "#f1c40f", "#e91e63", "#00bcd4",
  "#8bc34a", "#ff5722", "#607d8b", "#795548", "#ffffff",
];

const SECONDARY_COLORS = [
  "#1a1a2e", "#2d1b69", "#0a3d62", "#1e3a2f", "#3d0c02",
  "#2c2c3e", "#0d0d1a", "#1b1b2f", "#0f3460", "#16213e",
  "#1a1a40", "#2b2d42", "#3c1642", "#0b0b0f", "#252525",
];

const ACCENT_COLORS = [
  "#ff6b6b", "#ffd93d", "#6bcb77", "#4d96ff", "#ff6f91",
  "#845ec2", "#00c9a7", "#ffc75f", "#f9f871", "#c34a36",
  "#ff8066", "#a29bfe", "#fd79a8", "#00cec9", "#e17055",
];

interface DyePack {
  name: string;
  icon: string;
  primary: string;
  secondary: string;
  accent: string;
  description: string;
}

const DYE_PACKS: DyePack[] = [
  { name: "Gold Rush", icon: "💰", primary: "#c9a84c", secondary: "#1a1a2e", accent: "#ffd700", description: "Classic gold luxury" },
  { name: "Neon Cyber", icon: "🔮", primary: "#00ffff", secondary: "#0d0d1a", accent: "#ff00ff", description: "Cyberpunk neon glow" },
  { name: "Ocean Deep", icon: "🌊", primary: "#0077b6", secondary: "#023e8a", accent: "#00b4d8", description: "Deep sea explorer" },
  { name: "Blood Red", icon: "🩸", primary: "#dc2626", secondary: "#1a0000", accent: "#ff4444", description: "Crimson intimidation" },
  { name: "Phantom Purple", icon: "👻", primary: "#7c3aed", secondary: "#1e1040", accent: "#a78bfa", description: "Ethereal phantom aura" },
];

const STORAGE_KEY = "poker-avatar-dye";

function loadSavedDye(): { primary: string; secondary: string; accent: string } {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch {}
  return { primary: "#c9a84c", secondary: "#1a1a2e", accent: "#ff6b6b" };
}

export default function DyeShop() {
  const { user } = useAuth();
  const saved = loadSavedDye();
  const [primary, setPrimary] = useState(saved.primary);
  const [secondary, setSecondary] = useState(saved.secondary);
  const [accent, setAccent] = useState(saved.accent);
  const [activeSection, setActiveSection] = useState<"primary" | "secondary" | "accent">("primary");
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

  const currentColors = activeSection === "primary" ? PRIMARY_COLORS : activeSection === "secondary" ? SECONDARY_COLORS : ACCENT_COLORS;
  const currentValue = activeSection === "primary" ? primary : activeSection === "secondary" ? secondary : accent;
  const setCurrentValue = activeSection === "primary" ? setPrimary : activeSection === "secondary" ? setSecondary : setAccent;

  return (
    <DashboardLayout title="Dye Shop">
      <div className="px-4 md:px-8 pb-8 relative z-10">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#c9a84c]/20 to-purple-500/20 border border-[#c9a84c]/20 flex items-center justify-center">
            <Palette className="w-5 h-5 text-[#c9a84c]" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white font-display">Avatar Dye Shop</h1>
            <p className="text-xs text-gray-400">Customize your avatar colors</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">
          {/* Left: Color Selection */}
          <div className="space-y-6">
            {/* Section Tabs */}
            <div className="flex gap-2">
              {(["primary", "secondary", "accent"] as const).map((section) => (
                <button
                  key={section}
                  onClick={() => setActiveSection(section)}
                  className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
                    activeSection === section
                      ? "bg-[#c9a84c]/20 text-[#c9a84c] border border-[#c9a84c]/30"
                      : "bg-white/5 text-gray-400 border border-white/5 hover:bg-white/10"
                  }`}
                >
                  <Paintbrush className="w-3 h-3 inline mr-1.5" />
                  {section}
                </button>
              ))}
            </div>

            {/* Color Grid */}
            <div className="rounded-xl border border-white/[0.06] p-5" style={{ background: "rgba(15,15,20,0.7)", backdropFilter: "blur(12px)" }}>
              <h3 className="text-sm font-bold text-white mb-3 capitalize">{activeSection} Color</h3>
              <div className="grid grid-cols-5 sm:grid-cols-8 gap-3">
                {currentColors.map((color) => (
                  <button
                    key={color}
                    onClick={() => setCurrentValue(color)}
                    className={`w-10 h-10 rounded-lg border-2 transition-all hover:scale-110 relative ${
                      currentValue === color ? "border-white shadow-[0_0_12px_rgba(255,255,255,0.3)]" : "border-transparent"
                    }`}
                    style={{ backgroundColor: color }}
                    title={color}
                  >
                    {currentValue === color && (
                      <Check className="w-4 h-4 text-white absolute inset-0 m-auto drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Dye Packs */}
            <div className="rounded-xl border border-white/[0.06] p-5" style={{ background: "rgba(15,15,20,0.7)", backdropFilter: "blur(12px)" }}>
              <div className="flex items-center gap-2 mb-4">
                <Sparkles className="w-4 h-4 text-[#c9a84c]" />
                <h3 className="text-sm font-bold text-white">Dye Packs</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {DYE_PACKS.map((pack) => {
                  const isActive = primary === pack.primary && secondary === pack.secondary && accent === pack.accent;
                  return (
                    <button
                      key={pack.name}
                      onClick={() => handlePackSelect(pack)}
                      className={`flex items-center gap-3 p-3 rounded-lg border transition-all text-left ${
                        isActive
                          ? "border-[#c9a84c]/40 bg-[#c9a84c]/10"
                          : "border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05]"
                      }`}
                    >
                      <span className="text-2xl">{pack.icon}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-white">{pack.name}</p>
                        <p className="text-[10px] text-gray-400">{pack.description}</p>
                      </div>
                      <div className="flex gap-1">
                        <span className="w-4 h-4 rounded-full border border-white/10" style={{ backgroundColor: pack.primary }} />
                        <span className="w-4 h-4 rounded-full border border-white/10" style={{ backgroundColor: pack.secondary }} />
                        <span className="w-4 h-4 rounded-full border border-white/10" style={{ backgroundColor: pack.accent }} />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right: Preview Panel */}
          <div className="space-y-4">
            <div className="rounded-xl border border-white/[0.06] p-5 sticky top-4" style={{ background: "rgba(15,15,20,0.7)", backdropFilter: "blur(12px)" }}>
              <h3 className="text-sm font-bold text-white mb-4 text-center">Preview</h3>

              {/* Avatar Preview */}
              <div className="relative w-40 h-40 mx-auto mb-4 rounded-2xl overflow-hidden" style={{ backgroundColor: secondary }}>
                {/* SVG avatar silhouette with color overlay */}
                <svg viewBox="0 0 100 100" className="w-full h-full">
                  {/* Head */}
                  <circle cx="50" cy="30" r="16" fill={primary} opacity="0.9" />
                  {/* Body */}
                  <path d="M30 55 Q30 42 50 42 Q70 42 70 55 L72 85 Q72 95 50 95 Q28 95 28 85 Z" fill={primary} opacity="0.85" />
                  {/* Accent details */}
                  <circle cx="50" cy="30" r="12" fill="none" stroke={accent} strokeWidth="1.5" opacity="0.6" />
                  <path d="M38 60 L62 60" stroke={accent} strokeWidth="2" opacity="0.5" />
                  <path d="M40 68 L60 68" stroke={accent} strokeWidth="1.5" opacity="0.4" />
                </svg>
              </div>

              {/* Color Summary */}
              <div className="space-y-2 mb-4">
                {[
                  { label: "Primary", color: primary },
                  { label: "Secondary", color: secondary },
                  { label: "Accent", color: accent },
                ].map(({ label, color }) => (
                  <div key={label} className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded border border-white/10" style={{ backgroundColor: color }} />
                    <span className="text-xs text-gray-400 flex-1">{label}</span>
                    <span className="text-[10px] text-gray-500 font-mono uppercase">{color}</span>
                  </div>
                ))}
              </div>

              {/* Apply Button */}
              <button
                onClick={handleApply}
                className={`w-full py-2.5 rounded-lg font-bold text-sm transition-all ${
                  applied
                    ? "bg-green-500/20 text-green-400 border border-green-500/30"
                    : "bg-gradient-to-r from-[#c9a84c] to-[#b8943f] text-black hover:brightness-110"
                }`}
              >
                {applied ? (
                  <><Check className="w-4 h-4 inline mr-1" /> Dye Applied!</>
                ) : (
                  <><Paintbrush className="w-4 h-4 inline mr-1" /> Apply Dye</>
                )}
              </button>
            </div>

            <div className="text-center">
              <Link href="/wardrobe" className="text-xs text-[#c9a84c] hover:underline">
                Back to Wardrobe
              </Link>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

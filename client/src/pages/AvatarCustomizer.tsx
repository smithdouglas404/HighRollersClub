import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { DashboardLayout } from "@/components/DashboardLayout";
import { GoldButton, GoldCard, SectionHeader, GoldDivider } from "@/components/premium/PremiumComponents";
import {
  Wand2, Lock, ToggleLeft, ToggleRight, Sparkles,
  Check, Download, Eye, Zap, Shield, Sun, Layers,
  User, Camera
} from "lucide-react";

/* ── Prompt Presets ── */
const PROMPT_PRESETS = [
  { label: "Cyberpunk Enforcer", prompt: "A cyberpunk enforcer in a neon-lit city, chrome augmentations, glowing red visor, armored trenchcoat with circuit patterns" },
  { label: "Royal Assassin", prompt: "A royal assassin draped in dark velvet robes, ornate gold dagger, shadowed hood, emerald jeweled brooch on chest" },
  { label: "Mech Commander", prompt: "A mech commander in a massive powered exosuit, holographic HUD display, battle-scarred titanium plating, glowing reactor core" },
  { label: "Inferno Warlord", prompt: "An inferno warlord wreathed in flames, obsidian armor with lava cracks, horned helm, twin fire axes at the hip" },
  { label: "Shadow Oracle", prompt: "A shadow oracle with swirling dark mist, third eye glowing purple, ethereal robes, floating tarot cards orbiting" },
];

/* ── Render Progress Steps ── */
const RENDER_STEPS = [
  { label: "Anatomy Synthesis", icon: User },
  { label: "Armor Forging", icon: Shield },
  { label: "Neural Lighting", icon: Sun },
  { label: "Texture Mapping", icon: Layers },
];

const MAX_PROMPT_LENGTH = 200;

type RenderState = "idle" | "rendering" | "complete";

export default function AvatarCustomizer() {
  const [prompt, setPrompt] = useState("");
  const [renderState, setRenderState] = useState<RenderState>("idle");
  const [stepProgress, setStepProgress] = useState<number[]>([0, 0, 0, 0]);
  const [animatedEffects, setAnimatedEffects] = useState(false);
  const [customGear, setCustomGear] = useState(false);
  const [hdRender, setHdRender] = useState(true);
  const [customPose, setCustomPose] = useState(false);

  const handlePreset = (presetPrompt: string) => {
    setPrompt(presetPrompt.slice(0, MAX_PROMPT_LENGTH));
  };

  const handleRender = useCallback(() => {
    if (!prompt.trim() || renderState === "rendering") return;
    setRenderState("rendering");
    setStepProgress([0, 0, 0, 0]);
  }, [prompt, renderState]);

  // Simulate render progress
  useEffect(() => {
    if (renderState !== "rendering") return;

    const interval = setInterval(() => {
      setStepProgress((prev) => {
        const next = [...prev];
        // Progress each step sequentially with overlap
        for (let i = 0; i < 4; i++) {
          if (next[i] < 100) {
            const canProgress = i === 0 || next[i - 1] >= 30;
            if (canProgress) {
              next[i] = Math.min(100, next[i] + Math.random() * 8 + 2);
            }
            break;
          }
        }
        // Check if all done
        if (next.every((v) => v >= 100)) {
          clearInterval(interval);
          setTimeout(() => setRenderState("complete"), 400);
        }
        return next;
      });
    }, 80);

    return () => clearInterval(interval);
  }, [renderState]);

  const handleSaveAvatar = () => {
    // Reset for another render
    setRenderState("idle");
    setStepProgress([0, 0, 0, 0]);
    setPrompt("");
  };

  return (
    <DashboardLayout title="AI Avatar Customizer">
      <div className="px-4 md:px-8 pb-8 space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-4"
        >
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500/15 to-purple-500/15 border border-amber-500/20 flex items-center justify-center">
            <Wand2 className="w-6 h-6 text-amber-400" />
          </div>
          <div>
            <h2 className="text-lg font-display font-bold text-white tracking-tight">
              AI Avatar Customizer
            </h2>
            <p className="text-[0.625rem] text-muted-foreground">
              Describe your ideal avatar and our AI will render it in high fidelity.
            </p>
          </div>
        </motion.div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* ── Left Panel: Prompt + Settings ── */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="space-y-5"
          >
            {/* Prompt Textarea */}
            <GoldCard padding="p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400/70 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  Describe Your Style
                </h3>
                <span className={`text-[0.625rem] font-mono ${prompt.length >= MAX_PROMPT_LENGTH ? "text-red-400" : "text-gray-500"}`}>
                  {prompt.length}/{MAX_PROMPT_LENGTH}
                </span>
              </div>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value.slice(0, MAX_PROMPT_LENGTH))}
                placeholder="A battle-scarred space marine in obsidian power armor with glowing amber runes..."
                rows={4}
                className="w-full bg-black/40 border border-white/[0.08] rounded-lg px-4 py-3 text-sm text-white placeholder-gray-600 resize-none focus:outline-none focus:border-[#d4af37]/40 focus:ring-1 focus:ring-[#d4af37]/20 transition-all"
                style={{ caretColor: "#d4af37" }}
              />
            </GoldCard>

            {/* Prompt Assistance */}
            <GoldCard padding="p-5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400/70 mb-3 flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-400" />
                Prompt Assistance
              </h3>
              <div className="flex flex-wrap gap-2">
                {PROMPT_PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    onClick={() => handlePreset(preset.prompt)}
                    className="px-3 py-1.5 rounded-lg text-[0.625rem] font-bold uppercase tracking-wider bg-white/5 text-gray-300 border border-white/[0.08] hover:bg-amber-500/10 hover:text-amber-400 hover:border-amber-500/25 transition-all"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </GoldCard>

            {/* Settings */}
            <GoldCard padding="p-5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400/70 mb-4 flex items-center gap-2">
                <Eye className="w-4 h-4 text-amber-400" />
                Render Settings
              </h3>
              <div className="space-y-3">
                {/* Animated Effects (Premium/Locked) */}
                <div className="flex items-center justify-between p-3 rounded-lg border border-white/[0.06] bg-white/[0.02]">
                  <div className="flex items-center gap-2.5">
                    <Lock className="w-3.5 h-3.5 text-gray-500" />
                    <span className="text-[0.6875rem] font-bold text-gray-400">Animated Effects</span>
                    <span className="px-1.5 py-0.5 rounded text-[0.5rem] font-bold uppercase tracking-wider bg-purple-500/15 text-purple-400 border border-purple-500/25">
                      Premium
                    </span>
                  </div>
                  <button
                    onClick={() => setAnimatedEffects(!animatedEffects)}
                    className="text-gray-600 cursor-not-allowed"
                    disabled
                  >
                    <ToggleLeft className="w-7 h-7" />
                  </button>
                </div>

                {/* Custom Gear (Premium/Locked) */}
                <div className="flex items-center justify-between p-3 rounded-lg border border-white/[0.06] bg-white/[0.02]">
                  <div className="flex items-center gap-2.5">
                    <Lock className="w-3.5 h-3.5 text-gray-500" />
                    <span className="text-[0.6875rem] font-bold text-gray-400">Custom Gear Creation</span>
                    <span className="px-1.5 py-0.5 rounded text-[0.5rem] font-bold uppercase tracking-wider bg-purple-500/15 text-purple-400 border border-purple-500/25">
                      Premium
                    </span>
                  </div>
                  <button
                    onClick={() => setCustomGear(!customGear)}
                    className="text-gray-600 cursor-not-allowed"
                    disabled
                  >
                    <ToggleLeft className="w-7 h-7" />
                  </button>
                </div>

                {/* HD Render */}
                <div className="flex items-center justify-between p-3 rounded-lg border border-white/[0.06] bg-white/[0.02]">
                  <div className="flex items-center gap-2.5">
                    <Camera className="w-3.5 h-3.5 text-white/60" />
                    <span className="text-[0.6875rem] font-bold text-white">HD Render Output</span>
                  </div>
                  <button onClick={() => setHdRender(!hdRender)}>
                    {hdRender ? (
                      <ToggleRight className="w-7 h-7 text-amber-400" />
                    ) : (
                      <ToggleLeft className="w-7 h-7 text-gray-500" />
                    )}
                  </button>
                </div>

                {/* Custom Pose */}
                <div className="flex items-center justify-between p-3 rounded-lg border border-white/[0.06] bg-white/[0.02]">
                  <div className="flex items-center gap-2.5">
                    <User className="w-3.5 h-3.5 text-white/60" />
                    <span className="text-[0.6875rem] font-bold text-white">Custom Pose</span>
                  </div>
                  <button onClick={() => setCustomPose(!customPose)}>
                    {customPose ? (
                      <ToggleRight className="w-7 h-7 text-amber-400" />
                    ) : (
                      <ToggleLeft className="w-7 h-7 text-gray-500" />
                    )}
                  </button>
                </div>
              </div>
            </GoldCard>

            {/* Render CTA */}
            <GoldButton
              onClick={handleRender}
              disabled={!prompt.trim() || renderState === "rendering"}
              fullWidth
              className="flex items-center justify-center gap-2"
            >
              <Wand2 className="w-4 h-4" />
              Render with Nano Banana
            </GoldButton>
          </motion.div>

          {/* ── Right Panel: Preview ── */}
          <GoldCard className="flex flex-col" glow>
            <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400/70 mb-5 flex items-center gap-2 text-center justify-center">
              <Eye className="w-4 h-4 text-amber-400" />
              High-Fidelity Render Preview
            </h3>

            <AnimatePresence mode="wait">
              {/* ── Idle State ── */}
              {renderState === "idle" && (
                <motion.div
                  key="idle"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex-1 flex flex-col items-center justify-center py-8"
                >
                  <div className="w-56 h-72 rounded-2xl border-2 border-dashed border-white/10 flex items-center justify-center bg-black/20 mb-4 overflow-hidden">
                    <svg viewBox="0 0 120 160" className="w-36 h-48 opacity-20">
                      {/* Head */}
                      <circle cx="60" cy="40" r="20" fill="#d4af37" />
                      {/* Neck */}
                      <rect x="54" y="58" width="12" height="10" rx="3" fill="#d4af37" />
                      {/* Torso */}
                      <path d="M35 72 Q35 65 60 65 Q85 65 85 72 L88 115 Q88 125 60 125 Q32 125 32 115 Z" fill="#d4af37" />
                      {/* Left arm */}
                      <path d="M35 72 L22 100 L28 102 L38 80" fill="#d4af37" />
                      {/* Right arm */}
                      <path d="M85 72 L98 100 L92 102 L82 80" fill="#d4af37" />
                      {/* Left leg */}
                      <path d="M42 122 L38 155 L48 155 L50 122" fill="#d4af37" />
                      {/* Right leg */}
                      <path d="M70 122 L72 155 L82 155 L78 122" fill="#d4af37" />
                    </svg>
                  </div>
                  <p className="text-sm text-gray-500 text-center">
                    Enter a prompt and click render to generate your avatar
                  </p>
                  <p className="text-[0.625rem] text-gray-600 mt-1 text-center">
                    AI-powered generation creates unique, high-fidelity avatars
                  </p>
                </motion.div>
              )}

              {/* ── Rendering State ── */}
              {renderState === "rendering" && (
                <motion.div
                  key="rendering"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="flex-1 flex flex-col items-center justify-center py-8"
                >
                  {/* Pulsing avatar outline */}
                  <motion.div
                    animate={{ opacity: [0.3, 0.6, 0.3] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="w-44 h-56 rounded-2xl border border-amber-500/30 bg-amber-500/5 flex items-center justify-center mb-6"
                  >
                    <svg viewBox="0 0 120 160" className="w-28 h-36 opacity-30">
                      <circle cx="60" cy="40" r="20" fill="#d4af37" />
                      <rect x="54" y="58" width="12" height="10" rx="3" fill="#d4af37" />
                      <path d="M35 72 Q35 65 60 65 Q85 65 85 72 L88 115 Q88 125 60 125 Q32 125 32 115 Z" fill="#d4af37" />
                      <path d="M35 72 L22 100 L28 102 L38 80" fill="#d4af37" />
                      <path d="M85 72 L98 100 L92 102 L82 80" fill="#d4af37" />
                      <path d="M42 122 L38 155 L48 155 L50 122" fill="#d4af37" />
                      <path d="M70 122 L72 155 L82 155 L78 122" fill="#d4af37" />
                    </svg>
                  </motion.div>

                  {/* Progress Steps */}
                  <div className="w-full max-w-xs space-y-3">
                    {RENDER_STEPS.map((step, i) => {
                      const StepIcon = step.icon;
                      const progress = Math.round(stepProgress[i]);
                      return (
                        <div key={step.label}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[0.625rem] font-bold text-gray-400 flex items-center gap-1.5">
                              <StepIcon className={`w-3 h-3 ${progress >= 100 ? "text-green-400" : progress > 0 ? "text-amber-400" : "text-gray-600"}`} />
                              {step.label}
                            </span>
                            <span className={`text-[0.625rem] font-mono ${progress >= 100 ? "text-green-400" : "text-gray-500"}`}>
                              {progress}%
                            </span>
                          </div>
                          <div className="w-full h-1.5 rounded-full bg-white/5 overflow-hidden">
                            <motion.div
                              className={`h-full rounded-full ${progress >= 100 ? "bg-gradient-to-r from-green-500 to-emerald-400" : "bg-gradient-to-r from-amber-500 to-yellow-400"}`}
                              style={{ width: `${progress}%` }}
                              transition={{ duration: 0.1 }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <p className="text-[0.625rem] text-gray-500 mt-4 animate-pulse">
                    Generating your avatar...
                  </p>
                </motion.div>
              )}

              {/* ── Complete State ── */}
              {renderState === "complete" && (
                <motion.div
                  key="complete"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex-1 flex flex-col items-center justify-center py-8"
                >
                  {/* Generated avatar placeholder */}
                  <motion.div
                    initial={{ scale: 0.9 }}
                    animate={{ scale: [1, 1.01, 1] }}
                    transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                    className="w-52 h-64 rounded-2xl border-2 border-amber-500/40 overflow-hidden mb-5 relative"
                    style={{ boxShadow: "0 0 40px rgba(212,175,55,0.25), 0 8px 32px rgba(0,0,0,0.5)" }}
                  >
                    {/* Rendered result placeholder with gradient fill */}
                    <div className="w-full h-full bg-gradient-to-br from-amber-900/40 via-gray-900 to-purple-900/30 flex items-center justify-center relative">
                      <svg viewBox="0 0 120 160" className="w-32 h-40">
                        <defs>
                          <linearGradient id="avatarGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#d4af37" />
                            <stop offset="100%" stopColor="#c9a84c" />
                          </linearGradient>
                        </defs>
                        <circle cx="60" cy="40" r="20" fill="url(#avatarGrad)" />
                        <rect x="54" y="58" width="12" height="10" rx="3" fill="url(#avatarGrad)" />
                        <path d="M35 72 Q35 65 60 65 Q85 65 85 72 L88 115 Q88 125 60 125 Q32 125 32 115 Z" fill="url(#avatarGrad)" />
                        <path d="M35 72 L22 100 L28 102 L38 80" fill="url(#avatarGrad)" />
                        <path d="M85 72 L98 100 L92 102 L82 80" fill="url(#avatarGrad)" />
                        <path d="M42 122 L38 155 L48 155 L50 122" fill="url(#avatarGrad)" />
                        <path d="M70 122 L72 155 L82 155 L78 122" fill="url(#avatarGrad)" />
                        {/* Accent glow effects */}
                        <circle cx="60" cy="40" r="22" fill="none" stroke="#d4af37" strokeWidth="0.5" opacity="0.4" />
                        <circle cx="60" cy="90" r="30" fill="none" stroke="#d4af37" strokeWidth="0.3" opacity="0.2" />
                      </svg>
                      {/* "AI Generated" badge */}
                      <div className="absolute top-3 right-3 px-2 py-1 rounded text-[0.5rem] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30 backdrop-blur-sm">
                        AI Generated
                      </div>
                    </div>
                  </motion.div>

                  <div className="flex items-center gap-2 mb-2 text-green-400">
                    <Check className="w-4 h-4" />
                    <span className="text-sm font-bold">Render Complete</span>
                  </div>
                  <p className="text-[0.625rem] text-gray-500 mb-5">
                    Your custom avatar has been generated successfully
                  </p>

                  <GoldButton onClick={handleSaveAvatar} className="flex items-center gap-2">
                    <Download className="w-4 h-4" />
                    Apply & Save Avatar
                  </GoldButton>
                </motion.div>
              )}
            </AnimatePresence>
          </GoldCard>
        </div>
      </div>
    </DashboardLayout>
  );
}

import { useState } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { GlassCard, GhostInput, NeonButton } from "@/components/ui/neon";
import { useCreateTable, CreateTableInputGameType } from "@workspace/api-client-react";
import { useLocation, Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  Users,
  Timer,
  Shield,
  Layers,
  Settings2,
  Palette,
  Zap,
  Lock,
  Globe,
  Check,
} from "lucide-react";

const STEPS = [
  { id: "game", label: "Game Type", icon: Layers },
  { id: "stakes", label: "Stakes & Buy-in", icon: Zap },
  { id: "players", label: "Players & Seating", icon: Users },
  { id: "timing", label: "Timer & Blinds", icon: Timer },
  { id: "rules", label: "Advanced Rules", icon: Settings2 },
  { id: "theme", label: "Table Theme", icon: Palette },
  { id: "privacy", label: "Privacy", icon: Shield },
  { id: "review", label: "Review & Create", icon: Check },
];

const GAME_TYPES = [
  { id: "texas_holdem", name: "Texas Hold'em", desc: "Two hole cards. The classic.", image: "mode-holdem.png" },
  { id: "omaha", name: "Omaha", desc: "Four hole cards, use exactly two.", image: "mode-omaha.png" },
  { id: "short_deck", name: "Short Deck", desc: "36 cards, no low cards.", image: "mode-shortdeck.png" },
  { id: "plo5", name: "PLO5", desc: "Five hole cards, pot-limit.", image: "mode-plo5.png" },
];

const TABLE_THEMES = [
  { id: "neon", name: "Neon Vault", color: "#81ecff", desc: "Default cyan glow" },
  { id: "emerald", name: "Emerald", color: "#3fff8b", desc: "Green luxury" },
  { id: "crimson", name: "Crimson", color: "#ff7076", desc: "Red high-stakes" },
  { id: "phantom", name: "Phantom", color: "#a78bfa", desc: "Purple mystic" },
  { id: "gold", name: "Gold Rush", color: "#fbbf24", desc: "Classic gold" },
  { id: "obsidian", name: "Obsidian", color: "#666", desc: "Minimal dark" },
];

interface TableConfig {
  gameType: string;
  name: string;
  smallBlind: number;
  bigBlind: number;
  minBuyIn: number;
  maxBuyIn: number;
  maxPlayers: number;
  turnTimer: number;
  timeBank: number;
  ante: number;
  straddle: boolean;
  runItTwice: boolean;
  bombPot: boolean;
  theme: string;
  isPrivate: boolean;
  password: string;
  inviteOnly: boolean;
}

export function TableSetup() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const createTable = useCreateTable();

  const [step, setStep] = useState(0);
  const [config, setConfig] = useState<TableConfig>({
    gameType: "texas_holdem",
    name: "",
    smallBlind: 1,
    bigBlind: 2,
    minBuyIn: 40,
    maxBuyIn: 200,
    maxPlayers: 9,
    turnTimer: 30,
    timeBank: 60,
    ante: 0,
    straddle: false,
    runItTwice: false,
    bombPot: false,
    theme: "neon",
    isPrivate: false,
    password: "",
    inviteOnly: false,
  });

  const update = <K extends keyof TableConfig>(field: K, value: TableConfig[K]) =>
    setConfig((prev) => ({ ...prev, [field]: value }));

  const nextStep = () => setStep((s) => Math.min(s + 1, STEPS.length - 1));
  const prevStep = () => setStep((s) => Math.max(s - 1, 0));

  const handleCreate = async () => {
    try {
      const newTable = await createTable.mutateAsync({
        data: {
          name: config.name || `${GAME_TYPES.find((g) => g.id === config.gameType)?.name} Table`,
          gameType: config.gameType as CreateTableInputGameType,
          smallBlind: config.smallBlind,
          bigBlind: config.bigBlind,
          minBuyIn: config.minBuyIn,
          maxBuyIn: config.maxBuyIn,
          maxPlayers: config.maxPlayers,
          isPrivate: config.isPrivate,
        },
      });
      toast({ title: "Table Created", description: "Your private table is ready." });
      setLocation(`/table/${newTable.id}`);
    } catch (error: unknown) {
      toast({ title: "Error", description: error instanceof Error ? error.message : "Failed to create table", variant: "destructive" });
    }
  };

  const renderStep = () => {
    switch (STEPS[step].id) {
      case "game":
        return (
          <div>
            <h2 className="text-2xl font-display font-bold text-white mb-2">Choose Game Type</h2>
            <p className="text-muted-foreground text-sm mb-8">Select the poker variant for your private table.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {GAME_TYPES.map((gt) => (
                <div
                  key={gt.id}
                  onClick={() => update("gameType", gt.id)}
                  className={cn(
                    "cursor-pointer rounded-md overflow-hidden transition-all duration-200",
                    config.gameType === gt.id
                      ? "ring-2 ring-primary shadow-[0_0_25px_rgba(129,236,255,0.2)]"
                      : "bg-surface-high/50 border border-white/[0.06] hover:border-primary/30"
                  )}
                >
                  <div className="relative h-28 overflow-hidden">
                    <img src={`${import.meta.env.BASE_URL}images/${gt.image}`} alt={gt.name} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-surface-high to-transparent" />
                    {config.gameType === gt.id && (
                      <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                        <Check className="w-3.5 h-3.5 text-background" />
                      </div>
                    )}
                  </div>
                  <div className="p-4">
                    <h3 className="font-display font-bold text-white text-lg">{gt.name}</h3>
                    <p className="text-xs text-muted-foreground">{gt.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );

      case "stakes":
        return (
          <div>
            <h2 className="text-2xl font-display font-bold text-white mb-2">Stakes & Buy-in</h2>
            <p className="text-muted-foreground text-sm mb-8">Set the blind levels and buy-in range.</p>
            <div className="space-y-6">
              <GhostInput label="Table Name (Optional)" placeholder="e.g., The Neon Lounge" value={config.name} onChange={(e) => update("name", e.target.value)} />
              <div className="grid grid-cols-2 gap-4">
                <GhostInput type="number" label="Small Blind" value={config.smallBlind} onChange={(e) => { update("smallBlind", Number(e.target.value)); update("bigBlind", Number(e.target.value) * 2); }} />
                <GhostInput type="number" label="Big Blind" value={config.bigBlind} onChange={(e) => update("bigBlind", Number(e.target.value))} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <GhostInput type="number" label="Min Buy-in (BB)" value={config.minBuyIn} onChange={(e) => update("minBuyIn", Number(e.target.value))} />
                <GhostInput type="number" label="Max Buy-in (BB)" value={config.maxBuyIn} onChange={(e) => update("maxBuyIn", Number(e.target.value))} />
              </div>
              <div className="bg-surface-low/50 rounded-md p-4 border border-white/[0.04]">
                <p className="text-xs text-muted-foreground uppercase tracking-widest mb-2">Buy-in Range</p>
                <p className="font-display font-bold text-white text-xl">
                  ${(config.smallBlind * config.minBuyIn).toLocaleString()} – ${(config.smallBlind * config.maxBuyIn).toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        );

      case "players":
        return (
          <div>
            <h2 className="text-2xl font-display font-bold text-white mb-2">Players & Seating</h2>
            <p className="text-muted-foreground text-sm mb-8">Configure the number of seats at your table.</p>
            <div className="space-y-6">
              <div>
                <label className="text-sm font-medium text-muted-foreground block mb-3">Max Players</label>
                <div className="flex gap-2">
                  {[2, 4, 6, 8, 9].map((n) => (
                    <button
                      key={n}
                      onClick={() => update("maxPlayers", n)}
                      className={cn(
                        "flex-1 py-3 rounded-md font-display font-bold text-lg transition-all",
                        config.maxPlayers === n
                          ? "bg-primary/15 text-primary border border-primary/30 shadow-[0_0_15px_rgba(129,236,255,0.15)]"
                          : "bg-surface-high/50 text-muted-foreground border border-white/[0.06] hover:text-foreground hover:border-white/10"
                      )}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
              <div className="bg-surface-low/50 rounded-md p-6 border border-white/[0.04] flex items-center justify-center">
                <div className="relative w-48 h-32">
                  <div className="absolute inset-4 rounded-[50%] border-2 border-primary/20 bg-[#0d2a1f]/30" />
                  {Array.from({ length: config.maxPlayers }).map((_, i) => {
                    const angle = (i / config.maxPlayers) * Math.PI * 2 - Math.PI / 2;
                    const x = 50 + Math.cos(angle) * 46;
                    const y = 50 + Math.sin(angle) * 42;
                    return (
                      <div key={i} className="absolute w-4 h-4 rounded-full bg-primary/30 border border-primary/50 -translate-x-1/2 -translate-y-1/2" style={{ left: `${x}%`, top: `${y}%` }} />
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        );

      case "timing":
        return (
          <div>
            <h2 className="text-2xl font-display font-bold text-white mb-2">Timer & Blind Structure</h2>
            <p className="text-muted-foreground text-sm mb-8">Configure action timers and time banks.</p>
            <div className="space-y-6">
              <div>
                <label className="text-sm font-medium text-muted-foreground block mb-3">Turn Timer (seconds)</label>
                <div className="flex gap-2">
                  {[15, 20, 30, 45, 60].map((t) => (
                    <button
                      key={t}
                      onClick={() => update("turnTimer", t)}
                      className={cn(
                        "flex-1 py-3 rounded-md font-display font-bold transition-all",
                        config.turnTimer === t
                          ? "bg-primary/15 text-primary border border-primary/30"
                          : "bg-surface-high/50 text-muted-foreground border border-white/[0.06] hover:text-foreground"
                      )}
                    >
                      {t}s
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground block mb-3">Time Bank (total seconds)</label>
                <div className="flex gap-2">
                  {[0, 30, 60, 120, 180].map((t) => (
                    <button
                      key={t}
                      onClick={() => update("timeBank", t)}
                      className={cn(
                        "flex-1 py-3 rounded-md font-display font-bold transition-all",
                        config.timeBank === t
                          ? "bg-secondary/15 text-secondary border border-secondary/30"
                          : "bg-surface-high/50 text-muted-foreground border border-white/[0.06] hover:text-foreground"
                      )}
                    >
                      {t === 0 ? "Off" : `${t}s`}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        );

      case "rules":
        return (
          <div>
            <h2 className="text-2xl font-display font-bold text-white mb-2">Advanced Rules</h2>
            <p className="text-muted-foreground text-sm mb-8">Optional rules to customize gameplay.</p>
            <div className="space-y-4">
              <GhostInput type="number" label="Ante Amount" value={config.ante} onChange={(e) => update("ante", Number(e.target.value))} />
              {([
                { field: "straddle" as const, label: "Allow Straddle", desc: "Players can voluntarily post a blind raise before cards are dealt." },
                { field: "runItTwice" as const, label: "Run It Twice", desc: "When all-in, deal remaining community cards twice and split the pot." },
                { field: "bombPot" as const, label: "Bomb Pots", desc: "Periodic hands where everyone antes extra and goes straight to the flop." },
              ]).map((rule) => (
                <div
                  key={rule.field}
                  onClick={() => update(rule.field, !config[rule.field])}
                  className={cn(
                    "flex items-center gap-4 p-4 rounded-md cursor-pointer transition-all",
                    config[rule.field]
                      ? "bg-primary/10 border border-primary/20"
                      : "bg-surface-high/50 border border-white/[0.06] hover:border-white/10"
                  )}
                >
                  <div className={cn(
                    "w-5 h-5 rounded-sm border-2 flex items-center justify-center transition-all",
                    config[rule.field] ? "bg-primary border-primary" : "border-white/20"
                  )}>
                    {config[rule.field] && <Check className="w-3 h-3 text-background" />}
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-white text-sm">{rule.label}</p>
                    <p className="text-xs text-muted-foreground">{rule.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );

      case "theme":
        return (
          <div>
            <h2 className="text-2xl font-display font-bold text-white mb-2">Table Theme</h2>
            <p className="text-muted-foreground text-sm mb-8">Choose the visual style for your table.</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {TABLE_THEMES.map((th) => (
                <div
                  key={th.id}
                  onClick={() => update("theme", th.id)}
                  className={cn(
                    "cursor-pointer rounded-md p-4 text-center transition-all",
                    config.theme === th.id
                      ? "border-2 shadow-[0_0_20px_rgba(129,236,255,0.15)]"
                      : "bg-surface-high/50 border border-white/[0.06] hover:border-white/10"
                  )}
                  style={config.theme === th.id ? { borderColor: th.color, boxShadow: `0 0 20px ${th.color}20` } : {}}
                >
                  <div className="w-10 h-10 rounded-full mx-auto mb-3 border-2" style={{ backgroundColor: `${th.color}20`, borderColor: `${th.color}60` }}>
                    <div className="w-full h-full rounded-full flex items-center justify-center">
                      <div className="w-4 h-4 rounded-full" style={{ backgroundColor: th.color }} />
                    </div>
                  </div>
                  <p className="font-display font-bold text-white text-sm">{th.name}</p>
                  <p className="text-[10px] text-muted-foreground">{th.desc}</p>
                </div>
              ))}
            </div>
          </div>
        );

      case "privacy":
        return (
          <div>
            <h2 className="text-2xl font-display font-bold text-white mb-2">Privacy Settings</h2>
            <p className="text-muted-foreground text-sm mb-8">Control who can find and join your table.</p>
            <div className="space-y-4">
              {[
                { value: false, icon: Globe, label: "Public Table", desc: "Anyone can find and join this table from the lobby." },
                { value: true, icon: Lock, label: "Private Table", desc: "Only players with the link or password can join." },
              ].map((opt) => (
                <div
                  key={String(opt.value)}
                  onClick={() => update("isPrivate", opt.value)}
                  className={cn(
                    "flex items-center gap-4 p-5 rounded-md cursor-pointer transition-all",
                    config.isPrivate === opt.value
                      ? "bg-primary/10 border border-primary/20 shadow-[0_0_15px_rgba(129,236,255,0.1)]"
                      : "bg-surface-high/50 border border-white/[0.06] hover:border-white/10"
                  )}
                >
                  <div className={cn(
                    "w-10 h-10 rounded-md flex items-center justify-center",
                    config.isPrivate === opt.value ? "bg-primary/20 text-primary" : "bg-surface-lowest text-muted-foreground"
                  )}>
                    <opt.icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-white">{opt.label}</p>
                    <p className="text-xs text-muted-foreground">{opt.desc}</p>
                  </div>
                  <div className={cn(
                    "w-5 h-5 rounded-full border-2 flex items-center justify-center",
                    config.isPrivate === opt.value ? "border-primary bg-primary" : "border-white/20"
                  )}>
                    {config.isPrivate === opt.value && <Check className="w-3 h-3 text-background" />}
                  </div>
                </div>
              ))}
              {config.isPrivate && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="mt-4">
                  <GhostInput type="password" label="Table Password (Optional)" placeholder="Enter password..." value={config.password} onChange={(e) => update("password", e.target.value)} />
                </motion.div>
              )}
            </div>
          </div>
        );

      case "review":
        return (
          <div>
            <h2 className="text-2xl font-display font-bold text-white mb-2">Review & Create</h2>
            <p className="text-muted-foreground text-sm mb-8">Confirm your table settings before launching.</p>
            <div className="space-y-3">
              {[
                { label: "Game Type", value: GAME_TYPES.find((g) => g.id === config.gameType)?.name },
                { label: "Table Name", value: config.name || "Auto-generated" },
                { label: "Stakes", value: `$${config.smallBlind}/$${config.bigBlind}` },
                { label: "Buy-in Range", value: `$${config.smallBlind * config.minBuyIn} – $${config.smallBlind * config.maxBuyIn}` },
                { label: "Max Players", value: config.maxPlayers },
                { label: "Turn Timer", value: `${config.turnTimer}s` },
                { label: "Time Bank", value: config.timeBank ? `${config.timeBank}s` : "Off" },
                { label: "Ante", value: config.ante ? `$${config.ante}` : "None" },
                { label: "Straddle", value: config.straddle ? "Allowed" : "Disabled" },
                { label: "Run It Twice", value: config.runItTwice ? "Enabled" : "Disabled" },
                { label: "Theme", value: TABLE_THEMES.find((t) => t.id === config.theme)?.name },
                { label: "Privacy", value: config.isPrivate ? "Private" : "Public" },
              ].map((item, i) => (
                <div key={i} className="flex items-center justify-between py-2.5 border-b border-white/[0.04] last:border-0">
                  <span className="text-sm text-muted-foreground">{item.label}</span>
                  <span className="text-sm font-bold text-white">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto px-6 py-8">
        <Link href="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-white transition-colors mb-6 text-sm">
          <ChevronLeft className="w-4 h-4" />
          Back to Lobby
        </Link>

        <div className="flex items-center gap-2 mb-8 overflow-x-auto hide-scrollbar pb-2">
          {STEPS.map((s, i) => (
            <button
              key={s.id}
              onClick={() => setStep(i)}
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-md whitespace-nowrap text-xs font-bold uppercase tracking-wider transition-all",
                step === i
                  ? "bg-primary/15 text-primary border border-primary/30"
                  : step > i
                  ? "bg-surface-high/50 text-secondary border border-white/[0.06]"
                  : "bg-surface-high/30 text-muted-foreground border border-white/[0.04]"
              )}
            >
              <s.icon className="w-3.5 h-3.5" />
              {s.label}
            </button>
          ))}
        </div>

        <div className="bg-surface-high/50 backdrop-blur-2xl rounded-md border border-white/[0.06] p-6 md:p-8 min-h-[400px]">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              {renderStep()}
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="flex items-center justify-between mt-6">
          <NeonButton variant="ghost" onClick={prevStep} disabled={step === 0} className="gap-1">
            <ChevronLeft className="w-4 h-4" /> Previous
          </NeonButton>

          <div className="flex items-center gap-1">
            {STEPS.map((_, i) => (
              <div key={i} className={cn("w-2 h-2 rounded-full transition-all", i === step ? "bg-primary w-6" : i < step ? "bg-secondary" : "bg-white/10")} />
            ))}
          </div>

          {step < STEPS.length - 1 ? (
            <NeonButton onClick={nextStep} className="gap-1">
              Next <ChevronRight className="w-4 h-4" />
            </NeonButton>
          ) : (
            <NeonButton onClick={handleCreate} disabled={createTable.isPending} className="gap-1.5">
              <Zap className="w-4 h-4" />
              {createTable.isPending ? "Creating..." : "Launch Table"}
            </NeonButton>
          )}
        </div>
      </div>
    </AppLayout>
  );
}

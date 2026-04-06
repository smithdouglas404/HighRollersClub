import { useState } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { GlassCard, NeonButton } from "@/components/ui/neon";
import { useListTables } from "@workspace/api-client-react";
import { Link } from "wouter";
import { formatChips } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { Users, Zap, Filter, ChevronRight, Flame, Lock, Clock, Layers } from "lucide-react";

const gameModes = [
  {
    id: "texas_holdem",
    name: "Texas Hold'em",
    description: "The classic. Two hole cards, five community cards. Master position, reads, and calculated aggression.",
    image: "mode-holdem.png",
    players: "2-9",
    difficulty: "All Levels",
  },
  {
    id: "omaha",
    name: "Omaha",
    description: "Four hole cards, bigger hands, bigger pots. Must use exactly two from your hand.",
    image: "mode-omaha.png",
    players: "2-9",
    difficulty: "Intermediate",
  },
  {
    id: "short_deck",
    name: "Short Deck",
    description: "36-card deck, no cards below 6. Flush beats a full house. Fast and volatile.",
    image: "mode-shortdeck.png",
    players: "2-6",
    difficulty: "Advanced",
  },
  {
    id: "plo5",
    name: "PLO5",
    description: "Five hole cards, pot-limit betting. Maximum complexity, maximum action.",
    image: "mode-plo5.png",
    players: "2-6",
    difficulty: "Expert",
  },
];

const filterOptions = [
  { value: "all", label: "All Games" },
  { value: "texas_holdem", label: "Hold'em" },
  { value: "omaha", label: "Omaha" },
  { value: "short_deck", label: "Short Deck" },
  { value: "plo5", label: "PLO5" },
];

const stakeFilters = [
  { value: "all", label: "All Stakes" },
  { value: "micro", label: "Micro" },
  { value: "low", label: "Low" },
  { value: "mid", label: "Mid" },
  { value: "high", label: "High" },
];

export function Home() {
  const { data: tables, isLoading: tablesLoading } = useListTables();
  const [activeFilter, setActiveFilter] = useState("all");
  const [activeStake, setActiveStake] = useState("all");
  const [selectedMode, setSelectedMode] = useState<string | null>(null);

  const filteredTables = tables?.filter((t) => {
    if (activeFilter !== "all" && t.gameType !== activeFilter) return false;
    if (activeStake !== "all") {
      const bb = t.bigBlind;
      if (activeStake === "micro" && bb > 10) return false;
      if (activeStake === "low" && (bb <= 10 || bb > 50)) return false;
      if (activeStake === "mid" && (bb <= 50 || bb > 200)) return false;
      if (activeStake === "high" && bb <= 200) return false;
    }
    return true;
  });

  return (
    <AppLayout>
      <div className="relative w-full">

        <div className="relative w-full overflow-hidden">
          <div className="absolute inset-0">
            <img
              src={`${import.meta.env.BASE_URL}images/hero-bg.png`}
              alt="Neon Vault"
              className="w-full h-full object-cover opacity-40"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-background/30 via-background/60 to-background" />
            <div className="absolute inset-0 bg-gradient-to-r from-background/80 via-transparent to-background/80" />
          </div>

          <div className="relative max-w-7xl mx-auto px-6 pt-8 pb-6 z-10">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4 backdrop-blur-md border border-primary/20">
                <Flame className="w-3.5 h-3.5 text-destructive animate-pulse" />
                <span>High Stakes. Zero Limits.</span>
              </div>
              <h1 className="text-5xl md:text-7xl font-display font-bold text-white mb-3 leading-none tracking-tighter">
                SELECT YOUR <br />
                <span className="text-transparent bg-clip-text gradient-primary neon-text-glow">GAME MODE</span>
              </h1>
              <p className="text-muted-foreground text-lg max-w-lg font-body">
                Choose your variant. Find your table. Enter the vault.
              </p>
            </motion.div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-6 -mt-2 relative z-20">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-16">
            {gameModes.map((mode, i) => (
              <motion.div
                key={mode.id}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1, duration: 0.5 }}
              >
                <div
                  onClick={() => {
                    setSelectedMode(mode.id === selectedMode ? null : mode.id);
                    setActiveFilter(mode.id === selectedMode ? "all" : mode.id);
                  }}
                  className={cn(
                    "group cursor-pointer relative overflow-hidden rounded-md transition-all duration-300",
                    "bg-surface-high/60 backdrop-blur-2xl",
                    selectedMode === mode.id
                      ? "ring-1 ring-primary shadow-[0_0_30px_rgba(129,236,255,0.25)]"
                      : "border border-white/[0.06] hover:border-primary/30 hover:shadow-[0_0_20px_rgba(129,236,255,0.1)]"
                  )}
                >
                  <div className="relative h-40 overflow-hidden">
                    <img
                      src={`${import.meta.env.BASE_URL}images/${mode.image}`}
                      alt={mode.name}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-surface-high via-surface-high/40 to-transparent" />

                    <div className="absolute top-3 right-3">
                      <span className="px-2 py-0.5 rounded-full bg-surface-lowest/80 backdrop-blur-md text-[10px] font-bold uppercase tracking-widest text-primary border border-primary/20">
                        {mode.difficulty}
                      </span>
                    </div>
                  </div>

                  <div className="p-4 pt-1">
                    <h3 className="text-xl font-display font-bold text-white group-hover:text-primary transition-colors mb-1">
                      {mode.name}
                    </h3>
                    <p className="text-xs text-muted-foreground line-clamp-2 mb-3 leading-relaxed">
                      {mode.description}
                    </p>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-muted-foreground uppercase tracking-widest flex items-center gap-1">
                        <Users className="w-3 h-3" /> {mode.players} Players
                      </span>
                      <span className="text-primary text-xs font-bold flex items-center gap-1 group-hover:gap-2 transition-all">
                        Play <ChevronRight className="w-3 h-3" />
                      </span>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          <div className="mb-8">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
              <div>
                <h2 className="text-3xl font-display font-bold text-white flex items-center gap-3">
                  <Zap className="w-7 h-7 text-primary" />
                  Active Tables
                </h2>
                <p className="text-muted-foreground mt-1">Jump right into the action.</p>
              </div>
              <div className="flex items-center gap-2">
                <Link href="/table/new">
                  <NeonButton size="sm" className="gap-1.5">
                    <Layers className="w-4 h-4" />
                    Create Table
                  </NeonButton>
                </Link>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 mb-6">
              <Filter className="w-4 h-4 text-muted-foreground mr-1" />
              {filterOptions.map((f) => (
                <button
                  key={f.value}
                  onClick={() => setActiveFilter(f.value)}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all duration-200",
                    activeFilter === f.value
                      ? "bg-primary/15 text-primary border border-primary/30"
                      : "bg-surface-high/60 text-muted-foreground border border-white/[0.06] hover:text-foreground hover:bg-white/5"
                  )}
                >
                  {f.label}
                </button>
              ))}
              <div className="w-px h-5 bg-white/10 mx-1" />
              {stakeFilters.map((f) => (
                <button
                  key={f.value}
                  onClick={() => setActiveStake(f.value)}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all duration-200",
                    activeStake === f.value
                      ? "bg-secondary/15 text-secondary border border-secondary/30"
                      : "bg-surface-high/60 text-muted-foreground border border-white/[0.06] hover:text-foreground hover:bg-white/5"
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {tablesLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="h-44 bg-surface-high/40 backdrop-blur-xl rounded-md animate-pulse" />
              ))}
            </div>
          ) : filteredTables?.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center bg-surface-low/30 backdrop-blur-xl rounded-md">
              <Layers className="w-14 h-14 text-muted-foreground mb-4 opacity-30" />
              <h3 className="text-xl font-display font-bold text-white mb-2">No tables found</h3>
              <p className="text-muted-foreground mb-6 text-sm">Try adjusting your filters or create a new table.</p>
              <Link href="/table/new">
                <NeonButton>Create Table</NeonButton>
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-16">
              <AnimatePresence mode="popLayout">
                {filteredTables?.map((table, i) => (
                  <motion.div
                    key={table.id}
                    layout
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ delay: i * 0.03 }}
                  >
                    <Link href={`/table/${table.id}`}>
                      <div className={cn(
                        "group cursor-pointer rounded-md p-5 transition-all duration-300 relative overflow-hidden",
                        "bg-surface-high/50 backdrop-blur-2xl border border-white/[0.06]",
                        "hover:border-primary/30 hover:shadow-[0_0_25px_rgba(129,236,255,0.12)]",
                        table.status === "in_progress" && "border-l-2 border-l-secondary"
                      )}>
                        <div className="flex justify-between items-start mb-3">
                          <span className="px-2 py-0.5 rounded bg-surface-lowest/80 text-[10px] font-bold uppercase tracking-widest text-primary">
                            {table.gameType.replace("_", " ")}
                          </span>
                          <div className="flex items-center gap-2">
                            {table.isPrivate && <Lock className="w-3.5 h-3.5 text-destructive" />}
                            <span className={cn(
                              "text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full",
                              table.status === "in_progress"
                                ? "bg-secondary/10 text-secondary"
                                : "bg-surface-lowest/60 text-muted-foreground"
                            )}>
                              {table.status === "in_progress" ? "LIVE" : table.status.replace("_", " ")}
                            </span>
                          </div>
                        </div>

                        <h3 className="text-xl font-display font-bold text-white mb-1 group-hover:text-primary transition-colors">
                          {table.name}
                        </h3>

                        <div className="flex items-center gap-4 text-sm mb-4">
                          <span className="text-muted-foreground">
                            Stakes: <span className="text-foreground font-bold">{formatChips(table.smallBlind)}/{formatChips(table.bigBlind)}</span>
                          </span>
                        </div>

                        <div className="flex items-center justify-between pt-3 border-t border-white/[0.05]">
                          <div className="flex items-center gap-2">
                            <Users className="w-4 h-4 text-primary" />
                            <span className="text-sm">
                              <span className="font-bold text-white">{table.currentPlayers}</span>
                              <span className="text-muted-foreground">/{table.maxPlayers}</span>
                            </span>
                          </div>
                          <span className="text-primary text-xs font-bold flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            Join <ChevronRight className="w-3 h-3" />
                          </span>
                        </div>
                      </div>
                    </Link>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}

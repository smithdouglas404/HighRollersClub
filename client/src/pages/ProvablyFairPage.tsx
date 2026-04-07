import { useState, useCallback } from "react";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { GoldButton, GoldCard, SectionHeader, GoldDivider } from "@/components/premium/PremiumComponents";
import {
  ShieldCheck, Lock, Hash, Eye, CheckCircle, RefreshCw,
  ArrowRight, Server, Shuffle, FileCheck, UserCheck,
  XCircle, ChevronRight,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Crypto helpers (all client-side, no server needed)                */
/* ------------------------------------------------------------------ */

function randomHex(bytes: number): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return Array.from(buf)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function sha256Hex(message: string): Promise<string> {
  const data = new TextEncoder().encode(message);
  const hashBuf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function hmacSha256(key: string, msg: string): Promise<Uint8Array> {
  const enc = new TextEncoder();
  const k = await crypto.subtle.importKey(
    "raw",
    enc.encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", k, enc.encode(msg));
  return new Uint8Array(sig);
}

const SUITS = ["hearts", "diamonds", "clubs", "spades"] as const;
const RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"] as const;
const SUIT_SHORT: Record<string, string> = { hearts: "h", diamonds: "d", clubs: "c", spades: "s" };
const SUIT_SYMBOL: Record<string, string> = { hearts: "\u2665", diamonds: "\u2666", clubs: "\u2663", spades: "\u2660" };
const SUIT_COLOR: Record<string, string> = { hearts: "#ef4444", diamonds: "#ef4444", clubs: "#e0e0e0", spades: "#e0e0e0" };

type Card = { suit: string; rank: string };

function buildDeck(): Card[] {
  const deck: Card[] = [];
  for (const s of SUITS) for (const r of RANKS) deck.push({ suit: s, rank: r });
  return deck;
}

async function shuffleDeck(seed: string): Promise<Card[]> {
  const deck = buildDeck();
  for (let i = deck.length - 1; i > 0; i--) {
    const h = await hmacSha256(seed, `shuffle-index-${i}`);
    const rand = ((h[0] << 24) | (h[1] << 16) | (h[2] << 8) | h[3]) >>> 0;
    const j = rand % (i + 1);
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function deckOrderString(deck: Card[]): string {
  return deck.map((c) => c.rank + SUIT_SHORT[c.suit]).join(",");
}

/* ------------------------------------------------------------------ */
/*  Small presentational components                                    */
/* ------------------------------------------------------------------ */

function MiniCard({ card }: { card: Card }) {
  const color = SUIT_COLOR[card.suit];
  return (
    <div
      className="w-14 h-20 rounded-lg flex flex-col items-center justify-center font-bold select-none shrink-0"
      style={{
        background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)",
        border: "1px solid rgba(212,175,55,0.25)",
        boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
      }}
    >
      <span className="text-base leading-none" style={{ color }}>{card.rank}</span>
      <span className="text-lg leading-none mt-0.5" style={{ color }}>{SUIT_SYMBOL[card.suit]}</span>
    </div>
  );
}

function GlassCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-2xl p-6 ${className}`}
      style={{
        background: "linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.01) 100%)",
        border: "1px solid rgba(255,255,255,0.07)",
        backdropFilter: "blur(12px)",
        boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
      }}
    >
      {children}
    </div>
  );
}

function StepCard({ step, icon: Icon, title, description }: { step: number; icon: any; title: string; description: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: step * 0.1, duration: 0.5 }}
    >
      <GlassCard className="h-full relative overflow-hidden">
        {/* Step number watermark */}
        <div
          className="absolute -top-4 -right-2 text-7xl font-black select-none pointer-events-none"
          style={{ color: "rgba(212,175,55,0.06)" }}
        >
          {step}
        </div>
        <div className="relative z-10">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
            style={{
              background: "rgba(212,175,55,0.1)",
              border: "1px solid rgba(212,175,55,0.2)",
            }}
          >
            <Icon className="w-6 h-6" style={{ color: "#d4af37" }} />
          </div>
          <div className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: "#d4af37" }}>
            Step {step}
          </div>
          <h3 className="text-lg font-bold text-white mb-2">{title}</h3>
          <p className="text-sm text-gray-400 leading-relaxed">{description}</p>
        </div>
      </GlassCard>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main page component                                                */
/* ------------------------------------------------------------------ */

interface DemoState {
  seed: string;
  hash: string;
  deck: Card[];
  deckOrder: string;
  verified: boolean | null;
  verifying: boolean;
}

export default function ProvablyFairPage() {
  const [demo, setDemo] = useState<DemoState | null>(null);
  const [generating, setGenerating] = useState(false);

  const handleGenerate = useCallback(async () => {
    setGenerating(true);
    try {
      const seed = randomHex(32);
      const deck = await shuffleDeck(seed);
      const order = deckOrderString(deck);
      const hash = await sha256Hex(order);
      setDemo({ seed, hash, deck, deckOrder: order, verified: null, verifying: false });
    } finally {
      setGenerating(false);
    }
  }, []);

  const handleVerify = useCallback(async () => {
    if (!demo) return;
    setDemo((prev) => prev && { ...prev, verifying: true, verified: null });
    // Re-derive the deck from the seed independently
    const deck = await shuffleDeck(demo.seed);
    const order = deckOrderString(deck);
    const recomputedHash = await sha256Hex(order);
    const match = recomputedHash === demo.hash;
    setDemo((prev) => prev && { ...prev, verified: match, verifying: false });
  }, [demo]);

  return (
    <div
      className="min-h-screen w-full overflow-x-hidden"
      style={{ background: "linear-gradient(180deg, #0a0c14 0%, #0d1117 50%, #0a0c14 100%)" }}
    >
      {/* ============================================================ */}
      {/*  HERO                                                        */}
      {/* ============================================================ */}
      <section className="relative px-4 pt-20 pb-24 flex flex-col items-center text-center overflow-hidden">
        {/* Background glow */}
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full pointer-events-none"
          style={{
            background: "radial-gradient(circle, rgba(212,175,55,0.08) 0%, transparent 70%)",
            filter: "blur(80px)",
          }}
        />

        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6 }}
          className="relative z-10"
        >
          <div
            className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6"
            style={{
              background: "linear-gradient(135deg, rgba(212,175,55,0.15) 0%, rgba(212,175,55,0.05) 100%)",
              border: "1px solid rgba(212,175,55,0.3)",
              boxShadow: "0 0 60px rgba(212,175,55,0.15)",
            }}
          >
            <ShieldCheck className="w-10 h-10" style={{ color: "#d4af37" }} />
          </div>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.6 }}
          className="relative z-10 text-4xl sm:text-5xl md:text-6xl font-black text-white tracking-tight mb-4"
        >
          Provably Fair{" "}
          <span
            style={{
              background: "linear-gradient(135deg, #d4af37 0%, #f5d680 50%, #d4af37 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            Poker
          </span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.6 }}
          className="relative z-10 text-lg sm:text-xl text-gray-400 max-w-2xl mb-8 leading-relaxed"
        >
          Every shuffle is cryptographically verified. No trust required.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.6 }}
          className="relative z-10 flex items-center gap-3 text-sm text-gray-500"
        >
          <Lock className="w-4 h-4" style={{ color: "#d4af37" }} />
          <span>SHA-256</span>
          <span className="text-gray-700">|</span>
          <span>HMAC Fisher-Yates</span>
          <span className="text-gray-700">|</span>
          <span>Open Verification</span>
        </motion.div>
      </section>

      {/* ============================================================ */}
      {/*  HOW IT WORKS                                                */}
      {/* ============================================================ */}
      <section className="px-4 pb-24 max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-3">How It Works</h2>
          <p className="text-gray-500 max-w-xl mx-auto">
            Four simple steps guarantee that no one -- not even us -- can manipulate the cards.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <StepCard
            step={1}
            icon={Server}
            title="Commit"
            description="Before the hand, the server generates a random seed and publishes a SHA-256 hash commitment. The seed stays hidden."
          />
          <StepCard
            step={2}
            icon={Shuffle}
            title="Shuffle"
            description="Cards are shuffled using the seed with an HMAC-based Fisher-Yates algorithm -- cryptographically uniform randomness."
          />
          <StepCard
            step={3}
            icon={Eye}
            title="Reveal"
            description="After the hand completes, the original seed is revealed so every player can see exactly what drove the shuffle."
          />
          <StepCard
            step={4}
            icon={FileCheck}
            title="Verify"
            description="You can independently re-run the shuffle algorithm with the seed and confirm the resulting deck matches the commitment hash."
          />
        </div>
      </section>

      {/* ============================================================ */}
      {/*  LIVE DEMO                                                   */}
      {/* ============================================================ */}
      <section className="px-4 pb-24 max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="text-center mb-10"
        >
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-3">Try It Yourself</h2>
          <p className="text-gray-500 max-w-xl mx-auto">
            Generate a real cryptographic shuffle right here in your browser. Then verify it.
          </p>
        </motion.div>

        <GoldCard className="max-w-3xl mx-auto" glow>
          {/* Generate button */}
          <div className="flex justify-center mb-6">
            <GoldButton
              onClick={handleGenerate}
              disabled={generating}
              className="flex items-center gap-2.5"
            >
              {generating ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Shuffle className="w-4 h-4" />
              )}
              Generate a Shuffle
            </GoldButton>
          </div>

          <AnimatePresence mode="wait">
            {demo && (
              <motion.div
                key={demo.seed}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.35 }}
                className="space-y-5"
              >
                {/* Seed */}
                <div>
                  <label className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-1.5 block">
                    Server Seed (hex)
                  </label>
                  <div
                    className="rounded-lg px-4 py-3 text-xs font-mono break-all"
                    style={{
                      background: "rgba(168,85,247,0.06)",
                      border: "1px solid rgba(168,85,247,0.15)",
                      color: "#c084fc",
                    }}
                  >
                    {demo.seed}
                  </div>
                </div>

                {/* Hash */}
                <div>
                  <label className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-1.5 block">
                    SHA-256 Commitment Hash
                  </label>
                  <div
                    className="rounded-lg px-4 py-3 text-xs font-mono break-all"
                    style={{
                      background: "rgba(212,175,55,0.05)",
                      border: "1px solid rgba(212,175,55,0.15)",
                      color: "#d4af37",
                    }}
                  >
                    {demo.hash}
                  </div>
                </div>

                {/* First 5 cards */}
                <div>
                  <label className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-2 block">
                    First 5 Cards Dealt
                  </label>
                  <div className="flex gap-2.5 flex-wrap">
                    {demo.deck.slice(0, 5).map((card, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, rotateY: 90 }}
                        animate={{ opacity: 1, rotateY: 0 }}
                        transition={{ delay: i * 0.08, duration: 0.3 }}
                      >
                        <MiniCard card={card} />
                      </motion.div>
                    ))}
                  </div>
                </div>

                {/* Verify button + result */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 pt-2">
                  <button
                    onClick={handleVerify}
                    disabled={demo.verifying}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60"
                    style={{
                      background: "rgba(34,197,94,0.12)",
                      border: "1px solid rgba(34,197,94,0.25)",
                      color: "#4ade80",
                    }}
                  >
                    {demo.verifying ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <CheckCircle className="w-4 h-4" />
                    )}
                    Verify Shuffle
                  </button>

                  <AnimatePresence>
                    {demo.verified === true && (
                      <motion.div
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0 }}
                        className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold"
                        style={{
                          background: "rgba(34,197,94,0.1)",
                          border: "1px solid rgba(34,197,94,0.3)",
                          color: "#22c55e",
                          boxShadow: "0 0 20px rgba(34,197,94,0.15)",
                        }}
                      >
                        <CheckCircle className="w-4 h-4" />
                        Verified
                      </motion.div>
                    )}
                    {demo.verified === false && (
                      <motion.div
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0 }}
                        className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold"
                        style={{
                          background: "rgba(239,68,68,0.1)",
                          border: "1px solid rgba(239,68,68,0.3)",
                          color: "#ef4444",
                        }}
                      >
                        <XCircle className="w-4 h-4" />
                        Mismatch
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </GlassCard>
      </section>

      {/* ============================================================ */}
      {/*  TRUST COMPARISON TABLE                                      */}
      {/* ============================================================ */}
      <section className="px-4 pb-24 max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="text-center mb-10"
        >
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-3">Why It Matters</h2>
          <p className="text-gray-500 max-w-xl mx-auto">
            No major poker platform offers provably fair shuffles. We are the first.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <GlassCard className="overflow-hidden !p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                    <th className="px-6 py-4 text-sm font-bold text-gray-400 uppercase tracking-wider">Feature</th>
                    <th className="px-6 py-4 text-sm font-bold text-gray-500 uppercase tracking-wider">Traditional Poker Sites</th>
                    <th className="px-6 py-4 text-sm font-bold uppercase tracking-wider" style={{ color: "#d4af37" }}>Our Platform</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    {
                      feature: "Shuffle Verification",
                      trad: "Trust the server blindly",
                      ours: "Cryptographic proof every hand",
                    },
                    {
                      feature: "Seed Transparency",
                      trad: "Hidden forever",
                      ours: "Published after every hand",
                    },
                    {
                      feature: "Independent Audit",
                      trad: "Not possible for players",
                      ours: "Anyone can verify any hand",
                    },
                    {
                      feature: "Algorithm",
                      trad: "Proprietary, opaque",
                      ours: "Open HMAC Fisher-Yates",
                    },
                    {
                      feature: "Manipulation Risk",
                      trad: "Must trust operator",
                      ours: "Mathematically impossible",
                    },
                  ].map((row, i) => (
                    <tr
                      key={i}
                      style={{
                        borderBottom: i < 4 ? "1px solid rgba(255,255,255,0.04)" : undefined,
                      }}
                    >
                      <td className="px-6 py-4 text-sm font-medium text-white">{row.feature}</td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        <span className="inline-flex items-center gap-1.5">
                          <XCircle className="w-4 h-4 text-red-500/70 shrink-0" />
                          {row.trad}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <span className="inline-flex items-center gap-1.5 text-green-400">
                          <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
                          {row.ours}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </GlassCard>
        </motion.div>
      </section>

      {/* ============================================================ */}
      {/*  CTA                                                         */}
      {/* ============================================================ */}
      <section className="px-4 pb-28 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-lg mx-auto"
        >
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            Ready to Play Fair Poker?
          </h2>
          <p className="text-gray-500 mb-8">
            Join the only platform where every hand is mathematically verified. No hidden decks. No blind trust.
          </p>
          <Link href="/lobby">
            <a
              className="inline-flex items-center gap-2.5 px-8 py-4 rounded-xl font-bold text-base transition-all hover:scale-[1.03] active:scale-[0.98]"
              style={{
                background: "linear-gradient(135deg, #d4af37 0%, #b8962e 100%)",
                color: "#0a0c14",
                boxShadow: "0 4px 30px rgba(212,175,55,0.35)",
              }}
            >
              Enter the Lobby
              <ArrowRight className="w-5 h-5" />
            </a>
          </Link>
        </motion.div>
      </section>

      {/* Footer note */}
      <div className="px-4 pb-8 text-center">
        <p className="text-xs text-gray-700 font-mono">
          HMAC-SHA256 Fisher-Yates | SHA-256 Commitment | Open Source Verification
        </p>
      </div>
    </div>
  );
}

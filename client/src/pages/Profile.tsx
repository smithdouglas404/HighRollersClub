import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation, Link } from "wouter";
import { DashboardLayout } from "@/components/DashboardLayout";
import { PageBackground } from "@/components/shared/PageBackground";
import { useAuth } from "@/lib/auth-context";
import { MemberAvatar } from "@/components/shared/MemberAvatar";
import { TAUNT_VOICE_OPTIONS, setTauntVoice } from "@/components/poker/TauntSystem";
import {
  User, Coins, Trophy, TrendingUp, Gamepad2,
  Zap, BookOpen, Wallet, Users, Loader2, Mic, Volume2, Check,
  Star, Shield, Crown, Clock, ChevronRight, Award, Flame, Target,
  StickyNote, Trash2, ShoppingBag, Swords,
  Link as LinkIcon, ExternalLink, Copy, Lock, ShieldCheck, Key, Fingerprint, Hash,
} from "lucide-react";
import goldChips from "@assets/generated_images/gold_chip_stack_3d.webp";

interface PlayerStats {
  handsPlayed: number;
  potsWon: number;
  bestWinStreak: number;
  currentWinStreak: number;
  totalWinnings: number;
  vpip: number;
  pfr: number;
  showdownCount: number;
  sngWins: number;
}

function AnimatedNumber({ value, duration = 800 }: { value: number; duration?: number }) {
  const [display, setDisplay] = useState(0);
  const prevRef = useRef(0);

  useEffect(() => {
    const from = prevRef.current;
    const to = value;
    prevRef.current = value;
    if (from === to) { setDisplay(to); return; }
    const startTime = performance.now();
    const diff = to - from;
    const tick = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(from + diff * eased));
      if (progress < 1) requestAnimationFrame(tick);
      else setDisplay(to);
    };
    requestAnimationFrame(tick);
  }, [value, duration]);

  return <>{display.toLocaleString()}</>;
}

function getRankTier(handsPlayed: number): { label: string; color: string; bgClass: string; borderColor: string; icon: typeof Crown; glowStyle?: { boxShadow: string } } {
  if (handsPlayed >= 1000) return { label: "Diamond", color: "text-primary", bgClass: "from-amber-500/20 to-blue-500/20", borderColor: "border-[#c9a84c]/50", icon: Crown, glowStyle: { boxShadow: "0 0 12px rgba(201,168,76,0.35), 0 0 24px rgba(201,168,76,0.15)" } };
  if (handsPlayed >= 500) return { label: "Platinum", color: "text-gray-200", bgClass: "from-gray-300/20 to-gray-500/20", borderColor: "border-[#c9a84c]/40", icon: Crown, glowStyle: { boxShadow: "0 0 10px rgba(201,168,76,0.25), 0 0 20px rgba(201,168,76,0.10)" } };
  if (handsPlayed >= 200) return { label: "Gold", color: "text-amber-400", bgClass: "from-amber-500/20 to-yellow-500/20", borderColor: "border-amber-400/40", icon: Star };
  if (handsPlayed >= 50) return { label: "Silver", color: "text-gray-400", bgClass: "from-gray-400/20 to-gray-500/20", borderColor: "border-gray-400/30", icon: Shield };
  return { label: "Bronze", color: "text-orange-400", bgClass: "from-orange-500/20 to-amber-600/20", borderColor: "border-orange-400/30", icon: Shield };
}

function getPlayerTitle(handsPlayed: number, winRate: number): string {
  if (handsPlayed >= 5000 && winRate >= 60) return "Grandmaster";
  if (handsPlayed >= 2000 && winRate >= 50) return "Shark";
  if (handsPlayed >= 1000) return "Veteran";
  if (handsPlayed >= 500) return "Enforcer";
  if (handsPlayed >= 200) return "Grinder";
  if (handsPlayed >= 100) return "Regular";
  if (handsPlayed >= 50) return "Contender";
  if (handsPlayed >= 10) return "Rookie";
  return "Newcomer";
}

function getPlayerLevel(handsPlayed: number): number {
  if (handsPlayed >= 5000) return 50;
  if (handsPlayed >= 2000) return 40;
  if (handsPlayed >= 1000) return 30;
  if (handsPlayed >= 500) return 20;
  if (handsPlayed >= 200) return 15;
  if (handsPlayed >= 100) return 10;
  if (handsPlayed >= 50) return 5;
  if (handsPlayed >= 10) return 2;
  return 1;
}

const STAT_CARDS = [
  { key: "handsPlayed", label: "Hands Played", icon: Gamepad2, gradient: "from-primary/15 to-blue-600/15", borderColor: "border-primary/20", textColor: "text-primary", glowColor: "rgba(212,175,55,0.12)" },
  { key: "potsWon", label: "Pots Won", icon: Trophy, gradient: "from-green-500/15 to-emerald-600/15", borderColor: "border-green-500/20", textColor: "text-green-400", glowColor: "rgba(34,197,94,0.12)" },
  { key: "winRate", label: "Win Rate", icon: TrendingUp, gradient: "from-amber-500/15 to-yellow-600/15", borderColor: "border-amber-500/20", textColor: "text-amber-400", glowColor: "rgba(245,158,11,0.12)", suffix: "%" },
  { key: "bestWinStreak", label: "Best Streak", icon: Zap, gradient: "from-purple-500/15 to-violet-600/15", borderColor: "border-purple-500/20", textColor: "text-purple-400", glowColor: "rgba(168,85,247,0.12)" },
];

const BADGES = [
  { name: "First Win", img: "/badges/badge_first_win.webp", glow: "#ffd700", criteria: "Win your first pot", check: (s: PlayerStats) => s.potsWon >= 1, progress: (s: PlayerStats) => ({ current: Math.min(s.potsWon, 1), max: 1 }) },
  { name: "Royal Flush", img: "/badges/badge_royal_flush.webp", glow: "#dc2626", criteria: "Play 500 hands to unlock", check: (s: PlayerStats) => s.handsPlayed >= 500, progress: (s: PlayerStats) => ({ current: Math.min(s.handsPlayed, 500), max: 500 }) },
  { name: "High Roller", img: "/badges/badge_high_roller.webp", glow: "#d4af37", criteria: "Win 10,000+ chips total", check: (s: PlayerStats) => s.totalWinnings >= 10000, progress: (s: PlayerStats) => ({ current: Math.min(s.totalWinnings, 10000), max: 10000 }) },
  { name: "Bluff Master", img: "/badges/badge_bluff_master.webp", glow: "#a855f7", criteria: "Win 50 pots without showdown", check: (s: PlayerStats) => (s.potsWon - s.showdownCount) >= 50, progress: (s: PlayerStats) => ({ current: Math.min(Math.max(s.potsWon - s.showdownCount, 0), 50), max: 50 }) },
  { name: "Iron Player", img: "/badges/badge_iron_player.webp", glow: "#6b7280", criteria: "Play 100 hands", check: (s: PlayerStats) => s.handsPlayed >= 100, progress: (s: PlayerStats) => ({ current: Math.min(s.handsPlayed, 100), max: 100 }) },
  { name: "On Fire", img: "/badges/badge_streak_fire.webp", glow: "#f59e0b", criteria: "Win 5 pots in a row", check: (s: PlayerStats) => s.bestWinStreak >= 5, progress: (s: PlayerStats) => ({ current: Math.min(s.bestWinStreak, 5), max: 5 }) },
  { name: "Champion", img: "/badges/badge_tournament_champ.webp", glow: "#ffd700", criteria: "Win a tournament", check: (s: PlayerStats) => s.sngWins >= 1, progress: (s: PlayerStats) => ({ current: Math.min(s.sngWins, 1), max: 1 }) },
  { name: "Legend", img: "/badges/badge_club_legend.webp", glow: "#a855f7", criteria: "Play 1,000 hands", check: (s: PlayerStats) => s.handsPlayed >= 1000, progress: (s: PlayerStats) => ({ current: Math.min(s.handsPlayed, 1000), max: 1000 }) },
];

// ─── My Blockchain Records ──────────────────────────────────────────────────
function MyBlockchainRecords({ user }: { user: any }) {
  const [hands, setHands] = useState<any[]>([]);
  const [encVerify, setEncVerify] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch recent hands with on-chain proof
      const handsRes = await fetch("/api/explorer/hands?onChainOnly=true&limit=5");
      if (handsRes.ok) { const data = await handsRes.json(); setHands(data.results || []); }
      // Verify current session encryption
      const encRes = await fetch("/api/encryption/verify");
      if (encRes.ok) setEncVerify(await encRes.json());
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { if (expanded && hands.length === 0) fetchData(); }, [expanded]);

  const kycHash = user?.kycBlockchainTxHash;
  const memberId = user?.memberId;
  const kycVerified = user?.kycStatus === "verified";

  const getExplorerUrl = (hash: string) => hash?.startsWith("0x") ? `https://amoy.polygonscan.com/tx/${hash}` : null;

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.22 }}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full rounded-xl p-4 text-left transition-all hover:bg-white/[0.02]"
        style={{ background: "rgba(15,15,20,0.7)", border: "1px solid rgba(168,85,247,0.15)" }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
              <LinkIcon className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">My Blockchain Records</h3>
              <p className="text-[10px] text-gray-500">KYC hash, hand proofs, encryption verification</p>
            </div>
          </div>
          <ChevronRight className={`w-4 h-4 text-gray-500 transition-transform ${expanded ? "rotate-90" : ""}`} />
        </div>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="rounded-b-xl px-4 pb-4 space-y-4" style={{ background: "rgba(15,15,20,0.5)", borderLeft: "1px solid rgba(168,85,247,0.1)", borderRight: "1px solid rgba(168,85,247,0.1)", borderBottom: "1px solid rgba(168,85,247,0.1)" }}>

              {/* KYC Identity Section */}
              <div className="rounded-lg bg-black/20 border border-white/5 p-3 space-y-2">
                <h4 className="text-[10px] font-bold text-purple-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Fingerprint className="w-3.5 h-3.5" /> Identity Verification
                </h4>
                <div className="space-y-1.5">
                  {memberId && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-400">Member ID</span>
                      <span className="font-mono text-xs text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded">{memberId}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-400">KYC Status</span>
                    {kycVerified ? (
                      <span className="flex items-center gap-1 text-xs text-green-400"><ShieldCheck className="w-3 h-3" /> Verified</span>
                    ) : (
                      <span className="text-xs text-gray-500">{user?.kycStatus || "Not submitted"}</span>
                    )}
                  </div>
                  {kycHash && (
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-400">On-Chain Hash</span>
                        <span className="flex items-center gap-1 text-[10px] text-green-400"><Lock className="w-3 h-3" /> Anchored</span>
                      </div>
                      <div className="flex items-center gap-1 mt-1">
                        <span className="font-mono text-[11px] text-purple-400 truncate">{kycHash}</span>
                        <button onClick={() => navigator.clipboard.writeText(kycHash)} className="p-0.5 hover:bg-white/5 rounded shrink-0">
                          <Copy className="w-3 h-3 text-gray-600" />
                        </button>
                        {getExplorerUrl(kycHash) && (
                          <a href={getExplorerUrl(kycHash)!} target="_blank" rel="noopener noreferrer" className="shrink-0 text-purple-400 hover:text-purple-300">
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                    </div>
                  )}
                  {!kycHash && kycVerified && (
                    <Link href="/kyc">
                      <button className="w-full mt-1 py-1.5 rounded text-[10px] font-bold bg-purple-500/10 text-purple-400 border border-purple-500/20 hover:bg-purple-500/20">
                        Record Identity On-Chain
                      </button>
                    </Link>
                  )}
                </div>
              </div>

              {/* Session Encryption Verification */}
              <div className="rounded-lg bg-black/20 border border-white/5 p-3 space-y-2">
                <h4 className="text-[10px] font-bold text-purple-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5" /> Session Encryption
                </h4>
                {loading ? (
                  <div className="flex justify-center py-3"><Loader2 className="w-4 h-4 animate-spin text-purple-400" /></div>
                ) : encVerify?.verified ? (
                  <div className="space-y-1.5 text-xs">
                    <div className="flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-green-400" />
                      <span className="text-green-400 font-bold">Active Encrypted Session</span>
                    </div>
                    <div className="text-gray-500">Commitment: <span className="font-mono text-[10px] text-gray-300">{encVerify.commitment?.commitmentHash?.slice(0, 24)}...</span></div>
                    {encVerify.anchored ? (
                      <div className="p-2 rounded bg-green-500/5 border border-green-500/10">
                        <div className="flex items-center gap-1 text-green-400 text-[10px] font-bold">
                          <Lock className="w-3 h-3" /> Anchored to Polygon
                        </div>
                        <div className="text-[10px] text-gray-500 mt-0.5">Merkle Root: {encVerify.batch?.merkleRoot?.slice(0, 20)}...</div>
                        {encVerify.batch?.txHash && (
                          <a href={`https://amoy.polygonscan.com/tx/${encVerify.batch.txHash}`} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-1 text-[10px] text-purple-400 hover:text-purple-300 mt-1">
                            <ExternalLink className="w-3 h-3" /> View on Polygonscan
                          </a>
                        )}
                      </div>
                    ) : (
                      <div className="text-[10px] text-amber-400">Pending anchor (next batch in ~10 min)</div>
                    )}
                  </div>
                ) : (
                  <p className="text-[10px] text-gray-600">No active game session. Join a table to see encryption status.</p>
                )}
              </div>

              {/* Recent Verified Hands */}
              <div className="rounded-lg bg-black/20 border border-white/5 p-3 space-y-2">
                <h4 className="text-[10px] font-bold text-purple-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Hash className="w-3.5 h-3.5" /> Recent On-Chain Hands
                </h4>
                {loading ? (
                  <div className="flex justify-center py-3"><Loader2 className="w-4 h-4 animate-spin text-purple-400" /></div>
                ) : hands.length > 0 ? (
                  <div className="space-y-1.5">
                    {hands.map((h: any) => (
                      <div key={h.id} className="flex items-center justify-between px-2 py-1.5 rounded bg-white/[0.02]">
                        <div>
                          <span className="text-xs font-bold text-white">Hand #{h.hand_number}</span>
                          <span className="text-[10px] text-gray-600 ml-2">{h.table_name || ""}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {h.vrf_request_id && <span className="text-[9px] px-1 py-0.5 rounded bg-cyan-500/10 text-cyan-400">VRF</span>}
                          {h.on_chain_commit_tx && (
                            <a href={`https://amoy.polygonscan.com/tx/${h.on_chain_commit_tx}`} target="_blank" rel="noopener noreferrer"
                              className="text-[10px] text-purple-400 hover:text-purple-300 flex items-center gap-0.5">
                              <ExternalLink className="w-3 h-3" /> Proof
                            </a>
                          )}
                          <span className="text-[10px] text-amber-400 font-bold">{(h.pot_total || 0).toLocaleString()}</span>
                        </div>
                      </div>
                    ))}
                    <Link href="/explorer">
                      <button className="w-full py-1.5 rounded text-[10px] font-bold text-gray-400 hover:text-gray-300 hover:bg-white/5 transition-colors">
                        View All in Explorer &rarr;
                      </button>
                    </Link>
                  </div>
                ) : (
                  <p className="text-[10px] text-gray-600">No on-chain hand records yet. Play at a table with blockchain verification enabled.</p>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Account Activity Log ────────────────────────────────────────────────────
function AccountActivityLog() {
  const [actions, setActions] = useState<any[]>([]);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!expanded) return;
    fetch("/api/account/actions?limit=10").then(r => r.ok ? r.json() : []).then(setActions).catch(() => {});
  }, [expanded]);

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.24 }}>
      <button onClick={() => setExpanded(!expanded)}
        className="w-full rounded-xl p-4 text-left transition-all hover:bg-white/[0.02]"
        style={{ background: "rgba(15,15,20,0.7)", border: "1px solid rgba(255,255,255,0.08)" }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
              <Shield className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Account Activity</h3>
              <p className="text-[10px] text-gray-500">System actions, warnings, and security events</p>
            </div>
          </div>
          <ChevronRight className={`w-4 h-4 text-gray-500 transition-transform ${expanded ? "rotate-90" : ""}`} />
        </div>
      </button>
      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="px-4 pb-4 space-y-1.5" style={{ background: "rgba(15,15,20,0.5)", borderLeft: "1px solid rgba(255,255,255,0.05)", borderRight: "1px solid rgba(255,255,255,0.05)", borderBottom: "1px solid rgba(255,255,255,0.05)", borderRadius: "0 0 12px 12px" }}>
              {actions.length === 0 ? (
                <p className="text-gray-600 text-[10px] text-center py-4">No account actions recorded</p>
              ) : actions.map((a: any) => (
                <div key={a.id} className="flex items-center justify-between px-2 py-1.5 rounded text-xs" style={{ background: "rgba(255,255,255,0.02)" }}>
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${a.severity === "critical" ? "bg-red-400" : a.severity === "warning" ? "bg-amber-400" : "bg-gray-400"}`} />
                    <span className="text-gray-300">{a.message}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {a.automated && <span className="text-[9px] px-1 py-0.5 rounded bg-purple-500/10 text-purple-400">BOT</span>}
                    <span className="text-[10px] text-gray-600">{a.createdAt ? new Date(a.createdAt).toLocaleDateString() : ""}</span>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function Profile() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [stats, setStats] = useState<PlayerStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [hoveredBadge, setHoveredBadge] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/stats/me")
      .then(r => {
        if (r.status === 401) throw new Error("Session expired — please log in again");
        if (!r.ok) throw new Error("Failed to load stats");
        return r.json();
      })
      .then(data => setStats(data))
      .catch((err) => setStatsError(err.message || "Failed to load stats"))
      .finally(() => setLoading(false));
  }, []);

  const winRate = stats && stats.handsPlayed > 0
    ? Math.round((stats.potsWon / stats.handsPlayed) * 100)
    : 0;

  const rank = getRankTier(stats?.handsPlayed ?? 0);
  const RankIcon = rank.icon;
  const playerLevel = getPlayerLevel(stats?.handsPlayed ?? 0);
  const playerTitle = getPlayerTitle(stats?.handsPlayed ?? 0, winRate);

  return (
    <DashboardLayout title="Profile">
      <PageBackground image="/images/generated/profile-bg.png" />
      <div className="relative z-10 pb-8 max-w-5xl mx-auto">
        {/* ── Hero Banner ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-2xl mx-4 md:mx-8 mb-6"
          style={{ minHeight: 200 }}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-background via-surface-high to-background" />
          <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.08] via-transparent to-purple-500/8" />
          <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-purple-500/30 to-transparent" />

          <img
            src={goldChips}
            alt="Gold chips"
            loading="lazy"
            className="absolute -top-6 -right-10 w-52 h-52 object-contain opacity-10 pointer-events-none rotate-12"
          />
          <div className="absolute -top-32 -right-32 w-80 h-80 bg-primary/5 rounded-full blur-[80px] pointer-events-none" />
          <div className="absolute -bottom-20 -left-20 w-60 h-60 bg-purple-500/5 rounded-full blur-[60px] pointer-events-none" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[200px] bg-primary/3 rounded-full blur-[100px] pointer-events-none" />

          <div className="relative z-10 flex flex-col md:flex-row items-center gap-6 p-8 md:p-10">
            <div className="relative">
              <div className="relative ring-2 ring-[#c9a84c]/30 rounded-full shadow-[0_0_16px_rgba(201,168,76,0.15)]" data-testid="img-avatar">
                <MemberAvatar
                  avatarId={user?.avatarId ?? null}
                  displayName={user?.displayName || user?.username || "Player"}
                  size="xl"
                />
                <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-green-400 border-2 border-background shadow-[0_0_8px_rgba(74,222,128,0.6)]" />
              </div>
            </div>

            <div className="flex-1 text-center md:text-left">
              <div className="flex items-center gap-3 justify-center md:justify-start">
                <h2 className="text-2xl md:text-3xl font-display font-black tracking-tight" data-testid="text-username" style={{ background: "linear-gradient(180deg, #f5e6a3 0%, #d4af37 60%, #c9a84c 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
                  {user?.displayName || user?.username || "Player"}
                </h2>
                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[0.625rem] font-bold uppercase tracking-wider bg-gradient-to-r ${rank.bgClass} ${rank.borderColor} border ${rank.color}`}
                  style={rank.glowStyle}
                >
                  <RankIcon className="w-3 h-3" />
                  {rank.label}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[0.625rem] font-bold uppercase tracking-widest text-amber-400/80 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/15">
                  Level {playerLevel} {playerTitle}
                </span>
              </div>
              <p className="text-sm text-gray-500 mt-1">@{user?.username}</p>
              {(user as any)?.memberId && (
                <p className="text-xs text-gray-500 mt-0.5 font-mono">Member ID: {(user as any).memberId}</p>
              )}
              {(user as any)?.tier && (user as any).tier !== "free" && (
                <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full text-[0.5625rem] font-bold uppercase tracking-wider bg-primary/10 text-primary border border-primary/20">
                  {(user as any).tier} tier
                </span>
              )}
              {(user as any)?.kycStatus === "verified" && (
                <span className="inline-flex items-center gap-1 mt-1 ml-1 px-2 py-0.5 rounded-full text-[0.5625rem] font-bold uppercase tracking-wider bg-green-500/10 text-green-400 border border-green-500/20">
                  KYC Verified
                </span>
              )}
              {(user as any)?.kycBlockchainTxHash && (
                <p className="text-[0.5625rem] text-purple-400 mt-1 font-mono truncate max-w-xs" title={(user as any).kycBlockchainTxHash}>
                  On-chain: {(user as any).kycBlockchainTxHash.substring(0, 10)}...{(user as any).kycBlockchainTxHash.substring(58)}
                </p>
              )}
              <div className="flex items-center gap-4 mt-3 justify-center md:justify-start">
                <span className="flex items-center gap-1.5 text-sm font-bold text-primary" data-testid="text-chip-balance">
                  <Coins className="w-4 h-4" />
                  {(user?.chipBalance ?? 0).toLocaleString()} chips
                </span>
                <span className={`px-2.5 py-0.5 rounded-full text-[0.625rem] font-bold uppercase tracking-wider ${
                  user?.role === "admin"
                    ? "bg-purple-500/15 text-purple-400 border border-purple-500/20"
                    : "bg-primary/15 text-primary border border-primary/20"
                }`} data-testid="text-role">
                  {user?.role || "member"}
                </span>
              {/* Action buttons */}
              <div className="flex items-center gap-2 mt-4 justify-center md:justify-start">
                <Link href="/avatar-wardrobe">
                  <button className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[0.625rem] font-bold uppercase tracking-wider bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 transition-all">
                    <User className="w-3 h-3" /> Change Avatar
                  </button>
                </Link>
                <Link href="/shop">
                  <button className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[0.625rem] font-bold uppercase tracking-wider bg-purple-500/10 text-purple-400 border border-purple-500/20 hover:bg-purple-500/20 transition-all">
                    <ShoppingBag className="w-3 h-3" /> Shop
                  </button>
                </Link>
              </div>
              </div>
            </div>
          </div>
        </motion.div>

        <div className="px-4 md:px-8">
          {/* ── Stats Grid ── */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mb-6"
          >
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-4 flex items-center gap-2" style={{ textShadow: "0 0 8px rgba(212,175,55,0.4)" }}>
              <TrendingUp className="w-4 h-4 text-primary/70" />
              Your Statistics
            </h3>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : statsError ? (
              <div className="flex items-center justify-center py-12">
                <p className="text-sm text-red-400" data-testid="text-stats-error">{statsError}</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {STAT_CARDS.map((card, i) => {
                    const Icon = card.icon;
                    const val = card.key === "winRate" ? winRate : (stats as any)?.[card.key] ?? 0;
                    return (
                      <motion.div
                        key={card.key}
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.15 + i * 0.05 }}
                        className={`relative text-center p-5 rounded-xl border overflow-hidden group hover:scale-[1.02] transition-transform`}
                        style={{ background: "rgba(15,15,20,0.7)", backdropFilter: "blur(12px)", border: "1px solid rgba(212,175,55,0.12)" }}
                        data-testid={`stat-card-${card.key}`}
                      >
                        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none" />
                        <Icon className={`w-7 h-7 ${card.textColor} mx-auto mb-3 opacity-80`} />
                        <div className="text-3xl font-black tabular-nums" style={{ color: "#d4af37" }}>
                          <AnimatedNumber value={val} />
                          {card.suffix || ""}
                        </div>
                        <div className="text-[0.625rem] text-gray-500 uppercase tracking-wider mt-1.5 font-semibold">{card.label}</div>
                      </motion.div>
                    );
                  })}
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
                  {[
                    { label: "Current Streak", value: stats!.currentWinStreak.toString(), color: "text-[#d4af37]", icon: Flame },
                    { label: "Total Winnings", value: stats!.totalWinnings.toLocaleString(), color: "text-[#d4af37]", icon: Coins },
                    { label: "VPIP", value: `${stats!.handsPlayed > 0 ? Math.round((stats!.vpip / stats!.handsPlayed) * 100) : 0}%`, color: "text-[#d4af37]", icon: Target },
                    { label: "PFR", value: `${stats!.handsPlayed > 0 ? Math.round((stats!.pfr / stats!.handsPlayed) * 100) : 0}%`, color: "text-[#d4af37]", icon: TrendingUp },
                  ].map((item) => {
                    const SubIcon = item.icon;
                    return (
                      <div key={item.label} className="flex items-center gap-3 p-3.5 rounded-lg hover:border-white/10 transition-colors" style={{ background: "rgba(15,15,20,0.7)", backdropFilter: "blur(12px)", border: "1px solid rgba(212,175,55,0.12)" }}>
                        <SubIcon className="w-4 h-4 text-gray-600 shrink-0" />
                        <div className="flex-1">
                          <span className="text-[0.625rem] text-gray-500 block">{item.label}</span>
                          <span className={`text-sm font-bold ${item.color}`}>{item.value}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </motion.div>

          {/* ── Performance Dashboard ── */}
          {stats && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }}>
              <div className="rounded-xl p-4 space-y-3" style={{ background: "rgba(15,15,20,0.7)", border: "1px solid rgba(212,175,55,0.12)" }}>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-primary" /> Performance Dashboard
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="rounded-lg p-3 text-center" style={{ background: "rgba(255,255,255,0.03)" }}>
                    <div className="text-lg font-black text-green-400">{(stats.totalWinnings || 0).toLocaleString()}</div>
                    <div className="text-[10px] text-gray-500 uppercase">Total Winnings</div>
                  </div>
                  <div className="rounded-lg p-3 text-center" style={{ background: "rgba(255,255,255,0.03)" }}>
                    <div className="text-lg font-black text-cyan-400">{stats.handsPlayed || 0}</div>
                    <div className="text-[10px] text-gray-500 uppercase">Hands Played</div>
                  </div>
                  <div className="rounded-lg p-3 text-center" style={{ background: "rgba(255,255,255,0.03)" }}>
                    <div className="text-lg font-black text-amber-400">{stats.bestWinStreak || 0}</div>
                    <div className="text-[10px] text-gray-500 uppercase">Best Win Streak</div>
                  </div>
                  <div className="rounded-lg p-3 text-center" style={{ background: "rgba(255,255,255,0.03)" }}>
                    <div className="text-lg font-black text-purple-400">{stats.sngWins || 0}</div>
                    <div className="text-[10px] text-gray-500 uppercase">Tournament Wins</div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg p-3" style={{ background: "rgba(255,255,255,0.03)" }}>
                    <div className="flex justify-between mb-1.5"><span className="text-[10px] text-gray-500 uppercase">VPIP</span><span className="text-xs font-bold text-primary">{stats.vpip || 0}%</span></div>
                    <div className="w-full h-2 rounded-full bg-white/5"><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${Math.min(stats.vpip || 0, 100)}%` }} /></div>
                    <p className="text-[9px] text-gray-600 mt-1">Voluntarily put $ in pot</p>
                  </div>
                  <div className="rounded-lg p-3" style={{ background: "rgba(255,255,255,0.03)" }}>
                    <div className="flex justify-between mb-1.5"><span className="text-[10px] text-gray-500 uppercase">PFR</span><span className="text-xs font-bold text-purple-400">{stats.pfr || 0}%</span></div>
                    <div className="w-full h-2 rounded-full bg-white/5"><div className="h-full rounded-full bg-purple-400 transition-all" style={{ width: `${Math.min(stats.pfr || 0, 100)}%` }} /></div>
                    <p className="text-[9px] text-gray-600 mt-1">Pre-flop raise frequency</p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* ── Achievement Badges ── */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="rounded-xl p-6 mb-6"
            style={{ background: "rgba(15,15,20,0.7)", backdropFilter: "blur(12px)", border: "1px solid rgba(212,175,55,0.12)" }}
          >
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-5 flex items-center gap-2" style={{ textShadow: "0 0 8px rgba(212,175,55,0.4)" }}>
              <Award className="w-4 h-4 text-amber-500/70" />
              Achievements
              {stats && (
                <span className="ml-auto text-[0.625rem] text-gray-600 font-normal normal-case tracking-normal">
                  {BADGES.filter(b => b.check(stats)).length}/{BADGES.length} unlocked
                </span>
              )}
            </h3>
            <div className="grid grid-cols-4 md:grid-cols-8 gap-4">
              {BADGES.map((badge) => {
                const unlocked = stats ? badge.check(stats) : false;
                const prog = stats ? badge.progress(stats) : { current: 0, max: 1 };
                const progressPct = Math.min((prog.current / prog.max) * 100, 100);
                const isHovered = hoveredBadge === badge.name;

                return (
                  <div
                    key={badge.name}
                    className="flex flex-col items-center gap-2 group relative"
                    onMouseEnter={() => setHoveredBadge(badge.name)}
                    onMouseLeave={() => setHoveredBadge(null)}
                    data-testid={`badge-${badge.name.toLowerCase().replace(/\s/g, '-')}`}
                  >
                    <div
                      className={`relative w-16 h-16 rounded-xl overflow-hidden border-2 transition-all duration-300 ${
                        unlocked
                          ? "border-[#d4af37]/40 opacity-100 hover:scale-110"
                          : "border-white/5 opacity-40 grayscale hover:opacity-60"
                      }`}
                      style={unlocked ? {
                        boxShadow: `0 0 16px ${badge.glow}40, 0 0 32px ${badge.glow}15`,
                        animation: "shimmer 3s ease-in-out infinite",
                      } : {}}
                    >
                      <img src={badge.img} alt={badge.name} className="w-full h-full object-cover" loading="lazy" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                      <div className="absolute inset-0 flex items-center justify-center" style={{ display: 'none' }} ref={(el) => { if (el) { const img = el.previousElementSibling as HTMLImageElement; if (img) img.addEventListener('error', () => { el.style.display = 'flex'; }); } }}>
                        <Trophy className="w-6 h-6 text-gray-500" />
                      </div>
                      {unlocked && (
                        <div className="absolute inset-0 bg-gradient-to-t from-transparent via-transparent to-white/10 pointer-events-none" />
                      )}
                    </div>

                    {!unlocked && (
                      <div className="w-12 h-1 rounded-full bg-white/10 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-primary/60 to-primary/60 transition-all"
                          style={{ width: `${progressPct}%` }}
                        />
                      </div>
                    )}

                    <span className={`text-[0.5625rem] font-bold text-center leading-tight ${
                      unlocked ? "text-gray-300" : "text-gray-600"
                    }`}>
                      {badge.name}
                    </span>

                    <AnimatePresence>
                      {isHovered && (
                        <motion.div
                          initial={{ opacity: 0, y: 4, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 4, scale: 0.95 }}
                          transition={{ duration: 0.15 }}
                          className="absolute -top-16 left-1/2 -translate-x-1/2 z-50 px-3 py-2 rounded-lg bg-surface-low border border-white/10 shadow-xl whitespace-nowrap"
                        >
                          <div className="text-[0.625rem] font-bold text-white">{badge.criteria}</div>
                          {!unlocked && (
                            <div className="text-[0.5rem] text-gray-500 mt-0.5">
                              {prog.current.toLocaleString()}/{prog.max.toLocaleString()}
                            </div>
                          )}
                          <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 rotate-45 bg-surface-low border-r border-b border-white/10" />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          </motion.div>

          {/* ── Head-to-Head Records ── */}
          <HeadToHeadSection />

          {/* ── View Analytics Link ── */}
          <Link href="/analytics">
            <div className="glass rounded-xl p-4 border border-white/5 hover:border-primary/20 transition-all cursor-pointer flex items-center gap-3 mb-6">
              <TrendingUp className="w-5 h-5 text-primary" />
              <div>
                <div className="text-xs font-bold text-white">View Analytics</div>
                <div className="text-[0.5625rem] text-gray-500">Hand history, performance charts, session results</div>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-600 ml-auto" />
            </div>
          </Link>

          {/* ── Recent Sessions ── */}
          <RecentSessionsSection />

          {/* ── Taunt Voice ── */}
          <TauntVoicePicker currentVoice={user?.tauntVoice || "default"} />

          {/* ── Player Notes ── */}
          <PlayerNotesSection />

          {/* ── My Blockchain Records ── */}
          <MyBlockchainRecords user={user} />

          {/* ── Account Activity Log ── */}
          <AccountActivityLog />

          {/* ── Quick Links ── */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="grid grid-cols-2 md:grid-cols-4 gap-4"
          >
            {[
              { label: "Security", icon: Shield, color: "amber", path: "/security", gradient: "from-primary/10 to-purple-500/10", border: "hover:border-primary/30", iconBg: "bg-primary/10" },
              { label: "Wallet", icon: Wallet, color: "amber", path: "/wallet", gradient: "from-primary/10 to-blue-600/10", border: "hover:border-primary/30", iconBg: "bg-primary/10" },
              { label: "Transactions", icon: Coins, color: "green", path: "/wallet?tab=history", gradient: "from-green-500/10 to-emerald-600/10", border: "hover:border-green-500/30", iconBg: "bg-green-500/10" },
              { label: "Analytics", icon: BookOpen, color: "amber", path: "/analytics", gradient: "from-amber-500/10 to-yellow-600/10", border: "hover:border-amber-500/30", iconBg: "bg-amber-500/10" },
              { label: "My Club", icon: Users, color: "green", path: "/club", gradient: "from-green-500/10 to-emerald-600/10", border: "hover:border-green-500/30", iconBg: "bg-green-500/10" },
              { label: "Leaderboard", icon: Trophy, color: "purple", path: "/leaderboard", gradient: "from-purple-500/10 to-violet-600/10", border: "hover:border-purple-500/30", iconBg: "bg-purple-500/10" },
              { label: "Wardrobe", icon: User, color: "amber", path: "/wardrobe", gradient: "from-amber-500/10 to-blue-500/10", border: "hover:border-amber-500/30", iconBg: "bg-amber-500/10" },
              { label: "Premium", icon: Crown, color: "amber", path: "/premium", gradient: "from-amber-500/10 to-yellow-500/10", border: "hover:border-amber-500/30", iconBg: "bg-amber-500/10" },
            ].map((link) => {
              const LinkIcon = link.icon;
              return (
                <motion.button
                  key={link.label}
                  whileHover={{ scale: 1.03, y: -2 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => navigate(link.path)}
                  className={`relative rounded-xl p-5 ${link.border} transition-all text-left group overflow-hidden`}
                  style={{ background: "rgba(15,15,20,0.7)", backdropFilter: "blur(12px)", border: "1px solid rgba(212,175,55,0.12)" }}
                  data-testid={`link-${link.label.toLowerCase().replace(/\s/g, '-')}`}
                >
                  <div className={`absolute inset-0 bg-gradient-to-br ${link.gradient} opacity-0 group-hover:opacity-100 transition-opacity`} />
                  <div className="relative z-10">
                    <div className={`w-10 h-10 rounded-lg ${link.iconBg} flex items-center justify-center mb-3`}>
                      <LinkIcon className={`w-5 h-5 text-${link.color}-400`} />
                    </div>
                    <span className="text-sm font-bold text-gray-300 group-hover:text-white transition-colors block">
                      {link.label}
                    </span>
                    <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-gray-400 absolute top-5 right-4 transition-colors" />
                  </div>
                </motion.button>
              );
            })}
          </motion.div>
        </div>
      </div>
    </DashboardLayout>
  );
}

interface H2HRecord {
  opponentId: string;
  opponentName: string;
  handsPlayedTogether: number;
  userWins: number;
  opponentWins: number;
  splitPots: number;
  userNetChips: number;
  lastPlayed: string | null;
}

function HeadToHeadSection() {
  const [records, setRecords] = useState<H2HRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/stats/head-to-head/top", { credentials: "include" })
      .then(r => r.ok ? r.json() : [])
      .then(data => setRecords(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.18 }}
      className="rounded-xl p-6 mb-6"
      style={{ background: "rgba(15,15,20,0.7)", backdropFilter: "blur(12px)", border: "1px solid rgba(212,175,55,0.12)" }}
    >
      <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-4 flex items-center gap-2" style={{ textShadow: "0 0 8px rgba(212,175,55,0.4)" }}>
        <Swords className="w-4 h-4 text-primary/70" />
        Head-to-Head Records
        {records.length > 0 && (
          <span className="ml-auto text-[0.625rem] text-gray-600 font-normal normal-case tracking-normal">
            Top {records.length} opponents
          </span>
        )}
      </h3>
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
        </div>
      ) : records.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <Swords className="w-8 h-8 text-gray-600 mb-2" />
          <p className="text-xs text-gray-500">No head-to-head records yet.</p>
          <p className="text-[0.625rem] text-gray-600 mt-1">Play hands with other players to build rivalry stats.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {records.map((rec) => {
            const totalDecided = rec.userWins + rec.opponentWins;
            const userPct = totalDecided > 0 ? Math.round((rec.userWins / totalDecided) * 100) : 50;
            const oppPct = 100 - userPct;
            return (
              <div
                key={rec.opponentId}
                className="p-4 rounded-lg border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] transition-colors"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-bold text-white">vs {rec.opponentName}</span>
                  <span className={`text-sm font-bold ${rec.userNetChips >= 0 ? "text-green-400" : "text-red-400"}`}>
                    {rec.userNetChips >= 0 ? "+" : ""}{rec.userNetChips.toLocaleString()}
                  </span>
                </div>
                <div>
                  <div className="flex justify-between text-[0.5625rem] font-bold mb-1">
                    <span className="text-green-400">{rec.userWins}W</span>
                    {rec.splitPots > 0 && <span className="text-gray-500">{rec.splitPots} splits</span>}
                    <span className="text-red-400">{rec.opponentWins}W</span>
                  </div>
                  <div className="flex h-2 rounded-full overflow-hidden bg-white/5">
                    <div className="bg-green-500 transition-all" style={{ width: `${userPct}%` }} />
                    <div className="bg-red-500 transition-all" style={{ width: `${oppPct}%` }} />
                  </div>
                </div>
                <div className="flex items-center gap-4 mt-2 text-[0.625rem] text-gray-500">
                  <span>{rec.handsPlayedTogether} hands</span>
                  {rec.lastPlayed && (
                    <span className="ml-auto text-gray-600">
                      Last: {new Date(rec.lastPlayed).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}

function TauntVoicePicker({ currentVoice }: { currentVoice: string }) {
  const { refreshUser } = useAuth();
  const [selected, setSelected] = useState(currentVoice);
  const [saving, setSaving] = useState(false);
  const [previewPlaying, setPreviewPlaying] = useState<string | null>(null);

  const save = useCallback(async (voiceId: string) => {
    setSelected(voiceId);
    setTauntVoice(voiceId);
    setSaving(true);
    try {
      await fetch("/api/profile/avatar", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tauntVoice: voiceId }),
      });
      await refreshUser();
    } catch {}
    setSaving(false);
  }, [refreshUser]);

  const preview = useCallback((voiceId: string) => {
    setPreviewPlaying(voiceId);
    const path = `/sounds/taunts/${voiceId}/ship-it.mp3`;
    const audio = new Audio(path);
    audio.volume = 0.7;
    audio.onended = () => setPreviewPlaying(null);
    audio.onerror = () => {
      const fb = new Audio(`/sounds/taunts/ship-it.mp3`);
      fb.volume = 0.7;
      fb.onended = () => setPreviewPlaying(null);
      fb.play().catch(() => setPreviewPlaying(null));
    };
    audio.play().catch(() => setPreviewPlaying(null));
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="glass rounded-xl p-6 border border-white/5 mb-6"
    >
      <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-4 flex items-center gap-2">
        <Mic className="w-4 h-4 text-purple-500/70" />
        Taunt Voice
      </h3>
      <p className="text-[0.625rem] text-gray-500 mb-4">
        Choose the voice your taunts play in. Default is a confident, energetic voice. Or pick one that matches your avatar.
      </p>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
        {TAUNT_VOICE_OPTIONS.map((voice) => {
          const isSelected = selected === voice.id;
          return (
            <button
              key={voice.id}
              onClick={() => save(voice.id)}
              disabled={saving}
              data-testid={`button-voice-${voice.id}`}
              className={`relative text-left p-3 rounded-lg border transition-all ${
                isSelected
                  ? "bg-purple-500/15 border-purple-500/30 shadow-[0_0_12px_rgba(168,85,247,0.15)]"
                  : "bg-white/[0.03] border-white/5 hover:border-white/15 hover:bg-white/[0.05]"
              }`}
            >
              {isSelected && (
                <div className="absolute top-1.5 right-1.5">
                  <Check className="w-3 h-3 text-purple-400" />
                </div>
              )}
              <div className="text-xs font-bold text-white mb-0.5">{voice.label}</div>
              <div className="text-[0.5rem] text-gray-500 leading-tight mb-2">{voice.description}</div>
              <button
                onClick={(e) => { e.stopPropagation(); preview(voice.id); }}
                className="flex items-center gap-1 text-[0.5625rem] text-primary hover:text-primary/80 transition-colors"
                data-testid={`button-preview-${voice.id}`}
              >
                <Volume2 className="w-2.5 h-2.5" />
                {previewPlaying === voice.id ? "Playing..." : "Preview"}
              </button>
            </button>
          );
        })}
      </div>
    </motion.div>
  );
}

interface PlayerNote {
  id: number;
  targetPlayerId: string;
  targetDisplayName?: string;
  note: string;
  color: string;
  updatedAt: string;
}

const NOTE_COLOR_MAP: Record<string, string> = {
  red: "border-red-500/30 bg-red-500/10",
  yellow: "border-yellow-500/30 bg-yellow-500/10",
  green: "border-green-500/30 bg-green-500/10",
  blue: "border-blue-500/30 bg-blue-500/10",
  purple: "border-purple-500/30 bg-purple-500/10",
  gray: "border-white/10 bg-white/[0.03]",
};

function PlayerNotesSection() {
  const [notes, setNotes] = useState<PlayerNote[]>([]);
  const [loadingNotes, setLoadingNotes] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/player-notes", { credentials: "include" })
      .then(r => r.ok ? r.json() : [])
      .then(data => setNotes(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setLoadingNotes(false));
  }, []);

  const handleDelete = async (targetPlayerId: string) => {
    setDeletingId(targetPlayerId);
    try {
      const res = await fetch(`/api/player-notes/${targetPlayerId}`, { method: "DELETE", credentials: "include" });
      if (res.ok) {
        setNotes(prev => prev.filter(n => n.targetPlayerId !== targetPlayerId));
      }
    } catch {}
    setDeletingId(null);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.22 }}
      className="glass rounded-xl p-6 border border-white/5 mb-6"
    >
      <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-4 flex items-center gap-2">
        <StickyNote className="w-4 h-4 text-amber-500/70" />
        Player Notes
        {notes.length > 0 && (
          <span className="ml-auto text-[0.625rem] text-gray-600 font-normal normal-case tracking-normal">
            {notes.length} note{notes.length !== 1 ? "s" : ""}
          </span>
        )}
      </h3>
      {loadingNotes ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
        </div>
      ) : notes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <StickyNote className="w-8 h-8 text-gray-600 mb-2" />
          <p className="text-xs text-gray-500">No player notes yet.</p>
          <p className="text-[0.625rem] text-gray-600 mt-1">Add notes on players from the game table to track their tendencies.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notes.map((n) => {
            const colorClass = NOTE_COLOR_MAP[n.color] || NOTE_COLOR_MAP.gray;
            return (
              <div
                key={n.targetPlayerId}
                className={`flex items-start gap-3 p-3.5 rounded-lg border transition-colors ${colorClass}`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs font-bold text-white truncate">
                      {n.targetDisplayName || n.targetPlayerId.slice(0, 12)}
                    </span>
                    <span className="text-[0.5rem] text-gray-500">
                      {n.updatedAt ? new Date(n.updatedAt).toLocaleDateString() : ""}
                    </span>
                  </div>
                  <p className="text-[0.6875rem] text-gray-400 leading-relaxed">{n.note}</p>
                </div>
                <button
                  onClick={() => handleDelete(n.targetPlayerId)}
                  disabled={deletingId === n.targetPlayerId}
                  className="shrink-0 p-1.5 rounded-md hover:bg-red-500/15 text-gray-600 hover:text-red-400 transition-colors disabled:opacity-40"
                  title="Delete note"
                >
                  {deletingId === n.targetPlayerId ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}

interface SessionSummary {
  tableId: string;
  tableName: string;
  handsPlayed: number;
  netResult: number;
  lastPlayedAt: string;
}

function formatSessionTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  return date.toLocaleDateString();
}

function RecentSessionsSection() {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [sessionsError, setSessionsError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/wallet/sessions?limit=5", { credentials: "include" })
      .then(r => {
        if (!r.ok) throw new Error("Failed to load sessions");
        return r.json();
      })
      .then(data => setSessions(Array.isArray(data) ? data : []))
      .catch((err) => setSessionsError(err.message || "Failed to load sessions"))
      .finally(() => setLoadingSessions(false));
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.17 }}
      className="rounded-xl p-6 mb-6"
      style={{ background: "rgba(15,15,20,0.7)", backdropFilter: "blur(12px)", border: "1px solid rgba(212,175,55,0.12)" }}
    >
      <h3 className="text-xs font-bold uppercase tracking-wider text-[#c9a84c]/80 mb-4 flex items-center gap-2" style={{ textShadow: "0 0 8px rgba(212,175,55,0.4)" }}>
        <Clock className="w-4 h-4 text-[#c9a84c]/70" />
        Recent Sessions
      </h3>
      {loadingSessions ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
        </div>
      ) : sessionsError ? (
        <div className="text-center py-6 text-[0.6875rem] text-red-400">{sessionsError}</div>
      ) : sessions.length === 0 ? (
        <div className="text-center py-6 text-[0.6875rem] text-gray-600">No sessions yet. Play some hands to see your results here.</div>
      ) : (
        <div className="space-y-2">
          {sessions.map((session, i) => {
            const positive = session.netResult >= 0;
            return (
              <div key={session.tableId + "-" + i} className="flex items-center gap-4 p-3.5 rounded-lg hover:border-white/10 transition-colors" data-testid={`session-row-${i}`} style={{ background: "rgba(15,15,20,0.5)", border: "1px solid rgba(212,175,55,0.08)" }}>
                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary/10 to-purple-500/10 flex items-center justify-center">
                  <Gamepad2 className="w-4 h-4 text-primary/60" />
                </div>
                <div className="flex-1">
                  <div className="text-xs font-semibold text-white">{session.tableName || formatSessionTime(session.lastPlayedAt)}</div>
                  <div className="text-[0.625rem] text-gray-500">{session.handsPlayed} hands played · {formatSessionTime(session.lastPlayedAt)}</div>
                </div>
                <div className={`text-sm font-bold ${positive ? "text-secondary" : "text-destructive"}`}>
                  {positive ? "+" : ""}{session.netResult.toLocaleString()}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}

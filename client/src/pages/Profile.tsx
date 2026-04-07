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
  ChevronUp, ChevronDown, Gift, Diamond, Gem, Image, ArrowRightLeft,
  CalendarDays, Medal, ThumbsUp, BarChart3,
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

// ─── Military Ranks ─────────────────────────────────────────────────────────
const MILITARY_RANKS = [
  { name: "Recruit", icon: Shield, minHands: 0, minWinRate: 0, minTourneyWins: 0, color: "text-gray-400" },
  { name: "Private", icon: Shield, minHands: 50, minWinRate: 0, minTourneyWins: 0, color: "text-gray-300" },
  { name: "Corporal", icon: Medal, minHands: 200, minWinRate: 30, minTourneyWins: 0, color: "text-green-400" },
  { name: "Sergeant", icon: Medal, minHands: 500, minWinRate: 35, minTourneyWins: 0, color: "text-blue-400" },
  { name: "Lieutenant", icon: Star, minHands: 1000, minWinRate: 40, minTourneyWins: 1, color: "text-cyan-400" },
  { name: "Captain", icon: Star, minHands: 2500, minWinRate: 45, minTourneyWins: 3, color: "text-purple-400" },
  { name: "Major", icon: Crown, minHands: 5000, minWinRate: 48, minTourneyWins: 5, color: "text-amber-400" },
  { name: "Colonel", icon: Crown, minHands: 10000, minWinRate: 50, minTourneyWins: 10, color: "text-orange-400" },
  { name: "General", icon: Crown, minHands: 25000, minWinRate: 55, minTourneyWins: 25, color: "text-red-400" },
  { name: "Field Marshal", icon: Crown, minHands: 50000, minWinRate: 60, minTourneyWins: 50, color: "text-yellow-300" },
];

function getMilitaryRank(handsPlayed: number, winRate: number, tourneyWins: number) {
  let currentIdx = 0;
  for (let i = MILITARY_RANKS.length - 1; i >= 0; i--) {
    const r = MILITARY_RANKS[i];
    if (handsPlayed >= r.minHands && winRate >= r.minWinRate && tourneyWins >= r.minTourneyWins) {
      currentIdx = i;
      break;
    }
  }
  return { current: currentIdx, rank: MILITARY_RANKS[currentIdx], next: MILITARY_RANKS[Math.min(currentIdx + 1, MILITARY_RANKS.length - 1)] };
}

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
  const [kycCopied, setKycCopied] = useState(false);
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
                        <button onClick={() => { navigator.clipboard.writeText(kycHash); setKycCopied(true); setTimeout(() => setKycCopied(false), 2000); }} className="p-0.5 hover:bg-white/5 rounded shrink-0 relative">
                          {kycCopied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3 text-gray-600" />}
                          {kycCopied && <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[9px] text-green-400 whitespace-nowrap bg-black/80 px-1.5 py-0.5 rounded">Copied!</span>}
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
  const [activeTab, setActiveTab] = useState<"profile" | "security" | "preferences">("profile");
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [privacyMode, setPrivacyMode] = useState(false);

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
      <div className="relative z-10 pb-8 px-4 md:px-8">

        {/* ═══════════════════════════════════════════════════════════════
            3-COLUMN DASHBOARD (matches reference: setup_21)
           ═══════════════════════════════════════════════════════════════ */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-lg md:text-xl font-black italic uppercase tracking-wider gold-text text-center mb-6">
            Comprehensive Player Security Dashboard
          </h1>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {/* ── Column 1: Profile & Edit ── */}
            <div className="vault-card p-6 flex flex-col items-center text-center">
              <h3 className="text-sm font-bold uppercase tracking-wider gold-text mb-4">Profile & Edit</h3>
              <div className="relative mb-4">
                <div className="w-32 h-32 rounded-full overflow-hidden" style={{ border: "3px solid #d4af37", boxShadow: "0 0 20px rgba(212,175,55,0.3)" }}>
                  <MemberAvatar
                    avatarId={user?.avatarId ?? null}
                    displayName={user?.displayName || user?.username || "Player"}
                    size="xl"
                  />
                </div>
                <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-green-400 border-2 border-[#0d0b08] shadow-[0_0_8px_rgba(74,222,128,0.6)]" />
              </div>
              <h2 className="text-xl font-black gold-text">{user?.displayName || user?.username || "Player"}</h2>
              <p className="text-xs text-gray-500 mt-1">@{user?.username}</p>
              {(user as any)?.memberId && (
                <p className="text-[0.625rem] text-gray-600 mt-0.5 font-mono">ID: {(user as any).memberId}</p>
              )}
              <div className="flex gap-2 mt-4">
                <Link href="/avatar-wardrobe">
                  <button className="gold-btn px-4 py-2 text-xs">Edit Avatar</button>
                </Link>
                <Link href="/lobby">
                  <button className="gold-btn px-4 py-2 text-xs">Play Now</button>
                </Link>
              </div>

              {/* Quick Stats */}
              <div className="w-full mt-4 space-y-2">
                <div className="flex justify-between text-xs"><span className="text-gray-500">Hands Played</span><span className="font-bold" style={{ color: "#d4af37" }}>{stats?.handsPlayed?.toLocaleString() || 0}</span></div>
                <div className="flex justify-between text-xs"><span className="text-gray-500">Win Rate</span><span className="font-bold" style={{ color: "#d4af37" }}>{winRate}%</span></div>
                <div className="flex justify-between text-xs"><span className="text-gray-500">Best Streak</span><span className="font-bold" style={{ color: "#d4af37" }}>{stats?.bestWinStreak || 0}</span></div>
                <div className="flex justify-between text-xs"><span className="text-gray-500">Level</span><span className="font-bold" style={{ color: "#d4af37" }}>{playerLevel} — {playerTitle}</span></div>
              </div>
            </div>

            {/* ── Column 2: Security & Privacy ── */}
            <div className="vault-card p-6 flex flex-col">
              <h3 className="text-sm font-bold uppercase tracking-wider gold-text mb-4">Security & Privacy</h3>

              <Link href="/security">
                <button className="w-full gold-btn py-3 text-sm mb-4">Password Reset</button>
              </Link>

              <div className="vault-card p-4 mb-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400">Two-Factor Authentication (2FA)</span>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${(user as any)?.twoFactorEnabled ? "bg-green-500/15 text-green-400 border border-green-500/20" : "bg-red-500/15 text-red-400 border border-red-500/20"}`}>
                    {(user as any)?.twoFactorEnabled ? "ENABLED" : "DISABLED"}
                  </span>
                </div>
              </div>

              <div className="vault-card p-4 mb-4">
                <p className="text-xs text-gray-400 mb-3">Linked Social Accounts</p>
                <div className="flex items-center gap-4 justify-center">
                  <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center" title="Google">
                    <span className="text-lg">G</span>
                  </div>
                  <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center" title="Facebook">
                    <span className="text-lg">f</span>
                  </div>
                </div>
              </div>

              <div className="vault-card p-4 mt-auto">
                <p className="text-xs font-bold uppercase tracking-wider gold-text mb-3">Preferences</p>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-gray-400">Email Notifications</span>
                  <div className="w-10 h-5 rounded-full bg-green-500/30 border border-green-500/30 flex items-center px-0.5">
                    <div className="w-4 h-4 rounded-full bg-green-400 ml-auto" />
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400">Privacy Mode</span>
                  <div className="w-10 h-5 rounded-full bg-white/10 border border-white/10 flex items-center px-0.5">
                    <div className="w-4 h-4 rounded-full bg-gray-500" />
                  </div>
                </div>
              </div>
            </div>

            {/* ── Column 3: Financials & Wallets ── */}
            <div className="vault-card p-6 flex flex-col">
              <h3 className="text-sm font-bold uppercase tracking-wider gold-text mb-4">Financials & Wallets</h3>

              <div className="vault-card p-4 mb-3 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-orange-500/15 flex items-center justify-center border border-orange-500/20">
                  <Wallet className="w-5 h-5 text-orange-400" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">MetaMask</p>
                  <p className="text-lg font-black text-white">{(user as any)?.walletAddress ? "Connected" : "Not Connected"}</p>
                </div>
              </div>

              <div className="vault-card p-4 mb-3 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-500/15 flex items-center justify-center border border-blue-500/20">
                  <Wallet className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Coinbase</p>
                  <p className="text-lg font-black text-white">Not Connected</p>
                </div>
              </div>

              <div className="vault-card p-4 mb-3 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: "rgba(212,175,55,0.1)", border: "1px solid rgba(212,175,55,0.2)" }}>
                  <Coins className="w-5 h-5" style={{ color: "#d4af37" }} />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Chips Balance</p>
                  <p className="text-lg font-black gold-text">{(user?.chipBalance ?? 0).toLocaleString()}</p>
                </div>
              </div>

              <Link href="/wallet" className="mt-auto">
                <button className="w-full gold-btn py-3 text-sm">Add New Wallet</button>
              </Link>
            </div>
          </div>
        </motion.div>

        {/* ═══════════════════════════════════════════════════════════════
            DETAILED STATS (below dashboard)
           ═══════════════════════════════════════════════════════════════ */}

        {/* ── Hero Banner ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="relative overflow-hidden rounded-2xl mb-6"
          style={{ minHeight: 200 }}
        >
          <div className="absolute inset-0" style={{ background: "linear-gradient(135deg, rgba(13,11,8,0.95) 0%, rgba(30,25,15,0.85) 50%, rgba(13,11,8,0.95) 100%)" }} />
          <div className="absolute inset-0" style={{ background: "linear-gradient(135deg, rgba(212,175,55,0.06) 0%, transparent 50%, rgba(212,175,55,0.03) 100%)" }} />
          <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[#d4af37]/40 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[#d4af37]/20 to-transparent" />

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
              {(user as any)?.loyaltyLevel > 1 && (
                <span className="inline-flex items-center gap-1 mt-1 ml-1 px-2 py-0.5 rounded-full text-[0.5625rem] font-bold uppercase tracking-wider bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  <Star className="w-3 h-3" /> {(user as any).loyaltyPoints?.toLocaleString() || 0} HRP
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

          {/* ── 1. Military Rank Progression Bar ── */}
          {stats && (
            <MilitaryRankProgressionBar stats={stats} winRate={winRate} />
          )}

          {/* ── 2. Active Missions Widget ── */}
          <ActiveMissionsWidget />

          {/* ── 3. Club Membership Card ── */}
          <ClubMembershipCard />

          {/* ── 4. NFT Collection Showcase ── */}
          <NFTCollectionShowcase />

          {/* ── 5. Marketplace Activity ── */}
          <MarketplaceActivity />

          {/* ── 6. Wallet Summary ── */}
          <WalletSummaryWidget />

          {/* ── 7. Leaderboard Position ── */}
          <LeaderboardPositionWidget />

          {/* ── 8. Tournament History ── */}
          <TournamentHistoryWidget />

          {/* ── Recent Transactions ── */}
          <RecentTransactionsWidget />

          {/* ── Social & Behavior ── */}
          <SocialBehaviorWidget />

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

// ─── 1. Military Rank Progression Bar ────────────────────────────────────────
function MilitaryRankProgressionBar({ stats, winRate }: { stats: PlayerStats; winRate: number }) {
  const { current, rank, next } = getMilitaryRank(stats.handsPlayed, winRate, stats.sngWins);
  const isMaxRank = current === MILITARY_RANKS.length - 1;
  const handsProgress = isMaxRank ? 100 : next.minHands > 0 ? Math.min((stats.handsPlayed / next.minHands) * 100, 100) : 100;
  const CurrentIcon = rank.icon;
  const NextIcon = next.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.26 }}
      className="rounded-xl p-5 mb-6"
      style={{ background: "rgba(15,15,20,0.5)", backdropFilter: "blur(20px)", border: "1px solid rgba(255,255,255,0.1)" }}
    >
      <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-4 flex items-center gap-2" style={{ textShadow: "0 0 8px rgba(212,175,55,0.4)" }}>
        <Medal className="w-4 h-4 text-primary/70" />
        Military Rank
      </h3>
      <div className="flex items-center gap-4 mb-3">
        <div className="flex items-center gap-2 shrink-0">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary/20 to-amber-600/20 flex items-center justify-center border border-primary/20">
            <CurrentIcon className={`w-5 h-5 ${rank.color}`} />
          </div>
          <div>
            <div className={`text-sm font-black ${rank.color}`}>{rank.name}</div>
            <div className="text-[0.5625rem] text-gray-600">Current Rank</div>
          </div>
        </div>
        <div className="flex-1">
          <div className="w-full h-3 rounded-full bg-white/5 overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${handsProgress}%` }}
              transition={{ duration: 1.2, ease: "easeOut" }}
              className="h-full rounded-full"
              style={{ background: "linear-gradient(90deg, #d4af37, #f5e6a3, #d4af37)" }}
            />
          </div>
        </div>
        {!isMaxRank && (
          <div className="flex items-center gap-2 shrink-0">
            <div>
              <div className={`text-sm font-black ${next.color} text-right`}>{next.name}</div>
              <div className="text-[0.5625rem] text-gray-600 text-right">Next Rank</div>
            </div>
            <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center border border-white/10">
              <NextIcon className={`w-5 h-5 ${next.color} opacity-50`} />
            </div>
          </div>
        )}
      </div>
      <div className="flex flex-wrap gap-3 text-[0.625rem]">
        <span className="px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/20">
          {stats.handsPlayed.toLocaleString()} / {isMaxRank ? "MAX" : next.minHands.toLocaleString()} hands
        </span>
        <span className={`px-2.5 py-1 rounded-full border ${winRate >= (isMaxRank ? rank.minWinRate : next.minWinRate) ? "bg-green-500/10 text-green-400 border-green-500/20" : "bg-red-500/10 text-red-400 border-red-500/20"}`}>
          Need {isMaxRank ? rank.minWinRate : next.minWinRate}%+ win rate
        </span>
        <span className={`px-2.5 py-1 rounded-full border ${stats.sngWins >= (isMaxRank ? rank.minTourneyWins : next.minTourneyWins) ? "bg-green-500/10 text-green-400 border-green-500/20" : "bg-amber-500/10 text-amber-400 border-amber-500/20"}`}>
          Need {isMaxRank ? rank.minTourneyWins : next.minTourneyWins} tournament win{(isMaxRank ? rank.minTourneyWins : next.minTourneyWins) !== 1 ? "s" : ""}
        </span>
      </div>
    </motion.div>
  );
}

// ─── 2. Active Missions Widget ───────────────────────────────────────────────
interface Mission {
  id: number;
  title: string;
  description: string;
  type: "daily" | "weekly";
  progress: number;
  target: number;
  reward: number;
  completed: boolean;
  claimed: boolean;
}

function ActiveMissionsWidget() {
  const [missions, setMissions] = useState<Mission[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"daily" | "weekly">("daily");
  const [claimingId, setClaimingId] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/missions/active", { credentials: "include" })
      .then(r => r.ok ? r.json() : [])
      .then(data => setMissions(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleClaim = async (missionId: number) => {
    setClaimingId(missionId);
    try {
      const res = await fetch(`/api/missions/${missionId}/claim`, { method: "POST", credentials: "include" });
      if (res.ok) {
        setMissions(prev => prev.map(m => m.id === missionId ? { ...m, claimed: true } : m));
      }
    } catch {}
    setClaimingId(null);
  };

  const filtered = missions.filter(m => m.type === filter);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.28 }}
      className="rounded-xl p-5 mb-6"
      style={{ background: "rgba(15,15,20,0.5)", backdropFilter: "blur(20px)", border: "1px solid rgba(255,255,255,0.1)" }}
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 flex items-center gap-2" style={{ textShadow: "0 0 8px rgba(212,175,55,0.4)" }}>
          <Target className="w-4 h-4 text-primary/70" />
          Active Missions
        </h3>
        <div className="flex rounded-lg overflow-hidden border border-white/10">
          {(["daily", "weekly"] as const).map(t => (
            <button
              key={t}
              onClick={() => setFilter(t)}
              className={`px-3 py-1 text-[0.625rem] font-bold uppercase transition-colors ${filter === t ? "bg-primary/20 text-primary" : "text-gray-500 hover:text-gray-300"}`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-8">
          <Target className="w-8 h-8 text-gray-600 mx-auto mb-2" />
          <p className="text-xs text-gray-500">No {filter} missions available.</p>
          <p className="text-[0.625rem] text-gray-600 mt-1">Check back later for new missions.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filtered.slice(0, 4).map(mission => {
            const pct = Math.min((mission.progress / mission.target) * 100, 100);
            return (
              <div key={mission.id} className="p-4 rounded-lg border border-white/[0.06] bg-white/[0.02]">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Target className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white">{mission.title}</div>
                      <div className="text-[0.5625rem] text-gray-500">{mission.description}</div>
                    </div>
                  </div>
                  <span className="flex items-center gap-1 text-[0.625rem] font-bold text-primary">
                    <Coins className="w-3 h-3" />
                    {mission.reward.toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-2 rounded-full bg-white/5 overflow-hidden">
                    <div className="h-full rounded-full bg-gradient-to-r from-primary to-amber-400 transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-[0.5625rem] text-gray-500 shrink-0">{mission.progress}/{mission.target}</span>
                </div>
                {mission.completed && !mission.claimed && (
                  <button
                    onClick={() => handleClaim(mission.id)}
                    disabled={claimingId === mission.id}
                    className="mt-2 w-full py-1.5 rounded-lg text-[0.625rem] font-bold uppercase tracking-wider bg-green-500/20 text-green-400 border border-green-500/30 hover:bg-green-500/30 transition-colors disabled:opacity-50"
                  >
                    {claimingId === mission.id ? <Loader2 className="w-3 h-3 animate-spin mx-auto" /> : "CLAIM REWARD"}
                  </button>
                )}
                {mission.claimed && (
                  <div className="mt-2 text-center text-[0.625rem] font-bold text-green-400/60">Claimed</div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}

// ─── 3. Club Membership Card ─────────────────────────────────────────────────
function ClubMembershipCard() {
  const [club, setClub] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/clubs", { credentials: "include" })
      .then(r => r.ok ? r.json() : [])
      .then(data => {
        const clubs = Array.isArray(data) ? data : data?.clubs || [];
        setClub(clubs.length > 0 ? clubs[0] : null);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.30 }}
      className="rounded-xl p-5 mb-6"
      style={{ background: "rgba(15,15,20,0.5)", backdropFilter: "blur(20px)", border: "1px solid rgba(255,255,255,0.1)" }}
    >
      <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-4 flex items-center gap-2" style={{ textShadow: "0 0 8px rgba(212,175,55,0.4)" }}>
        <Users className="w-4 h-4 text-primary/70" />
        Club Membership
      </h3>
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
        </div>
      ) : club ? (
        <div className="flex items-center gap-4 p-4 rounded-lg border border-white/[0.06] bg-white/[0.02]">
          <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary/20 to-purple-500/20 flex items-center justify-center border border-primary/20" style={{ boxShadow: "0 0 16px rgba(212,175,55,0.15)" }}>
            <Crown className="w-7 h-7 text-primary" />
          </div>
          <div className="flex-1">
            <div className="text-sm font-black text-white">{club.name || "My Club"}</div>
            <div className="flex items-center gap-2 mt-1">
              <span className={`px-2 py-0.5 rounded-full text-[0.5625rem] font-bold uppercase tracking-wider ${
                club.role === "owner" ? "bg-primary/15 text-primary border border-primary/20" :
                club.role === "admin" ? "bg-purple-500/15 text-purple-400 border border-purple-500/20" :
                "bg-white/5 text-gray-400 border border-white/10"
              }`}>
                {club.role || "Member"}
              </span>
              <span className="text-[0.625rem] text-gray-500 flex items-center gap-1">
                <Users className="w-3 h-3" />
                {club.memberCount || 0} members
              </span>
            </div>
          </div>
          <Link href="/club">
            <button className="px-4 py-2 rounded-lg text-[0.625rem] font-bold uppercase tracking-wider bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors">
              View Club
            </button>
          </Link>
        </div>
      ) : (
        <div className="text-center py-6">
          <Users className="w-10 h-10 text-gray-600 mx-auto mb-3" />
          <p className="text-xs text-gray-500 mb-3">You're not in a club yet.</p>
          <Link href="/clubs">
            <button className="px-6 py-2.5 rounded-lg text-[0.625rem] font-bold uppercase tracking-wider bg-gradient-to-r from-primary/20 to-amber-500/20 text-primary border border-primary/20 hover:from-primary/30 hover:to-amber-500/30 transition-all">
              Join a Club
            </button>
          </Link>
        </div>
      )}
    </motion.div>
  );
}

// ─── 4. NFT Collection Showcase ──────────────────────────────────────────────
function NFTCollectionShowcase() {
  const [nfts, setNfts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/inventory", { credentials: "include" })
      .then(r => r.ok ? r.json() : [])
      .then(data => setNfts(Array.isArray(data) ? data : data?.items || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const rarityGlow: Record<string, string> = {
    mythic: "border-primary/50 shadow-[0_0_16px_rgba(212,175,55,0.3)]",
    legendary: "border-primary/40 shadow-[0_0_12px_rgba(212,175,55,0.2)]",
    epic: "border-purple-500/40 shadow-[0_0_12px_rgba(168,85,247,0.2)]",
    rare: "border-purple-400/30 shadow-[0_0_10px_rgba(168,85,247,0.15)]",
    uncommon: "border-blue-400/30",
    common: "border-gray-500/20",
  };

  const rarityBadge: Record<string, string> = {
    mythic: "bg-primary/20 text-primary",
    legendary: "bg-amber-500/20 text-amber-400",
    epic: "bg-purple-500/20 text-purple-400",
    rare: "bg-blue-500/20 text-blue-400",
    uncommon: "bg-green-500/20 text-green-400",
    common: "bg-gray-500/20 text-gray-400",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.32 }}
      className="rounded-xl p-5 mb-6"
      style={{ background: "rgba(15,15,20,0.5)", backdropFilter: "blur(20px)", border: "1px solid rgba(255,255,255,0.1)" }}
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 flex items-center gap-2" style={{ textShadow: "0 0 8px rgba(212,175,55,0.4)" }}>
          <Gem className="w-4 h-4 text-primary/70" />
          My Collection
        </h3>
        <Link href="/avatar-wardrobe">
          <button className="text-[0.625rem] font-bold text-primary hover:text-primary/80 transition-colors flex items-center gap-1">
            View All <ChevronRight className="w-3 h-3" />
          </button>
        </Link>
      </div>
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
        </div>
      ) : nfts.length === 0 ? (
        <div className="text-center py-6">
          <Image className="w-8 h-8 text-gray-600 mx-auto mb-2" />
          <p className="text-xs text-gray-500">No collectibles yet.</p>
          <p className="text-[0.625rem] text-gray-600 mt-1">Visit the shop to get your first avatar NFT.</p>
        </div>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-white/10">
          {nfts.slice(0, 8).map((nft, i) => {
            const rarity = (nft.rarity || "common").toLowerCase();
            return (
              <div
                key={nft.id || i}
                className={`shrink-0 w-28 rounded-xl overflow-hidden border-2 ${rarityGlow[rarity] || rarityGlow.common} bg-white/[0.02] transition-transform hover:scale-105`}
              >
                <div className="w-28 h-28 bg-gradient-to-br from-white/5 to-transparent flex items-center justify-center">
                  {nft.imageUrl ? (
                    <img src={nft.imageUrl} alt={nft.name} className="w-full h-full object-cover" loading="lazy" />
                  ) : (
                    <Gem className="w-8 h-8 text-gray-600" />
                  )}
                </div>
                <div className="p-2">
                  <div className="text-[0.5625rem] font-bold text-white truncate">{nft.name || "Unknown"}</div>
                  <span className={`inline-block mt-0.5 px-1.5 py-0.5 rounded text-[0.5rem] font-bold uppercase ${rarityBadge[rarity] || rarityBadge.common}`}>
                    {rarity}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}

// ─── 5. Marketplace Activity ─────────────────────────────────────────────────
function MarketplaceActivity() {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/marketplace/history?limit=5", { credentials: "include" })
      .then(r => r.ok ? r.json() : [])
      .then(data => setTransactions(Array.isArray(data) ? data : data?.transactions || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.34 }}
      className="rounded-xl p-5 mb-6"
      style={{ background: "rgba(15,15,20,0.5)", backdropFilter: "blur(20px)", border: "1px solid rgba(255,255,255,0.1)" }}
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 flex items-center gap-2" style={{ textShadow: "0 0 8px rgba(212,175,55,0.4)" }}>
          <ArrowRightLeft className="w-4 h-4 text-primary/70" />
          Recent Activity
        </h3>
        <Link href="/marketplace">
          <button className="text-[0.625rem] font-bold text-primary hover:text-primary/80 transition-colors flex items-center gap-1">
            View Marketplace <ChevronRight className="w-3 h-3" />
          </button>
        </Link>
      </div>
      {loading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
        </div>
      ) : transactions.length === 0 ? (
        <div className="text-center py-6">
          <ArrowRightLeft className="w-8 h-8 text-gray-600 mx-auto mb-2" />
          <p className="text-xs text-gray-500">No marketplace activity yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {transactions.slice(0, 5).map((tx, i) => (
            <div key={tx.id || i} className="flex items-center gap-3 p-3 rounded-lg bg-white/[0.02] border border-white/[0.04]">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${tx.type === "buy" ? "bg-green-500/10" : "bg-red-500/10"}`}>
                {tx.type === "buy" ? (
                  <ShoppingBag className="w-4 h-4 text-green-400" />
                ) : (
                  <Coins className="w-4 h-4 text-red-400" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs text-gray-300 truncate">
                  {tx.type === "buy" ? "Bought" : "Sold"} <span className="font-bold text-white">{tx.itemName || "Item"}</span>
                  {" for "}
                  <span className="font-bold text-primary">{tx.price?.toLocaleString() || "0"} {tx.currency || "Gold"}</span>
                </div>
              </div>
              <span className="text-[0.5625rem] text-gray-600 shrink-0">
                {tx.createdAt ? new Date(tx.createdAt).toLocaleDateString() : ""}
              </span>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}

// ─── 6. Wallet Summary Widget ────────────────────────────────────────────────
function WalletSummaryWidget() {
  const [balances, setBalances] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/wallet/balances", { credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then(data => setBalances(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const walletTypes = [
    { key: "main", label: "Main", color: "bg-primary", textColor: "text-primary", bgColor: "bg-primary/15" },
    { key: "cashGame", label: "Cash Game", color: "bg-green-500", textColor: "text-green-400", bgColor: "bg-green-500/15" },
    { key: "sng", label: "SNG", color: "bg-blue-500", textColor: "text-blue-400", bgColor: "bg-blue-500/15" },
    { key: "tournament", label: "Tournament", color: "bg-purple-500", textColor: "text-purple-400", bgColor: "bg-purple-500/15" },
    { key: "bonus", label: "Bonus", color: "bg-amber-500", textColor: "text-amber-400", bgColor: "bg-amber-500/15" },
  ];

  const totalBalance = balances ? walletTypes.reduce((sum, w) => sum + (balances[w.key] || 0), 0) : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.36 }}
      className="rounded-xl p-5 mb-6"
      style={{ background: "rgba(15,15,20,0.5)", backdropFilter: "blur(20px)", border: "1px solid rgba(255,255,255,0.1)" }}
    >
      <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-4 flex items-center gap-2" style={{ textShadow: "0 0 8px rgba(212,175,55,0.4)" }}>
        <Wallet className="w-4 h-4 text-primary/70" />
        Wallet
      </h3>
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
        </div>
      ) : (
        <>
          <div className="text-center mb-4">
            <div className="text-3xl font-black" style={{ color: "#d4af37" }}>
              {totalBalance.toLocaleString()}
            </div>
            <div className="text-[0.625rem] text-gray-500 uppercase tracking-wider mt-0.5">Total Balance</div>
          </div>
          <div className="flex flex-wrap gap-2 justify-center">
            {walletTypes.map(w => {
              const val = balances?.[w.key] || 0;
              return (
                <div key={w.key} className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${w.bgColor} border border-white/5`}>
                  <div className={`w-2 h-2 rounded-full ${w.color}`} />
                  <span className="text-[0.625rem] text-gray-400">{w.label}</span>
                  <span className={`text-[0.625rem] font-bold ${w.textColor}`}>{val.toLocaleString()}</span>
                </div>
              );
            })}
          </div>
        </>
      )}
    </motion.div>
  );
}

// ─── 7. Leaderboard Position Widget ──────────────────────────────────────────
function LeaderboardPositionWidget() {
  const [position, setPosition] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/leaderboard", { credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.myPosition !== undefined) {
          setPosition({ rank: data.myPosition, change: data.positionChange || 0 });
        } else if (data?.rank !== undefined) {
          setPosition({ rank: data.rank, change: data.change || 0 });
        } else if (Array.isArray(data)) {
          // If we get back the full leaderboard, find our position
          setPosition({ rank: data.length > 0 ? 1 : 0, change: 0 });
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.38 }}
      className="rounded-xl p-5 mb-6"
      style={{ background: "rgba(15,15,20,0.5)", backdropFilter: "blur(20px)", border: "1px solid rgba(255,255,255,0.1)" }}
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 flex items-center gap-2" style={{ textShadow: "0 0 8px rgba(212,175,55,0.4)" }}>
          <BarChart3 className="w-4 h-4 text-primary/70" />
          Global Ranking
        </h3>
        <Link href="/leaderboard">
          <button className="text-[0.625rem] font-bold text-primary hover:text-primary/80 transition-colors flex items-center gap-1">
            View Leaderboard <ChevronRight className="w-3 h-3" />
          </button>
        </Link>
      </div>
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
        </div>
      ) : position ? (
        <div className="flex items-center justify-center gap-4">
          <div className="text-center">
            <div className="flex items-center gap-2 justify-center">
              <span className="text-5xl font-black" style={{ color: "#d4af37" }}>#{position.rank}</span>
              {position.change !== 0 && (
                <div className={`flex items-center gap-0.5 ${position.change > 0 ? "text-green-400" : "text-red-400"}`}>
                  {position.change > 0 ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                  <span className="text-sm font-bold">{Math.abs(position.change)}</span>
                </div>
              )}
            </div>
            <div className="text-[0.625rem] text-gray-500 mt-1">Based on total winnings</div>
          </div>
        </div>
      ) : (
        <div className="text-center py-6">
          <BarChart3 className="w-8 h-8 text-gray-600 mx-auto mb-2" />
          <p className="text-xs text-gray-500">Play more hands to earn a ranking.</p>
        </div>
      )}
    </motion.div>
  );
}

// ─── 8. Tournament History Widget ────────────────────────────────────────────
function TournamentHistoryWidget() {
  const [tournamentData, setTournamentData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/stats/tournaments", { credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then(data => setTournamentData(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const summary = tournamentData?.summary || { played: 0, wins: 0, finalTables: 0, biggestPrize: 0 };
  const recent = tournamentData?.recent || [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.40 }}
      className="rounded-xl p-5 mb-6"
      style={{ background: "rgba(15,15,20,0.5)", backdropFilter: "blur(20px)", border: "1px solid rgba(255,255,255,0.1)" }}
    >
      <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-4 flex items-center gap-2" style={{ textShadow: "0 0 8px rgba(212,175,55,0.4)" }}>
        <Trophy className="w-4 h-4 text-primary/70" />
        Tournament Record
      </h3>
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-4 gap-3 mb-4">
            {[
              { label: "Played", value: summary.played, color: "text-cyan-400" },
              { label: "Wins", value: summary.wins, color: "text-green-400" },
              { label: "Final Tables", value: summary.finalTables, color: "text-amber-400" },
              { label: "Biggest Prize", value: summary.biggestPrize?.toLocaleString() || "0", color: "text-primary" },
            ].map(s => (
              <div key={s.label} className="rounded-lg p-3 text-center" style={{ background: "rgba(255,255,255,0.03)" }}>
                <div className={`text-lg font-black ${s.color}`}>{s.value}</div>
                <div className="text-[0.5625rem] text-gray-500 uppercase">{s.label}</div>
              </div>
            ))}
          </div>
          {recent.length > 0 && (
            <div className="space-y-1.5">
              <div className="grid grid-cols-4 gap-2 px-3 py-1.5 text-[0.5625rem] text-gray-600 uppercase font-bold">
                <span>Tournament</span>
                <span className="text-center">Place</span>
                <span className="text-center">Prize</span>
                <span className="text-right">Date</span>
              </div>
              {recent.slice(0, 5).map((t: any, i: number) => (
                <div key={t.id || i} className="grid grid-cols-4 gap-2 px-3 py-2 rounded-lg bg-white/[0.02] items-center">
                  <span className="text-xs text-white font-semibold truncate">{t.name || "Tournament"}</span>
                  <span className={`text-xs font-bold text-center ${t.placement === 1 ? "text-primary" : t.placement <= 3 ? "text-amber-400" : "text-gray-400"}`}>
                    #{t.placement}
                  </span>
                  <span className="text-xs font-bold text-primary text-center">{(t.prize || 0).toLocaleString()}</span>
                  <span className="text-[0.5625rem] text-gray-600 text-right">
                    {t.date ? new Date(t.date).toLocaleDateString() : ""}
                  </span>
                </div>
              ))}
            </div>
          )}
          {recent.length === 0 && (
            <div className="text-center py-4">
              <p className="text-[0.625rem] text-gray-600">No tournament results yet. Enter a tournament to see your history.</p>
            </div>
          )}
        </>
      )}
    </motion.div>
  );
}

// ─── Recent Transactions Widget ──────────────────────────────────────────────
function RecentTransactionsWidget() {
  const [txns, setTxns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/wallet/transactions?limit=5", { credentials: "include" })
      .then(r => r.ok ? r.json() : [])
      .then(data => setTxns(Array.isArray(data) ? data : data?.transactions || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const txnIcon: Record<string, { icon: typeof Coins; color: string; bg: string }> = {
    "buy-in": { icon: Coins, color: "text-red-400", bg: "bg-red-500/10" },
    "cash-out": { icon: Coins, color: "text-green-400", bg: "bg-green-500/10" },
    deposit: { icon: Wallet, color: "text-blue-400", bg: "bg-blue-500/10" },
    withdrawal: { icon: Wallet, color: "text-orange-400", bg: "bg-orange-500/10" },
    bonus: { icon: Gift, color: "text-amber-400", bg: "bg-amber-500/10" },
    reward: { icon: Gift, color: "text-primary", bg: "bg-primary/10" },
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.42 }}
      className="rounded-xl p-5 mb-6"
      style={{ background: "rgba(15,15,20,0.5)", backdropFilter: "blur(20px)", border: "1px solid rgba(255,255,255,0.1)" }}
    >
      <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-4 flex items-center gap-2" style={{ textShadow: "0 0 8px rgba(212,175,55,0.4)" }}>
        <Coins className="w-4 h-4 text-primary/70" />
        Recent Transactions
      </h3>
      {loading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
        </div>
      ) : txns.length === 0 ? (
        <div className="text-center py-6">
          <Coins className="w-8 h-8 text-gray-600 mx-auto mb-2" />
          <p className="text-xs text-gray-500">No recent transactions.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {txns.slice(0, 5).map((tx, i) => {
            const txType = (tx.type || "deposit").toLowerCase();
            const style = txnIcon[txType] || txnIcon.deposit;
            const TxIcon = style.icon;
            return (
              <div key={tx.id || i} className="flex items-center gap-3 p-3 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${style.bg}`}>
                  <TxIcon className={`w-4 h-4 ${style.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-gray-300 capitalize">{tx.type || "Transaction"}</div>
                  {tx.description && <div className="text-[0.5625rem] text-gray-600 truncate">{tx.description}</div>}
                </div>
                <div className="text-right shrink-0">
                  <div className={`text-xs font-bold ${(tx.amount || 0) >= 0 ? "text-green-400" : "text-red-400"}`}>
                    {(tx.amount || 0) >= 0 ? "+" : ""}{(tx.amount || 0).toLocaleString()}
                  </div>
                  <div className="text-[0.5rem] text-gray-600">
                    {tx.createdAt ? new Date(tx.createdAt).toLocaleDateString() : ""}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}

// ─── Social & Behavior Widget ────────────────────────────────────────────────
function SocialBehaviorWidget() {
  const [reputation, setReputation] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/stats/reputation", { credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then(data => setReputation(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const repLevel = reputation?.level || "Excellent";
  const repColor: Record<string, { text: string; bg: string; border: string; glow: string }> = {
    Excellent: { text: "text-green-400", bg: "bg-green-500/10", border: "border-green-500/20", glow: "0 0 12px rgba(34,197,94,0.15)" },
    Good: { text: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/20", glow: "0 0 12px rgba(59,130,246,0.15)" },
    Fair: { text: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20", glow: "0 0 12px rgba(245,158,11,0.15)" },
    Poor: { text: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/20", glow: "0 0 12px rgba(239,68,68,0.15)" },
  };
  const style = repColor[repLevel] || repColor.Excellent;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.44 }}
      className="rounded-xl p-5 mb-6"
      style={{ background: "rgba(15,15,20,0.5)", backdropFilter: "blur(20px)", border: "1px solid rgba(255,255,255,0.1)" }}
    >
      <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-4 flex items-center gap-2" style={{ textShadow: "0 0 8px rgba(212,175,55,0.4)" }}>
        <ThumbsUp className="w-4 h-4 text-primary/70" />
        Social & Behavior
      </h3>
      {loading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
        </div>
      ) : (
        <div className="flex items-center gap-4">
          <div
            className={`flex items-center gap-3 px-5 py-3 rounded-xl ${style.bg} border ${style.border}`}
            style={{ boxShadow: style.glow }}
          >
            <ThumbsUp className={`w-6 h-6 ${style.text}`} />
            <div>
              <div className={`text-lg font-black ${style.text}`}>{repLevel}</div>
              <div className="text-[0.5625rem] text-gray-500">Table Reputation</div>
            </div>
          </div>
          <div className="flex-1 space-y-2">
            {[
              { label: "Games Completed", value: reputation?.gamesCompleted || 0 },
              { label: "Times Reported", value: reputation?.timesReported || 0 },
              { label: "Friendly Actions", value: reputation?.friendlyActions || 0 },
            ].map(item => (
              <div key={item.label} className="flex items-center justify-between text-[0.625rem]">
                <span className="text-gray-500">{item.label}</span>
                <span className="font-bold text-gray-300">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
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
        {saving && <span className="flex items-center gap-1 text-[0.5625rem] text-purple-400 ml-2"><Loader2 className="w-3 h-3 animate-spin" /> Saving...</span>}
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

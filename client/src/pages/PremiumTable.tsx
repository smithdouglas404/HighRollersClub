import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useAuth } from "@/lib/auth-context";
import { Link } from "wouter";
import { GoldButton, GoldCard, SectionHeader, GoldDivider } from "@/components/premium/PremiumComponents";
import { Crown, Lock, Star, Shield } from "lucide-react";

const SEAT_POSITIONS = [
  { top: "8%", left: "50%", transform: "translateX(-50%)" },
  { top: "18%", left: "82%" },
  { top: "50%", left: "92%", transform: "translateY(-50%)" },
  { top: "72%", left: "82%" },
  { top: "85%", left: "50%", transform: "translateX(-50%)" },
  { top: "72%", left: "10%" },
  { top: "50%", left: "2%", transform: "translateY(-50%)" },
  { top: "18%", left: "10%" },
];

const AVATAR_FILES = [
  "avatar_cyber_samurai",
  "avatar_gold_phantom",
  "avatar_ice_queen",
  "avatar_shadow_king",
  "avatar_neon_viper",
  "avatar_punk_duchess",
  "avatar_iron_bull",
  "avatar_chrome_siren",
];

const PLAYER_NAMES = [
  "CyberSamurai",
  "GoldPhantom",
  "IceQueen",
  "ShadowKing",
  "NeonViper",
  "PunkDuchess",
  "IronBull",
  "ChromeSiren",
];

const CHIP_STACKS = [
  125_400, 89_200, 210_800, 67_500, 154_300, 43_100, 178_600, 96_750,
];

const HOLE_CARDS = [
  ["A\u2660", "K\u2660"],
  ["Q\u2665", "J\u2665"],
  ["10\u2663", "10\u2666"],
  ["A\u2665", "9\u2665"],
  ["K\u2663", "Q\u2663"],
  ["J\u2660", "10\u2660"],
  ["8\u2666", "8\u2663"],
  ["A\u2663", "K\u2665"],
];

const COMMUNITY_CARDS = ["A\u2666", "7\u2660", "3\u2665", "J\u2666", ""];

const WAITING_LIST = [
  { name: "VoidWitch", avatar: "avatar_void_witch", chips: 50_000 },
  { name: "TechMonk", avatar: "avatar_tech_monk", chips: 75_000 },
  { name: "RedWolf", avatar: "avatar_red_wolf", chips: 62_000 },
  { name: "DarkAce", avatar: "avatar_dark_ace", chips: 88_000 },
];

const PREMIUM_PERKS = [
  "Full-body avatar rendering at the table",
  "Exclusive High Rollers Club access",
  "Priority seating at premium tables",
  "Cinematic table themes and lighting",
  "Custom card backs and felt colors",
  "VIP-only tournaments and freerolls",
];

function formatChips(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toString();
}

function isPremiumUser(user: { tier?: string; tierExpiresAt?: string | null } | null): boolean {
  if (!user) return false;
  if (user.tier === "platinum") return true;
  if (user.tierExpiresAt) {
    return new Date(user.tierExpiresAt) > new Date();
  }
  return false;
}

function UpgradePrompt() {
  return (
    <DashboardLayout title="Premium Table">
      <div className="min-h-[80vh] flex items-center justify-center p-4">
        <div
          className="max-w-lg w-full rounded-2xl border border-amber-500/30 p-8 text-center"
          style={{
            background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #1a1a2e 100%)",
            boxShadow: "0 0 60px rgba(245, 158, 11, 0.1), inset 0 1px 0 rgba(245, 158, 11, 0.15)",
          }}
        >
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-amber-500/10 border border-amber-500/30">
            <Lock className="h-10 w-10 text-amber-400" />
          </div>
          <h2 className="text-2xl font-bold text-amber-300 mb-2">
            HIGH ROLLERS CLUB
          </h2>
          <p className="text-gray-400 mb-6">
            This premium feature is reserved for elite members. Upgrade to unlock
            the full-body avatar poker experience.
          </p>
          <ul className="text-left space-y-3 mb-8">
            {PREMIUM_PERKS.map((perk) => (
              <li key={perk} className="flex items-start gap-3">
                <Star className="h-4 w-4 text-amber-400 mt-0.5 flex-shrink-0" />
                <span className="text-sm text-gray-300">{perk}</span>
              </li>
            ))}
          </ul>
          <Link
            href="/premium"
            className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-amber-500 to-yellow-500 px-8 py-3 font-semibold text-black transition hover:from-amber-400 hover:to-yellow-400"
          >
            <Crown className="h-5 w-5" />
            Upgrade to Premium
          </Link>
        </div>
      </div>
    </DashboardLayout>
  );
}

function CardDisplay({ card, faceDown }: { card: string; faceDown?: boolean }) {
  if (faceDown || !card) {
    return (
      <div
        className="w-8 h-11 rounded border border-gray-600 flex items-center justify-center text-[10px]"
        style={{
          background: "linear-gradient(135deg, #1e3a5f, #0f2a44)",
          boxShadow: "0 2px 4px rgba(0,0,0,0.4)",
        }}
      >
        <Shield className="h-3 w-3 text-amber-500/50" />
      </div>
    );
  }
  const isRed = card.includes("\u2665") || card.includes("\u2666");
  return (
    <div
      className="w-8 h-11 rounded border border-gray-500 flex items-center justify-center text-xs font-bold"
      style={{
        background: "linear-gradient(135deg, #f5f5f0, #e8e8e0)",
        color: isRed ? "#dc2626" : "#1a1a1a",
        boxShadow: "0 2px 4px rgba(0,0,0,0.3)",
      }}
    >
      {card}
    </div>
  );
}

function AdminControls() {
  const [open, setOpen] = useState(false);
  const actions = ["Pause Game", "Manage Table", "Approve Players"];

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-black/60 px-4 py-2 text-sm text-amber-300 hover:bg-amber-500/10 transition"
      >
        <Shield className="h-4 w-4" />
        Admin
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 w-48 rounded-lg border border-amber-500/20 bg-gray-900 shadow-xl overflow-hidden">
          {actions.map((action) => (
            <button
              key={action}
              className="w-full text-left px-4 py-2.5 text-sm text-gray-300 hover:bg-amber-500/10 hover:text-amber-300 transition"
              onClick={() => setOpen(false)}
            >
              {action}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function WaitingListSidebar() {
  return (
    <GoldCard className="w-64 flex-shrink-0" padding="p-4" glow>
      <h3 className="text-sm font-semibold text-amber-400 mb-3 flex items-center gap-2">
        <Crown className="h-4 w-4" />
        WAITING LIST
      </h3>
      <div className="space-y-3">
        {WAITING_LIST.map((player) => (
          <div
            key={player.name}
            className="flex items-center gap-3 rounded-lg bg-white/5 p-2"
          >
            <img
              src={`/avatars/${player.avatar}.webp`}
              alt={player.name}
              className="h-10 w-10 rounded-full object-cover border border-amber-500/30"
            />
            <div className="min-w-0">
              <div className="text-xs font-medium text-gray-300 truncate">
                {player.name}
              </div>
              <div className="text-[10px] text-amber-400">
                {formatChips(player.chips)} chips
              </div>
            </div>
          </div>
        ))}
      </div>
    </GoldCard>
  );
}

export default function PremiumTable() {
  const { user } = useAuth();
  const [activeSeat, setActiveSeat] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveSeat((prev) => (prev + 1) % 8);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  if (!isPremiumUser(user)) {
    return <UpgradePrompt />;
  }

  const pot = CHIP_STACKS.reduce((sum, s) => sum + Math.floor(s * 0.08), 0);

  return (
    <DashboardLayout title="Premium Table">
      <div className="flex gap-4 h-full min-h-[85vh]">
        {/* Main table area */}
        <div className="flex-1 flex flex-col">
          {/* Top bar */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Crown className="h-6 w-6 text-amber-400" />
              <h1 className="text-xl font-bold text-amber-300 tracking-wide">
                HIGH ROLLERS CLUB
              </h1>
              <span className="rounded-full bg-amber-500/10 border border-amber-500/30 px-3 py-0.5 text-xs text-amber-400">
                NL 500/1000
              </span>
            </div>
            <AdminControls />
          </div>

          {/* Table container */}
          <div
            className="flex-1 relative rounded-2xl overflow-hidden"
            style={{
              background: "radial-gradient(ellipse at center, #0a1628 0%, #060d1a 60%, #030810 100%)",
              boxShadow: "inset 0 0 120px rgba(245, 158, 11, 0.03)",
              minHeight: "600px",
              perspective: "1200px",
            }}
          >
            {/* Ambient light effects */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background:
                  "radial-gradient(ellipse at 50% 30%, rgba(245, 158, 11, 0.04) 0%, transparent 60%)",
              }}
            />

            {/* Poker table felt */}
            <div
              className="absolute"
              style={{
                top: "30%",
                left: "15%",
                width: "70%",
                height: "45%",
                borderRadius: "50%",
                background:
                  "radial-gradient(ellipse, #0a3d2a 0%, #072e20 40%, #05231a 80%)",
                border: "3px solid rgba(245, 158, 11, 0.25)",
                boxShadow:
                  "0 0 60px rgba(245, 158, 11, 0.08), inset 0 0 80px rgba(0,0,0,0.4)",
                transform: "rotateX(15deg)",
              }}
            >
              {/* HIGH ROLLERS CLUB watermark */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <span
                  className="text-3xl font-bold tracking-[0.3em] select-none"
                  style={{
                    color: "rgba(245, 158, 11, 0.06)",
                    textShadow: "0 0 20px rgba(245, 158, 11, 0.03)",
                  }}
                >
                  HIGH ROLLERS
                </span>
              </div>
            </div>

            {/* Community cards */}
            <div
              className="absolute flex gap-2 items-center justify-center"
              style={{
                top: "46%",
                left: "50%",
                transform: "translate(-50%, -50%)",
              }}
            >
              {COMMUNITY_CARDS.map((card, i) => (
                <CardDisplay key={i} card={card} faceDown={!card} />
              ))}
            </div>

            {/* Pot display */}
            <div
              className="absolute flex flex-col items-center"
              style={{
                top: "58%",
                left: "50%",
                transform: "translateX(-50%)",
              }}
            >
              <div
                className="rounded-full px-5 py-1.5 text-sm font-bold"
                style={{
                  background:
                    "linear-gradient(135deg, rgba(245, 158, 11, 0.2), rgba(234, 179, 8, 0.1))",
                  border: "1px solid rgba(245, 158, 11, 0.35)",
                  color: "#fbbf24",
                  textShadow: "0 0 10px rgba(245, 158, 11, 0.3)",
                }}
              >
                POT: {formatChips(pot)}
              </div>
            </div>

            {/* Player seats */}
            {SEAT_POSITIONS.map((pos, i) => {
              const isActive = i === activeSeat;
              return (
                <div
                  key={i}
                  className="absolute flex flex-col items-center"
                  style={{
                    top: pos.top,
                    left: pos.left,
                    transform: pos.transform || "none",
                    transition: "all 0.3s ease",
                    zIndex: isActive ? 10 : 1,
                  }}
                >
                  {/* Avatar image - full body, rendered large */}
                  <div
                    className="relative"
                    style={{
                      filter: isActive
                        ? "drop-shadow(0 0 20px rgba(245, 158, 11, 0.4))"
                        : "drop-shadow(0 4px 8px rgba(0,0,0,0.6))",
                      transition: "filter 0.3s ease",
                    }}
                  >
                    {isActive && (
                      <div
                        className="absolute -inset-1 rounded-lg"
                        style={{
                          background:
                            "linear-gradient(135deg, rgba(245, 158, 11, 0.3), transparent, rgba(245, 158, 11, 0.15))",
                          animation: "pulse 2s ease-in-out infinite",
                        }}
                      />
                    )}
                    <img
                      src={`/avatars/${AVATAR_FILES[i]}.webp`}
                      alt={PLAYER_NAMES[i]}
                      className="relative rounded-lg object-cover"
                      style={{
                        height: "200px",
                        width: "auto",
                        maxWidth: "140px",
                        border: isActive
                          ? "2px solid rgba(245, 158, 11, 0.6)"
                          : "2px solid rgba(255,255,255,0.08)",
                        borderRadius: "12px",
                      }}
                    />
                  </div>

                  {/* Player info panel */}
                  <div
                    className="mt-1 rounded-lg px-3 py-1.5 text-center min-w-[100px]"
                    style={{
                      background: isActive
                        ? "linear-gradient(135deg, rgba(245, 158, 11, 0.15), rgba(0,0,0,0.8))"
                        : "rgba(0,0,0,0.7)",
                      border: isActive
                        ? "1px solid rgba(245, 158, 11, 0.4)"
                        : "1px solid rgba(255,255,255,0.08)",
                      backdropFilter: "blur(8px)",
                    }}
                  >
                    <div className="text-xs font-semibold text-gray-200 truncate">
                      {PLAYER_NAMES[i]}
                    </div>
                    <div
                      className="text-[11px] font-bold"
                      style={{ color: "#fbbf24" }}
                    >
                      {formatChips(CHIP_STACKS[i])}
                    </div>
                    <div className="flex gap-1 justify-center mt-1">
                      {HOLE_CARDS[i].map((card, ci) => (
                        <CardDisplay
                          key={ci}
                          card={card}
                          faceDown={i !== 0}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Waiting list sidebar */}
        <WaitingListSidebar />
      </div>
    </DashboardLayout>
  );
}

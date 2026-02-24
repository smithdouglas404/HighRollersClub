import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import { useAuth } from "@/lib/auth-context";
import { MatrixRain } from "./MatrixRain";
import { WalletBar } from "./wallet/WalletBar";
import {
  LayoutDashboard, Users, Trophy, ShoppingBag, Swords,
  BarChart3, Coins, LogOut, User, ChevronRight
} from "lucide-react";

import lionLogo from "@assets/generated_images/lion_crest_gold_emblem.png";
import serverBg from "@assets/generated_images/cinematic_server_room_bg.png";

interface NavItem {
  icon: any;
  label: string;
  href: string;
  match?: string[];
}

const NAV_ITEMS: NavItem[] = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/lobby" },
  { icon: Users, label: "Members", href: "/members", match: ["/members"] },
  { icon: Trophy, label: "Games & Tournaments", href: "/lobby", match: ["/lobby", "/game"] },
  { icon: ShoppingBag, label: "Shop", href: "/shop", match: ["/shop"] },
  { icon: Swords, label: "League & Alliances", href: "/leagues" },
  { icon: BarChart3, label: "Analytics", href: "/analytics" },
];

export function DashboardLayout({ children, title }: { children: ReactNode; title?: string }) {
  const [location] = useLocation();
  const { user, logout, refreshUser } = useAuth();

  const handleClaimDaily = async () => {
    try {
      await fetch("/api/wallet/claim-daily", { method: "POST" });
      await refreshUser();
    } catch {}
  };

  return (
    <div className="min-h-screen bg-[#020508] text-white flex relative overflow-hidden">
      {/* Background layers */}
      <div className="absolute inset-0 z-0">
        <img
          src={serverBg}
          alt=""
          className="w-full h-full object-cover opacity-15 blur-[2px] scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-[#020508]/80 via-[#020508]/70 to-[#020508]/90" />
      </div>

      {/* Matrix rain on edges */}
      <MatrixRain
        side="both"
        color="#00ff9d"
        opacity={0.12}
        density={0.3}
        className="absolute inset-0 z-[1]"
      />

      {/* ─── Sidebar ─────────────────────────────────────────────── */}
      <motion.aside
        initial={{ x: -280, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="relative z-10 w-[220px] min-h-screen flex flex-col shrink-0"
      >
        {/* Glass panel */}
        <div className="absolute inset-0 bg-[#0a0f18]/80 backdrop-blur-xl border-r border-cyan-500/10" />
        <div
          className="absolute inset-y-0 right-0 w-px"
          style={{
            background: "linear-gradient(to bottom, transparent, rgba(0,240,255,0.2) 20%, rgba(0,240,255,0.2) 80%, transparent)",
          }}
        />

        <div className="relative z-10 flex flex-col h-full">
          {/* Logo */}
          <div className="px-5 pt-6 pb-4 flex items-center gap-3">
            <div className="w-10 h-10 relative shrink-0">
              <div className="absolute inset-0 bg-amber-500/20 blur-lg rounded-full" />
              <img
                src={lionLogo}
                alt="High Rollers"
                className="w-full h-full object-contain relative z-10 drop-shadow-[0_0_8px_rgba(201,168,76,0.4)]"
              />
            </div>
            <div>
              <div className="font-display font-bold text-xs tracking-[0.15em] gold-text leading-none">
                HIGH ROLLERS
              </div>
              <div className="text-[8px] text-gray-600 tracking-[0.2em] font-mono mt-0.5">CLUB</div>
            </div>
          </div>

          {/* Nav Items */}
          <nav className="flex-1 px-3 py-2 space-y-0.5">
            {NAV_ITEMS.map((item) => {
              const isActive =
                location === item.href ||
                item.match?.some((m) => location.startsWith(m));
              const Icon = item.icon;
              return (
                <Link key={item.href} href={item.href}>
                  <motion.div
                    whileHover={{ x: 2 }}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-all cursor-pointer group ${
                      isActive
                        ? "bg-cyan-500/15 text-cyan-400 border border-cyan-500/20 shadow-[0_0_15px_rgba(0,240,255,0.05)]"
                        : "text-gray-500 hover:text-gray-300 hover:bg-white/5 border border-transparent"
                    }`}
                  >
                    <Icon
                      className={`w-4 h-4 shrink-0 ${
                        isActive ? "text-cyan-400" : "text-gray-600 group-hover:text-gray-400"
                      }`}
                    />
                    <span className="tracking-wide">{item.label}</span>
                    {isActive && (
                      <div className="ml-auto w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_6px_rgba(0,240,255,0.5)]" />
                    )}
                  </motion.div>
                </Link>
              );
            })}
          </nav>

          {/* Bottom: User info */}
          <div className="px-3 pb-4 space-y-2">
            {/* Balance */}
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleClaimDaily}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/15 hover:border-amber-500/30 transition-all"
            >
              <Coins className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-bold text-amber-400">
                {user?.chipBalance?.toLocaleString() ?? 0}
              </span>
              <span className="text-[8px] text-amber-600 ml-auto">CHIPS</span>
            </motion.button>

            {/* User */}
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/5">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-cyan-500/30 to-purple-500/30 flex items-center justify-center border border-white/10">
                <User className="w-3.5 h-3.5 text-gray-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[10px] font-medium text-gray-300 truncate">
                  {user?.displayName || user?.username}
                </div>
                <div className="text-[8px] text-gray-600 uppercase tracking-wider">
                  {user?.role}
                </div>
              </div>
              <button
                onClick={logout}
                className="p-1 hover:bg-white/5 rounded transition-colors"
                title="Logout"
              >
                <LogOut className="w-3 h-3 text-gray-600 hover:text-gray-400" />
              </button>
            </div>
          </div>
        </div>
      </motion.aside>

      {/* ─── Main Content ────────────────────────────────────────── */}
      <main className="relative z-10 flex-1 overflow-y-auto min-h-screen">
        {/* Top header bar with wallet */}
        <div className="flex items-center justify-between px-8 pt-4 pb-2">
          {title ? (
            <motion.h1
              initial={{ y: -20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="text-lg font-bold tracking-wider text-white uppercase gold-text"
            >
              {title}
            </motion.h1>
          ) : (
            <div />
          )}
          <motion.div
            initial={{ y: -10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            <WalletBar />
          </motion.div>
        </div>
        {children}
      </main>
    </div>
  );
}

import { ReactNode, useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/lib/auth-context";
import { useClub } from "@/lib/club-context";
import { useIsMobile } from "@/hooks/use-mobile";
import { MatrixRain } from "./MatrixRain";
import { WalletBar } from "./wallet/WalletBar";
import { NotificationCenter } from "./NotificationCenter";
import { MemberAvatar } from "./shared/MemberAvatar";
import {
  LayoutDashboard, Users, Trophy, ShoppingBag, Swords,
  BarChart3, LogOut, Search, Wallet, Medal,
  Shield, ChevronDown, Check, Menu, X
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
  { icon: Wallet, label: "Wallet", href: "/wallet", match: ["/wallet"] },
  { icon: Search, label: "Browse Clubs", href: "/clubs/browse", match: ["/clubs/browse"] },
  { icon: Swords, label: "League & Alliances", href: "/leagues" },
  { icon: BarChart3, label: "Analytics", href: "/analytics" },
  { icon: Medal, label: "Leaderboard", href: "/leaderboard", match: ["/leaderboard"] },
];

function ClubSwitcher() {
  const { allClubs, club, switchClub } = useClub();
  const [open, setOpen] = useState(false);

  if (allClubs.length === 0) return null;

  return (
    <div className="px-3 pb-2">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-all hover:bg-white/5"
        style={{
          background: "rgba(0,240,255,0.04)",
          border: "1px solid rgba(0,240,255,0.1)",
        }}
      >
        <Shield className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
        <span className="flex-1 text-[10px] font-bold text-white truncate tracking-wide">
          {club?.name ?? "Select Club"}
        </span>
        <ChevronDown
          className={`w-3 h-3 text-gray-500 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <div
              className="mt-1 rounded-lg py-1 space-y-0.5"
              style={{
                background: "rgba(12,20,40,0.95)",
                border: "1px solid rgba(0,240,255,0.08)",
              }}
            >
              {allClubs.map((c) => (
                <button
                  key={c.id}
                  onClick={() => { switchClub(c.id); setOpen(false); }}
                  className={`w-full flex items-center gap-2 px-3 py-1.5 text-left transition-all hover:bg-white/5 ${
                    c.id === club?.id ? "bg-cyan-500/10" : ""
                  }`}
                >
                  <span className="flex-1 min-w-0">
                    <span className="block text-[10px] font-medium text-white truncate">{c.name}</span>
                    <span className="block text-[8px] text-gray-500">{c.memberCount} members</span>
                  </span>
                  {c.id === club?.id && (
                    <Check className="w-3 h-3 text-cyan-400 shrink-0" />
                  )}
                </button>
              ))}
              <Link href="/clubs/browse">
                <div
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2 px-3 py-1.5 text-[9px] text-cyan-500 hover:text-cyan-400 transition-colors cursor-pointer border-t border-white/5 mt-1 pt-1.5"
                >
                  <Search className="w-3 h-3" />
                  Browse More Clubs
                </div>
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function DashboardLayout({ children, title }: { children: ReactNode; title?: string }) {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Close sidebar on navigation
  useEffect(() => {
    if (isMobile) setSidebarOpen(false);
  }, [location, isMobile]);

  /* ── Sidebar content (shared between desktop and mobile) ── */
  const sidebarContent = (
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
        <div className="flex-1">
          <div className="font-display font-bold text-xs tracking-[0.15em] gold-text leading-none">
            HIGH ROLLERS
          </div>
          <div className="text-[8px] text-gray-500 tracking-[0.2em] font-mono mt-0.5">CLUB</div>
        </div>
        {isMobile && (
          <button
            onClick={() => setSidebarOpen(false)}
            className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4 text-gray-400" />
          </button>
        )}
      </div>

      {/* Club Switcher */}
      <ClubSwitcher />

      {/* Nav Items */}
      <nav className="flex-1 px-3 py-2 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const isActive =
            location === item.href ||
            item.match?.some((m) => location.startsWith(m));
          const Icon = item.icon;
          return (
            <Link key={item.label} href={item.href}>
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
                    isActive ? "text-cyan-400" : "text-gray-500 group-hover:text-gray-300"
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
      <div className="px-3 pb-4">
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/5">
          <Link href="/profile">
            <div className="cursor-pointer hover:opacity-80 transition-opacity">
              <MemberAvatar
                avatarId={user?.avatarId ?? null}
                displayName={user?.displayName || user?.username || ""}
                size="sm"
              />
            </div>
          </Link>
          <div className="flex-1 min-w-0">
            <Link href="/profile">
              <div className="text-[10px] font-medium text-gray-300 truncate cursor-pointer hover:text-white transition-colors">
                {user?.displayName || user?.username}
              </div>
            </Link>
            <div className="text-[8px] text-gray-500 uppercase tracking-wider">
              {user?.role}
            </div>
          </div>
          <button
            onClick={logout}
            className="p-1 hover:bg-white/5 rounded transition-colors"
            title="Logout"
          >
            <LogOut className="w-3 h-3 text-gray-500 hover:text-gray-300" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0a1022] text-white flex relative overflow-hidden">
      {/* Background layers */}
      <div className="absolute inset-0 z-0">
        <img
          src={serverBg}
          alt=""
          className="w-full h-full object-cover opacity-20 blur-[2px] scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-[#0a1022]/80 via-[#0a1022]/70 to-[#0a1022]/90" />
      </div>

      {/* Matrix rain on edges */}
      <MatrixRain
        side="both"
        color="#00ff9d"
        opacity={0.12}
        density={0.3}
        className="absolute inset-0 z-[1]"
      />

      {/* ─── Desktop Sidebar ──────────────────────────────────────── */}
      {!isMobile && (
        <motion.aside
          initial={{ x: -280, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="relative z-10 w-[220px] min-h-screen flex flex-col shrink-0"
        >
          {/* Glass panel */}
          <div className="absolute inset-0 bg-[#0c1428]/80 backdrop-blur-xl border-r border-cyan-500/10" />
          <div
            className="absolute inset-y-0 right-0 w-px"
            style={{
              background: "linear-gradient(to bottom, transparent, rgba(0,240,255,0.2) 20%, rgba(0,240,255,0.2) 80%, transparent)",
            }}
          />
          {sidebarContent}
        </motion.aside>
      )}

      {/* ─── Mobile Sidebar Overlay ───────────────────────────────── */}
      <AnimatePresence>
        {isMobile && sidebarOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
              onClick={() => setSidebarOpen(false)}
            />
            {/* Slide-in sidebar */}
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="fixed inset-y-0 left-0 z-50 w-[260px] flex flex-col"
            >
              <div className="absolute inset-0 bg-[#0c1428]/95 backdrop-blur-xl border-r border-cyan-500/10" />
              {sidebarContent}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* ─── Main Content ────────────────────────────────────────── */}
      <main className="relative z-10 flex-1 overflow-y-auto min-h-screen">
        {/* Top header bar with wallet */}
        <div className="flex items-center justify-between px-4 md:px-8 pt-4 pb-2">
          <div className="flex items-center gap-3">
            {isMobile && (
              <button
                onClick={() => setSidebarOpen(true)}
                className="p-2 rounded-lg hover:bg-white/5 transition-colors border border-white/10"
              >
                <Menu className="w-5 h-5 text-gray-400" />
              </button>
            )}
            {title ? (
              <motion.h1
                initial={{ y: -20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="text-base md:text-lg font-bold tracking-wider text-white uppercase gold-text"
              >
                {title}
              </motion.h1>
            ) : (
              <div />
            )}
          </div>
          <motion.div
            initial={{ y: -10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="flex items-center gap-2"
          >
            <NotificationCenter />
            <WalletBar />
          </motion.div>
        </div>
        {children}
      </main>
    </div>
  );
}

import { ReactNode, useState, useEffect, useCallback } from "react";
import { Link, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/lib/auth-context";
import { useClub } from "@/lib/club-context";
import { useWallet } from "@/lib/wallet-context";
import { useIsMobile } from "@/hooks/use-mobile";
import { WalletBar } from "./wallet/WalletBar";
import { NotificationCenter } from "./NotificationCenter";
import { MemberAvatar } from "./shared/MemberAvatar";
import {
  LayoutDashboard, Users, Trophy, ShoppingBag, Swords,
  BarChart3, LogOut, Search, Wallet, Medal,
  Shield, ChevronDown, Check, Menu, X, Coins
} from "lucide-react";

import lionLogo from "@assets/generated_images/lion_crest_gold_emblem.webp";

interface NavItem {
  icon: any;
  label: string;
  href: string;
  match?: string[];
}

const BASE_NAV_ITEMS: NavItem[] = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/lobby" },
  { icon: Users, label: "Members", href: "/members", match: ["/members"] },
  { icon: Trophy, label: "Games & Tables", href: "/lobby", match: ["/lobby", "/game", "/table"] },
  { icon: Medal, label: "Tournaments", href: "/tournaments", match: ["/tournaments"] },
  { icon: ShoppingBag, label: "Shop", href: "/shop", match: ["/shop"] },
  { icon: Wallet, label: "Wallet", href: "/wallet", match: ["/wallet"] },
  { icon: Search, label: "Browse Clubs", href: "/clubs/browse", match: ["/clubs/browse", "/clubs/create"] },
  { icon: Swords, label: "League & Alliances", href: "/leagues" },
  { icon: BarChart3, label: "Analytics", href: "/analytics" },
];

const ADMIN_NAV_ITEM: NavItem = { icon: Shield, label: "Admin", href: "/admin", match: ["/admin"] };

function ClubSwitcher() {
  const { allClubs, club, switchClub } = useClub();
  const [open, setOpen] = useState(false);

  if (allClubs.length === 0) return null;

  return (
    <div className="px-3 pb-2">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-all hover:bg-white/5 bg-primary/[0.04] border border-primary/10"
      >
        <Shield className="w-3.5 h-3.5 text-primary shrink-0" />
        <span className="flex-1 text-[0.625rem] font-bold text-white truncate tracking-wide">
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
              className="mt-1 rounded-lg py-1 space-y-0.5 bg-surface-low/95 border border-primary/10"
            >
              {allClubs.map((c) => (
                <button
                  key={c.id}
                  onClick={() => { switchClub(c.id); setOpen(false); }}
                  className={`w-full flex items-center gap-2 px-3 py-1.5 text-left transition-all hover:bg-white/5 ${
                    c.id === club?.id ? "bg-primary/10" : ""
                  }`}
                >
                  <span className="flex-1 min-w-0">
                    <span className="block text-[0.625rem] font-medium text-white truncate">{c.name}</span>
                    <span className="block text-[0.5rem] text-gray-400">{c.memberCount} members</span>
                  </span>
                  {c.id === club?.id && (
                    <Check className="w-3 h-3 text-primary shrink-0" />
                  )}
                </button>
              ))}
              <Link href="/clubs/browse">
                <div
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2 px-3 py-1.5 text-[0.5625rem] text-primary hover:text-primary/80 transition-colors cursor-pointer border-t border-white/5 mt-1 pt-1.5"
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

function GlobalSearch() {
  const [query, setQuery] = useState("");
  const [, navigate] = useLocation();

  const handleSearch = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      navigate(`/lobby?search=${encodeURIComponent(query.trim())}`);
      setQuery("");
    }
  }, [query, navigate]);

  return (
    <form onSubmit={handleSearch} className="px-3 pb-2">
      <div className="relative group">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground group-focus-within:text-primary transition-colors" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search tables..."
          className="w-full pl-7 pr-3 py-2 rounded-lg bg-surface-highest/50 border border-white/[0.06] text-[0.625rem] text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/30 focus:bg-surface-highest transition-all"
        />
      </div>
    </form>
  );
}

export function DashboardLayout({ children, title }: { children: ReactNode; title?: string }) {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const { balance, balances } = useWallet();
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const navItems = user?.role === "admin"
    ? [...BASE_NAV_ITEMS, ADMIN_NAV_ITEM]
    : BASE_NAV_ITEMS;

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
          <div className="absolute inset-0 bg-primary/20 blur-lg rounded-full" />
          <img
            src={lionLogo}
            alt="High Rollers"
            className="w-full h-full object-contain relative z-10 drop-shadow-[0_0_8px_hsl(189_100%_75%/0.4)]"
          />
        </div>
        <div className="flex-1">
          <div className="font-display font-bold text-xs tracking-[0.15em] gold-text leading-none">
            HIGH ROLLERS
          </div>
          <div className="text-[0.5rem] text-gray-400 tracking-[0.2em] font-mono mt-0.5">CLUB</div>
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

      {/* Global Search */}
      <GlobalSearch />

      {/* Nav Items */}
      <nav className="flex-1 px-3 py-2 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => {
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
                    ? "bg-primary/10 text-primary border border-primary/20 neon-box-glow"
                    : "text-muted-foreground hover:text-foreground hover:bg-white/5 border border-transparent"
                }`}
              >
                <Icon
                  className={`w-4 h-4 shrink-0 ${
                    isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                  }`}
                />
                <span className="tracking-wide">{item.label}</span>
                {isActive && (
                  <div className="ml-auto w-1.5 h-1.5 rounded-full bg-primary shadow-[0_0_6px_hsl(var(--primary)/0.5)]" />
                )}
              </motion.div>
            </Link>
          );
        })}
      </nav>

      {/* Bottom: Chip Balance + User info */}
      <div className="px-3 pb-4 space-y-2">
        {/* Persistent Chip Balance */}
        <Link href="/wallet">
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-primary/[0.06] border border-primary/10 hover:border-primary/25 hover:bg-primary/10 transition-all cursor-pointer group">
            <div className="w-6 h-6 rounded-md bg-primary/15 flex items-center justify-center shrink-0">
              <Coins className="w-3 h-3 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[0.5rem] text-muted-foreground uppercase tracking-wider font-medium">Total Balance</div>
              <div className="text-xs font-bold text-primary tabular-nums group-hover:text-primary/80 transition-colors">
                {(balance ?? 0).toLocaleString()} <span className="text-[0.5rem] text-primary/60">chips</span>
              </div>
            </div>
          </div>
        </Link>

        {/* User info */}
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-high/50 border border-white/[0.06]">
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
              <div className="text-[0.625rem] font-medium text-foreground/80 truncate cursor-pointer hover:text-foreground transition-colors">
                {user?.displayName || user?.username}
              </div>
            </Link>
            <div className="text-[0.5rem] text-muted-foreground uppercase tracking-wider">
              {user?.role}
            </div>
          </div>
          <button
            onClick={logout}
            className="p-1 hover:bg-white/5 rounded transition-colors"
            title="Logout"
          >
            <LogOut className="w-3 h-3 text-muted-foreground hover:text-foreground" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background text-white flex relative overflow-hidden">
      {/* Background glow orbs */}
      <div className="absolute inset-0 z-0 overflow-hidden">
        <div className="absolute top-[-15%] left-[5%] w-[500px] h-[500px] bg-primary/[0.03] rounded-full blur-[150px]" />
        <div className="absolute bottom-[-10%] right-[8%] w-[400px] h-[400px] bg-purple-600/[0.02] rounded-full blur-[120px]" />
      </div>


      {/* ─── Desktop Sidebar ──────────────────────────────────────── */}
      {!isMobile && (
        <motion.aside
          initial={{ x: -280, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="relative z-10 w-[220px] min-h-screen flex flex-col shrink-0"
        >
          {/* Glass panel */}
          <div className="absolute inset-0 bg-surface-lowest/90 backdrop-blur-xl border-r border-white/[0.06]" />
          <div
            className="absolute inset-y-0 right-0 w-px"
            style={{
              background: "linear-gradient(to bottom, transparent, rgba(129,236,255,0.15) 20%, rgba(129,236,255,0.15) 80%, transparent)",
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
              <div className="absolute inset-0 bg-surface-lowest/95 backdrop-blur-xl border-r border-white/[0.06]" />
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
                <Menu className="w-5 h-5 text-muted-foreground" />
              </button>
            )}
            {title ? (
              <motion.h1
                initial={{ y: -20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="text-base md:text-lg font-display font-bold tracking-wider text-white uppercase"
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

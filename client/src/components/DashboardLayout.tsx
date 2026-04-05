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
import { PageTransition } from "./shared/PageTransition";
import {
  LayoutDashboard, Users, Trophy, ShoppingBag, Swords,
  BarChart3, LogOut, Search, Wallet, Medal,
  Shield, ChevronDown, Check, Menu, X, Coins, Crown, Shirt,
  Store, Handshake, FileSearch, Link as LinkChain, Star
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
  { icon: Star, label: "Loyalty", href: "/loyalty", match: ["/loyalty"] },
  { icon: Wallet, label: "Wallet", href: "/wallet", match: ["/wallet"] },
  { icon: FileSearch, label: "Explorer", href: "/explorer", match: ["/explorer"] },
  { icon: LinkChain, label: "Blockchain", href: "/blockchain", match: ["/blockchain"] },
  { icon: Crown, label: "Premium Table", href: "/premium-table", match: ["/premium-table"] },
  { icon: BarChart3, label: "Multi-Table", href: "/multi-table", match: ["/multi-table"] },
  { icon: Search, label: "Browse Clubs", href: "/clubs/browse", match: ["/clubs/browse", "/clubs/create"] },
  { icon: Swords, label: "League & Alliances", href: "/leagues" },
  { icon: Swords, label: "Club Wars", href: "/club-wars", match: ["/club-wars"] },
  { icon: Store, label: "Marketplace", href: "/marketplace", match: ["/marketplace"] },
  { icon: Handshake, label: "Staking", href: "/stakes", match: ["/stakes"] },
  { icon: Trophy, label: "Club Rankings", href: "/club-rankings", match: ["/club-rankings"] },
  { icon: BarChart3, label: "Analytics", href: "/analytics" },
  { icon: Shirt, label: "Wardrobe", href: "/wardrobe", match: ["/wardrobe"] },
  { icon: Shirt, label: "Avatar Studio", href: "/avatar-customizer", match: ["/avatar-customizer"] },
  { icon: Crown, label: "Premium", href: "/premium", match: ["/premium"] },
  { icon: Shield, label: "Tiers", href: "/tiers", match: ["/tiers"] },
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
  const [searching, setSearching] = useState(false);
  const [, navigate] = useLocation();

  const handleSearch = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      setSearching(true);
      navigate(`/lobby?search=${encodeURIComponent(query.trim())}`);
      setQuery("");
      setTimeout(() => setSearching(false), 600);
    }
  }, [query, navigate]);

  return (
    <form onSubmit={handleSearch} className="px-3 pb-2">
      <div className="relative group">
        {searching ? (
          <div className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        ) : (
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground group-focus-within:text-primary transition-colors" />
        )}
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
          <div className="absolute inset-0 bg-[#c9a84c]/20 blur-lg rounded-full" />
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
                className={`relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-all cursor-pointer group touch-target ${
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="sidebar-active"
                    className="absolute inset-0 rounded-lg bg-primary/10 border border-primary/20"
                    style={{ boxShadow: "0 0 15px rgba(129,236,255,0.15), inset 0 0 10px rgba(129,236,255,0.08)" }}
                    transition={{ type: "spring", stiffness: 350, damping: 30 }}
                  />
                )}
                <Icon
                  className={`relative z-10 w-4 h-4 shrink-0 ${
                    isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                  }`}
                />
                <span className="relative z-10 tracking-wide">{item.label}</span>
                {isActive && (
                  <div className="relative z-10 ml-auto w-1.5 h-1.5 rounded-full bg-primary shadow-[0_0_6px_hsl(var(--primary)/0.5)]" />
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
              <div className="text-xs font-bold tabular-nums transition-colors" style={{ color: "#d4af37" }}>
                {balance === null || balance === undefined ? (
                  <div className="h-4 w-20 rounded bg-primary/10 animate-pulse" />
                ) : (
                  <>{balance.toLocaleString()} <span className="text-[0.5rem]" style={{ color: "rgba(212,175,55,0.6)" }}>chips</span></>
                )}
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
            <div className="flex items-center gap-1.5 text-[0.5rem] text-muted-foreground uppercase tracking-wider">
              <span>{user?.role}</span>
              {(user as any)?.tier && (user as any).tier !== "free" && (
                <span className="px-1.5 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/20 font-bold">
                  {(user as any).tier}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={() => { if (!confirm("Are you sure you want to log out?")) return; logout(); }}
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
          <div
            className="absolute inset-0 border-r border-white/[0.06]"
            style={{
              background: "rgba(10,10,12,0.85)",
              backdropFilter: "blur(20px)",
              borderTop: "2px solid rgba(212,175,55,0.2)",
            }}
          />
          <div
            className="absolute inset-y-0 right-0 w-px"
            style={{
              background: "linear-gradient(to bottom, transparent, rgba(129,236,255,0.15) 20%, rgba(129,236,255,0.15) 80%, transparent)",
            }}
          />
          {sidebarContent}
        </motion.aside>
      )}

      {/* ─── Mobile Sidebar Overlay — swipe-to-close ───────────── */}
      <AnimatePresence>
        {isMobile && sidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
              onClick={() => setSidebarOpen(false)}
            />
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              drag="x"
              dragConstraints={{ left: -280, right: 0 }}
              dragElastic={0.1}
              onDragEnd={(_e, info) => {
                if (info.offset.x < -80 || info.velocity.x < -300) setSidebarOpen(false);
              }}
              className="fixed inset-y-0 left-0 z-50 w-[260px] flex flex-col touch-pan-y"
            >
              <div
                className="absolute inset-0 border-r border-white/[0.06]"
                style={{
                  background: "rgba(10,10,12,0.95)",
                  backdropFilter: "blur(20px)",
                  borderTop: "2px solid rgba(212,175,55,0.2)",
                }}
              />
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
                className="p-2 rounded-lg hover:bg-white/5 transition-colors border border-white/10 touch-target"
              >
                <Menu className="w-5 h-5 text-muted-foreground" />
              </button>
            )}
            {title ? (
              <motion.h1
                initial={{ y: -20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="text-base md:text-lg font-display font-bold tracking-wider uppercase"
                style={{
                  background: "linear-gradient(180deg, #f5e6a3 0%, #d4af37 60%, #c9a84c 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
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
        <PageTransition key={location}>
          {children}
        </PageTransition>
        <FingerprintConsent />
      </main>
    </div>
  );
}

function FingerprintConsent() {
  const [show, setShow] = useState(false);
  useEffect(() => { if (!localStorage.getItem("fp_consent")) setShow(true); }, []);
  if (!show) return null;
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 bg-gray-900/95 backdrop-blur-xl border-t border-white/10">
      <div className="max-w-3xl mx-auto flex items-center gap-4 flex-wrap">
        <p className="text-xs text-gray-300 flex-1">
          We use device fingerprinting to protect your account from unauthorized access and detect fraud.
          This collects a hash of your browser and screen info — no personal data is stored.
        </p>
        <div className="flex gap-2">
          <button onClick={() => { localStorage.setItem("fp_consent", "declined"); setShow(false); }} className="px-3 py-1.5 text-xs text-gray-400 hover:text-white transition-colors">Decline</button>
          <button onClick={() => { localStorage.setItem("fp_consent", "accepted"); setShow(false); }} className="px-4 py-1.5 text-xs font-bold uppercase tracking-wider bg-primary/20 text-primary border border-primary/30 rounded-lg hover:bg-primary/30 transition-colors">Accept</button>
        </div>
      </div>
    </div>
  );
}

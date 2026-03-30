import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { Hexagon, LayoutDashboard, Search, Settings, Trophy, Users, UserCircle } from "lucide-react";
import { useGetCurrentUser } from "@workspace/api-client-react";

export function AppLayout({ children, hideNav = false }: { children: React.ReactNode, hideNav?: boolean }) {
  const [location] = useLocation();
  const { data: user } = useGetCurrentUser();

  const navItems = [
    { href: "/", icon: LayoutDashboard, label: "Lobby" },
    { href: "/clubs", icon: Users, label: "Clubs" },
    { href: "/tournaments", icon: Trophy, label: "Tournaments" },
  ];

  if (hideNav) {
    return <div className="min-h-screen bg-background">{children}</div>;
  }

  return (
    <div className="min-h-screen bg-background flex flex-col relative">
      {/* Top Navigation - Glassmorphic */}
      <header className="fixed top-0 w-full h-20 z-50 glass-ghost border-b border-white/5 px-6 flex items-center justify-between">
        <div className="flex items-center gap-12">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-xl bg-surface-high border border-primary/30 flex items-center justify-center group-hover:neon-border-glow transition-all duration-300">
              <Hexagon className="text-primary w-6 h-6" />
            </div>
            <span className="font-display font-bold text-xl tracking-wider text-white group-hover:neon-text-glow transition-all">STITCH</span>
          </Link>

          <nav className="hidden md:flex items-center gap-2">
            {navItems.map((item) => {
              const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "px-4 py-2 rounded-lg flex items-center gap-2 font-medium transition-all duration-200",
                    isActive 
                      ? "bg-primary/10 text-primary border border-primary/20 neon-box-glow" 
                      : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
                  )}
                >
                  <item.icon className="w-4 h-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-6">
          <div className="hidden lg:flex relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input 
              type="text" 
              placeholder="Search tables..." 
              className="bg-surface-highest/50 border border-white/10 rounded-full pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-primary/50 w-64 transition-all"
            />
          </div>
          
          {user ? (
            <Link href="/profile" className="flex items-center gap-3 glass-panel !p-2 !rounded-full pr-4 hover:border-primary/50 transition-all cursor-pointer">
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-primary to-secondary p-[2px]">
                <img 
                  src={user.avatarUrl || `${import.meta.env.BASE_URL}images/avatar-1.png`} 
                  alt={user.displayName}
                  className="w-full h-full rounded-full object-cover border border-background"
                />
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-bold leading-none">{user.displayName}</span>
                <span className="text-[10px] text-primary font-display">${user.chips.toLocaleString()}</span>
              </div>
            </Link>
          ) : (
            <div className="w-8 h-8 rounded-full bg-surface-high animate-pulse" />
          )}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 pt-20">
        {children}
      </main>
    </div>
  );
}

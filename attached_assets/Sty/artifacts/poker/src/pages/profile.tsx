import { AppLayout } from "@/components/layout/app-layout";
import { GlassCard, NeonButton } from "@/components/ui/neon";
import { useAuth } from "@/hooks/use-auth";
import { formatChips } from "@/lib/utils";
import { Shield, Trophy, Activity, Hexagon } from "lucide-react";
import { motion } from "framer-motion";

export function Profile() {
  const { user, balance, loading } = useAuth();

  if (loading) {
    return <AppLayout><div className="flex justify-center py-20"><div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div></AppLayout>;
  }

  if (!user) return <AppLayout><div className="text-center py-20">Please log in.</div></AppLayout>;

  const gamesPlayed = (user as any).gamesPlayed ?? 0;
  const gamesWon = (user as any).gamesWon ?? 0;
  const level = (user as any).level ?? 1;

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto px-6 py-12">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          
          <GlassCard className="mb-8 relative overflow-hidden p-8 md:p-12 border-t-2 border-primary">
            <div className="absolute top-0 right-0 p-8 opacity-5">
              <Hexagon className="w-64 h-64 text-primary" />
            </div>
            
            <div className="flex flex-col md:flex-row items-center gap-8 relative z-10">
              <div className="w-32 h-32 md:w-40 md:h-40 rounded-2xl bg-surface-lowest border-2 border-primary/50 neon-box-glow p-1 overflow-hidden">
                <img 
                  src={user.avatarUrl || `${import.meta.env.BASE_URL}images/avatar-1.png`} 
                  alt={user.displayName}
                  className="w-full h-full object-cover rounded-xl"
                />
              </div>
              <div className="text-center md:text-left">
                <div className="inline-flex items-center gap-1 px-3 py-1 rounded bg-white/5 border border-white/10 text-xs font-bold uppercase tracking-widest text-primary mb-3">
                  Level {level} Enforcer
                </div>
                <h1 className="text-4xl md:text-5xl font-display font-bold text-white mb-2">{user.displayName}</h1>
                <p className="text-muted-foreground font-mono">@{user.username}</p>
                <div className="mt-6 flex flex-wrap justify-center md:justify-start gap-4">
                  <NeonButton variant="secondary">Edit Profile</NeonButton>
                  <NeonButton variant="ghost">Transaction History</NeonButton>
                </div>
              </div>
            </div>
          </GlassCard>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <GlassCard className="flex flex-col items-center justify-center p-8 text-center border-l-2 border-l-primary">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4 text-primary">
                <Shield className="w-6 h-6" />
              </div>
              <p className="text-sm text-muted-foreground uppercase tracking-widest mb-1">Bankroll</p>
              <p className="text-4xl font-display font-bold text-white">${formatChips(balance)}</p>
            </GlassCard>
            
            <GlassCard className="flex flex-col items-center justify-center p-8 text-center border-l-2 border-l-secondary">
              <div className="w-12 h-12 rounded-full bg-secondary/10 flex items-center justify-center mb-4 text-secondary">
                <Trophy className="w-6 h-6" />
              </div>
              <p className="text-sm text-muted-foreground uppercase tracking-widest mb-1">Win Rate</p>
              <p className="text-4xl font-display font-bold text-white">
                {gamesPlayed > 0 ? Math.round((gamesWon / gamesPlayed) * 100) : 0}%
              </p>
            </GlassCard>

            <GlassCard className="flex flex-col items-center justify-center p-8 text-center border-l-2 border-l-tertiary">
              <div className="w-12 h-12 rounded-full bg-tertiary/10 flex items-center justify-center mb-4 text-tertiary">
                <Activity className="w-6 h-6" />
              </div>
              <p className="text-sm text-muted-foreground uppercase tracking-widest mb-1">Hands Played</p>
              <p className="text-4xl font-display font-bold text-white">{gamesPlayed.toLocaleString()}</p>
            </GlassCard>
          </div>

        </motion.div>
      </div>
    </AppLayout>
  );
}

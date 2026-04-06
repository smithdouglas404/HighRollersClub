import { AppLayout } from "@/components/layout/app-layout";
import { GlassCard, NeonButton } from "@/components/ui/neon";
import { useListTournaments } from "@workspace/api-client-react";
import { formatChips } from "@/lib/utils";
import { Trophy, Clock, Users, Flame, Plus } from "lucide-react";
import { motion } from "framer-motion";
import { Link } from "wouter";

export function Tournaments() {
  const { data: tournaments, isLoading } = useListTournaments();

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-6 py-12">
        
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-12 gap-4">
          <div>
            <h1 className="text-4xl font-display font-bold text-white mb-2 flex items-center gap-3">
              <Trophy className="text-primary w-10 h-10" /> Tournaments
            </h1>
            <p className="text-muted-foreground">High stakes scheduled events. Compete for massive prize pools.</p>
          </div>
          <Link href="/tournaments/new">
            <NeonButton className="gap-2">
              <Plus className="w-4 h-4" /> Create Tournament
            </NeonButton>
          </Link>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {[1,2,3].map(i => (
              <div key={i} className="h-24 glass-panel animate-pulse bg-surface-high/50 rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {tournaments?.map((tourney, i) => (
              <motion.div
                key={tourney.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }}
              >
                <GlassCard className="flex flex-col md:flex-row items-center justify-between gap-6 p-6 hover:border-primary/30 transition-all group">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="px-2 py-1 rounded bg-white/5 border border-white/10 text-[10px] font-bold uppercase tracking-wider text-primary">
                        {tourney.gameType.replace('_', ' ')}
                      </span>
                      {tourney.status === 'registration' && (
                        <span className="flex items-center gap-1 text-xs text-secondary font-bold">
                          <Flame className="w-3 h-3" /> Reg Open
                        </span>
                      )}
                    </div>
                    <h3 className="text-2xl font-display font-bold text-white group-hover:text-primary transition-colors">{tourney.name}</h3>
                    {tourney.startTime && (
                      <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                        <Clock className="w-4 h-4" /> 
                        Starts: {new Date(tourney.startTime).toLocaleString()}
                      </p>
                    )}
                  </div>
                  
                  <div className="flex flex-col md:items-end gap-1 flex-1 md:flex-none">
                    <p className="text-xs text-muted-foreground uppercase tracking-widest">Prize Pool</p>
                    <p className="text-3xl font-display font-bold text-transparent bg-clip-text gradient-primary neon-text-glow">
                      ${formatChips(tourney.prizePool || tourney.buyIn * tourney.maxPlayers)}
                    </p>
                  </div>

                  <div className="flex flex-col md:items-end gap-1 w-full md:w-32 border-t md:border-t-0 md:border-l border-white/10 pt-4 md:pt-0 md:pl-6">
                    <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Buy-in</p>
                    <p className="text-xl font-bold">${formatChips(tourney.buyIn)}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                      <Users className="w-3 h-3" /> {tourney.registeredPlayers}/{tourney.maxPlayers}
                    </p>
                  </div>

                  <div className="w-full md:w-auto mt-4 md:mt-0">
                    <NeonButton className="w-full md:w-auto">
                      Register
                    </NeonButton>
                  </div>
                </GlassCard>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}

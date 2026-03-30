import { AppLayout } from "@/components/layout/app-layout";
import { GlassCard, NeonButton } from "@/components/ui/neon";
import { useListClubs } from "@workspace/api-client-react";
import { Link } from "wouter";
import { formatChips } from "@/lib/utils";
import { Shield, Users, PlusCircle } from "lucide-react";
import { motion } from "framer-motion";

export function Clubs() {
  const { data: clubs, isLoading } = useListClubs();

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-6 py-12">
        
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-12 gap-4">
          <div>
            <h1 className="text-4xl font-display font-bold text-white mb-2">Clubs Hub</h1>
            <p className="text-muted-foreground">Join exclusive syndicates or build your own empire.</p>
          </div>
          <Link href="/clubs/new">
            <NeonButton className="gap-2">
              <PlusCircle className="w-5 h-5" />
              Create Club
            </NeonButton>
          </Link>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1,2,3,4].map(i => (
              <div key={i} className="h-64 glass-panel animate-pulse bg-surface-high/50 rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {clubs?.map((club, i) => (
              <motion.div
                key={club.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.1 }}
              >
                <Link href={`/clubs/${club.id}`}>
                  <GlassCard className="group hover:-translate-y-1 transition-all duration-300 cursor-pointer h-full p-0 overflow-hidden border-white/5 hover:border-primary/30">
                    
                    <div className="h-32 w-full relative overflow-hidden bg-surface-highest">
                      <img 
                        src={club.imageUrl || `${import.meta.env.BASE_URL}images/club-cover.png`} 
                        alt={club.name}
                        className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity duration-500 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-surface-highest to-transparent" />
                      {club.isPrivate && (
                        <div className="absolute top-4 right-4 bg-background/80 backdrop-blur-md px-2 py-1 rounded text-xs font-bold border border-white/10 flex items-center gap-1">
                          <Shield className="w-3 h-3 text-tertiary" /> Private
                        </div>
                      )}
                    </div>
                    
                    <div className="p-6 pt-2">
                      <h3 className="text-2xl font-display font-bold text-white mb-1 group-hover:text-primary transition-colors">{club.name}</h3>
                      <p className="text-sm text-muted-foreground line-clamp-2 mb-6 h-10">
                        {club.description || "An exclusive underground poker syndicate."}
                      </p>
                      
                      <div className="grid grid-cols-2 gap-4 border-t border-white/10 pt-4">
                        <div>
                          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Members</p>
                          <p className="font-bold flex items-center gap-2">
                            <Users className="w-4 h-4 text-primary" />
                            {club.memberCount}/{club.maxMembers}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Avg Buy-in</p>
                          <p className="font-bold font-display text-secondary">
                            ${formatChips(club.chipBuyIn || 1000)}
                          </p>
                        </div>
                      </div>
                    </div>
                  </GlassCard>
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}

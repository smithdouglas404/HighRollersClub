import { useState } from "react";
import { Target, Gamepad2, Coins, Zap, Trophy, Users, Clock, TrendingUp, Loader2 } from "lucide-react";
import type { MissionData } from "@/lib/club-context";

const MISSION_ICON_MAP: Record<string, any> = {
  hands_played: Gamepad2,
  pots_won: Coins,
  win_streak: Target,
  consecutive_wins: TrendingUp,
  sng_win: Clock,
  bomb_pot: Target,
  heads_up_win: Users,
};

const MISSION_BADGE_MAP: Record<string, string> = {
  hands_played: "/badges/badge_iron_player.webp",
  pots_won: "/badges/badge_first_win.webp",
  win_streak: "/badges/badge_streak_fire.webp",
  consecutive_wins: "/badges/badge_streak_fire.webp",
  sng_win: "/badges/badge_tournament_champ.webp",
  bomb_pot: "/badges/badge_high_roller.webp",
  heads_up_win: "/badges/badge_bluff_master.webp",
  royal_flush: "/badges/badge_royal_flush.webp",
  club_legend: "/badges/badge_club_legend.webp",
};

interface MissionsGridProps {
  missions: MissionData[];
  maxVisible?: number;
  showHeader?: boolean;
  completedCount?: number;
  onClaim?: (missionId: string) => Promise<boolean>;
}

export function MissionsGrid({ missions, maxVisible = 6, showHeader, completedCount, onClaim }: MissionsGridProps) {
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  if (missions.length === 0) {
    return (
      <div className="text-center py-4">
        <Target className="w-6 h-6 text-gray-700 mx-auto mb-2" />
        <p className="text-[0.6875rem] text-gray-600">No missions available</p>
      </div>
    );
  }

  return (
    <>
      {showHeader && (
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400">
            Daily Missions
          </h3>
          {completedCount != null && (
            <span className="text-[0.5625rem] text-amber-400 font-bold uppercase tracking-wider">
              {completedCount}/{missions.length} Complete
            </span>
          )}
        </div>
      )}
      <div className="grid grid-cols-3 gap-3">
        {(showAll ? missions : missions.slice(0, maxVisible)).map((mission) => {
          const Icon = MISSION_ICON_MAP[mission.type] || Target;
          const badgeUrl = MISSION_BADGE_MAP[mission.type];
          const progressPct = Math.min(Math.round((mission.progress / mission.target) * 100), 100);
          return (
            <div key={mission.id} className="text-center">
              <div className={`w-10 h-10 rounded-lg ${mission.completed ? "bg-green-500/15 border-green-500/20" : "bg-amber-500/10 border-amber-500/15"} border flex items-center justify-center mx-auto mb-2 overflow-hidden`}>
                {badgeUrl ? (
                  <img
                    src={badgeUrl}
                    alt={mission.label}
                    className={`w-10 h-10 object-cover ${mission.completed ? "" : "opacity-60 grayscale"}`}
                  />
                ) : (
                  <Icon className={`w-4 h-4 ${mission.completed ? "text-green-400" : "text-amber-400"}`} />
                )}
              </div>
              <div className="text-[0.625rem] font-medium text-gray-300 mb-1">{mission.label}</div>
              <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden mb-1">
                <div
                  className={`h-full rounded-full transition-all ${mission.completed ? "bg-gradient-to-r from-green-500 to-emerald-400" : "bg-gradient-to-r from-amber-500 to-green-500"}`}
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <div className="text-[0.5625rem] text-gray-500">
                {mission.progress}/{mission.target}
                {mission.completed
                  ? mission.claimed
                    ? <span className="text-gray-500 ml-1">Claimed</span>
                    : onClaim
                      ? (
                        <button
                          onClick={() => {
                            if (claimingId) return;
                            setClaimingId(mission.id);
                            onClaim(mission.id).finally(() => setClaimingId(null));
                          }}
                          disabled={claimingId === mission.id}
                          className="ml-1 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-green-500/20 text-green-400 font-bold uppercase tracking-wider hover:bg-green-500/30 transition-colors disabled:opacity-50"
                        >
                          {claimingId === mission.id
                            ? <Loader2 className="w-2.5 h-2.5 animate-spin" />
                            : <>Claim +{mission.reward}</>
                          }
                        </button>
                      )
                      : <span className="text-green-400 ml-1">Done!</span>
                  : <span className="text-amber-400 ml-1">+{mission.reward}</span>
                }
              </div>
            </div>
          );
        })}
      </div>
      {!showAll && missions.length > maxVisible && (
        <div className="flex justify-center mt-3">
          <button
            onClick={() => setShowAll(true)}
            className="text-xs font-bold text-primary hover:text-primary/80 transition-colors uppercase tracking-wider"
          >
            View All Missions ({missions.length})
          </button>
        </div>
      )}
    </>
  );
}

import { Target, Gamepad2, Coins, Zap, Trophy, Users, Clock, TrendingUp } from "lucide-react";
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

interface MissionsGridProps {
  missions: MissionData[];
  maxVisible?: number;
  showHeader?: boolean;
  completedCount?: number;
}

export function MissionsGrid({ missions, maxVisible = 6, showHeader, completedCount }: MissionsGridProps) {
  if (missions.length === 0) {
    return (
      <div className="text-center py-4">
        <Target className="w-6 h-6 text-gray-700 mx-auto mb-2" />
        <p className="text-[11px] text-gray-600">No missions available</p>
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
            <span className="text-[9px] text-cyan-400 font-bold uppercase tracking-wider">
              {completedCount}/{missions.length} Complete
            </span>
          )}
        </div>
      )}
      <div className="grid grid-cols-3 gap-3">
        {missions.slice(0, maxVisible).map((mission) => {
          const Icon = MISSION_ICON_MAP[mission.type] || Target;
          const progressPct = Math.min(Math.round((mission.progress / mission.target) * 100), 100);
          return (
            <div key={mission.id} className="text-center">
              <div className={`w-10 h-10 rounded-lg ${mission.completed ? "bg-green-500/15 border-green-500/20" : "bg-cyan-500/10 border-cyan-500/15"} border flex items-center justify-center mx-auto mb-2`}>
                <Icon className={`w-4 h-4 ${mission.completed ? "text-green-400" : "text-cyan-400"}`} />
              </div>
              <div className="text-[10px] font-medium text-gray-300 mb-1">{mission.label}</div>
              <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden mb-1">
                <div
                  className={`h-full rounded-full transition-all ${mission.completed ? "bg-gradient-to-r from-green-500 to-emerald-400" : "bg-gradient-to-r from-cyan-500 to-green-500"}`}
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <div className="text-[9px] text-gray-500">
                {mission.progress}/{mission.target}
                {mission.completed
                  ? mission.claimed
                    ? <span className="text-gray-500 ml-1">Claimed</span>
                    : <span className="text-green-400 ml-1">Done!</span>
                  : <span className="text-amber-400 ml-1">+{mission.reward}</span>
                }
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

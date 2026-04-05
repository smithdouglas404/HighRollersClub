import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Swords, Clock, Zap, Trophy, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

interface ClubWar {
  id: string;
  club1Id: string;
  club2Id: string;
  club1Name: string;
  club2Name: string;
  status: string;
  winnerId: string | null;
  club1Score: number;
  club2Score: number;
  club1Elo: number | null;
  club2Elo: number | null;
  eloChange: number | null;
  scheduledAt: string;
  completedAt: string | null;
  createdAt: string;
}

function Countdown({ target }: { target: string }) {
  const [timeLeft, setTimeLeft] = useState("");
  useEffect(() => {
    const update = () => {
      const diff = new Date(target).getTime() - Date.now();
      if (diff <= 0) { setTimeLeft("Starting..."); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setTimeLeft(`${h}h ${m}m ${s}s`);
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [target]);
  return <span className="font-mono text-primary text-xs">{timeLeft}</span>;
}

export default function ClubWars() {
  const { user } = useAuth();
  const [wars, setWars] = useState<ClubWar[]>([]);
  const [loading, setLoading] = useState(true);
  const [matchmaking, setMatchmaking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchWars = () => {
    setError(null);
    fetch("/api/club-wars", { credentials: "include" })
      .then(r => {
        if (!r.ok) throw new Error("Failed to load club wars");
        return r.json();
      })
      .then(data => { if (Array.isArray(data)) setWars(data); })
      .catch(err => setError(err.message || "Failed to load club wars"))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchWars(); }, []);

  const upcoming = wars.filter(w => w.status === "pending");
  const active = wars.filter(w => w.status === "active");
  const completed = wars.filter(w => w.status === "completed");

  const requestMatchmaking = async () => {
    setMatchmaking(true);
    setError(null);
    try {
      const res = await fetch("/api/club-wars/matchmake", { method: "POST", credentials: "include" });
      if (!res.ok) {
        const d = await res.json().catch(() => ({ message: "Matchmaking failed" }));
        setError(d.message || "Matchmaking failed");
        return;
      }
      fetchWars();
    } catch {
      setError("Matchmaking request failed");
    } finally { setMatchmaking(false); }
  };

  return (
    <DashboardLayout title="Club Wars">
      <div className="px-4 md:px-8 py-6 max-w-5xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center">
              <Swords className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Club Wars</h2>
              <p className="text-xs text-gray-400">Compete for ELO supremacy</p>
            </div>
          </div>
          {user?.role === "admin" && (
            <button
              onClick={requestMatchmaking}
              disabled={matchmaking}
              className="px-4 py-2 rounded-lg bg-primary/20 border border-primary/30 text-primary text-xs font-medium hover:bg-primary/30 transition-colors disabled:opacity-50"
            >
              {matchmaking ? <Loader2 className="w-4 h-4 animate-spin" /> : "Request Matchmaking"}
            </button>
          )}
        </div>

        {error && (
          <div className="px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-medium">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : (
          <>
            {/* Upcoming */}
            <section>
              <h3 className="flex items-center gap-2 text-sm font-semibold text-white mb-3">
                <Clock className="w-4 h-4 text-yellow-400" /> Upcoming ({upcoming.length})
              </h3>
              {upcoming.length === 0 ? (
                <p className="text-xs text-gray-500">No upcoming wars</p>
              ) : (
                <div className="grid gap-3">
                  {upcoming.map(w => (
                    <div key={w.id} className="p-4 rounded-xl bg-surface-high/50 border border-white/[0.06]">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-bold text-white">{w.club1Name}</span>
                          <Swords className="w-4 h-4 text-gray-500" />
                          <span className="text-sm font-bold text-white">{w.club2Name}</span>
                        </div>
                        <Countdown target={w.scheduledAt} />
                      </div>
                      <div className="mt-2 flex gap-4 text-[0.625rem] text-gray-400">
                        <span>ELO: {w.club1Elo ?? 1200}</span>
                        <span>vs</span>
                        <span>ELO: {w.club2Elo ?? 1200}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Active */}
            <section>
              <h3 className="flex items-center gap-2 text-sm font-semibold text-white mb-3">
                <Zap className="w-4 h-4 text-green-400" /> Active ({active.length})
              </h3>
              {active.length === 0 ? (
                <p className="text-xs text-gray-500">No active wars</p>
              ) : (
                <div className="grid gap-3">
                  {active.map(w => (
                    <div key={w.id} className="p-4 rounded-xl bg-surface-high/50 border border-green-500/20">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-white">{w.club1Name}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-lg font-bold text-primary">{w.club1Score}</span>
                          <span className="text-gray-500">-</span>
                          <span className="text-lg font-bold text-primary">{w.club2Score}</span>
                        </div>
                        <span className="text-sm font-bold text-white">{w.club2Name}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Completed */}
            <section>
              <h3 className="flex items-center gap-2 text-sm font-semibold text-white mb-3">
                <Trophy className="w-4 h-4 text-yellow-400" /> Completed ({completed.length})
              </h3>
              {completed.length === 0 ? (
                <p className="text-xs text-gray-500">No completed wars</p>
              ) : (
                <div className="grid gap-3">
                  {completed.map(w => (
                    <div key={w.id} className="p-4 rounded-xl bg-surface-high/50 border border-white/[0.06]">
                      <div className="flex items-center justify-between">
                        <span className={`text-sm font-bold ${w.winnerId === w.club1Id ? "text-green-400" : "text-gray-400"}`}>
                          {w.club1Name}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-lg font-bold text-white">{w.club1Score}</span>
                          <span className="text-gray-500">-</span>
                          <span className="text-lg font-bold text-white">{w.club2Score}</span>
                        </div>
                        <span className={`text-sm font-bold ${w.winnerId === w.club2Id ? "text-green-400" : "text-gray-400"}`}>
                          {w.club2Name}
                        </span>
                      </div>
                      {w.eloChange != null && (
                        <div className="mt-2 text-center text-[0.625rem] text-gray-400">
                          ELO Change: <span className={w.eloChange > 0 ? "text-green-400" : "text-red-400"}>
                            {w.eloChange > 0 ? "+" : ""}{w.eloChange}
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}

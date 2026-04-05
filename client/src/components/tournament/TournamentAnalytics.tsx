import { useState, useEffect } from "react";
import { DollarSign, Users, Trophy, Gamepad2, Target, Loader2, Crown, Medal, Award } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

interface TournamentAnalyticsProps {
  tournamentId: string;
}

function formatChips(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

const PAYOUT_COLORS = ["#d4af37", "#c0c0c0", "#cd7f32", "#3b82f6", "#a855f7", "#22c55e", "#ef4444", "#f59e0b"];

export function TournamentAnalytics({ tournamentId }: TournamentAnalyticsProps) {
  const [tourney, setTourney] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/tournaments/${tournamentId}`).then(r => r.ok ? r.json() : null)
      .then(setTourney).catch(() => {}).finally(() => setLoading(false));
  }, [tournamentId]);

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  if (!tourney) return <p className="text-gray-500 text-center py-8">Tournament not found</p>;

  const prizePool = tourney.buyIn * (tourney.registeredCount || tourney.maxPlayers);
  const clubRake = Math.round(prizePool * ((tourney.rakePercent || 0) / 100));
  const netPrize = prizePool - clubRake;
  const payoutStructure: Array<{ place: number; percentage: number }> = tourney.payoutStructure || [
    { place: 1, percentage: 50 }, { place: 2, percentage: 30 }, { place: 3, percentage: 20 },
  ];
  const payoutData = payoutStructure.map(p => ({ name: `${p.place}${p.place === 1 ? "st" : p.place === 2 ? "nd" : p.place === 3 ? "rd" : "th"}`, value: p.percentage }));

  return (
    <div className="space-y-6">
      {/* Financial Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-xl border border-white/10 bg-surface-high/30 p-4 text-center">
          <DollarSign className="w-5 h-5 text-green-400 mx-auto mb-1" />
          <div className="text-xl font-black text-green-400">{formatChips(prizePool)}</div>
          <div className="text-[10px] text-gray-500 uppercase">Total Buy-ins</div>
        </div>
        <div className="rounded-xl border border-white/10 bg-surface-high/30 p-4 text-center">
          <Trophy className="w-5 h-5 text-amber-400 mx-auto mb-1" />
          <div className="text-xl font-black text-amber-400">{formatChips(netPrize)}</div>
          <div className="text-[10px] text-gray-500 uppercase">Net Prize Pool</div>
        </div>
        <div className="rounded-xl border border-white/10 bg-surface-high/30 p-4 text-center">
          <Target className="w-5 h-5 text-purple-400 mx-auto mb-1" />
          <div className="text-xl font-black text-purple-400">{formatChips(clubRake)}</div>
          <div className="text-[10px] text-gray-500 uppercase">Club Rake</div>
        </div>
        <div className="rounded-xl border border-white/10 bg-surface-high/30 p-4 text-center">
          <Users className="w-5 h-5 text-cyan-400 mx-auto mb-1" />
          <div className="text-xl font-black text-cyan-400">{tourney.registeredCount || 0}/{tourney.maxPlayers}</div>
          <div className="text-[10px] text-gray-500 uppercase">Players</div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Payout Table */}
        <div className="rounded-xl border border-white/10 bg-surface-high/30 p-4">
          <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2"><Trophy className="w-4 h-4 text-amber-400" /> Payout Structure</h3>
          <div className="space-y-1.5">
            {payoutStructure.map((p, i) => {
              const amount = Math.round(netPrize * (p.percentage / 100));
              return (
                <div key={p.place} className="flex items-center justify-between px-3 py-2 rounded-lg" style={{ background: "rgba(255,255,255,0.03)" }}>
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black" style={{ background: PAYOUT_COLORS[i] + "20", color: PAYOUT_COLORS[i] }}>
                      {p.place}
                    </span>
                    <span className="text-xs text-gray-300">{p.place === 1 ? "1st Place" : p.place === 2 ? "2nd Place" : p.place === 3 ? "3rd Place" : `${p.place}th Place`}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-bold text-white">{formatChips(amount)}</span>
                    <span className="text-[10px] text-gray-500 ml-2">{p.percentage}%</span>
                  </div>
                </div>
              );
            })}
          </div>
          {payoutStructure.length > 0 && (
            <div className="mt-2 pt-2 border-t border-white/5 flex justify-between px-3 text-xs">
              <span className="text-gray-500">1st Place Prize</span>
              <span className="text-amber-400 font-black text-lg">{formatChips(Math.round(netPrize * (payoutStructure[0].percentage / 100)))}</span>
            </div>
          )}
        </div>

        {/* Distribution Pie Chart */}
        <div className="rounded-xl border border-white/10 bg-surface-high/30 p-4">
          <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2"><Gamepad2 className="w-4 h-4 text-cyan-400" /> Prize Distribution</h3>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={payoutData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={65} innerRadius={35} strokeWidth={0}
                label={({ name, value }: any) => `${name}: ${value}%`}>
                {payoutData.map((_, i) => <Cell key={i} fill={PAYOUT_COLORS[i % PAYOUT_COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ background: "rgba(10,14,22,0.95)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Tournament Leaderboard Podium */}
      <TournamentPodium tournamentId={tournamentId} />
    </div>
  );
}

// ─── Podium Visual ──────────────────────────────────────────────────────────

function TournamentPodium({ tournamentId }: { tournamentId: string }) {
  const [standings, setStandings] = useState<any[]>([]);

  useEffect(() => {
    fetch(`/api/tournaments/${tournamentId}/standings`).then(r => r.ok ? r.json() : [])
      .then(setStandings).catch(() => {});
  }, [tournamentId]);

  if (standings.length === 0) return null;

  const top3 = standings.slice(0, 3);
  const rest = standings.slice(3);

  const podiumIcons = [Crown, Medal, Award];
  const podiumColors = ["#d4af37", "#c0c0c0", "#cd7f32"];
  const podiumHeights = ["h-28", "h-20", "h-16"];

  return (
    <div className="rounded-xl border border-white/10 bg-surface-high/30 p-4">
      <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2"><Trophy className="w-4 h-4 text-amber-400" /> Tournament Standings</h3>

      {/* Podium — top 3 */}
      <div className="flex items-end justify-center gap-4 mb-6 px-4">
        {[1, 0, 2].map(idx => {
          const player = top3[idx];
          if (!player) return <div key={idx} className="w-24" />;
          const Icon = podiumIcons[idx];
          return (
            <div key={idx} className="flex flex-col items-center">
              <Icon className="w-6 h-6 mb-1" style={{ color: podiumColors[idx] }} />
              <div className="w-12 h-12 rounded-full border-2 mb-1 overflow-hidden flex items-center justify-center text-xs font-black text-white" style={{ borderColor: podiumColors[idx], background: "rgba(255,255,255,0.05)" }}>
                {(player.displayName || player.username || "?")[0].toUpperCase()}
              </div>
              <span className="text-[10px] text-white font-bold truncate max-w-[80px] text-center">{player.displayName || player.username}</span>
              <span className="text-[10px] font-bold mt-0.5" style={{ color: podiumColors[idx] }}>{formatChips(player.chips || player.totalChips || 0)}</span>
              <div className={`w-20 ${podiumHeights[idx]} rounded-t-lg mt-1 flex items-center justify-center`} style={{ background: `linear-gradient(to top, ${podiumColors[idx]}15, ${podiumColors[idx]}30)`, border: `1px solid ${podiumColors[idx]}40` }}>
                <span className="text-2xl font-black" style={{ color: podiumColors[idx] }}>{idx + 1}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Rest of standings */}
      {rest.length > 0 && (
        <div className="space-y-1">
          {rest.map((p: any, i: number) => (
            <div key={p.userId || i} className="flex items-center justify-between px-3 py-1.5 rounded text-xs" style={{ background: "rgba(255,255,255,0.02)" }}>
              <div className="flex items-center gap-2">
                <span className="text-gray-500 font-mono w-5">{i + 4}</span>
                <span className="text-white font-bold">{p.displayName || p.username}</span>
              </div>
              <span className="text-gray-400">{formatChips(p.chips || p.totalChips || 0)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

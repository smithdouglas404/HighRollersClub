import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Handshake, Loader2, ArrowRight, Check, XCircle } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

interface Stake {
  id: string;
  backerId: string;
  playerId: string;
  tournamentId: string;
  stakePercent: number;
  buyInShare: number;
  status: string;
  payout: number | null;
  createdAt: string;
}

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-500/20 text-yellow-400",
  accepted: "bg-blue-500/20 text-blue-400",
  active: "bg-green-500/20 text-green-400",
  settled: "bg-gray-500/20 text-gray-400",
  cancelled: "bg-red-500/20 text-red-400",
};

export default function Stakes() {
  const { user } = useAuth();
  const [stakes, setStakes] = useState<Stake[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchStakes = () => {
    fetch("/api/stakes/my", { credentials: "include" })
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setStakes(data); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchStakes(); }, []);

  const handleAction = async (id: string, action: string) => {
    await fetch(`/api/stakes/${id}/${action}`, { method: "POST", credentials: "include" });
    fetchStakes();
  };

  const backerStakes = stakes.filter(s => s.backerId === user?.id);
  const playerStakes = stakes.filter(s => s.playerId === user?.id);

  return (
    <DashboardLayout title="Staking">
      <div className="px-4 md:px-8 py-6 max-w-5xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
            <Handshake className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Staking</h2>
            <p className="text-xs text-gray-400">Back players in tournaments or get backed</p>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : (
          <>
            {/* As Backer */}
            <section>
              <h3 className="text-sm font-semibold text-white mb-3">As Backer ({backerStakes.length})</h3>
              {backerStakes.length === 0 ? (
                <p className="text-xs text-gray-500">No stakes as backer</p>
              ) : (
                <div className="grid gap-3">
                  {backerStakes.map(s => (
                    <div key={s.id} className="p-4 rounded-xl bg-surface-high/50 border border-white/[0.06]">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-gray-400">Player: {s.playerId.slice(0, 8)}...</span>
                          <ArrowRight className="w-3 h-3 text-gray-600" />
                          <span className="text-xs text-gray-400">Tournament: {s.tournamentId.slice(0, 8)}...</span>
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-[0.5rem] font-bold uppercase ${STATUS_COLORS[s.status] ?? "bg-gray-500/20 text-gray-400"}`}>
                          {s.status}
                        </span>
                      </div>
                      <div className="mt-2 flex gap-6 text-[0.625rem] text-gray-400">
                        <span>Stake: {s.stakePercent}%</span>
                        <span>Buy-in Share: {s.buyInShare.toLocaleString()} chips</span>
                        {s.payout != null && <span>Payout: {s.payout.toLocaleString()} chips</span>}
                      </div>
                      {(s.status === "pending" || s.status === "accepted") && (
                        <div className="mt-3 flex gap-2">
                          <button
                            onClick={() => handleAction(s.id, "cancel")}
                            className="flex items-center gap-1 px-3 py-1 rounded-lg bg-red-500/20 text-red-400 text-[0.625rem] hover:bg-red-500/30"
                          >
                            <XCircle className="w-3 h-3" /> Cancel
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* As Player */}
            <section>
              <h3 className="text-sm font-semibold text-white mb-3">As Player ({playerStakes.length})</h3>
              {playerStakes.length === 0 ? (
                <p className="text-xs text-gray-500">No stakes as player</p>
              ) : (
                <div className="grid gap-3">
                  {playerStakes.map(s => (
                    <div key={s.id} className="p-4 rounded-xl bg-surface-high/50 border border-white/[0.06]">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-gray-400">Backer: {s.backerId.slice(0, 8)}...</span>
                          <ArrowRight className="w-3 h-3 text-gray-600" />
                          <span className="text-xs text-gray-400">Tournament: {s.tournamentId.slice(0, 8)}...</span>
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-[0.5rem] font-bold uppercase ${STATUS_COLORS[s.status] ?? "bg-gray-500/20 text-gray-400"}`}>
                          {s.status}
                        </span>
                      </div>
                      <div className="mt-2 flex gap-6 text-[0.625rem] text-gray-400">
                        <span>Stake: {s.stakePercent}%</span>
                        <span>Buy-in Share: {s.buyInShare.toLocaleString()} chips</span>
                        {s.payout != null && <span>Payout: {s.payout.toLocaleString()} chips</span>}
                      </div>
                      <div className="mt-3 flex gap-2">
                        {s.status === "pending" && (
                          <>
                            <button
                              onClick={() => handleAction(s.id, "accept")}
                              className="flex items-center gap-1 px-3 py-1 rounded-lg bg-green-500/20 text-green-400 text-[0.625rem] hover:bg-green-500/30"
                            >
                              <Check className="w-3 h-3" /> Accept
                            </button>
                            <button
                              onClick={() => handleAction(s.id, "cancel")}
                              className="flex items-center gap-1 px-3 py-1 rounded-lg bg-red-500/20 text-red-400 text-[0.625rem] hover:bg-red-500/30"
                            >
                              <XCircle className="w-3 h-3" /> Decline
                            </button>
                          </>
                        )}
                        {s.status === "accepted" && (
                          <button
                            onClick={() => handleAction(s.id, "cancel")}
                            className="flex items-center gap-1 px-3 py-1 rounded-lg bg-red-500/20 text-red-400 text-[0.625rem] hover:bg-red-500/30"
                          >
                            <XCircle className="w-3 h-3" /> Cancel
                          </button>
                        )}
                      </div>
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

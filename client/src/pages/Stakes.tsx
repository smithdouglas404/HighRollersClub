import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { GoldButton, GoldCard, SectionHeader } from "@/components/premium/PremiumComponents";
import { Handshake, Loader2, ArrowRight, Check, XCircle, Plus, X, DollarSign } from "lucide-react";
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
  backerName?: string;
  playerName?: string;
  tournamentName?: string;
  tournamentStatus?: string;
}

interface Tournament {
  id: string;
  name: string;
  buyIn: number;
  status: string;
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
  const [showOfferModal, setShowOfferModal] = useState(false);
  const [showSettleModal, setShowSettleModal] = useState<string | null>(null);
  const [settleAmount, setSettleAmount] = useState("");

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

  const handleSettle = async (id: string) => {
    const payout = parseInt(settleAmount, 10);
    if (isNaN(payout) || payout < 0) return;
    await fetch(`/api/stakes/${id}/settle`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ payout }),
    });
    setShowSettleModal(null);
    setSettleAmount("");
    fetchStakes();
  };

  const backerStakes = stakes.filter(s => s.backerId === user?.id);
  const playerStakes = stakes.filter(s => s.playerId === user?.id);

  return (
    <DashboardLayout title="Staking">
      <div className="px-4 md:px-8 py-6 max-w-5xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
              <Handshake className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Staking</h2>
              <p className="text-xs text-gray-400">Back players in tournaments or get backed</p>
            </div>
          </div>
          <button
            onClick={() => setShowOfferModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-500 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Offer Stake
          </button>
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
                          <span className="text-xs text-gray-400">Player: {s.playerName ?? s.playerId.slice(0, 8)}</span>
                          <ArrowRight className="w-3 h-3 text-gray-600" />
                          <span className="text-xs text-gray-400">Tournament: {s.tournamentName ?? s.tournamentId.slice(0, 8)}</span>
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
                        {(s.status === "accepted" || s.status === "active") && s.tournamentStatus === "complete" && (
                          <button
                            onClick={() => { setShowSettleModal(s.id); setSettleAmount(""); }}
                            className="flex items-center gap-1 px-3 py-1 rounded-lg bg-green-500/20 text-green-400 text-[0.625rem] hover:bg-green-500/30"
                          >
                            <DollarSign className="w-3 h-3" /> Settle
                          </button>
                        )}
                        {(s.status === "pending" || s.status === "accepted") && (
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
                          <span className="text-xs text-gray-400">Backer: {s.backerName ?? s.backerId.slice(0, 8)}</span>
                          <ArrowRight className="w-3 h-3 text-gray-600" />
                          <span className="text-xs text-gray-400">Tournament: {s.tournamentName ?? s.tournamentId.slice(0, 8)}</span>
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

      {/* Offer Stake Modal */}
      {showOfferModal && (
        <OfferStakeModal onClose={() => setShowOfferModal(false)} onCreated={fetchStakes} />
      )}

      {/* Settle Modal */}
      {showSettleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-gray-900 rounded-xl border border-white/10 p-6 w-full max-w-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white">Settle Stake</h3>
              <button onClick={() => setShowSettleModal(null)} className="text-gray-500 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Total Tournament Payout (chips)</label>
              <input
                type="number"
                min="0"
                value={settleAmount}
                onChange={(e) => setSettleAmount(e.target.value)}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
                placeholder="Enter total payout amount"
              />
            </div>
            <button
              onClick={() => handleSettle(showSettleModal)}
              disabled={!settleAmount || parseInt(settleAmount) < 0}
              className="w-full py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Confirm Settlement
            </button>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

function OfferStakeModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [selectedTournament, setSelectedTournament] = useState<Tournament | null>(null);
  const [playerUsername, setPlayerUsername] = useState("");
  const [stakePercent, setStakePercent] = useState(50);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/tournaments", { credentials: "include" })
      .then(r => r.json())
      .then((data: Tournament[]) => {
        const eligible = data.filter(t => t.status === "upcoming" || t.status === "registering");
        setTournaments(eligible);
      })
      .catch(() => {});
  }, []);

  const buyInShare = selectedTournament
    ? Math.ceil(selectedTournament.buyIn * (stakePercent / 100))
    : 0;

  const handleSubmit = async () => {
    if (!selectedTournament || !playerUsername.trim()) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/stakes/offer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          playerId: playerUsername.trim(),
          tournamentId: selectedTournament.id,
          stakePercent,
          buyInShare,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Failed to create stake offer");
      }
      onCreated();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-gray-900 rounded-xl border border-white/10 p-6 w-full max-w-md space-y-5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white">Offer a Stake</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tournament Selector */}
        <div>
          <label className="block text-xs text-gray-400 mb-1">Tournament</label>
          <select
            value={selectedTournament?.id ?? ""}
            onChange={(e) => {
              const t = tournaments.find(t => t.id === e.target.value);
              setSelectedTournament(t ?? null);
            }}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
          >
            <option value="">Select a tournament...</option>
            {tournaments.map(t => (
              <option key={t.id} value={t.id}>
                {t.name} (Buy-in: {t.buyIn.toLocaleString()})
              </option>
            ))}
          </select>
          {tournaments.length === 0 && (
            <p className="text-[0.625rem] text-gray-500 mt-1">No upcoming tournaments available</p>
          )}
        </div>

        {/* Player ID / Username */}
        <div>
          <label className="block text-xs text-gray-400 mb-1">Player ID or Username</label>
          <input
            type="text"
            value={playerUsername}
            onChange={(e) => setPlayerUsername(e.target.value)}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
            placeholder="Enter player ID or username"
          />
        </div>

        {/* Stake Percentage */}
        <div>
          <label className="block text-xs text-gray-400 mb-1">
            Stake Percentage: {stakePercent}%
          </label>
          <input
            type="range"
            min="10"
            max="100"
            step="5"
            value={stakePercent}
            onChange={(e) => setStakePercent(parseInt(e.target.value))}
            className="w-full accent-blue-500"
          />
          <div className="flex justify-between text-[0.625rem] text-gray-500 mt-1">
            <span>10%</span>
            <span>100%</span>
          </div>
        </div>

        {/* Calculated Buy-in Share */}
        {selectedTournament && (
          <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
            <div className="flex justify-between text-xs">
              <span className="text-gray-400">Buy-in</span>
              <span className="text-white">{selectedTournament.buyIn.toLocaleString()} chips</span>
            </div>
            <div className="flex justify-between text-xs mt-1">
              <span className="text-gray-400">Your share ({stakePercent}%)</span>
              <span className="text-blue-400 font-bold">{buyInShare.toLocaleString()} chips</span>
            </div>
          </div>
        )}

        {error && (
          <p className="text-xs text-red-400">{error}</p>
        )}

        <button
          onClick={handleSubmit}
          disabled={!selectedTournament || !playerUsername.trim() || submitting}
          className="w-full py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Handshake className="w-4 h-4" />}
          Confirm Offer
        </button>
      </div>
    </div>
  );
}

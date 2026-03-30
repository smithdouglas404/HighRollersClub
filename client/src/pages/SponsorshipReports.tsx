import { useState } from "react";
import { motion } from "framer-motion";
import { DashboardLayout } from "@/components/DashboardLayout";
import {
  DollarSign, Calendar, Users, Download,
  CheckCircle2, Clock, TrendingUp
} from "lucide-react";

/* ── Mock Data ──────────────────────────────────────────────── */

const SUMMARY = {
  totalPaidOut: 24_750,
  nextPayoutDate: "Apr 15, 2026",
  activeSponsors: 8,
};

interface PayoutRow {
  id: string;
  date: string;
  recipient: string;
  amount: number;
  status: "Completed" | "Pending";
}

const PAYOUT_HISTORY: PayoutRow[] = [
  { id: "1", date: "Mar 28, 2026", recipient: "AceHighClub",    amount: 5000,  status: "Completed" },
  { id: "2", date: "Mar 28, 2026", recipient: "RoyalFlushGG",   amount: 3200,  status: "Completed" },
  { id: "3", date: "Mar 15, 2026", recipient: "DiamondLounge",  amount: 4500,  status: "Completed" },
  { id: "4", date: "Mar 15, 2026", recipient: "HighStakesHQ",   amount: 2800,  status: "Completed" },
  { id: "5", date: "Apr 01, 2026", recipient: "NeonPokerClub",  amount: 3750,  status: "Pending" },
  { id: "6", date: "Apr 01, 2026", recipient: "TheGrindHouse",  amount: 2500,  status: "Pending" },
  { id: "7", date: "Apr 15, 2026", recipient: "VaultElite",     amount: 1800,  status: "Pending" },
  { id: "8", date: "Apr 15, 2026", recipient: "CryptoFelts",    amount: 1200,  status: "Pending" },
];

/* ── Summary Card ───────────────────────────────────────────── */

function SummaryCard({
  icon: Icon,
  label,
  value,
  index,
}: {
  icon: any;
  label: string;
  value: string;
  index: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.07 }}
      className="relative overflow-hidden rounded-xl p-5 bg-surface-high/50 backdrop-blur-xl border border-[#c9a84c]/20"
    >
      {/* Gold glow accent */}
      <div className="absolute top-0 right-0 w-24 h-24 bg-[#d4af37]/10 blur-3xl rounded-full opacity-40" />
      <div className="relative">
        <div className="w-10 h-10 rounded-lg bg-[#d4af37]/10 border border-[#c9a84c]/20 flex items-center justify-center mb-3">
          <Icon className="w-5 h-5 text-[#d4af37]" />
        </div>
        <div className="text-2xl font-bold text-[#f0d478] tracking-tight">{value}</div>
        <div className="text-[0.5625rem] text-gray-500 uppercase tracking-wider mt-0.5">{label}</div>
      </div>
    </motion.div>
  );
}

/* ── Main Component ─────────────────────────────────────────── */

export default function SponsorshipReports() {
  const [filter, setFilter] = useState<"All" | "Completed" | "Pending">("All");

  const filteredHistory =
    filter === "All"
      ? PAYOUT_HISTORY
      : PAYOUT_HISTORY.filter((r) => r.status === filter);

  const handleExport = () => {
    // UI-only placeholder
  };

  return (
    <DashboardLayout title="Sponsorship Reports">
      <div className="px-4 md:px-8 pb-8 space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-4"
        >
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#9a7b2c]/20 to-[#d4af37]/20 border border-[#c9a84c]/25 flex items-center justify-center">
            <TrendingUp className="w-6 h-6 text-[#d4af37]" />
          </div>
          <div>
            <h2 className="text-lg font-display font-bold text-white tracking-tight">
              Sponsorship Payouts
            </h2>
            <p className="text-[0.625rem] text-muted-foreground">
              Track sponsor payouts, upcoming distributions, and financial history.
            </p>
          </div>
        </motion.div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <SummaryCard
            icon={DollarSign}
            label="Total Paid Out"
            value={`${SUMMARY.totalPaidOut.toLocaleString()} chips`}
            index={0}
          />
          <SummaryCard
            icon={Calendar}
            label="Next Payout Date"
            value={SUMMARY.nextPayoutDate}
            index={1}
          />
          <SummaryCard
            icon={Users}
            label="Active Sponsors"
            value={String(SUMMARY.activeSponsors)}
            index={2}
          />
        </div>

        {/* Payout History Table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="rounded-xl overflow-hidden bg-surface-high/50 backdrop-blur-xl border border-[#c9a84c]/15"
        >
          {/* Table header */}
          <div className="px-5 py-3.5 border-b border-[#c9a84c]/10 flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-[#c9a84c]/80" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#c9a84c]/70">
                Payout History
              </h3>
            </div>

            <div className="flex items-center gap-2">
              {/* Filter pills */}
              {(["All", "Completed", "Pending"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3 py-1.5 rounded-lg text-[0.625rem] font-bold uppercase tracking-wider transition-all ${
                    filter === f
                      ? "bg-[#d4af37]/15 text-[#f0d478] border border-[#c9a84c]/30"
                      : "bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10"
                  }`}
                >
                  {f}
                </button>
              ))}

              {/* Export button */}
              <button
                onClick={handleExport}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[0.625rem] font-bold uppercase tracking-wider bg-[#d4af37]/10 text-[#d4af37] border border-[#c9a84c]/25 hover:bg-[#d4af37]/20 transition-all"
              >
                <Download className="w-3 h-3" />
                Export
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-white/[0.04]">
                  <th className="px-5 py-3 text-[0.5625rem] font-bold uppercase tracking-wider text-gray-500">
                    Date
                  </th>
                  <th className="px-5 py-3 text-[0.5625rem] font-bold uppercase tracking-wider text-gray-500">
                    Recipient
                  </th>
                  <th className="px-5 py-3 text-[0.5625rem] font-bold uppercase tracking-wider text-gray-500 text-right">
                    Amount
                  </th>
                  <th className="px-5 py-3 text-[0.5625rem] font-bold uppercase tracking-wider text-gray-500 text-right">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredHistory.map((row, i) => (
                  <motion.tr
                    key={row.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.25 + i * 0.03 }}
                    className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors"
                  >
                    <td className="px-5 py-3.5 text-xs text-gray-400 font-mono">
                      {row.date}
                    </td>
                    <td className="px-5 py-3.5 text-sm font-medium text-white">
                      {row.recipient}
                    </td>
                    <td className="px-5 py-3.5 text-sm font-bold text-[#f0d478] text-right tabular-nums">
                      {row.amount.toLocaleString()} <span className="text-[0.5625rem] text-[#c9a84c]/60">chips</span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      {row.status === "Completed" ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-green-500/10 text-green-400 text-[0.5625rem] font-bold border border-green-500/20">
                          <CheckCircle2 className="w-3 h-3" />
                          Completed
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-amber-500/10 text-amber-400 text-[0.5625rem] font-bold border border-amber-500/20">
                          <Clock className="w-3 h-3" />
                          Pending
                        </span>
                      )}
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>

            {filteredHistory.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <DollarSign className="w-8 h-8 text-gray-600 mb-3" />
                <p className="text-xs text-gray-500">No payouts match the current filter.</p>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </DashboardLayout>
  );
}

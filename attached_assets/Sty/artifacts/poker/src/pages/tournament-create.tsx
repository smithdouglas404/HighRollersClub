import { useState } from "react";
import { useCreateTournament, CreateTournamentInputGameType } from "@workspace/api-client-react";
import { useLocation, Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Save, X, Lock, ChevronDown, Calendar as CalIcon } from "lucide-react";

const BASE = import.meta.env.BASE_URL;
const TABS = ["General", "Structure", "Financials", "Rules"] as const;

interface TournamentConfig {
  name: string;
  gameType: string;
  buyIn: number;
  registrationFee: number;
  startingChips: number;
  blindLevelMinutes: number;
  guaranteedPrize: number;
  payoutStructure: string;
  adminFee: string;
  lateRegistration: boolean;
  numberOfLevels: number;
  scheduledDate: string;
  registrationClose: string;
  autoAway: boolean;
  timeBank: string;
  operatingHours: string;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[11px] text-white/50 mb-1.5 font-medium">{label}</label>
      {children}
    </div>
  );
}

function Input({ value, prefix, className, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { prefix?: string }) {
  return (
    <div className="relative">
      {prefix && (
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 text-sm font-display">{prefix}</span>
      )}
      <input
        value={value}
        className={cn(
          "w-full px-3 py-2.5 bg-[#141410] border border-white/[0.08] rounded text-white text-sm font-display",
          "focus:outline-none focus:border-[#c9a84c]/40 transition-colors",
          prefix && "pl-7",
          className
        )}
        {...props}
      />
    </div>
  );
}

function Select({ value, options, className }: { value: string; options: string[]; className?: string }) {
  return (
    <div className={cn("relative", className)}>
      <select
        value={value}
        className="w-full px-3 py-2.5 bg-[#141410] border border-white/[0.08] rounded text-white text-sm font-display appearance-none focus:outline-none focus:border-[#c9a84c]/40 transition-colors pr-8"
        readOnly
      >
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30 pointer-events-none" />
    </div>
  );
}

function Toggle({ checked }: { checked: boolean }) {
  return (
    <div className={cn(
      "w-10 h-5 rounded-full relative cursor-pointer transition-colors",
      checked ? "bg-[#c9a84c]" : "bg-white/15"
    )}>
      <div className={cn(
        "absolute top-0.5 w-4 h-4 rounded-full transition-all",
        checked ? "right-0.5 bg-[#1a1208]" : "left-0.5 bg-white/50"
      )} />
    </div>
  );
}

export function TournamentCreate() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const createTournament = useCreateTournament();
  const [activeTab, setActiveTab] = useState<typeof TABS[number]>("General");

  const [config] = useState<TournamentConfig>({
    name: "High Rollers Weekly Championship",
    gameType: "texas_holdem",
    buyIn: 10000,
    registrationFee: 500,
    startingChips: 100000,
    blindLevelMinutes: 15,
    guaranteedPrize: 1000000,
    payoutStructure: "Top 15% (Standard)",
    adminFee: "5%",
    lateRegistration: true,
    numberOfLevels: 6,
    scheduledDate: "Oct 26, 2024 - 18:00 UTC",
    registrationClose: "Oct 26, 2024 - 19:30 UTC",
    autoAway: true,
    timeBank: "60s total, 5s per hand",
    operatingHours: "18:00 - 04:00 UTC",
  });

  const handleCreate = async () => {
    try {
      await createTournament.mutateAsync({
        data: {
          name: config.name,
          gameType: config.gameType as CreateTournamentInputGameType,
          buyIn: config.buyIn,
          startingChips: config.startingChips,
          maxPlayers: 50,
          blindLevelMinutes: config.blindLevelMinutes,
        },
      });
      toast({ title: "Tournament Created", description: "Registration is now open." });
      setLocation("/tournaments");
    } catch (error: unknown) {
      toast({ title: "Error", description: error instanceof Error ? error.message : "Failed to create tournament", variant: "destructive" });
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a06]">

      <nav className="flex items-center justify-between px-8 py-3.5 border-b border-white/[0.06] bg-[#0e0e08]">
        <Link href="/">
          <div className="flex items-center gap-3 cursor-pointer">
            <img src={`${BASE}images/high-rollers-crest.png`} alt="" className="w-8 h-8 object-contain" />
            <span className="font-display font-bold text-white text-sm tracking-wide">High Rollers Club</span>
          </div>
        </Link>
        <div className="flex items-center gap-8">
          <Link href="/tournaments">
            <span className="text-[#c9a84c] font-display font-bold text-sm border-b-2 border-[#c9a84c] pb-1 cursor-pointer">Tournaments</span>
          </Link>
          <Link href="/">
            <span className="text-white/50 font-display text-sm hover:text-white/80 transition-colors cursor-pointer">Cash Games</span>
          </Link>
          <span className="text-white/50 font-display text-sm hover:text-white/80 transition-colors cursor-pointer">Members</span>
          <div className="w-8 h-8 rounded-full bg-white/10 border border-white/[0.08] flex items-center justify-center ml-2">
            <ChevronDown className="w-3 h-3 text-white/50" />
          </div>
        </div>
      </nav>

      <div className="px-8 py-6">

        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-display font-black text-white italic">
            Comprehensive Tournament Setup
          </h1>
          <div className="flex items-center gap-3">
            <button
              onClick={handleCreate}
              disabled={createTournament.isPending}
              className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[#c9a84c] to-[#8a6e2a] text-[#1a1208] font-display font-bold text-sm rounded hover:from-[#f0d48a] hover:to-[#c9a84c] transition-all border border-[#f0d48a]/30 shadow-lg disabled:opacity-50"
            >
              <Save className="w-4 h-4" /> Save & Publish
            </button>
            <Link href="/tournaments">
              <button className="px-5 py-2.5 bg-[#1a1a12]/80 border border-white/[0.08] text-white/60 font-display font-bold text-sm rounded hover:text-white hover:bg-white/5 transition-all">
                Cancel
              </button>
            </Link>
          </div>
        </div>

        <div className="flex gap-1 mb-6 bg-[#12120e] border border-white/[0.06] rounded p-1">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "flex-1 py-2.5 font-display font-bold text-sm rounded transition-all",
                activeTab === tab
                  ? "bg-gradient-to-b from-[#c9a84c] to-[#8a6e2a] text-[#1a1208] shadow-lg"
                  : "text-white/40 hover:text-white/70 hover:bg-white/[0.03]"
              )}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="flex gap-6">

          <div className="flex-1 grid grid-cols-4 gap-6 items-start">

            <div className="bg-[#12120e]/80 border border-white/[0.06] rounded p-5">
              <h3 className="font-display font-bold text-white text-sm mb-5 tracking-wide">Basic Information</h3>
              <div className="space-y-4">
                <Field label="Tournament Name">
                  <Input value={config.name} readOnly />
                </Field>
                <Field label="Start Date & Time">
                  <div className="relative">
                    <Input value={config.scheduledDate} readOnly className="pr-8" />
                    <CalIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
                  </div>
                </Field>
              </div>

              <h3 className="font-display font-bold text-white text-sm mt-6 mb-4 tracking-wide">Entry & Registration</h3>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Buy-in Amount">
                    <Input value="10,000" prefix="$" readOnly />
                  </Field>
                  <Field label="Registration Fee">
                    <Input value="500" readOnly />
                  </Field>
                </div>
                <Field label="Registration Close Time">
                  <Select value={config.registrationClose} options={[config.registrationClose]} />
                </Field>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-white/50 font-medium">Late Registration</span>
                  <Toggle checked={config.lateRegistration} />
                </div>
                <Field label="Number of Levels">
                  <Select value="6" options={["6", "8", "10", "12"]} />
                </Field>
              </div>
            </div>

            <div className="bg-[#12120e]/80 border border-white/[0.06] rounded p-5">
              <h3 className="font-display font-bold text-white text-sm mb-5 tracking-wide">Structure</h3>
              <div className="space-y-4">
                <Field label="Starting Stack">
                  <Input value="100,000 chips" readOnly />
                </Field>
                <Field label="Blind Level Increase Interval">
                  <Select value="Every 15 mins" options={["Every 10 mins", "Every 15 mins", "Every 20 mins", "Every 30 mins"]} />
                </Field>
                <Field label="Break Schedule">
                  <button className="w-full px-3 py-2.5 bg-[#1a1a12] border border-[#c9a84c]/20 rounded text-[#c9a84c] text-sm font-display font-medium hover:bg-[#c9a84c]/10 transition-colors text-left">
                    Add Break
                  </button>
                </Field>
              </div>
            </div>

            <div className="bg-[#12120e]/80 border border-white/[0.06] rounded p-5">
              <h3 className="font-display font-bold text-white text-sm mb-5 tracking-wide">Financials</h3>
              <div className="space-y-4">
                <Field label="Payout Structure">
                  <Select value={config.payoutStructure} options={["Top 15% (Standard)", "Top 10%", "Top 20%", "Winner Take All"]} />
                </Field>
                <Field label="Guaranteed Prize">
                  <Input value="$1,000,000" readOnly />
                </Field>
                <Field label="Admin Fee">
                  <Input value="5%" readOnly />
                </Field>
              </div>
            </div>

            <div className="bg-[#12120e]/80 border border-white/[0.06] rounded p-5">
              <h3 className="font-display font-bold text-white text-sm mb-5 tracking-wide">Rules</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-white/50 font-medium">Auto-Away on 2x Timeout</span>
                  <Toggle checked={config.autoAway} />
                </div>
                <Field label="Time Bank">
                  <Select value={config.timeBank} options={["60s total, 5s per hand", "30s total, 3s per hand", "90s total, 8s per hand"]} />
                </Field>
                <Field label="Operating Hours">
                  <Select value={config.operatingHours} options={["18:00 - 04:00 UTC", "00:00 - 24:00 UTC", "20:00 - 06:00 UTC"]} />
                </Field>
              </div>
            </div>
          </div>

          <div className="w-[220px] shrink-0 sticky top-6 self-start">
            <div className="bg-[#1a1810]/90 border border-[#c9a84c]/20 rounded p-5">
              <h3 className="font-display font-bold text-[#f0d48a] text-base mb-4 italic">Tournament Summary</h3>
              <div className="space-y-2.5">
                {[
                  { label: "Est. Prize Pool:", value: "$1,000,000+" },
                  { label: "Total Buy-in:", value: "$10,500" },
                  { label: "Starting Chips:", value: "100,000" },
                  { label: "Blind Levels:", value: "15 mins" },
                ].map((row) => (
                  <div key={row.label} className="flex items-center justify-between">
                    <span className="text-[11px] text-white/50">{row.label}</span>
                    <span className="text-xs font-display font-bold text-white">{row.value}</span>
                  </div>
                ))}
                <div className="flex items-center justify-between pt-1">
                  <span className="text-[11px] text-white/50">Status:</span>
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-[#c9a84c]/15 border border-[#c9a84c]/25 rounded-full text-[10px] font-bold text-[#c9a84c]">
                    Draft <Lock className="w-2.5 h-2.5" />
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

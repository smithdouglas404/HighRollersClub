import { useState } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { GlassCard, NeonButton, GhostInput } from "@/components/ui/neon";
import { useGetClub, useGetClubMembers } from "@workspace/api-client-react";
import { Link, useParams } from "wouter";
import { formatChips } from "@/lib/utils";
import { cn } from "@/lib/utils";
import {
  Shield,
  Users,
  ArrowLeft,
  Crown,
  Star,
  Settings,
  Activity,
  Layers,
  TrendingUp,
  UserPlus,
  MoreVertical,
  Search,
  Calendar,
} from "lucide-react";
import { motion } from "framer-motion";

const TABS = ["overview", "members", "tables", "activity", "settings"];

export function ClubDetail() {
  const { id } = useParams<{ id: string }>();
  const clubId = parseInt(id || "0");
  const { data: club, isLoading } = useGetClub(clubId);
  const { data: members } = useGetClubMembers(clubId);
  const [activeTab, setActiveTab] = useState("overview");
  const [memberSearch, setMemberSearch] = useState("");

  if (isLoading) {
    return (
      <AppLayout>
        <div className="max-w-6xl mx-auto px-6 py-12">
          <div className="h-64 bg-surface-high/40 backdrop-blur-xl animate-pulse rounded-md" />
        </div>
      </AppLayout>
    );
  }

  if (!club) {
    return (
      <AppLayout>
        <div className="max-w-6xl mx-auto px-6 py-12 text-center">
          <h1 className="text-3xl font-display font-bold text-white mb-4">Club Not Found</h1>
          <Link href="/clubs">
            <NeonButton>Back to Clubs</NeonButton>
          </Link>
        </div>
      </AppLayout>
    );
  }

  const filteredMembers = members?.filter(
    (m) =>
      m.displayName.toLowerCase().includes(memberSearch.toLowerCase()) ||
      m.username.toLowerCase().includes(memberSearch.toLowerCase())
  );

  const mockActivity = [
    { type: "join", user: "NeonAce", time: "2 hours ago", detail: "joined the club" },
    { type: "game", user: "Bluff Master", time: "4 hours ago", detail: "won $2,500 at Neon Blitz" },
    { type: "game", user: "River Rat", time: "6 hours ago", detail: "started a new table: High Stakes PLO" },
    { type: "join", user: "Chip Queen", time: "1 day ago", detail: "was promoted to Admin" },
    { type: "game", user: "Pocket Rockets", time: "1 day ago", detail: "won the Club Championship ($15k)" },
  ];

  const mockTables = [
    { name: "Club Cash Game #1", type: "Texas Hold'em", stakes: "5/10", players: "4/6", status: "live" },
    { name: "PLO Thursday", type: "Omaha", stakes: "10/20", players: "6/9", status: "live" },
    { name: "Members Only", type: "Short Deck", stakes: "25/50", players: "0/6", status: "waiting" },
  ];

  const roleIcon = (role: string) => {
    if (role === "owner") return <Crown className="w-3.5 h-3.5 text-yellow-400" />;
    if (role === "admin") return <Star className="w-3.5 h-3.5 text-primary" />;
    return null;
  };

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto px-6 py-6">
        <Link href="/clubs" className="inline-flex items-center gap-2 text-muted-foreground hover:text-white transition-colors mb-5 text-sm">
          <ArrowLeft className="w-4 h-4" />
          Back to Clubs
        </Link>

        <div className="relative rounded-md overflow-hidden mb-6">
          <div className="h-44 w-full relative">
            <img
              src={club.imageUrl || `${import.meta.env.BASE_URL}images/club-cover.png`}
              alt={club.name}
              className="w-full h-full object-cover opacity-40"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-surface-lowest via-surface-lowest/60 to-transparent" />
          </div>
          <div className="absolute bottom-0 left-0 right-0 p-6">
            <div className="flex items-end justify-between">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <h1 className="text-3xl md:text-4xl font-display font-bold text-white">{club.name}</h1>
                  {club.isPrivate && (
                    <span className="px-2 py-0.5 rounded-full bg-destructive/10 border border-destructive/20 text-destructive text-[10px] font-bold uppercase tracking-widest flex items-center gap-1">
                      <Shield className="w-3 h-3" /> Private
                    </span>
                  )}
                </div>
                <p className="text-muted-foreground text-sm max-w-lg">{club.description || "An exclusive underground poker syndicate."}</p>
              </div>
              <div className="flex gap-2">
                <NeonButton variant="secondary" size="sm" className="gap-1.5">
                  <UserPlus className="w-4 h-4" /> Invite
                </NeonButton>
                <NeonButton size="sm" className="gap-1.5">
                  <Settings className="w-4 h-4" /> Manage
                </NeonButton>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-3 mb-6">
          {[
            { label: "Members", value: `${club.memberCount}/${club.maxMembers}`, icon: Users, color: "text-primary" },
            { label: "Buy-in", value: `$${formatChips(club.chipBuyIn || 1000)}`, icon: TrendingUp, color: "text-secondary" },
            { label: "Active Tables", value: "3", icon: Layers, color: "text-primary" },
            { label: "Owner", value: club.ownerUsername, icon: Crown, color: "text-yellow-400" },
          ].map((stat, i) => (
            <div key={i} className="bg-surface-high/50 backdrop-blur-xl rounded-md p-4 border border-white/[0.06]">
              <div className="flex items-center gap-2 mb-1">
                <stat.icon className={cn("w-4 h-4", stat.color)} />
                <span className="text-[10px] text-muted-foreground uppercase tracking-widest">{stat.label}</span>
              </div>
              <p className="font-display font-bold text-white text-lg">{stat.value}</p>
            </div>
          ))}
        </div>

        <div className="flex gap-1 mb-6 bg-surface-low/30 rounded-md p-1 border border-white/[0.04]">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "flex-1 py-2 rounded-md text-xs font-bold uppercase tracking-wider transition-all capitalize",
                activeTab === tab
                  ? "bg-primary/15 text-primary border border-primary/20"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {tab}
            </button>
          ))}
        </div>

        {activeTab === "overview" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              <h3 className="font-display font-bold text-white text-lg flex items-center gap-2">
                <Layers className="w-4 h-4 text-primary" /> Club Tables
              </h3>
              {mockTables.map((t, i) => (
                <div key={i} className="bg-surface-high/50 backdrop-blur-xl rounded-md p-4 border border-white/[0.06] flex items-center justify-between hover:border-primary/20 transition-all cursor-pointer">
                  <div>
                    <h4 className="font-display font-bold text-white text-sm">{t.name}</h4>
                    <p className="text-xs text-muted-foreground">{t.type} • Stakes: {t.stakes}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Users className="w-3 h-3" /> {t.players}
                    </span>
                    <span className={cn(
                      "text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full",
                      t.status === "live" ? "bg-secondary/10 text-secondary" : "bg-white/5 text-muted-foreground"
                    )}>
                      {t.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-4">
              <h3 className="font-display font-bold text-white text-lg flex items-center gap-2">
                <Activity className="w-4 h-4 text-primary" /> Recent Activity
              </h3>
              <div className="bg-surface-high/50 backdrop-blur-xl rounded-md border border-white/[0.06] divide-y divide-white/[0.04]">
                {mockActivity.slice(0, 4).map((act, i) => (
                  <div key={i} className="p-3 flex items-start gap-3">
                    <div className={cn(
                      "w-7 h-7 rounded-full flex items-center justify-center mt-0.5",
                      act.type === "join" ? "bg-secondary/10 text-secondary" : "bg-primary/10 text-primary"
                    )}>
                      {act.type === "join" ? <UserPlus className="w-3 h-3" /> : <Layers className="w-3 h-3" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white">
                        <span className="font-bold">{act.user}</span>{" "}
                        <span className="text-muted-foreground">{act.detail}</span>
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1">
                        <Calendar className="w-2.5 h-2.5" /> {act.time}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === "members" && (
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search members..."
                  className="w-full bg-surface-high/50 border border-white/[0.06] rounded-md pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-primary/30 transition-all"
                  value={memberSearch}
                  onChange={(e) => setMemberSearch(e.target.value)}
                />
              </div>
              <NeonButton size="sm" className="gap-1.5">
                <UserPlus className="w-4 h-4" /> Invite Member
              </NeonButton>
            </div>

            <div className="bg-surface-high/40 backdrop-blur-xl rounded-md border border-white/[0.06] overflow-hidden">
              <div className="grid grid-cols-[1fr_100px_100px_40px] gap-4 px-4 py-2 border-b border-white/[0.04] text-[10px] text-muted-foreground uppercase tracking-widest font-bold">
                <span>Player</span>
                <span>Role</span>
                <span>Chips</span>
                <span></span>
              </div>
              {(filteredMembers || []).map((member, i) => (
                <motion.div
                  key={member.username}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.03 }}
                  className="grid grid-cols-[1fr_100px_100px_40px] gap-4 px-4 py-3 items-center border-b border-white/[0.02] last:border-0 hover:bg-white/[0.02] transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-md bg-surface-lowest border border-primary/20 overflow-hidden flex items-center justify-center shrink-0">
                      {member.avatarUrl ? (
                        <img src={member.avatarUrl} alt={member.displayName} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-primary font-bold text-xs">{member.displayName[0]}</span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-white text-sm truncate">{member.displayName}</p>
                      <p className="text-[10px] text-muted-foreground truncate">@{member.username}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {roleIcon(member.role)}
                    <span className="text-xs capitalize text-muted-foreground">{member.role}</span>
                  </div>
                  <span className="text-sm font-display font-bold text-secondary">
                    {member.chips ? `$${formatChips(member.chips)}` : "—"}
                  </span>
                  <button className="w-7 h-7 rounded-md bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors">
                    <MoreVertical className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {activeTab === "tables" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-display font-bold text-white text-lg">Club Tables</h3>
              <NeonButton size="sm" className="gap-1.5">
                <Layers className="w-4 h-4" /> Create Table
              </NeonButton>
            </div>
            {mockTables.map((t, i) => (
              <div key={i} className="bg-surface-high/50 backdrop-blur-xl rounded-md p-5 border border-white/[0.06] flex items-center justify-between hover:border-primary/20 transition-all cursor-pointer">
                <div>
                  <h4 className="font-display font-bold text-white">{t.name}</h4>
                  <p className="text-xs text-muted-foreground mt-1">{t.type} • Stakes: {t.stakes}</p>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                    <Users className="w-4 h-4" /> {t.players}
                  </span>
                  <span className={cn(
                    "text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full",
                    t.status === "live" ? "bg-secondary/10 text-secondary" : "bg-white/5 text-muted-foreground"
                  )}>
                    {t.status}
                  </span>
                  <NeonButton size="sm" variant={t.status === "live" ? "primary" : "secondary"}>
                    {t.status === "live" ? "Join" : "Open"}
                  </NeonButton>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === "activity" && (
          <div className="space-y-3">
            {mockActivity.map((act, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="bg-surface-high/50 backdrop-blur-xl rounded-md p-4 border border-white/[0.06] flex items-center gap-4"
              >
                <div className={cn(
                  "w-9 h-9 rounded-md flex items-center justify-center",
                  act.type === "join" ? "bg-secondary/10 text-secondary" : "bg-primary/10 text-primary"
                )}>
                  {act.type === "join" ? <UserPlus className="w-4 h-4" /> : <Layers className="w-4 h-4" />}
                </div>
                <div className="flex-1">
                  <p className="text-sm text-white">
                    <span className="font-bold">{act.user}</span>{" "}
                    <span className="text-muted-foreground">{act.detail}</span>
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{act.time}</p>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {activeTab === "settings" && (
          <div className="max-w-lg space-y-6">
            <GhostInput label="Club Name" defaultValue={club.name} />
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-muted-foreground">Description</label>
              <textarea
                className="w-full bg-surface-highest/50 border-b-2 border-white/10 rounded-t-md px-4 py-3 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary transition-all duration-300 resize-none h-24"
                defaultValue={club.description || ""}
              />
            </div>
            <GhostInput type="number" label="Max Members" defaultValue={club.maxMembers} />
            <GhostInput type="number" label="Standard Buy-in ($)" defaultValue={club.chipBuyIn || 1000} />
            <div className="pt-4 border-t border-white/[0.04] flex justify-end gap-3">
              <NeonButton variant="ghost">Cancel</NeonButton>
              <NeonButton>Save Changes</NeonButton>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}

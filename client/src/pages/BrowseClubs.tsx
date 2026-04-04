import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useAuth } from "@/lib/auth-context";
import { useClub, type ClubData, type ClubInvitation } from "@/lib/club-context";
import { CLUB_LOGO_OPTIONS } from "@/pages/ClubDashboard";
import {
  Search, Users, Globe, Lock, Loader2, CalendarDays,
  UserPlus, Clock, FolderSearch, ArrowUpDown, Trophy,
  TrendingUp, Zap, Crown, Star, SortAsc,
} from "lucide-react";

interface PublicClub extends ClubData {
  memberCount: number;
}

type SortOption = "members" | "newest" | "alphabetical";

const SORT_OPTIONS: { value: SortOption; label: string; icon: typeof Users }[] = [
  { value: "members", label: "Most Members", icon: Users },
  { value: "newest", label: "Newest First", icon: CalendarDays },
  { value: "alphabetical", label: "A–Z", icon: SortAsc },
];

function getClubLogo(club: PublicClub) {
  if (club.avatarUrl) return club.avatarUrl;
  const match = CLUB_LOGO_OPTIONS.find(o => club.name.toLowerCase().includes(o.id));
  return match?.url ?? null;
}

function getClubAccentColor(index: number) {
  const colors = [
    { from: "rgba(212,175,55,0.5)", to: "rgba(212,175,55,0.1)", glow: "rgba(212,175,55,0.15)" },
    { from: "rgba(168,85,247,0.5)", to: "rgba(168,85,247,0.1)", glow: "rgba(168,85,247,0.15)" },
    { from: "rgba(34,197,94,0.5)", to: "rgba(34,197,94,0.1)", glow: "rgba(34,197,94,0.15)" },
    { from: "rgba(245,158,11,0.5)", to: "rgba(245,158,11,0.1)", glow: "rgba(245,158,11,0.15)" },
    { from: "rgba(239,68,68,0.5)", to: "rgba(239,68,68,0.1)", glow: "rgba(239,68,68,0.15)" },
    { from: "rgba(59,130,246,0.5)", to: "rgba(59,130,246,0.1)", glow: "rgba(59,130,246,0.15)" },
  ];
  return colors[index % colors.length];
}

export default function BrowseClubs() {
  const { user } = useAuth();
  const { allClubs: myClubs, joinClub, requestJoinClub, reload } = useClub();

  const [allClubs, setAllClubs] = useState<PublicClub[]>([]);
  const [pendingRequests, setPendingRequests] = useState<ClubInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>("members");

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const [clubsRes, pendingRes] = await Promise.all([
          fetch("/api/clubs"),
          fetch("/api/clubs/my-pending-requests"),
        ]);
        if (clubsRes.ok) {
          setAllClubs(await clubsRes.json());
        }
        if (pendingRes.ok) {
          setPendingRequests(await pendingRes.json());
        }
      } catch {
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [user?.id]);

  const pendingClubIds = useMemo(
    () => new Set(pendingRequests.map((r) => r.clubId)),
    [pendingRequests]
  );

  const sortedAndFilteredClubs = useMemo(() => {
    let result = [...allClubs];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          (c.description && c.description.toLowerCase().includes(q))
      );
    }
    switch (sortBy) {
      case "members":
        result.sort((a, b) => b.memberCount - a.memberCount);
        break;
      case "newest":
        result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        break;
      case "alphabetical":
        result.sort((a, b) => a.name.localeCompare(b.name));
        break;
    }
    return result;
  }, [allClubs, searchQuery, sortBy]);

  const featuredClubs = useMemo(() => {
    if (allClubs.length < 3) return [];
    return [...allClubs]
      .sort((a, b) => b.memberCount - a.memberCount)
      .slice(0, 3);
  }, [allClubs]);

  const featuredIds = useMemo(() => new Set(featuredClubs.map(c => c.id)), [featuredClubs]);

  const handleJoin = async (clubId: string, isPublic: boolean) => {
    setJoiningId(clubId);
    try {
      if (isPublic) {
        const ok = await joinClub(clubId);
        if (ok) {
          await reload();
          const clubsRes = await fetch("/api/clubs");
          if (clubsRes.ok) setAllClubs(await clubsRes.json());
        }
      } else {
        const ok = await requestJoinClub(clubId);
        if (ok) {
          setPendingRequests((prev) => [
            ...prev,
            {
              id: "temp-" + clubId,
              clubId,
              userId: user?.id ?? "",
              username: user?.username ?? "",
              displayName: user?.displayName ?? "",
              avatarId: user?.avatarId ?? null,
              type: "request",
              status: "pending",
              createdAt: new Date().toISOString(),
            },
          ]);
        }
      }
    } finally {
      setJoiningId(null);
    }
  };

  const isTrending = (club: PublicClub) => {
    const created = new Date(club.createdAt);
    const daysSinceCreation = (Date.now() - created.getTime()) / (1000 * 60 * 60 * 24);
    return daysSinceCreation < 14 && club.memberCount >= 2;
  };

  const cardVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: (i: number) => ({
      opacity: 1,
      y: 0,
      transition: { delay: i * 0.06, duration: 0.4, ease: "easeOut" as const },
    }),
  };

  const renderClubAvatar = (club: PublicClub, size: "sm" | "lg" = "sm") => {
    const logo = getClubLogo(club);
    const dim = size === "lg" ? "w-14 h-14" : "w-10 h-10";
    const textSize = size === "lg" ? "text-xl" : "text-sm";

    if (logo) {
      return (
        <div className={`${dim} rounded-xl overflow-hidden flex-shrink-0 ring-1 ring-white/10`}>
          <img src={logo} alt={club.name} className="w-full h-full object-cover" />
        </div>
      );
    }
    return (
      <div
        className={`${dim} rounded-xl flex items-center justify-center flex-shrink-0 ${textSize} font-black text-white/80 bg-white/[0.03] border border-white/[0.06]`}
      >
        {club.name.charAt(0).toUpperCase()}
      </div>
    );
  };

  const renderActionButton = (club: PublicClub) => {
    const isPending = pendingClubIds.has(club.id);
    const isMyClub = myClubs.some(c => c.id === club.id);

    if (isMyClub) {
      return (
        <div
          data-testid={`status-member-${club.id}`}
          className="w-full py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider text-center text-primary bg-primary/[0.06] border border-primary/15"
        >
          Your Club
        </div>
      );
    }
    if (isPending) {
      return (
        <div
          data-testid={`status-pending-${club.id}`}
          className="w-full py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider text-center text-amber-400 flex items-center justify-center gap-1.5 bg-amber-500/[0.06] border border-amber-500/15"
        >
          <Clock className="w-3.5 h-3.5" />
          Pending Request
        </div>
      );
    }
    return (
      <motion.button
        data-testid={`button-join-${club.id}`}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={() => handleJoin(club.id, club.isPublic)}
        disabled={joiningId === club.id}
        className={`w-full py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider text-center flex items-center justify-center gap-1.5 transition-all disabled:opacity-50 cursor-pointer ${
          club.isPublic
            ? "bg-primary/15 border border-primary/25 text-primary"
            : "bg-amber-500/15 border border-amber-500/25 text-amber-500"
        }`}
      >
        {joiningId === club.id ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <UserPlus className="w-3.5 h-3.5" />
        )}
        {club.isPublic ? "Join Club" : "Request to Join"}
      </motion.button>
    );
  };

  return (
    <DashboardLayout title="Browse Clubs">
      <div className="px-4 sm:px-8 pb-8">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                data-testid="input-search-clubs"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search clubs by name or description..."
                className="w-full pl-10 pr-4 py-3 rounded-xl text-sm text-white placeholder-gray-500 outline-none transition-all focus:ring-2 focus:ring-primary/30 bg-surface-highest/50 border border-white/[0.06]"
              />
            </div>

            <div className="flex items-center gap-1.5">
              <ArrowUpDown className="w-3.5 h-3.5 text-gray-500" />
              {SORT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  data-testid={`button-sort-${opt.value}`}
                  onClick={() => setSortBy(opt.value)}
                  className={`px-3 py-1.5 rounded-full text-[0.6875rem] font-semibold transition-all cursor-pointer ${
                    sortBy === opt.value
                      ? "bg-primary/15 text-primary border border-primary/30"
                      : "text-gray-500 hover:text-gray-300 border border-transparent hover:border-white/10"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-2.5 text-xs text-gray-500">
            {loading ? "Loading clubs..." : `${sortedAndFilteredClubs.length} club${sortedAndFilteredClubs.length !== 1 ? "s" : ""} available`}
          </div>
        </motion.div>

        {loading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        )}

        {!loading && sortedAndFilteredClubs.length === 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-20"
          >
            <div
              className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-5 bg-white/[0.03] border border-white/[0.06]"
            >
              <FolderSearch className="w-10 h-10 text-gray-600" />
            </div>
            <h3 className="text-base font-bold text-gray-400 mb-2">No clubs found</h3>
            <p className="text-sm text-gray-600 max-w-sm mx-auto leading-relaxed">
              {searchQuery
                ? `No clubs match "${searchQuery}". Try a different search term.`
                : "There are no clubs available yet. Be the first to create one!"}
            </p>
          </motion.div>
        )}

        {!loading && featuredClubs.length > 0 && !searchQuery.trim() && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mb-8"
          >
            <div className="flex items-center gap-2 mb-4">
              <div className="w-6 h-6 rounded-lg bg-amber-500/15 flex items-center justify-center">
                <Star className="w-3.5 h-3.5 text-amber-400" />
              </div>
              <h2 className="text-sm font-bold text-white tracking-wide font-display" data-testid="text-featured-heading">Featured Clubs</h2>
              <div className="flex-1 h-px bg-gradient-to-r from-amber-500/20 to-transparent ml-2" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {featuredClubs.map((club, i) => {
                const accent = getClubAccentColor(i);
                return (
                  <motion.div
                    key={club.id}
                    data-testid={`card-featured-${club.id}`}
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15 + i * 0.08 }}
                    whileHover={{ y: -3, scale: 1.01 }}
                    className="relative rounded-xl overflow-hidden group bg-surface-high/50 backdrop-blur-xl border border-white/[0.06]"
                  >
                    <div
                      className="h-1"
                      style={{ background: `linear-gradient(90deg, ${accent.from}, ${accent.to})` }}
                    />

                    <div className="absolute top-3 right-3">
                      <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20">
                        <Crown className="w-3 h-3 text-amber-400" />
                        <span className="text-[0.5625rem] font-bold text-amber-400">#{i + 1}</span>
                      </div>
                    </div>

                    <div className="p-5">
                      <div className="flex items-center gap-3 mb-3">
                        {renderClubAvatar(club, "lg")}
                        <div className="flex-1 min-w-0">
                          <h3 className="text-sm font-bold text-white truncate">{club.name}</h3>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={`inline-flex items-center gap-1 text-[0.5625rem] font-semibold ${
                              club.isPublic ? "text-primary" : "text-amber-400"
                            }`}>
                              {club.isPublic ? <Globe className="w-2.5 h-2.5" /> : <Lock className="w-2.5 h-2.5" />}
                              {club.isPublic ? "Public" : "Private"}
                            </span>
                            <span className="text-[0.5625rem] text-gray-500">
                              <Users className="w-2.5 h-2.5 inline mr-0.5" />
                              {club.memberCount}
                            </span>
                          </div>
                        </div>
                      </div>

                      <p className="text-xs text-gray-400 leading-relaxed line-clamp-2 mb-4 min-h-[2rem]">
                        {club.description || "No description provided."}
                      </p>

                      {renderActionButton(club)}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        )}

        {!loading && sortedAndFilteredClubs.length > 0 && (
          <>
            {!searchQuery.trim() && featuredClubs.length > 0 && (
              <div className="flex items-center gap-2 mb-4">
                <div className="w-6 h-6 rounded-lg bg-white/5 flex items-center justify-center">
                  <Globe className="w-3.5 h-3.5 text-gray-400" />
                </div>
                <h2 className="text-sm font-bold text-white tracking-wide font-display" data-testid="text-all-clubs-heading">All Clubs</h2>
                <div className="flex-1 h-px bg-gradient-to-r from-white/10 to-transparent ml-2" />
              </div>
            )}

            <motion.div
              initial="hidden"
              animate="visible"
              className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4"
            >
              <AnimatePresence mode="popLayout">
                {sortedAndFilteredClubs.map((club, i) => {
                  const accent = getClubAccentColor(i);
                  const trending = isTrending(club);
                  const isFeatured = featuredIds.has(club.id);

                  return (
                    <motion.div
                      key={club.id}
                      data-testid={`card-club-${club.id}`}
                      custom={i}
                      variants={cardVariants}
                      initial="hidden"
                      animate="visible"
                      exit={{ opacity: 0, scale: 0.95 }}
                      layout
                      whileHover={{ y: -3, scale: 1.01 }}
                      className="rounded-xl overflow-hidden transition-shadow group bg-surface-high/50 backdrop-blur-xl border border-white/[0.06]"
                    >
                      <div
                        className="h-[3px]"
                        style={{
                          background: `linear-gradient(90deg, ${accent.from}, ${accent.to})`,
                        }}
                      />

                      <div className="p-5">
                        <div className="flex items-start gap-3 mb-3">
                          {renderClubAvatar(club)}

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <h3 className="text-sm font-bold text-white truncate flex-1">
                                {club.name}
                              </h3>
                              <div className="flex items-center gap-1.5 flex-shrink-0">
                                {trending && (
                                  <span
                                    data-testid={`badge-trending-${club.id}`}
                                    className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[0.5rem] font-bold uppercase bg-green-500/10 text-green-400 border border-green-500/20"
                                  >
                                    <TrendingUp className="w-2.5 h-2.5" />
                                    New
                                  </span>
                                )}
                                {isFeatured && (
                                  <span
                                    data-testid={`badge-top-${club.id}`}
                                    className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[0.5rem] font-bold uppercase bg-amber-500/10 text-amber-400 border border-amber-500/20"
                                  >
                                    <Trophy className="w-2.5 h-2.5" />
                                    Top
                                  </span>
                                )}
                                <span
                                  className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[0.5rem] font-bold uppercase tracking-wider ${
                                    club.isPublic
                                      ? "bg-primary/10 text-primary border border-primary/20"
                                      : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                                  }`}
                                >
                                  {club.isPublic ? <Globe className="w-2.5 h-2.5" /> : <Lock className="w-2.5 h-2.5" />}
                                  {club.isPublic ? "Public" : "Private"}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>

                        <p className="text-xs text-gray-400 leading-relaxed line-clamp-2 mb-4 min-h-[2rem]">
                          {club.description || "No description provided."}
                        </p>

                        <div className="flex items-center gap-4 mb-4">
                          <div className="flex items-center gap-1.5 text-xs text-gray-400">
                            <Users className="w-3.5 h-3.5 text-gray-500" />
                            <span data-testid={`text-members-${club.id}`}>{club.memberCount} member{club.memberCount !== 1 ? "s" : ""}</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-xs text-gray-400">
                            <CalendarDays className="w-3.5 h-3.5 text-gray-500" />
                            <span>
                              {new Date(club.createdAt).toLocaleDateString(undefined, {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              })}
                            </span>
                          </div>
                          {club.memberCount >= 5 && (
                            <div className="flex items-center gap-1 text-xs text-emerald-400">
                              <Zap className="w-3 h-3" />
                              <span className="text-[0.625rem]" data-testid={`badge-active-${club.id}`}>Active</span>
                            </div>
                          )}
                        </div>

                        {renderActionButton(club)}
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </motion.div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useAuth } from "@/lib/auth-context";
import { useClub, type ClubData, type ClubInvitation } from "@/lib/club-context";
import {
  Search, Users, Globe, Lock, Loader2, CalendarDays,
  UserPlus, Clock, FolderSearch,
} from "lucide-react";

interface PublicClub extends ClubData {
  memberCount: number;
}

export default function BrowseClubs() {
  const { user } = useAuth();
  const { allClubs: myClubs, joinClub, requestJoinClub, reload } = useClub();

  const [allClubs, setAllClubs] = useState<PublicClub[]>([]);
  const [pendingRequests, setPendingRequests] = useState<ClubInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [joiningId, setJoiningId] = useState<string | null>(null);

  // Fetch all clubs and the user's pending outgoing requests (single bulk call)
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
        // Silently handle — toast from context will show if needed
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

  const filteredClubs = useMemo(() => {
    if (!searchQuery.trim()) return allClubs;
    const q = searchQuery.toLowerCase();
    return allClubs.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.description && c.description.toLowerCase().includes(q))
    );
  }, [allClubs, searchQuery]);

  const handleJoin = async (clubId: string, isPublic: boolean) => {
    setJoiningId(clubId);
    try {
      if (isPublic) {
        const ok = await joinClub(clubId);
        if (ok) {
          await reload();
          // Refresh browse list memberCount
          const clubsRes = await fetch("/api/clubs");
          if (clubsRes.ok) setAllClubs(await clubsRes.json());
        }
      } else {
        const ok = await requestJoinClub(clubId);
        if (ok) {
          // Add to local pending set so button updates immediately
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

  const cardVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: (i: number) => ({
      opacity: 1,
      y: 0,
      transition: { delay: i * 0.06, duration: 0.4, ease: "easeOut" as const },
    }),
  };

  return (
    <DashboardLayout title="Browse Clubs">
      <div className="px-8 pb-8">
        {/* Search bar */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <div
            className="relative max-w-md"
          >
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search clubs by name..."
              className="w-full pl-10 pr-4 py-2.5 rounded-lg text-sm text-white placeholder-gray-600 outline-none transition-all focus:ring-1 focus:ring-amber-500/30"
              style={{
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.12)",
              }}
            />
          </div>
          <div className="mt-2 text-[0.625rem] text-gray-600">
            {loading ? "Loading..." : `${filteredClubs.length} club${filteredClubs.length !== 1 ? "s" : ""} found`}
          </div>
        </motion.div>

        {/* Loading state */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-amber-400" />
          </div>
        )}

        {/* Empty state */}
        {!loading && filteredClubs.length === 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-16"
          >
            <div
              className="w-16 h-16 rounded-xl flex items-center justify-center mx-auto mb-4"
              style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <FolderSearch className="w-8 h-8 text-gray-600" />
            </div>
            <h3 className="text-sm font-bold text-gray-400 mb-1">No clubs found</h3>
            <p className="text-[0.6875rem] text-gray-600 max-w-xs mx-auto leading-relaxed">
              {searchQuery
                ? `No clubs match "${searchQuery}". Try a different search term.`
                : "There are no clubs available yet. Be the first to create one!"}
            </p>
          </motion.div>
        )}

        {/* Club cards grid */}
        {!loading && filteredClubs.length > 0 && (
          <motion.div
            initial="hidden"
            animate="visible"
            className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4"
          >
            <AnimatePresence mode="popLayout">
              {filteredClubs.map((club, i) => {
                const isPending = pendingClubIds.has(club.id);
                const isMyClub = myClubs.some(c => c.id === club.id);

                return (
                  <motion.div
                    key={club.id}
                    custom={i}
                    variants={cardVariants}
                    initial="hidden"
                    animate="visible"
                    exit={{ opacity: 0, scale: 0.95 }}
                    layout
                    whileHover={{ y: -2 }}
                    className="rounded-xl overflow-hidden transition-all"
                    style={{
                      background:
                        "linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)",
                      border: "1px solid rgba(255,255,255,0.06)",
                      boxShadow: "0 4px 20px rgba(0,0,0,0.2)",
                    }}
                  >
                    {/* Card header accent line */}
                    <div
                      className="h-[2px]"
                      style={{
                        background: club.isPublic
                          ? "linear-gradient(90deg, rgba(212,168,67,0.4), rgba(212,168,67,0.1))"
                          : "linear-gradient(90deg, rgba(245,158,11,0.4), rgba(245,158,11,0.1))",
                      }}
                    />

                    <div className="p-4">
                      {/* Top row: name + badge */}
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <h3 className="text-xs font-bold text-white tracking-wide truncate flex-1">
                          {club.name}
                        </h3>
                        <span
                          className={`shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded text-[0.5rem] font-bold uppercase tracking-wider ${
                            club.isPublic
                              ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                              : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                          }`}
                        >
                          {club.isPublic ? (
                            <Globe className="w-2.5 h-2.5" />
                          ) : (
                            <Lock className="w-2.5 h-2.5" />
                          )}
                          {club.isPublic ? "Public" : "Private"}
                        </span>
                      </div>

                      {/* Description */}
                      <p className="text-[0.625rem] text-gray-500 leading-relaxed line-clamp-2 mb-3 min-h-[28px]">
                        {club.description || "No description provided."}
                      </p>

                      {/* Stats row */}
                      <div className="flex items-center gap-3 mb-4">
                        <div className="flex items-center gap-1 text-[0.5625rem] text-gray-500">
                          <Users className="w-3 h-3 text-gray-600" />
                          <span>{club.memberCount} member{club.memberCount !== 1 ? "s" : ""}</span>
                        </div>
                        <div className="flex items-center gap-1 text-[0.5625rem] text-gray-500">
                          <CalendarDays className="w-3 h-3 text-gray-600" />
                          <span>
                            {new Date(club.createdAt).toLocaleDateString(undefined, {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
                          </span>
                        </div>
                      </div>

                      {/* Action button */}
                      {isMyClub ? (
                        <div
                          className="w-full py-2 rounded-lg text-[0.625rem] font-bold uppercase tracking-wider text-center text-amber-400"
                          style={{
                            background: "rgba(212,168,67,0.06)",
                            border: "1px solid rgba(212,168,67,0.15)",
                          }}
                        >
                          Your Club
                        </div>
                      ) : isPending ? (
                        <div
                          className="w-full py-2 rounded-lg text-[0.625rem] font-bold uppercase tracking-wider text-center text-amber-400 flex items-center justify-center gap-1.5"
                          style={{
                            background: "rgba(245,158,11,0.06)",
                            border: "1px solid rgba(245,158,11,0.15)",
                          }}
                        >
                          <Clock className="w-3 h-3" />
                          Pending Request
                        </div>
                      ) : (
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => handleJoin(club.id, club.isPublic)}
                          disabled={joiningId === club.id}
                          className="w-full py-2 rounded-lg text-[0.625rem] font-bold uppercase tracking-wider text-center flex items-center justify-center gap-1.5 transition-all disabled:opacity-50"
                          style={
                            club.isPublic
                              ? {
                                  background:
                                    "linear-gradient(135deg, rgba(212,168,67,0.15), rgba(0,200,220,0.1))",
                                  border: "1px solid rgba(212,168,67,0.25)",
                                  color: "#d4a843",
                                }
                              : {
                                  background:
                                    "linear-gradient(135deg, rgba(245,158,11,0.15), rgba(200,130,10,0.1))",
                                  border: "1px solid rgba(245,158,11,0.25)",
                                  color: "#f59e0b",
                                }
                          }
                        >
                          {joiningId === club.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <UserPlus className="w-3 h-3" />
                          )}
                          {club.isPublic ? "Join" : "Request to Join"}
                        </motion.button>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </motion.div>
        )}
      </div>
    </DashboardLayout>
  );
}

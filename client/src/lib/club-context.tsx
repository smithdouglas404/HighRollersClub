import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from "react";
import { useAuth } from "./auth-context";
import { useToast } from "@/hooks/use-toast";

/* ── Shared Types (single source of truth) ─────────────────────────────────── */

export interface ClubData {
  id: string;
  name: string;
  description: string | null;
  ownerId: string;
  avatarUrl: string | null;
  isPublic: boolean;
  memberCount: number;
  createdAt: string;
}

export interface ClubMember {
  id: string;
  clubId: string;
  userId: string;
  username: string;
  displayName: string;
  avatarId: string | null;
  chipBalance: number;
  role: string;
  joinedAt: string;
}

export interface ClubInvitation {
  id: string;
  clubId: string;
  userId: string;
  username: string;
  displayName: string;
  avatarId: string | null;
  type: "invite" | "request";
  status: "pending" | "accepted" | "declined";
  createdAt: string;
}

export interface MemberStats {
  handsPlayed: number;
  potsWon: number;
  bestWinStreak: number;
  currentWinStreak: number;
  totalWinnings: number;
  vpip: number;
  pfr: number;
  showdownCount: number;
}

export interface PlayerStats {
  handsPlayed: number;
  potsWon: number;
  bestWinStreak: number;
  currentWinStreak: number;
  totalWinnings: number;
}

export interface Announcement {
  id: string;
  authorId: string;
  authorName?: string;
  title: string;
  content: string;
  pinned: boolean;
  createdAt: string;
}

export interface ClubEvent {
  id: string;
  eventType: string;
  tableId: string | null;
  name: string;
  description: string | null;
  startTime: string;
  createdAt: string;
}

export interface ClubTournament {
  id: string;
  name: string;
  clubId: string;
  status: string;
  buyIn: number;
  startingChips: number;
  maxPlayers: number;
  prizePool: number;
  registeredCount: number;
  startAt: string | null;
  createdAt: string;
}

export interface MissionData {
  id: string;
  type: string;
  label: string;
  description: string | null;
  target: number;
  reward: number;
  progress: number;
  completed: boolean;
  claimed: boolean;
}

/* ── Context shape ─────────────────────────────────────────────────────────── */

interface ClubContextType {
  // Core data
  club: ClubData | null;
  allClubs: ClubData[];
  members: ClubMember[];
  invitations: ClubInvitation[];
  memberStatsMap: Record<string, MemberStats>;
  myStats: PlayerStats | null;
  announcements: Announcement[];
  events: ClubEvent[];
  clubTournaments: ClubTournament[];
  missions: MissionData[];
  onlineUserIds: Set<string>;
  myRole: string;
  isAdminOrOwner: boolean;

  // State
  loading: boolean;

  // Actions
  reload: () => Promise<void>;
  switchClub: (clubId: string) => void;
  createClub: (data: { name: string; description?: string; isPublic?: boolean; avatarUrl?: string }) => Promise<ClubData | null>;
  updateClub: (data: Record<string, any>) => Promise<boolean>;
  deleteClub: () => Promise<boolean>;
  sendInvite: (username: string) => Promise<boolean>;
  handleInvitation: (invId: string, status: "accepted" | "declined") => Promise<boolean>;
  changeRole: (memberId: string, role: "admin" | "member") => Promise<boolean>;
  kickMember: (memberId: string) => Promise<boolean>;
  joinClub: (clubId: string) => Promise<boolean>;
  leaveClub: () => Promise<boolean>;
  requestJoinClub: (clubId: string) => Promise<boolean>;
  createAnnouncement: (data: { title: string; content: string; pinned?: boolean }) => Promise<boolean>;
  createEvent: (data: { name: string; eventType: string; description?: string; startTime?: string }) => Promise<boolean>;
  createClubTournament: (data: { name: string; buyIn: number; startingChips: number; maxPlayers: number; startAt?: string }) => Promise<boolean>;
}

const ClubContext = createContext<ClubContextType | null>(null);

const ACTIVE_CLUB_KEY = "activeClubId";

/* ── Provider ──────────────────────────────────────────────────────────────── */

export function ClubProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { toast } = useToast();

  const [allClubs, setAllClubs] = useState<ClubData[]>([]);
  const [activeClubId, setActiveClubId] = useState<string | null>(() => {
    try { return localStorage.getItem(ACTIVE_CLUB_KEY); } catch { return null; }
  });
  const activeClubIdRef = useRef(activeClubId);
  const [members, setMembers] = useState<ClubMember[]>([]);
  const [invitations, setInvitations] = useState<ClubInvitation[]>([]);
  const [memberStatsMap, setMemberStatsMap] = useState<Record<string, MemberStats>>({});
  const [myStats, setMyStats] = useState<PlayerStats | null>(null);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [events, setEvents] = useState<ClubEvent[]>([]);
  const [clubTournaments, setClubTournaments] = useState<ClubTournament[]>([]);
  const [missions, setMissions] = useState<MissionData[]>([]);
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());
  const [myRole, setMyRole] = useState<string>("member");
  const [loading, setLoading] = useState(true);

  const isAdminOrOwner = myRole === "owner" || myRole === "admin";

  // Derive active club from allClubs + activeClubId
  const club = allClubs.find(c => c.id === activeClubId) ?? allClubs[0] ?? null;

  /* ── Switch active club ────────────────────────────────────────────────── */

  const switchClub = useCallback((clubId: string) => {
    activeClubIdRef.current = clubId;
    setActiveClubId(clubId);
    try { localStorage.setItem(ACTIVE_CLUB_KEY, clubId); } catch {}
  }, []);

  /* ── Load detail data for a specific club ──────────────────────────────── */

  const loadClubDetail = useCallback(async (clubId: string) => {
    if (!user) return;
    try {
      const [membersRes, invRes, memberStatsRes, announcementsRes, eventsRes, tournamentsRes] = await Promise.all([
        fetch(`/api/clubs/${clubId}/members`),
        fetch(`/api/clubs/${clubId}/invitations`),
        fetch(`/api/clubs/${clubId}/members/stats`),
        fetch(`/api/clubs/${clubId}/announcements`).catch(() => null),
        fetch(`/api/clubs/${clubId}/events`).catch(() => null),
        fetch(`/api/clubs/${clubId}/tournaments`).catch(() => null),
      ]);

      if (membersRes.ok) {
        const memberData: ClubMember[] = await membersRes.json();
        setMembers(memberData);
        const me = memberData.find(m => m.userId === user.id);
        if (me) setMyRole(me.role);
        else setMyRole("member");
      }

      if (invRes.ok) setInvitations(await invRes.json());
      if (memberStatsRes.ok) setMemberStatsMap(await memberStatsRes.json());
      if (announcementsRes?.ok) setAnnouncements(await announcementsRes.json());
      if (eventsRes?.ok) setEvents(await eventsRes.json());
      if (tournamentsRes?.ok) setClubTournaments(await tournamentsRes.json());
    } catch {
      // Detail load failure is non-fatal
    }
  }, [user]);

  /* ── Fetch all data ──────────────────────────────────────────────────────── */

  const reload = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    try {
      const [clubsRes, statsRes, missionsRes] = await Promise.all([
        fetch("/api/me/clubs"),
        fetch("/api/stats/me"),
        fetch("/api/missions"),
      ]);

      if (missionsRes.ok) setMissions(await missionsRes.json());
      if (statsRes.ok) setMyStats(await statsRes.json());

      if (!clubsRes.ok) { setLoading(false); return; }
      const userClubs: ClubData[] = await clubsRes.json();
      setAllClubs(userClubs);

      // Determine active club using ref to avoid re-render loop
      const storedId = activeClubIdRef.current;
      const resolvedId = userClubs.find(c => c.id === storedId)?.id ?? userClubs[0]?.id ?? null;

      if (resolvedId && resolvedId !== storedId) {
        activeClubIdRef.current = resolvedId;
        setActiveClubId(resolvedId);
        try { localStorage.setItem(ACTIVE_CLUB_KEY, resolvedId); } catch {}
      }

      if (resolvedId) {
        await loadClubDetail(resolvedId);
      } else {
        // No clubs — clear everything
        setMembers([]);
        setInvitations([]);
        setMemberStatsMap({});
        setAnnouncements([]);
        setEvents([]);
        setClubTournaments([]);
        setMyRole("member");
      }
    } catch (err: any) {
      toast({ title: "Failed to load club data", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [user, toast, loadClubDetail]);

  useEffect(() => { reload(); }, [reload]);

  // Reload club detail when active club changes (after initial load)
  useEffect(() => {
    if (club && !loading) {
      loadClubDetail(club.id);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [club?.id]);

  /* ── Poll online status ──────────────────────────────────────────────────── */

  useEffect(() => {
    if (!club) return;
    const fetchOnline = async () => {
      try {
        const res = await fetch("/api/online-users");
        if (res.ok) setOnlineUserIds(new Set(await res.json()));
      } catch (err) {
        console.warn("Failed to fetch online users:", err);
      }
    };
    fetchOnline();
    const interval = setInterval(fetchOnline, 30_000);
    return () => clearInterval(interval);
  }, [club]);

  /* ── Actions ─────────────────────────────────────────────────────────────── */

  const createClub = useCallback(async (data: { name: string; description?: string; isPublic?: boolean; avatarUrl?: string }) => {
    try {
      const res = await fetch("/api/clubs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({ message: "Failed to create club" }));
        throw new Error(d.message);
      }
      const newClub: ClubData = await res.json();
      toast({ title: "Club created!", description: `"${newClub.name}" is ready to go.` });
      await reload();
      switchClub(newClub.id);
      return newClub;
    } catch (err: any) {
      toast({ title: "Failed to create club", description: err.message, variant: "destructive" });
      return null;
    }
  }, [reload, switchClub, toast]);

  const updateClub = useCallback(async (data: Record<string, any>) => {
    if (!club) return false;
    try {
      const res = await fetch(`/api/clubs/${club.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({ message: "Failed to save settings" }));
        throw new Error(d.message);
      }
      const updated = await res.json();
      setAllClubs(prev => prev.map(c => c.id === updated.id ? { ...c, ...updated } : c));
      toast({ title: "Settings saved" });
      return true;
    } catch (err: any) {
      toast({ title: "Failed to save settings", description: err.message, variant: "destructive" });
      return false;
    }
  }, [club, toast]);

  const deleteClub = useCallback(async () => {
    if (!club) return false;
    try {
      const res = await fetch(`/api/clubs/${club.id}`, { method: "DELETE" });
      if (!res.ok) {
        const d = await res.json().catch(() => ({ message: "Failed to delete club" }));
        throw new Error(d.message);
      }
      toast({ title: "Club deleted" });
      const remaining = allClubs.filter(c => c.id !== club.id);
      setAllClubs(remaining);
      if (remaining.length > 0) {
        switchClub(remaining[0].id);
      } else {
        activeClubIdRef.current = null;
        setActiveClubId(null);
        try { localStorage.removeItem(ACTIVE_CLUB_KEY); } catch {}
        setMembers([]);
      }
      return true;
    } catch (err: any) {
      toast({ title: "Failed to delete club", description: err.message, variant: "destructive" });
      return false;
    }
  }, [club, allClubs, switchClub, toast]);

  const sendInvite = useCallback(async (username: string) => {
    if (!club) return false;
    try {
      const res = await fetch(`/api/clubs/${club.id}/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, type: "invite" }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({ message: "Failed to send invite" }));
        throw new Error(d.message);
      }
      const newInv = await res.json();
      // Optimistically add to local invitations list instead of full reload
      setInvitations(prev => [...prev, { ...newInv, displayName: username, username, avatarId: null }]);
      toast({ title: "Invite sent", description: `Invitation sent to "${username}"` });
      return true;
    } catch (err: any) {
      toast({ title: "Failed to send invite", description: err.message, variant: "destructive" });
      return false;
    }
  }, [club, toast]);

  const handleInvitation = useCallback(async (invId: string, status: "accepted" | "declined") => {
    // Use the invitation's actual clubId instead of relying on active club
    const inv = invitations.find(i => i.id === invId);
    const clubId = inv?.clubId ?? club?.id;
    if (!clubId) return false;
    try {
      const res = await fetch(`/api/clubs/${clubId}/invitations/${invId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({ message: "Action failed" }));
        throw new Error(d.message);
      }
      toast({ title: status === "accepted" ? "Request approved" : "Request declined" });
      await reload();
      return true;
    } catch (err: any) {
      toast({ title: "Action failed", description: err.message, variant: "destructive" });
      return false;
    }
  }, [club, reload, toast]);

  const changeRole = useCallback(async (memberId: string, role: "admin" | "member") => {
    if (!club) return false;
    try {
      const res = await fetch(`/api/clubs/${club.id}/members/${memberId}/role`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({ message: "Failed to change role" }));
        throw new Error(d.message);
      }
      toast({ title: "Role updated", description: `Member ${role === "admin" ? "promoted" : "demoted"}` });
      await reload();
      return true;
    } catch (err: any) {
      toast({ title: "Failed to change role", description: err.message, variant: "destructive" });
      return false;
    }
  }, [club, reload, toast]);

  const kickMember = useCallback(async (memberId: string) => {
    if (!club) return false;
    try {
      const res = await fetch(`/api/clubs/${club.id}/members/${memberId}`, { method: "DELETE" });
      if (!res.ok) {
        const d = await res.json().catch(() => ({ message: "Failed to remove member" }));
        throw new Error(d.message);
      }
      toast({ title: "Member removed" });
      await reload();
      return true;
    } catch (err: any) {
      toast({ title: "Failed to remove member", description: err.message, variant: "destructive" });
      return false;
    }
  }, [club, reload, toast]);

  const joinClub = useCallback(async (clubId: string) => {
    try {
      const res = await fetch(`/api/clubs/${clubId}/join`, { method: "POST" });
      if (!res.ok) {
        const d = await res.json().catch(() => ({ message: "Failed to join club" }));
        throw new Error(d.message);
      }
      toast({ title: "Joined club!" });
      await reload();
      switchClub(clubId);
      return true;
    } catch (err: any) {
      toast({ title: "Failed to join club", description: err.message, variant: "destructive" });
      return false;
    }
  }, [reload, switchClub, toast]);

  const leaveClub = useCallback(async () => {
    if (!club) return false;
    try {
      const res = await fetch(`/api/clubs/${club.id}/leave`, { method: "POST" });
      if (!res.ok) {
        const d = await res.json().catch(() => ({ message: "Failed to leave club" }));
        throw new Error(d.message);
      }
      toast({ title: "Left club" });
      const remaining = allClubs.filter(c => c.id !== club.id);
      setAllClubs(remaining);
      if (remaining.length > 0) {
        switchClub(remaining[0].id);
      } else {
        activeClubIdRef.current = null;
        setActiveClubId(null);
        try { localStorage.removeItem(ACTIVE_CLUB_KEY); } catch {}
        setMembers([]);
      }
      return true;
    } catch (err: any) {
      toast({ title: "Failed to leave club", description: err.message, variant: "destructive" });
      return false;
    }
  }, [club, allClubs, switchClub, toast]);

  const requestJoinClub = useCallback(async (clubId: string) => {
    try {
      const res = await fetch(`/api/clubs/${clubId}/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "request" }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({ message: "Failed to request join" }));
        throw new Error(d.message);
      }
      toast({ title: "Request sent", description: "Your join request has been submitted" });
      return true;
    } catch (err: any) {
      toast({ title: "Failed to request join", description: err.message, variant: "destructive" });
      return false;
    }
  }, [toast]);

  const createAnnouncement = useCallback(async (data: { title: string; content: string; pinned?: boolean }) => {
    if (!club) return false;
    try {
      const res = await fetch(`/api/clubs/${club.id}/announcements`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({ message: "Failed to create announcement" }));
        throw new Error(d.message);
      }
      toast({ title: "Announcement posted" });
      await reload();
      return true;
    } catch (err: any) {
      toast({ title: "Failed to post announcement", description: err.message, variant: "destructive" });
      return false;
    }
  }, [club, reload, toast]);

  const createClubTournament = useCallback(async (data: { name: string; buyIn: number; startingChips: number; maxPlayers: number; startAt?: string }) => {
    if (!club) return false;
    try {
      const res = await fetch("/api/tournaments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, clubId: club.id }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({ message: "Failed to create tournament" }));
        throw new Error(d.message);
      }
      toast({ title: "Tournament created!" });
      await loadClubDetail(club.id);
      return true;
    } catch (err: any) {
      toast({ title: "Failed to create tournament", description: err.message, variant: "destructive" });
      return false;
    }
  }, [club, toast, loadClubDetail]);

  const createEvent = useCallback(async (data: { name: string; eventType: string; description?: string; startTime?: string }) => {
    if (!club) return false;
    try {
      const res = await fetch(`/api/clubs/${club.id}/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({ message: "Failed to create event" }));
        throw new Error(d.message);
      }
      toast({ title: "Event scheduled" });
      await reload();
      return true;
    } catch (err: any) {
      toast({ title: "Failed to schedule event", description: err.message, variant: "destructive" });
      return false;
    }
  }, [club, reload, toast]);

  return (
    <ClubContext.Provider value={{
      club, allClubs, members, invitations, memberStatsMap, myStats, announcements, events,
      clubTournaments, missions, onlineUserIds, myRole, isAdminOrOwner, loading,
      reload, switchClub, createClub, updateClub, deleteClub, sendInvite, handleInvitation,
      changeRole, kickMember, joinClub, leaveClub, requestJoinClub,
      createAnnouncement, createEvent, createClubTournament,
    }}>
      {children}
    </ClubContext.Provider>
  );
}

export function useClub() {
  const ctx = useContext(ClubContext);
  if (!ctx) throw new Error("useClub must be used within ClubProvider");
  return ctx;
}

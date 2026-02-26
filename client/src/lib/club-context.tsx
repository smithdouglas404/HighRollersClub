import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
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
  members: ClubMember[];
  invitations: ClubInvitation[];
  memberStatsMap: Record<string, MemberStats>;
  myStats: PlayerStats | null;
  announcements: Announcement[];
  events: ClubEvent[];
  missions: MissionData[];
  onlineUserIds: Set<string>;
  myRole: string;
  isAdminOrOwner: boolean;

  // State
  loading: boolean;

  // Actions
  reload: () => Promise<void>;
  createClub: (data: { name: string; description?: string; isPublic?: boolean }) => Promise<ClubData | null>;
  updateClub: (data: { name?: string; description?: string; isPublic?: boolean }) => Promise<boolean>;
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
}

const ClubContext = createContext<ClubContextType | null>(null);

/* ── Provider ──────────────────────────────────────────────────────────────── */

export function ClubProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { toast } = useToast();

  const [club, setClub] = useState<ClubData | null>(null);
  const [members, setMembers] = useState<ClubMember[]>([]);
  const [invitations, setInvitations] = useState<ClubInvitation[]>([]);
  const [memberStatsMap, setMemberStatsMap] = useState<Record<string, MemberStats>>({});
  const [myStats, setMyStats] = useState<PlayerStats | null>(null);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [events, setEvents] = useState<ClubEvent[]>([]);
  const [missions, setMissions] = useState<MissionData[]>([]);
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());
  const [myRole, setMyRole] = useState<string>("member");
  const [loading, setLoading] = useState(true);

  const isAdminOrOwner = myRole === "owner" || myRole === "admin";

  /* ── Fetch all data ──────────────────────────────────────────────────────── */

  const reload = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    try {
      const [clubsRes, statsRes, missionsRes] = await Promise.all([
        fetch("/api/clubs"),
        fetch("/api/stats/me"),
        fetch("/api/missions"),
      ]);

      if (missionsRes.ok) setMissions(await missionsRes.json());
      if (statsRes.ok) setMyStats(await statsRes.json());

      if (!clubsRes.ok) { setLoading(false); return; }
      const clubs: ClubData[] = await clubsRes.json();
      if (clubs.length === 0) {
        setClub(null);
        setMembers([]);
        setInvitations([]);
        setMemberStatsMap({});
        setAnnouncements([]);
        setEvents([]);
        setLoading(false);
        return;
      }

      const myClub = clubs[0];
      setClub(myClub);

      const [membersRes, invRes, memberStatsRes, announcementsRes, eventsRes] = await Promise.all([
        fetch(`/api/clubs/${myClub.id}/members`),
        fetch(`/api/clubs/${myClub.id}/invitations`),
        fetch(`/api/clubs/${myClub.id}/members/stats`),
        fetch(`/api/clubs/${myClub.id}/announcements`).catch(() => null),
        fetch(`/api/clubs/${myClub.id}/events`).catch(() => null),
      ]);

      if (membersRes.ok) {
        const memberData: ClubMember[] = await membersRes.json();
        setMembers(memberData);
        const me = memberData.find(m => m.userId === user.id);
        if (me) setMyRole(me.role);
      }

      if (invRes.ok) setInvitations(await invRes.json());
      if (memberStatsRes.ok) setMemberStatsMap(await memberStatsRes.json());
      if (announcementsRes?.ok) setAnnouncements(await announcementsRes.json());
      if (eventsRes?.ok) setEvents(await eventsRes.json());
    } catch (err: any) {
      toast({ title: "Failed to load club data", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [user, toast]);

  useEffect(() => { reload(); }, [reload]);

  /* ── Poll online status ──────────────────────────────────────────────────── */

  useEffect(() => {
    if (!club) return;
    const fetchOnline = async () => {
      try {
        const res = await fetch("/api/online-users");
        if (res.ok) setOnlineUserIds(new Set(await res.json()));
      } catch {}
    };
    fetchOnline();
    const interval = setInterval(fetchOnline, 30_000);
    return () => clearInterval(interval);
  }, [club]);

  /* ── Actions ─────────────────────────────────────────────────────────────── */

  const createClub = useCallback(async (data: { name: string; description?: string; isPublic?: boolean }) => {
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
      return newClub;
    } catch (err: any) {
      toast({ title: "Failed to create club", description: err.message, variant: "destructive" });
      return null;
    }
  }, [reload, toast]);

  const updateClub = useCallback(async (data: { name?: string; description?: string; isPublic?: boolean }) => {
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
      setClub(updated);
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
      setClub(null);
      setMembers([]);
      return true;
    } catch (err: any) {
      toast({ title: "Failed to delete club", description: err.message, variant: "destructive" });
      return false;
    }
  }, [club, toast]);

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
      toast({ title: "Invite sent", description: `Invitation sent to "${username}"` });
      await reload();
      return true;
    } catch (err: any) {
      toast({ title: "Failed to send invite", description: err.message, variant: "destructive" });
      return false;
    }
  }, [club, reload, toast]);

  const handleInvitation = useCallback(async (invId: string, status: "accepted" | "declined") => {
    if (!club) return false;
    try {
      const res = await fetch(`/api/clubs/${club.id}/invitations/${invId}`, {
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
      return true;
    } catch (err: any) {
      toast({ title: "Failed to join club", description: err.message, variant: "destructive" });
      return false;
    }
  }, [reload, toast]);

  const leaveClub = useCallback(async () => {
    if (!club) return false;
    try {
      const res = await fetch(`/api/clubs/${club.id}/leave`, { method: "POST" });
      if (!res.ok) {
        const d = await res.json().catch(() => ({ message: "Failed to leave club" }));
        throw new Error(d.message);
      }
      toast({ title: "Left club" });
      setClub(null);
      setMembers([]);
      return true;
    } catch (err: any) {
      toast({ title: "Failed to leave club", description: err.message, variant: "destructive" });
      return false;
    }
  }, [club, toast]);

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
      club, members, invitations, memberStatsMap, myStats, announcements, events,
      missions, onlineUserIds, myRole, isAdminOrOwner, loading,
      reload, createClub, updateClub, deleteClub, sendInvite, handleInvitation,
      changeRole, kickMember, joinClub, leaveClub, requestJoinClub,
      createAnnouncement, createEvent,
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

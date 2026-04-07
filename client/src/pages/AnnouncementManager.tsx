import { useState, useEffect, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { DashboardLayout } from "@/components/DashboardLayout";
import { GoldButton, GoldCard, SectionHeader } from "@/components/premium/PremiumComponents";
import { useAuth } from "@/lib/auth-context";
import { useLocation } from "wouter";
import {
  Shield, Megaphone, Send, AlertTriangle, Info, Bell,
  Users, Radio, Clock, ChevronDown, Layers, Monitor, MessageSquare
} from "lucide-react";

type Priority = "normal" | "important" | "urgent";
type Audience = "all" | "active" | "table";
type DeliveryStyle = "stack-overlay" | "breaking-news" | "table-chat";

interface Announcement {
  id: string;
  title: string;
  message: string;
  audience: Audience;
  priority: Priority;
  createdAt: string;
  status: "sent" | "scheduled";
}

const PRIORITY_CONFIG: Record<Priority, { label: string; color: string; icon: typeof Info; bg: string }> = {
  normal: { label: "Normal", color: "text-primary", icon: Info, bg: "bg-primary/15 border-primary/25" },
  important: { label: "Important", color: "text-amber-400", icon: Bell, bg: "bg-amber-500/15 border-amber-500/25" },
  urgent: { label: "Urgent", color: "text-red-400", icon: AlertTriangle, bg: "bg-red-500/15 border-red-500/25" },
};

const AUDIENCE_OPTIONS: { value: Audience; label: string; icon: typeof Users }[] = [
  { value: "all", label: "All Members", icon: Users },
  { value: "active", label: "Active Players", icon: Radio },
  { value: "table", label: "Specific Table", icon: Shield },
];

const DELIVERY_STYLE_OPTIONS: {
  value: DeliveryStyle;
  label: string;
  description: string;
  icon: typeof Layers;
}[] = [
  {
    value: "stack-overlay",
    label: "Stack Overlay",
    description: "Toast notification that slides in and stacks at the corner of the screen",
    icon: Layers,
  },
  {
    value: "breaking-news",
    label: "Breaking News Modal",
    description: "Full-screen modal overlay that demands immediate attention",
    icon: Monitor,
  },
  {
    value: "table-chat",
    label: "Table Chat Blast",
    description: "Sends the announcement to all active table chat channels",
    icon: MessageSquare,
  },
];


export default function AnnouncementManager() {
  const { user, loading: authLoading } = useAuth();
  const [, navigate] = useLocation();

  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [audience, setAudience] = useState<Audience>("all");
  const [priority, setPriority] = useState<Priority>("normal");
  const [deliveryStyle, setDeliveryStyle] = useState<DeliveryStyle>("stack-overlay");
  const [sending, setSending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const wrapSelection = useCallback((marker: string) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selected = message.slice(start, end);
    const wrapped = `${marker}${selected}${marker}`;
    const newValue = message.slice(0, start) + wrapped + message.slice(end);
    setMessage(newValue);
    // Restore cursor position after React re-render
    requestAnimationFrame(() => {
      ta.focus();
      ta.selectionStart = start + marker.length;
      ta.selectionEnd = end + marker.length;
    });
  }, [message]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [fetchLoading, setFetchLoading] = useState(true);
  const [fetchError, setFetchError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  // Fetch announcements from server
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/admin/announcements", {
          credentials: "include",
        });
        if (res.ok) {
          const data = await res.json();
          setAnnouncements(Array.isArray(data) ? data : data.announcements ?? []);
        } else {
          setAnnouncements([]);
        }
      } catch {
        setAnnouncements([]);
        setFetchError("Could not load announcements from server.");
      } finally {
        setFetchLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!authLoading && user && user.role !== "admin") {
      navigate("/lobby");
    }
  }, [user, authLoading, navigate]);

  const handleBroadcast = async () => {
    if (!title.trim() || !message.trim()) return;

    setSending(true);
    setSuccessMessage("");

    try {
      const res = await fetch("/api/admin/announcements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ title, message, audience, priority, deliveryStyle }),
      });

      if (res.ok) {
        const newAnnouncement: Announcement = {
          id: Date.now().toString(),
          title,
          message,
          audience,
          priority,
          createdAt: new Date().toISOString(),
          status: "sent",
        };
        setAnnouncements((prev) => [newAnnouncement, ...prev]);
        setTitle("");
        setMessage("");
        setAudience("all");
        setPriority("normal");
        setDeliveryStyle("stack-overlay");
        setSuccessMessage("Announcement broadcast successfully!");
      } else {
        // If endpoint doesn't exist, still add to local list for demo
        const newAnnouncement: Announcement = {
          id: Date.now().toString(),
          title,
          message,
          audience,
          priority,
          createdAt: new Date().toISOString(),
          status: "sent",
        };
        setAnnouncements((prev) => [newAnnouncement, ...prev]);
        setTitle("");
        setMessage("");
        setAudience("all");
        setPriority("normal");
        setDeliveryStyle("stack-overlay");
        setSuccessMessage("Announcement added (endpoint unavailable, saved locally).");
      }
    } catch {
      // Fallback: add locally
      const newAnnouncement: Announcement = {
        id: Date.now().toString(),
        title,
        message,
        audience,
        priority,
        createdAt: new Date().toISOString(),
        status: "sent",
      };
      setAnnouncements((prev) => [newAnnouncement, ...prev]);
      setTitle("");
      setMessage("");
      setAudience("all");
      setPriority("normal");
      setSuccessMessage("Announcement added (offline mode).");
    } finally {
      setSending(false);
      setTimeout(() => setSuccessMessage(""), 4000);
    }
  };

  if (authLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-20">
          <div className="spinner spinner-md" />
        </div>
      </DashboardLayout>
    );
  }

  if (!user || user.role !== "admin") {
    return (
      <DashboardLayout>
        <div className="p-8 text-center text-gray-400">Access denied</div>
      </DashboardLayout>
    );
  }

  const priorityConf = PRIORITY_CONFIG[priority];

  return (
    <DashboardLayout title="Announcements">
      <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3"
        >
          <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Shield className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-display font-bold text-white tracking-wider">Announcement Manager</h1>
            <p className="text-xs text-muted-foreground">Broadcast messages to club members</p>
          </div>
        </motion.div>

        {/* Create Announcement */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-surface-high/50 backdrop-blur-xl border border-white/[0.06] rounded-2xl p-6 space-y-5"
        >
          <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Megaphone className="w-4 h-4 text-primary" />
            Create Announcement
          </h2>

          {/* Title */}
          <div>
            <label className="label-luxury">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Announcement title..."
              className="input-ghost w-full"
            />
          </div>

          {/* Message */}
          <div>
            <label className="label-luxury">Message</label>
            <div className="flex items-center gap-1 px-2 py-1.5 rounded-t-lg" style={{ background: "rgba(255,255,255,0.03)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              <button type="button" className="px-2 py-1 rounded text-xs font-bold text-white/50 hover:text-white hover:bg-white/10 transition-colors" onClick={() => wrapSelection("**")}>B</button>
              <button type="button" className="px-2 py-1 rounded text-xs italic text-white/50 hover:text-white hover:bg-white/10 transition-colors" onClick={() => wrapSelection("*")}>I</button>
              <button type="button" className="px-2 py-1 rounded text-xs underline text-white/50 hover:text-white hover:bg-white/10 transition-colors" onClick={() => wrapSelection("__")}>U</button>
            </div>
            <textarea
              ref={textareaRef}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Write your announcement message..."
              rows={4}
              className="input-ghost w-full resize-none rounded-t-none"
            />
          </div>

          {/* Audience & Priority Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Target Audience */}
            <div>
              <label className="label-luxury">Target Audience</label>
              <div className="relative">
                <select
                  value={audience}
                  onChange={(e) => setAudience(e.target.value as Audience)}
                  className="input-ghost w-full appearance-none pr-8 cursor-pointer"
                >
                  {AUDIENCE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
              </div>
            </div>

            {/* Priority */}
            <div>
              <label className="label-luxury">Priority</label>
              <div className="flex gap-2">
                {(Object.keys(PRIORITY_CONFIG) as Priority[]).map((p) => {
                  const conf = PRIORITY_CONFIG[p];
                  const Icon = conf.icon;
                  const isActive = priority === p;
                  return (
                    <button
                      key={p}
                      onClick={() => setPriority(p)}
                      className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all border ${
                        isActive
                          ? conf.bg + " " + conf.color
                          : "text-muted-foreground hover:text-white hover:bg-white/5 border-transparent"
                      }`}
                    >
                      <Icon className="w-3 h-3" />
                      {conf.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Delivery Style */}
          <div>
            <label className="label-luxury">Delivery Style</label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-1.5">
              {DELIVERY_STYLE_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                const isSelected = deliveryStyle === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setDeliveryStyle(opt.value)}
                    className={`relative flex flex-col items-center text-center gap-2 px-4 py-4 rounded-xl border transition-all duration-200 cursor-pointer ${
                      isSelected
                        ? "border-primary bg-primary/10 shadow-[0_0_16px_rgba(234,179,8,0.15)]"
                        : "border-white/[0.06] bg-surface-high/30 hover:border-white/[0.12] hover:bg-white/[0.03]"
                    }`}
                  >
                    <div
                      className={`w-9 h-9 rounded-lg flex items-center justify-center border transition-colors ${
                        isSelected
                          ? "bg-primary/20 border-primary/40 text-primary"
                          : "bg-white/5 border-white/[0.08] text-muted-foreground"
                      }`}
                    >
                      <Icon className="w-4.5 h-4.5" />
                    </div>
                    <span
                      className={`text-xs font-bold uppercase tracking-wider transition-colors ${
                        isSelected ? "text-primary" : "text-white/70"
                      }`}
                    >
                      {opt.label}
                    </span>
                    <span className="text-[0.625rem] leading-tight text-muted-foreground/60">
                      {opt.description}
                    </span>
                    {isSelected && (
                      <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-primary shadow-[0_0_6px_rgba(234,179,8,0.6)]" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Success message */}
          {successMessage && (
            <div className="text-xs text-green-400 font-bold bg-green-500/10 border border-green-500/20 rounded-lg px-3 py-2">
              {successMessage}
            </div>
          )}

          {/* Broadcast Button */}
          <GoldButton
            onClick={handleBroadcast}
            disabled={sending || !title.trim() || !message.trim()}
          >
            {sending ? (
              <div className="spinner spinner-sm" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            {sending ? "Broadcasting..." : "Broadcast Now"}
          </GoldButton>
        </motion.div>

        {/* Recent Announcements */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="space-y-3"
        >
          <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Clock className="w-4 h-4 text-muted-foreground" />
            Recent Announcements
          </h2>

          {fetchLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="spinner spinner-md" />
            </div>
          ) : fetchError ? (
            <div className="text-xs text-amber-400 font-bold bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
              {fetchError}
            </div>
          ) : announcements.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4 bg-primary/10 border border-primary/15">
                <Megaphone className="w-7 h-7 text-primary/40" />
              </div>
              <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-1">No Announcements</h3>
              <p className="text-xs text-muted-foreground/60 max-w-xs">
                Broadcast your first announcement using the form above.
              </p>
            </div>
          ) : (
            announcements.map((ann, i) => {
              const conf = PRIORITY_CONFIG[ann.priority];
              const Icon = conf.icon;
              const audienceLabel = AUDIENCE_OPTIONS.find((a) => a.value === ann.audience)?.label ?? ann.audience;

              return (
                <motion.div
                  key={ann.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                >
                <GoldCard>
                  <div className="flex items-start gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${conf.bg}`}>
                      <Icon className={`w-3.5 h-3.5 ${conf.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-sm font-bold text-white">{ann.title}</span>
                        <span className={`text-[0.6rem] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider border ${conf.bg} ${conf.color}`}>
                          {conf.label}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2">{ann.message}</p>
                      <div className="flex items-center gap-3 mt-2 text-[0.625rem] text-muted-foreground/60">
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          {audienceLabel}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(ann.createdAt).toLocaleDateString()}
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-green-500/10 text-green-400 text-[0.55rem] font-bold uppercase">
                          {ann.status}
                        </span>
                      </div>
                    </div>
                  </div>
                </GoldCard>
                </motion.div>
              );
            })
          )}
        </motion.div>
      </div>
    </DashboardLayout>
  );
}

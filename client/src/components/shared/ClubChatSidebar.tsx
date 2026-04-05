import { useState, useEffect, useRef, useCallback } from "react";
import { Send, Loader2 } from "lucide-react";
import { wsClient } from "@/lib/ws-client";

interface ChatMessage {
  id: string;
  clubId: string;
  userId: string;
  username: string;
  displayName: string | null;
  avatarId: string | null;
  message: string;
  createdAt: string;
  isSystem?: boolean;
}

interface ClubChatSidebarProps {
  clubId?: string;
  clubName?: string;
  className?: string;
}

export function ClubChatSidebar({ clubId, clubName = "Club", className }: ClubChatSidebarProps) {
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const seenIdsRef = useRef(new Set<string>());

  // Auto-scroll to bottom
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  // Fetch history on mount / clubId change
  useEffect(() => {
    if (!clubId) return;
    setLoading(true);
    seenIdsRef.current.clear();

    fetch(`/api/clubs/${clubId}/chat?limit=50`, { credentials: "include" })
      .then(r => r.ok ? r.json() : [])
      .then((data: ChatMessage[]) => {
        for (const m of data) seenIdsRef.current.add(m.id);
        setMessages(data);
      })
      .catch(() => setMessages([]))
      .finally(() => setLoading(false));
  }, [clubId]);

  // Listen for WebSocket club_chat messages
  useEffect(() => {
    if (!clubId) return;

    const handler = (msg: any) => {
      if (msg.type !== "club_chat" || msg.clubId !== clubId) return;
      if (seenIdsRef.current.has(msg.id)) return;
      seenIdsRef.current.add(msg.id);
      setMessages(prev => [...prev, msg]);
    };

    const unsub = wsClient.on("club_chat", handler);
    return unsub;
  }, [clubId]);

  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const handleSend = async () => {
    const trimmed = message.trim();
    if (!trimmed || !clubId || sending) return;
    if (trimmed.length > 500) return;

    setMessage("");
    setSending(true);

    try {
      // Send via WebSocket if connected, otherwise fall back to REST
      if (wsClient.connected) {
        wsClient.send({ type: "club_chat", clubId, message: trimmed });
      } else {
        const res = await fetch(`/api/clubs/${clubId}/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ message: trimmed }),
        });
        if (res.ok) {
          const saved = await res.json();
          if (!seenIdsRef.current.has(saved.id)) {
            seenIdsRef.current.add(saved.id);
            setMessages(prev => [...prev, saved]);
          }
        }
      }
    } catch {
      // Silently fail — message will not appear
    } finally {
      setSending(false);
    }
  };

  const formatTime = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } catch {
      return "";
    }
  };

  return (
    <div
      className={className}
      style={{
        background: "rgba(10,10,12,0.7)",
        backdropFilter: "blur(12px)",
        border: "1px solid rgba(255,255,255,0.06)",
        borderRadius: "0.75rem",
      }}
    >
      <div className="px-3 py-2.5" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <h3
          className="text-[0.625rem] font-black uppercase tracking-[0.15em]"
          style={{ color: "#d4af37" }}
        >
          {clubName} Chat
        </h3>
      </div>

      <div
        ref={scrollContainerRef}
        className="px-3 py-2 space-y-2 max-h-[280px] overflow-y-auto scrollbar-thin"
      >
        {loading && (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="w-4 h-4 animate-spin text-white/30" />
          </div>
        )}

        {!loading && messages.length === 0 && (
          <p className="text-[0.625rem] text-white/20 text-center py-4">
            No messages yet. Start the conversation!
          </p>
        )}

        {messages.map((msg) => (
          <div key={msg.id}>
            {msg.isSystem ? (
              <p className="text-[0.625rem] text-amber-400/60 italic">
                {msg.message}
              </p>
            ) : (
              <div className="flex items-start gap-1.5">
                {/* Avatar */}
                <div
                  className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center text-[0.5rem] font-bold mt-0.5"
                  style={{
                    background: "rgba(212,175,55,0.15)",
                    border: "1px solid rgba(212,175,55,0.3)",
                    color: "#d4af37",
                  }}
                >
                  {(msg.displayName || msg.username || "?").charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-1.5">
                    <span
                      className="text-[0.6875rem] font-bold truncate"
                      style={{ color: "#d4af37" }}
                    >
                      {msg.displayName || msg.username}
                    </span>
                    <span className="text-[0.5rem] text-white/20 flex-shrink-0">
                      {formatTime(msg.createdAt)}
                    </span>
                  </div>
                  <p className="text-[0.6875rem] leading-relaxed text-white/70 break-words">
                    {msg.message}
                  </p>
                </div>
              </div>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="px-3 py-2" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="flex items-center gap-1.5">
          <input
            value={message}
            onChange={(e) => setMessage(e.target.value.slice(0, 500))}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
            placeholder={clubId ? "Type a message..." : "Join a club to chat"}
            disabled={!clubId || sending}
            maxLength={500}
            className="flex-1 px-2.5 py-1.5 rounded-lg text-[0.6875rem] text-white placeholder-white/20 outline-none disabled:opacity-40"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
            }}
          />
          <button
            onClick={handleSend}
            disabled={!clubId || !message.trim() || sending}
            className="p-1.5 rounded-lg transition-colors hover:bg-white/10 disabled:opacity-30"
            style={{ color: "#d4af37" }}
          >
            {sending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Send className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-[0.5rem] text-white/15">
            {message.length > 0 ? `${message.length}/500` : ""}
          </span>
        </div>
      </div>
    </div>
  );
}

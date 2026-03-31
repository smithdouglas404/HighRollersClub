import { useState } from "react";
import { Send } from "lucide-react";

interface ChatMessage {
  id: string;
  username: string;
  message: string;
  timestamp: Date;
  isSystem?: boolean;
}

interface ClubChatSidebarProps {
  clubName?: string;
  className?: string;
}

const MOCK_MESSAGES: ChatMessage[] = [
  { id: "1", username: "AceKing", message: "Anyone up for a high stakes game?", timestamp: new Date(Date.now() - 300000) },
  { id: "2", username: "System", message: "Jaitey5 joined the club", timestamp: new Date(Date.now() - 240000), isSystem: true },
  { id: "3", username: "ChipQueen", message: "GG everyone on that last tournament!", timestamp: new Date(Date.now() - 180000) },
  { id: "4", username: "BluffMaster", message: "Table 3 needs one more player", timestamp: new Date(Date.now() - 60000) },
  { id: "5", username: "System", message: "Weekly High Stakes tournament starts in 30 min", timestamp: new Date(Date.now() - 30000), isSystem: true },
];

export function ClubChatSidebar({ clubName = "Club", className }: ClubChatSidebarProps) {
  const [message, setMessage] = useState("");
  const [messages] = useState<ChatMessage[]>(MOCK_MESSAGES);

  const handleSend = () => {
    if (!message.trim()) return;
    setMessage("");
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
          Global Club Chat
        </h3>
      </div>

      <div className="px-3 py-2 space-y-2 max-h-[280px] overflow-y-auto scrollbar-thin">
        {messages.map((msg) => (
          <div key={msg.id}>
            {msg.isSystem ? (
              <p className="text-[0.625rem] text-cyan-400/60 italic">
                {msg.message}
              </p>
            ) : (
              <div className="text-[0.6875rem] leading-relaxed">
                <span className="font-bold" style={{ color: "#00d4ff" }}>
                  {msg.username}:
                </span>{" "}
                <span className="text-white/70">{msg.message}</span>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="px-3 py-2" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="flex items-center gap-1.5">
          <input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="Type a message..."
            className="flex-1 px-2.5 py-1.5 rounded-lg text-[0.6875rem] text-white placeholder-white/20 outline-none"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
            }}
          />
          <button
            onClick={handleSend}
            className="p-1.5 rounded-lg transition-colors hover:bg-white/10"
            style={{ color: "#00d4ff" }}
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

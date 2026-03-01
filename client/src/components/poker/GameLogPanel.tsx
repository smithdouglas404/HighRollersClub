import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import { wsClient } from "@/lib/ws-client";
import { Send, Mic, ChevronUp, ChevronDown, Clock, Coins, Trophy } from "lucide-react";

interface ChatMessage {
  id: string;
  userId: string;
  displayName: string;
  message: string;
  timestamp: number;
  isSystem?: boolean;
}

interface HandRecord {
  id: string;
  handNumber: number;
  potTotal: number;
  winnerIds: string[] | null;
  summary: any;
  commitmentHash: string | null;
  createdAt: string;
}

interface GameLogPanelProps {
  tableId?: string;
  isMultiplayer?: boolean;
  sendChat?: (message: string) => void;
}

export function GameLogPanel({ tableId, isMultiplayer, sendChat }: GameLogPanelProps) {
  const [, navigate] = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"log" | "chat">("log");

  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [unreadCount, setUnreadCount] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Hand history state
  const [hands, setHands] = useState<HandRecord[]>([]);
  const [loading, setLoading] = useState(false);

  // Helper to push a chat message
  const pushMessage = useCallback((msg: ChatMessage) => {
    setMessages(prev => [...prev, msg].slice(-100));
    if (!isOpen || activeTab !== "chat") setUnreadCount(prev => prev + 1);
  }, [isOpen, activeTab]);

  // Listen for incoming chat messages + system events
  useEffect(() => {
    if (!isMultiplayer) return;

    const makeId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

    const unsubChat = wsClient.on("chat", (msg: any) => {
      pushMessage({
        id: makeId(),
        userId: msg.userId,
        displayName: msg.displayName,
        message: msg.message,
        timestamp: Date.now(),
      });
    });

    const unsubJoin = wsClient.on("player_joined", (msg: any) => {
      pushMessage({
        id: makeId(),
        userId: "system",
        displayName: "System",
        message: `${msg.displayName || "A player"} joined the table`,
        timestamp: Date.now(),
        isSystem: true,
      });
    });

    const unsubLeave = wsClient.on("player_left", (msg: any) => {
      pushMessage({
        id: makeId(),
        userId: "system",
        displayName: "System",
        message: `${msg.displayName || "A player"} left the table`,
        timestamp: Date.now(),
        isSystem: true,
      });
    });

    const unsubShowdown = wsClient.on("showdown", (msg: any) => {
      if (msg.results?.length > 0) {
        const winner = msg.results[0];
        pushMessage({
          id: makeId(),
          userId: "system",
          displayName: "System",
          message: `${winner.displayName || "Winner"} wins ${winner.amount ? "$" + winner.amount.toLocaleString() : "the pot"}`,
          timestamp: Date.now(),
          isSystem: true,
        });
      }
    });

    const unsubBlind = wsClient.on("blind_increase", (msg: any) => {
      pushMessage({
        id: makeId(),
        userId: "system",
        displayName: "System",
        message: `Blinds increased to ${msg.sb}/${msg.bb}${msg.ante ? ` (ante ${msg.ante})` : ""}`,
        timestamp: Date.now(),
        isSystem: true,
      });
    });

    const unsubTaunt = wsClient.on("taunt", (msg: any) => {
      if (msg.userId && msg.text) {
        pushMessage({
          id: makeId(),
          userId: msg.userId,
          displayName: msg.displayName || "Player",
          message: msg.text,
          timestamp: Date.now(),
        });
      }
    });

    const unsubHistory = wsClient.on("chat_history", (msg: any) => {
      if (msg.messages?.length > 0) {
        const historyMsgs: ChatMessage[] = msg.messages.map((m: any) => ({
          id: `hist-${m.timestamp}-${Math.random().toString(36).slice(2, 6)}`,
          userId: m.userId,
          displayName: m.displayName,
          message: m.message,
          timestamp: new Date(m.timestamp).getTime(),
        }));
        setMessages(prev => [...historyMsgs, ...prev].slice(-100));
      }
    });

    return () => {
      unsubChat();
      unsubJoin();
      unsubLeave();
      unsubShowdown();
      unsubBlind();
      unsubTaunt();
      unsubHistory();
    };
  }, [isMultiplayer, pushMessage]);

  // Fetch hand history
  const fetchHands = useCallback(async () => {
    if (!tableId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/tables/${tableId}/hands?limit=20`);
      if (res.ok) setHands(await res.json());
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [tableId]);

  // Fetch hands when panel opens on log tab
  useEffect(() => {
    if (isOpen && activeTab === "log" && tableId) {
      fetchHands();
    }
  }, [isOpen, activeTab, tableId, fetchHands]);

  // Auto-scroll chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Clear unread when switching to chat tab
  useEffect(() => {
    if (isOpen && activeTab === "chat") {
      setUnreadCount(0);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, activeTab]);

  const handleSend = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed || !sendChat) return;
    sendChat(trimmed);
    setInput("");
  }, [input, sendChat]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Speech-to-text
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  const hasSpeechAPI = typeof window !== "undefined" && ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);

  const toggleSpeech = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
      setIsListening(false);
      return;
    }
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR || !sendChat) return;

    const recognition = new SR();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = async (event: any) => {
      const transcript = event.results?.[0]?.[0]?.transcript?.trim();
      if (!transcript) return;
      const isNonEnglish = /[^\x00-\x7F]/.test(transcript);
      if (isNonEnglish) {
        try {
          const resp = await fetch("/api/translate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: transcript }), credentials: "include" });
          if (resp.ok) {
            const data = await resp.json();
            sendChat(data.translated !== data.original ? `${data.translated} (translated)` : transcript);
          } else sendChat(transcript);
        } catch { sendChat(transcript); }
      } else sendChat(transcript);
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => { setIsListening(false); recognitionRef.current = null; };
    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }, [sendChat]);

  if (!isMultiplayer) return null;

  return (
    <div className="fixed left-3 bottom-3 z-40" style={{ width: 280 }}>
      {/* Collapsed bar — always visible */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-3 py-2 rounded-t-lg transition-colors"
        style={{
          background: "rgba(0,0,0,0.8)",
          border: "1px solid rgba(255,255,255,0.1)",
          borderBottom: isOpen ? "none" : "1px solid rgba(255,255,255,0.1)",
          borderRadius: isOpen ? "8px 8px 0 0" : "8px",
        }}
      >
        <div className="flex items-center gap-2">
          {/* Tab switcher */}
          <button
            onClick={(e) => { e.stopPropagation(); setActiveTab("log"); if (!isOpen) setIsOpen(true); }}
            className={`text-[0.625rem] font-bold uppercase tracking-wider px-2 py-0.5 rounded transition-colors ${
              activeTab === "log" ? "text-white bg-white/10" : "text-gray-500 hover:text-gray-300"
            }`}
          >
            Log
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setActiveTab("chat"); if (!isOpen) setIsOpen(true); }}
            className={`text-[0.625rem] font-bold uppercase tracking-wider px-2 py-0.5 rounded transition-colors relative ${
              activeTab === "chat" ? "text-white bg-white/10" : "text-gray-500 hover:text-gray-300"
            }`}
          >
            Chat
            {unreadCount > 0 && activeTab !== "chat" && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[0.5rem] font-bold flex items-center justify-center">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>
        </div>
        {isOpen ? (
          <ChevronDown className="w-3.5 h-3.5 text-gray-500" />
        ) : (
          <ChevronUp className="w-3.5 h-3.5 text-gray-500" />
        )}
      </button>

      {/* Expanded panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 280, opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden rounded-b-lg"
            style={{
              background: "rgba(0,0,0,0.8)",
              borderLeft: "1px solid rgba(255,255,255,0.1)",
              borderRight: "1px solid rgba(255,255,255,0.1)",
              borderBottom: "1px solid rgba(255,255,255,0.1)",
            }}
          >
            <div className="flex flex-col h-[280px]">
              {/* LOG TAB */}
              {activeTab === "log" && (
                <div className="flex-1 overflow-y-auto scrollbar-thin">
                  {loading ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="text-[0.625rem] text-gray-500">Loading...</div>
                    </div>
                  ) : hands.length === 0 ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="text-[0.625rem] text-gray-600">No hands played yet</div>
                    </div>
                  ) : (
                    hands.map((hand) => {
                      const winners = hand.summary?.winners || [];
                      const players = hand.summary?.players || [];
                      const playerMap = new Map<string, any>(players.map((p: any) => [p.id, p]));

                      return (
                        <div
                          key={hand.id}
                          className="px-3 py-2 border-b border-white/[0.04] hover:bg-white/[0.03] transition-colors cursor-pointer"
                          onClick={() => navigate(`/hands/${hand.id}`)}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-[0.6875rem] font-bold text-white">
                              Hand #{hand.handNumber}
                            </span>
                            <span className="text-[0.5625rem] text-gray-600 font-mono flex items-center gap-1">
                              <Clock className="w-2.5 h-2.5" />
                              {new Date(hand.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 mt-0.5 text-[0.5625rem]">
                            <span className="flex items-center gap-1 text-gray-400">
                              <Coins className="w-2.5 h-2.5" />
                              {(hand.potTotal || 0).toLocaleString()}
                            </span>
                            {winners.length > 0 && (
                              <span className="flex items-center gap-1 text-green-500/80">
                                <Trophy className="w-2.5 h-2.5" />
                                {playerMap.get(winners[0].playerId)?.displayName || "Winner"}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {/* CHAT TAB */}
              {activeTab === "chat" && (
                <>
                  <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5 scrollbar-thin">
                    {messages.length === 0 ? (
                      <div className="flex items-center justify-center h-full">
                        <p className="text-[0.625rem] text-gray-600">No messages yet</p>
                      </div>
                    ) : (
                      messages.map((msg) => (
                        <div key={msg.id}>
                          {msg.isSystem ? (
                            <div className="text-[0.5625rem] text-gray-500 italic py-0.5">
                              {msg.message}
                            </div>
                          ) : (
                            <div className="leading-snug">
                              <span className="text-[0.5625rem] font-bold text-cyan-400 mr-1">
                                {msg.displayName}
                              </span>
                              <span className="text-[0.5625rem] text-gray-600 mr-1.5">
                                {new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                              </span>
                              <span className="text-[0.6875rem] text-gray-300 break-words">
                                {msg.message}
                              </span>
                            </div>
                          )}
                        </div>
                      ))
                    )}
                    <div ref={messagesEndRef} />
                  </div>

                  {/* Chat input */}
                  <div className="px-2 py-2 border-t border-white/[0.06]">
                    <div className="flex items-center gap-1.5">
                      <input
                        ref={inputRef}
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Type a message..."
                        maxLength={200}
                        className="flex-1 bg-white/5 border border-white/10 rounded px-2 py-1.5 text-[0.6875rem] text-white placeholder-gray-600 focus:outline-none focus:border-white/20 transition-colors"
                      />
                      {hasSpeechAPI && (
                        <button
                          onClick={toggleSpeech}
                          className={`p-1.5 rounded border transition-colors ${
                            isListening
                              ? "bg-red-500/20 border-red-500/30 animate-pulse"
                              : "bg-white/5 border-white/10 hover:bg-white/10"
                          }`}
                          title={isListening ? "Stop recording" : "Voice input"}
                        >
                          <Mic className={`w-3 h-3 ${isListening ? "text-red-400" : "text-gray-500"}`} />
                        </button>
                      )}
                      <button
                        onClick={handleSend}
                        disabled={!input.trim()}
                        className="p-1.5 rounded bg-white/10 border border-white/10 hover:bg-white/15 transition-colors disabled:opacity-30"
                      >
                        <Send className="w-3 h-3 text-gray-400" />
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

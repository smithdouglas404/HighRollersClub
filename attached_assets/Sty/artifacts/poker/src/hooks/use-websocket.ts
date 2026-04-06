import { useState, useEffect, useRef, useCallback } from "react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export interface GameState {
  tableId: number;
  sessionId: number;
  phase: string;
  pot: number;
  communityCards: { suit: string; rank: string }[];
  dealerSeat: number;
  currentSeat: number | null;
  handNumber: number;
  players: GamePlayer[];
  tableName: string;
  smallBlind: number;
  bigBlind: number;
}

export interface GamePlayer {
  seatIndex: number;
  userId: number;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  chips: number;
  currentBet: number;
  status: string;
  isDealer: boolean;
  isTurn: boolean;
  lastAction: string | null;
  holeCards: { suit: string; rank: string }[] | null;
}

export interface ChatMessage {
  userId: number;
  username: string;
  message: string;
  timestamp: number;
}

interface UseTableWebSocketReturn {
  gameState: GameState | null;
  chatMessages: ChatMessage[];
  connected: boolean;
  sendChat: (message: string) => void;
}

export function useTableWebSocket(tableId: number): UseTableWebSocketReturn {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout>>();

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}${BASE}/api/ws`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      ws.send(JSON.stringify({ type: "subscribe", tableId }));
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        switch (msg.type) {
          case "game_state":
            setGameState(msg.data);
            break;
          case "chat":
            setChatMessages((prev) => [...prev.slice(-99), msg.data]);
            break;
        }
      } catch {}
    };

    ws.onclose = () => {
      setConnected(false);
      wsRef.current = null;
      reconnectTimer.current = setTimeout(connect, 2000);
    };

    ws.onerror = () => {
      ws.close();
    };
  }, [tableId]);

  useEffect(() => {
    connect();
    return () => {
      clearTimeout(reconnectTimer.current);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [connect]);

  const sendChat = useCallback((message: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "chat", message }));
    }
  }, []);

  return { gameState, chatMessages, connected, sendChat };
}

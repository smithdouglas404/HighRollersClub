import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "http";
import type { IncomingMessage } from "http";
import { logger } from "./logger";
import { getGameState } from "./game-engine";

interface TableClient {
  ws: WebSocket;
  userId: number;
  username: string;
}

const tableRooms = new Map<number, Set<TableClient>>();

let wss: WebSocketServer;

export function setupWebSocket(server: Server, sessionParser: any) {
  wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (req: IncomingMessage, socket, head) => {
    const url = new URL(req.url || "", `http://${req.headers.host}`);
    if (!url.pathname.endsWith("/ws")) {
      socket.destroy();
      return;
    }

    sessionParser(req as any, {} as any, () => {
      const session = (req as any).session;
      if (!session?.userId) {
        socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
        socket.destroy();
        return;
      }

      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit("connection", ws, req);
      });
    });
  });

  wss.on("connection", (ws: WebSocket, req: IncomingMessage) => {
    const session = (req as any).session;
    const userId = session.userId as number;
    const username = session.username as string || "unknown";

    let subscribedTable: number | null = null;

    ws.on("message", async (raw) => {
      try {
        const msg = JSON.parse(raw.toString());

        switch (msg.type) {
          case "subscribe": {
            const tableId = Number(msg.tableId);
            if (isNaN(tableId)) return;

            if (subscribedTable !== null) {
              unsubscribe(subscribedTable, ws);
            }

            subscribedTable = tableId;
            subscribe(tableId, { ws, userId, username });

            const state = await getGameState(tableId, userId);
            ws.send(JSON.stringify({ type: "game_state", data: state }));
            break;
          }

          case "unsubscribe": {
            if (subscribedTable !== null) {
              unsubscribe(subscribedTable, ws);
              subscribedTable = null;
            }
            break;
          }

          case "chat": {
            if (subscribedTable !== null && msg.message) {
              broadcastToTable(subscribedTable, {
                type: "chat",
                data: { userId, username, message: msg.message.slice(0, 200), timestamp: Date.now() },
              });
            }
            break;
          }
        }
      } catch (err) {
        logger.error({ err }, "WS message error");
      }
    });

    ws.on("close", () => {
      if (subscribedTable !== null) {
        unsubscribe(subscribedTable, ws);
      }
    });

    ws.on("error", (err) => {
      logger.error({ err }, "WS error");
    });
  });

  logger.info("WebSocket server initialized");
}

function subscribe(tableId: number, client: TableClient) {
  if (!tableRooms.has(tableId)) {
    tableRooms.set(tableId, new Set());
  }
  tableRooms.get(tableId)!.add(client);
}

function unsubscribe(tableId: number, ws: WebSocket) {
  const room = tableRooms.get(tableId);
  if (!room) return;
  for (const client of room) {
    if (client.ws === ws) {
      room.delete(client);
      break;
    }
  }
  if (room.size === 0) {
    tableRooms.delete(tableId);
  }
}

export function broadcastToTable(tableId: number, message: any, excludeWs?: WebSocket) {
  const room = tableRooms.get(tableId);
  if (!room) return;

  const raw = JSON.stringify(message);
  for (const client of room) {
    if (client.ws !== excludeWs && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(raw);
    }
  }
}

export async function broadcastGameState(tableId: number) {
  const room = tableRooms.get(tableId);
  if (!room || room.size === 0) return;

  for (const client of room) {
    if (client.ws.readyState === WebSocket.OPEN) {
      try {
        const state = await getGameState(tableId, client.userId);
        client.ws.send(JSON.stringify({ type: "game_state", data: state }));
      } catch (err) {
        logger.error({ err, userId: client.userId }, "Error broadcasting state");
      }
    }
  }
}

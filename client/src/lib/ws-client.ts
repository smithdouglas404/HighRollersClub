// WebSocket client with auto-reconnect

type MessageHandler = (msg: any) => void;

/** Decrypt AES-256-GCM encrypted cards using session key */
async function decryptCardsClient(encrypted: string, keyHex: string): Promise<any[] | null> {
  try {
    const [ivHex, authTagHex, ciphertextHex] = encrypted.split(":");
    const key = await crypto.subtle.importKey("raw", hexToBytes(keyHex), "AES-GCM", false, ["decrypt"]);
    const iv = hexToBytes(ivHex);
    const authTag = hexToBytes(authTagHex);
    const ciphertext = hexToBytes(ciphertextHex);
    // GCM auth tag is appended to ciphertext for Web Crypto
    const combined = new Uint8Array(ciphertext.length + authTag.length);
    combined.set(ciphertext);
    combined.set(authTag, ciphertext.length);
    const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, combined);
    return JSON.parse(new TextDecoder().decode(decrypted));
  } catch {
    return null;
  }
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return bytes;
}

class WsClient {
  private ws: WebSocket | null = null;
  private url: string = "";
  private handlers = new Map<string, Set<MessageHandler>>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectDelay = 1000;
  private maxReconnectDelay = 30000;
  private shouldReconnect = false;
  private _connected = false;
  private _cardKey: string | null = null;

  get connected() { return this._connected; }

  connect() {
    if (this.ws?.readyState === WebSocket.OPEN) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    this.url = `${protocol}//${window.location.host}/ws`;
    this.shouldReconnect = true;

    this.createConnection();
  }

  private createConnection() {
    try {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        this._connected = true;
        this.reconnectDelay = 1000;
        this.emit("_connected", {});
      };

      this.ws.onmessage = async (event) => {
        try {
          const msg = JSON.parse(event.data);

          // Store session encryption key + sprite mapping
          if (msg.type === "session_key" && msg.cardKey) {
            this._cardKey = msg.cardKey;
            // Store in card security module
            import("./card-security").then(cs => {
              cs.setSessionCardKey(msg.cardKey);
              if (msg.spriteMapping) {
                cs.decryptSpriteMapping(msg.spriteMapping, msg.cardKey);
              }
            }).catch(() => {});
            return;
          }

          // Decrypt encrypted cards in game state
          if (msg.type === "game_state" && msg.state?.players && this._cardKey) {
            for (const p of msg.state.players) {
              if (p._encryptedCards) {
                const decrypted = await decryptCardsClient(p._encryptedCards, this._cardKey);
                if (decrypted) {
                  p.cards = decrypted;
                }
                delete p._encryptedCards;
              }
            }
          }

          this.emit(msg.type, msg);
        } catch {
          // ignore invalid messages
        }
      };

      this.ws.onclose = () => {
        this._connected = false;
        this.emit("_disconnected", {});
        if (this.shouldReconnect) {
          this.scheduleReconnect();
        }
      };

      this.ws.onerror = () => {
        // onclose will fire after this
      };
    } catch {
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (this.shouldReconnect) {
        this.createConnection();
        this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.maxReconnectDelay);
      }
    }, this.reconnectDelay);
  }

  disconnect() {
    this.shouldReconnect = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close(1000);
      this.ws = null;
    }
    this._connected = false;
  }

  send(msg: any) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    } else {
      console.warn("[ws] message dropped (not connected):", msg.type);
    }
  }

  on(type: string, handler: MessageHandler) {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set());
    }
    this.handlers.get(type)!.add(handler);
    return () => {
      this.handlers.get(type)?.delete(handler);
    };
  }

  off(type: string, handler: MessageHandler) {
    this.handlers.get(type)?.delete(handler);
  }

  private emit(type: string, data: any) {
    this.handlers.get(type)?.forEach(h => h(data));
    this.handlers.get("*")?.forEach(h => h(data));
  }
}

export const wsClient = new WsClient();

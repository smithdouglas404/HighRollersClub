/**
 * WebSocket PubSub — Abstracts cross-process message broadcasting.
 *
 * Default: Local EventEmitter (single process, zero overhead).
 * To scale: Drop in Redis Pub/Sub so multiple Node processes can broadcast
 * to each other's WebSocket clients.
 *
 * Usage:
 *   pubsub.publish("table:abc123", { type: "game_state", state: {...} });
 *   pubsub.subscribe("table:abc123", (msg) => ws.send(JSON.stringify(msg)));
 */

import { EventEmitter } from "events";

export interface IPubSub {
  publish(channel: string, message: any): Promise<void>;
  subscribe(channel: string, handler: (message: any) => void): () => void;
  unsubscribe(channel: string): void;
}

/** In-process pub/sub via EventEmitter */
class LocalPubSub implements IPubSub {
  private emitter = new EventEmitter();

  constructor() {
    this.emitter.setMaxListeners(0); // unlimited listeners for many tables
  }

  async publish(channel: string, message: any): Promise<void> {
    this.emitter.emit(channel, message);
  }

  subscribe(channel: string, handler: (message: any) => void): () => void {
    this.emitter.on(channel, handler);
    return () => this.emitter.off(channel, handler);
  }

  unsubscribe(channel: string): void {
    this.emitter.removeAllListeners(channel);
  }
}

// Singleton — swap implementation here when adding Redis
let instance: IPubSub | null = null;

export function getPubSub(): IPubSub {
  if (!instance) {
    // Future: if (process.env.REDIS_URL) instance = new RedisPubSub();
    instance = new LocalPubSub();
  }
  return instance;
}

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
import Redis from "ioredis";

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

/** Redis-backed pub/sub using two ioredis connections */
class RedisPubSub implements IPubSub {
  private pub: Redis;
  private sub: Redis;
  private handlers = new Map<string, Set<(message: any) => void>>();

  constructor() {
    this.pub = new Redis(process.env.REDIS_URL!);
    this.sub = new Redis(process.env.REDIS_URL!);

    this.sub.on("message", (channel: string, raw: string) => {
      const channelHandlers = this.handlers.get(channel);
      if (!channelHandlers) return;
      try {
        const message = JSON.parse(raw);
        for (const handler of channelHandlers) {
          handler(message);
        }
      } catch {
        // Ignore malformed messages
      }
    });
  }

  async publish(channel: string, message: any): Promise<void> {
    await this.pub.publish(channel, JSON.stringify(message));
  }

  subscribe(channel: string, handler: (message: any) => void): () => void {
    let channelHandlers = this.handlers.get(channel);
    if (!channelHandlers) {
      channelHandlers = new Set();
      this.handlers.set(channel, channelHandlers);
      this.sub.subscribe(channel);
    }
    channelHandlers.add(handler);

    return () => {
      channelHandlers!.delete(handler);
      if (channelHandlers!.size === 0) {
        this.handlers.delete(channel);
        this.sub.unsubscribe(channel);
      }
    };
  }

  unsubscribe(channel: string): void {
    this.handlers.delete(channel);
    this.sub.unsubscribe(channel);
  }
}

// Singleton — returns Redis when REDIS_URL is set, otherwise local
let instance: IPubSub | null = null;

export function getPubSub(): IPubSub {
  if (!instance) {
    if (process.env.REDIS_URL) {
      instance = new RedisPubSub();
    } else {
      instance = new LocalPubSub();
    }
  }
  return instance;
}

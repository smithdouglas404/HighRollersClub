/**
 * Cache Adapter — Abstracts in-memory Map behind a swappable interface.
 *
 * Default: In-memory Map (single process).
 * Redis: When REDIS_URL is set, uses ioredis for distributed caching.
 *
 * Usage:
 *   const cache = createCache<string>("geo");
 *   await cache.set("1.2.3.4", "US", 3600);
 *   const country = await cache.get("1.2.3.4");
 */

import Redis from "ioredis";

export interface ICache<V = any> {
  get(key: string): Promise<V | undefined>;
  set(key: string, value: V, ttlSeconds?: number): Promise<void>;
  delete(key: string): Promise<boolean>;
  has(key: string): Promise<boolean>;
  clear(): Promise<void>;
  size(): Promise<number>;
}

/** In-memory cache with optional TTL */
class MemoryCache<V> implements ICache<V> {
  private store = new Map<string, { value: V; expiresAt: number | null }>();

  async get(key: string): Promise<V | undefined> {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value;
  }

  async set(key: string, value: V, ttlSeconds?: number): Promise<void> {
    this.store.set(key, {
      value,
      expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : null,
    });
  }

  async delete(key: string): Promise<boolean> {
    return this.store.delete(key);
  }

  async has(key: string): Promise<boolean> {
    const entry = this.store.get(key);
    if (!entry) return false;
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return false;
    }
    return true;
  }

  async clear(): Promise<void> {
    this.store.clear();
  }

  async size(): Promise<number> {
    // Lazy cleanup of expired entries
    const now = Date.now();
    for (const [key, entry] of this.store) {
      if (entry.expiresAt && now > entry.expiresAt) this.store.delete(key);
    }
    return this.store.size;
  }
}

/** Redis-backed cache using ioredis */
class RedisCache<V> implements ICache<V> {
  private client: Redis;
  private prefix: string;

  constructor(namespace?: string) {
    this.client = new Redis(process.env.REDIS_URL!);
    this.prefix = namespace ? `cache:${namespace}:` : "cache:";
  }

  private k(key: string): string {
    return this.prefix + key;
  }

  async get(key: string): Promise<V | undefined> {
    const raw = await this.client.get(this.k(key));
    if (raw === null) return undefined;
    try {
      return JSON.parse(raw) as V;
    } catch {
      return undefined;
    }
  }

  async set(key: string, value: V, ttlSeconds?: number): Promise<void> {
    const serialized = JSON.stringify(value);
    if (ttlSeconds) {
      await this.client.set(this.k(key), serialized, "EX", ttlSeconds);
    } else {
      await this.client.set(this.k(key), serialized);
    }
  }

  async delete(key: string): Promise<boolean> {
    const count = await this.client.del(this.k(key));
    return count > 0;
  }

  async has(key: string): Promise<boolean> {
    const exists = await this.client.exists(this.k(key));
    return exists === 1;
  }

  async clear(): Promise<void> {
    const keys = await this.client.keys(this.prefix + "*");
    if (keys.length > 0) {
      await this.client.del(...keys);
    }
  }

  async size(): Promise<number> {
    const keys = await this.client.keys(this.prefix + "*");
    return keys.length;
  }
}

// Factory — returns Redis when REDIS_URL is set, otherwise in-memory
export function createCache<V = any>(namespace?: string): ICache<V> {
  if (process.env.REDIS_URL) return new RedisCache<V>(namespace);
  return new MemoryCache<V>();
}

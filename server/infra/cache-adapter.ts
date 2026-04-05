/**
 * Cache Adapter — Abstracts in-memory Map behind a swappable interface.
 *
 * Default: In-memory Map (single process).
 * To scale: Drop in a Redis implementation of ICache.
 *
 * Usage:
 *   const cache = createCache<string>("geo");
 *   await cache.set("1.2.3.4", "US", 3600);
 *   const country = await cache.get("1.2.3.4");
 */

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

// Factory — swap implementation here when adding Redis
export function createCache<V = any>(_namespace?: string): ICache<V> {
  // Future: if (process.env.REDIS_URL) return new RedisCache<V>(namespace);
  return new MemoryCache<V>();
}

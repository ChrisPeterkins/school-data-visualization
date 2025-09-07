// Simple in-memory cache for development
// In production, consider using a proper caching solution

interface CacheEntry {
  data: any;
  expires: number;
}

class CacheService {
  private cache: Map<string, CacheEntry> = new Map();
  private defaultTTL = 3600; // 1 hour in seconds

  async get<T>(key: string): Promise<T | null> {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    if (Date.now() > entry.expires) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data;
  }

  async set(key: string, value: any, ttl?: number): Promise<void> {
    const expires = Date.now() + ((ttl || this.defaultTTL) * 1000);
    this.cache.set(key, { data: value, expires });
  }

  async del(key: string): Promise<void> {
    this.cache.delete(key);
  }

  async flush(): Promise<void> {
    this.cache.clear();
  }

  generateKey(...parts: string[]): string {
    return parts.join(':');
  }
}

export const cache = new CacheService();

// Stub for compatibility
export const redis = {
  on: () => {},
  connect: () => Promise.resolve(),
  disconnect: () => Promise.resolve(),
};
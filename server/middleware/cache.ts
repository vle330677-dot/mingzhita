import { Request, Response, NextFunction } from 'express';

// 简单的内存缓存中间件
interface CacheEntry {
  data: any;
  timestamp: number;
}

const cache = new Map<string, CacheEntry>();
const DEFAULT_TTL = 60 * 1000; // 60秒

export function cacheMiddleware(ttl: number = DEFAULT_TTL) {
  return (req: Request, res: Response, next: NextFunction) => {
    // 只缓存 GET 请求
    if (req.method !== 'GET') {
      return next();
    }

    const key = `${req.originalUrl || req.url}`;
    const cached = cache.get(key);

    if (cached && Date.now() - cached.timestamp < ttl) {
      return res.json(cached.data);
    }

    // 劫持 res.json 来缓存响应
    const originalJson = res.json.bind(res);
    res.json = function (data: any) {
      cache.set(key, { data, timestamp: Date.now() });
      return originalJson(data);
    };

    next();
  };
}

// 清除特定前缀的缓存
export function clearCacheByPrefix(prefix: string) {
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) {
      cache.delete(key);
    }
  }
}

// 清除所有缓存
export function clearAllCache() {
  cache.clear();
}

// 定期清理过期缓存
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of cache.entries()) {
    if (now - entry.timestamp > DEFAULT_TTL * 2) {
      cache.delete(key);
    }
  }
}, 5 * 60 * 1000); // 每5分钟清理一次

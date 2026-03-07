import { Request, Response, NextFunction } from 'express';
import type { RealtimeRuntime } from '../realtime';

const DEFAULT_TTL = 60 * 1000;

export function cacheMiddleware(runtime: RealtimeRuntime, ttl: number = DEFAULT_TTL) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.method !== 'GET') {
      return next();
    }

    void (async () => {
      const key = `${req.originalUrl || req.url}`;
      try {
        const cached = await runtime.getCacheValue(key, ttl);
        if (cached !== null) {
          return res.json(cached);
        }
      } catch (error) {
        console.error('[cache] read fallback', error);
      }

      const originalJson = res.json.bind(res);
      res.json = function jsonWithCache(data: any) {
        void runtime.setCacheValue(key, data, ttl).catch((error) => {
          console.error('[cache] write fallback', error);
        });
        return originalJson(data);
      };

      next();
    })();
  };
}

export async function clearCacheByPrefix(runtime: RealtimeRuntime, prefix: string) {
  await runtime.clearCacheByPrefix(prefix);
}

export async function clearAllCache(runtime: RealtimeRuntime) {
  await runtime.clearCacheByPrefix('');
}

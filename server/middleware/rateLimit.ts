import { Request, Response, NextFunction } from 'express';
import type { RealtimeRuntime } from '../realtime';

export function rateLimiter(
  runtime: RealtimeRuntime,
  options: {
    windowMs?: number;
    maxRequests?: number;
    keyGenerator?: (req: Request) => string;
  } = {}
) {
  const windowMs = options.windowMs || 60 * 1000;
  const maxRequests = options.maxRequests || 100;
  const keyGenerator = options.keyGenerator || ((req: Request) => {
    const userId = (req as any).user?.id || (req as any).admin?.userId;
    if (userId) return `user:${userId}`;

    const authHeader = String(req.headers.authorization || '').trim();
    if (authHeader.startsWith('Bearer ')) {
      return `token:${authHeader.slice(7).trim()}`;
    }

    return `ip:${req.ip || req.socket.remoteAddress || 'unknown'}`;
  });

  return (req: Request, res: Response, next: NextFunction) => {
    void (async () => {
      try {
        const result = await runtime.consumeRateLimit(keyGenerator(req), windowMs, maxRequests);
        if (!result.allowed) {
          return res.status(429).json({
            success: false,
            message: '\u8bf7\u6c42\u8fc7\u4e8e\u9891\u7e41\uff0c\u8bf7\u7a0d\u540e\u518d\u8bd5',
            retryAfter: result.retryAfter,
          });
        }
        next();
      } catch (error) {
        console.error('[rate-limit] runtime fallback', error);
        next();
      }
    })();
  };
}

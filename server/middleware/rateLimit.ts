import { Request, Response, NextFunction } from 'express';

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

// 清理过期的限流记录
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now > entry.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}, 60 * 1000); // 每分钟清理一次

export function rateLimiter(options: {
  windowMs?: number;
  maxRequests?: number;
  keyGenerator?: (req: Request) => string;
} = {}) {
  const windowMs = options.windowMs || 60 * 1000; // 默认1分钟
  const maxRequests = options.maxRequests || 100; // 默认100次/分钟
  const keyGenerator = options.keyGenerator || ((req: Request) => {
    // 优先使用用户ID，其次使用IP
    const userId = (req as any).user?.id || (req as any).admin?.userId;
    if (userId) return `user:${userId}`;
    return `ip:${req.ip || req.socket.remoteAddress || 'unknown'}`;
  });

  return (req: Request, res: Response, next: NextFunction) => {
    const key = keyGenerator(req);
    const now = Date.now();
    
    let entry = rateLimitStore.get(key);
    
    if (!entry || now > entry.resetTime) {
      entry = {
        count: 1,
        resetTime: now + windowMs
      };
      rateLimitStore.set(key, entry);
      return next();
    }
    
    entry.count++;
    
    if (entry.count > maxRequests) {
      return res.status(429).json({
        success: false,
        message: '请求过于频繁，请稍后再试',
        retryAfter: Math.ceil((entry.resetTime - now) / 1000)
      });
    }
    
    next();
  };
}

import { Router } from 'express';
import type { AppContext } from '../types';
import { loadOnlinePresenceFallback } from '../utils/presence';

export function createCompatRouter(ctx: AppContext) {
  const router = Router();
  const { db, runtime } = ctx;

  router.get('/debug/ping', (_req, res) => {
    res.json({ success: true, pong: true, ts: Date.now() });
  });

  router.get('/world/presence', async (_req, res) => {
    try {
      const merged = new Map<number, any>();
      for (const row of loadOnlinePresenceFallback(db)) {
        merged.set(Number(row.id || 0), row);
      }
      for (const row of await runtime.getWorldPresence()) {
        merged.set(Number(row.id || 0), row);
      }
      const players = Array.from(merged.values()).filter((row) => String(row.currentLocation || '').trim());
      res.json({ success: true, players });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error?.message || 'presence query failed',
        players: [],
      });
    }
  });

  router.get('/admin/users', (_req, res) => {
    try {
      const users = db.prepare(`SELECT * FROM users ORDER BY id DESC`).all() as any[];
      res.json({ success: true, users });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error?.message || 'users query failed',
        users: [],
      });
    }
  });

  router.get('/announcements/active', (_req, res) => {
    try {
      const rows = db.prepare(`SELECT * FROM announcements ORDER BY id DESC LIMIT 20`).all() as any[];
      res.json({ success: true, rows, announcements: rows });
    } catch {
      res.json({ success: true, rows: [], announcements: [] });
    }
  });

  return router;
}

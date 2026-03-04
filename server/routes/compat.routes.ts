import { Router } from 'express';
import { AppContext } from '../types';

export function createCompatRouter(ctx: AppContext) {
  const router = Router();
  const db = ctx.db;

  // 健康检查：联调探针
  router.get('/debug/ping', (_req, res) => {
    res.json({ success: true, pong: true, ts: Date.now() });
  });

  // 世界在线列表（推荐前端使用）
  router.get('/world/presence', (_req, res) => {
    try {
      const rows = db.prepare(`SELECT * FROM users ORDER BY id DESC`).all() as any[];
      const players = (rows || []).map((u) => ({
        id: Number(u.id),
        name: u.name || u.userName || '',
        role: u.role || '未分化',
        job: u.job || '无',
        currentLocation: u.currentLocation || u.locationId || '',
        status: u.status || '',
        avatarUrl: u.avatarUrl || '',
        avatarUpdatedAt: u.avatarUpdatedAt || null,
      }));
      res.json({ success: true, players });
    } catch (e: any) {
      res.status(500).json({
        success: false,
        message: e?.message || 'presence query failed',
        players: [],
      });
    }
  });

  // 兼容旧前端误用：admin/users 取玩家列表
  router.get('/admin/users', (_req, res) => {
    try {
      const users = db.prepare(`SELECT * FROM users ORDER BY id DESC`).all() as any[];
      res.json({ success: true, users });
    } catch (e: any) {
      res.status(500).json({
        success: false,
        message: e?.message || 'users query failed',
        users: [],
      });
    }
  });

  // 公告兼容：rows + announcements 双字段
  router.get('/announcements/active', (_req, res) => {
    try {
      const rows = db
        .prepare(`SELECT * FROM announcements ORDER BY id DESC LIMIT 20`)
        .all() as any[];
      res.json({ success: true, rows, announcements: rows });
    } catch {
      res.json({ success: true, rows: [], announcements: [] });
    }
  });

  return router;
}

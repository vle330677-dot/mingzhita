import { Router } from 'express';
import { AppContext } from '../types';
import { writeAdminLog } from '../utils/common';

export function createAnnouncementsRouter(ctx: AppContext) {
  const r = Router();
  const { db, auth } = ctx;

  r.post('/admin/announcements', auth.requireAdminAuth, (req: any, res) => {
    const { type, title, content } = req.body || {};
    if (!title || !content) return res.status(400).json({ success: false, message: 'title/content 必填' });

    const extra = JSON.stringify({ by: req.admin.name });
    db.prepare(`
      INSERT INTO announcements(type, title, content, extraJson, payload, createdAt, created_at)
      VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).run(type || 'system', title, content, extra, extra);

    writeAdminLog(db, req.admin.name, `发布公告 ${title}`, 'announcement', title);
    res.json({ success: true, message: `管理员 ${req.admin.name} 编辑了公告 ${title}` });
  });

  // 只保留这一份
  r.get('/announcements', (req, res) => {
    const sinceId = Math.max(0, Number(req.query.sinceId || 0));
    const limit = Math.max(1, Math.min(30, Number(req.query.limit || 10)));

    let rows: any[] = [];
    if (sinceId > 0) {
      rows = db.prepare(`
        SELECT id, type, title, content, extraJson, payload, createdAt, created_at
        FROM announcements
        WHERE id > ?
        ORDER BY id ASC
        LIMIT ?
      `).all(sinceId, limit);
    } else {
      rows = db.prepare(`
        SELECT id, type, title, content, extraJson, payload, createdAt, created_at
        FROM announcements
        ORDER BY id DESC
        LIMIT ?
      `).all(limit).reverse();
    }

    res.set('Cache-Control', 'no-store');
    res.json({ success: true, rows, announcements: rows });
  });

  return r;
}

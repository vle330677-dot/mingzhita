import { Router } from 'express';
import { AppContext } from '../types';
import { writeAdminLog } from '../utils/common';

const nowIso = () => new Date().toISOString();

function ensureAnnouncementTables(db: any) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS admin_contact_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER NOT NULL,
      userName TEXT NOT NULL DEFAULT '',
      title TEXT NOT NULL DEFAULT '',
      content TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'open',
      createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      handledAt TEXT DEFAULT ''
    )
  `);
}

export function createAnnouncementsRouter(ctx: AppContext) {
  const r = Router();
  const { db, auth } = ctx;
  ensureAnnouncementTables(db);

  r.post('/admin/announcements', auth.requireAdminAuth, (req: any, res) => {
    const { type, title, content } = req.body || {};
    if (!title || !content) return res.status(400).json({ success: false, message: 'title/content required' });

    const extra = JSON.stringify({ by: req.admin.name });
    db.prepare(`
      INSERT INTO announcements(type, title, content, extraJson, payload, createdAt, created_at)
      VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).run(type || 'system', title, content, extra, extra);

    writeAdminLog(db, req.admin.name, `发布公告 ${title}`, 'announcement', title);
    res.json({ success: true, message: `管理员 ${req.admin.name} 编辑了公告 ${title}` });
  });

  r.post('/announcements/messages', auth.requireUserAuth, (req: any, res) => {
    try {
      const userId = Number(req.user?.id || 0);
      const userName = String(req.user?.name || '').trim();
      const title = String(req.body?.title || '').trim();
      const content = String(req.body?.content || '').trim();
      if (!userId || !userName) return res.status(401).json({ success: false, message: '未登录' });
      if (!title || !content) {
        return res.status(400).json({ success: false, message: '请填写标题与内容' });
      }

      const ts = nowIso();
      db.prepare(`
        INSERT INTO admin_contact_messages(userId, userName, title, content, status, createdAt, updatedAt, handledAt)
        VALUES (?, ?, ?, ?, 'open', ?, ?, '')
      `).run(userId, userName, title, content, ts, ts);

      res.json({ success: true, message: '留言已提交到管理员后台' });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e?.message || 'create admin contact message failed' });
    }
  });

  r.get('/admin/announcements/messages', auth.requireAdminAuth, (_req: any, res) => {
    try {
      const rows = db.prepare(`
        SELECT id, userId, userName, title, content, status, createdAt, updatedAt, handledAt
        FROM admin_contact_messages
        ORDER BY CASE WHEN status = 'open' THEN 0 ELSE 1 END ASC,
                 datetime(createdAt) DESC,
                 id DESC
        LIMIT 200
      `).all() as any[];

      res.json({ success: true, rows });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e?.message || 'query admin contact messages failed', rows: [] });
    }
  });

  r.patch('/admin/announcements/messages/:id', auth.requireAdminAuth, (req: any, res) => {
    try {
      const id = Number(req.params.id || 0);
      const status = String(req.body?.status || '').trim().toLowerCase();
      if (!id || !['open', 'resolved'].includes(status)) {
        return res.status(400).json({ success: false, message: 'invalid params' });
      }

      const row = db.prepare(`SELECT id, title FROM admin_contact_messages WHERE id = ? LIMIT 1`).get(id) as any;
      if (!row) return res.status(404).json({ success: false, message: 'message not found' });

      const ts = nowIso();
      db.prepare(`
        UPDATE admin_contact_messages
        SET status = ?,
            updatedAt = ?,
            handledAt = CASE WHEN ? = 'resolved' THEN ? ELSE '' END
        WHERE id = ?
      `).run(status, ts, status, ts, id);

      writeAdminLog(
        db,
        String(req.admin?.name || 'admin'),
        `${status === 'resolved' ? '处理' : '重开'}玩家留言 ${String(row.title || `#${id}`)}`,
        'announcement_message',
        String(id)
      );

      res.json({ success: true, message: status === 'resolved' ? '已标记为已处理' : '已重新打开留言' });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e?.message || 'update admin contact message failed' });
    }
  });

  r.delete('/admin/announcements/messages/:id', auth.requireAdminAuth, (req: any, res) => {
    try {
      const id = Number(req.params.id || 0);
      if (!id) return res.status(400).json({ success: false, message: 'invalid id' });

      const row = db.prepare(`SELECT id, title FROM admin_contact_messages WHERE id = ? LIMIT 1`).get(id) as any;
      if (!row) return res.status(404).json({ success: false, message: 'message not found' });

      db.prepare(`DELETE FROM admin_contact_messages WHERE id = ?`).run(id);
      writeAdminLog(db, String(req.admin?.name || 'admin'), `删除玩家留言 ${String(row.title || `#${id}`)}`, 'announcement_message', String(id));
      res.json({ success: true, message: '留言已删除' });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e?.message || 'delete admin contact message failed' });
    }
  });

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

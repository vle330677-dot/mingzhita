import { Router } from 'express';
import type { AppContext } from '../types';
import { loadPresenceByUserId } from '../utils/presence';

function nowTime(value: unknown) {
  const raw = String(value || '').trim();
  const next = raw ? Date.parse(raw) : 0;
  return Number.isFinite(next) ? next : 0;
}

export function createRealtimeRouter(ctx: AppContext) {
  const router = Router();
  const { db, runtime } = ctx;

  router.get('/realtime/stream', (req, res) => {
    try {
      const token = String(req.query.token || '').trim();
      const userId = Number(req.query.userId || 0);
      if (!token || !userId) {
        return res.status(400).json({ success: false, message: 'invalid realtime params' });
      }

      const session = db.prepare(`
        SELECT token, userId, userName, createdAt
        FROM user_sessions
        WHERE token = ?
          AND role = 'player'
          AND revokedAt IS NULL
        LIMIT 1
      `).get(token) as { token: string; userId: number; userName: string; createdAt?: string } | undefined;
      if (!session || Number(session.userId || 0) !== userId) {
        return res.status(401).json({ success: false, code: 'SESSION_REVOKED', message: 'session revoked' });
      }

      const userRow = db.prepare(`SELECT forceOfflineAt FROM users WHERE id = ? LIMIT 1`).get(userId) as { forceOfflineAt?: string | null } | undefined;
      if (userRow?.forceOfflineAt && nowTime(userRow.forceOfflineAt) > nowTime(session.createdAt)) {
        return res.status(401).json({ success: false, code: 'SESSION_KICKED', message: 'session kicked' });
      }

      db.prepare(`UPDATE user_sessions SET lastSeenAt = CURRENT_TIMESTAMP WHERE token = ?`).run(token);

      res.status(200);
      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');
      res.flushHeaders?.();
      res.write('retry: 3000\n\n');

      const cleanup = runtime.registerUserStream(userId, res);
      const snapshot = loadPresenceByUserId(db, userId);
      if (snapshot) {
        void runtime.upsertPresence(snapshot);
      } else {
        void runtime.touchPresence(userId);
      }

      req.on('close', cleanup);
      req.on('end', cleanup);
      req.on('error', cleanup);
      return undefined;
    } catch (error: any) {
      if (!res.headersSent) {
        return res.status(500).json({ success: false, message: error?.message || 'realtime stream failed' });
      }
      try {
        res.end();
      } catch {
        // ignore
      }
      return undefined;
    }
  });

  return router;
}

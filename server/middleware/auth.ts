import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import type { AppDatabase } from '../db/types';
import { AuthPack } from '../types';

export const hashPassword = async (plain: string) => bcrypt.hash(plain, 10);
export const verifyPassword = async (plain: string, hash?: string | null) => {
  if (!hash) return false;
  return bcrypt.compare(plain, hash);
};

export function createAuth(db: AppDatabase): AuthPack {
  const issueToken = () => crypto.randomBytes(24).toString('hex');

  const getBearerToken = (req: any) => {
    const h = req.headers.authorization || '';
    if (!h.startsWith('Bearer ')) return '';
    return h.slice(7).trim();
  };

  const requireAdminAuth = (req: any, res: any, next: any) => {
    const token = getBearerToken(req);
    if (!token) return res.status(401).json({ success: false, message: '\u7f3a\u5c11\u7ba1\u7406\u5458\u4ee4\u724c' });

    const s = db.prepare(`
      SELECT * FROM user_sessions WHERE token = ? AND role='admin' AND revokedAt IS NULL
    `).get(token) as any;
    if (!s) return res.status(401).json({ success: false, message: '\u7ba1\u7406\u5458\u4f1a\u8bdd\u5931\u6548' });

    db.prepare(`UPDATE user_sessions SET lastSeenAt = CURRENT_TIMESTAMP WHERE token = ?`).run(token);
    req.admin = { userId: s.userId, name: s.userName, token: s.token };
    next();
  };

  const requireUserAuth = (req: any, res: any, next: any) => {
    const token = getBearerToken(req);
    if (!token) return res.status(401).json({ success: false, message: '\u672a\u767b\u5f55' });

    const s = db.prepare(`
      SELECT * FROM user_sessions WHERE token = ? AND role='player' AND revokedAt IS NULL
    `).get(token) as any;
    if (!s) return res.status(401).json({ success: false, code: 'SESSION_REVOKED', message: '\u4f1a\u8bdd\u5931\u6548' });

    const user = db.prepare(`SELECT forceOfflineAt FROM users WHERE id = ?`).get(s.userId) as any;
    if (user?.forceOfflineAt) {
      const forced = new Date(user.forceOfflineAt).getTime();
      const created = new Date(s.createdAt).getTime();
      if (forced > created) {
        return res.status(401).json({ success: false, code: 'SESSION_KICKED', message: '\u5df2\u5728\u5176\u4ed6\u8bbe\u5907\u767b\u5f55' });
      }
    }

    db.prepare(`UPDATE user_sessions SET lastSeenAt = CURRENT_TIMESTAMP WHERE token = ?`).run(token);
    req.user = { id: s.userId, name: s.userName, token: s.token };
    next();
  };

  return { requireAdminAuth, requireUserAuth, issueToken, getBearerToken };
}

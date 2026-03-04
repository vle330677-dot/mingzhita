import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import Database from 'better-sqlite3';
import { AuthPack } from '../types';

export const hashPassword = async (plain: string) => bcrypt.hash(plain, 10);
export const verifyPassword = async (plain: string, hash?: string | null) => {
  if (!hash) return false;
  return bcrypt.compare(plain, hash);
};

export function createAuth(db: Database.Database): AuthPack {
  const issueToken = () => crypto.randomBytes(24).toString('hex');

  const getBearerToken = (req: any) => {
    const h = req.headers.authorization || '';
    if (!h.startsWith('Bearer ')) return '';
    return h.slice(7).trim();
  };

  const requireAdminAuth = (req: any, res: any, next: any) => {
    const token = getBearerToken(req);
    if (!token) return res.status(401).json({ success: false, message: '缺少管理员令牌' });

    const s = db.prepare(`
      SELECT * FROM user_sessions WHERE token = ? AND role='admin' AND revokedAt IS NULL
    `).get(token) as any;
    if (!s) return res.status(401).json({ success: false, message: '管理员会话失效' });

    db.prepare(`UPDATE user_sessions SET lastSeenAt = CURRENT_TIMESTAMP WHERE token = ?`).run(token);
    req.admin = { userId: s.userId, name: s.userName, token: s.token };
    next();
  };

  const requireUserAuth = (req: any, res: any, next: any) => {
    const token = getBearerToken(req);
    if (!token) return res.status(401).json({ success: false, message: '未登录' });

    const s = db.prepare(`
      SELECT * FROM user_sessions WHERE token = ? AND role='player' AND revokedAt IS NULL
    `).get(token) as any;
    if (!s) return res.status(401).json({ success: false, code: 'SESSION_REVOKED', message: '会话失效' });

    const user = db.prepare(`SELECT forceOfflineAt FROM users WHERE id = ?`).get(s.userId) as any;
    if (user?.forceOfflineAt) {
      const forced = new Date(user.forceOfflineAt).getTime();
      const created = new Date(s.createdAt).getTime();
      if (forced > created) {
        return res.status(401).json({ success: false, code: 'SESSION_KICKED', message: '已在其他设备登录' });
      }
    }

    db.prepare(`UPDATE user_sessions SET lastSeenAt = CURRENT_TIMESTAMP WHERE token = ?`).run(token);
    req.user = { id: s.userId, name: s.userName, token: s.token };
    next();
  };

  return { requireAdminAuth, requireUserAuth, issueToken, getBearerToken };
}

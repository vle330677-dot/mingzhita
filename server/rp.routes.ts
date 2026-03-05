import express from 'express';
import Database from 'better-sqlite3';

type RPMessageRow = {
  id: number;
  sessionId: string;
  senderId: number | null;
  senderName: string;
  senderAvatar?: string | null;
  senderAvatarUpdatedAt?: string | null; // ✅ 新增：用于前端缓存破坏
  content: string;
  type: 'user' | 'system' | 'text';
  createdAt: string;
};

type MemberRow = {
  sessionId: string;
  userId: number;
  userName: string;
  role: string;
};

type SessionRow = {
  id: string;
  locationId: string;
  locationName: string;
  status: 'active' | 'closed' | 'ending' | 'mediating';
  endProposedBy: number | null;
};

type GroupMemberRow = {
  locationId: string;
  dateKey: string;
  archiveId: string;
  userId: number;
  userName: string;
  joinedAt: string;
  updatedAt: string;
};

const now = () => new Date().toISOString();
const GROUP_ARCHIVE_PREFIX = 'GRP-';
const GROUP_MEMBER_STALE_SECONDS = 180;

function toSafeUserId(v: unknown): number | null {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

function toSafeLocationId(v: unknown): string {
  return String(v || '').trim();
}

function getLocalDateKey() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function buildGroupArchiveId(dateKey: string, locationId: string) {
  return `${GROUP_ARCHIVE_PREFIX}${dateKey}-${locationId || 'unknown'}`;
}

function isGroupArchiveId(archiveId: string) {
  return String(archiveId || '').startsWith(GROUP_ARCHIVE_PREFIX);
}

function parseParticipantIds(raw: unknown): number[] {
  try {
    const arr = JSON.parse(String(raw || '[]'));
    if (!Array.isArray(arr)) return [];
    return arr.map((x) => Number(x)).filter((n) => Number.isFinite(n) && n > 0);
  } catch {
    return [];
  }
}

function mergeParticipantNames(rawNames: unknown, nextName: string) {
  const names = String(rawNames || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (nextName && !names.includes(nextName)) names.push(nextName);
  return names.join(', ');
}

function mapSessionShape(session: SessionRow, members: MemberRow[]) {
  const mA = members[0];
  const mB = members[1];
  return {
    sessionId: session.id,
    userAId: mA?.userId ?? 0,
    userAName: mA?.userName ?? '未知A',
    userBId: mB?.userId ?? 0,
    userBName: mB?.userName ?? '未知B',
    locationId: session.locationId,
    locationName: session.locationName,
    status: session.status,
    createdAt: null,
    updatedAt: null
  };
}

function getBearerToken(req: any) {
  const h = (req.headers?.authorization || '').trim();
  if (!h.startsWith('Bearer ')) return '';
  return h.slice(7).trim();
}

function toLimit(v: unknown, min: number, max: number, fallback: number) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

export function createRpRouter(db: Database.Database) {
  const router = express.Router();
  db.exec(`
    CREATE TABLE IF NOT EXISTS rp_mediation_invites (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sessionId TEXT NOT NULL,
      invitedUserId INTEGER NOT NULL,
      requestedByUserId INTEGER NOT NULL,
      requestedByName TEXT DEFAULT '',
      reason TEXT DEFAULT '',
      status TEXT DEFAULT 'pending',
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 管理员鉴权（用于后台档案读取/删除）
  const requireAdminAuth = (req: any, res: express.Response, next: express.NextFunction) => {
    try {
      const token = getBearerToken(req);
      if (!token) {
        return res.status(401).json({ success: false, message: '缺少管理员令牌' });
      }

      const s = db
        .prepare(
          `SELECT userId, userName, role, revokedAt
           FROM user_sessions
           WHERE token = ?
           LIMIT 1`
        )
        .get(token) as any;

      if (!s || s.revokedAt || s.role !== 'admin') {
        return res.status(401).json({ success: false, message: '管理员会话失效' });
      }

      db.prepare(`UPDATE user_sessions SET lastSeenAt = CURRENT_TIMESTAMP WHERE token = ?`).run(token);
      req.admin = { userId: Number(s.userId), name: s.userName, token };
      next();
    } catch (e: any) {
      return res.status(500).json({ success: false, message: e.message || '鉴权失败' });
    }
  };

  const cleanupGroupMembers = (dateKey: string, locationId?: string) => {
    db.prepare(`DELETE FROM active_group_rp_members WHERE dateKey <> ?`).run(dateKey);
    if (locationId) {
      db.prepare(`
        DELETE FROM active_group_rp_members
        WHERE dateKey = ?
          AND locationId = ?
          AND datetime(updatedAt) < datetime('now', ?)
      `).run(dateKey, locationId, `-${GROUP_MEMBER_STALE_SECONDS} seconds`);
    } else {
      db.prepare(`
        DELETE FROM active_group_rp_members
        WHERE dateKey = ?
          AND datetime(updatedAt) < datetime('now', ?)
      `).run(dateKey, `-${GROUP_MEMBER_STALE_SECONDS} seconds`);
    }
  };

  const ensureGroupArchive = (archiveId: string, locationId: string, locationName: string) => {
    const exists = db.prepare(`SELECT id FROM rp_archives WHERE id = ? LIMIT 1`).get(archiveId);
    if (exists) return;
    db.prepare(`
      INSERT INTO rp_archives
      (id, title, locationId, locationName, participants, participantNames, status, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, 'active', ?)
    `).run(
      archiveId,
      `${locationName || locationId || '未知地点'} 群戏回顾（${archiveId.replace(GROUP_ARCHIVE_PREFIX, '').slice(0, 10)}）`,
      locationId || 'unknown',
      locationName || locationId || '未知地点',
      '[]',
      '',
      now()
    );
  };

  const touchGroupArchiveParticipants = (archiveId: string, userId: number, userName: string, locationName: string) => {
    const arc = db.prepare(`
      SELECT participants, participantNames
      FROM rp_archives
      WHERE id = ?
      LIMIT 1
    `).get(archiveId) as { participants?: string; participantNames?: string } | undefined;
    if (!arc) return;

    const ids = parseParticipantIds(arc.participants);
    if (!ids.includes(userId)) ids.push(userId);
    const names = mergeParticipantNames(arc.participantNames, userName);
    db.prepare(`
      UPDATE rp_archives
      SET participants = ?,
          participantNames = ?,
          locationName = COALESCE(NULLIF(?, ''), locationName)
      WHERE id = ?
    `).run(JSON.stringify(ids), names, locationName || '', archiveId);
  };

  // 1) 建立/续用会话（前端先开窗，这里异步 upsert）
  router.post('/rp/session/upsert', (req, res) => {
    try {
      const { sessionId, userAId, userAName, userBId, userBName, locationId, locationName } = req.body || {};

      const aId = toSafeUserId(userAId);
      const bId = toSafeUserId(userBId);

      if (!sessionId || !aId || !bId) {
        return res.status(400).json({ success: false, message: '参数不完整' });
      }
      if (aId === bId) {
        return res.status(400).json({ success: false, message: '会话双方不能是同一人' });
      }

      const existingActivePair = db.prepare(`
        SELECT s.id
        FROM active_rp_sessions s
        JOIN active_rp_members m1 ON m1.sessionId = s.id
        JOIN active_rp_members m2 ON m2.sessionId = s.id
        WHERE s.status IN ('active', 'mediating')
          AND (
            (m1.userId = ? AND m2.userId = ?)
            OR
            (m1.userId = ? AND m2.userId = ?)
          )
        LIMIT 1
      `).get(aId, bId, bId, aId) as { id?: string } | undefined;

      const finalSessionId = String(existingActivePair?.id || sessionId);
      const getSession = db.prepare(`SELECT * FROM active_rp_sessions WHERE id = ?`);
      const oldSession = getSession.get(finalSessionId) as SessionRow | undefined;

      const tx = db.transaction(() => {
        if (!oldSession) {
          db.prepare(`
            INSERT INTO active_rp_sessions (id, locationId, locationName, status, endProposedBy)
            VALUES (?, ?, ?, 'active', NULL)
          `).run(finalSessionId, locationId || 'unknown', locationName || '未知区域');

          db.prepare(`
            INSERT INTO active_rp_messages (sessionId, senderId, senderName, content, type)
            VALUES (?, ?, ?, ?, ?)
          `).run(finalSessionId, 0, '系统', '对戏已建立连接。', 'system');
        } else {
          db.prepare(`
            UPDATE active_rp_sessions
            SET status = 'active',
                endProposedBy = NULL,
                locationId = ?,
                locationName = ?
            WHERE id = ?
          `).run(
            locationId || oldSession.locationId || 'unknown',
            locationName || oldSession.locationName || '未知区域',
            finalSessionId
          );
        }

        // 无论新旧都补齐成员（防止成员表意外缺行）
        db.prepare(`
          INSERT OR IGNORE INTO active_rp_members (sessionId, userId, userName, role)
          VALUES (?, ?, ?, ?)
        `).run(finalSessionId, aId, userAName || `U${aId}`, '未知');

        db.prepare(`
          INSERT OR IGNORE INTO active_rp_members (sessionId, userId, userName, role)
          VALUES (?, ?, ?, ?)
        `).run(finalSessionId, bId, userBName || `U${bId}`, '未知');

        // 重新激活时清空离场记录
        db.prepare(`DELETE FROM active_rp_leaves WHERE sessionId = ?`).run(finalSessionId);
      });

      tx();
      return res.json({ success: true, sessionId: finalSessionId });
    } catch (e: any) {
      return res.status(500).json({ success: false, message: e.message || 'upsert失败' });
    }
  });

  // 2) 获取某用户当前活跃会话
  router.get('/rp/session/active/:userId', (req, res) => {
    try {
      const userId = toSafeUserId(req.params.userId);
      if (!userId) return res.status(400).json({ success: false, message: 'userId 非法' });

      const row = db.prepare(`
        SELECT s.*
        FROM active_rp_sessions s
        JOIN active_rp_members m ON m.sessionId = s.id
        WHERE m.userId = ? AND s.status IN ('active', 'mediating')
        ORDER BY s.id DESC
        LIMIT 1
      `).get(userId) as SessionRow | undefined;

      if (!row) return res.json({ success: true, sessionId: null, session: null });

      const members = db.prepare(`
        SELECT * FROM active_rp_members
        WHERE sessionId = ?
        ORDER BY userId ASC
      `).all(row.id) as MemberRow[];

      return res.json({
        success: true,
        sessionId: row.id,
        session: mapSessionShape(row, members)
      });
    } catch (e: any) {
      return res.status(500).json({ success: false, message: e.message || '查询失败' });
    }
  });

  // 3) 拉会话+消息（RoleplayWindow用）
  router.get('/rp/session/:sessionId/messages', (req, res) => {
    try {
      const sessionId = req.params.sessionId;
      const session = db.prepare(`SELECT * FROM active_rp_sessions WHERE id = ?`).get(sessionId) as SessionRow | undefined;
      if (!session) return res.status(404).json({ success: false, message: '会话不存在' });

      const members = db.prepare(`
        SELECT * FROM active_rp_members
        WHERE sessionId = ?
        ORDER BY userId ASC
      `).all(sessionId) as MemberRow[];

      let messages: RPMessageRow[] = [];
      try {
        messages = db.prepare(`
          SELECT
            m.id,
            m.sessionId,
            m.senderId,
            m.senderName,
            m.content,
            m.type,
            m.createdAt,
            u.avatarUrl as senderAvatar,
            u.avatarUpdatedAt as senderAvatarUpdatedAt
          FROM active_rp_messages m
          LEFT JOIN users u ON u.id = m.senderId
          WHERE m.sessionId = ?
          ORDER BY m.id ASC
        `).all(sessionId) as RPMessageRow[];
      } catch {
        // 兼容旧库缺少 avatarUpdatedAt 字段
        messages = db.prepare(`
          SELECT
            m.id,
            m.sessionId,
            m.senderId,
            m.senderName,
            m.content,
            m.type,
            m.createdAt,
            u.avatarUrl as senderAvatar,
            NULL as senderAvatarUpdatedAt
          FROM active_rp_messages m
          LEFT JOIN users u ON u.id = m.senderId
          WHERE m.sessionId = ?
          ORDER BY m.id ASC
        `).all(sessionId) as RPMessageRow[];
      }

      return res.json({
        success: true,
        session: mapSessionShape(session, members),
        messages
      });
    } catch (e: any) {
      return res.status(500).json({ success: false, message: e.message || '拉取失败' });
    }
  });

  // 4) 发消息
  router.post('/rp/session/:sessionId/messages', (req, res) => {
    try {
      const sessionId = req.params.sessionId;
      const { senderId, senderName, content } = req.body || {};

      const text = String(content ?? '').trim();
      if (!text) {
        return res.status(400).json({ success: false, message: '消息不能为空' });
      }

      const sid = toSafeUserId(senderId);
      if (!sid) {
        return res.status(400).json({ success: false, message: 'senderId 非法' });
      }

      const exists = db.prepare(`
        SELECT id, status
        FROM active_rp_sessions
        WHERE id = ?
      `).get(sessionId) as SessionRow | undefined;

      if (!exists) return res.status(404).json({ success: false, message: '会话不存在' });
      if (!['active', 'mediating'].includes(String(exists.status || ''))) {
        return res.status(400).json({ success: false, message: '会话已结束' });
      }

      const member = db.prepare(`
        SELECT * FROM active_rp_members
        WHERE sessionId = ? AND userId = ?
      `).get(sessionId, sid) as MemberRow | undefined;

      if (!member) {
        return res.status(403).json({ success: false, message: '你不在该会话中' });
      }

      db.prepare(`
        INSERT INTO active_rp_messages (sessionId, senderId, senderName, content, type)
        VALUES (?, ?, ?, ?, 'user')
      `).run(sessionId, sid, senderName || member.userName || `U${sid}`, text);

      return res.json({ success: true });
    } catch (e: any) {
      return res.status(500).json({ success: false, message: e.message || '发送失败' });
    }
  });

  // 5) 离开会话：双方都离开 => 归档到 rp_archives + rp_archive_messages
  router.post('/rp/session/:sessionId/leave', (req, res) => {
    try {
      const sessionId = req.params.sessionId;
      const { userId, userName } = req.body || {};
      const uid = toSafeUserId(userId);

      if (!uid) {
        return res.status(400).json({ success: false, message: 'userId 非法' });
      }

      const session = db.prepare(`SELECT * FROM active_rp_sessions WHERE id = ?`).get(sessionId) as SessionRow | undefined;
      if (!session) return res.status(404).json({ success: false, message: '会话不存在' });

      // 已关闭就直接返回，防止重复归档
      if (session.status === 'closed') {
        return res.json({ success: true, closed: true, message: '会话已归档' });
      }

      const member = db.prepare(`
        SELECT * FROM active_rp_members
        WHERE sessionId = ? AND userId = ?
      `).get(sessionId, uid) as MemberRow | undefined;

      if (!member) {
        return res.status(403).json({ success: false, message: '你不在该会话中' });
      }

      const tx = db.transaction(() => {
        const alreadyLeft = db.prepare(`
          SELECT 1 FROM active_rp_leaves
          WHERE sessionId = ? AND userId = ?
        `).get(sessionId, uid);

        db.prepare(`
          INSERT OR REPLACE INTO active_rp_leaves (sessionId, userId, leftAt)
          VALUES (?, ?, CURRENT_TIMESTAMP)
        `).run(sessionId, uid);

        // 避免同一人重复点离开刷系统消息
        if (!alreadyLeft) {
          db.prepare(`
            INSERT INTO active_rp_messages (sessionId, senderId, senderName, content, type)
            VALUES (?, 0, '系统', ?, 'system')
          `).run(sessionId, `${userName || member.userName || `U${uid}`} 离开了对戏`);
        }

        const memberCount = (db.prepare(`
          SELECT COUNT(*) as c
          FROM active_rp_members
          WHERE sessionId = ?
        `).get(sessionId) as any).c as number;

        // 只统计“既在 leave 表又在 members 表”的用户
        const leaveCount = (db.prepare(`
          SELECT COUNT(*) as c
          FROM active_rp_leaves l
          JOIN active_rp_members m
            ON m.sessionId = l.sessionId
           AND m.userId = l.userId
          WHERE l.sessionId = ?
        `).get(sessionId) as any).c as number;

        if (memberCount > 0 && leaveCount >= memberCount) {
          db.prepare(`UPDATE active_rp_sessions SET status = 'closed' WHERE id = ?`).run(sessionId);

          const members = db.prepare(`
            SELECT * FROM active_rp_members
            WHERE sessionId = ?
            ORDER BY userId ASC
          `).all(sessionId) as MemberRow[];

          const msgs = db.prepare(`
            SELECT senderId, senderName, content, type, createdAt
            FROM active_rp_messages
            WHERE sessionId = ?
            ORDER BY id ASC
          `).all(sessionId) as Array<{
            senderId: number | null;
            senderName: string;
            content: string;
            type: string;
            createdAt: string;
          }>;

          const participantIds = JSON.stringify(members.map((m) => m.userId));
          const participantNames = members.map((m) => m.userName).join(', ');
          // 用稳定 ID 防止重复归档
          const archiveId = `ARC-${sessionId}`;

          const arcExists = db.prepare(`SELECT 1 FROM rp_archives WHERE id = ?`).get(archiveId);
          if (!arcExists) {
            db.prepare(`
              INSERT INTO rp_archives
              (id, title, locationId, locationName, participants, participantNames, status, createdAt)
              VALUES (?, ?, ?, ?, ?, ?, 'active', ?)
            `).run(
              archiveId,
              `${session.locationName || '未知地点'} 对戏存档`,
              session.locationId || 'unknown',
              session.locationName || '未知地点',
              participantIds,
              participantNames,
              now()
            );

            const ins = db.prepare(`
              INSERT INTO rp_archive_messages (archiveId, senderId, senderName, content, type, createdAt)
              VALUES (?, ?, ?, ?, ?, ?)
            `);

            msgs.forEach((m) => {
              ins.run(archiveId, m.senderId ?? 0, m.senderName || '未知', m.content || '', m.type || 'text', m.createdAt || now());
            });
          }
        }
      });

      tx();

      const closed = (db.prepare(`SELECT status FROM active_rp_sessions WHERE id = ?`).get(sessionId) as any)?.status === 'closed';
      return res.json({ success: true, closed });
    } catch (e: any) {
      return res.status(500).json({ success: false, message: e.message || '离开失败' });
    }
  });

  router.post('/rp/session/:sessionId/mediate/request', (req, res) => {
    try {
      const sessionId = String(req.params.sessionId || '').trim();
      const userId = toSafeUserId(req.body?.userId);
      const userName = String(req.body?.userName || '').trim();
      const reason = String(req.body?.reason || '').trim();
      if (!sessionId || !userId) return res.status(400).json({ success: false, message: '参数不完整' });

      const session = db.prepare(`SELECT * FROM active_rp_sessions WHERE id = ? LIMIT 1`).get(sessionId) as SessionRow | undefined;
      if (!session) return res.status(404).json({ success: false, message: '会话不存在' });
      if (session.status === 'closed') return res.status(400).json({ success: false, message: '会话已关闭' });

      const isMember = db.prepare(`SELECT 1 FROM active_rp_members WHERE sessionId = ? AND userId = ? LIMIT 1`).get(sessionId, userId);
      if (!isMember) return res.status(403).json({ success: false, message: '你不在该会话中' });

      db.prepare(`UPDATE active_rp_sessions SET status = 'mediating' WHERE id = ?`).run(sessionId);
      db.prepare(`
        INSERT INTO active_rp_messages(sessionId, senderId, senderName, content, type)
        VALUES(?, 0, '系统', ?, 'system')
      `).run(sessionId, `${userName || `U${userId}`} 发起了评理请求${reason ? `：${reason}` : ''}`);

      const candidates = db.prepare(`
        SELECT u.id, u.name
        FROM users u
        WHERE u.id NOT IN (SELECT userId FROM active_rp_members WHERE sessionId = ?)
          AND (
            u.faction LIKE '%军%'
            OR u.job LIKE '%军%'
            OR u.currentLocation = 'army'
          )
          AND EXISTS (
            SELECT 1
            FROM user_sessions s
            WHERE s.userId = u.id
              AND s.role = 'player'
              AND s.revokedAt IS NULL
              AND datetime(s.lastSeenAt) >= datetime('now', '-30 seconds')
          )
        ORDER BY u.id DESC
        LIMIT 20
      `).all(sessionId) as Array<{ id: number; name: string }>;

      const ins = db.prepare(`
        INSERT INTO rp_mediation_invites(sessionId, invitedUserId, requestedByUserId, requestedByName, reason, status, createdAt, updatedAt)
        VALUES(?,?,?,?,?,'pending',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
      `);
      let inviteCount = 0;
      for (const c of candidates) {
        const pendingExists = db.prepare(`
          SELECT 1
          FROM rp_mediation_invites
          WHERE sessionId = ?
            AND invitedUserId = ?
            AND status = 'pending'
          LIMIT 1
        `).get(sessionId, Number(c.id));
        if (pendingExists) continue;
        ins.run(sessionId, Number(c.id), userId, userName || `U${userId}`, reason);
        inviteCount++;
      }

      return res.json({ success: true, inviteCount, message: inviteCount > 0 ? `已向 ${inviteCount} 名军队玩家发出评理邀请` : '当前无可邀请的军队在线玩家' });
    } catch (e: any) {
      return res.status(500).json({ success: false, message: e?.message || '发起评理失败' });
    }
  });

  router.get('/rp/mediation/invites/:userId', (req, res) => {
    try {
      const userId = toSafeUserId(req.params.userId);
      if (!userId) return res.status(400).json({ success: false, message: 'userId 非法' });
      const rows = db.prepare(`
        SELECT
          i.id,
          i.sessionId,
          i.invitedUserId,
          i.requestedByUserId,
          i.requestedByName,
          i.reason,
          i.status,
          i.createdAt,
          s.locationName
        FROM rp_mediation_invites i
        LEFT JOIN active_rp_sessions s ON s.id = i.sessionId
        WHERE i.invitedUserId = ?
          AND i.status = 'pending'
        ORDER BY i.id ASC
      `).all(userId) as any[];

      return res.json({
        success: true,
        invites: rows.map((x) => ({
          id: Number(x.id),
          sessionId: String(x.sessionId || ''),
          invitedUserId: Number(x.invitedUserId || 0),
          requestedByUserId: Number(x.requestedByUserId || 0),
          requestedByName: String(x.requestedByName || ''),
          reason: String(x.reason || ''),
          status: String(x.status || 'pending'),
          locationName: String(x.locationName || '未知地点'),
          createdAt: String(x.createdAt || '')
        }))
      });
    } catch (e: any) {
      return res.status(500).json({ success: false, message: e?.message || '读取评理邀请失败', invites: [] });
    }
  });

  router.post('/rp/mediation/invites/:inviteId/respond', (req, res) => {
    try {
      const inviteId = Number(req.params.inviteId);
      const userId = toSafeUserId(req.body?.userId);
      const accept = Boolean(req.body?.accept);
      if (!inviteId || !userId) return res.status(400).json({ success: false, message: '参数不完整' });

      const invite = db.prepare(`SELECT * FROM rp_mediation_invites WHERE id = ? LIMIT 1`).get(inviteId) as any;
      if (!invite) return res.status(404).json({ success: false, message: '邀请不存在' });
      if (Number(invite.invitedUserId) !== userId) return res.status(403).json({ success: false, message: '无权处理该邀请' });
      if (String(invite.status || '') !== 'pending') return res.json({ success: true, status: invite.status, message: '邀请已处理' });

      const session = db.prepare(`SELECT * FROM active_rp_sessions WHERE id = ? LIMIT 1`).get(String(invite.sessionId || '')) as SessionRow | undefined;
      if (!session || session.status === 'closed') {
        db.prepare(`UPDATE rp_mediation_invites SET status='expired', updatedAt=CURRENT_TIMESTAMP WHERE id=?`).run(inviteId);
        return res.status(400).json({ success: false, message: '会话已关闭或不存在' });
      }

      if (!accept) {
        db.prepare(`UPDATE rp_mediation_invites SET status='rejected', updatedAt=CURRENT_TIMESTAMP WHERE id=?`).run(inviteId);
        return res.json({ success: true, status: 'rejected', message: '已拒绝评理邀请' });
      }

      const user = db.prepare(`SELECT id, name, role FROM users WHERE id = ? LIMIT 1`).get(userId) as any;
      const uname = String(user?.name || `U${userId}`);
      const urole = String(user?.role || '调解员');
      db.prepare(`
        INSERT OR IGNORE INTO active_rp_members (sessionId, userId, userName, role)
        VALUES (?, ?, ?, ?)
      `).run(String(invite.sessionId || ''), userId, uname, urole);
      db.prepare(`
        INSERT INTO active_rp_messages (sessionId, senderId, senderName, content, type)
        VALUES (?, 0, '系统', ?, 'system')
      `).run(String(invite.sessionId || ''), `${uname} 已加入评理对话`);
      db.prepare(`UPDATE rp_mediation_invites SET status='accepted', updatedAt=CURRENT_TIMESTAMP WHERE id=?`).run(inviteId);

      return res.json({ success: true, status: 'accepted', sessionId: String(invite.sessionId || ''), message: '已加入评理会话' });
    } catch (e: any) {
      return res.status(500).json({ success: false, message: e?.message || '处理评理邀请失败' });
    }
  });

  // 群戏：加入（按 日期+地图 归档）
  router.post('/rp/group/join', (req, res) => {
    try {
      const userId = toSafeUserId(req.body?.userId);
      const bodyLocationId = toSafeLocationId(req.body?.locationId);
      const bodyLocationName = String(req.body?.locationName || '').trim();
      const bodyUserName = String(req.body?.userName || '').trim();

      if (!userId) return res.status(400).json({ success: false, message: 'userId 非法' });
      if (!bodyLocationId) return res.status(400).json({ success: false, message: 'locationId 必填' });

      const user = db.prepare(`
        SELECT id, name, status, currentLocation
        FROM users
        WHERE id = ?
        LIMIT 1
      `).get(userId) as any;
      if (!user) return res.status(404).json({ success: false, message: '用户不存在' });
      if (!['approved', 'ghost'].includes(String(user.status || ''))) {
        return res.status(403).json({ success: false, message: '当前状态无法加入群戏' });
      }

      const currentLocationId = toSafeLocationId(user.currentLocation);
      if (currentLocationId && currentLocationId !== bodyLocationId) {
        return res.status(400).json({ success: false, message: '你已不在该地图，无法加入群戏' });
      }

      const locationId = currentLocationId || bodyLocationId;
      const locationName = bodyLocationName || locationId || '未知地点';
      const userName = bodyUserName || String(user.name || `U${userId}`);
      const dateKey = getLocalDateKey();
      const archiveId = buildGroupArchiveId(dateKey, locationId || 'unknown');

      const tx = db.transaction(() => {
        cleanupGroupMembers(dateKey, locationId);
        ensureGroupArchive(archiveId, locationId, locationName);

        const existed = db.prepare(`
          SELECT 1
          FROM active_group_rp_members
          WHERE locationId = ?
            AND dateKey = ?
            AND userId = ?
          LIMIT 1
        `).get(locationId, dateKey, userId);

        db.prepare(`
          INSERT INTO active_group_rp_members
          (locationId, dateKey, archiveId, userId, userName, joinedAt, updatedAt)
          VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          ON CONFLICT(locationId, dateKey, userId)
          DO UPDATE SET
            archiveId = excluded.archiveId,
            userName = excluded.userName,
            updatedAt = CURRENT_TIMESTAMP
        `).run(locationId, dateKey, archiveId, userId, userName);

        touchGroupArchiveParticipants(archiveId, userId, userName, locationName);
        if (!existed) {
          db.prepare(`
            INSERT INTO rp_archive_messages (archiveId, senderId, senderName, content, type, createdAt)
            VALUES (?, 0, '系统', ?, 'system', ?)
          `).run(archiveId, `${userName} 加入了群戏`, now());
        }
      });
      tx();

      const members = db.prepare(`
        SELECT locationId, dateKey, archiveId, userId, userName, joinedAt, updatedAt
        FROM active_group_rp_members
        WHERE locationId = ?
          AND dateKey = ?
        ORDER BY datetime(joinedAt) ASC, userId ASC
      `).all(locationId, dateKey) as GroupMemberRow[];

      const messages = db.prepare(`
        SELECT
          m.id,
          m.archiveId,
          m.senderId,
          m.senderName,
          m.content,
          m.type,
          m.createdAt,
          u.avatarUrl as senderAvatar,
          u.avatarUpdatedAt as senderAvatarUpdatedAt
        FROM rp_archive_messages m
        LEFT JOIN users u ON u.id = m.senderId
        WHERE m.archiveId = ?
        ORDER BY m.id DESC
        LIMIT 200
      `).all(archiveId) as any[];

      return res.json({
        success: true,
        joined: true,
        archiveId,
        dateKey,
        locationId,
        locationName,
        onlineCount: members.length,
        members: members.map((m) => ({
          userId: Number(m.userId || 0),
          userName: String(m.userName || ''),
          joinedAt: String(m.joinedAt || ''),
          updatedAt: String(m.updatedAt || '')
        })),
        messages: messages.reverse()
      });
    } catch (e: any) {
      return res.status(500).json({ success: false, message: e?.message || '加入群戏失败' });
    }
  });

  // 群戏：当前会话（用于轮询）
  router.get('/rp/group/session', (req, res) => {
    try {
      const userId = toSafeUserId(req.query.userId);
      const locationIdQuery = toSafeLocationId(req.query.locationId);
      if (!userId) return res.status(400).json({ success: false, message: 'userId 非法' });

      const user = db.prepare(`
        SELECT id, name, currentLocation
        FROM users
        WHERE id = ?
        LIMIT 1
      `).get(userId) as any;
      if (!user) return res.status(404).json({ success: false, message: '用户不存在' });

      const currentLocationId = toSafeLocationId(user.currentLocation);
      const locationId = currentLocationId || locationIdQuery;
      if (!locationId) {
        return res.json({ success: true, joined: false, archiveId: null, members: [], messages: [], onlineCount: 0 });
      }

      const locationName = String(req.query.locationName || '').trim() || locationId;
      const dateKey = getLocalDateKey();
      const archiveId = buildGroupArchiveId(dateKey, locationId);

      cleanupGroupMembers(dateKey, locationId);

      const joinedRow = db.prepare(`
        SELECT locationId, dateKey, archiveId, userId, userName, joinedAt, updatedAt
        FROM active_group_rp_members
        WHERE locationId = ?
          AND dateKey = ?
          AND userId = ?
        LIMIT 1
      `).get(locationId, dateKey, userId) as GroupMemberRow | undefined;

      if (joinedRow) {
        db.prepare(`
          UPDATE active_group_rp_members
          SET updatedAt = CURRENT_TIMESTAMP
          WHERE locationId = ?
            AND dateKey = ?
            AND userId = ?
        `).run(locationId, dateKey, userId);
      }

      const arcExists = db.prepare(`SELECT id FROM rp_archives WHERE id = ? LIMIT 1`).get(archiveId);
      if (arcExists && joinedRow) {
        touchGroupArchiveParticipants(archiveId, userId, String(joinedRow.userName || user.name || `U${userId}`), locationName);
      }

      const members = db.prepare(`
        SELECT locationId, dateKey, archiveId, userId, userName, joinedAt, updatedAt
        FROM active_group_rp_members
        WHERE locationId = ?
          AND dateKey = ?
        ORDER BY datetime(joinedAt) ASC, userId ASC
      `).all(locationId, dateKey) as GroupMemberRow[];

      const messages = db.prepare(`
        SELECT
          m.id,
          m.archiveId,
          m.senderId,
          m.senderName,
          m.content,
          m.type,
          m.createdAt,
          u.avatarUrl as senderAvatar,
          u.avatarUpdatedAt as senderAvatarUpdatedAt
        FROM rp_archive_messages m
        LEFT JOIN users u ON u.id = m.senderId
        WHERE m.archiveId = ?
        ORDER BY m.id DESC
        LIMIT 200
      `).all(archiveId) as any[];

      return res.json({
        success: true,
        joined: !!joinedRow,
        archiveId,
        dateKey,
        locationId,
        locationName,
        onlineCount: members.length,
        members: members.map((m) => ({
          userId: Number(m.userId || 0),
          userName: String(m.userName || ''),
          joinedAt: String(m.joinedAt || ''),
          updatedAt: String(m.updatedAt || '')
        })),
        messages: messages.reverse()
      });
    } catch (e: any) {
      return res.status(500).json({ success: false, message: e?.message || '读取群戏会话失败' });
    }
  });

  // 群戏：发言
  router.post('/rp/group/messages', (req, res) => {
    try {
      const userId = toSafeUserId(req.body?.userId);
      const text = String(req.body?.content ?? '').trim();
      const bodyLocationId = toSafeLocationId(req.body?.locationId);
      const bodyUserName = String(req.body?.userName || '').trim();
      const bodyLocationName = String(req.body?.locationName || '').trim();

      if (!userId) return res.status(400).json({ success: false, message: 'userId 非法' });
      if (!bodyLocationId) return res.status(400).json({ success: false, message: 'locationId 必填' });
      if (!text) return res.status(400).json({ success: false, message: '消息不能为空' });

      const user = db.prepare(`
        SELECT id, name, status, currentLocation
        FROM users
        WHERE id = ?
        LIMIT 1
      `).get(userId) as any;
      if (!user) return res.status(404).json({ success: false, message: '用户不存在' });
      if (!['approved', 'ghost'].includes(String(user.status || ''))) {
        return res.status(403).json({ success: false, message: '当前状态无法参与群戏' });
      }

      const currentLocationId = toSafeLocationId(user.currentLocation);
      if (currentLocationId && currentLocationId !== bodyLocationId) {
        return res.status(400).json({ success: false, message: '你已离开该地图，无法继续群戏' });
      }

      const locationId = currentLocationId || bodyLocationId;
      const locationName = bodyLocationName || locationId || '未知地点';
      const userName = bodyUserName || String(user.name || `U${userId}`);
      const dateKey = getLocalDateKey();
      const archiveId = buildGroupArchiveId(dateKey, locationId);

      cleanupGroupMembers(dateKey, locationId);

      ensureGroupArchive(archiveId, locationId, locationName);
      const member = db.prepare(`
        SELECT 1
        FROM active_group_rp_members
        WHERE locationId = ?
          AND dateKey = ?
          AND userId = ?
        LIMIT 1
      `).get(locationId, dateKey, userId);
      if (!member) {
        return res.status(403).json({ success: false, message: '你尚未加入该地区群戏' });
      }

      const tx = db.transaction(() => {
        db.prepare(`
          UPDATE active_group_rp_members
          SET updatedAt = CURRENT_TIMESTAMP,
              userName = ?
          WHERE locationId = ?
            AND dateKey = ?
            AND userId = ?
        `).run(userName, locationId, dateKey, userId);

        db.prepare(`
          INSERT INTO rp_archive_messages (archiveId, senderId, senderName, content, type, createdAt)
          VALUES (?, ?, ?, ?, 'user', ?)
        `).run(archiveId, userId, userName, text, now());

        touchGroupArchiveParticipants(archiveId, userId, userName, locationName);
      });
      tx();

      return res.json({ success: true });
    } catch (e: any) {
      return res.status(500).json({ success: false, message: e?.message || '群戏发送失败' });
    }
  });

  // 群戏：离开（离开地图即视为退出）
  router.post('/rp/group/leave', (req, res) => {
    try {
      const userId = toSafeUserId(req.body?.userId);
      const locationId = toSafeLocationId(req.body?.locationId);
      const userNameRaw = String(req.body?.userName || '').trim();
      if (!userId) return res.status(400).json({ success: false, message: 'userId 非法' });
      if (!locationId) return res.status(400).json({ success: false, message: 'locationId 必填' });

      const user = db.prepare(`
        SELECT id, name
        FROM users
        WHERE id = ?
        LIMIT 1
      `).get(userId) as any;
      if (!user) return res.status(404).json({ success: false, message: '用户不存在' });
      const userName = userNameRaw || String(user.name || `U${userId}`);

      const dateKey = getLocalDateKey();
      const archiveId = buildGroupArchiveId(dateKey, locationId);
      cleanupGroupMembers(dateKey, locationId);

      const tx = db.transaction(() => {
        const exists = db.prepare(`
          SELECT 1
          FROM active_group_rp_members
          WHERE locationId = ?
            AND dateKey = ?
            AND userId = ?
          LIMIT 1
        `).get(locationId, dateKey, userId);
        if (!exists) return false;

        db.prepare(`
          DELETE FROM active_group_rp_members
          WHERE locationId = ?
            AND dateKey = ?
            AND userId = ?
        `).run(locationId, dateKey, userId);

        const arcExists = db.prepare(`SELECT id FROM rp_archives WHERE id = ? LIMIT 1`).get(archiveId);
        if (arcExists) {
          db.prepare(`
            INSERT INTO rp_archive_messages (archiveId, senderId, senderName, content, type, createdAt)
            VALUES (?, 0, '系统', ?, 'system', ?)
          `).run(archiveId, `${userName} 离开了群戏`, now());
        }
        return true;
      });

      const left = tx();
      return res.json({ success: true, left: !!left });
    } catch (e: any) {
      return res.status(500).json({ success: false, message: e?.message || '离开群戏失败' });
    }
  });

  // 观察者图书馆：读取对戏/群戏回顾
  router.get('/observer/library/replays', (req, res) => {
    try {
      const limit = toLimit(req.query.limit, 1, 200, 80);
      const kind = String(req.query.kind || 'all').trim(); // all | group | pair

      const rows = db.prepare(`
        SELECT id, title, locationId, locationName, participants, participantNames, status, createdAt
        FROM rp_archives
        ORDER BY datetime(createdAt) DESC, id DESC
        LIMIT ?
      `).all(limit) as any[];

      const filtered = rows.filter((x) => {
        const id = String(x.id || '');
        if (kind === 'group') return isGroupArchiveId(id);
        if (kind === 'pair') return !isGroupArchiveId(id);
        return true;
      });

      const logs = filtered.map((x) => {
        const archiveId = String(x.id || '');
        const msgCount = db.prepare(`
          SELECT COUNT(*) AS c
          FROM rp_archive_messages
          WHERE archiveId = ?
        `).get(archiveId) as any;
        const latest = db.prepare(`
          SELECT senderName, content, type, createdAt
          FROM rp_archive_messages
          WHERE archiveId = ?
          ORDER BY id DESC
          LIMIT 1
        `).get(archiveId) as any;

        return {
          id: archiveId,
          kind: isGroupArchiveId(archiveId) ? 'group' : 'pair',
          title: String(x.title || ''),
          locationId: String(x.locationId || ''),
          locationName: String(x.locationName || ''),
          participants: parseParticipantIds(x.participants),
          participantNames: String(x.participantNames || ''),
          status: String(x.status || 'active'),
          createdAt: String(x.createdAt || ''),
          messageCount: Number(msgCount?.c || 0),
          latestMessage: latest
            ? {
                senderName: String(latest.senderName || ''),
                content: String(latest.content || ''),
                type: String(latest.type || 'text'),
                createdAt: String(latest.createdAt || '')
              }
            : null
        };
      });

      return res.json({ success: true, logs });
    } catch (e: any) {
      return res.status(500).json({ success: false, message: e?.message || '读取回顾失败', logs: [] });
    }
  });

  router.get('/observer/library/replays/:archiveId/messages', (req, res) => {
    try {
      const archiveId = decodeURIComponent(String(req.params.archiveId || '')).trim();
      const limit = toLimit(req.query.limit, 1, 500, 300);
      if (!archiveId) return res.status(400).json({ success: false, message: 'archiveId 必填' });

      const archive = db.prepare(`
        SELECT id, title, locationId, locationName, participantNames, createdAt
        FROM rp_archives
        WHERE id = ?
        LIMIT 1
      `).get(archiveId) as any;
      if (!archive) return res.status(404).json({ success: false, message: '回顾不存在', messages: [] });

      const messages = db.prepare(`
        SELECT
          m.id,
          m.archiveId,
          m.senderId,
          m.senderName,
          m.content,
          m.type,
          m.createdAt,
          u.avatarUrl as senderAvatar,
          u.avatarUpdatedAt as senderAvatarUpdatedAt
        FROM rp_archive_messages m
        LEFT JOIN users u ON u.id = m.senderId
        WHERE m.archiveId = ?
        ORDER BY m.id DESC
        LIMIT ?
      `).all(archiveId, limit) as any[];

      return res.json({
        success: true,
        archive: {
          id: String(archive.id || ''),
          title: String(archive.title || ''),
          locationId: String(archive.locationId || ''),
          locationName: String(archive.locationName || ''),
          participantNames: String(archive.participantNames || ''),
          createdAt: String(archive.createdAt || ''),
          kind: isGroupArchiveId(String(archive.id || '')) ? 'group' : 'pair'
        },
        messages: messages.reverse()
      });
    } catch (e: any) {
      return res.status(500).json({ success: false, message: e?.message || '读取回顾消息失败', messages: [] });
    }
  });

  // 6) 后台档案读取（仅管理员）
  router.get('/admin/rp_archives', requireAdminAuth, (_req, res) => {
    try {
      const archives = db.prepare(`
        SELECT * FROM rp_archives
        ORDER BY createdAt DESC
      `).all() as any[];

      for (const arc of archives) {
        arc.messages = db.prepare(`
          SELECT * FROM rp_archive_messages
          WHERE archiveId = ?
          ORDER BY createdAt ASC, id ASC
        `).all(arc.id);
      }

      return res.json({ success: true, archives });
    } catch (e: any) {
      return res.status(500).json({ success: false, message: e.message || '读取归档失败' });
    }
  });

  // 7) 后台删除单条对戏存档（仅管理员）
  router.delete('/admin/rp_archives/:archiveId', requireAdminAuth, (req, res) => {
    try {
      const archiveId = decodeURIComponent(String(req.params.archiveId || '')).trim();
      if (!archiveId) {
        return res.status(400).json({ success: false, message: 'archiveId 必填' });
      }

      const tx = db.transaction((id: string) => {
        db.prepare(`DELETE FROM rp_archive_messages WHERE archiveId = ?`).run(id);
        const ret = db.prepare(`DELETE FROM rp_archives WHERE id = ?`).run(id);
        return Number(ret.changes || 0);
      });

      const changes = tx(archiveId);
      if (changes <= 0) {
        return res.status(404).json({ success: false, message: '存档不存在或已删除' });
      }

      return res.json({ success: true, message: `存档 ${archiveId} 已删除` });
    } catch (e: any) {
      return res.status(500).json({ success: false, message: e.message || '删除失败' });
    }
  });

  return router;
}

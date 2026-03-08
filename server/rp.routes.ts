import express from 'express';
import type { AppContext } from './types';

type RPMessageType = 'user' | 'system' | 'text';

type RPMessageRow = {
  id: number;
  sessionId?: string;
  archiveId?: string;
  senderId: number | null;
  senderName: string;
  senderAvatar?: string | null;
  senderAvatarUpdatedAt?: string | null;
  content: string;
  type: RPMessageType | string;
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
  createdAt?: string | null;
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

const GROUP_ARCHIVE_PREFIX = 'GRP-';
const GROUP_MEMBER_STALE_SECONDS = 180;
const MEDIATOR_ONLINE_SECONDS = 45;
const now = () => new Date().toISOString();

function toSafeUserId(value: unknown): number | null {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.floor(n);
}

function toSafeLocationId(value: unknown): string {
  return String(value || '').trim();
}

function getLocalDateKey() {
  const date = new Date();
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function buildGroupArchiveId(dateKey: string, locationId: string) {
  return `${GROUP_ARCHIVE_PREFIX}${dateKey}-${locationId || 'unknown'}`;
}

function parseParticipantIds(raw: unknown): number[] {
  try {
    const parsed = JSON.parse(String(raw || '[]'));
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => Number(item))
      .filter((item) => Number.isFinite(item) && item > 0);
  } catch {
    return [];
  }
}

function mergeParticipantNames(rawNames: unknown, nextName: string) {
  const names = String(rawNames || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  if (nextName && !names.includes(nextName)) names.push(nextName);
  return names.join(', ');
}

function mapSessionShape(session: SessionRow, members: MemberRow[]) {
  const sorted = [...members].sort((a, b) => a.userId - b.userId);
  const first = sorted[0];
  const second = sorted[1];
  return {
    sessionId: session.id,
    userAId: first?.userId ?? 0,
    userAName: first?.userName ?? 'Unknown A',
    userBId: second?.userId ?? 0,
    userBName: second?.userName ?? 'Unknown B',
    locationId: session.locationId,
    locationName: session.locationName,
    status: session.status,
    createdAt: session.createdAt || null,
    updatedAt: null,
    memberCount: sorted.length,
    memberNames: sorted.map((member) => member.userName),
  };
}

export async function createRpRouter(ctx: AppContext) {
  const router = express.Router();
  const { db, runtime } = ctx;

  await db.exec(`
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

  const cleanupGroupMembers = async (dateKey: string, locationId?: string) => {
    await db.prepare(`DELETE FROM active_group_rp_members WHERE dateKey <> ?`).run(dateKey);
    if (locationId) {
      await db.prepare(`
        DELETE FROM active_group_rp_members
        WHERE dateKey = ?
          AND locationId = ?
          AND datetime(updatedAt) < datetime('now', ?)
      `).run(dateKey, locationId, `-${GROUP_MEMBER_STALE_SECONDS} seconds`);
      return;
    }
    await db.prepare(`
      DELETE FROM active_group_rp_members
      WHERE dateKey = ?
        AND datetime(updatedAt) < datetime('now', ?)
    `).run(dateKey, `-${GROUP_MEMBER_STALE_SECONDS} seconds`);
  };

  const loadSessionMembers = async (sessionId: string) =>
    await db.prepare(`SELECT * FROM active_rp_members WHERE sessionId = ? ORDER BY userId ASC`).all(sessionId) as MemberRow[];

  const loadSessionMessages = async (sessionId: string) =>
    await db.prepare(`
      SELECT m.id, m.sessionId, m.senderId, m.senderName, m.content, m.type, m.createdAt,
             u.avatarUrl AS senderAvatar, u.avatarUpdatedAt AS senderAvatarUpdatedAt
      FROM active_rp_messages m
      LEFT JOIN users u ON u.id = m.senderId
      WHERE m.sessionId = ?
      ORDER BY m.id ASC
    `).all(sessionId) as RPMessageRow[];

  const loadGroupMessages = async (archiveId: string) =>
    await db.prepare(`
      SELECT m.id, m.archiveId, m.senderId, m.senderName, m.content, m.type, m.createdAt,
             u.avatarUrl AS senderAvatar, u.avatarUpdatedAt AS senderAvatarUpdatedAt
      FROM rp_archive_messages m
      LEFT JOIN users u ON u.id = m.senderId
      WHERE m.archiveId = ?
      ORDER BY m.id ASC
    `).all(archiveId) as RPMessageRow[];

  const ensureGroupArchive = async (archiveId: string, locationId: string, locationName: string) => {
    const exists = await db.prepare(`SELECT id FROM rp_archives WHERE id = ? LIMIT 1`).get(archiveId);
    if (!exists) {
      await db.prepare(`
        INSERT INTO rp_archives
        (id, title, locationId, locationName, participants, participantNames, status, createdAt)
        VALUES (?, ?, ?, ?, ?, ?, 'active', ?)
      `).run(
        archiveId,
        `${locationName || locationId || 'Unknown location'} Group RP Archive`,
        locationId || 'unknown',
        locationName || locationId || 'Unknown location',
        '[]',
        '',
        now()
      );
      return;
    }

    await db.prepare(`
      UPDATE rp_archives
      SET title = ?,
          locationId = ?,
          locationName = ?,
          status = 'active'
      WHERE id = ?
    `).run(
      `${locationName || locationId || 'Unknown location'} Group RP Archive`,
      locationId || 'unknown',
      locationName || locationId || 'Unknown location',
      archiveId
    );
  };

  const touchGroupArchiveParticipants = async (archiveId: string, userId: number, userName: string, locationName: string) => {
    const archive = await db.prepare(`
      SELECT participants, participantNames
      FROM rp_archives
      WHERE id = ?
      LIMIT 1
    `).get(archiveId) as { participants?: string; participantNames?: string } | undefined;
    if (!archive) return;
    const ids = parseParticipantIds(archive.participants);
    if (!ids.includes(userId)) ids.push(userId);
    const names = mergeParticipantNames(archive.participantNames, userName);
    await db.prepare(`
      UPDATE rp_archives
      SET participants = ?,
          participantNames = ?,
          locationName = COALESCE(NULLIF(?, ''), locationName),
          status = 'active'
      WHERE id = ?
    `).run(JSON.stringify(ids), names, locationName || '', archiveId);
  };

  const ensurePairArchive = async (sessionId: string, session: SessionRow, members: MemberRow[]) => {
    const archiveId = `ARC-${sessionId}`;
    const exists = await db.prepare(`SELECT id FROM rp_archives WHERE id = ? LIMIT 1`).get(archiveId);
    if (!exists) {
      await db.prepare(`
        INSERT INTO rp_archives
        (id, title, locationId, locationName, participants, participantNames, status, createdAt)
        VALUES (?, ?, ?, ?, ?, ?, 'active', ?)
      `).run(
        archiveId,
        `${session.locationName || 'Unknown location'} Roleplay Archive`,
        session.locationId || 'unknown',
        session.locationName || 'Unknown location',
        JSON.stringify(members.map((member) => member.userId)),
        members.map((member) => member.userName).join(', '),
        now()
      );
    } else {
      await db.prepare(`
        UPDATE rp_archives
        SET title = ?,
            locationId = ?,
            locationName = ?,
            participants = ?,
            participantNames = ?
        WHERE id = ?
      `).run(
        `${session.locationName || 'Unknown location'} Roleplay Archive`,
        session.locationId || 'unknown',
        session.locationName || 'Unknown location',
        JSON.stringify(members.map((member) => member.userId)),
        members.map((member) => member.userName).join(', '),
        archiveId
      );
    }
    return archiveId;
  };
  const syncPairArchiveMessages = async (archiveId: string, sessionId: string) => {
    const archivedCountRow = await db.prepare(`SELECT COUNT(*) AS c FROM rp_archive_messages WHERE archiveId = ?`).get(archiveId) as { c?: number } | undefined;
    const archivedCount = Number(archivedCountRow?.c || 0);
    const messages = await db.prepare(`
      SELECT senderId, senderName, content, type, createdAt
      FROM active_rp_messages
      WHERE sessionId = ?
      ORDER BY id ASC
    `).all(sessionId) as Array<{ senderId: number | null; senderName: string; content: string; type: string; createdAt: string }>;
    const insertMessage = db.prepare(`
      INSERT INTO rp_archive_messages (archiveId, senderId, senderName, content, type, createdAt)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    for (const message of messages.slice(archivedCount)) {
      await insertMessage.run(
        archiveId,
        message.senderId ?? 0,
        message.senderName || 'Unknown',
        message.content || '',
        message.type || 'text',
        message.createdAt || now()
      );
    }
  };

  const listActiveSessionsForUser = async (userId: number) => {
    const rows = await db.prepare(`
      SELECT s.id, s.locationId, s.locationName, s.status, s.endProposedBy, s.createdAt,
             MAX(msg.createdAt) AS lastMessageAt
      FROM active_rp_sessions s
      JOIN active_rp_members m ON m.sessionId = s.id
      LEFT JOIN active_rp_messages msg ON msg.sessionId = s.id
      WHERE m.userId = ? AND s.status IN ('active', 'mediating')
      GROUP BY s.id, s.locationId, s.locationName, s.status, s.endProposedBy, s.createdAt
      ORDER BY COALESCE(MAX(msg.createdAt), s.createdAt, s.id) DESC
    `).all(userId) as Array<SessionRow & { lastMessageAt?: string | null }>;
    return Promise.all(rows.map(async (row) => {
      const members = await loadSessionMembers(row.id);
      return {
        ...mapSessionShape(row, members),
        lastMessageAt: row.lastMessageAt || null,
      };
    }));
  };

  const reconcileMediationStatus = async (sessionId: string) => {
    const pendingRow = await db.prepare(`SELECT COUNT(*) AS c FROM rp_mediation_invites WHERE sessionId = ? AND status = 'pending'`).get(sessionId) as { c?: number } | undefined;
    const mediatorRow = await db.prepare(`SELECT COUNT(*) AS c FROM active_rp_members WHERE sessionId = ? AND role = 'mediator'`).get(sessionId) as { c?: number } | undefined;
    const pendingCount = Number(pendingRow?.c || 0);
    const mediatorCount = Number(mediatorRow?.c || 0);
    if (pendingCount === 0 && mediatorCount === 0) {
      await db.prepare(`UPDATE active_rp_sessions SET status = 'active', endProposedBy = NULL WHERE id = ? AND status = 'mediating'`).run(sessionId);
    }
  };

  const notifyPairSession = async (sessionId: string, extra: Record<string, any> = {}) => {
    const userIds = (await loadSessionMembers(sessionId))
      .map((member) => Number(member.userId || 0))
      .filter((value) => Number.isFinite(value) && value > 0);
    if (!userIds.length) return;
    void runtime.publishUsers(userIds, 'rp.user.sessions.changed', { sessionId, ...extra });
    void runtime.publishUsers(userIds, 'rp.session.changed', { sessionId, ...extra });
  };

  const notifyGroupLocation = (locationId: string, archiveId: string, extra: Record<string, any> = {}) => {
    if (!String(locationId || '').trim()) return;
    void runtime.publishBroadcast('rp.group.changed', { locationId, archiveId, ...extra });
  };

  router.post('/rp/session/upsert', async (req, res) => {
    try {
      const { sessionId, userAId, userAName, userBId, userBName, locationId, locationName } = req.body || {};
      const aId = toSafeUserId(userAId);
      const bId = toSafeUserId(userBId);
      if (!sessionId || !aId || !bId) {
        return res.status(400).json({ success: false, message: 'Missing required parameters' });
      }
      if (aId === bId) {
        return res.status(400).json({ success: false, message: 'Roleplay requires two different users' });
      }

      const existing = await db.prepare(`
        SELECT s.id
        FROM active_rp_sessions s
        JOIN active_rp_members m1 ON m1.sessionId = s.id
        JOIN active_rp_members m2 ON m2.sessionId = s.id
        WHERE s.status IN ('active', 'mediating')
          AND ((m1.userId = ? AND m2.userId = ?) OR (m1.userId = ? AND m2.userId = ?))
        LIMIT 1
      `).get(aId, bId, bId, aId) as { id?: string } | undefined;
      const finalSessionId = String(existing?.id || sessionId);
      const oldSession = await db.prepare(`SELECT * FROM active_rp_sessions WHERE id = ? LIMIT 1`).get(finalSessionId) as SessionRow | undefined;

      const tx = db.transaction(async () => {
        if (!oldSession) {
          await db.prepare(`
            INSERT INTO active_rp_sessions (id, locationId, locationName, status, endProposedBy)
            VALUES (?, ?, ?, 'active', NULL)
          `).run(finalSessionId, locationId || 'unknown', locationName || 'Unknown location');
          await db.prepare(`
            INSERT INTO active_rp_messages (sessionId, senderId, senderName, content, type)
            VALUES (?, 0, 'System', 'Roleplay session started.', 'system')
          `).run(finalSessionId);
        } else {
          await db.prepare(`
            UPDATE active_rp_sessions
            SET locationId = ?,
                locationName = ?,
                status = CASE WHEN status = 'closed' THEN 'active' ELSE status END,
                endProposedBy = NULL
            WHERE id = ?
          `).run(
            locationId || oldSession.locationId || 'unknown',
            locationName || oldSession.locationName || 'Unknown location',
            finalSessionId
          );
        }

        await db.prepare(`INSERT OR IGNORE INTO active_rp_members (sessionId, userId, userName, role) VALUES (?, ?, ?, '')`).run(finalSessionId, aId, String(userAName || `U${aId}`));
        await db.prepare(`INSERT OR IGNORE INTO active_rp_members (sessionId, userId, userName, role) VALUES (?, ?, ?, '')`).run(finalSessionId, bId, String(userBName || `U${bId}`));
        await db.prepare(`UPDATE active_rp_members SET userName = ? WHERE sessionId = ? AND userId = ?`).run(String(userAName || `U${aId}`), finalSessionId, aId);
        await db.prepare(`UPDATE active_rp_members SET userName = ? WHERE sessionId = ? AND userId = ?`).run(String(userBName || `U${bId}`), finalSessionId, bId);
        await db.prepare(`DELETE FROM active_rp_leaves WHERE sessionId = ?`).run(finalSessionId);
      });
      await tx();
      await notifyPairSession(finalSessionId, { reason: 'upsert' });

      return res.json({ success: true, sessionId: finalSessionId });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error?.message || 'Failed to upsert roleplay session' });
    }
  });

  router.get('/rp/session/list/:userId', async (req, res) => {
    try {
      const userId = toSafeUserId(req.params.userId);
      if (!userId) {
        return res.status(400).json({ success: false, message: 'Invalid user id', sessions: [] });
      }
      return res.json({ success: true, sessions: await listActiveSessionsForUser(userId) });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error?.message || 'Failed to load sessions', sessions: [] });
    }
  });

  router.get('/rp/session/active/:userId', async (req, res) => {
    try {
      const userId = toSafeUserId(req.params.userId);
      if (!userId) {
        return res.status(400).json({ success: false, message: 'Invalid user id' });
      }
      const sessions = await listActiveSessionsForUser(userId);
      const session = sessions[0] || null;
      return res.json({ success: true, sessionId: session?.sessionId || null, session, sessions });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error?.message || 'Failed to load session' });
    }
  });

  router.get('/rp/session/:sessionId/messages', async (req, res) => {
    try {
      const sessionId = String(req.params.sessionId || '').trim();
      const session = await db.prepare(`SELECT * FROM active_rp_sessions WHERE id = ? LIMIT 1`).get(sessionId) as SessionRow | undefined;
      if (!session) {
        return res.status(404).json({ success: false, message: 'Session not found' });
      }
      const members = await loadSessionMembers(sessionId);
      const messages = await loadSessionMessages(sessionId);
      return res.json({ success: true, session: mapSessionShape(session, members), messages });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error?.message || 'Failed to load roleplay messages' });
    }
  });

  router.post('/rp/session/:sessionId/messages', async (req, res) => {
    try {
      const sessionId = String(req.params.sessionId || '').trim();
      const userId = toSafeUserId(req.body?.userId);
      const userName = String(req.body?.userName || '').trim();
      const content = String(req.body?.content || '').trim();
      if (!sessionId || !userId || !content) {
        return res.status(400).json({ success: false, message: 'Missing required parameters' });
      }

      const session = await db.prepare(`SELECT * FROM active_rp_sessions WHERE id = ? LIMIT 1`).get(sessionId) as SessionRow | undefined;
      if (!session || session.status === 'closed') {
        return res.status(404).json({ success: false, message: 'Session not available' });
      }

      const member = await db.prepare(`SELECT * FROM active_rp_members WHERE sessionId = ? AND userId = ? LIMIT 1`).get(sessionId, userId) as MemberRow | undefined;
      if (!member) {
        return res.status(403).json({ success: false, message: 'You are not in this session' });
      }

      await db.prepare(`
        INSERT INTO active_rp_messages (sessionId, senderId, senderName, content, type)
        VALUES (?, ?, ?, ?, 'user')
      `).run(sessionId, userId, userName || member.userName || `U${userId}`, content);
      await notifyPairSession(sessionId, { reason: 'message', userId });

      return res.json({ success: true });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error?.message || 'Failed to send roleplay message' });
    }
  });

  router.post('/rp/session/:sessionId/leave', async (req, res) => {
    try {
      const sessionId = String(req.params.sessionId || '').trim();
      const userId = toSafeUserId(req.body?.userId);
      const userName = String(req.body?.userName || '').trim();
      if (!sessionId || !userId) {
        return res.status(400).json({ success: false, message: 'Missing required parameters' });
      }

      const session = await db.prepare(`SELECT * FROM active_rp_sessions WHERE id = ? LIMIT 1`).get(sessionId) as SessionRow | undefined;
      if (!session) {
        return res.status(404).json({ success: false, message: 'Session not found' });
      }

      const member = await db.prepare(`SELECT * FROM active_rp_members WHERE sessionId = ? AND userId = ? LIMIT 1`).get(sessionId, userId) as MemberRow | undefined;
      if (!member) {
        return res.status(403).json({ success: false, message: 'You are not in this session' });
      }

      let closed = false;
      let archiveId = '';
      const tx = db.transaction(async () => {
        await db.prepare(`INSERT OR IGNORE INTO active_rp_leaves (sessionId, userId) VALUES (?, ?)`).run(sessionId, userId);
        await db.prepare(`
          INSERT INTO active_rp_messages (sessionId, senderId, senderName, content, type)
          VALUES (?, 0, 'System', ?, 'system')
        `).run(sessionId, `${userName || member.userName || `U${userId}`} left the roleplay.`);

        const totalRow = await db.prepare(`SELECT COUNT(*) AS c FROM active_rp_members WHERE sessionId = ?`).get(sessionId) as { c?: number } | undefined;
        const leaveRow = await db.prepare(`SELECT COUNT(*) AS c FROM active_rp_leaves WHERE sessionId = ?`).get(sessionId) as { c?: number } | undefined;
        const total = Number(totalRow?.c || 0);
        const left = Number(leaveRow?.c || 0);
        if (total > 0 && left >= total) {
          const latestSession = await db.prepare(`SELECT * FROM active_rp_sessions WHERE id = ? LIMIT 1`).get(sessionId) as SessionRow;
          const members = await loadSessionMembers(sessionId);
          archiveId = await ensurePairArchive(sessionId, latestSession, members);
          await syncPairArchiveMessages(archiveId, sessionId);
          await db.prepare(`UPDATE rp_archives SET status = 'closed' WHERE id = ?`).run(archiveId);
          await db.prepare(`UPDATE active_rp_sessions SET status = 'closed', endProposedBy = NULL WHERE id = ?`).run(sessionId);
          await db.prepare(`UPDATE rp_mediation_invites SET status = 'cancelled', updatedAt = CURRENT_TIMESTAMP WHERE sessionId = ? AND status = 'pending'`).run(sessionId);
          closed = true;
        }
      });
      await tx();
      await notifyPairSession(sessionId, { reason: 'leave', userId, closed, archiveId: archiveId || null });

      return res.json({ success: true, closed, archiveId: archiveId || null });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error?.message || 'Failed to leave roleplay session' });
    }
  });
  router.post('/rp/session/:sessionId/mediate/request', async (req, res) => {
    try {
      const sessionId = String(req.params.sessionId || '').trim();
      const userId = toSafeUserId(req.body?.userId);
      const userName = String(req.body?.userName || '').trim();
      const reason = String(req.body?.reason || '').trim();
      if (!sessionId || !userId) {
        return res.status(400).json({ success: false, message: 'Missing required parameters' });
      }

      const session = await db.prepare(`SELECT * FROM active_rp_sessions WHERE id = ? LIMIT 1`).get(sessionId) as SessionRow | undefined;
      if (!session || session.status === 'closed') {
        return res.status(404).json({ success: false, message: 'Session not available' });
      }

      const requester = await db.prepare(`SELECT * FROM active_rp_members WHERE sessionId = ? AND userId = ? LIMIT 1`).get(sessionId, userId) as MemberRow | undefined;
      if (!requester) {
        return res.status(403).json({ success: false, message: 'You are not in this session' });
      }

      const candidates = await db.prepare(`
        SELECT DISTINCT u.id, u.name
        FROM users u
        JOIN user_sessions us ON us.userId = u.id
        WHERE us.role = 'player'
          AND us.revokedAt IS NULL
          AND datetime(us.lastSeenAt) >= datetime('now', ?)
          AND u.id <> ?
          AND u.id NOT IN (SELECT userId FROM active_rp_members WHERE sessionId = ?)
          AND (
            u.currentLocation = 'army'
            OR u.faction LIKE '%军%'
            OR u.job LIKE '%军%'
            OR u.job LIKE '%将官%'
            OR u.job LIKE '%校官%'
            OR u.job LIKE '%尉官%'
            OR u.job LIKE '%士兵%'
          )
      `).all(`-${MEDIATOR_ONLINE_SECONDS} seconds`, userId, sessionId) as Array<{ id: number; name: string }>;

      let created = 0;
      const tx = db.transaction(async () => {
        await db.prepare(`UPDATE active_rp_sessions SET status = 'mediating' WHERE id = ?`).run(sessionId);
        for (const row of candidates) {
          const exists = await db.prepare(`
            SELECT id
            FROM rp_mediation_invites
            WHERE sessionId = ? AND invitedUserId = ? AND status = 'pending'
            LIMIT 1
          `).get(sessionId, row.id) as { id?: number } | undefined;
          if (exists) continue;
          await db.prepare(`
            INSERT INTO rp_mediation_invites
            (sessionId, invitedUserId, requestedByUserId, requestedByName, reason, status)
            VALUES (?, ?, ?, ?, ?, 'pending')
          `).run(sessionId, row.id, userId, userName || requester.userName || `U${userId}`, reason);
          created += 1;
        }

        await db.prepare(`
          INSERT INTO active_rp_messages (sessionId, senderId, senderName, content, type)
          VALUES (?, 0, 'System', ?, 'system')
        `).run(
          sessionId,
          created > 0 ? 'Mediation requested. Waiting for an army member to join.' : 'Mediation requested, but no online army member was found.'
        );
      });
      await tx();

      return res.json({
        success: true,
        invitedCount: created,
        message: created > 0 ? `Sent ${created} mediation invite(s).` : 'No eligible army member is currently online.'
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error?.message || 'Failed to request mediation' });
    }
  });

  router.get('/rp/mediation/invites/:userId', async (req, res) => {
    try {
      const userId = toSafeUserId(req.params.userId);
      if (!userId) {
        return res.status(400).json({ success: false, message: 'Invalid user id', invites: [] });
      }
      const invites = await db.prepare(`
        SELECT i.*, s.locationId, s.locationName
        FROM rp_mediation_invites i
        LEFT JOIN active_rp_sessions s ON s.id = i.sessionId
        WHERE i.invitedUserId = ? AND i.status = 'pending'
        ORDER BY i.id DESC
      `).all(userId) as any[];
      return res.json({ success: true, invites });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error?.message || 'Failed to load mediation invites', invites: [] });
    }
  });

  router.post('/rp/mediation/invites/:inviteId/respond', async (req, res) => {
    try {
      const inviteId = Number(req.params.inviteId || 0);
      const userId = toSafeUserId(req.body?.userId);
      const accept = !!req.body?.accept;
      if (!inviteId || !userId) {
        return res.status(400).json({ success: false, message: 'Missing required parameters' });
      }

      const invite = await db.prepare(`SELECT * FROM rp_mediation_invites WHERE id = ? LIMIT 1`).get(inviteId) as any;
      if (!invite) {
        return res.status(404).json({ success: false, message: 'Invite not found' });
      }
      if (Number(invite.invitedUserId || 0) !== userId) {
        return res.status(403).json({ success: false, message: 'Invite does not belong to you' });
      }
      if (String(invite.status || '') !== 'pending') {
        return res.status(400).json({ success: false, message: 'Invite already handled' });
      }

      const sessionId = String(invite.sessionId || '').trim();
      const session = await db.prepare(`SELECT * FROM active_rp_sessions WHERE id = ? LIMIT 1`).get(sessionId) as SessionRow | undefined;
      if (!session || session.status === 'closed') {
        await db.prepare(`UPDATE rp_mediation_invites SET status = 'cancelled', updatedAt = CURRENT_TIMESTAMP WHERE id = ?`).run(inviteId);
        return res.status(404).json({ success: false, message: 'Session is no longer available' });
      }

      const userRow = await db.prepare(`SELECT id, name FROM users WHERE id = ? LIMIT 1`).get(userId) as { id: number; name: string } | undefined;
      const displayName = String(userRow?.name || invite.requestedByName || `U${userId}`);

      if (!accept) {
        const tx = db.transaction(async () => {
          await db.prepare(`UPDATE rp_mediation_invites SET status = 'rejected', updatedAt = CURRENT_TIMESTAMP WHERE id = ?`).run(inviteId);
          await reconcileMediationStatus(sessionId);
        });
        await tx();
        return res.json({ success: true, sessionId, message: 'You declined the mediation invite.' });
      }

      const mediatorExists = await db.prepare(`
        SELECT userId
        FROM active_rp_members
        WHERE sessionId = ? AND role = 'mediator'
        LIMIT 1
      `).get(sessionId) as { userId?: number } | undefined;
      if (mediatorExists && Number(mediatorExists.userId || 0) !== userId) {
        await db.prepare(`UPDATE rp_mediation_invites SET status = 'superseded', updatedAt = CURRENT_TIMESTAMP WHERE id = ?`).run(inviteId);
        return res.json({ success: false, message: 'Another mediator already joined this session.' });
      }

      const tx = db.transaction(async () => {
        await db.prepare(`UPDATE rp_mediation_invites SET status = 'accepted', updatedAt = CURRENT_TIMESTAMP WHERE id = ?`).run(inviteId);
        await db.prepare(`
          UPDATE rp_mediation_invites
          SET status = 'superseded', updatedAt = CURRENT_TIMESTAMP
          WHERE sessionId = ? AND status = 'pending' AND id <> ?
        `).run(sessionId, inviteId);
        await db.prepare(`INSERT OR IGNORE INTO active_rp_members (sessionId, userId, userName, role) VALUES (?, ?, ?, 'mediator')`).run(sessionId, userId, displayName);
        await db.prepare(`UPDATE active_rp_members SET userName = ?, role = 'mediator' WHERE sessionId = ? AND userId = ?`).run(displayName, sessionId, userId);
        await db.prepare(`UPDATE active_rp_sessions SET status = 'mediating' WHERE id = ?`).run(sessionId);
        await db.prepare(`
          INSERT INTO active_rp_messages (sessionId, senderId, senderName, content, type)
          VALUES (?, 0, 'System', ?, 'system')
        `).run(sessionId, `${displayName} joined as the mediator.`);
      });
      await tx();

      return res.json({ success: true, sessionId, message: 'You joined the mediation session.' });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error?.message || 'Failed to respond to mediation invite' });
    }
  });

  router.post('/rp/group/join', async (req, res) => {
    try {
      const userId = toSafeUserId(req.body?.userId);
      const userName = String(req.body?.userName || '').trim();
      const locationId = toSafeLocationId(req.body?.locationId);
      const locationName = String(req.body?.locationName || '').trim() || locationId || 'Unknown location';
      if (!userId || !locationId) {
        return res.status(400).json({ success: false, message: 'Missing required parameters' });
      }

      const dateKey = getLocalDateKey();
      const archiveId = buildGroupArchiveId(dateKey, locationId);
      await cleanupGroupMembers(dateKey, locationId);
      await ensureGroupArchive(archiveId, locationId, locationName);

      const existing = await db.prepare(`
        SELECT * FROM active_group_rp_members
        WHERE locationId = ? AND dateKey = ? AND userId = ?
        LIMIT 1
      `).get(locationId, dateKey, userId) as GroupMemberRow | undefined;

      const tx = db.transaction(async () => {
        if (!existing) {
          await db.prepare(`
            INSERT INTO active_group_rp_members (locationId, dateKey, archiveId, userId, userName)
            VALUES (?, ?, ?, ?, ?)
          `).run(locationId, dateKey, archiveId, userId, userName || `U${userId}`);
          await db.prepare(`
            INSERT INTO rp_archive_messages (archiveId, senderId, senderName, content, type, createdAt)
            VALUES (?, 0, 'System', ?, 'system', ?)
          `).run(archiveId, `${userName || `U${userId}`} joined the group roleplay.`, now());
        } else {
          await db.prepare(`
            UPDATE active_group_rp_members
            SET userName = ?, archiveId = ?, updatedAt = CURRENT_TIMESTAMP
            WHERE locationId = ? AND dateKey = ? AND userId = ?
          `).run(userName || existing.userName || `U${userId}`, archiveId, locationId, dateKey, userId);
        }
        await touchGroupArchiveParticipants(archiveId, userId, userName || `U${userId}`, locationName);
      });
      await tx();
      notifyGroupLocation(locationId, archiveId, { reason: 'join', userId });

      return res.json({ success: true, joined: true, archiveId, locationId, locationName });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error?.message || 'Failed to join group roleplay' });
    }
  });

  router.get('/rp/group/session', async (req, res) => {
    try {
      const userId = toSafeUserId(req.query.userId);
      const locationId = toSafeLocationId(req.query.locationId);
      if (!userId || !locationId) {
        return res.status(400).json({ success: false, message: 'Missing required parameters' });
      }

      const dateKey = getLocalDateKey();
      await cleanupGroupMembers(dateKey, locationId);
      const member = await db.prepare(`
        SELECT * FROM active_group_rp_members
        WHERE locationId = ? AND dateKey = ? AND userId = ?
        LIMIT 1
      `).get(locationId, dateKey, userId) as GroupMemberRow | undefined;

      if (!member) {
        return res.json({ success: true, joined: false, archiveId: buildGroupArchiveId(dateKey, locationId), locationId });
      }

      await db.prepare(`
        UPDATE active_group_rp_members
        SET updatedAt = CURRENT_TIMESTAMP
        WHERE locationId = ? AND dateKey = ? AND userId = ?
      `).run(locationId, dateKey, userId);

      const members = await db.prepare(`
        SELECT locationId, dateKey, archiveId, userId, userName, joinedAt, updatedAt
        FROM active_group_rp_members
        WHERE locationId = ? AND dateKey = ?
        ORDER BY datetime(joinedAt) ASC, userId ASC
      `).all(locationId, dateKey) as GroupMemberRow[];
      const archive = await db.prepare(`SELECT locationName FROM rp_archives WHERE id = ? LIMIT 1`).get(member.archiveId) as { locationName?: string } | undefined;
      const messages = await loadGroupMessages(member.archiveId);

      return res.json({
        success: true,
        joined: true,
        archiveId: member.archiveId,
        locationId,
        locationName: String(archive?.locationName || locationId),
        members,
        messages,
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error?.message || 'Failed to load group roleplay session' });
    }
  });

  router.post('/rp/group/messages', async (req, res) => {
    try {
      const userId = toSafeUserId(req.body?.userId);
      const userName = String(req.body?.userName || '').trim();
      const locationId = toSafeLocationId(req.body?.locationId);
      const locationName = String(req.body?.locationName || '').trim() || locationId || 'Unknown location';
      const content = String(req.body?.content || '').trim();
      if (!userId || !locationId || !content) {
        return res.status(400).json({ success: false, message: 'Missing required parameters' });
      }

      const dateKey = getLocalDateKey();
      await cleanupGroupMembers(dateKey, locationId);
      const member = await db.prepare(`
        SELECT * FROM active_group_rp_members
        WHERE locationId = ? AND dateKey = ? AND userId = ?
        LIMIT 1
      `).get(locationId, dateKey, userId) as GroupMemberRow | undefined;
      if (!member) {
        return res.status(403).json({ success: false, message: 'Join the group roleplay before sending messages' });
      }

      const tx = db.transaction(async () => {
        await db.prepare(`
          UPDATE active_group_rp_members
          SET userName = ?, updatedAt = CURRENT_TIMESTAMP
          WHERE locationId = ? AND dateKey = ? AND userId = ?
        `).run(userName || member.userName || `U${userId}`, locationId, dateKey, userId);
        await touchGroupArchiveParticipants(member.archiveId, userId, userName || member.userName || `U${userId}`, locationName);
        await db.prepare(`
          INSERT INTO rp_archive_messages (archiveId, senderId, senderName, content, type, createdAt)
          VALUES (?, ?, ?, ?, 'user', ?)
        `).run(member.archiveId, userId, userName || member.userName || `U${userId}`, content, now());
      });
      await tx();
      notifyGroupLocation(locationId, member.archiveId, { reason: 'message', userId });

      return res.json({ success: true, archiveId: member.archiveId });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error?.message || 'Failed to send group roleplay message' });
    }
  });

  router.post('/rp/group/leave', async (req, res) => {
    try {
      const userId = toSafeUserId(req.body?.userId);
      const userName = String(req.body?.userName || '').trim();
      const locationId = toSafeLocationId(req.body?.locationId);
      if (!userId || !locationId) {
        return res.status(400).json({ success: false, message: 'Missing required parameters' });
      }

      const dateKey = getLocalDateKey();
      await cleanupGroupMembers(dateKey, locationId);
      const member = await db.prepare(`
        SELECT * FROM active_group_rp_members
        WHERE locationId = ? AND dateKey = ? AND userId = ?
        LIMIT 1
      `).get(locationId, dateKey, userId) as GroupMemberRow | undefined;
      if (!member) {
        return res.json({ success: true, left: true });
      }

      let remaining = 0;
      const tx = db.transaction(async () => {
        await db.prepare(`
          INSERT INTO rp_archive_messages (archiveId, senderId, senderName, content, type, createdAt)
          VALUES (?, 0, 'System', ?, 'system', ?)
        `).run(member.archiveId, `${userName || member.userName || `U${userId}`} left the group roleplay.`, now());
        await db.prepare(`DELETE FROM active_group_rp_members WHERE locationId = ? AND dateKey = ? AND userId = ?`).run(locationId, dateKey, userId);
        const row = await db.prepare(`
          SELECT COUNT(*) AS c
          FROM active_group_rp_members
          WHERE locationId = ? AND dateKey = ?
        `).get(locationId, dateKey) as { c?: number } | undefined;
        remaining = Number(row?.c || 0);
        if (remaining <= 0) {
          await db.prepare(`UPDATE rp_archives SET status = 'closed' WHERE id = ?`).run(member.archiveId);
        }
      });
      await tx();
      notifyGroupLocation(locationId, member.archiveId, { reason: 'leave', userId, remaining });

      return res.json({ success: true, left: true, remaining });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error?.message || 'Failed to leave group roleplay' });
    }
  });

  return router;
}

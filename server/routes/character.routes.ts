import { Router } from 'express';
import { AppContext } from '../types';

type AnyRow = Record<string, any>;
const nowIso = () => new Date().toISOString();
const todayKey = () => nowIso().slice(0, 10);
const SAFE_ZONES = new Set(['tower_of_life', 'sanctuary', 'london_tower', 'tower_guard']);
const ONLINE_WINDOW_SECONDS = 20;
const PARANORMAL_OFFICE = 'paranormal_office';
const TOWER_GUARD_LOCATION = 'tower_guard';
const GHOST_PRISON_CHANCE = 0.35;
const TOWER_GUARD_MEMBER_JOBS = new Set(['守塔会成员', '守塔会会长']);
const TOWER_SAINT_JOBS = new Set(['圣子', '圣女']);
const TOWER_GUARD_REVIEW_JOBS = new Set(['守塔会会长', '圣子', '圣女']);
const PRISON_GAME_POOL = [
  { id: 'cipher_shift', name: '凯撒残码' },
  { id: 'symbol_count', name: '符号计数' },
  { id: 'logic_gate', name: '逻辑门' },
  { id: 'code_lock', name: '逆序密码锁' },
  { id: 'matrix_path', name: '矩阵路径' },
  { id: 'odd_symbol', name: '异位符号' },
  { id: 'sequence_mem', name: '序列记忆' },
  { id: 'signal_sync', name: '信号反相' },
] as const;

function ensureParanormalTables(db: any) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS paranormal_prisoners (
      userId INTEGER PRIMARY KEY,
      isImprisoned INTEGER DEFAULT 0,
      failedAttempts INTEGER DEFAULT 0,
      difficultyLevel INTEGER DEFAULT 1,
      currentGameId TEXT DEFAULT '',
      currentGameName TEXT DEFAULT '',
      jailedAt TEXT DEFAULT '',
      lastCheckInAt TEXT DEFAULT '',
      updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS tower_guard_prisoners (
      userId INTEGER PRIMARY KEY,
      isImprisoned INTEGER DEFAULT 0,
      arrestCaseId INTEGER DEFAULT 0,
      captorUserId INTEGER DEFAULT 0,
      captorName TEXT DEFAULT '',
      jailedAt TEXT DEFAULT '',
      releasedAt TEXT DEFAULT '',
      updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS tower_guard_arrest_cases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      applicantUserId INTEGER NOT NULL,
      applicantName TEXT DEFAULT '',
      targetUserId INTEGER NOT NULL,
      targetName TEXT DEFAULT '',
      reason TEXT DEFAULT '',
      status TEXT DEFAULT 'pending_review',
      reviewerUserId INTEGER DEFAULT 0,
      reviewerName TEXT DEFAULT '',
      reviewedAt TEXT DEFAULT '',
      cancelRequesterUserId INTEGER DEFAULT 0,
      cancelReason TEXT DEFAULT '',
      cancelStatus TEXT DEFAULT 'none',
      cancelReviewerUserId INTEGER DEFAULT 0,
      cancelReviewerName TEXT DEFAULT '',
      cancelReviewedAt TEXT DEFAULT '',
      resultMessage TEXT DEFAULT '',
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
      updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_tower_guard_arrest_target_status
      ON tower_guard_arrest_cases(targetUserId, status, updatedAt);
    CREATE INDEX IF NOT EXISTS idx_tower_guard_arrest_applicant_status
      ON tower_guard_arrest_cases(applicantUserId, status, updatedAt);
  `);
  try {
    db.exec(`ALTER TABLE tower_guard_prisoners ADD COLUMN failedAttempts INTEGER DEFAULT 0`);
  } catch {}
  try {
    db.exec(`ALTER TABLE tower_guard_prisoners ADD COLUMN difficultyLevel INTEGER DEFAULT 1`);
  } catch {}
  try {
    db.exec(`ALTER TABLE tower_guard_prisoners ADD COLUMN currentGameId TEXT DEFAULT ''`);
  } catch {}
  try {
    db.exec(`ALTER TABLE tower_guard_prisoners ADD COLUMN currentGameName TEXT DEFAULT ''`);
  } catch {}
}

function pickPrisonGame() {
  const idx = Math.floor(Math.random() * PRISON_GAME_POOL.length);
  return PRISON_GAME_POOL[idx];
}

function ensurePrisonRow(db: any, userId: number) {
  db.prepare(`
    INSERT OR IGNORE INTO paranormal_prisoners(
      userId, isImprisoned, failedAttempts, difficultyLevel, currentGameId, currentGameName, jailedAt, lastCheckInAt, updatedAt
    )
    VALUES (?, 0, 0, 1, '', '', '', '', ?)
  `).run(userId, nowIso());
  return db.prepare(`
    SELECT userId, isImprisoned, failedAttempts, difficultyLevel, currentGameId, currentGameName, jailedAt, lastCheckInAt, updatedAt
    FROM paranormal_prisoners
    WHERE userId = ?
    LIMIT 1
  `).get(userId) as AnyRow;
}

function prisonPayload(row: AnyRow | undefined | null) {
  if (!row) {
    return {
      isImprisoned: false,
      failedAttempts: 0,
      difficultyLevel: 1,
      currentGameId: '',
      currentGameName: '',
      jailedAt: '',
      updatedAt: ''
    };
  }
  return {
    isImprisoned: Number(row.isImprisoned || 0) === 1,
    failedAttempts: Number(row.failedAttempts || 0),
    difficultyLevel: Math.max(1, Number(row.difficultyLevel || 1)),
    currentGameId: String(row.currentGameId || ''),
    currentGameName: String(row.currentGameName || ''),
    jailedAt: String(row.jailedAt || ''),
    updatedAt: String(row.updatedAt || '')
  };
}

function ensureGuardPrisonRow(db: any, userId: number) {
  db.prepare(`
    INSERT OR IGNORE INTO tower_guard_prisoners(
      userId, isImprisoned, arrestCaseId, captorUserId, captorName, jailedAt, releasedAt, updatedAt
    )
    VALUES (?, 0, 0, 0, '', '', '', ?)
  `).run(userId, nowIso());
  return db.prepare(`
    SELECT userId, isImprisoned, arrestCaseId, captorUserId, captorName, jailedAt, releasedAt,
           failedAttempts, difficultyLevel, currentGameId, currentGameName, updatedAt
    FROM tower_guard_prisoners
    WHERE userId = ?
    LIMIT 1
  `).get(userId) as AnyRow;
}

function guardPrisonPayload(row: AnyRow | undefined | null) {
  if (!row) {
    return {
      isImprisoned: false,
      arrestCaseId: 0,
      captorUserId: 0,
      captorName: '',
      jailedAt: '',
      releasedAt: '',
      failedAttempts: 0,
      difficultyLevel: 1,
      currentGameId: '',
      currentGameName: '',
      updatedAt: ''
    };
  }
  return {
    isImprisoned: Number(row.isImprisoned || 0) === 1,
    arrestCaseId: Number(row.arrestCaseId || 0),
    captorUserId: Number(row.captorUserId || 0),
    captorName: String(row.captorName || ''),
    jailedAt: String(row.jailedAt || ''),
    releasedAt: String(row.releasedAt || ''),
    failedAttempts: Number(row.failedAttempts || 0),
    difficultyLevel: Math.max(1, Number(row.difficultyLevel || 1)),
    currentGameId: String(row.currentGameId || ''),
    currentGameName: String(row.currentGameName || ''),
    updatedAt: String(row.updatedAt || '')
  };
}

function isTowerGuardMemberJob(jobRaw: any) {
  return TOWER_GUARD_MEMBER_JOBS.has(String(jobRaw || '').trim());
}

function isTowerSaintJob(jobRaw: any) {
  return TOWER_SAINT_JOBS.has(String(jobRaw || '').trim());
}

function isTowerGuardReviewerJob(jobRaw: any) {
  return TOWER_GUARD_REVIEW_JOBS.has(String(jobRaw || '').trim());
}

function mapGuardArrestCase(row: AnyRow | undefined | null) {
  if (!row) return null;
  return {
    id: Number(row.id || 0),
    applicantUserId: Number(row.applicantUserId || 0),
    applicantName: String(row.applicantName || ''),
    targetUserId: Number(row.targetUserId || 0),
    targetName: String(row.targetName || ''),
    reason: String(row.reason || ''),
    status: String(row.status || 'pending_review'),
    reviewerUserId: Number(row.reviewerUserId || 0),
    reviewerName: String(row.reviewerName || ''),
    reviewedAt: String(row.reviewedAt || ''),
    cancelRequesterUserId: Number(row.cancelRequesterUserId || 0),
    cancelReason: String(row.cancelReason || ''),
    cancelStatus: String(row.cancelStatus || 'none'),
    cancelReviewerUserId: Number(row.cancelReviewerUserId || 0),
    cancelReviewerName: String(row.cancelReviewerName || ''),
    cancelReviewedAt: String(row.cancelReviewedAt || ''),
    resultMessage: String(row.resultMessage || ''),
    createdAt: String(row.createdAt || ''),
    updatedAt: String(row.updatedAt || '')
  };
}

function isGuideRole(roleRaw: any) {
  const role = String(roleRaw || '').trim();
  const low = role.toLowerCase();
  return role === '向导' || low === 'guide';
}

function mapCharacter(u: AnyRow | undefined | null) {
  if (!u) return null;
  return {
    id: Number(u.id),
    name: u.name || '',
    age: Number(u.age ?? 0),
    role: u.role || '未分化',
    status: u.status || 'pending',
    faction: u.faction || '无',
    job: u.job || '无',

    gold: Number(u.gold ?? 0),

    mentalRank: u.mentalRank || '无',
    physicalRank: u.physicalRank || '无',

    hp: Number(u.hp ?? 100),
    maxHp: Number(u.maxHp ?? 100),
    mp: Number(u.mp ?? 100),
    maxMp: Number(u.maxMp ?? 100),
    erosionLevel: Number(u.erosionLevel ?? 0),
    bleedingLevel: Number(u.bleedingLevel ?? 0),
    fury: Number(u.fury ?? 0),
    guideStability: Number(u.guideStability ?? 100),
    partyId: u.partyId || null,

    workCount: Number(u.workCount ?? 0),
    trainCount: Number(u.trainCount ?? 0),
    mentalProgress: Number(u.mentalProgress ?? 0),
    physicalProgress: Number(u.physicalProgress ?? 0),

    currentLocation: u.currentLocation || '',
    homeLocation: u.homeLocation || '',

    avatarUrl: u.avatarUrl || '',
    avatarUpdatedAt: u.avatarUpdatedAt || null,
    profileText: u.profileText || ''
  };
}

function resetDailyCountersIfNeeded(db: any, user: AnyRow | undefined) {
  if (!user) return user;
  const today = todayKey();
  if (String(user.lastResetDate || '') === today) return user;
  db.prepare(`
    UPDATE users
    SET workCount = 0,
        trainCount = 0,
        lastResetDate = ?,
        updatedAt = ?
    WHERE id = ?
  `).run(today, nowIso(), Number(user.id || 0));
  return db.prepare(`SELECT * FROM users WHERE id = ? LIMIT 1`).get(Number(user.id || 0)) as AnyRow | undefined;
}

function touchPresence(db: any, userId: number) {
  if (!userId) return;
  db.prepare(`
    UPDATE user_sessions
    SET lastSeenAt = CURRENT_TIMESTAMP
    WHERE userId = ?
      AND role = 'player'
      AND revokedAt IS NULL
  `).run(userId);
}

export function createCharacterRouter(ctx: AppContext) {
  const r = Router();
  const { db } = ctx;
  ensureParanormalTables(db);

  // 1) 角色动态状态（HUD/状态栏核心接口）
  r.get('/characters/:id/runtime', (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!id) return res.status(400).json({ success: false, message: 'invalid id' });

      const raw = db.prepare(`SELECT * FROM users WHERE id = ? LIMIT 1`).get(id) as AnyRow | undefined;
      if (!raw) return res.status(404).json({ success: false, message: 'user not found' });
      const row = resetDailyCountersIfNeeded(db, raw) || raw;

      res.json({ success: true, user: mapCharacter(row) });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e?.message || 'runtime query failed' });
    }
  });

  r.get('/paranormal/prison/state', (req, res) => {
    try {
      const userId = Number(req.query.userId || 0);
      if (!userId) return res.status(400).json({ success: false, message: 'invalid userId' });

      const user = db.prepare(`SELECT id, status, role, currentLocation FROM users WHERE id = ? LIMIT 1`).get(userId) as AnyRow | undefined;
      if (!user) return res.status(404).json({ success: false, message: 'user not found' });

      const row = ensurePrisonRow(db, userId);
      res.json({
        success: true,
        prison: prisonPayload(row),
        canJailByChance:
          String(user.status || '') === 'ghost' &&
          String(user.currentLocation || '') === PARANORMAL_OFFICE &&
          Number(row.isImprisoned || 0) !== 1
      });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e?.message || 'prison state failed' });
    }
  });

  r.post('/paranormal/prison/resolve', (req, res) => {
    try {
      const userId = Number(req.body?.userId || 0);
      const success = Boolean(req.body?.success);
      if (!userId) return res.status(400).json({ success: false, message: 'invalid userId' });

      const user = db.prepare(`SELECT id, status, currentLocation FROM users WHERE id = ? LIMIT 1`).get(userId) as AnyRow | undefined;
      if (!user) return res.status(404).json({ success: false, message: 'user not found' });

      const now = nowIso();
      const row = ensurePrisonRow(db, userId);
      if (Number(row.isImprisoned || 0) !== 1) {
        return res.status(409).json({ success: false, message: '当前并未被监禁' });
      }

      if (!success) {
        const failedAttempts = Number(row.failedAttempts || 0) + 1;
        const difficultyLevel = Math.max(1, Number(row.difficultyLevel || 1) + 1);
        const game = pickPrisonGame();
        db.prepare(`
          UPDATE paranormal_prisoners
          SET failedAttempts = ?,
              difficultyLevel = ?,
              currentGameId = ?,
              currentGameName = ?,
              updatedAt = ?
          WHERE userId = ?
        `).run(failedAttempts, difficultyLevel, game.id, game.name, now, userId);

        const fresh = ensurePrisonRow(db, userId);
        return res.json({
          success: true,
          escaped: false,
          message: `越狱失败，难度提升至 Lv.${Math.max(1, Number(fresh.difficultyLevel || 1))}`,
          prison: prisonPayload(fresh)
        });
      }

      db.prepare(`
        UPDATE paranormal_prisoners
        SET isImprisoned = 0,
            failedAttempts = 0,
            difficultyLevel = 1,
            currentGameId = '',
            currentGameName = '',
            updatedAt = ?
        WHERE userId = ?
      `).run(now, userId);

      const fresh = ensurePrisonRow(db, userId);
      res.json({
        success: true,
        escaped: true,
        message: '越狱成功，你已恢复自由行动权限。',
        prison: prisonPayload(fresh)
      });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e?.message || 'resolve prison failed' });
    }
  });

  r.get('/tower-guard/prison/state', (req, res) => {
    try {
      const userId = Number(req.query.userId || 0);
      if (!userId) return res.status(400).json({ success: false, message: 'invalid userId' });
      const user = db.prepare(`SELECT id FROM users WHERE id = ? LIMIT 1`).get(userId) as AnyRow | undefined;
      if (!user) return res.status(404).json({ success: false, message: 'user not found' });
      const row = ensureGuardPrisonRow(db, userId);
      return res.json({ success: true, prison: guardPrisonPayload(row) });
    } catch (e: any) {
      return res.status(500).json({ success: false, message: e?.message || 'guard prison state failed' });
    }
  });

  r.post('/tower-guard/prison/resolve', (req, res) => {
    try {
      const userId = Number(req.body?.userId || 0);
      const success = Boolean(req.body?.success);
      if (!userId) return res.status(400).json({ success: false, message: 'invalid userId' });

      const user = db.prepare(`SELECT id FROM users WHERE id = ? LIMIT 1`).get(userId) as AnyRow | undefined;
      if (!user) return res.status(404).json({ success: false, message: 'user not found' });

      const row = ensureGuardPrisonRow(db, userId);
      if (Number(row.isImprisoned || 0) !== 1) {
        return res.status(409).json({ success: false, message: '当前并未被关押在守塔会地下监牢' });
      }

      const ts = nowIso();
      if (!success) {
        const failedAttempts = Number(row.failedAttempts || 0) + 1;
        const difficultyLevel = Math.max(1, Number(row.difficultyLevel || 1) + 1);
        const game = pickPrisonGame();
        db.prepare(`
          UPDATE tower_guard_prisoners
          SET failedAttempts = ?,
              difficultyLevel = ?,
              currentGameId = ?,
              currentGameName = ?,
              updatedAt = ?
          WHERE userId = ?
        `).run(failedAttempts, difficultyLevel, game.id, game.name, ts, userId);
        const fresh = ensureGuardPrisonRow(db, userId);
        return res.json({
          success: true,
          escaped: false,
          message: `越狱失败，难度提升至 Lv.${Math.max(1, Number(fresh.difficultyLevel || 1))}`,
          prison: guardPrisonPayload(fresh)
        });
      }

      db.prepare(`
        UPDATE tower_guard_prisoners
        SET isImprisoned = 0,
            releasedAt = ?,
            failedAttempts = 0,
            difficultyLevel = 1,
            currentGameId = '',
            currentGameName = '',
            updatedAt = ?
        WHERE userId = ?
      `).run(ts, ts, userId);

      const fresh = ensureGuardPrisonRow(db, userId);
      return res.json({
        success: true,
        escaped: true,
        message: '越狱成功，你已恢复自由行动权限。',
        prison: guardPrisonPayload(fresh)
      });
    } catch (e: any) {
      return res.status(500).json({ success: false, message: e?.message || 'resolve tower guard prison failed' });
    }
  });

  r.get('/tower-guard/prisoners', (req, res) => {
    try {
      const rows = db.prepare(`
        SELECT p.userId, p.isImprisoned, p.arrestCaseId, p.captorUserId, p.captorName, p.jailedAt, p.releasedAt, p.updatedAt,
               u.name AS targetName, u.role AS targetRole, u.job AS targetJob
        FROM tower_guard_prisoners p
        LEFT JOIN users u ON u.id = p.userId
        WHERE p.isImprisoned = 1
        ORDER BY datetime(COALESCE(p.jailedAt, p.updatedAt)) DESC
        LIMIT 120
      `).all() as AnyRow[];
      return res.json({
        success: true,
        prisoners: rows.map((row) => ({
          userId: Number(row.userId || 0),
          targetName: String(row.targetName || ''),
          targetRole: String(row.targetRole || ''),
          targetJob: String(row.targetJob || ''),
          arrestCaseId: Number(row.arrestCaseId || 0),
          captorUserId: Number(row.captorUserId || 0),
          captorName: String(row.captorName || ''),
          jailedAt: String(row.jailedAt || ''),
          updatedAt: String(row.updatedAt || '')
        }))
      });
    } catch (e: any) {
      return res.status(500).json({ success: false, message: e?.message || 'guard prisoners query failed', prisoners: [] });
    }
  });

  r.post('/tower-guard/prison/release', (req, res) => {
    try {
      const userId = Number(req.body?.userId || 0);
      const targetUserId = Number(req.body?.targetUserId || 0);
      if (!userId || !targetUserId) return res.status(400).json({ success: false, message: 'invalid params' });

      const reviewer = db.prepare(`SELECT id, name, job FROM users WHERE id = ? LIMIT 1`).get(userId) as AnyRow | undefined;
      if (!reviewer) return res.status(404).json({ success: false, message: 'reviewer not found' });
      if (!isTowerGuardReviewerJob(reviewer.job)) {
        return res.status(403).json({ success: false, message: '仅守塔会会长或命之塔圣子/圣女可释放监牢成员' });
      }

      const now = nowIso();
      const row = ensureGuardPrisonRow(db, targetUserId);
      if (Number(row.isImprisoned || 0) !== 1) {
        return res.status(409).json({ success: false, message: '目标当前不在地下监牢中' });
      }

      db.prepare(`
        UPDATE tower_guard_prisoners
        SET isImprisoned = 0,
            releasedAt = ?,
            failedAttempts = 0,
            difficultyLevel = 1,
            currentGameId = '',
            currentGameName = '',
            updatedAt = ?
        WHERE userId = ?
      `).run(now, now, targetUserId);

      return res.json({
        success: true,
        message: '已释放目标，地下监牢限制已解除',
        prison: guardPrisonPayload(ensureGuardPrisonRow(db, targetUserId))
      });
    } catch (e: any) {
      return res.status(500).json({ success: false, message: e?.message || 'release guard prisoner failed' });
    }
  });

  r.post('/tower-guard/arrest/apply', (req, res) => {
    try {
      const userId = Number(req.body?.userId || 0);
      const targetUserId = Number(req.body?.targetUserId || 0);
      const reason = String(req.body?.reason || '').trim();
      if (!userId || !targetUserId || userId === targetUserId) {
        return res.status(400).json({ success: false, message: 'invalid userId/targetUserId' });
      }

      const applicant = db.prepare(`SELECT id, name, job FROM users WHERE id = ? LIMIT 1`).get(userId) as AnyRow | undefined;
      if (!applicant) return res.status(404).json({ success: false, message: 'applicant not found' });
      if (!isTowerGuardMemberJob(applicant.job)) {
        return res.status(403).json({ success: false, message: '仅守塔会成员可发起抓捕申请' });
      }

      const target = db.prepare(`SELECT id, name, status, currentLocation FROM users WHERE id = ? LIMIT 1`).get(targetUserId) as AnyRow | undefined;
      if (!target) return res.status(404).json({ success: false, message: 'target user not found' });

      const targetPrison = ensureGuardPrisonRow(db, targetUserId);
      if (Number(targetPrison.isImprisoned || 0) === 1) {
        return res.status(409).json({ success: false, message: '目标已在守塔会地下监牢中' });
      }

      const activeCase = db.prepare(`
        SELECT id
        FROM tower_guard_arrest_cases
        WHERE targetUserId = ?
          AND status = 'pending_review'
        ORDER BY id DESC
        LIMIT 1
      `).get(targetUserId) as AnyRow | undefined;
      if (activeCase) {
        return res.status(409).json({ success: false, message: '目标已有待审批抓捕申请' });
      }

      const ts = nowIso();
      db.prepare(`
        INSERT INTO tower_guard_arrest_cases(
          applicantUserId, applicantName, targetUserId, targetName, reason, status, cancelStatus, createdAt, updatedAt
        )
        VALUES(?,?,?,?,?,'pending_review','none',?,?)
      `).run(
        Number(applicant.id || 0),
        String(applicant.name || ''),
        Number(target.id || 0),
        String(target.name || ''),
        reason || '秩序巡查抓捕申请',
        ts,
        ts
      );

      const created = db.prepare(`
        SELECT *
        FROM tower_guard_arrest_cases
        WHERE applicantUserId = ?
          AND targetUserId = ?
        ORDER BY id DESC
        LIMIT 1
      `).get(userId, targetUserId) as AnyRow | undefined;

      return res.json({
        success: true,
        message: '抓捕申请已提交，等待守塔会会长或命之塔圣子/圣女审批。',
        case: mapGuardArrestCase(created)
      });
    } catch (e: any) {
      return res.status(500).json({ success: false, message: e?.message || 'apply tower guard arrest failed' });
    }
  });

  r.get('/tower-guard/arrest/inbox', (req, res) => {
    try {
      const userId = Number(req.query.userId || 0);
      if (!userId) return res.status(400).json({ success: false, message: 'invalid userId' });
      const user = db.prepare(`SELECT id, name, job FROM users WHERE id = ? LIMIT 1`).get(userId) as AnyRow | undefined;
      if (!user) return res.status(404).json({ success: false, message: 'user not found' });

      const incomingPending = db.prepare(`
        SELECT *
        FROM tower_guard_arrest_cases
        WHERE targetUserId = ?
          AND status = 'pending_review'
        ORDER BY id DESC
        LIMIT 1
      `).get(userId) as AnyRow | undefined;

      const outgoingRecent = db.prepare(`
        SELECT *
        FROM tower_guard_arrest_cases
        WHERE applicantUserId = ?
        ORDER BY datetime(COALESCE(updatedAt, createdAt)) DESC, id DESC
        LIMIT 24
      `).all(userId) as AnyRow[];

      const canReviewCapture = isTowerGuardReviewerJob(user.job);
      const canReviewCancel = isTowerSaintJob(user.job);

      const captureReviewQueue = canReviewCapture
        ? (db.prepare(`
            SELECT *
            FROM tower_guard_arrest_cases
            WHERE status = 'pending_review'
            ORDER BY datetime(COALESCE(createdAt, updatedAt)) ASC, id ASC
            LIMIT 80
          `).all() as AnyRow[])
        : [];

      const cancelReviewQueue = canReviewCancel
        ? (db.prepare(`
            SELECT *
            FROM tower_guard_arrest_cases
            WHERE status = 'pending_review'
              AND cancelStatus = 'pending'
            ORDER BY datetime(COALESCE(updatedAt, createdAt)) ASC, id ASC
            LIMIT 80
          `).all() as AnyRow[])
        : [];

      return res.json({
        success: true,
        incomingPending: mapGuardArrestCase(incomingPending),
        outgoingRecent: outgoingRecent.map(mapGuardArrestCase),
        canReviewCapture,
        canReviewCancel,
        captureReviewQueue: captureReviewQueue.map(mapGuardArrestCase),
        cancelReviewQueue: cancelReviewQueue.map(mapGuardArrestCase)
      });
    } catch (e: any) {
      return res.status(500).json({ success: false, message: e?.message || 'tower guard arrest inbox failed' });
    }
  });

  r.post('/tower-guard/arrest/cancel-request', (req, res) => {
    try {
      const userId = Number(req.body?.userId || 0);
      const caseId = Number(req.body?.caseId || 0);
      const reason = String(req.body?.reason || '').trim();
      if (!userId || !caseId) return res.status(400).json({ success: false, message: 'invalid params' });

      const row = db.prepare(`SELECT * FROM tower_guard_arrest_cases WHERE id = ? LIMIT 1`).get(caseId) as AnyRow | undefined;
      if (!row) return res.status(404).json({ success: false, message: 'case not found' });
      if (Number(row.targetUserId || 0) !== userId) {
        return res.status(403).json({ success: false, message: '只有被抓捕目标可提交撤销申请' });
      }
      if (String(row.status || '') !== 'pending_review') {
        return res.status(409).json({ success: false, message: '当前阶段无法提交撤销申请' });
      }
      if (String(row.cancelStatus || 'none') === 'pending') {
        return res.status(409).json({ success: false, message: '撤销申请已在审批中' });
      }

      const ts = nowIso();
      db.prepare(`
        UPDATE tower_guard_arrest_cases
        SET cancelRequesterUserId = ?,
            cancelReason = ?,
            cancelStatus = 'pending',
            cancelReviewerUserId = 0,
            cancelReviewerName = '',
            cancelReviewedAt = '',
            updatedAt = ?
        WHERE id = ?
      `).run(userId, reason || '请求命之塔撤销本次抓捕申请', ts, caseId);

      const fresh = db.prepare(`SELECT * FROM tower_guard_arrest_cases WHERE id = ? LIMIT 1`).get(caseId) as AnyRow | undefined;
      return res.json({
        success: true,
        message: '撤销抓捕申请已提交至命之塔审批。',
        case: mapGuardArrestCase(fresh)
      });
    } catch (e: any) {
      return res.status(500).json({ success: false, message: e?.message || 'submit arrest cancel request failed' });
    }
  });

  r.post('/tower-guard/arrest/review', (req, res) => {
    try {
      const userId = Number(req.body?.userId || 0);
      const caseId = Number(req.body?.caseId || 0);
      const action = String(req.body?.action || '').trim().toLowerCase();
      if (!userId || !caseId || (action !== 'approve' && action !== 'reject')) {
        return res.status(400).json({ success: false, message: 'invalid params' });
      }

      const reviewer = db.prepare(`SELECT id, name, job FROM users WHERE id = ? LIMIT 1`).get(userId) as AnyRow | undefined;
      if (!reviewer) return res.status(404).json({ success: false, message: 'reviewer not found' });
      if (!isTowerGuardReviewerJob(reviewer.job)) {
        return res.status(403).json({ success: false, message: '仅守塔会会长或命之塔圣子/圣女可审批抓捕申请' });
      }

      const row = db.prepare(`SELECT * FROM tower_guard_arrest_cases WHERE id = ? LIMIT 1`).get(caseId) as AnyRow | undefined;
      if (!row) return res.status(404).json({ success: false, message: 'case not found' });
      if (String(row.status || '') !== 'pending_review') {
        return res.status(409).json({ success: false, message: '该抓捕申请已完成审批' });
      }

      const ts = nowIso();
      if (action === 'reject') {
        db.prepare(`
          UPDATE tower_guard_arrest_cases
          SET status = 'rejected',
              reviewerUserId = ?,
              reviewerName = ?,
              reviewedAt = ?,
              resultMessage = ?,
              updatedAt = ?
          WHERE id = ?
        `).run(
          Number(reviewer.id || 0),
          String(reviewer.name || ''),
          ts,
          '抓捕申请被驳回',
          ts,
          caseId
        );
        const fresh = db.prepare(`SELECT * FROM tower_guard_arrest_cases WHERE id = ? LIMIT 1`).get(caseId) as AnyRow | undefined;
        return res.json({ success: true, message: '已驳回该抓捕申请', case: mapGuardArrestCase(fresh) });
      }

      if (String(row.cancelStatus || '') === 'approved') {
        db.prepare(`
          UPDATE tower_guard_arrest_cases
          SET status = 'cancelled',
              reviewerUserId = ?,
              reviewerName = ?,
              reviewedAt = ?,
              resultMessage = ?,
              updatedAt = ?
          WHERE id = ?
        `).run(
          Number(reviewer.id || 0),
          String(reviewer.name || ''),
          ts,
          '命之塔已批准撤销申请，本次抓捕失败',
          ts,
          caseId
        );
        const fresh = db.prepare(`SELECT * FROM tower_guard_arrest_cases WHERE id = ? LIMIT 1`).get(caseId) as AnyRow | undefined;
        return res.json({ success: true, message: '撤销申请已生效，抓捕失败', case: mapGuardArrestCase(fresh) });
      }

      const targetUserId = Number(row.targetUserId || 0);
      const target = db.prepare(`SELECT id, name FROM users WHERE id = ? LIMIT 1`).get(targetUserId) as AnyRow | undefined;
      if (!target) {
        db.prepare(`
          UPDATE tower_guard_arrest_cases
          SET status = 'rejected',
              reviewerUserId = ?,
              reviewerName = ?,
              reviewedAt = ?,
              resultMessage = ?,
              updatedAt = ?
          WHERE id = ?
        `).run(
          Number(reviewer.id || 0),
          String(reviewer.name || ''),
          ts,
          '目标不存在，抓捕申请自动驳回',
          ts,
          caseId
        );
        const fresh = db.prepare(`SELECT * FROM tower_guard_arrest_cases WHERE id = ? LIMIT 1`).get(caseId) as AnyRow | undefined;
        return res.json({ success: true, message: '目标不存在，已自动驳回', case: mapGuardArrestCase(fresh) });
      }

      const guardPrison = ensureGuardPrisonRow(db, targetUserId);
      if (Number(guardPrison.isImprisoned || 0) === 1) {
        db.prepare(`
          UPDATE tower_guard_arrest_cases
          SET status = 'rejected',
              reviewerUserId = ?,
              reviewerName = ?,
              reviewedAt = ?,
              resultMessage = ?,
              updatedAt = ?
          WHERE id = ?
        `).run(
          Number(reviewer.id || 0),
          String(reviewer.name || ''),
          ts,
          '目标已在地下监牢中，抓捕申请自动驳回',
          ts,
          caseId
        );
        const fresh = db.prepare(`SELECT * FROM tower_guard_arrest_cases WHERE id = ? LIMIT 1`).get(caseId) as AnyRow | undefined;
        return res.json({ success: true, message: '目标已在监牢中，已自动驳回', case: mapGuardArrestCase(fresh) });
      }

      db.prepare(`
        UPDATE users
        SET currentLocation = ?,
            updatedAt = ?
        WHERE id = ?
      `).run(TOWER_GUARD_LOCATION, ts, targetUserId);

      const game = pickPrisonGame();
      db.prepare(`
        UPDATE tower_guard_prisoners
        SET isImprisoned = 1,
            arrestCaseId = ?,
            captorUserId = ?,
            captorName = ?,
            jailedAt = ?,
            releasedAt = '',
            failedAttempts = 0,
            difficultyLevel = 1,
            currentGameId = ?,
            currentGameName = ?,
            updatedAt = ?
        WHERE userId = ?
      `).run(
        caseId,
        Number(row.applicantUserId || 0),
        String(row.applicantName || ''),
        ts,
        game.id,
        game.name,
        ts,
        targetUserId
      );

      db.prepare(`
        UPDATE tower_guard_arrest_cases
        SET status = 'captured',
            reviewerUserId = ?,
            reviewerName = ?,
            reviewedAt = ?,
            resultMessage = ?,
            updatedAt = ?
        WHERE id = ?
      `).run(
        Number(reviewer.id || 0),
        String(reviewer.name || ''),
        ts,
        `${String(target.name || '目标')} 已被押入守塔会地下监牢`,
        ts,
        caseId
      );

      const fresh = db.prepare(`SELECT * FROM tower_guard_arrest_cases WHERE id = ? LIMIT 1`).get(caseId) as AnyRow | undefined;
      return res.json({
        success: true,
        message: `${String(target.name || '目标')} 抓捕执行成功，已押入地下监牢`,
        case: mapGuardArrestCase(fresh),
        prison: guardPrisonPayload(ensureGuardPrisonRow(db, targetUserId))
      });
    } catch (e: any) {
      return res.status(500).json({ success: false, message: e?.message || 'review guard arrest failed' });
    }
  });

  r.post('/tower-guard/arrest/cancel-review', (req, res) => {
    try {
      const userId = Number(req.body?.userId || 0);
      const caseId = Number(req.body?.caseId || 0);
      const action = String(req.body?.action || '').trim().toLowerCase();
      if (!userId || !caseId || (action !== 'approve' && action !== 'reject')) {
        return res.status(400).json({ success: false, message: 'invalid params' });
      }

      const reviewer = db.prepare(`SELECT id, name, job FROM users WHERE id = ? LIMIT 1`).get(userId) as AnyRow | undefined;
      if (!reviewer) return res.status(404).json({ success: false, message: 'reviewer not found' });
      if (!isTowerSaintJob(reviewer.job)) {
        return res.status(403).json({ success: false, message: '仅命之塔圣子/圣女可审批撤销抓捕申请' });
      }

      const row = db.prepare(`SELECT * FROM tower_guard_arrest_cases WHERE id = ? LIMIT 1`).get(caseId) as AnyRow | undefined;
      if (!row) return res.status(404).json({ success: false, message: 'case not found' });
      if (String(row.status || '') !== 'pending_review' || String(row.cancelStatus || '') !== 'pending') {
        return res.status(409).json({ success: false, message: '当前没有待审批的撤销抓捕申请' });
      }

      const ts = nowIso();
      if (action === 'approve') {
        db.prepare(`
          UPDATE tower_guard_arrest_cases
          SET status = 'cancelled',
              cancelStatus = 'approved',
              cancelReviewerUserId = ?,
              cancelReviewerName = ?,
              cancelReviewedAt = ?,
              resultMessage = ?,
              updatedAt = ?
          WHERE id = ?
        `).run(
          Number(reviewer.id || 0),
          String(reviewer.name || ''),
          ts,
          '命之塔已批准撤销抓捕申请，本次抓捕失败',
          ts,
          caseId
        );
        const fresh = db.prepare(`SELECT * FROM tower_guard_arrest_cases WHERE id = ? LIMIT 1`).get(caseId) as AnyRow | undefined;
        return res.json({ success: true, message: '已批准撤销，本次抓捕已失效', case: mapGuardArrestCase(fresh) });
      }

      db.prepare(`
        UPDATE tower_guard_arrest_cases
        SET cancelStatus = 'rejected',
            cancelReviewerUserId = ?,
            cancelReviewerName = ?,
            cancelReviewedAt = ?,
            resultMessage = ?,
            updatedAt = ?
        WHERE id = ?
      `).run(
        Number(reviewer.id || 0),
        String(reviewer.name || ''),
        ts,
        '命之塔驳回撤销抓捕申请，抓捕审批继续',
        ts,
        caseId
      );
      const fresh = db.prepare(`SELECT * FROM tower_guard_arrest_cases WHERE id = ? LIMIT 1`).get(caseId) as AnyRow | undefined;
      return res.json({ success: true, message: '已驳回撤销申请', case: mapGuardArrestCase(fresh) });
    } catch (e: any) {
      return res.status(500).json({ success: false, message: e?.message || 'review arrest cancel failed' });
    }
  });

  // 2) 更新位置（驻足/进入）
  r.post('/characters/:id/location', (req, res) => {
    try {
      const id = Number(req.params.id);
      const locationId = String(req.body?.locationId || '').trim();
      if (!id || !locationId) {
        return res.status(400).json({ success: false, message: 'id/locationId required' });
      }

      const row = db.prepare(`SELECT id, name, age, role, status, fury, guideStability, partyId, currentLocation FROM users WHERE id = ?`).get(id) as AnyRow | undefined;
      if (!row) return res.status(404).json({ success: false, message: 'user not found' });

      const role = String(row.role || '');
      const isSentinel = role === '哨兵' || role.toLowerCase() === 'sentinel';
      const isGuide = role === '向导' || role.toLowerCase() === 'guide';
      const age = Number(row.age ?? 0);
      const fury = Number(row.fury ?? 0);
      const stability = Number(row.guideStability ?? 100);
      const isTryingLeaveSanctuary = locationId !== 'sanctuary';

      if (age < 16 && !SAFE_ZONES.has(locationId)) {
        const minorRiskConfirmed = Boolean(req.body?.minorRiskConfirmed);
        let hasGuideEscort = false;
        const partyId = String(row.partyId || '').trim();
        if (partyId) {
          const members = db.prepare(`SELECT id, role FROM users WHERE partyId = ?`).all(partyId) as AnyRow[];
          hasGuideEscort = members.some((m) => Number(m.id) !== id && isGuideRole(m.role));
        }

        if (!minorRiskConfirmed && !hasGuideEscort) {
          return res.status(403).json({
            success: false,
            code: 'MINOR_RISK_CONFIRM_REQUIRED',
            message: 'undifferentiated players need risk confirmation or guide escort for unsafe areas'
          });
        }
      }

      if (isTryingLeaveSanctuary && isSentinel && fury >= 80) {
        return res.status(403).json({
          success: false,
          code: 'FURY_LOCK',
          message: 'sentinel fury is too high; go to sanctuary first'
        });
      }
      if (isTryingLeaveSanctuary && isGuide && stability <= 20) {
        return res.status(403).json({
          success: false,
          code: 'STABILITY_LOCK',
          message: 'guide stability is too low; go to sanctuary first'
        });
      }

      const fromLocation = String(row.currentLocation || '').trim();

      const prisonRow = ensurePrisonRow(db, id);
      if (Number(prisonRow.isImprisoned || 0) === 1 && locationId !== PARANORMAL_OFFICE) {
        return res.status(403).json({
          success: false,
          code: 'GHOST_PRISON_LOCKED',
          message: '你被收容在灵异管理所监牢中，当前无法离开。'
        });
      }
      const guardPrisonRow = ensureGuardPrisonRow(db, id);
      if (Number(guardPrisonRow.isImprisoned || 0) === 1 && locationId !== TOWER_GUARD_LOCATION) {
        return res.status(403).json({
          success: false,
          code: 'TOWER_GUARD_PRISON_LOCKED',
          message: '你被关押在守塔会地下监牢中，当前无法离开。'
        });
      }

      if (fromLocation === 'tower_of_life' && locationId !== 'tower_of_life') {
        const towerAdjacent = new Set(['sanctuary', 'london_tower', 'slums', 'rich_area', 'guild', 'army']);
        if (!towerAdjacent.has(locationId)) {
          return res.status(403).json({
            success: false,
            code: 'TOWER_ADJACENT_ONLY',
            message: '您无法一下子走那么远'
          });
        }
      }

      db.prepare(`
        UPDATE users
        SET currentLocation = ?, updatedAt = ?
        WHERE id = ?
      `).run(locationId, nowIso(), id);

      let prisonTrigger = null as null | { gameId: string; gameName: string };
      const isGhostStatus = String(row.status || '') === 'ghost';
      const enteringParanormal = locationId === PARANORMAL_OFFICE && fromLocation !== PARANORMAL_OFFICE;
      const notYetImprisoned = Number(prisonRow.isImprisoned || 0) !== 1;
      if (isGhostStatus && enteringParanormal && notYetImprisoned && Math.random() < GHOST_PRISON_CHANCE) {
        const game = pickPrisonGame();
        db.prepare(`
          UPDATE paranormal_prisoners
          SET isImprisoned = 1,
              failedAttempts = COALESCE(failedAttempts, 0),
              difficultyLevel = CASE WHEN COALESCE(difficultyLevel, 0) <= 0 THEN 1 ELSE difficultyLevel END,
              currentGameId = ?,
              currentGameName = ?,
              jailedAt = ?,
              lastCheckInAt = ?,
              updatedAt = ?
          WHERE userId = ?
        `).run(game.id, game.name, nowIso(), nowIso(), nowIso(), id);
        prisonTrigger = { gameId: game.id, gameName: game.name };
      }

      const partyId = String(row.partyId || '').trim();
      if (partyId) {
        const others = db.prepare(`SELECT id FROM users WHERE partyId = ? AND id <> ?`).all(partyId, id) as AnyRow[];
        if (others.length > 0) {
          const ts = nowIso();
          const ins = db.prepare(`
            INSERT INTO party_requests(batchKey,requestType,partyId,fromUserId,toUserId,targetUserId,payloadJson,status,resultMessage,createdAt,updatedAt)
            VALUES(?,?,?,?,?,?,?,?,?,?,?)
          `);
          for (const m of others) {
            const toId = Number(m.id || 0);
            if (!toId) continue;
            db.prepare(`
              UPDATE party_requests
              SET status = 'cancelled', resultMessage = ?, updatedAt = ?
              WHERE requestType = 'follow'
                AND fromUserId = ?
                AND toUserId = ?
                AND partyId = ?
                AND status = 'pending'
            `).run('移动更新为新目的地', ts, id, toId, partyId);
            ins.run(
              `follow-${Date.now()}-${id}-${toId}`,
              'follow',
              partyId,
              id,
              toId,
              0,
              JSON.stringify({ locationId, fromUserName: String(row.name || '') }),
              'pending',
              '',
              ts,
              ts
            );
          }
        }
      }

      try {
        // 纠缠状态按移动坐标触发：任一方移动都会刷新时间戳，前端据此弹出“是否继续纠缠”。
        db.prepare(`
          UPDATE party_entanglements
          SET updatedAt = ?
          WHERE active = 1
            AND (userAId = ? OR userBId = ?)
        `).run(nowIso(), id, id);
      } catch {
        // 表可能尚未初始化，忽略不影响主流程
      }

      const freshPrison = ensurePrisonRow(db, id);
      const freshGuardPrison = ensureGuardPrisonRow(db, id);
      res.json({
        success: true,
        locationId,
        prison: prisonPayload(freshPrison),
        guardPrison: guardPrisonPayload(freshGuardPrison),
        prisonTriggered: !!prisonTrigger,
        prisonGame: prisonTrigger
      });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e?.message || 'location update failed' });
    }
  });

  // 3) 地图同区域玩家（悬浮头像）
  r.get('/locations/:locationId/players', (req, res) => {
    try {
      const locationId = String(req.params.locationId || '').trim();
      const excludeId = Number(req.query.excludeId || 0);

      if (!locationId) return res.json({ success: true, players: [] });

      const rows = db.prepare(`
        SELECT
          u.id,
          u.name,
          u.role,
          u.job,
          u.status,
          u.currentLocation,
          u.avatarUrl,
          u.avatarUpdatedAt,
          u.partyId,
          COALESCE(tgp.isImprisoned, 0) AS towerGuardImprisoned,
          COALESCE(pp.isImprisoned, 0) AS paranormalImprisoned
        FROM users u
        LEFT JOIN tower_guard_prisoners tgp ON tgp.userId = u.id
        LEFT JOIN paranormal_prisoners pp ON pp.userId = u.id
        WHERE u.currentLocation = ?
          AND u.status IN ('approved', 'ghost')
          AND EXISTS (
            SELECT 1
            FROM user_sessions s
            WHERE s.userId = u.id
              AND s.role = 'player'
              AND s.revokedAt IS NULL
              AND datetime(s.lastSeenAt) >= datetime('now', ?)
          )
        ORDER BY u.id DESC
      `).all(locationId, `-${ONLINE_WINDOW_SECONDS} seconds`) as AnyRow[];

      const players = rows
        .filter((u) => Number(u.id) !== excludeId)
        .map((u) => ({
          id: Number(u.id),
          name: u.name || '',
          role: u.role || '未分化',
          job: u.job || '无',
          status: u.status || '',
          currentLocation: u.currentLocation || '',
          partyId: u.partyId || null,
          avatarUrl: u.avatarUrl || '',
          avatarUpdatedAt: u.avatarUpdatedAt || null,
          towerGuardImprisoned: Number(u.towerGuardImprisoned || 0) === 1,
          paranormalImprisoned: Number(u.paranormalImprisoned || 0) === 1
        }));

      res.json({ success: true, players });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e?.message || 'players query failed', players: [] });
    }
  });

  r.post('/presence/heartbeat', (req, res) => {
    try {
      const userId = Number(req.body?.userId || 0);
      if (!userId) return res.status(400).json({ success: false, message: 'invalid userId' });
      touchPresence(db, userId);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e?.message || 'heartbeat failed' });
    }
  });

  // 4) 兼容旧前端路径（你现有 GameView 就在用）
  r.post('/users/:id/location', (req, res) => {
    req.url = `/characters/${req.params.id}/location`;
    (r as any).handle(req, res);
  });

  return r;
}

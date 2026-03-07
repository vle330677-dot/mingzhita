import { Router } from 'express';
import { AppContext } from '../types';
import { filterPresenceByLocation, loadOnlinePresenceFallback, loadPresenceByUserId } from '../utils/presence';

type AnyRow = Record<string, any>;
const nowIso = () => new Date().toISOString();
const todayKey = () => nowIso().slice(0, 10);
const SAFE_ZONES = new Set(['tower_of_life','sanctuary','london_tower','tower_guard']);
const ONLINE_WINDOW_SECONDS = 90;
const PARANORMAL_OFFICE = 'paranormal_office';
const TOWER_GUARD_LOCATION = 'tower_guard';
const GHOST_PRISON_CHANCE = 0.35;
const TOWER_GUARD_MEMBER_JOBS = new Set(['守塔会成员','守塔会会长']);
const TOWER_SAINT_JOBS = new Set(['圣子','圣女']);
const TOWER_GUARD_REVIEW_JOBS = new Set(['守塔会会长','圣子','圣女']);
const PRISON_GAME_POOL = [
  { id: 'cipher_shift', name: '位移密码' },
  { id: 'symbol_count', name: '符号计数' },
  { id: 'logic_gate', name: '逻辑门阵' },
  { id: 'code_lock', name: '逆序密码锁' },
  { id: 'matrix_path', name: '矩阵路径' },
  { id: 'odd_symbol', name: '异位符号' },
  { id: 'sequence_mem', name: '序列记忆' },
  { id: 'signal_sync', name: '信号同步' }
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
    CREATE INDEX IF NOT EXISTS idx_tower_guard_arrest_target_status ON tower_guard_arrest_cases(targetUserId, status, updatedAt);
    CREATE INDEX IF NOT EXISTS idx_tower_guard_arrest_applicant_status ON tower_guard_arrest_cases(applicantUserId, status, updatedAt);
  `);
  try { db.exec(`ALTER TABLE tower_guard_prisoners ADD COLUMN failedAttempts INTEGER DEFAULT 0`); } catch {}
  try { db.exec(`ALTER TABLE tower_guard_prisoners ADD COLUMN difficultyLevel INTEGER DEFAULT 1`); } catch {}
  try { db.exec(`ALTER TABLE tower_guard_prisoners ADD COLUMN currentGameId TEXT DEFAULT ''`); } catch {}
  try { db.exec(`ALTER TABLE tower_guard_prisoners ADD COLUMN currentGameName TEXT DEFAULT ''`); } catch {}
}

function pickPrisonGame() { return PRISON_GAME_POOL[Math.floor(Math.random() * PRISON_GAME_POOL.length)]; }
function ensurePrisonRow(db: any, userId: number) {
  db.prepare(`INSERT OR IGNORE INTO paranormal_prisoners(userId,isImprisoned,failedAttempts,difficultyLevel,currentGameId,currentGameName,jailedAt,lastCheckInAt,updatedAt) VALUES (?,0,0,1,'','','','',?)`).run(userId, nowIso());
  return db.prepare(`SELECT * FROM paranormal_prisoners WHERE userId = ? LIMIT 1`).get(userId) as AnyRow;
}
function prisonPayload(row: AnyRow | undefined | null) {
  return { isImprisoned: Number(row?.isImprisoned || 0) === 1, failedAttempts: Number(row?.failedAttempts || 0), difficultyLevel: Math.max(1, Number(row?.difficultyLevel || 1)), currentGameId: String(row?.currentGameId || ''), currentGameName: String(row?.currentGameName || ''), jailedAt: String(row?.jailedAt || ''), updatedAt: String(row?.updatedAt || '') };
}
function ensureGuardPrisonRow(db: any, userId: number) {
  db.prepare(`INSERT OR IGNORE INTO tower_guard_prisoners(userId,isImprisoned,arrestCaseId,captorUserId,captorName,jailedAt,releasedAt,updatedAt) VALUES (?,0,0,0,'','','',?)`).run(userId, nowIso());
  return db.prepare(`SELECT userId,isImprisoned,arrestCaseId,captorUserId,captorName,jailedAt,releasedAt,failedAttempts,difficultyLevel,currentGameId,currentGameName,updatedAt FROM tower_guard_prisoners WHERE userId = ? LIMIT 1`).get(userId) as AnyRow;
}
function guardPrisonPayload(row: AnyRow | undefined | null) {
  return { isImprisoned: Number(row?.isImprisoned || 0) === 1, arrestCaseId: Number(row?.arrestCaseId || 0), captorUserId: Number(row?.captorUserId || 0), captorName: String(row?.captorName || ''), jailedAt: String(row?.jailedAt || ''), releasedAt: String(row?.releasedAt || ''), failedAttempts: Number(row?.failedAttempts || 0), difficultyLevel: Math.max(1, Number(row?.difficultyLevel || 1)), currentGameId: String(row?.currentGameId || ''), currentGameName: String(row?.currentGameName || ''), updatedAt: String(row?.updatedAt || '') };
}
const isTowerGuardMemberJob = (jobRaw: any) => TOWER_GUARD_MEMBER_JOBS.has(String(jobRaw || '').trim());
const isTowerSaintJob = (jobRaw: any) => TOWER_SAINT_JOBS.has(String(jobRaw || '').trim());
const isTowerGuardReviewerJob = (jobRaw: any) => TOWER_GUARD_REVIEW_JOBS.has(String(jobRaw || '').trim());
function mapGuardArrestCase(row: AnyRow | undefined | null) {
  if (!row) return null;
  return { id: Number(row.id || 0), applicantUserId: Number(row.applicantUserId || 0), applicantName: String(row.applicantName || ''), targetUserId: Number(row.targetUserId || 0), targetName: String(row.targetName || ''), reason: String(row.reason || ''), status: String(row.status || 'pending_review'), reviewerUserId: Number(row.reviewerUserId || 0), reviewerName: String(row.reviewerName || ''), reviewedAt: String(row.reviewedAt || ''), cancelRequesterUserId: Number(row.cancelRequesterUserId || 0), cancelReason: String(row.cancelReason || ''), cancelStatus: String(row.cancelStatus || 'none'), cancelReviewerUserId: Number(row.cancelReviewerUserId || 0), cancelReviewerName: String(row.cancelReviewerName || ''), cancelReviewedAt: String(row.cancelReviewedAt || ''), resultMessage: String(row.resultMessage || ''), createdAt: String(row.createdAt || ''), updatedAt: String(row.updatedAt || '') };
}
const isGuideRole = (roleRaw: any) => { const role = String(roleRaw || '').trim(); return role === '向导' || role.toLowerCase() === 'guide'; };
function mapCharacter(u: AnyRow | undefined | null) {
  if (!u) return null;
  return { id: Number(u.id), name: String(u.name || ''), age: Number(u.age ?? 0), role: String(u.role || '未分化'), status: String(u.status || 'pending'), faction: String(u.faction || '无'), job: String(u.job || '无'), gold: Number(u.gold ?? 0), mentalRank: String(u.mentalRank || '无'), physicalRank: String(u.physicalRank || '无'), hp: Number(u.hp ?? 100), maxHp: Number(u.maxHp ?? 100), mp: Number(u.mp ?? 100), maxMp: Number(u.maxMp ?? 100), erosionLevel: Number(u.erosionLevel ?? 0), bleedingLevel: Number(u.bleedingLevel ?? 0), fury: Number(u.fury ?? 0), guideStability: Number(u.guideStability ?? 100), partyId: u.partyId || null, workCount: Number(u.workCount ?? 0), trainCount: Number(u.trainCount ?? 0), mentalProgress: Number(u.mentalProgress ?? 0), physicalProgress: Number(u.physicalProgress ?? 0), currentLocation: String(u.currentLocation || ''), homeLocation: String(u.homeLocation || ''), avatarUrl: String(u.avatarUrl || ''), avatarUpdatedAt: u.avatarUpdatedAt || null, profileText: String(u.profileText || '') };
}
function resetDailyCountersIfNeeded(db: any, user: AnyRow | undefined) {
  if (!user || String(user.lastResetDate || '') === todayKey()) return user;
  db.prepare(`UPDATE users SET workCount = 0, trainCount = 0, lastResetDate = ?, updatedAt = ? WHERE id = ?`).run(todayKey(), nowIso(), Number(user.id || 0));
  return db.prepare(`SELECT * FROM users WHERE id = ? LIMIT 1`).get(Number(user.id || 0)) as AnyRow | undefined;
}
function touchPresence(db: any, userId: number) {
  if (!userId) return;
  db.prepare(`UPDATE user_sessions SET lastSeenAt = CURRENT_TIMESTAMP WHERE userId = ? AND role = 'player' AND revokedAt IS NULL`).run(userId);
}
function getLatestIncomingArrestCase(db: any, userId: number) {
  return mapGuardArrestCase(db.prepare(`SELECT * FROM tower_guard_arrest_cases WHERE targetUserId = ? AND status IN ('pending_review','captured') ORDER BY datetime(COALESCE(updatedAt, createdAt)) DESC, id DESC LIMIT 1`).get(userId) as AnyRow | undefined);
}
function releaseTowerGuardPrisoner(db: any, targetUserId: number, releaseAt: string) {
  db.prepare(`UPDATE tower_guard_prisoners SET isImprisoned = 0, releasedAt = ?, failedAttempts = 0, difficultyLevel = 1, currentGameId = '', currentGameName = '', updatedAt = ? WHERE userId = ?`).run(releaseAt, releaseAt, targetUserId);
}

export function createCharacterRouter(ctx: AppContext) {
  const r = Router();
  const { db, runtime } = ctx;
  ensureParanormalTables(db);

  r.get('/characters/:id/runtime', (req, res) => {
    try {
      const id = Number(req.params.id || 0);
      if (!id) return res.status(400).json({ success: false, message: 'invalid id' });
      const raw = db.prepare(`SELECT * FROM users WHERE id = ? LIMIT 1`).get(id) as AnyRow | undefined;
      if (!raw) return res.status(404).json({ success: false, message: 'user not found' });
      const row = resetDailyCountersIfNeeded(db, raw) || raw;
      res.json({ success: true, user: mapCharacter(row) });
    } catch (e: any) { res.status(500).json({ success: false, message: e?.message || 'runtime query failed' }); }
  });

  r.get('/paranormal/prison/state', (req, res) => {
    try {
      const userId = Number(req.query.userId || 0);
      if (!userId) return res.status(400).json({ success: false, message: 'invalid userId' });
      const user = db.prepare(`SELECT id, status, currentLocation FROM users WHERE id = ? LIMIT 1`).get(userId) as AnyRow | undefined;
      if (!user) return res.status(404).json({ success: false, message: 'user not found' });
      const row = ensurePrisonRow(db, userId);
      res.json({ success: true, prison: prisonPayload(row), canJailByChance: String(user.status || '') === 'ghost' && String(user.currentLocation || '') === PARANORMAL_OFFICE && Number(row.isImprisoned || 0) !== 1 });
    } catch (e: any) { res.status(500).json({ success: false, message: e?.message || 'prison state failed' }); }
  });

  r.post('/paranormal/prison/resolve', (req, res) => {
    try {
      const userId = Number(req.body?.userId || 0);
      const success = Boolean(req.body?.success);
      if (!userId) return res.status(400).json({ success: false, message: 'invalid userId' });
      const row = ensurePrisonRow(db, userId);
      if (Number(row.isImprisoned || 0) !== 1) return res.status(409).json({ success: false, message: '当前并未被收容在灵异监牢中' });
      const ts = nowIso();
      if (!success) {
        const game = pickPrisonGame();
        db.prepare(`UPDATE paranormal_prisoners SET failedAttempts = ?, difficultyLevel = ?, currentGameId = ?, currentGameName = ?, updatedAt = ? WHERE userId = ?`).run(Number(row.failedAttempts || 0) + 1, Math.max(1, Number(row.difficultyLevel || 1) + 1), game.id, game.name, ts, userId);
        const fresh = ensurePrisonRow(db, userId);
        return res.json({ success: true, escaped: false, message: `越狱失败，难度提升至 Lv.${Math.max(1, Number(fresh.difficultyLevel || 1))}`, prison: prisonPayload(fresh) });
      }
      db.prepare(`UPDATE paranormal_prisoners SET isImprisoned = 0, failedAttempts = 0, difficultyLevel = 1, currentGameId = '', currentGameName = '', updatedAt = ? WHERE userId = ?`).run(ts, userId);
      res.json({ success: true, escaped: true, message: '越狱成功，你已恢复自由行动权限。', prison: prisonPayload(ensurePrisonRow(db, userId)) });
    } catch (e: any) { res.status(500).json({ success: false, message: e?.message || 'resolve prison failed' }); }
  });

  r.get('/tower-guard/prison/state', (req, res) => {
    try {
      const userId = Number(req.query.userId || 0);
      if (!userId) return res.status(400).json({ success: false, message: 'invalid userId' });
      const user = db.prepare(`SELECT id FROM users WHERE id = ? LIMIT 1`).get(userId) as AnyRow | undefined;
      if (!user) return res.status(404).json({ success: false, message: 'user not found' });
      res.json({ success: true, prison: guardPrisonPayload(ensureGuardPrisonRow(db, userId)) });
    } catch (e: any) { res.status(500).json({ success: false, message: e?.message || 'guard prison state failed' }); }
  });

  r.post('/tower-guard/prison/resolve', (req, res) => {
    try {
      const userId = Number(req.body?.userId || 0);
      const success = Boolean(req.body?.success);
      if (!userId) return res.status(400).json({ success: false, message: 'invalid userId' });
      const row = ensureGuardPrisonRow(db, userId);
      if (Number(row.isImprisoned || 0) !== 1) return res.status(409).json({ success: false, message: '当前并未被关押在守塔会地下监牢中' });
      const ts = nowIso();
      if (!success) {
        const game = pickPrisonGame();
        db.prepare(`UPDATE tower_guard_prisoners SET failedAttempts = ?, difficultyLevel = ?, currentGameId = ?, currentGameName = ?, updatedAt = ? WHERE userId = ?`).run(Number(row.failedAttempts || 0) + 1, Math.max(1, Number(row.difficultyLevel || 1) + 1), game.id, game.name, ts, userId);
        const fresh = ensureGuardPrisonRow(db, userId);
        return res.json({ success: true, escaped: false, message: `越狱失败，难度提升至 Lv.${Math.max(1, Number(fresh.difficultyLevel || 1))}`, prison: guardPrisonPayload(fresh) });
      }
      releaseTowerGuardPrisoner(db, userId, ts);
      res.json({ success: true, escaped: true, message: '越狱成功，你已恢复自由行动权限。', prison: guardPrisonPayload(ensureGuardPrisonRow(db, userId)) });
    } catch (e: any) { res.status(500).json({ success: false, message: e?.message || 'resolve tower guard prison failed' }); }
  });

  r.get('/tower-guard/prisoners', (_req, res) => {
    try {
      const rows = db.prepare(`SELECT p.userId,p.arrestCaseId,p.captorUserId,p.captorName,p.jailedAt,p.updatedAt,u.name AS targetName,u.role AS targetRole,u.job AS targetJob FROM tower_guard_prisoners p LEFT JOIN users u ON u.id = p.userId WHERE p.isImprisoned = 1 ORDER BY datetime(COALESCE(p.jailedAt, p.updatedAt)) DESC LIMIT 120`).all() as AnyRow[];
      res.json({ success: true, prisoners: rows.map((row) => ({ userId: Number(row.userId || 0), targetName: String(row.targetName || ''), targetRole: String(row.targetRole || ''), targetJob: String(row.targetJob || ''), arrestCaseId: Number(row.arrestCaseId || 0), captorUserId: Number(row.captorUserId || 0), captorName: String(row.captorName || ''), jailedAt: String(row.jailedAt || ''), updatedAt: String(row.updatedAt || '') })) });
    } catch (e: any) { res.status(500).json({ success: false, message: e?.message || 'guard prisoners query failed', prisoners: [] }); }
  });

  r.post('/tower-guard/prison/release', (req, res) => {
    try {
      const userId = Number(req.body?.userId || 0);
      const targetUserId = Number(req.body?.targetUserId || 0);
      if (!userId || !targetUserId) return res.status(400).json({ success: false, message: 'invalid params' });
      const reviewer = db.prepare(`SELECT id, name, job FROM users WHERE id = ? LIMIT 1`).get(userId) as AnyRow | undefined;
      if (!reviewer) return res.status(404).json({ success: false, message: 'reviewer not found' });
      if (!isTowerGuardReviewerJob(reviewer.job)) return res.status(403).json({ success: false, message: '仅守塔会会长或命之塔圣子/圣女可释放在押成员' });
      const row = ensureGuardPrisonRow(db, targetUserId);
      if (Number(row.isImprisoned || 0) !== 1) return res.status(409).json({ success: false, message: '目标当前不在地下监牢中' });
      const ts = nowIso();
      releaseTowerGuardPrisoner(db, targetUserId, ts);
      if (Number(row.arrestCaseId || 0) > 0) db.prepare(`UPDATE tower_guard_arrest_cases SET status = 'released', resultMessage = ?, updatedAt = ? WHERE id = ?`).run(`由 ${String(reviewer.name || '审核员')} 手动释放`, ts, Number(row.arrestCaseId || 0));
      res.json({ success: true, message: '已释放目标成员' });
    } catch (e: any) { res.status(500).json({ success: false, message: e?.message || 'release prisoner failed' }); }
  });

  r.post('/tower-guard/arrest/apply', (req, res) => {
    try {
      const userId = Number(req.body?.userId || 0);
      const targetUserId = Number(req.body?.targetUserId || 0);
      if (!userId || !targetUserId || userId === targetUserId) return res.status(400).json({ success: false, message: 'invalid params' });
      const applicant = db.prepare(`SELECT id, name, job, currentLocation FROM users WHERE id = ? LIMIT 1`).get(userId) as AnyRow | undefined;
      const target = db.prepare(`SELECT id, name, status, currentLocation FROM users WHERE id = ? LIMIT 1`).get(targetUserId) as AnyRow | undefined;
      if (!applicant || !target) return res.status(404).json({ success: false, message: 'user not found' });
      if (!isTowerGuardMemberJob(applicant.job)) return res.status(403).json({ success: false, message: '仅守塔会成员可发起抓捕申请' });
      if (!['approved','ghost'].includes(String(target.status || ''))) return res.status(409).json({ success: false, message: '目标当前状态不允许抓捕' });
      if (String(applicant.currentLocation || '') !== String(target.currentLocation || '')) return res.status(409).json({ success: false, message: '只能对同地图玩家发起抓捕申请' });
      const activeCase = db.prepare(`SELECT id FROM tower_guard_arrest_cases WHERE targetUserId = ? AND status IN ('pending_review','captured') ORDER BY id DESC LIMIT 1`).get(targetUserId) as AnyRow | undefined;
      if (activeCase) return res.status(409).json({ success: false, message: '该目标已有进行中的抓捕流程' });
      const guardPrison = ensureGuardPrisonRow(db, targetUserId);
      if (Number(guardPrison.isImprisoned || 0) === 1) return res.status(409).json({ success: false, message: '该目标已在地下监牢中' });
      const ts = nowIso();
      const result = db.prepare(`INSERT INTO tower_guard_arrest_cases(applicantUserId, applicantName, targetUserId, targetName, reason, status, cancelStatus, resultMessage, createdAt, updatedAt) VALUES(?,?,?,?,?,'pending_review','none','',?,?)`).run(userId, String(applicant.name || ''), targetUserId, String(target.name || ''), String(req.body?.reason || '守塔会发起抓捕申请'), ts, ts);
      const fresh = db.prepare(`SELECT * FROM tower_guard_arrest_cases WHERE id = ? LIMIT 1`).get(Number(result.lastInsertRowid || 0)) as AnyRow | undefined;
      res.json({ success: true, message: '抓捕申请已提交至审批队列', case: mapGuardArrestCase(fresh) });
    } catch (e: any) { res.status(500).json({ success: false, message: e?.message || 'apply arrest failed' }); }
  });

  r.get('/tower-guard/arrest/inbox', (req, res) => {
    try {
      const userId = Number(req.query.userId || 0);
      if (!userId) return res.status(400).json({ success: false, message: 'invalid userId' });
      const user = db.prepare(`SELECT id, job FROM users WHERE id = ? LIMIT 1`).get(userId) as AnyRow | undefined;
      if (!user) return res.status(404).json({ success: false, message: 'user not found' });
      const captureReviewQueue = isTowerGuardReviewerJob(user.job) ? (db.prepare(`SELECT * FROM tower_guard_arrest_cases WHERE status = 'pending_review' ORDER BY datetime(COALESCE(updatedAt, createdAt)) DESC, id DESC LIMIT 100`).all() as AnyRow[]).map(mapGuardArrestCase) : [];
      const cancelReviewQueue = isTowerSaintJob(user.job) ? (db.prepare(`SELECT * FROM tower_guard_arrest_cases WHERE cancelStatus = 'pending' AND status IN ('pending_review','captured') ORDER BY datetime(COALESCE(updatedAt, createdAt)) DESC, id DESC LIMIT 100`).all() as AnyRow[]).map(mapGuardArrestCase) : [];
      const incomingPending = getLatestIncomingArrestCase(db, userId);
      const outgoingRecent = (db.prepare(`SELECT * FROM tower_guard_arrest_cases WHERE applicantUserId = ? ORDER BY datetime(COALESCE(updatedAt, createdAt)) DESC, id DESC LIMIT 12`).all(userId) as AnyRow[]).map(mapGuardArrestCase);
      res.json({ success: true, captureReviewQueue, cancelReviewQueue, incomingPending, outgoingRecent });
    } catch (e: any) { res.status(500).json({ success: false, message: e?.message || 'arrest inbox failed' }); }
  });

  r.post('/tower-guard/arrest/cancel-request', (req, res) => {
    try {
      const userId = Number(req.body?.userId || 0);
      const caseId = Number(req.body?.caseId || 0);
      if (!userId || !caseId) return res.status(400).json({ success: false, message: 'invalid params' });
      const row = db.prepare(`SELECT * FROM tower_guard_arrest_cases WHERE id = ? LIMIT 1`).get(caseId) as AnyRow | undefined;
      if (!row) return res.status(404).json({ success: false, message: 'case not found' });
      if (Number(row.targetUserId || 0) !== userId) return res.status(403).json({ success: false, message: '只有被申请人可提交撤销请求' });
      if (!['pending_review','captured'].includes(String(row.status || ''))) return res.status(409).json({ success: false, message: '当前状态不可提交撤销申请' });
      if (String(row.cancelStatus || 'none') === 'pending') return res.status(409).json({ success: false, message: '撤销申请已在审批中' });
      const ts = nowIso();
      db.prepare(`UPDATE tower_guard_arrest_cases SET cancelRequesterUserId = ?, cancelReason = ?, cancelStatus = 'pending', updatedAt = ? WHERE id = ?`).run(userId, String(req.body?.reason || '被申请人主动提交撤销抓捕申请'), ts, caseId);
      res.json({ success: true, message: '撤销抓捕申请已提交', case: mapGuardArrestCase(db.prepare(`SELECT * FROM tower_guard_arrest_cases WHERE id = ? LIMIT 1`).get(caseId) as AnyRow | undefined) });
    } catch (e: any) { res.status(500).json({ success: false, message: e?.message || 'cancel arrest request failed' }); }
  });

  r.post('/tower-guard/arrest/review', (req, res) => {
    try {
      const userId = Number(req.body?.userId || 0);
      const caseId = Number(req.body?.caseId || 0);
      const action = String(req.body?.action || '').trim();
      if (!userId || !caseId || !['approve','reject'].includes(action)) return res.status(400).json({ success: false, message: 'invalid params' });
      const reviewer = db.prepare(`SELECT id, name, job FROM users WHERE id = ? LIMIT 1`).get(userId) as AnyRow | undefined;
      if (!reviewer) return res.status(404).json({ success: false, message: 'reviewer not found' });
      if (!isTowerGuardReviewerJob(reviewer.job)) return res.status(403).json({ success: false, message: '当前职位无权审批抓捕' });
      const row = db.prepare(`SELECT * FROM tower_guard_arrest_cases WHERE id = ? LIMIT 1`).get(caseId) as AnyRow | undefined;
      if (!row) return res.status(404).json({ success: false, message: 'case not found' });
      if (String(row.status || '') !== 'pending_review') return res.status(409).json({ success: false, message: '该抓捕申请已被处理' });
      const ts = nowIso();
      if (action === 'reject') {
        db.prepare(`UPDATE tower_guard_arrest_cases SET status = 'rejected', reviewerUserId = ?, reviewerName = ?, reviewedAt = ?, resultMessage = ?, updatedAt = ? WHERE id = ?`).run(userId, String(reviewer.name || ''), ts, '抓捕审批未通过', ts, caseId);
        return res.json({ success: true, message: '已驳回抓捕申请', case: mapGuardArrestCase(db.prepare(`SELECT * FROM tower_guard_arrest_cases WHERE id = ? LIMIT 1`).get(caseId) as AnyRow | undefined) });
      }
      db.prepare(`UPDATE tower_guard_arrest_cases SET status = 'captured', reviewerUserId = ?, reviewerName = ?, reviewedAt = ?, resultMessage = ?, updatedAt = ? WHERE id = ?`).run(userId, String(reviewer.name || ''), ts, '抓捕审批通过，目标已被送入地下监牢', ts, caseId);
      db.prepare(`UPDATE tower_guard_prisoners SET isImprisoned = 1, arrestCaseId = ?, captorUserId = ?, captorName = ?, jailedAt = ?, releasedAt = '', failedAttempts = 0, difficultyLevel = 1, currentGameId = ?, currentGameName = ?, updatedAt = ? WHERE userId = ?`).run(caseId, Number(row.applicantUserId || 0), String(row.applicantName || ''), ts, 'cipher_shift', '位移密码', ts, Number(row.targetUserId || 0));
      res.json({ success: true, message: '抓捕审批已通过，目标已入狱', case: mapGuardArrestCase(db.prepare(`SELECT * FROM tower_guard_arrest_cases WHERE id = ? LIMIT 1`).get(caseId) as AnyRow | undefined) });
    } catch (e: any) { res.status(500).json({ success: false, message: e?.message || 'review arrest failed' }); }
  });

  r.post('/tower-guard/arrest/cancel-review', (req, res) => {
    try {
      const userId = Number(req.body?.userId || 0);
      const caseId = Number(req.body?.caseId || 0);
      const action = String(req.body?.action || '').trim();
      if (!userId || !caseId || !['approve','reject'].includes(action)) return res.status(400).json({ success: false, message: 'invalid params' });
      const reviewer = db.prepare(`SELECT id, name, job FROM users WHERE id = ? LIMIT 1`).get(userId) as AnyRow | undefined;
      if (!reviewer) return res.status(404).json({ success: false, message: 'reviewer not found' });
      if (!isTowerSaintJob(reviewer.job)) return res.status(403).json({ success: false, message: '仅命之塔圣子或圣女可审批撤销抓捕申请' });
      const row = db.prepare(`SELECT * FROM tower_guard_arrest_cases WHERE id = ? LIMIT 1`).get(caseId) as AnyRow | undefined;
      if (!row) return res.status(404).json({ success: false, message: 'case not found' });
      if (String(row.cancelStatus || '') !== 'pending') return res.status(409).json({ success: false, message: '当前没有待审批的撤销请求' });
      const ts = nowIso();
      if (action === 'reject') {
        db.prepare(`UPDATE tower_guard_arrest_cases SET cancelReviewerUserId = ?, cancelReviewerName = ?, cancelReviewedAt = ?, cancelStatus = 'rejected', resultMessage = ?, updatedAt = ? WHERE id = ?`).run(userId, String(reviewer.name || ''), ts, '撤销抓捕申请已驳回', ts, caseId);
        return res.json({ success: true, message: '已驳回撤销抓捕申请', case: mapGuardArrestCase(db.prepare(`SELECT * FROM tower_guard_arrest_cases WHERE id = ? LIMIT 1`).get(caseId) as AnyRow | undefined) });
      }
      db.prepare(`UPDATE tower_guard_arrest_cases SET status = 'cancelled', cancelReviewerUserId = ?, cancelReviewerName = ?, cancelReviewedAt = ?, cancelStatus = 'approved', resultMessage = ?, updatedAt = ? WHERE id = ?`).run(userId, String(reviewer.name || ''), ts, '撤销抓捕申请已通过', ts, caseId);
      if (String(row.status || '') === 'captured') releaseTowerGuardPrisoner(db, Number(row.targetUserId || 0), ts);
      res.json({ success: true, message: '已批准撤销抓捕申请', case: mapGuardArrestCase(db.prepare(`SELECT * FROM tower_guard_arrest_cases WHERE id = ? LIMIT 1`).get(caseId) as AnyRow | undefined) });
    } catch (e: any) { res.status(500).json({ success: false, message: e?.message || 'review arrest cancel failed' }); }
  });

  const handleLocationUpdate = (req: any, res: any) => {
    try {
      const id = Number(req.params.id || 0);
      const locationId = String(req.body?.locationId || '').trim();
      if (!id || !locationId) return res.status(400).json({ success: false, message: 'id/locationId required' });
      const row = db.prepare(`SELECT id,name,age,role,status,fury,guideStability,partyId,currentLocation,job FROM users WHERE id = ? LIMIT 1`).get(id) as AnyRow | undefined;
      if (!row) return res.status(404).json({ success: false, message: 'user not found' });
      const role = String(row.role || '').trim();
      const isSentinel = role === '哨兵' || role.toLowerCase() === 'sentinel';
      const isGuide = role === '向导' || role.toLowerCase() === 'guide';
      const customFaction = db.prepare(`SELECT id, pointType FROM custom_factions WHERE id = ? LIMIT 1`).get(locationId) as AnyRow | undefined;
      const isSafeLocation = SAFE_ZONES.has(locationId) || String(customFaction?.pointType || 'safe') === 'safe';
      const hasActiveJob = !!String(row.job || '').trim() && String(row.job || '').trim() !== '\u65e0';
      if (Number(row.age ?? 0) < 16 && !isSafeLocation && !hasActiveJob) {
        const partyId = String(row.partyId || '').trim();
        const hasGuideEscort = partyId ? (db.prepare(`SELECT id, role FROM users WHERE partyId = ?`).all(partyId) as AnyRow[]).some((m) => Number(m.id) !== id && isGuideRole(m.role)) : false;
        if (!Boolean(req.body?.minorRiskConfirmed) && !hasGuideEscort) return res.status(403).json({ success: false, code: 'MINOR_RISK_CONFIRM_REQUIRED', message: 'undifferentiated players need risk confirmation or guide escort for unsafe areas' });
      }
      if (locationId !== 'sanctuary' && isSentinel && Number(row.fury ?? 0) >= 80) return res.status(403).json({ success: false, code: 'FURY_LOCK', message: 'sentinel fury is too high; go to sanctuary first' });
      if (locationId !== 'sanctuary' && isGuide && Number(row.guideStability ?? 100) <= 20) return res.status(403).json({ success: false, code: 'STABILITY_LOCK', message: 'guide stability is too low; go to sanctuary first' });
      const fromLocation = String(row.currentLocation || '').trim();
      const prisonRow = ensurePrisonRow(db, id);
      if (Number(prisonRow.isImprisoned || 0) === 1 && locationId !== PARANORMAL_OFFICE) return res.status(403).json({ success: false, code: 'GHOST_PRISON_LOCKED', message: '你被收容在灵异监牢中，当前无法离开。' });
      const guardPrisonRow = ensureGuardPrisonRow(db, id);
      if (Number(guardPrisonRow.isImprisoned || 0) === 1 && locationId !== TOWER_GUARD_LOCATION) return res.status(403).json({ success: false, code: 'TOWER_GUARD_PRISON_LOCKED', message: '你被关押在守塔会地下监牢中，当前无法离开。' });
      if (fromLocation === 'tower_of_life' && locationId !== 'tower_of_life' && !customFaction && !new Set(['sanctuary','london_tower','slums','rich_area','guild','army']).has(locationId)) return res.status(403).json({ success: false, code: 'TOWER_ADJACENT_ONLY', message: '你无法一下子走得那么远' });
      db.prepare(`UPDATE users SET currentLocation = ?, updatedAt = ? WHERE id = ?`).run(locationId, nowIso(), id);
      touchPresence(db, id);
      const presenceSnapshot = loadPresenceByUserId(db, id);
      if (presenceSnapshot) {
        void runtime.upsertPresence(presenceSnapshot);
      } else {
        void runtime.touchPresence(id);
      }
      void runtime.publishBroadcast('presence.changed', { userId: id, locationId, fromLocation, currentLocation: locationId });
      void runtime.publishUser(id, 'user.updated', { userId: id, fields: ['currentLocation'], currentLocation: locationId, fromLocation });
      let prisonTrigger: null | { gameId: string; gameName: string } = null;
      if (String(row.status || '') === 'ghost' && locationId === PARANORMAL_OFFICE && fromLocation !== PARANORMAL_OFFICE && Number(prisonRow.isImprisoned || 0) !== 1 && Math.random() < GHOST_PRISON_CHANCE) {
        const game = pickPrisonGame();
        db.prepare(`UPDATE paranormal_prisoners SET isImprisoned = 1, currentGameId = ?, currentGameName = ?, jailedAt = ?, lastCheckInAt = ?, updatedAt = ? WHERE userId = ?`).run(game.id, game.name, nowIso(), nowIso(), nowIso(), id);
        prisonTrigger = { gameId: game.id, gameName: game.name };
      }
      try {
        const partyId = String(row.partyId || '').trim();
        if (partyId) {
          const others = db.prepare(`SELECT id FROM users WHERE partyId = ? AND id <> ?`).all(partyId, id) as AnyRow[];
          const ins = db.prepare(`INSERT INTO party_requests(batchKey,requestType,partyId,fromUserId,toUserId,targetUserId,payloadJson,status,resultMessage,createdAt,updatedAt) VALUES(?,?,?,?,?,?,?,?,?,?,?)`);
          const ts = nowIso();
          for (const m of others) {
            const toId = Number(m.id || 0); if (!toId) continue;
            try { db.prepare(`UPDATE party_requests SET status = 'cancelled', resultMessage = ?, updatedAt = ? WHERE requestType = 'follow' AND fromUserId = ? AND toUserId = ? AND partyId = ? AND status = 'pending'`).run('移动更新为新目标地点', ts, id, toId, partyId); } catch {}
            try { ins.run(`follow-${Date.now()}-${id}-${toId}`,'follow',partyId,id,toId,0,JSON.stringify({ locationId, fromUserName: String(row.name || '') }),'pending','',ts,ts); } catch {}
          }
        }
      } catch {}
      try { db.prepare(`UPDATE party_entanglements SET updatedAt = ? WHERE active = 1 AND (userAId = ? OR userBId = ?)`).run(nowIso(), id, id); } catch {}
      res.json({ success: true, locationId, prison: prisonPayload(ensurePrisonRow(db, id)), guardPrison: guardPrisonPayload(ensureGuardPrisonRow(db, id)), prisonTriggered: !!prisonTrigger, prisonGame: prisonTrigger });
    } catch (e: any) { res.status(500).json({ success: false, message: e?.message || 'location update failed' }); }
  };

  r.post('/characters/:id/location', handleLocationUpdate);
  r.get('/locations/:locationId/players', async (req, res) => {
    try {
      const locationId = String(req.params.locationId || '').trim();
      const excludeId = Number(req.query.excludeId || 0);
      if (!locationId) return res.json({ success: true, players: [] });
      if (excludeId) touchPresence(db, excludeId);

      const merged = new Map<number, AnyRow>();
      for (const row of filterPresenceByLocation(loadOnlinePresenceFallback(db, ONLINE_WINDOW_SECONDS), locationId, excludeId)) {
        merged.set(Number(row.id || 0), row as AnyRow);
      }
      for (const row of await runtime.getLocationPresence(locationId, excludeId)) {
        merged.set(Number(row.id || 0), row as AnyRow);
      }

      res.json({ success: true, players: Array.from(merged.values()) });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e?.message || 'players query failed', players: [] });
    }
  });
  r.post('/presence/heartbeat', async (req, res) => {
    try {
      const userId = Number(req.body?.userId || 0);
      if (!userId) return res.status(400).json({ success: false, message: 'invalid userId' });
      touchPresence(db, userId);
      const snapshot = loadPresenceByUserId(db, userId);
      if (snapshot) {
        await runtime.upsertPresence(snapshot);
      } else {
        await runtime.touchPresence(userId);
      }
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e?.message || 'heartbeat failed' });
    }
  });
  r.post('/users/:id/location', handleLocationUpdate);
  return r;
}

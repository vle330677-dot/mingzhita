import fs from 'fs';
import path from 'path';
import { Router } from 'express';
import { AppContext } from '../types';
import { nowIso, resolveInitialHome } from '../utils/common';
import {
  BUILTIN_LOCATION_MAP,
  CUSTOM_ROLE_ENABLED_LOCATIONS,
  GUARD_CHIEF_JOB,
  TOWER_GOVERNOR_JOBS,
  calcQuitPenalty,
  canManageCustomRoles,
  canManageFactionRoster,
  compareRank,
  inferFactionName,
  isCustomFactionLocationId,
  isLondonTowerStudentJob,
  isMinor,
  isNoJob,
  isSchoolLocation,
  isStudentAge,
  lowestJobForFaction,
  resolveBuiltinFactionByJob,
  resolveHomeByJob,
} from '../utils/factions';

type AnyRow = Record<string, any>;
const CUSTOM_FACTION_COST = 50000;
const DEFAULT_CUSTOM_FACTION_SALARY = 12000;
const DEFAULT_CUSTOM_MEMBER_TITLE = '成员';

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function todayKey() {
  return nowIso().slice(0, 10);
}

function buildCustomFactionId(name: string) {
  const slug = String(name || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 24) || 'faction';
  return `custom_faction_${slug}_${Date.now().toString(36)}`;
}

function buildNodeId(factionId: string) {
  return `${factionId}_node_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function getFactionAssets() {
  try {
    const base = path.resolve(process.cwd(), 'public', 'new');
    if (!fs.existsSync(base)) return [];
    return fs
      .readdirSync(base)
      .filter((name) => /\.(png|jpe?g|webp|gif|svg)$/i.test(name))
      .map((name) => ({ name, url: `/new/${name}` }));
  } catch {
    return [];
  }
}

function loadUserName(db: any, id: number | null | undefined) {
  if (!id) return '';
  const row = db.prepare(`SELECT name FROM users WHERE id = ? LIMIT 1`).get(id) as AnyRow | undefined;
  return String(row?.name || '');
}

function ensureDelegationTable(db: any) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS tower_school_delegation (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      status TEXT DEFAULT 'none',
      requestedByUserId INTEGER,
      reviewedByUserId INTEGER,
      requestedAt TEXT,
      reviewedAt TEXT,
      updatedAt TEXT
    );
  `);
  db.prepare(`
    INSERT OR IGNORE INTO tower_school_delegation (id, status, updatedAt)
    VALUES (1, 'none', ?)
  `).run(nowIso());
}

function getDelegationRow(db: any) {
  return db.prepare(`
    SELECT id, status, requestedByUserId, reviewedByUserId, requestedAt, reviewedAt, updatedAt
    FROM tower_school_delegation
    WHERE id = 1
    LIMIT 1
  `).get() as AnyRow | undefined;
}

function isDelegationActive(db: any) {
  return String(getDelegationRow(db)?.status || '') === 'approved';
}

function getCustomFactionById(db: any, factionId: string) {
  return db.prepare(`SELECT * FROM custom_factions WHERE id = ? LIMIT 1`).get(factionId) as AnyRow | undefined;
}

function getCustomFactionByName(db: any, name: string) {
  return db.prepare(`SELECT * FROM custom_factions WHERE name = ? LIMIT 1`).get(String(name || '').trim()) as AnyRow | undefined;
}

function getActiveCustomRoles(db: any, locationId: string) {
  return db.prepare(`
    SELECT id, locationId, factionName, title, description, minAge, minMentalRank, minPhysicalRank, maxMembers, salary, createdByUserId, isActive, createdAt, updatedAt
    FROM faction_custom_roles
    WHERE locationId = ? AND isActive = 1
    ORDER BY id ASC
  `).all(locationId) as AnyRow[];
}

function getCustomRoleByTitle(db: any, locationId: string, title: string) {
  return db.prepare(`
    SELECT id, locationId, factionName, title, description, minAge, minMentalRank, minPhysicalRank, maxMembers, salary, createdByUserId, isActive, createdAt, updatedAt
    FROM faction_custom_roles
    WHERE locationId = ? AND title = ? AND isActive = 1
    LIMIT 1
  `).get(locationId, title) as AnyRow | undefined;
}

function countRoleMembers(db: any, factionName: string, title: string) {
  const row = db.prepare(`
    SELECT COUNT(*) AS cnt
    FROM users
    WHERE status IN ('approved', 'ghost')
      AND faction = ?
      AND job = ?
  `).get(factionName, title) as AnyRow | undefined;
  return Number(row?.cnt || 0);
}

function findCustomRoleByUser(db: any, user: AnyRow | undefined | null) {
  const factionName = String(user?.faction || '').trim();
  const job = String(user?.job || '').trim();
  if (!factionName || !job || isNoJob(job)) return null;
  const customFaction = getCustomFactionByName(db, factionName);
  if (!customFaction) return null;
  if (job === String(customFaction.leaderTitle || '掌权者')) {
    return {
      role: null,
      customFaction,
      salary: DEFAULT_CUSTOM_FACTION_SALARY,
    };
  }
  const role = getCustomRoleByTitle(db, String(customFaction.id || ''), job);
  if (!role) return null;
  return {
    role,
    customFaction,
    salary: Math.max(0, Number(role.salary || 0)),
  };
}

function calcQuitPenaltyForUser(db: any, user: AnyRow) {
  const builtinPenalty = calcQuitPenalty(String(user?.job || ''));
  if (builtinPenalty > 0) return builtinPenalty;

  const customRoleState = findCustomRoleByUser(db, user);
  if (!customRoleState) return 0;
  const salary = Math.max(1000, Number(customRoleState.salary || DEFAULT_CUSTOM_FACTION_SALARY));
  return Math.max(100, Math.round(salary * 0.1));
}

function customRolePayload(db: any, role: AnyRow) {
  return {
    id: Number(role.id || 0),
    title: String(role.title || ''),
    description: String(role.description || ''),
    minAge: Math.max(0, Number(role.minAge || 0)),
    minMentalRank: String(role.minMentalRank || ''),
    minPhysicalRank: String(role.minPhysicalRank || ''),
    maxMembers: Math.max(0, Number(role.maxMembers || 0)),
    salary: Math.max(0, Number(role.salary || 0)),
    currentMembers: countRoleMembers(db, String(role.factionName || ''), String(role.title || '')),
  };
}

export function createFactionRouter(ctx: AppContext) {
  const r = Router();
  const { db } = ctx;

  ensureDelegationTable(db);

  r.post('/tower/join', (req, res) => {
    try {
      const userId = Number(req.body?.userId || 0);
      const rawJob = String(req.body?.jobName || '').trim();
      const locationId = String(req.body?.locationId || '').trim();
      const minorConfirm = Boolean(req.body?.minorConfirm ?? false);

      if (!userId || !rawJob) {
        return res.status(400).json({ success: false, message: '缺少 userId 或职位名称' });
      }

      const user = db.prepare(`
        SELECT id, name, age, role, job, faction, gold, mentalRank, physicalRank, homeLocation, currentLocation
        FROM users
        WHERE id = ?
        LIMIT 1
      `).get(userId) as AnyRow | undefined;
      if (!user) return res.status(404).json({ success: false, message: '未找到该玩家' });

      let jobName = rawJob;
      let targetFactionName = '';
      let targetLocationId = locationId;
      const customFaction = isCustomFactionLocationId(locationId) ? getCustomFactionById(db, locationId) : undefined;
      const customRole = locationId ? getCustomRoleByTitle(db, locationId, rawJob) : undefined;
      let builtinMeta = resolveBuiltinFactionByJob(jobName);

      if (customRole) {
        targetFactionName = String(customRole.factionName || '').trim();
        targetLocationId = String(customRole.locationId || locationId);
      } else if (customFaction) {
        targetFactionName = String(customFaction.name || '').trim();
        targetLocationId = String(customFaction.id || locationId);
        if (jobName === String(customFaction.leaderTitle || '掌权者') && Number(customFaction.ownerUserId || 0) !== userId) {
          return res.status(403).json({ success: false, message: '只有创建者本人才能担任该自定义势力的最高位。' });
        }
      } else if (builtinMeta) {
        targetFactionName = String(builtinMeta.name || '').trim();
        targetLocationId = String(builtinMeta.locationId || locationId);
      }

      if (builtinMeta && isMinor(Number(user.age || 0))) {
        const allowMinorJoin = builtinMeta.locationId === 'sanctuary' && rawJob === '圣所幼崽';
        if (!allowMinorJoin) {
          return res.status(403).json({ success: false, code: 'MINOR_UNDIFFERENTIATED_BLOCK', message: '16 岁以下角色无法加入该阵营。' });
        }
      }

      const studentRole = isLondonTowerStudentJob(jobName);
      if (!customRole && builtinMeta && isStudentAge(Number(user.age || 0)) && !studentRole) {
        if (!minorConfirm) {
          return res.status(409).json({
            success: false,
            code: 'MINOR_CONFIRM_REQUIRED',
            message: '你还没有毕业，若坚持加入其他阵营，将自动降为该阵营最低职位。',
            suggestedJob: '伦敦塔学员',
            lowestJob: lowestJobForFaction(jobName),
          });
        }
        jobName = lowestJobForFaction(jobName);
        builtinMeta = resolveBuiltinFactionByJob(jobName);
        targetFactionName = String(builtinMeta?.name || targetFactionName || '');
        targetLocationId = String(builtinMeta?.locationId || targetLocationId || '');
      }

      if (!customRole && !customFaction && !builtinMeta) {
        return res.status(400).json({ success: false, message: '未识别的职位，无法加入。' });
      }

      const currentFaction = inferFactionName(user);
      if (currentFaction && targetFactionName && currentFaction !== targetFactionName) {
        return res.status(409).json({
          success: false,
          code: 'FACTION_LOCKED',
          message: `你当前已属于【${currentFaction}】，请先退出原阵营。`,
        });
      }

      if (customRole) {
        const minAge = Math.max(0, Number(customRole.minAge || 0));
        if (minAge > 0 && Number(user.age || 0) < minAge) {
          return res.status(403).json({ success: false, message: `该职位要求年龄不低于 ${minAge} 岁。` });
        }
        if (!compareRank(String(user.mentalRank || ''), String(customRole.minMentalRank || ''))) {
          return res.status(403).json({ success: false, message: `该职位要求精神等级不低于 ${customRole.minMentalRank}。` });
        }
        if (!compareRank(String(user.physicalRank || ''), String(customRole.minPhysicalRank || ''))) {
          return res.status(403).json({ success: false, message: `该职位要求肉体等级不低于 ${customRole.minPhysicalRank}。` });
        }
        const maxMembers = Math.max(0, Number(customRole.maxMembers || 0));
        if (maxMembers > 0) {
          const currentMembers = countRoleMembers(db, targetFactionName, String(customRole.title || ''));
          const alreadyInRole = String(user.job || '').trim() === String(customRole.title || '').trim();
          if (!alreadyInRole && currentMembers >= maxMembers) {
            return res.status(409).json({ success: false, message: '该职位名额已满。' });
          }
        }
        jobName = String(customRole.title || rawJob);
      } else if (customFaction) {
        jobName = String(customFaction.leaderTitle || '掌权者');
      } else if (builtinMeta) {
        const uniqueJobs = new Set(Array.isArray(builtinMeta.uniqueJobs) ? builtinMeta.uniqueJobs : []);
        if (uniqueJobs.has(jobName)) {
          const holder = db.prepare(`
            SELECT id, name
            FROM users
            WHERE status IN ('approved', 'ghost')
              AND faction = ?
              AND job = ?
              AND id <> ?
            LIMIT 1
          `).get(targetFactionName, jobName, userId) as AnyRow | undefined;
          if (holder) {
            return res.status(409).json({
              success: false,
              code: 'JOB_OCCUPIED',
              message: `${jobName} 已有人担任。`,
            });
          }
        }
      }

      let nextHome = resolveHomeByJob(jobName);
      if (!nextHome) {
        if (String(user.role || '') === '未分化' || Number(user.age || 0) < 16) {
          nextHome = 'sanctuary';
        } else {
          const oldHome = String(user.homeLocation || '');
          if (oldHome === 'sanctuary' || oldHome === 'slums' || oldHome === 'rich_area') {
            nextHome = oldHome as any;
          } else {
            nextHome = resolveInitialHome(Number(user.age || 18), Number(user.gold || 0), String(user.role || '')) as any;
          }
        }
      }

      db.prepare(`
        UPDATE users
        SET job = ?, faction = ?, homeLocation = ?, updatedAt = ?
        WHERE id = ?
      `).run(jobName, targetFactionName || '无', nextHome, nowIso(), userId);

      return res.json({
        success: true,
        message: `已加入职位：${jobName}`,
        data: {
          userId,
          jobName,
          faction: targetFactionName || '无',
          locationId: targetLocationId || '',
          homeLocation: nextHome,
        },
      });
    } catch (error: any) {
      console.error('[faction/tower/join] failed:', error);
      return res.status(500).json({ success: false, message: error?.message || '加入职位失败' });
    }
  });

  r.post('/tower/quit', (req, res) => {
    try {
      const userId = Number(req.body?.userId || 0);
      if (!userId) return res.status(400).json({ success: false, message: '缺少 userId' });

      const noPenalty = Boolean(req.body?.noPenalty);
      const user = db.prepare(`SELECT id, job, faction, gold FROM users WHERE id = ? LIMIT 1`).get(userId) as AnyRow | undefined;
      if (!user) return res.status(404).json({ success: false, message: '未找到该玩家' });

      const currentJob = String(user.job || '').trim();
      const currentFaction = inferFactionName(user);
      if (isNoJob(currentJob)) {
        if (currentFaction) {
          db.prepare(`UPDATE users SET faction = '无', updatedAt = ? WHERE id = ?`).run(nowIso(), userId);
        }
        return res.json({ success: true, penalty: 0, message: '当前没有可退出的职位。' });
      }

      const penalty = noPenalty ? 0 : calcQuitPenaltyForUser(db, user);
      const currentGold = Math.max(0, Number(user.gold || 0));
      if (penalty > 0 && currentGold < penalty) {
        return res.status(409).json({
          success: false,
          code: 'QUIT_GOLD_LACK',
          message: `退出该职位需要支付 ${penalty}G，当前金币不足。`,
        });
      }

      db.prepare(`
        UPDATE users
        SET job = '无', faction = '无', gold = ?, updatedAt = ?
        WHERE id = ?
      `).run(Math.max(0, currentGold - penalty), nowIso(), userId);

      return res.json({
        success: true,
        penalty,
        message: penalty > 0 ? `已退出【${currentFaction || currentJob}】，扣除 ${penalty}G。` : `已退出【${currentFaction || currentJob}】。`,
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error?.message || '退出职位失败' });
    }
  });

  r.get('/faction/delegation/status', (req, res) => {
    try {
      const userId = Number(req.query.userId || 0);
      let canApply = false;
      let canReview = false;

      if (userId) {
        const me = db.prepare(`SELECT id, job FROM users WHERE id = ? LIMIT 1`).get(userId) as AnyRow | undefined;
        if (me) {
          const myJob = String(me.job || '').trim();
          canApply = myJob === GUARD_CHIEF_JOB;
          canReview = TOWER_GOVERNOR_JOBS.has(myJob);
        }
      }

      const row = getDelegationRow(db);
      const status = String(row?.status || 'none');
      return res.json({
        success: true,
        canApply,
        canReview,
        delegation: {
          status,
          active: status === 'approved',
          requestedByUserId: Number(row?.requestedByUserId || 0) || null,
          requestedByName: loadUserName(db, Number(row?.requestedByUserId || 0) || null),
          reviewedByUserId: Number(row?.reviewedByUserId || 0) || null,
          reviewedByName: loadUserName(db, Number(row?.reviewedByUserId || 0) || null),
          requestedAt: String(row?.requestedAt || ''),
          reviewedAt: String(row?.reviewedAt || ''),
          updatedAt: String(row?.updatedAt || ''),
        },
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error?.message || '读取授权状态失败' });
    }
  });

  r.post('/faction/delegation/request', (req, res) => {
    try {
      const userId = Number(req.body?.userId || 0);
      if (!userId) return res.status(400).json({ success: false, message: '缺少 userId' });

      const user = db.prepare(`SELECT id, name, job FROM users WHERE id = ? LIMIT 1`).get(userId) as AnyRow | undefined;
      if (!user) return res.status(404).json({ success: false, message: '未找到该玩家' });
      if (String(user.job || '').trim() !== GUARD_CHIEF_JOB) {
        return res.status(403).json({ success: false, message: '只有守塔会会长可以发起三塔接管申请。' });
      }

      const row = getDelegationRow(db);
      const status = String(row?.status || 'none');
      if (status === 'pending') {
        return res.status(409).json({ success: false, message: '当前已有待审批的接管申请。' });
      }
      if (status === 'approved') {
        return res.status(409).json({ success: false, message: '守塔会当前已拥有三塔接管授权。' });
      }

      const ts = nowIso();
      db.prepare(`
        UPDATE tower_school_delegation
        SET status = 'pending',
            requestedByUserId = ?,
            reviewedByUserId = NULL,
            requestedAt = ?,
            reviewedAt = NULL,
            updatedAt = ?
        WHERE id = 1
      `).run(userId, ts, ts);

      return res.json({ success: true, message: '已提交三塔接管申请，等待圣子或圣女审批。' });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error?.message || '提交授权申请失败' });
    }
  });

  r.post('/faction/delegation/review', (req, res) => {
    try {
      const reviewerId = Number(req.body?.reviewerId || 0);
      const action = String(req.body?.action || '').trim();
      if (!reviewerId || !['approve', 'reject', 'revoke'].includes(action)) {
        return res.status(400).json({ success: false, message: '参数无效' });
      }

      const reviewer = db.prepare(`SELECT id, name, job FROM users WHERE id = ? LIMIT 1`).get(reviewerId) as AnyRow | undefined;
      if (!reviewer) return res.status(404).json({ success: false, message: '未找到该玩家' });
      if (!TOWER_GOVERNOR_JOBS.has(String(reviewer.job || '').trim())) {
        return res.status(403).json({ success: false, message: '只有圣子或圣女可以审批三塔授权。' });
      }

      const row = getDelegationRow(db);
      const status = String(row?.status || 'none');
      if ((action === 'approve' || action === 'reject') && status !== 'pending') {
        return res.status(409).json({ success: false, message: '当前没有待审批的授权申请。' });
      }
      if (action === 'revoke' && status !== 'approved') {
        return res.status(409).json({ success: false, message: '当前没有生效中的守塔会授权。' });
      }

      const nextStatus = action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : 'revoked';
      const ts = nowIso();
      db.prepare(`
        UPDATE tower_school_delegation
        SET status = ?,
            reviewedByUserId = ?,
            reviewedAt = ?,
            updatedAt = ?
        WHERE id = 1
      `).run(nextStatus, reviewerId, ts, ts);

      const messageMap: Record<string, string> = {
        approve: '已批准守塔会接管三塔管理。',
        reject: '已驳回守塔会的接管申请。',
        revoke: '已收回守塔会的三塔管理授权。',
      };
      return res.json({ success: true, message: messageMap[action] || '操作完成' });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error?.message || '审批授权失败' });
    }
  });
  r.get('/faction/roster', (req, res) => {
    try {
      const userId = Number(req.query.userId || 0);
      const locationId = String(req.query.locationId || '').trim();
      if (!userId || !locationId) {
        return res.status(400).json({ success: false, message: '缺少 userId 或 locationId' });
      }

      const requester = db.prepare(`SELECT id, name, job, faction, status FROM users WHERE id = ? LIMIT 1`).get(userId) as AnyRow | undefined;
      if (!requester) return res.status(404).json({ success: false, message: '未找到该玩家' });

      if (isCustomFactionLocationId(locationId)) {
        const customFaction = getCustomFactionById(db, locationId);
        if (!customFaction) {
          return res.status(404).json({ success: false, message: '未找到该自定义势力' });
        }

        const members = (db.prepare(`
          SELECT id, name, job, faction, currentLocation
          FROM users
          WHERE status IN ('approved', 'ghost')
            AND faction = ?
          ORDER BY id DESC
        `).all(String(customFaction.name || '')) as AnyRow[]).map((row) => ({
          id: Number(row.id || 0),
          name: String(row.name || ''),
          job: String(row.job || '无'),
          faction: String(row.faction || ''),
          currentLocation: String(row.currentLocation || ''),
        }));

        return res.json({
          success: true,
          factionName: String(customFaction.name || ''),
          leaderJob: String(customFaction.leaderTitle || '掌权者'),
          kickEnabled: true,
          canManage: Number(customFaction.ownerUserId || 0) === userId,
          canManageRoles: Number(customFaction.ownerUserId || 0) === userId,
          customRoles: getActiveCustomRoles(db, locationId).map((role) => customRolePayload(db, role)),
          members,
        });
      }

      const meta = BUILTIN_LOCATION_MAP.get(locationId);
      if (!meta) {
        return res.json({
          success: true,
          factionName: '',
          leaderJob: '',
          kickEnabled: false,
          canManage: false,
          canManageRoles: false,
          customRoles: [],
          members: [],
        });
      }

      const roleRows = getActiveCustomRoles(db, locationId);
      const delegationActive = isDelegationActive(db);
      const canManage = canManageFactionRoster(String(requester.job || ''), locationId, Boolean(meta.kickEnabled), delegationActive);
      const canManageRolesFlag = canManageCustomRoles(String(requester.job || ''), locationId);
      const titles = [...meta.jobs, ...roleRows.map((row) => String(row.title || '').trim()).filter(Boolean)];
      const placeholders = titles.map(() => '?').join(',');
      const rows = db.prepare(`
        SELECT id, name, job, faction, currentLocation
        FROM users
        WHERE status IN ('approved', 'ghost')
          AND (
            faction = ?
            OR job IN (${placeholders || "''"})
          )
        ORDER BY id DESC
      `).all(meta.name, ...titles) as AnyRow[];

      const uniq = new Map<number, AnyRow>();
      for (const row of rows) uniq.set(Number(row.id || 0), row);
      const members = Array.from(uniq.values()).map((row) => ({
        id: Number(row.id || 0),
        name: String(row.name || ''),
        job: String(row.job || '无'),
        faction: String(row.faction || meta.name),
        currentLocation: String(row.currentLocation || ''),
      }));

      return res.json({
        success: true,
        factionName: meta.name,
        leaderJob: isSchoolLocation(meta.locationId)
          ? delegationActive
            ? '圣子 / 圣女（当前授权守塔会会长可代管）'
            : meta.leaderJob
          : meta.leaderJob,
        kickEnabled: meta.kickEnabled,
        canManage,
        canManageRoles: canManageRolesFlag,
        delegationActive,
        customRoles: roleRows.map((role) => customRolePayload(db, role)),
        members,
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error?.message || '读取成员信息失败', members: [] });
    }
  });

  r.post('/faction/kick', (req, res) => {
    try {
      const operatorId = Number(req.body?.operatorId || 0);
      const targetUserId = Number(req.body?.targetUserId || 0);
      const locationId = String(req.body?.locationId || '').trim();
      if (!operatorId || !targetUserId || !locationId) {
        return res.status(400).json({ success: false, message: '参数不完整' });
      }
      if (operatorId === targetUserId) {
        return res.status(400).json({ success: false, message: '不能辞退自己。' });
      }

      const operator = db.prepare(`SELECT id, name, job, faction FROM users WHERE id = ? LIMIT 1`).get(operatorId) as AnyRow | undefined;
      const target = db.prepare(`SELECT id, name, job, faction FROM users WHERE id = ? LIMIT 1`).get(targetUserId) as AnyRow | undefined;
      if (!operator || !target) return res.status(404).json({ success: false, message: '未找到目标玩家' });

      if (isCustomFactionLocationId(locationId)) {
        const customFaction = getCustomFactionById(db, locationId);
        if (!customFaction) return res.status(404).json({ success: false, message: '未找到该自定义势力' });
        if (Number(customFaction.ownerUserId || 0) !== operatorId) {
          return res.status(403).json({ success: false, message: '只有该势力创建者可以辞退成员。' });
        }
        if (String(target.faction || '').trim() !== String(customFaction.name || '').trim()) {
          return res.status(409).json({ success: false, message: '目标玩家不在该势力中。' });
        }
        if (Number(target.id || 0) === Number(customFaction.ownerUserId || 0)) {
          return res.status(403).json({ success: false, message: '不能辞退该势力创建者。' });
        }
      } else {
        const meta = BUILTIN_LOCATION_MAP.get(locationId);
        if (!meta) return res.status(404).json({ success: false, message: '未找到阵营配置' });
        if (!meta.kickEnabled) return res.status(403).json({ success: false, message: '该区域不允许辞退成员。' });

        const delegationActive = isDelegationActive(db);
        if (!canManageFactionRoster(String(operator.job || ''), locationId, meta.kickEnabled, delegationActive)) {
          return res.status(403).json({ success: false, message: '当前职位没有辞退权限。' });
        }
        if (String(target.faction || '').trim() !== String(meta.name || '').trim()) {
          return res.status(409).json({ success: false, message: '目标玩家不在该阵营中。' });
        }
        if (locationId === 'guild' && String(target.job || '').trim() !== '公会成员') {
          return res.status(403).json({ success: false, message: '公会会长当前只能辞退公会成员职位。' });
        }
      }

      db.prepare(`UPDATE users SET job = '无', faction = '无', updatedAt = ? WHERE id = ?`).run(nowIso(), targetUserId);
      return res.json({ success: true, message: `${String(target.name || '该玩家')} 已被移出阵营。` });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error?.message || '辞退成员失败' });
    }
  });

  r.post('/faction/custom-roles', (req, res) => {
    try {
      const userId = Number(req.body?.userId || 0);
      const locationId = String(req.body?.locationId || '').trim();
      const title = String(req.body?.title || '').trim();
      const description = String(req.body?.description || '').trim();
      const minAge = Math.max(0, Number(req.body?.minAge || 0));
      const minMentalRank = String(req.body?.minMentalRank || '').trim();
      const minPhysicalRank = String(req.body?.minPhysicalRank || '').trim();
      const maxMembers = Math.max(0, Number(req.body?.maxMembers || 0));
      const salary = Math.max(0, Number(req.body?.salary || 0));

      if (!userId || !locationId || !title) {
        return res.status(400).json({ success: false, message: '缺少必要字段' });
      }

      const user = db.prepare(`SELECT id, name, job, faction FROM users WHERE id = ? LIMIT 1`).get(userId) as AnyRow | undefined;
      if (!user) return res.status(404).json({ success: false, message: '未找到该玩家' });

      let factionName = '';
      if (isCustomFactionLocationId(locationId)) {
        const customFaction = getCustomFactionById(db, locationId);
        if (!customFaction) return res.status(404).json({ success: false, message: '未找到该自定义势力' });
        if (Number(customFaction.ownerUserId || 0) !== userId) {
          return res.status(403).json({ success: false, message: '只有该势力创建者可以新增职位。' });
        }
        if (title === String(customFaction.leaderTitle || '掌权者')) {
          return res.status(409).json({ success: false, message: '该名称已被最高职位占用。' });
        }
        factionName = String(customFaction.name || '');
      } else {
        const meta = BUILTIN_LOCATION_MAP.get(locationId);
        if (!meta) return res.status(404).json({ success: false, message: '未找到该阵营' });
        if (!CUSTOM_ROLE_ENABLED_LOCATIONS.has(locationId)) {
          return res.status(403).json({ success: false, message: '该阵营当前不支持自定义职位。' });
        }
        if (!canManageCustomRoles(String(user.job || ''), locationId)) {
          return res.status(403).json({ success: false, message: '只有该阵营最高职位者可以新增职位。' });
        }
        if (meta.jobs.includes(title)) {
          return res.status(409).json({ success: false, message: '该名称与原有职位冲突。' });
        }
        factionName = meta.name;
      }

      const exists = db.prepare(`SELECT id FROM faction_custom_roles WHERE locationId = ? AND title = ? LIMIT 1`).get(locationId, title) as AnyRow | undefined;
      if (exists) return res.status(409).json({ success: false, message: '该自定义职位已存在。' });

      const ts = nowIso();
      const result = db.prepare(`
        INSERT INTO faction_custom_roles (
          locationId, factionName, title, description, minAge, minMentalRank, minPhysicalRank, maxMembers, salary, createdByUserId, isActive, createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
      `).run(locationId, factionName, title, description, minAge, minMentalRank, minPhysicalRank, maxMembers, salary, userId, ts, ts);

      const role = db.prepare(`SELECT * FROM faction_custom_roles WHERE id = ? LIMIT 1`).get(Number(result.lastInsertRowid || 0)) as AnyRow | undefined;
      return res.json({ success: true, message: `已新增职位：${title}`, role: role ? customRolePayload(db, role) : null });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error?.message || '新增自定义职位失败' });
    }
  });

  r.delete('/faction/custom-roles/:id', (req, res) => {
    try {
      const roleId = Number(req.params.id || 0);
      const userId = Number(req.query.userId || req.body?.userId || 0);
      if (!roleId || !userId) return res.status(400).json({ success: false, message: '缺少必要参数' });

      const role = db.prepare(`SELECT * FROM faction_custom_roles WHERE id = ? LIMIT 1`).get(roleId) as AnyRow | undefined;
      if (!role) return res.status(404).json({ success: false, message: '未找到该自定义职位' });

      const user = db.prepare(`SELECT id, name, job, faction FROM users WHERE id = ? LIMIT 1`).get(userId) as AnyRow | undefined;
      if (!user) return res.status(404).json({ success: false, message: '未找到该玩家' });

      const currentMembers = countRoleMembers(db, String(role.factionName || ''), String(role.title || ''));
      if (currentMembers > 0) {
        return res.status(409).json({ success: false, message: '该职位仍有人在任，无法删除。' });
      }

      const roleLocationId = String(role.locationId || '').trim();
      if (isCustomFactionLocationId(roleLocationId)) {
        const customFaction = getCustomFactionById(db, roleLocationId);
        if (!customFaction || Number(customFaction.ownerUserId || 0) !== userId) {
          return res.status(403).json({ success: false, message: '只有该势力创建者可以删除职位。' });
        }
      } else if (!canManageCustomRoles(String(user.job || ''), roleLocationId)) {
        return res.status(403).json({ success: false, message: '当前职位没有删除自定义职位的权限。' });
      }

      db.prepare(`DELETE FROM faction_custom_roles WHERE id = ?`).run(roleId);
      return res.json({ success: true, message: `已删除职位：${String(role.title || '')}` });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error?.message || '删除自定义职位失败' });
    }
  });
  r.get('/custom-factions/assets', (_req, res) => {
    res.json({ success: true, assets: getFactionAssets() });
  });

  r.get('/custom-factions', (_req, res) => {
    try {
      const rows = db.prepare(`
        SELECT id, name, description, ownerUserId, ownerName, leaderTitle, pointX, pointY, mapImageUrl, pointType, createdAt, updatedAt
        FROM custom_factions
        ORDER BY datetime(updatedAt) DESC, datetime(createdAt) DESC
      `).all() as AnyRow[];
      res.json({
        success: true,
        factions: rows.map((row) => ({
          id: String(row.id || ''),
          name: String(row.name || ''),
          description: String(row.description || ''),
          ownerUserId: Number(row.ownerUserId || 0),
          ownerName: String(row.ownerName || ''),
          leaderTitle: String(row.leaderTitle || '掌权者'),
          x: Number(row.pointX || 50),
          y: Number(row.pointY || 50),
          type: String(row.pointType || 'safe'),
          mapImageUrl: String(row.mapImageUrl || ''),
          createdAt: String(row.createdAt || ''),
          updatedAt: String(row.updatedAt || ''),
        })),
      });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error?.message || '读取自定义势力失败' });
    }
  });

  r.post('/custom-factions', (req, res) => {
    try {
      const userId = Number(req.body?.userId || 0);
      const name = String(req.body?.name || '').trim();
      const description = String(req.body?.description || '').trim();
      const mapImageUrl = String(req.body?.mapImageUrl || '').trim();
      const pointX = clamp(Number(req.body?.x || 0), 4, 96);
      const pointY = clamp(Number(req.body?.y || 0), 4, 96);
      if (!userId || !name) return res.status(400).json({ success: false, message: '缺少创建参数' });

      const user = db.prepare(`SELECT id, name, gold, faction, job, age, role, homeLocation FROM users WHERE id = ? LIMIT 1`).get(userId) as AnyRow | undefined;
      if (!user) return res.status(404).json({ success: false, message: '未找到该玩家' });
      if (!isNoJob(String(user.job || '')) || !isNoJob(String(user.faction || ''))) {
        return res.status(409).json({ success: false, message: '请先退出当前阵营，再创建新的自定义势力。' });
      }
      if (Number(user.gold || 0) < CUSTOM_FACTION_COST) {
        return res.status(409).json({ success: false, message: `创建势力需要 ${CUSTOM_FACTION_COST}G，当前金币不足。` });
      }
      const exists = db.prepare(`SELECT id FROM custom_factions WHERE name = ? LIMIT 1`).get(name) as AnyRow | undefined;
      if (exists) return res.status(409).json({ success: false, message: '该势力名称已存在，请更换名称。' });

      const factionId = buildCustomFactionId(name);
      const ts = nowIso();
      db.prepare(`
        INSERT INTO custom_factions (id, name, description, ownerUserId, ownerName, leaderTitle, pointX, pointY, mapImageUrl, pointType, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, '掌权者', ?, ?, ?, 'safe', ?, ?)
      `).run(factionId, name, description, userId, String(user.name || ''), pointX, pointY, mapImageUrl, ts, ts);

      db.prepare(`
        INSERT INTO faction_custom_roles (
          locationId, factionName, title, description, minAge, minMentalRank, minPhysicalRank, maxMembers, salary, createdByUserId, isActive, createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, '', '', 0, ?, ?, 1, ?, ?)
      `).run(factionId, name, DEFAULT_CUSTOM_MEMBER_TITLE, '默认开放职位，可供其他玩家加入。', 16, 5000, userId, ts, ts);

      db.prepare(`
        UPDATE users
        SET gold = ?, faction = ?, job = '掌权者', updatedAt = ?
        WHERE id = ?
      `).run(Math.max(0, Number(user.gold || 0) - CUSTOM_FACTION_COST), name, ts, userId);

      return res.json({
        success: true,
        message: `已创建自定义势力【${name}】。`,
        faction: {
          id: factionId,
          name,
          description,
          ownerUserId: userId,
          ownerName: String(user.name || ''),
          leaderTitle: '掌权者',
          x: pointX,
          y: pointY,
          type: 'safe',
          mapImageUrl,
        },
      });
    } catch (error: any) {
      console.error('[custom-factions/create] failed:', error);
      return res.status(500).json({ success: false, message: error?.message || '创建自定义势力失败' });
    }
  });

  r.get('/custom-factions/:locationId', (req, res) => {
    try {
      const locationId = String(req.params.locationId || '').trim();
      const faction = getCustomFactionById(db, locationId);
      if (!faction) return res.status(404).json({ success: false, message: '未找到该自定义势力' });

      const nodes = (db.prepare(`
        SELECT id, factionId, name, description, x, y, dailyInteractionLimit, salary, createdByUserId, createdAt, updatedAt
        FROM custom_faction_nodes
        WHERE factionId = ?
        ORDER BY datetime(updatedAt) DESC, datetime(createdAt) DESC
      `).all(locationId) as AnyRow[]).map((row) => ({
        id: String(row.id || ''),
        name: String(row.name || ''),
        description: String(row.description || ''),
        x: Number(row.x || 50),
        y: Number(row.y || 50),
        dailyInteractionLimit: Math.max(0, Number(row.dailyInteractionLimit || 0)),
        salary: Math.max(0, Number(row.salary || 0)),
        createdAt: String(row.createdAt || ''),
        updatedAt: String(row.updatedAt || ''),
      }));

      return res.json({
        success: true,
        faction: {
          id: String(faction.id || ''),
          name: String(faction.name || ''),
          description: String(faction.description || ''),
          ownerUserId: Number(faction.ownerUserId || 0),
          ownerName: String(faction.ownerName || ''),
          leaderTitle: String(faction.leaderTitle || '掌权者'),
          x: Number(faction.pointX || 50),
          y: Number(faction.pointY || 50),
          type: String(faction.pointType || 'safe'),
          mapImageUrl: String(faction.mapImageUrl || ''),
          createdAt: String(faction.createdAt || ''),
          updatedAt: String(faction.updatedAt || ''),
        },
        assets: getFactionAssets(),
        nodes,
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error?.message || '读取自定义势力失败' });
    }
  });

  r.post('/custom-factions/:locationId/settings', (req, res) => {
    try {
      const locationId = String(req.params.locationId || '').trim();
      const userId = Number(req.body?.userId || 0);
      const description = String(req.body?.description || '').trim();
      const mapImageUrl = String(req.body?.mapImageUrl || '').trim();
      const faction = getCustomFactionById(db, locationId);
      if (!faction) return res.status(404).json({ success: false, message: '未找到该自定义势力' });
      if (Number(faction.ownerUserId || 0) !== userId) {
        return res.status(403).json({ success: false, message: '只有该势力创建者可以修改设置。' });
      }

      db.prepare(`
        UPDATE custom_factions
        SET description = ?, mapImageUrl = ?, updatedAt = ?
        WHERE id = ?
      `).run(description, mapImageUrl, nowIso(), locationId);
      return res.json({ success: true, message: '已保存自定义势力设置。' });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error?.message || '保存自定义势力设置失败' });
    }
  });
  r.post('/custom-factions/:locationId/nodes', (req, res) => {
    try {
      const locationId = String(req.params.locationId || '').trim();
      const userId = Number(req.body?.userId || 0);
      const name = String(req.body?.name || '').trim();
      const description = String(req.body?.description || '').trim();
      const x = clamp(Number(req.body?.x || 0), 4, 96);
      const y = clamp(Number(req.body?.y || 0), 4, 96);
      const dailyInteractionLimit = Math.max(1, Number(req.body?.dailyInteractionLimit || 1));
      const salary = Math.max(0, Number(req.body?.salary || 0));
      if (!userId || !name) return res.status(400).json({ success: false, message: '缺少地点信息' });

      const faction = getCustomFactionById(db, locationId);
      if (!faction) return res.status(404).json({ success: false, message: '未找到该自定义势力' });
      if (Number(faction.ownerUserId || 0) !== userId) {
        return res.status(403).json({ success: false, message: '只有该势力创建者可以新增地点。' });
      }

      const nodeId = buildNodeId(locationId);
      const ts = nowIso();
      db.prepare(`
        INSERT INTO custom_faction_nodes (id, factionId, name, description, x, y, dailyInteractionLimit, salary, createdByUserId, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(nodeId, locationId, name, description, x, y, dailyInteractionLimit, salary, userId, ts, ts);
      return res.json({ success: true, message: `已新增地点：${name}` });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error?.message || '新增自定义地点失败' });
    }
  });

  r.delete('/custom-factions/:locationId/nodes/:nodeId', (req, res) => {
    try {
      const locationId = String(req.params.locationId || '').trim();
      const nodeId = String(req.params.nodeId || '').trim();
      const userId = Number(req.query.userId || req.body?.userId || 0);
      if (!locationId || !nodeId || !userId) return res.status(400).json({ success: false, message: '缺少必要参数' });

      const faction = getCustomFactionById(db, locationId);
      if (!faction) return res.status(404).json({ success: false, message: '未找到该自定义势力' });
      if (Number(faction.ownerUserId || 0) !== userId) {
        return res.status(403).json({ success: false, message: '只有该势力创建者可以删除地点。' });
      }

      db.prepare(`DELETE FROM custom_faction_nodes WHERE id = ? AND factionId = ?`).run(nodeId, locationId);
      db.prepare(`DELETE FROM custom_faction_node_logs WHERE nodeId = ?`).run(nodeId);
      return res.json({ success: true, message: '已删除该地点。' });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error?.message || '删除自定义地点失败' });
    }
  });

  r.post('/custom-factions/:locationId/nodes/:nodeId/interact', (req, res) => {
    try {
      const locationId = String(req.params.locationId || '').trim();
      const nodeId = String(req.params.nodeId || '').trim();
      const userId = Number(req.body?.userId || 0);
      if (!locationId || !nodeId || !userId) return res.status(400).json({ success: false, message: '缺少必要参数' });

      const node = db.prepare(`SELECT * FROM custom_faction_nodes WHERE id = ? AND factionId = ? LIMIT 1`).get(nodeId, locationId) as AnyRow | undefined;
      if (!node) return res.status(404).json({ success: false, message: '未找到该地点' });

      const user = db.prepare(`SELECT id, gold, currentLocation FROM users WHERE id = ? LIMIT 1`).get(userId) as AnyRow | undefined;
      if (!user) return res.status(404).json({ success: false, message: '未找到该玩家' });
      if (String(user.currentLocation || '') !== locationId) {
        return res.status(409).json({ success: false, message: '请先进入该势力地图后再互动。' });
      }

      const dateKey = todayKey();
      const log = db.prepare(`
        SELECT id, interactionCount
        FROM custom_faction_node_logs
        WHERE nodeId = ? AND factionId = ? AND userId = ? AND dateKey = ?
        LIMIT 1
      `).get(nodeId, locationId, userId, dateKey) as AnyRow | undefined;

      const limit = Math.max(1, Number(node.dailyInteractionLimit || 1));
      const currentCount = Math.max(0, Number(log?.interactionCount || 0));
      if (currentCount >= limit) {
        return res.status(409).json({ success: false, message: '你今天在这里的交互次数已经用完了。' });
      }

      const nextCount = currentCount + 1;
      const ts = nowIso();
      if (log) {
        db.prepare(`UPDATE custom_faction_node_logs SET interactionCount = ?, updatedAt = ? WHERE id = ?`).run(nextCount, ts, Number(log.id || 0));
      } else {
        db.prepare(`
          INSERT INTO custom_faction_node_logs (nodeId, factionId, userId, dateKey, interactionCount, updatedAt)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(nodeId, locationId, userId, dateKey, nextCount, ts);
      }

      const salary = Math.max(0, Number(node.salary || 0));
      if (salary > 0) {
        db.prepare(`UPDATE users SET gold = gold + ?, updatedAt = ? WHERE id = ?`).run(salary, ts, userId);
      }

      return res.json({
        success: true,
        message: salary > 0 ? `互动完成，获得 ${salary}G。` : '互动完成。',
        remaining: Math.max(0, limit - nextCount),
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error?.message || '地点互动失败' });
    }
  });

  return r;
}

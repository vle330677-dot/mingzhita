import { Router } from 'express';
import { AppContext } from '../types';
import { nowIso, resolveInitialHome } from '../utils/common';

type HomeLoc = 'sanctuary' | 'slums' | 'rich_area';
type FactionLocationId =
  | 'tower_of_life'
  | 'london_tower'
  | 'paranormal_office'
  | 'guild'
  | 'tower_guard'
  | 'observers'
  | 'demon_society'
  | 'army'
  | 'sanctuary'
  | 'slums'
  | 'rich_area';

interface FactionMeta {
  name: string;
  locationId: FactionLocationId;
  leaderJob: string;
  kickEnabled: boolean;
  baseSalary: number;
  lowestJob: string;
  jobs: string[];
}

const FACTION_METAS: FactionMeta[] = [
  {
    name: '命之塔',
    locationId: 'tower_of_life',
    leaderJob: '圣子',
    kickEnabled: true,
    baseSalary: 12000,
    lowestJob: '仆从',
    jobs: ['圣子', '圣女', '候选者', '侍奉者', '仆从', '神使', '神使后裔']
  },
  {
    name: '伦敦塔',
    locationId: 'london_tower',
    leaderJob: '伦敦塔教师',
    kickEnabled: true,
    baseSalary: 8000,
    lowestJob: '伦敦塔学员',
    jobs: ['伦敦塔教师', '伦敦塔职工', '伦敦塔学员']
  },
  {
    name: '灵异管理所',
    locationId: 'paranormal_office',
    leaderJob: '灵异所所长',
    kickEnabled: true,
    baseSalary: 9000,
    lowestJob: '灵异所文员',
    jobs: ['灵异所所长', '搜捕队队长', '搜捕队队员', '灵异所文员']
  },
  {
    name: '公会',
    locationId: 'guild',
    leaderJob: '公会会长',
    kickEnabled: true,
    baseSalary: 7000,
    lowestJob: '冒险者',
    jobs: ['公会会长', '公会成员', '冒险者']
  },
  {
    name: '守塔会',
    locationId: 'tower_guard',
    leaderJob: '守塔会会长',
    kickEnabled: true,
    baseSalary: 8500,
    lowestJob: '守塔会成员',
    jobs: ['守塔会会长', '守塔会成员']
  },
  {
    name: '观察者',
    locationId: 'observers',
    leaderJob: '观察者首领',
    kickEnabled: true,
    baseSalary: 8500,
    lowestJob: '情报搜集员',
    jobs: ['观察者首领', '情报搜集员', '情报处理员']
  },
  {
    name: '恶魔会',
    locationId: 'demon_society',
    leaderJob: '恶魔会会长',
    kickEnabled: true,
    baseSalary: 7500,
    lowestJob: '恶魔会成员',
    jobs: ['恶魔会会长', '恶魔会成员']
  },
  {
    name: '军队',
    locationId: 'army',
    leaderJob: '军队将官',
    kickEnabled: true,
    baseSalary: 9500,
    lowestJob: '军队士兵',
    jobs: ['军队将官', '军队校官', '军队尉官', '军队士兵']
  },
  {
    name: '圣所',
    locationId: 'sanctuary',
    leaderJob: '圣所保育员',
    kickEnabled: true,
    baseSalary: 6500,
    lowestJob: '圣所幼崽',
    jobs: ['圣所保育员', '圣所职工', '圣所幼崽']
  },
  {
    name: '西市',
    locationId: 'slums',
    leaderJob: '西区市长',
    kickEnabled: false,
    baseSalary: 6000,
    lowestJob: '西区技工',
    jobs: ['西区市长', '西区副市长', '西区技工']
  },
  {
    name: '东市',
    locationId: 'rich_area',
    leaderJob: '东区市长',
    kickEnabled: false,
    baseSalary: 10000,
    lowestJob: '东区贵族',
    jobs: ['东区市长', '东区副市长', '东区贵族', '东区技工']
  }
];

const JOB_FACTION_MAP = new Map<string, FactionMeta>();
for (const meta of FACTION_METAS) {
  for (const job of meta.jobs) JOB_FACTION_MAP.set(job, meta);
}

const LOCATION_FACTION_MAP = new Map<string, FactionMeta>();
for (const meta of FACTION_METAS) LOCATION_FACTION_MAP.set(meta.locationId, meta);

const SCHOOL_LOCATION_IDS = new Set<FactionLocationId>(['tower_of_life', 'london_tower', 'sanctuary']);
const TOWER_GOVERNOR_JOBS = new Set(['圣子', '圣女']);
const GUARD_CHIEF_JOB = '守塔会会长';

function isSchoolLocation(locationId: string) {
  return SCHOOL_LOCATION_IDS.has(locationId as FactionLocationId);
}

function resolveHomeByJob(jobName: string): HomeLoc | null {
  const j = String(jobName || '').trim();

  if (['圣所幼崽', '圣所保育员', '圣所职工'].includes(j)) return 'sanctuary';
  if (['西区技工', '西区副市长', '西区市长'].includes(j)) return 'slums';
  if (['东区贵族', '东区技工', '东区副市长', '东区市长'].includes(j)) return 'rich_area';

  return null;
}

function isMinor(age: number) {
  return Number(age || 0) < 16;
}

function isStudentAge(age: number) {
  const n = Number(age || 0);
  return n >= 16 && n <= 19;
}

function resolveFactionMetaByJob(jobName: string): FactionMeta | null {
  const j = String(jobName || '').trim();
  if (!j || j === '无') return null;
  const exact = JOB_FACTION_MAP.get(j);
  if (exact) return exact;
  if (j.includes('伦敦塔')) return LOCATION_FACTION_MAP.get('london_tower') || null;
  if (j.includes('灵异') || j.includes('搜捕')) return LOCATION_FACTION_MAP.get('paranormal_office') || null;
  if (j.includes('公会') || j.includes('冒险者')) return LOCATION_FACTION_MAP.get('guild') || null;
  if (j.includes('守塔')) return LOCATION_FACTION_MAP.get('tower_guard') || null;
  if (j.includes('观察') || j.includes('情报')) return LOCATION_FACTION_MAP.get('observers') || null;
  if (j.includes('恶魔')) return LOCATION_FACTION_MAP.get('demon_society') || null;
  if (j.includes('军队') || j.includes('将官') || j.includes('校官') || j.includes('尉官') || j.includes('士兵')) return LOCATION_FACTION_MAP.get('army') || null;
  if (j.includes('圣所') || j.includes('幼崽') || j.includes('保育')) return LOCATION_FACTION_MAP.get('sanctuary') || null;
  if (j.includes('西区')) return LOCATION_FACTION_MAP.get('slums') || null;
  if (j.includes('东区')) return LOCATION_FACTION_MAP.get('rich_area') || null;
  if (j.includes('圣子') || j.includes('圣女') || j.includes('候选') || j.includes('侍奉') || j.includes('仆从') || j.includes('神使')) {
    return LOCATION_FACTION_MAP.get('tower_of_life') || null;
  }
  return null;
}

function lowestJobForFaction(jobName: string) {
  const meta = resolveFactionMetaByJob(jobName);
  if (meta) return meta.lowestJob;
  return String(jobName || '').trim();
}

function isLondonTowerStudentJob(jobName: string) {
  const j = String(jobName || '').trim();
  return j.includes('伦敦塔') && (j.includes('学员') || j.includes('学生'));
}

function calcQuitPenalty(jobName: string) {
  const meta = resolveFactionMetaByJob(jobName);
  if (!meta) return 0;
  const j = String(jobName || '');
  let factor = 1;
  if (/会长|首领|所长|市长|将官|圣子|圣女/.test(j)) factor = 1.8;
  else if (/副市长|队长|校官|教师|候选|后裔|保育/.test(j)) factor = 1.4;
  else if (/尉官|成员|职工|文员|队员|学员|技工|贵族|仆从|冒险者/.test(j)) factor = 1;
  const salary = Math.max(1000, Math.round(meta.baseSalary * factor));
  return Math.max(100, Math.round(salary * 0.1));
}

function inferFactionName(user: any) {
  const byJob = resolveFactionMetaByJob(String(user?.job || ''));
  if (byJob) return byJob.name;
  const raw = String(user?.faction || '').trim();
  if (!raw || raw === '无') return '';
  return raw;
}

export function createLegacyRouter(ctx: AppContext) {
  const r = Router();
  const { db } = ctx;

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

  const getDelegationRow = () =>
    db.prepare(`
      SELECT id, status, requestedByUserId, reviewedByUserId, requestedAt, reviewedAt, updatedAt
      FROM tower_school_delegation
      WHERE id = 1
      LIMIT 1
    `).get() as any;

  const isDelegationActive = () => String(getDelegationRow()?.status || '') === 'approved';

  const hasKickAuthority = (operatorJob: string, meta: FactionMeta, delegationActive: boolean) => {
    if (!meta.kickEnabled) return false;
    const job = String(operatorJob || '').trim();
    if (!job || job === '无') return false;
    if (!isSchoolLocation(meta.locationId)) return job === meta.leaderJob;
    if (TOWER_GOVERNOR_JOBS.has(job)) return true;
    return delegationActive && job === GUARD_CHIEF_JOB;
  };

  const managerLabelForFaction = (meta: FactionMeta, delegationActive: boolean) => {
    if (!isSchoolLocation(meta.locationId)) return meta.leaderJob;
    return delegationActive ? '圣子/圣女（已授权守塔会会长）' : '圣子/圣女';
  };

  const loadUserName = (id: number | null | undefined) => {
    if (!id) return '';
    const row = db.prepare(`SELECT name FROM users WHERE id = ? LIMIT 1`).get(id) as any;
    return String(row?.name || '');
  };

  r.post('/tower/join', (req, res) => {
    try {
      const userId = Number(req.body?.userId);
      const rawJob = String(req.body?.jobName || '').trim();
      const minorConfirm = Boolean(req.body?.minorConfirm ?? false);

      if (!Number.isFinite(userId) || !rawJob) {
        return res.status(400).json({ success: false, message: 'userId/jobName invalid' });
      }

      const u = db.prepare(`
        SELECT id, name, age, gold, role, job, faction, homeLocation, currentLocation
        FROM users
        WHERE id = ?
      `).get(userId) as any;

      if (!u) return res.status(404).json({ success: false, message: 'user not found' });

      const age = Number(u.age || 0);

      const rawMeta = resolveFactionMetaByJob(rawJob);
      const allowMinorJoin = rawMeta?.locationId === 'sanctuary' && rawJob === '圣所幼崽';
      if (isMinor(age) && !allowMinorJoin) {
        return res.status(403).json({
          success: false,
          code: 'MINOR_UNDIFFERENTIATED_BLOCK',
          message: 'undifferentiated players cannot join this faction before age 16'
        });
      }

      let jobName = rawJob;
      const isStudentRole = isLondonTowerStudentJob(jobName);

      if (isStudentAge(age) && !isStudentRole) {
        if (!minorConfirm) {
          return res.status(409).json({
            success: false,
            code: 'MINOR_CONFIRM_REQUIRED',
            message: 'you are still in student age; choose london tower student or confirm lowest-rank entry',
            suggestedJob: '伦敦塔学员',
            lowestJob: lowestJobForFaction(jobName)
          });
        }
        jobName = lowestJobForFaction(jobName);
      }

      const nextMeta = resolveFactionMetaByJob(jobName);
      if (!nextMeta) {
        return res.status(400).json({ success: false, code: 'UNKNOWN_JOB', message: '未识别的职位，无法加入阵营' });
      }
      const currentFaction = inferFactionName(u);
      const currentMeta = resolveFactionMetaByJob(String(u.job || '')) || FACTION_METAS.find((m) => m.name === currentFaction) || null;
      if (currentMeta && nextMeta && currentMeta.name !== nextMeta.name) {
        return res.status(409).json({
          success: false,
          code: 'FACTION_LOCKED',
          message: `你已加入【${currentMeta.name}】。每名玩家只能加入一个阵营，请先退出当前阵营。`
        });
      }

      const nextFactionName = nextMeta?.name || currentFaction || '无';
      db.prepare(`UPDATE users SET job = ?, faction = ?, updatedAt = ? WHERE id = ?`).run(jobName, nextFactionName, nowIso(), userId);

      let nextHome: HomeLoc | null = resolveHomeByJob(jobName);
      if (!nextHome) {
        if (String(u.role || '') === '未分化' || Number(u.age || 0) < 16) {
          nextHome = 'sanctuary';
        } else {
          const oldHome = String(u.homeLocation || '');
          if (oldHome === 'sanctuary' || oldHome === 'slums' || oldHome === 'rich_area') {
            nextHome = oldHome as HomeLoc;
          } else {
            nextHome = resolveInitialHome(Number(u.age || 18), Number(u.gold || 0)) as HomeLoc;
          }
        }
      }

      db.prepare(`UPDATE users SET homeLocation = ?, updatedAt = ? WHERE id = ?`).run(nextHome, nowIso(), userId);

      return res.json({
        success: true,
        message: `加入成功：${jobName}`,
        data: { userId, jobName, faction: nextFactionName, homeLocation: nextHome }
      });
    } catch (e: any) {
      console.error('[tower/join] failed:', e);
      return res.status(500).json({ success: false, message: e?.message || 'join failed' });
    }
  });

  r.post('/tower/quit', (req, res) => {
    try {
      const userId = Number(req.body?.userId);
      if (!Number.isFinite(userId)) return res.status(400).json({ success: false, message: 'userId invalid' });
      const noPenalty = Boolean(req.body?.noPenalty);
      const u = db.prepare(`
        SELECT id, job, faction, gold
        FROM users
        WHERE id = ?
      `).get(userId) as any;
      if (!u) return res.status(404).json({ success: false, message: 'user not found' });

      const curJob = String(u.job || '').trim();
      const curFaction = inferFactionName(u);
      if (!curJob || curJob === '无') {
        if (curFaction) {
          db.prepare(`UPDATE users SET faction = '无', updatedAt = ? WHERE id = ?`).run(nowIso(), userId);
        }
        return res.json({ success: true, penalty: 0, message: '当前无可退出职位' });
      }

      const penalty = noPenalty ? 0 : calcQuitPenalty(curJob);
      const currentGold = Number(u.gold || 0);
      if (penalty > 0 && currentGold < penalty) {
        return res.status(409).json({
          success: false,
          code: 'QUIT_GOLD_LACK',
          message: `无法退出：离职需扣除 ${penalty}G（该阵营工资的10%），你当前金币不足。`
        });
      }

      const nextGold = Math.max(0, currentGold - penalty);
      db.prepare(`
        UPDATE users
        SET job = '无',
            faction = '无',
            gold = ?,
            updatedAt = ?
        WHERE id = ?
      `).run(nextGold, nowIso(), userId);
      return res.json({
        success: true,
        penalty,
        message: noPenalty ? `已退出【${curFaction || '原阵营'}】（本次免扣费）` : `已退出【${curFaction || '原阵营'}】，扣除 ${penalty}G`
      });
    } catch (e: any) {
      return res.status(500).json({ success: false, message: e?.message || 'quit failed' });
    }
  });

  r.get('/faction/delegation/status', (req, res) => {
    try {
      const userId = Number(req.query.userId || 0);
      let canApply = false;
      let canReview = false;

      if (userId) {
        const me = db.prepare(`SELECT id, job FROM users WHERE id = ? LIMIT 1`).get(userId) as any;
        if (me) {
          const myJob = String(me.job || '').trim();
          canApply = myJob === GUARD_CHIEF_JOB;
          canReview = TOWER_GOVERNOR_JOBS.has(myJob);
        }
      }

      const row = getDelegationRow();
      const status = String(row?.status || 'none');
      return res.json({
        success: true,
        canApply,
        canReview,
        delegation: {
          status,
          active: status === 'approved',
          requestedByUserId: Number(row?.requestedByUserId || 0) || null,
          requestedByName: loadUserName(Number(row?.requestedByUserId || 0) || null) || '',
          reviewedByUserId: Number(row?.reviewedByUserId || 0) || null,
          reviewedByName: loadUserName(Number(row?.reviewedByUserId || 0) || null) || '',
          requestedAt: String(row?.requestedAt || ''),
          reviewedAt: String(row?.reviewedAt || ''),
          updatedAt: String(row?.updatedAt || '')
        }
      });
    } catch (e: any) {
      return res.status(500).json({ success: false, message: e?.message || 'load delegation status failed' });
    }
  });

  r.post('/faction/delegation/request', (req, res) => {
    try {
      const userId = Number(req.body?.userId || 0);
      if (!userId) return res.status(400).json({ success: false, message: 'userId required' });

      const me = db.prepare(`SELECT id, name, job FROM users WHERE id = ? LIMIT 1`).get(userId) as any;
      if (!me) return res.status(404).json({ success: false, message: '玩家不存在' });
      if (String(me.job || '') !== GUARD_CHIEF_JOB) {
        return res.status(403).json({ success: false, message: '仅守塔会会长可发起接管申请' });
      }

      const row = getDelegationRow();
      const status = String(row?.status || 'none');
      if (status === 'pending') {
        return res.status(409).json({ success: false, message: '已有待审批的接管申请' });
      }
      if (status === 'approved') {
        return res.status(409).json({ success: false, message: '当前已获授权，无需重复申请' });
      }

      const now = nowIso();
      db.prepare(`
        UPDATE tower_school_delegation
        SET status = 'pending',
            requestedByUserId = ?,
            reviewedByUserId = NULL,
            requestedAt = ?,
            reviewedAt = NULL,
            updatedAt = ?
        WHERE id = 1
      `).run(userId, now, now);

      return res.json({ success: true, message: '已提交三塔管理申请，等待命之塔圣子/圣女审批。' });
    } catch (e: any) {
      return res.status(500).json({ success: false, message: e?.message || 'delegation request failed' });
    }
  });

  r.post('/faction/delegation/review', (req, res) => {
    try {
      const reviewerId = Number(req.body?.reviewerId || 0);
      const action = String(req.body?.action || '').trim();
      if (!reviewerId || !['approve', 'reject', 'revoke'].includes(action)) {
        return res.status(400).json({ success: false, message: 'reviewerId/action invalid' });
      }

      const reviewer = db.prepare(`SELECT id, name, job FROM users WHERE id = ? LIMIT 1`).get(reviewerId) as any;
      if (!reviewer) return res.status(404).json({ success: false, message: '玩家不存在' });
      if (!TOWER_GOVERNOR_JOBS.has(String(reviewer.job || ''))) {
        return res.status(403).json({ success: false, message: '仅命之塔圣子/圣女可审批三塔管理权' });
      }

      const row = getDelegationRow();
      const status = String(row?.status || 'none');
      if ((action === 'approve' || action === 'reject') && status !== 'pending') {
        return res.status(409).json({ success: false, message: '当前没有待审批的接管申请' });
      }
      if (action === 'revoke' && status !== 'approved') {
        return res.status(409).json({ success: false, message: '当前没有生效中的守塔会接管权限' });
      }

      const now = nowIso();
      const nextStatus = action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : 'revoked';
      db.prepare(`
        UPDATE tower_school_delegation
        SET status = ?,
            reviewedByUserId = ?,
            reviewedAt = ?,
            updatedAt = ?
        WHERE id = 1
      `).run(nextStatus, reviewerId, now, now);

      const msgMap: Record<string, string> = {
        approve: '已批准守塔会接管三塔管理权。',
        reject: '已驳回守塔会接管申请。',
        revoke: '已收回守塔会的三塔管理权。'
      };
      return res.json({ success: true, message: msgMap[action] || '审批完成' });
    } catch (e: any) {
      return res.status(500).json({ success: false, message: e?.message || 'delegation review failed' });
    }
  });

  r.get('/faction/roster', (req, res) => {
    try {
      const userId = Number(req.query.userId || 0);
      const locationId = String(req.query.locationId || '').trim();
      if (!userId || !locationId) {
        return res.status(400).json({ success: false, message: 'userId/locationId required' });
      }

      const requester = db.prepare(`
        SELECT id, name, job, faction, status
        FROM users
        WHERE id = ?
        LIMIT 1
      `).get(userId) as any;
      if (!requester) return res.status(404).json({ success: false, message: 'user not found' });

      const byLocation = LOCATION_FACTION_MAP.get(locationId) || null;
      const byJob = resolveFactionMetaByJob(String(requester.job || ''));
      const meta = byLocation || byJob;
      if (!meta) {
        return res.json({
          success: true,
          factionName: '',
          leaderJob: '',
          kickEnabled: false,
          canManage: false,
          members: []
        });
      }

      const placeholders = meta.jobs.map(() => '?').join(',');
      const rows = db.prepare(`
        SELECT id, name, job, faction, currentLocation
        FROM users
        WHERE status IN ('approved', 'ghost')
          AND (
            faction = ?
            OR job IN (${placeholders})
          )
        ORDER BY id DESC
      `).all(meta.name, ...meta.jobs) as any[];

      const uniq = new Map<number, any>();
      for (const row of rows) {
        uniq.set(Number(row.id || 0), row);
      }
      const members = Array.from(uniq.values()).map((x) => ({
        id: Number(x.id || 0),
        name: String(x.name || ''),
        job: String(x.job || '无'),
        faction: String(x.faction || meta.name),
        currentLocation: String(x.currentLocation || '')
      }));

      const delegationActive = isDelegationActive();
      const canManage = hasKickAuthority(String(requester.job || ''), meta, delegationActive);
      return res.json({
        success: true,
        factionName: meta.name,
        leaderJob: managerLabelForFaction(meta, delegationActive),
        kickEnabled: meta.kickEnabled,
        canManage,
        delegationActive,
        members
      });
    } catch (e: any) {
      return res.status(500).json({ success: false, message: e?.message || 'roster failed', members: [] });
    }
  });

  r.post('/faction/kick', (req, res) => {
    try {
      const operatorId = Number(req.body?.operatorId || 0);
      const targetUserId = Number(req.body?.targetUserId || 0);
      const locationId = String(req.body?.locationId || '').trim();
      if (!operatorId || !targetUserId || !locationId) {
        return res.status(400).json({ success: false, message: 'operatorId/targetUserId/locationId required' });
      }
      if (operatorId === targetUserId) {
        return res.status(400).json({ success: false, message: '不能辞退自己' });
      }

      const meta = LOCATION_FACTION_MAP.get(locationId);
      if (!meta) return res.status(404).json({ success: false, message: '未找到该地图阵营配置' });
      if (!meta.kickEnabled) {
        return res.status(403).json({ success: false, message: '该区域不允许辞退成员' });
      }

      const operator = db.prepare(`SELECT id, name, job FROM users WHERE id = ? LIMIT 1`).get(operatorId) as any;
      const target = db.prepare(`SELECT id, name, job, faction FROM users WHERE id = ? LIMIT 1`).get(targetUserId) as any;
      if (!operator || !target) return res.status(404).json({ success: false, message: '玩家不存在' });
      const delegationActive = isDelegationActive();
      const operatorJob = String(operator.job || '');
      if (!hasKickAuthority(operatorJob, meta, delegationActive)) {
        if (isSchoolLocation(meta.locationId)) {
          return res.status(403).json({ success: false, message: '三塔人事仅命之塔圣子/圣女可管理，或由其授权守塔会会长管理' });
        }
        return res.status(403).json({ success: false, message: '只有最高职位可辞退成员' });
      }

      const targetMeta = resolveFactionMetaByJob(String(target.job || '')) || FACTION_METAS.find((m) => m.name === String(target.faction || '').trim()) || null;
      if (!targetMeta || targetMeta.name !== meta.name) {
        return res.status(409).json({ success: false, message: '目标玩家不在同阵营内' });
      }
      if (meta.locationId === 'guild') {
        const targetJob = String(target.job || '').trim();
        if (targetJob !== '公会成员') {
          return res.status(403).json({ success: false, message: '公会会长仅可辞退公会工作人员（公会成员）' });
        }
      }

      db.prepare(`
        UPDATE users
        SET job = '无',
            faction = '无',
            updatedAt = ?
        WHERE id = ?
      `).run(nowIso(), targetUserId);

      return res.json({
        success: true,
        message: `${target.name} 已被逐出阵营（无资金扣除）`
      });
    } catch (e: any) {
      return res.status(500).json({ success: false, message: e?.message || 'kick failed' });
    }
  });

  return r;
}

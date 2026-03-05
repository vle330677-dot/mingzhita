import { Router, Request, Response } from 'express';
import { AppContext } from '../types';
import { writeAdminLog } from '../utils/common';
import { hashPassword, verifyPassword } from '../middleware/auth';

type AnyRow = Record<string, any>;

const nowIso = () => new Date().toISOString();
const HOME_LOCATION_SET = new Set(['sanctuary', 'slums', 'rich_area']);
const ADMIN_STATUS_SET = new Set([
  'pending',
  'approved',
  'rejected',
  'banned',
  'dead',
  'ghost',
  'pending_death',
  'pending_ghost'
]);

function normalizeName(v: any) {
  return String(v ?? '').trim();
}

function normalizeStatus(v: any) {
  const s = String(v ?? '').trim();
  if (['pending', 'approved', 'rejected', 'banned'].includes(s)) return s;
  return 'pending';
}

function normalizeAdminStatus(v: any, fallback = 'pending') {
  const s = String(v ?? '').trim();
  if (ADMIN_STATUS_SET.has(s)) return s;
  return fallback;
}

function normalizeRole(v: any) {
  const s = String(v ?? '').trim();
  return s || '未分化';
}

function normalizeJob(v: any) {
  const s = String(v ?? '').trim();
  return s || '无';
}

function normalizeRoleByAge(ageRaw: any, roleRaw: any) {
  const age = Number(ageRaw ?? 0);
  const role = String(roleRaw ?? '').trim();
  if (role === '鬼魂' || role.toLowerCase() === 'ghost') return '鬼魂';
  if (age < 16) return '未分化';
  if (!role || role === '未分化') return '普通人';
  return role;
}

function resolveHomeLocationByRule(ageRaw: any, goldRaw: any, roleRaw: any, preferredRaw?: any) {
  const age = Number(ageRaw ?? 0);
  const gold = Number(goldRaw ?? 0);
  const role = String(roleRaw ?? '').trim();
  const preferred = String(preferredRaw ?? '').trim();

  if (role === '未分化' || age < 16) return 'sanctuary';

  if (HOME_LOCATION_SET.has(preferred as any)) {
    if (preferred === 'rich_area' && gold <= 9999) return 'slums';
    return preferred;
  }
  return gold > 9999 ? 'rich_area' : 'slums';
}

function safeJson(res: Response, code: number, body: any) {
  return res.status(code).json(body);
}

function tryParseJson(v: any) {
  if (typeof v !== 'string' || !v.trim()) return null;
  try {
    return JSON.parse(v);
  } catch {
    return null;
  }
}

export function createCoreRouter(ctx: AppContext) {
  const router = Router();
  const db = ctx.db;
  const auth = ctx.auth;

  /** ---------- schema guard ---------- */
  function ensureTables() {
    db.prepare(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE,
        role TEXT DEFAULT '未分化',
        status TEXT DEFAULT 'pending',
        age INTEGER DEFAULT 16,
        gold INTEGER DEFAULT 0,
        job TEXT DEFAULT '无',
        physicalRank TEXT DEFAULT '无',
        mentalRank TEXT DEFAULT '无',
        currentLocation TEXT DEFAULT '',
        homeLocation TEXT DEFAULT '',
        avatarUrl TEXT DEFAULT '',
        avatarUpdatedAt TEXT,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
        updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `).run();

    db.prepare(`
      CREATE TABLE IF NOT EXISTS user_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        token TEXT UNIQUE,
        userId INTEGER NOT NULL,
        userName TEXT NOT NULL,
        role TEXT DEFAULT 'player',
        revokedAt TEXT,
        lastSeenAt TEXT DEFAULT CURRENT_TIMESTAMP,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP
       )
     `).run();

    db.prepare(`
      CREATE TABLE IF NOT EXISTS admin_whitelist (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        code_name TEXT,
        enabled INTEGER DEFAULT 1,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `).run();

    db.prepare(`
      CREATE TABLE IF NOT EXISTS admin_action_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        adminName TEXT NOT NULL,
        action TEXT NOT NULL,
        targetType TEXT,
        targetId TEXT,
        detail TEXT,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `).run();

    // 尝试补索引（幂等）
    db.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS idx_users_name ON users(name)`).run();
    db.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions(token)`).run();
    db.prepare(`
      INSERT OR IGNORE INTO admin_whitelist(name, code_name, enabled)
      VALUES('塔', 'tower_admin', 1)
    `).run();
  }

  ensureTables();

  function issueSessionToken(userId: number, userName: string, role: 'player' | 'admin') {
    const token = auth.issueToken();
    db.prepare(
      `INSERT INTO user_sessions(token, userId, userName, role, revokedAt, lastSeenAt, createdAt)
       VALUES (?, ?, ?, ?, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
    ).run(token, userId, userName, role);
    return token;
  }

  function getUserByName(name: string): AnyRow | undefined {
    return db.prepare(`SELECT * FROM users WHERE name = ? LIMIT 1`).get(name) as AnyRow | undefined;
  }

  function getUserById(id: number): AnyRow | undefined {
    return db.prepare(`SELECT * FROM users WHERE id = ? LIMIT 1`).get(id) as AnyRow | undefined;
  }

  function mapUser(u: AnyRow | undefined | null) {
    if (!u) return null;
    return {
      id: Number(u.id),
      name: u.name,
      role: u.role ?? '未分化',
      status: u.status ?? 'pending',
      deathDescription: u.deathDescription ?? '',
      age: Number(u.age ?? 16),
      gold: Number(u.gold ?? 0),
      job: u.job ?? '无',
      physicalRank: u.physicalRank ?? '无',
      mentalRank: u.mentalRank ?? '无',
      faction: u.faction ?? '',
      ability: u.ability ?? '',
      spiritName: u.spiritName ?? '',
      spiritType: u.spiritType ?? '',
      hp: Number(u.hp ?? 100),
      maxHp: Number(u.maxHp ?? 100),
      mp: Number(u.mp ?? 100),
      maxMp: Number(u.maxMp ?? 100),
      erosionLevel: Number(u.erosionLevel ?? 0),
      bleedingLevel: Number(u.bleedingLevel ?? 0),
      fury: Number(u.fury ?? 0),
      guideStability: Number(u.guideStability ?? 100),
      partyId: u.partyId ?? null,
      currentLocation: u.currentLocation ?? '',
      homeLocation: u.homeLocation ?? '',
      avatarUrl: u.avatarUrl ?? '',
      adminAvatarUrl: u.adminAvatarUrl ?? '',
      avatarUpdatedAt: u.avatarUpdatedAt ?? null,
      hasLoginPassword: !!(u.loginPasswordHash || u.password),
      createdAt: u.createdAt ?? null,
      updatedAt: u.updatedAt ?? null,
    };
  }

  function extractBearer(req: Request) {
    const raw = (req.headers.authorization || '').trim();
    if (!raw.startsWith('Bearer ')) return '';
    return raw.slice(7).trim();
  }

  function getSessionUser(req: Request): { userId: number; userName: string; role: string } | null {
    const token = extractBearer(req);
    if (!token) return null;
    const row = db.prepare(
      `SELECT userId, userName, role, revokedAt
       FROM user_sessions
       WHERE token = ?
       LIMIT 1`
    ).get(token) as AnyRow | undefined;

    if (!row || row.revokedAt) return null;
    db.prepare(`UPDATE user_sessions SET lastSeenAt = CURRENT_TIMESTAMP WHERE token = ?`).run(token);
    return {
      userId: Number(row.userId),
      userName: String(row.userName || ''),
      role: String(row.role || 'player')
    };
  }

  function requireAdmin(req: Request, res: Response, next: Function) {
    const s = getSessionUser(req);
    if (!s || s.role !== 'admin') {
      return safeJson(res, 401, { success: false, message: '管理员会话失效或无权限' });
    }
    (req as any).admin = s;
    next();
  }

  /** ======================================================
   *  1) GET /api/users/:name
   * ====================================================== */
  router.get('/users/:name', (req, res) => {
    try {
      const name = normalizeName(req.params.name);
      if (!name) return safeJson(res, 400, { success: false, message: 'name required' });

      const user = getUserByName(name);
      return safeJson(res, 200, {
        success: true,
        exists: !!user,
        user: mapUser(user) // 不存在时为 null
      });
    } catch (e: any) {
      return safeJson(res, 500, { success: false, message: e?.message || 'query user failed' });
    }
  });

  /** ======================================================
   *  2) POST /api/users/init
   *     - 新用户初始化；同名存在则直接返回已存在
   * ====================================================== */
  router.post('/users/init', (req, res) => {
    try {
      const name = normalizeName(req.body?.name ?? req.body?.userName);
      if (!name) return safeJson(res, 400, { success: false, message: 'name required' });

      const existed = getUserByName(name);
      if (existed) {
        const fixedHome = resolveHomeLocationByRule(
          Number(existed.age ?? 0),
          Number(existed.gold ?? 0),
          String(existed.role || ''),
          existed.homeLocation
        );
        if (String(existed.homeLocation || '') !== fixedHome) {
          db.prepare(`UPDATE users SET homeLocation = ?, updatedAt = ? WHERE id = ?`)
            .run(fixedHome, nowIso(), Number(existed.id));
        }
        const refreshed = getUserById(Number(existed.id));
        return safeJson(res, 200, {
          success: true,
          existed: true,
          user: mapUser(refreshed || existed),
        });
      }

      const age = Number(req.body?.age ?? 15);
      const gold = Number(req.body?.gold ?? 0);
      const role = normalizeRoleByAge(age, normalizeRole(req.body?.role ?? '未分化'));
      const status = normalizeStatus(req.body?.status ?? 'pending');
      const homeLocation = resolveHomeLocationByRule(age, gold, role, req.body?.homeLocation);
      const currentLocation = String(req.body?.currentLocation ?? '').trim() || homeLocation;

      db.prepare(
        `INSERT INTO users(name, role, status, age, gold, job, physicalRank, mentalRank, currentLocation, homeLocation, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, '无', '无', '无', ?, ?, ?, ?)`
      ).run(name, role, status, age, gold, currentLocation, homeLocation, nowIso(), nowIso());

      const user = getUserByName(name);
      return safeJson(res, 200, {
        success: true,
        existed: false,
        user: mapUser(user)
      });
    } catch (e: any) {
      return safeJson(res, 500, { success: false, message: e?.message || 'init user failed' });
    }
  });

  /** ======================================================
   *  3) POST /api/users
   *     - 保存抽卡/分化结果（按 id 或 name 更新）
   * ====================================================== */
  router.post('/users', (req, res) => {
    try {
      const id = Number(req.body?.id ?? req.body?.userId ?? 0);
      const name = normalizeName(req.body?.name ?? req.body?.userName);

      let user: AnyRow | undefined;
      if (id > 0) user = getUserById(id);
      if (!user && name) user = getUserByName(name);

      if (!user && !name) {
        return safeJson(res, 400, { success: false, message: 'id or name required' });
      }

      if (!user && name) {
        // 不存在则创建
        const createAge = Number(req.body?.age ?? 15);
        const createRole = normalizeRoleByAge(createAge, normalizeRole(req.body?.role));
        const createGold = Number(req.body?.gold ?? 0);
        const createAbility = String(req.body?.ability ?? '').trim();
        const createSpiritName = String(req.body?.spiritName ?? '').trim();
        const createSpiritType = String(req.body?.spiritType ?? '').trim();
        const createHomeLocation = resolveHomeLocationByRule(createAge, createGold, createRole, req.body?.homeLocation);
        const createCurrentLocation = String(req.body?.currentLocation ?? '').trim() || createHomeLocation;
        db.prepare(
          `INSERT INTO users(name, role, status, age, gold, job, physicalRank, mentalRank, ability, spiritName, spiritType, currentLocation, homeLocation, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(
          name,
          createRole,
          normalizeStatus(req.body?.status ?? 'pending'),
          createAge,
          createGold,
          normalizeJob(req.body?.job),
          String(req.body?.physicalRank ?? '无'),
          String(req.body?.mentalRank ?? '无'),
          createAbility,
          createSpiritName,
          createSpiritType,
          createCurrentLocation,
          createHomeLocation,
          nowIso(),
          nowIso()
        );
        user = getUserByName(name);
      } else if (user) {
        const nextStatus = normalizeStatus(req.body?.status ?? user.status ?? 'pending');
        const nextJob = normalizeJob(req.body?.job ?? user.job);
        const nextAge = Number(req.body?.age ?? user.age ?? 16);
        const nextRole = normalizeRoleByAge(nextAge, normalizeRole(req.body?.role ?? user.role));
        const nextGold = Number(req.body?.gold ?? user.gold ?? 0);
        const nextPhysical = String(req.body?.physicalRank ?? user.physicalRank ?? '无');
        const nextMental = String(req.body?.mentalRank ?? user.mentalRank ?? '无');
        const nextAbility = String(req.body?.ability ?? user.ability ?? '').trim();
        const nextSpiritName = String(req.body?.spiritName ?? user.spiritName ?? '').trim();
        const nextSpiritType = String(req.body?.spiritType ?? user.spiritType ?? '').trim();
        const nextHomeLocation = resolveHomeLocationByRule(
          nextAge,
          nextGold,
          nextRole,
          req.body?.homeLocation ?? user.homeLocation ?? ''
        );
        const nextCurrentLocation = String(req.body?.currentLocation ?? user.currentLocation ?? '').trim() || nextHomeLocation;

        db.prepare(
          `UPDATE users
           SET role = ?, status = ?, job = ?, age = ?, gold = ?, physicalRank = ?, mentalRank = ?, ability = ?, spiritName = ?, spiritType = ?, currentLocation = ?, homeLocation = ?, updatedAt = ?
           WHERE id = ?`
        ).run(
          nextRole,
          nextStatus,
          nextJob,
          nextAge,
          nextGold,
          nextPhysical,
          nextMental,
          nextAbility,
          nextSpiritName,
          nextSpiritType,
          nextCurrentLocation,
          nextHomeLocation,
          nowIso(),
          Number(user.id)
        );
        user = getUserById(Number(user.id));
      }

      return safeJson(res, 200, { success: true, user: mapUser(user) });
    } catch (e: any) {
      return safeJson(res, 500, { success: false, message: e?.message || 'save user failed' });
    }
  });

  /** ======================================================
   *  4) POST /api/auth/login（玩家登录）
   * ====================================================== */
  router.post('/auth/login', async (req, res) => {
    try {
      const name = normalizeName(req.body?.name ?? req.body?.userName);
      if (!name) return safeJson(res, 400, { success: false, message: 'name required' });

      const user = getUserByName(name);
      if (!user) return safeJson(res, 404, { success: false, message: '用户不存在，请先初始化' });

      if (String(user.status || '') === 'banned') {
        return safeJson(res, 403, { success: false, message: '账号已被封禁' });
      }

      const fixedHome = resolveHomeLocationByRule(
        Number(user.age ?? 0),
        Number(user.gold ?? 0),
        String(user.role || ''),
        user.homeLocation
      );
      let effectiveUser = user;
      if (String(user.homeLocation || '') !== fixedHome) {
        db.prepare(`UPDATE users SET homeLocation = ?, updatedAt = ? WHERE id = ?`)
          .run(fixedHome, nowIso(), Number(user.id));
        effectiveUser = getUserById(Number(user.id)) || user;
      }

      const inputPassword = typeof req.body?.password === 'string' ? req.body.password : '';
      const loginPasswordHash = String(effectiveUser.loginPasswordHash || '').trim();
      if (loginPasswordHash) {
        if (!inputPassword) {
          return safeJson(res, 401, { success: false, message: '该账号已设置全局密码，请输入密码' });
        }
        const ok = await verifyPassword(inputPassword, loginPasswordHash);
        if (!ok) return safeJson(res, 401, { success: false, message: '密码错误' });
      } else {
        const legacyPassword = effectiveUser.password;
        if (legacyPassword !== null && legacyPassword !== undefined && String(legacyPassword) !== '') {
          if (inputPassword !== String(legacyPassword)) {
            return safeJson(res, 401, { success: false, message: '密码错误' });
          }
          const migratedHash = await hashPassword(inputPassword);
          db.prepare(`UPDATE users SET loginPasswordHash = ?, password = NULL, updatedAt = ? WHERE id = ?`)
            .run(migratedHash, nowIso(), Number(effectiveUser.id));
          effectiveUser = getUserById(Number(effectiveUser.id)) || effectiveUser;
        }
      }

      // 一人一皮：新登录会顶掉旧会话
      db.prepare(`UPDATE user_sessions SET revokedAt = CURRENT_TIMESTAMP WHERE userId = ? AND role='player' AND revokedAt IS NULL`)
        .run(Number(user.id));

      const token = issueSessionToken(Number(user.id), String(user.name), 'player');

      return safeJson(res, 200, {
        success: true,
        token,
        user: mapUser(effectiveUser)
      });
    } catch (e: any) {
      return safeJson(res, 500, { success: false, message: e?.message || 'login failed' });
    }
  });

  /** ======================================================
   *  5) POST /api/auth/logout（玩家登出）
   * ====================================================== */
  router.post('/auth/logout', auth.requireUserAuth, (req: any, res) => {
    try {
      const token = String(req.user?.token || '').trim();
      if (!token) return safeJson(res, 400, { success: false, message: 'token missing' });
      db.prepare(`UPDATE user_sessions SET revokedAt = CURRENT_TIMESTAMP, lastSeenAt = CURRENT_TIMESTAMP WHERE token = ?`).run(token);
      return safeJson(res, 200, { success: true });
    } catch (e: any) {
      return safeJson(res, 500, { success: false, message: e?.message || 'logout failed' });
    }
  });

  /** ======================================================
   *  6) POST /api/admin/auth/login（管理员登录）
   * ====================================================== */
  router.post('/admin/auth/login', (req, res) => {
    try {
      const body = req.body || {};
      const codeInput = normalizeName(body.entryCode ?? body.code ?? body.adminCode ?? body.password);
      const adminNameInput = normalizeName(body.adminName ?? body.name ?? '');

      const serverCode = normalizeName(process.env.ADMIN_ENTRY_CODE || '');
      if (!serverCode) {
        return safeJson(res, 500, { success: false, message: '服务端未配置 ADMIN_ENTRY_CODE' });
      }
      if (!codeInput || codeInput !== serverCode) {
        return safeJson(res, 401, { success: false, message: '管理员入口码错误' });
      }
      if (!adminNameInput) {
        return safeJson(res, 400, { success: false, message: '请输入管理员名字' });
      }

      // 数据库白名单：支持“管理员名字/代号”双入口，命中后统一回填真实管理员名字
      let adminName = adminNameInput;
      const dbWhitelist = db.prepare(`
        SELECT name, code_name
        FROM admin_whitelist
        WHERE enabled = 1
      `).all() as AnyRow[];
      if (dbWhitelist.length > 0) {
        const matched = dbWhitelist.find((x) => {
          const n = String(x.name || '').trim();
          const c = String(x.code_name || '').trim();
          return n === adminNameInput || (!!c && c === adminNameInput);
        });
        if (!matched) {
          return safeJson(res, 403, { success: false, message: '不在管理员白名单' });
        }
        adminName = String(matched.name || adminNameInput).trim() || adminNameInput;
      }

      // 可选白名单：ADMIN_WHITELIST=alice,bob（兼容真实名/输入名）
      const whitelistRaw = normalizeName(process.env.ADMIN_WHITELIST || '');
      if (whitelistRaw) {
        const allow = new Set(whitelistRaw.split(',').map(s => s.trim()).filter(Boolean));
        if (allow.size > 0 && !allow.has(adminName) && !allow.has(adminNameInput)) {
          return safeJson(res, 403, { success: false, message: '不在管理员白名单' });
        }
      }

      // 保证管理员用户有一条记录（便于审计）
      let adminUser = getUserByName(adminName);
      if (!adminUser) {
        db.prepare(
          `INSERT INTO users(name, role, status, age, gold, job, physicalRank, mentalRank, currentLocation, homeLocation, createdAt, updatedAt)
           VALUES (?, '普通人', 'approved', 18, 0, '管理员', '无', '无', '', '', ?, ?)`
        ).run(adminName, nowIso(), nowIso());
        adminUser = getUserByName(adminName);
      }

      // 管理员也执行“一人一皮”：同账号新会话顶掉旧会话
      db.prepare(`UPDATE user_sessions SET revokedAt = CURRENT_TIMESTAMP WHERE userId = ? AND role='admin' AND revokedAt IS NULL`)
        .run(Number(adminUser!.id));

      const token = issueSessionToken(Number(adminUser!.id), adminName, 'admin');

      return safeJson(res, 200, {
        success: true,
        token,
        adminName,
        adminAvatarUrl: adminUser?.adminAvatarUrl || '',
        user: mapUser(adminUser)
      });
    } catch (e: any) {
      return safeJson(res, 500, { success: false, message: e?.message || 'admin login failed' });
    }
  });

  /** ======================================================
   *  6.1) GET /api/admin/whitelist（管理员白名单）
   * ====================================================== */
  router.get('/admin/whitelist', requireAdmin, (_req, res) => {
    try {
      const rows = db.prepare(`
        SELECT name, code_name, enabled, createdAt
        FROM admin_whitelist
        ORDER BY id ASC
      `).all() as AnyRow[];
      return safeJson(res, 200, {
        success: true,
        rows: rows.map((x) => ({
          name: String(x.name || ''),
          code_name: String(x.code_name || ''),
          enabled: Number(x.enabled || 0) ? 1 : 0,
          createdAt: String(x.createdAt || '')
        }))
      });
    } catch (e: any) {
      return safeJson(res, 500, { success: false, message: e?.message || 'query whitelist failed', rows: [] });
    }
  });

  /** ======================================================
   *  6.2) POST /api/admin/whitelist（新增/启用管理员白名单）
   * ====================================================== */
  router.post('/admin/whitelist', requireAdmin, (req: any, res) => {
    try {
      const name = normalizeName(req.body?.name);
      const codeName = normalizeName(req.body?.codeName ?? req.body?.code_name ?? '');
      if (!name) return safeJson(res, 400, { success: false, message: 'name required' });
      if (codeName) {
        const dup = db.prepare(`
          SELECT name
          FROM admin_whitelist
          WHERE code_name = ? AND name <> ?
          LIMIT 1
        `).get(codeName, name) as AnyRow | undefined;
        if (dup) {
          return safeJson(res, 400, { success: false, message: `管理员代号已被 ${String(dup.name || '')} 使用` });
        }
      }

      db.prepare(`
        INSERT INTO admin_whitelist(name, code_name, enabled, createdAt)
        VALUES(?, ?, 1, ?)
        ON CONFLICT(name)
        DO UPDATE SET code_name=excluded.code_name, enabled=1
      `).run(name, codeName || null, nowIso());

      const adminName = String(req.admin?.userName || 'admin');
      writeAdminLog(db, adminName, `编辑管理员白名单：新增 ${name}`, 'admin_whitelist', name, {
        name,
        codeName: codeName || null
      });

      return safeJson(res, 200, {
        success: true,
        message: `管理员 ${adminName} 编辑了管理员名单：新增 ${name}`
      });
    } catch (e: any) {
      return safeJson(res, 500, { success: false, message: e?.message || 'add whitelist failed' });
    }
  });

  /** ======================================================
   *  6.3) DELETE /api/admin/whitelist/:name（删除管理员白名单）
   * ====================================================== */
  router.delete('/admin/whitelist/:name', requireAdmin, (req: any, res) => {
    try {
      const name = normalizeName(req.params.name);
      if (!name) return safeJson(res, 400, { success: false, message: 'name required' });
      if (name === '塔') {
        return safeJson(res, 400, { success: false, message: '固定管理员不可删除' });
      }

      const info = db.prepare(`DELETE FROM admin_whitelist WHERE name = ?`).run(name);
      if (!info.changes) return safeJson(res, 404, { success: false, message: '管理员不在白名单中' });

      const adminName = String(req.admin?.userName || 'admin');
      writeAdminLog(db, adminName, `编辑管理员白名单：删除 ${name}`, 'admin_whitelist', name);

      return safeJson(res, 200, {
        success: true,
        message: `管理员 ${adminName} 编辑了管理员名单：删除 ${name}`
      });
    } catch (e: any) {
      return safeJson(res, 500, { success: false, message: e?.message || 'delete whitelist failed' });
    }
  });

  /** ======================================================
   *  6.4) PUT /api/admin/profile/avatar（管理员头像）
   * ====================================================== */
  router.put('/admin/profile/avatar', requireAdmin, (req: any, res) => {
    try {
      const adminUserId = Number(req.admin?.userId || 0);
      if (!adminUserId) return safeJson(res, 400, { success: false, message: 'invalid admin user' });

      const avatarRaw = req.body?.avatarUrl;
      const avatarUrl = typeof avatarRaw === 'string' ? avatarRaw.trim() : '';
      db.prepare(`UPDATE users SET adminAvatarUrl = ?, updatedAt = ? WHERE id = ?`)
        .run(avatarUrl || null, nowIso(), adminUserId);

      const adminName = String(req.admin?.userName || 'admin');
      writeAdminLog(db, adminName, '更新管理员头像', 'admin_profile', String(adminUserId), {
        hasAvatar: !!avatarUrl
      });

      return safeJson(res, 200, {
        success: true,
        adminAvatarUrl: avatarUrl || '',
        avatarUrl: avatarUrl || '',
        message: `管理员 ${adminName} 编辑了头像`
      });
    } catch (e: any) {
      return safeJson(res, 500, { success: false, message: e?.message || 'update admin avatar failed' });
    }
  });

  /** ======================================================
   *  6.5) GET /api/admin/online（后台在线管理员）
   * ====================================================== */
  router.get('/admin/online', requireAdmin, (_req, res) => {
    try {
      const rows = db.prepare(`
        SELECT
          s.userId,
          s.userName AS adminName,
          MAX(COALESCE(s.lastSeenAt, s.createdAt)) AS lastSeenAt,
          MAX(COALESCE(u.adminAvatarUrl, '')) AS avatarUrl
        FROM user_sessions s
        LEFT JOIN users u ON u.id = s.userId
        WHERE s.role = 'admin' AND s.revokedAt IS NULL
        GROUP BY s.userId, s.userName
        ORDER BY datetime(lastSeenAt) DESC, s.userId DESC
      `).all() as AnyRow[];

      return safeJson(res, 200, {
        success: true,
        admins: rows.map((x) => ({
          userId: Number(x.userId || 0),
          userName: String(x.adminName || ''),
          adminName: String(x.adminName || ''),
          adminAvatarUrl: String(x.avatarUrl || ''),
          avatarUrl: String(x.avatarUrl || ''),
          lastSeenAt: String(x.lastSeenAt || ''),
          isOnline: true
        }))
      });
    } catch (e: any) {
      return safeJson(res, 500, { success: false, message: e?.message || 'query online admins failed', admins: [] });
    }
  });

  /** ======================================================
   *  6.6) GET /api/admin/action-logs（管理员操作日志）
   * ====================================================== */
  router.get('/admin/action-logs', requireAdmin, (req, res) => {
    try {
      const limit = Math.max(1, Math.min(500, Number(req.query.limit || 120)));
      const rows = db.prepare(`
        SELECT id, adminName, action, targetType, targetId, detail, createdAt
        FROM admin_action_logs
        ORDER BY id DESC
        LIMIT ?
      `).all(limit) as AnyRow[];

      return safeJson(res, 200, {
        success: true,
        logs: rows.map((x) => ({
          id: Number(x.id || 0),
          adminName: String(x.adminName || ''),
          action: String(x.action || ''),
          targetType: String(x.targetType || ''),
          targetId: String(x.targetId || ''),
          detail: tryParseJson(x.detail),
          createdAt: String(x.createdAt || '')
        }))
      });
    } catch (e: any) {
      return safeJson(res, 500, { success: false, message: e?.message || 'query action logs failed', logs: [] });
    }
  });

  /** ======================================================
   *  6) GET /api/admin/users（审核列表）
   * ====================================================== */
  router.get('/admin/users', requireAdmin, (req, res) => {
    try {
      const status = normalizeName(req.query.status || '');
      let rows: AnyRow[] = [];
      if (status) {
        rows = db.prepare(`SELECT * FROM users WHERE status = ? ORDER BY id DESC`).all(status) as AnyRow[];
      } else {
        rows = db.prepare(`SELECT * FROM users ORDER BY id DESC`).all() as AnyRow[];
      }
      return safeJson(res, 200, { success: true, users: rows.map(mapUser) });
    } catch (e: any) {
      return safeJson(res, 500, { success: false, message: e?.message || 'query admin users failed', users: [] });
    }
  });

  /** ======================================================
   *  7) POST /api/admin/users/:id/status（审核通过/驳回）
   * ====================================================== */
  router.post('/admin/users/:id/status', requireAdmin, (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!id) return safeJson(res, 400, { success: false, message: 'invalid user id' });

      const user = getUserById(id);
      if (!user) return safeJson(res, 404, { success: false, message: 'user not found' });

      const status = normalizeAdminStatus(req.body?.status, String(user.status || 'pending'));
      const reason = normalizeName(req.body?.reason ?? '');
      const adminName = String((req as any).admin?.userName || 'admin');
      if (status === 'banned') {
        db.prepare(`UPDATE users SET status = ?, forceOfflineAt = ?, updatedAt = ? WHERE id = ?`)
          .run(status, nowIso(), nowIso(), id);
      } else {
        db.prepare(`UPDATE users SET status = ?, updatedAt = ? WHERE id = ?`)
          .run(status, nowIso(), id);
      }

      const updated = getUserById(id);
      writeAdminLog(db, adminName, `编辑玩家状态 ${user.name} -> ${status}`, 'user', String(id), {
        from: String(user.status || ''),
        to: status,
        reason
      });

      return safeJson(res, 200, {
        success: true,
        message: `管理员 ${adminName} 编辑了玩家状态：${status}`,
        reason,
        user: mapUser(updated)
      });
    } catch (e: any) {
      return safeJson(res, 500, { success: false, message: e?.message || 'update user status failed' });
    }
  });

  /** ======================================================
   *  7.1) PUT /api/admin/users/:id（管理员编辑角色）
   * ====================================================== */
  router.put('/admin/users/:id', requireAdmin, async (req: any, res) => {
    try {
      const id = Number(req.params.id || 0);
      if (!id) return safeJson(res, 400, { success: false, message: 'invalid user id' });
      const user = getUserById(id);
      if (!user) return safeJson(res, 404, { success: false, message: 'user not found' });

      const body = req.body || {};
      const age = Number(body.age ?? user.age ?? 16);
      const gold = Number(body.gold ?? user.gold ?? 0);
      const role = normalizeRoleByAge(age, normalizeRole(body.role ?? user.role ?? '未分化'));
      const status = normalizeAdminStatus(body.status ?? user.status, String(user.status || 'pending'));
      const name = normalizeName(body.name ?? user.name);
      if (!name) return safeJson(res, 400, { success: false, message: 'name required' });

      const dup = db.prepare(`SELECT id FROM users WHERE name = ? AND id <> ? LIMIT 1`).get(name, id) as AnyRow | undefined;
      if (dup) return safeJson(res, 400, { success: false, message: 'name already exists' });

      const nextHome = resolveHomeLocationByRule(age, gold, role, body.homeLocation ?? user.homeLocation);
      const nextCurrentLocation = String(body.currentLocation ?? user.currentLocation ?? '').trim() || nextHome;
      const nextJob = normalizeJob(body.job ?? user.job ?? '无');
      const nextPhysicalRank = String(body.physicalRank ?? user.physicalRank ?? '无').trim() || '无';
      const nextMentalRank = String(body.mentalRank ?? user.mentalRank ?? '无').trim() || '无';
      const nextFaction = String(body.faction ?? user.faction ?? '').trim();
      const nextAbility = String(body.ability ?? user.ability ?? '').trim();
      const nextSpiritName = String(body.spiritName ?? user.spiritName ?? '').trim();
      const nextProfileText = String(body.profileText ?? user.profileText ?? '').trim();
      const nextDeathDescription = String(body.deathDescription ?? user.deathDescription ?? '').trim();
      const nextIsHidden = Number(body.isHidden ?? user.isHidden ?? 0) ? 1 : 0;
      const hasPasswordField = Object.prototype.hasOwnProperty.call(body, 'password');
      const rawPassword = hasPasswordField ? String(body.password ?? '') : '';
      let passwordAction: 'unchanged' | 'cleared' | 'updated' = 'unchanged';
      let nextLoginPasswordHash: string | null = null;
      if (hasPasswordField) {
        const trimmedPassword = rawPassword.trim();
        if (!trimmedPassword) {
          passwordAction = 'cleared';
          nextLoginPasswordHash = null;
        } else {
          if (trimmedPassword.length < 4) {
            return safeJson(res, 400, { success: false, message: '全局账号密码至少 4 位' });
          }
          nextLoginPasswordHash = await hashPassword(trimmedPassword);
          passwordAction = 'updated';
        }
      }

      db.prepare(`
        UPDATE users
        SET name = ?,
            role = ?,
            status = ?,
            age = ?,
            gold = ?,
            job = ?,
            physicalRank = ?,
            mentalRank = ?,
            faction = ?,
            ability = ?,
            spiritName = ?,
            profileText = ?,
            deathDescription = ?,
            isHidden = ?,
            currentLocation = ?,
            homeLocation = ?,
            updatedAt = ?
        WHERE id = ?
      `).run(
        name,
        role,
        status,
        age,
        gold,
        nextJob,
        nextPhysicalRank,
        nextMentalRank,
        nextFaction,
        nextAbility,
        nextSpiritName,
        nextProfileText,
        nextDeathDescription,
        nextIsHidden,
        nextCurrentLocation,
        nextHome,
        nowIso(),
        id
      );

      if (hasPasswordField) {
        db.prepare(`UPDATE users SET loginPasswordHash = ?, password = NULL, updatedAt = ? WHERE id = ?`)
          .run(nextLoginPasswordHash, nowIso(), id);
      }

      if (status === 'banned') {
        db.prepare(`UPDATE users SET forceOfflineAt = ?, updatedAt = ? WHERE id = ?`)
          .run(nowIso(), nowIso(), id);
      }

      const updated = getUserById(id);
      const adminName = String(req.admin?.userName || 'admin');
      writeAdminLog(db, adminName, `编辑玩家资料 ${name}`, 'user', String(id), {
        status,
        role,
        age,
        homeLocation: nextHome,
        passwordAction
      });

      return safeJson(res, 200, {
        success: true,
        message: `管理员 ${adminName} 编辑了玩家 ${name}`,
        user: mapUser(updated)
      });
    } catch (e: any) {
      return safeJson(res, 500, { success: false, message: e?.message || 'update admin user failed' });
    }
  });

  /** ======================================================
   *  7.2) DELETE /api/admin/users/:id（管理员删除角色）
   * ====================================================== */
  router.delete('/admin/users/:id', requireAdmin, (req: any, res) => {
    try {
      const id = Number(req.params.id || 0);
      if (!id) return safeJson(res, 400, { success: false, message: 'invalid user id' });
      const user = getUserById(id);
      if (!user) return safeJson(res, 404, { success: false, message: 'user not found' });

      const tx = db.transaction(() => {
        db.prepare(`DELETE FROM user_sessions WHERE userId = ?`).run(id);
        db.prepare(`DELETE FROM user_skills WHERE userId = ?`).run(id);
        db.prepare(`DELETE FROM inventory WHERE userId = ?`).run(id);
        db.prepare(`DELETE FROM notes WHERE ownerId = ? OR targetId = ?`).run(id, id);
        db.prepare(`DELETE FROM interaction_reports WHERE reporterId = ? OR targetId = ?`).run(id, id);
        db.prepare(`DELETE FROM interaction_report_votes WHERE adminUserId = ?`).run(id);
        db.prepare(`DELETE FROM party_requests WHERE fromUserId = ? OR toUserId = ? OR targetUserId = ?`).run(id, id, id);
        db.prepare(`DELETE FROM party_entanglements WHERE userAId = ? OR userBId = ?`).run(id, id);
        db.prepare(`DELETE FROM active_rp_members WHERE userId = ?`).run(id);
        db.prepare(`DELETE FROM active_rp_leaves WHERE userId = ?`).run(id);
        db.prepare(`DELETE FROM rp_mediation_invites WHERE invitedUserId = ? OR requestedByUserId = ?`).run(id, id);
        db.prepare(`DELETE FROM users WHERE id = ?`).run(id);
      });
      tx();

      const adminName = String(req.admin?.userName || 'admin');
      writeAdminLog(db, adminName, `删除玩家 ${String(user.name || id)}`, 'user', String(id));

      return safeJson(res, 200, {
        success: true,
        message: `管理员 ${adminName} 删除了玩家 #${id}`
      });
    } catch (e: any) {
      return safeJson(res, 500, { success: false, message: e?.message || 'delete admin user failed' });
    }
  });

  /** ======================================================
   *  8) 兼容：PUT /api/users/:id/home（地图入住）
   * ====================================================== */
  router.put('/users/:id/home', auth.requireUserAuth, (req: any, res) => {
    try {
      const id = Number(req.params.id);
      const locationId = String(req.body?.locationId || '').trim();
      if (!id || !locationId) {
        return safeJson(res, 400, { success: false, message: 'id/locationId required' });
      }

      const uid = Number(req.user?.id || 0);
      if (uid !== id) {
        return safeJson(res, 403, { success: false, message: '无权限修改他人家园' });
      }

      const user = getUserById(id);
      if (!user) return safeJson(res, 404, { success: false, message: 'user not found' });

      const allowHomes = new Set(['sanctuary', 'slums', 'rich_area']);
      if (!allowHomes.has(locationId)) {
        return safeJson(res, 400, { success: false, message: '仅支持在圣所/西区/东区安家' });
      }

      const isMinor = Number(user.age || 0) < 16 || String(user.role || '') === '未分化';
      if (isMinor && locationId !== 'sanctuary') {
        return safeJson(res, 400, { success: false, message: '未分化阶段家园固定在圣所' });
      }

      if (locationId === 'rich_area' && Number(user.gold || 0) <= 9999) {
        return safeJson(res, 400, { success: false, message: '东区安家需要资产高于 9999G' });
      }

      db.prepare(`UPDATE users SET homeLocation = ?, currentLocation = ?, updatedAt = ? WHERE id = ?`)
        .run(locationId, locationId, nowIso(), id);

      return safeJson(res, 200, { success: true });
    } catch (e: any) {
      return safeJson(res, 500, { success: false, message: e?.message || 'update home failed' });
    }
  });

  /** ======================================================
   *  9) 兼容：GET /api/users
   * ====================================================== */
  router.get('/users', (_req, res) => {
    try {
      const rows = db.prepare(`SELECT * FROM users ORDER BY id DESC`).all() as AnyRow[];
      return safeJson(res, 200, { success: true, users: rows.map(mapUser) });
    } catch (e: any) {
      return safeJson(res, 500, { success: false, message: e?.message || 'query users failed', users: [] });
    }
  });

  /** ======================================================
   *  10) 兼容：DELETE /api/users/:id
   * ====================================================== */
  router.delete('/users/:id', requireAdmin, (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!id) return safeJson(res, 400, { success: false, message: 'invalid user id' });

      const info = db.prepare(`DELETE FROM users WHERE id = ?`).run(id);
      if (!info.changes) return safeJson(res, 404, { success: false, message: 'user not found' });

      return safeJson(res, 200, { success: true });
    } catch (e: any) {
      return safeJson(res, 500, { success: false, message: e?.message || 'delete user failed' });
    }
  });

  return router;
}

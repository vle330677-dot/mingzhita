import { Router, Request, Response } from 'express';
import { AppContext } from '../types';
import { writeAdminLog } from '../utils/common';
import { hashPassword, verifyPassword } from '../middleware/auth';

type AnyRow = Record<string, any>;

const DEFAULT_ROLE = '未分化';
const DEFAULT_ROLE_ADULT = '普通人';
const DEFAULT_JOB = '无';
const DEFAULT_RANK = '无';
const HOME_LOCATION_SET = new Set(['sanctuary', 'slums', 'rich_area']);
const PLAYER_STATUS_SET = new Set(['pending', 'approved', 'rejected', 'banned']);
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

const nowIso = () => new Date().toISOString();

function normalizeName(v: any) {
  return String(v ?? '').trim();
}

function normalizeStatus(v: any) {
  const s = normalizeName(v);
  if (PLAYER_STATUS_SET.has(s)) return s;
  return 'pending';
}

function normalizeAdminStatus(v: any, fallback = 'pending') {
  const s = normalizeName(v);
  if (ADMIN_STATUS_SET.has(s)) return s;
  return fallback;
}

function normalizeRole(v: any) {
  const s = normalizeName(v);
  return s || DEFAULT_ROLE;
}

function normalizeJob(v: any) {
  const s = normalizeName(v);
  return s || DEFAULT_JOB;
}

function normalizeRank(v: any) {
  const s = normalizeName(v);
  return s || DEFAULT_RANK;
}

function parseEditableAge(v: any, fallbackRaw: any = 16) {
  if (v === undefined || v === null || String(v).trim() === '') {
    const fallback = Number(fallbackRaw ?? 16);
    return Number.isInteger(fallback) && fallback >= 0 ? fallback : 16;
  }
  const age = Number(v);
  if (!Number.isInteger(age) || age < 0 || age > 999) return null;
  return age;
}

function normalizeRoleByAge(ageRaw: any, roleRaw: any) {
  const age = Number(ageRaw ?? 0);
  const role = normalizeName(roleRaw);
  if (role === '鬼魂' || role.toLowerCase() === 'ghost') return '鬼魂';
  if (age < 16) return DEFAULT_ROLE;
  if (!role || role === DEFAULT_ROLE) return DEFAULT_ROLE_ADULT;
  return role;
}

function resolveHomeLocationByRule(ageRaw: any, goldRaw: any, roleRaw: any, preferredRaw?: any) {
  const age = Number(ageRaw ?? 0);
  const gold = Number(goldRaw ?? 0);
  const role = normalizeName(roleRaw);
  const preferred = normalizeName(preferredRaw);

  if (role === DEFAULT_ROLE || age < 16) return 'sanctuary';

  if (HOME_LOCATION_SET.has(preferred as any)) {
    if (preferred === 'rich_area' && gold <= 9999) return 'slums';
    if (preferred === 'sanctuary') return gold > 9999 ? 'rich_area' : 'slums';
    return preferred;
  }

  return gold > 9999 ? 'rich_area' : 'slums';
}

function normalizeLongText(v: any, fallback = '') {
  if (v === undefined || v === null) return fallback;
  return String(v).replace(/\r\n/g, '\n');
}

function safeJson(res: Response, code: number, body: any) {
  return res.status(code).json(body);
}

function deleteByIds(db: any, table: string, column: string, ids: Array<number | string>) {
  const clean = ids
    .map((x) => (typeof x === 'number' ? x : String(x).trim()))
    .filter((x) => x !== '' && x !== 0);
  if (!clean.length) return;
  const placeholders = clean.map(() => '?').join(', ');
  db.prepare(`DELETE FROM ${table} WHERE ${column} IN (${placeholders})`).run(...clean);
}

function deleteCustomGameCascadeInTx(db: any, gameId: number) {
  const mapIds = (db.prepare(`SELECT id FROM custom_game_maps WHERE game_id = ?`).all(gameId) as AnyRow[])
    .map((row) => Number(row.id || 0))
    .filter((id) => id > 0);
  const runIds = (db.prepare(`SELECT id FROM custom_game_runs WHERE game_id = ?`).all(gameId) as AnyRow[])
    .map((row) => Number(row.id || 0))
    .filter((id) => id > 0);
  const gameTaskIds = (db.prepare(`
    SELECT id
    FROM review_tasks
    WHERE target_type = 'game'
      AND target_id = ?
      AND module_key IN ('custom_idea', 'custom_start')
  `).all(String(gameId)) as AnyRow[])
    .map((row) => Number(row.id || 0))
    .filter((id) => id > 0);
  const mapTaskIds = mapIds.length
    ? (db.prepare(`
        SELECT id
        FROM review_tasks
        WHERE target_type = 'map'
          AND module_key = 'custom_map'
          AND target_id IN (${mapIds.map(() => '?').join(', ')})
      `).all(...mapIds.map(String)) as AnyRow[])
        .map((row) => Number(row.id || 0))
        .filter((id) => id > 0)
    : [];
  const taskIds = [...gameTaskIds, ...mapTaskIds];

  deleteByIds(db, 'review_votes', 'task_id', taskIds);
  deleteByIds(db, 'review_tasks', 'id', taskIds);
  db.prepare(`DELETE FROM custom_game_reviews WHERE game_id = ?`).run(gameId);
  deleteByIds(db, 'custom_game_reviews', 'map_id', mapIds);
  db.prepare(`DELETE FROM custom_game_votes WHERE game_id = ?`).run(gameId);
  deleteByIds(db, 'custom_game_run_events', 'run_id', runIds);
  deleteByIds(db, 'custom_game_run_players', 'run_id', runIds);
  db.prepare(`DELETE FROM custom_game_runs WHERE game_id = ?`).run(gameId);
  db.prepare(`DELETE FROM custom_game_maps WHERE game_id = ?`).run(gameId);
  db.prepare(`DELETE FROM custom_games WHERE id = ?`).run(gameId);
}

function cleanupDeletedUserCustomGameData(db: any, userId: number) {
  try {
    const gameIds = (db.prepare(`SELECT id FROM custom_games WHERE creator_user_id = ?`).all(userId) as AnyRow[])
      .map((row) => Number(row.id || 0))
      .filter((id) => id > 0);
    for (const gameId of gameIds) {
      deleteCustomGameCascadeInTx(db, gameId);
    }

    db.prepare(`DELETE FROM custom_game_votes WHERE user_id = ?`).run(userId);
    db.prepare(`DELETE FROM custom_game_run_players WHERE user_id = ?`).run(userId);
    db.prepare(`DELETE FROM custom_game_player_stats WHERE user_id = ?`).run(userId);
    db.prepare(`DELETE FROM custom_game_reviews WHERE reviewer_user_id = ?`).run(userId);

    const creatorTaskIds = (db.prepare(`SELECT id FROM review_tasks WHERE creator_user_id = ?`).all(userId) as AnyRow[])
      .map((row) => Number(row.id || 0))
      .filter((id) => id > 0);
    deleteByIds(db, 'review_votes', 'task_id', creatorTaskIds);
    deleteByIds(db, 'review_tasks', 'id', creatorTaskIds);
  } catch {
    // Custom-game tables may be absent during early bootstrap.
  }
}

export function createCoreRouter(ctx: AppContext) {
  const router = Router();
  const db = ctx.db;
  const auth = ctx.auth;
  const runtime = ctx.runtime;

  function ensureTables() {
    db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE,
        age INTEGER DEFAULT 18,
        role TEXT,
        faction TEXT,
        mentalRank TEXT,
        physicalRank TEXT,
        gold INTEGER DEFAULT 0,
        ability TEXT,
        spiritName TEXT,
        spiritType TEXT,
        avatarUrl TEXT,
        avatarUpdatedAt TEXT,
        status TEXT DEFAULT 'pending',
        deathDescription TEXT,
        profileText TEXT,
        isHidden INTEGER DEFAULT 0,
        currentLocation TEXT,
        homeLocation TEXT,
        job TEXT DEFAULT '无',
        hp INTEGER DEFAULT 100,
        maxHp INTEGER DEFAULT 100,
        mp INTEGER DEFAULT 100,
        maxMp INTEGER DEFAULT 100,
        mentalProgress REAL DEFAULT 0,
        physicalProgress REAL DEFAULT 0,
        workCount INTEGER DEFAULT 0,
        trainCount INTEGER DEFAULT 0,
        password TEXT,
        loginPasswordHash TEXT,
        roomPasswordHash TEXT,
        roomBgImage TEXT,
        roomDescription TEXT,
        allowVisit INTEGER DEFAULT 1,
        roomVisible INTEGER DEFAULT 1,
        fury INTEGER DEFAULT 0,
        guideStability INTEGER DEFAULT 100,
        partyId TEXT DEFAULT NULL,
        adminAvatarUrl TEXT,
        forceOfflineAt TEXT,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS user_sessions (
        token TEXT PRIMARY KEY,
        userId INTEGER NOT NULL,
        userName TEXT NOT NULL,
        role TEXT DEFAULT 'player',
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        lastSeenAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        revokedAt DATETIME
      );

      CREATE TABLE IF NOT EXISTS admin_whitelist (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        code_name TEXT,
        enabled INTEGER DEFAULT 1,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS admin_action_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        adminName TEXT NOT NULL,
        action TEXT NOT NULL,
        targetType TEXT,
        targetId TEXT,
        detail TEXT,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    const ensureColumn = (table: string, column: string, definition: string) => {
      const cols = db.prepare(`PRAGMA table_info(${table})`).all() as AnyRow[];
      if (!cols.some((row) => String(row.name || '') === column)) {
        db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`).run();
      }
    };

    ensureColumn('users', 'faction', `TEXT DEFAULT ''`);
    ensureColumn('users', 'ability', `TEXT DEFAULT ''`);
    ensureColumn('users', 'spiritName', `TEXT DEFAULT ''`);
    ensureColumn('users', 'spiritType', `TEXT DEFAULT ''`);
    ensureColumn('users', 'avatarUrl', `TEXT DEFAULT ''`);
    ensureColumn('users', 'avatarUpdatedAt', `TEXT`);
    ensureColumn('users', 'deathDescription', `TEXT DEFAULT ''`);
    ensureColumn('users', 'profileText', `TEXT DEFAULT ''`);
    ensureColumn('users', 'isHidden', `INTEGER DEFAULT 0`);
    ensureColumn('users', 'currentLocation', `TEXT DEFAULT ''`);
    ensureColumn('users', 'homeLocation', `TEXT DEFAULT ''`);
    ensureColumn('users', 'job', `TEXT DEFAULT '无'`);
    ensureColumn('users', 'hp', `INTEGER DEFAULT 100`);
    ensureColumn('users', 'maxHp', `INTEGER DEFAULT 100`);
    ensureColumn('users', 'mp', `INTEGER DEFAULT 100`);
    ensureColumn('users', 'maxMp', `INTEGER DEFAULT 100`);
    ensureColumn('users', 'erosionLevel', `INTEGER DEFAULT 0`);
    ensureColumn('users', 'bleedingLevel', `INTEGER DEFAULT 0`);
    ensureColumn('users', 'mentalProgress', `REAL DEFAULT 0`);
    ensureColumn('users', 'physicalProgress', `REAL DEFAULT 0`);
    ensureColumn('users', 'workCount', `INTEGER DEFAULT 0`);
    ensureColumn('users', 'trainCount', `INTEGER DEFAULT 0`);
    ensureColumn('users', 'password', `TEXT`);
    ensureColumn('users', 'loginPasswordHash', `TEXT`);
    ensureColumn('users', 'roomPasswordHash', `TEXT`);
    ensureColumn('users', 'roomBgImage', `TEXT DEFAULT ''`);
    ensureColumn('users', 'roomDescription', `TEXT DEFAULT ''`);
    ensureColumn('users', 'allowVisit', `INTEGER DEFAULT 1`);
    ensureColumn('users', 'roomVisible', `INTEGER DEFAULT 1`);
    ensureColumn('users', 'fury', `INTEGER DEFAULT 0`);
    ensureColumn('users', 'guideStability', `INTEGER DEFAULT 100`);
    ensureColumn('users', 'partyId', `TEXT DEFAULT NULL`);
    ensureColumn('users', 'adminAvatarUrl', `TEXT DEFAULT ''`);
    ensureColumn('users', 'forceOfflineAt', `TEXT`);
    ensureColumn('users', 'createdAt', `DATETIME DEFAULT CURRENT_TIMESTAMP`);
    ensureColumn('users', 'updatedAt', `DATETIME DEFAULT CURRENT_TIMESTAMP`);

    db.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS idx_users_name ON users(name)`).run();
    db.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions(token)`).run();
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_user_sessions_user_role ON user_sessions(userId, role, revokedAt)`).run();
    db.prepare(`
      INSERT OR IGNORE INTO admin_whitelist(name, code_name, enabled)
      VALUES ('塔', 'tower_admin', 1)
    `).run();
  }

  ensureTables();

  const tableExists = (tableName: string) => {
    const row = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name = ?`).get(tableName) as AnyRow | undefined;
    return !!row;
  };

  const runIfTableExists = (tableName: string, sql: string, params: any[] = []) => {
    if (!tableExists(tableName)) return;
    db.prepare(sql).run(...params);
  };

  function getUserByName(name: string) {
    return db.prepare(`SELECT * FROM users WHERE name = ? LIMIT 1`).get(name) as AnyRow | undefined;
  }

  function getUserById(id: number) {
    return db.prepare(`SELECT * FROM users WHERE id = ? LIMIT 1`).get(id) as AnyRow | undefined;
  }

  function issueSessionToken(userId: number, userName: string, role: 'player' | 'admin') {
    const token = auth.issueToken();
    db.prepare(`
      INSERT INTO user_sessions(token, userId, userName, role, revokedAt, lastSeenAt, createdAt)
      VALUES (?, ?, ?, ?, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).run(token, userId, userName, role);
    return token;
  }

  function syncUserHome(user: AnyRow | undefined | null) {
    if (!user) return user;
    const nextHome = resolveHomeLocationByRule(user.age, user.gold, user.role, user.homeLocation);
    const prevHome = normalizeName(user.homeLocation);
    const prevCurrent = normalizeName(user.currentLocation);
    if (nextHome === prevHome) return user;

    const nextCurrent = !prevCurrent || prevCurrent === prevHome ? nextHome : prevCurrent;
    db.prepare(`UPDATE users SET homeLocation = ?, currentLocation = ?, updatedAt = ? WHERE id = ?`)
      .run(nextHome, nextCurrent, nowIso(), Number(user.id));
    return getUserById(Number(user.id)) || user;
  }

  function mapUser(u: AnyRow | undefined | null) {
    if (!u) return null;
    return {
      id: Number(u.id || 0),
      name: String(u.name || ''),
      role: normalizeRole(u.role),
      faction: String(u.faction || ''),
      mentalRank: normalizeRank(u.mentalRank),
      physicalRank: normalizeRank(u.physicalRank),
      gold: Number(u.gold ?? 0),
      ability: String(u.ability || ''),
      spiritName: String(u.spiritName || ''),
      spiritType: String(u.spiritType || ''),
      spiritIntimacy: Number(u.spiritIntimacy ?? 0),
      spiritLevel: Number(u.spiritLevel ?? 1),
      spiritImageUrl: String(u.spiritImageUrl || ''),
      spiritAppearance: String(u.spiritAppearance || ''),
      avatarUrl: String(u.avatarUrl || ''),
      avatarUpdatedAt: u.avatarUpdatedAt || null,
      adminAvatarUrl: String(u.adminAvatarUrl || ''),
      status: normalizeAdminStatus(u.status, 'pending') as any,
      deathDescription: String(u.deathDescription || ''),
      profileText: String(u.profileText || ''),
      age: Number(u.age ?? 16),
      isHidden: Number(u.isHidden ?? 0),
      currentLocation: String(u.currentLocation || ''),
      homeLocation: String(u.homeLocation || ''),
      job: normalizeJob(u.job),
      hp: Number(u.hp ?? 100),
      maxHp: Number(u.maxHp ?? 100),
      mp: Number(u.mp ?? 100),
      maxMp: Number(u.maxMp ?? 100),
      erosionLevel: Number(u.erosionLevel ?? 0),
      bleedingLevel: Number(u.bleedingLevel ?? 0),
      mentalProgress: Number(u.mentalProgress ?? 0),
      physicalProgress: Number(u.physicalProgress ?? 0),
      workCount: Number(u.workCount ?? 0),
      trainCount: Number(u.trainCount ?? 0),
      fury: Number(u.fury ?? 0),
      guideStability: Number(u.guideStability ?? 100),
      partyId: u.partyId ?? null,
      gender: String(u.gender || ''),
      height: String(u.height || ''),
      orientation: String(u.orientation || ''),
      factionRole: String(u.factionRole || ''),
      personality: String(u.personality || ''),
      appearance: String(u.appearance || ''),
      clothing: String(u.clothing || ''),
      background: String(u.background || ''),
      roomBgImage: String(u.roomBgImage || ''),
      roomDescription: String(u.roomDescription || ''),
      allowVisit: Number(u.allowVisit ?? 1),
      roomVisible: Number(u.roomVisible ?? 1),
      hasLoginPassword: !!(u.loginPasswordHash || u.password),
      createdAt: u.createdAt || null,
      updatedAt: u.updatedAt || null,
    };
  }

  router.post('/users/init', (req, res) => {
    try {
      const name = normalizeName(req.body?.name ?? req.body?.userName);
      if (!name) return safeJson(res, 400, { success: false, message: 'name required' });

      const existed = syncUserHome(getUserByName(name));
      if (existed) {
        return safeJson(res, 200, { success: true, existed: true, user: mapUser(existed) });
      }

      const age = Number(req.body?.age ?? 15);
      const gold = Number(req.body?.gold ?? 0);
      const role = normalizeRoleByAge(age, req.body?.role ?? DEFAULT_ROLE);
      const status = normalizeStatus(req.body?.status ?? 'pending');
      const homeLocation = resolveHomeLocationByRule(age, gold, role, req.body?.homeLocation);
      const currentLocation = normalizeName(req.body?.currentLocation) || homeLocation;

      db.prepare(`
        INSERT INTO users(name, role, status, age, gold, job, physicalRank, mentalRank, currentLocation, homeLocation, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(name, role, status, age, gold, DEFAULT_JOB, DEFAULT_RANK, DEFAULT_RANK, currentLocation, homeLocation, nowIso(), nowIso());

      return safeJson(res, 200, {
        success: true,
        existed: false,
        user: mapUser(getUserByName(name))
      });
    } catch (e: any) {
      return safeJson(res, 500, { success: false, message: e?.message || 'init user failed' });
    }
  });

  router.post('/users', (req, res) => {
    try {
      const id = Number(req.body?.id ?? req.body?.userId ?? 0);
      const name = normalizeName(req.body?.name ?? req.body?.userName);
      let user = id > 0 ? getUserById(id) : undefined;
      if (!user && name) user = getUserByName(name);

      if (!user && !name) {
        return safeJson(res, 400, { success: false, message: 'id or name required' });
      }

      if (!user) {
        const createAge = Number(req.body?.age ?? 15);
        const createGold = Number(req.body?.gold ?? 0);
        const createRole = normalizeRoleByAge(createAge, req.body?.role ?? DEFAULT_ROLE);
        const createStatus = normalizeStatus(req.body?.status ?? 'pending');
        const createHome = resolveHomeLocationByRule(createAge, createGold, createRole, req.body?.homeLocation);
        const createCurrent = normalizeName(req.body?.currentLocation) || createHome;

        db.prepare(`
          INSERT INTO users(name, role, status, age, gold, job, physicalRank, mentalRank, faction, ability, spiritName, spiritType, currentLocation, homeLocation, profileText, createdAt, updatedAt)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          name,
          createRole,
          createStatus,
          createAge,
          createGold,
          normalizeJob(req.body?.job),
          normalizeRank(req.body?.physicalRank),
          normalizeRank(req.body?.mentalRank),
          normalizeName(req.body?.faction),
          normalizeName(req.body?.ability),
          normalizeName(req.body?.spiritName),
          normalizeName(req.body?.spiritType),
          createCurrent,
          createHome,
          normalizeLongText(req.body?.profileText, ''),
          nowIso(),
          nowIso()
        );
        user = getUserByName(name);
      } else {
        const nextAge = Number(req.body?.age ?? user.age ?? 16);
        const nextGold = Number(req.body?.gold ?? user.gold ?? 0);
        const nextRole = normalizeRoleByAge(nextAge, req.body?.role ?? user.role);
        const nextHome = resolveHomeLocationByRule(nextAge, nextGold, nextRole, req.body?.homeLocation ?? user.homeLocation);
        const nextCurrent = normalizeName(req.body?.currentLocation ?? user.currentLocation) || nextHome;

        db.prepare(`
          UPDATE users
          SET role = ?,
              status = ?,
              job = ?,
              age = ?,
              gold = ?,
              physicalRank = ?,
              mentalRank = ?,
              faction = ?,
              ability = ?,
              spiritName = ?,
              spiritType = ?,
              currentLocation = ?,
              homeLocation = ?,
              profileText = ?,
              updatedAt = ?
          WHERE id = ?
        `).run(
          nextRole,
          normalizeStatus(req.body?.status ?? user.status),
          normalizeJob(req.body?.job ?? user.job),
          nextAge,
          nextGold,
          normalizeRank(req.body?.physicalRank ?? user.physicalRank),
          normalizeRank(req.body?.mentalRank ?? user.mentalRank),
          normalizeName(req.body?.faction ?? user.faction),
          normalizeName(req.body?.ability ?? user.ability),
          normalizeName(req.body?.spiritName ?? user.spiritName),
          normalizeName(req.body?.spiritType ?? user.spiritType),
          nextCurrent,
          nextHome,
          normalizeLongText(req.body?.profileText, String(user.profileText || '')),
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

  router.get('/users', (_req, res) => {
    try {
      const rows = db.prepare(`SELECT * FROM users ORDER BY id DESC`).all() as AnyRow[];
      return safeJson(res, 200, { success: true, users: rows.map(mapUser) });
    } catch (e: any) {
      return safeJson(res, 500, { success: false, message: e?.message || 'query users failed', users: [] });
    }
  });

  router.get('/users/:name', (req, res) => {
    try {
      const name = normalizeName(req.params.name);
      if (!name) return safeJson(res, 400, { success: false, message: 'name required' });

      const user = syncUserHome(getUserByName(name));
      return safeJson(res, 200, {
        success: true,
        exists: !!user,
        user: mapUser(user)
      });
    } catch (e: any) {
      return safeJson(res, 500, { success: false, message: e?.message || 'query user failed' });
    }
  });

  router.post('/auth/login', async (req, res) => {
    try {
      const name = normalizeName(req.body?.name ?? req.body?.userName);
      if (!name) return safeJson(res, 400, { success: false, message: 'name required' });

      const user = getUserByName(name);
      if (!user) return safeJson(res, 404, { success: false, message: '用户不存在，请先创建身份' });
      if (normalizeName(user.status) === 'banned') {
        return safeJson(res, 403, { success: false, message: '该账号已被封禁' });
      }

      let effectiveUser = syncUserHome(user) || user;
      const inputPassword = typeof req.body?.password === 'string' ? req.body.password : '';
      const loginPasswordHash = normalizeName(effectiveUser.loginPasswordHash);

      if (loginPasswordHash) {
        if (!inputPassword) {
          return safeJson(res, 401, { success: false, message: '该账号已设置密码，请输入密码' });
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

      db.prepare(`UPDATE user_sessions SET revokedAt = CURRENT_TIMESTAMP WHERE userId = ? AND role = 'player' AND revokedAt IS NULL`)
        .run(Number(effectiveUser.id));
      void runtime.publishUser(Number(effectiveUser.id), 'session.kicked', {
        userId: Number(effectiveUser.id),
        message: '\u8be5\u8d26\u53f7\u5df2\u5728\u5176\u4ed6\u8bbe\u5907\u767b\u5f55\uff0c\u4f60\u5df2\u88ab\u5f3a\u5236\u4e0b\u7ebf\u3002'
      });
      void runtime.removePresence(Number(effectiveUser.id));
      void runtime.publishBroadcast('presence.removed', { userId: Number(effectiveUser.id) });
      const token = issueSessionToken(Number(effectiveUser.id), String(effectiveUser.name), 'player');

      return safeJson(res, 200, {
        success: true,
        token,
        user: mapUser(effectiveUser)
      });
    } catch (e: any) {
      return safeJson(res, 500, { success: false, message: e?.message || 'login failed' });
    }
  });

  router.post('/auth/logout', auth.requireUserAuth, (req: Request, res) => {
    try {
      const token = auth.getBearerToken(req);
      if (token) {
        db.prepare(`UPDATE user_sessions SET revokedAt = CURRENT_TIMESTAMP WHERE token = ?`).run(token);
      }
      const userId = Number((req as any).user?.id || 0);
      if (userId) {
        void runtime.removePresence(userId);
        void runtime.publishBroadcast('presence.removed', { userId });
      }
      return safeJson(res, 200, { success: true });
    } catch (e: any) {
      return safeJson(res, 500, { success: false, message: e?.message || 'logout failed' });
    }
  });

  router.post('/admin/auth/login', (req, res) => {
    try {
      const codeInput = normalizeName(req.body?.entryCode ?? req.body?.code ?? req.body?.adminCode ?? req.body?.password);
      const adminNameInput = normalizeName(req.body?.adminName ?? req.body?.name);
      const serverCode = normalizeName(process.env.ADMIN_ENTRY_CODE || '');

      if (!serverCode) {
        return safeJson(res, 500, { success: false, message: '服务器未配置 ADMIN_ENTRY_CODE' });
      }
      if (!codeInput || codeInput !== serverCode) {
        return safeJson(res, 401, { success: false, message: '管理员入口码错误' });
      }
      if (!adminNameInput) {
        return safeJson(res, 400, { success: false, message: '请输入管理员名字' });
      }

      let adminName = adminNameInput;
      const whitelist = db.prepare(`SELECT name, code_name FROM admin_whitelist WHERE enabled = 1`).all() as AnyRow[];
      if (whitelist.length > 0) {
        const matched = whitelist.find((row) => {
          const name = normalizeName(row.name);
          const codeName = normalizeName(row.code_name);
          return name === adminNameInput || (!!codeName && codeName === adminNameInput);
        });
        if (!matched) {
          return safeJson(res, 403, { success: false, message: '不在管理员白名单中' });
        }
        adminName = normalizeName(matched.name) || adminNameInput;
      }

      const envWhitelistRaw = normalizeName(process.env.ADMIN_WHITELIST || '');
      if (envWhitelistRaw) {
        const envWhitelist = new Set(envWhitelistRaw.split(',').map((part) => part.trim()).filter(Boolean));
        if (!envWhitelist.has(adminName) && !envWhitelist.has(adminNameInput)) {
          return safeJson(res, 403, { success: false, message: '不在管理员白名单中' });
        }
      }

      let adminUser = getUserByName(adminName);
      if (!adminUser) {
        db.prepare(`
          INSERT INTO users(name, role, status, age, gold, job, physicalRank, mentalRank, currentLocation, homeLocation, createdAt, updatedAt)
          VALUES (?, ?, 'approved', 18, 0, ?, ?, ?, '', '', ?, ?)
        `).run(adminName, DEFAULT_ROLE_ADULT, '管理员', DEFAULT_RANK, DEFAULT_RANK, nowIso(), nowIso());
        adminUser = getUserByName(adminName);
      }

      db.prepare(`UPDATE user_sessions SET revokedAt = CURRENT_TIMESTAMP WHERE userId = ? AND role = 'admin' AND revokedAt IS NULL`)
        .run(Number(adminUser!.id));
      const token = issueSessionToken(Number(adminUser!.id), adminName, 'admin');

      return safeJson(res, 200, {
        success: true,
        token,
        adminName,
        adminAvatarUrl: String(adminUser?.adminAvatarUrl || ''),
        user: mapUser(adminUser)
      });
    } catch (e: any) {
      return safeJson(res, 500, { success: false, message: e?.message || 'admin login failed' });
    }
  });

  router.get('/admin/meta', auth.requireAdminAuth, (req: any, res) => {
    try {
      const currentAdminId = Number(req.admin?.userId || 0);
      const currentAdmin = getUserById(currentAdminId);
      const onlineAdmins = db.prepare(`
        SELECT DISTINCT
          u.id,
          u.name,
          u.adminAvatarUrl,
          s.lastSeenAt
        FROM user_sessions s
        JOIN users u ON u.id = s.userId
        WHERE s.role = 'admin'
          AND s.revokedAt IS NULL
          AND datetime(s.lastSeenAt) >= datetime('now', '-120 seconds')
        ORDER BY datetime(s.lastSeenAt) DESC, u.id DESC
      `).all() as AnyRow[];
      const whitelist = db.prepare(`
        SELECT name, code_name, enabled
        FROM admin_whitelist
        ORDER BY name ASC
      `).all() as AnyRow[];

      return safeJson(res, 200, {
        success: true,
        currentAdmin: currentAdmin
          ? {
              id: Number(currentAdmin.id || 0),
              name: String(currentAdmin.name || ''),
              adminAvatarUrl: String(currentAdmin.adminAvatarUrl || ''),
            }
          : null,
        onlineAdmins: onlineAdmins.map((row) => ({
          id: Number(row.id || 0),
          name: String(row.name || ''),
          adminAvatarUrl: String(row.adminAvatarUrl || ''),
          lastSeenAt: String(row.lastSeenAt || ''),
        })),
        whitelist: whitelist.map((row) => ({
          name: String(row.name || ''),
          codeName: String(row.code_name || ''),
          enabled: Number(row.enabled ?? 1) ? 1 : 0,
        })),
      });
    } catch (e: any) {
      return safeJson(res, 500, { success: false, message: e?.message || 'query admin meta failed' });
    }
  });

  router.post('/admin/whitelist', auth.requireAdminAuth, (req: any, res) => {
    try {
      const adminName = normalizeName(req.body?.name ?? req.body?.adminName);
      const codeName = normalizeName(req.body?.codeName ?? req.body?.code_name);
      const enabled = Number(req.body?.enabled ?? 1) ? 1 : 0;
      if (!adminName) {
        return safeJson(res, 400, { success: false, message: '请输入管理员名字' });
      }

      const existedByName = db.prepare(`
        SELECT id, name
        FROM admin_whitelist
        WHERE name = ?
        LIMIT 1
      `).get(adminName) as AnyRow | undefined;
      if (existedByName) {
        return safeJson(res, 400, { success: false, message: '该管理员已在白名单中' });
      }

      if (codeName) {
        const existedByCodeName = db.prepare(`
          SELECT id, code_name
          FROM admin_whitelist
          WHERE code_name = ?
          LIMIT 1
        `).get(codeName) as AnyRow | undefined;
        if (existedByCodeName) {
          return safeJson(res, 400, { success: false, message: '管理员代号已被占用' });
        }
      }

      const result = db.prepare(`
        INSERT INTO admin_whitelist(name, code_name, enabled, createdAt)
        VALUES (?, ?, ?, CURRENT_TIMESTAMP)
      `).run(adminName, codeName || null, enabled);

      const operatorName = String(req.admin?.name || 'admin');
      writeAdminLog(db, operatorName, `新增管理员白名单 ${adminName}`, 'admin_whitelist', String(result.lastInsertRowid), {
        name: adminName,
        codeName,
        enabled,
      });

      return safeJson(res, 200, {
        success: true,
        message: `管理员 ${operatorName} 已新增白名单管理员 ${adminName}`,
      });
    } catch (e: any) {
      return safeJson(res, 500, { success: false, message: e?.message || 'create admin whitelist failed' });
    }
  });

  router.put('/admin/profile', auth.requireAdminAuth, (req: any, res) => {
    try {
      const adminUserId = Number(req.admin?.userId || 0);
      if (!adminUserId) return safeJson(res, 400, { success: false, message: 'invalid admin user id' });

      const user = getUserById(adminUserId);
      if (!user) return safeJson(res, 404, { success: false, message: 'admin user not found' });

      const adminAvatarUrl = normalizeLongText(req.body?.adminAvatarUrl, String(user.adminAvatarUrl || ''));
      db.prepare(`
        UPDATE users
        SET adminAvatarUrl = ?, updatedAt = ?
        WHERE id = ?
      `).run(adminAvatarUrl, nowIso(), adminUserId);

      const updated = getUserById(adminUserId);
      return safeJson(res, 200, {
        success: true,
        message: `管理员 ${String(updated?.name || req.admin?.name || 'admin')} 已更新后台头像`,
        currentAdmin: updated
          ? {
              id: Number(updated.id || 0),
              name: String(updated.name || ''),
              adminAvatarUrl: String(updated.adminAvatarUrl || ''),
            }
          : null,
      });
    } catch (e: any) {
      return safeJson(res, 500, { success: false, message: e?.message || 'update admin profile failed' });
    }
  });

  router.get('/admin/users', auth.requireAdminAuth, (req: any, res) => {
    try {
      const status = normalizeName(req.query?.status);
      const rows = status
        ? (db.prepare(`SELECT * FROM users WHERE status = ? ORDER BY id DESC`).all(status) as AnyRow[])
        : (db.prepare(`SELECT * FROM users ORDER BY id DESC`).all() as AnyRow[]);
      return safeJson(res, 200, { success: true, users: rows.map(mapUser) });
    } catch (e: any) {
      return safeJson(res, 500, { success: false, message: e?.message || 'query admin users failed', users: [] });
    }
  });

  router.post('/admin/users/:id/status', auth.requireAdminAuth, (req: any, res) => {
    try {
      const id = Number(req.params.id || 0);
      if (!id) return safeJson(res, 400, { success: false, message: 'invalid user id' });

      const user = getUserById(id);
      if (!user) return safeJson(res, 404, { success: false, message: 'user not found' });

      const status = normalizeAdminStatus(req.body?.status, String(user.status || 'pending'));
      const reason = normalizeName(req.body?.reason);
      const updateSql = status === 'banned'
        ? `UPDATE users SET status = ?, forceOfflineAt = ?, updatedAt = ? WHERE id = ?`
        : `UPDATE users SET status = ?, updatedAt = ? WHERE id = ?`;
      const params = status === 'banned'
        ? [status, nowIso(), nowIso(), id]
        : [status, nowIso(), id];
      db.prepare(updateSql).run(...params);

      const updated = getUserById(id);
      const adminName = String(req.admin?.name || 'admin');
      writeAdminLog(db, adminName, `修改玩家状态 ${String(user.name || id)} -> ${status}`, 'user', String(id), {
        from: String(user.status || ''),
        to: status,
        reason,
      });

      return safeJson(res, 200, {
        success: true,
        message: `管理员 ${adminName} 已更新玩家状态为 ${status}`,
        reason,
        user: mapUser(updated)
      });
    } catch (e: any) {
      return safeJson(res, 500, { success: false, message: e?.message || 'update user status failed' });
    }
  });

  router.put('/admin/users/:id', auth.requireAdminAuth, async (req: any, res) => {
    try {
      const id = Number(req.params.id || 0);
      if (!id) return safeJson(res, 400, { success: false, message: 'invalid user id' });

      const user = getUserById(id);
      if (!user) return safeJson(res, 404, { success: false, message: 'user not found' });

      const body = req.body || {};
      const age = parseEditableAge(body.age, user.age ?? 16);
      if (age === null) {
        return safeJson(res, 400, { success: false, message: 'age must be an integer between 0 and 999' });
      }

      const name = normalizeName(body.name ?? user.name);
      if (!name) return safeJson(res, 400, { success: false, message: 'name required' });
      const dup = db.prepare(`SELECT id FROM users WHERE name = ? AND id <> ? LIMIT 1`).get(name, id) as AnyRow | undefined;
      if (dup) return safeJson(res, 400, { success: false, message: 'name already exists' });

      const gold = Number(body.gold ?? user.gold ?? 0);
      const role = normalizeRoleByAge(age, body.role ?? user.role);
      const status = normalizeAdminStatus(body.status ?? user.status, String(user.status || 'pending'));
      const homeLocation = resolveHomeLocationByRule(age, gold, role, body.homeLocation ?? user.homeLocation);
      const prevHomeLocation = normalizeName(user.homeLocation);
      const prevCurrentLocation = normalizeName(user.currentLocation);
      const currentLocationProvided = Object.prototype.hasOwnProperty.call(body, 'currentLocation');
      const requestedCurrentLocation = normalizeName(body.currentLocation);
      const currentLocation = !currentLocationProvided
        ? (!prevCurrentLocation || prevCurrentLocation === prevHomeLocation ? homeLocation : prevCurrentLocation)
        : (requestedCurrentLocation || homeLocation);
      const hasPasswordField = Object.prototype.hasOwnProperty.call(body, 'password');
      let nextLoginPasswordHash: string | null | undefined;
      let passwordAction: 'unchanged' | 'cleared' | 'updated' = 'unchanged';

      if (hasPasswordField) {
        const rawPassword = String(body.password ?? '').trim();
        if (!rawPassword) {
          nextLoginPasswordHash = null;
          passwordAction = 'cleared';
        } else {
          if (rawPassword.length < 4) {
            return safeJson(res, 400, { success: false, message: '账号密码至少需要 4 位' });
          }
          nextLoginPasswordHash = await hashPassword(rawPassword);
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
            spiritType = ?,
            profileText = ?,
            deathDescription = ?,
            isHidden = ?,
            currentLocation = ?,
            homeLocation = ?,
            avatarUrl = ?,
            updatedAt = ?
        WHERE id = ?
      `).run(
        name,
        role,
        status,
        age,
        gold,
        normalizeJob(body.job ?? user.job),
        normalizeRank(body.physicalRank ?? user.physicalRank),
        normalizeRank(body.mentalRank ?? user.mentalRank),
        normalizeName(body.faction ?? user.faction),
        normalizeName(body.ability ?? user.ability),
        normalizeName(body.spiritName ?? user.spiritName),
        normalizeName(body.spiritType ?? user.spiritType),
        normalizeLongText(body.profileText, String(user.profileText || '')),
        normalizeLongText(body.deathDescription, String(user.deathDescription || '')),
        Number(body.isHidden ?? user.isHidden ?? 0) ? 1 : 0,
        currentLocation,
        homeLocation,
        normalizeLongText(body.avatarUrl, String(user.avatarUrl || '')),
        nowIso(),
        id
      );

      if (hasPasswordField) {
        db.prepare(`UPDATE users SET loginPasswordHash = ?, password = NULL, updatedAt = ? WHERE id = ?`)
          .run(nextLoginPasswordHash, nowIso(), id);
      }
      if (status === 'banned') {
        db.prepare(`UPDATE users SET forceOfflineAt = ?, updatedAt = ? WHERE id = ?`).run(nowIso(), nowIso(), id);
      }

      const updated = getUserById(id);
      const adminName = String(req.admin?.name || 'admin');
      writeAdminLog(db, adminName, `编辑玩家资料 ${name}`, 'user', String(id), {
        status,
        role,
        age,
        gold,
        homeLocation,
        passwordAction,
      });

      return safeJson(res, 200, {
        success: true,
        message: `管理员 ${adminName} 已保存玩家资料`,
        user: mapUser(updated)
      });
    } catch (e: any) {
      return safeJson(res, 500, { success: false, message: e?.message || 'update admin user failed' });
    }
  });

  const deleteUserAndRelatedData = (id: number) => {
    const tx = db.transaction(() => {
      cleanupDeletedUserCustomGameData(db, id);
      runIfTableExists('user_sessions', `DELETE FROM user_sessions WHERE userId = ?`, [id]);
      runIfTableExists('user_skills', `DELETE FROM user_skills WHERE userId = ?`, [id]);
      runIfTableExists('user_inventory', `DELETE FROM user_inventory WHERE userId = ?`, [id]);
      runIfTableExists('inventory', `DELETE FROM inventory WHERE userId = ?`, [id]);
      runIfTableExists('notes', `DELETE FROM notes WHERE ownerId = ? OR targetId = ?`, [id, id]);
      runIfTableExists('interaction_reports', `DELETE FROM interaction_reports WHERE reporterId = ? OR targetId = ?`, [id, id]);
      runIfTableExists('interaction_report_votes', `DELETE FROM interaction_report_votes WHERE adminUserId = ?`, [id]);
      runIfTableExists('interaction_events', `DELETE FROM interaction_events WHERE userId = ? OR sourceUserId = ? OR targetUserId = ?`, [id, id, id]);
      runIfTableExists('interaction_skip_requests', `DELETE FROM interaction_skip_requests WHERE fromUserId = ? OR toUserId = ?`, [id, id]);
      runIfTableExists('interaction_trade_requests', `DELETE FROM interaction_trade_requests WHERE fromUserId = ? OR toUserId = ?`, [id, id]);
      runIfTableExists('interaction_trade_logs', `DELETE FROM interaction_trade_logs WHERE fromUserId = ? OR toUserId = ?`, [id, id]);
      runIfTableExists('interaction_trade_offers', `DELETE FROM interaction_trade_offers WHERE userId = ?`, [id]);
      runIfTableExists('interaction_trade_sessions', `DELETE FROM interaction_trade_sessions WHERE userAId = ? OR userBId = ?`, [id, id]);
      runIfTableExists('party_requests', `DELETE FROM party_requests WHERE fromUserId = ? OR toUserId = ? OR targetUserId = ?`, [id, id, id]);
      runIfTableExists('party_entanglements', `DELETE FROM party_entanglements WHERE userAId = ? OR userBId = ?`, [id, id]);
      runIfTableExists('active_rp_members', `DELETE FROM active_rp_members WHERE userId = ?`, [id]);
      runIfTableExists('active_rp_leaves', `DELETE FROM active_rp_leaves WHERE userId = ?`, [id]);
      runIfTableExists('active_group_rp_members', `DELETE FROM active_group_rp_members WHERE userId = ?`, [id]);
      runIfTableExists('rp_mediation_invites', `DELETE FROM rp_mediation_invites WHERE invitedUserId = ? OR requestedByUserId = ?`, [id, id]);
      runIfTableExists('demon_gamble_requests', `DELETE FROM demon_gamble_requests WHERE fromUserId = ? OR toUserId = ?`, [id, id]);
      runIfTableExists('rooms', `DELETE FROM rooms WHERE ownerId = ?`, [id]);
      db.prepare(`DELETE FROM users WHERE id = ?`).run(id);
    });
    tx();
  };

  const handleDeleteUser = (req: any, res: Response) => {
    try {
      const id = Number(req.params.id || 0);
      if (!id) return safeJson(res, 400, { success: false, message: 'invalid user id' });

      const user = getUserById(id);
      if (!user) return safeJson(res, 404, { success: false, message: 'user not found' });

      deleteUserAndRelatedData(id);
      const adminName = String(req.admin?.name || 'admin');
      writeAdminLog(db, adminName, `删除玩家 ${String(user.name || id)}`, 'user', String(id));

      return safeJson(res, 200, {
        success: true,
        message: `管理员 ${adminName} 已删除玩家 ${String(user.name || id)}`
      });
    } catch (e: any) {
      return safeJson(res, 500, { success: false, message: e?.message || 'delete admin user failed' });
    }
  };

  router.delete('/admin/users/:id', auth.requireAdminAuth, handleDeleteUser);
  router.delete('/users/:id', auth.requireAdminAuth, handleDeleteUser);

  router.put('/users/:id/home', auth.requireUserAuth, (req: any, res) => {
    try {
      const id = Number(req.params.id || 0);
      if (!id) return safeJson(res, 400, { success: false, message: 'invalid user id' });
      if (Number(req.user?.id || 0) !== id) {
        return safeJson(res, 403, { success: false, message: '只能修改自己的住处' });
      }

      const user = getUserById(id);
      if (!user) return safeJson(res, 404, { success: false, message: 'user not found' });

      const locationId = normalizeName(req.body?.locationId ?? req.body?.homeLocation);
      if (!HOME_LOCATION_SET.has(locationId as any)) {
        return safeJson(res, 400, { success: false, message: 'invalid home location' });
      }

      const age = Number(user.age ?? 0);
      const gold = Number(user.gold ?? 0);
      const role = normalizeRole(user.role);
      if (locationId === 'sanctuary' && !(age < 16 || role === DEFAULT_ROLE)) {
        return safeJson(res, 403, { success: false, message: '圣所仅允许 16 岁以下未分化者入住' });
      }
      if (locationId === 'rich_area' && gold <= 9999) {
        return safeJson(res, 403, { success: false, message: '资产不足，无法入住东区' });
      }
      if (locationId === 'slums' && age < 16) {
        return safeJson(res, 403, { success: false, message: '未成年未分化者不能单独入住西区' });
      }

      const prevHome = normalizeName(user.homeLocation);
      const prevCurrent = normalizeName(user.currentLocation);
      const nextCurrent = !prevCurrent || prevCurrent === prevHome ? locationId : prevCurrent;
      db.prepare(`UPDATE users SET homeLocation = ?, currentLocation = ?, updatedAt = ? WHERE id = ?`)
        .run(locationId, nextCurrent, nowIso(), id);

      return safeJson(res, 200, {
        success: true,
        homeLocation: locationId,
        currentLocation: nextCurrent,
        user: mapUser(getUserById(id))
      });
    } catch (e: any) {
      return safeJson(res, 500, { success: false, message: e?.message || 'update home failed' });
    }
  });

  return router;
}


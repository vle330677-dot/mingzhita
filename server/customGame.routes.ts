import { Router, Request, Response, NextFunction } from "express";

type DB = any;

type AuthUser = {
  id: number;
  username?: string;
  nickname?: string;
  isAdmin?: boolean;
};

type ReviewModule = "custom_idea" | "custom_map" | "custom_start";

/** -------------------- DB Helpers -------------------- */
async function dbAll(db: DB, sql: string, params: any[] = []): Promise<any[]> {
  if (db?.prepare) {
    return db.prepare(sql).all(...params);
  }
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err: any, rows: any[]) => {
      if (err) return reject(err);
      resolve(rows || []);
    });
  });
}

async function dbGet(db: DB, sql: string, params: any[] = []): Promise<any | undefined> {
  if (db?.prepare) {
    return db.prepare(sql).get(...params);
  }
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err: any, row: any) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
}

async function dbRun(
  db: DB,
  sql: string,
  params: any[] = []
): Promise<{ lastID?: number; changes?: number }> {
  if (db?.prepare) {
    const info = db.prepare(sql).run(...params);
    return {
      lastID: Number(info?.lastInsertRowid || 0),
      changes: Number(info?.changes || 0),
    };
  }
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (this: any, err: any) {
      if (err) return reject(err);
      resolve({ lastID: this?.lastID, changes: this?.changes });
    });
  });
}

function toJson(v: any, fallback: any = null) {
  try {
    return JSON.stringify(v ?? fallback);
  } catch {
    return JSON.stringify(fallback);
  }
}

function fromJson<T = any>(v: any, fallback: T): T {
  if (v == null) return fallback;
  if (typeof v === "object") return v as T;
  try {
    return JSON.parse(v);
  } catch {
    return fallback;
  }
}

function now() {
  return new Date().toISOString();
}

const VOTE_ONLINE_WINDOW_SECONDS = 120;

function unwrapStoredMapData(raw: any) {
  const parsed = fromJson<any>(raw, {});
  if (!parsed || typeof parsed !== "object") {
    return { mapJson: {}, dropPointJson: {}, raw: {} };
  }
  const mapJson =
    parsed.mapJson && typeof parsed.mapJson === "object" ? parsed.mapJson : parsed;
  const dropPointJson =
    parsed.dropPointJson && typeof parsed.dropPointJson === "object" ? parsed.dropPointJson : {};
  return { mapJson, dropPointJson, raw: parsed };
}

function buildRunMapSnapshot(raw: any) {
  const { mapJson, dropPointJson } = unwrapStoredMapData(raw);
  const baseMap = mapJson && typeof mapJson === "object" ? mapJson : {};
  return {
    ...baseMap,
    dropPointJson,
  };
}

async function countEligibleVoteUsers(db: DB) {
  const row = await dbGet(
    db,
    `
      SELECT COUNT(DISTINCT s.userId) AS total
      FROM user_sessions s
      JOIN users u ON u.id = s.userId
      WHERE s.role = 'player'
        AND s.revokedAt IS NULL
        AND u.status IN ('approved', 'ghost')
        AND datetime(s.lastSeenAt) >= datetime('now', ?)
    `,
    [`-${VOTE_ONLINE_WINDOW_SECONDS} seconds`]
  );
  return Math.max(0, Number(row?.total || 0));
}

async function getVoteSnapshot(db: DB, gameId: number, userId?: number | null) {
  const counts = await dbGet(
    db,
    `
      SELECT
        SUM(CASE WHEN vote = 1 THEN 1 ELSE 0 END) AS yes_count,
        SUM(CASE WHEN vote = 0 THEN 1 ELSE 0 END) AS no_count
      FROM custom_game_votes
      WHERE game_id = ?
    `,
    [gameId]
  );

  const game = await dbGet(
    db,
    `
      SELECT status, vote_status, vote_opened_at, vote_ends_at
      FROM custom_games
      WHERE id = ?
      LIMIT 1
    `,
    [gameId]
  );

  const myVoteRow =
    userId && Number(userId)
      ? await dbGet(
          db,
          `SELECT vote FROM custom_game_votes WHERE game_id = ? AND user_id = ? LIMIT 1`,
          [gameId, Number(userId)]
        )
      : null;

  const yesCount = Number(counts?.yes_count || 0);
  const noCount = Number(counts?.no_count || 0);
  const castCount = yesCount + noCount;
  const onlineTotal = await countEligibleVoteUsers(db);
  const total = Math.max(onlineTotal, castCount);
  const voteEndsAt = game?.vote_ends_at ? String(game.vote_ends_at) : null;
  const nowMs = Date.now();
  const expired = !!voteEndsAt && Number.isFinite(Date.parse(voteEndsAt)) && Date.parse(voteEndsAt) <= nowMs;

  return {
    yesCount,
    noCount,
    total,
    castCount,
    onlineTotal,
    myVote: myVoteRow?.vote === 0 || myVoteRow?.vote === 1 ? Number(myVoteRow.vote) : null,
    voteStatus: String(game?.vote_status || "none"),
    gameStatus: String(game?.status || ""),
    voteOpenedAt: game?.vote_opened_at ? String(game.vote_opened_at) : null,
    voteEndsAt,
    expired,
  };
}

async function createCustomGameRun(db: DB, game: any, mapRow: any) {
  const existing = await getActiveRun(db, Number(game.id || 0));
  if (existing?.id) {
    return { runId: Number(existing.id), created: false };
  }

  const mapSnapshot = buildRunMapSnapshot(mapRow?.map_data);
  const stageConfigs = Array.isArray((mapSnapshot as any)?.stageConfigs)
    ? (mapSnapshot as any).stageConfigs
    : [];
  const totalStages = Math.max(
    1,
    Number((mapSnapshot as any)?.totalStages || stageConfigs.length || 3)
  );
  const ts = now();

  const ret = await dbRun(
    db,
    `
      INSERT INTO custom_game_runs(
        game_id, status, current_stage, total_stages, stage_configs, map_snapshot,
        creator_user_id, started_at, created_at, updated_at
      )
      VALUES (?, 'running', 1, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      Number(game.id || 0),
      totalStages,
      toJson(stageConfigs, []),
      toJson(mapSnapshot, {}),
      Number(game.creator_user_id || 0),
      ts,
      ts,
      ts,
    ]
  );

  const runId = Number(ret.lastID || 0);

  await dbRun(
    db,
    `UPDATE custom_games SET status = 'running', vote_status = 'passed', updated_at = ? WHERE id = ?`,
    [ts, Number(game.id || 0)]
  );

  await dbRun(
    db,
    `
      INSERT INTO custom_game_run_events(run_id, actor_user_id, event_type, message, payload, created_at)
      VALUES (?, NULL, 'run_start', ?, ?, ?)
    `,
    [
      runId,
      `副本 ${String(game.title || `#${game.id}`)} 已开启`,
      toJson(
        {
          gameId: Number(game.id || 0),
          mapId: Number(mapRow?.id || 0),
          mapName: String((mapSnapshot as any)?.mapName || ""),
        },
        {}
      ),
      ts,
    ]
  );

  await createAnnouncement(
    db,
    "game_start",
    `副本 ${String(game.title || `#${game.id}`)} 已开启`,
    `${String((mapSnapshot as any)?.mapName || "创作者地图")} 已开放进入。`,
    {
      gameId: Number(game.id || 0),
      runId,
      mapId: Number(mapRow?.id || 0),
      mapName: String((mapSnapshot as any)?.mapName || ""),
    }
  );

  return { runId, created: true };
}

function runDeleteByIds(db: DB, table: string, column: string, ids: Array<number | string>) {
  const clean = ids
    .map((x) => (typeof x === "number" ? x : String(x).trim()))
    .filter((x) => x !== "" && x !== 0);
  if (!clean.length) return 0;
  const placeholders = clean.map(() => "?").join(", ");
  const info = db.prepare(`DELETE FROM ${table} WHERE ${column} IN (${placeholders})`).run(...clean) as any;
  return Number(info?.changes || 0);
}

function deleteCustomGameCascade(db: DB, gameId: number, opts?: { allowRunning?: boolean }) {
  const allowRunning = !!opts?.allowRunning;
  const game = db.prepare(`SELECT id, title, status FROM custom_games WHERE id = ? LIMIT 1`).get(gameId) as any;
  if (!game) return { found: false, deleted: false, blocked: false, title: "", mapCount: 0, runCount: 0 };

  const activeRun = db.prepare(`
    SELECT id
    FROM custom_game_runs
    WHERE game_id = ? AND status = 'running'
    ORDER BY id DESC
    LIMIT 1
  `).get(gameId) as any;
  if (activeRun && !allowRunning) {
    return { found: true, deleted: false, blocked: true, title: String(game.title || ""), mapCount: 0, runCount: 0 };
  }

  const mapIds = (db.prepare(`SELECT id FROM custom_game_maps WHERE game_id = ?`).all(gameId) as any[])
    .map((row) => Number(row.id || 0))
    .filter((id) => id > 0);
  const runIds = (db.prepare(`SELECT id FROM custom_game_runs WHERE game_id = ?`).all(gameId) as any[])
    .map((row) => Number(row.id || 0))
    .filter((id) => id > 0);

  const gameTaskIds = (db.prepare(`
    SELECT id
    FROM review_tasks
    WHERE target_type = 'game'
      AND target_id = ?
      AND module_key IN ('custom_idea', 'custom_start')
  `).all(String(gameId)) as any[])
    .map((row) => Number(row.id || 0))
    .filter((id) => id > 0);
  const mapTaskIds = mapIds.length
    ? (db.prepare(`
        SELECT id
        FROM review_tasks
        WHERE target_type = 'map'
          AND module_key = 'custom_map'
          AND target_id IN (${mapIds.map(() => "?").join(", ")})
      `).all(...mapIds.map(String)) as any[])
        .map((row) => Number(row.id || 0))
        .filter((id) => id > 0)
    : [];
  const taskIds = [...gameTaskIds, ...mapTaskIds];

  const tx = db.transaction(() => {
    runDeleteByIds(db, "review_votes", "task_id", taskIds);
    runDeleteByIds(db, "review_tasks", "id", taskIds);
    db.prepare(`DELETE FROM custom_game_reviews WHERE game_id = ?`).run(gameId);
    runDeleteByIds(db, "custom_game_reviews", "map_id", mapIds);
    db.prepare(`DELETE FROM custom_game_votes WHERE game_id = ?`).run(gameId);
    runDeleteByIds(db, "custom_game_run_events", "run_id", runIds);
    runDeleteByIds(db, "custom_game_run_players", "run_id", runIds);
    db.prepare(`DELETE FROM custom_game_runs WHERE game_id = ?`).run(gameId);
    db.prepare(`DELETE FROM custom_game_maps WHERE game_id = ?`).run(gameId);
    db.prepare(`DELETE FROM custom_games WHERE id = ?`).run(gameId);
  });
  tx();

  return {
    found: true,
    deleted: true,
    blocked: false,
    title: String(game.title || ""),
    mapCount: mapIds.length,
    runCount: runIds.length,
  };
}

/** -------------------- Auth Helpers -------------------- */
function getBearerToken(req: any) {
  const h = req.headers?.authorization || "";
  if (!h.startsWith("Bearer ")) return "";
  return h.slice(7).trim();
}

function getReqUserFactory(db: DB) {
  return function getReqUser(req: any): AuthUser | null {
    // 1) 兼容已有的 req.user / session
    const u = req.user || req.session?.user;
    if (u?.id) {
      return {
        id: Number(u.id),
        username: u.username,
        nickname: u.nickname,
        isAdmin: !!u.isAdmin,
      };
    }

    // 2) Bearer Token，对接当前的 user_sessions
    const token = getBearerToken(req);
    if (token) {
      try {
        const row = db
          .prepare(
            `SELECT userId, userName, role
               FROM user_sessions
              WHERE token = ? AND revokedAt IS NULL
              LIMIT 1`
          )
          .get(token) as any;
        if (row?.userId) {
          return {
            id: Number(row.userId),
            username: row.userName,
            nickname: row.userName,
            isAdmin: String(row.role) === "admin",
          };
        }
      } catch {
        // ignore
      }
    }

    // 3) header 兜底，仅用于调试
    const id = Number(req.headers["x-user-id"]);
    if (!id) return null;
    return {
      id,
      username: String(req.headers["x-user-name"] || ""),
      nickname: String(req.headers["x-user-nickname"] || ""),
      isAdmin: String(req.headers["x-user-admin"] || "") === "1",
    };
  };
}

function requireAuthFactory(db: DB) {
  const getReqUser = getReqUserFactory(db);
  return (req: Request, res: Response, next: NextFunction) => {
    const user = getReqUser(req);
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    (req as any).authUser = user;
    next();
  };
}

function requireAdminFactory(db: DB) {
  const getReqUser = getReqUserFactory(db);
  return (req: Request, res: Response, next: NextFunction) => {
    const user = getReqUser(req);
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    if (!user.isAdmin) return res.status(403).json({ message: "Admin only" });
    (req as any).authUser = user;
    next();
  };
}

/** -------------------- Announcement Helper -------------------- */
async function createAnnouncement(
  db: DB,
  type: "vote_open" | "game_start" | "custom_game_result",
  title: string,
  content: string,
  payload: any
) {
  const payloadJson = toJson(payload, {});
  // 鍏煎涓嶅悓 announcements 琛ㄧ粨鏋?
  try {
    await dbRun(
      db,
      `INSERT INTO announcements(type, title, content, extraJson, payload, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [type, title, content, payloadJson, payloadJson, now()]
    );
    return;
  } catch {
    // fallback
  }

  try {
    await dbRun(
      db,
      `INSERT INTO announcements(type, title, content, extraJson, createdAt)
       VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      [type, title, content, payloadJson]
    );
    return;
  } catch {
    // fallback
  }

  await dbRun(
    db,
    `INSERT INTO announcements(type, title, content, payload, created_at)
     VALUES (?, ?, ?, ?, ?)`,
    [type, title, content, payloadJson, now()]
  );
}

async function ensureColumn(db: DB, table: string, column: string, typeSql: string) {
  if (!/^[a-zA-Z0-9_]+$/.test(table) || !/^[a-zA-Z0-9_]+$/.test(column)) return;
  try {
    await dbRun(db, `ALTER TABLE ${table} ADD COLUMN ${column} ${typeSql}`);
  } catch {
    // ignore duplicate column / unsupported alter error
  }
}

async function tableExists(db: DB, tableName: string) {
  try {
    const row = await dbGet(
      db,
      `SELECT name FROM sqlite_master WHERE type='table' AND name = ?`,
      [tableName]
    );
    return !!row?.name;
  } catch {
    return false;
  }
}

async function buildPlayerWorldSnapshot(db: DB, userId: number) {
  const user = await dbGet(
    db,
    `
      SELECT
        id, name, age, role, faction, mentalRank, physicalRank, gold, ability,
        spiritName, spiritType, spiritIntimacy, spiritLevel, spiritImageUrl, spiritAppearance,
        avatarUrl, status, deathDescription, profileText, currentLocation, homeLocation, job,
        hp, maxHp, mp, maxMp, mentalProgress, workCount, trainCount, fury, guideStability, partyId
      FROM users
      WHERE id = ?
      LIMIT 1
    `,
    [userId]
  );

  const inventory = (await tableExists(db, "inventory"))
    ? await dbAll(
        db,
        `
          SELECT name, description, qty, itemType, effectValue
          FROM inventory
          WHERE userId = ?
          ORDER BY id ASC
        `,
        [userId]
      )
    : [];

  const skills = (await tableExists(db, "user_skills"))
    ? await dbAll(
        db,
        `
          SELECT
            us.skillId,
            us.level,
            s.name,
            s.faction,
            s.tier
          FROM user_skills us
          LEFT JOIN skills s ON s.id = us.skillId
          WHERE us.userId = ?
          ORDER BY us.id ASC
        `,
        [userId]
      )
    : [];

  const guildBank =
    (await tableExists(db, "guild_bank_accounts"))
      ? await dbGet(
          db,
          `
            SELECT balance, lastInterestDate
            FROM guild_bank_accounts
            WHERE userId = ?
            LIMIT 1
          `,
          [userId]
        )
      : null;

  return {
    capturedAt: now(),
    user: user || null,
    inventory,
    skills,
    guildBank: guildBank || null,
  };
}

function formatSettlementAnnouncement(gameTitle: string, mapName: string, rank: Array<{ rank: number; name: string; score: number }>) {
  const header = `${gameTitle} 已结算，地图【${mapName || "未命名地图"}】本局排名如下：`;
  if (!Array.isArray(rank) || rank.length === 0) {
    return `${header}\n本局暂无有效积分记录。`;
  }
  const topLines = rank.slice(0, 10).map((item) => `#${item.rank} ${item.name} ${item.score}分`);
  return `${header}\n${topLines.join("\n")}`;
}

/** -------------------- Review Quorum (for custom game) -------------------- */
async function ensureReviewQuorumTables(db: DB) {
  const ddl = [
    `CREATE TABLE IF NOT EXISTS review_rules (
      module_key TEXT PRIMARY KEY,
      required_approvals INTEGER NOT NULL DEFAULT 2,
      updated_at TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS review_tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      module_key TEXT NOT NULL,
      target_type TEXT NOT NULL,
      target_id TEXT NOT NULL,
      creator_user_id INTEGER,
      status TEXT NOT NULL DEFAULT 'pending', -- pending/approved/rejected
      payload_json TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(module_key, target_type, target_id)
    )`,
    `CREATE TABLE IF NOT EXISTS review_votes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL,
      admin_id INTEGER NOT NULL,
      admin_name TEXT NOT NULL,
      decision TEXT NOT NULL, -- approve/reject
      comment TEXT,
      created_at TEXT NOT NULL,
      UNIQUE(task_id, admin_id)
    )`,
  ];
  for (const x of ddl) await dbRun(db, x);

  // 单管理员即可决议，默认 required_approvals = 1
  // 使用 UPSERT 确保旧记录也会被刷新
  const defaults: Array<[ReviewModule, number]> = [
    ["custom_idea", 1],
    ["custom_map", 1],
    ["custom_start", 1],
  ];
  for (const [k, n] of defaults) {
    await dbRun(
      db,
      `INSERT INTO review_rules(module_key, required_approvals, updated_at)
       VALUES (?, ?, ?)
       ON CONFLICT(module_key) DO UPDATE SET
         required_approvals = excluded.required_approvals,
         updated_at = excluded.updated_at`,
      [k, n, now()]
    );
  }
}

async function getRequiredApprovals(db: DB, moduleKey: ReviewModule) {
  const r = await dbGet(db, `SELECT required_approvals FROM review_rules WHERE module_key = ?`, [moduleKey]);
  return Math.max(1, Number(r?.required_approvals || 1));
}

async function setRequiredApprovals(db: DB, moduleKey: ReviewModule, required: number) {
  const n = Math.max(1, Number(required || 1));
  await dbRun(
    db,
    `INSERT INTO review_rules(module_key, required_approvals, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(module_key) DO UPDATE SET
       required_approvals = excluded.required_approvals,
       updated_at = excluded.updated_at`,
    [moduleKey, n, now()]
  );
}

async function ensureReviewTask(db: DB, opts: {
  moduleKey: ReviewModule;
  targetType: string;
  targetId: string | number;
  creatorUserId?: number | null;
  payload?: any;
}) {
  const { moduleKey, targetType, targetId, creatorUserId = null, payload = null } = opts;
  let task = await dbGet(
    db,
    `SELECT * FROM review_tasks
      WHERE module_key = ? AND target_type = ? AND target_id = ?`,
    [moduleKey, targetType, String(targetId)]
  );
  if (!task) {
    const ret = await dbRun(
      db,
      `INSERT INTO review_tasks(
        module_key, target_type, target_id, creator_user_id, status, payload_json, created_at, updated_at
      ) VALUES (?, ?, ?, ?, 'pending', ?, ?, ?)`,
      [moduleKey, targetType, String(targetId), creatorUserId, toJson(payload, null), now(), now()]
    );
    task = await dbGet(db, `SELECT * FROM review_tasks WHERE id = ?`, [ret.lastID]);
  }
  return task;
}

async function voteAndJudge(db: DB, opts: {
  moduleKey: ReviewModule;
  targetType: string;
  targetId: string | number;
  creatorUserId?: number | null;
  payload?: any;
  adminId: number;
  adminName: string;
  decision: "approve" | "reject";
  comment?: string;
}) {
  const task = await ensureReviewTask(db, opts);
  const required = await getRequiredApprovals(db, opts.moduleKey);

  if (task.status !== "pending") {

    return {
      taskId: Number(task.id),
      done: true,
      status: task.status,
      approveCount: 0,
      rejectCount: 0,
      required,
    };
  }

  // 当 required > 1 时，发起人不能给自己审核；单管理员模式下允许直接裁决
  if (required > 1 && task.creator_user_id && Number(task.creator_user_id) === Number(opts.adminId)) {
    throw new Error("creator cannot self-review");
  }

  await dbRun(
    db,
    `INSERT INTO review_votes(task_id, admin_id, admin_name, decision, comment, created_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(task_id, admin_id) DO UPDATE SET
       decision = excluded.decision,
       comment = excluded.comment,
       created_at = excluded.created_at`,
    [task.id, opts.adminId, opts.adminName, opts.decision, opts.comment || null, now()]
  );

  const c = await dbGet(
    db,
    `SELECT
       SUM(CASE WHEN decision='approve' THEN 1 ELSE 0 END) AS approve_count,
       SUM(CASE WHEN decision='reject' THEN 1 ELSE 0 END) AS reject_count
     FROM review_votes
     WHERE task_id = ?`,
    [task.id]
  );

  const approveCount = Number(c?.approve_count || 0);
  const rejectCount = Number(c?.reject_count || 0);

  let finalStatus: "pending" | "approved" | "rejected" = "pending";
  if (approveCount >= required) finalStatus = "approved";
  else if (rejectCount >= required) finalStatus = "rejected";

  if (finalStatus !== "pending") {
    await dbRun(
      db,
      `UPDATE review_tasks SET status = ?, updated_at = ? WHERE id = ?`,
      [finalStatus, now(), task.id]
    );
  }

  return {
    taskId: Number(task.id),
    done: finalStatus !== "pending",
    status: finalStatus,
    approveCount,
    rejectCount,
    required,
  };
}

/** -------------------- Custom Game Tables -------------------- */
async function ensureTables(db: DB) {
  const ddlList = [
    `CREATE TABLE IF NOT EXISTS custom_games (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      idea_text TEXT,
      status TEXT NOT NULL DEFAULT 'idea_pending',
      creator_user_id INTEGER NOT NULL,
      vote_status TEXT DEFAULT 'none',
      vote_opened_at TEXT,
      vote_ends_at TEXT,
      current_map_id INTEGER,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS custom_game_maps (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      game_id INTEGER NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      map_data TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      creator_user_id INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS custom_game_reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      game_id INTEGER,
      map_id INTEGER,
      review_type TEXT NOT NULL, -- idea | map | start
      status TEXT NOT NULL,      -- approved | rejected
      reviewer_user_id INTEGER NOT NULL,
      comment TEXT,
      created_at TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS custom_game_votes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      game_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      vote INTEGER NOT NULL, -- 1/0
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(game_id, user_id)
    )`,
    `CREATE TABLE IF NOT EXISTS custom_game_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      game_id INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'running', -- running | ended
      current_stage INTEGER NOT NULL DEFAULT 1,
      total_stages INTEGER NOT NULL DEFAULT 3,
      stage_configs TEXT, -- JSON
      map_snapshot TEXT,  -- JSON
      creator_user_id INTEGER NOT NULL,
      started_at TEXT NOT NULL,
      ended_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS custom_game_run_players (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      hp INTEGER NOT NULL DEFAULT 100,
      energy INTEGER NOT NULL DEFAULT 100,
      score INTEGER NOT NULL DEFAULT 0,
      alive INTEGER NOT NULL DEFAULT 1,
      joined_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(run_id, user_id)
    )`,
    `CREATE TABLE IF NOT EXISTS custom_game_run_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id INTEGER NOT NULL,
      actor_user_id INTEGER,
      event_type TEXT NOT NULL,
      message TEXT NOT NULL,
      payload TEXT,
      created_at TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS custom_game_player_stats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL UNIQUE,
      total_points INTEGER NOT NULL DEFAULT 0,
      total_runs INTEGER NOT NULL DEFAULT 0,
      total_wins INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL
    )`,
  ];

  for (const ddl of ddlList) {
    await dbRun(db, ddl);
  }

  await ensureColumn(db, "custom_game_run_players", "world_snapshot", "TEXT");
  await ensureColumn(db, "custom_game_run_players", "returned_at", "TEXT");

  await dbRun(db, `CREATE INDEX IF NOT EXISTS idx_custom_games_creator ON custom_games(creator_user_id)`);
  await dbRun(db, `CREATE INDEX IF NOT EXISTS idx_custom_maps_game ON custom_game_maps(game_id)`);
  await dbRun(db, `CREATE INDEX IF NOT EXISTS idx_custom_runs_game_status ON custom_game_runs(game_id, status)`);
  await dbRun(db, `CREATE INDEX IF NOT EXISTS idx_custom_votes_game ON custom_game_votes(game_id)`);
}

/** -------------------- Runtime Helpers -------------------- */
async function getActiveRun(db: DB, gameId: number) {
  return dbGet(
    db,
    `SELECT * FROM custom_game_runs
      WHERE game_id = ? AND status = 'running'
      ORDER BY id DESC LIMIT 1`,
    [gameId]
  );
}

async function getLatestRunningRun(db: DB) {
  return dbGet(
    db,
    `SELECT r.*, g.title AS game_title
       FROM custom_game_runs r
       JOIN custom_games g ON g.id = r.game_id
      WHERE r.status = 'running'
      ORDER BY r.id DESC
      LIMIT 1`
  );
}

/** -------------------- Router -------------------- */
export function createCustomGameRouter(db: DB) {
  const router = Router();
  const getReqUser = getReqUserFactory(db);
  const requireAuth = requireAuthFactory(db);
  const requireAdmin = requireAdminFactory(db);

  ensureTables(db).catch((e) => console.error("[customGame] ensureTables error:", e));
  ensureReviewQuorumTables(db).catch((e) => console.error("[customGame] ensureReviewQuorumTables error:", e));

  /** ---------- 瀹℃牳闂ㄦ閰嶇疆 ---------- */
  router.get("/admin/review-rules", requireAdmin, async (_req, res) => {
    try {
      const rows = await dbAll(
        db,
        `SELECT module_key, required_approvals, updated_at
           FROM review_rules
          WHERE module_key IN ('custom_idea','custom_map','custom_start')
          ORDER BY module_key ASC`
      );
      res.json({ success: true, rules: rows });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e?.message || "query rules failed" });
    }
  });

  router.put("/admin/review-rules/:moduleKey", requireAdmin, async (req, res) => {
    try {
      const moduleKey = String(req.params.moduleKey) as ReviewModule;
      if (!["custom_idea", "custom_map", "custom_start"].includes(moduleKey)) {
        return res.status(400).json({ success: false, message: "invalid moduleKey" });
      }
      const n = Math.max(1, Number(req.body?.requiredApprovals || 1));
      await setRequiredApprovals(db, moduleKey, n);
      res.json({ success: true, moduleKey, requiredApprovals: n });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e?.message || "set rule failed" });
    }
  });

  /** -------------------- 鐜╁鍩虹 -------------------- */
  router.post("/", requireAuth, async (req, res) => {
    try {
      const user = (req as any).authUser as AuthUser;
      const title = String(req.body?.title || "").trim();
      const ideaText = String(req.body?.ideaText || "").trim();
      if (!title) return res.status(400).json({ message: "title required" });

      const ts = now();
      const r = await dbRun(
        db,
        `INSERT INTO custom_games(title, idea_text, status, creator_user_id, vote_status, created_at, updated_at)
         VALUES (?, ?, 'idea_pending', ?, 'none', ?, ?)`,
        [title, ideaText, user.id, ts, ts]
      );

      // 创建会签任务（创意）
      await ensureReviewTask(db, {
        moduleKey: "custom_idea",
        targetType: "game",
        targetId: Number(r.lastID),
        creatorUserId: user.id,
        payload: { title, ideaText },
      });

      res.json({ id: r.lastID, message: "created" });
    } catch (e: any) {
      res.status(500).json({ message: e?.message || "create failed" });
    }
  });

  router.get("/mine", requireAuth, async (req, res) => {
    try {
      const user = (req as any).authUser as AuthUser;
      const rows = await dbAll(
        db,
        `SELECT * FROM custom_games WHERE creator_user_id = ? ORDER BY id DESC`,
        [user.id]
      );
      res.json(rows);
    } catch (e: any) {
      res.status(500).json({ message: e?.message || "query failed" });
    }
  });

  /** -------------------- 瀹℃牳姹?-------------------- */
  router.get("/admin/review/ideas/pending", requireAdmin, async (_req, res) => {
    try {
      const rows = await dbAll(db, `SELECT * FROM custom_games WHERE status = 'idea_pending' ORDER BY id ASC`);
      res.json(rows);
    } catch (e: any) {
      res.status(500).json({ message: e?.message || "query failed" });
    }
  });

  // 鍒涙剰浼氱
  router.post("/admin/review/idea/:gameId", requireAdmin, async (req, res) => {
    try {
      const admin = (req as any).authUser as AuthUser;
      const gameId = Number(req.params.gameId);
      const approve = !!req.body?.approve;
      const comment = String(req.body?.comment || "");

      const game = await dbGet(db, `SELECT * FROM custom_games WHERE id = ?`, [gameId]);
      if (!game) return res.status(404).json({ message: "game not found" });

      const result = await voteAndJudge(db, {
        moduleKey: "custom_idea",
        targetType: "game",
        targetId: gameId,
        creatorUserId: Number(game.creator_user_id),
        payload: { gameId },
        adminId: admin.id,
        adminName: admin.nickname || admin.username || `U${admin.id}`,
        decision: approve ? "approve" : "reject",
        comment,
      });

      await dbRun(
        db,
        `INSERT INTO custom_game_reviews(game_id, map_id, review_type, status, reviewer_user_id, comment, created_at)
         VALUES (?, NULL, 'idea', ?, ?, ?, ?)`,
        [gameId, approve ? "approved" : "rejected", admin.id, comment, now()]
      );

      if (!result.done) {
        return res.json({
          message: `已记录审核票：通过 ${result.approveCount}/${result.required}，驳回 ${result.rejectCount}/${result.required}`,
          pending: true,
          ...result,
        });
      }

      const nextStatus = result.status === "approved" ? "idea_approved" : "idea_rejected";
      await dbRun(
        db,
        `UPDATE custom_games SET status = ?, updated_at = ? WHERE id = ?`,
        [nextStatus, now(), gameId]
      );

      res.json({ message: "final judged", pending: false, status: nextStatus, ...result });
    } catch (e: any) {
      res.status(500).json({ message: e?.message || "idea review failed" });
    }
  });

  router.get("/admin/review/maps/pending", requireAdmin, async (_req, res) => {
    try {
      const rows = await dbAll(
        db,
        `SELECT m.*, g.title AS game_title, g.creator_user_id AS game_creator_user_id
           FROM custom_game_maps m
           JOIN custom_games g ON g.id = m.game_id
          WHERE m.status = 'pending'
          ORDER BY m.id ASC`
      );
      res.json(rows);
    } catch (e: any) {
      res.status(500).json({ message: e?.message || "query failed" });
    }
  });

  // 鍦板浘浼氱
  router.post("/admin/review/map/:mapId", requireAdmin, async (req, res) => {
    try {
      const admin = (req as any).authUser as AuthUser;
      const mapId = Number(req.params.mapId);
      const approve = !!req.body?.approve;
      const comment = String(req.body?.comment || "");

      const map = await dbGet(
        db,
        `SELECT m.*, g.creator_user_id AS game_creator_user_id
           FROM custom_game_maps m
           JOIN custom_games g ON g.id = m.game_id
          WHERE m.id = ?`,
        [mapId]
      );
      if (!map) return res.status(404).json({ message: "map not found" });

      const result = await voteAndJudge(db, {
        moduleKey: "custom_map",
        targetType: "map",
        targetId: mapId,
        creatorUserId: Number(map.game_creator_user_id),
        payload: { gameId: Number(map.game_id), mapId },
        adminId: admin.id,
        adminName: admin.nickname || admin.username || `U${admin.id}`,
        decision: approve ? "approve" : "reject",
        comment,
      });

      await dbRun(
        db,
        `INSERT INTO custom_game_reviews(game_id, map_id, review_type, status, reviewer_user_id, comment, created_at)
         VALUES (?, ?, 'map', ?, ?, ?, ?)`,
        [map.game_id, mapId, approve ? "approved" : "rejected", admin.id, comment, now()]
      );

      if (!result.done) {
        return res.json({
          message: `已记录审核票：通过 ${result.approveCount}/${result.required}，驳回 ${result.rejectCount}/${result.required}`,
          pending: true,
          ...result,
        });
      }

      const finalMapStatus = result.status === "approved" ? "approved" : "rejected";
      await dbRun(
        db,
        `UPDATE custom_game_maps SET status = ?, updated_at = ? WHERE id = ?`,
        [finalMapStatus, now(), mapId]
      );

      if (result.status === "approved") {
        await dbRun(
          db,
          `UPDATE custom_games
              SET current_map_id = ?, status = 'ready_for_start', updated_at = ?
            WHERE id = ?`,
          [mapId, now(), map.game_id]
        );
      } else {
        await dbRun(
          db,
          `UPDATE custom_games
              SET status = 'map_rejected', updated_at = ?
            WHERE id = ?`,
          [now(), map.game_id]
        );
      }

      res.json({ message: "final judged", pending: false, mapStatus: finalMapStatus, ...result });
    } catch (e: any) {
      res.status(500).json({ message: e?.message || "map review failed" });
    }
  });

  router.get("/admin/review/start/pending", requireAdmin, async (_req, res) => {
    try {
      const rows = await dbAll(db, `SELECT * FROM custom_games WHERE status = 'start_pending' ORDER BY id ASC`);
      res.json(rows);
    } catch (e: any) {
      res.status(500).json({ message: e?.message || "query failed" });
    }
  });

  router.get("/admin/review/votes/queue", requireAdmin, async (_req, res) => {
    try {
      const rows = await dbAll(
        db,
        `
          SELECT *
          FROM custom_games
          WHERE status IN ('ready_for_start', 'ready_for_vote', 'vote_failed')
             OR vote_status = 'open'
          ORDER BY datetime(updated_at) DESC, id DESC
        `
      );
      res.json(rows);
    } catch (e: any) {
      res.status(500).json({ message: e?.message || "query failed" });
    }
  });

  router.delete("/admin/review/game/:gameId", requireAdmin, async (req, res) => {
    try {
      const gameId = Number(req.params.gameId || 0);
      if (!gameId) return res.status(400).json({ success: false, message: "invalid gameId" });

      const result = deleteCustomGameCascade(db, gameId, { allowRunning: false });
      if (!result.found) return res.status(404).json({ success: false, message: "game not found" });
      if (result.blocked) {
        return res.status(409).json({ success: false, message: "game is running and cannot be deleted now" });
      }

      return res.json({ success: true, message: "custom game deleted" });
    } catch (e: any) {
      return res.status(500).json({ success: false, message: e?.message || "delete custom game failed" });
    }
  });


  // 开局会签：通过后先进入 ready_for_vote，正式开局仍走 vote/open + close-and-judge
  router.post("/admin/review/start/:gameId", requireAdmin, async (req, res) => {
    try {
      const admin = (req as any).authUser as AuthUser;
      const gameId = Number(req.params.gameId);
      const approve = !!req.body?.approve;
      const comment = String(req.body?.comment || "");

      const game = await dbGet(db, `SELECT * FROM custom_games WHERE id = ?`, [gameId]);
      if (!game) return res.status(404).json({ message: "game not found" });
      if (game.status !== "start_pending") {
        return res.status(400).json({ message: "game not in start_pending" });
      }

      const result = await voteAndJudge(db, {
        moduleKey: "custom_start",
        targetType: "game",
        targetId: gameId,
        creatorUserId: Number(game.creator_user_id),
        payload: { gameId },
        adminId: admin.id,
        adminName: admin.nickname || admin.username || `U${admin.id}`,
        decision: approve ? "approve" : "reject",
        comment,
      });

      await dbRun(
        db,
        `INSERT INTO custom_game_reviews(game_id, map_id, review_type, status, reviewer_user_id, comment, created_at)
         VALUES (?, NULL, 'start', ?, ?, ?, ?)`,
        [gameId, approve ? "approved" : "rejected", admin.id, comment, now()]
      );

      if (!result.done) {
        return res.json({
          message: `已记录审核票：通过 ${result.approveCount}/${result.required}，驳回 ${result.rejectCount}/${result.required}`,
          pending: true,
          ...result,
        });
      }

      const finalStatus = result.status === "approved" ? "ready_for_vote" : "start_rejected";
      await dbRun(
        db,
        `UPDATE custom_games SET status = ?, updated_at = ? WHERE id = ?`,
        [finalStatus, now(), gameId]
      );

      res.json({ message: "final judged", pending: false, status: finalStatus, ...result });
    } catch (e: any) {
      res.status(500).json({ message: e?.message || "start review failed" });
    }
  });

  /** -------------------- 鍦板浘鎻愪氦/璇诲彇 -------------------- */
  router.post("/:id/map", requireAuth, async (req, res) => {
    try {
      const user = (req as any).authUser as AuthUser;
      const gameId = Number(req.params.id);
      const mapData = req.body?.mapData ?? {};

      const game = await dbGet(db, `SELECT * FROM custom_games WHERE id = ?`, [gameId]);
      if (!game) return res.status(404).json({ message: "game not found" });
      if (Number(game.creator_user_id) !== user.id) return res.status(403).json({ message: "only creator can submit map" });
      if (!["idea_approved", "ready_for_start", "map_rejected"].includes(String(game.status))) {
        return res.status(400).json({ message: "game status not allow map submit" });
      }

      const row = await dbGet(db, `SELECT COALESCE(MAX(version), 0) AS mv FROM custom_game_maps WHERE game_id = ?`, [gameId]);
      const nextVersion = Number(row?.mv || 0) + 1;

      const ts = now();
      const r = await dbRun(
        db,
        `INSERT INTO custom_game_maps(game_id, version, map_data, status, creator_user_id, created_at, updated_at)
         VALUES (?, ?, ?, 'pending', ?, ?, ?)`,
        [gameId, nextVersion, toJson(mapData, {}), user.id, ts, ts]
      );

      await dbRun(
        db,
        `UPDATE custom_games SET status = 'map_pending', updated_at = ? WHERE id = ?`,
        [ts, gameId]
      );

      // 寤轰换鍔?
      await ensureReviewTask(db, {
        moduleKey: "custom_map",
        targetType: "map",
        targetId: Number(r.lastID),
        creatorUserId: user.id,
        payload: { gameId, version: nextVersion },
      });

      res.json({ mapId: r.lastID, version: nextVersion, message: "map submitted" });
    } catch (e: any) {
      res.status(500).json({ message: e?.message || "submit map failed" });
    }
  });

  router.get("/:id/map/latest", requireAuth, async (req, res) => {
    try {
      const gameId = Number(req.params.id);
      const row = await dbGet(
        db,
        `SELECT * FROM custom_game_maps WHERE game_id = ? ORDER BY version DESC, id DESC LIMIT 1`,
        [gameId]
      );
      if (!row) return res.status(404).json({ message: "map not found" });
      row.map_data = fromJson(row.map_data, {});
      res.json(row);
    } catch (e: any) {
      res.status(500).json({ message: e?.message || "query map failed" });
    }
  });

  /** -------------------- 开局申请 -------------------- */
  router.post("/:id/start-request", requireAuth, async (req, res) => {
    try {
      const user = (req as any).authUser as AuthUser;
      const gameId = Number(req.params.id);

      const game = await dbGet(db, `SELECT * FROM custom_games WHERE id = ?`, [gameId]);
      if (!game) return res.status(404).json({ message: "game not found" });
      if (Number(game.creator_user_id) !== user.id) return res.status(403).json({ message: "only creator can request start" });
      if (game.status !== "ready_for_start") return res.status(400).json({ message: "not ready_for_start" });

      await dbRun(
        db,
        `UPDATE custom_games SET status = 'start_pending', updated_at = ? WHERE id = ?`,
        [now(), gameId]
      );

      // 创建审核任务
      await ensureReviewTask(db, {
        moduleKey: "custom_start",
        targetType: "game",
        targetId: gameId,
        creatorUserId: user.id,
        payload: { gameId },
      });

      res.json({ message: "start request submitted" });
    } catch (e: any) {
      res.status(500).json({ message: e?.message || "start request failed" });
    }
  });

  /** -------------------- 投票 -------------------- */
  router.post("/:id/vote/open", requireAdmin, async (req, res) => {
    try {
      const gameId = Number(req.params.id);
      const durationMinutes = Math.max(1, Number(req.body?.durationMinutes || 10));

      const game = await dbGet(db, `SELECT * FROM custom_games WHERE id = ?`, [gameId]);
      if (!game) return res.status(404).json({ message: "game not found" });

      // 只有会签通过后才能进入开局投票
      if (!["ready_for_vote", "ready_for_start", "vote_failed"].includes(String(game.status))) {
        return res.status(400).json({ message: "game not in ready_for_vote/ready_for_start/vote_failed" });
      }
      if (String(game.vote_status || "") === "open") {
        return res.status(400).json({ message: "vote already open" });
      }

      const openAt = now();
      const endAt = new Date(Date.now() + durationMinutes * 60 * 1000).toISOString();

      await dbRun(db, `DELETE FROM custom_game_votes WHERE game_id = ?`, [gameId]);

      await dbRun(
        db,
        `UPDATE custom_games
            SET status = 'ready_for_vote',
                vote_status = 'open',
                vote_opened_at = ?,
                vote_ends_at = ?,
                updated_at = ?
          WHERE id = ?`,
        [openAt, endAt, openAt, gameId]
      );

      await createAnnouncement(
        db,
        "vote_open",
        `副本 ${String(game.title || `#${gameId}`)} 已开启投票`,
        `请在 ${durationMinutes} 分钟内完成投票，结束后由管理员结算结果。`,
        { gameId, voteEndsAt: endAt, durationMinutes }
      );

      res.json({ message: "vote opened", voteEndsAt: endAt });
    } catch (e: any) {
      res.status(500).json({ message: e?.message || "close vote failed" });
    }
  });

  router.get("/:id/vote/status", async (req, res) => {
    try {
      const gameId = Number(req.params.id);
      const game = await dbGet(db, `SELECT id FROM custom_games WHERE id = ? LIMIT 1`, [gameId]);
      if (!game) return res.status(404).json({ message: "game not found" });

      const user = getReqUser(req);
      const snapshot = await getVoteSnapshot(db, gameId, user?.id);
      res.json(snapshot);
    } catch (e: any) {
      res.status(500).json({ message: e?.message || "vote status failed" });
    }
  });

  router.post("/:id/vote/cast", requireAuth, async (req, res) => {
    try {
      const user = (req as any).authUser as AuthUser;
      const gameId = Number(req.params.id);
      const vote = Number(req.body?.vote);
      if (vote !== 0 && vote !== 1) {
        return res.status(400).json({ message: "vote must be 0 or 1" });
      }

      const game = await dbGet(db, `SELECT * FROM custom_games WHERE id = ? LIMIT 1`, [gameId]);
      if (!game) return res.status(404).json({ message: "game not found" });
      if (String(game.vote_status || "") !== "open") {
        return res.status(400).json({ message: "vote is not open" });
      }
      if (game.vote_ends_at && Number.isFinite(Date.parse(String(game.vote_ends_at))) && Date.parse(String(game.vote_ends_at)) <= Date.now()) {
        return res.status(400).json({ message: "vote has ended" });
      }

      const ts = now();
      await dbRun(
        db,
        `
          INSERT INTO custom_game_votes(game_id, user_id, vote, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(game_id, user_id) DO UPDATE SET
            vote = excluded.vote,
            updated_at = excluded.updated_at
        `,
        [gameId, user.id, vote, ts, ts]
      );

      const snapshot = await getVoteSnapshot(db, gameId, user.id);
      res.json({ message: "vote cast", ...snapshot });
    } catch (e: any) {
      res.status(500).json({ message: e?.message || "vote cast failed" });
    }
  });

  router.post("/:id/vote/close-and-judge", requireAdmin, async (req, res) => {
    try {
      const gameId = Number(req.params.id);
      const game = await dbGet(db, `SELECT * FROM custom_games WHERE id = ? LIMIT 1`, [gameId]);
      if (!game) return res.status(404).json({ message: "game not found" });
      if (String(game.vote_status || "") !== "open") {
        return res.status(400).json({ message: "vote is not open" });
      }

      const snapshot = await getVoteSnapshot(db, gameId, null);
      const passed =
        snapshot.total > 0 ? snapshot.yesCount * 2 >= snapshot.total : snapshot.yesCount >= snapshot.noCount;
      const ts = now();

      if (!passed) {
        await dbRun(
          db,
          `
            UPDATE custom_games
            SET status = 'vote_failed',
                vote_status = 'rejected',
                vote_ends_at = ?,
                updated_at = ?
            WHERE id = ?
          `,
          [ts, ts, gameId]
        );
        return res.json({
          message: "vote rejected",
          passed: false,
          yesCount: snapshot.yesCount,
          noCount: snapshot.noCount,
          total: snapshot.total,
          voteStatus: "rejected",
        });
      }

      const mapId = Number(game.current_map_id || 0);
      const mapRow =
        (mapId
          ? await dbGet(db, `SELECT * FROM custom_game_maps WHERE id = ? LIMIT 1`, [mapId])
          : null) ||
        (await dbGet(
          db,
          `
            SELECT *
            FROM custom_game_maps
            WHERE game_id = ? AND status = 'approved'
            ORDER BY version DESC, id DESC
            LIMIT 1
          `,
          [gameId]
        ));

      if (!mapRow) {
        return res.status(400).json({ message: "approved map not found" });
      }

      await dbRun(
        db,
        `
          UPDATE custom_games
          SET vote_status = 'closed',
              vote_ends_at = ?,
              updated_at = ?
          WHERE id = ?
        `,
        [ts, ts, gameId]
      );

      const run = await createCustomGameRun(db, game, mapRow);
      const finalSnapshot = await getVoteSnapshot(db, gameId, null);

      res.json({
        message: "vote passed",
        passed: true,
        runId: Number(run.runId || 0),
        yesCount: finalSnapshot.yesCount,
        noCount: finalSnapshot.noCount,
        total: finalSnapshot.total,
        voteStatus: "passed",
      });
    } catch (e: any) {
      res.status(500).json({ message: e?.message || "close and judge failed" });
    }
  });

  /** -------------------- 杩愯涓?API -------------------- */
  router.get("/run/active/global", requireAuth, async (_req, res) => {
    try {
      const run = await getLatestRunningRun(db);
      if (!run) return res.json({ hasActive: false, runId: null, gameId: null });

      const mapSnapshot = fromJson(run.map_snapshot, {});
      const mapName = String((mapSnapshot as any)?.mapName || "?????");
      res.json({
        hasActive: true,
        runId: Number(run.id),
        gameId: Number(run.game_id),
        gameTitle: String(run.game_title || `????#${run.game_id}`),
        mapName,
      });
    } catch (e: any) {
      res.status(500).json({ message: e?.message || "active run query failed" });
    }
  });

  router.get("/:id/run/active", requireAuth, async (req, res) => {
    try {
      const gameId = Number(req.params.id);
      const run = await getActiveRun(db, gameId);
      if (!run) return res.json({ hasActive: false, runId: null });
      res.json({ hasActive: true, runId: Number(run.id) });
    } catch (e: any) {
      res.status(500).json({ message: e?.message || "active query failed" });
    }
  });

  router.post("/:id/run/join", requireAuth, async (req, res) => {
    try {
      const user = (req as any).authUser as AuthUser;
      const gameId = Number(req.params.id);

      const run = await getActiveRun(db, gameId);
      if (!run) return res.status(400).json({ message: "no active run" });

      const name = user.nickname || user.username || `U${user.id}`;
      const ts = now();

      const existing = await dbGet(
        db,
        `SELECT id, world_snapshot, returned_at FROM custom_game_run_players WHERE run_id = ? AND user_id = ?`,
        [run.id, user.id]
      );

      if (!existing) {
        const worldSnapshot = await buildPlayerWorldSnapshot(db, user.id);
        await dbRun(
          db,
          `INSERT INTO custom_game_run_players(
            run_id, user_id, name, hp, energy, score, alive, joined_at, updated_at, world_snapshot, returned_at
          ) VALUES (?, ?, ?, 100, 100, 0, 1, ?, ?, ?, NULL)`,
          [run.id, user.id, name, ts, ts, toJson(worldSnapshot, {})]
        );

        await dbRun(
          db,
          `INSERT INTO custom_game_run_events(run_id, actor_user_id, event_type, message, payload, created_at)
           VALUES (?, ?, 'join', ?, ?, ?)`,
          [
            run.id,
            user.id,
            `${name} 进入灾厄副本，主世界数据已切换为隔离模式`,
            toJson({ userId: user.id, isolated: true }, {}),
            ts,
          ]
        );
      } else {
        const patchSql: string[] = [];
        const patchParams: any[] = [];

        if (!existing.world_snapshot) {
          const worldSnapshot = await buildPlayerWorldSnapshot(db, user.id);
          patchSql.push(`world_snapshot = ?`);
          patchParams.push(toJson(worldSnapshot, {}));
        }
        if (existing.returned_at) {
          patchSql.push(`returned_at = NULL`);
        }
        if (patchSql.length > 0) {
          patchParams.push(ts, run.id, user.id);
          await dbRun(
            db,
            `UPDATE custom_game_run_players SET ${patchSql.join(", ")}, updated_at = ? WHERE run_id = ? AND user_id = ?`,
            patchParams
          );
        }

        if (existing.returned_at) {
          await dbRun(
            db,
            `INSERT INTO custom_game_run_events(run_id, actor_user_id, event_type, message, payload, created_at)
             VALUES (?, ?, 'rejoin', ?, ?, ?)`,
            [
              run.id,
              user.id,
              `${name} 重新进入灾厄副本，继续使用本局临时数据`,
              toJson({ userId: user.id, resumed: true }, {}),
              ts,
            ]
          );
        }
      }

      res.json({ message: "joined", runId: Number(run.id) });
    } catch (e: any) {
      res.status(500).json({ message: e?.message || "join failed" });
    }
  });

  router.get("/:id/run/state", requireAuth, async (req, res) => {
    try {
      const user = (req as any).authUser as AuthUser;
      const gameId = Number(req.params.id);

      const run = await dbGet(db, `SELECT * FROM custom_game_runs WHERE game_id = ? ORDER BY id DESC LIMIT 1`, [gameId]);
      if (!run) return res.status(404).json({ message: "run not found" });

      const players = await dbAll(
        db,
        `SELECT user_id as userId, name, hp, energy, score, alive
           FROM custom_game_run_players
          WHERE run_id = ?
          ORDER BY score DESC, id ASC`,
        [run.id]
      );

      const eventsDesc = await dbAll(
        db,
        `SELECT id, created_at as ts, event_type as type, message, actor_user_id as actorUserId
           FROM custom_game_run_events
          WHERE run_id = ?
          ORDER BY id DESC
          LIMIT 120`,
        [run.id]
      );

      const me = await dbGet(
        db,
        `SELECT score, hp, energy, returned_at, world_snapshot FROM custom_game_run_players WHERE run_id = ? AND user_id = ?`,
        [run.id, user.id]
      );

      const stageConfigs = fromJson<any[]>(run.stage_configs, []);
      const currentStage = Number(run.current_stage || 1);
      const stageMeta = stageConfigs.find((s) => Number(s.index) === currentStage) || null;
      const worldSnapshot = fromJson<any>(me?.world_snapshot, null as any);

      res.json({
        runId: Number(run.id),
        gameId: Number(run.game_id),
        status: run.status,
        currentStage,
        totalStages: Number(run.total_stages || 1),
        stageName: stageMeta?.name || "",
        stageDesc: stageMeta?.desc || "",
        stageConfigs,
        mapConfig: fromJson(run.map_snapshot, {}),
        players,
        events: eventsDesc.reverse(),
        myScore: Number(me?.score || 0),
        myHp: Number(me?.hp || 0),
        myEnergy: Number(me?.energy || 0),
        isJoined: !!me,
        canControl: !!(user.isAdmin || Number(run.creator_user_id) === user.id),
        creatorUserId: Number(run.creator_user_id),
        worldDataMode: me ? "isolated" : "not_joined",
        worldSnapshotCapturedAt: worldSnapshot?.capturedAt ? String(worldSnapshot.capturedAt) : null,
        returnedAt: me?.returned_at ? String(me.returned_at) : null,
      });
    } catch (e: any) {
      res.status(500).json({ message: e?.message || "state failed" });
    }
  });

  router.post("/:id/run/action", requireAuth, async (req, res) => {
    try {
      const user = (req as any).authUser as AuthUser;
      const gameId = Number(req.params.id);
      const actionType = String(req.body?.actionType || "").trim();
      const payload = req.body?.payload ?? {};
      if (!actionType) return res.status(400).json({ message: "actionType required" });

      const run = await getActiveRun(db, gameId);
      if (!run) return res.status(400).json({ message: "no active run" });

      const me = await dbGet(db, `SELECT * FROM custom_game_run_players WHERE run_id = ? AND user_id = ?`, [run.id, user.id]);
      if (!me) return res.status(403).json({ message: "you are not joined" });

      let addScore = 0;
      let energyCost = 0;
      let hpDelta = 0;
      let msg = "";

      switch (actionType) {
        case "explore":
          addScore = 1; energyCost = 5; msg = `${me.name} 进行了探索（+1分）`; break;
        case "collect":
          addScore = 2; energyCost = 8; msg = `${me.name} 进行了采集（+2分）`; break;
        case "attack":
          addScore = 3; energyCost = 10; msg = `${me.name} 发起攻击（+3分）`; break;
        default:
          addScore = 0; energyCost = 3; msg = `${me.name} 执行动作 ${actionType}`; break;
      }

      const nextEnergy = Math.max(0, Number(me.energy || 0) - energyCost);
      const nextHp = Math.max(0, Number(me.hp || 0) + hpDelta);
      const nextScore = Number(me.score || 0) + addScore;
      const alive = nextHp > 0 ? 1 : 0;

      await dbRun(
        db,
        `UPDATE custom_game_run_players
            SET score = ?, energy = ?, hp = ?, alive = ?, updated_at = ?
          WHERE run_id = ? AND user_id = ?`,
        [nextScore, nextEnergy, nextHp, alive, now(), run.id, user.id]
      );

      await dbRun(
        db,
        `INSERT INTO custom_game_run_events(run_id, actor_user_id, event_type, message, payload, created_at)
         VALUES (?, ?, 'action', ?, ?, ?)`,
        [run.id, user.id, msg, toJson({ actionType, payload, addScore, energyCost }, {}), now()]
      );

      res.json({ message: "ok", score: nextScore, hp: nextHp, energy: nextEnergy });
    } catch (e: any) {
      res.status(500).json({ message: e?.message || "action failed" });
    }
  });

  router.post("/:id/run/leave", requireAuth, async (req, res) => {
    try {
      const user = (req as any).authUser as AuthUser;
      const gameId = Number(req.params.id);
      const run = await dbGet(db, `SELECT * FROM custom_game_runs WHERE game_id = ? ORDER BY id DESC LIMIT 1`, [gameId]);
      if (!run) return res.status(404).json({ message: "run not found" });

      const row = await dbGet(
        db,
        `SELECT name, world_snapshot, returned_at FROM custom_game_run_players WHERE run_id = ? AND user_id = ? LIMIT 1`,
        [run.id, user.id]
      );
      if (!row) return res.status(404).json({ message: "player not joined" });

      const ts = now();
      if (!row.returned_at) {
        await dbRun(
          db,
          `UPDATE custom_game_run_players SET returned_at = ?, updated_at = ? WHERE run_id = ? AND user_id = ?`,
          [ts, ts, run.id, user.id]
        );
        await dbRun(
          db,
          `INSERT INTO custom_game_run_events(run_id, actor_user_id, event_type, message, payload, created_at)
           VALUES (?, ?, 'leave', ?, ?, ?)`,
          [
            run.id,
            user.id,
            `${String(row.name || user.nickname || user.username || `U${user.id}`)} 返回主世界，原世界数据已恢复`,
            toJson({ userId: user.id, restored: true }, {}),
            ts,
          ]
        );
      }

      const worldSnapshot = fromJson<any>(row.world_snapshot, null as any);
      res.json({
        success: true,
        restored: true,
        returnedAt: row.returned_at ? String(row.returned_at) : ts,
        worldSnapshotCapturedAt: worldSnapshot?.capturedAt ? String(worldSnapshot.capturedAt) : null,
      });
    } catch (e: any) {
      res.status(500).json({ message: e?.message || "leave run failed" });
    }
  });

  router.get("/:id/run/rank", requireAuth, async (req, res) => {
    try {
      const gameId = Number(req.params.id);
      const run = await dbGet(db, `SELECT * FROM custom_game_runs WHERE game_id = ? ORDER BY id DESC LIMIT 1`, [gameId]);
      if (!run) return res.json([]);

      const rows = await dbAll(
        db,
        `SELECT user_id as userId, name, score
           FROM custom_game_run_players
          WHERE run_id = ?
          ORDER BY score DESC, id ASC`,
        [run.id]
      );
      res.json(rows.map((r, i) => ({ ...r, rank: i + 1 })));
    } catch (e: any) {
      res.status(500).json({ message: e?.message || "rank failed" });
    }
  });

  router.get("/leaderboard", requireAuth, async (req, res) => {
    try {
      const limit = Math.max(1, Math.min(100, Number(req.query.limit || 30)));
      const rows = await dbAll(
        db,
        `
          SELECT
            s.user_id as userId,
            u.name as name,
            s.total_points as totalPoints,
            s.total_runs as totalRuns,
            s.total_wins as totalWins,
            s.updated_at as updatedAt
          FROM custom_game_player_stats s
          LEFT JOIN users u ON u.id = s.user_id
          ORDER BY s.total_points DESC, s.total_wins DESC, s.total_runs ASC, s.user_id ASC
          LIMIT ?
        `,
        [limit]
      );
      res.json(
        rows.map((row, index) => ({
          ...row,
          name: String(row?.name || `U${row?.userId || 0}`),
          rank: index + 1,
        }))
      );
    } catch (e: any) {
      res.status(500).json({ message: e?.message || "leaderboard failed" });
    }
  });

  router.post("/:id/run/stages/config", requireAuth, async (req, res) => {
    try {
      const user = (req as any).authUser as AuthUser;
      const gameId = Number(req.params.id);
      const totalStages = Math.max(1, Math.min(20, Number(req.body?.totalStages || 1)));
      const stages = Array.isArray(req.body?.stages) ? req.body.stages : [];

      const run = await getActiveRun(db, gameId);
      if (!run) return res.status(400).json({ message: "no active run" });

      const canControl = !!(user.isAdmin || Number(run.creator_user_id) === user.id);
      if (!canControl) return res.status(403).json({ message: "no permission" });

      const normalized = Array.from({ length: totalStages }).map((_, i) => {
        const x = stages[i] || {};
        return { index: i + 1, name: String(x.name || `闃舵${i + 1}`), desc: String(x.desc || "") };
      });

      await dbRun(
        db,
        `UPDATE custom_game_runs
            SET total_stages = ?, stage_configs = ?, updated_at = ?
          WHERE id = ?`,
        [totalStages, toJson(normalized, []), now(), run.id]
      );

      await dbRun(
        db,
        `INSERT INTO custom_game_run_events(run_id, actor_user_id, event_type, message, payload, created_at)
         VALUES (?, ?, 'stage_config', ?, ?, ?)`,
        [run.id, user.id, "更新了阶段配置", toJson({ totalStages, stages: normalized }, {}), now()]
      );

      res.json({ message: "ok" });
    } catch (e: any) {
      res.status(500).json({ message: e?.message || "stages config failed" });
    }
  });

  router.post("/:id/run/stages/next", requireAuth, async (req, res) => {
    try {
      const user = (req as any).authUser as AuthUser;
      const gameId = Number(req.params.id);

      const run = await getActiveRun(db, gameId);
      if (!run) return res.status(400).json({ message: "no active run" });

      const canControl = !!(user.isAdmin || Number(run.creator_user_id) === user.id);
      if (!canControl) return res.status(403).json({ message: "no permission" });

      const cur = Number(run.current_stage || 1);
      const total = Number(run.total_stages || 1);
      if (cur >= total) return res.status(400).json({ message: "already final stage" });

      const next = cur + 1;
      await dbRun(db, `UPDATE custom_game_runs SET current_stage = ?, updated_at = ? WHERE id = ?`, [next, now(), run.id]);

      await dbRun(
        db,
        `INSERT INTO custom_game_run_events(run_id, actor_user_id, event_type, message, payload, created_at)
         VALUES (?, ?, 'stage_next', ?, ?, ?)`,
        [run.id, user.id, `鎺ㄨ繘鍒扮${next}闃舵`, toJson({ from: cur, to: next }, {}), now()]
      );

      res.json({ message: "ok", currentStage: next });
    } catch (e: any) {
      res.status(500).json({ message: e?.message || "next stage failed" });
    }
  });

  router.post("/:id/run/map/update", requireAuth, async (req, res) => {
    try {
      const user = (req as any).authUser as AuthUser;
      const gameId = Number(req.params.id);
      const mapPatch = req.body?.mapPatch ?? {};

      const run = await getActiveRun(db, gameId);
      if (!run) return res.status(400).json({ message: "no active run" });

      const canControl = !!(user.isAdmin || Number(run.creator_user_id) === user.id);
      if (!canControl) return res.status(403).json({ message: "no permission" });

      const merged = { ...fromJson(run.map_snapshot, {}), ...mapPatch };
      await dbRun(db, `UPDATE custom_game_runs SET map_snapshot = ?, updated_at = ? WHERE id = ?`, [toJson(merged, {}), now(), run.id]);

      await dbRun(
        db,
        `INSERT INTO custom_game_run_events(run_id, actor_user_id, event_type, message, payload, created_at)
         VALUES (?, ?, 'map_update', ?, ?, ?)`,
        [run.id, user.id, "杩愯涓湴鍥惧凡鏇存柊", toJson({ mapPatch }, {}), now()]
      );

      res.json({ message: "ok" });
    } catch (e: any) {
      res.status(500).json({ message: e?.message || "map update failed" });
    }
  });

  router.post("/:id/run/score/grant", requireAuth, async (req, res) => {
    try {
      const user = (req as any).authUser as AuthUser;
      const gameId = Number(req.params.id);
      const targetUserId = Number(req.body?.userId || 0);
      const points = Number(req.body?.points || 0);
      const reason = String(req.body?.reason || "闃舵濂栧姳");
      const stage = Number(req.body?.stage || 1);

      if (!targetUserId || !points) return res.status(400).json({ message: "userId/points required" });

      const run = await getActiveRun(db, gameId);
      if (!run) return res.status(400).json({ message: "no active run" });

      const canControl = !!(user.isAdmin || Number(run.creator_user_id) === user.id);
      if (!canControl) return res.status(403).json({ message: "no permission" });

      const target = await dbGet(db, `SELECT * FROM custom_game_run_players WHERE run_id = ? AND user_id = ?`, [run.id, targetUserId]);
      if (!target) return res.status(404).json({ message: "target player not found in run" });

      const newScore = Number(target.score || 0) + points;
      await dbRun(
        db,
        `UPDATE custom_game_run_players SET score = ?, updated_at = ? WHERE run_id = ? AND user_id = ?`,
        [newScore, now(), run.id, targetUserId]
      );

      await dbRun(
        db,
        `INSERT INTO custom_game_run_events(run_id, actor_user_id, event_type, message, payload, created_at)
         VALUES (?, ?, 'score_grant', ?, ?, ?)`,
        [run.id, user.id, `向 ${target.name} 发放积分 ${points}`, toJson({ targetUserId, points, reason, stage }, {}), now()]
      );

      res.json({ message: "ok", targetUserId, score: newScore });
    } catch (e: any) {
      res.status(500).json({ message: e?.message || "grant score failed" });
    }
  });

  router.get("/:id/run/end", requireAuth, async (req, res) => {
    try {
      const gameId = Number(req.params.id);
      const run = await dbGet(db, `SELECT * FROM custom_game_runs WHERE game_id = ? ORDER BY id DESC LIMIT 1`, [gameId]);
      if (!run) return res.status(404).json({ message: "run not found" });
      if (run.status !== "ended") return res.status(400).json({ message: "run not ended" });

      const rows = await dbAll(
        db,
        `SELECT user_id as userId, name, score
           FROM custom_game_run_players
          WHERE run_id = ?
          ORDER BY score DESC, id ASC`,
        [run.id]
      );
      res.json({
        runId: Number(run.id),
        endedAt: run.ended_at,
        result: "settled",
        rank: rows.map((r, i) => ({ ...r, rank: i + 1 })),
      });
    } catch (e: any) {
      res.status(500).json({ message: e?.message || "get settlement failed" });
    }
  });

  router.post("/:id/run/end", requireAuth, async (req, res) => {
    try {
      const user = (req as any).authUser as AuthUser;
      const gameId = Number(req.params.id);

      const run = await getActiveRun(db, gameId);
      if (!run) return res.status(400).json({ message: "no active run" });

      const canControl = !!(user.isAdmin || Number(run.creator_user_id) === user.id);
      if (!canControl) return res.status(403).json({ message: "no permission" });

      const endAt = now();
      await dbRun(db, `UPDATE custom_game_runs SET status='ended', ended_at=?, updated_at=? WHERE id=?`, [endAt, endAt, run.id]);
      await dbRun(db, `UPDATE custom_games SET status='ended', updated_at=? WHERE id=?`, [endAt, gameId]);

      const rows = await dbAll(
        db,
        `SELECT user_id as userId, name, score
           FROM custom_game_run_players
          WHERE run_id = ?
          ORDER BY score DESC, id ASC`,
        [run.id]
      );
      const rank = rows.map((r, i) => ({ ...r, rank: i + 1 }));

      for (const r of rank) {
        const isWin = r.rank === 1 ? 1 : 0;
        await dbRun(
          db,
          `INSERT INTO custom_game_player_stats(user_id, total_points, total_runs, total_wins, updated_at)
           VALUES (?, ?, 1, ?, ?)
           ON CONFLICT(user_id) DO UPDATE SET
             total_points = total_points + excluded.total_points,
             total_runs = total_runs + 1,
             total_wins = total_wins + excluded.total_wins,
             updated_at = excluded.updated_at`,
          [r.userId, Number(r.score || 0), isWin, endAt]
        );
      }

      await dbRun(
        db,
        `INSERT INTO custom_game_run_events(run_id, actor_user_id, event_type, message, payload, created_at)
         VALUES (?, ?, 'run_end', ?, ?, ?)`,
        [run.id, user.id, "副本已结算", toJson({ rank }, {}), endAt]
      );

      const game = await dbGet(db, `SELECT title FROM custom_games WHERE id = ? LIMIT 1`, [gameId]);
      const mapSnapshot = fromJson<any>(run.map_snapshot, {});
      const gameTitle = String(game?.title || `灾厄游戏#${gameId}`);
      const mapName = String(mapSnapshot?.mapName || "创作者地图");
      await createAnnouncement(
        db,
        "custom_game_result",
        `${gameTitle} 结算公报`,
        formatSettlementAnnouncement(gameTitle, mapName, rank),
        {
          gameId,
          runId: Number(run.id),
          mapName,
          rank,
        }
      );

      res.json({ runId: Number(run.id), endedAt: endAt, result: "settled", rank });
    } catch (e: any) {
      res.status(500).json({ message: e?.message || "end run failed" });
    }
  });

  return router;
}



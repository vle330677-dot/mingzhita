import type { AppDatabase } from './types';

const addColumn = (db: AppDatabase, table: string, col: string, type: string) => {
  if (!/^[a-zA-Z0-9_]+$/.test(table) || !/^[a-zA-Z0-9_]+$/.test(col)) return;
  try {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${type}`);
  } catch {
    // ignore duplicate
  }
};

export function runMigrate(db: AppDatabase) {
  addColumn(db, 'users', 'homeLocation', 'TEXT');
  addColumn(db, 'users', 'avatarUpdatedAt', 'TEXT');
  addColumn(db, 'users', 'createdAt', 'TEXT');
  addColumn(db, 'users', 'updatedAt', 'TEXT');
  addColumn(db, 'users', 'password', 'TEXT');
  addColumn(db, 'users', 'loginPasswordHash', 'TEXT');
  addColumn(db, 'users', 'allowVisit', 'INTEGER DEFAULT 1');
  addColumn(db, 'users', 'roomPasswordHash', 'TEXT');
  addColumn(db, 'announcements', 'payload', 'TEXT');
  addColumn(db, 'announcements', 'created_at', 'DATETIME');
  addColumn(db, 'users', 'roomVisible', 'INTEGER DEFAULT 1');
  addColumn(db, 'users', 'guideStability', 'INTEGER DEFAULT 100');
  addColumn(db, 'users', 'lastCombatAt', 'TEXT');
  addColumn(db, 'users', 'forceOfflineAt', 'TEXT');
  addColumn(db, 'users', 'adminAvatarUrl', 'TEXT');
  addColumn(db, 'users', 'spiritIntimacy', 'INTEGER DEFAULT 0');
  addColumn(db, 'users', 'spiritLevel', 'INTEGER DEFAULT 1');
  addColumn(db, 'users', 'spiritImageUrl', 'TEXT');
  addColumn(db, 'users', 'spiritAppearance', 'TEXT');
  addColumn(db, 'users', 'spiritNameLocked', 'INTEGER DEFAULT 0');
  addColumn(db, 'users', 'spiritAvatarLocked', 'INTEGER DEFAULT 0');
  addColumn(db, 'users', 'spiritAppearanceLocked', 'INTEGER DEFAULT 0');
  addColumn(db, 'users', 'spiritInteractDate', 'TEXT');
  addColumn(db, 'users', 'spiritFeedCount', 'INTEGER DEFAULT 0');
  addColumn(db, 'users', 'spiritPetCount', 'INTEGER DEFAULT 0');
  addColumn(db, 'users', 'spiritTrainCount', 'INTEGER DEFAULT 0');


  const hasFix = db.prepare(`SELECT 1 FROM system_migrations WHERE key = ?`).get('fix_minor_home_v1');
  if (!hasFix) {
    db.exec(`
      UPDATE users
      SET homeLocation = 'sanctuary'
      WHERE age < 16
        AND (homeLocation IS NULL OR homeLocation <> 'sanctuary');
    `);
    db.prepare(`INSERT INTO system_migrations(key) VALUES (?)`).run('fix_minor_home_v1');
  }

  // ---- 性能关键索引（每次启动幂等创建，不影响已有索引） ----
  const perfIndexes = `
    -- users 表：currentLocation+status 复合索引（fetchPlayers 主查询）
    CREATE INDEX IF NOT EXISTS idx_users_loc_status ON users(currentLocation, status);
    -- user_sessions：复合索引用于 EXISTS 子查询（userId + revokedAt + lastSeenAt）
    CREATE INDEX IF NOT EXISTS idx_user_sessions_active ON user_sessions(userId, revokedAt, lastSeenAt);
    -- users 表：按 currentLocation 过滤（同地图玩家）
    CREATE INDEX IF NOT EXISTS idx_users_location ON users(currentLocation);
    -- user_sessions 表：按 userId 过滤（心跳、鉴权）
    CREATE INDEX IF NOT EXISTS idx_user_sessions_userId ON user_sessions(userId);
    -- announcements 表：按 createdAt 排序（前端轮询最新公告）
    CREATE INDEX IF NOT EXISTS idx_announcements_created ON announcements(createdAt DESC);
    -- interaction_skip_requests：按 toUserId + status 过滤（incoming 轮询）
    CREATE INDEX IF NOT EXISTS idx_skip_req_to_status ON interaction_skip_requests(toUserId, status);
    -- party_requests：按 toUserId + status 过滤
    CREATE INDEX IF NOT EXISTS idx_party_req_to_status ON party_requests(toUserId, status);
    -- rp_mediation_invites：按 invitedUserId + status 过滤
    CREATE INDEX IF NOT EXISTS idx_mediation_invited_status ON rp_mediation_invites(invitedUserId, status);
    -- active_rp_sessions：按 status 过滤（对戏会话查找）
    CREATE INDEX IF NOT EXISTS idx_rp_sessions_status ON active_rp_sessions(status);
    -- active_rp_members：按 userId 查找所属会话
    CREATE INDEX IF NOT EXISTS idx_rp_members_userId ON active_rp_members(userId);
    -- rp_archive_messages：按 archiveId + id 排序（消息拉取）
    CREATE INDEX IF NOT EXISTS idx_rp_archive_msgs_archive ON rp_archive_messages(archiveId, id);
    -- party_entanglements：按 userAId/userBId 查找羁绊
    CREATE INDEX IF NOT EXISTS idx_party_entangle_a ON party_entanglements(userAId, active);
    CREATE INDEX IF NOT EXISTS idx_party_entangle_b ON party_entanglements(userBId, active);
  `;
  try { db.exec(perfIndexes); } catch { /* 忽略旧版 SQLite 不支持的语法 */ }

  // Ensure legacy rows have timestamps after adding createdAt/updatedAt.
  db.exec(`
    UPDATE users
    SET createdAt = COALESCE(createdAt, CURRENT_TIMESTAMP),
        updatedAt = COALESCE(updatedAt, CURRENT_TIMESTAMP)
  `);

  try {
    db.exec(`
      UPDATE items
      SET itemType = '回复道具'
      WHERE itemType = '恢复道具'
    `);
  } catch {
    // ignore when items table unavailable
  }
}

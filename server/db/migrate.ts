import type { AppDatabase } from './types';

const addColumn = async (db: AppDatabase, table: string, col: string, type: string) => {
  if (!/^[a-zA-Z0-9_]+$/.test(table) || !/^[a-zA-Z0-9_]+$/.test(col)) return;
  try {
    await db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${type}`);
  } catch {
    // ignore duplicate
  }
};

export async function runMigrate(db: AppDatabase) {
  await addColumn(db, 'users', 'homeLocation', 'TEXT');
  await addColumn(db, 'users', 'avatarUpdatedAt', 'TEXT');
  await addColumn(db, 'users', 'createdAt', 'TEXT');
  await addColumn(db, 'users', 'updatedAt', 'TEXT');
  await addColumn(db, 'users', 'password', 'TEXT');
  await addColumn(db, 'users', 'loginPasswordHash', 'TEXT');
  await addColumn(db, 'users', 'allowVisit', 'INTEGER DEFAULT 1');
  await addColumn(db, 'users', 'roomPasswordHash', 'TEXT');
  await addColumn(db, 'announcements', 'payload', 'TEXT');
  await addColumn(db, 'announcements', 'created_at', 'DATETIME');
  await addColumn(db, 'users', 'roomVisible', 'INTEGER DEFAULT 1');
  await addColumn(db, 'users', 'guideStability', 'INTEGER DEFAULT 100');
  await addColumn(db, 'users', 'lastCombatAt', 'TEXT');
  await addColumn(db, 'users', 'forceOfflineAt', 'TEXT');
  await addColumn(db, 'users', 'adminAvatarUrl', 'TEXT');
  await addColumn(db, 'users', 'spiritIntimacy', 'INTEGER DEFAULT 0');
  await addColumn(db, 'users', 'spiritLevel', 'INTEGER DEFAULT 1');
  await addColumn(db, 'users', 'spiritImageUrl', 'TEXT');
  await addColumn(db, 'users', 'spiritAppearance', 'TEXT');
  await addColumn(db, 'users', 'spiritNameLocked', 'INTEGER DEFAULT 0');
  await addColumn(db, 'users', 'spiritAvatarLocked', 'INTEGER DEFAULT 0');
  await addColumn(db, 'users', 'spiritAppearanceLocked', 'INTEGER DEFAULT 0');
  await addColumn(db, 'users', 'spiritInteractDate', 'TEXT');
  await addColumn(db, 'users', 'spiritFeedCount', 'INTEGER DEFAULT 0');
  await addColumn(db, 'users', 'spiritPetCount', 'INTEGER DEFAULT 0');
  await addColumn(db, 'users', 'spiritTrainCount', 'INTEGER DEFAULT 0');

  const hasFix = await db.prepare(`SELECT 1 FROM system_migrations WHERE key = ?`).get('fix_minor_home_v1');
  if (!hasFix) {
    await db.exec(`
      UPDATE users
      SET homeLocation = 'sanctuary'
      WHERE age < 16
        AND (homeLocation IS NULL OR homeLocation <> 'sanctuary');
    `);
    await db.prepare(`INSERT INTO system_migrations(key) VALUES (?)`).run('fix_minor_home_v1');
  }

  const perfIndexes = `
    CREATE INDEX IF NOT EXISTS idx_users_loc_status ON users(currentLocation, status);
    CREATE INDEX IF NOT EXISTS idx_user_sessions_active ON user_sessions(userId, revokedAt, lastSeenAt);
    CREATE INDEX IF NOT EXISTS idx_users_location ON users(currentLocation);
    CREATE INDEX IF NOT EXISTS idx_user_sessions_userId ON user_sessions(userId);
    CREATE INDEX IF NOT EXISTS idx_announcements_created ON announcements(createdAt DESC);
    CREATE INDEX IF NOT EXISTS idx_skip_req_to_status ON interaction_skip_requests(toUserId, status);
    CREATE INDEX IF NOT EXISTS idx_party_req_to_status ON party_requests(toUserId, status);
    CREATE INDEX IF NOT EXISTS idx_mediation_invited_status ON rp_mediation_invites(invitedUserId, status);
    CREATE INDEX IF NOT EXISTS idx_rp_sessions_status ON active_rp_sessions(status);
    CREATE INDEX IF NOT EXISTS idx_rp_members_userId ON active_rp_members(userId);
    CREATE INDEX IF NOT EXISTS idx_rp_archive_msgs_archive ON rp_archive_messages(archiveId, id);
    CREATE INDEX IF NOT EXISTS idx_party_entangle_a ON party_entanglements(userAId, active);
    CREATE INDEX IF NOT EXISTS idx_party_entangle_b ON party_entanglements(userBId, active);
  `;
  try {
    await db.exec(perfIndexes);
  } catch {
    // ignore syntax differences on older SQLite variants
  }

  await db.exec(`
    UPDATE users
    SET createdAt = COALESCE(createdAt, CURRENT_TIMESTAMP),
        updatedAt = COALESCE(updatedAt, CURRENT_TIMESTAMP)
  `);

  try {
    await db.exec(`
      UPDATE items
      SET itemType = '回复道具'
      WHERE itemType = '恢复道具'
    `);
  } catch {
    // ignore when items table unavailable
  }
}
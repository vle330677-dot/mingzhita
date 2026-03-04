import Database from 'better-sqlite3';


const addColumn = (db: Database.Database, table: string, col: string, type: string) => {
  if (!/^[a-zA-Z0-9_]+$/.test(table) || !/^[a-zA-Z0-9_]+$/.test(col)) return;
  try {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${type}`);
  } catch {
    // ignore duplicate
  }
};

export function runMigrate(db: Database.Database) {
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

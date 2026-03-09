import type { AppDatabase } from './types';

export async function runSchema(db: AppDatabase) {
  const schemaSql = `
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
      spiritIntimacy INTEGER DEFAULT 0,
      spiritLevel INTEGER DEFAULT 1,
      spiritImageUrl TEXT DEFAULT '',
      spiritAppearance TEXT DEFAULT '',
      spiritNameLocked INTEGER DEFAULT 0,
      spiritAvatarLocked INTEGER DEFAULT 0,
      spiritAppearanceLocked INTEGER DEFAULT 0,
      spiritInteractDate TEXT,
      spiritFeedCount INTEGER DEFAULT 0,
      spiritPetCount INTEGER DEFAULT 0,
      spiritTrainCount INTEGER DEFAULT 0,
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
      workCount INTEGER DEFAULT 0,
      trainCount INTEGER DEFAULT 0,
      lastResetDate TEXT,
      lastCheckInDate TEXT,
      password TEXT,
      loginPasswordHash TEXT,
      roomPasswordHash TEXT,
      roomBgImage TEXT,
      roomDescription TEXT,
      allowVisit INTEGER DEFAULT 1,
      fury INTEGER DEFAULT 0,
      guideStability INTEGER DEFAULT 100,
      partyId TEXT DEFAULT NULL,
      adminAvatarUrl TEXT,
      forceOfflineAt TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 你其余 CREATE TABLE / CREATE INDEX 原样放这里 ...

    CREATE TABLE IF NOT EXISTS system_migrations (
      "key" TEXT PRIMARY KEY,
      appliedAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 你其余 CREATE TABLE / CREATE INDEX 原样放这里 ...
  `;

  const statements = schemaSql
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean);

  try {
    // 如果你的 db 支持事务，建议保留
    await db.exec('BEGIN;');

    for (let i = 0; i < statements.length; i++) {
      const sql = statements[i];
      try {
        await db.exec(sql + ';');
      } catch (err) {
        console.error(
          `[runSchema] SQL failed at #${i + 1}: ${sql.slice(0, 200)}...`,
          err
        );
        throw err;
      }
    }

    await db.exec('COMMIT;');
    console.log(`[runSchema] schema applied, total statements: ${statements.length}`);
  } catch (err) {
    try {
      await db.exec('ROLLBACK;');
    } catch (_) {}
    console.error('[runSchema] migration failed, app may not start:', err);
    throw err; // 保持抛出，避免“假启动成功”
  }
}

import Database from 'better-sqlite3';

export function runSchema(db: Database.Database) {
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

    CREATE INDEX IF NOT EXISTS idx_users_name ON users(name);
    CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
    CREATE INDEX IF NOT EXISTS idx_users_job ON users(job);
    CREATE INDEX IF NOT EXISTS idx_users_faction ON users(faction);
    CREATE INDEX IF NOT EXISTS idx_users_homeLocation ON users(homeLocation);

    CREATE TABLE IF NOT EXISTS announcements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT DEFAULT 'system',
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      extraJson TEXT,
      payload TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_at DATETIME
    );

    CREATE INDEX IF NOT EXISTS idx_announcements_createdAt ON announcements(createdAt DESC);

    CREATE TABLE IF NOT EXISTS user_sessions (
      token TEXT PRIMARY KEY,
      userId INTEGER NOT NULL,
      userName TEXT NOT NULL,
      role TEXT DEFAULT 'player',
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      lastSeenAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      revokedAt DATETIME
    );

    CREATE INDEX IF NOT EXISTS idx_user_sessions_userId ON user_sessions(userId);
    CREATE INDEX IF NOT EXISTS idx_user_sessions_role ON user_sessions(role);
    CREATE INDEX IF NOT EXISTS idx_user_sessions_revokedAt ON user_sessions(revokedAt);

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

    CREATE INDEX IF NOT EXISTS idx_admin_action_logs_createdAt ON admin_action_logs(createdAt DESC);

    CREATE TABLE IF NOT EXISTS system_migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      appliedAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

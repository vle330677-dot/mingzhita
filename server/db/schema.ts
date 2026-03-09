import type { AppDatabase } from './types';

export async function runSchema(db: AppDatabase) {
  const statements: string[] = [
    `
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTO_INCREMENT,
      name VARCHAR(191) UNIQUE,
      age INTEGER DEFAULT 18,
      role VARCHAR(64),
      faction VARCHAR(128),
      mentalRank VARCHAR(64),
      physicalRank VARCHAR(64),
      gold INTEGER DEFAULT 0,
      ability TEXT,
      spiritName VARCHAR(191),
      spiritType VARCHAR(128),
      spiritIntimacy INTEGER DEFAULT 0,
      spiritLevel INTEGER DEFAULT 1,
      spiritImageUrl TEXT,
      spiritAppearance TEXT,
      spiritNameLocked INTEGER DEFAULT 0,
      spiritAvatarLocked INTEGER DEFAULT 0,
      spiritAppearanceLocked INTEGER DEFAULT 0,
      spiritInteractDate VARCHAR(32),
      spiritFeedCount INTEGER DEFAULT 0,
      spiritPetCount INTEGER DEFAULT 0,
      spiritTrainCount INTEGER DEFAULT 0,
      avatarUrl TEXT,
      avatarUpdatedAt VARCHAR(32),
      status VARCHAR(32) DEFAULT 'pending',
      deathDescription TEXT,
      profileText TEXT,
      isHidden INTEGER DEFAULT 0,
      currentLocation VARCHAR(191),
      homeLocation VARCHAR(191),
      job VARCHAR(191) DEFAULT '无',
      hp INTEGER DEFAULT 100,
      maxHp INTEGER DEFAULT 100,
      mp INTEGER DEFAULT 100,
      maxMp INTEGER DEFAULT 100,
      mentalProgress DOUBLE DEFAULT 0,
      workCount INTEGER DEFAULT 0,
      trainCount INTEGER DEFAULT 0,
      lastResetDate VARCHAR(32),
      lastCheckInDate VARCHAR(32),
      password VARCHAR(255),
      loginPasswordHash VARCHAR(255),
      roomPasswordHash VARCHAR(255),
      roomBgImage TEXT,
      roomDescription TEXT,
      allowVisit INTEGER DEFAULT 1,
      fury INTEGER DEFAULT 0,
      guideStability INTEGER DEFAULT 100,
      partyId VARCHAR(191) DEFAULT NULL,
      adminAvatarUrl TEXT,
      forceOfflineAt VARCHAR(32),
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `,

    `
    CREATE TABLE IF NOT EXISTS announcements (
      id INTEGER PRIMARY KEY AUTO_INCREMENT,
      type VARCHAR(32) DEFAULT 'system',
      title VARCHAR(255) NOT NULL,
      content TEXT NOT NULL,
      extraJson TEXT,
      payload TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_at DATETIME
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `,

    `
    CREATE TABLE IF NOT EXISTS user_sessions (
      token VARCHAR(191) PRIMARY KEY,
      userId INTEGER NOT NULL,
      userName VARCHAR(191) NOT NULL,
      role VARCHAR(32) DEFAULT 'player',
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      lastSeenAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      revokedAt DATETIME
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `,

    `
    CREATE TABLE IF NOT EXISTS admin_whitelist (
      id INTEGER PRIMARY KEY AUTO_INCREMENT,
      name VARCHAR(191) NOT NULL UNIQUE,
      code_name VARCHAR(191),
      enabled INTEGER DEFAULT 1,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `,

    `
    CREATE TABLE IF NOT EXISTS admin_action_logs (
      id INTEGER PRIMARY KEY AUTO_INCREMENT,
      adminName VARCHAR(191) NOT NULL,
      action VARCHAR(191) NOT NULL,
      targetType VARCHAR(64),
      targetId VARCHAR(191),
      detail TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `,

    `
    CREATE TABLE IF NOT EXISTS system_migrations (
      migration_key VARCHAR(191) PRIMARY KEY,
      appliedAt DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `,

    `
    CREATE TABLE IF NOT EXISTS items (
      id INTEGER PRIMARY KEY AUTO_INCREMENT,
      name VARCHAR(191) NOT NULL,
      description TEXT,
      locationTag VARCHAR(191),
      npcId VARCHAR(191),
      price INTEGER DEFAULT 0,
      faction VARCHAR(128) DEFAULT '通用',
      tier VARCHAR(64) DEFAULT '低阶',
      itemType VARCHAR(64) DEFAULT '回复道具',
      effectValue INTEGER DEFAULT 0,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `,

    `
    CREATE TABLE IF NOT EXISTS skills (
      id INTEGER PRIMARY KEY AUTO_INCREMENT,
      name VARCHAR(191) NOT NULL UNIQUE,
      faction VARCHAR(128) DEFAULT '通用',
      tier VARCHAR(64) DEFAULT '低阶',
      description TEXT,
      npcId VARCHAR(191),
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `,

    `
    CREATE TABLE IF NOT EXISTS user_skills (
      id INTEGER PRIMARY KEY AUTO_INCREMENT,
      userId INTEGER NOT NULL,
      skillId INTEGER NOT NULL,
      level INTEGER DEFAULT 1,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_user_skill (userId, skillId)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `,

    `
    CREATE TABLE IF NOT EXISTS active_rp_sessions (
      id VARCHAR(191) PRIMARY KEY,
      locationId VARCHAR(191),
      locationName VARCHAR(191),
      status VARCHAR(32) DEFAULT 'active',
      endProposedBy INTEGER,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `,

    `
    CREATE TABLE IF NOT EXISTS active_rp_members (
      sessionId VARCHAR(191) NOT NULL,
      userId INTEGER NOT NULL,
      userName VARCHAR(191) NOT NULL,
      role VARCHAR(191) DEFAULT '',
      PRIMARY KEY (sessionId, userId)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `,

    `
    CREATE TABLE IF NOT EXISTS active_rp_messages (
      id INTEGER PRIMARY KEY AUTO_INCREMENT,
      sessionId VARCHAR(191) NOT NULL,
      senderId INTEGER,
      senderName VARCHAR(191),
      content TEXT,
      type VARCHAR(32) DEFAULT 'user',
      createdAt DATETIME

import type { AppDatabase } from './types';

export function runSchema(db: AppDatabase) {
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

    CREATE TABLE IF NOT EXISTS system_migrations (
      key TEXT PRIMARY KEY,
      appliedAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      locationTag TEXT DEFAULT '',
      npcId TEXT,
      price INTEGER DEFAULT 0,
      faction TEXT DEFAULT '通用',
      tier TEXT DEFAULT '低阶',
      itemType TEXT DEFAULT '回复道具',
      effectValue INTEGER DEFAULT 0,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS skills (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      faction TEXT DEFAULT '通用',
      tier TEXT DEFAULT '低阶',
      description TEXT DEFAULT '',
      npcId TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS user_skills (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER NOT NULL,
      skillId INTEGER NOT NULL,
      level INTEGER DEFAULT 1,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(userId, skillId)
    );

    CREATE TABLE IF NOT EXISTS active_rp_sessions (
      id TEXT PRIMARY KEY,
      locationId TEXT,
      locationName TEXT,
      status TEXT DEFAULT 'active',
      endProposedBy INTEGER,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS active_rp_members (
      sessionId TEXT NOT NULL,
      userId INTEGER NOT NULL,
      userName TEXT NOT NULL,
      role TEXT DEFAULT '',
      PRIMARY KEY (sessionId, userId)
    );

    CREATE TABLE IF NOT EXISTS active_rp_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sessionId TEXT NOT NULL,
      senderId INTEGER,
      senderName TEXT,
      content TEXT,
      type TEXT DEFAULT 'user',
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS active_rp_leaves (
      sessionId TEXT NOT NULL,
      userId INTEGER NOT NULL,
      leftAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (sessionId, userId)
    );

    CREATE TABLE IF NOT EXISTS active_group_rp_members (
      locationId TEXT NOT NULL,
      dateKey TEXT NOT NULL,
      archiveId TEXT NOT NULL,
      userId INTEGER NOT NULL,
      userName TEXT NOT NULL,
      joinedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (locationId, dateKey, userId)
    );

    CREATE INDEX IF NOT EXISTS idx_active_group_rp_members_archive
      ON active_group_rp_members(archiveId, updatedAt);

    CREATE TABLE IF NOT EXISTS rp_archives (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      locationId TEXT,
      locationName TEXT,
      participants TEXT,
      participantNames TEXT,
      status TEXT DEFAULT 'active',
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS rp_archive_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      archiveId TEXT NOT NULL,
      senderId INTEGER,
      senderName TEXT,
      content TEXT,
      type TEXT DEFAULT 'user',
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS interaction_skip_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fromUserId INTEGER NOT NULL,
      toUserId INTEGER NOT NULL,
      actionType TEXT NOT NULL,
      payloadJson TEXT DEFAULT '{}',
      status TEXT DEFAULT 'pending',
      resultMessage TEXT DEFAULT '',
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS interaction_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      reporterId INTEGER NOT NULL,
      targetId INTEGER NOT NULL,
      reason TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS interaction_trade_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fromUserId INTEGER NOT NULL,
      toUserId INTEGER NOT NULL,
      mode TEXT NOT NULL,
      payloadJson TEXT DEFAULT '{}',
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS interaction_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER NOT NULL,
      sourceUserId INTEGER DEFAULT 0,
      targetUserId INTEGER DEFAULT 0,
      actionType TEXT DEFAULT '',
      title TEXT DEFAULT '',
      message TEXT NOT NULL,
      payloadJson TEXT DEFAULT '{}',
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_interaction_events_user_id
      ON interaction_events(userId, id);

    CREATE TABLE IF NOT EXISTS interaction_trade_sessions (
      id TEXT PRIMARY KEY,
      userAId INTEGER NOT NULL,
      userBId INTEGER NOT NULL,
      status TEXT DEFAULT 'pending',
      confirmA INTEGER DEFAULT 0,
      confirmB INTEGER DEFAULT 0,
      cancelledBy INTEGER DEFAULT 0,
      completedAt DATETIME,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_interaction_trade_sessions_pair_status
      ON interaction_trade_sessions(userAId, userBId, status, updatedAt);

    CREATE TABLE IF NOT EXISTS interaction_trade_offers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sessionId TEXT NOT NULL,
      userId INTEGER NOT NULL,
      itemName TEXT DEFAULT '',
      qty INTEGER DEFAULT 0,
      gold INTEGER DEFAULT 0,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(sessionId, userId)
    );

    CREATE TABLE IF NOT EXISTS interaction_trade_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fromUserId INTEGER NOT NULL,
      toUserId INTEGER NOT NULL,
      status TEXT DEFAULT 'pending',
      sessionId TEXT DEFAULT '',
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_interaction_trade_requests_to_status
      ON interaction_trade_requests(toUserId, status, updatedAt);

    CREATE INDEX IF NOT EXISTS idx_interaction_trade_requests_from_status
      ON interaction_trade_requests(fromUserId, status, updatedAt);

    CREATE TABLE IF NOT EXISTS interaction_report_votes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      reportId INTEGER NOT NULL,
      adminUserId INTEGER NOT NULL,
      adminName TEXT NOT NULL,
      decision TEXT NOT NULL,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(reportId, adminUserId)
    );

    CREATE TABLE IF NOT EXISTS party_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batchKey TEXT DEFAULT '',
      requestType TEXT NOT NULL,
      partyId TEXT DEFAULT '',
      fromUserId INTEGER NOT NULL,
      toUserId INTEGER NOT NULL,
      targetUserId INTEGER DEFAULT 0,
      payloadJson TEXT DEFAULT '{}',
      status TEXT DEFAULT 'pending',
      resultMessage TEXT DEFAULT '',
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS party_entanglements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userAId INTEGER NOT NULL,
      userBId INTEGER NOT NULL,
      sourcePartyId TEXT DEFAULT '',
      active INTEGER DEFAULT 1,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(userAId, userBId)
    );

    CREATE TABLE IF NOT EXISTS rp_mediation_invites (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sessionId TEXT NOT NULL,
      invitedUserId INTEGER NOT NULL,
      requestedByUserId INTEGER NOT NULL,
      requestedByName TEXT DEFAULT '',
      reason TEXT DEFAULT '',
      status TEXT DEFAULT 'pending',
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS job_challenges (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      challengerId INTEGER NOT NULL,
      holderId INTEGER NOT NULL,
      targetJobName TEXT NOT NULL,
      status TEXT DEFAULT 'voting',
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS job_challenge_votes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      challengeId INTEGER NOT NULL,
      voterId INTEGER NOT NULL,
      vote TEXT NOT NULL,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(challengeId, voterId)
    );

    CREATE TABLE IF NOT EXISTS city_prosperity (
      cityId TEXT PRIMARY KEY,
      mayorUserId INTEGER DEFAULT 0,
      mayorName TEXT DEFAULT '',
      prosperity INTEGER DEFAULT 0,
      residentCount INTEGER DEFAULT 0,
      shopCount INTEGER DEFAULT 0,
      lastSettlementDate TEXT DEFAULT '',
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS city_shops (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cityId TEXT NOT NULL,
      ownerUserId INTEGER NOT NULL,
      ownerName TEXT DEFAULT '',
      shopName TEXT NOT NULL,
      description TEXT DEFAULT '',
      status TEXT DEFAULT 'active',
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(cityId, ownerUserId)
    );

    CREATE TABLE IF NOT EXISTS ghost_materialization (
      userId INTEGER PRIMARY KEY,
      state TEXT DEFAULT 'ethereal',
      lastToggleAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      mpCost INTEGER DEFAULT 0,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS mediation_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sessionId TEXT NOT NULL,
      requesterUserId INTEGER NOT NULL,
      requesterName TEXT DEFAULT '',
      targetUserId INTEGER NOT NULL,
      targetName TEXT DEFAULT '',
      reason TEXT DEFAULT '',
      status TEXT DEFAULT 'pending',
      mediatorUserId INTEGER DEFAULT 0,
      mediatorName TEXT DEFAULT '',
      reward INTEGER DEFAULT 1000,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_mediation_requests_status
      ON mediation_requests(status, createdAt);

    CREATE TABLE IF NOT EXISTS army_arbitrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      plaintiffUserId INTEGER NOT NULL,
      plaintiffName TEXT DEFAULT '',
      defendantUserId INTEGER NOT NULL,
      defendantName TEXT DEFAULT '',
      reason TEXT NOT NULL,
      evidence TEXT DEFAULT '',
      status TEXT DEFAULT 'pending',
      judgeUserId INTEGER DEFAULT 0,
      judgeName TEXT DEFAULT '',
      verdict TEXT DEFAULT '',
      penalty TEXT DEFAULT '',
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS army_arbitration_votes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      arbitrationId INTEGER NOT NULL,
      voterUserId INTEGER NOT NULL,
      voterName TEXT DEFAULT '',
      vote TEXT NOT NULL,
      comment TEXT DEFAULT '',
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(arbitrationId, voterUserId)
    );

    CREATE TABLE IF NOT EXISTS sensitive_operation_confirmations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER NOT NULL,
      operationType TEXT NOT NULL,
      operationData TEXT DEFAULT '{}',
      status TEXT DEFAULT 'pending',
      confirmedAt DATETIME,
      expiresAt DATETIME NOT NULL,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_sensitive_confirmations_user_status
      ON sensitive_operation_confirmations(userId, status, expiresAt);

    CREATE TABLE IF NOT EXISTS faction_custom_roles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      locationId TEXT NOT NULL,
      factionName TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      minAge INTEGER DEFAULT 16,
      minMentalRank TEXT DEFAULT '',
      minPhysicalRank TEXT DEFAULT '',
      maxMembers INTEGER DEFAULT 0,
      salary INTEGER DEFAULT 0,
      createdByUserId INTEGER DEFAULT 0,
      isActive INTEGER DEFAULT 1,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(locationId, title)
    );

    CREATE INDEX IF NOT EXISTS idx_faction_custom_roles_location_active
      ON faction_custom_roles(locationId, isActive, updatedAt);

    CREATE TABLE IF NOT EXISTS custom_factions (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      description TEXT DEFAULT '',
      ownerUserId INTEGER NOT NULL,
      ownerName TEXT DEFAULT '',
      leaderTitle TEXT DEFAULT '???',
      pointX REAL NOT NULL,
      pointY REAL NOT NULL,
      mapImageUrl TEXT DEFAULT '',
      pointType TEXT DEFAULT 'safe',
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_custom_factions_owner
      ON custom_factions(ownerUserId, updatedAt);

    CREATE TABLE IF NOT EXISTS custom_faction_nodes (
      id TEXT PRIMARY KEY,
      factionId TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      x REAL NOT NULL,
      y REAL NOT NULL,
      dailyInteractionLimit INTEGER DEFAULT 1,
      salary INTEGER DEFAULT 0,
      createdByUserId INTEGER DEFAULT 0,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_custom_faction_nodes_faction
      ON custom_faction_nodes(factionId, updatedAt);

    CREATE TABLE IF NOT EXISTS custom_faction_node_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nodeId TEXT NOT NULL,
      factionId TEXT NOT NULL,
      userId INTEGER NOT NULL,
      dateKey TEXT NOT NULL,
      interactionCount INTEGER DEFAULT 0,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(nodeId, userId, dateKey)
    );

    CREATE INDEX IF NOT EXISTS idx_custom_faction_node_logs_lookup
      ON custom_faction_node_logs(nodeId, userId, dateKey);
  `);
}


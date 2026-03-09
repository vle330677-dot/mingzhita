import type { AppDatabase } from './types';

export async function runSchema(db: AppDatabase) {
  const statements: string[] = [
    `
    CREATE TABLE IF NOT EXISTS users (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      name VARCHAR(191) UNIQUE,
      age INT DEFAULT 18,
      role VARCHAR(64),
      faction VARCHAR(128),
      mentalRank VARCHAR(64),
      physicalRank VARCHAR(64),
      gold INT DEFAULT 0,
      ability VARCHAR(255),
      spiritName VARCHAR(191),
      spiritType VARCHAR(128),
      spiritIntimacy INT DEFAULT 0,
      spiritLevel INT DEFAULT 1,
      spiritImageUrl VARCHAR(1024) DEFAULT '',
      spiritAppearance VARCHAR(1024) DEFAULT '',
      spiritNameLocked TINYINT(1) DEFAULT 0,
      spiritAvatarLocked TINYINT(1) DEFAULT 0,
      spiritAppearanceLocked TINYINT(1) DEFAULT 0,
      spiritInteractDate VARCHAR(32),
      spiritFeedCount INT DEFAULT 0,
      spiritPetCount INT DEFAULT 0,
      spiritTrainCount INT DEFAULT 0,
      avatarUrl VARCHAR(1024),
      avatarUpdatedAt VARCHAR(64),
      status VARCHAR(64) DEFAULT 'pending',
      deathDescription TEXT,
      profileText TEXT,
      isHidden TINYINT(1) DEFAULT 0,
      currentLocation VARCHAR(191),
      homeLocation VARCHAR(191),
      job VARCHAR(128) DEFAULT '无',
      hp INT DEFAULT 100,
      maxHp INT DEFAULT 100,
      mp INT DEFAULT 100,
      maxMp INT DEFAULT 100,
      mentalProgress DOUBLE DEFAULT 0,
      workCount INT DEFAULT 0,
      trainCount INT DEFAULT 0,
      lastResetDate VARCHAR(32),
      lastCheckInDate VARCHAR(32),
      password VARCHAR(255),
      loginPasswordHash VARCHAR(255),
      roomPasswordHash VARCHAR(255),
      roomBgImage VARCHAR(1024),
      roomDescription TEXT,
      allowVisit TINYINT(1) DEFAULT 1,
      fury INT DEFAULT 0,
      guideStability INT DEFAULT 100,
      partyId VARCHAR(191) DEFAULT NULL,
      adminAvatarUrl VARCHAR(1024),
      forceOfflineAt VARCHAR(64),
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )
    `,

    `
    CREATE TABLE IF NOT EXISTS announcements (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      type VARCHAR(64) DEFAULT 'system',
      title VARCHAR(255) NOT NULL,
      content TEXT NOT NULL,
      extraJson VARCHAR(4096),
      payload VARCHAR(4096),
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_at DATETIME
    )
    `,

    `
    CREATE TABLE IF NOT EXISTS user_sessions (
      token VARCHAR(191) PRIMARY KEY,
      userId BIGINT NOT NULL,
      userName VARCHAR(191) NOT NULL,
      role VARCHAR(64) DEFAULT 'player',
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      lastSeenAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      revokedAt DATETIME
    )
    `,

    `
    CREATE TABLE IF NOT EXISTS admin_whitelist (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      name VARCHAR(191) NOT NULL UNIQUE,
      code_name VARCHAR(191),
      enabled TINYINT(1) DEFAULT 1,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )
    `,

    `
    CREATE TABLE IF NOT EXISTS admin_action_logs (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      adminName VARCHAR(191) NOT NULL,
      action VARCHAR(128) NOT NULL,
      targetType VARCHAR(64),
      targetId VARCHAR(191),
      detail TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )
    `,

    `
    CREATE TABLE IF NOT EXISTS system_migrations (
      migration_key VARCHAR(191) PRIMARY KEY,
      appliedAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )
    `,

    `
    CREATE TABLE IF NOT EXISTS items (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      name VARCHAR(191) NOT NULL,
      description TEXT,
      locationTag VARCHAR(191) DEFAULT '',
      npcId VARCHAR(191),
      price INT DEFAULT 0,
      faction VARCHAR(128) DEFAULT '通用',
      tier VARCHAR(64) DEFAULT '低阶',
      itemType VARCHAR(64) DEFAULT '回复道具',
      effectValue INT DEFAULT 0,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )
    `,

    `
    CREATE TABLE IF NOT EXISTS skills (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      name VARCHAR(191) NOT NULL UNIQUE,
      faction VARCHAR(128) DEFAULT '通用',
      tier VARCHAR(64) DEFAULT '低阶',
      description TEXT,
      npcId VARCHAR(191),
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )
    `,

    `
    CREATE TABLE IF NOT EXISTS user_skills (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      userId BIGINT NOT NULL,
      skillId BIGINT NOT NULL,
      level INT DEFAULT 1,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_user_skill (userId, skillId)
    )
    `,

    `
    CREATE TABLE IF NOT EXISTS active_rp_sessions (
      id VARCHAR(191) PRIMARY KEY,
      locationId VARCHAR(191),
      locationName VARCHAR(255),
      status VARCHAR(64) DEFAULT 'active',
      endProposedBy BIGINT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )
    `,

    `
    CREATE TABLE IF NOT EXISTS active_rp_members (
      sessionId VARCHAR(191) NOT NULL,
      userId BIGINT NOT NULL,
      userName VARCHAR(191) NOT NULL,
      role VARCHAR(64) DEFAULT '',
      PRIMARY KEY (sessionId, userId)
    )
    `,

    `
    CREATE TABLE IF NOT EXISTS active_rp_messages (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      sessionId VARCHAR(191) NOT NULL,
      senderId BIGINT,
      senderName VARCHAR(191),
      content TEXT,
      type VARCHAR(64) DEFAULT 'user',
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )
    `,

    `
    CREATE TABLE IF NOT EXISTS active_rp_leaves (
      sessionId VARCHAR(191) NOT NULL,
      userId BIGINT NOT NULL,
      leftAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (sessionId, userId)
    )
    `,

    `
    CREATE TABLE IF NOT EXISTS active_group_rp_members (
      locationId VARCHAR(191) NOT NULL,
      dateKey VARCHAR(32) NOT NULL,
      archiveId VARCHAR(191) NOT NULL,
      userId BIGINT NOT NULL,
      userName VARCHAR(191) NOT NULL,
      joinedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (locationId, dateKey, userId)
    )
    `,

    `
    CREATE INDEX idx_active_group_rp_members_archive
      ON active_group_rp_members(archiveId, updatedAt)
    `,

    `
    CREATE TABLE IF NOT EXISTS rp_archives (
      id VARCHAR(191) PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      locationId VARCHAR(191),
      locationName VARCHAR(255),
      participants VARCHAR(4096),
      participantNames VARCHAR(4096),
      status VARCHAR(64) DEFAULT 'active',
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )
    `,

    `
    CREATE TABLE IF NOT EXISTS rp_archive_messages (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      archiveId VARCHAR(191) NOT NULL,
      senderId BIGINT,
      senderName VARCHAR(191),
      content TEXT,
      type VARCHAR(64) DEFAULT 'user',
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )
    `,

    `
    CREATE TABLE IF NOT EXISTS interaction_skip_requests (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      fromUserId BIGINT NOT NULL,
      toUserId BIGINT NOT NULL,
      actionType VARCHAR(64) NOT NULL,
      payloadJson VARCHAR(4096) DEFAULT '{}',
      status VARCHAR(64) DEFAULT 'pending',
      resultMessage VARCHAR(1024) DEFAULT '',
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )
    `,

    `
    CREATE TABLE IF NOT EXISTS interaction_reports (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      reporterId BIGINT NOT NULL,
      targetId BIGINT NOT NULL,
      reason VARCHAR(1024) NOT NULL,
      status VARCHAR(64) DEFAULT 'pending',
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )
    `,

    `
    CREATE TABLE IF NOT EXISTS interaction_trade_logs (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      fromUserId BIGINT NOT NULL,
      toUserId BIGINT NOT NULL,
      mode VARCHAR(64) NOT NULL,
      payloadJson VARCHAR(4096) DEFAULT '{}',
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )
    `,

    `
    CREATE TABLE IF NOT EXISTS interaction_events (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      userId BIGINT NOT NULL,
      sourceUserId BIGINT DEFAULT 0,
      targetUserId BIGINT DEFAULT 0,
      actionType VARCHAR(64) DEFAULT '',
      title VARCHAR(255) DEFAULT '',
      message VARCHAR(1024) NOT NULL,
      payloadJson VARCHAR(4096) DEFAULT '{}',
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )
    `,

    `
    CREATE INDEX idx_interaction_events_user_id
      ON interaction_events(userId, id)
    `,

    `
    CREATE TABLE IF NOT EXISTS interaction_trade_sessions (
      id VARCHAR(191) PRIMARY KEY,
      userAId BIGINT NOT NULL,
      userBId BIGINT NOT NULL,
      status VARCHAR(64) DEFAULT 'pending',
      confirmA TINYINT(1) DEFAULT 0,
      confirmB TINYINT(1) DEFAULT 0,
      cancelledBy BIGINT DEFAULT 0,
      completedAt DATETIME,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )
    `,

    `
    CREATE INDEX idx_interaction_trade_sessions_pair_status
      ON interaction_trade_sessions(userAId, userBId, status, updatedAt)
    `,

    `
    CREATE TABLE IF NOT EXISTS interaction_trade_offers (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      sessionId VARCHAR(191) NOT NULL,
      userId BIGINT NOT NULL,
      itemName VARCHAR(191) DEFAULT '',
      qty INT DEFAULT 0,
      gold INT DEFAULT 0,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_trade_offer (sessionId, userId)
    )
    `,

    `
    CREATE TABLE IF NOT EXISTS interaction_trade_requests (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      fromUserId BIGINT NOT NULL,
      toUserId BIGINT NOT NULL,
      status VARCHAR(64) DEFAULT 'pending',
      sessionId VARCHAR(191) DEFAULT '',
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )
    `,

    `
    CREATE INDEX idx_interaction_trade_requests_to_status
      ON interaction_trade_requests(toUserId, status, updatedAt)
    `,

    `
    CREATE INDEX idx_interaction_trade_requests_from_status
      ON interaction_trade_requests(fromUserId, status, updatedAt)
    `,

    `
    CREATE TABLE IF NOT EXISTS interaction_report_votes (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      reportId BIGINT NOT NULL,
      adminUserId BIGINT NOT NULL,
      adminName VARCHAR(191) NOT NULL,
      decision VARCHAR(64) NOT NULL,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_report_admin (reportId, adminUserId)
    )
    `,

    `
    CREATE TABLE IF NOT EXISTS party_requests (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      batchKey VARCHAR(191) DEFAULT '',
      requestType VARCHAR(64) NOT NULL,
      partyId VARCHAR(191) DEFAULT '',
      fromUserId BIGINT NOT NULL,
      toUserId BIGINT NOT NULL,
      targetUserId BIGINT DEFAULT 0,
      payloadJson VARCHAR(4096) DEFAULT '{}',
      status VARCHAR(64) DEFAULT 'pending',
      resultMessage VARCHAR(1024) DEFAULT '',
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )
    `,

    `
    CREATE TABLE IF NOT EXISTS party_entanglements (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      userAId BIGINT NOT NULL,
      userBId BIGINT NOT NULL,
      sourcePartyId VARCHAR(191) DEFAULT '',
      active TINYINT(1) DEFAULT 1,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_party_entangle (userAId, userBId)
    )
    `,

    `
    CREATE TABLE IF NOT EXISTS rp_mediation_invites (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      sessionId VARCHAR(191) NOT NULL,
      invitedUserId BIGINT NOT NULL,
      requestedByUserId BIGINT NOT NULL,
      requestedByName VARCHAR(191) DEFAULT '',
      reason VARCHAR(1024) DEFAULT '',
      status VARCHAR(64) DEFAULT 'pending',
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )
    `,

    `
    CREATE TABLE IF NOT EXISTS job_challenges (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      challengerId BIGINT NOT NULL,
      holderId BIGINT NOT NULL,
      targetJobName VARCHAR(191) NOT NULL,
      status VARCHAR(64) DEFAULT 'voting',
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )
    `,

    `
    CREATE TABLE IF NOT EXISTS job_challenge_votes (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      challengeId BIGINT NOT NULL,
      voterId BIGINT NOT NULL,
      vote VARCHAR(64) NOT NULL,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_job_vote (challengeId, voterId)
    )
    `,

    `
    CREATE TABLE IF NOT EXISTS city_prosperity (
      cityId VARCHAR(191) PRIMARY KEY,
      mayorUserId BIGINT DEFAULT 0,
      mayorName VARCHAR(191) DEFAULT '',
      prosperity INT DEFAULT 0,
      residentCount INT DEFAULT 0,
      shopCount INT DEFAULT 0,
      lastSettlementDate VARCHAR(32) DEFAULT '',
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )
    `,

    `
    CREATE TABLE IF NOT EXISTS city_shops (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      cityId VARCHAR(191) NOT NULL,
      ownerUserId BIGINT NOT NULL,
      ownerName VARCHAR(191) DEFAULT '',
      shopName VARCHAR(191) NOT NULL,
      description TEXT,
      status VARCHAR(64) DEFAULT 'active',
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_city_owner (cityId, ownerUserId)
    )
    `,

    `
    CREATE TABLE IF NOT EXISTS ghost_materialization (
      userId BIGINT PRIMARY KEY,
      state VARCHAR(64) DEFAULT 'ethereal',
      lastToggleAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      mpCost INT DEFAULT 0,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )
    `,

    `
    CREATE TABLE IF NOT EXISTS mediation_requests (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      sessionId VARCHAR(191) NOT NULL,
      requesterUserId BIGINT NOT NULL,
      requesterName VARCHAR(191) DEFAULT '',
      targetUserId BIGINT NOT NULL,
      targetName VARCHAR(191) DEFAULT '',
      reason VARCHAR(1024) DEFAULT '',
      status VARCHAR(64) DEFAULT 'pending',
      mediatorUserId BIGINT DEFAULT 0,
      mediatorName VARCHAR(191) DEFAULT '',
      reward INT DEFAULT 1000,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )
    `,

    `
    CREATE INDEX idx_mediation_requests_status
      ON mediation_requests(status, createdAt)
    `,

    `
    CREATE TABLE IF NOT EXISTS army_arbitrations (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      plaintiffUserId BIGINT NOT NULL,
      plaintiffName VARCHAR(191) DEFAULT '',
      defendantUserId BIGINT NOT NULL,
      defendantName VARCHAR(191) DEFAULT '',
      reason VARCHAR(1024) NOT NULL,
      evidence VARCHAR(4096) DEFAULT '',
      status VARCHAR(64) DEFAULT 'pending',
      judgeUserId BIGINT DEFAULT 0,
      judgeName VARCHAR(191) DEFAULT '',
      verdict VARCHAR(1024) DEFAULT '',
      penalty VARCHAR(1024) DEFAULT '',
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )
    `,

    `
    CREATE TABLE IF NOT EXISTS army_arbitration_votes (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      arbitrationId BIGINT NOT NULL,
      voterUserId BIGINT NOT NULL,
      voterName VARCHAR(191) DEFAULT '',
      vote VARCHAR(64) NOT NULL,
      comment VARCHAR(1024) DEFAULT '',
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_arbitration_vote (arbitrationId, voterUserId)
    )
    `,

    `
    CREATE TABLE IF NOT EXISTS sensitive_operation_confirmations (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      userId BIGINT NOT NULL,
      operationType VARCHAR(128) NOT NULL,
      operationData VARCHAR(4096) DEFAULT '{}',
      status VARCHAR(64) DEFAULT 'pending',
      confirmedAt DATETIME,
      expiresAt DATETIME NOT NULL,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )
    `,

    `
    CREATE INDEX idx_sensitive_confirmations_user_status
      ON sensitive_operation_confirmations(userId, status, expiresAt)
    `,

    `
    CREATE TABLE IF NOT EXISTS faction_custom_roles (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      locationId VARCHAR(191) NOT NULL,
      factionName VARCHAR(191) NOT NULL,
      title VARCHAR(191) NOT NULL,
      description VARCHAR(1024) DEFAULT '',
      minAge INT DEFAULT 16,
      minMentalRank VARCHAR(64) DEFAULT '',
      minPhysicalRank VARCHAR(64) DEFAULT '',
      maxMembers INT DEFAULT 0,
      salary INT DEFAULT 0,
      createdByUserId BIGINT DEFAULT 0,
      isActive TINYINT(1) DEFAULT 1,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_location_title (locationId, title)
    )
    `,

    `
    CREATE INDEX idx_faction_custom_roles_location_active
      ON faction_custom_roles(locationId, isActive, updatedAt)
    `,

    `
    CREATE TABLE IF NOT EXISTS custom_factions (
      id VARCHAR(191) PRIMARY KEY,
      name VARCHAR(191) NOT NULL UNIQUE,
      description VARCHAR(1024) DEFAULT '',
      ownerUserId BIGINT NOT NULL,
      ownerName VARCHAR(191) DEFAULT '',
      leaderTitle VARCHAR(191) DEFAULT '???',
      pointX DOUBLE NOT NULL,
      pointY DOUBLE NOT NULL,
      mapImageUrl VARCHAR(1024) DEFAULT '',
      pointType VARCHAR(64) DEFAULT 'safe',
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )
    `,

    `
    CREATE INDEX idx_custom_factions_owner
      ON custom_factions(ownerUserId, updatedAt)
    `,

    `
    CREATE TABLE IF NOT EXISTS custom_faction_nodes (
      id VARCHAR(191) PRIMARY KEY,
      factionId VARCHAR(191) NOT NULL,
      name VARCHAR(191) NOT NULL,
      description VARCHAR(1024) DEFAULT '',
      x DOUBLE NOT NULL,
      y DOUBLE NOT NULL,
      dailyInteractionLimit INT DEFAULT 1,
      salary INT DEFAULT 0,
      createdByUserId BIGINT DEFAULT 0,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )
    `,

    `
    CREATE INDEX idx_custom_faction_nodes_faction
      ON custom_faction_nodes(factionId, updatedAt)
    `,

    `
    CREATE TABLE IF NOT EXISTS custom_faction_node_logs (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      nodeId VARCHAR(191) NOT NULL,
      factionId VARCHAR(191) NOT NULL,
      userId BIGINT NOT NULL,
      dateKey VARCHAR(32) NOT NULL,
      interactionCount INT DEFAULT 0,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_node_user_date (nodeId, userId, dateKey)
    )
    `,

    `
    CREATE INDEX idx_custom_faction_node_logs_lookup
      ON custom_faction_node_logs(nodeId, userId, dateKey)
    `,
  ];

  for (let i = 0; i < statements.length; i++) {
    const sql = statements[i].trim();
    if (!sql) continue;

    try {
      await db.exec(sql);
    } catch (error) {
      console.error(`[runSchema] failed at statement #${i + 1}`);
      console.error(sql);
      throw error;
    }
  }
}

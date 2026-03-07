import { Router } from 'express';
import { AppContext } from '../types';
import { writeAdminLog } from '../utils/common';

type AnyRow = Record<string, any>;

let gameplayRuntime: AppContext['runtime'] | null = null;

const nowIso = () => new Date().toISOString();
const afterMinutesIso = (m: number) => new Date(Date.now() + m * 60 * 1000).toISOString();
const todayKey = () => nowIso().slice(0, 10);
const rand = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

const RANK_SCORE: Record<string, number> = {
  '': 0,
  none: 0,
  D: 1,
  'D+': 2,
  C: 3,
  'C+': 4,
  B: 5,
  'B+': 6,
  A: 7,
  'A+': 8,
  S: 9,
  'S+': 10,
  SS: 11,
  'SS+': 12,
  SSS: 13,
};

const WILD_WIN_STAT_GAIN = 5;
const WILD_LOSS_STAT_PENALTY = 10;
const WILD_LOSS_HP_PCT = 0.1;
const WILD_ROLL_COOLDOWN_SECONDS = 8;
const WILD_ROLL_MP_COST = 5;
const DEMON_LOCATION = 'demon_society';
const DEMON_MEMBER_JOBS = new Set(['恶魔会会长', '恶魔会成员']);
const DEMON_LOAN_INTEREST_RATE = 0.1;
const DEMON_DAILY_SKILL_MAX = 3;
const NON_DEMON_CONTRABAND_CHANCE = 0.02;
const DEMON_CONTRABAND_CHANCE = 0.35;
const SLUM_ALLEY_ROB_DAILY_MAX = 3;
const SLUM_ALLEY_ROB_CHANCE = 0.35;
const SLUM_ALLEY_ITEM_CHANCE = 0.45;
const SLUM_ALLEY_ALCHEMY_RATE = 0.4;
const RICH_STREET_HIGH_VALUE_CHANCE = 0.6;
const RICH_STREET_COMMON_ITEM_CHANCE = 0.25;
const WILD_DEBUFF_CHANCE = 0.6;
const WILD_DEBUFF_BASE_MAX_PCT = 5;
const WILD_DEBUFF_LEVEL_CAP = 100;
const TOWER_PURIFY_MP_COST_RATIO = 0.2;
const NPC_SKILL_FACTIONS = ['物理系', '元素系', '精神系', '感知系', '信息系', '治疗系', '强化系', '炼金系'];
const MAP_LOCATION_IDS = [
  'tower_of_life',
  'london_tower',
  'sanctuary',
  'guild',
  'army',
  'slums',
  'rich_area',
  'demon_society',
  'observers',
  'tower_guard',
  'paranormal_office'
];
const MAP_LOCATION_NAME_MAP: Record<string, string> = {
  tower_of_life: '命之塔',
  london_tower: '伦敦塔',
  sanctuary: '圣所',
  guild: '工会',
  army: '军队',
  slums: '西市',
  rich_area: '东市',
  demon_society: '恶魔会',
  observers: '观察者',
  tower_guard: '守塔会',
  paranormal_office: '灵异管理所'
};
const NPC_PERSONALITY_POOL = ['温和', '古怪', '冷静', '傲慢', '热情', '阴沉', '毒舌', '谨慎', '跳脱', '严肃'];
const NPC_IDENTITY_POOL = ['情报贩子', '巡逻者', '旅店常客', '黑市中间人', '落魄贵族', '异乡学徒', '失业猎手', '地下信使'];
const NPC_APPEARANCE_POOL = ['银发灰眸，常披风衣', '黑短发，面有旧伤', '金瞳，佩戴薄框眼镜', '深色长发，戴手套', '雀斑少年，笑意轻浮', '白发高个，神情冷淡'];
const NPC_INTERACT_ACTIONS = new Set(['steal', 'rob', 'threaten', 'favor', 'chat']);
const LEGACY_WORLD_NPCS = [
  {
    name: '茉伊拉',
    skillFaction: '治疗系',
    personality: '温和',
    identity: '圣所诊疗护士',
    appearance: '浅金短发，眼神柔和，白袍整洁',
    fixedLocation: 'sanctuary',
    defaultAffinity: 62
  },
  {
    name: '烂牙维克',
    skillFaction: '信息系',
    personality: '毒舌',
    identity: '恶魔会黑市老板',
    appearance: '寸头、旧皮衣、嘴角总挂着冷笑',
    fixedLocation: 'demon_society',
    defaultAffinity: 38
  },
  {
    name: '老霍恩',
    skillFaction: '强化系',
    personality: '古怪',
    identity: '酒馆调酒师',
    appearance: '络腮胡，手背纹着旧公会徽记',
    fixedLocation: 'guild',
    defaultAffinity: 54
  }
] as const;
const LOCATION_INTEL_POOL: Record<string, string[]> = {
  tower_of_life: ['命之塔高层近期在整理净化仪式名册。', '命之塔里流出的高阶素材通常先经过侍奉者筛选。'],
  london_tower: ['伦敦塔近期对契合度数据做了新一轮封存。', '伦敦塔毕业名单里有一批战术课程优秀生。'],
  sanctuary: ['圣所诊所今天补进了几箱稀缺药剂。', '圣所的夜班护士知道不少关于伤势恢复的捷径。'],
  guild: ['工会拍卖台今晚会有高阶委托素材流出。', '工会酒馆里正在私下交换界域掉落情报。'],
  army: ['军队训练场最近在招募体能突出的外编成员。', '军械库正在回收旧制式装备。'],
  slums: ['西市小巷今天盯梢的人比平时更多。', '西市炼金黑作坊最近在收低阶催化剂。'],
  rich_area: ['东市主街商队刚送到一批高价值货。', '东市会馆今晚有匿名收藏品交易。'],
  demon_society: ['恶魔会的赌桌最近常见高额抵押单。', '黑市里有人在高价收违禁品配方。'],
  observers: ['观察者图书库新增了一批密级回顾卷宗。', '观察者的情报处理员正在交换阵营动态。'],
  tower_guard: ['守塔会地下监牢最近加强了巡逻频次。', '守塔会申请抓捕审批速度提升了。'],
  paranormal_office: ['灵异管理所今天接收了新的异动报告。', '灵异管理所的档案员正在核对收容记录。']
};
const MAP_LOCATION_COORDS: Record<string, { x: number; y: number }> = {
  tower_of_life: { x: 50, y: 48 },
  sanctuary: { x: 42, y: 42 },
  london_tower: { x: 67, y: 35 },
  rich_area: { x: 70, y: 50 },
  slums: { x: 25, y: 48 },
  demon_society: { x: 12, y: 20 },
  guild: { x: 48, y: 78 },
  army: { x: 50, y: 18 },
  tower_guard: { x: 30, y: 22 },
  observers: { x: 65, y: 15 },
  paranormal_office: { x: 88, y: 15 }
};
const WORLD_NPC_RANDOM_COUNT = 14;
const WORLD_NPC_AFFINITY_MIN = 0;
const WORLD_NPC_AFFINITY_MAX = 100;
const WORLD_NPC_HIGH_AFFINITY = 70;
const WORLD_NPC_GIFT_AFFINITY = 80;
const WORLD_NPC_LOW_AFFINITY = 30;
const NPC_NAME_POOL = ['艾琳', '罗恩', '维姬', '莱特', '诺亚', '塞琳', '赫尔', '缇娜', '阿瑞', '洛芙', '卡恩', '米娅', '温莎', '塔利', '伊芙'];
const NPC_SURNAME_POOL = ['灰羽', '赤砂', '霜湾', '夜藤', '岩雀', '雾庭', '星街', '鸢尾', '旧钟', '白港'];
const NPC_ACTION_AFFINITY_DELTA: Record<string, number> = {
  steal: -8,
  rob: -16,
  threaten: -14,
  favor: 9,
  chat: 6
};
const NPC_ACTION_LABEL_MAP: Record<string, string> = {
  steal: '偷窃',
  rob: '打劫',
  threaten: '威胁',
  favor: '示好',
  chat: '闲聊'
};
const NPC_POSITIVE_REPLY_POOL = [
  '你今天说话很中听，拿着吧，别声张。',
  '你帮过我，这点小礼物算回礼。',
  '你是少数让我愿意多聊两句的人。'
];
const NPC_NEUTRAL_REPLY_POOL = [
  '嗯，先记着你这份心意。',
  '这地方消息多，别乱传。',
  '我还在观察你。'
];
const NPC_NEGATIVE_REPLY_POOL = [
  '离我远点，我不想再看到你。',
  '你这副做派，别想从我这拿到情报。',
  '我记住你了，别再惹事。'
];
const NPC_RUDE_REPLY_POOL = [
  '滚开，别浪费我时间。',
  '想套情报？做梦。',
  '你的信誉在我这里已经归零。'
];

const isSentinelRole = (role: string) => {
  const raw = String(role || '');
  const low = raw.toLowerCase();
  return low === 'sentinel' || raw === '哨兵';
};
const isGuideRole = (role: string) => {
  const raw = String(role || '');
  const low = raw.toLowerCase();
  return low === 'guide' || raw === '向导';
};
const canLearnSkillByFaction = (user: AnyRow | undefined, skillFactionRaw: any) => {
  const skillFaction = String(skillFactionRaw || '通用').trim();
  if (!user) return false;
  if (!skillFaction || skillFaction === '通用') return true;
  const faction = String(user.faction || '').trim();
  const role = String(user.role || '').trim();
  const signals = [faction, role].filter(Boolean);
  if (signals.length === 0) return skillFaction === '普通人';
  return signals.some((x) => x === skillFaction || x.includes(skillFaction));
};
const canUseSpiritSystem = (role: string) => isSentinelRole(role) || isGuideRole(role);

const SPIRIT_ACTIONS = {
  feed: { gain: 5, counter: 'spiritFeedCount' },
  pet: { gain: 8, counter: 'spiritPetCount' },
  train: { gain: 3, counter: 'spiritTrainCount' }
} as const;
const MENTAL_RANK_ORDER = ['无', 'F', 'E', 'D', 'C', 'C+', 'B', 'B+', 'A', 'A+', 'S', 'S+', 'SS', 'SS+', 'SSS'];

type SpiritAction = keyof typeof SPIRIT_ACTIONS;

function normalizeSpiritAction(raw: any, fallbackGainRaw: any): SpiritAction | '' {
  const action = String(raw || '').trim().toLowerCase();
  if (action === 'feed' || action === 'pet' || action === 'train') return action;

  const g = Number(fallbackGainRaw || 0);
  // 兼容旧前端：摸摸=5、喂食=10、训练=15
  if (g === 10) return 'feed';
  if (g === 5) return 'pet';
  if (g === 15) return 'train';
  return '';
}
function compatibilityScore(nameA: string, nameB: string) {
  const [a, b] = [String(nameA || ''), String(nameB || '')].sort();
  const s = `${a}#${b}`;
  let h = 0;
  for (let i = 0; i < s.length; i++) h = s.charCodeAt(i) + ((h << 5) - h);
  return Math.abs(h % 101);
}

function compatRoleType(roleRaw: any) {
  const raw = String(roleRaw || '').trim();
  const low = raw.toLowerCase();
  if (raw === '哨兵' || low === 'sentinel') return 'sentinel';
  if (raw === '向导' || low === 'guide') return 'guide';
  return '';
}

function isLondonCompatEligibleUser(user: AnyRow | undefined) {
  if (!user) return false;
  return Number(user.age || 0) >= 19 && !!compatRoleType(user.role);
}

function isLondonCompatOptedInUser(user: AnyRow | undefined) {
  if (!isLondonCompatEligibleUser(user)) return false;
  return Number(user?.londonCompatOptIn || 0) === 1;
}

function ensureTables(db: any) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS notes (
      ownerId INTEGER NOT NULL,
      targetId INTEGER NOT NULL,
      content TEXT DEFAULT '',
      updatedAt TEXT DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (ownerId, targetId)
    );

    CREATE TABLE IF NOT EXISTS inventory (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER NOT NULL,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      qty INTEGER DEFAULT 1,
      itemType TEXT DEFAULT 'consumable',
      effectValue INTEGER DEFAULT 0,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS rescue_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      patientId INTEGER NOT NULL,
      healerId INTEGER DEFAULT 0,
      status TEXT DEFAULT 'pending',
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
      updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS graveyard_tombstones (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER,
      name TEXT NOT NULL,
      deathDescription TEXT DEFAULT '',
      role TEXT DEFAULT '',
      mentalRank TEXT DEFAULT '',
      physicalRank TEXT DEFAULT '',
      ability TEXT DEFAULT '',
      spiritName TEXT DEFAULT '',
      isHidden INTEGER DEFAULT 0,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS graveyard_comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tombstoneId INTEGER NOT NULL,
      userId INTEGER NOT NULL,
      userName TEXT NOT NULL,
      content TEXT NOT NULL,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS interaction_skip_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fromUserId INTEGER NOT NULL,
      toUserId INTEGER NOT NULL,
      actionType TEXT NOT NULL,
      payloadJson TEXT DEFAULT '{}',
      status TEXT DEFAULT 'pending',
      resultMessage TEXT DEFAULT '',
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
      updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS interaction_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      reporterId INTEGER NOT NULL,
      targetId INTEGER NOT NULL,
      reason TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
      updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS interaction_trade_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fromUserId INTEGER NOT NULL,
      toUserId INTEGER NOT NULL,
      mode TEXT NOT NULL,
      payloadJson TEXT DEFAULT '{}',
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP
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
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP
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
      completedAt TEXT,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
      updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
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
      updatedAt TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(sessionId, userId)
    );

    CREATE TABLE IF NOT EXISTS interaction_trade_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fromUserId INTEGER NOT NULL,
      toUserId INTEGER NOT NULL,
      status TEXT DEFAULT 'pending',
      sessionId TEXT DEFAULT '',
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
      updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
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
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
      updatedAt TEXT DEFAULT CURRENT_TIMESTAMP,
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
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
      updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS party_entanglements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userAId INTEGER NOT NULL,
      userBId INTEGER NOT NULL,
      sourcePartyId TEXT DEFAULT '',
      active INTEGER DEFAULT 1,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
      updatedAt TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(userAId, userBId)
    );

    CREATE TABLE IF NOT EXISTS wild_monsters (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT DEFAULT '',
      minLevel INTEGER DEFAULT 1,
      maxLevel INTEGER DEFAULT 12,
      basePower REAL DEFAULT 10,
      baseHp INTEGER DEFAULT 100,
      dropItemName TEXT DEFAULT 'Monster Core',
      dropChance REAL DEFAULT 0.7,
      enabled INTEGER DEFAULT 1,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS wild_encounters (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER NOT NULL UNIQUE,
      eventType TEXT DEFAULT 'monster',
      monsterId INTEGER DEFAULT 0,
      monsterLevel INTEGER DEFAULT 1,
      expiresAt TEXT,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS wild_battle_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER NOT NULL,
      eventType TEXT DEFAULT 'monster',
      monsterId INTEGER DEFAULT 0,
      monsterName TEXT DEFAULT '',
      monsterLevel INTEGER DEFAULT 0,
      isWin INTEGER DEFAULT 0,
      resultText TEXT DEFAULT '',
      hpDelta INTEGER DEFAULT 0,
      mentalDelta REAL DEFAULT 0,
      physicalDelta REAL DEFAULT 0,
      droppedItem TEXT DEFAULT '',
      returnedTo TEXT DEFAULT '',
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS demon_loans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER NOT NULL,
      principal INTEGER DEFAULT 0,
      interestRate REAL DEFAULT 0.1,
      totalDue INTEGER DEFAULT 0,
      repaidAmount INTEGER DEFAULT 0,
      status TEXT DEFAULT 'open',
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
      updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS demon_gamble_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      challengerId INTEGER NOT NULL,
      challengerName TEXT DEFAULT '',
      targetId INTEGER NOT NULL,
      targetName TEXT DEFAULT '',
      amount INTEGER DEFAULT 0,
      status TEXT DEFAULT 'pending',
      responderId INTEGER DEFAULT 0,
      challengerRoll INTEGER DEFAULT 0,
      targetRoll INTEGER DEFAULT 0,
      winnerId INTEGER DEFAULT 0,
      loserId INTEGER DEFAULT 0,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
      updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_demon_gamble_target_status
      ON demon_gamble_requests(targetId, status, updatedAt);
    CREATE INDEX IF NOT EXISTS idx_demon_gamble_challenger_status
      ON demon_gamble_requests(challengerId, status, updatedAt);

    CREATE TABLE IF NOT EXISTS legacy_commissions (
      id TEXT PRIMARY KEY,
      publisherUserId INTEGER NOT NULL,
      title TEXT DEFAULT '',
      reward INTEGER DEFAULT 0,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
      updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS world_npcs (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      skillFaction TEXT DEFAULT '通用',
      personality TEXT DEFAULT '',
      identity TEXT DEFAULT '',
      appearance TEXT DEFAULT '',
      currentLocation TEXT DEFAULT '',
      mapX REAL DEFAULT 50,
      mapY REAL DEFAULT 50,
      isLegacy INTEGER DEFAULT 0,
      defaultAffinity INTEGER DEFAULT 50,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
      updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS world_npc_relations (
      userId INTEGER NOT NULL,
      npcId TEXT NOT NULL,
      affinity INTEGER DEFAULT 50,
      lastAction TEXT DEFAULT '',
      lastActionAt TEXT DEFAULT CURRENT_TIMESTAMP,
      interactionCount INTEGER DEFAULT 0,
      lastRewardDate TEXT DEFAULT '',
      rewardCount INTEGER DEFAULT 0,
      PRIMARY KEY (userId, npcId)
    );

    CREATE TABLE IF NOT EXISTS world_npc_runtime (
      key TEXT PRIMARY KEY,
      value TEXT DEFAULT '',
      updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  try {
    db.exec(`ALTER TABLE users ADD COLUMN guideStability INTEGER DEFAULT 100`);
  } catch {}
  try {
    db.exec(`ALTER TABLE users ADD COLUMN lastCombatAt TEXT`);
  } catch {}
  try {
    db.exec(`ALTER TABLE users ADD COLUMN spiritIntimacy INTEGER DEFAULT 0`);
  } catch {}
  try {
    db.exec(`ALTER TABLE users ADD COLUMN spiritLevel INTEGER DEFAULT 1`);
  } catch {}
  try {
    db.exec(`ALTER TABLE users ADD COLUMN spiritImageUrl TEXT DEFAULT ''`);
  } catch {}
  try {
    db.exec(`ALTER TABLE users ADD COLUMN spiritAppearance TEXT DEFAULT ''`);
  } catch {}
  try {
    db.exec(`ALTER TABLE users ADD COLUMN spiritNameLocked INTEGER DEFAULT 0`);
  } catch {}
  try {
    db.exec(`ALTER TABLE users ADD COLUMN spiritAvatarLocked INTEGER DEFAULT 0`);
  } catch {}
  try {
    db.exec(`ALTER TABLE users ADD COLUMN spiritAppearanceLocked INTEGER DEFAULT 0`);
  } catch {}
  try {
    db.exec(`ALTER TABLE users ADD COLUMN spiritInteractDate TEXT`);
  } catch {}
  try {
    db.exec(`ALTER TABLE users ADD COLUMN spiritFeedCount INTEGER DEFAULT 0`);
  } catch {}
  try {
    db.exec(`ALTER TABLE users ADD COLUMN spiritPetCount INTEGER DEFAULT 0`);
  } catch {}
  try {
    db.exec(`ALTER TABLE users ADD COLUMN spiritTrainCount INTEGER DEFAULT 0`);
  } catch {}
  try {
    db.exec(`ALTER TABLE users ADD COLUMN physicalProgress REAL DEFAULT 0`);
  } catch {}
  try {
    db.exec(`ALTER TABLE users ADD COLUMN lastWildRollAt TEXT`);
  } catch {}
  try {
    db.exec(`ALTER TABLE users ADD COLUMN demonSkillDate TEXT`);
  } catch {}
  try {
    db.exec(`ALTER TABLE users ADD COLUMN demonSkillCount INTEGER DEFAULT 0`);
  } catch {}
  try {
    db.exec(`ALTER TABLE users ADD COLUMN slumAlleyDate TEXT`);
  } catch {}
  try {
    db.exec(`ALTER TABLE users ADD COLUMN slumAlleyRobbedCount INTEGER DEFAULT 0`);
  } catch {}
  try {
    db.exec(`ALTER TABLE users ADD COLUMN slumAlleyStrollCount INTEGER DEFAULT 0`);
  } catch {}
  try {
    db.exec(`ALTER TABLE users ADD COLUMN richStreetDate TEXT`);
  } catch {}
  try {
    db.exec(`ALTER TABLE users ADD COLUMN richStreetStrollCount INTEGER DEFAULT 0`);
  } catch {}
  try {
    db.exec(`ALTER TABLE users ADD COLUMN erosionLevel REAL DEFAULT 0`);
  } catch {}
  try {
    db.exec(`ALTER TABLE users ADD COLUMN bleedingLevel REAL DEFAULT 0`);
  } catch {}
  try {
    db.exec(`ALTER TABLE users ADD COLUMN londonCompatPrompted INTEGER DEFAULT 0`);
  } catch {}
  try {
    db.exec(`ALTER TABLE users ADD COLUMN londonCompatOptIn INTEGER DEFAULT 0`);
  } catch {}
  try {
    db.exec(`ALTER TABLE users ADD COLUMN lastResetDate TEXT`);
  } catch {}
  try {
    db.exec(`ALTER TABLE users ADD COLUMN ghostImmuneUntil TEXT DEFAULT NULL`);
  } catch {}
  try {
    db.exec(`ALTER TABLE world_npcs ADD COLUMN mapX REAL DEFAULT 50`);
  } catch {}
  try {
    db.exec(`ALTER TABLE world_npcs ADD COLUMN mapY REAL DEFAULT 50`);
  } catch {}
  try {
    db.exec(`ALTER TABLE world_npcs ADD COLUMN isLegacy INTEGER DEFAULT 0`);
  } catch {}
  try {
    db.exec(`ALTER TABLE world_npcs ADD COLUMN defaultAffinity INTEGER DEFAULT 50`);
  } catch {}
  try {
    db.exec(`ALTER TABLE world_npc_relations ADD COLUMN lastRewardDate TEXT DEFAULT ''`);
  } catch {}
  try {
    db.exec(`ALTER TABLE world_npc_relations ADD COLUMN rewardCount INTEGER DEFAULT 0`);
  } catch {}

  const hasAnyMonster = db.prepare(`SELECT id FROM wild_monsters LIMIT 1`).get() as AnyRow | undefined;
  if (!hasAnyMonster) {
    const seed = db.prepare(`
      INSERT INTO wild_monsters(name, description, minLevel, maxLevel, basePower, baseHp, dropItemName, dropChance, enabled)
      VALUES(?,?,?,?,?,?,?,?,1)
    `);
    seed.run('裂隙狼群', '擅长群体突袭的低阶魔物。', 1, 8, 8, 90, '破碎狼牙', 0.8);
    seed.run('夜魇吞噬者', '潜伏在迷雾中的高压掠食者。', 6, 16, 13, 130, '夜魇核心', 0.75);
    seed.run('空洞守卫', '古老遗迹中残存的重装守卫。', 4, 14, 11, 150, '空洞甲片', 0.7);
    seed.run('深渊巡游体', '会扭曲精神波动的异变个体。', 8, 20, 15, 170, '巡游结晶', 0.68);
  }
}

function resetDailyActionCountersIfNeeded(db: any, user: AnyRow | undefined) {
  if (!user) return user;
  const today = todayKey();
  if (String(user.lastResetDate || '') === today) return user;
  db.prepare(`
    UPDATE users
    SET workCount = 0,
        trainCount = 0,
        lastResetDate = ?,
        updatedAt = ?
    WHERE id = ?
  `).run(today, nowIso(), Number(user.id || 0));
  return db.prepare(`SELECT * FROM users WHERE id=? LIMIT 1`).get(Number(user.id || 0)) as AnyRow | undefined;
}

function getUser(db: any, id: number) {
  const row = db.prepare(`SELECT * FROM users WHERE id=? LIMIT 1`).get(id) as AnyRow | undefined;
  return resetDailyActionCountersIfNeeded(db, row);
}

function isDemonMemberJob(jobRaw: any) {
  return DEMON_MEMBER_JOBS.has(String(jobRaw || '').trim());
}

function resetDemonSkillDailyIfNeeded(db: any, user: AnyRow) {
  const today = todayKey();
  if (String(user.demonSkillDate || '') === today) return user;
  db.prepare(`
    UPDATE users
    SET demonSkillDate = ?,
        demonSkillCount = 0,
        updatedAt = ?
    WHERE id = ?
  `).run(today, nowIso(), Number(user.id || 0));
  return getUser(db, Number(user.id || 0)) || user;
}

function resetSlumAlleyDailyIfNeeded(db: any, user: AnyRow) {
  const today = todayKey();
  if (String(user.slumAlleyDate || '') === today) return user;
  db.prepare(`
    UPDATE users
    SET slumAlleyDate = ?,
        slumAlleyRobbedCount = 0,
        slumAlleyStrollCount = 0,
        updatedAt = ?
    WHERE id = ?
  `).run(today, nowIso(), Number(user.id || 0));
  return getUser(db, Number(user.id || 0)) || user;
}

function resetRichStreetDailyIfNeeded(db: any, user: AnyRow) {
  const today = todayKey();
  if (String(user.richStreetDate || '') === today) return user;
  db.prepare(`
    UPDATE users
    SET richStreetDate = ?,
        richStreetStrollCount = 0,
        updatedAt = ?
    WHERE id = ?
  `).run(today, nowIso(), Number(user.id || 0));
  return getUser(db, Number(user.id || 0)) || user;
}

function getOpenDemonLoan(db: any, userId: number) {
  const row = db.prepare(`
    SELECT id, userId, principal, interestRate, totalDue, repaidAmount, status, createdAt, updatedAt
    FROM demon_loans
    WHERE userId = ?
      AND status = 'open'
    ORDER BY id DESC
    LIMIT 1
  `).get(userId) as AnyRow | undefined;
  if (!row) return null;
  const totalDue = Math.max(0, Number(row.totalDue || 0));
  const repaid = Math.max(0, Number(row.repaidAmount || 0));
  const remaining = Math.max(0, totalDue - repaid);
  if (remaining <= 0) {
    db.prepare(`UPDATE demon_loans SET status = 'closed', updatedAt = ? WHERE id = ?`).run(nowIso(), Number(row.id || 0));
    return null;
  }
  return {
    id: Number(row.id || 0),
    userId: Number(row.userId || 0),
    principal: Math.max(0, Number(row.principal || 0)),
    interestRate: Number(row.interestRate || DEMON_LOAN_INTEREST_RATE),
    totalDue,
    repaidAmount: repaid,
    remaining,
    status: 'open',
    createdAt: String(row.createdAt || ''),
    updatedAt: String(row.updatedAt || '')
  };
}

function mapDemonGambleRequestRow(row: AnyRow | undefined | null, viewerId = 0) {
  if (!row) return null;
  const challengerId = Number(row.challengerId || 0);
  const targetId = Number(row.targetId || 0);
  const winnerId = Number(row.winnerId || 0);
  const loserId = Number(row.loserId || 0);
  const safeViewerId = Number(viewerId || 0);
  const viewerRole = safeViewerId === challengerId ? 'challenger' : safeViewerId === targetId ? 'target' : '';
  return {
    id: Number(row.id || 0),
    challengerId,
    challengerName: String(row.challengerName || ''),
    targetId,
    targetName: String(row.targetName || ''),
    amount: Math.max(1, Number(row.amount || 0)),
    status: String(row.status || 'pending'),
    responderId: Number(row.responderId || 0),
    challengerRoll: Math.max(0, Number(row.challengerRoll || 0)),
    targetRoll: Math.max(0, Number(row.targetRoll || 0)),
    winnerId,
    loserId,
    viewerRole,
    viewerWon: safeViewerId > 0 ? winnerId === safeViewerId : false,
    createdAt: String(row.createdAt || ''),
    updatedAt: String(row.updatedAt || '')
  };
}

function cancelDemonGambleRequest(db: any, requestId: number) {
  if (!requestId) return null;
  const stamp = nowIso();
  db.prepare(`
    UPDATE demon_gamble_requests
    SET status = 'cancelled',
        updatedAt = ?
    WHERE id = ?
  `).run(stamp, requestId);
  const row = db.prepare(`SELECT * FROM demon_gamble_requests WHERE id = ? LIMIT 1`).get(requestId) as AnyRow | undefined;
  return mapDemonGambleRequestRow(row);
}

function settleDemonGambleRequest(db: any, requestId: number) {
  const row = db.prepare(`SELECT * FROM demon_gamble_requests WHERE id = ? LIMIT 1`).get(requestId) as AnyRow | undefined;
  if (!row) return { ok: false, message: 'request not found', request: null };
  if (String(row.status || '') !== 'pending') {
    return { ok: false, message: 'request already processed', request: mapDemonGambleRequestRow(row) };
  }

  const challengerId = Number(row.challengerId || 0);
  const targetId = Number(row.targetId || 0);
  const amount = Math.max(1, Number(row.amount || 0));
  const challenger = getUser(db, challengerId);
  const target = getUser(db, targetId);

  if (!challenger || !target) {
    const request = cancelDemonGambleRequest(db, requestId);
    return { ok: false, message: 'One side no longer exists. The bet request was cancelled', request };
  }

  if (!['approved', 'ghost'].includes(String(challenger.status || '')) || !['approved', 'ghost'].includes(String(target.status || ''))) {
    const request = cancelDemonGambleRequest(db, requestId);
    return { ok: false, message: 'One side can no longer bet. The request was cancelled', request };
  }

  const bothInDemon = String(challenger.currentLocation || '') === DEMON_LOCATION && String(target.currentLocation || '') === DEMON_LOCATION;
  if (!bothInDemon) {
    const request = cancelDemonGambleRequest(db, requestId);
    return { ok: false, message: 'One side left the demon casino. The request was cancelled', request };
  }

  if (Number(challenger.gold || 0) < amount || Number(target.gold || 0) < amount) {
    const request = cancelDemonGambleRequest(db, requestId);
    return { ok: false, message: 'One side no longer has enough gold. The request was cancelled', request };
  }

  let challengerRoll = Math.floor(Math.random() * 6) + 1;
  let targetRoll = Math.floor(Math.random() * 6) + 1;
  while (challengerRoll === targetRoll) {
    challengerRoll = Math.floor(Math.random() * 6) + 1;
    targetRoll = Math.floor(Math.random() * 6) + 1;
  }

  const winnerId = challengerRoll > targetRoll ? challengerId : targetId;
  const loserId = winnerId === challengerId ? targetId : challengerId;
  const stamp = nowIso();
  const tx = db.transaction(() => {
    db.prepare(`UPDATE users SET gold = COALESCE(gold, 0) - ?, updatedAt = ? WHERE id = ?`).run(amount, stamp, loserId);
    db.prepare(`UPDATE users SET gold = COALESCE(gold, 0) + ?, updatedAt = ? WHERE id = ?`).run(amount, stamp, winnerId);
    db.prepare(`
      UPDATE demon_gamble_requests
      SET status = 'resolved',
          responderId = ?,
          challengerRoll = ?,
          targetRoll = ?,
          winnerId = ?,
          loserId = ?,
          updatedAt = ?
      WHERE id = ?
    `).run(targetId, challengerRoll, targetRoll, winnerId, loserId, stamp, requestId);
  });
  tx();

  const fresh = db.prepare(`SELECT * FROM demon_gamble_requests WHERE id = ? LIMIT 1`).get(requestId) as AnyRow | undefined;
  const winnerName = winnerId === challengerId ? String(challenger.name || row.challengerName || 'Someone') : String(target.name || row.targetName || 'Someone');
  return {
    ok: true,
    request: mapDemonGambleRequestRow(fresh),
    message: `${winnerName} won the duel and took ${amount}G`
  };
}

function estimateInventoryUnitPrice(db: any, inv: AnyRow | undefined) {
  if (!inv) return 0;
  const name = String(inv.name || '').trim();
  if (!name) return 0;
  const catalog = db.prepare(`
    SELECT price, tier, itemType
    FROM items
    WHERE name = ?
    ORDER BY price DESC
    LIMIT 1
  `).get(name) as AnyRow | undefined;
  if (catalog && Number(catalog.price || 0) > 0) return Math.max(1, Number(catalog.price || 0));
  const effectValue = Math.max(0, Number(inv.effectValue || 0));
  const fallback = Math.max(20, Math.floor(effectValue * 6));
  if (name.includes('技能书')) return Math.max(fallback, 120);
  return fallback;
}

function estimateItemBasePrice(item: AnyRow | undefined) {
  if (!item) return 0;
  const catalogPrice = Math.max(0, Number(item.price || 0));
  if (catalogPrice > 0) return catalogPrice;
  const effectValue = Math.max(0, Number(item.effectValue || 0));
  const fallback = Math.max(20, Math.floor(effectValue * 6));
  const name = String(item.name || '');
  if (name.includes('技能书')) return Math.max(fallback, 120);
  return fallback;
}

function randomMentalRankDowngrade(rankRaw: any) {
  const rank = String(rankRaw || '无').trim() || '无';
  const idx = MENTAL_RANK_ORDER.indexOf(rank);
  if (idx <= 0) return { dropped: false, fromRank: rank, toRank: rank };
  const toRank = MENTAL_RANK_ORDER[idx - 1];
  return { dropped: true, fromRank: rank, toRank };
}

function buildSpiritStatus(user: AnyRow | undefined) {
  return {
    name: String(user?.spiritName || ''),
    intimacy: Number(user?.spiritIntimacy || 0),
    level: Math.max(1, Number(user?.spiritLevel || 1)),
    imageUrl: String(user?.spiritImageUrl || ''),
    appearance: String(user?.spiritAppearance || ''),
    daily: {
      feed: Number(user?.spiritFeedCount || 0),
      pet: Number(user?.spiritPetCount || 0),
      train: Number(user?.spiritTrainCount || 0)
    }
  };
}

function resetSpiritDailyIfNeeded(db: any, user: AnyRow) {
  const today = todayKey();
  if (String(user.spiritInteractDate || '') === today) return user;
  db.prepare(`
    UPDATE users
    SET spiritInteractDate = ?,
        spiritFeedCount = 0,
        spiritPetCount = 0,
        spiritTrainCount = 0,
        updatedAt = ?
    WHERE id = ?
  `).run(today, nowIso(), Number(user.id));
  return getUser(db, Number(user.id)) || user;
}

function isUndifferentiated(user: AnyRow | undefined) {
  if (!user) return false;
  const role = String(user.role || '');
  return Number(user.age || 0) < 16 || role === '未分化';
}

const NEWCOMER_ROLE_WEIGHTS: Array<{ role: string; weight: number }> = [
  { role: '哨兵', weight: 40 },
  { role: '向导', weight: 40 },
  { role: '普通人', weight: 10 },
  { role: '鬼魂', weight: 10 }
];

function pickWeightedAdultRole(weights = NEWCOMER_ROLE_WEIGHTS) {
  const total = weights.reduce((sum, item) => sum + item.weight, 0);
  if (total <= 0) return '普通人';
  let cursor = Math.random() * total;
  for (const item of weights) {
    cursor -= item.weight;
    if (cursor <= 0) return item.role;
  }
  return weights[weights.length - 1]?.role || '普通人';
}

function randomAdultRole() {
  return pickWeightedAdultRole();
}

function addItem(db: any, userId: number, name: string, itemType = 'consumable', qty = 1, description = '', effectValue = 0) {
  const existing = db
    .prepare(`SELECT * FROM inventory WHERE userId=? AND name=? AND itemType=? LIMIT 1`)
    .get(userId, name, itemType) as AnyRow | undefined;
  if (existing) {
    db.prepare(`UPDATE inventory SET qty = qty + ? WHERE id = ?`).run(qty, Number(existing.id));
    return;
  }
  db.prepare(
    `INSERT INTO inventory(userId,name,description,qty,itemType,effectValue,createdAt) VALUES(?,?,?,?,?,?,?)`
  ).run(userId, name, description, qty, itemType, effectValue, nowIso());
}

function buildLondonCompatMatches(db: any, user: AnyRow) {
  const selfRoleType = compatRoleType(user.role);
  if (!selfRoleType) {
    return {
      selfRoleType: '',
      targetRoleType: '',
      matches: [] as Array<{
        userId: number;
        name: string;
        role: string;
        job: string;
        age: number;
        currentLocation: string;
        compatibility: number;
      }>
    };
  }

  const targetRoleType = selfRoleType === 'sentinel' ? 'guide' : 'sentinel';
  const rows = db.prepare(`
    SELECT id, name, role, job, age, currentLocation, status, londonCompatOptIn
    FROM users
    WHERE id <> ?
      AND COALESCE(age, 0) >= 19
      AND COALESCE(londonCompatOptIn, 0) = 1
      AND status IN ('approved', 'ghost')
    ORDER BY id DESC
    LIMIT 600
  `).all(Number(user.id || 0)) as AnyRow[];

  const matches = rows
    .filter((x) => compatRoleType(x.role) === targetRoleType)
    .map((x) => ({
      userId: Number(x.id || 0),
      name: String(x.name || ''),
      role: String(x.role || ''),
      job: String(x.job || '无'),
      age: Number(x.age || 0),
      currentLocation: String(x.currentLocation || ''),
      compatibility: compatibilityScore(String(user.name || ''), String(x.name || ''))
    }))
    .sort((a, b) => {
      if (b.compatibility !== a.compatibility) return b.compatibility - a.compatibility;
      return a.userId - b.userId;
    });

  return { selfRoleType, targetRoleType, matches };
}

function buildDemonContrabandOffers(db: any, isDemonMember: boolean) {
  const rows = db.prepare(`
    SELECT id, name, description, itemType, effectValue, tier, price, locationTag
    FROM items
    WHERE itemType = '违禁品'
      AND (
        locationTag = ?
        OR locationTag = 'all'
        OR locationTag = ''
        OR locationTag LIKE '%demon%'
      )
    ORDER BY RANDOM()
    LIMIT 200
  `).all(DEMON_LOCATION) as AnyRow[];

  const filtered = isDemonMember
    ? rows
    : rows.filter((x) => String(x.tier || '低阶') === '低阶');

  const picked = filtered.slice(0, 8);
  return picked.map((x) => {
    const basePrice = Math.max(1, estimateItemBasePrice(x));
    const sellPrice = Math.max(1, Math.ceil(basePrice * 5));
    return {
      id: Number(x.id || 0),
      name: String(x.name || ''),
      description: String(x.description || ''),
      itemType: String(x.itemType || '违禁品'),
      effectValue: Number(x.effectValue || 0),
      tier: String(x.tier || '低阶'),
      basePrice,
      sellPrice
    };
  });
}

function levelTier(level: number) {
  if (level >= 14) return '高阶';
  if (level >= 7) return '中阶';
  return '低阶';
}

function pickSlumAlleyItem(db: any, preferAlchemy: boolean) {
  const baseWhere = `(locationTag = '' OR locationTag = 'all' OR locationTag LIKE '%slums%') AND itemType <> '违禁品'`;
  if (preferAlchemy) {
    const alchemy = db.prepare(`
      SELECT id, name, description, itemType, effectValue, tier, faction
      FROM items
      WHERE ${baseWhere}
        AND (faction LIKE '%炼金%' OR name LIKE '%炼金%' OR description LIKE '%炼金%')
      ORDER BY RANDOM()
      LIMIT 1
    `).get() as AnyRow | undefined;
    if (alchemy) return { item: alchemy, isAlchemy: true };
  }

  const common = db.prepare(`
    SELECT id, name, description, itemType, effectValue, tier, faction
    FROM items
    WHERE ${baseWhere}
    ORDER BY RANDOM()
    LIMIT 1
  `).get() as AnyRow | undefined;
  if (common) return { item: common, isAlchemy: false };

  if (preferAlchemy) {
    const fallbackAlchemy = rand([
      { name: '废墟催化剂', description: '西市地下炼金残渣，常用于低阶炼金实验。', itemType: '任务道具', effectValue: 28, tier: '低阶', faction: '炼金系' },
      { name: '旧式蒸馏瓶', description: '勉强可用的炼金器皿，回收价值一般。', itemType: '贵重物品', effectValue: 80, tier: '低阶', faction: '炼金系' },
      { name: '裂纹贤者粉末', description: '可用于炼金配方试作的基础材料。', itemType: '回复道具', effectValue: 18, tier: '低阶', faction: '炼金系' }
    ]);
    return { item: fallbackAlchemy, isAlchemy: true };
  }

  const fallbackCommon = rand([
    { name: '旧罐头', description: '挨饿时能顶一下。', itemType: '回复道具', effectValue: 16, tier: '低阶', faction: '通用' },
    { name: '磨损齿轮包', description: '拆解机件后剩下的可交易零件。', itemType: '贵重物品', effectValue: 60, tier: '低阶', faction: '通用' },
    { name: '流浪者药膏', description: '简陋但有效的外伤药。', itemType: '回复道具', effectValue: 20, tier: '低阶', faction: '通用' }
  ]);
  return { item: fallbackCommon, isAlchemy: false };
}

function pickRichStreetItem(db: any) {
  const baseWhere = `(locationTag = '' OR locationTag = 'all' OR locationTag LIKE '%rich_area%') AND itemType <> '违禁品'`;
  const highValueRows = db.prepare(`
    SELECT id, name, description, itemType, effectValue, tier, faction, price
    FROM items
    WHERE ${baseWhere}
      AND (
        COALESCE(price, 0) >= 400
        OR tier = '高阶'
        OR itemType = '贵重物品'
        OR COALESCE(effectValue, 0) >= 120
      )
    ORDER BY RANDOM()
    LIMIT 240
  `).all() as AnyRow[];

  const commonRows = db.prepare(`
    SELECT id, name, description, itemType, effectValue, tier, faction, price
    FROM items
    WHERE ${baseWhere}
    ORDER BY RANDOM()
    LIMIT 240
  `).all() as AnyRow[];

  const nonHighRows = commonRows.filter((x) => {
    const isHigh =
      Number(x.price || 0) >= 400 ||
      String(x.tier || '') === '高阶' ||
      String(x.itemType || '') === '贵重物品' ||
      Number(x.effectValue || 0) >= 120;
    return !isHigh;
  });

  const roll = Math.random();
  if (highValueRows.length > 0 && roll < RICH_STREET_HIGH_VALUE_CHANCE) {
    return { tier: 'high' as const, item: rand(highValueRows) };
  }
  if ((nonHighRows.length > 0 || commonRows.length > 0) && roll < RICH_STREET_HIGH_VALUE_CHANCE + RICH_STREET_COMMON_ITEM_CHANCE) {
    const pool = nonHighRows.length > 0 ? nonHighRows : commonRows;
    return { tier: 'common' as const, item: rand(pool) };
  }

  if (highValueRows.length > 0 && commonRows.length === 0) {
    return { tier: 'high' as const, item: rand(highValueRows) };
  }

  return null;
}

function pickRandomDropByTier(db: any, level: number, isDemonMember = false) {
  const tier = levelTier(level);
  const byTierRows = db.prepare(`
    SELECT id, name, description, itemType, effectValue, tier
    FROM items
    WHERE tier = ?
    ORDER BY RANDOM()
    LIMIT 240
  `).all(tier) as AnyRow[];
  const allRows = db.prepare(`
    SELECT id, name, description, itemType, effectValue, tier
    FROM items
    ORDER BY RANDOM()
    LIMIT 240
  `).all() as AnyRow[];
  const pool = byTierRows.length > 0 ? byTierRows : allRows;
  if (pool.length <= 0) return undefined;

  const contraband = pool.filter((x) => String(x.itemType || '') === '违禁品');
  if (isDemonMember) {
    if (contraband.length > 0 && Math.random() < DEMON_CONTRABAND_CHANCE) {
      return rand(contraband);
    }
    return rand(pool);
  }

  const lowTierContraband = contraband.filter((x) => String(x.tier || '低阶') === '低阶');
  if (lowTierContraband.length > 0 && Math.random() < NON_DEMON_CONTRABAND_CHANCE) {
    return rand(lowTierContraband);
  }

  const commonPool = pool.filter((x) => String(x.itemType || '') !== '违禁品');
  if (commonPool.length > 0) return rand(commonPool);
  if (lowTierContraband.length > 0) return rand(lowTierContraband);
  return undefined;
}

function getTowerPurifyRate(jobRaw: any) {
  const job = String(jobRaw || '').trim();
  if (!job) return 0;
  if (job.includes('圣子') || job.includes('圣女')) return 1;
  if (job.includes('候选')) return 0.6;
  if (job.includes('侍奉')) return 0.3;
  if (job.includes('仆从')) return 0.05;
  return 0;
}

function applyWildDebuff(db: any, userId: number) {
  if (Math.random() > WILD_DEBUFF_CHANCE) return null;

  const user = getUser(db, userId);
  if (!user) return null;

  const isErosion = Math.random() < 0.5;
  const basePercent = Number((0.5 + Math.random() * (WILD_DEBUFF_BASE_MAX_PCT - 0.5)).toFixed(2));
  const maxHp = Math.max(1, Number(user.maxHp || 100));
  const maxMp = Math.max(1, Number(user.maxMp || 100));
  const hp = clamp(Number(user.hp ?? maxHp), 0, maxHp);
  const mp = clamp(Number(user.mp ?? maxMp), 0, maxMp);
  const erosionLevel = clamp(Number(user.erosionLevel || 0), 0, WILD_DEBUFF_LEVEL_CAP);
  const bleedingLevel = clamp(Number(user.bleedingLevel || 0), 0, WILD_DEBUFF_LEVEL_CAP);
  const levelBefore = isErosion ? erosionLevel : bleedingLevel;

  // 程度越高，单次扣除比例越高。
  const appliedPercent = clamp(basePercent * (1 + levelBefore / 100), 0.1, 30);
  const lossRatio = appliedPercent / 100;

  let nextHp = hp;
  let nextMp = mp;
  let levelAfter = levelBefore;
  let lossValue = 0;

  if (isErosion) {
    lossValue = Math.max(1, Math.ceil(maxMp * lossRatio));
    nextMp = clamp(mp - lossValue, 0, maxMp);
    levelAfter = clamp(erosionLevel + basePercent, 0, WILD_DEBUFF_LEVEL_CAP);
    db.prepare(`
      UPDATE users
      SET mp = ?,
          erosionLevel = ?,
          updatedAt = ?
      WHERE id = ?
    `).run(nextMp, levelAfter, nowIso(), userId);
  } else {
    lossValue = Math.max(1, Math.ceil(maxHp * lossRatio));
    nextHp = clamp(hp - lossValue, 0, maxHp);
    levelAfter = clamp(bleedingLevel + basePercent, 0, WILD_DEBUFF_LEVEL_CAP);
    db.prepare(`
      UPDATE users
      SET hp = ?,
          bleedingLevel = ?,
          updatedAt = ?
      WHERE id = ?
    `).run(nextHp, levelAfter, nowIso(), userId);
  }

  const refreshed = getUser(db, userId) || user;
  const kind = isErosion ? '侵蚀' : '流血';
  const attr = isErosion ? 'MP' : 'HP';
  return {
    type: isErosion ? 'erosion' : 'bleeding',
    basePercent,
    appliedPercent: Number(appliedPercent.toFixed(2)),
    levelBefore: Number(levelBefore.toFixed(2)),
    levelAfter: Number(levelAfter.toFixed(2)),
    lossValue,
    hp: Number(refreshed.hp ?? nextHp),
    mp: Number(refreshed.mp ?? nextMp),
    erosionLevel: Number(refreshed.erosionLevel ?? erosionLevel),
    bleedingLevel: Number(refreshed.bleedingLevel ?? bleedingLevel),
    message: `触发${kind}：${attr} -${lossValue}（${appliedPercent.toFixed(1)}%），${kind}程度 ${levelAfter.toFixed(1)}%`
  };
}

function getWildEncounterLevelCap(user?: AnyRow) {
  const rankPower = getRankPower(user);
  if (rankPower <= 0) return 3;
  if (rankPower <= 4) return 4;
  if (rankPower <= 7) return 6;
  if (rankPower <= 10) return 8;
  if (rankPower <= 13) return 10;
  if (rankPower <= 16) return 12;
  return 14 + Math.min(4, Math.floor((rankPower - 16) / 2));
}

function buildWildEncounter(db: any, user?: AnyRow) {
  const eventRoll = Math.random();
  if (eventRoll < 0.25) {
    return { eventType: 'item' as const };
  }

  const encounterCap = getWildEncounterLevelCap(user);

  let monster = db.prepare(`
    SELECT id, name, description, minLevel, maxLevel, basePower, baseHp, dropItemName, dropChance
    FROM wild_monsters
    WHERE enabled = 1
      AND minLevel <= ?
    ORDER BY ABS(minLevel - ?) ASC, RANDOM()
    LIMIT 1
  `).get(encounterCap + 2, encounterCap) as AnyRow | undefined;

  if (!monster) {
    monster = db.prepare(`
      SELECT id, name, description, minLevel, maxLevel, basePower, baseHp, dropItemName, dropChance
      FROM wild_monsters
      WHERE enabled = 1
      ORDER BY minLevel ASC, RANDOM()
      LIMIT 1
    `).get() as AnyRow | undefined;
  }

  if (!monster) {
    return { eventType: 'item' as const };
  }

  const minLevel = Math.max(1, Number(monster.minLevel || 1));
  const maxLevel = Math.max(minLevel, Number(monster.maxLevel || minLevel));
  const spawnMaxLevel = Math.max(minLevel, Math.min(maxLevel, encounterCap + 1));
  const lowBandMax = Math.max(
    minLevel,
    Math.min(spawnMaxLevel, minLevel + Math.max(1, Math.ceil((spawnMaxLevel - minLevel) * 0.6)))
  );
  const level = Math.random() < 0.78
    ? Math.floor(minLevel + Math.random() * (lowBandMax - minLevel + 1))
    : Math.floor(lowBandMax + Math.random() * (spawnMaxLevel - lowBandMax + 1));
  const power = Number(monster.basePower || 10) + level * 1.35 + Math.random() * 1.8;
  const hp = Math.max(40, Math.round(Number(monster.baseHp || 100) + level * 5));

  return {
    eventType: 'monster' as const,
    monster: {
      id: Number(monster.id),
      name: String(monster.name || '????'),
      description: String(monster.description || ''),
      level,
      power: Number(power.toFixed(2)),
      hp,
      tier: levelTier(level)
    }
  };
}

function writeWildBattleLog(
  db: any,
  payload: {
    userId: number;
    eventType: 'monster' | 'item';
    monsterId?: number;
    monsterName?: string;
    monsterLevel?: number;
    isWin?: boolean;
    resultText?: string;
    hpDelta?: number;
    mentalDelta?: number;
    physicalDelta?: number;
    droppedItem?: string;
    returnedTo?: string;
  }
) {
  db.prepare(`
    INSERT INTO wild_battle_logs(
      userId, eventType, monsterId, monsterName, monsterLevel, isWin, resultText,
      hpDelta, mentalDelta, physicalDelta, droppedItem, returnedTo, createdAt
    )
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(
    Number(payload.userId || 0),
    String(payload.eventType || 'monster'),
    Number(payload.monsterId || 0),
    String(payload.monsterName || ''),
    Number(payload.monsterLevel || 0),
    payload.isWin ? 1 : 0,
    String(payload.resultText || ''),
    Number(payload.hpDelta || 0),
    Number(payload.mentalDelta || 0),
    Number(payload.physicalDelta || 0),
    String(payload.droppedItem || ''),
    String(payload.returnedTo || ''),
    nowIso()
  );
}

function grantSkillOrBook(db: any, userId: number, skill: AnyRow, level = 1) {
  const user = getUser(db, userId);
  if (!user) return { ok: false, learned: false, converted: false, message: 'user not found' };
  if (!skill || !skill.id) return { ok: false, learned: false, converted: false, message: 'skill not found' };

  const skillName = String(skill.name || '');
  const skillFaction = String(skill.faction || '通用');
  if (!canLearnSkillByFaction(user, skillFaction)) {
    addItem(db, userId, `[技能书] ${skillName}`, 'skill_book', 1, '跨派系技能学习书，可交易或出售', 0);
    return {
      ok: true,
      learned: false,
      converted: true,
      message: `派系不匹配，已将 ${skillName} 转化为技能书`
    };
  }

  db.prepare(`INSERT OR IGNORE INTO user_skills(userId,skillId,level) VALUES(?,?,?)`).run(userId, Number(skill.id), Math.max(1, Number(level || 1)));
  return {
    ok: true,
    learned: true,
    converted: false,
    message: `学习成功：${skillName}`
  };
}

function hasStealSkill(db: any, userId: number) {
  const row = db.prepare(`
    SELECT 1
    FROM user_skills us
    JOIN skills s ON s.id = us.skillId
    WHERE us.userId = ?
      AND (
        s.name LIKE '%偷%'
        OR s.name LIKE '%窃%'
        OR s.name LIKE '%steal%'
        OR s.name LIKE '%thief%'
        OR s.description LIKE '%偷%'
        OR s.description LIKE '%窃%'
        OR s.description LIKE '%steal%'
        OR s.description LIKE '%thief%'
      )
    LIMIT 1
  `).get(userId);
  return !!row;
}

function getRankPower(user: AnyRow | undefined) {
  if (!user) return 0;
  return (RANK_SCORE[String(user.mentalRank || '').toUpperCase()] || 0) + (RANK_SCORE[String(user.physicalRank || '').toUpperCase()] || 0);
}

function pushInteractionEvent(
  db: any,
  userId: number,
  sourceUserId: number,
  targetUserId: number,
  actionType: string,
  title: string,
  message: string,
  payload?: Record<string, any>
) {
  const uid = Number(userId || 0);
  if (!uid || !String(message || '').trim()) return;
  db.prepare(`
    INSERT INTO interaction_events(userId, sourceUserId, targetUserId, actionType, title, message, payloadJson, createdAt)
    VALUES(?,?,?,?,?,?,?,?)
  `).run(
    uid,
    Number(sourceUserId || 0),
    Number(targetUserId || 0),
    String(actionType || ''),
    String(title || ''),
    String(message || ''),
    JSON.stringify(payload || {}),
    nowIso()
  );
  void gameplayRuntime?.publishUser(uid, 'interaction.event.created', {
    userId: uid,
    sourceUserId: Number(sourceUserId || 0),
    targetUserId: Number(targetUserId || 0),
    actionType: String(actionType || ''),
    title: String(title || ''),
    message: String(message || ''),
    payload: payload || {},
  });
}

function normalizeTradePair(a: number, b: number) {
  return a <= b ? { userAId: a, userBId: b } : { userAId: b, userBId: a };
}

const TRADE_SKILL_PREFIX = '__skill__:';

function encodeTradeSkillOffer(userSkillId: number, skillName: string) {
  return `${TRADE_SKILL_PREFIX}${Math.max(0, Number(userSkillId || 0))}:${String(skillName || '').trim()}`;
}

function parseTradeSkillOffer(raw: any) {
  const itemName = String(raw || '').trim();
  if (!itemName.startsWith(TRADE_SKILL_PREFIX)) {
    return { isSkill: false, userSkillId: 0, skillName: '', rawItemName: itemName };
  }
  const rest = itemName.slice(TRADE_SKILL_PREFIX.length);
  const sep = rest.indexOf(':');
  if (sep < 0) {
    return { isSkill: true, userSkillId: Math.max(0, Number(rest || 0)), skillName: '', rawItemName: itemName };
  }
  return {
    isSkill: true,
    userSkillId: Math.max(0, Number(rest.slice(0, sep) || 0)),
    skillName: rest.slice(sep + 1).trim(),
    rawItemName: itemName
  };
}

function pickTradeSkillEntry(db: any, userId: number, userSkillId: number) {
  if (!userId || !userSkillId) return undefined;
  return db.prepare(`
    SELECT us.id AS userSkillId, us.level, s.id AS skillId, s.name, s.faction
    FROM user_skills us
    JOIN skills s ON s.id = us.skillId
    WHERE us.userId = ? AND us.id = ?
    LIMIT 1
  `).get(userId, userSkillId) as AnyRow | undefined;
}

function loadTradeSessionPayload(db: any, sessionRow: AnyRow | undefined) {
  if (!sessionRow) return null;
  const userAId = Number(sessionRow.userAId || 0);
  const userBId = Number(sessionRow.userBId || 0);
  if (!userAId || !userBId) return null;
  const userA = getUser(db, userAId);
  const userB = getUser(db, userBId);
  const offerRows = db.prepare(`
    SELECT sessionId, userId, itemName, qty, gold, updatedAt
    FROM interaction_trade_offers
    WHERE sessionId = ?
  `).all(String(sessionRow.id || '')) as AnyRow[];
  const offerMap = new Map<number, AnyRow>();
  for (const x of offerRows) offerMap.set(Number(x.userId || 0), x);
  const offerA = offerMap.get(userAId) || {};
  const offerB = offerMap.get(userBId) || {};

  return {
    sessionId: String(sessionRow.id || ''),
    status: String(sessionRow.status || 'pending'),
    userAId,
    userAName: String(userA?.name || `玩家#${userAId}`),
    userBId,
    userBName: String(userB?.name || `玩家#${userBId}`),
    confirmA: Number(sessionRow.confirmA || 0) ? 1 : 0,
    confirmB: Number(sessionRow.confirmB || 0) ? 1 : 0,
    cancelledBy: Number(sessionRow.cancelledBy || 0),
    createdAt: String(sessionRow.createdAt || ''),
    updatedAt: String(sessionRow.updatedAt || ''),
    offerA: {
      userId: userAId,
      itemName: String(offerA.itemName || ''),
      qty: Math.max(0, Number(offerA.qty || 0)),
      gold: Math.max(0, Number(offerA.gold || 0)),
      updatedAt: String(offerA.updatedAt || '')
    },
    offerB: {
      userId: userBId,
      itemName: String(offerB.itemName || ''),
      qty: Math.max(0, Number(offerB.qty || 0)),
      gold: Math.max(0, Number(offerB.gold || 0)),
      updatedAt: String(offerB.updatedAt || '')
    }
  };
}

function inventoryTotalQty(db: any, userId: number, itemName: string) {
  const row = db.prepare(`
    SELECT COALESCE(SUM(qty), 0) AS totalQty
    FROM inventory
    WHERE userId = ? AND name = ? AND qty > 0
  `).get(userId, itemName) as AnyRow | undefined;
  return Math.max(0, Number(row?.totalQty || 0));
}

function pickInventoryMeta(db: any, userId: number, itemName: string) {
  return db.prepare(`
    SELECT itemType, description, effectValue
    FROM inventory
    WHERE userId = ? AND name = ? AND qty > 0
    ORDER BY id DESC
    LIMIT 1
  `).get(userId, itemName) as AnyRow | undefined;
}

function consumeInventoryByName(db: any, userId: number, itemName: string, qty: number) {
  let remaining = Math.max(0, Math.floor(Number(qty || 0)));
  if (remaining <= 0) return;
  const rows = db.prepare(`
    SELECT id, qty
    FROM inventory
    WHERE userId = ? AND name = ? AND qty > 0
    ORDER BY id ASC
  `).all(userId, itemName) as AnyRow[];
  for (const row of rows) {
    if (remaining <= 0) break;
    const rid = Number(row.id || 0);
    const cur = Math.max(0, Number(row.qty || 0));
    if (!rid || cur <= 0) continue;
    const use = Math.min(cur, remaining);
    const next = cur - use;
    if (next <= 0) db.prepare(`DELETE FROM inventory WHERE id = ?`).run(rid);
    else db.prepare(`UPDATE inventory SET qty = ? WHERE id = ?`).run(next, rid);
    remaining -= use;
  }
  if (remaining > 0) {
    throw new Error(`物品库存不足：${itemName}`);
  }
}

function formatTradeOfferLabel(offer: { itemName: string; qty: number; gold: number }) {
  const parts: string[] = [];
  const parsed = parseTradeSkillOffer(offer.itemName);
  const itemName = parsed.isSkill ? '' : String(offer.itemName || '').trim();
  const skillName = parsed.isSkill ? String(parsed.skillName || '').trim() : '';
  const qty = Math.max(0, Number(offer.qty || 0));
  const gold = Math.max(0, Number(offer.gold || 0));
  if (itemName && qty > 0) parts.push(`「${itemName}」x${qty}`);
  if (skillName) parts.push(`技能「${skillName}」`);
  if (gold > 0) parts.push(`${gold}G`);
  return parts.length ? parts.join(' + ') : '空报价';
}

function completeTradeSession(db: any, sessionId: string) {
  const session = db.prepare(`
    SELECT *
    FROM interaction_trade_sessions
    WHERE id = ? AND status = 'pending'
    LIMIT 1
  `).get(sessionId) as AnyRow | undefined;
  if (!session) return { success: false, message: '交易会话不存在或已结束' };

  const userAId = Number(session.userAId || 0);
  const userBId = Number(session.userBId || 0);
  if (!userAId || !userBId) return { success: false, message: '交易会话参与者无效' };

  const offers = db.prepare(`
    SELECT userId, itemName, qty, gold
    FROM interaction_trade_offers
    WHERE sessionId = ?
  `).all(sessionId) as AnyRow[];
  const offerMap = new Map<number, AnyRow>();
  for (const x of offers) offerMap.set(Number(x.userId || 0), x);

  const rawA = offerMap.get(userAId) || {};
  const rawB = offerMap.get(userBId) || {};
  const offerA = {
    itemName: String(rawA.itemName || '').trim(),
    qty: clamp(Math.floor(Number(rawA.qty || 0)), 0, 99),
    gold: clamp(Math.floor(Number(rawA.gold || 0)), 0, 99999999)
  };
  const offerB = {
    itemName: String(rawB.itemName || '').trim(),
    qty: clamp(Math.floor(Number(rawB.qty || 0)), 0, 99),
    gold: clamp(Math.floor(Number(rawB.gold || 0)), 0, 99999999)
  };

  const userA = getUser(db, userAId);
  const userB = getUser(db, userBId);
  if (!userA || !userB) return { success: false, message: '交易参与者不存在' };
  if (Number(userA.gold || 0) < offerA.gold) return { success: false, message: `${String(userA.name || '玩家A')} 金币不足` };
  if (Number(userB.gold || 0) < offerB.gold) return { success: false, message: `${String(userB.name || '玩家B')} 金币不足` };

  const skillOfferA = parseTradeSkillOffer(offerA.itemName);
  const skillOfferB = parseTradeSkillOffer(offerB.itemName);
  const normalItemA = skillOfferA.isSkill ? '' : offerA.itemName;
  const normalItemB = skillOfferB.isSkill ? '' : offerB.itemName;

  if (normalItemA && offerA.qty > 0 && inventoryTotalQty(db, userAId, normalItemA) < offerA.qty) {
    return { success: false, message: `${String(userA.name || '玩家A')} 的物品库存不足` };
  }
  if (normalItemB && offerB.qty > 0 && inventoryTotalQty(db, userBId, normalItemB) < offerB.qty) {
    return { success: false, message: `${String(userB.name || '玩家B')} 的物品库存不足` };
  }

  const skillRowA = skillOfferA.isSkill ? pickTradeSkillEntry(db, userAId, skillOfferA.userSkillId) : undefined;
  const skillRowB = skillOfferB.isSkill ? pickTradeSkillEntry(db, userBId, skillOfferB.userSkillId) : undefined;
  if (skillOfferA.isSkill && !skillRowA) {
    return { success: false, message: `${String(userA.name || '玩家A')} 不再持有报价中的技能` };
  }
  if (skillOfferB.isSkill && !skillRowB) {
    return { success: false, message: `${String(userB.name || '玩家B')} 不再持有报价中的技能` };
  }
  if (skillRowA) {
    const targetHas = db.prepare(`SELECT 1 FROM user_skills WHERE userId = ? AND skillId = ? LIMIT 1`).get(userBId, Number(skillRowA.skillId || 0));
    if (targetHas) return { success: false, message: `${String(userB.name || '玩家B')} 已掌握技能「${String(skillRowA.name || '')}」` };
  }
  if (skillRowB) {
    const targetHas = db.prepare(`SELECT 1 FROM user_skills WHERE userId = ? AND skillId = ? LIMIT 1`).get(userAId, Number(skillRowB.skillId || 0));
    if (targetHas) return { success: false, message: `${String(userA.name || '玩家A')} 已掌握技能「${String(skillRowB.name || '')}」` };
  }

  const extraNotes: string[] = [];
  const tx = db.transaction(() => {
    if (offerA.gold > 0) db.prepare(`UPDATE users SET gold = gold - ?, updatedAt = ? WHERE id = ?`).run(offerA.gold, nowIso(), userAId);
    if (offerB.gold > 0) db.prepare(`UPDATE users SET gold = gold - ?, updatedAt = ? WHERE id = ?`).run(offerB.gold, nowIso(), userBId);
    if (offerB.gold > 0) db.prepare(`UPDATE users SET gold = gold + ?, updatedAt = ? WHERE id = ?`).run(offerB.gold, nowIso(), userAId);
    if (offerA.gold > 0) db.prepare(`UPDATE users SET gold = gold + ?, updatedAt = ? WHERE id = ?`).run(offerA.gold, nowIso(), userBId);

    if (normalItemA && offerA.qty > 0) {
      const metaA = pickInventoryMeta(db, userAId, normalItemA);
      consumeInventoryByName(db, userAId, normalItemA, offerA.qty);
      addItem(
        db,
        userBId,
        normalItemA,
        String(metaA?.itemType || 'consumable'),
        offerA.qty,
        String(metaA?.description || ''),
        Number(metaA?.effectValue || 0)
      );
    }

    if (normalItemB && offerB.qty > 0) {
      const metaB = pickInventoryMeta(db, userBId, normalItemB);
      consumeInventoryByName(db, userBId, normalItemB, offerB.qty);
      addItem(
        db,
        userAId,
        normalItemB,
        String(metaB?.itemType || 'consumable'),
        offerB.qty,
        String(metaB?.description || ''),
        Number(metaB?.effectValue || 0)
      );
    }

    if (skillRowA) {
      db.prepare(`DELETE FROM user_skills WHERE id = ?`).run(Number(skillRowA.userSkillId || 0));
      const granted = grantSkillOrBook(
        db,
        userBId,
        { id: Number(skillRowA.skillId || 0), name: String(skillRowA.name || ''), faction: String(skillRowA.faction || '通用') },
        Math.max(1, Number(skillRowA.level || 1))
      );
      if (granted.converted) {
        extraNotes.push(`${String(userB.name || '玩家B')} 因派系限制收到技能书「${String(skillRowA.name || '')}」`);
      }
    }

    if (skillRowB) {
      db.prepare(`DELETE FROM user_skills WHERE id = ?`).run(Number(skillRowB.userSkillId || 0));
      const granted = grantSkillOrBook(
        db,
        userAId,
        { id: Number(skillRowB.skillId || 0), name: String(skillRowB.name || ''), faction: String(skillRowB.faction || '通用') },
        Math.max(1, Number(skillRowB.level || 1))
      );
      if (granted.converted) {
        extraNotes.push(`${String(userA.name || '玩家A')} 因派系限制收到技能书「${String(skillRowB.name || '')}」`);
      }
    }

    db.prepare(`
      UPDATE interaction_trade_sessions
      SET status = 'completed',
          completedAt = ?,
          updatedAt = ?
      WHERE id = ?
    `).run(nowIso(), nowIso(), sessionId);
  });

  tx();

  const offerALabel = formatTradeOfferLabel(offerA);
  const offerBLabel = formatTradeOfferLabel(offerB);
  pushInteractionEvent(
    db,
    userAId,
    userBId,
    userAId,
    'trade',
    '交易完成',
    `交易完成：你付出 ${offerALabel}，收到 ${offerBLabel}`,
    { sessionId, paid: offerA, gained: offerB }
  );
  pushInteractionEvent(
    db,
    userBId,
    userAId,
    userBId,
    'trade',
    '交易完成',
    `交易完成：你付出 ${offerBLabel}，收到 ${offerALabel}`,
    { sessionId, paid: offerB, gained: offerA }
  );

  return {
    success: true,
    message: extraNotes.length ? `双方确认完成，交易已结算（${extraNotes.join('；')}）` : '双方确认完成，交易已结算',
    offerA,
    offerB
  };
}
function resolveCombat(db: any, attackerId: number, defenderId: number, attackerScore?: number, defenderScore?: number) {
  const attacker = getUser(db, attackerId);
  const defender = getUser(db, defenderId);
  if (!attacker || !defender) return { success: false, message: 'user not found' };

  const atkScore = Number.isFinite(Number(attackerScore)) ? Number(attackerScore) : getRankPower(attacker);
  const defScore = Number.isFinite(Number(defenderScore)) ? Number(defenderScore) : getRankPower(defender);
  const isAttackerWin = atkScore >= defScore;

  const attackerHp = clamp(Number(attacker.hp || 100), 0, Number(attacker.maxHp || 100));
  const defenderHp = clamp(Number(defender.hp || 100), 0, Number(defender.maxHp || 100));
  const attackerLoss = Math.max(1, Math.ceil(Number(attacker.maxHp || 100) * 0.05));
  const defenderLoss = Math.max(1, Math.ceil(Number(defender.maxHp || 100) * 0.05));

  const nextAttackerHp = isAttackerWin ? attackerHp : clamp(attackerHp - attackerLoss, 0, Number(attacker.maxHp || 100));
  const nextDefenderHp = isAttackerWin ? clamp(defenderHp - defenderLoss, 0, Number(defender.maxHp || 100)) : defenderHp;

  db.prepare(`UPDATE users SET hp=?, lastCombatAt=?, updatedAt=? WHERE id=?`).run(nextAttackerHp, nowIso(), nowIso(), attackerId);
  db.prepare(`UPDATE users SET hp=?, lastCombatAt=?, updatedAt=? WHERE id=?`).run(nextDefenderHp, nowIso(), nowIso(), defenderId);

  const attackerName = String(attacker.name || `玩家#${attackerId}`);
  const defenderName = String(defender.name || `玩家#${defenderId}`);
  pushInteractionEvent(
    db,
    attackerId,
    attackerId,
    defenderId,
    'combat',
    '战斗结算',
    isAttackerWin
      ? `你攻击了 ${defenderName}，对方生命下降 5%`
      : `你攻击了 ${defenderName}，但被压制，你的生命下降 5%`,
    { isAttackerWin, attackerHp: nextAttackerHp, defenderHp: nextDefenderHp }
  );
  pushInteractionEvent(
    db,
    defenderId,
    attackerId,
    defenderId,
    'combat',
    '遭遇战斗',
    isAttackerWin
      ? `${attackerName} 攻击了你，你的生命下降 5%`
      : `${attackerName} 攻击了你，但你成功压制了对方`,
    { isAttackerWin, attackerHp: nextAttackerHp, defenderHp: nextDefenderHp }
  );

  return {
    success: true,
    isAttackerWin,
    attackerHp: nextAttackerHp,
    defenderHp: nextDefenderHp,
    message: isAttackerWin ? '你在判定中占优，对方生命下降 5%' : '你在判定中落败，自身生命下降 5%'
  };
}

function resolveSteal(db: any, thiefId: number, targetId: number) {
  const thief = getUser(db, thiefId);
  const target = getUser(db, targetId);
  if (!thief || !target) return { success: false, message: 'user not found' };
  if (!hasStealSkill(db, thiefId)) {
    return { success: false, message: '你尚未掌握带偷窃效果的技能，无法偷窃' };
  }

  const item = db.prepare(`SELECT * FROM inventory WHERE userId=? AND qty>0 ORDER BY RANDOM() LIMIT 1`).get(targetId) as AnyRow | undefined;
  if (!item) return { success: false, message: '目标背包为空，偷窃失败' };

  const tx = db.transaction(() => {
    if (Number(item.qty || 1) <= 1) db.prepare(`DELETE FROM inventory WHERE id=?`).run(Number(item.id));
    else db.prepare(`UPDATE inventory SET qty = qty - 1 WHERE id = ?`).run(Number(item.id));
    addItem(
      db,
      thiefId,
      String(item.name || '未知物品'),
      String(item.itemType || 'consumable'),
      1,
      String(item.description || ''),
      Number(item.effectValue || 0)
    );
  });
  tx();

  const thiefName = String(thief.name || `玩家#${thiefId}`);
  const targetName = String(target.name || `玩家#${targetId}`);
  const itemName = String(item.name || '未知物品');
  pushInteractionEvent(
    db,
    thiefId,
    thiefId,
    targetId,
    'steal',
    '偷窃结算',
    `你偷到了 ${targetName} 的「${itemName}」x1`,
    { itemName }
  );
  pushInteractionEvent(
    db,
    targetId,
    thiefId,
    targetId,
    'steal',
    '遭遇偷窃',
    `${thiefName} 偷走了你的「${itemName}」x1`,
    { itemName }
  );

  return {
    success: true,
    item: { name: itemName },
    message: `偷窃成功：获得「${itemName}」x1`
  };
}

function resolvePrank(db: any, ghostId: number, targetId: number) {
  const ghost = getUser(db, ghostId);
  const target = getUser(db, targetId);
  if (!ghost || !target) return { success: false, message: 'user not found' };
  const role = String(ghost.role || '');
  if (!(role === '鬼魂' || role.toLowerCase() === 'ghost')) {
    return { success: false, message: '只有鬼魂可以发动恶作剧' };
  }

  const pct = clamp(Math.floor(Math.random() * 5) + 1, 1, 5);
  const maxMp = Math.max(1, Number(target.maxMp || 100));
  const curMp = clamp(Number(target.mp || maxMp), 0, maxMp);
  const mpLoss = Math.max(1, Math.ceil(maxMp * (pct / 100)));
  const nextMp = clamp(curMp - mpLoss, 0, maxMp);

  let furyGain = 0;
  if (isSentinelRole(String(target.role || '')) && Math.random() < 0.45) {
    furyGain = clamp(Math.floor(5 + Math.random() * 11), 5, 15);
  }

  db.prepare(`
    UPDATE users
    SET mp = ?, fury = MIN(100, COALESCE(fury,0) + ?), updatedAt = ?
    WHERE id = ?
  `).run(nextMp, furyGain, nowIso(), targetId);

  const extra = furyGain > 0 ? `，并触发哨兵狂暴值 +${furyGain}` : '';
  const ghostName = String(ghost.name || `玩家#${ghostId}`);
  const targetName = String(target.name || `玩家#${targetId}`);
  pushInteractionEvent(
    db,
    ghostId,
    ghostId,
    targetId,
    'prank',
    '恶作剧结算',
    `你对 ${targetName} 发动了恶作剧，目标 MP -${mpLoss}${extra}`,
    { mpLoss, furyGain, percent: pct }
  );
  pushInteractionEvent(
    db,
    targetId,
    ghostId,
    targetId,
    'prank',
    '遭遇恶作剧',
    `${ghostName} 对你发动恶作剧，你的 MP -${mpLoss}${extra}`,
    { mpLoss, furyGain, percent: pct }
  );
  return { success: true, message: `恶作剧生效：目标精神力下降 ${pct}%（-${mpLoss} MP）${extra}` };
}

function resolveSoothe(db: any, sentinelId: number, guideId: number) {
  const sentinel = getUser(db, sentinelId);
  const guide = getUser(db, guideId);
  if (!sentinel || !guide) return { success: false, message: 'user not found' };
  if (!isSentinelRole(String(sentinel.role || ''))) return { success: false, message: 'target is not sentinel' };
  if (!isGuideRole(String(guide.role || ''))) return { success: false, message: 'actor is not guide' };

  const score = compatibilityScore(String(sentinel.name || ''), String(guide.name || ''));
  const furyDrop = score < 30 ? 10 : score < 70 ? 30 : 60;
  const stabilityCost = score < 30 ? 18 : score < 70 ? 12 : 8;
  const nextFury = clamp(Number(sentinel.fury || 0) - furyDrop, 0, 100);
  const nextStability = clamp(Number(guide.guideStability ?? 100) - stabilityCost, 0, 100);

  db.prepare(`UPDATE users SET fury=?, updatedAt=? WHERE id=?`).run(nextFury, nowIso(), sentinelId);
  db.prepare(`UPDATE users SET guideStability=?, updatedAt=? WHERE id=?`).run(nextStability, nowIso(), guideId);

  const sentinelName = String(sentinel.name || `玩家#${sentinelId}`);
  const guideName = String(guide.name || `玩家#${guideId}`);
  pushInteractionEvent(
    db,
    guideId,
    guideId,
    sentinelId,
    'soothe',
    '精神抚慰',
    `你抚慰了 ${sentinelName}：狂暴 -${furyDrop}，你的稳定度 -${stabilityCost}`,
    { compatibility: score, furyDrop, stabilityCost }
  );
  pushInteractionEvent(
    db,
    sentinelId,
    guideId,
    sentinelId,
    'soothe',
    '被精神抚慰',
    `${guideName} 对你进行了精神抚慰：狂暴 -${furyDrop}`,
    { compatibility: score, furyDrop, stabilityCost }
  );

  return {
    success: true,
    compatibility: score,
    sentinelFury: nextFury,
    guideStability: nextStability,
    message: `契合度 ${score}%：哨兵狂暴 -${furyDrop}，向导稳定度 -${stabilityCost}`
  };
}

function executeInteractionAction(
  db: any,
  actionType: string,
  fromUserId: number,
  toUserId: number,
  payload?: Record<string, any>
) {
  const p = payload || {};
  switch (String(actionType || '')) {
    case 'combat':
      return resolveCombat(db, fromUserId, toUserId, Number(p.attackerScore), Number(p.defenderScore));
    case 'steal':
      return resolveSteal(db, fromUserId, toUserId);
    case 'prank':
      return resolvePrank(db, fromUserId, toUserId);
    case 'soothe':
      return resolveSoothe(db, toUserId, fromUserId);
    default:
      return { success: false, message: 'unsupported actionType' };
  }
}

function normPair(a: number, b: number) {
  return a <= b ? { x: a, y: b } : { x: b, y: a };
}

function getPartyMembers(db: any, partyId: string) {
  if (!partyId) return [] as AnyRow[];
  return db.prepare(`SELECT id, name, role, partyId, currentLocation FROM users WHERE partyId = ? ORDER BY id ASC`).all(partyId) as AnyRow[];
}

function collapsePartyIfNeeded(db: any, partyId: string) {
  if (!partyId) return;
  const members = getPartyMembers(db, partyId);
  if (members.length <= 1) {
    db.prepare(`UPDATE users SET partyId = NULL, updatedAt = ? WHERE partyId = ?`).run(nowIso(), partyId);
  }
}

function hashText(input: string) {
  const s = String(input || '');
  let h = 0;
  for (let i = 0; i < s.length; i++) h = s.charCodeAt(i) + ((h << 5) - h);
  return Math.abs(h);
}

function normalizeMapLocationId(raw: any) {
  const id = String(raw || '').trim();
  return MAP_LOCATION_IDS.includes(id) ? id : rand(MAP_LOCATION_IDS);
}

function buildNpcMapPoint(locationId: string) {
  const base = MAP_LOCATION_COORDS[locationId] || { x: 50, y: 50 };
  const x = clamp(base.x + (Math.random() * 14 - 7), 5, 95);
  const y = clamp(base.y + (Math.random() * 12 - 6), 8, 92);
  return { x: Number(x.toFixed(2)), y: Number(y.toFixed(2)) };
}

function randomWorldNpcName(index: number) {
  const base = `${rand(NPC_SURNAME_POOL)}${rand(NPC_NAME_POOL)}`;
  if (index % 3 === 0) return `${base}·${index + 1}`;
  return base;
}

function affinityStage(affinityRaw: any) {
  const affinity = clamp(Number(affinityRaw || 0), WORLD_NPC_AFFINITY_MIN, WORLD_NPC_AFFINITY_MAX);
  if (affinity >= 85) return '亲密';
  if (affinity >= WORLD_NPC_HIGH_AFFINITY) return '友善';
  if (affinity >= 45) return '中立';
  if (affinity > WORLD_NPC_LOW_AFFINITY) return '冷淡';
  return '敌意';
}

function affinityMood(affinityRaw: any) {
  const stage = affinityStage(affinityRaw);
  if (stage === '亲密') return '对你十分信任，愿意主动提供帮助。';
  if (stage === '友善') return '愿意和你交换情报，态度明显温和。';
  if (stage === '中立') return '保持礼貌，但不会轻易透露关键消息。';
  if (stage === '冷淡') return '对你戒心较重，说话十分克制。';
  return '对你抱有明显敌意，拒绝配合。';
}

function pickNpcReply(action: string, nextAffinity: number, delta: number) {
  const positiveAction = action === 'favor' || action === 'chat';
  if (nextAffinity <= WORLD_NPC_LOW_AFFINITY) return rand(NPC_RUDE_REPLY_POOL);
  if (!positiveAction || delta < 0) return rand(NPC_NEGATIVE_REPLY_POOL);
  if (nextAffinity >= WORLD_NPC_HIGH_AFFINITY) return rand(NPC_POSITIVE_REPLY_POOL);
  return rand(NPC_NEUTRAL_REPLY_POOL);
}

function upsertWorldNpcRuntime(db: any, key: string, value: string) {
  db.prepare(`
    INSERT INTO world_npc_runtime(key, value, updatedAt)
    VALUES(?,?,?)
    ON CONFLICT(key) DO UPDATE SET value=excluded.value, updatedAt=excluded.updatedAt
  `).run(key, value, nowIso());
}

function ensureWorldNpcPopulation(db: any) {
  const now = nowIso();
  const upsertLegacy = db.prepare(`
    INSERT INTO world_npcs(
      id, name, skillFaction, personality, identity, appearance, currentLocation, mapX, mapY, isLegacy, defaultAffinity, createdAt, updatedAt
    )
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(id) DO UPDATE SET
      name=excluded.name,
      skillFaction=excluded.skillFaction,
      personality=excluded.personality,
      identity=excluded.identity,
      appearance=excluded.appearance,
      currentLocation=excluded.currentLocation,
      mapX=excluded.mapX,
      mapY=excluded.mapY,
      isLegacy=1,
      defaultAffinity=excluded.defaultAffinity,
      updatedAt=excluded.updatedAt
  `);

  for (const legacy of LEGACY_WORLD_NPCS) {
    const locationId = normalizeMapLocationId(legacy.fixedLocation);
    const point = buildNpcMapPoint(locationId);
    const legacyId = `legacy_npc_${hashText(String(legacy.name || 'legacy'))}`;
    upsertLegacy.run(
      legacyId,
      legacy.name,
      legacy.skillFaction,
      legacy.personality,
      legacy.identity,
      legacy.appearance,
      locationId,
      point.x,
      point.y,
      1,
      clamp(Number(legacy.defaultAffinity || 50), WORLD_NPC_AFFINITY_MIN, WORLD_NPC_AFFINITY_MAX),
      now,
      now
    );
  }

  const insertRandomNpc = db.prepare(`
    INSERT INTO world_npcs(
      id, name, skillFaction, personality, identity, appearance, currentLocation, mapX, mapY, isLegacy, defaultAffinity, createdAt, updatedAt
    )
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)
  `);
  for (let i = 1; i <= WORLD_NPC_RANDOM_COUNT; i++) {
    const npcId = `world_npc_${i}`;
    const exists = db.prepare(`SELECT id FROM world_npcs WHERE id = ? LIMIT 1`).get(npcId) as AnyRow | undefined;
    if (exists) continue;

    const locationId = rand(MAP_LOCATION_IDS);
    const point = buildNpcMapPoint(locationId);
    insertRandomNpc.run(
      npcId,
      randomWorldNpcName(i),
      rand(NPC_SKILL_FACTIONS),
      rand(NPC_PERSONALITY_POOL),
      rand(NPC_IDENTITY_POOL),
      rand(NPC_APPEARANCE_POOL),
      locationId,
      point.x,
      point.y,
      0,
      clamp(35 + Math.floor(Math.random() * 31), WORLD_NPC_AFFINITY_MIN, WORLD_NPC_AFFINITY_MAX),
      now,
      now
    );
  }
}

function refreshWorldNpcDailyIfNeeded(db: any) {
  const key = 'daily_shuffle_date';
  const today = todayKey();
  const state = db.prepare(`SELECT value FROM world_npc_runtime WHERE key = ? LIMIT 1`).get(key) as AnyRow | undefined;
  if (String(state?.value || '') === today) return;

  const rows = db.prepare(`SELECT id FROM world_npcs WHERE isLegacy = 0 ORDER BY id ASC`).all() as AnyRow[];
  if (rows.length > 0) {
    const update = db.prepare(`UPDATE world_npcs SET currentLocation = ?, mapX = ?, mapY = ?, updatedAt = ? WHERE id = ?`);
    for (const row of rows) {
      const locationId = rand(MAP_LOCATION_IDS);
      const point = buildNpcMapPoint(locationId);
      update.run(locationId, point.x, point.y, nowIso(), String(row.id || ''));
    }
  }
  upsertWorldNpcRuntime(db, key, today);
}

function ensureWorldNpcSystem(db: any) {
  ensureWorldNpcPopulation(db);
  refreshWorldNpcDailyIfNeeded(db);
}

function loadWorldNpcsWithUserRelation(db: any, userId: number) {
  const rows = db.prepare(`
    SELECT
      n.id, n.name, n.skillFaction, n.personality, n.identity, n.appearance,
      n.currentLocation, n.mapX, n.mapY, n.isLegacy, n.defaultAffinity,
      COALESCE(r.affinity, n.defaultAffinity) AS affinity,
      COALESCE(r.interactionCount, 0) AS interactionCount,
      COALESCE(r.lastAction, '') AS lastAction,
      COALESCE(r.lastActionAt, '') AS lastActionAt,
      COALESCE(r.lastRewardDate, '') AS lastRewardDate,
      COALESCE(r.rewardCount, 0) AS rewardCount
    FROM world_npcs n
    LEFT JOIN world_npc_relations r
      ON r.npcId = n.id
     AND r.userId = ?
    ORDER BY n.isLegacy DESC, n.id ASC
  `).all(userId) as AnyRow[];

  return rows.map((row) => {
    const affinity = clamp(Number(row.affinity || row.defaultAffinity || 50), WORLD_NPC_AFFINITY_MIN, WORLD_NPC_AFFINITY_MAX);
    const locationId = normalizeMapLocationId(row.currentLocation);
    return {
      id: String(row.id || ''),
      name: String(row.name || '未知NPC'),
      skillFaction: String(row.skillFaction || '通用'),
      personality: String(row.personality || ''),
      identity: String(row.identity || ''),
      appearance: String(row.appearance || ''),
      currentLocation: locationId,
      locationName: MAP_LOCATION_NAME_MAP[locationId] || locationId,
      mapX: Number(row.mapX || 50),
      mapY: Number(row.mapY || 50),
      isLegacy: Number(row.isLegacy || 0) === 1,
      affinity,
      affinityStage: affinityStage(affinity),
      mood: affinityMood(affinity),
      interactionCount: Number(row.interactionCount || 0),
      lastAction: String(row.lastAction || ''),
      lastActionAt: String(row.lastActionAt || ''),
      lastRewardDate: String(row.lastRewardDate || ''),
      rewardCount: Number(row.rewardCount || 0)
    };
  });
}

function getWorldNpcById(db: any, npcId: string) {
  return db.prepare(`
    SELECT id, name, skillFaction, personality, identity, appearance, currentLocation, mapX, mapY, isLegacy, defaultAffinity
    FROM world_npcs
    WHERE id = ?
    LIMIT 1
  `).get(npcId) as AnyRow | undefined;
}

function pickNpcLocationRewardItem(db: any, locationId: string) {
  const queryByTier = db.prepare(`
    SELECT id, name, description, itemType, effectValue, tier, faction, locationTag
    FROM items
    WHERE itemType <> '违禁品'
      AND tier = ?
      AND (
        locationTag = ''
        OR locationTag = 'all'
        OR ? = ''
        OR locationTag LIKE '%' || ? || '%'
      )
    ORDER BY RANDOM()
    LIMIT 1
  `);
  const strictHigh = queryByTier.get('高阶', locationId, locationId) as AnyRow | undefined;
  if (strictHigh) return strictHigh;

  const strictMid = queryByTier.get('中阶', locationId, locationId) as AnyRow | undefined;
  if (strictMid) return strictMid;

  return db.prepare(`
    SELECT id, name, description, itemType, effectValue, tier, faction, locationTag
    FROM items
    WHERE itemType <> '违禁品'
      AND tier = '高阶'
    ORDER BY RANDOM()
    LIMIT 1
  `).get() as AnyRow | undefined;
}

function pickNpcFactionSkill(db: any, userId: number, skillFaction: string) {
  const primary = db.prepare(`
    SELECT s.id, s.name, s.faction, s.tier, s.description
    FROM skills s
    LEFT JOIN user_skills us
      ON us.skillId = s.id
     AND us.userId = ?
    WHERE us.id IS NULL
      AND (s.faction = ? OR s.faction LIKE '%' || ? || '%')
    ORDER BY
      CASE s.tier
        WHEN '高阶' THEN 3
        WHEN '中阶' THEN 2
        ELSE 1
      END DESC,
      RANDOM()
    LIMIT 1
  `).get(userId, skillFaction, skillFaction) as AnyRow | undefined;
  if (primary) return primary;

  return db.prepare(`
    SELECT s.id, s.name, s.faction, s.tier, s.description
    FROM skills s
    LEFT JOIN user_skills us
      ON us.skillId = s.id
     AND us.userId = ?
    WHERE us.id IS NULL
    ORDER BY
      CASE s.tier
        WHEN '高阶' THEN 3
        WHEN '中阶' THEN 2
        ELSE 1
      END DESC,
      RANDOM()
    LIMIT 1
  `).get(userId) as AnyRow | undefined;
}

export function createGameplayRouter(ctx: AppContext) {
  const r = Router();
  const { db, auth } = ctx;
  gameplayRuntime = ctx.runtime;
  ensureTables(db);
  ensureWorldNpcSystem(db);

  r.get('/notes/:ownerId/:targetId', (req, res) => {
    try {
      const ownerId = Number(req.params.ownerId);
      const targetId = Number(req.params.targetId);
      if (!ownerId || !targetId) return res.status(400).json({ success: false, message: 'invalid params' });
      const row = db.prepare(`SELECT content FROM notes WHERE ownerId=? AND targetId=? LIMIT 1`).get(ownerId, targetId) as AnyRow | undefined;
      res.json({ success: true, content: String(row?.content || '') });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e?.message || 'notes query failed' });
    }
  });

  r.post('/notes', (req, res) => {
    try {
      const ownerId = Number(req.body?.ownerId);
      const targetId = Number(req.body?.targetId);
      const content = String(req.body?.content || '');
      if (!ownerId || !targetId) return res.status(400).json({ success: false, message: 'invalid params' });
      db.prepare(
        `
          INSERT INTO notes(ownerId,targetId,content,updatedAt)
          VALUES(?,?,?,?)
          ON CONFLICT(ownerId,targetId) DO UPDATE SET content=excluded.content, updatedAt=excluded.updatedAt
        `
      ).run(ownerId, targetId, content, nowIso());
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e?.message || 'save note failed' });
    }
  });

  r.get('/world/npcs', (req, res) => {
    try {
      const userId = Number(req.query.userId || 0);
      if (!userId) return res.status(400).json({ success: false, message: 'invalid userId', npcs: [] });
      const me = getUser(db, userId);
      if (!me) return res.status(404).json({ success: false, message: 'user not found', npcs: [] });

      ensureWorldNpcSystem(db);
      const rows = loadWorldNpcsWithUserRelation(db, userId);
      const currentLocation = String(me.currentLocation || '').trim();
      const locationNpcs = currentLocation ? rows.filter((x) => String(x.currentLocation || '') === currentLocation) : [];

      return res.json({
        success: true,
        npcs: rows,
        locationNpcs,
        availableActions: Array.from(NPC_INTERACT_ACTIONS),
        message: `当前世界可互动 NPC：${rows.length}`
      });
    } catch (e: any) {
      return res.status(500).json({ success: false, message: e?.message || 'load world npc list failed', npcs: [] });
    }
  });

  r.get('/world/npcs/:npcId/status', (req, res) => {
    try {
      const userId = Number(req.query.userId || 0);
      const npcId = String(req.params.npcId || '').trim();
      if (!userId || !npcId) return res.status(400).json({ success: false, message: 'invalid params' });
      const me = getUser(db, userId);
      if (!me) return res.status(404).json({ success: false, message: 'user not found' });

      ensureWorldNpcSystem(db);
      const list = loadWorldNpcsWithUserRelation(db, userId);
      const npc = list.find((x) => String(x.id || '') === npcId);
      if (!npc) return res.status(404).json({ success: false, message: 'npc not found' });

      const positiveHint = npc.affinity >= WORLD_NPC_HIGH_AFFINITY
        ? '该 NPC 当前愿意提供地点情报；高好感下会给出高阶物品和对应派系技能。'
        : '提升好感后可获取地点情报与更高质量奖励。';

      return res.json({
        success: true,
        npc: {
          ...npc,
          availableActions: Array.from(NPC_INTERACT_ACTIONS),
          mood: affinityMood(npc.affinity),
          interactionHint: positiveHint
        }
      });
    } catch (e: any) {
      return res.status(500).json({ success: false, message: e?.message || 'load npc status failed' });
    }
  });

  r.post('/world/npcs/interact', (req, res) => {
    try {
      const userId = Number(req.body?.userId || 0);
      const npcId = String(req.body?.npcId || '').trim();
      const action = String(req.body?.action || '').trim().toLowerCase();
      if (!userId || !npcId || !action) return res.status(400).json({ success: false, message: 'invalid params' });
      if (!NPC_INTERACT_ACTIONS.has(action)) return res.status(400).json({ success: false, message: 'unsupported action' });

      const me = getUser(db, userId);
      if (!me) return res.status(404).json({ success: false, message: 'user not found' });
      ensureWorldNpcSystem(db);

      const npc = getWorldNpcById(db, npcId);
      if (!npc) return res.status(404).json({ success: false, message: 'npc not found' });
      const locationId = normalizeMapLocationId(npc.currentLocation);

      const relation = db.prepare(`
        SELECT affinity, interactionCount, lastRewardDate, rewardCount
        FROM world_npc_relations
        WHERE userId = ? AND npcId = ?
        LIMIT 1
      `).get(userId, npcId) as AnyRow | undefined;

      const currentAffinity = clamp(
        Number(relation?.affinity ?? npc.defaultAffinity ?? 50),
        WORLD_NPC_AFFINITY_MIN,
        WORLD_NPC_AFFINITY_MAX
      );
      let delta = Number(NPC_ACTION_AFFINITY_DELTA[action] || 0);
      const personality = String(npc.personality || '');
      if (delta > 0) {
        if (personality.includes('温和') || personality.includes('热情')) delta += 2;
        if (personality.includes('傲慢') || personality.includes('毒舌')) delta -= 2;
      } else if (delta < 0) {
        if (personality.includes('严肃') || personality.includes('谨慎')) delta -= 1;
      }
      delta = clamp(delta, -20, 15);

      const nextAffinity = clamp(currentAffinity + delta, WORLD_NPC_AFFINITY_MIN, WORLD_NPC_AFFINITY_MAX);
      const isPositiveAction = action === 'favor' || action === 'chat';
      const actionLabel = NPC_ACTION_LABEL_MAP[action] || action;

      let reply = pickNpcReply(action, nextAffinity, delta);
      let intel = '';
      let rewardNotice = '';
      let grantedItem: AnyRow | null = null;
      let grantedSkill: AnyRow | null = null;

      const today = todayKey();
      let lastRewardDate = String(relation?.lastRewardDate || '');
      let rewardCount = Number(relation?.rewardCount || 0);
      if (lastRewardDate !== today) rewardCount = 0;

      if (isPositiveAction && nextAffinity >= WORLD_NPC_HIGH_AFFINITY) {
        const intelPool = LOCATION_INTEL_POOL[locationId] || [];
        if (intelPool.length > 0) intel = rand(intelPool);
      }

      const canGift = isPositiveAction && nextAffinity >= WORLD_NPC_GIFT_AFFINITY;
      if (canGift && rewardCount < 1) {
        const giftItem = pickNpcLocationRewardItem(db, locationId);
        if (giftItem) {
          addItem(
            db,
            userId,
            String(giftItem.name || '神秘礼物'),
            String(giftItem.itemType || '回复道具'),
            1,
            String(giftItem.description || ''),
            Number(giftItem.effectValue || 0)
          );
          grantedItem = {
            id: Number(giftItem.id || 0),
            name: String(giftItem.name || ''),
            tier: String(giftItem.tier || '高阶'),
            itemType: String(giftItem.itemType || '回复道具'),
            faction: String(giftItem.faction || '通用')
          };
        }

        const giftSkill = pickNpcFactionSkill(db, userId, String(npc.skillFaction || '通用'));
        if (giftSkill) {
          const granted = grantSkillOrBook(db, userId, giftSkill, 1);
          grantedSkill = {
            id: Number(giftSkill.id || 0),
            name: String(giftSkill.name || ''),
            tier: String(giftSkill.tier || '低阶'),
            faction: String(giftSkill.faction || '通用'),
            learned: Boolean(granted.learned),
            convertedToBook: Boolean(granted.converted),
            message: String(granted.message || '')
          };
        }

        if (grantedItem || grantedSkill) {
          lastRewardDate = today;
          rewardCount += 1;
          rewardNotice = '高好感触发：NPC 赠送了地点高阶物品与派系技能奖励。';
        }
      } else if (canGift && rewardCount >= 1) {
        rewardNotice = '该 NPC 今日已经赠礼，明天再来。';
      }

      if (nextAffinity <= WORLD_NPC_LOW_AFFINITY) {
        intel = '';
        rewardNotice = '';
        reply = rand(NPC_RUDE_REPLY_POOL);
      }

      const nextInteractionCount = Number(relation?.interactionCount || 0) + 1;
      db.prepare(`
        INSERT INTO world_npc_relations(
          userId, npcId, affinity, lastAction, lastActionAt, interactionCount, lastRewardDate, rewardCount
        )
        VALUES(?,?,?,?,?,?,?,?)
        ON CONFLICT(userId, npcId) DO UPDATE SET
          affinity=excluded.affinity,
          lastAction=excluded.lastAction,
          lastActionAt=excluded.lastActionAt,
          interactionCount=excluded.interactionCount,
          lastRewardDate=excluded.lastRewardDate,
          rewardCount=excluded.rewardCount
      `).run(
        userId,
        npcId,
        nextAffinity,
        action,
        nowIso(),
        nextInteractionCount,
        lastRewardDate,
        rewardCount
      );

      return res.json({
        success: true,
        action,
        actionLabel,
        affinity: nextAffinity,
        affinityChange: delta,
        affinityStage: affinityStage(nextAffinity),
        message: `${String(npc.name || 'NPC')} 对你的好感度 ${delta >= 0 ? `+${delta}` : `${delta}`}，当前为 ${nextAffinity}（${affinityStage(nextAffinity)}）`,
        reply,
        intel,
        rewardNotice,
        reward: {
          item: grantedItem,
          skill: grantedSkill
        },
        npc: {
          id: String(npc.id || ''),
          name: String(npc.name || '未知NPC'),
          skillFaction: String(npc.skillFaction || '通用'),
          personality: String(npc.personality || ''),
          identity: String(npc.identity || ''),
          appearance: String(npc.appearance || ''),
          currentLocation: locationId,
          locationName: MAP_LOCATION_NAME_MAP[locationId] || locationId,
          mood: affinityMood(nextAffinity)
        }
      });
    } catch (e: any) {
      return res.status(500).json({ success: false, message: e?.message || 'npc interaction failed' });
    }
  });

  r.put('/users/:id/avatar', (req, res) => {
    try {
      const id = Number(req.params.id);
      const avatarUrl = String(req.body?.avatarUrl || '').trim();
      if (!id || !avatarUrl) return res.status(400).json({ success: false, message: 'id/avatarUrl required' });
      db.prepare(`UPDATE users SET avatarUrl=?, avatarUpdatedAt=?, updatedAt=? WHERE id=?`).run(avatarUrl, nowIso(), nowIso(), id);
      res.json({ success: true, avatarUrl });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e?.message || 'save avatar failed' });
    }
  });

  r.get('/users/:id/inventory', (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!id) return res.status(400).json({ success: false, message: 'invalid id' });
      const items = db.prepare(`SELECT * FROM inventory WHERE userId=? ORDER BY id DESC`).all(id) as AnyRow[];
      res.json({ success: true, items });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e?.message || 'inventory query failed', items: [] });
    }
  });

  r.post('/users/:id/inventory/add', (req, res) => {
    try {
      const id = Number(req.params.id);
      const name = String(req.body?.name || '').trim();
      const qty = clamp(Number(req.body?.qty || 1), 1, 99);
      const itemType = String(req.body?.itemType || 'consumable');
      if (!id || !name) return res.status(400).json({ success: false, message: 'invalid params' });
      addItem(db, id, name, itemType, qty);
      res.json({ success: true, message: `added ${name} x${qty}` });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e?.message || 'add inventory failed' });
    }
  });

  r.post('/inventory/use', (req, res) => {
    try {
      const userId = Number(req.body?.userId);
      const inventoryId = Number(req.body?.inventoryId);
      if (!userId || !inventoryId) return res.status(400).json({ success: false, message: 'invalid params' });

      const item = db.prepare(`SELECT * FROM inventory WHERE id=? AND userId=? LIMIT 1`).get(inventoryId, userId) as AnyRow | undefined;
      if (!item) return res.status(404).json({ success: false, message: 'item not found' });

      const user = getUser(db, userId);
      if (!user) return res.status(404).json({ success: false, message: 'user not found' });

      let useMessage = 'item used';
      const itemType = String(item.itemType || '').trim();
      const isSkillBook = itemType.includes('skill') || itemType.includes('技能书') || String(item.name || '').includes('技能书');
      if (isSkillBook) {
        const skillName = String(item.name || '').replace(/^\[技能书\]\s*/i, '').trim();
        if (skillName) {
          const skill = db.prepare(`SELECT id, name, faction FROM skills WHERE name=? LIMIT 1`).get(skillName) as AnyRow | undefined;
          if (skill) {
            const granted = grantSkillOrBook(db, userId, skill, 1);
            useMessage = granted.message;
          }
        }
      } else if (itemType === '任务道具') {
        useMessage = '任务道具已提交';
      } else if (itemType === '贵重物品') {
        const gain = Math.max(1, Number(item.effectValue || 100));
        db.prepare(`UPDATE users SET gold = COALESCE(gold, 0) + ?, updatedAt=? WHERE id=?`).run(gain, nowIso(), userId);
        useMessage = `贵重物品已售出，获得 ${gain}G`;
      } else if (itemType === '违禁品') {
        const itemName = String(item.name || '');
        const base = clamp(Math.trunc(Number(item.effectValue || 24)), 8, 200);

        if (itemName.includes('哨兵型')) {
          const phyGain = Math.max(10, Math.floor(base * 1.1));
          const furyGain = Math.max(6, Math.floor(base * 0.55));
          const hpCost = Math.max(4, Math.floor(base * 0.3));
          const stabLoss = Math.max(3, Math.floor(base * 0.2));
          db.prepare(`
            UPDATE users
            SET physicalProgress = COALESCE(physicalProgress, 0) + ?,
                fury = MIN(100, COALESCE(fury, 0) + ?),
                guideStability = MAX(0, COALESCE(guideStability, 100) - ?),
                hp = MAX(1, COALESCE(hp, 100) - ?),
                updatedAt = ?
            WHERE id = ?
          `).run(phyGain, furyGain, stabLoss, hpCost, nowIso(), userId);
          useMessage = `违禁品生效：短时伪装哨兵，体能成长 +${phyGain}，副作用 HP -${hpCost}`;
        } else if (itemName.includes('向导型')) {
          const mentalGain = Math.max(10, Math.floor(base * 1.15));
          const stabGain = Math.max(8, Math.floor(base * 0.6));
          const mpGain = Math.max(8, Math.floor(base * 0.8));
          const hpCost = Math.max(3, Math.floor(base * 0.2));
          db.prepare(`
            UPDATE users
            SET mentalProgress = COALESCE(mentalProgress, 0) + ?,
                guideStability = MIN(100, COALESCE(guideStability, 100) + ?),
                mp = MIN(COALESCE(maxMp, 100), COALESCE(mp, 100) + ?),
                hp = MAX(1, COALESCE(hp, 100) - ?),
                updatedAt = ?
            WHERE id = ?
          `).run(mentalGain, stabGain, mpGain, hpCost, nowIso(), userId);
          useMessage = `违禁品生效：短时伪装向导，精神成长 +${mentalGain}，副作用 HP -${hpCost}`;
        } else if (itemName.includes('抑制剂') || itemName.includes('降噪')) {
          const furyDrop = Math.max(8, Math.floor(base * 0.75));
          const stabDrop = Math.max(8, Math.floor(base * 0.55));
          const mentalLoss = Math.max(5, Math.floor(base * 0.45));
          const phyLoss = Math.max(5, Math.floor(base * 0.45));
          db.prepare(`
            UPDATE users
            SET fury = MAX(0, COALESCE(fury, 0) - ?),
                guideStability = MAX(0, COALESCE(guideStability, 100) - ?),
                mentalProgress = MAX(0, COALESCE(mentalProgress, 0) - ?),
                physicalProgress = MAX(0, COALESCE(physicalProgress, 0) - ?),
                updatedAt = ?
            WHERE id = ?
          `).run(furyDrop, stabDrop, mentalLoss, phyLoss, nowIso(), userId);
          useMessage = `违禁品生效：身份压制完成，副作用 精/体成长 -${mentalLoss}/${phyLoss}`;
        } else if (itemName.includes('透支晋阶')) {
          const boost = Math.max(16, Math.floor(base * 1.4));
          const hpCost = Math.max(10, Math.floor(base * 0.7));
          const mpCost = Math.max(10, Math.floor(base * 0.65));
          const stabLoss = Math.max(8, Math.floor(base * 0.5));
          const furyGain = Math.max(8, Math.floor(base * 0.4));
          db.prepare(`
            UPDATE users
            SET mentalProgress = COALESCE(mentalProgress, 0) + ?,
                physicalProgress = COALESCE(physicalProgress, 0) + ?,
                hp = MAX(1, COALESCE(hp, 100) - ?),
                mp = MAX(0, COALESCE(mp, 100) - ?),
                guideStability = MAX(0, COALESCE(guideStability, 100) - ?),
                fury = MIN(100, COALESCE(fury, 0) + ?),
                updatedAt = ?
            WHERE id = ?
          `).run(boost, boost, hpCost, mpCost, stabLoss, furyGain, nowIso(), userId);
          useMessage = `违禁品生效：透支晋阶，精/体成长 +${boost}，反噬 HP -${hpCost} MP -${mpCost}`;
        } else {
          const gain = Math.max(6, Math.floor(base * 0.8));
          const hpCost = Math.max(3, Math.floor(base * 0.25));
          db.prepare(`
            UPDATE users
            SET mentalProgress = COALESCE(mentalProgress, 0) + ?,
                physicalProgress = COALESCE(physicalProgress, 0) + ?,
                hp = MAX(1, COALESCE(hp, 100) - ?),
                updatedAt = ?
            WHERE id = ?
          `).run(gain, gain, hpCost, nowIso(), userId);
          useMessage = `违禁品生效：精/体成长 +${gain}，副作用 HP -${hpCost}`;
        }
      } else if (itemType === '辟邪符') {
        const durationHours = Math.max(1, Number(item.effectValue || 4));
        const immuneUntil = new Date(Date.now() + durationHours * 60 * 60 * 1000).toISOString();
        db.prepare(`UPDATE users SET ghostImmuneUntil=?, updatedAt=? WHERE id=?`).run(immuneUntil, nowIso(), userId);
        useMessage = `辟邪符已激活，将免疫鬼魂光环 ${durationHours} 小时（至 ${immuneUntil.slice(0,16).replace('T',' ')} UTC）`;
      } else {
        const heal = Number(item.effectValue || 20) || 20;
        const descText = `${String(item.name || '')} ${String(item.description || '')}`;
        const shouldCalm = /狂暴|镇静|抚慰|冷静|安神/.test(descText);
        const furyDrop = shouldCalm ? heal : 0;
        db.prepare(`
          UPDATE users
          SET hp = MIN(maxHp, hp + ?),
              mp = MIN(maxMp, mp + ?),
              fury = MAX(0, COALESCE(fury, 0) - ?),
              updatedAt = ?
          WHERE id = ?
        `).run(heal, Math.floor(heal / 2), furyDrop, nowIso(), userId);
        useMessage = furyDrop > 0 ? `道具使用成功，狂暴值 -${furyDrop}` : '道具使用成功';
      }

      if (Number(item.qty || 1) <= 1) db.prepare(`DELETE FROM inventory WHERE id=?`).run(inventoryId);
      else db.prepare(`UPDATE inventory SET qty = qty - 1 WHERE id=?`).run(inventoryId);

      res.json({ success: true, message: useMessage });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e?.message || 'use item failed' });
    }
  });

  // 精神体状态面板（仅哨兵/向导可用，其他身份返回 unavailable）
  r.get('/users/:id/spirit-status', (req, res) => {
    try {
      const userId = Number(req.params.id || 0);
      if (!userId) return res.status(400).json({ success: false, message: 'invalid userId' });
      const user = getUser(db, userId);
      if (!user) return res.status(404).json({ success: false, message: 'user not found' });

      const available = canUseSpiritSystem(String(user.role || ''));
      if (!available) {
        return res.json({
          success: true,
          available: false,
          spiritStatus: buildSpiritStatus(user)
        });
      }

      const normalized = resetSpiritDailyIfNeeded(db, user);
      return res.json({
        success: true,
        available: true,
        spiritStatus: buildSpiritStatus(normalized)
      });
    } catch (e: any) {
      return res.status(500).json({ success: false, message: e?.message || 'query spirit status failed' });
    }
  });

  // 精神体互动：喂食/摸摸/训练（每天每项上限 3 次）
  r.post('/tower/interact-spirit', (req, res) => {
    try {
      const userId = Number(req.body?.userId || 0);
      if (!userId) return res.status(400).json({ success: false, message: 'invalid userId' });
      let user = getUser(db, userId);
      if (!user) return res.status(404).json({ success: false, message: 'user not found' });

      if (!canUseSpiritSystem(String(user.role || ''))) {
        return res.status(403).json({ success: false, message: '仅哨兵/向导可使用精神体培养功能' });
      }

      user = resetSpiritDailyIfNeeded(db, user);

      const setName = String(req.body?.name || '').trim();
      const setImage = String(req.body?.imageUrl || '').trim();
      const setAppearance = String(req.body?.appearance || '').trim();

      // 名字/头像/外貌默认仅允许锁定一次
      if (setName) {
        if (Number(user.spiritNameLocked || 0) === 1 || String(user.spiritName || '').trim()) {
          return res.status(400).json({ success: false, message: '精神体名字已锁定，不能再次修改' });
        }
        db.prepare(`
          UPDATE users
          SET spiritName = ?, spiritNameLocked = 1, updatedAt = ?
          WHERE id = ?
        `).run(setName, nowIso(), userId);
        user = getUser(db, userId) || user;
      }

      if (setImage) {
        if (Number(user.spiritAvatarLocked || 0) === 1 || String(user.spiritImageUrl || '').trim()) {
          return res.status(400).json({ success: false, message: '精神体头像已锁定，不能再次修改' });
        }
        db.prepare(`
          UPDATE users
          SET spiritImageUrl = ?, spiritAvatarLocked = 1, updatedAt = ?
          WHERE id = ?
        `).run(setImage, nowIso(), userId);
        user = getUser(db, userId) || user;
      }

      if (setAppearance) {
        if (Number(user.spiritAppearanceLocked || 0) === 1 || String(user.spiritAppearance || '').trim()) {
          return res.status(400).json({ success: false, message: '精神体外貌已锁定，不能再次修改' });
        }
        db.prepare(`
          UPDATE users
          SET spiritAppearance = ?, spiritAppearanceLocked = 1, updatedAt = ?
          WHERE id = ?
        `).run(setAppearance, nowIso(), userId);
        user = getUser(db, userId) || user;
      }

      const action = normalizeSpiritAction(req.body?.action, req.body?.intimacyGain);
      if (!action) {
        return res.json({
          success: true,
          message: '精神体资料已更新',
          levelUp: false,
          spiritStatus: buildSpiritStatus(user)
        });
      }

      const cfg = SPIRIT_ACTIONS[action];
      const currentCount = Number((user as any)[cfg.counter] || 0);
      if (currentCount >= 3) {
        return res.status(400).json({ success: false, message: `今日${action === 'feed' ? '喂食' : action === 'pet' ? '摸摸' : '训练'}次数已达上限（3次）` });
      }

      const beforeIntimacy = Number(user.spiritIntimacy || 0);
      const beforeLevel = Math.max(1, Number(user.spiritLevel || 1));
      const afterIntimacy = beforeIntimacy + cfg.gain;
      const levelUpTimes = Math.max(0, Math.floor(afterIntimacy / 100) - Math.floor(beforeIntimacy / 100));
      const afterLevel = beforeLevel + levelUpTimes;
      const mentalBonus = action === 'train' ? 5 : 0;
      const levelUpMentalBonus = levelUpTimes * 20;

      db.prepare(`
        UPDATE users
        SET spiritIntimacy = ?,
            spiritLevel = ?,
            ${cfg.counter} = COALESCE(${cfg.counter}, 0) + 1,
            mentalProgress = COALESCE(mentalProgress, 0) + ?,
            spiritInteractDate = ?,
            updatedAt = ?
        WHERE id = ?
      `).run(
        afterIntimacy,
        afterLevel,
        mentalBonus + levelUpMentalBonus,
        todayKey(),
        nowIso(),
        userId
      );

      const updated = getUser(db, userId) || user;
      return res.json({
        success: true,
        levelUp: levelUpTimes > 0,
        message: levelUpTimes > 0 ? `精神体等级提升 +${levelUpTimes}` : '互动完成',
        spiritStatus: buildSpiritStatus(updated)
      });
    } catch (e: any) {
      return res.status(500).json({ success: false, message: e?.message || 'interact spirit failed' });
    }
  });

  // 签到：每日一次工资结算（主要用于塔区职位）
  r.post('/tower/checkin', (req, res) => {
    try {
      const userId = Number(req.body?.userId || 0);
      if (!userId) return res.status(400).json({ success: false, message: 'invalid userId' });
      const user = getUser(db, userId);
      if (!user) return res.status(404).json({ success: false, message: 'user not found' });

      const today = todayKey();
      if (String(user.lastCheckInDate || '') === today) {
        return res.status(400).json({ success: false, message: '今日已签到' });
      }

      const job = String(user.job || '');
      let reward = 600;
      if (job.includes('神使')) reward = 2400;
      else if (job.includes('后裔')) reward = 2000;
      else if (job.includes('侍奉')) reward = 1800;
      else if (job.includes('仆从')) reward = 1200;
      reward += Math.floor(Math.random() * 201);

      db.prepare(`
        UPDATE users
        SET gold = COALESCE(gold, 0) + ?,
            lastCheckInDate = ?,
            updatedAt = ?
        WHERE id = ?
      `).run(reward, today, nowIso(), userId);

      return res.json({ success: true, reward, message: `签到成功，获得 ${reward}G` });
    } catch (e: any) {
      return res.status(500).json({ success: false, message: e?.message || 'checkin failed' });
    }
  });

  // 休息：回复满 HP / MP（家园与部分地图共用）
  r.post('/tower/rest', (req, res) => {
    try {
      const userId = Number(req.body?.userId || 0);
      if (!userId) return res.status(400).json({ success: false, message: 'invalid userId' });
      const user = getUser(db, userId);
      if (!user) return res.status(404).json({ success: false, message: 'user not found' });

      db.prepare(`
        UPDATE users
        SET hp = COALESCE(maxHp, 100),
            mp = COALESCE(maxMp, 100),
            updatedAt = ?
        WHERE id = ?
      `).run(nowIso(), userId);

      const updated = getUser(db, userId);
      return res.json({
        success: true,
        hp: Number(updated?.hp || 0),
        mp: Number(updated?.mp || 0),
        message: '休息完成，状态已恢复'
      });
    } catch (e: any) {
      return res.status(500).json({ success: false, message: e?.message || 'rest failed' });
    }
  });

  // 命之塔净化：按职位净化侵蚀，施术者消耗自身 20% MP
  r.post('/tower/purify-erosion', (req, res) => {
    try {
      const userId = Number(req.body?.userId || 0);
      const targetUserId = Number(req.body?.targetUserId || userId || 0);
      if (!userId || !targetUserId) return res.status(400).json({ success: false, message: 'invalid userId' });

      const purifier = getUser(db, userId);
      if (!purifier) return res.status(404).json({ success: false, message: 'user not found' });

      const purifyRate = getTowerPurifyRate(purifier.job);
      if (purifyRate <= 0) {
        return res.status(403).json({ success: false, message: '只有命之塔成员职位可执行净化' });
      }
      if (String(purifier.currentLocation || '') !== 'tower_of_life') {
        return res.status(403).json({ success: false, message: '请先进入命之塔后再执行净化' });
      }

      const target = getUser(db, targetUserId);
      if (!target) return res.status(404).json({ success: false, message: 'target user not found' });
      if (String(target.currentLocation || '') !== 'tower_of_life') {
        return res.status(409).json({ success: false, message: '目标不在命之塔，无法净化侵蚀' });
      }

      const maxMp = Math.max(1, Number(purifier.maxMp || 100));
      const currentMp = clamp(Number(purifier.mp ?? maxMp), 0, maxMp);
      const mpCost = Math.max(1, Math.ceil(maxMp * TOWER_PURIFY_MP_COST_RATIO));
      if (currentMp < mpCost) {
        return res.status(409).json({ success: false, message: `MP 不足：需要 ${mpCost}` });
      }

      const erosionBefore = clamp(Number(target.erosionLevel || 0), 0, WILD_DEBUFF_LEVEL_CAP);
      const cleaned = Number((erosionBefore * purifyRate).toFixed(2));
      const erosionAfter = clamp(Number((erosionBefore - cleaned).toFixed(2)), 0, WILD_DEBUFF_LEVEL_CAP);
      const purifierMpAfter = clamp(currentMp - mpCost, 0, maxMp);

      db.prepare(`
        UPDATE users
        SET mp = ?,
            updatedAt = ?
        WHERE id = ?
      `).run(purifierMpAfter, nowIso(), userId);

      if (erosionBefore > 0) {
        db.prepare(`
          UPDATE users
          SET erosionLevel = ?,
              updatedAt = ?
          WHERE id = ?
        `).run(erosionAfter, nowIso(), targetUserId);
      }

      const refreshedPurifier = getUser(db, userId) || purifier;
      const refreshedTarget = getUser(db, targetUserId) || target;
      const roleRateText = `${Math.round(purifyRate * 100)}%`;
      const targetLabel = userId === targetUserId ? '自身' : String(target.name || `玩家#${targetUserId}`);
      const baseText = erosionBefore > 0
        ? `净化完成：对${targetLabel}净化 ${roleRateText} 侵蚀（${erosionBefore.toFixed(1)}% -> ${erosionAfter.toFixed(1)}%）`
        : `净化已施放：${targetLabel} 当前无侵蚀效果`;

      return res.json({
        success: true,
        message: `${baseText}，你消耗了 ${mpCost} MP`,
        purifyRate: Number((purifyRate * 100).toFixed(2)),
        mpCost,
        purifier: {
          id: Number(refreshedPurifier.id || 0),
          mp: Number(refreshedPurifier.mp || 0),
          maxMp: Number(refreshedPurifier.maxMp || maxMp)
        },
        target: {
          id: Number(refreshedTarget.id || 0),
          name: String(refreshedTarget.name || ''),
          erosionLevel: Number(refreshedTarget.erosionLevel || 0)
        }
      });
    } catch (e: any) {
      return res.status(500).json({ success: false, message: e?.message || 'tower purify failed' });
    }
  });

  // 圣所诊所：消耗 10 金币回满 HP
  r.post('/sanctuary/clinic/heal', (req, res) => {
    try {
      const userId = Number(req.body?.userId || 0);
      if (!userId) return res.status(400).json({ success: false, message: 'invalid userId' });
      const user = getUser(db, userId);
      if (!user) return res.status(404).json({ success: false, message: 'user not found' });
      if (String(user.currentLocation || '') !== 'sanctuary') {
        return res.status(403).json({ success: false, message: '请先进入圣所诊所' });
      }

      const goldCost = 10;
      const curGold = Math.max(0, Number(user.gold || 0));
      if (curGold < goldCost) {
        return res.status(409).json({
          success: false,
          message: `金币不足：需要 ${goldCost}G`
        });
      }

      const nextGold = curGold - goldCost;
      db.prepare(`
        UPDATE users
        SET hp = COALESCE(maxHp, 100),
            gold = ?,
            updatedAt = ?
        WHERE id = ?
      `).run(nextGold, nowIso(), userId);

      const updated = getUser(db, userId) || user;
      return res.json({
        success: true,
        hp: Number(updated.hp || 0),
        gold: Number(updated.gold || 0),
        cost: goldCost,
        message: `诊疗完成：消耗 ${goldCost}G，血量已回满`
      });
    } catch (e: any) {
      return res.status(500).json({ success: false, message: e?.message || 'sanctuary clinic heal failed' });
    }
  });

  // 圣所止血：清除流血程度
  r.post('/sanctuary/cure-bleeding', (req, res) => {
    try {
      const userId = Number(req.body?.userId || 0);
      if (!userId) return res.status(400).json({ success: false, message: 'invalid userId' });
      const user = getUser(db, userId);
      if (!user) return res.status(404).json({ success: false, message: 'user not found' });
      if (String(user.currentLocation || '') !== 'sanctuary') {
        return res.status(403).json({ success: false, message: '请先进入圣所后再进行止血治疗' });
      }

      const before = clamp(Number(user.bleedingLevel || 0), 0, WILD_DEBUFF_LEVEL_CAP);
      db.prepare(`
        UPDATE users
        SET bleedingLevel = 0,
            updatedAt = ?
        WHERE id = ?
      `).run(nowIso(), userId);

      const updated = getUser(db, userId) || user;
      const message = before > 0 ? `止血成功：流血程度 ${before.toFixed(1)}% -> 0%` : '当前没有流血状态';
      return res.json({
        success: true,
        message,
        hp: Number(updated.hp || 0),
        bleedingLevel: Number(updated.bleedingLevel || 0)
      });
    } catch (e: any) {
      return res.status(500).json({ success: false, message: e?.message || 'sanctuary bleeding cure failed' });
    }
  });

  // 守塔会互动：冥想 / 赎罪
  r.post('/tower/guard/ritual', (req, res) => {
    try {
      const userId = Number(req.body?.userId || 0);
      const ritualType = String(req.body?.type || '').trim(); // meditate | atonement
      if (!userId || !ritualType) return res.status(400).json({ success: false, message: 'invalid params' });
      const user = getUser(db, userId);
      if (!user) return res.status(404).json({ success: false, message: 'user not found' });

      const maxMp = Math.max(1, Number(user.maxMp || 100));
      const nowMp = Math.max(0, Number(user.mp || 0));
      const nowFury = Math.max(0, Number(user.fury || 0));
      const role = String(user.role || '');
      const isSentinel = role === '哨兵' || role.toLowerCase() === 'sentinel';

      let nextMp = nowMp;
      let nextFury = nowFury;
      let message = '';
      if (ritualType === 'meditate') {
        nextMp = Math.min(maxMp, nowMp + Math.ceil(maxMp * 0.3));
        message = '冥想完成，MP 恢复 30%';
      } else if (ritualType === 'atonement') {
        if (isSentinel) {
          nextFury = Math.max(0, nowFury - 10);
          message = '赎罪完成，哨兵狂暴值 -10%';
        } else {
          nextMp = Math.min(maxMp, nowMp + Math.ceil(maxMp * 0.3));
          message = '赎罪完成，MP 恢复 30%';
        }
      } else {
        return res.status(400).json({ success: false, message: 'unknown ritual type' });
      }

      db.prepare(`
        UPDATE users
        SET mp = ?,
            fury = ?,
            updatedAt = ?
        WHERE id = ?
      `).run(nextMp, nextFury, nowIso(), userId);

      return res.json({
        success: true,
        message,
        mp: nextMp,
        fury: nextFury
      });
    } catch (e: any) {
      return res.status(500).json({ success: false, message: e?.message || 'guard ritual failed' });
    }
  });

  // 打工：通用日常收益（每日 3 次）
  r.post('/tower/work', (req, res) => {
    try {
      const userId = Number(req.body?.userId || 0);
      if (!userId) return res.status(400).json({ success: false, message: 'invalid userId' });
      const user = getUser(db, userId);
      if (!user) return res.status(404).json({ success: false, message: 'user not found' });

      const workCount = Number(user.workCount || 0);
      if (workCount >= 3) {
        return res.status(400).json({ success: false, message: '今日工作次数已达上限' });
      }

      const loc = String(user.currentLocation || '');
      let reward = 120 + Math.floor(Math.random() * 180);
      if (loc === 'rich_area') reward += 600;
      else if (loc === 'slums') reward += 120;
      else if (loc === 'army') reward += 260;

      db.prepare(`
        UPDATE users
        SET gold = COALESCE(gold, 0) + ?,
            workCount = COALESCE(workCount, 0) + 1,
            updatedAt = ?
        WHERE id = ?
      `).run(reward, nowIso(), userId);

      return res.json({
        success: true,
        reward,
        workCount: workCount + 1,
        message: `获得 ${reward}G`
      });
    } catch (e: any) {
      return res.status(500).json({ success: false, message: e?.message || 'work failed' });
    }
  });

  // 兼容旧前端：商铺扣款委托（仅用于资金托管扣费）
  r.post('/commissions', (req, res) => {
    try {
      const publisherId = Number(req.body?.publisherId || req.body?.userId || 0);
      const reward = Math.max(0, Math.trunc(Number(req.body?.reward || req.body?.rewardGold || 0)));
      const title = String(req.body?.title || '兼容委托').trim() || '兼容委托';
      const id = String(req.body?.id || `legacy-${Date.now()}-${publisherId}`);

      if (!publisherId) return res.status(400).json({ success: false, message: 'invalid publisherId' });
      if (reward <= 0) return res.status(400).json({ success: false, message: 'invalid reward' });

      const user = getUser(db, publisherId);
      if (!user) return res.status(404).json({ success: false, message: 'user not found' });
      if (Number(user.gold || 0) < reward) {
        return res.status(400).json({ success: false, message: `金币不足：需要 ${reward}G` });
      }

      const ts = nowIso();
      const tx = db.transaction(() => {
        db.prepare(`UPDATE users SET gold = gold - ?, updatedAt = ? WHERE id = ?`).run(reward, ts, publisherId);
        db.prepare(`
          INSERT OR REPLACE INTO legacy_commissions(
            id, publisherUserId, title, reward, createdAt, updatedAt
          )
          VALUES (?, ?, ?, ?, COALESCE((SELECT createdAt FROM legacy_commissions WHERE id = ?), ?), ?)
        `).run(id, publisherId, title, reward, id, ts, ts);
      });
      tx();

      const fresh = getUser(db, publisherId) || user;
      return res.json({
        success: true,
        id,
        reward,
        gold: Number(fresh.gold || 0),
        message: `托管成功：已扣除 ${reward}G`
      });
    } catch (e: any) {
      return res.status(500).json({ success: false, message: e?.message || 'legacy commissions failed' });
    }
  });

  // 训练结算：军队练兵场 / 恶魔会赌场小游戏
  r.post('/training/complete', (req, res) => {
    try {
      const userId = Number(req.body?.userId || 0);
      if (!userId) return res.status(400).json({ success: false, message: 'invalid userId' });
      const user = getUser(db, userId);
      if (!user) return res.status(404).json({ success: false, message: 'user not found' });

      const trainCount = Number(user.trainCount || 0);
      if (trainCount >= 3) {
        return res.status(400).json({ success: false, message: '今日训练次数已达上限' });
      }

      const loc = String(user.currentLocation || '').trim();
      let mentalGain = 2;
      let physicalGain = 2;
      let reward = 120 + Math.floor(Math.random() * 160);
      let message = '训练完成，精体成长均获得提升';

      if (loc === 'army') {
        mentalGain = 1;
        physicalGain = 6;
        reward += 120;
        message = '军队特训完成：肉体强度显著提升';
      } else if (loc === 'demon_society') {
        mentalGain = 6;
        physicalGain = 1;
        reward += 80;
        message = '恶魔会对赌完成：精神抗压能力显著提升';
      }

      const nextMental = clamp(Number(user.mentalProgress || 0) + mentalGain, 0, 9999);
      const nextPhysical = clamp(Number(user.physicalProgress || 0) + physicalGain, 0, 9999);

      db.prepare(`
        UPDATE users
        SET trainCount = COALESCE(trainCount, 0) + 1,
            gold = COALESCE(gold, 0) + ?,
            mentalProgress = ?,
            physicalProgress = ?,
            updatedAt = ?
        WHERE id = ?
      `).run(reward, nextMental, nextPhysical, nowIso(), userId);

      return res.json({
        success: true,
        reward,
        trainCount: trainCount + 1,
        mentalProgress: nextMental,
        physicalProgress: nextPhysical,
        message: `${message}，并获得 ${reward}G`
      });
    } catch (e: any) {
      return res.status(500).json({ success: false, message: e?.message || 'training complete failed' });
    }
  });

  // 西市阴暗小巷：每日闲逛事件（抢劫/拾荒/炼金产物）
  r.get('/slums/alley/state', (req, res) => {
    try {
      const userId = Number(req.query.userId || 0);
      if (!userId) return res.status(400).json({ success: false, message: 'invalid userId' });
      const raw = getUser(db, userId);
      if (!raw) return res.status(404).json({ success: false, message: 'user not found' });
      const me = resetSlumAlleyDailyIfNeeded(db, raw);
      const robbedCount = Math.max(0, Number(me.slumAlleyRobbedCount || 0));
      return res.json({
        success: true,
        daily: {
          date: String(me.slumAlleyDate || todayKey()),
          robbedCount,
          robbedMax: SLUM_ALLEY_ROB_DAILY_MAX,
          robbedRemaining: Math.max(0, SLUM_ALLEY_ROB_DAILY_MAX - robbedCount),
          strollCount: Math.max(0, Number(me.slumAlleyStrollCount || 0))
        }
      });
    } catch (e: any) {
      return res.status(500).json({ success: false, message: e?.message || 'query slum alley state failed' });
    }
  });

  r.post('/slums/alley/stroll', (req, res) => {
    try {
      const userId = Number(req.body?.userId || 0);
      if (!userId) return res.status(400).json({ success: false, message: 'invalid userId' });
      const raw = getUser(db, userId);
      if (!raw) return res.status(404).json({ success: false, message: 'user not found' });
      if (!['approved', 'ghost'].includes(String(raw.status || ''))) {
        return res.status(403).json({ success: false, message: '当前状态无法在小巷闲逛' });
      }
      if (String(raw.currentLocation || '') !== 'slums') {
        return res.status(403).json({ success: false, message: '请先抵达西市，再进入阴暗小巷' });
      }

      const me = resetSlumAlleyDailyIfNeeded(db, raw);
      const robbedBefore = Math.max(0, Number(me.slumAlleyRobbedCount || 0));
      const goldNow = Math.max(0, Number(me.gold || 0));
      const canBeRobbed = robbedBefore < SLUM_ALLEY_ROB_DAILY_MAX && goldNow > 0;
      const roll = Math.random();
      const ts = nowIso();

      if (canBeRobbed && roll < SLUM_ALLEY_ROB_CHANCE) {
        const loss = clamp(Math.floor(Math.random() * 50) + 1, 1, Math.min(50, goldNow));
        db.prepare(`
          UPDATE users
          SET gold = COALESCE(gold, 0) - ?,
              slumAlleyRobbedCount = COALESCE(slumAlleyRobbedCount, 0) + 1,
              slumAlleyStrollCount = COALESCE(slumAlleyStrollCount, 0) + 1,
              updatedAt = ?
          WHERE id = ?
        `).run(loss, ts, userId);
        const fresh = getUser(db, userId) || me;
        const robbedCount = Math.max(0, Number(fresh.slumAlleyRobbedCount || 0));
        return res.json({
          success: true,
          eventType: 'robbed',
          lostGold: loss,
          gold: Math.max(0, Number(fresh.gold || 0)),
          daily: {
            date: String(fresh.slumAlleyDate || todayKey()),
            robbedCount,
            robbedMax: SLUM_ALLEY_ROB_DAILY_MAX,
            robbedRemaining: Math.max(0, SLUM_ALLEY_ROB_DAILY_MAX - robbedCount),
            strollCount: Math.max(0, Number(fresh.slumAlleyStrollCount || 0))
          },
          message: `你在阴暗小巷被盯上了，损失 ${loss}G`
        });
      }

      if (roll < SLUM_ALLEY_ROB_CHANCE + SLUM_ALLEY_ITEM_CHANCE) {
        const preferAlchemy = Math.random() < SLUM_ALLEY_ALCHEMY_RATE;
        const picked = pickSlumAlleyItem(db, preferAlchemy);
        const rawType = String(picked.item.itemType || '回复道具');
        const invType = rawType === '技能书道具' ? 'skill_book' : rawType;
        addItem(
          db,
          userId,
          String(picked.item.name || '神秘道具'),
          invType,
          1,
          String(picked.item.description || ''),
          Number(picked.item.effectValue || 0)
        );
        db.prepare(`
          UPDATE users
          SET slumAlleyStrollCount = COALESCE(slumAlleyStrollCount, 0) + 1,
              updatedAt = ?
          WHERE id = ?
        `).run(ts, userId);
        const fresh = getUser(db, userId) || me;
        const robbedCount = Math.max(0, Number(fresh.slumAlleyRobbedCount || 0));
        return res.json({
          success: true,
          eventType: picked.isAlchemy ? 'alchemy_item' : 'item',
          item: {
            name: String(picked.item.name || ''),
            itemType: rawType,
            tier: String(picked.item.tier || '低阶')
          },
          gold: Math.max(0, Number(fresh.gold || 0)),
          daily: {
            date: String(fresh.slumAlleyDate || todayKey()),
            robbedCount,
            robbedMax: SLUM_ALLEY_ROB_DAILY_MAX,
            robbedRemaining: Math.max(0, SLUM_ALLEY_ROB_DAILY_MAX - robbedCount),
            strollCount: Math.max(0, Number(fresh.slumAlleyStrollCount || 0))
          },
          message: picked.isAlchemy
            ? `你在暗巷角落捡到了炼金产物：${String(picked.item.name || '未知产物')}`
            : `你在暗巷里翻到了一件物资：${String(picked.item.name || '未知物资')}`
        });
      }

      db.prepare(`
        UPDATE users
        SET slumAlleyStrollCount = COALESCE(slumAlleyStrollCount, 0) + 1,
            updatedAt = ?
        WHERE id = ?
      `).run(ts, userId);
      const fresh = getUser(db, userId) || me;
      const robbedCount = Math.max(0, Number(fresh.slumAlleyRobbedCount || 0));
      return res.json({
        success: true,
        eventType: 'safe',
        gold: Math.max(0, Number(fresh.gold || 0)),
        daily: {
          date: String(fresh.slumAlleyDate || todayKey()),
          robbedCount,
          robbedMax: SLUM_ALLEY_ROB_DAILY_MAX,
          robbedRemaining: Math.max(0, SLUM_ALLEY_ROB_DAILY_MAX - robbedCount),
          strollCount: Math.max(0, Number(fresh.slumAlleyStrollCount || 0))
        },
        message: '你在阴暗小巷绕了一圈，暂时没有发生特别事件。'
      });
    } catch (e: any) {
      return res.status(500).json({ success: false, message: e?.message || 'slum alley stroll failed' });
    }
  });

  // 东市繁华街道：闲逛事件（偏高价值拾取）
  r.get('/rich/street/state', (req, res) => {
    try {
      const userId = Number(req.query.userId || 0);
      if (!userId) return res.status(400).json({ success: false, message: 'invalid userId' });
      const raw = getUser(db, userId);
      if (!raw) return res.status(404).json({ success: false, message: 'user not found' });
      const me = resetRichStreetDailyIfNeeded(db, raw);
      return res.json({
        success: true,
        daily: {
          date: String(me.richStreetDate || todayKey()),
          strollCount: Math.max(0, Number(me.richStreetStrollCount || 0))
        }
      });
    } catch (e: any) {
      return res.status(500).json({ success: false, message: e?.message || 'query rich street state failed' });
    }
  });

  r.post('/rich/street/stroll', (req, res) => {
    try {
      const userId = Number(req.body?.userId || 0);
      if (!userId) return res.status(400).json({ success: false, message: 'invalid userId' });
      const raw = getUser(db, userId);
      if (!raw) return res.status(404).json({ success: false, message: 'user not found' });
      if (!['approved', 'ghost'].includes(String(raw.status || ''))) {
        return res.status(403).json({ success: false, message: '当前状态无法在繁华街道闲逛' });
      }
      if (String(raw.currentLocation || '') !== 'rich_area') {
        return res.status(403).json({ success: false, message: '请先抵达东市，再进入繁华街道' });
      }

      const me = resetRichStreetDailyIfNeeded(db, raw);
      const pick = pickRichStreetItem(db);
      const ts = nowIso();

      if (pick?.item) {
        const rawType = String(pick.item.itemType || '回复道具');
        const invType = rawType === '技能书道具' ? 'skill_book' : rawType;
        addItem(
          db,
          userId,
          String(pick.item.name || '神秘道具'),
          invType,
          1,
          String(pick.item.description || ''),
          Number(pick.item.effectValue || 0)
        );
        db.prepare(`
          UPDATE users
          SET richStreetStrollCount = COALESCE(richStreetStrollCount, 0) + 1,
              updatedAt = ?
          WHERE id = ?
        `).run(ts, userId);
        const fresh = getUser(db, userId) || me;
        const isHigh = pick.tier === 'high';
        return res.json({
          success: true,
          eventType: isHigh ? 'high_value_item' : 'item',
          item: {
            name: String(pick.item.name || ''),
            itemType: rawType,
            tier: String(pick.item.tier || '低阶'),
            price: Number(pick.item.price || 0)
          },
          daily: {
            date: String(fresh.richStreetDate || todayKey()),
            strollCount: Math.max(0, Number(fresh.richStreetStrollCount || 0))
          },
          message: isHigh
            ? `你在繁华街道捡到了高价值物品：${String(pick.item.name || '未知物品')}`
            : `你在繁华街道捡到了一件物资：${String(pick.item.name || '未知物资')}`
        });
      }

      db.prepare(`
        UPDATE users
        SET richStreetStrollCount = COALESCE(richStreetStrollCount, 0) + 1,
            updatedAt = ?
        WHERE id = ?
      `).run(ts, userId);
      const fresh = getUser(db, userId) || me;
      return res.json({
        success: true,
        eventType: 'safe',
        daily: {
          date: String(fresh.richStreetDate || todayKey()),
          strollCount: Math.max(0, Number(fresh.richStreetStrollCount || 0))
        },
        message: '你在繁华街道逛了一圈，暂时没有拾取到有价值的物品。'
      });
    } catch (e: any) {
      return res.status(500).json({ success: false, message: e?.message || 'rich street stroll failed' });
    }
  });

  // 伦敦塔：精神契合度匹配池状态
  r.get('/london/compat/pool/status', (req, res) => {
    try {
      const userId = Number(req.query.userId || 0);
      if (!userId) return res.status(400).json({ success: false, message: 'invalid userId' });
      const me = getUser(db, userId);
      if (!me) return res.status(404).json({ success: false, message: 'user not found' });

      const eligible = isLondonCompatEligibleUser(me);
      const optedIn = isLondonCompatOptedInUser(me);
      const prompted = Number(me.londonCompatPrompted || 0) === 1;
      const shouldPrompt = eligible && !prompted;
      const roleType = compatRoleType(me.role);
      const targetRoleType = roleType === 'sentinel' ? 'guide' : roleType === 'guide' ? 'sentinel' : '';
      const poolData = optedIn ? buildLondonCompatMatches(db, me) : { matches: [] as AnyRow[] };

      return res.json({
        success: true,
        eligible,
        optedIn,
        prompted,
        shouldPrompt,
        minAge: 19,
        roleType,
        targetRoleType,
        poolSize: Array.isArray((poolData as any).matches) ? Number((poolData as any).matches.length || 0) : 0,
        reason: eligible ? '' : '仅 19 岁以上且职业为哨兵/向导的玩家可加入匹配池'
      });
    } catch (e: any) {
      return res.status(500).json({ success: false, message: e?.message || 'load london compat pool status failed' });
    }
  });

  r.post('/london/compat/pool/decision', (req, res) => {
    try {
      const userId = Number(req.body?.userId || 0);
      const join = Boolean(req.body?.join);
      if (!userId) return res.status(400).json({ success: false, message: 'invalid userId' });
      const me = getUser(db, userId);
      if (!me) return res.status(404).json({ success: false, message: 'user not found' });

      const eligible = isLondonCompatEligibleUser(me);
      if (join && !eligible) {
        return res.status(403).json({ success: false, message: '当前条件不满足：仅 19 岁以上哨兵/向导可加入匹配池' });
      }

      const nextOptIn = join && eligible ? 1 : 0;
      db.prepare(`
        UPDATE users
        SET londonCompatPrompted = 1,
            londonCompatOptIn = ?,
            updatedAt = ?
        WHERE id = ?
      `).run(nextOptIn, nowIso(), userId);

      const fresh = getUser(db, userId) || me;
      const poolData = nextOptIn === 1 ? buildLondonCompatMatches(db, fresh) : { matches: [] as AnyRow[] };
      return res.json({
        success: true,
        eligible: isLondonCompatEligibleUser(fresh),
        optedIn: Number(fresh.londonCompatOptIn || 0) === 1,
        poolSize: Array.isArray((poolData as any).matches) ? Number((poolData as any).matches.length || 0) : 0,
        message:
          nextOptIn === 1
            ? '你已加入伦敦塔精神契合度匹配池。'
            : '你已跳过匹配（我有伴侣）。后续可在伦敦塔评定中心重新加入。'
      });
    } catch (e: any) {
      return res.status(500).json({ success: false, message: e?.message || 'save london compat decision failed' });
    }
  });

  r.get('/london/compat/matches', (req, res) => {
    try {
      const userId = Number(req.query.userId || 0);
      if (!userId) return res.status(400).json({ success: false, message: 'invalid userId' });
      const me = getUser(db, userId);
      if (!me) return res.status(404).json({ success: false, message: 'user not found' });

      const eligible = isLondonCompatEligibleUser(me);
      const optedIn = isLondonCompatOptedInUser(me);
      const roleType = compatRoleType(me.role);
      const targetRoleType = roleType === 'sentinel' ? 'guide' : roleType === 'guide' ? 'sentinel' : '';
      if (!eligible) {
        return res.json({
          success: true,
          eligible: false,
          optedIn: false,
          roleType,
          targetRoleType,
          matches: [] as AnyRow[],
          message: '仅 19 岁以上且职业为哨兵/向导的玩家可进行精神契合度匹配'
        });
      }
      if (!optedIn) {
        return res.json({
          success: true,
          eligible: true,
          optedIn: false,
          roleType,
          targetRoleType,
          matches: [] as AnyRow[],
          message: '你尚未加入匹配池'
        });
      }

      const { matches } = buildLondonCompatMatches(db, me);
      return res.json({
        success: true,
        eligible: true,
        optedIn: true,
        roleType,
        targetRoleType,
        matches,
        message: `已匹配 ${matches.length} 名${targetRoleType === 'guide' ? '向导' : '哨兵'}候选`
      });
    } catch (e: any) {
      return res.status(500).json({ success: false, message: e?.message || 'load london compat matches failed', matches: [] });
    }
  });

  // 恶魔会状态：赌博/借贷/抵押/每日掉落
  r.get('/demon/state', (req, res) => {
    try {
      const userId = Number(req.query.userId || 0);
      if (!userId) return res.status(400).json({ success: false, message: 'invalid userId' });
      const meRaw = getUser(db, userId);
      if (!meRaw) return res.status(404).json({ success: false, message: 'user not found' });
      const me = resetDemonSkillDailyIfNeeded(db, meRaw);
      const loan = getOpenDemonLoan(db, userId);

      const invRows = db.prepare(`
        SELECT id, name, description, qty, itemType, effectValue
        FROM inventory
        WHERE userId = ?
        ORDER BY id DESC
        LIMIT 200
      `).all(userId) as AnyRow[];

      const inventory = invRows.map((x) => {
        const unitPrice = estimateInventoryUnitPrice(db, x);
        return {
          id: Number(x.id || 0),
          name: String(x.name || ''),
          description: String(x.description || ''),
          qty: Math.max(1, Number(x.qty || 1)),
          itemType: String(x.itemType || ''),
          effectValue: Number(x.effectValue || 0),
          estimateUnitPrice: unitPrice,
          pledgeValuePerUnit: Math.max(1, Math.floor(unitPrice * 0.8))
        };
      });

      const nearby = db.prepare(`
        SELECT id, name, role, job, gold
        FROM users
        WHERE currentLocation = ?
          AND id <> ?
          AND status IN ('approved', 'ghost')
        ORDER BY id DESC
        LIMIT 80
      `).all(DEMON_LOCATION, userId) as AnyRow[];

      const incomingGambleRequests = db.prepare(`
        SELECT *
        FROM demon_gamble_requests
        WHERE targetId = ?
          AND status = 'pending'
        ORDER BY id DESC
        LIMIT 12
      `).all(userId) as AnyRow[];

      const outgoingGambleRequests = db.prepare(`
        SELECT *
        FROM demon_gamble_requests
        WHERE challengerId = ?
          AND status = 'pending'
        ORDER BY id DESC
        LIMIT 12
      `).all(userId) as AnyRow[];

      const recentGambleEvents = db.prepare(`
        SELECT *
        FROM demon_gamble_requests
        WHERE (challengerId = ? OR targetId = ?)
          AND status IN ('resolved', 'rejected', 'cancelled')
        ORDER BY id DESC
        LIMIT 20
      `).all(userId, userId) as AnyRow[];

      const used = Math.max(0, Number(me.demonSkillCount || 0));
      const left = Math.max(0, DEMON_DAILY_SKILL_MAX - used);
      return res.json({
        success: true,
        isDemonMember: isDemonMemberJob(me.job),
        locationId: String(me.currentLocation || ''),
        gold: Number(me.gold || 0),
        dailySkill: {
          max: DEMON_DAILY_SKILL_MAX,
          used,
          remaining: left,
          date: String(me.demonSkillDate || todayKey())
        },
        loan: loan
          ? {
              id: Number(loan.id || 0),
              principal: Number(loan.principal || 0),
              interestRate: Number(loan.interestRate || DEMON_LOAN_INTEREST_RATE),
              totalDue: Number(loan.totalDue || 0),
              repaidAmount: Number(loan.repaidAmount || 0),
              remaining: Number(loan.remaining || 0),
              createdAt: String(loan.createdAt || '')
            }
          : null,
        inventory,
        nearbyPlayers: nearby.map((x) => ({
          id: Number(x.id || 0),
          name: String(x.name || ''),
          role: String(x.role || ''),
          job: String(x.job || ''),
          gold: Number(x.gold || 0)
        })),
        incomingGambleRequests: incomingGambleRequests.map((x) => mapDemonGambleRequestRow(x, userId)),
        outgoingGambleRequests: outgoingGambleRequests.map((x) => mapDemonGambleRequestRow(x, userId)),
        recentGambleEvents: recentGambleEvents.map((x) => mapDemonGambleRequestRow(x, userId))
      });
    } catch (e: any) {
      return res.status(500).json({ success: false, message: e?.message || 'load demon state failed' });
    }
  });

  // 恶魔会：恶劣黑市 NPC（违禁品 5 倍售价）
  r.get('/demon/blackmarket/shop', (req, res) => {
    try {
      const userId = Number(req.query.userId || 0);
      if (!userId) return res.status(400).json({ success: false, message: 'invalid userId' });
      const me = getUser(db, userId);
      if (!me) return res.status(404).json({ success: false, message: 'user not found' });

      const isDemonMember = isDemonMemberJob(me.job);
      const offers = buildDemonContrabandOffers(db, isDemonMember);
      const canTrade =
        ['approved', 'ghost'].includes(String(me.status || '')) &&
        String(me.currentLocation || '') === DEMON_LOCATION;

      return res.json({
        success: true,
        npc: {
          id: 'demon_blackmarket_vick',
          name: '“烂牙”维克',
          title: '恶魔会黑市贩子',
          persona: '脾气恶劣，嘴里没一句好话，只认金币。'
        },
        isDemonMember,
        canTrade,
        locationId: String(me.currentLocation || ''),
        offers
      });
    } catch (e: any) {
      return res.status(500).json({ success: false, message: e?.message || 'load demon blackmarket failed', offers: [] });
    }
  });

  r.post('/demon/blackmarket/buy', (req, res) => {
    try {
      const userId = Number(req.body?.userId || 0);
      const itemId = Number(req.body?.itemId || 0);
      const qty = clamp(Math.trunc(Number(req.body?.qty || 1)), 1, 99);
      if (!userId || !itemId) return res.status(400).json({ success: false, message: 'invalid params' });

      const me = getUser(db, userId);
      if (!me) return res.status(404).json({ success: false, message: 'user not found' });
      if (!['approved', 'ghost'].includes(String(me.status || ''))) {
        return res.status(403).json({ success: false, message: '当前状态无法购买黑市物品' });
      }
      if (String(me.currentLocation || '') !== DEMON_LOCATION) {
        return res.status(403).json({ success: false, message: '请在恶魔会黑市当面交易' });
      }

      const item = db.prepare(`
        SELECT id, name, description, itemType, effectValue, tier, price, locationTag
        FROM items
        WHERE id = ?
          AND itemType = '违禁品'
          AND (
            locationTag = ?
            OR locationTag = 'all'
            OR locationTag = ''
            OR locationTag LIKE '%demon%'
          )
        LIMIT 1
      `).get(itemId, DEMON_LOCATION) as AnyRow | undefined;
      if (!item) return res.status(404).json({ success: false, message: '该违禁品不存在或已下架' });

      const isDemonMember = isDemonMemberJob(me.job);
      if (!isDemonMember && String(item.tier || '低阶') !== '低阶') {
        return res.status(403).json({ success: false, message: '普通玩家只能购买低阶违禁品' });
      }

      const basePrice = Math.max(1, estimateItemBasePrice(item));
      const unitPrice = Math.max(1, Math.ceil(basePrice * 5));
      const totalCost = Math.max(1, unitPrice * qty);
      const currentGold = Math.max(0, Number(me.gold || 0));
      if (currentGold < totalCost) {
        return res.status(400).json({ success: false, message: `金币不足，需要 ${totalCost}G` });
      }

      const tx = db.transaction(() => {
        db.prepare(`UPDATE users SET gold = COALESCE(gold, 0) - ?, updatedAt = ? WHERE id = ?`).run(totalCost, nowIso(), userId);
        addItem(
          db,
          userId,
          String(item.name || '违禁品'),
          String(item.itemType || '违禁品'),
          qty,
          String(item.description || ''),
          Number(item.effectValue || 0)
        );
      });
      tx();

      const fresh = getUser(db, userId);
      return res.json({
        success: true,
        item: {
          id: Number(item.id || 0),
          name: String(item.name || ''),
          tier: String(item.tier || '低阶'),
          itemType: String(item.itemType || '违禁品')
        },
        qty,
        unitPrice,
        totalCost,
        gold: Number(fresh?.gold || 0),
        message: `“烂牙”维克冷笑着收走 ${totalCost}G，把 ${String(item.name || '违禁品')} x${qty} 丢给了你。`
      });
    } catch (e: any) {
      return res.status(500).json({ success: false, message: e?.message || 'buy demon blackmarket item failed' });
    }
  });

  // 恶魔会：单人比大小
  r.post('/demon/gamble/solo', (req, res) => {
    try {
      const userId = Number(req.body?.userId || 0);
      const amount = Math.max(1, Math.trunc(Number(req.body?.amount || 0)));
      const guess = String(req.body?.guess || '').trim().toLowerCase(); // big | small
      if (!userId || !amount) return res.status(400).json({ success: false, message: 'invalid params' });
      if (!['big', 'small'].includes(guess)) return res.status(400).json({ success: false, message: 'guess must be big/small' });

      const me = getUser(db, userId);
      if (!me) return res.status(404).json({ success: false, message: 'user not found' });
      if (!['approved', 'ghost'].includes(String(me.status || ''))) {
        return res.status(403).json({ success: false, message: '当前状态无法参与赌博' });
      }
      if (String(me.currentLocation || '') !== DEMON_LOCATION) {
        return res.status(403).json({ success: false, message: '请在恶魔会赌场进行赌博' });
      }
      if (Number(me.gold || 0) < amount) return res.status(400).json({ success: false, message: '金币不足，无法下注' });

      const roll = Math.floor(Math.random() * 6) + 1;
      const isWin = guess === 'big' ? roll >= 4 : roll <= 3;
      const delta = isWin ? amount : -amount;

      db.prepare(`UPDATE users SET gold = COALESCE(gold, 0) + ?, updatedAt = ? WHERE id = ?`).run(delta, nowIso(), userId);
      const fresh = getUser(db, userId);
      return res.json({
        success: true,
        isWin,
        roll,
        guess,
        delta,
        gold: Number(fresh?.gold || 0),
        message: isWin ? `骰子点数 ${roll}，你赢了 ${amount}G` : `骰子点数 ${roll}，你输了 ${amount}G`
      });
    } catch (e: any) {
      return res.status(500).json({ success: false, message: e?.message || 'demon solo gamble failed' });
    }
  });

  // ??????????
  r.post('/demon/gamble/pvp', (req, res) => {
    try {
      const challengerId = Number(req.body?.challengerId || 0);
      const targetId = Number(req.body?.targetId || 0);
      const amount = Math.max(1, Math.trunc(Number(req.body?.amount || 0)));
      if (!challengerId || !targetId || !amount) return res.status(400).json({ success: false, message: 'invalid params' });
      if (challengerId === targetId) return res.status(400).json({ success: false, message: 'You cannot bet against yourself' });

      const challenger = getUser(db, challengerId);
      const target = getUser(db, targetId);
      if (!challenger || !target) return res.status(404).json({ success: false, message: 'player not found' });

      const bothInDemon = String(challenger.currentLocation || '') === DEMON_LOCATION && String(target.currentLocation || '') === DEMON_LOCATION;
      if (!bothInDemon) return res.status(403).json({ success: false, message: 'Both players must be in the demon casino' });
      if (!['approved', 'ghost'].includes(String(challenger.status || '')) || !['approved', 'ghost'].includes(String(target.status || ''))) {
        return res.status(403).json({ success: false, message: 'Current status does not allow betting' });
      }
      if (Number(challenger.gold || 0) < amount || Number(target.gold || 0) < amount) {
        return res.status(400).json({ success: false, message: 'One side does not have enough gold' });
      }

      const existing = db.prepare(`
        SELECT *
        FROM demon_gamble_requests
        WHERE status = 'pending'
          AND (
            challengerId IN (?, ?)
            OR targetId IN (?, ?)
          )
        ORDER BY id DESC
        LIMIT 1
      `).get(challengerId, targetId, challengerId, targetId) as AnyRow | undefined;
      if (existing) {
        return res.status(400).json({ success: false, message: 'You or the other player already has a pending request' });
      }

      const stamp = nowIso();
      const result = db.prepare(`
        INSERT INTO demon_gamble_requests(
          challengerId, challengerName, targetId, targetName, amount, status, createdAt, updatedAt
        )
        VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)
      `).run(
        challengerId,
        String(challenger.name || ''),
        targetId,
        String(target.name || ''),
        amount,
        stamp,
        stamp
      );

      const requestId = Number(result.lastInsertRowid || 0);
      const row = db.prepare(`SELECT * FROM demon_gamble_requests WHERE id = ? LIMIT 1`).get(requestId) as AnyRow | undefined;
      return res.json({
        success: true,
        request: mapDemonGambleRequestRow(row, challengerId),
        message: `You sent a ${amount}G bet request to ${String(target.name || 'the other player')}`
      });
    } catch (e: any) {
      return res.status(500).json({ success: false, message: e?.message || 'demon pvp gamble request failed' });
    }
  });

  // ??????????
  r.post('/demon/gamble/request/:requestId/respond', (req, res) => {
    try {
      const requestId = Number(req.params.requestId || 0);
      const userId = Number(req.body?.userId || 0);
      const accept = Boolean(req.body?.accept);
      if (!requestId || !userId) return res.status(400).json({ success: false, message: 'invalid params' });

      const row = db.prepare(`SELECT * FROM demon_gamble_requests WHERE id = ? LIMIT 1`).get(requestId) as AnyRow | undefined;
      if (!row) return res.status(404).json({ success: false, message: 'request not found' });
      if (Number(row.targetId || 0) !== userId) return res.status(403).json({ success: false, message: 'Only the invited player can respond to this request' });
      if (String(row.status || '') !== 'pending') {
        return res.status(400).json({
          success: false,
          message: 'This request was already handled',
          request: mapDemonGambleRequestRow(row, userId)
        });
      }

      if (!accept) {
        const stamp = nowIso();
        db.prepare(`
          UPDATE demon_gamble_requests
          SET status = 'rejected',
              responderId = ?,
              updatedAt = ?
          WHERE id = ?
        `).run(userId, stamp, requestId);
        const fresh = db.prepare(`SELECT * FROM demon_gamble_requests WHERE id = ? LIMIT 1`).get(requestId) as AnyRow | undefined;
        return res.json({
          success: true,
          request: mapDemonGambleRequestRow(fresh, userId),
          message: `You rejected the bet request from ${String(row.challengerName || 'the challenger')}`
        });
      }

      const settled = settleDemonGambleRequest(db, requestId);
      if (!settled.ok) {
        return res.status(400).json({
          success: false,
          message: settled.message || 'Bet resolution failed',
          request: settled.request || null
        });
      }

      return res.json({
        success: true,
        request: settled.request,
        message: settled.message
      });
    } catch (e: any) {
      return res.status(500).json({ success: false, message: e?.message || 'respond demon gamble request failed' });
    }
  });
  // 恶魔会：借款（固定利率 10%）
  r.post('/demon/loan/borrow', (req, res) => {
    try {
      const userId = Number(req.body?.userId || 0);
      const amount = clamp(Math.trunc(Number(req.body?.amount || 0)), 1, 999999999);
      if (!userId || !amount) return res.status(400).json({ success: false, message: 'invalid params' });
      const me = getUser(db, userId);
      if (!me) return res.status(404).json({ success: false, message: 'user not found' });
      if (!['approved', 'ghost'].includes(String(me.status || ''))) {
        return res.status(403).json({ success: false, message: '当前状态无法借款' });
      }
      if (String(me.currentLocation || '') !== DEMON_LOCATION) {
        return res.status(403).json({ success: false, message: '请在恶魔会借款窗口办理' });
      }
      const open = getOpenDemonLoan(db, userId);
      if (open && Number(open.remaining || 0) > 0) {
        return res.status(409).json({ success: false, message: `你还有未还债务 ${open.remaining}G` });
      }

      const totalDue = Math.max(amount, Math.ceil(amount * (1 + DEMON_LOAN_INTEREST_RATE)));
      const tx = db.transaction(() => {
        db.prepare(`
          INSERT INTO demon_loans(userId, principal, interestRate, totalDue, repaidAmount, status, createdAt, updatedAt)
          VALUES (?, ?, ?, ?, 0, 'open', ?, ?)
        `).run(userId, amount, DEMON_LOAN_INTEREST_RATE, totalDue, nowIso(), nowIso());
        db.prepare(`UPDATE users SET gold = COALESCE(gold, 0) + ?, updatedAt = ? WHERE id = ?`).run(amount, nowIso(), userId);
      });
      tx();

      const fresh = getUser(db, userId);
      return res.json({
        success: true,
        principal: amount,
        totalDue,
        interestRate: DEMON_LOAN_INTEREST_RATE,
        gold: Number(fresh?.gold || 0),
        message: `借款成功：到账 ${amount}G，应还 ${totalDue}G（利息 10%）`
      });
    } catch (e: any) {
      return res.status(500).json({ success: false, message: e?.message || 'demon borrow failed' });
    }
  });

  // 恶魔会：现金还款
  r.post('/demon/loan/repay', (req, res) => {
    try {
      const userId = Number(req.body?.userId || 0);
      const amountInput = Math.trunc(Number(req.body?.amount || 0));
      if (!userId) return res.status(400).json({ success: false, message: 'invalid userId' });
      const me = getUser(db, userId);
      if (!me) return res.status(404).json({ success: false, message: 'user not found' });
      const open = getOpenDemonLoan(db, userId);
      if (!open) return res.status(409).json({ success: false, message: '当前没有未结清的债务' });

      const remaining = Math.max(0, Number(open.remaining || 0));
      const gold = Math.max(0, Number(me.gold || 0));
      if (gold <= 0) return res.status(400).json({ success: false, message: '金币不足，无法还款' });

      const targetPay = amountInput > 0 ? amountInput : remaining;
      const pay = clamp(targetPay, 1, Math.min(gold, remaining));
      const nextRepaid = Math.max(0, Number(open.repaidAmount || 0)) + pay;
      const shouldClose = nextRepaid >= Number(open.totalDue || 0);

      const tx = db.transaction(() => {
        db.prepare(`UPDATE users SET gold = COALESCE(gold, 0) - ?, updatedAt = ? WHERE id = ?`).run(pay, nowIso(), userId);
        db.prepare(`
          UPDATE demon_loans
          SET repaidAmount = ?,
              status = ?,
              updatedAt = ?
          WHERE id = ?
        `).run(nextRepaid, shouldClose ? 'closed' : 'open', nowIso(), Number(open.id || 0));
      });
      tx();

      const afterLoan = getOpenDemonLoan(db, userId);
      const fresh = getUser(db, userId);
      const left = afterLoan ? Number(afterLoan.remaining || 0) : 0;
      return res.json({
        success: true,
        paid: pay,
        remaining: left,
        cleared: !afterLoan,
        gold: Number(fresh?.gold || 0),
        message: afterLoan ? `已还款 ${pay}G，剩余 ${left}G` : `已还清全部债务（本次还款 ${pay}G）`
      });
    } catch (e: any) {
      return res.status(500).json({ success: false, message: e?.message || 'demon repay failed' });
    }
  });

  // 恶魔会：抵押道具还债（按估值 80% 抵债）
  r.post('/demon/loan/pledge', (req, res) => {
    try {
      const userId = Number(req.body?.userId || 0);
      const inventoryId = Number(req.body?.inventoryId || 0);
      const qtyInput = Math.trunc(Number(req.body?.qty || 1));
      if (!userId || !inventoryId) return res.status(400).json({ success: false, message: 'invalid params' });

      const me = getUser(db, userId);
      if (!me) return res.status(404).json({ success: false, message: 'user not found' });
      const open = getOpenDemonLoan(db, userId);
      if (!open) return res.status(409).json({ success: false, message: '当前没有未结清的债务' });

      const inv = db.prepare(`
        SELECT id, userId, name, description, qty, itemType, effectValue
        FROM inventory
        WHERE id = ?
          AND userId = ?
        LIMIT 1
      `).get(inventoryId, userId) as AnyRow | undefined;
      if (!inv) return res.status(404).json({ success: false, message: '背包中不存在该道具' });
      const qty = clamp(qtyInput || 1, 1, Math.max(1, Number(inv.qty || 1)));
      const unitPrice = estimateInventoryUnitPrice(db, inv);
      const pledgeCredit = Math.max(1, Math.floor(unitPrice * 0.8 * qty));
      const repayUsed = Math.min(Math.max(0, Number(open.remaining || 0)), pledgeCredit);
      if (repayUsed <= 0) return res.status(400).json({ success: false, message: '该道具无法抵债' });

      const nextRepaid = Math.max(0, Number(open.repaidAmount || 0)) + repayUsed;
      const shouldClose = nextRepaid >= Number(open.totalDue || 0);
      const tx = db.transaction(() => {
        if (Number(inv.qty || 1) <= qty) {
          db.prepare(`DELETE FROM inventory WHERE id = ?`).run(inventoryId);
        } else {
          db.prepare(`UPDATE inventory SET qty = qty - ? WHERE id = ?`).run(qty, inventoryId);
        }
        db.prepare(`
          UPDATE demon_loans
          SET repaidAmount = ?,
              status = ?,
              updatedAt = ?
          WHERE id = ?
        `).run(nextRepaid, shouldClose ? 'closed' : 'open', nowIso(), Number(open.id || 0));
      });
      tx();

      const afterLoan = getOpenDemonLoan(db, userId);
      return res.json({
        success: true,
        pledgedItem: String(inv.name || ''),
        qty,
        estimateUnitPrice: unitPrice,
        pledgeCredit,
        repayUsed,
        remaining: afterLoan ? Number(afterLoan.remaining || 0) : 0,
        cleared: !afterLoan,
        message: afterLoan
          ? `已抵押 ${String(inv.name || '')} x${qty}，折算 ${repayUsed}G，剩余债务 ${Number(afterLoan.remaining || 0)}G`
          : `已抵押 ${String(inv.name || '')} x${qty}，债务全部结清`
      });
    } catch (e: any) {
      return res.status(500).json({ success: false, message: e?.message || 'demon pledge failed' });
    }
  });

  // 恶魔会成员专属：每日 3 次随机掉落
  r.post('/demon/skill/daily-random', (req, res) => {
    try {
      const userId = Number(req.body?.userId || 0);
      if (!userId) return res.status(400).json({ success: false, message: 'invalid userId' });
      const raw = getUser(db, userId);
      if (!raw) return res.status(404).json({ success: false, message: 'user not found' });
      if (!['approved', 'ghost'].includes(String(raw.status || ''))) {
        return res.status(403).json({ success: false, message: '当前状态无法使用该技能' });
      }
      if (!isDemonMemberJob(raw.job)) {
        return res.status(403).json({ success: false, message: '只有恶魔会成员可使用该技能' });
      }

      const me = resetDemonSkillDailyIfNeeded(db, raw);
      const used = Math.max(0, Number(me.demonSkillCount || 0));
      if (used >= DEMON_DAILY_SKILL_MAX) {
        return res.status(409).json({ success: false, message: '今日随机掉落次数已用尽' });
      }

      const contraband = db.prepare(`
        SELECT id, name, description, itemType, effectValue, tier
        FROM items
        WHERE itemType = '违禁品'
          AND (
            locationTag = ?
            OR locationTag = 'all'
            OR locationTag = ''
            OR locationTag LIKE '%demon%'
          )
        ORDER BY RANDOM()
        LIMIT 1
      `).get(DEMON_LOCATION) as AnyRow | undefined;

      const picked = db.prepare(`
        SELECT id, name, description, itemType, effectValue, tier
        FROM items
        WHERE (
          locationTag = ?
          OR locationTag = 'all'
          OR locationTag = ''
          OR locationTag LIKE '%demon%'
        )
        ORDER BY RANDOM()
        LIMIT 1
      `).get(DEMON_LOCATION) as AnyRow | undefined;

      const fallback = contraband || picked || (db.prepare(`
        SELECT id, name, description, itemType, effectValue, tier
        FROM items
        ORDER BY RANDOM()
        LIMIT 1
      `).get() as AnyRow | undefined);

      if (!fallback) {
        return res.status(500).json({ success: false, message: '道具池为空，无法掉落' });
      }

      const rawType = String(fallback.itemType || '回复道具');
      const invType = rawType === '技能书道具' ? 'skill_book' : rawType;
      addItem(
        db,
        userId,
        String(fallback.name || '神秘道具'),
        invType,
        1,
        String(fallback.description || ''),
        Number(fallback.effectValue || 0)
      );
      db.prepare(`UPDATE users SET demonSkillCount = COALESCE(demonSkillCount, 0) + 1, updatedAt = ? WHERE id = ?`).run(nowIso(), userId);
      const fresh = getUser(db, userId) || me;
      const usedAfter = Math.max(0, Number(fresh.demonSkillCount || 0));
      const remaining = Math.max(0, DEMON_DAILY_SKILL_MAX - usedAfter);

      return res.json({
        success: true,
        item: {
          id: Number(fallback.id || 0),
          name: String(fallback.name || ''),
          itemType: rawType,
          tier: String(fallback.tier || '低阶')
        },
        remaining,
        message: `黑箱掉落：${String(fallback.name || '神秘道具')}（今日剩余 ${remaining} 次）`
      });
    } catch (e: any) {
      return res.status(500).json({ success: false, message: e?.message || 'demon daily random failed' });
    }
  });

  r.post('/explore/item', (req, res) => {
    try {
      const userId = Number(req.body?.userId);
      if (!userId) return res.status(400).json({ success: false, message: 'invalid userId' });
      const user = getUser(db, userId);
      if (!user) return res.status(404).json({ success: false, message: 'user not found' });

      const locationTag = String(req.body?.locationId || user.currentLocation || '').trim();
      const isDemonMember = isDemonMemberJob(user.job);
      const candidates = db.prepare(`
        SELECT id, name, description, tier, itemType, effectValue, faction, locationTag
        FROM items
        WHERE (locationTag = '' OR ? = '' OR locationTag LIKE '%' || ? || '%')
        ORDER BY RANDOM()
        LIMIT 300
      `).all(locationTag, locationTag) as AnyRow[];

      let picked: AnyRow | undefined;
      if (candidates.length > 0) {
        const contrabandPool = candidates.filter((x) => {
          if (String(x.itemType || '') !== '违禁品') return false;
          if (isDemonMember) return true;
          return String(x.tier || '低阶') === '低阶';
        });
        const contrabandChance = isDemonMember ? DEMON_CONTRABAND_CHANCE : NON_DEMON_CONTRABAND_CHANCE;
        if (contrabandPool.length > 0 && Math.random() < contrabandChance) {
          picked = rand(contrabandPool) as AnyRow;
        } else {
          const commonCandidates = candidates.filter((x) => String(x.itemType || '') !== '违禁品');
          const fallbackLowContraband = candidates.filter((x) => String(x.itemType || '') === '违禁品' && String(x.tier || '低阶') === '低阶');
          const pool = commonCandidates.length > 0
            ? commonCandidates
            : (isDemonMember ? candidates : fallbackLowContraband);
          const roll = Math.random() * 100;
          const tierWanted = roll < 65 ? '低阶' : roll < 90 ? '中阶' : '高阶';
          if (pool.length > 0) {
            const tierRows = pool.filter((x) => String(x.tier || '') === tierWanted);
            picked = (tierRows.length > 0 ? rand(tierRows) : rand(pool)) as AnyRow;
          }
        }
      }

      if (!picked) {
        const fallback = ['应急绷带', '净化注射剂', '口粮包', '[技能书] 感知系低阶入门'];
        const name = rand(fallback);
        const itemType = name.includes('技能书') ? 'skill_book' : '回复道具';
        addItem(db, userId, name, itemType, 1, '', name.includes('应急') ? 30 : 20);
      return res.json({ success: true, message: `found ${name}`, item: { name, tier: '低阶', itemType } });
      }

      const rawType = String(picked.itemType || '回复道具');
      const invType = rawType === '技能书道具' ? 'skill_book' : rawType;
      addItem(
        db,
        userId,
        String(picked.name || ''),
        invType,
        1,
        String(picked.description || ''),
        Number(picked.effectValue || 0)
      );
      return res.json({
        success: true,
        message: `found ${String(picked.name || '')}`,
        item: {
          id: Number(picked.id || 0),
          name: String(picked.name || ''),
          tier: String(picked.tier || '低阶'),
          itemType: rawType,
          faction: String(picked.faction || '通用')
        }
      });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e?.message || 'explore item failed' });
    }
  });

  r.post('/explore/skill', (req, res) => {
    try {
      const userId = Number(req.body?.userId);
      if (!userId) return res.status(400).json({ success: false, message: 'invalid userId' });
      const row = db.prepare(`
        SELECT s.id, s.name, s.faction
        FROM skills s
        LEFT JOIN user_skills us ON us.skillId=s.id AND us.userId=?
        WHERE us.id IS NULL
        ORDER BY RANDOM()
        LIMIT 1
      `).get(userId) as AnyRow | undefined;
      if (!row) return res.json({ success: false, message: 'no new skill available' });
      const granted = grantSkillOrBook(db, userId, row, 1);
      res.json({ success: true, message: granted.message });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e?.message || 'explore skill failed' });
    }
  });

  r.post('/explore/combat', (req, res) => {
    try {
      const userId = Number(req.body?.userId);
      if (!userId) return res.status(400).json({ success: false, message: 'invalid userId' });
      const user = getUser(db, userId);
      if (!user) return res.status(404).json({ success: false, message: 'user not found' });

      if (isUndifferentiated(user)) {
        db.prepare(`UPDATE users SET hp = 0, updatedAt=? WHERE id=?`).run(nowIso(), userId);
        return res.json({
          success: true,
          isWin: false,
          forcedFatal: true,
          message: 'undifferentiated fatal encounter',
          hp: 0
        });
      }

      const power = (RANK_SCORE[String(user.mentalRank || '')] || 0) + (RANK_SCORE[String(user.physicalRank || '')] || 0) + Math.random() * 6;
      const enemy = 8 + Math.random() * 10;
      const isWin = power >= enemy;
      const hpDelta = isWin ? -clamp(Math.floor(Math.random() * 10), 0, 8) : -clamp(Math.floor(15 + Math.random() * 30), 15, 40);
      const nextHp = clamp(Number(user.hp || 100) + hpDelta, 0, Number(user.maxHp || 100));
      const furyGain = isSentinelRole(String(user.role || '')) ? 20 : 0;
      db.prepare(`
        UPDATE users
        SET hp=?, fury=MIN(100, COALESCE(fury,0) + ?), lastCombatAt=?, updatedAt=?
        WHERE id=?
      `).run(nextHp, furyGain, nowIso(), nowIso(), userId);
      res.json({ success: true, isWin, message: isWin ? 'combat victory' : 'combat failed', hp: nextHp });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e?.message || 'combat failed' });
    }
  });

  r.get('/explore/monsters', (_req, res) => {
    try {
      const rows = db.prepare(`
        SELECT id, name, description, minLevel, maxLevel, basePower, baseHp, dropItemName, dropChance, enabled
        FROM wild_monsters
        WHERE enabled = 1
        ORDER BY id DESC
      `).all() as AnyRow[];
      res.json({
        success: true,
        monsters: rows.map((x) => ({
          id: Number(x.id || 0),
          name: String(x.name || ''),
          description: String(x.description || ''),
          minLevel: Number(x.minLevel || 1),
          maxLevel: Number(x.maxLevel || 1),
          basePower: Number(x.basePower || 0),
          baseHp: Number(x.baseHp || 0),
          dropItemName: String(x.dropItemName || ''),
          dropChance: Number(x.dropChance || 0),
          enabled: Number(x.enabled || 0)
        }))
      });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e?.message || 'load monsters failed', monsters: [] });
    }
  });

  r.get('/explore/wild/logs/:userId', (req, res) => {
    try {
      const userId = Number(req.params.userId || 0);
      const limit = clamp(Number(req.query.limit || 20), 1, 100);
      if (!userId) return res.status(400).json({ success: false, message: 'invalid userId', logs: [] });

      const rows = db.prepare(`
        SELECT id, userId, eventType, monsterId, monsterName, monsterLevel, isWin, resultText,
               hpDelta, mentalDelta, physicalDelta, droppedItem, returnedTo, createdAt
        FROM wild_battle_logs
        WHERE userId = ?
        ORDER BY id DESC
        LIMIT ?
      `).all(userId, limit) as AnyRow[];

      return res.json({
        success: true,
        logs: rows.map((x) => ({
          id: Number(x.id || 0),
          eventType: String(x.eventType || 'monster'),
          monsterId: Number(x.monsterId || 0),
          monsterName: String(x.monsterName || ''),
          monsterLevel: Number(x.monsterLevel || 0),
          isWin: Number(x.isWin || 0) > 0,
          resultText: String(x.resultText || ''),
          hpDelta: Number(x.hpDelta || 0),
          mentalDelta: Number(x.mentalDelta || 0),
          physicalDelta: Number(x.physicalDelta || 0),
          droppedItem: String(x.droppedItem || ''),
          returnedTo: String(x.returnedTo || ''),
          createdAt: String(x.createdAt || '')
        }))
      });
    } catch (e: any) {
      return res.status(500).json({ success: false, message: e?.message || 'query wild logs failed', logs: [] });
    }
  });

  r.post('/explore/wild/roll', (req, res) => {
    try {
      const userId = Number(req.body?.userId || 0);
      if (!userId) return res.status(400).json({ success: false, message: 'invalid userId' });
      const user = getUser(db, userId);
      if (!user) return res.status(404).json({ success: false, message: 'user not found' });

      const nowMs = Date.now();
      const lastRollAt = Date.parse(String(user.lastWildRollAt || ''));
      if (Number.isFinite(lastRollAt)) {
        const elapsedMs = nowMs - lastRollAt;
        if (elapsedMs < WILD_ROLL_COOLDOWN_SECONDS * 1000) {
          const remain = Math.max(1, Math.ceil((WILD_ROLL_COOLDOWN_SECONDS * 1000 - elapsedMs) / 1000));
          return res.status(429).json({
            success: false,
            code: 'WILD_ROLL_COOLDOWN',
            message: `探索过于频繁，请 ${remain} 秒后再试`,
            remainingSeconds: remain
          });
        }
      }

      const currentMp = Math.max(0, Number(user.mp || 0));
      if (currentMp < WILD_ROLL_MP_COST) {
        return res.status(409).json({
          success: false,
          code: 'WILD_ROLL_MP_LACK',
          message: `MP 不足：每次刷新遭遇需要 ${WILD_ROLL_MP_COST} MP`
        });
      }

      const nextMp = Math.max(0, currentMp - WILD_ROLL_MP_COST);
      db.prepare(`
        UPDATE users
        SET mp = ?, lastWildRollAt = ?, updatedAt = ?
        WHERE id = ?
      `).run(nextMp, nowIso(), nowIso(), userId);

      const encounter = buildWildEncounter(db, user);
      if (encounter.eventType === 'item') {
        db.prepare(`DELETE FROM wild_encounters WHERE userId = ?`).run(userId);
        const drop = pickRandomDropByTier(db, 5, isDemonMemberJob(user.job));
        if (drop) {
          const rawType = String(drop.itemType || '回复道具');
          const invType = rawType === '技能书道具' ? 'skill_book' : rawType;
          addItem(
            db,
            userId,
            String(drop.name || '神秘道具'),
            invType,
            1,
            String(drop.description || ''),
            Number(drop.effectValue || 0)
          );
          writeWildBattleLog(db, {
            userId,
            eventType: 'item',
            isWin: true,
            resultText: `界外拾取：${String(drop.name || '神秘道具')}`,
            droppedItem: String(drop.name || ''),
            hpDelta: 0,
            mentalDelta: 0,
            physicalDelta: 0
          });
          return res.json({
            success: true,
            eventType: 'item',
            message: `你在界外区域拾取了 ${String(drop.name || '神秘道具')}`,
            mp: nextMp,
            item: {
              id: Number(drop.id || 0),
              name: String(drop.name || ''),
              tier: String(drop.tier || '低阶'),
              itemType: rawType
            }
          });
        }
        addItem(db, userId, 'Monster Core', '贵重物品', 1, '可出售的怪物素材', 120);
        writeWildBattleLog(db, {
          userId,
          eventType: 'item',
          isWin: true,
          resultText: '界外拾取：Monster Core',
          droppedItem: 'Monster Core',
          hpDelta: 0,
          mentalDelta: 0,
          physicalDelta: 0
        });
        return res.json({
          success: true,
          eventType: 'item',
          message: '你在界外区域拾取了 Monster Core',
          mp: nextMp,
          item: { name: 'Monster Core', tier: '低阶', itemType: '贵重物品' }
        });
      }

      db.prepare(`
        INSERT INTO wild_encounters(userId, eventType, monsterId, monsterLevel, expiresAt, createdAt)
        VALUES(?,?,?,?,?,?)
        ON CONFLICT(userId) DO UPDATE SET
          eventType = excluded.eventType,
          monsterId = excluded.monsterId,
          monsterLevel = excluded.monsterLevel,
          expiresAt = excluded.expiresAt,
          createdAt = excluded.createdAt
      `).run(
        userId,
        'monster',
        Number(encounter.monster.id || 0),
        Number(encounter.monster.level || 1),
        afterMinutesIso(10),
        nowIso()
      );

      return res.json({
        success: true,
        eventType: 'monster',
        message: `遭遇魔物：${encounter.monster.name} Lv.${encounter.monster.level}`,
        mp: nextMp,
        monster: encounter.monster
      });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e?.message || 'wild roll failed' });
    }
  });

  r.post('/explore/wild/fight', (req, res) => {
    try {
      const userId = Number(req.body?.userId || 0);
      const requestedLevel = Number(req.body?.level || 0);
      if (!userId) return res.status(400).json({ success: false, message: 'invalid userId' });

      const user = getUser(db, userId);
      if (!user) return res.status(404).json({ success: false, message: 'user not found' });

      const pending = db.prepare(`
        SELECT id, monsterId, monsterLevel, expiresAt
        FROM wild_encounters
        WHERE userId = ?
          AND eventType = 'monster'
          AND datetime(COALESCE(expiresAt, '1970-01-01')) > datetime('now')
        LIMIT 1
      `).get(userId) as AnyRow | undefined;
      if (!pending) {
        return res.status(409).json({ success: false, message: '没有可结算的怪物遭遇，请先刷新遭遇' });
      }
      const monsterId = Number(pending.monsterId || 0);
      if (!monsterId) {
        db.prepare(`DELETE FROM wild_encounters WHERE userId = ?`).run(userId);
        return res.status(409).json({ success: false, message: '遭遇数据异常，请重新刷新遭遇' });
      }

      if (isUndifferentiated(user)) {
        db.prepare(`UPDATE users SET hp = 0, updatedAt=? WHERE id=?`).run(nowIso(), userId);
        db.prepare(`DELETE FROM wild_encounters WHERE userId = ?`).run(userId);
        writeWildBattleLog(db, {
          userId,
          eventType: 'monster',
          monsterId,
          monsterName: '未知魔物',
          monsterLevel: 0,
          isWin: false,
          resultText: '未分化者在界外区域遭遇致命失败',
          hpDelta: -Number(user.hp || 0),
          mentalDelta: 0,
          physicalDelta: 0,
          returnedTo: String(user.homeLocation || 'tower_of_life')
        });
        return res.json({
          success: true,
          isWin: false,
          forcedFatal: true,
          message: '未分化者在界外区域遭遇致命失败',
          hp: 0
        });
      }

      const monster = db.prepare(`
        SELECT id, name, minLevel, maxLevel, basePower, baseHp, dropItemName, dropChance
        FROM wild_monsters
        WHERE id = ?
          AND enabled = 1
        LIMIT 1
      `).get(monsterId) as AnyRow | undefined;
      if (!monster) {
        db.prepare(`DELETE FROM wild_encounters WHERE userId = ?`).run(userId);
        return res.status(409).json({ success: false, message: '该怪物已不可用，请重新刷新遭遇' });
      }

      const minLevel = Math.max(1, Number(monster.minLevel || 1));
      const maxLevel = Math.max(minLevel, Number(monster.maxLevel || minLevel));
      const pendingLevel = Number(pending.monsterLevel || 0);
      const level = clamp(Math.floor(pendingLevel || requestedLevel || minLevel), minLevel, maxLevel);
      const monsterPower = Number(monster.basePower || 10) + level * 1.7 + Math.random() * 4.5;

      const mentalProgress = Number(user.mentalProgress || 0);
      const physicalProgress = Number(user.physicalProgress || 0);
      const userPower = getRankPower(user) + mentalProgress * 0.05 + physicalProgress * 0.05 + Math.random() * 6;
      const isWin = userPower >= monsterPower;

      const maxHp = Math.max(1, Number(user.maxHp || 100));
      const currentHp = clamp(Number(user.hp || maxHp), 0, maxHp);
      let nextHp = currentHp;
      let nextMentalProgress = mentalProgress;
      let nextPhysicalProgress = physicalProgress;
      let dropName = '';

      if (isWin) {
        nextMentalProgress = clamp(mentalProgress + WILD_WIN_STAT_GAIN, 0, 9999);
        nextPhysicalProgress = clamp(physicalProgress + WILD_WIN_STAT_GAIN, 0, 9999);
        const dropChance = clamp(Number(monster.dropChance || 0.7), 0.05, 1);
        if (Math.random() <= dropChance) {
          dropName = String(monster.dropItemName || '').trim() || 'Monster Core';
          addItem(db, userId, dropName, '贵重物品', 1, '来自界外魔物的掉落素材', 180);
        } else {
          const randomDrop = pickRandomDropByTier(db, level, isDemonMemberJob(user.job));
          if (randomDrop) {
            const rawType = String(randomDrop.itemType || '回复道具');
            const invType = rawType === '技能书道具' ? 'skill_book' : rawType;
            dropName = String(randomDrop.name || '神秘道具');
            addItem(
              db,
              userId,
              dropName,
              invType,
              1,
              String(randomDrop.description || ''),
              Number(randomDrop.effectValue || 0)
            );
          } else {
            dropName = 'Monster Core';
            addItem(db, userId, dropName, '贵重物品', 1, '来自界外魔物的掉落素材', 120);
          }
        }

        db.prepare(`
          UPDATE users
          SET mentalProgress = ?,
              physicalProgress = ?,
              updatedAt = ?
          WHERE id = ?
        `).run(nextMentalProgress, nextPhysicalProgress, nowIso(), userId);
        db.prepare(`DELETE FROM wild_encounters WHERE userId = ?`).run(userId);
        writeWildBattleLog(db, {
          userId,
          eventType: 'monster',
          monsterId: Number(monster.id || 0),
          monsterName: String(monster.name || ''),
          monsterLevel: level,
          isWin: true,
          resultText: `击败 ${String(monster.name || '未知魔物')}`,
          hpDelta: 0,
          mentalDelta: WILD_WIN_STAT_GAIN,
          physicalDelta: WILD_WIN_STAT_GAIN,
          droppedItem: dropName || ''
        });

        const debuff = applyWildDebuff(db, userId);
        const refreshed = getUser(db, userId) || user;
        const winText = `击败 ${String(monster.name || '未知魔物')}，精神力与肉体强度各提升 ${WILD_WIN_STAT_GAIN}%`;
        const message = debuff?.message ? `${winText}；${debuff.message}` : winText;

        return res.json({
          success: true,
          isWin: true,
          monster: String(monster.name || '未知魔物'),
          level,
          message,
          mentalProgress: Number(refreshed.mentalProgress || nextMentalProgress),
          physicalProgress: Number(refreshed.physicalProgress || nextPhysicalProgress),
          hp: Number(refreshed.hp || nextHp),
          mp: Number(refreshed.mp || user.mp || 0),
          erosionLevel: Number(refreshed.erosionLevel || 0),
          bleedingLevel: Number(refreshed.bleedingLevel || 0),
          droppedItem: dropName || null,
          debuff
        });
      }

      const hpLoss = Math.max(1, Math.ceil(maxHp * WILD_LOSS_HP_PCT));
      nextHp = clamp(currentHp - hpLoss, 0, maxHp);
      nextMentalProgress = clamp(mentalProgress - WILD_LOSS_STAT_PENALTY, 0, 9999);
      nextPhysicalProgress = clamp(physicalProgress - WILD_LOSS_STAT_PENALTY, 0, 9999);
      const retreatLocation = String(user.homeLocation || 'tower_of_life') || 'tower_of_life';

      db.prepare(`
        UPDATE users
        SET hp = ?,
            mentalProgress = ?,
            physicalProgress = ?,
            updatedAt = ?
        WHERE id = ?
      `).run(nextHp, nextMentalProgress, nextPhysicalProgress, nowIso(), userId);
      db.prepare(`DELETE FROM wild_encounters WHERE userId = ?`).run(userId);
      writeWildBattleLog(db, {
        userId,
        eventType: 'monster',
        monsterId: Number(monster.id || 0),
        monsterName: String(monster.name || ''),
        monsterLevel: level,
        isWin: false,
        resultText: `败给 ${String(monster.name || '未知魔物')}`,
        hpDelta: -hpLoss,
        mentalDelta: -WILD_LOSS_STAT_PENALTY,
        physicalDelta: -WILD_LOSS_STAT_PENALTY
      });

      const debuff = applyWildDebuff(db, userId);
      const refreshed = getUser(db, userId) || user;
      const lossText = `战败：HP -10%，精神力 -${WILD_LOSS_STAT_PENALTY}%，肉体强度 -${WILD_LOSS_STAT_PENALTY}%。请选择“头铁再战”或“知难而退”`;
      const message = debuff?.message ? `${lossText}；${debuff.message}` : lossText;

      return res.json({
        success: true,
        isWin: false,
        monster: String(monster.name || '未知魔物'),
        level,
        message,
        hp: Number(refreshed.hp || nextHp),
        mp: Number(refreshed.mp || user.mp || 0),
        mentalProgress: Number(refreshed.mentalProgress || nextMentalProgress),
        physicalProgress: Number(refreshed.physicalProgress || nextPhysicalProgress),
        erosionLevel: Number(refreshed.erosionLevel || 0),
        bleedingLevel: Number(refreshed.bleedingLevel || 0),
        returnedToCity: false,
        needsRetreatChoice: true,
        returnLocation: retreatLocation,
        debuff
      });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e?.message || 'wild fight failed' });
    }
  });

  r.post('/explore/wild-encounter', (req, res) => {
    try {
      const userId = Number(req.body?.userId);
      if (!userId) return res.status(400).json({ success: false, message: 'invalid userId' });
      const user = getUser(db, userId);
      if (!user) return res.status(404).json({ success: false, message: 'user not found' });
      db.prepare(`DELETE FROM wild_encounters WHERE userId = ?`).run(userId);
      const encounter = buildWildEncounter(db, user);
      if (encounter.eventType === 'item') {
        const drop = pickRandomDropByTier(db, 5, isDemonMemberJob(user.job));
        if (drop) {
          const rawType = String(drop.itemType || '回复道具');
          const invType = rawType === '技能书道具' ? 'skill_book' : rawType;
          addItem(
            db,
            userId,
            String(drop.name || '神秘道具'),
            invType,
            1,
            String(drop.description || ''),
            Number(drop.effectValue || 0)
          );
          writeWildBattleLog(db, {
            userId,
            eventType: 'item',
            isWin: true,
            resultText: `界外拾取：${String(drop.name || '神秘道具')}`,
            droppedItem: String(drop.name || ''),
            hpDelta: 0,
            mentalDelta: 0,
            physicalDelta: 0
          });
          return res.json({
            success: true,
            eventType: 'item',
            message: `你在界外区域拾取了 ${String(drop.name || '神秘道具')}`
          });
        }
        addItem(db, userId, 'Monster Core', '贵重物品', 1, '可出售的怪物素材', 120);
        writeWildBattleLog(db, {
          userId,
          eventType: 'item',
          isWin: true,
          resultText: '界外拾取：Monster Core',
          droppedItem: 'Monster Core',
          hpDelta: 0,
          mentalDelta: 0,
          physicalDelta: 0
        });
        return res.json({ success: true, eventType: 'item', message: '你在界外区域拾取了 Monster Core' });
      }
      const monster = encounter.monster;
      if (!monster || !monster.id) {
        return res.status(500).json({ success: false, message: 'monster data invalid' });
      }
      if (isUndifferentiated(user)) {
        db.prepare(`UPDATE users SET hp = 0, updatedAt=? WHERE id=?`).run(nowIso(), userId);
        writeWildBattleLog(db, {
          userId,
          eventType: 'monster',
          monsterId: Number(monster.id || 0),
          monsterName: String(monster.name || ''),
          monsterLevel: Number(monster.level || 0),
          isWin: false,
          resultText: '未分化者在界外区域遭遇致命失败',
          hpDelta: -Number(user.hp || 0),
          mentalDelta: 0,
          physicalDelta: 0
        });
        return res.json({
          success: true,
          eventType: 'monster',
          isWin: false,
          forcedFatal: true,
          monster: encounter.monster.name,
          message: '未分化者在界外区域遭遇致命失败'
        });
      }
      const userPower =
        getRankPower(user) +
        Number(user.mentalProgress || 0) * 0.05 +
        Number(user.physicalProgress || 0) * 0.05 +
        Math.random() * 6;
      const isWin = userPower >= Number(monster.power || 0);

      if (isWin) {
        const nextMental = clamp(Number(user.mentalProgress || 0) + WILD_WIN_STAT_GAIN, 0, 9999);
        const nextPhysical = clamp(Number(user.physicalProgress || 0) + WILD_WIN_STAT_GAIN, 0, 9999);
        db.prepare(`
          UPDATE users
          SET mentalProgress = ?, physicalProgress = ?, updatedAt = ?
          WHERE id = ?
        `).run(nextMental, nextPhysical, nowIso(), userId);
        addItem(db, userId, 'Monster Core', '贵重物品', 1, '可出售的怪物素材', 180);
        writeWildBattleLog(db, {
          userId,
          eventType: 'monster',
          monsterId: Number(monster.id || 0),
          monsterName: String(monster.name || ''),
          monsterLevel: Number(monster.level || 0),
          isWin: true,
          resultText: `击败 ${monster.name}`,
          hpDelta: 0,
          mentalDelta: WILD_WIN_STAT_GAIN,
          physicalDelta: WILD_WIN_STAT_GAIN,
          droppedItem: 'Monster Core'
        });

        const debuff = applyWildDebuff(db, userId);
        const refreshed = getUser(db, userId) || user;
        const winText = `击败 ${monster.name}，精神力与肉体强度各提升 ${WILD_WIN_STAT_GAIN}%`;
        const message = debuff?.message ? `${winText}；${debuff.message}` : winText;
        return res.json({
          success: true,
          eventType: 'monster',
          isWin: true,
          monster: monster.name,
          message,
          droppedItem: 'Monster Core',
          hp: Number(refreshed.hp || user.hp || 0),
          mp: Number(refreshed.mp || user.mp || 0),
          mentalProgress: Number(refreshed.mentalProgress || nextMental),
          physicalProgress: Number(refreshed.physicalProgress || nextPhysical),
          erosionLevel: Number(refreshed.erosionLevel || 0),
          bleedingLevel: Number(refreshed.bleedingLevel || 0),
          debuff
        });
      }

      const maxHp = Math.max(1, Number(user.maxHp || 100));
      const hpLoss = Math.max(1, Math.ceil(maxHp * WILD_LOSS_HP_PCT));
      const nextHp = clamp(Number(user.hp || maxHp) - hpLoss, 0, maxHp);
      const nextMental = clamp(Number(user.mentalProgress || 0) - WILD_LOSS_STAT_PENALTY, 0, 9999);
      const nextPhysical = clamp(Number(user.physicalProgress || 0) - WILD_LOSS_STAT_PENALTY, 0, 9999);
      const retreatLocation = String(user.homeLocation || 'tower_of_life') || 'tower_of_life';
      db.prepare(`
        UPDATE users
        SET hp = ?,
            mentalProgress = ?,
            physicalProgress = ?,
            updatedAt = ?
        WHERE id = ?
      `).run(nextHp, nextMental, nextPhysical, nowIso(), userId);
      writeWildBattleLog(db, {
        userId,
        eventType: 'monster',
        monsterId: Number(monster.id || 0),
        monsterName: String(monster.name || ''),
        monsterLevel: Number(monster.level || 0),
        isWin: false,
        resultText: `败给 ${monster.name}`,
        hpDelta: -hpLoss,
        mentalDelta: -WILD_LOSS_STAT_PENALTY,
        physicalDelta: -WILD_LOSS_STAT_PENALTY
      });
      const debuff = applyWildDebuff(db, userId);
      const refreshed = getUser(db, userId) || user;
      const lossText = `战败：HP -10%，精神力 -${WILD_LOSS_STAT_PENALTY}%，肉体强度 -${WILD_LOSS_STAT_PENALTY}%。请选择“头铁再战”或“知难而退”`;
      const message = debuff?.message ? `${lossText}；${debuff.message}` : lossText;
      return res.json({
        success: true,
        eventType: 'monster',
        isWin: false,
        monster: monster.name,
        message,
        hp: Number(refreshed.hp || nextHp),
        mp: Number(refreshed.mp || user.mp || 0),
        mentalProgress: Number(refreshed.mentalProgress || nextMental),
        physicalProgress: Number(refreshed.physicalProgress || nextPhysical),
        erosionLevel: Number(refreshed.erosionLevel || 0),
        bleedingLevel: Number(refreshed.bleedingLevel || 0),
        returnedToCity: false,
        needsRetreatChoice: true,
        returnLocation: retreatLocation,
        debuff
      });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e?.message || 'wild encounter failed' });
    }
  });

  r.post('/explore/wild/retreat', (req, res) => {
    try {
      const userId = Number(req.body?.userId || 0);
      const preferred = String(req.body?.returnLocation || '').trim();
      if (!userId) return res.status(400).json({ success: false, message: 'invalid userId' });
      const user = getUser(db, userId);
      if (!user) return res.status(404).json({ success: false, message: 'user not found' });

      const returnLocation = preferred || String(user.homeLocation || 'tower_of_life') || 'tower_of_life';
      db.prepare(`
        UPDATE users
        SET currentLocation = ?, updatedAt = ?
        WHERE id = ?
      `).run(returnLocation, nowIso(), userId);
      db.prepare(`DELETE FROM wild_encounters WHERE userId = ?`).run(userId);

      return res.json({
        success: true,
        message: '你选择知难而退，已返回城中。',
        returnLocation
      });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e?.message || 'wild retreat failed' });
    }
  });

  r.get('/admin/monsters', auth.requireAdminAuth, (_req: any, res) => {
    try {
      const rows = db.prepare(`
        SELECT id, name, description, minLevel, maxLevel, basePower, baseHp, dropItemName, dropChance, enabled, createdAt
        FROM wild_monsters
        ORDER BY id DESC
      `).all() as AnyRow[];
      res.json({ success: true, monsters: rows });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e?.message || 'query monsters failed', monsters: [] });
    }
  });

  r.post('/admin/monsters', auth.requireAdminAuth, (req: any, res) => {
    try {
      const body = req.body || {};
      const name = String(body.name || '').trim();
      if (!name) return res.status(400).json({ success: false, message: 'name required' });

      const minLevel = clamp(Number(body.minLevel || 1), 1, 100);
      const maxLevel = clamp(Number(body.maxLevel || minLevel), minLevel, 200);
      const basePower = clamp(Number(body.basePower || 10), 1, 999);
      const baseHp = clamp(Number(body.baseHp || 100), 10, 99999);
      const dropChance = clamp(Number(body.dropChance || 0.7), 0.05, 1);
      const enabledRaw = body.enabled;
      const enabled = Number(
        enabledRaw === 0 ||
        enabledRaw === false ||
        String(enabledRaw || '').trim() === '0'
          ? 0
          : 1
      );
      const dropItemName = String(body.dropItemName || 'Monster Core').trim() || 'Monster Core';

      db.prepare(`
        INSERT INTO wild_monsters(name, description, minLevel, maxLevel, basePower, baseHp, dropItemName, dropChance, enabled, createdAt)
        VALUES(?,?,?,?,?,?,?,?,?,?)
      `).run(
        name,
        String(body.description || ''),
        minLevel,
        maxLevel,
        basePower,
        baseHp,
        dropItemName,
        dropChance,
        enabled,
        nowIso()
      );

      const adminName = String(req.admin?.name || 'admin');
      writeAdminLog(db, adminName, `编辑怪物 ${name}`, 'monster', name, {
        minLevel,
        maxLevel,
        basePower,
        baseHp
      });

      res.json({ success: true, message: `管理员 ${adminName} 编辑了怪物 ${name}` });
    } catch (e: any) {
      const msg = String(e?.message || '');
      if (/UNIQUE/i.test(msg)) return res.status(409).json({ success: false, message: '怪物名称已存在' });
      res.status(500).json({ success: false, message: e?.message || 'create monster failed' });
    }
  });

  r.put('/admin/monsters/:id', auth.requireAdminAuth, (req: any, res) => {
    try {
      const id = Number(req.params.id || 0);
      if (!id) return res.status(400).json({ success: false, message: 'invalid id' });

      const row = db.prepare(`
        SELECT id, name, description, minLevel, maxLevel, basePower, baseHp, dropItemName, dropChance, enabled
        FROM wild_monsters
        WHERE id = ?
        LIMIT 1
      `).get(id) as AnyRow | undefined;
      if (!row) return res.status(404).json({ success: false, message: 'monster not found' });

      const body = req.body || {};
      const nameRaw = Object.prototype.hasOwnProperty.call(body, 'name') ? String(body.name || '').trim() : String(row.name || '');
      if (!nameRaw) return res.status(400).json({ success: false, message: 'name required' });

      const minLevelRaw = Object.prototype.hasOwnProperty.call(body, 'minLevel') ? Number(body.minLevel) : Number(row.minLevel || 1);
      const minLevel = clamp(Number.isFinite(minLevelRaw) ? minLevelRaw : 1, 1, 100);
      const maxLevelRaw = Object.prototype.hasOwnProperty.call(body, 'maxLevel') ? Number(body.maxLevel) : Number(row.maxLevel || minLevel);
      const maxLevel = clamp(Number.isFinite(maxLevelRaw) ? maxLevelRaw : minLevel, minLevel, 200);
      const basePowerRaw = Object.prototype.hasOwnProperty.call(body, 'basePower') ? Number(body.basePower) : Number(row.basePower || 10);
      const basePower = clamp(Number.isFinite(basePowerRaw) ? basePowerRaw : 10, 1, 999);
      const baseHpRaw = Object.prototype.hasOwnProperty.call(body, 'baseHp') ? Number(body.baseHp) : Number(row.baseHp || 100);
      const baseHp = clamp(Number.isFinite(baseHpRaw) ? baseHpRaw : 100, 10, 99999);
      const dropChanceRaw = Object.prototype.hasOwnProperty.call(body, 'dropChance') ? Number(body.dropChance) : Number(row.dropChance || 0.7);
      const dropChance = clamp(Number.isFinite(dropChanceRaw) ? dropChanceRaw : 0.7, 0.05, 1);
      const enabledRaw = body.enabled;
      const enabled = Object.prototype.hasOwnProperty.call(body, 'enabled')
        ? Number(
            enabledRaw === 0 ||
            enabledRaw === false ||
            String(enabledRaw || '').trim() === '0'
              ? 0
              : 1
          )
        : Number(row.enabled || 0 ? 1 : 0);
      const dropItemName = Object.prototype.hasOwnProperty.call(body, 'dropItemName')
        ? String(body.dropItemName || '').trim() || 'Monster Core'
        : String(row.dropItemName || 'Monster Core');
      const description = Object.prototype.hasOwnProperty.call(body, 'description')
        ? String(body.description || '')
        : String(row.description || '');

      db.prepare(`
        UPDATE wild_monsters
        SET name = ?,
            description = ?,
            minLevel = ?,
            maxLevel = ?,
            basePower = ?,
            baseHp = ?,
            dropItemName = ?,
            dropChance = ?,
            enabled = ?
        WHERE id = ?
      `).run(nameRaw, description, minLevel, maxLevel, basePower, baseHp, dropItemName, dropChance, enabled, id);

      const adminName = String(req.admin?.name || 'admin');
      writeAdminLog(db, adminName, `更新怪物 ${nameRaw}`, 'monster', String(id), {
        minLevel,
        maxLevel,
        basePower,
        baseHp,
        enabled
      });

      return res.json({
        success: true,
        message: `管理员 ${adminName} 编辑了怪物 ${nameRaw}`,
        monster: { id, name: nameRaw, enabled }
      });
    } catch (e: any) {
      const msg = String(e?.message || '');
      if (/UNIQUE/i.test(msg)) return res.status(409).json({ success: false, message: '怪物名称已存在' });
      return res.status(500).json({ success: false, message: e?.message || 'update monster failed' });
    }
  });

  r.delete('/admin/monsters/:id', auth.requireAdminAuth, (req: any, res) => {
    try {
      const id = Number(req.params.id || 0);
      if (!id) return res.status(400).json({ success: false, message: 'invalid id' });

      const row = db.prepare(`SELECT id, name FROM wild_monsters WHERE id = ? LIMIT 1`).get(id) as AnyRow | undefined;
      if (!row) return res.status(404).json({ success: false, message: 'monster not found' });

      db.prepare(`DELETE FROM wild_monsters WHERE id = ?`).run(id);
      const adminName = String(req.admin?.name || 'admin');
      writeAdminLog(db, adminName, `删除怪物 ${String(row.name || id)}`, 'monster', String(id));
      res.json({ success: true, message: `管理员 ${adminName} 编辑了怪物库：删除 ${String(row.name || id)}` });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e?.message || 'delete monster failed' });
    }
  });

  r.post('/interact/combat', (req, res) => {
    try {
      const attackerId = Number(req.body?.attackerId);
      const defenderId = Number(req.body?.defenderId);
      if (!attackerId || !defenderId) return res.status(400).json({ success: false, message: 'invalid params' });
      const ret = resolveCombat(
        db,
        attackerId,
        defenderId,
        Number(req.body?.attackerScore),
        Number(req.body?.defenderScore)
      );
      if (!ret.success) return res.status(404).json(ret);
      res.json(ret);
    } catch (e: any) {
      res.status(500).json({ success: false, message: e?.message || 'interact combat failed' });
    }
  });

  r.post('/combat/end', (_req, res) => res.json({ success: true }));

  r.post('/interact/steal', (req, res) => {
    try {
      const thiefId = Number(req.body?.thiefId);
      const targetId = Number(req.body?.targetId);
      if (!thiefId || !targetId) return res.status(400).json({ success: false, message: 'invalid params' });
      const ret = resolveSteal(db, thiefId, targetId);
      if (!ret.success) return res.json(ret);
      res.json(ret);
    } catch (e: any) {
      res.status(500).json({ success: false, message: e?.message || 'steal failed' });
    }
  });

  r.post('/interact/prank', (req, res) => {
    try {
      const ghostId = Number(req.body?.ghostId);
      const targetId = Number(req.body?.targetId);
      if (!ghostId || !targetId) return res.status(400).json({ success: false, message: 'invalid params' });
      const ret = resolvePrank(db, ghostId, targetId);
      if (!ret.success) return res.status(400).json(ret);
      res.json(ret);
    } catch (e: any) {
      res.status(500).json({ success: false, message: e?.message || 'prank failed' });
    }
  });

  r.post('/interact/probe', (req, res) => {
    try {
      const actorId = Number(req.body?.actorId || 0);
      const targetId = Number(req.body?.targetId);
      if (!targetId || !actorId) return res.status(400).json({ success: false, message: 'invalid targetId/actorId' });
      const actor = getUser(db, actorId);
      const target = getUser(db, targetId);
      if (!actor) return res.status(404).json({ success: false, message: 'actor not found' });
      if (!target) return res.status(404).json({ success: false, message: 'target not found' });
      if (!isSentinelRole(String(actor.role || ''))) {
        return res.status(403).json({ success: false, message: '只有哨兵可以精神探查' });
      }
      const pool = [
        { key: 'hp', value: Number(target.hp || 0) },
        { key: 'mp', value: Number(target.mp || 0) },
        { key: 'fury', value: Number(target.fury || 0) },
        { key: 'guideStability', value: Number(target.guideStability || 100) },
        { key: 'faction', value: String(target.faction || 'none') },
      ];
      res.json({ success: true, probedStat: rand(pool) });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e?.message || 'probe failed' });
    }
  });

  r.post('/guide/soothe', (req, res) => {
    try {
      const sentinelId = Number(req.body?.sentinelId);
      const guideId = Number(req.body?.guideId);
      if (!sentinelId || !guideId) return res.status(400).json({ success: false, message: 'invalid params' });
      const ret = resolveSoothe(db, sentinelId, guideId);
      if (!ret.success) return res.status(400).json(ret);
      res.json(ret);
    } catch (e: any) {
      res.status(500).json({ success: false, message: e?.message || 'soothe failed' });
    }
  });

  r.post('/trade/request', (req, res) => {
    try {
      const fromUserId = Number(req.body?.fromUserId || 0);
      const toUserId = Number(req.body?.toUserId || 0);
      if (!fromUserId || !toUserId) return res.status(400).json({ success: false, message: 'invalid params' });
      if (fromUserId === toUserId) return res.status(400).json({ success: false, message: '不能和自己交易' });

      const fromUser = getUser(db, fromUserId);
      const toUser = getUser(db, toUserId);
      if (!fromUser || !toUser) return res.status(404).json({ success: false, message: 'user not found' });

      const pair = normalizeTradePair(fromUserId, toUserId);
      const activeSession = db.prepare(`
        SELECT *
        FROM interaction_trade_sessions
        WHERE userAId = ? AND userBId = ? AND status = 'pending'
        ORDER BY updatedAt DESC
        LIMIT 1
      `).get(pair.userAId, pair.userBId) as AnyRow | undefined;
      if (activeSession) {
        return res.json({
          success: true,
          created: false,
          sessionId: String(activeSession.id || ''),
          session: loadTradeSessionPayload(db, activeSession),
          message: '你们已经有进行中的交易会话'
        });
      }

      const existing = db.prepare(`
        SELECT *
        FROM interaction_trade_requests
        WHERE fromUserId = ? AND toUserId = ? AND status = 'pending'
        ORDER BY id DESC
        LIMIT 1
      `).get(fromUserId, toUserId) as AnyRow | undefined;
      if (existing) {
        return res.json({ success: true, created: false, requestId: Number(existing.id || 0), message: '交易请求已发出，等待对方回应' });
      }

      const ret = db.prepare(`
        INSERT INTO interaction_trade_requests(fromUserId, toUserId, status, sessionId, createdAt, updatedAt)
        VALUES(?,?,?,?,?,?)
      `).run(fromUserId, toUserId, 'pending', '', nowIso(), nowIso());
      const requestId = Number(ret.lastInsertRowid || 0);

      pushInteractionEvent(
        db,
        toUserId,
        fromUserId,
        toUserId,
        'trade_request',
        '交易请求',
        `${String(fromUser.name || `玩家#${fromUserId}`)} 希望与你交易`,
        { requestId, fromUserId, toUserId }
      );
      pushInteractionEvent(
        db,
        fromUserId,
        fromUserId,
        toUserId,
        'trade_request',
        '交易请求已发送',
        `已向 ${String(toUser.name || `玩家#${toUserId}`)} 发出交易请求`,
        { requestId, fromUserId, toUserId }
      );

      return res.json({ success: true, created: true, requestId, message: '已发出交易请求，等待对方确认' });
    } catch (e: any) {
      return res.status(500).json({ success: false, message: e?.message || 'create trade request failed' });
    }
  });

  r.get('/trade/request/pending/:userId', (req, res) => {
    try {
      const userId = Number(req.params.userId || 0);
      if (!userId) return res.status(400).json({ success: false, message: 'invalid userId', requests: [] });
      const rows = db.prepare(`
        SELECT r.id, r.fromUserId, r.toUserId, r.status, r.sessionId, r.createdAt, r.updatedAt, u.name AS fromUserName
        FROM interaction_trade_requests r
        JOIN users u ON u.id = r.fromUserId
        WHERE r.toUserId = ? AND r.status = 'pending'
        ORDER BY r.id ASC
      `).all(userId) as AnyRow[];
      return res.json({
        success: true,
        requests: rows.map((row) => ({
          id: Number(row.id || 0),
          fromUserId: Number(row.fromUserId || 0),
          toUserId: Number(row.toUserId || 0),
          fromUserName: String(row.fromUserName || ''),
          status: String(row.status || 'pending'),
          sessionId: String(row.sessionId || ''),
          createdAt: String(row.createdAt || ''),
          updatedAt: String(row.updatedAt || '')
        }))
      });
    } catch (e: any) {
      return res.status(500).json({ success: false, message: e?.message || 'query pending trade requests failed', requests: [] });
    }
  });

  r.post('/trade/request/:id/respond', (req, res) => {
    try {
      const requestId = Number(req.params.id || 0);
      const userId = Number(req.body?.userId || 0);
      const accept = req.body?.accept === false ? 0 : 1;
      if (!requestId || !userId) return res.status(400).json({ success: false, message: 'invalid params' });

      const request = db.prepare(`SELECT * FROM interaction_trade_requests WHERE id = ? LIMIT 1`).get(requestId) as AnyRow | undefined;
      if (!request) return res.status(404).json({ success: false, message: 'trade request not found' });
      if (Number(request.toUserId || 0) !== userId) return res.status(403).json({ success: false, message: 'forbidden' });
      if (String(request.status || '') !== 'pending') {
        return res.json({ success: true, status: String(request.status || ''), sessionId: String(request.sessionId || ''), message: '该交易请求已处理' });
      }

      const fromUserId = Number(request.fromUserId || 0);
      const fromUser = getUser(db, fromUserId);
      const toUser = getUser(db, userId);
      if (!fromUser || !toUser) return res.status(404).json({ success: false, message: 'user not found' });

      if (!accept) {
        db.prepare(`UPDATE interaction_trade_requests SET status = 'rejected', updatedAt = ? WHERE id = ?`).run(nowIso(), requestId);
        pushInteractionEvent(db, fromUserId, userId, fromUserId, 'trade_request', '交易请求被拒绝', `${String(toUser.name || `玩家#${userId}`)} 拒绝了你的交易请求`, { requestId });
        pushInteractionEvent(db, userId, fromUserId, userId, 'trade_request', '你已拒绝交易请求', `你拒绝了 ${String(fromUser.name || `玩家#${fromUserId}`)} 的交易请求`, { requestId });
        return res.json({ success: true, status: 'rejected', message: '已拒绝该交易请求' });
      }

      const pair = normalizeTradePair(fromUserId, userId);
      let sessionRow = db.prepare(`
        SELECT *
        FROM interaction_trade_sessions
        WHERE userAId = ? AND userBId = ? AND status = 'pending'
        ORDER BY updatedAt DESC
        LIMIT 1
      `).get(pair.userAId, pair.userBId) as AnyRow | undefined;
      if (!sessionRow) {
        const sessionId = `trade-${Date.now()}-${pair.userAId}-${pair.userBId}-${Math.floor(Math.random() * 10000)}`;
        const tx = db.transaction(() => {
          db.prepare(`
            INSERT INTO interaction_trade_sessions(id, userAId, userBId, status, confirmA, confirmB, cancelledBy, completedAt, createdAt, updatedAt)
            VALUES(?,?,?,?,?,?,?,?,?,?)
          `).run(sessionId, pair.userAId, pair.userBId, 'pending', 0, 0, 0, null, nowIso(), nowIso());
          db.prepare(`
            INSERT OR IGNORE INTO interaction_trade_offers(sessionId, userId, itemName, qty, gold, updatedAt)
            VALUES(?,?,?,?,?,?)
          `).run(sessionId, pair.userAId, '', 0, 0, nowIso());
          db.prepare(`
            INSERT OR IGNORE INTO interaction_trade_offers(sessionId, userId, itemName, qty, gold, updatedAt)
            VALUES(?,?,?,?,?,?)
          `).run(sessionId, pair.userBId, '', 0, 0, nowIso());
        });
        tx();
        sessionRow = db.prepare(`SELECT * FROM interaction_trade_sessions WHERE id = ? LIMIT 1`).get(sessionId) as AnyRow | undefined;
      }

      db.prepare(`UPDATE interaction_trade_requests SET status = 'accepted', sessionId = ?, updatedAt = ? WHERE id = ?`).run(String(sessionRow?.id || ''), nowIso(), requestId);
      const payload = loadTradeSessionPayload(db, sessionRow);
      void gameplayRuntime?.publishUsers([fromUserId, userId], 'trade.session.changed', { sessionId: String(sessionRow?.id || ''), status: 'pending', reason: 'accepted' });
      pushInteractionEvent(db, userId, fromUserId, userId, 'trade', '交易请求已接受', `你接受了 ${String(fromUser.name || `玩家#${fromUserId}`)} 的交易请求`, { requestId, sessionId: String(sessionRow?.id || '') });
      pushInteractionEvent(db, fromUserId, userId, fromUserId, 'trade', '交易请求已接受', `${String(toUser.name || `玩家#${userId}`)} 接受了你的交易请求`, { requestId, sessionId: String(sessionRow?.id || '') });
      return res.json({ success: true, status: 'accepted', sessionId: String(sessionRow?.id || ''), session: payload, message: '已接受该交易请求，交易窗口已打开' });
    } catch (e: any) {
      return res.status(500).json({ success: false, message: e?.message || 'respond trade request failed' });
    }
  });

  r.post('/trade/session/start', (req, res) => {
    try {
      const fromUserId = Number(req.body?.fromUserId || 0);
      const toUserId = Number(req.body?.toUserId || 0);
      if (!fromUserId || !toUserId) return res.status(400).json({ success: false, message: 'invalid params' });
      if (fromUserId === toUserId) return res.status(400).json({ success: false, message: '不能和自己交易' });
      const fromUser = getUser(db, fromUserId);
      const toUser = getUser(db, toUserId);
      if (!fromUser || !toUser) return res.status(404).json({ success: false, message: 'user not found' });

      const pair = normalizeTradePair(fromUserId, toUserId);
      const existing = db.prepare(`
        SELECT *
        FROM interaction_trade_sessions
        WHERE userAId = ? AND userBId = ? AND status = 'pending'
        ORDER BY updatedAt DESC
        LIMIT 1
      `).get(pair.userAId, pair.userBId) as AnyRow | undefined;
      if (existing) {
        const payload = loadTradeSessionPayload(db, existing);
        return res.json({ success: true, created: false, sessionId: String(existing.id || ''), session: payload });
      }

      const sessionId = `trade-${Date.now()}-${pair.userAId}-${pair.userBId}-${Math.floor(Math.random() * 10000)}`;
      const tx = db.transaction(() => {
        db.prepare(`
          INSERT INTO interaction_trade_sessions(id, userAId, userBId, status, confirmA, confirmB, cancelledBy, completedAt, createdAt, updatedAt)
          VALUES(?,?,?,?,?,?,?,?,?,?)
        `).run(sessionId, pair.userAId, pair.userBId, 'pending', 0, 0, 0, null, nowIso(), nowIso());
        db.prepare(`
          INSERT OR IGNORE INTO interaction_trade_offers(sessionId, userId, itemName, qty, gold, updatedAt)
          VALUES(?,?,?,?,?,?)
        `).run(sessionId, pair.userAId, '', 0, 0, nowIso());
        db.prepare(`
          INSERT OR IGNORE INTO interaction_trade_offers(sessionId, userId, itemName, qty, gold, updatedAt)
          VALUES(?,?,?,?,?,?)
        `).run(sessionId, pair.userBId, '', 0, 0, nowIso());
      });
      tx();

      const created = db.prepare(`SELECT * FROM interaction_trade_sessions WHERE id = ? LIMIT 1`).get(sessionId) as AnyRow | undefined;
      const payload = loadTradeSessionPayload(db, created);
      pushInteractionEvent(
        db,
        toUserId,
        fromUserId,
        toUserId,
        'trade',
        '交易邀请',
        `${String(fromUser.name || `玩家#${fromUserId}`)} 向你发起了交易`,
        { sessionId }
      );
      pushInteractionEvent(
        db,
        fromUserId,
        fromUserId,
        toUserId,
        'trade',
        '交易已发起',
        `已向 ${String(toUser.name || `玩家#${toUserId}`)} 发起交易`,
        { sessionId }
      );
      return res.json({ success: true, created: true, sessionId, session: payload });
    } catch (e: any) {
      return res.status(500).json({ success: false, message: e?.message || 'start trade session failed' });
    }
  });

  r.get('/trade/session/active/:userId', (req, res) => {
    try {
      const userId = Number(req.params.userId || 0);
      if (!userId) return res.status(400).json({ success: false, message: 'invalid userId' });
      const row = db.prepare(`
        SELECT *
        FROM interaction_trade_sessions
        WHERE status = 'pending'
          AND (userAId = ? OR userBId = ?)
        ORDER BY updatedAt DESC
        LIMIT 1
      `).get(userId, userId) as AnyRow | undefined;
      if (!row) return res.json({ success: true, sessionId: null, session: null });
      const payload = loadTradeSessionPayload(db, row);
      return res.json({ success: true, sessionId: String(row.id || ''), session: payload });
    } catch (e: any) {
      return res.status(500).json({ success: false, message: e?.message || 'query active trade session failed' });
    }
  });

  r.get('/trade/session/:sessionId', (req, res) => {
    try {
      const sessionId = String(req.params.sessionId || '').trim();
      const userId = Number(req.query.userId || 0);
      if (!sessionId) return res.status(400).json({ success: false, message: 'invalid sessionId' });
      const row = db.prepare(`SELECT * FROM interaction_trade_sessions WHERE id = ? LIMIT 1`).get(sessionId) as AnyRow | undefined;
      if (!row) return res.status(404).json({ success: false, message: 'trade session not found' });
      if (userId && Number(row.userAId || 0) !== userId && Number(row.userBId || 0) !== userId) {
        return res.status(403).json({ success: false, message: 'forbidden' });
      }
      const payload = loadTradeSessionPayload(db, row);
      return res.json({ success: true, session: payload });
    } catch (e: any) {
      return res.status(500).json({ success: false, message: e?.message || 'query trade session failed' });
    }
  });

  r.post('/trade/session/:sessionId/offer', (req, res) => {
    try {
      const sessionId = String(req.params.sessionId || '').trim();
      const userId = Number(req.body?.userId || 0);
      const rawItemName = String(req.body?.itemName || '').trim();
      let qty = clamp(Math.floor(Number(req.body?.qty || 0)), 0, 99);
      const gold = clamp(Math.floor(Number(req.body?.gold || 0)), 0, 99999999);
      const userSkillId = Math.max(0, Math.floor(Number(req.body?.userSkillId || req.body?.skillEntryId || 0)));
      if (!sessionId || !userId) return res.status(400).json({ success: false, message: 'invalid params' });

      const session = db.prepare(`SELECT * FROM interaction_trade_sessions WHERE id = ? LIMIT 1`).get(sessionId) as AnyRow | undefined;
      if (!session) return res.status(404).json({ success: false, message: 'trade session not found' });
      if (String(session.status || '') !== 'pending') return res.status(400).json({ success: false, message: '交易已结束' });
      if (Number(session.userAId || 0) !== userId && Number(session.userBId || 0) !== userId) {
        return res.status(403).json({ success: false, message: 'forbidden' });
      }

      const me = getUser(db, userId);
      if (!me) return res.status(404).json({ success: false, message: 'user not found' });
      if (Number(me.gold || 0) < gold) return res.status(400).json({ success: false, message: '你的金币不足' });

      let itemName = rawItemName;
      if (!itemName) qty = 0;
      if (itemName && qty > 0 && inventoryTotalQty(db, userId, itemName) < qty) {
        return res.status(400).json({ success: false, message: '你的物品数量不足' });
      }

      if (userSkillId > 0) {
        const skillRow = pickTradeSkillEntry(db, userId, userSkillId);
        if (!skillRow) return res.status(400).json({ success: false, message: '你不再持有该技能' });
        const peerId = Number(session.userAId || 0) === userId ? Number(session.userBId || 0) : Number(session.userAId || 0);
        const peerHas = db.prepare(`SELECT 1 FROM user_skills WHERE userId = ? AND skillId = ? LIMIT 1`).get(peerId, Number(skillRow.skillId || 0));
        if (peerHas) return res.status(400).json({ success: false, message: '对方已掌握该技能' });
        itemName = encodeTradeSkillOffer(userSkillId, String(skillRow.name || ''));
        qty = 1;
      }

      const tx = db.transaction(() => {
        db.prepare(`
          INSERT INTO interaction_trade_offers(sessionId, userId, itemName, qty, gold, updatedAt)
          VALUES(?,?,?,?,?,?)
          ON CONFLICT(sessionId, userId)
          DO UPDATE SET
            itemName = excluded.itemName,
            qty = excluded.qty,
            gold = excluded.gold,
            updatedAt = excluded.updatedAt
        `).run(sessionId, userId, itemName, qty, gold, nowIso());

        db.prepare(`
          UPDATE interaction_trade_sessions
          SET confirmA = 0,
              confirmB = 0,
              updatedAt = ?
          WHERE id = ?
        `).run(nowIso(), sessionId);
      });
      tx();

      const peerId = Number(session.userAId || 0) === userId ? Number(session.userBId || 0) : Number(session.userAId || 0);
      if (peerId) {
        pushInteractionEvent(
          db,
          peerId,
          userId,
          peerId,
          'trade',
          '交易报价更新',
          `${String(me.name || `玩家#${userId}`)} 更新了交易报价`,
          { sessionId }
        );
      }

      const fresh = db.prepare(`SELECT * FROM interaction_trade_sessions WHERE id = ? LIMIT 1`).get(sessionId) as AnyRow | undefined;
      const payload = loadTradeSessionPayload(db, fresh);
      void gameplayRuntime?.publishUsers([userId, peerId], 'trade.session.changed', { sessionId, status: String(fresh?.status || 'pending'), reason: 'offer' });
      return res.json({ success: true, session: payload, message: '交易报价已更新（双方确认已重置）' });
    } catch (e: any) {
      return res.status(500).json({ success: false, message: e?.message || 'update trade offer failed' });
    }
  });
  r.post('/trade/session/:sessionId/confirm', (req, res) => {
    try {
      const sessionId = String(req.params.sessionId || '').trim();
      const userId = Number(req.body?.userId || 0);
      const confirm = req.body?.confirm === false ? 0 : 1;
      if (!sessionId || !userId) return res.status(400).json({ success: false, message: 'invalid params' });

      const session = db.prepare(`SELECT * FROM interaction_trade_sessions WHERE id = ? LIMIT 1`).get(sessionId) as AnyRow | undefined;
      if (!session) return res.status(404).json({ success: false, message: 'trade session not found' });
      if (String(session.status || '') !== 'pending') return res.status(400).json({ success: false, message: '交易已结束' });
      const userAId = Number(session.userAId || 0);
      const userBId = Number(session.userBId || 0);
      if (userAId !== userId && userBId !== userId) return res.status(403).json({ success: false, message: 'forbidden' });

      const field = userAId === userId ? 'confirmA' : 'confirmB';
      db.prepare(`
        UPDATE interaction_trade_sessions
        SET ${field} = ?,
            updatedAt = ?
        WHERE id = ?
      `).run(confirm, nowIso(), sessionId);

      const me = getUser(db, userId);
      const peerId = userAId === userId ? userBId : userAId;
      const peer = getUser(db, peerId);

      const fresh = db.prepare(`SELECT * FROM interaction_trade_sessions WHERE id = ? LIMIT 1`).get(sessionId) as AnyRow | undefined;
      if (!fresh) return res.status(404).json({ success: false, message: 'trade session lost' });

      if (confirm && Number(fresh.confirmA || 0) === 1 && Number(fresh.confirmB || 0) === 1) {
        const done = completeTradeSession(db, sessionId);
        if (!done.success) {
          db.prepare(`
            UPDATE interaction_trade_sessions
            SET status = 'cancelled',
                cancelledBy = 0,
                updatedAt = ?
            WHERE id = ?
          `).run(nowIso(), sessionId);
          pushInteractionEvent(
            db,
            userAId,
            0,
            userAId,
            'trade',
            '交易取消',
            `交易自动取消：${done.message}`,
            { sessionId }
          );
          pushInteractionEvent(
            db,
            userBId,
            0,
            userBId,
            'trade',
            '交易取消',
            `交易自动取消：${done.message}`,
            { sessionId }
          );
          void gameplayRuntime?.publishUsers([userAId, userBId], 'trade.session.changed', { sessionId, status: 'cancelled', reason: 'failed' });
          return res.status(400).json({ success: false, message: done.message });
        }
        const completed = db.prepare(`SELECT * FROM interaction_trade_sessions WHERE id = ? LIMIT 1`).get(sessionId) as AnyRow | undefined;
        const payload = loadTradeSessionPayload(db, completed);
        void gameplayRuntime?.publishUsers([userAId, userBId], 'trade.session.changed', { sessionId, status: 'completed', reason: 'completed' });
        return res.json({ success: true, completed: true, session: payload, message: done.message || '交易已完成' });
      }

      if (peerId) {
        pushInteractionEvent(
          db,
          peerId,
          userId,
          peerId,
          'trade',
          '交易确认变更',
          `${String(me?.name || `玩家#${userId}`)} ${confirm ? '已确认' : '取消确认'}交易`,
          { sessionId }
        );
      }

      const payload = loadTradeSessionPayload(db, fresh);
      void gameplayRuntime?.publishUsers([userAId, userBId], 'trade.session.changed', { sessionId, status: String(fresh.status || 'pending'), reason: 'confirm' });
      return res.json({
        success: true,
        completed: false,
        session: payload,
        message: confirm
          ? `你已确认交易，等待 ${String(peer?.name || `玩家#${peerId}`)} 确认`
          : '你已取消确认'
      });
    } catch (e: any) {
      return res.status(500).json({ success: false, message: e?.message || 'confirm trade session failed' });
    }
  });

  r.post('/trade/session/:sessionId/cancel', (req, res) => {
    try {
      const sessionId = String(req.params.sessionId || '').trim();
      const userId = Number(req.body?.userId || 0);
      if (!sessionId || !userId) return res.status(400).json({ success: false, message: 'invalid params' });
      const session = db.prepare(`SELECT * FROM interaction_trade_sessions WHERE id = ? LIMIT 1`).get(sessionId) as AnyRow | undefined;
      if (!session) return res.status(404).json({ success: false, message: 'trade session not found' });
      if (String(session.status || '') !== 'pending') return res.status(400).json({ success: false, message: '交易已结束' });
      const userAId = Number(session.userAId || 0);
      const userBId = Number(session.userBId || 0);
      if (userAId !== userId && userBId !== userId) return res.status(403).json({ success: false, message: 'forbidden' });

      db.prepare(`
        UPDATE interaction_trade_sessions
        SET status = 'cancelled',
            cancelledBy = ?,
            updatedAt = ?
        WHERE id = ?
      `).run(userId, nowIso(), sessionId);

      const me = getUser(db, userId);
      const peerId = userAId === userId ? userBId : userAId;
      pushInteractionEvent(
        db,
        userId,
        userId,
        peerId,
        'trade',
        '交易取消',
        '你取消了本次交易',
        { sessionId }
      );
      if (peerId) {
        pushInteractionEvent(
          db,
          peerId,
          userId,
          peerId,
          'trade',
          '交易取消',
          `${String(me?.name || `玩家#${userId}`)} 取消了本次交易`,
          { sessionId }
        );
      }
      void gameplayRuntime?.publishUsers([userId, peerId], 'trade.session.changed', { sessionId, status: 'cancelled', reason: 'cancel' });
      return res.json({ success: true, message: '交易已取消' });
    } catch (e: any) {
      return res.status(500).json({ success: false, message: e?.message || 'cancel trade session failed' });
    }
  });

  r.post('/interact/trade', (req, res) => {
    try {
      const fromUserId = Number(req.body?.fromUserId);
      const toUserId = Number(req.body?.toUserId);
      const mode = String(req.body?.mode || '').trim();
      if (!fromUserId || !toUserId || !mode) return res.status(400).json({ success: false, message: 'invalid params' });
      if (fromUserId === toUserId) return res.status(400).json({ success: false, message: 'cannot trade with self' });

      const fromUser = getUser(db, fromUserId);
      const toUser = getUser(db, toUserId);
      if (!fromUser || !toUser) return res.status(404).json({ success: false, message: 'user not found' });

      if (mode === 'gold') {
        const amount = clamp(Number(req.body?.amount || 0), 1, 99999999);
        if (Number(fromUser.gold || 0) < amount) return res.status(400).json({ success: false, message: '你的金币不足' });
        db.prepare(`UPDATE users SET gold = gold - ?, updatedAt=? WHERE id=?`).run(amount, nowIso(), fromUserId);
        db.prepare(`UPDATE users SET gold = gold + ?, updatedAt=? WHERE id=?`).run(amount, nowIso(), toUserId);
        db.prepare(`INSERT INTO interaction_trade_logs(fromUserId,toUserId,mode,payloadJson,createdAt) VALUES(?,?,?,?,?)`)
          .run(fromUserId, toUserId, mode, JSON.stringify({ amount }), nowIso());
        pushInteractionEvent(
          db,
          fromUserId,
          fromUserId,
          toUserId,
          'trade',
          '交易完成',
          `你向 ${String(toUser.name || `玩家#${toUserId}`)} 转移了 ${amount}G`,
          { mode, amount }
        );
        pushInteractionEvent(
          db,
          toUserId,
          fromUserId,
          toUserId,
          'trade',
          '收到交易',
          `${String(fromUser.name || `玩家#${fromUserId}`)} 向你转移了 ${amount}G`,
          { mode, amount }
        );
        return res.json({ success: true, message: `交易完成：转移 ${amount}G` });
      }

      if (mode === 'item') {
        const itemName = String(req.body?.itemName || '').trim();
        if (!itemName) return res.status(400).json({ success: false, message: 'itemName required' });
        const item = db.prepare(`SELECT * FROM inventory WHERE userId=? AND name=? AND qty>0 ORDER BY id DESC LIMIT 1`).get(fromUserId, itemName) as AnyRow | undefined;
        if (!item) return res.status(400).json({ success: false, message: '你没有该物品或数量不足' });
        const tx = db.transaction(() => {
          if (Number(item.qty || 1) <= 1) db.prepare(`DELETE FROM inventory WHERE id=?`).run(Number(item.id));
          else db.prepare(`UPDATE inventory SET qty = qty - 1 WHERE id=?`).run(Number(item.id));
          addItem(db, toUserId, itemName, String(item.itemType || 'consumable'), 1, String(item.description || ''), Number(item.effectValue || 0));
          db.prepare(`INSERT INTO interaction_trade_logs(fromUserId,toUserId,mode,payloadJson,createdAt) VALUES(?,?,?,?,?)`)
            .run(fromUserId, toUserId, mode, JSON.stringify({ itemName }), nowIso());
        });
        tx();
        pushInteractionEvent(
          db,
          fromUserId,
          fromUserId,
          toUserId,
          'trade',
          '交易完成',
          `你向 ${String(toUser.name || `玩家#${toUserId}`)} 转移了物品「${itemName}」`,
          { mode, itemName }
        );
        pushInteractionEvent(
          db,
          toUserId,
          fromUserId,
          toUserId,
          'trade',
          '收到交易',
          `${String(fromUser.name || `玩家#${fromUserId}`)} 向你转移了物品「${itemName}」`,
          { mode, itemName }
        );
        return res.json({ success: true, message: `交易完成：转移物品 ${itemName}` });
      }

      if (mode === 'skill') {
        const skillName = String(req.body?.skillName || '').trim();
        if (!skillName) return res.status(400).json({ success: false, message: 'skillName required' });
        const row = db.prepare(`
          SELECT us.id AS userSkillId, us.level, s.id AS skillId, s.name
          FROM user_skills us
          JOIN skills s ON s.id = us.skillId
          WHERE us.userId = ? AND s.name = ?
          ORDER BY us.id DESC
          LIMIT 1
        `).get(fromUserId, skillName) as AnyRow | undefined;
        if (!row) return res.status(400).json({ success: false, message: '你尚未掌握该技能' });
        const targetHas = db.prepare(`SELECT 1 FROM user_skills WHERE userId=? AND skillId=? LIMIT 1`).get(toUserId, Number(row.skillId));
        if (targetHas) return res.status(400).json({ success: false, message: '对方已掌握该技能，无法重复交易' });
        let tradeMessage = `交易完成：转移技能 ${skillName}`;
        const tx = db.transaction(() => {
          db.prepare(`DELETE FROM user_skills WHERE id=?`).run(Number(row.userSkillId));
          const skillInfo = db.prepare(`SELECT id, name, faction FROM skills WHERE id = ? LIMIT 1`).get(Number(row.skillId)) as AnyRow | undefined;
          if (skillInfo) {
            const granted = grantSkillOrBook(db, toUserId, skillInfo, Math.max(1, Number(row.level || 1)));
            if (granted.converted) {
              tradeMessage = `交易完成：${skillName} 因派系限制已转为技能书交付`;
            }
          }
          db.prepare(`INSERT INTO interaction_trade_logs(fromUserId,toUserId,mode,payloadJson,createdAt) VALUES(?,?,?,?,?)`)
            .run(fromUserId, toUserId, mode, JSON.stringify({ skillName }), nowIso());
        });
        tx();
        pushInteractionEvent(
          db,
          fromUserId,
          fromUserId,
          toUserId,
          'trade',
          '交易完成',
          `你向 ${String(toUser.name || `玩家#${toUserId}`)} 转移了技能「${skillName}」`,
          { mode, skillName }
        );
        pushInteractionEvent(
          db,
          toUserId,
          fromUserId,
          toUserId,
          'trade',
          '收到交易',
          `${String(fromUser.name || `玩家#${fromUserId}`)} 向你转移了技能「${skillName}」`,
          { mode, skillName }
        );
        return res.json({ success: true, message: tradeMessage });
      }

      return res.status(400).json({ success: false, message: 'unsupported trade mode' });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e?.message || 'trade failed' });
    }
  });

  r.get('/interact/events/:userId', (req, res) => {
    try {
      const userId = Number(req.params.userId || 0);
      const afterIdRaw = Number(req.query.afterId || 0);
      const limitRaw = Number(req.query.limit || 20);
      const latestOnly = String(req.query.latestOnly || '') === '1';
      if (!userId) return res.status(400).json({ success: false, message: 'invalid userId', events: [] });
      if (latestOnly) {
        const row = db.prepare(`SELECT COALESCE(MAX(id), 0) AS maxId FROM interaction_events WHERE userId = ?`).get(userId) as AnyRow | undefined;
        return res.json({ success: true, maxId: Number(row?.maxId || 0), events: [] });
      }
      const afterId = Number.isFinite(afterIdRaw) && afterIdRaw > 0 ? Math.floor(afterIdRaw) : 0;
      const limit = clamp(Number.isFinite(limitRaw) ? Math.floor(limitRaw) : 20, 1, 100);
      const rows = db.prepare(`
        SELECT id, userId, sourceUserId, targetUserId, actionType, title, message, payloadJson, createdAt
        FROM interaction_events
        WHERE userId = ? AND id > ?
        ORDER BY id ASC
        LIMIT ?
      `).all(userId, afterId, limit) as AnyRow[];
      res.json({
        success: true,
        events: rows.map((x) => ({
          id: Number(x.id || 0),
          userId: Number(x.userId || 0),
          sourceUserId: Number(x.sourceUserId || 0),
          targetUserId: Number(x.targetUserId || 0),
          actionType: String(x.actionType || ''),
          title: String(x.title || ''),
          message: String(x.message || ''),
          payload: (() => {
            try {
              return JSON.parse(String(x.payloadJson || '{}'));
            } catch {
              return {};
            }
          })(),
          createdAt: String(x.createdAt || '')
        }))
      });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e?.message || 'interaction events query failed', events: [] });
    }
  });

  r.post('/interact/report', (req, res) => {
    try {
      const reporterId = Number(req.body?.reporterId);
      const targetId = Number(req.body?.targetId);
      const reason = String(req.body?.reason || '').trim();
      if (!reporterId || !targetId || !reason) return res.status(400).json({ success: false, message: 'invalid params' });
      if (reporterId === targetId) return res.status(400).json({ success: false, message: 'cannot report self' });
      const reporter = getUser(db, reporterId);
      const target = getUser(db, targetId);
      if (!reporter || !target) return res.status(404).json({ success: false, message: 'user not found' });

      const ret = db.prepare(`
        INSERT INTO interaction_reports(reporterId,targetId,reason,status,createdAt,updatedAt)
        VALUES(?,?,?,?,?,?)
      `).run(reporterId, targetId, reason, 'pending', nowIso(), nowIso());

      res.json({
        success: true,
        reportId: Number(ret.lastInsertRowid || 0),
        message: '举报已提交，等待管理员处理'
      });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e?.message || 'report failed' });
    }
  });

  r.get('/admin/reports', auth.requireAdminAuth, (req, res) => {
    try {
      const status = String(req.query.status || '').trim();
      const whereSql = status ? `WHERE r.status = ?` : '';
      const params: any[] = [];
      if (status) params.push(status);
      const rows = db.prepare(`
        SELECT
          r.id,
          r.reporterId,
          r.targetId,
          r.reason,
          r.status,
          r.createdAt,
          r.updatedAt,
          ru.name AS reporterName,
          tu.name AS targetName,
          SUM(CASE WHEN v.decision = 'ban' THEN 1 ELSE 0 END) AS banVotes,
          SUM(CASE WHEN v.decision = 'reject' THEN 1 ELSE 0 END) AS rejectVotes
        FROM interaction_reports r
        LEFT JOIN users ru ON ru.id = r.reporterId
        LEFT JOIN users tu ON tu.id = r.targetId
        LEFT JOIN interaction_report_votes v ON v.reportId = r.id
        ${whereSql}
        GROUP BY r.id
        ORDER BY r.id DESC
        LIMIT 200
      `).all(...params) as AnyRow[];
      res.json({
        success: true,
        threshold: 2,
        reports: rows.map((x) => ({
          id: Number(x.id),
          reporterId: Number(x.reporterId || 0),
          targetId: Number(x.targetId || 0),
          reporterName: String(x.reporterName || ''),
          targetName: String(x.targetName || ''),
          reason: String(x.reason || ''),
          status: String(x.status || 'pending'),
          banVotes: Number(x.banVotes || 0),
          rejectVotes: Number(x.rejectVotes || 0),
          createdAt: String(x.createdAt || ''),
          updatedAt: String(x.updatedAt || '')
        }))
      });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e?.message || 'admin reports query failed', reports: [] });
    }
  });

  r.post('/admin/reports/:reportId/vote', auth.requireAdminAuth, (req: any, res) => {
    try {
      const reportId = Number(req.params.reportId);
      const decision = String(req.body?.decision || '').trim();
      if (!reportId || !['ban', 'reject'].includes(decision)) {
        return res.status(400).json({ success: false, message: 'invalid params' });
      }
      const report = db.prepare(`SELECT * FROM interaction_reports WHERE id = ? LIMIT 1`).get(reportId) as AnyRow | undefined;
      if (!report) return res.status(404).json({ success: false, message: 'report not found' });
      if (['banned', 'rejected'].includes(String(report.status || ''))) {
        return res.json({ success: true, status: report.status, message: '该举报已结案' });
      }

      const adminUserId = Number(req.admin?.userId || 0);
      const adminName = String(req.admin?.name || 'admin');
      db.prepare(`
        INSERT INTO interaction_report_votes(reportId,adminUserId,adminName,decision,createdAt,updatedAt)
        VALUES(?,?,?,?,?,?)
        ON CONFLICT(reportId,adminUserId)
        DO UPDATE SET decision=excluded.decision, adminName=excluded.adminName, updatedAt=excluded.updatedAt
      `).run(reportId, adminUserId, adminName, decision, nowIso(), nowIso());

      const stat = db.prepare(`
        SELECT
          SUM(CASE WHEN decision='ban' THEN 1 ELSE 0 END) AS banVotes,
          SUM(CASE WHEN decision='reject' THEN 1 ELSE 0 END) AS rejectVotes
        FROM interaction_report_votes
        WHERE reportId = ?
      `).get(reportId) as AnyRow;

      const banVotes = Number(stat?.banVotes || 0);
      const rejectVotes = Number(stat?.rejectVotes || 0);
      const threshold = 2;
      let nextStatus = 'voting';
      let message = `已记录投票：封号 ${banVotes}/${threshold}，驳回 ${rejectVotes}/${threshold}`;

      if (banVotes >= threshold) {
        nextStatus = 'banned';
        db.prepare(`UPDATE interaction_reports SET status='banned', updatedAt=? WHERE id=?`).run(nowIso(), reportId);
        db.prepare(`UPDATE users SET status='banned', forceOfflineAt=?, updatedAt=? WHERE id=?`).run(nowIso(), nowIso(), Number(report.targetId));
        message = '投票达标，目标已封号';
      } else if (rejectVotes >= threshold) {
        nextStatus = 'rejected';
        db.prepare(`UPDATE interaction_reports SET status='rejected', updatedAt=? WHERE id=?`).run(nowIso(), reportId);
        message = '投票达标，该举报已驳回';
      } else {
        db.prepare(`UPDATE interaction_reports SET status='voting', updatedAt=? WHERE id=?`).run(nowIso(), reportId);
      }

      writeAdminLog(
        db,
        adminName,
        `举报投票 ${decision} #${reportId}`,
        'interaction_report',
        String(reportId),
        { decision, banVotes, rejectVotes, threshold, status: nextStatus }
      );

      res.json({ success: true, status: nextStatus, banVotes, rejectVotes, threshold, message });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e?.message || 'report vote failed' });
    }
  });

  r.post('/interact/skip/request', (req, res) => {
    try {
      const fromUserId = Number(req.body?.fromUserId);
      const toUserId = Number(req.body?.toUserId);
      const actionType = String(req.body?.actionType || '').trim();
      const payload = req.body?.payload && typeof req.body.payload === 'object' ? req.body.payload : {};
      if (!fromUserId || !toUserId || !actionType) return res.status(400).json({ success: false, message: 'invalid params' });
      if (fromUserId === toUserId) return res.status(400).json({ success: false, message: 'cannot target self' });

      const fromUser = getUser(db, fromUserId);
      const toUser = getUser(db, toUserId);
      if (!fromUser || !toUser) return res.status(404).json({ success: false, message: 'user not found' });

      const allowed = new Set(['combat', 'steal', 'prank', 'soothe']);
      if (!allowed.has(actionType)) {
        return res.status(400).json({ success: false, message: '该动作暂不支持跳过流程' });
      }

      db.prepare(`
        UPDATE interaction_skip_requests
        SET status = 'cancelled', updatedAt = ?
        WHERE fromUserId = ? AND toUserId = ? AND actionType = ? AND status = 'pending'
      `).run(nowIso(), fromUserId, toUserId, actionType);

      const ret = db.prepare(`
        INSERT INTO interaction_skip_requests(fromUserId,toUserId,actionType,payloadJson,status,resultMessage,createdAt,updatedAt)
        VALUES(?,?,?,?,?,?,?,?)
      `).run(fromUserId, toUserId, actionType, JSON.stringify(payload || {}), 'pending', '', nowIso(), nowIso());

      res.json({ success: true, requestId: Number(ret.lastInsertRowid || 0) });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e?.message || 'skip request failed' });
    }
  });

  r.get('/interact/skip/pending/:userId', (req, res) => {
    try {
      const userId = Number(req.params.userId);
      if (!userId) return res.status(400).json({ success: false, message: 'invalid userId' });
      const rows = db.prepare(`
        SELECT
          r.id,
          r.fromUserId,
          r.toUserId,
          r.actionType,
          r.payloadJson,
          r.status,
          r.resultMessage,
          r.createdAt,
          r.updatedAt,
          u.name AS fromUserName
        FROM interaction_skip_requests r
        LEFT JOIN users u ON u.id = r.fromUserId
        WHERE toUserId = ? AND status = 'pending'
        ORDER BY id ASC
      `).all(userId) as AnyRow[];
        const list = rows.map((x) => ({
          id: Number(x.id),
          fromUserId: Number(x.fromUserId),
          fromUserName: String(x.fromUserName || ''),
          toUserId: Number(x.toUserId),
          actionType: String(x.actionType || ''),
        payload: (() => { try { return JSON.parse(String(x.payloadJson || '{}')); } catch { return {}; } })(),
        status: String(x.status || 'pending'),
        resultMessage: String(x.resultMessage || ''),
        createdAt: String(x.createdAt || ''),
        updatedAt: String(x.updatedAt || '')
      }));
      res.json({ success: true, requests: list });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e?.message || 'skip pending query failed', requests: [] });
    }
  });

  r.get('/interact/skip/status/:requestId', (req, res) => {
    try {
      const requestId = Number(req.params.requestId);
      if (!requestId) return res.status(400).json({ success: false, message: 'invalid requestId' });
      const row = db.prepare(`
        SELECT id, fromUserId, toUserId, actionType, payloadJson, status, resultMessage, createdAt, updatedAt
        FROM interaction_skip_requests
        WHERE id = ?
        LIMIT 1
      `).get(requestId) as AnyRow | undefined;
      if (!row) return res.status(404).json({ success: false, message: 'request not found' });
      res.json({
        success: true,
        request: {
          id: Number(row.id),
          fromUserId: Number(row.fromUserId),
          toUserId: Number(row.toUserId),
          actionType: String(row.actionType || ''),
          payload: (() => { try { return JSON.parse(String(row.payloadJson || '{}')); } catch { return {}; } })(),
          status: String(row.status || 'pending'),
          resultMessage: String(row.resultMessage || ''),
          createdAt: String(row.createdAt || ''),
          updatedAt: String(row.updatedAt || '')
        }
      });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e?.message || 'skip status query failed' });
    }
  });

  r.post('/interact/skip/respond', (req, res) => {
    try {
      const requestId = Number(req.body?.requestId);
      const userId = Number(req.body?.userId);
      const accept = Boolean(req.body?.accept);
      if (!requestId || !userId) return res.status(400).json({ success: false, message: 'invalid params' });

      const row = db.prepare(`SELECT * FROM interaction_skip_requests WHERE id=? LIMIT 1`).get(requestId) as AnyRow | undefined;
      if (!row) return res.status(404).json({ success: false, message: 'request not found' });
      if (Number(row.toUserId) !== userId) return res.status(403).json({ success: false, message: 'forbidden' });
      if (String(row.status) !== 'pending') return res.json({ success: true, status: row.status, message: row.resultMessage || 'already handled' });

      if (!accept) {
        db.prepare(`UPDATE interaction_skip_requests SET status='rejected', resultMessage=?, updatedAt=? WHERE id=?`)
          .run('对方拒绝了跳过请求，动作取消', nowIso(), requestId);
        return res.json({ success: true, status: 'rejected', message: '已拒绝该请求' });
      }

      const actionType = String(row.actionType || '');
      const payload = (() => { try { return JSON.parse(String(row.payloadJson || '{}')); } catch { return {}; } })();
      const ret = executeInteractionAction(db, actionType, Number(row.fromUserId), Number(row.toUserId), payload);
      const ok = Boolean(ret?.success);
      const status = ok ? 'accepted' : 'failed';
      const msg = String(ret?.message || (ok ? '动作执行成功' : '动作执行失败'));
      db.prepare(`UPDATE interaction_skip_requests SET status=?, resultMessage=?, updatedAt=? WHERE id=?`)
        .run(status, msg, nowIso(), requestId);
      res.json({ success: true, status, message: msg, actionResult: ret });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e?.message || 'skip respond failed' });
    }
  });

  r.post('/party/request', (req, res) => {
    try {
      const userId = Number(req.body?.userId);
      const targetId = Number(req.body?.targetId);
      if (!userId || !targetId) return res.status(400).json({ success: false, message: 'invalid params' });
      if (userId === targetId) return res.status(400).json({ success: false, message: 'cannot target self' });

      const me = getUser(db, userId);
      const target = getUser(db, targetId);
      if (!me || !target) return res.status(404).json({ success: false, message: 'user not found' });

      const myPartyId = String(me.partyId || '').trim();
      const targetPartyId = String(target.partyId || '').trim();
      const ts = nowIso();

      if (myPartyId && targetPartyId && myPartyId === targetPartyId) {
        const others = getPartyMembers(db, myPartyId).filter((m) => Number(m.id) !== userId);
        if (others.length === 0) {
          db.prepare(`UPDATE users SET partyId = NULL, updatedAt = ? WHERE id = ?`).run(ts, userId);
          return res.json({ success: true, mode: 'leave_done', message: '已解除组队' });
        }
        const batchKey = `leave-${Date.now()}-${userId}-${myPartyId}`;
        const ins = db.prepare(`
          INSERT INTO party_requests(batchKey,requestType,partyId,fromUserId,toUserId,targetUserId,payloadJson,status,resultMessage,createdAt,updatedAt)
          VALUES(?,?,?,?,?,?,?,?,?,?,?)
        `);
        for (const m of others) {
          ins.run(batchKey, 'leave', myPartyId, userId, Number(m.id), 0, '{}', 'pending', '', ts, ts);
        }
        return res.json({
          success: true,
          mode: 'leave_request',
          batchKey,
          message: '已发起解除组队请求，等待队友确认'
        });
      }

      if (myPartyId && targetPartyId && myPartyId !== targetPartyId) {
        return res.status(400).json({ success: false, message: '双方处于不同队伍，无法直接操作' });
      }

      if (!myPartyId && !targetPartyId) {
        const batchKey = `join-direct-${Date.now()}-${Math.min(userId, targetId)}-${Math.max(userId, targetId)}`;
        db.prepare(`
          INSERT INTO party_requests(batchKey,requestType,partyId,fromUserId,toUserId,targetUserId,payloadJson,status,resultMessage,createdAt,updatedAt)
          VALUES(?,?,?,?,?,?,?,?,?,?,?)
        `).run(batchKey, 'join_direct', '', userId, targetId, targetId, '{}', 'pending', '', ts, ts);
        return res.json({ success: true, mode: 'join_direct', batchKey, message: '已发送组队邀请，等待对方同意' });
      }

      const partyId = myPartyId || targetPartyId;
      const applicantId = myPartyId ? targetId : userId;
      const members = getPartyMembers(db, partyId);
      const approverIds = members.map((m) => Number(m.id)).filter((id) => id !== applicantId);
      if (!approverIds.length) {
        db.prepare(`UPDATE users SET partyId = ?, updatedAt = ? WHERE id IN (?, ?)`).run(partyId, ts, userId, targetId);
        return res.json({ success: true, mode: 'join_done', partyId, message: '组队完成' });
      }
      const batchKey = `join-vote-${Date.now()}-${applicantId}-${partyId}`;
      const ins = db.prepare(`
        INSERT INTO party_requests(batchKey,requestType,partyId,fromUserId,toUserId,targetUserId,payloadJson,status,resultMessage,createdAt,updatedAt)
        VALUES(?,?,?,?,?,?,?,?,?,?,?)
      `);
      for (const approverId of approverIds) {
        ins.run(
          batchKey,
          'join_vote',
          partyId,
          userId,
          approverId,
          applicantId,
          JSON.stringify({ applicantId, partyId }),
          'pending',
          '',
          ts,
          ts
        );
      }
      return res.json({
        success: true,
        mode: 'join_vote',
        batchKey,
        message: '已发起入队投票，等待队伍成员确认'
      });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e?.message || 'party request failed' });
    }
  });

  r.get('/party/requests/:userId', (req, res) => {
    try {
      const userId = Number(req.params.userId);
      if (!userId) return res.status(400).json({ success: false, message: 'invalid userId' });
      const rows = db.prepare(`
        SELECT
          pr.*,
          fu.name AS fromUserName,
          tu.name AS toUserName,
          au.name AS applicantName
        FROM party_requests pr
        LEFT JOIN users fu ON fu.id = pr.fromUserId
        LEFT JOIN users tu ON tu.id = pr.toUserId
        LEFT JOIN users au ON au.id = pr.targetUserId
        WHERE pr.toUserId = ?
          AND pr.status = 'pending'
        ORDER BY pr.id ASC
      `).all(userId) as AnyRow[];
      const requests = rows.map((x) => ({
        id: Number(x.id),
        batchKey: String(x.batchKey || ''),
        requestType: String(x.requestType || ''),
        partyId: String(x.partyId || ''),
        fromUserId: Number(x.fromUserId || 0),
        toUserId: Number(x.toUserId || 0),
        targetUserId: Number(x.targetUserId || 0),
        fromUserName: String(x.fromUserName || ''),
        toUserName: String(x.toUserName || ''),
        applicantName: String(x.applicantName || ''),
        payload: (() => { try { return JSON.parse(String(x.payloadJson || '{}')); } catch { return {}; } })(),
        createdAt: String(x.createdAt || ''),
        updatedAt: String(x.updatedAt || '')
      }));
      res.json({ success: true, requests });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e?.message || 'party requests query failed', requests: [] });
    }
  });

  r.post('/party/respond', (req, res) => {
    try {
      const requestId = Number(req.body?.requestId);
      const userId = Number(req.body?.userId);
      const accept = Boolean(req.body?.accept);
      if (!requestId || !userId) return res.status(400).json({ success: false, message: 'invalid params' });

      const row = db.prepare(`SELECT * FROM party_requests WHERE id = ? LIMIT 1`).get(requestId) as AnyRow | undefined;
      if (!row) return res.status(404).json({ success: false, message: 'request not found' });
      if (Number(row.toUserId) !== userId) return res.status(403).json({ success: false, message: 'forbidden' });
      if (String(row.status || '') !== 'pending') {
        return res.json({ success: true, status: row.status, message: row.resultMessage || 'already handled' });
      }

      const requestType = String(row.requestType || '');
      const batchKey = String(row.batchKey || '');
      const partyId = String(row.partyId || '');
      const ts = nowIso();

      db.prepare(`UPDATE party_requests SET status = ?, resultMessage = ?, updatedAt = ? WHERE id = ?`)
        .run(accept ? 'accepted' : 'rejected', accept ? '已同意' : '已拒绝', ts, requestId);

      if (requestType === 'join_direct') {
        if (!accept) return res.json({ success: true, status: 'rejected', message: '你已拒绝组队邀请' });
        const reqFrom = Number(row.fromUserId || 0);
        const reqTo = Number(row.toUserId || 0);
        const freshPartyId = partyId || `party-${Date.now()}-${Math.min(reqFrom, reqTo)}-${Math.max(reqFrom, reqTo)}`;
        db.prepare(`UPDATE users SET partyId = ?, updatedAt = ? WHERE id IN (?, ?)`).run(freshPartyId, ts, reqFrom, reqTo);
        return res.json({ success: true, status: 'accepted', partyId: freshPartyId, message: '已同意组队，行动已绑定' });
      }

      if (requestType === 'join_vote') {
        const allRows = db.prepare(`SELECT * FROM party_requests WHERE batchKey = ? ORDER BY id ASC`).all(batchKey) as AnyRow[];
        const anyReject = allRows.some((x) => String(x.status || '') === 'rejected');
        const allAccepted = allRows.length > 0 && allRows.every((x) => String(x.status || '') === 'accepted');
        if (anyReject) {
          db.prepare(`UPDATE party_requests SET status = 'cancelled', resultMessage = ?, updatedAt = ? WHERE batchKey = ? AND status = 'pending'`)
            .run('有成员拒绝，入队失败', ts, batchKey);
          return res.json({ success: true, status: 'rejected', message: '你已拒绝，入队申请已终止' });
        }
        if (!allAccepted) {
          const acceptedCount = allRows.filter((x) => String(x.status || '') === 'accepted').length;
          return res.json({ success: true, status: 'pending', message: `已记录投票，当前 ${acceptedCount}/${allRows.length}` });
        }
        const applicantId = Number(allRows[0]?.targetUserId || 0);
        const finalPartyId = String(allRows[0]?.partyId || '');
        if (!applicantId || !finalPartyId) {
          return res.status(400).json({ success: false, message: 'join vote payload invalid' });
        }
        db.prepare(`UPDATE users SET partyId = ?, updatedAt = ? WHERE id = ?`).run(finalPartyId, ts, applicantId);
        db.prepare(`UPDATE party_requests SET resultMessage = ?, updatedAt = ? WHERE batchKey = ?`)
          .run('投票通过，申请者已入队', ts, batchKey);
        return res.json({ success: true, status: 'accepted', partyId: finalPartyId, message: '投票通过，申请者已入队' });
      }

      if (requestType === 'leave') {
        const allRows = db.prepare(`SELECT * FROM party_requests WHERE batchKey = ? ORDER BY id ASC`).all(batchKey) as AnyRow[];
        const proposerId = Number(allRows[0]?.fromUserId || 0);
        const anyReject = allRows.some((x) => String(x.status || '') === 'rejected');
        const allAccepted = allRows.length > 0 && allRows.every((x) => String(x.status || '') === 'accepted');
        if (anyReject) {
          db.prepare(`UPDATE users SET partyId = NULL, updatedAt = ? WHERE id = ?`).run(ts, proposerId);
          const rejecters = allRows.filter((x) => String(x.status || '') === 'rejected').map((x) => Number(x.toUserId || 0)).filter(Boolean);
          for (const rid of rejecters) {
            const pair = normPair(proposerId, rid);
            db.prepare(`
              INSERT INTO party_entanglements(userAId,userBId,sourcePartyId,active,createdAt,updatedAt)
              VALUES(?,?,?,?,?,?)
              ON CONFLICT(userAId,userBId) DO UPDATE SET active=1,sourcePartyId=excluded.sourcePartyId,updatedAt=excluded.updatedAt
            `).run(pair.x, pair.y, partyId, 1, ts, ts);
          }
          db.prepare(`UPDATE party_requests SET status='cancelled', resultMessage=?, updatedAt=? WHERE batchKey=? AND status='pending'`)
            .run('有成员拒绝，发起者脱队并进入纠缠状态', ts, batchKey);
          collapsePartyIfNeeded(db, partyId);
          return res.json({ success: true, status: 'rejected', message: '你拒绝了解绑，双方进入纠缠状态' });
        }
        if (!allAccepted) {
          const acceptedCount = allRows.filter((x) => String(x.status || '') === 'accepted').length;
          return res.json({ success: true, status: 'pending', message: `已记录确认，当前 ${acceptedCount}/${allRows.length}` });
        }
        db.prepare(`UPDATE users SET partyId = NULL, updatedAt = ? WHERE partyId = ?`).run(ts, partyId);
        db.prepare(`UPDATE party_requests SET resultMessage=?, updatedAt=? WHERE batchKey=?`).run('全员同意，队伍已解除', ts, batchKey);
        return res.json({ success: true, status: 'accepted', message: '全员同意，队伍已解除' });
      }

      if (requestType === 'follow') {
        const payload = (() => { try { return JSON.parse(String(row.payloadJson || '{}')); } catch { return {}; } })();
        const dest = String(payload.locationId || '').trim();
        if (accept && dest) {
          db.prepare(`UPDATE users SET currentLocation = ?, updatedAt = ? WHERE id = ?`).run(dest, ts, userId);
          return res.json({ success: true, status: 'accepted', message: `已跟随至 ${dest}` });
        }
        db.prepare(`UPDATE users SET partyId = NULL, updatedAt = ? WHERE id = ?`).run(ts, userId);
        collapsePartyIfNeeded(db, partyId);
        return res.json({ success: true, status: 'rejected', message: '你拒绝了跟随，已解除组队' });
      }

      return res.status(400).json({ success: false, message: 'unsupported request type' });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e?.message || 'party respond failed' });
    }
  });

  r.get('/party/entangle/:userId', (req, res) => {
    try {
      const userId = Number(req.params.userId);
      if (!userId) return res.status(400).json({ success: false, message: 'invalid userId' });
      const rows = db.prepare(`
        SELECT
          e.id,
          e.userAId,
          e.userBId,
          e.sourcePartyId,
          e.active,
          e.updatedAt,
          ua.name AS userAName,
          ub.name AS userBName
        FROM party_entanglements e
        LEFT JOIN users ua ON ua.id = e.userAId
        LEFT JOIN users ub ON ub.id = e.userBId
        WHERE e.active = 1
          AND (e.userAId = ? OR e.userBId = ?)
        ORDER BY e.id DESC
      `).all(userId, userId) as AnyRow[];
      const list = rows.map((x) => {
        const a = Number(x.userAId || 0);
        const b = Number(x.userBId || 0);
        const otherUserId = a === userId ? b : a;
        const otherUserName = a === userId ? String(x.userBName || '') : String(x.userAName || '');
        return {
          id: Number(x.id),
          userAId: a,
          userBId: b,
          sourcePartyId: String(x.sourcePartyId || ''),
          otherUserId,
          otherUserName,
          updatedAt: String(x.updatedAt || '')
        };
      });
      res.json({ success: true, entanglements: list });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e?.message || 'entanglement query failed', entanglements: [] });
    }
  });

  r.post('/party/entangle/resolve', (req, res) => {
    try {
      const userId = Number(req.body?.userId);
      const otherUserId = Number(req.body?.otherUserId);
      const continueEntangle = Boolean(req.body?.continueEntangle);
      if (!userId || !otherUserId) return res.status(400).json({ success: false, message: 'invalid params' });
      const pair = normPair(userId, otherUserId);
      const row = db.prepare(`SELECT * FROM party_entanglements WHERE userAId=? AND userBId=? LIMIT 1`).get(pair.x, pair.y) as AnyRow | undefined;
      if (!row) return res.status(404).json({ success: false, message: 'entanglement not found' });
      db.prepare(`UPDATE party_entanglements SET active=?, updatedAt=? WHERE userAId=? AND userBId=?`)
        .run(continueEntangle ? 1 : 0, nowIso(), pair.x, pair.y);
      res.json({
        success: true,
        active: continueEntangle,
        message: continueEntangle ? '仍保持纠缠关系' : '已解除纠缠关系'
      });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e?.message || 'entanglement resolve failed' });
    }
  });

  r.post('/party/toggle', (req, res) => {
    try {
      const userId = Number(req.body?.userId);
      const targetId = Number(req.body?.targetId);
      if (!userId || !targetId) return res.status(400).json({ success: false, message: 'invalid params' });
      if (userId === targetId) return res.status(400).json({ success: false, message: 'cannot party with self' });

      const me = getUser(db, userId);
      const target = getUser(db, targetId);
      if (!me || !target) return res.status(404).json({ success: false, message: 'user not found' });

      const myParty = String(me.partyId || '').trim();
      const targetParty = String(target.partyId || '').trim();
      if (myParty && targetParty && myParty === targetParty) {
        db.prepare(`UPDATE users SET partyId = NULL, updatedAt=? WHERE partyId = ?`).run(nowIso(), myParty);
        return res.json({ success: true, joined: false, message: 'party disbanded' });
      }

      const partyId = myParty || targetParty || `party-${Date.now()}-${Math.min(userId, targetId)}-${Math.max(userId, targetId)}`;
      db.prepare(`UPDATE users SET partyId = ?, updatedAt=? WHERE id IN (?, ?)`).run(partyId, nowIso(), userId, targetId);
      res.json({ success: true, joined: true, partyId, message: 'party formed' });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e?.message || 'party toggle failed' });
    }
  });

  r.post('/party/leave', (req, res) => {
    try {
      const userId = Number(req.body?.userId);
      if (!userId) return res.status(400).json({ success: false, message: 'invalid userId' });
      const me = getUser(db, userId);
      if (!me) return res.status(404).json({ success: false, message: 'user not found' });
      const partyId = String(me.partyId || '').trim();
      if (!partyId) return res.json({ success: true, message: 'not in party' });
      db.prepare(`UPDATE users SET partyId = NULL, updatedAt=? WHERE id=?`).run(nowIso(), userId);

      const left = db.prepare(`SELECT id FROM users WHERE partyId = ?`).all(partyId) as AnyRow[];
      if (left.length <= 1) db.prepare(`UPDATE users SET partyId = NULL, updatedAt=? WHERE partyId = ?`).run(nowIso(), partyId);
      res.json({ success: true, message: 'left party' });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e?.message || 'party leave failed' });
    }
  });

  r.get('/party/status/:userId', (req, res) => {
    try {
      const userId = Number(req.params.userId);
      if (!userId) return res.status(400).json({ success: false, message: 'invalid userId' });
      const me = getUser(db, userId);
      if (!me) return res.status(404).json({ success: false, message: 'user not found' });
      const partyId = String(me.partyId || '').trim();
      if (!partyId) return res.json({ success: true, partyId: null, members: [] });
      const members = db.prepare(`SELECT id,name,role,currentLocation,partyId FROM users WHERE partyId = ?`).all(partyId) as AnyRow[];
      res.json({ success: true, partyId, members });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e?.message || 'party status failed' });
    }
  });

  r.post('/growth/advance', (req, res) => {
    try {
      const userId = Number(req.body?.userId);
      const action = String(req.body?.action || '').trim();
      const enrollStudent = Boolean(req.body?.enrollStudent);
      if (!userId || !action) return res.status(400).json({ success: false, message: 'invalid params' });

      const user = getUser(db, userId);
      if (!user) return res.status(404).json({ success: false, message: 'user not found' });

      const age = Number(user.age || 0);
      const roleText = String(user.role || '').trim();
      if (action === 'minor_to_student') {
        const canDifferentiate = age < 16 || roleText === '未分化';
        if (!canDifferentiate) return res.status(400).json({ success: false, message: 'already reached student stage' });

        const nextAge = age < 16 ? 16 + Math.floor(Math.random() * 4) : Math.min(19, Math.max(16, age || 16));
        let nextRole = roleText;
        if (nextRole === '未分化' || !nextRole) nextRole = randomAdultRole();

        const nextJob = enrollStudent ? '伦敦塔学生' : '';
        const nextLocation = enrollStudent ? 'london_tower' : String(user.currentLocation || 'sanctuary');

        db.prepare(`
          UPDATE users
          SET age = ?, role = ?, job = ?, currentLocation = ?, updatedAt = ?
          WHERE id = ?
        `).run(nextAge, nextRole, nextJob, nextLocation, nowIso(), userId);

        const updated = getUser(db, userId);
        return res.json({
          success: true,
          message: enrollStudent ? 'advanced to student stage and enrolled in london tower' : 'advanced to student stage',
          user: updated
        });
      }

      if (action === 'graduate') {
        if (age >= 20) return res.status(400).json({ success: false, message: 'already graduated' });
        if (age < 16) return res.status(400).json({ success: false, message: 'minor cannot graduate directly' });

        let nextRole = String(user.role || '').trim();
        if (!nextRole || nextRole === '未分化') {
          nextRole = randomAdultRole();
        }
        const currentJob = String(user.job || '');
        const nextJob = currentJob.includes('伦敦塔') && currentJob.includes('学生') ? '' : currentJob;
        db.prepare(`
          UPDATE users
          SET age = 20, role = ?, job = ?, updatedAt = ?
          WHERE id = ?
        `).run(nextRole, nextJob, nowIso(), userId);

        const updated = getUser(db, userId);
        return res.json({ success: true, message: 'graduated', user: updated });
      }

      return res.status(400).json({ success: false, message: 'invalid action' });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e?.message || 'growth advance failed' });
    }
  });

  r.post('/rescue/request', (req, res) => {
    try {
      const patientId = Number(req.body?.patientId);
      const healerId = Number(req.body?.healerId || 0);
      if (!patientId) return res.status(400).json({ success: false, message: 'invalid patientId' });
      const existing = db.prepare(`SELECT * FROM rescue_requests WHERE patientId=? AND status='pending' ORDER BY id DESC LIMIT 1`).get(patientId) as AnyRow | undefined;
      if (existing) return res.json({ success: true, requestId: Number(existing.id), message: 'already requested' });
      const ret = db.prepare(`INSERT INTO rescue_requests(patientId,healerId,status,createdAt,updatedAt) VALUES(?,?,?,?,?)`).run(patientId, healerId, 'pending', nowIso(), nowIso());
      res.json({ success: true, requestId: Number(ret.lastInsertRowid || 0) });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e?.message || 'rescue request failed' });
    }
  });

  r.get('/rescue/check/:patientId', (req, res) => {
    try {
      const patientId = Number(req.params.patientId);
      if (!patientId) return res.status(400).json({ success: false, message: 'invalid patientId' });
      const outgoing = db.prepare(`SELECT * FROM rescue_requests WHERE patientId=? ORDER BY id DESC LIMIT 1`).get(patientId) as AnyRow | undefined;
      res.json({ success: true, outgoing: outgoing || null });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e?.message || 'rescue check failed' });
    }
  });

  r.post('/rescue/confirm', (req, res) => {
    try {
      const patientId = Number(req.body?.patientId);
      if (!patientId) return res.status(400).json({ success: false, message: 'invalid patientId' });
      db.prepare(`UPDATE users SET hp = MAX(1, hp), updatedAt=? WHERE id=?`).run(nowIso(), patientId);
      db.prepare(`UPDATE rescue_requests SET status='accepted', updatedAt=? WHERE patientId=? AND status='pending'`).run(nowIso(), patientId);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e?.message || 'rescue confirm failed' });
    }
  });

  r.post('/users/:id/submit-death', (req, res) => {
    try {
      const id = Number(req.params.id);
      const type = String(req.body?.type || '');
      const text = String(req.body?.text || '');
      if (!id || !type) return res.status(400).json({ success: false, message: 'invalid params' });
      const status = type === 'pending_ghost' ? 'pending_ghost' : 'pending_death';
      const user = getUser(db, id);
      if (!user) return res.status(404).json({ success: false, message: 'user not found' });
      db.prepare(`UPDATE users SET status=?, deathDescription=?, updatedAt=? WHERE id=?`).run(status, text, nowIso(), id);
      if (status === 'pending_death') {
        db.prepare(
          `
            INSERT INTO graveyard_tombstones(userId,name,deathDescription,role,mentalRank,physicalRank,ability,spiritName,isHidden,createdAt)
            VALUES(?,?,?,?,?,?,?,?,?,?)
          `
        ).run(
          id,
          String(user.name || ''),
          text,
          String(user.role || ''),
          String(user.mentalRank || ''),
          String(user.physicalRank || ''),
          String(user.ability || ''),
          String(user.spiritName || ''),
          Number(user.isHidden || 0),
          nowIso()
        );
      }
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e?.message || 'submit death failed' });
    }
  });

  r.get('/graveyard', (_req, res) => {
    try {
      const rows = db.prepare(`
        SELECT id, userId, name, deathDescription, role, mentalRank, physicalRank, ability, spiritName, isHidden, createdAt
        FROM graveyard_tombstones
        ORDER BY id DESC
      `).all() as AnyRow[];
      res.json({ success: true, tombstones: rows });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e?.message || 'graveyard query failed', tombstones: [] });
    }
  });

  r.get('/graveyard/:tombstoneId/comments', (req, res) => {
    try {
      const tombstoneId = Number(req.params.tombstoneId);
      if (!tombstoneId) return res.status(400).json({ success: false, message: 'invalid tombstoneId' });
      const comments = db.prepare(`SELECT * FROM graveyard_comments WHERE tombstoneId=? ORDER BY id DESC`).all(tombstoneId) as AnyRow[];
      res.json({ success: true, comments });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e?.message || 'comments query failed', comments: [] });
    }
  });

  r.post('/graveyard/:tombstoneId/comments', (req, res) => {
    try {
      const tombstoneId = Number(req.params.tombstoneId);
      const userId = Number(req.body?.userId);
      const userName = String(req.body?.userName || '').trim();
      const content = String(req.body?.content || '').trim();
      if (!tombstoneId || !userId || !userName || !content) return res.status(400).json({ success: false, message: 'invalid params' });
      db.prepare(`INSERT INTO graveyard_comments(tombstoneId,userId,userName,content,createdAt) VALUES(?,?,?,?,?)`).run(tombstoneId, userId, userName, content, nowIso());
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e?.message || 'add comment failed' });
    }
  });

  r.delete('/graveyard/comments/:commentId', (req, res) => {
    try {
      const commentId = Number(req.params.commentId);
      const userId = Number(req.body?.userId);
      if (!commentId || !userId) return res.status(400).json({ success: false, message: 'invalid params' });
      const row = db.prepare(`SELECT userId FROM graveyard_comments WHERE id=?`).get(commentId) as AnyRow | undefined;
      if (!row) return res.status(404).json({ success: false, message: 'comment not found' });
      if (Number(row.userId) !== userId) return res.status(403).json({ success: false, message: 'forbidden' });
      db.prepare(`DELETE FROM graveyard_comments WHERE id=?`).run(commentId);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e?.message || 'delete comment failed' });
    }
  });

  // ──────────────────────────────────────────────────────────────
  // 鬼魂光环：同一位置的非鬼魂玩家 MP 缓慢衰减（不清零，保底 1）
  // POST /api/ghost/aura/tick  { userId }
  // ──────────────────────────────────────────────────────────────
  r.post('/ghost/aura/tick', (req, res) => {
    try {
      const userId = Number(req.body?.userId || 0);
      if (!userId) return res.status(400).json({ success: false, message: 'invalid userId' });

      const me = getUser(db, userId);
      if (!me) return res.status(404).json({ success: false, message: 'user not found' });
      if (String(me.status || '') !== 'ghost') {
        return res.json({ success: true, drained: false, message: '非鬼魂，无光环效果' });
      }

      const myLoc = String(me.currentLocation || '');
      if (!myLoc) return res.json({ success: true, drained: false, message: '未定位，跳过' });

      // 同区域 10 分钟内有活动的非鬼魂在线玩家（跳过持有辟邪符免疫的玩家）
      const cutoff = new Date(Date.now() - 10 * 60 * 1000).toISOString();
      const targets = db.prepare(`
        SELECT id, mp
        FROM users
        WHERE currentLocation = ?
          AND id != ?
          AND status = 'approved'
          AND updatedAt > ?
          AND (ghostImmuneUntil IS NULL OR ghostImmuneUntil < ?)
      `).all(myLoc, userId, cutoff, nowIso()) as AnyRow[];

      const DRAIN = 2;
      const MIN_MP = 1;
      let drainedCount = 0;

      for (const t of targets) {
        const curMp = Math.max(0, Number(t.mp ?? 0));
        const newMp = Math.max(MIN_MP, curMp - DRAIN);
        if (newMp < curMp) {
          db.prepare(`UPDATE users SET mp=?, updatedAt=? WHERE id=?`).run(newMp, nowIso(), Number(t.id));
          drainedCount++;
        }
      }

      res.json({ success: true, drained: drainedCount > 0, drainedCount, message: `鬼魂光环影响了 ${drainedCount} 名玩家` });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e?.message || 'ghost aura tick failed' });
    }
  });

  // ──────────────────────────────────────────────────────────────
  // 繁荣度竞争结算：高繁荣度市长从低繁荣度市长扣 10%
  // POST /api/market/prosperity/settle  { initiatorId }
  // ──────────────────────────────────────────────────────────────
  r.post('/market/prosperity/settle', (req, res) => {
    try {
      const initiatorId = Number(req.body?.initiatorId || 0);
      if (!initiatorId) return res.status(400).json({ success: false, message: 'invalid initiatorId' });

      const eastMayor = db.prepare(`SELECT id, name, gold FROM users WHERE job='东区市长' AND status='approved' LIMIT 1`).get() as AnyRow | undefined;
      const westMayor = db.prepare(`SELECT id, name, gold FROM users WHERE job='西区市长' AND status='approved' LIMIT 1`).get() as AnyRow | undefined;

      if (!eastMayor || !westMayor) {
        return res.json({ success: false, message: '东西市必须各有一位市长才能发起竞争结算' });
      }

      const CUTOFF = new Date(Date.now() - 10 * 60 * 1000).toISOString();
      const eastCount = (db.prepare(`SELECT COUNT(*) as cnt FROM users WHERE currentLocation='rich_area' AND status='approved' AND updatedAt>?`).get(CUTOFF) as AnyRow).cnt as number;
      const westCount = (db.prepare(`SELECT COUNT(*) as cnt FROM users WHERE currentLocation='slums' AND status='approved' AND updatedAt>?`).get(CUTOFF) as AnyRow).cnt as number;

      const eastPros = eastCount * 1000;
      const westPros = westCount * 100;

      if (eastPros === westPros) {
        return res.json({ success: false, message: '双方繁荣度相同，无需结算' });
      }

      const winner = eastPros > westPros ? eastMayor : westMayor;
      const loser  = eastPros > westPros ? westMayor : eastMayor;

      if (Number(initiatorId) !== Number(winner.id)) {
        return res.status(403).json({ success: false, message: '只有繁荣度更高的市长才能发起结算' });
      }

      const loserGold = Math.max(0, Number(loser.gold || 0));
      const take = Math.floor(loserGold * 0.1);
      if (take <= 0) {
        return res.json({ success: false, message: '对方市长资金不足，无法扣除' });
      }

      db.prepare(`UPDATE users SET gold=gold-?, updatedAt=? WHERE id=?`).run(take, nowIso(), Number(loser.id));
      db.prepare(`UPDATE users SET gold=gold+?, updatedAt=? WHERE id=?`).run(take, nowIso(), Number(winner.id));

      res.json({
        success: true,
        take,
        winnerName: String(winner.name || ''),
        loserName: String(loser.name || ''),
        message: `结算成功！从 ${loser.name} 征收 ${take} G 转入 ${winner.name} 账户`
      });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e?.message || 'prosperity settle failed' });
    }
  });

  // ──────────────────────────────────────────────────────────────
  // 职位挑战：发起 / 投票 / 查询
  // ──────────────────────────────────────────────────────────────

  // 发起挑战 POST /api/job/challenge
  r.post('/job/challenge', (req, res) => {
    try {
      const challengerId = Number(req.body?.challengerId || 0);
      const targetJobName = String(req.body?.targetJobName || '').trim();
      if (!challengerId || !targetJobName) return res.status(400).json({ success: false, message: 'invalid params' });

      const challenger = getUser(db, challengerId);
      if (!challenger) return res.status(404).json({ success: false, message: 'challenger not found' });

      const holder = db.prepare(`SELECT id, name FROM users WHERE job=? AND status='approved' LIMIT 1`).get(targetJobName) as AnyRow | undefined;
      if (!holder) return res.status(409).json({ success: false, message: '该职位暂无人占据，直接申请入职即可' });
      if (Number(holder.id) === challengerId) return res.status(400).json({ success: false, message: '不能挑战自己' });

      const existing = db.prepare(`SELECT id FROM job_challenges WHERE targetJobName=? AND status='voting' LIMIT 1`).get(targetJobName) as AnyRow | undefined;
      if (existing) return res.status(409).json({ success: false, message: '该职位已有进行中的挑战，请等待结束' });

      const challengeId = (db.prepare(`
        INSERT INTO job_challenges(challengerId, holderId, targetJobName, status, createdAt, updatedAt)
        VALUES(?,?,?,?,?,?)
      `).run(challengerId, Number(holder.id), targetJobName, 'voting', nowIso(), nowIso()) as any).lastInsertRowid;

      res.json({ success: true, challengeId: Number(challengeId), holderName: String(holder.name || ''), message: `已对 ${holder.name} 发起 [${targetJobName}] 职位挑战，等待同阵营玩家投票` });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e?.message || 'job challenge failed' });
    }
  });

  // 投票 POST /api/job/challenge/vote
  r.post('/job/challenge/vote', (req, res) => {
    try {
      const challengeId = Number(req.body?.challengeId || 0);
      const voterId = Number(req.body?.voterId || 0);
      const vote = String(req.body?.vote || '');
      if (!challengeId || !voterId || !['challenger', 'holder'].includes(vote)) {
        return res.status(400).json({ success: false, message: 'invalid params' });
      }

      const challenge = db.prepare(`SELECT * FROM job_challenges WHERE id=? LIMIT 1`).get(challengeId) as AnyRow | undefined;
      if (!challenge || String(challenge.status || '') !== 'voting') {
        return res.status(404).json({ success: false, message: '挑战不存在或已结束' });
      }

      const voter = getUser(db, voterId);
      const challengerRow = db.prepare(`SELECT faction FROM users WHERE id=? LIMIT 1`).get(Number(challenge.challengerId)) as AnyRow | undefined;
      if (!voter || !challengerRow || String(voter.faction || '') !== String(challengerRow.faction || '')) {
        return res.status(403).json({ success: false, message: '只有同阵营成员才能投票' });
      }

      const dup = db.prepare(`SELECT id FROM job_challenge_votes WHERE challengeId=? AND voterId=? LIMIT 1`).get(challengeId, voterId);
      if (dup) return res.status(409).json({ success: false, message: '您已投过票' });

      db.prepare(`INSERT INTO job_challenge_votes(challengeId, voterId, vote, createdAt) VALUES(?,?,?,?)`).run(challengeId, voterId, vote, nowIso());

      const cutoff = new Date(Date.now() - 10 * 60 * 1000).toISOString();
      const factionSize = Math.max(1, (db.prepare(`SELECT COUNT(*) as cnt FROM users WHERE faction=? AND status='approved' AND updatedAt>?`).get(String(challengerRow.faction || ''), cutoff) as AnyRow).cnt as number);
      const voteCounts = db.prepare(`SELECT vote, COUNT(*) as cnt FROM job_challenge_votes WHERE challengeId=? GROUP BY vote`).all(challengeId) as AnyRow[];
      const forChallenger = Number(voteCounts.find((v: AnyRow) => v.vote === 'challenger')?.cnt || 0);
      const forHolder = Number(voteCounts.find((v: AnyRow) => v.vote === 'holder')?.cnt || 0);
      const totalVotes = forChallenger + forHolder;

      let message = `投票成功。当前：挑战者 ${forChallenger} 票 vs 现任 ${forHolder} 票（共 ${factionSize} 名在线成员）`;
      let settled = false;

      if (totalVotes >= Math.max(1, Math.ceil(factionSize / 2))) {
        const winnerId = forChallenger >= forHolder ? Number(challenge.challengerId) : Number(challenge.holderId);
        const loserId  = forChallenger >= forHolder ? Number(challenge.holderId)    : Number(challenge.challengerId);
        const winner = getUser(db, winnerId);
        const loser  = getUser(db, loserId);

        const targetJob = String(challenge.targetJobName || '');
        const winnerOldJob = String(winner?.job || '无');

        db.prepare(`UPDATE users SET job=?, updatedAt=? WHERE id=?`).run(targetJob, nowIso(), winnerId);
        db.prepare(`UPDATE users SET job=?, updatedAt=? WHERE id=?`).run(winnerOldJob === targetJob ? '无' : winnerOldJob, nowIso(), loserId);
        db.prepare(`UPDATE job_challenges SET status='settled', updatedAt=? WHERE id=?`).run(nowIso(), challengeId);

        settled = true;
        message = `投票结束！${winner?.name || '挑战者'} 赢得 [${targetJob}]，${loser?.name || '现任'} 接任原职位`;
      }

      res.json({ success: true, forChallenger, forHolder, settled, message });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e?.message || 'vote failed' });
    }
  });

  // 查询活跃挑战 GET /api/job/challenge/active?jobName=xxx
  r.get('/job/challenge/active', (req, res) => {
    try {
      const jobName = String(req.query?.jobName || '').trim();
      if (!jobName) return res.status(400).json({ success: false, message: 'missing jobName' });
      const row = db.prepare(`SELECT * FROM job_challenges WHERE targetJobName=? AND status='voting' LIMIT 1`).get(jobName) as AnyRow | undefined;
      if (!row) return res.json({ success: true, active: false });
      const votes = db.prepare(`SELECT vote, COUNT(*) as cnt FROM job_challenge_votes WHERE challengeId=? GROUP BY vote`).all(Number(row.id)) as AnyRow[];
      const forChallenger = Number(votes.find((v: AnyRow) => v.vote === 'challenger')?.cnt || 0);
      const forHolder = Number(votes.find((v: AnyRow) => v.vote === 'holder')?.cnt || 0);
      res.json({ success: true, active: true, challenge: { ...row, forChallenger, forHolder } });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e?.message || 'query challenge failed' });
    }
  });

  return r;
}



import { Router } from 'express';
import { AppContext } from '../types';

type AnyRow = Record<string, any>;

const nowIso = () => new Date().toISOString();
const todayKey = () => nowIso().slice(0, 10);
const afterSecondsIso = (seconds: number) => new Date(Date.now() + seconds * 1000).toISOString();
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
const toInt = (v: any) => Math.trunc(Number(v || 0));

const BANK_INTEREST_RATE = 0.001; // 0.1% / day
const TAVERN_AUCTION_SECONDS = 90;
const BANK_RARE_AUCTION_SECONDS = 300;
const AUCTION_HOUSE_DAILY_SECONDS = 24 * 3600;
const PLAYER_LISTING_SECONDS = 24 * 3600;
const STALL_RENT_GOLD = 120;
const CUSTOM_LISTING_FEE = 30;
const PLAYER_SALE_TAX_RATE = 0.1;

const COMMISSION_GRADES = ['D', 'C', 'B', 'A', 'S'] as const;
const COMMISSION_KIND_SET = new Set(['normal', 'assassination']);
const COMMISSION_GRADE_CONFIG: Record<string, { minReward: number; score: number }> = {
  D: { minReward: 80, score: 1 },
  C: { minReward: 150, score: 2 },
  B: { minReward: 280, score: 4 },
  A: { minReward: 520, score: 7 },
  S: { minReward: 1000, score: 11 }
};
const ADVENTURER_LEVELS = [
  { level: 1, title: '见习冒险者', minScore: 0, rewardBonusRate: 0 },
  { level: 2, title: '青铜冒险者', minScore: 8, rewardBonusRate: 0.05 },
  { level: 3, title: '白银冒险者', minScore: 20, rewardBonusRate: 0.1 },
  { level: 4, title: '黄金冒险者', minScore: 42, rewardBonusRate: 0.15 },
  { level: 5, title: '白金冒险者', minScore: 72, rewardBonusRate: 0.2 },
  { level: 6, title: '秘银冒险者', minScore: 110, rewardBonusRate: 0.25 },
  { level: 7, title: '传奇冒险者', minScore: 160, rewardBonusRate: 0.3 }
] as const;
const OBSERVER_JOBS = new Set(['观察者首领', '情报搜集员', '情报处理员']);

function ensureTables(db: any) {
  db.exec(`
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

    CREATE TABLE IF NOT EXISTS guild_bank_accounts (
      userId INTEGER PRIMARY KEY,
      balance INTEGER DEFAULT 0,
      lastInterestDate TEXT DEFAULT '',
      updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS guild_auctions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      channel TEXT NOT NULL,
      title TEXT DEFAULT '',
      sourceType TEXT DEFAULT 'npc',
      sellerUserId INTEGER DEFAULT 0,
      itemId INTEGER DEFAULT 0,
      itemName TEXT NOT NULL,
      itemDescription TEXT DEFAULT '',
      itemType TEXT DEFAULT '贵重物品',
      itemTier TEXT DEFAULT '低阶',
      effectValue INTEGER DEFAULT 0,
      startPrice INTEGER DEFAULT 0,
      minIncrement INTEGER DEFAULT 10,
      currentPrice INTEGER DEFAULT 0,
      highestBidderId INTEGER DEFAULT 0,
      endAt TEXT NOT NULL,
      status TEXT DEFAULT 'open',
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
      updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS guild_auction_bids (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      auctionId INTEGER NOT NULL,
      userId INTEGER NOT NULL,
      bidAmount INTEGER NOT NULL,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS guild_market_stalls (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER NOT NULL UNIQUE,
      expiresAt TEXT NOT NULL,
      status TEXT DEFAULT 'active',
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
      updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS guild_daily_limits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER NOT NULL,
      dateKey TEXT NOT NULL,
      action TEXT NOT NULL,
      count INTEGER DEFAULT 0,
      updatedAt TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(userId, dateKey, action)
    );

    CREATE TABLE IF NOT EXISTS guild_alley_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER NOT NULL,
      resultType TEXT DEFAULT 'none',
      resultText TEXT DEFAULT '',
      rolledAt TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS observer_library_auction_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      auctionId INTEGER NOT NULL,
      channel TEXT DEFAULT '',
      title TEXT DEFAULT '',
      itemName TEXT DEFAULT '',
      itemDescription TEXT DEFAULT '',
      itemTier TEXT DEFAULT '',
      itemType TEXT DEFAULT '',
      finalPrice INTEGER DEFAULT 0,
      winnerUserId INTEGER DEFAULT 0,
      winnerName TEXT DEFAULT '',
      sellerUserId INTEGER DEFAULT 0,
      sellerName TEXT DEFAULT '',
      status TEXT DEFAULT '',
      archivedAt TEXT DEFAULT CURRENT_TIMESTAMP,
      extraJson TEXT DEFAULT '{}'
    );

    CREATE TABLE IF NOT EXISTS observer_library_books (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT DEFAULT '',
      content TEXT DEFAULT '',
      authorUserId INTEGER NOT NULL,
      authorName TEXT DEFAULT '',
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
      updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS guild_commissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      publisherUserId INTEGER NOT NULL,
      publisherName TEXT DEFAULT '',
      title TEXT NOT NULL,
      content TEXT DEFAULT '',
      grade TEXT DEFAULT 'D',
      kind TEXT DEFAULT 'normal',
      rewardGold INTEGER DEFAULT 0,
      status TEXT DEFAULT 'open',
      assigneeUserId INTEGER DEFAULT 0,
      assigneeName TEXT DEFAULT '',
      acceptedAt TEXT DEFAULT '',
      completedAt TEXT DEFAULT '',
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
      updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS guild_adventurer_stats (
      userId INTEGER PRIMARY KEY,
      level INTEGER DEFAULT 1,
      title TEXT DEFAULT '见习冒险者',
      score INTEGER DEFAULT 0,
      completedTotal INTEGER DEFAULT 0,
      completedD INTEGER DEFAULT 0,
      completedC INTEGER DEFAULT 0,
      completedB INTEGER DEFAULT 0,
      completedA INTEGER DEFAULT 0,
      completedS INTEGER DEFAULT 0,
      updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

function isObserverJob(jobRaw: any) {
  return OBSERVER_JOBS.has(String(jobRaw || '').trim());
}

function getUser(db: any, userId: number) {
  return db.prepare(`SELECT * FROM users WHERE id = ? LIMIT 1`).get(userId) as AnyRow | undefined;
}

function ensureBankAccount(db: any, userId: number) {
  db.prepare(`
    INSERT OR IGNORE INTO guild_bank_accounts(userId, balance, lastInterestDate, updatedAt)
    VALUES (?, 0, '', ?)
  `).run(userId, nowIso());
  return db.prepare(`SELECT * FROM guild_bank_accounts WHERE userId = ? LIMIT 1`).get(userId) as AnyRow;
}

function addInventoryItem(db: any, userId: number, name: string, itemType = 'consumable', qty = 1, description = '', effectValue = 0) {
  const row = db
    .prepare(`SELECT id FROM inventory WHERE userId = ? AND name = ? AND itemType = ? LIMIT 1`)
    .get(userId, name, itemType) as AnyRow | undefined;
  if (row?.id) {
    db.prepare(`UPDATE inventory SET qty = qty + ? WHERE id = ?`).run(Math.max(1, qty), Number(row.id));
    return;
  }
  db.prepare(`
    INSERT INTO inventory(userId, name, description, qty, itemType, effectValue, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(userId, name, description, Math.max(1, qty), itemType, Number(effectValue || 0), nowIso());
}

function markDailyLimit(db: any, userId: number, action: string, add = 1, day = todayKey()) {
  db.prepare(`
    INSERT INTO guild_daily_limits(userId, dateKey, action, count, updatedAt)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(userId, dateKey, action)
    DO UPDATE SET count = count + excluded.count, updatedAt = excluded.updatedAt
  `).run(userId, day, action, Math.max(1, add), nowIso());
}

function getDailyCount(db: any, userId: number, action: string, day = todayKey()) {
  const row = db.prepare(`
    SELECT count
    FROM guild_daily_limits
    WHERE userId = ? AND dateKey = ? AND action = ?
    LIMIT 1
  `).get(userId, day, action) as AnyRow | undefined;
  return Number(row?.count || 0);
}

function normalizeCommissionGrade(raw: any) {
  const grade = String(raw || '').trim().toUpperCase();
  return COMMISSION_GRADES.includes(grade as any) ? grade : 'D';
}

function normalizeCommissionKind(raw: any) {
  const kind = String(raw || 'normal').trim().toLowerCase();
  return COMMISSION_KIND_SET.has(kind) ? kind : 'normal';
}

function levelByScore(score: number): (typeof ADVENTURER_LEVELS)[number] {
  let picked: (typeof ADVENTURER_LEVELS)[number] = ADVENTURER_LEVELS[0];
  for (const row of ADVENTURER_LEVELS) {
    if (score >= row.minScore) picked = row;
  }
  return picked;
}

function ensureAdventurerStats(db: any, userId: number) {
  db.prepare(`
    INSERT OR IGNORE INTO guild_adventurer_stats(
      userId, level, title, score, completedTotal,
      completedD, completedC, completedB, completedA, completedS, updatedAt
    )
    VALUES (?, 1, '见习冒险者', 0, 0, 0, 0, 0, 0, 0, ?)
  `).run(userId, nowIso());
  return db.prepare(`SELECT * FROM guild_adventurer_stats WHERE userId = ? LIMIT 1`).get(userId) as AnyRow;
}

function archiveAuctionToObserverLibrary(db: any, row: AnyRow, finalPrice: number, winnerId: number, winnerName: string) {
  const sellerId = Number(row.sellerUserId || 0);
  const sellerName = sellerId > 0 ? String((getUser(db, sellerId)?.name || '')) : '';
  db.prepare(`
    INSERT INTO observer_library_auction_logs(
      auctionId, channel, title, itemName, itemDescription, itemTier, itemType, finalPrice,
      winnerUserId, winnerName, sellerUserId, sellerName, status, archivedAt, extraJson
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    Number(row.id || 0),
    String(row.channel || ''),
    String(row.title || ''),
    String(row.itemName || ''),
    String(row.itemDescription || ''),
    String(row.itemTier || ''),
    String(row.itemType || ''),
    Math.max(0, Number(finalPrice || 0)),
    Math.max(0, Number(winnerId || 0)),
    String(winnerName || ''),
    sellerId,
    sellerName,
    String(row.status || ''),
    nowIso(),
    JSON.stringify({
      sourceType: String(row.sourceType || 'npc'),
      startPrice: Number(row.startPrice || 0),
      minIncrement: Number(row.minIncrement || 0),
      createdAt: String(row.createdAt || ''),
      endAt: String(row.endAt || '')
    })
  );
}

function pickItemForAuction(db: any, mode: 'tavern' | 'bank' | 'daily') {
  const tavernSql = `
    SELECT id, name, description, itemType, tier, effectValue, price
    FROM items
    WHERE (
      locationTag = 'guild'
      OR locationTag = 'all'
      OR locationTag LIKE '%guild%'
      OR locationTag = ''
    )
      AND tier IN ('低阶', '中阶')
    ORDER BY RANDOM()
    LIMIT 1
  `;
  const bankSql = `
    SELECT id, name, description, itemType, tier, effectValue, price
    FROM items
    WHERE (
      locationTag = 'guild'
      OR locationTag = 'all'
      OR locationTag LIKE '%guild%'
      OR locationTag = ''
    )
      AND tier IN ('中阶', '高阶')
    ORDER BY RANDOM()
    LIMIT 1
  `;
  const dailySql = `
    SELECT id, name, description, itemType, tier, effectValue, price
    FROM items
    WHERE (
      locationTag = 'guild'
      OR locationTag = 'all'
      OR locationTag LIKE '%guild%'
      OR locationTag = ''
    )
    ORDER BY price DESC, RANDOM()
    LIMIT 1
  `;
  const fallbackSql = `
    SELECT id, name, description, itemType, tier, effectValue, price
    FROM items
    ORDER BY RANDOM()
    LIMIT 1
  `;
  const sql = mode === 'tavern' ? tavernSql : mode === 'bank' ? bankSql : dailySql;
  const row = db.prepare(sql).get() as AnyRow | undefined;
  if (row) return row;
  const fallback = db.prepare(fallbackSql).get() as AnyRow | undefined;
  if (fallback) return fallback;
  return {
    id: 0,
    name: mode === 'bank' ? '珍稀契约残页' : '冒险者补给包',
    description: '系统生成的默认拍卖道具',
    itemType: '贵重物品',
    tier: mode === 'bank' ? '高阶' : '低阶',
    effectValue: mode === 'bank' ? 120 : 30,
    price: mode === 'bank' ? 220 : 60
  };
}

function createAuction(
  db: any,
  payload: {
    channel: string;
    title: string;
    sourceType?: string;
    sellerUserId?: number;
    itemId?: number;
    itemName: string;
    itemDescription?: string;
    itemType?: string;
    itemTier?: string;
    effectValue?: number;
    startPrice: number;
    minIncrement?: number;
    durationSec: number;
  }
) {
  const endAt = afterSecondsIso(Math.max(10, toInt(payload.durationSec)));
  const now = nowIso();
  const ret = db.prepare(`
    INSERT INTO guild_auctions(
      channel, title, sourceType, sellerUserId, itemId, itemName, itemDescription,
      itemType, itemTier, effectValue, startPrice, minIncrement, currentPrice,
      highestBidderId, endAt, status, createdAt, updatedAt
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, 'open', ?, ?)
  `).run(
    String(payload.channel || 'auction_house_daily'),
    String(payload.title || '公会竞拍'),
    String(payload.sourceType || 'npc'),
    Math.max(0, toInt(payload.sellerUserId || 0)),
    Math.max(0, toInt(payload.itemId || 0)),
    String(payload.itemName || '神秘道具'),
    String(payload.itemDescription || ''),
    String(payload.itemType || '贵重物品'),
    String(payload.itemTier || '低阶'),
    Math.max(0, toInt(payload.effectValue || 0)),
    Math.max(1, toInt(payload.startPrice || 1)),
    Math.max(1, toInt(payload.minIncrement || 10)),
    endAt,
    now,
    now
  );
  return Number(ret.lastInsertRowid || 0);
}

function settleEndedAuctions(db: any) {
  const now = nowIso();
  const rows = db.prepare(`
    SELECT *
    FROM guild_auctions
    WHERE status = 'open'
      AND endAt <= ?
    ORDER BY id ASC
    LIMIT 200
  `).all(now) as AnyRow[];

  if (!rows.length) return;

  for (const auction of rows) {
    const auctionId = Number(auction.id || 0);
    if (!auctionId) continue;
    const bids = db.prepare(`
      SELECT id, userId, bidAmount
      FROM guild_auction_bids
      WHERE auctionId = ?
      ORDER BY bidAmount DESC, id DESC
    `).all(auctionId) as AnyRow[];

    let winner: AnyRow | null = null;
    let finalPrice = 0;
    for (const bid of bids) {
      const bidderId = Number(bid.userId || 0);
      const bidAmount = Math.max(0, Number(bid.bidAmount || 0));
      if (!bidderId || !bidAmount) continue;
      const bidder = getUser(db, bidderId);
      if (!bidder) continue;
      if (Number(bidder.gold || 0) < bidAmount) continue;
      winner = bidder;
      finalPrice = bidAmount;
      break;
    }

    const sellerUserId = Math.max(0, Number(auction.sellerUserId || 0));
    const sourceType = String(auction.sourceType || 'npc');

    if (!winner || finalPrice <= 0) {
      const txExpire = db.transaction(() => {
        if (sellerUserId > 0 && (sourceType === 'player' || sourceType === 'custom')) {
          addInventoryItem(
            db,
            sellerUserId,
            String(auction.itemName || '神秘道具'),
            String(auction.itemType || '贵重物品'),
            1,
            String(auction.itemDescription || ''),
            Number(auction.effectValue || 0)
          );
        }
        db.prepare(`
          UPDATE guild_auctions
          SET status = 'expired',
              updatedAt = ?
          WHERE id = ?
        `).run(nowIso(), auctionId);
        archiveAuctionToObserverLibrary(db, { ...auction, status: 'expired' }, 0, 0, '');
      });
      txExpire();
      continue;
    }

    const txClose = db.transaction(() => {
      const winnerId = Number(winner?.id || 0);
      db.prepare(`UPDATE users SET gold = gold - ?, updatedAt = ? WHERE id = ?`).run(finalPrice, nowIso(), winnerId);

      if (sellerUserId > 0 && sellerUserId !== winnerId && (sourceType === 'player' || sourceType === 'custom')) {
        const sellerIncome = Math.max(0, Math.floor(finalPrice * (1 - PLAYER_SALE_TAX_RATE)));
        if (sellerIncome > 0) {
          db.prepare(`UPDATE users SET gold = gold + ?, updatedAt = ? WHERE id = ?`).run(sellerIncome, nowIso(), sellerUserId);
        }
      }

      addInventoryItem(
        db,
        winnerId,
        String(auction.itemName || '神秘道具'),
        String(auction.itemType || '贵重物品'),
        1,
        String(auction.itemDescription || ''),
        Number(auction.effectValue || 0)
      );

      db.prepare(`
        UPDATE guild_auctions
        SET status = 'closed',
            highestBidderId = ?,
            currentPrice = ?,
            updatedAt = ?
        WHERE id = ?
      `).run(winnerId, finalPrice, nowIso(), auctionId);
      archiveAuctionToObserverLibrary(db, { ...auction, status: 'closed' }, finalPrice, winnerId, String(winner?.name || ''));
    });
    txClose();
  }
}

function ensureAutoAuctions(db: any) {
  const now = nowIso();
  const day = todayKey();

  const openTavern = db.prepare(`
    SELECT id
    FROM guild_auctions
    WHERE channel = 'tavern'
      AND status = 'open'
      AND endAt > ?
    LIMIT 1
  `).get(now) as AnyRow | undefined;
  if (!openTavern?.id) {
    const item = pickItemForAuction(db, 'tavern');
    const startPrice = Math.max(50, Number([50, 100][Math.floor(Math.random() * 2)] || 50));
    createAuction(db, {
      channel: 'tavern',
      title: '酒馆临时竞拍（90秒）',
      sourceType: 'npc',
      itemId: Number(item.id || 0),
      itemName: String(item.name || '冒险者补给包'),
      itemDescription: String(item.description || ''),
      itemType: String(item.itemType || '贵重物品'),
      itemTier: String(item.tier || '低阶'),
      effectValue: Number(item.effectValue || 0),
      startPrice,
      minIncrement: 10,
      durationSec: TAVERN_AUCTION_SECONDS
    });
  }

  if (getDailyCount(db, 0, 'bank_daily_auction', day) <= 0) {
    const item = pickItemForAuction(db, 'bank');
    createAuction(db, {
      channel: 'bank_daily',
      title: '银行每日珍稀竞拍（300秒）',
      sourceType: 'npc',
      itemId: Number(item.id || 0),
      itemName: String(item.name || '珍稀契约残页'),
      itemDescription: String(item.description || ''),
      itemType: String(item.itemType || '贵重物品'),
      itemTier: String(item.tier || '高阶'),
      effectValue: Number(item.effectValue || 0),
      startPrice: Math.max(120, Number(item.price || 120)),
      minIncrement: 15,
      durationSec: BANK_RARE_AUCTION_SECONDS
    });
    markDailyLimit(db, 0, 'bank_daily_auction', 1, day);
  }

  if (getDailyCount(db, 0, 'auction_house_daily', day) <= 0) {
    const item = pickItemForAuction(db, 'daily');
    createAuction(db, {
      channel: 'auction_house_daily',
      title: '拍卖行每日系统上新（24h）',
      sourceType: 'npc',
      itemId: Number(item.id || 0),
      itemName: String(item.name || '神秘道具'),
      itemDescription: String(item.description || ''),
      itemType: String(item.itemType || '贵重物品'),
      itemTier: String(item.tier || '中阶'),
      effectValue: Number(item.effectValue || 0),
      startPrice: Math.max(80, Number(item.price || 80)),
      minIncrement: 10,
      durationSec: AUCTION_HOUSE_DAILY_SECONDS
    });
    markDailyLimit(db, 0, 'auction_house_daily', 1, day);
  }
}

function getActiveStall(db: any, userId: number) {
  const row = db.prepare(`
    SELECT id, userId, expiresAt, status, createdAt, updatedAt
    FROM guild_market_stalls
    WHERE userId = ?
    LIMIT 1
  `).get(userId) as AnyRow | undefined;
  if (!row) return null;
  const expired = Date.parse(String(row.expiresAt || '')) <= Date.now();
  if (expired && String(row.status || '') === 'active') {
    db.prepare(`UPDATE guild_market_stalls SET status = 'expired', updatedAt = ? WHERE id = ?`).run(nowIso(), Number(row.id));
    return { ...row, status: 'expired' };
  }
  return row;
}

function ensureCommissionSeeds(db: any) {
  const hasOpen = db.prepare(`SELECT id FROM guild_commissions WHERE status = 'open' LIMIT 1`).get() as AnyRow | undefined;
  if (hasOpen?.id) return;

  const now = nowIso();
  const seedRows = [
    {
      title: 'D级：巡查公会仓库',
      content: '检查仓库清单并上报缺失物资。',
      grade: 'D',
      kind: 'normal',
      rewardGold: 80
    },
    {
      title: 'C级：护送药材商队',
      content: '护送商队通过西市通道。',
      grade: 'C',
      kind: 'normal',
      rewardGold: 180
    },
    {
      title: 'B级：清理界域入口异动',
      content: '处理公会外围异常精神波动。',
      grade: 'B',
      kind: 'normal',
      rewardGold: 360
    },
    {
      title: 'A级：夜间高危护卫',
      content: '护送关键证人到观察者据点。',
      grade: 'A',
      kind: 'normal',
      rewardGold: 680
    },
    {
      title: 'S级暗杀：清除叛逃杀手',
      content: '目标为高危叛逃者，允许采取致命手段。',
      grade: 'S',
      kind: 'assassination',
      rewardGold: 2200
    }
  ];

  const stmt = db.prepare(`
    INSERT INTO guild_commissions(
      publisherUserId, publisherName, title, content, grade, kind, rewardGold,
      status, assigneeUserId, assigneeName, acceptedAt, completedAt, createdAt, updatedAt
    )
    VALUES (0, '公会事务员', ?, ?, ?, ?, ?, 'open', 0, '', '', '', ?, ?)
  `);
  for (const x of seedRows) {
    stmt.run(x.title, x.content, x.grade, x.kind, x.rewardGold, now, now);
  }
}

function ensureObserverBookSeeds(db: any) {
  const hasAny = db.prepare(`SELECT id FROM observer_library_books LIMIT 1`).get() as AnyRow | undefined;
  if (hasAny?.id) return;
  const now = nowIso();
  const seedRows = [
    {
      title: '命之塔的起源猜测',
      authorName: '初代观察者',
      content: '有人说塔是从地底长出来的，也有人说是神使从天外抛下的巨石...'
    },
    {
      title: '论哨兵狂暴的不可逆性',
      authorName: '情报处理员-K',
      content: '如果不加干预，狂暴值超过100%的哨兵最终都会走向自我毁灭...'
    }
  ];
  const stmt = db.prepare(`
    INSERT INTO observer_library_books(title, content, authorUserId, authorName, createdAt, updatedAt)
    VALUES (?, ?, 0, ?, ?, ?)
  `);
  for (const row of seedRows) {
    stmt.run(String(row.title || ''), String(row.content || ''), String(row.authorName || ''), now, now);
  }
}

export function createGuildRouter(ctx: AppContext) {
  const r = Router();
  const { db } = ctx;

  ensureTables(db);
  settleEndedAuctions(db);
  ensureAutoAuctions(db);
  ensureCommissionSeeds(db);
  ensureObserverBookSeeds(db);

  r.get('/guild/state', (req, res) => {
    try {
      const userId = Number(req.query.userId || 0);
      if (!userId) return res.status(400).json({ success: false, message: 'userId required' });
      const user = getUser(db, userId);
      if (!user) return res.status(404).json({ success: false, message: 'user not found' });

      settleEndedAuctions(db);
      ensureAutoAuctions(db);

      const bank = ensureBankAccount(db, userId);
      const stall = getActiveStall(db, userId);

      const openRows = db.prepare(`
        SELECT a.*, hb.name AS highestBidderName, su.name AS sellerName
        FROM guild_auctions a
        LEFT JOIN users hb ON hb.id = a.highestBidderId
        LEFT JOIN users su ON su.id = a.sellerUserId
        WHERE a.status = 'open'
        ORDER BY a.endAt ASC, a.id DESC
        LIMIT 80
      `).all() as AnyRow[];

      const recentRows = db.prepare(`
        SELECT a.*, hb.name AS highestBidderName, su.name AS sellerName
        FROM guild_auctions a
        LEFT JOIN users hb ON hb.id = a.highestBidderId
        LEFT JOIN users su ON su.id = a.sellerUserId
        WHERE a.status IN ('closed', 'expired')
        ORDER BY a.updatedAt DESC, a.id DESC
        LIMIT 1
      `).all() as AnyRow[];

      const myBidRows = db.prepare(`
        SELECT auctionId, MAX(bidAmount) AS myBid
        FROM guild_auction_bids
        WHERE userId = ?
        GROUP BY auctionId
      `).all(userId) as AnyRow[];
      const myBidMap = new Map<number, number>();
      for (const x of myBidRows) myBidMap.set(Number(x.auctionId || 0), Number(x.myBid || 0));

      const mapAuction = (row: AnyRow) => ({
        id: Number(row.id || 0),
        channel: String(row.channel || ''),
        title: String(row.title || ''),
        sourceType: String(row.sourceType || 'npc'),
        sellerUserId: Number(row.sellerUserId || 0),
        sellerName: String(row.sellerName || ''),
        itemId: Number(row.itemId || 0),
        itemName: String(row.itemName || ''),
        itemDescription: String(row.itemDescription || ''),
        itemType: String(row.itemType || ''),
        itemTier: String(row.itemTier || ''),
        effectValue: Number(row.effectValue || 0),
        startPrice: Number(row.startPrice || 0),
        minIncrement: Number(row.minIncrement || 10),
        currentPrice: Number(row.currentPrice || 0),
        highestBidderId: Number(row.highestBidderId || 0),
        highestBidderName: String(row.highestBidderName || ''),
        endAt: String(row.endAt || ''),
        status: String(row.status || 'open'),
        myBid: Number(myBidMap.get(Number(row.id || 0)) || 0),
        secondsLeft: Math.max(0, Math.floor((Date.parse(String(row.endAt || '')) - Date.now()) / 1000))
      });

      const lastAlley = db.prepare(`
        SELECT id, resultType, resultText, rolledAt
        FROM guild_alley_logs
        WHERE userId = ?
        ORDER BY id DESC
        LIMIT 1
      `).get(userId) as AnyRow | undefined;

      const canManageMembers = String(user.job || '') === '公会会长';

      res.json({
        success: true,
        bank: {
          balance: Number(bank.balance || 0),
          lastInterestDate: String(bank.lastInterestDate || '')
        },
        stall: stall
          ? {
              active: String(stall.status || '') === 'active' && Date.parse(String(stall.expiresAt || '')) > Date.now(),
              expiresAt: String(stall.expiresAt || ''),
              rentCost: STALL_RENT_GOLD
            }
          : {
              active: false,
              expiresAt: '',
              rentCost: STALL_RENT_GOLD
            },
        auctions: openRows.map(mapAuction),
        recentAuctions: recentRows.map(mapAuction),
        alley: {
          lastRolledAt: String(lastAlley?.rolledAt || ''),
          lastResultType: String(lastAlley?.resultType || ''),
          lastResultText: String(lastAlley?.resultText || '')
        },
        limits: {
          listingToday: getDailyCount(db, userId, 'auction_player_listing'),
          listingMax: 1
        },
        permissions: {
          canManageMembers,
          memberChangePolicy: '仅公会会长可执行成员变动操作'
        }
      });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e?.message || 'load guild state failed' });
    }
  });

  r.post('/guild/bank/deposit', (req, res) => {
    try {
      const userId = Number(req.body?.userId || 0);
      const amount = clamp(toInt(req.body?.amount), 1, 99999999);
      if (!userId || !amount) return res.status(400).json({ success: false, message: 'userId/amount invalid' });

      const user = getUser(db, userId);
      if (!user) return res.status(404).json({ success: false, message: 'user not found' });
      if (Number(user.gold || 0) < amount) return res.status(400).json({ success: false, message: '金币不足，无法存入' });

      const tx = db.transaction(() => {
        ensureBankAccount(db, userId);
        db.prepare(`UPDATE users SET gold = gold - ?, updatedAt = ? WHERE id = ?`).run(amount, nowIso(), userId);
        db.prepare(`UPDATE guild_bank_accounts SET balance = balance + ?, updatedAt = ? WHERE userId = ?`).run(amount, nowIso(), userId);
      });
      tx();

      const bank = ensureBankAccount(db, userId);
      const freshUser = getUser(db, userId);
      res.json({
        success: true,
        message: `已存入 ${amount}G`,
        bankBalance: Number(bank.balance || 0),
        gold: Number(freshUser?.gold || 0)
      });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e?.message || 'bank deposit failed' });
    }
  });

  r.post('/guild/bank/withdraw', (req, res) => {
    try {
      const userId = Number(req.body?.userId || 0);
      const amount = clamp(toInt(req.body?.amount), 1, 99999999);
      if (!userId || !amount) return res.status(400).json({ success: false, message: 'userId/amount invalid' });

      const user = getUser(db, userId);
      if (!user) return res.status(404).json({ success: false, message: 'user not found' });
      const bank = ensureBankAccount(db, userId);
      if (Number(bank.balance || 0) < amount) return res.status(400).json({ success: false, message: '银行余额不足，无法取出' });

      const tx = db.transaction(() => {
        db.prepare(`UPDATE guild_bank_accounts SET balance = balance - ?, updatedAt = ? WHERE userId = ?`).run(amount, nowIso(), userId);
        db.prepare(`UPDATE users SET gold = gold + ?, updatedAt = ? WHERE id = ?`).run(amount, nowIso(), userId);
      });
      tx();

      const freshBank = ensureBankAccount(db, userId);
      const freshUser = getUser(db, userId);
      res.json({
        success: true,
        message: `已取出 ${amount}G`,
        bankBalance: Number(freshBank.balance || 0),
        gold: Number(freshUser?.gold || 0)
      });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e?.message || 'bank withdraw failed' });
    }
  });

  r.post('/guild/bank/interest/claim', (req, res) => {
    try {
      const userId = Number(req.body?.userId || 0);
      if (!userId) return res.status(400).json({ success: false, message: 'userId invalid' });

      const user = getUser(db, userId);
      if (!user) return res.status(404).json({ success: false, message: 'user not found' });
      const bank = ensureBankAccount(db, userId);
      const day = todayKey();
      if (getDailyCount(db, userId, 'bank_interest_claim', day) > 0) {
        return res.status(409).json({ success: false, message: '今日利息已领取' });
      }

      const balance = Number(bank.balance || 0);
      if (balance <= 0) return res.status(400).json({ success: false, message: '银行余额为 0，无法结算利息' });

      const interest = Math.max(1, Math.floor(balance * BANK_INTEREST_RATE));
      db.prepare(`
        UPDATE guild_bank_accounts
        SET balance = balance + ?,
            lastInterestDate = ?,
            updatedAt = ?
        WHERE userId = ?
      `).run(interest, day, nowIso(), userId);
      markDailyLimit(db, userId, 'bank_interest_claim', 1, day);

      const fresh = ensureBankAccount(db, userId);
      res.json({
        success: true,
        message: `今日利息到账 ${interest}G（0.1%）`,
        interest,
        bankBalance: Number(fresh.balance || 0)
      });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e?.message || 'claim interest failed' });
    }
  });

  r.post('/guild/stalls/rent', (req, res) => {
    try {
      const userId = Number(req.body?.userId || 0);
      if (!userId) return res.status(400).json({ success: false, message: 'userId invalid' });

      const user = getUser(db, userId);
      if (!user) return res.status(404).json({ success: false, message: 'user not found' });

      const active = getActiveStall(db, userId);
      if (active && String(active.status || '') === 'active' && Date.parse(String(active.expiresAt || '')) > Date.now()) {
        return res.json({
          success: true,
          message: '当前已有有效摊位',
          stall: { active: true, expiresAt: String(active.expiresAt || '') }
        });
      }

      if (Number(user.gold || 0) < STALL_RENT_GOLD) {
        return res.status(400).json({ success: false, message: `租摊需要 ${STALL_RENT_GOLD}G，金币不足` });
      }

      const expiresAt = afterSecondsIso(24 * 3600);
      const tx = db.transaction(() => {
        db.prepare(`UPDATE users SET gold = gold - ?, updatedAt = ? WHERE id = ?`).run(STALL_RENT_GOLD, nowIso(), userId);
        db.prepare(`
          INSERT INTO guild_market_stalls(userId, expiresAt, status, createdAt, updatedAt)
          VALUES (?, ?, 'active', ?, ?)
          ON CONFLICT(userId)
          DO UPDATE SET expiresAt = excluded.expiresAt, status = 'active', updatedAt = excluded.updatedAt
        `).run(userId, expiresAt, nowIso(), nowIso());
      });
      tx();

      const freshUser = getUser(db, userId);
      res.json({
        success: true,
        message: `租摊成功，已扣除 ${STALL_RENT_GOLD}G（有效期24小时）`,
        stall: { active: true, expiresAt },
        gold: Number(freshUser?.gold || 0)
      });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e?.message || 'rent stall failed' });
    }
  });

  r.post('/guild/auctions/bid', (req, res) => {
    try {
      const userId = Number(req.body?.userId || 0);
      const auctionId = Number(req.body?.auctionId || 0);
      const bidAmount = clamp(toInt(req.body?.bidAmount), 1, 999999999);
      if (!userId || !auctionId || !bidAmount) {
        return res.status(400).json({ success: false, message: 'userId/auctionId/bidAmount invalid' });
      }

      settleEndedAuctions(db);
      ensureAutoAuctions(db);

      const user = getUser(db, userId);
      if (!user) return res.status(404).json({ success: false, message: 'user not found' });
      const auction = db.prepare(`SELECT * FROM guild_auctions WHERE id = ? LIMIT 1`).get(auctionId) as AnyRow | undefined;
      if (!auction) return res.status(404).json({ success: false, message: '拍卖不存在' });
      if (String(auction.status || '') !== 'open') return res.status(409).json({ success: false, message: '该拍卖已结束' });

      if (Date.parse(String(auction.endAt || '')) <= Date.now()) {
        settleEndedAuctions(db);
        return res.status(409).json({ success: false, message: '该拍卖已到结算时间' });
      }

      const minIncrement = Math.max(1, Number(auction.minIncrement || 10));
      const startPrice = Math.max(1, Number(auction.startPrice || 1));
      const currentPrice = Math.max(0, Number(auction.currentPrice || 0));
      const minBid = currentPrice > 0 ? currentPrice + minIncrement : startPrice;
      if (bidAmount < minBid) {
        return res.status(409).json({ success: false, message: `当前最低出价为 ${minBid}G`, minBid });
      }
      if (Number(user.gold || 0) < bidAmount) {
        return res.status(400).json({ success: false, message: '金币不足，无法喊价' });
      }

      db.prepare(`
        INSERT INTO guild_auction_bids(auctionId, userId, bidAmount, createdAt)
        VALUES (?, ?, ?, ?)
      `).run(auctionId, userId, bidAmount, nowIso());
      db.prepare(`
        UPDATE guild_auctions
        SET currentPrice = ?,
            highestBidderId = ?,
            updatedAt = ?
        WHERE id = ?
      `).run(bidAmount, userId, nowIso(), auctionId);

      res.json({
        success: true,
        message: `出价成功：${bidAmount}G`,
        currentPrice: bidAmount,
        secondsLeft: Math.max(0, Math.floor((Date.parse(String(auction.endAt || '')) - Date.now()) / 1000))
      });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e?.message || 'bid failed' });
    }
  });

  r.post('/guild/auctions/listing', (req, res) => {
    try {
      const userId = Number(req.body?.userId || 0);
      const mode = String(req.body?.mode || '').trim(); // inventory | custom
      if (!userId || !mode) return res.status(400).json({ success: false, message: 'userId/mode invalid' });
      if (!['inventory', 'custom'].includes(mode)) return res.status(400).json({ success: false, message: 'mode invalid' });

      settleEndedAuctions(db);
      ensureAutoAuctions(db);

      const user = getUser(db, userId);
      if (!user) return res.status(404).json({ success: false, message: 'user not found' });
      const stall = getActiveStall(db, userId);
      const stallActive = !!stall && String(stall.status || '') === 'active' && Date.parse(String(stall.expiresAt || '')) > Date.now();
      if (!stallActive) return res.status(403).json({ success: false, message: '请先在自由集市租摊后再上架' });

      const day = todayKey();
      if (getDailyCount(db, userId, 'auction_player_listing', day) >= 1) {
        return res.status(409).json({ success: false, message: '每位玩家每天最多上架 1 件物品' });
      }

      const startPrice = clamp(toInt(req.body?.startPrice), 20, 99999999);
      const minIncrement = clamp(toInt(req.body?.minIncrement || 10), 1, 9999999);
      const durationSec = clamp(toInt(req.body?.durationSec || PLAYER_LISTING_SECONDS), 300, PLAYER_LISTING_SECONDS);

      let itemName = '';
      let itemDescription = '';
      let itemType = '贵重物品';
      let itemTier = '中阶';
      let effectValue = 0;
      let sourceType: 'player' | 'custom' = mode === 'custom' ? 'custom' : 'player';

      const tx = db.transaction(() => {
        if (mode === 'inventory') {
          const inventoryId = Number(req.body?.inventoryId || 0);
          if (!inventoryId) throw new Error('inventoryId required');
          const inv = db.prepare(`
            SELECT id, name, description, qty, itemType, effectValue
            FROM inventory
            WHERE id = ? AND userId = ? AND qty > 0
            LIMIT 1
          `).get(inventoryId, userId) as AnyRow | undefined;
          if (!inv) throw new Error('背包中不存在该道具或数量不足');

          itemName = String(inv.name || '').trim();
          if (!itemName) throw new Error('道具名称非法');
          itemDescription = String(inv.description || '');
          itemType = String(inv.itemType || '贵重物品');
          effectValue = Number(inv.effectValue || 0);
          itemTier = String(req.body?.itemTier || '中阶');
          sourceType = 'player';

          if (Number(inv.qty || 1) <= 1) {
            db.prepare(`DELETE FROM inventory WHERE id = ?`).run(Number(inv.id));
          } else {
            db.prepare(`UPDATE inventory SET qty = qty - 1 WHERE id = ?`).run(Number(inv.id));
          }
        } else {
          sourceType = 'custom';
          itemName = String(req.body?.name || '').trim();
          if (!itemName) throw new Error('自定义道具名称不能为空');
          itemDescription = String(req.body?.description || '').trim();
          itemType = String(req.body?.itemType || '贵重物品').trim() || '贵重物品';
          itemTier = String(req.body?.itemTier || '中阶').trim() || '中阶';
          effectValue = clamp(toInt(req.body?.effectValue || 0), 0, 9999);
          if (Number(user.gold || 0) < CUSTOM_LISTING_FEE) throw new Error(`自定义上架需支付 ${CUSTOM_LISTING_FEE}G 手续费`);
          db.prepare(`UPDATE users SET gold = gold - ?, updatedAt = ? WHERE id = ?`).run(CUSTOM_LISTING_FEE, nowIso(), userId);
        }

        createAuction(db, {
          channel: 'auction_player',
          title: sourceType === 'custom' ? '玩家自定义寄售' : '玩家寄售',
          sourceType,
          sellerUserId: userId,
          itemId: 0,
          itemName,
          itemDescription,
          itemType,
          itemTier,
          effectValue,
          startPrice,
          minIncrement,
          durationSec
        });

        markDailyLimit(db, userId, 'auction_player_listing', 1, day);
      });
      tx();

      const freshUser = getUser(db, userId);
      res.json({
        success: true,
        message: sourceType === 'custom'
          ? `自定义寄售已上架（已扣 ${CUSTOM_LISTING_FEE}G 手续费）`
          : '背包道具已上架拍卖行',
        gold: Number(freshUser?.gold || 0)
      });
    } catch (e: any) {
      res.status(400).json({ success: false, message: e?.message || 'create listing failed' });
    }
  });

  r.get('/observer/library/books', (req, res) => {
    try {
      const userId = Number(req.query.userId || 0);
      const limit = clamp(toInt(req.query.limit || 120), 1, 400);
      const rows = db.prepare(`
        SELECT id, title, content, authorUserId, authorName, createdAt, updatedAt
        FROM observer_library_books
        ORDER BY datetime(updatedAt) DESC, id DESC
        LIMIT ?
      `).all(limit) as AnyRow[];

      res.json({
        success: true,
        books: rows.map((x) => {
          const authorUserId = Number(x.authorUserId || 0);
          const isOwner = !!userId && authorUserId === userId;
          return {
            id: Number(x.id || 0),
            title: String(x.title || ''),
            content: String(x.content || ''),
            authorUserId,
            authorName: String(x.authorName || ''),
            createdAt: String(x.createdAt || ''),
            updatedAt: String(x.updatedAt || ''),
            canEdit: isOwner,
            canDelete: isOwner
          };
        })
      });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e?.message || 'observer books query failed', books: [] });
    }
  });

  r.post('/observer/library/books', (req, res) => {
    try {
      const userId = Number(req.body?.userId || 0);
      if (!userId) return res.status(400).json({ success: false, message: 'userId required' });
      const me = getUser(db, userId);
      if (!me) return res.status(404).json({ success: false, message: 'user not found' });
      if (!['approved', 'ghost'].includes(String(me.status || ''))) {
        return res.status(403).json({ success: false, message: '当前状态无法写入图书馆' });
      }
      if (!isObserverJob(me.job)) {
        return res.status(403).json({ success: false, message: '只有观察者成员可以撰写文献' });
      }

      const rawTitle = String(req.body?.title ?? '');
      const rawContent = String(req.body?.content ?? '');
      const title = rawTitle.trim().slice(0, 120) || '无题文献';
      const content = rawContent.slice(0, 20000);
      const ts = nowIso();

      const ret = db.prepare(`
        INSERT INTO observer_library_books(title, content, authorUserId, authorName, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(title, content, userId, String(me.name || ''), ts, ts);

      const id = Number(ret.lastInsertRowid || 0);
      const row = db.prepare(`
        SELECT id, title, content, authorUserId, authorName, createdAt, updatedAt
        FROM observer_library_books
        WHERE id = ?
        LIMIT 1
      `).get(id) as AnyRow | undefined;

      res.json({
        success: true,
        message: '文献已写入图书馆',
        book: row
          ? {
              id: Number(row.id || 0),
              title: String(row.title || ''),
              content: String(row.content || ''),
              authorUserId: Number(row.authorUserId || 0),
              authorName: String(row.authorName || ''),
              createdAt: String(row.createdAt || ''),
              updatedAt: String(row.updatedAt || ''),
              canEdit: true,
              canDelete: true
            }
          : null
      });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e?.message || 'create observer book failed' });
    }
  });

  r.patch('/observer/library/books/:id', (req, res) => {
    try {
      const id = Number(req.params.id || 0);
      const userId = Number(req.body?.userId || 0);
      if (!id || !userId) return res.status(400).json({ success: false, message: 'id/userId invalid' });

      const me = getUser(db, userId);
      if (!me) return res.status(404).json({ success: false, message: 'user not found' });
      if (!['approved', 'ghost'].includes(String(me.status || ''))) {
        return res.status(403).json({ success: false, message: '当前状态无法编辑文献' });
      }
      if (!isObserverJob(me.job)) {
        return res.status(403).json({ success: false, message: '只有观察者成员可以编辑文献' });
      }

      const row = db.prepare(`
        SELECT id, title, content, authorUserId, authorName, createdAt, updatedAt
        FROM observer_library_books
        WHERE id = ?
        LIMIT 1
      `).get(id) as AnyRow | undefined;
      if (!row) return res.status(404).json({ success: false, message: '文献不存在' });
      if (Number(row.authorUserId || 0) !== userId) {
        return res.status(403).json({ success: false, message: '你不能编辑别人写的文献' });
      }

      const hasTitle = Object.prototype.hasOwnProperty.call(req.body || {}, 'title');
      const hasContent = Object.prototype.hasOwnProperty.call(req.body || {}, 'content');
      if (!hasTitle && !hasContent) {
        return res.status(400).json({ success: false, message: 'title 或 content 至少提供一个' });
      }

      const nextTitle = hasTitle ? String(req.body?.title ?? '').trim().slice(0, 120) || '无题文献' : String(row.title || '');
      const nextContent = hasContent ? String(req.body?.content ?? '').slice(0, 20000) : String(row.content || '');
      const ts = nowIso();

      db.prepare(`
        UPDATE observer_library_books
        SET title = ?, content = ?, updatedAt = ?
        WHERE id = ?
      `).run(nextTitle, nextContent, ts, id);

      const fresh = db.prepare(`
        SELECT id, title, content, authorUserId, authorName, createdAt, updatedAt
        FROM observer_library_books
        WHERE id = ?
        LIMIT 1
      `).get(id) as AnyRow | undefined;

      res.json({
        success: true,
        message: '文献已更新',
        book: fresh
          ? {
              id: Number(fresh.id || 0),
              title: String(fresh.title || ''),
              content: String(fresh.content || ''),
              authorUserId: Number(fresh.authorUserId || 0),
              authorName: String(fresh.authorName || ''),
              createdAt: String(fresh.createdAt || ''),
              updatedAt: String(fresh.updatedAt || ''),
              canEdit: true,
              canDelete: true
            }
          : null
      });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e?.message || 'update observer book failed' });
    }
  });

  r.delete('/observer/library/books/:id', (req, res) => {
    try {
      const id = Number(req.params.id || 0);
      const userId = Number(req.body?.userId || 0);
      if (!id || !userId) return res.status(400).json({ success: false, message: 'id/userId invalid' });

      const me = getUser(db, userId);
      if (!me) return res.status(404).json({ success: false, message: 'user not found' });
      if (!['approved', 'ghost'].includes(String(me.status || ''))) {
        return res.status(403).json({ success: false, message: '当前状态无法删除文献' });
      }
      if (!isObserverJob(me.job)) {
        return res.status(403).json({ success: false, message: '只有观察者成员可以删除文献' });
      }

      const row = db.prepare(`SELECT id, authorUserId FROM observer_library_books WHERE id = ? LIMIT 1`).get(id) as AnyRow | undefined;
      if (!row) return res.status(404).json({ success: false, message: '文献不存在' });
      if (Number(row.authorUserId || 0) !== userId) {
        return res.status(403).json({ success: false, message: '你不能删除别人写的文献' });
      }

      db.prepare(`DELETE FROM observer_library_books WHERE id = ?`).run(id);
      res.json({ success: true, message: '文献已删除' });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e?.message || 'delete observer book failed' });
    }
  });

  r.get('/observer/library/auctions', (req, res) => {
    try {
      const limit = clamp(toInt(req.query.limit || 50), 1, 200);
      const rows = db.prepare(`
        SELECT id, auctionId, channel, title, itemName, itemDescription, itemTier, itemType,
               finalPrice, winnerUserId, winnerName, sellerUserId, sellerName, status, archivedAt
        FROM observer_library_auction_logs
        ORDER BY id DESC
        LIMIT ?
      `).all(limit) as AnyRow[];
      res.json({
        success: true,
        logs: rows.map((x) => ({
          id: Number(x.id || 0),
          auctionId: Number(x.auctionId || 0),
          channel: String(x.channel || ''),
          title: String(x.title || ''),
          itemName: String(x.itemName || ''),
          itemDescription: String(x.itemDescription || ''),
          itemTier: String(x.itemTier || ''),
          itemType: String(x.itemType || ''),
          finalPrice: Number(x.finalPrice || 0),
          winnerUserId: Number(x.winnerUserId || 0),
          winnerName: String(x.winnerName || ''),
          sellerUserId: Number(x.sellerUserId || 0),
          sellerName: String(x.sellerName || ''),
          status: String(x.status || ''),
          archivedAt: String(x.archivedAt || '')
        }))
      });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e?.message || 'observer library query failed', logs: [] });
    }
  });

  r.get('/guild/commissions', (req, res) => {
    try {
      const userId = Number(req.query.userId || 0);
      const me = userId ? getUser(db, userId) : null;
      const myJob = String(me?.job || '');
      const myStatus = String(me?.status || '');
      const isAdventurer = myJob === '冒险者' && ['approved', 'ghost'].includes(myStatus);

      const rows = db.prepare(`
        SELECT id, publisherUserId, publisherName, title, content, grade, kind, rewardGold,
               status, assigneeUserId, assigneeName, acceptedAt, completedAt, createdAt, updatedAt
        FROM guild_commissions
        WHERE status = 'open' OR (status = 'accepted' AND assigneeUserId = ?)
        ORDER BY
          CASE status WHEN 'accepted' THEN 0 WHEN 'open' THEN 1 ELSE 2 END,
          id DESC
        LIMIT 120
      `).all(userId) as AnyRow[];

      const myAccepted = rows.filter((x) => String(x.status || '') === 'accepted' && Number(x.assigneeUserId || 0) === userId);
      let profile: any = null;
      if (userId) {
        const statsExisting = db.prepare(`SELECT * FROM guild_adventurer_stats WHERE userId = ? LIMIT 1`).get(userId) as AnyRow | undefined;
        const stats = statsExisting || (isAdventurer ? ensureAdventurerStats(db, userId) : null);
        if (stats) {
        const lv = levelByScore(Number(stats.score || 0));
        profile = {
          userId,
          isAdventurer,
          level: Number(stats.level || lv.level),
          title: String(stats.title || lv.title),
          score: Number(stats.score || 0),
          completedTotal: Number(stats.completedTotal || 0),
          completedByGrade: {
            D: Number(stats.completedD || 0),
            C: Number(stats.completedC || 0),
            B: Number(stats.completedB || 0),
            A: Number(stats.completedA || 0),
            S: Number(stats.completedS || 0),
          },
          rewardBonusRate: lv.rewardBonusRate
        };
        }
      }

      const board = db.prepare(`
        SELECT s.userId, s.level, s.title, s.score, s.completedTotal,
               s.completedD, s.completedC, s.completedB, s.completedA, s.completedS,
               u.name
        FROM guild_adventurer_stats s
        JOIN users u ON u.id = s.userId
        WHERE (u.job = '冒险者' OR s.completedTotal > 0)
        ORDER BY s.score DESC, s.completedTotal DESC, s.userId ASC
        LIMIT 30
      `).all() as AnyRow[];

      res.json({
        success: true,
        profile,
        commissions: rows.map((x) => ({
          id: Number(x.id || 0),
          publisherUserId: Number(x.publisherUserId || 0),
          publisherName: String(x.publisherName || ''),
          title: String(x.title || ''),
          content: String(x.content || ''),
          grade: String(x.grade || 'D'),
          kind: String(x.kind || 'normal'),
          rewardGold: Number(x.rewardGold || 0),
          status: String(x.status || 'open'),
          assigneeUserId: Number(x.assigneeUserId || 0),
          assigneeName: String(x.assigneeName || ''),
          acceptedAt: String(x.acceptedAt || ''),
          completedAt: String(x.completedAt || ''),
          createdAt: String(x.createdAt || ''),
          canAccept: isAdventurer && String(x.status || '') === 'open'
        })),
        myAccepted: myAccepted.map((x) => Number(x.id || 0)),
        leaderboard: board.map((x) => ({
          userId: Number(x.userId || 0),
          name: String(x.name || ''),
          level: Number(x.level || 1),
          title: String(x.title || '见习冒险者'),
          score: Number(x.score || 0),
          completedTotal: Number(x.completedTotal || 0),
          completedByGrade: {
            D: Number(x.completedD || 0),
            C: Number(x.completedC || 0),
            B: Number(x.completedB || 0),
            A: Number(x.completedA || 0),
            S: Number(x.completedS || 0)
          }
        }))
      });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e?.message || 'load commissions failed', commissions: [], leaderboard: [] });
    }
  });

  r.post('/guild/commissions/publish', (req, res) => {
    try {
      const userId = Number(req.body?.userId || 0);
      const title = String(req.body?.title || '').trim();
      const content = String(req.body?.content || '').trim();
      const grade = normalizeCommissionGrade(req.body?.grade);
      const kind = normalizeCommissionKind(req.body?.kind);
      if (!userId || !title) return res.status(400).json({ success: false, message: 'userId/title required' });

      const me = getUser(db, userId);
      if (!me) return res.status(404).json({ success: false, message: 'user not found' });
      const status = String(me.status || '');
      if (!['approved', 'ghost'].includes(status)) {
        return res.status(403).json({ success: false, message: '当前状态无法发布委托' });
      }

      const cfg = COMMISSION_GRADE_CONFIG[grade] || COMMISSION_GRADE_CONFIG.D;
      const kindMulti = kind === 'assassination' ? 2 : 1;
      const minReward = cfg.minReward * kindMulti;
      const rewardInput = Math.max(0, toInt(req.body?.rewardGold || 0));
      const rewardGold = Math.max(minReward, rewardInput);
      if (Number(me.gold || 0) < rewardGold) {
        return res.status(400).json({ success: false, message: `发布该委托至少需要 ${rewardGold}G` });
      }

      const tx = db.transaction(() => {
        db.prepare(`UPDATE users SET gold = gold - ?, updatedAt = ? WHERE id = ?`).run(rewardGold, nowIso(), userId);
        db.prepare(`
          INSERT INTO guild_commissions(
            publisherUserId, publisherName, title, content, grade, kind, rewardGold,
            status, assigneeUserId, assigneeName, acceptedAt, completedAt, createdAt, updatedAt
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, 'open', 0, '', '', '', ?, ?)
        `).run(
          userId,
          String(me.name || ''),
          title,
          content,
          grade,
          kind,
          rewardGold,
          nowIso(),
          nowIso()
        );
      });
      tx();

      res.json({
        success: true,
        message: `委托发布成功，已托管赏金 ${rewardGold}G`,
        rewardGold,
        grade,
        kind
      });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e?.message || 'publish commission failed' });
    }
  });

  r.post('/guild/commissions/:id/accept', (req, res) => {
    try {
      const id = Number(req.params.id || 0);
      const userId = Number(req.body?.userId || 0);
      if (!id || !userId) return res.status(400).json({ success: false, message: 'id/userId invalid' });

      const me = getUser(db, userId);
      if (!me) return res.status(404).json({ success: false, message: 'user not found' });
      if (!['approved', 'ghost'].includes(String(me.status || ''))) {
        return res.status(403).json({ success: false, message: '当前状态无法接取委托' });
      }
      if (String(me.job || '') !== '冒险者') {
        return res.status(403).json({ success: false, message: '只有职业为冒险者的玩家可以接取委托' });
      }

      const row = db.prepare(`SELECT * FROM guild_commissions WHERE id = ? LIMIT 1`).get(id) as AnyRow | undefined;
      if (!row) return res.status(404).json({ success: false, message: '委托不存在' });
      if (String(row.status || '') !== 'open') return res.status(409).json({ success: false, message: '该委托已被接取或已结束' });

      const existingAccepted = db.prepare(`
        SELECT id
        FROM guild_commissions
        WHERE assigneeUserId = ? AND status = 'accepted'
        LIMIT 1
      `).get(userId) as AnyRow | undefined;
      if (existingAccepted?.id) {
        return res.status(409).json({ success: false, message: '你已有进行中的委托，完成后再接新任务' });
      }

      db.prepare(`
        UPDATE guild_commissions
        SET status = 'accepted',
            assigneeUserId = ?,
            assigneeName = ?,
            acceptedAt = ?,
            updatedAt = ?
        WHERE id = ?
      `).run(userId, String(me.name || ''), nowIso(), nowIso(), id);

      res.json({ success: true, message: '接取成功，任务已记录到你的冒险日志。' });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e?.message || 'accept commission failed' });
    }
  });

  r.post('/guild/commissions/:id/complete', (req, res) => {
    try {
      const id = Number(req.params.id || 0);
      const userId = Number(req.body?.userId || 0);
      if (!id || !userId) return res.status(400).json({ success: false, message: 'id/userId invalid' });

      const me = getUser(db, userId);
      if (!me) return res.status(404).json({ success: false, message: 'user not found' });
      if (!['approved', 'ghost'].includes(String(me.status || ''))) {
        return res.status(403).json({ success: false, message: '当前状态无法完成委托' });
      }
      if (String(me.job || '') !== '冒险者') {
        return res.status(403).json({ success: false, message: '只有冒险者可以完成委托' });
      }

      const row = db.prepare(`SELECT * FROM guild_commissions WHERE id = ? LIMIT 1`).get(id) as AnyRow | undefined;
      if (!row) return res.status(404).json({ success: false, message: '委托不存在' });
      if (String(row.status || '') !== 'accepted' || Number(row.assigneeUserId || 0) !== userId) {
        return res.status(409).json({ success: false, message: '该委托未处于你的进行中状态' });
      }

      const grade = normalizeCommissionGrade(row.grade);
      const kind = normalizeCommissionKind(row.kind);
      const cfg = COMMISSION_GRADE_CONFIG[grade] || COMMISSION_GRADE_CONFIG.D;
      const scoreAdd = Math.max(1, cfg.score * (kind === 'assassination' ? 2 : 1));
      const baseReward = Math.max(cfg.minReward, Number(row.rewardGold || cfg.minReward));

      const prevStats = ensureAdventurerStats(db, userId);
      const nextScore = Number(prevStats.score || 0) + scoreAdd;
      const lv = levelByScore(nextScore);
      const rewardBonusRate = lv.rewardBonusRate;
      const finalReward = Math.max(1, Math.round(baseReward * (1 + rewardBonusRate)));

      const tx = db.transaction(() => {
        db.prepare(`UPDATE users SET gold = gold + ?, updatedAt = ? WHERE id = ?`).run(finalReward, nowIso(), userId);

        db.prepare(`
          UPDATE guild_commissions
          SET status = 'completed',
              completedAt = ?,
              updatedAt = ?
          WHERE id = ?
        `).run(nowIso(), nowIso(), id);

        const nextByGrade = {
          D: Number(prevStats.completedD || 0) + (grade === 'D' ? 1 : 0),
          C: Number(prevStats.completedC || 0) + (grade === 'C' ? 1 : 0),
          B: Number(prevStats.completedB || 0) + (grade === 'B' ? 1 : 0),
          A: Number(prevStats.completedA || 0) + (grade === 'A' ? 1 : 0),
          S: Number(prevStats.completedS || 0) + (grade === 'S' ? 1 : 0)
        };

        db.prepare(`
          UPDATE guild_adventurer_stats
          SET level = ?,
              title = ?,
              score = ?,
              completedTotal = completedTotal + 1,
              completedD = ?,
              completedC = ?,
              completedB = ?,
              completedA = ?,
              completedS = ?,
              updatedAt = ?
          WHERE userId = ?
        `).run(
          lv.level,
          lv.title,
          nextScore,
          nextByGrade.D,
          nextByGrade.C,
          nextByGrade.B,
          nextByGrade.A,
          nextByGrade.S,
          nowIso(),
          userId
        );
      });
      tx();

      const freshStats = ensureAdventurerStats(db, userId);
      res.json({
        success: true,
        message: `委托完成，获得 ${finalReward}G（等级加成 ${(rewardBonusRate * 100).toFixed(0)}%）`,
        reward: finalReward,
        scoreAdd,
        profile: {
          level: Number(freshStats.level || lv.level),
          title: String(freshStats.title || lv.title),
          score: Number(freshStats.score || nextScore),
          completedTotal: Number(freshStats.completedTotal || 0),
          completedByGrade: {
            D: Number(freshStats.completedD || 0),
            C: Number(freshStats.completedC || 0),
            B: Number(freshStats.completedB || 0),
            A: Number(freshStats.completedA || 0),
            S: Number(freshStats.completedS || 0)
          }
        }
      });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e?.message || 'complete commission failed' });
    }
  });

  r.post('/guild/alley/wander', (req, res) => {
    try {
      const userId = Number(req.body?.userId || 0);
      if (!userId) return res.status(400).json({ success: false, message: 'userId invalid' });
      const user = getUser(db, userId);
      if (!user) return res.status(404).json({ success: false, message: 'user not found' });

      const last = db.prepare(`
        SELECT rolledAt
        FROM guild_alley_logs
        WHERE userId = ?
        ORDER BY id DESC
        LIMIT 1
      `).get(userId) as AnyRow | undefined;
      const now = Date.now();
      const lastAt = Date.parse(String(last?.rolledAt || ''));
      if (Number.isFinite(lastAt) && now - lastAt < 30000) {
        const wait = Math.max(1, Math.ceil((30000 - (now - lastAt)) / 1000));
        return res.status(429).json({ success: false, message: `你在小巷刚转过一圈，请 ${wait}s 后再试` });
      }

      let resultType = 'none';
      let resultText = '你在小巷闲逛了一圈，暂时没有额外收获。';
      let item: any = null;
      let gainedGold = 0;

      const roll = Math.random();
      if (roll < 0.35) {
        const drop = db.prepare(`
          SELECT id, name, description, itemType, effectValue, tier
          FROM items
          WHERE (
            locationTag = 'guild'
            OR locationTag = 'all'
            OR locationTag = ''
            OR locationTag LIKE '%guild%'
          )
          ORDER BY RANDOM()
          LIMIT 1
        `).get() as AnyRow | undefined;

        if (drop) {
          addInventoryItem(
            db,
            userId,
            String(drop.name || '神秘道具'),
            String(drop.itemType || '贵重物品'),
            1,
            String(drop.description || ''),
            Number(drop.effectValue || 0)
          );
          resultType = 'item';
          resultText = `小巷拾取：${String(drop.name || '神秘道具')}`;
          item = {
            id: Number(drop.id || 0),
            name: String(drop.name || ''),
            itemType: String(drop.itemType || '贵重物品'),
            tier: String(drop.tier || '低阶')
          };
        } else {
          gainedGold = clamp(Math.floor(Math.random() * 22) + 8, 8, 30);
          db.prepare(`UPDATE users SET gold = gold + ?, updatedAt = ? WHERE id = ?`).run(gainedGold, nowIso(), userId);
          resultType = 'gold';
          resultText = `你在小巷捡到了 ${gainedGold}G`;
        }
      } else if (roll < 0.75) {
        gainedGold = clamp(Math.floor(Math.random() * 18) + 6, 6, 24);
        db.prepare(`UPDATE users SET gold = gold + ?, updatedAt = ? WHERE id = ?`).run(gainedGold, nowIso(), userId);
        resultType = 'gold';
        resultText = `你在小巷接了个跑腿活，赚到 ${gainedGold}G`;
      }

      db.prepare(`
        INSERT INTO guild_alley_logs(userId, resultType, resultText, rolledAt)
        VALUES (?, ?, ?, ?)
      `).run(userId, resultType, resultText, nowIso());

      const freshUser = getUser(db, userId);
      res.json({
        success: true,
        message: resultText,
        resultType,
        gainedGold,
        item,
        gold: Number(freshUser?.gold || 0)
      });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e?.message || 'alley wander failed' });
    }
  });

  return r;
}



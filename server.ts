import express from 'express';
import Database from 'better-sqlite3';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = process.env.DB_PATH || 'game.db';
const db = new Database(dbPath);

// ================= 1. 数据库初始化 (合并了所有新旧表，确保数据不丢) =================
db.exec(`
  -- 用户主表
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
    avatarUrl TEXT,
    status TEXT DEFAULT 'pending',
    deathDescription TEXT,
    profileText TEXT,
    isHidden INTEGER DEFAULT 0,
    currentLocation TEXT,
    job TEXT DEFAULT '无',
    hp INTEGER DEFAULT 100,
    maxHp INTEGER DEFAULT 100,
    mp INTEGER DEFAULT 100,
    maxMp INTEGER DEFAULT 100,
    mentalProgress REAL DEFAULT 0,
    workCount INTEGER DEFAULT 0,
    trainCount INTEGER DEFAULT 0,
    lastResetDate TEXT,
    lastCheckInDate TEXT
  );

  -- 急救请求表 (用于濒死双重判定)
  CREATE TABLE IF NOT EXISTS rescue_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    patientId INTEGER,
    healerId INTEGER,
    status TEXT DEFAULT 'pending', -- pending, accepted
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- 全局物品库 (增加 npcId 以支持 NPC 专属给予)
  CREATE TABLE IF NOT EXISTS global_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    locationTag TEXT,  -- 这里将严格对应前端的 mapLocation.id
    npcId TEXT,        -- 对应给物品的 NPC id (如 npc_merchant)
    price INTEGER DEFAULT 0
  );

  -- 全局技能库 (增加 npcId 以支持 NPC 专属教学)
  CREATE TABLE IF NOT EXISTS global_skills (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    faction TEXT, 
    description TEXT,
    npcId TEXT         -- 对应教技能的 NPC id (如 npc_craftsman)
  );

  -- 墓碑表 (保留原有逻辑)
  CREATE TABLE IF NOT EXISTS tombstones (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    deathDescription TEXT,
    role TEXT,
    mentalRank TEXT,
    physicalRank TEXT,
    ability TEXT,
    spiritName TEXT,
    isHidden INTEGER DEFAULT 0
  );

  -- 精神体状态表
  CREATE TABLE IF NOT EXISTS spirit_status (
    userId INTEGER PRIMARY KEY,
    name TEXT,
    imageUrl TEXT,
    intimacy INTEGER DEFAULT 0,
    level INTEGER DEFAULT 1,
    hp INTEGER DEFAULT 100,
    status TEXT DEFAULT '良好',
    FOREIGN KEY(userId) REFERENCES users(id)
  );

  -- 玩家背包
  CREATE TABLE IF NOT EXISTS user_inventory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER,
    name TEXT,
    qty INTEGER DEFAULT 1,
    FOREIGN KEY(userId) REFERENCES users(id)
  );

  -- 玩家技能
  CREATE TABLE IF NOT EXISTS user_skills (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER,
    name TEXT,
    level INTEGER DEFAULT 1,
    FOREIGN KEY(userId) REFERENCES users(id)
  );

  -- 对戏记录 (增加 locationId 以支持地区分类)
  CREATE TABLE IF NOT EXISTS roleplay_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    senderId INTEGER,
    senderName TEXT,
    receiverId INTEGER,
    receiverName TEXT,
    content TEXT,
    locationId TEXT,
    isRead INTEGER DEFAULT 0,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- 委托任务表
  CREATE TABLE IF NOT EXISTS commissions (
    id TEXT PRIMARY KEY,
    publisherId INTEGER,
    publisherName TEXT,
    title TEXT,
    content TEXT,
    difficulty TEXT,
    reward INTEGER DEFAULT 0,
    isAnonymous INTEGER DEFAULT 0,
    status TEXT DEFAULT 'open',
    acceptedById INTEGER DEFAULT NULL,
    acceptedByName TEXT DEFAULT NULL,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- 拍卖行表 (新补充：支持玩家委托拍卖)
  CREATE TABLE IF NOT EXISTS auction_items (
    id TEXT PRIMARY KEY,
    itemId INTEGER,
    name TEXT,
    sellerId INTEGER,
    currentPrice INTEGER,
    minPrice INTEGER,
    highestBidderId INTEGER,
    status TEXT DEFAULT 'active',
    endsAt DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// 动态补全可能缺失的字段（向下兼容，防止旧库报错）
const addColumn = (table: string, col: string, type: string) => {
  try { db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${type}`); } catch (e) {}
};
['age', 'faction', 'job', 'hp', 'maxHp', 'mp', 'maxMp', 'workCount', 'trainCount'].forEach(c => addColumn('users', c, 'INTEGER DEFAULT 0'));
['mentalRank', 'physicalRank', 'ability', 'spiritName', 'isHidden', 'lastResetDate', 'lastCheckInDate'].forEach(c => addColumn('users', c, 'TEXT'));
addColumn('users', 'mentalProgress', 'REAL DEFAULT 0');
addColumn('roleplay_messages', 'locationId', 'TEXT');
addColumn('global_items', 'npcId', 'TEXT');
addColumn('global_skills', 'npcId', 'TEXT');

// ================= 2. 初始数据种子 (确保后台不为空) =================
const seedData = () => {
  const initialSkills = [
    { name: '精神梳理', faction: '向导', description: '安抚哨兵狂躁的精神图景。' },
    { name: '五感强化', faction: '哨兵', description: '短时间内极大提升战场感知力。' },
    { name: '圣所祷告', faction: '圣所', description: '未分化幼崽的必修课，平复情绪。' }
  ];
  const skillCount = db.prepare('SELECT COUNT(*) as count FROM global_skills').get() as any;
  if (skillCount.count === 0) {
    const insertSkill = db.prepare('INSERT INTO global_skills (name, faction, description) VALUES (?, ?, ?)');
    initialSkills.forEach(s => insertSkill.run(s.name, s.faction, s.description));
  }

  const initialItems = [
    { name: '过期向导素', locationTag: 'slums', price: 50, description: '效果存疑的廉价药剂。' },
    { name: '高级营养液', locationTag: 'rich_area', price: 500, description: '富人区的日常补给。' }
  ];
  const itemCount = db.prepare('SELECT COUNT(*) as count FROM global_items').get() as any;
  if (itemCount.count === 0) {
    const insertItem = db.prepare('INSERT INTO global_items (name, description, locationTag, price) VALUES (?, ?, ?, ?)');
    initialItems.forEach(i => insertItem.run(i.name, i.description, i.locationTag, i.price));
  }
};
seedData();

// ================= 3. 辅助配置 =================
const JOB_SALARIES: Record<string, number> = { '神使': 1000, '侍奉者': 1000, '神使后裔': 0, '仆从': 500 };
const JOB_LIMITS: Record<string, number> = { '神使': 1, '侍奉者': 2, '神使后裔': 2, '仆从': 9999 };
const getLocalToday = () => new Date().toISOString().split('T')[0];

async function startServer() {
  const app = express();
  const PORT = process.env.PORT || 3000;
  app.use(express.json({ limit: '50mb' }));

  // ================= 4. 管理员专属 API =================
  app.post('/api/admin/items', (req, res) => {
    const { name, description, locationTag, npcId, price } = req.body;
    db.prepare('INSERT INTO global_items (name, description, locationTag, npcId, price) VALUES (?, ?, ?, ?, ?)').run(name, description, locationTag, npcId || null, price);
    res.json({ success: true });
  });

  app.post('/api/admin/skills', (req, res) => {
    const { name, faction, description, npcId } = req.body;
    db.prepare('INSERT INTO global_skills (name, faction, description, npcId) VALUES (?, ?, ?, ?)').run(name, faction, description, npcId || null);
    res.json({ success: true });
  });

  // ================= 5. 游戏前端核心 API =================
  
  // --- 濒死与急救系统 API ---
  app.post('/api/rescue/request', (req, res) => {
    const { patientId, healerId } = req.body;
    db.prepare('INSERT INTO rescue_requests (patientId, healerId) VALUES (?, ?)').run(patientId, healerId);
    res.json({ success: true });
  });

  app.get('/api/rescue/check/:userId', (req, res) => {
    const { userId } = req.params;
    const incoming = db.prepare('SELECT r.*, u.name as patientName FROM rescue_requests r JOIN users u ON r.patientId = u.id WHERE r.healerId = ? AND r.status = "pending"').get(userId);
    const outgoing = db.prepare('SELECT * FROM rescue_requests WHERE patientId = ? ORDER BY id DESC LIMIT 1').get(userId);
    res.json({ success: true, incoming, outgoing });
  });

  app.post('/api/rescue/accept', (req, res) => {
    const { requestId } = req.body;
    db.prepare('UPDATE rescue_requests SET status = "accepted" WHERE id = ?').run(requestId);
    res.json({ success: true });
  });

  app.post('/api/rescue/confirm', (req, res) => {
    const { patientId } = req.body;
    db.prepare('UPDATE users SET hp = 20 WHERE id = ?').run(patientId);
    db.prepare('DELETE FROM rescue_requests WHERE patientId = ?').run(patientId);
    res.json({ success: true });
  });

  // --- 死亡/变鬼 提交审核 API ---
  app.post('/api/users/:id/submit-death', (req, res) => {
    const { type, text } = req.body;
    db.prepare('UPDATE users SET status = ?, deathDescription = ? WHERE id = ?').run(type, text, req.params.id);
    res.json({ success: true });
  });

  // 获取全服玩家数据 (包含年龄和派系预处理)
  app.get('/api/admin/users', (req, res) => {
    try {
      const users = db.prepare('SELECT * FROM users').all();
      const processedUsers = users.map((u: any) => ({
        ...u,
        faction: u.age < 16 ? '圣所' : u.faction,
        role: u.age < 16 ? '未分化' : u.role
      }));
      res.json({ success: true, users: processedUsers });
    } catch (error: any) { res.status(500).json({ success: false, message: error.message }); }
  });

  app.post('/api/admin/users/:id/status', (req, res) => {
    db.prepare('UPDATE users SET status = ? WHERE id = ?').run(req.body.status, req.params.id);
    res.json({ success: true });
  });

  app.delete('/api/admin/users/:id', (req, res) => {
    db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  });

  app.put('/api/admin/users/:id', (req, res) => {
    const { role, age, faction, mentalRank, physicalRank, ability, spiritName, profileText, status } = req.body;
    // status 参数是为了化鬼审批而保留的
    db.prepare(`UPDATE users SET role=?, age=?, faction=?, mentalRank=?, physicalRank=?, ability=?, spiritName=?, profileText=?, status=? WHERE id=?`)
      .run(role, age, faction, mentalRank, physicalRank, ability, spiritName, profileText, status || 'approved', req.params.id);
    res.json({ success: true });
  });

  app.get('/api/admin/roleplay_logs', (req, res) => {
    const logs = db.prepare(`SELECT * FROM roleplay_messages ORDER BY locationId ASC, createdAt DESC`).all();
    res.json({ success: true, logs });
  });

  // 全局物品管理
  app.get('/api/items', (req, res) => res.json({ success: true, items: db.prepare('SELECT * FROM global_items').all() }));
  app.delete('/api/admin/items/:id', (req, res) => {
    db.prepare('DELETE FROM global_items WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  });

  // 全局技能管理
  app.get('/api/skills', (req, res) => res.json({ success: true, skills: db.prepare('SELECT * FROM global_skills').all() }));
  app.delete('/api/admin/skills/:id', (req, res) => {
    db.prepare('DELETE FROM global_skills WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  });

  // --- 玩家基础信息 ---
  app.get('/api/users/:name', (req, res) => {
    const user = db.prepare('SELECT * FROM users WHERE name = ?').get(req.params.name) as any;
    if (user) {
      const today = getLocalToday();
      if (user.lastResetDate !== today) {
        db.prepare('UPDATE users SET workCount = 0, trainCount = 0, lastResetDate = ? WHERE id = ?').run(today, user.id);
        user.workCount = 0; user.trainCount = 0;
      }
      if (user.age < 16) { user.faction = '圣所'; user.role = '未分化'; }
      res.json({ success: true, user });
    } else {
      res.json({ success: false, message: 'User not found' });
    }
  });

  app.post('/api/users/init', (req, res) => {
    try {
      db.prepare(`INSERT INTO users (name, status) VALUES (?, 'pending')`).run(req.body.name);
      res.json({ success: true });
    } catch (e: any) { res.json({ success: false, message: '初始化失败' }); }
  });

  app.post('/api/users/:id/location', (req, res) => {
    db.prepare('UPDATE users SET currentLocation = ? WHERE id = ?').run(req.body.locationId, req.params.id);
    res.json({ success: true });
  });

  app.put('/api/users/:id/avatar', (req, res) => {
    db.prepare('UPDATE users SET avatarUrl = ? WHERE id = ?').run(req.body.avatarUrl, req.params.id);
    res.json({ success: true });
  });

  // --- 背包系统 (新补充) ---
  app.get('/api/users/:id/inventory', (req, res) => {
    const items = db.prepare('SELECT * FROM user_inventory WHERE userId = ?').all(req.params.id);
    res.json({ success: true, items });
  });

  app.post('/api/users/:id/inventory/add', (req, res) => {
    const { name, qty } = req.body;
    const userId = req.params.id;
    const existing = db.prepare('SELECT * FROM user_inventory WHERE userId = ? AND name = ?').get(userId, name) as any;
    if (existing) {
      db.prepare('UPDATE user_inventory SET qty = qty + ? WHERE id = ?').run(qty || 1, existing.id);
    } else {
      db.prepare('INSERT INTO user_inventory (userId, name, qty) VALUES (?, ?, ?)').run(userId, name, qty || 1);
    }
    res.json({ success: true });
  });

  // --- 商店系统 (新补充) ---
  app.get('/api/market/goods', (req, res) => {
    // 拉取所有配置了价格的物品作为商店货物
    const goods = db.prepare('SELECT * FROM global_items WHERE price > 0').all();
    res.json({ success: true, goods });
  });

  app.post('/api/market/buy', (req, res) => {
    const { userId, itemId } = req.body;
    try {
      const item = db.prepare('SELECT * FROM global_items WHERE id = ?').get(itemId) as any;
      const user = db.prepare('SELECT gold FROM users WHERE id = ?').get(userId) as any;

      if (!item || !user) return res.json({ success: false, message: '数据异常' });
      if (user.gold < item.price) return res.json({ success: false, message: '金币不足' });

      // 扣除金币
      db.prepare('UPDATE users SET gold = gold - ? WHERE id = ?').run(item.price, userId);
      
      // 添加到背包
      const existing = db.prepare('SELECT * FROM user_inventory WHERE userId = ? AND name = ?').get(userId, item.name) as any;
      if (existing) {
        db.prepare('UPDATE user_inventory SET qty = qty + 1 WHERE id = ?').run(existing.id);
      } else {
        db.prepare('INSERT INTO user_inventory (userId, name, qty) VALUES (?, ?, 1)').run(userId, item.name);
      }
      res.json({ success: true });
    } catch (e: any) { res.status(500).json({ success: false, message: e.message }); }
  });

  // --- 拍卖行系统 (新补充) ---
  app.get('/api/auction/items', (req, res) => {
    const items = db.prepare("SELECT * FROM auction_items WHERE status = 'active'").all();
    res.json({ success: true, items });
  });

  app.post('/api/auction/consign', (req, res) => {
    const { userId, itemId, minPrice } = req.body;
    try {
      const invItem = db.prepare('SELECT * FROM user_inventory WHERE id = ? AND userId = ?').get(itemId, userId) as any;
      if (!invItem || invItem.qty < 1) return res.json({ success: false, message: '背包中没有该物品' });

      // 扣除物品
      if (invItem.qty === 1) {
        db.prepare('DELETE FROM user_inventory WHERE id = ?').run(itemId);
      } else {
        db.prepare('UPDATE user_inventory SET qty = qty - 1 WHERE id = ?').run(itemId);
      }

      // 上架拍卖行
      const auctionId = `AUC-${Date.now()}`;
      db.prepare('INSERT INTO auction_items (id, itemId, name, sellerId, currentPrice, minPrice) VALUES (?, ?, ?, ?, ?, ?)')
        .run(auctionId, itemId, invItem.name, userId, minPrice, minPrice);

      res.json({ success: true });
    } catch (e: any) { res.status(500).json({ success: false, message: e.message }); }
  });

  app.post('/api/auction/bid', (req, res) => {
    const { userId, itemId, price } = req.body;
    try {
      const auction = db.prepare("SELECT * FROM auction_items WHERE id = ? AND status = 'active'").get(itemId) as any;
      if (!auction) return res.json({ success: false, message: '拍卖已结束或不存在' });
      if (price <= auction.currentPrice) return res.json({ success: false, message: '出价必须高于当前价格' });

      const user = db.prepare('SELECT gold FROM users WHERE id = ?').get(userId) as any;
      if (user.gold < price) return res.json({ success: false, message: '金币不足' });

      // 如果有上一个竞拍者，退还金币
      if (auction.highestBidderId) {
        db.prepare('UPDATE users SET gold = gold + ? WHERE id = ?').run(auction.currentPrice, auction.highestBidderId);
      }

      // 扣除当前竞拍者金币并更新拍卖信息
      db.prepare('UPDATE users SET gold = gold - ? WHERE id = ?').run(price, userId);
      db.prepare('UPDATE auction_items SET currentPrice = ?, highestBidderId = ? WHERE id = ?').run(price, userId, itemId);

      res.json({ success: true });
    } catch (e: any) { res.status(500).json({ success: false, message: e.message }); }
  });


  // --- 技能与精神体 ---
  app.get('/api/skills/available/:userId', (req, res) => {
    const user = db.prepare('SELECT faction, age FROM users WHERE id = ?').get(req.params.userId) as any;
    if (!user) return res.status(404).json({ success: false });
    const faction = user.age < 16 ? '圣所' : user.faction;
    const skills = db.prepare('SELECT * FROM global_skills WHERE faction = ?').all(faction);
    res.json({ success: true, skills });
  });

  app.get('/api/users/:id/skills', (req, res) => {
    res.json({ success: true, skills: db.prepare('SELECT * FROM user_skills WHERE userId = ?').all(req.params.id) });
  });

  app.post('/api/users/:id/skills', (req, res) => {
    db.prepare('INSERT INTO user_skills (userId, name, level) VALUES (?, ?, 1)').run(req.params.id, req.body.name);
    res.json({ success: true });
  });

  app.get('/api/users/:id/spirit-status', (req, res) => {
    let status = db.prepare('SELECT * FROM spirit_status WHERE userId = ?').get(req.params.id);
    if (!status) {
      db.prepare('INSERT INTO spirit_status (userId) VALUES (?)').run(req.params.id);
      status = { userId: req.params.id, intimacy: 0, level: 1, hp: 100, status: '良好' };
    }
    res.json({ success: true, spiritStatus: status });
  });

  app.post('/api/tower/interact-spirit', (req, res) => {
    const { userId, intimacyGain, imageUrl, name } = req.body;
    const status = db.prepare('SELECT * FROM spirit_status WHERE userId = ?').get(userId) as any;
    const user = db.prepare('SELECT mentalProgress FROM users WHERE id = ?').get(userId) as any;
    
    if (imageUrl) db.prepare('UPDATE spirit_status SET imageUrl = ? WHERE userId = ?').run(imageUrl, userId);
    if (name) db.prepare('UPDATE spirit_status SET name = ? WHERE userId = ?').run(name, userId);

    let newIntimacy = (status.intimacy || 0) + (intimacyGain || 0);
    let levelGain = Math.floor(newIntimacy / 100);
    let finalIntimacy = newIntimacy % 100;
    let newMentalProgress = Math.min(100, (user.mentalProgress || 0) + (levelGain * 20));

    db.prepare('UPDATE spirit_status SET intimacy = ?, level = level + ? WHERE userId = ?').run(finalIntimacy, levelGain, userId);
    db.prepare('UPDATE users SET mentalProgress = ? WHERE id = ?').run(newMentalProgress, userId);
    res.json({ success: true, levelUp: levelGain > 0 });
  });

  // --- 命之塔职场 ---
  app.post('/api/tower/join', (req, res) => {
    const { userId, jobName } = req.body;
    try {
      const user = db.prepare('SELECT job FROM users WHERE id = ?').get(userId) as any;
      if (!user) return res.json({ success: false, message: '用户不存在' });
      if (user.job && user.job !== '无') return res.json({ success: false, message: '已有职位' });

      const currentCount = db.prepare('SELECT COUNT(*) as count FROM users WHERE job = ?').get(jobName) as any;
      if (currentCount.count >= (JOB_LIMITS[jobName] || 0)) return res.json({ success: false, message: '该职位名额已满。' });

      db.prepare('UPDATE users SET job = ? WHERE id = ?').run(jobName, userId);
      res.json({ success: true });
    } catch (error: any) { res.status(500).json({ success: false, message: error.message }); }
  });

  app.post('/api/tower/checkin', (req, res) => {
    const { userId } = req.body;
    const today = getLocalToday();
    const user = db.prepare('SELECT job, lastCheckInDate FROM users WHERE id = ?').get(userId) as any;
    if (!user || !user.job || user.job === '无') return res.json({ success: false, message: '无法签到' });
    if (user.lastCheckInDate === today) return res.json({ success: false, message: '今日已领取过工资' });

    const salary = JOB_SALARIES[user.job] || 0;
    db.prepare('UPDATE users SET gold = gold + ?, lastCheckInDate = ? WHERE id = ?').run(salary, today, userId);
    res.json({ success: true, reward: salary });
  });

  // --- 对戏与委托 ---
  app.post('/api/roleplay', (req, res) => {
    const { senderId, senderName, receiverId, receiverName, content, locationId } = req.body;
    db.prepare('INSERT INTO roleplay_messages (senderId, senderName, receiverId, receiverName, content, locationId) VALUES (?, ?, ?, ?, ?, ?)').run(senderId, senderName, receiverId, receiverName, content, locationId);
    res.json({ success: true });
  });

  app.get('/api/roleplay/conversation/:userId/:otherId', (req, res) => {
    const { userId, otherId } = req.params;
    const messages = db.prepare('SELECT * FROM roleplay_messages WHERE (senderId = ? AND receiverId = ?) OR (senderId = ? AND receiverId = ?) ORDER BY createdAt ASC').all(userId, otherId, otherId, userId);
    db.prepare('UPDATE roleplay_messages SET isRead = 1 WHERE receiverId = ? AND senderId = ?').run(userId, otherId);
    res.json({ success: true, messages });
  });

  app.get('/api/roleplay/unread/:userId', (req, res) => {
    const result = db.prepare('SELECT COUNT(*) as count FROM roleplay_messages WHERE receiverId = ? AND isRead = 0').get(req.params.userId) as any;
    res.json({ success: true, count: result.count || 0 });
  });

  app.get('/api/commissions', (req, res) => res.json({ success: true, commissions: db.prepare('SELECT * FROM commissions ORDER BY createdAt DESC').all() }));
  
  app.post('/api/commissions', (req, res) => {
    const { id, publisherId, publisherName, title, content, difficulty, reward, isAnonymous } = req.body;
    db.prepare('UPDATE users SET gold = gold - ? WHERE id = ?').run(reward || 0, publisherId);
    db.prepare('INSERT INTO commissions (id, publisherId, publisherName, title, content, difficulty, reward, isAnonymous) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(id, publisherId, publisherName, title, content, difficulty || 'C', reward || 0, isAnonymous ? 1 : 0);
    res.json({ success: true });
  });

  app.put('/api/commissions/:id/accept', (req, res) => {
    db.prepare('UPDATE commissions SET status = "accepted", acceptedById = ?, acceptedByName = ? WHERE id = ?').run(req.body.userId, req.body.userName, req.params.id);
    res.json({ success: true });
  });

  // ================= 6. 核心前端页面路由转发 =================
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
    
    app.use('*', async (req, res, next) => {
      if (req.originalUrl.startsWith('/api')) return next();
      try {
        let template = '<!DOCTYPE html><html><head></head><body><div id="root"></div><script type="module" src="/src/main.tsx"></script></body></html>';
        template = await vite.transformIndexHtml(req.originalUrl, template);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e) {
        vite.ssrFixStacktrace(e as Error);
        next(e);
      }
    });
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      if (req.originalUrl.startsWith('/api')) return res.status(404).send('API not found');
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Server running on port ${PORT}`));
}

startServer();

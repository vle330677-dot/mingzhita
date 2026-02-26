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

// ================= 数据库初始化 =================
db.exec(`
  -- 用户主表
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE,
    role TEXT,
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

  -- 物品库 (全局模板)
  CREATE TABLE IF NOT EXISTS global_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    description TEXT,
    locationTag TEXT, -- 对应地图地址，如 'slums', 'rich_area'
    price INTEGER DEFAULT 0,
    type TEXT -- 'consumable', 'weapon', etc.
  );

  -- 玩家背包
  CREATE TABLE IF NOT EXISTS user_inventory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER,
    itemId INTEGER,
    name TEXT,
    qty INTEGER DEFAULT 1,
    FOREIGN KEY(userId) REFERENCES users(id)
  );

  -- 技能库 (全局模板)
  CREATE TABLE IF NOT EXISTS global_skills (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    faction TEXT, -- 八大派系
    description TEXT
  );

  -- 玩家技能
  CREATE TABLE IF NOT EXISTS user_skills (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER,
    name TEXT,
    level INTEGER DEFAULT 1,
    FOREIGN KEY(userId) REFERENCES users(id)
  );

  -- 对戏消息 (增加地点记录)
  CREATE TABLE IF NOT EXISTS roleplay_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    senderId INTEGER,
    senderName TEXT,
    receiverId INTEGER,
    receiverName TEXT,
    content TEXT,
    locationId TEXT, -- 新增：记录对戏发生的地点
    isRead INTEGER DEFAULT 0,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- 拍卖行
  CREATE TABLE IF NOT EXISTS auction_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    sellerId INTEGER,
    currentPrice INTEGER,
    minPrice INTEGER,
    highestBidderId INTEGER,
    endsAt DATETIME,
    status TEXT DEFAULT 'active'
  );

  -- 精神体状态
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
`);

// 辅助函数：动态增加列（向下兼容）
const addColumn = (table: string, col: string, type: string) => {
  try { db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${type}`); } catch (e) {}
};
addColumn('roleplay_messages', 'locationId', 'TEXT');

// ================= 辅助逻辑 =================
const JOB_SALARIES: Record<string, number> = { '神使': 1000, '侍奉者': 1000, '神使后裔': 800, '仆从': 500 };
const JOB_LIMITS: Record<string, number> = { '神使': 1, '侍奉者': 2, '神使后裔': 2, '仆从': 9999 };

const getLocalToday = () => new Date().toISOString().split('T')[0];

async function startServer() {
  const app = express();
  const PORT = process.env.PORT || 3000;
  app.use(express.json({ limit: '50mb' }));

  // ================= 1. 管理员后台 API =================

  // 获取所有玩家 (与游戏同步)
  app.get('/api/admin/users', (req, res) => {
    const users = db.prepare('SELECT * FROM users').all();
    res.json({ success: true, users });
  });

  // 分类获取对戏日志
  app.get('/api/admin/roleplay_logs', (req, res) => {
    // 按照地点和人物进行归纳排序
    const logs = db.prepare(`
      SELECT * FROM roleplay_messages 
      ORDER BY locationId DESC, createdAt DESC
    `).all();
    res.json({ success: true, logs });
  });

  // 管理物品：添加/删除/查看
  app.get('/api/admin/items', (req, res) => {
    res.json({ success: true, items: db.prepare('SELECT * FROM global_items').all() });
  });

  app.post('/api/admin/items', (req, res) => {
    const { name, description, locationTag, price } = req.body;
    db.prepare('INSERT INTO global_items (name, description, locationTag, price) VALUES (?, ?, ?, ?)').run(name, description, locationTag, price);
    res.json({ success: true });
  });

  app.delete('/api/admin/items/:id', (req, res) => {
    db.prepare('DELETE FROM global_items WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  });

  // 管理技能：按派系添加
  app.get('/api/admin/skills', (req, res) => {
    res.json({ success: true, skills: db.prepare('SELECT * FROM global_skills').all() });
  });

  app.post('/api/admin/skills', (req, res) => {
    const { name, faction, description } = req.body;
    db.prepare('INSERT INTO global_skills (name, faction, description) VALUES (?, ?, ?)').run(name, faction, description);
    res.json({ success: true });
  });

  // ================= 2. 游戏系统 API =================

  // 背包系统
  app.get('/api/users/:id/inventory', (req, res) => {
    const items = db.prepare('SELECT * FROM user_inventory WHERE userId = ?').all(req.params.id);
    res.json({ success: true, items });
  });

  app.post('/api/users/:id/inventory/add', (req, res) => {
    const { name, qty, source } = req.body;
    const exist = db.prepare('SELECT * FROM user_inventory WHERE userId = ? AND name = ?').get(req.params.id, name) as any;
    if (exist) {
      db.prepare('UPDATE user_inventory SET qty = qty + ? WHERE id = ?').run(qty, exist.id);
    } else {
      db.prepare('INSERT INTO user_inventory (userId, name, qty) VALUES (?, ?, ?)').run(req.params.id, name, qty);
    }
    res.json({ success: true });
  });

  // 商店：根据当前地点获取物品
  app.get('/api/market/goods', (req, res) => {
    const { location } = req.query;
    const goods = db.prepare('SELECT * FROM global_items WHERE locationTag = ?').all(location);
    res.json({ success: true, goods });
  });

  app.post('/api/market/buy', (req, res) => {
    const { userId, itemId } = req.body;
    const item = db.prepare('SELECT * FROM global_items WHERE id = ?').get(itemId) as any;
    const user = db.prepare('SELECT gold FROM users WHERE id = ?').get(userId) as any;

    if (user.gold < item.price) return res.json({ success: false, message: '金币不足' });

    db.transaction(() => {
      db.prepare('UPDATE users SET gold = gold - ? WHERE id = ?').run(item.price, userId);
      db.prepare('INSERT INTO user_inventory (userId, name, qty) VALUES (?, ?, 1)').run(userId, item.name);
    })();
    res.json({ success: true });
  });

  // 命之塔系统 (修正名额判定)
  app.post('/api/tower/join', (req, res) => {
    const { userId, jobName } = req.body;
    const currentCount = db.prepare('SELECT COUNT(*) as count FROM users WHERE job = ?').get(jobName) as any;
    if (currentCount.count >= (JOB_LIMITS[jobName] || 0)) {
      return res.json({ success: false, message: `【${jobName}】名额已满，无法入职` });
    }
    db.prepare('UPDATE users SET job = ? WHERE id = ?').run(jobName, userId);
    res.json({ success: true });
  });

  // 用户基础获取与重置
  app.get('/api/users/:name', (req, res) => {
    const user = db.prepare('SELECT * FROM users WHERE name = ?').get(req.params.name) as any;
    if (user) {
      const today = getLocalToday();
      if (user.lastResetDate !== today) {
        db.prepare('UPDATE users SET workCount = 0, trainCount = 0, lastResetDate = ? WHERE id = ?').run(today, user.id);
        user.workCount = 0;
      }
      res.json({ success: true, user });
    } else {
      res.json({ success: false });
    }
  });

  // 对戏消息
  app.post('/api/roleplay', (req, res) => {
    const { senderId, senderName, receiverId, receiverName, content, locationId } = req.body;
    db.prepare(`
      INSERT INTO roleplay_messages (senderId, senderName, receiverId, receiverName, content, locationId) 
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(senderId, senderName, receiverId, receiverName, content, locationId);
    res.json({ success: true });
  });

  // ================= 环境配置 =================
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
    app.use('*', async (req, res, next) => {
      if (req.originalUrl.startsWith('/api')) return next();
      let template = await vite.transformIndexHtml(req.originalUrl, '<!DOCTYPE html><html><head></head><body><div id="root"></div><script type="module" src="/src/main.tsx"></script></body></html>');
      res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
    });
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => res.sendFile(path.join(distPath, 'index.html')));
  }

  app.listen(PORT, '0.0.0.0', () => console.log(`Server running on port ${PORT}`));
}

startServer();

import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = process.env.DB_PATH || 'game.db';
const db = new Database(dbPath);

// ================= 数据库初始化 =================
db.exec(`
  PRAGMA foreign_keys = ON;

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
    currentLocation TEXT
  );

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

  -- 用户背包（老表沿用，扩展为库存）
  CREATE TABLE IF NOT EXISTS items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER,
    name TEXT,
    description TEXT,
    qty INTEGER DEFAULT 1,
    itemDefId TEXT,
    FOREIGN KEY(userId) REFERENCES users(id)
  );

  -- 对戏消息
  CREATE TABLE IF NOT EXISTS roleplay_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    senderId INTEGER,
    senderName TEXT,
    receiverId INTEGER,
    receiverName TEXT,
    content TEXT,
    isRead INTEGER DEFAULT 0,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    locationId TEXT,
    locationName TEXT
  );

  CREATE TABLE IF NOT EXISTS commissions (
    id TEXT PRIMARY KEY,
    publisherId INTEGER,
    publisherName TEXT,
    title TEXT,
    content TEXT,
    difficulty TEXT,
    status TEXT DEFAULT 'open',
    acceptedById INTEGER DEFAULT NULL,
    acceptedByName TEXT DEFAULT NULL,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS user_skills (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER,
    name TEXT,
    level INTEGER DEFAULT 1,
    FOREIGN KEY(userId) REFERENCES users(id)
  );

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

  -- 物品模板（由管理员维护）
  CREATE TABLE IF NOT EXISTS item_defs (
    id TEXT PRIMARY KEY,
    name TEXT,
    locationId TEXT,
    type TEXT,
    rarity TEXT,
    basePrice INTEGER,
    description TEXT
  );

  -- 商店上架表
  CREATE TABLE IF NOT EXISTS market_goods (
    id TEXT PRIMARY KEY,
    itemDefId TEXT,
    name TEXT,
    price INTEGER,
    rarity TEXT,
    available INTEGER DEFAULT 1
  );

  -- 拍卖品
  CREATE TABLE IF NOT EXISTS auction_items (
    id TEXT PRIMARY KEY,
    name TEXT,
    sellerId INTEGER,
    currentPrice INTEGER,
    minPrice INTEGER,
    highestBidderId INTEGER,
    endsAt DATETIME,
    status TEXT DEFAULT 'open'
  );

  -- 技能模板（派系）
  CREATE TABLE IF NOT EXISTS skills_templates (
    id TEXT PRIMARY KEY,
    name TEXT,
    faction TEXT,
    description TEXT,
    maxLevel INTEGER
  );
`);

const addColumn = (table, col, type) => {
  try { db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${type}`); } catch (e) {}
};

// users 补充字段
[
  'gender', 'height', 'age', 'orientation', 'faction', 'factionRole',
  'personality', 'appearance', 'clothing', 'background', 'currentLocation',
  'job', 'lastResetDate', 'lastCheckInDate'
].forEach(c => addColumn('users', c, 'TEXT'));
['hp', 'maxHp', 'mp', 'maxMp', 'workCount', 'trainCount'].forEach(c => addColumn('users', c, 'INTEGER DEFAULT 0'));
addColumn('users', 'mentalProgress', 'REAL DEFAULT 0');
addColumn('users', 'isHidden', 'INTEGER DEFAULT 0'); // 冗余调用安全

// roleplay_messages 新字段（地点）
addColumn('roleplay_messages', 'locationId', 'TEXT');
addColumn('roleplay_messages', 'locationName', 'TEXT');

// items（背包）扩展字段
addColumn('items', 'qty', 'INTEGER DEFAULT 1');
addColumn('items', 'itemDefId', 'TEXT');

// 初始化数值补丁
db.prepare("UPDATE users SET hp = COALESCE(NULLIF(hp,0),100), maxHp = COALESCE(NULLIF(maxHp,0),100), mp = COALESCE(NULLIF(mp,0),100), maxMp = COALESCE(NULLIF(maxMp,0),100) WHERE 1=1").run();

// 简易索引
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_users_location ON users(currentLocation);
  CREATE INDEX IF NOT EXISTS idx_roleplay_receiver ON roleplay_messages(receiverId, isRead);
  CREATE INDEX IF NOT EXISTS idx_items_user ON items(userId);
  CREATE INDEX IF NOT EXISTS idx_itemdefs_loc ON item_defs(locationId);
  CREATE INDEX IF NOT EXISTS idx_auction_status ON auction_items(status);
`);

// 职位名额与工资配置
const JOB_SALARIES = { '神使': 1000, '侍奉者': 1000, '神使后裔': 0, '仆从': 500 };
const JOB_LIMITS = { '神使': 1, '侍奉者': 2, '神使后裔': 2, '仆从': 9999 };

// ============ SSE: 管理端实时流 ============
const sseClients = new Set();
const broadcast = (topic) => {
  const payload = `data: ${topic}\n\n`;
  for (const res of sseClients) {
    try { res.write(payload); } catch {}
  }
};

async function startServer() {
  const app = express();
  const PORT = process.env.PORT || 3000;
  app.use(express.json({ limit: '50mb' }));

  // ================= API Routes =================

  // 通用：获取某名字用户（保留）
  app.get('/api/users/:name', (req, res) => {
    const user = db.prepare('SELECT * FROM users WHERE name = ?').get(req.params.name);
    if (user) {
      const today = new Date().toISOString().split('T')[0];
      if (user.lastResetDate !== today) {
        db.prepare('UPDATE users SET workCount = 0, trainCount = 0, lastResetDate = ? WHERE id = ?').run(today, user.id);
        user.workCount = 0; user.trainCount = 0;
      }
      return res.json({ success: true, user });
    }
    res.json({ success: false, message: 'User not found' });
  });

  // 管理员：用户列表与操作
  app.get('/api/admin/users', (req, res) => {
    const users = db.prepare('SELECT * FROM users ORDER BY id ASC').all();
    res.json({ success: true, users });
  });

  app.post('/api/admin/users/:id/status', (req, res) => {
    const { status } = req.body;
    db.prepare('UPDATE users SET status = ? WHERE id = ?').run(status, req.params.id);
    broadcast('users_updated');
    res.json({ success: true });
  });

  app.put('/api/admin/users/:id/hide', (req, res) => {
    const { isHidden } = req.body;
    db.prepare('UPDATE users SET isHidden = ? WHERE id = ?').run(isHidden ? 1 : 0, req.params.id);
    broadcast('users_updated');
    res.json({ success: true });
  });

  app.put('/api/admin/users/:id', (req, res) => {
    const { role, mentalRank, physicalRank, ability, spiritName, profileText } = req.body;
    db.prepare(`UPDATE users SET role=?, mentalRank=?, physicalRank=?, ability=?, spiritName=?, profileText=? WHERE id=?`)
      .run(role, mentalRank, physicalRank, ability, spiritName, profileText, req.params.id);
    broadcast('users_updated');
    res.json({ success: true });
  });

  app.delete('/api/users/:id', (req, res) => {
    const id = req.params.id;
    db.prepare('DELETE FROM items WHERE userId = ?').run(id);
    db.prepare('DELETE FROM user_skills WHERE userId = ?').run(id);
    db.prepare('DELETE FROM roleplay_messages WHERE senderId = ? OR receiverId = ?').run(id, id);
    db.prepare('DELETE FROM spirit_status WHERE userId = ?').run(id);
    db.prepare('DELETE FROM users WHERE id = ?').run(id);
    broadcast('users_updated');
    res.json({ success: true });
  });

  // 管理员：上传资料（文本/图片）
  app.post('/api/admin/upload-profile', (req, res) => {
    const { name, text, imageBase64, mimeType } = req.body || {};
    const user = db.prepare('SELECT * FROM users WHERE name = ?').get(name);
    if (!user) return res.json({ success: false, message: 'user not found' });
    db.prepare('UPDATE users SET profileText = ?, avatarUrl = COALESCE(?, avatarUrl) WHERE id = ?')
      .run(text || '', imageBase64 || null, user.id);
    broadcast('users_updated');
    res.json({ success: true });
  });

  // SSE 与广播
  app.get('/api/admin/stream', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();
    res.write(`data: connected\n\n`);
    sseClients.add(res);
    req.on('close', () => sseClients.delete(res));
  });

  app.post('/api/admin/broadcast-sync', (req, res) => {
    const { topic } = req.body || {};
    broadcast(topic || 'ping');
    res.json({ success: true });
  });

  // 命之塔职位
  app.post('/api/tower/join', (req, res) => {
    const { userId, jobName } = req.body;
    try {
      const user = db.prepare('SELECT job FROM users WHERE id = ?').get(userId);
      if (user?.job && user.job !== '无') return res.json({ success: false, message: '你已经有职位了，请先离职。' });
      const currentCount = db.prepare('SELECT COUNT(*) as count FROM users WHERE job = ?').get(jobName);
      if ((currentCount?.count || 0) >= (JOB_LIMITS[jobName] || 0)) return res.json({ success: false, message: '该职位名额已满。' });
      db.prepare('UPDATE users SET job = ? WHERE id = ?').run(jobName, userId);
      broadcast('users_updated');
      res.json({ success: true });
    } catch (error) { res.status(500).json({ success: false, message: String(error?.message || error) }); }
  });

  app.post('/api/tower/checkin', (req, res) => {
    const { userId } = req.body;
    const today = new Date().toISOString().split('T')[0];
    try {
      const user = db.prepare('SELECT job, lastCheckInDate FROM users WHERE id = ?').get(userId);
      if (!user?.job || user.job === '无') return res.json({ success: false, message: '无职位人员无法签到' });
      if (user.lastCheckInDate === today) return res.json({ success: false, message: '今日已领取过工资' });
      const salary = JOB_SALARIES[user.job] || 0;
      db.prepare('UPDATE users SET gold = gold + ?, lastCheckInDate = ? WHERE id = ?').run(salary, today, userId);
      broadcast('users_updated');
      res.json({ success: true, reward: salary });
    } catch (error) { res.status(500).json({ success: false, message: String(error?.message || error) }); }
  });

  app.post('/api/tower/quit', (req, res) => {
    const { userId } = req.body;
    try {
      const user = db.prepare('SELECT job, gold FROM users WHERE id = ?').get(userId);
      const penalty = Math.floor((JOB_SALARIES[user?.job] || 0) * 0.3);
      const newGold = Math.max(0, (user?.gold || 0) - penalty);
      db.prepare('UPDATE users SET job = "无", gold = ? WHERE id = ?').run(newGold, userId);
      broadcast('users_updated');
      res.json({ success: true, penalty });
    } catch (error) { res.status(500).json({ success: false, message: String(error?.message || error) }); }
  });

  // 精神体
  app.get('/api/users/:id/spirit-status', (req, res) => {
    const { id } = req.params;
    let status = db.prepare('SELECT * FROM spirit_status WHERE userId = ?').get(id);
    if (!status) {
      db.prepare('INSERT INTO spirit_status (userId) VALUES (?)').run(id);
      status = { userId: id, intimacy: 0, level: 1, hp: 100, status: '良好' };
    }
    res.json({ success: true, spiritStatus: status });
  });

  app.post('/api/tower/interact-spirit', (req, res) => {
    const { userId, intimacyGain } = req.body;
    try {
      const status = db.prepare('SELECT * FROM spirit_status WHERE userId = ?').get(userId);
      const user = db.prepare('SELECT mentalProgress FROM users WHERE id = ?').get(userId);
      const curInt = (status?.intimacy || 0) + (intimacyGain || 0);
      const levelGain = Math.floor(curInt / 100);
      const finalIntimacy = curInt % 100;
      const newMental = Math.min(100, (user?.mentalProgress || 0) + levelGain * 20);
      db.prepare('UPDATE spirit_status SET intimacy = ?, level = level + ? WHERE userId = ?')
        .run(finalIntimacy, levelGain, userId);
      db.prepare('UPDATE users SET mentalProgress = ? WHERE id = ?').run(newMental, userId);
      broadcast('users_updated');
      res.json({ success: true, levelUp: levelGain > 0 });
    } catch (error) { res.status(500).json({ success: false, message: String(error?.message || error) }); }
  });

  // 聊天/对戏
  app.post('/api/roleplay', (req, res) => {
    const { senderId, senderName, receiverId, receiverName, content } = req.body;
    const loc = db.prepare('SELECT currentLocation FROM users WHERE id = ?').get(senderId);
    const locationId = loc?.currentLocation || null;
    db.prepare('INSERT INTO roleplay_messages (senderId, senderName, receiverId, receiverName, content, locationId) VALUES (?, ?, ?, ?, ?, ?)')
      .run(senderId, senderName, receiverId, receiverName, content, locationId);
    broadcast('roleplay_new');
    res.json({ success: true });
  });

  app.get('/api/roleplay/unread/:userId', (req, res) => {
    const row = db.prepare('SELECT COUNT(*) as c FROM roleplay_messages WHERE receiverId = ? AND isRead = 0').get(req.params.userId);
    res.json({ success: true, count: row?.c || 0 });
  });

  app.get('/api/roleplay/conversation/:userId/:otherId', (req, res) => {
    const { userId, otherId } = req.params;
    const messages = db.prepare(`
      SELECT * FROM roleplay_messages
      WHERE (senderId = ? AND receiverId = ?) OR (senderId = ? AND receiverId = ?)
      ORDER BY createdAt ASC
    `).all(userId, otherId, otherId, userId);
    db.prepare('UPDATE roleplay_messages SET isRead = 1 WHERE receiverId = ? AND senderId = ?').run(userId, otherId);
    res.json({ success: true, messages });
  });

  app.get('/api/admin/roleplay_logs', (req, res) => {
    const logs = db.prepare('SELECT * FROM roleplay_messages ORDER BY createdAt DESC').all();
    res.json({ success: true, logs });
  });

  // 委托
  app.get('/api/commissions', (req, res) => {
    const list = db.prepare('SELECT * FROM commissions ORDER BY createdAt DESC').all();
    res.json({ success: true, commissions: list });
  });

  app.post('/api/commissions', (req, res) => {
    const { id, publisherId, publisherName, title, content, difficulty, reward, isAnonymous } = req.body || {};
    db.prepare(`
      INSERT INTO commissions (id, publisherId, publisherName, title, content, difficulty, status)
      VALUES (?, ?, ?, ?, ?, ?, 'open')
    `).run(id, publisherId, publisherName, title, content, difficulty);
    res.json({ success: true });
  });

  app.put('/api/commissions/:id/accept', (req, res) => {
    const { userId, userName } = req.body || {};
    const row = db.prepare('SELECT status FROM commissions WHERE id = ?').get(req.params.id);
    if (!row) return res.json({ success: false, message: '委托不存在' });
    if (row.status !== 'open') return res.json({ success: false, message: '委托已被接取或关闭' });
    db.prepare('UPDATE commissions SET status = "accepted", acceptedById = ?, acceptedByName = ? WHERE id = ?')
      .run(userId, userName, req.params.id);
    res.json({ success: true });
  });

  // 技能（实例）
  app.get('/api/users/:id/skills', (req, res) => {
    const list = db.prepare('SELECT * FROM user_skills WHERE userId = ?').all(req.params.id);
    res.json({ success: true, skills: list });
  });

  app.post('/api/users/:id/skills', (req, res) => {
    const { name } = req.body || {};
    if (!name) return res.json({ success: false, message: '缺少技能名' });
    const exist = db.prepare('SELECT id FROM user_skills WHERE userId = ? AND name = ?').get(req.params.id, name);
    if (exist) return res.json({ success: true }); // 已存在视为成功
    db.prepare('INSERT INTO user_skills (userId, name, level) VALUES (?, ?, 1)').run(req.params.id, name);
    res.json({ success: true });
  });

  // 头像
  app.put('/api/users/:id/avatar', (req, res) => {
    const { avatarUrl } = req.body || {};
    db.prepare('UPDATE users SET avatarUrl = ? WHERE id = ?').run(avatarUrl || null, req.params.id);
    broadcast('users_updated');
    res.json({ success: true });
  });

  // 地点与位置
  app.post('/api/users/:id/location', (req, res) => {
    db.prepare('UPDATE users SET currentLocation = ? WHERE id = ?').run(req.body.locationId || null, req.params.id);
    broadcast('users_updated');
    res.json({ success: true });
  });

  // 背包
  app.get('/api/users/:id/inventory', (req, res) => {
    const list = db.prepare('SELECT id, name, qty FROM items WHERE userId = ? ORDER BY id DESC').all(req.params.id);
    res.json({ success: true, items: list });
  });

  app.post('/api/users/:id/inventory/add', (req, res) => {
    const { name, qty } = req.body || {};
    if (!name) return res.json({ success: false, message: '缺少物品名' });
    const row = db.prepare('SELECT id, qty FROM items WHERE userId = ? AND name = ?').get(req.params.id, name);
    if (row) {
      db.prepare('UPDATE items SET qty = qty + ? WHERE id = ?').run(qty || 1, row.id);
    } else {
      db.prepare('INSERT INTO items (userId, name, qty) VALUES (?, ?, ?)').run(req.params.id, name, qty || 1);
    }
    res.json({ success: true });
  });

  // 物品模板（管理员维护）
  app.get('/api/admin/items', (req, res) => {
    const items = db.prepare('SELECT * FROM item_defs ORDER BY name ASC').all();
    res.json({ success: true, items });
  });

  app.post('/api/admin/items', (req, res) => {
    const { id, name, locationId, type, rarity, basePrice, description } = req.body || {};
    const itmId = id || `ITM-${Date.now()}`;
    db.prepare(`
      INSERT INTO item_defs (id, name, locationId, type, rarity, basePrice, description)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(itmId, name, locationId, type, rarity, basePrice, description);
    broadcast('items_updated');
    res.json({ success: true, id: itmId });
  });

  app.put('/api/admin/items/:id', (req, res) => {
    const { name, locationId, type, rarity, basePrice, description } = req.body || {};
    db.prepare(`
      UPDATE item_defs SET name=?, locationId=?, type=?, rarity=?, basePrice=?, description=? WHERE id=?
    `).run(name, locationId, type, rarity, basePrice, description, req.params.id);
    broadcast('items_updated');
    res.json({ success: true });
  });

  app.delete('/api/admin/items/:id', (req, res) => {
    db.prepare('DELETE FROM item_defs WHERE id = ?').run(req.params.id);
    broadcast('items_updated');
    res.json({ success: true });
  });

  // 按地点查询物品模板（游戏端探索掉落调用）
  app.get('/api/items/by-location', (req, res) => {
    const { locationId } = req.query;
    const list = db.prepare('SELECT * FROM item_defs WHERE locationId = ?').all(String(locationId || ''));
    res.json({ success: true, items: list });
  });

  // 商店（富人区）
  app.get('/api/market/goods', (req, res) => {
    const goods = db.prepare('SELECT * FROM market_goods WHERE available = 1 ORDER BY rowid DESC').all();
    res.json({ success: true, goods });
  });

  app.post('/api/market/buy', (req, res) => {
    const { userId, itemId } = req.body || {};
    const good = db.prepare('SELECT * FROM market_goods WHERE id = ? AND available = 1').get(itemId);
    if (!good) return res.json({ success: false, message: '商品不存在或已售罄' });
    const user = db.prepare('SELECT gold FROM users WHERE id = ?').get(userId);
    if ((user?.gold || 0) < good.price) return res.json({ success: false, message: '金币不足' });
    // 扣钱、发货、下架
    db.prepare('UPDATE users SET gold = gold - ? WHERE id = ?').run(good.price, userId);
    const held = db.prepare('SELECT id, qty FROM items WHERE userId = ? AND name = ?').get(userId, good.name);
    if (held) db.prepare('UPDATE items SET qty = qty + 1 WHERE id = ?').run(held.id);
    else db.prepare('INSERT INTO items (userId, name, qty) VALUES (?, ?, 1)').run(userId, good.name);
    db.prepare('UPDATE market_goods SET available = 0 WHERE id = ?').run(itemId);
    broadcast('users_updated');
    res.json({ success: true });
  });

  // 拍卖
  app.get('/api/auction/items', (req, res) => {
    const list = db.prepare('SELECT * FROM auction_items WHERE status = "open" ORDER BY endsAt ASC').all();
    res.json({ success: true, items: list });
  });

  app.post('/api/auction/consign', (req, res) => {
    const { userId, itemId, minPrice } = req.body || {};
    // 从背包扣除一件（简单按 id 扣）
    const inv = db.prepare('SELECT id, name, qty FROM items WHERE id = ? AND userId = ?').get(itemId, userId);
    if (!inv) return res.json({ success: false, message: '背包中没有该物品' });
    if (inv.qty <= 0) return res.json({ success: false, message: '数量不足' });
    db.prepare('UPDATE items SET qty = qty - 1 WHERE id = ?').run(inv.id);
    // 若为 0 清除该行
    db.prepare('DELETE FROM items WHERE id = ? AND qty <= 0').run(inv.id);

    const aucId = `AUC-${Date.now()}`;
    const endsAt = new Date(Date.now() + 24 * 3600 * 1000).toISOString(); // 24h
    db.prepare(`
      INSERT INTO auction_items (id, name, sellerId, currentPrice, minPrice, status, endsAt)
      VALUES (?, ?, ?, ?, ?, 'open', ?)
    `).run(aucId, inv.name, userId, minPrice, minPrice, endsAt);

    res.json({ success: true, id: aucId });
  });

  app.post('/api/auction/bid', (req, res) => {
    const { userId, itemId, price } = req.body || {};
    const auc = db.prepare('SELECT * FROM auction_items WHERE id = ?').get(itemId);
    if (!auc || auc.status !== 'open') return res.json({ success: false, message: '拍卖已结束或不存在' });
    if (price <= auc.currentPrice) return res.json({ success: false, message: '出价必须高于当前价' });
    db.prepare('UPDATE auction_items SET currentPrice = ?, highestBidderId = ? WHERE id = ?').run(price, userId, itemId);
    res.json({ success: true });
  });

  // 技能模板（管理员维护）
  app.get('/api/admin/skills/templates', (req, res) => {
    const list = db.prepare('SELECT * FROM skills_templates ORDER BY name ASC').all();
    res.json({ success: true, skills: list });
  });

  app.post('/api/admin/skills/templates', (req, res) => {
    const { id, name, faction, description, maxLevel } = req.body || {};
    const sid = id || `SKT-${Date.now()}`;
    db.prepare('INSERT INTO skills_templates (id, name, faction, description, maxLevel) VALUES (?, ?, ?, ?, ?)')
      .run(sid, name, faction, description, maxLevel);
    broadcast('skills_updated');
    res.json({ success: true, id: sid });
  });

  app.put('/api/admin/skills/templates/:id', (req, res) => {
    const { name, faction, description, maxLevel } = req.body || {};
    db.prepare('UPDATE skills_templates SET name=?, faction=?, description=?, maxLevel=? WHERE id=?')
      .run(name, faction, description, maxLevel, req.params.id);
    broadcast('skills_updated');
    res.json({ success: true });
  });

  app.delete('/api/admin/skills/templates/:id', (req, res) => {
    db.prepare('DELETE FROM skills_templates WHERE id = ?').run(req.params.id);
    broadcast('skills_updated');
    res.json({ success: true });
  });

  // 技能模板（游戏端可读）
  app.get('/api/skills/templates', (req, res) => {
    const { faction } = req.query;
    const list = faction
      ? db.prepare('SELECT * FROM skills_templates WHERE faction = ? ORDER BY name ASC').all(String(faction))
      : db.prepare('SELECT * FROM skills_templates ORDER BY name ASC').all();
    res.json({ success: true, skills: list });
  });

  // 初始化/注册（保留）
  app.post('/api/users/init', (req, res) => {
    const { name } = req.body;
    try {
      db.prepare(`INSERT INTO users (name, status) VALUES (?, 'pending')`).run(name);
      res.json({ success: true });
    } catch (e) { res.json({ success: true }); }
  });

  // 生产/开发
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => res.sendFile(path.join(distPath, 'index.html')));
  }

  app.listen(PORT, '0.0.0.0', () => console.log(`Server running on port ${PORT}`));
}

startServer();

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

  CREATE TABLE IF NOT EXISTS items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER,
    name TEXT,
    description TEXT,
    FOREIGN KEY(userId) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS roleplay_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    senderId INTEGER,
    senderName TEXT,
    receiverId INTEGER,
    receiverName TEXT,
    content TEXT,
    isRead INTEGER DEFAULT 0,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
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
`);

// 自动动态增加缺失列的辅助函数
const addColumn = (table: string, col: string, type: string) => {
  try { db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${type}`); } catch (e) {}
};

// 补全所有核心字段
[
  'gender', 'height', 'age', 'orientation', 'faction', 'factionRole', 
  'personality', 'appearance', 'clothing', 'background', 'currentLocation',
  'job', 'lastResetDate', 'lastCheckInDate'
].forEach(c => addColumn('users', c, 'TEXT'));

['hp', 'maxHp', 'mp', 'maxMp', 'workCount', 'trainCount'].forEach(c => addColumn('users', c, 'INTEGER DEFAULT 0'));
addColumn('users', 'mentalProgress', 'REAL DEFAULT 0');
addColumn('users', 'isHidden', 'INTEGER DEFAULT 0');

// 初始化数值补丁
db.prepare("UPDATE users SET hp = 100, maxHp = 100, mp = 100, maxMp = 100 WHERE hp IS NULL OR hp = 0").run();

// 职位名额与工资配置
const JOB_SALARIES: Record<string, number> = { '神使': 1000, '侍奉者': 1000, '神使后裔': 0, '仆从': 500 };
const JOB_LIMITS: Record<string, number> = { '神使': 1, '侍奉者': 2, '神使后裔': 2, '仆从': 9999 };

async function startServer() {
  const app = express();
  const PORT = process.env.PORT || 3000;
  app.use(express.json({ limit: '50mb' }));

  // ================= API Routes =================

  // 1. 用户基础信息与跨天重置
  app.get('/api/users/:name', (req, res) => {
    const user = db.prepare('SELECT * FROM users WHERE name = ?').get(req.params.name) as any;
    if (user) {
      const today = new Date().toISOString().split('T')[0];
      if (user.lastResetDate !== today) {
        db.prepare('UPDATE users SET workCount = 0, trainCount = 0, lastResetDate = ? WHERE id = ?').run(today, user.id);
        user.workCount = 0; user.trainCount = 0;
      }
      res.json({ success: true, user });
    } else {
      res.json({ success: false, message: 'User not found' });
    }
  });

  // 2. 命之塔职位系统
  app.post('/api/tower/join', (req, res) => {
    const { userId, jobName } = req.body;
    try {
      const user = db.prepare('SELECT job FROM users WHERE id = ?').get(userId) as any;
      if (user.job && user.job !== '无') return res.json({ success: false, message: '你已经有职位了，请先离职。' });

      const currentCount = db.prepare('SELECT COUNT(*) as count FROM users WHERE job = ?').get(jobName) as any;
      if (currentCount.count >= (JOB_LIMITS[jobName] || 0)) return res.json({ success: false, message: '该职位名额已满。' });

      db.prepare('UPDATE users SET job = ? WHERE id = ?').run(jobName, userId);
      res.json({ success: true });
    } catch (error: any) { res.status(500).json({ success: false, message: error.message }); }
  });

  app.post('/api/tower/checkin', (req, res) => {
    const { userId } = req.body;
    const today = new Date().toISOString().split('T')[0];
    try {
      const user = db.prepare('SELECT job, lastCheckInDate FROM users WHERE id = ?').get(userId) as any;
      if (!user.job || user.job === '无') return res.json({ success: false, message: '无职位人员无法签到' });
      if (user.lastCheckInDate === today) return res.json({ success: false, message: '今日已领取过工资' });

      const salary = JOB_SALARIES[user.job] || 0;
      db.prepare('UPDATE users SET gold = gold + ?, lastCheckInDate = ? WHERE id = ?').run(salary, today, userId);
      res.json({ success: true, reward: salary });
    } catch (error: any) { res.status(500).json({ success: false, message: error.message }); }
  });

  app.post('/api/tower/quit', (req, res) => {
    const { userId } = req.body;
    try {
      const user = db.prepare('SELECT job FROM users WHERE id = ?').get(userId) as any;
      const penalty = Math.floor((JOB_SALARIES[user.job] || 0) * 0.3);
      db.prepare('UPDATE users SET job = "无", gold = MAX(0, gold - ?) WHERE id = ?').run(penalty, userId);
      res.json({ success: true, penalty });
    } catch (error: any) { res.status(500).json({ success: false, message: error.message }); }
  });

  // 3. 精神体系统
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
      const status = db.prepare('SELECT * FROM spirit_status WHERE userId = ?').get(userId) as any;
      const user = db.prepare('SELECT mentalProgress FROM users WHERE id = ?').get(userId) as any;

      let newIntimacy = (status.intimacy || 0) + intimacyGain;
      let levelGain = Math.floor(newIntimacy / 100);
      let finalIntimacy = newIntimacy % 100;
      let newMentalProgress = Math.min(100, (user.mentalProgress || 0) + (levelGain * 20));

      db.prepare('UPDATE spirit_status SET intimacy = ?, level = level + ? WHERE userId = ?').run(finalIntimacy, levelGain, userId);
      db.prepare('UPDATE users SET mentalProgress = ? WHERE id = ?').run(newMentalProgress, userId);
      res.json({ success: true, levelUp: levelGain > 0 });
    } catch (error: any) { res.status(500).json({ success: false, message: error.message }); }
  });

  // 4. 对戏消息与社交
  app.post('/api/roleplay', (req, res) => {
    const { senderId, senderName, receiverId, receiverName, content } = req.body;
    db.prepare('INSERT INTO roleplay_messages (senderId, senderName, receiverId, receiverName, content) VALUES (?, ?, ?, ?, ?)').run(senderId, senderName, receiverId, receiverName, content);
    res.json({ success: true });
  });

  app.get('/api/roleplay/conversation/:userId/:otherId', (req, res) => {
    const { userId, otherId } = req.params;
    const messages = db.prepare('SELECT * FROM roleplay_messages WHERE (senderId = ? AND receiverId = ?) OR (senderId = ? AND receiverId = ?) ORDER BY createdAt ASC').all(userId, otherId, otherId, userId);
    db.prepare('UPDATE roleplay_messages SET isRead = 1 WHERE receiverId = ? AND senderId = ?').run(userId, otherId);
    res.json({ success: true, messages });
  });

  // 5. 任务与技能 (保持原有逻辑)
  app.get('/api/commissions', (req, res) => {
    res.json({ success: true, commissions: db.prepare('SELECT * FROM commissions ORDER BY createdAt DESC').all() });
  });

  app.get('/api/users/:id/skills', (req, res) => {
    res.json({ success: true, skills: db.prepare('SELECT * FROM user_skills WHERE userId = ?').all(req.params.id) });
  });

  // 6. 其他常规 API (初始化、管理员、头像、地图位置等...)
  app.post('/api/users/init', (req, res) => {
    const { name } = req.body;
    try {
      db.prepare(`INSERT INTO users (name, status) VALUES (?, 'pending')`).run(name);
      res.json({ success: true });
    } catch (e: any) { res.json({ success: true }); }
  });

  app.post('/api/users/:id/location', (req, res) => {
    db.prepare('UPDATE users SET currentLocation = ? WHERE id = ?').run(req.body.locationId, req.params.id);
    res.json({ success: true });
  });

  // (注：此处保留你原有的 app.get('/api/admin/users'), app.post('/api/users') 等接口)

  // 生产/开发环境配置
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
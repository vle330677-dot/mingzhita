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

// ================= 数据库初始化 (核心：确保数据不丢失) =================
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE,
    role TEXT,
    gold INTEGER DEFAULT 0,
    status TEXT DEFAULT 'pending',
    currentLocation TEXT,
    avatarUrl TEXT,
    profileText TEXT
  );

  -- 全局物品库 (管理员维护)
  CREATE TABLE IF NOT EXISTS global_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    locationTag TEXT, 
    price INTEGER DEFAULT 0
  );

  -- 全局技能库 (管理员维护)
  CREATE TABLE IF NOT EXISTS global_skills (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    faction TEXT, 
    description TEXT
  );

  -- 玩家背包
  CREATE TABLE IF NOT EXISTS user_inventory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER,
    name TEXT,
    qty INTEGER DEFAULT 1,
    FOREIGN KEY(userId) REFERENCES users(id)
  );

  -- 对戏记录 (增加地点字段)
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
`);

// 动态补全字段（防止因版本更新导致旧数据报错）
const addColumn = (table: string, col: string, type: string) => {
  try { db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${type}`); } catch (e) {}
};
['mentalRank', 'physicalRank', 'ability', 'spiritName', 'job', 'isHidden'].forEach(c => addColumn('users', c, 'TEXT'));
addColumn('roleplay_messages', 'locationId', 'TEXT');

// ================= API 路由 =================
async function startServer() {
  const app = express();
  app.use(express.json({ limit: '50mb' }));

  // --- 玩家数据同步 ---
  app.get('/api/admin/users', (req, res) => {
    res.json({ success: true, users: db.prepare('SELECT * FROM users').all() });
  });

  app.put('/api/admin/users/:id', (req, res) => {
    const { role, mentalRank, physicalRank, ability, spiritName, profileText } = req.body;
    db.prepare(`UPDATE users SET role=?, mentalRank=?, physicalRank=?, ability=?, spiritName=?, profileText=? WHERE id=?`)
      .run(role, mentalRank, physicalRank, ability, spiritName, profileText, req.params.id);
    res.json({ success: true });
  });

  // --- 对戏记录归纳 (按地点与人物) ---
  app.get('/api/admin/roleplay_logs', (req, res) => {
    const logs = db.prepare(`SELECT * FROM roleplay_messages ORDER BY locationId ASC, createdAt DESC`).all();
    res.json({ success: true, logs });
  });

  // --- 物品库管理 ---
  app.get('/api/items', (req, res) => {
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

  // --- 技能库管理 (基于八大派系) ---
  app.get('/api/skills', (req, res) => {
    res.json({ success: true, skills: db.prepare('SELECT * FROM global_skills').all() });
  });

  app.post('/api/admin/skills', (req, res) => {
    const { name, faction, description } = req.body;
    db.prepare('INSERT INTO global_skills (name, faction, description) VALUES (?, ?, ?)').run(name, faction, description);
    res.json({ success: true });
  });

  // --- 环境处理 ---
  if (process.env.NODE_ENV === 'production') {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => res.sendFile(path.join(distPath, 'index.html')));
  }

  app.listen(process.env.PORT || 3000, '0.0.0.0', () => console.log("Server Active"));
}
startServer();

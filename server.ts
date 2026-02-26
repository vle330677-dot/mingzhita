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
    age INTEGER DEFAULT 18,
    role TEXT,
    faction TEXT,
    mentalRank TEXT,
    physicalRank TEXT,
    gold INTEGER DEFAULT 0,
    ability TEXT,
    spiritName TEXT,
    avatarUrl TEXT,
    status TEXT DEFAULT 'pending',
    profileText TEXT,
    currentLocation TEXT,
    job TEXT DEFAULT '无',
    lastResetDate TEXT
  );

  CREATE TABLE IF NOT EXISTS global_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    locationTag TEXT, 
    price INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS global_skills (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    faction TEXT, 
    description TEXT
  );

  CREATE TABLE IF NOT EXISTS user_skills (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER,
    name TEXT,
    level INTEGER DEFAULT 1,
    FOREIGN KEY(userId) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS roleplay_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    senderId INTEGER,
    senderName TEXT,
    receiverId INTEGER,
    receiverName TEXT,
    content TEXT,
    locationId TEXT,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// ================= 初始数据种子 (Seed Data) =================
const seedData = () => {
  // 预置初始技能
  const initialSkills = [
    { name: '精神梳理', faction: '向导', description: '安抚哨兵狂躁的精神图景。' },
    { name: '五感强化', faction: '哨兵', description: '短时间内极大提升战场感知力。' },
    { name: '基础体能训练', faction: '普通人', description: '虽然平凡，但勤能补拙。' },
    { name: '圣所祷告', faction: '圣所', description: '未分化幼崽的必修课，平复情绪。' },
    { name: '幽冥行走', faction: '鬼魂', description: '穿梭于阴影之中。' }
  ];

  const skillCount = db.prepare('SELECT COUNT(*) as count FROM global_skills').get() as any;
  if (skillCount.count === 0) {
    const insertSkill = db.prepare('INSERT INTO global_skills (name, faction, description) VALUES (?, ?, ?)');
    initialSkills.forEach(s => insertSkill.run(s.name, s.faction, s.description));
  }

  // 预置初始物品
  const initialItems = [
    { name: '过期向导素', locationTag: 'slums', price: 50, description: '效果存疑的廉价药剂。' },
    { name: '高级营养液', locationTag: 'rich_area', price: 500, description: '富人区的日常补给。' },
    { name: '军用干粮', locationTag: 'army', price: 100, description: '难吃但抗饿。' },
    { name: '旧报纸', locationTag: 'slums', price: 5, description: '记录着被遗忘的历史。' }
  ];

  const itemCount = db.prepare('SELECT COUNT(*) as count FROM global_items').get() as any;
  if (itemCount.count === 0) {
    const insertItem = db.prepare('INSERT INTO global_items (name, description, locationTag, price) VALUES (?, ?, ?, ?)');
    initialItems.forEach(i => insertItem.run(i.name, i.description, i.locationTag, i.price));
  }
};
seedData();

// ================= API 路由 =================
async function startServer() {
  const app = express();
  app.use(express.json({ limit: '50mb' }));

  // 1. 用户登录/获取 (含年龄判定)
  app.get('/api/users/:name', (req, res) => {
    const user = db.prepare('SELECT * FROM users WHERE name = ?').get(req.params.name) as any;
    if (user) {
      // 动态判定派系：小于16岁强制归属“圣所”且角色为“未分化”
      if (user.age < 16) {
        user.faction = '圣所';
        user.role = '未分化';
      }
      res.json({ success: true, user });
    } else {
      res.json({ success: false });
    }
  });

  // 2. 技能系统：只能学习自己派系的技能
  app.get('/api/skills/available/:userId', (req, res) => {
    const user = db.prepare('SELECT faction FROM users WHERE id = ?').get(req.params.userId) as any;
    if (!user) return res.status(404).json({ success: false, message: '用户不存在' });

    // 如果未满16岁，只能看到圣所技能
    const skills = db.prepare('SELECT * FROM global_skills WHERE faction = ?').all(user.faction);
    res.json({ success: true, skills });
  });

  app.post('/api/users/:id/skills/learn', (req, res) => {
    const { skillId } = req.body;
    const userId = req.params.id;

    const user = db.prepare('SELECT faction FROM users WHERE id = ?').get(userId) as any;
    const skill = db.prepare('SELECT * FROM global_skills WHERE id = ?').get(skillId) as any;

    if (user.faction !== skill.faction) {
      return res.status(403).json({ success: false, message: `你属于${user.faction}派系，无法学习${skill.faction}技能` });
    }

    db.prepare('INSERT INTO user_skills (userId, name) VALUES (?, ?)').run(userId, skill.name);
    res.json({ success: true });
  });

  // 3. 管理员：获取玩家 (包含派系一致性展示)
  app.get('/api/admin/users', (req, res) => {
    const users = db.prepare('SELECT * FROM users').all();
    const processedUsers = users.map((u: any) => ({
      ...u,
      faction: u.age < 16 ? '圣所' : u.faction,
      role: u.age < 16 ? '未分化' : u.role
    }));
    res.json({ success: true, users: processedUsers });
  });

    // ================= 前端页面路由配置 (修复 Cannot GET / 问题) =================
  if (process.env.NODE_ENV !== 'production') {
    // 开发环境：使用 Vite 中间件实时热更新
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
    
    // 拦截非 API 请求，交给前端路由处理 (SPA回退)
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
    // 生产环境 (云端)：直接提供 dist 目录下的静态文件
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => res.sendFile(path.join(distPath, 'index.html')));
  }

  const PORT = process.env.PORT || 3000;
  app.listen(PORT, '0.0.0.0', () => console.log(`Server running on port ${PORT}`));
}

startServer();

  app.listen(PORT, '0.0.0.0', () => console.log(`Server running on port ${PORT}`));
}
startServer();

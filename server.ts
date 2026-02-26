import express from 'express';
import Database from 'better-sqlite3';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 如果在 Zeabur 部署，记得在环境变量设置 DB_PATH=/data/game.db 并挂载 /data 卷
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
    gold INTEGER,
    ability TEXT,
    spiritName TEXT,
    spiritType TEXT,
    avatarUrl TEXT,
    status TEXT DEFAULT 'pending',
    deathDescription TEXT,
    profileText TEXT,
    gender TEXT,
    height TEXT,
    age TEXT,
    orientation TEXT,
    faction TEXT,
    factionRole TEXT,
    personality TEXT,
    appearance TEXT,
    clothing TEXT,
    background TEXT,
    isHidden INTEGER DEFAULT 0,
    currentLocation TEXT -- 新增：用于记录玩家在地图上的位置
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
-- 新增：对戏消息表 (用于玩家间实时互动)
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
  -- 新增：公会委托任务表
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

  -- 新增：玩家技能表
  CREATE TABLE IF NOT EXISTS user_skills (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER,
    name TEXT,
    level INTEGER DEFAULT 1,
    FOREIGN KEY(userId) REFERENCES users(id)
  );
  -- 新增：精神体详细状态表
  CREATE TABLE IF NOT EXISTS spirit_status (
    userId INTEGER PRIMARY KEY,
    intimacy INTEGER DEFAULT 0,
    status TEXT DEFAULT '良好',
    FOREIGN KEY(userId) REFERENCES users(id)
  );
`);

// 职位配置
const JOB_SALARIES: Record<string, number> = { '神使': 1000, '侍奉者': 1000, '神使后裔': 0, '仆从': 500 };
const JOB_LIMITS: Record<string, number> = { '神使': 1, '侍奉者': 2, '神使后裔': 2, '仆从': 9999 };

// 1. 加入职位 API
app.post('/api/tower/join', (req, res) => {
  const { userId, jobName } = req.body;
  try {
    const user = db.prepare('SELECT job FROM users WHERE id = ?').get(userId) as any;
    if (user.job && user.job !== '无') return res.json({ success: false, message: '你已经有职位了' });

    const currentCount = db.prepare('SELECT COUNT(*) as count FROM users WHERE job = ?').get(jobName) as any;
    if (currentCount.count >= JOB_LIMITS[jobName]) return res.json({ success: false, message: '名额已满' });

    db.prepare('UPDATE users SET job = ? WHERE id = ?').run(jobName, userId);
    res.json({ success: true });
  } catch (error: any) { res.status(500).json({ success: false, message: error.message }); }
});

// 2. 签到 API
app.post('/api/tower/checkin', (req, res) => {
  const { userId } = req.body;
  const today = new Date().toISOString().split('T')[0];
  try {
    const user = db.prepare('SELECT job, gold, lastCheckInDate FROM users WHERE id = ?').get(userId) as any;
    if (!user.job || user.job === '无') return res.json({ success: false, message: '无职位无法签到' });
    if (user.lastCheckInDate === today) return res.json({ success: false, message: '今日已签到' });

    const salary = JOB_SALARIES[user.job] || 0;
    db.prepare('UPDATE users SET gold = gold + ?, lastCheckInDate = ? WHERE id = ?').run(salary, today, userId);
    res.json({ success: true, reward: salary });
  } catch (error: any) { res.status(500).json({ success: false, message: error.message }); }
});

// 3. 离职 API
app.post('/api/tower/quit', (req, res) => {
  const { userId } = req.body;
  try {
    const user = db.prepare('SELECT job, gold FROM users WHERE id = ?').get(userId) as any;
    const penalty = Math.floor((JOB_SALARIES[user.job] || 0) * 0.3);
    db.prepare('UPDATE users SET job = "无", gold = MAX(0, gold - ?) WHERE id = ?').run(penalty, userId);
    res.json({ success: true, penalty });
  } catch (error: any) { res.status(500).json({ success: false, message: error.message }); }
});
const addColumn = (table: string, col: string, type: string) => {
  try {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${type}`);
  } catch (e) {} // 忽略列已存在的错误
};
// 确保旧数据库升级时加上命之塔系统所需的字段
[
  'job',             // 职位：神使/侍奉者/仆从等
  'hp',              // 当前血量
  'maxHp',           // 最大血量
  'mp',              // 当前精神值
  'maxMp',           // 最大精神值
  'mentalProgress',  // 精神力升级百分比进度 (0-100)
  'workCount',       // 今日已打工次数
  'trainCount',      // 今日已训练次数
  'lastResetDate'    // 上次重置计数的时间 (YYYY-MM-DD)
].forEach(c => {
  const type = (c === 'mentalProgress') ? 'REAL DEFAULT 0' : 
               (c === 'hp' || c === 'maxHp' || c === 'mp' || c === 'maxMp' || c === 'workCount' || c === 'trainCount') ? 'INTEGER DEFAULT 0' : 
               'TEXT';
  addColumn('users', c, type);
});

// 初始化数值补丁
db.prepare("UPDATE users SET hp = 100, maxHp = 100, mp = 100, maxMp = 100 WHERE hp IS NULL OR hp = 0").run();

// 确保旧数据库升级时也能加上这些列
['gender', 'height', 'age', 'orientation', 'faction', 'factionRole', 'personality', 'appearance', 'clothing', 'background', 'currentLocation'].forEach(c => addColumn('users', c, 'TEXT'));
addColumn('users', 'isHidden', 'INTEGER DEFAULT 0');
addColumn('tombstones', 'isHidden', 'INTEGER DEFAULT 0');


async function startServer() {
  const app = express();
  const PORT = process.env.PORT || 3000;

  app.use(express.json({ limit: '50mb' }));

  // ================= API Routes 开始 =================
  
  // ================= 命之塔系统 API =================

  // 1. 获取精神体详细状态
  app.get('/api/users/:id/spirit-status', (req, res) => {
    const { id } = req.params;
    try {
      let status = db.prepare('SELECT * FROM spirit_status WHERE userId = ?').get(id);
      if (!status) {
        db.prepare('INSERT INTO spirit_status (userId) VALUES (?)').run(id);
        status = { userId: id, intimacy: 0, status: '良好' };
      }
      res.json({ success: true, spiritStatus: status });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // 2. 加入命之塔职位
  app.post('/api/tower/join', (req, res) => {
    const { userId, jobName } = req.body;
    try {
      db.prepare('UPDATE users SET job = ? WHERE id = ?').run(jobName, userId);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // 3. 打工逻辑 (每天3次，获得20%月薪)
  app.post('/api/tower/work', (req, res) => {
    const { userId } = req.body;
    try {
      const user = db.prepare('SELECT job, workCount, gold FROM users WHERE id = ?').get(userId) as any;
      if (user.workCount >= 3) return res.json({ success: false, message: '今日打工次数已满' });

      // 根据职位计算报酬
      const salaries: Record<string, number> = { '神使': 1000, '侍奉者': 1000, '神使后裔': 0, '仆从': 500 };
      const baseSalary = salaries[user.job] || 0;
      const reward = Math.floor(baseSalary * 0.2);

      db.prepare('UPDATE users SET gold = gold + ?, workCount = workCount + ? WHERE id = ?')
        .run(reward, 1, userId);

      res.json({ success: true, reward, currentGold: user.gold + reward });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // 4. 精神力训练成功 (进度+5%)
  app.post('/api/tower/train', (req, res) => {
    const { userId } = req.body;
    try {
      const user = db.prepare('SELECT trainCount, mentalProgress FROM users WHERE id = ?').get(userId) as any;
      if (user.trainCount >= 5) return res.json({ success: false, message: '今日训练次数已满' });

      const newProgress = Math.min(100, user.mentalProgress + 5);
      db.prepare('UPDATE users SET mentalProgress = ?, trainCount = trainCount + ? WHERE id = ?')
        .run(newProgress, 1, userId);

      res.json({ success: true, newProgress });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // 5. 休息恢复 (血条/精神力回复)
  app.post('/api/tower/rest', (req, res) => {
    const { userId } = req.body;
    try {
      db.prepare('UPDATE users SET hp = maxHp, mp = maxMp WHERE id = ?').run(userId);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // 6. 精神体互动 (增加亲密度)
  app.post('/api/tower/interact-spirit', (req, res) => {
    const { userId } = req.body;
    try {
      db.prepare('UPDATE spirit_status SET intimacy = intimacy + 5 WHERE userId = ?').run(userId);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });
  // --- 原有用户与管理员 API ---
 app.get('/api/users/:name', (req, res) => {
    const user = db.prepare('SELECT * FROM users WHERE name = ?').get(req.params.name) as any;
    if (user) {
      const today = new Date().toISOString().split('T')[0];
      // 跨天检查，重置计数器
      if (user.lastResetDate !== today) {
        db.prepare('UPDATE users SET workCount = 0, trainCount = 0, lastResetDate = ? WHERE id = ?')
          .run(today, user.id);
        user.workCount = 0;
        user.trainCount = 0;
      }
      res.json({ success: true, user });
    } else {
      res.json({ success: false, message: 'User not found' });
    }
  });

  app.post('/api/users/init', (req, res) => {
    const { name } = req.body;
    try {
      db.prepare(`INSERT INTO users (name, status) VALUES (?, 'pending')`).run(name);
      res.json({ success: true });
    } catch (error: any) {
      if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        res.json({ success: true });
      } else {
        res.status(500).json({ success: false, message: error.message });
      }
    }
  });
// --- 新增：玩家对戏 (Roleplay) API ---

  // 1. 发送对戏消息
  app.post('/api/roleplay', (req, res) => {
    const { senderId, senderName, receiverId, receiverName, content } = req.body;
    try {
      db.prepare(`
        INSERT INTO roleplay_messages (senderId, senderName, receiverId, receiverName, content) 
        VALUES (?, ?, ?, ?, ?)
      `).run(senderId, senderName, receiverId, receiverName, content);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // 2. 获取两个玩家之间的对戏记录 (并在读取时将对方发来的消息标为已读)
  app.get('/api/roleplay/conversation/:userId/:otherId', (req, res) => {
    const { userId, otherId } = req.params;
    try {
      const messages = db.prepare(`
        SELECT * FROM roleplay_messages 
        WHERE (senderId = ? AND receiverId = ?) OR (senderId = ? AND receiverId = ?)
        ORDER BY createdAt ASC
      `).all(userId, otherId, otherId, userId);
      
      // 将别人发给我的消息标记为已读
      db.prepare('UPDATE roleplay_messages SET isRead = 1 WHERE receiverId = ? AND senderId = ?').run(userId, otherId);
      
      res.json({ success: true, messages });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // 3. 获取我的未读消息数量 (用于前端显示红点)
  app.get('/api/roleplay/unread/:userId', (req, res) => {
    const { userId } = req.params;
    try {
      const result = db.prepare('SELECT COUNT(*) as count FROM roleplay_messages WHERE receiverId = ? AND isRead = 0').get(userId) as any;
      res.json({ success: true, count: result.count });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // 4. 管理员获取全服所有对戏记录
  app.get('/api/admin/roleplay_logs', (req, res) => {
    try {
      const logs = db.prepare('SELECT * FROM roleplay_messages ORDER BY createdAt DESC').all();
      res.json({ success: true, logs });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });
  app.post('/api/users', (req, res) => {
    const { name, role, mentalRank, physicalRank, gold, ability, spiritName, spiritType } = req.body;
    try {
      const existing = db.prepare('SELECT * FROM users WHERE name = ?').get(name);
      if (existing) {
        db.prepare(`
          UPDATE users SET role = ?, mentalRank = ?, physicalRank = ?, gold = ?, ability = ?, spiritName = ?, spiritType = ?
          WHERE name = ?
        `).run(role, mentalRank, physicalRank, gold, ability, spiritName, spiritType, name);
        res.json({ success: true });
      } else {
        const stmt = db.prepare(`
          INSERT INTO users (name, role, mentalRank, physicalRank, gold, ability, spiritName, spiritType, status)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')
        `);
        const info = stmt.run(name, role, mentalRank, physicalRank, gold, ability, spiritName, spiritType);
        res.json({ success: true, id: info.lastInsertRowid });
      }
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.get('/api/admin/users', (req, res) => {
    const users = db.prepare('SELECT * FROM users').all();
    res.json({ success: true, users });
  });

  app.post('/api/admin/upload-profile', async (req, res) => {
    const { name, text, imageBase64, mimeType } = req.body;
    let profileText = text || '';
    let parsedData: any = {};

    if (imageBase64 && mimeType) {
       console.log("Mocking OCR for image...");
       profileText = "【模拟识别结果】\n姓名：测试角色\n性别：女\n年龄：20\n所属人群：向导\n精神力：A\n这是由系统自动生成的模拟档案文本，因为AI功能已被关闭。";
    }

    if (profileText) {
       console.log("Mocking JSON parsing for profile text...");
       parsedData = {
         gender: "女 (模拟)", height: "165cm (模拟)", age: "20 (模拟)", orientation: "异性恋 (模拟)",
         faction: "测试阵营 (模拟)", factionRole: "干员 (模拟)", personality: "开朗勇敢 (模拟)",
         appearance: "短发 (模拟)", clothing: "制服 (模拟)", background: "这是由于关闭了AI功能而生成的测试背景数据。(模拟)",
         role: "向导", mentalRank: "A", physicalRank: "C", ability: "精神安抚", spiritName: "白猫"
       };
    }
    
    try {
      const user = db.prepare('SELECT * FROM users WHERE name = ?').get(name);
      if (user) {
        db.prepare(`
          UPDATE users SET 
            profileText = ?, gender = ?, height = ?, age = ?, orientation = ?, 
            faction = ?, factionRole = ?, personality = ?, appearance = ?, 
            clothing = ?, background = ?,
            role = COALESCE(NULLIF(?, ''), role),
            mentalRank = COALESCE(NULLIF(?, ''), mentalRank),
            physicalRank = COALESCE(NULLIF(?, ''), physicalRank),
            ability = COALESCE(NULLIF(?, ''), ability),
            spiritName = COALESCE(NULLIF(?, ''), spiritName)
          WHERE name = ?
        `).run(
          profileText, parsedData.gender || '', parsedData.height || '', parsedData.age || '', parsedData.orientation || '',
          parsedData.faction || '', parsedData.factionRole || '', parsedData.personality || '', parsedData.appearance || '',
          parsedData.clothing || '', parsedData.background || '', 
          parsedData.role || '', parsedData.mentalRank || '', parsedData.physicalRank || '', parsedData.ability || '', parsedData.spiritName || '',
          name
        );
        res.json({ success: true });
      } else {
        res.status(404).json({ success: false, message: '未找到该名字的玩家，请确认玩家已在前端抽取身份' });
      }
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.post('/api/admin/users/:id/status', (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    try {
      db.prepare('UPDATE users SET status = ? WHERE id = ?').run(status, id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.delete('/api/users/:id', (req, res) => {
    const id = Number(req.params.id);
    try {
      const user = db.prepare('SELECT name FROM users WHERE id = ?').get(id) as any;
      if (user) {
        db.prepare('DELETE FROM tombstones WHERE name = ?').run(user.name);
      }
      db.prepare('DELETE FROM items WHERE userId = ?').run(id);
      db.prepare('DELETE FROM users WHERE id = ?').run(id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.put('/api/admin/users/:id', (req, res) => {
    const { id } = req.params;
    const { role, mentalRank, physicalRank, ability, spiritName, profileText } = req.body;
    try {
      db.prepare(`
        UPDATE users SET 
          role = ?, mentalRank = ?, physicalRank = ?, ability = ?, spiritName = ?, profileText = ?
        WHERE id = ?
      `).run(role, mentalRank, physicalRank, ability, spiritName, profileText, id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.put('/api/admin/users/:id/hide', (req, res) => {
    const { id } = req.params;
    const { isHidden } = req.body;
    try {
      db.prepare('UPDATE users SET isHidden = ? WHERE id = ?').run(isHidden ? 1 : 0, id);
      const user = db.prepare('SELECT name FROM users WHERE id = ?').get(id) as any;
      if (user) {
        db.prepare('UPDATE tombstones SET isHidden = ? WHERE name = ?').run(isHidden ? 1 : 0, user.name);
      }
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.put('/api/users/:id/avatar', (req, res) => {
    const { id } = req.params;
    const { avatarUrl } = req.body;
    try {
      db.prepare('UPDATE users SET avatarUrl = ? WHERE id = ?').run(avatarUrl, id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.put('/api/users/:id/die', (req, res) => {
    const { id } = req.params;
    const { deathDescription } = req.body;
    try {
      const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as any;
      if (user) {
        db.prepare(`
          INSERT INTO tombstones (name, deathDescription, role, mentalRank, physicalRank, ability, spiritName)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(user.name, deathDescription, user.role, user.mentalRank, user.physicalRank, user.ability, user.spiritName);
        
        db.prepare('UPDATE users SET status = ?, deathDescription = ? WHERE id = ?').run('dead', deathDescription, id);
        res.json({ success: true });
      } else {
        res.status(404).json({ success: false, message: 'User not found' });
      }
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.put('/api/users/:id/ghost', (req, res) => {
    const { id } = req.params;
    const { deathDescription } = req.body;
    try {
      db.prepare('UPDATE users SET status = ?, deathDescription = ?, role = ?, mentalRank = ?, physicalRank = ?, spiritName = ?, spiritType = ? WHERE id = ?')
        .run('ghost', deathDescription, '鬼魂', '无', '无', '无', '无', id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.get('/api/tombstones', (req, res) => {
    const tombstones = db.prepare('SELECT * FROM tombstones WHERE isHidden = 0 OR isHidden IS NULL').all();
    res.json({ success: true, tombstones });
  });

  // ================= 新增：地图与游戏交互 API =================
  
  // 1. 获取特定地点停留的所有玩家 (用于同屏显示)
  app.get('/api/location/:locationId/players', (req, res) => {
    const { locationId } = req.params;
    try {
      const players = db.prepare(`
        SELECT id, name, role, avatarUrl, currentLocation 
        FROM users 
        WHERE currentLocation = ? AND status != 'dead' AND status != 'pending'
      `).all(locationId);
      res.json({ success: true, players });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // 2. 更新玩家位置 (驻留什么都不做)
  app.post('/api/users/:id/location', (req, res) => {
    const { id } = req.params;
    const { locationId } = req.body;
    try {
      db.prepare('UPDATE users SET currentLocation = ? WHERE id = ?').run(locationId, id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // 3. 获取用户背包物品
  app.get('/api/users/:id/items', (req, res) => {
    const { id } = req.params;
    try {
      const items = db.prepare('SELECT * FROM items WHERE userId = ?').all(id);
      res.json({ success: true, items });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // 4. 新增物品入背包 (闲逛掉落)
  app.post('/api/users/:id/items', (req, res) => {
    const userId = Number(req.params.id);
    const { name, description } = req.body;
    try {
      const stmt = db.prepare('INSERT INTO items (userId, name, description) VALUES (?, ?, ?)');
      const info = stmt.run(userId, name, description);
      res.json({ success: true, itemId: info.lastInsertRowid });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // 5. 丢弃/消耗物品
  app.delete('/api/items/:itemId', (req, res) => {
    const { itemId } = req.params;
    try {
      db.prepare('DELETE FROM items WHERE id = ?').run(itemId);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // 6. 获取公会委托板列表
  app.get('/api/commissions', (req, res) => {
    try {
      const commissions = db.prepare('SELECT * FROM commissions ORDER BY createdAt DESC').all();
      res.json({ success: true, commissions });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // 7. 发布新委托
  app.post('/api/commissions', (req, res) => {
    const { id, publisherId, publisherName, title, content, difficulty } = req.body;
    try {
      const stmt = db.prepare(`
        INSERT INTO commissions (id, publisherId, publisherName, title, content, difficulty, status)
        VALUES (?, ?, ?, ?, ?, ?, 'open')
      `);
      stmt.run(id, publisherId, publisherName, title, content, difficulty);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // 8. 接受委托
  app.put('/api/commissions/:id/accept', (req, res) => {
    const commissionId = req.params.id;
    const { userId, userName } = req.body;
    try {
      const result = db.prepare(`
        UPDATE commissions 
        SET status = 'accepted', acceptedById = ?, acceptedByName = ? 
        WHERE id = ? AND status = 'open'
      `).run(userId, userName, commissionId);
      
      if (result.changes > 0) {
        res.json({ success: true });
      } else {
        res.status(400).json({ success: false, message: '手慢了，该委托已被接取或不存在' });
      }
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // --- 新增：技能相关 API ---

  // 9. 获取玩家所有技能
  app.get('/api/users/:id/skills', (req, res) => {
    const { id } = req.params;
    try {
      const skills = db.prepare('SELECT * FROM user_skills WHERE userId = ?').all(id);
      res.json({ success: true, skills });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // 10. 学习或升级技能
  app.post('/api/users/:id/skills', (req, res) => {
    const userId = Number(req.params.id);
    const { name } = req.body;
    try {
      const existing = db.prepare('SELECT * FROM user_skills WHERE userId = ? AND name = ?').get(userId, name) as any;
      if (existing) {
        db.prepare('UPDATE user_skills SET level = level + 1 WHERE id = ?').run(existing.id);
      } else {
        db.prepare('INSERT INTO user_skills (userId, name, level) VALUES (?, ?, 1)').run(userId, name);
      }
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // 11. 遗忘(失去)技能
  app.delete('/api/skills/:skillId', (req, res) => {
    const { skillId } = req.params;
    try {
      db.prepare('DELETE FROM user_skills WHERE id = ?').run(skillId);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // ================= API Routes 结束 =================

  // 生产与开发环境分离配置
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
    console.log('Running in Development mode with Vite middleware');
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
    console.log('Running in Production mode serving static files from dist');
  }

  // 绑定 0.0.0.0 确保外部能访问
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();

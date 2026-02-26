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
`);

const addColumn = (table: string, col: string, type: string) => {
  try {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${type}`);
  } catch (e) {} // 忽略列已存在的错误
};

// 确保旧数据库升级时也能加上这些列
['gender', 'height', 'age', 'orientation', 'faction', 'factionRole', 'personality', 'appearance', 'clothing', 'background', 'currentLocation'].forEach(c => addColumn('users', c, 'TEXT'));
addColumn('users', 'isHidden', 'INTEGER DEFAULT 0');
addColumn('tombstones', 'isHidden', 'INTEGER DEFAULT 0');


async function startServer() {
  const app = express();
  const PORT = process.env.PORT || 3000;

  app.use(express.json({ limit: '50mb' }));

  // ================= API Routes 开始 =================
  
  // --- 原有用户与管理员 API ---
  app.get('/api/users/:name', (req, res) => {
    const user = db.prepare('SELECT * FROM users WHERE name = ?').get(req.params.name);
    if (user) {
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
      // 只选取需要展示的非敏感字段，排除死人或未审核的人
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
      // 必须确保 status 为 'open' 才能接取，防止多人同时点击冲突
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

  // ================= API Routes 结束 =================

  // 生产与开发环境分离配置
  if (process.env.NODE_ENV !== 'production') {
    // 开发环境：动态引入 Vite，避免生产环境加载庞大的依赖
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
    console.log('Running in Development mode with Vite middleware');
  } else {
    // 生产环境：使用编译好的 dist 目录
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

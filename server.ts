import express from 'express';
import { createServer as createViteServer } from 'vite';
import Database from 'better-sqlite3';
// 移除对 GoogleGenAI 的引入，不再需要
// import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = process.env.DB_PATH || 'game.db';
const db = new Database(dbPath);

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
    isHidden INTEGER DEFAULT 0
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
`);

const addColumn = (table: string, col: string, type: string) => {
  try {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${type}`);
  } catch (e) {}
};
['gender', 'height', 'age', 'orientation', 'faction', 'factionRole', 'personality', 'appearance', 'clothing', 'background'].forEach(c => addColumn('users', c, 'TEXT'));
addColumn('users', 'isHidden', 'INTEGER DEFAULT 0');
addColumn('tombstones', 'isHidden', 'INTEGER DEFAULT 0');

async function startServer() {
  const app = express();
  const PORT = process.env.PORT || 3000;

  app.use(express.json({ limit: '50mb' }));

  // API Routes
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
    
    // --- 修改部分开始：使用假数据代替 AI 处理 ---
    
    let profileText = text || '';
    let parsedData: any = {};

    // 1. 如果上传了图片，不再调用 Gemini 识别，而是模拟识别结果
    if (imageBase64 && mimeType) {
       console.log("Mocking OCR for image...");
       profileText = "【模拟识别结果】\n姓名：测试角色\n性别：女\n年龄：20\n所属人群：向导\n精神力：A\n这是由系统自动生成的模拟档案文本，因为AI功能已被关闭。";
    }

    // 2. 如果有文本（无论是原生的还是刚“模拟”识别出的），不再调用 Gemini 解析，而是返回固定的 JSON 结构
    if (profileText) {
       console.log("Mocking JSON parsing for profile text...");
       parsedData = {
         gender: "女 (模拟)",
         height: "165cm (模拟)",
         age: "20 (模拟)",
         orientation: "异性恋 (模拟)",
         faction: "测试阵营 (模拟)",
         factionRole: "干员 (模拟)",
         personality: "开朗勇敢 (模拟)",
         appearance: "短发 (模拟)",
         clothing: "制服 (模拟)",
         background: "这是由于关闭了AI功能而生成的测试背景数据。(模拟)",
         role: "向导",
         mentalRank: "A",
         physicalRank: "C",
         ability: "精神安抚",
         spiritName: "白猫"
       };
    }
    
    // --- 修改部分结束 ---

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
    console.log(`Attempting to delete user with id: ${id}`);
    try {
      const user = db.prepare('SELECT name FROM users WHERE id = ?').get(id) as any;
      console.log(`Found user to delete:`, user);
      if (user) {
        db.prepare('DELETE FROM tombstones WHERE name = ?').run(user.name);
      }
      db.prepare('DELETE FROM items WHERE userId = ?').run(id);
      db.prepare('DELETE FROM users WHERE id = ?').run(id);
      console.log(`Successfully deleted user ${id}`);
      res.json({ success: true });
    } catch (error: any) {
      console.error(`Error deleting user ${id}:`, error);
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

  app.get('/api/users/:id/items', (req, res) => {
    const { id } = req.params;
    const items = db.prepare('SELECT * FROM items WHERE userId = ?').all(id);
    res.json({ success: true, items });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'dist/index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

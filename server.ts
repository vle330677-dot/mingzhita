import express from 'express';
import { createServer as createViteServer } from 'vite';
import Database from 'better-sqlite3';
import { GoogleGenAI } from '@google/genai';
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
    let profileText = text || '';

    if (imageBase64 && mimeType) {
      try {
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        const response = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: [
            {
              inlineData: {
                data: imageBase64.split(',')[1] || imageBase64,
                mimeType: mimeType
              }
            },
            { text: "Extract all text from this image. This is a user profile." }
          ]
        });
        profileText = response.text || '';
      } catch (error) {
        console.error('OCR Error:', error);
        return res.status(500).json({ success: false, message: '图片识别失败' });
      }
    }

    let parsedData: any = {};
    if (profileText) {
      try {
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        const response = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: `Parse the following user profile text and extract these fields into a JSON object based on the "命之塔档案" template:
          - name: 姓名（英文名附上中译）
          - gender: 性别（现版本仅开放男女性别）
          - height: 身高（默认单位cm，请注意符合年龄）
          - age: 年龄（5-65）
          - orientation: 性向/属性（圣所幼崽强制性向为xal无性恋）
          - role: 所属人群（哨兵/向导/普通人/鬼魂）
          - mentalRank: 精神力（等级C-SSS，普通人直接填无）
          - physicalRank: 肉体强度（鬼魂直接填无）
          - ability: 能力（限两项，鬼魂限一项，普通人无）
          - spiritName: 精神体（普通人与鬼魂填无）
          - faction: 势力（阵营）
          - factionRole: 所处势力（阵营）的职位
          - personality: 性格
          - appearance: 容貌
          - clothing: 衣着
          - background: 身世
          
          If a field is not found, leave it empty.
          
          Profile Text:
          ${profileText}`,
          config: {
            responseMimeType: "application/json",
          }
        });
        parsedData = JSON.parse(response.text || '{}');
      } catch (e) {
        console.error('Parse Error:', e);
      }
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

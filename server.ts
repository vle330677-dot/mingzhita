import express from 'express';
// 移除顶部的静态 Vite 引入
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

// ... (这中间的建表和所有 /api 路由代码保持原样，没有任何问题) ...

async function startServer() {
  const app = express();
  const PORT = process.env.PORT || 3000;

  app.use(express.json({ limit: '50mb' }));

  // ... (你的所有 app.get / app.post 等 API 路由代码保持原样) ...

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

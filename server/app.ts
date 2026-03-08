import express from 'express';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

import { initDb } from './db/index';
import { createAuth } from './middleware/auth';
import { rateLimiter } from './middleware/rateLimit';
import { compressionMiddleware } from './middleware/compression';
import { cacheMiddleware } from './middleware/cache';
import { createAnnouncementsRouter } from './routes/announcements.routes';
import { createRoomsRouter } from './routes/rooms.routes';
import { createLegacyRouter } from './routes/legacy.routes';
import { createRealtimeRouter } from './routes/realtime.routes';
import { createCoreRouter } from './routes/core.routes';
import { createCompatRouter } from './routes/compat.routes';
import { createCharacterRouter } from './routes/character.routes';
import { createCustomGameRouter } from './routes/customGame.routes';
import { createCatalogRouter } from './routes/catalog.routes';
import { createGameplayRouter } from './routes/gameplay.routes';
import { createGuildRouter } from './routes/guild.routes';
import { createRpRouter } from './rp.routes';
import { createGhostRouter } from './routes/ghost.routes';
import { createArmyRouter } from './routes/army.routes';
import { createConfirmationRouter } from './routes/confirmation.routes';
import { createFactionRouter } from './routes/faction.routes';
import { createCityRouter } from './routes/city.routes';
import { createMediationRouter } from './routes/mediation.routes';
import { createRealtimeRuntime } from './realtime';
import type { AppContext } from './types';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT || 3000);

  const distPath = path.resolve(__dirname, '../dist');
  const hasBuiltClient = fs.existsSync(path.join(distPath, 'index.html'));
  const useProdStatic = process.env.NODE_ENV === 'production' && hasBuiltClient;

  const db = initDb();
  const auth = createAuth(db);
  const runtime = createRealtimeRuntime();
  await runtime.ready();
  const ctx: AppContext = { db, auth, runtime };

  // 性能优化中间件
  app.use(compressionMiddleware);
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true }));
  
  // 全局限流：每分钟最多200个请求
  app.use('/api', rateLimiter(runtime, { windowMs: 60 * 1000, maxRequests: 200 }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, ts: Date.now() });
  });

  // 路由配置（带缓存的路由使用缓存中间件）
  app.use('/api', createRealtimeRouter(ctx));
  app.use('/api', createCoreRouter(ctx));
  app.use('/api', createCharacterRouter(ctx));
  app.use('/api', createCatalogRouter(ctx));
  app.use('/api', createGameplayRouter(ctx));
  app.use('/api', createGuildRouter(ctx));
  app.use('/api', createGhostRouter(ctx));
  app.use('/api', createArmyRouter(ctx));
  app.use('/api', createConfirmationRouter(ctx));
  app.use('/api', createFactionRouter(ctx));
  app.use('/api', createCityRouter(ctx));
  app.use('/api', createMediationRouter(ctx));
  app.use('/api', createCompatRouter(ctx));
  
  // 公告和房间列表可以缓存30秒
  app.use('/api', cacheMiddleware(runtime, 30 * 1000), createAnnouncementsRouter(ctx));
  app.use('/api', cacheMiddleware(runtime, 30 * 1000), createRoomsRouter(ctx));
  
  app.use('/api', createRpRouter(ctx));
  app.use('/api/custom-games', createCustomGameRouter(db));
  app.use('/api', createLegacyRouter(ctx));

  if (!useProdStatic) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });

    app.use(vite.middlewares);

    app.use('*', async (req, res, next) => {
      if (req.originalUrl.startsWith('/api')) return next();

      try {
        let template = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf-8');
        template = await vite.transformIndexHtml(req.originalUrl, template);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e) {
        vite.ssrFixStacktrace(e as Error);
        next(e);
      }
    });
  } else {
    // 生产环境静态文件缓存
    app.use(express.static(distPath, {
      maxAge: '1d', // 静态资源缓存1天
      etag: true,
      lastModified: true,
      setHeaders: (res, filePath) => {
        // JS/CSS 文件强缓存
        if (filePath.endsWith('.js') || filePath.endsWith('.css')) {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        }
        // 图片文件缓存7天
        if (/\.(jpg|jpeg|png|gif|svg|webp)$/i.test(filePath)) {
          res.setHeader('Cache-Control', 'public, max-age=604800');
        }
      }
    }));

    app.get('*', (req, res) => {
      if (req.originalUrl.startsWith('/api')) {
        return res.status(404).json({ message: 'API not found' });
      }
      // HTML 不缓存，确保更新及时
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.use((_req, res) => res.status(404).json({ message: 'Not Found' }));
  app.use((err: any, _req: any, res: any, _next: any) => {
    console.error(err);
    res.status(500).json({ message: 'Internal Server Error' });
  });

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT} (${useProdStatic ? 'static' : 'vite-middleware'} mode)`);
  });
}

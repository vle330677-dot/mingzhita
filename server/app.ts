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

  const db = await initDb();
  const auth = createAuth(db);
  const runtime = createRealtimeRuntime();
  await runtime.ready();
  const ctx: AppContext = { db, auth, runtime };

  const realtimeRouter = await createRealtimeRouter(ctx);
  const coreRouter = await createCoreRouter(ctx);
  const characterRouter = await createCharacterRouter(ctx);
  const catalogRouter = await createCatalogRouter(ctx);
  const gameplayRouter = await createGameplayRouter(ctx);
  const guildRouter = await createGuildRouter(ctx);
  const ghostRouter = await createGhostRouter(ctx);
  const armyRouter = await createArmyRouter(ctx);
  const confirmationRouter = await createConfirmationRouter(ctx);
  const factionRouter = await createFactionRouter(ctx);
  const cityRouter = await createCityRouter(ctx);
  const mediationRouter = await createMediationRouter(ctx);
  const compatRouter = await createCompatRouter(ctx);
  const announcementsRouter = await createAnnouncementsRouter(ctx);
  const roomsRouter = await createRoomsRouter(ctx);
  const rpRouter = await createRpRouter(ctx);
  const customGameRouter = await createCustomGameRouter(db);
  const legacyRouter = await createLegacyRouter(ctx);

  app.use(compressionMiddleware);
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true }));

  app.use('/api', rateLimiter(runtime, { windowMs: 60 * 1000, maxRequests: 200 }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, ts: Date.now() });
  });

  app.use('/api', realtimeRouter);
  app.use('/api', coreRouter);
  app.use('/api', characterRouter);
  app.use('/api', catalogRouter);
  app.use('/api', gameplayRouter);
  app.use('/api', guildRouter);
  app.use('/api', ghostRouter);
  app.use('/api', armyRouter);
  app.use('/api', confirmationRouter);
  app.use('/api', factionRouter);
  app.use('/api', cityRouter);
  app.use('/api', mediationRouter);
  app.use('/api', compatRouter);

  app.use('/api', cacheMiddleware(runtime, 30 * 1000), announcementsRouter);
  app.use('/api', cacheMiddleware(runtime, 30 * 1000), roomsRouter);

  app.use('/api', rpRouter);
  app.use('/api/custom-games', customGameRouter);
  app.use('/api', legacyRouter);

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
    app.use(express.static(distPath, {
      maxAge: '1d',
      etag: true,
      lastModified: true,
      setHeaders: (res, filePath) => {
        if (filePath.endsWith('.js') || filePath.endsWith('.css')) {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        }
        if (/\.(jpg|jpeg|png|gif|svg|webp)$/i.test(filePath)) {
          res.setHeader('Cache-Control', 'public, max-age=604800');
        }
      }
    }));

    app.get('*', (req, res) => {
      if (req.originalUrl.startsWith('/api')) {
        return res.status(404).json({ message: 'API not found' });
      }
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
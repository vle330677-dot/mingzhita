import express from 'express';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

import { initDb } from './db/index';
import { createAuth } from './middleware/auth';
import { createAnnouncementsRouter } from './routes/announcements.routes';
import { createRoomsRouter } from './routes/rooms.routes';
import { createLegacyRouter } from './routes/legacy.routes';
import { createCoreRouter } from './routes/core.routes';
import { createCompatRouter } from './routes/compat.routes';
import { createCharacterRouter } from './routes/character.routes';
import { createCustomGameRouter } from './routes/customGame.routes';
import { createCatalogRouter } from './routes/catalog.routes';
import { createGameplayRouter } from './routes/gameplay.routes';
import { createGuildRouter } from './routes/guild.routes';
import { createRpRouter } from './rp.routes';
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
  const ctx: AppContext = { db, auth };

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, ts: Date.now() });
  });

  app.use('/api', createCoreRouter(ctx));
  app.use('/api', createCharacterRouter(ctx));
  app.use('/api', createCatalogRouter(ctx));
  app.use('/api', createGameplayRouter(ctx));
  app.use('/api', createGuildRouter(ctx));
  app.use('/api', createCompatRouter(ctx));
  app.use('/api', createAnnouncementsRouter(ctx));
  app.use('/api', createRoomsRouter(ctx));
  app.use('/api', createRpRouter(db));
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
    app.use(express.static(distPath));

    app.get('*', (req, res) => {
      if (req.originalUrl.startsWith('/api')) {
        return res.status(404).json({ message: 'API not found' });
      }
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

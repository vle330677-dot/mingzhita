import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createMySqlDatabase, createSqliteDatabase, ensureMySqlDatabase } from './client';
import { getMySqlConfigFromEnv, shouldUseMySql } from './mysqlConfig';
import type { AppDatabase } from './types';
import { runSchema } from './schema';
import { runMigrate } from './migrate';
import { runSeed } from './seed';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function initSqliteDb() {
  const dbPath = process.env.DB_PATH || path.join(__dirname, '..', '..', 'data', 'game.db');
  const dbDir = path.dirname(dbPath);

  if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

  const boot = async () => {
    const db = createSqliteDatabase(dbPath);
    await db.pragma('journal_mode = WAL');
    await db.pragma('wal_autocheckpoint = 1000');
    await db.pragma('synchronous = NORMAL');
    await db.pragma('cache_size = -20000');
    await db.pragma('temp_store = MEMORY');
    await db.pragma('foreign_keys = ON');
    await db.pragma('busy_timeout = 5000');
    await db.pragma('mmap_size = 67108864');
    await runSchema(db);
    await runMigrate(db);
    await runSeed(db);
    return db;
  };

  try {
    return await boot();
  } catch (err: any) {
    const message = String(err?.message || '');
    const isCorrupted = /malformed|corrupt|SQLITE_CORRUPT|SQLITE_NOTADB/i.test(message);
    if (!isCorrupted || !fs.existsSync(dbPath)) {
      throw err;
    }

    const backupPath = `${dbPath}.corrupt.${Date.now()}.bak`;
    try {
      fs.renameSync(dbPath, backupPath);
      console.error(`[db] Corrupted database moved to: ${backupPath}`);
    } catch {
      throw err;
    }

    return boot();
  }
}

async function initMySqlDb() {
  const config = getMySqlConfigFromEnv();
  await ensureMySqlDatabase(config);

  const db = createMySqlDatabase(config);
  await runSchema(db);
  await runMigrate(db);
  await runSeed(db);
  return db;
}

export async function initDb(): Promise<AppDatabase> {
  return shouldUseMySql() ? initMySqlDb() : initSqliteDb();
}
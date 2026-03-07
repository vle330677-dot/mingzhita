import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { createMySqlDatabase, createSqliteDatabase } from './client';
import type { AppDatabase } from './types';
import { runSchema } from './schema';
import { runMigrate } from './migrate';
import { runSeed } from './seed';

const require = createRequire(import.meta.url);
const SyncMySql = require('sync-mysql');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function initSqliteDb() {
  const dbPath = process.env.DB_PATH || path.join(__dirname, '..', '..', 'data', 'game.db');
  const dbDir = path.dirname(dbPath);

  if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

  const boot = () => {
    const db = createSqliteDatabase(dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('wal_autocheckpoint = 1000');
    db.pragma('synchronous = NORMAL');
    db.pragma('cache_size = -20000');
    db.pragma('temp_store = MEMORY');
    db.pragma('foreign_keys = ON');
    db.pragma('busy_timeout = 5000');
    db.pragma('mmap_size = 67108864');
    runSchema(db);
    runMigrate(db);
    runSeed(db);
    return db;
  };

  try {
    return boot();
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

function initMySqlDb() {
  const host = process.env.MYSQL_HOST || '127.0.0.1';
  const port = Number(process.env.MYSQL_PORT || 3306);
  const user = process.env.MYSQL_USER || 'root';
  const password = process.env.MYSQL_PASSWORD || '';
  const database = process.env.MYSQL_DATABASE || 'mingzhita';
  const charset = process.env.MYSQL_CHARSET || 'utf8mb4';

  const bootstrap = new SyncMySql({
    host,
    port,
    user,
    password,
    charset,
    multipleStatements: true,
  }) as { query: (sql: string, params?: any[]) => any; dispose?: () => void };

  bootstrap.query('CREATE DATABASE IF NOT EXISTS ?? CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci', [database]);
  bootstrap.dispose?.();

  const db = createMySqlDatabase({
    host,
    port,
    user,
    password,
    database,
    charset,
    multipleStatements: true,
  });

  runSchema(db);
  runMigrate(db);
  runSeed(db);
  return db;
}

export function initDb(): AppDatabase {
  const client = String(process.env.DB_CLIENT || '').trim().toLowerCase();
  const shouldUseMySql = client === 'mysql' || (!!process.env.MYSQL_HOST && client !== 'sqlite');
  return shouldUseMySql ? initMySqlDb() : initSqliteDb();
}

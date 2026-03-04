import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { runSchema } from './schema';
import { runMigrate } from './migrate';
import { runSeed } from './seed';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function initDb() {
  const dbPath = process.env.DB_PATH || path.join(__dirname, '..', '..', 'data', 'game.db');
  const dbDir = path.dirname(dbPath);

  if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

  const boot = () => {
    const db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
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

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
    // WAL 模式：读写并发，不互相阻塞
    db.pragma('journal_mode = WAL');
    // WAL checkpoint：减少写放大
    db.pragma('wal_autocheckpoint = 1000');
    // 同步级别：WAL 模式下 NORMAL 足够安全，且比 FULL 快得多
    db.pragma('synchronous = NORMAL');
    // 内存缓存：20MB，减少磁盘 I/O
    db.pragma('cache_size = -20000');
    // 临时表放内存
    db.pragma('temp_store = MEMORY');
    // 外键约束
    db.pragma('foreign_keys = ON');
    // busy timeout：并发写时等待而不是立刻返回 SQLITE_BUSY
    db.pragma('busy_timeout = 5000');
    // mmap：让 OS 管理页缓存，多核友好
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

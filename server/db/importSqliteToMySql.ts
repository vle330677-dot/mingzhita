import path from 'path';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { createMySqlDatabase, createSqliteDatabase } from './client';
import { runSchema } from './schema';
import { runMigrate } from './migrate';
import { runSeed } from './seed';

dotenv.config();

const require = createRequire(import.meta.url);
const SyncMySql = require('sync-mysql');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getMySqlConfig() {
  return {
    host: process.env.MYSQL_HOST || '127.0.0.1',
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || '',
    database: process.env.MYSQL_DATABASE || 'mingzhita',
    charset: process.env.MYSQL_CHARSET || 'utf8mb4',
    multipleStatements: true,
  };
}

function ensureDatabase(config: ReturnType<typeof getMySqlConfig>) {
  const bootstrap = new SyncMySql({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    charset: config.charset,
    multipleStatements: true,
  }) as { query: (sql: string, params?: any[]) => any; dispose?: () => void };

  bootstrap.query('CREATE DATABASE IF NOT EXISTS ?? CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci', [config.database]);
  bootstrap.dispose?.();
}

function quoteIdentifier(name: string) {
  return `\`${String(name || '').replace(/`/g, '``')}\``;
}

function main() {
  const sqlitePath = process.env.SQLITE_IMPORT_PATH || process.env.DB_PATH || path.join(__dirname, '..', '..', 'data', 'game.db');
  const mysqlConfig = getMySqlConfig();

  ensureDatabase(mysqlConfig);

  const source = createSqliteDatabase(sqlitePath);
  const target = createMySqlDatabase(mysqlConfig);

  runSchema(target);
  runMigrate(target);
  runSeed(target);

  const tables = source.prepare(`
    SELECT name
    FROM sqlite_master
    WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
    ORDER BY name ASC
  `).all() as Array<{ name: string }>;

  target.exec('SET FOREIGN_KEY_CHECKS = 0');

  for (const table of tables) {
    const tableName = String(table.name || '').trim();
    if (!tableName) continue;

    const columns = (source.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name: string }>)
      .map((column) => String(column.name || '').trim())
      .filter(Boolean);
    if (!columns.length) continue;

    const rows = source.prepare(`SELECT * FROM ${quoteIdentifier(tableName)}`).all() as Record<string, any>[];
    if (!rows.length) {
      console.log(`[mysql-import] skip ${tableName}: empty`);
      continue;
    }

    const columnSql = columns.map(quoteIdentifier).join(', ');
    const placeholderSql = columns.map(() => '?').join(', ');
    const updateColumns = columns.filter((column) => column !== 'id');
    const updateSql = updateColumns.length
      ? updateColumns.map((column) => `${quoteIdentifier(column)} = VALUES(${quoteIdentifier(column)})`).join(', ')
      : `${quoteIdentifier(columns[0])} = ${quoteIdentifier(columns[0])}`;
    const insertSql = `
      INSERT INTO ${quoteIdentifier(tableName)} (${columnSql})
      VALUES (${placeholderSql})
      ON DUPLICATE KEY UPDATE ${updateSql}
    `;

    const insert = target.prepare(insertSql);
    const tx = target.transaction(() => {
      for (const row of rows) {
        insert.run(...columns.map((column) => (row[column] === undefined ? null : row[column])));
      }
    });
    tx();

    console.log(`[mysql-import] imported ${tableName}: ${rows.length}`);
  }

  target.exec('SET FOREIGN_KEY_CHECKS = 1');
  source.close();
  target.close();
  console.log('[mysql-import] completed');
}

main();

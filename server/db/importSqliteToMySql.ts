import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { createMySqlDatabase, createSqliteDatabase, ensureMySqlDatabase } from './client';
import { getMySqlConfigFromEnv } from './mysqlConfig';
import { runSchema } from './schema';
import { runMigrate } from './migrate';
import { runSeed } from './seed';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function quoteIdentifier(name: string) {
  return `\`${String(name || '').replace(/`/g, '``')}\``;
}

async function main() {
  const sqlitePath = process.env.SQLITE_IMPORT_PATH || process.env.DB_PATH || path.join(__dirname, '..', '..', 'data', 'game.db');
  const mysqlConfig = getMySqlConfigFromEnv();

  await ensureMySqlDatabase(mysqlConfig);

  const source = createSqliteDatabase(sqlitePath);
  const target = createMySqlDatabase(mysqlConfig);

  try {
    await runSchema(target);
    await runMigrate(target);
    await runSeed(target);

    const tables = await source.prepare(`
      SELECT name
      FROM sqlite_master
      WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
      ORDER BY name ASC
    `).all() as Array<{ name: string }>;

    await target.exec('SET FOREIGN_KEY_CHECKS = 0');

    for (const table of tables) {
      const tableName = String(table.name || '').trim();
      if (!tableName) continue;

      const columns = (await source.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name: string }>)
        .map((column) => String(column.name || '').trim())
        .filter(Boolean);
      if (!columns.length) continue;

      const rows = await source.prepare(`SELECT * FROM ${quoteIdentifier(tableName)}`).all() as Record<string, any>[];
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
      const tx = target.transaction(async () => {
        for (const row of rows) {
          await insert.run(...columns.map((column) => (row[column] === undefined ? null : row[column])));
        }
      });
      await tx();

      console.log(`[mysql-import] imported ${tableName}: ${rows.length}`);
    }

    await target.exec('SET FOREIGN_KEY_CHECKS = 1');
    console.log('[mysql-import] completed');
  } finally {
    await source.close();
    await target.close();
  }
}

main().catch((error) => {
  console.error('[mysql-import] failed', error);
  process.exit(1);
});
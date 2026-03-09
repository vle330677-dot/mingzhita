import { createMySqlDatabase, ensureMySqlDatabase } from './client';
import { getMySqlConfigFromEnv } from './mysqlConfig';
import type { AppDatabase } from './types';
import { runSchema } from './schema';
import { runMigrate } from './migrate';
import { runSeed } from './seed';

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
  return initMySqlDb();
}

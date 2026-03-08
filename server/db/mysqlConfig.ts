import type { MySqlConnectionConfig } from './types';

type EnvMap = NodeJS.ProcessEnv;

function getRequiredEnv(env: EnvMap, key: string) {
  const value = String(env[key] || '').trim();
  if (!value) {
    throw new Error(`${key} is required when using MySQL`);
  }
  return value;
}

export function shouldUseMySql(env: EnvMap = process.env) {
  const client = String(env.DB_CLIENT || '').trim().toLowerCase();
  const hasMySqlHost = Boolean(String(env.MYSQL_HOST || '').trim());
  return client === 'mysql' || (hasMySqlHost && client !== 'sqlite');
}

export function getMySqlConfigFromEnv(env: EnvMap = process.env): MySqlConnectionConfig {
  const host = getRequiredEnv(env, 'MYSQL_HOST');
  const user = getRequiredEnv(env, 'MYSQL_USER');
  const database = getRequiredEnv(env, 'MYSQL_DATABASE');
  const port = Number(env.MYSQL_PORT || 3306);
  const connectionLimit = Number(env.MYSQL_POOL_LIMIT || 20);

  if (!Number.isFinite(port) || port <= 0) {
    throw new Error('MYSQL_PORT must be a positive number');
  }

  if (!Number.isFinite(connectionLimit) || connectionLimit <= 0) {
    throw new Error('MYSQL_POOL_LIMIT must be a positive number');
  }

  return {
    host,
    port: Math.trunc(port),
    user,
    password: String(env.MYSQL_PASSWORD || ''),
    database,
    charset: String(env.MYSQL_CHARSET || 'utf8mb4').trim() || 'utf8mb4',
    multipleStatements: true,
    connectionLimit: Math.trunc(connectionLimit),
  };
}

import type { MySqlConnectionConfig } from './types';

type EnvMap = NodeJS.ProcessEnv;

function getOptionalEnv(env: EnvMap, keys: string[]) {
  for (const key of keys) {
    const value = String(env[key] || '').trim();
    if (value) return value;
  }
  return '';
}

function getRequiredValue(value: string, label: string) {
  const normalized = String(value || '').trim();
  if (!normalized) {
    throw new Error(`${label} is required when using MySQL`);
  }
  return normalized;
}

type ParsedConnectionConfig = Omit<MySqlConnectionConfig, 'multipleStatements' | 'connectionLimit'>;

function parseMySqlConnectionString(connectionString: string): Partial<ParsedConnectionConfig> {
  const normalized = String(connectionString || '').trim();
  if (!normalized) return {};

  let url: URL;
  try {
    url = new URL(normalized);
  } catch {
    throw new Error('Invalid MySQL connection string');
  }

  if (!/^mysql:$/i.test(url.protocol)) {
    throw new Error('MySQL connection string must start with mysql://');
  }

  const database = decodeURIComponent(url.pathname.replace(/^\/+/, '').trim());
  const port = Number(url.port || 3306);
  const charset = String(url.searchParams.get('charset') || url.searchParams.get('encoding') || '').trim();

  if (!url.hostname) {
    throw new Error('MySQL connection string is missing host');
  }

  if (!database) {
    throw new Error('MySQL connection string is missing database name');
  }

  if (!Number.isFinite(port) || port <= 0) {
    throw new Error('MySQL connection string has an invalid port');
  }

  return {
    host: url.hostname,
    port: Math.trunc(port),
    user: decodeURIComponent(url.username || ''),
    password: decodeURIComponent(url.password || ''),
    database,
    charset: charset || undefined,
  };
}

function getMySqlConnectionString(env: EnvMap) {
  const mysqlConnectionString = getOptionalEnv(env, [
    'MYSQL_URI',
    'MYSQL_CONNECTION_STRING',
  ]);

  if (mysqlConnectionString) return mysqlConnectionString;

  const databaseUrl = getOptionalEnv(env, ['DATABASE_URL']);
  return /^mysql:\/\//i.test(databaseUrl) ? databaseUrl : '';
}

function getParsedConnectionConfig(env: EnvMap) {
  const connectionString = getMySqlConnectionString(env);

  if (!connectionString) return {};
  return parseMySqlConnectionString(connectionString);
}

export function shouldUseMySql(env: EnvMap = process.env) {
  const client = String(env.DB_CLIENT || '').trim().toLowerCase();
  const hasMySqlHost = Boolean(getOptionalEnv(env, ['MYSQL_HOST', 'MYSQL_PUBLIC_HOST', 'MYSQL_HOSTNAME']));
  const hasMySqlUser = Boolean(getOptionalEnv(env, ['MYSQL_USER', 'MYSQL_USERNAME', 'MYSQL_PUBLIC_USERNAME']));
  const hasMySqlConnectionString = Boolean(getMySqlConnectionString(env));
  return client === 'mysql' || ((hasMySqlHost || hasMySqlUser || hasMySqlConnectionString) && client !== 'sqlite');
}

export function getMySqlConfigFromEnv(env: EnvMap = process.env): MySqlConnectionConfig {
  const parsed = getParsedConnectionConfig(env);

  const host = getOptionalEnv(env, ['MYSQL_HOST', 'MYSQL_PUBLIC_HOST', 'MYSQL_HOSTNAME']) || String(parsed.host || '').trim();
  const user = getOptionalEnv(env, ['MYSQL_USER', 'MYSQL_USERNAME', 'MYSQL_PUBLIC_USERNAME']) || String(parsed.user || '').trim();
  const database = getOptionalEnv(env, ['MYSQL_DATABASE']) || String(parsed.database || '').trim();
  const portValue = getOptionalEnv(env, ['MYSQL_PORT', 'MYSQL_PUBLIC_PORT']) || String(parsed.port || 3306);
  const port = Number(portValue);
  const connectionLimit = Number(getOptionalEnv(env, ['MYSQL_POOL_LIMIT']) || 20);

  if (!Number.isFinite(port) || port <= 0) {
    throw new Error('MYSQL_PORT must be a positive number');
  }

  if (!Number.isFinite(connectionLimit) || connectionLimit <= 0) {
    throw new Error('MYSQL_POOL_LIMIT must be a positive number');
  }

  return {
    host: getRequiredValue(host, 'MYSQL_HOST or MYSQL_URI'),
    port: Math.trunc(port),
    user: getRequiredValue(user, 'MYSQL_USER or MYSQL_USERNAME or MYSQL_URI'),
    password: getOptionalEnv(env, ['MYSQL_PASSWORD', 'MYSQL_PUBLIC_PASSWORD']) || String(parsed.password || ''),
    database: getRequiredValue(database, 'MYSQL_DATABASE or MYSQL_URI'),
    charset: getOptionalEnv(env, ['MYSQL_CHARSET']) || String(parsed.charset || 'utf8mb4').trim() || 'utf8mb4',
    multipleStatements: true,
    connectionLimit: Math.trunc(connectionLimit),
  };
}

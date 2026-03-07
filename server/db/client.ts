import Database from 'better-sqlite3';
import { createRequire } from 'module';
import type { AppDatabase, AppStatement, DbRunResult, MySqlConnectionConfig } from './types';

const require = createRequire(import.meta.url);
const SyncMySql = require('sync-mysql');

type SyncMySqlConnection = {
  query: (sql: string, values?: any[]) => any;
  dispose?: () => void;
};

const LONG_TEXT_COLUMNS = new Set([
  'content',
  'description',
  'payload',
  'payloadJson',
  'extraJson',
  'profileText',
  'detail',
  'roomDescription',
  'spiritAppearance',
  'deathDescription',
  'reason',
  'evidence',
  'verdict',
  'penalty',
  'operationData',
]);

const URL_TEXT_COLUMNS = new Set([
  'avatarUrl',
  'roomBgImage',
  'mapImageUrl',
  'spiritImageUrl',
  'adminAvatarUrl',
]);

function normalizeBindValues(params: any[]) {
  return params.map((value) => {
    if (value === undefined) return null;
    if (value instanceof Date) return value.toISOString();
    if (typeof value === 'boolean') return value ? 1 : 0;
    if (typeof value === 'string') {
      const intervalMatch = value.trim().match(/^([+-]?\d+)\s+seconds?$/i);
      if (intervalMatch) return Number(intervalMatch[1]);
    }
    return value;
  });
}

function chooseTextType(columnName: string, rest: string) {
  const lower = columnName.toLowerCase();
  const hasDefault = /\bDEFAULT\b/i.test(rest);
  const keyLike =
    /\bPRIMARY\s+KEY\b|\bUNIQUE\b/i.test(rest) ||
    /(^id$|id$|token$|name$|title$|type$|status$|role$|faction$|key$|datekey$|locationid$|archiveid$|sessionid$|partyid$|cityid$|shopname$|pointtype$)/i.test(lower);

  if (URL_TEXT_COLUMNS.has(columnName)) return 'VARCHAR(1024)';
  if (LONG_TEXT_COLUMNS.has(columnName)) return hasDefault ? 'VARCHAR(4096)' : 'LONGTEXT';
  if (keyLike) return 'VARCHAR(191)';
  return hasDefault ? 'VARCHAR(255)' : 'LONGTEXT';
}

function normalizeCreateTableSql(block: string) {
  let normalized = block
    .replace(/INTEGER\s+PRIMARY\s+KEY\s+AUTOINCREMENT/gi, 'BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY')
    .replace(/\bAUTOINCREMENT\b/gi, 'AUTO_INCREMENT')
    .replace(/\bREAL\b/gi, 'DOUBLE')
    .replace(/\bBOOLEAN\b/gi, 'TINYINT(1)');

  normalized = normalized
    .split('\n')
    .map((line) => {
      const match = line.match(/^(\s*)([A-Za-z_][A-Za-z0-9_]*)(\s+)TEXT(\b.*)$/);
      if (!match) return line;
      const [, indent, columnName, gap, rest] = match;
      return `${indent}${columnName}${gap}${chooseTextType(columnName, rest)}${rest}`;
    })
    .join('\n');

  return normalized;
}

function normalizeMySqlSql(sql: string) {
  let normalized = sql.replace(/\r\n/g, '\n');
  normalized = normalized.replace(/INSERT\s+OR\s+IGNORE\s+INTO/gi, 'INSERT IGNORE INTO');
  normalized = normalized.replace(/ON\s+CONFLICT\s*\([^)]*\)\s+DO\s+UPDATE\s+SET/gi, 'ON DUPLICATE KEY UPDATE');
  normalized = normalized.replace(/excluded\.(\w+)/gi, 'VALUES($1)');
  normalized = normalized.replace(/datetime\(\s*'now'\s*,\s*\?\s*\)/gi, 'DATE_ADD(UTC_TIMESTAMP(), INTERVAL ? SECOND)');
  normalized = normalized.replace(/datetime\(\s*'now'\s*\)/gi, 'UTC_TIMESTAMP()');
  normalized = normalized.replace(/datetime\(\s*COALESCE\(([^)]*)\)\s*\)/gi, 'CAST(COALESCE($1) AS DATETIME)');
  normalized = normalized.replace(/datetime\(\s*([^()]+?)\s*\)/gi, 'CAST($1 AS DATETIME)');

  if (/CREATE\s+TABLE/i.test(normalized)) {
    normalized = normalized.replace(/CREATE\s+TABLE[\s\S]*?\)\s*;/gi, (block) => normalizeCreateTableSql(block));
  }

  return normalized;
}

class SqliteStatement implements AppStatement {
  constructor(private readonly statement: Database.Statement) {}

  get(...params: any[]) {
    return this.statement.get(...params);
  }

  all(...params: any[]) {
    return this.statement.all(...params);
  }

  run(...params: any[]): DbRunResult {
    const result = this.statement.run(...params) as any;
    return {
      changes: Number(result?.changes || 0),
      lastInsertRowid: Number(result?.lastInsertRowid || 0),
    };
  }
}

export class SqliteDatabase implements AppDatabase {
  readonly dialect = 'sqlite' as const;

  constructor(private readonly db: Database.Database) {}

  prepare(sql: string): AppStatement {
    return new SqliteStatement(this.db.prepare(sql));
  }

  exec(sql: string) {
    this.db.exec(sql);
  }

  pragma(sql: string) {
    return this.db.pragma(sql);
  }

  transaction<T extends (...args: any[]) => any>(fn: T): T {
    const wrapped = this.db.transaction(fn as any);
    return ((...args: any[]) => wrapped(...args)) as T;
  }

  close() {
    this.db.close();
  }
}

class MySqlStatement implements AppStatement {
  constructor(private readonly db: MySqlDatabase, private readonly sql: string) {}

  get(...params: any[]) {
    return this.db.get(this.sql, params);
  }

  all(...params: any[]) {
    return this.db.all(this.sql, params);
  }

  run(...params: any[]) {
    return this.db.run(this.sql, params);
  }
}

export class MySqlDatabase implements AppDatabase {
  readonly dialect = 'mysql' as const;
  private readonly connection: SyncMySqlConnection;

  constructor(config: MySqlConnectionConfig) {
    this.connection = new SyncMySql({
      host: config.host,
      port: config.port,
      user: config.user,
      password: config.password,
      database: config.database,
      charset: config.charset || 'utf8mb4',
      multipleStatements: config.multipleStatements ?? true,
    }) as SyncMySqlConnection;
  }

  prepare(sql: string): AppStatement {
    return new MySqlStatement(this, sql);
  }

  exec(sql: string) {
    const normalized = normalizeMySqlSql(sql);
    this.connection.query(normalized);
  }

  pragma(_sql: string) {
    return null;
  }

  transaction<T extends (...args: any[]) => any>(fn: T): T {
    return ((...args: any[]) => {
      this.connection.query('START TRANSACTION');
      try {
        const result = fn(...args);
        this.connection.query('COMMIT');
        return result;
      } catch (error) {
        try {
          this.connection.query('ROLLBACK');
        } catch {}
        throw error;
      }
    }) as T;
  }

  close() {
    this.connection.dispose?.();
  }

  get(sql: string, params: any[]) {
    const rows = this.all(sql, params);
    return rows[0];
  }

  all(sql: string, params: any[]) {
    const meta = this.handleMetaQuery(sql, params);
    if (meta.handled) return meta.rows;

    const normalized = normalizeMySqlSql(sql);
    const result = this.connection.query(normalized, normalizeBindValues(params));
    return Array.isArray(result) ? result : [];
  }

  run(sql: string, params: any[]): DbRunResult {
    const normalized = normalizeMySqlSql(sql);
    const result = this.connection.query(normalized, normalizeBindValues(params)) as any;
    if (Array.isArray(result)) {
      return { changes: 0, lastInsertRowid: 0 };
    }
    return {
      changes: Number(result?.affectedRows ?? result?.changedRows ?? 0),
      lastInsertRowid: Number(result?.insertId ?? 0),
    };
  }

  private handleMetaQuery(sql: string, params: any[]) {
    const compact = sql.replace(/\s+/g, ' ').trim();
    if (/^SELECT name FROM sqlite_master WHERE type='table' AND name = \?$/i.test(compact)) {
      const rows = this.connection.query(
        `
          SELECT table_name AS name
          FROM information_schema.tables
          WHERE table_schema = DATABASE() AND table_name = ?
          LIMIT 1
        `,
        normalizeBindValues(params),
      ) as any[];
      return { handled: true, rows: rows || [] };
    }

    const pragma = compact.match(/^PRAGMA table_info\(([^)]+)\)$/i);
    if (pragma) {
      const tableName = String(pragma[1] || '').replace(/['"`]/g, '');
      const rows = this.connection.query(
        `
          SELECT
            COLUMN_NAME AS name,
            DATA_TYPE AS type,
            CASE WHEN IS_NULLABLE = 'NO' THEN 1 ELSE 0 END AS notnull,
            COLUMN_DEFAULT AS dflt_value,
            CASE WHEN COLUMN_KEY = 'PRI' THEN 1 ELSE 0 END AS pk
          FROM information_schema.columns
          WHERE table_schema = DATABASE() AND table_name = ?
          ORDER BY ORDINAL_POSITION ASC
        `,
        [tableName],
      ) as any[];
      return { handled: true, rows: rows || [] };
    }

    return { handled: false, rows: [] as any[] };
  }
}

export function createSqliteDatabase(dbPath: string) {
  return new SqliteDatabase(new Database(dbPath));
}

export function createMySqlDatabase(config: MySqlConnectionConfig) {
  return new MySqlDatabase(config);
}

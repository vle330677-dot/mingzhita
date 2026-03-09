import { AsyncLocalStorage } from 'async_hooks';
import Database from 'better-sqlite3';
import mysql from 'mysql2/promise';
import type { Pool, PoolConnection } from 'mysql2/promise';
import type { AppDatabase, AppStatement, DbRunResult, MySqlConnectionConfig } from './types';

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

const MYSQL_RESERVED_COLUMN_NAMES = new Set([
  'key',
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
    /\bPRIMARY\s+KEY\b|\bUNIQUE\b/i.test(rest)
    || /(^id$|id$|token$|name$|title$|type$|status$|role$|faction$|key$|datekey$|locationid$|archiveid$|sessionid$|partyid$|cityid$|shopname$|pointtype$)/i.test(lower);

  if (URL_TEXT_COLUMNS.has(columnName)) return 'VARCHAR(1024)';
  if (LONG_TEXT_COLUMNS.has(columnName)) return hasDefault ? 'VARCHAR(4096)' : 'LONGTEXT';
  if (keyLike) return 'VARCHAR(191)';
  return hasDefault ? 'VARCHAR(255)' : 'LONGTEXT';
}

function quoteMySqlIdentifier(identifier: string) {
  return `\`${String(identifier || '').replace(/`/g, '``')}\``;
}

function quoteReservedMySqlIdentifiers(sql: string) {
  let result = '';
  let quote: "'" | '"' | '`' | null = null;

  for (let i = 0; i < sql.length; i += 1) {
    const char = sql[i];

    if (quote) {
      result += char;
      if (char === quote && sql[i - 1] !== '\\') {
        quote = null;
      }
      continue;
    }

    if (char === "'" || char === '"' || char === '`') {
      quote = char as "'" | '"' | '`';
      result += char;
      continue;
    }

    let replaced = false;
    for (const reservedName of MYSQL_RESERVED_COLUMN_NAMES) {
      if (sql.slice(i, i + reservedName.length) !== reservedName) continue;

      const prev = i > 0 ? sql[i - 1] : '';
      const next = i + reservedName.length < sql.length ? sql[i + reservedName.length] : '';
      const hasIdentifierBefore = /[A-Za-z0-9_`]/.test(prev);
      const hasIdentifierAfter = /[A-Za-z0-9_`]/.test(next);

      if (!hasIdentifierBefore && !hasIdentifierAfter) {
        result += quoteMySqlIdentifier(reservedName);
        i += reservedName.length - 1;
        replaced = true;
        break;
      }
    }

    if (!replaced) {
      result += char;
    }
  }

  return result;
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
      const match = line.match(/^(\s*)([A-Za-z_][A-Za-z0-9_]*)(\s+)(.+)$/);
      if (!match) return line;

      const [, indent, columnName, gap, rawRest] = match;
      if (/^(CREATE|PRIMARY|UNIQUE|FOREIGN|CONSTRAINT|CHECK|INDEX|KEY)$/i.test(columnName)) {
        return line;
      }

      const textMatch = rawRest.match(/^TEXT(\b.*)$/);
      const rest = textMatch ? `${chooseTextType(columnName, textMatch[1])}${textMatch[1]}` : rawRest;
      return `${indent}${quoteMySqlIdentifier(columnName)}${gap}${rest}`;
    })
    .join('\n');

  return normalized;
}

function normalizeMySqlSql(sql: string) {
  let normalized = sql.replace(/\r\n/g, '\n');
  normalized = normalized.replace(/INSERT\s+OR\s+IGNORE\s+INTO/gi, 'INSERT IGNORE INTO');
  normalized = normalized.replace(/INSERT\s+OR\s+REPLACE\s+INTO/gi, 'REPLACE INTO');
  normalized = normalized.replace(/ON\s+CONFLICT\s*\([^)]*\)\s+DO\s+UPDATE\s+SET/gi, 'ON DUPLICATE KEY UPDATE');
  normalized = normalized.replace(/excluded\.(\w+)/gi, 'VALUES($1)');
  normalized = normalized.replace(/datetime\(\s*'now'\s*,\s*\?\s*\)/gi, 'DATE_ADD(UTC_TIMESTAMP(), INTERVAL ? SECOND)');
  normalized = normalized.replace(/datetime\(\s*'now'\s*\)/gi, 'UTC_TIMESTAMP()');
  normalized = normalized.replace(/datetime\(\s*COALESCE\(([^)]*)\)\s*\)/gi, 'CAST(COALESCE($1) AS DATETIME)');
  normalized = normalized.replace(/datetime\(\s*([^()]+?)\s*\)/gi, 'CAST($1 AS DATETIME)');

  // Statements are split before execution, so CREATE TABLE usually reaches here without a trailing semicolon.
  if (/^\s*CREATE\s+TABLE\b/i.test(normalized)) {
    normalized = normalizeCreateTableSql(normalized);
  } else if (/CREATE\s+TABLE/i.test(normalized)) {
    normalized = normalized.replace(/CREATE\s+TABLE[\s\S]*?\)\s*;?/gi, (block) => normalizeCreateTableSql(block));
  }

  normalized = quoteReservedMySqlIdentifiers(normalized);

  return normalized;
}

type ParsedConditionalIndex = {
  unique: boolean;
  indexName: string;
  tableName: string;
  columnsSql: string;
};

function splitSqlStatements(sql: string) {
  const statements: string[] = [];
  let current = '';
  let quote: "'" | '"' | '`' | null = null;

  for (let i = 0; i < sql.length; i += 1) {
    const char = sql[i];
    current += char;

    if (quote) {
      if (char === quote && sql[i - 1] !== '\\') {
        quote = null;
      }
      continue;
    }

    if (char === "'" || char === '"' || char === '`') {
      quote = char as "'" | '"' | '`';
      continue;
    }

    if (char === ';') {
      const statement = current.slice(0, -1).trim();
      if (statement) statements.push(statement);
      current = '';
    }
  }

  const tail = current.trim();
  if (tail) statements.push(tail);
  return statements;
}

function parseConditionalCreateIndex(sql: string): ParsedConditionalIndex | null {
  const trimmed = sql.trim().replace(/\s+/g, ' ');
  const match = trimmed.match(/^CREATE\s+(UNIQUE\s+)?INDEX\s+IF\s+NOT\s+EXISTS\s+([A-Za-z_][A-Za-z0-9_]*)\s+ON\s+([A-Za-z_][A-Za-z0-9_]*)\s*(\([\s\S]+\))$/i);
  if (!match) return null;

  return {
    unique: Boolean(match[1]),
    indexName: match[2],
    tableName: match[3],
    columnsSql: match[4],
  };
}

class SqliteStatement implements AppStatement {
  constructor(
    private readonly database: SqliteDatabase,
    private readonly statement: Database.Statement,
  ) {}

  async get(...params: any[]) {
    return this.database.execute(() => this.statement.get(...params));
  }

  async all(...params: any[]) {
    return this.database.execute(() => this.statement.all(...params));
  }

  async run(...params: any[]): Promise<DbRunResult> {
    return this.database.execute(() => {
      const result = this.statement.run(...params) as any;
      return {
        changes: Number(result?.changes || 0),
        lastInsertRowid: Number(result?.lastInsertRowid || 0),
      };
    });
  }
}

export class SqliteDatabase implements AppDatabase {
  readonly dialect = 'sqlite' as const;
  private queue: Promise<void> = Promise.resolve();
  private readonly transactionContext = new AsyncLocalStorage<true>();
  private savepointCounter = 0;

  constructor(private readonly db: Database.Database) {}

  prepare(sql: string): AppStatement {
    return new SqliteStatement(this, this.db.prepare(sql));
  }

  async exec(sql: string) {
    await this.execute(async () => {
      await this.db.exec(sql);
    });
  }

  async pragma(sql: string) {
    return this.execute(async () => await this.db.pragma(sql));
  }

  transaction<T extends (...args: any[]) => any>(fn: T) {
    return (async (...args: Parameters<T>) => {
      if (this.transactionContext.getStore()) {
        const savepoint = `sqlite_sp_${this.savepointCounter += 1}`;
        await this.db.exec(`SAVEPOINT ${savepoint}`);
        try {
          const result = await fn(...args);
          await this.db.exec(`RELEASE SAVEPOINT ${savepoint}`);
          return result as Awaited<ReturnType<T>>;
        } catch (error) {
          try {
            await this.db.exec(`ROLLBACK TO SAVEPOINT ${savepoint}`);
            await this.db.exec(`RELEASE SAVEPOINT ${savepoint}`);
          } catch {}
          throw error;
        }
      }

      return this.enqueue(async () => {
        await this.db.exec('BEGIN IMMEDIATE');
        try {
          const result = await this.transactionContext.run(true, async () => fn(...args));
          await this.db.exec('COMMIT');
          return result as Awaited<ReturnType<T>>;
        } catch (error) {
          try {
            await this.db.exec('ROLLBACK');
          } catch {}
          throw error;
        }
      });
    }) as (...args: Parameters<T>) => Promise<Awaited<ReturnType<T>>>;
  }

  async close() {
    await this.enqueue(async () => {
      await this.db.close();
    });
  }

  execute<T>(task: () => T): Promise<T> {
    if (this.transactionContext.getStore()) {
      return Promise.resolve(task());
    }
    return this.enqueue(task);
  }

  private enqueue<T>(task: () => T | Promise<T>): Promise<T> {
    const next = this.queue.then(() => task(), () => task());
    this.queue = next.then(() => undefined, () => undefined);
    return next;
  }
}

class MySqlStatement implements AppStatement {
  constructor(
    private readonly database: MySqlDatabase,
    private readonly sql: string,
  ) {}

  get(...params: any[]) {
    return this.database.get(this.sql, params);
  }

  all(...params: any[]) {
    return this.database.all(this.sql, params);
  }

  run(...params: any[]) {
    return this.database.run(this.sql, params);
  }
}

export class MySqlDatabase implements AppDatabase {
  readonly dialect = 'mysql' as const;
  private readonly pool: Pool;
  private readonly transactionContext = new AsyncLocalStorage<PoolConnection>();
  private savepointCounter = 0;

  constructor(config: MySqlConnectionConfig) {
    this.pool = mysql.createPool({
      host: config.host,
      port: config.port,
      user: config.user,
      password: config.password,
      database: config.database,
      charset: config.charset || 'utf8mb4',
      multipleStatements: config.multipleStatements ?? true,
      waitForConnections: true,
      connectionLimit: config.connectionLimit ?? 20,
      queueLimit: 0,
      dateStrings: true,
      timezone: 'Z',
      supportBigNumbers: true,
      bigNumberStrings: true,
    });
  }

  prepare(sql: string): AppStatement {
    return new MySqlStatement(this, sql);
  }

  async exec(sql: string) {
    const statements = splitSqlStatements(sql);
    if (!statements.length) return;
    for (const statement of statements) {
      await this.executeStatement(statement);
    }
  }

  async pragma(_sql: string) {
    return null;
  }

  transaction<T extends (...args: any[]) => any>(fn: T) {
    return (async (...args: Parameters<T>) => {
      const existingConnection = this.transactionContext.getStore();
      if (existingConnection) {
        const savepoint = `mysql_sp_${this.savepointCounter += 1}`;
        await existingConnection.query(`SAVEPOINT ${savepoint}`);
        try {
          const result = await fn(...args);
          await existingConnection.query(`RELEASE SAVEPOINT ${savepoint}`);
          return result as Awaited<ReturnType<T>>;
        } catch (error) {
          try {
            await existingConnection.query(`ROLLBACK TO SAVEPOINT ${savepoint}`);
            await existingConnection.query(`RELEASE SAVEPOINT ${savepoint}`);
          } catch {}
          throw error;
        }
      }

      const connection = await this.pool.getConnection();
      try {
        await connection.beginTransaction();
        const result = await this.transactionContext.run(connection, async () => fn(...args));
        await connection.commit();
        return result as Awaited<ReturnType<T>>;
      } catch (error) {
        try {
          await connection.rollback();
        } catch {}
        throw error;
      } finally {
        connection.release();
      }
    }) as (...args: Parameters<T>) => Promise<Awaited<ReturnType<T>>>;
  }

  async close() {
    await this.pool.end();
  }

  async get(sql: string, params: any[]) {
    const rows = await this.all(sql, params);
    return rows[0];
  }

  async all(sql: string, params: any[]) {
    const meta = await this.handleMetaQuery(sql, params);
    if (meta.handled) return meta.rows;

    const normalized = normalizeMySqlSql(sql);
    const [rows] = await this.getExecutor().query(normalized, normalizeBindValues(params));
    return Array.isArray(rows) ? rows : [];
  }

  async run(sql: string, params: any[]): Promise<DbRunResult> {
    if (await this.ensureConditionalIndex(sql)) {
      return { changes: 0, lastInsertRowid: 0 };
    }

    const normalized = normalizeMySqlSql(sql);
    const [result] = await this.getExecutor().query(normalized, normalizeBindValues(params));
    if (Array.isArray(result)) {
      return { changes: 0, lastInsertRowid: 0 };
    }

    const packet = result as any;
    return {
      changes: Number(packet?.affectedRows ?? packet?.changedRows ?? 0),
      lastInsertRowid: Number(packet?.insertId ?? 0),
    };
  }

  private getExecutor() {
    return this.transactionContext.getStore() || this.pool;
  }

  private async executeStatement(sql: string) {
    const statement = sql.trim();
    if (!statement) return;
    if (await this.ensureConditionalIndex(statement)) return;
    await this.getExecutor().query(normalizeMySqlSql(statement));
  }

  private async ensureConditionalIndex(sql: string) {
    const parsed = parseConditionalCreateIndex(sql);
    if (!parsed) return false;

    const [existing] = await this.getExecutor().query(
      `
        SELECT 1
        FROM information_schema.statistics
        WHERE table_schema = DATABASE()
          AND table_name = ?
          AND index_name = ?
        LIMIT 1
      `,
      [parsed.tableName, parsed.indexName],
    );

    if (Array.isArray(existing) && existing.length > 0) {
      return true;
    }

    const sqlToRun = `CREATE ${parsed.unique ? 'UNIQUE ' : ''}INDEX ${parsed.indexName} ON ${parsed.tableName}${parsed.columnsSql}`;
    await this.getExecutor().query(sqlToRun);
    return true;
  }

  private async handleMetaQuery(sql: string, params: any[]) {
    const compact = sql.replace(/\s+/g, ' ').trim();
    if (/^SELECT name FROM sqlite_master WHERE type='table' AND name = \?$/i.test(compact)) {
      const [rows] = await this.getExecutor().query(
        `
          SELECT table_name AS name
          FROM information_schema.tables
          WHERE table_schema = DATABASE() AND table_name = ?
          LIMIT 1
        `,
        normalizeBindValues(params),
      );
      return { handled: true, rows: Array.isArray(rows) ? rows : [] };
    }

    const pragma = compact.match(/^PRAGMA table_info\(([^)]+)\)$/i);
    if (pragma) {
      const tableName = String(pragma[1] || '').replace(/['"`]/g, '');
      const [rows] = await this.getExecutor().query(
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
      );
      return { handled: true, rows: Array.isArray(rows) ? rows : [] };
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

export async function ensureMySqlDatabase(config: MySqlConnectionConfig) {
  const connection = await mysql.createConnection({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    charset: config.charset || 'utf8mb4',
    multipleStatements: true,
    timezone: 'Z',
  });

  try {
    await connection.query(
      'CREATE DATABASE IF NOT EXISTS ?? CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci',
      [config.database],
    );
  } finally {
    await connection.end();
  }
}

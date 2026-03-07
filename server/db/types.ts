export type DbDialect = 'sqlite' | 'mysql';

export type DbRunResult = {
  changes: number;
  lastInsertRowid: number;
};

export interface AppStatement {
  get(...params: any[]): any;
  all(...params: any[]): any[];
  run(...params: any[]): DbRunResult;
}

export interface AppDatabase {
  dialect: DbDialect;
  prepare(sql: string): AppStatement;
  exec(sql: string): void;
  pragma(sql: string): any;
  transaction<T extends (...args: any[]) => any>(fn: T): T;
  close(): void;
}

export interface MySqlConnectionConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  charset?: string;
  multipleStatements?: boolean;
}

export type DbDialect = 'mysql';

export type DbRunResult = {
  changes: number;
  lastInsertRowid: number;
};

export type DbColumnInfo = {
  name: string;
  type: string;
  nullable: boolean;
  defaultValue: any;
  primaryKey: boolean;
};

export interface AppStatement {
  get(...params: any[]): Promise<any>;
  all(...params: any[]): Promise<any[]>;
  run(...params: any[]): Promise<DbRunResult>;
}

export interface AppDatabase {
  dialect: DbDialect;
  prepare(sql: string): AppStatement;
  exec(sql: string): Promise<void>;
  tableExists(tableName: string): Promise<boolean>;
  getTableColumns(tableName: string): Promise<DbColumnInfo[]>;
  transaction<T extends (...args: any[]) => any>(fn: T): (...args: Parameters<T>) => Promise<Awaited<ReturnType<T>>>;
  close(): Promise<void>;
}

export interface MySqlConnectionConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  charset?: string;
  multipleStatements?: boolean;
  connectionLimit?: number;
}

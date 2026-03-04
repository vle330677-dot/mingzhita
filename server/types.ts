import Database from 'better-sqlite3';
import { RequestHandler } from 'express';

export interface AuthPack {
  requireAdminAuth: RequestHandler;
  requireUserAuth: RequestHandler;
  issueToken: () => string;
  getBearerToken: (req: any) => string;
}

export interface AppContext {
  db: Database.Database;
  auth: AuthPack;
}

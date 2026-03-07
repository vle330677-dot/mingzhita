import type { RequestHandler } from 'express';
import type { AppDatabase } from './db/types';
import type { RealtimeRuntime } from './realtime';

export interface AuthPack {
  requireAdminAuth: RequestHandler;
  requireUserAuth: RequestHandler;
  issueToken: () => string;
  getBearerToken: (req: any) => string;
}

export interface AppContext {
  db: AppDatabase;
  auth: AuthPack;
  runtime: RealtimeRuntime;
}

import type { Response } from 'express';
import { createClient } from 'redis';

export interface PresenceSnapshot {
  id: number;
  name: string;
  role: string;
  job: string;
  status: string;
  currentLocation: string;
  partyId: string | null;
  avatarUrl: string;
  avatarUpdatedAt: string | null;
  towerGuardImprisoned: boolean;
  paranormalImprisoned: boolean;
}

export interface RealtimeEnvelope {
  channel: string;
  event: string;
  payload?: Record<string, any> | null;
  timestamp: string;
}

export interface RateLimitResult {
  allowed: boolean;
  retryAfter: number;
  remaining: number;
}

export interface RealtimeRuntime {
  ready(): Promise<void>;
  hasRedis(): boolean;
  registerUserStream(userId: number, res: Response): () => void;
  publishUser(userId: number, event: string, payload?: Record<string, any>): Promise<void>;
  publishUsers(userIds: number[], event: string, payload?: Record<string, any>): Promise<void>;
  publishBroadcast(event: string, payload?: Record<string, any>): Promise<void>;
  upsertPresence(snapshot: PresenceSnapshot): Promise<void>;
  touchPresence(userId: number): Promise<void>;
  removePresence(userId: number): Promise<void>;
  getWorldPresence(): Promise<PresenceSnapshot[]>;
  getLocationPresence(locationId: string, excludeId?: number): Promise<PresenceSnapshot[]>;
  consumeRateLimit(key: string, windowMs: number, maxRequests: number): Promise<RateLimitResult>;
  getCacheValue<T = any>(key: string, ttlMs: number): Promise<T | null>;
  setCacheValue(key: string, value: any, ttlMs: number): Promise<void>;
  clearCacheByPrefix(prefix: string): Promise<void>;
  shutdown(): Promise<void>;
}

type RedisClientLike = ReturnType<typeof createClient>;
type LocalPresenceEntry = { snapshot: PresenceSnapshot; expiresAt: number };
type LocalRateLimitEntry = { count: number; resetAt: number };
type LocalCacheEntry = { value: any; expiresAt: number };

const REDIS_URL = String(process.env.REDIS_URL || '').trim();
const PUBSUB_PREFIX = 'rt:';
const PRESENCE_KEY_PREFIX = 'presence:user:';
const PRESENCE_ZSET_KEY = 'presence:online';
const CACHE_KEY_PREFIX = 'cache:';
const RATE_LIMIT_KEY_PREFIX = 'ratelimit:';
const PRESENCE_TTL_MS = 120_000;
const STREAM_HEARTBEAT_MS = 20_000;

function nowIso() {
  return new Date().toISOString();
}

function toInt(value: unknown) {
  const next = Number(value);
  if (!Number.isFinite(next)) return 0;
  return Math.trunc(next);
}

function normalizePresence(snapshot: PresenceSnapshot): PresenceSnapshot {
  return {
    id: toInt(snapshot.id),
    name: String(snapshot.name || ''),
    role: String(snapshot.role || ''),
    job: String(snapshot.job || ''),
    status: String(snapshot.status || ''),
    currentLocation: String(snapshot.currentLocation || ''),
    partyId: snapshot.partyId ? String(snapshot.partyId) : null,
    avatarUrl: String(snapshot.avatarUrl || ''),
    avatarUpdatedAt: snapshot.avatarUpdatedAt ? String(snapshot.avatarUpdatedAt) : null,
    towerGuardImprisoned: Boolean(snapshot.towerGuardImprisoned),
    paranormalImprisoned: Boolean(snapshot.paranormalImprisoned),
  };
}

function parseJson<T>(raw: string | Buffer | null | undefined): T | null {
  if (raw == null) return null;
  const text = typeof raw === 'string' ? raw : raw.toString('utf8');
  if (!text) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

class DefaultRealtimeRuntime implements RealtimeRuntime {
  private pubClient: RedisClientLike | null = null;
  private subClient: RedisClientLike | null = null;
  private readyPromise: Promise<void> | null = null;
  private localPresence = new Map<number, LocalPresenceEntry>();
  private localRateLimits = new Map<string, LocalRateLimitEntry>();
  private localCache = new Map<string, LocalCacheEntry>();
  private streamsByUser = new Map<number, Set<Response>>();
  private broadcastStreams = new Set<Response>();
  private streamHeartbeats = new Map<Response, NodeJS.Timeout>();

  ready() {
    if (this.readyPromise) return this.readyPromise;
    this.readyPromise = this.init();
    return this.readyPromise;
  }

  hasRedis() {
    return !!this.pubClient && !!this.subClient;
  }

  registerUserStream(userId: number, res: Response) {
    const normalizedUserId = toInt(userId);
    if (!this.streamsByUser.has(normalizedUserId)) {
      this.streamsByUser.set(normalizedUserId, new Set<Response>());
    }
    this.streamsByUser.get(normalizedUserId)?.add(res);
    this.broadcastStreams.add(res);

    const beat = setInterval(() => {
      if (res.writableEnded || (res as any).destroyed) {
        this.cleanupStream(res, normalizedUserId);
        return;
      }
      try {
        res.write(': keep-alive\n\n');
      } catch {
        this.cleanupStream(res, normalizedUserId);
      }
    }, STREAM_HEARTBEAT_MS);
    this.streamHeartbeats.set(res, beat);

    this.writeEnvelope(res, {
      channel: `user:${normalizedUserId}`,
      event: 'realtime.ready',
      payload: { userId: normalizedUserId, redis: this.hasRedis() },
      timestamp: nowIso(),
    });

    return () => {
      this.cleanupStream(res, normalizedUserId);
    };
  }

  async publishUser(userId: number, event: string, payload: Record<string, any> = {}) {
    const normalizedUserId = toInt(userId);
    if (!normalizedUserId) return;
    await this.publish(`user:${normalizedUserId}`, event, payload);
  }

  async publishUsers(userIds: number[], event: string, payload: Record<string, any> = {}) {
    const ids = Array.from(new Set((Array.isArray(userIds) ? userIds : []).map(toInt).filter(Boolean)));
    await Promise.all(ids.map((userId) => this.publishUser(userId, event, { ...payload, userIds: ids })));
  }

  async publishBroadcast(event: string, payload: Record<string, any> = {}) {
    await this.publish('broadcast', event, payload);
  }

  async upsertPresence(snapshot: PresenceSnapshot) {
    const normalized = normalizePresence(snapshot);
    const expiresAt = Date.now() + PRESENCE_TTL_MS;
    this.localPresence.set(normalized.id, { snapshot: normalized, expiresAt });
    if (!this.pubClient) return;

    const key = `${PRESENCE_KEY_PREFIX}${normalized.id}`;
    await this.pubClient.set(key, JSON.stringify(normalized), { PX: PRESENCE_TTL_MS });
    await this.pubClient.zAdd(PRESENCE_ZSET_KEY, [{ score: Date.now(), value: String(normalized.id) }]);
  }

  async touchPresence(userId: number) {
    const normalizedUserId = toInt(userId);
    if (!normalizedUserId) return;

    const local = this.localPresence.get(normalizedUserId);
    if (local) {
      local.expiresAt = Date.now() + PRESENCE_TTL_MS;
      this.localPresence.set(normalizedUserId, local);
    }

    if (!this.pubClient) return;
    const key = `${PRESENCE_KEY_PREFIX}${normalizedUserId}`;
    const raw = await this.pubClient.get(key);
    if (raw) {
      await this.pubClient.set(key, raw, { PX: PRESENCE_TTL_MS });
    }
    await this.pubClient.zAdd(PRESENCE_ZSET_KEY, [{ score: Date.now(), value: String(normalizedUserId) }]);
  }

  async removePresence(userId: number) {
    const normalizedUserId = toInt(userId);
    if (!normalizedUserId) return;
    this.localPresence.delete(normalizedUserId);
    if (!this.pubClient) return;
    await this.pubClient.del(`${PRESENCE_KEY_PREFIX}${normalizedUserId}`);
    await this.pubClient.zRem(PRESENCE_ZSET_KEY, String(normalizedUserId));
  }

  async getWorldPresence() {
    if (!this.pubClient) return this.getLocalPresence();

    const cutoff = Date.now() - PRESENCE_TTL_MS;
    await this.pubClient.zRemRangeByScore(PRESENCE_ZSET_KEY, 0, cutoff);
    const userIds = await this.pubClient.zRangeByScore(PRESENCE_ZSET_KEY, cutoff, '+inf');
    if (!userIds.length) return [];

    const keys = userIds.map((id) => `${PRESENCE_KEY_PREFIX}${id}`);
    const raws = await this.pubClient.mGet(keys);
    const list: PresenceSnapshot[] = [];
    for (let index = 0; index < raws.length; index += 1) {
      const snapshot = parseJson<PresenceSnapshot>(raws[index]);
      if (!snapshot) continue;
      list.push(normalizePresence(snapshot));
    }
    return list.sort((a, b) => b.id - a.id);
  }

  async getLocationPresence(locationId: string, excludeId = 0) {
    const normalizedLocationId = String(locationId || '').trim();
    const exclude = toInt(excludeId);
    if (!normalizedLocationId) return [];
    const list = await this.getWorldPresence();
    return list.filter((entry) => {
      if (!entry.currentLocation) return false;
      if (exclude && entry.id === exclude) return false;
      return String(entry.currentLocation) === normalizedLocationId;
    });
  }

  async consumeRateLimit(key: string, windowMs: number, maxRequests: number) {
    const normalizedKey = String(key || 'global');
    const normalizedWindowMs = Math.max(1_000, toInt(windowMs) || 60_000);
    const normalizedMaxRequests = Math.max(1, toInt(maxRequests) || 100);
    const now = Date.now();
    const bucket = Math.floor(now / normalizedWindowMs) * normalizedWindowMs;
    const retryAfter = Math.max(1, Math.ceil((bucket + normalizedWindowMs - now) / 1000));

    if (!this.pubClient) {
      const rateKey = `${normalizedKey}:${bucket}`;
      const entry = this.localRateLimits.get(rateKey);
      const nextCount = (entry?.count || 0) + 1;
      this.localRateLimits.set(rateKey, { count: nextCount, resetAt: bucket + normalizedWindowMs });
      for (const [localKey, localEntry] of this.localRateLimits.entries()) {
        if (localEntry.resetAt <= now) this.localRateLimits.delete(localKey);
      }
      return {
        allowed: nextCount <= normalizedMaxRequests,
        retryAfter,
        remaining: Math.max(0, normalizedMaxRequests - nextCount),
      };
    }

    const rateKey = `${RATE_LIMIT_KEY_PREFIX}${normalizedKey}:${bucket}`;
    const nextCount = toInt(await this.pubClient.incr(rateKey));
    if (nextCount === 1) {
      await this.pubClient.pExpire(rateKey, normalizedWindowMs);
    }
    return {
      allowed: nextCount <= normalizedMaxRequests,
      retryAfter,
      remaining: Math.max(0, normalizedMaxRequests - nextCount),
    };
  }

  async getCacheValue<T = any>(key: string, ttlMs: number) {
    const normalizedKey = `${CACHE_KEY_PREFIX}${String(key || '')}`;
    const now = Date.now();
    const normalizedTtlMs = Math.max(1_000, toInt(ttlMs) || 60_000);

    if (!this.pubClient) {
      const local = this.localCache.get(normalizedKey);
      if (!local) return null;
      if (local.expiresAt <= now) {
        this.localCache.delete(normalizedKey);
        return null;
      }
      if (local.expiresAt - now > normalizedTtlMs * 4) {
        local.expiresAt = now + normalizedTtlMs;
        this.localCache.set(normalizedKey, local);
      }
      return local.value as T;
    }

    const raw = await this.pubClient.get(normalizedKey);
    const parsed = parseJson<{ expiresAt: number; value: T }>(raw);
    if (!parsed || parsed.expiresAt <= now) {
      await this.pubClient.del(normalizedKey);
      return null;
    }
    return parsed.value;
  }

  async setCacheValue(key: string, value: any, ttlMs: number) {
    const normalizedTtlMs = Math.max(1_000, toInt(ttlMs) || 60_000);
    const cacheKey = `${CACHE_KEY_PREFIX}${String(key || '')}`;
    const payload = { expiresAt: Date.now() + normalizedTtlMs, value };

    if (!this.pubClient) {
      this.localCache.set(cacheKey, payload);
      return;
    }

    await this.pubClient.set(cacheKey, JSON.stringify(payload), { PX: normalizedTtlMs });
  }

  async clearCacheByPrefix(prefix: string) {
    const normalizedPrefix = `${CACHE_KEY_PREFIX}${String(prefix || '')}`;
    for (const key of Array.from(this.localCache.keys())) {
      if (key.startsWith(normalizedPrefix)) {
        this.localCache.delete(key);
      }
    }

    if (!this.pubClient) return;
    const keys = await this.pubClient.keys(`${normalizedPrefix}*`);
    if (keys.length) {
      await this.pubClient.del(keys);
    }
  }

  async shutdown() {
    for (const timer of this.streamHeartbeats.values()) {
      clearInterval(timer);
    }
    this.streamHeartbeats.clear();
    this.broadcastStreams.clear();
    this.streamsByUser.clear();
    if (this.subClient) {
      await this.subClient.quit().catch(() => undefined);
      this.subClient = null;
    }
    if (this.pubClient) {
      await this.pubClient.quit().catch(() => undefined);
      this.pubClient = null;
    }
  }

  private async init() {
    if (!REDIS_URL) return;

    const pub = createClient({ url: REDIS_URL });
    const sub = pub.duplicate();

    pub.on('error', (error) => {
      console.error('[realtime] redis publisher error', error);
    });
    sub.on('error', (error) => {
      console.error('[realtime] redis subscriber error', error);
    });

    await pub.connect();
    await sub.connect();
    await sub.pSubscribe(`${PUBSUB_PREFIX}*`, (message, channel) => {
      this.handleRedisMessage(channel, message);
    });

    this.pubClient = pub;
    this.subClient = sub;
  }

  private getLocalPresence() {
    const now = Date.now();
    const list: PresenceSnapshot[] = [];
    for (const [userId, entry] of this.localPresence.entries()) {
      if (entry.expiresAt <= now) {
        this.localPresence.delete(userId);
        continue;
      }
      list.push(entry.snapshot);
    }
    return list.sort((a, b) => b.id - a.id);
  }

  private async publish(channel: string, event: string, payload: Record<string, any> = {}) {
    const envelope: RealtimeEnvelope = {
      channel,
      event: String(event || ''),
      payload,
      timestamp: nowIso(),
    };
    const serialized = JSON.stringify(envelope);
    if (!this.pubClient) {
      this.dispatchLocal(channel, envelope);
      return;
    }
    await this.pubClient.publish(`${PUBSUB_PREFIX}${channel}`, serialized);
  }

  private handleRedisMessage(channel: string, message: string) {
    const normalizedChannel = String(channel || '').startsWith(PUBSUB_PREFIX)
      ? String(channel || '').slice(PUBSUB_PREFIX.length)
      : String(channel || '');
    const envelope = parseJson<RealtimeEnvelope>(message);
    if (!envelope) return;
    this.dispatchLocal(normalizedChannel, envelope);
  }

  private dispatchLocal(channel: string, envelope: RealtimeEnvelope) {
    if (channel === 'broadcast') {
      for (const res of Array.from(this.broadcastStreams)) {
        if (!this.writeEnvelope(res, envelope)) {
          this.cleanupStream(res);
        }
      }
      return;
    }

    if (!channel.startsWith('user:')) return;
    const userId = toInt(channel.slice(5));
    const streams = this.streamsByUser.get(userId);
    if (!streams?.size) return;
    for (const res of Array.from(streams)) {
      if (!this.writeEnvelope(res, envelope)) {
        this.cleanupStream(res, userId);
      }
    }
  }

  private writeEnvelope(res: Response, envelope: RealtimeEnvelope) {
    if (res.writableEnded || (res as any).destroyed) {
      return false;
    }
    try {
      res.write(`data: ${JSON.stringify(envelope)}\n\n`);
      return true;
    } catch {
      return false;
    }
  }

  private cleanupStream(res: Response, knownUserId = 0) {
    const heartbeat = this.streamHeartbeats.get(res);
    if (heartbeat) {
      clearInterval(heartbeat);
      this.streamHeartbeats.delete(res);
    }
    this.broadcastStreams.delete(res);
    if (knownUserId) {
      const streams = this.streamsByUser.get(knownUserId);
      streams?.delete(res);
      if (streams && streams.size === 0) this.streamsByUser.delete(knownUserId);
      return;
    }
    for (const [userId, streams] of this.streamsByUser.entries()) {
      streams.delete(res);
      if (streams.size === 0) this.streamsByUser.delete(userId);
    }
  }
}

export function createRealtimeRuntime(): RealtimeRuntime {
  return new DefaultRealtimeRuntime();
}

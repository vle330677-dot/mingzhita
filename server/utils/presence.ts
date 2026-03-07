import type { PresenceSnapshot } from '../realtime';

type AnyRow = Record<string, any>;

export const ONLINE_WINDOW_SECONDS = 90;

function mapPresenceRow(row: AnyRow | undefined | null): PresenceSnapshot | null {
  if (!row) return null;
  return {
    id: Number(row.id || 0),
    name: String(row.name || row.userName || ''),
    role: String(row.role || '\u672a\u5206\u5316'),
    job: String(row.job || '\u65e0'),
    status: String(row.status || ''),
    currentLocation: String(row.currentLocation || row.locationId || ''),
    partyId: row.partyId ? String(row.partyId) : null,
    avatarUrl: String(row.avatarUrl || ''),
    avatarUpdatedAt: row.avatarUpdatedAt ? String(row.avatarUpdatedAt) : null,
    towerGuardImprisoned: Number(row.towerGuardImprisoned || 0) === 1,
    paranormalImprisoned: Number(row.paranormalImprisoned || 0) === 1,
  };
}

function basePresenceSql(whereClause: string) {
  return `
    SELECT
      u.id,
      u.name,
      u.name AS userName,
      u.role,
      u.job,
      u.status,
      u.currentLocation,
      u.currentLocation AS locationId,
      u.partyId,
      u.avatarUrl,
      u.avatarUpdatedAt,
      COALESCE(tgp.isImprisoned, 0) AS towerGuardImprisoned,
      COALESCE(pp.isImprisoned, 0) AS paranormalImprisoned
    FROM users u
    LEFT JOIN tower_guard_prisoners tgp ON tgp.userId = u.id
    LEFT JOIN paranormal_prisoners pp ON pp.userId = u.id
    ${whereClause}
  `;
}

export function loadPresenceByUserId(db: any, userId: number) {
  const row = db.prepare(`
    ${basePresenceSql(`
      WHERE u.id = ?
        AND u.status IN ('approved', 'ghost')
    `)}
    LIMIT 1
  `).get(Number(userId || 0)) as AnyRow | undefined;
  return mapPresenceRow(row);
}

export function loadPresenceByUserIds(db: any, userIds: number[]) {
  const ids = Array.from(new Set((Array.isArray(userIds) ? userIds : []).map((value) => Number(value || 0)).filter(Boolean)));
  if (!ids.length) return [] as PresenceSnapshot[];
  const placeholders = ids.map(() => '?').join(',');
  const rows = db.prepare(`
    ${basePresenceSql(`
      WHERE u.id IN (${placeholders})
        AND u.status IN ('approved', 'ghost')
    `)}
    ORDER BY u.id DESC
  `).all(...ids) as AnyRow[];
  return rows.map(mapPresenceRow).filter(Boolean) as PresenceSnapshot[];
}

export function loadOnlinePresenceFallback(db: any, onlineWindowSeconds = ONLINE_WINDOW_SECONDS) {
  const rows = db.prepare(`
    ${basePresenceSql(`
      WHERE u.status IN ('approved', 'ghost')
        AND COALESCE(u.currentLocation, '') <> ''
        AND EXISTS (
          SELECT 1
          FROM user_sessions s
          WHERE s.userId = u.id
            AND s.role = 'player'
            AND s.revokedAt IS NULL
            AND datetime(s.lastSeenAt) >= datetime('now', ?)
        )
    `)}
    ORDER BY u.id DESC
  `).all(`-${Math.max(1, Number(onlineWindowSeconds || ONLINE_WINDOW_SECONDS))} seconds`) as AnyRow[];
  return rows.map(mapPresenceRow).filter(Boolean) as PresenceSnapshot[];
}

export function filterPresenceByLocation(list: PresenceSnapshot[], locationId: string, excludeId = 0) {
  const normalizedLocationId = String(locationId || '').trim();
  const normalizedExcludeId = Number(excludeId || 0);
  if (!normalizedLocationId) return [] as PresenceSnapshot[];
  return (Array.isArray(list) ? list : []).filter((row) => {
    if (!row) return false;
    if (!String(row.currentLocation || '').trim()) return false;
    if (normalizedExcludeId && Number(row.id || 0) === normalizedExcludeId) return false;
    return String(row.currentLocation || '').trim() === normalizedLocationId;
  });
}

import type { AppDatabase } from '../db/types';

export const nowIso = () => new Date().toISOString();

export const getLocalToday = () => {
  const d = new Date();
  const tzOffsetMs = d.getTimezoneOffset() * 60 * 1000;
  return new Date(d.getTime() - tzOffsetMs).toISOString().split('T')[0];
};

export const resolveInitialHome = (age: number, gold: number, role?: string) => {
  if (String(role || '') === '\u672a\u5206\u5316' || Number(age) < 16) return 'sanctuary';
  return Number(gold) > 9999 ? 'rich_area' : 'slums';
};

export const writeAdminLog = (
  db: AppDatabase,
  adminName: string,
  action: string,
  targetType?: string,
  targetId?: string,
  detail?: any
) => {
  db.prepare(`
    INSERT INTO admin_action_logs (adminName, action, targetType, targetId, detail)
    VALUES (?, ?, ?, ?, ?)
  `).run(adminName, action, targetType || null, targetId || null, detail ? JSON.stringify(detail) : null);
};

export function hashNum(input: string | number) {
  const s = String(input);
  let h = 0;
  for (let i = 0; i < s.length; i++) h = s.charCodeAt(i) + ((h << 5) - h);
  return Math.abs(h);
}

type RoomMapId = 'sanctuary' | 'slums' | 'rich_area';

const MAP_DEFAULT_ANCHOR: Record<RoomMapId, { x: number; y: number }> = {
  sanctuary: { x: 30, y: 38 },
  slums: { x: 52, y: 73 },
  rich_area: { x: 68, y: 34 }
};

const MAP_JOB_ANCHOR: Record<RoomMapId, Record<string, { x: number; y: number }>> = {
  sanctuary: {
    '\u5723\u6240\u5e7c\u5d3d': { x: 30, y: 36 },
    '\u5723\u6240\u4fdd\u80b2\u5458': { x: 24, y: 42 },
    '\u5723\u6240\u804c\u5de5': { x: 36, y: 42 }
  },
  slums: {
    '\u897f\u533a\u6280\u5de5': { x: 46, y: 72 },
    '\u897f\u533a\u526f\u5e02\u957f': { x: 52, y: 74 },
    '\u897f\u533a\u5e02\u957f': { x: 58, y: 70 }
  },
  rich_area: {
    '\u4e1c\u533a\u8d35\u65cf': { x: 62, y: 36 },
    '\u4e1c\u533a\u526f\u5e02\u957f': { x: 70, y: 34 },
    '\u4e1c\u533a\u5e02\u957f': { x: 76, y: 32 }
  }
};

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

export function getRoomEntrancePos(
  locationId: string,
  job: string,
  ownerId: number,
  fallback = { x: 50, y: 50 }
) {
  const map = (['sanctuary', 'slums', 'rich_area'].includes(locationId)
    ? locationId
    : 'sanctuary') as RoomMapId;

  const exactAnchor = MAP_JOB_ANCHOR[map]?.[job];
  const anchor = exactAnchor || MAP_DEFAULT_ANCHOR[map] || fallback;

  const h = hashNum(`${map}:${job}:${ownerId}`);
  const angle = ((h % 360) * Math.PI) / 180;
  const baseR = exactAnchor ? 1.4 : 2.6;
  const r = baseR + (h % 7) * (exactAnchor ? 0.28 : 0.45);

  return {
    x: clamp(anchor.x + Math.cos(angle) * r, 8, 92),
    y: clamp(anchor.y + Math.sin(angle) * r, 8, 92)
  };
}

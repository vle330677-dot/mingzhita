import Database from 'better-sqlite3';

export const nowIso = () => new Date().toISOString();

export const getLocalToday = () => {
  const d = new Date();
  const tzOffsetMs = d.getTimezoneOffset() * 60 * 1000;
  return new Date(d.getTime() - tzOffsetMs).toISOString().split('T')[0];
};

export const resolveInitialHome = (age: number, gold: number, role?: string) => {
  if (String(role || '') === '未分化' || Number(age) < 16) return 'sanctuary';
  return Number(gold) > 9999 ? 'rich_area' : 'slums';
};

export const writeAdminLog = (
  db: Database.Database,
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
    '圣所幼崽': { x: 30, y: 36 },
    '圣所保育员': { x: 24, y: 42 },
    '圣所职工': { x: 36, y: 42 }
  },
  slums: {
    '西区技工': { x: 46, y: 72 },
    '西区副市长': { x: 52, y: 74 },
    '西区市长': { x: 58, y: 70 }
  },
  rich_area: {
    '东区贵族': { x: 62, y: 36 },
    '东区副市长': { x: 70, y: 34 },
    '东区市长': { x: 76, y: 32 }
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

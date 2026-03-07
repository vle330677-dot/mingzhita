import { Router } from 'express';
import { AppContext } from '../types';
import { writeAdminLog } from '../utils/common';
import { applyDefaultCatalogSeed } from '../db/seed';

type AnyRow = Record<string, any>;
const SKILL_FACTIONS = new Set(['物理系', '元素系', '精神系', '感知系', '信息系', '治疗系', '强化系', '炼金系', '圣所', '普通人', '恶魔会', '通用']);
const ITEM_TYPES = new Set(['回复道具', '任务道具', '技能书道具', '贵重物品', '违禁品']);
const TIERS = new Set(['低阶', '中阶', '高阶']);
const ITEM_LOCATION_ALIASES: Record<string, string> = {
  all: 'all',
  全图: 'all',
  全地图: 'all',
  通用: 'all',
  tower_of_life: 'tower_of_life',
  命之塔: 'tower_of_life',
  sanctuary: 'sanctuary',
  圣所: 'sanctuary',
  london_tower: 'london_tower',
  伦敦塔: 'london_tower',
  slums: 'slums',
  west_market: 'slums',
  西市: 'slums',
  贫民区: 'slums',
  rich_area: 'rich_area',
  east_market: 'rich_area',
  东市: 'rich_area',
  富人区: 'rich_area',
  demon_society: 'demon_society',
  恶魔会: 'demon_society',
  guild: 'guild',
  公会: 'guild',
  工会: 'guild',
  army: 'army',
  军队: 'army',
  tower_guard: 'tower_guard',
  守塔会: 'tower_guard',
  observers: 'observers',
  观察者: 'observers',
  paranormal_office: 'paranormal_office',
  灵异管理所: 'paranormal_office'
};
const ITEM_LOCATION_LABELS: Record<string, string> = {
  all: '全图',
  tower_of_life: '命之塔',
  sanctuary: '圣所',
  london_tower: '伦敦塔',
  slums: '西市',
  rich_area: '东市',
  demon_society: '恶魔会',
  guild: '工会',
  army: '军队',
  tower_guard: '守塔会',
  observers: '观察者',
  paranormal_office: '灵异管理所'
};

const normalizeTier = (v: any) => {
  const s = String(v || '').trim();
  return TIERS.has(s) ? s : '低阶';
};

const normalizeSkillFaction = (v: any) => {
  const s = String(v || '').trim();
  return SKILL_FACTIONS.has(s) ? s : '通用';
};

const normalizeItemLocationTag = (v: any) => {
  const raw = String(v || '').trim();
  if (!raw) return '';
  const low = raw.toLowerCase();
  return ITEM_LOCATION_ALIASES[raw] || ITEM_LOCATION_ALIASES[low] || raw;
};

const normalizeItemOrigin = (locationTag: string, fallbackRaw: any) => {
  const fallback = String(fallbackRaw || '').trim();
  const normalizedFallback = normalizeItemLocationTag(fallback);
  if (normalizedFallback && ITEM_LOCATION_LABELS[normalizedFallback]) {
    return ITEM_LOCATION_LABELS[normalizedFallback];
  }
  if (locationTag && ITEM_LOCATION_LABELS[locationTag]) {
    return ITEM_LOCATION_LABELS[locationTag];
  }
  return fallback || locationTag || '通用';
};

const normalizeItemType = (v: any) => {
  const s = String(v || '').trim();
  if (s === '恢复道具') return '回复道具';
  if (s === '违禁道具') return '违禁品';
  return ITEM_TYPES.has(s) ? s : '回复道具';
};

function ensureInventoryTable(db: any) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS inventory (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER NOT NULL,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      qty INTEGER DEFAULT 1,
      itemType TEXT DEFAULT 'consumable',
      effectValue INTEGER DEFAULT 0,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

function addInventoryItem(db: any, userId: number, name: string, itemType = 'consumable', qty = 1, description = '', effectValue = 0) {
  const row = db.prepare(`SELECT id, qty FROM inventory WHERE userId = ? AND name = ? AND itemType = ? LIMIT 1`)
    .get(userId, name, itemType) as AnyRow | undefined;
  if (row) {
    db.prepare(`UPDATE inventory SET qty = qty + ? WHERE id = ?`).run(qty, Number(row.id));
    return;
  }
  db.prepare(`
    INSERT INTO inventory(userId, name, description, qty, itemType, effectValue, createdAt)
    VALUES(?,?,?,?,?,?,CURRENT_TIMESTAMP)
  `).run(userId, name, description, qty, itemType, effectValue);
}

function canLearnSkillByFaction(user: AnyRow, skillFactionRaw: any) {
  const skillFaction = String(skillFactionRaw || '通用').trim();
  if (!skillFaction || skillFaction === '通用') return true;
  const userFaction = String(user.faction || '').trim();
  const userRole = String(user.role || '').trim();
  const signals = [userFaction, userRole].filter(Boolean);
  if (signals.length === 0) return skillFaction === '普通人';
  return signals.some((x) => x === skillFaction || x.includes(skillFaction));
}

export function createCatalogRouter(ctx: AppContext) {
  const r = Router();
  const { db, auth } = ctx;
  ensureInventoryTable(db);

  const mapSkill = (s: AnyRow) => ({
    id: Number(s.id),
    name: String(s.name || ''),
    faction: String(s.faction || '通用'),
    tier: String(s.tier || '低阶'),
    description: String(s.description || ''),
    npcId: s.npcId ?? null,
  });

  const mapItem = (i: AnyRow) => ({
    id: Number(i.id),
    name: String(i.name || ''),
    description: String(i.description || ''),
    locationTag: String(i.locationTag || ''),
    npcId: i.npcId ?? null,
    price: Number(i.price || 0),
    faction: String(i.faction || '通用'),
    tier: String(i.tier || '低阶'),
    itemType: String(i.itemType || '回复道具'),
    effectValue: Number(i.effectValue || 0),
  });

  r.get('/items', (_req, res) => {
    try {
      const rows = db.prepare(`SELECT * FROM items ORDER BY id DESC`).all() as AnyRow[];
      res.json({ success: true, items: rows.map(mapItem) });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e?.message || 'query items failed', items: [] });
    }
  });

  r.get('/skills', (_req, res) => {
    try {
      const rows = db.prepare(`SELECT * FROM skills ORDER BY id DESC`).all() as AnyRow[];
      res.json({ success: true, skills: rows.map(mapSkill) });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e?.message || 'query skills failed', skills: [] });
    }
  });

  r.get('/skills/available/:userId', (req, res) => {
    try {
      const userId = Number(req.params.userId);
      if (!userId) return res.status(400).json({ success: false, message: 'invalid userId' });

      const rows = db
        .prepare(
          `
            SELECT s.*
            FROM skills s
            LEFT JOIN user_skills us
              ON us.skillId = s.id
             AND us.userId = ?
            WHERE us.id IS NULL
            ORDER BY s.id DESC
          `
        )
        .all(userId) as AnyRow[];

      res.json({ success: true, skills: rows.map(mapSkill) });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e?.message || 'query available skills failed', skills: [] });
    }
  });

  r.get('/users/:userId/skills', (req, res) => {
    try {
      const userId = Number(req.params.userId);
      if (!userId) return res.status(400).json({ success: false, message: 'invalid userId' });

      const rows = db
        .prepare(
          `
            SELECT us.id, us.userId, us.skillId, us.level, s.name, s.faction, s.tier, s.description
            FROM user_skills us
            JOIN skills s ON s.id = us.skillId
            WHERE us.userId = ?
            ORDER BY us.id DESC
          `
        )
        .all(userId) as AnyRow[];

      res.json({
        success: true,
        skills: rows.map((x) => ({
          id: Number(x.id),
          userId: Number(x.userId),
          skillId: Number(x.skillId),
          level: Number(x.level || 1),
          name: String(x.name || ''),
          faction: String(x.faction || '通用'),
          tier: String(x.tier || '低阶'),
          description: String(x.description || ''),
        })),
      });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e?.message || 'query user skills failed', skills: [] });
    }
  });

  r.post('/users/:userId/skills', (req, res) => {
    try {
      const userId = Number(req.params.userId);
      if (!userId) return res.status(400).json({ success: false, message: 'invalid userId' });

      const name = String(req.body?.name || '').trim();
      if (!name) return res.status(400).json({ success: false, message: 'skill name required' });

      const skill = db.prepare(`SELECT id, name, faction FROM skills WHERE name = ? LIMIT 1`).get(name) as AnyRow | undefined;
      if (!skill) return res.status(404).json({ success: false, message: 'skill not found' });

      const user = db.prepare(`SELECT id, role, faction FROM users WHERE id = ? LIMIT 1`).get(userId) as AnyRow | undefined;
      if (!user) return res.status(404).json({ success: false, message: 'user not found' });

      if (!canLearnSkillByFaction(user, skill.faction)) {
        addInventoryItem(
          db,
          userId,
          `[技能书] ${String(skill.name || name)}`,
          'skill_book',
          1,
          '跨派系技能学习书，可交易或出售',
          0
        );
        return res.json({
          success: true,
          convertedToBook: true,
          message: `派系不匹配，已将 ${String(skill.name || name)} 转化为技能书放入背包`
        });
      }

      db.prepare(`INSERT OR IGNORE INTO user_skills(userId, skillId, level) VALUES (?, ?, 1)`).run(userId, Number(skill.id));
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e?.message || 'learn skill failed' });
    }
  });

  r.delete('/users/:userId/skills/:id', (req, res) => {
    try {
      const userId = Number(req.params.userId);
      const id = Number(req.params.id);
      if (!userId || !id) return res.status(400).json({ success: false, message: 'invalid params' });

      const ret = db.prepare(`DELETE FROM user_skills WHERE userId = ? AND (id = ? OR skillId = ?)`).run(userId, id, id);
      res.json({ success: true, changes: Number(ret.changes || 0) });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e?.message || 'delete user skill failed' });
    }
  });

  r.post('/users/:userId/skills/merge', (req, res) => {
    try {
      const userId = Number(req.params.userId);
      let skillAId = Number(req.body?.skillAId || req.body?.sourceId || 0);
      let skillBId = Number(req.body?.skillBId || req.body?.targetId || 0);
      const skillName = String(req.body?.skillName || '').trim();
      if ((!skillAId || !skillBId) && skillName) {
        const rows = db.prepare(`
          SELECT us.id
          FROM user_skills us
          JOIN skills s ON s.id = us.skillId
          WHERE us.userId = ? AND s.name = ?
          ORDER BY us.level DESC, us.id DESC
          LIMIT 2
        `).all(userId, skillName) as AnyRow[];
        if (rows.length >= 2) {
          skillAId = Number(rows[0].id);
          skillBId = Number(rows[1].id);
        }
      }
      if (!userId || !skillAId || !skillBId) {
        return res.status(400).json({ success: false, message: 'invalid merge params' });
      }
      if (skillAId === skillBId) {
        return res.status(400).json({ success: false, message: 'cannot merge same skill' });
      }

      const a = db.prepare(`SELECT * FROM user_skills WHERE userId = ? AND (id = ? OR skillId = ?) LIMIT 1`).get(userId, skillAId, skillAId) as AnyRow | undefined;
      const b = db.prepare(`SELECT * FROM user_skills WHERE userId = ? AND (id = ? OR skillId = ?) LIMIT 1`).get(userId, skillBId, skillBId) as AnyRow | undefined;
      if (!a || !b) return res.status(404).json({ success: false, message: 'skills not found' });

      const keep = Number(a.level || 1) >= Number(b.level || 1) ? a : b;
      const drop = keep === a ? b : a;
      const nextLevel = Math.max(Number(keep.level || 1), Number(drop.level || 1)) + 1;

      db.prepare(`UPDATE user_skills SET level = ? WHERE id = ?`).run(nextLevel, Number(keep.id));
      db.prepare(`DELETE FROM user_skills WHERE id = ?`).run(Number(drop.id));

      res.json({ success: true, level: nextLevel });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e?.message || 'merge skill failed' });
    }
  });

  r.post('/admin/items', auth.requireAdminAuth, (req: any, res) => {
    try {
      const body = req.body || {};
      const name = String(body.name || '').trim();
      if (!name) return res.status(400).json({ success: false, message: 'name required' });
      const adminName = String(req.admin?.name || 'admin');
      const tier = normalizeTier(body.tier);
      const locationTag = normalizeItemLocationTag(body.locationTag || body.faction);
      if (!locationTag) return res.status(400).json({ success: false, message: 'locationTag required' });
      const faction = normalizeItemOrigin(locationTag, body.faction);
      const itemType = normalizeItemType(body.itemType);

      db.prepare(
        `
          INSERT INTO items(name, description, locationTag, npcId, price, faction, tier, itemType, effectValue)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `
      ).run(
        name,
        String(body.description || ''),
        locationTag,
        body.npcId ?? null,
        Number(body.price || 0),
        faction,
        tier,
        itemType,
        Number(body.effectValue || 0),
      );

      writeAdminLog(db, adminName, `编辑物品 ${name}`, 'item', name, { faction, tier, itemType, locationTag });
      res.json({ success: true, message: `管理员 ${adminName} 编辑了物品 ${name}` });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e?.message || 'create item failed' });
    }
  });

  r.put('/admin/items/:id', auth.requireAdminAuth, (req: any, res) => {
    try {
      const id = Number(req.params.id);
      if (!id) return res.status(400).json({ success: false, message: 'invalid id' });
      const row = db.prepare(`SELECT id, name FROM items WHERE id = ? LIMIT 1`).get(id) as AnyRow | undefined;
      if (!row) return res.status(404).json({ success: false, message: 'item not found' });

      const body = req.body || {};
      const name = String(body.name || '').trim();
      if (!name) return res.status(400).json({ success: false, message: 'name required' });
      const adminName = String(req.admin?.name || 'admin');
      const tier = normalizeTier(body.tier);
      const locationTag = normalizeItemLocationTag(body.locationTag || body.faction);
      if (!locationTag) return res.status(400).json({ success: false, message: 'locationTag required' });
      const faction = normalizeItemOrigin(locationTag, body.faction);
      const itemType = normalizeItemType(body.itemType);

      db.prepare(`
        UPDATE items
        SET name = ?,
            description = ?,
            locationTag = ?,
            npcId = ?,
            price = ?,
            faction = ?,
            tier = ?,
            itemType = ?,
            effectValue = ?
        WHERE id = ?
      `).run(
        name,
        String(body.description || ''),
        locationTag,
        body.npcId ?? null,
        Number(body.price || 0),
        faction,
        tier,
        itemType,
        Number(body.effectValue || 0),
        id
      );

      writeAdminLog(db, adminName, `编辑物品 ${name}`, 'item', String(id), { faction, tier, itemType, locationTag });
      res.json({ success: true, message: `管理员 ${adminName} 更新了物品 ${name}` });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e?.message || 'update item failed' });
    }
  });

  r.delete('/admin/items/:id', auth.requireAdminAuth, (req: any, res) => {
    try {
      const id = Number(req.params.id);
      if (!id) return res.status(400).json({ success: false, message: 'invalid id' });
      const row = db.prepare(`SELECT id, name FROM items WHERE id = ? LIMIT 1`).get(id) as AnyRow | undefined;
      if (!row) return res.status(404).json({ success: false, message: 'item not found' });
      db.prepare(`DELETE FROM items WHERE id = ?`).run(id);
      const adminName = String(req.admin?.name || 'admin');
      writeAdminLog(db, adminName, `删除物品 ${String(row.name || id)}`, 'item', String(id));
      res.json({ success: true, message: `管理员 ${adminName} 编辑了物品库：删除 ${String(row.name || id)}` });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e?.message || 'delete item failed' });
    }
  });

  r.post('/admin/skills', auth.requireAdminAuth, (req: any, res) => {
    try {
      const body = req.body || {};
      const name = String(body.name || '').trim();
      if (!name) return res.status(400).json({ success: false, message: 'name required' });
      const adminName = String(req.admin?.name || 'admin');
      const tier = normalizeTier(body.tier);
      const faction = normalizeSkillFaction(body.faction);

      db.prepare(
        `
          INSERT INTO skills(name, faction, tier, description, npcId)
          VALUES (?, ?, ?, ?, ?)
        `
      ).run(
        name,
        faction,
        tier,
        String(body.description || ''),
        body.npcId ?? null,
      );

      writeAdminLog(db, adminName, `编辑技能 ${name}`, 'skill', name, { faction, tier });
      res.json({ success: true, message: `管理员 ${adminName} 编辑了技能 ${name}` });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e?.message || 'create skill failed' });
    }
  });

  r.put('/admin/skills/:id', auth.requireAdminAuth, (req: any, res) => {
    try {
      const id = Number(req.params.id);
      if (!id) return res.status(400).json({ success: false, message: 'invalid id' });
      const row = db.prepare(`SELECT id, name FROM skills WHERE id = ? LIMIT 1`).get(id) as AnyRow | undefined;
      if (!row) return res.status(404).json({ success: false, message: 'skill not found' });

      const body = req.body || {};
      const name = String(body.name || '').trim();
      if (!name) return res.status(400).json({ success: false, message: 'name required' });
      const adminName = String(req.admin?.name || 'admin');
      const tier = normalizeTier(body.tier);
      const faction = normalizeSkillFaction(body.faction);

      db.prepare(`
        UPDATE skills
        SET name = ?,
            faction = ?,
            tier = ?,
            description = ?,
            npcId = ?
        WHERE id = ?
      `).run(
        name,
        faction,
        tier,
        String(body.description || ''),
        body.npcId ?? null,
        id
      );

      writeAdminLog(db, adminName, `编辑技能 ${name}`, 'skill', String(id), { faction, tier });
      res.json({ success: true, message: `管理员 ${adminName} 更新了技能 ${name}` });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e?.message || 'update skill failed' });
    }
  });

  r.delete('/admin/skills/:id', auth.requireAdminAuth, (req: any, res) => {
    try {
      const id = Number(req.params.id);
      if (!id) return res.status(400).json({ success: false, message: 'invalid id' });
      const row = db.prepare(`SELECT id, name FROM skills WHERE id = ? LIMIT 1`).get(id) as AnyRow | undefined;
      if (!row) return res.status(404).json({ success: false, message: 'skill not found' });
      db.prepare(`DELETE FROM skills WHERE id = ?`).run(id);
      db.prepare(`DELETE FROM user_skills WHERE skillId = ?`).run(id);
      const adminName = String(req.admin?.name || 'admin');
      writeAdminLog(db, adminName, `删除技能 ${String(row.name || id)}`, 'skill', String(id));
      res.json({ success: true, message: `管理员 ${adminName} 编辑了技能库：删除 ${String(row.name || id)}` });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e?.message || 'delete skill failed' });
    }
  });

  r.post('/admin/catalog/bootstrap-defaults', auth.requireAdminAuth, (req: any, res) => {
    try {
      applyDefaultCatalogSeed(db);
      const adminName = String(req.admin?.name || 'admin');
      writeAdminLog(db, adminName, '补齐默认物品与技能', 'catalog', 'bootstrap-defaults');
      res.json({ success: true, message: `管理员 ${adminName} 已补齐默认物品与技能` });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e?.message || 'bootstrap defaults failed' });
    }
  });

  return r;
}


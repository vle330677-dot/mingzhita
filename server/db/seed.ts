import type { AppDatabase } from './types';

const GUILD_DEFAULT_ITEMS = [
  {
    name: '旧世界指南针',
    description: '在公会地盘流通的旧时代探险器具，能提高野外搜寻效率。',
    locationTag: 'guild',
    price: 160,
    faction: '通用',
    tier: '中阶',
    itemType: '任务道具',
    effectValue: 0
  },
  {
    name: '黑曜护符',
    description: '冒险者常备护身符，据说能在恶战时保住最后一口气。',
    locationTag: 'guild',
    price: 220,
    faction: '通用',
    tier: '中阶',
    itemType: '回复道具',
    effectValue: 35
  },
  {
    name: '地下拍卖邀请函',
    description: '仅在地下拍卖行流通的入场凭据，常被当成稀有藏品。',
    locationTag: 'guild',
    price: 480,
    faction: '通用',
    tier: '高阶',
    itemType: '贵重物品',
    effectValue: 180
  },
  {
    name: '契约墨印',
    description: '公会会长用于签署紧急委托的印记，具备收藏和交易价值。',
    locationTag: 'guild',
    price: 360,
    faction: '通用',
    tier: '高阶',
    itemType: '贵重物品',
    effectValue: 140
  }
] as const;

const DEMON_CONTRABAND_DEFAULT_ITEMS = [
  {
    name: '违禁品·催眠伪装剂(哨兵型)',
    description: '短时刺激战斗本能，让普通人伪装成哨兵气场；会带来情绪躁动副作用。',
    locationTag: 'demon_society',
    price: 420,
    faction: '恶魔会',
    tier: '中阶',
    itemType: '违禁品',
    effectValue: 28
  },
  {
    name: '违禁品·催眠伪装剂(向导型)',
    description: '强化精神感知波段，让普通人短时伪装向导；药效后会出现精神疲劳。',
    locationTag: 'demon_society',
    price: 460,
    faction: '恶魔会',
    tier: '中阶',
    itemType: '违禁品',
    effectValue: 30
  },
  {
    name: '违禁品·抑制剂(身份降噪)',
    description: '压制哨兵/向导特征，短时模拟普通人状态；会损耗体能与稳定值。',
    locationTag: 'demon_society',
    price: 380,
    faction: '恶魔会',
    tier: '中阶',
    itemType: '违禁品',
    effectValue: 22
  },
  {
    name: '违禁品·透支晋阶药(黑焰型)',
    description: '透支潜能快速提升战力与精神阈值，但会引发明显反噬。',
    locationTag: 'demon_society',
    price: 760,
    faction: '恶魔会',
    tier: '高阶',
    itemType: '违禁品',
    effectValue: 48
  }
] as const;

const WORLD_DEFAULT_ITEMS = [
  {
    name: '命塔应急绷带',
    description: '命之塔医疗室常备绷带，快速止血并回复体力。',
    locationTag: 'tower_of_life',
    price: 120,
    faction: '命之塔',
    tier: '低阶',
    itemType: '回复道具',
    effectValue: 30
  },
  {
    name: '白塔训练手册',
    description: '伦敦塔基础训练教材，可兑换学分或出售。',
    locationTag: 'london_tower',
    price: 200,
    faction: '伦敦塔',
    tier: '低阶',
    itemType: '任务道具',
    effectValue: 0
  },
  {
    name: '圣所营养剂',
    description: '圣所用于恢复体能的标准补给，温和且稳定。',
    locationTag: 'sanctuary',
    price: 150,
    faction: '圣所',
    tier: '低阶',
    itemType: '回复道具',
    effectValue: 25
  },
  {
    name: '西市旧零件箱',
    description: '西市常见的杂货箱，常被炼金派拿去拆解。',
    locationTag: 'slums',
    price: 180,
    faction: '西市',
    tier: '低阶',
    itemType: '任务道具',
    effectValue: 0
  },
  {
    name: '东市名流请柬',
    description: '东市上流会客区的入场请柬，收藏价值较高。',
    locationTag: 'rich_area',
    price: 520,
    faction: '东市',
    tier: '中阶',
    itemType: '贵重物品',
    effectValue: 220
  },
  {
    name: '军队标准急救包',
    description: '军队战地急救包，紧急情况下可稳定生命。',
    locationTag: 'army',
    price: 260,
    faction: '军队',
    tier: '中阶',
    itemType: '回复道具',
    effectValue: 45
  },
  {
    name: '观察者密卷残页',
    description: '记载旧时代异象的残卷，可在研究机构高价交易。',
    locationTag: 'observers',
    price: 640,
    faction: '观察者',
    tier: '高阶',
    itemType: '贵重物品',
    effectValue: 280
  }
] as const;

const DEFAULT_SKILLS = [
  { name: '基础格斗', faction: '物理系', tier: '低阶', description: '提升近战命中与基础爆发。', npcId: null },
  { name: '微光火花', faction: '元素系', tier: '低阶', description: '点燃小范围火花造成灼烧。', npcId: null },
  { name: '心念冲击', faction: '精神系', tier: '中阶', description: '对目标精神造成短时冲击。', npcId: null },
  { name: '回声感知', faction: '感知系', tier: '低阶', description: '短时提升周边感知范围。', npcId: null },
  { name: '频段解析', faction: '信息系', tier: '中阶', description: '解析目标行为并提高侦测效率。', npcId: null },
  { name: '基础治愈术', faction: '治疗系', tier: '低阶', description: '小幅恢复生命并降低流血风险。', npcId: null },
  { name: '肌能强化', faction: '强化系', tier: '中阶', description: '短时提升体能与承伤能力。', npcId: null },
  { name: '简式炼成', faction: '炼金系', tier: '中阶', description: '将低阶材料炼成为可用道具。', npcId: null },
  { name: '圣所安抚', faction: '圣所', tier: '低阶', description: '安抚目标情绪并略微回复状态。', npcId: null },
  { name: '禁制伪装', faction: '恶魔会', tier: '高阶', description: '短时伪装身份气息并获得潜行优势。', npcId: null },
  { name: '通用应急处理', faction: '普通人', tier: '低阶', description: '普通人也能掌握的基础应急技巧。', npcId: null },
  { name: '跨派调和', faction: '通用', tier: '高阶', description: '降低跨派技能排斥，提升兼容性。', npcId: null }
] as const;

export function applyDefaultCatalogSeed(db: AppDatabase) {
  const insertItem = db.prepare(`
    INSERT INTO items(name, description, locationTag, npcId, price, faction, tier, itemType, effectValue)
    VALUES (?, ?, ?, NULL, ?, ?, ?, ?, ?)
  `);
  const findItem = db.prepare(`SELECT id FROM items WHERE name = ? AND locationTag = ? LIMIT 1`);

  const defaultItems = [...GUILD_DEFAULT_ITEMS, ...DEMON_CONTRABAND_DEFAULT_ITEMS, ...WORLD_DEFAULT_ITEMS];
  for (const it of defaultItems) {
    const exists = findItem.get(it.name, it.locationTag) as { id?: number } | undefined;
    if (exists?.id) continue;
    insertItem.run(
      it.name,
      it.description,
      it.locationTag,
      it.price,
      it.faction,
      it.tier,
      it.itemType,
      it.effectValue
    );
  }

  const insertSkill = db.prepare(`
    INSERT INTO skills(name, faction, tier, description, npcId)
    VALUES (?, ?, ?, ?, ?)
  `);
  const findSkill = db.prepare(`SELECT id FROM skills WHERE name = ? LIMIT 1`);
  for (const s of DEFAULT_SKILLS) {
    const exists = findSkill.get(s.name) as { id?: number } | undefined;
    if (exists?.id) continue;
    insertSkill.run(s.name, s.faction, s.tier, s.description, s.npcId ?? null);
  }
}

export function runSeed(db: AppDatabase) {
  db.prepare(`
    INSERT OR IGNORE INTO admin_whitelist (name, code_name, enabled)
    VALUES ('塔', 'tower_admin', 1)
  `).run();

  applyDefaultCatalogSeed(db);
}

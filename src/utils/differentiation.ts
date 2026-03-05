export interface DifferentiationData {
  role: string;
  mentalRank: string;
  physicalRank: string;
  gold: number;
  ability: string;
  spirit: {
    name: string;
    type: string;
  };
}

export const ROLE_SENTINEL = '哨兵';
export const ROLE_GUIDE = '向导';
export const ROLE_HUMAN = '普通人';
export const ROLE_GHOST = '鬼魂';
export const ROLE_UNDIFF = '未分化';
export const NONE = '无';
export const UNAWAKENED = '未觉醒';
export const MAX_DIFFERENTIATION_DRAWS = 10;

const ROLE_WEIGHTS = [
  { name: ROLE_SENTINEL, w: 40 },
  { name: ROLE_GUIDE, w: 40 },
  { name: ROLE_HUMAN, w: 10 },
  { name: ROLE_GHOST, w: 10 }
];

const RANK_WEIGHTS = [
  { name: 'D', w: 24.5 },
  { name: 'C', w: 24.5 },
  { name: 'B', w: 24.5 },
  { name: 'A', w: 24.5 },
  { name: 'S', w: 1.2 },
  { name: 'SS', w: 0.6 },
  { name: 'SSS', w: 0.2 }
];

const ABILITIES = [
  '物理',
  '元素',
  '精神',
  '感知',
  '信息',
  '治疗',
  '强化',
  '炼金'
];

const SPIRIT_ANIMALS = ['狼', '猎鹰', '黑豹', '白狐', '虎', '渡鸦'];
const SPIRIT_PLANTS = ['玫瑰', '百合', '鸢尾', '莲花', '山茶', '紫藤'];

function weightedPick<T extends { name: string; w: number }>(items: T[]) {
  const total = items.reduce((s, x) => s + x.w, 0);
  let r = Math.random() * total;
  for (const it of items) {
    r -= it.w;
    if (r <= 0) return it.name;
  }
  return items[items.length - 1].name;
}

function pickFrom(items: string[]) {
  return items[Math.floor(Math.random() * items.length)];
}

export function randomGold() {
  return Math.random() < 0.1
    ? Math.floor(Math.random() * (10000 - 8000 + 1)) + 8000
    : Math.floor(Math.random() * (7999 - 100 + 1)) + 100;
}

export function buildUndifferentiatedData(): DifferentiationData {
  return {
    role: ROLE_UNDIFF,
    mentalRank: NONE,
    physicalRank: NONE,
    gold: randomGold(),
    ability: UNAWAKENED,
    spirit: { name: NONE, type: NONE }
  };
}

export function generateDifferentiationData(): DifferentiationData {
  const role = weightedPick(ROLE_WEIGHTS);

  let mentalRank = NONE;
  let physicalRank = NONE;
  let spirit = { name: NONE, type: NONE };

  if (role === ROLE_SENTINEL || role === ROLE_GUIDE) {
    mentalRank = weightedPick(RANK_WEIGHTS);
    physicalRank = weightedPick(RANK_WEIGHTS);
    const isPlant = Math.random() < 0.12;
    spirit = isPlant
      ? { name: pickFrom(SPIRIT_PLANTS), type: '植物' }
      : { name: pickFrom(SPIRIT_ANIMALS), type: '动物' };
  } else if (role === ROLE_HUMAN) {
    physicalRank = weightedPick(RANK_WEIGHTS);
  } else if (role === ROLE_GHOST) {
    mentalRank = weightedPick(RANK_WEIGHTS);
  }

  return {
    role,
    mentalRank,
    physicalRank,
    gold: randomGold(),
    ability: pickFrom(ABILITIES),
    spirit
  };
}

export function isSentinelOrGuide(role: string) {
  const v = String(role || '').trim();
  return v === ROLE_SENTINEL || v === ROLE_GUIDE;
}

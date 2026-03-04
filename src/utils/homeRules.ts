export const HOME_SANCTUARY = 'sanctuary';
export const HOME_RICH_AREA = 'rich_area';
export const HOME_SLUMS = 'slums';

export const ADULT_AGE = 16;
export const DEFAULT_MINOR_AGE = 15;

export function isMinor(age: number) {
  return Number(age) < ADULT_AGE;
}

/** 未分化初始年龄强制 <16；未传则给默认 15 */
export function resolveInitialAge(inputAge?: number, isUndifferentiated?: boolean) {
  const n = Number(inputAge);
  if (isUndifferentiated) {
    if (!Number.isFinite(n)) return DEFAULT_MINOR_AGE;
    return Math.min(n, ADULT_AGE - 1); // 最大 15
  }
  if (!Number.isFinite(n)) return ADULT_AGE;
  return n;
}

/**
 * 初始家园规则（前后端统一）：
 * - 未满16：sanctuary
 * - 满16：金币 >= 10000 -> rich_area，否则 slums
 */
export function resolveInitialHome(age: number, gold: number) {
  if (isMinor(age)) return HOME_SANCTUARY;
  return Number(gold) >= 10000 ? HOME_RICH_AREA : HOME_SLUMS;
}

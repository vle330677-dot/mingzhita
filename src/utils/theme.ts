export type UiThemePresetId =
  | 'holy_glass'
  | 'crystal_glass'
  | 'pink_sweet'
  | 'cyber_blue'
  | 'wasteland_brown'
  | 'ice_fairy'
  | 'apple_sweet'
  | 'cafe_parchment'
  | 'botanical_green'
  | 'lavender_poem';

export interface UiThemePreset {
  id: UiThemePresetId;
  name: string;
  desc: string;
}

export const UI_THEME_STORAGE_KEY = 'ui_theme_preset_v1';
export const UI_BG_STORAGE_KEY = 'ui_theme_bg_url_v1';
export const UI_CUSTOM_CSS_STORAGE_KEY = 'ui_theme_custom_css_v1';
export const UI_TEXT_COLOR_STORAGE_KEY = 'ui_theme_text_color_v1';
export const DEFAULT_UI_THEME: UiThemePresetId = 'holy_glass';
const CUSTOM_STYLE_TAG_ID = 'user-custom-ui-theme-style';

export const UI_THEME_PRESETS: UiThemePreset[] = [
  {
    id: 'holy_glass',
    name: '圣洁白雾',
    desc: '默认：白色半透明，神秘圣洁氛围'
  },
  {
    id: 'crystal_glass',
    name: '透明玻璃',
    desc: '高透玻璃 + 冷调高光，现代感更强'
  },
  {
    id: 'pink_sweet',
    name: '粉色少女',
    desc: '柔和粉雾与暖色边框，甜美清透'
  },
  {
    id: 'cyber_blue',
    name: '深蓝赛博',
    desc: '霓虹蓝科技质感，层次对比更强'
  },
  {
    id: 'wasteland_brown',
    name: '废土棕褐',
    desc: '黄沙与锈褐质感，末世工业风格'
  },
  {
    id: 'ice_fairy',
    name: '冰蓝精灵',
    desc: '冰雪系淡蓝白，晶莹剔透少女感'
  },
  {
    id: 'apple_sweet',
    name: '苹果甜心',
    desc: '暖粉红苹果格纹，甜蜜可爱风格'
  },
  {
    id: 'cafe_parchment',
    name: '温暖咖啡馆',
    desc: '羊皮纸米棕，温馨复古书卷气'
  },
  {
    id: 'botanical_green',
    name: '翠绿药草',
    desc: '植物系淡绿薄荷，自然清新疗愈'
  },
  {
    id: 'lavender_poem',
    name: '薰衣草诗境',
    desc: '薰衣紫水墨，古典东方诗意飘渺'
  }
];

const VALID_THEME_SET = new Set<UiThemePresetId>(UI_THEME_PRESETS.map((x) => x.id));

function sanitizeThemeId(raw: string): UiThemePresetId {
  const next = String(raw || '').trim() as UiThemePresetId;
  return VALID_THEME_SET.has(next) ? next : DEFAULT_UI_THEME;
}

function styleTag(): HTMLStyleElement {
  let tag = document.getElementById(CUSTOM_STYLE_TAG_ID) as HTMLStyleElement | null;
  if (!tag) {
    tag = document.createElement('style');
    tag.id = CUSTOM_STYLE_TAG_ID;
    document.head.appendChild(tag);
  }
  return tag;
}

export function getUiThemePreset(): UiThemePresetId {
  return sanitizeThemeId(localStorage.getItem(UI_THEME_STORAGE_KEY) || DEFAULT_UI_THEME);
}

export function getUiBackgroundUrl(): string {
  return String(localStorage.getItem(UI_BG_STORAGE_KEY) || '').trim();
}

export function getUiCustomCss(): string {
  return String(localStorage.getItem(UI_CUSTOM_CSS_STORAGE_KEY) || '');
}

function normalizeHexColor(raw: string): string {
  const src = String(raw || '').trim().toLowerCase();
  if (!src) return '';
  const base = src.startsWith('#') ? src.slice(1) : src;
  if (/^[0-9a-f]{3}$/.test(base)) {
    return `#${base.split('').map((ch) => `${ch}${ch}`).join('')}`;
  }
  if (/^[0-9a-f]{6}$/.test(base)) {
    return `#${base}`;
  }
  return '';
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const src = normalizeHexColor(hex);
  if (!src) return null;
  return {
    r: parseInt(src.slice(1, 3), 16),
    g: parseInt(src.slice(3, 5), 16),
    b: parseInt(src.slice(5, 7), 16)
  };
}

function deriveSecondaryTextColor(primaryHex: string): string {
  const rgb = hexToRgb(primaryHex);
  if (!rgb) return '';
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.76)`;
}

export function getUiTextColor(): string {
  return normalizeHexColor(localStorage.getItem(UI_TEXT_COLOR_STORAGE_KEY) || '');
}

export function applyUiThemePreset(themeId: UiThemePresetId) {
  const next = sanitizeThemeId(themeId);
  document.documentElement.setAttribute('data-ui-theme', next);
}

export function setUiThemePreset(themeId: UiThemePresetId) {
  const next = sanitizeThemeId(themeId);
  localStorage.setItem(UI_THEME_STORAGE_KEY, next);
  applyUiThemePreset(next);
}

export function applyUiBackgroundUrl(rawUrl: string) {
  const url = String(rawUrl || '').trim();
  if (!url) {
    document.documentElement.style.setProperty('--user-bg-image', 'none');
    return;
  }
  const safe = url.replace(/"/g, '\\"');
  document.documentElement.style.setProperty('--user-bg-image', `url("${safe}")`);
}

export function setUiBackgroundUrl(rawUrl: string) {
  const url = String(rawUrl || '').trim();
  if (!url) {
    localStorage.removeItem(UI_BG_STORAGE_KEY);
  } else {
    localStorage.setItem(UI_BG_STORAGE_KEY, url);
  }
  applyUiBackgroundUrl(url);
}

export function clearUiBackgroundUrl() {
  localStorage.removeItem(UI_BG_STORAGE_KEY);
  applyUiBackgroundUrl('');
}

export function applyUiCustomCss(cssText: string) {
  styleTag().textContent = String(cssText || '');
}

export function applyUiTextColor(rawColor: string) {
  const color = normalizeHexColor(rawColor);
  if (!color) {
    document.documentElement.style.removeProperty('--ui-text-primary');
    document.documentElement.style.removeProperty('--ui-text-secondary');
    return;
  }
  document.documentElement.style.setProperty('--ui-text-primary', color);
  document.documentElement.style.setProperty('--ui-text-secondary', deriveSecondaryTextColor(color));
}

export function setUiCustomCss(cssText: string) {
  const next = String(cssText || '');
  if (!next.trim()) {
    localStorage.removeItem(UI_CUSTOM_CSS_STORAGE_KEY);
  } else {
    localStorage.setItem(UI_CUSTOM_CSS_STORAGE_KEY, next);
  }
  applyUiCustomCss(next);
}

export function clearUiCustomCss() {
  localStorage.removeItem(UI_CUSTOM_CSS_STORAGE_KEY);
  applyUiCustomCss('');
}

export function setUiTextColor(rawColor: string) {
  const color = normalizeHexColor(rawColor);
  if (!color) {
    localStorage.removeItem(UI_TEXT_COLOR_STORAGE_KEY);
  } else {
    localStorage.setItem(UI_TEXT_COLOR_STORAGE_KEY, color);
  }
  applyUiTextColor(color);
}

export function clearUiTextColor() {
  localStorage.removeItem(UI_TEXT_COLOR_STORAGE_KEY);
  applyUiTextColor('');
}

export function hydrateUiTheme() {
  applyUiThemePreset(getUiThemePreset());
  applyUiBackgroundUrl(getUiBackgroundUrl());
  applyUiCustomCss(getUiCustomCss());
  applyUiTextColor(getUiTextColor());
}

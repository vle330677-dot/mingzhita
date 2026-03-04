export type UiThemePresetId =
  | 'holy_glass'
  | 'crystal_glass'
  | 'pink_sweet'
  | 'cyber_blue'
  | 'wasteland_brown';

export interface UiThemePreset {
  id: UiThemePresetId;
  name: string;
  desc: string;
}

export const UI_THEME_STORAGE_KEY = 'ui_theme_preset_v1';
export const UI_BG_STORAGE_KEY = 'ui_theme_bg_url_v1';
export const UI_CUSTOM_CSS_STORAGE_KEY = 'ui_theme_custom_css_v1';
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

export function hydrateUiTheme() {
  applyUiThemePreset(getUiThemePreset());
  applyUiBackgroundUrl(getUiBackgroundUrl());
  applyUiCustomCss(getUiCustomCss());
}

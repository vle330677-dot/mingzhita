import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, MapPin, Settings, Skull, Cross, Send, Trash2, Heart, ArrowLeft, Users, Gamepad2, UserRound, Palette, ImagePlus, Upload, RotateCcw, Minimize2, Maximize2 } from 'lucide-react';
import { User } from '../types';

// ================== 组件导入 ==================
import { PlayerInteractionUI } from './PlayerInteractionUI';
import { NpcInteractionUI } from './NpcInteractionUI';
import { CharacterHUD } from './CharacterHUD';
import { RoleplayWindow } from './RoleplayWindow';
import { GroupRoleplayWindow } from './GroupRoleplayWindow';
import { TradeWindow } from './TradeWindow';
import { TradeRequestPanel, TradeRequestRow } from './TradeRequestPanel';

import { TowerOfLifeView } from './TowerOfLifeView';
import { LondonTowerView } from './LondonTowerView';
import { SanctuaryView } from './SanctuaryView';
import { GuildView } from './GuildView';
import { ArmyView } from './ArmyView';
import { SlumsView } from './SlumsView';
import { RichAreaView } from './RichAreaView';
import { DemonSocietyView } from './DemonSocietyView';
import { SpiritBureauView } from './SpiritBureauView';
import { ObserverView } from './ObserverView';
import { TowerGuardView } from './TowerGuardView';
import { WildHuntView } from './WildHuntView';
import CustomFactionView from './CustomFactionView';

// ===== 新增：灾厄游戏 =====
import CustomGameRunView from './CustomGameRunView';

import { GlobalAnnouncementPrompt } from './GlobalAnnouncementPrompt';
import { APP_REALTIME_EVENT } from '../utils/realtime';
import {
  UI_THEME_PRESETS,
  DEFAULT_UI_THEME,
  getUiBackgroundUrl,
  getUiCustomCss,
  getUiTextColor,
  getUiThemePreset,
  setUiBackgroundUrl,
  setUiCustomCss,
  setUiTextColor,
  setUiThemePreset,
  clearUiBackgroundUrl,
  clearUiCustomCss,
  clearUiTextColor
} from '../utils/theme';

// ================== 资源映射配置 ==================
const LOCATION_BG_MAP: Record<string, string> = {
  tower_of_life: '/命之塔.jpg',
  london_tower: '/伦敦塔.jpg',
  sanctuary: '/圣所.jpg',
  guild: '/公会.jpg',
  army: '/军队.jpg',
  rich_area: '/东市.jpg',
  slums: '/西市.jpg',
  demon_society: '/恶魔会.jpg',
  paranormal_office: '/灵异管理所.jpg',
  observers: '/观察者.jpg',
  tower_guard: '/守塔会.jpg'
};

// ================== 地图坐标配置 ==================
// 电脑端坐标（16:9 横屏 map_background.jpg）
const LOCATIONS = [
  { id: 'tower_of_life',    name: '命之塔',    x: 42, y: 50, type: 'safe', description: '世界的绝对中心，神明降下神谕的圣地。' },
  { id: 'sanctuary',        name: '圣所',      x: 34, y: 44, type: 'safe', description: '未分化幼崽的摇篮，充满治愈与宁静的气息。' },
  { id: 'london_tower',     name: '伦敦塔',    x: 72, y: 44, type: 'safe', description: '哨兵与向导的最高学府与管理机构。' },
  { id: 'rich_area',        name: '富人区',    x: 70, y: 57, type: 'safe', description: '流光溢彩的销金窟，权贵们在此挥霍财富。' },
  { id: 'slums',            name: '贫民区',    x: 17, y: 43, type: 'safe', description: '混乱、肮脏，但充满生机。' },
  { id: 'demon_society',    name: '恶魔会',    x:  8, y: 52, type: 'safe', description: '混乱之王的狂欢所。(未知区域)' },
  { id: 'guild',            name: '工会',      x: 44, y: 71, type: 'safe', description: '鱼龙混杂的地下交易网与冒险者聚集地。' },
  { id: 'army',             name: '军队',      x: 40, y: 19, type: 'safe', description: '人类最坚实的物理防线。' },
  { id: 'tower_guard',      name: '守塔会',    x: 57, y: 33, type: 'safe', description: '教堂秩序维护组织，可进行冥想与赎罪。' },
  { id: 'observers',        name: '观察者',    x: 68, y: 13, type: 'safe', description: '记录世界历史与真相的隐秘结社。' },
  { id: 'paranormal_office',name: '灵异管理所',x: 27, y: 64, type: 'safe', description: '专门处理非自然精神波动的神秘机关。' }
];

// 手机端坐标（9:16 竖屏 map_background-s.png）
const MOBILE_MAP_COORDS: Record<string, { x: number; y: number }> = {
  tower_of_life:     { x: 46, y: 51 },
  sanctuary:         { x: 37, y: 46 },
  london_tower:      { x: 76, y: 39 },
  rich_area:         { x: 73, y: 53 },
  slums:             { x: 17, y: 44 },
  demon_society:     { x:  9, y: 57 },
  guild:             { x: 47, y: 74 },
  army:              { x: 46, y: 22 },
  tower_guard:       { x: 57, y: 42 },
  observers:         { x: 72, y: 19 },
  paranormal_office: { x: 18, y: 66 }
};

const MOBILE_PORTRAIT_QUERY = '(max-width: 767px) and (orientation: portrait)';

const SAFE_ZONES = ['tower_of_life', 'sanctuary', 'london_tower', 'tower_guard'];
const TOWER_ADJACENT_LOCATIONS = new Set(['sanctuary', 'london_tower', 'slums', 'rich_area', 'guild', 'army']);
const isDocumentHidden = () => typeof document !== 'undefined' && document.hidden;

interface Props {
  user: User;
  onLogout: () => void;
  showToast: (msg: string) => void;
  fetchGlobalData: () => void;
}

interface PrisonStateSummary {
  isImprisoned: boolean;
  failedAttempts: number;
  difficultyLevel: number;
  currentGameId: string;
  currentGameName: string;
  jailedAt: string;
  updatedAt: string;
}

interface GuardPrisonStateSummary {
  isImprisoned: boolean;
  arrestCaseId: number;
  captorUserId: number;
  captorName: string;
  jailedAt: string;
  releasedAt: string;
  updatedAt: string;
}

interface GuardArrestCaseSummary {
  id: number;
  applicantUserId: number;
  applicantName: string;
  targetUserId: number;
  targetName: string;
  status: string;
  cancelStatus: string;
  updatedAt: string;
  resultMessage?: string;
}

interface PairRoleplaySessionSummary {
  sessionId: string;
  userAId: number;
  userAName: string;
  userBId: number;
  userBName: string;
  locationId: string;
  locationName: string;
  status: 'active' | 'closed' | 'mediating';
  createdAt: string | null;
  updatedAt: string | null;
  lastMessageAt?: string | null;
  memberCount?: number;
}

function hashNum(input: string | number) {
  const s = String(input);
  let h = 0;
  for (let i = 0; i < s.length; i++) h = s.charCodeAt(i) + ((h << 5) - h);
  return Math.abs(h);
}

function buildPairSessionId(a: number, b: number, locationId: string) {
  const min = Math.min(a, b);
  const max = Math.max(a, b);
  return `rp-${locationId || 'unknown'}-${min}-${max}-${Date.now()}`;
}

function normalizeRoleplaySessionSummary(raw: any): PairRoleplaySessionSummary | null {
  const sessionId = String(raw?.sessionId || '').trim();
  if (!sessionId) return null;
  return {
    sessionId,
    userAId: Number(raw?.userAId || 0),
    userAName: String(raw?.userAName || ''),
    userBId: Number(raw?.userBId || 0),
    userBName: String(raw?.userBName || ''),
    locationId: String(raw?.locationId || 'unknown'),
    locationName: String(raw?.locationName || '未知区域'),
    status: String(raw?.status || 'active') as PairRoleplaySessionSummary['status'],
    createdAt: raw?.createdAt ? String(raw.createdAt) : null,
    updatedAt: raw?.updatedAt ? String(raw.updatedAt) : null,
    lastMessageAt: raw?.lastMessageAt ? String(raw.lastMessageAt) : null,
    memberCount: Number(raw?.memberCount || 0),
  };
}

function getRPPeerName(session: PairRoleplaySessionSummary | null | undefined, currentUserId: number) {
  if (!session) return '';
  return Number(session.userAId || 0) === Number(currentUserId || 0)
    ? String(session.userBName || '')
    : String(session.userAName || '');
}

function sortRoleplaySessions(sessions: PairRoleplaySessionSummary[]) {
  return [...sessions].sort((a, b) => {
    const aTime = Date.parse(String(a.lastMessageAt || a.updatedAt || a.createdAt || '')) || 0;
    const bTime = Date.parse(String(b.lastMessageAt || b.updatedAt || b.createdAt || '')) || 0;
    if (aTime !== bTime) return bTime - aTime;
    return String(b.sessionId || '').localeCompare(String(a.sessionId || ''));
  });
}

// ✅ 统一头像地址解析 + 版本戳
function resolveAvatarSrc(raw: any, updatedAt?: any) {
  if (!raw || typeof raw !== 'string') return '';
  const s = raw.trim();
  if (!s) return '';

  let base = s;
  if (!/^data:image\//.test(s) && !/^https?:\/\//.test(s) && !s.startsWith('/')) {
    base = `/${s.replace(/^\.?\//, '')}`;
  }

  if (/^data:image\//.test(base)) return base;

  const v = updatedAt ? encodeURIComponent(String(updatedAt)) : '';
  if (!v) return base;
  return base.includes('?') ? `${base}&v=${v}` : `${base}?v=${v}`;
}

function getTowerPurifyRate(jobRaw: any) {
  const job = String(jobRaw || '').trim();
  if (!job) return 0;
  if (job.includes('圣子') || job.includes('圣女')) return 1;
  if (job.includes('候选')) return 0.6;
  if (job.includes('侍奉')) return 0.3;
  if (job.includes('仆从')) return 0.05;
  return 0;
}

function isTowerGuardJob(jobRaw: any) {
  const job = String(jobRaw || '').trim();
  return job === '守塔会成员' || job === '守塔会会长';
}

function isPlayerImprisoned(player: any) {
  return (
    Number(player?.towerGuardImprisoned || 0) === 1 ||
    Number(player?.paranormalImprisoned || 0) === 1
  );
}

export function GameView({ user, onLogout, showToast, fetchGlobalData }: Props) {
  const [selectedLocation, setSelectedLocation] = useState<any>(null);
  const [activeView, setActiveView] = useState<string | null>(null);

  const [localPlayers, setLocalPlayers] = useState<any[]>([]);
  const [worldPresence, setWorldPresence] = useState<any[]>([]);
  const [showPlayersPanel, setShowPlayersPanel] = useState(true);
  const [annQueue, setAnnQueue] = useState<any[]>([]);
  const [activeAnn, setActiveAnn] = useState<any | null>(null);
  const [lastSeenAnnId, setLastSeenAnnId] = useState<number>(() => {
    const k = `ann_last_seen_${user.id}`;
    return Number(localStorage.getItem(k) || 0);
  });

  const [interactTarget, setInteractTarget] = useState<any>(null);
  const [worldNpcs, setWorldNpcs] = useState<any[]>([]);
  const [interactNpc, setInteractNpc] = useState<any>(null);
  const [activeTradeSessionId, setActiveTradeSessionId] = useState<string | null>(null);
  const [pendingTradeRequests, setPendingTradeRequests] = useState<TradeRequestRow[]>([]);
  const [respondingTradeRequestId, setRespondingTradeRequestId] = useState<number | null>(null);
  const [showNpcPanel, setShowNpcPanel] = useState(true);
  const [showAreaPanel, setShowAreaPanel] = useState(true);
  const [desktopContextCollapsed, setDesktopContextCollapsed] = useState(true);
  const [mobileContextCollapsed, setMobileContextCollapsed] = useState(true);


  // ===== RP 状态 =====
  const [rpSessions, setRPSessions] = useState<PairRoleplaySessionSummary[]>([]);
  const [rpSessionId, setRPSessionId] = useState<string | null>(null);
  const [rpWindowOpen, setRPWindowOpen] = useState(false);
  const [rpNearbyHint, setRPNearbyHint] = useState('');
  const [rpPing, setRPPing] = useState(false);
  const [isCreatingRP, setIsCreatingRP] = useState(false);
  const [groupRPWindowOpen, setGroupRPWindowOpen] = useState(false);
  const [groupRPJoinedLocationId, setGroupRPJoinedLocationId] = useState<string | null>(null);
  const [groupRPJoinedLocationName, setGroupRPJoinedLocationName] = useState('');

  // ===== 灾厄游戏状态（新增）=====
  const [activeCustomGameId, setActiveCustomGameId] = useState<number | null>(null);
  const [customFactions, setCustomFactions] = useState<any[]>([]);
  const [customFactionAssets, setCustomFactionAssets] = useState<any[]>([]);
  const [createFactionMode, setCreateFactionMode] = useState(false);
  const [pendingFactionPoint, setPendingFactionPoint] = useState<{ x: number; y: number } | null>(null);
  const [creatingFaction, setCreatingFaction] = useState(false);
  const [customFactionForm, setCustomFactionForm] = useState({ name: '', description: '', mapImageUrl: '' });

  const [showSettings, setShowSettings] = useState(false);
  const [uiThemePreset, setUiThemePresetState] = useState<string>(() => getUiThemePreset());
  const [bgImageInput, setBgImageInput] = useState<string>(() => getUiBackgroundUrl());
  const [customTextColor, setCustomTextColorState] = useState<string>(() => getUiTextColor());
  const [customCssText, setCustomCssTextState] = useState<string>(() => getUiCustomCss());
  const [showDeathForm, setShowDeathForm] = useState<'death' | 'ghost' | null>(null);
  const [deathText, setDeathText] = useState('');
  const handledSkipRequestIdsRef = useRef<Set<number>>(new Set());
  const handledPartyRequestIdsRef = useRef<Set<number>>(new Set());
  const handledMediationInviteIdsRef = useRef<Set<number>>(new Set());
  const handledEntanglementPromptSignaturesRef = useRef<Set<string>>(new Set());
  const handledLondonCompatPromptUserIdsRef = useRef<Set<number>>(new Set());
  const interactionEventCursorRef = useRef<number>(0);
  const knownRPSessionIdsRef = useRef<Set<string>>(new Set());
  const rpSessionListReadyRef = useRef(false);
  const dismissedTradeSessionIdRef = useRef<string>('');
  const backgroundFileRef = useRef<HTMLInputElement | null>(null);
  const customCssFileRef = useRef<HTMLInputElement | null>(null);

  const [isDying, setIsDying] = useState(false);
  const [rescueReqId, setRescueReqId] = useState<number | null>(null);
  const prevJobRef = useRef<string>(String(user?.job || '无'));

  // 职位挑战投票浮层
  const [activeChallenges, setActiveChallenges] = useState<any[]>([]);

  const [showGraveyard, setShowGraveyard] = useState(false);
  const [tombstones, setTombstones] = useState<any[]>([]);
  const [expandedTombstone, setExpandedTombstone] = useState<number | null>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');

  const [showWildExplore, setShowWildExplore] = useState(false);
  const [prisonState, setPrisonState] = useState<PrisonStateSummary | null>(null);
  const [guardPrisonState, setGuardPrisonState] = useState<GuardPrisonStateSummary | null>(null);
  const [guardArrestPendingCase, setGuardArrestPendingCase] = useState<GuardArrestCaseSummary | null>(null);
  const handledGuardArrestAlertsRef = useRef<Set<string>>(new Set());
  const [isPortraitMobile, setIsPortraitMobile] = useState(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
    return window.matchMedia(MOBILE_PORTRAIT_QUERY).matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const media = window.matchMedia(MOBILE_PORTRAIT_QUERY);
    const onChange = (e: MediaQueryListEvent) => setIsPortraitMobile(e.matches);
    setIsPortraitMobile(media.matches);
    if (typeof media.addEventListener === 'function') {
      media.addEventListener('change', onChange);
      return () => media.removeEventListener('change', onChange);
    }
    media.addListener(onChange);
    return () => media.removeListener(onChange);
  }, []);

  const customBackgroundImage = useMemo(() => String(bgImageInput || '').trim(), [bgImageInput]);
  const globalMapBackground = customBackgroundImage || (isPortraitMobile ? '/map_background-s.png' : '/map_background.jpg');
  const currentBackgroundImage = useMemo(() => {
    if (customBackgroundImage) return customBackgroundImage;
    const customView = Array.isArray(customFactions) ? customFactions.find((row) => String(row?.id || '') === String(activeView || '')) : null;
    if (activeView && String(customView?.mapImageUrl || '').trim()) return String(customView.mapImageUrl || '').trim();
    if (activeView && LOCATION_BG_MAP[activeView]) return LOCATION_BG_MAP[activeView];
    return '/map_background.jpg';
  }, [activeView, customBackgroundImage, customFactions]);
  const mapLocations = useMemo(() => {
    const baseLocations = !isPortraitMobile
      ? LOCATIONS
      : LOCATIONS.map((loc) => {
          const p = MOBILE_MAP_COORDS[String(loc.id)];
          return p ? { ...loc, x: p.x, y: p.y } : loc;
        });

    const extraLocations = (Array.isArray(customFactions) ? customFactions : []).map((row) => ({
      id: String(row?.id || ''),
      name: String(row?.name || '自定义势力'),
      x: Number(row?.x || 50),
      y: Number(row?.y || 50),
      type: String(row?.type || 'safe'),
      description: String(row?.description || '玩家自建势力入口。'),
      mapImageUrl: String(row?.mapImageUrl || ''),
      isCustomFaction: true,
      ownerName: String(row?.ownerName || ''),
      leaderTitle: String(row?.leaderTitle || '掌权者'),
    }));

    return [...baseLocations, ...extraLocations];
  }, [customFactions, isPortraitMobile]);

  const isSafeLocationId = (locationId?: string | null) => {
    const match = mapLocations.find((loc) => String(loc.id) === String(locationId || ''));
    if (!match) return SAFE_ZONES.includes(String(locationId || ''));
    return String(match.type || 'safe') === 'safe';
  };

  const [runtimeUser, setRuntimeUser] = useState(user);
  const actor = runtimeUser || user;
  const effectiveLocationId = activeView || actor.currentLocation;
  const worldPresenceByLocation = useMemo(() => {
    const grouped: Record<string, any[]> = {};
    const seenIds = new Set<number>();

    const pushPlayer = (row: any) => {
      const id = Number(row?.id || 0);
      const locationId = String(row?.currentLocation || '');
      if (!id || !locationId || seenIds.has(id)) return;
      seenIds.add(id);
      if (!grouped[locationId]) grouped[locationId] = [];
      grouped[locationId].push(row);
    };

    (Array.isArray(worldPresence) ? worldPresence : []).forEach((row) => {
      const status = String(row?.status || '');
      if (!['approved', 'ghost'].includes(status)) return;
      pushPlayer(row);
    });

    pushPlayer({
      id: actor.id,
      name: actor.name,
      role: actor.role,
      job: actor.job,
      currentLocation: actor.currentLocation,
      status: actor.status,
      avatarUrl: (actor as any).avatarUrl || '',
      avatarUpdatedAt: (actor as any).avatarUpdatedAt || null
    });

    return grouped;
  }, [worldPresence, actor]);

  const onlinePlayerCount = useMemo(() => {
    const ids = new Set<number>();
    (Array.isArray(worldPresence) ? worldPresence : []).forEach((row) => {
      const id = Number(row?.id || 0);
      const status = String(row?.status || '');
      if (id && ['approved', 'ghost'].includes(status)) ids.add(id);
    });
    const actorId = Number(actor?.id || 0);
    if (actorId) ids.add(actorId);
    return ids.size;
  }, [worldPresence, actor?.id]);

  const refreshCustomFactions = async (silent = false) => {
    try {
      const [factionRes, assetRes] = await Promise.all([
        fetch('/api/custom-factions', { cache: 'no-store' }),
        fetch('/api/custom-factions/assets', { cache: 'no-store' }),
      ]);
      const factionData = await factionRes.json().catch(() => ({} as any));
      const assetData = await assetRes.json().catch(() => ({} as any));
      if (!factionRes.ok || factionData.success === false) {
        if (!silent) showToast(factionData.message || '读取自定义势力失败');
        return;
      }
      setCustomFactions(Array.isArray(factionData.factions) ? factionData.factions : []);
      if (assetRes.ok && assetData.success !== false) {
        setCustomFactionAssets(Array.isArray(assetData.assets) ? assetData.assets : []);
      }
    } catch {
      if (!silent) showToast('网络异常，读取自定义势力失败');
    }
  };

  useEffect(() => {
    refreshCustomFactions(true);
    const timer = window.setInterval(() => refreshCustomFactions(true), 15000);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleWorldMapClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!createFactionMode) return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const x = Math.max(4, Math.min(96, ((event.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(4, Math.min(96, ((event.clientY - rect.top) / rect.height) * 100));
    setPendingFactionPoint({ x: Number(x.toFixed(2)), y: Number(y.toFixed(2)) });
  };

  const createCustomFaction = async () => {
    if (!pendingFactionPoint || creatingFaction) return;
    if (!String(customFactionForm.name || '').trim()) {
      showToast('请先填写势力名称');
      return;
    }
    setCreatingFaction(true);
    try {
      const res = await fetch('/api/custom-factions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: actor.id,
          name: String(customFactionForm.name || '').trim(),
          description: String(customFactionForm.description || '').trim(),
          mapImageUrl: String(customFactionForm.mapImageUrl || '').trim(),
          x: pendingFactionPoint.x,
          y: pendingFactionPoint.y,
        }),
      });
      const data = await res.json().catch(() => ({} as any));
      if (!res.ok || data.success === false) {
        showToast(data.message || '创建势力失败');
        return;
      }
      showToast(data.message || '已创建自定义势力');
      setPendingFactionPoint(null);
      setCreateFactionMode(false);
      setCustomFactionForm({ name: '', description: '', mapImageUrl: '' });
      await refreshCustomFactions(true);
      fetchGlobalData();
    } catch {
      showToast('网络异常，创建势力失败');
    } finally {
      setCreatingFaction(false);
    }
  };

  const activeRPSession = useMemo(
    () => rpSessions.find((session) => session.sessionId === rpSessionId) || rpSessions[0] || null,
    [rpSessions, rpSessionId]
  );
  const rpPeerName = useMemo(() => getRPPeerName(activeRPSession, actor.id), [activeRPSession, actor.id]);
  const rpSessionCount = rpSessions.length;

  const upsertRPSession = (sessionLike: any) => {
    const normalized = normalizeRoleplaySessionSummary(sessionLike);
    if (!normalized) return;
    knownRPSessionIdsRef.current.add(normalized.sessionId);
    setRPSessions((prev) => sortRoleplaySessions([...prev.filter((row) => row.sessionId !== normalized.sessionId), normalized]));
    setRPSessionId(normalized.sessionId);
  };

  const applyRPSessionList = (rawSessions: any[], notifyNew = true) => {
    const next = sortRoleplaySessions(
      (Array.isArray(rawSessions) ? rawSessions : [])
        .map((row) => normalizeRoleplaySessionSummary(row))
        .filter(Boolean) as PairRoleplaySessionSummary[]
    );
    const nextIds = new Set(next.map((session) => session.sessionId));

    setRPSessions(next);

    if (next.length === 0) {
      knownRPSessionIdsRef.current = nextIds;
      rpSessionListReadyRef.current = true;
      if (!isCreatingRP) {
        setRPSessionId(null);
        setRPWindowOpen(false);
        setRPPing(false);
      }
      return;
    }

    if (notifyNew && rpSessionListReadyRef.current) {
      const newcomers = next.filter((session) => !knownRPSessionIdsRef.current.has(session.sessionId));
      if (newcomers.length > 0) {
        const peerName = getRPPeerName(newcomers[0], actor.id);
        showToast(`${peerName || '有玩家'} 向你发起了对戏，点击左下角“对戏聊天”查看`);
        if (!rpWindowOpen) setRPPing(true);
      }
    }

    knownRPSessionIdsRef.current = nextIds;
    rpSessionListReadyRef.current = true;
    setRPSessionId((current) => (current && nextIds.has(current) ? current : next[0].sessionId));
  };

  const refreshRPSessionList = async (notifyNew = true) => {
    try {
      const res = await fetch(`/api/rp/session/list/${actor.id}`, { cache: 'no-store' });
      const data = await res.json().catch(() => ({} as any));
      if (!res.ok || data.success === false) return;
      applyRPSessionList(data.sessions || [], notifyNew);
    } catch {
      // ignore
    }
  };

  const refreshLocalPlayers = async () => {
    if (!effectiveLocationId || isDocumentHidden()) {
      if (!effectiveLocationId) setLocalPlayers([]);
      return;
    }
    try {
      const res = await fetch(`/api/locations/${effectiveLocationId}/players?excludeId=${actor.id}`);
      const data = await res.json().catch(() => ({} as any));
      if (!res.ok || data.success === false) return;
      const unique = (data.players || []).filter(
        (player: any, index: number, rows: any[]) => rows.findIndex((item) => item.id === player.id) === index
      );
      setLocalPlayers(unique);
    } catch {
      // ignore
    }
  };

  const refreshWorldPresence = async () => {
    if (isDocumentHidden()) return;
    try {
      const res = await fetch('/api/world/presence', { cache: 'no-store' });
      const data = await res.json().catch(() => ({} as any));
      if (!res.ok || data.success === false) return;
      setWorldPresence(Array.isArray(data.players) ? data.players : []);
    } catch {
      // ignore
    }
  };

  const refreshPendingTradeRequests = async () => {
    if (!actor?.id || isDocumentHidden()) return;
    try {
      const res = await fetch('/api/trade/request/pending/' + actor.id, { cache: 'no-store' });
      const data = await res.json().catch(() => ({} as any));
      if (!res.ok || data.success === false) return;
      setPendingTradeRequests(Array.isArray(data.requests) ? data.requests : []);
    } catch {
      // ignore
    }
  };

  const refreshActiveTradeSession = async () => {
    if (!actor?.id || isDocumentHidden()) return;
    try {
      const res = await fetch('/api/trade/session/active/' + actor.id, { cache: 'no-store' });
      const data = await res.json().catch(() => ({} as any));
      if (!res.ok || data.success === false) return;
      const nextSessionId = data.sessionId ? String(data.sessionId) : '';
      if (!nextSessionId) {
        dismissedTradeSessionIdRef.current = '';
        setActiveTradeSessionId(null);
        return;
      }
      if (dismissedTradeSessionIdRef.current === nextSessionId) return;
      setActiveTradeSessionId(nextSessionId);
    } catch {
      // ignore
    }
  };

  const roleText = String(actor.role || '');
  const isSentinel = roleText === '哨兵' || roleText.toLowerCase() === 'sentinel';
  const isGuide = roleText === '向导' || roleText.toLowerCase() === 'guide';
  const fury = Number(actor.fury ?? 0);
  const guideStability = Number((actor as any).guideStability ?? 100);
  const isFuryLocked = isSentinel && fury >= 80;
  const isStabilityLocked = isGuide && guideStability <= 20;
  const isTreatmentLocked = isFuryLocked || isStabilityLocked;
  const isGhostActor = String(actor.status || '') === 'ghost';
  const isParanormalPrisonLocked = isGhostActor && Boolean(prisonState?.isImprisoned);
  const isTowerGuardPrisonLocked = Boolean(guardPrisonState?.isImprisoned);
  const isAnyPrisonLocked = isParanormalPrisonLocked || isTowerGuardPrisonLocked;
  const towerPurifyRate = getTowerPurifyRate(actor.job);
  const canUseTowerPurify = towerPurifyRate > 0;
  const canUseGuardArrestSkill = isTowerGuardJob(actor.job);
  const showWorldMapOverlayUi = !selectedLocation;
  const resolveLocationName = (locationId: string) =>
    mapLocations.find((l) => String(l.id) === String(locationId || ''))?.name || '未知区域';
  const isGroupRPInCurrentLocation =
    !!groupRPJoinedLocationId && String(groupRPJoinedLocationId) === String(effectiveLocationId || '');


useEffect(() => { setRuntimeUser(user); }, [user]);
useEffect(() => { prevJobRef.current = String(user?.job || '无'); }, [user?.id, user?.job]);

useEffect(() => {
  const currentUserId = Number(actor?.id || 0);
  if (!currentUserId) return;

  const onRealtime = (event: Event) => {
    const detail = (event as CustomEvent<any>).detail || {};
    const eventName = String(detail.event || '');
    const payload = detail.payload || {};

    if (eventName === 'presence.changed' || eventName === 'presence.removed') {
      const changedLocation = String(payload.locationId || payload.currentLocation || '');
      const previousLocation = String(payload.fromLocation || '');
      const currentLocationId = String(effectiveLocationId || '');
      if (currentLocationId && (changedLocation === currentLocationId || previousLocation === currentLocationId)) {
        void refreshLocalPlayers();
      }
      void refreshWorldPresence();
      return;
    }

    if (eventName === 'interaction.event.created') {
      if (Number(payload.userId || 0) !== currentUserId) return;
      const actionType = String(payload.actionType || '');
      if (actionType === 'trade' || actionType === 'trade_request') {
        void refreshPendingTradeRequests();
        void refreshActiveTradeSession();
      }
      return;
    }

    if (eventName === 'trade.session.changed') {
      const userIds = Array.isArray(payload.userIds) ? payload.userIds.map((value: any) => Number(value || 0)) : [];
      if (userIds.length > 0 && !userIds.includes(currentUserId)) return;
      void refreshPendingTradeRequests();
      void refreshActiveTradeSession();
      return;
    }

    if (eventName === 'rp.user.sessions.changed') {
      const userIds = Array.isArray(payload.userIds) ? payload.userIds.map((value: any) => Number(value || 0)) : [];
      if (userIds.length > 0 && !userIds.includes(currentUserId)) return;
      void refreshRPSessionList(true);
      return;
    }

    if (eventName === 'user.updated' && Number(payload.userId || 0) === currentUserId && payload.currentLocation) {
      setRuntimeUser((current) => current ? { ...current, currentLocation: String(payload.currentLocation) } : current);
    }
  };

  window.addEventListener(APP_REALTIME_EVENT, onRealtime as EventListener);
  return () => window.removeEventListener(APP_REALTIME_EVENT, onRealtime as EventListener);
}, [actor?.id, effectiveLocationId]);

useEffect(() => {
  const uid = Number(actor?.id || 0);
  if (!uid) return;
  if (handledLondonCompatPromptUserIdsRef.current.has(uid)) return;

  let alive = true;
  const runPrompt = async () => {
    try {
      const res = await fetch(`/api/london/compat/pool/status?userId=${uid}`, { cache: 'no-store' });
      const data = await res.json().catch(() => ({} as any));
      if (!alive || !res.ok || data.success === false) return;

      if (!Boolean(data.shouldPrompt)) {
        handledLondonCompatPromptUserIdsRef.current.add(uid);
        return;
      }

      handledLondonCompatPromptUserIdsRef.current.add(uid);
      const join = window.confirm(
        '你已满足伦敦塔精神契合度匹配条件。\n选择【确定】加入匹配池。\n选择【取消】我有伴侣，不参与匹配。'
      );

      const saveRes = await fetch('/api/london/compat/pool/decision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: uid, join })
      });
      const saveData = await saveRes.json().catch(() => ({} as any));
      if (!saveRes.ok || saveData.success === false) {
        showToast(saveData.message || '保存匹配选择失败');
        return;
      }
      showToast(
        saveData.message ||
          (join ? '你已加入伦敦塔精神契合度匹配池。' : '你已跳过匹配（我有伴侣）。')
      );
    } catch {
      // ignore
    }
  };

  runPrompt();
  return () => {
    alive = false;
  };
}, [actor?.id, showToast]);

useEffect(() => {
  if (!runtimeUser) return;
  const currentJob = String(runtimeUser.job || '无');
  const prevJob = String(prevJobRef.current || '无');
  if (prevJob !== '无' && currentJob === '无' && prevJob !== currentJob) {
    showToast('您已被逐出阵营');
  }
  prevJobRef.current = currentJob;
}, [runtimeUser, showToast]);

useEffect(() => {
  const hpNum = Number(actor.hp);
  const hpValid = Number.isFinite(hpNum);
  const shouldDie = actor.status === 'approved' && hpValid && hpNum <= 0;
  setIsDying(shouldDie);
}, [actor.hp, actor.status]);

useEffect(() => {
  let alive = true;
  const pull = async () => {
    if (isDocumentHidden()) return;
    try {
      const res = await fetch(`/api/characters/${actor.id}/runtime`, { cache: 'no-store' });
      const data = await res.json();
      if (!alive) return;
      if (res.ok && data.success && data.user) setRuntimeUser(data.user);
    } catch {}
  };
  pull();
  const t = setInterval(pull, 25000);
  return () => { alive = false; clearInterval(t); };
}, [actor.id]);

// 职位挑战轮询：当本人所属阵营有活跃挑战时拉取并展示投票浮层
useEffect(() => {
  if (!actor?.faction || !actor?.id) return;
  let alive = true;
  const poll = async () => {
    if (isDocumentHidden()) return;
    try {
      // 用当前用户职位的阵营推断需要轮询的职位列表（直接拉所有进行中的挑战）
      const res = await fetch(`/api/job/challenge/active?jobName=__all__`, { cache: 'no-store' });
      // 如果 jobName=__all__ 没数据就忽略，仅当所在阵营有人发起时才提示
      const data = await res.json().catch(() => ({} as any));
      if (!alive) return;
      if (data.active && data.challenge) {
        setActiveChallenges((prev) => {
          const id = Number(data.challenge.id || 0);
          if (prev.some((c) => c.id === id)) return prev;
          return [...prev, data.challenge];
        });
      }
    } catch {}
  };
  poll();
  const t = setInterval(poll, 20000);
  return () => { alive = false; clearInterval(t); };
}, [actor?.id, actor?.faction]);

// 鬼魂光环：每 15 秒向服务端发一次 tick，让同区域非鬼魂玩家 MP -2（保底 1）
useEffect(() => {
  if (!isGhostActor) return;
  const tick = () => {
    fetch('/api/ghost/aura/tick', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: actor.id })
    }).catch(() => {});
  };
  tick();
  const t = setInterval(tick, 15000);
  return () => clearInterval(t);
}, [actor.id, isGhostActor]);

useEffect(() => {
  if (!isGhostActor) {
    setPrisonState(null);
    return;
  }

  let alive = true;
  const pullPrisonState = async () => {
    if (isDocumentHidden()) return;
    try {
      const res = await fetch(`/api/paranormal/prison/state?userId=${actor.id}`, { cache: 'no-store' });
      const data = await res.json().catch(() => ({} as any));
      if (!alive || !res.ok || data.success === false) return;
      setPrisonState(data.prison || null);
    } catch {
      // ignore
    }
  };

  pullPrisonState();
  const timer = setInterval(pullPrisonState, 8000);
  return () => {
    alive = false;
    clearInterval(timer);
  };
}, [actor.id, isGhostActor]);

useEffect(() => {
  let alive = true;
  const pullGuardPrisonState = async () => {
    if (isDocumentHidden()) return;
    try {
      const res = await fetch(`/api/tower-guard/prison/state?userId=${actor.id}`, { cache: 'no-store' });
      const data = await res.json().catch(() => ({} as any));
      if (!alive || !res.ok || data.success === false) return;
      setGuardPrisonState(data.prison || null);
    } catch {
      // ignore
    }
  };
  pullGuardPrisonState();
  const timer = setInterval(pullGuardPrisonState, 8000);
  return () => {
    alive = false;
    clearInterval(timer);
  };
}, [actor.id]);

useEffect(() => {
  if (!actor?.id) return;
  let alive = true;

  const pollGuardArrestInbox = async () => {
    if (isDocumentHidden()) return;
    try {
      const res = await fetch(`/api/tower-guard/arrest/inbox?userId=${actor.id}`, { cache: 'no-store' });
      const data = await res.json().catch(() => ({} as any));
      if (!alive || !res.ok || data.success === false) return;

      const incoming = data.incomingPending || null;
      setGuardArrestPendingCase(incoming);

      if (incoming && Number(incoming.targetUserId || 0) === Number(actor.id || 0)) {
        const sign = `incoming:${incoming.id}:${incoming.cancelStatus}:${incoming.updatedAt}`;
        if (!handledGuardArrestAlertsRef.current.has(sign)) {
          handledGuardArrestAlertsRef.current.add(sign);
          if (String(incoming.cancelStatus || '') !== 'pending') {
            window.alert('您被守塔会盯上了。');
            showToast('你被守塔会盯上了，可在左下角提交撤销抓捕申请。');
            if (window.confirm('是否立即向命之塔提交撤销抓捕申请？')) {
              const ok = await submitGuardArrestCancel(Number(incoming.id || 0), true);
              showToast(ok ? '撤销申请已提交至命之塔审批。' : '撤销申请提交失败。');
            }
          }
        }
      }

      const outgoing = Array.isArray(data.outgoingRecent) ? data.outgoingRecent : [];
      for (const row of outgoing) {
        const status = String(row?.status || '');
        const cancelStatus = String(row?.cancelStatus || '');
        const sign = `outgoing:${row?.id}:${status}:${cancelStatus}:${row?.updatedAt || ''}`;
        if (handledGuardArrestAlertsRef.current.has(sign)) continue;
        handledGuardArrestAlertsRef.current.add(sign);

        if (status === 'cancelled' && cancelStatus === 'approved') {
          window.alert('抓捕失败：目标的撤销抓捕申请已被命之塔批准。');
          showToast('抓捕失败：目标撤销申请已通过。');
        } else if (status === 'captured') {
          showToast(`抓捕执行成功：${String(row?.targetName || '目标')} 已押入地下监牢。`);
        } else if (status === 'rejected') {
          showToast(`抓捕申请被驳回：${String(row?.targetName || '目标')}`);
        }
      }
    } catch {
      // ignore
    }
  };

  pollGuardArrestInbox();
  const timer = setInterval(pollGuardArrestInbox, 8000);
  return () => {
    alive = false;
    clearInterval(timer);
  };
}, [actor.id, showToast]);

useEffect(() => {
  if (!isParanormalPrisonLocked) return;
  setShowSettings(false);
  setShowDeathForm(null);
  setShowWildExplore(false);
  if (activeView !== 'paranormal_office') setActiveView('paranormal_office');
  if (selectedLocation) setSelectedLocation(null);
}, [isParanormalPrisonLocked, activeView, selectedLocation]);

useEffect(() => {
  if (!isTowerGuardPrisonLocked) return;
  setShowSettings(false);
  setShowDeathForm(null);
  setShowWildExplore(false);
  if (activeView !== 'tower_guard') setActiveView('tower_guard');
  if (selectedLocation) setSelectedLocation(null);
}, [isTowerGuardPrisonLocked, activeView, selectedLocation]);

useEffect(() => {
    let alive = true;
    

    const pullAnnouncements = async () => {
      if (isDocumentHidden()) return;
      try {
        const res = await fetch(`/api/announcements?sinceId=${lastSeenAnnId}&limit=20`, {
          cache: 'no-store'
        });
        const data = await res.json();
        if (!alive || !data?.success) return;

        const rows = Array.isArray(data.rows) ? data.rows : [];
        if (!rows.length) return;

        setAnnQueue((prev) => {
          const ids = new Set([
            ...prev.map((x: any) => Number(x.id)),
            ...(activeAnn ? [Number(activeAnn.id)] : [])
          ]);
          const incoming = rows.filter((x: any) => !ids.has(Number(x.id)));
          return incoming.length ? [...prev, ...incoming] : prev;
        });
      } catch {
        // ignore
      }
    };

    pullAnnouncements();
    const t = setInterval(pullAnnouncements, 8000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [lastSeenAnnId, activeAnn]);
  useEffect(() => {
    if (!activeAnn && annQueue.length > 0) {
      setActiveAnn(annQueue[0]);
      setAnnQueue((q) => q.slice(1));
    }
  }, [annQueue, activeAnn]);


  useEffect(() => {
    if (!isDying || !rescueReqId) return;
    const timer = setInterval(async () => {
      try {
        const res = await fetch(`/api/rescue/check/${actor.id}`);
        const data = await res.json();
        if (data.outgoing) {
          if (data.outgoing.status === 'accepted') {
            await fetch('/api/rescue/confirm', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ patientId: actor.id })
            });
            showToast('一位医疗向导将你从死亡边缘拉了回来！');
            setIsDying(false);
            setRescueReqId(null);
            fetchGlobalData();
          } else if (data.outgoing.status === 'rejected') {
            showToast('你的求救被拒绝了，生机断绝...');
            setRescueReqId(null);
          }
        }
      } catch (e) {
        console.error(e);
      }
    }, 3000);
    return () => clearInterval(timer);
  }, [isDying, rescueReqId, actor.id, showToast, fetchGlobalData]);

  // ===== 同地图玩家轮询 =====
  useEffect(() => {
    if (!effectiveLocationId) {
      setLocalPlayers([]);
      return;
    }

    const fetchPlayers = async () => {
      if (isDocumentHidden()) return;
      try {
        const res = await fetch(`/api/locations/${effectiveLocationId}/players?excludeId=${actor.id}`);
        const data = await res.json();
        if (data.success) {
          const unique = (data.players || []).filter(
            (p: any, idx: number, arr: any[]) => arr.findIndex((x) => x.id === p.id) === idx
          );
          setLocalPlayers(unique);
        }
      } catch (e) {
        console.error(e);
      }
    };

    fetchPlayers();
    const timer = setInterval(fetchPlayers, 15000);
    return () => clearInterval(timer);
  }, [effectiveLocationId, actor.id]);

  useEffect(() => {
    let alive = true;

    const fetchWorldPresence = async () => {
      if (isDocumentHidden()) return;
      try {
        const res = await fetch('/api/world/presence', { cache: 'no-store' });
        const data = await res.json().catch(() => ({} as any));
        if (!alive || !res.ok || data.success === false) return;
        setWorldPresence(Array.isArray(data.players) ? data.players : []);
      } catch {
        // ignore
      }
    };

    fetchWorldPresence();
    const timer = setInterval(fetchWorldPresence, 25000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [actor.id]);

  useEffect(() => {
    if (!actor?.id) return;
    let alive = true;

    const pollTradeRequests = async () => {
      if (isDocumentHidden()) return;
      try {
        const res = await fetch('/api/trade/request/pending/' + actor.id, { cache: 'no-store' });
        const data = await res.json().catch(() => ({} as any));
        if (!alive || !res.ok || data.success === false) return;
        const rows = Array.isArray(data.requests) ? data.requests : [];
        setPendingTradeRequests(rows);
      } catch {
        // ignore
      }
    };

    pollTradeRequests();
    const timer = setInterval(pollTradeRequests, 15000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [actor.id]);

  useEffect(() => {
    if (!actor?.id) return;
    let alive = true;

    const pollActiveTradeSession = async () => {
      if (isDocumentHidden()) return;
      try {
        const res = await fetch('/api/trade/session/active/' + actor.id, { cache: 'no-store' });
        const data = await res.json().catch(() => ({} as any));
        if (!alive || !res.ok || data.success === false) return;
        const nextSessionId = data.sessionId ? String(data.sessionId) : '';
        if (!nextSessionId) {
          dismissedTradeSessionIdRef.current = '';
          setActiveTradeSessionId(null);
          return;
        }
        if (dismissedTradeSessionIdRef.current === nextSessionId) return;
        setActiveTradeSessionId(nextSessionId);
      } catch {
        // ignore
      }
    };

    pollActiveTradeSession();
    const timer = setInterval(pollActiveTradeSession, 15000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [actor.id]);

  useEffect(() => {
    if (!actor?.id) return;
    let alive = true;

    const fetchWorldNpcs = async () => {
      if (isDocumentHidden()) return;
      try {
        const res = await fetch(`/api/world/npcs?userId=${actor.id}`, { cache: 'no-store' });
        const data = await res.json().catch(() => ({} as any));
        if (!alive || !res.ok || data.success === false) return;
        const rows = Array.isArray(data.npcs) ? data.npcs : [];
        setWorldNpcs(rows);
      } catch {
        // ignore
      }
    };

    fetchWorldNpcs();
    const timer = setInterval(fetchWorldNpcs, 12000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [actor.id]);

  useEffect(() => {
    if (!interactNpc) return;
    const exists = worldNpcs.some((x: any) => String(x.id || '') === String(interactNpc.id || ''));
    if (!exists) setInteractNpc(null);
  }, [worldNpcs, interactNpc]);

  useEffect(() => {
    if (!actor?.id) return;
    let alive = true;
    const actionLabelMap: Record<string, string> = {
      combat: '战斗',
      steal: '偷窃',
      prank: '恶作剧',
      soothe: '精神抚慰'
    };

    const pollSkipRequests = async () => {
      if (isDocumentHidden()) return;
      try {
        const res = await fetch(`/api/interact/skip/pending/${actor.id}`, { cache: 'no-store' });
        const data = await res.json().catch(() => ({}));
        if (!alive || !res.ok || data.success === false) return;
        const rows = Array.isArray(data.requests) ? data.requests : [];
        for (const row of rows) {
          const requestId = Number(row?.id || 0);
          if (!requestId || handledSkipRequestIdsRef.current.has(requestId)) continue;
          handledSkipRequestIdsRef.current.add(requestId);

          const actionType = String(row?.actionType || '');
          const label = actionLabelMap[actionType] || actionType || '未知动作';
          const fromUserId = Number(row?.fromUserId || 0);
          const fromUserName = String(row?.fromUserName || '').trim();
          const fromLabel = fromUserName || `玩家#${fromUserId}`;
          const yes = window.confirm(`${fromLabel} 请求跳过对戏直接结算「${label}」，是否同意？`);

          try {
            const rsp = await fetch('/api/interact/skip/respond', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                requestId,
                userId: actor.id,
                accept: yes
              })
            });
            const rData = await rsp.json().catch(() => ({}));
            showToast(rData.message || (yes ? '你已同意该跳过请求' : '你已拒绝该跳过请求'));
            if (yes) fetchGlobalData();
          } catch {
            showToast('处理跳过请求失败');
          }
        }
      } catch {
        // ignore
      }
    };

    pollSkipRequests();
    const timer = setInterval(pollSkipRequests, 7000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [actor.id, showToast, fetchGlobalData]);

  useEffect(() => {
    if (!actor?.id) return;
    let alive = true;
    const key = `interaction_event_cursor_${actor.id}`;
    const stored = Number(localStorage.getItem(key) || 0);
    const hasStoredCursor = Number.isFinite(stored) && stored > 0;
    interactionEventCursorRef.current = hasStoredCursor ? Math.floor(stored) : 0;

    const pollInteractionEvents = async () => {
      if (isDocumentHidden()) return;
      try {
        const afterId = Math.max(0, Number(interactionEventCursorRef.current || 0));
        const res = await fetch(`/api/interact/events/${actor.id}?afterId=${afterId}&limit=30`, { cache: 'no-store' });
        const data = await res.json().catch(() => ({}));
        if (!alive || !res.ok || data.success === false) return;
        const rows = Array.isArray(data.events) ? data.events : [];
        if (!rows.length) return;

        let maxId = afterId;
        let shouldRefresh = false;
        for (const row of rows) {
          const id = Number(row?.id || 0);
          if (id > maxId) maxId = id;
          const msg = String(row?.message || row?.title || '').trim();
          if (msg) showToast(msg);
          const t = String(row?.actionType || '').trim();
          if (['combat', 'steal', 'prank', 'soothe', 'trade'].includes(t)) {
            shouldRefresh = true;
          }
        }

        interactionEventCursorRef.current = maxId;
        localStorage.setItem(key, String(maxId));
        if (shouldRefresh) fetchGlobalData();
      } catch {
        // ignore
      }
    };

    let timer: number | null = null;
    const beginPolling = () => {
      pollInteractionEvents();
      timer = window.setInterval(pollInteractionEvents, 6000);
    };

    const bootstrapCursor = async () => {
      if (hasStoredCursor) {
        beginPolling();
        return;
      }
      try {
        const res = await fetch(`/api/interact/events/${actor.id}?latestOnly=1`, { cache: 'no-store' });
        const data = await res.json().catch(() => ({}));
        if (alive && res.ok && data.success !== false) {
          const maxId = Math.max(0, Number(data.maxId || 0));
          interactionEventCursorRef.current = maxId;
          localStorage.setItem(key, String(maxId));
        }
      } catch {
        // ignore
      } finally {
        if (alive) beginPolling();
      }
    };

    bootstrapCursor();
    return () => {
      alive = false;
      if (timer !== null) window.clearInterval(timer);
    };
  }, [actor.id, showToast, fetchGlobalData]);

  useEffect(() => {
    if (!actor?.id) return;
    let alive = true;

    const pollEntanglements = async () => {
      if (isDocumentHidden()) return;
      try {
        const res = await fetch(`/api/party/entangle/${actor.id}`, { cache: 'no-store' });
        const data = await res.json().catch(() => ({}));
        if (!alive || !res.ok || data.success === false) return;

        const rows = Array.isArray(data.entanglements) ? data.entanglements : [];
        for (const row of rows) {
          const entanglementId = Number(row?.id || 0);
          const otherUserId = Number(row?.otherUserId || 0);
          const updatedAt = String(row?.updatedAt || '');
          if (!entanglementId || !otherUserId) continue;

          const sign = `${entanglementId}:${updatedAt}`;
          if (handledEntanglementPromptSignaturesRef.current.has(sign)) continue;
          handledEntanglementPromptSignaturesRef.current.add(sign);

          const otherName = String(row?.otherUserName || '').trim() || `玩家#${otherUserId}`;
          const yes = window.confirm(
            `${otherName} 正在纠缠你，是否继续纠缠？\n选择“否”将解除纠缠关系。`
          );

          try {
            const rsp = await fetch('/api/party/entangle/resolve', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                userId: actor.id,
                otherUserId,
                continueEntangle: yes
              })
            });
            const rData = await rsp.json().catch(() => ({}));
            showToast(rData.message || (yes ? '仍保持纠缠关系' : '已解除纠缠关系'));
            fetchGlobalData();
          } catch {
            showToast('处理纠缠状态失败');
          }
        }
      } catch {
        // ignore
      }
    };

    pollEntanglements();
    const timer = setInterval(pollEntanglements, 8000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [actor.id, showToast, fetchGlobalData]);

  useEffect(() => {
    if (!actor?.id) return;
    let alive = true;

    const pollPartyRequests = async () => {
      if (isDocumentHidden()) return;
      try {
        const res = await fetch(`/api/party/requests/${actor.id}`, { cache: 'no-store' });
        const data = await res.json().catch(() => ({}));
        if (!alive || !res.ok || data.success === false) return;
        const rows = Array.isArray(data.requests) ? data.requests : [];
        for (const row of rows) {
          const requestId = Number(row?.id || 0);
          if (!requestId || handledPartyRequestIdsRef.current.has(requestId)) continue;
          handledPartyRequestIdsRef.current.add(requestId);

          const reqType = String(row?.requestType || '');
          const fromName = String(row?.fromUserName || '').trim() || `玩家#${Number(row?.fromUserId || 0)}`;
          const applicantName = String(row?.applicantName || '').trim() || `玩家#${Number(row?.targetUserId || 0)}`;
          const payload = row?.payload && typeof row.payload === 'object' ? row.payload : {};
          let promptText = '';
          if (reqType === 'join_direct') {
            promptText = `${fromName} 邀请你组队，是否同意？`;
          } else if (reqType === 'join_vote') {
            promptText = `${fromName} 发起入队请求：${applicantName} 申请加入队伍，是否同意？`;
          } else if (reqType === 'leave') {
            promptText = `${fromName} 请求解除组队，是否同意？\n若拒绝，将触发纠缠状态。`;
          } else if (reqType === 'follow') {
            const loc = String(payload?.locationId || '').trim() || '未知地点';
            promptText = `${fromName} 前往了 ${loc}，你是否跟随？\n拒绝将解除组队。`;
          } else {
            continue;
          }

          const yes = window.confirm(promptText);
          try {
            const rsp = await fetch('/api/party/respond', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                requestId,
                userId: actor.id,
                accept: yes
              })
            });
            const rData = await rsp.json().catch(() => ({}));
            showToast(rData.message || (yes ? '已同意该请求' : '已拒绝该请求'));
            fetchGlobalData();
          } catch {
            showToast('处理组队请求失败');
          }
        }
      } catch {
        // ignore
      }
    };

    pollPartyRequests();
    const timer = setInterval(pollPartyRequests, 7000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [actor.id, showToast, fetchGlobalData]);

  useEffect(() => {
    if (!actor?.id) return;
    let alive = true;

    const pollMediationInvites = async () => {
      if (isDocumentHidden()) return;
      try {
        const res = await fetch(`/api/rp/mediation/invites/${actor.id}`, { cache: 'no-store' });
        const data = await res.json().catch(() => ({}));
        if (!alive || !res.ok || data.success === false) return;
        const rows = Array.isArray(data.invites) ? data.invites : [];
        for (const row of rows) {
          const inviteId = Number(row?.id || 0);
          if (!inviteId || handledMediationInviteIdsRef.current.has(inviteId)) continue;
          handledMediationInviteIdsRef.current.add(inviteId);

          const requester = String(row?.requestedByName || '').trim() || `玩家#${Number(row?.requestedByUserId || 0)}`;
          const loc = String(row?.locationName || '').trim() || '未知地点';
          const reason = String(row?.reason || '').trim();
          const yes = window.confirm(
            `${requester} 在 ${loc} 发起评理请求，是否加入调解？${reason ? `\n理由：${reason}` : ''}`
          );
          try {
            const rsp = await fetch(`/api/rp/mediation/invites/${inviteId}/respond`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                userId: actor.id,
                accept: yes
              })
            });
            const rData = await rsp.json().catch(() => ({}));
            showToast(rData.message || (yes ? '已加入评理会话' : '已拒绝评理邀请'));
            if (yes && rData.sessionId) {
              setRPSessionId(String(rData.sessionId));
              setRPWindowOpen(true);
              setRPPing(false);
              await refreshRPSessionList(false);
            }
          } catch {
            showToast('处理评理邀请失败');
          }
        }
      } catch {
        // ignore
      }
    };

    pollMediationInvites();
    const timer = setInterval(pollMediationInvites, 8000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [actor.id, showToast]);

  // ===== 被动接收/同步对戏会话（不自动弹窗）=====
  useEffect(() => {
    let alive = true;

    const pollIncoming = async (notifyNew = true) => {
      if (isDocumentHidden()) return;
      try {
        const res = await fetch(`/api/rp/session/list/${actor.id}`, { cache: 'no-store' });
        const data = await res.json().catch(() => ({} as any));

        if (!alive || !res.ok || data.success === false) return;
        applyRPSessionList(data.sessions || [], notifyNew);
      } catch {
        // ignore
      }
    };

    pollIncoming(false);
    const t = setInterval(() => {
      pollIncoming(true);
    }, 15000);

    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [actor.id, showToast, rpWindowOpen, isCreatingRP]);

  // ===== 对戏对象“在你身边”提示 =====
  useEffect(() => {
    if (!rpSessionId || !rpPeerName) {
      setRPNearbyHint('');
      return;
    }

    const nearby = localPlayers.some((p: any) => String(p.name || '').trim() === String(rpPeerName).trim());
    setRPNearbyHint(nearby ? `${rpPeerName} 玩家在你身边` : '');
  }, [rpSessionId, rpPeerName, localPlayers, effectiveLocationId]);

  // 群戏与地图强绑定：离开当前地图即自动退出
  useEffect(() => {
    if (!groupRPJoinedLocationId) return;
    const currentLoc = String(effectiveLocationId || '').trim();
    if (currentLoc && currentLoc === String(groupRPJoinedLocationId)) return;

    const leavingLoc = String(groupRPJoinedLocationId);
    (async () => {
      try {
        await fetch('/api/rp/group/leave', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: actor.id,
            userName: actor.name,
            locationId: leavingLoc
          })
        });
      } catch {
        // ignore
      } finally {
        setGroupRPJoinedLocationId(null);
        setGroupRPJoinedLocationName('');
        setGroupRPWindowOpen(false);
        showToast('你已离开原地图，自动退出群戏');
      }
    })();
  }, [effectiveLocationId, groupRPJoinedLocationId, actor.id, actor.name, showToast]);

  useEffect(() => {
    return () => {
      const leavingLoc = String(groupRPJoinedLocationId || '').trim();
      if (!leavingLoc) return;
      fetch('/api/rp/group/leave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: actor.id,
          userName: actor.name,
          locationId: leavingLoc
        }),
        keepalive: true
      }).catch(() => {});
    };
  }, [groupRPJoinedLocationId, actor.id, actor.name]);

  const userAge = actor?.age || 0;
  const hasActiveJob = !!String(actor?.job || '').trim() && String(actor?.job || '').trim() !== '\u65e0';
  const hasFaction = !!String(actor?.faction || '').trim() && String(actor?.faction || '').trim() !== '\u65e0';
  const isUndifferentiated = userAge < 16;
  const isStudentAge = userAge >= 16 && userAge <= 19;
  const hasGuideEscort =
    isUndifferentiated &&
    !!(actor as any).partyId &&
    localPlayers.some((p: any) => {
      const sameParty = String(p.partyId || '') !== '' && String(p.partyId || '') === String((actor as any).partyId || '');
      const role = String(p.role || '');
      return sameParty && (role === '向导' || role.toLowerCase() === 'guide');
    });
  const shouldApplyMinorTravelRestriction = isUndifferentiated && !hasGuideEscort && !hasActiveJob;
  const shouldApplyStudentTravelPrompt = isStudentAge && !hasFaction && !hasActiveJob;
  const isMinorFogMode =
    shouldApplyMinorTravelRestriction &&
    !!effectiveLocationId &&
    !isSafeLocationId(String(effectiveLocationId));

  useEffect(() => {
    if (isMinorFogMode && activeView && !isSafeLocationId(activeView)) {
      setActiveView(null);
      showToast('与向导脱队后迷雾加深，你被迫退出该区域交互。');
    }
  }, [isMinorFogMode, activeView, showToast]);

  // ===== 主动发起对戏（稳态 + 不吞错）=====
  const startRoleplaySession = async (target: User): Promise<any> => {
    if (isCreatingRP) return { ok: false, message: '正在建立连接，请稍候' };
    if (!target?.id || target.id === actor.id) return { ok: false, message: '目标玩家无效' };

    setIsCreatingRP(true);
    let timer: number | null = null;
    try {
      const sid = buildPairSessionId(actor.id, target.id, effectiveLocationId || 'unknown');
      const locationName = resolveLocationName(String(effectiveLocationId || ''));

      const payload = {
        sessionId: sid,
        userAId: actor.id,
        userAName: actor.name,
        userBId: target.id,
        userBName: target.name,
        locationId: effectiveLocationId || 'unknown',
        locationName
      };

      const ctl = new AbortController();
      timer = window.setTimeout(() => ctl.abort(), 10000);
      const res = await fetch('/api/rp/session/upsert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: ctl.signal
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok || data.success === false) {
        return { ok: false, message: data.message || '建立连接失败（会话创建失败）' };
      }

      const finalSid = String(data.sessionId || sid);
      upsertRPSession({
        sessionId: finalSid,
        userAId: actor.id,
        userAName: actor.name,
        userBId: target.id,
        userBName: target.name,
        locationId: effectiveLocationId || 'unknown',
        locationName,
        status: 'active',
        createdAt: null,
        updatedAt: null,
        lastMessageAt: new Date().toISOString(),
      });
      setRPWindowOpen(true);
      setRPPing(false);
      showToast(`已向 ${target.name} 发起对戏连接`);
      return { ok: true, sessionId: finalSid };
    } catch (e: any) {
      const msg =
        e?.name === 'AbortError'
          ? '建立连接超时，请检查网络后重试'
          : (e?.message || '建立连接失败');
      return { ok: false, message: msg };
    } finally {
      if (timer !== null) window.clearTimeout(timer);
      setIsCreatingRP(false);
    }
  };

  const requestTradeWithUser = async (target: User) => {
    if (!target?.id || Number(target.id) === Number(actor.id)) {
      showToast('目标玩家无效');
      return false;
    }

    try {
      const res = await fetch('/api/trade/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromUserId: actor.id,
          toUserId: target.id,
        }),
      });
      const data = await res.json().catch(() => ({} as any));
      if (!res.ok || data.success === false) {
        showToast(data.message || '发起交易请求失败');
        return false;
      }

      if (data.sessionId) {
        dismissedTradeSessionIdRef.current = '';
        setActiveTradeSessionId(String(data.sessionId));
      }
      showToast(data.message || '交易请求已发出');
      return true;
    } catch {
      showToast('发起交易请求失败');
      return false;
    }
  };

  const respondTradeRequest = async (requestId: number, accept: boolean) => {
    if (!requestId || respondingTradeRequestId) return;
    setRespondingTradeRequestId(requestId);
    try {
      const res = await fetch(`/api/trade/request/${requestId}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: actor.id, accept }),
      });
      const data = await res.json().catch(() => ({} as any));
      if (!res.ok || data.success === false) {
        showToast(data.message || '处理交易请求失败');
        return;
      }

      setPendingTradeRequests((current) => current.filter((row) => Number(row.id || 0) !== requestId));
      if (accept && data.sessionId) {
        dismissedTradeSessionIdRef.current = '';
        setActiveTradeSessionId(String(data.sessionId));
      }
      showToast(data.message || (accept ? '已接受交易请求' : '已拒绝交易请求'));
      fetchGlobalData();
    } catch {
      showToast('处理交易请求失败');
    } finally {
      setRespondingTradeRequestId(null);
    }
  };

  const leaveGroupRoleplay = async (locationIdArg?: string, silent = false) => {
    const locId = String(locationIdArg || groupRPJoinedLocationId || '').trim();
    if (!locId) return;
    try {
      const res = await fetch('/api/rp/group/leave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: actor.id,
          userName: actor.name,
          locationId: locId
        })
      });
      const data = await res.json().catch(() => ({} as any));
      if (!res.ok || data.success === false) {
        if (!silent) showToast(data.message || '退出群戏失败');
      } else if (!silent) {
        showToast('已退出群戏');
      }
    } catch {
      if (!silent) showToast('网络异常，退出群戏失败');
    } finally {
      if (String(groupRPJoinedLocationId || '') === locId) {
        setGroupRPJoinedLocationId(null);
        setGroupRPJoinedLocationName('');
        setGroupRPWindowOpen(false);
      }
    }
  };

  const joinGroupRoleplayAtCurrentLocation = async (): Promise<boolean> => {
    const locationId = String(effectiveLocationId || '').trim();
    if (!locationId) {
      showToast('请先进入一个地图区域后再加入群戏');
      return false;
    }
    const locationName = resolveLocationName(locationId);
    try {
      const res = await fetch('/api/rp/group/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: actor.id,
          userName: actor.name,
          locationId,
          locationName
        })
      });
      const data = await res.json().catch(() => ({} as any));
      if (!res.ok || data.success === false) {
        showToast(data.message || '加入群戏失败');
        return false;
      }
      setGroupRPJoinedLocationId(String(data.locationId || locationId));
      setGroupRPJoinedLocationName(String(data.locationName || locationName));
      setGroupRPWindowOpen(true);
      showToast(`已加入 ${String(data.locationName || locationName)} 群戏`);
      return true;
    } catch {
      showToast('网络异常，加入群戏失败');
      return false;
    }
  };

  const handleGroupRoleplayButtonClick = async (): Promise<boolean> => {
    if (!effectiveLocationId) {
      showToast('请先进入地图后再使用群戏');
      return false;
    }
    if (isGroupRPInCurrentLocation) {
      setGroupRPWindowOpen((v) => !v);
      return true;
    }
    return await joinGroupRoleplayAtCurrentLocation();
  };

  const openGroupRoleplayFromInteraction = async (): Promise<boolean> => {
    if (!effectiveLocationId) {
      showToast('请先进入地图后再使用群戏');
      return false;
    }
    if (isGroupRPInCurrentLocation) {
      setGroupRPWindowOpen(true);
      return true;
    }
    return await joinGroupRoleplayAtCurrentLocation();
  };

  const handleLocationAction = async (action: 'enter' | 'stay') => {
    if (!selectedLocation) return;
    if (isParanormalPrisonLocked && selectedLocation.id !== 'paranormal_office') {
      showToast('你被收容在灵异管理所监牢中，当前无法前往其他区域。');
      return;
    }
    if (isTowerGuardPrisonLocked && selectedLocation.id !== 'tower_guard') {
      showToast('你被关押在守塔会地下监牢中，当前无法前往其他区域。');
      return;
    }
    const targetUnsafe = !isSafeLocationId(String(selectedLocation?.id || ''));
    let minorRiskConfirmed = false;

    if (isTreatmentLocked && selectedLocation.id !== 'sanctuary') {
      showToast('当前状态异常，必须前往圣所进行治疗后才能离开');
      return;
    }

    if (
      String(actor.currentLocation || '') === 'tower_of_life' &&
      selectedLocation.id !== 'tower_of_life' &&
      !TOWER_ADJACENT_LOCATIONS.has(selectedLocation.id)
    ) {
      showToast('您无法一下子走那么远');
      return;
    }

    if (shouldApplyMinorTravelRestriction && targetUnsafe) {
      const headstrong = window.confirm('这里太危险了，未分化者不建议前往。\n选择【确定】头铁前往（迷雾模式），选择【取消】留在安全区。');
      if (!headstrong) {
        showToast('你决定继续留在安全区域。');
        return;
      }
      minorRiskConfirmed = true;
    }
    if (shouldApplyStudentTravelPrompt && action === 'enter' && targetUnsafe) {
      if (!window.confirm('你尚未加入阵营，当前进入将按最低职位处理，是否继续？')) {
        const londonTower = LOCATIONS.find((l) => l.id === 'london_tower');
        if (londonTower) {
          setSelectedLocation(londonTower);
          showToast('已为你切换到伦敦塔。');
        }
        return;
      }
    }

    if (action === 'stay') {
      const res = await fetch(`/api/characters/${actor.id}/location`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locationId: selectedLocation.id, minorRiskConfirmed })
      });
      const data = await res.json().catch(() => ({} as any));
      if (!res.ok || data.success === false) {
        showToast(data.message || '无法驻足该区域');
        return;
      }
      if (data.prison) setPrisonState(data.prison);
      if (data.guardPrison) setGuardPrisonState(data.guardPrison);
      showToast(`已在 ${selectedLocation.name} 驻足。`);
      fetchGlobalData();
      return;
    }

    if (action === 'enter') {
      const res = await fetch(`/api/characters/${actor.id}/location`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locationId: selectedLocation.id, minorRiskConfirmed })
      });
      const data = await res.json().catch(() => ({} as any));
      if (!res.ok || data.success === false) {
        showToast(data.message || '无法进入该区域');
        return;
      }
      if (data.prison) setPrisonState(data.prison);
      if (data.guardPrison) setGuardPrisonState(data.guardPrison);
      if (data.prisonTriggered) {
        showToast('你触发了收容机制，已被关入灵异管理所监牢。');
      }

      if (shouldApplyMinorTravelRestriction && targetUnsafe) {
        setActiveView(null);
        setSelectedLocation(null);
        showToast('迷雾笼罩了前方，非玩家角色会驱离你；你仍可在此区域探索掉落。');
        fetchGlobalData();
        return;
      }

      setActiveView(selectedLocation.id);
      setSelectedLocation(null);
    }
  };

  const handleExitActiveView = () => {
    if (isParanormalPrisonLocked && activeView === 'paranormal_office') {
      showToast('你被收容在监牢中，当前无法撤离灵异管理所。');
      return;
    }
    if (isTowerGuardPrisonLocked && activeView === 'tower_guard') {
      showToast('你被关押在地下监牢中，当前无法撤离守塔会。');
      return;
    }
    setActiveView(null);
  };

  const handleNavigateLocationFromSubView = (locationId: string) => {
    const next = String(locationId || '').trim();
    if (!next) return;
    setSelectedLocation(null);
    setRuntimeUser((current) => current ? { ...current, currentLocation: next } : current);
    setActiveView(next);
    void refreshWorldPresence();
  };

  const handleExploreSkill = async () => {
    if (!selectedLocation) return;
    try {
      const res = await fetch('/api/explore/skill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: actor.id, locationId: selectedLocation.id })
      });
      const data = await res.json();
      showToast(data.success ? `🎉 ${data.message}` : `⚠️ ${data.message}`);
    } catch {
      showToast('错误！');
    }
  };

  const handleExploreItem = async () => {
    if (!selectedLocation && !activeView) return;
    const locId = activeView || selectedLocation?.id;
    try {
      const res = await fetch('/api/explore/item', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: actor.id, locationId: locId })
      });
      const data = await res.json();
      showToast(data.success ? `🎉 ${data.message}` : `⚠️ ${data.message}`);
    } catch {
      showToast('错误！');
    }
  };

  const handleStruggle = async () => {
    try {
      const res = await fetch('/api/rescue/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientId: actor.id, healerId: 0 })
      });
      if ((await res.json()).success) {
        setRescueReqId(Date.now());
        showToast('求救信号已发出...');
      }
    } catch {
      showToast('求救发送失败');
    }
  };

  const handlePurifyErosion = async () => {
    if (!canUseTowerPurify) {
      showToast('当前职位无法执行净化');
      return;
    }
    try {
      const res = await fetch('/api/tower/purify-erosion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: actor.id })
      });
      const data = await res.json().catch(() => ({} as any));
      if (!res.ok || data.success === false) {
        showToast(data.message || '净化失败');
        return;
      }
      showToast(data.message || '净化完成');
      fetchGlobalData();
    } catch {
      showToast('网络异常，净化失败');
    }
  };

  const submitGuardArrestCancel = async (caseId: number, silent = false) => {
    if (!caseId) return false;
    try {
      const res = await fetch('/api/tower-guard/arrest/cancel-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: actor.id,
          caseId,
          reason: '被申请人主动提交撤销抓捕申请'
        })
      });
      const data = await res.json().catch(() => ({} as any));
      if (!res.ok || data.success === false) {
        if (!silent) showToast(data.message || '撤销申请提交失败');
        return false;
      }
      if (!silent) showToast(data.message || '撤销申请已提交');
      fetchGlobalData();
      return true;
    } catch {
      if (!silent) showToast('网络异常，撤销申请提交失败');
      return false;
    }
  };

  const handleGuardArrestSkill = async () => {
    if (!canUseGuardArrestSkill) {
      showToast('当前职位无法使用守塔会抓捕技能');
      return;
    }
    if (isAnyPrisonLocked) {
      showToast('监牢状态下无法使用抓捕技能');
      return;
    }

    const chosenTarget =
      interactTarget && localPlayers.some((p: any) => Number(p.id || 0) === Number(interactTarget.id || 0))
        ? interactTarget
        : localPlayers.length === 1
          ? localPlayers[0]
          : null;

    if (!chosenTarget) {
      showToast('请先点选一名同地图玩家，再使用抓捕技能。');
      return;
    }

    try {
      const res = await fetch('/api/tower-guard/arrest/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: actor.id, targetUserId: Number(chosenTarget.id || 0) })
      });
      const data = await res.json().catch(() => ({} as any));
      if (!res.ok || data.success === false) {
        showToast(data.message || '抓捕申请提交失败');
        return;
      }
      showToast(data.message || '抓捕申请已提交');
    } catch {
      showToast('网络异常，抓捕申请提交失败');
    }
  };

  const handleSubmitDeath = async () => {
    if (!deathText.trim()) return showToast('必须填写谢幕词');
    await fetch(`/api/users/${actor.id}/submit-death`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: showDeathForm === 'death' ? 'pending_death' : 'pending_ghost', text: deathText })
    });
    showToast('申请已提交...');
    setShowDeathForm(null);
    fetchGlobalData();
  };

  const fetchGraveyard = async () => {
    const res = await fetch('/api/graveyard');
    const data = await res.json();
    if (data.success) {
      setTombstones(data.tombstones);
      setShowGraveyard(true);
    }
  };

  const loadComments = async (tombstoneId: number) => {
    if (expandedTombstone === tombstoneId) {
      setExpandedTombstone(null);
      return;
    }
    const res = await fetch(`/api/graveyard/${tombstoneId}/comments`);
    const data = await res.json();
    if (data.success) {
      setComments(data.comments);
      setExpandedTombstone(tombstoneId);
    }
  };

  const addComment = async (tombstoneId: number) => {
    if (!newComment.trim()) return;
    await fetch(`/api/graveyard/${tombstoneId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: actor.id, userName: user.name, content: newComment })
    });
    setNewComment('');
    loadComments(tombstoneId);
  };

  const handleThemePresetApply = (themeId: string) => {
    const safe = (themeId || DEFAULT_UI_THEME) as any;
    setUiThemePreset(safe);
    setUiThemePresetState(safe);
    showToast(`已切换主题：${UI_THEME_PRESETS.find((x) => x.id === safe)?.name || safe}`);
  };

  const handleBackgroundApply = () => {
    const url = String(bgImageInput || '').trim();
    setUiBackgroundUrl(url);
    setBgImageInput(url);
    showToast(url ? '背景图已更新' : '已清空自定义背景图');
  };

  const handleBackgroundReset = () => {
    clearUiBackgroundUrl();
    setBgImageInput('');
    showToast('已恢复默认背景图');
  };

  const handleImportBackgroundFile = async (file: File) => {
    if (!file) return;
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('read background failed'));
        reader.readAsDataURL(file);
      });
      setUiBackgroundUrl(dataUrl);
      setBgImageInput(dataUrl);
      showToast(`已导入背景图：${file.name}`);
    } catch {
      showToast('读取背景图失败');
    }
  };

  const handleImportCustomCssFile = async (file: File) => {
    if (!file) return;
    try {
      const text = await file.text();
      setUiCustomCss(text);
      setCustomCssTextState(text);
      showToast(`已导入自定义样式：${file.name}`);
    } catch {
      showToast('读取样式文件失败');
    }
  };

  const handleCustomCssApply = () => {
    setUiCustomCss(customCssText);
    showToast(customCssText.trim() ? '自定义样式已应用' : '已清空自定义样式');
  };

  const handleCustomCssReset = () => {
    clearUiCustomCss();
    setCustomCssTextState('');
    showToast('已清除自定义样式');
  };

  const handleTextColorApply = () => {
    const value = String(customTextColor || '').trim();
    if (value && !/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value)) {
      showToast('文字颜色格式应为 #RGB 或 #RRGGBB');
      return;
    }
    setUiTextColor(value);
    setCustomTextColorState(value ? value.toLowerCase() : '');
    showToast(value ? '文字颜色已应用' : '已恢复主题默认文字颜色');
  };

  const handleTextColorReset = () => {
    clearUiTextColor();
    setCustomTextColorState('');
    showToast('已恢复主题默认文字颜色');
  };

  const handleThemeResetAll = () => {
    setUiThemePreset(DEFAULT_UI_THEME as any);
    clearUiBackgroundUrl();
    clearUiTextColor();
    clearUiCustomCss();
    setUiThemePresetState(DEFAULT_UI_THEME);
    setBgImageInput('');
    setCustomTextColorState('');
    setCustomCssTextState('');
    showToast('已恢复默认圣洁白雾风格');
  };

const closeAnnouncement = () => {
  const ids = [
    Number(activeAnn?.id || 0),
    ...annQueue.map((x: any) => Number(x?.id || 0))
  ].filter((n) => n > 0);

  const maxId = ids.length ? Math.max(...ids) : 0;
  if (maxId > 0) {
    const k = `ann_last_seen_${actor.id}`;
    localStorage.setItem(k, String(maxId));
    setLastSeenAnnId((prev) => Math.max(prev, maxId));
  }

  setAnnQueue([]);   // ✅ 清空剩余队列
  setActiveAnn(null);
};



  const deleteComment = async (commentId: number, tombstoneId: number) => {
    await fetch(`/api/graveyard/comments/${commentId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: actor.id })
    });
    loadComments(tombstoneId);
  };

  // ================= 🚀 核心修复：更精准、不乱飘的气泡定位算法 =================
  const bubbleLayout = useMemo(() => {
    const result: Record<string, { left: number; top: number; scale: number; depth: number; delay: number; z: number }> = {};
    const placed: Array<{ x: number; y: number }> = [];

    // 寻找当前地点的物理坐标信息
    const loc = mapLocations.find((l) => String(l.id) === String(effectiveLocationId));
    const isWorldMap = !activeView; // 如果没有 activeView，说明在大地图视角

    // 定位基准点：如果在大地图，基准点直接绑定该地标坐标（稍微往上移一点点免得挡住文字）；
    // 如果在进入了室内区域，基准点在屏幕中心（50, 50）
    const baseX = isWorldMap && loc ? loc.x : 50;
    const baseY = isWorldMap && loc ? loc.y - 4 : 50;

    // 头像散布的范围限制：大地图聚集在坐标点周围，室内可以稍微散开
    const spread = isWorldMap ? 6 : 30;

    localPlayers.forEach((p: any, idx: number) => {
      const h = hashNum(`${p.id}-${idx}`);

      let angle = (h % 360) * (Math.PI / 180);
      let r = isWorldMap ? (h % spread) : (h % spread) + 5;

      let x = baseX + Math.cos(angle) * r;
      let y = baseY + Math.sin(angle) * r * 0.8; // 视觉上 Y 轴呈扁平椭圆

      // 防重叠计算
      let found = false;
      for (let t = 0; t < 50; t++) {
        const ok = placed.every((pt) => {
          const dx = x - pt.x;
          const dy = y - pt.y;
          // 大地图重叠容忍度高（靠得紧密），室内容忍度低（散开）
          return dx * dx + dy * dy >= (isWorldMap ? 9 : 45);
        });
        if (ok) {
          found = true;
          break;
        }
        r += isWorldMap ? 0.8 : 2;
        angle += 0.5;
        x = baseX + Math.cos(angle) * r;
        y = baseY + Math.sin(angle) * r * 0.8;
      }

      // 边缘安全限制，防止挤出屏幕边界
      x = Math.max(5, Math.min(95, x));
      y = Math.max(5, Math.min(95, y));

      placed.push({ x, y });

      // 大地图视角下头像等比例缩小
      const baseScale = isWorldMap ? 0.48 : 0.82;
      const scale = baseScale + (h % 10) * 0.01;
      const depth = (y - baseY) / 100;
      const z = Math.floor(20 + depth * 40);
      const delay = (h % 9) * 0.12;

      result[String(p.id)] = { left: x, top: y, scale, depth, delay, z };
    });

    return result;
  }, [localPlayers, effectiveLocationId, activeView]);

  const locationNpcs = useMemo(() => {
    if (!activeView) return [];
    if (!effectiveLocationId) return [];
    return worldNpcs.filter((npc: any) => String(npc.currentLocation || '') === String(effectiveLocationId));
  }, [worldNpcs, effectiveLocationId, activeView]);

  const currentLocationMeta = useMemo(() => {
    if (!effectiveLocationId) return null;
    return mapLocations.find((loc) => String(loc.id) === String(effectiveLocationId)) || null;
  }, [effectiveLocationId]);

  const currentLocationName = useMemo(() => {
    if (!currentLocationMeta) return '未知区域';
    if (shouldApplyMinorTravelRestriction && !isSafeLocationId(String(currentLocationMeta.id || ''))) {
      return '迷雾区域';
    }
    return currentLocationMeta.name;
  }, [currentLocationMeta, shouldApplyMinorTravelRestriction]);

  const currentLocationDesc = useMemo(() => {
    if (!currentLocationMeta) return '地图信息读取中';
    if (shouldApplyMinorTravelRestriction && !isSafeLocationId(String(currentLocationMeta.id || ''))) {
      return '当前区域被迷雾覆盖，需向导陪同才能完整辨识。';
    }
    return currentLocationMeta.description;
  }, [currentLocationMeta, shouldApplyMinorTravelRestriction]);

  const renderActiveView = () => {
    if (!activeView) return null;
    const commonProps = { user: actor, onExit: handleExitActiveView, showToast, fetchGlobalData };
    const blockExit =
      (isParanormalPrisonLocked && activeView === 'paranormal_office') ||
      (isTowerGuardPrisonLocked && activeView === 'tower_guard');
    let content: React.ReactNode = null;
    switch (activeView) {
      case 'tower_of_life':
        content = <TowerOfLifeView {...commonProps} />;
        break;
      case 'london_tower':
        content = <LondonTowerView {...commonProps} />;
        break;
      case 'sanctuary':
        content = (
          <SanctuaryView
            {...commonProps}
            onNavigateLocation={handleNavigateLocationFromSubView}
            onEnterCustomGameRun={(gameId) => setActiveCustomGameId(Number(gameId || 0))}
          />
        );
        break;
      case 'guild':
        content = <GuildView {...commonProps} />;
        break;
      case 'army':
        content = (
          <ArmyView
            {...commonProps}
            onNavigateLocation={handleNavigateLocationFromSubView}
            onEnterCustomGameRun={(gameId) => setActiveCustomGameId(Number(gameId || 0))}
          />
        );
        break;
      case 'slums':
        content = (
          <SlumsView
            {...commonProps}
            onNavigateLocation={handleNavigateLocationFromSubView}
            onEnterCustomGameRun={(gameId) => setActiveCustomGameId(Number(gameId || 0))}
          />
        );
        break;
      case 'rich_area':
        content = (
          <RichAreaView
            {...commonProps}
            onNavigateLocation={handleNavigateLocationFromSubView}
            onEnterCustomGameRun={(gameId) => setActiveCustomGameId(Number(gameId || 0))}
          />
        );
        break;
      case 'demon_society':
        content = <DemonSocietyView {...commonProps} />;
        break;
      case 'paranormal_office':
        content = <SpiritBureauView {...commonProps} />;
        break;
      case 'observers':
        content = <ObserverView {...commonProps} />;
        break;
      case 'tower_guard':
        content = <TowerGuardView {...commonProps} />;
        break;
      default:
        if (String(activeView || '').startsWith('custom_faction_')) {
          content = <CustomFactionView {...commonProps} locationId={String(activeView || '')} />;
        } else {
          content = null;
        }
        break;
    }

    if (!content) return null;

    return (
      <div className="w-full h-full min-h-screen overflow-y-auto pt-20 pb-10 px-4 md:px-0 flex justify-center">
        <div className="w-full max-w-6xl relative z-10">
          <button
            onClick={handleExitActiveView}
            className={`mb-4 flex items-center gap-2 px-4 py-2 backdrop-blur rounded-xl transition-colors border ${
              blockExit
                ? 'bg-slate-900/60 text-slate-500 border-slate-800 cursor-not-allowed'
                : 'bg-slate-900/60 text-white hover:bg-slate-800 border-slate-700/50'
            }`}
          >
            <ArrowLeft size={18} /> 返回世界地图
          </button>
          {content}
        </div>
      </div>
    );
  };

  return (
    <div className="theme-shell fixed inset-0 overflow-hidden font-sans select-none text-slate-100 bg-transparent">
      {/* 背景 */}
      <div className="absolute inset-0 z-0">
        <motion.div
          key={activeView || 'world_map'}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute inset-0 bg-cover bg-center transition-all duration-700"
          style={{
            backgroundImage: `url(${currentBackgroundImage})`,
            filter: activeView ? 'brightness(0.4) blur(4px)' : 'brightness(0.6)'
          }}
        />
      </div>

      {/* HUD */}
      <CharacterHUD
        user={actor}
        onLogout={onLogout}
        onRefresh={fetchGlobalData}
        currentLocationName={resolveLocationName(String(actor.currentLocation || effectiveLocationId || ''))}
        onlineCount={onlinePlayerCount}
      />

      {/* 对戏对象在附近提示 */}
      {rpNearbyHint && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[120] px-4 py-2 rounded-full bg-emerald-600/90 text-white text-xs font-black shadow-lg border border-emerald-300/40">
          {rpNearbyHint}
        </div>
      )}

      {/* 地图容器 */}
      <AnimatePresence mode="wait">
        {!activeView && (
          <motion.div className="relative w-full h-full flex items-center justify-center p-2 md:p-8 z-10">
            <div
              onClick={handleWorldMapClick}
              className={`relative w-full bg-slate-900/50 rounded-2xl md:rounded-[2rem] border border-white/10 overflow-hidden shadow-2xl ${
                isPortraitMobile ? 'aspect-[9/16] max-w-[560px]' : 'aspect-[16/9] max-w-[1200px]'
              } ${createFactionMode ? 'cursor-crosshair' : ''}`}
            >
              <img src={globalMapBackground} className="w-full h-full object-cover opacity-80" />

              <div className="absolute right-3 top-3 z-20 flex max-w-[72vw] flex-col items-end gap-2 md:right-5 md:top-5 md:max-w-sm">
                <button
                  onClick={(event) => {
                    event.stopPropagation();
                    setCreateFactionMode((value) => !value);
                    if (createFactionMode) setPendingFactionPoint(null);
                  }}
                  className={`rounded-2xl px-4 py-2 text-xs font-black shadow-lg transition-colors ${
                    createFactionMode
                      ? 'bg-amber-600 text-white hover:bg-amber-500'
                      : 'bg-white/90 text-slate-950 hover:bg-white'
                  }`}
                >
                  {createFactionMode ? '取消创建势力' : '创建自定义势力（50000G）'}
                </button>
                {createFactionMode && (
                  <div className="rounded-2xl border border-white/15 bg-slate-950/72 px-3 py-2 text-[11px] leading-5 text-slate-100 backdrop-blur">
                    点击地图空白处放置新的势力入口。创建成功后，你会自动成为该势力的掌权者。
                  </div>
                )}
              </div>

              {mapLocations.map((loc) => {
                const labelAnchorClass =
                  loc.x <= 14
                    ? 'left-0 translate-x-0'
                    : loc.x >= 86
                      ? 'right-0 left-auto translate-x-0'
                      : 'left-1/2 -translate-x-1/2';
                const playersHere = worldPresenceByLocation[String(loc.id)] || [];
                const visiblePlayers = playersHere.slice(0, 4);
                const extraPlayers = Math.max(0, playersHere.length - visiblePlayers.length);

                return (
                  <div
                    key={loc.id}
                    className="absolute transform -translate-x-1/2 -translate-y-1/2 cursor-pointer touch-manipulation"
                    style={{ left: `${loc.x}%`, top: `${loc.y}%` }}
                    onClick={(event) => {
                      event.stopPropagation();
                      setSelectedLocation(loc);
                    }}
                  >
                    <div
                      className={`w-6 h-6 md:w-8 md:h-8 rounded-full border-2 flex items-center justify-center backdrop-blur-sm transition-all
                      ${actor.currentLocation === loc.id ? 'bg-sky-500 border-white animate-pulse' : 'bg-slate-900/80 border-slate-400'}`}
                    >
                      <MapPin size={14} />
                    </div>
                    {playersHere.length > 0 && (
                      <div className={`absolute bottom-8 md:bottom-10 ${labelAnchorClass} flex items-center`}>
                        {visiblePlayers.map((player: any, idx: number) => {
                          const avatarSrc = resolveAvatarSrc(player.avatarUrl, player.avatarUpdatedAt);
                          return (
                            <div
                              key={`world-presence-${loc.id}-${player.id}`}
                              className={`relative overflow-hidden rounded-full border border-white/70 bg-slate-900 shadow-lg ${Number(player.id || 0) === Number(actor.id || 0) ? 'ring-2 ring-sky-300/80' : ''}`}
                              style={{ width: 24, height: 24, marginLeft: idx === 0 ? 0 : -6 }}
                              title={String(player.name || 'Player')}
                            >
                              {avatarSrc ? (
                                <img src={avatarSrc} alt={String(player.name || 'avatar')} className="h-full w-full object-cover" />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center text-[10px] font-black text-white">
                                  {String(player.name || '?').slice(0, 1)}
                                </div>
                              )}
                            </div>
                          );
                        })}
                        {extraPlayers > 0 && (
                          <span className="ml-1 rounded-full border border-slate-500 bg-slate-900/90 px-1.5 py-0.5 text-[9px] font-black text-slate-200">
                            +{extraPlayers}
                          </span>
                        )}
                      </div>
                    )}
                    <div
                      className={`absolute top-8 ${labelAnchorClass} whitespace-nowrap px-3 py-1.5 bg-slate-900/90 backdrop-blur-md border border-slate-700/50 rounded-lg text-[10px] md:text-xs font-bold text-slate-200 transition-all duration-300 shadow-xl
                      ${selectedLocation?.id === loc.id ? 'opacity-100 scale-110 z-20 border-sky-500/50 text-white' : 'opacity-0 hover:opacity-100 translate-y-2 hover:translate-y-0'}
                    `}
                    >
                      {shouldApplyMinorTravelRestriction && !isSafeLocationId(String(loc.id || '')) ? 'Fog Zone' : loc.name}
                    </div>
                  </div>
                );
              })}

            </div>
          </motion.div>
        )}

        {activeView && (
          <motion.div
            key="location-view"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.4 }}
            className="absolute inset-0 z-20 relative"
          >
            {renderActiveView()}
          </motion.div>
        )}
      </AnimatePresence>

      {/* 哨兵狂暴≥80 全屏暗红叠加层 */}
      {isFuryLocked && (
        <div className="absolute inset-0 z-35 pointer-events-none">
          <div className="absolute inset-0 bg-red-950/50 animate-pulse" />
          <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at center, transparent 30%, rgba(127,0,0,0.55) 100%)' }} />
        </div>
      )}

      {/* 向导稳定值≤20 全屏冷紫叠加层 */}
      {isStabilityLocked && !isFuryLocked && (
        <div className="absolute inset-0 z-35 pointer-events-none">
          <div className="absolute inset-0 bg-purple-950/45 animate-pulse" />
          <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at center, transparent 30%, rgba(80,0,120,0.5) 100%)' }} />
        </div>
      )}

      {isTreatmentLocked && (
        <div className="absolute left-1/2 top-4 z-40 -translate-x-1/2 px-4 py-2 rounded-xl bg-red-950/90 border border-red-700 text-red-100 text-xs font-black shadow-lg">
          {isFuryLocked ? '⚠ 狂暴值过载，必须前往圣所治疗后才能离开' : '⚠ 精神稳定值崩溃，必须前往圣所治疗后才能离开'}
        </div>
      )}

      {/* 未分化迷雾全屏视觉效果 */}
      {isMinorFogMode && (
        <>
          <div className="absolute inset-0 z-35 pointer-events-none overflow-hidden">
            <div className="absolute inset-0 bg-slate-900/40" />
            <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 50% 60%, rgba(150,160,180,0.18) 0%, rgba(80,90,110,0.55) 100%)' }} />
            {/* 流动迷雾层 */}
            <div className="absolute inset-0 opacity-30" style={{ background: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'400\' height=\'400\'%3E%3Cfilter id=\'noise\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.65\' numOctaves=\'3\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'400\' height=\'400\' filter=\'url(%23noise)\' opacity=\'0.4\'/%3E%3C/svg%3E")', animation: 'none' }} />
          </div>
          <div className="absolute left-1/2 top-16 z-40 -translate-x-1/2 px-4 py-2 rounded-xl bg-slate-900/90 border border-slate-500 text-slate-100 text-xs font-black shadow-lg">
            🌫 迷雾笼罩此地，NPC将驱离你，仅可探索掉落物
          </div>
        </>
      )}
      {isTowerGuardPrisonLocked && (
        <div className="absolute left-1/2 top-28 z-40 -translate-x-1/2 px-4 py-2 rounded-xl bg-amber-950/90 border border-amber-700 text-amber-100 text-xs font-black shadow-lg">
          地下监牢状态：你被关押在守塔会，当前无法离开该区域
        </div>
      )}

      {/* 职位挑战投票浮层 */}
      {activeChallenges.length > 0 && (
        <div className="fixed bottom-24 right-6 z-50 space-y-2 max-w-xs w-full">
          {activeChallenges.map((ch: any) => (
            <div key={ch.id} className="bg-slate-900/95 border border-amber-600 rounded-2xl p-4 shadow-2xl backdrop-blur">
              <div className="text-amber-400 font-black text-xs mb-1">⚔ 职位挑战进行中</div>
              <div className="text-white text-sm font-bold mb-1">{ch.targetJobName}</div>
              <div className="text-slate-300 text-xs mb-3">
                挑战者 <span className="text-sky-400">{ch.forChallenger ?? 0} 票</span>
                {' vs '}现任 <span className="text-rose-400">{ch.forHolder ?? 0} 票</span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={async () => {
                    const res = await fetch('/api/job/challenge/vote', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ challengeId: ch.id, voterId: actor.id, vote: 'challenger' })
                    });
                    const data = await res.json().catch(() => ({} as any));
                    showToast(data.message || '投票已提交');
                    if (data.settled) setActiveChallenges((prev: any[]) => prev.filter((x: any) => x.id !== ch.id));
                  }}
                  className="flex-1 py-1.5 bg-sky-700 hover:bg-sky-600 text-white text-xs font-bold rounded-lg"
                >支持挑战者</button>
                <button
                  onClick={async () => {
                    const res = await fetch('/api/job/challenge/vote', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ challengeId: ch.id, voterId: actor.id, vote: 'holder' })
                    });
                    const data = await res.json().catch(() => ({} as any));
                    showToast(data.message || '投票已提交');
                    if (data.settled) setActiveChallenges((prev: any[]) => prev.filter((x: any) => x.id !== ch.id));
                  }}
                  className="flex-1 py-1.5 bg-rose-700 hover:bg-rose-600 text-white text-xs font-bold rounded-lg"
                >支持现任</button>
                <button
                  onClick={() => setActiveChallenges((prev: any[]) => prev.filter((x: any) => x.id !== ch.id))}
                  className="px-2 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs rounded-lg"
                  title="关闭"
                >✕</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 气泡头像区 */}
      <div className="absolute inset-0 z-30 pointer-events-none">
        {localPlayers.map((p, idx) => {
          const b = bubbleLayout[String(p.id)];
          if (!b) return null;

          const avatarSrc = resolveAvatarSrc(p.avatarUrl, p.avatarUpdatedAt);

          return (
            <motion.div
              key={`bubble-${p.id}-${idx}`}
              className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-auto"
              style={{
                left: `${b.left}%`,
                top: `${b.top}%`,
                zIndex: b.z
              }}
              initial={{ opacity: 0, scale: b.scale * 0.7, y: 10 }}
              animate={{
                opacity: 1,
                scale: b.scale,
                y: [0, -3, 0]
              }}
              transition={{
                opacity: { duration: 0.35, delay: b.delay },
                scale: { duration: 0.35, delay: b.delay },
                y: { duration: 2.5 + (idx % 3) * 0.4, repeat: Infinity, ease: 'easeInOut' }
              }}
            >
              <button
                onClick={async () => {
                  const targetInPrison = isPlayerImprisoned(p as any);
                  if (isAnyPrisonLocked || targetInPrison) {
                    const result = await startRoleplaySession(p as any);
                    if (!result?.ok) {
                      showToast(result?.message || '当前无法发起对戏');
                    }
                    return;
                  }
                  setInteractTarget(p);
                }}
                className="group relative"
                title={`与 ${p.name} 互动`}
              >
                <div
                  className="rounded-full overflow-hidden border-2 border-sky-300/70 bg-slate-800 shadow-[0_0_22px_rgba(56,189,248,0.38)] group-hover:scale-110 group-hover:border-sky-200 transition-all"
                  style={{
                    width: `${46 * b.scale}px`,
                    height: `${46 * b.scale}px`,
                    opacity: 0.78 + b.depth * 0.22
                  }}
                >
                  {avatarSrc ? (
                    <img src={avatarSrc} className="w-full h-full object-cover" alt={p.name || 'avatar'} />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-white font-black text-lg">
                      {(p.name || '?')[0]}
                    </div>
                  )}
                </div>

                <span
                  className="absolute bottom-0 right-0 rounded-full bg-emerald-400 border border-white animate-pulse"
                  style={{ width: `${8 * b.scale}px`, height: `${8 * b.scale}px` }}
                />

                <div
                  className="absolute left-1/2 -translate-x-1/2 mt-1 px-2 py-1 rounded-lg text-[10px] font-bold whitespace-nowrap
                                bg-slate-900/90 border border-slate-700 text-slate-100 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  {p.name}
                  {isPlayerImprisoned(p) ? ' · 在押' : ''}
                </div>
              </button>
            </motion.div>
          );
        })}

        {localPlayers.length === 0 && activeView && (
          <div
            className="absolute right-4 top-4 pointer-events-none px-3 py-1.5 rounded-lg text-[11px] font-bold
                          bg-slate-900/80 border border-slate-700 text-slate-400"
          >
            当前地点暂无其他玩家
          </div>
        )}
      </div>

      {/* 桌面端：当前地图 + 同地区信息面板 */}
      <div className={`${showWorldMapOverlayUi ? 'hidden md:block' : 'hidden'} fixed right-4 top-24 z-40`}>
        <div className="flex justify-end mb-2">
          <button
            onClick={() => setDesktopContextCollapsed((v) => !v)}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-[11px] font-black bg-slate-900/88 border border-slate-700 text-slate-100 hover:bg-slate-800"
          >
            {desktopContextCollapsed ? <Maximize2 size={13} /> : <Minimize2 size={13} />}
            {desktopContextCollapsed ? '展开地区信息' : '收起地区信息'}
          </button>
        </div>

        {!desktopContextCollapsed && (
          <>
            <div className="bg-slate-900/88 backdrop-blur-md border border-slate-700 rounded-2xl shadow-xl w-[320px] overflow-hidden">
              <button
                onClick={() => setShowAreaPanel((v) => !v)}
                className="w-full px-4 py-3 text-xs font-black text-slate-100 border-b border-slate-700 flex items-center justify-between hover:bg-slate-800/80"
              >
                <span className="flex items-center gap-2">
                  <MapPin size={14} /> 当前地图面板
                </span>
                <span className="inline-flex items-center gap-2 text-[11px] text-sky-300">
                  {currentLocationName}
                  {showAreaPanel ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
                </span>
              </button>

              {showAreaPanel && (
                <div className="p-4 space-y-3">
                  <div>
                    <div className="text-lg font-black text-white">{currentLocationName}</div>
                    <div className="text-[11px] text-slate-300 mt-1 leading-relaxed">{currentLocationDesc}</div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`px-2 py-1 rounded-lg text-[10px] font-bold border ${
                        (currentLocationMeta?.type || 'safe') === 'safe'
                          ? 'text-emerald-300 border-emerald-500/40 bg-emerald-500/10'
                          : 'text-rose-300 border-rose-500/40 bg-rose-500/10'
                      }`}
                    >
                      {(currentLocationMeta?.type || 'safe') === 'safe' ? '安全区' : '危险区'}
                    </span>
                    <span className="px-2 py-1 rounded-lg text-[10px] font-bold border border-sky-500/40 bg-sky-500/10 text-sky-200">
                      同地区玩家 {localPlayers.length}
                    </span>
                    <span className="px-2 py-1 rounded-lg text-[10px] font-bold border border-emerald-500/40 bg-emerald-500/10 text-emerald-200">
                      同地区非玩家角色 {locationNpcs.length}
                    </span>
                  </div>
                  <button
                    onClick={handleGroupRoleplayButtonClick}
                    className={`w-full px-3 py-2 rounded-xl text-xs font-black border transition-colors ${
                      isGroupRPInCurrentLocation
                        ? 'bg-sky-600/25 border-sky-500/60 text-sky-100 hover:bg-sky-600/35'
                        : 'bg-slate-800 border-slate-600 text-slate-100 hover:bg-slate-700'
                    }`}
                  >
                    {isGroupRPInCurrentLocation ? '打开当前地图群戏' : '加入当前地图群戏'}
                  </button>
                </div>
              )}
            </div>

            <div className="mt-3 bg-slate-900/85 backdrop-blur-md border border-slate-700 rounded-2xl shadow-xl w-[320px] overflow-hidden">
              <button
                onClick={() => setShowPlayersPanel((v) => !v)}
                className="w-full px-3 py-2 text-xs font-black text-slate-200 border-b border-slate-700 flex items-center justify-between hover:bg-slate-800/80"
              >
                <span className="flex items-center gap-2">
                  <Users size={14} /> 同地区玩家
                </span>
                <span className="text-sky-400">{localPlayers.length}</span>
              </button>

              {showPlayersPanel && (
                <div className="max-h-64 overflow-y-auto p-2 space-y-2 custom-scrollbar">
                  {localPlayers.length === 0 ? (
                    <div className="text-[11px] text-slate-500 text-center py-3">当前区域暂无其他玩家</div>
                  ) : (
                    localPlayers.map((p: any) => {
                      const avatarSrc = resolveAvatarSrc(p.avatarUrl, p.avatarUpdatedAt);
                      const targetInPrison = isPlayerImprisoned(p);
                      const secondaryLabel = targetInPrison
                        ? (Number(p.towerGuardImprisoned || 0) === 1 ? '守塔会地下监牢在押' : '灵异监牢收容中')
                        : (p.job || p.role || '自由人');
                      return (
                        <button
                          key={p.id}
                          onClick={async () => {
                            if (isAnyPrisonLocked || targetInPrison) {
                              const result = await startRoleplaySession(p as any);
                              if (!result?.ok) {
                                showToast(result?.message || '当前无法发起对戏');
                              }
                              return;
                            }
                            setInteractTarget(p);
                          }}
                          className="w-full flex items-center gap-2 p-2 rounded-xl bg-slate-800/70 border border-slate-700 hover:border-sky-500 hover:bg-slate-800 transition-all text-left"
                        >
                          <div className="w-9 h-9 rounded-full overflow-hidden border border-slate-600 bg-slate-700 shrink-0">
                            {avatarSrc ? (
                              <img src={avatarSrc} className="w-full h-full object-cover" alt={p.name || 'avatar'} />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-white text-xs font-black">
                                {(p.name || '?')[0]}
                              </div>
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-black text-white truncate">{p.name}</div>
                            <div className={`text-[10px] truncate ${targetInPrison ? 'text-rose-300' : 'text-slate-400'}`}>
                              {secondaryLabel}
                            </div>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              )}
            </div>

            <div className="mt-3 bg-slate-900/85 backdrop-blur-md border border-slate-700 rounded-2xl shadow-xl w-[320px] overflow-hidden">
              <button
                onClick={() => setShowNpcPanel((v) => !v)}
                className="w-full px-3 py-2 text-xs font-black text-slate-200 border-b border-slate-700 flex items-center justify-between hover:bg-slate-800/80"
              >
                <span className="flex items-center gap-2">
                  <UserRound size={14} /> 同区域非玩家角色
                </span>
                <span className="text-emerald-300">{locationNpcs.length}</span>
              </button>

              {showNpcPanel && (
                <div className="max-h-56 overflow-y-auto p-2 space-y-2 custom-scrollbar">
                  {locationNpcs.length === 0 ? (
                    <div className="text-[11px] text-slate-500 text-center py-3">
                      {activeView ? '当前区域暂无可见角色' : '进入地区后显示当前小地图角色'}
                    </div>
                  ) : (
                    locationNpcs.map((npc: any) => {
                      const affinity = Number(npc?.affinity || 0);
                      const affinityColor =
                        affinity >= 80 ? 'text-emerald-300' : affinity >= 60 ? 'text-sky-300' : affinity <= 30 ? 'text-rose-300' : 'text-amber-300';
                      return (
                        <button
                          key={String(npc.id || '')}
                          onClick={() => setInteractNpc(npc)}
                          className="w-full flex items-center gap-2 p-2 rounded-xl bg-slate-800/70 border border-slate-700 hover:border-emerald-500 hover:bg-slate-800 transition-all text-left"
                        >
                          <div className="w-9 h-9 rounded-full border border-slate-600 bg-slate-700 shrink-0 flex items-center justify-center text-slate-100">
                            <UserRound size={16} />
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-black text-white truncate">{String(npc.name || '未知角色')}</div>
                            <div className="text-[10px] text-slate-400 truncate">{String(npc.skillFaction || '通用')} · {String(npc.personality || '神秘')}</div>
                            <div className={`text-[10px] font-bold ${affinityColor}`}>
                              好感 {affinity} · {String(npc.affinityStage || '中立')}
                            </div>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* 移动端：同地区信息面板（可折叠） */}
      <div className={`${showWorldMapOverlayUi ? 'md:hidden' : 'hidden'} fixed left-3 right-3 bottom-20 z-[165] pointer-events-none`}>
        {!mobileContextCollapsed && (
          <div className="pointer-events-auto bg-slate-900/92 backdrop-blur-xl border border-slate-700 rounded-2xl shadow-2xl overflow-hidden">
            <div className="px-3 py-2 border-b border-slate-700 flex items-center justify-between">
              <div className="text-xs font-black text-slate-100">同地区信息</div>
              <button
                onClick={() => setMobileContextCollapsed(true)}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold text-slate-300 border border-slate-600 bg-slate-800 hover:bg-slate-700"
              >
                <Minimize2 size={12} /> 收起
              </button>
            </div>

            <div className="max-h-[44vh] overflow-y-auto p-2 space-y-2 custom-scrollbar">
              <div className="rounded-xl border border-slate-700 bg-slate-800/70 overflow-hidden">
                <button
                  onClick={() => setShowAreaPanel((v) => !v)}
                  className="w-full px-3 py-2 text-xs font-black text-slate-200 border-b border-slate-700/80 flex items-center justify-between hover:bg-slate-800"
                >
                  <span className="flex items-center gap-2">
                    <MapPin size={14} /> 地区信息
                  </span>
                  <span className="inline-flex items-center gap-2 text-[10px] text-sky-300">
                    {currentLocationName}
                    {showAreaPanel ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
                  </span>
                </button>
                {showAreaPanel && (
                  <div className="p-3">
                    <div className="text-sm font-black text-white">{currentLocationName}</div>
                    <div className="text-[11px] text-slate-300 mt-1 leading-relaxed">{currentLocationDesc}</div>
                    <div className="flex items-center gap-2 flex-wrap mt-2">
                      <span
                        className={`px-2 py-1 rounded-lg text-[10px] font-bold border ${
                          (currentLocationMeta?.type || 'safe') === 'safe'
                            ? 'text-emerald-300 border-emerald-500/40 bg-emerald-500/10'
                            : 'text-rose-300 border-rose-500/40 bg-rose-500/10'
                        }`}
                      >
                        {(currentLocationMeta?.type || 'safe') === 'safe' ? '安全区' : '危险区'}
                      </span>
                      <span className="px-2 py-1 rounded-lg text-[10px] font-bold border border-sky-500/40 bg-sky-500/10 text-sky-200">
                        玩家 {localPlayers.length}
                      </span>
                      <span className="px-2 py-1 rounded-lg text-[10px] font-bold border border-emerald-500/40 bg-emerald-500/10 text-emerald-200">
                        非玩家角色 {locationNpcs.length}
                      </span>
                    </div>
                    <button
                      onClick={handleGroupRoleplayButtonClick}
                      className={`w-full mt-2 px-3 py-2 rounded-xl text-xs font-black border transition-colors ${
                        isGroupRPInCurrentLocation
                          ? 'bg-sky-600/25 border-sky-500/60 text-sky-100'
                          : 'bg-slate-800 border-slate-600 text-slate-100'
                      }`}
                    >
                      {isGroupRPInCurrentLocation ? '打开当前地图群戏' : '加入当前地图群戏'}
                    </button>
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-slate-700 bg-slate-800/70 overflow-hidden">
                <button
                  onClick={() => setShowPlayersPanel((v) => !v)}
                  className="w-full px-3 py-2 text-xs font-black text-slate-200 border-b border-slate-700/80 flex items-center justify-between hover:bg-slate-800"
                >
                  <span className="flex items-center gap-2">
                    <Users size={14} /> 同地区玩家
                  </span>
                  <span className="text-sky-400">{localPlayers.length}</span>
                </button>
                {showPlayersPanel && (
                  <div className="max-h-40 overflow-y-auto p-2 space-y-2 custom-scrollbar">
                    {localPlayers.length === 0 ? (
                      <div className="text-[11px] text-slate-500 text-center py-3">当前区域暂无其他玩家</div>
                    ) : (
                      localPlayers.map((p: any) => {
                        const avatarSrc = resolveAvatarSrc(p.avatarUrl, p.avatarUpdatedAt);
                        const targetInPrison = isPlayerImprisoned(p);
                        const secondaryLabel = targetInPrison
                          ? (Number(p.towerGuardImprisoned || 0) === 1 ? '守塔会地下监牢在押' : '灵异监牢收容中')
                          : (p.job || p.role || '自由人');
                        return (
                          <button
                            key={p.id}
                            onClick={async () => {
                              if (isAnyPrisonLocked || targetInPrison) {
                                const result = await startRoleplaySession(p as any);
                                if (!result?.ok) {
                                  showToast(result?.message || '当前无法发起对戏');
                                }
                                return;
                              }
                              setInteractTarget(p);
                            }}
                            className="w-full flex items-center gap-2 p-2 rounded-xl bg-slate-800/60 border border-slate-700 hover:border-sky-500 transition-all text-left"
                          >
                            <div className="w-8 h-8 rounded-full overflow-hidden border border-slate-600 bg-slate-700 shrink-0">
                              {avatarSrc ? (
                                <img src={avatarSrc} className="w-full h-full object-cover" alt={p.name || 'avatar'} />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-white text-xs font-black">
                                  {(p.name || '?')[0]}
                                </div>
                              )}
                            </div>
                            <div className="min-w-0">
                              <div className="text-xs font-black text-white truncate">{p.name}</div>
                              <div className={`text-[10px] truncate ${targetInPrison ? 'text-rose-300' : 'text-slate-400'}`}>
                                {secondaryLabel}
                              </div>
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-slate-700 bg-slate-800/70 overflow-hidden">
                <button
                  onClick={() => setShowNpcPanel((v) => !v)}
                  className="w-full px-3 py-2 text-xs font-black text-slate-200 border-b border-slate-700/80 flex items-center justify-between hover:bg-slate-800"
                >
                  <span className="flex items-center gap-2">
                    <UserRound size={14} /> 同区域非玩家角色
                  </span>
                  <span className="text-emerald-300">{locationNpcs.length}</span>
                </button>
                {showNpcPanel && (
                  <div className="max-h-40 overflow-y-auto p-2 space-y-2 custom-scrollbar">
                    {locationNpcs.length === 0 ? (
                      <div className="text-[11px] text-slate-500 text-center py-3">
                        {activeView ? '当前区域暂无可见角色' : '进入地区后显示当前小地图角色'}
                      </div>
                    ) : (
                      locationNpcs.map((npc: any) => {
                        const affinity = Number(npc?.affinity || 0);
                        const affinityColor =
                          affinity >= 80 ? 'text-emerald-300' : affinity >= 60 ? 'text-sky-300' : affinity <= 30 ? 'text-rose-300' : 'text-amber-300';
                        return (
                          <button
                            key={String(npc.id || '')}
                            onClick={() => setInteractNpc(npc)}
                            className="w-full flex items-center gap-2 p-2 rounded-xl bg-slate-800/60 border border-slate-700 hover:border-emerald-500 transition-all text-left"
                          >
                            <div className="w-8 h-8 rounded-full border border-slate-600 bg-slate-700 shrink-0 flex items-center justify-center text-slate-100">
                              <UserRound size={14} />
                            </div>
                            <div className="min-w-0">
                              <div className="text-xs font-black text-white truncate">{String(npc.name || '未知角色')}</div>
                              <div className="text-[10px] text-slate-400 truncate">{String(npc.skillFaction || '通用')} · {String(npc.personality || '神秘')}</div>
                              <div className={`text-[10px] font-bold ${affinityColor}`}>
                                好感 {affinity} · {String(npc.affinityStage || '中立')}
                              </div>
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <AnimatePresence>
        {showWildExplore && (
          <WildHuntView
            user={actor}
            onClose={() => {
              setShowWildExplore(false);
              fetchGlobalData();
            }}
            onDefeatReturn={(returnLocation?: string) => {
              setShowWildExplore(false);
              setActiveView(null);
              setSelectedLocation(null);
              const backName =
                mapLocations.find((x) => String(x.id) === String(returnLocation || ''))?.name ||
                (returnLocation ? String(returnLocation) : '城中');
              showToast(`战败后已返回：${backName}`);
              fetchGlobalData();
            }}
            showToast={showToast}
            fetchGlobalData={fetchGlobalData}
          />
        )}
      </AnimatePresence>

      {/* 地点详情弹窗 */}
      <AnimatePresence>
        {selectedLocation && !activeView && (
          <motion.div
            initial={{ y: 100 }}
            animate={{ y: 0 }}
            exit={{ y: 100 }}
            className="fixed bottom-0 left-0 right-0 max-h-[86vh] md:bottom-10 md:left-1/2 md:-translate-x-1/2 md:w-[450px] bg-slate-900/95 backdrop-blur-xl p-6 rounded-t-3xl md:rounded-3xl border-t md:border border-white/20 z-50 shadow-2xl overflow-y-auto custom-scrollbar mobile-portrait-safe-sheet mobile-contrast-surface-dark"
          >
            <div className="absolute inset-0 rounded-[2rem] overflow-hidden -z-10 opacity-30">
              <img
                src={selectedLocation.mapImageUrl || customBackgroundImage || LOCATION_BG_MAP[selectedLocation.id] || globalMapBackground}
                className="w-full h-full object-cover blur-md scale-110"
              />
            </div>

            <div className="flex justify-between items-start">
              <div className="flex-1">
                <h3 className="text-2xl font-black text-white mb-2 flex items-center gap-2">
                  {shouldApplyMinorTravelRestriction && !isSafeLocationId(String(selectedLocation?.id || '')) ? '迷雾区域' : selectedLocation.name}
                  <span
                    className={`text-[10px] px-2 py-1 rounded-lg border backdrop-blur-sm ${
                      selectedLocation.type === 'safe'
                        ? 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10'
                        : 'text-rose-300 border-rose-500/30 bg-rose-500/10'
                    }`}
                  >
                    {selectedLocation.type === 'safe' ? '安全区' : '危险区'}
                  </span>
                </h3>
                <p className="text-sm text-slate-300 leading-relaxed mb-6 font-medium">
                  {shouldApplyMinorTravelRestriction && !isSafeLocationId(String(selectedLocation?.id || ''))
                    ? '这里雾蒙蒙的，仿佛有迷雾笼罩。真的要去吗？'
                    : selectedLocation.description}
                </p>

                <div className="flex gap-3">
                  <button
                    onClick={() => handleLocationAction('enter')}
                    className="flex-1 px-6 py-3.5 bg-white text-slate-950 font-black rounded-xl text-sm hover:bg-slate-200 transition-colors shadow-[0_0_20px_rgba(255,255,255,0.2)]"
                  >
                    进入区域
                  </button>
                  <button
                    onClick={() => handleLocationAction('stay')}
                    className="flex-1 px-6 py-3.5 bg-slate-800/80 text-white font-black rounded-xl text-sm hover:bg-slate-700 transition-colors border border-slate-600"
                  >
                    在此驻足
                  </button>
                </div>

                <button
                  onClick={async () => {
                    if (String(effectiveLocationId || '') !== String(selectedLocation.id || '')) {
                      showToast('请先进入该区域后再加入群戏');
                      return;
                    }
                    await handleGroupRoleplayButtonClick();
                  }}
                  className={`w-full mt-2 px-4 py-3 rounded-xl text-xs font-black border transition-all ${
                    isGroupRPInCurrentLocation
                      ? 'bg-sky-600/20 text-sky-200 border-sky-500/40 hover:bg-sky-600/30'
                      : 'bg-slate-800/80 text-slate-100 border-slate-600 hover:bg-slate-700'
                  }`}
                >
                  {isGroupRPInCurrentLocation ? '打开当前地图群戏' : '加入该地图群戏'}
                </button>

                <div className="grid grid-cols-2 gap-2 mt-3">
                  <button
                    onClick={handleExploreSkill}
                    className="w-full px-4 py-3 bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-bold rounded-xl text-xs hover:bg-indigo-500 hover:text-white transition-all"
                  >
                    🧠 领悟派系技能
                  </button>
                  <button
                    onClick={handleExploreItem}
                    className="w-full px-4 py-3 bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold rounded-xl text-xs hover:bg-amber-500 hover:text-white transition-all"
                  >
                    📦 搜索区域物资
                  </button>
                </div>

                {selectedLocation.type === 'danger' && (
                  <button
                    onClick={() => {
                      if (isAnyPrisonLocked) {
                        showToast('收容状态下无法进入界域探索。');
                        return;
                      }
                      setSelectedLocation(null);
                      setActiveView(null);
                      setShowWildExplore(true);
                    }}
                    className="w-full mt-2 px-4 py-3 bg-rose-600/20 text-rose-300 border border-rose-500/30 font-black rounded-xl text-xs hover:bg-rose-600 hover:text-white transition-all flex items-center justify-center gap-2"
                  >
                    <Skull size={14} /> 进入界外打怪界面
                  </button>
                )}
              </div>
              <button
                onClick={() => setSelectedLocation(null)}
                className="p-2 -mr-2 -mt-2 text-slate-400 hover:text-white bg-slate-800/50 hover:bg-slate-700 rounded-full transition-colors backdrop-blur-sm"
              >
                <X size={20} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {pendingFactionPoint && !activeView && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[240] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm"
          >
            <div className="theme-elevated-surface w-full max-w-2xl rounded-[2rem] border p-5 shadow-2xl">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-xl font-black text-slate-100">建立新的自定义势力</div>
                  <div className="mt-1 text-xs text-slate-400">地图坐标：{pendingFactionPoint.x}% / {pendingFactionPoint.y}%</div>
                </div>
                <button
                  onClick={() => setPendingFactionPoint(null)}
                  className="rounded-full bg-slate-800 px-3 py-2 text-xs font-black text-slate-200 hover:bg-slate-700"
                >
                  取消
                </button>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <input
                  value={customFactionForm.name}
                  onChange={(event) => setCustomFactionForm((prev) => ({ ...prev, name: event.target.value }))}
                  placeholder="势力名称"
                  className="rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-slate-100 outline-none focus:border-sky-500"
                />
                <input
                  value={customFactionForm.mapImageUrl}
                  onChange={(event) => setCustomFactionForm((prev) => ({ ...prev, mapImageUrl: event.target.value }))}
                  placeholder="地图图片地址，例如 /new/faction-map.jpg"
                  className="rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-slate-100 outline-none focus:border-sky-500"
                />
                <textarea
                  value={customFactionForm.description}
                  onChange={(event) => setCustomFactionForm((prev) => ({ ...prev, description: event.target.value }))}
                  placeholder="输入势力介绍、规则、气氛与定位。"
                  className="min-h-[120px] rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-slate-100 outline-none focus:border-sky-500 md:col-span-2"
                />
              </div>

              {customFactionAssets.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {customFactionAssets.slice(0, 8).map((asset: any) => (
                    <button
                      key={String(asset?.url || '')}
                      onClick={() => setCustomFactionForm((prev) => ({ ...prev, mapImageUrl: String(asset?.url || '') }))}
                      className="rounded-full border border-slate-600 px-3 py-1 text-[11px] text-slate-300 hover:border-sky-500 hover:text-sky-200"
                    >
                      {String(asset?.name || asset?.url || '地图素材')}
                    </button>
                  ))}
                </div>
              )}

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <div className="rounded-2xl border border-amber-400/30 bg-amber-100/10 px-3 py-2 text-xs text-amber-100">
                  创建费用：50000G。金币不足或仍处于其他阵营时将无法建立。
                </div>
                <button
                  onClick={createCustomFaction}
                  disabled={creatingFaction}
                  className="rounded-2xl bg-sky-600 px-4 py-2.5 text-sm font-black text-white hover:bg-sky-500 disabled:opacity-60"
                >
                  {creatingFaction ? '创建中...' : '确认建立新势力'}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <TradeRequestPanel
        requests={!isAnyPrisonLocked ? pendingTradeRequests : []}
        busyRequestId={respondingTradeRequestId}
        onRespond={respondTradeRequest}
      />

      {activeTradeSessionId && !isAnyPrisonLocked && (
        <TradeWindow
          sessionId={activeTradeSessionId}
          currentUser={actor}
          showToast={showToast}
          fetchGlobalData={fetchGlobalData}
          onClose={() => {
            dismissedTradeSessionIdRef.current = String(activeTradeSessionId || '');
            setActiveTradeSessionId(null);
          }}
        />
      )}

      {/* 玩家交互弹窗 */}
      <AnimatePresence>
        {interactTarget && !isAnyPrisonLocked && (
          <PlayerInteractionUI
            currentUser={actor}
            targetUser={interactTarget}
            onClose={() => setInteractTarget(null)}
            showToast={showToast}
            onStartRP={async (target) => {
              return await startRoleplaySession(target);
            }}
            onOpenGroupRoleplay={async () => {
              return await openGroupRoleplayFromInteraction();
            }}
            onRequestTrade={requestTradeWithUser}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {interactNpc && (
          <NpcInteractionUI
            currentUser={actor}
            npc={interactNpc}
            onClose={() => setInteractNpc(null)}
            showToast={showToast}
            onUpdated={async () => {
              try {
                const res = await fetch(`/api/world/npcs?userId=${actor.id}`, { cache: 'no-store' });
                const data = await res.json().catch(() => ({} as any));
                if (res.ok && data.success !== false) {
                  setWorldNpcs(Array.isArray(data.npcs) ? data.npcs : []);
                }
              } catch {
                // ignore
              }
              fetchGlobalData();
            }}
          />
        )}
      </AnimatePresence>

      {(actor.status === 'pending_death' || actor.status === 'pending_ghost') && (
        <div className="fixed inset-0 z-[99999] bg-slate-950/95 flex flex-col items-center justify-center p-6 text-center backdrop-blur-md">
          <Skull size={64} className="text-slate-600 mb-6 animate-pulse" />
          <h1 className="text-3xl font-black text-white mb-4 tracking-widest">命运审视中</h1>
          <p className="text-slate-400 font-bold max-w-md leading-relaxed">
            您的谢幕戏正在递交至「塔」的最高议会。
            <br />
            在获得批准前，您的灵魂被锁定于此。
          </p>
        </div>
      )}

      <AnimatePresence>
        {isDying && actor.status === 'approved' && (
          <div className="fixed inset-0 z-[9999] bg-red-950/90 flex items-center justify-center p-4 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-black border border-red-900 p-8 rounded-[32px] w-full max-w-md text-center shadow-[0_0_100px_rgba(220,38,38,0.3)]"
            >
              <Heart size={48} className="text-red-600 mx-auto mb-4 animate-pulse" />
              <h2 className="text-2xl font-black text-red-500 mb-2">生命体征已消失</h2>
              <p className="text-slate-400 text-sm mb-8">黑暗正在吞噬你的意识...</p>

              <div className="space-y-3">
                <button
                  onClick={handleStruggle}
                  disabled={rescueReqId !== null}
                  className="w-full py-4 bg-red-600 text-white rounded-2xl font-black hover:bg-red-500 transition-colors disabled:opacity-50"
                >
                  {rescueReqId ? '正在等待向导回应...' : '挣扎 (向区域内治疗向导求救)'}
                </button>
                <button
                  onClick={() => {
                    setIsDying(false);
                    setShowDeathForm('death');
                  }}
                  className="w-full py-4 bg-slate-900 text-slate-400 rounded-2xl font-bold hover:bg-slate-800 transition-colors"
                >
                  拥抱死亡 (生成墓碑)
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 右下功能按钮 */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3">
        <button
          onClick={() => {
            if (isAnyPrisonLocked) {
              showToast('收容状态下无法进行该互动。');
              return;
            }
            fetchGraveyard();
          }}
          className={`p-3.5 backdrop-blur-md border rounded-full transition-all shadow-lg group relative ${
            isAnyPrisonLocked
              ? 'bg-slate-900/70 border-slate-800 text-slate-600 cursor-not-allowed'
              : 'bg-slate-900/80 border-slate-600 text-slate-300 hover:text-white hover:bg-sky-600 hover:border-sky-400 hover:scale-110'
          }`}
        >
          <Cross size={20} />
          <span className="absolute right-full mr-3 top-1/2 -translate-y-1/2 px-2 py-1 bg-black text-white text-[10px] rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none">
            世界公墓
          </span>
        </button>
        <button
          onClick={() => {
            if (isAnyPrisonLocked) {
              showToast('收容状态下无法进行该互动。');
              return;
            }
            setShowSettings(!showSettings);
          }}
          className={`p-3.5 backdrop-blur-md border rounded-full transition-all shadow-lg group relative ${
            isAnyPrisonLocked
              ? 'bg-slate-900/70 border-slate-800 text-slate-600 cursor-not-allowed'
              : 'bg-slate-900/80 border-slate-600 text-slate-300 hover:text-white hover:bg-slate-700 hover:scale-110'
          }`}
        >
          <Settings size={20} />
          <span className="absolute right-full mr-3 top-1/2 -translate-y-1/2 px-2 py-1 bg-black text-white text-[10px] rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none">
            设置/谢幕
          </span>
        </button>
      </div>
      {/* 左下交互功能区（移动端收起后横向一行） */}
      <div className={`${showWorldMapOverlayUi ? 'flex' : 'hidden'} fixed bottom-4 left-3 right-3 md:bottom-6 md:left-6 md:right-auto z-[160] items-center gap-2 md:flex-col md:items-stretch overflow-x-auto`}>
        <button
          onClick={() => {
            if (isAnyPrisonLocked) {
              showToast('收容状态下无法进入界域探索。');
              return;
            }
            setSelectedLocation(null);
            setActiveView(null);
            setShowWildExplore(true);
          }}
          className={`shrink-0 px-3 md:px-4 py-2.5 md:py-3 rounded-2xl font-black text-[11px] md:text-xs shadow-xl inline-flex items-center gap-1.5 ${
            isAnyPrisonLocked
              ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
              : 'bg-rose-600 text-white hover:bg-rose-500'
          }`}
        >
          <Gamepad2 size={14} />
          <span className="md:hidden">界域探索</span>
          <span className="hidden md:inline">前往界域探索</span>
        </button>

        <button
          onClick={() => setMobileContextCollapsed((v) => !v)}
          className="md:hidden shrink-0 px-3 py-2.5 rounded-2xl font-black text-[11px] shadow-xl inline-flex items-center gap-1.5 bg-slate-800 text-slate-100 border border-slate-600"
        >
          {mobileContextCollapsed ? <Maximize2 size={14} /> : <Minimize2 size={14} />}
          {mobileContextCollapsed ? '展开地区' : '收起地区'}
        </button>

        {canUseGuardArrestSkill && (
          <button
            onClick={handleGuardArrestSkill}
            disabled={isAnyPrisonLocked}
            className={`shrink-0 px-3 md:px-4 py-2.5 md:py-3 rounded-2xl font-black text-[11px] md:text-xs shadow-xl transition-all ${
              isAnyPrisonLocked
                ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                : 'bg-rose-700 text-white hover:bg-rose-600'
            }`}
          >
            <span className="md:hidden">守塔抓捕</span>
            <span className="hidden md:inline">守塔抓捕技能（先点选目标）</span>
          </button>
        )}
        {guardArrestPendingCase &&
          Number(guardArrestPendingCase.targetUserId || 0) === Number(actor.id || 0) &&
          String(guardArrestPendingCase.status || '') === 'pending_review' &&
          String(guardArrestPendingCase.cancelStatus || 'none') !== 'pending' && (
            <button
              onClick={() => submitGuardArrestCancel(Number(guardArrestPendingCase.id || 0))}
              className="shrink-0 px-3 md:px-4 py-2.5 md:py-3 rounded-2xl font-black text-[11px] md:text-xs shadow-xl transition-all bg-amber-600 text-white hover:bg-amber-500"
            >
              <span className="md:hidden">撤销抓捕</span>
              <span className="hidden md:inline">提交撤销抓捕申请</span>
            </button>
          )}
        {canUseTowerPurify && (
          <button
            onClick={handlePurifyErosion}
            disabled={isAnyPrisonLocked}
            className={`shrink-0 px-3 md:px-4 py-2.5 md:py-3 rounded-2xl font-black text-[11px] md:text-xs shadow-xl transition-all ${
              isAnyPrisonLocked
                ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                : 'bg-emerald-600 text-white hover:bg-emerald-500'
            }`}
          >
            <span className="md:hidden">净化侵蚀</span>
            <span className="hidden md:inline">净化侵蚀（职位净化率 {Math.round(towerPurifyRate * 100)}%）</span>
          </button>
        )}
        <button
          onClick={handleGroupRoleplayButtonClick}
          className={`shrink-0 px-3 md:px-4 py-2.5 md:py-3 rounded-2xl font-black text-[11px] md:text-xs shadow-xl transition-all ${
            isGroupRPInCurrentLocation ? 'bg-cyan-600 text-white hover:bg-cyan-500' : 'bg-slate-700 text-slate-200 hover:bg-slate-600'
          }`}
        >
          <span className="md:hidden">群戏</span>
          <span className="hidden md:inline">
            群戏聊天{groupRPJoinedLocationName ? ` · ${groupRPJoinedLocationName}` : ''}
          </span>
        </button>
        <button
          onClick={() => {
            if (!rpSessionCount) {
              showToast('当前没有活跃对戏会话');
              return;
            }
            if (!rpSessionId && rpSessions[0]) setRPSessionId(rpSessions[0].sessionId);
            setRPWindowOpen((v) => !v);
            setRPPing(false);
          }}
          className={`relative shrink-0 px-3 md:px-4 py-2.5 md:py-3 rounded-2xl font-black text-[11px] md:text-xs shadow-xl transition-all ${
            rpSessionCount ? 'bg-sky-600 text-white hover:bg-sky-500' : 'bg-slate-700 text-slate-300'
          }`}
        >
          <span className="md:hidden">对戏{rpSessionCount > 1 ? `·${rpSessionCount}` : rpPeerName ? `·${rpPeerName}` : ""}</span>
          <span className="hidden md:inline">对戏聊天{rpPeerName ? ` · ${rpPeerName}` : ""}{rpSessionCount > 1 ? ` 等${rpSessionCount}场` : ""}</span>
          {rpPing && !rpWindowOpen && (
            <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-rose-500 border border-white" />
          )}
        </button>
      </div>

      {/* 设置弹窗 */}
      <AnimatePresence>
        {showSettings && !showDeathForm && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed bottom-24 right-4 md:right-6 w-[92vw] max-w-sm bg-slate-900/95 backdrop-blur-xl border border-slate-700 rounded-2xl p-4 shadow-2xl z-50 settings-scroll mobile-portrait-safe-card mobile-contrast-surface-dark"
          >
            <h4 className="text-xs font-black text-slate-400 uppercase mb-3 px-2">主题与命运设置</h4>

            <div className="space-y-3 mb-4 pb-4 border-b border-slate-700/60">
              <div className="flex items-center gap-2 text-xs font-black text-slate-300">
                <Palette size={14} /> 主题模板
              </div>
              <div className="grid grid-cols-5 gap-1.5">
                {UI_THEME_PRESETS.map((preset) => {
                  const SWATCH: Record<string, string[]> = {
                    holy_glass:      ['#f0f4ff','#4f8eff','#dfe7f5'],
                    crystal_glass:   ['#dff4ff','#1e90ff','#d1e2fc'],
                    pink_sweet:      ['#ffd8ee','#ff63b0','#efbad8'],
                    cyber_blue:      ['#142f50','#00d8ff','#050d1c'],
                    wasteland_brown: ['#f2ddbd','#b87437','#a37f54'],
                    ice_fairy:       ['#cdedfb','#3aaee0','#a4d4f0'],
                    apple_sweet:     ['#ffddd5','#d94040','#e8a9a0'],
                    cafe_parchment:  ['#f8edd8','#9a6030','#cba87a'],
                    botanical_green: ['#d4edce','#3a8f4a','#96c898'],
                    lavender_poem:   ['#e0cefc','#8a40d0','#b490d8'],
                  };
                  const sw = SWATCH[preset.id] || ['#888','#aaa','#ccc'];
                  const isActive = uiThemePreset === preset.id;
                  return (
                    <button
                      key={preset.id}
                      onClick={() => handleThemePresetApply(preset.id)}
                      title={`${preset.name}：${preset.desc}`}
                      className={`relative flex flex-col items-center gap-0.5 p-1 rounded-xl border transition-all ${
                        isActive
                          ? 'border-sky-400 ring-2 ring-sky-400/60 scale-105'
                          : 'border-slate-700 hover:border-slate-500'
                      }`}
                    >
                      <div className="w-full h-5 rounded-md overflow-hidden flex">
                        {sw.map((c, i) => (
                          <div key={i} className="flex-1" style={{ background: c }} />
                        ))}
                      </div>
                      <span className="text-[9px] text-slate-300 leading-tight text-center truncate w-full">{preset.name}</span>
                      {isActive && <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-sky-400 rounded-full border border-slate-900" />}
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center gap-2 text-xs font-black text-slate-300">
                <ImagePlus size={14} /> 背景图链接
              </div>
              <input
                type="text"
                value={bgImageInput}
                onChange={(e) => setBgImageInput(e.target.value)}
                placeholder="粘贴背景图地址（支持网页链接或站内图片路径）"
                className="w-full px-3 py-2 text-xs bg-slate-800/80 border border-slate-700 rounded-xl outline-none focus:border-sky-500"
              />
              <input
                ref={backgroundFileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (file) await handleImportBackgroundFile(file);
                  e.currentTarget.value = '';
                }}
              />
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => backgroundFileRef.current?.click()}
                  className="px-3 py-2 rounded-xl text-xs font-black bg-indigo-600 text-white hover:bg-indigo-500 transition-colors"
                >
                  上传图片
                </button>
                <button
                  onClick={handleBackgroundApply}
                  className="px-3 py-2 rounded-xl text-xs font-black bg-sky-600 text-white hover:bg-sky-500 transition-colors"
                >
                  应用背景
                </button>
                <button
                  onClick={handleBackgroundReset}
                  className="px-3 py-2 rounded-xl text-xs font-black bg-slate-700 text-slate-100 hover:bg-slate-600 transition-colors"
                >
                  恢复默认
                </button>
              </div>

              <div className="flex items-center gap-2 text-xs font-black text-slate-300">
                <Palette size={14} /> 自定义文字颜色
              </div>
              <div className="grid grid-cols-[52px_1fr] gap-2">
                <input
                  type="color"
                  value={/^#[0-9a-fA-F]{6}$/.test(customTextColor) ? customTextColor : '#142032'}
                  onChange={(e) => setCustomTextColorState(e.target.value)}
                  className="h-9 w-full rounded-xl border border-slate-700 bg-slate-800/80 p-1"
                />
                <input
                  type="text"
                  value={customTextColor}
                  onChange={(e) => setCustomTextColorState(e.target.value)}
                  placeholder="#142032"
                  className="w-full px-3 py-2 text-xs bg-slate-800/80 border border-slate-700 rounded-xl outline-none focus:border-sky-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={handleTextColorApply}
                  className="px-3 py-2 rounded-xl text-xs font-black bg-sky-600 text-white hover:bg-sky-500 transition-colors"
                >
                  应用文字色
                </button>
                <button
                  onClick={handleTextColorReset}
                  className="px-3 py-2 rounded-xl text-xs font-black bg-slate-700 text-slate-100 hover:bg-slate-600 transition-colors"
                >
                  恢复默认
                </button>
              </div>

              <div className="flex items-center gap-2 text-xs font-black text-slate-300">
                <Upload size={14} /> 自定义全局样式
              </div>
              <input
                ref={customCssFileRef}
                type="file"
                accept=".css,text/css"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (file) await handleImportCustomCssFile(file);
                  e.currentTarget.value = '';
                }}
              />
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => customCssFileRef.current?.click()}
                  className="px-3 py-2 rounded-xl text-xs font-black bg-indigo-600 text-white hover:bg-indigo-500 transition-colors"
                >
                  导入样式
                </button>
                <button
                  onClick={handleCustomCssReset}
                  className="px-3 py-2 rounded-xl text-xs font-black bg-slate-700 text-slate-100 hover:bg-slate-600 transition-colors"
                >
                  清空样式
                </button>
              </div>
              <textarea
                value={customCssText}
                onChange={(e) => setCustomCssTextState(e.target.value)}
                placeholder="可直接粘贴自定义样式代码..."
                className="w-full h-24 px-3 py-2 text-[11px] bg-slate-800/80 border border-slate-700 rounded-xl outline-none focus:border-sky-500 resize-none"
              />
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={handleCustomCssApply}
                  className="px-3 py-2 rounded-xl text-xs font-black bg-emerald-600 text-white hover:bg-emerald-500 transition-colors"
                >
                  应用样式
                </button>
                <button
                  onClick={handleThemeResetAll}
                  className="px-3 py-2 rounded-xl text-xs font-black bg-amber-600 text-white hover:bg-amber-500 transition-colors flex items-center justify-center gap-1"
                >
                  <RotateCcw size={12} /> 全部重置
                </button>
              </div>
            </div>

            <h4 className="text-xs font-black text-slate-400 uppercase mb-3 px-2">命运抉择</h4>
            <div className="space-y-2">
              <button
                onClick={() => setShowDeathForm('death')}
                className="w-full flex items-center gap-3 p-3 text-sm font-bold text-rose-400 bg-rose-500/10 rounded-xl hover:bg-rose-500/20 transition-colors"
              >
                <Skull size={16} /> 申请谢幕 (死亡)
              </button>
              {actor.role !== '鬼魂' && (
                <button
                  onClick={() => setShowDeathForm('ghost')}
                  className="w-full flex items-center gap-3 p-3 text-sm font-bold text-violet-400 bg-violet-500/10 rounded-xl hover:bg-violet-500/20 transition-colors"
                >
                  <Skull size={16} className="opacity-50" /> 转化鬼魂 (换皮)
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 公墓 */}
      <AnimatePresence>
        {showGraveyard && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
            <motion.div
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ opacity: 0 }}
              className="bg-slate-900 border border-slate-700 rounded-[32px] w-full max-w-3xl h-[80vh] flex flex-col shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
                <h2 className="text-2xl font-black text-white flex items-center gap-3">
                  <Cross className="text-slate-500" /> 世界公墓
                </h2>
                <button onClick={() => setShowGraveyard(false)} className="text-slate-500 hover:text-white">
                  <X size={24} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar bg-slate-950">
                {tombstones.length === 0 ? (
                  <div className="text-center py-20 text-slate-600 font-bold tracking-widest">目前无人长眠于此</div>
                ) : (
                  tombstones.map((t) => (
                    <div key={t.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 transition-all hover:border-slate-700">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h3 className="text-xl font-black text-slate-200">{t.name} 的墓碑</h3>
                          <div className="text-[10px] uppercase font-bold text-slate-500 mt-1 space-x-2">
                            <span>生前: {t.role}</span>
                            <span>
                              {t.mentalRank}/{t.physicalRank}
                            </span>
                            {t.spiritName && <span>精神体: {t.spiritName}</span>}
                          </div>
                        </div>
                        <button
                          onClick={() => loadComments(t.id)}
                          className="text-xs font-bold text-sky-500 bg-sky-500/10 px-3 py-1.5 rounded-lg hover:bg-sky-500/20"
                        >
                          {expandedTombstone === t.id ? '收起留言' : '献花/留言'}
                        </button>
                      </div>

                      <p className="text-sm text-slate-400 bg-slate-950 p-4 rounded-xl border border-slate-800/50 italic">"{t.deathDescription}"</p>

                      <AnimatePresence>
                        {expandedTombstone === t.id && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden"
                          >
                            <div className="mt-4 pt-4 border-t border-slate-800">
                              <div className="space-y-2 mb-4 max-h-40 overflow-y-auto custom-scrollbar">
                                {comments.length === 0 && <div className="text-xs text-slate-600">还没有人留下只言片语...</div>}
                                {comments.map((c) => (
                                  <div key={c.id} className="group flex justify-between items-start p-2 bg-slate-950/50 rounded-lg">
                                    <div className="text-xs">
                                      <span className="font-bold text-sky-400 mr-2">{c.userName}:</span>
                                      <span className="text-slate-300">{c.content}</span>
                                    </div>
                                    {c.userId === actor.id && (
                                      <button
                                        onClick={() => deleteComment(c.id, t.id)}
                                        className="text-rose-500/50 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                      >
                                        <Trash2 size={12} />
                                      </button>
                                    )}
                                  </div>
                                ))}
                              </div>
                              <div className="flex gap-2">
                                <input
                                  type="text"
                                  value={newComment}
                                  onChange={(e) => setNewComment(e.target.value)}
                                  placeholder="写下你的悼词..."
                                  className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-sky-500"
                                />
                                <button
                                  onClick={() => addComment(t.id)}
                                  className="bg-sky-600 text-white p-2 rounded-lg hover:bg-sky-500 transition-colors"
                                >
                                  <Send size={14} />
                                </button>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 对戏窗口（可开关，不再强制弹） */}
      <AnimatePresence>
        {rpSessionId && rpWindowOpen && (
          <RoleplayWindow
            sessionId={rpSessionId}
            currentUser={actor}
            sessions={rpSessions.map((session) => ({
              sessionId: session.sessionId,
              peerName: getRPPeerName(session, actor.id),
              locationName: session.locationName,
              status: session.status,
            }))}
            onSelectSession={(sessionId) => {
              setRPSessionId(sessionId);
              setRPPing(false);
            }}
            onClose={() => setRPWindowOpen(false)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {groupRPJoinedLocationId && groupRPWindowOpen && (
          <GroupRoleplayWindow
            currentUser={actor}
            locationId={groupRPJoinedLocationId}
            locationName={groupRPJoinedLocationName || resolveLocationName(groupRPJoinedLocationId)}
            onClose={() => setGroupRPWindowOpen(false)}
            onLeave={async (locationId) => {
              await leaveGroupRoleplay(locationId, false);
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {activeAnn && (
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 14 }}
            className="fixed top-20 left-1/2 -translate-x-1/2 z-[1000] w-[92vw] max-w-xl"
          >
            <div className="bg-slate-900/95 border border-amber-400/40 rounded-2xl shadow-2xl p-4 backdrop-blur-md">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[11px] text-amber-300 font-black mb-1">全服通报</div>
                  <h4 className="text-white font-black text-base">
                    {activeAnn.title || '系统公告'}
                  </h4>
                </div>
                <button
                  onClick={closeAnnouncement}
                  className="px-2 py-1 rounded-lg bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 text-xs font-bold"
                >
                  关闭
                </button>
              </div>

              <p className="mt-2 text-sm text-slate-200 whitespace-pre-wrap leading-relaxed">
                {activeAnn.content || ''}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ===== 新增：灾厄运行页 ===== */}
      <AnimatePresence>
        {activeCustomGameId && (
          <div className="fixed inset-0 z-[9997] bg-black/75 backdrop-blur-sm p-4 overflow-y-auto">
            <div className="max-w-6xl mx-auto mt-6">
              <div className="bg-slate-900 border border-slate-700 rounded-2xl p-4 mb-3 flex justify-between items-center">
                <h3 className="font-black text-white">灾厄运行区</h3>
                <button
                  onClick={async () => {
                    const gameId = Number(activeCustomGameId || 0);
                    if (gameId) {
                      try {
                        await fetch(`/api/custom-games/${gameId}/run/leave`, {
                          method: 'POST',
                          headers: {
                            'Content-Type': 'application/json',
                            Authorization: `Bearer ${localStorage.getItem('USER_TOKEN') || ''}`
                          },
                          body: JSON.stringify({})
                        });
                      } catch {
                        // ignore and still return to world view
                      }
                    }
                    setActiveCustomGameId(null);
                    fetchGlobalData();
                  }}
                  className="px-3 py-1 rounded bg-slate-700 text-white"
                >
                  关闭
                </button>
              </div>

              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 text-white">
                <CustomGameRunView
                  gameId={Number(activeCustomGameId)}
                  currentUser={{
                    id: Number(user.id || 0),
                    username: String(user.name || ''),
                    nickname: String(user.name || ''),
                    isAdmin: false
                  }}
                  onExit={() => {
                    setActiveCustomGameId(null);
                    fetchGlobalData();
                  }}
                />
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* ===== 新增：全服公告弹窗（投票/灾厄降临）===== */}
      <GlobalAnnouncementPrompt
        user={user}
        showToast={showToast}
        onEnterRun={({ gameId }) => {
          setActiveCustomGameId(Number(gameId || 0));
        }}
      />

      {/* 死亡表单 */}
      {showDeathForm && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur flex items-center justify-center p-4">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-slate-900 border border-slate-700 p-8 rounded-3xl w-full max-w-lg shadow-2xl"
          >
            <h2 className="text-2xl font-black text-white mb-2">
              {showDeathForm === 'death' ? '谢幕与墓志铭' : '化鬼契约'}
            </h2>
            <p className="text-sm text-slate-400 mb-6">
              {showDeathForm === 'death'
                ? '写下你的死因与墓志铭，提交后将生成世界墓碑，数据将被剥夺。'
                : '放弃肉身与精神体，以灵体状态游荡于世。'}
            </p>
            <textarea
              value={deathText}
              onChange={(e) => setDeathText(e.target.value)}
              placeholder="在此书写你的落幕之辞..."
              className="w-full h-32 p-4 bg-slate-950 border border-slate-800 rounded-xl text-slate-300 outline-none focus:border-sky-500/50 mb-6 text-sm resize-none"
            />
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeathForm(null)}
                className="flex-1 py-3 bg-slate-800 text-white rounded-xl font-bold hover:bg-slate-700"
              >
                取消
              </button>
              <button
                onClick={handleSubmitDeath}
                className="flex-[2] py-3 bg-rose-600 text-white rounded-xl font-bold hover:bg-rose-500 shadow-lg"
              >
                提交审核
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}













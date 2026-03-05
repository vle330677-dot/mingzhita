import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, BedDouble, DoorOpen, Download, MessageSquarePlus, Save, ShieldCheck, Sparkles, Trash2 } from 'lucide-react';

type HomeLocation = 'sanctuary' | 'slums' | 'rich_area';
const NONE = '无';
const MOBILE_PORTRAIT_QUERY = '(max-width: 767px) and (orientation: portrait)';

interface ReplayItem {
  id: string;
  title: string;
  locationName: string;
  participantNames: string;
  createdAt: string;
  messageCount: number;
}

interface CustomGameMineRow {
  id: number;
  title: string;
  status: string;
  voteStatus: string;
  createdAt: string;
}

interface SpiritStatus {
  name: string;
  intimacy: number;
  level: number;
  imageUrl: string;
  appearance: string;
  daily: {
    feed: number;
    pet: number;
    train: number;
  };
}

const EMPTY_SPIRIT_STATUS: SpiritStatus = {
  name: '',
  intimacy: 0,
  level: 1,
  imageUrl: '',
  appearance: '',
  daily: { feed: 0, pet: 0, train: 0 }
};

interface UserLite {
  id: number;
  name?: string;
  role?: string;
  age?: number;
  gold?: number;
}

export interface HomeRoomDetail {
  ownerId: number;
  ownerName: string;
  avatarUrl?: string;
  job?: string;
  role?: string;
  homeLocation?: HomeLocation | string;
  bgImage?: string;
  description?: string;
  visible?: boolean;
  allowVisit?: boolean;
}

interface Props {
  currentUser: UserLite;
  room: HomeRoomDetail;
  sourceMap: HomeLocation;
  onBack: () => void;
  showToast: (msg: string) => void;
  onSaved?: (next: HomeRoomDetail) => void;
  refreshGlobalData?: () => void;
  onRequestSwitchLocation?: (locationId: string) => void;
}

export function deriveInitialHomeLocation(user: UserLite): HomeLocation {
  const role = String(user.role || '');
  const age = Number(user.age || 0);
  const gold = Number(user.gold || 0);
  if (role === '未分化' || age < 16) return 'sanctuary';
  return gold > 9999 ? 'rich_area' : 'slums';
}

const THEME: Record<HomeLocation, { name: string; backText: string; defaultBg: string; overlay: string; panel: string }> = {
  sanctuary: {
    name: '圣所',
    backText: '返回圣所',
    defaultBg: '/room/圣所.png',
    overlay: 'bg-gradient-to-br from-amber-900/30 via-orange-900/20 to-yellow-900/30',
    panel: 'bg-amber-950/35 border-amber-700/40'
  },
  slums: {
    name: '西区',
    backText: '返回西区',
    defaultBg: '/room/西区.png',
    overlay: 'bg-gradient-to-br from-stone-950/55 via-orange-950/20 to-black/60',
    panel: 'bg-stone-900/40 border-orange-700/40'
  },
  rich_area: {
    name: '东区',
    backText: '返回东区',
    defaultBg: '/room/东区.png',
    overlay: 'bg-gradient-to-br from-sky-950/35 via-emerald-950/15 to-slate-950/45',
    panel: 'bg-slate-900/35 border-sky-700/40'
  }
};

function normalizeHomeLocation(v: any): HomeLocation | null {
  if (v === 'sanctuary' || v === 'slums' || v === 'rich_area') return v;
  return null;
}

export default function HomeRoomView({
  currentUser,
  room,
  sourceMap,
  onBack,
  showToast,
  onSaved,
  refreshGlobalData,
  onRequestSwitchLocation
}: Props) {
  const isOwner = Number(currentUser.id) === Number(room.ownerId);
  const actualLoc = normalizeHomeLocation(room.homeLocation) || sourceMap;
  const theme = THEME[actualLoc];

  const [editDesc, setEditDesc] = useState(room.description || '');
  const [editBg, setEditBg] = useState(room.bgImage || '');
  const [editVisible, setEditVisible] = useState(room.visible !== false);
  const [editAllowVisit, setEditAllowVisit] = useState(room.allowVisit !== false);
  const [roomPassword, setRoomPassword] = useState('');
  const [roomPasswordAgain, setRoomPasswordAgain] = useState('');
  const [clearRoomPassword, setClearRoomPassword] = useState(false);
  const [showReplays, setShowReplays] = useState(false);
  const [replayLoading, setReplayLoading] = useState(false);
  const [replays, setReplays] = useState<ReplayItem[]>([]);
  const [deletingReplayId, setDeletingReplayId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [growing, setGrowing] = useState(false);
  const [showCustomGameApply, setShowCustomGameApply] = useState(false);
  const [customGameLoading, setCustomGameLoading] = useState(false);
  const [customGameBusy, setCustomGameBusy] = useState(false);
  const [customGameTitle, setCustomGameTitle] = useState('');
  const [customGameIdea, setCustomGameIdea] = useState('');
  const [customGameRows, setCustomGameRows] = useState<CustomGameMineRow[]>([]);
  const [showSpiritPanel, setShowSpiritPanel] = useState(false);
  const [spiritLoading, setSpiritLoading] = useState(false);
  const [spiritBusy, setSpiritBusy] = useState(false);
  const [spiritAvailable, setSpiritAvailable] = useState(false);
  const [spiritStatus, setSpiritStatus] = useState<SpiritStatus>(EMPTY_SPIRIT_STATUS);
  const [spiritNameDraft, setSpiritNameDraft] = useState('');
  const [spiritImageDraft, setSpiritImageDraft] = useState('');
  const [spiritAppearanceDraft, setSpiritAppearanceDraft] = useState('');
  const [mobileSection, setMobileSection] = useState<'info' | 'panel'>('info');
  const [isPortraitMobile, setIsPortraitMobile] = useState(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
    return window.matchMedia(MOBILE_PORTRAIT_QUERY).matches;
  });

  const age = Number(currentUser.age || 0);
  const role = String(currentUser.role || '');
  const isUndifferentiatedStage = age < 16 || role === '未分化';
  const isStudentStage = age >= 16 && age <= 19;

  const canVisitorView = useMemo(() => {
    if (isOwner) return true;
    if (room.visible === false) return false;
    return true;
  }, [isOwner, room.visible]);

  const bg = editBg.trim() || room.bgImage || theme.defaultBg;

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

  const fetchReplays = async () => {
    if (!isOwner) return;
    try {
      setReplayLoading(true);
      const res = await fetch(`/api/rooms/${room.ownerId}/replays`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('USER_TOKEN') || ''}` }
      });
      const data = await res.json().catch(() => ({} as any));
      if (!res.ok || data.success === false) {
        showToast(data.message || '读取回顾失败');
        return;
      }
      setReplays(Array.isArray(data.archives) ? data.archives : []);
    } catch {
      showToast('网络错误，读取回顾失败');
    } finally {
      setReplayLoading(false);
    }
  };

  useEffect(() => {
    if (showReplays && isOwner) fetchReplays();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showReplays, isOwner, room.ownerId]);

  const saveRoomSettings = async () => {
    if (!isOwner || saving) return;
    if (!clearRoomPassword && roomPassword.trim()) {
      if (roomPassword.trim().length < 4) {
        showToast('房间密码至少 4 位');
        return;
      }
      if (roomPassword !== roomPasswordAgain) {
        showToast('两次输入的房间密码不一致');
        return;
      }
    }
    try {
      setSaving(true);
      const res = await fetch(`/api/rooms/${room.ownerId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('USER_TOKEN') || ''}`
        },
        body: JSON.stringify({
          visible: editVisible,
          allowVisit: editAllowVisit,
          roomDescription: editDesc,
          roomBgImage: editBg,
          roomPassword: !clearRoomPassword ? roomPassword.trim() : '',
          clearRoomPassword
        })
      });
      const data = await res.json().catch(() => ({} as any));
      if (!res.ok || data.success === false) {
        showToast(data.message || '保存失败');
        return;
      }

      const next: HomeRoomDetail = {
        ...room,
        description: editDesc,
        bgImage: editBg,
        visible: editVisible,
        allowVisit: editAllowVisit
      };
      onSaved?.(next);
      setRoomPassword('');
      setRoomPasswordAgain('');
      setClearRoomPassword(false);
      showToast('家园设置已保存');
    } catch {
      showToast('网络错误，保存失败');
    } finally {
      setSaving(false);
    }
  };

  const deleteReplay = async (archiveId: string) => {
    if (!archiveId || deletingReplayId) return;
    if (!window.confirm('确定删除这条回顾吗？删除后不可恢复。')) return;
    try {
      setDeletingReplayId(archiveId);
      const res = await fetch(`/api/rooms/${room.ownerId}/replays/${encodeURIComponent(archiveId)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${localStorage.getItem('USER_TOKEN') || ''}` }
      });
      const data = await res.json().catch(() => ({} as any));
      if (!res.ok || data.success === false) {
        showToast(data.message || '删除回顾失败');
        return;
      }
      setReplays((prev) => prev.filter((x) => x.id !== archiveId));
      showToast('回顾已删除');
    } catch {
      showToast('网络错误，删除失败');
    } finally {
      setDeletingReplayId(null);
    }
  };

  const handleRest = async () => {
    if (!isOwner) {
      showToast('只有房主可以在自己的房间休息');
      return;
    }
    try {
      const res = await fetch('/api/tower/rest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser.id })
      });
      if (!res.ok) {
        showToast('休息失败，请稍后重试');
        return;
      }
      showToast('休息完成，状态已恢复');
      refreshGlobalData?.();
    } catch {
      showToast('网络错误，休息失败');
    }
  };

  const handleGrowthAdvance = async () => {
    if (!isOwner) {
      showToast('只有房主可以在自己的房间进行成长推进');
      return;
    }
    if (growing) return;

    try {
      setGrowing(true);

      if (isUndifferentiatedStage) {
        const goDifferentiate = window.confirm(
          '未分化阶段成长需要先前往命之塔进行属性分化。\n确定：前往分化抽取属性\n取消：稍后再说'
        );
        if (!goDifferentiate) {
          showToast('已取消成长推进。');
          return;
        }
        const uid = Number(currentUser.id || 0);
        const res = await fetch(`/api/characters/${uid}/location`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ locationId: 'tower_of_life' })
        });
        const data = await res.json().catch(() => ({} as any));
        if (!res.ok || data.success === false) {
          showToast(data.message || '前往命之塔失败');
          return;
        }
        sessionStorage.setItem(`tower_open_differentiation_${uid}`, '1');
        refreshGlobalData?.();
        if (onRequestSwitchLocation) {
          onRequestSwitchLocation('tower_of_life');
        } else {
          onBack();
        }
        showToast('已前往命之塔，可直接进行属性分化。');
        return;
      }

      if (isStudentStage) {
        const ok = window.confirm('确认毕业并进入19+成年阶段吗？该成长不可逆。');
        if (!ok) return;

        const res = await fetch('/api/growth/advance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: currentUser.id,
            action: 'graduate'
          })
        });
        const data = await res.json().catch(() => ({} as any));
        if (!res.ok || data.success === false) {
          showToast(data.message || '毕业失败');
          return;
        }

        showToast('毕业完成，已进入19+成年阶段');
        refreshGlobalData?.();
        return;
      }

      showToast('你已处于成年阶段，成长不可回退');
    } catch {
      showToast('网络错误，成长推进失败');
    } finally {
      setGrowing(false);
    }
  };

  const loadMyCustomGames = async (silent = false) => {
    try {
      setCustomGameLoading(true);
      const res = await fetch('/api/custom-games/mine', {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('USER_TOKEN') || ''}`
        }
      });
      const data = await res.json().catch(() => ([] as any[]));
      if (!res.ok) {
        if (!silent) showToast('读取灾厄申请列表失败');
        return;
      }
      const rows = (Array.isArray(data) ? data : []).map((x: any) => ({
        id: Number(x.id || 0),
        title: String(x.title || `灾厄游戏#${x.id || 0}`),
        status: String(x.status || 'unknown'),
        voteStatus: String(x.vote_status || 'none'),
        createdAt: String(x.created_at || '')
      }));
      setCustomGameRows(rows);
    } catch {
      if (!silent) showToast('网络错误，读取灾厄申请列表失败');
    } finally {
      setCustomGameLoading(false);
    }
  };

  const openCustomGameApply = async () => {
    setShowCustomGameApply(true);
    await loadMyCustomGames(true);
  };

  const submitCustomGameApply = async () => {
    const title = customGameTitle.trim();
    const ideaText = customGameIdea.trim();
    if (!title) {
      showToast('请填写灾厄游戏标题');
      return;
    }
    if (!ideaText) {
      showToast('请填写游戏大纲');
      return;
    }
    if (customGameBusy) return;

    try {
      setCustomGameBusy(true);
      const res = await fetch('/api/custom-games', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('USER_TOKEN') || ''}`
        },
        body: JSON.stringify({ title, ideaText })
      });
      const data = await res.json().catch(() => ({} as any));
      if (!res.ok) {
        showToast(data.message || '提交灾厄申请失败');
        return;
      }
      setCustomGameTitle('');
      setCustomGameIdea('');
      showToast('灾厄申请已提交，等待管理员审核');
      await loadMyCustomGames(true);
    } catch {
      showToast('网络错误，提交灾厄申请失败');
    } finally {
      setCustomGameBusy(false);
    }
  };

  const loadSpiritStatus = async (silent = false) => {
    if (!isOwner) return;
    try {
      setSpiritLoading(true);
      const res = await fetch(`/api/users/${currentUser.id}/spirit-status`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('USER_TOKEN') || ''}` }
      });
      const data = await res.json().catch(() => ({} as any));
      if (!res.ok || data.success === false) {
        if (!silent) showToast(data.message || '读取精神体状态失败');
        return;
      }

      const raw = data.spiritStatus || {};
      setSpiritStatus({
        name: String(raw.name || ''),
        intimacy: Number(raw.intimacy || 0),
        level: Math.max(1, Number(raw.level || 1)),
        imageUrl: String(raw.imageUrl || ''),
        appearance: String(raw.appearance || ''),
        daily: {
          feed: Number(raw.daily?.feed || 0),
          pet: Number(raw.daily?.pet || 0),
          train: Number(raw.daily?.train || 0)
        }
      });
      setSpiritAvailable(Boolean(data.available));
      if (!Boolean(data.available) && !silent) {
        showToast('当前身份暂未开放精神体培养功能');
      }
    } catch {
      if (!silent) showToast('网络错误，读取精神体状态失败');
    } finally {
      setSpiritLoading(false);
    }
  };

  const openSpiritPanel = async () => {
    setShowSpiritPanel(true);
    setSpiritNameDraft('');
    setSpiritImageDraft('');
    setSpiritAppearanceDraft('');
    await loadSpiritStatus();
  };

  const saveSpiritProfile = async () => {
    if (!isOwner || spiritBusy) return;
    const name = spiritNameDraft.trim();
    const imageUrl = spiritImageDraft.trim();
    const appearance = spiritAppearanceDraft.trim();
    if (!name && !imageUrl && !appearance) {
      showToast('请至少填写一个精神体资料项');
      return;
    }
    try {
      setSpiritBusy(true);
      const res = await fetch('/api/tower/interact-spirit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser.id, name, imageUrl, appearance })
      });
      const data = await res.json().catch(() => ({} as any));
      if (!res.ok || data.success === false) {
        showToast(data.message || '保存精神体资料失败');
        return;
      }
      showToast(data.message || '精神体资料已更新');
      setSpiritNameDraft('');
      setSpiritImageDraft('');
      setSpiritAppearanceDraft('');
      await loadSpiritStatus(true);
      refreshGlobalData?.();
    } catch {
      showToast('网络错误，保存精神体资料失败');
    } finally {
      setSpiritBusy(false);
    }
  };

  const interactSpirit = async (action: 'feed' | 'pet' | 'train') => {
    if (!isOwner || spiritBusy || !spiritAvailable) return;
    try {
      setSpiritBusy(true);
      const res = await fetch('/api/tower/interact-spirit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser.id, action })
      });
      const data = await res.json().catch(() => ({} as any));
      if (!res.ok || data.success === false) {
        showToast(data.message || '精神体互动失败');
        return;
      }
      showToast(data.message || '精神体互动完成');
      await loadSpiritStatus(true);
      refreshGlobalData?.();
    } catch {
      showToast('网络错误，精神体互动失败');
    } finally {
      setSpiritBusy(false);
    }
  };

  const exportReplayTxt = async () => {
    try {
      const res = await fetch(`/api/rooms/${room.ownerId}/replays/export?format=txt`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('USER_TOKEN') || ''}` }
      });
      if (!res.ok) {
        showToast('导出失败：暂无记录或接口不可用');
        return;
      }

      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${room.ownerName}-家园回放.txt`;
      a.click();
      URL.revokeObjectURL(a.href);
      showToast('回放导出完成');
    } catch {
      showToast('导出失败');
    }
  };

  if (!canVisitorView) {
    return (
      <div className="fixed inset-0 z-[220] bg-black text-white flex items-center justify-center p-6 mobile-portrait-safe-overlay">
        <div className="max-w-md w-full rounded-2xl border border-slate-700 bg-slate-900 p-6 text-center mobile-portrait-safe-card mobile-contrast-surface-dark">
          <p className="text-lg font-black mb-2">该家园暂不开放访问</p>
          <p className="text-sm text-slate-400 mb-4">房主未公开该房间。</p>
          <button onClick={onBack} className="px-4 py-2 rounded-xl bg-slate-700 hover:bg-slate-600">
            返回
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[220] bg-slate-950 text-white">
      <div className="absolute inset-0">
        <img src={bg} className="w-full h-full object-cover opacity-45" alt="home-bg" />
      </div>
      <div className={`absolute inset-0 ${theme.overlay}`} />
      <div className="absolute inset-0 bg-black/35" />

      <div className="relative z-10 h-full w-full flex items-center justify-center p-4 md:p-6 mobile-portrait-safe-center">
        <div className="w-full max-w-6xl rounded-3xl border border-white/15 bg-black/30 backdrop-blur-xl shadow-2xl p-4 md:p-6 flex flex-col max-h-[92vh] mobile-portrait-safe-card mobile-contrast-surface-dark">
          <div className="flex items-center justify-between gap-3 shrink-0">
            <button
              onClick={onBack}
              className="px-4 py-2 rounded-xl bg-slate-900/80 border border-slate-600 font-bold flex items-center gap-2"
            >
              <ArrowLeft size={16} /> {theme.backText}
            </button>

            <div className="text-sm font-bold flex items-center gap-2 text-slate-200">
              <DoorOpen size={16} />
              {room.ownerName} 的家园（{theme.name}）
            </div>
          </div>

          {isPortraitMobile && (
            <div className="mt-3 grid grid-cols-2 gap-2 md:hidden shrink-0">
              <button
                onClick={() => setMobileSection('info')}
                className={`px-3 py-2 rounded-xl text-xs font-black border transition-colors ${
                  mobileSection === 'info'
                    ? 'bg-sky-600 text-white border-sky-400'
                    : 'bg-slate-900/70 text-slate-200 border-slate-600'
                }`}
              >
                家园信息
              </button>
              <button
                onClick={() => setMobileSection('panel')}
                className={`px-3 py-2 rounded-xl text-xs font-black border transition-colors ${
                  mobileSection === 'panel'
                    ? 'bg-emerald-600 text-white border-emerald-400'
                    : 'bg-slate-900/70 text-slate-200 border-slate-600'
                }`}
              >
                {isOwner ? '家园设置' : '家园面板'}
              </button>
            </div>
          )}

          <div className="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-4 flex-1 min-h-0">
            <div className={`lg:col-span-2 rounded-2xl border p-5 backdrop-blur ${theme.panel} overflow-y-auto custom-scrollbar min-h-0 ${
              isPortraitMobile && mobileSection !== 'info' ? 'hidden md:block' : ''
            }`}>
              <h3 className="text-xl font-black mb-3">家园信息</h3>
              <p className="text-slate-100 whitespace-pre-wrap leading-relaxed">
                {room.description || '房主还没有设置家园介绍。'}
              </p>
            </div>

            <div className={`rounded-2xl border p-4 backdrop-blur ${theme.panel} overflow-y-auto custom-scrollbar min-h-0 ${
              isPortraitMobile && mobileSection !== 'panel' ? 'hidden md:block' : ''
            }`}>
              <h4 className="font-black mb-3">家园面板</h4>
              <p className="text-xs text-slate-200 mb-1">职业：{room.job || NONE}</p>
              <p className="text-xs text-slate-300 mb-3">身份：{room.role || '未知'}</p>

              {isOwner ? (
                <div className="space-y-2">
                  <textarea
                    value={editDesc}
                    onChange={(e) => setEditDesc(e.target.value)}
                    className="w-full h-24 p-2 rounded bg-slate-950 border border-slate-700 text-xs"
                    placeholder="输入房间介绍..."
                  />
                  <input
                    value={editBg}
                    onChange={(e) => setEditBg(e.target.value)}
                    className="w-full p-2 rounded bg-slate-950 border border-slate-700 text-xs"
                    placeholder={`背景图 URL（留空使用默认：${theme.defaultBg}）`}
                  />

                  <label className="text-xs flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={editVisible}
                      onChange={(e) => setEditVisible(e.target.checked)}
                    />
                    房间公开可见
                  </label>
                  <label className="text-xs flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={editAllowVisit}
                      onChange={(e) => setEditAllowVisit(e.target.checked)}
                    />
                    允许访客进入
                  </label>

                  <input
                    type="password"
                    value={roomPassword}
                    onChange={(e) => setRoomPassword(e.target.value)}
                    className="w-full p-2 rounded bg-slate-950 border border-slate-700 text-xs"
                    placeholder="房间密码（留空表示不修改）"
                  />
                  <input
                    type="password"
                    value={roomPasswordAgain}
                    onChange={(e) => setRoomPasswordAgain(e.target.value)}
                    className="w-full p-2 rounded bg-slate-950 border border-slate-700 text-xs"
                    placeholder="重复输入新密码"
                  />
                  <label className="text-xs flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={clearRoomPassword}
                      onChange={(e) => setClearRoomPassword(e.target.checked)}
                    />
                    清空房间密码
                  </label>

                  <button
                    onClick={saveRoomSettings}
                    disabled={saving}
                    className="w-full py-2 rounded bg-emerald-600 hover:bg-emerald-500 font-bold flex items-center justify-center gap-2 disabled:opacity-60"
                  >
                    <Save size={14} /> {saving ? '保存中...' : '保存设置'}
                  </button>

                  <button
                    onClick={handleRest}
                    className="w-full py-2 rounded bg-indigo-600 hover:bg-indigo-500 font-bold flex items-center justify-center gap-2"
                  >
                    <BedDouble size={14} /> 休息（恢复状态）
                  </button>

                  {(isUndifferentiatedStage || isStudentStage) && (
                    <button
                      onClick={handleGrowthAdvance}
                      disabled={growing}
                      className="w-full py-2 rounded bg-fuchsia-600 hover:bg-fuchsia-500 font-bold disabled:opacity-60"
                    >
                      {isUndifferentiatedStage
                        ? (growing ? '前往分化中...' : '成长推进（前往命之塔分化）')
                        : (growing ? '毕业处理中...' : '成长推进（学生毕业→19+）')}
                    </button>
                  )}

                  <button
                    onClick={openCustomGameApply}
                    className="w-full py-2 rounded bg-rose-700 hover:bg-rose-600 font-bold flex items-center justify-center gap-2"
                  >
                    <MessageSquarePlus size={14} /> 灾厄开戏申请（提交大纲）
                  </button>

                  <button
                    onClick={openSpiritPanel}
                    className="w-full py-2 rounded bg-violet-600 hover:bg-violet-500 font-bold flex items-center justify-center gap-2"
                  >
                    <Sparkles size={14} /> 精神体入口
                  </button>

                  <button
                    onClick={exportReplayTxt}
                    className="w-full py-2 rounded bg-slate-700 hover:bg-slate-600 font-bold flex items-center justify-center gap-2"
                  >
                    <Download size={14} /> 回放导出 TXT
                  </button>

                  <button
                    onClick={() => setShowReplays((v) => !v)}
                    className="w-full py-2 rounded bg-slate-800 hover:bg-slate-700 font-bold"
                  >
                    {showReplays ? '收起回顾列表' : '查看回顾列表'}
                  </button>

                  {showReplays && (
                    <div className="mt-2 max-h-56 overflow-y-auto rounded border border-slate-700 bg-black/20 p-2 space-y-2">
                      {replayLoading ? (
                        <p className="text-[11px] text-slate-400">回顾加载中...</p>
                      ) : replays.length === 0 ? (
                        <p className="text-[11px] text-slate-400">暂无回顾记录</p>
                      ) : (
                        replays.map((arc) => (
                          <div key={arc.id} className="rounded border border-slate-700 bg-slate-900/60 p-2">
                            <p className="text-xs font-bold text-slate-100 truncate">{arc.title || arc.id}</p>
                            <p className="text-[10px] text-slate-400 mt-1">
                              {arc.locationName || '未知地点'} · {arc.messageCount} 条
                            </p>
                            <p className="text-[10px] text-slate-500">{new Date(arc.createdAt).toLocaleString()}</p>
                            <button
                              onClick={() => deleteReplay(arc.id)}
                              disabled={deletingReplayId === arc.id}
                              className="mt-2 w-full py-1 rounded bg-rose-700 hover:bg-rose-600 text-[11px] font-bold flex items-center justify-center gap-1 disabled:opacity-60"
                            >
                              <Trash2 size={12} />
                              {deletingReplayId === arc.id ? '删除中...' : '删除'}
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="text-xs text-slate-300 flex items-center gap-2">
                    <ShieldCheck size={14} />
                    访客模式：仅可查看房间展示信息
                  </div>
                  <button
                    onClick={openCustomGameApply}
                    className="w-full py-2 rounded bg-rose-700 hover:bg-rose-600 font-bold flex items-center justify-center gap-2"
                  >
                    <MessageSquarePlus size={14} />
                    灾厄开戏申请（提交大纲）
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {showCustomGameApply && (
        <div className="fixed inset-0 z-[255] bg-black/70 flex items-center justify-center p-4 mobile-portrait-safe-overlay">
          <div className="w-full max-w-2xl rounded-3xl border border-rose-700/40 bg-slate-900/95 p-5 md:p-6 shadow-2xl mobile-portrait-safe-card mobile-contrast-surface-dark">
            <div className="flex items-center justify-between gap-3">
              <h4 className="text-lg font-black text-rose-200 flex items-center gap-2">
                <MessageSquarePlus size={16} />
                灾厄开戏申请
              </h4>
              <button
                onClick={() => setShowCustomGameApply(false)}
                className="px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-xs font-bold hover:bg-slate-700"
              >
                关闭
              </button>
            </div>

            <p className="mt-2 text-xs text-slate-300">
              向管理员提交“开启灾厄游戏”申请。请填写标题与游戏大纲，提交后进入后台审核流程。
            </p>

            <div className="mt-4 space-y-2">
              <input
                value={customGameTitle}
                onChange={(e) => setCustomGameTitle(e.target.value)}
                placeholder="灾厄游戏标题"
                className="w-full p-2 rounded bg-slate-950 border border-slate-700 text-xs"
              />
              <textarea
                value={customGameIdea}
                onChange={(e) => setCustomGameIdea(e.target.value)}
                placeholder="填写游戏大纲（背景、规则、目标、阶段设计等）"
                className="w-full h-32 p-2 rounded bg-slate-950 border border-slate-700 text-xs"
              />
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={submitCustomGameApply}
                  disabled={customGameBusy}
                  className="py-2 rounded-xl bg-rose-700 hover:bg-rose-600 text-xs font-black disabled:opacity-60"
                >
                  {customGameBusy ? '提交中...' : '提交管理员审核'}
                </button>
                <button
                  onClick={() => loadMyCustomGames()}
                  disabled={customGameLoading}
                  className="py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-xs font-black disabled:opacity-60"
                >
                  {customGameLoading ? '刷新中...' : '刷新我的申请'}
                </button>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-slate-700 bg-slate-800/60 p-3">
              <div className="text-xs font-black text-slate-200 mb-2">我的灾厄申请记录</div>
              {customGameLoading ? (
                <div className="text-xs text-slate-400">加载中...</div>
              ) : customGameRows.length === 0 ? (
                <div className="text-xs text-slate-500">暂无申请记录</div>
              ) : (
                <div className="space-y-2 max-h-44 overflow-y-auto custom-scrollbar">
                  {customGameRows.map((g) => (
                    <div key={`cg-home-${g.id}`} className="rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2">
                      <div className="text-xs font-black text-white truncate">{g.title}</div>
                      <div className="text-[11px] text-slate-400 mt-1">
                        状态：{g.status} {g.voteStatus ? `| 投票：${g.voteStatus}` : ''}
                      </div>
                      <div className="text-[10px] text-slate-500 mt-1">
                        {g.createdAt ? new Date(g.createdAt).toLocaleString() : '-'}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showSpiritPanel && (
        <div className="fixed inset-0 z-[260] bg-black/70 flex items-center justify-center p-4 mobile-portrait-safe-overlay">
          <div className="w-full max-w-lg rounded-3xl border border-violet-700/40 bg-slate-900/95 p-5 md:p-6 shadow-2xl mobile-portrait-safe-card mobile-contrast-surface-dark">
            <div className="flex items-center justify-between gap-3">
              <h4 className="text-lg font-black text-violet-200 flex items-center gap-2">
                <Sparkles size={16} />
                精神体培养入口
              </h4>
              <button
                onClick={() => setShowSpiritPanel(false)}
                className="px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-xs font-bold hover:bg-slate-700"
              >
                关闭
              </button>
            </div>

            {spiritLoading ? (
              <div className="mt-4 text-sm text-slate-300">读取精神体状态中...</div>
            ) : (
              <>
                <div className="mt-4 rounded-2xl border border-slate-700 bg-slate-800/60 p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-14 h-14 rounded-xl border border-slate-700 bg-slate-900 overflow-hidden shrink-0">
                      {spiritStatus.imageUrl ? (
                        <img src={spiritStatus.imageUrl} alt="spirit-avatar" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-violet-300 text-xl font-black">灵</div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-black text-white truncate">{spiritStatus.name || '未命名精神体'}</p>
                      <p className="text-xs text-slate-400 mt-1">等级 Lv.{Math.max(1, Number(spiritStatus.level || 1))}</p>
                      <p className="text-xs text-slate-400">亲密度 {Math.max(0, Number(spiritStatus.intimacy || 0))}</p>
                      <p className="text-[11px] text-slate-500 mt-1">
                        今日互动：喂食 {Math.max(0, Number(spiritStatus.daily?.feed || 0))}/3 ·
                        摸摸 {Math.max(0, Number(spiritStatus.daily?.pet || 0))}/3 ·
                        训练 {Math.max(0, Number(spiritStatus.daily?.train || 0))}/3
                      </p>
                    </div>
                  </div>
                  <p className="text-xs text-slate-300 mt-3">
                    外貌：{spiritStatus.appearance || '尚未记录'}
                  </p>
                </div>

                {!spiritAvailable && (
                  <div className="mt-3 rounded-xl border border-amber-600/40 bg-amber-600/10 px-3 py-2 text-xs text-amber-200">
                    当前身份暂未开放精神体培养功能（仅哨兵/向导可用）。
                  </div>
                )}

                <div className="mt-4 grid grid-cols-3 gap-2">
                  <button
                    onClick={() => interactSpirit('feed')}
                    disabled={!spiritAvailable || spiritBusy}
                    className="py-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-xs font-black disabled:opacity-50"
                  >
                    喂食 +5
                  </button>
                  <button
                    onClick={() => interactSpirit('pet')}
                    disabled={!spiritAvailable || spiritBusy}
                    className="py-2 rounded-xl bg-sky-700 hover:bg-sky-600 text-xs font-black disabled:opacity-50"
                  >
                    摸摸 +8
                  </button>
                  <button
                    onClick={() => interactSpirit('train')}
                    disabled={!spiritAvailable || spiritBusy}
                    className="py-2 rounded-xl bg-fuchsia-700 hover:bg-fuchsia-600 text-xs font-black disabled:opacity-50"
                  >
                    训练 +3
                  </button>
                </div>

                <div className="mt-4 space-y-2">
                  <input
                    value={spiritNameDraft}
                    onChange={(e) => setSpiritNameDraft(e.target.value)}
                    placeholder="精神体名称（仅首次可锁定）"
                    className="w-full p-2 rounded bg-slate-950 border border-slate-700 text-xs"
                  />
                  <input
                    value={spiritImageDraft}
                    onChange={(e) => setSpiritImageDraft(e.target.value)}
                    placeholder="精神体头像 URL（仅首次可锁定）"
                    className="w-full p-2 rounded bg-slate-950 border border-slate-700 text-xs"
                  />
                  <textarea
                    value={spiritAppearanceDraft}
                    onChange={(e) => setSpiritAppearanceDraft(e.target.value)}
                    placeholder="精神体外貌描述（仅首次可锁定）"
                    className="w-full h-20 p-2 rounded bg-slate-950 border border-slate-700 text-xs"
                  />
                  <button
                    onClick={saveSpiritProfile}
                    disabled={spiritBusy}
                    className="w-full py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-xs font-black disabled:opacity-60"
                  >
                    {spiritBusy ? '处理中...' : '保存精神体资料'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { LogOut, RefreshCw, TowerControl, MapPin, Bell } from 'lucide-react';
import { User } from '../types';
import { ViewState } from '../App';
import { TowerView } from './TowerView';

interface Props {
  user: User;
  setUser: React.Dispatch<React.SetStateAction<User | null>>;
  onNavigate: (view: ViewState) => void;
}

const LOCATIONS = [
  { id: 'tower_of_life', name: '命之塔' },
  { id: 'london_tower', name: '伦敦塔' },
  { id: 'sanctuary', name: '圣所' },
  { id: 'guild', name: '公会' },
  { id: 'slums', name: '贫民区' },
  { id: 'rich_area', name: '富人区' },
  { id: 'tower_guard', name: '守塔会' },
  { id: 'demon_society', name: '恶魔会' },
  { id: 'paranormal_office', name: '灵异管理所' },
  { id: 'observers', name: '观察者' }
];

export function GameView({ user, setUser, onNavigate }: Props) {
  const [loading, setLoading] = useState(false);
  const [showTower, setShowTower] = useState(false);
  const [toast, setToast] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);

  const currentLocationName = useMemo(() => {
    const hit = LOCATIONS.find((l) => l.id === user.currentLocation);
    return hit?.name || user.currentLocation || '未定位';
  }, [user.currentLocation]);

  const pushToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(''), 1800);
  };

  const fetchGlobalData = async () => {
    try {
      const res = await fetch(`/api/users/${encodeURIComponent(user.name)}`);
      const data = await res.json();
      if (data.success && data.user) setUser(data.user);
    } catch {
      pushToast('刷新失败，请检查网络');
    }
  };

  const fetchUnread = async () => {
    try {
      const res = await fetch(`/api/roleplay/unread/${user.id}`);
      const data = await res.json();
      if (data.success) setUnreadCount(data.count || 0);
    } catch {
      // ignore
    }
  };

  const updateLocation = async (locationId: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/users/${user.id}/location`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locationId })
      });
      const data = await res.json();
      if (data.success) {
        pushToast(`已移动到：${LOCATIONS.find((l) => l.id === locationId)?.name || locationId}`);
        await fetchGlobalData();
      } else {
        pushToast(data.message || '移动失败');
      }
    } catch {
      pushToast('网络错误，移动失败');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    setUser(null);
    onNavigate('LOGIN');
  };

  useEffect(() => {
    fetchGlobalData();
    fetchUnread();
    const timer = window.setInterval(fetchUnread, 8000);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (showTower) {
    return (
      <TowerView
        user={user}
        setUser={(u) => setUser(u)}
        onExit={() => setShowTower(false)}
        showToast={pushToast}
        fetchGlobalData={fetchGlobalData}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-20 bg-white/80 backdrop-blur border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-black">命之塔 · 世界面板</h1>
            <p className="text-xs text-slate-500">
              {user.name} ｜ {user.role || '未知身份'} ｜ 精神 {user.mentalRank || '—'} / 肉体 {user.physicalRank || '—'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchGlobalData}
              className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-sm font-bold flex items-center gap-1"
            >
              <RefreshCw size={16} /> 刷新
            </button>

            <button
              onClick={() => setShowTower(true)}
              className="px-3 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-sm font-bold flex items-center gap-1"
            >
              <TowerControl size={16} /> 进入命之塔
            </button>

            {/* 注意：此处不直接放“管理页”按钮，避免绕过入口暗码 */}

            <button
              onClick={handleLogout}
              className="px-3 py-2 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-sm font-bold flex items-center gap-1"
            >
              <LogOut size={16} /> 退出
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
        <section className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-4">
          <h2 className="font-black mb-3 flex items-center gap-2">
            <MapPin size={18} /> 地图移动
          </h2>

          <div className="text-sm text-slate-600 mb-4">
            当前地点：<span className="font-bold text-slate-900">{currentLocationName}</span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {LOCATIONS.map((loc) => (
              <button
                key={loc.id}
                disabled={loading}
                onClick={() => updateLocation(loc.id)}
                className={`text-left p-3 rounded-xl border transition ${
                  user.currentLocation === loc.id ? 'border-sky-400 bg-sky-50' : 'border-slate-200 bg-slate-50 hover:bg-white'
                }`}
              >
                <div className="font-bold text-sm">{loc.name}</div>
                <div className="text-[11px] text-slate-500 mt-1">{loc.id}</div>
              </button>
            ))}
          </div>
        </section>

        <aside className="bg-white border border-slate-200 rounded-2xl p-4">
          <h2 className="font-black mb-3">角色状态</h2>
          <div className="space-y-2 text-sm">
            <p>金币：<b>{user.gold ?? 0}</b> G</p>
            <p>能力：<b>{user.ability || '—'}</b></p>
            <p>精神体：<b>{user.spiritName || '未命名'}</b></p>
            <p>职位：<b>{user.job || '无'}</b></p>
            <p>HP/MP：<b>{user.hp ?? 0}</b> / <b>{user.mp ?? 0}</b></p>
          </div>

          <div className="mt-4 p-3 rounded-xl bg-indigo-50 text-indigo-700 text-sm font-bold flex items-center gap-2">
            <Bell size={16} />
            未读对戏消息：{unreadCount}
          </div>
        </aside>
      </main>

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-4 py-2 rounded-xl text-sm shadow-2xl z-50">
          {toast}
        </div>
      )}
    </div>
  );
}

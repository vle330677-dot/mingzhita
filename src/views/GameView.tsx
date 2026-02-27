import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import { LogOut, RefreshCw, TowerControl, MapPin, Bell, MessageCircle, Send } from 'lucide-react';
import { User } from '../types';
import { ViewState } from '../App';
import { TowerView } from './TowerView';

interface Props {
  user: User;
  setUser: Dispatch<SetStateAction<User | null>>;
  onNavigate: (view: ViewState) => void;
}

interface NearbyPlayer {
  id: number;
  name: string;
  avatarUrl?: string;
  role?: string;
  currentLocation?: string;
  status?: string;
}

interface RoleplayMessage {
  id: number;
  senderId: number;
  senderName: string;
  receiverId: number;
  receiverName: string;
  content: string;
  createdAt: string;
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

  const [nearbyPlayers, setNearbyPlayers] = useState<NearbyPlayer[]>([]);
  const [selectedUser, setSelectedUser] = useState<NearbyPlayer | null>(null);
  const [showRoleplay, setShowRoleplay] = useState(false);
  const [conversation, setConversation] = useState<RoleplayMessage[]>([]);
  const [rpText, setRpText] = useState('');
  const [rpLoading, setRpLoading] = useState(false);

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

  const fetchNearbyPlayers = async (locationIdOverride?: string) => {
    const locationId = locationIdOverride || user.currentLocation;
    if (!locationId) {
      setNearbyPlayers([]);
      return;
    }

    try {
      // 优先使用专用接口
      const res = await fetch(`/api/locations/${locationId}/players?excludeId=${user.id}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setNearbyPlayers((data.players || []) as NearbyPlayer[]);
          return;
        }
      }

      // 兼容回退：使用 admin users（当前项目未做后端鉴权时可用）
      const fallbackRes = await fetch('/api/admin/users');
      const fallbackData = await fallbackRes.json();
      if (fallbackData.success) {
        const list = (fallbackData.users || []) as NearbyPlayer[];
        const filtered = list.filter(
          (p) =>
            p.id !== user.id &&
            p.currentLocation === locationId &&
            (p.status === 'approved' || p.status === 'ghost')
        );
        setNearbyPlayers(filtered);
      } else {
        setNearbyPlayers([]);
      }
    } catch {
      setNearbyPlayers([]);
    }
  };

  const fetchConversation = async (otherId: number) => {
    try {
      const res = await fetch(`/api/roleplay/conversation/${user.id}/${otherId}`);
      const data = await res.json();
      if (data.success) {
        setConversation((data.messages || []) as RoleplayMessage[]);
        fetchUnread();
      } else {
        setConversation([]);
      }
    } catch {
      setConversation([]);
    }
  };

  const openRoleplay = async (target: NearbyPlayer) => {
    // 先打开窗口，保证“点击必弹窗”
    setSelectedUser(target);
    setShowRoleplay(true);
    setConversation([]);
    setRpText('');
    await fetchConversation(target.id);
  };

  const sendRoleplay = async () => {
    if (!selectedUser || !rpText.trim() || rpLoading) return;
    setRpLoading(true);
    try {
      const res = await fetch('/api/roleplay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderId: user.id,
          senderName: user.name,
          receiverId: selectedUser.id,
          receiverName: selectedUser.name,
          content: rpText.trim(),
          locationId: user.currentLocation || 'unknown'
        })
      });
      const data = await res.json();
      if (data.success) {
        setRpText('');
        await fetchConversation(selectedUser.id);
      } else {
        pushToast(data.message || '发送失败');
      }
    } catch {
      pushToast('网络错误，发送失败');
    } finally {
      setRpLoading(false);
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
        await fetchNearbyPlayers(locationId);
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
    fetchNearbyPlayers();

    const unreadTimer = window.setInterval(fetchUnread, 8000);
    return () => window.clearInterval(unreadTimer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchNearbyPlayers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.currentLocation, user.id]);

  useEffect(() => {
    if (!showRoleplay || !selectedUser) return;
    const timer = window.setInterval(() => fetchConversation(selectedUser.id), 5000);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showRoleplay, selectedUser?.id]);

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
    <div className="relative min-h-screen text-slate-900">
      {/* 背景图（public/map_background.jpg） */}
      <div
        className="absolute inset-0 bg-cover bg-center pointer-events-none"
        style={{ backgroundImage: "url('/map_background.jpg')" }}
      />
      <div className="absolute inset-0 bg-white/75 pointer-events-none" />

      <div className="relative z-10 min-h-screen">
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
          <section className="lg:col-span-2 bg-white/90 border border-slate-200 rounded-2xl p-4 backdrop-blur-sm">
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

          <aside className="bg-white/90 border border-slate-200 rounded-2xl p-4 backdrop-blur-sm">
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

            <div className="mt-5">
              <h3 className="font-black mb-2 flex items-center gap-2">
                <MessageCircle size={16} />
                同地点玩家
              </h3>

              {nearbyPlayers.length === 0 ? (
                <div className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-xl p-3">
                  当前地点暂无可对戏玩家
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {nearbyPlayers.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => openRoleplay(p)}
                      className="p-2 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-center transition"
                      title={`与 ${p.name} 对戏`}
                    >
                      <img
                        src={p.avatarUrl || 'https://placehold.co/80x80?text=Avatar'}
                        alt={p.name}
                        className="w-12 h-12 rounded-full object-cover mx-auto mb-1"
                      />
                      <div className="text-xs font-bold truncate">{p.name}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </aside>
        </main>
      </div>

      {/* 对戏弹窗 */}
      {showRoleplay && selectedUser && (
        <div className="fixed inset-0 z-[120] bg-black/50 flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-white rounded-2xl border border-slate-200 shadow-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-black text-lg">与 {selectedUser.name} 的对戏</h3>
              <button
                onClick={() => {
                  setShowRoleplay(false);
                  setSelectedUser(null);
                  setConversation([]);
                  setRpText('');
                }}
                className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-sm font-bold"
              >
                关闭
              </button>
            </div>

            <div className="h-80 overflow-y-auto border border-slate-200 rounded-xl p-3 bg-slate-50 space-y-2">
              {conversation.length === 0 ? (
                <div className="text-sm text-slate-500">暂无消息，开始第一句对戏吧。</div>
              ) : (
                conversation.map((m) => {
                  const mine = m.senderId === user.id;
                  return (
                    <div key={m.id} className={mine ? 'text-right' : 'text-left'}>
                      <div className="text-[11px] text-slate-500 mb-1">
                        {m.senderName} · {new Date(m.createdAt).toLocaleString()}
                      </div>
                      <div
                        className={`inline-block px-3 py-2 rounded-xl text-sm border ${
                          mine
                            ? 'bg-sky-600 text-white border-sky-600'
                            : 'bg-white text-slate-800 border-slate-200'
                        }`}
                      >
                        {m.content}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="mt-3 flex gap-2">
              <input
                value={rpText}
                onChange={(e) => setRpText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') sendRoleplay();
                }}
                placeholder="输入对戏内容..."
                className="flex-1 border border-slate-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-sky-200"
              />
              <button
                onClick={sendRoleplay}
                disabled={!rpText.trim() || rpLoading}
                className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold disabled:opacity-50 flex items-center gap-1"
              >
                <Send size={15} /> 发送
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-4 py-2 rounded-xl text-sm shadow-2xl z-[130]">
          {toast}
        </div>
      )}
    </div>
  );
}

import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import { LogOut, RefreshCw, TowerControl, MapPin, Bell, Send } from 'lucide-react';
import { User } from '../types';
import { ViewState } from '../App';
import { TowerView } from './TowerView';

interface Props {
  user: User;
  setUser: Dispatch<SetStateAction<User | null>>;
  onNavigate: (view: ViewState) => void;
}

interface MapPlayer {
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

interface MapLocation {
  id: string;
  name: string;
  x: number; // 百分比
  y: number; // 百分比
}

const LOCATIONS: MapLocation[] = [
  { id: 'tower_of_life', name: '命之塔', x: 50, y: 45 },
  { id: 'london_tower', name: '伦敦塔', x: 26, y: 24 },
  { id: 'sanctuary', name: '圣所', x: 76, y: 20 },
  { id: 'guild', name: '公会', x: 37, y: 57 },
  { id: 'slums', name: '贫民区', x: 20, y: 72 },
  { id: 'rich_area', name: '富人区', x: 73, y: 64 },
  { id: 'tower_guard', name: '守塔会', x: 58, y: 29 },
  { id: 'demon_society', name: '恶魔会', x: 83, y: 78 },
  { id: 'paranormal_office', name: '灵异管理所', x: 46, y: 78 },
  { id: 'observers', name: '观察者', x: 12, y: 48 }
];

export function GameView({ user, setUser, onNavigate }: Props) {
  const [loading, setLoading] = useState(false);
  const [showTower, setShowTower] = useState(false);
  const [toast, setToast] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);

  const [allPlayers, setAllPlayers] = useState<MapPlayer[]>([]);
  const [selectedUser, setSelectedUser] = useState<MapPlayer | null>(null);
  const [showRoleplay, setShowRoleplay] = useState(false);
  const [conversation, setConversation] = useState<RoleplayMessage[]>([]);
  const [rpText, setRpText] = useState('');
  const [rpLoading, setRpLoading] = useState(false);

  const currentLocationName = useMemo(() => {
    const hit = LOCATIONS.find((l) => l.id === user.currentLocation);
    return hit?.name || user.currentLocation || '未定位';
  }, [user.currentLocation]);

  const nearbyPlayers = useMemo(() => {
    if (!user.currentLocation) return [];
    return allPlayers.filter(
      (p) => p.id !== user.id && p.currentLocation === user.currentLocation && (p.status === 'approved' || p.status === 'ghost')
    );
  }, [allPlayers, user.currentLocation, user.id]);

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

  // 拉取所有有位置信息的玩家，用于地图头像
  const fetchAllPlayers = async () => {
    try {
      // 当前后端没有世界玩家专用接口时，先用 admin/users 回退
      const res = await fetch('/api/admin/users');
      const data = await res.json();
      if (!data.success) {
        setAllPlayers([]);
        return;
      }

      const users = (data.users || []) as MapPlayer[];
      const filtered = users.filter((u) => u.currentLocation && (u.status === 'approved' || u.status === 'ghost'));
      setAllPlayers(filtered);
    } catch {
      setAllPlayers([]);
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

  const openRoleplay = async (target: MapPlayer) => {
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
        await fetchAllPlayers();
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

  const getPlayersAtLocation = (locationId: string) => {
    return allPlayers.filter((p) => p.currentLocation === locationId && (p.status === 'approved' || p.status === 'ghost'));
  };

  useEffect(() => {
    fetchGlobalData();
    fetchUnread();
    fetchAllPlayers();

    const unreadTimer = window.setInterval(fetchUnread, 8000);
    const playerTimer = window.setInterval(fetchAllPlayers, 10000);

    return () => {
      window.clearInterval(unreadTimer);
      window.clearInterval(playerTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchAllPlayers();
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
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-black">命之塔 · 世界地图</h1>
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

      <main className="max-w-7xl mx-auto p-4 grid grid-cols-1 xl:grid-cols-4 gap-4">
        {/* 地图区（保留坐标UI） */}
        <section className="xl:col-span-3 bg-white border border-slate-200 rounded-2xl p-3">
          <div className="mb-3 text-sm text-slate-600">
            当前地点：<span className="font-black text-slate-900">{currentLocationName}</span>
          </div>

          <div
            className="relative w-full h-[72vh] rounded-2xl overflow-hidden border border-slate-200"
            style={{
              backgroundImage: "url('/map_background.jpg')",
              backgroundSize: 'cover',
              backgroundPosition: 'center'
            }}
          >
            {/* 半透明层，不拦截点击 */}
            <div className="absolute inset-0 bg-black/20 pointer-events-none" />

            {/* 地图点位 + 点位玩家头像 */}
            {LOCATIONS.map((loc) => {
              const playersHere = getPlayersAtLocation(loc.id);
              const isCurrent = user.currentLocation === loc.id;

              return (
                <div
                  key={loc.id}
                  className="absolute -translate-x-1/2 -translate-y-1/2"
                  style={{ left: `${loc.x}%`, top: `${loc.y}%` }}
                >
                  <button
                    disabled={loading}
                    onClick={() => updateLocation(loc.id)}
                    className={`group flex flex-col items-center select-none ${
                      isCurrent ? 'scale-105' : ''
                    }`}
                    title={`移动到 ${loc.name}`}
                  >
                    <div
                      className={`p-2 rounded-full border-2 shadow-2xl transition-all ${
                        isCurrent
                          ? 'bg-sky-600 border-sky-100'
                          : 'bg-slate-900/80 border-white/80 group-hover:bg-sky-500'
                      }`}
                    >
                      <MapPin size={16} className="text-white" />
                    </div>
                    <span className="mt-1 px-2 py-0.5 bg-black/75 text-white text-[10px] font-black rounded-md whitespace-nowrap">
                      {loc.name}
                    </span>
                  </button>

                  {/* 该坐标地点的玩家头像（可互动） */}
                  <div className="absolute left-1/2 -translate-x-1/2 mt-1 flex items-center gap-1">
                    {playersHere.slice(0, 4).map((p) => {
                      const isMe = p.id === user.id;
                      return (
                        <button
                          key={p.id}
                          onClick={() => !isMe && openRoleplay(p)}
                          disabled={isMe}
                          title={isMe ? `${p.name}（你自己）` : `与 ${p.name} 对戏`}
                          className={`w-7 h-7 rounded-full border-2 overflow-hidden shadow ${
                            isMe ? 'border-emerald-300 cursor-default' : 'border-white hover:scale-110'
                          }`}
                        >
                          <img
                            src={p.avatarUrl || 'https://placehold.co/40x40?text=U'}
                            alt={p.name}
                            className="w-full h-full object-cover"
                          />
                        </button>
                      );
                    })}
                    {playersHere.length > 4 && (
                      <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-black/70 text-white">
                        +{playersHere.length - 4}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* 侧栏 */}
        <aside className="bg-white border border-slate-200 rounded-2xl p-4 h-fit">
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

          <div className="mt-4">
            <h3 className="font-black mb-2">同地点玩家</h3>
            {nearbyPlayers.length === 0 ? (
              <div className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-xl p-3">
                当前地点暂无可互动玩家
              </div>
            ) : (
              <div className="space-y-2">
                {nearbyPlayers.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => openRoleplay(p)}
                    className="w-full flex items-center gap-2 p-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-left"
                  >
                    <img
                      src={p.avatarUrl || 'https://placehold.co/40x40?text=U'}
                      alt={p.name}
                      className="w-8 h-8 rounded-full object-cover"
                    />
                    <div className="min-w-0">
                      <div className="text-sm font-bold truncate">{p.name}</div>
                      <div className="text-[11px] text-slate-500 truncate">{p.role || '未知身份'}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </aside>
      </main>

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

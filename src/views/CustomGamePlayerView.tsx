import React, { useEffect, useState } from 'react';
import { User } from '../types';

interface Props {
  user: User;
  showToast: (msg: string) => void;
  onEnterRun: (gameId: number) => void;
}

interface GameRow {
  id: number;
  title: string;
  status: string;
  vote_status?: string;
  created_at?: string;
}

type ActiveRunState = Record<number, { hasActive: boolean; runId: number | null }>;

const authHeaders = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${localStorage.getItem('USER_TOKEN') || ''}`
});

export function CustomGamePlayerView({ user, showToast, onEnterRun }: Props) {
  const [rows, setRows] = useState<GameRow[]>([]);
  const [activeRuns, setActiveRuns] = useState<ActiveRunState>({});
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<number>(0);

  const loadMine = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/custom-games/mine', { headers: authHeaders() });
      const data = await res.json().catch(() => ([] as any[]));
      if (!res.ok) {
        showToast('读取灾厄游戏列表失败');
        return;
      }

      const games = (Array.isArray(data) ? data : []).map((x: any) => ({
        id: Number(x.id || 0),
        title: String(x.title || `灾厄游戏#${x.id}`),
        status: String(x.status || '-'),
        vote_status: String(x.vote_status || ''),
        created_at: String(x.created_at || '')
      }));
      setRows(games);

      const states: ActiveRunState = {};
      await Promise.all(
        games.map(async (g) => {
          if (!g.id) return;
          const r = await fetch(`/api/custom-games/${g.id}/run/active`, { headers: authHeaders() });
          const d = await r.json().catch(() => ({} as any));
          states[g.id] = {
            hasActive: Boolean(d?.hasActive),
            runId: d?.runId ? Number(d.runId) : null
          };
        })
      );
      setActiveRuns(states);
    } catch {
      showToast('网络异常，读取灾厄游戏列表失败');
    } finally {
      setLoading(false);
    }
  };

  const joinAndEnter = async (gameId: number) => {
    if (!gameId) return;
    setBusyId(gameId);
    try {
      const res = await fetch(`/api/custom-games/${gameId}/run/join`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({})
      });
      const data = await res.json().catch(() => ({} as any));
      if (!res.ok) {
        showToast(data.message || '加入灾厄地图失败');
        return;
      }
      showToast('已进入灾厄地图');
      onEnterRun(gameId);
    } catch {
      showToast('网络异常，加入灾厄地图失败');
    } finally {
      setBusyId(0);
    }
  };

  useEffect(() => {
    loadMine();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id]);

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-white font-black">我的灾厄游戏</h4>
        <button
          onClick={loadMine}
          className="px-3 py-1 rounded bg-slate-700 text-white text-xs font-bold hover:bg-slate-600"
        >
          刷新
        </button>
      </div>

      {loading && <div className="text-xs text-slate-400">加载中...</div>}

      {!loading && rows.length === 0 && (
        <div className="text-sm text-slate-400">你还没有创建过灾厄游戏。</div>
      )}

      <div className="space-y-2">
        {rows.map((g) => {
          const active = activeRuns[g.id];
          const canEnter = Boolean(active?.hasActive);
          return (
            <div key={`cg-${g.id}`} className="rounded-xl border border-slate-700 bg-slate-800/60 p-3">
              <div className="text-sm font-black text-white">{g.title}</div>
              <div className="text-[11px] text-slate-400 mt-1">
                状态：{g.status} {g.vote_status ? `| 投票：${g.vote_status}` : ''}
              </div>
              <div className="mt-2">
                <button
                  onClick={() => joinAndEnter(g.id)}
                  disabled={!canEnter || busyId === g.id}
                  className={`px-3 py-1.5 text-xs font-black rounded ${
                    canEnter
                      ? 'bg-rose-600 text-white hover:bg-rose-500'
                      : 'bg-slate-700 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  {busyId === g.id ? '进入中...' : canEnter ? '进入灾厄地图' : '未开局'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

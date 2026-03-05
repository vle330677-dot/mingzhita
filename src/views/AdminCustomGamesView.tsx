import React, { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../utils/http';

type AnyGame = Record<string, any>;

export function AdminCustomGamesView() {
  const [ideaList, setIdeaList] = useState<AnyGame[]>([]);
  const [mapList, setMapList] = useState<AnyGame[]>([]);
  const [startList, setStartList] = useState<AnyGame[]>([]);
  const [comment, setComment] = useState('');
  const [voteStats, setVoteStats] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(false);

  const formatReviewStatus = (raw: unknown) => {
    const key = String(raw || '').toLowerCase();
    const map: Record<string, string> = {
      pending: '待审核',
      approved: '已通过',
      rejected: '已驳回',
      voting: '投票中',
      open: '已开启',
      closed: '已关闭',
      active: '进行中',
      ended: '已结束'
    };
    return map[key] || String(raw || '-');
  };

  const formatVoteStatus = (raw: unknown) => {
    const key = String(raw || '').toLowerCase();
    const map: Record<string, string> = {
      open: '进行中',
      closed: '已结束',
      pending: '待开始',
      passed: '已通过',
      rejected: '未通过'
    };
    return map[key] || String(raw || '-');
  };

  const normalizedMapList = useMemo(
    () =>
      mapList.map((m) => ({
        ...m,
        title: `${String(m.game_title || '未命名灾厄局')} · 地图v${Number(m.version || 1)}`,
        creatorLabel: `地图#${Number(m.id || 0)} / 游戏#${Number(m.game_id || 0)}`
      })),
    [mapList]
  );

  const loadAll = async () => {
    setLoading(true);
    try {
      const [ideas, maps, starts] = await Promise.all([
        apiFetch<any[]>('/api/custom-games/admin/review/ideas/pending', { auth: 'admin' }),
        apiFetch<any[]>('/api/custom-games/admin/review/maps/pending', { auth: 'admin' }),
        apiFetch<any[]>('/api/custom-games/admin/review/start/pending', { auth: 'admin' })
      ]);
      setIdeaList(Array.isArray(ideas) ? ideas : []);
      setMapList(Array.isArray(maps) ? maps : []);
      setStartList(Array.isArray(starts) ? starts : []);
    } catch (e: any) {
      alert(e?.message || '加载灾厄游戏审核列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const reviewIdea = async (id: number, decision: 'approved' | 'rejected') => {
    try {
      await apiFetch(`/api/custom-games/admin/review/idea/${id}`, {
        method: 'POST',
        auth: 'admin',
        body: { approve: decision === 'approved', comment }
      });
      await loadAll();
    } catch (e: any) {
      alert(e?.message || '创意审核失败');
    }
  };

  const reviewMap = async (mapId: number, decision: 'approved' | 'rejected') => {
    try {
      await apiFetch(`/api/custom-games/admin/review/map/${mapId}`, {
        method: 'POST',
        auth: 'admin',
        body: { approve: decision === 'approved', comment }
      });
      await loadAll();
    } catch (e: any) {
      alert(e?.message || '地图审核失败');
    }
  };

  const reviewStart = async (gameId: number, decision: 'approved' | 'rejected') => {
    try {
      await apiFetch(`/api/custom-games/admin/review/start/${gameId}`, {
        method: 'POST',
        auth: 'admin',
        body: { approve: decision === 'approved', comment }
      });
      await loadAll();
    } catch (e: any) {
      alert(e?.message || '开局审核失败');
    }
  };

  const openVote = async (id: number) => {
    try {
      const data = await apiFetch<any>(`/api/custom-games/${id}/vote/open`, {
        method: 'POST',
        auth: 'admin'
      });
      alert(`投票已开启，截止时间：${data?.voteEndsAt || '未知'}`);
      await loadAll();
    } catch (e: any) {
      alert(e?.message || '开启投票失败');
    }
  };

  const fetchVoteStatus = async (id: number) => {
    try {
      const data = await apiFetch<any>(`/api/custom-games/${id}/vote/status`, { auth: 'admin' });
      setVoteStats((prev) => ({ ...prev, [id]: data }));
    } catch (e: any) {
      alert(e?.message || '查询票数失败');
    }
  };

  const closeAndJudge = async (id: number) => {
    const ok = window.confirm('确认关票并判定开局结果？');
    if (!ok) return;
    try {
      const data = await apiFetch<any>(`/api/custom-games/${id}/vote/close-and-judge`, {
        method: 'POST',
        auth: 'admin'
      });
      alert(data?.passed ? '投票通过，副本已开启' : '投票未通过');
      await loadAll();
    } catch (e: any) {
      alert(e?.message || '判定失败');
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white border rounded-2xl p-4">
        <h3 className="font-black mb-2">审核备注</h3>
        <input
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          className="w-full p-2 border rounded"
          placeholder="驳回原因（可选）"
        />
        {loading && <div className="text-xs text-slate-500 mt-2">加载中...</div>}
      </div>

      <Block
        title="创意待审"
        list={ideaList}
        subtitle={(g) => `创建者#${Number(g.creator_user_id || 0)} / ${formatReviewStatus(g.status)}`}
        onApprove={(id) => reviewIdea(id, 'approved')}
        onReject={(id) => reviewIdea(id, 'rejected')}
      />

      <Block
        title="地图待审"
        list={normalizedMapList}
        subtitle={(g) => `${g.creatorLabel} / ${formatReviewStatus(g.status)}`}
        onApprove={(id) => reviewMap(id, 'approved')}
        onReject={(id) => reviewMap(id, 'rejected')}
      />

      <div className="bg-white border rounded-2xl p-4">
        <h3 className="font-black mb-3">开局待审</h3>
        {startList.length === 0 ? (
          <div className="text-slate-400 text-sm">暂无</div>
        ) : (
          <div className="space-y-2">
            {startList.map((g) => {
              const gameId = Number(g.id || 0);
              const vote = voteStats[gameId];
              return (
                <div key={gameId} className="border rounded p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-bold">{String(g.title || `游戏#${gameId}`)}</div>
                      <div className="text-xs text-slate-500">
                        创建者#{Number(g.creator_user_id || 0)} / {formatReviewStatus(g.status)}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => reviewStart(gameId, 'approved')}
                        className="px-3 py-1.5 bg-emerald-600 text-white rounded font-bold"
                      >
                        通过开局审核
                      </button>
                      <button
                        onClick={() => reviewStart(gameId, 'rejected')}
                        className="px-3 py-1.5 bg-rose-600 text-white rounded font-bold"
                      >
                        驳回开局审核
                      </button>
                      <button
                        onClick={() => openVote(gameId)}
                        className="px-3 py-1.5 bg-sky-600 text-white rounded font-bold"
                      >
                        开启全服投票
                      </button>
                      <button
                        onClick={() => closeAndJudge(gameId)}
                        className="px-3 py-1.5 bg-purple-600 text-white rounded font-bold"
                      >
                        关票并判定
                      </button>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button onClick={() => fetchVoteStatus(gameId)} className="px-3 py-1.5 bg-slate-700 text-white rounded font-bold">
                      查看票数
                    </button>
                    {vote && (
                      <div className="text-xs text-slate-600 bg-slate-100 px-2 py-1 rounded">
                        同意:{Number(vote.yesCount || 0)} / 反对:{Number(vote.noCount || 0)} / 总票:{Number(vote.total || 0)} / 状态:{formatVoteStatus(vote.voteStatus)}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <button onClick={loadAll} className="px-4 py-2 bg-slate-900 text-white rounded font-bold">
        刷新
      </button>
    </div>
  );
}

function Block({
  title,
  list,
  subtitle,
  onApprove,
  onReject
}: {
  title: string;
  list: any[];
  subtitle: (item: any) => string;
  onApprove: (id: number) => void;
  onReject: (id: number) => void;
}) {
  return (
    <div className="bg-white border rounded-2xl p-4">
      <h3 className="font-black mb-3">{title}</h3>
      {list.length === 0 ? (
        <div className="text-slate-400 text-sm">暂无</div>
      ) : (
        <div className="space-y-2">
          {list.map((g) => {
            const id = Number(g.id || 0);
            return (
              <div key={`${title}-${id}`} className="border rounded p-3 flex items-center justify-between">
                <div>
                  <div className="font-bold">{String(g.title || `编号:${id}`)}</div>
                  <div className="text-xs text-slate-500">{subtitle(g)}</div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => onApprove(id)} className="px-3 py-1.5 bg-emerald-600 text-white rounded font-bold">
                    通过
                  </button>
                  <button onClick={() => onReject(id)} className="px-3 py-1.5 bg-rose-600 text-white rounded font-bold">
                    驳回
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

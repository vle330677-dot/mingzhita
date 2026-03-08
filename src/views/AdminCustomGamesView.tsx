import React, { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../utils/http';

type AnyGame = Record<string, any>;

export function AdminCustomGamesView() {
  const [ideaList, setIdeaList] = useState<AnyGame[]>([]);
  const [mapList, setMapList] = useState<AnyGame[]>([]);
  const [startList, setStartList] = useState<AnyGame[]>([]);
  const [voteQueueList, setVoteQueueList] = useState<AnyGame[]>([]);
  const [comment, setComment] = useState('');
  const [voteStats, setVoteStats] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(false);
  const [resultMsg, setResultMsg] = useState('');

  const showMsg = (msg: string) => {
    setResultMsg(msg);
    window.setTimeout(() => setResultMsg(''), 4000);
  };

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
      ended: '已结束',
      idea_pending: '创意待审',
      idea_approved: '创意通过',
      idea_rejected: '创意驳回',
      map_pending: '地图待审',
      map_rejected: '地图驳回',
      ready_for_start: '待开局申请',
      start_pending: '开局待审',
      start_rejected: '开局驳回',
      ready_for_vote: '待全服投票',
      running: '运行中',
      vote_failed: '投票失败',
    };
    return map[key] || String(raw || '-');
  };

  const formatVoteStatus = (raw: unknown) => {
    const key = String(raw || '').toLowerCase();
    const map: Record<string, string> = {
      open: '进行中',
      closed: '已关闭',
      pending: '待开启',
      passed: '已通过',
      rejected: '未通过',
      none: '未开启',
    };
    return map[key] || String(raw || '-');
  };

  const normalizedMapList = useMemo(
    () =>
      mapList.map((m) => ({
        ...m,
        title: `${String(m.game_title || '未命名灾厄局')} · 地图版本 ${Number(m.version || 1)}`,
        creatorLabel: `地图#${Number(m.id || 0)} / 游戏#${Number(m.game_id || 0)}`,
      })),
    [mapList]
  );

  const loadAll = async () => {
    setLoading(true);
    try {
      const [ideas, maps, starts, votes] = await Promise.all([
        apiFetch<any[]>('/api/custom-games/admin/review/ideas/pending', { auth: 'admin' }),
        apiFetch<any[]>('/api/custom-games/admin/review/maps/pending', { auth: 'admin' }),
        apiFetch<any[]>('/api/custom-games/admin/review/start/pending', { auth: 'admin' }),
        apiFetch<any[]>('/api/custom-games/admin/review/votes/queue', { auth: 'admin' }),
      ]);
      setIdeaList(Array.isArray(ideas) ? ideas : []);
      setMapList(Array.isArray(maps) ? maps : []);
      setStartList(Array.isArray(starts) ? starts : []);
      setVoteQueueList(Array.isArray(votes) ? votes : []);
    } catch (e: any) {
      alert(e?.message || '加载灾厄游戏审核列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const deleteGame = async (gameId: number, title: string) => {
    if (!gameId) return;
    const ok = window.confirm(`确定删除这条灾厄申请吗？\n${title || `游戏#${gameId}`}\n\n这会连同地图、审核票和残留申请一起删除。`);
    if (!ok) return;
    try {
      const data = await apiFetch<any>(`/api/custom-games/admin/review/game/${gameId}`, {
        method: 'DELETE',
        auth: 'admin',
      });
      showMsg(data?.message || `已删除 ${title || `游戏#${gameId}`}`);
      await loadAll();
    } catch (e: any) {
      showMsg(e?.message || '删除灾厄申请失败');
    }
  };

  const reviewIdea = async (id: number, decision: 'approved' | 'rejected') => {
    try {
      const data = await apiFetch<any>(`/api/custom-games/admin/review/idea/${id}`, {
        method: 'POST',
        auth: 'admin',
        body: { approve: decision === 'approved', comment },
      });
      if (data?.pending) {
        showMsg(`已记录审核票（${data.approveCount}/${data.required} 通过，${data.rejectCount}/${data.required} 驳回），等待其他管理员会签`);
      } else {
        showMsg(decision === 'approved' ? '创意审核通过，设计者现在可以绘制地图' : '创意已驳回');
      }
      await loadAll();
    } catch (e: any) {
      showMsg(`创意审核失败：${e?.message || '未知错误'}`);
    }
  };

  const reviewMap = async (mapId: number, decision: 'approved' | 'rejected') => {
    try {
      const data = await apiFetch<any>(`/api/custom-games/admin/review/map/${mapId}`, {
        method: 'POST',
        auth: 'admin',
        body: { approve: decision === 'approved', comment },
      });
      if (data?.pending) {
        showMsg(`已记录审核票（${data.approveCount}/${data.required} 通过，${data.rejectCount}/${data.required} 驳回），等待其他管理员会签`);
      } else {
        showMsg(decision === 'approved' ? '地图审核通过，游戏已进入可开局状态' : '地图已驳回，设计者需重新提交');
      }
      await loadAll();
    } catch (e: any) {
      showMsg(`地图审核失败：${e?.message || '未知错误'}`);
    }
  };

  const reviewStart = async (gameId: number, decision: 'approved' | 'rejected') => {
    try {
      const data = await apiFetch<any>(`/api/custom-games/admin/review/start/${gameId}`, {
        method: 'POST',
        auth: 'admin',
        body: { approve: decision === 'approved', comment },
      });
      if (data?.pending) {
        showMsg(`已记录审核票（${data.approveCount}/${data.required} 通过，${data.rejectCount}/${data.required} 驳回），等待其他管理员会签`);
      } else {
        showMsg(decision === 'approved' ? '开局审核通过，现在可开启全服投票' : '开局申请已驳回');
      }
      await loadAll();
    } catch (e: any) {
      showMsg(`开局审核失败：${e?.message || '未知错误'}`);
    }
  };

  const openVote = async (id: number) => {
    try {
      const data = await apiFetch<any>(`/api/custom-games/${id}/vote/open`, {
        method: 'POST',
        auth: 'admin',
      });
      showMsg(`全服投票已开启，截止时间：${data?.voteEndsAt || '未知'}`);
      await loadAll();
      await fetchVoteStatus(id);
    } catch (e: any) {
      showMsg(`开启投票失败：${e?.message || '未知错误'}`);
    }
  };

  const fetchVoteStatus = async (id: number) => {
    try {
      const data = await apiFetch<any>(`/api/custom-games/${id}/vote/status`, { auth: 'admin' });
      setVoteStats((prev) => ({ ...prev, [id]: data }));
    } catch (e: any) {
      showMsg(`查询票数失败：${e?.message || '未知错误'}`);
    }
  };

  const closeAndJudge = async (id: number) => {
    const ok = window.confirm('确认关票并判定开局结果？');
    if (!ok) return;
    try {
      const data = await apiFetch<any>(`/api/custom-games/${id}/vote/close-and-judge`, {
        method: 'POST',
        auth: 'admin',
      });
      showMsg(data?.passed ? '投票通过，灾厄副本已开启' : '投票未通过，未满足半数同意');
      await loadAll();
      if (!data?.passed) {
        await fetchVoteStatus(id);
      }
    } catch (e: any) {
      showMsg(`判定失败：${e?.message || '未知错误'}`);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white border rounded-2xl p-4 space-y-3">
        <h3 className="font-black">审核备注（可选）</h3>
        <input
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          className="w-full p-2 border rounded"
          placeholder="填写驳回原因或说明"
        />
        {resultMsg && (
          <div className="px-3 py-2 rounded-lg bg-slate-100 border border-slate-300 text-sm font-bold text-slate-700">
            {resultMsg}
          </div>
        )}
        {loading && <div className="text-xs text-slate-500">加载中...</div>}
      </div>

      <Block
        title="创意待审"
        list={ideaList}
        subtitle={(g) => `创建者 #${Number(g.creator_user_id || 0)} · ${formatReviewStatus(g.status)}`}
        body={(g) =>
          g.idea_text ? <p className="text-xs text-slate-500 mt-1 line-clamp-3">{String(g.idea_text)}</p> : null
        }
        onApprove={(id) => reviewIdea(id, 'approved')}
        onReject={(id) => reviewIdea(id, 'rejected')}
        onDelete={(item) => deleteGame(Number(item.id || 0), String(item.title || `游戏#${Number(item.id || 0)}`))}
      />

      <Block
        title="地图待审"
        list={normalizedMapList}
        subtitle={(g) => `${String(g.creatorLabel || '')} · ${formatReviewStatus(g.status)}`}
        body={(g) => (
          <p className="text-xs text-slate-500 mt-1">创建者 #{Number(g.game_creator_user_id || 0)}</p>
        )}
        onApprove={(id) => reviewMap(id, 'approved')}
        onReject={(id) => reviewMap(id, 'rejected')}
        onDelete={(item) => deleteGame(Number(item.game_id || 0), String(item.game_title || item.title || `游戏#${Number(item.game_id || 0)}`))}
      />

      <div className="bg-white border rounded-2xl p-4">
        <h3 className="font-black mb-3">开局待审</h3>
        {startList.length === 0 ? (
          <div className="text-slate-400 text-sm">暂无</div>
        ) : (
          <div className="space-y-2">
            {startList.map((g) => {
              const gameId = Number(g.id || 0);
              return (
                <div key={gameId} className="border rounded p-3 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-bold">{String(g.title || `游戏#${gameId}`)}</div>
                      <div className="text-xs text-slate-500">
                        创建者 #{Number(g.creator_user_id || 0)} · {formatReviewStatus(g.status)}
                      </div>
                    </div>
                    <button
                      onClick={() => deleteGame(gameId, String(g.title || `游戏#${gameId}`))}
                      className="px-3 py-1.5 bg-slate-200 text-slate-700 rounded font-bold text-sm hover:bg-slate-300"
                    >
                      删除申请
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => reviewStart(gameId, 'approved')}
                      className="px-3 py-1.5 bg-emerald-600 text-white rounded font-bold text-sm"
                    >
                      通过开局
                    </button>
                    <button
                      onClick={() => reviewStart(gameId, 'rejected')}
                      className="px-3 py-1.5 bg-rose-600 text-white rounded font-bold text-sm"
                    >
                      驳回开局
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="bg-white border rounded-2xl p-4">
        <h3 className="font-black mb-3">投票管理</h3>
        {voteQueueList.length === 0 ? (
          <div className="text-slate-400 text-sm">暂无待处理项目</div>
        ) : (
          <div className="space-y-2">
            {voteQueueList.map((g) => {
              const gameId = Number(g.id || 0);
              const vote = voteStats[gameId];
              const voteOpen = String(g.vote_status || '').toLowerCase() === 'open';
              const canOpenVote = ['ready_for_vote', 'ready_for_start', 'vote_failed'].includes(String(g.status || '').toLowerCase()) && !voteOpen;
              const canJudge = voteOpen;
              return (
                <div key={`vote-${gameId}`} className="border rounded p-3 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-bold">{String(g.title || `游戏#${gameId}`)}</div>
                      <div className="text-xs text-slate-500">
                        创建者 #{Number(g.creator_user_id || 0)} · {formatReviewStatus(g.status)} · 投票 {formatVoteStatus(g.vote_status)}
                      </div>
                    </div>
                    <button
                      onClick={() => deleteGame(gameId, String(g.title || `游戏#${gameId}`))}
                      className="px-3 py-1.5 bg-slate-200 text-slate-700 rounded font-bold text-sm hover:bg-slate-300"
                    >
                      删除申请
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => openVote(gameId)}
                      disabled={!canOpenVote}
                      className="px-3 py-1.5 bg-sky-600 text-white rounded font-bold text-sm disabled:opacity-50"
                    >
                      开启全服投票
                    </button>
                    <button
                      onClick={() => closeAndJudge(gameId)}
                      disabled={!canJudge}
                      className="px-3 py-1.5 bg-violet-600 text-white rounded font-bold text-sm disabled:opacity-50"
                    >
                      关票并判定
                    </button>
                    <button
                      onClick={() => fetchVoteStatus(gameId)}
                      className="px-3 py-1.5 bg-slate-700 text-white rounded font-bold text-sm"
                    >
                      查看票数
                    </button>
                  </div>

                  {vote && (
                    <div className="text-xs text-slate-600 bg-slate-100 px-2 py-1 rounded">
                      同意 {Number(vote.yesCount || 0)} · 反对 {Number(vote.noCount || 0)} · 总计 {Number(vote.total || 0)} · {formatVoteStatus(vote.voteStatus)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <button onClick={loadAll} className="px-4 py-2 bg-slate-900 text-white rounded font-bold">
        刷新列表
      </button>
    </div>
  );
}

function Block({
  title,
  list,
  subtitle,
  body,
  onApprove,
  onReject,
  onDelete,
}: {
  title: string;
  list: any[];
  subtitle: (item: any) => string;
  body: (item: any) => React.ReactNode;
  onApprove: (id: number) => void;
  onReject: (id: number) => void;
  onDelete?: (item: any) => void;
}) {
  return (
    <div className="bg-white border rounded-2xl p-4">
      <h3 className="font-black mb-3">{title}</h3>
      {list.length === 0 ? (
        <div className="text-slate-400 text-sm">暂无待审项目</div>
      ) : (
        <div className="space-y-2">
          {list.map((g) => {
            const id = Number(g.id || 0);
            return (
              <div key={`${title}-${id}`} className="border rounded p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="overflow-hidden">
                    <div className="font-bold truncate">{String(g.title || `编号:${id}`)}</div>
                    <div className="text-xs text-slate-500">{subtitle(g)}</div>
                    {body(g)}
                  </div>
                  <div className="flex gap-2 shrink-0 flex-wrap justify-end">
                    <button onClick={() => onApprove(id)} className="px-3 py-1.5 bg-emerald-600 text-white rounded font-bold text-sm">
                      通过
                    </button>
                    <button onClick={() => onReject(id)} className="px-3 py-1.5 bg-rose-600 text-white rounded font-bold text-sm">
                      驳回
                    </button>
                    {onDelete && (
                      <button onClick={() => onDelete(g)} className="px-3 py-1.5 bg-slate-200 text-slate-700 rounded font-bold text-sm hover:bg-slate-300">
                        删除申请
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

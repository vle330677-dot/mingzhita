import React, { useEffect, useMemo, useState } from 'react';
import { User } from '../types';
import { ApiError, apiFetch } from '../utils/http';
import { BuiltDropJson, BuiltMapJson, CreatorMapBuilder, TimelineStageConfig } from './CreatorMapBuilder';

interface Props {
  user: User;
  showToast: (msg: string) => void;
  onEnterRun: (gameId: number) => void;
}

interface GameRow {
  id: number;
  title: string;
  status: string;
  idea_text?: string;
  vote_status?: string;
  created_at?: string;
  current_map_id?: number | null;
  vote_ends_at?: string | null;
}

interface MapRow {
  id: number;
  version: number;
  status: string;
  map_data: any;
}

type ActiveRunState = Record<number, { hasActive: boolean; runId: number | null }>;

const clampStageCount = (count: number) => Math.max(1, Math.min(12, Number(count || 0) || 1));

const buildDefaultStages = (count: number): TimelineStageConfig[] =>
  Array.from({ length: clampStageCount(count) }).map((_, index) => ({
    index: index + 1,
    name: `阶段${index + 1}`,
    desc: '',
  }));

const STATUS_LABELS: Record<string, string> = {
  idea_pending: '创意待审',
  idea_approved: '创意通过',
  idea_rejected: '创意驳回',
  map_pending: '地图待审',
  map_rejected: '地图驳回',
  ready_for_start: '待开局申请',
  start_pending: '开局待审',
  start_rejected: '开局驳回',
  ready_for_vote: '待全服投票',
  vote_failed: '投票失败',
  running: '运行中',
  ended: '已结束',
};

const VOTE_STATUS_LABELS: Record<string, string> = {
  none: '未开启',
  open: '进行中',
  closed: '已关闭',
  passed: '已通过',
  rejected: '未通过',
};

const createEmptyMap = (): BuiltMapJson => ({
  mapName: '',
  backgroundImage: '',
  announcementText: '',
  layoutRuleText: '',
  currencyName: '灾厄币',
  totalStages: 3,
  stageConfigs: buildDefaultStages(3),
  points: [],
  bindings: [],
});

const createEmptyDrop = (): BuiltDropJson => ({
  defaultPointId: undefined,
  points: [],
});

function toStatusLabel(status: string) {
  return STATUS_LABELS[String(status || '').toLowerCase()] || String(status || '-');
}

function toVoteStatusLabel(status: string) {
  return VOTE_STATUS_LABELS[String(status || '').toLowerCase()] || String(status || '未开启');
}

function normalizeStoredMapData(raw: any) {
  const data = raw && typeof raw === 'object' ? raw : {};
  const rawMap = data.mapJson && typeof data.mapJson === 'object' ? data.mapJson : data;
  const rawDrop = data.dropPointJson && typeof data.dropPointJson === 'object' ? data.dropPointJson : {};

  const nextMap: BuiltMapJson = {
    mapName: String(rawMap?.mapName || ''),
    backgroundImage: rawMap?.backgroundImage ? String(rawMap.backgroundImage) : '',
    announcementText: rawMap?.announcementText ? String(rawMap.announcementText) : '',
    layoutRuleText: rawMap?.layoutRuleText ? String(rawMap.layoutRuleText) : '',
    currencyName: rawMap?.currencyName ? String(rawMap.currencyName) : '灾厄币',
    totalStages: clampStageCount(rawMap?.totalStages || rawMap?.stageConfigs?.length || 3),
    stageConfigs: Array.isArray(rawMap?.stageConfigs) && rawMap.stageConfigs.length
      ? rawMap.stageConfigs.map((item: any, index: number) => ({
          index: index + 1,
          name: String(item?.name || `阶段${index + 1}`),
          desc: String(item?.desc || ''),
        }))
      : buildDefaultStages(rawMap?.totalStages || 3),
    points: Array.isArray(rawMap?.points) ? rawMap.points : [],
    bindings: Array.isArray(rawMap?.bindings) ? rawMap.bindings : [],
  };

  const nextDrop: BuiltDropJson = {
    defaultPointId: rawDrop?.defaultPointId ? String(rawDrop.defaultPointId) : undefined,
    points: Array.isArray(rawDrop?.points) ? rawDrop.points : [],
  };

  return { mapJson: nextMap, dropPointJson: nextDrop };
}

export function CustomGamePlayerView({ user, showToast, onEnterRun }: Props) {
  const [rows, setRows] = useState<GameRow[]>([]);
  const [activeRuns, setActiveRuns] = useState<ActiveRunState>({});
  const [selectedGameId, setSelectedGameId] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<number>(0);
  const [mapLoading, setMapLoading] = useState(false);
  const [mapSubmitting, setMapSubmitting] = useState(false);
  const [startSubmitting, setStartSubmitting] = useState(false);
  const [creating, setCreating] = useState(false);
  const [latestMapId, setLatestMapId] = useState<number>(0);
  const [latestMapVersion, setLatestMapVersion] = useState<number>(0);
  const [latestMapStatus, setLatestMapStatus] = useState<string>('');
  const [mapDraft, setMapDraft] = useState<BuiltMapJson>(createEmptyMap);
  const [dropDraft, setDropDraft] = useState<BuiltDropJson>(createEmptyDrop);
  const [newTitle, setNewTitle] = useState('');
  const [newIdeaText, setNewIdeaText] = useState('');

  const selectedGame = useMemo(
    () => rows.find((row) => Number(row.id || 0) === Number(selectedGameId || 0)) || null,
    [rows, selectedGameId]
  );

  const selectedRun = selectedGame ? activeRuns[selectedGame.id] : null;
  const canEnterRun = Boolean(selectedGame?.id && selectedRun?.hasActive);
  const canSubmitMap = ['idea_approved', 'map_rejected', 'ready_for_start'].includes(String(selectedGame?.status || ''));
  const canRequestStart = String(selectedGame?.status || '') === 'ready_for_start';

  const updateTimelineCount = (value: number) => {
    const totalStages = clampStageCount(value);
    setMapDraft((prev) => {
      const current = Array.isArray(prev.stageConfigs) ? prev.stageConfigs : [];
      const stageConfigs = Array.from({ length: totalStages }).map((_, index) => ({
        index: index + 1,
        name: String(current[index]?.name || `阶段${index + 1}`),
        desc: String(current[index]?.desc || ''),
      }));
      return { ...prev, totalStages, stageConfigs };
    });
  };

  const updateTimelineStage = (index: number, patch: Partial<TimelineStageConfig>) => {
    setMapDraft((prev) => {
      const totalStages = clampStageCount(prev.totalStages || prev.stageConfigs?.length || 3);
      const current = Array.isArray(prev.stageConfigs) && prev.stageConfigs.length
        ? [...prev.stageConfigs]
        : buildDefaultStages(totalStages);
      current[index] = {
        index: index + 1,
        name: String(patch.name ?? current[index]?.name ?? `阶段${index + 1}`),
        desc: String(patch.desc ?? current[index]?.desc ?? ''),
      };
      return { ...prev, totalStages, stageConfigs: current };
    });
  };

  const workflowHint = useMemo(() => {
    const status = String(selectedGame?.status || '');
    switch (status) {
      case 'idea_pending':
        return '创意已提交，等待管理员审核。';
      case 'idea_approved':
        return '创意已通过，现在可以绘制并提交自定义地图。';
      case 'idea_rejected':
        return '创意被驳回，请重新创建新的灾厄申请。';
      case 'map_pending':
        return '地图已提交，等待管理员审核。';
      case 'map_rejected':
        return '地图已被驳回，可以继续修改后重新提交。';
      case 'ready_for_start':
        return '地图已审核通过，可以继续提交新版本，或直接申请开局。';
      case 'start_pending':
        return '开局申请已提交，等待管理员审核。';
      case 'start_rejected':
        return '开局申请被驳回，确认地图内容后可再次申请。';
      case 'ready_for_vote':
        return '开局审核已通过，等待管理员开启全服投票。';
      case 'vote_failed':
        return '上轮投票未通过，等待管理员重新开启投票。';
      case 'running':
        return '灾厄局已开局，可以直接进入运行中的地图。';
      case 'ended':
        return '本局已结束。';
      default:
        return '选择一条灾厄申请后，可在这里继续制作地图。';
    }
  }, [selectedGame?.status]);

  const loadMine = async () => {
    setLoading(true);
    try {
      const data = await apiFetch<any[]>('/api/custom-games/mine', { auth: 'user' });
      const games = (Array.isArray(data) ? data : []).map((x: any) => ({
        id: Number(x.id || 0),
        title: String(x.title || `灾厄游戏#${x.id}`),
        status: String(x.status || '-'),
        idea_text: String(x.idea_text || ''),
        vote_status: String(x.vote_status || 'none'),
        created_at: x.created_at ? String(x.created_at) : '',
        current_map_id: x.current_map_id ? Number(x.current_map_id) : null,
        vote_ends_at: x.vote_ends_at ? String(x.vote_ends_at) : null,
      }));
      setRows(games);

      const states: ActiveRunState = {};
      await Promise.all(
        games.map(async (g) => {
          if (!g.id) return;
          try {
            const run = await apiFetch<{ hasActive: boolean; runId: number | null }>(
              `/api/custom-games/${g.id}/run/active`,
              { auth: 'user' }
            );
            states[g.id] = {
              hasActive: Boolean(run?.hasActive),
              runId: run?.runId ? Number(run.runId) : null,
            };
          } catch {
            states[g.id] = { hasActive: false, runId: null };
          }
        })
      );
      setActiveRuns(states);

      setSelectedGameId((prev) => {
        if (games.some((item) => Number(item.id) === Number(prev))) return prev;
        return Number(games[0]?.id || 0);
      });
    } catch (e: any) {
      showToast(e?.message || '读取灾厄游戏列表失败');
    } finally {
      setLoading(false);
    }
  };

  const loadLatestMap = async (gameId: number) => {
    if (!gameId) {
      setLatestMapId(0);
      setLatestMapVersion(0);
      setLatestMapStatus('');
      setMapDraft(createEmptyMap());
      setDropDraft(createEmptyDrop());
      return;
    }

    setMapLoading(true);
    try {
      const row = await apiFetch<MapRow>(`/api/custom-games/${gameId}/map/latest`, { auth: 'user' });
      const normalized = normalizeStoredMapData(row?.map_data);
      setLatestMapId(Number(row?.id || 0));
      setLatestMapVersion(Number(row?.version || 0));
      setLatestMapStatus(String(row?.status || ''));
      setMapDraft(normalized.mapJson);
      setDropDraft(normalized.dropPointJson);
    } catch (e: any) {
      if (e instanceof ApiError && e.status === 404) {
        setLatestMapId(0);
        setLatestMapVersion(0);
        setLatestMapStatus('');
        setMapDraft(createEmptyMap());
        setDropDraft(createEmptyDrop());
      } else {
        showToast(e?.message || '读取地图配置失败');
      }
    } finally {
      setMapLoading(false);
    }
  };

  const joinAndEnter = async (gameId: number) => {
    if (!gameId) return;
    setBusyId(gameId);
    try {
      await apiFetch(`/api/custom-games/${gameId}/run/join`, {
        method: 'POST',
        auth: 'user',
        body: {},
      });
      showToast('已进入灾厄地图');
      onEnterRun(gameId);
    } catch (e: any) {
      showToast(e?.message || '加入灾厄地图失败');
    } finally {
      setBusyId(0);
    }
  };

  const createGame = async () => {
    const title = newTitle.trim();
    const ideaText = newIdeaText.trim();
    if (!title) {
      showToast('请填写灾厄标题');
      return;
    }
    if (!ideaText) {
      showToast('请填写灾厄创意');
      return;
    }

    setCreating(true);
    try {
      const data = await apiFetch<any>('/api/custom-games', {
        method: 'POST',
        auth: 'user',
        body: { title, ideaText },
      });
      setNewTitle('');
      setNewIdeaText('');
      showToast(data?.message || '灾厄申请已提交');
      await loadMine();
      setSelectedGameId(Number(data?.id || 0));
    } catch (e: any) {
      showToast(e?.message || '提交灾厄申请失败');
    } finally {
      setCreating(false);
    }
  };

  const submitMap = async () => {
    if (!selectedGame?.id) return;
    if (!mapDraft.mapName.trim()) {
      showToast('请先填写地图名称');
      return;
    }
    if (!Array.isArray(mapDraft.points) || mapDraft.points.length === 0) {
      showToast('请至少绘制一个地图点位');
      return;
    }

    setMapSubmitting(true);
    try {
      const data = await apiFetch<any>(`/api/custom-games/${selectedGame.id}/map`, {
        method: 'POST',
        auth: 'user',
        body: {
          mapData: {
            mapJson: mapDraft,
            dropPointJson: dropDraft,
          },
        },
      });
      showToast(data?.message || '地图已提交审核');
      await loadMine();
      await loadLatestMap(selectedGame.id);
    } catch (e: any) {
      showToast(e?.message || '提交地图失败');
    } finally {
      setMapSubmitting(false);
    }
  };

  const requestStart = async () => {
    if (!selectedGame?.id) return;
    const ok = window.confirm('确认提交开局申请？');
    if (!ok) return;

    setStartSubmitting(true);
    try {
      const data = await apiFetch<any>(`/api/custom-games/${selectedGame.id}/start-request`, {
        method: 'POST',
        auth: 'user',
        body: {},
      });
      showToast(data?.message || '开局申请已提交');
      await loadMine();
    } catch (e: any) {
      showToast(e?.message || '提交开局申请失败');
    } finally {
      setStartSubmitting(false);
    }
  };

  useEffect(() => {
    loadMine();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id]);

  useEffect(() => {
    let active = true;
    if (!selectedGameId) {
      setLatestMapId(0);
      setLatestMapVersion(0);
      setLatestMapStatus('');
      setMapDraft(createEmptyMap());
      setDropDraft(createEmptyDrop());
      return;
    }

    (async () => {
      try {
        await loadLatestMap(selectedGameId);
      } finally {
        if (!active) return;
      }
    })();

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedGameId]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 xl:grid-cols-[320px_minmax(0,1fr)] gap-4">
        <div className="space-y-4">
          <section className="bg-slate-900 border border-slate-700 rounded-2xl p-4 space-y-3">
            <div>
              <h4 className="text-white font-black">发起灾厄创意</h4>
              <p className="text-xs text-slate-400 mt-1">先提交标题和设定，通过创意审核后再开始绘制地图。</p>
            </div>
            <input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="灾厄标题"
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white"
            />
            <textarea
              value={newIdeaText}
              onChange={(e) => setNewIdeaText(e.target.value)}
              placeholder="填写背景、规则、目标和参与方式"
              className="w-full h-28 px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white resize-none"
            />
            <button
              onClick={createGame}
              disabled={creating}
              className="w-full py-2.5 rounded-xl bg-rose-700 text-white font-black hover:bg-rose-600 disabled:opacity-60"
            >
              {creating ? '提交中...' : '提交创意审核'}
            </button>
          </section>

          <section className="bg-slate-900 border border-slate-700 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-white font-black">我的灾厄申请</h4>
              <button
                onClick={loadMine}
                className="px-3 py-1.5 rounded-lg bg-slate-700 text-white text-xs font-bold hover:bg-slate-600"
              >
                刷新
              </button>
            </div>

            {loading && <div className="text-xs text-slate-400">加载中...</div>}

            {!loading && rows.length === 0 && (
              <div className="text-sm text-slate-400">还没有灾厄申请，先在上方提交一条创意。</div>
            )}

            <div className="space-y-2">
              {rows.map((g) => {
                const active = activeRuns[g.id];
                const selected = g.id === selectedGameId;
                return (
                  <button
                    key={`cg-${g.id}`}
                    onClick={() => setSelectedGameId(g.id)}
                    className={`w-full text-left rounded-xl border p-3 transition-colors ${
                      selected
                        ? 'bg-slate-800 border-sky-500'
                        : 'bg-slate-800/60 border-slate-700 hover:border-slate-500'
                    }`}
                  >
                    <div className="text-sm font-black text-white">{g.title}</div>
                    <div className="text-[11px] text-slate-400 mt-1">
                      状态：{toStatusLabel(g.status)} · 投票：{toVoteStatusLabel(String(g.vote_status || 'none'))}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1">
                      {active?.hasActive ? `运行中 #${Number(active.runId || 0)}` : '暂无运行中的副本'}
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        </div>

        <div className="space-y-4">
          {!selectedGame ? (
            <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 text-sm text-slate-400">
              选择左侧的一条灾厄申请后，这里会显示地图制作和开局操作面板。
            </div>
          ) : (
            <>
              <section className="bg-slate-900 border border-slate-700 rounded-2xl p-4 space-y-3">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-2">
                    <h4 className="text-white font-black text-lg">{selectedGame.title}</h4>
                    <div className="text-sm text-slate-300">
                      状态：{toStatusLabel(selectedGame.status)} · 投票：{toVoteStatusLabel(String(selectedGame.vote_status || 'none'))}
                    </div>
                    <div className="text-xs text-slate-400">{workflowHint}</div>
                    {selectedGame.idea_text ? (
                      <div className="text-xs text-slate-500 bg-slate-950 rounded-xl border border-slate-800 p-3 whitespace-pre-wrap">
                        创意摘要：{selectedGame.idea_text}
                      </div>
                    ) : null}
                    <div className="text-xs text-slate-500">
                      最新地图版本：{latestMapVersion || 0}
                      {latestMapStatus ? ` · 地图状态：${toStatusLabel(latestMapStatus)}` : ''}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => loadLatestMap(selectedGame.id)}
                      disabled={mapLoading}
                      className="px-3 py-2 rounded-xl bg-slate-700 text-white text-xs font-black hover:bg-slate-600 disabled:opacity-60"
                    >
                      刷新地图
                    </button>
                    <button
                      onClick={submitMap}
                      disabled={!canSubmitMap || mapSubmitting}
                      className="px-3 py-2 rounded-xl bg-emerald-700 text-white text-xs font-black hover:bg-emerald-600 disabled:opacity-50"
                    >
                      {mapSubmitting ? '提交中...' : latestMapId ? '提交地图新版本' : '提交地图审核'}
                    </button>
                    <button
                      onClick={requestStart}
                      disabled={!canRequestStart || startSubmitting}
                      className="px-3 py-2 rounded-xl bg-amber-700 text-white text-xs font-black hover:bg-amber-600 disabled:opacity-50"
                    >
                      {startSubmitting ? '提交中...' : '申请开局'}
                    </button>
                    <button
                      onClick={() => joinAndEnter(selectedGame.id)}
                      disabled={!canEnterRun || busyId === selectedGame.id}
                      className="px-3 py-2 rounded-xl bg-rose-700 text-white text-xs font-black hover:bg-rose-600 disabled:opacity-50"
                    >
                      {busyId === selectedGame.id ? '进入中...' : canEnterRun ? '进入运行中的灾厄局' : '未开局'}
                    </button>
                  </div>
                </div>
              </section>

              <section className="bg-slate-900 border border-slate-700 rounded-2xl p-4 space-y-3">
                <div className="space-y-1">
                  <h4 className="text-white font-black">时间线与事件节奏</h4>
                  <p className="text-xs text-slate-400">
                    这里决定灾厄局的阶段推进。管理员审核地图时会看到这套时间线，开局后会自动带入导演台，创作者可继续扮演 NPC 控制全局进展。
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <label className="text-xs font-bold text-slate-300">阶段总数</label>
                  <input
                    type="number"
                    min={1}
                    max={12}
                    value={Number(mapDraft.totalStages || mapDraft.stageConfigs?.length || 3)}
                    onChange={(e) => updateTimelineCount(Number(e.target.value || 0))}
                    className="w-24 px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white"
                  />
                </div>

                <div className="space-y-2">
                  {(Array.isArray(mapDraft.stageConfigs) && mapDraft.stageConfigs.length
                    ? mapDraft.stageConfigs
                    : buildDefaultStages(mapDraft.totalStages || 3)
                  ).map((stage, index) => (
                    <div key={`timeline-stage-${index}`} className="grid gap-2 rounded-xl border border-slate-800 bg-slate-950/70 p-3 md:grid-cols-[140px_minmax(0,1fr)]">
                      <input
                        value={String(stage.name || `阶段${index + 1}`)}
                        onChange={(e) => updateTimelineStage(index, { name: e.target.value })}
                        placeholder={`阶段${index + 1} 名称`}
                        className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white"
                      />
                      <input
                        value={String(stage.desc || '')}
                        onChange={(e) => updateTimelineStage(index, { desc: e.target.value })}
                        placeholder="这一阶段的目标、事件、触发条件或导演提示"
                        className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white"
                      />
                    </div>
                  ))}
                </div>
              </section>

              <section className="bg-slate-900 border border-slate-700 rounded-2xl p-4">
                {mapLoading ? (
                  <div className="text-sm text-slate-400">读取地图配置中...</div>
                ) : (
                  <CreatorMapBuilder
                    key={`map-builder-${selectedGame.id}-${latestMapId}-${latestMapVersion}`}
                    initialMap={mapDraft}
                    initialDrop={dropDraft}
                    onChange={(nextMap, nextDrop) => {
                      setMapDraft(nextMap);
                      setDropDraft(nextDrop);
                    }}
                  />
                )}
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

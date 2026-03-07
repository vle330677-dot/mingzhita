import React, { useEffect, useMemo, useState } from 'react';
import { BadgePlus, Coins, Crown, ImagePlus, MapPin, Save, Trash2 } from 'lucide-react';
import { User } from '../types';
import FactionMemberPanel from './shared/FactionMemberPanel';

interface Props {
  user: User;
  locationId: string;
  onExit: () => void;
  showToast: (msg: string) => void;
  fetchGlobalData: () => void;
}

interface CustomFactionNode {
  id: string;
  name: string;
  description: string;
  x: number;
  y: number;
  dailyInteractionLimit: number;
  salary: number;
  createdAt?: string;
  updatedAt?: string;
}

interface CustomFactionDetail {
  id: string;
  name: string;
  description: string;
  ownerUserId: number;
  ownerName: string;
  leaderTitle: string;
  x: number;
  y: number;
  type: string;
  mapImageUrl: string;
}

interface AssetOption {
  name: string;
  url: string;
}

const EMPTY_NODE_FORM = {
  name: '',
  description: '',
  dailyInteractionLimit: '1',
  salary: '0',
};

export function CustomFactionView({ user, locationId, showToast, fetchGlobalData }: Props) {
  const [detail, setDetail] = useState<CustomFactionDetail | null>(null);
  const [nodes, setNodes] = useState<CustomFactionNode[]>([]);
  const [assets, setAssets] = useState<AssetOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [creatingNode, setCreatingNode] = useState(false);
  const [deletingNodeId, setDeletingNodeId] = useState<string>('');
  const [interactingNodeId, setInteractingNodeId] = useState<string>('');
  const [mapImageUrl, setMapImageUrl] = useState('');
  const [description, setDescription] = useState('');
  const [createNodeMode, setCreateNodeMode] = useState(false);
  const [nodeDraftPoint, setNodeDraftPoint] = useState<{ x: number; y: number } | null>(null);
  const [nodeForm, setNodeForm] = useState(EMPTY_NODE_FORM);

  const isOwner = Number(detail?.ownerUserId || 0) === Number(user.id || 0);
  const backgroundImage = useMemo(() => {
    const direct = String(mapImageUrl || detail?.mapImageUrl || '').trim();
    return direct || '/map_background.jpg';
  }, [detail?.mapImageUrl, mapImageUrl]);

  const pullDetail = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const res = await fetch(`/api/custom-factions/${encodeURIComponent(locationId)}`, { cache: 'no-store' });
      const data = await res.json().catch(() => ({} as any));
      if (!res.ok || data.success === false) {
        if (!silent) showToast(data.message || '读取自定义势力失败');
        return;
      }
      const faction = data.faction || null;
      setDetail(faction);
      setNodes(Array.isArray(data.nodes) ? data.nodes : []);
      setAssets(Array.isArray(data.assets) ? data.assets : []);
      setMapImageUrl(String(faction?.mapImageUrl || ''));
      setDescription(String(faction?.description || ''));
    } catch {
      if (!silent) showToast('网络异常，读取自定义势力失败');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    pullDetail(false);
    const timer = window.setInterval(() => pullDetail(true), 10000);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  const saveSettings = async () => {
    if (!isOwner || !detail || savingSettings) return;
    setSavingSettings(true);
    try {
      const res = await fetch(`/api/custom-factions/${encodeURIComponent(locationId)}/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          description,
          mapImageUrl,
        }),
      });
      const data = await res.json().catch(() => ({} as any));
      if (!res.ok || data.success === false) {
        showToast(data.message || '保存设置失败');
        return;
      }
      showToast(data.message || '已保存势力设置');
      await pullDetail(true);
    } catch {
      showToast('网络异常，保存设置失败');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleMapClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!isOwner || !createNodeMode) return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const x = Math.max(4, Math.min(96, ((event.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(4, Math.min(96, ((event.clientY - rect.top) / rect.height) * 100));
    setNodeDraftPoint({ x: Number(x.toFixed(2)), y: Number(y.toFixed(2)) });
  };

  const createNode = async () => {
    if (!isOwner || !nodeDraftPoint || creatingNode) return;
    if (!nodeForm.name.trim()) {
      showToast('请先填写地点名称');
      return;
    }
    setCreatingNode(true);
    try {
      const res = await fetch(`/api/custom-factions/${encodeURIComponent(locationId)}/nodes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          name: nodeForm.name.trim(),
          description: nodeForm.description.trim(),
          x: nodeDraftPoint.x,
          y: nodeDraftPoint.y,
          dailyInteractionLimit: Number(nodeForm.dailyInteractionLimit || 1),
          salary: Number(nodeForm.salary || 0),
        }),
      });
      const data = await res.json().catch(() => ({} as any));
      if (!res.ok || data.success === false) {
        showToast(data.message || '新增地点失败');
        return;
      }
      showToast(data.message || '已新增地点');
      setNodeDraftPoint(null);
      setNodeForm(EMPTY_NODE_FORM);
      setCreateNodeMode(false);
      await pullDetail(true);
    } catch {
      showToast('网络异常，新增地点失败');
    } finally {
      setCreatingNode(false);
    }
  };

  const deleteNode = async (node: CustomFactionNode) => {
    if (!isOwner || deletingNodeId) return;
    if (!window.confirm(`确定删除地点「${node.name}」吗？`)) return;
    setDeletingNodeId(node.id);
    try {
      const res = await fetch(`/api/custom-factions/${encodeURIComponent(locationId)}/nodes/${encodeURIComponent(node.id)}?userId=${user.id}`, {
        method: 'DELETE',
      });
      const data = await res.json().catch(() => ({} as any));
      if (!res.ok || data.success === false) {
        showToast(data.message || '删除地点失败');
        return;
      }
      showToast(data.message || '已删除地点');
      await pullDetail(true);
    } catch {
      showToast('网络异常，删除地点失败');
    } finally {
      setDeletingNodeId('');
    }
  };

  const interactNode = async (node: CustomFactionNode) => {
    if (interactingNodeId) return;
    setInteractingNodeId(node.id);
    try {
      const res = await fetch(`/api/custom-factions/${encodeURIComponent(locationId)}/nodes/${encodeURIComponent(node.id)}/interact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id }),
      });
      const data = await res.json().catch(() => ({} as any));
      if (!res.ok || data.success === false) {
        showToast(data.message || '互动失败');
        return;
      }
      showToast(data.message || '互动完成');
      fetchGlobalData();
    } catch {
      showToast('网络异常，互动失败');
    } finally {
      setInteractingNodeId('');
    }
  };

  if (loading && !detail) {
    return <div className="theme-elevated-surface rounded-[2rem] border p-6 text-sm text-slate-300">正在读取自定义势力信息...</div>;
  }

  if (!detail) {
    return <div className="theme-elevated-surface rounded-[2rem] border p-6 text-sm text-slate-300">未找到该自定义势力。</div>;
  }

  return (
    <div className="space-y-6">
      <div className="theme-elevated-surface rounded-[2rem] border p-5 md:p-6 shadow-2xl">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-300/40 bg-amber-100/10 px-3 py-1 text-[11px] font-black text-amber-200">
              <Crown size={13} />
              创建者：{detail.ownerName || '未知'} · 最高职位：{detail.leaderTitle || '掌权者'}
            </div>
            <h2 className="mt-3 text-3xl font-black text-slate-100">{detail.name}</h2>
            <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-300">{detail.description || '这里是一片刚刚建立的新势力领地。'}</p>
          </div>
          {isOwner && (
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setCreateNodeMode((value) => !value)}
                className={`rounded-xl px-4 py-2 text-sm font-black transition-colors ${
                  createNodeMode ? 'bg-amber-600 text-white hover:bg-amber-500' : 'bg-slate-800 text-slate-100 hover:bg-slate-700'
                }`}
              >
                <BadgePlus className="mr-2 inline" size={14} />
                {createNodeMode ? '取消建点' : '点击地图建新地点'}
              </button>
              <button
                onClick={saveSettings}
                disabled={savingSettings}
                className="rounded-xl bg-sky-600 px-4 py-2 text-sm font-black text-white hover:bg-sky-500 disabled:opacity-60"
              >
                <Save className="mr-2 inline" size={14} />
                {savingSettings ? '保存中...' : '保存势力设置'}
              </button>
            </div>
          )}
        </div>

        {isOwner && (
          <div className="mt-5 grid gap-3 lg:grid-cols-[1.4fr_1fr]">
            <label className="block text-xs font-black text-slate-400">
              <span className="mb-2 flex items-center gap-2">
                <ImagePlus size={14} /> 地图图片地址
              </span>
              <input
                value={mapImageUrl}
                onChange={(event) => setMapImageUrl(event.target.value)}
                placeholder="例如 /new/my-faction-map.jpg"
                className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-slate-100 outline-none focus:border-sky-500"
              />
              {assets.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {assets.slice(0, 8).map((asset) => (
                    <button
                      key={asset.url}
                      onClick={() => setMapImageUrl(asset.url)}
                      className="rounded-full border border-slate-600 px-2.5 py-1 text-[11px] text-slate-300 hover:border-sky-500 hover:text-sky-200"
                    >
                      {asset.name}
                    </button>
                  ))}
                </div>
              )}
            </label>
            <label className="block text-xs font-black text-slate-400">
              <span className="mb-2 block">势力说明</span>
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                className="min-h-[132px] w-full rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-slate-100 outline-none focus:border-sky-500"
                placeholder="输入这片势力的背景、规则与氛围。"
              />
            </label>
          </div>
        )}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="theme-elevated-surface rounded-[2rem] border p-4 md:p-5 shadow-2xl">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-black text-slate-100">势力小地图</div>
              <div className="mt-1 text-[11px] text-slate-400">
                {isOwner && createNodeMode ? '点击空白区域放置新地点。' : '点击已有地点即可互动。'}
              </div>
            </div>
            <div className="rounded-full border border-slate-600 px-3 py-1 text-[11px] text-slate-300">
              地点 {nodes.length}
            </div>
          </div>

          <div
            onClick={handleMapClick}
            className={`relative aspect-[16/10] overflow-hidden rounded-[1.75rem] border border-white/10 bg-slate-950 ${createNodeMode ? 'cursor-crosshair' : ''}`}
          >
            <img src={backgroundImage} alt={detail.name} className="h-full w-full object-cover opacity-85" />
            <div className="absolute inset-0 bg-gradient-to-br from-slate-950/10 via-transparent to-slate-950/40" />
            {nodes.map((node) => (
              <button
                key={node.id}
                onClick={(event) => {
                  event.stopPropagation();
                  interactNode(node);
                }}
                className="absolute -translate-x-1/2 -translate-y-1/2"
                style={{ left: `${node.x}%`, top: `${node.y}%` }}
                title={`${node.name} · 工资 ${node.salary}G`}
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-white/85 bg-amber-500/90 text-slate-950 shadow-[0_0_25px_rgba(251,191,36,0.45)]">
                  <MapPin size={18} />
                </div>
                <div className="mt-2 rounded-full border border-white/20 bg-slate-950/80 px-3 py-1 text-[11px] font-black text-white backdrop-blur">
                  {node.name}
                </div>
              </button>
            ))}
            {createNodeMode && (
              <div className="pointer-events-none absolute right-4 top-4 rounded-xl border border-amber-400/40 bg-amber-100/10 px-3 py-2 text-[11px] font-black text-amber-100 backdrop-blur">
                建点模式已开启
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="theme-elevated-surface rounded-[2rem] border p-4 shadow-2xl">
            <div className="flex items-center gap-2 text-sm font-black text-slate-100">
              <Coins size={15} />
              可互动地点
            </div>
            <div className="mt-3 space-y-3 max-h-[32rem] overflow-y-auto pr-1 custom-scrollbar">
              {nodes.length === 0 ? (
                <div className="rounded-2xl border border-slate-700 bg-slate-900/55 px-4 py-5 text-sm text-slate-400">
                  这里还没有可互动的新地点。
                </div>
              ) : (
                nodes.map((node) => (
                  <div key={node.id} className="rounded-2xl border border-slate-700 bg-slate-900/55 px-4 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-black text-slate-100">{node.name}</div>
                        <div className="mt-1 text-[11px] leading-6 text-slate-400">{node.description || '暂无说明'}</div>
                        <div className="mt-2 flex flex-wrap gap-2 text-[10px] text-slate-300">
                          <span className="rounded-full border border-slate-600 px-2 py-1">每日交互 {node.dailyInteractionLimit} 次</span>
                          <span className="rounded-full border border-emerald-600/60 px-2 py-1 text-emerald-300">工资 {node.salary}G</span>
                        </div>
                      </div>
                      <div className="flex flex-col gap-2">
                        <button
                          onClick={() => interactNode(node)}
                          disabled={interactingNodeId === node.id}
                          className="rounded-xl bg-emerald-600 px-3 py-2 text-[11px] font-black text-white hover:bg-emerald-500 disabled:opacity-60"
                        >
                          {interactingNodeId === node.id ? '互动中...' : '互动'}
                        </button>
                        {isOwner && (
                          <button
                            onClick={() => deleteNode(node)}
                            disabled={deletingNodeId === node.id}
                            className="rounded-xl bg-rose-900/60 px-3 py-2 text-[11px] font-black text-rose-100 hover:bg-rose-800/70 disabled:opacity-60"
                          >
                            <Trash2 className="mr-1 inline" size={12} />
                            {deletingNodeId === node.id ? '删除中' : '删除'}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <FactionMemberPanel
            user={user}
            locationId={locationId}
            showToast={showToast}
            fetchGlobalData={fetchGlobalData}
            title="势力职位房间"
          />
        </div>
      </div>

      {nodeDraftPoint && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-sm">
          <div className="theme-elevated-surface w-full max-w-xl rounded-[2rem] border p-5 shadow-2xl">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-lg font-black text-slate-100">在这里建立新地点？</div>
                <div className="mt-1 text-[11px] text-slate-400">坐标 {nodeDraftPoint.x}% / {nodeDraftPoint.y}%</div>
              </div>
              <button
                onClick={() => setNodeDraftPoint(null)}
                className="rounded-full bg-slate-800 px-3 py-2 text-xs font-black text-slate-200 hover:bg-slate-700"
              >
                取消
              </button>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <input
                value={nodeForm.name}
                onChange={(event) => setNodeForm((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="地点名称"
                className="rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-slate-100 outline-none focus:border-sky-500"
              />
              <input
                value={nodeForm.dailyInteractionLimit}
                onChange={(event) => setNodeForm((prev) => ({ ...prev, dailyInteractionLimit: event.target.value }))}
                placeholder="每日交互次数"
                className="rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-slate-100 outline-none focus:border-sky-500"
              />
              <input
                value={nodeForm.salary}
                onChange={(event) => setNodeForm((prev) => ({ ...prev, salary: event.target.value }))}
                placeholder="工资（G）"
                className="rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-slate-100 outline-none focus:border-sky-500 md:col-span-2"
              />
              <textarea
                value={nodeForm.description}
                onChange={(event) => setNodeForm((prev) => ({ ...prev, description: event.target.value }))}
                placeholder="输入地点介绍、交互说明或剧情气氛。"
                className="min-h-[120px] rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-slate-100 outline-none focus:border-sky-500 md:col-span-2"
              />
            </div>

            <button
              onClick={createNode}
              disabled={creatingNode}
              className="mt-4 rounded-2xl bg-sky-600 px-4 py-3 text-sm font-black text-white hover:bg-sky-500 disabled:opacity-60"
            >
              {creatingNode ? '建立中...' : '确认在这里建立新地点'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default CustomFactionView;

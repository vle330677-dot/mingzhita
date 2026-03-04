import React, { useEffect, useMemo, useState } from 'react';

type NodeType = 'spawn' | 'town' | 'wild' | 'dungeon' | 'shop' | 'custom';

export interface MapNode {
  id: string;
  name: string;
  x: number; // 0~100
  y: number; // 0~100
  type: NodeType;
  description?: string;
}

export interface MapItem {
  id: string;
  name: string;
  nodeId: string;
  price?: number;
  currencyDelta?: number;
  description?: string;
}

export interface MapNpc {
  id: string;
  name: string;
  nodeId: string;
  dialogue: string;
}

export interface DropPoint {
  id: string;
  title: string;
  nodeId: string;
}

export interface CreatorMapJson {
  nodes: MapNode[];
  items: MapItem[];
  npcs: MapNpc[];
  meta: {
    mapName?: string;
    announcementText?: string;
    layoutRuleText?: string;
    currencyName?: string;
    winRule?: string;
  };
}

export interface CreatorDropJson {
  defaultNodeId?: string;
  points: DropPoint[];
}

interface Props {
  value: CreatorMapJson;
  dropValue: CreatorDropJson;
  onChange: (map: CreatorMapJson, drop: CreatorDropJson) => void;
}

const uid = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

const NODE_COLOR: Record<NodeType, string> = {
  spawn: 'bg-emerald-500',
  town: 'bg-sky-500',
  wild: 'bg-amber-500',
  dungeon: 'bg-rose-500',
  shop: 'bg-violet-500',
  custom: 'bg-slate-400'
};

export function CreatorMapEditor({ value, dropValue, onChange }: Props) {
  const [map, setMap] = useState<CreatorMapJson>(value);
  const [drop, setDrop] = useState<CreatorDropJson>(dropValue);

  const [selectedNodeId, setSelectedNodeId] = useState<string>('');
  const [newNodeName, setNewNodeName] = useState('新点位');
  const [newNodeType, setNewNodeType] = useState<NodeType>('custom');

  const selectedNode = useMemo(
    () => map.nodes.find((n) => n.id === selectedNodeId) || null,
    [map.nodes, selectedNodeId]
  );

  useEffect(() => setMap(value), [value]);
  useEffect(() => setDrop(dropValue), [dropValue]);

  const emit = (nextMap: CreatorMapJson, nextDrop: CreatorDropJson) => {
    setMap(nextMap);
    setDrop(nextDrop);
    onChange(nextMap, nextDrop);
  };

  const addNodeAt = (x: number, y: number) => {
    const node: MapNode = {
      id: uid('NODE'),
      name: newNodeName || '新点位',
      x: Math.max(0, Math.min(100, Number(x.toFixed(2)))),
      y: Math.max(0, Math.min(100, Number(y.toFixed(2)))),
      type: newNodeType,
      description: ''
    };
    const nextMap = { ...map, nodes: [...map.nodes, node] };
    emit(nextMap, drop);
    setSelectedNodeId(node.id);
  };

  const handleMapClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    addNodeAt(x, y);
  };

  const updateNode = (patch: Partial<MapNode>) => {
    if (!selectedNode) return;
    const nextMap = {
      ...map,
      nodes: map.nodes.map((n) => (n.id === selectedNode.id ? { ...n, ...patch } : n))
    };
    emit(nextMap, drop);
  };

  const removeNode = (nodeId: string) => {
    const nextMap: CreatorMapJson = {
      ...map,
      nodes: map.nodes.filter((n) => n.id !== nodeId),
      items: map.items.filter((i) => i.nodeId !== nodeId),
      npcs: map.npcs.filter((n) => n.nodeId !== nodeId)
    };
    const nextDrop: CreatorDropJson = {
      ...drop,
      defaultNodeId: drop.defaultNodeId === nodeId ? undefined : drop.defaultNodeId,
      points: drop.points.filter((p) => p.nodeId !== nodeId)
    };
    emit(nextMap, nextDrop);
    if (selectedNodeId === nodeId) setSelectedNodeId('');
  };

  const addItem = () => {
    if (!selectedNode) return;
    const item: MapItem = {
      id: uid('ITEM'),
      name: '新物品',
      nodeId: selectedNode.id,
      price: 0,
      currencyDelta: 0,
      description: ''
    };
    emit({ ...map, items: [...map.items, item] }, drop);
  };

  const addNpc = () => {
    if (!selectedNode) return;
    const npc: MapNpc = {
      id: uid('NPC'),
      name: '新NPC',
      nodeId: selectedNode.id,
      dialogue: '你好，冒险者。'
    };
    emit({ ...map, npcs: [...map.npcs, npc] }, drop);
  };

  const addDropPoint = () => {
    if (!selectedNode) return;
    const p: DropPoint = {
      id: uid('DROP'),
      title: `降落点-${drop.points.length + 1}`,
      nodeId: selectedNode.id
    };
    emit(map, { ...drop, points: [...drop.points, p] });
  };

  const exportJson = () => {
    const text = JSON.stringify({ mapJson: map, dropPointJson: drop }, null, 2);
    navigator.clipboard.writeText(text);
    alert('地图 JSON 已复制到剪贴板');
  };

  const importJson = () => {
    const raw = prompt('粘贴 JSON（格式: { mapJson, dropPointJson }）');
    if (!raw) return;
    try {
      const obj = JSON.parse(raw);
      const nextMap = obj?.mapJson || map;
      const nextDrop = obj?.dropPointJson || drop;
      emit(nextMap, nextDrop);
      alert('导入成功');
    } catch {
      alert('JSON 格式错误');
    }
  };

  return (
    <div className="space-y-4">
      {/* 顶部基础信息 */}
      <div className="bg-slate-900/80 border border-slate-700 rounded-2xl p-4">
        <h3 className="font-black text-white mb-3">地图基础设定</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <input
            className="p-2 rounded bg-slate-950 border border-slate-700 text-white"
            placeholder="地图名称"
            value={map.meta.mapName || ''}
            onChange={(e) => emit({ ...map, meta: { ...map.meta, mapName: e.target.value } }, drop)}
          />
          <input
            className="p-2 rounded bg-slate-950 border border-slate-700 text-white"
            placeholder="货币名称（如：灾厄币）"
            value={map.meta.currencyName || ''}
            onChange={(e) => emit({ ...map, meta: { ...map.meta, currencyName: e.target.value } }, drop)}
          />
        </div>
        <textarea
          className="w-full mt-2 h-20 p-2 rounded bg-slate-950 border border-slate-700 text-white"
          placeholder="初始公告"
          value={map.meta.announcementText || ''}
          onChange={(e) => emit({ ...map, meta: { ...map.meta, announcementText: e.target.value } }, drop)}
        />
        <textarea
          className="w-full mt-2 h-20 p-2 rounded bg-slate-950 border border-slate-700 text-white"
          placeholder="地图规则（如：死亡扣币、每日刷新、商店机制）"
          value={map.meta.layoutRuleText || ''}
          onChange={(e) => emit({ ...map, meta: { ...map.meta, layoutRuleText: e.target.value } }, drop)}
        />
        <input
          className="w-full mt-2 p-2 rounded bg-slate-950 border border-slate-700 text-white"
          placeholder="胜利规则（如：结束时货币最高者胜）"
          value={map.meta.winRule || ''}
          onChange={(e) => emit({ ...map, meta: { ...map.meta, winRule: e.target.value } }, drop)}
        />
      </div>

      {/* 地图画布 + 侧栏 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* 画布 */}
        <div className="lg:col-span-2 bg-slate-900/80 border border-slate-700 rounded-2xl p-4">
          <div className="flex flex-wrap gap-2 mb-3">
            <input
              className="p-2 rounded bg-slate-950 border border-slate-700 text-white"
              value={newNodeName}
              onChange={(e) => setNewNodeName(e.target.value)}
              placeholder="新节点名称"
            />
            <select
              className="p-2 rounded bg-slate-950 border border-slate-700 text-white"
              value={newNodeType}
              onChange={(e) => setNewNodeType(e.target.value as NodeType)}
            >
              <option value="spawn">出生点</option>
              <option value="town">城镇</option>
              <option value="wild">野外</option>
              <option value="dungeon">副本</option>
              <option value="shop">商店</option>
              <option value="custom">自定义</option>
            </select>
            <span className="text-xs text-slate-400 self-center">点击画布添加点位</span>
          </div>

          <div
            className="relative w-full h-[420px] rounded-xl border border-slate-700 bg-[radial-gradient(circle_at_center,#1f2937,#0b1220)] cursor-crosshair overflow-hidden"
            onClick={handleMapClick}
          >
            {map.nodes.map((n) => (
              <button
                key={n.id}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedNodeId(n.id);
                }}
                className={`absolute -translate-x-1/2 -translate-y-1/2 w-5 h-5 rounded-full border-2 border-white ${NODE_COLOR[n.type]} ${
                  selectedNodeId === n.id ? 'ring-2 ring-amber-300' : ''
                }`}
                style={{ left: `${n.x}%`, top: `${n.y}%` }}
                title={`${n.name} (${n.type})`}
              />
            ))}
          </div>
        </div>

        {/* 侧栏 */}
        <div className="bg-slate-900/80 border border-slate-700 rounded-2xl p-4 space-y-3">
          <h4 className="font-black text-white">节点编辑</h4>

          {selectedNode ? (
            <>
              <input
                className="w-full p-2 rounded bg-slate-950 border border-slate-700 text-white"
                value={selectedNode.name}
                onChange={(e) => updateNode({ name: e.target.value })}
              />
              <select
                className="w-full p-2 rounded bg-slate-950 border border-slate-700 text-white"
                value={selectedNode.type}
                onChange={(e) => updateNode({ type: e.target.value as NodeType })}
              >
                <option value="spawn">出生点</option>
                <option value="town">城镇</option>
                <option value="wild">野外</option>
                <option value="dungeon">副本</option>
                <option value="shop">商店</option>
                <option value="custom">自定义</option>
              </select>

              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  className="p-2 rounded bg-slate-950 border border-slate-700 text-white"
                  value={selectedNode.x}
                  onChange={(e) => updateNode({ x: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })}
                />
                <input
                  type="number"
                  className="p-2 rounded bg-slate-950 border border-slate-700 text-white"
                  value={selectedNode.y}
                  onChange={(e) => updateNode({ y: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })}
                />
              </div>

              <textarea
                className="w-full h-20 p-2 rounded bg-slate-950 border border-slate-700 text-white"
                value={selectedNode.description || ''}
                onChange={(e) => updateNode({ description: e.target.value })}
                placeholder="节点描述"
              />

              <div className="flex gap-2">
                <button className="flex-1 py-2 rounded bg-indigo-600 text-white font-bold" onClick={addItem}>
                  +物品
                </button>
                <button className="flex-1 py-2 rounded bg-violet-600 text-white font-bold" onClick={addNpc}>
                  +NPC
                </button>
              </div>

              <div className="flex gap-2">
                <button className="flex-1 py-2 rounded bg-emerald-600 text-white font-bold" onClick={addDropPoint}>
                  +降落点
                </button>
                <button className="flex-1 py-2 rounded bg-rose-600 text-white font-bold" onClick={() => removeNode(selectedNode.id)}>
                  删除节点
                </button>
              </div>

              <button
                className="w-full py-2 rounded bg-slate-700 text-white font-bold"
                onClick={() => emit(map, { ...drop, defaultNodeId: selectedNode.id })}
              >
                设为默认降落点
              </button>
            </>
          ) : (
            <div className="text-slate-400 text-sm">先在左侧地图点击一个节点进行编辑</div>
          )}
        </div>
      </div>

      {/* 结构化列表 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <ListCard title={`物品 (${map.items.length})`}>
          {map.items.map((it) => (
            <Row key={it.id}>
              <input
                className="flex-1 p-1.5 rounded bg-slate-950 border border-slate-700 text-white text-xs"
                value={it.name}
                onChange={(e) =>
                  emit(
                    { ...map, items: map.items.map((x) => (x.id === it.id ? { ...x, name: e.target.value } : x)) },
                    drop
                  )
                }
              />
              <button
                className="px-2 py-1 rounded bg-rose-600 text-white text-xs"
                onClick={() => emit({ ...map, items: map.items.filter((x) => x.id !== it.id) }, drop)}
              >
                删
              </button>
            </Row>
          ))}
        </ListCard>

        <ListCard title={`NPC (${map.npcs.length})`}>
          {map.npcs.map((npc) => (
            <Row key={npc.id}>
              <input
                className="flex-1 p-1.5 rounded bg-slate-950 border border-slate-700 text-white text-xs"
                value={npc.name}
                onChange={(e) =>
                  emit(
                    { ...map, npcs: map.npcs.map((x) => (x.id === npc.id ? { ...x, name: e.target.value } : x)) },
                    drop
                  )
                }
              />
              <button
                className="px-2 py-1 rounded bg-rose-600 text-white text-xs"
                onClick={() => emit({ ...map, npcs: map.npcs.filter((x) => x.id !== npc.id) }, drop)}
              >
                删
              </button>
            </Row>
          ))}
        </ListCard>

        <ListCard title={`降落点 (${drop.points.length})`}>
          {drop.points.map((p) => (
            <Row key={p.id}>
              <input
                className="flex-1 p-1.5 rounded bg-slate-950 border border-slate-700 text-white text-xs"
                value={p.title}
                onChange={(e) =>
                  emit(
                    map,
                    { ...drop, points: drop.points.map((x) => (x.id === p.id ? { ...x, title: e.target.value } : x)) }
                  )
                }
              />
              <button
                className="px-2 py-1 rounded bg-rose-600 text-white text-xs"
                onClick={() => emit(map, { ...drop, points: drop.points.filter((x) => x.id !== p.id) })}
              >
                删
              </button>
            </Row>
          ))}
          <div className="text-xs text-slate-400 mt-2">默认降落点: {drop.defaultNodeId || '未设置'}</div>
        </ListCard>
      </div>

      {/* 导入导出 */}
      <div className="flex gap-2">
        <button className="px-4 py-2 rounded bg-slate-700 text-white font-bold" onClick={exportJson}>
          导出JSON
        </button>
        <button className="px-4 py-2 rounded bg-slate-700 text-white font-bold" onClick={importJson}>
          导入JSON
        </button>
      </div>
    </div>
  );
}

function ListCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-slate-900/80 border border-slate-700 rounded-2xl p-4">
      <h4 className="font-black text-white mb-2">{title}</h4>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center gap-2">{children}</div>;
}
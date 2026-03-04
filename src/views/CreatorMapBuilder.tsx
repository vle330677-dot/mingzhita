import React, { useEffect, useMemo, useState } from 'react';

type PointType = 'town' | 'wild' | 'dungeon' | 'shop' | 'spawn' | 'custom';

interface MapPoint {
  id: string;
  name: string;
  type: PointType;
  x: number; // 0-100
  y: number; // 0-100
  desc?: string;
}

interface BoundNpc {
  id: string;
  name: string;
  dialogue: string;
}

interface BoundItem {
  id: string;
  name: string;
  price?: number;
  currencyDelta?: number;
  desc?: string;
}

interface PointBinding {
  pointId: string;
  npcs: BoundNpc[];
  items: BoundItem[];
  isDropPoint: boolean;
}

export interface BuiltMapJson {
  mapName: string;
  backgroundImage?: string; // base64 或 url
  announcementText?: string;
  layoutRuleText?: string;
  currencyName?: string;
  points: MapPoint[];
  bindings: PointBinding[];
}

export interface BuiltDropJson {
  defaultPointId?: string;
  points: Array<{ id: string; title: string; pointId: string }>;
}

interface Props {
  initialMap?: BuiltMapJson;
  initialDrop?: BuiltDropJson;
  onChange: (mapJson: BuiltMapJson, dropJson: BuiltDropJson) => void;
}

const uid = (p: string) => `${p}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

const POINT_COLORS: Record<PointType, string> = {
  town: 'bg-sky-500',
  wild: 'bg-emerald-500',
  dungeon: 'bg-rose-500',
  shop: 'bg-violet-500',
  spawn: 'bg-amber-500',
  custom: 'bg-slate-400'
};

const defaultMap: BuiltMapJson = {
  mapName: '',
  backgroundImage: '',
  announcementText: '',
  layoutRuleText: '',
  currencyName: '灾厄币',
  points: [],
  bindings: []
};

const defaultDrop: BuiltDropJson = {
  defaultPointId: undefined,
  points: []
};

export function CreatorMapBuilder({ initialMap, initialDrop, onChange }: Props) {
  const [map, setMap] = useState<BuiltMapJson>(initialMap || defaultMap);
  const [drop, setDrop] = useState<BuiltDropJson>(initialDrop || defaultDrop);

  // 阶段：false=绘制阶段，true=生成后绑定阶段
  const [generated, setGenerated] = useState(false);

  const [newPointName, setNewPointName] = useState('新点位');
  const [newPointType, setNewPointType] = useState<PointType>('town');

  const [selectedPointId, setSelectedPointId] = useState<string>('');
  const selectedPoint = useMemo(
    () => map.points.find((p) => p.id === selectedPointId) || null,
    [map.points, selectedPointId]
  );

  useEffect(() => {
    if (initialMap) setMap(initialMap);
  }, [initialMap]);

  useEffect(() => {
    if (initialDrop) setDrop(initialDrop);
  }, [initialDrop]);

  const emit = (nextMap: BuiltMapJson, nextDrop: BuiltDropJson) => {
    setMap(nextMap);
    setDrop(nextDrop);
    onChange(nextMap, nextDrop);
  };

  const upsertBinding = (pointId: string): PointBinding => {
    const found = map.bindings.find((b) => b.pointId === pointId);
    if (found) return found;
    const created: PointBinding = { pointId, npcs: [], items: [], isDropPoint: false };
    const nextMap = { ...map, bindings: [...map.bindings, created] };
    setMap(nextMap);
    onChange(nextMap, drop);
    return created;
  };

  const getBinding = (pointId: string): PointBinding => {
    return map.bindings.find((b) => b.pointId === pointId) || { pointId, npcs: [], items: [], isDropPoint: false };
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (generated) return; // 生成后不允许随手画点（可点“返回绘制”）
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    const point: MapPoint = {
      id: uid('P'),
      name: newPointName || '新点位',
      type: newPointType,
      x: Number(x.toFixed(2)),
      y: Number(y.toFixed(2)),
      desc: ''
    };

    const nextMap = { ...map, points: [...map.points, point] };
    emit(nextMap, drop);
    setSelectedPointId(point.id);
  };

  const removePoint = (pointId: string) => {
    const nextMap: BuiltMapJson = {
      ...map,
      points: map.points.filter((p) => p.id !== pointId),
      bindings: map.bindings.filter((b) => b.pointId !== pointId)
    };
    const nextDrop: BuiltDropJson = {
      ...drop,
      defaultPointId: drop.defaultPointId === pointId ? undefined : drop.defaultPointId,
      points: drop.points.filter((d) => d.pointId !== pointId)
    };
    emit(nextMap, nextDrop);
    if (selectedPointId === pointId) setSelectedPointId('');
  };

  const updatePoint = (patch: Partial<MapPoint>) => {
    if (!selectedPoint) return;
    const nextMap = {
      ...map,
      points: map.points.map((p) => (p.id === selectedPoint.id ? { ...p, ...patch } : p))
    };
    emit(nextMap, drop);
  };

  const importBackground = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const nextMap = { ...map, backgroundImage: String(reader.result || '') };
      emit(nextMap, drop);
    };
    reader.readAsDataURL(file);
  };

  const importJson = () => {
    const raw = prompt('粘贴地图JSON（格式：{ mapJson, dropPointJson }）');
    if (!raw) return;
    try {
      const obj = JSON.parse(raw);
      const nextMap: BuiltMapJson = obj.mapJson || map;
      const nextDrop: BuiltDropJson = obj.dropPointJson || drop;
      emit(nextMap, nextDrop);
      alert('导入成功');
    } catch {
      alert('JSON 格式不正确');
    }
  };

  const exportJson = () => {
    const text = JSON.stringify({ mapJson: map, dropPointJson: drop }, null, 2);
    navigator.clipboard.writeText(text);
    alert('地图 JSON 已复制');
  };

  const confirmGenerate = () => {
    if (!map.points.length) return alert('请先绘制至少一个坐标点');
    setGenerated(true);
    alert('地图已生成！现在可点击点位进行NPC/物品/降落点绑定');
  };

  const backToDraw = () => {
    setGenerated(false);
  };

  // ===== 点位绑定操作 =====
  const addNpc = () => {
    if (!selectedPoint) return;
    const b = upsertBinding(selectedPoint.id);
    const nextBindings = map.bindings.map((x) =>
      x.pointId === b.pointId
        ? { ...x, npcs: [...x.npcs, { id: uid('NPC'), name: '新NPC', dialogue: '你好，冒险者。' }] }
        : x
    );
    // 如果是刚创建 binding 还没进 bindings，则兼容处理
    const merged = map.bindings.some((x) => x.pointId === b.pointId)
      ? nextBindings
      : [...map.bindings, { ...b, npcs: [...b.npcs, { id: uid('NPC'), name: '新NPC', dialogue: '你好，冒险者。' }] }];
    emit({ ...map, bindings: merged }, drop);
  };

  const addItem = () => {
    if (!selectedPoint) return;
    const b = upsertBinding(selectedPoint.id);
    const item: BoundItem = { id: uid('ITEM'), name: '新物品', price: 0, currencyDelta: 0, desc: '' };
    const nextBindings = map.bindings.map((x) => (x.pointId === b.pointId ? { ...x, items: [...x.items, item] } : x));
    const merged = map.bindings.some((x) => x.pointId === b.pointId)
      ? nextBindings
      : [...map.bindings, { ...b, items: [...b.items, item] }];
    emit({ ...map, bindings: merged }, drop);
  };

  const toggleDropPoint = () => {
    if (!selectedPoint) return;
    const b = getBinding(selectedPoint.id);
    const target = !b.isDropPoint;

    const nextBindings = map.bindings.some((x) => x.pointId === b.pointId)
      ? map.bindings.map((x) => (x.pointId === b.pointId ? { ...x, isDropPoint: target } : x))
      : [...map.bindings, { ...b, isDropPoint: target }];

    let nextDrop = { ...drop };
    if (target) {
      if (!nextDrop.points.find((x) => x.pointId === selectedPoint.id)) {
        nextDrop.points = [...nextDrop.points, { id: uid('DROP'), title: `${selectedPoint.name}降落点`, pointId: selectedPoint.id }];
      }
      if (!nextDrop.defaultPointId) nextDrop.defaultPointId = selectedPoint.id;
    } else {
      nextDrop.points = nextDrop.points.filter((x) => x.pointId !== selectedPoint.id);
      if (nextDrop.defaultPointId === selectedPoint.id) nextDrop.defaultPointId = nextDrop.points[0]?.pointId;
    }

    emit({ ...map, bindings: nextBindings }, nextDrop);
  };

  const setDefaultDrop = () => {
    if (!selectedPoint) return;
    if (!drop.points.find((x) => x.pointId === selectedPoint.id)) {
      alert('该点尚未启用为降落点，请先“切换降落点开关”');
      return;
    }
    emit(map, { ...drop, defaultPointId: selectedPoint.id });
  };

  const binding = selectedPoint ? getBinding(selectedPoint.id) : null;

  return (
    <div className="space-y-4">
      {/* 顶部工具 */}
      <div className="bg-slate-900/80 border border-slate-700 rounded-2xl p-4 space-y-3">
        <h3 className="font-black text-white">地图制作面板（创造者）</h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <input
            className="p-2 rounded bg-slate-950 border border-slate-700 text-white"
            placeholder="地图名称"
            value={map.mapName}
            onChange={(e) => emit({ ...map, mapName: e.target.value }, drop)}
          />
          <input
            className="p-2 rounded bg-slate-950 border border-slate-700 text-white"
            placeholder="货币名称"
            value={map.currencyName || ''}
            onChange={(e) => emit({ ...map, currencyName: e.target.value }, drop)}
          />
          <label className="p-2 rounded bg-slate-950 border border-slate-700 text-white text-sm cursor-pointer text-center">
            导入底图
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) importBackground(f);
              }}
            />
          </label>
        </div>

        <textarea
          className="w-full h-20 p-2 rounded bg-slate-950 border border-slate-700 text-white"
          placeholder="初始公告"
          value={map.announcementText || ''}
          onChange={(e) => emit({ ...map, announcementText: e.target.value }, drop)}
        />
        <textarea
          className="w-full h-20 p-2 rounded bg-slate-950 border border-slate-700 text-white"
          placeholder="地图规则"
          value={map.layoutRuleText || ''}
          onChange={(e) => emit({ ...map, layoutRuleText: e.target.value }, drop)}
        />

        <div className="flex flex-wrap gap-2">
          <button className="px-3 py-2 rounded bg-slate-700 text-white text-sm font-bold" onClick={importJson}>导入JSON</button>
          <button className="px-3 py-2 rounded bg-slate-700 text-white text-sm font-bold" onClick={exportJson}>导出JSON</button>
          {!generated ? (
            <button className="px-3 py-2 rounded bg-emerald-600 text-white text-sm font-bold" onClick={confirmGenerate}>确认生成地图</button>
          ) : (
            <button className="px-3 py-2 rounded bg-amber-600 text-white text-sm font-bold" onClick={backToDraw}>返回绘制模式</button>
          )}
          <span className="text-xs text-slate-400 self-center">
            当前阶段：{generated ? '绑定阶段（可点位编辑）' : '绘制阶段（点击空白添加坐标点）'}
          </span>
        </div>
      </div>

      {/* 画布 + 点位属性 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* 画布 */}
        <div className="lg:col-span-2 bg-slate-900/80 border border-slate-700 rounded-2xl p-4">
          <div className="flex gap-2 mb-2">
            <input
              className="p-2 rounded bg-slate-950 border border-slate-700 text-white"
              value={newPointName}
              onChange={(e) => setNewPointName(e.target.value)}
              placeholder="新点位名称"
            />
            <select
              className="p-2 rounded bg-slate-950 border border-slate-700 text-white"
              value={newPointType}
              onChange={(e) => setNewPointType(e.target.value as PointType)}
            >
              <option value="town">城镇</option>
              <option value="wild">野外</option>
              <option value="dungeon">副本</option>
              <option value="shop">商店</option>
              <option value="spawn">出生点</option>
              <option value="custom">自定义</option>
            </select>
          </div>

          <div
            className="relative w-full h-[460px] rounded-xl border border-slate-700 overflow-hidden cursor-crosshair bg-slate-950"
            onClick={handleCanvasClick}
            style={{
              backgroundImage: map.backgroundImage ? `url(${map.backgroundImage})` : undefined,
              backgroundSize: 'cover',
              backgroundPosition: 'center'
            }}
          >
            {!map.backgroundImage && (
              <div className="absolute inset-0 flex items-center justify-center text-slate-500 text-sm">
                未导入底图（可直接在空白地图绘制）
              </div>
            )}

            {map.points.map((p) => (
              <button
                key={p.id}
                className={`absolute -translate-x-1/2 -translate-y-1/2 w-5 h-5 rounded-full border-2 border-white ${POINT_COLORS[p.type]} ${
                  selectedPointId === p.id ? 'ring-2 ring-amber-300' : ''
                }`}
                style={{ left: `${p.x}%`, top: `${p.y}%` }}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedPointId(p.id);
                }}
                title={`${p.name} (${p.type})`}
              />
            ))}
          </div>
        </div>

        {/* 右侧编辑 */}
        <div className="bg-slate-900/80 border border-slate-700 rounded-2xl p-4 space-y-3">
          <h4 className="font-black text-white">点位编辑</h4>
          {!selectedPoint ? (
            <div className="text-slate-400 text-sm">点击一个地图点位开始编辑</div>
          ) : (
            <>
              <input
                className="w-full p-2 rounded bg-slate-950 border border-slate-700 text-white"
                value={selectedPoint.name}
                onChange={(e) => updatePoint({ name: e.target.value })}
              />
              <select
                className="w-full p-2 rounded bg-slate-950 border border-slate-700 text-white"
                value={selectedPoint.type}
                onChange={(e) => updatePoint({ type: e.target.value as PointType })}
              >
                <option value="town">城镇</option>
                <option value="wild">野外</option>
                <option value="dungeon">副本</option>
                <option value="shop">商店</option>
                <option value="spawn">出生点</option>
                <option value="custom">自定义</option>
              </select>

              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  className="p-2 rounded bg-slate-950 border border-slate-700 text-white"
                  value={selectedPoint.x}
                  onChange={(e) => updatePoint({ x: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })}
                />
                <input
                  type="number"
                  className="p-2 rounded bg-slate-950 border border-slate-700 text-white"
                  value={selectedPoint.y}
                  onChange={(e) => updatePoint({ y: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })}
                />
              </div>

              <textarea
                className="w-full h-20 p-2 rounded bg-slate-950 border border-slate-700 text-white"
                value={selectedPoint.desc || ''}
                onChange={(e) => updatePoint({ desc: e.target.value })}
                placeholder="点位描述"
              />

              {generated && (
                <>
                  <div className="border-t border-slate-700 pt-3 space-y-2">
                    <button className="w-full py-2 rounded bg-indigo-600 text-white font-bold" onClick={addNpc}>+ 绑定NPC</button>
                    <button className="w-full py-2 rounded bg-violet-600 text-white font-bold" onClick={addItem}>+ 绑定物品</button>
                    <button className="w-full py-2 rounded bg-emerald-600 text-white font-bold" onClick={toggleDropPoint}>
                      {binding?.isDropPoint ? '取消降落点' : '设为降落点'}
                    </button>
                    <button className="w-full py-2 rounded bg-amber-600 text-white font-bold" onClick={setDefaultDrop}>设为默认降落点</button>
                  </div>
                </>
              )}

              <button className="w-full py-2 rounded bg-rose-600 text-white font-bold" onClick={() => removePoint(selectedPoint.id)}>
                删除该点位
              </button>
            </>
          )}
        </div>
      </div>

      {/* 绑定列表（仅生成后） */}
      {generated && selectedPoint && binding && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <BindingCard title={`NPC绑定 (${binding.npcs.length})`}>
            {binding.npcs.map((n) => (
              <div key={n.id} className="space-y-1 border border-slate-700 rounded p-2">
                <input
                  className="w-full p-1.5 rounded bg-slate-950 border border-slate-700 text-white text-xs"
                  value={n.name}
                  onChange={(e) => {
                    const next = {
                      ...map,
                      bindings: map.bindings.map((b) =>
                        b.pointId === binding.pointId
                          ? { ...b, npcs: b.npcs.map((x) => (x.id === n.id ? { ...x, name: e.target.value } : x)) }
                          : b
                      )
                    };
                    emit(next, drop);
                  }}
                />
                <textarea
                  className="w-full h-16 p-1.5 rounded bg-slate-950 border border-slate-700 text-white text-xs"
                  value={n.dialogue}
                  onChange={(e) => {
                    const next = {
                      ...map,
                      bindings: map.bindings.map((b) =>
                        b.pointId === binding.pointId
                          ? { ...b, npcs: b.npcs.map((x) => (x.id === n.id ? { ...x, dialogue: e.target.value } : x)) }
                          : b
                      )
                    };
                    emit(next, drop);
                  }}
                />
                <button
                  className="px-2 py-1 rounded bg-rose-600 text-white text-xs"
                  onClick={() => {
                    const next = {
                      ...map,
                      bindings: map.bindings.map((b) =>
                        b.pointId === binding.pointId
                          ? { ...b, npcs: b.npcs.filter((x) => x.id !== n.id) }
                          : b
                      )
                    };
                    emit(next, drop);
                  }}
                >
                  删除NPC
                </button>
              </div>
            ))}
          </BindingCard>

          <BindingCard title={`物品绑定 (${binding.items.length})`}>
            {binding.items.map((it) => (
              <div key={it.id} className="space-y-1 border border-slate-700 rounded p-2">
                <input
                  className="w-full p-1.5 rounded bg-slate-950 border border-slate-700 text-white text-xs"
                  value={it.name}
                  onChange={(e) => {
                    const next = {
                      ...map,
                      bindings: map.bindings.map((b) =>
                        b.pointId === binding.pointId
                          ? { ...b, items: b.items.map((x) => (x.id === it.id ? { ...x, name: e.target.value } : x)) }
                          : b
                      )
                    };
                    emit(next, drop);
                  }}
                />
                <div className="grid grid-cols-2 gap-1">
                  <input
                    type="number"
                    className="p-1.5 rounded bg-slate-950 border border-slate-700 text-white text-xs"
                    value={it.price ?? 0}
                    onChange={(e) => {
                      const next = {
                        ...map,
                        bindings: map.bindings.map((b) =>
                          b.pointId === binding.pointId
                            ? { ...b, items: b.items.map((x) => (x.id === it.id ? { ...x, price: Number(e.target.value) || 0 } : x)) }
                            : b
                        )
                      };
                      emit(next, drop);
                    }}
                  />
                  <input
                    type="number"
                    className="p-1.5 rounded bg-slate-950 border border-slate-700 text-white text-xs"
                    value={it.currencyDelta ?? 0}
                    onChange={(e) => {
                      const next = {
                        ...map,
                        bindings: map.bindings.map((b) =>
                          b.pointId === binding.pointId
                            ? { ...b, items: b.items.map((x) => (x.id === it.id ? { ...x, currencyDelta: Number(e.target.value) || 0 } : x)) }
                            : b
                        )
                      };
                      emit(next, drop);
                    }}
                  />
                </div>
                <button
                  className="px-2 py-1 rounded bg-rose-600 text-white text-xs"
                  onClick={() => {
                    const next = {
                      ...map,
                      bindings: map.bindings.map((b) =>
                        b.pointId === binding.pointId
                          ? { ...b, items: b.items.filter((x) => x.id !== it.id) }
                          : b
                      )
                    };
                    emit(next, drop);
                  }}
                >
                  删除物品
                </button>
              </div>
            ))}
          </BindingCard>
        </div>
      )}
    </div>
  );
}

function BindingCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-slate-900/80 border border-slate-700 rounded-2xl p-4">
      <h4 className="font-black text-white mb-2">{title}</h4>
      <div className="space-y-2">{children}</div>
    </div>
  );
}
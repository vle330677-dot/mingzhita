import React, { useCallback, useEffect, useMemo, useState } from 'react';

type RoomStatus = 'vacant' | 'occupied' | 'reserved' | 'maintenance';

export interface TowerRoom {
  id: string;
  code: string;          // 房号/编码
  name?: string;         // 房间名（可选）
  floor: number;         // 楼层
  area?: number;         // 面积
  roomType?: string;     // 户型/用途
  status: RoomStatus;
  tenantName?: string;   // 租户
  updatedAt?: string;
}

interface TowerRoomViewProps {
  towerId: string;
  loading?: boolean; // 外部可选 loading（会和内部 loading 合并）
  onCreateRoom?: () => void;
  onEditRoom?: (room: TowerRoom) => void;
  onViewRoom?: (room: TowerRoom) => void;
  /** 删除成功后的回调（可选） */
  onDeleted?: (roomId: string) => void;
}

const STATUS_META: Record<RoomStatus, { text: string; className: string }> = {
  vacant: { text: '空置', className: 'bg-slate-700 text-slate-100' },
  occupied: { text: '已入住', className: 'bg-emerald-700 text-emerald-100' },
  reserved: { text: '预留', className: 'bg-sky-700 text-sky-100' },
  maintenance: { text: '维修中', className: 'bg-amber-700 text-amber-100' },
};

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

function formatTime(v?: string) {
  if (!v) return '-';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '-';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${day} ${hh}:${mm}`;
}

/**
 * ===== 内置服务层（替代缺失的 @/services/towerRoomService）=====
 */
function normalizeRoomsPayload(payload: any): TowerRoom[] {
  const raw = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.rooms)
    ? payload.rooms
    : Array.isArray(payload?.data)
    ? payload.data
    : [];

  return raw.map((r: any) => ({
    id: String(r.id),
    code: String(r.code ?? r.roomCode ?? ''),
    name: r.name ?? r.roomName ?? undefined,
    floor: Number(r.floor ?? 0),
    area: r.area != null ? Number(r.area) : undefined,
    roomType: r.roomType ?? r.type ?? undefined,
    status: (r.status ?? 'vacant') as RoomStatus,
    tenantName: r.tenantName ?? r.tenant ?? undefined,
    updatedAt: r.updatedAt ?? r.updated_at ?? undefined,
  }));
}

async function getTowerRoomList(towerId: string): Promise<TowerRoom[]> {
  const candidates = [
    `/api/tower/rooms?towerId=${encodeURIComponent(towerId)}`,
    `/api/tower/${encodeURIComponent(towerId)}/rooms`,
  ];

  let lastError = '房间列表接口不可用';
  for (const url of candidates) {
    try {
      const res = await fetch(url);
      const data = await res.json().catch(() => ({}));

      if (res.status === 404) {
        lastError = data?.message || `接口不存在: ${url}`;
        continue;
      }

      if (!res.ok || data?.success === false) {
        throw new Error(data?.message || `请求失败: ${url}`);
      }

      return normalizeRoomsPayload(data);
    } catch (e: any) {
      lastError = e?.message || String(e);
    }
  }

  throw new Error(lastError);
}

async function removeTowerRoom(roomId: string): Promise<void> {
  const candidates = [
    `/api/tower/rooms/${encodeURIComponent(roomId)}`,
    `/api/tower/room/${encodeURIComponent(roomId)}`,
  ];

  let lastError = '删除接口不可用';
  for (const url of candidates) {
    try {
      const res = await fetch(url, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));

      if (res.status === 404) {
        lastError = data?.message || `接口不存在: ${url}`;
        continue;
      }

      if (!res.ok || data?.success === false) {
        throw new Error(data?.message || `删除失败: ${url}`);
      }

      return;
    } catch (e: any) {
      lastError = e?.message || String(e);
    }
  }

  throw new Error(lastError);
}

const btnBase =
  'px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed';
const btnGhost = `${btnBase} bg-slate-700 text-slate-100 hover:bg-slate-600`;
const btnPrimary = `${btnBase} bg-sky-600 text-white hover:bg-sky-500`;
const btnDanger = `${btnBase} bg-rose-700 text-rose-100 hover:bg-rose-600`;

// ✅ 同时提供“具名导出 + 默认导出”
export const TowerRoomView: React.FC<TowerRoomViewProps> = ({
  towerId,
  loading: outerLoading = false,
  onCreateRoom,
  onEditRoom,
  onViewRoom,
  onDeleted,
}) => {
  const [listLoading, setListLoading] = useState(false);
  const [deleteLoadingId, setDeleteLoadingId] = useState<string | null>(null);
  const [rooms, setRooms] = useState<TowerRoom[]>([]);

  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState<RoomStatus | 'all'>('all');
  const [typeFilter, setTypeFilter] = useState<string | 'all'>('all');

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const mergedLoading = outerLoading || listLoading;

  const loadData = useCallback(async () => {
    if (!towerId) return;
    setListLoading(true);
    try {
      const data = await getTowerRoomList(towerId);
      setRooms(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      alert('房间数据加载失败');
      setRooms([]);
    } finally {
      setListLoading(false);
    }
  }, [towerId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const roomTypeOptions = useMemo(() => {
    const set = new Set<string>();
    rooms.forEach((r) => r.roomType && set.add(r.roomType));
    return Array.from(set).sort();
  }, [rooms]);

  const filteredRooms = useMemo(() => {
    const kw = keyword.trim().toLowerCase();

    return rooms.filter((room) => {
      const hitKeyword =
        !kw ||
        room.code?.toLowerCase().includes(kw) ||
        room.name?.toLowerCase().includes(kw) ||
        room.tenantName?.toLowerCase().includes(kw) ||
        String(room.floor).includes(kw);

      const hitStatus = statusFilter === 'all' || room.status === statusFilter;
      const hitType = typeFilter === 'all' || room.roomType === typeFilter;

      return hitKeyword && hitStatus && hitType;
    });
  }, [rooms, keyword, statusFilter, typeFilter]);

  // 过滤变化后，自动回到第一页
  useEffect(() => {
    setPage(1);
  }, [keyword, statusFilter, typeFilter]);

  const total = filteredRooms.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, pageCount);
  const pageStart = (safePage - 1) * pageSize;
  const pageData = filteredRooms.slice(pageStart, pageStart + pageSize);

  const handleDelete = useCallback(
    async (room: TowerRoom) => {
      const ok = window.confirm(`确认删除房间「${room.code}」吗？\n删除后不可恢复，请谨慎操作。`);
      if (!ok) return;

      try {
        setDeleteLoadingId(room.id);
        await removeTowerRoom(room.id);
        setRooms((prev) => prev.filter((x) => x.id !== room.id));
        onDeleted?.(room.id);
        alert('删除成功');
      } catch (err) {
        console.error(err);
        alert('删除失败，请稍后重试');
      } finally {
        setDeleteLoadingId(null);
      }
    },
    [onDeleted],
  );

  return (
    <div className="rounded-2xl border border-slate-700 bg-slate-900 text-slate-100 shadow-xl p-4">
      {/* 头部 */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <h3 className="text-base font-black">房间列表</h3>
        <div className="flex gap-2">
          <button className={btnGhost} onClick={loadData} disabled={mergedLoading}>
            {mergedLoading ? '刷新中...' : '刷新'}
          </button>
          <button className={btnPrimary} onClick={onCreateRoom}>
            新建房间
          </button>
        </div>
      </div>

      {/* 筛选区 */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <input
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="搜索房号/名称/租户/楼层"
          className="w-[280px] max-w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-sm outline-none focus:border-sky-500"
        />

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as RoomStatus | 'all')}
          className="px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-sm outline-none focus:border-sky-500"
        >
          <option value="all">全部状态</option>
          <option value="vacant">空置</option>
          <option value="occupied">已入住</option>
          <option value="reserved">预留</option>
          <option value="maintenance">维修中</option>
        </select>

        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-sm outline-none focus:border-sky-500"
        >
          <option value="all">全部类型</option>
          {roomTypeOptions.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>

        <span className="text-xs text-slate-400">共 {filteredRooms.length} 条</span>
      </div>

      {/* 表格 */}
      <div className="overflow-auto rounded-xl border border-slate-700">
        <table className="min-w-[1100px] w-full text-sm">
          <thead className="bg-slate-800 text-slate-200">
            <tr>
              <th className="px-3 py-2 text-left">房号</th>
              <th className="px-3 py-2 text-left">名称</th>
              <th className="px-3 py-2 text-left">楼层</th>
              <th className="px-3 py-2 text-left">类型</th>
              <th className="px-3 py-2 text-left">面积(㎡)</th>
              <th className="px-3 py-2 text-left">状态</th>
              <th className="px-3 py-2 text-left">租户</th>
              <th className="px-3 py-2 text-left">更新时间</th>
              <th className="px-3 py-2 text-left">操作</th>
            </tr>
          </thead>
          <tbody>
            {mergedLoading ? (
              <tr>
                <td className="px-3 py-6 text-center text-slate-400" colSpan={9}>
                  加载中...
                </td>
              </tr>
            ) : pageData.length === 0 ? (
              <tr>
                <td className="px-3 py-6 text-center text-slate-500" colSpan={9}>
                  暂无房间数据
                </td>
              </tr>
            ) : (
              pageData.map((room) => {
                const meta = STATUS_META[room.status] || {
                  text: room.status,
                  className: 'bg-slate-700 text-slate-100',
                };
                return (
                  <tr key={room.id} className="border-t border-slate-800">
                    <td className="px-3 py-2">
                      <button
                        className="text-sky-400 hover:text-sky-300 underline decoration-dotted underline-offset-2"
                        onClick={() => onViewRoom?.(room)}
                      >
                        {room.code}
                      </button>
                    </td>
                    <td className="px-3 py-2">{room.name || '-'}</td>
                    <td className="px-3 py-2">{room.floor}</td>
                    <td className="px-3 py-2">{room.roomType || '-'}</td>
                    <td className="px-3 py-2">{room.area ? room.area.toFixed(2) : '-'}</td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-bold ${meta.className}`}>
                        {meta.text}
                      </span>
                    </td>
                    <td className="px-3 py-2">{room.tenantName || '-'}</td>
                    <td className="px-3 py-2">{formatTime(room.updatedAt)}</td>
                    <td className="px-3 py-2">
                      <div className="flex gap-1">
                        <button className={btnGhost} onClick={() => onViewRoom?.(room)}>
                          查看
                        </button>
                        <button className={btnGhost} onClick={() => onEditRoom?.(room)}>
                          编辑
                        </button>
                        <button
                          className={btnDanger}
                          disabled={deleteLoadingId === room.id}
                          onClick={() => handleDelete(room)}
                        >
                          {deleteLoadingId === room.id ? '删除中...' : '删除'}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* 分页 */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm">
        <div className="text-slate-400">共 {total} 条</div>

        <div className="flex items-center gap-2">
          <label className="text-slate-400">每页</label>
          <select
            value={pageSize}
            onChange={(e) => {
              const ps = Number(e.target.value) || 20;
              setPageSize(ps);
              setPage(1);
            }}
            className="px-2 py-1 rounded bg-slate-950 border border-slate-700"
          >
            {PAGE_SIZE_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>

          <button
            className={btnGhost}
            disabled={safePage <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            上一页
          </button>

          <span className="text-slate-300">
            第 {safePage} / {pageCount} 页
          </span>

          <button
            className={btnGhost}
            disabled={safePage >= pageCount}
            onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
          >
            下一页
          </button>
        </div>
      </div>
    </div>
  );
};

export default TowerRoomView;

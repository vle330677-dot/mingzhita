import React, { useEffect, useState } from 'react';

interface Props {
  userId: number;
  locationId: 'sanctuary' | 'slums' | 'rich_area';
  showToast: (msg: string) => void;
}

export function RoomEntrancesLayer({ userId, locationId, showToast }: Props) {
  const [rows, setRows] = useState<any[]>([]);
  const [selected, setSelected] = useState<any | null>(null);
  const [roomDetail, setRoomDetail] = useState<any | null>(null);

  useEffect(() => {
    let alive = true;
    const pull = async () => {
      try {
        const res = await fetch(`/api/rooms/entrances?locationId=${locationId}&viewerId=${userId}`);
        const data = await res.json();
        if (alive && data.success) setRows(data.rows || []);
      } catch {}
    };
    pull();
    const t = setInterval(pull, 4000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [locationId, userId]);

  const openCard = async (r: any) => {
    setSelected(r);
    try {
      const res = await fetch(`/api/rooms/${r.ownerId}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('USER_TOKEN') || ''}` }
      });
      const data = await res.json();
      if (data.success) setRoomDetail(data.room);
      else setRoomDetail(null);
    } catch {
      setRoomDetail(null);
    }
  };

  const enterRoom = async () => {
    if (!selected) return;
    let roomPassword = '';
    if (selected.locked && Number(selected.ownerId) !== Number(userId)) {
      const pwd = window.prompt('该房间已上锁，请输入房间密码：') || '';
      if (!pwd) return;
      const vr = await fetch(`/api/rooms/${selected.ownerId}/verify-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pwd })
      });
      const vd = await vr.json().catch(() => ({}));
      if (!vd.pass) {
        showToast('密码错误，无法进入');
        return;
      }
      roomPassword = pwd;
    }
    const res = await fetch(`/api/rooms/${selected.ownerId}/enter`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('USER_TOKEN') || ''}`
      },
      body: JSON.stringify({ password: roomPassword })
    });
    const data = await res.json();
    if (data.success) {
      showToast(data.message || '进入成功');
      setSelected(null);
      setRoomDetail(null);
    } else {
      showToast(data.message || '进入失败');
    }
  };

  return (
    <>
      {rows.map((r) => (
        <button
          key={r.ownerId}
          className="absolute z-30 -translate-x-1/2 -translate-y-1/2"
          style={{ left: `${r.x}%`, top: `${r.y}%` }}
          onClick={() => openCard(r)}
          title={`${r.ownerName}的房间`}
        >
          <div className="w-8 h-8 rounded-full bg-slate-900/90 border border-amber-300 text-amber-200 flex items-center justify-center shadow-lg">
            🏠
          </div>
        </button>
      ))}

      {selected && (
        <div className="fixed inset-0 z-[120] bg-black/50 flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-700 p-4 text-slate-100">
            <h3 className="font-black text-lg mb-1">{selected.ownerName} 的房间</h3>
            <p className="text-xs text-slate-400 mb-3">{selected.job || selected.role || '自由人'}</p>

            <div className="text-sm bg-slate-800 rounded-xl p-3 border border-slate-700 min-h-[70px]">
              {roomDetail?.description || selected.intro || '房主还没有写房间介绍。'}
            </div>

            <div className="mt-4 flex gap-2">
              <button onClick={enterRoom} className="flex-1 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 font-bold">
                进入房间
              </button>
              <button
                onClick={() => {
                  setSelected(null);
                  setRoomDetail(null);
                }}
                className="flex-1 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 font-bold"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

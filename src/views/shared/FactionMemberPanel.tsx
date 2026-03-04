import React, { useEffect, useMemo, useState } from 'react';
import { MapPin, RefreshCcw, ShieldAlert, UserMinus, Users } from 'lucide-react';
import { User } from '../../types';

interface FactionRosterRow {
  id: number;
  name: string;
  job: string;
  faction: string;
  currentLocation: string;
}

interface Props {
  user: User;
  locationId: string;
  showToast: (msg: string) => void;
  fetchGlobalData?: () => void;
  title?: string;
}

const LOCATION_LABEL: Record<string, string> = {
  tower_of_life: '命之塔',
  sanctuary: '圣所',
  london_tower: '伦敦塔',
  guild: '公会',
  army: '军队',
  slums: '西市',
  rich_area: '东市',
  demon_society: '恶魔会',
  paranormal_office: '灵异管理所',
  observers: '观察者',
  tower_guard: '守塔会'
};

function locationLabel(id?: string) {
  const key = String(id || '').trim();
  if (!key) return '未知区域';
  return LOCATION_LABEL[key] || key;
}

export function FactionMemberPanel({ user, locationId, showToast, fetchGlobalData, title }: Props) {
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [rows, setRows] = useState<FactionRosterRow[]>([]);
  const [factionName, setFactionName] = useState('');
  const [leaderJob, setLeaderJob] = useState('');
  const [canManage, setCanManage] = useState(false);
  const [kickEnabled, setKickEnabled] = useState(true);

  const pullRoster = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetch(`/api/faction/roster?userId=${user.id}&locationId=${encodeURIComponent(locationId)}`);
      const data = await res.json().catch(() => ({} as any));
      if (!res.ok || data.success === false) {
        if (!silent) showToast(data.message || '读取成员信息失败');
        return;
      }
      setRows(Array.isArray(data.members) ? data.members : []);
      setFactionName(String(data.factionName || ''));
      setLeaderJob(String(data.leaderJob || ''));
      setCanManage(Boolean(data.canManage));
      setKickEnabled(Boolean(data.kickEnabled ?? true));
    } catch {
      if (!silent) showToast('网络异常，读取成员信息失败');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    pullRoster(true);
    const timer = setInterval(() => pullRoster(true), 10000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id, locationId]);

  const groupedRows = useMemo(() => {
    const m = new Map<string, FactionRosterRow[]>();
    for (const row of rows) {
      const job = String(row.job || '无职位');
      if (!m.has(job)) m.set(job, []);
      m.get(job)!.push(row);
    }
    return Array.from(m.entries());
  }, [rows]);

  const handleKick = async (target: FactionRosterRow) => {
    if (!canManage || !kickEnabled) return;
    if (Number(target.id) === Number(user.id)) return;
    if (!window.confirm(`确认辞退 ${target.name} 吗？`)) return;
    try {
      const res = await fetch('/api/faction/kick', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operatorId: user.id,
          targetUserId: target.id,
          locationId
        })
      });
      const data = await res.json().catch(() => ({} as any));
      if (!res.ok || data.success === false) {
        showToast(data.message || '辞退失败');
        return;
      }
      showToast(data.message || '辞退成功');
      pullRoster(true);
      if (fetchGlobalData) fetchGlobalData();
    } catch {
      showToast('网络异常，辞退失败');
    }
  };

  return (
    <div className="rounded-2xl border border-slate-600/40 bg-slate-900/50 p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="font-black text-sm text-slate-100 flex items-center gap-2">
            <Users size={16} />
            {title || '职位房间与成员信息'}
          </h4>
          <p className="text-[11px] text-slate-400 mt-1">
            阵营：{factionName || '未配置'} {leaderJob ? `| 最高职位：${leaderJob}` : ''}
          </p>
        </div>
        <button
          onClick={() => {
            setRefreshing(true);
            pullRoster();
          }}
          className="px-2.5 py-1.5 rounded-lg bg-slate-800 text-slate-200 text-xs font-bold hover:bg-slate-700 transition-colors inline-flex items-center gap-1.5"
        >
          <RefreshCcw size={12} className={refreshing ? 'animate-spin' : ''} />
          刷新
        </button>
      </div>

      {canManage && kickEnabled && (
        <div className="text-[11px] text-amber-300 bg-amber-900/20 border border-amber-700/30 rounded-lg p-2 flex items-center gap-2">
          <ShieldAlert size={13} />
          你当前拥有成员辞退权限。
        </div>
      )}

      {!kickEnabled && (
        <div className="text-[11px] text-slate-300 bg-slate-800/70 border border-slate-600/30 rounded-lg p-2">
          该区域仅展示成员信息，不允许辞退操作。
        </div>
      )}

      {loading && rows.length === 0 ? (
        <div className="text-xs text-slate-400 py-4 text-center">成员信息加载中...</div>
      ) : groupedRows.length === 0 ? (
        <div className="text-xs text-slate-500 py-4 text-center">暂无成员数据</div>
      ) : (
        <div className="space-y-3 max-h-72 overflow-y-auto pr-1 custom-scrollbar">
          {groupedRows.map(([job, members]) => (
            <div key={job} className="rounded-xl border border-slate-700 bg-slate-900/70">
              <div className="px-3 py-2 border-b border-slate-700 text-xs font-black text-slate-300 flex items-center justify-between">
                <span>{job}</span>
                <span className="text-[10px] text-slate-500">{members.length} 人</span>
              </div>
              <div className="p-2 space-y-2">
                {members.map((m) => (
                  <div key={m.id} className="flex items-center justify-between gap-2 rounded-lg bg-slate-800/80 px-2.5 py-2">
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-100 truncate">{m.name}</div>
                      <div className="text-[10px] text-slate-400 flex items-center gap-1">
                        <MapPin size={11} />
                        {locationLabel(m.currentLocation)}
                      </div>
                    </div>
                    {canManage &&
                      kickEnabled &&
                      Number(m.id) !== Number(user.id) &&
                      (locationId !== 'guild' || String(m.job || '') === '公会成员') && (
                      <button
                        onClick={() => handleKick(m)}
                        className="px-2 py-1 rounded bg-rose-900/50 text-rose-300 text-[10px] font-black hover:bg-rose-800/70 transition-colors inline-flex items-center gap-1"
                      >
                        <UserMinus size={11} />
                        辞退
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default FactionMemberPanel;

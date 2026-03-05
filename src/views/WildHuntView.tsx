import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Package, RefreshCw, ShieldAlert, Skull, Swords } from 'lucide-react';
import { User } from '../types';

interface MonsterEncounter {
  id: number;
  name: string;
  description?: string;
  level: number;
  power: number;
  hp: number;
  tier?: string;
}

interface WildBattleLogRow {
  id: number;
  eventType: 'monster' | 'item';
  monsterName?: string;
  monsterLevel?: number;
  isWin?: boolean;
  resultText?: string;
  hpDelta?: number;
  mentalDelta?: number;
  physicalDelta?: number;
  droppedItem?: string;
  returnedTo?: string;
  createdAt?: string;
}

interface Props {
  user: User;
  onClose: () => void;
  onDefeatReturn: (returnLocation?: string) => void;
  showToast: (msg: string) => void;
  fetchGlobalData: () => void;
}

export function WildHuntView({ user, onClose, onDefeatReturn, showToast, fetchGlobalData }: Props) {
  const [loading, setLoading] = useState(false);
  const [fighting, setFighting] = useState(false);
  const [eventType, setEventType] = useState<'monster' | 'item' | ''>('');
  const [monster, setMonster] = useState<MonsterEncounter | null>(null);
  const [itemText, setItemText] = useState('');
  const [resultText, setResultText] = useState('');
  const [pendingDefeatChoice, setPendingDefeatChoice] = useState<{ returnLocation: string } | null>(null);
  const [recentLogs, setRecentLogs] = useState<WildBattleLogRow[]>([]);
  const [statsPreview, setStatsPreview] = useState<{
    hp?: number;
    mp?: number;
    erosionLevel?: number;
    bleedingLevel?: number;
    mentalProgress?: number;
    physicalProgress?: number;
  }>({});

  const statLine = useMemo(() => {
    const hp = Number(statsPreview.hp ?? user.hp ?? 0);
    const mp = Number(statsPreview.mp ?? user.mp ?? 0);
    const erosion = Number(statsPreview.erosionLevel ?? user.erosionLevel ?? 0);
    const bleeding = Number(statsPreview.bleedingLevel ?? user.bleedingLevel ?? 0);
    const mental = Number(statsPreview.mentalProgress ?? user.mentalProgress ?? 0);
    const physical = Number(statsPreview.physicalProgress ?? user.physicalProgress ?? 0);
    return `HP ${hp} | MP ${mp} | 侵蚀 ${erosion.toFixed(1)}% | 流血 ${bleeding.toFixed(1)}% | 精神力进度 ${mental.toFixed(1)}% | 肉体强度进度 ${physical.toFixed(1)}%`;
  }, [statsPreview, user.hp, user.mp, user.erosionLevel, user.bleedingLevel, user.mentalProgress, user.physicalProgress]);

  const loadLogs = async () => {
    try {
      const res = await fetch(`/api/explore/wild/logs/${user.id}?limit=12`);
      const data = await res.json().catch(() => ({} as any));
      if (!res.ok || data.success === false) return;
      setRecentLogs(Array.isArray(data.logs) ? data.logs : []);
    } catch {
      // ignore
    }
  };

  const rollEncounter = async () => {
    setLoading(true);
    setResultText('');
    setPendingDefeatChoice(null);
    try {
      const res = await fetch('/api/explore/wild/roll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id })
      });
      const data = await res.json().catch(() => ({} as any));
      if (!res.ok || data.success === false) {
        showToast(data.message || '刷新遭遇失败');
        return;
      }
      setStatsPreview((prev) => ({ ...prev, mp: Number(data.mp ?? prev.mp ?? user.mp ?? 0) }));

      const nextType = String(data.eventType || '');
      if (nextType === 'item') {
        setEventType('item');
        setMonster(null);
        setItemText(String(data.message || '你获得了一个道具'));
        showToast(String(data.message || '获得道具'));
        fetchGlobalData();
        loadLogs();
        return;
      }

      setEventType('monster');
      setItemText('');
      const row = data.monster || {};
      setMonster({
        id: Number(row.id || 0),
        name: String(row.name || '未知魔物'),
        description: String(row.description || ''),
        level: Number(row.level || 1),
        power: Number(row.power || 0),
        hp: Number(row.hp || 0),
        tier: String(row.tier || '低阶')
      });
    } catch {
      showToast('网络异常，刷新遭遇失败');
    } finally {
      setLoading(false);
    }
  };

  const fightMonster = async () => {
    if (!monster) return;
    setFighting(true);
    try {
      const res = await fetch('/api/explore/wild/fight', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, monsterId: monster.id, level: monster.level })
      });
      const data = await res.json().catch(() => ({} as any));
      if (!res.ok || data.success === false) {
        showToast(data.message || '战斗失败');
        if (res.status === 409) {
          rollEncounter();
        }
        return;
      }

      const debuffMessage = String(data?.debuff?.message || '');
      const baseMessage = String(data.message || '');
      const nextResult = debuffMessage && !baseMessage.includes(debuffMessage) ? `${baseMessage}；${debuffMessage}` : baseMessage;
      setResultText(nextResult);
      setStatsPreview((prev) => ({
        ...prev,
        hp: Number(data.hp ?? user.hp ?? 0),
        mp: Number(data.mp ?? prev.mp ?? user.mp ?? 0),
        erosionLevel: Number(data.erosionLevel ?? prev.erosionLevel ?? user.erosionLevel ?? 0),
        bleedingLevel: Number(data.bleedingLevel ?? prev.bleedingLevel ?? user.bleedingLevel ?? 0),
        mentalProgress: Number(data.mentalProgress ?? user.mentalProgress ?? 0),
        physicalProgress: Number(data.physicalProgress ?? user.physicalProgress ?? 0)
      }));
      showToast(nextResult || '战斗结算完成');
      fetchGlobalData();
      loadLogs();

      if (data.isWin) {
        if (data.droppedItem) showToast(`掉落道具：${String(data.droppedItem)}`);
        window.setTimeout(() => {
          rollEncounter();
        }, 450);
        return;
      }

      const returnLocation = String(data.returnLocation || '');
      if (Boolean(data.needsRetreatChoice)) {
        setPendingDefeatChoice({ returnLocation });
        return;
      }
      window.setTimeout(() => {
        onDefeatReturn(returnLocation);
      }, 700);
    } catch {
      showToast('网络异常，战斗失败');
    } finally {
      setFighting(false);
    }
  };

  const handleHeadstrongRetry = async () => {
    if (loading || fighting) return;
    setPendingDefeatChoice(null);
    await rollEncounter();
  };

  const handleRetreat = async () => {
    if (!pendingDefeatChoice) return;
    try {
      setLoading(true);
      const res = await fetch('/api/explore/wild/retreat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          returnLocation: pendingDefeatChoice.returnLocation || ''
        })
      });
      const data = await res.json().catch(() => ({} as any));
      if (!res.ok || data.success === false) {
        showToast(data.message || '撤退失败');
        return;
      }
      showToast(data.message || '你选择知难而退。');
      onDefeatReturn(String(data.returnLocation || pendingDefeatChoice.returnLocation || ''));
    } catch {
      showToast('网络异常，撤退失败');
    } finally {
      setLoading(false);
      setPendingDefeatChoice(null);
    }
  };

  useEffect(() => {
    rollEncounter();
    loadLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id]);

  return (
    <div className="fixed inset-0 z-[9998] text-slate-100 overflow-y-auto">
      <div className="absolute inset-0">
        <img src="/map_background.jpg" className="w-full h-full object-cover" alt="wild-bg" />
        <div className="absolute inset-0 bg-slate-950/80" />
      </div>

      <div className="relative z-10 max-w-4xl mx-auto min-h-full p-4 md:p-8 flex flex-col">
        <div className="flex items-center justify-between">
          <button
            onClick={() => {
              if (pendingDefeatChoice) {
                showToast('请先选择“头铁再战”或“知难而退”。');
                return;
              }
              onClose();
            }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900/80 border border-slate-700 hover:bg-slate-800"
          >
            <ArrowLeft size={16} />
            返回世界
          </button>
          <button
            onClick={rollEncounter}
            disabled={loading || fighting || Boolean(pendingDefeatChoice)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            刷新遭遇
          </button>
        </div>

        <div className="mt-5 rounded-3xl border border-slate-700 bg-slate-900/70 p-5 md:p-8 shadow-2xl md:flex-1 flex flex-col max-h-[72vh] md:max-h-none overflow-y-auto custom-scrollbar mobile-portrait-safe-card mobile-contrast-surface-dark">
          <h2 className="text-2xl font-black flex items-center gap-2">
            <Skull size={24} className="text-rose-400" />
            界外区域 - 打怪系统
          </h2>
          <p className="text-xs text-slate-400 mt-2">{statLine}</p>
          <p className="text-[11px] text-slate-500 mt-1">刷新遭遇消耗 {5} MP，冷却约 {8} 秒</p>

          {eventType === 'monster' && monster && (
            <div className="mt-6 rounded-2xl border border-rose-500/30 bg-rose-950/20 p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xl font-black text-rose-200">{monster.name}</div>
                  <div className="text-xs text-rose-300/80 mt-1">{monster.description || '未知魔物，极具攻击性。'}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-black text-amber-300">Lv.{monster.level}</div>
                  <div className="text-[11px] text-slate-300">阶级：{monster.tier || '低阶'}</div>
                </div>
              </div>
              <div className="mt-3 text-xs text-slate-300">
                预估战力：{monster.power.toFixed(1)} | 生命：{monster.hp}
              </div>
              <button
                onClick={fightMonster}
                disabled={fighting || loading || Boolean(pendingDefeatChoice)}
                className="mt-4 w-full py-3 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-60 font-black inline-flex items-center justify-center gap-2"
              >
                <Swords size={16} />
                {fighting ? '战斗结算中...' : '挑战该魔物'}
              </button>
            </div>
          )}

          {eventType === 'item' && (
            <div className="mt-6 rounded-2xl border border-amber-500/30 bg-amber-950/20 p-5">
              <div className="flex items-center gap-2 text-amber-300 font-black">
                <Package size={18} />
                你遇到了物资点
              </div>
              <p className="text-sm text-amber-100 mt-2">{itemText || '你找到了一件道具。'}</p>
            </div>
          )}

          {!eventType && (
            <div className="mt-6 rounded-2xl border border-slate-700 bg-slate-800/50 p-5 text-sm text-slate-300">
              正在读取界外区域遭遇信息...
            </div>
          )}

          {resultText && (
            <div className="mt-5 rounded-xl border border-sky-500/30 bg-sky-950/20 p-4 text-sm text-sky-100">
              <div className="font-black mb-1 inline-flex items-center gap-2">
                <ShieldAlert size={15} />
                战斗结算
              </div>
              <div>{resultText}</div>
            </div>
          )}

          {pendingDefeatChoice && (
            <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-950/20 p-4">
              <div className="text-sm font-black text-amber-200">你已战败，下一步怎么做？</div>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <button
                  onClick={handleHeadstrongRetry}
                  className="w-full py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 font-black text-white"
                >
                  头铁再战
                </button>
                <button
                  onClick={handleRetreat}
                  disabled={loading}
                  className="w-full py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 disabled:opacity-60 font-black text-slate-100"
                >
                  知难而退
                </button>
              </div>
            </div>
          )}

          <div className="mt-5 rounded-xl border border-slate-700 bg-slate-950/60 p-3">
            <div className="text-xs font-black text-slate-300 mb-2">近期战斗/掉落记录</div>
            <div className="max-h-36 overflow-y-auto custom-scrollbar space-y-2 pr-1">
              {recentLogs.length === 0 && <div className="text-[11px] text-slate-500">暂无记录</div>}
              {recentLogs.map((log) => (
                <div key={log.id} className="rounded-lg border border-slate-800 bg-slate-900/80 px-2.5 py-2 text-[11px]">
                  <div className="flex items-center justify-between gap-2">
                    <span className={log.isWin ? 'text-emerald-300 font-black' : 'text-rose-300 font-black'}>
                      {log.eventType === 'item' ? '拾取' : log.isWin ? '胜利' : '失败'}
                    </span>
                    <span className="text-slate-500">{log.createdAt ? new Date(log.createdAt).toLocaleTimeString() : ''}</span>
                  </div>
                  <div className="mt-1 text-slate-300">
                    {log.eventType === 'item'
                      ? log.resultText || '获得道具'
                      : `${log.monsterName || '未知魔物'} Lv.${Number(log.monsterLevel || 0)} · ${log.resultText || ''}`}
                  </div>
                  {!!log.droppedItem && <div className="text-amber-300 mt-1">掉落：{log.droppedItem}</div>}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default WildHuntView;

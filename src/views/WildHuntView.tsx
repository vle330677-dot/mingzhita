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

// Deterministic pseudo-random from a string seed
function seededRand(seed: string, index: number): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
  }
  h = (Math.imul(h ^ (h >>> 16), 0x45d9f3b)) | 0;
  h = (h ^ index * 2654435761) | 0;
  return Math.abs(h) / 2147483648;
}

// Hand-drawn style monster SVG based on tier and name
function MonsterIllustration({ monster }: { monster: MonsterEncounter }) {
  const seed = monster.name + monster.id;
  const r = (i: number) => seededRand(seed, i);

  const tier = monster.tier || '低阶';
  const tierColor = {
    '低阶': { body: '#7c3f3f', accent: '#c06060', glow: '#ff8080', bg: '#2d1010' },
    '中阶': { body: '#3a5c7a', accent: '#5a90be', glow: '#80c0ff', bg: '#0d1e2d' },
    '高阶': { body: '#4a2e6a', accent: '#8050c0', glow: '#c080ff', bg: '#1a0d2e' },
    '稀有': { body: '#6a4a10', accent: '#c0901a', glow: '#ffcc40', bg: '#2a1c04' },
    '传说': { body: '#6a0a0a', accent: '#ff2020', glow: '#ff6060', bg: '#200404' },
  }[tier] || { body: '#7c3f3f', accent: '#c06060', glow: '#ff8080', bg: '#2d1010' };

  // Generate monster body as blob shape
  const cx = 100, cy = 105;
  const points = 10;
  const blobPoints = Array.from({ length: points }, (_, i) => {
    const angle = (i / points) * Math.PI * 2;
    const base = 38 + r(i) * 18;
    const rx = Math.cos(angle) * base * (0.8 + r(i + 100) * 0.4);
    const ry = Math.sin(angle) * base * (0.7 + r(i + 200) * 0.35);
    return [cx + rx, cy + ry];
  });
  const blobPath = blobPoints.map((p, i) => {
    const next = blobPoints[(i + 1) % points];
    const mid = [(p[0] + next[0]) / 2, (p[1] + next[1]) / 2];
    return `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)} Q${mid[0].toFixed(1)},${mid[1].toFixed(1)}`;
  }).join(' ') + ' Z';

  // Eyes
  const eyeCount = r(10) > 0.6 ? 3 : 2;
  const eyeData = Array.from({ length: eyeCount }, (_, i) => ({
    x: cx + (i - (eyeCount - 1) / 2) * (14 + r(i + 20) * 4) + (r(i + 30) - 0.5) * 8,
    y: cy - 10 + (r(i + 40) - 0.5) * 8,
    rx: 5 + r(i + 50) * 5,
    ry: 4 + r(i + 60) * 4,
  }));

  // Tentacles / limbs
  const limbCount = 2 + Math.floor(r(70) * 4);
  const limbs = Array.from({ length: limbCount }, (_, i) => {
    const startAngle = (i / limbCount) * Math.PI * 2 + r(i + 80) * 0.5;
    const startR = 44;
    const sx = cx + Math.cos(startAngle) * startR;
    const sy = cy + Math.sin(startAngle) * startR;
    const len = 28 + r(i + 90) * 24;
    const ex = sx + Math.cos(startAngle + (r(i + 100) - 0.5)) * len;
    const ey = sy + Math.sin(startAngle + (r(i + 110) - 0.5) * 1.2) * len;
    const cpx = (sx + ex) / 2 + (r(i + 120) - 0.5) * 20;
    const cpy = (sy + ey) / 2 + (r(i + 130) - 0.5) * 20;
    return { sx, sy, ex, ey, cpx, cpy };
  });

  // Spikes on body
  const spikeCount = Math.floor(r(140) * 5) + 2;
  const spikes = Array.from({ length: spikeCount }, (_, i) => {
    const angle = r(i + 150) * Math.PI * 2;
    const br = 36 + r(i + 160) * 14;
    const bx = cx + Math.cos(angle) * br;
    const by = cy + Math.sin(angle) * br;
    const tipLen = 12 + r(i + 170) * 14;
    const tx = bx + Math.cos(angle) * tipLen;
    const ty = by + Math.sin(angle) * tipLen;
    return { bx, by, tx, ty };
  });

  const glowId = `glow-${monster.id}`;
  const sketchId = `sketch-${monster.id}`;

  return (
    <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" className="w-full h-full" style={{ filter: `drop-shadow(0 0 12px ${tierColor.glow}88)` }}>
      <defs>
        <filter id={glowId}>
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <filter id={sketchId}>
          <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="4" result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="2.5" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </defs>

      {/* Background glow circle */}
      <circle cx={cx} cy={cy} r="60" fill={tierColor.bg} opacity="0.8" />
      <circle cx={cx} cy={cy} r="52" fill="none" stroke={tierColor.glow} strokeWidth="0.5" opacity="0.3" />

      {/* Limbs (behind body) */}
      {limbs.map((l, i) => (
        <path
          key={`limb-${i}`}
          d={`M${l.sx.toFixed(1)},${l.sy.toFixed(1)} Q${l.cpx.toFixed(1)},${l.cpy.toFixed(1)} ${l.ex.toFixed(1)},${l.ey.toFixed(1)}`}
          stroke={tierColor.body}
          strokeWidth={3 + r(i + 200) * 2}
          fill="none"
          strokeLinecap="round"
          filter={`url(#${sketchId})`}
        />
      ))}

      {/* Body */}
      <path d={blobPath} fill={tierColor.body} stroke={tierColor.accent} strokeWidth="1.5" filter={`url(#${sketchId})`} />

      {/* Spikes */}
      {spikes.map((s, i) => (
        <line
          key={`spike-${i}`}
          x1={s.bx.toFixed(1)} y1={s.by.toFixed(1)}
          x2={s.tx.toFixed(1)} y2={s.ty.toFixed(1)}
          stroke={tierColor.accent}
          strokeWidth="1.5"
          strokeLinecap="round"
          filter={`url(#${sketchId})`}
        />
      ))}

      {/* Eyes */}
      {eyeData.map((e, i) => (
        <g key={`eye-${i}`}>
          <ellipse cx={e.x} cy={e.y} rx={e.rx} ry={e.ry} fill="#0a0a0a" stroke={tierColor.accent} strokeWidth="1" />
          <ellipse cx={e.x} cy={e.y} rx={e.rx * 0.55} ry={e.ry * 0.55} fill={tierColor.glow} filter={`url(#${glowId})`} />
          <circle cx={e.x + e.rx * 0.25} cy={e.y - e.ry * 0.25} r={e.rx * 0.18} fill="white" opacity="0.7" />
        </g>
      ))}

      {/* Sketch hatching overlay for hand-drawn look */}
      {Array.from({ length: 6 }, (_, i) => {
        const y1 = cy - 38 + i * 13;
        return (
          <line
            key={`hatch-${i}`}
            x1={cx - 30 + r(i + 300) * 10}
            y1={y1}
            x2={cx + 25 + r(i + 310) * 10}
            y2={y1 + 4}
            stroke={tierColor.accent}
            strokeWidth="0.4"
            opacity="0.25"
          />
        );
      })}

      {/* Name tag */}
      <text
        x={cx}
        y="185"
        textAnchor="middle"
        fontSize="9"
        fill={tierColor.glow}
        fontFamily="serif"
        letterSpacing="1"
        opacity="0.85"
      >
        {monster.name}
      </text>
    </svg>
  );
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
    return `生命 ${hp} | 精神 ${mp} | 侵蚀 ${erosion.toFixed(1)}% | 流血 ${bleeding.toFixed(1)}% | 精神力进度 ${mental.toFixed(1)}% | 肉体强度进度 ${physical.toFixed(1)}%`;
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

  const tierBadgeColor = (tier?: string) => {
    switch (tier) {
      case '中阶': return 'bg-sky-900/60 text-sky-300 border-sky-700/50';
      case '高阶': return 'bg-violet-900/60 text-violet-300 border-violet-700/50';
      case '稀有': return 'bg-amber-900/60 text-amber-300 border-amber-700/50';
      case '传说': return 'bg-rose-900/60 text-rose-300 border-rose-700/50';
      default: return 'bg-slate-800/60 text-slate-300 border-slate-700/50';
    }
  };

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
                showToast('请先选择"头铁再战"或"知难而退"。');
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
          <p className="text-[11px] text-slate-500 mt-1">刷新遭遇消耗 {5} 精神，冷却约 {8} 秒</p>

          {eventType === 'monster' && monster && (
            <div className="mt-6 rounded-2xl border border-rose-800/40 bg-rose-950/15 overflow-hidden">
              {/* Monster illustration panel */}
              <div className="md:flex">
                <div className="md:w-44 md:shrink-0 bg-black/40 flex items-center justify-center p-3 min-h-[160px]">
                  {loading ? (
                    <div className="w-full h-40 flex items-center justify-center">
                      <RefreshCw size={28} className="animate-spin text-rose-500 opacity-60" />
                    </div>
                  ) : (
                    <div className="w-36 h-40 md:w-full md:h-44">
                      <MonsterIllustration monster={monster} />
                    </div>
                  )}
                </div>

                <div className="flex-1 p-4 md:p-5 flex flex-col justify-between">
                  <div>
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div>
                        <div className="text-xl font-black text-rose-200 leading-tight">{monster.name}</div>
                        <div className="text-xs text-rose-300/80 mt-1.5 leading-relaxed">
                          {monster.description || '未知魔物，极具攻击性。'}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-sm font-black text-amber-300">Lv.{monster.level}</div>
                        <span className={`mt-1 inline-block px-2 py-0.5 rounded text-[10px] font-bold border ${tierBadgeColor(monster.tier)}`}>
                          {monster.tier || '低阶'}
                        </span>
                      </div>
                    </div>

                    <div className="mt-3 flex gap-4 text-xs text-slate-300">
                      <span>战力 <span className="text-rose-300 font-bold">{monster.power.toFixed(1)}</span></span>
                      <span>生命 <span className="text-emerald-300 font-bold">{monster.hp}</span></span>
                    </div>
                  </div>

                  <button
                    onClick={fightMonster}
                    disabled={fighting || loading || Boolean(pendingDefeatChoice)}
                    className="mt-4 w-full py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-60 font-black inline-flex items-center justify-center gap-2 text-sm"
                  >
                    <Swords size={15} />
                    {fighting ? '战斗结算中...' : '挑战该魔物'}
                  </button>
                </div>
              </div>
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
                      : `${log.monsterName || '未知魔物'} 等级 ${Number(log.monsterLevel || 0)} · ${log.resultText || ''}`}
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

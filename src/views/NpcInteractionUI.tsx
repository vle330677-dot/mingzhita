import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { X, UserRound, MessageCircle, HandCoins, Swords, ShieldAlert, Heart, Sparkles } from 'lucide-react';
import { User } from '../types';

interface WorldNpc {
  id: string;
  name: string;
  skillFaction?: string;
  personality?: string;
  identity?: string;
  appearance?: string;
  currentLocation?: string;
  locationName?: string;
  affinity?: number;
  affinityStage?: string;
  mood?: string;
  interactionHint?: string;
  availableActions?: string[];
}

interface Props {
  currentUser: User;
  npc: WorldNpc;
  onClose: () => void;
  showToast: (msg: string) => void;
  onUpdated?: () => void | Promise<void>;
}

const ACTION_META: Record<string, { label: string; className: string; icon: React.ReactNode }> = {
  steal: {
    label: '偷窃',
    className: 'bg-slate-700 hover:bg-slate-600 border-slate-500',
    icon: <HandCoins size={14} />
  },
  rob: {
    label: '打劫',
    className: 'bg-rose-700 hover:bg-rose-600 border-rose-500',
    icon: <Swords size={14} />
  },
  threaten: {
    label: '威胁',
    className: 'bg-red-800 hover:bg-red-700 border-red-500',
    icon: <ShieldAlert size={14} />
  },
  favor: {
    label: '示好',
    className: 'bg-emerald-700 hover:bg-emerald-600 border-emerald-500',
    icon: <Heart size={14} />
  },
  chat: {
    label: '闲聊',
    className: 'bg-sky-700 hover:bg-sky-600 border-sky-500',
    icon: <MessageCircle size={14} />
  }
};

function affinityColor(affinity: number) {
  if (affinity >= 80) return 'from-emerald-500 to-emerald-300';
  if (affinity >= 60) return 'from-sky-500 to-sky-300';
  if (affinity <= 30) return 'from-rose-600 to-rose-400';
  return 'from-amber-500 to-amber-300';
}

export function NpcInteractionUI({ currentUser, npc, onClose, showToast, onUpdated }: Props) {
  const [npcStatus, setNpcStatus] = useState<WorldNpc>(npc);
  const [chatLines, setChatLines] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pendingAction, setPendingAction] = useState('');

  useEffect(() => {
    setNpcStatus(npc);
  }, [npc]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    let alive = true;
    const loadStatus = async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/world/npcs/${encodeURIComponent(String(npc.id || ''))}/status?userId=${currentUser.id}`, {
          cache: 'no-store'
        });
        const data = await res.json().catch(() => ({} as any));
        if (!alive) return;
        if (!res.ok || data.success === false || !data.npc) {
          showToast(data.message || '加载角色状态失败');
          return;
        }
        setNpcStatus(data.npc);
        setChatLines((prev) => {
          const hint = String(data.npc.interactionHint || '').trim();
          if (!hint) return prev;
          return prev.length > 0 ? prev : [hint];
        });
      } catch {
        if (alive) showToast('网络异常，加载角色状态失败');
      } finally {
        if (alive) setIsLoading(false);
      }
    };
    loadStatus();
    return () => {
      alive = false;
    };
  }, [npc.id, currentUser.id]);

  const affinity = Math.max(0, Math.min(100, Number(npcStatus.affinity || 0)));
  const barClass = useMemo(() => affinityColor(affinity), [affinity]);
  const actions = useMemo(() => {
    const rows = Array.isArray(npcStatus.availableActions) ? npcStatus.availableActions : ['steal', 'rob', 'threaten', 'favor', 'chat'];
    return rows.filter((x) => ACTION_META[x]);
  }, [npcStatus.availableActions]);

  const pushLines = (lines: string[]) => {
    const clean = lines.map((x) => String(x || '').trim()).filter(Boolean);
    if (!clean.length) return;
    setChatLines((prev) => [...prev, ...clean].slice(-8));
  };

  const handleAction = async (action: string) => {
    if (!action || pendingAction) return;
    setPendingAction(action);
    try {
      const res = await fetch('/api/world/npcs/interact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser.id,
          npcId: npcStatus.id,
          action
        })
      });
      const data = await res.json().catch(() => ({} as any));
      if (!res.ok || data.success === false) {
        showToast(data.message || '角色交互失败');
        return;
      }

      setNpcStatus((prev) => ({
        ...prev,
        ...(data.npc || {}),
        affinity: Number(data.affinity ?? prev.affinity ?? 0),
        affinityStage: String(data.affinityStage || data.npc?.affinityStage || prev.affinityStage || ''),
        mood: String(data.npc?.mood || prev.mood || '')
      }));

      const lines: string[] = [];
      if (data.reply) lines.push(`【${String(data.npc?.name || npcStatus.name || '角色')}】${String(data.reply)}`);
      if (data.intel) lines.push(`情报：${String(data.intel)}`);
      if (data.reward?.item?.name) {
        lines.push(`获得道具：${String(data.reward.item.name)}（${String(data.reward.item.tier || '高阶')}）`);
      }
      if (data.reward?.skill?.name) {
        const skillLine = data.reward.skill.convertedToBook
          ? `获得技能书：${String(data.reward.skill.name)}（派系不匹配已转技能书）`
          : `获得技能：${String(data.reward.skill.name)}（${String(data.reward.skill.faction || '通用')}）`;
        lines.push(skillLine);
      }
      if (data.rewardNotice) lines.push(String(data.rewardNotice));
      if (lines.length === 0 && data.message) lines.push(String(data.message));
      pushLines(lines);

      showToast(data.message || `${ACTION_META[action]?.label || action}完成`);
      if (onUpdated) await onUpdated();
    } catch {
      showToast('网络异常，角色交互失败');
    } finally {
      setPendingAction('');
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 mobile-portrait-safe-overlay">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="theme-elevated-surface relative flex w-full max-w-[560px] max-h-[88vh] flex-col overflow-hidden rounded-3xl mobile-portrait-safe-card mobile-contrast-surface-dark"
      >
        <button
          onClick={onClose}
          className="theme-soft-surface absolute top-3 right-3 z-20 rounded-full p-2 text-slate-300 hover:text-white"
        >
          <X size={16} />
        </button>

        <div className="p-6 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-100">
              <UserRound size={22} />
            </div>
            <div className="min-w-0">
              <div className="text-lg font-black text-white truncate">{String(npcStatus.name || '未知角色')}</div>
              <div className="text-xs text-slate-400">
                {String(npcStatus.locationName || '未知地点')} · {String(npcStatus.skillFaction || '通用')}
              </div>
            </div>
          </div>

          <div className="mt-4">
            <div className="flex items-center justify-between text-[11px] mb-1">
              <span className="text-slate-300 font-bold">好感度状态栏</span>
              <span className="text-slate-100 font-black">{affinity} / 100 · {String(npcStatus.affinityStage || '中立')}</span>
            </div>
            <div className="h-3 rounded-full bg-slate-800 overflow-hidden border border-slate-700">
              <div className={`h-full bg-gradient-to-r ${barClass}`} style={{ width: `${affinity}%` }} />
            </div>
            <p className="mt-2 text-[11px] text-slate-400">{String(npcStatus.mood || '')}</p>
          </div>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto custom-scrollbar">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
              <div className="text-slate-500">身份</div>
              <div className="mt-1 text-slate-100 font-bold">{String(npcStatus.identity || '未知')}</div>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
              <div className="text-slate-500">性格</div>
              <div className="mt-1 text-slate-100 font-bold">{String(npcStatus.personality || '神秘')}</div>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 md:col-span-2">
              <div className="text-slate-500">外貌详情</div>
              <div className="mt-1 text-slate-100 font-bold">{String(npcStatus.appearance || '暂无描述')}</div>
            </div>
          </div>

          <div>
            <div className="text-xs font-black text-slate-300 mb-2">互动行为</div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              {actions.map((action) => {
                const meta = ACTION_META[action];
                if (!meta) return null;
                return (
                  <button
                    key={action}
                    onClick={() => handleAction(action)}
                    disabled={Boolean(pendingAction) || isLoading}
                    className={`px-2 py-2 rounded-xl border text-white text-xs font-black flex items-center justify-center gap-1 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${meta.className}`}
                  >
                    {meta.icon}
                    {pendingAction === action ? '处理中' : meta.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-3 min-h-[130px]">
            <div className="text-[11px] font-black text-slate-300 mb-2 flex items-center gap-1">
              <Sparkles size={12} /> 角色对话 / 情报回执
            </div>
            {isLoading ? (
              <div className="text-xs text-slate-500">正在读取角色状态...</div>
            ) : chatLines.length === 0 ? (
              <div className="text-xs text-slate-500">选择一个行为开始互动。</div>
            ) : (
              <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1 custom-scrollbar">
                {chatLines.map((line, idx) => (
                  <div key={`${line}-${idx}`} className="text-xs text-slate-200 leading-relaxed">
                    {line}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}

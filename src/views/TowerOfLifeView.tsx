import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, BookOpen, Shield, Sparkles, Trophy, X, MapPin } from 'lucide-react';
import { User } from '../types';
import FactionMemberPanel from './shared/FactionMemberPanel';

interface Props {
  user: User;
  onExit: () => void;
  showToast: (msg: string) => void;
  fetchGlobalData: () => void;
}

const LEADERBOARD_RULES = [
  { label: '命之塔最高位者', jobs: ['圣子', '圣女', '候选者'] },
  { label: '伦敦塔最高位者', jobs: ['伦敦塔教师'] },
  { label: '灵异管理所最高位者', jobs: ['灵异所所长'] },
  { label: '公会最高位者', jobs: ['公会会长'] },
  { label: '军队最高位者', jobs: ['军队将官'] },
  { label: '守塔会最高位者', jobs: ['守塔会会长'] },
  { label: '观察者最高位者', jobs: ['观察者首领'] },
  { label: '恶魔会最高位者', jobs: ['恶魔会会长'] },
  { label: '西市市长', jobs: ['西区市长'] },
  { label: '东市市长', jobs: ['东区市长'] }
];

const TOWER_ROLE_LIMITS = [
  '圣子/圣女：精神力 SS+（肉体不限）',
  '候选者：精神力 S+（肉体不限）',
  '侍奉者：精神力 B+（肉体不限）',
  '仆从：精神力 C+（肉体不限）'
];

const DELEGATION_STATUS_TEXT: Record<string, string> = {
  none: '未授权守塔会',
  pending: '守塔会申请待审批',
  approved: '已授权守塔会接管三塔管理',
  rejected: '守塔会申请已驳回',
  revoked: '守塔会授权已收回'
};

const NEWCOMER_OPENING_NOTICE = {
  title: '命之塔开服公告',
  intro: '欢迎你来到命之塔，见习者。这里不是比谁起步更快，而是比谁愿意多走一步。',
  lines: [
    '如果你刚进世界，不用急着变强，先去熟悉地图与阵营规则，找到自己的节奏。',
    '在这里你会遇到并肩作战的人，也会遇到意见相左的人。请记得尊重、克制、守规矩。',
    '遇到不会的内容可以先问，再做决定。老玩家和管理员会尽量帮你把路走顺。',
    '剧情、对戏、探索和成长都很重要，慢一点没关系，玩得开心最重要。'
  ],
  outro: '愿你在命之塔留下属于自己的名字，也留下值得回想的故事。'
};

const TOWER_POINTS = [
  { id: 'administration', name: '圣谕行政厅', x: 50, y: 30, icon: <Shield size={26} />, desc: '阵营规则、职位房间与三塔授权审批。' },
  { id: 'skill_library', name: '精神系技能库', x: 24, y: 62, icon: <BookOpen size={26} />, desc: '学习精神系技能与能力成长。' },
  { id: 'training_ground', name: '精神训练场', x: 76, y: 62, icon: <Sparkles size={26} />, desc: '进行精神力训练与新手指引。' },
  { id: 'leaderboard', name: '最高位议事台', x: 50, y: 80, icon: <Trophy size={26} />, desc: '查看各阵营当前最高位。' }
] as const;

type TowerPointId = (typeof TOWER_POINTS)[number]['id'];

export function TowerOfLifeView({ user, onExit, showToast, fetchGlobalData }: Props) {
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const [allPlayers, setAllPlayers] = useState<any[]>([]);
  const [mentalSkills, setMentalSkills] = useState<any[]>([]);
  const [delegationStatus, setDelegationStatus] = useState('none');
  const [delegationMeta, setDelegationMeta] = useState<any>(null);
  const [delegationBusy, setDelegationBusy] = useState(false);
  const [growthBusy, setGrowthBusy] = useState(false);
  const [selectedPoint, setSelectedPoint] = useState<TowerPointId | null>(null);
  const isTowerGovernor = ['圣子', '圣女'].includes(String(user.job || ''));
  const isUndifferentiatedStage = Number(user.age || 0) < 16 || String(user.role || '') === '未分化';

  useEffect(() => {
    const uid = String((user as any)?.id || '');
    if (!uid) return;
    const triggerKey = `tower_newcomer_welcome_trigger_${uid}`;
    const seenKey = `tower_newcomer_welcome_seen_${uid}`;
    const shouldShow = sessionStorage.getItem(triggerKey) === '1' && localStorage.getItem(seenKey) !== '1';
    if (!shouldShow) return;

    setShowWelcomeModal(true);
    sessionStorage.removeItem(triggerKey);
    localStorage.setItem(seenKey, '1');
  }, [user]);

  useEffect(() => {
    const pullPresence = async () => {
      try {
        const res = await fetch('/api/world/presence');
        const data = await res.json().catch(() => ({}));
        if (res.ok && data?.success) setAllPlayers(data.players || []);
      } catch {
        // ignore
      }
    };

    const pullSkills = async () => {
      try {
        const res = await fetch(`/api/skills/available/${user.id}`);
        const data = await res.json().catch(() => ({}));
        if (res.ok && data?.success) {
          const rows = Array.isArray(data.skills) ? data.skills.filter((x: any) => String(x.faction || '') === '精神系') : [];
          setMentalSkills(rows);
        }
      } catch {
        // ignore
      }
    };

    pullPresence();
    pullSkills();
  }, [user.id]);

  const pullDelegationStatus = async (silent = true) => {
    try {
      const res = await fetch(`/api/faction/delegation/status?userId=${user.id}`);
      const data = await res.json().catch(() => ({} as any));
      if (!res.ok || data.success === false) {
        if (!silent) showToast(data.message || '读取三塔授权状态失败');
        return;
      }
      const row = data.delegation || {};
      setDelegationStatus(String(row.status || 'none'));
      setDelegationMeta(row);
    } catch {
      if (!silent) showToast('网络异常，读取三塔授权状态失败');
    }
  };

  const reviewDelegation = async (action: 'approve' | 'reject' | 'revoke') => {
    if (!isTowerGovernor) return;
    setDelegationBusy(true);
    try {
      const res = await fetch('/api/faction/delegation/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewerId: user.id, action })
      });
      const data = await res.json().catch(() => ({} as any));
      if (!res.ok || data.success === false) {
        showToast(data.message || '审批失败');
        return;
      }
      showToast(data.message || '审批完成');
      pullDelegationStatus();
      fetchGlobalData();
    } catch {
      showToast('网络异常，审批失败');
    } finally {
      setDelegationBusy(false);
    }
  };

  useEffect(() => {
    pullDelegationStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id, user.job]);

  const leaderRows = useMemo(() => {
    return LEADERBOARD_RULES.map((x) => {
      const leader = allPlayers.find((p: any) => x.jobs.includes(String(p?.job || '')));
      return { label: x.label, leader: leader?.name || null };
    });
  }, [allPlayers]);

  const learnSkill = async (name: string) => {
    try {
      const res = await fetch(`/api/users/${user.id}/skills`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.success === false) {
        showToast(data?.message || 'Learn failed');
        return;
      }
      showToast(`Learned: ${name}`);
      fetchGlobalData();
    } catch {
      showToast('Learn failed');
    }
  };

  const handleExitTower = () => {
    setShowWelcomeModal(false);
    setSelectedPoint(null);
    onExit();
  };

  const handleTowerDifferentiation = async () => {
    if (growthBusy) return;
    if (!isUndifferentiatedStage) {
      showToast('当前角色已完成分化。');
      return;
    }

    const confirmStart = window.confirm('在命之塔进行属性分化？将进入 16-19 岁阶段并随机抽取身份。');
    if (!confirmStart) return;

    const enrollStudent = window.confirm(
      '分化后是否直接前往伦敦塔就读？\n确定：分化并前往伦敦塔\n取消：仅完成分化，留在当前区域'
    );

    setGrowthBusy(true);
    try {
      const res = await fetch('/api/growth/advance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          action: 'minor_to_student',
          enrollStudent
        })
      });
      const data = await res.json().catch(() => ({} as any));
      if (!res.ok || data.success === false) {
        showToast(data.message || '分化失败');
        return;
      }

      const next = data.user || {};
      const roleText = String(next.role || '');
      const ageText = Number(next.age || 0);
      const suffix = enrollStudent ? '，并已前往伦敦塔。' : '。';
      showToast(`分化完成：${roleText || '身份已更新'}（${ageText || 16}岁）${suffix}`);
      fetchGlobalData();
    } catch {
      showToast('网络异常，分化失败');
    } finally {
      setGrowthBusy(false);
    }
  };

  const selectedPointMeta = TOWER_POINTS.find((p) => p.id === selectedPoint) || null;

  return (
    <div className="absolute inset-0 overflow-hidden bg-slate-950 text-slate-100 font-sans select-none">
      <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: "url('/命之塔.jpg')" }}>
        <div className="absolute inset-0 bg-gradient-to-b from-slate-950/60 via-slate-950/70 to-slate-950/90 pointer-events-none" />
      </div>

      <div className="absolute top-4 left-4 md:top-6 md:left-6 z-[90]">
        <button
          onClick={handleExitTower}
          className="touch-manipulation inline-flex items-center gap-2 rounded-xl border border-amber-300/35 bg-slate-900/80 px-4 py-2 text-xs md:text-sm font-black text-amber-200 shadow-xl backdrop-blur hover:bg-slate-800/90 active:scale-95 transition-all"
        >
          <ArrowLeft size={18} />
          <span className="hidden sm:inline">离开命之塔</span>
          <span className="sm:hidden">退出</span>
        </button>
      </div>

      <div className="absolute top-4 right-4 md:top-6 md:right-6 z-[90]">
        <div className="rounded-xl border border-slate-600/70 bg-slate-900/70 px-3 py-1.5 text-[10px] md:text-xs text-slate-200 backdrop-blur">
          点击地图坐标点互动
        </div>
      </div>

      <div className="relative z-20 w-full h-full">
        {TOWER_POINTS.map((point) => (
          <button
            key={point.id}
            onClick={() => setSelectedPoint(point.id)}
            className="absolute -translate-x-1/2 -translate-y-1/2 group z-10 touch-manipulation"
            style={{ left: `${point.x}%`, top: `${point.y}%` }}
          >
            <div className="flex flex-col items-center gap-2">
              <div
                className={`w-12 h-12 md:w-16 md:h-16 rounded-2xl md:rounded-3xl border-2 flex items-center justify-center shadow-2xl transition-all ${
                  selectedPoint === point.id
                    ? 'bg-amber-500 text-slate-950 border-amber-200 scale-105'
                    : 'bg-slate-900/85 text-amber-200 border-amber-400/40 group-hover:bg-amber-500 group-hover:text-slate-950 group-hover:border-amber-200 group-hover:scale-110'
                }`}
              >
                {point.icon}
              </div>
              <span className="px-2.5 py-1 rounded-full text-[10px] md:text-xs font-black bg-slate-900/85 border border-slate-700 text-slate-100 whitespace-nowrap shadow-lg">
                {point.name}
              </span>
            </div>
          </button>
        ))}
      </div>

      <AnimatePresence>
        {selectedPointMeta && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] bg-black/55 backdrop-blur-[1px]"
              onClick={() => setSelectedPoint(null)}
            />

            <motion.section
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 330, damping: 32 }}
              className="fixed inset-x-0 bottom-0 z-[110] max-h-[86vh] rounded-t-3xl border border-slate-700 bg-slate-900/95 shadow-2xl flex flex-col md:inset-y-0 md:right-0 md:left-auto md:max-h-none md:w-[520px] md:rounded-none md:rounded-l-3xl md:border-l md:border-t-0 mobile-portrait-safe-sheet mobile-contrast-surface-dark"
            >
              <div className="border-b border-slate-700/80 p-4 md:p-5 shrink-0">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 text-amber-300 flex items-center justify-center shrink-0">
                      {selectedPointMeta.icon}
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-base md:text-lg font-black text-amber-200 truncate">{selectedPointMeta.name}</h3>
                      <p className="text-[11px] md:text-xs text-slate-400 mt-0.5">{selectedPointMeta.desc}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedPoint(null)}
                    className="rounded-lg border border-slate-700 bg-slate-800 p-2 text-slate-300 hover:text-white hover:border-slate-500 transition-colors"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>

              <div className="p-4 md:p-5 overflow-y-auto custom-scrollbar space-y-4 flex-1">
                {selectedPoint === 'administration' && (
                  <>
                    <div className="rounded-2xl border border-slate-700 bg-slate-800/70 p-4">
                      <h4 className="flex items-center gap-2 text-sm font-black text-amber-300">
                        <MapPin size={14} />
                        命之塔定位与职位限制
                      </h4>
                      <p className="mt-2 text-xs text-slate-300 leading-6">
                        命之塔是新生玩家出生地，可在此查看公告、学习精神系技能并参与精神力训练。
                      </p>
                      <div className="mt-3 space-y-1.5">
                        {TOWER_ROLE_LIMITS.map((t) => (
                          <div key={t} className="text-[11px] text-slate-400">
                            {t}
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-slate-700 bg-slate-800/70 p-4">
                      <div className="flex items-center gap-2 text-xs font-black text-sky-300">
                        <Shield size={14} />
                        三塔人事管辖状态
                      </div>
                      <p className="mt-2 text-xs text-slate-200">
                        {DELEGATION_STATUS_TEXT[delegationStatus] || delegationStatus}
                      </p>
                      {delegationMeta?.requestedByName && (
                        <p className="mt-1 text-[11px] text-slate-400">申请人：{delegationMeta.requestedByName}</p>
                      )}
                      {delegationMeta?.reviewedByName && (
                        <p className="mt-1 text-[11px] text-slate-400">审批人：{delegationMeta.reviewedByName}</p>
                      )}
                      {isTowerGovernor && delegationStatus === 'pending' && (
                        <div className="mt-3 grid grid-cols-2 gap-2">
                          <button
                            onClick={() => reviewDelegation('approve')}
                            disabled={delegationBusy}
                            className="rounded-lg bg-emerald-700 px-2 py-2 text-[11px] font-black text-white hover:bg-emerald-600 disabled:opacity-60"
                          >
                            同意接管
                          </button>
                          <button
                            onClick={() => reviewDelegation('reject')}
                            disabled={delegationBusy}
                            className="rounded-lg bg-rose-700 px-2 py-2 text-[11px] font-black text-white hover:bg-rose-600 disabled:opacity-60"
                          >
                            驳回申请
                          </button>
                        </div>
                      )}
                      {isTowerGovernor && delegationStatus === 'approved' && (
                        <button
                          onClick={() => reviewDelegation('revoke')}
                          disabled={delegationBusy}
                          className="mt-3 w-full rounded-lg bg-amber-700 px-2 py-2 text-[11px] font-black text-white hover:bg-amber-600 disabled:opacity-60"
                        >
                          收回守塔会授权
                        </button>
                      )}
                    </div>

                    <FactionMemberPanel
                      user={user}
                      locationId="tower_of_life"
                      showToast={showToast}
                      fetchGlobalData={fetchGlobalData}
                      title="命之塔职位房间"
                    />
                  </>
                )}

                {selectedPoint === 'skill_library' && (
                  <div className="space-y-2">
                    {mentalSkills.slice(0, 10).map((s: any) => (
                      <div key={String(s.id)} className="rounded-xl border border-slate-700 bg-slate-800/70 p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="text-sm font-bold text-slate-100 truncate">{s.name}</div>
                            <div className="text-xs text-slate-400 mt-1 leading-5">{s.description || 'No description'}</div>
                          </div>
                          <button
                            onClick={() => learnSkill(String(s.name || ''))}
                            className="rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-sky-500 shrink-0"
                          >
                            学习
                          </button>
                        </div>
                      </div>
                    ))}
                    {mentalSkills.length === 0 && (
                      <p className="rounded-xl border border-slate-700 bg-slate-800/70 p-4 text-sm text-slate-400">
                        暂无可学习的精神系技能。
                      </p>
                    )}
                  </div>
                )}

                {selectedPoint === 'training_ground' && (
                  <div className="space-y-4">
                    {isUndifferentiatedStage && (
                      <div className="rounded-2xl border border-fuchsia-500/30 bg-fuchsia-500/10 p-4">
                        <h4 className="text-sm font-black text-fuchsia-200">未分化属性分化</h4>
                        <p className="mt-2 text-xs leading-6 text-fuchsia-100/90">
                          在命之塔进行属性分化，可随机抽取身份并进入 16-19 岁阶段。
                        </p>
                        <button
                          onClick={handleTowerDifferentiation}
                          disabled={growthBusy}
                          className="mt-3 w-full rounded-xl bg-fuchsia-600 px-3 py-2 text-xs font-black text-white hover:bg-fuchsia-500 disabled:opacity-60"
                        >
                          {growthBusy ? '分化处理中...' : '开始抽属性分化'}
                        </button>
                      </div>
                    )}

                    <div className="rounded-2xl border border-indigo-500/30 bg-indigo-500/10 p-4">
                      <h4 className="text-sm font-black text-indigo-200">精神力训练指引</h4>
                      <p className="mt-2 text-xs leading-6 text-indigo-100/90">
                        训练前建议先在“精神系技能库”学习至少 1 个技能，再进行训练模拟，收益更稳定。
                      </p>
                      <button
                        onClick={() => showToast('精神力训练功能已接入：请先学习精神系技能，再进行训练。')}
                        className="mt-3 w-full rounded-xl bg-indigo-600 px-3 py-2 text-xs font-black text-white hover:bg-indigo-500"
                      >
                        开始精神力训练
                      </button>
                    </div>

                    <div className="rounded-2xl border border-amber-500/25 bg-amber-500/5 p-4">
                      <h4 className="text-sm font-black text-amber-200">新手开服建议</h4>
                      <ul className="mt-2 space-y-2 text-xs leading-6 text-amber-100/90">
                        {NEWCOMER_OPENING_NOTICE.lines.slice(0, 3).map((line) => (
                          <li key={line} className="flex items-start gap-2">
                            <span className="mt-1 text-amber-300">•</span>
                            <span>{line}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}

                {selectedPoint === 'leaderboard' && (
                  <div className="space-y-2">
                    {leaderRows.map((r) => (
                      <div key={r.label} className="flex items-center justify-between gap-3 rounded-xl border border-slate-700 bg-slate-800/70 px-3 py-2.5">
                        <span className="text-xs text-amber-300">{r.label}</span>
                        <span className="text-sm font-black text-white truncate">{r.leader || 'vacant'}</span>
                      </div>
                    ))}
                    <div className="rounded-xl border border-slate-700 bg-slate-800/70 p-3 text-[11px] text-slate-400">
                      排行依据当前在线身份实时刷新，仅作世界秩序展示。
                    </div>
                  </div>
                )}
              </div>
            </motion.section>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showWelcomeModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[300] flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm mobile-portrait-safe-overlay"
          >
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              className="w-full max-w-xl rounded-3xl border border-amber-700/40 bg-slate-900 p-5 md:p-6 text-amber-50 shadow-2xl mobile-portrait-safe-card mobile-contrast-surface-dark"
            >
              <h3 className="mb-3 text-xl md:text-2xl font-black text-amber-300">{NEWCOMER_OPENING_NOTICE.title}</h3>
              <p className="text-sm leading-7 text-amber-100/90">{NEWCOMER_OPENING_NOTICE.intro}</p>
              <div className="mt-3 rounded-2xl border border-amber-700/30 bg-amber-500/5 p-3">
                <ul className="space-y-2 text-sm leading-7 text-amber-100/90">
                  {NEWCOMER_OPENING_NOTICE.lines.map((line) => (
                    <li key={line} className="flex items-start gap-2">
                      <span className="mt-1 text-amber-300">•</span>
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <p className="mt-3 text-sm leading-7 text-amber-100/90">{NEWCOMER_OPENING_NOTICE.outro}</p>
              <div className="mt-5 flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowWelcomeModal(false)}
                  className="rounded-xl bg-amber-500 px-4 py-2 font-bold text-slate-900 hover:bg-amber-400"
                >
                  我知道啦，开始冒险
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background-color: rgba(148, 163, 184, 0.7); border-radius: 20px; }
      `}</style>
    </div>
  );
}

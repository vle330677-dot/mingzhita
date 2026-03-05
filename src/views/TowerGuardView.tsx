import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, Cross, Lock, Shield, Sparkles, X } from 'lucide-react';
import { User } from '../types';
import FactionMemberPanel from './shared/FactionMemberPanel';
import PrisonEscapeMiniGame from './PrisonEscapeMiniGame';

interface Props {
  user: User;
  onExit: () => void;
  showToast: (msg: string) => void;
  fetchGlobalData: () => void;
}

const buildings = [
  { id: 'office', name: '守塔会事务厅', x: 48, y: 34, icon: <Shield />, desc: '守塔会入职、晋升与成员管理。' },
  { id: 'chapel', name: '教堂', x: 25, y: 62, icon: <Cross />, desc: '外来者可进行冥想，恢复精神 30%。' },
  { id: 'atonement', name: '赎罪室', x: 72, y: 62, icon: <Sparkles />, desc: '哨兵可降低狂暴值，其他人恢复精神。' },
  { id: 'underground_prison', name: '地下监牢', x: 50, y: 78, icon: <Lock />, desc: '被抓捕者关押区，可探监对戏与越狱。' }
];

const ROLES = {
  CHIEF: '守塔会会长',
  MEMBER: '守塔会成员'
};

const RANK_SCORES: Record<string, number> = {
  无: 0, F: 1, E: 2, D: 3, 'D+': 3.5, C: 4, 'C+': 5, B: 6, 'B+': 7,
  A: 8, 'A+': 9, S: 10, 'S+': 11, SS: 12, 'SS+': 13, SSS: 14
};

const DELEGATION_STATUS_TEXT: Record<string, string> = {
  none: '未申请',
  pending: '待审批',
  approved: '已获授权',
  rejected: '申请被驳回',
  revoked: '授权已收回'
};

function scoreOf(rank?: string) {
  return RANK_SCORES[String(rank || '无')] || 0;
}

function buildPrisonVisitSessionId(a: number, b: number) {
  const min = Math.min(a, b);
  const max = Math.max(a, b);
  return `rp-tower-guard-prison-${min}-${max}-${Date.now()}`;
}

interface GuardArrestCaseRow {
  id: number;
  applicantUserId: number;
  applicantName: string;
  targetUserId: number;
  targetName: string;
  reason: string;
  status: string;
  cancelStatus: string;
  cancelReason?: string;
  resultMessage?: string;
  updatedAt?: string;
}

interface GuardPrisonState {
  isImprisoned: boolean;
  arrestCaseId: number;
  captorUserId: number;
  captorName: string;
  jailedAt: string;
  releasedAt: string;
  failedAttempts: number;
  difficultyLevel: number;
  currentGameId: string;
  currentGameName: string;
  updatedAt: string;
}

export function TowerGuardView({ user, onExit, showToast, fetchGlobalData }: Props) {
  const [selectedBuilding, setSelectedBuilding] = useState<any>(null);
  const [delegationStatus, setDelegationStatus] = useState('none');
  const [delegationMeta, setDelegationMeta] = useState<any>(null);
  const [delegationBusy, setDelegationBusy] = useState(false);
  const [captureQueue, setCaptureQueue] = useState<GuardArrestCaseRow[]>([]);
  const [cancelQueue, setCancelQueue] = useState<GuardArrestCaseRow[]>([]);
  const [prisoners, setPrisoners] = useState<any[]>([]);
  const [reviewBusyId, setReviewBusyId] = useState<number>(0);
  const [guardPrisonState, setGuardPrisonState] = useState<GuardPrisonState | null>(null);
  const [showEscapeMiniGame, setShowEscapeMiniGame] = useState(false);
  const [isResolvingEscape, setIsResolvingEscape] = useState(false);
  const isGuard = Object.values(ROLES).includes(String(user.job || ''));
  const isChief = String(user.job || '') === ROLES.CHIEF;
  const isTowerSaint = ['圣子', '圣女'].includes(String(user.job || ''));
  const canReviewCapture = isChief || isTowerSaint;
  const canReviewCancel = isTowerSaint;
  const isPrisonLocked = Boolean(guardPrisonState?.isImprisoned);

  const checkQualifications = (targetJob: string) => {
    if ((user.age || 0) < 16) return false;
    const m = scoreOf(user.mentalRank);
    const p = scoreOf(user.physicalRank);
    if (targetJob === ROLES.MEMBER) return m >= RANK_SCORES['C+'] && p >= RANK_SCORES['C+'];
    if (targetJob === ROLES.CHIEF) return m >= RANK_SCORES['S+'] && p >= RANK_SCORES['S+'];
    return false;
  };

  const guardPrisonLock = () => {
    if (!isPrisonLocked) return false;
    showToast('你被关押在守塔会地下监牢中，当前仅可探监对戏或发起越狱。');
    return true;
  };

  const pullGuardPrisonState = async () => {
    try {
      const res = await fetch(`/api/tower-guard/prison/state?userId=${user.id}`, { cache: 'no-store' });
      const data = await res.json().catch(() => ({} as any));
      if (!res.ok || data.success === false) return;
      setGuardPrisonState(data.prison || null);
    } catch {
      // ignore
    }
  };

  const pullArrestInbox = async (silent = true) => {
    try {
      const res = await fetch(`/api/tower-guard/arrest/inbox?userId=${user.id}`, { cache: 'no-store' });
      const data = await res.json().catch(() => ({} as any));
      if (!res.ok || data.success === false) {
        if (!silent) showToast(data.message || '读取抓捕审批列表失败');
        return;
      }
      setCaptureQueue(Array.isArray(data.captureReviewQueue) ? data.captureReviewQueue : []);
      setCancelQueue(Array.isArray(data.cancelReviewQueue) ? data.cancelReviewQueue : []);
    } catch {
      if (!silent) showToast('网络异常，读取抓捕审批列表失败');
    }
  };

  const pullPrisoners = async (silent = true) => {
    try {
      const res = await fetch('/api/tower-guard/prisoners', { cache: 'no-store' });
      const data = await res.json().catch(() => ({} as any));
      if (!res.ok || data.success === false) {
        if (!silent) showToast(data.message || '读取地下监牢名单失败');
        return;
      }
      setPrisoners(Array.isArray(data.prisoners) ? data.prisoners : []);
    } catch {
      if (!silent) showToast('网络异常，读取地下监牢名单失败');
    }
  };

  const reviewCapture = async (caseId: number, action: 'approve' | 'reject') => {
    setReviewBusyId(caseId);
    try {
      const res = await fetch('/api/tower-guard/arrest/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, caseId, action })
      });
      const data = await res.json().catch(() => ({} as any));
      if (!res.ok || data.success === false) {
        showToast(data.message || '审批失败');
        return;
      }
      showToast(data.message || '审批完成');
      pullArrestInbox();
      pullPrisoners();
      fetchGlobalData();
    } catch {
      showToast('网络异常，审批失败');
    } finally {
      setReviewBusyId(0);
    }
  };

  const reviewCancel = async (caseId: number, action: 'approve' | 'reject') => {
    setReviewBusyId(caseId);
    try {
      const res = await fetch('/api/tower-guard/arrest/cancel-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, caseId, action })
      });
      const data = await res.json().catch(() => ({} as any));
      if (!res.ok || data.success === false) {
        showToast(data.message || '审批失败');
        return;
      }
      showToast(data.message || '审批完成');
      pullArrestInbox();
      fetchGlobalData();
    } catch {
      showToast('网络异常，审批失败');
    } finally {
      setReviewBusyId(0);
    }
  };

  const releasePrisoner = async (targetUserId: number) => {
    if (!targetUserId) return;
    if (!window.confirm('确认释放该地下监牢成员？')) return;
    setReviewBusyId(targetUserId);
    try {
      const res = await fetch('/api/tower-guard/prison/release', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, targetUserId })
      });
      const data = await res.json().catch(() => ({} as any));
      if (!res.ok || data.success === false) {
        showToast(data.message || '释放失败');
        return;
      }
      showToast(data.message || '已释放');
      pullPrisoners();
      fetchGlobalData();
    } catch {
      showToast('网络异常，释放失败');
    } finally {
      setReviewBusyId(0);
    }
  };

  const startPrisonVisitRoleplay = async (targetUserId: number, targetName: string) => {
    const selfId = Number(user.id || 0);
    const tid = Number(targetUserId || 0);
    if (!selfId || !tid || selfId === tid) return;
    try {
      const sessionId = buildPrisonVisitSessionId(selfId, tid);
      const res = await fetch('/api/rp/session/upsert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          userAId: selfId,
          userAName: String(user.name || `玩家#${selfId}`),
          userBId: tid,
          userBName: String(targetName || `玩家#${tid}`),
          locationId: 'tower_guard',
          locationName: '守塔会地下监牢'
        })
      });
      const data = await res.json().catch(() => ({} as any));
      if (!res.ok || data.success === false) {
        showToast(data.message || '发起探监对戏失败');
        return;
      }
      showToast(`已向 ${String(targetName || `玩家#${tid}`)} 发起探监对戏，请点击左下角「对戏聊天」。`);
      fetchGlobalData();
    } catch {
      showToast('网络异常，发起探监对戏失败');
    }
  };

  const handleResolveEscape = async (success: boolean) => {
    if (!isPrisonLocked) return;
    setIsResolvingEscape(true);
    try {
      const res = await fetch('/api/tower-guard/prison/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, success })
      });
      const data = await res.json().catch(() => ({} as any));
      if (!res.ok || data.success === false) {
        showToast(data.message || '越狱结算失败');
        return;
      }
      if (data.prison) setGuardPrisonState(data.prison);
      showToast(data.message || (success ? '越狱成功' : '越狱失败'));
      setShowEscapeMiniGame(false);
      if (data.escaped) fetchGlobalData();
    } catch {
      showToast('越狱结算失败');
    } finally {
      setIsResolvingEscape(false);
    }
  };

  const handleJoinOrPromote = async (jobName: string) => {
    if (guardPrisonLock()) return;
    if (!checkQualifications(jobName)) {
      return showToast(`资质不符：${jobName} 需要更高神体等级且年龄大于 16 岁`);
    }
    try {
      const res = await fetch('/api/tower/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, jobName })
      });
      const data = await res.json().catch(() => ({} as any));
      if (!res.ok || data.success === false) return showToast(data.message || '操作失败');
      showToast(`已就任：${jobName}`);
      fetchGlobalData();
    } catch {
      showToast('网络异常，操作失败');
    }
  };

  const handleRitual = async (type: 'meditate' | 'atonement') => {
    if (guardPrisonLock()) return;
    try {
      const res = await fetch('/api/tower/guard/ritual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, type })
      });
      const data = await res.json().catch(() => ({} as any));
      if (!res.ok || data.success === false) return showToast(data.message || '仪式失败');
      showToast(data.message || '仪式完成');
      fetchGlobalData();
    } catch {
      showToast('网络异常，仪式失败');
    }
  };

  const handleQuit = async () => {
    if (guardPrisonLock()) return;
    if (!window.confirm('确认离开守塔会吗？')) return;
    try {
      const res = await fetch('/api/tower/quit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id })
      });
      const data = await res.json().catch(() => ({} as any));
      if (!res.ok || data.success === false) return showToast(data.message || '离职失败');
      showToast(data.message || '已离开守塔会');
      fetchGlobalData();
      setSelectedBuilding(null);
    } catch {
      showToast('网络异常，离职失败');
    }
  };

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

  const handleDelegationRequest = async () => {
    if (!isChief) return;
    setDelegationBusy(true);
    try {
      const res = await fetch('/api/faction/delegation/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id })
      });
      const data = await res.json().catch(() => ({} as any));
      if (!res.ok || data.success === false) {
        showToast(data.message || '提交申请失败');
        return;
      }
      showToast(data.message || '申请已提交');
      pullDelegationStatus();
    } catch {
      showToast('网络异常，提交申请失败');
    } finally {
      setDelegationBusy(false);
    }
  };

  useEffect(() => {
    if (selectedBuilding?.id === 'office') {
      pullDelegationStatus();
      if (canReviewCapture || canReviewCancel) pullArrestInbox();
    }
    if (selectedBuilding?.id === 'underground_prison') {
      pullPrisoners();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBuilding?.id, user.id, canReviewCapture, canReviewCancel]);

  useEffect(() => {
    let alive = true;
    const pull = async () => {
      if (!alive) return;
      await pullGuardPrisonState();
    };
    pull();
    const timer = setInterval(pull, 2500);
    return () => {
      alive = false;
      clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id]);

  useEffect(() => {
    if (!isPrisonLocked) return;
    const prisonBuilding = buildings.find((x) => x.id === 'underground_prison') || null;
    setSelectedBuilding(prisonBuilding);
  }, [isPrisonLocked]);

  return (
    <div className="absolute inset-0 bg-slate-950 overflow-hidden font-sans select-none text-slate-100">
      <div className="absolute inset-0 z-0">
        <img src="/守塔会.jpg" className="w-full h-full object-cover opacity-45" alt="Tower Guard" />
        <div className="absolute inset-0 bg-gradient-to-b from-slate-900/50 via-slate-950/70 to-slate-950 pointer-events-none" />
      </div>

      <div className="absolute top-6 left-6 z-50">
        <button
          onClick={() => {
            if (isPrisonLocked) {
              showToast('地下监牢状态下无法离开守塔会。');
              return;
            }
            onExit();
          }}
          className={`bg-slate-900/80 backdrop-blur-md border px-5 py-2.5 rounded-xl font-black shadow-lg flex items-center gap-2 transition-all ${
            isPrisonLocked
              ? 'text-slate-500 border-slate-700 cursor-not-allowed'
              : 'text-slate-100 border-slate-500/40 hover:bg-slate-800'
          }`}
        >
          <ArrowLeft size={18} /> 离开守塔会
        </button>
      </div>

      <div className="relative z-10 w-full h-full">
        {buildings.map((b) => (
          <div
            key={b.id}
            className={`absolute transform -translate-x-1/2 -translate-y-1/2 group ${
              isPrisonLocked ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
            }`}
            style={{ left: `${b.x}%`, top: `${b.y}%` }}
            onClick={() => {
              if (isPrisonLocked) {
                const prisonBuilding = buildings.find((x) => x.id === 'underground_prison') || null;
                setSelectedBuilding(prisonBuilding);
                return;
              }
              setSelectedBuilding(b);
            }}
          >
            <div className="flex flex-col items-center gap-2">
              <div className="w-14 h-14 md:w-16 md:h-16 rounded-2xl bg-slate-900/90 border border-slate-400/30 flex items-center justify-center text-slate-200 shadow-xl group-hover:scale-110 group-hover:border-sky-400 transition-all">
                {b.icon}
              </div>
              <div className="px-3 py-1 rounded-lg bg-black/70 text-[10px] font-bold text-slate-100 border border-slate-600/30 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                {b.name}
              </div>
            </div>
          </div>
        ))}
      </div>

      <AnimatePresence>
        {selectedBuilding && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
              onClick={() => setSelectedBuilding(null)}
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              className="fixed inset-y-0 right-0 z-50 w-full md:w-[480px] bg-slate-900 border-l border-slate-700/70 flex flex-col"
            >
              <div className="p-6 border-b border-slate-700 flex items-start justify-between">
                <div>
                  <h2 className="text-2xl font-black text-slate-100">{selectedBuilding.name}</h2>
                  <p className="text-xs text-slate-400 mt-1">{selectedBuilding.desc}</p>
                </div>
                <button onClick={() => setSelectedBuilding(null)} className="p-2 rounded-full bg-slate-800 text-slate-300 hover:bg-slate-700">
                  <X size={18} />
                </button>
              </div>

              <div className="flex-1 p-6 overflow-y-auto custom-scrollbar space-y-6">
                {selectedBuilding.id === 'office' && (
                  <div className="space-y-4">
                    {!isGuard ? (
                      <>
                        <div className="p-4 rounded-xl bg-slate-800/80 border border-slate-700 text-xs text-slate-300">
                          守塔会负责教堂秩序维护与精神安定。加入后可管理守塔区域成员。
                        </div>
                        <JobBtn
                          title="守塔会成员"
                          sub="精神 C+ / 肉体 C+ / 年龄 > 16"
                          qualified={checkQualifications(ROLES.MEMBER)}
                          onClick={() => handleJoinOrPromote(ROLES.MEMBER)}
                        />
                        <JobBtn
                          title="守塔会会长"
                          sub="精神 S+ / 肉体 S+ / 年龄 > 16"
                          qualified={checkQualifications(ROLES.CHIEF)}
                          onClick={() => handleJoinOrPromote(ROLES.CHIEF)}
                        />
                      </>
                    ) : (
                      <div className="space-y-4">
                        <div className="p-5 rounded-xl bg-slate-800 border border-slate-700 text-center">
                          <p className="text-[10px] text-slate-500 uppercase tracking-widest">当前职位</p>
                          <p className="text-2xl font-black text-slate-100 mt-1">{user.job}</p>
                          {user.job !== ROLES.CHIEF && (
                            <button
                              onClick={() => handleJoinOrPromote(ROLES.CHIEF)}
                              className="mt-4 w-full py-2.5 rounded-lg bg-slate-700 text-sky-300 text-xs font-black hover:bg-slate-600"
                            >
                              申请晋升：守塔会会长
                            </button>
                          )}
                          <button
                            onClick={handleQuit}
                            className="mt-2 w-full py-2.5 rounded-lg bg-rose-900/40 text-rose-300 text-xs font-black hover:bg-rose-800/60"
                          >
                            申请离职
                          </button>
                        </div>
                        {isChief && (
                          <div className="p-4 rounded-xl bg-slate-800 border border-slate-700 space-y-2">
                            <p className="text-[10px] uppercase tracking-wider text-slate-400">三塔管理授权</p>
                            <p className="text-sm font-black text-sky-300">
                              {DELEGATION_STATUS_TEXT[delegationStatus] || delegationStatus}
                            </p>
                            {delegationMeta?.reviewedByName && (
                              <p className="text-[11px] text-slate-400">最近审批：{delegationMeta.reviewedByName}</p>
                            )}
                            {delegationStatus === 'pending' && (
                              <p className="text-[11px] text-amber-300">命之塔圣子/圣女审批中，请等待。</p>
                            )}
                            {delegationStatus === 'approved' && (
                              <p className="text-[11px] text-emerald-300">你当前可管理命之塔、伦敦塔、圣所的人事调动。</p>
                            )}
                            {delegationStatus !== 'approved' && delegationStatus !== 'pending' && (
                              <button
                                onClick={handleDelegationRequest}
                                disabled={delegationBusy}
                                className="w-full py-2 rounded-lg bg-indigo-600 text-white text-xs font-black hover:bg-indigo-500 disabled:opacity-60"
                              >
                                {delegationBusy ? '提交中...' : '申请接管三塔管理'}
                              </button>
                            )}
                          </div>
                        )}
                        {canReviewCapture && (
                          <div className="p-4 rounded-xl bg-slate-800 border border-slate-700 space-y-3">
                            <p className="text-[10px] uppercase tracking-wider text-slate-400">抓捕申请审批台</p>
                            {captureQueue.length === 0 && (
                              <p className="text-[11px] text-slate-500">暂无待审批抓捕申请</p>
                            )}
                            {captureQueue.map((row) => (
                              <div key={`capture-${row.id}`} className="rounded-lg border border-slate-700 bg-slate-900/70 p-3">
                                <div className="text-xs text-slate-200">
                                  <span className="font-black text-sky-300">{row.applicantName}</span>
                                  {' 申请抓捕 '}
                                  <span className="font-black text-amber-300">{row.targetName}</span>
                                </div>
                                <p className="text-[11px] text-slate-400 mt-1">理由：{row.reason || '无'}</p>
                                <div className="text-[10px] text-slate-500 mt-1">
                                  撤销状态：{
                                    row.cancelStatus === 'pending'
                                      ? '目标已提交撤销申请（待命之塔审批）'
                                      : row.cancelStatus === 'approved'
                                        ? '撤销申请已批准'
                                        : row.cancelStatus === 'rejected'
                                          ? '撤销申请已驳回'
                                          : (row.cancelStatus || '无')
                                  }
                                </div>
                                <div className="grid grid-cols-2 gap-2 mt-2">
                                  <button
                                    onClick={() => reviewCapture(row.id, 'approve')}
                                    disabled={reviewBusyId === row.id}
                                    className="py-2 rounded bg-emerald-700 text-white text-[11px] font-black hover:bg-emerald-600 disabled:opacity-60"
                                  >
                                    通过并执行抓捕
                                  </button>
                                  <button
                                    onClick={() => reviewCapture(row.id, 'reject')}
                                    disabled={reviewBusyId === row.id}
                                    className="py-2 rounded bg-rose-700 text-white text-[11px] font-black hover:bg-rose-600 disabled:opacity-60"
                                  >
                                    驳回
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                        {canReviewCancel && (
                          <div className="p-4 rounded-xl bg-slate-800 border border-slate-700 space-y-3">
                            <p className="text-[10px] uppercase tracking-wider text-slate-400">命之塔撤销申请审批</p>
                            {cancelQueue.length === 0 && (
                              <p className="text-[11px] text-slate-500">暂无待审批撤销申请</p>
                            )}
                            {cancelQueue.map((row) => (
                              <div key={`cancel-${row.id}`} className="rounded-lg border border-slate-700 bg-slate-900/70 p-3">
                                <div className="text-xs text-slate-200">
                                  <span className="font-black text-amber-300">{row.targetName}</span>
                                  {' 提交了撤销抓捕申请'}
                                </div>
                                <p className="text-[11px] text-slate-400 mt-1">撤销理由：{row.cancelReason || '无'}</p>
                                <div className="grid grid-cols-2 gap-2 mt-2">
                                  <button
                                    onClick={() => reviewCancel(row.id, 'approve')}
                                    disabled={reviewBusyId === row.id}
                                    className="py-2 rounded bg-amber-700 text-white text-[11px] font-black hover:bg-amber-600 disabled:opacity-60"
                                  >
                                    同意撤销
                                  </button>
                                  <button
                                    onClick={() => reviewCancel(row.id, 'reject')}
                                    disabled={reviewBusyId === row.id}
                                    className="py-2 rounded bg-slate-700 text-white text-[11px] font-black hover:bg-slate-600 disabled:opacity-60"
                                  >
                                    驳回撤销
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                        <FactionMemberPanel
                          user={user}
                          locationId="tower_guard"
                          showToast={showToast}
                          fetchGlobalData={fetchGlobalData}
                          title="守塔会职位房间"
                        />
                      </div>
                    )}
                  </div>
                )}

                {selectedBuilding.id === 'chapel' && (
                  <div className="space-y-4">
                    <div className="p-4 rounded-xl bg-slate-800 border border-slate-700 text-sm text-slate-200">
                      外来者可在教堂进行冥想，精神恢复 30%。
                    </div>
                    <button
                      onClick={() => handleRitual('meditate')}
                      className="w-full py-3 rounded-xl bg-sky-700 text-white font-black hover:bg-sky-600 transition-colors"
                    >
                      开始冥想
                    </button>
                  </div>
                )}

                {selectedBuilding.id === 'atonement' && (
                  <div className="space-y-4">
                    <div className="p-4 rounded-xl bg-slate-800 border border-slate-700 text-sm text-slate-200">
                      赎罪：哨兵狂暴值 -10%；其他角色精神恢复 30%。
                    </div>
                    <button
                      onClick={() => handleRitual('atonement')}
                      className="w-full py-3 rounded-xl bg-emerald-700 text-white font-black hover:bg-emerald-600 transition-colors"
                    >
                      执行赎罪
                    </button>
                  </div>
                )}

                {selectedBuilding.id === 'underground_prison' && (
                  <div className="space-y-4">
                    <div className="p-4 rounded-xl bg-slate-800 border border-slate-700 text-sm text-slate-200">
                      地下监牢用于关押守塔会抓捕目标。被关押者可进行探监对戏，也可发起越狱挑战。
                    </div>
                    {!isPrisonLocked && (
                      <button
                        onClick={() => {
                          if (guardPrisonLock()) return;
                          showToast('你巡视了地下监牢并加固了锁链。');
                        }}
                        className="w-full py-3 rounded-xl bg-indigo-700 text-white font-black hover:bg-indigo-600 transition-colors"
                      >
                        巡视地下监牢
                      </button>
                    )}
                    {isPrisonLocked && (
                      <div className="p-4 bg-rose-950/35 border border-rose-900 rounded-xl text-left space-y-3">
                        <p className="text-xs text-rose-300 font-bold">
                          你已被关押在守塔会地下监牢，无法移动与执行其他互动操作。
                        </p>
                        <div className="text-[11px] text-slate-300 leading-6">
                          <div>当前越狱题：{guardPrisonState?.currentGameName || guardPrisonState?.currentGameId || '未分配'}</div>
                          <div>失败次数：{guardPrisonState?.failedAttempts || 0}</div>
                          <div>当前难度：等级 {Math.max(1, Number(guardPrisonState?.difficultyLevel || 1))}</div>
                        </div>
                        <button
                          onClick={() => {
                            if (!guardPrisonState?.currentGameId) {
                              showToast('当前越狱题尚未就绪，请稍后重试。');
                              return;
                            }
                            setShowEscapeMiniGame(true);
                          }}
                          disabled={isResolvingEscape}
                          className="w-full py-3 bg-rose-700 text-white font-black rounded-lg hover:bg-rose-600 transition-colors disabled:opacity-60"
                        >
                          越狱挑战
                        </button>
                      </div>
                    )}

                    <div className="pt-2 border-t border-slate-700">
                      <h4 className="text-sm font-black text-slate-200 mb-3">当前关押名单</h4>
                      <p className="text-[11px] text-slate-500 mb-2">
                        可通过“探监对戏”直接建立 RP 会话；在押玩家无法移动，但可正常对戏。
                      </p>
                      {prisoners.length === 0 ? (
                        <p className="text-[11px] text-slate-500">当前地下监牢为空</p>
                      ) : (
                        <div className="space-y-2">
                          {prisoners.map((p) => (
                            <div key={`prisoner-${p.userId}`} className="rounded-lg border border-slate-700 bg-slate-800/70 p-3">
                              <div className="text-sm font-black text-amber-300">{p.targetName || `玩家#${p.userId}`}</div>
                              <div className="text-[11px] text-slate-400 mt-1">押送人：{p.captorName || '未知'}</div>
                              <div className="text-[11px] text-slate-500">关押时间：{p.jailedAt ? new Date(p.jailedAt).toLocaleString() : '未知'}</div>
                              <div className="grid grid-cols-1 gap-2 mt-2">
                                {Number(p.userId || 0) !== Number(user.id || 0) && (
                                  <button
                                    onClick={() => startPrisonVisitRoleplay(Number(p.userId || 0), String(p.targetName || ''))}
                                    className="w-full py-2 rounded bg-sky-700 text-white text-[11px] font-black hover:bg-sky-600"
                                  >
                                    探监对戏
                                  </button>
                                )}
                                {(canReviewCapture || canReviewCancel) && (
                                  <button
                                    onClick={() => releasePrisoner(Number(p.userId || 0))}
                                    disabled={reviewBusyId === Number(p.userId || 0)}
                                    className="w-full py-2 rounded bg-slate-700 text-slate-100 text-[11px] font-black hover:bg-slate-600 disabled:opacity-60"
                                  >
                                    释放该成员
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {isPrisonLocked && (
        <div className="absolute inset-0 z-[130] pointer-events-none">
          <div className="absolute inset-0 bg-black/35" />
          <div
            className="absolute inset-0"
            style={{
              backgroundImage:
                'repeating-linear-gradient(90deg, rgba(20,20,20,0.88) 0px, rgba(20,20,20,0.88) 10px, rgba(0,0,0,0) 10px, rgba(0,0,0,0) 72px)',
              boxShadow: 'inset 0 0 120px rgba(0,0,0,0.8)'
            }}
          />
        </div>
      )}

      <AnimatePresence>
        {showEscapeMiniGame && isPrisonLocked && guardPrisonState?.currentGameId && (
          <PrisonEscapeMiniGame
            gameId={guardPrisonState.currentGameId}
            gameName={guardPrisonState.currentGameName}
            difficulty={Math.max(1, Number(guardPrisonState.difficultyLevel || 1))}
            onResolve={handleResolveEscape}
            onClose={() => setShowEscapeMiniGame(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function JobBtn({ title, sub, qualified, onClick }: any) {
  return (
    <button
      onClick={onClick}
      className={`w-full p-4 rounded-xl border flex items-center justify-between text-left transition-all ${
        qualified
          ? 'bg-slate-800 border-slate-600 hover:border-sky-400 hover:bg-slate-700'
          : 'bg-slate-900 border-slate-800 opacity-55'
      }`}
    >
      <div>
        <div className={`font-black text-sm ${qualified ? 'text-slate-100' : 'text-slate-500'}`}>{title}</div>
        <div className="text-[10px] text-slate-400 mt-1">{sub}</div>
      </div>
      {!qualified && <span className="text-[10px] text-rose-300 bg-rose-900/30 px-2 py-1 rounded">条件不足</span>}
    </button>
  );
}

export default TowerGuardView;

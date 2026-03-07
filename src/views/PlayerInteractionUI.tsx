import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  MessageCircle,
  Swords,
  HandMetal,
  Users,
  BookOpen,
  Ghost,
  HeartHandshake,
  Eye,
  Coins,
  ShieldAlert,
} from 'lucide-react';
import { User } from '../types';

export interface RPStartResult {
  ok: boolean;
  sessionId?: string;
  message?: string;
}

interface Props {
  currentUser: User;
  targetUser: User;
  onClose: () => void;
  onStartRP: (target: User) => Promise<RPStartResult>;
  onOpenGroupRoleplay?: () => Promise<boolean> | boolean;
  onRequestTrade?: (target: User) => Promise<boolean> | boolean;
  showToast: (msg: string) => void;
}

function resolveAvatarSrc(u: any) {
  const raw = u?.avatarUrl ?? u?.avatar ?? u?.imageUrl ?? '';
  if (!raw || typeof raw !== 'string') return '';
  const s = raw.trim();
  if (!s) return '';

  let base = s;
  if (!/^data:image\//.test(s) && !/^https?:\/\//.test(s) && !s.startsWith('/')) {
    base = `/${s.replace(/^\.?\//, '')}`;
  }
  if (/^data:image\//.test(base)) return base;

  const ver = u?.avatarUpdatedAt ? encodeURIComponent(String(u.avatarUpdatedAt)) : '';
  if (!ver) return base;
  return base.includes('?') ? `${base}&v=${ver}` : `${base}?v=${ver}`;
}

function getPerspectiveText(currentUser: User, targetUser: User) {
  const myRole = String(currentUser.role || '').trim();
  const targetRole = String(targetUser.role || '').trim();
  const fury = Math.max(0, Number(targetUser.fury || 0));

  if (myRole === '普通人' && targetRole === '鬼魂') {
    return '你看不见对方的轮廓，只觉得周围泛起一阵不舒服的冷意。';
  }

  if (myRole === '普通人') {
    if (targetRole === '哨兵') return '对方身上带着让人本能警惕的压迫感。';
    if (targetRole === '向导') return '对方的气场让人下意识想靠近一些。';
    return '这是一个看起来很普通的人。';
  }

  if (myRole === '鬼魂') {
    if (targetRole === '哨兵') return '危险。对方的感知像针一样刺向你的灵体。';
    if (targetRole === '向导') return '温和的精神波动让你不由得想再靠近一点。';
    if (targetRole === '普通人') return '一个没有太多精神波动的普通躯壳。';
    return '你们彼此都确认了对方的存在。';
  }

  if (myRole === '向导') {
    if (targetRole === '哨兵') {
      if (fury >= 80) return '对方的精神景观已经濒临失控，情况非常危险。';
      if (fury >= 60) return '对方的精神状态偏紧绷，压力已经明显累积。';
      return '对方的精神波动整体平稳。';
    }
    if (targetRole === '鬼魂') return '你捕捉到了异常离散的精神体波动。';
    if (targetRole === '普通人') return '对方没有值得注意的精神力痕迹。';
    return '精神波动正常，可继续观察。';
  }

  if (myRole === '哨兵') {
    if (targetRole === '向导') return '对方的存在像一剂镇静药，让你本能地放松一些。';
    if (targetRole === '鬼魂') return '附近有让人烦躁的异质波动。';
    if (targetRole === '普通人') return '只是个普通人。';
    return '同类之间的感知摩擦让空气变得紧绷。';
  }

  return '你正在观察对方。';
}

function getRankScore(rankRaw?: string) {
  const rank = String(rankRaw || '').trim().toUpperCase();
  const map: Record<string, number> = {
    SSS: 7,
    SS: 6,
    S: 5,
    A: 4,
    B: 3,
    C: 2,
    D: 1,
  };
  return map[rank] || 0;
}

export function PlayerInteractionUI({
  currentUser,
  targetUser,
  onClose,
  onStartRP,
  onOpenGroupRoleplay,
  onRequestTrade,
  showToast,
}: Props) {
  const [noteContent, setNoteContent] = useState('');
  const [showNotes, setShowNotes] = useState(false);
  const [isActionPending, setIsActionPending] = useState(false);
  const [isStartingRP, setIsStartingRP] = useState(false);
  const [isOpeningGroupRP, setIsOpeningGroupRP] = useState(false);
  const [actionLock, setActionLock] = useState(false);
  const [targetRuntime, setTargetRuntime] = useState<User>(targetUser);
  const [avatarLoadFailed, setAvatarLoadFailed] = useState(false);
  const [insightText, setInsightText] = useState('');
  const [showReportForm, setShowReportForm] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);
  const [isRequestingTrade, setIsRequestingTrade] = useState(false);

  const effectiveTarget = targetRuntime || targetUser;
  const targetAvatarSrc = useMemo(() => resolveAvatarSrc(effectiveTarget), [effectiveTarget]);
  const perspectiveText = useMemo(() => getPerspectiveText(currentUser, effectiveTarget), [currentUser, effectiveTarget]);
  const disableAll = actionLock || isStartingRP || isOpeningGroupRP || isRequestingTrade;

  useEffect(() => {
    fetch(`/api/notes/${currentUser.id}/${targetUser.id}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setNoteContent(String(d.content || ''));
      })
      .catch(() => {});
  }, [currentUser.id, targetUser.id]);

  useEffect(() => {
    setTargetRuntime(targetUser);
  }, [targetUser]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`/api/characters/${targetUser.id}/runtime`, { cache: 'no-store' });
        const data = await res.json().catch(() => ({}));
        if (!alive || !res.ok || data.success === false || !data.user) return;
        setTargetRuntime(data.user);
      } catch {
        // ignore
      }
    })();
    return () => {
      alive = false;
    };
  }, [targetUser.id]);

  useEffect(() => {
    setAvatarLoadFailed(false);
  }, [targetAvatarSrc, targetUser.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const saveNote = async () => {
    try {
      const res = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ownerId: currentUser.id, targetId: targetUser.id, content: noteContent }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.success === false) {
        showToast(data.message || '保存笔记失败');
        return;
      }
      showToast('私人笔记已保存');
      setShowNotes(false);
    } catch {
      showToast('保存笔记失败');
    }
  };

  const startRPNow = async () => {
    try {
      setIsStartingRP(true);
      const result = await onStartRP(targetUser);
      if (result.ok) {
        onClose();
        return;
      }
      showToast(result.message || '发起对戏失败');
    } catch (error) {
      console.error(error);
      showToast('发起对戏失败，请稍后重试');
    } finally {
      setIsStartingRP(false);
    }
  };

  const openGroupRPNow = async () => {
    if (!onOpenGroupRoleplay || disableAll) return;
    try {
      setIsOpeningGroupRP(true);
      const ok = await onOpenGroupRoleplay();
      if (ok) onClose();
    } catch (error) {
      console.error(error);
      showToast('加入群戏失败，请稍后重试');
    } finally {
      setIsOpeningGroupRP(false);
    }
  };

  const requestTradeNow = async () => {
    if (!onRequestTrade || disableAll) return false;
    try {
      setIsRequestingTrade(true);
      const result = await onRequestTrade(targetUser);
      return Boolean(result);
    } catch (error) {
      console.error(error);
      showToast('发起交易请求失败');
      return false;
    } finally {
      setIsRequestingTrade(false);
    }
  };

  const buildCombatScores = () => {
    const myScore = getRankScore(currentUser.mentalRank) + getRankScore(currentUser.physicalRank);
    const targetScore = getRankScore(effectiveTarget.mentalRank) + getRankScore(effectiveTarget.physicalRank);
    return { myScore, targetScore };
  };

  const waitSkipResult = async (requestId: number) => {
    const startedAt = Date.now();
    while (Date.now() - startedAt < 20000) {
      const res = await fetch(`/api/interact/skip/status/${requestId}`, { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      const status = String(data?.request?.status || '');
      if (status === 'accepted') {
        showToast(data?.request?.resultMessage || '对方同意跳过，本次交互已直接结算');
        return 'accepted';
      }
      if (status === 'rejected') {
        showToast(data?.request?.resultMessage || '对方拒绝跳过，本次行为不成立');
        return 'rejected';
      }
      if (status === 'failed' || status === 'cancelled') {
        showToast(data?.request?.resultMessage || '跳过流程失败，本次行为已取消');
        return status;
      }
      await new Promise((resolve) => window.setTimeout(resolve, 1200));
    }
    showToast('对方长时间未响应，本次行为已取消');
    return 'timeout';
  };

  const handleAction = async (actionType: string) => {
    if (disableAll) return;

    if (actionType === 'trade') {
      const ok = await requestTradeNow();
      if (ok) onClose();
      return;
    }

    const skipSupported = ['combat', 'steal', 'prank', 'soothe'].includes(actionType);
    if (skipSupported) {
      const wantsSkip = window.confirm(
        '是否向对方发送“跳过本次对戏直接结算”的请求？\n若对方同意，将直接结算；若不同意，本次行为不成立。'
      );
      if (wantsSkip) {
        try {
          const payload =
            actionType === 'combat'
              ? (() => {
                  const { myScore, targetScore } = buildCombatScores();
                  return { attackerScore: myScore, defenderScore: targetScore };
                })()
              : {};
          setIsActionPending(true);
          const reqRes = await fetch('/api/interact/skip/request', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fromUserId: currentUser.id,
              toUserId: targetUser.id,
              actionType,
              payload,
            }),
          });
          const reqData = await reqRes.json().catch(() => ({}));
          if (!reqRes.ok || reqData.success === false || !reqData.requestId) {
            showToast(reqData.message || '发送跳过请求失败');
            return;
          }
          showToast('已发送跳过请求，等待对方确认');
          const status = await waitSkipResult(Number(reqData.requestId));
          if (status === 'accepted') onClose();
          return;
        } catch (error) {
          console.error(error);
          showToast('跳过流程异常，本次行为已取消');
          return;
        } finally {
          setIsActionPending(false);
        }
      }
    }

    setActionLock(true);
    try {
      let shouldStartRPAfter = ['combat', 'steal', 'prank', 'soothe'].includes(actionType);

      switch (actionType) {
        case 'combat': {
          const { myScore, targetScore } = buildCombatScores();
          const combatRes = await fetch('/api/interact/combat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              attackerId: currentUser.id,
              defenderId: targetUser.id,
              attackerScore: myScore,
              defenderScore: targetScore,
            }),
          });
          const combatData = await combatRes.json().catch(() => ({}));
          if (!combatRes.ok || combatData.success === false) {
            showToast(combatData.message || '战斗结算失败');
            return;
          }
          await fetch('/api/combat/end', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: currentUser.id }),
          }).catch(() => {});
          showToast(combatData.isAttackerWin ? '你在这次交锋中占了上风' : '你在这次交锋中吃了亏');
          break;
        }

        case 'steal': {
          const res = await fetch('/api/interact/steal', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ thiefId: currentUser.id, targetId: targetUser.id }),
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok || data.success === false) {
            showToast(data.message || '偷窃失败');
            return;
          }
          showToast(data.message || '偷窃成功');
          break;
        }

        case 'party': {
          const res = await fetch('/api/party/request', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: currentUser.id, targetId: targetUser.id }),
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok || data.success === false) {
            showToast(data.message || '组队操作失败');
            return;
          }
          const mode = String(data.mode || '');
          if (mode === 'join_direct') {
            showToast(data.message || '已发起组队邀请，等待对方同意');
          } else if (mode === 'join_vote') {
            showToast(data.message || '已发起入队投票');
          } else if (mode === 'leave_request') {
            showToast(data.message || '已发起解除组队请求');
          } else if (mode === 'leave_done' || mode === 'join_done') {
            showToast(data.message || '组队状态已更新');
          } else {
            showToast(data.message || '组队请求已提交');
          }
          shouldStartRPAfter = false;
          break;
        }

        case 'soothe': {
          const res = await fetch('/api/guide/soothe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sentinelId: targetUser.id, guideId: currentUser.id }),
          });
          const data = await res.json().catch(() => ({}));
          showToast(data.message || (data.success ? '抚慰完成' : '抚慰失败'));
          break;
        }

        case 'prank': {
          const res = await fetch('/api/interact/prank', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ghostId: currentUser.id,
              targetId: targetUser.id,
              targetRole: effectiveTarget.role,
            }),
          });
          const data = await res.json().catch(() => ({}));
          showToast(data.message || (data.success ? '恶作剧成功' : '恶作剧失败'));
          break;
        }

        case 'probe': {
          const probeRes = await fetch('/api/interact/probe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ actorId: currentUser.id, targetId: targetUser.id }),
          });
          const data = await probeRes.json().catch(() => ({}));
          if (!probeRes.ok || data.success === false || !data.probedStat) {
            showToast(data.message || '精神探查失败');
            return;
          }
          setInsightText(`精神探查结果：${String(data.probedStat.key || '未知')} = ${String(data.probedStat.value || '未知')}`);
          shouldStartRPAfter = false;
          break;
        }

        default:
          break;
      }

      if (shouldStartRPAfter) {
        await startRPNow();
      }
    } finally {
      setActionLock(false);
    }
  };

  const submitReport = async () => {
    const reason = reportReason.trim();
    if (!reason) {
      showToast('请先填写举报原因');
      return;
    }

    setIsSubmittingReport(true);
    try {
      const res = await fetch('/api/interact/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reporterId: currentUser.id,
          targetId: targetUser.id,
          reason,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.success === false) {
        showToast(data.message || '举报失败');
        return;
      }
      showToast(data.message || '举报已提交，等待管理员审核');
      setShowReportForm(false);
      setReportReason('');
    } catch {
      showToast('举报失败');
    } finally {
      setIsSubmittingReport(false);
    }
  };

  if (String(currentUser.role || '') === '普通人' && String(effectiveTarget.role || '') === '鬼魂') {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 mobile-portrait-safe-overlay">
        <motion.div
          onClick={(e) => e.stopPropagation()}
          initial={{ scale: 0.92, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="theme-elevated-surface relative max-w-sm rounded-3xl p-8 text-center mobile-portrait-safe-card"
        >
          <button
            onClick={onClose}
            className="absolute right-3 top-3 rounded-full border border-slate-700 bg-slate-800 p-2 text-slate-400 hover:text-white"
          >
            <X size={16} />
          </button>
          <Ghost size={48} className="mx-auto mb-4 text-slate-600 animate-pulse" />
          <p className="text-sm italic text-slate-300">“{perspectiveText}”</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm mobile-portrait-safe-overlay">
      <motion.div
        initial={{ scale: 0.92, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.92, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="theme-elevated-surface relative h-[min(540px,72vh)] w-[min(560px,94vw)] rounded-[2rem] mobile-contrast-surface-dark"
      >
        <button
          onClick={onClose}
          className="absolute right-0 top-0 z-50 rounded-full border border-slate-700 bg-slate-900 p-2 text-slate-400 hover:text-white"
        >
          <X size={20} />
        </button>

        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center pointer-events-none">
          <div className="theme-elevated-surface pointer-events-auto flex h-72 w-52 items-center justify-center overflow-hidden rounded-[1.75rem] border-4 border-white/45 shadow-[0_20px_50px_rgba(38,58,92,0.22)]">
            {targetAvatarSrc && !avatarLoadFailed ? (
              <img
                src={targetAvatarSrc}
                className="h-full w-full object-contain"
                alt="avatar"
                onError={() => setAvatarLoadFailed(true)}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-6xl font-black text-slate-600">
                {String(effectiveTarget.name || '?')[0] || '?'}
              </div>
            )}
          </div>

          <div className="theme-elevated-surface pointer-events-auto mt-4 w-[min(22rem,88vw)] rounded-2xl p-4 text-center">
            <h4 className="mb-1 text-lg font-black text-white">{effectiveTarget.name}</h4>
            <div className="text-xs text-slate-400">
              {effectiveTarget.role || '未知身份'}
              {effectiveTarget.faction ? ` · ${effectiveTarget.faction}` : ''}
              {effectiveTarget.job ? ` · ${effectiveTarget.job}` : ''}
            </div>
            <p className="mt-2 text-sm italic text-slate-300">“{perspectiveText}”</p>
            {isActionPending && <p className="mt-2 text-[11px] text-amber-400">正在等待对方处理跳过请求…</p>}
          </div>
        </div>

        <div className="absolute inset-0 z-20 pointer-events-none">
          <ActionButton
            onClick={startRPNow}
            icon={<MessageCircle />}
            label={isStartingRP ? '连接中…' : '发起对戏'}
            cls="left-1/2 top-0 -translate-x-1/2"
            color="bg-sky-600 hover:bg-sky-500"
            disabled={disableAll}
          />
          <ActionButton
            onClick={openGroupRPNow}
            icon={<Users />}
            label={isOpeningGroupRP ? '加入中…' : '地图群戏'}
            cls="right-12 top-4"
            color="bg-cyan-600 hover:bg-cyan-500"
            disabled={disableAll || !onOpenGroupRoleplay}
          />
          <ActionButton
            onClick={() => handleAction('combat')}
            icon={<Swords />}
            label="发起战斗"
            cls="left-10 top-20"
            color="bg-rose-600 hover:bg-rose-500"
            disabled={disableAll}
          />
          <ActionButton
            onClick={() => handleAction('party')}
            icon={<Users />}
            label="组队纠缠"
            cls="right-10 top-20"
            color="bg-indigo-600 hover:bg-indigo-500"
            disabled={disableAll}
          />
          <ActionButton
            onClick={() => handleAction('steal')}
            icon={<HandMetal />}
            label="暗中偷窃"
            cls="left-0 top-1/2 -translate-y-1/2"
            color="bg-slate-700 hover:bg-slate-600"
            disabled={disableAll}
          />
          <ActionButton
            onClick={() => setShowNotes(true)}
            icon={<BookOpen />}
            label="私人小本本"
            cls="right-0 top-1/2 -translate-y-1/2"
            color="bg-amber-600 hover:bg-amber-500"
            disabled={disableAll}
          />
          <ActionButton
            onClick={() => handleAction('trade')}
            icon={<Coins />}
            label={isRequestingTrade ? '发起中…' : '发起交易'}
            cls="bottom-14 left-12"
            color="bg-emerald-600 hover:bg-emerald-500"
            disabled={disableAll || !onRequestTrade}
          />
          <ActionButton
            onClick={() => setShowReportForm(true)}
            icon={<ShieldAlert />}
            label="举报违规"
            cls="bottom-14 right-12"
            color="bg-red-800 hover:bg-red-700"
            disabled={disableAll}
          />

          {String(currentUser.role || '') === '鬼魂' && (
            <ActionButton
              onClick={() => handleAction('prank')}
              icon={<Ghost />}
              label="恶作剧"
              cls="bottom-0 left-1/2 -translate-x-1/2"
              color="bg-violet-600 hover:bg-violet-500"
              disabled={disableAll}
            />
          )}
          {String(currentUser.role || '') === '向导' && String(effectiveTarget.role || '') === '哨兵' && (
            <ActionButton
              onClick={() => handleAction('soothe')}
              icon={<HeartHandshake />}
              label="精神抚慰"
              cls="bottom-0 left-1/2 -translate-x-1/2"
              color="bg-emerald-500 hover:bg-emerald-400"
              disabled={disableAll}
            />
          )}
          {String(currentUser.role || '') === '哨兵' && (
            <ActionButton
              onClick={() => handleAction('probe')}
              icon={<Eye />}
              label="精神探查"
              cls="bottom-0 left-1/2 -translate-x-1/2"
              color="bg-blue-600 hover:bg-blue-500"
              disabled={disableAll}
            />
          )}
        </div>

        <AnimatePresence>
          {showNotes && (
            <OverlayCard onClose={() => setShowNotes(false)} title={`关于 ${effectiveTarget.name} 的私人笔记`}>
              <textarea
                value={noteContent}
                onChange={(e) => setNoteContent(e.target.value)}
                placeholder="记录对方的派系、能力、性格和你自己的备注。"
                className="mb-3 h-32 w-full resize-none rounded-2xl border border-slate-800 bg-slate-950 p-3 text-xs text-slate-300 outline-none focus:border-amber-500/60"
              />
              <button
                onClick={saveNote}
                className="w-full rounded-2xl bg-amber-600 px-4 py-2.5 text-sm font-black text-white hover:bg-amber-500"
              >
                保存笔记
              </button>
            </OverlayCard>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {insightText && (
            <OverlayCard onClose={() => setInsightText('')} title="精神探查">
              <div className="rounded-2xl border border-sky-500/30 bg-sky-500/10 p-4 text-sm leading-6 text-sky-100">
                {insightText}
              </div>
            </OverlayCard>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showReportForm && (
            <OverlayCard onClose={() => setShowReportForm(false)} title={`举报 ${effectiveTarget.name}`}>
              <textarea
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
                placeholder="请填写举报原因，管理员后台会进入投票审核。"
                className="mb-3 h-32 w-full resize-none rounded-2xl border border-slate-800 bg-slate-950 p-3 text-xs text-slate-300 outline-none focus:border-rose-500/60"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => setShowReportForm(false)}
                  className="flex-1 rounded-2xl bg-slate-800 px-4 py-2.5 text-sm font-black text-slate-200 hover:bg-slate-700"
                >
                  取消
                </button>
                <button
                  onClick={submitReport}
                  disabled={isSubmittingReport}
                  className="flex-1 rounded-2xl bg-rose-600 px-4 py-2.5 text-sm font-black text-white hover:bg-rose-500 disabled:opacity-60"
                >
                  {isSubmittingReport ? '提交中…' : '提交举报'}
                </button>
              </div>
            </OverlayCard>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

function OverlayCard({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <motion.div
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 20, opacity: 0 }}
      className="theme-elevated-surface absolute bottom-4 z-50 w-[min(22rem,90vw)] rounded-3xl p-4 pointer-events-auto mobile-contrast-surface-dark"
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="text-sm font-black text-white">{title}</div>
        <button onClick={onClose} className="rounded-full bg-slate-800 p-2 text-slate-400 hover:text-white">
          <X size={14} />
        </button>
      </div>
      {children}
    </motion.div>
  );
}

function ActionButton({
  icon,
  label,
  onClick,
  cls,
  color,
  disabled = false,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  cls: string;
  color: string;
  disabled?: boolean;
}) {
  return (
    <div className={`absolute pointer-events-auto group ${cls}`}>
      <button
        onClick={onClick}
        disabled={disabled}
        className={`flex h-12 w-12 items-center justify-center rounded-full border-2 border-slate-900 text-white shadow-lg transition-all duration-300 hover:scale-110 md:h-14 md:w-14 ${color} disabled:cursor-not-allowed disabled:opacity-50`}
      >
        {icon}
      </button>
      <div className="theme-elevated-surface theme-muted-text pointer-events-none absolute left-1/2 top-full mt-2 -translate-x-1/2 whitespace-nowrap rounded-full px-2.5 py-1 text-[10px] font-bold opacity-0 transition-opacity group-hover:opacity-100">
        {label}
      </div>
    </div>
  );
}


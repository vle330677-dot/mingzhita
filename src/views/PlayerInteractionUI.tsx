import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X, MessageCircle, Swords, HandMetal, Users,
  BookOpen, Ghost, HeartHandshake, Eye, Coins, ShieldAlert
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
  showToast: (msg: string) => void;
}

export function PlayerInteractionUI({ currentUser, targetUser, onClose, onStartRP, onOpenGroupRoleplay, showToast }: Props) {
  const [noteContent, setNoteContent] = useState('');
  const [showNotes, setShowNotes] = useState(false);
  const [isActionPending, setIsActionPending] = useState(false);
  const [isStartingRP, setIsStartingRP] = useState(false);
  const [isOpeningGroupRP, setIsOpeningGroupRP] = useState(false);
  const [actionLock, setActionLock] = useState(false);

  useEffect(() => {
    fetch(`/api/notes/${currentUser.id}/${targetUser.id}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setNoteContent(d.content || '');
      })
      .catch(() => {});
  }, [currentUser.id, targetUser.id]);

  // ✅ 头像地址解析 + 版本戳破缓存
  const resolveAvatarSrc = (u: any) => {
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
  };

  const [targetRuntime, setTargetRuntime] = useState<User>(targetUser);
  const effectiveTarget = targetRuntime || targetUser;
  const targetAvatarSrc = useMemo(() => resolveAvatarSrc(effectiveTarget), [effectiveTarget]);
  const [avatarLoadFailed, setAvatarLoadFailed] = useState(false);
  useEffect(() => { setTargetRuntime(targetUser); }, [targetUser]);

useEffect(() => {
  let alive = true;
  (async () => {
    try {
      const res = await fetch(`/api/characters/${targetUser.id}/runtime`, { cache: 'no-store' });
      const data = await res.json();
      if (!alive) return;
      if (res.ok && data.success && data.user) setTargetRuntime(data.user);
    } catch {}
  })();
  return () => { alive = false; };
}, [targetUser.id]);

  useEffect(() => {
    setAvatarLoadFailed(false);
  }, [targetAvatarSrc, targetUser?.id]);

  // ESC 关闭（可控，不依赖点背景）
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const saveNote = async () => {
    await fetch('/api/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ownerId: currentUser.id, targetId: targetUser.id, content: noteContent })
    });
    showToast('私人笔记已保存');
    setShowNotes(false);
  };

  const perspectiveText = useMemo(() => {
    const myRole = currentUser.role;
    const tRole = effectiveTarget.role;

    if (myRole === '普通人' && tRole === '鬼魂') return '你什么都没看到，但感觉周围有一股令人毛骨悚然的冷意...';
    if (myRole === '普通人') {
      if (tRole === '哨兵') return '对方身上散发着无形的压迫感，让你觉得有些喘不过气。';
      if (tRole === '向导') return '对方的气场让你觉得莫名的安心和亲切。';
      return '这是一个看起来很普通的人。';
    }
    if (myRole === '鬼魂') {
      if (tRole === '哨兵') return '极度危险！对方的精神波动像针刺一样威胁着你的灵体。';
      if (tRole === '向导') return '对方的精神海很温暖，让你有种想靠近的亲和感。';
      if (tRole === '普通人') return '一个毫无灵力波动的普通躯壳。';
      return '你们对视了一眼，确认过眼神，都是同道中鬼。';
    }
    if (myRole === '向导') {
      if (tRole === '哨兵') {
        const fury = effectiveTarget.fury || 0;
        if (fury >= 80) return '警报！对方的精神图景正在崩塌边缘，狂暴的能量极度危险！';
        if (fury >= 60) return '对方的精神状态有些紧绷，能感受到明显的压力。';
        return '对方的精神力波动平稳，一切正常。';
      }
      if (tRole === '鬼魂') return '捕捉到了异常的离散精神体波动。';
      if (tRole === '普通人') return '这个人身上没有精神力波动的痕迹。';
    }
    if (myRole === '哨兵') {
      if (tRole === '向导') return '对方的存在本身就像一剂良药，让你感到本能的亲近与放松。';
      if (tRole === '鬼魂') return '周围似乎有些烦人的、黏糊糊的波动存在。';
      if (tRole === '普通人') return '毫无威胁的普通人。';
      return '确认过了，是同类。精神屏障互相摩擦的感觉并不好受。';
    }
    return '你们相互打量着对方。';
  }, [currentUser, effectiveTarget]);

  const startRPNow = async () => {
    try {
      setIsStartingRP(true);
      const result = await onStartRP(targetUser);
      if (result.ok) {
        onClose();
      } else {
        showToast(result.message || '建立连接失败：未拿到会话ID');
      }
    } catch (e) {
      console.error(e);
      showToast('建立连接失败，请稍后重试');
    } finally {
      setIsStartingRP(false);
    }
  };

  const openGroupRPNow = async () => {
    if (!onOpenGroupRoleplay || actionLock || isStartingRP) return;
    try {
      setIsOpeningGroupRP(true);
      const ok = await onOpenGroupRoleplay();
      if (ok) onClose();
    } catch (e) {
      console.error(e);
      showToast('加入群戏失败，请稍后重试');
    } finally {
      setIsOpeningGroupRP(false);
    }
  };

  const buildCombatScores = () => {
    const rankMap: Record<string, number> = {
      SSS: 7,
      SS: 6,
      S: 5,
      A: 4,
      B: 3,
      C: 2,
      D: 1,
      无: 0
    };
    const myScore =
      rankMap[currentUser.mentalRank || '无'] + rankMap[currentUser.physicalRank || '无'];
    const tScore =
      rankMap[effectiveTarget.mentalRank || '无'] + rankMap[effectiveTarget.physicalRank || '无'];
    return { myScore, tScore };
  };

  const waitSkipResult = async (requestId: number) => {
    const startedAt = Date.now();
    while (Date.now() - startedAt < 20000) {
      const res = await fetch(`/api/interact/skip/status/${requestId}`);
      const data = await res.json().catch(() => ({}));
      const st = String(data?.request?.status || '');
      if (st === 'accepted') {
        showToast(data?.request?.resultMessage || '对方同意跳过，动作已结算');
        return 'accepted';
      }
      if (st === 'rejected') {
        showToast(data?.request?.resultMessage || '对方拒绝了跳过请求，动作取消');
        return 'rejected';
      }
      if (st === 'failed' || st === 'cancelled') {
        showToast(data?.request?.resultMessage || '跳过流程失败，动作取消');
        return st;
      }
      await new Promise((r) => setTimeout(r, 1200));
    }
    showToast('对方长时间未响应，动作已取消');
    return 'timeout';
  };

  const handleAction = async (actionType: string) => {
    if (actionLock || isStartingRP) return;

    const skipSupported = ['combat', 'steal', 'prank', 'soothe'].includes(actionType);
    if (skipSupported) {
      const wantsSkip = window.confirm(
        '是否向对方发送【免对戏跳过】请求？\n(若对方同意，直接结算；若不同意，此动作失效)'
      );
      if (wantsSkip) {
        try {
          const payload =
            actionType === 'combat'
              ? (() => {
                  const { myScore, tScore } = buildCombatScores();
                  return { attackerScore: myScore, defenderScore: tScore };
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
              payload
            })
          });
          const reqData = await reqRes.json().catch(() => ({}));
          if (!reqRes.ok || reqData.success === false || !reqData.requestId) {
            showToast(reqData.message || '跳过请求发送失败');
            return;
          }
          showToast('已向对方发送跳过请求，等待回应...');
          const status = await waitSkipResult(Number(reqData.requestId));
          if (status === 'accepted') onClose();
          return;
        } catch (e) {
          console.error(e);
          showToast('跳过流程异常，动作取消');
          return;
        } finally {
          setIsActionPending(false);
        }
      }
    }

    setActionLock(true);
    try {
      let shouldStartRPAfter = ['combat', 'steal', 'prank', 'soothe', 'trade'].includes(actionType);
      switch (actionType) {
        case 'combat': {
          const { myScore, tScore } = buildCombatScores();

          const combatRes = await fetch('/api/interact/combat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              attackerId: currentUser.id,
              defenderId: targetUser.id,
              attackerScore: myScore,
              defenderScore: tScore
            })
          });
          const combatData = await combatRes.json().catch(() => ({}));
          if (!combatRes.ok || combatData.success === false) {
            showToast(combatData.message || '战斗结算失败');
            return;
          }

          await fetch('/api/combat/end', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: currentUser.id })
          });

          showToast(combatData.isAttackerWin ? '你在这次交锋中占优' : '你在这次交锋中失利');
          break;
        }

        case 'steal': {
          const res = await fetch('/api/interact/steal', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ thiefId: currentUser.id, targetId: targetUser.id })
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
            body: JSON.stringify({ userId: currentUser.id, targetId: targetUser.id })
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
            showToast(data.message || '已发起解散请求，等待队友确认');
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
            body: JSON.stringify({ sentinelId: targetUser.id, guideId: currentUser.id })
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
              targetRole: effectiveTarget.role
            })
          });
          const data = await res.json().catch(() => ({}));
          showToast(data.message || (data.success ? '恶作剧成功' : '恶作剧失败'));
          break;
        }

        case 'probe': {
          const probeRes = await fetch('/api/interact/probe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ actorId: currentUser.id, targetId: targetUser.id })
          });
          const data = await probeRes.json().catch(() => ({}));
          if (data.success) {
            alert(`【探查结果】你窥探到了对方的秘密数据：${data.probedStat.key} = ${data.probedStat.value}`);
          } else {
            showToast(data.message || '探查失败');
            return;
          }
          shouldStartRPAfter = false;
          break;
        }

        case 'trade': {
          const modeRaw = (window.prompt('交易模式：请输入 gold / item / skill', 'gold') || '').trim().toLowerCase();
          if (!modeRaw) return;
          let body: any = {
            fromUserId: currentUser.id,
            toUserId: targetUser.id,
            mode: modeRaw
          };
          if (modeRaw === 'gold') {
            const amount = Number(window.prompt('输入转移金币数量', '100') || 0);
            if (!Number.isFinite(amount) || amount <= 0) return;
            body.amount = amount;
          } else if (modeRaw === 'item') {
            const itemName = (window.prompt('输入要交易的物品名称') || '').trim();
            if (!itemName) return;
            body.itemName = itemName;
          } else if (modeRaw === 'skill') {
            const skillName = (window.prompt('输入要交易的技能名称') || '').trim();
            if (!skillName) return;
            body.skillName = skillName;
          } else {
            showToast('不支持的交易模式');
            return;
          }
          const res = await fetch('/api/interact/trade', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok || data.success === false) {
            showToast(data.message || '交易失败');
            return;
          }
          showToast(data.message || '交易成功');
          break;
        }

        default:
          break;
      }

      if (shouldStartRPAfter) await startRPNow();
    } finally {
      setActionLock(false);
    }
  };

  const handleReport = async () => {
    if (actionLock || isStartingRP) return;
    const reason = (window.prompt('请输入举报理由') || '').trim();
    if (!reason) return;
    setActionLock(true);
    try {
      const res = await fetch('/api/interact/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reporterId: currentUser.id,
          targetId: targetUser.id,
          reason
        })
      });
      const data = await res.json().catch(() => ({}));
      showToast(data.message || (data.success ? '举报已提交' : '举报失败'));
    } finally {
      setActionLock(false);
    }
  };

  // 普通人看鬼魂
  if (currentUser.role === '普通人' && effectiveTarget.role === '鬼魂') {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 mobile-portrait-safe-overlay">
        <motion.div
          onClick={(e) => e.stopPropagation()}
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="relative bg-slate-900 border border-slate-700 p-8 rounded-3xl text-center max-w-sm mobile-portrait-safe-card mobile-contrast-surface-dark"
        >
          <button
            onClick={onClose}
            className="absolute top-3 right-3 p-2 text-slate-500 hover:text-white bg-slate-800 rounded-full border border-slate-700"
          >
            <X size={16} />
          </button>
          <Ghost size={48} className="text-slate-700 mx-auto mb-4 animate-pulse" />
          <p className="text-slate-300 italic">"{perspectiveText}"</p>
        </motion.div>
      </div>
    );
  }

  const disableAll = actionLock || isStartingRP || isOpeningGroupRP;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 mobile-portrait-safe-overlay">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="relative flex items-center justify-center w-[min(500px,92vw)] h-[min(500px,62vh)] md:w-[500px] md:h-[500px] mobile-contrast-surface-dark"
      >
        <button
          onClick={onClose}
          className="absolute top-0 right-0 z-50 p-2 text-slate-500 hover:text-white bg-slate-900 rounded-full border border-slate-700"
        >
          <X size={20} />
        </button>

        <div className="absolute inset-0 flex flex-col items-center justify-center z-10 pointer-events-none">
          <div className="w-48 h-64 bg-slate-900 rounded-2xl border-4 border-slate-700 overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.8)] pointer-events-auto flex items-center justify-center">
            {targetAvatarSrc && !avatarLoadFailed ? (
              <img
                src={targetAvatarSrc}
                className="w-full h-full object-contain"
                alt="avatar"
                onError={() => setAvatarLoadFailed(true)}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-6xl text-slate-600 font-black">
                {effectiveTarget.name[0]}
              </div>
            )}
          </div>

          <div className="mt-4 bg-slate-900/90 border border-slate-700 p-4 rounded-xl w-80 text-center shadow-xl backdrop-blur">
            <h4 className="text-lg font-black text-white mb-1">{effectiveTarget.name}</h4>
            <p className="text-sm text-slate-300 italic">"{perspectiveText}"</p>
            {isActionPending && <p className="text-[10px] text-amber-400 mt-2">等待对方处理跳过请求...</p>}
          </div>
        </div>

        <div className="absolute inset-0 z-20 pointer-events-none">
          <ActionButton
            onClick={startRPNow}
            icon={<MessageCircle />}
            label={isStartingRP ? '连接中...' : '发起对戏'}
            cls="top-0 left-1/2 -translate-x-1/2"
            color="bg-sky-600 hover:bg-sky-500"
            disabled={disableAll}
          />
          <ActionButton
            onClick={openGroupRPNow}
            icon={<Users />}
            label={isOpeningGroupRP ? '加入中...' : '地图群戏'}
            cls="top-0 right-16"
            color="bg-cyan-600 hover:bg-cyan-500"
            disabled={disableAll || !onOpenGroupRoleplay}
          />
          <ActionButton
            onClick={() => handleAction('combat')}
            icon={<Swords />}
            label="发起战斗"
            cls="top-12 left-12"
            color="bg-rose-600 hover:bg-rose-500"
            disabled={disableAll}
          />
          <ActionButton
            onClick={() => handleAction('party')}
            icon={<Users />}
            label="组队纠缠"
            cls="top-12 right-12"
            color="bg-indigo-600 hover:bg-indigo-500"
            disabled={disableAll}
          />
          <ActionButton
            onClick={() => handleAction('steal')}
            icon={<HandMetal />}
            label="暗中偷窃"
            cls="top-1/2 left-0 -translate-y-1/2"
            color="bg-slate-700 hover:bg-slate-600"
            disabled={disableAll}
          />
          <ActionButton
            onClick={() => setShowNotes(true)}
            icon={<BookOpen />}
            label="小本本"
            cls="top-1/2 right-0 -translate-y-1/2"
            color="bg-amber-600 hover:bg-amber-500"
            disabled={disableAll}
          />
          <ActionButton
            onClick={() => handleAction('trade')}
            icon={<Coins />}
            label="发起交易"
            cls="bottom-12 left-12"
            color="bg-emerald-600 hover:bg-emerald-500"
            disabled={disableAll}
          />
          <ActionButton
            onClick={handleReport}
            icon={<ShieldAlert />}
            label="举报违规"
            cls="bottom-12 right-12"
            color="bg-red-800 hover:bg-red-700"
            disabled={disableAll}
          />
          {currentUser.role === '鬼魂' && (
            <ActionButton
              onClick={() => handleAction('prank')}
              icon={<Ghost />}
              label="恶作剧"
              cls="bottom-0 left-1/2 -translate-x-1/2"
              color="bg-violet-600 hover:bg-violet-500"
              disabled={disableAll}
            />
          )}
          {currentUser.role === '向导' && effectiveTarget.role === '哨兵' && (
            <ActionButton
              onClick={() => handleAction('soothe')}
              icon={<HeartHandshake />}
              label="精神抚慰"
              cls="bottom-0 left-1/2 -translate-x-1/2"
              color="bg-emerald-500 hover:bg-emerald-400"
              disabled={disableAll}
            />
          )}
          {currentUser.role === '哨兵' && (
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
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="absolute bottom-4 z-50 bg-slate-900 border border-slate-700 p-4 rounded-2xl w-[min(20rem,88vw)] shadow-2xl pointer-events-auto mobile-contrast-surface-dark"
            >
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-bold text-slate-300">关于 {effectiveTarget.name} 的情报笔记</span>
                <button onClick={() => setShowNotes(false)}>
                  <X size={14} />
                </button>
              </div>
              <textarea
                value={noteContent}
                onChange={(e) => setNoteContent(e.target.value)}
                placeholder="记录对方的派系、能力、性格等..."
                className="w-full h-32 bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs text-slate-300 outline-none focus:border-amber-500/50 resize-none mb-3"
              />
              <button
                onClick={saveNote}
                className="w-full py-2 bg-amber-600 text-white rounded-lg text-xs font-bold hover:bg-amber-500"
              >
                保存记录
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

function ActionButton({
  icon,
  label,
  onClick,
  cls,
  color,
  disabled = false
}: {
  icon: React.ReactNode;
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
        className={`w-12 h-12 md:w-14 md:h-14 rounded-full text-white flex items-center justify-center transition-all duration-300 hover:scale-110 shadow-lg border-2 border-slate-900 ${color} disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        {icon}
      </button>
      <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-2 py-1 bg-black/80 backdrop-blur rounded text-[10px] font-bold text-white opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none transition-opacity">
        {label}
      </div>
    </div>
  );
}

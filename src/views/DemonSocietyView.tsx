import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ArrowLeft, X, Skull, Flame, 
  Ghost, Flag, Ban, Dices, Zap
} from 'lucide-react';
import { User } from '../types';
import FactionMemberPanel from './shared/FactionMemberPanel';

interface Props {
  user: User;
  onExit: () => void;
  showToast: (msg: string) => void;
  fetchGlobalData: () => void;
}

interface DemonGambleRequest {
  id: number;
  challengerId: number;
  challengerName: string;
  targetId: number;
  targetName: string;
  amount: number;
  status: string;
  responderId: number;
  challengerRoll: number;
  targetRoll: number;
  winnerId: number;
  loserId: number;
  viewerRole?: string;
  viewerWon?: boolean;
  createdAt: string;
  updatedAt: string;
}

interface DiceRevealState {
  visible: boolean;
  phase: 'rolling' | 'result';
  mode: 'solo' | 'pvp';
  accent: 'amber' | 'rose';
  title: string;
  subtitle: string;
  soloRoll: number;
  challengerRoll: number;
  targetRoll: number;
  resultText: string;
}

// 基于图片设定的建筑坐标
const buildings = [
  { id: 'hall', name: '自由大厅', x: 50, y: 35, icon: <Skull/>, desc: '加入狂欢，或者滚蛋。' },
  { id: 'casino', name: '狂欢赌场', x: 70, y: 60, icon: <Dices/>, desc: '【小游戏】玩命对赌，以及学习信息系技能。' },
  { id: 'strategy', name: '搞事据点', x: 30, y: 50, icon: <Flag/>, desc: '策划下一次针对守塔会的破坏行动。' },
  { id: 'cave', name: '幽魂休憩地', x: 80, y: 30, icon: <Ghost/>, desc: '鬼魂们的乐园，生人勿近。' },
];

// --- 职位与门槛常量 ---
const ROLES = {
  MASTER: '恶魔会会长',
  MEMBER: '恶魔会成员'
};

const RANK_SCORES: Record<string, number> = {
  '无': 0, 'F': 1, 'E': 2, 'D': 3, 'C': 4, 'C+': 5, 'B': 6, 'B+': 7, 
  'A': 8, 'A+': 9, 'S': 10, 'S+': 11, 'SS': 12, 'SS+': 13, 'SSS': 14
};

export function DemonSocietyView({ user, onExit, showToast, fetchGlobalData }: Props) {
  const [selectedBuilding, setSelectedBuilding] = useState<any>(null);
  const [isRioting, setIsRioting] = useState(false);
  const [miniGame, setMiniGame] = useState({ active: false, clicks: 0, timeLeft: 10 });
  const [infoSkills, setInfoSkills] = useState<any[]>([]);
  const [demonDailySkill, setDemonDailySkill] = useState({
    max: 3,
    used: 0,
    remaining: 0,
    isDemonMember: false
  });
  const [demonCasinoGold, setDemonCasinoGold] = useState<number>(Number(user.gold || 0));
  const [demonNearbyPlayers, setDemonNearbyPlayers] = useState<any[]>([]);
  const [soloBetAmount, setSoloBetAmount] = useState(50);
  const [soloGuess, setSoloGuess] = useState<'big' | 'small'>('big');
  const [pvpBetAmount, setPvpBetAmount] = useState(100);
  const [pvpTargetId, setPvpTargetId] = useState<number>(0);
  const [casinoBusy, setCasinoBusy] = useState(false);
  const [blackmarketNpc, setBlackmarketNpc] = useState<any>(null);
  const [blackmarketOffers, setBlackmarketOffers] = useState<any[]>([]);
  const [blackmarketCanTrade, setBlackmarketCanTrade] = useState(false);
  const [incomingGambleRequests, setIncomingGambleRequests] = useState<DemonGambleRequest[]>([]);
  const [outgoingGambleRequests, setOutgoingGambleRequests] = useState<DemonGambleRequest[]>([]);
  const [diceReveal, setDiceReveal] = useState<DiceRevealState>({
    visible: false,
    phase: 'rolling',
    mode: 'solo',
    accent: 'amber',
    title: '',
    subtitle: '',
    soloRoll: 1,
    challengerRoll: 1,
    targetRoll: 1,
    resultText: ''
  });
  const diceRevealTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const diceRevealHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seenGambleEventKeysRef = useRef<Set<string>>(new Set());
  const demonGambleBootstrappedRef = useRef(false);

  // 身份判断
  const isDemon = Object.values(ROLES).includes(user.job || '');
  const canUseDemonSkill = isDemon || demonDailySkill.isDemonMember;
  const hasPendingPvpRequest = incomingGambleRequests.length > 0 || outgoingGambleRequests.length > 0;
  const getScore = (rank?: string) => RANK_SCORES[rank || '无'] || 0;

  useEffect(() => {
    if (selectedBuilding?.id !== 'casino') {
      setIncomingGambleRequests([]);
      setOutgoingGambleRequests([]);
      demonGambleBootstrappedRef.current = false;
      seenGambleEventKeysRef.current.clear();
      return;
    }

    demonGambleBootstrappedRef.current = false;
    seenGambleEventKeysRef.current.clear();
    fetchSkills();
    fetchDemonState();
    fetchBlackmarketState();

    const timer = setInterval(() => {
      fetchDemonState();
      fetchBlackmarketState();
    }, 4000);

    return () => clearInterval(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBuilding?.id, user.id]);

  // --- 小游戏计时器 ---
  useEffect(() => {
    let timer: any;
    if (miniGame.active && miniGame.timeLeft > 0) {
      timer = setInterval(() => setMiniGame(prev => ({ ...prev, timeLeft: prev.timeLeft - 1 })), 1000);
    } else if (miniGame.active && miniGame.timeLeft <= 0) {
      handleMiniGameOver();
    }
    return () => clearInterval(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [miniGame.active, miniGame.timeLeft]);

  useEffect(() => () => {
    if (diceRevealTimerRef.current) clearTimeout(diceRevealTimerRef.current);
    if (diceRevealHideTimerRef.current) clearTimeout(diceRevealHideTimerRef.current);
  }, []);

  // --- 核心逻辑：资质校验 ---
  const checkQualifications = (targetRank: string) => {
    // 基础校验：必须满16岁
    if ((user.age || 0) < 16) return false; 
    
    const pScore = getScore(user.physicalRank);
    const mScore = getScore(user.mentalRank);
    
    if (targetRank === ROLES.MEMBER) return true; // 成员不限等级
    if (targetRank === ROLES.MASTER) return mScore >= RANK_SCORES['S+'] && pScore >= RANK_SCORES['S+'];
    return false;
  };

  // --- 核心逻辑：入职/晋升 ---
  const handleJoinOrPromote = async (targetJobName: string) => {
    let jobName = targetJobName;
    const age = user.age || 0;

    try {
      // 1. 未分化拦截
      if (age < 16) {
        return showToast("未分化的小鬼？滚回圣所去喝奶吧！");
      }

      // 2. 16-19岁学生拦截 (恶魔会虽然混乱，但系统规则依然生效)
      if (age >= 16 && age <= 19) {
        const confirmMessage = "还没从塔里毕业就想来混社会？选【否】滚回学校，选【是】你就只能当个底层小弟。";
        if (!window.confirm(confirmMessage)) {
          showToast("切，胆小鬼。");
          onExit();
          return;
        } else {
          // 强制降级逻辑
          if (jobName !== ROLES.MEMBER) {
            showToast(`小屁孩还想当老大？先从 ${ROLES.MEMBER} 做起吧！`);
            jobName = ROLES.MEMBER;
          }
        }
      }

      // 3. 资质校验
      if (!checkQualifications(jobName)) {
        return showToast(`你太弱了！${jobName} 需要更强的力量。`);
      }

      // 4. 发送请求
      const res = await fetch('/api/tower/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, jobName })
      });
      
      const data = await res.json();
      if (data.success) {
        showToast(`哈哈！欢迎加入狂欢，${jobName}！去给守塔会那帮人一点颜色瞧瞧！`);
        fetchGlobalData();
      } else {
        showToast(data.message || '操作失败');
      }
    } catch (e) {
      console.error(e);
      showToast("网络连接断开...这就是无政府主义的代价吗？");
    }
  };

  // --- 核心逻辑：捣乱打工 ---
  const handleRiot = async () => {
    if ((user.workCount || 0) >= 3) return showToast("闹够了，稍微歇会儿，明天继续！");

    const res = await fetch('/api/tower/work', { 
      method: 'POST', 
      headers: { 'Content-Type': 'application/json' }, 
      body: JSON.stringify({ userId: user.id })
    });
    const data = await res.json();

    if (data.success) {
      setIsRioting(true);
      setTimeout(() => setIsRioting(false), 2500);

      const events = [
        "在守塔会的墙上画了个巨大的鬼脸。",
        "偷走了行政中心的一箱文件（虽然看不懂）。",
        "在广场上放了一把火，看着他们手忙脚乱。",
        "无意中帮命之塔清理了一只异鬼（虽然本意只是想炸山）。"
      ];
      const evt = events[Math.floor(Math.random() * events.length)];
      
      showToast(`${evt} (战利品 +${data.reward}G)`);
      fetchGlobalData();
    }
  };

  // --- 核心逻辑：赌场小游戏 ---
  const startMiniGame = () => {
    if ((user.trainCount || 0) >= 3) return showToast("今天输得够多了，精神已到极限！");
    setMiniGame({ active: true, clicks: 0, timeLeft: 10 });
  };

  const handleMiniGameOver = async () => {
    setMiniGame(prev => ({ ...prev, active: false }));
    if (miniGame.clicks >= 30) {
      const res = await fetch('/api/training/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id })
      });
      if (res.ok) {
        showToast(`对赌胜利！抗压能力提升，精神力得到锻炼。`);
        fetchGlobalData();
      }
    } else {
      showToast(`对赌失败，仅狂点 ${miniGame.clicks}/30 次，底裤都输光了！`);
    }
  };

  // --- 核心逻辑：信息系技能学习 ---
  const fetchSkills = async () => {
    try {
      const res = await fetch(`/api/skills/available/${user.id}`);
      const data = await res.json();
      if (data.success) setInfoSkills(data.skills.filter((s:any) => s.faction === '信息系'));
    } catch (e) { console.error(e); }
  };

  const learnSkill = async (skillName: string) => {
    const res = await fetch(`/api/users/${user.id}/skills`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: skillName })
    });
    if (res.ok) showToast(`成功窃取情报网权限：${skillName}`);
  };

  const clearDiceRevealTimers = () => {
    if (diceRevealTimerRef.current) clearTimeout(diceRevealTimerRef.current);
    if (diceRevealHideTimerRef.current) clearTimeout(diceRevealHideTimerRef.current);
    diceRevealTimerRef.current = null;
    diceRevealHideTimerRef.current = null;
  };

  const buildGambleEventKey = (row: Partial<DemonGambleRequest> | null | undefined) => {
    return `${Number(row?.id || 0)}:${String(row?.status || '')}:${String(row?.updatedAt || '')}`;
  };

  const launchDiceReveal = (payload: Omit<DiceRevealState, 'visible' | 'phase'>) => {
    clearDiceRevealTimers();
    setDiceReveal({ ...payload, visible: true, phase: 'rolling' });
    diceRevealTimerRef.current = setTimeout(() => {
      setDiceReveal((prev) => ({ ...prev, phase: 'result' }));
      diceRevealHideTimerRef.current = setTimeout(() => {
        setDiceReveal((prev) => ({ ...prev, visible: false }));
      }, 1800);
    }, 1300);
  };

  const openSoloDiceReveal = (amount: number, guess: 'big' | 'small', data: any) => {
    const roll = Math.max(1, Number(data?.roll || 1));
    const isWin = Boolean(data?.isWin);
    launchDiceReveal({
      mode: 'solo',
      accent: 'amber',
      title: 'Roll Dice',
      subtitle: `Bet ${amount}G ? You picked ${guess === 'big' ? 'Big' : 'Small'}`,
      soloRoll: roll,
      challengerRoll: 1,
      targetRoll: 1,
      resultText: isWin ? `Dice landed on ${roll}. You won ${amount}G.` : `Dice landed on ${roll}. You lost ${amount}G.`
    });
  };

  const openPvpDiceReveal = (request: DemonGambleRequest | null | undefined) => {
    if (!request) return;
    const amount = Math.max(1, Number(request.amount || 0));
    const challengerName = String(request.challengerName || 'Player A');
    const targetName = String(request.targetName || 'Player B');
    const didWin = Number(request.winnerId || 0) === Number(user.id || 0);
    const winnerName = didWin
      ? 'You'
      : Number(request.winnerId || 0) === Number(request.challengerId || 0)
        ? challengerName
        : targetName;
    launchDiceReveal({
      mode: 'pvp',
      accent: 'rose',
      title: 'PVP Dice Duel',
      subtitle: `${challengerName} vs ${targetName} ? ${amount}G`,
      soloRoll: 1,
      challengerRoll: Math.max(1, Number(request.challengerRoll || 1)),
      targetRoll: Math.max(1, Number(request.targetRoll || 1)),
      resultText: didWin ? `You won ${amount}G.` : `${winnerName} won ${amount}G.`
    });
  };

  const processRecentGambleEvents = (rows: DemonGambleRequest[]) => {
    const list = Array.isArray(rows) ? rows : [];
    if (!demonGambleBootstrappedRef.current) {
      list.forEach((row) => seenGambleEventKeysRef.current.add(buildGambleEventKey(row)));
      demonGambleBootstrappedRef.current = true;
      return;
    }

    let shouldRefreshGlobal = false;
    [...list].reverse().forEach((row) => {
      const key = buildGambleEventKey(row);
      if (seenGambleEventKeysRef.current.has(key)) return;
      seenGambleEventKeysRef.current.add(key);

      if (String(row.status || '') === 'resolved') {
        openPvpDiceReveal(row);
        shouldRefreshGlobal = true;
        return;
      }

      if (String(row.status || '') === 'rejected') {
        if (Number(row.challengerId || 0) === Number(user.id || 0)) {
          showToast(`${String(row.targetName || 'The other player')} rejected your bet request`);
        } else {
          showToast(`You rejected ${String(row.challengerName || 'the challenger')}`);
        }
        return;
      }

      if (String(row.status || '') === 'cancelled') {
        showToast('The bet request was cancelled because one side can no longer start the game');
      }
    });

    if (shouldRefreshGlobal) fetchGlobalData();
  };

  const fetchDemonState = async () => {
    try {
      const res = await fetch(`/api/demon/state?userId=${user.id}`, { cache: 'no-store' });
      const data = await res.json().catch(() => ({} as any));
      if (!res.ok || data.success === false) return;
      setDemonDailySkill({
        max: Number(data.dailySkill?.max || 3),
        used: Number(data.dailySkill?.used || 0),
        remaining: Number(data.dailySkill?.remaining || 0),
        isDemonMember: Boolean(data.isDemonMember)
      });
      setDemonCasinoGold(Number(data.gold || 0));
      const nearby = Array.isArray(data.nearbyPlayers) ? data.nearbyPlayers : [];
      setDemonNearbyPlayers(nearby);
      const incoming = Array.isArray(data.incomingGambleRequests) ? data.incomingGambleRequests : [];
      const outgoing = Array.isArray(data.outgoingGambleRequests) ? data.outgoingGambleRequests : [];
      setIncomingGambleRequests(incoming);
      setOutgoingGambleRequests(outgoing);
      processRecentGambleEvents(Array.isArray(data.recentGambleEvents) ? data.recentGambleEvents : []);
      if (!nearby.some((x: any) => Number(x.id || 0) === Number(pvpTargetId || 0))) {
        setPvpTargetId(nearby.length > 0 ? Number(nearby[0].id || 0) : 0);
      }
    } catch {
      // ignore demon state poll failures
    }
  };

  const fetchBlackmarketState = async () => {
    try {
      const res = await fetch(`/api/demon/blackmarket/shop?userId=${user.id}`, { cache: 'no-store' });
      const data = await res.json().catch(() => ({} as any));
      if (!res.ok || data.success === false) return;
      setBlackmarketNpc(data.npc || null);
      setBlackmarketCanTrade(Boolean(data.canTrade));
      setBlackmarketOffers(Array.isArray(data.offers) ? data.offers : []);
    } catch {
      // ignore
    }
  };

  const handleSoloGamble = async () => {
    const amount = Math.max(1, Math.trunc(Number(soloBetAmount || 0)));
    setCasinoBusy(true);
    try {
      const res = await fetch('/api/demon/gamble/solo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          amount,
          guess: soloGuess
        })
      });
      const data = await res.json().catch(() => ({} as any));
      if (!res.ok || data.success === false) {
        showToast(data.message || 'Solo bet failed');
        return;
      }
      openSoloDiceReveal(amount, soloGuess, data);
      fetchGlobalData();
      fetchDemonState();
    } catch {
      showToast('Network error while rolling the dice');
    } finally {
      setCasinoBusy(false);
    }
  };

  const handlePvpGamble = async () => {
    const amount = Math.max(1, Math.trunc(Number(pvpBetAmount || 0)));
    const targetId = Number(pvpTargetId || 0);
    if (!targetId) {
      showToast('Pick a player first');
      return;
    }
    setCasinoBusy(true);
    try {
      const res = await fetch('/api/demon/gamble/pvp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          challengerId: user.id,
          targetId,
          amount
        })
      });
      const data = await res.json().catch(() => ({} as any));
      if (!res.ok || data.success === false) {
        showToast(data.message || 'Failed to send the PVP bet request');
        return;
      }
      showToast(data.message || 'Bet request sent');
      fetchDemonState();
    } catch {
      showToast('Network error while sending the PVP bet request');
    } finally {
      setCasinoBusy(false);
    }
  };

  const handleRespondPvpGamble = async (requestId: number, accept: boolean) => {
    if (!requestId) return;
    setCasinoBusy(true);
    try {
      const res = await fetch(`/api/demon/gamble/request/${requestId}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          accept
        })
      });
      const data = await res.json().catch(() => ({} as any));
      if (!res.ok || data.success === false) {
        showToast(data.message || 'Failed to handle the PVP bet request');
        fetchDemonState();
        return;
      }

      const request = data.request as DemonGambleRequest | undefined;
      if (request) {
        seenGambleEventKeysRef.current.add(buildGambleEventKey(request));
      }

      if (accept && request?.status === 'resolved') {
        openPvpDiceReveal(request);
        fetchGlobalData();
      } else {
        showToast(data.message || (accept ? 'Request accepted' : 'Request rejected'));
      }

      fetchDemonState();
    } catch {
      showToast('Network error while handling the PVP bet request');
    } finally {
      setCasinoBusy(false);
    }
  };

  const handleBuyBlackmarketItem = async (itemId: number, itemName: string) => {
    if (!itemId) return;
    if (!blackmarketCanTrade) {
      showToast('你当前不在恶魔会，无法进行黑市交易。');
      return;
    }
    setCasinoBusy(true);
    try {
      const res = await fetch('/api/demon/blackmarket/buy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          itemId,
          qty: 1
        })
      });
      const data = await res.json().catch(() => ({} as any));
      if (!res.ok || data.success === false) {
        showToast(data.message || `购买 ${itemName} 失败`);
        return;
      }
      showToast(data.message || `已购买 ${itemName}`);
      fetchGlobalData();
      fetchDemonState();
      fetchBlackmarketState();
    } catch {
      showToast('网络异常，黑市交易失败');
    } finally {
      setCasinoBusy(false);
    }
  };

  const handleDailyContrabandDrop = async () => {
    if (!canUseDemonSkill) {
      showToast('只有恶魔会成员才可开启黑箱。');
      return;
    }
    try {
      const res = await fetch('/api/demon/skill/daily-random', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id })
      });
      const data = await res.json().catch(() => ({} as any));
      if (!res.ok || data.success === false) {
        showToast(data.message || '黑箱开启失败');
        return;
      }
      showToast(data.message || '你获得了新的违禁品。');
      fetchGlobalData();
      fetchDemonState();
    } catch (e) {
      console.error(e);
      showToast('黑箱网络波动，请稍后再试。');
    }
  };

  // --- 鬼魂休息 ---
  const handleGhostRest = async () => {
    if (user.status !== 'ghost' && !isDemon) return showToast("阴气太重，你受不了的。");
    const res = await fetch('/api/tower/rest', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: user.id }) });
    if (res.ok) {
      showToast("在阴冷的洞穴里睡了一觉，精神百倍。");
      fetchGlobalData();
    }
  };

  return (
    <div className="absolute inset-0 bg-stone-950 overflow-hidden font-sans select-none text-stone-300">
      
      {/* 1. 背景层：统一 public 图片逻辑 */}
      <div className="absolute inset-0 z-0">
        <img 
          src="/恶魔会.jpg" 
          className="w-full h-full object-cover opacity-50 grayscale-[30%] contrast-125"
          alt="Demon Society"
        />
        {/* 混乱滤镜：红色/紫色调混合 */}
        <div className="absolute inset-0 bg-gradient-to-br from-red-950/40 via-stone-950/60 to-purple-950/40 mix-blend-multiply pointer-events-none" />
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-10 mix-blend-overlay pointer-events-none" />
      </div>

      {/* 2. 顶部导航 */}
      <div className="absolute top-6 left-6 z-50">
        <button 
          onClick={onExit} 
          className="bg-black/80 backdrop-blur-sm text-red-500 border-2 border-red-800/50 px-6 py-2 rounded-sm font-black shadow-[0_0_15px_rgba(220,38,38,0.3)] flex items-center gap-2 hover:bg-red-900/20 hover:scale-105 transition-all -skew-x-12 active:skew-x-0"
        >
          <ArrowLeft size={18}/> <span className="skew-x-12">溜了溜了</span>
        </button>
      </div>

      {/* 3. 建筑交互点 */}
      <div className="relative z-10 w-full h-full">
        {buildings.map(b => (
          <div 
            key={b.id} 
            className="absolute transform -translate-x-1/2 -translate-y-1/2 z-10 cursor-pointer group touch-manipulation"
            style={{ left: `${b.x}%`, top: `${b.y}%` }}
            onClick={() => setSelectedBuilding(b)}
          >
            <div className="flex flex-col items-center">
              {/* 涂鸦风格图标 */}
              <div className="w-16 h-16 md:w-20 md:h-20 bg-stone-900/90 border-4 border-stone-700 shadow-2xl flex items-center justify-center text-stone-400 group-hover:scale-110 group-hover:border-red-600 group-hover:text-red-500 transition-all rounded-full z-10 relative overflow-hidden">
                 {/* 装饰性涂鸦 */}
                 <div className="absolute top-1 right-2 text-red-600 opacity-0 group-hover:opacity-100 font-black text-xs rotate-12 transition-opacity">乱涂</div>
                 <div className="absolute bottom-1 left-2 text-red-600 opacity-0 group-hover:opacity-100 font-black text-xs -rotate-12 transition-opacity">!!!</div>
                {React.cloneElement(b.icon as React.ReactElement, { size: 32 })}
              </div>
              <div className="mt-2 bg-black/90 text-red-500 text-[10px] md:text-xs font-black px-3 py-1 transform -rotate-2 border border-red-900 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity whitespace-nowrap shadow-lg">
                {b.name}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 4. 搞事特效 (全屏覆盖) */}
      <AnimatePresence>
        {isRioting && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none bg-red-900/20 backdrop-blur-[2px]"
          >
             <div className="text-center transform rotate-6">
                <Flame size={120} className="mx-auto text-red-600 animate-pulse drop-shadow-[0_0_25px_rgba(220,38,38,0.8)]"/>
                <h2 className="text-6xl md:text-8xl font-black text-red-500 stroke-black drop-shadow-xl tracking-tighter" style={{ WebkitTextStroke: '2px black' }}>
                  混乱万岁!!
                </h2>
             </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 5. 建筑详情弹窗 */}
      <AnimatePresence>
        {selectedBuilding && (
          <>
            {/* 遮罩 */}
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setSelectedBuilding(null)}
              className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40"
            />

            {/* 弹窗本体 - 朋克风格卡片 */}
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, rotate: -2 }} 
              animate={{ scale: 1, opacity: 1, rotate: -1 }} 
              exit={{ scale: 0.9, opacity: 0, rotate: 2 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
            >
              <div className="bg-[#1c1917] w-full max-w-lg shadow-[0_0_50px_rgba(220,38,38,0.2)] relative border-4 border-red-900/50 p-1 flex flex-col max-h-[85vh] pointer-events-auto">
                {/* 顶部胶带效果 */}
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-32 h-8 bg-stone-300/80 rotate-2 shadow-md z-20" />
                
                {/* 关闭按钮 */}
                <button onClick={() => setSelectedBuilding(null)} className="absolute top-4 right-4 text-stone-500 hover:text-red-500 transition-colors z-20 bg-black/50 p-1 rounded">
                  <X size={28} strokeWidth={3}/>
                </button>

                {/* 内容容器 */}
                <div className="p-6 md:p-8 bg-[url('https://www.transparenttextures.com/patterns/black-felt.png')] overflow-y-auto custom-scrollbar flex-1 border border-stone-800 relative">
                  
                  {/* 标题栏 */}
                  <div className="flex items-center gap-5 mb-8 border-b-4 border-dashed border-stone-800 pb-6">
                    <div className="p-4 bg-stone-900 rounded-full text-red-600 border-2 border-stone-700 shadow-inner">
                      {React.cloneElement(selectedBuilding.icon, { size: 36 })}
                    </div>
                    <div>
                      <h2 className="text-3xl font-black text-red-600 uppercase tracking-tighter drop-shadow-md" style={{ textShadow: '2px 2px 0px #000' }}>
                        {selectedBuilding.name}
                      </h2>
                      <p className="text-xs text-stone-500 font-bold mt-1 font-mono tracking-wide">{selectedBuilding.desc}</p>
                    </div>
                  </div>

                  {/* === 集会所：入职/晋升 === */}
                  {selectedBuilding.id === 'hall' && (
                    <div className="space-y-6">
                      {!isDemon ? (
                        <>
                          <div className="p-4 bg-red-950/30 border-l-4 border-red-600 text-sm text-red-400 font-bold mb-6 italic">
                            “受够了守塔会那帮伪君子？来这里！我们才不管什么规矩，只要你敢闹，我们就是兄弟！”
                          </div>
                          <div className="space-y-4">
                            <JoinBtn 
                              title="加入恶魔会 (成员)" sub="只要满16岁，够胆你就来" 
                              qualified={checkQualifications(ROLES.MEMBER)}
                              onClick={() => handleJoinOrPromote(ROLES.MEMBER)}
                            />
                            <JoinBtn 
                              title="篡位夺权 (会长)" sub="需 神S+ 体S+ 碾压一切" 
                              qualified={checkQualifications(ROLES.MASTER)}
                              onClick={() => handleJoinOrPromote(ROLES.MASTER)}
                            />
                          </div>
                        </>
                      ) : (
                        <div className="space-y-4">
                          <div className="text-center p-6 border-2 border-dashed border-stone-800 bg-black/40">
                             <h3 className="text-xl font-black text-stone-200 mb-2">当前身份：<span className="text-red-500 underline decoration-wavy">{user.job}</span></h3>
                             <p className="text-stone-500 text-sm mb-6">
                               今天打算去哪里捣乱？记得别被抓进监狱重造了。
                             </p>

                             {user.job === ROLES.MEMBER && (
                               <button onClick={() => handleJoinOrPromote(ROLES.MASTER)} className="w-full py-4 mb-4 bg-red-900/40 text-red-400 font-black border border-red-800 hover:bg-red-800 hover:text-white transition-colors uppercase tracking-widest">
                                 篡位 (夺取会长之位)
                               </button>
                             )}

                             <button 
                               onClick={() => { if(confirm("这就怂了？想退会？")) fetch('/api/tower/quit', { method:'POST', body:JSON.stringify({userId:user.id}), headers:{'Content-Type':'application/json'}}).then(() => {showToast("切，胆小鬼。"); fetchGlobalData(); setSelectedBuilding(null);}) }}
                               className="text-xs text-stone-600 hover:text-stone-400 underline decoration-dashed"
                             >
                               我不玩了 / 退出恶魔会
                             </button>
                          </div>
                          <FactionMemberPanel
                            user={user}
                            locationId="demon_society"
                            showToast={showToast}
                            fetchGlobalData={fetchGlobalData}
                            title="恶魔会职位房间"
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {/* === 狂欢赌场 & 信息系技能 === */}
                  {selectedBuilding.id === 'casino' && (
                    <div className="space-y-8">
                      <div className="text-left bg-black/50 p-5 border border-yellow-800/40 rounded-sm">
                        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                          <div>
                            <h4 className="text-sm font-black text-yellow-300 uppercase tracking-wide">Casino main desk</h4>
                            <p className="text-[11px] text-yellow-100/80 mt-1">Current chips: {Math.max(0, Number(demonCasinoGold || 0))}G</p>
                          </div>
                          {hasPendingPvpRequest && (
                            <span className="px-3 py-1 rounded-full bg-rose-900/40 border border-rose-600/40 text-[10px] font-black uppercase tracking-[0.2em] text-rose-200">
                              Pending duel
                            </span>
                          )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="p-3 border border-yellow-800/40 rounded bg-yellow-900/10 space-y-3">
                            <p className="text-[11px] text-yellow-200 font-bold uppercase tracking-wide">Big / Small</p>
                            <input
                              type="number"
                              min={1}
                              value={soloBetAmount}
                              onChange={(e) => setSoloBetAmount(Number(e.target.value || 1))}
                              className="w-full bg-stone-900 border border-stone-700 rounded px-3 py-2 text-xs text-stone-100"
                            />
                            <div className="grid grid-cols-2 gap-2">
                              <button
                                onClick={() => setSoloGuess('big')}
                                className={`${soloGuess === 'big' ? 'bg-yellow-600 text-black border-yellow-300' : 'bg-stone-900 text-stone-300 border-stone-700'} py-2 text-xs font-black rounded border`}
                              >
                                Big (4-6)
                              </button>
                              <button
                                onClick={() => setSoloGuess('small')}
                                className={`${soloGuess === 'small' ? 'bg-yellow-600 text-black border-yellow-300' : 'bg-stone-900 text-stone-300 border-stone-700'} py-2 text-xs font-black rounded border`}
                              >
                                Small (1-3)
                              </button>
                            </div>
                            <button
                              onClick={handleSoloGamble}
                              disabled={casinoBusy}
                              className="w-full py-2 bg-yellow-700 text-black text-xs font-black rounded hover:bg-yellow-600 disabled:opacity-60"
                            >
                              Roll now
                            </button>
                          </div>

                          <div className="p-3 border border-rose-800/40 rounded bg-rose-900/10 space-y-3">
                            <p className="text-[11px] text-rose-200 font-bold uppercase tracking-wide">PVP bet request</p>
                            <select
                              value={pvpTargetId}
                              onChange={(e) => setPvpTargetId(Number(e.target.value || 0))}
                              className="w-full bg-stone-900 border border-stone-700 rounded px-3 py-2 text-xs text-stone-100"
                            >
                              <option value={0}>Pick a nearby player</option>
                              {demonNearbyPlayers.map((p: any) => (
                                <option key={`demon-pvp-${p.id}`} value={Number(p.id || 0)}>
                                  {String(p.name || `Player#${p.id}`)} / {Math.max(0, Number(p.gold || 0))}G
                                </option>
                              ))}
                            </select>
                            <input
                              type="number"
                              min={1}
                              value={pvpBetAmount}
                              onChange={(e) => setPvpBetAmount(Number(e.target.value || 1))}
                              className="w-full bg-stone-900 border border-stone-700 rounded px-3 py-2 text-xs text-stone-100"
                            />
                            <button
                              onClick={handlePvpGamble}
                              disabled={casinoBusy || hasPendingPvpRequest}
                              className="w-full py-2 bg-rose-700 text-white text-xs font-black rounded hover:bg-rose-600 disabled:opacity-60"
                            >
                              Send request
                            </button>
                            {demonNearbyPlayers.length === 0 && (
                              <p className="text-[10px] text-stone-400">No nearby players in the casino.</p>
                            )}
                            {hasPendingPvpRequest && (
                              <p className="text-[10px] text-rose-100/80">Finish the current request before sending another duel.</p>
                            )}
                          </div>
                        </div>

                        {(incomingGambleRequests.length > 0 || outgoingGambleRequests.length > 0) && (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                            <div className="p-3 rounded border border-emerald-700/40 bg-emerald-950/20 space-y-2">
                              <p className="text-[11px] font-black uppercase tracking-wide text-emerald-200">Incoming requests</p>
                              {incomingGambleRequests.length === 0 ? (
                                <p className="text-[10px] text-stone-400">No one is challenging you right now.</p>
                              ) : (
                                incomingGambleRequests.map((row) => (
                                  <div key={`incoming-gamble-${row.id}`} className="rounded border border-emerald-800/30 bg-black/30 p-3 space-y-2">
                                    <div>
                                      <div className="text-xs font-black text-stone-100">{row.challengerName || 'Unknown player'}</div>
                                      <div className="text-[10px] text-stone-400 mt-1">Bet amount: {Math.max(1, Number(row.amount || 0))}G</div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                      <button
                                        onClick={() => handleRespondPvpGamble(Number(row.id || 0), true)}
                                        disabled={casinoBusy}
                                        className="py-2 rounded bg-emerald-600 text-black text-[11px] font-black hover:bg-emerald-500 disabled:opacity-60"
                                      >
                                        Accept
                                      </button>
                                      <button
                                        onClick={() => handleRespondPvpGamble(Number(row.id || 0), false)}
                                        disabled={casinoBusy}
                                        className="py-2 rounded bg-stone-800 text-stone-100 text-[11px] font-black hover:bg-stone-700 disabled:opacity-60"
                                      >
                                        Reject
                                      </button>
                                    </div>
                                  </div>
                                ))
                              )}
                            </div>

                            <div className="p-3 rounded border border-sky-700/40 bg-sky-950/20 space-y-2">
                              <p className="text-[11px] font-black uppercase tracking-wide text-sky-200">Outgoing requests</p>
                              {outgoingGambleRequests.length === 0 ? (
                                <p className="text-[10px] text-stone-400">You have no pending duel request.</p>
                              ) : (
                                outgoingGambleRequests.map((row) => (
                                  <div key={`outgoing-gamble-${row.id}`} className="rounded border border-sky-800/30 bg-black/30 p-3">
                                    <div className="text-xs font-black text-stone-100">Waiting for {row.targetName || 'the other player'}</div>
                                    <div className="text-[10px] text-stone-400 mt-1">Bet amount: {Math.max(1, Number(row.amount || 0))}G</div>
                                  </div>
                                ))
                              )}
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="text-center bg-stone-900/80 p-6 border border-yellow-900/30 rounded-sm shadow-inner">
                        <Dices size={48} className="mx-auto text-yellow-600 mb-4 animate-bounce"/>
                        <h3 className="text-xl font-black text-stone-200 mb-2">恶魔对赌</h3>
                        <p className="text-xs text-stone-500 mb-6 font-mono">
                          // 精神特训：在10秒内狂点30次 //
                        </p>
                        
                        {!miniGame.active ? (
                          <button onClick={startMiniGame} className="w-full py-4 bg-yellow-700 text-black font-black text-lg hover:bg-yellow-500 transition-all skew-x-[-10deg] shadow-[5px_5px_0px_rgba(0,0,0,0.5)] active:shadow-none active:translate-x-[5px] active:translate-y-[5px]">
                            开始狂欢赌局！
                          </button>
                        ) : (
                          <div className="p-6 border-2 border-yellow-600 bg-yellow-900/20">
                            <p className="text-4xl font-black text-yellow-500 mb-2 font-mono">{miniGame.timeLeft}s</p>
                            <p className="text-sm text-yellow-200/80 mb-6">已摇骰: {miniGame.clicks}/30 次</p>
                            <button 
                              onClick={() => setMiniGame(p => ({ ...p, clicks: p.clicks + 1 }))} 
                              className="w-full py-8 bg-yellow-600 active:bg-yellow-400 text-black font-black text-2xl shadow-[0_6px_0_rgb(161,98,7)] active:shadow-none active:translate-y-[6px] transition-all touch-manipulation"
                            >
                              疯狂摇骰！
                            </button>
                          </div>
                        )}
                      </div>

                      <div className="bg-rose-950/20 p-5 border border-rose-800/50 rounded-sm">
                        <h4 className="text-sm font-black text-rose-300 uppercase tracking-wide mb-2">恶魔会成员黑箱 · 违禁品</h4>
                        <p className="text-[11px] text-rose-200/80 mb-4">
                          每日 {demonDailySkill.max} 次随机掉落，优先产出违禁品。
                          剩余次数：{Math.max(0, demonDailySkill.remaining)}
                        </p>
                        <button
                          onClick={handleDailyContrabandDrop}
                          disabled={!canUseDemonSkill || demonDailySkill.remaining <= 0}
                          className="w-full py-3 bg-rose-700 text-white font-black text-sm border border-rose-500 hover:bg-rose-600 disabled:bg-stone-800 disabled:text-stone-500 disabled:border-stone-700 transition-all"
                        >
                          {canUseDemonSkill ? `开启黑箱 (${Math.max(0, demonDailySkill.remaining)} 次)` : '仅恶魔会成员可用'}
                        </button>
                      </div>

                      <div className="bg-red-950/20 p-5 border border-red-800/50 rounded-sm">
                        <h4 className="text-sm font-black text-red-300 uppercase tracking-wide mb-2">
                          恶劣黑市角色 · {String(blackmarketNpc?.name || '“烂牙”维克')}
                        </h4>
                        <p className="text-[11px] text-red-200/80 mb-4">
                          {String(blackmarketNpc?.persona || '脾气恶劣，开口就骂人。')}
                          {' '}这里只卖违禁品，售价固定为正常价格的 5 倍。
                        </p>
                        {!blackmarketCanTrade && (
                          <p className="text-[11px] text-amber-300 mb-3">你当前不在恶魔会交易状态，仅可浏览货单。</p>
                        )}
                        {blackmarketOffers.length === 0 ? (
                          <div className="text-[11px] text-stone-500">黑市暂时没货，稍后再来。</div>
                        ) : (
                          <div className="space-y-2">
                            {blackmarketOffers.map((it: any) => (
                              <div key={`blackmarket-${it.id}`} className="border border-red-900/40 bg-black/40 rounded p-3">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <div className="text-xs font-black text-red-200 truncate">{it.name}</div>
                                    <div className="text-[10px] text-red-300/70 mt-1 line-clamp-2">{it.description || '无描述'}</div>
                                    <div className="text-[10px] text-stone-400 mt-1">
                                      阶位：{it.tier || '低阶'} · 正常价 {Math.max(1, Number(it.basePrice || 0))}G
                                    </div>
                                  </div>
                                  <button
                                    onClick={() => handleBuyBlackmarketItem(Number(it.id || 0), String(it.name || '违禁品'))}
                                    disabled={!blackmarketCanTrade || casinoBusy}
                                    className="shrink-0 px-3 py-2 bg-red-700 text-white text-[11px] font-black rounded hover:bg-red-600 disabled:opacity-60"
                                  >
                                    买入 {Math.max(1, Number(it.sellPrice || 0))}G
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="border-t-2 border-dashed border-stone-800 pt-6">
                        <h4 className="text-sm font-black text-sky-500 mb-4 flex items-center gap-2 uppercase tracking-wide">
                          <Zap size={18}/> 黑市情报网 (技能)
                        </h4>
                        {infoSkills.length === 0 ? (
                          <div className="text-center py-6 bg-stone-900/50 text-stone-600 font-bold text-xs border border-stone-800 dashed">当前没有流通的信息系技能书。</div>
                        ) : (
                          <div className="space-y-3">
                            {infoSkills.map(skill => (
                              <div key={skill.id} className="flex justify-between items-center p-4 bg-black/60 border border-stone-800 hover:border-sky-800 transition-colors group">
                                <div>
                                  <p className="font-bold text-stone-300 text-sm group-hover:text-sky-400">{skill.name}</p>
                                  <p className="text-[10px] text-stone-600 mt-1">{skill.description}</p>
                                </div>
                                <button onClick={() => learnSkill(skill.name)} className="bg-sky-900/30 text-sky-500 border border-sky-900 px-4 py-2 text-xs font-bold hover:bg-sky-500 hover:text-black transition-colors">
                                  窃取
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* === 策划室：搞事 === */}
                  {selectedBuilding.id === 'strategy' && (
                    <div className="text-center space-y-6">
                      <div className="relative inline-block p-4 border-2 border-stone-800 bg-stone-900 rounded-full">
                         <Flag size={48} className="text-stone-500"/>
                         <Ban size={24} className="absolute -bottom-2 -right-2 text-red-600 bg-black rounded-full border border-red-900"/>
                      </div>
                      <h3 className="text-lg font-black text-stone-200">推翻守塔会计划书 (草稿)</h3>
                      
                      {isDemon ? (
                        <button 
                          onClick={handleRiot}
                          disabled={(user.workCount || 0) >= 3}
                          className="w-full py-5 bg-stone-800 text-red-500 font-black hover:bg-stone-700 disabled:bg-stone-900 disabled:text-stone-700 transition-all border-2 border-stone-700 hover:border-red-600 uppercase tracking-widest text-lg"
                        >
                          执行捣乱计划 ({3 - (user.workCount || 0)}/3)
                        </button>
                      ) : (
                        <div className="text-stone-500 text-xs font-mono border border-stone-800 p-4 bg-black/50 italic">
                          * 你看到一群人在地图上画满了红叉，但他们警惕地盯着你，不让你靠近。 *
                        </div>
                      )}
                    </div>
                  )}

                  {/* === 幽魂休憩地 === */}
                  {selectedBuilding.id === 'cave' && (
                    <div className="space-y-6">
                      <div className="bg-blue-950/20 p-4 border border-blue-900/30 text-center">
                        <Ghost size={32} className="mx-auto text-blue-500/50 mb-2"/>
                        <p className="text-xs text-blue-300/80 italic">
                          “这里阴冷刺骨，但对于那些没有实体的灵魂来说，这里是唯一的家。”
                        </p>
                      </div>
                      
                      {user.status === 'ghost' ? (
                         <button onClick={handleGhostRest} className="w-full py-5 bg-blue-900/40 text-blue-300 font-bold border border-blue-800 hover:bg-blue-900/60 transition-all text-lg tracking-widest shadow-[0_0_20px_rgba(30,58,138,0.2)]">
                           吸收阴气 (鬼魂回复)
                         </button>
                      ) : (
                         <button onClick={handleGhostRest} className="w-full py-4 bg-stone-900 text-stone-500 font-bold hover:text-stone-300 transition-all border border-stone-800 hover:border-stone-600">
                           在此休息 (可能会感冒)
                         </button>
                      )}
                    </div>
                  )}

                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {diceReveal.visible && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                clearDiceRevealTimers();
                setDiceReveal((prev) => ({ ...prev, visible: false }));
              }}
              className="fixed inset-0 z-[70] bg-black/70 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 18 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 18 }}
              className="fixed inset-0 z-[80] flex items-center justify-center p-4 pointer-events-none"
            >
              <div className={`w-full max-w-md rounded-2xl border bg-stone-950/95 px-6 py-7 text-center shadow-[0_0_45px_rgba(0,0,0,0.55)] pointer-events-auto ${diceReveal.accent === 'rose' ? 'border-rose-500/60 text-rose-100' : 'border-yellow-500/60 text-yellow-100'}`}>
                <motion.div
                  animate={diceReveal.phase === 'rolling' ? { rotate: [0, 180, 360], scale: [1, 1.08, 1] } : { rotate: 0, scale: 1 }}
                  transition={diceReveal.phase === 'rolling' ? { duration: 0.7, repeat: Infinity, ease: 'linear' } : { duration: 0.2 }}
                  className={`mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full border ${diceReveal.accent === 'rose' ? 'border-rose-400/60 bg-rose-950/40 text-rose-300' : 'border-yellow-400/60 bg-yellow-950/40 text-yellow-300'}`}
                >
                  <Dices size={50} />
                </motion.div>

                <h3 className="text-2xl font-black uppercase tracking-wide">{diceReveal.title}</h3>
                <p className="mt-2 text-xs text-stone-400 uppercase tracking-[0.25em]">{diceReveal.subtitle}</p>

                {diceReveal.mode === 'solo' ? (
                  <div className="mt-6 rounded-2xl border border-white/10 bg-black/30 px-4 py-5">
                    <div className="text-[10px] font-black uppercase tracking-[0.35em] text-stone-400">Dice</div>
                    <div className="mt-3 text-5xl font-black text-white">{diceReveal.phase === 'rolling' ? '?' : diceReveal.soloRoll}</div>
                  </div>
                ) : (
                  <div className="mt-6 grid grid-cols-2 gap-3">
                    <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-5">
                      <div className="text-[10px] font-black uppercase tracking-[0.25em] text-stone-400">Challenger</div>
                      <div className="mt-3 text-4xl font-black text-white">{diceReveal.phase === 'rolling' ? '?' : diceReveal.challengerRoll}</div>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-5">
                      <div className="text-[10px] font-black uppercase tracking-[0.25em] text-stone-400">Target</div>
                      <div className="mt-3 text-4xl font-black text-white">{diceReveal.phase === 'rolling' ? '?' : diceReveal.targetRoll}</div>
                    </div>
                  </div>
                )}

                <p className="mt-5 text-sm font-black text-white">
                  {diceReveal.phase === 'rolling' ? 'Rolling...' : diceReveal.resultText}
                </p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

// 子组件
function JoinBtn({ title, sub, qualified, onClick }: any) {
  return (
    <button 
      onClick={onClick} 
      // disabled={!qualified} // 允许点击以查看具体拒绝原因
      className={`border-2 p-4 text-left group transition-all relative overflow-hidden w-full flex justify-between items-center
        ${qualified ? 'border-stone-600 hover:border-red-600 bg-stone-800 hover:bg-stone-900 cursor-pointer' : 'border-stone-800 bg-black/50 opacity-70'}
      `}
    >
      <div>
        <div className={`font-black text-lg ${qualified ? 'text-stone-300 group-hover:text-red-500' : 'text-stone-600'}`}>{title}</div>
        <div className="text-xs text-stone-500 mt-1 font-mono">{sub}</div>
      </div>
      {!qualified && (
        <div className="text-[10px] font-bold text-red-500 bg-red-950/50 px-2 py-1 border border-red-900/50 transform rotate-3">
          未达标
        </div>
      )}
    </button>
  );
}

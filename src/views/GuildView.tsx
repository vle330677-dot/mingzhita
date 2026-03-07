import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft,
  X,
  Coins,
  Gavel,
  Beer,
  Store,
  Users,
  Tent,
  AlertTriangle,
  Landmark,
  Sparkles,
  ScrollText,
  Compass,
  BookOpen,
  HelpCircle
} from 'lucide-react';
import { User } from '../types';
import FactionMemberPanel from './shared/FactionMemberPanel';
import { ConfirmationDialog } from '../utils/confirmation';

interface Props {
  user: User;
  onExit: () => void;
  showToast: (msg: string) => void;
  fetchGlobalData: () => void;
}

interface GuildAuction {
  id: number;
  channel: string;
  title: string;
  itemName: string;
  itemDescription: string;
  itemTier: string;
  itemType: string;
  startPrice: number;
  minIncrement: number;
  currentPrice: number;
  highestBidderName?: string;
  secondsLeft: number;
  myBid?: number;
}

interface GuildCommission {
  id: number;
  publisherUserId: number;
  publisherName: string;
  title: string;
  content: string;
  grade: 'D' | 'C' | 'B' | 'A' | 'S';
  kind: 'normal' | 'assassination';
  rewardGold: number;
  status: 'open' | 'accepted' | 'completed' | 'cancelled';
  assigneeUserId: number;
  assigneeName: string;
  createdAt: string;
  canAccept?: boolean;
}

interface AdventurerProfile {
  userId: number;
  isAdventurer: boolean;
  level: number;
  title: string;
  score: number;
  completedTotal: number;
  rewardBonusRate: number;
  completedByGrade: { D: number; C: number; B: number; A: number; S: number };
}

interface AdventurerBoardRow {
  userId: number;
  name: string;
  level: number;
  title: string;
  score: number;
  completedTotal: number;
}

interface GuildState {
  bank: { balance: number; lastInterestDate: string };
  stall: { active: boolean; expiresAt: string; rentCost: number };
  auctions: GuildAuction[];
  recentAuctions: GuildAuction[];
  alley: { lastRolledAt: string; lastResultType: string; lastResultText: string };
  limits: { listingToday: number; listingMax: number };
  permissions: { canManageMembers: boolean; memberChangePolicy: string };
}

interface InventoryRow {
  id: number;
  name: string;
  description: string;
  qty: number;
  itemType: string;
}

const buildings = [
  { id: 'hall', name: '公会大厅', x: 58, y: 30, icon: <ScrollText />, desc: '职位与成员管理。' },
  { id: 'market', name: '自由集市', x: 30, y: 60, icon: <Store />, desc: '银行与租摊上架。' },
  { id: 'tavern', name: '冒险者酒馆', x: 22, y: 35, icon: <Beer />, desc: '休整、情报与90秒竞拍。' },
  { id: 'auction', name: '地下拍卖行', x: 82, y: 40, icon: <Gavel />, desc: '每日系统拍卖与玩家寄售。' },
  { id: 'alley', name: '公会小巷', x: 48, y: 76, icon: <Compass />, desc: '随机事件入口，可能掉落道具。' },
  { id: 'guide', name: '玩家指南', x: 10, y: 10, icon: <HelpCircle />, desc: '查看游戏玩法指南。' },
];

const RUMORS = [
  '听说界外裂隙又开了新口子，今晚会有高阶掉落。',
  '地下拍卖行最近盯上了会长私库，价位抬得很离谱。',
  '有人说小巷里的流浪商人只在月末现身。'
];

const ROLES = {
  MASTER: '公会会长',
  MEMBER: '公会成员',
  ADVENTURER: '冒险者'
};

const RANK_SCORES: Record<string, number> = {
  '无': 0, 'F': 1, 'E': 2, 'D': 3, 'C': 4, 'C+': 5, 'B': 6, 'B+': 7,
  'A': 8, 'A+': 9, 'S': 10, 'S+': 11, 'SS': 12, 'SS+': 13, 'SSS': 14
};

const COMMISSION_MIN_REWARD: Record<string, number> = {
  D: 80,
  C: 150,
  B: 280,
  A: 520,
  S: 1000
};

const formatLeft = (seconds: number) => {
  const safe = Math.max(0, Number(seconds || 0));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
};

const safeInt = (v: any, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
};

const EMPTY_CONFIRM_DIALOG = {
  isOpen: false,
  title: '',
  message: '',
  operationType: '',
  onConfirm: () => {},
};

export function GuildView({ user, onExit, showToast, fetchGlobalData }: Props) {
  const [selectedBuilding, setSelectedBuilding] = useState<any>(null);
  const [rumor, setRumor] = useState('');
  const [guildState, setGuildState] = useState<GuildState | null>(null);
  const [inventory, setInventory] = useState<InventoryRow[]>([]);
  const [bankAmount, setBankAmount] = useState('100');
  const [bidByAuctionId, setBidByAuctionId] = useState<Record<number, string>>({});
  const [listingPrice, setListingPrice] = useState('120');
  const [selectedInventoryId, setSelectedInventoryId] = useState<number>(0);
  const [customName, setCustomName] = useState('');
  const [customDesc, setCustomDesc] = useState('');
  const [customType, setCustomType] = useState('贵重物品');
  const [customTier, setCustomTier] = useState('中阶');
  const [customEffect, setCustomEffect] = useState('0');
  const [commissions, setCommissions] = useState<GuildCommission[]>([]);
  const [myAcceptedCommissionIds, setMyAcceptedCommissionIds] = useState<number[]>([]);
  const [adventurerProfile, setAdventurerProfile] = useState<AdventurerProfile | null>(null);
  const [adventurerBoard, setAdventurerBoard] = useState<AdventurerBoardRow[]>([]);
  const [commissionTitle, setCommissionTitle] = useState('');
  const [commissionContent, setCommissionContent] = useState('');
  const [commissionGrade, setCommissionGrade] = useState<'D' | 'C' | 'B' | 'A' | 'S'>('D');
  const [commissionKind, setCommissionKind] = useState<'normal' | 'assassination'>('normal');
  const [commissionReward, setCommissionReward] = useState('120');
  const [busy, setBusy] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState(EMPTY_CONFIRM_DIALOG);
  const isGuildPerson = [ROLES.MASTER, ROLES.MEMBER, ROLES.ADVENTURER].includes(String(user.job || ''));
  const isAdventurer = String(user.job || '') === '冒险者';

  const needGuildState = useMemo(() => {
    const id = String(selectedBuilding?.id || '');
    return id === 'market' || id === 'tavern' || id === 'auction' || id === 'alley' || id === 'hall';
  }, [selectedBuilding?.id]);

  useEffect(() => {
    if (!needGuildState) return;
    let alive = true;
    const pull = async (silent = false) => {
      if (!silent) setBusy(true);
      try {
        const res = await fetch(`/api/guild/state?userId=${user.id}`);
        const data = await res.json().catch(() => ({} as any));
        if (!alive) return;
        if (!res.ok || data.success === false) {
          if (!silent) showToast(data.message || '读取公会状态失败');
          return;
        }
        setGuildState(data as GuildState);
      } catch {
        if (!silent) showToast('网络异常，读取公会状态失败');
      } finally {
        if (!silent) setBusy(false);
      }
    };
    pull();
    const timer = setInterval(() => pull(true), 3000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [needGuildState, user.id, showToast]);

  useEffect(() => {
    if (!needGuildState) return;
    const pullInventory = async () => {
      try {
        const res = await fetch(`/api/users/${user.id}/inventory`);
        const data = await res.json().catch(() => ({} as any));
        if (res.ok && data.success) setInventory(Array.isArray(data.items) ? data.items : []);
      } catch {
        // ignore
      }
    };
    pullInventory();
  }, [needGuildState, user.id, guildState?.limits?.listingToday]);

  const refreshGuildState = async () => {
    try {
      const res = await fetch(`/api/guild/state?userId=${user.id}`);
      const data = await res.json().catch(() => ({} as any));
      if (res.ok && data.success) setGuildState(data as GuildState);
    } catch {
      // ignore
    }
  };

  const postGuild = async (path: string, body: any) => {
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return res.json().catch(() => ({} as any));
  };

  const refreshCommissions = async (silent = true) => {
    if (!silent) setBusy(true);
    try {
      const res = await fetch(`/api/guild/commissions?userId=${user.id}`);
      const data = await res.json().catch(() => ({} as any));
      if (!res.ok || data.success === false) {
        if (!silent) showToast(data.message || '读取委托失败');
        return;
      }
      setCommissions(Array.isArray(data.commissions) ? data.commissions : []);
      setMyAcceptedCommissionIds(Array.isArray(data.myAccepted) ? data.myAccepted.map((x: any) => Number(x || 0)) : []);
      setAdventurerProfile(data.profile || null);
      setAdventurerBoard(Array.isArray(data.leaderboard) ? data.leaderboard : []);
    } catch {
      if (!silent) showToast('网络异常，读取委托失败');
    } finally {
      if (!silent) setBusy(false);
    }
  };

  useEffect(() => {
    if (String(selectedBuilding?.id || '') !== 'hall') return;
    refreshCommissions(false);
    const timer = setInterval(() => refreshCommissions(true), 5000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBuilding?.id, user.id]);

  useEffect(() => {
    const min = COMMISSION_MIN_REWARD[commissionGrade] || 80;
    const minReward = commissionKind === 'assassination' ? min * 2 : min;
    if (safeInt(commissionReward, 0) < minReward) {
      setCommissionReward(String(minReward));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [commissionGrade, commissionKind]);

  const checkQualifications = (targetRank: string) => {
    if ((user.age || 0) < 16) return false;
    const pScore = RANK_SCORES[user.physicalRank || '无'] || 0;
    const mScore = RANK_SCORES[user.mentalRank || '无'] || 0;
    if (targetRank === ROLES.ADVENTURER) return true;
    if (targetRank === ROLES.MEMBER) return mScore >= RANK_SCORES['C+'] && pScore >= RANK_SCORES['C+'];
    if (targetRank === ROLES.MASTER) return mScore >= RANK_SCORES['S+'] && pScore >= RANK_SCORES['S+'];
    return false;
  };

  const handleJoinOrPromote = async (targetJobName: string) => {
    let jobName = targetJobName;
    const age = user.age || 0;
    if (age < 16) return showToast('未分化者禁止注册公会身份，请先前往圣所或伦敦塔。');
    if (age >= 16 && age <= 19) {
      const yes = window.confirm('你还没有毕业。继续将按【冒险者】登记，是否继续？');
      if (!yes) return;
      jobName = ROLES.ADVENTURER;
    }
    if (!checkQualifications(jobName)) return showToast(`资质不符：${jobName} 门槛未达到`);

    // 如果当前有职位，需要二次确认
    if (user.job && user.job !== '无') {
      setConfirmDialog({
        isOpen: true,
        title: '辞去当前职位',
        message: `你当前的职位是【${user.job}】，加入新职位将自动辞去当前职位。此操作不可撤销，确定要继续吗？`,
        operationType: 'resign_position',
        onConfirm: async () => {
          setConfirmDialog({ ...confirmDialog, isOpen: false });
          await executeJoin(jobName);
        }
      });
      return;
    }

    await executeJoin(jobName);
  };

  const executeJoin = async (jobName: string) => {
    try {
      const data = await postGuild('/api/tower/join', { userId: user.id, jobName });
      if (data.success) {
        showToast(data.message || `已加入：${jobName}`);
        fetchGlobalData();
        refreshGuildState();
      } else {
        showToast(data.message || '操作失败');
      }
    } catch {
      showToast('网络异常');
    }
  };

  const publishCommission = async () => {
    const title = commissionTitle.trim();
    if (!title) return showToast('请填写委托标题');
    const rewardInput = Math.max(1, safeInt(commissionReward, 0));
    const min = COMMISSION_MIN_REWARD[commissionGrade] || 80;
    const minReward = commissionKind === 'assassination' ? min * 2 : min;
    const rewardGold = Math.max(minReward, rewardInput);
    try {
      const data = await postGuild('/api/guild/commissions/publish', {
        userId: user.id,
        title,
        content: commissionContent.trim(),
        grade: commissionGrade,
        kind: commissionKind,
        rewardGold
      });
      if (!data.success) return showToast(data.message || '发布委托失败');
      showToast(data.message || '委托已发布');
      setCommissionTitle('');
      setCommissionContent('');
      setCommissionReward(String(minReward));
      fetchGlobalData();
      refreshCommissions();
    } catch {
      showToast('网络异常，发布失败');
    }
  };

  const acceptCommission = async (commissionId: number) => {
    try {
      const data = await postGuild(`/api/guild/commissions/${commissionId}/accept`, { userId: user.id });
      if (!data.success) return showToast(data.message || '接取失败');
      showToast(data.message || '已接取');
      refreshCommissions();
    } catch {
      showToast('网络异常，接取失败');
    }
  };

  const completeCommission = async (commissionId: number) => {
    try {
      const data = await postGuild(`/api/guild/commissions/${commissionId}/complete`, { userId: user.id });
      if (!data.success) return showToast(data.message || '完成委托失败');
      showToast(data.message || '委托已结算');
      fetchGlobalData();
      refreshCommissions();
    } catch {
      showToast('网络异常，结算失败');
    }
  };

  const handleRest = async () => {
    if ((user.gold || 0) < 50) return showToast('客房费 50G，金币不足');
    try {
      await fetch('/api/tower/rest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id })
      });
      showToast('已支付 50G，体力与MP恢复 50%');
      fetchGlobalData();
    } catch {
      showToast('休息失败');
    }
  };

  const doBankAction = async (mode: 'deposit' | 'withdraw' | 'interest') => {
    try {
      const amount = Math.max(1, safeInt(bankAmount, 0));
      const path =
        mode === 'deposit'
          ? '/api/guild/bank/deposit'
          : mode === 'withdraw'
          ? '/api/guild/bank/withdraw'
          : '/api/guild/bank/interest/claim';
      const body = mode === 'interest' ? { userId: user.id } : { userId: user.id, amount };
      const data = await postGuild(path, body);
      if (!data.success) return showToast(data.message || '操作失败');
      showToast(data.message || '操作完成');
      fetchGlobalData();
      refreshGuildState();
    } catch {
      showToast('网络异常，操作失败');
    }
  };

  const rentStall = async () => {
    try {
      const data = await postGuild('/api/guild/stalls/rent', { userId: user.id });
      if (!data.success) return showToast(data.message || '租摊失败');
      showToast(data.message || '租摊成功');
      fetchGlobalData();
      refreshGuildState();
    } catch {
      showToast('网络异常，租摊失败');
    }
  };

  const placeBid = async (auctionId: number) => {
    try {
      const bidAmount = Math.max(1, safeInt(bidByAuctionId[auctionId], 0));
      if (!bidAmount) return showToast('请输入出价金额');
      const data = await postGuild('/api/guild/auctions/bid', { userId: user.id, auctionId, bidAmount });
      if (!data.success) return showToast(data.message || '出价失败');
      showToast(data.message || '出价成功');
      refreshGuildState();
    } catch {
      showToast('网络异常，出价失败');
    }
  };

  const listInventoryItem = async () => {
    try {
      if (!selectedInventoryId) return showToast('先选择要上架的背包道具');
      const startPrice = Math.max(20, safeInt(listingPrice, 120));
      const data = await postGuild('/api/guild/auctions/listing', {
        userId: user.id,
        mode: 'inventory',
        inventoryId: selectedInventoryId,
        startPrice
      });
      if (!data.success) return showToast(data.message || '上架失败');
      showToast(data.message || '已上架');
      fetchGlobalData();
      refreshGuildState();
    } catch {
      showToast('网络异常，上架失败');
    }
  };

  const listCustomItem = async () => {
    try {
      const name = customName.trim();
      if (!name) return showToast('自定义道具名称不能为空');
      const startPrice = Math.max(20, safeInt(listingPrice, 120));
      const data = await postGuild('/api/guild/auctions/listing', {
        userId: user.id,
        mode: 'custom',
        name,
        description: customDesc.trim(),
        itemType: customType,
        itemTier: customTier,
        effectValue: Math.max(0, safeInt(customEffect, 0)),
        startPrice
      });
      if (!data.success) return showToast(data.message || '上架失败');
      showToast(data.message || '自定义寄售已上架');
      setCustomName('');
      setCustomDesc('');
      fetchGlobalData();
      refreshGuildState();
    } catch {
      showToast('网络异常，上架失败');
    }
  };

  const wanderAlley = async () => {
    try {
      const data = await postGuild('/api/guild/alley/wander', { userId: user.id });
      if (!data.success) return showToast(data.message || '闲逛失败');
      showToast(data.message || '你在小巷转了一圈');
      fetchGlobalData();
      refreshGuildState();
    } catch {
      showToast('网络异常，闲逛失败');
    }
  };

  const tavernAuction = useMemo(
    () => (guildState?.auctions || []).find((x) => x.channel === 'tavern') || null,
    [guildState?.auctions]
  );
  const bankRareAuction = useMemo(
    () => (guildState?.auctions || []).find((x) => x.channel === 'bank_daily') || null,
    [guildState?.auctions]
  );
  const auctionHouseRows = useMemo(
    () => (guildState?.auctions || []).filter((x) => x.channel === 'auction_house_daily' || x.channel === 'auction_player'),
    [guildState?.auctions]
  );

  return (
    <div className="absolute inset-0 bg-stone-900 overflow-hidden text-stone-200">
      <div className="absolute inset-0 z-0">
        <img src="/公会.jpg" className="w-full h-full object-cover opacity-60 sepia-[20%]" alt="Guild" />
        <div className="absolute inset-0 bg-gradient-to-br from-amber-950/50 via-stone-900/60 to-black/70 pointer-events-none" />
      </div>

      <div className="absolute top-6 left-6 z-50 flex gap-3">
        <button
          onClick={onExit}
          className="bg-stone-900/90 text-amber-500 border border-amber-600/50 px-5 py-2.5 rounded-xl font-black flex items-center gap-2 hover:bg-stone-800 transition-all"
        >
          <ArrowLeft size={20} />
          <span className="hidden md:inline">离开公会领地</span>
        </button>
        <button
          onClick={() => setShowGuide(true)}
          className="bg-emerald-900/90 text-emerald-400 border border-emerald-600/50 px-5 py-2.5 rounded-xl font-black flex items-center gap-2 hover:bg-emerald-800 transition-all"
        >
          <BookOpen size={20} />
          <span className="hidden md:inline">玩家指南</span>
        </button>
      </div>

      <ConfirmationDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog({ ...confirmDialog, isOpen: false })}
        onConfirm={confirmDialog.onConfirm}
        title={confirmDialog.title}
        message={confirmDialog.message}
        operationType={confirmDialog.operationType}
        requireTyping={confirmDialog.operationType === 'resign_position'}
        typingText="确认辞职"
      />

      {showGuide && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
          onClick={() => setShowGuide(false)}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[85vh] overflow-y-auto p-6"
          >
            <div className="flex items-center justify-between mb-4 sticky top-0 bg-white pb-4 border-b">
              <h2 className="text-2xl font-black text-slate-800 flex items-center gap-2">
                <BookOpen size={24} className="text-emerald-600" />
                玩家游戏指南
              </h2>
              <button
                onClick={() => setShowGuide(false)}
                className="p-2 hover:bg-slate-100 rounded-full transition-colors"
              >
                <X size={20} className="text-slate-500" />
              </button>
            </div>
            <div className="prose prose-slate max-w-none text-slate-700 space-y-4 text-sm">
              <section>
                <h3 className="text-lg font-bold text-slate-800 mb-2">📱 移动端优化提示</h3>
                <ul className="list-disc pl-5 space-y-1">
                  <li>建议使用横屏模式以获得最佳体验</li>
                  <li>所有按钮都已优化为触摸友好的大小</li>
                  <li>在长列表中可以流畅滑动</li>
                  <li>地图界面支持双指缩放查看细节</li>
                </ul>
              </section>

              <section>
                <h3 className="text-lg font-bold text-slate-800 mb-2">🎯 公会委托系统</h3>
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-2">
                  <p className="font-bold text-amber-900 mb-1">委托等级与奖励</p>
                  <ul className="list-none space-y-1 text-xs">
                    <li>• D级：80G+ （基础任务）</li>
                    <li>• C级：150G+ （中低难度）</li>
                    <li>• B级：280G+ （中等难度）</li>
                    <li>• A级：520G+ （高难度）</li>
                    <li>• S级：1000G+ （最高难度）</li>
                    <li className="text-red-700 font-bold">• 暗杀任务：奖励翻倍！</li>
                  </ul>
                </div>
                <p className="text-xs">只有职业为"冒险者"的玩家可以接取委托。完成委托获得积分和经验，等级提升可获得最高30%的奖励加成！</p>
              </section>

              <section>
                <h3 className="text-lg font-bold text-slate-800 mb-2">💰 快速赚钱方法</h3>
                <ol className="list-decimal pl-5 space-y-1 text-xs">
                  <li><strong>工作</strong>：每天最多3次，每次获得金币</li>
                  <li><strong>委托任务</strong>：成为冒险者接取高级委托</li>
                  <li><strong>商铺经营</strong>：在东市或西市开设商铺</li>
                  <li><strong>拍卖交易</strong>：参与拍卖，买卖道具</li>
                  <li><strong>街道闲逛</strong>：东市繁华街道可能拾取贵重物品</li>
                </ol>
              </section>

              <section>
                <h3 className="text-lg font-bold text-slate-800 mb-2">⚠️ 敏感操作提示</h3>
                <p className="text-xs mb-2">以下操作需要二次确认，请谨慎操作：</p>
                <ul className="list-disc pl-5 space-y-1 text-xs">
                  <li>角色死亡（不可逆）</li>
                  <li>转化为鬼魂（改变游戏状态）</li>
                  <li>辞去职位（失去职位权限）</li>
                  <li>大额转账（金额超过1000G）</li>
                  <li>出售稀有物品（高价值物品）</li>
                </ul>
              </section>

              <section>
                <h3 className="text-lg font-bold text-slate-800 mb-2">🏛️ 主要区域介绍</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                  <div className="bg-slate-50 rounded-lg p-2">
                    <p className="font-bold text-slate-800">公会</p>
                    <p className="text-slate-600">委托系统、拍卖行、银行、小巷探险</p>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-2">
                    <p className="font-bold text-slate-800">东市（富人区）</p>
                    <p className="text-slate-600">高门槛入住、高价商铺、繁荣度竞争</p>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-2">
                    <p className="font-bold text-slate-800">西市（贫民区）</p>
                    <p className="text-slate-600">低门槛入住、黑市交易、基础训练</p>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-2">
                    <p className="font-bold text-slate-800">军队</p>
                    <p className="text-slate-600">评理系统、军事任务、纠纷裁决</p>
                  </div>
                </div>
              </section>

              <section>
                <h3 className="text-lg font-bold text-slate-800 mb-2">👻 鬼魂实体化系统</h3>
                <div className="space-y-2 text-xs">
                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-2">
                    <p className="font-bold text-purple-900">半实体化（消耗10MP）</p>
                    <p className="text-purple-700">普通人无法看见和对话，只有其他鬼魂可以互动</p>
                  </div>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-2">
                    <p className="font-bold text-blue-900">实体化（消耗20MP）</p>
                    <p className="text-blue-700">所有人都可以看见和对话，可以正常交易和互动</p>
                  </div>
                </div>
              </section>

              <section>
                <h3 className="text-lg font-bold text-slate-800 mb-2">📞 获取更多帮助</h3>
                <p className="text-xs">查看完整的 <a href="/PLAYER_GUIDE.md" target="_blank" className="text-emerald-600 hover:underline">玩家游戏指南</a> 了解更多详细信息。</p>
              </section>
            </div>
          </motion.div>
        </motion.div>
      )}

      <div className="relative z-10 w-full h-full">
        {buildings.map((b) => (
          <div
            key={b.id}
            className="absolute -translate-x-1/2 -translate-y-1/2 z-10 cursor-pointer group"
            style={{ left: `${b.x}%`, top: `${b.y}%` }}
            onClick={() => setSelectedBuilding(b)}
          >
            <div className="w-16 h-16 md:w-20 md:h-20 bg-stone-900/85 border-2 border-amber-500 rounded-2xl flex items-center justify-center text-amber-400 group-hover:scale-110 group-hover:text-amber-300 transition-all shadow-xl">
              {React.cloneElement(b.icon as React.ReactElement, { size: 28 })}
            </div>
            <div className="mt-2 text-[11px] text-center text-amber-200 bg-black/70 px-2 py-1 rounded-lg whitespace-nowrap">
              {b.name}
            </div>
          </div>
        ))}
      </div>

      <AnimatePresence>
        {selectedBuilding && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelectedBuilding(null)} className="fixed inset-0 bg-black/60 z-40" />
            <motion.div
              initial={{ y: 16, opacity: 0, scale: 0.97 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 16, opacity: 0, scale: 0.97 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
            >
              <div className="w-full max-w-3xl max-h-[86vh] overflow-y-auto bg-[#fdfbf7] text-stone-800 rounded-2xl border-4 border-stone-800 shadow-2xl">
                <div className="sticky top-0 z-20 bg-stone-800 text-amber-50 px-5 py-4 flex items-center justify-between border-b-4 border-amber-600">
                  <div>
                    <div className="text-xl font-black">{selectedBuilding.name}</div>
                    <div className="text-xs text-stone-300">{selectedBuilding.desc}</div>
                  </div>
                  <button onClick={() => setSelectedBuilding(null)} className="p-2 rounded-full hover:bg-stone-700">
                    <X size={20} />
                  </button>
                </div>

                <div className="p-5 md:p-6 space-y-5">
                  {selectedBuilding.id === 'hall' && (
                    <>
                      {!isGuildPerson && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <JoinBtn title="冒险者" sub="不限门槛" qualified={checkQualifications(ROLES.ADVENTURER)} onClick={() => handleJoinOrPromote(ROLES.ADVENTURER)} />
                          <JoinBtn title="公会成员" sub="神C+ / 体C+" qualified={checkQualifications(ROLES.MEMBER)} onClick={() => handleJoinOrPromote(ROLES.MEMBER)} />
                          <JoinBtn title="公会会长" sub="神S+ / 体S+" qualified={checkQualifications(ROLES.MASTER)} onClick={() => handleJoinOrPromote(ROLES.MASTER)} />
                        </div>
                      )}

                      {isAdventurer && (
                        <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4">
                          <div className="font-black text-indigo-800">冒险者专属功能键</div>
                          <div className="text-xs text-indigo-700 mt-1">
                            等级：{adventurerProfile?.title || '见习冒险者'} {adventurerProfile?.level || 1}
                            {' '}| 积分：{adventurerProfile?.score || 0}
                            {' '}| 已完成：{adventurerProfile?.completedTotal || 0}
                            {' '}| 奖励加成：{Math.round(Number(adventurerProfile?.rewardBonusRate || 0) * 100)}%
                          </div>
                          <div className="flex flex-wrap gap-2 mt-3">
                            <button onClick={() => refreshCommissions(false)} className="px-3 py-2 rounded-lg bg-indigo-700 text-white text-sm font-bold">刷新委托</button>
                            <button
                              onClick={() => {
                                const id = Number(myAcceptedCommissionIds[0] || 0);
                                if (!id) return showToast('暂无进行中的委托');
                                completeCommission(id);
                              }}
                              className="px-3 py-2 rounded-lg bg-emerald-700 text-white text-sm font-bold"
                            >
                              完成当前委托
                            </button>
                          </div>
                        </div>
                      )}

                      <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
                        <div className="font-black flex items-center gap-2">
                          <ScrollText size={16} />
                          委托发布面板（所有玩家可发布）
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          <input value={commissionTitle} onChange={(e) => setCommissionTitle(e.target.value)} className="border rounded-lg px-3 py-2 text-sm" placeholder="委托标题" />
                          <input value={commissionContent} onChange={(e) => setCommissionContent(e.target.value)} className="border rounded-lg px-3 py-2 text-sm" placeholder="委托内容（可选）" />
                          <select
                            value={commissionGrade}
                            onChange={(e) => setCommissionGrade(e.target.value as 'D' | 'C' | 'B' | 'A' | 'S')}
                            className="border rounded-lg px-3 py-2 text-sm"
                          >
                            <option value="D">D级</option>
                            <option value="C">C级</option>
                            <option value="B">B级</option>
                            <option value="A">A级</option>
                            <option value="S">S级</option>
                          </select>
                          <select
                            value={commissionKind}
                            onChange={(e) => setCommissionKind(e.target.value as 'normal' | 'assassination')}
                            className="border rounded-lg px-3 py-2 text-sm"
                          >
                            <option value="normal">常规委托</option>
                            <option value="assassination">暗杀任务</option>
                          </select>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <input value={commissionReward} onChange={(e) => setCommissionReward(e.target.value)} className="border rounded-lg px-3 py-2 text-sm w-40" placeholder="赏金" />
                          <span className="text-xs text-slate-500">
                            当前最低赏金：{(COMMISSION_MIN_REWARD[commissionGrade] || 80) * (commissionKind === 'assassination' ? 2 : 1)}G
                          </span>
                          <button onClick={publishCommission} className="px-3 py-2 rounded-lg bg-stone-800 text-white text-sm font-bold">
                            发布委托
                          </button>
                        </div>
                      </div>

                      <div className="rounded-xl border border-slate-200 bg-white p-4">
                        <div className="font-black mb-3">委托看板（D/C/B/A/S + 暗杀）</div>
                        <div className="space-y-2 max-h-72 overflow-y-auto">
                          {commissions.map((c) => (
                            <div key={c.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <div className="text-sm font-black text-slate-800">{c.title}</div>
                                  <div className="text-xs text-slate-600 mt-1">{c.content || '无附加说明'}</div>
                                  <div className="text-[11px] text-slate-500 mt-1">
                                    发布者：{c.publisherName || '未知'} | 赏金：{c.rewardGold}G
                                  </div>
                                </div>
                                <div className="text-right space-y-1">
                                  <div className={`text-[10px] px-2 py-0.5 rounded-full ${c.kind === 'assassination' ? 'bg-rose-100 text-rose-700' : 'bg-sky-100 text-sky-700'}`}>
                                    {c.kind === 'assassination' ? '暗杀任务' : '常规委托'}
                                  </div>
                                  <div className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">{c.grade}级</div>
                                  <div className="text-[10px] px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">{c.status}</div>
                                </div>
                              </div>
                              <div className="mt-2 flex gap-2">
                                {isAdventurer && c.status === 'open' && (
                                  <button onClick={() => acceptCommission(c.id)} className="px-3 py-1.5 rounded-lg bg-indigo-700 text-white text-xs font-bold">
                                    接取
                                  </button>
                                )}
                                {isAdventurer && c.status === 'accepted' && c.assigneeUserId === user.id && (
                                  <button onClick={() => completeCommission(c.id)} className="px-3 py-1.5 rounded-lg bg-emerald-700 text-white text-xs font-bold">
                                    完成并结算
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                          {commissions.length === 0 && <div className="text-sm text-slate-500">当前暂无可接取委托。</div>}
                        </div>
                        {!isAdventurer && (
                          <div className="text-xs text-slate-500 mt-3">提示：只有职业为“冒险者”的玩家可以接取/完成委托，其他职业可发布委托。</div>
                        )}
                      </div>

                      <div className="rounded-xl border border-slate-200 bg-white p-4">
                        <div className="font-black mb-2 flex items-center gap-2"><Users size={16} /> 冒险者排行榜</div>
                        <div className="space-y-2 max-h-56 overflow-y-auto">
                          {adventurerBoard.map((x, idx) => (
                            <div key={x.userId} className="flex items-center justify-between rounded-lg bg-slate-50 border border-slate-200 px-3 py-2">
                              <div className="text-sm"><span className="font-black mr-2">#{idx + 1}</span>{x.name}</div>
                              <div className="text-xs text-slate-600">{x.title} 等级 {x.level} · 积分 {x.score} · 完成 {x.completedTotal}</div>
                            </div>
                          ))}
                          {adventurerBoard.length === 0 && <div className="text-sm text-slate-500">暂无排行数据。</div>}
                        </div>
                      </div>

                      <div className="rounded-xl border border-slate-300 bg-white p-4 text-sm">
                        <div className="font-black">成员变动权限</div>
                        <div className="text-slate-600 mt-1">{guildState?.permissions?.memberChangePolicy || '仅公会会长可执行成员变动操作'}</div>
                      </div>
                      <FactionMemberPanel user={user} locationId="guild" showToast={showToast} fetchGlobalData={fetchGlobalData} title="公会职位房间" />
                    </>
                  )}

                  {selectedBuilding.id === 'market' && (
                    <div className="space-y-4">
                      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                        <div className="font-black text-amber-800 flex items-center gap-2"><Landmark size={16} /> 公会银行</div>
                        <div className="text-sm mt-2">银行余额：<b>{guildState?.bank?.balance ?? 0}G</b>（每日可领 0.1% 利息）</div>
                        <div className="flex flex-wrap gap-2 mt-3">
                          <input value={bankAmount} onChange={(e) => setBankAmount(e.target.value)} className="border rounded-lg px-3 py-2 text-sm w-36" placeholder="金额" />
                          <button onClick={() => doBankAction('deposit')} className="px-3 py-2 rounded-lg bg-emerald-700 text-white text-sm font-bold">存入</button>
                          <button onClick={() => doBankAction('withdraw')} className="px-3 py-2 rounded-lg bg-sky-700 text-white text-sm font-bold">取出</button>
                          <button onClick={() => doBankAction('interest')} className="px-3 py-2 rounded-lg bg-amber-700 text-white text-sm font-bold">领取利息</button>
                        </div>
                      </div>

                      <div className="rounded-xl border border-slate-200 bg-white p-4">
                        <div className="font-black flex items-center gap-2"><Tent size={16} /> 自由集市摊位</div>
                        <div className="text-sm mt-2">
                          状态：{guildState?.stall?.active ? `已租用（到期 ${guildState?.stall?.expiresAt || ''}）` : '未租用'}
                        </div>
                        <button onClick={rentStall} className="mt-3 px-3 py-2 rounded-lg bg-stone-800 text-white text-sm font-bold">
                          租摊（{guildState?.stall?.rentCost ?? 120}G / 24h）
                        </button>
                        <div className="text-xs text-slate-600 mt-2">玩家每天最多上架 {guildState?.limits?.listingMax ?? 1} 件（今日已上架 {guildState?.limits?.listingToday ?? 0}）。</div>
                      </div>
                    </div>
                  )}

                  {selectedBuilding.id === 'tavern' && (
                    <div className="space-y-4">
                      <div className="rounded-xl border bg-stone-100 p-4">
                        <div className="text-sm text-stone-700">酒保情报：{rumor || '“住店、喝酒、还是竞拍？”'}</div>
                        <div className="flex gap-2 mt-3">
                          <button onClick={handleRest} className="px-4 py-2 rounded-lg bg-amber-600 text-white font-bold text-sm">租借客房（50G）</button>
                          <button onClick={() => setRumor(RUMORS[Math.floor(Math.random() * RUMORS.length)])} className="px-4 py-2 rounded-lg bg-stone-700 text-white font-bold text-sm">打听消息</button>
                        </div>
                      </div>

                      <AuctionCard
                        title="酒馆限时竞拍（90秒）"
                        auction={tavernAuction}
                        busy={busy}
                        bidValue={bidByAuctionId[tavernAuction?.id || 0] || ''}
                        onBidValueChange={(v) => tavernAuction && setBidByAuctionId((prev) => ({ ...prev, [tavernAuction.id]: v }))}
                        onBid={() => tavernAuction && placeBid(tavernAuction.id)}
                      />
                      <div className="text-xs text-slate-600">
                        规则：起拍价 50G / 100G，竞拍结束后仅赢家扣费并获得道具，其他竞拍者不会扣费；金币不足无法喊价。
                      </div>
                    </div>
                  )}

                  {selectedBuilding.id === 'auction' && (
                    <div className="space-y-5">
                      <AuctionCard
                        title="银行每日珍稀竞拍（300秒）"
                        auction={bankRareAuction}
                        busy={busy}
                        bidValue={bidByAuctionId[bankRareAuction?.id || 0] || ''}
                        onBidValueChange={(v) => bankRareAuction && setBidByAuctionId((prev) => ({ ...prev, [bankRareAuction.id]: v }))}
                        onBid={() => bankRareAuction && placeBid(bankRareAuction.id)}
                      />

                      <div className="grid grid-cols-1 gap-3">
                        {auctionHouseRows.map((a) => (
                          <AuctionCard
                            key={a.id}
                            title={a.title || '拍卖行条目'}
                            auction={a}
                            busy={busy}
                            bidValue={bidByAuctionId[a.id] || ''}
                            onBidValueChange={(v) => setBidByAuctionId((prev) => ({ ...prev, [a.id]: v }))}
                            onBid={() => placeBid(a.id)}
                          />
                        ))}
                        {auctionHouseRows.length === 0 && <div className="text-sm text-slate-500">当前暂无拍卖行条目。</div>}
                      </div>

                      <div className="rounded-xl border border-slate-200 bg-white p-4">
                        <div className="font-black text-sm">最新成交记录（仅保留上一条）</div>
                        {guildState?.recentAuctions?.[0] ? (
                          <div className="mt-2 text-sm text-slate-700">
                            {guildState.recentAuctions[0].itemName} · 成交价 {Math.max(guildState.recentAuctions[0].currentPrice || 0, guildState.recentAuctions[0].startPrice || 0)}G · 得主 {guildState.recentAuctions[0].highestBidderName || '无'}
                          </div>
                        ) : (
                          <div className="mt-2 text-sm text-slate-500">暂无最新成交。</div>
                        )}
                        <div className="text-xs text-slate-500 mt-1">更早成交记录已归档到「观察者图书馆」供回顾。</div>
                      </div>

                      <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
                        <div className="font-black flex items-center gap-2"><Sparkles size={16} /> 玩家寄售上架</div>
                        <div className="flex flex-wrap gap-2 items-center">
                          <select value={selectedInventoryId} onChange={(e) => setSelectedInventoryId(Number(e.target.value || 0))} className="border rounded-lg px-3 py-2 text-sm min-w-[220px]">
                            <option value={0}>选择背包道具</option>
                            {inventory.map((x) => (
                              <option key={x.id} value={x.id}>{x.name} x{x.qty}</option>
                            ))}
                          </select>
                          <input value={listingPrice} onChange={(e) => setListingPrice(e.target.value)} className="border rounded-lg px-3 py-2 text-sm w-28" placeholder="起拍价" />
                          <button onClick={listInventoryItem} className="px-3 py-2 rounded-lg bg-indigo-700 text-white text-sm font-bold">上架背包道具</button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          <input value={customName} onChange={(e) => setCustomName(e.target.value)} className="border rounded-lg px-3 py-2 text-sm" placeholder="自定义道具名称" />
                          <input value={customDesc} onChange={(e) => setCustomDesc(e.target.value)} className="border rounded-lg px-3 py-2 text-sm" placeholder="描述（可选）" />
                          <input value={customType} onChange={(e) => setCustomType(e.target.value)} className="border rounded-lg px-3 py-2 text-sm" placeholder="类型" />
                          <input value={customTier} onChange={(e) => setCustomTier(e.target.value)} className="border rounded-lg px-3 py-2 text-sm" placeholder="阶级" />
                          <input value={customEffect} onChange={(e) => setCustomEffect(e.target.value)} className="border rounded-lg px-3 py-2 text-sm" placeholder="效果值" />
                        </div>
                        <button onClick={listCustomItem} className="px-3 py-2 rounded-lg bg-rose-700 text-white text-sm font-bold">上架自定义道具（30G手续费）</button>
                      </div>
                    </div>
                  )}

                  {selectedBuilding.id === 'alley' && (
                    <div className="space-y-4">
                      <div className="rounded-xl border border-slate-200 bg-white p-4">
                        <div className="font-black flex items-center gap-2"><Compass size={16} /> 小巷随机事件</div>
                        <div className="text-sm text-slate-600 mt-2">可闲逛触发随机事件：可能掉落道具、获得金币，或空手而归。</div>
                        <button onClick={wanderAlley} className="mt-3 px-4 py-2 rounded-lg bg-stone-800 text-white font-bold text-sm">前往闲逛</button>
                        {guildState?.alley?.lastResultText && (
                          <div className="mt-3 text-xs text-slate-600">上次结果：{guildState.alley.lastResultText}</div>
                        )}
                      </div>
                    </div>
                  )}

                  {selectedBuilding.id === 'guide' && (
                    <div className="space-y-4">
                      <div className="text-center py-6">
                        <HelpCircle size={64} className="mx-auto text-emerald-600 mb-4" />
                        <h3 className="text-xl font-black text-slate-800 mb-2">玩家游戏指南</h3>
                        <p className="text-sm text-slate-600 mb-4">查看完整的游戏玩法和系统介绍</p>
                        <button
                          onClick={() => {
                            setSelectedBuilding(null);
                            setShowGuide(true);
                          }}
                          className="px-6 py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition-colors"
                        >
                          打开指南
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-center gap-2 text-xs text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                    <AlertTriangle size={13} />
                    拍卖规则：到时结算，以最后最高有效出价为准；赢家扣费并获得道具，非赢家不扣费。
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

function JoinBtn({ title, sub, qualified, onClick }: any) {
  return (
    <button
      onClick={onClick}
      className={`border-2 p-4 text-left transition-all rounded-lg w-full ${
        qualified ? 'border-stone-300 hover:border-amber-500 bg-white' : 'border-stone-200 bg-stone-100 opacity-60'
      }`}
    >
      <div className={`font-black ${qualified ? 'text-stone-800' : 'text-stone-400'}`}>{title}</div>
      <div className="text-xs text-stone-500 mt-1">{sub}</div>
      {!qualified && <div className="text-[10px] mt-2 text-rose-500">未达标</div>}
    </button>
  );
}

function AuctionCard({
  title,
  auction,
  bidValue,
  onBidValueChange,
  onBid,
  busy
}: {
  key?: React.Key;
  title: string;
  auction: GuildAuction | null | undefined;
  bidValue: string;
  onBidValueChange: (v: string) => void;
  onBid: () => void;
  busy: boolean;
}) {
  if (!auction) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="font-black">{title}</div>
        <div className="text-sm text-slate-500 mt-1">当前暂无开放轮次。</div>
      </div>
    );
  }

  const shownPrice = Math.max(Number(auction.currentPrice || 0), Number(auction.startPrice || 0));
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="font-black flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-2"><Gavel size={14} /> {title}</span>
        <span className="text-xs text-rose-600">剩余 {formatLeft(auction.secondsLeft)}</span>
      </div>
      <div className="text-sm mt-2">{auction.itemName}</div>
      <div className="text-xs text-slate-500 mt-1">{auction.itemDescription || '暂无描述'}</div>
      <div className="text-xs mt-2 text-slate-700">
        当前价 {shownPrice}G · 最小加价 {auction.minIncrement}G · 当前最高 {auction.highestBidderName || '暂无'}
      </div>
      <div className="flex gap-2 mt-3">
        <input value={bidValue} onChange={(e) => onBidValueChange(e.target.value)} className="border rounded-lg px-3 py-2 text-sm w-32" placeholder="出价" />
        <button disabled={busy} onClick={onBid} className="px-3 py-2 rounded-lg bg-stone-800 text-white text-sm font-bold disabled:opacity-60 inline-flex items-center gap-1">
          <Coins size={13} />
          出价
        </button>
      </div>
    </div>
  );
}





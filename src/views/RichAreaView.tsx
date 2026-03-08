import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import HomeRoomView, { deriveInitialHomeLocation } from './HomeRoomView';

import {
  ArrowLeft, X, Gem,
  Landmark, ShoppingBag,
  Crown, Home, TrendingUp, ShieldAlert, Coins
} from 'lucide-react';
import { User } from '../types';
import FactionMemberPanel from './shared/FactionMemberPanel';

interface Props {
  user: User;
  onExit: () => void;
  showToast: (msg: string) => void;
  fetchGlobalData: () => void;
  onNavigateLocation?: (locationId: string) => void;
  onEnterCustomGameRun?: (gameId: number) => void;
}

interface RoomEntrance {
  ownerId: number;
  ownerName: string;
  avatarUrl?: string;
  job?: string;
  role?: string;
  intro?: string;
  x: number;
  y: number;
  locked?: boolean;
}

interface RoomDetail {
  ownerId: number;
  ownerName: string;
  avatarUrl?: string;
  job?: string;
  role?: string;
  homeLocation?: string;
  bgImage?: string;
  description?: string;
  visible?: boolean;
}

const buildings = [
  { id: 'city_hall', name: '东部市局', x: 50, y: 35, icon: <Landmark />, desc: '权力巅峰与市长繁荣度管理。' },
  { id: 'estate', name: '贵族庄园', x: 25, y: 25, icon: <Home />, desc: '办理入住 (需资金 > 10,000G)。' },
  { id: 'mall', name: '黄金商业街', x: 35, y: 60, icon: <ShoppingBag />, desc: '投资商铺 (地价10万) 与高薪打工。' },
  { id: 'boulevard', name: '繁华街道', x: 70, y: 58, icon: <Coins />, desc: '闲逛有概率拾取高价值物品。' },
  { id: 'club', name: '精英强化会所', x: 75, y: 20, icon: <ShieldAlert />, desc: '随机学习【强化系】技能。' }
];

const ROLES = {
  CHIEF: '东区市长',
  DEPUTY: '东区副市长',
  NOBLE: '东区贵族'
};

const RANK_SCORES: Record<string, number> = {
  无: 0, F: 1, E: 2, D: 3, C: 4, 'C+': 5, B: 6, 'B+': 7,
  A: 8, 'A+': 9, S: 10, 'S+': 11, SS: 12, 'SS+': 13, SSS: 14
};

function safeParse<T = any>(raw: string | null, fallback: T): T {
  try { return raw ? JSON.parse(raw) : fallback; } catch { return fallback; }
}

export function RichAreaView({ user, onExit, showToast, fetchGlobalData, onNavigateLocation, onEnterCustomGameRun }: Props) {
  const [selectedBuilding, setSelectedBuilding] = useState<any>(null);

  const [allPlayers, setAllPlayers] = useState<any[]>([]);
  const [myShop, setMyShop] = useState<any>(null);
  const [shopName, setShopName] = useState('');
  const [shopDesc, setShopDesc] = useState('');
  const [currentHome, setCurrentHome] = useState<string>((user as any).homeLocation || '');

  const [roomEntrances, setRoomEntrances] = useState<RoomEntrance[]>([]);
  const [selectedEntrance, setSelectedEntrance] = useState<RoomEntrance | null>(null);

  const [enteredRoom, setEnteredRoom] = useState<RoomDetail | null>(null);
  const [streetDaily, setStreetDaily] = useState({
    strollCount: 0
  });

  const isEastSide = Object.values(ROLES).includes(user.job || '');
  const isMayor = user.job === ROLES.CHIEF;

  const getScore = (rank?: string) => RANK_SCORES[rank || '无'] || 0;

  const authHeaders = () => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${localStorage.getItem('USER_TOKEN') || ''}`
  });

  // ✅ 仅保留这处 rooms/init
  useEffect(() => {
    fetch('/api/rooms/init', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: user.id,
        suggestedHomeLocation: deriveInitialHomeLocation(user as any),
      })
    }).catch(() => void 0);
  }, [user.id, user.age, user.gold, user.role]);

  useEffect(() => {
    setCurrentHome((user as any).homeLocation || '');
  }, [user?.id, (user as any).homeLocation]);

  useEffect(() => {
    if (selectedBuilding?.id === 'city_hall' || selectedBuilding?.id === 'mall') {
      fetchAllUsers();
      const shops = safeParse<Record<string, any>>(localStorage.getItem('shops_rich_area'), {});
      if (shops[String(user.id)]) setMyShop(shops[String(user.id)]);
    }
    if (selectedBuilding?.id === 'boulevard') {
      fetchRichStreetState();
    }
  }, [selectedBuilding, user.id]);

  useEffect(() => {
    let alive = true;
    const pull = async () => {
      try {
        const res = await fetch(`/api/rooms/entrances?locationId=rich_area&viewerId=${user.id}`);
        const data = await res.json();
        if (!alive) return;
        if (data.success) setRoomEntrances(data.rows || []);
      } catch {
        // ignore
      }
    };
    pull();
    const t = setInterval(pull, 4000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [user.id]);

  const fetchAllUsers = async () => {
    try {
      const res = await fetch('/api/world/presence');
      const data = await res.json();
      if (data.success) setAllPlayers(data.players || []);
    } catch (e) {
      console.error(e);
    }
  };

  const westResidents = allPlayers.filter((p) => (p.currentLocation || '') === 'slums').length;
  const eastResidents = allPlayers.filter((p) => (p.currentLocation || '') === 'rich_area').length;
  const westShopsCount = Object.keys(safeParse(localStorage.getItem('shops_slums'), {})).length;
  const eastShopsCount = Object.keys(safeParse(localStorage.getItem('shops_rich_area'), {})).length;

  const westProsperity = westResidents * 100 + westShopsCount * 300;
  const eastProsperity = eastResidents * 1000 + eastShopsCount * 3000;

  const checkQualifications = (targetRank: string) => {
    if ((user.age || 0) < 16) return false;
    const pScore = getScore(user.physicalRank);
    const mScore = getScore(user.mentalRank);
    if (targetRank === ROLES.NOBLE) return true;
    if (targetRank === ROLES.DEPUTY) return mScore >= RANK_SCORES['S+'] && pScore >= RANK_SCORES['S+'];
    if (targetRank === ROLES.CHIEF) return mScore >= RANK_SCORES['SS+'] && pScore >= RANK_SCORES['SS+'];
    return false;
  };

  const handleJoin = async (jobName: string) => {
    if ((user.age || 0) < 16) return showToast('未成年人禁止涉足政坛，请回学校读书。');
    if (!checkQualifications(jobName)) return showToast(`资质不符！你的等级不足以胜任 ${jobName}。`);

    const res = await fetch('/api/tower/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id, jobName })
    });
    const data = await res.json();
    if (data.success) {
      showToast(`跻身上流社会，就任：${jobName}。`);
      fetchGlobalData();
    } else showToast(data.message || '操作失败');
  };

  const handleMoveIn = async () => {
    if ((user.gold || 0) < 10000) return showToast('门卫：抱歉，您的资产不足 10,000G，无法在东区置办房产。');

    try {
      const res = await fetch(`/api/users/${user.id}/home`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({ locationId: 'rich_area' })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.success === false) return showToast(data.message || '入住登记失败');

      await fetch('/api/rooms/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id })
      }).catch(() => void 0);

      setCurrentHome('rich_area');
      showToast('已成功买下东区庄园！城市繁荣度大幅提升 (+1000)。');
      fetchGlobalData();
      fetchAllUsers();
    } catch (e) {
      console.error(e);
      showToast('网络错误，入住失败');
    }
  };

  // ✅ 修复：扣款失败不再假成功
  const handleOpenShop = async () => {
    const cost = 100000;
    if ((user.gold || 0) < cost) return showToast(`资金不足！东区寸土寸金，地价需要 ${cost}G。`);
    if (!shopName.trim()) return showToast('请输入店铺名称！');

    try {
      const commissionRes = await fetch('/api/commissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: `SHOP-${Date.now()}`,
          publisherId: user.id,
          title: '投资高档商铺扣款',
          reward: cost
        })
      });
      const commissionData = await commissionRes.json().catch(() => ({}));

      if (!commissionRes.ok || commissionData.success === false) {
        return showToast(commissionData.message || '扣款失败，开店中止');
      }

      const shopData = { name: shopName, desc: shopDesc, owner: user.name };
      const shops = safeParse<Record<string, any>>(localStorage.getItem('shops_rich_area'), {});
      shops[String(user.id)] = shopData;
      localStorage.setItem('shops_rich_area', JSON.stringify(shops));
      setMyShop(shopData);

      showToast(`【${shopName}】盛大开业！东市繁荣度暴涨 (+3000)！`);
      fetchGlobalData();
    } catch (e) {
      console.error(e);
      showToast('网络错误，开店失败');
    }
  };

  // ✅ 修复：打工结算失败不再假成功
  const handleShopWork = async () => {
    if ((user.workCount || 0) >= 3) return showToast('高净值客户已经接待完毕，今天到此为止。');

    try {
      const res = await fetch('/api/tower/work', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id })
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok || data.success === false) {
        return showToast(data.message || '营业结算失败');
      }

      showToast(`成功完成了一笔上流对戏订单，店铺营收暴涨 +${data.reward ?? 1000}G！`);
      fetchGlobalData();
    } catch (e) {
      console.error(e);
      showToast('网络错误，结算失败');
    }
  };

  const handleLearnSkill = async () => {
    try {
      const res = await fetch(`/api/skills/available/${user.id}`);
      const data = await res.json();
      if (data.success) {
        const enhanceSkills = (data.skills || []).filter((s: any) => s.faction === '强化系');
        if (enhanceSkills.length === 0) return showToast('会所暂未引进新的强化系项目。');
        const randomSkill = enhanceSkills[Math.floor(Math.random() * enhanceSkills.length)];

        const learnRes = await fetch(`/api/users/${user.id}/skills`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: randomSkill.name })
        });
        if (learnRes.ok) showToast(`经过昂贵的私教培训，你学会了：【${randomSkill.name}】！`);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchRichStreetState = async () => {
    try {
      const res = await fetch(`/api/rich/street/state?userId=${user.id}`);
      const data = await res.json().catch(() => ({} as any));
      if (!res.ok || data.success === false) return;
      if (data.daily) {
        setStreetDaily({
          strollCount: Math.max(0, Number(data.daily.strollCount || 0))
        });
      }
    } catch {}
  };

  const handleStreetStroll = async () => {
    try {
      const res = await fetch('/api/rich/street/stroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id })
      });
      const data = await res.json().catch(() => ({} as any));
      if (!res.ok || data.success === false) {
        showToast(data.message || '街道闲逛失败');
        return;
      }
      if (data.daily) {
        setStreetDaily({
          strollCount: Math.max(0, Number(data.daily.strollCount || 0))
        });
      }
      showToast(data.message || '你在繁华街道逛了一圈。');
      fetchGlobalData();
    } catch (e) {
      console.error(e);
      showToast('网络错误，街道事件未结算');
    }
  };

  const enterPersonalRoom = async () => {
    if (!selectedEntrance) return;
    try {
      let roomPassword = '';
      const detailRes = await fetch(`/api/rooms/${selectedEntrance.ownerId}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('USER_TOKEN') || ''}` }
      });
      const detailData = await detailRes.json().catch(() => ({}));
      if (!detailRes.ok || detailData.success === false) {
        return showToast(detailData.message || '读取房间信息失败');
      }

      if (selectedEntrance.locked && Number(selectedEntrance.ownerId) !== Number(user.id)) {
        const pwd = window.prompt('该房间已上锁，请输入房间密码：') || '';
        if (!pwd) return;
        const vr = await fetch(`/api/rooms/${selectedEntrance.ownerId}/verify-password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password: pwd })
        });
        const vd = await vr.json().catch(() => ({}));
        if (!vd.pass) return showToast('密码错误，无法进入');
        roomPassword = pwd;
      }

      const enterRes = await fetch(`/api/rooms/${selectedEntrance.ownerId}/enter`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ password: roomPassword })
      });
      const enterData = await enterRes.json().catch(() => ({}));
      if (!enterRes.ok || enterData.success === false) {
        return showToast(enterData.message || '进入房间失败');
      }

      const room = detailData.room as RoomDetail;
      setEnteredRoom(room);
      setSelectedEntrance(null);
    } catch (e) {
      console.error(e);
      showToast('网络错误，进入失败');
    }
  };

  if (enteredRoom) {
    return (
      <HomeRoomView
        currentUser={user as any}
        room={enteredRoom as any}
        sourceMap="rich_area"
        onBack={() => setEnteredRoom(null)}
        showToast={showToast}
        onSaved={(next) => setEnteredRoom(next as any)}
        refreshGlobalData={fetchGlobalData}
        onRequestSwitchLocation={(locationId) => {
          setEnteredRoom(null);
          onNavigateLocation?.(locationId);
        }}
        onExitToWorld={() => { setEnteredRoom(null); onExit(); }}
        onEnterCustomGameRun={onEnterCustomGameRun}
      />
    );
  }

  return (
    <div className="absolute inset-0 bg-slate-50 overflow-hidden font-serif select-none text-slate-800">
      <div className="absolute inset-0 z-0">
        <img src="/东市.jpg" className="w-full h-full object-cover opacity-80 contrast-110 brightness-110" alt="Rich Area" />
        <div className="absolute inset-0 bg-gradient-to-tr from-amber-100/40 via-white/20 to-emerald-100/30 mix-blend-overlay pointer-events-none" />
      </div>

      <div className="absolute top-6 left-6 z-50">
        <button onClick={onExit} className="bg-white/90 backdrop-blur-md text-emerald-800 border border-emerald-200/50 px-5 py-2.5 rounded-full font-bold shadow-xl flex items-center gap-2 hover:bg-emerald-50 hover:scale-105 transition-all active:scale-95">
          <ArrowLeft size={18} /> <span className="hidden md:inline">离开富人区</span>
        </button>
      </div>

      {/* 居民区入口按钮（固定位置，避免头像堆叠） */}
      {roomEntrances.length > 0 && (
        <div className="absolute z-20" style={{ left: '25%', top: '42%', transform: 'translate(-50%,-50%)' }}>
          <button
            className="flex flex-col items-center gap-1 group"
            onClick={() => setSelectedBuilding({ id: 'residents', name: '东区住宅目录', icon: <Home />, desc: '查看所有居民房间' })}
          >
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-50 to-yellow-100 border-2 border-amber-400 text-amber-600 flex items-center justify-center shadow-lg group-hover:scale-110 transition-all text-lg">
              🏠
            </div>
            <span className="text-[10px] bg-white/90 text-amber-800 px-2 py-0.5 rounded-full font-bold shadow">{roomEntrances.length} 户</span>
          </button>
        </div>
      )}

      <div className="relative z-10 w-full h-full">
        {buildings.map((b) => (
          <div key={b.id} className="absolute transform -translate-x-1/2 -translate-y-1/2 z-10 cursor-pointer group touch-manipulation" style={{ left: `${b.x}%`, top: `${b.y}%` }} onClick={() => setSelectedBuilding(b)}>
            <div className="flex flex-col items-center">
              <div className="w-16 h-16 md:w-20 md:h-20 bg-gradient-to-br from-yellow-50 to-amber-100 border-2 border-amber-300 shadow-[0_10px_30px_rgba(245,158,11,0.3)] flex items-center justify-center text-amber-600 group-hover:scale-110 group-hover:border-amber-500 transition-all rounded-full z-10 relative overflow-hidden">
                <div className="absolute inset-0 bg-white/50 opacity-0 group-hover:opacity-100 transition-opacity blur-md" />
                {React.cloneElement(b.icon as React.ReactElement, { size: 32 })}
              </div>
              <div className="mt-2 bg-white/95 backdrop-blur-md text-emerald-900 text-[10px] md:text-xs font-bold px-3 py-1.5 rounded-full border border-emerald-100 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity shadow-md whitespace-nowrap">
                {b.name}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 房间入口弹窗 */}
      <AnimatePresence>
        {selectedEntrance && (
          <motion.div className="fixed inset-0 z-[120] bg-black/50 flex items-center justify-center p-4 mobile-portrait-safe-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-700 p-4 text-slate-100 mobile-portrait-safe-card mobile-contrast-surface-dark">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-black text-lg">{selectedEntrance.ownerName} 的房间</h3>
                <button onClick={() => setSelectedEntrance(null)} className="p-1 rounded bg-slate-800"><X size={14} /></button>
              </div>
              <p className="text-xs text-slate-400 mb-2">{selectedEntrance.job || selectedEntrance.role || '自由人'}</p>
              <p className="text-sm bg-slate-800 border border-slate-700 rounded-xl p-3 min-h-[72px]">
                {selectedEntrance.intro || '房主还没有写房间介绍。'}
              </p>
              <button onClick={enterPersonalRoom} className="w-full mt-3 py-2 rounded bg-emerald-600 hover:bg-emerald-500 font-bold">
                进入房间
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedBuilding && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelectedBuilding(null)} className="fixed inset-0 bg-emerald-900/20 backdrop-blur-md z-40" />
            <motion.div initial={{ y: 50, opacity: 0, scale: 0.95 }} animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ y: 50, opacity: 0, scale: 0.95 }} className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none mobile-portrait-safe-overlay">
              <div className="bg-white w-full max-w-lg shadow-2xl relative rounded-[32px] border-t-8 border-amber-400 p-8 flex flex-col max-h-[85vh] pointer-events-auto mobile-portrait-safe-card mobile-contrast-surface-light">
                <button onClick={() => setSelectedBuilding(null)} className="absolute top-6 right-6 p-2 bg-slate-50 rounded-full hover:bg-slate-100 transition-colors z-20">
                  <X size={20} className="text-slate-500" />
                </button>

                <div className="flex items-center gap-5 mb-8 border-b border-slate-100 pb-6 mt-2 shrink-0">
                  <div className="p-4 bg-amber-50 rounded-2xl text-amber-600 border border-amber-200 shadow-inner">
                    {React.cloneElement(selectedBuilding.icon, { size: 32 })}
                  </div>
                  <div>
                    <h2 className="text-3xl font-black text-slate-800 tracking-tight">{selectedBuilding.name}</h2>
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mt-1">{selectedBuilding.desc}</p>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-6">
                  {selectedBuilding.id === 'city_hall' && (
                    <div className="space-y-6">
                      {!isEastSide ? (
                        <>
                          <div className="p-5 bg-sky-50 border border-sky-100 text-sky-900 text-sm italic rounded-2xl shadow-sm">
                            “欢迎来到文明世界。在这里，能力、血统与财富定义了一切。”
                          </div>
                          <div className="grid grid-cols-1 gap-3">
                            <EliteCard title="注册为东区贵族" sub="无特殊限制" qualified={checkQualifications(ROLES.NOBLE)} onClick={() => handleJoin(ROLES.NOBLE)} />
                            <EliteCard title="竞选副市长" sub="要求: 精神S+ 肉体S+" qualified={checkQualifications(ROLES.DEPUTY)} onClick={() => handleJoin(ROLES.DEPUTY)} />
                            <EliteCard title="登顶东区市长" sub="要求: 精神SS+ 肉体SS+" qualified={checkQualifications(ROLES.CHIEF)} onClick={() => handleJoin(ROLES.CHIEF)} />
                          </div>
                        </>
                      ) : (
                        <div className="text-center p-8 bg-slate-50 border border-slate-200 rounded-3xl shadow-inner">
                          <Crown size={48} className="mx-auto text-amber-500 mb-2 drop-shadow-md" />
                          <p className="text-xs text-slate-400 uppercase tracking-widest mb-2 font-bold">当前职位</p>
                          <h3 className="text-3xl font-black text-slate-800 mb-6">{user.job}</h3>
                        </div>
                      )}

                      {isMayor && (
                        <div className="p-6 bg-slate-50 border border-slate-200 rounded-3xl">
                          <h3 className="text-lg font-black text-sky-600 mb-4 flex items-center gap-2">
                            <TrendingUp size={20} /> 城市繁荣度掌控
                          </h3>
                          <div className="flex justify-between items-center text-center mb-6 bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
                            <div className="flex-1 border-r border-slate-100 pr-4">
                              <p className="text-xs text-slate-500 mb-1">东区繁荣度</p>
                              <p className="text-2xl font-black text-sky-500">{eastProsperity}</p>
                              <p className="text-[10px] text-slate-400 mt-1">人口：{eastResidents}</p>
                            </div>
                            <div className="flex-1 pl-4">
                              <p className="text-xs text-stone-500 mb-1">西区繁荣度</p>
                              <p className="text-2xl font-black text-orange-400">{westProsperity}</p>
                              <p className="text-[10px] text-stone-400 mt-1">人口：{westResidents}</p>
                            </div>
                          </div>
                          <button
                            onClick={async () => {
                              if (eastProsperity <= westProsperity) {
                                showToast('我们的繁荣度落后了，赶紧招商引资！');
                                return;
                              }
                              try {
                                const res = await fetch('/api/market/prosperity/settle', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ initiatorId: user.id })
                                });
                                const data = await res.json().catch(() => ({} as any));
                                showToast(data.message || (data.success ? '制裁成功！' : '制裁失败'));
                                if (data.success) fetchGlobalData?.();
                              } catch {
                                showToast('网络错误，结算失败');
                              }
                            }}
                            className="w-full py-4 bg-sky-600 hover:bg-sky-700 text-white font-black rounded-xl shadow-lg transition-colors text-sm"
                          >
                            向西区发起经济制裁
                          </button>
                        </div>
                      )}

                      {isEastSide && (
                        <FactionMemberPanel
                          user={user}
                          locationId="rich_area"
                          showToast={showToast}
                          fetchGlobalData={fetchGlobalData}
                          title="东市职位房间"
                        />
                      )}
                    </div>
                  )}

                  {selectedBuilding.id === 'estate' && (
                    <div className="text-center space-y-8 py-4">
                      <div className="relative inline-block">
                        <div className="absolute inset-0 bg-emerald-100 rounded-full blur-xl opacity-50" />
                        <Home size={64} className="mx-auto text-emerald-600 relative z-10" />
                      </div>
                      <div>
                        <h3 className="text-2xl font-black text-slate-800 mb-2">购置顶级庄园</h3>
                        <p className="text-sm text-slate-500 leading-relaxed max-w-xs mx-auto">
                          东区只为真正的财富拥有者敞开大门。<br />
                          <span className="text-emerald-600 font-bold bg-emerald-50 px-2 py-1 rounded">入住验资条件：资产 &gt; 10,000G</span>
                        </p>
                      </div>
                      {currentHome === 'rich_area' ? (
                        <div className="p-5 bg-emerald-50 text-emerald-800 font-bold border border-emerald-200 rounded-2xl flex items-center justify-center gap-2 shadow-sm">
                          <Crown size={18} /> 您已是尊贵的东区户主
                        </div>
                      ) : (
                        <button onClick={handleMoveIn} className="w-full py-4 bg-emerald-600 text-white font-black hover:bg-emerald-700 rounded-2xl shadow-xl shadow-emerald-100 transition-all text-lg tracking-wide">
                          出示资产并办理入住
                        </button>
                      )}
                    </div>
                  )}

                  {selectedBuilding.id === 'residents' && (
                    <div className="space-y-4">
                      <div className="text-xs text-slate-500 leading-relaxed">
                        东区共有 <span className="text-emerald-600 font-bold">{roomEntrances.length}</span> 户居民。点击可前往家园或访问他人房间。
                      </div>
                      <div className="space-y-2 max-h-80 overflow-y-auto pr-1 custom-scrollbar">
                        {roomEntrances.length === 0 ? (
                          <div className="text-slate-400 text-xs text-center py-4">暂无居民记录</div>
                        ) : roomEntrances.map((r) => {
                          const isMe = Number(r.ownerId) === Number(user.id);
                          return (
                            <div key={r.ownerId} className="flex items-center gap-3 bg-amber-50/60 border border-amber-200/50 rounded-2xl px-3 py-2.5">
                              <div className="w-8 h-8 rounded-full bg-amber-100 border border-amber-300 overflow-hidden shrink-0 flex items-center justify-center text-amber-600 text-xs font-black">
                                {r.avatarUrl ? <img src={r.avatarUrl} className="w-full h-full object-cover" alt="" /> : (r.ownerName?.[0] || '?')}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-bold text-slate-800 truncate">{r.ownerName}</div>
                                <div className="text-[10px] text-slate-400 truncate">{r.job || r.role || '自由人'}</div>
                              </div>
                              <button
                                onClick={() => { setSelectedEntrance(r); setSelectedBuilding(null); }}
                                className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-black transition-colors ${
                                  isMe
                                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                                    : 'bg-slate-200 hover:bg-slate-300 text-slate-700'
                                }`}
                              >
                                {isMe ? '回家' : '访问'}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {selectedBuilding.id === 'mall' && (
                    <div className="space-y-6">
                      {myShop ? (
                        <div className="bg-gradient-to-br from-amber-50 to-white p-8 border border-amber-200 rounded-3xl text-center shadow-sm">
                          <Gem size={48} className="mx-auto text-amber-500 mb-4 drop-shadow-md" />
                          <h3 className="text-2xl font-black text-amber-900 mb-2">{myShop.name}</h3>
                          <p className="text-xs text-amber-700/80 mb-8 italic font-medium">"{myShop.desc}"</p>
                          <button onClick={handleShopWork} className="w-full py-4 bg-amber-500 text-white font-black hover:bg-amber-600 rounded-2xl shadow-lg shadow-amber-200 transition-all flex items-center justify-center gap-2">
                            <Coins size={18} /> 商业剪彩 / 对戏接客 (+1000G)
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-5">
                          <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 text-center">
                            <p className="text-xs text-slate-500 font-bold">购买黄金地段商铺，赚取高额利润并拉升东区繁荣指数。</p>
                          </div>
                          <div className="space-y-3">
                            <input type="text" placeholder="输入奢侈品牌名称..." value={shopName} onChange={(e) => setShopName(e.target.value)} className="w-full p-4 bg-white border border-slate-200 rounded-xl outline-none focus:border-amber-400 focus:ring-4 focus:ring-amber-50 transition-all font-bold" />
                            <textarea placeholder="品牌格调简介..." value={shopDesc} onChange={(e) => setShopDesc(e.target.value)} className="w-full p-4 bg-white border border-slate-200 rounded-xl outline-none h-24 focus:border-amber-400 focus:ring-4 focus:ring-amber-50 transition-all resize-none text-sm" />
                          </div>
                          <button onClick={handleOpenShop} className="w-full py-4 bg-slate-900 text-amber-400 font-black hover:bg-slate-800 rounded-2xl shadow-xl transition-all flex justify-center items-center gap-2">
                            <Gem size={18} /> 全款买下地皮 (需 100,000G)
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {selectedBuilding.id === 'club' && (
                    <div className="text-center space-y-8 py-6">
                      <div className="relative inline-block">
                        <div className="absolute inset-0 bg-sky-100 rounded-full blur-xl opacity-60" />
                        <ShieldAlert size={64} className="mx-auto text-sky-600 relative z-10" />
                      </div>
                      <div>
                        <h3 className="text-2xl font-black text-slate-800 mb-2">顶级肉体强化</h3>
                        <p className="text-sm text-slate-500 max-w-xs mx-auto">使用最先进仪器进行机能刺激训练。</p>
                      </div>
                      <button onClick={handleLearnSkill} className="w-full py-5 bg-sky-50 text-sky-700 font-black hover:bg-sky-100 rounded-2xl border border-sky-200 transition-all text-sm uppercase tracking-wider">
                        申请高级强化课程 (随机获取)
                      </button>
                    </div>
                  )}

                  {selectedBuilding.id === 'boulevard' && (
                    <div className="space-y-6">
                      <div className="bg-gradient-to-br from-amber-50 to-white border border-amber-200 rounded-2xl p-5 text-sm text-amber-900 leading-relaxed">
                        这里是东市消费最密集的地段，贵族访客经常遗落贵重物件。
                        <span className="block mt-2 text-emerald-700 font-bold">闲逛有概率拾取高价值物品</span>
                      </div>

                      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-center">
                        <p className="text-xs text-slate-500">今日街道闲逛次数</p>
                        <p className="text-2xl font-black text-emerald-700">{streetDaily.strollCount}</p>
                      </div>

                      <button onClick={handleStreetStroll} className="w-full py-4 bg-emerald-600 text-white font-black hover:bg-emerald-700 rounded-2xl shadow-lg transition-all flex justify-center items-center gap-2">
                        <Coins size={18} />
                        在繁华街道闲逛
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

function EliteCard({ title, sub, qualified, onClick }: any) {
  return (
    <button
      onClick={onClick}
      disabled={!qualified}
      className={`w-full p-5 border rounded-2xl flex justify-between items-center group transition-all ${
        qualified
          ? 'bg-white border-slate-200 hover:border-amber-400 hover:shadow-lg cursor-pointer'
          : 'bg-slate-50 border-slate-100 opacity-60 grayscale cursor-not-allowed'
      }`}
    >
      <div className="text-left">
        <div className={`font-black text-sm ${qualified ? 'text-slate-800 group-hover:text-amber-700' : 'text-slate-500'}`}>{title}</div>
        <div className="text-[10px] text-slate-400 font-serif italic mt-1">{sub}</div>
      </div>
      {!qualified && <span className="text-[10px] text-red-500 bg-red-50 px-2 py-1 rounded-lg font-bold border border-red-100">等级不够</span>}
    </button>
  );
}

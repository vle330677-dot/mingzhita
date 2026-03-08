import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import HomeRoomView, { deriveInitialHomeLocation } from './HomeRoomView';

import {
  ArrowLeft, X, Factory,
  ShoppingBag, AlertOctagon,
  Home, Store, FlaskConical, TrendingUp,
  Coins, Hammer
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
  { id: 'office', name: '西部市局', x: 72, y: 35, icon: <AlertOctagon />, desc: '入职登记与市长繁荣度管理。' },
  { id: 'slum', name: '西区家园', x: 40, y: 80, icon: <Home />, desc: '办理入住（无资产限制）。' },
  { id: 'market', name: '西市商街', x: 50, y: 55, icon: <Store />, desc: '投资开店 (地价1万) 与打工。' },
  { id: 'alley', name: '阴暗小巷', x: 24, y: 62, icon: <Coins />, desc: '每日闲逛，可能被抢，也可能捡到炼金产物。' },
  { id: 'lab', name: '地下炼金所', x: 80, y: 65, icon: <FlaskConical />, desc: '随机学习【炼金系】技能。' },
];

const ROLES = {
  CHIEF: '西区市长',
  DEPUTY: '西区副市长',
  CITIZEN: '西区技工'
};

const RANK_SCORES: Record<string, number> = {
  '无': 0, 'F': 1, 'E': 2, 'D': 3, 'C': 4, 'C+': 5, 'B': 6, 'B+': 7,
  'A': 8, 'A+': 9, 'S': 10, 'S+': 11, 'SS': 12, 'SS+': 13, 'SSS': 14
};

export function SlumsView({ user, onExit, showToast, fetchGlobalData, onNavigateLocation, onEnterCustomGameRun }: Props) {
  const [selectedBuilding, setSelectedBuilding] = useState<any>(null);

  const [allPlayers, setAllPlayers] = useState<any[]>([]);
  const [myShop, setMyShop] = useState<any>(null);
  const [shopName, setShopName] = useState('');
  const [shopDesc, setShopDesc] = useState('');
  const [currentHome, setCurrentHome] = useState<string>((user as any).homeLocation || '');

  const [roomEntrances, setRoomEntrances] = useState<RoomEntrance[]>([]);
  const [selectedEntrance, setSelectedEntrance] = useState<RoomEntrance | null>(null);

  const [enteredRoom, setEnteredRoom] = useState<RoomDetail | null>(null);
  const [alleyDaily, setAlleyDaily] = useState({
    robbedCount: 0,
    robbedMax: 3,
    robbedRemaining: 3,
    strollCount: 0
  });

  const isWestSide = Object.values(ROLES).includes(user.job || '');
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
    if (selectedBuilding) {
      fetchAllUsers();
      const shops = JSON.parse(localStorage.getItem('shops_slums') || '{}');
      if (shops[user.id]) setMyShop(shops[user.id]);
      if (selectedBuilding.id === 'alley') fetchAlleyState();
    }
  }, [selectedBuilding, user.id]);

  useEffect(() => {
    let alive = true;
    const pull = async () => {
      try {
        const res = await fetch(`/api/rooms/entrances?locationId=slums&viewerId=${user.id}`);
        const data = await res.json();
        if (!alive) return;
        if (data.success) setRoomEntrances(data.rows || []);
      } catch {}
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

  const westResidents = allPlayers.filter(p => p.currentLocation === 'slums').length;
  const eastResidents = allPlayers.filter(p => p.currentLocation === 'rich_area').length;
  const westShopsCount = Object.keys(JSON.parse(localStorage.getItem('shops_slums') || '{}')).length;
  const eastShopsCount = Object.keys(JSON.parse(localStorage.getItem('shops_rich_area') || '{}')).length;

  const westProsperity = (westResidents * 100) + (westShopsCount * 300);
  const eastProsperity = (eastResidents * 1000) + (eastShopsCount * 3000);

  const checkQualifications = (targetRank: string) => {
    if ((user.age || 0) < 16) return false;
    const pScore = getScore(user.physicalRank);
    const mScore = getScore(user.mentalRank);

    if (targetRank === ROLES.CITIZEN) return true;
    if (targetRank === ROLES.DEPUTY) return mScore >= RANK_SCORES['S+'] && pScore >= RANK_SCORES['S+'];
    if (targetRank === ROLES.CHIEF) return mScore >= RANK_SCORES['SS+'] && pScore >= RANK_SCORES['SS+'];
    return false;
  };

  const handleJoin = async (jobName: string) => {
    if (user.job && user.job !== '无') return showToast(`请先辞去当前职务：${user.job}`);
    if (!checkQualifications(jobName)) return showToast(`资质不符！${jobName} 的等级要求未达标。`);

    const res = await fetch('/api/tower/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id, jobName })
    });
    const data = await res.json();
    if (data.success) {
      showToast(`恭喜就任：${jobName}。`);
      fetchGlobalData();
    } else {
      showToast(data.message);
    }
  };

  const handleMoveIn = async () => {
    try {
      const res = await fetch(`/api/users/${user.id}/home`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({ locationId: 'slums' })
      });
      const data = await res.json().catch(() => ({ success: res.ok }));
      if (!res.ok || data.success === false) return showToast(data.message || '入住登记失败');

      await fetch('/api/rooms/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id })
      }).catch(() => void 0);

      setCurrentHome('slums');
      showToast('已在西区登记常住人口！城市繁荣度 +100。');
      fetchGlobalData();
      fetchAllUsers();
    } catch (e) {
      console.error(e);
      showToast('网络错误，入住失败');
    }
  };

  // ✅ 修复：扣款失败不再假成功
  const handleOpenShop = async () => {
    const cost = 10000;
    if ((user.gold || 0) < cost) return showToast(`资金不足！西区地价需要 ${cost}G。`);
    if (!shopName.trim()) return showToast('请输入店铺名称！');

    try {
      const commissionRes = await fetch('/api/commissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: `SHOP-${Date.now()}`, publisherId: user.id, title: '西区地皮投资', reward: cost })
      });
      const commissionData = await commissionRes.json().catch(() => ({}));

      if (!commissionRes.ok || commissionData.success === false) {
        return showToast(commissionData.message || '扣款失败，开店中止');
      }

      const shopData = { name: shopName, desc: shopDesc, owner: user.name };
      const shops = JSON.parse(localStorage.getItem('shops_slums') || '{}');
      shops[user.id] = shopData;
      localStorage.setItem('shops_slums', JSON.stringify(shops));
      setMyShop(shopData);

      showToast(`恭喜！【${shopName}】开业大吉！西市繁荣度 +300！`);
      fetchGlobalData();
    } catch (e) {
      console.error(e);
      showToast('网络错误，开店失败');
    }
  };

  const handleShopWork = async () => {
    if ((user.workCount || 0) >= 3) return showToast('今天接待了太多客人，关门休息吧。');
    const res = await fetch('/api/tower/work', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id })
    });
    const data = await res.json();
    if (data.success) {
      showToast(`店铺营业结束，营收入账 (+${data.reward}G)！`);
      fetchGlobalData();
    }
  };

  const handleLearnSkill = async () => {
    const res = await fetch(`/api/skills/available/${user.id}`);
    const data = await res.json();
    if (data.success) {
      const alchemySkills = data.skills.filter((s: any) => s.faction === '炼金系');
      if (alchemySkills.length === 0) return showToast('暂时没有可学的炼金系技能。');
      const randomSkill = alchemySkills[Math.floor(Math.random() * alchemySkills.length)];

      const learnRes = await fetch(`/api/users/${user.id}/skills`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: randomSkill.name })
      });
      if (learnRes.ok) showToast(`在废料堆中灵光一闪，学会了：【${randomSkill.name}】！`);
    }
  };

  const handleQuit = async () => {
    try {
      const res = await fetch('/api/tower/quit', {
        method: 'POST',
        body: JSON.stringify({ userId: user.id }),
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      if (!data.success) return showToast(data.message || '辞职失败');

      showToast('已辞职。');
      fetchGlobalData();
      setSelectedBuilding(null);
    } catch (e) {
      console.error(e);
      showToast('网络错误，辞职失败');
    }
  };

  const fetchAlleyState = async () => {
    try {
      const res = await fetch(`/api/slums/alley/state?userId=${user.id}`);
      const data = await res.json().catch(() => ({} as any));
      if (!res.ok || data.success === false) return;
      if (data.daily) {
        setAlleyDaily({
          robbedCount: Math.max(0, Number(data.daily.robbedCount || 0)),
          robbedMax: Math.max(1, Number(data.daily.robbedMax || 3)),
          robbedRemaining: Math.max(0, Number(data.daily.robbedRemaining || 0)),
          strollCount: Math.max(0, Number(data.daily.strollCount || 0))
        });
      }
    } catch {}
  };

  const handleAlleyStroll = async () => {
    try {
      const res = await fetch('/api/slums/alley/stroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id })
      });
      const data = await res.json().catch(() => ({} as any));
      if (!res.ok || data.success === false) {
        showToast(data.message || '小巷闲逛失败');
        return;
      }
      if (data.daily) {
        setAlleyDaily({
          robbedCount: Math.max(0, Number(data.daily.robbedCount || 0)),
          robbedMax: Math.max(1, Number(data.daily.robbedMax || 3)),
          robbedRemaining: Math.max(0, Number(data.daily.robbedRemaining || 0)),
          strollCount: Math.max(0, Number(data.daily.strollCount || 0))
        });
      }
      showToast(data.message || '你在小巷里转了一圈。');
      fetchGlobalData();
    } catch (e) {
      console.error(e);
      showToast('网络错误，小巷事件未结算');
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
      if (!enterRes.ok || enterData.success === false) return showToast(enterData.message || '进入房间失败');

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
        sourceMap="slums"
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
    <div className="absolute inset-0 bg-stone-900 overflow-hidden font-sans select-none text-stone-300">
      <div className="absolute inset-0 bg-cover bg-center opacity-80" style={{ backgroundImage: "url('/西市.jpg')" }}>
        <div className="absolute inset-0 bg-orange-900/20 mix-blend-multiply pointer-events-none"></div>
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-black/50 pointer-events-none"></div>
      </div>

      <div className="absolute top-8 left-8 z-50">
        <button onClick={onExit} className="bg-black/60 backdrop-blur-md text-stone-400 border border-stone-600 px-6 py-2 rounded-lg font-bold shadow-2xl flex items-center gap-2 hover:text-orange-500 hover:border-orange-500 transition-all">
          <ArrowLeft size={18} /> 离开西市
        </button>
      </div>

      {/* 居民区入口按钮（固定位置，避免头像堆叠） */}
      {roomEntrances.length > 0 && (
        <div className="absolute z-20" style={{ left: '40%', top: '58%', transform: 'translate(-50%,-50%)' }}>
          <button
            className="flex flex-col items-center gap-1 group"
            onClick={() => setSelectedBuilding({ id: 'residents', name: '西区住宅目录', icon: <Home />, desc: '查看所有居民房间' })}
          >
            <div className="w-12 h-12 rounded-xl bg-black/80 border-2 border-orange-500/70 text-orange-300 flex items-center justify-center shadow-lg group-hover:scale-110 transition-all text-lg">
              🏠
            </div>
            <span className="text-[10px] bg-black/70 text-orange-300 px-2 py-0.5 rounded font-bold">{roomEntrances.length} 户</span>
          </button>
        </div>
      )}

      {buildings.map(b => (
        <div
          key={b.id}
          className="absolute transform -translate-x-1/2 -translate-y-1/2 z-10 cursor-pointer group"
          style={{ left: `${b.x}%`, top: `${b.y}%` }}
          onClick={() => setSelectedBuilding(b)}
        >
          <div className="flex flex-col items-center">
            <div className="w-16 h-16 bg-stone-800/90 backdrop-blur border-2 border-orange-900/50 shadow-[0_0_30px_rgba(234,88,12,0.3)] flex items-center justify-center text-orange-600 group-hover:scale-110 group-hover:bg-orange-900 group-hover:text-white group-hover:border-orange-500 transition-all rounded-xl z-10">
              {b.icon}
            </div>
            <div className="mt-2 bg-black/90 text-orange-500 text-[10px] font-bold px-3 py-1 rounded border border-stone-700 opacity-0 group-hover:opacity-100 transition-opacity">
              {b.name}
            </div>
          </div>
        </div>
      ))}

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
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md mobile-portrait-safe-overlay"
          >
            <div className="bg-[#1c1917] w-full max-w-lg shadow-2xl relative border border-stone-700 p-8 rounded-2xl overflow-hidden mobile-portrait-safe-card mobile-contrast-surface-dark">
              <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
                <Factory size={120} className="text-white" />
              </div>

              <button onClick={() => setSelectedBuilding(null)} className="absolute top-4 right-4 text-stone-500 hover:text-white transition-colors z-20 bg-stone-900 p-2 rounded-full">
                <X size={20} />
              </button>

              <div className="flex items-center gap-4 mb-8 relative z-10">
                <div className="p-4 bg-stone-800 rounded-xl text-orange-600 border border-stone-600 shadow-inner">
                  {React.cloneElement(selectedBuilding.icon, { size: 32 })}
                </div>
                <div>
                  <h2 className="text-2xl font-black text-stone-200 tracking-wider">{selectedBuilding.name}</h2>
                  <p className="text-xs text-orange-700 font-bold uppercase tracking-widest">{selectedBuilding.desc}</p>
                </div>
              </div>

              <div className="relative z-10 space-y-6 max-h-[60vh] overflow-y-auto custom-scrollbar pr-2">
                {selectedBuilding.id === 'office' && (
                  <div className="space-y-6">
                    {!isWestSide ? (
                      <div className="space-y-3">
                        <div className="p-4 bg-stone-900 border border-stone-700 rounded-lg text-xs text-stone-400 mb-4">
                          “这里不养闲人。想要在西区立足，要么有一技之长，要么有该死的野心。”
                        </div>
                        <JobCard title="注册为西区技工" sub="门槛: 无 | 基础建设者" qualified={checkQualifications(ROLES.CITIZEN)} onClick={() => handleJoin(ROLES.CITIZEN)} />
                        <JobCard title="竞选副市长" sub="门槛: 精神S+ 肉体S+" qualified={checkQualifications(ROLES.DEPUTY)} onClick={() => handleJoin(ROLES.DEPUTY)} />
                        <JobCard title="竞选市长" sub="门槛: 精神SS+ 肉体SS+" qualified={checkQualifications(ROLES.CHIEF)} onClick={() => handleJoin(ROLES.CHIEF)} />
                      </div>
                    ) : (
                      <div className="text-center p-6 bg-stone-900 border border-stone-700 rounded-xl">
                        <AlertOctagon size={40} className="mx-auto text-orange-600 mb-3" />
                        <p className="text-stone-500 text-xs mb-1 uppercase tracking-widest">当前职位</p>
                        <p className="text-2xl font-black text-white mb-6">{user.job}</p>

                        <button onClick={() => { if (confirm('确定要辞去西区职务吗？')) handleQuit(); }} className="text-xs text-rose-500 hover:text-rose-400 underline">
                          辞去职务
                        </button>
                      </div>
                    )}

                    {isMayor && (
                      <div className="border-t-2 border-dashed border-stone-800 pt-6">
                        <h3 className="text-sm font-black text-orange-500 mb-4 flex items-center gap-2">
                          <TrendingUp size={16} /> 城市繁荣度监控
                        </h3>
                        <div className="grid grid-cols-2 gap-4 mb-4">
                          <div className="bg-stone-800 p-4 rounded-lg text-center border border-stone-700">
                            <p className="text-[10px] text-stone-400">西区指数</p>
                            <p className="text-2xl font-black text-orange-500">{westProsperity}</p>
                          </div>
                          <div className="bg-stone-900 p-4 rounded-lg text-center border border-stone-800 opacity-50">
                            <p className="text-[10px] text-stone-500">东区指数 (对比)</p>
                            <p className="text-2xl font-black text-stone-400">{eastProsperity}</p>
                          </div>
                        </div>
                        <button
                          onClick={async () => {
                            if (westProsperity <= eastProsperity) {
                              showToast('繁荣度不足，无法发起经济掠夺！');
                              return;
                            }
                            try {
                              const res = await fetch('/api/market/prosperity/settle', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ initiatorId: user.id })
                              });
                              const data = await res.json().catch(() => ({} as any));
                              showToast(data.message || (data.success ? '结算成功！' : '结算失败'));
                              if (data.success) fetchGlobalData?.();
                            } catch {
                              showToast('网络错误，结算失败');
                            }
                          }}
                          className="w-full py-3 bg-orange-800 hover:bg-orange-700 text-white font-bold rounded-lg text-xs flex items-center justify-center gap-2 transition-colors"
                        >
                          <Coins size={14} /> 发起经济战结算
                        </button>
                      </div>
                    )}

                    {isWestSide && (
                      <FactionMemberPanel
                        user={user}
                        locationId="slums"
                        showToast={showToast}
                        fetchGlobalData={fetchGlobalData}
                        title="西市职位房间"
                      />
                    )}
                  </div>
                )}

                {selectedBuilding.id === 'slum' && (
                  <div className="text-center space-y-6">
                    <Home size={64} className="mx-auto text-stone-700" />
                    <div>
                      <h3 className="text-xl font-bold text-white mb-2">定居西市</h3>
                      <p className="text-xs text-stone-400 leading-relaxed px-4">
                        西市欢迎任何愿意扎根的人。<br />
                        <span className="text-orange-500 font-bold block mt-2">入住条件：无资产限制</span>
                      </p>
                    </div>

                    {currentHome === 'slums' ? (
                      <div className="py-3 px-4 bg-emerald-900/30 text-emerald-500 font-bold border border-emerald-800 rounded-lg text-sm">
                        你已是西市的合法居民。
                      </div>
                    ) : (
                      <button onClick={handleMoveIn} className="w-full py-4 bg-stone-700 text-white font-black hover:bg-stone-600 border-b-4 border-stone-900 active:border-b-0 active:translate-y-1 transition-all rounded-lg">
                        申请贫民窟床位
                      </button>
                    )}
                  </div>
                )}

                {selectedBuilding.id === 'residents' && (
                  <div className="space-y-4">
                    <div className="text-xs text-stone-400 leading-relaxed">
                      西市共有 <span className="text-orange-400 font-bold">{roomEntrances.length}</span> 户居民。点击名字可查看房间或前往家园。
                    </div>
                    <div className="space-y-2 max-h-80 overflow-y-auto pr-1 custom-scrollbar">
                      {roomEntrances.length === 0 ? (
                        <div className="text-stone-500 text-xs text-center py-4">暂无居民记录</div>
                      ) : roomEntrances.map((r) => {
                        const isMe = Number(r.ownerId) === Number(user.id);
                        return (
                          <div key={r.ownerId} className="flex items-center gap-3 bg-stone-800/60 border border-stone-700/50 rounded-xl px-3 py-2.5">
                            <div className="w-8 h-8 rounded-full bg-stone-700 border border-stone-600 overflow-hidden shrink-0 flex items-center justify-center text-stone-400 text-xs font-black">
                              {r.avatarUrl ? <img src={r.avatarUrl} className="w-full h-full object-cover" alt="" /> : (r.ownerName?.[0] || '?')}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-bold text-stone-100 truncate">{r.ownerName}</div>
                              <div className="text-[10px] text-stone-500 truncate">{r.job || r.role || '自由人'}</div>
                            </div>
                            <button
                              onClick={() => { setSelectedEntrance(r); setSelectedBuilding(null); }}
                              className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-black transition-colors ${
                                isMe
                                  ? 'bg-emerald-700 hover:bg-emerald-600 text-white'
                                  : 'bg-stone-700 hover:bg-stone-600 text-stone-200'
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

                {selectedBuilding.id === 'market' && (
                  <div className="space-y-6">
                    {myShop ? (
                      <div className="bg-stone-800 p-6 border border-orange-900/50 rounded-xl text-center relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-1 bg-orange-600"></div>
                        <Store size={40} className="mx-auto text-orange-500 mb-4" />
                        <h3 className="text-xl font-black text-white mb-1">{myShop.name}</h3>
                        <p className="text-xs text-stone-500 mb-6 italic line-clamp-2">"{myShop.desc}"</p>

                        <button onClick={handleShopWork} className="w-full py-4 bg-orange-700 text-white font-black hover:bg-orange-600 rounded-lg shadow-lg flex items-center justify-center gap-2">
                          <ShoppingBag size={18} /> 开门营业 (收益+100G)
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="bg-stone-800 p-4 rounded-lg border border-stone-700 text-xs text-stone-400">
                          <span className="text-orange-500 font-bold">商机提示：</span> 在这里投资一家属于自己的小店，不仅能赚取客人的打赏，还能大幅提升西区繁荣度。
                        </div>
                        <input type="text" placeholder="给店铺起个响亮的名字..." value={shopName} onChange={e => setShopName(e.target.value)} className="w-full p-4 bg-black border border-stone-700 text-white rounded-lg outline-none focus:border-orange-500 transition-colors text-sm" />
                        <textarea placeholder="写一段吸引人的店铺简介..." value={shopDesc} onChange={e => setShopDesc(e.target.value)} className="w-full p-4 bg-black border border-stone-700 text-white rounded-lg outline-none focus:border-orange-500 transition-colors h-24 text-sm resize-none" />
                        <button onClick={handleOpenShop} className="w-full py-4 bg-stone-100 text-stone-900 font-black hover:bg-white transition-all rounded-lg flex items-center justify-center gap-2">
                          <Hammer size={18} /> 支付 10,000G 装修开业
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {selectedBuilding.id === 'lab' && (
                  <div className="text-center space-y-6">
                    <div className="bg-stone-900 p-8 rounded-full inline-block border-2 border-dashed border-stone-700">
                      <FlaskConical size={48} className="text-emerald-500 animate-pulse" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-white mb-2">机械与炼金的奥秘</h3>
                      <p className="text-xs text-stone-400 leading-relaxed">
                        西区汇聚了无数被流放的疯狂科学家。<br />你可以在这里的废料堆中，淘到失传的炼金图谱。
                      </p>
                    </div>
                    <button onClick={handleLearnSkill} className="w-full py-4 bg-emerald-900/30 text-emerald-400 border border-emerald-800 font-black hover:bg-emerald-800 hover:text-white transition-all rounded-lg">
                      探寻炼金奥义 (随机获取技能)
                    </button>
                  </div>
                )}

                {selectedBuilding.id === 'alley' && (
                  <div className="space-y-6">
                    <div className="bg-stone-900/90 border border-stone-700 rounded-xl p-4 text-xs text-stone-300 leading-relaxed">
                      小巷充满扒手、黑市中间人和无名拾荒者。每天在这里闲逛都可能触发事件：
                      <span className="block mt-2 text-rose-400 font-bold">被抢最多 3 次 / 天，单次最多损失 50G</span>
                      <span className="block text-emerald-400 font-bold">也可能翻到通用物资或炼金产物</span>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div className="bg-black/50 border border-stone-700 rounded-lg p-3 text-center">
                        <p className="text-[10px] text-stone-500">今日被抢</p>
                        <p className="text-lg font-black text-rose-400">{alleyDaily.robbedCount}/{alleyDaily.robbedMax}</p>
                      </div>
                      <div className="bg-black/50 border border-stone-700 rounded-lg p-3 text-center">
                        <p className="text-[10px] text-stone-500">剩余被抢位</p>
                        <p className="text-lg font-black text-amber-400">{alleyDaily.robbedRemaining}</p>
                      </div>
                      <div className="bg-black/50 border border-stone-700 rounded-lg p-3 text-center">
                        <p className="text-[10px] text-stone-500">今日闲逛</p>
                        <p className="text-lg font-black text-cyan-400">{alleyDaily.strollCount}</p>
                      </div>
                    </div>

                    <button onClick={handleAlleyStroll} className="w-full py-4 bg-rose-900/30 text-rose-300 border border-rose-800 font-black hover:bg-rose-800 hover:text-white transition-all rounded-lg">
                      进入阴暗小巷闲逛
                    </button>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function JobCard({ title, sub, qualified, onClick }: any) {
  return (
    <button
      onClick={onClick}
      disabled={!qualified}
      className={`w-full p-4 border flex justify-between items-center transition-all group rounded-lg
        ${qualified ? 'bg-stone-800 hover:bg-stone-700 border-stone-600 cursor-pointer' : 'bg-stone-900 border-stone-800 opacity-50 cursor-not-allowed'}
      `}
    >
      <div className="text-left">
        <div className={`font-bold text-sm ${qualified ? 'text-stone-200 group-hover:text-orange-500' : 'text-stone-600'}`}>{title}</div>
        <div className="text-[10px] text-stone-500 mt-1">{sub}</div>
      </div>
      {!qualified && <span className="text-[9px] text-rose-500 border border-rose-900/50 bg-rose-950/20 px-2 py-1 rounded">条件未达</span>}
    </button>
  );
}

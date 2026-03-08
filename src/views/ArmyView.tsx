import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft, X, ShieldAlert, Target, 
  Warehouse, Medal, Skull, Swords, 
  Scale, Zap, RefreshCcw, Home
} from 'lucide-react';
import { User } from '../types';
import HomeRoomView from './HomeRoomView';
import FactionMemberPanel from './shared/FactionMemberPanel';

interface Props {
  user: User;
  onExit: () => void;
  showToast: (msg: string) => void;
  fetchGlobalData: () => void;
  onNavigateLocation?: (locationId: string) => void;
  onEnterCustomGameRun?: (gameId: number) => void;
}

const buildings = [
  { id: 'hq', name: '军事指挥部', x: 50, y: 40, icon: <Medal/>, desc: '入伍、晋升考核与蒜鸟评理中心。' },
  { id: 'expedition', name: '域外战场', x: 82, y: 15, icon: <Skull/>, desc: '【日常】前往域外击倒魔物获得工资。' },
  { id: 'drill', name: '练兵场', x: 40, y: 65, icon: <Swords/>, desc: '【特训】小游戏提升肉体强度。' },
  { id: 'armory', name: '战技研究所', x: 75, y: 55, icon: <Zap/>, desc: '研习军队专属物理系战技。' },
  { id: 'barracks', name: '军营宿舍区', x: 20, y: 75, icon: <Warehouse/>, desc: '查看对应职位住所，拜访家园或回自己房间。' },
];

const RANKS = {
  SOLDIER: '军队士兵',
  LIEUTENANT: '军队尉官',
  COLONEL: '军队校官',
  GENERAL: '军队将官'
};

const RANK_SCORES: Record<string, number> = {
  '无': 0, 'F': 1, 'E': 2, 'D': 3, 'C': 4, 'C+': 5, 'B': 6, 'B+': 7, 
  'A': 8, 'A+': 9, 'S': 10, 'S+': 11, 'SS': 12, 'SS+': 13, 'SSS': 14
};

export function ArmyView({ user, onExit, showToast, fetchGlobalData, onNavigateLocation, onEnterCustomGameRun }: Props) {
  const [selectedBuilding, setSelectedBuilding] = useState<any>(null);
  const [isPatrolling, setIsPatrolling] = useState(false);
  
  const [mediationInvites, setMediationInvites] = useState<any[]>([]);
  const [physicalSkills, setPhysicalSkills] = useState<any[]>([]);
  const [miniGame, setMiniGame] = useState({ active: false, clicks: 0, timeLeft: 10 });
  
  // 宿舍拜访相关状态
  const [armyPlayers, setArmyPlayers] = useState<any[]>([]);
  const [targetHomeOwner, setTargetHomeOwner] = useState<User | null>(null);
  const [targetHomeRoom, setTargetHomeRoom] = useState<any | null>(null);

  const isArmy = Object.values(RANKS).includes(user.job || '');
  const getScore = (rank?: string) => RANK_SCORES[rank || '无'] || 0;

  useEffect(() => {
    if (selectedBuilding?.id === 'hq' && isArmy) fetchMediationInvites(true);
    if (selectedBuilding?.id === 'armory') fetchSkills();
    if (selectedBuilding?.id === 'barracks') fetchArmyPlayers();
  }, [selectedBuilding, isArmy]);

  useEffect(() => {
    if (!targetHomeOwner) return;
    let alive = true;
    setTargetHomeRoom(null);
    const pullRoom = async () => {
      try {
        const res = await fetch(`/api/rooms/${targetHomeOwner.id}`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('USER_TOKEN') || ''}` }
        });
        const data = await res.json().catch(() => ({}));
        if (!alive) return;
        if (!res.ok || data.success === false || !data.room) {
          showToast(data.message || '读取家园失败');
          setTargetHomeOwner(null);
          return;
        }
        setTargetHomeRoom(data.room);
      } catch {
        if (!alive) return;
        showToast('网络错误，读取家园失败');
        setTargetHomeOwner(null);
      }
    };
    pullRoom();
    return () => {
      alive = false;
    };
  }, [targetHomeOwner, showToast]);

  // --- 小游戏逻辑 ---
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

  // --- 获取所有军队玩家 ---
  const fetchArmyPlayers = async () => {
    try {
      const res = await fetch('/api/users');
      const data = await res.json();
      if (data.success) {
        const rows = Array.isArray(data.users) ? data.users : [];
        const armyStaff = rows.filter((u: any) => u.job && String(u.job).startsWith('军队'));
        setArmyPlayers(armyStaff);
      }
    } catch (e) {
      console.error("无法获取军队名单");
    }
  };

  // --- 资质校验 ---
  const checkQualifications = (targetRank: string) => {
    if ((user.age || 0) < 16) return false; // 年龄必须大于16岁
    const pScore = getScore(user.physicalRank);
    const mScore = getScore(user.mentalRank);
    
    if (targetRank === RANKS.SOLDIER) return pScore >= RANK_SCORES['B+'];
    if (targetRank === RANKS.LIEUTENANT) return mScore >= RANK_SCORES['A+'] && pScore >= RANK_SCORES['A+'];
    if (targetRank === RANKS.COLONEL) return mScore >= RANK_SCORES['S+'] && pScore >= RANK_SCORES['S+'];
    if (targetRank === RANKS.GENERAL) return mScore >= RANK_SCORES['SS+'] && pScore >= RANK_SCORES['SS+'];
    return false;
  };

  // 在 handleJoin 函数中替换原有逻辑
  const handleJoinOrPromote = async (targetJobName: string) => {
    let jobName = targetJobName;
    const age = user.age || 0;

    try {
      // 1. 未分化者彻底拦截
      if (age < 16) {
        return showToast("未分化者禁止加入该阵营，请先前往圣所或伦敦塔。");
      }

      // 2. 16-19岁“未毕业”拦截与降级逻辑
      if (age >= 16 && age <= 19) {
        const confirmMessage =
          "你还没有毕业，真的要加入其他阵营吗？选择【否】将引导你前往伦敦塔成为学生，选择【是】你将只能担任该阵营的最低等级职业。";

        if (!window.confirm(confirmMessage)) {
          showToast("正在为你导航至伦敦塔...");
          onExit(); // 退出当前阵营界面
          return;
        } else {
          const lowestJob = "军队士兵";
          if (jobName !== lowestJob) {
            showToast(`受限于年龄，你被分配到了基层职位：${lowestJob}`);
            jobName = lowestJob;
          }
        }
      }

      // 3. 资质校验
      if (!checkQualifications(jobName)) {
        return showToast(`资质不符！加入 ${jobName} 需要满足相应的精神/肉体等级要求。`);
      }

      // 4. 发送请求
      const res = await fetch('/api/tower/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, jobName })
      });

      const data = await res.json();
      if (data.success) {
        showToast(`欢迎加入，${jobName}。以阵营之名，履行你的职责。`);
        fetchGlobalData();
      } else if (String(data.message || '').includes('已有人') || String(data.message || '').includes('occupied')) {
        // 职位已被占据，提示发起挑战
        const wantChallenge = window.confirm(`${jobName} 已有人担任。是否向现任者发起职位挑战？\n（发起后由同阵营玩家投票决定归属）`);
        if (wantChallenge) {
          const cRes = await fetch('/api/job/challenge', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ challengerId: user.id, targetJobName: jobName })
          });
          const cData = await cRes.json().catch(() => ({} as any));
          showToast(cData.message || (cData.success ? '挑战已发起，等待投票' : '挑战失败'));
          if (cData.success) fetchGlobalData();
        }
      } else {
        showToast(data.message || '加入/晋升失败');
      }
    } catch (e) {
      console.error(e);
      showToast('加入/晋升请求失败，请稍后重试');
    }
  };

  // --- 蒜鸟评理 ---
  const fetchMediationInvites = async (silent = false) => {
    try {
      const res = await fetch(`/api/rp/mediation/invites/${user.id}`, { cache: 'no-store' });
      const data = await res.json().catch(() => ({} as any));
      if (!res.ok || data.success === false) {
        if (!silent) showToast(data.message || '读取评理邀请失败');
        return;
      }
      setMediationInvites(Array.isArray(data.invites) ? data.invites : []);
    } catch {
      if (!silent) showToast('网络异常，读取评理邀请失败');
    }
  };

  const respondMediationInvite = async (inviteId: number, accept: boolean) => {
    if (!inviteId) return;
    try {
      const res = await fetch(`/api/rp/mediation/invites/${inviteId}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, accept })
      });
      const data = await res.json().catch(() => ({} as any));
      if (!res.ok || data.success === false) {
        showToast(data.message || '处理评理邀请失败');
        return;
      }
      if (accept) {
        showToast(data.message || '已介入该对戏纠纷，请前往对戏窗口调解。');
      } else {
        showToast(data.message || '你已拒绝该评理邀请。');
      }
      fetchMediationInvites(true);
      fetchGlobalData();
    } catch {
      showToast('网络异常，处理评理邀请失败');
    }
  };

  // --- 练兵场小游戏 ---
  const startMiniGame = () => {
    if ((user.trainCount || 0) >= 3) return showToast("今日训练次数已耗尽，请注意肌肉劳损！");
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
        showToast(`训练达标！肉体强度得到锤炼。`); 
        fetchGlobalData(); 
      }
    } else {
      showToast(`训练失败，仅完成 ${miniGame.clicks}/30 次，没吃饭吗士兵？`);
    }
  };

  // --- 物理技能学习 ---
  const fetchSkills = async () => {
    const res = await fetch(`/api/skills/available/${user.id}`);
    const data = await res.json();
    if (data.success) setPhysicalSkills(data.skills.filter((s:any) => s.faction === '物理系'));
  };

  const learnSkill = async (skillName: string) => {
    const res = await fetch(`/api/users/${user.id}/skills`, { 
      method: 'POST', 
      headers: { 'Content-Type': 'application/json' }, 
      body: JSON.stringify({ name: skillName }) 
    });
    if (res.ok) showToast(`成功习得战技：${skillName}`);
  };

  return (
    <div className="absolute inset-0 bg-slate-900 overflow-hidden font-sans select-none text-slate-100">
      
      {/* 1. 统一背景图层 (与大地图一致) */}
      <div className="absolute inset-0 z-0">
        <img 
          src="/军队.jpg" 
          className="w-full h-full object-cover opacity-40"
          alt="Army Base"
        />
        {/* 渐变遮罩，增强文字可读性 */}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-900/50 to-slate-950/80" />
      </div>

      {/* 2. 顶部导航 */}
      <div className="absolute top-6 left-6 z-50">
        <button 
          onClick={onExit} 
          className="bg-slate-900/80 backdrop-blur-md text-slate-200 border border-slate-600/50 px-5 py-2.5 rounded-xl font-bold shadow-lg flex items-center gap-2 hover:bg-slate-800 hover:border-slate-500 transition-all active:scale-95"
        >
          <ArrowLeft size={18}/> 
          <span className="hidden md:inline">撤离防区</span>
        </button>
      </div>

      {/* 3. 建筑交互点 */}
      <div className="relative z-10 w-full h-full">
        {buildings.map(b => (
          <div 
            key={b.id} 
            className="absolute transform -translate-x-1/2 -translate-y-1/2 cursor-pointer group touch-manipulation" 
            style={{ left: `${b.x}%`, top: `${b.y}%` }} 
            onClick={() => !isPatrolling && setSelectedBuilding(b)}
          >
            <div className="flex flex-col items-center gap-2">
              <div className="w-12 h-12 md:w-16 md:h-16 bg-slate-800/90 border border-slate-500/50 shadow-[0_0_20px_rgba(0,0,0,0.5)] backdrop-blur-sm flex items-center justify-center text-slate-300 rounded-2xl transition-all group-hover:scale-110 group-hover:bg-sky-600 group-hover:border-sky-400 group-hover:text-white group-active:scale-95">
                {React.cloneElement(b.icon as React.ReactElement, { size: 24 })}
              </div>
              <div className="px-3 py-1 bg-black/60 backdrop-blur-md text-white text-[10px] md:text-xs font-bold rounded-lg border border-white/10 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity shadow-lg whitespace-nowrap">
                {b.name}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 4. 域外战斗动画 */}
      <AnimatePresence>
        {isPatrolling && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-50 flex items-center justify-center bg-red-950/80 backdrop-blur-md">
            <div className="flex flex-col items-center gap-6 p-8">
              <div className="relative">
                <Target size={80} className="text-red-500 animate-ping absolute inset-0 opacity-50"/>
                <Target size={80} className="text-red-500 relative z-10"/>
              </div>
              <h2 className="text-3xl md:text-5xl font-black text-white uppercase tracking-[0.2em] drop-shadow-lg">域外厮杀中</h2>
              <p className="text-red-200 animate-pulse font-mono">尽情厮杀吧...</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 5. 建筑详情弹窗 (响应式侧边栏/底栏) */}
      <AnimatePresence>
        {selectedBuilding && (
          <>
            {/* 遮罩层 (点击空白关闭) */}
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setSelectedBuilding(null)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
            />
            
            {/* 内容面板 */}
            <motion.div 
              initial={{ x: '100%' }} 
              animate={{ x: 0 }} 
              exit={{ x: '100%' }} 
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 right-0 z-50 w-full md:w-[480px] bg-slate-900/95 border-l border-white/10 shadow-2xl flex flex-col"
            >
              {/* 头部 */}
              <div className="p-6 md:p-8 border-b border-white/10 bg-slate-800/50 flex justify-between items-start shrink-0">
                <div>
                  <h2 className="text-2xl md:text-3xl font-black text-white uppercase tracking-wide flex items-center gap-3">
                    {selectedBuilding.icon}
                    {selectedBuilding.name}
                  </h2>
                  <p className="text-sm text-slate-400 mt-2 font-medium">{selectedBuilding.desc}</p>
                </div>
                <button 
                  onClick={() => setSelectedBuilding(null)} 
                  className="p-2 -mr-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-full transition-colors"
                >
                  <X size={24}/>
                </button>
              </div>

              {/* 滚动内容区 */}
              <div className="flex-1 p-6 md:p-8 overflow-y-auto custom-scrollbar space-y-8">
                
                {/* === 指挥部 === */}
                {selectedBuilding.id === 'hq' && (
                  <>
                    <div className="space-y-4">
                      <h3 className="text-white font-black flex items-center gap-2 text-lg"><ShieldAlert size={20} className="text-sky-500"/> 职务管理</h3>
                      {!isArmy ? (
                        <div className="space-y-3">
                          <p className="text-xs text-slate-400 bg-slate-800/50 p-3 rounded-lg border border-white/5">
                            根据你的个人档案（年龄: <span className="text-white">{(user.age || 0) > 0 ? `${user.age}岁` : '未知'}</span>, 精神: <span className="text-sky-400">{user.mentalRank || '无'}</span>, 肉体: <span className="text-rose-400">{user.physicalRank || '无'}</span>），你可以申请以下职位：
                          </p>
                          <div className="grid gap-3">
                            {[
                              { rank: RANKS.GENERAL, req: '精神 SS+, 肉体 SS+' },
                              { rank: RANKS.COLONEL, req: '精神 S+, 肉体 S+' },
                              { rank: RANKS.LIEUTENANT, req: '精神 A+, 肉体 A+' },
                              { rank: RANKS.SOLDIER, req: '肉体 B+' }
                            ].map(job => {
                              const isQualified = checkQualifications(job.rank);
                              return (
                                <button 
                                  key={job.rank}
                                  onClick={() => handleJoinOrPromote(job.rank)}
                                  // disabled={!isQualified} // 让未毕业的人也能点击触发提示
                                  className={`w-full p-4 border rounded-xl flex justify-between items-center transition-all group ${
                                    isQualified 
                                      ? 'bg-slate-800/50 border-emerald-500/30 hover:bg-emerald-500/10 hover:border-emerald-500/80 cursor-pointer' 
                                      : 'bg-slate-900/30 border-slate-700 opacity-60 hover:opacity-100 hover:border-slate-600'
                                  }`}
                                >
                                  <div className="flex flex-col items-start">
                                    <span className={`font-black text-sm ${isQualified ? 'text-emerald-400' : 'text-slate-500'}`}>{job.rank}</span>
                                    <span className="text-[10px] text-slate-400 mt-1">要求: {job.req} (且满16岁)</span>
                                  </div>
                                  <div>
                                    {isQualified ? (
                                      <span className="text-xs font-bold text-emerald-950 bg-emerald-500 px-3 py-1.5 rounded-lg shadow-lg shadow-emerald-500/20 group-hover:scale-105 transition-transform">点击就职</span>
                                    ) : (
                                      <span className="text-[10px] font-bold text-slate-500 bg-slate-800 px-2 py-1 rounded">资质不符</span>
                                    )}
                                  </div>
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="p-4 bg-gradient-to-r from-slate-800 to-slate-900 border border-slate-700 rounded-xl flex justify-between items-center shadow-lg">
                            <div>
                              <span className="text-[10px] uppercase text-slate-500 font-bold tracking-widest block mb-1">当前职级</span>
                              <span className="text-xl font-black text-white">{user.job}</span>
                            </div>
                            <Medal size={32} className="text-amber-500"/>
                          </div>
                          {user.job !== RANKS.GENERAL && (
                            <div className="grid grid-cols-1 gap-2 mt-4">
                              {user.job === RANKS.SOLDIER && <button onClick={() => handleJoinOrPromote(RANKS.LIEUTENANT)} className="w-full py-3 bg-slate-800 text-sky-400 border border-sky-500/30 font-bold text-sm rounded-xl hover:bg-sky-500/10 transition-colors">晋升尉官 (神A+ 体A+)</button>}
                              {user.job === RANKS.LIEUTENANT && <button onClick={() => handleJoinOrPromote(RANKS.COLONEL)} className="w-full py-3 bg-slate-800 text-sky-400 border border-sky-500/30 font-bold text-sm rounded-xl hover:bg-sky-500/10 transition-colors">晋升校官 (神S+ 体S+)</button>}
                              {user.job === RANKS.COLONEL && <button onClick={() => handleJoinOrPromote(RANKS.GENERAL)} className="w-full py-3 bg-slate-800 text-sky-400 border border-sky-500/30 font-bold text-sm rounded-xl hover:bg-sky-500/10 transition-colors">晋升将官 (神SS+ 体SS+)</button>}
                            </div>
                          )}
                        </>
                      )}
                    </div>

                    {isArmy && (
                      <div className="space-y-4 pt-6 border-t border-white/10">
                        <FactionMemberPanel
                          user={user}
                          locationId="army"
                          showToast={showToast}
                          fetchGlobalData={fetchGlobalData}
                          title="军队职位房间"
                        />
                        <div className="flex justify-between items-center mb-2">
                          <h3 className="text-amber-500 font-black flex items-center gap-2 text-lg"><Scale size={20}/> 蒜鸟评理中心</h3>
                          <button onClick={() => fetchMediationInvites()} className="p-2 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"><RefreshCcw size={16}/></button>
                        </div>
                        {mediationInvites.length === 0 ? (
                          <div className="text-center p-8 bg-slate-800/30 rounded-xl border border-dashed border-slate-700">
                            <p className="text-sm text-slate-500">当前无待处理评理邀请。</p>
                          </div>
                        ) : (
                          mediationInvites.map((d) => (
                            <div key={d.id} className="p-4 bg-slate-800/80 border border-amber-500/20 rounded-xl hover:border-amber-500/50 transition-colors">
                              <div className="flex justify-between items-start mb-2">
                                <p className="font-bold text-slate-200 text-sm">{String(d.requestedByName || '匿名玩家')} 发起评理</p>
                                <span className="text-[10px] px-2 py-0.5 bg-amber-500/10 text-amber-500 rounded border border-amber-500/20">评理邀请</span>
                              </div>
                              <p className="text-xs text-slate-400 mb-2 leading-relaxed">
                                发生地点：{String(d.locationName || '未知地点')}
                              </p>
                              <p className="text-xs text-slate-500 mb-4 leading-relaxed line-clamp-2">
                                理由：{String(d.reason || '无')}
                              </p>
                              <div className="grid grid-cols-2 gap-2">
                                <button
                                  onClick={() => respondMediationInvite(Number(d.id || 0), true)}
                                  className="py-2.5 bg-amber-600 text-white text-xs font-black rounded-lg hover:bg-amber-500 shadow-lg shadow-amber-600/20 uppercase tracking-wide"
                                >
                                  介入调解
                                </button>
                                <button
                                  onClick={() => respondMediationInvite(Number(d.id || 0), false)}
                                  className="py-2.5 bg-slate-700 text-slate-300 text-xs font-black rounded-lg hover:bg-slate-600"
                                >
                                  拒绝
                                </button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </>
                )}

                {/* === 域外战场 === */}
                {selectedBuilding.id === 'expedition' && (
                  <div className="text-center space-y-6">
                    <div className="p-8 bg-red-950/20 border border-red-500/30 rounded-2xl relative overflow-hidden group">
                      <div className="absolute inset-0 bg-red-600/5 opacity-0 group-hover:opacity-100 transition-opacity"/>
                      <Skull size={64} className="mx-auto text-red-500 mb-4 group-hover:scale-110 transition-transform duration-500"/>
                      <h3 className="text-xl font-black text-white mb-2">讨伐魔物</h3>
                      <p className="text-sm text-slate-400">每日前往域外击倒魔物，获取军队工资。危险，但值得。</p>
                    </div>
                    <button 
                      onClick={() => {
                        if ((user.workCount || 0) >= 3) return showToast("今日已无力再战！");
                        setIsPatrolling(true);
                        setTimeout(async () => {
                          setIsPatrolling(false);
                          const res = await fetch('/api/tower/work', { 
                            method: 'POST', 
                            headers: { 'Content-Type': 'application/json' }, 
                            body: JSON.stringify({ userId: user.id }) 
                          });
                          const data = await res.json();
                          if (data.success) { showToast(`击倒魔物！获得工资 ${data.reward}G`); fetchGlobalData(); }
                        }, 2500);
                      }}
                      className="w-full py-4 bg-red-600 text-white font-black tracking-widest text-lg rounded-xl shadow-xl shadow-red-600/20 hover:bg-red-500 hover:scale-[1.02] active:scale-95 transition-all"
                    >
                      出发猎杀 ({3 - (user.workCount || 0)}/3)
                    </button>
                  </div>
                )}

                {/* === 练兵场 === */}
                {selectedBuilding.id === 'drill' && (
                  <div className="space-y-6 text-center">
                    <div className="p-6 bg-slate-800/50 border border-white/5 rounded-2xl">
                       <Swords size={48} className="mx-auto text-slate-400 mb-4"/>
                       <h3 className="text-lg font-bold text-white mb-2">极限体能特训</h3>
                       <p className="text-xs text-slate-400">在10秒内狂点30次以提升肉体强度。这是对意志的考验！</p>
                    </div>
                    
                    {!miniGame.active ? (
                      <button onClick={startMiniGame} className="w-full py-4 bg-slate-100 text-slate-900 font-black text-lg rounded-xl hover:bg-white transition-colors shadow-xl">
                        开始特训
                      </button>
                    ) : (
                      <div className="p-8 border-2 border-red-500 rounded-2xl bg-red-950/30 animate-pulse">
                        <p className="text-4xl font-black text-white mb-2 font-mono">{miniGame.timeLeft}s</p>
                        <p className="text-sm text-red-400 mb-6 font-bold uppercase tracking-widest">完成进度：{miniGame.clicks}/30</p>
                        <button 
                          onClick={() => setMiniGame(p => ({ ...p, clicks: p.clicks + 1 }))} 
                          className="w-full py-6 bg-red-600 active:bg-red-500 text-white font-black text-2xl rounded-xl shadow-[0_6px_0_rgb(153,27,27)] active:shadow-none active:translate-y-[6px] transition-all touch-manipulation"
                        >
                          狂点!!
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* === 战技研究所 === */}
                {selectedBuilding.id === 'armory' && (
                  <div className="space-y-6">
                    <div className="bg-sky-950/30 p-4 rounded-xl border border-sky-500/20">
                      <h4 className="font-bold text-sky-400 mb-1 flex items-center gap-2"><Zap size={16}/> 军队秘传</h4>
                      <p className="text-xs text-sky-200/70">军队专属物理系战技，能大幅强化你的近战破坏力。</p>
                    </div>
                    
                    {physicalSkills.length === 0 ? (
                      <div className="text-center py-10 text-slate-500 text-sm">目前没有可供学习的物理战技。</div>
                    ) : (
                      <div className="grid gap-3">
                        {physicalSkills.map(skill => (
                          <div key={skill.id} className="p-4 bg-slate-800 border border-white/5 rounded-xl flex justify-between items-center hover:border-sky-500/50 transition-colors group">
                            <div>
                              <p className="font-bold text-slate-200 group-hover:text-sky-400 transition-colors">{skill.name}</p>
                              <p className="text-[10px] text-slate-500 mt-1">{skill.description}</p>
                            </div>
                            <button 
                              onClick={() => learnSkill(skill.name)} 
                              className="px-4 py-2 bg-sky-600 text-white text-xs font-bold rounded-lg hover:bg-sky-500 shadow-lg shadow-sky-600/20 transition-all active:scale-95"
                            >
                              学习
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* === 军营宿舍区 === */}
                {selectedBuilding.id === 'barracks' && (
                  <div className="space-y-8">
                    {isArmy && (
                      <button onClick={() => setTargetHomeOwner(user)} className="w-full py-4 bg-indigo-600 text-white font-black rounded-xl hover:bg-indigo-500 flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20 transition-all">
                        <Home size={20}/> 回到我的房间
                      </button>
                    )}
                    
                    <div className="space-y-6">
                      {Object.values(RANKS).reverse().map(rank => {
                        const residents = armyPlayers.filter(p => p.job === rank);
                        return (
                          <div key={rank} className="border border-slate-700 bg-slate-800/30 rounded-2xl overflow-hidden">
                            <div className="bg-slate-800/80 px-4 py-3 border-b border-slate-700 flex justify-between items-center">
                              <h4 className="text-xs font-black text-slate-300 uppercase tracking-wider">{rank} 专属住所</h4>
                              <span className="text-[10px] bg-slate-900 px-2 py-0.5 rounded text-slate-500">{residents.length} 人</span>
                            </div>
                            <div className="p-4 grid grid-cols-4 gap-4">
                              {residents.map(p => (
                                <button key={p.id} onClick={() => setTargetHomeOwner(p)} className="flex flex-col items-center group">
                                  <div className="w-12 h-12 rounded-full border-2 border-slate-600 overflow-hidden bg-slate-700 group-hover:border-amber-500 transition-colors mb-2 shadow-lg">
                                    {p.avatarUrl ? <img src={p.avatarUrl} className="w-full h-full object-cover"/> : <span className="text-slate-400 font-black text-xs h-full flex items-center justify-center">{p.name[0]}</span>}
                                  </div>
                                  <span className="text-[10px] text-slate-400 font-bold truncate w-full text-center group-hover:text-amber-500 transition-colors">{p.name}</span>
                                </button>
                              ))}
                              {residents.length === 0 && <div className="col-span-4 text-center text-[10px] text-slate-600 py-4 italic">暂无人员入住</div>}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* 挂载家园拜访系统 */}
      <AnimatePresence>
        {targetHomeOwner && targetHomeRoom && (
          <HomeRoomView
            currentUser={user as any}
            room={targetHomeRoom as any}
            sourceMap={(['sanctuary', 'slums', 'rich_area'].includes(String(targetHomeRoom?.homeLocation || ''))
              ? String(targetHomeRoom.homeLocation)
              : 'slums') as any}
            onBack={() => {
              setTargetHomeRoom(null);
              setTargetHomeOwner(null);
            }}
            showToast={showToast}
            onSaved={(next) => setTargetHomeRoom(next as any)}
            refreshGlobalData={fetchGlobalData}
            onRequestSwitchLocation={(locationId) => {
              setTargetHomeRoom(null);
              setTargetHomeOwner(null);
              onNavigateLocation?.(locationId);
            }}
            onExitToWorld={() => { setTargetHomeRoom(null); setTargetHomeOwner(null); onExit(); }}
            onEnterCustomGameRun={onEnterCustomGameRun}
          />
        )}
      </AnimatePresence>

    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import HomeRoomView, { deriveInitialHomeLocation } from './HomeRoomView';

import {
  ArrowLeft, X,
  HandHeart, Coffee,
  Utensils, Castle, GraduationCap,
  BookOpen, HeartPulse, Sparkles,
} from 'lucide-react';
import { User } from '../types';
import FactionMemberPanel from './shared/FactionMemberPanel';

interface Props {
  user: User;
  onExit: () => void;
  showToast: (msg: string) => void;
  fetchGlobalData: () => void;
  onNavigateLocation?: (locationId: string) => void;
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
  { id: 'admin', name: '行政接待处', x: 22, y: 75, icon: <HandHeart />, desc: '入园登记、入职应聘与领养意向登记。' },
  { id: 'clinic', name: '圣所诊所', x: 82, y: 50, icon: <HeartPulse />, desc: '消耗10金币回满血量，并可研习【治疗系】技能。' },
  { id: 'library', name: '内部绘本馆', x: 68, y: 28, icon: <BookOpen />, desc: '【内部专属】每日3次随机获取低阶技能书。' },
  { id: 'playground', name: '中心游乐场', x: 50, y: 55, icon: <Castle />, desc: '玩耍是幼崽的天性，职工的噩梦。' },
  { id: 'canteen', name: '阳光食堂', x: 78, y: 78, icon: <Utensils />, desc: '按时吃饭才能长得高。' },
  { id: 'dorm', name: '幼年宿舍楼', x: 28, y: 35, icon: <Coffee />, desc: '午睡时间！（生命/精神全满恢复）' },
];

const ROLES = {
  CUB: '圣所幼崽',
  KEEPER: '圣所保育员',
  STAFF: '圣所职工'
};

const RANK_SCORES: Record<string, number> = {
  '无': 0, 'F': 1, 'E': 2, 'D': 3, 'D+': 3.5, 'C': 4, 'C+': 5, 'B': 6, 'B+': 7,
  'A': 8, 'A+': 9, 'S': 10, 'S+': 11, 'SS': 12, 'SS+': 13, 'SSS': 14
};

const GENTLE_CLINIC_NPC = {
  name: '白棠',
  role: '温柔系角色·诊疗护士',
  quote: '别怕，慢慢呼吸。你会好起来的。'
};

export function SanctuaryView({ user, onExit, showToast, fetchGlobalData, onNavigateLocation }: Props) {
  const [selectedBuilding, setSelectedBuilding] = useState<any>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [healSkills, setHealSkills] = useState<any[]>([]);

  // 房间入口
  const [roomEntrances, setRoomEntrances] = useState<RoomEntrance[]>([]);
  const [selectedEntrance, setSelectedEntrance] = useState<RoomEntrance | null>(null);

  // 独立房间页
  const [enteredRoom, setEnteredRoom] = useState<RoomDetail | null>(null);

  const isMember = Object.values(ROLES).includes(user.job || '');
  const isSchoolSupervisor = ['圣子', '圣女', '守塔会会长'].includes(String(user.job || ''));
  const isCub = user.job === ROLES.CUB;
  const isAdult = (user.age || 0) >= 16;
  const getScore = (rank?: string) => RANK_SCORES[rank || '无'] || 0;
  const bleedingLevel = Math.max(0, Number((user as any).bleedingLevel ?? 0));

  const authHeaders = () => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${localStorage.getItem('USER_TOKEN') || ''}`
  });

  // ✅ 仅保留这一处 rooms/init（去重）
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
    if (selectedBuilding?.id === 'clinic') fetchHealSkills();
  }, [selectedBuilding]);

  useEffect(() => {
    let alive = true;
    const pull = async () => {
      try {
        const res = await fetch(`/api/rooms/entrances?locationId=sanctuary&viewerId=${user.id}`);
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

  const checkQualifications = (targetRank: string) => {
    const pScore = getScore(user.physicalRank);
    const mScore = getScore(user.mentalRank);

    if (targetRank === ROLES.CUB) return !isAdult;
    if (targetRank === ROLES.STAFF) return isAdult && mScore >= RANK_SCORES['D+'] && pScore >= RANK_SCORES['D+'];
    if (targetRank === ROLES.KEEPER) return isAdult && mScore >= RANK_SCORES['C+'] && pScore >= RANK_SCORES['D+'];

    return false;
  };

  const handleJoin = async (jobName: string) => {
    if (user.job && user.job !== '无') return showToast(`请先办理当前职务的离职手续：${user.job}`);

    if (!checkQualifications(jobName)) {
      if (jobName === ROLES.CUB) return showToast('行政处：你已经是个大孩子了(≥16岁)，这里不适合你。');
      return showToast(`面试官：抱歉，你的精神力或肉体等级未达标，无法胜任 ${jobName}。`);
    }

    const res = await fetch('/api/tower/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id, jobName })
    });

    const data = await res.json();
    if (data.success) {
      showToast(jobName === ROLES.CUB ? '欢迎入园，小家伙！家园已锁定在圣所。' : `手续办妥，欢迎入职 ${jobName}。`);
      fetchGlobalData();
    } else {
      showToast(data.message || '操作失败');
    }
  };

  const fetchHealSkills = async () => {
    const res = await fetch(`/api/skills/available/${user.id}`);
    const data = await res.json();
    if (data.success) {
      setHealSkills(data.skills.filter((s: any) => s.faction === '治疗系'));
    }
  };

  const learnSkill = async (skillName: string) => {
    const res = await fetch(`/api/users/${user.id}/skills`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: skillName })
    });
    if (res.ok) showToast(`在医务室的观摩中，你学会了：${skillName}`);
  };

  const handleClaimBook = async () => {
    if (!isMember) return showToast('绘本馆阿姨：非本园人员禁止入内借阅哦。');
    if ((user.workCount || 0) >= 3) return showToast('今天借书的次数用完啦，去外面玩一会儿吧。');

    const res = await fetch('/api/tower/work', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id })
    });
    const data = await res.json();

    if (data.success) {
      const books = ['物理系低阶技巧', '元素系低阶火花', '精神系低阶入门', '感知系低阶盲杖', '信息系低阶频段', '治疗系低阶绷带', '强化系低阶蛋白', '炼金系低阶扳手'];
      const book = books[Math.floor(Math.random() * books.length)];

      await fetch(`/api/users/${user.id}/inventory/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: book, qty: 1 })
      });

      setIsPlaying(true);
      setTimeout(() => setIsPlaying(false), 2000);
      showToast(`翻阅绘本时，你发现并获得了：【${book}】！`);
      fetchGlobalData();
    }
  };

  const handleAction = async (type: 'play' | 'eat' | 'work') => {
    if ((user.workCount || 0) >= 3) return showToast(isCub ? '今天玩得太累了，去睡一觉吧。' : '今日排班已满，辛苦了。');

    const res = await fetch('/api/tower/work', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id })
    });
    const data = await res.json();

    if (data.success) {
      const msg = type === 'work' ? '照顾了一群调皮的小鬼。' : '开心！拿到了零花钱。';
      showToast(`${msg} (+${data.reward}G)`);
      if (type === 'play' || type === 'eat') {
        setIsPlaying(true);
        setTimeout(() => setIsPlaying(false), 2000);
      }
      fetchGlobalData();
    }
  };

  const handleRest = async () => {
    const res = await fetch('/api/tower/rest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id })
    });
    if (res.ok) {
      showToast('午睡醒来，精力充沛，状态已回满！');
      fetchGlobalData();
    }
  };

  const handleClinicHeal = async () => {
    try {
      const res = await fetch('/api/sanctuary/clinic/heal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id })
      });
      const data = await res.json().catch(() => ({} as any));
      if (!res.ok || data.success === false) {
        showToast(data.message || '诊疗失败');
        return;
      }
      showToast(data.message || '诊疗完成，血量已回满。');
      fetchGlobalData();
    } catch (e) {
      console.error(e);
      showToast('网络错误，诊疗中断');
    }
  };

  const handleCureBleeding = async () => {
    try {
      const res = await fetch('/api/sanctuary/cure-bleeding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id })
      });
      const data = await res.json().catch(() => ({} as any));
      if (!res.ok || data.success === false) {
        showToast(data.message || '止血失败');
        return;
      }
      showToast(data.message || '止血成功');
      fetchGlobalData();
    } catch (e) {
      console.error(e);
      showToast('网络错误，止血中断');
    }
  };

  const handleGraduate = async () => {
    if (!isAdult) return showToast('还没到 16 岁，不能去伦敦塔哦。');
    if (!confirm('确定申请升学去伦敦塔吗？这将清除当前的幼崽档案。')) return;

    await fetch('/api/tower/quit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id })
    });
    showToast('手续办理完成，请前往大地图的【伦敦塔】报到。');
    fetchGlobalData();
    setSelectedBuilding(null);
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
        sourceMap="sanctuary"
        onBack={() => setEnteredRoom(null)}
        showToast={showToast}
        onSaved={(next) => setEnteredRoom(next as any)}
        refreshGlobalData={fetchGlobalData}
        onRequestSwitchLocation={(locationId) => {
          setEnteredRoom(null);
          onNavigateLocation?.(locationId);
        }}
        onExitToWorld={() => { setEnteredRoom(null); onExit(); }}
      />
    );
  }

  return (
    <div className="absolute inset-0 bg-amber-50 overflow-hidden font-sans select-none">
      <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: "url('/圣所.jpg')" }}>
        <div className="absolute inset-0 bg-orange-100/20 mix-blend-multiply pointer-events-none"></div>
      </div>

      <div className="absolute top-8 left-8 z-50">
        <button onClick={onExit} className="bg-white/90 px-6 py-2 rounded-full font-black shadow-xl flex items-center gap-2 hover:scale-105 transition-all text-amber-800 border-2 border-amber-100">
          <ArrowLeft size={20} /> 离开圣所
        </button>
      </div>

      {/* 房间入口点 */}
      <div className="absolute inset-0 z-20 pointer-events-none">
        {roomEntrances.map((r) => (
          <button
            key={r.ownerId}
            className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-auto"
            style={{ left: `${r.x}%`, top: `${r.y}%` }}
            onClick={() => setSelectedEntrance(r)}
          >
            <div className="w-9 h-9 rounded-full bg-white/95 border border-amber-400 text-amber-700 flex items-center justify-center shadow-lg hover:scale-110 transition-all">
              🏠
            </div>
          </button>
        ))}
      </div>

      {/* 地图交互点 */}
      {buildings.map(b => (
        <div key={b.id} className="absolute transform -translate-x-1/2 -translate-y-1/2 z-10 cursor-pointer group" style={{ left: `${b.x}%`, top: `${b.y}%` }} onClick={() => setSelectedBuilding(b)}>
          <div className="relative flex flex-col items-center">
            <div className="w-14 h-14 bg-white rounded-full shadow-2xl flex items-center justify-center text-amber-500 border-4 border-white group-hover:scale-110 transition-all group-hover:bg-amber-400 group-hover:text-white group-hover:border-amber-200">
              {b.icon}
            </div>
            <div className="mt-2 bg-white/90 backdrop-blur text-amber-900 text-[10px] font-black px-3 py-1 rounded-full shadow-lg border border-amber-100 opacity-0 group-hover:opacity-100 transition-all">
              {b.name}
            </div>
          </div>
        </div>
      ))}

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

      {/* 玩耍/领书特效 */}
      <AnimatePresence>
        {isPlaying && (
          <motion.div initial={{ opacity: 0, scale: 0.5, y: 20 }} animate={{ opacity: 1, scale: 1.2, y: 0 }} exit={{ opacity: 0 }} className="absolute inset-0 z-40 flex items-center justify-center pointer-events-none">
            <div className="text-amber-500 font-black text-6xl drop-shadow-[0_5px_15px_rgba(245,158,11,0.5)] flex flex-col items-center gap-4">
              <Sparkles size={80} className="animate-spin-slow" />
              <span className="tracking-widest">开心！</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 建筑详情弹窗 */}
      <AnimatePresence>
        {selectedBuilding && (
          <motion.div initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 50 }} className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-amber-900/30 backdrop-blur-sm mobile-portrait-safe-overlay">
            <div className="bg-white rounded-[48px] p-8 w-full max-w-md shadow-2xl relative border-8 border-amber-100 flex flex-col max-h-[85vh] mobile-portrait-safe-card mobile-contrast-surface-light">
              <button onClick={() => setSelectedBuilding(null)} className="absolute top-6 right-6 p-2 bg-amber-50 rounded-full text-amber-400 hover:bg-amber-100 transition-colors z-20">
                <X size={20} />
              </button>

              <div className="flex flex-col items-center mb-6 text-center shrink-0">
                <div className="w-20 h-20 bg-amber-50 rounded-full flex items-center justify-center text-amber-500 mb-4 shadow-inner">
                  {React.cloneElement(selectedBuilding.icon, { size: 36 })}
                </div>
                <h2 className="text-2xl font-black text-amber-900">{selectedBuilding.name}</h2>
                <p className="text-xs font-bold text-amber-600 mt-1">{selectedBuilding.desc}</p>
              </div>

              <div className="overflow-y-auto pr-2 custom-scrollbar flex-1">
                {selectedBuilding.id === 'admin' && (
                  <div className="space-y-4">
                    {!isMember && !isSchoolSupervisor ? (
                      <>
                        <div className="p-4 bg-amber-50 rounded-2xl text-xs text-amber-800 mb-4 leading-relaxed border border-amber-100">
                          这里是未分化者的避风港。<br />
                          大人可以在此登记领养，幼崽在此获得庇护。
                        </div>
                        <div className="space-y-3">
                          <RoleBtn title="登记入园 (幼崽)" sub="< 16岁" qualified={checkQualifications(ROLES.CUB)} onClick={() => handleJoin(ROLES.CUB)} />
                          <RoleBtn title="应聘保育员" sub="精神C+ 肉体D+" qualified={checkQualifications(ROLES.KEEPER)} onClick={() => handleJoin(ROLES.KEEPER)} />
                          <RoleBtn title="应聘后勤职工" sub="精神D+ 肉体D+" qualified={checkQualifications(ROLES.STAFF)} onClick={() => handleJoin(ROLES.STAFF)} />
                        </div>
                        {isAdult && (
                          <div className="mt-6 border-t-2 border-dashed border-amber-100 pt-6 text-center">
                            <h4 className="font-black text-amber-700 mb-2">爱心领养意向墙</h4>
                            <p className="text-xs text-amber-600/80 mb-4">如果您愿意为这些孩子提供一个家，请在这里登记意向。随后您可以去游乐场与他们培养感情。</p>
                            <button onClick={() => showToast('已在名册上留下您的名字。去大厅发个消息寻找心仪的崽崽吧！')} className="w-full py-3 bg-amber-100 text-amber-800 font-bold rounded-xl hover:bg-amber-200">
                              登记领养档案
                            </button>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="space-y-3">
                        <div className="p-6 bg-amber-50 rounded-2xl text-center border border-amber-100 shadow-sm">
                          <p className="text-xs font-bold text-amber-600 mb-2 tracking-widest uppercase">身份卡</p>
                          <p className="text-2xl font-black text-amber-900">{user.job}</p>
                        </div>

                        <FactionMemberPanel
                          user={user}
                          locationId="sanctuary"
                          showToast={showToast}
                          fetchGlobalData={fetchGlobalData}
                          title="圣所职位房间"
                        />

                        {!isMember && isSchoolSupervisor && (
                          <div className="p-3 rounded-xl border border-sky-100 bg-sky-50 text-[11px] text-sky-700">
                            你当前以三塔监管身份访问，可直接查看并管理圣所成员。
                          </div>
                        )}

                        {isMember && isCub && isAdult && (
                          <button onClick={handleGraduate} className="w-full py-4 rounded-2xl bg-indigo-500 text-white font-black hover:bg-indigo-600 transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-200">
                            <GraduationCap size={20} /> 申请升学 (去伦敦塔)
                          </button>
                        )}

                        {isMember && (
                          <button
                            onClick={() => {
                              if (confirm('确定要离开圣所吗？')) {
                                fetch('/api/tower/quit', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ userId: user.id })
                                }).then(() => {
                                  showToast('已离校/离职。');
                                  fetchGlobalData();
                                  setSelectedBuilding(null);
                                });
                              }
                            }}
                            className="w-full py-4 rounded-2xl bg-slate-100 text-slate-500 font-black hover:bg-slate-200"
                          >
                            {isCub ? '办理退园' : '申请离职'}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {selectedBuilding.id === 'clinic' && (
                  <div className="space-y-6">
                    <div className="text-center bg-rose-50 p-6 rounded-2xl border border-rose-100">
                      <HeartPulse size={40} className="mx-auto text-rose-500 mb-2" />
                      <p className="text-sm text-rose-800 font-bold">圣所诊所可提供急救：消耗 10 金币将血量回满。</p>
                      <p className="text-[10px] text-rose-600 mt-2">治疗后可继续在此研习【治疗系】基础法门。</p>
                    </div>

                    <div className="p-4 bg-white border border-rose-100 rounded-2xl shadow-sm">
                      <div className="flex items-start gap-3">
                        <div className="w-11 h-11 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center font-black">医护</div>
                        <div className="flex-1">
                          <p className="text-xs text-rose-700 font-black">{GENTLE_CLINIC_NPC.role}</p>
                          <h4 className="text-lg font-black text-slate-800">{GENTLE_CLINIC_NPC.name}</h4>
                          <p className="text-xs text-slate-600 mt-1">“{GENTLE_CLINIC_NPC.quote}”</p>
                        </div>
                      </div>
                      <button onClick={handleClinicHeal} className="w-full mt-4 py-3 bg-rose-500 text-white font-black rounded-xl hover:bg-rose-600 transition-colors">
                        诊疗一次（消耗10金币，HP回满）
                      </button>
                      <div className="mt-3 rounded-xl border border-rose-100 bg-rose-50 p-3">
                        <p className="text-xs text-rose-700 font-bold">当前流血程度：{bleedingLevel.toFixed(1)}%</p>
                        <button onClick={handleCureBleeding} className="w-full mt-2 py-2.5 bg-rose-100 text-rose-700 font-black rounded-xl hover:bg-rose-200 transition-colors">
                          止血治疗（清除流血）
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      {healSkills.length === 0 ? (
                        <div className="text-center text-xs text-slate-400 py-4 font-bold border border-slate-100 rounded-xl">导师外出了，暂时没有可学的医疗技能。</div>
                      ) : (
                        healSkills.map((s) => (
                          <div key={s.id} className="p-4 border border-rose-100 bg-white rounded-xl flex justify-between items-center hover:border-rose-300 transition-colors shadow-sm">
                            <div>
                              <h4 className="font-black text-slate-800 text-sm">{s.name}</h4>
                              <p className="text-[10px] text-slate-500 mt-1">{s.description}</p>
                            </div>
                            <button onClick={() => learnSkill(s.name)} className="px-4 py-1.5 bg-rose-100 text-rose-700 text-xs font-bold rounded-lg hover:bg-rose-200">
                              学习
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}

                {selectedBuilding.id === 'library' && (
                  <div className="text-center space-y-6">
                    <BookOpen size={64} className="mx-auto text-sky-400 mb-2" />
                    <h3 className="text-xl font-black text-slate-800">奇妙绘本馆</h3>
                    <p className="text-xs text-slate-500 max-w-xs mx-auto leading-relaxed">
                      书架上摆满了画着各种神奇力量的图画书。这是给孩子们和职工的专属启蒙读物。
                    </p>

                    {isMember ? (
                      <div className="p-4 border-2 border-sky-100 bg-sky-50 rounded-2xl">
                        <p className="text-xs font-bold text-sky-700 mb-4">
                          每日阅览次数：<span className="text-lg font-black">{3 - (user.workCount || 0)} / 3</span>
                        </p>
                        <button onClick={handleClaimBook} disabled={(user.workCount || 0) >= 3} className="w-full py-4 bg-sky-500 text-white font-black rounded-xl hover:bg-sky-600 disabled:bg-slate-300 transition-all shadow-lg shadow-sky-200">
                          随机抽取 1 本【低阶技能书】
                        </button>
                      </div>
                    ) : (
                      <div className="p-4 bg-slate-100 text-slate-500 font-bold rounded-xl text-sm border border-slate-200">
                        抱歉，绘本馆仅对圣所内部人员开放。
                      </div>
                    )}
                  </div>
                )}

                {['playground', 'canteen'].includes(selectedBuilding.id) && (
                  <div className="space-y-4 text-center">
                    {isMember ? (
                      <>
                        <div className="p-6 bg-amber-50 rounded-3xl border border-amber-100">
                          <div className="text-center text-xs font-bold text-amber-600 mb-4 tracking-widest uppercase">
                            Activity Points: {3 - (user.workCount || 0)} / 3
                          </div>
                          <button
                            onClick={() => handleAction(isCub ? (selectedBuilding.id === 'playground' ? 'play' : 'eat') : 'work')}
                            disabled={(user.workCount || 0) >= 3}
                            className="w-full py-5 rounded-2xl bg-amber-500 text-white text-lg font-black hover:bg-amber-600 disabled:bg-slate-200 disabled:text-slate-400 transition-all shadow-xl shadow-amber-200 active:scale-95"
                          >
                            {isCub ? (selectedBuilding.id === 'playground' ? '去玩滑滑梯！' : '大口吃饭！') : '开始巡视工作'}
                          </button>
                        </div>
                        {!isCub && <p className="text-[10px] text-slate-400">照顾幼崽也能获得一笔不菲的工资奖励哦。</p>}
                      </>
                    ) : (
                      <div className="text-center text-amber-500 font-bold py-6 border border-amber-100 bg-amber-50 rounded-2xl">
                        游玩区和就餐区不对外开放。
                      </div>
                    )}
                  </div>
                )}

                {selectedBuilding.id === 'dorm' && (
                  <div className="space-y-4">
                    {isMember ? (
                      <button onClick={handleRest} className="w-full py-5 rounded-2xl bg-teal-500 text-white text-lg font-black hover:bg-teal-600 transition-all shadow-xl shadow-teal-200 flex items-center justify-center gap-3">
                        <Coffee size={24} />
                        {isCub ? '盖小被子睡午觉' : '在值班室小憩'}
                      </button>
                    ) : (
                      <div className="text-center text-amber-500 font-bold py-6 border border-amber-100 bg-amber-50 rounded-2xl">
                        宿舍重地，闲人免进。
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background-color: #fcd34d; border-radius: 20px; }
      `}</style>
    </div>
  );
}

function RoleBtn({ title, sub, qualified, onClick }: any) {
  return (
    <button
      onClick={onClick}
      disabled={!qualified}
      className={`w-full p-4 rounded-2xl flex justify-between items-center transition-all border-2 relative overflow-hidden
        ${qualified ? 'bg-white border-amber-100 text-amber-900 hover:border-amber-400 hover:shadow-md' : 'bg-slate-50 border-slate-100 opacity-60 cursor-not-allowed'}
      `}
    >
      <span className={`font-black text-sm ${qualified ? 'text-amber-900' : 'text-slate-500'}`}>{title}</span>
      <span className={`text-[10px] font-bold px-2 py-1 rounded-lg ${qualified ? 'bg-amber-100 text-amber-700' : 'text-slate-400'}`}>{sub}</span>
      {!qualified && <span className="absolute top-4 right-4 text-[9px] font-bold text-rose-500 bg-rose-50 px-2 border border-rose-100 rounded">不符</span>}
    </button>
  );
}

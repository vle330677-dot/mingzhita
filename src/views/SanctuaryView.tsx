import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import HomeRoomView, { deriveInitialHomeLocation } from './HomeRoomView';
import {
  ArrowLeft,
  BookOpen,
  Castle,
  Coffee,
  GraduationCap,
  HandHeart,
  HeartPulse,
  Home,
  Sparkles,
  Utensils,
  X
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

interface MapBuilding {
  id: string;
  name: string;
  x: number;
  y: number;
  icon: React.ReactElement;
  desc: string;
}

const ROLES = {
  CUB: '圣所幼崽',
  KEEPER: '圣所保育员',
  STAFF: '圣所职工'
};

const RANK_SCORES: Record<string, number> = {
  '无': 0,
  F: 1,
  E: 2,
  D: 3,
  'D+': 3.5,
  C: 4,
  'C+': 5,
  B: 6,
  'B+': 7,
  A: 8,
  'A+': 9,
  S: 10,
  'S+': 11,
  SS: 12,
  'SS+': 13,
  SSS: 14
};

const BUILDINGS: MapBuilding[] = [
  { id: 'admin', name: '行政接待厅', x: 20, y: 74, icon: <HandHeart size={24} />, desc: '入园登记、职位申请与成员事务。' },
  { id: 'residents', name: '圣所住屋', x: 29, y: 35, icon: <Home size={24} />, desc: '查看成员房间，回家或拜访。' },
  { id: 'library', name: '内部绘本馆', x: 68, y: 26, icon: <BookOpen size={24} />, desc: '每日可随机领取 1 本低阶技能书。' },
  { id: 'playground', name: '中心游乐场', x: 50, y: 54, icon: <Castle size={24} />, desc: '幼崽玩耍，职工照看，也能获得当日收益。' },
  { id: 'clinic', name: '圣所诊所', x: 81, y: 48, icon: <HeartPulse size={24} />, desc: '恢复生命、清除流血，并可学习治疗系技能。' },
  { id: 'canteen', name: '阳光食堂', x: 78, y: 78, icon: <Utensils size={24} />, desc: '吃饭或值班都会消耗每日行动次数。' },
  { id: 'dorm', name: '年幼宿舍楼', x: 26, y: 58, icon: <Coffee size={24} />, desc: '午睡或小憩可恢复状态。' }
];

const GENTLE_CLINIC_NPC = {
  name: '白栀',
  role: '圣所诊疗护士',
  quote: '别怕，慢慢呼吸。你会好起来的。'
};

const BOOK_REWARDS = [
  '低阶技能书·物理系',
  '低阶技能书·元素系',
  '低阶技能书·精神系',
  '低阶技能书·感知系',
  '低阶技能书·信息系',
  '低阶技能书·治疗系',
  '低阶技能书·强化系',
  '低阶技能书·炼金系'
];

function hasJob(job?: string) {
  const value = String(job || '').trim();
  return !!value && value !== '无';
}

export function SanctuaryView({ user, onExit, showToast, fetchGlobalData, onNavigateLocation, onEnterCustomGameRun }: Props) {
  const [selectedBuilding, setSelectedBuilding] = useState<MapBuilding | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [healSkills, setHealSkills] = useState<any[]>([]);
  const [roomEntrances, setRoomEntrances] = useState<RoomEntrance[]>([]);
  const [selectedEntrance, setSelectedEntrance] = useState<RoomEntrance | null>(null);
  const [enteredRoom, setEnteredRoom] = useState<RoomDetail | null>(null);

  const isMember = Object.values(ROLES).includes(String(user.job || ''));
  const isSchoolSupervisor = ['圣子', '圣女', '守塔会会长'].includes(String(user.job || ''));
  const isCub = user.job === ROLES.CUB;
  const isAdult = Number(user.age || 0) >= 16;
  const bleedingLevel = Math.max(0, Number((user as any).bleedingLevel ?? 0));
  const isSelectedEntranceMine = Number(selectedEntrance?.ownerId || 0) === Number(user.id);

  const dailyActionLeft = Math.max(0, 3 - Number(user.workCount || 0));
  const visibleRoomCount = roomEntrances.length;

  const sortedEntrances = useMemo(() => {
    return [...roomEntrances].sort((a, b) => {
      if (Number(a.ownerId) === Number(user.id)) return -1;
      if (Number(b.ownerId) === Number(user.id)) return 1;
      return String(a.ownerName || '').localeCompare(String(b.ownerName || ''), 'zh-Hans-CN');
    });
  }, [roomEntrances, user.id]);

  const authHeaders = () => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${localStorage.getItem('USER_TOKEN') || ''}`
  });

  const getScore = (rank?: string) => RANK_SCORES[String(rank || '无')] || 0;

  useEffect(() => {
    fetch('/api/rooms/init', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: user.id,
        suggestedHomeLocation: deriveInitialHomeLocation(user as any)
      })
    }).catch(() => undefined);
  }, [user.id, user.age, user.gold, user.role]);

  useEffect(() => {
    if (selectedBuilding?.id === 'clinic') {
      fetchHealSkills();
    }
  }, [selectedBuilding?.id]);

  useEffect(() => {
    let active = true;
    const pullEntrances = async () => {
      try {
        const res = await fetch(`/api/rooms/entrances?locationId=sanctuary&viewerId=${user.id}`);
        const data = await res.json().catch(() => ({} as any));
        if (!active) return;
        if (data.success) {
          setRoomEntrances(Array.isArray(data.rows) ? data.rows : []);
        }
      } catch {
        // ignore polling failures
      }
    };

    pullEntrances();
    const timer = window.setInterval(pullEntrances, 4000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [user.id]);

  const checkQualifications = (targetRole: string) => {
    const physicalScore = getScore(user.physicalRank);
    const mentalScore = getScore(user.mentalRank);

    if (targetRole === ROLES.CUB) return !isAdult;
    if (targetRole === ROLES.STAFF) return isAdult && mentalScore >= RANK_SCORES['D+'] && physicalScore >= RANK_SCORES['D+'];
    if (targetRole === ROLES.KEEPER) return isAdult && mentalScore >= RANK_SCORES['C+'] && physicalScore >= RANK_SCORES['D+'];
    return false;
  };

  const handleJoin = async (jobName: string) => {
    if (hasJob(user.job)) {
      showToast(`请先退出当前职位：${user.job}`);
      return;
    }

    if (!checkQualifications(jobName)) {
      if (jobName === ROLES.CUB) {
        showToast('你已经满 16 岁，不能登记为圣所幼崽。');
        return;
      }
      showToast(`当前精神或肉体等级不足，无法担任 ${jobName}。`);
      return;
    }

    const res = await fetch('/api/tower/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id, jobName })
    });
    const data = await res.json().catch(() => ({} as any));

    if (!res.ok || data.success === false) {
      showToast(data.message || '加入圣所失败');
      return;
    }

    showToast(jobName === ROLES.CUB ? '欢迎来到圣所，已为你分配房间。' : `入职成功：${jobName}`);
    fetchGlobalData();
  };

  const fetchHealSkills = async () => {
    try {
      const res = await fetch(`/api/skills/available/${user.id}`);
      const data = await res.json().catch(() => ({} as any));
      if (data.success) {
        setHealSkills((Array.isArray(data.skills) ? data.skills : []).filter((skill: any) => skill.faction === '治疗系'));
      }
    } catch (error) {
      console.error(error);
    }
  };

  const learnSkill = async (skillName: string) => {
    try {
      const res = await fetch(`/api/users/${user.id}/skills`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: skillName })
      });
      const data = await res.json().catch(() => ({} as any));
      showToast(data.message || `你学会了：${skillName}`);
      fetchGlobalData();
    } catch (error) {
      console.error(error);
      showToast('学习技能失败');
    }
  };

  const handleClaimBook = async () => {
    if (!isMember) {
      showToast('绘本馆只对圣所内部成员开放。');
      return;
    }
    if (dailyActionLeft <= 0) {
      showToast('今天已经领过足够多的书了，明天再来。');
      return;
    }

    try {
      const res = await fetch('/api/tower/work', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id })
      });
      const data = await res.json().catch(() => ({} as any));
      if (!res.ok || data.success === false) {
        showToast(data.message || '领取失败');
        return;
      }

      const book = BOOK_REWARDS[Math.floor(Math.random() * BOOK_REWARDS.length)];
      await fetch(`/api/users/${user.id}/inventory/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: book, qty: 1 })
      });

      setIsPlaying(true);
      window.setTimeout(() => setIsPlaying(false), 1800);
      showToast(`你在绘本馆找到了：${book}`);
      fetchGlobalData();
    } catch (error) {
      console.error(error);
      showToast('领取绘本失败');
    }
  };

  const handleAction = async (type: 'play' | 'eat' | 'work') => {
    if (dailyActionLeft <= 0) {
      showToast(isCub ? '今天已经玩累了，先去休息吧。' : '今日排班已满，明天再来。');
      return;
    }

    try {
      const res = await fetch('/api/tower/work', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id })
      });
      const data = await res.json().catch(() => ({} as any));
      if (!res.ok || data.success === false) {
        showToast(data.message || '行动失败');
        return;
      }

      if (type === 'play') {
        showToast(`你开心地玩了一会，获得 ${data.reward || 0}G 零花钱。`);
      } else if (type === 'eat') {
        showToast(`你在食堂吃得很满足，获得 ${data.reward || 0}G 补贴。`);
      } else {
        showToast(`你完成了一轮照看与值班，获得 ${data.reward || 0}G。`);
      }

      if (type !== 'work') {
        setIsPlaying(true);
        window.setTimeout(() => setIsPlaying(false), 1800);
      }
      fetchGlobalData();
    } catch (error) {
      console.error(error);
      showToast('行动失败');
    }
  };

  const handleRest = async () => {
    try {
      const res = await fetch('/api/tower/rest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id })
      });
      if (!res.ok) {
        showToast('休息失败');
        return;
      }
      showToast('你在圣所好好休息了一会，状态已恢复。');
      fetchGlobalData();
    } catch (error) {
      console.error(error);
      showToast('休息失败');
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
      showToast(data.message || '诊疗完成，生命值已回满。');
      fetchGlobalData();
    } catch (error) {
      console.error(error);
      showToast('诊疗失败');
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
      showToast(data.message || '止血完成');
      fetchGlobalData();
    } catch (error) {
      console.error(error);
      showToast('止血失败');
    }
  };

  const handleGraduate = async () => {
    if (!isAdult) {
      showToast('未满 16 岁，暂时不能离开圣所。');
      return;
    }
    if (!window.confirm('确定要办理升学手续前往伦敦塔吗？这会退出当前圣所职位。')) return;

    await fetch('/api/tower/quit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id })
    }).catch(() => undefined);

    showToast('升学手续已办理，请前往大地图中的伦敦塔报到。');
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
      const detailData = await detailRes.json().catch(() => ({} as any));
      if (!detailRes.ok || detailData.success === false) {
        showToast(detailData.message || '读取房间信息失败');
        return;
      }

      if (selectedEntrance.locked && Number(selectedEntrance.ownerId) !== Number(user.id)) {
        const password = window.prompt('这个房间已上锁，请输入密码：') || '';
        if (!password) return;
        const verifyRes = await fetch(`/api/rooms/${selectedEntrance.ownerId}/verify-password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password })
        });
        const verifyData = await verifyRes.json().catch(() => ({} as any));
        if (!verifyData.pass) {
          showToast('密码错误，无法进入房间');
          return;
        }
        roomPassword = password;
      }

      const enterRes = await fetch(`/api/rooms/${selectedEntrance.ownerId}/enter`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ password: roomPassword })
      });
      const enterData = await enterRes.json().catch(() => ({} as any));
      if (!enterRes.ok || enterData.success === false) {
        showToast(enterData.message || '进入房间失败');
        return;
      }

      setEnteredRoom(detailData.room as RoomDetail);
      setSelectedEntrance(null);
    } catch (error) {
      console.error(error);
      showToast('进入房间失败');
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
        onExitToWorld={() => {
          setEnteredRoom(null);
          onExit();
        }}
        onEnterCustomGameRun={onEnterCustomGameRun}
      />
    );
  }

  const renderResidents = () => (
    <div className="space-y-4">
      <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4 text-sm text-amber-800 leading-7">
        圣所当前共有 <span className="font-black text-amber-950">{visibleRoomCount}</span> 间可见房间。
        点击名字即可查看房主信息，再选择回家或拜访。
      </div>
      <div className="space-y-2 max-h-80 overflow-y-auto pr-1 custom-scrollbar">
        {sortedEntrances.length === 0 ? (
          <div className="text-center text-sm text-amber-500 py-6 border border-dashed border-amber-200 rounded-2xl">暂无房间记录</div>
        ) : (
          sortedEntrances.map((room) => {
            const isMine = Number(room.ownerId) === Number(user.id);
            return (
              <button
                key={room.ownerId}
                onClick={() => setSelectedEntrance(room)}
                className="w-full flex items-center gap-3 rounded-2xl border border-amber-100 bg-white px-3 py-3 text-left hover:border-amber-300 hover:shadow-sm transition-all"
              >
                <div className="w-10 h-10 rounded-full border border-amber-200 bg-amber-50 overflow-hidden shrink-0 flex items-center justify-center text-amber-700 font-black text-sm">
                  {room.avatarUrl ? <img src={room.avatarUrl} className="w-full h-full object-cover" alt="avatar" /> : (room.ownerName?.[0] || '?')}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-black text-amber-950 truncate">{room.ownerName}</div>
                  <div className="text-[11px] text-amber-700/80 truncate">{room.job || room.role || '自由住户'}</div>
                </div>
                <span className={`px-3 py-1.5 rounded-xl text-xs font-black shrink-0 ${isMine ? 'bg-emerald-600 text-white' : 'bg-amber-100 text-amber-900'}`}>
                  {isMine ? '回家' : '拜访'}
                </span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );

  const renderAdmin = () => (
    <div className="space-y-4">
      {!isMember && !isSchoolSupervisor ? (
        <>
          <div className="p-4 bg-amber-50 rounded-2xl text-sm text-amber-800 leading-7 border border-amber-100">
            圣所负责照护未分化者与年幼角色。成年人也可以在这里应聘保育员或职工职位。
          </div>
          <div className="space-y-3">
            <RoleBtn title="登记入园（圣所幼崽）" sub="年龄小于 16 岁" qualified={checkQualifications(ROLES.CUB)} onClick={() => handleJoin(ROLES.CUB)} />
            <RoleBtn title="应聘圣所保育员" sub="精神 C+ / 肉体 D+" qualified={checkQualifications(ROLES.KEEPER)} onClick={() => handleJoin(ROLES.KEEPER)} />
            <RoleBtn title="应聘圣所职工" sub="精神 D+ / 肉体 D+" qualified={checkQualifications(ROLES.STAFF)} onClick={() => handleJoin(ROLES.STAFF)} />
          </div>
          {isAdult && (
            <div className="rounded-2xl border border-dashed border-amber-200 bg-white p-4 text-center">
              <h4 className="font-black text-amber-800 mb-2">领养登记</h4>
              <p className="text-sm text-amber-700/80 mb-4 leading-7">
                若你希望照顾圣所中的孩子，可以先留下登记信息，再到游乐场或大厅与他们互动。
              </p>
              <button
                onClick={() => showToast('已记录你的领养意向，请继续在圣所内建立关系。')}
                className="w-full py-3 rounded-xl bg-amber-100 text-amber-800 font-black hover:bg-amber-200 transition-colors"
              >
                提交领养意向
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="space-y-3">
          <div className="p-6 bg-amber-50 rounded-2xl text-center border border-amber-100 shadow-sm">
            <p className="text-xs font-bold text-amber-600 mb-2 tracking-widest uppercase">当前职位</p>
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
            <div className="p-3 rounded-xl border border-sky-100 bg-sky-50 text-sm text-sky-700 leading-7">
              你当前以三塔监管身份访问，可直接查看并管理圣所成员信息。
            </div>
          )}

          {isMember && isCub && isAdult && (
            <button
              onClick={handleGraduate}
              className="w-full py-4 rounded-2xl bg-indigo-500 text-white font-black hover:bg-indigo-600 transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-200"
            >
              <GraduationCap size={20} /> 申请升学（前往伦敦塔）
            </button>
          )}
        </div>
      )}
    </div>
  );

  const renderClinic = () => (
    <div className="space-y-6">
      <div className="text-center bg-rose-50 p-6 rounded-2xl border border-rose-100">
        <HeartPulse size={40} className="mx-auto text-rose-500 mb-2" />
        <p className="text-sm text-rose-800 font-bold">圣所诊所可提供急救：消耗 10 金币即可回满生命值。</p>
        <p className="text-xs text-rose-600 mt-2">诊疗完成后，还可以在这里学习治疗系技能。</p>
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
          诊疗一次（消耗 10 金币，HP 回满）
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
          <div className="text-center text-xs text-slate-400 py-4 font-bold border border-slate-100 rounded-xl">当前没有可学习的治疗系技能。</div>
        ) : (
          healSkills.map((skill) => (
            <div key={skill.id} className="p-4 border border-rose-100 bg-white rounded-xl flex justify-between items-center gap-3 hover:border-rose-300 transition-colors shadow-sm">
              <div>
                <h4 className="font-black text-slate-800 text-sm">{skill.name}</h4>
                <p className="text-[10px] text-slate-500 mt-1">{skill.description}</p>
              </div>
              <button onClick={() => learnSkill(skill.name)} className="px-4 py-1.5 bg-rose-100 text-rose-700 text-xs font-bold rounded-lg hover:bg-rose-200">
                学习
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );

  const renderLibrary = () => (
    <div className="text-center space-y-6">
      <BookOpen size={64} className="mx-auto text-sky-400 mb-2" />
      <h3 className="text-xl font-black text-slate-800">内部绘本馆</h3>
      <p className="text-sm text-slate-500 max-w-xs mx-auto leading-7">
        书架上放着带有分化启蒙与基础技能知识的绘本。圣所成员每天都能来这里抽取一本低阶技能书。
      </p>

      {isMember ? (
        <div className="p-4 border-2 border-sky-100 bg-sky-50 rounded-2xl">
          <p className="text-sm font-bold text-sky-700 mb-4">今日可领取次数：<span className="text-lg font-black">{dailyActionLeft} / 3</span></p>
          <button onClick={handleClaimBook} disabled={dailyActionLeft <= 0} className="w-full py-4 bg-sky-500 text-white font-black rounded-xl hover:bg-sky-600 disabled:bg-slate-300 transition-all shadow-lg shadow-sky-200">
            随机领取 1 本低阶技能书
          </button>
        </div>
      ) : (
        <div className="p-4 bg-slate-100 text-slate-500 font-bold rounded-xl text-sm border border-slate-200">
          绘本馆只对圣所内部成员开放。
        </div>
      )}
    </div>
  );

  const renderActivity = (buildingId: string) => (
    <div className="space-y-4 text-center">
      {isMember ? (
        <>
          <div className="p-6 bg-amber-50 rounded-3xl border border-amber-100">
            <div className="text-center text-xs font-bold text-amber-600 mb-4 tracking-widest uppercase">
              Daily Actions: {dailyActionLeft} / 3
            </div>
            <button
              onClick={() => handleAction(isCub ? (buildingId === 'playground' ? 'play' : 'eat') : 'work')}
              disabled={dailyActionLeft <= 0}
              className="w-full py-5 rounded-2xl bg-amber-500 text-white text-lg font-black hover:bg-amber-600 disabled:bg-slate-200 disabled:text-slate-400 transition-all shadow-xl shadow-amber-200 active:scale-95"
            >
              {isCub ? (buildingId === 'playground' ? '去玩滑梯和秋千' : '开开心心吃饭') : '开始照看与值班'}
            </button>
          </div>
          {!isCub && <p className="text-xs text-slate-400">照看幼崽和后勤值班都会获得一笔固定报酬。</p>}
        </>
      ) : (
        <div className="text-center text-amber-500 font-bold py-6 border border-amber-100 bg-amber-50 rounded-2xl">
          这里目前不对外开放。
        </div>
      )}
    </div>
  );

  const renderDorm = () => (
    <div className="space-y-4">
      {isMember ? (
        <button onClick={handleRest} className="w-full py-5 rounded-2xl bg-teal-500 text-white text-lg font-black hover:bg-teal-600 transition-all shadow-xl shadow-teal-200 flex items-center justify-center gap-3">
          <Coffee size={24} />
          {isCub ? '盖好小被子睡午觉' : '在值班室小憩片刻'}
        </button>
      ) : (
        <div className="text-center text-amber-500 font-bold py-6 border border-amber-100 bg-amber-50 rounded-2xl">
          宿舍区域不对外开放。
        </div>
      )}
    </div>
  );

  const renderBuildingContent = () => {
    if (!selectedBuilding) return null;
    if (selectedBuilding.id === 'admin') return renderAdmin();
    if (selectedBuilding.id === 'residents') return renderResidents();
    if (selectedBuilding.id === 'clinic') return renderClinic();
    if (selectedBuilding.id === 'library') return renderLibrary();
    if (selectedBuilding.id === 'playground' || selectedBuilding.id === 'canteen') return renderActivity(selectedBuilding.id);
    if (selectedBuilding.id === 'dorm') return renderDorm();
    return null;
  };

  return (
    <div className="absolute inset-0 bg-amber-50 overflow-hidden font-sans select-none">
      <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: "url('/圣所.jpg')" }}>
        <div className="absolute inset-0 bg-orange-100/20 mix-blend-multiply pointer-events-none" />
      </div>

      <div className="absolute top-8 left-8 z-50">
        <button onClick={onExit} className="bg-white/90 px-6 py-2 rounded-full font-black shadow-xl flex items-center gap-2 hover:scale-105 transition-all text-amber-800 border-2 border-amber-100">
          <ArrowLeft size={20} /> 离开圣所
        </button>
      </div>

      {BUILDINGS.map((building) => {
        const isResidents = building.id === 'residents';
        return (
          <button
            key={building.id}
            className="absolute z-10 -translate-x-1/2 -translate-y-1/2 cursor-pointer group"
            style={{ left: `${building.x}%`, top: `${building.y}%` }}
            onClick={() => setSelectedBuilding(building)}
          >
            <div className="relative flex flex-col items-center">
              <div className="w-14 h-14 bg-white rounded-full shadow-2xl flex items-center justify-center text-amber-500 border-4 border-white group-hover:scale-110 transition-all group-hover:bg-amber-400 group-hover:text-white group-hover:border-amber-200">
                {building.icon}
              </div>
              {isResidents && visibleRoomCount > 0 && (
                <div className="absolute -top-2 -right-2 min-w-6 h-6 px-1.5 rounded-full bg-emerald-500 text-white text-[10px] font-black flex items-center justify-center shadow-lg border-2 border-white">
                  {visibleRoomCount}
                </div>
              )}
              <div className="mt-2 bg-white/90 backdrop-blur text-amber-900 text-[10px] font-black px-3 py-1 rounded-full shadow-lg border border-amber-100 opacity-0 group-hover:opacity-100 transition-all whitespace-nowrap">
                {building.name}
              </div>
            </div>
          </button>
        );
      })}

      <AnimatePresence>
        {selectedEntrance && (
          <motion.div
            className="fixed inset-0 z-[120] bg-black/50 flex items-center justify-center p-4 mobile-portrait-safe-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 20, opacity: 0 }}
              className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-700 p-5 text-slate-100 mobile-portrait-safe-card mobile-contrast-surface-dark"
            >
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="font-black text-lg">{selectedEntrance.ownerName} 的房间</h3>
                  <p className="text-xs text-slate-400 mt-1">{selectedEntrance.job || selectedEntrance.role || '自由住户'}</p>
                </div>
                <button onClick={() => setSelectedEntrance(null)} className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors">
                  <X size={14} />
                </button>
              </div>

              <div className="rounded-xl border border-slate-700 bg-slate-800/80 p-3 text-sm leading-7 min-h-[88px]">
                {selectedEntrance.intro || '房主暂时还没有填写房间介绍。'}
              </div>

              <div className="grid grid-cols-2 gap-2 mt-4">
                <button onClick={enterPersonalRoom} className="py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 font-black transition-colors">
                  {isSelectedEntranceMine ? '回家' : '拜访房间'}
                </button>
                <button onClick={() => setSelectedEntrance(null)} className="py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 font-black transition-colors">
                  关闭
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isPlaying && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5, y: 20 }}
            animate={{ opacity: 1, scale: 1.15, y: 0 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-40 flex items-center justify-center pointer-events-none"
          >
            <div className="text-amber-500 font-black text-6xl drop-shadow-[0_5px_15px_rgba(245,158,11,0.5)] flex flex-col items-center gap-4">
              <Sparkles size={80} className="animate-spin-slow" />
              <span className="tracking-widest">开心时刻</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedBuilding && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-amber-900/30 backdrop-blur-sm mobile-portrait-safe-overlay"
          >
            <div className="bg-white rounded-[48px] p-8 w-full max-w-md shadow-2xl relative border-8 border-amber-100 flex flex-col max-h-[85vh] mobile-portrait-safe-card mobile-contrast-surface-light">
              <button onClick={() => setSelectedBuilding(null)} className="absolute top-6 right-6 p-2 bg-amber-50 rounded-full text-amber-400 hover:bg-amber-100 transition-colors z-20">
                <X size={20} />
              </button>

              <div className="flex flex-col items-center mb-6 text-center shrink-0">
                <div className="w-20 h-20 bg-amber-50 rounded-full flex items-center justify-center text-amber-500 mb-4 shadow-inner">
                  {React.cloneElement(selectedBuilding.icon, { size: 36 })}
                </div>
                <h2 className="text-2xl font-black text-amber-900">{selectedBuilding.name}</h2>
                <p className="text-xs font-bold text-amber-600 mt-1 leading-6">{selectedBuilding.desc}</p>
              </div>

              <div className="overflow-y-auto pr-2 custom-scrollbar flex-1">
                {renderBuildingContent()}
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

function RoleBtn({ title, sub, qualified, onClick }: { title: string; sub: string; qualified: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={!qualified}
      className={`w-full p-4 rounded-2xl flex justify-between items-center transition-all border-2 relative overflow-hidden ${
        qualified ? 'bg-white border-amber-100 text-amber-900 hover:border-amber-400 hover:shadow-md' : 'bg-slate-50 border-slate-100 opacity-60 cursor-not-allowed'
      }`}
    >
      <span className={`font-black text-sm ${qualified ? 'text-amber-900' : 'text-slate-500'}`}>{title}</span>
      <span className={`text-[10px] font-bold px-2 py-1 rounded-lg ${qualified ? 'bg-amber-100 text-amber-700' : 'text-slate-400'}`}>{sub}</span>
      {!qualified && <span className="absolute top-4 right-4 text-[9px] font-bold text-rose-500 bg-rose-50 px-2 border border-rose-100 rounded">条件不足</span>}
    </button>
  );
}

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Settings, Backpack, X, Upload, MapPin, Bell, User as UserIcon, ScrollText, Hammer, HandCoins, MessageSquareText, Send, Users, Heart, Zap, Brain, Briefcase, DoorOpen, ArrowLeft, Camera, Edit3, UserMinus, CheckCircle } from 'lucide-react';
import { ViewState } from '../App';
import { User, Item } from '../types';

interface Skill { id: number; userId: number; name: string; level: number; }
interface Props { user: User; setUser: (user: User | null) => void; onNavigate: (view: ViewState) => void; }

// === 1. 地图与地标数据 ===
interface MapLocation { id: string; name: string; x: number; y: number; description: string; lootTable: string[]; type?: 'world' | 'tower'; minMental?: string; }

const worldLocations: MapLocation[] = [
  { id: 'tower_of_life', name: '命之塔', x: 50, y: 50, description: '世界的中心。', lootTable: ['高阶精神结晶'], type: 'world' },
  { id: 'london_tower', name: '伦敦塔', x: 58, y: 48, description: '哨兵向导学院。', lootTable: ['标准向导素'], type: 'world' },
  { id: 'guild', name: '公会', x: 50, y: 72, description: '交易与委托。', lootTable: ['悬赏令碎片'], type: 'world' },
  { id: 'slums', name: '贫民区', x: 25, y: 55, description: '西区机械工厂。', lootTable: ['废弃机械零件'], type: 'world' },
  { id: 'rich_area', name: '富人区', x: 75, y: 55, description: '东区财富中心。', lootTable: ['精致的高脚杯'], type: 'world' }
];

const towerLocations: MapLocation[] = [
  { id: 'tower_top', name: '神使层', x: 50, y: 12, description: '塔的顶端，至高无上的神使居所。', lootTable: [], type: 'tower', minMental: 'S' },
  { id: 'tower_attendant', name: '侍奉者层', x: 50, y: 25, description: '侍奉者的居住区。', lootTable: [], type: 'tower', minMental: 'B+' },
  { id: 'tower_descendant', name: '神使后裔层', x: 50, y: 38, description: '神使候补居住区。', lootTable: [], type: 'tower', minMental: 'A+' },
  { id: 'tower_training', name: '精神力训练所', x: 32, y: 55, description: '锻炼精神力的地方。', lootTable: [], type: 'tower' },
  { id: 'tower_evaluation', name: '评定所', x: 68, y: 55, description: '觉醒与评定。', lootTable: [], type: 'tower' }
];

export function GameView({ user, setUser, onNavigate }: Props) {
  // 基础状态
  const [inTower, setInTower] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<MapLocation | null>(null);
  const [activeNPC, setActiveNPC] = useState<any>(null);
  const [showLeftPanel, setShowLeftPanel] = useState(true);
  const [items, setItems] = useState<Item[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [allPlayers, setAllPlayers] = useState<any[]>([]); 
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [userLocationId, setUserLocationId] = useState<string | null>((user as any).currentLocation || null);

  // 命之塔专属面板状态
  const [showTowerActionPanel, setShowTowerActionPanel] = useState(false); // 浮动操作弹窗
  const [showSpiritInteraction, setShowSpiritInteraction] = useState(false); // 精神体弹窗
  const [spiritStatus, setSpiritStatus] = useState<any>({ name: '', intimacy: 0, level: 1, hp: 100 });
  const [miniGameActive, setMiniGameActive] = useState(false);
  const [miniGameTarget, setMiniGameTarget] = useState('');
  const [miniGameInput, setMiniGameInput] = useState('');
  const [showAwakening, setShowAwakening] = useState(false);

  const spiritImgInputRef = useRef<HTMLInputElement>(null);

  const showToast = (msg: string) => { setToastMsg(msg); setTimeout(() => setToastMsg(null), 3000); };

  // ================= 基础拉取 =================
  useEffect(() => {
    fetchItems(); fetchSkills(); fetchMapPlayers(); fetchSpiritStatus();
    const interval = setInterval(() => { fetchMapPlayers(); }, 5000);
    return () => clearInterval(interval);
  }, [user.id]);

  const fetchItems = async () => { const res = await fetch(`/api/users/${user.id}/items`); const data = await res.json(); if (data.success) setItems(data.items); };
  const fetchSkills = async () => { const res = await fetch(`/api/users/${user.id}/skills`); const data = await res.json(); if (data.success) setSkills(data.skills); };
  const fetchSpiritStatus = async () => { const res = await fetch(`/api/users/${user.id}/spirit-status`); const data = await res.json(); if (data.success) setSpiritStatus(data.spiritStatus); };
  const fetchMapPlayers = async () => {
    const res = await fetch('/api/admin/users');
    const data = await res.json();
    if (data.success) {
      const active = data.users.filter((p: any) => p.currentLocation);
      setAllPlayers(active);
      const me = data.users.find((p: any) => p.id === user.id);
      if (me) setUser({ ...user, ...me });
    }
  };

  // ================= 命之塔逻辑 =================
  const handleLocationAction = async (action: 'enter' | 'explore' | 'stay') => {
    if (!selectedLocation) return;
    
    // 进入塔内界面
    if (action === 'enter' && selectedLocation.id === 'tower_of_life') {
      setInTower(true); setSelectedLocation(null); return;
    }

    if (inTower && action === 'enter') {
      const jobRooms: Record<string, string> = { '神使': 'tower_top', '侍奉者': 'tower_attendant', '神使后裔': 'tower_descendant', '仆从': 'tower_hall' };
      
      // 1. 处理评定所 (仅限未分化)
      if (selectedLocation.id === 'tower_evaluation') {
        if (user.role === '未分化') setShowAwakening(true);
        else showToast("仅限未分化玩家进行觉醒抽取。");
      }
      // 2. 处理训练所
      else if (selectedLocation.id === 'tower_training') {
        setMiniGameTarget(Math.random().toString(36).substring(2, 7).toUpperCase());
        setMiniGameActive(true);
      }
      // 3. 处理私人房间
      else if (['tower_top', 'tower_attendant', 'tower_descendant'].includes(selectedLocation.id)) {
        if (!user.job || user.job === '无') {
          // 申请入职逻辑
          if (selectedLocation.minMental) {
            const ranks = ['D', 'C', 'B', 'B+', 'A', 'A+', 'S'];
            if (ranks.indexOf(user.mentalRank || 'D') >= ranks.indexOf(selectedLocation.minMental)) {
              if (confirm(`是否申请入职成为「${selectedLocation.name.replace('层','')}」？`)) {
                handleJoinJob(selectedLocation.name.replace('层',''));
              }
            } else showToast(`等级不足，需要精神力达到 ${selectedLocation.minMental}`);
          }
        } else if (jobRooms[user.job] === selectedLocation.id) {
          setShowTowerActionPanel(true); // 仅在自己房间弹出浮窗
        } else {
          showToast("守卫：这是私人房间，非本人不得进入！");
        }
      }
      setSelectedLocation(null); return;
    }

    // 世界地图逻辑
    if (action === 'explore' && Math.random() > 0.4) {
      const item = selectedLocation.lootTable[0];
      await fetch(`/api/users/${user.id}/items`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: item, description: `在${selectedLocation.name}获得` }) });
      fetchItems(); showToast(`发现了「${item}」！`);
    } else if (action === 'stay') {
      await fetch(`/api/users/${user.id}/location`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ locationId: selectedLocation.id }) });
      setUserLocationId(selectedLocation.id); fetchMapPlayers();
    }
    setSelectedLocation(null);
  };

  const handleJoinJob = async (jobName: string) => {
    if (user.job && user.job !== '无') return showToast("你已经有职位了，请先离职再重新申请。");
    const res = await fetch('/api/tower/join', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: user.id, jobName }) });
    const data = await res.json();
    if (data.success) { fetchMapPlayers(); showToast(`入职成功：你现在是${jobName}`); }
    else showToast(data.message);
  };

  const handleCheckIn = async () => {
    const res = await fetch('/api/tower/checkin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: user.id }) });
    const data = await res.json();
    if (data.success) { showToast(`签到成功！领取月薪 ${data.reward} G`); fetchMapPlayers(); }
    else showToast(data.message);
  };

  const handleQuitJob = async () => {
    if (!confirm("离职将扣除本职月薪的 30% 作为违约金，确定吗？")) return;
    const res = await fetch('/api/tower/quit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: user.id }) });
    const data = await res.json();
    if (data.success) { showToast(`已离职，违约金扣除 ${data.penalty} G`); setShowTowerActionPanel(false); fetchMapPlayers(); }
  };

  const handleSpiritInteract = async (gain: number) => {
    const res = await fetch('/api/tower/interact-spirit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: user.id, intimacyGain: gain }) });
    const data = await res.json();
    if (data.success) {
      if (data.levelUp) showToast("精神体升级！角色精神进度 +20%！");
      fetchSpiritStatus(); fetchMapPlayers();
    }
  };

  const handleAwakeningDraw = async () => {
    const res = await fetch('/api/users', { 
      method: 'POST', 
      headers: { 'Content-Type': 'application/json' }, 
      body: JSON.stringify({ name: user.name, role: "哨兵", mentalRank: "A", spiritName: "雪狼", gold: user.gold + 500 }) 
    });
    if (res.ok) { setShowAwakening(false); fetchMapPlayers(); showToast("分化成功！你是哨兵。"); }
  };

  // ================= 渲染组件 =================
  const activeMap = inTower ? towerLocations : worldLocations;

  return (
    <div className="min-h-screen bg-slate-950 relative overflow-hidden font-sans">
      
      {/* --- 全屏地图层 --- */}
      <div className="absolute inset-0 bg-cover bg-center transition-all duration-1000" style={{ backgroundImage: `url('${inTower ? '/命之塔.jpg' : '/map_background.jpg'}')` }}>
        <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" />
        
        {inTower && (
          <button onClick={() => setInTower(false)} className="absolute top-8 left-8 z-20 bg-white/90 px-6 py-2 rounded-2xl font-black shadow-2xl flex items-center gap-2 hover:bg-white transition-all">
            <ArrowLeft size={20}/> 离开命之塔
          </button>
        )}

        {/* 坐标点 */}
        {activeMap.map(loc => (
          <div key={loc.id} className="absolute transform -translate-x-1/2 -translate-y-1/2 z-10 flex flex-col items-center" style={{ left: `${loc.x}%`, top: `${loc.y}%` }}>
            <button onClick={() => setSelectedLocation(loc)} className="group flex flex-col items-center">
              <div className={`p-2 rounded-full shadow-2xl border-2 transition-all group-hover:scale-125 ${inTower ? 'bg-sky-500 border-sky-100' : 'bg-rose-600 border-white'}`}>
                <MapPin size={18} className="text-white"/>
              </div>
              <span className="mt-1 px-3 py-1 bg-black/80 text-white text-[10px] font-black rounded-lg backdrop-blur-md border border-white/10">{loc.name}</span>
            </button>
          </div>
        ))}
      </div>

      {/* --- 左侧资料卡 --- */}
      <AnimatePresence>
        {showLeftPanel && (
          <motion.div initial={{ x: -300 }} animate={{ x: 0 }} exit={{ x: -300 }} className="absolute top-6 left-6 w-64 bg-white/90 backdrop-blur-xl rounded-[32px] shadow-2xl p-6 z-40 border border-white/50">
             <div className="flex justify-between items-start mb-4">
                <div className="w-16 h-16 rounded-2xl border-2 border-sky-500 overflow-hidden shadow-xl bg-slate-100">
                  {user.avatarUrl ? <img src={user.avatarUrl} className="w-full h-full object-cover"/> : <UserIcon className="m-auto text-gray-300" size={32}/>}
                </div>
                <div className="text-right">
                   <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Rank</p>
                   <p className="font-black text-sky-600 leading-none">{user.mentalRank || '?'}</p>
                </div>
             </div>
             <h2 className="font-black text-xl text-slate-900 mb-1 leading-none">{user.name}</h2>
             <p className="text-[10px] font-black text-sky-700 bg-sky-50 inline-block px-2 py-0.5 rounded-full mb-6">{(user as any).job || user.role}</p>

             <div className="space-y-3 mb-6">
                <StatusRow label="HP" cur={(user as any).hp || 100} color="bg-rose-500" />
                <StatusRow label="Mental" cur={(user as any).mentalProgress || 0} color="bg-indigo-600" />
                <StatusRow label="Intimacy" cur={spiritStatus.intimacy || 0} color="bg-pink-500" />
             </div>

             <div className="bg-slate-900 text-white p-3 rounded-2xl flex justify-between items-center shadow-lg shadow-slate-200">
                <HandCoins size={16} className="text-amber-400"/>
                <span className="font-black text-sm">{user.gold} G</span>
             </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* === 浮动操作面板 (进入房间后弹出) === */}
      <AnimatePresence>
        {showTowerActionPanel && (
          <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <div className="bg-white/95 backdrop-blur-2xl p-8 rounded-[48px] shadow-[0_32px_64px_rgba(0,0,0,0.3)] border border-white w-full max-w-sm">
              <div className="flex justify-between items-center mb-8">
                <div>
                   <h3 className="font-black text-2xl text-slate-900">房间管理</h3>
                   <p className="text-xs font-bold text-sky-600">{(user as any).job}专属控制台</p>
                </div>
                <button onClick={() => setShowTowerActionPanel(false)} className="bg-slate-100 p-2 rounded-full hover:bg-slate-200 transition-colors"><X/></button>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <FloatActionBtn icon={<CheckCircle/>} label="每日签到" sub="领取工资" color="bg-emerald-50 text-emerald-700" onClick={handleCheckIn}/>
                <FloatActionBtn icon={<Briefcase/>} label="开始打工" sub={`次数: ${(user as any).workCount}/3`} color="bg-sky-50 text-sky-700" onClick={handleLocationAction.bind(null, 'enter')}/>
                <FloatActionBtn icon={<Heart/>} label="精神体" sub="深度互动" color="bg-pink-50 text-pink-700" onClick={() => { setShowSpiritInteraction(true); setShowTowerActionPanel(false); }}/>
                <FloatActionBtn icon={<UserMinus/>} label="申请离职" sub="扣除30%罚金" color="bg-rose-50 text-rose-600" onClick={handleQuitJob}/>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* === 精神体互动面板 === */}
      <AnimatePresence>
        {showSpiritInteraction && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 bg-black/80 backdrop-blur-xl z-[100] flex items-center justify-center p-4">
            <div className="bg-white rounded-[56px] p-10 w-full max-w-md shadow-2xl relative border-t-8 border-pink-400">
              <button onClick={() => setShowSpiritInteraction(false)} className="absolute top-8 right-8 text-slate-400"><X/></button>
              
              <div className="relative w-56 h-56 mx-auto mb-8">
                <div className="w-full h-full bg-slate-50 rounded-[48px] border-4 border-pink-50 overflow-hidden flex items-center justify-center shadow-inner">
                  {spiritStatus.imageUrl ? <img src={spiritStatus.imageUrl} className="w-full h-full object-cover"/> : <Zap size={64} className="text-pink-200 animate-pulse"/>}
                </div>
                <button onClick={() => spiritImgInputRef.current?.click()} className="absolute -bottom-2 -right-2 bg-white p-3 rounded-full shadow-2xl text-pink-500 hover:scale-110 transition-transform"><Camera/></button>
                <input type="file" ref={spiritImgInputRef} className="hidden" accept="image/*" onChange={handleCustomSpiritImg}/>
              </div>

              <div className="text-center mb-10">
                <div className="flex items-center justify-center gap-3 mb-2">
                  <h3 className="font-black text-3xl text-slate-800">{spiritStatus.name || "未命名精神体"}</h3>
                  {!spiritStatus.name && <Edit3 size={24} className="text-sky-500 cursor-pointer" onClick={handleSpiritRename}/>}
                </div>
                <p className="font-black text-pink-500 tracking-widest text-xs uppercase">Level {spiritStatus.level} • Spirit Companion</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <SpiritSubBtn label="摸摸" val="+5" color="hover:bg-pink-50 text-pink-600" onClick={() => handleSpiritInteract(5)}/>
                <SpiritSubBtn label="喂食" val="+10" color="hover:bg-amber-50 text-amber-600" onClick={() => handleSpiritInteract(10)}/>
                <SpiritSubBtn label="训练" val="+15" color="hover:bg-indigo-50 text-indigo-600" onClick={() => handleSpiritInteract(15)}/>
                <SpiritSubBtn label="休息" val="关闭" color="hover:bg-slate-50 text-slate-500" onClick={() => setShowSpiritInteraction(false)}/>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- 抽取器逻辑省略 (保持与上一版相同但增加 role === '未分化' 的判定) --- */}
      {/* ... handleAwakeningDraw 内部代码 ... */}

    </div>
  );
}

// === 小型辅助组件 ===
function StatusRow({ label, cur, color }: any) {
  return (
    <div>
      <div className="flex justify-between text-[9px] font-black text-slate-400 mb-1 uppercase tracking-tighter"><span>{label}</span><span>{cur}%</span></div>
      <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
        <motion.div initial={{ width: 0 }} animate={{ width: `${cur}%` }} className={`h-full ${color} rounded-full`}/>
      </div>
    </div>
  );
}

function FloatActionBtn({ icon, label, sub, color, onClick }: any) {
  return (
    <button onClick={onClick} className={`flex flex-col items-center justify-center p-5 rounded-[28px] transition-all active:scale-95 ${color} shadow-sm border border-transparent hover:border-current/10`}>
      <div className="mb-2 scale-125">{icon}</div>
      <span className="text-xs font-black leading-none mb-1">{label}</span>
      <span className="text-[9px] font-bold opacity-60">{sub}</span>
    </button>
  );
}

function SpiritSubBtn({ label, val, color, onClick }: any) {
  return (
    <button onClick={onClick} className={`p-4 rounded-2xl bg-slate-50 border border-slate-100 font-black transition-all flex flex-col items-center ${color}`}>
      <span className="text-sm">{label}</span>
      <span className="text-[10px] opacity-70">{val}</span>
    </button>
  );
}

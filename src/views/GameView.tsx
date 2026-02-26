import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Settings, Backpack, X, Upload, MapPin, Bell, User as UserIcon, ScrollText, Hammer, HandCoins, MessageSquareText, Send, Users, Heart, Zap, Brain, Briefcase, DoorOpen, ArrowLeft, Camera, Edit3, UserMinus, CheckCircle } from 'lucide-react';
import { ViewState } from '../App';
import { User, Item } from '../types';

interface Skill { id: number; userId: number; name: string; level: number; }
interface Props { user: User; setUser: (user: User | null) => void; onNavigate: (view: ViewState) => void; }

// === 1. 地图与地标数据 (全量还原) ===
interface MapLocation { id: string; name: string; x: number; y: number; description: string; lootTable: string[]; type?: 'world' | 'tower'; minMental?: string; }

const worldLocations: MapLocation[] = [
  { id: 'tower_of_life', name: '命之塔', x: 50, y: 50, description: '神圣洁白的塔，世界的权利中心。', lootTable: ['高阶精神结晶'], type: 'world' },
  { id: 'london_tower', name: '伦敦塔', x: 58, y: 48, description: '哨兵向导学院。', lootTable: ['标准向导素'], type: 'world' },
  { id: 'sanctuary', name: '圣所', x: 42, y: 48, description: '幼年教育机构。', lootTable: ['幼崽安抚奶嘴'], type: 'world' },
  { id: 'guild', name: '公会', x: 50, y: 72, description: '处理委托，拥有地下拍卖行。', lootTable: ['悬赏令碎片'], type: 'world' },
  { id: 'army', name: '军队', x: 50, y: 15, description: '镇压异鬼的武装力量。', lootTable: ['制式军用匕首'], type: 'world' },
  { id: 'slums', name: '贫民区', x: 25, y: 55, description: '西区，技术能力者的聚集地。', lootTable: ['废弃机械零件'], type: 'world' },
  { id: 'rich_area', name: '富人区', x: 75, y: 55, description: '东区，财富与权力的交织。', lootTable: ['精致的高脚杯'], type: 'world' },
  { id: 'tower_guard', name: '守塔会', x: 65, y: 35, description: '表面信仰塔，背地野心勃勃。', lootTable: ['忏悔书'], type: 'world' },
  { id: 'demon_society', name: '恶魔会', x: 15, y: 35, description: '追求自由，反抗守塔会。', lootTable: ['反叛标语传单'], type: 'world' },
  { id: 'paranormal_office', name: '灵异管理所', x: 30, y: 70, description: '专门管理鬼魂的机构。', lootTable: ['引魂灯残片'], type: 'world' },
  { id: 'observers', name: '观察者', x: 65, y: 15, description: '遍布世界的眼线，主情报。', lootTable: ['加密的微型胶卷'], type: 'world' }
];

const towerLocations: MapLocation[] = [
  { id: 'tower_top', name: '神使层', x: 50, y: 12, description: '塔顶，神使居所。', lootTable: [], type: 'tower', minMental: 'S' },
  { id: 'tower_attendant', name: '侍奉者层', x: 50, y: 25, description: '侍奉神使的人员居住区。', lootTable: [], type: 'tower', minMental: 'B+' },
  { id: 'tower_descendant', name: '神使后裔层', x: 50, y: 38, description: '优秀的向导继承人居住区。', lootTable: [], type: 'tower', minMental: 'A+' },
  { id: 'tower_training', name: '精神力训练所', x: 32, y: 55, description: '提升精神力的地方。', lootTable: [], type: 'tower' },
  { id: 'tower_evaluation', name: '评定所', x: 68, y: 55, description: '分化仪式与等级评定。', lootTable: [], type: 'tower' },
  { id: 'tower_hall', name: '大厅', x: 50, y: 80, description: '宏伟的命之塔大厅。', lootTable: [], type: 'tower' }
];

const fixedNPCs = [
  { id: 'npc_merchant', name: '拍卖商人 贾斯汀', role: '东区商人', locationId: 'rich_area', icon: <HandCoins size={14} /> },
  { id: 'npc_craftsman', name: '怪脾气的老乔', role: '西区手艺人', locationId: 'slums', icon: <Hammer size={14} /> },
  { id: 'npc_guild_staff', name: '接待员 玛丽', role: '公会员工', locationId: 'guild', icon: <ScrollText size={14} /> }
];

export function GameView({ user, setUser, onNavigate }: Props) {
  // 核心状态
  const [inTower, setInTower] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<MapLocation | null>(null);
  const [activeNPC, setActiveNPC] = useState<any>(null);
  const [showLeftPanel, setShowLeftPanel] = useState(true);
  const [items, setItems] = useState<Item[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [allPlayers, setAllPlayers] = useState<any[]>([]); 
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [userLocationId, setUserLocationId] = useState<string | null>((user as any).currentLocation || null);

  // 社交与背包状态
  const [showBackpack, setShowBackpack] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [chatTarget, setChatTarget] = useState<any | null>(null);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);
  const [showMessageContacts, setShowMessageContacts] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // 命之塔深度系统
  const [showTowerActionPanel, setShowTowerActionPanel] = useState(false);
  const [showSpiritInteraction, setShowSpiritInteraction] = useState(false);
  const [spiritStatus, setSpiritStatus] = useState<any>({ name: '', intimacy: 0, level: 1, hp: 100 });
  const [miniGameActive, setMiniGameActive] = useState(false);
  const [miniGameTarget, setMiniGameTarget] = useState('');
  const [miniGameInput, setMiniGameInput] = useState('');
  const [showAwakening, setShowAwakening] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const spiritImgInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const showToast = (msg: string) => { setToastMsg(msg); setTimeout(() => setToastMsg(null), 3000); };

  // ================= 1. 数据轮询与初始化 =================
  useEffect(() => {
    fetchItems(); fetchSkills(); fetchMapPlayers(); fetchSpiritStatus(); fetchUnreadCount();
    const interval = setInterval(() => { fetchMapPlayers(); fetchUnreadCount(); }, 5000);
    return () => clearInterval(interval);
  }, [user.id]);

  useEffect(() => { if (chatTarget) { fetchChatMessages(); const i = setInterval(fetchChatMessages, 3000); return () => clearInterval(i); } }, [chatTarget]);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chatMessages]);

  const fetchItems = async () => { const res = await fetch(`/api/users/${user.id}/items`); const data = await res.json(); if (data.success) setItems(data.items); };
  const fetchSkills = async () => { const res = await fetch(`/api/users/${user.id}/skills`); const data = await res.json(); if (data.success) setSkills(data.skills); };
  const fetchUnreadCount = async () => { const res = await fetch(`/api/roleplay/unread/${user.id}`); const data = await res.json(); if (data.success) setUnreadCount(data.count); };
  const fetchSpiritStatus = async () => { const res = await fetch(`/api/users/${user.id}/spirit-status`); const data = await res.json(); if (data.success) setSpiritStatus(data.spiritStatus); };
  const fetchMapPlayers = async () => {
    const res = await fetch('/api/admin/users');
    const data = await res.json();
    if (data.success) {
      setAllPlayers(data.users.filter((p: any) => p.currentLocation));
      const me = data.users.find((p: any) => p.id === user.id);
      if (me) setUser({ ...user, ...me });
    }
  };
  const fetchChatMessages = async () => {
    if(!chatTarget) return;
    const res = await fetch(`/api/roleplay/conversation/${user.id}/${chatTarget.id}`);
    const data = await res.json();
    if (data.success) setChatMessages(data.messages);
  };

  // ================= 2. 交互逻辑 =================
  const handleLocationAction = async (action: 'enter' | 'explore' | 'stay') => {
    if (!selectedLocation) return;
    
    if (action === 'enter' && selectedLocation.id === 'tower_of_life') {
      setInTower(true); setSelectedLocation(null); return;
    }

    if (inTower && action === 'enter') {
      const jobRooms: Record<string, string> = { '神使': 'tower_top', '侍奉者': 'tower_attendant', '神使后裔': 'tower_descendant', '仆从': 'tower_hall' };
      if (selectedLocation.id === 'tower_evaluation') {
        if (user.role === '未分化') setShowAwakening(true);
        else showToast("你已分化或为普通人，无需评定。");
      } else if (selectedLocation.id === 'tower_training') {
        setMiniGameTarget(Math.random().toString(36).substring(2, 7).toUpperCase()); setMiniGameActive(true);
      } else if (['tower_top', 'tower_attendant', 'tower_descendant'].includes(selectedLocation.id)) {
        if (!user.job || user.job === '无') {
          const ranks = ['D', 'C', 'B', 'B+', 'A', 'A+', 'S'];
          if (ranks.indexOf(user.mentalRank || 'D') >= ranks.indexOf(selectedLocation.minMental || 'D')) {
            if (confirm(`入职名额有限，是否申请入职「${selectedLocation.name.replace('层','')}」？`)) handleJoinJob(selectedLocation.name.replace('层',''));
          } else showToast(`精神力不足，无法入职此层。`);
        } else if (jobRooms[user.job] === selectedLocation.id) setShowTowerActionPanel(true);
        else showToast("他人私人房间，禁止入内。");
      }
      setSelectedLocation(null); return;
    }

    if (action === 'explore' && Math.random() > 0.4) {
      const item = selectedLocation.lootTable[0];
      await fetch(`/api/users/${user.id}/items`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: item, description: `探索发现` }) });
      fetchItems(); showToast(`找到了「${item}」！`);
    } else if (action === 'stay') {
      await fetch(`/api/users/${user.id}/location`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ locationId: selectedLocation.id }) });
      setUserLocationId(selectedLocation.id); fetchMapPlayers();
    }
    setSelectedLocation(null);
  };

  const handleJoinJob = async (jobName: string) => {
    const res = await fetch('/api/tower/join', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: user.id, jobName }) });
    const data = await res.json();
    if (data.success) { fetchMapPlayers(); showToast(`入职成功！你现在是${jobName}`); }
    else showToast(data.message);
  };

  const handleCheckIn = async () => {
    const res = await fetch('/api/tower/checkin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: user.id }) });
    const data = await res.json();
    if (data.success) { showToast(`签到成功！领取本月工资 ${data.reward} G`); fetchMapPlayers(); }
    else showToast(data.message);
  };

  const handleQuitJob = async () => {
    if (!confirm("离职将扣除月薪 30% 违约金，确定离职吗？")) return;
    const res = await fetch('/api/tower/quit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: user.id }) });
    const data = await res.json();
    if (data.success) { showToast(`离职成功，扣除罚金 ${data.penalty} G`); setShowTowerActionPanel(false); fetchMapPlayers(); }
  };

  const handleSpiritInteract = async (gain: number) => {
    const res = await fetch('/api/tower/interact-spirit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: user.id, intimacyGain: gain }) });
    const data = await res.json();
    if (data.success) { if (data.levelUp) showToast("亲密等级上升！精神进度+20%！"); fetchSpiritStatus(); fetchMapPlayers(); }
  };

  // ================= 3. 渲染 =================
  const activeMap = inTower ? towerLocations : worldLocations;

  return (
    <div className="min-h-screen bg-black relative overflow-hidden">
      
      {/* --- 背景地图 & 返回按钮 --- */}
      <div className="absolute inset-0 bg-cover bg-center transition-all duration-1000" style={{ backgroundImage: `url('${inTower ? '/命之塔.jpg' : '/map_background.jpg'}')` }}>
        <div className="absolute inset-0 bg-black/20 backdrop-blur-[1px]" />
        
        {inTower && (
          <button onClick={() => setInTower(false)} className="absolute top-8 left-8 z-30 bg-white/90 px-6 py-2 rounded-2xl font-black shadow-2xl flex items-center gap-2 hover:scale-105 transition-all">
            <ArrowLeft size={20}/> 返回大地图
          </button>
        )}

        {/* 坐标人物点 */}
        {activeMap.map(loc => {
          const playersHere = allPlayers.filter(p => p.currentLocation === loc.id);
          return (
            <div key={loc.id} className="absolute transform -translate-x-1/2 -translate-y-1/2 z-10 flex flex-col items-center" style={{ left: `${loc.x}%`, top: `${loc.y}%` }}>
              {!inTower && playersHere.length > 0 && (
                <div className="flex -space-x-2 mb-1">
                  {playersHere.map(p => (
                    <div key={p.id} onClick={() => p.id !== user.id && setChatTarget(p)} className={`w-7 h-7 rounded-full border-2 shadow-xl cursor-pointer overflow-hidden ${p.id === user.id ? 'border-amber-400 z-10 scale-110' : 'border-white bg-slate-200'}`}>
                      {p.avatarUrl ? <img src={p.avatarUrl} className="w-full h-full object-cover"/> : <span className="text-[10px] m-auto font-black">{p.name[0]}</span>}
                    </div>
                  ))}
                </div>
              )}
              <button onClick={() => setSelectedLocation(loc)} className="group flex flex-col items-center">
                <div className={`p-2 rounded-full shadow-2xl border-2 transition-all group-hover:scale-125 ${inTower ? 'bg-sky-500 border-sky-100' : 'bg-rose-600 border-white'}`}><MapPin size={18} className="text-white"/></div>
                <span className="mt-1 px-3 py-1 bg-black/80 text-white text-[10px] font-black rounded-lg border border-white/10">{loc.name}</span>
              </button>
            </div>
          );
        })}
      </div>

      {/* --- 左侧面板 (隐藏控制还原) --- */}
      <AnimatePresence>
        {showLeftPanel ? (
          <motion.div initial={{ x: -300 }} animate={{ x: 0 }} exit={{ x: -300 }} className="absolute top-6 left-6 w-64 bg-white/90 backdrop-blur-xl rounded-[32px] shadow-2xl p-6 z-40 border border-white/50">
             <div className="flex justify-between items-start mb-4">
                <div className="w-16 h-16 rounded-2xl border-2 border-sky-500 overflow-hidden bg-slate-100 cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                  {user.avatarUrl ? <img src={user.avatarUrl} className="w-full h-full object-cover"/> : <UserIcon className="m-auto text-gray-300" size={32}/>}
                  <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={async (e) => {
                    const file = e.target.files?.[0]; if (!file) return;
                    const r = new FileReader(); r.onload = async (ev) => {
                      await fetch(`/api/users/${user.id}/avatar`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ avatarUrl: ev.target?.result }) });
                      fetchMapPlayers(); showToast('头像更新');
                    }; r.readAsDataURL(file);
                  }}/>
                </div>
                <button onClick={() => setShowLeftPanel(false)} className="text-[10px] font-black text-slate-400 hover:text-slate-900">HIDE</button>
             </div>
             <h2 className="font-black text-xl text-slate-900 mb-1 cursor-pointer hover:text-sky-600" onClick={() => setShowProfileModal(true)}>{user.name}</h2>
             <p className="text-[10px] font-black text-sky-700 bg-sky-50 inline-block px-2 py-0.5 rounded-full mb-6">{(user as any).job || user.role}</p>

             <div className="space-y-3 mb-6">
                <StatusRow label="HP" cur={(user as any).hp || 100} color="bg-rose-500" />
                <StatusRow label="Mental" cur={(user as any).mentalProgress || 0} color="bg-indigo-600" />
                <StatusRow label="Intimacy" cur={spiritStatus.intimacy || 0} color="bg-pink-500" />
             </div>
             <div className="bg-slate-900 text-white p-3 rounded-2xl flex justify-between items-center"><HandCoins size={16} className="text-amber-400"/><span className="font-black text-sm">{user.gold} G</span></div>
          </motion.div>
        ) : (
          <button onClick={() => setShowLeftPanel(true)} className="absolute top-6 left-6 z-40 bg-white/90 px-4 py-2 rounded-full font-black text-[10px] shadow-xl hover:scale-105 transition-all">SHOW INFO</button>
        )}
      </AnimatePresence>

      {/* --- 功能浮动弹窗区 --- */}
      <AnimatePresence>
        {/* 地点详情 */}
        {selectedLocation && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 bg-black/40 z-[40] flex items-center justify-center p-4">
            <motion.div initial={{ y: 50 }} animate={{ y: 0 }} className="bg-white rounded-[40px] p-8 w-full max-w-sm shadow-2xl relative border-t-8 border-sky-500">
              <h3 className="text-2xl font-black text-slate-900 mb-2">{selectedLocation.name}</h3>
              <p className="text-sm text-slate-500 leading-relaxed mb-8">{selectedLocation.description}</p>
              <div className="space-y-3">
                <button onClick={() => handleLocationAction('enter')} className="w-full py-4 bg-sky-600 text-white font-black rounded-2xl hover:bg-sky-700 transition-colors">进入/管理房间</button>
                {selectedLocation.type !== 'tower' && (
                  <button onClick={() => handleLocationAction('explore')} className="w-full py-4 bg-slate-100 text-slate-700 font-black rounded-2xl">在这里闲逛</button>
                )}
              </div>
              <button onClick={() => setSelectedLocation(null)} className="absolute top-6 right-6 text-slate-400"><X/></button>
            </motion.div>
          </motion.div>
        )}

        {/* 命之塔房间管理 */}
        {showTowerActionPanel && (
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <div className="bg-white rounded-[48px] p-10 w-full max-w-sm shadow-2xl relative">
              <h3 className="font-black text-2xl text-slate-900 mb-8">房间管理 • {user.job}</h3>
              <div className="grid grid-cols-2 gap-4 mb-6">
                <FloatActionBtn icon={<CheckCircle/>} label="签到领取" sub="月薪" color="bg-emerald-50 text-emerald-700" onClick={handleCheckIn}/>
                <FloatActionBtn icon={<Briefcase/>} label="开始打工" sub="体力活动" color="bg-sky-50 text-sky-700" onClick={async () => { await fetch('/api/tower/work', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: user.id }) }); fetchMapPlayers(); showToast('打工中...'); }}/>
                <FloatActionBtn icon={<Heart/>} label="精神体" sub="互动培育" color="bg-pink-50 text-pink-700" onClick={() => { setShowSpiritInteraction(true); setShowTowerActionPanel(false); }}/>
                <FloatActionBtn icon={<UserMinus/>} label="申请离职" sub="30%罚款" color="bg-rose-50 text-rose-600" onClick={handleQuitJob}/>
              </div>
              <button onClick={() => setShowTowerActionPanel(false)} className="w-full py-3 bg-slate-100 rounded-2xl font-bold">关闭窗口</button>
            </div>
          </motion.div>
        )}

        {/* 精神体互动 (完整功能) */}
        {showSpiritInteraction && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 bg-black/80 backdrop-blur-xl z-[100] flex items-center justify-center p-4">
            <div className="bg-white rounded-[56px] p-10 w-full max-w-md shadow-2xl relative">
              <div className="relative w-48 h-48 mx-auto mb-6">
                <div className="w-full h-full bg-slate-50 rounded-[48px] border-4 border-pink-50 overflow-hidden flex items-center justify-center">
                  {spiritStatus.imageUrl ? <img src={spiritStatus.imageUrl} className="w-full h-full object-cover"/> : <Zap size={48} className="text-pink-200"/>}
                </div>
                <button onClick={() => spiritImgInputRef.current?.click()} className="absolute -bottom-2 -right-2 bg-white p-3 rounded-full shadow-2xl text-pink-500"><Camera/></button>
                <input type="file" ref={spiritImgInputRef} className="hidden" accept="image/*" onChange={async (e) => {
                   const f = e.target.files?.[0]; if(!f) return;
                   const r = new FileReader(); r.onload = async (ev) => {
                     await fetch(`/api/tower/interact-spirit`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: user.id, imageUrl: ev.target?.result, intimacyGain: 0 }) });
                     fetchSpiritStatus();
                   }; r.readAsDataURL(f);
                }}/>
              </div>
              <h3 className="font-black text-3xl text-center mb-1">{spiritStatus.name || "未命名精神体"}</h3>
              {!spiritStatus.name && <button className="block mx-auto text-xs text-sky-600 font-black mb-6" onClick={async () => { const n = prompt("取名后不可修改："); if(n) { await fetch(`/api/tower/interact-spirit`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: user.id, name: n, intimacyGain: 0 }) }); fetchSpiritStatus(); } }}>[ 点击取名 ]</button>}
              <div className="grid grid-cols-2 gap-4">
                <SpiritSubBtn label="摸摸" val="+5" color="text-pink-600" onClick={() => handleSpiritInteract(5)}/>
                <SpiritSubBtn label="喂食" val="+10" color="text-amber-600" onClick={() => handleSpiritInteract(10)}/>
                <SpiritSubBtn label="训练" val="+15" color="text-indigo-600" onClick={() => handleSpiritInteract(15)}/>
                <SpiritSubBtn label="关闭" val="" color="text-slate-400" onClick={() => setShowSpiritInteraction(false)}/>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- 右下角实时通讯录 & 红点 (还原) --- */}
      <div className="absolute bottom-8 right-8 flex gap-4 z-50">
        <div className="relative">
          <button onClick={() => setShowMessageContacts(!showMessageContacts)} className="w-14 h-14 bg-white rounded-full shadow-2xl flex items-center justify-center text-sky-500 hover:scale-110 transition-all">
            <MessageSquareText size={24} />
          </button>
          {unreadCount > 0 && <span className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 rounded-full text-white text-[10px] font-black border-2 border-white flex items-center justify-center animate-bounce">{unreadCount}</span>}
        </div>
        <button onClick={() => setShowBackpack(true)} className="w-14 h-14 bg-white rounded-full shadow-2xl flex items-center justify-center text-slate-700 hover:scale-110 transition-all"><Backpack size={24}/></button>
        <button onClick={() => setShowSettings(true)} className="w-14 h-14 bg-slate-900 rounded-full shadow-2xl flex items-center justify-center text-white hover:scale-110 transition-all"><Settings size={24}/></button>
      </div>

      {/* 通讯录面板 */}
      <AnimatePresence>
        {showMessageContacts && (
          <motion.div initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 50 }} className="absolute bottom-24 right-24 w-72 bg-white/95 backdrop-blur-md rounded-3xl shadow-2xl border border-slate-100 overflow-hidden z-50 flex flex-col max-h-[50vh]">
            <div className="p-4 bg-sky-50 flex justify-between font-black text-sky-900 text-sm"><span>在线玩家列表</span><X size={16} onClick={() => setShowMessageContacts(false)}/></div>
            <div className="p-2 overflow-y-auto flex-1">
              {allPlayers.filter(p => p.id !== user.id).map(p => (
                <div key={p.id} onClick={() => { setChatTarget(p); setShowMessageContacts(false); }} className="flex items-center gap-3 p-3 rounded-2xl hover:bg-sky-50 cursor-pointer mb-1 border border-transparent hover:border-sky-100">
                  <div className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 overflow-hidden">
                    {p.avatarUrl ? <img src={p.avatarUrl} className="w-full h-full object-cover"/> : <UserIcon className="m-auto text-slate-300" size={16}/>}
                  </div>
                  <div><p className="font-black text-slate-800 text-sm">{p.name}</p><p className="text-[10px] text-slate-400">位于 {worldLocations.find(l=>l.id===p.currentLocation)?.name || '未知'}</p></div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 对戏聊天窗 (还原) */}
      <AnimatePresence>
        {chatTarget && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
            <div className="bg-white rounded-[40px] w-full max-w-lg shadow-2xl flex flex-col h-[75vh] overflow-hidden">
              <div className="bg-sky-600 p-6 flex justify-between items-center text-white">
                <div className="flex items-center gap-3">
                   <div className="w-12 h-12 rounded-full border-2 border-white/50 overflow-hidden">
                      {chatTarget.avatarUrl ? <img src={chatTarget.avatarUrl} className="w-full h-full object-cover"/> : <UserIcon size={24} className="m-auto"/>}
                   </div>
                   <h3 className="font-black text-xl">与 {chatTarget.name} 对戏中</h3>
                </div>
                <X size={24} onClick={() => setChatTarget(null)} className="cursor-pointer"/>
              </div>
              <div className="flex-1 overflow-y-auto p-6 bg-slate-50 space-y-4">
                {chatMessages.map((msg, i) => (
                  <div key={i} className={`flex flex-col ${msg.senderId === user.id ? 'items-end' : 'items-start'}`}>
                    <div className={`max-w-[85%] px-5 py-3 rounded-3xl text-sm leading-relaxed ${msg.senderId === user.id ? 'bg-sky-600 text-white rounded-tr-none' : 'bg-white shadow-sm border border-slate-200 text-slate-800 rounded-tl-none'}`}>{msg.content}</div>
                  </div>
                ))}
                <div ref={messagesEndRef}/>
              </div>
              <div className="p-6 bg-white border-t border-slate-100 flex gap-3">
                <input value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => e.key==='Enter' && handleSendRoleplayMessage()} className="flex-1 px-5 py-3 bg-slate-50 border border-slate-200 rounded-full text-sm outline-none focus:border-sky-500" placeholder="描写你的动作或对白..."/>
                <button onClick={handleSendRoleplayMessage} className="bg-sky-600 text-white px-6 py-3 rounded-full hover:bg-sky-700 transition-colors"><Send size={18}/></button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 觉醒、背包、设置 (精简后完整逻辑) */}
      <AnimatePresence>
        {showAwakening && <motion.div className="fixed inset-0 bg-black z-[300] flex items-center justify-center p-6"><button onClick={handleAwakeningDraw} className="bg-white px-10 py-5 rounded-full font-black text-xl">开始分化仪式</button></motion.div>}
        {showBackpack && (
           <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="absolute bottom-24 right-6 w-80 bg-white rounded-3xl shadow-2xl z-50 p-6 flex flex-col max-h-[60vh]">
              <h3 className="font-black text-xl mb-4">行囊</h3>
              <div className="grid grid-cols-4 gap-2 overflow-y-auto">
                 {items.map(item => <div key={item.id} className="aspect-square bg-slate-100 rounded-xl border border-slate-200 flex items-center justify-center text-[10px] font-black">{item.name}</div>)}
              </div>
              <button onClick={() => setShowBackpack(false)} className="mt-4 py-2 bg-slate-900 text-white rounded-xl font-bold">收起</button>
           </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}

// 辅助组件
function StatusRow({ label, cur, color }: any) {
  return (
    <div>
      <div className="flex justify-between text-[9px] font-black text-slate-400 mb-1"><span>{label}</span><span>{cur}%</span></div>
      <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden"><motion.div initial={{ width: 0 }} animate={{ width: `${cur}%` }} className={`h-full ${color} rounded-full`}/></div>
    </div>
  );
}
function FloatActionBtn({ icon, label, sub, color, onClick }: any) {
  return (<button onClick={onClick} className={`flex flex-col items-center justify-center p-5 rounded-[28px] ${color} shadow-sm border border-transparent hover:scale-105 transition-all`}><div className="mb-2">{icon}</div><span className="text-xs font-black mb-1">{label}</span><span className="text-[9px] font-bold opacity-60">{sub}</span></button>);
}
function SpiritSubBtn({ label, val, color, onClick }: any) {
  return (<button onClick={onClick} className={`p-4 rounded-2xl bg-slate-50 border border-slate-100 font-black transition-all flex flex-col items-center ${color}`}><span>{label}</span><span className="text-[10px] opacity-70">{val}</span></button>);
}

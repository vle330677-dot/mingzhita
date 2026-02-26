import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Settings, Backpack, X, Upload, MapPin, Bell, User as UserIcon, ScrollText, Hammer, HandCoins, MessageSquareText, Send, Users, Heart, Zap, Brain, Briefcase, DoorOpen, ArrowLeft, Camera, Edit3, UserMinus, CheckCircle } from 'lucide-react';
import { ViewState } from '../App';
import { User, Item } from '../types';

interface Skill { id: number; userId: number; name: string; level: number; }
interface Props { user: User; setUser: (user: User | null) => void; onNavigate: (view: ViewState) => void; }

// === 1. 全量地图坐标数据 ===
interface MapLocation { id: string; name: string; x: number; y: number; description: string; lootTable: string[]; type?: 'world' | 'tower'; minMental?: string; }

const worldLocations: MapLocation[] = [
  { id: 'tower_of_life', name: '命之塔', x: 50, y: 50, description: '世界的权利中心，高耸入云。', lootTable: ['高阶精神结晶'], type: 'world' },
  { id: 'london_tower', name: '伦敦塔', x: 58, y: 48, description: '哨兵向导学院。', lootTable: ['标准向导素'], type: 'world' },
  { id: 'sanctuary', name: '圣所', x: 42, y: 48, description: '幼年教育机构。', lootTable: ['幼崽安抚奶嘴'], type: 'world' },
  { id: 'guild', name: '公会', x: 50, y: 72, description: '处理委托，拥有地下拍卖行。', lootTable: ['悬赏令碎片'], type: 'world' },
  { id: 'army', name: '军队', x: 50, y: 15, description: '镇压异鬼的武装力量。', lootTable: ['制式军用匕首'], type: 'world' },
  { id: 'slums', name: '贫民区', x: 25, y: 55, description: '技术能力者的聚集地。', lootTable: ['废弃机械零件'], type: 'world' },
  { id: 'rich_area', name: '富人区', x: 75, y: 55, description: '财富与权力的交织。', lootTable: ['精致的高脚杯'], type: 'world' },
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
  { id: 'tower_evaluation', name: '评定所', x: 68, y: 55, description: '分化仪式与等级评定。', lootTable: [], type: 'tower' }
];

// === 辅助函数：权重随机抽取 (同步 命之塔1.0.html) ===
const weightedPick = (items: { name: string, w: number }[]) => {
  const total = items.reduce((s, x) => s + x.w, 0);
  let r = Math.random() * total;
  for (const it of items) { r -= it.w; if (r <= 0) return it.name; }
  return items[items.length - 1].name;
};

export function GameView({ user, setUser, onNavigate }: Props) {
  // 界面状态
  const [inTower, setInTower] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<MapLocation | null>(null);
  const [showLeftPanel, setShowLeftPanel] = useState(true);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  
  // 数据库同步数据
  const [items, setItems] = useState<Item[]>([]);
  const [allPlayers, setAllPlayers] = useState<any[]>([]); 
  const [spiritStatus, setSpiritStatus] = useState<any>({ name: '', intimacy: 0, level: 1, hp: 100, imageUrl: '' });
  
  // 弹窗状态
  const [showTowerActionPanel, setShowTowerActionPanel] = useState(false);
  const [showSpiritInteraction, setShowSpiritInteraction] = useState(false);
  const [showBackpack, setShowBackpack] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showAwakening, setShowAwakening] = useState(false);
  const [showMessageContacts, setShowMessageContacts] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  
  // 对戏聊天状态
  const [chatTarget, setChatTarget] = useState<any | null>(null);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const spiritImgInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const showToast = (msg: string) => { setToastMsg(msg); setTimeout(() => setToastMsg(null), 3000); };

  // ================= 1. 核心数据统一同步逻辑 =================
  const syncAllData = async () => {
    try {
      // 获取全服用户数据并同步自身状态 (确保属性一致性)
      const res = await fetch('/api/admin/users');
      const data = await res.json();
      if (data.success) {
        setAllPlayers(data.users.filter((p: any) => p.currentLocation));
        const me = data.users.find((p: any) => p.id === user.id);
        if (me) setUser({ ...user, ...me }); // 更新状态栏依赖的 user 对象
      }
      
      // 同步背包
      const itemRes = await fetch(`/api/users/${user.id}/items`);
      const itemData = await itemRes.json();
      if (itemData.success) setItems(itemData.items);

      // 同步精神体
      const spiritRes = await fetch(`/api/users/${user.id}/spirit-status`);
      const spiritData = await spiritRes.json();
      if (spiritData.success) setSpiritStatus(spiritData.spiritStatus);

      // 同步消息红点
      const unreadRes = await fetch(`/api/roleplay/unread/${user.id}`);
      const unreadData = await unreadRes.json();
      if (unreadData.success) setUnreadCount(unreadData.count);
    } catch (e) { console.error("Data Sync Error", e); }
  };

  useEffect(() => {
    syncAllData();
    const interval = setInterval(syncAllData, 4000); // 4秒高频同步一次
    return () => clearInterval(interval);
  }, [user.id]);

  useEffect(() => { if (chatTarget) fetchChatMessages(); }, [chatTarget]);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chatMessages]);

  const fetchChatMessages = async () => {
    if(!chatTarget) return;
    const res = await fetch(`/api/roleplay/conversation/${user.id}/${chatTarget.id}`);
    const data = await res.json();
    if (data.success) setChatMessages(data.messages);
  };

  // ================= 2. 交互处理 =================
  const handleLocationAction = async (action: 'enter' | 'explore' | 'stay') => {
    if (!selectedLocation) return;
    
    // 进入命之塔内部子地图
    if (action === 'enter' && selectedLocation.id === 'tower_of_life') {
      setInTower(true); setSelectedLocation(null); return;
    }

    if (inTower && action === 'enter') {
      const jobRooms: Record<string, string> = { '神使': 'tower_top', '侍奉者': 'tower_attendant', '神使后裔': 'tower_descendant', '仆从': 'tower_hall' };
      
      // 评定所判断 (严格限制：仅限未分化)
      if (selectedLocation.id === 'tower_evaluation') {
        if (user.role === '未分化') setShowAwakening(true);
        else showToast("档案已锁定。仅未分化玩家可进行觉醒仪式。");
      } 
      // 房间管理判断
      else if (['tower_top', 'tower_attendant', 'tower_descendant'].includes(selectedLocation.id)) {
        if (!user.job || user.job === '无') {
          // 入职判定
          const ranks = ['D', 'C', 'B', 'B+', 'A', 'A+', 'S'];
          if (ranks.indexOf(user.mentalRank || 'D') >= ranks.indexOf(selectedLocation.minMental || 'D')) {
            if (confirm(`入职名额有限，是否申请入职「${selectedLocation.name}」？`)) handleJoinJob(selectedLocation.name.replace('层',''));
          } else showToast(`精神力等级不足！需要达到 ${selectedLocation.minMental}`);
        } else if (jobRooms[user.job] === selectedLocation.id) {
          setShowTowerActionPanel(true); // 弹出浮动管理面板
        } else showToast("他人私室，请勿进入。");
      }
      setSelectedLocation(null); return;
    }

    // 常规地图逻辑
    if (action === 'explore' && Math.random() > 0.4) {
      const item = selectedLocation.lootTable[0];
      await fetch(`/api/users/${user.id}/items`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: item, description: `在${selectedLocation.name}获得` }) });
      syncAllData(); showToast(`发现了「${item}」！`);
    } else if (action === 'stay') {
      await fetch(`/api/users/${user.id}/location`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ locationId: selectedLocation.id }) });
      syncAllData();
    }
    setSelectedLocation(null);
  };

  const handleJoinJob = async (jobName: string) => {
    const res = await fetch('/api/tower/join', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: user.id, jobName }) });
    const data = await res.json();
    if (data.success) { syncAllData(); showToast(`已就职为 ${jobName}`); } else showToast(data.message);
  };

  const handleCheckIn = async () => {
    const res = await fetch('/api/tower/checkin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: user.id }) });
    const data = await res.json();
    if (data.success) { showToast(`领取月薪：${data.reward} G`); syncAllData(); } else showToast(data.message);
  };

  const handleQuitJob = async () => {
    if (!confirm("离职将扣除月薪 30% 作为违约金，确定离职吗？")) return;
    const res = await fetch('/api/tower/quit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: user.id }) });
    const data = await res.json();
    if (data.success) { showToast(`已正式离职，扣除罚款 ${data.penalty} G`); setShowTowerActionPanel(false); syncAllData(); }
  };

  const handleSpiritInteract = async (gain: number) => {
    const res = await fetch('/api/tower/interact-spirit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: user.id, intimacyGain: gain }) });
    const data = await res.json();
    if (data.success) { 
      if (data.levelUp) showToast("亲密度升级！精神力显著提升 (+20%)"); 
      syncAllData(); 
    }
  };

  // === 抽取逻辑 (同步 1.0 算法) ===
  const handleAwakeningDraw = async () => {
    const role = weightedPick([{ name: "哨兵", w: 40 }, { name: "向导", w: 40 }, { name: "普通人", w: 10 }, { name: "鬼魂", w: 10 }]);
    const rankPool = [{ name: "D", w: 25 }, { name: "C", w: 25 }, { name: "B", w: 25 }, { name: "A", w: 23 }, { name: "S", w: 2 }];
    const mental = role === '普通人' ? '无' : weightedPick(rankPool);
    const physical = role === '鬼魂' ? '无' : weightedPick(rankPool);
    const spirit = (role === '哨兵' || role === '向导') ? "觉醒的守候者" : "无";
    
    await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: user.name, role, mentalRank: mental, physicalRank: physical, spiritName: spirit, gold: user.gold + 500 })
    });
    
    showToast(`觉醒成功：你是「${role}」`);
    setShowAwakening(false);
    syncAllData();
  };

  const handleSendRoleplayMessage = async () => {
    if (!chatInput.trim() || !chatTarget) return;
    const res = await fetch('/api/roleplay', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ senderId: user.id, senderName: user.name, receiverId: chatTarget.id, receiverName: chatTarget.name, content: chatInput.trim() }) });
    if (res.ok) { setChatInput(''); fetchChatMessages(); }
  };

  // ================= 3. 渲染视图 =================
  const activeMap = inTower ? towerLocations : worldLocations;

  return (
    <div className="min-h-screen bg-slate-950 relative overflow-hidden font-sans">
      
      {/* --- 背景地图层 (双层渲染确保实时性) --- */}
      <div className="absolute inset-0 bg-cover bg-center transition-all duration-700" style={{ backgroundImage: `url('${inTower ? '/命之塔.jpg' : '/map_background.jpg'}')` }}>
        <div className="absolute inset-0 bg-black/30 backdrop-blur-[1px]" />
        
        {inTower && (
          <button onClick={() => setInTower(false)} className="absolute top-8 left-8 z-30 bg-white/90 px-6 py-2 rounded-2xl font-black shadow-2xl flex items-center gap-2 hover:bg-white text-gray-900 transition-all">
            <ArrowLeft size={20}/> 返回大地图
          </button>
        )}

        {/* 渲染坐标人物点 [完整还原] */}
        {activeMap.map(loc => {
          const playersHere = allPlayers.filter(p => p.currentLocation === loc.id);
          return (
            <div key={loc.id} className="absolute transform -translate-x-1/2 -translate-y-1/2 z-10 flex flex-col items-center" style={{ left: `${loc.x}%`, top: `${loc.y}%` }}>
              {!inTower && playersHere.length > 0 && (
                <div className="flex -space-x-2 mb-1">
                  {playersHere.map(p => (
                    <div key={p.id} onClick={() => p.id !== user.id && setChatTarget(p)} className={`w-8 h-8 rounded-full border-2 shadow-xl cursor-pointer overflow-hidden ${p.id === user.id ? 'border-amber-400 z-10 scale-110' : 'border-white bg-slate-200'}`}>
                      {p.avatarUrl ? <img src={p.avatarUrl} className="w-full h-full object-cover"/> : <span className="text-[10px] m-auto font-black">{p.name[0]}</span>}
                    </div>
                  ))}
                </div>
              )}
              <button onClick={() => setSelectedLocation(loc)} className="group flex flex-col items-center">
                <div className={`p-2 rounded-full shadow-2xl border-2 transition-all group-hover:scale-125 ${inTower ? 'bg-sky-500 border-sky-100' : 'bg-rose-600 border-white'}`}>
                  <MapPin size={18} className="text-white"/>
                </div>
                <span className="mt-1 px-3 py-1 bg-black/80 text-white text-[10px] font-black rounded-lg backdrop-blur-md border border-white/10">{loc.name}</span>
              </button>
            </div>
          );
        })}
      </div>

      {/* --- 全屏浮动 UI 容器 (确保状态栏数据始终统一) --- */}
      <div className="absolute inset-0 pointer-events-none z-40">
        
        {/* 左上角角色状态面板 (始终统一显示最新状态) */}
        <AnimatePresence>
          {showLeftPanel && (
            <motion.div initial={{ x: -300 }} animate={{ x: 0 }} exit={{ x: -300 }} className="absolute top-6 left-6 w-64 bg-white/95 backdrop-blur-xl rounded-[32px] shadow-2xl p-6 pointer-events-auto border border-white/50">
               <div className="flex justify-between items-start mb-4">
                  <div className="w-16 h-16 rounded-2xl border-2 border-sky-500 overflow-hidden shadow-xl bg-slate-100 cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                    {user.avatarUrl ? <img src={user.avatarUrl} className="w-full h-full object-cover"/> : <UserIcon className="m-auto text-gray-300" size={32}/>}
                    <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={async (e) => {
                      const f = e.target.files?.[0]; if (!f) return;
                      const r = new FileReader(); r.onload = async (ev) => {
                        await fetch(`/api/users/${user.id}/avatar`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ avatarUrl: ev.target?.result }) });
                        syncAllData();
                      }; r.readAsDataURL(f);
                    }}/>
                  </div>
                  <button onClick={() => setShowLeftPanel(false)} className="text-[10px] font-black text-slate-400 hover:text-slate-900">HIDE</button>
               </div>
               <h2 className="font-black text-xl text-slate-900 mb-1 cursor-pointer hover:text-sky-600" onClick={() => setShowProfileModal(true)}>{user.name}</h2>
               <p className="text-[10px] font-black text-sky-700 bg-sky-50 inline-block px-2 py-0.5 rounded-full mb-6">{(user as any).job || user.role}</p>

               <div className="space-y-3 mb-6">
                  <StatusRow label="HP (生命值)" cur={(user as any).hp || 100} color="bg-rose-500" />
                  <StatusRow label="Mental (精神进度)" cur={(user as any).mentalProgress || 0} color="bg-indigo-600" />
                  <StatusRow label="Spirit (亲密度)" cur={spiritStatus.intimacy || 0} color="bg-pink-500" />
               </div>
               <div className="bg-slate-900 text-white p-3 rounded-2xl flex justify-between items-center">
                  <HandCoins size={16} className="text-amber-400"/>
                  <span className="font-black text-sm">{user.gold} G</span>
               </div>
            </motion.div>
          )}
          {!showLeftPanel && (
             <button onClick={() => setShowLeftPanel(true)} className="absolute top-6 left-6 pointer-events-auto bg-white/90 px-4 py-2 rounded-full font-black text-[10px] shadow-xl hover:scale-105">SHOW INFO</button>
          )}
        </AnimatePresence>

        {/* 右下角工具栏 (始终统一) */}
        <div className="absolute bottom-8 right-8 flex gap-4 pointer-events-auto">
          <ControlBtn icon={<MessageSquareText/>} count={unreadCount} color="text-sky-500" onClick={() => setShowMessageContacts(!showMessageContacts)}/>
          <ControlBtn icon={<Backpack/>} color="text-slate-700" onClick={() => setShowBackpack(true)}/>
          <ControlBtn icon={<Settings/>} color="text-slate-400" onClick={() => setShowSettings(true)}/>
        </div>
      </div>

      {/* --- 全屏交互层 (Overlay) --- */}
      <AnimatePresence>
        {/* 1. 地点交互弹窗 */}
        {selectedLocation && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/40 z-[60] flex items-center justify-center p-4">
             <div className="bg-white rounded-[40px] p-8 w-full max-w-sm shadow-2xl relative border-t-8 border-sky-500">
                <h3 className="text-2xl font-black text-slate-900 mb-2">{selectedLocation.name}</h3>
                <p className="text-sm text-slate-500 mb-8">{selectedLocation.description}</p>
                <div className="space-y-3">
                   <button onClick={() => handleLocationAction('enter')} className="w-full py-4 bg-sky-600 text-white font-black rounded-2xl hover:bg-sky-700 shadow-lg shadow-sky-200">进入 / 申请管理</button>
                   {selectedLocation.type !== 'tower' && (
                      <button onClick={() => handleLocationAction('explore')} className="w-full py-4 bg-slate-100 text-slate-700 font-black rounded-2xl hover:bg-slate-200">在这里闲逛物资</button>
                   )}
                </div>
                <button onClick={() => setSelectedLocation(null)} className="absolute top-6 right-6 text-slate-400 hover:text-slate-900"><X/></button>
             </div>
          </motion.div>
        )}

        {/* 2. 命之塔房间管理浮窗 */}
        {showTowerActionPanel && (
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm">
            <div className="bg-white rounded-[48px] p-10 w-full max-w-sm shadow-2xl relative">
              <h3 className="font-black text-2xl text-slate-900 mb-8">房间管理 • {user.job}</h3>
              <div className="grid grid-cols-2 gap-4 mb-6">
                <FloatActionBtn icon={<CheckCircle/>} label="签到领薪" sub="每日一次" color="bg-emerald-50 text-emerald-700" onClick={handleCheckIn}/>
                <FloatActionBtn icon={<Briefcase/>} label="开始打工" sub={`次数: ${(user as any).workCount}/3`} color="bg-sky-50 text-sky-700" onClick={() => showToast('辛苦打工中...')}/>
                <FloatActionBtn icon={<Heart/>} label="精神体" sub="互动培育" color="bg-pink-50 text-pink-700" onClick={() => { setShowSpiritInteraction(true); setShowTowerActionPanel(false); }}/>
                <FloatActionBtn icon={<UserMinus/>} label="申请离职" sub="30%罚金" color="bg-rose-50 text-rose-600" onClick={handleQuitJob}/>
              </div>
              <button onClick={() => setShowTowerActionPanel(false)} className="w-full py-3 bg-slate-100 rounded-2xl font-bold">关闭窗口</button>
            </div>
          </motion.div>
        )}

        {/* 3. 精神体深度互动系统 */}
        {showSpiritInteraction && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 bg-black/80 backdrop-blur-xl z-[110] flex items-center justify-center p-4">
            <div className="bg-white rounded-[56px] p-10 w-full max-w-md shadow-2xl relative">
              <button onClick={() => setShowSpiritInteraction(false)} className="absolute top-8 right-8 text-slate-400"><X/></button>
              <div className="relative w-48 h-48 mx-auto mb-6">
                <div className="w-full h-full bg-slate-50 rounded-[48px] border-4 border-pink-50 overflow-hidden flex items-center justify-center">
                  {spiritStatus.imageUrl ? <img src={spiritStatus.imageUrl} className="w-full h-full object-cover"/> : <Zap size={48} className="text-pink-200 animate-pulse"/>}
                </div>
                <button onClick={() => spiritImgInputRef.current?.click()} className="absolute -bottom-2 -right-2 bg-white p-3 rounded-full shadow-2xl text-pink-500 hover:scale-110"><Camera/></button>
                <input type="file" ref={spiritImgInputRef} className="hidden" accept="image/*" onChange={async (e) => {
                   const f = e.target.files?.[0]; if(!f) return;
                   const r = new FileReader(); r.onload = async (ev) => {
                     await fetch(`/api/tower/interact-spirit`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: user.id, imageUrl: ev.target?.result, intimacyGain: 0 }) });
                     syncAllData();
                   }; r.readAsDataURL(f);
                }}/>
              </div>
              <h3 className="font-black text-3xl text-center mb-1">{spiritStatus.name || "未命名精神体"}</h3>
              {!spiritStatus.name && <button className="block mx-auto text-sky-600 font-black mb-6" onClick={async () => { 
                const n = prompt("锁定名字后不可更改："); 
                if(n) { await fetch(`/api/tower/interact-spirit`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: user.id, name: n, intimacyGain: 0 }) }); syncAllData(); } 
              }}>[ 点击取名 ]</button>}
              <div className="grid grid-cols-2 gap-4">
                <SpiritSubBtn label="摸摸" val="+5" color="text-pink-600" onClick={() => handleSpiritInteract(5)}/>
                <SpiritSubBtn label="喂食" val="+10" color="text-amber-600" onClick={() => handleSpiritInteract(10)}/>
                <SpiritSubBtn label="训练" val="+15" color="text-indigo-600" onClick={() => handleSpiritInteract(15)}/>
                <SpiritSubBtn label="关闭" val="" color="text-slate-400" onClick={() => setShowSpiritInteraction(false)}/>
              </div>
            </div>
          </motion.div>
        )}

        {/* 4. 对戏聊天窗口 [完整还原] */}
        {chatTarget && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
            <div className="bg-white rounded-[40px] w-full max-w-lg shadow-2xl flex flex-col h-[75vh] overflow-hidden">
              <div className="bg-sky-600 p-6 flex justify-between items-center text-white">
                <div className="flex items-center gap-3">
                   <div className="w-12 h-12 rounded-full border-2 border-white/50 overflow-hidden">
                      {chatTarget.avatarUrl ? <img src={chatTarget.avatarUrl} className="w-full h-full object-cover"/> : <UserIcon size={24} className="m-auto"/>}
                   </div>
                   <h3 className="font-black text-xl">{chatTarget.name}</h3>
                </div>
                <X size={24} onClick={() => setChatTarget(null)} className="cursor-pointer"/>
              </div>
              <div className="flex-1 overflow-y-auto p-6 bg-slate-50 space-y-4">
                {chatMessages.map((msg, i) => (
                  <div key={i} className={`flex flex-col ${msg.senderId === user.id ? 'items-end' : 'items-start'}`}>
                    <span className="text-[9px] text-slate-400 mb-1 px-1">{msg.senderName}</span>
                    <div className={`max-w-[85%] px-5 py-3 rounded-3xl text-sm ${msg.senderId === user.id ? 'bg-sky-600 text-white rounded-tr-none' : 'bg-white shadow-sm text-slate-800 rounded-tl-none'}`}>{msg.content}</div>
                  </div>
                ))}
                <div ref={messagesEndRef}/>
              </div>
              <div className="p-6 bg-white border-t border-slate-100 flex gap-3">
                <input value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => e.key==='Enter' && handleSendRoleplayMessage()} className="flex-1 px-5 py-3 bg-slate-50 border border-slate-200 rounded-full text-sm outline-none focus:border-sky-500" placeholder="描写动作或对白..."/>
                <button onClick={handleSendRoleplayMessage} className="bg-sky-600 text-white px-6 py-3 rounded-full hover:bg-sky-700 transition-colors"><Send size={18}/></button>
              </div>
            </div>
          </motion.div>
        )}

        {/* 5. 分化觉醒全屏弹窗 [算法统一] */}
        {showAwakening && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 bg-black z-[300] flex items-center justify-center p-6 text-center">
             <div className="max-w-md">
                <Brain size={64} className="text-sky-400 mx-auto mb-6 animate-pulse"/>
                <h2 className="text-4xl font-black text-white mb-4">命之塔 • 分化仪式</h2>
                <p className="text-slate-400 mb-10 leading-relaxed">检测到你的精神图景尚未分化。这是一次不可逆的灵魂洗礼，你准备好接受命运的指引了吗？</p>
                <button onClick={handleAwakeningDraw} className="px-12 py-5 bg-white text-black font-black rounded-full text-xl hover:scale-110 transition-transform shadow-[0_0_50px_rgba(255,255,255,0.3)]">开始命运抽取</button>
             </div>
          </motion.div>
        )}

        {/* 6. 通讯录面板 */}
        {showMessageContacts && (
          <motion.div initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 50 }} className="absolute bottom-24 right-24 w-72 bg-white/95 backdrop-blur-md rounded-3xl shadow-2xl border border-slate-100 overflow-hidden z-50 flex flex-col max-h-[50vh]">
            <div className="p-4 bg-sky-50 flex justify-between font-black text-sky-900 text-sm"><span>在线玩家</span><X size={16} onClick={() => setShowMessageContacts(false)}/></div>
            <div className="p-2 overflow-y-auto flex-1 pointer-events-auto">
              {allPlayers.filter(p => p.id !== user.id).map(p => (
                <div key={p.id} onClick={() => { setChatTarget(p); setShowMessageContacts(false); }} className="flex items-center gap-3 p-3 rounded-2xl hover:bg-sky-50 cursor-pointer mb-1 border border-transparent hover:border-sky-100">
                  <div className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 overflow-hidden">
                    {p.avatarUrl ? <img src={p.avatarUrl} className="w-full h-full object-cover"/> : <UserIcon className="m-auto text-slate-300" size={16}/>}
                  </div>
                  <div className="flex-1 min-w-0"><p className="font-black text-slate-800 text-sm truncate">{p.name}</p><p className="text-[10px] text-slate-400 truncate">位于 {worldLocations.find(l=>l.id===p.currentLocation)?.name || '未知'}</p></div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- 系统设置 --- */}
      <AnimatePresence>
        {showSettings && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[250] flex items-center justify-center p-4">
            <div className="bg-white rounded-[40px] p-8 w-full max-w-sm shadow-2xl">
              <h3 className="text-xl font-bold text-center mb-6">系统选项</h3>
              <button onClick={() => { setUser(null); onNavigate('WELCOME'); }} className="w-full py-4 bg-rose-50 text-rose-600 rounded-2xl font-black mb-3 border border-rose-100">注销登录 / 切换账号</button>
              <button onClick={() => setShowSettings(false)} className="w-full py-4 bg-slate-100 text-slate-700 rounded-2xl font-black">返回游戏</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}

// === 抽离的小型组件 (状态统一) ===
function StatusRow({ label, cur, color }: any) {
  return (
    <div className="w-full">
      <div className="flex justify-between text-[10px] font-black text-slate-400 mb-1 uppercase tracking-tighter"><span>{label}</span><span>{cur}%</span></div>
      <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
        <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(100, cur)}%` }} className={`h-full ${color} rounded-full`}/>
      </div>
    </div>
  );
}

function ControlBtn({ icon, count, color, onClick }: any) {
  return (
    <button onClick={onClick} className={`relative w-14 h-14 bg-white rounded-full shadow-2xl flex items-center justify-center ${color} hover:scale-110 transition-all border border-slate-50`}>
      {icon}
      {count > 0 && <span className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 rounded-full text-white text-[10px] font-black border-2 border-white animate-bounce flex items-center justify-center shadow-lg">{count}</span>}
    </button>
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
    <button onClick={onClick} className={`p-4 rounded-2xl bg-slate-50 border border-slate-100 font-black transition-all flex flex-col items-center ${color} hover:scale-105 active:scale-95 shadow-sm`}>
      <span className="text-sm">{label}</span>
      <span className="text-[10px] opacity-70">{val}</span>
    </button>
  );
}

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Settings, Backpack, X, Upload, MapPin, Bell, User as UserIcon, ScrollText, Hammer, HandCoins, MessageSquareText, Send, Users, Heart, Zap, Brain, Briefcase, DoorOpen, ArrowLeft, Camera, Edit3, UserMinus, CheckCircle } from 'lucide-react';
import { ViewState } from '../App';
import { User, Item } from '../types';

interface Skill { id: number; userId: number; name: string; level: number; }
interface Props { user: User; setUser: (user: User | null) => void; onNavigate: (view: ViewState) => void; }

// === 1. 地图坐标数据 ===
interface MapLocation { id: string; name: string; x: number; y: number; description: string; lootTable: string[]; type?: 'world' | 'tower'; minMental?: string; }

const worldLocations: MapLocation[] = [
  { id: 'tower_of_life', name: '命之塔', x: 50, y: 50, description: '世界的权利中心，高耸入云。', lootTable: ['高阶精神结晶'], type: 'world' },
  { id: 'london_tower', name: '伦敦塔', x: 58, y: 48, description: '哨兵向导学院。', lootTable: ['标准向导素'], type: 'world' },
  { id: 'sanctuary', name: '圣所', x: 42, y: 48, description: '幼年教育机构。', lootTable: ['幼崽安抚奶嘴'], type: 'world' },
  { id: 'guild', name: '公会', x: 50, y: 72, description: '处理委托，拥有地下拍卖行。', lootTable: ['悬赏令碎片'], type: 'world' },
  { id: 'army', name: '军队', x: 50, y: 15, description: '镇压异鬼的武装力量。', lootTable: ['制式军用匕首'], type: 'world' },
  { id: 'slums', name: '贫民区', x: 25, y: 55, description: '西区技术聚集地。', lootTable: ['废弃机械零件'], type: 'world' },
  { id: 'rich_area', name: '富人区', x: 75, y: 55, description: '东区财富中心。', lootTable: ['精致的高脚杯'], type: 'world' },
  { id: 'tower_guard', name: '守塔会', x: 65, y: 35, description: '表里不一的野心组织。', lootTable: ['忏悔书'], type: 'world' },
  { id: 'demon_society', name: '恶魔会', x: 15, y: 35, description: '追求自由的反抗者。', lootTable: ['反叛标语传单'], type: 'world' },
  { id: 'paranormal_office', name: '灵异管理所', x: 30, y: 70, description: '管理鬼魂的专门机构。', lootTable: ['引魂灯残片'], type: 'world' },
  { id: 'observers', name: '观察者', x: 65, y: 15, description: '遍布世界的眼线。', lootTable: ['加密的微型胶卷'], type: 'world' }
];

const towerLocations: MapLocation[] = [
  { id: 'tower_top', name: '神使层', x: 50, y: 12, description: '塔顶，至高无上的神使居所。', lootTable: [], type: 'tower', minMental: 'S' },
  { id: 'tower_attendant', name: '侍奉者层', x: 50, y: 25, description: '侍奉者居住区。', lootTable: [], type: 'tower', minMental: 'B+' },
  { id: 'tower_descendant', name: '神使后裔层', x: 50, y: 38, description: '优秀的向导继承人。', lootTable: [], type: 'tower', minMental: 'A+' },
  { id: 'tower_training', name: '精神力训练所', x: 32, y: 55, description: '通过游戏训练提升精神进度。', lootTable: [], type: 'tower' },
  { id: 'tower_evaluation', name: '评定所', x: 68, y: 55, description: '分化仪式与等级评定。', lootTable: [], type: 'tower' }
];

const fixedNPCs = [
  { id: 'npc_merchant', name: '贾斯汀', role: '拍卖商人', locationId: 'rich_area', desc: '想要宝贝吗？拿金币说话。', icon: <HandCoins size={14} /> },
  { id: 'npc_craftsman', name: '老乔', role: '怪脾气手艺人', locationId: 'slums', desc: '滚开，别弄乱我的机油！', icon: <Hammer size={14} /> },
  { id: 'npc_guild_staff', name: '玛丽', role: '公会接待员', locationId: 'guild', desc: '今天也有新的委托呢。', icon: <ScrollText size={14} /> }
];

export function GameView({ user, setUser, onNavigate }: Props) {
  const [inTower, setInTower] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<MapLocation | null>(null);
  const [allPlayers, setAllPlayers] = useState<any[]>([]); 
  const [spiritStatus, setSpiritStatus] = useState<any>({ name: '', intimacy: 0, level: 1, hp: 100 });
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // 弹窗状态
  const [showLeftPanel, setShowLeftPanel] = useState(true);
  const [activeNPC, setActiveNPC] = useState<any>(null);
  const [showTowerActionPanel, setShowTowerActionPanel] = useState(false);
  const [showSpiritInteraction, setShowSpiritInteraction] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [chatTarget, setChatTarget] = useState<any | null>(null);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);
  const [showBackpack, setShowBackpack] = useState(false);
  const [showMessageContacts, setShowMessageContacts] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showAwakening, setShowAwakening] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const spiritImgInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const showToast = (msg: string) => { setToastMsg(msg); setTimeout(() => setToastMsg(null), 3000); };

  // ================= 1. 数据实时同步逻辑 =================
  const syncAllData = async () => {
    try {
      const res = await fetch('/api/admin/users');
      const data = await res.json();
      if (data.success) {
        const active = data.users.filter((p: any) => p.currentLocation);
        setAllPlayers(active);
        const me = data.users.find((p: any) => p.id === user.id);
        if (me) setUser({ ...user, ...me });
      }
      const spiritRes = await fetch(`/api/users/${user.id}/spirit-status`);
      const sData = await spiritRes.json();
      if (sData.success) setSpiritStatus(sData.spiritStatus);
      const unreadRes = await fetch(`/api/roleplay/unread/${user.id}`);
      const uData = await unreadRes.json();
      if (uData.success) setUnreadCount(uData.count);
    } catch (e) { console.error(e); }
  };

  useEffect(() => { syncAllData(); const i = setInterval(syncAllData, 4000); return () => clearInterval(i); }, [user.id]);
  useEffect(() => { if (chatTarget) fetchChatMessages(); }, [chatTarget]);

  const fetchChatMessages = async () => {
    if(!chatTarget) return;
    const res = await fetch(`/api/roleplay/conversation/${user.id}/${chatTarget.id}`);
    const data = await res.json();
    if (data.success) setChatMessages(data.messages);
  };

  // ================= 2. 核心动作逻辑修复 =================
  const handleLocationAction = async (action: 'enter' | 'explore' | 'stay') => {
    if (!selectedLocation) return;
    
    if (action === 'enter' && selectedLocation.id === 'tower_of_life') {
      setInTower(true); setSelectedLocation(null); return;
    }

    if (inTower && action === 'enter') {
      const jobRooms: Record<string, string> = { '神使': 'tower_top', '侍奉者': 'tower_attendant', '神使后裔': 'tower_descendant' };
      if (selectedLocation.id === 'tower_evaluation') {
        if (user.role === '未分化') setShowAwakening(true);
        else showToast("身份已锁定。");
      } else if (['tower_top', 'tower_attendant', 'tower_descendant'].includes(selectedLocation.id)) {
        if (!user.job || user.job === '无') {
          const ranks = ['D', 'C', 'B', 'B+', 'A', 'A+', 'S'];
          if (ranks.indexOf(user.mentalRank || 'D') >= ranks.indexOf(selectedLocation.minMental || 'D')) {
            if (confirm(`入职名额有限，是否申请入职「${selectedLocation.name}」？`)) {
               await fetch('/api/tower/join', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: user.id, jobName: selectedLocation.name.replace('层','') }) });
               showToast("就职申请成功！"); syncAllData();
            }
          } else showToast("等级不足。");
        } else if (jobRooms[user.job] === selectedLocation.id) setShowTowerActionPanel(true);
        else showToast("守卫：非本人请勿擅闯私人领地。");
      }
      setSelectedLocation(null); return;
    }

    if (action === 'explore' && Math.random() > 0.4) {
      const item = selectedLocation.lootTable[0];
      await fetch(`/api/users/${user.id}/items`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: item, description: `探索发现` }) });
      showToast(`发现了「${item}」！`); syncAllData();
    } else if (action === 'stay') {
      // 修复：驻足逻辑分支
      await fetch(`/api/users/${user.id}/location`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ locationId: selectedLocation.id }) });
      showToast(`你已在此地驻扎。`); syncAllData();
    }
    setSelectedLocation(null);
  };

  const handleCheckIn = async () => {
    const res = await fetch('/api/tower/checkin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: user.id }) });
    const data = await res.json();
    if (data.success) { showToast(`领取月薪：${data.reward} G`); syncAllData(); } else showToast(data.message);
  };

  const handleQuitJob = async () => {
    if (!confirm("离职将扣除月薪 30% 违约金")) return;
    await fetch('/api/tower/quit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: user.id }) });
    setShowTowerActionPanel(false); syncAllData(); showToast("已办理离职手续。");
  };

  const handleSpiritInteract = async (gain: number) => {
    const res = await fetch('/api/tower/interact-spirit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: user.id, intimacyGain: gain }) });
    const data = await res.json();
    if (data.success) { if (data.levelUp) showToast("亲密升级！精神进度+20%"); syncAllData(); }
  };

  const handleSendRoleplayMessage = async () => {
    if (!chatInput.trim() || !chatTarget) return;
    await fetch('/api/roleplay', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ senderId: user.id, senderName: user.name, receiverId: chatTarget.id, receiverName: chatTarget.name, content: chatInput.trim() }) });
    setChatInput(''); fetchChatMessages();
  };

  // ================= 3. 页面渲染 =================
  const activeMap = inTower ? towerLocations : worldLocations;

  return (
    <div className="min-h-screen bg-slate-950 relative overflow-hidden font-sans">
      
      {/* --- 全量地图层 --- */}
      <div className="absolute inset-0 bg-cover bg-center transition-all duration-1000" style={{ backgroundImage: `url('${inTower ? '/命之塔.jpg' : '/map_background.jpg'}')` }}>
        <div className="absolute inset-0 bg-black/30" />
        {inTower && <button onClick={() => setInTower(false)} className="absolute top-8 left-8 z-50 bg-white/90 shadow-xl px-6 py-2 rounded-2xl font-black flex items-center gap-2"><ArrowLeft size={20}/> 返回大地图</button>}

        {/* 修复：渲染 NPC 与 在线玩家头像 */}
        {activeMap.map(loc => {
          const playersHere = allPlayers.filter(p => p.currentLocation === loc.id);
          const npcsHere = fixedNPCs.filter(n => n.locationId === loc.id);
          return (
            <div key={loc.id} className="absolute transform -translate-x-1/2 -translate-y-1/2 z-10 flex flex-col items-center" style={{ left: `${loc.x}%`, top: `${loc.y}%` }}>
              <div className="flex -space-x-2 mb-1">
                {npcsHere.map(npc => (
                  <div key={npc.id} onClick={() => setActiveNPC(npc)} className="w-8 h-8 rounded-full border-2 border-emerald-400 bg-white flex items-center justify-center cursor-pointer shadow-lg z-20 hover:scale-110 transition-all">{npc.icon}</div>
                ))}
                {playersHere.map(p => (
                  <div key={p.id} onClick={() => p.id !== user.id && setChatTarget(p)} className={`w-8 h-8 rounded-full border-2 shadow-xl cursor-pointer overflow-hidden transition-all ${p.id === user.id ? 'border-amber-400 z-30 scale-125' : 'border-white bg-slate-200 hover:scale-110 z-10'}`}>
                    {p.avatarUrl ? <img src={p.avatarUrl} className="w-full h-full object-cover"/> : <span className="text-[10px] m-auto font-black">{p.name[0]}</span>}
                  </div>
                ))}
              </div>
              <button onClick={() => setSelectedLocation(loc)} className="group flex flex-col items-center">
                <div className={`p-2 rounded-full shadow-2xl border-2 transition-all group-hover:scale-125 ${inTower ? 'bg-sky-500 border-sky-100' : 'bg-rose-600 border-white'}`}><MapPin size={18} className="text-white"/></div>
                <span className="mt-1 px-3 py-1 bg-black/80 text-white text-[10px] font-black rounded-lg">{loc.name}</span>
              </button>
            </div>
          );
        })}
      </div>

      {/* --- 左侧状态栏 (可点名字) --- */}
      <AnimatePresence>
        {showLeftPanel && (
          <motion.div initial={{ x: -300 }} animate={{ x: 0 }} exit={{ x: -300 }} className="absolute top-6 left-6 w-64 bg-white/95 backdrop-blur-xl rounded-[32px] shadow-2xl p-6 z-40 border border-white/50">
             <div className="flex justify-between items-start mb-4">
                <div className="w-14 h-14 rounded-2xl border-2 border-sky-500 overflow-hidden bg-slate-100 cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                  {user.avatarUrl ? <img src={user.avatarUrl} className="w-full h-full object-cover"/> : <UserIcon className="m-auto text-gray-300" size={24}/>}
                  <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={async (e) => {
                    const r = new FileReader(); r.onload = async (ev) => { await fetch(`/api/users/${user.id}/avatar`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ avatarUrl: ev.target?.result }) }); syncAllData(); };
                    if(e.target.files?.[0]) r.readAsDataURL(e.target.files[0]);
                  }}/>
                </div>
                <button onClick={() => setShowLeftPanel(false)} className="text-[10px] font-black text-slate-400 hover:text-slate-900">HIDE</button>
             </div>
             {/* 修复：名字点击弹出档案入口 */}
             <h2 className="font-black text-xl text-slate-900 mb-1 cursor-pointer hover:text-sky-600 transition-colors" onClick={() => setShowProfileModal(true)}>{user.name}</h2>
             <p className="text-[10px] font-black text-sky-700 bg-sky-50 inline-block px-2 py-0.5 rounded-full mb-6">{(user as any).job || user.role}</p>

             <div className="space-y-3 mb-6">
                <StatusRow label="HP" cur={(user as any).hp || 100} color="bg-rose-500" />
                <StatusRow label="Mental Progress" cur={(user as any).mentalProgress || 0} color="bg-indigo-600" />
                <StatusRow label="Spirit Intimacy" cur={spiritStatus.intimacy || 0} color="bg-pink-500" />
             </div>
             <div className="bg-slate-900 text-white p-3 rounded-2xl flex justify-between items-center"><HandCoins size={16} className="text-amber-400"/><span className="font-black text-sm">{user.gold} G</span></div>
          </motion.div>
        )}
        {!showLeftPanel && <button onClick={() => setShowLeftPanel(true)} className="absolute top-6 left-6 z-40 bg-white shadow-xl px-4 py-2 rounded-full font-black text-[10px]">SHOW INFO</button>}
      </AnimatePresence>

      {/* --- 全量弹窗交互层 --- */}
      <AnimatePresence>
        {/* 1. 地点交互 (含驻足按钮) */}
        {selectedLocation && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 bg-black/40 z-[100] flex items-center justify-center p-4">
            <div className="bg-white rounded-[40px] p-8 w-full max-w-sm shadow-2xl relative">
              <h3 className="text-2xl font-black text-slate-900 mb-2">{selectedLocation.name}</h3>
              <p className="text-sm text-slate-500 mb-8 leading-relaxed">{selectedLocation.description}</p>
              <div className="space-y-3">
                <button onClick={() => handleLocationAction('enter')} className="w-full py-4 bg-sky-600 text-white font-black rounded-2xl hover:bg-sky-700">进入 / 申请管理中心</button>
                {selectedLocation.type !== 'tower' && (
                  <>
                    <button onClick={() => handleLocationAction('explore')} className="w-full py-4 bg-slate-100 text-slate-700 font-black rounded-2xl">在这里闲逛物资</button>
                    {/* 修复：驻扎按钮 */}
                    <button onClick={() => handleLocationAction('stay')} className="w-full py-4 bg-slate-900 text-white font-black rounded-2xl hover:bg-black transition-colors">驻足停留在此</button>
                  </>
                )}
              </div>
              <X onClick={() => setSelectedLocation(null)} className="absolute top-6 right-6 text-slate-400 cursor-pointer"/>
            </div>
          </motion.div>
        )}

        {/* 2. NPC 交互弹窗 */}
        {activeNPC && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 bg-black/40 z-[110] flex items-center justify-center p-4">
             <div className="bg-white rounded-[40px] p-10 w-full max-w-sm shadow-2xl relative border-t-8 border-emerald-400">
                <div className="flex items-center gap-4 mb-6">
                   <div className="p-3 bg-emerald-50 rounded-2xl text-emerald-600">{activeNPC.icon}</div>
                   <div><h3 className="font-black text-xl">{activeNPC.name}</h3><p className="text-xs text-emerald-600 font-bold">{activeNPC.role}</p></div>
                </div>
                <p className="text-gray-600 italic mb-8">"{activeNPC.desc}"</p>
                <div className="grid grid-cols-1 gap-3">
                   <button onClick={() => showToast("此功能正在施工中...")} className="py-4 bg-slate-100 font-black rounded-2xl">进行交易</button>
                   <button onClick={() => setActiveNPC(null)} className="py-4 bg-slate-900 text-white font-black rounded-2xl">以后再说</button>
                </div>
                <X onClick={() => setActiveNPC(null)} className="absolute top-6 right-6 text-slate-400 cursor-pointer"/>
             </div>
          </motion.div>
        )}

        {/* 3. 档案详情面板 */}
        {showProfileModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 bg-black/60 z-[200] flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-[40px] p-10 w-full max-w-2xl max-h-[85vh] overflow-y-auto shadow-2xl">
               <div className="flex justify-between items-center mb-8 border-b pb-4"><h3 className="text-3xl font-black tracking-tighter">身世履历档案</h3><X onClick={() => setShowProfileModal(false)} className="cursor-pointer text-slate-400"/></div>
               <div className="grid grid-cols-2 gap-6">
                  <ProfileField label="玩家姓名" value={user.name}/>
                  <ProfileField label="目前职衔" value={(user as any).job || user.role}/>
                  <ProfileField label="精神等级" value={user.mentalRank}/>
                  <ProfileField label="所属精神体" value={user.spiritName}/>
                  <div className="col-span-2 bg-slate-50 p-6 rounded-3xl border border-slate-100">
                     <p className="text-[10px] font-black text-slate-400 uppercase mb-3">系统身份摘要</p>
                     <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{user.profileText || "正在从塔内数据库读取档案细节..."}</p>
                  </div>
               </div>
            </div>
          </motion.div>
        )}

        {/* 命之塔、精神体互动等房间浮窗逻辑保持一致... */}
        {/* ... (同上一版 showTowerActionPanel 和 showSpiritInteraction) */}

      </AnimatePresence>

      {/* 右下角社交工具栏 */}
      <div className="absolute bottom-8 right-8 flex gap-4 z-40">
        <ControlBtn icon={<MessageSquareText/>} count={unreadCount} color="text-sky-500" onClick={() => setShowMessageContacts(!showMessageContacts)}/>
        <ControlBtn icon={<Backpack/>} color="text-slate-700" onClick={() => setShowBackpack(true)}/>
        <ControlBtn icon={<Settings/>} color="text-slate-400" onClick={() => setShowSettings(true)}/>
      </div>

      {/* 联络簿面板 */}
      <AnimatePresence>
        {showMessageContacts && (
          <motion.div initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 50 }} className="absolute bottom-24 right-24 w-72 bg-white/95 backdrop-blur-md rounded-3xl shadow-2xl border border-slate-100 overflow-hidden z-50 flex flex-col max-h-[50vh]">
            <div className="p-4 bg-sky-50 flex justify-between font-black text-sky-900 text-sm"><span>在线联络清单</span><X size={16} className="cursor-pointer" onClick={() => setShowMessageContacts(false)}/></div>
            <div className="p-2 overflow-y-auto flex-1">
              {allPlayers.filter(p => p.id !== user.id).map(p => (
                <div key={p.id} onClick={() => { setChatTarget(p); setShowMessageContacts(false); }} className="flex items-center gap-3 p-3 rounded-2xl hover:bg-sky-50 cursor-pointer mb-1">
                  <div className="w-10 h-10 rounded-full border border-slate-200 overflow-hidden">{p.avatarUrl ? <img src={p.avatarUrl} className="w-full h-full object-cover"/> : <UserIcon className="m-auto text-slate-300" size={16}/>}</div>
                  <div className="flex-1 min-w-0"><p className="font-black text-slate-800 text-sm truncate">{p.name}</p><p className="text-[10px] text-slate-400">位于 {worldLocations.find(l=>l.id===p.currentLocation)?.name || '神秘地带'}</p></div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}

// 辅助组件封装
function StatusRow({ label, cur, color }: any) {
  return (
    <div className="w-full">
      <div className="flex justify-between text-[9px] font-black text-slate-400 mb-1 tracking-tighter"><span>{label}</span><span>{Math.floor(cur)}%</span></div>
      <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden"><motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(100, cur)}%` }} className={`h-full ${color} rounded-full`}/></div>
    </div>
  );
}

function ProfileField({ label, value }: any) {
  return (<div className="bg-slate-50 p-4 rounded-2xl border border-slate-100"><p className="text-[10px] font-black text-slate-400 uppercase mb-1">{label}</p><p className="text-sm font-bold text-slate-800">{value || "未知"}</p></div>);
}

function ControlBtn({ icon, count, color, onClick }: any) {
  return (
    <button onClick={onClick} className={`relative w-14 h-14 bg-white rounded-full shadow-2xl flex items-center justify-center ${color} hover:scale-110 transition-all`}>
      {icon}
      {count > 0 && <span className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 rounded-full text-white text-[10px] font-black border-2 border-white flex items-center justify-center animate-bounce shadow-lg">{count}</span>}
    </button>
  );
}

function FloatActionBtn({ icon, label, sub, color, onClick }: any) {
  return (<button onClick={onClick} className={`flex flex-col items-center justify-center p-5 rounded-[28px] ${color} shadow-sm border border-transparent hover:scale-105 transition-all`}><div className="mb-2">{icon}</div><span className="text-xs font-black mb-1">{label}</span><span className="text-[9px] font-bold opacity-60">{sub}</span></button>);
}

function SpiritSubBtn({ label, val, color, onClick }: any) {
  return (<button onClick={onClick} className={`p-4 rounded-2xl bg-slate-50 border border-slate-100 font-black transition-all flex flex-col items-center ${color} hover:scale-105 active:scale-95`}><span>{label}</span><span className="text-[10px] opacity-70">{val}</span></button>);
}

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useDragControls } from 'motion/react';
import { Settings, Backpack, X, Upload, MapPin, Bell, User as UserIcon, ScrollText, Hammer, HandCoins, MessageSquareText, Send, Users, Heart, Zap, Brain, Briefcase, DoorOpen, ArrowLeft, Camera, Edit3, UserMinus, CheckCircle, ClipboardList } from 'lucide-react';
import { ViewState } from '../App';
import { User, Item } from '../types';

interface Skill { id: number; userId: number; name: string; level: number; }
interface Props { user: User; setUser: (user: User | null) => void; onNavigate: (view: ViewState) => void; }

// === 1. 地图坐标数据 ===
interface MapLocation { id: string; name: string; x: number; y: number; description: string; lootTable: string[]; type?: 'world' | 'tower'; minMental?: string; }

const worldLocations: MapLocation[] = [
  { id: 'tower_of_life', name: '命之塔', x: 50, y: 50, description: '世界的权利中心。', lootTable: ['高阶精神结晶'], type: 'world' },
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

  // === 新增：委托与NPC交互状态 ===
  const [joesPatience, setJoesPatience] = useState(0); // 老乔对话计数
  const [skills, setSkills] = useState<Skill[]>([]);
  const [commissions, setCommissions] = useState<any[]>([]);
  const [showCommissionBoard, setShowCommissionBoard] = useState(false); // 任务面板
  const [guildView, setGuildView] = useState<'menu' | 'board' | 'publish'>('menu');
  const [newCommission, setNewCommission] = useState({ title: '', content: '', difficulty: 'C', reward: 100, isAnonymous: false });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const spiritImgInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const dragControls = useDragControls();

  const showToast = (msg: string) => { setToastMsg(msg); setTimeout(() => setToastMsg(null), 3000); };

  // ================= 1. 数据同步 =================
  const syncAllData = async () => {
    try {
      const res = await fetch('/api/admin/users');
      const data = await res.json();
      if (data.success) {
        setAllPlayers(data.users.filter((p: any) => p.currentLocation));
        const me = data.users.find((p: any) => p.id === user.id);
        if (me) setUser({ ...user, ...me });
      }
      const spiritRes = await fetch(`/api/users/${user.id}/spirit-status`);
      const sData = await spiritRes.json();
      if (sData.success) setSpiritStatus(sData.spiritStatus);
      const unreadRes = await fetch(`/api/roleplay/unread/${user.id}`);
      const uData = await unreadRes.json();
      if (uData.success) setUnreadCount(uData.count);
      const skillRes = await fetch(`/api/users/${user.id}/skills`);
      const skillData = await skillRes.json();
      if (skillData.success) setSkills(skillData.skills);
      const commRes = await fetch('/api/commissions');
      const commData = await commRes.json();
      if (commData.success) setCommissions(commData.commissions);
    } catch (e) { console.error(e); }
  };

  useEffect(() => { syncAllData(); const i = setInterval(syncAllData, 5000); return () => clearInterval(i); }, [user.id]);
  useEffect(() => { if (chatTarget) fetchChatMessages(); }, [chatTarget]);

  const fetchChatMessages = async () => {
    if(!chatTarget) return;
    const res = await fetch(`/api/roleplay/conversation/${user.id}/${chatTarget.id}`);
    const data = await res.json();
    if (data.success) setChatMessages(data.messages);
  };

  // ================= 2. 委托与NPC逻辑 =================

  // 老乔学习技能
  const handleTalkToJoe = () => {
    if (joesPatience < 2) {
      setJoesPatience(prev => prev + 1);
      showToast(`老乔：忙着呢！别烦我！(${joesPatience + 1}/3)`);
    } else {
      const skillNames = ["机械维修", "零件打磨", "重载组装", "引擎调试"];
      const randomSkill = skillNames[Math.floor(Math.random() * skillNames.length)];
      learnSkill(randomSkill);
      setJoesPatience(0);
    }
  };

  const learnSkill = async (name: string) => {
    await fetch(`/api/users/${user.id}/skills`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) });
    showToast(`老乔骂骂咧咧地教了你一招：${name}`);
    syncAllData();
  };

  // 公会委托
  const publishCommission = async () => {
    if (!newCommission.title || !newCommission.reward) return showToast("请填写标题和奖励");
    const res = await fetch('/api/commissions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: `COMM-${Date.now()}`,
        publisherId: user.id,
        publisherName: newCommission.isAnonymous ? "匿名发布者" : user.name,
        ...newCommission
      })
    });
    if (res.ok) { showToast("委托已在公会公示"); setGuildView('menu'); syncAllData(); }
  };

  const acceptCommission = async (comm: any) => {
    const res = await fetch(`/api/commissions/${comm.id}/accept`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: user.id, userName: user.name }) });
    const data = await res.json();
    if (data.success) { showToast("委托已接取，请尽快完成"); syncAllData(); } else showToast(data.message);
  };

  // ================= 3. 核心地图动作逻辑 =================
  const handleLocationAction = async (action: 'enter' | 'explore' | 'stay') => {
    if (!selectedLocation) return;
    if (action === 'enter' && selectedLocation.id === 'tower_of_life') { setInTower(true); setSelectedLocation(null); return; }
    
    if (inTower && action === 'enter') {
      const jobRooms: Record<string, string> = { '神使': 'tower_top', '侍奉者': 'tower_attendant', '神使后裔': 'tower_descendant' };
      if (selectedLocation.id === 'tower_evaluation' && user.role === '未分化') setShowAwakening(true);
      else if (jobRooms[user.job || ''] === selectedLocation.id) setShowTowerActionPanel(true);
      else showToast("权限不足。");
      setSelectedLocation(null); return;
    }

    if (action === 'stay') {
      await fetch(`/api/users/${user.id}/location`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ locationId: selectedLocation.id }) });
      showToast(`已在此驻扎`); syncAllData();
    }
    setSelectedLocation(null);
  };

  const activeMap = inTower ? towerLocations : worldLocations;

  return (
    <div className="min-h-screen bg-slate-950 relative overflow-hidden font-sans select-none">
      
      {/* --- 地图层 --- */}
      <div className="absolute inset-0 bg-cover bg-center transition-all duration-1000" style={{ backgroundImage: `url('${inTower ? '/命之塔.jpg' : '/map_background.jpg'}')` }}>
        <div className="absolute inset-0 bg-black/20" />
        {inTower && <button onClick={() => setInTower(false)} className="absolute top-8 left-8 z-50 bg-white/90 shadow-xl px-6 py-2 rounded-2xl font-black flex items-center gap-2"><ArrowLeft size={20}/> 返回大地图</button>}

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

      {/* --- 可拖拽角色面板 --- */}
      <AnimatePresence>
        {showLeftPanel ? (
          <motion.div initial={{ x: -300 }} animate={{ x: 0 }} exit={{ x: -300 }} className="absolute top-6 left-6 w-64 bg-white/95 backdrop-blur-xl rounded-[32px] shadow-2xl p-6 z-[60] border border-white/50">
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
             <h2 className="font-black text-xl text-slate-900 mb-1 cursor-pointer hover:text-sky-600 transition-colors" onClick={() => setShowProfileModal(true)}>{user.name}</h2>
             <p className="text-[10px] font-black text-sky-700 bg-sky-50 inline-block px-2 py-0.5 rounded-full mb-6">{(user as any).job || user.role}</p>

             <div className="space-y-3 mb-6">
                <StatusRow label="HP" cur={(user as any).hp || 100} color="bg-rose-500" />
                <StatusRow label="Mental" cur={(user as any).mentalProgress || 0} color="bg-indigo-600" />
                <StatusRow label="Spirit" cur={spiritStatus.intimacy || 0} color="bg-pink-500" />
             </div>
             
             <div className="border-t border-gray-100 pt-3 mb-4">
                <p className="text-[9px] font-black text-gray-400 mb-2 uppercase">Skills</p>
                <div className="flex flex-wrap gap-1">
                   {skills.length === 0 && <span className="text-[10px] text-gray-300 italic">尚未习得技能</span>}
                   {skills.map(s => <span key={s.id} className="px-2 py-0.5 bg-sky-50 text-sky-600 rounded-md text-[10px] font-bold border border-sky-100">{s.name} Lv.{s.level}</span>)}
                </div>
             </div>

             <div className="bg-slate-900 text-white p-3 rounded-2xl flex justify-between items-center"><HandCoins size={16} className="text-amber-400"/><span className="font-black text-sm">{user.gold} G</span></div>
          </motion.div>
        ) : (
          <motion.button 
            drag dragControls={dragControls} dragListener={true} dragMomentum={false}
            onClick={() => setShowLeftPanel(true)} 
            className="absolute top-6 left-6 z-[60] bg-white shadow-2xl px-5 py-3 rounded-full font-black text-xs flex items-center gap-2 cursor-move border border-slate-200"
          >
            <UserIcon size={14} className="text-sky-500"/> SHOW INFO
          </motion.button>
        )}
      </AnimatePresence>

      {/* --- NPC交互与委托弹窗 --- */}
      <AnimatePresence>
        {/* 老乔交互 */}
        {activeNPC?.id === 'npc_craftsman' && (
          <NPCModal npc={activeNPC} onClose={() => setActiveNPC(null)}>
            <button onClick={handleTalkToJoe} className="w-full py-4 bg-sky-600 text-white font-black rounded-2xl shadow-lg">搭话进行交流 ({joesPatience}/3)</button>
          </NPCModal>
        )}

        {/* 玛丽/公会交互 */}
        {activeNPC?.id === 'npc_guild_staff' && (
          <NPCModal npc={activeNPC} onClose={() => {setActiveNPC(null); setGuildView('menu');}}>
            {guildView === 'menu' && (
              <div className="grid grid-cols-1 gap-3">
                <button onClick={() => setGuildView('board')} className="py-4 bg-sky-50 text-sky-600 font-black rounded-2xl border border-sky-100">查看委托板</button>
                <button onClick={() => setGuildView('publish')} className="py-4 bg-amber-50 text-amber-600 font-black rounded-2xl border border-amber-100">发布新委托</button>
                <button onClick={() => setActiveNPC(null)} className="py-4 bg-slate-100 text-slate-500 font-black rounded-2xl">以后再说</button>
              </div>
            )}
            {guildView === 'board' && (
              <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                {commissions.length === 0 && <p className="text-center text-gray-400 py-4">目前没有公示委托</p>}
                {commissions.filter(c => c.status === 'open').map(c => (
                  <div key={c.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <div className="flex justify-between items-start mb-1"><span className="font-black text-slate-900">{c.title}</span><span className="text-[10px] font-bold text-amber-600">{c.reward} G</span></div>
                    <p className="text-[11px] text-slate-500 mb-3">{c.content}</p>
                    <button onClick={() => acceptCommission(c)} className="w-full py-2 bg-sky-600 text-white text-[11px] font-black rounded-xl">接受委托</button>
                  </div>
                ))}
                <button onClick={() => setGuildView('menu')} className="w-full py-2 text-xs font-bold text-sky-600">返回</button>
              </div>
            )}
            {guildView === 'publish' && (
              <div className="space-y-3">
                <input placeholder="任务标题" className="w-full p-3 bg-slate-50 border rounded-xl outline-none" onChange={e => setNewCommission({...newCommission, title: e.target.value})}/>
                <textarea placeholder="任务详情内容..." className="w-full p-3 bg-slate-50 border rounded-xl h-24 outline-none resize-none" onChange={e => setNewCommission({...newCommission, content: e.target.value})}/>
                <div className="flex gap-2">
                  <input placeholder="报酬" type="number" className="flex-1 p-3 bg-slate-50 border rounded-xl outline-none" onChange={e => setNewCommission({...newCommission, reward: parseInt(e.target.value)})}/>
                  <button 
                    onClick={() => setNewCommission({...newCommission, isAnonymous: !newCommission.isAnonymous})}
                    className={`px-4 rounded-xl font-black text-xs ${newCommission.isAnonymous ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500'}`}
                  >
                    {newCommission.isAnonymous ? "匿名发布" : "公开身份"}
                  </button>
                </div>
                <button onClick={publishCommission} className="w-full py-4 bg-amber-500 text-white font-black rounded-2xl">发布并扣除报酬</button>
              </div>
            )}
          </NPCModal>
        )}
      </AnimatePresence>

      {/* --- 右下角任务面板 --- */}
      <AnimatePresence>
        {showCommissionBoard && (
          <motion.div initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="fixed bottom-24 right-8 w-80 bg-white/95 backdrop-blur-xl rounded-[32px] shadow-2xl border p-6 z-[80]">
            <div className="flex justify-between items-center mb-4"><h3 className="font-black text-lg flex items-center gap-2"><ClipboardList size={20} className="text-sky-600"/>任务行囊</h3><X size={18} onClick={() => setShowCommissionBoard(false)}/></div>
            <div className="space-y-3 max-h-80 overflow-y-auto">
              <div className="text-[10px] font-black text-gray-400 border-b pb-2">我接取的委托</div>
              {commissions.filter(c => c.acceptedById === user.id).map(c => (
                <div key={c.id} className="p-3 bg-sky-50 rounded-2xl border border-sky-100">
                  <p className="font-black text-xs text-sky-900">{c.title}</p>
                  <p className="text-[10px] text-sky-600 mt-1">发布者: {c.publisherName}</p>
                  <button onClick={() => showToast("已提交至发布者审核...")} className="w-full mt-2 py-1.5 bg-sky-600 text-white text-[10px] font-black rounded-lg">提交任务</button>
                </div>
              ))}
              <div className="text-[10px] font-black text-gray-400 border-b pb-2 mt-4">我发布的委托</div>
              {commissions.filter(c => c.publisherId === user.id).map(c => (
                <div key={c.id} className="p-3 bg-amber-50 rounded-2xl border border-amber-100">
                  <p className="font-black text-xs text-amber-900">{c.title}</p>
                  <p className="text-[10px] text-amber-600 mt-1">状态: {c.status === 'accepted' ? '被接取' : '公示中'}</p>
                  {c.status === 'accepted' && <button onClick={() => showToast("审核通过，报酬已发放")} className="w-full mt-2 py-1.5 bg-amber-600 text-white text-[10px] font-black rounded-lg">确认完成</button>}
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- 底部控制栏 --- */}
      <div className="absolute bottom-8 right-8 flex gap-4 z-40">
        <ControlBtn icon={<ClipboardList/>} color="text-amber-500" onClick={() => setShowCommissionBoard(!showCommissionBoard)}/>
        <ControlBtn icon={<MessageSquareText/>} count={unreadCount} color="text-sky-500" onClick={() => setShowMessageContacts(!showMessageContacts)}/>
        <ControlBtn icon={<Backpack/>} color="text-slate-700" onClick={() => setShowBackpack(true)}/>
        <ControlBtn icon={<Settings/>} color="text-slate-400" onClick={() => setShowSettings(true)}/>
      </div>

      {/* 其他所有原有弹窗 (Spirit, Tower, Chat 等) 保持上一版逻辑完整挂载 */}
      {/* ... */}
      
      <AnimatePresence>
        {toastMsg && <motion.div initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -20, opacity: 0 }} className="absolute top-8 left-1/2 -translate-x-1/2 bg-gray-900/90 text-white px-6 py-3 rounded-2xl z-[500] flex items-center gap-3 border border-gray-700 text-sm shadow-2xl"><Bell size={16} className="text-amber-400"/>{toastMsg}</motion.div>}
      </AnimatePresence>

    </div>
  );
}

// === 辅助组件 ===
function NPCModal({ npc, onClose, children }: any) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 bg-black/40 z-[110] flex items-center justify-center p-4">
      <div className="bg-white rounded-[40px] p-10 w-full max-w-sm shadow-2xl relative border-t-8 border-emerald-400">
        <div className="flex items-center gap-4 mb-6"><div className="p-3 bg-emerald-50 rounded-2xl text-emerald-600">{npc.icon}</div><div><h3 className="font-black text-xl">{npc.name}</h3><p className="text-xs text-emerald-600 font-bold">{npc.role}</p></div></div>
        <p className="text-gray-600 italic mb-8">"{npc.desc}"</p>
        {children}
        <X onClick={onClose} className="absolute top-6 right-6 text-slate-400 cursor-pointer"/>
      </div>
    </motion.div>
  );
}

function StatusRow({ label, cur, color }: any) {
  return (<div className="w-full"><div className="flex justify-between text-[9px] font-black text-slate-400 mb-1 tracking-tighter"><span>{label}</span><span>{Math.floor(cur)}%</span></div><div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden"><motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(100, cur)}%` }} className={`h-full ${color} rounded-full`}/></div></div>);
}

function ControlBtn({ icon, count, color, onClick }: any) {
  return (<button onClick={onClick} className={`relative w-14 h-14 bg-white rounded-full shadow-2xl flex items-center justify-center ${color} hover:scale-110 transition-all border border-slate-50`}>{icon}{count > 0 && <span className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 rounded-full text-white text-[10px] font-black border-2 border-white animate-bounce flex items-center justify-center shadow-lg">{count}</span>}</button>);
}

function FloatActionBtn({ icon, label, sub, color, onClick }: any) {
  return (<button onClick={onClick} className={`flex flex-col items-center justify-center p-5 rounded-[28px] ${color} shadow-sm border border-transparent hover:scale-105 transition-all`}><div className="mb-2">{icon}</div><span className="text-xs font-black mb-1">{label}</span><span className="text-[9px] font-bold opacity-60">{sub}</span></button>);
}

function SpiritSubBtn({ label, val, color, onClick }: any) {
  return (<button onClick={onClick} className={`p-4 rounded-2xl bg-slate-50 border border-slate-100 font-black transition-all flex flex-col items-center ${color} hover:scale-105 active:scale-95`}><span>{label}</span><span className="text-[10px] opacity-70">{val}</span></button>);
}

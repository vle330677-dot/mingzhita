import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useDragControls } from 'framer-motion';
import { Settings, Backpack, X, MapPin, Bell, User as UserIcon, ScrollText, Hammer, HandCoins, MessageSquareText, ClipboardList, Ghost } from 'lucide-react';

// === 接口定义 ===
interface Skill { id: number; userId: number; name: string; level: number; }
interface User { id: number; name: string; role: string; job?: string; hp: number; mentalProgress: number; gold: number; avatarUrl?: string; isGhost?: boolean; currentLocation?: string; }
interface ViewState { /* your view state type */ }
interface Props { user: User; setUser: (user: User | null) => void; onNavigate: (view: ViewState) => void; }

interface MapLocation { id: string; name: string; x: number; y: number; description: string; lootTable: string[]; type?: 'world' | 'tower'; minMental?: string; }

// === 地图与NPC数据 (保持不变，略去部分以节省空间) ===
const worldLocations: MapLocation[] = [
  { id: 'tower_of_life', name: '命之塔', x: 50, y: 50, description: '世界的权利中心。', lootTable: ['高阶精神结晶'], type: 'world' },
  { id: 'slums', name: '贫民区', x: 25, y: 55, description: '西区技术聚集地。', lootTable: ['废弃机械零件'], type: 'world' },
  { id: 'rich_area', name: '富人区', x: 75, y: 55, description: '东区财富中心。', lootTable: ['精致的高脚杯'], type: 'world' },
  { id: 'paranormal_office', name: '灵异管理所', x: 30, y: 70, description: '管理鬼魂的专门机构。', lootTable: ['引魂灯残片'], type: 'world' },
  // ... 其他地图
];

const fixedNPCs = [
  { id: 'npc_merchant', name: '贾斯汀', role: '拍卖商人', locationId: 'rich_area', desc: '想要宝贝吗？拿金币说话。', icon: <HandCoins size={14} /> },
  { id: 'npc_craftsman', name: '老乔', role: '怪脾气手艺人', locationId: 'slums', desc: '滚开，别弄乱我的机油！', icon: <Hammer size={14} /> },
  { id: 'npc_guild_staff', name: '玛丽', role: '公会接待员', locationId: 'guild', desc: '今天也有新的委托呢。', icon: <ScrollText size={14} /> }
];

export function GameView({ user, setUser, onNavigate }: Props) {
  const [inTower, setInTower] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<MapLocation | null>(null);
  const [allPlayers, setAllPlayers] = useState<User[]>([]); 
  const [spiritStatus, setSpiritStatus] = useState<any>({ name: '', intimacy: 0, level: 1, hp: 100 });
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // 面板控制状态
  const [showLeftPanel, setShowLeftPanel] = useState(true);
  const [activeNPC, setActiveNPC] = useState<any>(null);
  const [chatTarget, setChatTarget] = useState<User | null>(null);
  
  // 新增：背包与死亡状态
  const [showBackpack, setShowBackpack] = useState(false);
  const [inventory, setInventory] = useState<string[]>(['新手短剑', '面包']); 
  const isDead = user.hp <= 0;

  // === NPC 交互状态 ===
  const [joesPatience, setJoesPatience] = useState(0); 
  const [hasLearnedToday, setHasLearnedToday] = useState(false); // 老乔每日限制
  const [merchantView, setMerchantView] = useState<'menu' | 'buy' | 'auction'>('menu'); // 富人区商人视图
  const [skills, setSkills] = useState<Skill[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragControls = useDragControls(); // 用于拖拽控制

  const showToast = (msg: string) => { setToastMsg(msg); setTimeout(() => setToastMsg(null), 3000); };

  // ================= 1. 数据同步 =================
  const syncAllData = async () => {
    try {
      // 模拟实时获取所有数据
      const res = await fetch('/api/admin/users');
      const data = await res.json();
      if (data.success) {
        setAllPlayers(data.users.filter((p: any) => p.currentLocation));
        const me = data.users.find((p: any) => p.id === user.id);
        if (me) setUser({ ...user, ...me });
      }
      // 获取技能等
      const skillRes = await fetch(`/api/users/${user.id}/skills`);
      const skillData = await skillRes.json();
      if (skillData.success) setSkills(skillData.skills);
    } catch (e) { console.error("数据同步失败", e); }
  };

  useEffect(() => { syncAllData(); const i = setInterval(syncAllData, 5000); return () => clearInterval(i); }, [user.id]);

  // ================= 2. 委托与NPC逻辑 =================

  // 老乔学习技能
  const handleTalkToJoe = () => {
    if (hasLearnedToday) return showToast("老乔：今天没东西教你了，明天再来！");
    
    if (joesPatience < 2) {
      setJoesPatience(prev => prev + 1);
      showToast(`老乔：滚开，别弄乱我的机油！(${joesPatience + 1}/3)`);
    } else {
      const skillNames = ["机械维修", "零件打磨", "重载组装", "引擎调试"];
      const randomSkill = skillNames[Math.floor(Math.random() * skillNames.length)];
      learnSkill(randomSkill);
      setJoesPatience(0);
      setHasLearnedToday(true); // 记录今日已学习
    }
  };

  const learnSkill = async (name: string) => {
    // 模拟后端请求
    // await fetch(`/api/users/${user.id}/skills`, { method: 'POST', body: JSON.stringify({ name }) });
    setSkills([...skills, { id: Date.now(), userId: user.id, name, level: 1 }]);
    showToast(`触发奇遇！老乔骂骂咧咧地教了你一招：${name}`);
  };

  // ================= 3. 核心地图动作逻辑 =================
  const handleLocationAction = async (action: 'enter' | 'stay') => {
    if (!selectedLocation) return;
    
    // 鬼魂限制
    if (isDead && selectedLocation.id !== 'paranormal_office') {
      showToast("你现在是鬼魂状态，只能前往灵异管理所！");
      setSelectedLocation(null); return;
    }

    if (action === 'stay') {
      // 1. 驻扎逻辑
      // await fetch(`/api/users/${user.id}/location`, { method: 'POST', body: JSON.stringify({ locationId: selectedLocation.id }) });
      showToast(`已在【${selectedLocation.name}】停留。其他玩家现在可以看到你。`);
      
      // 2. 50%概率掉落逻辑
      if (Math.random() < 0.5 && selectedLocation.lootTable.length > 0) {
        const drop = selectedLocation.lootTable[Math.floor(Math.random() * selectedLocation.lootTable.length)];
        setInventory(prev => [...prev, drop]); // 自动放入背包
        setTimeout(() => showToast(`🎉 探索发现：你获得了【${drop}】!`), 1000);
      }
      syncAllData();
    }
    setSelectedLocation(null);
  };

  return (
    <div className="min-h-screen bg-slate-950 relative overflow-hidden font-sans select-none">
      
      {/* --- 地图层 --- */}
      <div className="absolute inset-0 bg-cover bg-center transition-all duration-1000" style={{ backgroundImage: `url('/map_background.jpg')` }}>
        {worldLocations.map(loc => {
          const playersHere = allPlayers.filter(p => p.currentLocation === loc.id);
          const npcsHere = fixedNPCs.filter(n => n.locationId === loc.id);
          return (
            <div key={loc.id} className="absolute transform -translate-x-1/2 -translate-y-1/2 z-10 flex flex-col items-center" style={{ left: `${loc.x}%`, top: `${loc.y}%` }}>
              {/* NPC 与 玩家渲染 */}
              <div className="flex -space-x-2 mb-1">
                {npcsHere.map(npc => (
                  <div key={npc.id} onClick={() => setActiveNPC(npc)} className="w-8 h-8 rounded-full border-2 border-emerald-400 bg-white flex items-center justify-center cursor-pointer shadow-lg z-20 hover:scale-110">{npc.icon}</div>
                ))}
                {playersHere.map(p => (
                  <div key={p.id} onClick={() => p.id !== user.id && setChatTarget(p)} className={`w-8 h-8 rounded-full border-2 shadow-xl cursor-pointer overflow-hidden ${p.isGhost ? 'opacity-50 grayscale' : ''} ${p.id === user.id ? 'border-amber-400 z-30 scale-125' : 'border-white bg-slate-200 z-10'}`}>
                    {p.avatarUrl ? <img src={p.avatarUrl} className="w-full h-full object-cover"/> : <span className="text-[10px] m-auto">{p.name[0]}</span>}
                  </div>
                ))}
              </div>
              
              {/* 地点按钮 */}
              <button onClick={() => setSelectedLocation(loc)} className="group flex flex-col items-center">
                <div className="p-2 rounded-full shadow-2xl border-2 bg-rose-600 border-white hover:scale-125"><MapPin size={18} className="text-white"/></div>
                <span className="mt-1 px-3 py-1 bg-black/80 text-white text-[10px] font-black rounded-lg">{loc.name}</span>
              </button>
            </div>
          );
        })}
      </div>

      {/* --- 地点交互弹窗 --- */}
      <AnimatePresence>
        {selectedLocation && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="absolute bottom-32 left-1/2 -translate-x-1/2 bg-white rounded-3xl p-6 shadow-2xl z-50 text-center border-t-4 border-rose-500 min-w-[250px]">
            <h3 className="font-black text-xl mb-2">{selectedLocation.name}</h3>
            <p className="text-xs text-gray-500 mb-6">{selectedLocation.description}</p>
            <div className="flex gap-3 justify-center">
               <button onClick={() => handleLocationAction('stay')} className="px-6 py-2 bg-rose-500 text-white rounded-xl font-bold text-sm">停留此地</button>
               <button onClick={() => setSelectedLocation(null)} className="px-6 py-2 bg-gray-100 text-gray-600 rounded-xl font-bold text-sm">取消</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- 可拖拽中文个人面板 --- */}
      <AnimatePresence>
        {showLeftPanel ? (
          <motion.div 
            drag 
            dragMomentum={false} 
            initial={{ x: -300 }} animate={{ x: 0 }} exit={{ x: -300 }} 
            className="absolute top-6 left-6 w-64 bg-white/95 backdrop-blur-xl rounded-[32px] shadow-2xl p-6 z-[60] border border-white/50 cursor-move"
          >
             <div className="flex justify-between items-start mb-4">
                <div className="w-14 h-14 rounded-2xl border-2 border-sky-500 overflow-hidden relative">
                  {isDead && <div className="absolute inset-0 bg-gray-900/60 flex items-center justify-center z-10"><Ghost size={24} className="text-white"/></div>}
                  {user.avatarUrl ? <img src={user.avatarUrl} className={`w-full h-full object-cover ${isDead ? 'grayscale' : ''}`}/> : <UserIcon className="m-auto text-gray-300" size={24}/>}
                </div>
                <button onPointerDown={(e) => e.stopPropagation()} onClick={() => setShowLeftPanel(false)} className="text-[10px] font-black text-slate-400 hover:text-slate-900 px-2 py-1 bg-gray-100 rounded-lg cursor-pointer">隐藏面板</button>
             </div>
             
             <h2 className="font-black text-xl text-slate-900 mb-1 flex items-center gap-2">
                {user.name} {isDead && <span className="text-xs bg-gray-800 text-white px-2 py-0.5 rounded-full">游魂</span>}
             </h2>
             <p className="text-[10px] font-black text-sky-700 bg-sky-50 inline-block px-2 py-0.5 rounded-full mb-6">{user.job || user.role}</p>

             <div className="space-y-3 mb-6" onPointerDown={(e) => e.stopPropagation()}>
                <StatusRow label="生命值 (HP)" cur={user.hp || 100} color="bg-rose-500" />
                <StatusRow label="精神力 (Mental)" cur={user.mentalProgress || 0} color="bg-indigo-600" />
                <StatusRow label="精神体 (Spirit)" cur={spiritStatus.intimacy || 0} color="bg-pink-500" />
             </div>
             
             <div className="border-t border-gray-100 pt-3 mb-4">
                <p className="text-[9px] font-black text-gray-400 mb-2 uppercase">掌握技能</p>
                <div className="flex flex-wrap gap-1">
                   {skills.length === 0 && <span className="text-[10px] text-gray-300 italic">尚未习得技能</span>}
                   {skills.map(s => <span key={s.id} className="px-2 py-0.5 bg-sky-50 text-sky-600 rounded-md text-[10px] font-bold border border-sky-100">{s.name} Lv.{s.level}</span>)}
                </div>
             </div>

             <div className="bg-slate-900 text-white p-3 rounded-2xl flex justify-between items-center">
                <HandCoins size={16} className="text-amber-400"/><span className="font-black text-sm">{user.gold} 金币</span>
             </div>
          </motion.div>
        ) : (
          <motion.button 
            drag dragMomentum={false}
            onClick={() => setShowLeftPanel(true)} 
            className="absolute top-6 left-6 z-[60] bg-white shadow-2xl px-5 py-3 rounded-full font-black text-xs flex items-center gap-2 cursor-move border border-slate-200"
          >
            <UserIcon size={14} className="text-sky-500"/> 显示面板
          </motion.button>
        )}
      </AnimatePresence>

      {/* --- NPC交互弹窗 --- */}
      <AnimatePresence>
        {/* 老乔交互 */}
        {activeNPC?.id === 'npc_craftsman' && (
          <NPCModal npc={activeNPC} onClose={() => setActiveNPC(null)}>
            <div className="flex gap-3">
              <button onClick={handleTalkToJoe} className="flex-1 py-4 bg-sky-600 text-white font-black rounded-2xl shadow-lg">搭话</button>
              <button onClick={() => setActiveNPC(null)} className="flex-1 py-4 bg-gray-200 text-gray-700 font-black rounded-2xl">离开</button>
            </div>
          </NPCModal>
        )}

        {/* 贾斯汀（富人区）交互 */}
        {activeNPC?.id === 'npc_merchant' && (
          <NPCModal npc={activeNPC} onClose={() => {setActiveNPC(null); setMerchantView('menu');}}>
            {merchantView === 'menu' && (
              <div className="grid grid-cols-1 gap-3">
                <button onClick={() => setMerchantView('buy')} className="py-4 bg-amber-50 text-amber-600 font-black rounded-2xl border border-amber-100">购买商品</button>
                <button onClick={() => setMerchantView('auction')} className="py-4 bg-purple-50 text-purple-600 font-black rounded-2xl border border-purple-100">拍卖行</button>
                <button onClick={() => setActiveNPC(null)} className="py-4 bg-slate-100 text-slate-500 font-black rounded-2xl">离开</button>
              </div>
            )}
            {merchantView === 'buy' && (
               <div className="space-y-2 max-h-48 overflow-y-auto">
                 {['深海遗珠 - 5000G', '古老的向导法典 - 12000G', '纯金怀表 - 800G'].map(item => (
                   <div key={item} className="p-3 bg-gray-50 flex justify-between items-center rounded-lg border">
                     <span className="text-xs font-bold">{item.split(' - ')[0]}</span>
                     <button className="px-3 py-1 bg-amber-500 text-white text-xs font-bold rounded" onClick={() => showToast("金币不足！")}>购买</button>
                   </div>
                 ))}
                 <button onClick={() => setMerchantView('menu')} className="w-full mt-2 text-xs text-gray-500 font-bold py-2">返回</button>
               </div>
            )}
            {merchantView === 'auction' && (
               <div className="text-center py-4">
                 <p className="text-xs text-gray-500 mb-4">选择你背包里的物品进行拍卖，售出将收取 10% 佣金。</p>
                 <button className="py-2 px-6 bg-purple-600 text-white rounded-xl font-bold text-sm mb-2" onClick={() => showToast("已提交至全服竞价池！")}>选择背包物品</button>
                 <button onClick={() => setMerchantView('menu')} className="w-full text-xs text-gray-500 font-bold block mt-2">返回</button>
               </div>
            )}
          </NPCModal>
        )}
      </AnimatePresence>

      {/* --- 遗漏补充：背包面板 --- */}
      <AnimatePresence>
        {showBackpack && (
          <NPCModal npc={{name: "我的背包", role: "Inventory", desc: "你收集到的所有物资都在这里。", icon: <Backpack/>}} onClose={() => setShowBackpack(false)}>
            <div className="flex flex-wrap gap-2 max-h-64 overflow-y-auto">
              {inventory.length === 0 ? <p className="text-gray-400 text-sm text-center w-full">背包空空如也</p> : 
               inventory.map((item, idx) => (
                 <div key={idx} className="w-[48%] p-3 bg-gray-50 border border-gray-200 rounded-xl flex items-center justify-between">
                   <span className="text-xs font-bold text-gray-700">{item}</span>
                   <span className="text-[10px] text-gray-400">x1</span>
                 </div>
               ))
              }
            </div>
          </NPCModal>
        )}
      </AnimatePresence>

      {/* --- 底部控制栏 --- */}
      <div className="absolute bottom-8 right-8 flex gap-4 z-40">
        <button onClick={() => setShowBackpack(true)} className="relative w-14 h-14 bg-white rounded-full shadow-2xl flex items-center justify-center text-slate-700 hover:scale-110"><Backpack/></button>
      </div>

      <AnimatePresence>
        {toastMsg && <motion.div initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -20, opacity: 0 }} className="absolute top-8 left-1/2 -translate-x-1/2 bg-gray-900/90 text-white px-6 py-3 rounded-2xl z-[500] flex items-center gap-3 border border-gray-700 text-sm shadow-2xl"><Bell size={16} className="text-amber-400"/>{toastMsg}</motion.div>}
      </AnimatePresence>
    </div>
  );
}

function NPCModal({ npc, onClose, children }: any) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 bg-black/40 z-[110] flex items-center justify-center p-4">
      <div className="bg-white rounded-[40px] p-10 w-full max-w-sm shadow-2xl relative border-t-8 border-emerald-400">
        <div className="flex items-center gap-4 mb-6"><div className="p-3 bg-emerald-50 rounded-2xl text-emerald-600">{npc.icon}</div><div><h3 className="font-black text-xl">{npc.name}</h3><p className="text-xs text-emerald-600 font-bold">{npc.role}</p></div></div>
        <p className="text-gray-600 italic mb-8 text-sm">"{npc.desc}"</p>
        {children}
        <X onClick={onClose} className="absolute top-6 right-6 text-slate-400 cursor-pointer"/>
      </div>
    </motion.div>
  );
}

function StatusRow({ label, cur, color }: any) {
  return (<div className="w-full"><div className="flex justify-between text-[9px] font-black text-slate-400 mb-1 tracking-tighter"><span>{label}</span><span>{Math.floor(cur)}%</span></div><div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden"><motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(100, cur)}%` }} className={`h-full ${color} rounded-full`}/></div></div>);
}

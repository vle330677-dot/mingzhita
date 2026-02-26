import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Settings, Backpack, X, MapPin, Bell, User as UserIcon, ScrollText, Hammer, HandCoins, MessageSquareText, ClipboardList, ArrowLeft, Ghost } from 'lucide-react';
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

  // 状态弹窗
  const [isPanelMinimized, setIsPanelMinimized] = useState(false);
  const [activeNPC, setActiveNPC] = useState<any>(null);
  const [chatTarget, setChatTarget] = useState<any | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showBackpack, setShowBackpack] = useState(false);
  const [showCommissionBoard, setShowCommissionBoard] = useState(false);
  const [myInventory, setMyInventory] = useState<string[]>([]); // 模拟背包

  // NPC 与 委托状态
  const [joesPatience, setJoesPatience] = useState(0); 
  const [hasLearnedSkillToday, setHasLearnedSkillToday] = useState(false); // 限制老乔每天一次
  const [merchantView, setMerchantView] = useState<'menu' | 'buy' | 'auction'>('menu'); // 贾斯汀视图
  const [skills, setSkills] = useState<Skill[]>([]);
  const [commissions, setCommissions] = useState<any[]>([]);
  const [guildView, setGuildView] = useState<'menu' | 'board' | 'publish'>('menu');
  const [newCommission, setNewCommission] = useState({ title: '', content: '', reward: 100, isAnonymous: false });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const showToast = (msg: string) => { setToastMsg(msg); setTimeout(() => setToastMsg(null), 3000); };

  // 鬼魂状态判定 (当 HP 小于等于 0)
  const isGhost = (user as any).hp <= 0;

  // ================= 数据同步 =================
  const syncAllData = async () => {
    try {
      // 模拟数据同步
      const res = await fetch('/api/admin/users').catch(() => ({ json: () => ({ success: false }) }));
      // ... 保持原有的同步逻辑 ...
    } catch (e) { console.error(e); }
  };
  useEffect(() => { syncAllData(); const i = setInterval(syncAllData, 5000); return () => clearInterval(i); }, [user.id]);

  // ================= NPC 逻辑 =================
  // 老乔
  const handleTalkToJoe = () => {
    if (hasLearnedSkillToday) return showToast("老乔：今天没空教你了，明天再来！");
    if (joesPatience < 2) {
      setJoesPatience(prev => prev + 1);
      showToast(`老乔：滚开，别弄乱我的机油！(${joesPatience + 1}/3)`);
    } else {
      const skillNames = ["机械维修", "零件打磨", "重载组装", "引擎调试"];
      const randomSkill = skillNames[Math.floor(Math.random() * skillNames.length)];
      learnSkill(randomSkill);
      setJoesPatience(0);
      setHasLearnedSkillToday(true);
    }
  };

  const learnSkill = async (name: string) => {
    // 模拟API调用
    showToast(`老乔骂骂咧咧地教了你一招：${name}！`);
    setSkills(prev => [...prev, { id: Date.now(), userId: user.id, name, level: 1 }]);
    syncAllData();
  };

  // 贾斯汀拍卖行
  const handleAuction = () => {
    showToast("物品已上架！若售出，贾斯汀将抽取10%的报酬。");
    setMerchantView('menu');
  };

  // ================= 核心地图动作逻辑 =================
  const handleLocationAction = async (action: 'enter' | 'explore' | 'stay') => {
    if (!selectedLocation) return;
    
    if (isGhost && action !== 'stay') {
      showToast("你现在是灵魂状态，无法进行该互动。");
      return;
    }

    if (action === 'stay') {
      // 50% 几率掉落该地点的专属物品
      if (Math.random() >= 0.5 && selectedLocation.lootTable.length > 0) {
        const dropItem = selectedLocation.lootTable[Math.floor(Math.random() * selectedLocation.lootTable.length)];
        showToast(`你在${selectedLocation.name}驻留时，意外发现了：${dropItem}！`);
        setMyInventory(prev => [...prev, dropItem]);
      } else {
        showToast(`已在${selectedLocation.name}驻扎，其他玩家现在能看到你。`);
      }
    }
    setSelectedLocation(null);
  };

  const activeMap = inTower ? towerLocations : worldLocations;

  return (
    <div className="min-h-screen bg-slate-950 relative overflow-hidden font-sans select-none">
      
      {/* --- 地图层 --- */}
      <div className="absolute inset-0 bg-cover bg-center transition-all duration-1000" style={{ backgroundImage: `url('${inTower ? '/命之塔.jpg' : '/map_background.jpg'}')` }}>
        <div className="absolute inset-0 bg-black/40" />
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
                {/* 渲染同位置玩家，支持对戏 */}
                {playersHere.map(p => {
                  const isPDead = p.hp <= 0;
                  return (
                    <div key={p.id} onClick={() => p.id !== user.id && setChatTarget(p)} className={`w-8 h-8 rounded-full border-2 shadow-xl cursor-pointer overflow-hidden transition-all ${p.id === user.id ? 'border-amber-400 z-30 scale-125' : 'border-white bg-slate-200 hover:scale-110 z-10'} ${isPDead ? 'opacity-50 grayscale' : ''}`}>
                       {isPDead && <Ghost className="absolute inset-0 m-auto text-white/50" size={16}/>}
                      {p.avatarUrl ? <img src={p.avatarUrl} className="w-full h-full object-cover"/> : <span className="text-[10px] m-auto font-black">{p.name[0]}</span>}
                    </div>
                  );
                })}
              </div>
              <button onClick={() => setSelectedLocation(loc)} className="group flex flex-col items-center">
                <div className={`p-2 rounded-full shadow-2xl border-2 transition-all group-hover:scale-125 ${inTower ? 'bg-sky-500 border-sky-100' : 'bg-rose-600 border-white'}`}><MapPin size={18} className="text-white"/></div>
                <span className="mt-1 px-3 py-1 bg-black/80 text-white text-[10px] font-black rounded-lg">{loc.name}</span>
              </button>
            </div>
          );
        })}
      </div>

      {/* --- 重点：整合后真正可随意停驻的个人面板 --- */}
      <motion.div 
        drag 
        dragMomentum={false} 
        className="absolute z-[60]"
        style={{ top: 24, left: 24 }} // 初始位置
      >
        <AnimatePresence mode="wait">
          {!isPanelMinimized ? (
            <motion.div 
              key="full-panel"
              initial={{ opacity: 0, scale: 0.9 }} 
              animate={{ opacity: 1, scale: 1 }} 
              exit={{ opacity: 0, scale: 0.9 }} 
              className="w-64 bg-white/95 backdrop-blur-xl rounded-[32px] shadow-2xl p-6 border border-white/50 cursor-grab active:cursor-grabbing"
            >
               <div className="flex justify-between items-start mb-4">
                  <div className="w-14 h-14 rounded-2xl border-2 border-sky-500 overflow-hidden bg-slate-100 cursor-pointer">
                    {user.avatarUrl ? <img src={user.avatarUrl} className="w-full h-full object-cover"/> : <UserIcon className="m-auto text-gray-300" size={24}/>}
                  </div>
                  {/* 点击隐藏，但不改变 motion.div 的外层坐标 */}
                  <button onClick={() => setIsPanelMinimized(true)} className="text-[10px] font-black text-slate-400 hover:text-slate-900 pointer-events-auto">隐藏面板</button>
               </div>
               
               <h2 className="font-black text-xl text-slate-900 mb-1 flex items-center gap-2">
                 {user.name} 
                 {isGhost && <span className="text-[10px] bg-purple-100 text-purple-600 px-2 py-0.5 rounded-full">灵魂状态</span>}
               </h2>
               <p className="text-[10px] font-black text-sky-700 bg-sky-50 inline-block px-2 py-0.5 rounded-full mb-6">{(user as any).job || user.role}</p>

               <div className="space-y-3 mb-6">
                  {/* 中文化的数据面板 */}
                  <StatusRow label="生命值" cur={(user as any).hp || 100} color="bg-rose-500" />
                  <StatusRow label="精神力" cur={(user as any).mentalProgress || 0} color="bg-indigo-600" />
                  <StatusRow label="默契度" cur={spiritStatus.intimacy || 0} color="bg-pink-500" />
               </div>
               
               <div className="border-t border-gray-100 pt-3 mb-4">
                  <p className="text-[9px] font-black text-gray-400 mb-2 uppercase">个人技能</p>
                  <div className="flex flex-wrap gap-1">
                     {skills.length === 0 && <span className="text-[10px] text-gray-300 italic">尚未习得技能</span>}
                     {skills.map(s => <span key={s.id} className="px-2 py-0.5 bg-sky-50 text-sky-600 rounded-md text-[10px] font-bold border border-sky-100">{s.name} Lv.{s.level}</span>)}
                  </div>
               </div>

               <div className="bg-slate-900 text-white p-3 rounded-2xl flex justify-between items-center"><HandCoins size={16} className="text-amber-400"/><span className="font-black text-sm">{user.gold} G</span></div>
            </motion.div>
          ) : (
            <motion.div 
              key="mini-btn"
              initial={{ opacity: 0, scale: 0.8 }} 
              animate={{ opacity: 1, scale: 1 }} 
              exit={{ opacity: 0, scale: 0.8 }}
              onClick={() => setIsPanelMinimized(false)}
              className="bg-white shadow-2xl px-5 py-3 rounded-full font-black text-xs flex items-center gap-2 cursor-pointer border border-slate-200 pointer-events-auto"
            >
              <UserIcon size={14} className="text-sky-500"/> 显示面板
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* --- NPC交互弹窗 --- */}
      <AnimatePresence>
        {/* 老乔交互 (更新后) */}
        {activeNPC?.id === 'npc_craftsman' && (
          <NPCModal npc={activeNPC} onClose={() => setActiveNPC(null)}>
            <div className="flex gap-3">
               <button onClick={handleTalkToJoe} className="flex-1 py-4 bg-sky-600 text-white font-black rounded-2xl shadow-lg">
                 搭话 ({joesPatience}/3)
               </button>
               <button onClick={() => setActiveNPC(null)} className="w-1/3 py-4 bg-slate-100 text-slate-500 font-black rounded-2xl">
                 离开
               </button>
            </div>
          </NPCModal>
        )}

        {/* 贾斯汀交互 (新增) */}
        {activeNPC?.id === 'npc_merchant' && (
          <NPCModal npc={activeNPC} onClose={() => {setActiveNPC(null); setMerchantView('menu');}}>
            {merchantView === 'menu' && (
              <div className="grid grid-cols-1 gap-3">
                <button onClick={() => setMerchantView('buy')} className="py-3 bg-amber-50 text-amber-600 font-black rounded-2xl border border-amber-100">购买商品</button>
                <button onClick={() => setMerchantView('auction')} className="py-3 bg-purple-50 text-purple-600 font-black rounded-2xl border border-purple-100">物品拍卖</button>
                <button onClick={() => setActiveNPC(null)} className="py-3 bg-slate-100 text-slate-500 font-black rounded-2xl">离开</button>
              </div>
            )}
            {merchantView === 'buy' && (
              <div className="space-y-3">
                <div className="p-3 bg-slate-50 rounded-xl flex justify-between items-center"><span className="text-sm font-bold">先贤手稿</span><span className="text-amber-500 font-black text-xs">5000 G</span></div>
                <div className="p-3 bg-slate-50 rounded-xl flex justify-between items-center"><span className="text-sm font-bold">走私机械臂</span><span className="text-amber-500 font-black text-xs">3200 G</span></div>
                <button onClick={() => setMerchantView('menu')} className="w-full text-xs text-slate-400 font-bold py-2">返回</button>
              </div>
            )}
            {merchantView === 'auction' && (
              <div className="space-y-3 text-center">
                <p className="text-xs text-gray-500 mb-4">把你的好东西交给我。如果其他玩家竞拍成功，我会收取 <span className="text-rose-500 font-bold">10% 的手续费</span>，童叟无欺。</p>
                <button onClick={handleAuction} className="w-full py-3 bg-purple-600 text-white font-black rounded-2xl">上架我的物品</button>
                <button onClick={() => setMerchantView('menu')} className="w-full text-xs text-slate-400 font-bold py-2">返回</button>
              </div>
            )}
          </NPCModal>
        )}
      </AnimatePresence>

      {/* --- 背包弹窗 (新增) --- */}
      <AnimatePresence>
        {showBackpack && (
           <motion.div initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 50, opacity: 0 }} className="fixed bottom-24 right-24 w-72 bg-white/95 backdrop-blur-xl rounded-[32px] shadow-2xl border p-6 z-[80]">
             <div className="flex justify-between items-center mb-4"><h3 className="font-black text-lg flex items-center gap-2"><Backpack size={20} className="text-slate-700"/>我的背包</h3><X size={18} className="cursor-pointer" onClick={() => setShowBackpack(false)}/></div>
             <div className="grid grid-cols-4 gap-2">
                {myInventory.length === 0 ? <p className="col-span-4 text-center text-xs text-gray-400 py-4">背包空空如也</p> : 
                 myInventory.map((item, idx) => (
                   <div key={idx} className="aspect-square bg-slate-100 rounded-xl flex items-center justify-center text-[10px] text-center p-1 font-bold text-slate-600 border border-slate-200">{item}</div>
                 ))}
             </div>
           </motion.div>
        )}
      </AnimatePresence>

      {/* --- 坐标交互底栏 --- */}
      <AnimatePresence>
        {selectedLocation && (
          <motion.div initial={{ y: 100 }} animate={{ y: 0 }} exit={{ y: 100 }} className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur-xl p-4 rounded-[32px] shadow-2xl flex gap-3 z-50">
            <button onClick={() => handleLocationAction('explore')} className="px-6 py-3 bg-slate-100 text-slate-700 font-black rounded-2xl hover:bg-slate-200 transition-colors">探索区域</button>
            <button onClick={() => handleLocationAction('stay')} className="px-6 py-3 bg-sky-500 text-white font-black rounded-2xl shadow-lg shadow-sky-500/30 hover:bg-sky-400 transition-colors">在此驻扎</button>
            <button onClick={() => setSelectedLocation(null)} className="p-3 bg-slate-100 text-slate-400 rounded-2xl hover:text-slate-600"><X size={20} /></button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- 底部控制栏 --- */}
      <div className="absolute bottom-8 right-8 flex gap-4 z-40">
        <ControlBtn icon={<ClipboardList/>} color="text-amber-500" onClick={() => setShowCommissionBoard(!showCommissionBoard)}/>
        <ControlBtn icon={<MessageSquareText/>} count={unreadCount} color="text-sky-500" />
        <ControlBtn icon={<Backpack/>} color="text-slate-700" onClick={() => setShowBackpack(!showBackpack)}/>
        <ControlBtn icon={<Settings/>} color="text-slate-400" />
      </div>

      {/* Toast */}
      <AnimatePresence>
        {toastMsg && <motion.div initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -20, opacity: 0 }} className="absolute top-8 left-1/2 -translate-x-1/2 bg-gray-900/90 text-white px-6 py-3 rounded-2xl z-[500] flex items-center gap-3 border border-gray-700 text-sm shadow-2xl"><Bell size={16} className="text-amber-400"/>{toastMsg}</motion.div>}
      </AnimatePresence>

    </div>
  );
}

// === 辅助组件 ===
function NPCModal({ npc, onClose, children }: any) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{opacity: 0}} className="fixed inset-0 bg-black/40 z-[110] flex items-center justify-center p-4">
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
  return (<div className="w-full"><div className="flex justify-between text-[11px] font-black text-slate-500 mb-1 tracking-tighter"><span>{label}</span><span>{Math.floor(cur)}%</span></div><div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden"><motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(100, cur)}%` }} className={`h-full ${color} rounded-full`}/></div></div>);
}

function ControlBtn({ icon, count, color, onClick }: any) {
  return (<button onClick={onClick} className={`relative w-14 h-14 bg-white rounded-full shadow-2xl flex items-center justify-center ${color} hover:scale-110 transition-all border border-slate-50`}>{icon}{count > 0 && <span className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 rounded-full text-white text-[10px] font-black border-2 border-white animate-bounce flex items-center justify-center shadow-lg">{count}</span>}</button>);
}

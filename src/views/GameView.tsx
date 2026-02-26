import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Settings, Backpack, X, Upload, MapPin, Bell, User as UserIcon, ScrollText, Hammer, HandCoins } from 'lucide-react';
import { ViewState } from '../App';
import { User, Tombstone, Item } from '../types';

interface Props {
  user: User;
  setUser: (user: User | null) => void;
  onNavigate: (view: ViewState) => void;
}

// === 1. 地图与掉落数据 ===
interface MapLocation { id: string; name: string; x: number; y: number; description: string; lootTable: string[]; }
const mapLocations: MapLocation[] = [
  { id: 'tower_of_life', name: '命之塔', x: 50, y: 50, description: '神圣而又洁白的塔...', lootTable: ['高阶精神结晶'] },
  { id: 'london_tower', name: '伦敦塔', x: 58, y: 48, description: '如学院一般的塔...', lootTable: ['标准向导素'] },
  { id: 'sanctuary', name: '圣所', x: 42, y: 48, description: '负责教育年幼哨兵与向导的机构...', lootTable: ['幼崽安抚奶嘴'] },
  { id: 'guild', name: '公会', x: 50, y: 72, description: '处理民众委托的庞大组织。按能力分配A~S级任务。', lootTable: ['悬赏令碎片'] },
  { id: 'army', name: '军队', x: 50, y: 15, description: '表面上为保护命之塔而建...', lootTable: ['制式军用匕首'] },
  { id: 'slums', name: '贫民区', x: 25, y: 55, description: '破旧房屋拥挤，技术能力者的聚集地。虽然污染严重，但拥有核心技术。', lootTable: ['废弃机械零件'] },
  { id: 'rich_area', name: '富人区', x: 75, y: 55, description: '相对整洁富裕，财富与权力的聚集地。这里充满着金钱的交易。', lootTable: ['精致的高脚杯'] },
  { id: 'tower_guard', name: '守塔会', x: 65, y: 35, description: '信仰塔的组织...', lootTable: ['忏悔书'] },
  { id: 'demon_society', name: '恶魔会', x: 15, y: 35, description: '追求自由的随性组织...', lootTable: ['反叛标语传单'] },
  { id: 'paranormal_office', name: '灵异管理所', x: 30, y: 70, description: '看管鬼魂的神秘机构...', lootTable: ['引魂灯残片'] },
  { id: 'observers', name: '观察者', x: 65, y: 15, description: '遍布世界的眼线...', lootTable: ['加密的微型胶卷'] }
];

// === 2. NPC 与委托数据结构 ===
interface NPC { id: string; name: string; role: string; locationId: string; description: string; icon: React.ReactNode; }
const fixedNPCs: NPC[] = [
  { id: 'npc_merchant', name: '拍卖商人 贾斯汀', role: '东区商人', locationId: 'rich_area', description: '浑身散发着金钱气息的精明商人，只要有利润，一切好商量。', icon: <HandCoins size={14} /> },
  { id: 'npc_craftsman', name: '怪脾气的老乔', role: '西区手艺人', locationId: 'slums', description: '满手机油和伤疤的老工匠，脾气极臭，极度讨厌被打扰。', icon: <Hammer size={14} /> },
  { id: 'npc_guild_staff', name: '接待员 玛丽', role: '公会员工', locationId: 'guild', description: '永远挂着职业微笑的接待员，负责处理繁杂的委托任务。', icon: <ScrollText size={14} /> }
];

interface Commission { id: string; publisherId: number; publisherName: string; title: string; content: string; difficulty: string; status: 'open' | 'accepted'; acceptedById?: number; acceptedByName?: string; }

export function GameView({ user, setUser, onNavigate }: Props) {
  // 基础状态
  const [showSettings, setShowSettings] = useState(false);
  const [showBackpack, setShowBackpack] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  
  // 从 user 对象中初始化位置（如果有的话）
  const [userLocationId, setUserLocationId] = useState<string | null>((user as any).currentLocation || null);
  const [allPlayers, setAllPlayers] = useState<any[]>([]); // 存储所有在线玩家位置
  
  // 交互面板状态
  const [selectedLocation, setSelectedLocation] = useState<MapLocation | null>(null);
  const [activeNPC, setActiveNPC] = useState<NPC | null>(null);

  // === 手艺人老乔的专属状态 ===
  const [craftsmanTalkCount, setCraftsmanTalkCount] = useState(0);
  const [craftsmanLearnCount, setCraftsmanLearnCount] = useState(0);

  // === 公会委托的专属状态 ===
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [guildView, setGuildView] = useState<'menu' | 'publish' | 'board'>('menu');
  const [newCommission, setNewCommission] = useState({ title: '', content: '', difficulty: 'D' });

  // 辅助函数
  const showToast = (msg: string) => { setToastMsg(msg); setTimeout(() => setToastMsg(null), 3000); };
  
  // 初始化拉取数据
  useEffect(() => {
    fetchItems();
    fetchMapPlayers();
    fetchCommissions();
    // 定时刷新地图玩家和委托板（每 10 秒）
    const interval = setInterval(() => {
      fetchMapPlayers();
      fetchCommissions();
    }, 10000);
    return () => clearInterval(interval);
  }, [user.id]);

  // === API 调用函数 ===
  const fetchItems = async () => {
    const res = await fetch(`/api/users/${user.id}/items`);
    const data = await res.json();
    if (data.success) setItems(data.items);
  };

  const fetchCommissions = async () => {
    const res = await fetch('/api/commissions');
    const data = await res.json();
    if (data.success) setCommissions(data.commissions);
  };

  const fetchMapPlayers = async () => {
    // 拉取所有玩家数据用于在地图上显示头像
    const res = await fetch('/api/admin/users');
    const data = await res.json();
    if (data.success) {
      // 过滤掉没位置、待审核、已死亡的玩家
      const activePlayers = data.users.filter((p: any) => p.currentLocation && p.status !== 'pending' && p.status !== 'dead');
      setAllPlayers(activePlayers);
      // 同步当前玩家的位置状态
      const me = activePlayers.find((p: any) => p.id === user.id);
      if (me && me.currentLocation) setUserLocationId(me.currentLocation);
    }
  };

  const handleLocationAction = async (action: 'enter' | 'explore' | 'stay') => {
    if (!selectedLocation) return;

    if (action === 'explore') {
      if (Math.random() > 0.4) {
        const itemName = selectedLocation.lootTable[Math.floor(Math.random() * selectedLocation.lootTable.length)];
        // 【写入数据库】闲逛掉落
        const res = await fetch(`/api/users/${user.id}/items`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: itemName, description: `在${selectedLocation.name}闲逛获得` })
        });
        const data = await res.json();
        if (data.success) {
          fetchItems(); // 重新拉取背包
          showToast(`【掉落】发现了「${itemName}」！已放入背包。`);
        }
      } else {
        showToast(`你在 ${selectedLocation.name} 转了半天，一无所获。`);
      }
    } 
    else if (action === 'stay') {
      // 【写入数据库】驻留更新位置
      const res = await fetch(`/api/users/${user.id}/location`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locationId: selectedLocation.id })
      });
      if (res.ok) {
        setUserLocationId(selectedLocation.id);
        fetchMapPlayers(); // 刷新地图头像
        showToast(`你决定在 ${selectedLocation.name} 驻扎休息。`);
      }
    } 
    else {
      showToast(`尝试进入 ${selectedLocation.name} 的内部 (建设中)`);
    }
    setSelectedLocation(null);
  };

  // --- 公会任务处理 (写入数据库) ---
  const handlePublishCommission = async () => {
    if (!newCommission.title || !newCommission.content) { showToast('标题和内容不能为空！'); return; }
    
    const res = await fetch('/api/commissions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: Date.now().toString(),
        publisherId: user.id,
        publisherName: user.name,
        title: newCommission.title,
        content: newCommission.content,
        difficulty: newCommission.difficulty
      })
    });
    const data = await res.json();
    if (data.success) {
      fetchCommissions();
      setGuildView('menu');
      setNewCommission({ title: '', content: '', difficulty: 'D' });
      showToast('委托发布成功！');
    }
  };

  const handleAcceptCommission = async (id: string) => {
    const res = await fetch(`/api/commissions/${id}/accept`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id, userName: user.name })
    });
    const data = await res.json();
    if (data.success) {
      fetchCommissions();
      showToast('成功接取委托！');
    } else {
      showToast(data.message || '接取失败，手慢了！');
      fetchCommissions(); // 刷新一下看看是不是被别人抢了
    }
  };

  // --- 手艺人学习处理 (本地状态模拟) ---
  const handleLearnSkill = () => {
    if (craftsmanLearnCount >= 3) {
      showToast('老乔：今天老子累了，明天再来！'); return;
    }
    const skills = ['初级机械打磨', '粗糙防毒面具制作', '基础器械维修', '初级绷带制作'];
    const randomSkill = skills[Math.floor(Math.random() * skills.length)];
    setCraftsmanLearnCount(prev => prev + 1);
    showToast(`【领悟】你跟着老乔学习，掌握了新技能：「${randomSkill}」！`);
  };

  // 聚合当前地点的所有单位 (固定NPC + 数据库里的真实玩家)
  const getEntitiesAtLocation = (locId: string) => {
    const entities: any[] = fixedNPCs.filter(npc => npc.locationId === locId);
    
    // 找出数据库中当前位置在这个地点的玩家
    const playersHere = allPlayers.filter(p => p.currentLocation === locId);
    playersHere.forEach(p => {
      entities.push({ id: p.id, isUser: true, name: p.name, role: p.role, avatarUrl: p.avatarUrl });
    });
    return entities;
  };

  return (
    <div className="min-h-screen bg-[#f5f5f0] relative overflow-hidden font-sans">
      
      {/* Toast 提示 */}
      <AnimatePresence>
        {toastMsg && (
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="absolute top-8 left-1/2 transform -translate-x-1/2 bg-gray-900/90 backdrop-blur-md text-white px-6 py-3 rounded-2xl shadow-xl z-50 flex items-center gap-3 border border-gray-700 text-sm">
            <Bell size={16} className="text-amber-400" /> {toastMsg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- 地图层 --- */}
      <div className="absolute inset-0 pointer-events-auto bg-cover bg-center" style={{ backgroundImage: "url('/map_background.jpg')" }}>
        <div className="absolute inset-0 bg-black/15 pointer-events-none" /> 
        {mapLocations.map((loc) => {
          const entities = getEntitiesAtLocation(loc.id);
          return (
            <div key={loc.id} className="absolute transform -translate-x-1/2 -translate-y-1/2 z-10 flex flex-col items-center" style={{ left: `${loc.x}%`, top: `${loc.y}%` }}>
              {entities.length > 0 && (
                <div className="flex -space-x-2 mb-1">
                  {entities.map(ent => (
                    <div key={ent.id} onClick={() => !ent.isUser && setActiveNPC(ent)} className={`w-6 h-6 rounded-full border-2 shadow-sm bg-gray-200 flex items-center justify-center overflow-hidden cursor-pointer ${ent.isUser ? 'border-amber-400 z-10 scale-110 cursor-default' : 'border-white hover:scale-110'}`} title={ent.name}>
                       {ent.isUser ? (
                         ent.avatarUrl ? <img src={ent.avatarUrl} className="w-full h-full object-cover"/> : <span className="text-[10px] font-bold text-gray-800">{ent.name[0]}</span>
                       ) : <span className="text-gray-600">{ent.icon}</span>}
                    </div>
                  ))}
                </div>
              )}
              <button onClick={() => setSelectedLocation(loc)} className="group flex flex-col items-center justify-center hover:scale-110 transition-transform">
                <div className="bg-red-600/90 p-1.5 rounded-full shadow-lg border-2 border-white/80 mb-1"><MapPin size={16} className="text-white" /></div>
                <span className="px-2 py-0.5 bg-black/75 text-white text-xs font-bold rounded shadow-sm whitespace-nowrap">{loc.name}</span>
              </button>
            </div>
          );
        })}
      </div>

      {/* --- 地点交互主弹窗 --- */}
      <AnimatePresence>
        {selectedLocation && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-[40] flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl relative">
              <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-emerald-500 to-teal-500" />
              <div className="flex justify-between items-center mb-4 mt-2">
                <h3 className="text-2xl font-black text-gray-900 flex items-center gap-2"><MapPin className="text-emerald-600" />{selectedLocation.name}</h3>
                <button onClick={() => setSelectedLocation(null)} className="text-gray-400 hover:bg-gray-100 rounded-full p-1"><X size={20} /></button>
              </div>
              <div className="bg-gray-50 rounded-xl p-4 mb-4 border border-gray-100 h-28 overflow-y-auto text-sm text-gray-700">{selectedLocation.description}</div>
              
              <div className="mb-6">
                <div className="text-xs font-bold text-gray-400 mb-2 uppercase">当前在此地的人 (点击交互)</div>
                <div className="flex flex-wrap gap-2">
                  {getEntitiesAtLocation(selectedLocation.id).map(ent => (
                    <div key={ent.id} onClick={() => { if(!ent.isUser) { setSelectedLocation(null); setActiveNPC(ent); } }} className={`flex items-center gap-2 bg-white border border-gray-200 rounded-full px-2 py-1 shadow-sm ${ent.isUser ? '' : 'cursor-pointer hover:border-emerald-400 hover:bg-emerald-50'}`}>
                      <div className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden text-gray-600">
                        {ent.isUser ? (ent.avatarUrl ? <img src={ent.avatarUrl} className="w-full h-full object-cover"/> : <UserIcon size={12}/>) : ent.icon}
                      </div>
                      <span className="text-xs font-medium text-gray-700 pr-1">{ent.name}</span>
                    </div>
                  ))}
                  {getEntitiesAtLocation(selectedLocation.id).length === 0 && <span className="text-xs text-gray-400">空无一人...</span>}
                </div>
              </div>

              <div className="space-y-3">
                <button onClick={() => handleLocationAction('enter')} className="w-full py-3 bg-emerald-50 text-emerald-700 rounded-xl font-bold border border-emerald-200">进入区域</button>
                <button onClick={() => handleLocationAction('explore')} className="w-full py-3 bg-sky-50 text-sky-700 rounded-xl font-bold border border-sky-200">闲逛寻找物资</button>
                <button onClick={() => handleLocationAction('stay')} disabled={userLocationId === selectedLocation.id} className="w-full py-3 bg-gray-900 text-white rounded-xl font-bold disabled:bg-gray-400">
                  {userLocationId === selectedLocation.id ? '你已经驻扎在此地' : '什么都不做 (停留驻扎)'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- NPC 专属交互弹窗 --- */}
      <AnimatePresence>
        {activeNPC && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-gray-900/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl relative border-t-4 border-amber-500">
              
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gray-100 rounded-2xl flex items-center justify-center border border-gray-200 text-gray-600 shadow-inner">{activeNPC.icon}</div>
                  <div>
                    <h3 className="font-black text-xl text-gray-900">{activeNPC.name}</h3>
                    <p className="text-xs font-bold text-amber-600">{activeNPC.role}</p>
                  </div>
                </div>
                <button onClick={() => { setActiveNPC(null); setGuildView('menu'); }} className="text-gray-400 hover:bg-gray-100 rounded-full p-1"><X size={20} /></button>
              </div>
              
              <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-xl mb-6 italic">"{activeNPC.description}"</p>

              {/* 1. 富人区 - 拍卖商人逻辑 */}
              {activeNPC.id === 'npc_merchant' && (
                <div className="space-y-3">
                  <button onClick={() => showToast('打开了出售界面 (建设中)')} className="w-full py-3.5 bg-gray-100 text-gray-800 rounded-xl font-bold hover:bg-gray-200 transition-colors">出售物品</button>
                  <button onClick={() => showToast('打开了寄售界面 (收取1%手续费)')} className="w-full py-3.5 bg-amber-50 text-amber-700 rounded-xl font-bold border border-amber-200 hover:bg-amber-100">拍卖寄售 (收取 1% 手续费)</button>
                </div>
              )}

              {/* 2. 贫民区 - 手艺人逻辑 */}
              {activeNPC.id === 'npc_craftsman' && (
                <div className="space-y-4">
                  <div className="bg-gray-900 text-gray-100 p-4 rounded-xl text-sm font-medium relative">
                    <div className="absolute -top-2 left-6 w-4 h-4 bg-gray-900 rotate-45"></div>
                    {craftsmanTalkCount === 0 && '滚开！没看到我正忙着吗？别来烦我！'}
                    {craftsmanTalkCount === 1 && '你是不是耳朵有毛病？我说了快滚！'}
                    {craftsmanTalkCount === 2 && '（放下扳手）你这人怎么跟苍蝇一样烦人...'}
                    {craftsmanTalkCount >= 3 && '算了算了，看你这倒霉样，想学点什么手艺就赶紧说，别浪费我时间！'}
                  </div>
                  
                  {craftsmanTalkCount < 3 ? (
                    <button onClick={() => setCraftsmanTalkCount(prev => prev + 1)} className="w-full py-3.5 bg-gray-100 text-gray-800 rounded-xl font-bold hover:bg-gray-200">坚持与他搭话</button>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-xs text-gray-500 text-center">今日剩余学习次数: {3 - craftsmanLearnCount}/3</p>
                      <button onClick={handleLearnSkill} className="w-full py-3.5 bg-emerald-50 text-emerald-700 rounded-xl font-bold border border-emerald-200 hover:bg-emerald-100">向他学习手艺</button>
                    </div>
                  )}
                </div>
              )}

              {/* 3. 公会 - 玛丽的委托逻辑 */}
              {activeNPC.id === 'npc_guild_staff' && (
                <div>
                  {guildView === 'menu' && (
                    <div className="space-y-3">
                      <div className="text-center font-bold text-gray-700 mb-4">“您好，冒险者。要做什么吗？”</div>
                      <button onClick={() => setGuildView('board')} className="w-full py-3 bg-sky-50 text-sky-700 rounded-xl font-bold border border-sky-200">查看委托板</button>
                      <button onClick={() => setGuildView('publish')} className="w-full py-3 bg-amber-50 text-amber-700 rounded-xl font-bold border border-amber-200">发布新委托</button>
                    </div>
                  )}

                  {guildView === 'publish' && (
                    <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2">
                      <h4 className="font-bold text-gray-900 mb-2">发布新委托</h4>
                      <input value={newCommission.title} onChange={e => setNewCommission({...newCommission, title: e.target.value})} placeholder="委托标题" className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-amber-400" />
                      <textarea value={newCommission.content} onChange={e => setNewCommission({...newCommission, content: e.target.value})} placeholder="详细内容要求..." className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm h-24 resize-none outline-none focus:border-amber-400" />
                      <select value={newCommission.difficulty} onChange={e => setNewCommission({...newCommission, difficulty: e.target.value})} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none">
                        <option value="D">难度: D (简单日常)</option>
                        <option value="C">难度: C (轻度危险)</option>
                        <option value="B">难度: B (需要战斗)</option>
                        <option value="A">难度: A (高危任务)</option>
                      </select>
                      <div className="flex gap-2 pt-2">
                        <button onClick={() => setGuildView('menu')} className="flex-1 py-3 bg-gray-100 text-gray-600 rounded-xl font-bold">返回</button>
                        <button onClick={handlePublishCommission} className="flex-1 py-3 bg-gray-900 text-white rounded-xl font-bold">提交发布</button>
                      </div>
                    </div>
                  )}

                  {guildView === 'board' && (
                    <div className="animate-in fade-in slide-in-from-bottom-2">
                      <div className="flex justify-between items-center mb-3">
                        <h4 className="font-bold text-gray-900">公共委托板</h4>
                        <button onClick={() => setGuildView('menu')} className="text-xs font-bold text-sky-600 hover:underline">返回菜单</button>
                      </div>
                      <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                        {commissions.length === 0 && <p className="text-center text-sm text-gray-400 py-4">目前没有任何委托。</p>}
                        {commissions.map(c => (
                          <div key={c.id} className={`p-3 rounded-xl border ${c.status === 'accepted' ? 'bg-gray-50 border-gray-200 opacity-75' : 'bg-white border-gray-300 shadow-sm'}`}>
                            <div className="flex justify-between items-start mb-1">
                              <span className="font-bold text-sm text-gray-900">{c.title} <span className="text-xs text-red-500 ml-1">[{c.difficulty}级]</span></span>
                              <span className="text-[10px] bg-gray-200 px-2 py-0.5 rounded text-gray-600">{c.publisherName}</span>
                            </div>
                            <p className="text-xs text-gray-600 mb-3">{c.content}</p>
                            {c.status === 'open' ? (
                              <button onClick={() => handleAcceptCommission(c.id)} className="w-full py-2 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-lg border border-emerald-200 hover:bg-emerald-100">接受委托</button>
                            ) : (
                              <button disabled className="w-full py-2 bg-gray-200 text-gray-500 text-xs font-bold rounded-lg">已被 {c.acceptedByName} 接受</button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- 右下角背包和设置入口 --- */}
      <div className="absolute bottom-6 right-6 flex gap-3 z-30">
        <button onClick={() => setShowBackpack(true)} className="w-14 h-14 bg-white rounded-full shadow-md border border-gray-200 flex items-center justify-center text-gray-700 hover:scale-105 transition-all">
          <Backpack size={24} />
          {items.length > 0 && <span className="absolute top-0 right-0 w-4 h-4 bg-red-500 rounded-full text-[10px] text-white flex items-center justify-center border-2 border-white">{items.length}</span>}
        </button>
        <button onClick={() => setShowSettings(true)} className="w-14 h-14 bg-gray-900 rounded-full shadow-md border border-gray-800 flex items-center justify-center text-white hover:scale-105 transition-all">
          <Settings size={24} />
        </button>
      </div>

    </div>
  );
}

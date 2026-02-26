import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Settings, Backpack, X, Upload, MapPin, Bell, User as UserIcon, ScrollText, Hammer, HandCoins, MessageSquareText, Send, Users } from 'lucide-react';
import { ViewState } from '../App';
import { User, Tombstone, Item } from '../types';

interface Skill { id: number; userId: number; name: string; level: number; }
interface Props { user: User; setUser: (user: User | null) => void; onNavigate: (view: ViewState) => void; }

// === 地图与掉落数据 ===
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

// === NPC 与委托数据 ===
interface NPC { id: string; name: string; role: string; locationId: string; description: string; icon: React.ReactNode; }
const fixedNPCs: NPC[] = [
  { id: 'npc_merchant', name: '拍卖商人 贾斯汀', role: '东区商人', locationId: 'rich_area', description: '浑身散发着金钱气息的精明商人，只要有利润，一切好商量。', icon: <HandCoins size={14} /> },
  { id: 'npc_craftsman', name: '怪脾气的老乔', role: '西区手艺人', locationId: 'slums', description: '满手机油和伤疤的老工匠，脾气极臭，极度讨厌被打扰。', icon: <Hammer size={14} /> },
  { id: 'npc_guild_staff', name: '接待员 玛丽', role: '公会员工', locationId: 'guild', description: '永远挂着职业微笑的接待员，负责处理繁杂的委托任务。', icon: <ScrollText size={14} /> }
];

interface Commission { id: string; publisherId: number; publisherName: string; title: string; content: string; difficulty: string; status: 'open' | 'accepted'; acceptedById?: number; acceptedByName?: string; }

export function GameView({ user, setUser, onNavigate }: Props) {
  // 基础界面控制状态
  const [showSettings, setShowSettings] = useState(false);
  const [showBackpack, setShowBackpack] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showDeathModal, setShowDeathModal] = useState(false);
  const [deathType, setDeathType] = useState<'die' | 'ghost'>('die');
  const [deathDesc, setDeathDesc] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // 核心数据状态
  const [items, setItems] = useState<Item[]>([]);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [showLeftPanel, setShowLeftPanel] = useState(true);
  
  // 地图与互动状态
  const [userLocationId, setUserLocationId] = useState<string | null>((user as any).currentLocation || null);
  const [allPlayers, setAllPlayers] = useState<any[]>([]); 
  const [selectedLocation, setSelectedLocation] = useState<MapLocation | null>(null);
  const [activeNPC, setActiveNPC] = useState<NPC | null>(null);

  // NPC具体交互状态
  const [craftsmanTalkCount, setCraftsmanTalkCount] = useState(0);
  const [craftsmanLearnCount, setCraftsmanLearnCount] = useState(0);
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [guildView, setGuildView] = useState<'menu' | 'publish' | 'board'>('menu');
  const [newCommission, setNewCommission] = useState({ title: '', content: '', difficulty: 'D' });

  // === 对戏系统状态 ===
  const [chatTarget, setChatTarget] = useState<any | null>(null); 
  const [chatMessages, setChatMessages] = useState<any[]>([]); 
  const [chatInput, setChatInput] = useState(''); 
  const [unreadCount, setUnreadCount] = useState(0); 
  const [showMessageContacts, setShowMessageContacts] = useState(false); // 新增：通讯录列表
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const showToast = (msg: string) => { setToastMsg(msg); setTimeout(() => setToastMsg(null), 3000); };
  
  // 初始化与全局轮询
  useEffect(() => {
    fetchItems(); fetchSkills(); fetchMapPlayers(); fetchCommissions(); fetchUnreadCount();
    const interval = setInterval(() => { 
      fetchMapPlayers(); 
      fetchCommissions(); 
      fetchUnreadCount();
    }, 4000);
    return () => clearInterval(interval);
  }, [user.id]);

  // 对戏聊天室的独立高频轮询
  useEffect(() => {
    if (!chatTarget) return;
    fetchChatMessages();
    const chatInterval = setInterval(fetchChatMessages, 3000);
    return () => clearInterval(chatInterval);
  }, [chatTarget]);

  // 聊天自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // ================= API 请求区 =================
  const fetchItems = async () => { const res = await fetch(`/api/users/${user.id}/items`); const data = await res.json(); if (data.success) setItems(data.items); };
  const fetchSkills = async () => { const res = await fetch(`/api/users/${user.id}/skills`); const data = await res.json(); if (data.success) setSkills(data.skills); };
  const fetchCommissions = async () => { const res = await fetch('/api/commissions'); const data = await res.json(); if (data.success) setCommissions(data.commissions); };
  
  const fetchMapPlayers = async () => {
    const res = await fetch('/api/admin/users');
    const data = await res.json();
    if (data.success) {
      const activePlayers = data.users.filter((p: any) => p.currentLocation && p.status !== 'pending' && p.status !== 'dead');
      setAllPlayers(activePlayers);
      const me = activePlayers.find((p: any) => p.id === user.id);
      if (me && me.currentLocation) setUserLocationId(me.currentLocation);
    }
  };

  const fetchUnreadCount = async () => {
    const res = await fetch(`/api/roleplay/unread/${user.id}`);
    const data = await res.json();
    if (data.success) setUnreadCount(data.count);
  };

  const fetchChatMessages = async () => {
    if(!chatTarget) return;
    const res = await fetch(`/api/roleplay/conversation/${user.id}/${chatTarget.id}`);
    const data = await res.json();
    if (data.success) {
      setChatMessages(data.messages);
      fetchUnreadCount(); // 刷新红点
    }
  };

  // ================= 操作逻辑区 =================
  const handleSendRoleplayMessage = async () => {
    if (!chatInput.trim() || !chatTarget) return;
    const content = chatInput.trim();
    setChatInput(''); 
    const res = await fetch('/api/roleplay', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ senderId: user.id, senderName: user.name, receiverId: chatTarget.id, receiverName: chatTarget.name, content: content })
    });
    if (res.ok) fetchChatMessages();
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target?.result as string;
      const res = await fetch(`/api/users/${user.id}/avatar`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ avatarUrl: base64 }) });
      if (res.ok) { setUser({ ...user, avatarUrl: base64 }); showToast('头像上传成功！'); } else showToast('上传失败');
    };
    reader.readAsDataURL(file);
  };

  const handleLocationAction = async (action: 'enter' | 'explore' | 'stay') => {
    if (!selectedLocation) return;
    if (action === 'explore') {
      if (Math.random() > 0.4) {
        const itemName = selectedLocation.lootTable[Math.floor(Math.random() * selectedLocation.lootTable.length)];
        const res = await fetch(`/api/users/${user.id}/items`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: itemName, description: `在${selectedLocation.name}闲逛获得` }) });
        const data = await res.json();
        if (data.success) { fetchItems(); showToast(`【掉落】发现了「${itemName}」！已放入背包。`); }
      } else { showToast(`你在 ${selectedLocation.name} 转了半天，一无所获。`); }
    } else if (action === 'stay') {
      const res = await fetch(`/api/users/${user.id}/location`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ locationId: selectedLocation.id }) });
      if (res.ok) { setUserLocationId(selectedLocation.id); fetchMapPlayers(); showToast(`你决定在 ${selectedLocation.name} 驻扎休息。`); }
    } else { showToast(`尝试进入 ${selectedLocation.name} 的内部 (建设中)`); }
    setSelectedLocation(null);
  };

  const handleDeleteItem = async (itemId: string) => {
    const res = await fetch(`/api/items/${itemId}`, { method: 'DELETE' });
    if (res.ok) { setSelectedItem(null); fetchItems(); showToast('物品已丢弃'); }
  };

  const handleDeath = async () => {
    if (!deathDesc.trim()) return;
    const endpoint = deathType === 'die' ? 'die' : 'ghost';
    const res = await fetch(`/api/users/${user.id}/${endpoint}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deathDescription: deathDesc })
    });
    if (res.ok) {
      if (deathType === 'die') {
        setUser(null);
        onNavigate('WELCOME');
      } else {
        const updatedUser = await fetch(`/api/users/${user.name}`).then(r => r.json());
        if (updatedUser.success) {
          setUser(updatedUser.user);
          setShowDeathModal(false);
          setShowSettings(false);
          setDeathDesc('');
        }
      }
    }
  };

  // 公会委托与技能逻辑
  const handlePublishCommission = async () => {
    if (!newCommission.title || !newCommission.content) { showToast('标题和内容不能为空！'); return; }
    const res = await fetch('/api/commissions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: Date.now().toString(), publisherId: user.id, publisherName: user.name, title: newCommission.title, content: newCommission.content, difficulty: newCommission.difficulty }) });
    const data = await res.json();
    if (data.success) { fetchCommissions(); setGuildView('menu'); setNewCommission({ title: '', content: '', difficulty: 'D' }); showToast('委托发布成功！'); }
  };
  const handleAcceptCommission = async (id: string) => {
    const res = await fetch(`/api/commissions/${id}/accept`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: user.id, userName: user.name }) });
    const data = await res.json();
    if (data.success) { fetchCommissions(); showToast('成功接取委托！'); } else { showToast(data.message || '接取失败，手慢了！'); fetchCommissions(); }
  };
  const handleLearnSkill = async () => {
    if (craftsmanLearnCount >= 3) { showToast('老乔：今天老子累了，明天再来！'); return; }
    const skillPool = ['机械打磨', '防毒面具制作', '器械维修', '绷带制作'];
    const randomSkillName = skillPool[Math.floor(Math.random() * skillPool.length)];
    const res = await fetch(`/api/users/${user.id}/skills`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: randomSkillName }) });
    if (res.ok) { setCraftsmanLearnCount(prev => prev + 1); fetchSkills(); showToast(`【领悟】你跟着老乔学习，掌握/提升了技能：「${randomSkillName}」！`); }
  };
  const handleForgetSkill = async (skillId: number, skillName: string) => {
    if(!window.confirm(`确定要遗忘技能「${skillName}」吗？`)) return;
    const res = await fetch(`/api/skills/${skillId}`, { method: 'DELETE' });
    if (res.ok) { fetchSkills(); showToast(`你遗忘了技能：「${skillName}」`); }
  };

  const getEntitiesAtLocation = (locId: string) => {
    const entities: any[] = fixedNPCs.filter(npc => npc.locationId === locId);
    const playersHere = allPlayers.filter(p => p.currentLocation === locId);
    playersHere.forEach(p => { entities.push({ id: p.id, isUser: true, name: p.name, role: p.role, avatarUrl: p.avatarUrl }); });
    return entities;
  };

  const handleEntityClick = (ent: any) => {
    setSelectedLocation(null); 
    if (!ent.isUser) {
      setActiveNPC(ent);
    } else if (ent.id !== user.id) {
      setChatTarget(ent); // 开启对戏
    }
  };

  return (
    <div className="min-h-screen bg-[#f5f5f0] relative overflow-hidden font-sans">
      
      {/* Toast 提示 */}
      <AnimatePresence>
        {toastMsg && (
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="absolute top-8 left-1/2 transform -translate-x-1/2 bg-gray-900/90 backdrop-blur-md text-white px-6 py-3 rounded-2xl shadow-xl z-[100] flex items-center gap-3 border border-gray-700 text-sm">
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
            <div key={loc.id} className="absolute transform -translate-x-1/2 -translate-y-1/2 z-[5] flex flex-col items-center" style={{ left: `${loc.x}%`, top: `${loc.y}%` }}>
              {entities.length > 0 && (
                <div className="flex -space-x-2 mb-1">
                  {entities.map(ent => (
                    <div 
                      key={ent.id} 
                      onClick={() => handleEntityClick(ent)} 
                      className={`w-6 h-6 rounded-full border-2 shadow-sm bg-gray-200 flex items-center justify-center overflow-hidden cursor-pointer ${ent.id === user.id ? 'border-amber-400 z-10 scale-110 cursor-default' : 'border-white hover:scale-110'}`} 
                      title={ent.name}
                    >
                       {ent.isUser ? ( ent.avatarUrl ? <img src={ent.avatarUrl} className="w-full h-full object-cover"/> : <span className="text-[10px] font-bold text-gray-800">{ent.name[0]}</span>) : <span className="text-gray-600">{ent.icon}</span>}
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

      {/* ==================== 恢复的组件区 1：左侧资料面板 ==================== */}
      <AnimatePresence>
        {showLeftPanel ? (
          <motion.div initial={{ opacity: 0, x: -50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -50 }} className="absolute top-6 left-6 w-64 bg-white/95 backdrop-blur-md rounded-2xl shadow-lg border border-gray-200/50 p-4 z-30">
             <div className="flex justify-between items-start mb-4">
              <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()} title="点击更换头像">
                <div className="w-14 h-14 rounded-full border-2 border-sky-600 overflow-hidden bg-gray-100 flex items-center justify-center">
                  {user.avatarUrl ? <img src={user.avatarUrl} className="w-full h-full object-cover" /> : <UserIcon size={24} className="text-gray-400"/>}
                </div>
                <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><Upload size={16} className="text-white" /></div>
                <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleAvatarUpload} />
              </div>
              <button onClick={() => setShowLeftPanel(false)} className="text-xs font-bold text-gray-400 hover:text-gray-700">Hide</button>
            </div>
            <div className="space-y-2 text-sm mb-4">
              <div className="flex justify-between items-center"><span className="text-gray-500">名字:</span><span className="font-bold text-sky-700 cursor-pointer hover:underline" onClick={() => setShowProfileModal(true)}>{user.name}</span></div>
              <div className="flex justify-between items-center"><span className="text-gray-500">身份:</span><span className="font-bold text-gray-900">{user.role || '无'}</span></div>
              <div className="flex justify-between items-center"><span className="text-gray-500">金币:</span><span className="font-bold text-amber-600">{user.gold || 0}</span></div>
            </div>
            <div className="border-t border-gray-100 pt-3">
              <div className="text-xs text-gray-500 mb-2 font-bold">已掌握技能 ({skills.length})</div>
              <div className="space-y-2 max-h-24 overflow-y-auto pr-1">
                {skills.length === 0 && <div className="text-xs text-gray-400 italic">暂无技能。</div>}
                {skills.map(s => (
                  <div key={s.id} className="flex justify-between items-center bg-gray-50 rounded px-2 py-1 border border-gray-100 group">
                    <span className="text-xs font-medium text-gray-800">{s.name} <span className="text-amber-600 text-[10px]">Lv.{s.level}</span></span>
                    <button onClick={() => handleForgetSkill(s.id, s.name)} className="opacity-0 group-hover:opacity-100 text-[10px] text-red-500 hover:bg-red-50 px-1.5 rounded transition-all">遗忘</button>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        ) : (
          <button onClick={() => setShowLeftPanel(true)} className="absolute top-6 left-6 z-30 bg-white/90 backdrop-blur shadow-md rounded-full px-4 py-2 text-sm font-bold text-gray-700 hover:scale-105 transition-transform">显示角色面板</button>
        )}
      </AnimatePresence>

      {/* ==================== 恢复的组件区 2：详细档案弹窗 ==================== */}
      <AnimatePresence>
        {showProfileModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} className="bg-white rounded-3xl p-6 w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-6 border-b border-gray-100 pb-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full border border-gray-200 overflow-hidden bg-gray-100">{user.avatarUrl ? <img src={user.avatarUrl} className="w-full h-full object-cover" /> : <UserIcon className="w-full h-full p-2 text-gray-400"/>}</div>
                  <h3 className="text-2xl font-black text-gray-900">角色档案：{user.name}</h3>
                </div>
                <button onClick={() => setShowProfileModal(false)} className="text-gray-400 hover:text-gray-600 bg-gray-100 rounded-full p-2 transition-colors"><X size={20} /></button>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <ProfileField label="所属人群" value={user.role} />
                <ProfileField label="性别" value={(user as any).gender} />
                <ProfileField label="年龄" value={(user as any).age} />
                <ProfileField label="身高" value={(user as any).height} />
                <ProfileField label="阵营/职位" value={`${(user as any).faction || '无'} / ${(user as any).factionRole || '无'}`} />
                <ProfileField label="精神力" value={user.mentalRank} />
                <div className="col-span-2"><ProfileField label="背景故事" value={(user as any).background} isLong /></div>
                <div className="col-span-2"><ProfileField label="详细资料 (系统录入)" value={user.profileText} isLong /></div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ==================== 恢复的组件区 3：地点与NPC弹窗 ==================== */}
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
                    <div key={ent.id} onClick={() => handleEntityClick(ent)} className={`flex items-center gap-2 bg-white border border-gray-200 rounded-full px-2 py-1 shadow-sm ${ent.isUser ? 'hover:border-sky-400 hover:bg-sky-50' : 'hover:border-emerald-400 hover:bg-emerald-50'} cursor-pointer`}>
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

      <AnimatePresence>
        {activeNPC && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-gray-900/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl relative border-t-4 border-amber-500">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gray-100 rounded-2xl flex items-center justify-center border border-gray-200 text-gray-600 shadow-inner">{activeNPC.icon}</div>
                  <div><h3 className="font-black text-xl text-gray-900">{activeNPC.name}</h3><p className="text-xs font-bold text-amber-600">{activeNPC.role}</p></div>
                </div>
                <button onClick={() => { setActiveNPC(null); setGuildView('menu'); }} className="text-gray-400 hover:bg-gray-100 rounded-full p-1"><X size={20} /></button>
              </div>
              <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-xl mb-6 italic">"{activeNPC.description}"</p>

              {activeNPC.id === 'npc_merchant' && (
                <div className="space-y-3">
                  <button onClick={() => showToast('出售界面建设中')} className="w-full py-3.5 bg-gray-100 text-gray-800 rounded-xl font-bold hover:bg-gray-200 transition-colors">出售物品</button>
                  <button onClick={() => showToast('寄售界面建设中')} className="w-full py-3.5 bg-amber-50 text-amber-700 rounded-xl font-bold border border-amber-200 hover:bg-amber-100">拍卖寄售</button>
                </div>
              )}
              {activeNPC.id === 'npc_craftsman' && (
                <div className="space-y-4">
                  <div className="bg-gray-900 text-gray-100 p-4 rounded-xl text-sm font-medium relative">{craftsmanTalkCount >= 3 ? '想学点什么手艺就赶紧说！' : '滚开！别烦我！'}</div>
                  {craftsmanTalkCount < 3 ? (
                    <button onClick={() => setCraftsmanTalkCount(prev => prev + 1)} className="w-full py-3.5 bg-gray-100 text-gray-800 rounded-xl font-bold hover:bg-gray-200">坚持搭话</button>
                  ) : (
                    <button onClick={handleLearnSkill} className="w-full py-3.5 bg-emerald-50 text-emerald-700 rounded-xl font-bold border border-emerald-200 hover:bg-emerald-100">向他学习手艺</button>
                  )}
                </div>
              )}
              {activeNPC.id === 'npc_guild_staff' && (
                <div>
                  {guildView === 'menu' && (
                    <div className="space-y-3">
                      <button onClick={() => setGuildView('board')} className="w-full py-3 bg-sky-50 text-sky-700 rounded-xl font-bold border border-sky-200">查看委托板</button>
                      <button onClick={() => setGuildView('publish')} className="w-full py-3 bg-amber-50 text-amber-700 rounded-xl font-bold border border-amber-200">发布新委托</button>
                    </div>
                  )}
                  {guildView === 'publish' && (
                    <div className="space-y-3">
                      <input value={newCommission.title} onChange={e => setNewCommission({...newCommission, title: e.target.value})} placeholder="委托标题" className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none" />
                      <textarea value={newCommission.content} onChange={e => setNewCommission({...newCommission, content: e.target.value})} placeholder="内容要求..." className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm h-24 resize-none outline-none" />
                      <div className="flex gap-2 pt-2">
                        <button onClick={() => setGuildView('menu')} className="flex-1 py-3 bg-gray-100 text-gray-600 rounded-xl font-bold">返回</button>
                        <button onClick={handlePublishCommission} className="flex-1 py-3 bg-gray-900 text-white rounded-xl font-bold">提交发布</button>
                      </div>
                    </div>
                  )}
                  {guildView === 'board' && (
                    <div>
                      <button onClick={() => setGuildView('menu')} className="text-xs font-bold text-sky-600 hover:underline mb-3">返回菜单</button>
                      <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                        {commissions.map(c => (
                          <div key={c.id} className="p-3 rounded-xl border bg-white border-gray-300 shadow-sm">
                            <div className="font-bold text-sm text-gray-900 mb-1">{c.title}</div>
                            <p className="text-xs text-gray-600 mb-3">{c.content}</p>
                            {c.status === 'open' ? (
                              <button onClick={() => handleAcceptCommission(c.id)} className="w-full py-2 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-lg border border-emerald-200">接受委托</button>
                            ) : (<button disabled className="w-full py-2 bg-gray-200 text-gray-500 text-xs font-bold rounded-lg">已被接受</button>)}
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


      {/* ==================== 恢复的组件区 4：背包、设置与死亡弹窗 ==================== */}
      <AnimatePresence>
        {showBackpack && (
          <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="absolute bottom-24 right-6 w-80 bg-white rounded-3xl shadow-xl border border-gray-200 overflow-hidden z-40 flex flex-col max-h-[60vh]">
            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h3 className="font-bold text-gray-900">我的背包</h3>
              <button onClick={() => setShowBackpack(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <div className="p-4 overflow-y-auto flex-1">
              {items.length === 0 ? (<div className="text-center text-gray-400 py-8 text-sm">背包空空如也</div>) : (
                <div className="grid grid-cols-4 gap-2">
                  {items.map(item => (
                    <div key={item.id} onClick={() => setSelectedItem(item)} className={`aspect-square rounded-xl border flex items-center justify-center cursor-pointer transition-colors ${selectedItem?.id === item.id ? 'bg-sky-50 border-sky-400' : 'bg-gray-100 border-gray-200 hover:border-gray-400'}`}>
                      <span className="text-xs truncate px-1">{item.name}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {selectedItem && (
              <div className="p-4 border-t border-gray-100 bg-gray-50">
                <div className="flex justify-between items-start mb-2">
                  <h4 className="font-bold text-sm text-gray-900">{selectedItem.name}</h4>
                  <button onClick={() => setSelectedItem(null)} className="text-gray-400"><X size={16} /></button>
                </div>
                <p className="text-xs text-gray-600 mb-4">{selectedItem.description}</p>
                <div className="flex gap-2">
                  <button className="flex-1 py-2 bg-gray-900 text-white text-xs rounded-lg font-medium">使用</button>
                  <button onClick={() => handleDeleteItem(selectedItem.id)} className="flex-1 py-2 bg-red-50 text-red-600 text-xs rounded-lg font-medium border border-red-100 hover:bg-red-100">丢弃</button>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showSettings && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm z-[90] flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl">
              <h3 className="text-xl font-bold text-gray-900 mb-6 text-center">系统设置</h3>
              <div className="flex flex-col gap-3">
                <button onClick={() => { setDeathType('die'); setShowDeathModal(true); setShowSettings(false); }} className="w-full py-4 bg-red-50 text-red-600 rounded-2xl font-bold hover:bg-red-100 transition-colors border border-red-100">我不玩了！我要死了换皮！</button>
                <button onClick={() => { setDeathType('ghost'); setShowDeathModal(true); setShowSettings(false); }} className="w-full py-4 bg-purple-50 text-purple-700 rounded-2xl font-bold hover:bg-purple-100 transition-colors border border-purple-100">我要当鬼</button>
                <button onClick={() => setShowSettings(false)} className="w-full py-4 bg-gray-100 text-gray-700 rounded-2xl font-bold hover:bg-gray-200 transition-colors mt-2">关闭菜单</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showDeathModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-gray-900/80 backdrop-blur-md z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl">
              <h3 className="text-xl font-bold text-gray-900 mb-2">{deathType === 'die' ? '死亡宣告' : '化身为鬼'}</h3>
              <p className="text-sm text-gray-500 mb-6">请留下你最后的文字描述...</p>
              <textarea value={deathDesc} onChange={e => setDeathDesc(e.target.value)} placeholder="在一次探索中遭遇了不可名状的恐惧..." className="w-full h-32 p-4 bg-gray-50 border border-gray-200 rounded-2xl resize-none focus:outline-none mb-6 text-sm" />
              <div className="flex gap-3">
                <button onClick={() => setShowDeathModal(false)} className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200">取消</button>
                <button onClick={handleDeath} disabled={!deathDesc.trim()} className="flex-1 py-3 bg-gray-900 text-white rounded-xl font-bold hover:bg-gray-800 disabled:opacity-50">确认</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>


      {/* ==================== 强化的功能区：对戏与联络人 ==================== */}

      {/* 新增：在线玩家联络簿 (解决玩家B找不到玩家A的问题) */}
      <AnimatePresence>
        {showMessageContacts && (
          <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="absolute bottom-24 right-24 w-72 bg-white/95 backdrop-blur-md rounded-3xl shadow-2xl border border-gray-200 overflow-hidden z-50 flex flex-col max-h-[50vh]">
            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-sky-50">
              <h3 className="font-bold text-sky-900 flex items-center gap-2"><Users size={18}/> 在线玩家</h3>
              <button onClick={() => setShowMessageContacts(false)} className="text-sky-600 hover:text-sky-800"><X size={20} /></button>
            </div>
            <div className="p-2 overflow-y-auto flex-1 space-y-1">
              {allPlayers.filter(p => p.id !== user.id).length === 0 ? (
                <div className="text-center text-gray-400 py-8 text-sm">当前没有其他玩家在线</div>
              ) : (
                allPlayers.filter(p => p.id !== user.id).map(p => (
                  <div 
                    key={p.id} 
                    onClick={() => { setChatTarget(p); setShowMessageContacts(false); }}
                    className="flex items-center gap-3 p-3 rounded-xl hover:bg-sky-50 cursor-pointer transition-colors border border-transparent hover:border-sky-100"
                  >
                    <div className="w-10 h-10 rounded-full bg-gray-100 border border-gray-200 overflow-hidden flex items-center justify-center shrink-0">
                      {p.avatarUrl ? <img src={p.avatarUrl} className="w-full h-full object-cover"/> : <UserIcon size={16} className="text-gray-400"/>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-gray-900 text-sm truncate">{p.name}</div>
                      <div className="text-xs text-gray-500 truncate">位于 {mapLocations.find(l => l.id === p.currentLocation)?.name || '未知区域'}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 对戏聊天窗 */}
      <AnimatePresence>
        {chatTarget && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-[80] flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col h-[70vh]">
              <div className="bg-sky-600 p-4 flex justify-between items-center text-white shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-white/20 border-2 border-white/50 overflow-hidden flex items-center justify-center">
                    {chatTarget.avatarUrl ? <img src={chatTarget.avatarUrl} className="w-full h-full object-cover"/> : <UserIcon size={20}/>}
                  </div>
                  <div><h3 className="font-bold text-lg leading-tight">与 {chatTarget.name} 对戏</h3><p className="text-xs text-sky-100 opacity-80">{chatTarget.role || '神秘人'}</p></div>
                </div>
                <button onClick={() => setChatTarget(null)} className="text-white/80 hover:text-white hover:bg-white/20 rounded-full p-2 transition-colors"><X size={20} /></button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 bg-gray-50 space-y-4">
                {chatMessages.length === 0 && (<div className="text-center text-gray-400 text-sm py-10">你们之间还没有对戏记录，试着打个招呼吧。</div>)}
                {chatMessages.map((msg, idx) => {
                  const isMe = msg.senderId === user.id;
                  return (
                    <div key={idx} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                      <span className="text-[10px] text-gray-400 mb-1 px-1">{msg.senderName}</span>
                      <div className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed shadow-sm ${isMe ? 'bg-sky-600 text-white rounded-tr-none' : 'bg-white border border-gray-200 text-gray-800 rounded-tl-none'}`}>
                        {msg.content}
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              <div className="bg-white p-4 border-t border-gray-100 shrink-0">
                <div className="flex gap-2">
                  <input 
                    type="text" value={chatInput} onChange={(e) => setChatInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSendRoleplayMessage()}
                    placeholder="输入你想说的话/动作..." className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                  />
                  <button onClick={handleSendRoleplayMessage} disabled={!chatInput.trim()} className="bg-sky-600 text-white px-4 py-2 rounded-xl flex items-center justify-center disabled:opacity-50 hover:bg-sky-700 transition-colors">
                    <Send size={18} />
                  </button>
                </div>
                <div className="mt-3">
                  <button onClick={() => setChatTarget(null)} className="w-full py-2 bg-gray-100 text-gray-600 text-xs font-bold rounded-lg hover:bg-gray-200 transition-colors">什么都不做 (结束对戏)</button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- 右下角控制栏 --- */}
      <div className="absolute bottom-6 right-6 flex gap-3 z-30">
        {/* 新增：打开联络簿按钮 */}
        <button 
          onClick={() => setShowMessageContacts(!showMessageContacts)}
          className="relative w-14 h-14 bg-white rounded-full shadow-md border border-gray-200 flex items-center justify-center text-sky-600 hover:scale-105 transition-all"
          title="在线对戏列表"
        >
          <MessageSquareText size={24} />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-[10px] text-white flex items-center justify-center border-2 border-white font-bold shadow-sm animate-bounce">
              {unreadCount}
            </span>
          )}
        </button>

        <button onClick={() => setShowBackpack(true)} className="relative w-14 h-14 bg-white rounded-full shadow-md border border-gray-200 flex items-center justify-center text-gray-700 hover:scale-105 transition-all">
          <Backpack size={24} />
          {items.length > 0 && <span className="absolute top-0 right-0 w-4 h-4 bg-gray-900 rounded-full text-[10px] text-white flex items-center justify-center border-2 border-white">{items.length}</span>}
        </button>

        <button onClick={() => setShowSettings(true)} className="w-14 h-14 bg-gray-900 rounded-full shadow-md border border-gray-800 flex items-center justify-center text-white hover:scale-105 transition-all">
          <Settings size={24} />
        </button>
      </div>

    </div>
  );
}

function ProfileField({ label, value, isLong }: { label: string; value?: string; isLong?: boolean; }) {
  return (<div className={`bg-gray-50 rounded-xl p-3 border border-gray-100 ${isLong ? "h-full" : ""}`}><div className="text-xs text-gray-500 mb-1">{label}</div><div className="text-sm font-medium text-gray-900 whitespace-pre-wrap">{value || "未知"}</div></div>);
}

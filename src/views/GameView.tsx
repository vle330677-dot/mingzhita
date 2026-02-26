import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Settings, Backpack, X, Upload, MapPin, Bell, User as UserIcon, ScrollText, Hammer, HandCoins, MessageSquareText, Send } from 'lucide-react';
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
  const [showSettings, setShowSettings] = useState(false);
  const [showBackpack, setShowBackpack] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [items, setItems] = useState<Item[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [showLeftPanel, setShowLeftPanel] = useState(true);
  const [userLocationId, setUserLocationId] = useState<string | null>((user as any).currentLocation || null);
  const [allPlayers, setAllPlayers] = useState<any[]>([]); 
  const [selectedLocation, setSelectedLocation] = useState<MapLocation | null>(null);
  const [activeNPC, setActiveNPC] = useState<NPC | null>(null);

  const [craftsmanTalkCount, setCraftsmanTalkCount] = useState(0);
  const [craftsmanLearnCount, setCraftsmanLearnCount] = useState(0);
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [guildView, setGuildView] = useState<'menu' | 'publish' | 'board'>('menu');
  const [newCommission, setNewCommission] = useState({ title: '', content: '', difficulty: 'D' });

  // === 新增：对戏系统专属状态 ===
  const [chatTarget, setChatTarget] = useState<any | null>(null); // 正在与之对戏的玩家
  const [chatMessages, setChatMessages] = useState<any[]>([]); // 对戏记录
  const [chatInput, setChatInput] = useState(''); // 输入框内容
  const [unreadCount, setUnreadCount] = useState(0); // 未读消息数
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const showToast = (msg: string) => { setToastMsg(msg); setTimeout(() => setToastMsg(null), 3000); };
  
  // 初始化与轮询
  useEffect(() => {
    fetchItems(); fetchSkills(); fetchMapPlayers(); fetchCommissions(); fetchUnreadCount();
    
    // 为了保证对戏的实时性，轮询间隔缩短到 4 秒
    const interval = setInterval(() => { 
      fetchMapPlayers(); 
      fetchCommissions(); 
      fetchUnreadCount();
    }, 4000);
    return () => clearInterval(interval);
  }, [user.id]);

  // 如果打开了对戏窗口，单独高频轮询聊天记录
  useEffect(() => {
    if (!chatTarget) return;
    fetchChatMessages();
    const chatInterval = setInterval(fetchChatMessages, 3000);
    return () => clearInterval(chatInterval);
  }, [chatTarget]);

  // 自动滚动到最新消息
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

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

  // === 对戏 API 调用 ===
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
      fetchUnreadCount(); // 读取后刷新未读红点
    }
  };

  const handleSendRoleplayMessage = async () => {
    if (!chatInput.trim() || !chatTarget) return;
    const content = chatInput.trim();
    setChatInput(''); // 乐观清空
    
    const res = await fetch('/api/roleplay', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        senderId: user.id,
        senderName: user.name,
        receiverId: chatTarget.id,
        receiverName: chatTarget.name,
        content: content
      })
    });
    if (res.ok) fetchChatMessages();
  };

  // 头像上传
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

  // 地点行动
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

  const getEntitiesAtLocation = (locId: string) => {
    const entities: any[] = fixedNPCs.filter(npc => npc.locationId === locId);
    const playersHere = allPlayers.filter(p => p.currentLocation === locId);
    playersHere.forEach(p => { entities.push({ id: p.id, isUser: true, name: p.name, role: p.role, avatarUrl: p.avatarUrl }); });
    return entities;
  };

  // 点击人物实体的处理
  const handleEntityClick = (ent: any) => {
    setSelectedLocation(null); // 关闭地点面板
    if (!ent.isUser) {
      setActiveNPC(ent);
    } else if (ent.id !== user.id) {
      // 如果点击的是别的真实玩家，打开对戏预备面板
      setChatTarget(ent);
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

      {/* 左侧资料卡面板 (保持不变，省略中间雷同部分以节约空间) */}
      <AnimatePresence>
        {showLeftPanel ? (
          <motion.div initial={{ opacity: 0, x: -50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -50 }} className="absolute top-6 left-6 w-64 bg-white/95 backdrop-blur-md rounded-2xl shadow-lg border border-gray-200/50 p-4 z-30">
            {/* ... 你的左上角资料卡内容 ... */}
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
            {/* 技能栏等 */}
            <div className="border-t border-gray-100 pt-3">
              <div className="text-xs text-gray-500 mb-2 font-bold">已掌握技能 ({skills.length})</div>
              <div className="space-y-2 max-h-24 overflow-y-auto pr-1">
                {skills.length === 0 && <div className="text-xs text-gray-400 italic">暂无技能。</div>}
                {skills.map(s => (
                  <div key={s.id} className="flex justify-between items-center bg-gray-50 rounded px-2 py-1 border border-gray-100">
                    <span className="text-xs font-medium text-gray-800">{s.name} <span className="text-amber-600 text-[10px]">Lv.{s.level}</span></span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        ) : (
          <button onClick={() => setShowLeftPanel(true)} className="absolute top-6 left-6 z-30 bg-white/90 backdrop-blur shadow-md rounded-full px-4 py-2 text-sm font-bold text-gray-700 hover:scale-105 transition-transform">
            显示角色面板
          </button>
        )}
      </AnimatePresence>


      {/* --- 对戏 (Roleplay) 交互弹窗 --- */}
      <AnimatePresence>
        {chatTarget && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-[80] flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col h-[70vh]">
              
              {/* 头部信息 */}
              <div className="bg-sky-600 p-4 flex justify-between items-center text-white shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-white/20 border-2 border-white/50 overflow-hidden flex items-center justify-center">
                    {chatTarget.avatarUrl ? <img src={chatTarget.avatarUrl} className="w-full h-full object-cover"/> : <UserIcon size={20}/>}
                  </div>
                  <div>
                    <h3 className="font-bold text-lg leading-tight">与 {chatTarget.name} 对戏</h3>
                    <p className="text-xs text-sky-100 opacity-80">{chatTarget.role || '神秘人'}</p>
                  </div>
                </div>
                <button onClick={() => setChatTarget(null)} className="text-white/80 hover:text-white hover:bg-white/20 rounded-full p-2 transition-colors">
                  <X size={20} />
                </button>
              </div>

              {/* 对戏聊天内容区 */}
              <div className="flex-1 overflow-y-auto p-4 bg-gray-50 space-y-4">
                {chatMessages.length === 0 && (
                  <div className="text-center text-gray-400 text-sm py-10">
                    你们之间还没有对戏记录，试着打个招呼吧。
                  </div>
                )}
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

              {/* 输入交互区 */}
              <div className="bg-white p-4 border-t border-gray-100 shrink-0">
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSendRoleplayMessage()}
                    placeholder="输入你想说的话/动作..."
                    className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                  />
                  <button 
                    onClick={handleSendRoleplayMessage}
                    disabled={!chatInput.trim()}
                    className="bg-sky-600 text-white px-4 py-2 rounded-xl flex items-center justify-center disabled:opacity-50 hover:bg-sky-700 transition-colors"
                  >
                    <Send size={18} />
                  </button>
                </div>
                <div className="mt-3">
                  <button 
                    onClick={() => setChatTarget(null)}
                    className="w-full py-2 bg-gray-100 text-gray-600 text-xs font-bold rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    什么都不做 (结束对戏)
                  </button>
                </div>
              </div>

            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- 右下角控制栏 (新增消息按钮) --- */}
      <div className="absolute bottom-6 right-6 flex gap-3 z-30">
        
        {/* 未读消息/对戏入口按钮 */}
        <button 
          onClick={() => showToast('请在地图上点击亮起的玩家头像来查看他发来的对戏消息！')}
          className="relative w-14 h-14 bg-white rounded-full shadow-md border border-gray-200 flex items-center justify-center text-sky-600 hover:scale-105 transition-all"
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

// ... 底部保留 ProfileField 等组件

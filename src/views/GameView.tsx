import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Settings,
  Backpack,
  X,
  MapPin,
  Bell,
  User as UserIcon,
  ScrollText,
  Hammer,
  HandCoins,
  MessageSquareText,
  ArrowLeft,
  ClipboardList,
  ShoppingCart,
  Gavel,
  Send,
  LogOut,
  RefreshCw
} from 'lucide-react';
import { ViewState } from '../App';
import { User } from '../types';

interface Skill {
  id: number;
  userId: number;
  name: string;
  level: number;
}
interface Props {
  user: User;
  setUser: React.Dispatch<React.SetStateAction<User | null>>;
  onNavigate: (view: ViewState) => void;
}

interface MapLocation {
  id: string;
  name: string;
  x: number;
  y: number;
  description: string;
  lootTable: string[];
  type?: 'world' | 'tower';
  minMental?: string;
}

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

interface MarketItem {
  id: number;
  name: string;
  price: number;
  rarity?: string;
}
interface AuctionItem {
  id: string;
  name: string;
  sellerId: number;
  currentPrice: number;
  minPrice: number;
  highestBidderId?: number;
  endsAt: string;
}
interface InventoryItem {
  id: number;
  name: string;
  qty: number;
}
interface RPMessage {
  id: number;
  senderId: number;
  senderName: string;
  receiverId: number;
  receiverName: string;
  content: string;
  createdAt: string;
}

export function GameView({ user, setUser, onNavigate }: Props) {
  const [inTower, setInTower] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<MapLocation | null>(null);
  const [allPlayers, setAllPlayers] = useState<any[]>([]);
  const [spiritStatus, setSpiritStatus] = useState<any>({ name: '', intimacy: 0, level: 1, hp: 100 });
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const [showLeftPanel, setShowLeftPanel] = useState(true);
  const [activeNPC, setActiveNPC] = useState<any>(null);
  const [showTowerActionPanel, setShowTowerActionPanel] = useState(false);
  const [showSpiritInteraction, setShowSpiritInteraction] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);

  const [chatTarget, setChatTarget] = useState<any | null>(null);
  const [chatMessages, setChatMessages] = useState<RPMessage[]>([]);
  const [chatInput, setChatInput] = useState('');

  const [unreadCount, setUnreadCount] = useState(0);
  const [showBackpack, setShowBackpack] = useState(false);
  const [showMessageContacts, setShowMessageContacts] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showAwakening, setShowAwakening] = useState(false);

  const [joesPatience, setJoesPatience] = useState(0);
  const [lastJoeTeachDate, setLastJoeTeachDate] = useState<string>(() => localStorage.getItem(`lastJoeTeachDate_${user.id}`) || '');
  const [skills, setSkills] = useState<Skill[]>([]);
  const [commissions, setCommissions] = useState<any[]>([]);
  const [showCommissionBoard, setShowCommissionBoard] = useState(false);
  const [guildView, setGuildView] = useState<'menu' | 'board' | 'publish'>('menu');
  const [newCommission, setNewCommission] = useState({
    title: '',
    content: '',
    difficulty: 'C',
    reward: 100,
    isAnonymous: false
  });

  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [marketGoods, setMarketGoods] = useState<MarketItem[]>([]);
  const [auctionItems, setAuctionItems] = useState<AuctionItem[]>([]);
  const [merchantView, setMerchantView] = useState<'menu' | 'shop' | 'auction' | 'consign'>('menu');
  const [consignForm, setConsignForm] = useState<{ itemId: string; minPrice: number }>({ itemId: '', minPrice: 100 });

  const [panelPos, setPanelPos] = useState<{ x: number; y: number }>(() => {
    try {
      return JSON.parse(localStorage.getItem(`panelPos_${user.id}`) || '') || { x: 24, y: 24 };
    } catch {
      return { x: 24, y: 24 };
    }
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const spiritImgInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 2600);
  };

  useEffect(() => {
    localStorage.setItem(`panelPos_${user.id}`, JSON.stringify(panelPos));
  }, [panelPos, user.id]);

  const syncAllData = async () => {
    try {
      const res = await fetch('/api/admin/users');
      const data = await res.json();
      if (data.success) {
        const users = data.users || [];
        setAllPlayers(users.filter((p: any) => p.currentLocation));
        const me = users.find((p: any) => p.id === user.id);
        if (me) setUser((prev) => ({ ...(prev || user), ...me }));
      }

      const spiritRes = await fetch(`/api/users/${user.id}/spirit-status`);
      const sData = await spiritRes.json();
      if (sData.success) setSpiritStatus(sData.spiritStatus);

      const unreadRes = await fetch(`/api/roleplay/unread/${user.id}`);
      const uData = await unreadRes.json();
      if (uData.success) setUnreadCount(uData.count || 0);

      const skillRes = await fetch(`/api/users/${user.id}/skills`);
      const skillData = await skillRes.json();
      if (skillData.success) setSkills(skillData.skills || []);

      const commRes = await fetch('/api/commissions');
      const commData = await commRes.json();
      if (commData.success) setCommissions(commData.commissions || []);

      const invRes = await fetch(`/api/users/${user.id}/inventory`);
      const invData = await invRes.json();
      if (invData.success) setInventory(invData.items || []);

      const marketRes = await fetch('/api/market/goods');
      const marketData = await marketRes.json();
      if (marketData.success) setMarketGoods(marketData.goods || []);

      const auctionRes = await fetch('/api/auction/items');
      const auctionData = await auctionRes.json();
      if (auctionData.success) setAuctionItems(auctionData.items || []);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    syncAllData();
    const i = setInterval(syncAllData, 5000);
    return () => clearInterval(i);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id]);

  useEffect(() => {
    if (chatTarget) fetchChatMessages(chatTarget.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatTarget]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const fetchChatMessages = async (otherId: number) => {
    const res = await fetch(`/api/roleplay/conversation/${user.id}/${otherId}`);
    const data = await res.json();
    if (data.success) setChatMessages(data.messages || []);
  };

  const openChatWith = async (target: any) => {
    if (!target || target.id === user.id) return;
    setChatTarget(target);
    setShowMessageContacts(false);
    setChatInput('');
    await fetchChatMessages(target.id);
  };

  const sendChatMessage = async () => {
    if (!chatTarget || !chatInput.trim()) return;
    const content = chatInput.trim();

    const res = await fetch('/api/roleplay', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        senderId: user.id,
        senderName: user.name,
        receiverId: chatTarget.id,
        receiverName: chatTarget.name,
        content,
        locationId: user.currentLocation || (inTower ? 'tower_of_life' : 'unknown')
      })
    });
    const data = await res.json();

    if (data.success) {
      setChatInput('');
      await fetchChatMessages(chatTarget.id);
      await syncAllData();
    } else {
      showToast(data.message || '发送失败');
    }
  };

  const addItemToInventory = async (name: string, qty = 1) => {
    await fetch(`/api/users/${user.id}/inventory/add`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, qty, source: selectedLocation?.id })
    });
    await syncAllData();
  };

  const handleTalkToJoe = () => {
    const today = new Date().toISOString().slice(0, 10);
    if (lastJoeTeachDate === today) {
      showToast('老乔：今天我已经指点过你了，明天再来。');
      return;
    }
    if (joesPatience < 2) {
      setJoesPatience((prev) => prev + 1);
      showToast(`老乔：忙着呢！别烦我！(${joesPatience + 1}/3)`);
    } else {
      const skillNames = ['机械维修', '零件打磨', '重载组装', '引擎调试'];
      const randomSkill = skillNames[Math.floor(Math.random() * skillNames.length)];
      learnSkill(randomSkill);
    }
  };

  const learnSkill = async (name: string) => {
    await fetch(`/api/users/${user.id}/skills`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    });
    showToast(`老乔骂骂咧咧地教了你一招：${name}`);
    const today = new Date().toISOString().slice(0, 10);
    setLastJoeTeachDate(today);
    localStorage.setItem(`lastJoeTeachDate_${user.id}`, today);
    setJoesPatience(0);
    syncAllData();
  };

  const publishCommission = async () => {
    if (!newCommission.title || !newCommission.reward) return showToast('请填写标题和奖励');

    const res = await fetch('/api/commissions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: `COMM-${Date.now()}`,
        publisherId: user.id,
        publisherName: newCommission.isAnonymous ? '匿名发布者' : user.name,
        ...newCommission
      })
    });

    if (res.ok) {
      showToast('委托已在公会公示');
      setGuildView('menu');
      setNewCommission({ title: '', content: '', difficulty: 'C', reward: 100, isAnonymous: false });
      syncAllData();
    }
  };

  const acceptCommission = async (comm: any) => {
    const res = await fetch(`/api/commissions/${comm.id}/accept`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id, userName: user.name })
    });
    const data = await res.json();
    if (data.success) {
      showToast('委托已接取，请尽快完成');
      syncAllData();
    } else {
      showToast(data.message || '接取失败');
    }
  };

  const handleLocationAction = async (action: 'enter' | 'explore' | 'stay') => {
    if (!selectedLocation) return;

    if (action === 'enter' && selectedLocation.id === 'tower_of_life') {
      setInTower(true);
      setSelectedLocation(null);
      return;
    }

    if (inTower && action === 'enter') {
      const jobRooms: Record<string, string> = { 神使: 'tower_top', 侍奉者: 'tower_attendant', 神使后裔: 'tower_descendant' };
      if (selectedLocation.id === 'tower_evaluation' && user.role === '未分化') {
        setShowAwakening(true);
      } else if (jobRooms[user.job || ''] === selectedLocation.id) {
        setShowTowerActionPanel(true);
      } else if (selectedLocation.id === 'tower_training') {
        showToast('训练所：可进行精神体互动训练。');
        setShowSpiritInteraction(true);
      } else {
        showToast('权限不足。');
      }
      setSelectedLocation(null);
      return;
    }

    if (action === 'stay') {
      await fetch(`/api/users/${user.id}/location`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locationId: selectedLocation.id })
      });
      showToast(`已在【${selectedLocation.name}】驻扎`);
      syncAllData();
    }

    setSelectedLocation(null);
  };

  const activeMap = inTower ? towerLocations : worldLocations;
  const playersForContacts = allPlayers.filter((p: any) => p.id !== user.id && p.currentLocation);

  return (
    <div className="min-h-screen bg-slate-950 relative overflow-hidden font-sans select-none">
      {/* 地图层 */}
      <div
        className="absolute inset-0 bg-cover bg-center transition-all duration-1000"
        style={{ backgroundImage: `url('${inTower ? '/命之塔.jpg' : '/map_background.jpg'}')` }}
      >
        <div className="absolute inset-0 bg-black/20 pointer-events-none" />

        {inTower && (
          <button
            onClick={() => setInTower(false)}
            className="absolute top-8 left-8 z-50 bg-white/90 shadow-xl px-6 py-2 rounded-2xl font-black flex items-center gap-2"
          >
            <ArrowLeft size={20} /> 返回大地图
          </button>
        )}

        {activeMap.map((loc) => {
          const playersHere = allPlayers.filter((p) => p.currentLocation === loc.id);
          const npcsHere = fixedNPCs.filter((n) => n.locationId === loc.id);

          return (
            <div
              key={loc.id}
              className="absolute transform -translate-x-1/2 -translate-y-1/2 z-10 flex flex-col items-center"
              style={{ left: `${loc.x}%`, top: `${loc.y}%` }}
            >
              <div className="flex -space-x-2 mb-1">
                {npcsHere.map((npc) => (
                  <div
                    key={npc.id}
                    onClick={() => setActiveNPC(npc)}
                    className="w-8 h-8 rounded-full border-2 border-emerald-400 bg-white flex items-center justify-center cursor-pointer shadow-lg z-20 hover:scale-110 transition-all"
                  >
                    {npc.icon}
                  </div>
                ))}

                {playersHere.map((p) => (
                  <div
                    key={p.id}
                    onClick={() => openChatWith(p)}
                    className={`w-8 h-8 rounded-full border-2 shadow-xl cursor-pointer overflow-hidden transition-all
                      ${p.id === user.id ? 'border-amber-400 z-30 scale-125' : 'border-white bg-slate-200 hover:scale-110 z-10'}
                      ${p.status === 'ghost' ? 'opacity-60 ring-2 ring-violet-400' : ''}`}
                    title={p.id === user.id ? `${p.name}(我)` : `与 ${p.name} 对戏`}
                  >
                    {p.avatarUrl ? (
                      <img src={p.avatarUrl} className="w-full h-full object-cover" alt="avatar" />
                    ) : (
                      <span className="text-[10px] w-full h-full flex items-center justify-center font-black">
                        {p.name?.[0] || '?'}
                      </span>
                    )}
                  </div>
                ))}
              </div>

              <button onClick={() => setSelectedLocation(loc)} className="group flex flex-col items-center">
                <div
                  className={`p-2 rounded-full shadow-2xl border-2 transition-all group-hover:scale-125 ${
                    inTower ? 'bg-sky-500 border-sky-100' : 'bg-rose-600 border-white'
                  }`}
                >
                  <MapPin size={18} className="text-white" />
                </div>
                <span className="mt-1 px-3 py-1 bg-black/80 text-white text-[10px] font-black rounded-lg">{loc.name}</span>
              </button>
            </div>
          );
        })}
      </div>

      {/* 可拖拽角色面板 */}
      <AnimatePresence>
        {showLeftPanel ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            drag
            dragMomentum={false}
            dragElastic={0.1}
            onDragEnd={(_, info) => setPanelPos({ x: info.point.x, y: info.point.y })}
            className="absolute w-64 bg-white/95 backdrop-blur-xl rounded-[32px] shadow-2xl p-6 z-[60] border border-white/50"
            style={{ left: panelPos.x, top: panelPos.y }}
          >
            <div className="flex justify-between items-start mb-4">
              <div
                className="w-14 h-14 rounded-2xl border-2 border-sky-500 overflow-hidden bg-slate-100 cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
              >
                {user.avatarUrl ? (
                  <img src={user.avatarUrl} className="w-full h-full object-cover" alt="avatar" />
                ) : (
                  <UserIcon className="m-auto text-gray-300" size={24} />
                )}
                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  accept="image/*"
                  onChange={async (e) => {
                    const r = new FileReader();
                    r.onload = async (ev) => {
                      await fetch(`/api/users/${user.id}/avatar`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ avatarUrl: ev.target?.result })
                      });
                      syncAllData();
                    };
                    if (e.target.files?.[0]) r.readAsDataURL(e.target.files[0]);
                  }}
                />
              </div>
              <button onClick={() => setShowLeftPanel(false)} className="text-[10px] font-black text-slate-400 hover:text-slate-900">
                隐藏
              </button>
            </div>

            <h2
              className="font-black text-xl text-slate-900 mb-1 cursor-pointer hover:text-sky-600 transition-colors"
              onClick={() => setShowProfileModal(true)}
            >
              {user.name}
            </h2>
            <p className="text-[10px] font-black text-sky-700 bg-sky-50 inline-block px-2 py-0.5 rounded-full mb-6">
              {user.job || user.role || '未知'}
            </p>

            <div className="space-y-3 mb-6">
              <StatusRow label="生命值" cur={user.hp || 100} color="bg-rose-500" />
              <StatusRow label="精神力" cur={user.mentalProgress || 0} color="bg-indigo-600" />
              <StatusRow label="灵契" cur={spiritStatus.intimacy || 0} color="bg-pink-500" />
            </div>

            <div className="border-t border-gray-100 pt-3 mb-4">
              <p className="text-[9px] font-black text-gray-400 mb-2">技能</p>
              <div className="flex flex-wrap gap-1">
                {skills.length === 0 && <span className="text-[10px] text-gray-300 italic">尚未习得技能</span>}
                {skills.map((s) => (
                  <span
                    key={s.id}
                    className="px-2 py-0.5 bg-sky-50 text-sky-600 rounded-md text-[10px] font-bold border border-sky-100"
                  >
                    {s.name} Lv.{s.level}
                  </span>
                ))}
              </div>
            </div>

            <div className="bg-slate-900 text-white p-3 rounded-2xl flex justify-between items-center">
              <HandCoins size={16} className="text-amber-400" />
              <span className="font-black text-sm">{user.gold || 0} G</span>
            </div>
          </motion.div>
        ) : (
          <motion.button
            drag
            dragMomentum={false}
            onClick={() => setShowLeftPanel(true)}
            className="absolute top-6 left-6 z-[60] bg-white shadow-2xl px-5 py-3 rounded-full font-black text-xs flex items-center gap-2 cursor-move border border-slate-200"
          >
            <UserIcon size={14} className="text-sky-500" /> 资料
          </motion.button>
        )}
      </AnimatePresence>

      {/* NPC弹窗 */}
      <AnimatePresence>
        {activeNPC?.id === 'npc_craftsman' && (
          <NPCModal npc={activeNPC} onClose={() => setActiveNPC(null)}>
            <div className="grid grid-cols-1 gap-3">
              <button onClick={handleTalkToJoe} className="w-full py-4 bg-sky-600 text-white font-black rounded-2xl shadow-lg">
                搭话 ({joesPatience}/3)
              </button>
              <button onClick={() => setActiveNPC(null)} className="w-full py-4 bg-slate-100 text-slate-600 font-black rounded-2xl">
                离开
              </button>
            </div>
          </NPCModal>
        )}

        {activeNPC?.id === 'npc_guild_staff' && (
          <NPCModal
            npc={activeNPC}
            onClose={() => {
              setActiveNPC(null);
              setGuildView('menu');
            }}
          >
            {guildView === 'menu' && (
              <div className="grid grid-cols-1 gap-3">
                <button
                  onClick={() => setGuildView('board')}
                  className="py-4 bg-sky-50 text-sky-600 font-black rounded-2xl border border-sky-100"
                >
                  查看委托板
                </button>
                <button
                  onClick={() => setGuildView('publish')}
                  className="py-4 bg-amber-50 text-amber-600 font-black rounded-2xl border border-amber-100"
                >
                  发布新委托
                </button>
                <button onClick={() => setActiveNPC(null)} className="py-4 bg-slate-100 text-slate-500 font-black rounded-2xl">
                  以后再说
                </button>
              </div>
            )}

            {guildView === 'board' && (
              <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                {commissions.length === 0 && <p className="text-center text-gray-400 py-4">目前没有公示委托</p>}
                {commissions
                  .filter((c) => c.status === 'open')
                  .map((c) => (
                    <div key={c.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                      <div className="flex justify-between items-start mb-1">
                        <span className="font-black text-slate-900">{c.title}</span>
                        <span className="text-[10px] font-bold text-amber-600">{c.reward} G</span>
                      </div>
                      <p className="text-[11px] text-slate-500 mb-3">{c.content}</p>
                      <button onClick={() => acceptCommission(c)} className="w-full py-2 bg-sky-600 text-white text-[11px] font-black rounded-xl">
                        接受委托
                      </button>
                    </div>
                  ))}
                <button onClick={() => setGuildView('menu')} className="w-full py-2 text-xs font-bold text-sky-600">
                  返回
                </button>
              </div>
            )}

            {guildView === 'publish' && (
              <div className="space-y-3">
                <input
                  placeholder="任务标题"
                  className="w-full p-3 bg-slate-50 border rounded-xl outline-none"
                  value={newCommission.title}
                  onChange={(e) => setNewCommission({ ...newCommission, title: e.target.value })}
                />
                <textarea
                  placeholder="任务详情内容..."
                  className="w-full p-3 bg-slate-50 border rounded-xl h-24 outline-none resize-none"
                  value={newCommission.content}
                  onChange={(e) => setNewCommission({ ...newCommission, content: e.target.value })}
                />
                <div className="flex gap-2">
                  <input
                    placeholder="报酬"
                    type="number"
                    className="flex-1 p-3 bg-slate-50 border rounded-xl outline-none"
                    value={newCommission.reward}
                    onChange={(e) => setNewCommission({ ...newCommission, reward: parseInt(e.target.value || '0', 10) })}
                  />
                  <button
                    onClick={() => setNewCommission({ ...newCommission, isAnonymous: !newCommission.isAnonymous })}
                    className={`px-4 rounded-xl font-black text-xs ${
                      newCommission.isAnonymous ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {newCommission.isAnonymous ? '匿名发布' : '公开身份'}
                  </button>
                </div>
                <button onClick={publishCommission} className="w-full py-4 bg-amber-500 text-white font-black rounded-2xl">
                  发布并扣除报酬
                </button>
              </div>
            )}
          </NPCModal>
        )}

        {activeNPC?.id === 'npc_merchant' && (
          <NPCModal
            npc={activeNPC}
            onClose={() => {
              setActiveNPC(null);
              setMerchantView('menu');
            }}
          >
            {merchantView === 'menu' && (
              <div className="grid grid-cols-1 gap-3">
                <button
                  onClick={() => setMerchantView('shop')}
                  className="py-4 bg-emerald-50 text-emerald-600 font-black rounded-2xl border border-emerald-100 flex items-center justify-center gap-2"
                >
                  <ShoppingCart size={16} /> 购买商品
                </button>
                <button
                  onClick={() => setMerchantView('auction')}
                  className="py-4 bg-violet-50 text-violet-600 font-black rounded-2xl border border-violet-100 flex items-center justify-center gap-2"
                >
                  <Gavel size={16} /> 拍卖行（竞价）
                </button>
                <button onClick={() => setMerchantView('consign')} className="py-4 bg-amber-50 text-amber-600 font-black rounded-2xl border border-amber-100">
                  委托拍卖（成交收取10%）
                </button>
                <button onClick={() => setActiveNPC(null)} className="py-4 bg-slate-100 text-slate-600 font-black rounded-2xl">
                  离开
                </button>
              </div>
            )}

            {merchantView === 'shop' && (
              <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                {marketGoods.length === 0 && <p className="text-center text-gray-400 py-4">暂无上架商品</p>}
                {marketGoods.map((g) => (
                  <div key={g.id} className="p-3 bg-emerald-50 rounded-2xl border border-emerald-100">
                    <div className="flex justify-between items-center">
                      <div className="font-black text-emerald-900">{g.name}</div>
                      <div className="text-amber-600 font-bold">{g.price} G</div>
                    </div>
                    <button
                      onClick={async () => {
                        const res = await fetch('/api/market/buy', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ userId: user.id, itemId: g.id })
                        });
                        const d = await res.json();
                        d.success ? showToast('购买成功，已放入背包') : showToast(d.message || '购买失败');
                        syncAllData();
                      }}
                      className="w-full mt-2 py-2 bg-emerald-600 text-white text-[12px] font-black rounded-xl"
                    >
                      购买
                    </button>
                  </div>
                ))}
                <button onClick={() => setMerchantView('menu')} className="w-full py-2 text-xs font-bold text-emerald-600">
                  返回
                </button>
              </div>
            )}

            {merchantView === 'auction' && (
              <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                {auctionItems.length === 0 && <p className="text-center text-gray-400 py-4">暂无拍卖品</p>}
                {auctionItems.map((a) => (
                  <div key={a.id} className="p-3 bg-violet-50 rounded-2xl border border-violet-100">
                    <div className="flex justify-between items-center mb-1">
                      <div className="font-black text-violet-900">{a.name}</div>
                      <div className="text-violet-700 text-[12px]">当前价 {a.currentPrice} G</div>
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        placeholder={`>= ${a.currentPrice + 1}`}
                        className="flex-1 p-2 bg-white border rounded-lg text-sm"
                        onChange={(e) => ((a as any).__bid = parseInt(e.target.value || '0', 10))}
                      />
                      <button
                        onClick={async () => {
                          const price = (a as any).__bid || 0;
                          const res = await fetch('/api/auction/bid', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ userId: user.id, itemId: a.id, price })
                          });
                          const d = await res.json();
                          d.success ? showToast('出价成功') : showToast(d.message || '出价失败');
                          syncAllData();
                        }}
                        className="px-3 rounded-lg bg-violet-600 text-white text-xs font-black"
                      >
                        出价
                      </button>
                    </div>
                    <div className="text-[10px] text-violet-600 mt-1">成交后商人收取10%佣金</div>
                  </div>
                ))}
                <button onClick={() => setMerchantView('menu')} className="w-full py-2 text-xs font-bold text-violet-600">
                  返回
                </button>
              </div>
            )}

            {merchantView === 'consign' && (
              <div className="space-y-3">
                <select
                  className="w-full p-3 bg-slate-50 border rounded-xl"
                  value={consignForm.itemId}
                  onChange={(e) => setConsignForm({ ...consignForm, itemId: e.target.value })}
                >
                  <option value="">选择要拍卖的物品</option>
                  {inventory.map((it) => (
                    <option key={it.id} value={String(it.id)}>
                      {it.name} x{it.qty}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  className="w-full p-3 bg-slate-50 border rounded-xl"
                  placeholder="起拍价"
                  value={consignForm.minPrice}
                  onChange={(e) => setConsignForm({ ...consignForm, minPrice: parseInt(e.target.value || '0', 10) })}
                />
                <button
                  onClick={async () => {
                    if (!consignForm.itemId) return showToast('请选择物品');
                    const res = await fetch('/api/auction/consign', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ userId: user.id, itemId: Number(consignForm.itemId), minPrice: consignForm.minPrice })
                    });
                    const d = await res.json();
                    d.success ? showToast('已委托拍卖') : showToast(d.message || '委托失败');
                    syncAllData();
                    setMerchantView('menu');
                  }}
                  className="w-full py-3 bg-amber-500 text-white font-black rounded-2xl"
                >
                  提交委托
                </button>
                <div className="text-[10px] text-amber-600 text-center">成交后收取10%佣金</div>
                <button onClick={() => setMerchantView('menu')} className="w-full py-2 text-xs font-bold text-amber-600">
                  返回
                </button>
              </div>
            )}
          </NPCModal>
        )}
      </AnimatePresence>

      {/* 地点操作弹窗 */}
      <AnimatePresence>
        {selectedLocation && (
          <NPCModal
            npc={{ icon: <MapPin size={14} />, name: selectedLocation.name, role: '地点操作', desc: selectedLocation.description }}
            onClose={() => setSelectedLocation(null)}
          >
            <div className="text-[11px] text-slate-500 mb-3">坐标：X {selectedLocation.x} / Y {selectedLocation.y}</div>
            <div className="grid grid-cols-1 gap-3">
              {!inTower && selectedLocation.id === 'tower_of_life' && (
                <button onClick={() => handleLocationAction('enter')} className="py-3 bg-indigo-600 text-white font-black rounded-2xl">
                  进入命之塔
                </button>
              )}
              {inTower && selectedLocation.type === 'tower' && (
                <button onClick={() => handleLocationAction('enter')} className="py-3 bg-indigo-600 text-white font-black rounded-2xl">
                  进入
                </button>
              )}
              <button
                onClick={async () => {
                  const drop = Math.random() < 0.5;
                  if (drop && selectedLocation.lootTable.length > 0) {
                    const item = selectedLocation.lootTable[Math.floor(Math.random() * selectedLocation.lootTable.length)];
                    await addItemToInventory(item, 1);
                    showToast(`在【${selectedLocation.name}】探索时获得：${item}`);
                  } else {
                    showToast(`在【${selectedLocation.name}】探索无收获`);
                  }
                  setSelectedLocation(null);
                }}
                className="py-3 bg-emerald-600 text-white font-black rounded-2xl"
              >
                探索（50% 掉落）
              </button>
              <button onClick={() => handleLocationAction('stay')} className="py-3 bg-amber-600 text-white font-black rounded-2xl">
                驻扎
              </button>
              <button onClick={() => setSelectedLocation(null)} className="py-3 bg-slate-100 text-slate-600 font-black rounded-2xl">
                取消
              </button>
            </div>
          </NPCModal>
        )}
      </AnimatePresence>

      {/* 任务面板 */}
      <AnimatePresence>
        {showCommissionBoard && (
          <motion.div
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 50, opacity: 0 }}
            className="fixed bottom-24 right-8 w-80 bg-white/95 backdrop-blur-xl rounded-[32px] shadow-2xl border p-6 z-[80]"
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-black text-lg flex items-center gap-2">
                <ClipboardList size={20} className="text-sky-600" />
                任务行囊
              </h3>
              <X size={18} onClick={() => setShowCommissionBoard(false)} className="cursor-pointer" />
            </div>

            <div className="space-y-3 max-h-80 overflow-y-auto">
              <div className="text-[10px] font-black text-gray-400 border-b pb-2">我接取的委托</div>
              {commissions
                .filter((c) => c.acceptedById === user.id)
                .map((c) => (
                  <div key={c.id} className="p-3 bg-sky-50 rounded-2xl border border-sky-100">
                    <p className="font-black text-xs text-sky-900">{c.title}</p>
                    <p className="text-[10px] text-sky-600 mt-1">发布者: {c.publisherName}</p>
                    <button onClick={() => showToast('已提交至发布者审核...')} className="w-full mt-2 py-1.5 bg-sky-600 text-white text-[10px] font-black rounded-lg">
                      提交任务
                    </button>
                  </div>
                ))}

              <div className="text-[10px] font-black text-gray-400 border-b pb-2 mt-4">我发布的委托</div>
              {commissions
                .filter((c) => c.publisherId === user.id)
                .map((c) => (
                  <div key={c.id} className="p-3 bg-amber-50 rounded-2xl border border-amber-100">
                    <p className="font-black text-xs text-amber-900">{c.title}</p>
                    <p className="text-[10px] text-amber-600 mt-1">状态: {c.status === 'accepted' ? '被接取' : '公示中'}</p>
                    {c.status === 'accepted' && (
                      <button onClick={() => showToast('审核通过，报酬已发放')} className="w-full mt-2 py-1.5 bg-amber-600 text-white text-[10px] font-black rounded-lg">
                        确认完成
                      </button>
                    )}
                  </div>
                ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 联系人列表 */}
      <AnimatePresence>
        {showMessageContacts && (
          <motion.div
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 30, opacity: 0 }}
            className="fixed bottom-24 right-8 w-80 bg-white/95 backdrop-blur-xl rounded-[32px] shadow-2xl border p-6 z-[90]"
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-black text-lg flex items-center gap-2">
                <MessageSquareText size={20} className="text-sky-600" />
                对戏联系人
              </h3>
              <X size={18} onClick={() => setShowMessageContacts(false)} className="cursor-pointer" />
            </div>

            <div className="space-y-2 max-h-72 overflow-y-auto">
              {playersForContacts.length === 0 && <div className="text-center text-gray-400 py-6">暂无可联系玩家</div>}
              {playersForContacts.map((p) => (
                <button
                  key={p.id}
                  onClick={() => openChatWith(p)}
                  className="w-full p-3 bg-slate-50 rounded-2xl border border-slate-100 flex items-center gap-3 hover:bg-white"
                >
                  <div className="w-9 h-9 rounded-full overflow-hidden bg-slate-200 border">
                    {p.avatarUrl ? (
                      <img src={p.avatarUrl} alt={p.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xs font-black text-slate-500">{p.name?.[0] || '?'}</div>
                    )}
                  </div>
                  <div className="text-left">
                    <div className="font-bold text-sm">{p.name}</div>
                    <div className="text-[10px] text-slate-500">{p.currentLocation || '未知地点'}</div>
                  </div>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 背包弹窗 */}
      <AnimatePresence>
        {showBackpack && (
          <motion.div
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 30, opacity: 0 }}
            className="fixed bottom-24 right-8 w-80 bg-white/95 backdrop-blur-xl rounded-[32px] shadow-2xl border p-6 z-[80]"
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-black text-lg flex items-center gap-2">
                <Backpack size={20} className="text-slate-700" />
                背包
              </h3>
              <X size={18} onClick={() => setShowBackpack(false)} className="cursor-pointer" />
            </div>
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {inventory.length === 0 && <div className="text-center text-gray-400 py-6">空空如也</div>}
              {inventory.map((it) => (
                <div key={it.id} className="p-3 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between">
                  <div className="font-bold text-slate-800">{it.name}</div>
                  <div className="text-xs text-slate-500">x{it.qty}</div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 对戏窗口 */}
      <AnimatePresence>
        {chatTarget && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            className="fixed inset-0 z-[120] bg-black/40 flex items-center justify-center p-4"
          >
            <div className="w-full max-w-2xl bg-white rounded-[28px] shadow-2xl border border-slate-200 p-4">
              <div className="flex justify-between items-center mb-3">
                <div className="font-black text-lg">与 {chatTarget.name} 的对戏</div>
                <button
                  onClick={() => {
                    setChatTarget(null);
                    setChatMessages([]);
                    setChatInput('');
                    syncAllData();
                  }}
                  className="px-3 py-1.5 bg-slate-100 rounded-lg text-sm font-bold"
                >
                  关闭
                </button>
              </div>

              <div className="h-80 overflow-y-auto bg-slate-50 border rounded-xl p-3 space-y-2">
                {chatMessages.length === 0 ? (
                  <div className="text-sm text-slate-500">暂无对话，开始第一句吧。</div>
                ) : (
                  chatMessages.map((m) => {
                    const mine = m.senderId === user.id;
                    return (
                      <div key={m.id} className={mine ? 'text-right' : 'text-left'}>
                        <div className="text-[11px] text-slate-500 mb-1">
                          {m.senderName} · {new Date(m.createdAt).toLocaleString()}
                        </div>
                        <div
                          className={`inline-block px-3 py-2 rounded-xl text-sm border ${
                            mine ? 'bg-sky-600 text-white border-sky-600' : 'bg-white text-slate-800 border-slate-200'
                          }`}
                        >
                          {m.content}
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              <div className="mt-3 flex gap-2">
                <input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && sendChatMessage()}
                  placeholder="输入对戏内容..."
                  className="flex-1 border rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-sky-200"
                />
                <button
                  onClick={sendChatMessage}
                  disabled={!chatInput.trim()}
                  className="px-4 py-2 rounded-xl bg-sky-600 text-white font-black disabled:opacity-50 flex items-center gap-1"
                >
                  <Send size={15} /> 发送
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 塔内职位面板 */}
      <AnimatePresence>
        {showTowerActionPanel && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 bg-black/40 z-[110] flex items-center justify-center p-4">
            <div className="bg-white rounded-[36px] p-8 w-full max-w-sm shadow-2xl">
              <h3 className="font-black text-xl mb-5">房间管理 · {user.job || '无职位'}</h3>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={async () => {
                    const r = await fetch('/api/tower/checkin', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ userId: user.id })
                    });
                    const d = await r.json();
                    d.success ? showToast(`签到成功 +${d.reward}G`) : showToast(d.message || '签到失败');
                    syncAllData();
                  }}
                  className="p-4 rounded-2xl bg-emerald-50 text-emerald-700 font-black"
                >
                  签到领薪
                </button>

                <button
                  onClick={async () => {
                    const r = await fetch('/api/tower/work', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ userId: user.id })
                    });
                    const d = await r.json();
                    d.success ? showToast(`打工成功 +${d.reward}G`) : showToast(d.message || '打工失败');
                    syncAllData();
                  }}
                  className="p-4 rounded-2xl bg-sky-50 text-sky-700 font-black"
                >
                  开始打工
                </button>

                <button
                  onClick={() => {
                    setShowSpiritInteraction(true);
                    setShowTowerActionPanel(false);
                  }}
                  className="p-4 rounded-2xl bg-pink-50 text-pink-700 font-black"
                >
                  精神体互动
                </button>

                <button
                  onClick={async () => {
                    const r = await fetch('/api/tower/quit', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ userId: user.id })
                    });
                    const d = await r.json();
                    d.success ? showToast(`离职成功，扣除 ${d.penalty}G`) : showToast(d.message || '离职失败');
                    syncAllData();
                  }}
                  className="p-4 rounded-2xl bg-rose-50 text-rose-700 font-black"
                >
                  申请离职
                </button>
              </div>

              <button onClick={() => setShowTowerActionPanel(false)} className="w-full mt-4 py-3 bg-slate-100 rounded-2xl font-black">
                关闭
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 精神体互动 */}
      <AnimatePresence>
        {showSpiritInteraction && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 bg-black/60 z-[120] flex items-center justify-center p-4">
            <div className="bg-white rounded-[40px] p-8 w-full max-w-md shadow-2xl relative">
              <button onClick={() => setShowSpiritInteraction(false)} className="absolute top-5 right-5 text-slate-400">
                <X />
              </button>

              <div className="relative w-40 h-40 mx-auto mb-5">
                <div className="w-full h-full rounded-[28px] border-4 border-pink-100 overflow-hidden bg-slate-50 flex items-center justify-center">
                  {spiritStatus.imageUrl ? (
                    <img src={spiritStatus.imageUrl} className="w-full h-full object-cover" alt="spirit" />
                  ) : (
                    <span className="text-slate-300 text-sm">精神体立绘</span>
                  )}
                </div>
                <input
                  ref={spiritImgInputRef}
                  type="file"
                  className="hidden"
                  accept="image/*"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    const reader = new FileReader();
                    reader.onload = async (ev) => {
                      await fetch('/api/tower/interact-spirit', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ userId: user.id, imageUrl: ev.target?.result, intimacyGain: 0 })
                      });
                      syncAllData();
                    };
                    reader.readAsDataURL(f);
                  }}
                />
                <button
                  onClick={() => spiritImgInputRef.current?.click()}
                  className="absolute -bottom-2 -right-2 bg-white border shadow p-2 rounded-full text-pink-500 text-xs font-black"
                >
                  换图
                </button>
              </div>

              <h3 className="font-black text-2xl text-center mb-1">{spiritStatus.name || '未命名精神体'}</h3>
              {!spiritStatus.name && (
                <button
                  className="block mx-auto text-sky-600 font-black mb-4 text-sm"
                  onClick={async () => {
                    const n = prompt('锁定名字后不可更改：');
                    if (!n) return;
                    await fetch('/api/tower/interact-spirit', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ userId: user.id, name: n, intimacyGain: 0 })
                    });
                    syncAllData();
                  }}
                >
                  [ 点击取名 ]
                </button>
              )}

              <div className="grid grid-cols-3 gap-3">
                <SpiritSubBtn
                  label="摸摸"
                  val="+5"
                  color="text-pink-600"
                  onClick={async () => {
                    await fetch('/api/tower/interact-spirit', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ userId: user.id, intimacyGain: 5 })
                    });
                    syncAllData();
                  }}
                />
                <SpiritSubBtn
                  label="喂食"
                  val="+10"
                  color="text-amber-600"
                  onClick={async () => {
                    await fetch('/api/tower/interact-spirit', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ userId: user.id, intimacyGain: 10 })
                    });
                    syncAllData();
                  }}
                />
                <SpiritSubBtn
                  label="训练"
                  val="+15"
                  color="text-indigo-600"
                  onClick={async () => {
                    const r = await fetch('/api/tower/interact-spirit', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ userId: user.id, intimacyGain: 15 })
                    });
                    const d = await r.json();
                    if (d.levelUp) showToast('🎉 精神体升级！');
                    syncAllData();
                  }}
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 分化弹窗 */}
      <AnimatePresence>
        {showAwakening && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 bg-black/60 z-[130] flex items-center justify-center p-4">
            <div className="bg-white rounded-[32px] p-8 max-w-md w-full shadow-2xl text-center">
              <h3 className="font-black text-xl mb-3">评定所</h3>
              <p className="text-slate-600 mb-5">未分化角色的正式分化流程请走管理员审核流程。</p>
              <button onClick={() => setShowAwakening(false)} className="px-5 py-2 bg-slate-900 text-white rounded-xl font-black">
                我知道了
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 个人资料 */}
      <AnimatePresence>
        {showProfileModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 bg-black/50 z-[120] flex items-center justify-center p-4">
            <div className="bg-white rounded-[32px] p-8 w-full max-w-lg shadow-2xl relative">
              <button onClick={() => setShowProfileModal(false)} className="absolute top-5 right-5 text-slate-400">
                <X />
              </button>
              <h3 className="font-black text-xl mb-4">角色档案</h3>
              <div className="space-y-2 text-sm">
                <p>姓名：<b>{user.name}</b></p>
                <p>年龄：<b>{user.age ?? '未知'}</b></p>
                <p>身份：<b>{user.role || '未知'}</b></p>
                <p>派系：<b>{user.faction || '未知'}</b></p>
                <p>精神/肉体：<b>{user.mentalRank || '—'} / {user.physicalRank || '—'}</b></p>
                <p>能力：<b>{user.ability || '—'}</b></p>
                <p>精神体：<b>{user.spiritName || '未命名'}</b></p>
                <p>当前位置：<b>{user.currentLocation || '未驻扎'}</b></p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 设置面板 */}
      <AnimatePresence>
        {showSettings && (
          <motion.div initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 30, opacity: 0 }} className="fixed bottom-24 right-8 w-80 bg-white/95 backdrop-blur-xl rounded-[32px] shadow-2xl border p-6 z-[100]">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-black text-lg flex items-center gap-2">
                <Settings size={20} className="text-slate-700" />
                系统设置
              </h3>
              <X size={18} onClick={() => setShowSettings(false)} className="cursor-pointer" />
            </div>

            <div className="space-y-3">
              <button
                onClick={async () => {
                  await syncAllData();
                  showToast('已刷新全部数据');
                }}
                className="w-full py-3 rounded-2xl bg-sky-50 text-sky-700 font-black flex items-center justify-center gap-2"
              >
                <RefreshCw size={16} /> 刷新数据
              </button>

              <button
                onClick={() => {
                  setUser(null);
                  onNavigate('LOGIN');
                }}
                className="w-full py-3 rounded-2xl bg-rose-50 text-rose-700 font-black flex items-center justify-center gap-2"
              >
                <LogOut size={16} /> 退出登录
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 底部控制栏 */}
      <div className="absolute bottom-8 right-8 flex gap-4 z-40">
        <ControlBtn icon={<ClipboardList />} color="text-amber-500" onClick={() => setShowCommissionBoard(!showCommissionBoard)} />
        <ControlBtn icon={<MessageSquareText />} count={unreadCount} color="text-sky-500" onClick={() => setShowMessageContacts(!showMessageContacts)} />
        <ControlBtn icon={<Backpack />} color="text-slate-700" onClick={() => setShowBackpack(true)} />
        <ControlBtn icon={<Settings />} color="text-slate-400" onClick={() => setShowSettings(true)} />
      </div>

      {/* 全局提示 */}
      <AnimatePresence>
        {toastMsg && (
          <motion.div
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -20, opacity: 0 }}
            className="absolute top-8 left-1/2 -translate-x-1/2 bg-gray-900/90 text-white px-6 py-3 rounded-2xl z-[500] flex items-center gap-3 border border-gray-700 text-sm shadow-2xl"
          >
            <Bell size={16} className="text-amber-400" />
            {toastMsg}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function NPCModal({ npc, onClose, children }: any) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 bg-black/40 z-[110] flex items-center justify-center p-4">
      <div className="bg-white rounded-[40px] p-10 w-full max-w-sm shadow-2xl relative border-t-8 border-emerald-400">
        <div className="flex items-center gap-4 mb-6">
          <div className="p-3 bg-emerald-50 rounded-2xl text-emerald-600">{npc.icon}</div>
          <div>
            <h3 className="font-black text-xl">{npc.name}</h3>
            <p className="text-xs text-emerald-600 font-bold">{npc.role}</p>
          </div>
        </div>
        <p className="text-gray-600 italic mb-8">"{npc.desc}"</p>
        {children}
        <X onClick={onClose} className="absolute top-6 right-6 text-slate-400 cursor-pointer" />
      </div>
    </motion.div>
  );
}

function StatusRow({ label, cur, color }: any) {
  return (
    <div className="w-full">
      <div className="flex justify-between text-[9px] font-black text-slate-400 mb-1 tracking-tighter">
        <span>{label}</span>
        <span>{Math.floor(cur)}%</span>
      </div>
      <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
        <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(100, cur)}%` }} className={`h-full ${color} rounded-full`} />
      </div>
    </div>
  );
}

function ControlBtn({ icon, count, color, onClick }: any) {
  return (
    <button onClick={onClick} className={`relative w-14 h-14 bg-white rounded-full shadow-2xl flex items-center justify-center ${color} hover:scale-110 transition-all border border-slate-50`}>
      {icon}
      {count > 0 && (
        <span className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 rounded-full text-white text-[10px] font-black border-2 border-white animate-bounce flex items-center justify-center shadow-lg">
          {count}
        </span>
      )}
    </button>
  );
}

function SpiritSubBtn({ label, val, color, onClick }: any) {
  return (
    <button onClick={onClick} className={`p-4 rounded-2xl bg-slate-50 border border-slate-100 font-black transition-all flex flex-col items-center ${color} hover:scale-105 active:scale-95`}>
      <span>{label}</span>
      <span className="text-[10px] opacity-70">{val}</span>
    </button>
  );
}

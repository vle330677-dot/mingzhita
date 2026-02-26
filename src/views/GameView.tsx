import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Settings, Backpack, X, Upload, MapPin, Bell } from 'lucide-react';
import { ViewState } from '../App';
import { User, Tombstone, Item } from '../types';

interface Props {
  user: User;
  setUser: (user: User | null) => void;
  onNavigate: (view: ViewState) => void;
}

// === 地图与掉落物数据结构 ===
interface MapLocation {
  id: string;
  name: string;
  x: number; // 百分比
  y: number; // 百分比
  description: string;
  lootTable: string[]; // 该地区的专属掉落池
}

const mapLocations: MapLocation[] = [
  { 
    id: 'tower_of_life', name: '命之塔', x: 50, y: 50, 
    description: '神圣而又洁白的塔，拥有无上至高的权利与话语权。由神使与侍奉者掌管，大灾难与大事件的通知所，也是评定哨兵向导等级与精神状态的最高机构。',
    lootTable: ['高阶精神结晶', '神使的赐福叶片', '古老的塔之文书', '空白的评级报告']
  },
  { 
    id: 'london_tower', name: '伦敦塔', x: 58, y: 48, 
    description: '如学院一般的塔，用于接纳年满16周岁的哨兵与向导。在这里学习三年，以更擅长使用自己的能力，毕业后将被送往军队或公会。',
    lootTable: ['标准向导素', '初级精神屏障指南', '塔内食堂饭票', '破损的训练假人部件']
  },
  { 
    id: 'sanctuary', name: '圣所', x: 42, y: 48, 
    description: '负责教育年幼哨兵与向导的机构（简直就是幼稚园！），学习基础常识与屏障控制，达到16岁或觉醒后升入伦敦塔。',
    lootTable: ['幼崽安抚奶嘴', '基础常识绘本', '涂鸦的画纸', '半块甜甜圈']
  },
  { 
    id: 'guild', name: '公会', x: 50, y: 72, 
    description: '处理民众委托的庞大组织。按能力分配A~S级任务。拥有地下拍卖行，掌握大量钱财与人民所需，隐隐有超越军队的趋势。',
    lootTable: ['悬赏令碎片', '地下拍卖行筹码', '雇佣兵的旧怀表', 'D级委托结算金']
  },
  { 
    id: 'army', name: '军队', x: 50, y: 15, 
    description: '表面上为保护命之塔而建，主要镇压异鬼。高危职业，拥有充足的热武器与至高的军衔荣誉，与公会维持着微妙的平衡。',
    lootTable: ['制式军用匕首', '超载耐受训练手册', '异鬼的残骸', '染血的军功章']
  },
  { 
    id: 'slums', name: '贫民区 (西区)', x: 25, y: 55, 
    description: '破旧房屋拥挤，技术能力者的聚集地。虽然污染严重且苦于奔命，但工厂与核心技术都建在这里。鱼龙混杂，什么人都有。',
    lootTable: ['废弃机械零件', '黑市通行证', '劣质防污染面罩', '机修工的脏手套']
  },
  { 
    id: 'rich_area', name: '富人区 (东区)', x: 75, y: 55, 
    description: '相对整洁富裕，财富与权力的聚集地。富二代、贵族和世家的居所。与西区（贫民区）关系极其恶劣，掌控着大量资金。',
    lootTable: ['精致的高脚杯', '上流社会晚宴请柬', '金丝绣花手帕', '未开封的高级红酒']
  },
  { 
    id: 'tower_guard', name: '守塔会', x: 65, y: 35, 
    description: '信仰塔的组织，负责塔内的治安与管理。表面圣洁高贵，背地里反叛党占多数。随着神使的放任，其掌控命之塔的野心逐渐膨胀。',
    lootTable: ['忏悔书', '守塔会制服纽扣', '秘密审讯记录', '伪造的信仰证明']
  },
  { 
    id: 'demon_society', name: '恶魔会', x: 15, y: 35, 
    description: '为追求自由、推翻守塔会统治而成立的随性组织。恶事善事百无禁忌，无论哨向还是普通人，只要不满守塔会皆可加入。',
    lootTable: ['反叛标语传单', '涂鸦喷漆罐', '恶魔会集会暗号', '生锈的指虎']
  },
  { 
    id: 'paranormal_office', name: '灵异管理所', x: 30, y: 70, 
    description: '专门看管和惩罚违反条约的鬼魂的神秘机构。若鬼魂违规，搜捕队会立即将其抓捕并施以惩罚。路过的鬼魂请注意安全。',
    lootTable: ['引魂灯残片', '灵异管理所封条', '拘魂锁链', '未知的灵异粉末']
  },
  { 
    id: 'observers', name: '观察者', x: 65, y: 15, 
    description: '遍布世界的眼线，只谈交易不谈感情。人员稀少但掌握着极高价值的绝密情报。包含情报搜集与处理部。',
    lootTable: ['加密的微型胶卷', '隐形墨水', '窃听器零件', '被销毁的情报残页']
  }
];

// === 虚拟在线玩家数据结构 (模拟多人同屏) ===
interface MapPlayer {
  id: string;
  name: string;
  avatarUrl?: string;
  locationId: string;
  role: string;
}

const mockOnlinePlayers: MapPlayer[] = [
  { id: 'npc1', name: '艾伦 (S级哨兵)', locationId: 'army', role: '军队' },
  { id: 'npc2', name: '神秘的商人', locationId: 'slums', role: '平民' },
  { id: 'npc3', name: '莉莉安 (A级向导)', locationId: 'london_tower', role: '学生' },
];

export function GameView({ user, setUser, onNavigate }: Props) {
  const [showSettings, setShowSettings] = useState(false);
  const [showBackpack, setShowBackpack] = useState(false);
  const [showDeathModal, setShowDeathModal] = useState(false);
  const [deathType, setDeathType] = useState<'die' | 'ghost'>('die');
  const [deathDesc, setDeathDesc] = useState('');
  
  const [tombstones, setTombstones] = useState<Tombstone[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  
  // 地图交互状态
  const [selectedLocation, setSelectedLocation] = useState<MapLocation | null>(null);
  const [userLocationId, setUserLocationId] = useState<string | null>(null); // 记录当前玩家停留的地点
  
  // 简易的消息提示状态
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchTombstones();
    fetchItems();
  }, [user.id]);

  const fetchTombstones = async () => {
    const res = await fetch('/api/tombstones');
    const data = await res.json();
    if (data.success) setTombstones(data.tombstones);
  };

  const fetchItems = async () => {
    const res = await fetch(`/api/users/${user.id}/items`);
    const data = await res.json();
    if (data.success) setItems(data.items);
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => { /* 保持不变 */ };
  const handleDeath = async () => { /* 保持不变 */ };

  // 简易提示框函数
  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000); // 3秒后消失
  };

  // === 核心交互逻辑：进入、闲逛、停留 ===
  const handleAction = (action: 'enter' | 'explore' | 'stay') => {
    if (!selectedLocation) return;
    
    switch (action) {
      case 'enter':
        showToast(`尝试进入 ${selectedLocation.name} 的内部界面 (系统建设中...)`);
        break;
        
      case 'explore':
        // 闲逛掉落逻辑：60%概率掉落物品
        const isDrop = Math.random() > 0.4;
        if (isDrop) {
          const lootList = selectedLocation.lootTable;
          const randomItemName = lootList[Math.floor(Math.random() * lootList.length)];
          const newItem: Item = {
            id: Date.now().toString(),
            name: randomItemName,
            description: `你在 ${selectedLocation.name} 闲逛时意外发现的物品。`,
          };
          // 放入本地背包 (后续这里需要调用后端 API 同步)
          setItems(prev => [...prev, newItem]);
          showToast(`【掉落】你在 ${selectedLocation.name} 闲逛，找到了「${randomItemName}」！已放入背包。`);
        } else {
          showToast(`你在 ${selectedLocation.name} 转了半天，除了一身灰尘什么也没发现。`);
        }
        break;

      case 'stay':
        // 驻留逻辑：更新当前用户位置
        setUserLocationId(selectedLocation.id);
        showToast(`你决定在 ${selectedLocation.name} 驻扎休息。`);
        // TODO: 后续在这里调用后端 POST /api/stay 接口更新数据库
        break;
    }
    setSelectedLocation(null);
  };

  // 聚合当前地图上的所有玩家（模拟 NPC + 当前真实玩家）
  const getPlayersAtLocation = (locId: string) => {
    const playersHere = mockOnlinePlayers.filter(p => p.locationId === locId);
    if (userLocationId === locId) {
      playersHere.push({ id: user.id, name: user.name, avatarUrl: user.avatarUrl, locationId: locId, role: user.role });
    }
    return playersHere;
  };

  return (
    <div className="min-h-screen bg-[#f5f5f0] relative overflow-hidden font-sans">
      
      {/* 顶部中央的消息提示 Toast */}
      <AnimatePresence>
        {toastMsg && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute top-8 left-1/2 transform -translate-x-1/2 bg-gray-900/90 backdrop-blur-md text-white px-6 py-3 rounded-2xl shadow-xl z-50 flex items-center gap-3 border border-gray-700 max-w-lg text-sm"
          >
            <Bell size={16} className="text-amber-400" />
            {toastMsg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* 地图区域 */}
      <div 
        className="absolute inset-0 pointer-events-auto bg-cover bg-center"
        style={{ backgroundImage: "url('/map_background.jpg')" }}
      >
        <div className="absolute inset-0 bg-black/15 pointer-events-none" /> 
        
        {/* 渲染所有地标点与停留的玩家头像 */}
        {mapLocations.map((loc) => {
          const playersHere = getPlayersAtLocation(loc.id);
          
          return (
            <div
              key={loc.id}
              className="absolute transform -translate-x-1/2 -translate-y-1/2 z-10 flex flex-col items-center"
              style={{ left: `${loc.x}%`, top: `${loc.y}%` }}
            >
              {/* 如果有玩家在这里，显示头像堆叠 */}
              {playersHere.length > 0 && (
                <div className="flex -space-x-2 mb-1">
                  {playersHere.map(p => (
                    <div 
                      key={p.id} 
                      title={`${p.name} (${p.role})`}
                      className={`w-6 h-6 rounded-full border-2 shadow-sm bg-gray-200 flex items-center justify-center overflow-hidden ${p.id === user.id ? 'border-amber-400 z-10 scale-110' : 'border-white'}`}
                    >
                      {p.avatarUrl ? (
                        <img src={p.avatarUrl} alt={p.name} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-[8px] font-bold text-gray-500">{p.name[0]}</span>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* 地标按钮 */}
              <button
                onClick={() => setSelectedLocation(loc)}
                className="group flex flex-col items-center justify-center hover:scale-110 transition-transform"
              >
                <div className="bg-red-600/90 backdrop-blur-sm p-1.5 rounded-full shadow-lg border-2 border-white/80 mb-1">
                  <MapPin size={16} className="text-white" />
                </div>
                <span className="px-2 py-0.5 bg-black/75 text-white text-xs font-bold rounded shadow-sm backdrop-blur-sm whitespace-nowrap">
                  {loc.name}
                </span>
              </button>
            </div>
          );
        })}

        {/* 墓碑层 */}
        <div className="absolute top-8 left-8 flex flex-wrap gap-4 pointer-events-auto max-w-[50%] z-20">
          {tombstones.map(t => (
            <TombstoneUI key={t.id} tombstone={t} />
          ))}
        </div>
      </div>

      {/* 右上角资料卡 (保持原样...) */}
      <div className="absolute top-6 right-6 bg-white/90 backdrop-blur-md p-4 rounded-3xl shadow-sm border border-gray-200/50 flex items-start gap-4 z-30 w-80">
        {/* ... 保留原有头像和文字区代码 ... */}
        <div className="relative group">
          <div className="w-16 h-16 rounded-2xl overflow-hidden bg-gray-100 border border-gray-200">
            {user.avatarUrl ? (
              <img src={user.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400">
                <Upload size={20} />
              </div>
            )}
          </div>
          <div onClick={() => fileInputRef.current?.click()} className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer rounded-2xl">
            <Upload size={20} className="text-white" />
          </div>
          <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleAvatarUpload} />
        </div>
        <div className="flex-1">
          <h3 onClick={() => setShowProfileModal(true)} className="font-bold text-lg text-gray-900 leading-tight cursor-pointer hover:text-sky-700 transition-colors">{user.name}</h3>
          <p className="text-xs font-medium text-emerald-700 mb-2">{user.role}</p>
          <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-xs text-gray-600">
            <div>精神: <span className="font-semibold text-gray-900">{user.mentalRank}</span></div>
            <div>肉体: <span className="font-semibold text-gray-900">{user.physicalRank}</span></div>
            <div className="col-span-2">能力: <span className="font-semibold text-sky-700">{user.ability}</span></div>
            <div className="col-span-2">金币: <span className="font-semibold text-amber-600">{user.gold}</span></div>
          </div>
        </div>
      </div>

      {/* 右下角控制栏 */}
      <div className="absolute bottom-6 right-6 flex gap-3 z-30">
        <button onClick={() => setShowBackpack(true)} className="w-14 h-14 bg-white rounded-full shadow-md border border-gray-200 flex items-center justify-center text-gray-700 hover:bg-gray-50 hover:scale-105 transition-all">
          <Backpack size={24} />
          {items.length > 0 && <span className="absolute top-0 right-0 w-4 h-4 bg-red-500 rounded-full text-[10px] text-white flex items-center justify-center border-2 border-white">{items.length}</span>}
        </button>
        <button onClick={() => setShowSettings(true)} className="w-14 h-14 bg-gray-900 rounded-full shadow-md border border-gray-800 flex items-center justify-center text-white hover:bg-gray-800 hover:scale-105 transition-all">
          <Settings size={24} />
        </button>
      </div>

      {/* 地点交互弹窗 */}
      <AnimatePresence>
        {selectedLocation && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }}
              className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-emerald-500 to-teal-500" />
              
              <div className="flex justify-between items-center mb-4 mt-2">
                <h3 className="text-2xl font-black text-gray-900 flex items-center gap-2">
                  <MapPin className="text-emerald-600" />
                  {selectedLocation.name}
                </h3>
                <button onClick={() => setSelectedLocation(null)} className="text-gray-400 hover:text-gray-600 bg-gray-100 rounded-full p-1 transition-colors">
                  <X size={20} />
                </button>
              </div>

              {/* 地点描述 */}
              <div className="bg-gray-50 rounded-xl p-4 mb-4 border border-gray-100 h-32 overflow-y-auto">
                <p className="text-sm text-gray-700 leading-relaxed">
                  {selectedLocation.description}
                </p>
              </div>

              {/* 当前驻留玩家展示 */}
              <div className="mb-6">
                <div className="text-xs font-bold text-gray-400 mb-2 uppercase">当前在该区域的人</div>
                <div className="flex flex-wrap gap-2">
                  {getPlayersAtLocation(selectedLocation.id).length > 0 ? (
                    getPlayersAtLocation(selectedLocation.id).map(p => (
                      <div key={p.id} className="flex items-center gap-2 bg-white border border-gray-200 rounded-full px-2 py-1 shadow-sm">
                        <div className="w-5 h-5 rounded-full bg-gray-200 overflow-hidden">
                           {p.avatarUrl ? <img src={p.avatarUrl} className="w-full h-full object-cover"/> : <span className="text-[10px] w-full h-full flex items-center justify-center">{p.name[0]}</span>}
                        </div>
                        <span className="text-xs font-medium text-gray-700 pr-1">{p.name}</span>
                      </div>
                    ))
                  ) : (
                    <span className="text-xs text-gray-400">空无一人...</span>
                  )}
                </div>
              </div>

              {/* 操作按钮 */}
              <div className="space-y-3">
                <button onClick={() => handleAction('enter')} className="w-full py-3.5 bg-emerald-50 text-emerald-700 rounded-xl font-bold hover:bg-emerald-100 transition-colors border border-emerald-200 shadow-sm">
                  进入区域
                </button>
                <button onClick={() => handleAction('explore')} className="w-full py-3.5 bg-sky-50 text-sky-700 rounded-xl font-bold hover:bg-sky-100 transition-colors border border-sky-200 shadow-sm">
                  闲逛寻找物资
                </button>
                <button 
                  onClick={() => handleAction('stay')} 
                  disabled={userLocationId === selectedLocation.id}
                  className="w-full py-3.5 bg-gray-900 text-white rounded-xl font-bold hover:bg-gray-800 disabled:bg-gray-400 transition-colors shadow-md"
                >
                  {userLocationId === selectedLocation.id ? '你已经驻扎在此地' : '什么都不做 (停留驻扎)'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- 背包 Modal，设置 Modal，死亡 Modal 请保留你原本的代码，粘贴到这里 --- */}
      {/* 篇幅限制，此处省略了原本的背包/设置弹窗代码，请直接把原文件的这部分粘贴过来 */}

    </div>
  );
}

// ... 底部保留原有的 ProfileField 和 TombstoneUI 组件 ...

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Settings, Backpack, X, Upload, MapPin } from 'lucide-react';
import { ViewState } from '../App';
import { User, Tombstone, Item } from '../types';

interface Props {
  user: User;
  setUser: (user: User | null) => void;
  onNavigate: (view: ViewState) => void;
}

// === 新增：地图地点数据结构 ===
interface MapLocation {
  id: string;
  name: string;
  x: number; // 百分比
  y: number; // 百分比
  description: string;
}

const mapLocations: MapLocation[] = [
  { id: 'tower_of_life', name: '命之塔', x: 50, y: 45, description: '高耸入云的水晶之塔，散发着幽蓝的光芒，这里是世界的中心。' },
  { id: 'slums', name: '贫民区', x: 25, y: 55, description: '破旧的房屋拥挤在一起，鱼龙混杂，但也可能藏着黑市的秘密。' },
  { id: 'rich_area', name: '富人区', x: 75, y: 50, description: '华丽的庄园和整洁的街道，财富与权力的聚集地。' }
];
// =================================

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
  
  // === 新增：控制地点弹窗的状态 ===
  const [selectedLocation, setSelectedLocation] = useState<MapLocation | null>(null);
  
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

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    // ... 保持原有头像上传逻辑不变
  };

  const handleDeath = async () => {
    // ... 保持原有死亡逻辑不变
  };

  // === 新增：地点操作处理函数 ===
  const handleAction = (action: 'enter' | 'explore' | 'stay') => {
    if (!selectedLocation) return;
    
    switch (action) {
      case 'enter':
        alert(`尝试进入 ${selectedLocation.name} 的内部 (待开发)`);
        break;
      case 'explore':
        alert(`你在 ${selectedLocation.name} 闲逛了一圈 (后续将接入掉落逻辑)`);
        break;
      case 'stay':
        alert(`你选择留在 ${selectedLocation.name} (后续将更新服务器状态显示头像)`);
        break;
    }
    setSelectedLocation(null); // 执行完操作后关闭弹窗
  };

  return (
    <div className="min-h-screen bg-[#f5f5f0] relative overflow-hidden font-sans">
      
      {/* === 修改：地图区域 (Background) === */}
      <div 
        className="absolute inset-0 pointer-events-auto bg-cover bg-center"
        style={{ backgroundImage: "url('/map_background.jpg')" }} // 注意这里的图片名字必须和 public 里的图片一致
      >
        <div className="absolute inset-0 bg-black/10 pointer-events-none" /> {/* 轻微遮罩让字更清晰 */}
        
        {/* 渲染地图上的交互点 */}
        {mapLocations.map((loc) => (
          <button
            key={loc.id}
            onClick={() => setSelectedLocation(loc)}
            className="absolute transform -translate-x-1/2 -translate-y-1/2 group flex flex-col items-center justify-center hover:scale-110 transition-transform z-10"
            style={{ left: `${loc.x}%`, top: `${loc.y}%` }}
          >
            <div className="bg-red-600 p-1.5 rounded-full shadow-lg border-2 border-white mb-1">
              <MapPin size={18} className="text-white" />
            </div>
            <span className="px-2 py-0.5 bg-black/70 text-white text-xs font-bold rounded shadow-sm backdrop-blur-sm whitespace-nowrap">
              {loc.name}
            </span>
          </button>
        ))}

        {/* 原本的墓碑层 (调整层级防止被地图遮挡) */}
        <div className="absolute top-8 left-8 flex flex-wrap gap-4 pointer-events-auto max-w-[50%] z-20">
          {tombstones.map(t => (
            <TombstoneUI key={t.id} tombstone={t} />
          ))}
        </div>
      </div>
      {/* ================================== */}

      {/* Top Right Profile (保持不变) */}
      <div className="absolute top-6 right-6 bg-white/90 backdrop-blur-md p-4 rounded-3xl shadow-sm border border-gray-200/50 flex items-start gap-4 z-30 w-80">
        {/* ... 原有代码保持不变 ... */}
      </div>

      {/* Bottom Right Controls (保持不变) */}
      <div className="absolute bottom-6 right-6 flex gap-3 z-30">
        {/* ... 原有代码保持不变 ... */}
      </div>

      {/* Backpack, Profile, Settings, Death Modals ... */}
      {/* ... 原有的 Modal 代码请全部保留在这里 ... */}
      

      {/* === 新增：地点交互弹窗 === */}
      <AnimatePresence>
        {selectedLocation && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl relative overflow-hidden"
            >
              {/* 弹窗顶部装饰 */}
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

              <div className="bg-gray-50 rounded-xl p-4 mb-6 border border-gray-100">
                <p className="text-sm text-gray-700 leading-relaxed">
                  {selectedLocation.description}
                </p>
              </div>

              <div className="space-y-3">
                <div className="text-xs font-bold text-gray-500 mb-2 uppercase tracking-wider">您要做什么？</div>
                <button 
                  onClick={() => handleAction('enter')}
                  className="w-full py-3.5 bg-emerald-50 text-emerald-700 rounded-xl font-bold hover:bg-emerald-100 transition-colors border border-emerald-200 shadow-sm"
                >
                  进入
                </button>
                <button 
                  onClick={() => handleAction('explore')}
                  className="w-full py-3.5 bg-sky-50 text-sky-700 rounded-xl font-bold hover:bg-sky-100 transition-colors border border-sky-200 shadow-sm"
                >
                  闲逛一下
                </button>
                <button 
                  onClick={() => handleAction('stay')}
                  className="w-full py-3.5 bg-gray-900 text-white rounded-xl font-bold hover:bg-gray-800 transition-colors shadow-md"
                >
                  什么都不做 (停留驻扎)
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* ============================ */}

    </div>
  );
}

// ... 底部保留原有的 ProfileField 和 TombstoneUI 组件 ...

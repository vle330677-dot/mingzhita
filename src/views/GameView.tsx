import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Settings, Backpack, X, Upload } from 'lucide-react';
import { ViewState } from '../App';
import { User, Tombstone, Item } from '../types';

interface Props {
  user: User;
  setUser: (user: User | null) => void;
  onNavigate: (view: ViewState) => void;
}

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
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target?.result as string;
      const res = await fetch(`/api/users/${user.id}/avatar`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ avatarUrl: base64 })
      });
      if (res.ok) {
        setUser({ ...user, avatarUrl: base64 });
      }
    };
    reader.readAsDataURL(file);
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
        // Become ghost
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

  return (
    <div className="min-h-screen bg-[#f5f5f0] relative overflow-hidden font-sans">
      {/* Map Area (Background) */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-8 left-8 flex flex-wrap gap-4 pointer-events-auto max-w-[50%]">
          {tombstones.map(t => (
            <TombstoneUI key={t.id} tombstone={t} />
          ))}
        </div>
      </div>

      {/* Top Right Profile */}
      <div className="absolute top-6 right-6 bg-white/90 backdrop-blur-md p-4 rounded-3xl shadow-sm border border-gray-200/50 flex items-start gap-4 z-10 w-80">
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
          <div 
            className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer rounded-2xl"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload size={20} className="text-white" />
          </div>
          <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleAvatarUpload} />
        </div>
        
        <div className="flex-1">
          <h3 
            className="font-bold text-lg text-gray-900 leading-tight cursor-pointer hover:text-sky-700 transition-colors"
            onClick={() => setShowProfileModal(true)}
          >
            {user.name}
          </h3>
          <p className="text-xs font-medium text-emerald-700 mb-2">{user.role}</p>
          <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-xs text-gray-600">
            <div>精神: <span className="font-semibold text-gray-900">{user.mentalRank}</span></div>
            <div>肉体: <span className="font-semibold text-gray-900">{user.physicalRank}</span></div>
            <div className="col-span-2">精神体: <span className="font-semibold text-gray-900">{user.spiritName}</span></div>
            <div className="col-span-2">能力: <span className="font-semibold text-sky-700">{user.ability}</span></div>
            <div className="col-span-2">金币: <span className="font-semibold text-amber-600">{user.gold}</span></div>
          </div>
        </div>
      </div>

      {/* Bottom Right Controls */}
      <div className="absolute bottom-6 right-6 flex gap-3 z-10">
        <button 
          onClick={() => setShowBackpack(true)}
          className="w-14 h-14 bg-white rounded-full shadow-md border border-gray-200 flex items-center justify-center text-gray-700 hover:bg-gray-50 hover:scale-105 transition-all"
        >
          <Backpack size={24} />
        </button>
        <button 
          onClick={() => setShowSettings(true)}
          className="w-14 h-14 bg-gray-900 rounded-full shadow-md border border-gray-800 flex items-center justify-center text-white hover:bg-gray-800 hover:scale-105 transition-all"
        >
          <Settings size={24} />
        </button>
      </div>

      {/* Backpack Modal */}
      <AnimatePresence>
        {showBackpack && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="absolute bottom-24 right-6 w-80 bg-white rounded-3xl shadow-xl border border-gray-200 overflow-hidden z-20 flex flex-col max-h-[60vh]"
          >
            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h3 className="font-bold text-gray-900">背包</h3>
              <button onClick={() => setShowBackpack(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <div className="p-4 overflow-y-auto flex-1">
              {items.length === 0 ? (
                <div className="text-center text-gray-400 py-8 text-sm">背包空空如也</div>
              ) : (
                <div className="grid grid-cols-4 gap-2">
                  {items.map(item => (
                    <div 
                      key={item.id} 
                      onClick={() => setSelectedItem(item)}
                      className="aspect-square bg-gray-100 rounded-xl border border-gray-200 flex items-center justify-center cursor-pointer hover:border-gray-400 transition-colors"
                    >
                      <span className="text-xs truncate px-1">{item.name}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {selectedItem && (
              <div className="p-4 border-t border-gray-100 bg-gray-50">
                <div className="flex justify-between items-start mb-2">
                  <h4 className="font-bold text-sm">{selectedItem.name}</h4>
                  <button onClick={() => setSelectedItem(null)} className="text-gray-400"><X size={16} /></button>
                </div>
                <p className="text-xs text-gray-600 mb-4">{selectedItem.description}</p>
                <div className="flex gap-2">
                  <button className="flex-1 py-2 bg-gray-900 text-white text-xs rounded-lg font-medium">使用</button>
                  <button className="flex-1 py-2 bg-red-50 text-red-600 text-xs rounded-lg font-medium border border-red-100 hover:bg-red-100">丢弃</button>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Profile Modal */}
      <AnimatePresence>
        {showProfileModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white rounded-3xl p-6 w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-y-auto"
            >
              <div className="flex justify-between items-center mb-6 border-b border-gray-100 pb-4">
                <h3 className="text-2xl font-black text-gray-900">角色档案：{user.name}</h3>
                <button onClick={() => setShowProfileModal(false)} className="text-gray-400 hover:text-gray-600">
                  <X size={24} />
                </button>
              </div>
              
              <div className="grid grid-cols-1 gap-6">
                <div className="space-y-4">
                  <ProfileField label="姓名" value={user.name} />
                  <ProfileField label="所属人群" value={user.role} />
                  <ProfileField label="精神力" value={user.mentalRank} />
                  <ProfileField label="肉体强度" value={user.physicalRank} />
                  <ProfileField label="能力" value={user.ability} />
                  <ProfileField label="精神体" value={user.spiritName} />
                  <ProfileField label="个人资料" value={user.profileText} isLong />
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Settings Modal */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl"
            >
              <h3 className="text-xl font-bold text-gray-900 mb-6 text-center">设置</h3>
              <div className="flex flex-col gap-3">
                <button 
                  onClick={() => { setDeathType('die'); setShowDeathModal(true); }}
                  className="w-full py-4 bg-red-50 text-red-600 rounded-2xl font-bold hover:bg-red-100 transition-colors border border-red-100"
                >
                  我不玩了！我要死了换皮！
                </button>
                <button 
                  onClick={() => { setDeathType('ghost'); setShowDeathModal(true); }}
                  className="w-full py-4 bg-purple-50 text-purple-700 rounded-2xl font-bold hover:bg-purple-100 transition-colors border border-purple-100"
                >
                  我要当鬼
                </button>
                <button 
                  onClick={() => setShowSettings(false)}
                  className="w-full py-4 bg-gray-100 text-gray-700 rounded-2xl font-bold hover:bg-gray-200 transition-colors mt-2"
                >
                  什么事都没有
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Death Input Modal */}
      <AnimatePresence>
        {showDeathModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-gray-900/80 backdrop-blur-md z-[60] flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl"
            >
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                {deathType === 'die' ? '死亡宣告' : '化身为鬼'}
              </h3>
              <p className="text-sm text-gray-500 mb-6">请留下你最后的文字描述...</p>
              <textarea
                value={deathDesc}
                onChange={e => setDeathDesc(e.target.value)}
                placeholder="例如：在一次探索中遭遇了不可名状的恐惧..."
                className="w-full h-32 p-4 bg-gray-50 border border-gray-200 rounded-2xl resize-none focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent mb-6 text-sm"
              />
              <div className="flex gap-3">
                <button 
                  onClick={() => setShowDeathModal(false)}
                  className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200"
                >
                  取消
                </button>
                <button 
                  onClick={handleDeath}
                  disabled={!deathDesc.trim()}
                  className="flex-1 py-3 bg-gray-900 text-white rounded-xl font-bold hover:bg-gray-800 disabled:opacity-50"
                >
                  确认
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ProfileField({ label, value, isLong }: { label: string, value?: string, isLong?: boolean }) {
  return (
    <div className={`bg-gray-50 rounded-xl p-3 border border-gray-100 ${isLong ? 'h-full' : ''}`}>
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className="text-sm font-medium text-gray-900 whitespace-pre-wrap">{value || '未知'}</div>
    </div>
  );
}

function TombstoneUI({ tombstone }: { tombstone: Tombstone; key?: React.Key }) {
  const [showInfo, setShowInfo] = useState(false);

  return (
    <div className="relative">
      <div 
        onClick={() => setShowInfo(!showInfo)}
        className="w-12 h-16 bg-gray-300 rounded-t-full border-2 border-gray-400 shadow-sm flex items-center justify-center cursor-pointer hover:bg-gray-400 transition-colors"
      >
        <span className="text-[10px] font-serif text-gray-600 font-bold rotate-90 tracking-widest">RIP</span>
      </div>
      
      <AnimatePresence>
        {showInfo && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.9 }}
            className="absolute top-full left-0 mt-2 w-64 bg-white/90 backdrop-blur-md p-4 rounded-2xl shadow-xl border border-gray-200 z-30"
          >
            <h4 className="font-bold text-gray-900 border-b border-gray-100 pb-2 mb-2">{tombstone.name} 的墓碑</h4>
            <div className="text-xs text-gray-600 space-y-1 mb-3">
              <p>生前身份: {tombstone.role}</p>
              <p>精神: {tombstone.mentalRank} / 肉体: {tombstone.physicalRank}</p>
              <p>能力: {tombstone.ability}</p>
              <p>精神体: {tombstone.spiritName}</p>
            </div>
            <div className="bg-gray-50 p-3 rounded-xl text-xs text-gray-700 italic border border-gray-100">
              "{tombstone.deathDescription}"
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, MapPin, Heart, Zap, Brain, Briefcase, DoorOpen, ArrowLeft, Camera, Edit3, UserMinus, CheckCircle } from 'lucide-react';
import { User } from '../types';

interface Props {
  user: User;
  setUser: (user: User) => void;
  onExit: () => void; // 退出到大地图
  showToast: (msg: string) => void;
}

// 内部房间配置
const towerRooms = [
  { id: 'tower_top', name: '神使层', x: 50, y: 12, description: '塔顶，神使居所。', minMental: 'S' },
  { id: 'tower_attendant', name: '侍奉者层', x: 50, y: 25, description: '侍奉者的居住区。', minMental: 'B+' },
  { id: 'tower_descendant', name: '神使后裔层', x: 50, y: 38, description: '神使候补居住区。', minMental: 'A+' },
  { id: 'tower_training', name: '精神力训练所', x: 32, y: 55, description: '锻炼精神力的地方。' },
  { id: 'tower_evaluation', name: '评定所', x: 68, y: 55, description: '觉醒与评定中心。' },
  { id: 'tower_hall', name: '大厅', x: 50, y: 80, description: '命之塔大厅。' }
];

export function TowerView({ user, setUser, onExit, showToast }: Props) {
  const [selectedRoom, setSelectedRoom] = useState<any>(null);
  const [showActionPanel, setShowActionPanel] = useState(false);
  const [showSpiritPanel, setShowSpiritPanel] = useState(false);
  const [spiritStatus, setSpiritStatus] = useState<any>({ name: '', intimacy: 0, level: 1, hp: 100 });
  const [miniGame, setMiniGame] = useState({ active: false, target: '', input: '' });
  const spiritImgInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { fetchSpiritStatus(); }, []);

  const fetchSpiritStatus = async () => {
    const res = await fetch(`/api/users/${user.id}/spirit-status`);
    const data = await res.json();
    if (data.success) setSpiritStatus(data.spiritStatus);
  };

  const handleRoomClick = (room: any) => {
    const jobRooms: Record<string, string> = { '神使': 'tower_top', '侍奉者': 'tower_attendant', '神使后裔': 'tower_descendant', '仆从': 'tower_hall' };
    
    if (['tower_top', 'tower_attendant', 'tower_descendant'].includes(room.id)) {
      if (!user.job || user.job === '无') {
        // 入职逻辑
        const ranks = ['D', 'C', 'B', 'B+', 'A', 'A+', 'S'];
        if (ranks.indexOf(user.mentalRank || 'D') >= ranks.indexOf(room.minMental)) {
          if (confirm(`是否申请入职「${room.name}」？`)) handleJoin(room.name.replace('层',''));
        } else showToast(`等级不足，需要精神力 ${room.minMental}`);
      } else if (jobRooms[user.job] === room.id) {
        setShowActionPanel(true); // 进入自己的房间
      } else showToast("私人区域，禁止进入");
    } else {
      setSelectedRoom(room);
    }
  };

  const handleJoin = async (n: string) => {
    const res = await fetch('/api/tower/join', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: user.id, jobName: n }) });
    const data = await res.json();
    if (data.success) { showToast("入职成功"); window.location.reload(); } else showToast(data.message);
  };

  const handleSpiritAction = async (gain: number) => {
    const res = await fetch('/api/tower/interact-spirit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: user.id, intimacyGain: gain }) });
    const data = await res.json();
    if (data.success) {
      if (data.levelUp) showToast("亲密度升级！角色精神进度+20%");
      fetchSpiritStatus();
    }
  };

  return (
    <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: "url('/命之塔.jpg')" }}>
      <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" />
      
      {/* 返回按钮 */}
      <button onClick={onExit} className="absolute top-8 left-8 z-50 bg-white/90 px-6 py-2 rounded-2xl font-black shadow-2xl flex items-center gap-2">
        <ArrowLeft size={20}/> 返回大地图
      </button>

      {/* 渲染坐标点 */}
      {towerRooms.map(room => (
        <div key={room.id} className="absolute transform -translate-x-1/2 -translate-y-1/2 z-10" style={{ left: `${room.x}%`, top: `${room.y}%` }}>
          <button onClick={() => handleRoomClick(room)} className="group flex flex-col items-center">
            <div className="p-2 bg-sky-500 rounded-full border-2 border-sky-100 shadow-2xl transition-all group-hover:scale-125">
              <MapPin size={18} className="text-white"/>
            </div>
            <span className="mt-1 px-3 py-1 bg-black/80 text-white text-[10px] font-black rounded-lg">{room.name}</span>
          </button>
        </div>
      ))}

      {/* 浮动操作面板 */}
      <AnimatePresence>
        {showActionPanel && (
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40">
            <div className="bg-white p-8 rounded-[48px] w-full max-w-sm shadow-2xl relative">
              <h3 className="font-black text-2xl mb-8 text-center">房间管理 ({user.job})</h3>
              <div className="grid grid-cols-2 gap-4">
                <button onClick={() => {/* 签到逻辑 */}} className="p-4 bg-emerald-50 text-emerald-700 rounded-3xl font-bold flex flex-col items-center"><CheckCircle className="mb-1"/>签到</button>
                <button onClick={() => {/* 打工逻辑 */}} className="p-4 bg-sky-50 text-sky-700 rounded-3xl font-bold flex flex-col items-center"><Briefcase className="mb-1"/>打工</button>
                <button onClick={() => { setShowSpiritPanel(true); setShowActionPanel(false); }} className="p-4 bg-pink-50 text-pink-700 rounded-3xl font-bold flex flex-col items-center"><Heart className="mb-1"/>精神体</button>
                <button onClick={() => {/* 离职逻辑 */}} className="p-4 bg-rose-50 text-rose-600 rounded-3xl font-bold flex flex-col items-center"><UserMinus className="mb-1"/>离职</button>
              </div>
              <button onClick={() => setShowActionPanel(false)} className="w-full mt-6 py-3 bg-gray-100 rounded-2xl font-bold">关闭窗口</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* 此处可继续添加精神体面板、小游戏等 */}
    </div>
  );
}

import React, { useState, useRef } from 'react';
import { motion } from 'motion/react';
import { X, Heart, Zap, Briefcase, DoorOpen, Camera, Edit3, UserMinus, CheckCircle, Trophy } from 'lucide-react';
import { User } from '../types';

interface SpiritStatus {
  name: string;
  intimacy: number;
  level: number;
  hp: number;
  imageUrl: string;
}

interface Props {
  user: User;
  spiritStatus: SpiritStatus;
  onClose: () => void;
  showToast: (msg: string) => void;
  onUpdateData: () => void; // 用于通知父组件刷新全局数据
}

export function TowerRoomView({ user, spiritStatus, onClose, showToast, onUpdateData }: Props) {
  const [showSpiritPanel, setShowSpiritPanel] = useState(false);
  const spiritImgInputRef = useRef<HTMLInputElement>(null);

  // --- 交互逻辑 ---
  const handleAction = async (endpoint: string, body: any = {}) => {
    const res = await fetch(`/api/tower/${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id, ...body })
    });
    const data = await res.json();
    if (data.success) {
      if (data.reward) showToast(`获得奖励: ${data.reward} G`);
      if (data.levelUp) showToast("🎉 精神体升级！精神进度提升 20%");
      if (data.penalty) showToast(`已支付违约金: ${data.penalty} G`);
      onUpdateData(); // 触发全局刷新
      if (endpoint === 'quit') onClose();
    } else {
      showToast(data.message);
    }
  };

  const handleRename = async () => {
    if (spiritStatus.name) return;
    const n = prompt("请为精神体取名（一旦确定无法修改）：");
    if (n) handleAction('interact-spirit', { name: n, intimacyGain: 0 });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      handleAction('interact-spirit', { imageUrl: ev.target?.result, intimacyGain: 0 });
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
      {!showSpiritPanel ? (
        // --- 房间管理主面板 ---
        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} 
          className="bg-white rounded-[48px] p-10 w-full max-w-sm shadow-2xl relative border border-white/20">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h3 className="font-black text-2xl text-slate-900">房间管理</h3>
              <p className="text-xs font-bold text-sky-600">{(user as any).job} 专属领地</p>
            </div>
            <button onClick={onClose} className="p-2 bg-slate-100 rounded-full hover:bg-slate-200 transition-colors"><X/></button>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-8">
            <RoomBtn icon={<CheckCircle/>} label="签到领薪" sub="每日月薪" color="bg-emerald-50 text-emerald-700" onClick={() => handleAction('checkin')}/>
            <RoomBtn icon={<Briefcase/>} label="开始打工" sub={`次数: ${(user as any).workCount}/3`} color="bg-sky-50 text-sky-700" onClick={() => handleAction('work')}/>
            <RoomBtn icon={<Heart/>} label="精神体互动" sub="培养契约" color="bg-pink-50 text-pink-700" onClick={() => setShowSpiritPanel(true)}/>
            <RoomBtn icon={<UserMinus/>} label="申请离职" sub="30%违约金" color="bg-rose-50 text-rose-600" onClick={() => handleAction('quit')}/>
          </div>
          
          <button onClick={() => handleAction('rest')} className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black flex items-center justify-center gap-2 hover:bg-slate-800 transition-all">
            <DoorOpen size={18}/> 深度休息 (回复HP/MP)
          </button>
        </motion.div>
      ) : (
        // --- 精神体深度互动面板 ---
        <motion.div initial={{ x: 50, opacity: 0 }} animate={{ x: 0, opacity: 1 }}
          className="bg-white rounded-[56px] p-10 w-full max-w-md shadow-2xl relative border-t-8 border-pink-400">
          <button onClick={() => setShowSpiritPanel(false)} className="absolute top-8 right-8 text-slate-400"><X/></button>
          
          <div className="relative w-48 h-48 mx-auto mb-8">
            <div className="w-full h-full bg-slate-50 rounded-[48px] border-4 border-pink-50 overflow-hidden flex items-center justify-center shadow-inner">
              {spiritStatus.imageUrl ? (
                <img src={spiritStatus.imageUrl} className="w-full h-full object-cover" />
              ) : (
                <Zap size={64} className="text-pink-200 animate-pulse" />
              )}
            </div>
            <button onClick={() => spiritImgInputRef.current?.click()} className="absolute -bottom-2 -right-2 bg-white p-3 rounded-full shadow-2xl text-pink-500 hover:scale-110 border border-pink-50">
              <Camera size={20}/>
            </button>
            <input type="file" ref={spiritImgInputRef} className="hidden" accept="image/*" onChange={handleImageUpload}/>
          </div>

          <div className="text-center mb-8">
            <div className="flex items-center justify-center gap-2 mb-1">
              <h3 className="font-black text-3xl text-slate-800">{spiritStatus.name || "未命名精神体"}</h3>
              {!spiritStatus.name && <Edit3 size={20} className="text-sky-500 cursor-pointer" onClick={handleRename}/>}
            </div>
            <div className="flex justify-center gap-4 text-[10px] font-black tracking-widest text-pink-500 uppercase">
              <span>Level {spiritStatus.level}</span>
              <span>HP {spiritStatus.hp}/100</span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <SpiritInteractBtn label="摸摸" val="+5" color="hover:bg-pink-50 text-pink-600" onClick={() => handleAction('interact-spirit', { intimacyGain: 5 })}/>
            <SpiritInteractBtn label="喂食" val="+10" color="hover:bg-amber-50 text-amber-600" onClick={() => handleAction('interact-spirit', { intimacyGain: 10 })}/>
            <SpiritInteractBtn label="训练" val="+15" color="hover:bg-indigo-50 text-indigo-600" onClick={() => handleAction('interact-spirit', { intimacyGain: 15 })}/>
          </div>
          <button onClick={() => setShowSpiritPanel(false)} className="w-full mt-6 py-4 bg-slate-100 text-slate-500 rounded-2xl font-black">返回房间</button>
        </motion.div>
      )}
    </div>
  );
}

// 子组件：图标按钮
function RoomBtn({ icon, label, sub, color, onClick }: any) {
  return (
    <button onClick={onClick} className={`flex flex-col items-center justify-center p-5 rounded-[32px] transition-all active:scale-95 shadow-sm border border-transparent hover:border-current/10 ${color}`}>
      <div className="mb-2 scale-125">{icon}</div>
      <span className="text-xs font-black mb-1">{label}</span>
      <span className="text-[9px] font-bold opacity-60">{sub}</span>
    </button>
  );
}

function SpiritInteractBtn({ label, val, color, onClick }: any) {
  return (
    <button onClick={onClick} className={`p-4 rounded-3xl bg-slate-50 border border-slate-100 font-black transition-all flex flex-col items-center ${color} hover:shadow-md`}>
      <span className="text-sm">{label}</span>
      <span className="text-[10px] opacity-70">{val}</span>
    </button>
  );
}

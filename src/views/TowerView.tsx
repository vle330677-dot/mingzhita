import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, MapPin, Heart, Zap, Briefcase, DoorOpen, ArrowLeft, Camera, Edit3, UserMinus, CheckCircle } from 'lucide-react';
import { User } from '../types';

interface Props {
  user: User;
  setUser: (user: User) => void;
  onExit: () => void;
  showToast: (msg: string) => void;
  fetchGlobalData: () => void; // 用于刷新主面板数据
}

const towerRooms = [
  { id: 'tower_top', name: '神使层', x: 50, y: 12, description: '塔顶，至高无上的神使居所。', minMental: 'S' },
  { id: 'tower_attendant', name: '侍奉者层', x: 50, y: 25, description: '侍奉者的居住区。', minMental: 'B+' },
  { id: 'tower_descendant', name: '神使后裔层', x: 50, y: 38, description: '神使继承人居住区。', minMental: 'A+' },
  { id: 'tower_training', name: '精神力训练所', x: 32, y: 55, description: '锻炼精神力的地方。' },
  { id: 'tower_evaluation', name: '评定所', x: 68, y: 55, description: '评定等级与分化中心。' },
  { id: 'tower_hall', name: '大厅', x: 50, y: 80, description: '宏伟的枢纽大厅。' }
];

export function TowerView({ user, setUser, onExit, showToast, fetchGlobalData }: Props) {
  const [showActionPanel, setShowActionPanel] = useState(false);
  const [showSpiritPanel, setShowSpiritPanel] = useState(false);
  const [spiritStatus, setSpiritStatus] = useState<any>({ name: '', intimacy: 0, level: 1, hp: 100, imageUrl: '' });
  const spiritImgInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { fetchSpiritStatus(); }, []);

  const fetchSpiritStatus = async () => {
    const res = await fetch(`/api/users/${user.id}/spirit-status`);
    const data = await res.json();
    if (data.success) setSpiritStatus(data.spiritStatus);
  };

  const handleRoomClick = (room: any) => {
    const jobRooms: Record<string, string> = { '神使': 'tower_top', '侍奉者': 'tower_attendant', '神使后裔': 'tower_descendant', '仆从': 'tower_hall' };
    
    // 权限判定：只有对应职位能进对应房间
    if (['tower_top', 'tower_attendant', 'tower_descendant'].includes(room.id)) {
      if (!user.job || user.job === '无') {
        const ranks = ['D', 'C', 'B', 'B+', 'A', 'A+', 'S'];
        if (ranks.indexOf(user.mentalRank || 'D') >= ranks.indexOf(room.minMental)) {
          if (confirm(`是否申请入职「${room.name.replace('层','')}」？`)) handleJoin(room.name.replace('层',''));
        } else showToast(`等级不足，需要精神力 ${room.minMental}`);
      } else if (jobRooms[user.job] === room.id) {
        setShowActionPanel(true); 
      } else showToast("私人房间，禁止进入");
    } else showToast(`${room.name}: ${room.description}`);
  };

  const handleJoin = async (jobName: string) => {
    const res = await fetch('/api/tower/join', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: user.id, jobName }) });
    const data = await res.json();
    if (data.success) { showToast(`成功成为${jobName}`); fetchGlobalData(); }
    else showToast(data.message); // 后端会返回名额已满的提示
  };

  const handleCheckIn = async () => {
    const res = await fetch('/api/tower/checkin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: user.id }) });
    const data = await res.json();
    if (data.success) { showToast(`签到成功！月薪 ${data.reward} G 入账`); fetchGlobalData(); }
    else showToast(data.message);
  };

  const handleQuit = async () => {
    if (!confirm("离职需扣除 30% 月薪罚金，确定吗？")) return;
    const res = await fetch('/api/tower/quit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: user.id }) });
    const data = await res.json();
    if (data.success) { showToast(`离职成功，扣除 ${data.penalty} G`); setShowActionPanel(false); fetchGlobalData(); }
  };

  const handleSpiritInteract = async (gain: number) => {
    const res = await fetch('/api/tower/interact-spirit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: user.id, intimacyGain: gain }) });
    const data = await res.json();
    if (data.success) {
      if (data.levelUp) showToast("等级提升！精神进度 +20%");
      fetchSpiritStatus(); fetchGlobalData();
    }
  };

  return (
    <div className="absolute inset-0 bg-cover bg-center transition-all" style={{ backgroundImage: "url('/命之塔.jpg')" }}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px]" />
      
      <button onClick={onExit} className="absolute top-24 left-8 z-50 bg-white/90 px-6 py-2 rounded-2xl font-black shadow-xl flex items-center gap-2 hover:scale-105">
        <ArrowLeft size={20}/> 返回大地图
      </button>

      {towerRooms.map(room => (
        <div key={room.id} className="absolute transform -translate-x-1/2 -translate-y-1/2 z-10" style={{ left: `${room.x}%`, top: `${room.y}%` }}>
          <button onClick={() => handleRoomClick(room)} className="group flex flex-col items-center">
            <div className="p-2 bg-sky-500 rounded-full border-2 border-sky-100 shadow-2xl transition-all group-hover:scale-125"><MapPin size={18} className="text-white"/></div>
            <span className="mt-1 px-3 py-1 bg-black/80 text-white text-[10px] font-black rounded-lg">{room.name}</span>
          </button>
        </div>
      ))}

      {/* 房间操作弹窗 */}
      <AnimatePresence>
        {showActionPanel && (
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/20">
            <div className="bg-white/95 backdrop-blur-xl p-10 rounded-[48px] shadow-2xl w-full max-w-sm border border-white">
              <h3 className="font-black text-2xl mb-8">房间管理 • {user.job}</h3>
              <div className="grid grid-cols-2 gap-4">
                <ActionBtn icon={<CheckCircle/>} label="签到领薪" color="bg-emerald-50 text-emerald-700" onClick={handleCheckIn}/>
                <ActionBtn icon={<Briefcase/>} label="开始打工" color="bg-sky-50 text-sky-700" onClick={() => {/* 打工逻辑 */}}/>
                <ActionBtn icon={<Heart/>} label="互动沟通" color="bg-pink-50 text-pink-700" onClick={() => { setShowSpiritPanel(true); setShowActionPanel(false); }}/>
                <ActionBtn icon={<UserMinus/>} label="申请离职" color="bg-rose-50 text-rose-600" onClick={handleQuit}/>
              </div>
              <button onClick={() => setShowActionPanel(false)} className="w-full mt-6 py-3 bg-slate-100 rounded-2xl font-black">关闭</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 精神体深度互动系统 */}
      <AnimatePresence>
        {showSpiritPanel && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 bg-black/80 backdrop-blur-xl z-[110] flex items-center justify-center p-4">
            <div className="bg-white rounded-[56px] p-10 w-full max-w-md shadow-2xl relative border-t-8 border-pink-400">
              <button onClick={() => setShowSpiritPanel(false)} className="absolute top-8 right-8 text-slate-400"><X/></button>
              <div className="relative w-48 h-48 mx-auto mb-6">
                <div className="w-full h-full bg-slate-50 rounded-[48px] border-4 border-pink-50 overflow-hidden flex items-center justify-center shadow-inner">
                  {spiritStatus.imageUrl ? <img src={spiritStatus.imageUrl} className="w-full h-full object-cover"/> : <Zap size={48} className="text-pink-200"/>}
                </div>
                <button onClick={() => spiritImgInputRef.current?.click()} className="absolute -bottom-2 -right-2 bg-white p-3 rounded-full shadow-2xl text-pink-500"><Camera size={18}/></button>
                <input type="file" ref={spiritImgInputRef} className="hidden" accept="image/*" onChange={async (e) => {
                   const f = e.target.files?.[0]; if(!f) return;
                   const r = new FileReader(); r.onload = async (ev) => {
                     await fetch(`/api/tower/interact-spirit`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: user.id, imageUrl: ev.target?.result, intimacyGain: 0 }) });
                     fetchSpiritStatus();
                   }; r.readAsDataURL(f);
                }}/>
              </div>
              <h3 className="font-black text-3xl text-center mb-1">{spiritStatus.name || "未命名精神体"}</h3>
              {!spiritStatus.name && <button className="block mx-auto text-sky-600 font-black mb-6" onClick={async () => { const n = prompt("锁定名字后不可更改："); if(n) { await fetch(`/api/tower/interact-spirit`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: user.id, name: n, intimacyGain: 0 }) }); fetchSpiritStatus(); } }}>[ 点击取名 ]</button>}
              <div className="grid grid-cols-2 gap-4">
                <SpiritBtn label="摸摸" sub="+5" color="text-pink-600" onClick={() => handleSpiritInteract(5)}/>
                <SpiritBtn label="喂食" sub="+10" color="text-amber-600" onClick={() => handleSpiritInteract(10)}/>
                <SpiritBtn label="训练" sub="+15" color="text-indigo-600" onClick={() => handleSpiritInteract(15)}/>
                <SpiritBtn label="离开" sub="" color="text-slate-400" onClick={() => setShowSpiritPanel(false)}/>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ActionBtn({ icon, label, color, onClick }: any) {
  return (<button onClick={onClick} className={`flex flex-col items-center p-6 rounded-3xl transition-all hover:scale-105 ${color}`}>{icon}<span className="text-xs font-black mt-2">{label}</span></button>);
}
function SpiritBtn({ label, sub, color, onClick }: any) {
  return (<button onClick={onClick} className={`p-4 rounded-2xl bg-slate-50 border border-slate-100 font-black transition-all ${color}`}><span>{label}</span><span className="text-[10px] opacity-70 ml-2">{sub}</span></button>);
}

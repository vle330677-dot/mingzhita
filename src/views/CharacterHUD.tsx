import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { User } from '../types';
import {
  ChevronRight, ChevronLeft, Zap, Heart,
  Activity, Shield, Briefcase, Award, Skull, BookOpen, Trash2, ArrowUpCircle, Package
} from 'lucide-react';

interface Props {
  user: User;
  onLogout: () => void;
  onRefresh?: () => void;
}

export function CharacterHUD({ user, onLogout, onRefresh }: Props) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [skills, setSkills] = useState<any[]>([]);
  const [inventory, setInventory] = useState<any[]>([]);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [showProfileModal, setShowProfileModal] = useState(false);
  const [avatarDraft, setAvatarDraft] = useState(user.avatarUrl || '');
  const [localAvatarUrl, setLocalAvatarUrl] = useState(user.avatarUrl || '');
  const [savingAvatar, setSavingAvatar] = useState(false);

  const avatarCacheKey = `avatar_cache_${user.id}`;

  // 1) 优先同步服务器头像
  useEffect(() => {
    if (user.avatarUrl) {
      setLocalAvatarUrl(user.avatarUrl);
      setAvatarDraft(user.avatarUrl);
      localStorage.setItem(avatarCacheKey, user.avatarUrl);
    } else {
      // 2) 服务器无头像时，用本地缓存兜底
      const cached = localStorage.getItem(avatarCacheKey);
      if (cached) {
        setLocalAvatarUrl(cached);
        setAvatarDraft(cached);
      } else {
        setLocalAvatarUrl('');
        setAvatarDraft('');
      }
    }
  }, [user.avatarUrl, avatarCacheKey]);

  const fetchSkills = async () => {
    try {
      const res = await fetch(`/api/users/${user.id}/skills`);
      const data = await res.json();
      if (data.success) setSkills(data.skills);
    } catch (e) {
      console.error("拉取技能失败", e);
    }
  };

  const fetchInventory = async () => {
    try {
      const res = await fetch(`/api/users/${user.id}/inventory`);
      const data = await res.json();
      if (data.success) setInventory(data.items);
    } catch (e) {
      console.error("拉取背包失败", e);
    }
  };

  useEffect(() => {
    fetchSkills();
    fetchInventory();
    const timer = setInterval(() => {
      fetchSkills();
      fetchInventory();
    }, 10000);
    return () => clearInterval(timer);
  }, [user.id]);

  const handleMergeSkill = async (row: any) => {
    try {
      const samePool = skills.filter((s: any) =>
        Number(s.id) !== Number(row.id) &&
        (Number(s.skillId) === Number(row.skillId) || String(s.name) === String(row.name))
      );
      if (samePool.length === 0) {
        alert('没有可合并的同名或同技能条目');
        return;
      }
      const mate = samePool[0];
      const res = await fetch(`/api/users/${user.id}/skills/merge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skillAId: row.id, skillBId: mate.id })
      });
      const data = await res.json();
      alert(data.message);
      if (data.success) fetchSkills();
    } catch (e) {
      console.error(e);
    }
  };

  const handleForgetSkill = async (skillId: number) => {
    if (!confirm('遗忘后技能将永久消失，且不会返还技能书，确定吗？')) return;
    try {
      await fetch(`/api/users/${user.id}/skills/${skillId}`, { method: 'DELETE' });
      fetchSkills();
    } catch (e) {
      console.error(e);
    }
  };

  const handleUseItem = async (inventoryId: number) => {
    try {
      const res = await fetch('/api/inventory/use', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, inventoryId })
      });
      const data = await res.json();
      alert(data.message);
      if (data.success) {
        fetchInventory();
        fetchSkills();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleAvatarFile = (file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target?.result as string;
      setAvatarDraft(base64);
    };
    reader.readAsDataURL(file);
  };

  // ✅ 头像保存：多端点 + 多字段 + 本地缓存兜底
  const handleSaveAvatar = async () => {
  try {
    if (!avatarDraft?.trim()) {
      alert('请先输入头像URL或上传图片');
      return;
    }

    setSavingAvatar(true);

    const res = await fetch(`/api/users/${user.id}/avatar`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ avatarUrl: avatarDraft })
    });

    const data = await res.json().catch(() => ({} as any));
    if (!res.ok || data?.success === false) {
      alert(data?.message || '头像保存失败');
      return;
    }

    setLocalAvatarUrl(avatarDraft);
    localStorage.setItem(avatarCacheKey, avatarDraft);
    onRefresh?.();

    alert('头像保存成功');
  } catch (e) {
    console.error(e);
    alert('头像保存失败（网络错误）');
  } finally {
    setSavingAvatar(false);
  }
};


  const furyColor = (user.fury || 0) > 80 ? 'bg-red-600 animate-pulse' : 'bg-purple-600';
  const stabilityColor = (Number((user as any).guideStability ?? 100) <= 20) ? 'bg-rose-600 animate-pulse' : 'bg-emerald-500';
  const userAge = user.age || 0;
  const isChild = userAge < 16;
  const isSentinel = String(user.role || '') === '哨兵' || String(user.role || '').toLowerCase() === 'sentinel';
  const isGuide = String(user.role || '') === '向导' || String(user.role || '').toLowerCase() === 'guide';
  const erosionLevel = Math.max(0, Number((user as any).erosionLevel ?? 0));
  const bleedingLevel = Math.max(0, Number((user as any).bleedingLevel ?? 0));

  const hpPct = ((user.hp || 0) / Math.max(1, (user.maxHp || 100))) * 100;

  return (
    <>
      <div ref={containerRef} className="fixed inset-0 pointer-events-none z-50 overflow-hidden" />

      <motion.div
        drag
        dragConstraints={containerRef}
        dragMomentum={false}
        initial={{ x: 16, y: 16 }}
        className="fixed top-0 left-0 z-[100] pointer-events-auto"
      >
        <AnimatePresence mode="wait">
          {isExpanded ? (
            <motion.div
              key="expanded"
              initial={{ opacity: 0, scale: 0.9, width: 60 }}
              animate={{ opacity: 1, scale: 1, width: 280 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-slate-900/95 backdrop-blur-xl border border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
            >
              <div className="p-4 bg-slate-800/50 border-b border-slate-700 cursor-move flex items-center justify-between group">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-slate-700 overflow-hidden border border-slate-600 shrink-0">
                    {localAvatarUrl ? (
                      <img src={localAvatarUrl} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-white font-bold">{user.name[0]}</div>
                    )}
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); setShowProfileModal(true); }}
                    className="flex flex-col overflow-hidden text-left hover:opacity-90 transition-opacity"
                    title="查看/编辑详细信息"
                  >
                    <span className="font-black text-white text-sm tracking-wide truncate underline decoration-dotted underline-offset-2">
                      {user.name}
                    </span>
                    <span className={`text-[10px] font-bold uppercase truncate ${isChild ? 'text-amber-400' : 'text-sky-400'}`}>
                      Lv.{user.age} {isChild ? '未分化' : user.role}
                    </span>
                  </button>
                </div>
                <button
                  onClick={() => setIsExpanded(false)}
                  className="p-1 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors shrink-0"
                >
                  <ChevronLeft size={18} />
                </button>
              </div>

              <div className="p-4 space-y-4 overflow-y-auto custom-scrollbar flex-1">
                <div className="space-y-2">
                  <StatBar icon={<Heart size={10} />} label="HP" current={user.hp || 100} max={user.maxHp || 100} color="bg-rose-500" />
                  <StatBar icon={<Zap size={10} />} label="MP" current={user.mp || 100} max={user.maxMp || 100} color="bg-sky-500" />
                  {isSentinel && (
                    <StatBar icon={<Activity size={10} />} label="FURY" current={user.fury || 0} max={100} color={furyColor} />
                  )}
                  {isGuide && (
                    <StatBar icon={<Activity size={10} />} label="STABILITY" current={Number((user as any).guideStability ?? 100)} max={100} color={stabilityColor} />
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <InfoBox icon={<Briefcase size={12} />} label="职业" value={user.job || '无'} />
                  <InfoBox icon={<Shield size={12} />} label="派系" value={user.faction || '无'} />
                  <InfoBox icon={<Award size={12} />} label="精神" value={user.mentalRank || '-'} highlight />
                  <InfoBox icon={<Award size={12} />} label="肉体" value={user.physicalRank || '-'} highlight />
                  <InfoBox icon={<Zap size={12} />} label="侵蚀" value={`${erosionLevel.toFixed(1)}%`} />
                  <InfoBox icon={<Heart size={12} />} label="流血" value={`${bleedingLevel.toFixed(1)}%`} />
                </div>

                <div className="pt-4 border-t border-slate-700/50">
                  <div className="text-[10px] text-slate-400 uppercase font-black flex justify-between items-center mb-2">
                    <span className="flex items-center gap-1"><BookOpen size={12} /> 已习得派系技能</span>
                  </div>
                  {skills.length === 0 ? (
                    <div className="text-[10px] text-slate-500 text-center py-2 italic border border-slate-800 rounded-lg">暂未领悟任何技能</div>
                  ) : (
                    <div className="space-y-2">
                      {skills.map(s => (
                        <div key={s.id} className="bg-slate-800/80 border border-slate-700 rounded-lg p-2 flex justify-between items-center">
                          <div className="flex flex-col overflow-hidden mr-2">
                            <span className="text-xs font-bold text-slate-200 truncate">{s.name}</span>
                            <span className="text-[9px] font-black text-sky-400 uppercase mt-0.5">Lv.{s.level}</span>
                          </div>
                          <div className="flex gap-1 shrink-0">
                            <button
                              onClick={() => handleMergeSkill(s)}
                              className="p-1.5 bg-sky-900/30 text-sky-400 rounded-md hover:bg-sky-600 hover:text-white transition-colors"
                              title="同等级融合升阶"
                            >
                              <ArrowUpCircle size={14} />
                            </button>
                            <button
                              onClick={() => handleForgetSkill(s.id)}
                              className="p-1.5 bg-rose-900/30 text-rose-400 rounded-md hover:bg-rose-600 hover:text-white transition-colors"
                              title="遗忘删除"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="pt-4 border-t border-slate-700/50">
                  <div className="text-[10px] text-slate-400 uppercase font-black flex justify-between items-center mb-2">
                    <span className="flex items-center gap-1"><Package size={12} /> 我的背包</span>
                  </div>
                  {inventory.length === 0 ? (
                    <div className="text-[10px] text-slate-500 text-center py-2 italic border border-slate-800 rounded-lg">背包空空如也</div>
                  ) : (
                    <div className="space-y-2 pr-1">
                      {inventory.map(inv => (
                        <div key={inv.id} className="bg-slate-800/80 border border-slate-700 rounded-lg p-2 flex flex-col gap-2">
                          <div className="flex justify-between items-start">
                            <div className="flex flex-col mr-2 overflow-hidden">
                              <span className="text-xs font-bold text-amber-100 truncate">{inv.name}</span>
                              <span className="text-[9px] text-slate-400 mt-0.5">拥有: x{inv.qty}</span>
                            </div>
                            <span className="text-[9px] px-1.5 py-0.5 bg-slate-700 border border-slate-600 text-slate-300 rounded font-black tracking-widest shrink-0 whitespace-nowrap">
                              {inv.itemType || '未知'}
                            </span>
                          </div>

                          <div className="flex justify-end">
                            {inv.itemType === '回复道具' && (
                              <button onClick={() => handleUseItem(inv.id)} className="px-3 py-1 bg-emerald-600/20 text-emerald-400 border border-emerald-500/50 text-[10px] font-black rounded hover:bg-emerald-600 hover:text-white transition-colors">使用恢复</button>
                            )}
                            {inv.itemType === '技能书道具' && (
                              <button onClick={() => handleUseItem(inv.id)} className="px-3 py-1 bg-sky-600/20 text-sky-400 border border-sky-500/50 text-[10px] font-black rounded hover:bg-sky-600 hover:text-white transition-colors">研读领悟</button>
                            )}
                            {inv.itemType === '贵重物品' && (
                              <button onClick={() => handleUseItem(inv.id)} className="px-3 py-1 bg-amber-600/20 text-amber-400 border border-amber-500/50 text-[10px] font-black rounded hover:bg-amber-600 hover:text-white transition-colors">出售换金</button>
                            )}
                            {inv.itemType === '违禁品' && (
                              <button onClick={() => handleUseItem(inv.id)} className="px-3 py-1 bg-rose-700/20 text-rose-300 border border-rose-500/50 text-[10px] font-black rounded hover:bg-rose-600 hover:text-white transition-colors">服用违禁品</button>
                            )}
                            {inv.itemType === '任务道具' && (
                              <span className="text-[9px] text-slate-500 italic">仅限委托任务提交</span>
                            )}
                            {!inv.itemType && (
                              <span className="text-[9px] text-slate-500 italic">无法使用</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="pt-2 border-t border-slate-700">
                  <div className="flex justify-between items-center text-xs text-slate-400 mb-2">
                    <span>资产</span>
                    <span className="text-amber-400 font-mono font-black text-sm">{user.gold} G</span>
                  </div>
                </div>

                <button
                  onClick={onLogout}
                  className="w-full py-2 bg-slate-800 text-slate-400 rounded-lg text-xs font-bold hover:bg-rose-900/30 hover:text-rose-400 transition-colors flex items-center justify-center gap-2"
                >
                  <Skull size={14} /> 断开连接
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="collapsed"
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.5, opacity: 0 }}
              onClick={() => setIsExpanded(true)}
              className="bg-slate-900/80 backdrop-blur-md border border-slate-600 rounded-full p-1.5 pr-4 flex items-center gap-3 cursor-pointer hover:bg-slate-800 hover:border-sky-500 shadow-xl transition-all group"
            >
              <div className="w-10 h-10 rounded-full bg-slate-700 overflow-hidden border-2 border-slate-600 group-hover:border-sky-400 transition-colors shrink-0">
                {localAvatarUrl ? (
                  <img src={localAvatarUrl} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-white font-bold">{user.name[0]}</div>
                )}
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); setShowProfileModal(true); }}
                className="flex flex-col text-left"
              >
                <span className="text-xs font-black text-white truncate max-w-[80px] underline decoration-dotted underline-offset-2">{user.name}</span>
                <div className="flex gap-1 h-1 w-12 mt-1 bg-slate-700 rounded-full overflow-hidden">
                  <div className="h-full bg-rose-500 rounded-full" style={{ width: `${Math.max(0, Math.min(100, hpPct))}%` }}></div>
                </div>
              </button>
              <ChevronRight size={14} className="text-slate-500" />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      <AnimatePresence>
        {showProfileModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setShowProfileModal(false)}
          >
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 20, opacity: 0 }}
              className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl p-5"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-white font-black text-lg mb-4">角色详细信息</h3>

              <div className="space-y-2 text-sm mb-4">
                <div className="text-slate-300">姓名：{user.name}</div>
                <div className="text-slate-300">年龄：{user.age}</div>
                <div className="text-slate-300">身份：{user.role || '无'}</div>
                <div className="text-slate-300">职位：{user.job || '无'}</div>
                <div className="text-slate-300">派系：{user.faction || '无'}</div>
                <div className="text-slate-300">精神/肉体：{user.mentalRank || '-'} / {user.physicalRank || '-'}</div>
                <div className="text-slate-300">金币：{user.gold} G</div>
              </div>

              <div className="border-t border-slate-700 pt-4 space-y-3">
                <label className="text-xs text-slate-400 font-bold">头像 URL</label>
                <input
                  value={avatarDraft}
                  onChange={(e) => setAvatarDraft(e.target.value)}
                  placeholder="粘贴图片链接或上传"
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-slate-200 text-sm outline-none focus:border-sky-500"
                />

                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleAvatarFile(e.target.files?.[0])}
                  className="w-full text-xs text-slate-400"
                />

                <div className="flex gap-2">
                  <button
                    onClick={handleSaveAvatar}
                    disabled={savingAvatar}
                    className="flex-1 py-2 rounded-lg bg-sky-600 text-white text-sm font-bold hover:bg-sky-500 disabled:opacity-60"
                  >
                    {savingAvatar ? '保存中...' : '保存头像'}
                  </button>
                  <button
                    onClick={() => setShowProfileModal(false)}
                    className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 text-sm font-bold hover:bg-slate-700"
                  >
                    关闭
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function StatBar({ icon, label, current, max, color }: any) {
  const pct = Math.min(100, Math.max(0, (current / Math.max(1, max)) * 100));
  return (
    <div>
      <div className="flex justify-between text-[9px] font-black text-slate-500 uppercase mb-0.5 items-center">
        <span className="flex items-center gap-1">{icon} {label}</span>
        <span>{current}/{max}</span>
      </div>
      <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden border border-slate-700/50">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          className={`h-full ${color}`}
        />
      </div>
    </div>
  );
}

function InfoBox({ icon, label, value, highlight }: any) {
  return (
    <div className="bg-slate-800/50 rounded-lg p-2 border border-slate-700 flex flex-col items-center justify-center text-center">
      <span className="text-[9px] text-slate-500 uppercase flex items-center gap-1 mb-1">{icon} {label}</span>
      <span className={`font-black ${highlight ? 'text-sky-400' : 'text-slate-200'} truncate w-full`}>{value}</span>
    </div>
  );
}

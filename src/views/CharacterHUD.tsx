import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { User } from '../types';
import {
  Activity,
  ArrowUpCircle,
  Award,
  BookOpen,
  Briefcase,
  ChevronLeft,
  ChevronRight,
  Heart,
  ImagePlus,
  MapPin,
  Package,
  Shield,
  Skull,
  Trash2,
  Users,
  Zap,
} from 'lucide-react';

interface Props {
  user: User;
  onLogout: () => void;
  onRefresh?: () => void;
  currentLocationName?: string;
  onlineCount?: number;
}

interface SkillRow {
  id: number;
  skillId?: number;
  name: string;
  level: number;
}

interface InventoryRow {
  id: number;
  name: string;
  qty: number;
  itemType?: string;
}

const NONE_LABEL = '无';

function isSentinelRole(role?: string) {
  const value = String(role || '').trim().toLowerCase();
  return value === 'sentinel' || String(role || '').trim() === '哨兵';
}

function isGuideRole(role?: string) {
  const value = String(role || '').trim().toLowerCase();
  return value === 'guide' || String(role || '').trim() === '向导';
}

function itemActionLabel(itemType?: string) {
  const value = String(itemType || '').trim();
  if (value === '回复道具') return '使用恢复';
  if (value === '技能书道具' || value === 'skill_book') return '研读领悟';
  if (value === '贵重物品') return '出售换金';
  if (value === '违禁品') return '使用违禁品';
  return '';
}

export function CharacterHUD({ user, onLogout, onRefresh, currentLocationName, onlineCount }: Props) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [skills, setSkills] = useState<SkillRow[]>([]);
  const [inventory, setInventory] = useState<InventoryRow[]>([]);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [avatarDraft, setAvatarDraft] = useState(user.avatarUrl || '');
  const [localAvatarUrl, setLocalAvatarUrl] = useState(user.avatarUrl || '');
  const [savingAvatar, setSavingAvatar] = useState(false);
  const viewportRef = useRef<HTMLDivElement | null>(null);

  const avatarCacheKey = `avatar_cache_${user.id}`;
  const userAge = Number(user.age || 0);
  const isChild = userAge > 0 && userAge < 16;
  const isSentinel = isSentinelRole(user.role);
  const isGuide = isGuideRole(user.role);
  const hp = Math.max(0, Number(user.hp || 0));
  const maxHp = Math.max(1, Number(user.maxHp || 100));
  const mp = Math.max(0, Number(user.mp || 0));
  const maxMp = Math.max(1, Number(user.maxMp || 100));
  const fury = Math.max(0, Number(user.fury || 0));
  const guideStability = Math.max(0, Number((user as any).guideStability ?? 100));
  const erosionLevel = Math.max(0, Number((user as any).erosionLevel ?? 0));
  const bleedingLevel = Math.max(0, Number((user as any).bleedingLevel ?? 0));

  const displayRole = isChild ? '未成年' : user.role || '未分化';
  const displayJob = user.job || NONE_LABEL;
  const displayFaction = user.faction || NONE_LABEL;
  const displayLocation = currentLocationName || user.currentLocation || '未知区域';
  const avatarInitial = String(user.name || '?')[0] || '?';
  const hpPct = Math.max(0, Math.min(100, (hp / maxHp) * 100));
  const mpPct = Math.max(0, Math.min(100, (mp / maxMp) * 100));
  const summaryBadges = useMemo(
    () => [
      { icon: <MapPin size={11} />, label: displayLocation },
      { icon: <Users size={11} />, label: `${Math.max(0, Number(onlineCount || 0))} 在线` },
    ],
    [displayLocation, onlineCount]
  );

  useEffect(() => {
    if (user.avatarUrl) {
      setLocalAvatarUrl(user.avatarUrl);
      setAvatarDraft(user.avatarUrl);
      localStorage.setItem(avatarCacheKey, user.avatarUrl);
      return;
    }
    const cached = localStorage.getItem(avatarCacheKey) || '';
    setLocalAvatarUrl(cached);
    setAvatarDraft(cached);
  }, [avatarCacheKey, user.avatarUrl]);

  const fetchSkills = async () => {
    try {
      const res = await fetch(`/api/users/${user.id}/skills`, { cache: 'no-store' });
      const data = await res.json().catch(() => ({} as any));
      if (data.success) setSkills(Array.isArray(data.skills) ? data.skills : []);
    } catch (error) {
      console.error('Failed to fetch skills', error);
    }
  };

  const fetchInventory = async () => {
    try {
      const res = await fetch(`/api/users/${user.id}/inventory`, { cache: 'no-store' });
      const data = await res.json().catch(() => ({} as any));
      if (data.success) setInventory(Array.isArray(data.items) ? data.items : []);
    } catch (error) {
      console.error('Failed to fetch inventory', error);
    }
  };

  useEffect(() => {
    fetchSkills();
    fetchInventory();
    const timer = window.setInterval(() => {
      fetchSkills();
      fetchInventory();
    }, 10000);
    return () => window.clearInterval(timer);
  }, [user.id]);

  const handleMergeSkill = async (row: SkillRow) => {
    try {
      const mate = skills.find(
        (skill) =>
          Number(skill.id) !== Number(row.id) &&
          (Number(skill.skillId || 0) === Number(row.skillId || 0) || String(skill.name || '') === String(row.name || ''))
      );
      if (!mate) {
        window.alert('没有可合并的同名或同技能条目。');
        return;
      }

      const res = await fetch(`/api/users/${user.id}/skills/merge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skillAId: row.id, skillBId: mate.id }),
      });
      const data = await res.json().catch(() => ({} as any));
      window.alert(data.message || '技能融合完成');
      if (data.success) fetchSkills();
    } catch (error) {
      console.error(error);
    }
  };

  const handleForgetSkill = async (skillId: number) => {
    if (!window.confirm('遗忘后技能将永久消失，且不会返还技能书，确定吗？')) return;
    try {
      await fetch(`/api/users/${user.id}/skills/${skillId}`, { method: 'DELETE' });
      fetchSkills();
    } catch (error) {
      console.error(error);
    }
  };

  const handleUseItem = async (inventoryId: number) => {
    try {
      const res = await fetch('/api/inventory/use', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, inventoryId }),
      });
      const data = await res.json().catch(() => ({} as any));
      window.alert(data.message || '道具已使用');
      if (data.success) {
        fetchInventory();
        fetchSkills();
        onRefresh?.();
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleAvatarFile = (file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      setAvatarDraft(String(event.target?.result || ''));
    };
    reader.readAsDataURL(file);
  };

  const handleSaveAvatar = async () => {
    if (!avatarDraft.trim()) {
      window.alert('请先输入头像链接或上传图片。');
      return;
    }

    setSavingAvatar(true);
    try {
      const res = await fetch(`/api/users/${user.id}/avatar`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ avatarUrl: avatarDraft }),
      });
      const data = await res.json().catch(() => ({} as any));
      if (!res.ok || data.success === false) {
        window.alert(data.message || '头像保存失败');
        return;
      }
      setLocalAvatarUrl(avatarDraft);
      localStorage.setItem(avatarCacheKey, avatarDraft);
      onRefresh?.();
      window.alert('头像保存成功');
    } catch (error) {
      console.error(error);
      window.alert('头像保存失败（网络错误）');
    } finally {
      setSavingAvatar(false);
    }
  };

  const warningText = isSentinel
    ? fury >= 80
      ? '狂暴值已过高，请尽快前往圣所治疗。'
      : fury >= 60
        ? '狂暴值处于危险边缘，建议减少刺激并寻找向导或圣所。'
        : ''
    : isGuide
      ? guideStability <= 20
        ? '精神稳定值过低，必须前往圣所恢复。'
        : guideStability <= 40
          ? '精神稳定值偏低，请留意抚慰消耗。'
          : ''
      : '';

  return (
    <>
      <div ref={viewportRef} className="fixed inset-0 z-40 overflow-hidden pointer-events-none" />

      <motion.div
        drag
        dragMomentum={false}
        dragElastic={0}
        dragConstraints={viewportRef}
        initial={{ x: 16, y: 16 }}
        className="fixed left-0 top-0 z-[100] pointer-events-auto"
      >
        <AnimatePresence mode="wait">
          {isExpanded ? (
            <motion.div
              key="expanded"
              initial={{ opacity: 0, scale: 0.92, width: 88 }}
              animate={{ opacity: 1, scale: 1, width: 336 }}
              exit={{ opacity: 0, scale: 0.92 }}
              className="theme-elevated-surface flex max-h-[82vh] flex-col overflow-hidden rounded-[2rem] mobile-portrait-safe-hud"
            >
              <div className="border-b border-slate-700 bg-slate-800/70 p-4 cursor-move">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        setShowProfileModal(true);
                      }}
                      className="h-14 w-14 shrink-0 overflow-hidden rounded-2xl border border-slate-600 bg-slate-700"
                      title="点击查看头像和详细资料"
                    >
                      {localAvatarUrl ? (
                        <img src={localAvatarUrl} className="h-full w-full object-cover" alt="avatar" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-lg font-black text-white">{avatarInitial}</div>
                      )}
                    </button>
                    <div className="min-w-0">
                      <button
                        onClick={() => setShowProfileModal(true)}
                        className="block max-w-full truncate text-left text-base font-black text-white underline decoration-dotted underline-offset-2"
                      >
                        {user.name}
                      </button>
                      <div className="mt-1 text-xs font-bold uppercase text-sky-300">
                        {userAge || 0} 岁 · {displayRole}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {summaryBadges.map((badge) => (
                          <div
                            key={badge.label}
                            className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-900 px-2.5 py-1 text-[11px] text-slate-300"
                          >
                            {badge.icon}
                            <span className="max-w-[10rem] truncate">{badge.label}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => setIsExpanded(false)}
                    className="rounded-xl bg-slate-900/80 p-2 text-slate-400 hover:bg-slate-700 hover:text-white"
                  >
                    <ChevronLeft size={18} />
                  </button>
                </div>
              </div>

              <div className="flex-1 space-y-4 overflow-y-auto p-4 custom-scrollbar">
                <div className="grid gap-2">
                  <StatBar icon={<Heart size={11} />} label="生命" current={hp} max={maxHp} color="bg-rose-500" />
                  <StatBar icon={<Zap size={11} />} label="精神" current={mp} max={maxMp} color="bg-sky-500" />
                  {isSentinel && <StatBar icon={<Activity size={11} />} label="狂暴" current={fury} max={100} color={fury >= 80 ? 'bg-red-600 animate-pulse' : 'bg-fuchsia-500'} />}
                  {isGuide && <StatBar icon={<Activity size={11} />} label="稳定" current={guideStability} max={100} color={guideStability <= 20 ? 'bg-rose-600 animate-pulse' : 'bg-emerald-500'} />}
                </div>

                {warningText && (
                  <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs leading-6 text-amber-100">
                    {warningText}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <MetricCard icon={<Briefcase size={13} />} label="职位" value={displayJob} />
                  <MetricCard icon={<Shield size={13} />} label="阵营" value={displayFaction} />
                  <MetricCard icon={<Award size={13} />} label="精神" value={user.mentalRank || '-'} highlight />
                  <MetricCard icon={<Award size={13} />} label="肉体" value={user.physicalRank || '-'} highlight />
                  <MetricCard icon={<Zap size={13} />} label="侵蚀" value={`${erosionLevel.toFixed(1)}%`} />
                  <MetricCard icon={<Heart size={13} />} label="流血" value={`${bleedingLevel.toFixed(1)}%`} />
                </div>

                <Section title="技能库" icon={<BookOpen size={13} />}>
                  {skills.length === 0 ? (
                    <EmptyHint text="暂未领悟任何技能" />
                  ) : (
                    <div className="space-y-2">
                      {skills.map((skill) => (
                        <div key={skill.id} className="rounded-2xl border border-slate-700 bg-slate-800/80 p-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="truncate text-sm font-bold text-slate-100">{skill.name}</div>
                              <div className="mt-1 text-[11px] font-black text-sky-400">等级 {skill.level}</div>
                            </div>
                            <div className="flex shrink-0 gap-1">
                              <IconButton title="融合升级" onClick={() => handleMergeSkill(skill)} tone="sky">
                                <ArrowUpCircle size={14} />
                              </IconButton>
                              <IconButton title="遗忘删除" onClick={() => handleForgetSkill(skill.id)} tone="rose">
                                <Trash2 size={14} />
                              </IconButton>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </Section>

                <Section title="我的背包" icon={<Package size={13} />}>
                  {inventory.length === 0 ? (
                    <EmptyHint text="背包空空如也" />
                  ) : (
                    <div className="space-y-2">
                      {inventory.map((item) => {
                        const actionLabel = itemActionLabel(item.itemType);
                        return (
                          <div key={item.id} className="rounded-2xl border border-slate-700 bg-slate-800/80 p-3">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <div className="truncate text-sm font-bold text-amber-100">{item.name}</div>
                                <div className="mt-1 text-[11px] text-slate-400">拥有：x{item.qty}</div>
                              </div>
                              <span className="rounded-full border border-slate-600 bg-slate-700 px-2 py-1 text-[10px] font-black text-slate-200">
                                {item.itemType || '未知'}
                              </span>
                            </div>
                            <div className="mt-3 flex justify-end">
                              {actionLabel ? (
                                <button
                                  onClick={() => handleUseItem(item.id)}
                                  className="rounded-xl border border-emerald-500/40 bg-emerald-500/15 px-3 py-1.5 text-[11px] font-black text-emerald-300 hover:bg-emerald-500 hover:text-white"
                                >
                                  {actionLabel}
                                </button>
                              ) : (
                                <span className="text-[11px] italic text-slate-500">无法直接使用</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </Section>

                <div className="rounded-2xl border border-slate-700 bg-slate-950 p-4">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>当前资产</span>
                    <span className="text-base font-black text-amber-400">{user.gold} G</span>
                  </div>
                </div>

                <button
                  onClick={onLogout}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-800 py-2.5 text-sm font-black text-slate-300 hover:bg-rose-900/40 hover:text-rose-300"
                >
                  <Skull size={14} />
                  断开连接
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.button
              key="collapsed"
              type="button"
              initial={{ scale: 0.75, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.75, opacity: 0 }}
              onClick={() => setIsExpanded(true)}
              className="theme-elevated-surface flex w-[78px] flex-col items-center gap-2 rounded-[1.5rem] px-2.5 py-3 text-center transition-all hover:-translate-y-0.5 hover:border-sky-400/60"
              title="点击展开角色面板"
            >
              <div className="relative h-12 w-12 overflow-hidden rounded-2xl border border-slate-600 bg-slate-700">
                {localAvatarUrl ? (
                  <img src={localAvatarUrl} className="h-full w-full object-cover" alt="avatar" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-base font-black text-white">{avatarInitial}</div>
                )}
                <span className="absolute -right-1 -top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-sky-600 px-1 text-[9px] font-black text-white">
                  {Math.max(0, Number(onlineCount || 0))}
                </span>
              </div>
              <div className="w-full truncate text-[11px] font-black text-slate-100">{user.name}</div>
              <div className="w-full truncate text-[10px] text-slate-400">{displayRole}</div>
              <div className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-800/80 px-2 py-1 text-[10px] font-black text-slate-200">
                <ChevronRight size={11} /> 展开
              </div>
            </motion.button>
          )}
        </AnimatePresence>
      </motion.div>

      <AnimatePresence>
        {showProfileModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[140] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm mobile-portrait-safe-overlay"
            onClick={() => setShowProfileModal(false)}
          >
            <motion.div
              initial={{ y: 24, scale: 0.96, opacity: 0 }}
              animate={{ y: 0, scale: 1, opacity: 1 }}
              exit={{ y: 24, scale: 0.96, opacity: 0 }}
              onClick={(event) => event.stopPropagation()}
              className="theme-elevated-surface w-full max-w-2xl overflow-hidden rounded-[2rem] mobile-portrait-safe-card"
            >
              <div className="border-b border-slate-700 px-5 py-4">
                <div className="text-lg font-black text-white">角色详情</div>
                <div className="text-sm text-slate-400">点击头像可上传或替换，修改后会同步到互动窗口和地图悬浮头像。</div>
              </div>

              <div className="grid gap-6 p-5 md:grid-cols-[220px_minmax(0,1fr)]">
                <div className="space-y-3">
                  <div className="overflow-hidden rounded-[1.5rem] border border-slate-700 bg-slate-800">
                    {localAvatarUrl || avatarDraft ? (
                      <img src={avatarDraft || localAvatarUrl} className="h-56 w-full object-cover" alt="avatar preview" />
                    ) : (
                      <div className="flex h-56 w-full items-center justify-center text-5xl font-black text-slate-500">{avatarInitial}</div>
                    )}
                  </div>

                  <label className="block text-xs font-black text-slate-400">
                    <span className="mb-1.5 block">头像链接</span>
                    <input
                      value={avatarDraft}
                      onChange={(event) => setAvatarDraft(event.target.value)}
                      className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-sky-500"
                      placeholder="https://... 或 data:image/..."
                    />
                  </label>

                  <label className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm font-black text-slate-200 hover:bg-slate-700">
                    <ImagePlus size={14} />
                    上传头像图片
                    <input type="file" accept="image/*" className="hidden" onChange={(event) => handleAvatarFile(event.target.files?.[0])} />
                  </label>

                  <button
                    onClick={handleSaveAvatar}
                    disabled={savingAvatar}
                    className="w-full rounded-2xl bg-sky-600 px-4 py-2.5 text-sm font-black text-white hover:bg-sky-500 disabled:opacity-60"
                  >
                    {savingAvatar ? '保存中…' : '保存头像'}
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <div className="text-2xl font-black text-white">{user.name}</div>
                    <div className="mt-1 text-sm text-slate-400">
                      {userAge || 0} 岁 · {displayRole}
                      {displayFaction !== NONE_LABEL ? ` · ${displayFaction}` : ''}
                      {displayJob !== NONE_LABEL ? ` · ${displayJob}` : ''}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <MetricCard icon={<MapPin size={13} />} label="当前位置" value={displayLocation} />
                    <MetricCard icon={<Users size={13} />} label="在线人数" value={`${Math.max(0, Number(onlineCount || 0))}`} />
                    <MetricCard icon={<Award size={13} />} label="精神等级" value={user.mentalRank || '-'} highlight />
                    <MetricCard icon={<Award size={13} />} label="肉体等级" value={user.physicalRank || '-'} highlight />
                    <MetricCard icon={<Shield size={13} />} label="专属能力" value={user.ability || NONE_LABEL} />
                    <MetricCard icon={<Activity size={13} />} label="精神体名称" value={user.spiritName || NONE_LABEL} />
                  </div>

                  <div className="rounded-2xl border border-slate-700 bg-slate-950 p-4">
                    <div className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">角色资料</div>
                    <div className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-200">
                      {user.profileText?.trim() || '暂无资料'}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-700 bg-slate-950 p-4">
                    <div className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">状态摘要</div>
                    <div className="mt-3 space-y-2">
                      <MiniInfo label="生命值" value={`${hp}/${maxHp}`} />
                      <MiniInfo label="精神值" value={`${mp}/${maxMp}`} />
                      {isSentinel && <MiniInfo label="狂暴值" value={`${fury}/100`} danger={fury >= 80} />}
                      {isGuide && <MiniInfo label="稳定值" value={`${guideStability}/100`} danger={guideStability <= 20} />}
                      <MiniInfo label="金币" value={`${user.gold} G`} />
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function Section({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return (
    <section>
      <div className="mb-2 flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">
        {icon}
        {title}
      </div>
      {children}
    </section>
  );
}

function StatBar({ icon, label, current, max, color }: { icon: ReactNode; label: string; current: number; max: number; color: string }) {
  const pct = Math.max(0, Math.min(100, (current / Math.max(1, max)) * 100));
  return (
    <div className="rounded-2xl border border-slate-700 bg-slate-950 p-3">
      <div className="mb-2 flex items-center justify-between text-[11px] font-black text-slate-300">
        <span className="inline-flex items-center gap-1">{icon}{label}</span>
        <span>{current}/{max}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-800">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function MiniBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-7 shrink-0 text-[10px] font-black text-slate-400">{label}</span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-800">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
      </div>
    </div>
  );
}

function MetricCard({ icon, label, value, highlight = false }: { icon: ReactNode; label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-2xl border p-3 ${highlight ? 'border-sky-500/30 bg-sky-500/10' : 'border-slate-700 bg-slate-950'}`}>
      <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">
        {icon}
        {label}
      </div>
      <div className={`mt-2 truncate text-sm font-bold ${highlight ? 'text-sky-100' : 'text-slate-100'}`}>{value}</div>
    </div>
  );
}

function EmptyHint({ text }: { text: string }) {
  return <div className="rounded-2xl border border-slate-800 bg-slate-950 px-3 py-4 text-center text-xs italic text-slate-500">{text}</div>;
}

function IconButton({ title, onClick, tone, children }: { title: string; onClick: () => void; tone: 'sky' | 'rose'; children: ReactNode }) {
  const className = tone === 'sky'
    ? 'bg-sky-500/15 text-sky-300 hover:bg-sky-500 hover:text-white'
    : 'bg-rose-500/15 text-rose-300 hover:bg-rose-500 hover:text-white';
  return (
    <button onClick={onClick} title={title} className={`rounded-xl p-2 transition-colors ${className}`}>
      {children}
    </button>
  );
}

function MiniInfo({ label, value, danger = false }: { label: string; value: string; danger?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-slate-400">{label}</span>
      <span className={danger ? 'font-black text-rose-300' : 'font-bold text-slate-100'}>{value}</span>
    </div>
  );
}

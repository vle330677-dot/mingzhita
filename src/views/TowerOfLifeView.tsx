import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft,
  BookOpen,
  MapPin,
  Megaphone,
  RefreshCw,
  Send,
  Shield,
  Sparkles,
  Trophy,
  UserPlus,
  X
} from 'lucide-react';
import { User } from '../types';
import FactionMemberPanel from './shared/FactionMemberPanel';
import {
  type DifferentiationData,
  generateDifferentiationData,
  isSentinelOrGuide,
  MAX_DIFFERENTIATION_DRAWS,
  NONE,
  ROLE_UNDIFF,
} from '../utils/differentiation';

interface Props {
  user: User;
  onExit: () => void;
  showToast: (msg: string) => void;
  fetchGlobalData: () => void;
}

interface TowerPoint {
  id: 'announcement_hall' | 'administration' | 'recruitment_office' | 'skill_library' | 'training_ground' | 'leaderboard';
  name: string;
  x: number;
  y: number;
  icon: React.ReactNode;
  desc: string;
}

interface JoinOption {
  jobName: string;
  minMental: string;
  description: string;
}

interface LeaderboardRule {
  label: string;
  jobs: string[];
}

interface AnnouncementRow {
  id?: number | string;
  title?: string;
  content?: string;
  createdAt?: string;
  created_at?: string;
}

const TOWER_POINTS: TowerPoint[] = [
  { id: 'announcement_hall', name: '公告厅', x: 20, y: 32, icon: <Megaphone size={26} />, desc: '查看近期公告，并向管理员后台留言。' },
  { id: 'administration', name: '圣谕行政厅', x: 50, y: 26, icon: <Shield size={26} />, desc: '查看命之塔职位规则、成员房间与三塔授权状态。' },
  { id: 'recruitment_office', name: '入塔申请处', x: 80, y: 32, icon: <UserPlus size={26} />, desc: '申请加入命之塔职位，或对高位职位发起挑战。' },
  { id: 'skill_library', name: '精神系技能库', x: 24, y: 62, icon: <BookOpen size={26} />, desc: '学习精神系技能与能力成长。' },
  { id: 'training_ground', name: '精神训练场', x: 76, y: 62, icon: <Sparkles size={26} />, desc: '进行新手分化、精神训练与入塔指引。' },
  { id: 'leaderboard', name: '最高位议事台', x: 50, y: 80, icon: <Trophy size={26} />, desc: '查看当前各阵营最高位。' },
];

const TOWER_JOIN_OPTIONS: JoinOption[] = [
  { jobName: '仆从', minMental: 'C+', description: '命之塔基层职位，可进入塔内服务与值守。' },
  { jobName: '侍奉者', minMental: 'B+', description: '负责塔内事务、素材筛选与协助管理。' },
  { jobName: '候选者', minMental: 'S+', description: '高位候补，可参与命之塔核心事务。' },
  { jobName: '圣子', minMental: 'SS+', description: '命之塔最高位之一。若已有现任，可发起职位挑战。' },
  { jobName: '圣女', minMental: 'SS+', description: '命之塔最高位之一。若已有现任，可发起职位挑战。' },
];

const TOWER_ALL_JOBS = ['圣子', '圣女', '候选者', '侍奉者', '仆从', '神使', '神使后裔'];

const TOWER_RANK_ORDER = ['无', 'F', 'E', 'D', 'D+', 'C', 'C+', 'B', 'B+', 'A', 'A+', 'S', 'S+', 'SS', 'SS+', 'SSS'];

const LEADERBOARD_RULES: LeaderboardRule[] = [
  { label: '命之塔最高位', jobs: ['圣子', '圣女', '候选者'] },
  { label: '伦敦塔最高位', jobs: ['伦敦塔教师'] },
  { label: '灵异管理所最高位', jobs: ['灵异管理所所长'] },
  { label: '公会最高位', jobs: ['公会会长'] },
  { label: '军队最高位', jobs: ['军队将官'] },
  { label: '守塔会最高位', jobs: ['守塔会会长'] },
  { label: '观察者最高位', jobs: ['观察者首领'] },
  { label: '恶魔会最高位', jobs: ['恶魔会会长'] },
  { label: '西市市长', jobs: ['西区市长'] },
  { label: '东市市长', jobs: ['东区市长'] },
];

const TOWER_ROLE_LIMITS = [
  '圣子 / 圣女：精神力 SS+ 起步。',
  '候选者：精神力 S+ 起步。',
  '侍奉者：精神力 B+ 起步。',
  '仆从：精神力 C+ 起步。',
];

const DELEGATION_STATUS_TEXT: Record<string, string> = {
  none: '当前未授权守塔会接管三塔管理。',
  pending: '守塔会的接管申请正在等待圣子 / 圣女审批。',
  approved: '守塔会已被授权接管三塔管理。',
  rejected: '守塔会的接管申请已被驳回。',
  revoked: '守塔会的三塔管理授权已被收回。',
};

const NEWCOMER_OPENING_NOTICE = {
  title: '命之塔开塔告示',
  intro: '欢迎来到命之塔。这里不是单纯比谁起步更快，而是看谁愿意多走一步。',
  lines: [
    '如果你刚进入世界，不需要急着变强，先熟悉地图、阵营和身份规则。',
    '命之塔适合精神系成长、身份分化与高位职位竞争。',
    '遇到不明白的地方，可以先看公告，也可以直接给管理员后台留言。',
    '剧情、对戏、探索和成长都很重要，稳定推进比盲目冲刺更有价值。',
  ],
  outro: '愿你在命之塔留下属于自己的名字，也留下值得回想的故事。',
};

const authHeaders = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${localStorage.getItem('USER_TOKEN') || ''}`,
});

const rankScore = (rankRaw: unknown) => {
  const normalized = String(rankRaw || '无').trim() || '无';
  const idx = TOWER_RANK_ORDER.indexOf(normalized);
  return idx >= 0 ? idx : 0;
};

const formatAnnouncementTime = (row: AnnouncementRow) => String(row.createdAt || row.created_at || '-');

export function TowerOfLifeView({ user, onExit, showToast, fetchGlobalData }: Props) {
  const [selectedPoint, setSelectedPoint] = useState<TowerPoint['id'] | null>(null);
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const [allPlayers, setAllPlayers] = useState<any[]>([]);
  const [mentalSkills, setMentalSkills] = useState<any[]>([]);
  const [announcements, setAnnouncements] = useState<AnnouncementRow[]>([]);
  const [announcementBusy, setAnnouncementBusy] = useState(false);
  const [contactDraft, setContactDraft] = useState({ title: '', content: '' });
  const [joinBusy, setJoinBusy] = useState(false);
  const [delegationStatus, setDelegationStatus] = useState('none');
  const [delegationMeta, setDelegationMeta] = useState<any>(null);
  const [delegationBusy, setDelegationBusy] = useState(false);
  const [drawCount, setDrawCount] = useState(0);
  const [drawHistory, setDrawHistory] = useState<DifferentiationData[]>([]);
  const [currentDraw, setCurrentDraw] = useState<DifferentiationData | null>(null);
  const [finalDraw, setFinalDraw] = useState<DifferentiationData | null>(null);
  const [showDrawHistoryModal, setShowDrawHistoryModal] = useState(false);
  const [showSpiritModal, setShowSpiritModal] = useState(false);
  const [spiritView, setSpiritView] = useState<'question' | 'input'>('question');
  const [customSpirit, setCustomSpirit] = useState('');
  const [growthBusy, setGrowthBusy] = useState(false);
  const [enrollStudentAfterDiff, setEnrollStudentAfterDiff] = useState(false);

  const currentJob = String(user.job || '').trim();
  const isTowerGovernor = currentJob === '圣子' || currentJob === '圣女';
  const isTowerMember = TOWER_ALL_JOBS.includes(currentJob);
  const isUndifferentiatedStage = Number(user.age || 0) < 16 || [ROLE_UNDIFF, '未分化'].includes(String(user.role || '').trim());
  const selectedPointMeta = TOWER_POINTS.find((point) => point.id === selectedPoint) || null;

  const leaderRows = useMemo(() => {
    return LEADERBOARD_RULES.map((rule) => {
      const leader = allPlayers.find((row: any) => rule.jobs.includes(String(row?.job || '').trim()));
      return { label: rule.label, leader: leader?.name || '空缺' };
    });
  }, [allPlayers]);

  const loadPresence = async (silent = true) => {
    try {
      const res = await fetch('/api/world/presence', { cache: 'no-store' });
      const data = await res.json().catch(() => ({} as any));
      if (!res.ok || data.success === false) {
        if (!silent) showToast(data.message || '读取在线玩家失败');
        return;
      }
      setAllPlayers(Array.isArray(data.players) ? data.players : []);
    } catch {
      if (!silent) showToast('网络异常，读取在线玩家失败');
    }
  };

  const loadMentalSkills = async (silent = true) => {
    try {
      const res = await fetch(`/api/skills/available/${user.id}`, { cache: 'no-store' });
      const data = await res.json().catch(() => ({} as any));
      if (!res.ok || data.success === false) {
        if (!silent) showToast(data.message || '读取技能库失败');
        return;
      }
      const rows = Array.isArray(data.skills) ? data.skills : [];
      setMentalSkills(rows.filter((row: any) => String(row.faction || '').trim() === '精神系'));
    } catch {
      if (!silent) showToast('网络异常，读取技能库失败');
    }
  };

  const loadAnnouncements = async (silent = false) => {
    if (!silent) setAnnouncementBusy(true);
    try {
      const res = await fetch('/api/announcements?limit=12', { cache: 'no-store' });
      const data = await res.json().catch(() => ({} as any));
      if (!res.ok || data.success === false) {
        if (!silent) showToast(data.message || '读取公告失败');
        return;
      }
      const rows = Array.isArray(data.announcements)
        ? data.announcements
        : Array.isArray(data.rows)
          ? data.rows
          : [];
      setAnnouncements(rows);
    } catch {
      if (!silent) showToast('网络异常，读取公告失败');
    } finally {
      if (!silent) setAnnouncementBusy(false);
    }
  };

  const pullDelegationStatus = async (silent = true) => {
    try {
      const res = await fetch(`/api/faction/delegation/status?userId=${user.id}`, { cache: 'no-store' });
      const data = await res.json().catch(() => ({} as any));
      if (!res.ok || data.success === false) {
        if (!silent) showToast(data.message || '读取三塔授权状态失败');
        return;
      }
      const row = data.delegation || {};
      setDelegationStatus(String(row.status || 'none'));
      setDelegationMeta(row);
    } catch {
      if (!silent) showToast('网络异常，读取三塔授权状态失败');
    }
  };

  useEffect(() => {
    loadPresence(true);
    loadMentalSkills(true);
    const timer = window.setInterval(() => loadPresence(true), 15000);
    return () => window.clearInterval(timer);
  }, [user.id]);

  useEffect(() => {
    const uid = String(user.id || '');
    if (!uid) return;
    const triggerKey = `tower_newcomer_welcome_trigger_${uid}`;
    const seenKey = `tower_newcomer_welcome_seen_${uid}`;
    const shouldShow = sessionStorage.getItem(triggerKey) === '1' && localStorage.getItem(seenKey) !== '1';
    if (!shouldShow) return;
    setShowWelcomeModal(true);
    sessionStorage.removeItem(triggerKey);
    localStorage.setItem(seenKey, '1');
  }, [user.id]);

  useEffect(() => {
    const uid = String(user.id || '');
    if (!uid) return;
    const jumpKey = `tower_open_differentiation_${uid}`;
    if (sessionStorage.getItem(jumpKey) !== '1') return;
    sessionStorage.removeItem(jumpKey);
    setSelectedPoint('training_ground');
    showToast('已为你打开精神训练场，可以进行“抽 10 次后选 1 次”的分化。');
  }, [user.id, showToast]);

  useEffect(() => {
    if (selectedPoint === 'announcement_hall') loadAnnouncements(true);
    if (selectedPoint === 'leaderboard') loadPresence(true);
    if (selectedPoint === 'skill_library') loadMentalSkills(true);
    if (selectedPoint === 'administration') {
      loadPresence(true);
      pullDelegationStatus(true);
    }
  }, [selectedPoint, user.id]);

  const reviewDelegation = async (action: 'approve' | 'reject' | 'revoke') => {
    if (!isTowerGovernor) return;
    setDelegationBusy(true);
    try {
      const res = await fetch('/api/faction/delegation/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewerId: user.id, action }),
      });
      const data = await res.json().catch(() => ({} as any));
      if (!res.ok || data.success === false) {
        showToast(data.message || '审批失败');
        return;
      }
      showToast(data.message || '审批完成');
      pullDelegationStatus(true);
      fetchGlobalData();
    } catch {
      showToast('网络异常，审批失败');
    } finally {
      setDelegationBusy(false);
    }
  };

  const handleTowerJoin = async (jobName: string) => {
    const option = TOWER_JOIN_OPTIONS.find((item) => item.jobName === jobName);
    if (!option) return;

    if (rankScore(user.mentalRank) < rankScore(option.minMental)) {
      showToast(`精神力不足，加入 ${jobName} 需要达到 ${option.minMental}`);
      return;
    }

    const attemptJoin = async (minorConfirm: boolean) => {
      const res = await fetch('/api/tower/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, jobName, minorConfirm }),
      });
      const data = await res.json().catch(() => ({} as any));
      return { res, data };
    };

    setJoinBusy(true);
    try {
      let { res, data } = await attemptJoin(false);

      if ((!res.ok || data.success === false) && String(data.code || '') === 'MINOR_CONFIRM_REQUIRED') {
        const yes = window.confirm('你还没有毕业。确定要直接加入命之塔吗？\n选择【取消】将建议你继续前往伦敦塔就学。');
        if (!yes) {
          showToast('请先前往伦敦塔继续就学。');
          return;
        }
        ({ res, data } = await attemptJoin(true));
      }

      if (res.ok && data.success !== false) {
        showToast(data.message || `已加入 ${jobName}`);
        fetchGlobalData();
        return;
      }

      const message = String(data.message || '加入失败');
      if (message.includes('已有人') || message.toLowerCase().includes('occupied')) {
        const wantChallenge = window.confirm(`${jobName} 当前已有现任。是否发起职位挑战？`);
        if (wantChallenge) {
          const cRes = await fetch('/api/job/challenge', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ challengerId: user.id, targetJobName: jobName }),
          });
          const cData = await cRes.json().catch(() => ({} as any));
          showToast(cData.message || (cData.success ? '职位挑战已发起' : '职位挑战失败'));
          if (cData.success) fetchGlobalData();
          return;
        }
      }

      showToast(message);
    } catch {
      showToast('加入命之塔失败，请稍后重试');
    } finally {
      setJoinBusy(false);
    }
  };

  const submitAdminContact = async () => {
    const title = contactDraft.title.trim();
    const content = contactDraft.content.trim();
    if (!title || !content) {
      showToast('请填写留言标题与内容');
      return;
    }

    try {
      const res = await fetch('/api/announcements/messages', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ title, content }),
      });
      const data = await res.json().catch(() => ({} as any));
      if (!res.ok || data.success === false) {
        showToast(data.message || '留言提交失败');
        return;
      }
      setContactDraft({ title: '', content: '' });
      showToast(data.message || '留言已提交');
    } catch {
      showToast('网络异常，留言提交失败');
    }
  };

  const learnSkill = async (name: string) => {
    try {
      const res = await fetch(`/api/users/${user.id}/skills`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      const data = await res.json().catch(() => ({} as any));
      if (!res.ok || data.success === false) {
        showToast(data.message || '学习失败');
        return;
      }
      showToast(data.message || `已学会 ${name}`);
      loadMentalSkills(true);
      fetchGlobalData();
    } catch {
      showToast('学习失败');
    }
  };

  const resetDifferentiationDraws = () => {
    setDrawCount(0);
    setDrawHistory([]);
    setCurrentDraw(null);
    setFinalDraw(null);
    setShowDrawHistoryModal(false);
    setShowSpiritModal(false);
    setSpiritView('question');
    setCustomSpirit('');
  };

  const drawTowerDifferentiationOnce = () => {
    if (growthBusy) return;
    if (!isUndifferentiatedStage) {
      showToast('当前角色已经完成分化。');
      return;
    }
    if (drawCount >= MAX_DIFFERENTIATION_DRAWS) {
      setShowDrawHistoryModal(true);
      return;
    }

    const data = generateDifferentiationData();
    setCurrentDraw(data);
    setDrawHistory((prev) => [...prev, data]);
    setDrawCount((prev) => {
      const nextCount = prev + 1;
      if (nextCount >= MAX_DIFFERENTIATION_DRAWS) {
        window.setTimeout(() => setShowDrawHistoryModal(true), 160);
      }
      return nextCount;
    });
  };

  const commitTowerDifferentiation = async (picked: DifferentiationData) => {
    if (growthBusy) return;
    setGrowthBusy(true);
    try {
      const nextAge = Math.min(19, Math.max(16, Number(user.age || 16)));
      const enrollStudent = enrollStudentAfterDiff;
      const nextLocation = enrollStudent ? 'london_tower' : 'tower_of_life';
      const nextJob = enrollStudent ? '伦敦塔学员' : '';

      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: user.id,
          name: user.name,
          status: user.status || 'approved',
          age: nextAge,
          role: picked.role,
          mentalRank: picked.mentalRank,
          physicalRank: picked.physicalRank,
          gold: picked.gold,
          ability: picked.ability,
          spiritName: picked.spirit?.name || NONE,
          spiritType: picked.spirit?.type || NONE,
          job: nextJob,
          currentLocation: nextLocation,
        }),
      });
      const data = await res.json().catch(() => ({} as any));
      if (!res.ok || data.success === false) {
        showToast(data.message || '分化失败');
        return;
      }

      const nextUser = data.user || {};
      const roleText = String(nextUser.role || picked.role || '身份已更新');
      const ageText = Number(nextUser.age || nextAge || 16);
      showToast(
        enrollStudent
          ? `分化完成：${roleText}（${ageText}岁），并已前往伦敦塔就学。`
          : `分化完成：${roleText}（${ageText}岁）。`
      );
      resetDifferentiationDraws();
      fetchGlobalData();
      if (enrollStudent) {
        setSelectedPoint(null);
        onExit();
      }
    } catch {
      showToast('网络异常，分化失败');
    } finally {
      setGrowthBusy(false);
    }
  };

  const selectTowerDifferentiationFinal = (index: number) => {
    const picked = drawHistory[index];
    if (!picked) return;
    setFinalDraw(picked);
    setCurrentDraw(picked);
    setShowDrawHistoryModal(false);

    if (!isSentinelOrGuide(picked.role)) {
      commitTowerDifferentiation(picked);
      return;
    }

    setSpiritView('question');
    setCustomSpirit('');
    setShowSpiritModal(true);
  };

  const keepTowerSpirit = () => {
    if (!finalDraw) return;
    setShowSpiritModal(false);
    commitTowerDifferentiation(finalDraw);
  };

  const confirmTowerCustomSpirit = () => {
    if (!finalDraw) return;
    const spiritName = customSpirit.trim();
    if (!spiritName) {
      showToast('精神体名称不能为空');
      return;
    }

    const next: DifferentiationData = {
      ...finalDraw,
      spirit: {
        name: spiritName,
        type: '自定义',
      },
    };
    setFinalDraw(next);
    setShowSpiritModal(false);
    commitTowerDifferentiation(next);
  };

  return (
    <div className="absolute inset-0 overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.92),_rgba(244,248,255,0.94)_40%,_rgba(232,239,250,0.96)_100%)] text-slate-900 font-sans select-none">
      <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: "url('/命之塔.jpg')" }}>
        <div className="absolute inset-0 bg-gradient-to-b from-white/78 via-white/62 to-slate-100/82 pointer-events-none" />
      </div>

      <div className="absolute top-4 left-4 md:top-6 md:left-6 z-[90]">
        <button
          onClick={onExit}
          className="touch-manipulation inline-flex items-center gap-2 rounded-xl border border-white/70 bg-white/82 px-4 py-2 text-xs font-black text-slate-800 shadow-xl backdrop-blur hover:bg-white/95 active:scale-95 transition-all md:text-sm"
        >
          <ArrowLeft size={18} />
          <span className="hidden sm:inline">离开命之塔</span>
          <span className="sm:hidden">返回</span>
        </button>
      </div>

      <div className="absolute top-4 right-4 md:top-6 md:right-6 z-[90]">
        <div className="rounded-xl border border-white/75 bg-white/82 px-3 py-1.5 text-[10px] text-slate-700 backdrop-blur md:text-xs">
          点击地图坐标即可进入对应功能区。
        </div>
      </div>

      <div className="relative z-20 w-full h-full">
        {TOWER_POINTS.map((point) => (
          <button
            key={point.id}
            onClick={() => setSelectedPoint(point.id)}
            className="absolute -translate-x-1/2 -translate-y-1/2 group z-10 touch-manipulation"
            style={{ left: `${point.x}%`, top: `${point.y}%` }}
          >
            <div className="flex flex-col items-center gap-2">
              <div
                className={`w-12 h-12 md:w-16 md:h-16 rounded-2xl md:rounded-3xl border-2 flex items-center justify-center shadow-2xl transition-all ${
                  selectedPoint === point.id
                    ? 'bg-amber-400/95 text-slate-900 border-amber-100 scale-105'
                    : 'bg-white/88 text-amber-700 border-white/75 group-hover:bg-amber-100 group-hover:text-amber-800 group-hover:border-amber-200 group-hover:scale-110'
                }`}
              >
                {point.icon}
              </div>
              <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-white/90 border border-white/80 text-slate-700 whitespace-nowrap shadow-lg md:text-xs">
                {point.name}
              </span>
            </div>
          </button>
        ))}
      </div>

      <AnimatePresence>
        {selectedPointMeta && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] bg-white/35 backdrop-blur-[2px]"
              onClick={() => setSelectedPoint(null)}
            />

            <motion.section
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 330, damping: 32 }}
              className="theme-elevated-surface fixed inset-x-0 bottom-0 z-[110] flex max-h-[86vh] flex-col rounded-t-3xl shadow-2xl md:inset-y-0 md:right-0 md:left-auto md:max-h-none md:w-[520px] md:rounded-none md:rounded-l-3xl md:border-l md:border-t-0 mobile-portrait-safe-sheet"
            >
              <div className="border-b border-slate-700/80 p-4 md:p-5 shrink-0">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="theme-soft-surface flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-amber-600">
                      {selectedPointMeta.icon}
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-base md:text-lg font-black text-amber-200 truncate">{selectedPointMeta.name}</h3>
                      <p className="text-[11px] md:text-xs text-slate-400 mt-0.5">{selectedPointMeta.desc}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedPoint(null)}
                    className="theme-soft-surface rounded-lg p-2 text-slate-500 hover:text-slate-900 transition-colors"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>

              <div className="p-4 md:p-5 overflow-y-auto custom-scrollbar space-y-4 flex-1">
                {selectedPoint === 'announcement_hall' && (
                  <div className="space-y-4">
                    <div className="rounded-2xl border border-slate-700 bg-slate-800/70 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <h4 className="flex items-center gap-2 text-sm font-black text-amber-300">
                          <Megaphone size={14} />
                          最新公告
                        </h4>
                        <button
                          onClick={() => loadAnnouncements(false)}
                          disabled={announcementBusy}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-600 bg-slate-900/70 px-2 py-1 text-[11px] font-bold text-slate-200 hover:bg-slate-800 disabled:opacity-60"
                        >
                          <RefreshCw size={12} className={announcementBusy ? 'animate-spin' : ''} />
                          刷新
                        </button>
                      </div>
                      <div className="mt-3 space-y-3 max-h-64 overflow-y-auto pr-1 custom-scrollbar">
                        {announcements.length === 0 ? (
                          <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-3 text-xs text-slate-400">
                            暂无最新公告。
                          </div>
                        ) : (
                          announcements.map((row) => (
                            <div key={String(row.id || Math.random())} className="rounded-xl border border-slate-700 bg-slate-900/60 p-3">
                              <div className="text-sm font-black text-slate-100">{row.title || '系统公告'}</div>
                              <div className="mt-1 text-[11px] text-slate-400">{formatAnnouncementTime(row)}</div>
                              <div className="mt-2 whitespace-pre-wrap break-words text-xs leading-6 text-slate-300">
                                {row.content || '（无内容）'}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-sky-500/30 bg-sky-500/10 p-4">
                      <h4 className="flex items-center gap-2 text-sm font-black text-sky-200">
                        <Send size={14} />
                        给管理员后台留言
                      </h4>
                      <p className="mt-2 text-xs leading-6 text-sky-100/85">
                        可以在这里反馈 BUG、申请处理异常情况，或提出剧情与玩法建议。
                      </p>
                      <div className="mt-3 space-y-2">
                        <input
                          value={contactDraft.title}
                          onChange={(e) => setContactDraft((prev) => ({ ...prev, title: e.target.value }))}
                          className="w-full rounded-xl border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-white"
                          placeholder="留言标题"
                        />
                        <textarea
                          value={contactDraft.content}
                          onChange={(e) => setContactDraft((prev) => ({ ...prev, content: e.target.value }))}
                          className="min-h-[120px] w-full rounded-xl border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-white"
                          placeholder="把你的问题、建议或需要处理的情况写在这里"
                        />
                        <button
                          onClick={submitAdminContact}
                          className="w-full rounded-xl bg-sky-600 px-3 py-2 text-sm font-black text-white hover:bg-sky-500"
                        >
                          提交留言
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {selectedPoint === 'administration' && (
                  <div className="space-y-4">
                    <div className="rounded-2xl border border-slate-700 bg-slate-800/70 p-4">
                      <h4 className="flex items-center gap-2 text-sm font-black text-amber-300">
                        <MapPin size={14} />
                        命之塔职位门槛
                      </h4>
                      <p className="mt-2 text-xs text-slate-300 leading-6">
                        命之塔是精神系成长阵营，高位职位遵循精神力门槛。若高位已有现任，可通过职位挑战争夺席位。
                      </p>
                      <div className="mt-3 space-y-1.5">
                        {TOWER_ROLE_LIMITS.map((line) => (
                          <div key={line} className="text-[11px] text-slate-400">
                            {line}
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-slate-700 bg-slate-800/70 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2 text-xs font-black text-sky-300">
                            <Shield size={14} />
                            三塔管理授权
                          </div>
                          <p className="mt-2 text-xs text-slate-200">
                            {DELEGATION_STATUS_TEXT[delegationStatus] || delegationStatus}
                          </p>
                        </div>
                        <button
                          onClick={() => pullDelegationStatus(false)}
                          disabled={delegationBusy}
                          className="rounded-lg border border-slate-600 bg-slate-900/70 px-2 py-1 text-[11px] font-bold text-slate-200 hover:bg-slate-800 disabled:opacity-60"
                        >
                          刷新状态
                        </button>
                      </div>
                      {delegationMeta?.requestedByName && (
                        <p className="mt-2 text-[11px] text-slate-400">申请人：{delegationMeta.requestedByName}</p>
                      )}
                      {delegationMeta?.reviewedByName && (
                        <p className="mt-1 text-[11px] text-slate-400">最近审批：{delegationMeta.reviewedByName}</p>
                      )}
                      {isTowerGovernor && delegationStatus === 'pending' && (
                        <div className="mt-3 grid grid-cols-2 gap-2">
                          <button
                            onClick={() => reviewDelegation('approve')}
                            disabled={delegationBusy}
                            className="rounded-lg bg-emerald-700 px-2 py-2 text-[11px] font-black text-white hover:bg-emerald-600 disabled:opacity-60"
                          >
                            同意接管
                          </button>
                          <button
                            onClick={() => reviewDelegation('reject')}
                            disabled={delegationBusy}
                            className="rounded-lg bg-rose-700 px-2 py-2 text-[11px] font-black text-white hover:bg-rose-600 disabled:opacity-60"
                          >
                            驳回申请
                          </button>
                        </div>
                      )}
                      {isTowerGovernor && delegationStatus === 'approved' && (
                        <button
                          onClick={() => reviewDelegation('revoke')}
                          disabled={delegationBusy}
                          className="mt-3 w-full rounded-lg bg-amber-700 px-2 py-2 text-[11px] font-black text-white hover:bg-amber-600 disabled:opacity-60"
                        >
                          收回守塔会授权
                        </button>
                      )}
                    </div>

                    <FactionMemberPanel
                      user={user}
                      locationId="tower_of_life"
                      showToast={showToast}
                      fetchGlobalData={fetchGlobalData}
                      title="命之塔职位房间"
                    />
                  </div>
                )}

                {selectedPoint === 'recruitment_office' && (
                  <div className="space-y-4">
                    <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-4">
                      <h4 className="flex items-center gap-2 text-sm font-black text-emerald-200">
                        <UserPlus size={14} />
                        入塔申请入口
                      </h4>
                      <p className="mt-2 text-xs leading-6 text-emerald-100/90">
                        命之塔职位按照精神力门槛开放。若高位职位已有现任，可在失败提示后直接发起职位挑战。
                      </p>
                      <div className="mt-3 rounded-xl border border-emerald-500/20 bg-black/20 p-3 text-[11px] text-emerald-100">
                        当前身份：{currentJob || '无'} · 当前精神力：{String(user.mentalRank || '无')}
                        <div className="mt-1 text-emerald-200/80">
                          {isTowerMember ? '你当前已在命之塔任职，可继续申请更高职位。' : '你尚未加入命之塔，可在下方提交申请。'}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      {TOWER_JOIN_OPTIONS.map((option) => {
                        const qualified = rankScore(user.mentalRank) >= rankScore(option.minMental);
                        const isCurrent = currentJob === option.jobName;
                        return (
                          <div key={option.jobName} className="rounded-xl border border-slate-700 bg-slate-800/70 p-3">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="text-sm font-black text-slate-100">{option.jobName}</div>
                                <div className="mt-1 text-[11px] text-slate-400">精神力要求：{option.minMental}</div>
                                <div className="mt-2 text-xs leading-5 text-slate-300">{option.description}</div>
                              </div>
                              <button
                                onClick={() => handleTowerJoin(option.jobName)}
                                disabled={!qualified || joinBusy || isCurrent}
                                className={`shrink-0 rounded-xl px-3 py-2 text-xs font-black transition-colors ${
                                  qualified && !joinBusy && !isCurrent
                                    ? 'bg-emerald-600 text-white hover:bg-emerald-500'
                                    : 'bg-slate-700 text-slate-400 cursor-not-allowed'
                                }`}
                              >
                                {isCurrent ? '当前职位' : joinBusy ? '处理中...' : '申请加入'}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {selectedPoint === 'skill_library' && (
                  <div className="space-y-3">
                    <div className="rounded-2xl border border-slate-700 bg-slate-800/70 p-4">
                      <h4 className="text-sm font-black text-amber-300">精神系技能目录</h4>
                      <p className="mt-2 text-xs leading-6 text-slate-300">
                        这里只展示你尚未掌握的精神系技能。学习后会自动从可学列表中移除。
                      </p>
                    </div>
                    {mentalSkills.length === 0 ? (
                      <div className="rounded-xl border border-slate-700 bg-slate-800/70 p-4 text-sm text-slate-400">
                        暂无可学习的精神系技能。
                      </div>
                    ) : (
                      mentalSkills.slice(0, 12).map((skill: any) => (
                        <div key={String(skill.id)} className="rounded-xl border border-slate-700 bg-slate-800/70 p-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="text-sm font-bold text-slate-100 truncate">{skill.name}</div>
                              <div className="mt-1 text-[11px] text-slate-400">
                                {String(skill.faction || '精神系')} · {String(skill.tier || '通用')}
                              </div>
                              <div className="mt-2 text-xs text-slate-300 leading-5">{skill.description || '暂无描述'}</div>
                            </div>
                            <button
                              onClick={() => learnSkill(String(skill.name || ''))}
                              className="rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-sky-500 shrink-0"
                            >
                              学习
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {selectedPoint === 'training_ground' && (
                  <div className="space-y-4">
                    {isUndifferentiatedStage ? (
                      <div className="rounded-2xl border border-fuchsia-500/30 bg-fuchsia-500/10 p-4">
                        <h4 className="text-sm font-black text-fuchsia-200">新手分化（抽 10 选 1）</h4>
                        <p className="mt-2 text-xs leading-6 text-fuchsia-100/90">
                          进行 10 次分化抽取后，由你亲自锁定 1 次结果，写入角色档案并同步到主状态面板。
                        </p>
                        <label className="mt-3 flex items-center gap-2 rounded-xl border border-fuchsia-500/30 bg-fuchsia-900/15 px-3 py-2 text-[11px] text-fuchsia-100">
                          <input
                            type="checkbox"
                            checked={enrollStudentAfterDiff}
                            disabled={growthBusy}
                            onChange={(e) => setEnrollStudentAfterDiff(e.target.checked)}
                            className="accent-fuchsia-500"
                          />
                          <span>分化完成后直接前往伦敦塔就学</span>
                        </label>
                        <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
                          <div className="rounded-lg border border-fuchsia-500/25 bg-black/20 px-2 py-1.5 text-fuchsia-100">
                            抽取进度：{drawCount}/{MAX_DIFFERENTIATION_DRAWS}
                          </div>
                          <div className="rounded-lg border border-fuchsia-500/25 bg-black/20 px-2 py-1.5 text-fuchsia-100">
                            当前状态：{growthBusy ? '分化处理中' : drawCount >= MAX_DIFFERENTIATION_DRAWS ? '等待锁定结果' : '可继续抽取'}
                          </div>
                        </div>

                        {currentDraw && (
                          <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
                            <div className="rounded-lg border border-fuchsia-500/25 bg-black/20 px-2 py-1.5 text-fuchsia-100">身份：{currentDraw.role}</div>
                            <div className="rounded-lg border border-fuchsia-500/25 bg-black/20 px-2 py-1.5 text-fuchsia-100">金币：{currentDraw.gold}</div>
                            <div className="rounded-lg border border-fuchsia-500/25 bg-black/20 px-2 py-1.5 text-fuchsia-100">精神：{currentDraw.mentalRank}</div>
                            <div className="rounded-lg border border-fuchsia-500/25 bg-black/20 px-2 py-1.5 text-fuchsia-100">肉体：{currentDraw.physicalRank}</div>
                            <div className="col-span-2 rounded-lg border border-fuchsia-500/25 bg-black/20 px-2 py-1.5 text-fuchsia-100">精神体：{currentDraw.spirit?.name || NONE}</div>
                            <div className="col-span-2 rounded-lg border border-fuchsia-500/25 bg-black/20 px-2 py-1.5 text-fuchsia-100">专属能力：{currentDraw.ability}</div>
                          </div>
                        )}

                        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <button
                            onClick={drawTowerDifferentiationOnce}
                            disabled={growthBusy}
                            className="w-full rounded-xl bg-fuchsia-600 px-3 py-2 text-xs font-black text-white hover:bg-fuchsia-500 disabled:opacity-60"
                          >
                            {growthBusy
                              ? '分化处理中...'
                              : drawCount >= MAX_DIFFERENTIATION_DRAWS
                                ? '抽取完成，打开锁定面板'
                                : `抽取一次（剩余 ${Math.max(0, MAX_DIFFERENTIATION_DRAWS - drawCount)} 次）`}
                          </button>
                          <button
                            onClick={() => setShowDrawHistoryModal(true)}
                            disabled={growthBusy || drawCount < MAX_DIFFERENTIATION_DRAWS}
                            className="w-full rounded-xl border border-fuchsia-400/40 bg-fuchsia-900/25 px-3 py-2 text-xs font-black text-fuchsia-100 hover:bg-fuchsia-900/45 disabled:opacity-50"
                          >
                            打开 10 选 1 锁定面板
                          </button>
                        </div>

                        {drawCount > 0 && (
                          <button
                            onClick={() => {
                              if (!window.confirm('确定重置本轮分化记录吗？')) return;
                              resetDifferentiationDraws();
                            }}
                            disabled={growthBusy}
                            className="mt-2 w-full rounded-xl border border-slate-600 bg-slate-900/70 px-3 py-2 text-[11px] font-bold text-slate-300 hover:bg-slate-800 disabled:opacity-60"
                          >
                            重置本轮抽取
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4">
                        <h4 className="text-sm font-black text-emerald-200">分化已完成</h4>
                        <p className="mt-2 text-xs leading-6 text-emerald-100/90">
                          你已经完成身份分化。当前身份：{String(user.role || '未知')}，精神：{String(user.mentalRank || '无')}，肉体：{String(user.physicalRank || '无')}。
                        </p>
                      </div>
                    )}

                    <div className="rounded-2xl border border-indigo-500/30 bg-indigo-500/10 p-4">
                      <h4 className="text-sm font-black text-indigo-200">精神训练提示</h4>
                      <p className="mt-2 text-xs leading-6 text-indigo-100/90">
                        建议先在精神系技能库学习至少 1 个技能，再推进剧情与对戏中的精神训练。当前训练场主要承担分化与新手引导用途。
                      </p>
                    </div>

                    <div className="rounded-2xl border border-amber-500/25 bg-amber-500/5 p-4">
                      <h4 className="text-sm font-black text-amber-200">新手指引</h4>
                      <ul className="mt-2 space-y-2 text-xs leading-6 text-amber-100/90">
                        {NEWCOMER_OPENING_NOTICE.lines.map((line) => (
                          <li key={line} className="flex items-start gap-2">
                            <span className="mt-1 text-amber-300">•</span>
                            <span>{line}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}

                {selectedPoint === 'leaderboard' && (
                  <div className="space-y-2">
                    {leaderRows.map((row) => (
                      <div key={row.label} className="flex items-center justify-between gap-3 rounded-xl border border-slate-700 bg-slate-800/70 px-3 py-2.5">
                        <span className="text-xs text-amber-300">{row.label}</span>
                        <span className="text-sm font-black text-white truncate">{row.leader}</span>
                      </div>
                    ))}
                    <div className="rounded-xl border border-slate-700 bg-slate-800/70 p-3 text-[11px] text-slate-400">
                      榜单依据当前在线玩家身份实时刷新，仅用于世界秩序展示。
                    </div>
                  </div>
                )}
              </div>
            </motion.section>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showDrawHistoryModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[220] bg-black/70 p-4 flex items-center justify-center"
          >
            <div className="w-full max-w-5xl max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 p-5">
              <div className="mb-4 flex items-center justify-between gap-2">
                <h3 className="text-lg font-black text-fuchsia-200">10 选 1 分化锁定</h3>
                <button
                  onClick={() => setShowDrawHistoryModal(false)}
                  className="rounded-lg border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-slate-300 hover:text-white"
                >
                  关闭
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {drawHistory.map((draw, idx) => (
                  <div key={`tower-diff-${idx}`} className="rounded-xl border border-slate-700 bg-slate-800/80 p-3">
                    <div className="mb-2 text-sm font-black text-fuchsia-100">第 {idx + 1} 次</div>
                    <div className="text-xs text-slate-300">身份：{draw.role}</div>
                    <div className="text-xs text-slate-300">精神 / 肉体：{draw.mentalRank} / {draw.physicalRank}</div>
                    <div className="text-xs text-slate-300">金币：{draw.gold}</div>
                    <div className="text-xs text-slate-300">能力：{draw.ability}</div>
                    <div className="mb-2 text-xs text-slate-300">精神体：{draw.spirit?.name || NONE}</div>
                    <button
                      onClick={() => selectTowerDifferentiationFinal(idx)}
                      disabled={growthBusy}
                      className="w-full rounded-lg bg-fuchsia-600 px-3 py-2 text-xs font-black text-white hover:bg-fuchsia-500 disabled:opacity-60"
                    >
                      锁定该结果
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showSpiritModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[230] bg-black/70 p-4 flex items-center justify-center"
          >
            <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-5">
              {spiritView === 'question' ? (
                <div className="text-center">
                  <h3 className="mb-2 text-lg font-black text-fuchsia-100">保留当前精神体？</h3>
                  <p className="mb-4 text-sm text-slate-300">{finalDraw?.spirit?.name || NONE}</p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={keepTowerSpirit}
                      disabled={growthBusy}
                      className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-black text-white hover:bg-emerald-500 disabled:opacity-60"
                    >
                      保留
                    </button>
                    <button
                      onClick={() => setSpiritView('input')}
                      disabled={growthBusy}
                      className="rounded-lg bg-rose-600 px-3 py-2 text-sm font-black text-white hover:bg-rose-500 disabled:opacity-60"
                    >
                      更换名称
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <h3 className="mb-2 text-lg font-black text-fuchsia-100">输入新的精神体名称</h3>
                  <input
                    value={customSpirit}
                    onChange={(e) => setCustomSpirit(e.target.value)}
                    className="mb-3 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white"
                    placeholder="请输入精神体名称"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={confirmTowerCustomSpirit}
                      disabled={growthBusy}
                      className="rounded-lg bg-fuchsia-600 px-3 py-2 text-sm font-black text-white hover:bg-fuchsia-500 disabled:opacity-60"
                    >
                      确认锁定
                    </button>
                    <button
                      onClick={() => setSpiritView('question')}
                      disabled={growthBusy}
                      className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm font-black text-slate-200 hover:bg-slate-700 disabled:opacity-60"
                    >
                      返回
                    </button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showWelcomeModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[300] flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm mobile-portrait-safe-overlay"
          >
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              className="w-full max-w-xl rounded-3xl border border-amber-700/40 bg-slate-900 p-5 md:p-6 text-amber-50 shadow-2xl mobile-portrait-safe-card mobile-contrast-surface-dark"
            >
              <h3 className="mb-3 text-xl md:text-2xl font-black text-amber-300">{NEWCOMER_OPENING_NOTICE.title}</h3>
              <p className="text-sm leading-7 text-amber-100/90">{NEWCOMER_OPENING_NOTICE.intro}</p>
              <div className="mt-3 rounded-2xl border border-amber-700/30 bg-amber-500/5 p-3">
                <ul className="space-y-2 text-sm leading-7 text-amber-100/90">
                  {NEWCOMER_OPENING_NOTICE.lines.map((line) => (
                    <li key={line} className="flex items-start gap-2">
                      <span className="mt-1 text-amber-300">•</span>
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <p className="mt-3 text-sm leading-7 text-amber-100/90">{NEWCOMER_OPENING_NOTICE.outro}</p>
              <div className="mt-5 flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowWelcomeModal(false)}
                  className="rounded-xl bg-amber-500 px-4 py-2 font-bold text-slate-900 hover:bg-amber-400"
                >
                  我知道了，开始冒险
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background-color: rgba(148, 163, 184, 0.7); border-radius: 20px; }
      `}</style>
    </div>
  );
}

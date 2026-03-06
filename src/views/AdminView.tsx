import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  MessageSquare,
  Package,
  Zap,
  User as UserIcon,
  Trash2,
  MapPin,
  CheckCircle,
  XCircle,
  Edit3,
  ShieldAlert,
  Users,
  Filter,
  Download,
  Shield,
  KeyRound,
  UserCheck,
  Megaphone,
  Gamepad2,
  LogOut,
  RefreshCw,
  Skull
} from 'lucide-react';
import { AdminCustomGamesView } from './AdminCustomGamesView';

type AdminTab = 'users' | 'logs' | 'items' | 'skills' | 'security' | 'announcements' | 'custom_games';

type UserStatus =
  | 'pending'
  | 'approved'
  | 'dead'
  | 'ghost'
  | 'rejected'
  | 'pending_death'
  | 'pending_ghost'
  | 'banned';

interface AdminUser {
  id: number;
  name: string;
  age?: number;
  role?: string;
  faction?: string;
  mentalRank?: string;
  physicalRank?: string;
  ability?: string;
  spiritName?: string;
  profileText?: string;
  currentLocation?: string;
  status: UserStatus;
  deathDescription?: string;
  password?: string;
}

interface UserSkill {
  id: number;
  name: string;
  level: number;
}

interface RPArchive {
  id: string;
  title: string;
  locationName: string;
  participantNames: string;
  createdAt: string;
  messages: any[];
}

interface GlobalItem {
  id: number;
  name: string;
  description?: string;
  locationTag?: string;
  npcId?: string;
  price?: number;
  faction?: string;
  tier?: string;
  itemType?: string;
  effectValue?: number;
}

interface GlobalSkill {
  id: number;
  name: string;
  faction?: string;
  tier?: string;
  description?: string;
  npcId?: string;
}

interface GlobalMonster {
  id: number;
  name: string;
  description?: string;
  minLevel?: number;
  maxLevel?: number;
  basePower?: number;
  baseHp?: number;
  dropItemName?: string;
  dropChance?: number;
  enabled?: number;
}

interface AdminWhitelistItem {
  id?: number;
  name: string;
  code_name?: string | null;
  enabled?: number;
  createdAt?: string;
}

interface OnlineAdmin {
  userId: number;
  userName: string;
  adminName?: string;
  lastSeenAt: string;
  adminAvatarUrl?: string | null;
  avatarUrl?: string | null;
  isOnline?: boolean;
}

interface AdminActionLog {
  id: number;
  adminName: string;
  action: string;
  targetType?: string;
  targetId?: string;
  detail?: Record<string, any> | string | null;
  createdAt: string;
}

interface InteractionReport {
  id: number;
  reporterId: number;
  reporterName: string;
  targetId: number;
  targetName: string;
  reason: string;
  status: 'pending' | 'voting' | 'banned' | 'rejected';
  banVotes: number;
  rejectVotes: number;
  createdAt: string;
  updatedAt: string;
}
type ReviewType =
  | 'create_role'
  | 'death'
  | 'reskin'
  | 'role_vote'
  | 'custom_game';

interface ReviewRule {
  type: ReviewType;
  requiredApprovals: number;
}

interface ReviewVoteRecord {
  approveBy: string[];
  rejectBy: string[];
}

const REVIEW_LABEL: Record<ReviewType, string> = {
  create_role: '创角色审核',
  death: '死亡审核',
  reskin: '换皮审核',
  role_vote: '角色投票',
  custom_game: '灾厄游戏审核'
};
const REVIEW_RULES_STORAGE_KEY = 'ADMIN_REVIEW_RULES_V1';
const REVIEW_VOTES_STORAGE_KEY = 'ADMIN_REVIEW_VOTES_V1';

const DEFAULT_REVIEW_RULES: ReviewRule[] = [
  { type: 'create_role', requiredApprovals: 1 },
  { type: 'death', requiredApprovals: 1 },
  { type: 'reskin', requiredApprovals: 1 },
  { type: 'role_vote', requiredApprovals: 2 },
  { type: 'custom_game', requiredApprovals: 2 }
];


const FACTIONS = ['物理系', '元素系', '精神系', '感知系', '信息系', '治疗系', '强化系', '炼金系', '圣所', '普通人', '恶魔会', '通用'];
const TIERS = ['低阶', '中阶', '高阶'];
const ITEM_TYPES = ['回复道具', '任务道具', '技能书道具', '贵重物品', '违禁品'];
const ITEM_ORIGIN_OPTIONS = [
  { value: 'slums', label: '西市（贫民区）', faction: '西市' },
  { value: 'rich_area', label: '东市（富人区）', faction: '东市' },
  { value: 'guild', label: '工会', faction: '工会' },
  { value: 'demon_society', label: '恶魔会', faction: '恶魔会' },
  { value: 'tower_of_life', label: '命之塔', faction: '命之塔' },
  { value: 'london_tower', label: '伦敦塔', faction: '伦敦塔' },
  { value: 'sanctuary', label: '圣所', faction: '圣所' },
  { value: 'tower_guard', label: '守塔会', faction: '守塔会' },
  { value: 'observers', label: '观察者', faction: '观察者' },
  { value: 'paranormal_office', label: '灵异管理所', faction: '灵异管理所' },
  { value: 'army', label: '军队', faction: '军队' },
  { value: 'all', label: '全地图掉落', faction: '全图' }
] as const;

const ADMIN_TOKEN_KEY = 'ADMIN_TOKEN';
const ADMIN_NAME_KEY = 'ADMIN_NAME';
const FIXED_ADMIN_NAME = '塔';

const isLikelyHttpUrl = (v: string) => /^https?:\/\/.+/i.test(v.trim());
const toName = (v: any) => String(v || '').trim();
const toRelativeTime = (iso: string) => {
  const ts = new Date(iso).getTime();
  if (!Number.isFinite(ts)) return '时间未知';
  const diff = Date.now() - ts;
  if (diff < 10_000) return '刚刚活跃';
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec} 秒前`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} 分钟前`;
  const hour = Math.floor(min / 60);
  if (hour < 24) return `${hour} 小时前`;
  const day = Math.floor(hour / 24);
  return `${day} 天前`;
};
const summarizeLogDetail = (detail: AdminActionLog['detail']) => {
  if (!detail) return '';
  if (typeof detail === 'string') return detail;
  const pairs = Object.entries(detail).slice(0, 3).map(([k, v]) => `${k}:${String(v)}`);
  return pairs.join(' · ');
};

const parseAdminAgeValue = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const age = Number(trimmed);
  if (!Number.isInteger(age) || age < 0 || age > 999) return null;
  return age;
};
export function AdminView() {
  // ---------------- 管理员登录态 ----------------
  const [authStep, setAuthStep] = useState<'code' | 'name' | 'done'>('code');
  const [entryCode, setEntryCode] = useState('');
  const [adminNameInput, setAdminNameInput] = useState('');
  const [adminName, setAdminName] = useState('');
  const [adminToken, setAdminToken] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  // ---------------- 页面状态 ----------------
  const [activeTab, setActiveTab] = useState<AdminTab>('users');
  const [loading, setLoading] = useState(false);
  const [bootstrappingCatalog, setBootstrappingCatalog] = useState(false);
  const [flash, setFlash] = useState('');
  const [error, setError] = useState('');

  // ---------------- 数据 ----------------
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [interactionReports, setInteractionReports] = useState<InteractionReport[]>([]);
  const [reportVoteThreshold, setReportVoteThreshold] = useState(2);
  const [reportStatusFilter, setReportStatusFilter] = useState<'all' | 'pending' | 'voting' | 'banned' | 'rejected'>('all');
  const [votingReportId, setVotingReportId] = useState<number | null>(null);
  const [items, setItems] = useState<GlobalItem[]>([]);
  const [monsters, setMonsters] = useState<GlobalMonster[]>([]);
  const [skills, setSkills] = useState<GlobalSkill[]>([]);
  const [archives, setArchives] = useState<RPArchive[]>([]);
  const [archiveSearch, setArchiveSearch] = useState('');
  const [adminLogs, setAdminLogs] = useState<AdminActionLog[]>([]);

  // ---------------- 管理员安全相关 ----------------
  const [whitelist, setWhitelist] = useState<AdminWhitelistItem[]>([]);
  const [onlineAdmins, setOnlineAdmins] = useState<OnlineAdmin[]>([]);
  const [newAdminName, setNewAdminName] = useState('');
  const [newAdminCodeName, setNewAdminCodeName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [securityRefreshing, setSecurityRefreshing] = useState(false);
  const [securityLogSearch, setSecurityLogSearch] = useState('');
  const [selectedSecurityAdmin, setSelectedSecurityAdmin] = useState('');
  const [avatarPreviewFailed, setAvatarPreviewFailed] = useState(false);

  // ---------------- 编辑用户 ----------------
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [editingUserSkills, setEditingUserSkills] = useState<UserSkill[]>([]);
  const [ageDrafts, setAgeDrafts] = useState<Record<number, string>>({});
  const [savingAgeUserId, setSavingAgeUserId] = useState<number | null>(null);

  // ---------------- 技能筛选 ----------------
  const [skillFactionFilter, setSkillFactionFilter] = useState('ALL');

  const [deletingArchiveId, setDeletingArchiveId] = useState<string | null>(null);

    // ---------------- 审核规则与会签 ----------------
  const [showReviewConfig, setShowReviewConfig] = useState(false);
  const [reviewRules, setReviewRules] = useState<ReviewRule[]>(DEFAULT_REVIEW_RULES);
  const [reviewVotes, setReviewVotes] = useState<Record<string, ReviewVoteRecord>>({});

  useEffect(() => {
    const next: Record<number, string> = {};
    users.forEach((u) => {
      next[u.id] = String(u.age ?? 0);
    });
    setAgeDrafts(next);
  }, [users]);

const handleDeleteArchive = async (arc: RPArchive) => {
  if (!confirm(`确定删除存档《${arc.title}》吗？此操作不可恢复。`)) return;
  try {
    setDeletingArchiveId(arc.id);
    const data = await authedFetch(`/api/admin/rp_archives/${encodeURIComponent(arc.id)}`, {
      method: 'DELETE'
    });
    setArchives(prev => prev.filter(x => x.id !== arc.id));
    showOk(data.message || `已删除存档 ${arc.id}`);
  } catch (e: any) {
    alert(e.message || '删除失败');
  } finally {
    setDeletingArchiveId(null);
  }
};


  // ---------------- 新增物品/技能/公告 ----------------
  const [newItem, setNewItem] = useState({
    name: '',
    description: '',
    locationTag: 'slums',
    price: 0,
    faction: '西市',
    tier: '低阶',
    itemType: '回复道具',
    effectValue: 0
  });

  const [newSkill, setNewSkill] = useState({
    name: '',
    faction: '物理系',
    tier: '低阶',
    description: '',
    npcId: ''
  });

  const [newMonster, setNewMonster] = useState({
    name: '',
    description: '',
    minLevel: 1,
    maxLevel: 10,
    basePower: 10,
    baseHp: 100,
    dropItemName: 'Monster Core',
    dropChance: 0.7
  });
  const [editingMonster, setEditingMonster] = useState<GlobalMonster | null>(null);
  const [editingMonsterDraft, setEditingMonsterDraft] = useState({
    name: '',
    description: '',
    minLevel: 1,
    maxLevel: 10,
    basePower: 10,
    baseHp: 100,
    dropItemName: 'Monster Core',
    dropChance: 0.7,
    enabled: 1
  });

  const [newAnnouncement, setNewAnnouncement] = useState({
    type: 'system',
    title: '',
    content: ''
  });

  // ---------------- 工具 ----------------
  const authedFetch = async (url: string, init?: RequestInit) => {
    const res = await fetch(url, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        Authorization: adminToken ? `Bearer ${adminToken}` : '',
        ...(init?.headers || {})
      }
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data?.message || `请求失败: ${res.status}`);
    }
    return data;
  };

  const showOk = (msg: string) => {
    setFlash(msg);
    setTimeout(() => setFlash(''), 2600);
  };
    const getRequiredApprovals = (type: ReviewType) => {
    return Math.max(1, reviewRules.find(r => r.type === type)?.requiredApprovals || 1);
  };

  const setRequiredApprovals = (type: ReviewType, val: number) => {
    const next = Math.max(1, Number(val) || 1);
    setReviewRules(prev => prev.map(r => (r.type === type ? { ...r, requiredApprovals: next } : r)));
  };

  const inferReviewTypeForUser = (u: AdminUser, targetStatus: UserStatus): ReviewType => {
    if (u.status === 'pending_death' || targetStatus === 'dead') return 'death';
    if (u.status === 'pending_ghost') return 'reskin';
    return 'create_role';
  };

  const buildVoteKey = (type: ReviewType, userId: number) => `${type}:user:${userId}`;

  const getVoteProgress = (u: AdminUser, targetStatus: UserStatus) => {
    const t = inferReviewTypeForUser(u, targetStatus);
    const required = getRequiredApprovals(t);
    const key = buildVoteKey(t, u.id);
    const rec = reviewVotes[key] || { approveBy: [], rejectBy: [] };
    const count = targetStatus === 'rejected' ? rec.rejectBy.length : rec.approveBy.length;
    return { type: t, required, count, key };
  };


  // ---------------- 初始化管理员会话 ----------------
  useEffect(() => {
    const token = localStorage.getItem(ADMIN_TOKEN_KEY) || '';
    const name = localStorage.getItem(ADMIN_NAME_KEY) || '';
    if (token) {
      setAdminToken(token);
      setAdminName(name || '');
      setAuthStep('done');
    }
  }, []);

  // ---------------- 拉数据 ----------------
  useEffect(() => {
    if (authStep !== 'done') return;
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, authStep, reportStatusFilter]);

  useEffect(() => {
    if (editingUser) {
      fetchUserSkills(editingUser.id);
    } else {
      setEditingUserSkills([]);
    }
  }, [editingUser]);

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      if (activeTab === 'users') {
        const statusQuery = reportStatusFilter === 'all' ? '' : `?status=${encodeURIComponent(reportStatusFilter)}`;
        const [userData, reportData] = await Promise.all([
          authedFetch('/api/admin/users'),
          authedFetch(`/api/admin/reports${statusQuery}`)
        ]);
        setUsers(userData.users || []);
        setInteractionReports(reportData.reports || []);
        setReportVoteThreshold(Math.max(1, Number(reportData.threshold || 2)));
      } else if (activeTab === 'logs') {
        const data = await authedFetch('/api/admin/rp_archives');
        setArchives(data.archives || []);
      } else if (activeTab === 'items') {
        const [itemData, monsterData] = await Promise.all([
          authedFetch('/api/items'),
          authedFetch('/api/admin/monsters')
        ]);
        setItems(itemData.items || []);
        setMonsters(monsterData.monsters || []);
      } else if (activeTab === 'skills') {
        const data = await authedFetch('/api/skills');
        setSkills(data.skills || []);
      } else if (activeTab === 'security') {
        await refreshSecurityData(true);
      } else if (activeTab === 'announcements') {
        await fetchAdminLogs();
      } else if (activeTab === 'custom_games') {
        await fetchAdminLogs();
      }
    } catch (e: any) {
      setError(e.message || '加载失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchUserSkills = async (userId: number) => {
    try {
      const data = await authedFetch(`/api/users/${userId}/skills`);
      if (data.success) setEditingUserSkills(data.skills || []);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchWhitelist = async () => {
    const data = await authedFetch('/api/admin/whitelist');
    setWhitelist(data.rows || []);
  };

  const fetchOnlineAdmins = async () => {
    const data = await authedFetch('/api/admin/online');
    setOnlineAdmins(data.admins || []);
  };

  const fetchAdminLogs = async () => {
    const data = await authedFetch('/api/admin/action-logs');
    setAdminLogs(data.logs || []);
  };

  const refreshSecurityData = async (silent = false) => {
    if (!silent) setSecurityRefreshing(true);
    try {
      await Promise.all([fetchWhitelist(), fetchOnlineAdmins(), fetchAdminLogs()]);
      if (!silent) showOk('管理员安全数据已刷新');
    } catch (e: any) {
      if (!silent) {
        alert(e?.message || '刷新失败');
      } else {
        throw e;
      }
    } finally {
      if (!silent) setSecurityRefreshing(false);
    }
  };

  useEffect(() => {
    if (authStep !== 'done' || activeTab !== 'security') return;
    const timer = window.setInterval(() => {
      refreshSecurityData(true).catch(() => null);
    }, 15000);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authStep, activeTab, adminToken]);

  useEffect(() => {
    setAvatarPreviewFailed(false);
  }, [avatarUrl]);

  useEffect(() => {
    if (activeTab !== 'security') return;
    const me = onlineAdmins.find((x) => toName(x.userName || x.adminName) === toName(adminName));
    const currentAvatar = toName(me?.adminAvatarUrl || me?.avatarUrl || '');
    if (!currentAvatar) return;
    setAvatarUrl((prev) => (prev.trim() ? prev : currentAvatar));
  }, [activeTab, onlineAdmins, adminName]);

  const voteInteractionReport = async (reportId: number, decision: 'ban' | 'reject') => {
    if (!reportId) return;
    if (votingReportId) return;
    try {
      setVotingReportId(reportId);
      const data = await authedFetch(`/api/admin/reports/${reportId}/vote`, {
        method: 'POST',
        body: JSON.stringify({ decision })
      });
      showOk(data.message || '举报投票已提交');
      await fetchData();
      await fetchAdminLogs();
    } catch (e: any) {
      alert(e.message || '举报投票失败');
    } finally {
      setVotingReportId(null);
    }
  };

  // ---------------- 登录流程 ----------------
  const submitCode = (e: React.FormEvent) => {
    e.preventDefault();
    if (!entryCode.trim()) {
      setError('请输入管理员入口代码');
      return;
    }
    setError('');
    setAuthStep('name');
  };

  const submitAdminName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminNameInput.trim()) {
      setError('请输入管理员名字');
      return;
    }
    setAuthLoading(true);
    setError('');
    try {
      const data = await fetch('/api/admin/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entryCode: entryCode.trim(), adminName: adminNameInput.trim() })
      }).then(r => r.json());

      if (!data?.success || !data?.token) {
        throw new Error(data?.message || '管理员验证失败');
      }

      localStorage.setItem(ADMIN_TOKEN_KEY, data.token);
      localStorage.setItem(ADMIN_NAME_KEY, data.adminName || adminNameInput.trim());
      setAdminToken(data.token);
      setAdminName(data.adminName || adminNameInput.trim());
      setAuthStep('done');
      showOk(`欢迎回来，管理员 ${data.adminName || adminNameInput.trim()}`);
      setActiveTab('users');
    } catch (e: any) {
      setError(e.message || '登录失败');
    } finally {
      setAuthLoading(false);
    }
  };

  const logoutAdmin = () => {
    localStorage.removeItem(ADMIN_TOKEN_KEY);
    localStorage.removeItem(ADMIN_NAME_KEY);
    setAdminToken('');
    setAdminName('');
    setEntryCode('');
    setAdminNameInput('');
    setAuthStep('code');
    setUsers([]);
    setInteractionReports([]);
    setItems([]);
    setMonsters([]);
    setSkills([]);
    setArchives([]);
    setWhitelist([]);
    setOnlineAdmins([]);
    setAdminLogs([]);
    setSecurityLogSearch('');
    setSelectedSecurityAdmin('');
    setSecurityRefreshing(false);
    setAvatarPreviewFailed(false);
    setAvatarUrl('');
    setShowReviewConfig(false);
    setFlash('');
    setError('');
  };

  // ---------------- 安全与名单管理 ----------------
  const mergedWhitelist = useMemo(() => {
    const map = new Map<string, AdminWhitelistItem>();
    whitelist.forEach(w => map.set(w.name, w));
    if (!map.has(FIXED_ADMIN_NAME)) {
      map.set(FIXED_ADMIN_NAME, { name: FIXED_ADMIN_NAME, code_name: '固定管理员', enabled: 1 });
    }
    return Array.from(map.values());
  }, [whitelist]);

  const normalizedAdminName = toName(adminName);
  const currentAdminOnline = useMemo(
    () => onlineAdmins.find((x) => toName(x.userName || x.adminName) === normalizedAdminName) || null,
    [onlineAdmins, normalizedAdminName]
  );
  const currentAdminInWhitelist = useMemo(
    () => mergedWhitelist.some((x) => toName(x.name) === normalizedAdminName),
    [mergedWhitelist, normalizedAdminName]
  );
  const avatarInputTrimmed = avatarUrl.trim();
  const avatarInputValid = !avatarInputTrimmed || isLikelyHttpUrl(avatarInputTrimmed);
  const activeAvatarPreview = avatarInputTrimmed || toName(currentAdminOnline?.adminAvatarUrl || currentAdminOnline?.avatarUrl || '');
  const filteredSecurityLogs = useMemo(() => {
    const keyAdmin = toName(selectedSecurityAdmin);
    const keySearch = securityLogSearch.trim().toLowerCase();
    return adminLogs.filter((log) => {
      const byAdmin = !keyAdmin || toName(log.adminName) === keyAdmin;
      if (!byAdmin) return false;
      if (!keySearch) return true;
      const detail = summarizeLogDetail(log.detail).toLowerCase();
      const target = `${toName(log.targetType)} ${toName(log.targetId)}`.toLowerCase();
      const base = `${toName(log.adminName)} ${toName(log.action)}`.toLowerCase();
      return base.includes(keySearch) || target.includes(keySearch) || detail.includes(keySearch);
    });
  }, [adminLogs, selectedSecurityAdmin, securityLogSearch]);

  const addWhitelistAdmin = async () => {
    if (!newAdminName.trim()) return alert('请输入管理员名字');
    try {
      const data = await authedFetch('/api/admin/whitelist', {
        method: 'POST',
        body: JSON.stringify({
          name: newAdminName.trim(),
          codeName: newAdminCodeName.trim() || null
        })
      });
      await fetchWhitelist();
      await fetchAdminLogs();
      setNewAdminName('');
      setNewAdminCodeName('');
      showOk(data.message || `管理员 ${adminName} 编辑了管理员名单：新增 ${newAdminName.trim()}`);
    } catch (e: any) {
      alert(e.message || '添加失败');
    }
  };

  const removeWhitelistAdmin = async (name: string) => {
    if (name === FIXED_ADMIN_NAME) return alert(`固定管理员【${FIXED_ADMIN_NAME}】不可删除`);
    if (!confirm(`确定删除管理员 ${name} 吗？`)) return;
    try {
      const data = await authedFetch(`/api/admin/whitelist/${encodeURIComponent(name)}`, {
        method: 'DELETE'
      });
      await fetchWhitelist();
      await fetchAdminLogs();
      showOk(data.message || `管理员 ${adminName} 编辑了管理员名单：删除 ${name}`);
    } catch (e: any) {
      alert(e.message || '删除失败');
    }
  };

  const updateAdminAvatar = async () => {
    const next = avatarUrl.trim();
    if (next && !isLikelyHttpUrl(next)) {
      alert('头像链接需以 http:// 或 https:// 开头');
      return;
    }
    try {
      const data = await authedFetch('/api/admin/profile/avatar', {
        method: 'PUT',
        body: JSON.stringify({ avatarUrl: next || null })
      });
      if (typeof data?.adminAvatarUrl === 'string') setAvatarUrl(data.adminAvatarUrl);
      setAvatarPreviewFailed(false);
      setSelectedSecurityAdmin(normalizedAdminName || '');
      await refreshSecurityData(true);
      showOk(data.message || `管理员 ${adminName} 编辑了头像`);
    } catch (e: any) {
      alert(e.message || '头像更新失败');
    }
  };

  // ---------------- 归档过滤与导出 ----------------
  const filteredArchives = useMemo(() => {
    if (!archiveSearch.trim()) return archives;
    const term = archiveSearch.toLowerCase();
    return archives.filter(
      a =>
        (a.title && a.title.toLowerCase().includes(term)) ||
        (a.locationName && a.locationName.toLowerCase().includes(term)) ||
        (a.participantNames && a.participantNames.toLowerCase().includes(term))
    );
  }, [archives, archiveSearch]);

  const exportFilteredArchives = () => {
    if (filteredArchives.length === 0) return alert('没有可导出的数据');
    let text = `===== 塔区全域对戏档案库 (共 ${filteredArchives.length} 卷) =====\n\n`;

    filteredArchives.forEach(arc => {
      text += `========================================\n`;
      text += `【归档号】${arc.id}\n`;
      text += `【剧  目】${arc.title}\n`;
      text += `【地  点】${arc.locationName || '未知'}\n`;
      text += `【参演者】${arc.participantNames}\n`;
      text += `【时  间】${new Date(arc.createdAt).toLocaleString()}\n`;
      text += `========================================\n\n`;
      arc.messages?.forEach((m: any) => {
        if (m.type === 'system') text += `[系统]: ${m.content}\n\n`;
        else text += `[${m.senderName}]:\n${m.content}\n\n`;
      });
      text += `\n`;
    });

    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `世界对戏归档库_导出.txt`;
    link.click();
  };

  // ---------------- 用户管理 ----------------
  const handleStatusChange = async (id: number, status: UserStatus, userObj?: AdminUser) => {
    try {
      if (status === 'approved' && userObj?.status === 'pending_ghost') {
        await authedFetch(`/api/admin/users/${id}`, {
          method: 'PUT',
          body: JSON.stringify({
            ...userObj,
            role: '鬼魂',
            physicalRank: '无',
            status: 'approved'
          })
        });
        await fetchData();
        return;
      }

      await authedFetch(`/api/admin/users/${id}/status`, {
        method: 'POST',
        body: JSON.stringify({ status })
      });
      await fetchData();
      showOk(`管理员 ${adminName} 编辑了玩家状态`);
    } catch (e: any) {
      alert(e.message || '状态更新失败');
    }
  };

  const handleDeleteUser = async (id: number) => {
    if (!confirm('⚠️ 警告：确定要彻底删除该角色吗？此操作不可恢复。')) return;
    try {
      await authedFetch(`/api/admin/users/${id}`, { method: 'DELETE' });
      fetchData();
      showOk(`管理员 ${adminName} 删除了玩家 #${id}`);
    } catch (e: any) {
      alert(e.message || '删除失败');
    }
  };

  const handleQuickAgeSave = async (u: AdminUser) => {
    const age = parseAdminAgeValue(ageDrafts[u.id] ?? String(u.age ?? 0));
    if (age === null) {
      alert('年龄必须是 0 到 999 的整数');
      return;
    }
    if (age === Number(u.age ?? 0)) return;
    try {
      setSavingAgeUserId(u.id);
      const data = await authedFetch(`/api/admin/users/${u.id}`, {
        method: 'PUT',
        body: JSON.stringify({ age })
      });
      showOk(data.message || `管理员 ${adminName} 修改了玩家 ${u.name} 的年龄`);
      await fetchData();
    } catch (e: any) {
      alert(e.message || '年龄更新失败');
    } finally {
      setSavingAgeUserId((current) => (current === u.id ? null : current));
    }
  };
  const handleUpdateUser = async () => {
    if (!editingUser) return;
    try {
      await authedFetch(`/api/admin/users/${editingUser.id}`, {
        method: 'PUT',
        body: JSON.stringify(editingUser)
      });
      setEditingUser(null);
      showOk(`管理员 ${adminName} 编辑了玩家 ${editingUser.name}`);
      fetchData();
    } catch (e: any) {
      alert(e.message || '更新失败');
    }
  };

  const handleDeleteUserSkill = async (skillId: number) => {
    if (!editingUser) return;
    if (!confirm('确定要遗忘该技能吗？')) return;
    try {
      await authedFetch(`/api/users/${editingUser.id}/skills/${skillId}`, { method: 'DELETE' });
      fetchUserSkills(editingUser.id);
    } catch (e) {
      alert('删除失败');
    }
  };
    const applyStatusChangeWithVoting = async (u: AdminUser, targetStatus: UserStatus) => {
    const reviewType = inferReviewTypeForUser(u, targetStatus);
    const required = getRequiredApprovals(reviewType);

    // 1票直通：保持你原有体验
    if (required <= 1) {
      await handleStatusChange(u.id, targetStatus, u);
      return;
    }

    const voteKey = buildVoteKey(reviewType, u.id);
    const me = (adminName || '').trim() || '未知管理员';
    const current = reviewVotes[voteKey] || { approveBy: [], rejectBy: [] };
    const isReject = targetStatus === 'rejected';

    if (current.approveBy.includes(me) || current.rejectBy.includes(me)) {
      alert(`你已对该审核投过票（${REVIEW_LABEL[reviewType]}）`);
      return;
    }

    const next: ReviewVoteRecord = {
      approveBy: isReject ? current.approveBy : [...current.approveBy, me],
      rejectBy: isReject ? [...current.rejectBy, me] : current.rejectBy
    };

    setReviewVotes(prev => ({ ...prev, [voteKey]: next }));

    const nowCount = isReject ? next.rejectBy.length : next.approveBy.length;
    if (nowCount < required) {
      showOk(`已记录${REVIEW_LABEL[reviewType]}投票：${nowCount}/${required}（还需 ${required - nowCount} 票）`);
      return;
    }

    // 达阈值，执行原变更
    await handleStatusChange(u.id, targetStatus, u);

    // 清理该条票仓
    setReviewVotes(prev => {
      const cp = { ...prev };
      delete cp[voteKey];
      return cp;
    });

    showOk(`${REVIEW_LABEL[reviewType]}已达 ${required} 票，变更已执行`);
  };


  // ---------------- 物品与技能 ----------------
  const applyItemOriginPreset = (locationTag: string) => {
    const picked = ITEM_ORIGIN_OPTIONS.find((x) => x.value === locationTag);
    setNewItem((prev) => ({
      ...prev,
      locationTag,
      faction: picked?.faction || locationTag || '通用'
    }));
  };

  const addItem = async () => {
    if (!newItem.name.trim() || !newItem.locationTag.trim()) {
      alert('请填写物品名称和地点标签');
      return;
    }
    try {
      const data = await authedFetch('/api/admin/items', {
        method: 'POST',
        body: JSON.stringify(newItem)
      });
      setNewItem({
        name: '',
        description: '',
        locationTag: 'slums',
        price: 0,
        faction: '西市',
        tier: '低阶',
        itemType: '回复道具',
        effectValue: 0
      });
      fetchData();
      showOk(data.message || `管理员 ${adminName} 编辑了物品 ${newItem.name}`);
    } catch (e: any) {
      alert(e.message || '新增失败');
    }
  };

  const addMonster = async () => {
    if (!newMonster.name.trim()) {
      alert('请填写怪物名称');
      return;
    }
    try {
      const data = await authedFetch('/api/admin/monsters', {
        method: 'POST',
        body: JSON.stringify(newMonster)
      });
      setNewMonster({
        name: '',
        description: '',
        minLevel: 1,
        maxLevel: 10,
        basePower: 10,
        baseHp: 100,
        dropItemName: 'Monster Core',
        dropChance: 0.7
      });
      fetchData();
      showOk(data.message || `管理员 ${adminName} 编辑了怪物 ${newMonster.name}`);
    } catch (e: any) {
      alert(e.message || '新增怪物失败');
    }
  };

  const editMonster = async (monster: GlobalMonster) => {
    if (!monster?.id) return;
    setEditingMonster(monster);
    setEditingMonsterDraft({
      name: String(monster.name || ''),
      description: String(monster.description || ''),
      minLevel: Number(monster.minLevel || 1),
      maxLevel: Number(monster.maxLevel || 1),
      basePower: Number(monster.basePower || 10),
      baseHp: Number(monster.baseHp || 100),
      dropItemName: String(monster.dropItemName || 'Monster Core'),
      dropChance: Number(monster.dropChance || 0.7),
      enabled: Number(monster.enabled || 0) ? 1 : 0
    });
  };

  const saveEditingMonster = async () => {
    if (!editingMonster?.id) return;
    const name = String(editingMonsterDraft.name || '').trim();
    if (!name) return alert('怪物名称不能为空');
    const payload = {
      name,
      description: String(editingMonsterDraft.description || ''),
      minLevel: Math.max(1, Number(editingMonsterDraft.minLevel || 1)),
      maxLevel: Math.max(1, Number(editingMonsterDraft.maxLevel || 1)),
      basePower: Math.max(1, Number(editingMonsterDraft.basePower || 1)),
      baseHp: Math.max(10, Number(editingMonsterDraft.baseHp || 10)),
      dropItemName: String(editingMonsterDraft.dropItemName || '').trim() || 'Monster Core',
      dropChance: Math.max(0.05, Math.min(1, Number(editingMonsterDraft.dropChance || 0.7))),
      enabled: Number(editingMonsterDraft.enabled || 0) ? 1 : 0
    };
    if (payload.maxLevel < payload.minLevel) {
      payload.maxLevel = payload.minLevel;
    }
    try {
      const data = await authedFetch(`/api/admin/monsters/${editingMonster.id}`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      });
      setEditingMonster(null);
      await fetchData();
      showOk(data.message || `管理员 ${adminName} 编辑了怪物 ${name}`);
    } catch (e: any) {
      alert(e.message || '更新怪物失败');
    }
  };

  const toggleMonsterEnabled = async (monster: GlobalMonster) => {
    if (!monster?.id) return;
    const nextEnabled = Number(monster.enabled || 0) ? 0 : 1;
    try {
      const data = await authedFetch(`/api/admin/monsters/${monster.id}`, {
        method: 'PUT',
        body: JSON.stringify({ enabled: nextEnabled })
      });
      await fetchData();
      showOk(
        data.message ||
          `管理员 ${adminName} ${nextEnabled ? '启用' : '停用'}了怪物 ${monster.name || monster.id}`
      );
    } catch (e: any) {
      alert(e.message || '切换怪物启用状态失败');
    }
  };

  const addSkill = async () => {
    if (!newSkill.name.trim()) {
      alert('请填写技能名称');
      return;
    }
    try {
      const data = await authedFetch('/api/admin/skills', {
        method: 'POST',
        body: JSON.stringify(newSkill)
      });
      setNewSkill({ name: '', faction: '物理系', tier: '低阶', description: '', npcId: '' });
      fetchData();
      showOk(data.message || `管理员 ${adminName} 编辑了技能 ${newSkill.name}`);
    } catch (e: any) {
      alert(e.message || '新增失败');
    }
  };

  const bootstrapDefaultCatalog = async () => {
    if (bootstrappingCatalog) return;
    try {
      setBootstrappingCatalog(true);
      const data = await authedFetch('/api/admin/catalog/bootstrap-defaults', {
        method: 'POST'
      });
      await fetchData();
      showOk(data.message || '默认物品与技能已补齐');
    } catch (e: any) {
      alert(e.message || '补齐默认数据失败');
    } finally {
      setBootstrappingCatalog(false);
    }
  };
  const filteredSkills = useMemo(() => {
  if (skillFactionFilter === 'ALL') return skills;
  return skills.filter(s => s.faction === skillFactionFilter);
}, [skills, skillFactionFilter]);

  

const reviewStats = useMemo(() => {
  const stats: Record<ReviewType, { total: number; pending: number; approved: number; rejected: number }> = {
    create_role: { total: 0, pending: 0, approved: 0, rejected: 0 },
    death: { total: 0, pending: 0, approved: 0, rejected: 0 },
    reskin: { total: 0, pending: 0, approved: 0, rejected: 0 },
    role_vote: { total: 0, pending: 0, approved: 0, rejected: 0 },
    custom_game: { total: 0, pending: 0, approved: 0, rejected: 0 }
  };

  users.forEach((u) => {
    if (u.status === 'pending') {
      stats.create_role.total++;
      stats.create_role.pending++;
    } else if (u.status === 'approved') {
      stats.create_role.total++;
      stats.create_role.approved++;
    } else if (u.status === 'rejected') {
      stats.create_role.total++;
      stats.create_role.rejected++;
    } else if (u.status === 'pending_death') {
      stats.death.total++;
      stats.death.pending++;
    } else if (u.status === 'pending_ghost') {
      stats.reskin.total++;
      stats.reskin.pending++;
    }
  });

  return stats;
}, [users]);


  // ---------------- 公告 ----------------
  const publishAnnouncement = async () => {
    if (!newAnnouncement.title.trim() || !newAnnouncement.content.trim()) {
      alert('请填写公告标题与内容');
      return;
    }
    try {
      const data = await authedFetch('/api/admin/announcements', {
        method: 'POST',
        body: JSON.stringify(newAnnouncement)
      });
      setNewAnnouncement({ type: 'system', title: '', content: '' });
      await fetchAdminLogs();
      showOk(data.message || `管理员 ${adminName} 编辑了公告 ${newAnnouncement.title}`);
    } catch (e: any) {
      alert(e.message || '发布失败');
    }
  };
    // ---------------- 本地审核规则/投票记录 ----------------
  useEffect(() => {
    try {
      const rulesRaw = localStorage.getItem(REVIEW_RULES_STORAGE_KEY);
      if (rulesRaw) {
        const parsed = JSON.parse(rulesRaw);
        if (Array.isArray(parsed) && parsed.length) {
          setReviewRules(parsed);
        }
      }
    } catch {}

    try {
      const votesRaw = localStorage.getItem(REVIEW_VOTES_STORAGE_KEY);
      if (votesRaw) {
        const parsed = JSON.parse(votesRaw);
        if (parsed && typeof parsed === 'object') {
          setReviewVotes(parsed);
        }
      }
    } catch {}
  }, []);

  useEffect(() => {
    localStorage.setItem(REVIEW_RULES_STORAGE_KEY, JSON.stringify(reviewRules));
  }, [reviewRules]);

  useEffect(() => {
    localStorage.setItem(REVIEW_VOTES_STORAGE_KEY, JSON.stringify(reviewVotes));
  }, [reviewVotes]);


  // ---------------- 登录UI：代码步骤 ----------------
  if (authStep === 'code') {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-white border border-slate-200 rounded-3xl p-8 shadow-sm">
          <h2 className="text-2xl font-black mb-2 flex items-center gap-2">
            <Shield className="text-sky-600" size={22} />
            管理员入口
          </h2>
          <p className="text-sm text-slate-500 mb-6">第一步：输入管理员入口代码</p>

          <form onSubmit={submitCode} className="space-y-3">
            <input
              type="password"
              className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-sky-500/20 font-bold"
              placeholder="请输入代码"
              value={entryCode}
              onChange={e => setEntryCode(e.target.value)}
              autoFocus
            />
            <button className="w-full py-3 rounded-2xl bg-slate-900 text-white font-black hover:bg-slate-800">
              下一步
            </button>
          </form>

          {error && <p className="text-rose-500 text-sm mt-3 font-bold">{error}</p>}
        </div>
      </div>
    );
  }

  // ---------------- 登录UI：名字步骤 ----------------
  if (authStep === 'name') {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-white border border-slate-200 rounded-3xl p-8 shadow-sm">
          <h2 className="text-2xl font-black mb-2 flex items-center gap-2">
            <UserCheck className="text-indigo-600" size={22} />
            管理员身份确认
          </h2>
          <p className="text-sm text-slate-500 mb-6">
            第二步：输入管理员名字
          </p>

          <form onSubmit={submitAdminName} className="space-y-3">
            <input
              type="text"
              className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-sky-500/20 font-bold"
              placeholder="请输入管理员名字"
              value={adminNameInput}
              onChange={e => setAdminNameInput(e.target.value)}
              autoFocus
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setAuthStep('code')}
                className="w-1/3 py-3 rounded-2xl bg-slate-100 text-slate-600 font-black"
              >
                返回
              </button>
              <button
                type="submit"
                disabled={authLoading}
                className="flex-1 py-3 rounded-2xl bg-slate-900 text-white font-black hover:bg-slate-800 disabled:opacity-60"
              >
                {authLoading ? '验证中...' : '进入后台'}
              </button>
            </div>
          </form>

          {error && <p className="text-rose-500 text-sm mt-3 font-bold">{error}</p>}
        </div>
      </div>
    );
  }

  // ---------------- 后台主界面 ----------------
  return (
    <div className="min-h-screen bg-[#f8fafc] p-8 font-sans text-slate-800">
      <div className="max-w-[1450px] mx-auto">
        <header className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
          <h1 className="text-3xl font-black tracking-tighter flex items-center gap-3">
            命之塔 <span className="text-sky-600 bg-sky-50 px-3 py-1 rounded-xl text-xl">管理后台</span>
          </h1>
          <div className="flex items-center gap-2">
            <span className="text-xs px-3 py-2 rounded-xl bg-white border border-slate-200 font-bold text-slate-600">
              当前管理员：{adminName || '-'}
            </span>
            <button
              onClick={fetchData}
              className="px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
              title="刷新"
            >
              <RefreshCw size={16} />
            </button>
            <button
              onClick={logoutAdmin}
              className="px-3 py-2 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 hover:bg-rose-100 flex items-center gap-1"
            >
              <LogOut size={14} /> 退出
            </button>
          </div>
        </header>

        <nav className="flex flex-wrap bg-white p-1.5 rounded-2xl shadow-sm border border-slate-200 mb-6">
          <TabBtn active={activeTab === 'users'} onClick={() => setActiveTab('users')} icon={<UserIcon size={18} />} label="角色审核与管理" />
          <TabBtn active={activeTab === 'logs'} onClick={() => setActiveTab('logs')} icon={<MessageSquare size={18} />} label="对戏区域归档" />
          <TabBtn active={activeTab === 'items'} onClick={() => setActiveTab('items')} icon={<Package size={18} />} label="世界物品库" />
          <TabBtn active={activeTab === 'skills'} onClick={() => setActiveTab('skills')} icon={<Zap size={18} />} label="派系技能库" />
          <TabBtn active={activeTab === 'announcements'} onClick={() => setActiveTab('announcements')} icon={<Megaphone size={18} />} label="公告管理" />
          <TabBtn active={activeTab === 'custom_games'} onClick={() => setActiveTab('custom_games')} icon={<Gamepad2 size={18} />} label="灾厄游戏审核" />
          <TabBtn active={activeTab === 'security'} onClick={() => setActiveTab('security')} icon={<KeyRound size={18} />} label="管理员安全" />
        </nav>

        {loading && <div className="mb-4 text-xs text-slate-500 font-bold">加载中...</div>}
        {flash && <div className="mb-4 text-sm px-4 py-2 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold">{flash}</div>}
        {error && <div className="mb-4 text-sm px-4 py-2 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 font-bold">{error}</div>}

        <AnimatePresence mode="wait">
          {/* 1) 用户 */}
          {activeTab === 'users' && (
            <motion.div key="users" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-[32px] shadow-sm border border-slate-200 overflow-hidden">
                            <div className="p-5 border-b border-slate-200 bg-slate-50/60">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="text-sm font-black text-slate-700">审核规则与统计</div>
                  <button
                    onClick={() => setShowReviewConfig(v => !v)}
                    className="px-3 py-2 rounded-xl bg-indigo-600 text-white text-xs font-black hover:bg-indigo-700"
                  >
                    {showReviewConfig ? '收起配置' : '展开配置'}
                  </button>
                </div>

                {showReviewConfig && (
                  <div className="mt-4 grid grid-cols-1 xl:grid-cols-2 gap-4">
                    <div className="bg-white border border-slate-200 rounded-2xl p-4">
                      <div className="text-xs font-black text-slate-500 uppercase mb-3">通过人数门槛</div>
                      <div className="space-y-2">
                        {(Object.keys(REVIEW_LABEL) as ReviewType[]).map((t) => (
                          <div key={t} className="flex items-center justify-between gap-3">
                            <span className="text-sm font-bold text-slate-700">{REVIEW_LABEL[t]}</span>
                            <input
                              type="number"
                              min={1}
                              value={getRequiredApprovals(t)}
                              onChange={(e) => setRequiredApprovals(t, Number(e.target.value))}
                              className="w-24 p-2 bg-slate-50 border border-slate-200 rounded-lg text-center font-bold text-sm"
                            />
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="bg-white border border-slate-200 rounded-2xl p-4">
                      <div className="text-xs font-black text-slate-500 uppercase mb-3">当前统计</div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {(Object.keys(REVIEW_LABEL) as ReviewType[]).map((t) => {
                          const s = reviewStats[t];
                          return (
                            <div key={t} className="p-3 rounded-xl border border-slate-100 bg-slate-50">
                              <div className="text-sm font-black text-slate-800">{REVIEW_LABEL[t]}</div>
                              <div className="text-[12px] text-slate-500 mt-1">总计：{s.total}</div>
                              <div className="text-[12px] text-amber-600">待审：{s.pending}</div>
                              <div className="text-[12px] text-emerald-600">通过：{s.approved}</div>
                              <div className="text-[12px] text-rose-600">驳回：{s.rejected}</div>
                              <div className="text-[11px] text-indigo-600 mt-1">门槛：{getRequiredApprovals(t)} 人</div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="p-5 border-b border-slate-200 bg-white">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-black text-slate-700 flex items-center gap-2">
                      <ShieldAlert size={16} className="text-rose-500" />
                      举报投票封号
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1">
                      封号阈值：{reportVoteThreshold} 票
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      value={reportStatusFilter}
                      onChange={(e) =>
                        setReportStatusFilter(
                          e.target.value as 'all' | 'pending' | 'voting' | 'banned' | 'rejected'
                        )
                      }
                      className="px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-700"
                    >
                      <option value="all">全部状态</option>
                      <option value="pending">待处理</option>
                      <option value="voting">投票中</option>
                      <option value="banned">已封号</option>
                      <option value="rejected">已驳回</option>
                    </select>
                    <button
                      onClick={fetchData}
                      className="px-3 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-black hover:bg-slate-200"
                    >
                      刷新举报
                    </button>
                  </div>
                </div>

                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-left whitespace-nowrap">
                    <thead className="bg-slate-50 border-b text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      <tr>
                        <th className="p-4">举报信息</th>
                        <th className="p-4">理由</th>
                        <th className="p-4">票数</th>
                        <th className="p-4">状态</th>
                        <th className="p-4 text-right">投票操作</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm">
                      {interactionReports.map((rp) => {
                        const closed = rp.status === 'banned' || rp.status === 'rejected';
                        return (
                          <tr key={rp.id} className="hover:bg-slate-50/60">
                            <td className="p-4">
                              <div className="text-xs font-black text-slate-700"># {rp.id}</div>
                              <div className="text-xs text-slate-500 mt-1">
                                举报人：{rp.reporterName || `#${rp.reporterId}`}
                              </div>
                              <div className="text-xs text-slate-500">
                                被举报：{rp.targetName || `#${rp.targetId}`}
                              </div>
                            </td>
                            <td className="p-4">
                              <div className="text-xs text-slate-700 max-w-[420px] whitespace-normal break-words">
                                {rp.reason || '（无理由）'}
                              </div>
                              <div className="text-[10px] text-slate-400 mt-1">
                                {new Date(rp.createdAt).toLocaleString()}
                              </div>
                            </td>
                            <td className="p-4">
                              <div className="text-xs font-bold text-rose-600">封号票：{rp.banVotes}</div>
                              <div className="text-xs font-bold text-slate-600">驳回票：{rp.rejectVotes}</div>
                            </td>
                            <td className="p-4">
                              {rp.status === 'pending' && <Badge cls="bg-amber-50 text-amber-600 border-amber-200" text="待处理" />}
                              {rp.status === 'voting' && <Badge cls="bg-indigo-50 text-indigo-600 border-indigo-200" text="投票中" />}
                              {rp.status === 'banned' && <Badge cls="bg-rose-50 text-rose-600 border-rose-200" text="已封号" />}
                              {rp.status === 'rejected' && <Badge cls="bg-slate-100 text-slate-600 border-slate-200" text="已驳回" />}
                            </td>
                            <td className="p-4">
                              <div className="flex justify-end gap-2">
                                <button
                                  disabled={closed || votingReportId === rp.id}
                                  onClick={() => voteInteractionReport(rp.id, 'ban')}
                                  className="px-3 py-1.5 rounded-lg bg-rose-100 text-rose-700 text-xs font-black hover:bg-rose-200 disabled:opacity-50"
                                >
                                  投票封号
                                </button>
                                <button
                                  disabled={closed || votingReportId === rp.id}
                                  onClick={() => voteInteractionReport(rp.id, 'reject')}
                                  className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 text-xs font-black hover:bg-slate-200 disabled:opacity-50"
                                >
                                  投票驳回
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      {interactionReports.length === 0 && (
                        <tr>
                          <td colSpan={5} className="p-6 text-center text-slate-400 text-xs">
                            当前没有可显示的举报单
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left whitespace-nowrap">
                  <thead className="bg-slate-50 border-b text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    <tr>
                      <th className="p-6">角色档案 / 年龄</th>
                      <th className="p-6">归属派系 / 等级</th>
                      <th className="p-6">当前位置</th>
                      <th className="p-6">塔区许可状态</th>
                      <th className="p-6 text-right">管理操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {users.map((u) => {
                      const ageDraft = ageDrafts[u.id] ?? String(u.age ?? 0);
                      const parsedAgeDraft = parseAdminAgeValue(ageDraft);
                      const ageInputInvalid = ageDraft.trim() !== '' && parsedAgeDraft === null;
                      const ageDirty = parsedAgeDraft !== null && parsedAgeDraft !== Number(u.age ?? 0);
                      return (
                      <tr key={u.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="p-6">
                          <div className="font-black text-slate-900 text-base mb-1">{u.name}</div>
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-black ${(u.age ?? 0) < 16 ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-500'}`}>
                              {(u.age ?? 0)} 岁
                            </span>
                            <span className="text-xs text-slate-400 font-medium">{(u.age ?? 0) < 16 ? '未分化幼崽' : (u.role || '未分化')}</span>
                          </div>
                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            <input
                              type="number"
                              min={0}
                              max={999}
                              value={ageDraft}
                              onChange={e => setAgeDrafts(prev => ({ ...prev, [u.id]: e.target.value }))}
                              className={`w-24 rounded-lg border px-3 py-1.5 text-sm font-bold outline-none transition ${ageInputInvalid ? 'border-rose-300 bg-rose-50 text-rose-700 focus:ring-2 focus:ring-rose-500/20' : 'border-slate-200 bg-white text-slate-700 focus:ring-2 focus:ring-sky-500/20'}`}
                            />
                            <button
                              onClick={() => handleQuickAgeSave(u)}
                              disabled={savingAgeUserId === u.id || !ageDirty}
                              className="px-3 py-1.5 rounded-lg bg-sky-600 text-white text-xs font-black hover:bg-sky-500 disabled:bg-slate-200 disabled:text-slate-400 disabled:hover:bg-slate-200 transition-colors"
                            >
                              {savingAgeUserId === u.id ? '保存中...' : '保存年龄'}
                            </button>
                          </div>
                          <div className={`text-[10px] mt-2 ${ageInputInvalid ? 'text-rose-500' : 'text-slate-400'}`}>
                            {ageInputInvalid ? '年龄必须是 0 到 999 的整数' : '保存后会自动同步身份和家园归属'}
                          </div>
                        </td>

                        <td className="p-6">
                          <div className="text-xs font-black text-sky-600 uppercase tracking-widest mb-1">{u.faction || '—'}</div>
                          <div className="text-[11px] font-mono font-bold text-slate-500">
                            神: <span className="text-sky-500">{u.mentalRank || '—'}</span> / 体: <span className="text-rose-500">{u.physicalRank || '—'}</span>
                          </div>
                        </td>

                        <td className="p-6 text-slate-500 text-xs font-medium flex items-center gap-1 mt-3">
                          <MapPin size={14} className="text-slate-300" /> {u.currentLocation || '暂未登录'}
                        </td>

                        <td className="p-6">
                          {u.status === 'pending' && <Badge cls="bg-amber-50 text-amber-600 border-amber-200" text="待审核" />}
                          {u.status === 'approved' && <Badge cls="bg-emerald-50 text-emerald-600 border-emerald-200" text="已过审" />}
                          {u.status === 'rejected' && <Badge cls="bg-rose-50 text-rose-600 border-rose-200" text="已驳回" />}
                          {u.status === 'banned' && <Badge cls="bg-rose-700 text-white border-rose-700" text="已封号" />}
                          {u.status === 'dead' && <Badge cls="bg-slate-100 text-slate-600 border-slate-200" text="已死亡" />}
                          {u.status === 'ghost' && <Badge cls="bg-violet-50 text-violet-700 border-violet-200" text="鬼魂" />}
                          {u.status === 'pending_death' && <Badge cls="bg-rose-600 text-white border-rose-600" text="死亡待审" />}
                          {u.status === 'pending_ghost' && <Badge cls="bg-violet-600 text-white border-violet-600" text="化鬼待审" />}
                        </td>

                        <td className="p-6">
                          <div className="flex items-center justify-end gap-3">
                            {u.status === 'pending' && (
                              <div className="flex gap-2 mr-4 border-r pr-4">
                                <button onClick={() => applyStatusChangeWithVoting(u, 'approved')} className="p-1.5 bg-emerald-100 text-emerald-600 rounded-lg hover:bg-emerald-500 hover:text-white transition-colors" title="通过">
                                  <CheckCircle size={18} />
                                </button>
                                <button onClick={() => applyStatusChangeWithVoting(u, 'rejected')} className="p-1.5 bg-rose-100 text-rose-600 rounded-lg hover:bg-rose-500 hover:text-white transition-colors" title="驳回">
                                  <XCircle size={18} />
                                </button>
                                <span className="text-[10px] text-slate-400 font-bold ml-1">
  通过票 {getVoteProgress(u, 'approved').count}/{getVoteProgress(u, 'approved').required}
</span>

                              </div>
                            )}

                            {(u.status === 'pending_death' || u.status === 'pending_ghost') && (
                              <div className="flex gap-2 mr-4 border-r pr-4">
                                <button
                                  onClick={() => alert(`【玩家谢幕戏文本】\n${u.deathDescription || '无内容'}`)}
                                  className="p-1.5 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 text-xs font-black"
                                >
                                  查看谢幕戏
                                </button>

                                {u.status === 'pending_death' && (
                                  <button
                                    onClick={() => applyStatusChangeWithVoting(u, 'dead')}
                                    className="p-1.5 bg-rose-100 text-rose-600 rounded-lg hover:bg-rose-500 hover:text-white transition-colors"
                                    title="准许死亡"
                                  >
                                    <CheckCircle size={18} />
                                  </button>
                                )}

                                {u.status === 'pending_ghost' && (
                                  <button
                                    onClick={() => applyStatusChangeWithVoting(u, 'approved')}
                                    className="p-1.5 bg-violet-100 text-violet-600 rounded-lg hover:bg-violet-500 hover:text-white transition-colors"
                                    title="准许化鬼"
                                  >
                                    <CheckCircle size={18} />
                                  </button>
                                )}

                                <button
                                  onClick={() => applyStatusChangeWithVoting(u, 'rejected')}
                                  className="p-1.5 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-300 transition-colors"
                                  title="驳回"
                                >
                                  <XCircle size={18} />
                                </button>
                              </div>
                            )}

                            <button onClick={() => setEditingUser(u)} className="flex items-center gap-1 text-sky-600 text-xs font-bold hover:bg-sky-50 px-3 py-1.5 rounded-lg transition-colors">
                              <Edit3 size={14} /> 编辑
                            </button>
                            <button onClick={() => handleDeleteUser(u.id)} className="flex items-center gap-1 text-rose-500 text-xs font-bold hover:bg-rose-50 px-3 py-1.5 rounded-lg transition-colors">
                              <Trash2 size={14} /> 删除
                            </button>
                          </div>
                        </td>
                      </tr>
                      );
                    })}
                    {users.length === 0 && (
                      <tr>
                        <td colSpan={5} className="p-10 text-center text-slate-400">
                          暂无玩家数据
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}

          {/* 2) 对戏归档 */}
          {activeTab === 'logs' && (
            <motion.div key="logs" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
              <div className="bg-white rounded-3xl border border-slate-200 p-6 flex flex-col md:flex-row gap-4 items-center justify-between shadow-sm">
                <div className="flex-1 w-full relative">
                  <Filter className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input
                    type="text"
                    value={archiveSearch}
                    onChange={e => setArchiveSearch(e.target.value)}
                    placeholder="输入玩家名字、剧目标题或地点名称进行检索..."
                    className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-sky-500/20 text-sm font-bold text-slate-700"
                  />
                </div>
                <button onClick={exportFilteredArchives} className="w-full md:w-auto flex justify-center items-center gap-2 px-6 py-3 bg-slate-900 text-white font-black rounded-xl hover:bg-slate-800 transition-colors shadow-lg whitespace-nowrap">
                  <Download size={16} /> 导出当前结果 (TXT)
                </button>
              </div>

              {filteredArchives.length === 0 ? (
                <div className="text-center py-20 text-slate-400 font-bold bg-white rounded-3xl border border-slate-200">没有找到匹配的归档记录。</div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {filteredArchives.map(arc => (
                    <div key={arc.id} className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                      <div className="bg-slate-50 p-5 border-b border-slate-100">
                        <div className="flex items-start justify-between gap-3 mb-2">
  <h3 className="text-lg font-black text-slate-900">{arc.title}</h3>
  <button
    onClick={() => handleDeleteArchive(arc)}
    disabled={deletingArchiveId === arc.id}
    className="text-xs px-3 py-1.5 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 disabled:opacity-60"
  >
    {deletingArchiveId === arc.id ? '删除中...' : '删除存档'}
  </button>
</div>

                        <div className="flex flex-wrap gap-2 text-xs font-bold">
                          <span className="px-2 py-1 bg-sky-100 text-sky-700 rounded-md flex items-center gap-1"><MapPin size={12} /> {arc.locationName || '未知'}</span>
                          <span className="px-2 py-1 bg-indigo-100 text-indigo-700 rounded-md flex items-center gap-1"><Users size={12} /> {arc.participantNames}</span>
                          <span className="px-2 py-1 bg-slate-200 text-slate-600 rounded-md ml-auto">{new Date(arc.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <div className="p-5 flex-1 max-h-[350px] overflow-y-auto custom-scrollbar bg-slate-50/50 space-y-4">
                        {arc.messages?.map((m, idx) => (
                          m.type === 'system' ? (
                            <div key={idx} className="text-center text-[10px] font-bold text-slate-400 my-2">— {m.content} —</div>
                          ) : (
                            <div key={idx} className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                              <span className="text-[10px] font-black text-sky-600 block mb-1">{m.senderName}</span>
                              <p className="text-sm text-slate-700 whitespace-pre-wrap">{m.content}</p>
                            </div>
                          )
                        ))}
                        {(!arc.messages || arc.messages.length === 0) && <p className="text-slate-400 text-xs text-center">空档案：该会话没有产生任何聊天记录。</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* 3) 物品 */}
          {activeTab === 'items' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-1 bg-white p-8 rounded-[32px] border border-slate-200 shadow-sm h-fit sticky top-8">
                <h3 className="font-black text-lg mb-6 flex items-center gap-2">
                  <Package size={20} className="text-amber-500" /> 部署新物品
                </h3>
                <button
                  onClick={bootstrapDefaultCatalog}
                  disabled={bootstrappingCatalog}
                  className="w-full mb-4 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-black hover:bg-indigo-700 disabled:opacity-60"
                >
                  {bootstrappingCatalog ? '补齐中...' : '一键补齐默认道具+技能'}
                </button>
                <div className="space-y-4">
                  <Input label="物品名称" value={newItem.name} onChange={(v: string) => setNewItem({ ...newItem, name: v })} />
                  <Input
                    label="所属地点标签（决定闲逛掉落地点，如 西市 / 东市 / 全图）"
                    value={newItem.locationTag}
                    onChange={(v: string) => setNewItem({ ...newItem, locationTag: v.trim(), faction: v.trim() || '通用' })}
                  />

                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase ml-1">地点快捷选择</label>
                      <select className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-sky-500/20 text-sm font-bold" value={ITEM_ORIGIN_OPTIONS.some((x) => x.value === newItem.locationTag) ? newItem.locationTag : ''} onChange={(e) => applyItemOriginPreset(e.target.value)}>
                        <option value="">自定义标签（手填）</option>
                        {ITEM_ORIGIN_OPTIONS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                      </select>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase ml-1">道具品阶</label>
                      <select className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-sky-500/20 text-sm font-bold" value={newItem.tier} onChange={(e) => setNewItem({ ...newItem, tier: e.target.value })}>
                        {TIERS.map((t) => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase ml-1">道具类型</label>
                      <select className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-sky-500/20 text-sm font-bold" value={newItem.itemType} onChange={(e) => setNewItem({ ...newItem, itemType: e.target.value })}>
                        {ITEM_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                    <Input label="效果数值/回收金" type="number" value={String(newItem.effectValue)} onChange={(v: string) => setNewItem({ ...newItem, effectValue: parseInt(v, 10) || 0 })} />
                  </div>

                  <textarea
                    placeholder="物品效果描述..."
                    className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-sky-500/20 text-sm h-20"
                    value={newItem.description}
                    onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                  />
                  <button onClick={addItem} className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black hover:bg-slate-800 transition-all shadow-lg mt-2">
                    上传至世界数据库
                  </button>

                  <div className="pt-4 mt-2 border-t border-slate-200">
                    <h4 className="font-black text-sm mb-3 flex items-center gap-2 text-rose-700">
                      <Skull size={16} />
                      自定义界外怪物
                    </h4>
                    <div className="space-y-3">
                      <Input label="怪物名称" value={newMonster.name} onChange={(v: string) => setNewMonster({ ...newMonster, name: v })} />
                      <Input label="怪物描述" value={newMonster.description} onChange={(v: string) => setNewMonster({ ...newMonster, description: v })} />

                      <div className="grid grid-cols-2 gap-2">
                        <Input label="最低等级" type="number" value={String(newMonster.minLevel)} onChange={(v: string) => setNewMonster({ ...newMonster, minLevel: parseInt(v, 10) || 1 })} />
                        <Input label="最高等级" type="number" value={String(newMonster.maxLevel)} onChange={(v: string) => setNewMonster({ ...newMonster, maxLevel: parseInt(v, 10) || 1 })} />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <Input label="基础战力" type="number" value={String(newMonster.basePower)} onChange={(v: string) => setNewMonster({ ...newMonster, basePower: parseInt(v, 10) || 1 })} />
                        <Input label="基础生命" type="number" value={String(newMonster.baseHp)} onChange={(v: string) => setNewMonster({ ...newMonster, baseHp: parseInt(v, 10) || 1 })} />
                      </div>
                      <Input label="掉落道具名" value={newMonster.dropItemName} onChange={(v: string) => setNewMonster({ ...newMonster, dropItemName: v })} />
                      <Input label="掉落概率(0~1)" type="number" value={String(newMonster.dropChance)} onChange={(v: string) => setNewMonster({ ...newMonster, dropChance: Math.max(0.05, Math.min(1, parseFloat(v) || 0.7)) })} />
                      <button onClick={addMonster} className="w-full py-3 bg-rose-600 text-white rounded-2xl font-black hover:bg-rose-500 transition-all shadow-lg">
                        保存怪物模板
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="lg:col-span-2 space-y-6">
                <div className="bg-white rounded-[32px] border border-slate-200 shadow-sm overflow-hidden">
                  <table className="w-full text-left">
                  <thead className="bg-slate-50 border-b text-[11px] font-bold text-slate-400 uppercase">
                    <tr>
                      <th className="p-6">物品信息</th>
                      <th className="p-6">类别/属性</th>
                      <th className="p-6 text-right">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {items.map((i: any) => (
                      <tr key={i.id} className="hover:bg-slate-50/50">
                        <td className="p-6">
                          <div className="font-bold text-slate-900">{i.name}</div>
                          <div className="text-xs text-slate-400 mt-1 max-w-xs truncate">{i.description || '无描述'}</div>
                          <div className="text-[10px] font-mono text-amber-600 mt-1">价值: {i.price || 0} G</div>
                          <div className="text-[10px] text-slate-500 mt-1">
                            地点标签: {ITEM_ORIGIN_OPTIONS.find((x) => x.value === i.locationTag)?.label || i.locationTag || '全地图掉落'} · 产地: {i.faction || '通用'}
                          </div>
                        </td>
                        <td className="p-6">
                          <div className="flex gap-1 mb-1">
                            <span className="px-2 py-0.5 bg-amber-50 text-amber-700 rounded text-[10px] font-black">{i.tier || '低阶'}</span>
                            <span className="px-2 py-0.5 bg-sky-50 text-sky-700 rounded text-[10px] font-black">{i.itemType || '未知'}</span>
                          </div>
                          <div className="text-[10px] text-slate-400">效用值: <span className="font-bold">{i.effectValue || 0}</span></div>
                        </td>
                        <td className="p-6 text-right">
                          <button
                            onClick={async () => {
                              if (!confirm('确定删除该物品？')) return;
                              await authedFetch(`/api/admin/items/${i.id}`, { method: 'DELETE' });
                              fetchData();
                              showOk(`管理员 ${adminName} 编辑了物品库：删除 ${i.name}`);
                            }}
                            className="text-slate-300 hover:text-rose-500 p-2"
                          >
                            <Trash2 size={18} />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {items.length === 0 && (
                      <tr>
                        <td colSpan={3} className="p-10 text-center text-slate-400">
                          暂无物品数据
                        </td>
                      </tr>
                    )}
                  </tbody>
                  </table>
                </div>

                <div className="bg-white rounded-[28px] border border-slate-200 shadow-sm overflow-hidden">
                  <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2 text-sm font-black text-slate-700">
                    <Skull size={16} className="text-rose-500" />
                    界外怪物模板
                  </div>
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 border-b text-[11px] font-bold text-slate-400 uppercase">
                      <tr>
                        <th className="p-4">怪物</th>
                        <th className="p-4">等级/战力</th>
                        <th className="p-4">掉落</th>
                        <th className="p-4 text-right">操作</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {monsters.map((m) => (
                        <tr key={m.id} className="hover:bg-slate-50/60">
                          <td className="p-4">
                            <div className="font-bold text-slate-900 flex items-center gap-2">
                              <span>{m.name}</span>
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-black ${
                                  Number(m.enabled || 0)
                                    ? 'bg-emerald-50 text-emerald-700'
                                    : 'bg-slate-200 text-slate-600'
                                }`}
                              >
                                {Number(m.enabled || 0) ? '启用中' : '已停用'}
                              </span>
                            </div>
                            <div className="text-xs text-slate-400 mt-1">{m.description || '无描述'}</div>
                          </td>
                          <td className="p-4 text-xs text-slate-600">
                            等级 {m.minLevel || 1} - 等级 {m.maxLevel || 1}
                            <div className="mt-1">战力 {m.basePower || 0} | 生命 {m.baseHp || 0}</div>
                          </td>
                          <td className="p-4 text-xs text-slate-600">
                            {m.dropItemName || 'Monster Core'}
                            <div className="mt-1 text-[11px]">概率 {(Number(m.dropChance || 0) * 100).toFixed(0)}%</div>
                          </td>
                          <td className="p-4 text-right">
                            <button
                              onClick={() => editMonster(m)}
                              className="text-slate-300 hover:text-sky-600 p-2"
                              title="编辑怪物"
                            >
                              <Edit3 size={15} />
                            </button>
                            <button
                              onClick={() => toggleMonsterEnabled(m)}
                              className={`p-2 ${Number(m.enabled || 0) ? 'text-amber-500 hover:text-amber-700' : 'text-emerald-600 hover:text-emerald-700'}`}
                              title={Number(m.enabled || 0) ? '停用怪物' : '启用怪物'}
                            >
                              {Number(m.enabled || 0) ? <XCircle size={15} /> : <CheckCircle size={15} />}
                            </button>
                            <button
                              onClick={async () => {
                                if (!confirm('确定删除该怪物模板？')) return;
                                await authedFetch(`/api/admin/monsters/${m.id}`, { method: 'DELETE' });
                                fetchData();
                                showOk(`管理员 ${adminName} 编辑了怪物库：删除 ${m.name}`);
                              }}
                              className="text-slate-300 hover:text-rose-500 p-2"
                            >
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      ))}
                      {monsters.length === 0 && (
                        <tr>
                          <td colSpan={4} className="p-8 text-center text-slate-400 text-sm">
                            暂无怪物模板
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* 4) 技能 */}
          {activeTab === 'skills' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-1 bg-white p-8 rounded-[32px] border border-slate-200 shadow-sm h-fit sticky top-8">
                <h3 className="font-black text-lg mb-6 flex items-center gap-2">
                  <Zap size={20} className="text-sky-500" /> 录入派系奥义
                </h3>
                <button
                  onClick={bootstrapDefaultCatalog}
                  disabled={bootstrappingCatalog}
                  className="w-full mb-4 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-black hover:bg-indigo-700 disabled:opacity-60"
                >
                  {bootstrappingCatalog ? '补齐中...' : '一键补齐默认道具+技能'}
                </button>
                <div className="space-y-4">
                  <Input label="技能名称" value={newSkill.name} onChange={(v: string) => setNewSkill({ ...newSkill, name: v })} />
                  <div className="flex gap-2">
                    <div className="flex-1 flex flex-col gap-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase ml-1">专属派系限制</label>
                      <select className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-sky-500/20 text-sm font-bold" value={newSkill.faction} onChange={(e) => setNewSkill({ ...newSkill, faction: e.target.value })}>
                        {FACTIONS.map((f) => (
                          <option key={f} value={f}>{f}</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex-1 flex flex-col gap-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase ml-1">阶级分类</label>
                      <select className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-sky-500/20 text-sm font-bold" value={newSkill.tier} onChange={(e) => setNewSkill({ ...newSkill, tier: e.target.value })}>
                        {TIERS.map((t) => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <Input label="角色ID（可选）" value={newSkill.npcId} onChange={(v: string) => setNewSkill({ ...newSkill, npcId: v })} />
                  <textarea
                    placeholder="技能效果详细描述..."
                    className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-sky-500/20 text-sm h-32"
                    value={newSkill.description}
                    onChange={(e) => setNewSkill({ ...newSkill, description: e.target.value })}
                  />
                  <button onClick={addSkill} className="w-full py-4 bg-sky-600 text-white rounded-2xl font-black hover:bg-sky-700 transition-all shadow-lg mt-2">
                    发布技能模板
                  </button>
                </div>
              </div>

              <div className="lg:col-span-2 space-y-4">
                <div className="bg-white p-4 rounded-2xl border border-slate-200 flex items-center gap-4 shadow-sm">
                  <Filter size={16} className="text-slate-400" />
                  <span className="text-xs font-bold text-slate-500">技能库筛选:</span>
                  <select
                    value={skillFactionFilter}
                    onChange={e => setSkillFactionFilter(e.target.value)}
                    className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-sky-500/20"
                  >
                    <option value="ALL">全部派系</option>
                    {FACTIONS.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {filteredSkills.map((s) => (
                    <div key={s.id} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm relative group hover:border-sky-300 transition-colors">
                      <button
                        onClick={async () => {
                          if (!confirm('确定删除该技能？')) return;
                          await authedFetch(`/api/admin/skills/${s.id}`, { method: 'DELETE' });
                          fetchData();
                          showOk(`管理员 ${adminName} 编辑了技能库：删除 ${s.name}`);
                        }}
                        className="absolute top-6 right-6 text-slate-200 hover:text-rose-500 transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                      <div className="flex gap-2 mb-3">
                        <span className="inline-block px-2.5 py-1 bg-sky-50 text-sky-600 rounded-lg text-[10px] font-black uppercase tracking-widest">
                          {s.faction || '未分类'}
                        </span>
                        <span className="inline-block px-2.5 py-1 bg-amber-50 text-amber-600 rounded-lg text-[10px] font-black uppercase tracking-widest">
                          {s.tier || '低阶'}
                        </span>
                      </div>
                      <div className="font-black text-lg text-slate-900 mb-2">{s.name}</div>
                      <p className="text-xs text-slate-500 leading-relaxed">{s.description || '暂无描述'}</p>
                    </div>
                  ))}
                  {filteredSkills.length === 0 && <div className="text-slate-400 text-sm p-4 text-center">该分类下暂无技能数据</div>}
                </div>
              </div>
            </div>
          )}

          {/* 5) 公告 */}
          {activeTab === 'announcements' && (
            <motion.div key="ann" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm">
                <h3 className="text-lg font-black mb-4 flex items-center gap-2">
                  <Megaphone size={18} className="text-amber-500" />
                  发布全服公告
                </h3>
                <div className="space-y-3">
                  <Input label="公告类型 (system/vote_open/game_start)" value={newAnnouncement.type} onChange={(v) => setNewAnnouncement({ ...newAnnouncement, type: v })} />
                  <Input label="公告标题" value={newAnnouncement.title} onChange={(v) => setNewAnnouncement({ ...newAnnouncement, title: v })} />
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase ml-1">公告内容</label>
                    <textarea
                      className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-sky-500/20 text-sm min-h-[180px]"
                      value={newAnnouncement.content}
                      onChange={(e) => setNewAnnouncement({ ...newAnnouncement, content: e.target.value })}
                    />
                  </div>
                  <button onClick={publishAnnouncement} className="w-full py-3 rounded-2xl bg-slate-900 text-white font-black hover:bg-slate-800">
                    发布公告
                  </button>
                </div>
              </div>

              <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm">
                <h3 className="text-lg font-black mb-4">最近管理员操作</h3>
                <div className="max-h-[420px] overflow-auto custom-scrollbar space-y-2">
                  {adminLogs.length === 0 && <p className="text-slate-400 text-sm">暂无日志</p>}
                  {adminLogs.slice(0, 50).map(log => (
                    <div key={log.id} className="border border-slate-100 rounded-xl p-3 bg-slate-50">
                      <div className="text-sm font-bold">管理员 {log.adminName} {log.action}</div>
                      <div className="text-[11px] text-slate-400 mt-1">{new Date(log.createdAt).toLocaleString()}</div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {/* 6) 灾厄游戏审核 */}
          {activeTab === 'custom_games' && (
            <motion.div key="custom_games" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm">
              <AdminCustomGamesView />
            </motion.div>
          )}

          {/* 7) 管理员安全 */}
          {activeTab === 'security' && (
            <motion.div key="sec" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              <div className="bg-slate-50 rounded-3xl border border-slate-200 p-5 xl:col-span-3">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div>
                    <h3 className="font-black text-lg text-slate-900">安全联动状态</h3>
                    <p className="text-xs text-slate-500 mt-1">
                      当前管理员：{normalizedAdminName || '-'} · 在线管理员 {onlineAdmins.length} 人 · 日志 {adminLogs.length} 条
                    </p>
                    <div className="flex flex-wrap gap-2 mt-3">
                      <span className={`px-2 py-1 rounded-lg text-[11px] font-bold ${currentAdminInWhitelist ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                        {currentAdminInWhitelist ? '白名单已匹配' : '白名单未匹配'}
                      </span>
                      <span className={`px-2 py-1 rounded-lg text-[11px] font-bold ${currentAdminOnline ? 'bg-sky-100 text-sky-700' : 'bg-amber-100 text-amber-700'}`}>
                        {currentAdminOnline ? `在线：${toRelativeTime(currentAdminOnline.lastSeenAt)}` : '当前账号未出现在在线列表'}
                      </span>
                      {selectedSecurityAdmin && (
                        <span className="px-2 py-1 rounded-lg text-[11px] font-bold bg-indigo-100 text-indigo-700">
                          日志筛选：{selectedSecurityAdmin}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setSelectedSecurityAdmin('');
                        setSecurityLogSearch('');
                      }}
                      className="px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-100"
                    >
                      清空筛选
                    </button>
                    <button
                      onClick={() => refreshSecurityData(false)}
                      disabled={securityRefreshing}
                      className="px-3 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 disabled:opacity-60 flex items-center gap-2"
                    >
                      <RefreshCw size={14} className={securityRefreshing ? 'animate-spin' : ''} />
                      刷新安全数据
                    </button>
                  </div>
                </div>
              </div>

              {/* 名单管理 */}
              <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm xl:col-span-1">
                <h3 className="font-black text-lg mb-4 flex items-center gap-2">
                  <Shield size={18} className="text-indigo-500" />
                  管理员名单
                </h3>

                <div className="space-y-2 max-h-64 overflow-auto custom-scrollbar mb-4">
                  {mergedWhitelist.map((w) => (
                    <div key={w.name} className={`border rounded-xl p-3 flex justify-between items-center ${toName(w.name) === normalizedAdminName ? 'border-indigo-300 bg-indigo-50/40' : 'border-slate-100'}`}>
                      <div>
                        <div className="font-bold text-sm">
                          {w.name}
                          {toName(w.name) === normalizedAdminName && (
                            <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700">当前</span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400">{w.code_name || '无代号'}</div>
                      </div>
                      <button
                        disabled={w.name === FIXED_ADMIN_NAME}
                        onClick={() => removeWhitelistAdmin(w.name)}
                        className="text-xs px-2 py-1 rounded bg-rose-50 text-rose-600 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        删除
                      </button>
                    </div>
                  ))}
                </div>

                <div className="space-y-2">
                  <Input label="新增管理员名字" value={newAdminName} onChange={setNewAdminName} />
                  <Input label="管理员代号(可选)" value={newAdminCodeName} onChange={setNewAdminCodeName} />
                  <button onClick={addWhitelistAdmin} className="w-full py-3 rounded-2xl bg-slate-900 text-white font-black hover:bg-slate-800">
                    添加到名单
                  </button>
                </div>
              </div>

              {/* 在线管理员 */}
              <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm xl:col-span-1">
                <h3 className="font-black text-lg mb-4 flex items-center gap-2">
                  <Users size={18} className="text-sky-500" />
                  后台在线管理员
                  <span className="ml-1 text-xs px-2 py-0.5 rounded bg-sky-100 text-sky-700">{onlineAdmins.length}</span>
                </h3>
                <p className="text-[11px] text-slate-500 mb-3">点击管理员条目可联动筛选右侧操作日志</p>
                <div className="space-y-2 max-h-80 overflow-auto custom-scrollbar">
                  {onlineAdmins.length === 0 && <p className="text-slate-400 text-sm">暂无在线管理员</p>}
                  {onlineAdmins.map((a) => (
                    <button
                      key={`${a.userId}-${toName(a.userName || a.adminName)}`}
                      type="button"
                      onClick={() => {
                        const target = toName(a.userName || a.adminName);
                        setSelectedSecurityAdmin((prev) => (prev === target ? '' : target));
                      }}
                      className={`w-full text-left border rounded-xl p-2 flex items-center gap-3 transition-colors ${
                        toName(a.userName || a.adminName) === selectedSecurityAdmin
                          ? 'border-sky-300 bg-sky-50'
                          : 'border-slate-100 hover:border-slate-300'
                      }`}
                    >
                      {toName(a.adminAvatarUrl || a.avatarUrl) ? (
                        <img
                          src={toName(a.adminAvatarUrl || a.avatarUrl)}
                          alt={a.userName}
                          className="w-10 h-10 rounded-full object-cover border"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full border bg-slate-100 text-slate-500 flex items-center justify-center text-sm font-black">
                          {(toName(a.userName || a.adminName) || 'A').slice(0, 1)}
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="font-bold text-sm truncate">
                          {toName(a.userName || a.adminName)}
                          {toName(a.userName || a.adminName) === normalizedAdminName && (
                            <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700">当前</span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {toRelativeTime(a.lastSeenAt)} · {new Date(a.lastSeenAt).toLocaleString()}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* 头像和日志 */}
              <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm xl:col-span-1">
                <h3 className="font-black text-lg mb-4">管理员头像与操作日志</h3>
                <div className="flex items-center gap-3 border border-slate-200 rounded-2xl p-3 bg-slate-50">
                  {activeAvatarPreview && !avatarPreviewFailed ? (
                    <img
                      src={activeAvatarPreview}
                      alt="avatar-preview"
                      className="w-12 h-12 rounded-full border object-cover"
                      onError={() => setAvatarPreviewFailed(true)}
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full border bg-slate-100 text-slate-500 flex items-center justify-center font-black">
                      {(normalizedAdminName || 'A').slice(0, 1)}
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-slate-700 truncate">头像预览</div>
                    <div className="text-[11px] text-slate-400 truncate">
                      {activeAvatarPreview && !avatarPreviewFailed ? activeAvatarPreview : '未设置可用头像链接'}
                    </div>
                  </div>
                </div>
                <div className="mt-3">
                  <Input
                    label="头像链接"
                    value={avatarUrl}
                    onChange={(v) => {
                      setAvatarUrl(v);
                      setAvatarPreviewFailed(false);
                    }}
                  />
                  {!avatarInputValid && <p className="text-xs text-rose-500 mt-1">链接格式无效，请填写完整网页链接</p>}
                </div>
                <div className="mt-2 flex gap-2">
                  <button
                    onClick={updateAdminAvatar}
                    disabled={!avatarInputValid}
                    className="flex-1 py-3 rounded-2xl bg-indigo-600 text-white font-black hover:bg-indigo-700 disabled:opacity-60"
                  >
                    更新头像
                  </button>
                  <button
                    onClick={() => {
                      setAvatarUrl('');
                      setAvatarPreviewFailed(false);
                    }}
                    className="px-3 py-3 rounded-2xl bg-slate-100 text-slate-600 font-black hover:bg-slate-200"
                  >
                    清空
                  </button>
                </div>

                <div className="mt-5 border-t pt-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-bold text-sm">近期日志</h4>
                    <span className="text-[11px] text-slate-400">
                      {Math.min(filteredSecurityLogs.length, 40)} / {filteredSecurityLogs.length}
                    </span>
                  </div>
                  <input
                    value={securityLogSearch}
                    onChange={(e) => setSecurityLogSearch(e.target.value)}
                    placeholder="搜索日志关键字/目标编号/动作..."
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs outline-none focus:ring-2 focus:ring-sky-500/20 mb-2"
                  />
                  {selectedSecurityAdmin && (
                    <button
                      onClick={() => setSelectedSecurityAdmin('')}
                      className="mb-2 text-[11px] px-2 py-1 rounded bg-indigo-50 text-indigo-600 hover:bg-indigo-100"
                    >
                      取消管理员筛选：{selectedSecurityAdmin}
                    </button>
                  )}
                  <div className="max-h-56 overflow-auto custom-scrollbar space-y-2">
                    {filteredSecurityLogs.slice(0, 40).map(log => (
                      <button
                        key={log.id}
                        type="button"
                        onClick={() => setSelectedSecurityAdmin(toName(log.adminName))}
                        className="w-full text-left text-xs p-2 rounded-lg bg-slate-50 border border-slate-100 hover:border-slate-300"
                      >
                        <div className="font-bold">管理员 {log.adminName} {log.action}</div>
                        <div className="mt-1 flex items-center gap-1 text-[10px] text-slate-500">
                          <span className="px-1.5 py-0.5 rounded bg-slate-200 text-slate-700">{log.targetType || 'system'}</span>
                          {log.targetId && <span className="px-1.5 py-0.5 rounded bg-slate-200 text-slate-700">#{log.targetId}</span>}
                        </div>
                        {!!summarizeLogDetail(log.detail) && (
                          <div className="text-[10px] text-slate-500 mt-1 break-all">{summarizeLogDetail(log.detail)}</div>
                        )}
                        <div className="text-[10px] text-slate-400 mt-1">{new Date(log.createdAt).toLocaleString()}</div>
                      </button>
                    ))}
                    {adminLogs.length === 0 ? (
                      <div className="text-xs text-slate-400">暂无日志</div>
                    ) : (
                      filteredSecurityLogs.length === 0 && <div className="text-xs text-slate-400">暂无匹配日志</div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 编辑怪物弹窗 */}
      <AnimatePresence>
        {editingMonster && (
          <div className="fixed inset-0 z-[190] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-[32px] p-8 w-full max-w-xl shadow-2xl relative"
            >
              <button
                onClick={() => setEditingMonster(null)}
                className="absolute top-5 right-5 text-slate-400 hover:text-slate-900 bg-slate-100 p-2 rounded-full transition-colors"
              >
                <X size={18} />
              </button>
              <h3 className="text-xl font-black mb-1 flex items-center gap-2">
                <Skull size={18} className="text-rose-500" />
                编辑界外怪物
              </h3>
              <p className="text-xs text-slate-500 mb-5">编号：{editingMonster.id}</p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="怪物名称"
                  value={String(editingMonsterDraft.name || '')}
                  onChange={(v: string) => setEditingMonsterDraft({ ...editingMonsterDraft, name: v })}
                />
                <Input
                  label="掉落道具名"
                  value={String(editingMonsterDraft.dropItemName || '')}
                  onChange={(v: string) => setEditingMonsterDraft({ ...editingMonsterDraft, dropItemName: v })}
                />
                <Input
                  label="最低等级"
                  type="number"
                  value={String(editingMonsterDraft.minLevel || 1)}
                  onChange={(v: string) => setEditingMonsterDraft({ ...editingMonsterDraft, minLevel: parseInt(v, 10) || 1 })}
                />
                <Input
                  label="最高等级"
                  type="number"
                  value={String(editingMonsterDraft.maxLevel || 1)}
                  onChange={(v: string) => setEditingMonsterDraft({ ...editingMonsterDraft, maxLevel: parseInt(v, 10) || 1 })}
                />
                <Input
                  label="基础战力"
                  type="number"
                  value={String(editingMonsterDraft.basePower || 1)}
                  onChange={(v: string) => setEditingMonsterDraft({ ...editingMonsterDraft, basePower: parseFloat(v) || 1 })}
                />
                <Input
                  label="基础生命"
                  type="number"
                  value={String(editingMonsterDraft.baseHp || 10)}
                  onChange={(v: string) => setEditingMonsterDraft({ ...editingMonsterDraft, baseHp: parseInt(v, 10) || 10 })}
                />
                <Input
                  label="掉落概率(0~1)"
                  type="number"
                  value={String(editingMonsterDraft.dropChance || 0.7)}
                  onChange={(v: string) =>
                    setEditingMonsterDraft({
                      ...editingMonsterDraft,
                      dropChance: Math.max(0.05, Math.min(1, parseFloat(v) || 0.7))
                    })
                  }
                />
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-1">启用状态</label>
                  <select
                    value={String(editingMonsterDraft.enabled || 0)}
                    onChange={(e) =>
                      setEditingMonsterDraft({ ...editingMonsterDraft, enabled: Number(e.target.value) ? 1 : 0 })
                    }
                    className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-sky-500/20 transition-all font-bold text-sm text-slate-700"
                  >
                    <option value="1">启用</option>
                    <option value="0">停用</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-1 mb-1.5 block">怪物描述</label>
                  <textarea
                    value={String(editingMonsterDraft.description || '')}
                    onChange={(e) => setEditingMonsterDraft({ ...editingMonsterDraft, description: e.target.value })}
                    className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-sky-500/20 text-sm min-h-[96px]"
                  />
                </div>
              </div>

              <div className="mt-6 flex gap-3">
                <button
                  onClick={() => setEditingMonster(null)}
                  className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-2xl font-black hover:bg-slate-200"
                >
                  取消
                </button>
                <button
                  onClick={saveEditingMonster}
                  className="flex-[1.5] py-3 bg-slate-900 text-white rounded-2xl font-black hover:bg-slate-800"
                >
                  保存怪物模板
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 编辑用户弹窗 */}
      <AnimatePresence>
        {editingUser && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-[40px] p-10 w-full max-w-2xl shadow-2xl relative my-8"
            >
              <button onClick={() => setEditingUser(null)} className="absolute top-8 right-8 text-slate-400 hover:text-slate-900 bg-slate-100 p-2 rounded-full transition-colors">
                <X size={20} />
              </button>

              <h3 className="text-2xl font-black mb-2 flex items-center gap-2">
                <ShieldAlert className="text-amber-500" /> 修改玩家档案
              </h3>
              <p className="text-sm text-slate-500 mb-8 ml-8">
                正在编辑: <span className="font-bold text-slate-900">{editingUser.name}</span>
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Input label="年龄 (自动判定是否圣所未分化)" type="number" value={editingUser.age?.toString() || '0'} onChange={(v: string) => setEditingUser({ ...editingUser, age: parseInt(v, 10) || 0 })} />
                <Input label="身份 (哨兵/向导/鬼魂/普通人)" value={editingUser.role || ''} onChange={(v: string) => setEditingUser({ ...editingUser, role: v })} />
                <Input label="所属派系" value={editingUser.faction || ''} onChange={(v: string) => setEditingUser({ ...editingUser, faction: v })} />
                <Input label="专属能力" value={editingUser.ability || ''} onChange={(v: string) => setEditingUser({ ...editingUser, ability: v })} />
                <Input label="精神力等级" value={editingUser.mentalRank || ''} onChange={(v: string) => setEditingUser({ ...editingUser, mentalRank: v })} />
                <Input label="肉体强度等级" value={editingUser.physicalRank || ''} onChange={(v: string) => setEditingUser({ ...editingUser, physicalRank: v })} />
                <Input label="精神体名称" value={editingUser.spiritName || ''} onChange={(v: string) => setEditingUser({ ...editingUser, spiritName: v })} />
                <Input label="全局账号密码 (留空即无密码)" value={editingUser.password || ''} onChange={(v: string) => setEditingUser({ ...editingUser, password: v })} />

                <div className="col-span-1 md:col-span-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-1 mb-1.5 block">个人资料文本</label>
                  <textarea
                    className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-sky-500/20 text-sm min-h-[120px]"
                    value={editingUser.profileText || ''}
                    onChange={(e) => setEditingUser({ ...editingUser, profileText: e.target.value })}
                  />
                </div>
              </div>

              <div className="mt-8 pt-8 border-t border-slate-100">
                <h4 className="font-black text-slate-800 mb-4 flex items-center gap-2">
                  <Zap size={16} className="text-indigo-500" />
                  玩家已习得技能
                  <span className="text-xs font-normal text-slate-400 ml-2">({editingUserSkills.length})</span>
                </h4>

                {editingUserSkills.length === 0 ? (
                  <div className="p-4 bg-slate-50 rounded-2xl text-xs text-slate-400 text-center border border-dashed border-slate-200">
                    该玩家尚未习得任何技能
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3 max-h-40 overflow-y-auto custom-scrollbar p-1">
                    {editingUserSkills.map(skill => (
                      <div key={skill.id} className="flex justify-between items-center p-3 bg-indigo-50/50 border border-indigo-100 rounded-xl">
                        <div>
                          <div className="font-bold text-sm text-indigo-900">{skill.name}</div>
                          <div className="text-[10px] font-black text-amber-500 uppercase">等级 {skill.level}</div>
                        </div>
                        <button
                          onClick={() => handleDeleteUserSkill(skill.id)}
                          className="p-1.5 bg-white text-slate-400 hover:text-rose-500 rounded-lg shadow-sm border border-slate-100 transition-colors"
                          title="遗忘/删除此技能"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="mt-8 flex gap-4">
                <button onClick={() => setEditingUser(null)} className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black hover:bg-slate-200 transition-colors">
                  取消
                </button>
                <button onClick={handleUpdateUser} className="flex-[2] py-4 bg-slate-900 text-white rounded-2xl font-black hover:bg-slate-800 transition-all shadow-xl shadow-slate-200">
                  强制覆写并保存数据
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <style
        dangerouslySetInnerHTML={{
          __html: `
          .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
          .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
          .custom-scrollbar::-webkit-scrollbar-thumb { background-color: #e2e8f0; border-radius: 20px; }
        `
        }}
      />
    </div>
  );
}

function Badge({ text, cls }: { text: string; cls: string }) {
  return <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black border ${cls}`}>{text}</span>;
}

function TabBtn({
  active,
  onClick,
  icon,
  label
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-5 py-3 rounded-xl transition-all font-black text-[13px] ${
        active ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:text-slate-700 hover:bg-slate-50'
      }`}
    >
      {icon} {label}
    </button>
  );
}

function Input({
  label,
  value,
  onChange,
  type = 'text',
  placeholder = ''
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[10px] font-black text-slate-400 uppercase ml-1">{label}</label>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-sky-500/20 transition-all font-bold text-sm text-slate-700"
      />
    </div>
  );
}

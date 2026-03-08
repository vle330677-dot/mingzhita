import { useCallback, useEffect, useMemo, useState } from 'react';
import { AdminCustomGamesView } from './AdminCustomGamesView';
import { ADMIN_NAME_KEY, ADMIN_TOKEN_KEY, apiFetch, clearAdminSession } from '../utils/http';
import { BookOpen, CheckCircle2, Edit3, Gamepad2, Megaphone, Package, RefreshCw, ShieldAlert, Skull, Trash2, Users, X } from 'lucide-react';
import { AdminItemsPanel } from './admin/AdminItemsPanel';
import { AdminSkillsPanel } from './admin/AdminSkillsPanel';
import { AdminReportsPanel } from './admin/AdminReportsPanel';
import { AdminAdminsPanel } from './admin/AdminAdminsPanel';

type AdminTab = 'users' | 'messages' | 'items' | 'skills' | 'reports' | 'monsters' | 'admins' | 'custom_games';
type UserStatus = 'pending' | 'approved' | 'dead' | 'ghost' | 'rejected' | 'pending_death' | 'pending_ghost' | 'banned';
interface AdminUser { id: number; name: string; age?: number; role?: string; faction?: string; job?: string; ability?: string; spiritName?: string; mentalRank?: string; physicalRank?: string; gold?: number; currentLocation?: string; profileText?: string; password?: string; status: UserStatus; }
interface UserSkill { id: number; skillId?: number; name: string; level: number; faction?: string; tier?: string; }
interface AdminMessage { id: number; userName: string; title: string; content: string; status: string; createdAt: string; handledAt?: string; }
interface MonsterRow { id?: number; name: string; description?: string; minLevel?: number; maxLevel?: number; basePower?: number; baseHp?: number; dropItemName?: string; dropChance?: number; enabled?: number; }

const STATUS_OPTIONS: UserStatus[] = ['pending', 'approved', 'rejected', 'pending_death', 'pending_ghost', 'dead', 'ghost', 'banned'];
const EMPTY_MONSTER: MonsterRow = { name: '', description: '', minLevel: 1, maxLevel: 6, basePower: 8, baseHp: 90, dropItemName: '怪物核心', dropChance: 0.7, enabled: 1 };
const USER_STATUS_LABELS: Record<UserStatus, string> = {
  pending: '待审核',
  approved: '已通过',
  rejected: '已驳回',
  pending_death: '待确认死亡',
  pending_ghost: '待确认鬼魂',
  dead: '已死亡',
  ghost: '鬼魂',
  banned: '已封禁',
};
const MESSAGE_STATUS_LABELS: Record<string, string> = {
  open: '待处理',
  resolved: '已处理',
};

function formatUserStatus(status: UserStatus | string) {
  return USER_STATUS_LABELS[status as UserStatus] || String(status || '未设置');
}

function formatMessageStatus(status: string) {
  return MESSAGE_STATUS_LABELS[String(status || '')] || String(status || '未设置');
}

export function AdminView() {
  const [tab, setTab] = useState<AdminTab>('users');
  const [loginName, setLoginName] = useState(localStorage.getItem(ADMIN_NAME_KEY) || '');
  const [entryCode, setEntryCode] = useState('');
  const [sessionTick, setSessionTick] = useState(0);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState('');
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [userFilter, setUserFilter] = useState('');
  const [messages, setMessages] = useState<AdminMessage[]>([]);
  const [monsters, setMonsters] = useState<MonsterRow[]>([]);
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [editingUserSkills, setEditingUserSkills] = useState<UserSkill[]>([]);
  const [availableSkills, setAvailableSkills] = useState<Array<{ name: string; faction?: string; tier?: string }>>([]);
  const [grantSkillName, setGrantSkillName] = useState('');
  const [editingMonster, setEditingMonster] = useState<MonsterRow | null>(null);
  const [announcementTitle, setAnnouncementTitle] = useState('');
  const [announcementContent, setAnnouncementContent] = useState('');
  const hasSession = Boolean(localStorage.getItem(ADMIN_TOKEN_KEY));

  const authedFetch = useCallback((url: string, options: any = {}) => apiFetch<any>(url, { auth: 'admin', ...options }), []);
  const filteredUsers = useMemo(() => {
    const keyword = userFilter.trim().toLowerCase();
    if (!keyword) return users;
    return users.filter((user) => [user.name, user.status, user.role, user.job, user.faction].some((x) => String(x || '').toLowerCase().includes(keyword)));
  }, [userFilter, users]);

  const flash = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice((current) => (current === message ? '' : current)), 2800);
  };

  const loadUsers = useCallback(async () => {
    const data = await authedFetch('/api/admin/users');
    setUsers(Array.isArray(data.users) ? data.users : []);
  }, [authedFetch]);
  const loadMessages = useCallback(async () => {
    const data = await authedFetch('/api/admin/announcements/messages');
    setMessages(Array.isArray(data.rows) ? data.rows : []);
  }, [authedFetch]);
  const loadMonsters = useCallback(async () => {
    const data = await authedFetch('/api/admin/monsters');
    setMonsters(Array.isArray(data.monsters) ? data.monsters : []);
  }, [authedFetch]);
  const refreshAll = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([loadUsers(), loadMessages(), loadMonsters()]);
      setRefreshNonce((value) => value + 1);
    } catch (e: any) {
      flash(e?.message || '管理员数据加载失败');
    } finally {
      setLoading(false);
    }
  }, [loadMessages, loadMonsters, loadUsers]);

  useEffect(() => { if (hasSession) refreshAll(); }, [hasSession, refreshAll, sessionTick]);

  const handleLogin = async () => {
    if (!loginName.trim() || !entryCode.trim()) { flash('请输入管理员名字和入口码'); return; }
    setLoading(true);
    try {
      const data = await apiFetch<any>('/api/admin/auth/login', { method: 'POST', body: { adminName: loginName.trim(), entryCode: entryCode.trim() } });
      localStorage.setItem(ADMIN_TOKEN_KEY, String(data.token || ''));
      localStorage.setItem(ADMIN_NAME_KEY, String(data.adminName || loginName.trim()));
      setEntryCode('');
      setSessionTick((v) => v + 1);
      flash('管理员登录成功');
    } catch (e: any) {
      flash(e?.message || '管理员登录失败');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    clearAdminSession();
    setEditingUser(null);
    setEditingMonster(null);
    setSessionTick((v) => v + 1);
  };

  const updateUserStatus = async (userId: number, status: UserStatus) => {
    try {
      const data = await authedFetch(`/api/admin/users/${userId}/status`, { method: 'POST', body: { status } });
      flash(data.message || '状态已更新');
      await loadUsers();
    } catch (e: any) {
      flash(e?.message || '更新玩家状态失败');
    }
  };

  const openEditUser = async (user: AdminUser) => {
    setEditingUser({ ...user, password: '' });
    setGrantSkillName('');
    try {
      const [skillData, availableData] = await Promise.all([
        authedFetch(`/api/users/${user.id}/skills`),
        authedFetch(`/api/skills/available/${user.id}`),
      ]);
      setEditingUserSkills(Array.isArray(skillData.skills) ? skillData.skills : []);
      setAvailableSkills(Array.isArray(availableData.skills) ? availableData.skills : []);
    } catch {
      setEditingUserSkills([]);
      setAvailableSkills([]);
    }
  };

  const reloadEditingUserSkills = async (userId: number) => {
    const [skillData, availableData] = await Promise.all([
      authedFetch(`/api/users/${userId}/skills`),
      authedFetch(`/api/skills/available/${userId}`),
    ]);
    setEditingUserSkills(Array.isArray(skillData.skills) ? skillData.skills : []);
    setAvailableSkills(Array.isArray(availableData.skills) ? availableData.skills : []);
  };

  const grantUserSkill = async () => {
    if (!editingUser || !grantSkillName.trim()) return;
    try {
      const data = await authedFetch(`/api/users/${editingUser.id}/skills`, { method: 'POST', body: { name: grantSkillName.trim() } });
      flash(data.message || '技能已授予');
      setGrantSkillName('');
      await reloadEditingUserSkills(editingUser.id);
      await loadUsers();
    } catch (e: any) {
      flash(e?.message || '授予技能失败');
    }
  };

  const saveUser = async () => {
    if (!editingUser) return;
    try {
      const data = await authedFetch(`/api/admin/users/${editingUser.id}`, { method: 'PUT', body: editingUser });
      flash(data.message || '玩家资料已保存');
      setEditingUser(null);
      await loadUsers();
    } catch (e: any) {
      flash(e?.message || '保存玩家资料失败');
    }
  };

  const deleteUserSkill = async (skillId: number) => {
    if (!editingUser) return;
    try {
      await authedFetch(`/api/users/${editingUser.id}/skills/${skillId}`, { method: 'DELETE' });
      await reloadEditingUserSkills(editingUser.id);
      flash('技能已删除');
    } catch (e: any) {
      flash(e?.message || '删除技能失败');
    }
  };

  const deleteUser = async (user: AdminUser) => {
    if (!window.confirm(`确认删除玩家 ${user.name}？`)) return;
    try {
      const data = await authedFetch(`/api/admin/users/${user.id}`, { method: 'DELETE' });
      flash(data.message || '玩家已删除');
      await loadUsers();
    } catch (e: any) {
      flash(e?.message || '删除玩家失败');
    }
  };
  const submitAnnouncement = async () => {
    if (!announcementTitle.trim() || !announcementContent.trim()) { flash('请填写公告标题和内容'); return; }
    try {
      const data = await authedFetch('/api/admin/announcements', { method: 'POST', body: { type: 'system', title: announcementTitle.trim(), content: announcementContent.trim() } });
      flash(data.message || '公告已发布');
      setAnnouncementTitle('');
      setAnnouncementContent('');
      await loadMessages();
    } catch (e: any) { flash(e?.message || '发布公告失败'); }
  };

  const updateMessageStatus = async (messageId: number, status: 'open' | 'resolved') => {
    try {
      const data = await authedFetch(`/api/admin/announcements/messages/${messageId}`, { method: 'PATCH', body: { status } });
      flash(data.message || '留言状态已更新');
      await loadMessages();
    } catch (e: any) { flash(e?.message || '更新留言失败'); }
  };

  const deleteMessage = async (messageId: number) => {
    if (!window.confirm('确认删除这条留言？')) return;
    try {
      const data = await authedFetch(`/api/admin/announcements/messages/${messageId}`, { method: 'DELETE' });
      flash(data.message || '留言已删除');
      await loadMessages();
    } catch (e: any) { flash(e?.message || '删除留言失败'); }
  };

  const saveMonster = async () => {
    if (!editingMonster?.name?.trim()) { flash('请填写怪物名称'); return; }
    try {
      const payload = { ...editingMonster, enabled: Number(editingMonster.enabled ?? 1) ? 1 : 0 };
      const data = editingMonster.id
        ? await authedFetch(`/api/admin/monsters/${editingMonster.id}`, { method: 'PUT', body: payload })
        : await authedFetch('/api/admin/monsters', { method: 'POST', body: payload });
      flash(data.message || '怪物已保存');
      setEditingMonster(null);
      await loadMonsters();
    } catch (e: any) { flash(e?.message || '保存怪物失败'); }
  };

  const deleteMonster = async (monster: MonsterRow) => {
    if (!monster.id || !window.confirm(`确认删除怪物 ${monster.name}？`)) return;
    try {
      const data = await authedFetch(`/api/admin/monsters/${monster.id}`, { method: 'DELETE' });
      flash(data.message || '怪物已删除');
      await loadMonsters();
    } catch (e: any) { flash(e?.message || '删除怪物失败'); }
  };

  if (!hasSession) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6">
        <div className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900/90 p-8 shadow-2xl">
          <div className="flex items-center gap-3 mb-6"><ShieldAlert className="text-amber-400" /><div><div className="text-2xl font-black">管理员后台</div><div className="text-sm text-slate-400">输入管理员名字与入口码登录</div></div></div>
          <div className="space-y-3">
            <Field label="管理员名字" value={loginName} onChange={setLoginName} placeholder="例如：塔" />
            <Field label="入口码" value={entryCode} onChange={setEntryCode} type="password" placeholder="请输入管理员入口码" />
            <button onClick={handleLogin} disabled={loading} className="w-full rounded-2xl bg-amber-500 px-4 py-3 font-black text-slate-950 hover:bg-amber-400 disabled:opacity-60">{loading ? '登录中...' : '登录后台'}</button>
            {notice && <div className="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-300">{notice}</div>}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 p-4 md:p-6">
      <div className="mx-auto max-w-7xl space-y-4">
        <div className="flex flex-col gap-3 rounded-3xl bg-white p-5 shadow-sm border border-slate-200 md:flex-row md:items-center md:justify-between">
          <div><div className="text-2xl font-black">管理员控制台</div><div className="text-sm text-slate-500">保留玩家审核、公告留言、怪物管理与灾厄游戏审核。</div></div>
          <div className="flex gap-2">
            <button onClick={refreshAll} className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-black text-white hover:bg-slate-800"><RefreshCw className="inline mr-2" size={14} />刷新</button>
            <button onClick={handleLogout} className="rounded-2xl bg-rose-100 px-4 py-2 text-sm font-black text-rose-700 hover:bg-rose-200"><Skull className="inline mr-2" size={14} />退出后台</button>
          </div>
        </div>
        {notice && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</div>}
        <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
          <div className="rounded-3xl bg-white p-3 shadow-sm border border-slate-200 space-y-2">
            <TabButton active={tab === 'users'} onClick={() => setTab('users')} icon={<Users size={16} />} label="玩家管理" />
            <TabButton active={tab === 'messages'} onClick={() => setTab('messages')} icon={<Megaphone size={16} />} label="公告留言" />
            <TabButton active={tab === 'items'} onClick={() => setTab('items')} icon={<Package size={16} />} label="物品管理" />
            <TabButton active={tab === 'skills'} onClick={() => setTab('skills')} icon={<BookOpen size={16} />} label="技能管理" />
            <TabButton active={tab === 'reports'} onClick={() => setTab('reports')} icon={<ShieldAlert size={16} />} label="举报投票" />
            <TabButton active={tab === 'monsters'} onClick={() => setTab('monsters')} icon={<Skull size={16} />} label="怪物管理" />
            <TabButton active={tab === 'admins'} onClick={() => setTab('admins')} icon={<ShieldAlert size={16} />} label="管理员信息" />
            <TabButton active={tab === 'custom_games'} onClick={() => setTab('custom_games')} icon={<Gamepad2 size={16} />} label="灾厄游戏审核" />
          </div>
          <div className="rounded-3xl bg-white p-4 shadow-sm border border-slate-200">
            {tab === 'users' && (
              <div className="space-y-4">
                <div className="flex gap-3">
                  <Field label="筛选" value={userFilter} onChange={setUserFilter} placeholder="名字 / 状态 / 职位" />
                </div>
                <div className="overflow-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-slate-500">
                        <th className="py-2">名字</th>
                        <th>状态</th>
                        <th>身份</th>
                        <th>职位</th>
                        <th>操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredUsers.map((user) => (
                        <tr key={user.id} className="border-t border-slate-100 align-top">
                          <td className="py-3 font-bold">
                            {user.name}
                            <div className="text-xs text-slate-500">编号 {user.id}</div>
                          </td>
                          <td className="py-3">
                            <select value={user.status} onChange={(e) => updateUserStatus(user.id, e.target.value as UserStatus)} className="rounded-xl border border-slate-200 px-2 py-1 text-xs">
                              {STATUS_OPTIONS.map((status) => <option key={status} value={status}>{formatUserStatus(status)}</option>)}
                            </select>
                          </td>
                          <td className="py-3 text-slate-600">{user.role || '无'}</td>
                          <td className="py-3 text-slate-600">{user.job || '无'}</td>
                          <td className="py-3">
                            <div className="flex flex-wrap gap-2">
                              {user.status === 'pending' && (
                                <>
                                  <button onClick={() => updateUserStatus(user.id, 'approved')} className="rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-black text-white hover:bg-emerald-500">
                                    <CheckCircle2 className="inline mr-1" size={12} />通过审核
                                  </button>
                                  <button onClick={() => updateUserStatus(user.id, 'rejected')} className="rounded-xl bg-amber-100 px-3 py-1.5 text-xs font-black text-amber-700 hover:bg-amber-200">
                                    驳回
                                  </button>
                                </>
                              )}
                              <button onClick={() => openEditUser(user)} className="rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-black text-white hover:bg-slate-800">
                                <Edit3 className="inline mr-1" size={12} />编辑
                              </button>
                              <button onClick={() => deleteUser(user)} className="rounded-xl bg-rose-100 px-3 py-1.5 text-xs font-black text-rose-700 hover:bg-rose-200">
                                <Trash2 className="inline mr-1" size={12} />删除
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            {tab === 'messages' && <div className="space-y-4"><div className="grid gap-3 md:grid-cols-2"><Field label="公告标题" value={announcementTitle} onChange={setAnnouncementTitle} placeholder="标题" /><div /></div><label className="block text-xs font-black text-slate-500">公告内容</label><textarea value={announcementContent} onChange={(e) => setAnnouncementContent(e.target.value)} className="min-h-[120px] w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm" /><button onClick={submitAnnouncement} className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-black text-white hover:bg-slate-800"><CheckCircle2 className="inline mr-2" size={14} />发布公告</button><div className="space-y-3">{messages.map((row) => <div key={row.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><div className="flex items-start justify-between gap-3"><div><div className="font-black">{row.title}</div><div className="text-xs text-slate-500">来自 {row.userName} · {row.createdAt}</div></div><div className={`rounded-full px-3 py-1 text-xs font-black ${row.status === 'resolved' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{formatMessageStatus(row.status)}</div></div><div className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">{row.content}</div><div className="mt-3 flex flex-wrap gap-2"><button onClick={() => updateMessageStatus(row.id, row.status === 'resolved' ? 'open' : 'resolved')} className="rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-black text-white hover:bg-slate-800">{row.status === 'resolved' ? '重新打开' : '标记已处理'}</button><button onClick={() => deleteMessage(row.id)} className="rounded-xl bg-rose-100 px-3 py-1.5 text-xs font-black text-rose-700 hover:bg-rose-200">删除</button></div></div>)}</div></div>}
            {tab === 'items' && <AdminItemsPanel refreshKey={refreshNonce} onNotice={flash} />}
            {tab === 'skills' && <AdminSkillsPanel refreshKey={refreshNonce} onNotice={flash} />}
            {tab === 'reports' && <AdminReportsPanel refreshKey={refreshNonce} onNotice={flash} />}
            {tab === 'admins' && <AdminAdminsPanel refreshKey={refreshNonce} onNotice={flash} />}
            {tab === 'monsters' && <div className="space-y-4"><div className="flex justify-end"><button onClick={() => setEditingMonster({ ...EMPTY_MONSTER })} className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-black text-white hover:bg-slate-800">新建怪物</button></div><div className="grid gap-3 md:grid-cols-2">{monsters.map((monster) => <div key={monster.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><div className="flex items-start justify-between gap-3"><div><div className="font-black">{monster.name}</div><div className="text-xs text-slate-500">等级 {monster.minLevel} - {monster.maxLevel} · 战力 {monster.basePower} · 生命 {monster.baseHp}</div></div><div className={`rounded-full px-3 py-1 text-xs font-black ${Number(monster.enabled || 0) ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>{Number(monster.enabled || 0) ? '启用' : '停用'}</div></div><div className="mt-3 text-sm text-slate-600 leading-6">{monster.description || '暂无描述'}</div><div className="mt-3 flex gap-2"><button onClick={() => setEditingMonster({ ...monster })} className="rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-black text-white hover:bg-slate-800">编辑</button><button onClick={() => deleteMonster(monster)} className="rounded-xl bg-rose-100 px-3 py-1.5 text-xs font-black text-rose-700 hover:bg-rose-200">删除</button></div></div>)}</div></div>}
            {tab === 'custom_games' && <AdminCustomGamesView />}
          </div>
        </div>
      </div>
      {editingUser && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"><div className="w-full max-w-3xl rounded-3xl bg-white p-6 shadow-2xl"><div className="mb-4 flex items-center justify-between"><div className="text-xl font-black">编辑玩家：{editingUser.name}</div><button onClick={() => setEditingUser(null)} className="rounded-full bg-slate-100 p-2 text-slate-500 hover:bg-slate-200"><X size={18} /></button></div><div className="grid gap-3 md:grid-cols-2"><Field label="年龄" value={String(editingUser.age ?? 0)} onChange={(v) => setEditingUser({ ...editingUser, age: Number(v || 0) })} /><Field label="身份" value={editingUser.role || ''} onChange={(v) => setEditingUser({ ...editingUser, role: v })} /><Field label="阵营" value={editingUser.faction || ''} onChange={(v) => setEditingUser({ ...editingUser, faction: v })} /><Field label="职位" value={editingUser.job || ''} onChange={(v) => setEditingUser({ ...editingUser, job: v })} /><Field label="专属能力" value={editingUser.ability || ''} onChange={(v) => setEditingUser({ ...editingUser, ability: v })} /><Field label="精神体名称" value={editingUser.spiritName || ''} onChange={(v) => setEditingUser({ ...editingUser, spiritName: v })} /><Field label="精神等级" value={editingUser.mentalRank || ''} onChange={(v) => setEditingUser({ ...editingUser, mentalRank: v })} /><Field label="肉体等级" value={editingUser.physicalRank || ''} onChange={(v) => setEditingUser({ ...editingUser, physicalRank: v })} /><Field label="金币" value={String(editingUser.gold ?? 0)} onChange={(v) => setEditingUser({ ...editingUser, gold: Number(v || 0) })} /><Field label="当前位置" value={editingUser.currentLocation || ''} onChange={(v) => setEditingUser({ ...editingUser, currentLocation: v })} /><Field label="账号密码（留空不改）" value={editingUser.password || ''} onChange={(v) => setEditingUser({ ...editingUser, password: v })} /><SelectField label="状态" value={editingUser.status} onChange={(v) => setEditingUser({ ...editingUser, status: v as UserStatus })} options={STATUS_OPTIONS.map((status) => ({ value: status, label: formatUserStatus(status) }))} /></div><label className="mt-4 block text-xs font-black text-slate-500">个人资料</label><textarea value={editingUser.profileText || ''} onChange={(e) => setEditingUser({ ...editingUser, profileText: e.target.value })} className="mt-2 min-h-[120px] w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm" /><div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4"><div className="mb-3 font-black">已习得技能</div><div className="mb-4 flex flex-col gap-3 md:flex-row md:items-end"><label className="block min-w-0 flex-1 text-xs font-black text-slate-500"><span className="mb-1 block">授予已有技能</span><select value={grantSkillName} onChange={(e) => setGrantSkillName(e.target.value)} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900"><option value="">请选择技能</option>{availableSkills.map((skill) => <option key={`${skill.name}-${skill.faction || ''}-${skill.tier || ''}`} value={skill.name}>{skill.name} · {skill.faction || '通用'} · {skill.tier || '低阶'}</option>)}</select></label><button onClick={grantUserSkill} className="rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-black text-white hover:bg-slate-800">授予技能</button></div><div className="grid gap-2 md:grid-cols-2">{editingUserSkills.map((skill) => <div key={skill.id} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"><div><div className="font-bold">{skill.name}</div><div className="text-xs text-slate-500">等级 {skill.level}</div></div><button onClick={() => deleteUserSkill(skill.id)} className="rounded-lg bg-rose-100 px-2 py-1 text-xs font-black text-rose-700 hover:bg-rose-200">删除</button></div>)}</div></div><div className="mt-4 flex justify-end gap-2"><button onClick={() => setEditingUser(null)} className="rounded-2xl bg-slate-100 px-4 py-2 font-black text-slate-700 hover:bg-slate-200">取消</button><button onClick={saveUser} className="rounded-2xl bg-slate-900 px-4 py-2 font-black text-white hover:bg-slate-800">保存玩家资料</button></div></div></div>}
      {editingMonster && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"><div className="w-full max-w-2xl rounded-3xl bg-white p-6 shadow-2xl"><div className="mb-4 flex items-center justify-between"><div className="text-xl font-black">{editingMonster.id ? `编辑怪物：${editingMonster.name}` : '新建怪物'}</div><button onClick={() => setEditingMonster(null)} className="rounded-full bg-slate-100 p-2 text-slate-500 hover:bg-slate-200"><X size={18} /></button></div><div className="grid gap-3 md:grid-cols-2"><Field label="名称" value={editingMonster.name || ''} onChange={(v) => setEditingMonster({ ...editingMonster, name: v })} /><Field label="掉落物" value={editingMonster.dropItemName || ''} onChange={(v) => setEditingMonster({ ...editingMonster, dropItemName: v })} /><Field label="最低等级" value={String(editingMonster.minLevel ?? 1)} onChange={(v) => setEditingMonster({ ...editingMonster, minLevel: Number(v || 1) })} /><Field label="最高等级" value={String(editingMonster.maxLevel ?? 1)} onChange={(v) => setEditingMonster({ ...editingMonster, maxLevel: Number(v || 1) })} /><Field label="基础战力" value={String(editingMonster.basePower ?? 0)} onChange={(v) => setEditingMonster({ ...editingMonster, basePower: Number(v || 0) })} /><Field label="基础生命" value={String(editingMonster.baseHp ?? 0)} onChange={(v) => setEditingMonster({ ...editingMonster, baseHp: Number(v || 0) })} /><Field label="掉落概率" value={String(editingMonster.dropChance ?? 0)} onChange={(v) => setEditingMonster({ ...editingMonster, dropChance: Number(v || 0) })} /><Field label="启用（1/0）" value={String(editingMonster.enabled ?? 1)} onChange={(v) => setEditingMonster({ ...editingMonster, enabled: Number(v || 0) })} /></div><label className="mt-4 block text-xs font-black text-slate-500">描述</label><textarea value={editingMonster.description || ''} onChange={(e) => setEditingMonster({ ...editingMonster, description: e.target.value })} className="mt-2 min-h-[120px] w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm" /><div className="mt-4 flex justify-end gap-2"><button onClick={() => setEditingMonster(null)} className="rounded-2xl bg-slate-100 px-4 py-2 font-black text-slate-700 hover:bg-slate-200">取消</button><button onClick={saveMonster} className="rounded-2xl bg-slate-900 px-4 py-2 font-black text-white hover:bg-slate-800">保存怪物</button></div></div></div>}
    </div>
  );
}

function TabButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: any; label: string; }) {
  return <button onClick={onClick} className={`flex w-full items-center gap-2 rounded-2xl px-4 py-3 text-left text-sm font-black transition-colors ${active ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>{icon}{label}</button>;
}
function Field({ label, value, onChange, placeholder = '', type = 'text' }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; type?: string; }) {
  return <label className="block text-xs font-black text-slate-500"><span className="mb-1 block">{label}</span><input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900" /></label>;
}

function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: Array<{ value: string; label: string }>; }) {
  return <label className="block text-xs font-black text-slate-500"><span className="mb-1 block">{label}</span><select value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900">{options.map((option) => <option key={`${option.value}-${option.label}`} value={option.value}>{option.label}</option>)}</select></label>;
}










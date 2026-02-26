import React, { useState, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  X, MessageSquareText, RefreshCw, Plus, Trash2, Pencil, Filter, MapPin, ShoppingBag,
  Layers, Sparkles, BookMarked, Search, ListFilter
} from "lucide-react";
import { User } from "../types";

// === 用户已学技能（实例） ===
interface Skill {
  id: number;
  userId: number;
  name: string;
  level: number;
}

// === 对戏记录（实例） ===
interface RoleplayLog {
  id: number;
  senderId: number;
  senderName: string;
  receiverId: number;
  receiverName: string;
  content: string;
  isRead: number;
  createdAt: string;
  locationId?: string;
  locationName?: string;
}

// === 物品模板（由管理员维护，游戏调用） ===
type Rarity = 'common' | 'rare' | 'epic' | 'legendary';
interface ItemDef {
  id: string;
  name: string;
  locationId: string;
  type: string;
  rarity: Rarity;
  basePrice: number;
  description?: string;
}

// === 技能模板（由管理员维护，基于派系） ===
type FactionKey = '元素' | '心灵' | '机械' | '暗影' | '自然' | '圣职' | '血能' | '时空';
interface SkillTemplate {
  id: string;
  name: string;
  faction: FactionKey;
  description?: string;
  maxLevel: number;
}

// 与游戏界面一致的地点目录（id 必须与 GameView 保持一致）
const LOCATIONS: { id: string; name: string }[] = [
  { id: 'tower_of_life', name: '命之塔' },
  { id: 'london_tower', name: '伦敦塔' },
  { id: 'sanctuary', name: '圣所' },
  { id: 'guild', name: '公会' },
  { id: 'army', name: '军队' },
  { id: 'slums', name: '贫民区' },
  { id: 'rich_area', name: '富人区' },
  { id: 'tower_guard', name: '守塔会' },
  { id: 'demon_society', name: '恶魔会' },
  { id: 'paranormal_office', name: '灵异管理所' },
  { id: 'observers', name: '观察者' },

  // 塔内（如需为塔内也设置物品，可启用）
  { id: 'tower_top', name: '神使层' },
  { id: 'tower_attendant', name: '侍奉者层' },
  { id: 'tower_descendant', name: '神使后裔层' },
  { id: 'tower_training', name: '精神力训练所' },
  { id: 'tower_evaluation', name: '评定所' }
];

const FACTIONS: FactionKey[] = ['元素', '心灵', '机械', '暗影', '自然', '圣职', '血能', '时空'];

type AdminTab = 'users' | 'logs' | 'items' | 'skills';

export function AdminView() {
  const [activeTab, setActiveTab] = useState<AdminTab>('users');

  // 用户与资料
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [selectedUserSkills, setSelectedUserSkills] = useState<Skill[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<Partial<User>>({});
  const [uploadName, setUploadName] = useState("");
  const [uploadText, setUploadText] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 对戏日志
  const [roleplayLogs, setRoleplayLogs] = useState<RoleplayLog[]>([]);
  const [logsGroupMode, setLogsGroupMode] = useState<'raw' | 'byLocation' | 'byCharacter'>('raw');
  const [logsKeyword, setLogsKeyword] = useState('');

  // 物品库
  const [items, setItems] = useState<ItemDef[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [itemFilterLocation, setItemFilterLocation] = useState<string>('');
  const [showItemEditor, setShowItemEditor] = useState(false);
  const [editingItem, setEditingItem] = useState<ItemDef | null>(null);
  const [itemForm, setItemForm] = useState<Partial<ItemDef>>({
    name: '', locationId: '', type: '', rarity: 'common', basePrice: 100, description: ''
  });

  // 技能库（派系）
  const [skillTpls, setSkillTpls] = useState<SkillTemplate[]>([]);
  const [skillsLoading, setSkillsLoading] = useState(false);
  const [skillFilterFaction, setSkillFilterFaction] = useState<FactionKey | ''>('');
  const [showSkillEditor, setShowSkillEditor] = useState(false);
  const [editingSkillTpl, setEditingSkillTpl] = useState<SkillTemplate | null>(null);
  const [skillForm, setSkillForm] = useState<Partial<SkillTemplate>>({
    name: '', faction: '元素', description: '', maxLevel: 5
  });

  // 初始化与轮询，保证和游戏界面一致
  useEffect(() => {
    fetchUsers();
    fetchRoleplayLogs();
    fetchItems();
    fetchSkillTemplates();

    const timer = setInterval(() => {
      if (activeTab === 'users') fetchUsers();
      if (activeTab === 'logs') fetchRoleplayLogs();
    }, 5000);

    // 可选：SSE 实时同步（后端需提供 /api/admin/stream）
    let es: EventSource | null = null;
    try {
      es = new EventSource('/api/admin/stream');
      es.onmessage = (evt) => {
        const data = evt.data || '';
        if (data.includes('users_updated')) fetchUsers();
        if (data.includes('roleplay_new')) fetchRoleplayLogs();
        if (data.includes('items_updated')) fetchItems();
        if (data.includes('skills_updated')) fetchSkillTemplates();
      };
    } catch (e) {
      // 忽略，无 SSE 时使用轮询
    }
    return () => { clearInterval(timer); es?.close(); };
  }, [activeTab]);

  // 拉取用户（与游戏端一致）
  const fetchUsers = async () => {
    try {
      const res = await fetch("/api/admin/users");
      const data = await res.json();
      if (data.success) setUsers(data.users || []);
    } catch (e) {
      console.error('fetchUsers error', e);
    }
  };

  // 拉取对戏记录
  const fetchRoleplayLogs = async () => {
    try {
      const res = await fetch('/api/admin/roleplay_logs');
      const data = await res.json();
      if (data.success) setRoleplayLogs(data.logs || []);
    } catch (error) {
      console.error("获取对戏记录失败", error);
    }
  };

  // 拉取用户技能（实例）
  const fetchUserSkills = async (userId: number) => {
    try {
      const res = await fetch(`/api/users/${userId}/skills`);
      const data = await res.json();
      if (data.success) setSelectedUserSkills(data.skills);
      else setSelectedUserSkills([]);
    } catch (error) {
      console.error("获取技能失败", error);
      setSelectedUserSkills([]);
    }
  };

  // 状态操作
  const handleStatusChange = async (id: number, status: "approved" | "rejected") => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${id}/status`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        fetchUsers();
        broadcastSync('users_updated');
      } else {
        alert("操作失败");
      }
    } catch (err) {
      alert("网络错误");
    } finally { setLoading(false); }
  };

  const handleHide = async (id: number, isHidden: boolean) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${id}/hide`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isHidden }),
      });
      if (res.ok) {
        fetchUsers();
        broadcastSync('users_updated');
      } else { alert("操作失败"); }
    } catch (err) { alert("网络错误"); } finally { setLoading(false); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("确定要删除该角色吗？删除后将无法恢复。")) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/users/${id}`, { method: "DELETE" });
      if (res.ok) {
        fetchUsers();
        broadcastSync('users_updated');
      } else {
        const data = await res.json();
        alert(`操作失败: ${data.message || '未知错误'}`);
      }
    } catch (err: any) { alert(`网络错误: ${err.message}`); } finally { setLoading(false); }
  };

  const handleSaveEdit = async () => {
    if (!selectedUser) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${selectedUser.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: editData.role,
          mentalRank: editData.mentalRank,
          physicalRank: editData.physicalRank,
          ability: editData.ability,
          spiritName: editData.spiritName,
          profileText: editData.profileText,
        }),
      });
      if (res.ok) {
        alert("保存成功");
        setIsEditing(false);
        fetchUsers();
        setSelectedUser({ ...selectedUser, ...editData } as User);
        broadcastSync('users_updated');
      } else { alert("保存失败"); }
    } catch (err) { alert("网络错误"); } finally { setLoading(false); }
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadName.trim()) { alert("请输入名字"); return; }

    const file = fileInputRef.current?.files?.[0];
    if (!uploadText.trim() && !file) { alert("请输入文本资料或上传图片资料"); return; }

    setLoading(true);
    let imageBase64 = "";
    let mimeType = "";

    if (file) {
      const reader = new FileReader();
      const fileReadPromise = new Promise<void>((resolve) => {
        reader.onload = (event) => {
          imageBase64 = event.target?.result as string;
          mimeType = file.type;
          resolve();
        };
      });
      reader.readAsDataURL(file);
      await fileReadPromise;
    }

    try {
      const res = await fetch("/api/admin/upload-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: uploadName.trim(), text: uploadText, imageBase64, mimeType }),
      });
      const data = await res.json();
      if (data.success) {
        alert("资料上传成功！");
        setShowUploadModal(false); setUploadName(""); setUploadText("");
        if (fileInputRef.current) fileInputRef.current.value = "";
        fetchUsers();
        broadcastSync('users_updated');
      } else { alert(data.message || "上传失败"); }
    } catch (err) { alert("网络错误"); } finally { setLoading(false); }
  };

  // === 物品库 CRUD ===
  const fetchItems = async () => {
    try {
      setItemsLoading(true);
      const res = await fetch('/api/admin/items');
      const data = await res.json();
      if (data.success) setItems(data.items || []);
    } catch (e) {
      console.error('fetchItems error', e);
    } finally { setItemsLoading(false); }
  };

  const openNewItem = () => {
    setEditingItem(null);
    setItemForm({ name: '', locationId: '', type: '', rarity: 'common', basePrice: 100, description: '' });
    setShowItemEditor(true);
  };

  const openEditItem = (it: ItemDef) => {
    setEditingItem(it);
    setItemForm({ ...it });
    setShowItemEditor(true);
  };

  const saveItem = async () => {
    if (!itemForm.name || !itemForm.locationId || !itemForm.type || !itemForm.rarity || !itemForm.basePrice) {
      alert('请完整填写物品信息'); return;
    }
    try {
      setItemsLoading(true);
      const method = editingItem ? 'PUT' : 'POST';
      const url = editingItem ? `/api/admin/items/${editingItem.id}` : '/api/admin/items';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(itemForm)
      });
      const data = await res.json();
      if (data.success) {
        setShowItemEditor(false);
        fetchItems();
        broadcastSync('items_updated');
      } else {
        alert(data.message || '保存失败');
      }
    } catch (e) { alert('网络错误'); } finally { setItemsLoading(false); }
  };

  const deleteItem = async (it: ItemDef) => {
    if (!confirm(`确认删除物品「${it.name}」？`)) return;
    try {
      setItemsLoading(true);
      const res = await fetch(`/api/admin/items/${it.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        fetchItems();
        broadcastSync('items_updated');
      } else {
        alert(data.message || '删除失败');
      }
    } catch (e) { alert('网络错误'); } finally { setItemsLoading(false); }
  };

  const filteredItems = useMemo(() => {
    return items.filter(it => !itemFilterLocation || it.locationId === itemFilterLocation);
  }, [items, itemFilterLocation]);

  // === 技能模板 CRUD（派系） ===
  const fetchSkillTemplates = async () => {
    try {
      setSkillsLoading(true);
      const res = await fetch('/api/admin/skills/templates');
      const data = await res.json();
      if (data.success) setSkillTpls(data.skills || []);
    } catch (e) {
      console.error('fetchSkillTemplates error', e);
    } finally { setSkillsLoading(false); }
  };

  const openNewSkillTpl = () => {
    setEditingSkillTpl(null);
    setSkillForm({ name: '', faction: '元素', description: '', maxLevel: 5 });
    setShowSkillEditor(true);
  };

  const openEditSkillTpl = (tpl: SkillTemplate) => {
    setEditingSkillTpl(tpl);
    setSkillForm({ ...tpl });
    setShowSkillEditor(true);
  };

  const saveSkillTpl = async () => {
    if (!skillForm.name || !skillForm.faction || !skillForm.maxLevel) {
      alert('请完整填写技能信息'); return;
    }
    try {
      setSkillsLoading(true);
      const method = editingSkillTpl ? 'PUT' : 'POST';
      const url = editingSkillTpl ? `/api/admin/skills/templates/${editingSkillTpl.id}` : '/api/admin/skills/templates';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(skillForm)
      });
      const data = await res.json();
      if (data.success) {
        setShowSkillEditor(false);
        fetchSkillTemplates();
        broadcastSync('skills_updated');
      } else {
        alert(data.message || '保存失败');
      }
    } catch (e) { alert('网络错误'); } finally { setSkillsLoading(false); }
  };

  const deleteSkillTpl = async (tpl: SkillTemplate) => {
    if (!confirm(`确认删除技能「${tpl.name}」？`)) return;
    try {
      setSkillsLoading(true);
      const res = await fetch(`/api/admin/skills/templates/${tpl.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        fetchSkillTemplates();
        broadcastSync('skills_updated');
      } else {
        alert(data.message || '删除失败');
      }
    } catch (e) { alert('网络错误'); } finally { setSkillsLoading(false); }
  };

  const filteredSkillTpls = useMemo(() => {
    return skillTpls.filter(s => !skillFilterFaction || s.faction === skillFilterFaction);
  }, [skillTpls, skillFilterFaction]);

  // 日志分组
  const groupedLogs = useMemo(() => {
    const kw = logsKeyword.trim();
    const list = kw
      ? roleplayLogs.filter(l =>
          l.content.includes(kw) ||
          l.senderName.includes(kw) ||
          l.receiverName.includes(kw) ||
          (l.locationName || '').includes(kw))
      : roleplayLogs;

    if (logsGroupMode === 'raw') return list;

    if (logsGroupMode === 'byLocation') {
      const byLoc = new Map<string, { key: string; name: string; logs: RoleplayLog[] }>();
      for (const l of list) {
        const key = l.locationId || 'unknown';
        const name = l.locationName || LOCATIONS.find(x => x.id === key)?.name || '未知地点';
        if (!byLoc.has(key)) byLoc.set(key, { key, name, logs: [] });
        byLoc.get(key)!.logs.push(l);
      }
      return Array.from(byLoc.values()).sort((a, b) => a.name.localeCompare(b.name));
    }

    // byCharacter
    const byChar = new Map<string, { key: string; name: string; logs: RoleplayLog[] }>();
    for (const l of list) {
      const keys = [
        `${l.senderId}:${l.senderName}`,
        `${l.receiverId}:${l.receiverName}`
      ];
      for (const k of keys) {
        if (!byChar.has(k)) byChar.set(k, { key: k, name: k.split(':')[1] || '未知角色', logs: [] });
      }
      byChar.get(keys[0])!.logs.push(l);
      byChar.get(keys[1])!.logs.push(l);
    }
    return Array.from(byChar.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [roleplayLogs, logsGroupMode, logsKeyword]);

  // 向游戏端广播同步（可选，后端实现 /api/admin/broadcast-sync）
  const broadcastSync = async (topic: string) => {
    try {
      await fetch('/api/admin/broadcast-sync', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic })
      });
    } catch {}
  };

  const mainUsers = users.filter((u) => u.status !== "dead");
  const deadUsers = users.filter((u) => u.status === "dead");

  return (
    <div className="min-h-screen bg-gray-50 p-8 font-sans">
      <div className="max-w-7xl mx-auto">

        {/* 顶部导航 */}
        <div className="flex flex-wrap justify-between items-center mb-8 gap-4">
          <h1 className="text-3xl font-black text-gray-900 tracking-tight">管理员控制台</h1>
          <div className="flex items-center gap-2">
            <TabBtn active={activeTab === 'users'} onClick={() => setActiveTab('users')} icon={<Layers size={16}/>}>玩家与资料</TabBtn>
            <TabBtn active={activeTab === 'logs'} onClick={() => setActiveTab('logs')} icon={<MessageSquareText size={16}/>}>对戏日志</TabBtn>
            <TabBtn active={activeTab === 'items'} onClick={() => setActiveTab('items')} icon={<ShoppingBag size={16}/>}>物品库</TabBtn>
            <TabBtn active={activeTab === 'skills'} onClick={() => setActiveTab('skills')} icon={<Sparkles size={16}/>}>技能库</TabBtn>

            <div className="ml-4 text-sm text-gray-500 bg-white px-3 py-1.5 rounded-full shadow-sm border border-gray-200">
              共 {users.length} 名用户
            </div>
            <button onClick={() => (window.location.href = "/")} className="px-4 py-2 bg-gray-900 text-white rounded-xl font-medium hover:bg-gray-800 transition-colors shadow-sm text-sm">
              进入游戏
            </button>
          </div>
        </div>

        {/* 用户与资料 */}
        {activeTab === 'users' && (
          <>
            <div className="bg-white rounded-3xl shadow-sm border border-gray-200 overflow-hidden mb-8">
              <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
                <h2 className="font-bold text-gray-900">活体档案</h2>
                <button onClick={fetchUsers} className="text-xs font-bold text-sky-600 hover:text-sky-800 flex items-center gap-1">
                  <RefreshCw size={14}/> 刷新
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse whitespace-nowrap">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200 text-sm text-gray-500">
                      <th className="p-4 font-medium">ID</th>
                      <th className="p-4 font-medium">名字</th>
                      <th className="p-4 font-medium">身份</th>
                      <th className="p-4 font-medium">状态</th>
                      <th className="p-4 font-medium">所在地点</th>
                      <th className="p-4 font-medium">详细信息</th>
                      <th className="p-4 font-medium text-right">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-sm">
                    {mainUsers.map((user) => (
                      <tr key={user.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="p-4 text-gray-500">#{user.id}</td>
                        <td className="p-4 font-bold text-gray-900">{user.name}</td>
                        <td className="p-4">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100">
                            {user.role || "未分化"}
                          </span>
                        </td>
                        <td className="p-4">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border
                            ${user.status === "pending" ? "bg-amber-50 text-amber-700 border-amber-100" : ""}
                            ${user.status === "approved" ? "bg-emerald-50 text-emerald-700 border-emerald-100" : ""}
                            ${user.status === "rejected" ? "bg-red-50 text-red-700 border-red-100" : ""}
                            ${user.status === "ghost" ? "bg-purple-50 text-purple-700 border-purple-100" : ""}
                          `}>
                            {user.status === "pending" && "待审核"}
                            {user.status === "approved" && "已过审"}
                            {user.status === "rejected" && "已拒绝"}
                            {user.status === "ghost" && "鬼魂"}
                          </span>
                        </td>
                        <td className="p-4">
                          <div className="text-xs text-gray-600 flex items-center gap-1">
                            <MapPin size={14} className="text-gray-400"/>
                            {LOCATIONS.find(l => l.id === (user as any).currentLocation)?.name || (user as any).currentLocation || '-'}
                          </div>
                        </td>
                        <td className="p-4">
                          <button
                            onClick={() => {
                              setSelectedUser(user);
                              setEditData(user);
                              setIsEditing(false);
                              setShowDetailsModal(true);
                              fetchUserSkills(user.id);
                            }}
                            className="text-sky-600 hover:text-sky-800 font-medium text-xs"
                          >
                            查看
                          </button>
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {user.status === "pending" && (
                              <>
                                <button onClick={() => { setUploadName(user.name); setUploadText(user.profileText || ""); setShowUploadModal(true); }} disabled={loading} className="px-3 py-1.5 bg-sky-600 text-white rounded-lg font-medium hover:bg-sky-700 transition-colors disabled:opacity-50 text-xs shadow-sm">上传资料</button>
                                <button onClick={() => handleStatusChange(user.id, "approved")} disabled={loading} className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50 text-xs shadow-sm">通过</button>
                                <button onClick={() => handleStatusChange(user.id, "rejected")} disabled={loading} className="px-3 py-1.5 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors disabled:opacity-50 text-xs shadow-sm">拒绝</button>
                              </>
                            )}
                            <button onClick={() => handleDelete(user.id)} disabled={loading} className="px-3 py-1.5 bg-red-50 text-red-600 rounded-lg font-medium hover:bg-red-100 transition-colors disabled:opacity-50 text-xs shadow-sm border border-red-100">删除</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {mainUsers.length === 0 && (<tr><td colSpan={7} className="p-8 text-center text-gray-400">暂无活体档案</td></tr>)}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-white rounded-3xl shadow-sm border border-gray-200 overflow-hidden mb-8">
              <div className="p-4 border-b border-gray-100 bg-gray-50/50">
                <h2 className="font-bold text-gray-900">死亡名单</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse whitespace-nowrap">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200 text-sm text-gray-500">
                      <th className="p-4 font-medium">ID</th>
                      <th className="p-4 font-medium">名字</th>
                      <th className="p-4 font-medium">死亡描述</th>
                      <th className="p-4 font-medium">状态</th>
                      <th className="p-4 font-medium text-right">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-sm">
                    {deadUsers.map((user) => (
                      <tr key={user.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="p-4 text-gray-500">#{user.id}</td>
                        <td className="p-4 font-bold text-gray-900">{user.name}</td>
                        <td className="p-4 text-gray-600 max-w-xs truncate" title={user.deathDescription}>{user.deathDescription || "-"}</td>
                        <td className="p-4">
                          {user.isHidden ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 border border-gray-200">已隐藏</span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-100">显示中</span>
                          )}
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button onClick={() => handleHide(user.id, !user.isHidden)} disabled={loading} className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors disabled:opacity-50 text-xs shadow-sm">
                              {user.isHidden ? "取消隐藏" : "隐藏"}
                            </button>
                            <button onClick={() => handleDelete(user.id)} disabled={loading} className="px-3 py-1.5 bg-red-50 text-red-600 rounded-lg font-medium hover:bg-red-100 transition-colors disabled:opacity-50 text-xs shadow-sm border border-red-100">删除</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {deadUsers.length === 0 && (<tr><td colSpan={5} className="p-8 text-center text-gray-400">暂无死亡记录</td></tr>)}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* 对戏日志 */}
        {activeTab === 'logs' && (
          <div className="bg-white rounded-3xl shadow-sm border border-gray-200 overflow-hidden mb-8">
            <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex flex-wrap gap-3 items-center justify-between">
              <h2 className="font-bold text-gray-900 flex items-center gap-2">
                <MessageSquareText size={20} className="text-sky-600" />
                全服对戏日志监控
              </h2>
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1 bg-white border rounded-xl px-2 py-1">
                  <ListFilter size={14} className="text-gray-400"/>
                  <button onClick={() => setLogsGroupMode('raw')} className={`text-xs px-2 py-1 rounded-lg ${logsGroupMode==='raw'?'bg-sky-100 text-sky-700':'text-gray-600'}`}>原始</button>
                  <button onClick={() => setLogsGroupMode('byLocation')} className={`text-xs px-2 py-1 rounded-lg ${logsGroupMode==='byLocation'?'bg-sky-100 text-sky-700':'text-gray-600'}`}>按地点</button>
                  <button onClick={() => setLogsGroupMode('byCharacter')} className={`text-xs px-2 py-1 rounded-lg ${logsGroupMode==='byCharacter'?'bg-sky-100 text-sky-700':'text-gray-600'}`}>按人物</button>
                </div>
                <div className="relative">
                  <input value={logsKeyword} onChange={e=>setLogsKeyword(e.target.value)} placeholder="搜索内容/人名/地点" className="pl-8 pr-3 py-1.5 text-sm border rounded-xl bg-white"/>
                  <Search size={14} className="absolute left-2.5 top-1.5 text-gray-400"/>
                </div>
                <button onClick={fetchRoleplayLogs} className="text-xs font-bold text-sky-600 hover:text-sky-800 flex items-center gap-1">
                  <RefreshCw size={14}/> 刷新
                </button>
              </div>
            </div>

            <div className="p-4 max-h-[640px] overflow-y-auto space-y-3 bg-gray-50/30">
              {roleplayLogs.length === 0 ? (
                <div className="text-center text-gray-400 py-10 text-sm">目前全服还没有产生任何对戏记录。</div>
              ) : (
                <>
                  {logsGroupMode === 'raw' && (groupedLogs as RoleplayLog[]).map(log => (
                    <div key={log.id} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col gap-2">
                      <div className="flex justify-between items-start">
                        <div className="text-xs font-bold text-gray-700">
                          <span className="text-sky-600">{log.senderName}</span>
                          <span className="text-gray-400 font-normal mx-2">对</span>
                          <span className="text-emerald-600">{log.receiverName}</span>
                          <span className="text-gray-400 font-normal ml-1">说：</span>
                        </div>
                        <div className="text-[10px] text-gray-400 font-mono">
                          {new Date(log.createdAt).toLocaleString()}
                        </div>
                      </div>
                      <div className="text-[11px] text-gray-500 flex items-center gap-1">
                        <MapPin size={12} className="text-gray-400"/>
                        {log.locationName || LOCATIONS.find(l=>l.id===log.locationId)?.name || '未知地点'}
                      </div>
                      <div className="text-sm text-gray-800 leading-relaxed bg-gray-50 p-3 rounded-lg border border-gray-100">
                        {log.content}
                      </div>
                    </div>
                  ))}

                  {logsGroupMode === 'byLocation' && (groupedLogs as {key:string;name:string;logs:RoleplayLog[]}[]).map(group => (
                    <div key={group.key} className="bg-white rounded-2xl border border-gray-200 shadow-sm">
                      <div className="p-3 border-b bg-gray-50/60 text-sm font-bold text-gray-800 flex items-center gap-2">
                        <MapPin size={14} className="text-gray-500"/>{group.name}（{group.logs.length}）
                      </div>
                      <div className="p-3 space-y-2">
                        {group.logs.map(log=>(
                          <div key={log.id} className="bg-gray-50 border border-gray-100 rounded-xl p-3">
                            <div className="flex justify-between items-start">
                              <div className="text-xs text-gray-700">
                                <span className="text-sky-600 font-bold">{log.senderName}</span>
                                <span className="text-gray-400 mx-1">→</span>
                                <span className="text-emerald-600 font-bold">{log.receiverName}</span>
                              </div>
                              <div className="text-[10px] text-gray-400 font-mono">{new Date(log.createdAt).toLocaleString()}</div>
                            </div>
                            <div className="text-sm text-gray-800 mt-1">{log.content}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}

                  {logsGroupMode === 'byCharacter' && (groupedLogs as {key:string;name:string;logs:RoleplayLog[]}[]).map(group => (
                    <div key={group.key} className="bg-white rounded-2xl border border-gray-200 shadow-sm">
                      <div className="p-3 border-b bg-gray-50/60 text-sm font-bold text-gray-800">
                        {group.name}（相关 {group.logs.length} 条）
                      </div>
                      <div className="p-3 space-y-2">
                        {group.logs.map(log=>(
                          <div key={log.id} className="bg-gray-50 border border-gray-100 rounded-xl p-3">
                            <div className="flex justify-between items-start">
                              <div className="text-xs text-gray-700">
                                <span className="text-sky-600 font-bold">{log.senderName}</span>
                                <span className="text-gray-400 mx-1">→</span>
                                <span className="text-emerald-600 font-bold">{log.receiverName}</span>
                                <span className="text-gray-400 mx-2">|</span>
                                <span className="text-gray-500 inline-flex items-center gap-1">
                                  <MapPin size={12} className="text-gray-400"/>
                                  {log.locationName || LOCATIONS.find(l=>l.id===log.locationId)?.name || '未知地点'}
                                </span>
                              </div>
                              <div className="text-[10px] text-gray-400 font-mono">{new Date(log.createdAt).toLocaleString()}</div>
                            </div>
                            <div className="text-sm text-gray-800 mt-1">{log.content}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        )}

        {/* 物品库 */}
        {activeTab === 'items' && (
          <div className="bg-white rounded-3xl shadow-sm border border-gray-200 overflow-hidden mb-8">
            <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
              <h2 className="font-bold text-gray-900 flex items-center gap-2"><ShoppingBag size={18} className="text-amber-600"/>物品数据库（地点分类）</h2>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 bg-white border rounded-xl px-2 py-1">
                  <Filter size={14} className="text-gray-400"/>
                  <select value={itemFilterLocation} onChange={e=>setItemFilterLocation(e.target.value)} className="text-sm bg-transparent outline-none">
                    <option value="">全部地点</option>
                    {LOCATIONS.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                  </select>
                </div>
                <button onClick={openNewItem} className="px-3 py-1.5 bg-amber-600 text-white rounded-lg font-medium hover:bg-amber-700 text-xs shadow-sm flex items-center gap-1">
                  <Plus size={14}/> 添加物品
                </button>
                <button onClick={fetchItems} className="text-xs font-bold text-sky-600 hover:text-sky-800 flex items-center gap-1">
                  <RefreshCw size={14}/> 刷新
                </button>
              </div>
            </div>

            <div className="p-4">
              {itemsLoading ? (
                <div className="text-center text-gray-400 py-10 text-sm">加载中...</div>
              ) : filteredItems.length === 0 ? (
                <div className="text-center text-gray-400 py-10 text-sm">暂无物品数据</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {filteredItems.map(it => (
                    <div key={it.id} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-bold text-gray-900">{it.name}</div>
                          <div className="text-xs text-gray-500 mt-1 flex items-center gap-2">
                            <span className="inline-flex items-center gap-1"><MapPin size={12} className="text-gray-400"/>{LOCATIONS.find(l=>l.id===it.locationId)?.name || it.locationId}</span>
                            <span className="text-gray-300">|</span>
                            <span className="inline-flex items-center gap-1"><Layers size={12} className="text-gray-400"/>{it.type}</span>
                          </div>
                        </div>
                        <div className="text-xs font-bold">
                          <span className={`px-2 py-0.5 rounded-full border
                            ${it.rarity==='common'?'bg-gray-50 text-gray-600 border-gray-200':''}
                            ${it.rarity==='rare'?'bg-sky-50 text-sky-700 border-sky-100':''}
                            ${it.rarity==='epic'?'bg-violet-50 text-violet-700 border-violet-100':''}
                            ${it.rarity==='legendary'?'bg-amber-50 text-amber-700 border-amber-100':''}
                          `}>
                            {it.rarity}
                          </span>
                        </div>
                      </div>
                      {it.description && <div className="text-sm text-gray-700 mt-2">{it.description}</div>}
                      <div className="flex justify-between items-center mt-3">
                        <div className="text-sm font-bold text-amber-700">{it.basePrice} G</div>
                        <div className="flex items-center gap-2">
                          <button onClick={()=>openEditItem(it)} className="text-xs text-sky-600 hover:text-sky-800 flex items-center gap-1"><Pencil size={14}/>编辑</button>
                          <button onClick={()=>deleteItem(it)} className="text-xs text-red-600 hover:text-red-800 flex items-center gap-1"><Trash2 size={14}/>删除</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="text-xs text-gray-500 mt-4">
                游戏界面探索掉落建议改为：调用 GET /api/items/by-location?locationId=xxx 以从此处的数据库随机掉落（当前 GameView 可按需调整）。
              </div>
            </div>
          </div>
        )}

        {/* 技能库（派系） */}
        {activeTab === 'skills' && (
          <div className="bg-white rounded-3xl shadow-sm border border-gray-200 overflow-hidden mb-8">
            <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
              <h2 className="font-bold text-gray-900 flex items-center gap-2"><Sparkles size={18} className="text-violet-600"/>技能模板库（八大派系）</h2>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 bg-white border rounded-xl px-2 py-1">
                  <Filter size={14} className="text-gray-400"/>
                  <select value={skillFilterFaction} onChange={e=>setSkillFilterFaction((e.target.value || '') as FactionKey | '')} className="text-sm bg-transparent outline-none">
                    <option value="">全部派系</option>
                    {FACTIONS.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
                <button onClick={openNewSkillTpl} className="px-3 py-1.5 bg-violet-600 text-white rounded-lg font-medium hover:bg-violet-700 text-xs shadow-sm flex items-center gap-1">
                  <Plus size={14}/> 添加技能
                </button>
                <button onClick={fetchSkillTemplates} className="text-xs font-bold text-sky-600 hover:text-sky-800 flex items-center gap-1">
                  <RefreshCw size={14}/> 刷新
                </button>
              </div>
            </div>

            <div className="p-4">
              {skillsLoading ? (
                <div className="text-center text-gray-400 py-10 text-sm">加载中...</div>
              ) : filteredSkillTpls.length === 0 ? (
                <div className="text-center text-gray-400 py-10 text-sm">暂无技能模板</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {filteredSkillTpls.map(tpl => (
                    <div key={tpl.id} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-bold text-gray-900">{tpl.name}</div>
                          <div className="text-xs text-gray-500 mt-1 inline-flex items-center gap-1">
                            <BookMarked size={12} className="text-gray-400"/>{tpl.faction}
                          </div>
                        </div>
                        <div className="text-[10px] text-gray-500">Max Lv.{tpl.maxLevel}</div>
                      </div>
                      {tpl.description && <div className="text-sm text-gray-700 mt-2">{tpl.description}</div>}
                      <div className="flex items-center gap-2 mt-3">
                        <button onClick={()=>openEditSkillTpl(tpl)} className="text-xs text-sky-600 hover:text-sky-800 flex items-center gap-1"><Pencil size={14}/>编辑</button>
                        <button onClick={()=>deleteSkillTpl(tpl)} className="text-xs text-red-600 hover:text-red-800 flex items-center gap-1"><Trash2 size={14}/>删除</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="text-xs text-gray-500 mt-4">
                游戏可调用 GET /api/skills/templates?faction=元素 用于派生学习列表；而实际“学到的技能”仍走 /api/users/:id/skills。
              </div>
            </div>
          </div>
        )}

      </div>

      {/* 用户详情 Modal */}
      <AnimatePresence>
        {showDetailsModal && selectedUser && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white rounded-3xl p-6 w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-6 border-b border-gray-100 pb-4">
                <h3 className="text-2xl font-black text-gray-900">角色档案：{selectedUser.name}</h3>
                <div className="flex items-center gap-4">
                  {!isEditing ? (
                    <button onClick={() => setIsEditing(true)} className="px-4 py-2 bg-sky-600 text-white rounded-xl font-medium hover:bg-sky-700 transition-colors text-sm">编辑</button>
                  ) : (
                    <button onClick={handleSaveEdit} disabled={loading} className="px-4 py-2 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 transition-colors text-sm">保存</button>
                  )}
                  <button onClick={() => setShowDetailsModal(false)} className="text-gray-400 hover:text-gray-600"><X size={24} /></button>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-6">
                <div className="space-y-4">
                  <ProfileField label="姓名" value={selectedUser.name} />
                  {isEditing ? (
                    <>
                      <EditField label="所属人群" value={editData.role as any} onChange={(v) => setEditData({ ...editData, role: v as any })} />
                      <EditField label="精神力" value={editData.mentalRank as any} onChange={(v) => setEditData({ ...editData, mentalRank: v as any })} />
                      <EditField label="肉体强度" value={editData.physicalRank as any} onChange={(v) => setEditData({ ...editData, physicalRank: v as any })} />
                      <EditField label="能力" value={editData.ability as any} onChange={(v) => setEditData({ ...editData, ability: v as any })} />
                      <EditField label="精神体" value={editData.spiritName as any} onChange={(v) => setEditData({ ...editData, spiritName: v as any })} />
                      <EditField label="个人资料" value={editData.profileText as any} onChange={(v) => setEditData({ ...editData, profileText: v as any })} isLong />
                    </>
                  ) : (
                    <>
                      <ProfileField label="所属人群" value={selectedUser.role || "未分化"} />
                      <ProfileField label="精神力" value={selectedUser.mentalRank} />
                      <ProfileField label="肉体强度" value={selectedUser.physicalRank} />
                      <ProfileField label="能力" value={selectedUser.ability} />
                      <ProfileField label="精神体" value={selectedUser.spiritName} />
                      <ProfileField label="个人资料" value={selectedUser.profileText} isLong />
                    </>
                  )}

                  {/* 技能展示面板 */}
                  {!isEditing && (
                    <div className="mt-6 border-t border-gray-100 pt-4">
                      <div className="text-xs text-gray-500 mb-3 font-bold">该角色已掌握的技能 ({selectedUserSkills.length})</div>
                      <div className="flex flex-wrap gap-2">
                        {selectedUserSkills.length === 0 && (<span className="text-sm text-gray-400 italic">暂无任何技能</span>)}
                        {selectedUserSkills.map((skill) => (
                          <div key={skill.id} className="bg-emerald-50 border border-emerald-100 px-3 py-1.5 rounded-lg flex items-center gap-2 shadow-sm">
                            <span className="text-sm font-bold text-emerald-900">{skill.name}</span>
                            <span className="text-xs font-black text-emerald-600 bg-white px-1.5 py-0.5 rounded-md border border-emerald-100">Lv.{skill.level}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 上传资料 Modal */}
      <AnimatePresence>
        {showUploadModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="bg-white rounded-3xl p-6 w-full max-w-lg shadow-2xl">
              <h2 className="text-xl font-black mb-4 text-gray-900">上传玩家资料</h2>
              <form onSubmit={handleUploadSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">玩家名字</label>
                  <input type="text" value={uploadName} readOnly className="w-full px-4 py-2 border border-gray-200 rounded-xl bg-gray-50 text-gray-500 cursor-not-allowed" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">文本资料 (可选)</label>
                  <textarea value={uploadText} onChange={(e) => setUploadText(e.target.value)} className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-100 focus:border-sky-700 h-32 resize-none" placeholder="输入玩家的详细资料..." />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">图片资料 (可选，将自动识别文字)</label>
                  <input type="file" ref={fileInputRef} accept="image/*" className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-sky-50 file:text-sky-700 hover:file:bg-sky-100" />
                </div>
                <div className="flex gap-3 pt-4">
                  <button type="button" onClick={() => setShowUploadModal(false)} className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors">取消</button>
                  <button type="submit" disabled={loading} className="flex-1 py-2.5 bg-gray-900 text-white rounded-xl font-medium hover:bg-gray-800 transition-colors disabled:opacity-50">提交资料</button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 物品编辑 Modal */}
      <AnimatePresence>
        {showItemEditor && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="bg-white rounded-3xl p-6 w-full max-w-lg shadow-2xl">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-black text-gray-900">{editingItem ? '编辑物品' : '新增物品'}</h2>
                <button onClick={()=>setShowItemEditor(false)} className="text-gray-400 hover:text-gray-600"><X size={22}/></button>
              </div>
              <div className="space-y-3">
                <LabeledInput label="名称" value={itemForm.name || ''} onChange={v=>setItemForm({...itemForm, name: v})}/>
                <div>
                  <div className="text-xs text-gray-600 mb-1">地点</div>
                  <select value={itemForm.locationId || ''} onChange={e=>setItemForm({...itemForm, locationId: e.target.value})} className="w-full px-3 py-2 border rounded-xl bg-white text-sm">
                    <option value="">选择地点</option>
                    {LOCATIONS.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                  </select>
                </div>
                <LabeledInput label="类型" value={itemForm.type || ''} onChange={v=>setItemForm({...itemForm, type: v})}/>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-xs text-gray-600 mb-1">稀有度</div>
                    <select value={itemForm.rarity || 'common'} onChange={e=>setItemForm({...itemForm, rarity: e.target.value as Rarity})} className="w-full px-3 py-2 border rounded-xl bg-white text-sm">
                      <option value="common">common</option>
                      <option value="rare">rare</option>
                      <option value="epic">epic</option>
                      <option value="legendary">legendary</option>
                    </select>
                  </div>
                  <LabeledInput type="number" label="基础价格" value={String(itemForm.basePrice ?? 100)} onChange={v=>setItemForm({...itemForm, basePrice: parseInt(v || '0')})}/>
                </div>
                <LabeledTextarea label="说明" value={itemForm.description || ''} onChange={v=>setItemForm({...itemForm, description: v})}/>
              </div>
              <div className="flex gap-3 pt-5">
                <button onClick={()=>setShowItemEditor(false)} className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors">取消</button>
                <button onClick={saveItem} className="flex-1 py-2.5 bg-amber-600 text-white rounded-xl font-medium hover:bg-amber-700 transition-colors">{editingItem ? '保存修改' : '创建物品'}</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 技能模板编辑 Modal */}
      <AnimatePresence>
        {showSkillEditor && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="bg-white rounded-3xl p-6 w-full max-w-lg shadow-2xl">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-black text-gray-900">{editingSkillTpl ? '编辑技能' : '新增技能'}</h2>
                <button onClick={()=>setShowSkillEditor(false)} className="text-gray-400 hover:text-gray-600"><X size={22}/></button>
              </div>
              <div className="space-y-3">
                <LabeledInput label="技能名称" value={skillForm.name || ''} onChange={v=>setSkillForm({...skillForm, name: v})}/>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-xs text-gray-600 mb-1">派系</div>
                    <select value={skillForm.faction || '元素'} onChange={e=>setSkillForm({...skillForm, faction: e.target.value as FactionKey})} className="w-full px-3 py-2 border rounded-xl bg-white text-sm">
                      {FACTIONS.map(f => <option key={f} value={f}>{f}</option>)}
                    </select>
                  </div>
                  <LabeledInput type="number" label="最大等级" value={String(skillForm.maxLevel ?? 5)} onChange={v=>setSkillForm({...skillForm, maxLevel: parseInt(v || '1')})}/>
                </div>
                <LabeledTextarea label="技能描述" value={skillForm.description || ''} onChange={v=>setSkillForm({...skillForm, description: v})}/>
              </div>
              <div className="flex gap-3 pt-5">
                <button onClick={()=>setShowSkillEditor(false)} className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors">取消</button>
                <button onClick={saveSkillTpl} className="flex-1 py-2.5 bg-violet-600 text-white rounded-xl font-medium hover:bg-violet-700 transition-colors">{editingSkillTpl ? '保存修改' : '创建技能'}</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {loading && (
        <div className="fixed inset-0 bg-white/80 backdrop-blur-sm z-[60] flex items-center justify-center">
          <div className="text-center">
            <div className="w-8 h-8 border-4 border-gray-900 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-900 font-medium">处理中，请稍候...</p>
          </div>
        </div>
      )}
    </div>
  );
}

function ProfileField({ label, value, isLong }: { label: string; value?: string; isLong?: boolean; }) {
  return (
    <div className={`bg-gray-50 rounded-xl p-3 border border-gray-100 ${isLong ? "h-full" : ""}`}>
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className="text-sm font-medium text-gray-900 whitespace-pre-wrap">{value || "未知"}</div>
    </div>
  );
}

function EditField({ label, value, onChange, isLong }: { label: string; value?: string; onChange: (val: string) => void; isLong?: boolean; }) {
  return (
    <div className={`bg-gray-50 rounded-xl p-3 border border-gray-200 focus-within:border-sky-500 focus-within:ring-1 focus-within:ring-sky-500 ${isLong ? "h-full" : ""}`}>
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      {isLong ? (
        <textarea value={value || ""} onChange={(e) => onChange(e.target.value)} className="w-full bg-transparent text-sm font-medium text-gray-900 focus:outline-none resize-y min-h-[100px]" />
      ) : (
        <input type="text" value={value || ""} onChange={(e) => onChange(e.target.value)} className="w-full bg-transparent text-sm font-medium text-gray-900 focus:outline-none" />
      )}
    </div>
  );
}

function TabBtn({ active, onClick, icon, children }: { active: boolean; onClick: () => void; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={`px-3 py-1.5 rounded-xl text-sm font-semibold border transition-colors flex items-center gap-1
      ${active ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-100'}`}>
      {icon}{children}
    </button>
  );
}

function LabeledInput({ label, value, onChange, type='text' }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div>
      <div className="text-xs text-gray-600 mb-1">{label}</div>
      <input type={type} value={value} onChange={e=>onChange(e.target.value)} className="w-full px-3 py-2 border rounded-xl bg-white text-sm"/>
    </div>
  );
}

function LabeledTextarea({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <div className="text-xs text-gray-600 mb-1">{label}</div>
      <textarea value={value} onChange={e=>onChange(e.target.value)} className="w-full px-3 py-2 border rounded-xl bg-white text-sm min-h-[96px] resize-y"/>
    </div>
  );
}
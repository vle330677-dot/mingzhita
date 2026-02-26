import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  X, MessageSquare, Package, Zap, User as UserIcon, 
  Trash2, MapPin, Save, Plus, Database, ShieldAlert 
} from "lucide-react";

// --- 类型定义 ---
interface User {
  id: number;
  name: string;
  role: string;
  mentalRank: string;
  physicalRank: string;
  gold: number;
  ability: string;
  spiritName: string;
  currentLocation: string;
  status: string;
  profileText: string;
}

interface RoleplayLog {
  id: number;
  senderName: string;
  receiverName: string;
  content: string;
  locationId: string;
  createdAt: string;
}

interface GlobalItem {
  id: number;
  name: string;
  locationTag: string;
  price: number;
  description: string;
}

interface GlobalSkill {
  id: number;
  name: string;
  faction: string;
  description: string;
}

export function AdminView() {
  const [activeTab, setActiveTab] = useState<'users' | 'logs' | 'items' | 'skills'>('users');
  const [loading, setLoading] = useState(false);
  
  // 数据状态
  const [users, setUsers] = useState<User[]>([]);
  const [logs, setLogs] = useState<RoleplayLog[]>([]);
  const [items, setItems] = useState<GlobalItem[]>([]);
  const [skills, setSkills] = useState<GlobalSkill[]>([]);

  // 表单状态
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [newItem, setNewItem] = useState({ name: '', locationTag: '', price: 0, description: '' });
  const [newSkill, setNewSkill] = useState({ name: '', faction: '强攻系', description: '' });

  const factions = ['强攻系', '精神系', '敏捷系', '治愈系', '防御系', '感知系', '控制系', '召唤系'];

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  // --- 通用数据获取 ---
  const fetchData = async () => {
    setLoading(true);
    try {
      const endpoints = { 
        users: '/api/admin/users', 
        logs: '/api/admin/roleplay_logs', 
        items: '/api/items', 
        skills: '/api/skills' 
      };
      const res = await fetch(endpoints[activeTab]);
      const data = await res.json();
      if (data.success) {
        if (activeTab === 'users') setUsers(data.users);
        if (activeTab === 'logs') setLogs(data.logs);
        if (activeTab === 'items') setItems(data.items);
        if (activeTab === 'skills') setSkills(data.skills);
      }
    } catch (e) {
      console.error("Fetch Error:", e);
    } finally {
      setLoading(false);
    }
  };

  // --- 玩家管理操作 ---
  const handleUpdateUser = async () => {
    if (!editingUser) return;
    const res = await fetch(`/api/admin/users/${editingUser.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editingUser)
    });
    if (res.ok) {
      alert("玩家档案已更新");
      setEditingUser(null);
      fetchData();
    }
  };

  // --- 物品/技能增删操作 ---
  const handleAddItem = async () => {
    if (!newItem.name || !newItem.locationTag) return alert("请填写完整");
    await fetch('/api/admin/items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newItem)
    });
    setNewItem({ name: '', locationTag: '', price: 0, description: '' });
    fetchData();
  };

  const handleAddSkill = async () => {
    if (!newSkill.name) return alert("请填写名称");
    await fetch('/api/admin/skills', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newSkill)
    });
    setNewSkill({ name: '', faction: '强攻系', description: '' });
    fetchData();
  };

  const handleDelete = async (type: 'items' | 'skills', id: number) => {
    if (!confirm("确定要从数据库中抹除此项吗？")) return;
    await fetch(`/api/admin/${type}/${id}`, { method: 'DELETE' });
    fetchData();
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] p-6 font-sans text-slate-800">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <header className="flex flex-col md:flex-row justify-between items-center mb-10 gap-4">
          <div>
            <h1 className="text-4xl font-black tracking-tighter flex items-center gap-3">
              <Database className="text-sky-600" size={32}/>
              世界管理中枢
            </h1>
            <p className="text-slate-400 font-medium mt-1">数据同步状态：<span className="text-emerald-500">实时连接中</span></p>
          </div>
          
          <nav className="flex bg-white p-1.5 rounded-2xl shadow-sm border border-slate-200">
            <TabBtn active={activeTab === 'users'} onClick={() => setActiveTab('users')} icon={<UserIcon size={18}/>} label="玩家管理"/>
            <TabBtn active={activeTab === 'logs'} onClick={() => setActiveTab('logs')} icon={<MessageSquare size={18}/>} label="对戏归纳"/>
            <TabBtn active={activeTab === 'items'} onClick={() => setActiveTab('items')} icon={<Package size={18}/>} label="物品库"/>
            <TabBtn active={activeTab === 'skills'} onClick={() => setActiveTab('skills')} icon={<Zap size={18}/>} label="技能库"/>
          </nav>
        </header>

        {/* 主内容区 */}
        <AnimatePresence mode="wait">
          {/* 玩家管理 */}
          {activeTab === 'users' && (
            <motion.div initial={{opacity:0, y:10}} animate={{opacity:1, y:0}} exit={{opacity:0}} className="bg-white rounded-[32px] shadow-sm border border-slate-200 overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-slate-50 border-b text-[11px] uppercase tracking-wider font-bold text-slate-400">
                  <tr>
                    <th className="p-6">玩家基本信息</th>
                    <th className="p-6">精神/肉体等级</th>
                    <th className="p-6">当前位置</th>
                    <th className="p-6">状态</th>
                    <th className="p-6 text-right">管理</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {users.map(u => (
                    <tr key={u.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="p-6">
                        <div className="font-bold text-slate-900">{u.name}</div>
                        <div className="text-xs text-slate-400">{u.role || '未分化'}</div>
                      </td>
                      <td className="p-6 font-mono text-xs">
                        <span className="text-sky-600 font-bold">{u.mentalRank}</span> / 
                        <span className="text-rose-500 font-bold"> {u.physicalRank}</span>
                      </td>
                      <td className="p-6">
                        <span className="flex items-center gap-1 text-xs font-bold text-slate-600">
                          <MapPin size={12} className="text-slate-300"/> {u.currentLocation || '位面虚空'}
                        </span>
                      </td>
                      <td className="p-6">
                        <span className={`px-2 py-1 rounded-full text-[10px] font-black uppercase ${
                          u.status === 'approved' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
                        }`}>
                          {u.status === 'approved' ? '已过审' : '待审核'}
                        </span>
                      </td>
                      <td className="p-6 text-right">
                        <button 
                          onClick={() => setEditingUser(u)}
                          className="text-sky-600 font-black text-xs hover:underline"
                        >
                          编辑档案
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </motion.div>
          )}

          {/* 对戏归纳 - 核心需求:按地点/人物归纳 */}
          {activeTab === 'logs' && (
            <motion.div initial={{opacity:0}} animate={{opacity:1}} className="space-y-8">
              {Array.from(new Set(logs.map(l => l.locationId))).map(loc => (
                <div key={loc} className="bg-white rounded-[32px] border border-slate-200 p-8 shadow-sm">
                  <h3 className="text-xl font-black mb-6 flex items-center gap-3 text-slate-900">
                    <div className="w-2 h-8 bg-sky-500 rounded-full"/>
                    {loc || '未知位面'} <span className="text-slate-300 text-sm font-medium">({logs.filter(l => l.locationId === loc).length} 条记录)</span>
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {logs.filter(l => l.locationId === loc).map(l => (
                      <div key={l.id} className="bg-slate-50 p-5 rounded-2xl border border-slate-100 hover:border-sky-200 transition-all">
                        <div className="flex justify-between items-center mb-3">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-black text-sky-600">{l.senderName}</span>
                            <span className="text-[10px] text-slate-300">➔</span>
                            <span className="text-xs font-black text-rose-500">{l.receiverName}</span>
                          </div>
                          <span className="text-[10px] font-mono text-slate-300">{new Date(l.createdAt).toLocaleString()}</span>
                        </div>
                        <p className="text-sm text-slate-600 leading-relaxed italic">"{l.content}"</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </motion.div>
          )}

          {/* 物品管理 - 核心需求:按地址添加删除 */}
          {activeTab === 'items' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-1 bg-white p-8 rounded-[32px] border border-slate-200 shadow-sm h-fit">
                <h3 className="font-black text-lg mb-6 flex items-center gap-2"><Plus size={18}/> 注入新物品</h3>
                <div className="space-y-4">
                  <Input label="物品名称" value={newItem.name} onChange={v => setNewItem({...newItem, name: v})}/>
                  <Input label="部署地址 (Tag)" value={newItem.locationTag} onChange={v => setNewItem({...newItem, locationTag: v})} placeholder="如: slums"/>
                  <Input label="交易价格" type="number" value={newItem.price.toString()} onChange={v => setNewItem({...newItem, price: parseInt(v)})}/>
                  <button 
                    onClick={handleAddItem}
                    className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black hover:bg-slate-800 transition-all mt-4 shadow-lg shadow-slate-200"
                  >
                    同步至世界
                  </button>
                </div>
              </div>
              <div className="lg:col-span-2 bg-white rounded-[32px] border border-slate-200 shadow-sm overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 border-b text-[11px] font-bold text-slate-400">
                    <tr>
                      <th className="p-6">物品信息</th>
                      <th className="p-6">部署区域</th>
                      <th className="p-6">价值</th>
                      <th className="p-6 text-right">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {items.map(i => (
                      <tr key={i.id}>
                        <td className="p-6 font-bold">{i.name}</td>
                        <td className="p-6">
                          <span className="px-2 py-1 bg-amber-50 text-amber-700 rounded-lg text-[10px] font-black uppercase">
                            {i.locationTag}
                          </span>
                        </td>
                        <td className="p-6 font-mono text-sm text-slate-500">{i.price} G</td>
                        <td className="p-6 text-right">
                          <button onClick={() => handleDelete('items', i.id)} className="text-slate-300 hover:text-rose-500 transition-colors">
                            <Trash2 size={18}/>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 技能管理 - 核心需求:基于八大派系 */}
          {activeTab === 'skills' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-1 bg-white p-8 rounded-[32px] border border-slate-200 shadow-sm h-fit">
                <h3 className="font-black text-lg mb-6 flex items-center gap-2"><Zap size={18}/> 录入派系技能</h3>
                <div className="space-y-4">
                  <Input label="技能名称" value={newSkill.name} onChange={v => setNewSkill({...newSkill, name: v})}/>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase ml-1">所属派系</label>
                    <select 
                      className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-sky-500/20 transition-all font-bold text-sm"
                      value={newSkill.faction}
                      onChange={e => setNewSkill({...newSkill, faction: e.target.value})}
                    >
                      {factions.map(f => <option key={f} value={f}>{f}</option>)}
                    </select>
                  </div>
                  <textarea 
                    placeholder="技能奥义描述..." 
                    className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl h-32 outline-none focus:ring-2 focus:ring-sky-500/20 font-medium text-sm"
                    onChange={e => setNewSkill({...newSkill, description: e.target.value})}
                  />
                  <button 
                    onClick={handleAddSkill}
                    className="w-full py-4 bg-sky-600 text-white rounded-2xl font-black hover:bg-sky-500 transition-all mt-4"
                  >
                    写入技能库
                  </button>
                </div>
              </div>
              <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                {skills.map(s => (
                  <div key={s.id} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm relative group">
                    <button 
                      onClick={() => handleDelete('skills', s.id)}
                      className="absolute top-6 right-6 text-slate-200 hover:text-rose-500 transition-colors"
                    >
                      <Trash2 size={16}/>
                    </button>
                    <div className="inline-block px-2 py-0.5 bg-sky-50 text-sky-600 rounded text-[9px] font-black uppercase tracking-tighter mb-3">
                      {s.faction}
                    </div>
                    <h4 className="font-black text-lg text-slate-900 mb-2">{s.name}</h4>
                    <p className="text-xs text-slate-500 leading-relaxed">{s.description || '暂无描述'}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </AnimatePresence>
      </div>

      {/* 玩家编辑弹窗 */}
      <AnimatePresence>
        {editingUser && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div initial={{scale:0.9, opacity:0}} animate={{scale:1, opacity:1}} className="bg-white rounded-[40px] p-10 w-full max-w-2xl shadow-2xl relative">
              <button onClick={() => setEditingUser(null)} className="absolute top-8 right-8 text-slate-300 hover:text-slate-900"><X/></button>
              <h3 className="text-2xl font-black mb-8 flex items-center gap-2"><ShieldAlert className="text-amber-500"/> 修改玩家档案：{editingUser.name}</h3>
              
              <div className="grid grid-cols-2 gap-6">
                <Input label="身份/角色" value={editingUser.role} onChange={v => setEditingUser({...editingUser, role: v})}/>
                <Input label="精神力等级" value={editingUser.mentalRank} onChange={v => setEditingUser({...editingUser, mentalRank: v})}/>
                <Input label="肉体等级" value={editingUser.physicalRank} onChange={v => setEditingUser({...editingUser, physicalRank: v})}/>
                <Input label="所属能力" value={editingUser.ability} onChange={v => setEditingUser({...editingUser, ability: v})}/>
                <Input label="精神体名称" value={editingUser.spiritName} onChange={v => setEditingUser({...editingUser, spiritName: v})}/>
                <div className="col-span-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">个人资料文本</label>
                  <textarea 
                    className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl h-32 font-medium"
                    value={editingUser.profileText}
                    onChange={e => setEditingUser({...editingUser, profileText: e.target.value})}
                  />
                </div>
              </div>
              <button 
                onClick={handleUpdateUser}
                className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black mt-8 flex items-center justify-center gap-2"
              >
                <Save size={18}/> 写入数据库并同步
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {loading && (
        <div className="fixed bottom-10 right-10 bg-white shadow-xl px-6 py-3 rounded-full border border-slate-100 flex items-center gap-3 animate-bounce">
          <div className="w-2 h-2 bg-sky-500 rounded-full animate-ping"/>
          <span className="text-xs font-black">正在读取服务器数据...</span>
        </div>
      )}
    </div>
  );
}

// --- 辅助小组件 ---
function TabBtn({ active, onClick, icon, label }: any) {
  return (
    <button 
      onClick={onClick} 
      className={`flex items-center gap-2 px-6 py-3 rounded-xl transition-all font-black text-sm ${
        active ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'
      }`}
    >
      {icon} {label}
    </button>
  );
}

function Input({ label, value, onChange, type = "text", placeholder = "" }: any) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[10px] font-black text-slate-400 uppercase ml-1">{label}</label>
      <input 
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
        className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-sky-500/20 transition-all font-bold text-sm"
      />
    </div>
  );
}

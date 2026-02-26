import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, MessageSquare, Package, Zap, User as UserIcon, Trash2, MapPin, Check, ShieldAlert } from "lucide-react";

export function AdminView() {
  const [activeTab, setActiveTab] = useState<'users' | 'logs' | 'items' | 'skills'>('users');
  const [users, setUsers] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [skills, setSkills] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingUser, setEditingUser] = useState<any | null>(null);

  const [newItem, setNewItem] = useState({ name: '', description: '', locationTag: '', price: 0 });
  const [newSkill, setNewSkill] = useState({ name: '', faction: '强攻系', description: '' });

  useEffect(() => { fetchData(); }, [activeTab]);

  const fetchData = async () => {
    setLoading(true);
    const endpoints = { users: '/api/admin/users', logs: '/api/admin/roleplay_logs', items: '/api/items', skills: '/api/skills' };
    const res = await fetch(endpoints[activeTab]);
    const data = await res.json();
    if (activeTab === 'users') setUsers(data.users);
    if (activeTab === 'logs') setLogs(data.logs);
    if (activeTab === 'items') setItems(data.items);
    if (activeTab === 'skills') setSkills(data.skills);
    setLoading(false);
  };

  const handleStatusChange = async (id: number, status: string) => {
    await fetch(`/api/admin/users/${id}/status`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ status }) });
    fetchData();
  };

  const handleDeleteUser = async (id: number) => {
    if(!confirm("确定删除该角色吗？此操作不可逆。")) return;
    await fetch(`/api/admin/users/${id}`, { method: 'DELETE' });
    fetchData();
  };

  const handleUpdateUser = async () => {
    await fetch(`/api/admin/users/${editingUser.id}`, { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(editingUser) });
    setEditingUser(null);
    fetchData();
  };

  const addItem = async () => {
    await fetch('/api/admin/items', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(newItem) });
    setNewItem({ name: '', description: '', locationTag: '', price: 0 });
    fetchData();
  };

  const addSkill = async () => {
    await fetch('/api/admin/skills', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(newSkill) });
    setNewSkill({ name: '', faction: '向导', description: '' });
    fetchData();
  };

  return (
    <div className="min-h-screen bg-slate-50 p-8 font-sans text-slate-900">
      <div className="max-w-7xl mx-auto">
        <header className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-black tracking-tighter italic">命之塔 <span className="text-sky-500">ADMIN</span></h1>
          <nav className="flex bg-white p-1 rounded-2xl shadow-sm border">
            <TabBtn active={activeTab === 'users'} onClick={() => setActiveTab('users')} icon={<UserIcon size={16}/>} label="角色审核"/>
            <TabBtn active={activeTab === 'logs'} onClick={() => setActiveTab('logs')} icon={<MessageSquare size={16}/>} label="对戏存档"/>
            <TabBtn active={activeTab === 'items'} onClick={() => setActiveTab('items')} icon={<Package size={16}/>} label="世界物品"/>
            <TabBtn active={activeTab === 'skills'} onClick={() => setActiveTab('skills')} icon={<Zap size={16}/>} label="派系技能"/>
          </nav>
        </header>

        <AnimatePresence mode="wait">
          {activeTab === 'users' && (
            <motion.div key="users" initial={{opacity:0}} animate={{opacity:1}} className="bg-white rounded-3xl shadow-sm border overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-slate-50 border-b text-xs font-bold text-slate-400">
                  <tr><th className="p-4">角色/年龄</th><th className="p-4">派系/等级</th><th className="p-4">状态</th><th className="p-4 text-right">操作</th></tr>
                </thead>
                <tbody className="divide-y">
                  {users.map(u => (
                    <tr key={u.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="p-4">
                        <div className="font-bold">{u.name}</div>
                        <div className="text-xs text-slate-400">{u.age} 岁</div>
                      </td>
                      <td className="p-4">
                        <div className="text-xs font-bold text-sky-600 uppercase">{u.faction}</div>
                        <div className="text-[10px] font-mono">{u.mentalRank}/{u.physicalRank}</div>
                      </td>
                      <td className="p-4">
                        <span className={`px-2 py-1 rounded-full text-[10px] font-black ${u.status === 'approved' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                          {u.status === 'approved' ? '已过审' : '待审核'}
                        </span>
                      </td>
                      <td className="p-4 text-right space-x-2">
                        {u.status === 'pending' && <button onClick={() => handleStatusChange(u.id, 'approved')} className="text-emerald-600 hover:text-emerald-800"><Check size={18}/></button>}
                        <button onClick={() => setEditingUser(u)} className="text-sky-600 text-xs font-bold">编辑</button>
                        <button onClick={() => handleDeleteUser(u.id)} className="text-rose-500 hover:text-rose-700"><Trash2 size={16}/></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </motion.div>
          )}

          {activeTab === 'logs' && (
            <motion.div key="logs" initial={{opacity:0}} animate={{opacity:1}} className="space-y-6">
              {Array.from(new Set(logs.map(l => l.locationId))).map(loc => (
                <div key={loc} className="bg-white rounded-[32px] border p-6 shadow-sm">
                  <h3 className="text-lg font-black mb-4 flex items-center gap-2 text-slate-900 underline decoration-sky-500">
                    <MapPin size={18} className="text-sky-500"/> {loc || '未知位面'} 区域归档
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {logs.filter(l => l.locationId === loc).map(l => (
                      <div key={l.id} className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                        <div className="flex justify-between text-[10px] font-bold text-slate-400 mb-2">
                          <span>{l.senderName} ➔ {l.receiverName}</span>
                          <span>{new Date(l.createdAt).toLocaleString()}</span>
                        </div>
                        <p className="text-sm leading-relaxed text-slate-600">"{l.content}"</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </motion.div>
          )}

          {/* 物品管理 */}
          {activeTab === 'items' && (
            <div className="grid grid-cols-3 gap-8">
              <div className="col-span-1 bg-white p-6 rounded-3xl border shadow-sm">
                <h3 className="font-bold mb-4">录入新物品</h3>
                <input placeholder="物品名称" className="w-full mb-3 p-3 bg-slate-50 border rounded-xl" onChange={e => setNewItem({...newItem, name: e.target.value})}/>
                <input placeholder="地点Tag" className="w-full mb-3 p-3 bg-slate-50 border rounded-xl" onChange={e => setNewItem({...newItem, locationTag: e.target.value})}/>
                <button onClick={addItem} className="w-full py-3 bg-slate-900 text-white rounded-xl font-bold shadow-lg">部署到世界</button>
              </div>
              <div className="col-span-2 bg-white rounded-3xl border shadow-sm overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 border-b text-xs font-bold">
                    <tr><th className="p-4">名称</th><th className="p-4">地址</th><th className="p-4 text-right">删除</th></tr>
                  </thead>
                  <tbody>
                    {items.map(i => (
                      <tr key={i.id} className="border-b">
                        <td className="p-4 font-bold">{i.name}</td>
                        <td className="p-4 text-xs text-amber-600 font-black">{i.locationTag}</td>
                        <td className="p-4 text-right"><button onClick={() => fetch(`/api/admin/items/${i.id}`, {method:'DELETE'}).then(fetchData)} className="text-rose-500"><Trash2 size={16}/></button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 技能库管理 */}
          {activeTab === 'skills' && (
            <div className="grid grid-cols-3 gap-8">
              <div className="col-span-1 bg-white p-6 rounded-3xl border shadow-sm">
                <h3 className="font-bold mb-4">录入派系技能</h3>
                <input placeholder="技能名" className="w-full mb-3 p-3 bg-slate-50 border rounded-xl" onChange={e => setNewSkill({...newSkill, name: e.target.value})}/>
                <select className="w-full mb-3 p-3 bg-slate-50 border rounded-xl" onChange={e => setNewSkill({...newSkill, faction: e.target.value})}>
                  {['哨兵', '向导', '普通人', '圣所', '鬼魂'].map(f => <option key={f} value={f}>{f}</option>)}
                </select>
                <button onClick={addSkill} className="w-full py-3 bg-sky-600 text-white rounded-xl font-bold">确认发布</button>
              </div>
              <div className="col-span-2 grid grid-cols-2 gap-4">
                {skills.map(s => (
                  <div key={s.id} className="bg-white p-5 rounded-3xl border shadow-sm relative group">
                    <button onClick={() => fetch(`/api/admin/skills/${s.id}`, {method:'DELETE'}).then(fetchData)} className="absolute top-4 right-4 text-slate-300 hover:text-rose-500"><Trash2 size={14}/></button>
                    <div className="text-[10px] font-black text-sky-500 mb-1 uppercase">{s.faction}</div>
                    <div className="font-black">{s.name}</div>
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
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div initial={{scale:0.9}} animate={{scale:1}} className="bg-white rounded-[40px] p-10 w-full max-w-lg shadow-2xl relative">
              <button onClick={() => setEditingUser(null)} className="absolute top-8 right-8 text-slate-400"><X/></button>
              <h3 className="text-xl font-black mb-6 flex items-center gap-2"><ShieldAlert className="text-amber-500"/> 修改档案：{editingUser.name}</h3>
              <div className="space-y-4">
                <input type="number" placeholder="年龄" className="w-full p-3 bg-slate-50 border rounded-xl" value={editingUser.age} onChange={e => setEditingUser({...editingUser, age: parseInt(e.target.value)})}/>
                <input placeholder="身份" className="w-full p-3 bg-slate-50 border rounded-xl" value={editingUser.role} onChange={e => setEditingUser({...editingUser, role: e.target.value})}/>
                <input placeholder="精神等级" className="w-full p-3 bg-slate-50 border rounded-xl" value={editingUser.mentalRank} onChange={e => setEditingUser({...editingUser, mentalRank: e.target.value})}/>
                <button onClick={handleUpdateUser} className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black shadow-xl">同步到数据库</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function TabBtn({ active, onClick, icon, label }: any) {
  return (
    <button onClick={onClick} className={`flex items-center gap-2 px-6 py-3 rounded-xl transition-all font-bold text-sm ${active ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}>
      {icon} {label}
    </button>
  );
}

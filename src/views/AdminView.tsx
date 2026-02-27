import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  X, MessageSquare, Package, Zap, User as UserIcon, 
  Trash2, MapPin, CheckCircle, XCircle, Edit3, ShieldAlert, Users 
} from "lucide-react";

// ================= 全局配置字典 (与前端地图、NPC、抽卡系统严格对齐) =================
const FACTIONS = [
  '物理系', '元素系', '精神系', '感知系', '信息系', '治疗系', '强化系', '炼金系', // 对应 ExtractorView 抽卡库
  '圣所', '普通人' // 补充特殊身份
];

const LOCATIONS = [
  { id: 'none', name: '无 / 全局通用' },
  { id: 'tower_of_life', name: '大地图 - 命之塔' },
  { id: 'london_tower', name: '大地图 - 伦敦塔' },
  { id: 'sanctuary', name: '大地图 - 圣所' },
  { id: 'guild', name: '大地图 - 公会' },
  { id: 'slums', name: '大地图 - 贫民区' },
  { id: 'rich_area', name: '大地图 - 富人区' },
  { id: 'tower_guard', name: '大地图 - 守塔会' },
  { id: 'demon_society', name: '大地图 - 恶魔会' },
  { id: 'paranormal_office', name: '大地图 - 灵异管理所' },
  { id: 'observers', name: '大地图 - 观察者' },
  { id: 'tower_top', name: '塔内 - 神使层' },
  { id: 'tower_attendant', name: '塔内 - 侍奉者层' },
  { id: 'tower_descendant', name: '塔内 - 神使后裔层' },
  { id: 'tower_training', name: '塔内 - 精神力训练所' },
  { id: 'tower_evaluation', name: '塔内 - 评定所' }
];

const NPCS = [
  { id: 'none', name: '无 / 非 NPC 专属' },
  { id: 'npc_merchant', name: '贾斯汀 (拍卖商人)' },
  { id: 'npc_craftsman', name: '老乔 (手艺人)' },
  { id: 'npc_guild_staff', name: '玛丽 (公会接待)' }
];

export function AdminView() {
  const [activeTab, setActiveTab] = useState<'users' | 'logs' | 'items' | 'skills'>('users');
  const [users, setUsers] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [skills, setSkills] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingUser, setEditingUser] = useState<any | null>(null);

  // 表单状态 (加入了 npcId 字段)
  const [newItem, setNewItem] = useState({ name: '', description: '', locationTag: '', npcId: '', price: 0 });
  const [newSkill, setNewSkill] = useState({ name: '', faction: '物理系', description: '', npcId: '' });

  useEffect(() => { fetchData(); }, [activeTab]);

  const fetchData = async () => {
    setLoading(true);
    const endpoints = { users: '/api/admin/users', logs: '/api/admin/roleplay_logs', items: '/api/items', skills: '/api/skills' };
    try {
      const res = await fetch(endpoints[activeTab]);
      const data = await res.json();
      if (activeTab === 'users') setUsers(data.users);
      if (activeTab === 'logs') setLogs(data.logs);
      if (activeTab === 'items') setItems(data.items);
      if (activeTab === 'skills') setSkills(data.skills);
    } catch (e) { console.error("Fetch Error:", e); }
    setLoading(false);
  };

  // --- 玩家审核与管理 ---
  const handleStatusChange = async (id: number, status: string) => {
    await fetch(`/api/admin/users/${id}/status`, { 
      method: 'POST', 
      headers: {'Content-Type': 'application/json'}, 
      body: JSON.stringify({ status }) 
    });
    fetchData();
  };

  const handleDeleteUser = async (id: number) => {
    if(!confirm("⚠️ 警告：确定要彻底删除该角色吗？此操作将抹除所有数据且不可恢复。")) return;
    await fetch(`/api/admin/users/${id}`, { method: 'DELETE' });
    fetchData();
  };

  const handleUpdateUser = async () => {
    await fetch(`/api/admin/users/${editingUser.id}`, { 
      method: 'PUT', 
      headers: {'Content-Type': 'application/json'}, 
      body: JSON.stringify(editingUser) 
    });
    setEditingUser(null);
    alert("玩家数据已更新同步");
    fetchData();
  };

  // --- 物品与技能管理 ---
  const addItem = async () => {
    if(!newItem.name) return alert("请填写物品名称");
    await fetch('/api/admin/items', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(newItem) });
    setNewItem({ name: '', description: '', locationTag: '', npcId: '', price: 0 });
    fetchData();
  };

  const addSkill = async () => {
    if(!newSkill.name) return alert("请填写技能名称");
    await fetch('/api/admin/skills', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(newSkill) });
    setNewSkill({ name: '', faction: '物理系', description: '', npcId: '' });
    fetchData();
  };

  // --- 核心算法：对戏记录双重分类 (按地点 -> 按对戏人名) ---
  const groupedLogs = logs.reduce((acc: any, log: any) => {
    const loc = log.locationId || '未知位面';
    if (!acc[loc]) acc[loc] = {};
    const pair = [log.senderName, log.receiverName].sort().join(' ⇌ ');
    if (!acc[loc][pair]) acc[loc][pair] = [];
    acc[loc][pair].push(log);
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-[#f8fafc] p-8 font-sans text-slate-800">
      <div className="max-w-[1400px] mx-auto">
        <header className="flex flex-col md:flex-row justify-between items-center mb-10 gap-4">
          <div>
            <h1 className="text-3xl font-black tracking-tighter flex items-center gap-3">
              命之塔 <span className="text-sky-600 bg-sky-50 px-3 py-1 rounded-xl text-xl">ADMIN</span>
            </h1>
          </div>
          <nav className="flex bg-white p-1.5 rounded-2xl shadow-sm border border-slate-200">
            <TabBtn active={activeTab === 'users'} onClick={() => setActiveTab('users')} icon={<UserIcon size={18}/>} label="角色审核与管理"/>
            <TabBtn active={activeTab === 'logs'} onClick={() => setActiveTab('logs')} icon={<MessageSquare size={18}/>} label="对戏区域归档"/>
            <TabBtn active={activeTab === 'items'} onClick={() => setActiveTab('items')} icon={<Package size={18}/>} label="世界物品库"/>
            <TabBtn active={activeTab === 'skills'} onClick={() => setActiveTab('skills')} icon={<Zap size={18}/>} label="派系技能库"/>
          </nav>
        </header>

        <AnimatePresence mode="wait">
          {/* ================= 1. 角色管理与审核 ================= */}
          {activeTab === 'users' && (
            <motion.div key="users" initial={{opacity:0, y:10}} animate={{opacity:1, y:0}} className="bg-white rounded-[32px] shadow-sm border border-slate-200 overflow-hidden">
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
                    {users.map(u => (
                      <tr key={u.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="p-6">
                          <div className="font-black text-slate-900 text-base mb-1">{u.name}</div>
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-black ${u.age < 16 ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-500'}`}>
                              {u.age} 岁
                            </span>
                            <span className="text-xs text-slate-400 font-medium">{u.age < 16 ? '未分化幼崽' : (u.role || '未分化')}</span>
                          </div>
                        </td>
                        <td className="p-6">
                          <div className="text-xs font-black text-sky-600 uppercase tracking-widest mb-1">{u.faction}</div>
                          <div className="text-[11px] font-mono font-bold text-slate-500">
                            神: <span className="text-sky-500">{u.mentalRank}</span> / 体: <span className="text-rose-500">{u.physicalRank}</span>
                          </div>
                        </td>
                        <td className="p-6 text-slate-500 text-xs font-medium flex items-center gap-1 mt-3">
                          <MapPin size={14} className="text-slate-300"/> {u.currentLocation || '暂未登录'}
                        </td>
                        <td className="p-6">
                          {u.status === 'pending' && <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black bg-amber-50 text-amber-600 border border-amber-200">待审核</span>}
                          {u.status === 'approved' && <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black bg-emerald-50 text-emerald-600 border border-emerald-200">已过审</span>}
                          {u.status === 'rejected' && <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black bg-rose-50 text-rose-600 border border-rose-200">已驳回</span>}
                        </td>
                        <td className="p-6">
                          <div className="flex items-center justify-end gap-3">
                            {/* 审核操作区 */}
                            {u.status === 'pending' && (
                              <div className="flex gap-2 mr-4 border-r pr-4">
                                <button onClick={() => handleStatusChange(u.id, 'approved')} title="通过" className="p-1.5 bg-emerald-100 text-emerald-600 rounded-lg hover:bg-emerald-500 hover:text-white transition-colors"><CheckCircle size={18}/></button>
                                <button onClick={() => handleStatusChange(u.id, 'rejected')} title="驳回" className="p-1.5 bg-rose-100 text-rose-600 rounded-lg hover:bg-rose-500 hover:text-white transition-colors"><XCircle size={18}/></button>
                              </div>
                            )}
                            {/* 编辑与删除区 */}
                            <button onClick={() => setEditingUser(u)} className="flex items-center gap-1 text-sky-600 text-xs font-bold hover:bg-sky-50 px-3 py-1.5 rounded-lg transition-colors">
                              <Edit3 size={14}/> 编辑
                            </button>
                            <button onClick={() => handleDeleteUser(u.id)} className="flex items-center gap-1 text-rose-500 text-xs font-bold hover:bg-rose-50 px-3 py-1.5 rounded-lg transition-colors">
                              <Trash2 size={14}/> 删除
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {users.length === 0 && <tr><td colSpan={5} className="p-10 text-center text-slate-400">暂无玩家数据</td></tr>}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}

          {/* ================= 2. 存戏区域归档 ================= */}
          {activeTab === 'logs' && (
            <motion.div key="logs" initial={{opacity:0}} animate={{opacity:1}} className="space-y-10">
              {Object.keys(groupedLogs).length === 0 && <div className="text-center py-20 text-slate-400 font-bold">目前世界非常安静，没有任何戏份存档。</div>}
              
              {Object.entries(groupedLogs).map(([loc, pairs]: [string, any]) => (
                <div key={loc} className="bg-white rounded-[40px] border border-slate-200 p-8 shadow-sm">
                  <div className="flex items-center gap-3 mb-8 pb-4 border-b border-slate-100">
                    <div className="p-3 bg-sky-50 text-sky-600 rounded-2xl"><MapPin size={24}/></div>
                    <div>
                      <h3 className="text-2xl font-black text-slate-900">
                        {LOCATIONS.find(l => l.id === loc)?.name || loc}
                      </h3>
                      <p className="text-xs text-slate-400 font-bold mt-1">区域戏份收录库</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {Object.entries(pairs).map(([pairName, messages]: [string, any]) => (
                      <div key={pairName} className="bg-slate-50 rounded-3xl p-6 border border-slate-100 shadow-inner flex flex-col h-full">
                        <div className="flex items-center gap-2 mb-6">
                          <Users size={16} className="text-indigo-500"/>
                          <h4 className="font-black text-indigo-900">{pairName} <span className="text-xs font-medium text-slate-400 ml-2">({messages.length} 条互动)</span></h4>
                        </div>
                        
                        <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar flex-1">
                          {messages.map((m: any) => (
                            <div key={m.id} className="relative pl-4 border-l-2 border-slate-200">
                              <div className="absolute w-2 h-2 bg-slate-300 rounded-full -left-[5px] top-1.5"/>
                              <div className="flex justify-between items-end mb-1">
                                <span className="text-xs font-black text-slate-800">{m.senderName}</span>
                                <span className="text-[10px] text-slate-400 font-mono">{new Date(m.createdAt).toLocaleString()}</span>
                              </div>
                              <p className="text-sm text-slate-600 leading-relaxed bg-white p-3 rounded-xl border border-slate-100 shadow-sm inline-block">
                                {m.content}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </motion.div>
          )}

          {/* ================= 3. 物品库管理 (精确绑定) ================= */}
          {activeTab === 'items' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-1 bg-white p-8 rounded-[32px] border border-slate-200 shadow-sm h-fit sticky top-8">
                <h3 className="font-black text-lg mb-6 flex items-center gap-2"><Package size={20} className="text-amber-500"/> 部署新物品</h3>
                <div className="space-y-4">
                  <Input label="物品名称" value={newItem.name} onChange={(v:any) => setNewItem({...newItem, name: v})}/>
                  
                  {/* 精确的下拉菜单绑定地图 */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase ml-1">专属掉落地图</label>
                    <select className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-sky-500/20 text-sm font-bold text-slate-700" 
                      value={newItem.locationTag} onChange={e => setNewItem({...newItem, locationTag: e.target.value})}>
                      <option value="">请选择掉落地图</option>
                      {LOCATIONS.map(loc => <option key={loc.id} value={loc.id === 'none' ? '' : loc.id}>{loc.name}</option>)}
                    </select>
                  </div>

                  {/* 精确的下拉菜单绑定 NPC */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase ml-1">专属给予 NPC (可选)</label>
                    <select className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-sky-500/20 text-sm font-bold text-slate-700" 
                      value={newItem.npcId} onChange={e => setNewItem({...newItem, npcId: e.target.value})}>
                      {NPCS.map(n => <option key={n.id} value={n.id === 'none' ? '' : n.id}>{n.name}</option>)}
                    </select>
                  </div>

                  <Input label="市场价值 (Gold)" type="number" value={newItem.price.toString()} onChange={(v:any) => setNewItem({...newItem, price: parseInt(v) || 0})}/>
                  <textarea placeholder="物品效果描述..." className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-sky-500/20 text-sm h-24" onChange={(e) => setNewItem({...newItem, description: e.target.value})}/>
                  <button onClick={addItem} className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black hover:bg-slate-800 transition-all shadow-lg mt-2">
                    上传至世界数据库
                  </button>
                </div>
              </div>
              <div className="lg:col-span-2 bg-white rounded-[32px] border border-slate-200 shadow-sm overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 border-b text-[11px] font-bold text-slate-400 uppercase">
                    <tr><th className="p-6">物品信息</th><th className="p-6">产出节点 / NPC</th><th className="p-6 text-right">操作</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {items.map(i => (
                      <tr key={i.id} className="hover:bg-slate-50/50">
                        <td className="p-6">
                          <div className="font-bold text-slate-900">{i.name}</div>
                          <div className="text-xs text-slate-400 mt-1 max-w-xs truncate">{i.description || '无描述'}</div>
                          <div className="text-[10px] font-mono text-amber-600 mt-1">价值: {i.price} G</div>
                        </td>
                        <td className="p-6">
                          <div className="flex flex-col gap-1 items-start">
                            {i.locationTag && <span className="px-2 py-0.5 bg-amber-50 text-amber-700 rounded-lg text-[10px] font-black tracking-wider">{LOCATIONS.find(l => l.id === i.locationTag)?.name || i.locationTag}</span>}
                            {i.npcId && <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-lg text-[10px] font-black tracking-wider">{NPCS.find(n => n.id === i.npcId)?.name || i.npcId}</span>}
                            {!i.locationTag && !i.npcId && <span className="text-[10px] text-slate-400">全局通用</span>}
                          </div>
                        </td>
                        <td className="p-6 text-right">
                          <button onClick={() => {if(confirm("确定删除该物品？")) fetch(`/api/admin/items/${i.id}`, {method:'DELETE'}).then(fetchData)}} className="text-slate-300 hover:text-rose-500 p-2"><Trash2 size={18}/></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ================= 4. 派系技能库 (与抽卡系统同步) ================= */}
          {activeTab === 'skills' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-1 bg-white p-8 rounded-[32px] border border-slate-200 shadow-sm h-fit sticky top-8">
                <h3 className="font-black text-lg mb-6 flex items-center gap-2"><Zap size={20} className="text-sky-500"/> 录入派系奥义</h3>
                <div className="space-y-4">
                  <Input label="技能名称" value={newSkill.name} onChange={(v:any) => setNewSkill({...newSkill, name: v})}/>
                  
                  {/* 精确同步的技能派系选项 */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase ml-1">专属派系限制</label>
                    <select className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-sky-500/20 text-sm font-bold text-slate-700" 
                      value={newSkill.faction} onChange={e => setNewSkill({...newSkill, faction: e.target.value})}>
                      {FACTIONS.map(f => <option key={f} value={f}>{f}</option>)}
                    </select>
                  </div>

                  {/* 精确的下拉菜单绑定教学 NPC */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase ml-1">专属教学 NPC (可选)</label>
                    <select className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-sky-500/20 text-sm font-bold text-slate-700" 
                      value={newSkill.npcId} onChange={e => setNewSkill({...newSkill, npcId: e.target.value})}>
                      {NPCS.map(n => <option key={n.id} value={n.id === 'none' ? '' : n.id}>{n.name}</option>)}
                    </select>
                  </div>

                  <textarea placeholder="技能效果详细描述..." className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-sky-500/20 text-sm h-32" onChange={e => setNewSkill({...newSkill, description: e.target.value})}/>
                  <button onClick={addSkill} className="w-full py-4 bg-sky-600 text-white rounded-2xl font-black hover:bg-sky-700 transition-all shadow-lg mt-2">
                    发布技能模板
                  </button>
                </div>
              </div>
              <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
                {skills.map(s => (
                  <div key={s.id} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm relative group hover:border-sky-300 transition-colors">
                    <button onClick={() => {if(confirm("确定删除该技能？")) fetch(`/api/admin/skills/${s.id}`, {method:'DELETE'}).then(fetchData)}} className="absolute top-6 right-6 text-slate-200 hover:text-rose-500 transition-colors"><Trash2 size={16}/></button>
                    <div className="flex items-center gap-2 mb-3">
                      <span className="inline-block px-2.5 py-1 bg-sky-50 text-sky-600 rounded-lg text-[10px] font-black uppercase tracking-widest">
                        {s.faction}
                      </span>
                      {s.npcId && (
                        <span className="inline-block px-2.5 py-1 bg-emerald-50 text-emerald-600 rounded-lg text-[10px] font-black uppercase tracking-widest">
                          NPC专属
                        </span>
                      )}
                    </div>
                    <div className="font-black text-lg text-slate-900 mb-2">{s.name}</div>
                    <p className="text-xs text-slate-500 leading-relaxed">{s.description || '暂无描述'}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </AnimatePresence>
      </div>

      {/* ================= 全局编辑玩家弹窗 ================= */}
      <AnimatePresence>
        {editingUser && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
            <motion.div initial={{scale:0.95, opacity:0}} animate={{scale:1, opacity:1}} exit={{scale:0.95, opacity:0}} className="bg-white rounded-[40px] p-10 w-full max-w-2xl shadow-2xl relative my-8">
              <button onClick={() => setEditingUser(null)} className="absolute top-8 right-8 text-slate-400 hover:text-slate-900 bg-slate-100 p-2 rounded-full transition-colors"><X size={20}/></button>
              
              <h3 className="text-2xl font-black mb-2 flex items-center gap-2"><ShieldAlert className="text-amber-500"/> 修改玩家档案</h3>
              <p className="text-sm text-slate-500 mb-8 ml-8">正在编辑: <span className="font-bold text-slate-900">{editingUser.name}</span></p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Input label="年龄 (自动判定是否圣所未分化)" type="number" value={editingUser.age?.toString() || '0'} onChange={(v:any) => setEditingUser({...editingUser, age: parseInt(v) || 0})}/>
                <Input label="身份 (哨兵/向导/鬼魂/普通人)" value={editingUser.role || ''} onChange={(v:any) => setEditingUser({...editingUser, role: v})}/>
                
                {/* 玩家编辑页面的派系下拉列表 */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-1">能力偏好/派系</label>
                  <select className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-sky-500/20 text-sm font-bold text-slate-700" 
                    value={editingUser.ability || ''} onChange={e => setEditingUser({...editingUser, ability: e.target.value})}>
                    {FACTIONS.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>

                <Input label="精神力等级 (S/A/B等)" value={editingUser.mentalRank || ''} onChange={(v:any) => setEditingUser({...editingUser, mentalRank: v})}/>
                <Input label="肉体强度等级" value={editingUser.physicalRank || ''} onChange={(v:any) => setEditingUser({...editingUser, physicalRank: v})}/>
                <Input label="精神体名称" value={editingUser.spiritName || ''} onChange={(v:any) => setEditingUser({...editingUser, spiritName: v})}/>
                
                <div className="col-span-1 md:col-span-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-1 mb-1.5 block">个人资料文本</label>
                  <textarea className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-sky-500/20 text-sm min-h-[120px]" value={editingUser.profileText || ''} onChange={e => setEditingUser({...editingUser, profileText: e.target.value})}/>
                </div>
              </div>

              <div className="mt-8 flex gap-4">
                <button onClick={() => setEditingUser(null)} className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black hover:bg-slate-200 transition-colors">取消</button>
                <button onClick={handleUpdateUser} className="flex-[2] py-4 bg-slate-900 text-white rounded-2xl font-black hover:bg-slate-800 transition-all shadow-xl shadow-slate-200">
                  强制覆写并保存数据
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background-color: #e2e8f0; border-radius: 20px; }
      `}} />
    </div>
  );
}

// 辅助组件：顶部导航按钮
function TabBtn({ active, onClick, icon, label }: any) {
  return (
    <button onClick={onClick} className={`flex items-center gap-2 px-6 py-3 rounded-xl transition-all font-black text-[13px] ${active ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:text-slate-700 hover:bg-slate-50'}`}>
      {icon} {label}
    </button>
  );
}

// 辅助组件：统一输入框
function Input({ label, value, onChange, type = "text", placeholder = "" }: any) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[10px] font-black text-slate-400 uppercase ml-1">{label}</label>
      <input type={type} value={value} placeholder={placeholder} onChange={e => onChange(e.target.value)} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-sky-500/20 transition-all font-bold text-sm text-slate-700"/>
    </div>
  );
}
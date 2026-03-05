import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ArrowLeft, X, Eye, BookOpen, 
  Database, UserCog, Monitor, 
  Feather, Skull, Users, Globe, Gavel, MessageCircle
} from 'lucide-react';
import { User } from '../types';
import FactionMemberPanel from './shared/FactionMemberPanel';

interface Props {
  user: User;
  onExit: () => void;
  showToast: (msg: string) => void;
  fetchGlobalData: () => void;
}

interface ObserverBook {
  id: number;
  title: string;
  content: string;
  authorUserId: number;
  authorName: string;
  createdAt: string;
  updatedAt: string;
  canEdit: boolean;
  canDelete: boolean;
}

interface ObserverReplayLog {
  id: string;
  kind: 'group' | 'pair';
  title: string;
  locationName: string;
  participantNames: string;
  createdAt: string;
  messageCount: number;
  latestMessage?: {
    senderName: string;
    content: string;
    type: string;
    createdAt: string;
  } | null;
}

interface ObserverReplayMessage {
  id: number;
  archiveId: string;
  senderId: number;
  senderName: string;
  content: string;
  type: string;
  createdAt: string;
}

// 建筑点坐标
const buildings = [
  { id: 'entrance', name: '监控总控室', x: 20, y: 30, icon: <Eye/>, desc: '掌控世界的情报网节点，入职通道。' },
  { id: 'library', name: '真理大图书馆', x: 75, y: 35, icon: <BookOpen/>, desc: '记载着所有人的过去、现在与死亡。' },
  { id: 'intel_collect', name: '情报搜集部', x: 35, y: 70, icon: <Globe/>, desc: '派遣耳目去各个阵营窃取信息。' },
  { id: 'intel_process', name: '情报处理处', x: 60, y: 65, icon: <Database/>, desc: '解密加密波段，整理混沌的数据。' }
];

// 职位常量
const ROLES = {
  BOSS: '观察者首领',
  COLLECTOR: '情报搜集员',
  PROCESSOR: '情报处理员'
};

const RANK_SCORES: Record<string, number> = {
  '无': 0, 'F': 1, 'E': 2, 'D': 3, 'C': 4, 'C+': 5, 'B': 6, 'B+': 7, 
  'A': 8, 'A+': 9, 'S': 10, 'S+': 11, 'SS': 12, 'SS+': 13, 'SSS': 14
};

export function ObserverView({ user, onExit, showToast, fetchGlobalData }: Props) {
  const [selectedBuilding, setSelectedBuilding] = useState<any>(null);
  const [isHacking, setIsHacking] = useState(false);
  
  // 图书馆相关状态
  const [libraryTab, setLibraryTab] = useState<'records' | 'tombstones' | 'books' | 'auctions' | 'replays'>('records');
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [auctionArchives, setAuctionArchives] = useState<any[]>([]);
  const [books, setBooks] = useState<ObserverBook[]>([]);
  const [replayLogs, setReplayLogs] = useState<ObserverReplayLog[]>([]);
  const [expandedReplayId, setExpandedReplayId] = useState('');
  const [replayMessagesByArchive, setReplayMessagesByArchive] = useState<Record<string, ObserverReplayMessage[]>>({});
  const [replayLoadingId, setReplayLoadingId] = useState('');
  const [newBook, setNewBook] = useState({ title: '', content: '' });
  const [editingBookId, setEditingBookId] = useState<number | null>(null);
  const [editBook, setEditBook] = useState({ title: '', content: '' });
  const [isWriting, setIsWriting] = useState(false);
  const [bookBusy, setBookBusy] = useState(false);

  // 身份判断
  const isObserver = Object.values(ROLES).includes(user.job || '');
  const getScore = (rank?: string) => RANK_SCORES[rank || '无'] || 0;

  // 当进入图书馆时获取全服数据
  useEffect(() => {
    if (selectedBuilding?.id !== 'library') return;
    fetchAllUsers();
    fetchAuctionArchives();
    fetchBooks(true);
    fetchReplayLogs(true);
    const timer = setInterval(() => {
      fetchAuctionArchives();
      fetchBooks(true);
      fetchReplayLogs(true);
    }, 6000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBuilding?.id, user.id]);

  const fetchAllUsers = async () => {
    try {
      const res = await fetch('/api/users');
      const data = await res.json();
      if (data.success) {
        setAllUsers(Array.isArray(data.users) ? data.users : []);
      }
    } catch (e) {
      console.error("无法获取人员档案");
    }
  };

  const fetchAuctionArchives = async () => {
    try {
      const res = await fetch('/api/observer/library/auctions?limit=60');
      const data = await res.json().catch(() => ({} as any));
      if (res.ok && data.success) setAuctionArchives(Array.isArray(data.logs) ? data.logs : []);
    } catch {
      // ignore
    }
  };

  const fetchReplayLogs = async (silent = false) => {
    try {
      const res = await fetch('/api/observer/library/replays?limit=120&kind=all');
      const data = await res.json().catch(() => ({} as any));
      if (!res.ok || data.success === false) {
        if (!silent) showToast(data.message || '读取回顾失败');
        return;
      }
      setReplayLogs(Array.isArray(data.logs) ? data.logs : []);
    } catch {
      if (!silent) showToast('网络异常，读取回顾失败');
    }
  };

  const toggleReplayMessages = async (archiveId: string) => {
    const id = String(archiveId || '').trim();
    if (!id) return;
    if (expandedReplayId === id) {
      setExpandedReplayId('');
      return;
    }
    setExpandedReplayId(id);
    if (replayMessagesByArchive[id]) return;

    setReplayLoadingId(id);
    try {
      const res = await fetch(`/api/observer/library/replays/${encodeURIComponent(id)}/messages?limit=300`);
      const data = await res.json().catch(() => ({} as any));
      if (!res.ok || data.success === false) {
        showToast(data.message || '读取回顾内容失败');
        return;
      }
      setReplayMessagesByArchive((prev) => ({
        ...prev,
        [id]: Array.isArray(data.messages) ? data.messages : []
      }));
    } catch {
      showToast('网络异常，读取回顾内容失败');
    } finally {
      setReplayLoadingId('');
    }
  };

  const fetchBooks = async (silent = false) => {
    try {
      const res = await fetch(`/api/observer/library/books?userId=${user.id}&limit=300`);
      const data = await res.json().catch(() => ({} as any));
      if (!res.ok || data.success === false) {
        if (!silent) showToast(data.message || '读取文献失败');
        return;
      }
      setBooks(Array.isArray(data.books) ? data.books : []);
    } catch {
      if (!silent) showToast('网络异常，读取文献失败');
    }
  };

  // --- 核心逻辑：入职与资质校验 ---
  const checkQualifications = (targetRank: string) => {
    if ((user.age || 0) < 16) return false; // 必须满16岁
    
    const pScore = getScore(user.physicalRank);
    const mScore = getScore(user.mentalRank);
    
    if (targetRank === ROLES.COLLECTOR) return pScore >= RANK_SCORES['C+']; // 搜集员：体C+，神不限
    if (targetRank === ROLES.PROCESSOR) return mScore >= RANK_SCORES['C+']; // 处理员：神C+，体不限
    if (targetRank === ROLES.BOSS) return mScore >= RANK_SCORES['S+'] && pScore >= RANK_SCORES['S+']; // 首领：双S+
    return false;
  };

  const handleJoinOrPromote = async (targetRank: string) => {
    if ((user.age || 0) < 16) {
      return showToast("访问拒绝：未成年个体禁止接入观察者网络。");
    }

    if (!checkQualifications(targetRank)) {
      return showToast(`权限拒绝：${targetRank} 需要更高的算力等级。`);
    }

    const res = await fetch('/api/tower/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id, jobName: targetRank })
    });
    
    const data = await res.json();
    if (data.success) {
      showToast(`连接建立。欢迎加入真理的网络，${targetRank}。`);
      fetchGlobalData();
    } else {
      showToast(data.message || '操作失败');
    }
  };

  // --- 核心逻辑：打工（情报工作） ---
  const handleWork = async (type: 'collect' | 'process') => {
    if ((user.workCount || 0) >= 3) return showToast("警告：今日脑机接口负荷已达上限。");

    const res = await fetch('/api/tower/work', { 
      method: 'POST', 
      headers: { 'Content-Type': 'application/json' }, 
      body: JSON.stringify({ userId: user.id })
    });
    const data = await res.json();

    if (data.success) {
      setIsHacking(true);
      setTimeout(() => setIsHacking(false), 2000);

      let msg = "";
      if (type === 'collect') msg = "骇入成功！截获了一份关于守塔会人员调动的加密文档。";
      if (type === 'process') msg = "破译完成！从乱码中解析出了地下黑市的交易流水。";

      showToast(`${msg} (津贴 +${data.reward}G)`);
      fetchGlobalData();
    }
  };

  // --- 图书馆：发布/编辑/删除文献 ---
  const handlePublishBook = async () => {
    if (!isObserver) return showToast('只有观察者成员可以写书。');
    setBookBusy(true);
    try {
      const res = await fetch('/api/observer/library/books', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          title: newBook.title,
          content: newBook.content
        })
      });
      const data = await res.json().catch(() => ({} as any));
      if (!res.ok || data.success === false) {
        showToast(data.message || '写入文献失败');
        return;
      }
      setNewBook({ title: '', content: '' });
      setIsWriting(false);
      fetchBooks(true);
      showToast(data.message || '文献已写入图书馆');
    } catch {
      showToast('网络异常，写入失败');
    } finally {
      setBookBusy(false);
    }
  };

  const startEditBook = (book: ObserverBook) => {
    if (!book.canEdit) return showToast('你不能编辑别人写的文献');
    setIsWriting(false);
    setEditingBookId(book.id);
    setEditBook({ title: String(book.title || ''), content: String(book.content || '') });
  };

  const saveEditBook = async (bookId: number) => {
    if (!isObserver) return showToast('只有观察者成员可以编辑文献');
    setBookBusy(true);
    try {
      const res = await fetch(`/api/observer/library/books/${bookId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          title: editBook.title,
          content: editBook.content
        })
      });
      const data = await res.json().catch(() => ({} as any));
      if (!res.ok || data.success === false) {
        showToast(data.message || '编辑失败');
        return;
      }
      setEditingBookId(null);
      setEditBook({ title: '', content: '' });
      fetchBooks(true);
      showToast(data.message || '文献已更新');
    } catch {
      showToast('网络异常，编辑失败');
    } finally {
      setBookBusy(false);
    }
  };

  const deleteBook = async (book: ObserverBook) => {
    if (!book.canDelete) return showToast('你不能删除别人写的文献');
    if (!window.confirm('确定删除这本你写的文献吗？')) return;
    setBookBusy(true);
    try {
      const res = await fetch(`/api/observer/library/books/${book.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id })
      });
      const data = await res.json().catch(() => ({} as any));
      if (!res.ok || data.success === false) {
        showToast(data.message || '删除失败');
        return;
      }
      if (editingBookId === book.id) {
        setEditingBookId(null);
        setEditBook({ title: '', content: '' });
      }
      fetchBooks(true);
      showToast(data.message || '文献已删除');
    } catch {
      showToast('网络异常，删除失败');
    } finally {
      setBookBusy(false);
    }
  };

  return (
    <div className="absolute inset-0 bg-black overflow-hidden font-mono select-none text-green-500">
      
      {/* 1. 背景层：统一 Public 图片 + CRT 滤镜 */}
      <div className="absolute inset-0 z-0">
        <img 
          src="/观察者.jpg" 
          className="w-full h-full object-cover opacity-30"
          alt="Observer HQ"
        />
        {/* 扫描线与暗角滤镜 */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_2px,3px_100%] pointer-events-none z-10" />
        <div className="absolute inset-0 bg-radial-gradient(circle, rgba(0,0,0,0) 0%, rgba(0,0,0,0.8) 100%) pointer-events-none z-10" />
      </div>

      {/* 2. 顶部导航 */}
      <div className="absolute top-6 left-6 z-50">
        <button 
          onClick={onExit} 
          className="bg-black/90 text-green-500 border border-green-700/50 px-5 py-2.5 rounded-sm font-bold shadow-[0_0_15px_rgba(34,197,94,0.2)] flex items-center gap-2 hover:bg-green-900/30 hover:border-green-500 transition-all active:scale-95"
        >
          <ArrowLeft size={18}/> <span className="hidden md:inline">断开连接</span>
        </button>
      </div>

      {/* 3. 建筑交互点 */}
      <div className="relative z-20 w-full h-full">
        {buildings.map(b => (
          <div 
            key={b.id} 
            className="absolute transform -translate-x-1/2 -translate-y-1/2 z-10 cursor-pointer group touch-manipulation"
            style={{ left: `${b.x}%`, top: `${b.y}%` }}
            onClick={() => setSelectedBuilding(b)}
          >
            <div className="flex flex-col items-center gap-2">
              <div className="w-16 h-16 md:w-20 md:h-20 bg-black/80 border border-green-600/50 shadow-[0_0_20px_rgba(34,197,94,0.2)] flex items-center justify-center text-green-500 group-hover:scale-110 group-hover:bg-green-900/80 group-hover:text-white group-hover:border-green-400 transition-all rounded-full relative overflow-hidden">
                 {/* 扫描动画 */}
                 <div className="absolute top-0 left-0 w-full h-1 bg-green-500/50 animate-[scan_2s_linear_infinite] opacity-50 group-hover:opacity-100"></div>
                {React.cloneElement(b.icon, { size: 32 })}
              </div>
              <div className="bg-black/90 text-green-400 text-[10px] md:text-xs font-bold px-3 py-1 border border-green-800 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity shadow-lg">
                {b.name}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 4. 黑客特效 (全屏覆盖) */}
      <AnimatePresence>
        {isHacking && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex items-center justify-center bg-black/95 font-mono"
          >
            <div className="text-center w-full max-w-md p-8 border-y-2 border-green-500 bg-green-900/10">
               <Monitor size={64} className="mx-auto text-green-500 animate-pulse mb-6"/>
               <p className="text-green-500 text-xl md:text-2xl overflow-hidden whitespace-nowrap border-r-4 border-green-500 animate-typing mx-auto w-fit">
                 正在接入核心主机...
               </p>
               <p className="text-green-700 text-xs mt-4 animate-pulse">数据包解密中 [||||||||||||||||||||] 100%</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 5. 建筑详情弹窗 */}
      <AnimatePresence>
        {selectedBuilding && (
          <>
            {/* 遮罩 */}
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => {
                setSelectedBuilding(null);
                setIsWriting(false);
                setEditingBookId(null);
              }}
              className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40"
            />

            {/* 弹窗本体 - 终端风格 */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }} 
              animate={{ opacity: 1, scale: 1 }} 
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
            >
              <div className="bg-black w-full max-w-3xl shadow-[0_0_50px_rgba(34,197,94,0.15)] relative border border-green-800 p-1 flex flex-col max-h-[85vh] pointer-events-auto">
                {/* 四角装饰 */}
                <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-green-500"></div>
                <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-green-500"></div>
                <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-green-500"></div>
                <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-green-500"></div>

                <button
                  onClick={() => {
                    setSelectedBuilding(null);
                    setIsWriting(false);
                    setEditingBookId(null);
                  }}
                  className="absolute top-6 right-6 text-green-700 hover:text-green-400 transition-colors z-20 bg-black/50 p-1"
                >
                  <X size={24}/>
                </button>

                <div className="p-6 md:p-8 overflow-y-auto custom-scrollbar flex-1 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]">
                  
                  {/* 标题栏 */}
                  <div className="flex items-center gap-5 mb-8 border-b border-green-900 pb-6">
                    <div className="p-4 bg-green-900/20 rounded text-green-500 border border-green-800">
                      {React.cloneElement(selectedBuilding.icon, { size: 32 })}
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-green-400 tracking-wider font-mono uppercase">{selectedBuilding.name}</h2>
                      <p className="text-xs text-green-700 font-bold mt-1 uppercase tracking-widest">{selectedBuilding.desc}</p>
                    </div>
                  </div>

                  {/* === 总控室：入职 === */}
                  {selectedBuilding.id === 'entrance' && (
                    <div className="space-y-6">
                      {!isObserver ? (
                        <>
                          <div className="p-4 bg-green-900/10 border border-green-800 text-xs text-green-500 font-mono leading-relaxed">
                            {/* 修复：将 > 替换为 &gt; */}
                            <span className="text-green-400 font-bold">&gt; 系统检测:</span><br/>
                            &gt; 正在扫描访客生物特征...<br/>
                            &gt; 信息就是力量，而我们掌控着最大的服务器。<br/>
                            &gt; <span className="text-red-500">限制:</span> 年满16岁方可被授予访问权限。
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                             <IntelJobBtn 
                               title="情报搜集员" sub="肉体C+ | 负责外勤盗取" 
                               qualified={checkQualifications(ROLES.COLLECTOR)}
                               onClick={() => handleJoinOrPromote(ROLES.COLLECTOR)}
                             />
                             <IntelJobBtn 
                               title="情报处理员" sub="精神C+ | 负责内勤解密" 
                               qualified={checkQualifications(ROLES.PROCESSOR)}
                               onClick={() => handleJoinOrPromote(ROLES.PROCESSOR)}
                             />
                             <div className="col-span-1 md:col-span-2">
                               <IntelJobBtn 
                                 title="篡夺首领权限" sub="神S+ 体S+ | 最高权限" 
                                 qualified={checkQualifications(ROLES.BOSS)}
                                 onClick={() => handleJoinOrPromote(ROLES.BOSS)}
                               />
                             </div>
                          </div>
                        </>
                      ) : (
                        <div className="space-y-4">
                          <div className="text-center p-8 border border-green-800 bg-green-900/10">
                            {/* 修复：UserSecret 不存在，替换为 UserCog */}
                            <UserCog size={48} className="mx-auto text-green-500 mb-4"/>
                            <p className="text-green-800 text-xs font-bold mb-2 tracking-[0.2em]">干员状态：在线</p>
                            <h3 className="text-2xl font-bold text-white mb-2">{user.job}</h3>
                            <p className="text-green-600/70 text-sm mb-8">保持警惕，真理永远在暗处。</p>
                            
                            {user.job !== ROLES.BOSS && (
                              <button onClick={() => handleJoinOrPromote(ROLES.BOSS)} className="w-full py-3 mb-4 bg-green-900/20 text-green-400 font-bold border border-green-700 hover:bg-green-800 hover:text-white transition-colors uppercase tracking-widest">
                                申请最高权限（晋升首领）
                              </button>
                            )}

                            <button 
                              onClick={() => { if(confirm("断开连接将抹除你的内部档案（辞职），确定吗？")) fetch('/api/tower/quit', { method:'POST', body:JSON.stringify({userId:user.id}), headers:{'Content-Type':'application/json'}}).then(() => {showToast("连接已终止"); fetchGlobalData(); setSelectedBuilding(null);}) }}
                              className="text-xs text-red-500 hover:text-red-400 underline decoration-red-900"
                            >
                              断开神经连接 / 离职
                            </button>
                          </div>
                          <FactionMemberPanel
                            user={user}
                            locationId="observers"
                            showToast={showToast}
                            fetchGlobalData={fetchGlobalData}
                            title="观察者职位房间"
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {/* === 情报搜集/处理：打工 === */}
                  {['intel_collect', 'intel_process'].includes(selectedBuilding.id) && (
                    <div className="space-y-6 text-center">
                       <div className="p-8 bg-green-900/5 border border-green-800/50">
                          {selectedBuilding.id === 'intel_collect' ? (
                            <>
                              <Globe size={64} className="mx-auto text-green-600 mb-6 animate-pulse"/>
                              <p className="text-sm text-green-500 mb-6">潜入其他阵营的通讯频段，拦截第一手情报资料。</p>
                            </>
                          ) : (
                            <>
                              <Database size={64} className="mx-auto text-green-600 mb-6"/>
                              <p className="text-sm text-green-500 mb-6">在海量的垃圾数据中抽丝剥茧，提取高价值的机密流水。</p>
                            </>
                          )}
                          
                          {isObserver ? (
                            <button 
                              onClick={() => handleWork(selectedBuilding.id === 'intel_collect' ? 'collect' : 'process')} 
                              disabled={(user.workCount||0)>=3} 
                              className="w-full py-4 bg-green-900/30 text-green-400 font-bold border border-green-600 hover:bg-green-500 hover:text-black disabled:opacity-50 disabled:border-green-900 transition-all uppercase tracking-[0.1em]"
                            >
                              执行任务 ({3 - (user.workCount||0)}/3)
                            </button>
                          ) : (
                            <div className="text-center text-xs text-red-500 font-bold border border-red-900 bg-red-900/10 p-4">
                              [ 访问拒绝 ] 权限不足。非观察者成员无法访问控制台。
                            </div>
                          )}
                       </div>
                    </div>
                  )}

                  {/* === 真理大图书馆：资料、墓碑、写书 === */}
                  {selectedBuilding.id === 'library' && (
                    <div className="space-y-6">
                      {/* 图书馆导航栏 */}
                      <div className="flex border-b border-green-900">
                        <LibTab active={libraryTab==='records'} onClick={() => setLibraryTab('records')} icon={<Users size={16}/>} label="档案" />
                        <LibTab active={libraryTab==='tombstones'} onClick={() => setLibraryTab('tombstones')} icon={<Skull size={16}/>} label="死亡" />
                        <LibTab active={libraryTab==='books'} onClick={() => setLibraryTab('books')} icon={<BookOpen size={16}/>} label="文献" />
                        <LibTab active={libraryTab==='auctions'} onClick={() => setLibraryTab('auctions')} icon={<Gavel size={16}/>} label="拍卖归档" />
                        <LibTab active={libraryTab==='replays'} onClick={() => setLibraryTab('replays')} icon={<MessageCircle size={16}/>} label="群戏回顾" />
                      </div>

                      {/* 人员档案 */}
                      {libraryTab === 'records' && (
                        <div className="space-y-2 max-h-80 overflow-y-auto pr-2 custom-scrollbar">
                          {/* 修复：将 > 替换为 &gt; */}
                          <p className="text-xs text-green-700 mb-4 font-mono">&gt; 正在查询全域角色数据库...</p>
                          {allUsers.filter(u => u.status !== 'dead').length === 0 && <p className="text-green-800 text-sm">暂无存活人员记录。</p>}
                          {allUsers.filter(u => u.status !== 'dead').map(u => (
                            <div key={u.id} className="p-3 border border-green-900/30 bg-green-900/5 flex justify-between items-center hover:border-green-600 hover:bg-green-900/10 transition-colors">
                              <div>
                                <span className="font-bold text-green-400 mr-2">{u.name}</span>
                                <span className="text-[10px] text-green-600 bg-green-900/30 px-2 py-0.5 rounded border border-green-900">{u.faction || '未定'}</span>
                              </div>
                              <div className="text-xs text-green-500/70 font-mono">
                                [ {u.job !== '无' ? `职务：${u.job}` : '无业'} ]
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* 死亡名录 */}
                      {libraryTab === 'tombstones' && (
                        <div className="space-y-3 max-h-80 overflow-y-auto pr-2 custom-scrollbar">
                          {/* 修复：将 > 替换为 &gt; */}
                          <p className="text-xs text-green-700 mb-4 font-mono">&gt; 正在读取死亡档案...</p>
                          {allUsers.filter(u => u.status === 'dead').length === 0 ? (
                            <p className="text-green-600 text-sm text-center py-8 opacity-50">数据正常，目前无人死亡。</p>
                          ) : (
                            allUsers.filter(u => u.status === 'dead').map(u => (
                              <div key={u.id} className="p-4 border border-red-900/40 bg-red-900/5 relative overflow-hidden group">
                                <Skull className="absolute -bottom-2 -right-2 text-red-900/20 w-16 h-16 transform -rotate-12"/>
                                <div className="relative z-10">
                                  <h4 className="font-black text-red-500 text-lg mb-1">{u.name} <span className="text-xs font-normal text-red-800">({u.role})</span></h4>
                                  <p className="text-[10px] text-red-400/60 mb-2 uppercase tracking-widest">死因记录：</p>
                                  <p className="text-sm text-red-300 font-serif italic border-l-2 border-red-900 pl-3">"{u.deathDescription || '数据损坏'}"</p>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      )}

                      {/* 机密文献 */}
                      {libraryTab === 'books' && (
                        <div className="space-y-4">
                          <div className="flex justify-between items-center mb-2">
                            {/* 修复：将 > 替换为 &gt; */}
                            <p className="text-xs text-green-700 font-mono">&gt; 正在访问机密档案...</p>
                            {isObserver && !isWriting && editingBookId === null && (
                              <button onClick={() => setIsWriting(true)} className="flex items-center gap-1 text-xs bg-green-900/30 text-green-400 px-3 py-1.5 border border-green-600 hover:bg-green-700 hover:text-black transition-colors">
                                <Feather size={14}/> 撰写新文献
                              </button>
                            )}
                          </div>

                          <div className="text-[11px] text-green-700">
                            规则：观察者成员可写任意内容（包含胡言乱语），并且只能编辑/删除自己写的文献。
                          </div>

                          {/* 写书表单 */}
                          {isWriting && (
                            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="p-4 border border-green-500 bg-green-900/20 space-y-3 mb-6">
                              <input 
                                type="text" 
                                placeholder="输入标题（可随意）..."
                                value={newBook.title}
                                onChange={e => setNewBook({...newBook, title: e.target.value})}
                                className="w-full p-3 bg-black border border-green-800 text-green-400 focus:border-green-500 outline-none font-mono text-sm"
                              />
                              <textarea 
                                placeholder="输入正文内容（可写任何内容，包括胡言乱语）..."
                                value={newBook.content}
                                onChange={e => setNewBook({...newBook, content: e.target.value})}
                                className="w-full p-3 bg-black border border-green-800 text-green-400 focus:border-green-500 outline-none h-32 custom-scrollbar font-mono text-sm"
                              />
                              <div className="flex gap-2">
                                <button disabled={bookBusy} onClick={handlePublishBook} className="flex-1 py-2 bg-green-700 text-black font-bold hover:bg-green-600 uppercase disabled:opacity-60">上传</button>
                                <button disabled={bookBusy} onClick={() => setIsWriting(false)} className="flex-1 py-2 bg-transparent text-green-600 font-bold border border-green-800 hover:border-green-600 uppercase disabled:opacity-60">取消</button>
                              </div>
                            </motion.div>
                          )}

                          {/* 图书列表 */}
                          <div className="grid grid-cols-1 gap-4 max-h-72 overflow-y-auto pr-2 custom-scrollbar">
                            {books.map((book) => (
                              <div key={book.id} className="p-5 border border-green-900/50 bg-black/50 hover:border-green-500 transition-colors group cursor-default">
                                <div className="flex justify-between items-start mb-3">
                                  <h3 className="font-bold text-green-400 text-lg group-hover:text-white transition-colors">{book.title || '无题文献'}</h3>
                                  <span className="text-[10px] text-green-700 bg-green-900/10 px-2 py-1 border border-green-900/30">作者：{book.authorName || '未知'}</span>
                                </div>
                                <div className="text-[10px] text-green-800 mb-3">
                                  更新于：{book.updatedAt || book.createdAt || '-'}
                                </div>

                                {editingBookId === book.id ? (
                                  <div className="space-y-2">
                                    <input
                                      type="text"
                                      value={editBook.title}
                                      onChange={(e) => setEditBook((prev) => ({ ...prev, title: e.target.value }))}
                                      className="w-full p-2 bg-black border border-green-800 text-green-400 focus:border-green-500 outline-none font-mono text-sm"
                                    />
                                    <textarea
                                      value={editBook.content}
                                      onChange={(e) => setEditBook((prev) => ({ ...prev, content: e.target.value }))}
                                      className="w-full p-2 bg-black border border-green-800 text-green-400 focus:border-green-500 outline-none h-28 custom-scrollbar font-mono text-sm"
                                    />
                                    <div className="flex gap-2">
                                      <button
                                        disabled={bookBusy}
                                        onClick={() => saveEditBook(book.id)}
                                        className="flex-1 py-2 bg-green-700 text-black font-bold hover:bg-green-600 uppercase disabled:opacity-60"
                                      >
                                        保存
                                      </button>
                                      <button
                                        disabled={bookBusy}
                                        onClick={() => setEditingBookId(null)}
                                        className="flex-1 py-2 bg-transparent text-green-600 font-bold border border-green-800 hover:border-green-600 uppercase disabled:opacity-60"
                                      >
                                        取消
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <p className="text-xs text-green-600/80 leading-relaxed font-serif whitespace-pre-wrap">{book.content}</p>
                                )}

                                {isObserver && editingBookId !== book.id && (
                                  <div className="mt-3 flex gap-2">
                                    {book.canEdit && (
                                      <button
                                        onClick={() => startEditBook(book)}
                                        className="px-3 py-1.5 text-[11px] border border-green-700 text-green-400 hover:bg-green-800/40"
                                      >
                                        编辑
                                      </button>
                                    )}
                                    {book.canDelete && (
                                      <button
                                        onClick={() => deleteBook(book)}
                                        className="px-3 py-1.5 text-[11px] border border-red-800 text-red-400 hover:bg-red-900/30"
                                      >
                                        删除
                                      </button>
                                    )}
                                  </div>
                                )}
                              </div>
                            ))}
                            {books.length === 0 && <div className="text-sm text-green-700">图书馆目前暂无文献记录。</div>}
                          </div>
                        </div>
                      )}

                      {libraryTab === 'replays' && (
                        <div className="space-y-3 max-h-80 overflow-y-auto pr-2 custom-scrollbar">
                          <p className="text-xs text-green-700 mb-3 font-mono">&gt; 正在读取群戏与对戏回顾...</p>
                          {replayLogs.length === 0 && <p className="text-green-700 text-sm">暂无可查看的回顾记录。</p>}
                          {replayLogs.map((row) => {
                            const rid = String(row.id || '');
                            const expanded = expandedReplayId === rid;
                            const msgs = replayMessagesByArchive[rid] || [];
                            return (
                              <div key={rid} className="p-4 border border-green-900/40 bg-green-900/5">
                                <div className="flex items-center justify-between gap-2">
                                  <div className="font-bold text-green-300">{row.title || rid}</div>
                                  <div className="text-[10px] text-green-600">{row.kind === 'group' ? '群戏' : '对戏'}</div>
                                </div>
                                <div className="text-xs text-green-500 mt-1">
                                  地点：{row.locationName || '未知地点'} | 参与：{row.participantNames || '未知'} | 消息数：{Number(row.messageCount || 0)}
                                </div>
                                <div className="text-[10px] text-green-700 mt-1">{row.createdAt || ''}</div>
                                {row.latestMessage && (
                                  <div className="text-[11px] text-green-400 mt-2 line-clamp-2">
                                    最近：[{row.latestMessage.senderName || '未知'}] {row.latestMessage.content || ''}
                                  </div>
                                )}

                                <button
                                  onClick={() => toggleReplayMessages(rid)}
                                  className="mt-2 px-3 py-1.5 text-[11px] border border-green-700 text-green-400 hover:bg-green-900/30"
                                >
                                  {expanded ? '收起回顾内容' : '展开回顾内容'}
                                </button>

                                {expanded && (
                                  <div className="mt-3 max-h-52 overflow-y-auto custom-scrollbar border border-green-900/40 bg-black/40 p-3 space-y-2">
                                    {replayLoadingId === rid && (
                                      <div className="text-[11px] text-green-700">正在读取内容...</div>
                                    )}
                                    {replayLoadingId !== rid && msgs.length === 0 && (
                                      <div className="text-[11px] text-green-700">暂无内容</div>
                                    )}
                                    {replayLoadingId !== rid && msgs.map((m) => (
                                      <div key={`${rid}-${m.id}`} className="text-[11px] leading-relaxed text-green-400">
                                        <span className="text-green-600 mr-1">[{m.type === 'system' ? '系统' : (m.senderName || '未知')}]</span>
                                        <span className="text-green-300">{m.content}</span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {libraryTab === 'auctions' && (
                        <div className="space-y-3 max-h-80 overflow-y-auto pr-2 custom-scrollbar">
                          <p className="text-xs text-green-700 mb-3 font-mono">&gt; 正在读取公会拍卖归档...</p>
                          {auctionArchives.length === 0 && <p className="text-green-700 text-sm">暂无归档记录。</p>}
                          {auctionArchives.map((row: any) => (
                            <div key={row.id} className="p-4 border border-green-900/40 bg-green-900/5">
                              <div className="flex items-center justify-between gap-2">
                                <div className="font-bold text-green-300">{row.itemName || '未知道具'}</div>
                                <div className="text-[10px] text-green-600">{row.channel || '未知渠道'}</div>
                              </div>
                              <div className="text-xs text-green-500 mt-1">
                                成交价：{Number(row.finalPrice || 0)}G | 得主：{row.winnerName || '无人'} | 状态：{row.status || '-'}
                              </div>
                              <div className="text-[10px] text-green-700 mt-1">{row.archivedAt || ''}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
      
      {/* 底部 CSS 动画定义 */}
      <style>{`
        @keyframes scan {
          0% { top: 0; opacity: 0; }
          50% { opacity: 1; }
          100% { top: 100%; opacity: 0; }
        }
        @keyframes typing {
          from { width: 0 }
          to { width: 100% }
        }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background-color: #064e3b; border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background-color: #059669; }
      `}</style>
    </div>
  );
}

// 子组件
function IntelJobBtn({ title, sub, qualified, onClick }: any) {
  return (
    <button 
      onClick={onClick} 
      // disabled={!qualified}
      className={`w-full p-4 border flex flex-col items-start transition-all relative overflow-hidden text-left group
        ${qualified ? 'border-green-700 hover:border-green-400 bg-green-900/10 hover:bg-green-900/30 cursor-pointer' : 'border-green-900 bg-black opacity-50'}
      `}
    >
      <span className={`font-bold text-sm group-hover:text-white transition-colors ${qualified ? 'text-green-400' : 'text-green-800'}`}>{title}</span>
      <span className="text-[10px] text-green-600 mt-1">{sub}</span>
      {!qualified && <span className="absolute top-2 right-2 text-[9px] font-bold text-red-600 bg-red-900/20 px-1 border border-red-900">拒绝</span>}
    </button>
  );
}

function LibTab({ active, onClick, icon, label }: any) {
  return (
    <button 
      onClick={onClick}
      className={`flex-1 py-3 flex items-center justify-center gap-2 border-b-2 transition-colors text-sm font-bold uppercase tracking-wider
        ${active ? 'border-green-500 text-green-400 bg-green-900/20' : 'border-transparent text-green-800 hover:text-green-600 hover:bg-green-900/10'}
      `}
    >
      {icon} {label}
    </button>
  );
}

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ArrowLeft, X, Ghost, ShieldCheck, 
  FileText, Search, Siren, Eye, 
  Lock, Zap, Database
} from 'lucide-react';
import { User } from '../types';
import FactionMemberPanel from './shared/FactionMemberPanel';
import PrisonEscapeMiniGame from './PrisonEscapeMiniGame';

interface Props {
  user: User;
  onExit: () => void;
  showToast: (msg: string) => void;
  fetchGlobalData: () => void;
}

interface PrisonState {
  isImprisoned: boolean;
  failedAttempts: number;
  difficultyLevel: number;
  currentGameId: string;
  currentGameName: string;
  jailedAt: string;
  updatedAt: string;
}

// 基于图片设定的建筑坐标
const buildings = [
  { id: 'hq', name: '行政大楼', x: 65, y: 35, icon: <ShieldCheck/>, desc: '灵异所的最高决策中心与入职处。' },
  { id: 'squad', name: '搜捕队营地', x: 25, y: 45, icon: <Siren/>, desc: '出勤准备，学习【感知系】技能。' },
  { id: 'containment', name: '灵异收容监牢', x: 80, y: 55, icon: <Lock/>, desc: '关押高危鬼魂的符文禁闭室。' },
  { id: 'archive', name: '死灵档案室', x: 60, y: 75, icon: <FileText/>, desc: '记录每一只鬼魂的生平与动向。' },
];

// 职位常量
const ROLES = {
  DIRECTOR: '灵异所所长',
  CAPTAIN: '搜捕队队长',
  MEMBER: '搜捕队队员',
  CLERK: '灵异所文员'
};

const RANK_SCORES: Record<string, number> = {
  '无': 0, 'F': 1, 'E': 2, 'D': 3, 'C': 4, 'C+': 5, 'B': 6, 'B+': 7, 
  'A': 8, 'A+': 9, 'S': 10, 'S+': 11, 'SS': 12, 'SS+': 13, 'SSS': 14
};

export function SpiritBureauView({ user, onExit, showToast, fetchGlobalData }: Props) {
  const [selectedBuilding, setSelectedBuilding] = useState<any>(null);
  const [isWorking, setIsWorking] = useState(false);
  const [senseSkills, setSenseSkills] = useState<any[]>([]);
  const [prisonState, setPrisonState] = useState<PrisonState | null>(null);
  const [showEscapeMiniGame, setShowEscapeMiniGame] = useState(false);
  const [isResolvingEscape, setIsResolvingEscape] = useState(false);

  // 身份判断
  const isBureauStaff = Object.values(ROLES).includes(user.job || '');
  const isGhost = String(user.status || '') === 'ghost';
  const isPrisonLocked = isGhost && Boolean(prisonState?.isImprisoned);
  const getScore = (rank?: string) => RANK_SCORES[rank || '无'] || 0;

  const guardPrisonLock = () => {
    if (!isPrisonLocked) return false;
    showToast('你已被收容，当前仅可等待探监或发起越狱。');
    return true;
  };

  useEffect(() => {
    if (!isGhost) {
      setPrisonState(null);
      return;
    }

    let alive = true;
    const pullPrisonState = async () => {
      try {
        const res = await fetch(`/api/paranormal/prison/state?userId=${user.id}`, { cache: 'no-store' });
        const data = await res.json().catch(() => ({} as any));
        if (!alive || !res.ok || data.success === false) return;
        setPrisonState(data.prison || null);
      } catch {
        // ignore
      }
    };

    pullPrisonState();
    const timer = setInterval(pullPrisonState, 2500);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [isGhost, user.id]);

  useEffect(() => {
    if (!isPrisonLocked) return;
    const containment = buildings.find((x) => x.id === 'containment') || null;
    setSelectedBuilding(containment);
  }, [isPrisonLocked]);

  useEffect(() => {
    if (selectedBuilding?.id === 'squad') fetchSkills();
  }, [selectedBuilding]);

  // --- 核心逻辑：入职与资质校验 ---
  const checkQualifications = (targetRank: string) => {
    if ((user.age || 0) < 16) return false; // 年龄必须大于等于16岁
    
    const pScore = getScore(user.physicalRank);
    const mScore = getScore(user.mentalRank);
    
    // 文员：精神C+，肉体不限
    if (targetRank === ROLES.CLERK) return mScore >= RANK_SCORES['C+'];
    
    // 队员：精神B+，肉体C+
    if (targetRank === ROLES.MEMBER) return mScore >= RANK_SCORES['B+'] && pScore >= RANK_SCORES['C+'];
    
    // 队长：精神A+，肉体A+
    if (targetRank === ROLES.CAPTAIN) return mScore >= RANK_SCORES['A+'] && pScore >= RANK_SCORES['A+'];
    
    // 所长：精神S+，肉体S+
    if (targetRank === ROLES.DIRECTOR) return mScore >= RANK_SCORES['S+'] && pScore >= RANK_SCORES['S+'];
    
    return false;
  };

  const handleJoin = async (jobName: string) => {
    if (guardPrisonLock()) return;
    if (user.job && user.job !== '无') return showToast(`请先辞去你当前的职务：${user.job}`);

    if (!checkQualifications(jobName)) {
      return showToast(`资质不符！${jobName} 需要特定的等级，且必须年满16岁。`);
    }

    const res = await fetch('/api/tower/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id, jobName })
    });
    
    const data = await res.json();
    if (data.success) {
      showToast(`系统录入成功。欢迎加入灵异管理所，${jobName}。`);
      fetchGlobalData();
    } else {
      showToast(data.message || '操作失败');
    }
  };

  // --- 核心逻辑：打工 (巡视监牢 / 抓鬼) ---
  const handleWork = async (actionDesc: string) => {
    if (guardPrisonLock()) return;
    if (!isBureauStaff) return showToast("非本所干员无权执行此操作。");
    if ((user.workCount || 0) >= 3) return showToast("今日外勤与巡视次数已达上限，请休息。");

    const res = await fetch('/api/tower/work', { 
      method: 'POST', 
      headers: { 'Content-Type': 'application/json' }, 
      body: JSON.stringify({ userId: user.id })
    });
    const data = await res.json();

    if (data.success) {
      setIsWorking(true);
      setTimeout(() => setIsWorking(false), 2000);
      showToast(`${actionDesc} (+${data.reward}G)`);
      fetchGlobalData();
    }
  };

  // --- 核心逻辑：感知系技能学习 ---
  const fetchSkills = async () => {
    if (guardPrisonLock()) return;
    const res = await fetch(`/api/skills/available/${user.id}`);
    const data = await res.json();
    if (data.success) setSenseSkills(data.skills.filter((s:any) => s.faction === '感知系'));
  };

  const learnSkill = async (skillName: string) => {
    if (guardPrisonLock()) return;
    const res = await fetch(`/api/users/${user.id}/skills`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: skillName })
    });
    if (res.ok) showToast(`通过特殊的眼部神经刺激，你学会了：${skillName}`);
  };

  const handleResolveEscape = async (success: boolean) => {
    if (!isGhost || !prisonState?.isImprisoned) return;
    setIsResolvingEscape(true);
    try {
      const res = await fetch('/api/paranormal/prison/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, success })
      });
      const data = await res.json().catch(() => ({} as any));
      if (!res.ok || data.success === false) {
        showToast(data.message || '越狱结算失败');
        return;
      }
      if (data.prison) setPrisonState(data.prison);
      showToast(data.message || (success ? '越狱成功' : '越狱失败'));
      setShowEscapeMiniGame(false);
      if (data.escaped) {
        fetchGlobalData();
      }
    } catch {
      showToast('越狱结算失败');
    } finally {
      setIsResolvingEscape(false);
    }
  };

  return (
    <div className="absolute inset-0 bg-slate-900 overflow-hidden font-sans select-none text-slate-300">
      {/* 背景层 */}
      <div 
        className="absolute inset-0 bg-cover bg-center opacity-60"
        style={{ backgroundImage: "url('/灵异管理所.jpg')" }}
      >
        <div className="absolute inset-0 bg-cyan-900/10 mix-blend-color-burn pointer-events-none"></div>
      </div>

      {/* 顶部导航 */}
      <div className="absolute top-8 left-8 z-50">
        <button 
          onClick={() => {
            if (isPrisonLocked) {
              showToast('收容状态下无法撤离灵异管理所。');
              return;
            }
            onExit();
          }} 
          className={`bg-slate-900/90 border px-6 py-2 rounded font-bold shadow-[0_0_15px_rgba(6,182,212,0.3)] flex items-center gap-2 transition-all ${
            isPrisonLocked
              ? 'text-slate-500 border-slate-700 cursor-not-allowed'
              : 'text-cyan-400 border-cyan-800 hover:bg-cyan-900/30'
          }`}
        >
          <ArrowLeft size={18}/> 撤离管制区
        </button>
      </div>

      {/* 建筑交互点 */}
      {buildings.map(b => (
        <div 
          key={b.id} 
          className={`absolute transform -translate-x-1/2 -translate-y-1/2 z-10 group ${
            isPrisonLocked ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
          }`}
          style={{ left: `${b.x}%`, top: `${b.y}%` }}
          onClick={() => {
            if (isPrisonLocked) {
              const containment = buildings.find((x) => x.id === 'containment') || null;
              setSelectedBuilding(containment);
              return;
            }
            setSelectedBuilding(b);
          }}
        >
          <div className="flex flex-col items-center">
            <div className="w-16 h-16 bg-slate-800/90 border-2 border-cyan-700 shadow-[0_0_20px_rgba(6,182,212,0.2)] flex items-center justify-center text-cyan-400 group-hover:scale-110 group-hover:bg-cyan-900 group-hover:text-cyan-300 group-hover:border-cyan-400 transition-all rounded-xl z-10 relative">
              {b.icon}
            </div>
            <div className="mt-2 bg-slate-900/90 text-cyan-400 text-[10px] font-bold px-3 py-1 border border-cyan-800 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
              {b.name}
            </div>
          </div>
        </div>
      ))}

      {/* 工作特效 */}
      <AnimatePresence>
        {isWorking && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex items-center justify-center bg-cyan-950/60 backdrop-blur-sm"
          >
            <div className="text-center">
               <Search size={80} className="mx-auto text-cyan-400 animate-pulse mb-4"/>
               <p className="text-cyan-300 text-2xl font-black tracking-widest animate-bounce">
                 执行灵异收容程序...
               </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 建筑详情弹窗 */}
      <AnimatePresence>
        {selectedBuilding && (
          <motion.div 
            initial={{ opacity: 0, x: 100 }} 
            animate={{ opacity: 1, x: 0 }} 
            exit={{ opacity: 0, x: 100 }}
            className="fixed inset-y-0 right-0 z-[100] w-full max-w-md bg-slate-900 shadow-2xl border-l border-cyan-800 flex flex-col"
          >
            <div className="p-8 bg-slate-800 border-b border-cyan-900 flex justify-between items-start">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-cyan-950 rounded-xl text-cyan-400 border border-cyan-800">
                  {React.cloneElement(selectedBuilding.icon, { size: 28 })}
                </div>
                <div>
                  <h2 className="text-2xl font-black text-cyan-50">{selectedBuilding.name}</h2>
                  <p className="text-xs text-cyan-600 font-bold mt-1">{selectedBuilding.desc}</p>
                </div>
              </div>
              <button onClick={() => setSelectedBuilding(null)} className="text-slate-500 hover:text-cyan-400 transition-colors">
                <X size={24}/>
              </button>
            </div>

            <div className="flex-1 p-8 overflow-y-auto bg-slate-900 space-y-8">

              {/* === 行政大楼：入职 === */}
              {selectedBuilding.id === 'hq' && (
                <div className="space-y-4">
                  {!isBureauStaff ? (
                    <>
                      <div className="p-4 bg-cyan-950/30 border border-cyan-900 text-xs text-cyan-500 mb-6 leading-relaxed rounded-xl">
                        【灵异所人事档案库】<br/>
                        警告：接触灵异实体存在极高风险。所有应聘者必须年满16岁，并具备对应的抗压能力。
                      </div>
                      
                      <div className="space-y-3">
                         <JobBtn 
                           title="文员" sub="精神C+ | 负责档案录入" 
                           qualified={checkQualifications(ROLES.CLERK)}
                           onClick={() => handleJoin(ROLES.CLERK)}
                         />
                         <JobBtn 
                           title="搜捕队队员" sub="精神B+ 肉体C+ | 一线干员" 
                           qualified={checkQualifications(ROLES.MEMBER)}
                           onClick={() => handleJoin(ROLES.MEMBER)}
                         />
                         <JobBtn 
                           title="搜捕队队长" sub="精神A+ 肉体A+ | 带队指挥" 
                           qualified={checkQualifications(ROLES.CAPTAIN)}
                           onClick={() => handleJoin(ROLES.CAPTAIN)}
                         />
                         <JobBtn 
                           title="灵异所所长" sub="神S+ 体S+ | 统御全局" 
                           qualified={checkQualifications(ROLES.DIRECTOR)}
                           onClick={() => handleJoin(ROLES.DIRECTOR)}
                         />
                      </div>
                    </>
                  ) : (
                    <div className="space-y-4">
                      <div className="text-center p-6 bg-slate-800 border border-cyan-900 rounded-xl">
                        <ShieldCheck size={40} className="mx-auto text-cyan-500 mb-2"/>
                        <p className="text-xs text-cyan-700 font-bold tracking-widest mb-1">干员识别码有效</p>
                        <h3 className="text-2xl font-black text-cyan-300 mb-6">{user.job}</h3>
                        <button 
                          onClick={() => { if(confirm("确定要提交离职报告吗？")) fetch('/api/tower/quit', { method:'POST', body:JSON.stringify({userId:user.id}), headers:{'Content-Type':'application/json'}}).then(() => {showToast("已注销干员身份。"); fetchGlobalData(); setSelectedBuilding(null);}) }}
                          className="text-xs text-rose-500 hover:text-rose-400 underline"
                        >
                          移交配枪并离职
                        </button>
                      </div>
                      <FactionMemberPanel
                        user={user}
                        locationId="paranormal_office"
                        showToast={showToast}
                        fetchGlobalData={fetchGlobalData}
                        title="灵异职位房间"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* === 搜捕队营地：感知系技能与出勤 === */}
              {selectedBuilding.id === 'squad' && (
                <div className="space-y-8">
                  <div className="text-center bg-slate-800 p-6 rounded-xl border border-slate-700">
                    <Siren size={40} className="mx-auto text-rose-500 mb-4"/>
                    <h3 className="text-lg font-bold text-white mb-2">武装出勤</h3>
                    <p className="text-xs text-slate-400 mb-4">带好引魂灯，准备前往城市各处抓捕游荡的恶灵。</p>
                    <button 
                      onClick={() => handleWork('成功收容了一只游荡的C级鬼魂。')}
                      className="w-full py-4 bg-rose-900/50 text-rose-400 font-black border border-rose-800 hover:bg-rose-800 hover:text-white transition-colors rounded-lg"
                    >
                      外派抓鬼任务 (打工)
                    </button>
                  </div>

                  <div className="pt-6 border-t border-slate-700">
                    <h4 className="text-sm font-black text-cyan-400 mb-4 flex items-center gap-2">
                      <Eye size={18}/> 视觉/感知特化训练
                    </h4>
                    <p className="text-xs text-slate-500 mb-4">想要看到别人看不到的东西，你需要极强的感知力。在此学习【感知系】技能。</p>
                    
                    {senseSkills.length === 0 ? (
                      <div className="text-center py-4 bg-slate-800 text-slate-500 font-bold text-xs rounded-xl">营地暂无多余的感知系教范。</div>
                    ) : (
                      <div className="space-y-2">
                        {senseSkills.map(skill => (
                          <div key={skill.id} className="flex justify-between items-center p-4 bg-slate-800 rounded-xl hover:bg-slate-700 transition-colors">
                            <div>
                              <p className="font-bold text-cyan-100 text-sm">{skill.name}</p>
                              <p className="text-[10px] text-cyan-600/60 mt-1">{skill.description}</p>
                            </div>
                            <button onClick={() => learnSkill(skill.name)} className="bg-cyan-900/30 text-cyan-400 border border-cyan-800 px-4 py-1.5 text-xs font-bold hover:bg-cyan-700 hover:text-white transition-colors rounded">
                              特训
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* === 灵异收容监牢：巡视 === */}
              {selectedBuilding.id === 'containment' && (
                <div className="text-center space-y-4">
                  <div className="bg-cyan-950 p-6 rounded-xl border border-cyan-900 relative overflow-hidden">
                    <Ghost size={120} className="absolute -right-4 -bottom-4 text-cyan-900/30"/>
                    <Lock size={40} className="mx-auto text-cyan-500 mb-4 relative z-10"/>
                    <h3 className="text-lg font-bold text-cyan-300 relative z-10">收容禁闭区</h3>
                    <p className="text-xs text-cyan-600/80 mt-2 mb-6 relative z-10">
                      走廊里回荡着听不懂的窃窃私语。墙壁上的符文需要定期注入精神力以维持运作。
                    </p>
                    <button 
                      onClick={() => handleWork('巡视了监牢，并加固了三层法阵封印。')}
                      className="relative z-10 w-full py-4 bg-cyan-900 text-cyan-100 font-black hover:bg-cyan-800 transition-colors rounded-lg shadow-lg"
                    >
                      巡视符文阵列 (打工)
                    </button>
                  </div>
                  
                  {user.status === 'ghost' && (
                    <div className="p-3 bg-rose-950/40 border border-rose-900 text-rose-500 text-xs font-bold rounded">
                      ⚠️ 警告：检测到灵异体质。这里让你感到极度不适。
                    </div>
                  )}

                  {isPrisonLocked && (
                    <div className="p-4 bg-slate-900/80 border border-rose-900 rounded-xl text-left space-y-3">
                      <p className="text-xs text-rose-300 font-bold">
                        你已被灵异管理所收容，无法移动与执行其他互动操作。
                      </p>
                      <div className="text-[11px] text-slate-300 leading-6">
                        <div>当前越狱题：{prisonState?.currentGameName || prisonState?.currentGameId || '未分配'}</div>
                        <div>失败次数：{prisonState?.failedAttempts || 0}</div>
                        <div>当前难度：等级 {Math.max(1, Number(prisonState?.difficultyLevel || 1))}</div>
                      </div>
                      <button
                        onClick={() => {
                          if (!prisonState?.currentGameId) {
                            showToast('当前越狱题尚未就绪，请稍后重试。');
                            return;
                          }
                          setShowEscapeMiniGame(true);
                        }}
                        disabled={isResolvingEscape}
                        className="w-full py-3 bg-rose-700 text-white font-black rounded-lg hover:bg-rose-600 transition-colors disabled:opacity-60"
                      >
                        越狱挑战
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* === 死灵档案室 === */}
              {selectedBuilding.id === 'archive' && (
                <div className="text-center">
                  <Database size={48} className="mx-auto text-slate-500 mb-4"/>
                  <h3 className="text-lg font-bold text-slate-300 mb-2">死灵档案调阅中心</h3>
                  <p className="text-sm text-slate-500 mb-6">
                    这里堆满了卷宗。如果你想查阅某个亡魂的过往，请移步“大地图 - 观察者”的真理大图书馆进行全局检索。
                  </p>
                  <div className="p-4 bg-slate-800 text-xs text-slate-400 rounded-xl border border-slate-700 italic">
                    "我们只负责抓捕和收容。记录历史？那是观察者那帮书呆子的活儿。"
                  </div>
                </div>
              )}

            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {isPrisonLocked && (
        <div className="absolute inset-0 z-[130] pointer-events-none">
          <div className="absolute inset-0 bg-black/35" />
          <div
            className="absolute inset-0"
            style={{
              backgroundImage:
                'repeating-linear-gradient(90deg, rgba(20,20,20,0.88) 0px, rgba(20,20,20,0.88) 10px, rgba(0,0,0,0) 10px, rgba(0,0,0,0) 72px)',
              boxShadow: 'inset 0 0 120px rgba(0,0,0,0.8)'
            }}
          />
        </div>
      )}

      <AnimatePresence>
        {showEscapeMiniGame && isPrisonLocked && prisonState?.currentGameId && (
          <PrisonEscapeMiniGame
            gameId={prisonState.currentGameId}
            gameName={prisonState.currentGameName}
            difficulty={Math.max(1, Number(prisonState.difficultyLevel || 1))}
            onResolve={handleResolveEscape}
            onClose={() => setShowEscapeMiniGame(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// 子组件
function JobBtn({ title, sub, qualified, onClick }: any) {
  return (
    <button 
      onClick={onClick} 
      disabled={!qualified}
      className={`w-full p-4 flex flex-col items-start transition-all relative overflow-hidden text-left rounded-xl border
        ${qualified ? 'bg-slate-800 border-cyan-800 hover:border-cyan-400 hover:bg-slate-700' : 'bg-slate-900 border-slate-800 opacity-50 cursor-not-allowed'}
      `}
    >
      <span className={`font-black text-sm ${qualified ? 'text-cyan-300' : 'text-slate-500'}`}>{title}</span>
      <span className="text-[10px] text-cyan-700 mt-1">{sub}</span>
      {!qualified && <span className="absolute top-4 right-4 text-[9px] font-bold text-rose-500 bg-rose-950/50 px-2 py-1 border border-rose-900 rounded">条件不符</span>}
    </button>
  );
}

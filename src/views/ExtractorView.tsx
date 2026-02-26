import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ViewState } from '../App';

interface Props {
  onNavigate: (view: ViewState) => void;
  userName: string;
}

const MAX_DRAWS = 10;

const ROLE_WEIGHTS = [
  { name: "哨兵", w: 40 },
  { name: "向导", w: 40 },
  { name: "普通人", w: 10 },
  { name: "鬼魂", w: 10 }
];
const RANK_WEIGHTS = [
  { name: "D",   w: 24.5 },
  { name: "C",   w: 24.5 },
  { name: "B",   w: 24.5 },
  { name: "A",   w: 24.5 },
  { name: "S",   w: 1.2  },
  { name: "SS",  w: 0.6  },
  { name: "SSS", w: 0.2  },
];
const ABILITIES = ["物理系", "元素系", "精神系", "感知系", "信息系", "治疗系", "强化系", "炼金系"];
const PLANT_RATE = 0.12;
const PLANT_SPIRITS = ["玫瑰","茉莉","栀子花","薰衣草","向日葵","雏菊","郁金香","樱花","荷花","桂花","牵牛花","紫藤","常春藤","葡萄藤","凌霄花","薄荷","迷迭香","鼠尾草","铃兰","山茶花","百合","鸢尾","绣球花","丁香","夜来香","蔷薇","木槿","芍药","牡丹","金银花"];
const ANIMAL_SPIRITS = ["狼","灰狼","北极狼","赤狐","北极狐","豺","鬣狗","虎","东北虎","豹","雪豹","美洲豹","猎豹","猞猁","兔狲","棕熊","黑熊","北极熊","浣熊","獾","水獭","貂","黄鼬","野猪","梅花鹿","麋鹿","驯鹿","羚羊","羊驼","牦牛","野牛","大象","非洲象","河马","犀牛","黑猩猩","大猩猩","猕猴","狒狒","狐猴","白头海雕","金雕","游隼","苍鹰","猫头鹰","雪鸮","乌鸦","渡鸦","喜鹊","天鹅","白鹭","丹顶鹤","火烈鸟","孔雀","蜂鸟","啄木鸟","信天翁","企鹅","海豚","瓶鼻海豚","虎鲸","座头鲸","蓝鲸","抹香鲸","海狮","海豹","海象","大白鲨","锤头鲨","蝠鲼","鳐鱼","旗鱼","金枪鱼","小丑鱼","海马","科莫多巨蜥","变色龙","绿鬣蜥","眼镜蛇","蟒蛇","响尾蛇","海龟","陆龟","鳄鱼","短吻鳄","树蛙","箭毒蛙","蝾螈","火蜥蜴","章鱼","乌贼","鱿鱼","水母","海星","海胆","螳螂","竹节虫","独角仙","锹形虫","蜜蜂","黄蜂","帝王蝶","凤蝶","蜻蜓","狼蛛","蝎子","螃蟹","龙虾"];

function weightedPick(items: { name: string, w: number }[]) {
  const total = items.reduce((s, x) => s + x.w, 0);
  let r = Math.random() * total;
  for (const it of items) { r -= it.w; if (r <= 0) return it.name; }
  return items[items.length - 1].name;
}
const pickFrom = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];

function generateData() {
  const role = weightedPick(ROLE_WEIGHTS);
  
  let mentalRank = "—";
  let physicalRank = "—";
  let spirit = { name: "无", type: "无" };
  
  if (role === "哨兵" || role === "向导") {
    mentalRank = weightedPick(RANK_WEIGHTS);
    physicalRank = weightedPick(RANK_WEIGHTS);
    
    const isPlant = Math.random() < PLANT_RATE;
    spirit = isPlant 
      ? { name: pickFrom(PLANT_SPIRITS), type: "植物" } 
      : { name: pickFrom(ANIMAL_SPIRITS), type: "动物" };
  } else if (role === "普通人") {
    mentalRank = "无"; 
    physicalRank = weightedPick(RANK_WEIGHTS);
  } else if (role === "鬼魂") {
    mentalRank = weightedPick(RANK_WEIGHTS);
    physicalRank = "无"; 
  }

  let gold = Math.random() < 0.10 
    ? Math.floor(Math.random() * (10000 - 8000 + 1)) + 8000 
    : Math.floor(Math.random() * (7999 - 100 + 1)) + 100;

  return {
    role,
    mentalRank,
    physicalRank,
    gold,
    ability: pickFrom(ABILITIES),
    spirit
  };
}

export function ExtractorView({ onNavigate, userName }: Props) {
  const [drawCount, setDrawCount] = useState(0);
  const [historyData, setHistoryData] = useState<any[]>([]);
  const [currentData, setCurrentData] = useState<any>(null);
  const [isLocked, setIsLocked] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showSpiritModal, setShowSpiritModal] = useState(false);
  const [finalData, setFinalData] = useState<any>(null);
  const [customSpirit, setCustomSpirit] = useState('');
  const [spiritView, setSpiritView] = useState<'question' | 'input'>('question');
  const [loading, setLoading] = useState(false);

  const drawOnce = () => {
    if (isLocked) return;
    if (drawCount >= MAX_DRAWS) {
      setShowHistoryModal(true);
      return;
    }

    const data = generateData();
    setHistoryData([...historyData, data]);
    setCurrentData(data);
    setDrawCount(c => c + 1);

    if (drawCount + 1 === MAX_DRAWS) {
      setTimeout(() => setShowHistoryModal(true), 400);
    }
  };

  const selectFinal = (index: number) => {
    const data = JSON.parse(JSON.stringify(historyData[index]));
    setFinalData(data);
    setShowHistoryModal(false);

    if (data.role === "普通人" || data.role === "鬼魂") {
      executeFinalLock(data);
    } else {
      setSpiritView('question');
      setCustomSpirit('');
      setShowSpiritModal(true);
    }
  };

  const handleLikeSpirit = () => {
    setShowSpiritModal(false);
    executeFinalLock(finalData);
  };

  const handleDislikeSpirit = () => {
    setSpiritView('input');
  };

  const handleConfirmCustomSpirit = () => {
    if (!customSpirit.trim()) {
      alert("精神体名称不能为空哦！");
      return;
    }
    const newData = { ...finalData, spirit: { name: customSpirit.trim(), type: "自定义" } };
    setFinalData(newData);
    setShowSpiritModal(false);
    executeFinalLock(newData);
  };

  const executeFinalLock = async (data: any) => {
    setIsLocked(true);
    setCurrentData(data);
    setLoading(true);

    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: userName,
          role: data.role,
          mentalRank: data.mentalRank,
          physicalRank: data.physicalRank,
          gold: data.gold,
          ability: data.ability,
          spiritName: data.spirit.name,
          spiritType: data.spirit.type
        })
      });
      const result = await res.json();
      if (result.success) {
        setTimeout(() => {
          onNavigate('PENDING');
        }, 2000);
      } else {
        alert(result.message || '保存失败');
        setIsLocked(false);
      }
    } catch (err) {
      alert('网络错误');
      setIsLocked(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6 font-sans">
      <div className="w-full max-w-4xl grid gap-4 relative">
        <div className="p-6 bg-white/80 backdrop-blur-md border border-gray-200 rounded-2xl shadow-sm">
          <h1 className="text-2xl font-black mb-2 tracking-wide text-gray-900">哨兵 / 向导 世界观抽取器</h1>
          <p className="text-gray-500 text-sm leading-relaxed">
            点击抽取：生成 <b>身份</b>、<b>等级(精神/肉体)</b>、<b>初始金币</b>、<b>能力偏好</b> 与 <b>精神体</b>。<br/>
            <i>* 满 10 次后需从记录中选择 1 个，若为哨/向可决定是否保留精神体，确认后永久锁定。<br/>
            * 设定：普通人无精神等级，鬼魂无肉体强度，且两者均无精神体。</i>
          </p>
        </div>

        <div className={`relative bg-white border ${isLocked ? 'border-red-600 shadow-[0_0_0_1px_#dc2626,0_10px_30px_rgba(220,38,38,0.1)]' : 'border-gray-200 shadow-sm'} rounded-2xl p-6 overflow-hidden transition-all duration-300`}>
          {isLocked && (
            <motion.div
              initial={{ scale: 3, rotate: 25, opacity: 0 }}
              animate={{ scale: 1, rotate: 15, opacity: 0.85 }}
              transition={{ type: "spring", stiffness: 200, damping: 20 }}
              className="absolute top-8 right-8 text-red-600 border-4 border-red-600 px-4 py-1 text-2xl font-black rounded-lg tracking-widest z-10 pointer-events-none"
            >
              FINAL LOCKED
            </motion.div>
          )}

          <div className="flex flex-wrap gap-3 items-center justify-between mb-6">
            <div className="inline-flex items-center gap-2 px-3 py-2 border border-gray-200 bg-gray-50 rounded-full text-gray-500 text-xs">
              <span className={`w-2 h-2 rounded-full ${isLocked ? 'bg-red-600 shadow-[0_0_0_4px_rgba(220,38,38,0.15)]' : 'bg-gray-800 shadow-[0_0_0_4px_rgba(17,24,39,0.08)]'}`}></span>
              <span>{isLocked ? '数据已永久锁定' : `就绪 (${drawCount}/${MAX_DRAWS})`}</span>
            </div>
            <div className="flex gap-3">
              {!isLocked && (
                <button
                  onClick={drawOnce}
                  className="px-4 py-2 bg-gray-900 text-white rounded-xl font-black text-sm shadow-md hover:bg-gray-800 transition-colors"
                >
                  {drawCount >= MAX_DRAWS ? '打开抉择面板' : `抽取 (剩余${MAX_DRAWS - drawCount}次)`}
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            <Box label="1) 身份" value={currentData?.role || '—'} hint="哨/向各40%，人/鬼各10%" isSpecial={currentData?.role === '普通人' || currentData?.role === '鬼魂'} />
            <Box label="2) 精神等级" value={currentData?.mentalRank || '—'} hint="D-SSS；S+合计2%" isRank={currentData?.mentalRank !== '无'} />
            <Box label="3) 肉体强度" value={currentData?.physicalRank || '—'} hint="D-SSS；S+合计2%" isRank={currentData?.physicalRank !== '无'} />
            <Box label="4) 初始金币" value={currentData?.gold || '—'} hint="100-10000 (≥8k占10%)" isGold />
            <Box label="5) 能力偏好" value={currentData?.ability || '—'} hint="八大派系随机" isAbility />
            <Box label="6) 精神体" value={currentData?.spirit?.name || '—'} hint={currentData?.spirit?.type === '无' ? '普通人/鬼魂无精神体' : `类型：${currentData?.spirit?.type || '—'}`} className="md:col-span-2" />
            <Box label="抽取进度" value={isLocked ? '最终锁定' : `${drawCount} / ${MAX_DRAWS}`} hint="满10次后进入最终抉择" />
          </div>
        </div>
      </div>

      {/* History Modal */}
      <AnimatePresence>
        {showHistoryModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="bg-white rounded-2xl p-6 w-full max-w-5xl max-h-[90vh] overflow-y-auto shadow-2xl"
            >
              <div className="text-center mb-6">
                <h2 className="text-xl font-black mb-2">命运抉择 (10选1)</h2>
                <p className="text-gray-500 text-sm">你已完成 10 次抽取，请从下方记录中选择一个作为你的基础属性。</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {historyData.map((data, idx) => (
                  <div key={idx} className="border border-gray-200 rounded-xl p-4 flex flex-col gap-2 bg-gray-50 hover:bg-white hover:border-blue-500 hover:shadow-lg transition-all hover:-translate-y-1">
                    <div className="font-black text-sm border-b border-dashed border-gray-200 pb-2">第 {idx + 1} 次抽取</div>
                    <div className="flex justify-between text-sm"><span className="text-gray-500">身份</span><span className="font-bold">{data.role}</span></div>
                    <div className="flex justify-between text-sm"><span className="text-gray-500">精神/肉体</span><span className="font-bold text-emerald-700">{data.mentalRank} / {data.physicalRank}</span></div>
                    <div className="flex justify-between text-sm"><span className="text-gray-500">金币</span><span className="font-bold text-amber-600">{data.gold}</span></div>
                    <div className="flex justify-between text-sm"><span className="text-gray-500">能力</span><span className="font-bold text-sky-700">{data.ability}</span></div>
                    <div className="flex justify-between text-sm"><span className="text-gray-500">精神体</span><span className="font-bold">{data.spirit.name}</span></div>
                    <button onClick={() => selectFinal(idx)} className="mt-2 w-full py-2 bg-gray-200 text-gray-800 rounded-lg font-bold hover:bg-gray-900 hover:text-white transition-colors text-sm">选择此项</button>
                  </div>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Spirit Modal */}
      <AnimatePresence>
        {showSpiritModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl text-center"
            >
              {spiritView === 'question' ? (
                <div>
                  <h2 className="text-xl font-black mb-4">精神体确认</h2>
                  <p className="text-base mb-6 text-gray-700">
                    您是否喜欢您现在的精神体：<br/>
                    <strong className="text-sky-700 text-2xl inline-block mt-2">{finalData?.spirit?.name}</strong> ？
                  </p>
                  <div className="flex gap-4 justify-center">
                    <button onClick={handleLikeSpirit} className="flex-1 py-3 bg-emerald-700 text-white rounded-xl font-bold hover:bg-emerald-800">是，我很喜欢</button>
                    <button onClick={handleDislikeSpirit} className="flex-1 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700">否，我不喜欢</button>
                  </div>
                </div>
              ) : (
                <div>
                  <h2 className="text-xl font-black text-red-600 mb-3">您的精神体离开了 😭</h2>
                  <p className="text-gray-500 text-sm mb-5">请重新呼唤一个属于您的精神体：</p>
                  <input
                    type="text"
                    value={customSpirit}
                    onChange={e => setCustomSpirit(e.target.value)}
                    placeholder="输入新的精神体名称..."
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-center focus:border-sky-700 focus:ring-2 focus:ring-sky-100 outline-none mb-5"
                    autoFocus
                  />
                  <button onClick={handleConfirmCustomSpirit} className="w-full py-3 bg-gray-900 text-white rounded-xl font-bold hover:bg-gray-800">确认呼唤</button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Loading Overlay */}
      {loading && (
        <div className="fixed inset-0 bg-white/80 backdrop-blur-sm z-[100] flex items-center justify-center">
          <div className="text-center">
            <div className="w-8 h-8 border-4 border-gray-900 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-900 font-medium">正在生成身份档案...</p>
          </div>
        </div>
      )}
    </div>
  );
}

function Box({ label, value, hint, className = '', isRank, isGold, isAbility, isSpecial }: any) {
  let valColor = 'text-gray-900';
  if (value === '—' || value === '无') valColor = 'text-gray-400 font-normal';
  else if (isRank) valColor = 'text-emerald-700';
  else if (isGold) valColor = 'text-amber-600';
  else if (isAbility) valColor = 'text-sky-700';
  else if (isSpecial) valColor = 'text-purple-700';

  return (
    <div className={`border border-gray-200 rounded-xl p-4 bg-gray-50/50 flex flex-col min-h-[92px] ${className}`}>
      <div className="text-xs text-gray-500 mb-2">{label}</div>
      <div className={`text-lg font-black tracking-wide leading-tight break-words ${valColor}`}>{value}</div>
      <div className="mt-auto pt-2 text-xs text-gray-400 leading-relaxed">{hint}</div>
    </div>
  );
}

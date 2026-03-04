import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Brain, CheckCircle, X, Play, RefreshCw, Zap, 
  ArrowUp, ArrowDown, ArrowLeft, ArrowRight, 
  Hash, Clock, Eye, Activity, Target
} from 'lucide-react';

interface Props {
  rank: string; // 玩家的精神等级
  onComplete: (success: boolean) => void;
  onClose: () => void;
}

// === 游戏配置与注册表 ===

type Difficulty = 'EASY' | 'MEDIUM' | 'HARD';

interface GameConfig {
  id: string;
  name: string;
  description: string;
  component: React.FC<{ onWin: () => void; onLose: () => void }>;
}

// 难度映射逻辑
const getDifficulty = (rank: string): Difficulty => {
  const low = ['D', 'C', 'C+'];
  const mid = ['B', 'B+', 'A'];
  if (low.includes(rank) || rank === '—' || !rank) return 'EASY';
  if (mid.includes(rank)) return 'MEDIUM';
  return 'HARD';
};

// --- 游戏池定义 ---
const GAME_POOL: Record<Difficulty, GameConfig[]> = {
  EASY: [
    { 
      id: 'memory_flip', 
      name: '记忆碎片修复', 
      description: '翻开卡片，找到所有相同的配对以修复记忆回路。', 
      component: MemoryGame 
    },
    { 
      id: 'numeric_order', 
      name: '数据流梳理', 
      description: '按从小到大的顺序点击数字，理顺混乱的精神数据流。', 
      component: NumericOrderGame 
    },
    { 
      id: 'timing_lock', 
      name: '频段锁定', 
      description: '当指针移动到绿色区域时按下按钮，进行精神同调。', 
      component: TimingGame 
    }
  ],
  MEDIUM: [
    { 
      id: 'sequence_wave', 
      name: '波长同调', 
      description: '记住信号亮起的顺序，并准确复述以维持连接。', 
      component: SequenceGame 
    },
    { 
      id: 'direction_logic', 
      name: '逻辑门重组', 
      description: '根据指令做出反应。绿色跟随箭头，红色反向操作。', 
      component: DirectionGame 
    },
    { 
      id: 'quick_math', 
      name: '神经算力校准', 
      description: '快速完成简单的算术运算，激活逻辑中枢。', 
      component: MathGame 
    }
  ],
  HARD: [
    { 
      id: 'reaction_entropy', 
      name: '熵值抑制', 
      description: '在混乱的波动中，精准捕获所有绿色稳定点。', 
      component: ReactionGame 
    },
    { 
      id: 'stroop_test', 
      name: '认知解离', 
      description: '忽略文字本身的含义，点击文字所显示的颜色。', 
      component: StroopGame 
    },
    { 
      id: 'spatial_grid', 
      name: '矩阵残响', 
      description: '瞬间记住亮起的网格位置，并在熄灭后还原它们。', 
      component: SpatialGridGame 
    }
  ]
};

export function MiniGameView({ rank, onComplete, onClose }: Props) {
  const difficulty = getDifficulty(rank);
  const [gameState, setGameState] = useState<'intro' | 'playing' | 'won' | 'lost'>('intro');
  
  // 初始化时随机选择一个游戏
  const activeGame = useMemo(() => {
    const games = GAME_POOL[difficulty];
    const randomIndex = Math.floor(Math.random() * games.length);
    return games[randomIndex];
  }, [difficulty]); // 仅在难度变化时重新随机，防止重渲染导致游戏切换

  const handleWin = () => {
    setGameState('won');
    setTimeout(() => onComplete(true), 1500);
  };

  const handleLoss = () => {
    setGameState('lost');
  };

  const GameComponent = activeGame.component;

  return (
    <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl relative">
        <button onClick={onClose} className="absolute top-4 right-4 p-2 hover:bg-slate-100 rounded-full z-20">
          <X size={24} className="text-slate-400" />
        </button>

        {/* 标题栏 */}
        <div className="bg-indigo-600 p-6 text-white text-center">
          <Brain size={48} className="mx-auto mb-2 text-indigo-200" />
          <h2 className="text-2xl font-black tracking-widest uppercase">精神阈值训练</h2>
          <div className="flex justify-center gap-4 mt-2 text-xs font-bold opacity-80">
            <span>当前等级: {rank}</span>
            <span className="px-2 py-0.5 bg-white/20 rounded">模式: {difficulty}</span>
          </div>
        </div>

        {/* 游戏区域 */}
        <div className="p-6 min-h-[340px] flex items-center justify-center bg-slate-50">
          {gameState === 'intro' && (
            <div className="text-center space-y-4 max-w-xs">
              <h3 className="text-xl font-bold text-indigo-900">{activeGame.name}</h3>
              <p className="text-slate-600 font-medium">
                {activeGame.description}
              </p>
              <button 
                onClick={() => setGameState('playing')}
                className="px-8 py-3 bg-indigo-600 text-white font-black rounded-xl hover:bg-indigo-700 shadow-lg hover:scale-105 transition-all flex items-center gap-2 mx-auto mt-4"
              >
                <Play size={18}/> 开始链接
              </button>
            </div>
          )}

          {gameState === 'playing' && (
             <GameComponent onWin={handleWin} onLose={handleLoss} />
          )}

          {gameState === 'won' && (
            <motion.div initial={{scale:0.5}} animate={{scale:1}} className="text-center text-emerald-600">
              <CheckCircle size={80} className="mx-auto mb-4"/>
              <h3 className="text-3xl font-black">训练完成</h3>
              <p className="font-bold mt-2">精神稳定性 +5%</p>
            </motion.div>
          )}

          {gameState === 'lost' && (
            <motion.div initial={{scale:0.5}} animate={{scale:1}} className="text-center text-rose-500">
              <X size={80} className="mx-auto mb-4"/>
              <h3 className="text-3xl font-black">链接断开</h3>
              <p className="font-bold mt-2 mb-6">波动过大，同步失败。</p>
              <button onClick={() => setGameState('playing')} className="px-6 py-2 bg-slate-200 text-slate-600 rounded-lg font-black hover:bg-slate-300 flex items-center gap-2 mx-auto">
                <RefreshCw size={16}/> 重试
              </button>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}

// ==========================================
// ============ EASY GAMES (3个) ============
// ==========================================

// 1. 记忆翻牌 (原版)
const CARD_ICONS = ['⚡', '🌊', '🔥', '🍃', '👁️', '🛡️'];
function MemoryGame({ onWin }: any) {
  const [cards, setCards] = useState<any[]>([]);
  const [flipped, setFlipped] = useState<number[]>([]);
  const [solved, setSolved] = useState<number[]>([]);

  useEffect(() => {
    const deck = [...CARD_ICONS, ...CARD_ICONS]
      .sort(() => Math.random() - 0.5)
      .map((icon, id) => ({ id, icon }));
    setCards(deck);
  }, []);

  useEffect(() => {
    if (flipped.length === 2) {
      const [a, b] = flipped;
      if (cards[a].icon === cards[b].icon) {
        setSolved([...solved, a, b]);
        setFlipped([]);
      } else {
        const timer = setTimeout(() => setFlipped([]), 800);
        return () => clearTimeout(timer);
      }
    }
  }, [flipped, cards]);

  useEffect(() => {
    if (cards.length > 0 && solved.length === cards.length) onWin();
  }, [solved, cards, onWin]);

  return (
    <div className="grid grid-cols-4 gap-3 w-full max-w-xs">
      {cards.map((card, index) => (
        <motion.div
          key={card.id}
          initial={{ rotateY: 0 }}
          animate={{ rotateY: flipped.includes(index) || solved.includes(index) ? 180 : 0 }}
          className="aspect-square relative cursor-pointer perspective-1000"
          onClick={() => {
            if (!flipped.includes(index) && !solved.includes(index) && flipped.length < 2) {
              setFlipped([...flipped, index]);
            }
          }}
        >
          <div className="w-full h-full absolute inset-0 bg-indigo-200 rounded-lg border-2 border-indigo-300 flex items-center justify-center text-xl font-bold backface-hidden" style={{ backfaceVisibility: 'hidden' }}>?</div>
          <div className="w-full h-full absolute inset-0 bg-white rounded-lg border-2 border-indigo-500 flex items-center justify-center text-xl shadow-lg" style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}>{card.icon}</div>
        </motion.div>
      ))}
    </div>
  );
}

// 2. 数据流梳理 (点击 1-9)
function NumericOrderGame({ onWin, onLose }: any) {
  const [numbers, setNumbers] = useState<number[]>([]);
  const [nextExpected, setNextExpected] = useState(1);
  const [timeLeft, setTimeLeft] = useState(15); // 15秒限制

  useEffect(() => {
    setNumbers(Array.from({ length: 9 }, (_, i) => i + 1).sort(() => Math.random() - 0.5));
    const timer = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { clearInterval(timer); onLose(); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleClick = (num: number) => {
    if (num === nextExpected) {
      if (num === 9) onWin();
      else setNextExpected(n => n + 1);
    } else {
      // 点错不失败，只是没反应，或者可以加点惩罚
      // 这里为了简单，点错不做处理，只依赖时间限制
    }
  };

  return (
    <div className="space-y-4 text-center">
      <div className="text-lg font-bold text-slate-600 flex items-center justify-center gap-2">
        <Clock size={18}/> 剩余时间: <span className="text-indigo-600">{timeLeft}s</span>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {numbers.map(num => (
          <button
            key={num}
            disabled={num < nextExpected}
            onClick={() => handleClick(num)}
            className={`w-16 h-16 rounded-xl text-2xl font-black shadow-sm transition-all
              ${num < nextExpected ? 'bg-indigo-100 text-indigo-300 scale-90' : 'bg-white hover:bg-indigo-50 text-indigo-600 border-2 border-indigo-200 hover:scale-105'}
            `}
          >
            {num}
          </button>
        ))}
      </div>
    </div>
  );
}

// 3. 频段锁定 (时机游戏)
function TimingGame({ onWin, onLose }: any) {
  const [position, setPosition] = useState(0);
  const [direction, setDirection] = useState(1);
  const [rounds, setRounds] = useState(0);
  const [isActive, setIsActive] = useState(true);

  // 移动指针
  useEffect(() => {
    if (!isActive) return;
    const interval = setInterval(() => {
      setPosition(p => {
        if (p >= 100) setDirection(-1);
        if (p <= 0) setDirection(1);
        return p + (direction * 2.5); // 速度
      });
    }, 16);
    return () => clearInterval(interval);
  }, [direction, isActive]);

  const handleStop = () => {
    // 绿色区域大致在 40-60
    if (position >= 40 && position <= 60) {
      if (rounds + 1 >= 3) {
        setIsActive(false);
        onWin();
      } else {
        setRounds(r => r + 1);
        // 增加难度：每次成功后随机重置位置
        setPosition(Math.random() < 0.5 ? 0 : 100);
      }
    } else {
      setIsActive(false);
      onLose();
    }
  };

  return (
    <div className="w-64 space-y-6 text-center">
      <div className="text-slate-500 font-bold">成功锁定: {rounds} / 3</div>
      <div className="relative h-8 bg-slate-200 rounded-full overflow-hidden border-2 border-slate-300">
        {/* 目标区域 */}
        <div className="absolute left-[40%] width-[20%] w-[20%] h-full bg-emerald-400/50 border-x-2 border-emerald-500"></div>
        {/* 指针 */}
        <div 
          className="absolute top-0 bottom-0 w-1 bg-indigo-600 shadow-[0_0_10px_currentColor]"
          style={{ left: `${position}%` }}
        />
      </div>
      <button 
        onClick={handleStop}
        className="w-full py-4 bg-indigo-600 text-white rounded-xl font-black text-xl hover:bg-indigo-700 active:scale-95 transition-all"
      >
        锁定
      </button>
    </div>
  );
}

// ==========================================
// ============ MEDIUM GAMES (3个) ==========
// ==========================================

// 1. 波长序列 (原版)
const SEQ_COLORS = ['red', 'blue', 'green', 'yellow'];
function SequenceGame({ onWin, onLose }: any) {
  const [sequence, setSequence] = useState<string[]>([]);
  const [userStep, setUserStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false); 
  const [activeColor, setActiveColor] = useState<string | null>(null);

  const addStep = () => {
    const nextColor = SEQ_COLORS[Math.floor(Math.random() * SEQ_COLORS.length)];
    const newSeq = [...sequence, nextColor];
    setSequence(newSeq);
    setUserStep(0);
    playSequence(newSeq);
  };

  const playSequence = async (seq: string[]) => {
    setIsPlaying(true);
    for (const color of seq) {
      await new Promise(r => setTimeout(r, 400));
      setActiveColor(color);
      await new Promise(r => setTimeout(r, 400));
      setActiveColor(null);
    }
    setIsPlaying(false);
  };

  useEffect(() => { addStep(); }, []); 

  const handlePress = (color: string) => {
    if (isPlaying) return;
    setActiveColor(color);
    setTimeout(() => setActiveColor(null), 200);

    if (color === sequence[userStep]) {
      if (userStep + 1 === sequence.length) {
        if (sequence.length >= 5) onWin(); 
        else setTimeout(addStep, 800);
      } else {
        setUserStep(userStep + 1);
      }
    } else {
      onLose();
    }
  };

  return (
    <div className="grid grid-cols-2 gap-4 w-64 h-64">
      {SEQ_COLORS.map(c => (
        <button
          key={c}
          className={`rounded-2xl transition-all duration-100 ${
            activeColor === c ? 'brightness-125 scale-105 shadow-[0_0_20px_currentColor]' : 'brightness-75 opacity-80'
          }`}
          style={{ backgroundColor: c }}
          onClick={() => handlePress(c)}
          disabled={isPlaying}
        />
      ))}
    </div>
  );
}

// 2. 逻辑门重组 (方向判断)
function DirectionGame({ onWin, onLose }: any) {
  const [score, setScore] = useState(0);
  const [current, setCurrent] = useState<{dir: string, type: 'NORMAL'|'REVERSE'}>({dir: 'UP', type: 'NORMAL'});
  
  const generate = () => {
    const dirs = ['UP', 'DOWN', 'LEFT', 'RIGHT'];
    const type = Math.random() > 0.4 ? 'REVERSE' : 'NORMAL'; // 增加REVERSE的概率
    const dir = dirs[Math.floor(Math.random() * dirs.length)];
    setCurrent({ dir, type });
  };

  useEffect(() => { generate(); }, []);

  const handlePress = (inputDir: string) => {
    let expected = current.dir;
    if (current.type === 'REVERSE') {
      if (current.dir === 'UP') expected = 'DOWN';
      if (current.dir === 'DOWN') expected = 'UP';
      if (current.dir === 'LEFT') expected = 'RIGHT';
      if (current.dir === 'RIGHT') expected = 'LEFT';
    }

    if (inputDir === expected) {
      if (score + 1 >= 8) onWin(); // 需要正确8次
      else {
        setScore(s => s + 1);
        generate();
      }
    } else {
      onLose();
    }
  };

  // 映射图标
  const iconMap: any = { UP: ArrowUp, DOWN: ArrowDown, LEFT: ArrowLeft, RIGHT: ArrowRight };
  const Icon = iconMap[current.dir];

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="text-slate-400 font-bold">进度: {score} / 8</div>
      
      {/* 视觉提示 */}
      <div className={`w-32 h-32 flex items-center justify-center rounded-2xl shadow-xl transition-colors duration-300 ${current.type === 'REVERSE' ? 'bg-rose-500' : 'bg-emerald-500'}`}>
        <Icon size={64} className="text-white" />
      </div>
      <div className={`text-sm font-bold ${current.type === 'REVERSE' ? 'text-rose-500' : 'text-emerald-600'}`}>
        {current.type === 'REVERSE' ? '反向操作 (REVERSE)' : '同向操作 (NORMAL)'}
      </div>

      {/* 控制器 */}
      <div className="grid grid-cols-3 gap-2">
        <div />
        <button onClick={() => handlePress('UP')} className="p-4 bg-slate-200 rounded-lg hover:bg-indigo-100 active:bg-indigo-200"><ArrowUp/></button>
        <div />
        <button onClick={() => handlePress('LEFT')} className="p-4 bg-slate-200 rounded-lg hover:bg-indigo-100 active:bg-indigo-200"><ArrowLeft/></button>
        <button onClick={() => handlePress('DOWN')} className="p-4 bg-slate-200 rounded-lg hover:bg-indigo-100 active:bg-indigo-200"><ArrowDown/></button>
        <button onClick={() => handlePress('RIGHT')} className="p-4 bg-slate-200 rounded-lg hover:bg-indigo-100 active:bg-indigo-200"><ArrowRight/></button>
      </div>
    </div>
  );
}

// 3. 神经算力 (快速心算)
function MathGame({ onWin, onLose }: any) {
  const [question, setQuestion] = useState({ text: '', ans: 0 });
  const [options, setOptions] = useState<number[]>([]);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(20);

  const generateLevel = () => {
    const a = Math.floor(Math.random() * 20) + 1;
    const b = Math.floor(Math.random() * 20) + 1;
    const isAdd = Math.random() > 0.5;
    const ans = isAdd ? a + b : a - b; // 允许负数，增加难度
    const text = `${a} ${isAdd ? '+' : '-'} ${b} = ?`;

    // 生成混淆选项
    const opts = new Set([ans]);
    while (opts.size < 3) {
      opts.add(ans + Math.floor(Math.random() * 10) - 5);
    }
    setOptions(Array.from(opts).sort(() => Math.random() - 0.5));
    setQuestion({ text, ans });
  };

  useEffect(() => {
    generateLevel();
    const t = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) { clearInterval(t); onLose(); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, []);

  const handleAnswer = (val: number) => {
    if (val === question.ans) {
      if (score + 1 >= 5) onWin();
      else {
        setScore(s => s + 1);
        generateLevel();
      }
    } else {
      onLose();
    }
  };

  return (
    <div className="w-64 text-center space-y-6">
      <div className="flex justify-between text-xs font-bold text-slate-400">
        <span>题目: {score}/5</span>
        <span className="text-rose-500">时间: {timeLeft}s</span>
      </div>
      
      <div className="bg-slate-100 py-8 rounded-2xl text-3xl font-black text-slate-700 shadow-inner">
        {question.text}
      </div>

      <div className="grid grid-cols-3 gap-3">
        {options.map((opt, i) => (
          <button 
            key={i}
            onClick={() => handleAnswer(opt)}
            className="py-3 bg-white border-2 border-indigo-100 text-indigo-600 font-bold rounded-xl hover:bg-indigo-600 hover:text-white transition-colors"
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}

// ==========================================
// ============ HARD GAMES (3个) ============
// ==========================================

// 1. 熵值抑制 (原版)
function ReactionGame({ onWin, onLose }: any) {
  const [target, setTarget] = useState({ x: 50, y: 50 });
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(20);
  const [size, setSize] = useState(60);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 0.1) { clearInterval(timer); onLose(); return 0; }
        return t - 0.1;
      });
    }, 100);
    return () => clearInterval(timer);
  }, []);

  const handleClick = () => {
    if (score + 1 >= 15) { 
      onWin();
    } else {
      setScore(s => s + 1);
      setTarget({ x: 10 + Math.random() * 80, y: 10 + Math.random() * 80 });
      setSize(s => Math.max(30, s - 2));
    }
  };

  return (
    <div className="relative w-full h-[300px] bg-slate-900 rounded-xl overflow-hidden cursor-crosshair">
      <div className="absolute top-2 left-2 text-white font-mono text-xs">进度: {score}/15</div>
      <div className="absolute top-2 right-2 text-rose-400 font-mono text-xs">倒计时: {timeLeft.toFixed(1)}s</div>
      
      <motion.button
        className="absolute rounded-full bg-emerald-500 shadow-[0_0_15px_#10b981] flex items-center justify-center border-2 border-white"
        style={{ left: `${target.x}%`, top: `${target.y}%`, width: size, height: size, marginLeft: -size/2, marginTop: -size/2 }}
        whileTap={{ scale: 0.8 }}
        onClick={handleClick}
      >
        <Zap size={size/2} className="text-white"/>
      </motion.button>
    </div>
  );
}

// 2. 认知解离 (Stroop Test)
function StroopGame({ onWin, onLose }: any) {
  const [score, setScore] = useState(0);
  const [current, setCurrent] = useState({ text: '', color: '' });
  const [timeLeft, setTimeLeft] = useState(15);
  
  const COLORS = [
    { name: '红', val: 'red', hex: '#ef4444' },
    { name: '蓝', val: 'blue', hex: '#3b82f6' },
    { name: '绿', val: 'green', hex: '#22c55e' },
    { name: '黄', val: 'yellow', hex: '#eab308' }
  ];

  const generate = () => {
    const textIdx = Math.floor(Math.random() * COLORS.length);
    let colorIdx = Math.floor(Math.random() * COLORS.length);
    // 确保颜色和文字不一致的概率较高，增加干扰
    while (Math.random() > 0.3 && colorIdx === textIdx) {
      colorIdx = Math.floor(Math.random() * COLORS.length);
    }
    setCurrent({ text: COLORS[textIdx].name, color: COLORS[colorIdx].val });
  };

  useEffect(() => {
    generate();
    const t = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 0.1) { clearInterval(t); onLose(); return 0; }
        return prev - 0.1;
      });
    }, 100);
    return () => clearInterval(t);
  }, []);

  const handleSelect = (selectedColorVal: string) => {
    if (selectedColorVal === current.color) {
      if (score + 1 >= 10) onWin();
      else {
        setScore(s => s + 1);
        generate();
        setTimeLeft(t => Math.min(t + 1, 15)); // 答对奖励时间
      }
    } else {
      onLose();
    }
  };

  return (
    <div className="w-64 text-center space-y-8">
      <div className="flex justify-between text-xs font-bold text-slate-500">
        <span>抑制进度: {score}/10</span>
        <span className="text-rose-500">{timeLeft.toFixed(1)}s</span>
      </div>

      <div className="text-6xl font-black transition-all duration-200" style={{ color: current.color }}>
        {current.text}
      </div>
      
      <p className="text-xs text-slate-400">点击由于<span className="underline">颜色</span>代表的按钮</p>

      <div className="grid grid-cols-2 gap-3">
        {COLORS.map(c => (
          <button
            key={c.val}
            onClick={() => handleSelect(c.val)}
            className="py-3 rounded-lg border-2 border-slate-200 font-bold text-slate-600 hover:bg-slate-50 active:scale-95"
          >
            {c.name}色
          </button>
        ))}
      </div>
    </div>
  );
}

// 3. 矩阵残响 (空间记忆)
function SpatialGridGame({ onWin, onLose }: any) {
  const [grid, setGrid] = useState<number[]>([]); // 目标索引
  const [userSelected, setUserSelected] = useState<number[]>([]);
  const [phase, setPhase] = useState<'SHOW' | 'INPUT'>('SHOW');
  const [round, setRound] = useState(1);

  const startRound = (level: number) => {
    const count = level + 2; // 3, 4, 5, 6
    const newGrid = new Set<number>();
    while(newGrid.size < count) {
      newGrid.add(Math.floor(Math.random() * 16));
    }
    const arr = Array.from(newGrid);
    setGrid(arr);
    setUserSelected([]);
    setPhase('SHOW');
    
    // 1.5秒后隐藏
    setTimeout(() => {
      setPhase('INPUT');
    }, 1500);
  };

  useEffect(() => { startRound(1); }, []);

  const handleCellClick = (idx: number) => {
    if (phase !== 'INPUT') return;
    
    // 如果已经在已选列表中，不做处理
    if (userSelected.includes(idx)) return;

    if (grid.includes(idx)) {
      const newSelected = [...userSelected, idx];
      setUserSelected(newSelected);
      if (newSelected.length === grid.length) {
        if (round >= 4) onWin();
        else {
          setRound(r => r + 1);
          setTimeout(() => startRound(round + 1), 500);
        }
      }
    } else {
      onLose();
    }
  };

  return (
    <div className="space-y-4 text-center">
      <div className="text-sm font-bold text-slate-500">
        Round {round}/4 ({phase === 'SHOW' ? '记忆模式' : '复原模式'})
      </div>
      <div className="grid grid-cols-4 gap-2 bg-slate-800 p-2 rounded-xl">
        {Array.from({ length: 16 }).map((_, i) => {
          let bgClass = 'bg-slate-700';
          if (phase === 'SHOW' && grid.includes(i)) bgClass = 'bg-emerald-400 shadow-[0_0_10px_#34d399]';
          if (phase === 'INPUT' && userSelected.includes(i)) bgClass = 'bg-emerald-500';

          return (
            <button
              key={i}
              onClick={() => handleCellClick(i)}
              className={`w-12 h-12 rounded-lg transition-all duration-200 ${bgClass}`}
              disabled={phase === 'SHOW'}
            />
          );
        })}
      </div>
    </div>
  );
}
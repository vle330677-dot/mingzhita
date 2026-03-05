import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Clock, KeyRound, ShieldAlert, X } from 'lucide-react';

type Mode = 'input' | 'choice' | 'sequence';

interface Challenge {
  id: string;
  title: string;
  prompt: string;
  mode: Mode;
  answer: string;
  options?: string[];
  extraText?: string[];
}

interface Props {
  gameId: string;
  gameName: string;
  difficulty: number;
  onResolve: (success: boolean) => void;
  onClose: () => void;
}

const ARROWS = ['↑', '↓', '←', '→'] as const;

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
const randInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
const shuffle = <T,>(arr: T[]) => [...arr].sort(() => Math.random() - 0.5);

function shiftEncode(word: string, shift: number) {
  return word
    .split('')
    .map((ch) => {
      const code = ch.charCodeAt(0);
      if (code >= 65 && code <= 90) {
        const offset = ((code - 65 + shift) % 26 + 26) % 26;
        return String.fromCharCode(65 + offset);
      }
      return ch;
    })
    .join('');
}

function buildChallenge(gameId: string, difficulty: number): Challenge {
  const d = clamp(Math.trunc(difficulty || 1), 1, 12);

  if (gameId === 'cipher_shift') {
    const words = ['GHOST', 'PRISON', 'RUNE', 'SHADOW', 'SPIRIT', 'BARRIER', 'LOCK', 'CRYPT'];
    const answer = words[randInt(0, words.length - 1)];
    const shift = randInt(1, clamp(2 + d, 2, 9));
    const encoded = shiftEncode(answer, shift);
    return {
      id: gameId,
      title: '凯撒残码',
      prompt: `将密文解码（向后偏移 ${shift} 位）`,
      mode: 'input',
      answer,
      extraText: [`密文：${encoded}`]
    };
  }

  if (gameId === 'symbol_count') {
    const symbols = ['@', '#', '$', '%', '&', '*'];
    const target = symbols[randInt(0, symbols.length - 1)];
    const size = 14 + d * 2;
    const seq = Array.from({ length: size }, () => symbols[randInt(0, symbols.length - 1)]);
    const count = seq.filter((x) => x === target).length;
    const options = shuffle(
      Array.from(new Set([count, Math.max(0, count - 1), count + 1, count + 2].map((x) => String(x))))
    );
    return {
      id: gameId,
      title: '符号计数',
      prompt: `数一数目标符号 "${target}" 的数量`,
      mode: 'choice',
      answer: String(count),
      options,
      extraText: [seq.join(' ')]
    };
  }

  if (gameId === 'logic_gate') {
    const gates = ['AND', 'OR', 'XOR', 'NAND'] as const;
    const gate = gates[randInt(0, gates.length - 1)];
    const a = randInt(0, 1);
    const b = randInt(0, 1);
    let out = 0;
    if (gate === 'AND') out = a & b;
    if (gate === 'OR') out = a | b;
    if (gate === 'XOR') out = a ^ b;
    if (gate === 'NAND') out = a & b ? 0 : 1;
    return {
      id: gameId,
      title: '逻辑门',
      prompt: `计算输出：${gate}(${a}, ${b}) = ?`,
      mode: 'choice',
      answer: String(out),
      options: shuffle(['0', '1'])
    };
  }

  if (gameId === 'code_lock') {
    const len = clamp(4 + d, 4, 8);
    const code = Array.from({ length: len }, () => String(randInt(0, 9))).join('');
    const answer = code.split('').reverse().join('');
    return {
      id: gameId,
      title: '逆序密码锁',
      prompt: '输入下方密码的逆序串',
      mode: 'input',
      answer,
      extraText: [`原始串：${code}`]
    };
  }

  if (gameId === 'matrix_path') {
    const size = 5;
    let x = randInt(1, size);
    let y = randInt(1, size);
    const steps = clamp(3 + d, 3, 8);
    const movePool = ['U', 'D', 'L', 'R'] as const;
    const seq: string[] = [];
    for (let i = 0; i < steps; i++) {
      const m = movePool[randInt(0, movePool.length - 1)];
      seq.push(m);
      if (m === 'U') y = Math.max(1, y - 1);
      if (m === 'D') y = Math.min(size, y + 1);
      if (m === 'L') x = Math.max(1, x - 1);
      if (m === 'R') x = Math.min(size, x + 1);
    }
    const startX = randInt(1, size);
    const startY = randInt(1, size);
    let fx = startX;
    let fy = startY;
    for (const m of seq) {
      if (m === 'U') fy = Math.max(1, fy - 1);
      if (m === 'D') fy = Math.min(size, fy + 1);
      if (m === 'L') fx = Math.max(1, fx - 1);
      if (m === 'R') fx = Math.min(size, fx + 1);
    }
    const answer = `${fx},${fy}`;
    const opts = shuffle(
      Array.from(new Set([answer, `${Math.max(1, fx - 1)},${fy}`, `${fx},${Math.min(size, fy + 1)}`, `${Math.min(size, fx + 1)},${fy}`]))
    );
    return {
      id: gameId,
      title: '矩阵路径',
      prompt: `从 (${startX},${startY}) 按序移动，最终坐标是？`,
      mode: 'choice',
      answer,
      options: opts,
      extraText: [`路径：${seq.join(' ')}`]
    };
  }

  if (gameId === 'odd_symbol') {
    const base = ['A', 'B', 'C', 'D', 'E', 'F'];
    const main = base[randInt(0, base.length - 1)];
    const odd = base.find((x) => x !== main) || 'Z';
    const idx = randInt(0, 8);
    const arr = Array.from({ length: 9 }, () => main);
    arr[idx] = odd;
    return {
      id: gameId,
      title: '异位符号',
      prompt: '找出不同符号所在序号（1-9）',
      mode: 'input',
      answer: String(idx + 1),
      extraText: [
        `${arr[0]} ${arr[1]} ${arr[2]}`,
        `${arr[3]} ${arr[4]} ${arr[5]}`,
        `${arr[6]} ${arr[7]} ${arr[8]}`,
      ]
    };
  }

  if (gameId === 'sequence_mem') {
    const len = clamp(3 + d, 3, 9);
    const seq = Array.from({ length: len }, () => ARROWS[randInt(0, ARROWS.length - 1)]);
    return {
      id: gameId,
      title: '序列记忆',
      prompt: '按顺序点击箭头序列',
      mode: 'sequence',
      answer: seq.join(''),
      extraText: [`目标序列：${seq.join(' ')}`]
    };
  }

  const bitsLen = clamp(6 + d, 6, 14);
  const bits = Array.from({ length: bitsLen }, () => (Math.random() > 0.5 ? '1' : '0')).join('');
  const answer = bits
    .split('')
    .map((x) => (x === '1' ? '0' : '1'))
    .join('');
  return {
    id: gameId,
    title: '信号反相',
    prompt: '将 0/1 全部反相后输入结果',
    mode: 'input',
    answer,
    extraText: [`原始信号：${bits}`]
  };
}

export function PrisonEscapeMiniGame({ gameId, gameName, difficulty, onResolve, onClose }: Props) {
  const challenge = useMemo(() => buildChallenge(gameId, difficulty), [gameId, difficulty]);
  const timeLimit = useMemo(() => clamp(48 - Math.trunc(difficulty || 1) * 2, 18, 48), [difficulty]);
  const [timeLeft, setTimeLeft] = useState(timeLimit);
  const [input, setInput] = useState('');
  const [picked, setPicked] = useState('');
  const [seqInput, setSeqInput] = useState<string[]>([]);
  const [ended, setEnded] = useState(false);

  useEffect(() => {
    if (ended) return;
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setEnded(true);
          onResolve(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [ended, onResolve]);

  const submit = () => {
    if (ended) return;
    let answer = '';
    if (challenge.mode === 'input') answer = input.trim().toUpperCase();
    if (challenge.mode === 'choice') answer = picked;
    if (challenge.mode === 'sequence') answer = seqInput.join('');
    if (!answer) return;
    const ok = answer === String(challenge.answer || '').toUpperCase();
    setEnded(true);
    onResolve(ok);
  };

  return (
    <div className="fixed inset-0 z-[500] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-2xl rounded-2xl border border-cyan-600/40 bg-slate-950 text-cyan-100 shadow-2xl">
        <div className="px-5 py-4 border-b border-cyan-900 flex items-center justify-between">
          <div>
            <div className="text-lg font-black inline-flex items-center gap-2">
              <KeyRound size={18} />
              越狱解密 · {gameName || challenge.title}
            </div>
            <div className="text-xs text-cyan-400 mt-1">难度 等级 {difficulty} · 游戏 {challenge.title}</div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-slate-800">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="inline-flex items-center gap-2 text-sm font-bold text-amber-300">
            <Clock size={16} />
            倒计时：{timeLeft}s
          </div>
          <div className="rounded-xl border border-cyan-900/70 bg-slate-900/60 p-4">
            <div className="text-sm font-bold">{challenge.prompt}</div>
            {(challenge.extraText || []).map((line, i) => (
              <div key={`${line}-${i}`} className="font-mono text-xs text-cyan-300 mt-2 whitespace-pre-wrap">
                {line}
              </div>
            ))}
          </div>

          {challenge.mode === 'input' && (
            <div className="space-y-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                className="w-full rounded-lg bg-slate-900 border border-cyan-800 px-3 py-2 outline-none focus:border-cyan-400"
                placeholder="输入答案"
              />
            </div>
          )}

          {challenge.mode === 'choice' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {(challenge.options || []).map((op) => (
                <button
                  key={op}
                  onClick={() => setPicked(op)}
                  className={`rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                    picked === op ? 'border-cyan-300 bg-cyan-900/50 text-white' : 'border-cyan-900 bg-slate-900 hover:bg-slate-800'
                  }`}
                >
                  {op}
                </button>
              ))}
            </div>
          )}

          {challenge.mode === 'sequence' && (
            <div className="space-y-2">
              <div className="text-xs text-cyan-300">已输入：{seqInput.join(' ') || '(空)'}</div>
              <div className="grid grid-cols-4 gap-2">
                {ARROWS.map((a) => (
                  <button
                    key={a}
                    onClick={() => setSeqInput((prev) => [...prev, a])}
                    className="rounded-lg border border-cyan-800 bg-slate-900 hover:bg-slate-800 px-3 py-2 text-lg font-black"
                  >
                    {a}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setSeqInput([])}
                className="rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 px-3 py-1.5 text-xs"
              >
                清空序列
              </button>
            </div>
          )}

          <div className="flex items-center gap-2 pt-2">
            <button
              onClick={submit}
              disabled={ended}
              className="rounded-lg bg-cyan-700 hover:bg-cyan-600 disabled:opacity-60 text-white px-4 py-2 text-sm font-black"
            >
              提交越狱解密
            </button>
            <AnimatePresence>
              {ended && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="inline-flex items-center gap-1 text-xs text-amber-300">
                  <ShieldAlert size={14} />
                  结果已提交
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PrisonEscapeMiniGame;

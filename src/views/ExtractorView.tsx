import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ViewState } from '../App';
import {
  type DifferentiationData,
  buildUndifferentiatedData,
  generateDifferentiationData,
  isSentinelOrGuide,
  MAX_DIFFERENTIATION_DRAWS,
  NONE
} from '../utils/differentiation';

interface Props {
  onNavigate: (view: ViewState) => void;
  userName: string;
}

export function ExtractorView({ onNavigate, userName }: Props) {
  const [drawCount, setDrawCount] = useState(0);
  const [historyData, setHistoryData] = useState<DifferentiationData[]>([]);
  const [currentData, setCurrentData] = useState<DifferentiationData | null>(null);
  const [isLocked, setIsLocked] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showSpiritModal, setShowSpiritModal] = useState(false);
  const [finalData, setFinalData] = useState<DifferentiationData | null>(null);
  const [customSpirit, setCustomSpirit] = useState('');
  const [loading, setLoading] = useState(false);
  const [spiritView, setSpiritView] = useState<'question' | 'input'>('question');
  const [initialAge, setInitialAge] = useState<number | null>(null);

  const isMinorUndifferentiated = initialAge !== null && initialAge < 16;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/users/${encodeURIComponent(userName)}`);
        const data = await res.json();
        if (!cancelled && data?.success && data?.user) {
          setInitialAge(typeof data.user.age === 'number' ? data.user.age : null);
        }
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userName]);

  const executeFinalLock = async (raw: DifferentiationData) => {
    const isMinor = (initialAge ?? 16) < 16;
    const data = isMinor ? buildUndifferentiatedData() : raw;

    setIsLocked(true);
    setCurrentData(data);
    setLoading(true);

    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: userName,
          age: initialAge ?? undefined,
          role: data.role,
          mentalRank: data.mentalRank,
          physicalRank: data.physicalRank,
          gold: data.gold,
          ability: data.ability,
          spiritName: data.spirit?.name || NONE,
          spiritType: data.spirit?.type || NONE
        })
      });
      const result = await res.json().catch(() => ({} as any));
      if (!res.ok || result.success === false) {
        alert(result.message || '保存失败');
        setIsLocked(false);
        return;
      }
      setTimeout(() => onNavigate('PENDING'), 1000);
    } catch {
      alert('网络错误');
      setIsLocked(false);
    } finally {
      setLoading(false);
    }
  };

  const drawOnce = () => {
    if (isLocked) return;
    if (isMinorUndifferentiated) {
      executeFinalLock(buildUndifferentiatedData());
      return;
    }
    if (drawCount >= MAX_DIFFERENTIATION_DRAWS) {
      setShowHistoryModal(true);
      return;
    }

    const data = generateDifferentiationData();
    setHistoryData((prev) => [...prev, data]);
    setCurrentData(data);
    setDrawCount((n) => n + 1);

    if (drawCount + 1 === MAX_DIFFERENTIATION_DRAWS) {
      setTimeout(() => setShowHistoryModal(true), 200);
    }
  };

  const selectFinal = (index: number) => {
    const data = historyData[index];
    if (!data) return;
    setFinalData(data);
    setShowHistoryModal(false);

    if (!isSentinelOrGuide(data.role)) {
      executeFinalLock(data);
      return;
    }

    setSpiritView('question');
    setCustomSpirit('');
    setShowSpiritModal(true);
  };

  const handleLikeSpirit = () => {
    if (!finalData) return;
    setShowSpiritModal(false);
    executeFinalLock(finalData);
  };

  const handleDislikeSpirit = () => {
    setSpiritView('input');
  };

  const handleConfirmCustomSpirit = () => {
    if (!finalData) return;
    if (!customSpirit.trim()) {
      alert('精神体名称不能为空');
      return;
    }
    const next: DifferentiationData = {
      ...finalData,
      spirit: { name: customSpirit.trim(), type: '自定义' }
    };
    setFinalData(next);
    setShowSpiritModal(false);
    executeFinalLock(next);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="w-full max-w-4xl grid gap-4">
        <div className="p-6 bg-white border border-gray-200 rounded-2xl shadow-sm">
          <h1 className="text-2xl font-black mb-2">哨兵 / 向导 抽取器</h1>
          <p className="text-sm text-gray-500">
            未满16岁将直接生成“未分化”档案；16岁及以上可进行10次抽取后锁定。
          </p>
        </div>

        <div className="p-6 bg-white border border-gray-200 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs text-gray-500">进度：{isLocked ? '已锁定' : `${drawCount}/${MAX_DIFFERENTIATION_DRAWS}`}</span>
            {!isLocked && (
              <button
                onClick={drawOnce}
                className="px-4 py-2 bg-gray-900 text-white rounded-xl text-sm font-bold hover:bg-gray-800"
              >
                {isMinorUndifferentiated
                  ? '确认未分化档案'
                  : (drawCount >= MAX_DIFFERENTIATION_DRAWS ? '打开抉择面板' : `抽取（剩余${MAX_DIFFERENTIATION_DRAWS - drawCount}次）`)}
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Stat label="身份" value={currentData?.role || '-'} />
            <Stat label="精神等级" value={currentData?.mentalRank || '-'} />
            <Stat label="肉体等级" value={currentData?.physicalRank || '-'} />
            <Stat label="金币" value={String(currentData?.gold ?? '-')} />
            <Stat label="能力偏好" value={currentData?.ability || '-'} />
            <Stat label="精神体" value={currentData?.spirit?.name || '-'} />
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showHistoryModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
          >
            <div className="w-full max-w-5xl max-h-[90vh] overflow-y-auto bg-white rounded-2xl p-6">
              <h2 className="text-xl font-black mb-4">选择最终结果</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {historyData.map((d, idx) => (
                  <div key={idx} className="border border-gray-200 rounded-xl p-4">
                    <div className="text-sm font-black mb-2">第 {idx + 1} 次</div>
                    <div className="text-xs text-gray-600">身份：{d.role}</div>
                    <div className="text-xs text-gray-600">精神/肉体：{d.mentalRank}/{d.physicalRank}</div>
                    <div className="text-xs text-gray-600">金币：{d.gold}</div>
                    <div className="text-xs text-gray-600">能力：{d.ability}</div>
                    <div className="text-xs text-gray-600 mb-2">精神体：{d.spirit.name}</div>
                    <button
                      onClick={() => selectFinal(idx)}
                      className="w-full py-2 bg-gray-900 text-white rounded-lg text-sm font-bold"
                    >
                      选择
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showSpiritModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
          >
            <div className="w-full max-w-md bg-white rounded-2xl p-6">
              {spiritView === 'question' ? (
                <div className="text-center">
                  <h2 className="text-xl font-black mb-3">保留当前精神体？</h2>
                  <p className="text-sm text-gray-600 mb-4">{finalData?.spirit?.name}</p>
                  <div className="grid grid-cols-2 gap-3">
                    <button onClick={handleLikeSpirit} className="py-2 bg-emerald-600 text-white rounded-lg font-bold">
                      保留
                    </button>
                    <button onClick={handleDislikeSpirit} className="py-2 bg-rose-600 text-white rounded-lg font-bold">
                      更换
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <h2 className="text-xl font-black mb-3">输入新精神体</h2>
                  <input
                    value={customSpirit}
                    onChange={(e) => setCustomSpirit(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg mb-3"
                    placeholder="输入新精神体名称"
                  />
                  <button
                    onClick={handleConfirmCustomSpirit}
                    className="w-full py-2 bg-gray-900 text-white rounded-lg font-bold"
                  >
                    确认
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {loading && (
        <div className="fixed inset-0 bg-white/80 z-[100] flex items-center justify-center">
          <div className="text-sm font-medium text-gray-700">正在保存角色档案...</div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-gray-200 rounded-xl p-3 bg-gray-50">
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className="text-sm font-bold text-gray-900 break-all">{value}</div>
    </div>
  );
}

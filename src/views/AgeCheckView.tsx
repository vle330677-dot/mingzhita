import { useState } from 'react';
import { motion } from 'motion/react';
import { ViewState } from '../App';

interface Props {
  onNavigate: (view: ViewState) => void;
  userName?: string;
}

export function AgeCheckView({ onNavigate, userName }: Props) {
  const [saving, setSaving] = useState(false);

  const applyAgeAndContinue = async (isAdult: boolean) => {
    if (saving) return;
    setSaving(true);
    try {
      const age = isAdult ? 16 : 15;
      if (userName) {
        const profileRes = await fetch(`/api/users/${encodeURIComponent(userName)}`);
        const profile = await profileRes.json().catch(() => ({} as any));
        const oldUser = profile?.user || {};

        await fetch('/api/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: oldUser?.id,
            name: userName,
            age,
            role: isAdult ? (oldUser?.role || '普通人') : '未分化',
          })
        });
      }
    } catch {
      // keep flow forward even if save fails
    } finally {
      setSaving(false);
      onNavigate('EXTRACTOR');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="max-w-md w-full bg-white p-8 rounded-2xl shadow-sm border border-gray-100 text-center"
      >
        <h2 className="text-2xl font-serif text-gray-800 mb-4">年龄确认</h2>
        <p className="text-gray-500 text-sm mb-8">这会影响未分化/学生/成年阶段机制。</p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button
            onClick={() => applyAgeAndContinue(true)}
            disabled={saving}
            className="flex-1 py-3 px-6 bg-gray-900 text-white rounded-xl font-medium hover:bg-gray-800 transition-colors disabled:opacity-60"
          >
            我已满16岁
          </button>
          <button
            onClick={() => applyAgeAndContinue(false)}
            disabled={saving}
            className="flex-1 py-3 px-6 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors disabled:opacity-60"
          >
            我未满16岁
          </button>
        </div>
      </motion.div>
    </div>
  );
}

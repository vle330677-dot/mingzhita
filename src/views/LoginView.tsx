import React, { useState } from 'react';
import { motion } from 'motion/react';
import { ViewState } from '../App';
import { User } from '../types';

interface Props {
  onNavigate: (view: ViewState) => void;
  setUserName: (name: string) => void;
  setUser: (user: User | null) => void;
}

export function LoginView({ onNavigate, setUserName, setUser }: Props) {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/users/${name.trim()}`);
      const data = await res.json();

      if (data.success && data.user) {
        setUserName(data.user.name);
        setUser(data.user);
        if (data.user.status === 'approved') {
          onNavigate('GAME');
        } else if (data.user.status === 'pending') {
          setError('您的人设还未通过审核，请前往审核群：740196067联系管理员');
        } else if (data.user.status === 'rejected') {
          setError('您的身份档案不被塔认可，请回到审核群重新提交');
          fetch(`/api/users/${data.user.id}`, { method: 'DELETE' });
        } else if (data.user.status === 'dead') {
          setError('该身份已死亡，请使用新的名字。');
        } else if (data.user.status === 'ghost') {
          onNavigate('GAME');
        }
      } else {
        await fetch('/api/users/init', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: name.trim() })
        });
        setUserName(name.trim());
        setError('未查询到你的资料，现在获取您的身份');
        setTimeout(() => {
          onNavigate('AGE_CHECK');
        }, 1500);
      }
    } catch (err) {
      setError('网络错误，请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 w-full max-w-md text-center"
      >
        <h2 className="text-2xl font-serif text-gray-800 mb-6">你是谁</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="输入你的名字"
            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-200 text-center text-lg"
            autoFocus
          />
          <button
            type="submit"
            disabled={loading || !name.trim()}
            className="w-full py-3 bg-gray-900 text-white rounded-xl font-medium hover:bg-gray-800 transition-colors disabled:opacity-50"
          >
            {loading ? '查询中...' : '确认'}
          </button>
        </form>
        {error && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-4 text-sm text-gray-500"
          >
            {error}
          </motion.p>
        )}
      </motion.div>
    </div>
  );
}

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ViewState } from '../App';
import { User } from '../types';
import {
  ADMIN_NAME_KEY,
  ADMIN_TOKEN_KEY,
  USER_NAME_KEY,
  USER_TOKEN_KEY,
  apiFetch,
} from '../utils/http';

interface Props {
  onNavigate: (view: ViewState) => void;
  setUserName: (name: string) => void;
  setUser: (user: User | null) => void;
}

const getUserId = (user: any) => String(user?.id ?? user?._id ?? user?.name ?? '');
const towerTriggerKey = (uid: string) => `tower_newcomer_welcome_trigger_${uid}`;
const towerSeenKey = (uid: string) => `tower_newcomer_welcome_seen_${uid}`;

export function LoginView({ onNavigate, setUserName, setUser }: Props) {
  const [step, setStep] = useState<'name' | 'password'>('name');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [tempUser, setTempUser] = useState<User | null>(null);

  const [adminOpen, setAdminOpen] = useState(false);
  const [adminCode, setAdminCode] = useState('');
  const [adminName, setAdminName] = useState('');
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminError, setAdminError] = useState('');

  const processUserEntry = async (user: User) => {
    const u = user as any;
    const uid = getUserId(u);

    setUserName(u.name);
    setUser(user);
    localStorage.setItem(USER_NAME_KEY, u.name || name.trim());

    if (u.status === 'approved') {
      const seen = uid ? localStorage.getItem(towerSeenKey(uid)) === '1' : false;
      if (!seen) {
        if (uid) sessionStorage.setItem(towerTriggerKey(uid), '1');
        onNavigate('TOWER_OF_LIFE');
      } else {
        onNavigate('GAME');
      }
      return;
    }

    if (u.status === 'pending') {
      onNavigate('PENDING');
      return;
    }

    if (u.status === 'rejected') {
      setError('你的身份资料未通过审核，请联系管理员重新提交。');
      return;
    }

    if (u.status === 'dead') {
      setError('该身份已死亡，请使用新的名字。');
      return;
    }

    onNavigate('GAME');
  };

  const fetchUserByName = async (rawName: string) => {
    try {
      const data = await apiFetch<any>(`/api/users/${encodeURIComponent(rawName)}`);
      return data?.user || null;
    } catch (e: any) {
      if (e?.status === 404) return null;
      throw e;
    }
  };

  const handleNameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    setError('');

    try {
      const user = await fetchUserByName(name.trim());

      if (user) {
        setTempUser(user as User);
        setStep('password');
      } else {
        await apiFetch('/api/users/init', {
          method: 'POST',
          body: { name: name.trim() },
        });
        setUserName(name.trim());
        localStorage.setItem(USER_NAME_KEY, name.trim());
        setError('未查询到你的资料，正在创建身份...');
        setTimeout(() => onNavigate('AGE_CHECK'), 1200);
      }
    } catch (e: any) {
      setError(e?.message || '请求失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    setError('');

    try {
      const loginData = await apiFetch<any>('/api/auth/login', {
        method: 'POST',
        body: { name: name.trim(), password },
      });
      if (!loginData?.success || !loginData?.token) {
        throw new Error(loginData?.message || '登录失败，请检查账号信息');
      }

      localStorage.setItem(USER_TOKEN_KEY, loginData.token);
      localStorage.setItem(USER_NAME_KEY, name.trim());

      const profileUser = (loginData.user as User | undefined) || (await fetchUserByName(name.trim())) || tempUser;
      if (profileUser) {
        await processUserEntry(profileUser);
        return;
      }
      setError('登录成功，但读取角色资料失败');
    } catch (err: any) {
      setError(err?.message || '请求失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  const submitAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminCode.trim() || !adminName.trim()) {
      setAdminError('请填写管理员入口码和名字');
      return;
    }

    setAdminLoading(true);
    setAdminError('');
    try {
      const data = await apiFetch<any>('/api/admin/auth/login', {
        method: 'POST',
        body: { entryCode: adminCode.trim(), adminName: adminName.trim() },
      });

      if (!data?.success || !data?.token) {
        throw new Error(data?.message || '管理员验证失败');
      }

      localStorage.setItem(ADMIN_TOKEN_KEY, data.token);
      localStorage.setItem(ADMIN_NAME_KEY, data.adminName || adminName.trim());
      setAdminOpen(false);
      onNavigate('ADMIN');
    } catch (e: any) {
      setAdminError(e?.message || '管理员登录失败');
    } finally {
      setAdminLoading(false);
    }
  };

  return (
    <div className="theme-shell login-shell min-h-screen flex items-center justify-center p-4 md:p-6">
      <AnimatePresence mode="wait">
        {step === 'name' ? (
          <motion.div
            key="nameStep"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="glass-card p-6 md:p-8 rounded-3xl w-full max-w-md text-center"
          >
            <h2 className="text-2xl md:text-3xl font-serif text-slate-800 mb-6 tracking-wider">你是谁？</h2>
            <form onSubmit={handleNameSubmit} className="space-y-4">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="输入你的名字"
                className="w-full px-4 py-3 border border-slate-200 rounded-xl bg-white/80 focus:outline-none focus:ring-2 focus:ring-sky-200 text-center text-lg"
                autoFocus
              />
              <button
                type="submit"
                disabled={loading || !name.trim()}
                className="w-full py-3 bg-sky-600 text-white rounded-xl font-bold hover:bg-sky-500 transition-colors disabled:opacity-50"
              >
                {loading ? '查询中...' : '确认'}
              </button>
            </form>

            {error && <p className="mt-4 text-sm text-red-500 font-bold">{error}</p>}
          </motion.div>
        ) : (
          <motion.div
            key="pwdStep"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass-card p-6 md:p-8 rounded-3xl w-full max-w-md text-center"
          >
            <h2 className="text-xl md:text-2xl font-bold text-slate-800 mb-2">安全验证</h2>
            <p className="text-xs text-slate-500 mb-6">
              账号 <b>{tempUser ? (tempUser as any).name : name}</b> 登录验证
            </p>

            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="请输入密码"
                className="w-full px-4 py-3 border border-slate-200 rounded-xl bg-white/80 focus:outline-none focus:ring-2 focus:ring-sky-200 text-center"
                autoFocus
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setStep('name');
                    setPassword('');
                    setError('');
                  }}
                  className="w-1/3 py-3 bg-slate-500/20 text-slate-700 rounded-xl font-bold hover:bg-slate-500/30"
                >
                  返回
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-3 bg-sky-600 text-white rounded-xl font-bold hover:bg-sky-500 disabled:opacity-50"
                >
                  {loading ? '登录中...' : '进入世界'}
                </button>
              </div>
            </form>

            {error && <p className="mt-4 text-sm text-red-500 font-bold">{error}</p>}
          </motion.div>
        )}
      </AnimatePresence>

      <button
        type="button"
        aria-label="管理员入口"
        title="管理员入口"
        onClick={() => {
          setAdminError('');
          setAdminOpen(true);
        }}
        className="fixed bottom-6 right-6 z-30 w-9 h-9 rounded-full glass-card flex items-center justify-center text-slate-500 hover:text-slate-700 hover:scale-105 transition-all opacity-65"
      >
        <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4">
          <circle cx="12" cy="12" r="2.1" fill="currentColor" />
          <ellipse cx="12" cy="5.2" rx="2.2" ry="3.3" fill="currentColor" opacity="0.85" />
          <ellipse cx="12" cy="18.8" rx="2.2" ry="3.3" fill="currentColor" opacity="0.85" />
          <ellipse cx="5.2" cy="12" rx="3.3" ry="2.2" fill="currentColor" opacity="0.85" />
          <ellipse cx="18.8" cy="12" rx="3.3" ry="2.2" fill="currentColor" opacity="0.85" />
          <ellipse cx="7.2" cy="7.2" rx="2.2" ry="1.8" transform="rotate(-45 7.2 7.2)" fill="currentColor" opacity="0.78" />
          <ellipse cx="16.8" cy="16.8" rx="2.2" ry="1.8" transform="rotate(-45 16.8 16.8)" fill="currentColor" opacity="0.78" />
          <ellipse cx="16.8" cy="7.2" rx="2.2" ry="1.8" transform="rotate(45 16.8 7.2)" fill="currentColor" opacity="0.78" />
          <ellipse cx="7.2" cy="16.8" rx="2.2" ry="1.8" transform="rotate(45 7.2 16.8)" fill="currentColor" opacity="0.78" />
        </svg>
      </button>

      <AnimatePresence>
        {adminOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/45 backdrop-blur-sm p-4"
          >
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.98 }}
              className="glass-card w-full max-w-md rounded-2xl p-6"
            >
              <h3 className="text-lg font-bold text-slate-800 mb-1">管理员登录</h3>
              <p className="text-xs text-slate-500 mb-4">请输入入口码和管理员名字</p>

              <form onSubmit={submitAdminLogin} className="space-y-3">
                <input
                  type="password"
                  value={adminCode}
                  onChange={(e) => setAdminCode(e.target.value)}
                  placeholder="管理员入口码"
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl bg-white/80 focus:outline-none focus:ring-2 focus:ring-sky-200"
                  autoFocus
                />
                <input
                  type="text"
                  value={adminName}
                  onChange={(e) => setAdminName(e.target.value)}
                  placeholder="管理员名字"
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl bg-white/80 focus:outline-none focus:ring-2 focus:ring-sky-200"
                />
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setAdminOpen(false)}
                    className="w-1/3 py-3 bg-slate-500/20 text-slate-700 rounded-xl font-bold hover:bg-slate-500/30"
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    disabled={adminLoading}
                    className="flex-1 py-3 bg-sky-600 text-white rounded-xl font-bold hover:bg-sky-500 disabled:opacity-60"
                  >
                    {adminLoading ? '验证中...' : '进入后台'}
                  </button>
                </div>
              </form>

              {adminError && <p className="mt-3 text-sm text-rose-500 font-bold">{adminError}</p>}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

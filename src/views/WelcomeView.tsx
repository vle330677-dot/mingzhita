import React, { useState } from 'react';
import { motion } from 'motion/react';
import { ViewState } from '../App';

interface Props {
  onNavigate: (view: ViewState) => void;
}

export function WelcomeView({ onNavigate }: Props) {
  const [showCodeInput, setShowCodeInput] = useState(false);
  const [code, setCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAdminLogin = async () => {
    const v = code.trim();
    if (!v || isSubmitting) return;
    const adminName = window.prompt('请输入管理员名字：', '')?.trim() || '';
    if (!adminName) return;

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/admin/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // 做多字段兼容，后端取其一即可
        body: JSON.stringify({
          entryCode: v,
          code: v,
          adminCode: v,
          password: v,
          adminName,
          name: adminName
        })
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || data.success === false) {
        setShowCodeInput(false);
        setCode('');
        return;
      }

      // 兼容后端返回格式
      if (data.token) localStorage.setItem('ADMIN_TOKEN', data.token);
      if (data.adminName) localStorage.setItem('ADMIN_NAME', data.adminName);
      if (data.name && !data.adminName) localStorage.setItem('ADMIN_NAME', data.name);

      onNavigate('ADMIN');
    } catch {
      setShowCodeInput(false);
      setCode('');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCodeSubmit = async (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      await handleAdminLogin();
    }
  };

  return (
    <div
      className="theme-shell login-shell relative flex items-center justify-center min-h-screen overflow-hidden cursor-pointer px-6"
      onClick={() => !showCodeInput && onNavigate('LOGIN')}
    >
      <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-30" viewBox="0 0 100 100" preserveAspectRatio="none">
        <motion.path
          d="M 0,50 Q 25,20 50,50 T 100,50"
          fill="none"
          stroke="currentColor"
          strokeWidth="0.55"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 5, ease: "easeInOut" }}
        />
        <motion.circle
          cx="50" cy="50" r="2"
          fill="none"
          stroke="currentColor"
          strokeWidth="0.55"
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 2, duration: 2 }}
        />

        {/* 手绘塔形线稿动画 */}
        <motion.path
          d="M 50 18 L 42 32 L 46 32 L 44 42 L 56 42 L 54 32 L 58 32 Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="0.65"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 0.9 }}
          transition={{ delay: 0.4, duration: 1.8, ease: "easeInOut" }}
        />
        <motion.path
          d="M 44 42 L 44 70 L 56 70 L 56 42"
          fill="none"
          stroke="currentColor"
          strokeWidth="0.65"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 0.9 }}
          transition={{ delay: 1.1, duration: 2.2, ease: "easeInOut" }}
        />
        <motion.path
          d="M 40 70 L 60 70 M 47 70 L 47 80 M 53 70 L 53 80 M 43 80 L 57 80"
          fill="none"
          stroke="currentColor"
          strokeWidth="0.65"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 0.85 }}
          transition={{ delay: 2.1, duration: 2.4, ease: "easeInOut" }}
        />
      </svg>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 2, delay: 1 }}
        className="z-10 text-center"
      >
        <h1 className="text-4xl md:text-6xl font-serif text-slate-800 tracking-[0.24em] font-light">
          欢迎来到命之塔
        </h1>
        <p className="mt-5 text-sm md:text-base text-slate-500 tracking-[0.18em]">触碰任意处，开始你的命运旅程</p>
      </motion.div>

      {/* Secret Flower UI */}
      <div
        className="absolute bottom-8 right-8 z-20"
        onClick={(e) => {
          e.stopPropagation();
          setShowCodeInput(true);
        }}
      >
        {!showCodeInput ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.68 }}
            whileHover={{ opacity: 1, scale: 1.1 }}
            className="w-9 h-9 rounded-full glass-card flex items-center justify-center cursor-pointer"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-4 h-4 text-slate-500">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z" />
            </svg>
          </motion.div>
        ) : (
          <motion.input
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 140, opacity: 1 }}
            type="password"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={handleCodeSubmit}
            placeholder={isSubmitting ? '登录中...' : '管理员入口码'}
            className="px-3 py-1.5 text-sm border border-slate-300 bg-white/70 rounded-lg outline-none focus:border-sky-500 text-slate-700"
            autoFocus
            disabled={isSubmitting}
            onBlur={() => !isSubmitting && setShowCodeInput(false)}
          />
        )}
      </div>
    </div>
  );
}

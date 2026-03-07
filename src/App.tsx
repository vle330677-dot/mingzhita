import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';

import { WelcomeView } from './views/WelcomeView';
import { LoginView } from './views/LoginView';
import { AgeCheckView } from './views/AgeCheckView';
import { ExtractorView } from './views/ExtractorView';
import { PendingView } from './views/PendingView';
import { GameView } from './views/GameView';
import { TowerOfLifeView } from './views/TowerOfLifeView';
import { AdminView } from './views/AdminView';

import { User } from './types';
import { apiFetch, clearUserSession, clearAdminSession } from './utils/http';
import { APP_TOAST_EVENT } from './utils/appEvents';
import { buildRealtimeStreamUrl, dispatchRealtimeEvent } from './utils/realtime';
import { hydrateUiTheme } from './utils/theme';

export type ViewState =
  | 'WELCOME'
  | 'LOGIN'
  | 'AGE_CHECK'
  | 'EXTRACTOR'
  | 'PENDING'
  | 'GAME'
  | 'TOWER_OF_LIFE'
  | 'ADMIN';

type ToastType = 'info' | 'success' | 'warn';

export default function App() {
  const [currentView, setCurrentView] = useState<ViewState>('WELCOME');
  const [userName, setUserName] = useState('');
  const [user, setUser] = useState<User | null>(null);

  // 管理员视图重挂载 key（管理员会话失效时强制重挂载）
  const [adminViewKey, setAdminViewKey] = useState(0);

  // 全局 Toast
  const [toast, setToast] = useState<{ msg: string; type: ToastType } | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const globalFetchInFlightRef = useRef<Promise<void> | null>(null);
  const globalFetchLastAtRef = useRef(0);

  const showToast = (msg: string, type: ToastType = 'info', duration = 3000) => {
    setToast({ msg, type });
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast(null), duration);
  };

  const fetchGlobalData = useCallback(async (force = false) => {
    const userNameValue = String(user?.name || '').trim();
    if (!userNameValue) return;

    const now = Date.now();
    if (!force) {
      if (globalFetchInFlightRef.current) return globalFetchInFlightRef.current;
      if (now - globalFetchLastAtRef.current < 1200) return;
    }

    globalFetchLastAtRef.current = now;
    const task = (async () => {
      try {
        const res = await fetch(`/api/users/${encodeURIComponent(userNameValue)}`);
        const data = await res.json();
        if (data.success) setUser(data.user);
      } catch (e) {
        console.error('fetchGlobalData failed', e);
      }
    })();

    globalFetchInFlightRef.current = task;
    try {
      await task;
    } finally {
      if (globalFetchInFlightRef.current === task) globalFetchInFlightRef.current = null;
      globalFetchLastAtRef.current = Date.now();
    }
  }, [user?.name]);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    };
  }, []);

  useEffect(() => {
    hydrateUiTheme();
  }, []);

  useEffect(() => {
    const currentUserId = Number(user?.id || 0);
    if (!currentUserId || typeof window === 'undefined' || typeof EventSource === 'undefined') return;

    let disposed = false;
    let source: EventSource | null = null;
    let retryTimer: number | null = null;

    const connect = () => {
      if (disposed) return;
      try {
        source = new EventSource(buildRealtimeStreamUrl(currentUserId));
        source.onmessage = (event) => {
          let detail: any = null;
          try {
            detail = event.data ? JSON.parse(event.data) : null;
          } catch {
            detail = null;
          }
          if (!detail?.event) return;

          dispatchRealtimeEvent(detail);

          if (detail.event === 'session.kicked') {
            window.dispatchEvent(new CustomEvent('auth:kicked', {
              detail: {
                message: detail.payload?.message || '\u8be5\u8d26\u53f7\u5df2\u5728\u5176\u4ed6\u8bbe\u5907\u767b\u5f55\uff0c\u4f60\u5df2\u88ab\u5f3a\u5236\u4e0b\u7ebf\u3002',
              },
            }));
            return;
          }

          if (detail.event === 'user.updated' && Number(detail.payload?.userId || 0) === currentUserId) {
            const fields = Array.isArray(detail.payload?.fields)
              ? detail.payload.fields.map((field: any) => String(field || ''))
              : [];
            const locationOnly = fields.length > 0 && fields.every((field: string) => field === 'currentLocation');
            if (!locationOnly) {
              void fetchGlobalData(true);
            }
          }
        };

        source.onerror = () => {
          if (source) {
            source.close();
            source = null;
          }
          if (disposed || retryTimer !== null) return;
          retryTimer = window.setTimeout(() => {
            retryTimer = null;
            connect();
          }, 3000);
        };
      } catch {
        if (disposed || retryTimer !== null) return;
        retryTimer = window.setTimeout(() => {
          retryTimer = null;
          connect();
        }, 3000);
      }
    };

    connect();
    return () => {
      disposed = true;
      if (retryTimer !== null) window.clearTimeout(retryTimer);
      if (source) source.close();
    };
  }, [user?.id, fetchGlobalData]);

  // 全局 app:toast 事件监听（任何组件可触发，无需修改 GameView props）
  useEffect(() => {
    const onAppToast = (e: Event) => {
      const ce = e as CustomEvent<{ msg: string; type?: ToastType; duration?: number }>;
      const msg = ce.detail?.msg;
      const type = ce.detail?.type || 'info';
      const duration = ce.detail?.duration ?? 3000;
      if (!msg) return;
      showToast(msg, type, duration);
    };

    window.addEventListener(APP_TOAST_EVENT, onAppToast as EventListener);
    return () => window.removeEventListener(APP_TOAST_EVENT, onAppToast as EventListener);
  }, []);

  // 全局认证事件监听（被顶号 / 管理员会话失效）
  useEffect(() => {
    const onKicked = (e: Event) => {
      const ce = e as CustomEvent<{ message?: string }>;
      const msg = ce?.detail?.message || '该账号已在其他设备登录，你已被强制下线。';
      clearUserSession();
      setUser(null);
      setUserName('');
      setCurrentView('LOGIN');
      showToast(msg, 'warn');
    };

    const onAdminExpired = (e: Event) => {
      const ce = e as CustomEvent<{ message?: string }>;
      const msg = ce?.detail?.message || '管理员会话已过期，请重新登录。';
      clearAdminSession();
      setAdminViewKey((v) => v + 1);
      setCurrentView('ADMIN');
      showToast(msg, 'warn');
    };

    window.addEventListener('auth:kicked', onKicked as EventListener);
    window.addEventListener('auth:admin_expired', onAdminExpired as EventListener);

    return () => {
      window.removeEventListener('auth:kicked', onKicked as EventListener);
      window.removeEventListener('auth:admin_expired', onAdminExpired as EventListener);
    };
  }, []);

  // PENDING 审核轮询
  useEffect(() => {
    if (userName && currentView === 'PENDING') {
      const interval = setInterval(async () => {
        try {
          const res = await fetch(`/api/users/${encodeURIComponent(userName)}`);
          const data = await res.json();
          if (data.success && data.user.status === 'approved') {
            setUser(data.user);

            // 标记“刚审核通过的新用户”，用于命之塔首次欢迎弹窗触发
            sessionStorage.setItem(`tower_newcomer_welcome_trigger_${data.user.id}`, '1');

            setCurrentView('TOWER_OF_LIFE');
            showToast('身份审核通过，欢迎来到命之塔！', 'success');
          }
        } catch (error) {
          console.error('Failed to fetch user status', error);
        }
      }, 1500);

      return () => clearInterval(interval);
    }
  }, [userName, currentView]);

  // GAME / TOWER_OF_LIFE 内定时同步用户信息
  useEffect(() => {
    if (user && (currentView === 'GAME' || currentView === 'TOWER_OF_LIFE')) {
      const timer = setInterval(async () => {
        if (typeof document !== 'undefined' && document.hidden) return;
        try {
          const res = await fetch(`/api/users/${encodeURIComponent((user as any).name)}`);
          const data = await res.json();
          if (data.success) setUser(data.user);
        } catch (e) {
          console.error('Sync failed', e);
        }
      }, 25000);

      return () => clearInterval(timer);
    }
  }, [user?.name, currentView]);

  useEffect(() => {
    if (!user?.id) return;
    const ping = async () => {
      try {
        await fetch('/api/presence/heartbeat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user.id })
        });
      } catch {
        // ignore
      }
    };
    ping();
    const timer = setInterval(ping, 25000);
    return () => clearInterval(timer);
  }, [user?.id, currentView]);

  useEffect(() => {
    const nativeFetch = window.fetch.bind(window);

    const wrappedFetch: typeof window.fetch = async (input, init) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      const method = String(init?.method || (typeof input === 'string' || input instanceof URL ? 'GET' : input.method || 'GET')).toUpperCase();
      const isTowerJoin = method === 'POST' && /\/api\/tower\/join(?:\?|$)/i.test(url);
      if (!isTowerJoin) return nativeFetch(input, init);

      const res = await nativeFetch(input, init);
      if (res.status !== 409) return res;

      let payload: any = null;
      try {
        payload = await res.clone().json();
      } catch {
        return res;
      }
      if (payload?.code !== 'MINOR_CONFIRM_REQUIRED') return res;

      let reqBody: any = {};
      try {
        reqBody = init?.body ? JSON.parse(String(init.body)) : {};
      } catch {
        reqBody = {};
      }

      const joinOtherFaction = window.confirm(
        '你尚未毕业。是否现在加入其他阵营？\n确定：按最低职级加入\n取消：前往伦敦塔就读'
      );

      const followBody = joinOtherFaction
        ? { ...reqBody, minorConfirm: true }
        : { ...reqBody, jobName: payload.suggestedJob || '\u4F26\u6566\u5854\u5B66\u5458' };

      return nativeFetch('/api/tower/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(followBody)
      });
    };

    window.fetch = wrappedFetch;
    return () => {
      window.fetch = nativeFetch;
    };
  }, []);


  const handleLogout = async () => {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST', auth: 'user' });
    } catch {
      // ignore
    }
    clearUserSession();
    setUser(null);
    setUserName('');
    setCurrentView('LOGIN');
    showToast('已断开连接', 'info');
  };

  return (
    <div className="theme-shell min-h-screen font-sans relative overflow-hidden">
      {/* 全局 Toast 渲染层 */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -50, x: '-50%' }}
            animate={{ opacity: 1, y: 20, x: '-50%' }}
            exit={{ opacity: 0, y: -20, x: '-50%' }}
            className={`fixed top-0 left-1/2 z-[10000] px-6 py-3 rounded-2xl shadow-2xl backdrop-blur-md border border-white/20 text-sm font-bold flex items-center gap-2
              ${
                toast.type === 'success'
                  ? 'bg-emerald-500/90 text-white'
                  : toast.type === 'warn'
                  ? 'bg-rose-500/90 text-white'
                  : 'bg-slate-900/90 text-white'
              }`}
          >
            {toast.type === 'success' && '🎉'}
            {toast.type === 'warn' && '⚠️'}
            {toast.type === 'info' && '💡'}
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* 视图渲染 */}
      {currentView === 'WELCOME' && <WelcomeView onNavigate={setCurrentView} />}

      {currentView === 'LOGIN' && (
        <LoginView onNavigate={setCurrentView} setUserName={setUserName} setUser={setUser} />
      )}

      {currentView === 'AGE_CHECK' && <AgeCheckView onNavigate={setCurrentView} userName={userName} />}

      {currentView === 'EXTRACTOR' && (
        <ExtractorView onNavigate={setCurrentView} userName={userName} />
      )}

      {currentView === 'PENDING' && <PendingView />}

      {currentView === 'TOWER_OF_LIFE' && user && (
        <TowerOfLifeView
          user={user}
          onExit={() => setCurrentView('GAME')}
          showToast={(msg) => showToast(msg)}
          fetchGlobalData={fetchGlobalData}
        />
      )}

      {currentView === 'GAME' && user && (
        <GameView
          user={user}
          onLogout={handleLogout}
          showToast={(msg) => showToast(msg)}
          fetchGlobalData={fetchGlobalData}
        />
      )}

      {currentView === 'ADMIN' && <AdminView key={adminViewKey} />}
    </div>
  );
}



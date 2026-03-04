import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Send, DoorOpen, Minimize2, Maximize2, Scale } from 'lucide-react';
import { User } from '../types';

interface Props {
  sessionId: string;
  currentUser: User;
  onClose: () => void; // 仅关闭窗口，不离开会话
}

interface RPMessage {
  id: number | string;
  sessionId: string;
  senderId: number | null;
  senderName: string;
  senderAvatar?: string | null;
  senderAvatarUpdatedAt?: string | null; // ✅ 新增：用于头像缓存版本
  content: string;
  type: 'user' | 'system' | 'text';
  createdAt: string;
}

interface RPSession {
  sessionId: string;
  userAId: number;
  userAName: string;
  userBId: number;
  userBName: string;
  locationId: string;
  locationName: string;
  status: 'active' | 'closed';
  createdAt: string | null;
  updatedAt: string | null;
}

const POS_KEY = 'rp_window_pos_v1';
const MIN_KEY = 'rp_window_min_v1';

// 可调尺寸
const EXPANDED_W = 420;
const EXPANDED_H = 460;
const MINI_W = 320;
const MINI_H = 52;
const MOBILE_PORTRAIT_QUERY = '(max-width: 767px) and (orientation: portrait)';

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function getDefaultPos(minimized: boolean) {
  const w = minimized ? MINI_W : EXPANDED_W;
  const h = minimized ? MINI_H : EXPANDED_H;
  return {
    x: Math.max(12, window.innerWidth - w - 16),
    y: Math.max(12, window.innerHeight - h - 96)
  };
}

// ✅ 统一头像地址解析 + 版本戳（破缓存）
function resolveAvatarSrc(raw: any, updatedAt?: any) {
  if (!raw || typeof raw !== 'string') return '';
  const s = raw.trim();
  if (!s) return '';

  let base = s;
  // 相对路径兜底
  if (!/^data:image\//.test(s) && !/^https?:\/\//.test(s) && !s.startsWith('/')) {
    base = `/${s.replace(/^\.?\//, '')}`;
  }

  // base64 不拼版本参数
  if (/^data:image\//.test(base)) return base;

  const v = updatedAt ? encodeURIComponent(String(updatedAt)) : '';
  if (!v) return base;
  return base.includes('?') ? `${base}&v=${v}` : `${base}?v=${v}`;
}

export function RoleplayWindow({ sessionId, currentUser, onClose }: Props) {
  const [session, setSession] = useState<RPSession | null>(null);
  const [messages, setMessages] = useState<RPMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [mediating, setMediating] = useState(false);
  const [hint, setHint] = useState('');
  const [minimized, setMinimized] = useState<boolean>(() => {
    try {
      return localStorage.getItem(MIN_KEY) === '1';
    } catch {
      return false;
    }
  });

  const [unread, setUnread] = useState(0);
  const [isPortraitMobile, setIsPortraitMobile] = useState(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
    return window.matchMedia(MOBILE_PORTRAIT_QUERY).matches;
  });
  const bottomRef = useRef<HTMLDivElement | null>(null);

  // 拖拽位置
  const [pos, setPos] = useState<{ x: number; y: number }>(() => {
    if (typeof window === 'undefined') return { x: 12, y: 12 };
    try {
      const raw = localStorage.getItem(POS_KEY);
      if (raw) {
        const p = JSON.parse(raw);
        if (typeof p?.x === 'number' && typeof p?.y === 'number') return p;
      }
    } catch {}
    return getDefaultPos(false);
  });

  const draggingRef = useRef(false);
  const dragOffsetRef = useRef({ dx: 0, dy: 0 });
  const prevMessagesRef = useRef<RPMessage[]>([]);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const media = window.matchMedia(MOBILE_PORTRAIT_QUERY);
    const onChange = (e: MediaQueryListEvent) => setIsPortraitMobile(e.matches);
    setIsPortraitMobile(media.matches);
    if (typeof media.addEventListener === 'function') {
      media.addEventListener('change', onChange);
      return () => media.removeEventListener('change', onChange);
    }
    media.addListener(onChange);
    return () => media.removeListener(onChange);
  }, []);

  const title = useMemo(() => {
    if (!session) return '对戏频道';
    return `${session.locationName || '未知地点'} · 对戏`;
  }, [session]);

  const panelW = minimized ? MINI_W : EXPANDED_W;
  const panelH = minimized ? MINI_H : EXPANDED_H;

  const fixPosToViewport = (next: { x: number; y: number }, w = panelW, h = panelH) => {
    const maxX = Math.max(8, window.innerWidth - w - 8);
    const maxY = Math.max(8, window.innerHeight - h - 8);
    return {
      x: clamp(next.x, 8, maxX),
      y: clamp(next.y, 8, maxY)
    };
  };

  const fetchSessionData = async (silent = false) => {
    try {
      if (!silent) setLoading(true);

      const res = await fetch(`/api/rp/session/${encodeURIComponent(sessionId)}/messages`);
      const data = await res.json();

      if (!res.ok || !data.success) {
        if (!silent) setHint(data?.message || '拉取会话失败');
        return;
      }

      const nextSession = data.session || null;
      const nextMessages: RPMessage[] = data.messages || [];

      // 未读统计：仅最小化时累计他人新消息
      const prev = prevMessagesRef.current;
      if (minimized && prev.length > 0 && nextMessages.length > prev.length) {
        const prevIds = new Set(prev.map((m) => String(m.id)));
        const newcomers = nextMessages.filter(
          (m) => !prevIds.has(String(m.id)) && m.senderId !== currentUser.id && m.type !== 'system'
        );
        if (newcomers.length > 0) setUnread((u) => u + newcomers.length);
      }

      prevMessagesRef.current = nextMessages;
      setSession(nextSession);
      setMessages(nextMessages);

      if (nextSession?.status === 'closed') {
        setHint('该对戏已结束并归档');
      }
    } catch {
      if (!silent) setHint('网络异常，拉取失败');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessionData(false);
    const timer = setInterval(() => fetchSessionData(true), 1200);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, minimized]);

  useEffect(() => {
    if (!minimized) {
      setUnread(0);
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [minimized, messages.length]);

  useEffect(() => {
    try {
      localStorage.setItem(MIN_KEY, minimized ? '1' : '0');
    } catch {}

    // 尺寸变化后自动修正位置
    setPos((p) => fixPosToViewport(p, minimized ? MINI_W : EXPANDED_W, minimized ? MINI_H : EXPANDED_H));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [minimized]);

  useEffect(() => {
    try {
      localStorage.setItem(POS_KEY, JSON.stringify(pos));
    } catch {}
  }, [pos]);

  useEffect(() => {
    const onResize = () => {
      setPos((p) => fixPosToViewport(p));
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panelW, panelH]);

  // 拖拽事件绑定
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!draggingRef.current) return;
      const nx = e.clientX - dragOffsetRef.current.dx;
      const ny = e.clientY - dragOffsetRef.current.dy;
      setPos(fixPosToViewport({ x: nx, y: ny }));
    };

    const onUp = () => {
      draggingRef.current = false;
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panelW, panelH]);

  const startDrag = (e: React.MouseEvent) => {
    if (isPortraitMobile) return;
    // 只允许鼠标左键拖动
    if (e.button !== 0) return;
    draggingRef.current = true;
    dragOffsetRef.current = {
      dx: e.clientX - pos.x,
      dy: e.clientY - pos.y
    };
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'grabbing';
  };

  const sendMessage = async () => {
    const content = input.trim();
    if (!content || sending) return;

    setSending(true);
    try {
      const res = await fetch(`/api/rp/session/${encodeURIComponent(sessionId)}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderId: currentUser.id,
          senderName: currentUser.name,
          content
        })
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || data.success === false) {
        setHint(data.message || '发送失败');
        return;
      }

      setInput('');
      await fetchSessionData(true);
    } catch {
      setHint('网络异常，发送失败');
    } finally {
      setSending(false);
    }
  };

  const handleLeave = async () => {
    if (leaving) return;
    setLeaving(true);

    try {
      const res = await fetch(`/api/rp/session/${encodeURIComponent(sessionId)}/leave`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser.id, userName: currentUser.name })
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || data.success === false) {
        setHint(data.message || '离开失败');
        return;
      }

      if (data.closed) setHint('双方均已离开，对戏已归档');
      else setHint('你已离开，等待对方离开后归档');

      await fetchSessionData(true);
    } catch {
      setHint('网络异常，离开失败');
    } finally {
      setLeaving(false);
    }
  };

  const handleMediationRequest = async () => {
    if (mediating) return;
    const reason = (window.prompt('请输入评理理由（可留空）', '') || '').trim();
    setMediating(true);
    try {
      const res = await fetch(`/api/rp/session/${encodeURIComponent(sessionId)}/mediate/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser.id,
          userName: currentUser.name,
          reason
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.success === false) {
        setHint(data.message || '发起评理失败');
        return;
      }
      setHint(data.message || '已发起评理请求');
      await fetchSessionData(true);
    } catch {
      setHint('网络异常，发起评理失败');
    } finally {
      setMediating(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      className={`fixed z-[260] bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden mobile-contrast-surface-dark mobile-portrait-safe-roleplay ${
        minimized ? 'mobile-portrait-safe-roleplay-min' : ''
      }`}
      style={{
        left: pos.x,
        top: pos.y,
        width: panelW,
        height: panelH
      }}
    >
      {/* 顶栏（可拖拽） */}
      <div
        onMouseDown={startDrag}
        className={`px-3 py-2 border-b border-slate-700 bg-slate-900/95 flex items-center justify-between ${
          isPortraitMobile ? 'cursor-default' : 'cursor-grab active:cursor-grabbing'
        }`}
      >
        <div className="min-w-0">
          <div className="text-[12px] text-white font-black truncate">{title}</div>
          {!minimized && <div className="text-[10px] text-slate-400 truncate">Session: {sessionId}</div>}
        </div>

        <div className="flex items-center gap-1 ml-2">
          <button
            onClick={handleMediationRequest}
            disabled={mediating || session?.status === 'closed'}
            className="p-1.5 rounded text-amber-300 hover:text-white hover:bg-amber-900/30 disabled:opacity-50"
            title="发起评理"
          >
            <Scale size={14} />
          </button>
          <button
            onClick={() => setMinimized((v) => !v)}
            className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-800"
            title={minimized ? '展开' : '缩小'}
          >
            {minimized ? <Maximize2 size={14} /> : <Minimize2 size={14} />}
          </button>
          <button
            onClick={handleLeave}
            disabled={leaving}
            className="p-1.5 rounded text-rose-300 hover:text-white hover:bg-rose-900/30 disabled:opacity-50"
            title="离开会话"
          >
            <DoorOpen size={14} />
          </button>
          <button
            onClick={onClose}
            className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-800"
            title="关闭窗口（不离开）"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* 最小化态 */}
      {minimized ? (
        <div className="h-[calc(100%-42px)] px-3 py-2 text-[11px] text-slate-400 flex items-center justify-between">
          <span className="truncate">窗口已缩小，点击“展开”继续聊天</span>
          {unread > 0 && (
            <span className="ml-2 shrink-0 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-black flex items-center justify-center">
              {unread > 99 ? '99+' : unread}
            </span>
          )}
        </div>
      ) : (
        <>
          {/* 消息区 */}
          <div className="h-[calc(100%-42px-84px)] overflow-y-auto p-3 space-y-2 bg-slate-950 custom-scrollbar">
            {loading ? (
              <div className="text-slate-500 text-xs">加载中...</div>
            ) : (
              <>
                {messages.length === 0 && (
                  <div className="text-slate-500 text-xs text-center py-6">还没有消息，开始第一句吧。</div>
                )}

                {messages.map((m) => {
                  const mine = m.senderId === currentUser.id;
                  const isSystem = m.type === 'system';

                  if (isSystem) {
                    return (
                      <div key={m.id} className="text-center text-[10px] text-slate-500">
                        —— {m.content} ——
                      </div>
                    );
                  }

                  const avatar = mine
                    ? resolveAvatarSrc(
                        (currentUser as any).avatarUrl,
                        (currentUser as any).avatarUpdatedAt
                      )
                    : resolveAvatarSrc(
                        m.senderAvatar,
                        (m as any).senderAvatarUpdatedAt
                      );

                  return (
                    <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                      <div className={`flex items-end gap-2 ${mine ? 'flex-row-reverse' : ''} max-w-[90%]`}>
                        <div className="w-7 h-7 rounded-full overflow-hidden border border-slate-600 shrink-0">
                          {avatar ? (
                            <img src={avatar} className="w-full h-full object-cover" alt={m.senderName || 'avatar'} />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-[10px] bg-slate-700 text-white font-black">
                              {(m.senderName || '?')[0]}
                            </div>
                          )}
                        </div>

                        <div
                          className={`rounded-lg p-2 border ${
                            mine
                              ? 'bg-sky-600/20 border-sky-500/30 text-sky-100'
                              : 'bg-slate-800 border-slate-700 text-slate-100'
                          }`}
                        >
                          <div className="text-[10px] opacity-70 mb-1">
                            {m.senderName} · {new Date(m.createdAt).toLocaleTimeString()}
                          </div>
                          <div className="text-xs whitespace-pre-wrap break-words">{m.content}</div>
                        </div>
                      </div>
                    </div>
                  );
                })}

                <div ref={bottomRef} />
              </>
            )}
          </div>

          {/* 输入区 */}
          <div className="h-[84px] p-2.5 border-t border-slate-700 bg-slate-900">
            <AnimatePresence>
              {hint && (
                <motion.div
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="text-[10px] text-amber-400 mb-1.5"
                >
                  {hint}
                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex gap-2">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="输入对戏内容..."
                className="flex-1 h-14 resize-none rounded-lg bg-slate-950 border border-slate-700 text-slate-100 p-2 text-xs outline-none focus:border-sky-500"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
              />
              <button
                onClick={sendMessage}
                disabled={sending || !input.trim()}
                className="px-3 rounded-lg bg-sky-600 text-white text-xs font-bold hover:bg-sky-500 disabled:opacity-50 flex items-center gap-1"
              >
                <Send size={12} />
                发送
              </button>
            </div>
          </div>
        </>
      )}
    </motion.div>
  );
}

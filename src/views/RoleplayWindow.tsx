import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { DoorOpen, Maximize2, Minimize2, Scale, Send, X } from 'lucide-react';
import { User } from '../types';

interface SessionTab {
  sessionId: string;
  peerName: string;
  locationName: string;
  status?: string;
}

interface Props {
  sessionId: string;
  currentUser: User;
  onClose: () => void;
  sessions?: SessionTab[];
  onSelectSession?: (sessionId: string) => void;
}

interface RPMessage {
  id: number | string;
  sessionId: string;
  senderId: number | null;
  senderName: string;
  senderAvatar?: string | null;
  senderAvatarUpdatedAt?: string | null;
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
  status: 'active' | 'closed' | 'mediating';
  createdAt: string | null;
  updatedAt: string | null;
  memberCount?: number;
  memberNames?: string[];
}

const POS_KEY = 'rp_window_pos_v3';
const MIN_KEY = 'rp_window_min_v3';
const EXPANDED_W = 430;
const EXPANDED_H = 500;
const MINI_W = 330;
const MINI_H = 58;
const MOBILE_PORTRAIT_QUERY = '(max-width: 767px) and (orientation: portrait)';
const isDocumentHidden = () => typeof document !== 'undefined' && document.hidden;

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function getDefaultPos(minimized: boolean) {
  const w = minimized ? MINI_W : EXPANDED_W;
  const h = minimized ? MINI_H : EXPANDED_H;
  return {
    x: Math.max(12, window.innerWidth - w - 16),
    y: Math.max(12, window.innerHeight - h - 96),
  };
}

function resolveAvatarSrc(raw: any, updatedAt?: any) {
  if (!raw || typeof raw !== 'string') return '';
  const s = raw.trim();
  if (!s) return '';

  let base = s;
  if (!/^data:image\//.test(s) && !/^https?:\/\//.test(s) && !s.startsWith('/')) {
    base = `/${s.replace(/^\.?\//, '')}`;
  }
  if (/^data:image\//.test(base)) return base;

  const version = updatedAt ? encodeURIComponent(String(updatedAt)) : '';
  if (!version) return base;
  return base.includes('?') ? `${base}&v=${version}` : `${base}?v=${version}`;
}

export function RoleplayWindow({ sessionId, currentUser, onClose, sessions = [], onSelectSession }: Props) {
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
  const [pos, setPos] = useState<{ x: number; y: number }>(() => {
    if (typeof window === 'undefined') return { x: 12, y: 12 };
    try {
      const raw = localStorage.getItem(POS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (typeof parsed?.x === 'number' && typeof parsed?.y === 'number') {
          return parsed;
        }
      }
    } catch {
      // ignore
    }
    return getDefaultPos(false);
  });

  const bottomRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef(false);
  const dragOffsetRef = useRef({ dx: 0, dy: 0 });
  const previousMessageIdsRef = useRef<string[]>([]);

  const activeTab = useMemo(
    () => sessions.find((item) => item.sessionId === sessionId) || sessions[0] || null,
    [sessions, sessionId]
  );

  const title = useMemo(() => {
    const peerName = activeTab?.peerName?.trim();
    const locationName = activeTab?.locationName?.trim() || session?.locationName || '未知地点';
    if (peerName) return `${peerName} · ${locationName}`;
    return `${locationName} · 对戏`;
  }, [activeTab, session]);

  const panelW = minimized ? MINI_W : EXPANDED_W;
  const panelH = minimized ? MINI_H : EXPANDED_H;

  const fixPosToViewport = (next: { x: number; y: number }, w = panelW, h = panelH) => {
    const maxX = Math.max(8, window.innerWidth - w - 8);
    const maxY = Math.max(8, window.innerHeight - h - 8);
    return {
      x: clamp(next.x, 8, maxX),
      y: clamp(next.y, 8, maxY),
    };
  };

  const fetchSessionData = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const res = await fetch(`/api/rp/session/${encodeURIComponent(sessionId)}/messages`, { cache: 'no-store' });
      const data = await res.json().catch(() => ({} as any));

      if (!res.ok || data.success === false) {
        if (res.status === 404) {
          setSession(null);
          setMessages([]);
          setHint('该对戏已结束或不可用。');
          return;
        }
        if (!silent) setHint(data?.message || '读取对戏失败');
        return;
      }

      const nextSession = (data.session || null) as RPSession | null;
      const nextMessages = Array.isArray(data.messages) ? (data.messages as RPMessage[]) : [];
      const nextIds = nextMessages.map((item) => String(item.id));

      if (minimized && previousMessageIdsRef.current.length > 0) {
        const known = new Set(previousMessageIdsRef.current);
        const incoming = nextMessages.filter(
          (item) => !known.has(String(item.id)) && item.senderId !== currentUser.id && item.type !== 'system'
        );
        if (incoming.length > 0) setUnread((value) => value + incoming.length);
      }

      previousMessageIdsRef.current = nextIds;
      setSession(nextSession);
      setMessages(nextMessages);
      if (!silent) setHint('');
    } catch {
      if (!silent) setHint('网络异常，读取对戏失败');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessionData(false);
    const timer = setInterval(() => {
      if (isDocumentHidden()) return;
      fetchSessionData(true);
    }, minimized ? 5000 : 3000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, minimized]);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const media = window.matchMedia(MOBILE_PORTRAIT_QUERY);
    const onChange = (event: MediaQueryListEvent) => setIsPortraitMobile(event.matches);
    setIsPortraitMobile(media.matches);
    if (typeof media.addEventListener === 'function') {
      media.addEventListener('change', onChange);
      return () => media.removeEventListener('change', onChange);
    }
    media.addListener(onChange);
    return () => media.removeListener(onChange);
  }, []);

  useEffect(() => {
    if (!minimized) {
      setUnread(0);
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length, minimized]);

  useEffect(() => {
    try {
      localStorage.setItem(MIN_KEY, minimized ? '1' : '0');
    } catch {
      // ignore
    }
    setPos((current) => fixPosToViewport(current, minimized ? MINI_W : EXPANDED_W, minimized ? MINI_H : EXPANDED_H));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [minimized]);

  useEffect(() => {
    try {
      localStorage.setItem(POS_KEY, JSON.stringify(pos));
    } catch {
      // ignore
    }
  }, [pos]);

  useEffect(() => {
    const onResize = () => setPos((current) => fixPosToViewport(current));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panelW, panelH]);

  useEffect(() => {
    const onMove = (event: MouseEvent) => {
      if (!draggingRef.current) return;
      const nextX = event.clientX - dragOffsetRef.current.dx;
      const nextY = event.clientY - dragOffsetRef.current.dy;
      setPos(fixPosToViewport({ x: nextX, y: nextY }));
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

  const startDrag = (event: React.MouseEvent<HTMLDivElement>) => {
    if (isPortraitMobile) return;
    const target = event.target as HTMLElement | null;
    if (target?.closest('button, textarea, input')) return;
    draggingRef.current = true;
    dragOffsetRef.current = {
      dx: event.clientX - pos.x,
      dy: event.clientY - pos.y,
    };
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'grabbing';
  };

  const sendMessage = async () => {
    const content = input.trim();
    if (!content || sending || session?.status === 'closed') return;
    setSending(true);
    try {
      const res = await fetch(`/api/rp/session/${encodeURIComponent(sessionId)}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser.id,
          userName: currentUser.name,
          content,
        }),
      });
      const data = await res.json().catch(() => ({} as any));
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
        body: JSON.stringify({ userId: currentUser.id, userName: currentUser.name }),
      });
      const data = await res.json().catch(() => ({} as any));
      if (!res.ok || data.success === false) {
        setHint(data.message || '离开失败');
        return;
      }
      setHint(data.closed ? '双方都已离开，对戏已归档。' : '你已离开该对戏，等待其他参与者离开后归档。');
      await fetchSessionData(true);
    } catch {
      setHint('网络异常，离开失败');
    } finally {
      setLeaving(false);
    }
  };

  const handleMediationRequest = async () => {
    if (mediating || session?.status === 'closed') return;
    const reason = (window.prompt('请输入评理理由（可留空）', '') || '').trim();
    setMediating(true);
    try {
      const res = await fetch(`/api/rp/session/${encodeURIComponent(sessionId)}/mediate/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser.id,
          userName: currentUser.name,
          reason,
        }),
      });
      const data = await res.json().catch(() => ({} as any));
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
      className={`fixed z-[260] theme-elevated-surface rounded-2xl shadow-2xl overflow-hidden mobile-contrast-surface-dark mobile-portrait-safe-roleplay ${
        minimized ? 'mobile-portrait-safe-roleplay-min' : ''
      }`}
      style={{
        left: pos.x,
        top: pos.y,
        width: panelW,
        height: panelH,
      }}
    >
      <div
        onMouseDown={startDrag}
        className={`px-3 py-2 border-b border-slate-700/70 theme-soft-surface flex items-center justify-between ${
          isPortraitMobile ? 'cursor-default' : 'cursor-grab active:cursor-grabbing'
        }`}
      >
        <div className="min-w-0">
          <div className="text-[12px] text-white font-black truncate">{title}</div>
          <div className="text-[10px] text-slate-400 truncate">
            {sessions.length > 1 ? `当前共 ${sessions.length} 场对戏` : `会话 ID: ${sessionId}`}
            {session?.status === 'mediating' ? ' · 评理中' : ''}
          </div>
        </div>

        <div className="flex items-center gap-1 ml-2 shrink-0">
          <button
            onClick={handleMediationRequest}
            disabled={mediating || session?.status === 'closed'}
            className="p-1.5 rounded text-amber-300 hover:text-white hover:bg-amber-900/30 disabled:opacity-50"
            title="发起评理"
          >
            <Scale size={14} />
          </button>
          <button
            onClick={() => setMinimized((value) => !value)}
            className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-800"
            title={minimized ? '展开' : '收起'}
          >
            {minimized ? <Maximize2 size={14} /> : <Minimize2 size={14} />}
          </button>
          <button
            onClick={handleLeave}
            disabled={leaving}
            className="p-1.5 rounded text-rose-300 hover:text-white hover:bg-rose-900/30 disabled:opacity-50"
            title="离开对戏"
          >
            <DoorOpen size={14} />
          </button>
          <button
            onClick={onClose}
            className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-800"
            title="关闭窗口"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {!minimized && sessions.length > 1 && (
        <div className="border-b border-slate-700/70 theme-soft-surface px-2 py-2 overflow-x-auto custom-scrollbar">
          <div className="flex gap-2 min-w-max">
            {sessions.map((item) => {
              const active = item.sessionId === sessionId;
              return (
                <button
                  key={item.sessionId}
                  onClick={() => onSelectSession?.(item.sessionId)}
                  className={`px-3 py-2 rounded-xl border text-left transition-all min-w-[132px] ${
                    active
                      ? 'bg-sky-600/20 border-sky-400/50 text-sky-100'
                      : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-500 hover:text-white'
                  }`}
                >
                  <div className="text-[11px] font-black truncate">{item.peerName || '对戏会话'}</div>
                  <div className="text-[10px] opacity-75 truncate">
                    {item.locationName || '未知地点'}
                    {item.status === 'mediating' ? ' · 评理中' : ''}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {minimized ? (
        <div className="h-[calc(100%-42px)] px-3 py-2 text-[11px] text-slate-400 flex items-center justify-between gap-2">
          <span className="truncate">
            {sessions.length > 1 ? '窗口已收起，展开后可切换不同对戏。' : '窗口已收起，展开后继续对戏。'}
          </span>
          {unread > 0 && (
            <span className="ml-2 shrink-0 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-black flex items-center justify-center">
              {unread > 99 ? '99+' : unread}
            </span>
          )}
        </div>
      ) : (
        <>
          <div className="h-[calc(100%-42px-92px)] overflow-y-auto p-3 space-y-2 bg-slate-950/60 custom-scrollbar">
            {loading ? (
              <div className="text-slate-500 text-xs">加载中...</div>
            ) : messages.length === 0 ? (
              <div className="text-slate-500 text-xs text-center py-6">还没有消息，先说第一句话吧。</div>
            ) : (
              messages.map((message) => {
                const mine = message.senderId === currentUser.id;
                const isSystem = message.type === 'system';

                if (isSystem) {
                  return (
                    <div key={message.id} className="text-center text-[10px] text-slate-500">
                      {message.content}
                    </div>
                  );
                }

                const avatar = mine
                  ? resolveAvatarSrc((currentUser as any).avatarUrl, (currentUser as any).avatarUpdatedAt)
                  : resolveAvatarSrc(message.senderAvatar, message.senderAvatarUpdatedAt);

                return (
                  <div key={message.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                    <div className={`flex items-end gap-2 ${mine ? 'flex-row-reverse' : ''} max-w-[90%]`}>
                      <div className="w-7 h-7 rounded-full overflow-hidden border border-slate-600 shrink-0 bg-slate-700">
                        {avatar ? (
                          <img src={avatar} className="w-full h-full object-cover" alt={message.senderName || 'avatar'} />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-[10px] text-white font-black">
                            {(message.senderName || '?')[0]}
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
                          {message.senderName} · {new Date(message.createdAt).toLocaleTimeString()}
                        </div>
                        <div className="text-xs whitespace-pre-wrap break-words leading-relaxed">{message.content}</div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={bottomRef} />
          </div>

          <div className="h-[92px] p-2.5 border-t border-slate-700/70 theme-soft-surface">
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
                onChange={(event) => setInput(event.target.value)}
                placeholder="输入对戏内容..."
                className="flex-1 h-14 resize-none rounded-lg bg-slate-950/60 border border-slate-700 text-slate-100 p-2 text-xs outline-none focus:border-sky-500"
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
                    event.preventDefault();
                    sendMessage();
                  }
                }}
              />
              <button
                onClick={sendMessage}
                disabled={sending || !input.trim() || session?.status === 'closed'}
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

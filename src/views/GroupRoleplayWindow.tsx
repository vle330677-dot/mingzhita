import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { DoorOpen, Maximize2, Minimize2, Send, Users, X } from 'lucide-react';
import { User } from '../types';

interface GroupMember {
  userId: number;
  userName: string;
  joinedAt: string;
  updatedAt: string;
}

interface GroupMessage {
  id: number | string;
  archiveId: string;
  senderId: number | null;
  senderName: string;
  senderAvatar?: string | null;
  senderAvatarUpdatedAt?: string | null;
  content: string;
  type: string;
  createdAt: string;
}

interface Props {
  currentUser: User;
  locationId: string;
  locationName: string;
  onClose: () => void;
  onLeave: (locationId: string) => Promise<void> | void;
}

const isDocumentHidden = () => typeof document !== 'undefined' && document.hidden;

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

export function GroupRoleplayWindow({ currentUser, locationId, locationName, onClose, onLeave }: Props) {
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [input, setInput] = useState('');
  const [hint, setHint] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const title = useMemo(() => `${locationName || '未知地点'} · 地区群戏`, [locationName]);

  const fetchSession = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const query = new URLSearchParams({
        userId: String(currentUser.id || 0),
        locationId: String(locationId || ''),
      });
      const res = await fetch(`/api/rp/group/session?${query.toString()}`, { cache: 'no-store' });
      const data = await res.json().catch(() => ({} as any));
      if (!res.ok || data.success === false) {
        if (!silent) setHint(data.message || '读取群戏失败');
        return;
      }

      if (!data.joined) {
        setHint('你已退出该地区群戏。');
        setMembers([]);
        setMessages([]);
        return;
      }

      setMembers(Array.isArray(data.members) ? data.members : []);
      setMessages(Array.isArray(data.messages) ? data.messages : []);
      if (!silent) setHint('');
    } catch {
      if (!silent) setHint('网络异常，读取群戏失败');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchSession(false);
    const timer = setInterval(() => {
      if (isDocumentHidden()) return;
      fetchSession(true);
    }, minimized ? 5000 : 3000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser.id, locationId, minimized]);

  useEffect(() => {
    if (!minimized) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, minimized]);

  const sendMessage = async () => {
    const content = input.trim();
    if (!content || sending) return;
    setSending(true);
    try {
      const res = await fetch('/api/rp/group/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser.id,
          userName: currentUser.name,
          locationId,
          locationName,
          content,
        }),
      });
      const data = await res.json().catch(() => ({} as any));
      if (!res.ok || data.success === false) {
        setHint(data.message || '发送失败');
        return;
      }
      setInput('');
      await fetchSession(true);
    } catch {
      setHint('网络异常，发送失败');
    } finally {
      setSending(false);
    }
  };

  const leaveNow = async () => {
    if (leaving) return;
    setLeaving(true);
    try {
      await onLeave(locationId);
      onClose();
    } finally {
      setLeaving(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 14 }}
      className={`fixed z-[255] left-3 right-3 md:left-auto md:w-[430px] md:right-[446px] ${
        minimized ? 'bottom-4' : 'bottom-4 md:bottom-6'
      } theme-elevated-surface rounded-2xl shadow-2xl overflow-hidden`}
    >
      <div className="px-3 py-2.5 border-b border-slate-700/70 theme-soft-surface flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[13px] font-black text-white truncate">{title}</div>
          <div className="text-[10px] text-slate-400 flex items-center gap-1">
            <Users size={11} />
            在线 {members.length}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => setMinimized((value) => !value)}
            className="p-1.5 rounded-md text-slate-300 hover:text-white hover:bg-slate-800"
            title={minimized ? '展开' : '收起'}
          >
            {minimized ? <Maximize2 size={14} /> : <Minimize2 size={14} />}
          </button>
          <button
            onClick={leaveNow}
            disabled={leaving}
            className="p-1.5 rounded-md text-amber-300 hover:text-amber-100 hover:bg-slate-800 disabled:opacity-60"
            title="退出群戏"
          >
            <DoorOpen size={14} />
          </button>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-slate-300 hover:text-white hover:bg-slate-800"
            title="关闭窗口"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {!minimized && (
        <>
          <div className="px-3 py-2 border-b border-slate-700/80">
            <div className="text-[10px] text-slate-400 truncate">
              {members.length > 0 ? members.map((member) => member.userName).join('、') : '当前暂无在线成员'}
            </div>
          </div>

          <div className="h-[320px] overflow-y-auto p-3 space-y-2 custom-scrollbar bg-slate-950/60">
            {loading ? (
              <div className="text-xs text-slate-500">读取群戏中...</div>
            ) : messages.length === 0 ? (
              <div className="text-xs text-slate-500">还没有群戏内容。</div>
            ) : (
              messages.map((message) => {
                const isSystem = String(message.type || '') === 'system';
                const mine = !isSystem && Number(message.senderId || 0) === Number(currentUser.id || 0);
                const avatar = resolveAvatarSrc(message.senderAvatar, message.senderAvatarUpdatedAt);
                return (
                  <div key={`${message.id}-${message.createdAt}`} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                    {isSystem ? (
                      <div className="px-2 py-1 rounded-lg bg-slate-800/80 border border-slate-700 text-[11px] text-slate-300">
                        {message.content}
                      </div>
                    ) : (
                      <div className={`max-w-[84%] rounded-xl px-3 py-2 border ${mine ? 'bg-sky-600/30 border-sky-500/40' : 'bg-slate-800 border-slate-700'}`}>
                        <div className="flex items-center gap-2 mb-1">
                          <div className="w-5 h-5 rounded-full overflow-hidden border border-slate-600 bg-slate-700 shrink-0">
                            {avatar ? (
                              <img src={avatar} className="w-full h-full object-cover" alt={message.senderName || 'avatar'} />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-[9px] text-white font-black">
                                {(message.senderName || '?')[0]}
                              </div>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-300">{message.senderName || '未知玩家'}</div>
                        </div>
                        <div className="text-xs text-slate-100 whitespace-pre-wrap break-words leading-relaxed">{message.content}</div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
            <div ref={bottomRef} />
          </div>

          <div className="p-3 border-t border-slate-700/70 theme-soft-surface">
            <div className="flex items-center gap-2">
              <input
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    sendMessage();
                  }
                }}
                placeholder="输入群戏内容..."
                className="flex-1 px-3 py-2 rounded-xl bg-slate-950/55 border border-slate-700 text-xs text-slate-100 outline-none focus:border-sky-500"
              />
              <button
                onClick={sendMessage}
                disabled={sending}
                className="px-3 py-2 rounded-xl bg-sky-600 text-white text-xs font-black hover:bg-sky-500 disabled:opacity-60 inline-flex items-center gap-1"
              >
                <Send size={12} />
                发送
              </button>
            </div>
            <AnimatePresence>
              {hint && (
                <motion.div
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 4 }}
                  className="text-[10px] text-amber-300 mt-2"
                >
                  {hint}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </>
      )}
    </motion.div>
  );
}

import React, { useEffect, useRef, useState } from 'react';
import { User } from '../types';

interface Props {
  user: User;
  showToast: (msg: string) => void;
  onEnterRun: (payload: { runId: string; gameId: number }) => void;
}

function parseJson(raw: any) {
  try {
    if (!raw) return {};
    if (typeof raw === 'object') return raw;
    return JSON.parse(String(raw));
  } catch {
    return {};
  }
}

function parseExtraFromAnnouncement(row: any) {
  const a = parseJson(row?.extraJson);
  const b = parseJson(row?.payload);
  return { ...a, ...b };
}

export function GlobalAnnouncementPrompt({ user, showToast, onEnterRun }: Props) {
  const [latest, setLatest] = useState<any>(null);
  const [visible, setVisible] = useState(false);
  const [voteStat, setVoteStat] = useState<any>(null);
  const seenRef = useRef<string>('');
  const handledActivePromptRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const hb = setInterval(() => {
      fetch('/api/presence/heartbeat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id })
      }).catch(() => {});
    }, 15000);

    return () => clearInterval(hb);
  }, [user.id]);

  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch('/api/announcements');
        const data = await res.json().catch(() => ({} as any));
        if (!data.success) return;

        const list = Array.isArray(data.announcements) ? data.announcements : [];
        const target = [...list].reverse().find((x: any) => x.type === 'vote_open' || x.type === 'game_start');
        if (!target) return;

        const nextId = String(target.id || '');
        if (!nextId || seenRef.current === nextId) return;

        seenRef.current = nextId;
        setLatest(target);
        setVisible(true);
        setVoteStat(null);
      } catch {
        // ignore
      }
    };

    poll();
    const t = setInterval(poll, 5000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!latest || latest.type !== 'vote_open') return;
    const extra = parseExtraFromAnnouncement(latest);
    const gameId = Number(extra.gameId || 0);
    if (!gameId) return;

    const pollVote = async () => {
      const res = await fetch(`/api/custom-games/${gameId}/vote/status`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('USER_TOKEN') || ''}`
        }
      });
      const data = await res.json().catch(() => ({} as any));
      if (res.ok) setVoteStat(data);
    };

    pollVote();
    const t = setInterval(pollVote, 3000);
    return () => clearInterval(t);
  }, [latest]);

  useEffect(() => {
    let alive = true;
    const pollActiveRun = async () => {
      try {
        const res = await fetch('/api/custom-games/run/active/global', {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('USER_TOKEN') || ''}`
          }
        });
        const data = await res.json().catch(() => ({} as any));
        if (!alive || !res.ok || !Boolean(data?.hasActive)) return;

        const gameId = Number(data?.gameId || 0);
        const runId = String(data?.runId || '');
        if (!gameId || !runId) return;

        const runKey = `${gameId}:${runId}`;
        if (handledActivePromptRef.current.has(runKey)) return;
        handledActivePromptRef.current.add(runKey);

        if (latest?.type === 'game_start') return;

        setLatest({
          id: `active-run-${runKey}`,
          type: 'game_start',
          title: String(data?.gameTitle || '灾厄游戏已开启'),
          content: `${String(data?.mapName || '创作者地图')} 正在运行中，是否进入由你自行决定。`,
          payload: { gameId, runId, mapName: String(data?.mapName || '') }
        });
        setVisible(true);
        setVoteStat(null);
      } catch {
        // ignore
      }
    };

    pollActiveRun();
    const t = setInterval(pollActiveRun, 8000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [latest?.type]);

  if (!visible || !latest) return null;

  const extra = parseExtraFromAnnouncement(latest);

  const renderVoteOpen = () => {
    const gameId = Number(extra.gameId || 0);
    if (!gameId) return <p className="text-sm text-rose-500">公告缺少游戏编号</p>;

    const castVote = async (vote: 'yes' | 'no') => {
      const res = await fetch(`/api/custom-games/${gameId}/vote/cast`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('USER_TOKEN') || ''}`
        },
        body: JSON.stringify({ userId: user.id, vote: vote === 'yes' ? 1 : 0 })
      });
      const data = await res.json().catch(() => ({} as any));
      if (!res.ok) {
        showToast(data.message || '投票失败');
        return;
      }
      showToast(vote === 'yes' ? '你已投票：同意' : '你已投票：反对');
    };

    return (
      <>
        <h3 className="text-xl font-black mb-2">{latest.title}</h3>
        <p className="text-sm text-slate-600 mb-3">{latest.content}</p>

        <div className="text-xs rounded bg-slate-50 p-3 mb-4">
          <div>同意票：{voteStat?.yesCount ?? '-'}</div>
          <div>反对票：{voteStat?.noCount ?? '-'}</div>
          <div>总票数：{voteStat?.total ?? '-'}</div>
          <div>我的票：{voteStat?.myVote === null || voteStat?.myVote === undefined ? '未投票' : voteStat?.myVote === 1 ? '同意' : '反对'}</div>
        </div>

        <div className="flex gap-2">
          <button className="flex-1 py-2 rounded bg-emerald-600 text-white font-bold" onClick={() => castVote('yes')}>
            同意进入
          </button>
          <button className="flex-1 py-2 rounded bg-rose-600 text-white font-bold" onClick={() => castVote('no')}>
            反对
          </button>
        </div>

        <button className="w-full mt-2 py-2 rounded bg-slate-200 font-bold" onClick={() => setVisible(false)}>
          关闭
        </button>
      </>
    );
  };

  const renderGameStart = () => {
    const runId = String(extra.runId || '');
    const gameId = Number(extra.gameId || 0);
    return (
      <>
        <h3 className="text-xl font-black mb-2">{latest.title}</h3>
        <p className="text-sm text-slate-600 mb-4">{latest.content}</p>
        <div className="rounded bg-slate-50 p-3 text-xs text-slate-600 mb-4">
          本次灾厄局不会自动把在线玩家拉入，是否加入由你自己决定。
        </div>
        <div className="flex gap-2">
          <button className="flex-1 py-2 rounded bg-slate-200 font-bold" onClick={() => setVisible(false)}>
            暂不进入
          </button>
          <button
            className="flex-1 py-2 rounded bg-rose-600 text-white font-bold"
            onClick={async () => {
              if (!runId) return showToast('运行编号缺失');
              if (!gameId) return showToast('游戏编号缺失');
              const res = await fetch(`/api/custom-games/${gameId}/run/join`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${localStorage.getItem('USER_TOKEN') || ''}`
                },
                body: JSON.stringify({ userId: user.id })
              });
              if (!res.ok) {
                const data = await res.json().catch(() => ({} as any));
                return showToast(data.message || '加入副本失败');
              }
              setVisible(false);
              onEnterRun({ runId, gameId });
            }}
          >
            进入灾厄地图
          </button>
        </div>
      </>
    );
  };

  return (
    <div className="fixed inset-0 z-[9998] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-6 max-w-md w-full">
        {latest.type === 'vote_open' ? renderVoteOpen() : renderGameStart()}
      </div>
    </div>
  );
}

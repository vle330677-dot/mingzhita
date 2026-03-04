import React, { useCallback, useEffect, useRef, useState } from 'react';
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
  const handledGameStartRef = useRef<Set<string>>(new Set());
  const handledRunSwitchRef = useRef<Set<string>>(new Set());

  const joinAndEnterRun = useCallback(
    async (gameId: number, runId: string, failMessage: string) => {
      try {
        const res = await fetch(`/api/custom-games/${gameId}/run/join`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('USER_TOKEN') || ''}`
          },
          body: JSON.stringify({ userId: user.id })
        });
        const data = await res.json().catch(() => ({} as any));
        if (!res.ok) {
          showToast(data.message || failMessage);
          return false;
        }
        showToast('灾厄降临了，已自动切换到创作者地图');
        setVisible(false);
        onEnterRun({ runId, gameId });
        return true;
      } catch {
        showToast('网络异常，自动切换失败，请手动进入');
        return false;
      }
    },
    [onEnterRun, showToast, user.id]
  );

  // 在线心跳（投票在线人数统计）
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

  // 拉公告（只关心 vote_open / game_start）
  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch('/api/announcements');
        const data = await res.json();
        if (!data.success) return;

        const list = Array.isArray(data.announcements) ? data.announcements : [];
        const target = [...list].reverse().find((x: any) => x.type === 'vote_open' || x.type === 'game_start');
        if (!target) return;

        if (seenRef.current !== target.id) {
          seenRef.current = target.id;
          setLatest(target);
          setVisible(true);
          setVoteStat(null);
        }
      } catch {
        // ignore
      }
    };

    poll();
    const t = setInterval(poll, 5000);
    return () => clearInterval(t);
  }, []);

  // 如果是投票公告，轮询票数
  useEffect(() => {
    if (!latest || latest.type !== 'vote_open') return;
    const extra = parseExtraFromAnnouncement(latest);
    const gameId = extra.gameId;
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
    if (!latest || latest.type !== 'game_start') return;

    const noticeId = String(latest.id || '');
    if (!noticeId) return;
    if (handledGameStartRef.current.has(noticeId)) return;
    handledGameStartRef.current.add(noticeId);

    const extra = parseExtraFromAnnouncement(latest);
    const runId = String(extra.runId || '');
    const gameId = Number(extra.gameId || 0);
    if (!runId || !gameId) return;
    const runKey = `${gameId}:${runId}`;
    if (handledRunSwitchRef.current.has(runKey)) return;
    handledRunSwitchRef.current.add(runKey);

    (async () => {
      const ok = await joinAndEnterRun(gameId, runId, '灾厄地图切换失败，请手动进入');
      if (!ok) {
        handledRunSwitchRef.current.delete(runKey);
      }
    })();
  }, [joinAndEnterRun, latest]);

  // 公告丢失兜底：只要存在运行中的灾厄局，在线玩家都会自动切到创作者地图
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
        if (!alive || !res.ok) return;
        if (!Boolean(data?.hasActive)) return;

        const gameId = Number(data?.gameId || 0);
        const runId = String(data?.runId || '');
        if (!gameId || !runId) return;

        const runKey = `${gameId}:${runId}`;
        if (handledRunSwitchRef.current.has(runKey)) return;
        handledRunSwitchRef.current.add(runKey);

        const ok = await joinAndEnterRun(gameId, runId, '灾厄地图切换失败，请手动进入');
        if (!ok) {
          handledRunSwitchRef.current.delete(runKey);
        }
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
  }, [joinAndEnterRun]);

  if (!visible || !latest) return null;

  const extra = parseExtraFromAnnouncement(latest);

  const renderVoteOpen = () => {
    const gameId = extra.gameId;
    if (!gameId) return <p className="text-sm text-rose-500">公告缺少 gameId</p>;

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
          <div>YES：{voteStat?.yesCount ?? '-'}</div>
          <div>NO：{voteStat?.noCount ?? '-'}</div>
          <div>总票：{voteStat?.total ?? '-'}</div>
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
    const runId = extra.runId;
    const gameId = extra.gameId;
    return (
      <>
        <h3 className="text-xl font-black mb-2">{latest.title}</h3>
        <p className="text-sm text-slate-600 mb-4">{latest.content}</p>
        <div className="flex gap-2">
          <button className="flex-1 py-2 rounded bg-slate-200 font-bold" onClick={() => setVisible(false)}>
            关闭
          </button>
          <button
            className="flex-1 py-2 rounded bg-rose-600 text-white font-bold"
            onClick={async () => {
              if (!runId) return showToast('runId 缺失');
              if (!gameId) return showToast('gameId 缺失');
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
              onEnterRun({ runId: String(runId), gameId: Number(gameId || 0) });
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

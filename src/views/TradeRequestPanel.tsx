import { AnimatePresence, motion } from 'motion/react';
import { Coins, Check, X } from 'lucide-react';

export interface TradeRequestRow {
  id: number;
  fromUserId: number;
  toUserId: number;
  fromUserName: string;
  status: string;
  sessionId?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface Props {
  requests: TradeRequestRow[];
  busyRequestId: number | null;
  onRespond: (requestId: number, accept: boolean) => void;
}

export function TradeRequestPanel({ requests, busyRequestId, onRespond }: Props) {
  if (!requests.length) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 16 }}
        className="fixed bottom-4 right-4 z-[225] w-[min(24rem,92vw)] space-y-3"
      >
        {requests.map((request) => {
          const busy = busyRequestId === Number(request.id || 0);
          return (
            <div
              key={request.id}
              className="theme-elevated-surface rounded-3xl border border-emerald-500/30 p-4 shadow-2xl backdrop-blur"
            >
              <div className="flex items-start gap-3">
                <div className="rounded-2xl bg-emerald-500/15 p-3 text-emerald-300">
                  <Coins size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-black text-white">交易请求</div>
                  <div className="mt-1 text-sm text-slate-300">
                    <span className="font-bold text-emerald-300">{request.fromUserName || `玩家#${request.fromUserId}`}</span>
                    {' '}希望与你开启交易窗口。
                  </div>
                  {request.createdAt && <div className="mt-1 text-[11px] text-slate-500">发送时间：{request.createdAt}</div>}
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2">
                <button
                  onClick={() => onRespond(request.id, true)}
                  disabled={busy}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-2.5 text-sm font-black text-white hover:bg-emerald-500 disabled:opacity-60"
                >
                  <Check size={14} />
                  {busy ? '处理中…' : '接受'}
                </button>
                <button
                  onClick={() => onRespond(request.id, false)}
                  disabled={busy}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-rose-700 px-4 py-2.5 text-sm font-black text-white hover:bg-rose-600 disabled:opacity-60"
                >
                  <X size={14} />
                  拒绝
                </button>
              </div>
            </div>
          );
        })}
      </motion.div>
    </AnimatePresence>
  );
}

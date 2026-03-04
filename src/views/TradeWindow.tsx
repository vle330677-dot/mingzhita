import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, CheckCircle2, XCircle, RefreshCw, Coins } from 'lucide-react';
import { User } from '../types';

interface Props {
  sessionId: string;
  currentUser: User;
  showToast: (msg: string) => void;
  onClose: () => void;
  fetchGlobalData: () => void;
}

interface TradeOffer {
  userId: number;
  itemName: string;
  qty: number;
  gold: number;
  updatedAt?: string;
}

interface TradeSession {
  sessionId: string;
  status: 'pending' | 'completed' | 'cancelled';
  userAId: number;
  userAName: string;
  userBId: number;
  userBName: string;
  confirmA: number;
  confirmB: number;
  cancelledBy: number;
  offerA: TradeOffer;
  offerB: TradeOffer;
}

interface InventoryItem {
  id: number;
  name: string;
  qty: number;
}

function offerText(offer?: TradeOffer | null) {
  if (!offer) return '空报价';
  const parts: string[] = [];
  if (offer.itemName && Number(offer.qty || 0) > 0) parts.push(`「${offer.itemName}」x${Number(offer.qty || 0)}`);
  if (Number(offer.gold || 0) > 0) parts.push(`${Number(offer.gold || 0)}G`);
  return parts.length ? parts.join(' + ') : '空报价';
}

export function TradeWindow({ sessionId, currentUser, showToast, onClose, fetchGlobalData }: Props) {
  const [session, setSession] = useState<TradeSession | null>(null);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState('');

  const [myItemName, setMyItemName] = useState('');
  const [myQty, setMyQty] = useState(0);
  const [myGold, setMyGold] = useState(0);
  const [offerDirty, setOfferDirty] = useState(false);

  const myId = Number(currentUser.id || 0);
  const isA = Number(session?.userAId || 0) === myId;
  const myOffer = isA ? session?.offerA : session?.offerB;
  const peerOffer = isA ? session?.offerB : session?.offerA;
  const myConfirmed = isA ? Number(session?.confirmA || 0) === 1 : Number(session?.confirmB || 0) === 1;
  const peerConfirmed = isA ? Number(session?.confirmB || 0) === 1 : Number(session?.confirmA || 0) === 1;
  const peerName = isA ? String(session?.userBName || '') : String(session?.userAName || '');

  const inventoryOptions = useMemo(() => {
    const map = new Map<string, number>();
    for (const x of inventory) {
      const n = String(x.name || '').trim();
      const q = Math.max(0, Number(x.qty || 0));
      if (!n || q <= 0) continue;
      map.set(n, (map.get(n) || 0) + q);
    }
    return Array.from(map.entries()).map(([name, qty]) => ({ name, qty }));
  }, [inventory]);

  const myItemMaxQty = useMemo(() => {
    if (!myItemName) return 0;
    return Math.max(0, Number(inventoryOptions.find((x) => x.name === myItemName)?.qty || 0));
  }, [inventoryOptions, myItemName]);

  const syncOfferDraft = () => {
    const nextItem = String(myOffer?.itemName || '');
    const nextQty = Math.max(0, Number(myOffer?.qty || 0));
    const nextGold = Math.max(0, Number(myOffer?.gold || 0));
    setMyItemName(nextItem);
    setMyQty(nextQty);
    setMyGold(nextGold);
    setOfferDirty(false);
  };

  const fetchInventory = async () => {
    try {
      const res = await fetch(`/api/users/${myId}/inventory`, { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.success === false) return;
      const rows = Array.isArray(data.items) ? data.items : [];
      setInventory(
        rows.map((x: any) => ({
          id: Number(x.id || 0),
          name: String(x.name || ''),
          qty: Math.max(0, Number(x.qty || 0))
        }))
      );
    } catch {
      // ignore
    }
  };

  const fetchSession = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const res = await fetch(`/api/trade/session/${encodeURIComponent(sessionId)}?userId=${myId}`, { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.success === false) {
        if (!silent) setHint(data.message || '读取交易会话失败');
        return;
      }

      const next = (data.session || null) as TradeSession | null;
      setSession(next);
      if (next && next.status !== 'pending') {
        setHint(next.status === 'completed' ? '交易已完成' : '交易已取消');
        fetchGlobalData();
        setTimeout(() => onClose(), 900);
        return;
      }
      if (!offerDirty) syncOfferDraft();
    } catch {
      if (!silent) setHint('网络异常，读取交易会话失败');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchInventory();
    fetchSession(false);
    const t1 = setInterval(() => fetchSession(true), 1400);
    const t2 = setInterval(fetchInventory, 4000);
    return () => {
      clearInterval(t1);
      clearInterval(t2);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, myId]);

  const updateOffer = async () => {
    if (busy || !session || session.status !== 'pending') return;
    setBusy(true);
    try {
      const itemName = String(myItemName || '').trim();
      const qty = itemName ? Math.max(0, Math.min(myItemMaxQty, Math.floor(Number(myQty || 0)))) : 0;
      const gold = Math.max(0, Math.floor(Number(myGold || 0)));
      const res = await fetch(`/api/trade/session/${encodeURIComponent(sessionId)}/offer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: myId,
          itemName,
          qty,
          gold
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.success === false) {
        showToast(data.message || '更新报价失败');
        return;
      }
      setHint(data.message || '报价已更新');
      await fetchSession(true);
      await fetchInventory();
    } catch {
      showToast('网络异常，更新报价失败');
    } finally {
      setBusy(false);
    }
  };

  const confirmTrade = async () => {
    if (busy || !session || session.status !== 'pending') return;
    setBusy(true);
    try {
      const res = await fetch(`/api/trade/session/${encodeURIComponent(sessionId)}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: myId, confirm: !myConfirmed })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.success === false) {
        showToast(data.message || '确认交易失败');
        return;
      }
      setHint(data.message || (!myConfirmed ? '你已确认交易' : '你已取消确认'));
      if (data.completed) {
        fetchGlobalData();
        showToast(data.message || '交易已完成');
        onClose();
        return;
      }
      await fetchSession(true);
      await fetchInventory();
    } catch {
      showToast('网络异常，确认交易失败');
    } finally {
      setBusy(false);
    }
  };

  const cancelTrade = async () => {
    if (busy || !session || session.status !== 'pending') return;
    if (!window.confirm('确定取消本次交易吗？')) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/trade/session/${encodeURIComponent(sessionId)}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: myId })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.success === false) {
        showToast(data.message || '取消交易失败');
        return;
      }
      showToast(data.message || '交易已取消');
      fetchGlobalData();
      onClose();
    } catch {
      showToast('网络异常，取消交易失败');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[230] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
      >
        <motion.div
          initial={{ y: 24, scale: 0.98, opacity: 0 }}
          animate={{ y: 0, scale: 1, opacity: 1 }}
          exit={{ y: 24, scale: 0.98, opacity: 0 }}
          className="w-full max-w-2xl rounded-3xl border border-slate-700 bg-slate-900 shadow-2xl overflow-hidden"
        >
          <div className="px-5 py-4 border-b border-slate-700 flex items-center justify-between">
            <div>
              <div className="text-sm font-black text-white">玩家交易窗口</div>
              <div className="text-[11px] text-slate-400">会话: {sessionId}</div>
            </div>
            <button onClick={onClose} className="p-2 rounded-full bg-slate-800 text-slate-300 hover:text-white">
              <X size={16} />
            </button>
          </div>

          <div className="p-4 md:p-5 space-y-4">
            {loading ? (
              <div className="text-center text-sm text-slate-400 py-10">加载交易数据中...</div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-sky-700/30 bg-sky-500/10 p-3">
                    <div className="text-xs font-black text-sky-200 mb-2">{session?.userAName || '玩家A'}</div>
                    <div className="text-[11px] text-slate-300">报价: {offerText(session?.offerA || null)}</div>
                    <div className={`mt-2 inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-full ${Number(session?.confirmA || 0) === 1 ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-700 text-slate-300'}`}>
                      {Number(session?.confirmA || 0) === 1 ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                      {Number(session?.confirmA || 0) === 1 ? '已确认' : '未确认'}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-violet-700/30 bg-violet-500/10 p-3">
                    <div className="text-xs font-black text-violet-200 mb-2">{session?.userBName || '玩家B'}</div>
                    <div className="text-[11px] text-slate-300">报价: {offerText(session?.offerB || null)}</div>
                    <div className={`mt-2 inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-full ${Number(session?.confirmB || 0) === 1 ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-700 text-slate-300'}`}>
                      {Number(session?.confirmB || 0) === 1 ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                      {Number(session?.confirmB || 0) === 1 ? '已确认' : '未确认'}
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-700 bg-slate-950 p-4">
                  <div className="text-xs font-black text-slate-200 mb-3">你的报价</div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-1">添加物品</label>
                      <select
                        value={myItemName}
                        onChange={(e) => {
                          setMyItemName(e.target.value);
                          setOfferDirty(true);
                          if (!e.target.value) setMyQty(0);
                          else if (myQty <= 0) setMyQty(1);
                        }}
                        className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 text-xs outline-none focus:border-sky-500"
                      >
                        <option value="">不添加物品</option>
                        {inventoryOptions.map((x) => (
                          <option key={x.name} value={x.name}>
                            {x.name} (持有 {x.qty})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-1">物品数量</label>
                      <input
                        type="number"
                        min={0}
                        max={myItemMaxQty}
                        value={myQty}
                        onChange={(e) => {
                          const v = Math.max(0, Math.floor(Number(e.target.value || 0)));
                          setMyQty(v);
                          setOfferDirty(true);
                        }}
                        className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 text-xs outline-none focus:border-sky-500"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-1">添加金额</label>
                      <div className="relative">
                        <Coins size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-amber-400" />
                        <input
                          type="number"
                          min={0}
                          value={myGold}
                          onChange={(e) => {
                            const v = Math.max(0, Math.floor(Number(e.target.value || 0)));
                            setMyGold(v);
                            setOfferDirty(true);
                          }}
                          className="w-full pl-7 p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 text-xs outline-none focus:border-sky-500"
                        />
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={updateOffer}
                    disabled={busy}
                    className="mt-3 w-full md:w-auto px-4 py-2 rounded-xl text-xs font-black bg-sky-600 text-white hover:bg-sky-500 disabled:opacity-60 inline-flex items-center gap-2"
                  >
                    <RefreshCw size={12} />
                    更新我的报价
                  </button>
                </div>

                {hint && (
                  <div className="text-xs text-amber-300 bg-amber-500/10 border border-amber-600/30 rounded-xl p-2.5">
                    {hint}
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={confirmTrade}
                    disabled={busy || !session || session.status !== 'pending'}
                    className="flex-1 py-3 rounded-2xl bg-emerald-600 text-white text-sm font-black hover:bg-emerald-500 disabled:opacity-60"
                  >
                    {myConfirmed ? '取消确认' : '确认交易'}
                  </button>
                  <button
                    onClick={cancelTrade}
                    disabled={busy || !session || session.status !== 'pending'}
                    className="flex-1 py-3 rounded-2xl bg-rose-700 text-white text-sm font-black hover:bg-rose-600 disabled:opacity-60"
                  >
                    取消交易
                  </button>
                </div>

                <div className="text-[11px] text-slate-500 text-center">
                  对方：{peerName || '未知玩家'} {peerConfirmed ? '已确认' : '未确认'}，双方确认后自动完成交易
                </div>
              </>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

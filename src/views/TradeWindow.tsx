import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, CheckCircle2, XCircle, RefreshCw, Coins, Sparkles } from 'lucide-react';
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

interface UserSkill {
  id: number;
  skillId: number;
  name: string;
  level: number;
  faction?: string;
  tier?: string;
}

type OfferMode = 'none' | 'item' | 'skill';

const TRADE_SKILL_PREFIX = '__skill__:';
const isDocumentHidden = () => typeof document !== 'undefined' && document.hidden;

function parseSkillOffer(itemName?: string) {
  const value = String(itemName || '').trim();
  if (!value.startsWith(TRADE_SKILL_PREFIX)) {
    return { isSkill: false, userSkillId: 0, skillName: '' };
  }
  const rest = value.slice(TRADE_SKILL_PREFIX.length);
  const sepIndex = rest.indexOf(':');
  if (sepIndex < 0) {
    return { isSkill: false, userSkillId: 0, skillName: '' };
  }
  return {
    isSkill: true,
    userSkillId: Math.max(0, Number(rest.slice(0, sepIndex) || 0)),
    skillName: rest.slice(sepIndex + 1).trim(),
  };
}

function formatOfferText(offer?: TradeOffer | null) {
  if (!offer) return '空报价';
  const parts: string[] = [];
  const parsed = parseSkillOffer(offer.itemName);
  if (parsed.isSkill) {
    parts.push(`技能「${parsed.skillName || '未知技能'}」`);
  } else if (offer.itemName && Number(offer.qty || 0) > 0) {
    parts.push(`「${offer.itemName}」x${Number(offer.qty || 0)}`);
  }
  if (Number(offer.gold || 0) > 0) {
    parts.push(`${Number(offer.gold || 0)}G`);
  }
  return parts.length ? parts.join(' + ') : '空报价';
}

export function TradeWindow({ sessionId, currentUser, showToast, onClose, fetchGlobalData }: Props) {
  const [session, setSession] = useState<TradeSession | null>(null);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [skills, setSkills] = useState<UserSkill[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState('');

  const [offerMode, setOfferMode] = useState<OfferMode>('none');
  const [myItemName, setMyItemName] = useState('');
  const [myQty, setMyQty] = useState(0);
  const [myGold, setMyGold] = useState(0);
  const [mySkillId, setMySkillId] = useState(0);
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
    for (const row of inventory) {
      const name = String(row.name || '').trim();
      const qty = Math.max(0, Number(row.qty || 0));
      if (!name || qty <= 0) continue;
      map.set(name, (map.get(name) || 0) + qty);
    }
    return Array.from(map.entries()).map(([name, qty]) => ({ name, qty }));
  }, [inventory]);

  const selectedItemMaxQty = useMemo(() => {
    if (!myItemName) return 0;
    return Math.max(0, Number(inventoryOptions.find((row) => row.name === myItemName)?.qty || 0));
  }, [inventoryOptions, myItemName]);

  const selectedSkill = useMemo(() => skills.find((row) => Number(row.id) === Number(mySkillId)) || null, [skills, mySkillId]);

  const syncOfferDraft = (nextOffer?: TradeOffer | null) => {
    const offer = nextOffer || null;
    const parsedSkill = parseSkillOffer(offer?.itemName || '');
    setMyGold(Math.max(0, Number(offer?.gold || 0)));
    if (parsedSkill.isSkill) {
      setOfferMode('skill');
      setMySkillId(parsedSkill.userSkillId);
      setMyItemName('');
      setMyQty(0);
    } else if (String(offer?.itemName || '').trim()) {
      setOfferMode('item');
      setMyItemName(String(offer?.itemName || ''));
      setMyQty(Math.max(0, Number(offer?.qty || 0)));
      setMySkillId(0);
    } else {
      setOfferMode('none');
      setMyItemName('');
      setMyQty(0);
      setMySkillId(0);
    }
    setOfferDirty(false);
  };

  const fetchInventory = async () => {
    try {
      const res = await fetch(`/api/users/${myId}/inventory`, { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.success === false) return;
      const rows = Array.isArray(data.items) ? data.items : [];
      setInventory(
        rows.map((row: any) => ({
          id: Number(row.id || 0),
          name: String(row.name || ''),
          qty: Math.max(0, Number(row.qty || 0)),
        }))
      );
    } catch {
      // ignore
    }
  };

  const fetchSkills = async () => {
    try {
      const res = await fetch(`/api/users/${myId}/skills`, { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.success === false) return;
      const rows = Array.isArray(data.skills) ? data.skills : [];
      setSkills(
        rows.map((row: any) => ({
          id: Number(row.id || 0),
          skillId: Number(row.skillId || 0),
          name: String(row.name || ''),
          level: Math.max(1, Number(row.level || 1)),
          faction: String(row.faction || ''),
          tier: String(row.tier || ''),
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
        window.setTimeout(() => onClose(), 900);
        return;
      }
      if (!offerDirty) {
        syncOfferDraft(next ? (isA ? next.offerA : next.offerB) : null);
      }
    } catch {
      if (!silent) setHint('网络异常，读取交易会话失败');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchInventory();
    fetchSkills();
    fetchSession(false);
    const sessionTimer = window.setInterval(() => {
      if (isDocumentHidden()) return;
      fetchSession(true);
    }, 3500);
    const bagTimer = window.setInterval(() => {
      if (isDocumentHidden()) return;
      fetchInventory();
    }, 7000);
    const skillTimer = window.setInterval(() => {
      if (isDocumentHidden()) return;
      fetchSkills();
    }, 8000);
    return () => {
      window.clearInterval(sessionTimer);
      window.clearInterval(bagTimer);
      window.clearInterval(skillTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, myId]);

  useEffect(() => {
    if (!offerDirty) {
      syncOfferDraft(myOffer || null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myOffer?.itemName, myOffer?.qty, myOffer?.gold]);

  const updateOffer = async () => {
    if (busy || !session || session.status !== 'pending') return;
    setBusy(true);
    try {
      const gold = Math.max(0, Math.floor(Number(myGold || 0)));
      const body: Record<string, any> = { userId: myId, gold };

      if (offerMode === 'item') {
        const itemName = String(myItemName || '').trim();
        const qty = itemName ? Math.max(0, Math.min(selectedItemMaxQty, Math.floor(Number(myQty || 0)))) : 0;
        body.itemName = itemName;
        body.qty = qty;
      } else if (offerMode === 'skill') {
        body.userSkillId = Math.max(0, Number(mySkillId || 0));
      } else {
        body.itemName = '';
        body.qty = 0;
      }

      const res = await fetch(`/api/trade/session/${encodeURIComponent(sessionId)}/offer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.success === false) {
        showToast(data.message || '更新报价失败');
        return;
      }
      setHint(data.message || '报价已更新');
      setOfferDirty(false);
      await fetchSession(true);
      await fetchInventory();
      await fetchSkills();
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
        body: JSON.stringify({ userId: myId, confirm: !myConfirmed }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.success === false) {
        showToast(data.message || '确认交易失败');
        return;
      }
      setHint(data.message || (myConfirmed ? '你已取消确认' : '你已确认交易'));
      if (data.completed) {
        fetchGlobalData();
        showToast(data.message || '交易已完成');
        onClose();
        return;
      }
      await fetchSession(true);
      await fetchInventory();
      await fetchSkills();
    } catch {
      showToast('网络异常，确认交易失败');
    } finally {
      setBusy(false);
    }
  };

  const cancelTrade = async () => {
    if (busy || !session || session.status !== 'pending') return;
    setBusy(true);
    try {
      const res = await fetch(`/api/trade/session/${encodeURIComponent(sessionId)}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: myId }),
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
        className="fixed inset-0 z-[230] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      >
        <motion.div
          initial={{ y: 24, scale: 0.98, opacity: 0 }}
          animate={{ y: 0, scale: 1, opacity: 1 }}
          exit={{ y: 24, scale: 0.98, opacity: 0 }}
          className="theme-elevated-surface w-full max-w-3xl overflow-hidden rounded-3xl border shadow-2xl"
        >
          <div className="flex items-center justify-between border-b border-slate-700/70 px-5 py-4 theme-soft-surface">
            <div>
              <div className="text-sm font-black text-white">玩家交易窗口</div>
              <div className="text-[11px] text-slate-400">会话: {sessionId}</div>
            </div>
            <button onClick={onClose} className="rounded-full bg-slate-800 p-2 text-slate-300 hover:text-white">
              <X size={16} />
            </button>
          </div>

          <div className="space-y-4 p-4 md:p-5">
            {loading ? (
              <div className="py-10 text-center text-sm text-slate-400">正在加载交易数据…</div>
            ) : (
              <>
                <div className="grid gap-3 md:grid-cols-2">
                  <TradeSummaryCard
                    title={session?.userAName || '玩家A'}
                    accent="sky"
                    offerText={formatOfferText(session?.offerA || null)}
                    confirmed={Number(session?.confirmA || 0) === 1}
                  />
                  <TradeSummaryCard
                    title={session?.userBName || '玩家B'}
                    accent="violet"
                    offerText={formatOfferText(session?.offerB || null)}
                    confirmed={Number(session?.confirmB || 0) === 1}
                  />
                </div>

                <div className="rounded-3xl border border-slate-700 bg-slate-950/55 p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-black text-white">你的报价</div>
                      <div className="text-[11px] text-slate-400">一次报价只能选择“物品”或“技能”其中一种，可以额外附带金币。</div>
                    </div>
                    <div className="rounded-full border border-slate-700 bg-slate-950/45 px-3 py-1 text-[11px] text-slate-300">
                      当前对方: {peerName || '未知玩家'} {peerConfirmed ? '已确认' : '未确认'}
                    </div>
                  </div>

                  <div className="mb-4 flex flex-wrap gap-2">
                    <ModeButton active={offerMode === 'none'} onClick={() => { setOfferMode('none'); setMyItemName(''); setMyQty(0); setMySkillId(0); setOfferDirty(true); }}>
                      仅金币
                    </ModeButton>
                    <ModeButton active={offerMode === 'item'} onClick={() => { setOfferMode('item'); setMySkillId(0); if (!myQty) setMyQty(1); setOfferDirty(true); }}>
                      物品
                    </ModeButton>
                    <ModeButton active={offerMode === 'skill'} onClick={() => { setOfferMode('skill'); setMyItemName(''); setMyQty(0); setOfferDirty(true); }}>
                      技能
                    </ModeButton>
                  </div>

                  {offerMode === 'item' && (
                    <div className="grid gap-3 md:grid-cols-2">
                      <label className="block text-xs font-black text-slate-400">
                        <span className="mb-1.5 block">选择物品</span>
                        <select
                          value={myItemName}
                          onChange={(e) => {
                            setMyItemName(e.target.value);
                            setOfferDirty(true);
                            if (e.target.value && myQty <= 0) setMyQty(1);
                            if (!e.target.value) setMyQty(0);
                          }}
                          className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-sky-500"
                        >
                          <option value="">不放入物品</option>
                          {inventoryOptions.map((row) => (
                            <option key={row.name} value={row.name}>
                              {row.name}（持有 {row.qty}）
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="block text-xs font-black text-slate-400">
                        <span className="mb-1.5 block">数量</span>
                        <input
                          type="number"
                          min={0}
                          max={selectedItemMaxQty}
                          value={myQty}
                          onChange={(e) => {
                            setMyQty(Math.max(0, Math.floor(Number(e.target.value || 0))));
                            setOfferDirty(true);
                          }}
                          className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-sky-500"
                        />
                      </label>
                    </div>
                  )}

                  {offerMode === 'skill' && (
                    <label className="block text-xs font-black text-slate-400">
                      <span className="mb-1.5 block">选择技能</span>
                      <select
                        value={mySkillId}
                        onChange={(e) => {
                          setMySkillId(Math.max(0, Number(e.target.value || 0)));
                          setOfferDirty(true);
                        }}
                        className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-sky-500"
                      >
                        <option value={0}>不放入技能</option>
                        {skills.map((row) => (
                          <option key={row.id} value={row.id}>
                            {row.name} · Lv.{row.level} {row.faction ? `· ${row.faction}` : ''}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}

                  {offerMode === 'skill' && selectedSkill && (
                    <div className="mt-3 rounded-2xl border border-fuchsia-500/30 bg-fuchsia-500/10 p-3 text-xs text-fuchsia-100">
                      <div className="flex items-center gap-2 font-black">
                        <Sparkles size={14} />
                        {selectedSkill.name}
                      </div>
                      <div className="mt-1 text-fuchsia-200/80">
                        Lv.{selectedSkill.level}
                        {selectedSkill.faction ? ` · ${selectedSkill.faction}` : ''}
                        {selectedSkill.tier ? ` · ${selectedSkill.tier}` : ''}
                      </div>
                    </div>
                  )}

                  <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_220px] md:items-end">
                    <div className="rounded-2xl border border-slate-700 bg-slate-950/45 p-3 text-xs text-slate-300">
                      当前报价预览：{formatOfferText({ userId: myId, itemName: offerMode === 'skill' && selectedSkill ? `${TRADE_SKILL_PREFIX}${selectedSkill.id}:${selectedSkill.name}` : offerMode === 'item' ? myItemName : '', qty: offerMode === 'item' ? myQty : 0, gold: myGold })}
                    </div>
                    <label className="block text-xs font-black text-slate-400">
                      <span className="mb-1.5 block">附带金币</span>
                      <div className="relative">
                        <Coins size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-amber-400" />
                        <input
                          type="number"
                          min={0}
                          value={myGold}
                          onChange={(e) => {
                            setMyGold(Math.max(0, Math.floor(Number(e.target.value || 0))));
                            setOfferDirty(true);
                          }}
                          className="w-full rounded-2xl border border-slate-700 bg-slate-900 py-2.5 pl-8 pr-3 text-sm text-slate-100 outline-none focus:border-sky-500"
                        />
                      </div>
                    </label>
                  </div>

                  <button
                    onClick={updateOffer}
                    disabled={busy}
                    className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-sky-600 px-4 py-2.5 text-sm font-black text-white hover:bg-sky-500 disabled:opacity-60"
                  >
                    <RefreshCw size={14} />
                    更新我的报价
                  </button>
                </div>

                <div className="grid gap-2 md:grid-cols-2">
                  <div className="rounded-2xl border border-slate-700 bg-slate-950/55 p-4 text-sm text-slate-300">
                    <div className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">我的状态</div>
                    <div className={`mt-2 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-black ${myConfirmed ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-800 text-slate-300'}`}>
                      {myConfirmed ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                      {myConfirmed ? '已确认交易' : '尚未确认'}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-slate-700 bg-slate-950/55 p-4 text-sm text-slate-300">
                    <div className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">对方报价</div>
                    <div className="mt-2 leading-6">{formatOfferText(peerOffer || null)}</div>
                  </div>
                </div>

                {hint && (
                  <div className="rounded-2xl border border-amber-600/30 bg-amber-500/10 p-3 text-xs text-amber-300">
                    {hint}
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={confirmTrade}
                    disabled={busy || !session || session.status !== 'pending'}
                    className="flex-1 rounded-2xl bg-emerald-600 py-3 text-sm font-black text-white hover:bg-emerald-500 disabled:opacity-60"
                  >
                    {myConfirmed ? '取消确认' : '确认交易'}
                  </button>
                  <button
                    onClick={cancelTrade}
                    disabled={busy || !session || session.status !== 'pending'}
                    className="flex-1 rounded-2xl bg-rose-700 py-3 text-sm font-black text-white hover:bg-rose-600 disabled:opacity-60"
                  >
                    取消交易
                  </button>
                </div>
              </>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function TradeSummaryCard({
  title,
  accent,
  offerText,
  confirmed,
}: {
  title: string;
  accent: 'sky' | 'violet';
  offerText: string;
  confirmed: boolean;
}) {
  const cardClass = accent === 'sky' ? 'border-sky-700/30 bg-sky-500/10' : 'border-violet-700/30 bg-violet-500/10';
  const titleClass = accent === 'sky' ? 'text-sky-200' : 'text-violet-200';
  return (
    <div className={`rounded-2xl border p-3 ${cardClass}`}>
      <div className={`mb-2 text-xs font-black ${titleClass}`}>{title}</div>
      <div className="text-[11px] leading-6 text-slate-300">报价: {offerText}</div>
      <div className={`mt-2 inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] ${confirmed ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-700 text-slate-300'}`}>
        {confirmed ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
        {confirmed ? '已确认' : '未确认'}
      </div>
    </div>
  );
}

function ModeButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-xs font-black transition-colors ${active ? 'bg-sky-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
    >
      {children}
    </button>
  );
}


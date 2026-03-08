import React, { useCallback, useEffect, useMemo, useState } from "react";

type UserLite = {
  id: number;
  username?: string;
  nickname?: string;
  isAdmin?: boolean;
};

type RunPlayer = {
  userId: number;
  name: string;
  hp?: number;
  energy?: number;
  score?: number;
  alive?: boolean;
};

type RunEvent = {
  id: number;
  ts: string;
  type: string;
  message: string;
  actorUserId?: number;
};

type RankItem = {
  userId: number;
  name: string;
  score: number;
  rank?: number;
};

type StageConfigItem = {
  index: number;
  name: string;
  desc?: string;
};

type RunState = {
  runId: number;
  gameId: number;
  status: "running" | "ended" | "pending";
  currentStage: number;
  totalStages: number;
  stageName?: string;
  stageDesc?: string;
  stageConfigs?: StageConfigItem[];
  mapConfig?: any;
  players: RunPlayer[];
  events: RunEvent[];
  myScore?: number;
  myHp?: number;
  myEnergy?: number;
  isJoined?: boolean;
  // 后端可返回权限标识；没有就走前端兜底
  canControl?: boolean;
  creatorUserId?: number;
  worldDataMode?: "isolated" | "not_joined";
  worldSnapshotCapturedAt?: string | null;
  returnedAt?: string | null;
};

type Settlement = {
  runId: number;
  endedAt: string;
  result?: string;
  rank: RankItem[];
  gain?: {
    exp?: number;
    points?: number;
    title?: string;
  };
};

type Props = {
  gameId: number;
  currentUser: UserLite;
  onExit?: () => void; // 回归原世界
  className?: string;
};

const API_BASE = "/api/custom-games";

async function api<T = any>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
    ...init,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }

  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) {
    return res.json();
  }
  return (await res.text()) as any;
}

function safeJsonParse(input: string): { ok: true; value: any } | { ok: false; err: string } {
  try {
    return { ok: true, value: JSON.parse(input) };
  } catch (e: any) {
    return { ok: false, err: e?.message || "配置文本解析失败" };
  }
}

const RUN_STATUS_LABEL: Record<string, string> = {
  running: '进行中',
  ended: '已结束',
  pending: '待开始'
};

const toRunStatusLabel = (status: string) => RUN_STATUS_LABEL[status] || status;

const CustomGameRunView: React.FC<Props> = ({ gameId, currentUser, onExit, className }) => {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string>("");

  const [runState, setRunState] = useState<RunState | null>(null);
  const [rank, setRank] = useState<RankItem[]>([]);
  const [settlement, setSettlement] = useState<Settlement | null>(null);

  // 玩家动作
  const [customAction, setCustomAction] = useState("");

  // 导演台：阶段配置
  const [cfgTotalStages, setCfgTotalStages] = useState<number>(3);
  const [cfgStages, setCfgStages] = useState<StageConfigItem[]>([
    { index: 1, name: "阶段一", desc: "" },
    { index: 2, name: "阶段二", desc: "" },
    { index: 3, name: "阶段三", desc: "" },
  ]);

  // 导演台：运行中改图
  const [mapPatchText, setMapPatchText] = useState<string>('{\n  "rules": {},\n  "points": []\n}');

  // 导演台：阶段发分
  const [grantUserId, setGrantUserId] = useState<number>(0);
  const [grantPoints, setGrantPoints] = useState<number>(10);
  const [grantReason, setGrantReason] = useState<string>("阶段奖励");

  const canControl = useMemo(() => {
    if (!runState) return false;
    if (runState.canControl) return true;
    if (currentUser.isAdmin) return true;
    if (runState.creatorUserId && runState.creatorUserId === currentUser.id) return true;
    return false;
  }, [runState, currentUser]);

  const fetchActiveAndState = useCallback(async () => {
    setErr("");
    // 1) 查 active run
    const active = await api<{ runId?: number; hasActive: boolean }>(
      `${API_BASE}/${gameId}/run/active`,
      { method: "GET" }
    );

    if (!active?.hasActive || !active?.runId) {
      setRunState(null);
      setRank([]);
      setSettlement(null);
      return;
    }

    // 2) 查状态
    const state = await api<RunState>(`${API_BASE}/${gameId}/run/state`, { method: "GET" });
    setRunState(state);

    // 3) 查排行榜
    const rankData = await api<RankItem[]>(`${API_BASE}/${gameId}/run/rank`, { method: "GET" });
    setRank(rankData || []);

    // 如果已结束，拉结算
    if (state.status === "ended") {
      const endData = await api<Settlement>(`${API_BASE}/${gameId}/run/end`, { method: "GET" });
      setSettlement(endData);
    }
  }, [gameId]);

  const joinRun = useCallback(async () => {
    setBusy(true);
    setErr("");
    try {
      await api(`${API_BASE}/${gameId}/run/join`, { method: "POST" });
      await fetchActiveAndState();
    } catch (e: any) {
      setErr(e?.message || "加入副本失败");
    } finally {
      setBusy(false);
    }
  }, [gameId, fetchActiveAndState]);

  const doAction = useCallback(
    async (actionType: string, payload: any = {}) => {
      setBusy(true);
      setErr("");
      try {
        await api(`${API_BASE}/${gameId}/run/action`, {
          method: "POST",
          body: JSON.stringify({ actionType, payload }),
        });
        await fetchActiveAndState();
      } catch (e: any) {
        setErr(e?.message || "动作提交失败");
      } finally {
        setBusy(false);
      }
    },
    [gameId, fetchActiveAndState]
  );

  const submitStageConfig = useCallback(async () => {
    if (!canControl) return;
    setBusy(true);
    setErr("");
    try {
      await api(`${API_BASE}/${gameId}/run/stages/config`, {
        method: "POST",
        body: JSON.stringify({
          totalStages: cfgTotalStages,
          stages: cfgStages,
        }),
      });
      await fetchActiveAndState();
    } catch (e: any) {
      setErr(e?.message || "阶段配置失败");
    } finally {
      setBusy(false);
    }
  }, [canControl, gameId, cfgTotalStages, cfgStages, fetchActiveAndState]);

  const nextStage = useCallback(async () => {
    if (!canControl) return;
    setBusy(true);
    setErr("");
    try {
      await api(`${API_BASE}/${gameId}/run/stages/next`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      await fetchActiveAndState();
    } catch (e: any) {
      setErr(e?.message || "推进阶段失败");
    } finally {
      setBusy(false);
    }
  }, [canControl, gameId, fetchActiveAndState]);

  const updateMapInRun = useCallback(async () => {
    if (!canControl) return;
    const parsed = safeJsonParse(mapPatchText);
    if (!parsed.ok) {
      const errMessage = 'err' in parsed ? parsed.err : '配置文本解析失败';
      setErr(`地图补丁配置错误: ${errMessage}`);
      return;
    }
    setBusy(true);
    setErr("");
    try {
      await api(`${API_BASE}/${gameId}/run/map/update`, {
        method: "POST",
        body: JSON.stringify({ mapPatch: parsed.value }),
      });
      await fetchActiveAndState();
    } catch (e: any) {
      setErr(e?.message || "运行中改图失败");
    } finally {
      setBusy(false);
    }
  }, [canControl, gameId, mapPatchText, fetchActiveAndState]);

  const grantScore = useCallback(async () => {
    if (!canControl) return;
    if (!grantUserId || !grantPoints) {
      setErr("请填写玩家编号和分值");
      return;
    }
    setBusy(true);
    setErr("");
    try {
      await api(`${API_BASE}/${gameId}/run/score/grant`, {
        method: "POST",
        body: JSON.stringify({
          userId: grantUserId,
          points: grantPoints,
          reason: grantReason,
          stage: runState?.currentStage ?? 1,
        }),
      });
      await fetchActiveAndState();
    } catch (e: any) {
      setErr(e?.message || "发分失败");
    } finally {
      setBusy(false);
    }
  }, [canControl, gameId, grantUserId, grantPoints, grantReason, runState?.currentStage, fetchActiveAndState]);

  const endRun = useCallback(async () => {
    if (!canControl) return;
    setBusy(true);
    setErr("");
    try {
      const result = await api<Settlement>(`${API_BASE}/${gameId}/run/end`, {
        method: "POST",
        body: JSON.stringify({ reason: "导演手动结算" }),
      });
      setSettlement(result);
      await fetchActiveAndState();
    } catch (e: any) {
      setErr(e?.message || "结算失败");
    } finally {
      setBusy(false);
    }
  }, [canControl, gameId, fetchActiveAndState]);

  const leaveRun = useCallback(async () => {
    setBusy(true);
    setErr("");
    try {
      if (runState?.isJoined) {
        await api(`${API_BASE}/${gameId}/run/leave`, {
          method: "POST",
          body: JSON.stringify({}),
        });
      }
    } catch (e: any) {
      setErr(e?.message || "返回主世界失败");
    } finally {
      setBusy(false);
      onExit?.();
    }
  }, [gameId, onExit, runState?.isJoined]);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      setErr("");
      try {
        await fetchActiveAndState();
      } catch (e: any) {
        if (!active) return;
        setErr(e?.message || "加载副本失败");
      } finally {
        if (active) setLoading(false);
      }
    })();

    // 轮询
    const timer = setInterval(() => {
      fetchActiveAndState().catch(() => void 0);
    }, 5000);

    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [fetchActiveAndState]);

  useEffect(() => {
    if (!runState) return;
    const incomingStages =
      Array.isArray(runState.stageConfigs) && runState.stageConfigs.length
        ? runState.stageConfigs.map((item, index) => ({
            index: index + 1,
            name: String(item.name || `阶段${index + 1}`),
            desc: String(item.desc || ""),
          }))
        : Array.from({ length: Math.max(1, Number(runState.totalStages || 1)) }).map((_, index) => ({
            index: index + 1,
            name: `阶段${index + 1}`,
            desc: "",
          }));
    setCfgTotalStages(Math.max(1, Number(runState.totalStages || incomingStages.length || 1)));
    setCfgStages(incomingStages);
  }, [runState?.runId, runState?.totalStages, JSON.stringify(runState?.stageConfigs || [])]);

  // 配置阶段行增删
  const ensureStageRows = (count: number) => {
    const n = Math.max(1, Math.min(20, count));
    setCfgStages((prev) => {
      const next = [...prev];
      if (next.length < n) {
        for (let i = next.length + 1; i <= n; i++) {
          next.push({ index: i, name: `阶段${i}`, desc: "" });
        }
      } else if (next.length > n) {
        next.length = n;
      }
      return next.map((x, idx) => ({ ...x, index: idx + 1 }));
    });
  };

  if (loading) {
    return <div className={className}>加载副本中...</div>;
  }

  if (!runState) {
    return (
      <div className={className} style={{ border: "1px solid #333", borderRadius: 8, padding: 12 }}>
        <h3>灾厄游戏运行区</h3>
        <p>当前没有运行中的灾厄局。</p>
        <button disabled={busy} onClick={joinRun}>尝试加入（若刚开局）</button>
        {err ? <p style={{ color: "tomato" }}>{err}</p> : null}
        {onExit ? (
          <div style={{ marginTop: 10 }}>
            <button onClick={leaveRun}>回归原世界</button>
          </div>
        ) : null}
      </div>
    );
  }

  const myName = currentUser.nickname || currentUser.username || `U${currentUser.id}`;

  return (
    <div className={className} style={{ display: "grid", gridTemplateColumns: canControl ? "1fr 360px" : "1fr", gap: 12 }}>
      {/* 主视图 */}
      <section style={{ border: "1px solid #333", borderRadius: 8, padding: 12 }}>
        <h3 style={{ marginTop: 0 }}>
          灾厄进行中 #{runState.runId}（游戏#{runState.gameId}）
        </h3>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 8 }}>
          <span>状态：{toRunStatusLabel(runState.status)}</span>
          <span>
            阶段：{runState.currentStage}/{runState.totalStages}
          </span>
          <span>阶段名：{runState.stageName || "-"}</span>
          <span>玩家：{runState.players?.length || 0}</span>
          <span>你：{myName}</span>
        </div>

        <div style={{ marginBottom: 12, border: "1px solid #314158", background: "#111827", borderRadius: 8, padding: 10, color: "#dbeafe" }}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>副本数据隔离说明</div>
          <div style={{ fontSize: 13, lineHeight: 1.6 }}>
            当前灾厄局使用独立临时数据层，不继承主世界属性、背包和技能；结算后只保留积分，离开时回到原本世界存档。
          </div>
          {runState.worldSnapshotCapturedAt ? (
            <div style={{ fontSize: 12, opacity: 0.8, marginTop: 6 }}>
              主世界快照时间：{new Date(runState.worldSnapshotCapturedAt).toLocaleString()}
            </div>
          ) : null}
        </div>

        <div style={{ marginBottom: 12, border: "1px solid #2b2b2b", borderRadius: 8, padding: 8 }}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>
            灾厄地图：{String((runState.mapConfig as any)?.mapName || "创作者地图")}
          </div>
          <div
            style={{
              position: "relative",
              width: "100%",
              height: 220,
              borderRadius: 8,
              overflow: "hidden",
              background: "#0f172a",
              border: "1px solid #273248"
            }}
          >
            {(runState.mapConfig as any)?.backgroundImage ? (
                <img
                  src={String((runState.mapConfig as any).backgroundImage)}
                  alt="灾厄地图"
                  style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: 0.7 }}
                />
            ) : null}
            {(Array.isArray((runState.mapConfig as any)?.points) ? (runState.mapConfig as any).points : []).map((p: any, idx: number) => (
              <div
                key={`map-point-${idx}-${String(p?.id || "")}`}
                title={String(p?.name || "点位")}
                style={{
                  position: "absolute",
                  left: `${Number(p?.x || 0)}%`,
                  top: `${Number(p?.y || 0)}%`,
                  transform: "translate(-50%, -50%)",
                  padding: "2px 6px",
                  borderRadius: 999,
                  background: "rgba(14,165,233,0.88)",
                  color: "#fff",
                  fontSize: 11,
                  fontWeight: 700,
                  border: "1px solid rgba(255,255,255,0.45)"
                }}
              >
                {String(p?.name || "点位")}
              </div>
            ))}
          </div>
          {(runState.mapConfig as any)?.announcementText ? (
            <div style={{ marginTop: 10, fontSize: 13, lineHeight: 1.6 }}>
              <strong>开局公告：</strong> {String((runState.mapConfig as any)?.announcementText || "")}
            </div>
          ) : null}
          {(runState.mapConfig as any)?.layoutRuleText ? (
            <div style={{ marginTop: 6, fontSize: 13, lineHeight: 1.6 }}>
              <strong>地图规则：</strong> {String((runState.mapConfig as any)?.layoutRuleText || "")}
            </div>
          ) : null}
          {runState.stageDesc ? (
            <div style={{ marginTop: 6, fontSize: 13, lineHeight: 1.6 }}>
              <strong>当前阶段说明：</strong> {runState.stageDesc}
            </div>
          ) : null}
        </div>

        {err ? <p style={{ color: "tomato" }}>{err}</p> : null}

        {!runState.isJoined ? (
          <button disabled={busy} onClick={joinRun}>加入本局</button>
        ) : (
          <>
            <div style={{ marginTop: 10, marginBottom: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button disabled={busy || runState.status !== "running"} onClick={() => doAction("explore", {})}>
                探索
              </button>
              <button disabled={busy || runState.status !== "running"} onClick={() => doAction("collect", {})}>
                采集
              </button>
              <button disabled={busy || runState.status !== "running"} onClick={() => doAction("attack", { target: "nearby" })}>
                攻击
              </button>
              <input
                style={{ minWidth: 200 }}
                placeholder="自定义动作，如 技能释放"
                value={customAction}
                onChange={(e) => setCustomAction(e.target.value)}
              />
              <button
                disabled={busy || runState.status !== "running" || !customAction.trim()}
                onClick={() => doAction(customAction.trim(), {})}
              >
                发送动作
              </button>
            </div>
          </>
        )}

        <hr />

        <h4>实时排行</h4>
        <table width="100%" cellPadding={6} style={{ borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th align="left">名次</th>
              <th align="left">玩家</th>
              <th align="left">积分</th>
            </tr>
          </thead>
          <tbody>
            {(rank || []).map((r, i) => (
              <tr key={r.userId} style={{ borderTop: "1px solid #2f2f2f" }}>
                <td>{r.rank ?? i + 1}</td>
                <td>{r.name}</td>
                <td>{r.score}</td>
              </tr>
            ))}
            {!rank?.length ? (
              <tr>
                <td colSpan={3} style={{ opacity: 0.7 }}>
                  暂无排行数据
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>

        <hr />

        <h4>运行日志</h4>
        <div style={{ maxHeight: 240, overflow: "auto", background: "#111", border: "1px solid #2a2a2a", borderRadius: 6, padding: 8 }}>
          {(runState.events || []).length ? (
            (runState.events || []).map((ev) => (
              <div key={ev.id} style={{ marginBottom: 6, fontSize: 13 }}>
                <span style={{ opacity: 0.7 }}>[{new Date(ev.ts).toLocaleTimeString()}]</span>{" "}
                <strong>{ev.type}</strong> - {ev.message}
              </div>
            ))
          ) : (
            <div style={{ opacity: 0.7 }}>暂无日志</div>
          )}
        </div>

        {runState.status === "ended" || settlement ? (
          <>
            <hr />
            <h4>结算</h4>
            {settlement ? (
              <div>
                <p>结束时间：{new Date(settlement.endedAt).toLocaleString()}</p>
                <p>结果：{settlement.result || "已结算"}</p>
                <p>结算排名会同步写入命之塔公告厅，长期只累计积分。</p>
                <ul>
                  {(settlement.rank || []).map((r, i) => (
                    <li key={r.userId}>
                      #{r.rank ?? i + 1} {r.name} - {r.score}
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p>已结束，等待结算数据...</p>
            )}
          </>
        ) : null}

        <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
          <button onClick={() => fetchActiveAndState()} disabled={busy}>刷新</button>
          {onExit ? <button onClick={leaveRun}>回归原世界</button> : null}
        </div>
      </section>

      {/* 导演台 */}
      {canControl ? (
        <aside style={{ border: "1px solid #333", borderRadius: 8, padding: 12 }}>
          <h3 style={{ marginTop: 0 }}>导演台（阶段控制）</h3>

          <div style={{ marginBottom: 12, padding: 8, border: "1px solid #2b2b2b", borderRadius: 6 }}>
            <h4 style={{ marginTop: 0 }}>1) 阶段配置</h4>
            <label>
              阶段总数：
              <input
                type="number"
                min={1}
                max={20}
                value={cfgTotalStages}
                onChange={(e) => {
                  const n = Number(e.target.value) || 1;
                  setCfgTotalStages(n);
                  ensureStageRows(n);
                }}
                style={{ marginLeft: 8, width: 80 }}
              />
            </label>

            <div style={{ marginTop: 8, maxHeight: 160, overflow: "auto", border: "1px solid #252525", padding: 6 }}>
              {cfgStages.map((s, idx) => (
                <div key={idx} style={{ display: "grid", gridTemplateColumns: "56px 1fr", gap: 6, marginBottom: 6 }}>
                  <input value={`#${idx + 1}`} readOnly />
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                    <input
                      placeholder="阶段名"
                      value={s.name}
                      onChange={(e) =>
                        setCfgStages((prev) => {
                          const next = [...prev];
                          next[idx] = { ...next[idx], name: e.target.value };
                          return next;
                        })
                      }
                    />
                    <input
                      placeholder="阶段描述"
                      value={s.desc || ""}
                      onChange={(e) =>
                        setCfgStages((prev) => {
                          const next = [...prev];
                          next[idx] = { ...next[idx], desc: e.target.value };
                          return next;
                        })
                      }
                    />
                  </div>
                </div>
              ))}
            </div>

            <button disabled={busy} onClick={submitStageConfig}>保存阶段配置</button>
          </div>

          <div style={{ marginBottom: 12, padding: 8, border: "1px solid #2b2b2b", borderRadius: 6 }}>
            <h4 style={{ marginTop: 0 }}>2) 推进阶段</h4>
            <p style={{ margin: "4px 0" }}>
              当前：{runState.currentStage}/{runState.totalStages} {runState.stageName ? `(${runState.stageName})` : ""}
            </p>
            <button disabled={busy || runState.status !== "running"} onClick={nextStage}>
              下一阶段
            </button>
          </div>

          <div style={{ marginBottom: 12, padding: 8, border: "1px solid #2b2b2b", borderRadius: 6 }}>
            <h4 style={{ marginTop: 0 }}>3) 运行中改图</h4>
            <textarea
              rows={8}
              style={{ width: "100%", fontFamily: "monospace" }}
              value={mapPatchText}
              onChange={(e) => setMapPatchText(e.target.value)}
              placeholder="粘贴地图补丁配置文本"
            />
            <button disabled={busy || runState.status !== "running"} onClick={updateMapInRun}>
              应用地图补丁
            </button>
          </div>

          <div style={{ marginBottom: 12, padding: 8, border: "1px solid #2b2b2b", borderRadius: 6 }}>
            <h4 style={{ marginTop: 0 }}>4) 阶段发分</h4>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
              <input
                type="number"
                placeholder="玩家编号"
                value={grantUserId || ""}
                onChange={(e) => setGrantUserId(Number(e.target.value) || 0)}
              />
              <input
                type="number"
                placeholder="分值"
                value={grantPoints}
                onChange={(e) => setGrantPoints(Number(e.target.value) || 0)}
              />
            </div>
            <input
              style={{ marginTop: 6, width: "100%" }}
              placeholder="发分理由"
              value={grantReason}
              onChange={(e) => setGrantReason(e.target.value)}
            />
            <button style={{ marginTop: 6 }} disabled={busy || runState.status !== "running"} onClick={grantScore}>
              发放积分
            </button>
          </div>

          <div style={{ padding: 8, border: "1px solid #2b2b2b", borderRadius: 6 }}>
            <h4 style={{ marginTop: 0 }}>5) 结算</h4>
            <button
              disabled={busy || runState.status !== "running"}
              onClick={endRun}
              style={{ background: "#7a1f1f", color: "#fff" }}
            >
              结束并结算本局
            </button>
          </div>
        </aside>
      ) : null}
    </div>
  );
};

export default CustomGameRunView;



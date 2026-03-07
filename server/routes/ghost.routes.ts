import { Router } from 'express';
import { AppContext } from '../types';

type AnyRow = Record<string, any>;

const nowIso = () => new Date().toISOString();

const MATERIALIZATION_MP_COST = 20;
const ETHEREAL_MP_COST = 10;

function getUser(db: any, userId: number) {
  return db.prepare(`SELECT * FROM users WHERE id = ? LIMIT 1`).get(userId) as AnyRow | undefined;
}

function getGhostState(db: any, userId: number) {
  const row = db.prepare(`
    SELECT userId, state, lastToggleAt, mpCost, updatedAt
    FROM ghost_materialization
    WHERE userId = ?
    LIMIT 1
  `).get(userId) as AnyRow | undefined;

  if (!row) {
    db.prepare(`
      INSERT INTO ghost_materialization(userId, state, lastToggleAt, mpCost, updatedAt)
      VALUES (?, 'ethereal', ?, 0, ?)
    `).run(userId, nowIso(), nowIso());
    return { userId, state: 'ethereal', lastToggleAt: nowIso(), mpCost: 0, updatedAt: nowIso() };
  }

  return row;
}

export function createGhostRouter(ctx: AppContext) {
  const r = Router();
  const { db } = ctx;

  // 获取鬼魂状态
  r.get('/ghost/state', (req, res) => {
    try {
      const userId = Number(req.query.userId || 0);
      if (!userId) return res.status(400).json({ success: false, message: 'userId required' });

      const user = getUser(db, userId);
      if (!user) return res.status(404).json({ success: false, message: 'user not found' });

      if (String(user.status || '') !== 'ghost') {
        return res.json({
          success: true,
          isGhost: false,
          state: null,
          message: '你不是鬼魂状态'
        });
      }

      const ghostState = getGhostState(db, userId);

      res.json({
        success: true,
        isGhost: true,
        state: String(ghostState.state || 'ethereal'),
        lastToggleAt: String(ghostState.lastToggleAt || ''),
        mpCost: Number(ghostState.mpCost || 0),
        currentMp: Number(user.mp || 0),
        maxMp: Number(user.maxMp || 100),
        materializationCost: MATERIALIZATION_MP_COST,
        etherealCost: ETHEREAL_MP_COST
      });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e?.message || 'get ghost state failed' });
    }
  });

  // 切换实体化/半实体化
  r.post('/ghost/toggle', (req, res) => {
    try {
      const userId = Number(req.body?.userId || 0);
      const targetState = String(req.body?.targetState || '').trim(); // 'materialized' | 'ethereal'

      if (!userId || !targetState) {
        return res.status(400).json({ success: false, message: 'userId/targetState required' });
      }

      if (!['materialized', 'ethereal'].includes(targetState)) {
        return res.status(400).json({ success: false, message: 'invalid targetState' });
      }

      const user = getUser(db, userId);
      if (!user) return res.status(404).json({ success: false, message: 'user not found' });

      if (String(user.status || '') !== 'ghost') {
        return res.status(403).json({ success: false, message: '只有鬼魂可以切换实体化状态' });
      }

      const ghostState = getGhostState(db, userId);
      const currentState = String(ghostState.state || 'ethereal');

      if (currentState === targetState) {
        return res.json({
          success: true,
          message: `你已经处于${targetState === 'materialized' ? '实体化' : '半实体化'}状态`,
          state: currentState
        });
      }

      const cost = targetState === 'materialized' ? MATERIALIZATION_MP_COST : ETHEREAL_MP_COST;
      const currentMp = Number(user.mp || 0);

      if (currentMp < cost) {
        return res.status(400).json({
          success: false,
          message: `MP不足，需要 ${cost} MP，当前只有 ${currentMp} MP`
        });
      }

      const tx = db.transaction(() => {
        db.prepare(`UPDATE users SET mp = mp - ?, updatedAt = ? WHERE id = ?`).run(cost, nowIso(), userId);
        db.prepare(`
          UPDATE ghost_materialization
          SET state = ?,
              lastToggleAt = ?,
              mpCost = ?,
              updatedAt = ?
          WHERE userId = ?
        `).run(targetState, nowIso(), cost, nowIso(), userId);
      });
      tx();

      const freshUser = getUser(db, userId);
      const stateName = targetState === 'materialized' ? '实体化' : '半实体化';
      const stateDesc = targetState === 'materialized'
        ? '你现在可以与普通人对话和交易'
        : '你现在对普通人不可见，无法对话';

      res.json({
        success: true,
        message: `已切换为${stateName}状态（消耗 ${cost} MP）。${stateDesc}`,
        state: targetState,
        mp: Number(freshUser?.mp || 0),
        mpCost: cost
      });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e?.message || 'toggle ghost state failed' });
    }
  });

  // 检查鬼魂是否可见（供其他玩家调用）
  r.get('/ghost/visible/:targetUserId', (req, res) => {
    try {
      const targetUserId = Number(req.params.targetUserId || 0);
      const viewerUserId = Number(req.query.viewerUserId || 0);

      if (!targetUserId) return res.status(400).json({ success: false, message: 'targetUserId required' });

      const target = getUser(db, targetUserId);
      if (!target) return res.status(404).json({ success: false, message: 'target user not found' });

      const viewer = viewerUserId ? getUser(db, viewerUserId) : null;

      // 如果目标不是鬼魂，总是可见
      if (String(target.status || '') !== 'ghost') {
        return res.json({ success: true, visible: true, reason: 'not_ghost' });
      }

      const ghostState = getGhostState(db, targetUserId);
      const state = String(ghostState.state || 'ethereal');

      // 实体化状态：所有人可见
      if (state === 'materialized') {
        return res.json({ success: true, visible: true, reason: 'materialized' });
      }

      // 半实体化状态：只有鬼魂可见
      const viewerIsGhost = viewer && String(viewer.status || '') === 'ghost';
      res.json({
        success: true,
        visible: viewerIsGhost,
        reason: viewerIsGhost ? 'both_ghosts' : 'ethereal_to_living'
      });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e?.message || 'check visibility failed' });
    }
  });

  return r;
}

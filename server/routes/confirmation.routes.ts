import { Router } from 'express';
import { AppContext } from '../types';

type AnyRow = Record<string, any>;

const nowIso = () => new Date().toISOString();
const afterMinutesIso = (minutes: number) => new Date(Date.now() + minutes * 60 * 1000).toISOString();

// 需要二次确认的敏感操作类型
const SENSITIVE_OPERATIONS = {
  DEATH: 'death',
  BECOME_GHOST: 'become_ghost',
  RESIGN_POSITION: 'resign_position',
  DELETE_CHARACTER: 'delete_character',
  TRANSFER_LARGE_AMOUNT: 'transfer_large_amount',
  SELL_RARE_ITEM: 'sell_rare_item'
} as const;

const OPERATION_LABELS: Record<string, string> = {
  death: '角色死亡',
  become_ghost: '转化为鬼魂',
  resign_position: '辞去职位',
  delete_character: '删除角色',
  transfer_large_amount: '大额转账',
  sell_rare_item: '出售稀有物品'
};

function getUser(db: any, userId: number) {
  return db.prepare(`SELECT * FROM users WHERE id = ? LIMIT 1`).get(userId) as AnyRow | undefined;
}

export function createConfirmationRouter(ctx: AppContext) {
  const r = Router();
  const { db } = ctx;

  // 清理过期的确认请求
  function cleanupExpired() {
    const now = nowIso();
    db.prepare(`
      DELETE FROM sensitive_operation_confirmations
      WHERE status = 'pending' AND expiresAt < ?
    `).run(now);
  }

  // 创建确认请求
  r.post('/confirmations', (req, res) => {
    try {
      cleanupExpired();

      const userId = Number(req.body?.userId || 0);
      const operationType = String(req.body?.operationType || '').trim();
      const operationData = req.body?.operationData || {};
      const expiresInMinutes = Math.min(30, Math.max(5, Number(req.body?.expiresInMinutes || 10)));

      if (!userId || !operationType) {
        return res.status(400).json({ success: false, message: 'userId/operationType required' });
      }

      if (!Object.values(SENSITIVE_OPERATIONS).includes(operationType as any)) {
        return res.status(400).json({ success: false, message: 'invalid operationType' });
      }

      const user = getUser(db, userId);
      if (!user) return res.status(404).json({ success: false, message: 'user not found' });

      const expiresAt = afterMinutesIso(expiresInMinutes);
      const ret = db.prepare(`
        INSERT INTO sensitive_operation_confirmations(
          userId, operationType, operationData, status, expiresAt, createdAt
        )
        VALUES (?, ?, ?, 'pending', ?, ?)
      `).run(userId, operationType, JSON.stringify(operationData), expiresAt, nowIso());

      const confirmationId = Number(ret.lastInsertRowid || 0);

      res.json({
        success: true,
        message: `请在 ${expiresInMinutes} 分钟内确认此操作`,
        confirmationId,
        operationType,
        operationLabel: OPERATION_LABELS[operationType] || operationType,
        expiresAt,
        expiresInMinutes
      });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e?.message || 'create confirmation failed' });
    }
  });

  // 获取待确认列表
  r.get('/confirmations', (req, res) => {
    try {
      cleanupExpired();

      const userId = Number(req.query.userId || 0);
      if (!userId) return res.status(400).json({ success: false, message: 'userId required' });

      const rows = db.prepare(`
        SELECT id, userId, operationType, operationData, status, confirmedAt, expiresAt, createdAt
        FROM sensitive_operation_confirmations
        WHERE userId = ? AND status = 'pending'
        ORDER BY createdAt DESC
        LIMIT 20
      `).all(userId) as AnyRow[];

      const confirmations = rows.map((x) => ({
        id: Number(x.id || 0),
        userId: Number(x.userId || 0),
        operationType: String(x.operationType || ''),
        operationLabel: OPERATION_LABELS[String(x.operationType || '')] || String(x.operationType || ''),
        operationData: JSON.parse(String(x.operationData || '{}')),
        status: String(x.status || 'pending'),
        confirmedAt: String(x.confirmedAt || ''),
        expiresAt: String(x.expiresAt || ''),
        createdAt: String(x.createdAt || ''),
        isExpired: Date.parse(String(x.expiresAt || '')) < Date.now()
      }));

      res.json({ success: true, confirmations });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e?.message || 'load confirmations failed', confirmations: [] });
    }
  });

  // 确认操作
  r.post('/confirmations/:id/confirm', (req, res) => {
    try {
      cleanupExpired();

      const id = Number(req.params.id || 0);
      const userId = Number(req.body?.userId || 0);

      if (!id || !userId) {
        return res.status(400).json({ success: false, message: 'id/userId required' });
      }

      const confirmation = db.prepare(`
        SELECT * FROM sensitive_operation_confirmations WHERE id = ? LIMIT 1
      `).get(id) as AnyRow | undefined;

      if (!confirmation) {
        return res.status(404).json({ success: false, message: '确认请求不存在' });
      }

      if (Number(confirmation.userId || 0) !== userId) {
        return res.status(403).json({ success: false, message: '无权确认此操作' });
      }

      if (String(confirmation.status || '') !== 'pending') {
        return res.status(409).json({ success: false, message: '该确认请求已处理' });
      }

      if (Date.parse(String(confirmation.expiresAt || '')) < Date.now()) {
        db.prepare(`DELETE FROM sensitive_operation_confirmations WHERE id = ?`).run(id);
        return res.status(410).json({ success: false, message: '确认请求已过期' });
      }

      db.prepare(`
        UPDATE sensitive_operation_confirmations
        SET status = 'confirmed',
            confirmedAt = ?
        WHERE id = ?
      `).run(nowIso(), id);

      res.json({
        success: true,
        message: '操作已确认',
        operationType: String(confirmation.operationType || ''),
        operationData: JSON.parse(String(confirmation.operationData || '{}'))
      });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e?.message || 'confirm operation failed' });
    }
  });

  // 取消确认
  r.post('/confirmations/:id/cancel', (req, res) => {
    try {
      const id = Number(req.params.id || 0);
      const userId = Number(req.body?.userId || 0);

      if (!id || !userId) {
        return res.status(400).json({ success: false, message: 'id/userId required' });
      }

      const confirmation = db.prepare(`
        SELECT * FROM sensitive_operation_confirmations WHERE id = ? LIMIT 1
      `).get(id) as AnyRow | undefined;

      if (!confirmation) {
        return res.status(404).json({ success: false, message: '确认请求不存在' });
      }

      if (Number(confirmation.userId || 0) !== userId) {
        return res.status(403).json({ success: false, message: '无权取消此操作' });
      }

      db.prepare(`DELETE FROM sensitive_operation_confirmations WHERE id = ?`).run(id);

      res.json({ success: true, message: '操作已取消' });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e?.message || 'cancel confirmation failed' });
    }
  });

  return r;
}

import { Router } from 'express';
import { AppContext } from '../types';

const nowIso = () => new Date().toISOString();

const ARMY_JOBS = new Set(['军队将官', '军队校官', '军队尉官', '军队士兵']);

export function createMediationRouter(ctx: AppContext) {
  const router = Router();
  const { db } = ctx;

  // 发起评理请求
  router.post('/mediation/request', async (req, res) => {
    try {
      const { sessionId, requesterUserId, requesterName, targetUserId, targetName, reason } = req.body;

      if (!sessionId || !requesterUserId || !targetUserId) {
        return res.status(400).json({ success: false, message: '参数不完整' });
      }

      // 检查是否已有待处理的评理请求
      const existing = db.prepare(`
        SELECT * FROM mediation_requests 
        WHERE sessionId = ? AND status = 'pending'
      `).get(sessionId);

      if (existing) {
        return res.status(400).json({ success: false, message: '已有待处理的评理请求' });
      }

      // 创建评理请求
      const result = db.prepare(`
        INSERT INTO mediation_requests 
        (sessionId, requesterUserId, requesterName, targetUserId, targetName, reason, status, reward, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, 'pending', 1000, ?, ?)
      `).run(sessionId, requesterUserId, requesterName, targetUserId, targetName, reason || '需要第三方介入调解', nowIso(), nowIso());

      res.json({ 
        success: true, 
        message: '评理请求已发送给军队成员',
        requestId: result.lastInsertRowid
      });
    } catch (error: any) {
      console.error('Create mediation request error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // 获取待处理的评理请求（军队成员）
  router.get('/mediation/pending', async (req, res) => {
    try {
      const { userId } = req.query;

      if (!userId) {
        return res.status(400).json({ success: false, message: '缺少用户ID' });
      }

      // 检查是否是军队成员
      const user = db.prepare('SELECT job FROM users WHERE id = ?').get(Number(userId));
      if (!user || !ARMY_JOBS.has(user.job)) {
        return res.status(403).json({ success: false, message: '只有军队成员可以接取评理请求' });
      }

      // 获取待处理的评理请求
      const requests = db.prepare(`
        SELECT * FROM mediation_requests 
        WHERE status = 'pending'
        ORDER BY createdAt ASC
        LIMIT 20
      `).all();

      res.json({ success: true, requests });
    } catch (error: any) {
      console.error('Get pending mediation requests error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // 接取评理请求
  router.post('/mediation/:requestId/accept', async (req, res) => {
    try {
      const { requestId } = req.params;
      const { userId, userName } = req.body;

      // 检查是否是军队成员
      const user = db.prepare('SELECT job FROM users WHERE id = ?').get(userId);
      if (!user || !ARMY_JOBS.has(user.job)) {
        return res.status(403).json({ success: false, message: '只有军队成员可以接取评理请求' });
      }

      // 检查请求是否存在且待处理
      const request = db.prepare(`
        SELECT * FROM mediation_requests WHERE id = ? AND status = 'pending'
      `).get(requestId);

      if (!request) {
        return res.status(404).json({ success: false, message: '评理请求不存在或已被处理' });
      }

      // 更新请求状态
      db.prepare(`
        UPDATE mediation_requests 
        SET status = 'in_progress', mediatorUserId = ?, mediatorName = ?, updatedAt = ?
        WHERE id = ?
      `).run(userId, userName, nowIso(), requestId);

      res.json({ 
        success: true, 
        message: '已接取评理请求，请前往对戏窗口进行调解',
        request: {
          ...request,
          mediatorUserId: userId,
          mediatorName: userName
        }
      });
    } catch (error: any) {
      console.error('Accept mediation request error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // 完成评理（发放奖励）
  router.post('/mediation/:requestId/complete', async (req, res) => {
    try {
      const { requestId } = req.params;
      const { userId } = req.body;

      const request = db.prepare(`
        SELECT * FROM mediation_requests 
        WHERE id = ? AND mediatorUserId = ? AND status = 'in_progress'
      `).get(requestId, userId);

      if (!request) {
        return res.status(404).json({ success: false, message: '评理请求不存在或你不是调解人' });
      }

      // 发放奖励
      db.prepare('UPDATE users SET gold = gold + ? WHERE id = ?').run(request.reward, userId);

      // 更新请求状态
      db.prepare(`
        UPDATE mediation_requests SET status = 'completed', updatedAt = ? WHERE id = ?
      `).run(nowIso(), requestId);

      res.json({ 
        success: true, 
        message: `评理完成，获得 ${request.reward}G 奖励`,
        reward: request.reward
      });
    } catch (error: any) {
      console.error('Complete mediation error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // 放弃评理（释放锁定）
  router.post('/mediation/:requestId/abandon', async (req, res) => {
    try {
      const { requestId } = req.params;
      const { userId } = req.body;

      const request = db.prepare(`
        SELECT * FROM mediation_requests 
        WHERE id = ? AND mediatorUserId = ? AND status = 'in_progress'
      `).get(requestId, userId);

      if (!request) {
        return res.status(404).json({ success: false, message: '评理请求不存在或你不是调解人' });
      }

      // 重置为待处理状态
      db.prepare(`
        UPDATE mediation_requests 
        SET status = 'pending', mediatorUserId = 0, mediatorName = '', updatedAt = ?
        WHERE id = ?
      `).run(nowIso(), requestId);

      res.json({ 
        success: true, 
        message: '已放弃此评理请求，其他军队成员可以接取'
      });
    } catch (error: any) {
      console.error('Abandon mediation error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // 获取我的评理记录
  router.get('/mediation/my-records', async (req, res) => {
    try {
      const { userId } = req.query;

      if (!userId) {
        return res.status(400).json({ success: false, message: '缺少用户ID' });
      }

      const records = db.prepare(`
        SELECT * FROM mediation_requests 
        WHERE mediatorUserId = ?
        ORDER BY createdAt DESC
        LIMIT 50
      `).all(Number(userId));

      res.json({ success: true, records });
    } catch (error: any) {
      console.error('Get mediation records error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  return router;
}

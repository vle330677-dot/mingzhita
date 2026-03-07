import { Router } from 'express';
import { AppContext } from '../types';

type AnyRow = Record<string, any>;

const nowIso = () => new Date().toISOString();
const afterMinutesIso = (minutes: number) => new Date(Date.now() + minutes * 60 * 1000).toISOString();

const ARMY_JOBS = new Set(['军队统帅', '军队副官', '军队士兵']);

function isArmyMember(jobRaw: any) {
  return ARMY_JOBS.has(String(jobRaw || '').trim());
}

function getUser(db: any, userId: number) {
  return db.prepare(`SELECT * FROM users WHERE id = ? LIMIT 1`).get(userId) as AnyRow | undefined;
}

export function createArmyRouter(ctx: AppContext) {
  const r = Router();
  const { db } = ctx;

  // 获取评理列表
  r.get('/army/arbitrations', (req, res) => {
    try {
      const userId = Number(req.query.userId || 0);
      const status = String(req.query.status || 'pending');
      const limit = Math.min(100, Math.max(1, Number(req.query.limit || 50)));

      const rows = db.prepare(`
        SELECT id, plaintiffUserId, plaintiffName, defendantUserId, defendantName,
               reason, evidence, status, judgeUserId, judgeName, verdict, penalty,
               createdAt, updatedAt
        FROM army_arbitrations
        WHERE status = ?
        ORDER BY createdAt DESC
        LIMIT ?
      `).all(status, limit) as AnyRow[];

      const arbitrations = rows.map((x) => {
        const votes = db.prepare(`
          SELECT voterUserId, voterName, vote, comment, createdAt
          FROM army_arbitration_votes
          WHERE arbitrationId = ?
          ORDER BY createdAt ASC
        `).all(Number(x.id || 0)) as AnyRow[];

        return {
          id: Number(x.id || 0),
          plaintiffUserId: Number(x.plaintiffUserId || 0),
          plaintiffName: String(x.plaintiffName || ''),
          defendantUserId: Number(x.defendantUserId || 0),
          defendantName: String(x.defendantName || ''),
          reason: String(x.reason || ''),
          evidence: String(x.evidence || ''),
          status: String(x.status || 'pending'),
          judgeUserId: Number(x.judgeUserId || 0),
          judgeName: String(x.judgeName || ''),
          verdict: String(x.verdict || ''),
          penalty: String(x.penalty || ''),
          createdAt: String(x.createdAt || ''),
          updatedAt: String(x.updatedAt || ''),
          votes: votes.map((v) => ({
            voterUserId: Number(v.voterUserId || 0),
            voterName: String(v.voterName || ''),
            vote: String(v.vote || ''),
            comment: String(v.comment || ''),
            createdAt: String(v.createdAt || '')
          })),
          canVote: userId > 0 && isArmyMember(getUser(db, userId)?.job) && !votes.some((v) => Number(v.voterUserId) === userId)
        };
      });

      res.json({ success: true, arbitrations });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e?.message || 'load arbitrations failed', arbitrations: [] });
    }
  });

  // 提交评理申请
  r.post('/army/arbitrations', (req, res) => {
    try {
      const userId = Number(req.body?.userId || 0);
      const defendantUserId = Number(req.body?.defendantUserId || 0);
      const reason = String(req.body?.reason || '').trim();
      const evidence = String(req.body?.evidence || '').trim();

      if (!userId || !defendantUserId || !reason) {
        return res.status(400).json({ success: false, message: 'userId/defendantUserId/reason required' });
      }

      if (userId === defendantUserId) {
        return res.status(400).json({ success: false, message: '不能对自己提起评理' });
      }

      const plaintiff = getUser(db, userId);
      if (!plaintiff) return res.status(404).json({ success: false, message: 'plaintiff not found' });

      const defendant = getUser(db, defendantUserId);
      if (!defendant) return res.status(404).json({ success: false, message: 'defendant not found' });

      const ret = db.prepare(`
        INSERT INTO army_arbitrations(
          plaintiffUserId, plaintiffName, defendantUserId, defendantName,
          reason, evidence, status, createdAt, updatedAt
        )
        VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?)
      `).run(
        userId,
        String(plaintiff.name || ''),
        defendantUserId,
        String(defendant.name || ''),
        reason,
        evidence,
        nowIso(),
        nowIso()
      );

      res.json({
        success: true,
        message: '评理申请已提交，等待军队成员投票裁决',
        arbitrationId: Number(ret.lastInsertRowid || 0)
      });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e?.message || 'submit arbitration failed' });
    }
  });

  // 军队成员投票
  r.post('/army/arbitrations/:id/vote', (req, res) => {
    try {
      const id = Number(req.params.id || 0);
      const userId = Number(req.body?.userId || 0);
      const vote = String(req.body?.vote || '').trim(); // 'support_plaintiff' | 'support_defendant' | 'neutral'
      const comment = String(req.body?.comment || '').trim();

      if (!id || !userId || !vote) {
        return res.status(400).json({ success: false, message: 'id/userId/vote required' });
      }

      if (!['support_plaintiff', 'support_defendant', 'neutral'].includes(vote)) {
        return res.status(400).json({ success: false, message: 'invalid vote value' });
      }

      const voter = getUser(db, userId);
      if (!voter) return res.status(404).json({ success: false, message: 'voter not found' });

      if (!isArmyMember(voter.job)) {
        return res.status(403).json({ success: false, message: '只有军队成员可以参与评理投票' });
      }

      const arbitration = db.prepare(`
        SELECT * FROM army_arbitrations WHERE id = ? LIMIT 1
      `).get(id) as AnyRow | undefined;

      if (!arbitration) return res.status(404).json({ success: false, message: '评理案件不存在' });

      if (String(arbitration.status || '') !== 'pending') {
        return res.status(409).json({ success: false, message: '该案件已结案，无法继续投票' });
      }

      const existing = db.prepare(`
        SELECT id FROM army_arbitration_votes WHERE arbitrationId = ? AND voterUserId = ? LIMIT 1
      `).get(id, userId) as AnyRow | undefined;

      if (existing?.id) {
        return res.status(409).json({ success: false, message: '你已经投过票了' });
      }

      db.prepare(`
        INSERT INTO army_arbitration_votes(arbitrationId, voterUserId, voterName, vote, comment, createdAt)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(id, userId, String(voter.name || ''), vote, comment, nowIso());

      res.json({ success: true, message: '投票成功' });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e?.message || 'vote failed' });
    }
  });

  // 军队统帅裁决
  r.post('/army/arbitrations/:id/judge', (req, res) => {
    try {
      const id = Number(req.params.id || 0);
      const userId = Number(req.body?.userId || 0);
      const verdict = String(req.body?.verdict || '').trim();
      const penalty = String(req.body?.penalty || '').trim();

      if (!id || !userId || !verdict) {
        return res.status(400).json({ success: false, message: 'id/userId/verdict required' });
      }

      const judge = getUser(db, userId);
      if (!judge) return res.status(404).json({ success: false, message: 'judge not found' });

      if (String(judge.job || '') !== '军队统帅') {
        return res.status(403).json({ success: false, message: '只有军队统帅可以做出最终裁决' });
      }

      const arbitration = db.prepare(`
        SELECT * FROM army_arbitrations WHERE id = ? LIMIT 1
      `).get(id) as AnyRow | undefined;

      if (!arbitration) return res.status(404).json({ success: false, message: '评理案件不存在' });

      if (String(arbitration.status || '') !== 'pending') {
        return res.status(409).json({ success: false, message: '该案件已结案' });
      }

      db.prepare(`
        UPDATE army_arbitrations
        SET status = 'closed',
            judgeUserId = ?,
            judgeName = ?,
            verdict = ?,
            penalty = ?,
            updatedAt = ?
        WHERE id = ?
      `).run(userId, String(judge.name || ''), verdict, penalty, nowIso(), id);

      res.json({ success: true, message: '裁决已发布' });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e?.message || 'judge failed' });
    }
  });

  return r;
}

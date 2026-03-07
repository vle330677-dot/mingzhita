import { Router } from 'express';
import { AppContext } from '../types';

const nowIso = () => new Date().toISOString();
const todayKey = () => nowIso().slice(0, 10);

const CITY_CONFIG = {
  slums: {
    id: 'slums',
    name: '西市',
    prosperityPerResident: 100,
    prosperityPerShop: 300,
    shopPrice: 10000,
    mayorJob: '西区市长'
  },
  rich_area: {
    id: 'rich_area',
    name: '东市',
    prosperityPerResident: 1000,
    prosperityPerShop: 3000,
    shopPrice: 100000,
    mayorJob: '东区市长'
  }
};

export function createCityRouter(ctx: AppContext) {
  const router = Router();
  const { db } = ctx;

  // 初始化城市繁荣度数据
  function ensureCityData(cityId: string) {
    const existing = db.prepare('SELECT * FROM city_prosperity WHERE cityId = ?').get(cityId);
    if (!existing) {
      db.prepare(`
        INSERT INTO city_prosperity (cityId, prosperity, residentCount, shopCount, lastSettlementDate, updatedAt)
        VALUES (?, 0, 0, 0, ?, ?)
      `).run(cityId, todayKey(), nowIso());
    }
  }

  // 获取城市繁荣度状态
  router.get('/city/:cityId/prosperity', (req, res) => {
    try {
      const { cityId } = req.params;
      const config = CITY_CONFIG[cityId as keyof typeof CITY_CONFIG];
      if (!config) return res.status(404).json({ success: false, message: '城市不存在' });

      ensureCityData(cityId);
      const data = db.prepare('SELECT * FROM city_prosperity WHERE cityId = ?').get(cityId);
      
      // 获取市长信息
      const mayor = data.mayorUserId 
        ? db.prepare('SELECT id, name, avatarUrl FROM users WHERE id = ?').get(data.mayorUserId)
        : null;

      // 获取商店列表
      const shops = db.prepare(`
        SELECT id, ownerUserId, ownerName, shopName, description, createdAt
        FROM city_shops
        WHERE cityId = ? AND status = 'active'
        ORDER BY createdAt DESC
      `).all(cityId);

      // 计算实时繁荣度
      const residentCount = db.prepare(`
        SELECT COUNT(*) as count FROM users 
        WHERE homeLocation = ? AND status = 'approved'
      `).get(cityId).count || 0;

      const shopCount = shops.length;
      const calculatedProsperity = 
        residentCount * config.prosperityPerResident + 
        shopCount * config.prosperityPerShop;

      res.json({
        success: true,
        city: {
          ...config,
          prosperity: calculatedProsperity,
          residentCount,
          shopCount,
          mayor,
          shops,
          lastSettlementDate: data.lastSettlementDate
        }
      });
    } catch (error: any) {
      console.error('Get city prosperity error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // 开设商店
  router.post('/city/:cityId/shop/open', async (req, res) => {
    try {
      const { cityId } = req.params;
      const { userId, shopName, description } = req.body;

      const config = CITY_CONFIG[cityId as keyof typeof CITY_CONFIG];
      if (!config) return res.status(404).json({ success: false, message: '城市不存在' });

      const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
      if (!user) return res.status(404).json({ success: false, message: '用户不存在' });

      // 检查是否已有商店
      const existingShop = db.prepare(`
        SELECT * FROM city_shops WHERE cityId = ? AND ownerUserId = ? AND status = 'active'
      `).get(cityId, userId);
      if (existingShop) {
        return res.status(400).json({ success: false, message: '你已经在此城市开设了商店' });
      }

      // 检查金币
      if (user.gold < config.shopPrice) {
        return res.status(400).json({ 
          success: false, 
          message: `开店需要 ${config.shopPrice}G，你当前只有 ${user.gold}G` 
        });
      }

      // 扣除金币并开店
      db.prepare('UPDATE users SET gold = gold - ? WHERE id = ?').run(config.shopPrice, userId);
      db.prepare(`
        INSERT INTO city_shops (cityId, ownerUserId, ownerName, shopName, description, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(cityId, userId, user.name, shopName, description || '', nowIso(), nowIso());

      ensureCityData(cityId);

      res.json({ 
        success: true, 
        message: `商店「${shopName}」开业成功！`,
        goldSpent: config.shopPrice
      });
    } catch (error: any) {
      console.error('Open shop error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // 关闭商店
  router.post('/city/:cityId/shop/close', async (req, res) => {
    try {
      const { cityId } = req.params;
      const { userId } = req.body;

      const shop = db.prepare(`
        SELECT * FROM city_shops WHERE cityId = ? AND ownerUserId = ? AND status = 'active'
      `).get(cityId, userId);

      if (!shop) {
        return res.status(404).json({ success: false, message: '你在此城市没有商店' });
      }

      db.prepare(`
        UPDATE city_shops SET status = 'closed', updatedAt = ? WHERE id = ?
      `).run(nowIso(), shop.id);

      res.json({ success: true, message: '商店已关闭' });
    } catch (error: any) {
      console.error('Close shop error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // 每日结算（由定时任务或管理员触发）
  router.post('/city/settlement', async (req, res) => {
    try {
      const today = todayKey();
      const results = [];

      for (const cityId of Object.keys(CITY_CONFIG)) {
        const config = CITY_CONFIG[cityId as keyof typeof CITY_CONFIG];
        ensureCityData(cityId);

        const cityData = db.prepare('SELECT * FROM city_prosperity WHERE cityId = ?').get(cityId);
        if (cityData.lastSettlementDate === today) continue;

        // 计算繁荣度
        const residentCount = db.prepare(`
          SELECT COUNT(*) as count FROM users 
          WHERE homeLocation = ? AND status = 'approved'
        `).get(cityId).count || 0;

        const shopCount = db.prepare(`
          SELECT COUNT(*) as count FROM city_shops 
          WHERE cityId = ? AND status = 'active'
        `).get(cityId).count || 0;

        const prosperity = 
          residentCount * config.prosperityPerResident + 
          shopCount * config.prosperityPerShop;

        // 更新繁荣度
        db.prepare(`
          UPDATE city_prosperity 
          SET prosperity = ?, residentCount = ?, shopCount = ?, lastSettlementDate = ?, updatedAt = ?
          WHERE cityId = ?
        `).run(prosperity, residentCount, shopCount, today, nowIso(), cityId);

        results.push({ cityId, cityName: config.name, prosperity, residentCount, shopCount });
      }

      // 比较两个城市的繁荣度，输家市长扣款
      const slumsData = db.prepare('SELECT * FROM city_prosperity WHERE cityId = ?').get('slums');
      const richData = db.prepare('SELECT * FROM city_prosperity WHERE cityId = ?').get('rich_area');

      let competitionResult = null;
      if (slumsData.mayorUserId && richData.mayorUserId) {
        const slumsMayor = db.prepare('SELECT * FROM users WHERE id = ?').get(slumsData.mayorUserId);
        const richMayor = db.prepare('SELECT * FROM users WHERE id = ?').get(richData.mayorUserId);

        if (slumsMayor && richMayor) {
          const loser = slumsData.prosperity < richData.prosperity ? slumsMayor : richMayor;
          const winner = slumsData.prosperity >= richData.prosperity ? slumsMayor : richMayor;
          
          const penalty = Math.floor(loser.gold * 0.1);
          if (penalty > 0) {
            db.prepare('UPDATE users SET gold = gold - ? WHERE id = ?').run(penalty, loser.id);
            db.prepare('UPDATE users SET gold = gold + ? WHERE id = ?').run(penalty, winner.id);

            competitionResult = {
              winner: winner.name,
              loser: loser.name,
              penalty
            };
          }
        }
      }

      res.json({ 
        success: true, 
        message: '城市繁荣度结算完成',
        results,
        competitionResult
      });
    } catch (error: any) {
      console.error('City settlement error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  return router;
}

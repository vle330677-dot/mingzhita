# 命之塔 - 管理员操作手册

本手册为管理员提供详细的系统管理和运营指导。

## 🔐 管理员权限

### 权限等级
- **超级管理员**：完全权限，可以管理其他管理员
- **普通管理员**：日常运营权限
- **审核员**：仅角色审核权限

### 管理员白名单
管理员账号需要在 `admin_whitelist` 表中注册：
```sql
INSERT INTO admin_whitelist (name, code_name, enabled) 
VALUES ('管理员名称', '代号', 1);
```

## 👥 玩家管理

### 角色审核
1. 查看待审核角色列表
2. 检查角色信息是否符合规范
3. 批准或拒绝申请
4. 拒绝时需要填写原因

### 审核标准
- ✅ 角色名称合理，无违规内容
- ✅ 角色设定完整，符合世界观
- ✅ 精神向导设定合理
- ❌ 拒绝：色情、暴力、政治敏感内容
- ❌ 拒绝：恶意角色名或设定

### 角色状态管理
- **pending** → **approved**：通过审核
- **approved** → **banned**：封禁玩家
- **approved** → **dead**：角色死亡
- **dead** → **ghost**：转化为鬼魂
- **ghost** → **approved**：鬼魂复活（特殊情况）

### 强制下线
```javascript
// 设置玩家强制下线时间
PUT /api/users/:userId/force-offline
{
  "forceOfflineAt": "2024-12-31T23:59:59Z"
}
```

## 💰 经济系统管理

### 金币管理
```javascript
// 增加/扣除金币
POST /api/admin/adjust-gold
{
  "userId": 123,
  "amount": 1000,  // 正数增加，负数扣除
  "reason": "活动奖励"
}
```

### 银行系统监控
- 监控银行总存款量
- 检查异常大额存取
- 调整利息率（默认0.1%/天）

### 拍卖系统管理
```javascript
// 手动创建拍卖
POST /api/guild/auctions/listing
{
  "mode": "custom",
  "name": "稀有道具",
  "description": "活动奖励",
  "itemType": "贵重物品",
  "itemTier": "高阶",
  "startPrice": 500,
  "durationSec": 86400
}
```

### 商铺管理
- 监控商铺数量和分布
- 调整商铺价格（西市10,000G，东市100,000G）
- 关闭违规商铺

## 🏛️ 派系与职位管理

### 职位体系

#### 守塔会
- 守塔会会长（精神SS+，肉体SS+）
- 守塔会成员（精神S+，肉体S+）

#### 恶魔会
- 恶魔会会长（精神SS+，肉体SS+）
- 恶魔会成员（精神S+，肉体S+）

#### 观察者
- 观察者首领（精神SS+，肉体SS+）
- 情报搜集员（精神S+，肉体S+）
- 情报处理员（精神S+，肉体S+）

#### 公会
- 公会会长（精神S+，肉体S+）
- 公会成员（精神C+，肉体C+）
- 冒险者（无限制）

#### 军队
- 军队统帅（精神SS+，肉体SS+）
- 军队副官（精神S+，肉体S+）
- 军队士兵（精神A+，肉体A+）

#### 东市
- 东区市长（精神SS+，肉体SS+）
- 东区副市长（精神S+，肉体S+）
- 东区贵族（无限制）

#### 西市
- 西区市长（精神S+，肉体S+）
- 西区副市长（精神A+，肉体A+）
- 西区居民（无限制）

### 职位变动管理
```javascript
// 强制变更职位
POST /api/admin/change-job
{
  "userId": 123,
  "newJob": "公会会长",
  "reason": "管理员调整"
}
```

### 职位挑战审核
- 监控职位挑战投票
- 必要时介入裁决
- 防止恶意挑战

## 🎯 委托系统管理

### 委托监控
- 查看所有委托状态
- 检查异常高额委托
- 处理委托纠纷

### 委托配置
```javascript
// 委托最低奖励（可在代码中调整）
const COMMISSION_MIN_REWARD = {
  D: 80,
  C: 150,
  B: 280,
  A: 520,
  S: 1000
};

// 暗杀任务奖励翻倍
// 冒险者等级加成：0% ~ 30%
```

### 冒险者系统管理
- 监控冒险者排行榜
- 调整积分和等级
- 处理作弊行为

## 🏙️ 城市繁荣度管理

### 繁荣度计算
```javascript
// 西市繁荣度 = 居民数 × 100 + 商铺数 × 300
// 东市繁荣度 = 居民数 × 1000 + 商铺数 × 3000
```

### 每日结算
```javascript
// 手动触发结算
POST /api/city/settlement
{
  "adminId": 1
}
```

### 市长竞争管理
- 监控繁荣度差距
- 调解市长纠纷
- 必要时调整繁荣度计算规则

### 经济制裁审核
- 检查制裁是否合理
- 防止恶意制裁
- 记录制裁历史

## ⚖️ 军队评理系统管理

### 评理案件监控
```javascript
// 查看所有评理案件
GET /api/army/arbitrations?status=pending&limit=100
```

### 案件处理
1. 查看原告和被告陈述
2. 查看军队成员投票
3. 必要时介入调查
4. 协助军队统帅做出裁决

### 裁决执行
- 监督裁决执行情况
- 处理不服裁决的申诉
- 记录重大案件

### 防止滥用
- 监控恶意评理
- 限制频繁提交
- 处罚虚假指控

## 👻 鬼魂系统管理

### 鬼魂状态监控
```javascript
// 查看鬼魂状态
GET /api/ghost/state?userId=123
```

### 实体化管理
- 监控MP消耗是否合理
- 调整实体化成本（默认：实体化20MP，半实体化10MP）
- 处理实体化相关纠纷

### 鬼魂复活
```javascript
// 特殊情况下复活鬼魂
POST /api/admin/revive-ghost
{
  "userId": 123,
  "reason": "活动奖励"
}
```

## ⚠️ 敏感操作管理

### 确认请求监控
```javascript
// 查看所有待确认操作
GET /api/confirmations?userId=123
```

### 敏感操作类型
1. **death**：角色死亡
2. **become_ghost**：转化为鬼魂
3. **resign_position**：辞去职位
4. **delete_character**：删除角色
5. **transfer_large_amount**：大额转账
6. **sell_rare_item**：出售稀有物品

### 配置调整
```javascript
// 调整确认有效期（5-30分钟）
// 调整需要输入确认文字的操作类型
// 调整倒计时时长（默认5秒）
```

### 异常处理
- 监控频繁的敏感操作
- 检查是否有账号被盗
- 必要时冻结账号

## 📊 数据统计与分析

### 关键指标
- 在线玩家数
- 日活跃用户数
- 金币流通量
- 委托完成率
- 拍卖成交量
- 城市繁荣度趋势

### 数据查询
```sql
-- 查看金币排行
SELECT name, gold FROM users 
WHERE status = 'approved' 
ORDER BY gold DESC LIMIT 20;

-- 查看冒险者排行
SELECT u.name, s.score, s.completedTotal 
FROM guild_adventurer_stats s
JOIN users u ON u.id = s.userId
ORDER BY s.score DESC LIMIT 20;

-- 查看拍卖成交记录
SELECT * FROM observer_library_auction_logs
ORDER BY archivedAt DESC LIMIT 50;

-- 查看评理案件统计
SELECT status, COUNT(*) as count
FROM army_arbitrations
GROUP BY status;
```

## 🎮 活动管理

### 创建活动
1. 设计活动规则
2. 准备活动奖励
3. 发布活动公告
4. 监控活动进度
5. 发放活动奖励

### 活动类型示例
- **限时拍卖**：特殊道具拍卖
- **委托挑战**：高额奖励委托
- **繁荣度竞赛**：城市建设竞赛
- **评理大会**：重大案件公开审理
- **鬼魂狂欢**：鬼魂专属活动

### 奖励发放
```javascript
// 批量发放奖励
POST /api/admin/batch-reward
{
  "userIds": [1, 2, 3],
  "gold": 1000,
  "items": ["稀有道具"],
  "reason": "活动奖励"
}
```

## 🛡️ 安全与反作弊

### 监控重点
- 异常金币增长
- 频繁的敏感操作
- 恶意刷委托
- 拍卖作弊
- 多账号操作

### 处理措施
1. **警告**：首次违规，发送警告
2. **临时封禁**：严重违规，封禁1-7天
3. **永久封禁**：恶意作弊，永久封禁
4. **回滚数据**：必要时回滚作弊数据

### 日志审计
```sql
-- 查看管理员操作日志
SELECT * FROM admin_action_logs
ORDER BY createdAt DESC LIMIT 100;

-- 查看异常金币变动
SELECT * FROM users
WHERE gold > 100000
ORDER BY updatedAt DESC;
```

## 📱 移动端管理

### 移动端优化检查
- 检查按钮大小是否适合触摸
- 检查文字是否清晰可读
- 检查布局是否适配小屏幕
- 检查滑动是否流畅

### 响应式设计要点
- 使用 `max-w-*` 限制最大宽度
- 使用 `md:` 前缀适配桌面端
- 使用 `touch-manipulation` 优化触摸
- 使用 `overflow-y-auto` 处理长列表

## 🔧 系统维护

### 数据库维护
```sql
-- 清理过期数据
DELETE FROM sensitive_operation_confirmations
WHERE status = 'pending' AND expiresAt < datetime('now');

-- 清理旧日志
DELETE FROM admin_action_logs
WHERE createdAt < datetime('now', '-30 days');

-- 优化数据库
VACUUM;
ANALYZE;
```

### 备份策略
- 每日自动备份数据库
- 保留最近30天的备份
- 重大更新前手动备份

### 性能优化
- 监控数据库查询性能
- 添加必要的索引
- 清理冗余数据
- 优化慢查询

## 📞 玩家支持

### 常见问题处理
1. **账号问题**：重置密码、解封账号
2. **金币问题**：补偿丢失金币、调查异常交易
3. **职位问题**：协助职位变更、处理职位纠纷
4. **委托问题**：处理委托纠纷、补偿任务奖励
5. **技术问题**：修复bug、优化体验

### 投诉处理流程
1. 接收玩家投诉
2. 调查事实情况
3. 查看相关日志
4. 做出处理决定
5. 通知相关玩家
6. 记录处理结果

## 📋 管理员日常工作清单

### 每日任务
- [ ] 审核新角色申请
- [ ] 检查系统运行状态
- [ ] 处理玩家投诉
- [ ] 监控异常行为
- [ ] 查看数据统计

### 每周任务
- [ ] 分析玩家活跃度
- [ ] 检查经济平衡
- [ ] 优化游戏体验
- [ ] 策划活动内容
- [ ] 备份重要数据

### 每月任务
- [ ] 总结运营数据
- [ ] 评估系统改进
- [ ] 规划新功能
- [ ] 清理冗余数据
- [ ] 更新管理文档

## 🎯 管理原则

1. **公平公正**：对所有玩家一视同仁
2. **透明公开**：重大决策公开透明
3. **及时响应**：快速处理玩家问题
4. **持续改进**：不断优化游戏体验
5. **尊重玩家**：倾听玩家意见和建议

## 📚 相关文档

- [玩家游戏指南](./PLAYER_GUIDE.md)
- [数据库设计文档](./server/db/schema.ts)
- [API接口文档](./server/routes/)
- [前端组件文档](./src/views/)

---

**重要提醒**：管理员权限强大，请谨慎使用，避免滥用权力。所有管理操作都会被记录在日志中。

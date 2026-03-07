# 千人同时在线部署方案对比

## 🎯 目标：支持 1000+ 并发用户

### 当前架构瓶颈分析

你的项目使用 SQLite + 单实例 Node.js，瓶颈：
- **SQLite**：单文件数据库，并发写入有限（~100 并发）
- **单实例**：无法水平扩展
- **内存限制**：单实例内存有限

**结论：当前架构最多支持 100-200 并发用户**

## 🏆 推荐部署方案（按性价比排序）

### 方案 1：Railway + PostgreSQL（推荐 ⭐⭐⭐⭐⭐）

**优势：**
- ✅ 自动扩展
- ✅ PostgreSQL 支持高并发
- ✅ 配置简单，类似 Zeabur
- ✅ 价格合理（$5-20/月）
- ✅ 免费额度充足

**配置：**
```yaml
服务配置：
- 内存: 2GB
- CPU: 1 核心
- 数据库: PostgreSQL (Shared)
- 预计成本: $10-15/月
- 支持并发: 500-1000 用户
```

**部署步骤：**
1. 注册 [Railway](https://railway.app)
2. 连接 GitHub 仓库
3. 添加 PostgreSQL 服务
4. 配置环境变量
5. 自动部署

**需要修改的代码：**
- 将 SQLite 改为 PostgreSQL
- 使用 `pg` 或 `prisma` 库

---

### 方案 2：Render + PostgreSQL（推荐 ⭐⭐⭐⭐）

**优势：**
- ✅ 免费套餐可用
- ✅ 自动 SSL
- ✅ 自动扩展
- ✅ PostgreSQL 内置

**配置：**
```yaml
服务配置：
- 免费套餐: 512MB 内存
- 付费套餐: $7/月起（1GB 内存）
- 数据库: PostgreSQL 免费 90 天
- 支持并发: 300-800 用户
```

**部署步骤：**
1. 注册 [Render](https://render.com)
2. 连接 GitHub
3. 创建 Web Service
4. 添加 PostgreSQL 数据库
5. 配置环境变量

---

### 方案 3：Fly.io + PostgreSQL（推荐 ⭐⭐⭐⭐）

**优势：**
- ✅ 全球 CDN
- ✅ 自动扩展
- ✅ 按使用量付费
- ✅ 支持多区域部署

**配置：**
```yaml
服务配置：
- 内存: 1GB
- CPU: 1 核心
- 数据库: PostgreSQL
- 预计成本: $10-20/月
- 支持并发: 500-1000 用户
```

**部署步骤：**
1. 安装 Fly CLI
2. `fly launch`
3. 添加 PostgreSQL
4. `fly deploy`

---

### 方案 4：Vercel + Supabase（推荐 ⭐⭐⭐⭐⭐）

**优势：**
- ✅ 前端极速（Vercel）
- ✅ 后端强大（Supabase PostgreSQL）
- ✅ 免费额度大
- ✅ 自动扩展
- ✅ 全球 CDN

**配置：**
```yaml
前端（Vercel）：
- 免费套餐充足
- 全球 CDN
- 自动 HTTPS

后端（Supabase）：
- 免费套餐: 500MB 数据库
- 付费套餐: $25/月（8GB 数据库）
- 支持并发: 1000+ 用户
```

**架构调整：**
- 前端部署到 Vercel
- 后端 API 部署到 Vercel Serverless Functions
- 数据库使用 Supabase PostgreSQL

---

### 方案 5：AWS / 阿里云 / 腾讯云（企业级 ⭐⭐⭐⭐⭐）

**优势：**
- ✅ 无限扩展能力
- ✅ 完全可控
- ✅ 企业级稳定性
- ✅ 支持万人并发

**配置（AWS 示例）：**
```yaml
服务配置：
- EC2: t3.medium (2核4GB) x 2 实例
- RDS: PostgreSQL db.t3.small
- Load Balancer: Application LB
- 预计成本: $50-100/月
- 支持并发: 2000-5000 用户
```

**部署步骤：**
1. 创建 EC2 实例
2. 配置 RDS PostgreSQL
3. 设置 Load Balancer
4. 配置 Auto Scaling
5. 部署应用

---

## 📊 方案对比表

| 平台 | 月成本 | 并发能力 | 难度 | 推荐度 |
|------|--------|----------|------|--------|
| Railway | $10-15 | 500-1000 | ⭐ 简单 | ⭐⭐⭐⭐⭐ |
| Render | $7-15 | 300-800 | ⭐ 简单 | ⭐⭐⭐⭐ |
| Fly.io | $10-20 | 500-1000 | ⭐⭐ 中等 | ⭐⭐⭐⭐ |
| Vercel+Supabase | $0-25 | 1000+ | ⭐⭐ 中等 | ⭐⭐⭐⭐⭐ |
| AWS/阿里云 | $50-100 | 2000-5000 | ⭐⭐⭐⭐ 复杂 | ⭐⭐⭐⭐⭐ |
| Zeabur | $5-10 | 100-200 | ⭐ 简单 | ⭐⭐⭐ |

## 🎯 我的推荐（根据预算）

### 预算 < $20/月：Railway + PostgreSQL
```
最佳性价比，支持 500-1000 并发
配置简单，5 分钟部署
```

### 预算 $20-50/月：Vercel + Supabase
```
前端极速，后端强大
支持 1000+ 并发
免费额度大，超出才付费
```

### 预算 > $50/月：AWS + RDS
```
企业级方案，支持 2000-5000 并发
完全可控，无限扩展
```

## 🔧 代码改造方案

### 从 SQLite 迁移到 PostgreSQL

#### 方案 A：使用 Prisma（推荐）

**1. 安装依赖**
```bash
npm install prisma @prisma/client
npm install -D prisma
```

**2. 初始化 Prisma**
```bash
npx prisma init
```

**3. 定义 Schema**
```prisma
// prisma/schema.prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

model User {
  id        Int      @id @default(autoincrement())
  name      String   @unique
  age       Int      @default(18)
  role      String?
  gold      Int      @default(0)
  status    String   @default("pending")
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

// ... 其他模型
```

**4. 生成客户端**
```bash
npx prisma generate
npx prisma db push
```

**5. 使用 Prisma**
```typescript
// server/db/index.ts
import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();

// 查询示例
const users = await prisma.user.findMany({
  where: { status: 'approved' }
});

// 创建示例
const user = await prisma.user.create({
  data: {
    name: 'test',
    age: 18,
    gold: 0
  }
});
```

#### 方案 B：使用 node-postgres

**1. 安装依赖**
```bash
npm install pg
npm install -D @types/pg
```

**2. 创建连接池**
```typescript
// server/db/index.ts
import { Pool } from 'pg';

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20, // 最大连接数
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// 查询示例
const result = await pool.query(
  'SELECT * FROM users WHERE status = $1',
  ['approved']
);
```

### 性能优化配置

#### PostgreSQL 连接池
```typescript
// server/db/index.ts
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 50, // 千人在线建议 50 个连接
  min: 10, // 最小保持 10 个连接
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});
```

#### Redis 缓存（可选但推荐）
```bash
npm install redis
```

```typescript
// server/cache/redis.ts
import { createClient } from 'redis';

export const redis = createClient({
  url: process.env.REDIS_URL
});

await redis.connect();

// 缓存用户数据
await redis.set(`user:${userId}`, JSON.stringify(user), {
  EX: 300 // 5 分钟过期
});

// 读取缓存
const cached = await redis.get(`user:${userId}`);
```

#### 负载均衡配置
```typescript
// server/app.ts
import cluster from 'cluster';
import os from 'os';

if (cluster.isPrimary && process.env.NODE_ENV === 'production') {
  const numCPUs = os.cpus().length;
  
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }
  
  cluster.on('exit', (worker) => {
    console.log(`Worker ${worker.process.pid} died, restarting...`);
    cluster.fork();
  });
} else {
  startServer();
}
```

## 📋 迁移检查清单

### 数据库迁移
- [ ] 选择目标平台（Railway/Render/Vercel+Supabase）
- [ ] 创建 PostgreSQL 数据库
- [ ] 安装 Prisma 或 pg
- [ ] 定义数据库 Schema
- [ ] 迁移现有数据
- [ ] 测试所有查询

### 应用部署
- [ ] 更新环境变量（DATABASE_URL）
- [ ] 配置连接池
- [ ] 添加 Redis 缓存（可选）
- [ ] 配置负载均衡
- [ ] 压力测试

### 性能优化
- [ ] 添加数据库索引
- [ ] 实现查询缓存
- [ ] 启用 CDN
- [ ] 配置自动扩展
- [ ] 监控和告警

## 🚀 快速开始：Railway 部署

### 1. 注册 Railway
访问 https://railway.app

### 2. 创建项目
```bash
# 安装 Railway CLI
npm install -g @railway/cli

# 登录
railway login

# 初始化项目
railway init

# 添加 PostgreSQL
railway add postgresql

# 部署
railway up
```

### 3. 配置环境变量
```env
DATABASE_URL=postgresql://user:pass@host:5432/db
NODE_ENV=production
PORT=3000
ADMIN_ENTRY_CODE=your_code
```

### 4. 自动部署
连接 GitHub 仓库，每次 push 自动部署

## 💰 成本估算（1000 并发用户）

### Railway 方案
```
应用服务: $10/月 (2GB 内存)
PostgreSQL: $5/月 (Shared)
总计: $15/月
```

### Vercel + Supabase 方案
```
Vercel: $0/月 (免费额度充足)
Supabase: $25/月 (Pro 套餐)
总计: $25/月
```

### AWS 方案
```
EC2 (t3.medium x2): $60/月
RDS (db.t3.small): $25/月
Load Balancer: $15/月
总计: $100/月
```

## 🎯 最终推荐

**如果你是个人开发者或小团队：**
→ **Railway + PostgreSQL**（$15/月，支持 500-1000 并发）

**如果你需要更高性能：**
→ **Vercel + Supabase**（$25/月，支持 1000+ 并发）

**如果你是企业或需要万人并发：**
→ **AWS/阿里云 + RDS + Redis**（$100+/月，支持 5000+ 并发）

## 📞 需要帮助？

我可以帮你：
1. 迁移数据库到 PostgreSQL
2. 配置 Railway/Render 部署
3. 优化性能和并发能力
4. 设置监控和告警

告诉我你选择哪个方案，我会提供详细的迁移指南！

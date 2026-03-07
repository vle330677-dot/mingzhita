# Zeabur + PostgreSQL 性能分析

## 🔍 迁移到 PostgreSQL 后的性能提升

### 性能对比

| 指标 | SQLite | PostgreSQL |
|------|--------|------------|
| **并发读取** | ⭐⭐⭐⭐⭐ 优秀 | ⭐⭐⭐⭐⭐ 优秀 |
| **并发写入** | ⭐⭐ 差（单文件锁） | ⭐⭐⭐⭐⭐ 优秀 |
| **最大并发** | ~100 用户 | 1000+ 用户 |
| **数据库锁** | 整个文件锁定 | 行级锁定 |
| **连接池** | ❌ 不支持 | ✅ 支持 |
| **扩展性** | ❌ 无法扩展 | ✅ 可扩展 |

### 预期性能提升

```
当前（SQLite）：
- 并发能力：100-200 用户
- 写入瓶颈：严重
- 响应时间：200-500ms

迁移后（PostgreSQL）：
- 并发能力：500-1000 用户 ⬆️ 5倍
- 写入瓶颈：大幅改善 ⬆️ 10倍
- 响应时间：50-150ms ⬇️ 70%
```

## ⚠️ 但是！Zeabur 仍有限制

### Zeabur 的瓶颈

即使迁移到 PostgreSQL，Zeabur 仍有以下限制：

#### 1. 资源配额限制
```yaml
免费套餐：
  - 内存：512MB
  - CPU：0.5 核心
  - 并发：~200 用户

基础套餐（$5-10/月）：
  - 内存：1GB
  - CPU：1 核心
  - 并发：~500 用户

专业套餐（$20+/月）：
  - 内存：2GB+
  - CPU：2 核心+
  - 并发：~1000 用户
```

#### 2. 单实例限制
- Zeabur 默认单实例部署
- 无法水平扩展（不能开多个实例）
- 内存和 CPU 有上限

#### 3. 网络延迟
- Zeabur 服务器在国外
- 中国大陆访问延迟 200-500ms
- 影响用户体验

## 🎯 结论：会改善但不够

### 迁移到 PostgreSQL 后

**✅ 会改善的：**
- 数据库并发能力 ⬆️ 5-10倍
- 写入性能 ⬆️ 10倍
- 数据库锁等待 ⬇️ 90%

**❌ 仍然存在的问题：**
- Zeabur 资源配额限制
- 单实例无法扩展
- 国内访问延迟高
- 成本较高（$20+/月才能支持千人）

### 性能预估

| 配置 | SQLite | PostgreSQL |
|------|--------|------------|
| **Zeabur 免费** | 50-100 用户 | 150-300 用户 |
| **Zeabur $10/月** | 100-200 用户 | 300-500 用户 |
| **Zeabur $20/月** | 200-300 用户 | 500-800 用户 |
| **Zeabur $50/月** | 300-400 用户 | 800-1000 用户 |

## 💡 更好的方案

### 方案对比

| 方案 | 成本 | 并发能力 | 国内速度 | 推荐度 |
|------|------|----------|----------|--------|
| **Zeabur + SQLite** | $10 | 100-200 | ⚡ 慢 | ⭐⭐ |
| **Zeabur + PostgreSQL** | $20 | 500-800 | ⚡ 慢 | ⭐⭐⭐ |
| **Railway + PostgreSQL** | $15 | 500-1000 | ⚡ 慢 | ⭐⭐⭐⭐ |
| **腾讯云 + MySQL** | ¥104 | 500-1000 | ⚡⚡⚡ 快 | ⭐⭐⭐⭐⭐ |
| **阿里云 + PostgreSQL** | ¥150 | 1000-2000 | ⚡⚡⚡ 快 | ⭐⭐⭐⭐⭐ |

## 🎯 我的建议

### 如果你坚持用 Zeabur

**步骤 1：迁移到 PostgreSQL**
- 性能提升 3-5 倍
- 支持 300-800 并发（取决于套餐）
- 成本：$15-20/月

**步骤 2：升级 Zeabur 套餐**
- 至少选择 $20/月 套餐
- 2GB 内存 + 2 核心 CPU
- 才能支持 500-800 并发

**总成本：$20-30/月**

### 如果你追求性价比

**推荐：腾讯云轻量 + MySQL**
- 成本：¥104/月（约 $15）
- 并发：500-1000 用户
- 国内访问速度快
- 性价比更高

### 如果你追求性能

**推荐：阿里云 ECS + PostgreSQL**
- 成本：¥150/月（约 $22）
- 并发：1000-2000 用户
- 企业级稳定性
- 可扩展性强

## 📊 详细对比

### Zeabur + PostgreSQL vs 腾讯云 + MySQL

```yaml
Zeabur + PostgreSQL ($20/月):
  优势：
    - 部署简单
    - 自动扩展（有限）
    - 无需运维
  劣势：
    - 国内访问慢（200-500ms 延迟）
    - 单实例限制
    - 成本较高
  并发能力：500-800 用户

腾讯云 + MySQL (¥104/月 ≈ $15):
  优势：
    - 国内访问快（10-50ms 延迟）
    - 可扩展性强
    - 成本更低
  劣势：
    - 需要自己运维
    - 配置稍复杂
  并发能力：500-1000 用户
```

## 🚀 迁移到 PostgreSQL 的步骤

如果你决定在 Zeabur 上使用 PostgreSQL：

### 第 1 步：在 Zeabur 添加 PostgreSQL

1. Zeabur 控制台 → 你的项目
2. 点击 "Add Service"
3. 选择 "PostgreSQL"
4. 自动创建数据库

### 第 2 步：安装 Prisma

```bash
npm install prisma @prisma/client
npm install -D prisma
```

### 第 3 步：初始化 Prisma

```bash
npx prisma init
```

### 第 4 步：定义 Schema

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
  id                Int       @id @default(autoincrement())
  name              String    @unique
  age               Int       @default(18)
  role              String?
  faction           String?
  mentalRank        String?
  physicalRank      String?
  gold              Int       @default(0)
  ability           String?
  spiritName        String?
  spiritType        String?
  avatarUrl         String?
  status            String    @default("pending")
  deathDescription  String?
  profileText       String?
  isHidden          Int       @default(0)
  currentLocation   String?
  homeLocation      String?
  job               String    @default("无")
  hp                Int       @default(100)
  maxHp             Int       @default(100)
  mp                Int       @default(100)
  maxMp             Int       @default(100)
  mentalProgress    Float     @default(0)
  workCount         Int       @default(0)
  trainCount        Int       @default(0)
  lastResetDate     String?
  lastCheckInDate   String?
  loginPasswordHash String?
  roomPasswordHash  String?
  roomBgImage       String?
  roomDescription   String?
  allowVisit        Int       @default(1)
  fury              Int       @default(0)
  guideStability    Int       @default(100)
  partyId           String?
  adminAvatarUrl    String?
  forceOfflineAt    DateTime?
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt

  @@index([name])
  @@index([status])
  @@index([job])
  @@index([faction])
}

// ... 其他模型
```

### 第 5 步：生成客户端

```bash
npx prisma generate
npx prisma db push
```

### 第 6 步：修改代码

```typescript
// server/db/index.ts
import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient({
  log: ['error', 'warn'],
});

// 替换所有 db.prepare() 为 Prisma 查询
// 例如：
// 旧代码：
// const users = db.prepare('SELECT * FROM users WHERE status = ?').all('approved');

// 新代码：
const users = await prisma.user.findMany({
  where: { status: 'approved' }
});
```

### 第 7 步：配置环境变量

在 Zeabur 设置：
```env
DATABASE_URL=postgresql://user:pass@host:5432/db
# Zeabur 会自动注入 PostgreSQL 的 DATABASE_URL
```

### 第 8 步：部署

```bash
git add .
git commit -m "Migrate to PostgreSQL"
git push
```

Zeabur 会自动重新部署。

## 💰 成本对比（千人在线）

### Zeabur + PostgreSQL
```
应用服务：$20/月（2GB 内存）
PostgreSQL：$10/月（Zeabur 托管）
总计：$30/月（约 ¥210）
并发能力：500-800 用户
国内延迟：200-500ms
```

### 腾讯云 + MySQL
```
轻量服务器：¥74/月
云数据库：¥30/月
总计：¥104/月（约 $15）
并发能力：500-1000 用户
国内延迟：10-50ms
```

### 阿里云 + PostgreSQL
```
ECS：¥100/月
RDS PostgreSQL：¥50/月
总计：¥150/月（约 $22）
并发能力：1000-2000 用户
国内延迟：10-50ms
```

## 🎯 最终建议

### 如果你的用户主要在国外
→ **Zeabur + PostgreSQL**（$20-30/月）
- 部署简单
- 支持 500-800 并发
- 国外访问速度快

### 如果你的用户主要在中国
→ **腾讯云 + MySQL**（¥104/月）
- 国内访问速度快 10 倍
- 成本更低
- 支持 500-1000 并发

### 如果你追求极致性能
→ **阿里云 + PostgreSQL**（¥150/月）
- 企业级稳定性
- 支持 1000-2000 并发
- 可扩展到万人

## 📞 我可以帮你

1. **迁移到 PostgreSQL**（完整代码改造）
2. **优化 Zeabur 配置**（提升性能）
3. **部署到腾讯云/阿里云**（更好的方案）
4. **压力测试**（验证并发能力）

告诉我你的选择，我会提供详细的实施方案！

## 🔑 关键结论

**迁移到 PostgreSQL 会改善性能，但：**
- ✅ 数据库性能提升 5-10 倍
- ✅ 并发能力提升到 500-800 用户
- ❌ 仍受 Zeabur 资源限制
- ❌ 国内访问仍然慢
- ❌ 成本较高（$20-30/月）

**更好的选择：**
- 腾讯云/阿里云 + PostgreSQL/MySQL
- 成本更低（¥104-150/月）
- 性能更好（1000-2000 并发）
- 国内访问快 10 倍

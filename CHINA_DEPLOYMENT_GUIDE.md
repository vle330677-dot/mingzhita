# 中国大陆部署方案指南

## 🇨🇳 中国大陆部署特殊考虑

### 关键限制
1. **需要 ICP 备案**（使用自己的域名）
2. **国外平台访问慢**（Railway、Vercel 等在国内速度慢）
3. **需要实名认证**
4. **某些服务被墙**（GitHub、Google 等）

## 🏆 中国大陆推荐方案

### 方案 1：腾讯云轻量应用服务器（最推荐 ⭐⭐⭐⭐⭐）

**优势：**
- ✅ 国内访问速度快
- ✅ 价格便宜（学生优惠）
- ✅ 配置简单
- ✅ 支持 ICP 备案
- ✅ 中文客服

**配置推荐：**
```yaml
套餐：轻量应用服务器
配置：2核4GB内存 + 80GB SSD
带宽：6Mbps
数据库：云数据库 MySQL/PostgreSQL
价格：
  - 学生价：¥10/月（需学生认证）
  - 普通价：¥74/月
  - 数据库：¥30/月起
支持并发：500-1000 用户
```

**部署步骤：**
1. 注册腾讯云账号（需实名认证）
2. 购买轻量应用服务器
3. 选择 Ubuntu 20.04 系统
4. 购买云数据库 MySQL
5. 配置安全组（开放 80、443、3000 端口）
6. 部署应用

---

### 方案 2：阿里云 ECS + RDS（企业级 ⭐⭐⭐⭐⭐）

**优势：**
- ✅ 稳定性最好
- ✅ 生态完善
- ✅ 支持弹性伸缩
- ✅ 企业级服务

**配置推荐：**
```yaml
ECS：
  - 规格：ecs.t6-c1m2.large（2核4GB）
  - 带宽：5Mbps
  - 价格：¥100/月

RDS：
  - 规格：MySQL 5.7（1核2GB）
  - 存储：20GB
  - 价格：¥50/月

总计：¥150/月
支持并发：1000-2000 用户
```

---

### 方案 3：华为云 + GaussDB（高性能 ⭐⭐⭐⭐）

**优势：**
- ✅ 性能强劲
- ✅ 价格适中
- ✅ 技术支持好

**配置推荐：**
```yaml
云服务器：
  - 规格：s6.large.2（2核4GB）
  - 价格：¥80/月

数据库：
  - GaussDB MySQL（1核2GB）
  - 价格：¥40/月

总计：¥120/月
支持并发：800-1500 用户
```

---

### 方案 4：Serverless（按量付费 ⭐⭐⭐⭐）

**腾讯云 Serverless：**
```yaml
云函数 SCF + API 网关
数据库：Serverless MySQL
价格：按实际使用量计费
  - 低流量：¥10-30/月
  - 中流量：¥50-100/月
  - 高流量：¥200+/月
支持并发：自动扩展，理论无限
```

---

### 方案 5：宝塔面板 + VPS（最简单 ⭐⭐⭐⭐⭐）

**优势：**
- ✅ 可视化管理
- ✅ 一键部署
- ✅ 适合新手
- ✅ 支持多种 VPS

**推荐 VPS 提供商：**
```yaml
腾讯云轻量：¥74/月（2核4GB）
阿里云 ECS：¥100/月（2核4GB）
华为云：¥80/月（2核4GB）
```

---

## 📊 方案对比表

| 平台 | 月成本 | 并发能力 | 难度 | 速度 | 推荐度 |
|------|--------|----------|------|------|--------|
| **腾讯云轻量** | ¥74 | 500-1000 | ⭐ 简单 | ⚡⚡⚡ 快 | ⭐⭐⭐⭐⭐ |
| **阿里云 ECS** | ¥150 | 1000-2000 | ⭐⭐ 中等 | ⚡⚡⚡ 快 | ⭐⭐⭐⭐⭐ |
| **华为云** | ¥120 | 800-1500 | ⭐⭐ 中等 | ⚡⚡⚡ 快 | ⭐⭐⭐⭐ |
| **Serverless** | ¥10-200 | 自动扩展 | ⭐⭐⭐ 复杂 | ⚡⚡ 中等 | ⭐⭐⭐⭐ |
| **宝塔面板** | ¥74+ | 500-1000 | ⭐ 简单 | ⚡⚡⚡ 快 | ⭐⭐⭐⭐⭐ |

## 🎯 我的推荐（根据情况）

### 如果你是学生
→ **腾讯云学生机**（¥10/月）
- 最便宜
- 性能够用（300-500 并发）
- 需要学生认证

### 如果你是个人开发者
→ **腾讯云轻量 + 宝塔面板**（¥74/月）
- 配置简单
- 可视化管理
- 支持 500-1000 并发

### 如果你是小团队/创业公司
→ **阿里云 ECS + RDS**（¥150/月）
- 稳定性好
- 支持 1000-2000 并发
- 企业级服务

### 如果流量不稳定
→ **腾讯云 Serverless**（按量付费）
- 自动扩展
- 按实际使用付费
- 低流量时很便宜

## 🚀 详细部署教程

### 方案 A：腾讯云轻量 + 宝塔面板（推荐新手）

#### 第 1 步：购买服务器

1. 访问 [腾讯云轻量应用服务器](https://cloud.tencent.com/product/lighthouse)
2. 选择配置：
   - **地域**：选择离用户最近的（如广州、上海、北京）
   - **镜像**：Ubuntu 20.04 LTS
   - **套餐**：2核4GB 6Mbps（¥74/月）
3. 购买并等待创建完成

#### 第 2 步：安装宝塔面板

```bash
# SSH 连接到服务器
ssh root@你的服务器IP

# 安装宝塔面板（Ubuntu）
wget -O install.sh https://download.bt.cn/install/install-ubuntu_6.0.sh && sudo bash install.sh ed8484bec

# 安装完成后会显示：
# 面板地址: http://你的IP:8888/xxxxxxxx
# 用户名: xxxxxxxx
# 密码: xxxxxxxx
```

#### 第 3 步：配置宝塔面板

1. 浏览器访问面板地址
2. 登录后安装软件：
   - **Nginx** 1.22
   - **MySQL** 5.7 或 8.0
   - **Node.js** 18.x
   - **PM2** 管理器

#### 第 4 步：部署应用

```bash
# 1. 克隆代码
cd /www/wwwroot
git clone https://github.com/你的用户名/mingzhita-main.git
cd mingzhita-main

# 2. 安装依赖
npm install

# 3. 创建 .env 文件
cat > .env << EOF
NODE_ENV=production
PORT=3000
ADMIN_ENTRY_CODE=你的强密码
DB_PATH=/www/wwwroot/mingzhita-main/data/game.db
EOF

# 4. 构建
npm run build

# 5. 使用 PM2 启动
pm2 start npm --name "mingzhita" -- run start
pm2 save
pm2 startup
```

#### 第 5 步：配置 Nginx 反向代理

在宝塔面板：
1. 网站 → 添加站点
2. 域名：你的域名（或 IP）
3. 反向代理：
   ```nginx
   location / {
       proxy_pass http://127.0.0.1:3000;
       proxy_set_header Host $host;
       proxy_set_header X-Real-IP $remote_addr;
       proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
   }
   ```

#### 第 6 步：配置 SSL（可选）

1. 在宝塔面板 → SSL
2. 选择 Let's Encrypt 免费证书
3. 一键申请并部署

---

### 方案 B：阿里云 ECS + RDS（企业级）

#### 第 1 步：购买 ECS

1. 访问 [阿里云 ECS](https://www.aliyun.com/product/ecs)
2. 选择配置：
   - **实例规格**：ecs.t6-c1m2.large（2核4GB）
   - **镜像**：Ubuntu 20.04
   - **带宽**：5Mbps
   - **地域**：华东、华北、华南（选离用户近的）

#### 第 2 步：购买 RDS MySQL

1. 访问 [阿里云 RDS](https://www.aliyun.com/product/rds/mysql)
2. 选择配置：
   - **版本**：MySQL 8.0
   - **规格**：1核2GB
   - **存储**：20GB SSD
   - **地域**：与 ECS 相同

#### 第 3 步：配置安全组

```yaml
入方向规则：
- 端口 22：SSH（仅限你的 IP）
- 端口 80：HTTP
- 端口 443：HTTPS
- 端口 3000：应用（可选，用于调试）
```

#### 第 4 步：部署应用

```bash
# 1. 连接服务器
ssh root@你的ECS公网IP

# 2. 安装 Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# 3. 安装 PM2
npm install -g pm2

# 4. 克隆代码
cd /opt
git clone https://github.com/你的用户名/mingzhita-main.git
cd mingzhita-main

# 5. 安装依赖
npm install

# 6. 配置环境变量
cat > .env << EOF
NODE_ENV=production
PORT=3000
ADMIN_ENTRY_CODE=你的强密码
DATABASE_URL=mysql://用户名:密码@RDS内网地址:3306/数据库名
EOF

# 7. 迁移数据库（如果使用 Prisma）
npx prisma generate
npx prisma db push

# 8. 构建
npm run build

# 9. 启动
pm2 start npm --name "mingzhita" -- run start
pm2 save
pm2 startup
```

#### 第 5 步：配置 Nginx

```bash
# 安装 Nginx
sudo apt update
sudo apt install nginx -y

# 配置反向代理
sudo nano /etc/nginx/sites-available/mingzhita

# 添加以下内容：
server {
    listen 80;
    server_name 你的域名或IP;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}

# 启用配置
sudo ln -s /etc/nginx/sites-available/mingzhita /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

---

### 方案 C：腾讯云 Serverless（按量付费）

#### 第 1 步：安装 Serverless CLI

```bash
npm install -g serverless
```

#### 第 2 步：创建 serverless.yml

```yaml
# serverless.yml
component: express
name: mingzhita

inputs:
  src:
    src: ./
    exclude:
      - .env
      - node_modules/**
  region: ap-guangzhou
  runtime: Nodejs18.13
  apigatewayConf:
    protocols:
      - http
      - https
    environment: release
```

#### 第 3 步：部署

```bash
# 登录腾讯云
serverless login

# 部署
serverless deploy
```

---

## 🔧 数据库迁移（SQLite → MySQL）

### 使用 Prisma 迁移

```bash
# 1. 安装 Prisma
npm install prisma @prisma/client

# 2. 初始化
npx prisma init

# 3. 修改 schema.prisma
datasource db {
  provider = "mysql"
  url      = env("DATABASE_URL")
}

# 4. 定义模型（从 SQLite schema 转换）
# 5. 生成迁移
npx prisma migrate dev --name init

# 6. 应用到生产
npx prisma migrate deploy
```

### 数据迁移脚本

```bash
# 导出 SQLite 数据
sqlite3 game.db .dump > data.sql

# 转换为 MySQL 格式（需要手动调整）
# 导入到 MySQL
mysql -h RDS地址 -u 用户名 -p 数据库名 < data.sql
```

## 📋 ICP 备案流程

### 如果使用自己的域名，必须备案：

1. **准备材料**：
   - 身份证正反面
   - 域名证书
   - 服务器信息

2. **提交备案**：
   - 腾讯云/阿里云控制台 → ICP 备案
   - 填写网站信息
   - 上传材料

3. **等待审核**：
   - 初审：1-2 天
   - 管局审核：10-20 天

4. **备案成功**：
   - 获得备案号
   - 网站底部显示备案号

**注意**：备案期间网站无法访问，建议先用 IP 测试。

## 💰 成本对比（千人在线）

### 腾讯云方案
```
轻量服务器（2核4GB）：¥74/月
云数据库 MySQL：¥30/月
带宽（6Mbps）：包含
CDN（可选）：¥20/月
总计：¥104-124/月
```

### 阿里云方案
```
ECS（2核4GB）：¥100/月
RDS MySQL：¥50/月
带宽（5Mbps）：包含
SLB 负载均衡（可选）：¥30/月
总计：¥150-180/月
```

### Serverless 方案
```
低流量（<1000 请求/天）：¥10-30/月
中流量（1000-10000 请求/天）：¥50-100/月
高流量（>10000 请求/天）：¥200+/月
```

## 🎯 最终推荐

### 预算 < ¥100/月
→ **腾讯云轻量 + 宝塔面板**
- 最简单
- 性价比高
- 支持 500-1000 并发

### 预算 ¥100-200/月
→ **阿里云 ECS + RDS**
- 企业级稳定性
- 支持 1000-2000 并发
- 可扩展性好

### 流量不稳定
→ **腾讯云 Serverless**
- 按量付费
- 自动扩展
- 低流量时便宜

## 📞 需要帮助？

我可以帮你：
1. 选择合适的云服务商和配置
2. 部署应用到腾讯云/阿里云
3. 配置数据库和迁移数据
4. 优化性能和并发能力
5. 协助 ICP 备案

告诉我你的预算和需求，我会提供详细的部署方案！

## 🔗 相关链接

- [腾讯云轻量应用服务器](https://cloud.tencent.com/product/lighthouse)
- [阿里云 ECS](https://www.aliyun.com/product/ecs)
- [华为云](https://www.huaweicloud.com/)
- [宝塔面板](https://www.bt.cn/)
- [ICP 备案指南](https://beian.miit.gov.cn/)

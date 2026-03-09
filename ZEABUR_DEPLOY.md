# 命之塔 - Zeabur + MySQL 部署指南

这份文档对应当前仓库的推荐部署方式：`Zeabur + MySQL`。  
不再建议在 Zeabur 上按旧版 SQLite + Volume 的方式部署。

## 部署拓扑

- 一个 `Git Repository` 应用服务
- 一个 `MySQL` 数据库服务

应用已经兼容以下 MySQL 变量格式：

- `MYSQL_HOST` / `MYSQL_PORT` / `MYSQL_DATABASE`
- `MYSQL_USERNAME` / `MYSQL_PASSWORD`
- `MYSQL_USER` / `MYSQL_PASSWORD`
- `MYSQL_URI`
- `MYSQL_CONNECTION_STRING`

其中 Zeabur 的 MySQL 模板默认提供 `MYSQL_USERNAME`、`MYSQL_URI`、`MYSQL_CONNECTION_STRING`。

## 部署步骤

### 1. 创建项目

1. 把代码推送到 GitHub / GitLab / Bitbucket
2. 登录 [Zeabur](https://zeabur.com)
3. 创建新项目

### 2. 添加 MySQL 服务

1. 在项目中点击 `Add Service`
2. 选择 `MySQL`
3. 等待数据库初始化完成

如果你打算让应用直接连接 Zeabur 里的数据库，不需要再给应用挂载 SQLite Volume。

### 3. 添加应用服务

1. 点击 `Add Service`
2. 选择 `Git Repository`
3. 选择当前仓库
4. 确认 Zeabur 识别为 Node.js 项目

仓库内已提供 `zeabur.json`，默认构建和启动命令如下：

- 构建命令：`npm install && npm run build`
- 启动命令：`npm run start`

### 4. 配置应用环境变量

在应用服务里至少设置这些变量：

```env
NODE_ENV=production
PORT=3000
DB_CLIENT=mysql
ADMIN_ENTRY_CODE=your_strong_random_code
MYSQL_CHARSET=utf8mb4
NODE_OPTIONS=--max-old-space-size=512
```

数据库连接信息有两种方式：

方式一：使用 Zeabur MySQL 服务注入的独立变量

```env
MYSQL_HOST=your-mysql-host
MYSQL_PORT=3306
MYSQL_DATABASE=mingzhita
MYSQL_USERNAME=your-mysql-user
MYSQL_PASSWORD=your-mysql-password
```

方式二：直接提供连接串

```env
MYSQL_URI=mysql://user:password@host:3306/mingzhita
```

或：

```env
MYSQL_CONNECTION_STRING=mysql://user:password@host:3306/mingzhita
```

## 数据迁移

如果你现在的数据还在 SQLite 里，可以先把数据导入 MySQL，再部署到 Zeabur。

本地准备好 MySQL 连接变量后执行：

```bash
npm install
npm run db:mysql:import
```

默认会从以下路径读取旧 SQLite 数据库：

- `SQLITE_IMPORT_PATH`
- 或 `DB_PATH`
- 或 `./data/game.db`

## 健康检查

应用健康检查地址：

```txt
/api/health
```

当前 `zeabur.json` 已按这个路径配置。

## 推荐资源

- CPU：0.5 - 1 Core
- 内存：512MB - 1GB
- MySQL：按实际数据量单独分配

## 常见问题

### 1. 启动时报 MySQL 环境变量缺失

先检查应用服务里是否能读取到以下任一组变量：

- `MYSQL_HOST` + `MYSQL_DATABASE` + `MYSQL_USERNAME` + `MYSQL_PASSWORD`
- `MYSQL_URI`
- `MYSQL_CONNECTION_STRING`

### 2. Zeabur 里明明有数据库，但应用连不上

通常是这几类问题：

- MySQL 服务没有和当前应用放在同一个项目里
- 变量没有注入到应用服务
- 端口、用户名或库名填错
- 复制了外网连接串，但密码或字符集不完整

### 3. 还要不要配置 `/data` Volume

如果你使用的是 Zeabur MySQL，不需要为了主业务数据再挂 SQLite Volume。  
只有你明确要保留 SQLite 备份文件时，才需要额外挂载存储。

### 4. 如何确认当前实例真的跑的是 MySQL

查看应用日志，启动时会输出：

- `DB_TARGET: mysql`
- `MYSQL_HOST: ...`
- `MYSQL_DATABASE: ...`

## 部署检查清单

- [ ] MySQL 服务已创建
- [ ] Git 仓库应用已创建
- [ ] `DB_CLIENT=mysql` 已设置
- [ ] 应用可读取 MySQL 连接变量
- [ ] `/api/health` 返回 200
- [ ] 登录和基础 API 正常
- [ ] 已完成数据库备份策略

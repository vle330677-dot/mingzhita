# 腾讯云轻量应用服务器部署指南

适用范围：当前仓库这套 `React + Vite + Node.js + Express + TypeScript` 项目。

当前项目不是 `Prisma + PostgreSQL` 项目。数据库实际支持的是：

- `SQLite`：默认模式，运行库路径由 `DB_PATH` 控制，当前默认是 `./data/game.db`
- `MySQL`：云数据库可选模式，通过 `DB_CLIENT=mysql` 和 `MYSQL_*` 环境变量启用

## 1. 推荐部署方式

推荐先用腾讯云轻量应用服务器的 Linux 系统镜像部署：

- 镜像：`Ubuntu 22.04 LTS`
- 部署结构：`Nginx -> Node.js(3000) -> SQLite/MySQL`
- 进程守护：`systemd`

这样最接近当前仓库的运行方式，也最容易排查问题。

## 2. 上线前先处理这 4 件事

1. 把生产环境 `.env` 里的 `ADMIN_ENTRY_CODE` 改成高强度随机串。
2. 确认真实数据库在 `data/game.db`，不是仓库根目录那个 `game.db`。
3. 如果继续用 SQLite，上传时必须连同 `data/game.db-wal` 和 `data/game.db-shm` 一起处理。
4. 发布前执行一次 `npm run build`，不要让生产环境长期跑 Vite 中间件模式。

## 3. 创建轻量应用服务器

推荐在控制台创建一台新实例，然后：

1. 选择 `操作系统镜像`
2. 选择 `Ubuntu 22.04 LTS`
3. 记录公网 IP
4. 在防火墙里放行 `22`、`80`、`443`

官方文档：

- 轻量应用服务器产品文档：https://cloud.tencent.com/document/product/1207
- 防火墙配置说明：https://cloud.tencent.com/document/product/1207/116490
- 登录 Linux 实例：https://cloud.tencent.com/document/product/1207/41889

如果你用中国大陆地域并绑定自己的域名，对外正式提供网站服务前还要做备案。

## 4. 连接服务器并安装运行环境

以 `root` 登录后执行：

```bash
apt update
apt install -y nginx git curl build-essential
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
npm install -g pm2
node -v
npm -v
```

说明：

- 当前项目依赖 `better-sqlite3`，所以需要 `build-essential`
- 用 `Node.js 20` 比较稳
- 这里虽然装了 `pm2`，但本项目更推荐最终交给 `systemd`

## 5. 上传项目

推荐目录：

```bash
mkdir -p /var/www
cd /var/www
```

把本地项目上传到：

```text
/var/www/mingzhita
```

上传时注意：

- 不要把本地 `.env` 直接原样公开传给别人
- 如果你要带历史数据上线，优先上传整个 `data/` 目录
- 当前仓库根目录那个 `game.db` 不是默认运行库，别拿错

## 6. 配置环境变量

进入项目目录：

```bash
cd /var/www/mingzhita
cp .env.example .env
```

### SQLite 方案

编辑 `.env`：

```env
NODE_ENV=production
PORT=3000
ADMIN_ENTRY_CODE=改成高强度随机串
DB_CLIENT=sqlite
DB_PATH=./data/game.db
```

### MySQL 方案

如果你准备接腾讯云 MySQL：

```env
NODE_ENV=production
PORT=3000
ADMIN_ENTRY_CODE=改成高强度随机串
DB_CLIENT=mysql
MYSQL_HOST=你的数据库内网地址
MYSQL_PORT=3306
MYSQL_USER=你的数据库账号
MYSQL_PASSWORD=你的数据库密码
MYSQL_DATABASE=mingzhita
MYSQL_CHARSET=utf8mb4
```

注意：这套项目不使用 `DATABASE_URL` 和 Prisma。

### 如果你要把现有 SQLite 数据导入 MySQL

先确保服务器上的 `data/` 目录已经包含完整的：

- `game.db`
- `game.db-wal`
- `game.db-shm`

然后在项目目录执行：

```bash
cd /var/www/mingzhita
npm run db:mysql:import
```

当前导入脚本会自动读取项目根目录的 `.env`，并把 SQLite 里的表数据导入你配置好的 MySQL。

## 7. 安装依赖并构建

```bash
cd /var/www/mingzhita
npm install
npm run build
```

如果这里失败，先不要继续配 Nginx，先把编译问题处理干净。

## 8. 配置 systemd

把仓库里的示例文件复制到系统目录：

```bash
cp deploy/mingzhita.service.example /etc/systemd/system/mingzhita.service
```

如果 `npm` 不在 `/usr/bin/npm`，先执行 `which npm`，再把服务文件里的 `ExecStart` 改成真实路径。

然后执行：

```bash
systemctl daemon-reload
systemctl enable mingzhita
systemctl start mingzhita
systemctl status mingzhita
```

看日志：

```bash
journalctl -u mingzhita -n 100 --no-pager
```

## 9. 配置 Nginx 反向代理

复制示例配置：

```bash
cp deploy/nginx.mingzhita.conf.example /etc/nginx/sites-available/mingzhita.conf
ln -s /etc/nginx/sites-available/mingzhita.conf /etc/nginx/sites-enabled/mingzhita.conf
nginx -t
systemctl reload nginx
```

然后把 `server_name example.com;` 改成你的域名；如果暂时没有域名，也可以先改成服务器公网 IP。

## 10. 验证服务

先在服务器本机验证：

```bash
curl http://127.0.0.1:3000/api/health
```

预期返回：

```json
{"ok":true,"ts":1700000000000}
```

再从浏览器访问：

- `http://你的域名/`
- `http://你的域名/api/health`

## 11. SQLite 特别注意

当前项目启动时会启用 SQLite WAL：

- `game.db`
- `game.db-wal`
- `game.db-shm`

所以迁移数据时：

1. 最稳的方法是先停服务
2. 然后整套复制 `data/` 目录
3. 不要只复制一个 `game.db`

如果你只上传了主库文件，最近写入的数据可能丢失。

## 12. 推荐的上线顺序

1. 先用 SQLite 跑通整站
2. 确认后台、登录、地图、公告、灾厄流程都能正常进入
3. 再决定要不要切到腾讯云 MySQL
4. 切库前先备份 `data/` 目录

## 13. 常见错误

### 页面能开，但接口 404

通常是 Node 服务没起来，或者 Nginx 没有转发到 `127.0.0.1:3000`。

### 服务启动了，但数据是空的

通常是 `DB_PATH` 指错了，或者你上传漏了 `game.db-wal` / `game.db-shm`。

### 生产环境还在跑 Vite

说明 `dist/` 没构建出来。当前服务端代码会自动回退到 Vite 中间件模式，但这只适合开发，不适合长期线上运行。

### 管理员进不去后台

优先检查：

- `.env` 里的 `ADMIN_ENTRY_CODE`
- 管理员白名单里是否已经有对应管理员

## 14. 本仓库内可直接参考的文件

- `deploy/mingzhita.service.example`
- `deploy/nginx.mingzhita.conf.example`
- `.env.example`

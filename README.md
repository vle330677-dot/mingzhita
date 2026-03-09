# 命之塔 (Tower of Life)

一个基于 Web 的多人在线角色扮演游戏。

## 📚 文档

- [玩家游戏指南](./PLAYER_GUIDE.md) - 游戏玩法和机制说明
- [管理员操作手册](./ADMIN_MANUAL.md) - 管理员功能和操作指南
- [Zeabur 部署指南](./ZEABUR_DEPLOY.md) - 详细的部署步骤
- [性能优化指南](./PERFORMANCE_GUIDE.md) - 性能优化和问题排查

## 🚀 快速开始

### 本地运行

1. 安装依赖：
   ```bash
   npm install
   ```

2. 创建 `.env` 文件：
   ```env
   PORT=3000
   NODE_ENV=development
   ADMIN_ENTRY_CODE=your_admin_code
   DB_CLIENT=mysql
   MYSQL_HOST=127.0.0.1
   MYSQL_PORT=3306
   MYSQL_USERNAME=mingzhita
   MYSQL_PASSWORD=change_me
   MYSQL_DATABASE=mingzhita
   MYSQL_CHARSET=utf8mb4
   ```

   也兼容 `MYSQL_USER`，但 Zeabur 的 MySQL 服务默认提供的是 `MYSQL_USERNAME`。

3. 启动开发服务器：
   ```bash
   npm run dev
   ```

4. 访问 `http://localhost:3000`

### 从现有 SQLite 数据迁移到 MySQL

如果你当前数据还在 `data/game.db`，先在 `.env` 中保留：

```env
SQLITE_IMPORT_PATH=./data/game.db
```

然后执行：

```bash
npm run db:mysql:import
```

### 生产构建

```bash
npm run build
npm run start
```

## 🌐 Zeabur 部署

### 快速部署

1. 推送代码到 Git 仓库
2. 在 [Zeabur](https://zeabur.com) 创建项目
3. 连接你的仓库
4. 添加一个 MySQL 服务
5. 确保应用服务能读取 MySQL 连接变量
6. 配置应用环境变量（见下方）

### 必需环境变量

```env
NODE_ENV=production
ADMIN_ENTRY_CODE=<strong_random_code>
DB_CLIENT=mysql
MYSQL_HOST=your-mysql-host
MYSQL_PORT=3306
MYSQL_DATABASE=mingzhita
MYSQL_USERNAME=your-mysql-user
MYSQL_PASSWORD=your-mysql-password
MYSQL_CHARSET=utf8mb4
PORT=3000
NODE_OPTIONS=--max-old-space-size=512
```

也支持直接提供连接串：

```env
MYSQL_URI=mysql://user:password@host:3306/mingzhita
```

或：

```env
MYSQL_CONNECTION_STRING=mysql://user:password@host:3306/mingzhita
```

Zeabur 的 MySQL 模板默认会提供 `MYSQL_HOST`、`MYSQL_PORT`、`MYSQL_DATABASE`、`MYSQL_USERNAME`、`MYSQL_PASSWORD`、`MYSQL_URI`、`MYSQL_CONNECTION_STRING`。代码现在已经兼容这些变量名。

详细部署步骤请查看 [ZEABUR_DEPLOY.md](./ZEABUR_DEPLOY.md)

## ⚡ 性能优化

项目已内置以下优化：

- ✅ **数据库优化**：MySQL 兼容层、索引、缓存配置
- ✅ **限流保护**：防止恶意请求（200 请求/分钟）
- ✅ **响应压缩**：Gzip 压缩，减少 60-80% 传输量
- ✅ **智能缓存**：内存缓存热点数据
- ✅ **静态资源优化**：长期缓存 JS/CSS/图片

如遇性能问题，请参考 [PERFORMANCE_GUIDE.md](./PERFORMANCE_GUIDE.md)

## 🛠️ 技术栈

- **前端**：React 19 + TypeScript + Tailwind CSS + Motion
- **后端**：Node.js + Express + TypeScript
- **数据库**：MySQL（Zeabur 推荐，兼容导入现有 SQLite 数据）
- **构建工具**：Vite

## 📦 项目结构

```
mingzhita-main/
├── src/                    # 前端源码
│   ├── views/             # 页面组件
│   ├── utils/             # 工具函数
│   └── App.tsx            # 主应用
├── server/                # 后端源码
│   ├── routes/            # API 路由
│   ├── middleware/        # 中间件（限流、缓存、压缩）
│   ├── db/                # 数据库配置
│   └── app.ts             # 服务器入口
├── public/                # 静态资源
├── dist/                  # 构建输出
└── data/                  # 数据库文件
```

## 🔒 安全特性

- 密码哈希（bcrypt）
- 会话管理和令牌验证
- 限流保护
- 管理员白名单
- 敏感操作二次确认

## 📝 注意事项

- 如果你仍在用 SQLite 过渡，可继续设置 `DB_CLIENT=sqlite` 和 `DB_PATH=./data/game.db`
- 生产环境：如果 `dist/` 缺失，服务器会回退到 Vite 中间件模式保持服务可用
- 如果使用 MySQL，请先确认 `MYSQL_HOST`、`MYSQL_DATABASE`、`MYSQL_USERNAME`（或 `MYSQL_USER`）已正确填写，或已提供 `MYSQL_URI`

## 🐛 问题排查

### 多人登录卡顿？
1. 检查 Zeabur 资源配额（建议至少 512MB 内存）
2. 查看 [PERFORMANCE_GUIDE.md](./PERFORMANCE_GUIDE.md)
3. 考虑升级套餐或优化查询

### 数据丢失？
1. 如果你仍在用 SQLite 过渡环境，确认已配置持久化存储
2. 如果是 Zeabur + MySQL，先检查 MySQL 服务是否正常以及连接变量是否已注入应用
3. 定期备份 MySQL 数据库

### 部署失败？
1. 检查环境变量是否正确
2. 查看 Zeabur 日志
3. 确认 Node.js 版本兼容（推荐 18+）

## 📄 许可证

本项目仅供学习和研究使用。

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

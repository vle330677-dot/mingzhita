# 命之塔 - Zeabur 部署指南

## 快速部署

### 1. 准备工作

确保你的项目已经推送到 Git 仓库（GitHub/GitLab/Bitbucket）。

### 2. Zeabur 部署步骤

1. 访问 [Zeabur](https://zeabur.com)
2. 登录并创建新项目
3. 点击 "Add Service" → "Git Repository"
4. 选择你的仓库
5. Zeabur 会自动检测 Node.js 项目

### 3. 环境变量配置

在 Zeabur 控制台设置以下环境变量：

```env
# 必需
NODE_ENV=production
ADMIN_ENTRY_CODE=your_strong_random_code_here
PORT=3000

# 数据库路径（使用持久化存储）
DB_PATH=/data/game.db

# 性能优化
NODE_OPTIONS=--max-old-space-size=512
```

### 4. 持久化存储配置

1. 在 Zeabur 控制台点击 "Add Volume"
2. 挂载路径：`/data`
3. 大小：至少 1GB

### 5. 构建配置

Zeabur 会自动使用 `package.json` 中的脚本：

- **构建命令**：`npm install && npm run build`
- **启动命令**：`npm run start`

### 6. 域名配置

1. 在 Zeabur 控制台点击 "Domains"
2. 添加自定义域名或使用 Zeabur 提供的域名
3. 配置 DNS 记录（如果使用自定义域名）

## 性能优化配置

### 推荐资源配置

- **CPU**：0.5 - 1 核心
- **内存**：512MB - 1GB
- **磁盘**：1GB SSD（持久化存储）

### 自动扩展（可选）

如果用户量大，可以配置自动扩展：
- 最小实例：1
- 最大实例：3
- CPU 阈值：70%

## 监控和维护

### 健康检查

Zeabur 会自动监控 `/api/health` 端点。

### 日志查看

在 Zeabur 控制台查看实时日志：
1. 点击服务
2. 选择 "Logs" 标签
3. 查看应用日志和错误信息

### 数据库备份

定期备份数据库文件：
1. 使用 Zeabur CLI 下载 `/data/game.db`
2. 或者在应用中添加自动备份脚本

## 常见问题

### Q: 部署后无法访问？
A: 检查：
- 环境变量是否正确设置
- PORT 是否设置为 3000
- 构建是否成功

### Q: 数据丢失？
A: 确保：
- 已配置持久化存储（Volume）
- DB_PATH 指向 `/data/game.db`
- 定期备份数据库

### Q: 性能慢？
A: 参考 `PERFORMANCE_GUIDE.md` 进行优化：
- 升级资源配额
- 启用缓存
- 优化数据库查询

### Q: 如何更新代码？
A: 
1. 推送代码到 Git 仓库
2. Zeabur 会自动检测并重新部署
3. 或者在控制台手动触发部署

## 成本估算

Zeabur 定价（参考）：
- **免费套餐**：适合测试，有限制
- **基础套餐**：$5-10/月，适合小型项目
- **专业套餐**：$20-50/月，适合中型项目

## 安全建议

1. **强密码**：使用强随机密码作为 `ADMIN_ENTRY_CODE`
2. **HTTPS**：Zeabur 自动提供 SSL 证书
3. **限流**：已内置限流中间件
4. **定期更新**：保持依赖包最新

## 技术支持

- Zeabur 文档：https://zeabur.com/docs
- Zeabur Discord：https://discord.gg/zeabur
- 项目 Issues：在你的 Git 仓库提交问题

## 部署检查清单

- [ ] 代码推送到 Git 仓库
- [ ] 在 Zeabur 创建项目
- [ ] 配置环境变量
- [ ] 配置持久化存储
- [ ] 测试健康检查端点
- [ ] 配置域名
- [ ] 测试登录功能
- [ ] 测试数据持久化
- [ ] 查看日志确认无错误
- [ ] 设置数据库备份计划

部署完成后，访问你的域名即可开始使用！

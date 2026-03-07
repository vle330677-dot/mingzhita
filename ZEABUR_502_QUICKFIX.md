# Zeabur 502 错误 - 快速修复指南

## 🎯 你的代码已经正确配置！

我检查了你的代码，端口监听配置是正确的：
```typescript
app.listen(PORT, '0.0.0.0', () => { ... });
```

## 🔍 现在需要检查 Zeabur 配置

### 第 1 步：查看 Zeabur 日志

**这是最重要的一步！**

1. 登录 Zeabur 控制台
2. 找到你的服务
3. 点击 **"Logs"** 标签
4. 查看最新的日志输出

你应该能看到：
```
=== Starting Server ===
NODE_ENV: production
PORT: 3000
DB_PATH: /data/game.db
ADMIN_ENTRY_CODE: ✓ Set
Server running on port 3000
```

**如果看到错误，把错误信息发给我！**

### 第 2 步：检查环境变量

在 Zeabur 控制台设置这些变量：

| 变量名 | 值 | 必需 |
|--------|-----|------|
| `NODE_ENV` | `production` | ✅ 是 |
| `PORT` | `3000` | ✅ 是 |
| `ADMIN_ENTRY_CODE` | 你的密码 | ✅ 是 |
| `DB_PATH` | `/data/game.db` | ⚠️ 如果用数据库 |
| `NODE_OPTIONS` | `--max-old-space-size=512` | 建议 |

### 第 3 步：检查持久化存储（如果使用数据库）

1. Zeabur 控制台 → 你的服务
2. 找到 **"Volumes"** 或 **"Storage"** 选项
3. 添加卷：
   - **挂载路径**: `/data`
   - **大小**: 1GB

### 第 4 步：重新部署

1. 提交并推送代码到 Git
2. Zeabur 会自动重新部署
3. 或者在控制台点击 **"Redeploy"**

## 🚨 常见错误及解决方案

### 错误 1：日志显示 "ADMIN_ENTRY_CODE: ✗ Missing"

**解决：** 在 Zeabur 添加环境变量 `ADMIN_ENTRY_CODE`

### 错误 2：日志显示 "SQLITE_CANTOPEN"

**解决：** 
1. 添加持久化存储（挂载到 `/data`）
2. 设置 `DB_PATH=/data/game.db`

### 错误 3：日志显示 "Cannot find module"

**解决：** 
1. 检查 `package.json` 中的依赖
2. 确认构建命令是 `npm install && npm run build`
3. 重新部署

### 错误 4：日志显示 "Killed"

**解决：** 内存不足
1. 升级 Zeabur 资源配额（至少 512MB）
2. 添加 `NODE_OPTIONS=--max-old-space-size=512`

### 错误 5：没有任何日志输出

**解决：** 应用根本没启动
1. 检查构建是否成功
2. 检查 Start Command 是否是 `npm run start`
3. 检查 `package.json` 中的 scripts

## 📋 完整检查清单

逐项检查：

```
□ 查看 Zeabur 日志（最重要！）
□ 环境变量 NODE_ENV=production
□ 环境变量 PORT=3000
□ 环境变量 ADMIN_ENTRY_CODE 已设置
□ 如果用数据库：添加了持久化存储
□ 如果用数据库：DB_PATH=/data/game.db
□ Build Command: npm install && npm run build
□ Start Command: npm run start
□ 代码已推送到 Git
□ 已触发重新部署
```

## 🎬 操作视频指南

### 查看日志
```
1. 打开 Zeabur 控制台
2. 点击你的项目
3. 点击你的服务（mingzhita）
4. 点击顶部的 "Logs" 标签
5. 查看实时日志输出
```

### 添加环境变量
```
1. 在服务页面
2. 点击 "Variables" 或 "环境变量" 标签
3. 点击 "Add Variable" 或 "添加变量"
4. 输入变量名和值
5. 点击保存
```

### 添加持久化存储
```
1. 在服务页面
2. 点击 "Volumes" 或 "存储" 标签
3. 点击 "Add Volume" 或 "添加卷"
4. 挂载路径输入: /data
5. 大小选择: 1GB
6. 点击创建
```

## 💡 测试健康检查

部署成功后，访问：
```
https://your-domain.zeabur.app/api/health
```

应该返回：
```json
{
  "ok": true,
  "ts": 1234567890,
  "env": "production",
  "port": "3000"
}
```

## 🆘 仍然 502？

把以下信息发给我：

1. **Zeabur 日志的完整输出**（截图或复制文本）
2. **环境变量列表**（隐藏 ADMIN_ENTRY_CODE 的值）
3. **是否添加了持久化存储**
4. **Zeabur 资源配额**（内存、CPU）

## 🎯 90% 的情况是这 3 个原因

1. **环境变量缺失** - 特别是 `ADMIN_ENTRY_CODE`
2. **数据库路径错误** - 没有添加持久化存储
3. **内存不足** - 需要升级资源配额

**立即去查看 Zeabur 日志，那里有答案！**

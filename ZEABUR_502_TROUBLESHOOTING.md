# Zeabur 502 错误排查指南

## 🔍 502 错误原因

502 Bad Gateway 表示 Zeabur 的网关无法连接到你的应用，常见原因：

### 1. 应用启动失败（最常见 60%）
- 端口配置错误
- 环境变量缺失
- 依赖安装失败
- 代码运行时错误

### 2. 应用崩溃（20%）
- 内存不足被杀死
- 未捕获的异常
- 数据库连接失败

### 3. 启动超时（15%）
- 应用启动时间过长
- 数据库初始化慢

### 4. 端口监听错误（5%）
- 监听了错误的端口
- 监听了 localhost 而不是 0.0.0.0

## 🛠️ 立即排查步骤

### 第 1 步：查看日志（最重要！）

1. 进入 Zeabur 控制台
2. 点击你的服务
3. 点击 **"Logs"** 标签
4. 查看最新的错误信息

**常见错误信息：**

```bash
# 错误 1：端口错误
Error: listen EADDRINUSE: address already in use :::3000
# 解决：检查 PORT 环境变量

# 错误 2：模块未找到
Error: Cannot find module 'xxx'
# 解决：检查 package.json 和 node_modules

# 错误 3：环境变量缺失
Error: ADMIN_ENTRY_CODE is required
# 解决：添加缺失的环境变量

# 错误 4：数据库错误
Error: SQLITE_CANTOPEN: unable to open database file
# 解决：检查 DB_PATH 和持久化存储

# 错误 5：内存不足
Killed
# 解决：升级资源配额
```

### 第 2 步：检查环境变量

确保设置了所有必需的环境变量：

```env
# 必需
NODE_ENV=production
PORT=3000
ADMIN_ENTRY_CODE=your_strong_code

# 数据库（如果使用持久化存储）
DB_PATH=/data/game.db

# 性能优化
NODE_OPTIONS=--max-old-space-size=512
```

**检查方法：**
1. Zeabur 控制台 → 你的服务 → Variables 标签
2. 确认所有变量都已设置
3. 特别注意 `PORT=3000`

### 第 3 步：检查端口配置

你的代码必须监听 `0.0.0.0`，不能是 `localhost`：

```typescript
// ✅ 正确
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});

// ❌ 错误
app.listen(PORT, 'localhost', () => {
  console.log(`Server running on port ${PORT}`);
});

// ❌ 错误（默认是 localhost）
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
```

### 第 4 步：检查构建配置

确认 Zeabur 使用了正确的构建命令：

**Build Command:**
```bash
npm install && npm run build
```

**Start Command:**
```bash
npm run start
```

**检查 package.json：**
```json
{
  "scripts": {
    "dev": "tsx server.ts",
    "build": "vite build",
    "start": "tsx server.ts"
  }
}
```

### 第 5 步：检查持久化存储

如果使用数据库，必须配置持久化存储：

1. Zeabur 控制台 → 你的服务
2. 点击 **"Volumes"** 或 **"Storage"**
3. 确认已添加卷：
   - **挂载路径**: `/data`
   - **大小**: 至少 1GB

4. 环境变量中设置：
   ```env
   DB_PATH=/data/game.db
   ```

## 🔧 常见问题解决方案

### 问题 1：端口错误

**症状：** 日志显示 `EADDRINUSE` 或 `port already in use`

**解决：**
```typescript
// server/app.ts
const PORT = Number(process.env.PORT || 3000);
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
```

确保环境变量：
```env
PORT=3000
```

### 问题 2：依赖安装失败

**症状：** 日志显示 `Cannot find module`

**解决：**
1. 检查 `package.json` 中的依赖是否完整
2. 确认 `node_modules` 被正确安装
3. 尝试重新部署

**检查 package.json：**
```json
{
  "dependencies": {
    "express": "^4.21.2",
    "better-sqlite3": "^12.4.1",
    "tsx": "^4.21.0",
    // ... 其他依赖
  }
}
```

### 问题 3：数据库文件无法创建

**症状：** 日志显示 `SQLITE_CANTOPEN` 或 `unable to open database`

**解决：**
1. 确认已添加持久化存储（Volume）
2. 挂载路径必须是 `/data`
3. 环境变量设置：
   ```env
   DB_PATH=/data/game.db
   ```

### 问题 4：内存不足

**症状：** 日志显示 `Killed` 或 `Out of memory`

**解决：**
1. 升级 Zeabur 资源配额（至少 512MB）
2. 添加环境变量：
   ```env
   NODE_OPTIONS=--max-old-space-size=512
   ```

### 问题 5：启动超时

**症状：** 应用启动时间过长，Zeabur 超时

**解决：**
1. 优化数据库初始化
2. 减少启动时的同步操作
3. 使用异步初始化

```typescript
// server/app.ts
export async function startServer() {
  const app = express();
  
  // 先启动服务器
  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
  });
  
  // 然后异步初始化数据库
  setTimeout(() => {
    const db = initDb();
    // ... 其他初始化
  }, 0);
}
```

### 问题 6：环境变量缺失

**症状：** 日志显示某个变量 `undefined` 或 `required`

**解决：**
在 Zeabur 添加所有必需的环境变量：
```env
NODE_ENV=production
PORT=3000
ADMIN_ENTRY_CODE=your_code_here
DB_PATH=/data/game.db
```

## 📋 完整检查清单

逐项检查：

- [ ] 查看 Zeabur 日志，找到具体错误信息
- [ ] 确认 `PORT=3000` 环境变量已设置
- [ ] 确认 `NODE_ENV=production` 已设置
- [ ] 确认 `ADMIN_ENTRY_CODE` 已设置
- [ ] 确认代码监听 `0.0.0.0` 而不是 `localhost`
- [ ] 确认 Build Command 是 `npm install && npm run build`
- [ ] 确认 Start Command 是 `npm run start`
- [ ] 如果使用数据库，确认已添加持久化存储
- [ ] 确认 `DB_PATH=/data/game.db` 已设置
- [ ] 确认 package.json 中的依赖完整
- [ ] 尝试重新部署

## 🚀 快速修复步骤

### 方案 1：重新部署

1. Zeabur 控制台 → 你的服务
2. 点击 **"Redeploy"** 或 **"重新部署"**
3. 等待构建完成
4. 查看日志

### 方案 2：检查代码

确认 `server/app.ts` 中的监听配置：

```typescript
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT} (${useProdStatic ? 'static' : 'vite-middleware'} mode)`);
});
```

### 方案 3：本地测试

在本地模拟生产环境：

```bash
# 设置环境变量
$env:NODE_ENV="production"
$env:PORT="3000"
$env:ADMIN_ENTRY_CODE="test123"

# 构建
npm run build

# 启动
npm run start

# 测试
curl http://localhost:3000/api/health
```

如果本地能运行，说明是 Zeabur 配置问题。

## 🔍 调试技巧

### 添加详细日志

在 `server/app.ts` 中添加：

```typescript
export async function startServer() {
  console.log('=== Server Starting ===');
  console.log('NODE_ENV:', process.env.NODE_ENV);
  console.log('PORT:', process.env.PORT);
  console.log('DB_PATH:', process.env.DB_PATH);
  
  const app = express();
  const PORT = Number(process.env.PORT || 3000);
  
  console.log('Initializing database...');
  const db = initDb();
  console.log('Database initialized');
  
  console.log('Setting up routes...');
  // ... 路由配置
  
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Server successfully started on port ${PORT}`);
  });
}
```

### 健康检查端点

确认健康检查端点正常：

```typescript
app.get('/api/health', (_req, res) => {
  res.json({ 
    ok: true, 
    ts: Date.now(),
    env: process.env.NODE_ENV,
    port: process.env.PORT
  });
});
```

## 📞 仍然无法解决？

提供以下信息：

1. **Zeabur 日志截图**（最重要！）
2. **环境变量列表**（隐藏敏感信息）
3. **package.json 内容**
4. **本地是否能正常运行**
5. **Zeabur 资源配额**（内存、CPU）

## 💡 预防措施

部署前检查：

```bash
# 1. 本地生产环境测试
npm run build
NODE_ENV=production npm run start

# 2. 检查端口
netstat -ano | findstr :3000

# 3. 测试健康检查
curl http://localhost:3000/api/health

# 4. 检查依赖
npm list --depth=0
```

## 🎯 最可能的原因

根据经验，502 错误 90% 是以下原因之一：

1. **端口配置错误** - 检查 PORT 环境变量和监听地址
2. **环境变量缺失** - 检查所有必需的环境变量
3. **数据库路径错误** - 检查 DB_PATH 和持久化存储
4. **依赖安装失败** - 查看构建日志

**立即去查看 Zeabur 日志，那里有答案！**

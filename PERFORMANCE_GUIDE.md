# 命之塔性能优化指南

## 已实施的优化措施

### 1. 数据库优化 ✅

#### SQLite 配置优化
- **WAL 模式**：读写并发，不互相阻塞
- **同步级别 NORMAL**：平衡性能和安全性
- **内存缓存 20MB**：减少磁盘 I/O
- **MMAP 64MB**：利用操作系统页缓存
- **Busy timeout 5秒**：并发写时等待而不是立即失败

#### 数据库索引
已为高频查询字段添加索引：
- `users` 表：name, status, job, faction, homeLocation
- `user_sessions` 表：userId, role, revokedAt
- `announcements` 表：createdAt
- `admin_action_logs` 表：createdAt

### 2. 服务器中间件优化 ✅

#### 限流中间件 (Rate Limiting)
- 全局限流：200 请求/分钟
- 基于用户 ID 或 IP 地址
- 防止恶意请求和 DDoS 攻击

#### 响应压缩 (Compression)
- 自动 gzip/deflate 压缩
- 只压缩 >1KB 的响应
- 减少 60-80% 的传输数据量

#### 缓存中间件 (Cache)
- 内存缓存 GET 请求
- 公告和房间列表缓存 30 秒
- 自动清理过期缓存

#### 静态资源优化
- JS/CSS 文件：强缓存 1 年（immutable）
- 图片文件：缓存 7 天
- HTML 文件：不缓存（确保更新及时）

### 3. 前端优化建议

#### 代码分割
```typescript
// 使用 React.lazy 懒加载组件
const AdminView = lazy(() => import('./views/AdminView'));
const GuildView = lazy(() => import('./views/GuildView'));
```

#### 请求优化
```typescript
// 使用防抖减少请求频率
import { debounce } from 'lodash';

const debouncedSearch = debounce((query) => {
  apiFetch(`/api/search?q=${query}`);
}, 300);
```

#### 虚拟滚动
对于长列表（如玩家列表、委托列表），使用虚拟滚动：
```bash
npm install react-window
```

### 4. Zeabur 部署配置

#### 环境变量
```env
NODE_ENV=production
PORT=3000
DB_PATH=/data/game.db
ADMIN_ENTRY_CODE=your_strong_code

# 性能相关
NODE_OPTIONS=--max-old-space-size=512
```

#### 持久化存储
- 挂载 `/data` 目录到持久卷
- 数据库文件路径：`/data/game.db`
- 定期备份数据库

#### 资源配置建议
- **CPU**：至少 0.5 核心
- **内存**：至少 512MB（推荐 1GB）
- **磁盘**：至少 1GB SSD

### 5. 监控和调试

#### 健康检查
```bash
curl https://your-domain.zeabur.app/api/health
```

#### 性能监控
查看响应时间和错误率：
```javascript
// 在关键 API 添加日志
console.time('api-users-list');
const users = db.prepare('SELECT * FROM users').all();
console.timeEnd('api-users-list');
```

### 6. 进一步优化建议

#### 如果仍然卡顿，考虑：

1. **升级 Zeabur 套餐**
   - 增加 CPU 和内存配额
   - 使用更高性能的实例

2. **使用 CDN**
   - 将静态资源托管到 CDN
   - 减轻服务器压力

3. **数据库迁移**
   - 考虑迁移到 PostgreSQL 或 MySQL
   - 更好的并发性能

4. **Redis 缓存**
   - 添加 Redis 作为缓存层
   - 缓存热点数据

5. **负载均衡**
   - 部署多个实例
   - 使用负载均衡器分发请求

6. **WebSocket 优化**
   - 如果使用实时通信，考虑 WebSocket
   - 减少轮询请求

### 7. 常见性能问题排查

#### 问题：登录慢
- 检查 `user_sessions` 表是否有大量过期会话
- 定期清理过期会话

#### 问题：列表加载慢
- 添加分页：`LIMIT` 和 `OFFSET`
- 只查询必要的字段

#### 问题：数据库锁定
- 确认 WAL 模式已启用
- 检查是否有长时间运行的事务

#### 问题：内存占用高
- 检查缓存是否过大
- 定期重启服务（Zeabur 自动管理）

### 8. 性能测试

使用 Apache Bench 测试：
```bash
# 测试并发 10 个用户，总共 100 个请求
ab -n 100 -c 10 https://your-domain.zeabur.app/api/health
```

### 9. 代码优化清单

- [x] 数据库 WAL 模式
- [x] 数据库索引
- [x] 限流中间件
- [x] 响应压缩
- [x] 缓存中间件
- [x] 静态资源缓存
- [ ] 前端代码分割
- [ ] 虚拟滚动
- [ ] 请求防抖
- [ ] 图片懒加载
- [ ] Service Worker 缓存

## 预期效果

实施以上优化后，预期性能提升：
- **响应时间**：减少 40-60%
- **并发能力**：提升 3-5 倍
- **带宽使用**：减少 60-80%
- **服务器负载**：降低 50%

## 联系支持

如果优化后仍有问题，检查：
1. Zeabur 控制台的资源使用情况
2. 应用日志中的错误信息
3. 数据库文件大小和查询性能

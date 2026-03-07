# 浏览器卡顿问题排查指南

## 🔍 问题诊断

如果打开 Zeabur 部署的网页导致整个电脑卡顿，通常是以下原因：

### 1. 浏览器内存泄漏或占用过高

#### 检查方法
1. 打开任务管理器（Ctrl + Shift + Esc）
2. 查看浏览器进程的内存和 CPU 占用
3. 如果占用超过 2GB 内存或 CPU 持续 100%，说明有问题

#### 解决方案
```powershell
# 方案 1：清理浏览器缓存
# Chrome: Ctrl + Shift + Delete
# 选择"全部时间"，清除缓存和 Cookie

# 方案 2：禁用浏览器扩展
# 进入无痕模式测试（Ctrl + Shift + N）
# 如果不卡了，说明是某个扩展导致的

# 方案 3：重置浏览器设置
# Chrome: 设置 → 高级 → 重置设置
```

### 2. 前端代码导致的性能问题

#### 常见原因
- ❌ 无限循环渲染
- ❌ 大量 DOM 元素
- ❌ 未优化的动画
- ❌ 内存泄漏（事件监听器未清理）

#### 检查方法
```javascript
// 打开浏览器开发者工具（F12）
// 1. Performance 标签 → 录制 → 查看火焰图
// 2. Memory 标签 → 拍摄堆快照 → 查看内存占用
// 3. Console 标签 → 查看是否有错误或警告
```

### 3. 电脑硬件性能不足

#### 检查配置
- **内存**：建议至少 8GB（4GB 可能不够）
- **CPU**：建议 4 核心以上
- **硬盘**：SSD 比 HDD 快很多

#### 临时解决方案
```powershell
# 关闭不必要的程序
# 1. 任务管理器 → 结束占用高的进程
# 2. 禁用开机自启动程序
# 3. 清理磁盘空间（至少保留 10GB 可用）

# 增加虚拟内存
# 控制面板 → 系统 → 高级系统设置 → 性能设置 → 高级 → 虚拟内存
# 设置为物理内存的 1.5-2 倍
```

### 4. 网络问题导致的假死

#### 症状
- 页面加载时卡住
- 白屏或转圈很久
- 浏览器无响应

#### 解决方案
```powershell
# 检查网络连接
ping zeabur.com

# 刷新 DNS 缓存
ipconfig /flushdns

# 更换 DNS 服务器
# 设置 → 网络 → 更改适配器选项 → IPv4 属性
# 首选 DNS: 8.8.8.8 (Google)
# 备用 DNS: 1.1.1.1 (Cloudflare)
```

### 5. React 开发模式导致的性能问题

#### 检查是否是开发模式
```javascript
// 在浏览器控制台输入
console.log(process.env.NODE_ENV);
// 如果显示 "development"，说明是开发模式（会很慢）
```

#### 解决方案
确保 Zeabur 部署时设置了：
```env
NODE_ENV=production
```

## 🛠️ 立即可行的解决方案

### 方案 1：使用轻量级浏览器
```powershell
# 如果 Chrome 太卡，尝试：
# 1. Microsoft Edge（基于 Chromium，但更省资源）
# 2. Firefox（内存管理更好）
# 3. Opera（内置广告拦截，更快）
```

### 方案 2：限制浏览器资源使用
```powershell
# Chrome 启动参数（创建快捷方式）
"C:\Program Files\Google\Chrome\Application\chrome.exe" --max-old-space-size=512 --js-flags="--max-old-space-size=512"

# 或者在 Chrome 设置中：
# 设置 → 系统 → 关闭"继续运行后台应用"
```

### 方案 3：优化 Windows 性能
```powershell
# 1. 禁用视觉效果
# 控制面板 → 系统 → 高级系统设置 → 性能设置 → 调整为最佳性能

# 2. 关闭不必要的服务
# Win + R → services.msc
# 禁用：Windows Search, Superfetch, Print Spooler（如果不打印）

# 3. 清理启动项
# Win + R → msconfig → 启动 → 禁用不必要的程序
```

### 方案 4：检查是否是恶意软件
```powershell
# 运行 Windows Defender 全盘扫描
# 设置 → 更新和安全 → Windows 安全中心 → 病毒和威胁防护 → 扫描选项 → 完全扫描

# 或使用第三方工具
# Malwarebytes: https://www.malwarebytes.com/
```

## 🔧 针对你的项目的优化

### 前端性能优化

#### 1. 添加 React 性能监控
```typescript
// src/App.tsx
import { Profiler } from 'react';

function onRenderCallback(
  id: string,
  phase: "mount" | "update",
  actualDuration: number
) {
  if (actualDuration > 100) {
    console.warn(`${id} 渲染耗时: ${actualDuration}ms`);
  }
}

export default function App() {
  return (
    <Profiler id="App" onRender={onRenderCallback}>
      {/* 你的组件 */}
    </Profiler>
  );
}
```

#### 2. 使用 React.memo 防止不必要的重渲染
```typescript
// src/views/GameView.tsx
import { memo } from 'react';

export const GameView = memo(function GameView(props) {
  // 组件代码
});
```

#### 3. 虚拟化长列表
```bash
npm install react-window
```

```typescript
import { FixedSizeList } from 'react-window';

function PlayerList({ players }) {
  return (
    <FixedSizeList
      height={600}
      itemCount={players.length}
      itemSize={50}
      width="100%"
    >
      {({ index, style }) => (
        <div style={style}>{players[index].name}</div>
      )}
    </FixedSizeList>
  );
}
```

#### 4. 懒加载图片
```typescript
<img 
  src={imageUrl} 
  loading="lazy" 
  alt="描述"
/>
```

#### 5. 减少动画复杂度
```typescript
// 如果使用 motion，减少动画元素
import { motion } from 'motion/react';

// 简化动画配置
<motion.div
  initial={{ opacity: 0 }}
  animate={{ opacity: 1 }}
  transition={{ duration: 0.2 }} // 缩短动画时间
>
```

### 后端优化（已完成）
- ✅ 限流
- ✅ 压缩
- ✅ 缓存
- ✅ 数据库索引

## 📊 性能测试工具

### 浏览器工具
```javascript
// 1. Chrome DevTools
// F12 → Performance → 录制 → 停止 → 分析

// 2. Lighthouse
// F12 → Lighthouse → 生成报告

// 3. 内存分析
// F12 → Memory → 拍摄堆快照
```

### 在线工具
- **PageSpeed Insights**: https://pagespeed.web.dev/
- **WebPageTest**: https://www.webpagetest.org/
- **GTmetrix**: https://gtmetrix.com/

## 🚨 紧急处理步骤

如果电脑已经卡死：

1. **强制关闭浏览器**
   ```
   Ctrl + Shift + Esc → 找到浏览器进程 → 结束任务
   ```

2. **重启电脑**
   ```
   如果任务管理器也打不开，长按电源键强制关机
   ```

3. **安全模式启动**
   ```
   重启时按 F8 → 选择安全模式 → 卸载可疑程序
   ```

## 💡 最佳实践建议

### 开发时
- 使用 Chrome 的无痕模式（没有扩展干扰）
- 定期清理浏览器缓存
- 关闭不用的标签页（建议不超过 10 个）
- 使用 React DevTools 监控组件性能

### 部署时
- 确保 `NODE_ENV=production`
- 启用 Gzip 压缩（已完成）
- 使用 CDN 加速静态资源
- 图片压缩和懒加载

### 日常维护
- 定期更新浏览器
- 定期清理磁盘空间
- 定期重启电脑
- 监控系统资源使用

## 🔍 具体排查步骤

### 第一步：确定是哪个环节卡
```
1. 打开任务管理器（Ctrl + Shift + Esc）
2. 访问你的 Zeabur 网站
3. 观察哪个进程占用高：
   - 浏览器 → 前端问题
   - 系统进程 → 系统问题
   - 网络 → 网络问题
```

### 第二步：浏览器开发者工具诊断
```
1. F12 打开开发者工具
2. Network 标签 → 查看请求耗时
3. Performance 标签 → 录制并分析
4. Console 标签 → 查看错误
```

### 第三步：对比测试
```
1. 在其他电脑上打开 → 如果不卡，是本地问题
2. 用手机打开 → 如果不卡，是电脑问题
3. 用无痕模式打开 → 如果不卡，是扩展问题
```

## 📞 需要更多帮助？

如果以上方法都不行，请提供：
1. 电脑配置（内存、CPU、系统版本）
2. 浏览器版本
3. 任务管理器截图（卡顿时）
4. 浏览器控制台错误信息
5. 具体卡顿的页面和操作

这样我可以提供更精准的解决方案。

# 腾讯云 + 宝塔面板部署完整教程

## 📋 部署概览

```
总耗时：约 40 分钟
总成本：¥130/月（学生价 ¥66/月）
并发能力：800-1500 用户
难度：⭐⭐ 中等（跟着教程做很简单）
```

---

## 第一步：购买腾讯云服务器（10 分钟）

### 1.1 注册腾讯云账号

1. 访问 [腾讯云官网](https://cloud.tencent.com/)
2. 点击右上角"注册"
3. 完成实名认证（需要身份证）

### 1.2 购买轻量应用服务器

1. 访问 [轻量应用服务器](https://cloud.tencent.com/product/lighthouse)
2. 点击"立即选购"
3. 选择配置：

```yaml
地域：
  - 广州/上海/北京（选离你用户最近的）
  - 建议：广州（速度快，稳定）

镜像：
  - 系统镜像 → Ubuntu 20.04 LTS

套餐：
  - 2核4GB 6Mbps 80GB SSD
  - 价格：¥74/月
  - 学生价：¥44/月（需学生认证）

购买时长：
  - 建议先买 1 个月测试
  - 后续可以续费
```

4. 点击"立即购买"，完成支付

### 1.3 获取服务器信息

1. 进入 [轻量应用服务器控制台](https://console.cloud.tencent.com/lighthouse/instance)
2. 找到你的服务器
3. 记录以下信息：
   - **公网 IP**：例如 `123.456.789.0`
   - **用户名**：`ubuntu` 或 `root`
   - **密码**：点击"重置密码"设置

---

## 第二步：购买云数据库 PostgreSQL（5 分钟）

### 2.1 购买数据库

1. 访问 [云数据库 PostgreSQL](https://cloud.tencent.com/product/postgresql)
2. 点击"立即选购"
3. 选择配置：

```yaml
地域：
  - 与服务器相同（例如：广州）

数据库版本：
  - PostgreSQL 12 或 13

规格：
  - 1核2GB 内存
  - 20GB 存储
  - 价格：¥56/月

网络：
  - 选择与服务器相同的 VPC（默认即可）
```

4. 点击"立即购买"

### 2.2 配置数据库

1. 进入 [PostgreSQL 控制台](https://console.cloud.tencent.com/postgres)
2. 找到你的数据库实例
3. 点击"管理" → "账号管理"
4. 创建数据库账号：
   - 用户名：`mingzhita`
   - 密码：设置一个强密码（记住它）
5. 点击"数据库管理" → "创建数据库"
   - 数据库名：`mingzhita`
   - 字符集：`UTF8`
6. 记录以下信息：
   - **内网地址**：例如 `10.0.0.123:5432`
   - **用户名**：`mingzhita`
   - **密码**：你设置的密码
   - **数据库名**：`mingzhita`

---

## 第三步：连接服务器并安装宝塔（10 分钟）

### 3.1 连接服务器

**Windows 用户：**
```powershell
# 使用 PowerShell 或下载 PuTTY
ssh ubuntu@你的服务器IP

# 输入密码
```

**Mac/Linux 用户：**
```bash
ssh ubuntu@你的服务器IP
# 输入密码
```

### 3.2 安装宝塔面板

连接成功后，执行以下命令：

```bash
# 切换到 root 用户
sudo su

# 安装宝塔面板（Ubuntu 版本）
wget -O install.sh https://download.bt.cn/install/install-ubuntu_6.0.sh && bash install.sh ed8484bec
```

安装过程约 5-10 分钟，期间会提示：
```
Do you want to install Bt-Panel to the /www directory now?(y/n): 
```
输入 `y` 并回车。

### 3.3 获取宝塔面板信息

安装完成后，会显示：
```
==================================================================
Congratulations! Installed successfully!
==================================================================
外网面板地址: http://123.456.789.0:8888/xxxxxxxx
内网面板地址: http://10.0.0.1:8888/xxxxxxxx
username: xxxxxxxx
password: xxxxxxxx
==================================================================
```

**重要：** 复制保存这些信息！

### 3.4 配置防火墙

在腾讯云控制台：
1. 进入轻量应用服务器控制台
2. 点击你的服务器 → "防火墙"
3. 添加规则：

```yaml
规则 1：
  - 协议：TCP
  - 端口：8888
  - 来源：0.0.0.0/0
  - 备注：宝塔面板

规则 2：
  - 协议：TCP
  - 端口：80
  - 来源：0.0.0.0/0
  - 备注：HTTP

规则 3：
  - 协议：TCP
  - 端口：443
  - 来源：0.0.0.0/0
  - 备注：HTTPS

规则 4：
  - 协议：TCP
  - 端口：3000
  - 来源：0.0.0.0/0
  - 备注：应用端口（可选）
```

---

## 第四步：配置宝塔面板（10 分钟）

### 4.1 登录宝塔面板

1. 浏览器访问：`http://你的服务器IP:8888/xxxxxxxx`
2. 输入用户名和密码
3. 首次登录会要求绑定手机号（免费）

### 4.2 安装软件

登录后会弹出"推荐安装套件"，选择：

```yaml
Web 服务器：
  - Nginx 1.22（推荐）
  - 编译安装（稳定）

数据库：
  - 不需要安装（使用云数据库）

编程语言：
  - 不需要安装（手动安装 Node.js）

其他：
  - 不需要安装
```

点击"一键安装"，等待 5-10 分钟。

### 4.3 安装 Node.js

在宝塔面板：
1. 左侧菜单 → "软件商店"
2. 搜索 "Node.js"
3. 找到 "Node.js 版本管理器"
4. 点击"安装"
5. 安装完成后，点击"设置"
6. 安装 Node.js 18.x 版本

### 4.4 安装 PM2

在宝塔面板：
1. 左侧菜单 → "软件商店"
2. 搜索 "PM2"
3. 点击"安装"

---

## 第五步：部署应用（15 分钟）

### 5.1 上传代码

**方法 1：使用 Git（推荐）**

在服务器 SSH 中执行：
```bash
# 安装 Git
sudo apt update
sudo apt install git -y

# 克隆代码
cd /www/wwwroot
git clone https://github.com/你的用户名/mingzhita-main.git
cd mingzhita-main
```

**方法 2：使用宝塔面板上传**

1. 宝塔面板 → "文件"
2. 进入 `/www/wwwroot`
3. 点击"上传"
4. 上传你的项目压缩包
5. 解压

### 5.2 安装依赖

在服务器 SSH 中：
```bash
cd /www/wwwroot/mingzhita-main

# 安装依赖
npm install

# 如果速度慢，使用国内镜像
npm config set registry https://registry.npmmirror.com
npm install
```

### 5.3 配置环境变量

创建 `.env` 文件：
```bash
nano .env
```

输入以下内容（替换为你的实际信息）：
```env
NODE_ENV=production
PORT=3000
ADMIN_ENTRY_CODE=你的强密码

# 数据库连接（使用云数据库的内网地址）
DATABASE_URL=postgresql://mingzhita:你的数据库密码@10.0.0.123:5432/mingzhita
```

保存：按 `Ctrl + X`，然后 `Y`，然后 `Enter`

### 5.4 初始化数据库

```bash
# 如果使用 Prisma
npx prisma generate
npx prisma db push

# 查看是否成功
npx prisma studio
# 按 Ctrl + C 退出
```

### 5.5 构建应用

```bash
npm run build
```

### 5.6 启动应用

```bash
# 使用 PM2 启动
pm2 start npm --name "mingzhita" -- run start

# 保存 PM2 配置
pm2 save

# 设置开机自启
pm2 startup
# 复制输出的命令并执行

# 查看应用状态
pm2 status

# 查看日志
pm2 logs mingzhita
```

### 5.7 测试应用

```bash
# 测试应用是否运行
curl http://localhost:3000/api/health

# 应该返回：
# {"ok":true,"ts":1234567890}
```

---

## 第六步：配置 Nginx 反向代理（5 分钟）

### 6.1 在宝塔面板添加网站

1. 宝塔面板 → "网站"
2. 点击"添加站点"
3. 配置：

```yaml
域名：
  - 如果有域名：填写你的域名（例如：mingzhita.com）
  - 如果没有域名：填写服务器 IP

根目录：
  - /www/wwwroot/mingzhita-main/dist

PHP 版本：
  - 纯静态（不需要 PHP）
```

4. 点击"提交"

### 6.2 配置反向代理

1. 找到刚创建的网站
2. 点击"设置"
3. 左侧菜单 → "反向代理"
4. 点击"添加反向代理"
5. 配置：

```yaml
代理名称：mingzhita

目标 URL：http://127.0.0.1:3000

发送域名：$host

内容替换：留空
```

6. 点击"提交"

### 6.3 配置 SSL（可选但推荐）

如果你有域名：

1. 网站设置 → "SSL"
2. 选择 "Let's Encrypt"
3. 输入邮箱
4. 点击"申请"
5. 等待 1-2 分钟
6. 申请成功后，开启"强制 HTTPS"

---

## 第七步：测试和验证（5 分钟）

### 7.1 测试访问

浏览器访问：
- 如果有域名：`https://你的域名`
- 如果没有域名：`http://你的服务器IP`

### 7.2 测试功能

1. 打开网站
2. 测试登录
3. 测试创建角色
4. 测试游戏功能

### 7.3 查看日志

如果有问题，查看日志：
```bash
# 查看应用日志
pm2 logs mingzhita

# 查看 Nginx 日志
tail -f /www/wwwroot/mingzhita-main/logs/access.log
tail -f /www/wwwroot/mingzhita-main/logs/error.log
```

---

## 常见问题解决

### 问题 1：无法访问宝塔面板

**解决：**
```bash
# 检查宝塔是否运行
sudo /etc/init.d/bt status

# 重启宝塔
sudo /etc/init.d/bt restart

# 检查防火墙
sudo ufw status
sudo ufw allow 8888
```

### 问题 2：应用启动失败

**解决：**
```bash
# 查看详细日志
pm2 logs mingzhita --lines 100

# 检查端口占用
sudo netstat -tulpn | grep 3000

# 重启应用
pm2 restart mingzhita
```

### 问题 3：数据库连接失败

**解决：**
```bash
# 测试数据库连接
psql "postgresql://mingzhita:密码@内网地址:5432/mingzhita"

# 检查环境变量
cat .env

# 检查数据库白名单
# 在腾讯云 PostgreSQL 控制台 → 安全组
# 确保允许服务器 IP 访问
```

### 问题 4：502 错误

**解决：**
```bash
# 检查应用是否运行
pm2 status

# 检查 Nginx 配置
nginx -t

# 重启 Nginx
sudo systemctl restart nginx

# 查看 Nginx 错误日志
tail -f /www/server/nginx/logs/error.log
```

### 问题 5：内存不足

**解决：**
```bash
# 查看内存使用
free -h

# 创建 swap（虚拟内存）
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile

# 永久启用
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

---

## 性能优化建议

### 1. 启用 Gzip 压缩

在宝塔面板：
1. 网站设置 → "配置文件"
2. 找到 `http` 块，添加：

```nginx
gzip on;
gzip_vary on;
gzip_min_length 1024;
gzip_types text/plain text/css text/xml text/javascript application/json application/javascript application/xml+rss;
```

### 2. 配置缓存

在反向代理配置中添加：
```nginx
location ~* \.(jpg|jpeg|png|gif|ico|css|js)$ {
    expires 7d;
    add_header Cache-Control "public, immutable";
}
```

### 3. 限制请求频率

在宝塔面板：
1. 软件商店 → 搜索 "Nginx 防火墙"
2. 安装并配置限流规则

---

## 日常维护

### 更新代码

```bash
cd /www/wwwroot/mingzhita-main

# 拉取最新代码
git pull

# 安装新依赖
npm install

# 重新构建
npm run build

# 重启应用
pm2 restart mingzhita
```

### 备份数据库

在腾讯云 PostgreSQL 控制台：
1. 点击"备份管理"
2. 点击"创建备份"
3. 设置自动备份策略

### 监控应用

```bash
# 查看应用状态
pm2 status

# 查看资源使用
pm2 monit

# 查看日志
pm2 logs mingzhita
```

---

## 成本明细

```yaml
轻量应用服务器（2核4GB）：¥74/月
云数据库 PostgreSQL（1核2GB）：¥56/月
域名（可选）：¥50/年
SSL 证书：免费（Let's Encrypt）

总计：¥130/月

学生优惠：
  - 服务器：¥44/月
  - 数据库：¥22/月
  - 总计：¥66/月
```

---

## 🎉 完成！

现在你的应用已经成功部署到腾讯云了！

**访问地址：**
- 有域名：`https://你的域名`
- 无域名：`http://你的服务器IP`

**性能指标：**
- 并发能力：800-1500 用户
- 响应时间：10-50ms
- 国内访问速度：⚡⚡⚡ 快

**下一步：**
1. 配置域名（如果有）
2. 申请 SSL 证书
3. 配置 CDN 加速（可选）
4. 设置监控告警

需要帮助？告诉我遇到的问题！

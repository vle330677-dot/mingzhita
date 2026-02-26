# 使用官方 Node 镜像
FROM node:20-alpine

# 设置工作目录
WORKDIR /app

# 复制 package.json 和 lock 文件（如果有）
COPY package*.json ./

# 安装所有依赖（包括 devDependencies，因为要构建前端）
RUN npm install

# 复制所有源代码
COPY . .

# 构建前端页面到 dist 目录
RUN npm run build

# 暴露端口 (Zeabur 会自动处理，但写上是个好习惯)
EXPOSE 3000

# 启动 Node.js 服务器
CMD ["npm", "run", "start"]

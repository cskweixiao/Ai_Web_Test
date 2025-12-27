# 🚀 快速启动指南

## 安装和启动

### 方法1：使用 npm 命令（推荐）

```bash
# 1. 克隆项目
git clone https://github.com/your-username/Sakura AI.git
cd Sakura AI

# 2. 安装依赖
npm install

# 3. 启动项目
npm start
```

### 方法2：使用 node 命令

```bash
# 启动项目
node scripts/start.cjs
```

## 常见问题

### ❌ 错误：Cannot find module

**可能原因**：
1. 依赖未安装
2. 使用了错误的启动命令

**解决方案**：
```bash
# 1. 确保依赖已安装
npm install

# 2. 使用正确的启动命令
npm start

# 或者
node scripts/start.cjs
```

### ❌ 错误：数据库连接失败

**解决方案**：
1. 确保 MySQL 已安装并运行
2. 复制 `.env.production.template` 为 `.env`
3. 配置数据库连接信息

### ❌ 错误：端口被占用

**解决方案**：
```bash
# 修改 .env 文件中的端口配置
PORT=3001  # 后端端口
VITE_PORT=5173  # 前端端口
```

## 开发模式

```bash
# 启动开发模式（前后端同时启动，支持热重载）
npm run dev

# 只启动前端
npm run dev:frontend

# 只启动后端
npm run dev:server
```

## 生产部署

```bash
# 构建前端
npm run build

# 启动生产服务器
npm start
```

## 更多帮助

- 📖 [完整安装指南](docs/INSTALLATION.md)
- 🐛 [问题反馈](https://github.com/your-username/Sakura AI/issues)
- 💬 [讨论区](https://github.com/your-username/Sakura AI/discussions)

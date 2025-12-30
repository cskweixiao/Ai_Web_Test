# 项目结构说明

## 📁 新的目录布局

本项目已重构为前后端分离的目录结构：

```
Ai_Web_Test/
├── front/                      # 🎨 前端代码目录
│   ├── src/                   # React 源代码
│   ├── public/                # 静态资源
│   ├── index.html             # HTML 入口文件
│   ├── vite.config.ts         # Vite 配置
│   ├── tailwind.config.cjs    # Tailwind CSS 配置
│   ├── postcss.config.cjs     # PostCSS 配置
│   ├── tsconfig.json          # 前端 TypeScript 配置
│   ├── tsconfig.app.json      # 应用 TS 配置
│   └── tsconfig.node.json     # Node TS 配置
│
├── backend/                    # ⚙️ 后端代码目录
│   ├── server/                # Express 服务器代码
│   ├── prisma/                # Prisma 数据库 Schema
│   ├── scripts/               # 后端启动和工具脚本
│   └── tsconfig.json          # 后端 TypeScript 配置
│
├── docs/                       # 📚 项目文档
├── tests/                      # 🧪 测试文件
├── node_modules/              # 📦 依赖包（共享）
├── package.json               # 根 package.json
├── tsconfig.json              # 根 TypeScript 配置
├── .env                       # 环境变量配置
└── ...其他配置文件
```

## 🚀 启动命令

### 完整启动（前端 + 后端）
```bash
npm start
```

### 开发模式（带热重载）
```bash
npm run dev
```

### 单独启动前端
```bash
npm run dev:frontend
```

### 单独启动后端
```bash
npm run dev:server
# 或者
npm run server
```

### 构建项目
```bash
# 构建前端
npm run build

# 构建后端
npm run build:backend
```

## 📝 重要说明

1. **环境变量**：`.env` 文件仍在项目根目录
2. **依赖安装**：在根目录运行 `npm install`
3. **数据库配置**：Prisma schema 在 `backend/prisma/` 目录
4. **静态资源**：前端静态资源在 `front/public/` 目录

## 🔄 迁移说明

从旧结构迁移的主要变化：

- `src/` → `front/src/`
- `public/` → `front/public/`
- `server/` → `backend/server/`
- `prisma/` → `backend/prisma/`
- `scripts/` → `backend/scripts/`

所有配置文件的路径引用已相应更新。


# 🔥 TestFlow - 企业级自动化测试平台

## 🎯 项目特点

- **🤖 AI 智能驱动** - 基于大模型的自然语言测试解析，通过 MCP 协议高效执行
- **🔐 完整的用户体系** - 用户认证、角色权限管理、部门组织架构、API令牌支持
- **📱 现代化 UI** - React 18 + TypeScript + Tailwind CSS + Ant Design，响应式设计，体验流畅
- **⚡ 实时更新** - WebSocket 支持，测试执行状态实时同步
- **🎭 标准协议** - 基于 MCP (Model Context Protocol) 标准化设计，AI模型与工具无缝集成
- **📊 数据驱动** - Prisma ORM + MySQL，完整的测试数据管理和统计分析
- **🏢 企业就绪** - 支持系统模块分类、测试套件管理、审计日志，适合团队协作
- **🔧 易于扩展** - 模块化架构，支持插件式功能扩展、特性开关控制

## 🏗️ 系统架构

```
┌─────────────────────────────────────────────────────────────────┐
│                        TestFlow AI 架构图                       │
├─────────────────┬───────────────────┬───────────────────────────┤
│   前端层        │     后端层        │      AI执行层             │
│                 │                   │                           │
│ ┌─────────────┐ │ ┌───────────────┐ │ ┌───────────────────────┐ │
│ │ React 18    │ │ │ Express API   │ │ │ AI Parser             │ │
│ │ TypeScript  │◄┼─┤ WebSocket     │◄┼─┤ LLM Config Manager    │ │
│ │ Ant Design  │ │ │ Prisma ORM    │ │ │ MCP Client            │ │
│ │ Tailwind    │ │ │ JWT Auth      │ │ │ Prompt Engineering    │ │
│ └─────────────┘ │ └───────────────┘ │ └───────────────────────┘ │
│                 │                   │             │             │
│ ┌─────────────┐ │ ┌───────────────┐ │ ┌───────────┼───────────┐ │
│ │ 测试管理    │ │ │ 数据存储      │ │ │ 大模型API │ Playwright │ │
│ │ 用例编辑    │ │ │ 用户认证      │ │ │ 自然语言  │ 浏览器执行│ │
│ │ 套件管理    │ │ │ 状态同步      │ │ │ 智能解析  │ 截图保存  │ │
│ │ 权限控制    │ │ │ API 服务      │ │ │ 批量修改  │ 实时反馈  │ │
│ └─────────────┘ │ └───────────────┘ │ └───────────┴───────────┘ │
└─────────────────┴───────────────────┴───────────────────────────┘
                           │
                    ┌──────┴──────┐
                    │   MySQL     │
                    │   数据库    │
                    └─────────────┘
```

## 🚀 快速启动

### 一键启动 (推荐)

```bash
# 克隆项目
cd project

# 一键启动 (自动安装依赖、配置环境、启动服务)
node scripts/start.js
```

### 手动启动

```bash
# 1. 安装依赖
npm install

# 2. 安装 Playwright 浏览器
npx playwright install chromium

# 3. 配置数据库
# 编辑 .env 文件，配置 DATABASE_URL
npx prisma migrate deploy
npx prisma generate

# 4. 同时启动前后端
npm run dev

# 或分别启动
npm run dev:frontend  # 前端 (端口 5173)
npm run dev:server    # 后端 (端口 3001)
```

### 首次登录

系统启动后访问: **http://localhost:5173**

默认管理员账号:
- 用户名: `admin`
- 密码: `admin123` (首次登录后请及时修改)

## 📋 系统要求

### 基础环境
- **Node.js** >= 18.0.0
- **NPM** >= 8.0.0
- **操作系统**: Windows 10+, macOS 10.15+, Linux
- **内存**: 最少 8GB RAM (推荐 16GB+)
- **磁盘**: 最少 20GB 可用空间

### 数据库要求
- **MySQL** >= 8.0 (推荐) 或 **MariaDB** >= 10.5
- **端口**: 3306 (默认)
- **字符集**: utf8mb4

### 推荐配置 (10人团队)
- **CPU**: 8 vCPU
- **内存**: 16GB RAM
- **存储**: SSD 100GB+
- **网络**: 稳定的内网环境

## 🎮 使用指南

### 1. 用户管理 🔐

#### 登录系统
- 访问登录页面，输入用户名和密码
- 支持"记住我"功能，7天内自动登录
- JWT Token 认证，安全可靠

#### 权限体系
- **超级管理员**: 拥有所有权限，可管理用户和系统配置
- **普通用户**: 可创建和管理自己的测试用例和套件
- **角色管理**: 支持自定义角色和权限分配
- **部门管理**: 支持组织架构和部门分组

#### API 令牌
- 支持生成 API Token 用于自动化集成
- Token 支持作用域控制和过期时间设置
- 适用于 CI/CD 流程集成

### 2. 测试用例管理

#### 创建测试用例
- 点击 "测试用例管理" → "创建测试用例"
- 填写基本信息：名称、步骤、断言预期
- **系统分类**: 设置所属系统（如：电商系统、CRM系统）
- **模块分类**: 设置所属模块（如：用户管理、商品管理）
- 设置优先级和状态
- 添加标签便于筛选

#### 步骤编辑器 ⭐
- **可视化编辑**: 拖拽式步骤编排
- **结构化数据**: 支持 JSON 格式的复杂步骤定义
- **模板支持**: 内置常用操作模板
- **实时预览**: 编辑时即时查看效果

#### 管理测试用例
- 支持按系统、模块、标签、优先级筛选
- 实时搜索功能
- 批量操作支持
- 版本控制和历史记录

### 3. 测试套件管理

#### 创建测试套件
- 切换到 "测试套件" 标签页
- 选择多个相关测试用例组合成套件
- 设置套件名称和描述
- 支持优先级和标签管理

#### 执行测试套件
- 一键执行整个测试套件
- 批量执行相关测试用例
- 实时查看套件执行进度
- WebSocket 实时状态推送

### 4. AI批量修改 🤖

#### 智能批量更新测试用例
- 点击 "AI批量更新" 按钮进入智能修改界面
- **自然语言描述**: 用简单的中文描述需要修改的内容
  ```
  示例：将所有登录相关的测试用例中的"点击登录按钮"改为"双击登录按钮"，
  因为产品交互方式发生了变化。
  ```
- **智能过滤**: 按系统、模块、标签、优先级筛选相关用例
- **AI提案生成**: AI自动分析并生成精确的修改提案

#### 提案审核与编辑
- **可视化对比**: 直观显示修改前后的内容对比
- **内联编辑**: 直接在界面上调整AI的修改建议
- **风险评估**: 自动评估修改风险等级（低/中/高）
- **批量操作**: 支持全选、筛选和批量应用
- **智能重置**: 随时恢复为AI原始建议

#### 安全应用
- **预览确认**: 应用前可详细预览所有变更
- **选择性应用**: 只应用选中的提案，灵活控制
- **版本控制**: 自动创建版本快照，支持回滚
- **实时反馈**: 显示应用进度和结果统计

### 5. 测试执行与监控

#### 执行控制
- **单用例执行**: 快速验证单个测试用例
- **套件批量执行**: 执行完整测试套件
- **并发控制**: 支持并发数量限制，避免资源耗尽
- **队列管理**: Bull 队列支持，任务排队执行

#### 实时监控
- **WebSocket 实时推送**: 测试状态实时更新
- **执行日志**: 详细的步骤执行日志
- **截图保存**: 每个步骤自动截图保存
- **视频录制**: 支持测试执行过程录制（可选）

#### 结果分析
- 查看详细的执行日志和截图
- 测试运行历史记录
- 测试结果状态跟踪
- 失败原因分析

### 6. 审计与安全

#### 审计日志
- 所有关键操作自动记录
- 支持按用户、操作类型、时间筛选
- 详细的操作元数据记录

#### 特性开关
- 支持特性开关控制功能发布
- 灰度发布支持
- 百分比滚动控制

## 🔧 配置说明

### 数据库配置 (`.env`)

```bash
# 数据库连接
DATABASE_URL="mysql://username:password@localhost:3306/testflow"

# 应用配置
PORT=3001                           # 后端端口
VITE_PORT=5173                     # 前端端口
NODE_ENV=development               # 环境模式

# JWT 认证配置
JWT_SECRET=your_jwt_secret_key_here    # JWT 密钥 (生产环境必须修改)
JWT_EXPIRES_IN=7d                      # Token 过期时间

# Playwright 设置
PLAYWRIGHT_HEADLESS=true           # 无头模式
PLAYWRIGHT_BROWSER=chromium        # 浏览器类型

# 测试执行配置
TEST_TIMEOUT=600000                # 测试超时时间 (10分钟)
MAX_CONCURRENT_TESTS=6             # 最大并发测试数

# AI模型配置 (可选)
AI_MODEL_PROVIDER=anthropic        # AI提供商: anthropic, openai
AI_MODEL_NAME=claude-3-5-sonnet    # 模型名称
AI_API_KEY=your_api_key_here       # API密钥
AI_MAX_TOKENS=4000                 # 最大token数
```

### MCP 服务器配置 (`mcp-config.json`)

```json
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": ["@anthropic-ai/mcp-server-playwright"],
      "env": {
        "PLAYWRIGHT_HEADLESS": "true",
        "PLAYWRIGHT_BROWSER": "chromium"
      }
    }
  },
  "defaults": {
    "timeout": 30000,
    "retries": 2,
    "screenshot": true,
    "trace": "retain-on-failure",
    "video": "retain-on-failure"
  }
}
```

### 数据库迁移

```bash
# 初次设置数据库
npx prisma migrate dev --name init

# 应用迁移
npx prisma migrate deploy

# 重新生成客户端
npx prisma generate

# 查看数据库状态
npx prisma db push
```

## 📝 测试用例格式

### 标准测试步骤

```typescript
{
  id: 'step-1',
  action: 'navigate',           // 操作类型
  url: 'https://example.com',   // 目标URL
  description: '打开登录页面',    // 步骤描述
  order: 1                     // 执行顺序
}
```

### 支持的操作类型

| 操作 | 说明 | 参数 |
|------|------|------|
| `navigate` | 导航到页面 | `url` |
| `click` | 点击元素 | `selector` |
| `fill` | 填充表单 | `selector`, `value` |
| `expect` | 验证元素 | `selector`, `condition` |
| `screenshot` | 截图 | `filename` (可选) |
| `wait` | 等待 | `timeout` |
| `hover` | 悬停 | `selector` |

## 🛠️ 开发指南

### 项目结构

```
project/
├── src/                          # 前端源码
│   ├── components/               # React 组件
│   │   ├── ui/                   # UI 基础组件 (Button, Modal, etc.)
│   │   ├── AIBulkUpdateModal.tsx # AI批量修改组件
│   │   └── TestResult.tsx        # 测试结果组件
│   ├── pages/                    # 页面组件
│   │   ├── Login.tsx             # 登录页面 🆕
│   │   ├── TestCases.tsx         # 测试用例管理
│   │   ├── TestRuns.tsx          # 测试运行页面
│   │   ├── Dashboard.tsx         # 仪表板
│   │   ├── Settings.tsx          # 设置页面
│   │   └── Reports.tsx           # 报告页面
│   ├── contexts/                 # React Context
│   │   └── AuthContext.tsx       # 认证上下文 🆕
│   ├── services/                 # API 服务
│   │   ├── testService.ts        # 测试服务客户端
│   │   └── authService.ts        # 认证服务客户端 🆕
│   └── types/                    # TypeScript 类型定义
│       └── test.ts               # 测试相关类型
├── server/                       # 后端源码
│   ├── services/                 # 业务服务层
│   │   ├── testExecution.ts      # 测试执行服务
│   │   ├── mcpClient.ts          # MCP 客户端
│   │   ├── authService.ts        # 认证服务 🆕
│   │   └── websocket.ts          # WebSocket 管理
│   ├── routes/                   # API 路由层
│   │   ├── auth.ts               # 认证路由 🆕
│   │   ├── test.ts               # 测试相关路由
│   │   ├── suite.ts              # 测试套件路由
│   │   ├── aiBulkUpdate.ts       # AI批量修改路由
│   │   └── security.ts           # 安全相关路由
│   ├── middleware/               # 中间件
│   │   └── authMiddleware.ts     # 认证中间件 🆕
│   └── types/                    # 后端类型定义
├── prisma/                       # 数据库相关
│   ├── schema.prisma             # 数据库模式
│   └── migrations/               # 数据库迁移文件
├── scripts/                      # 工具脚本
│   ├── start.cjs                 # 启动脚本
│   ├── cleanup-debug-files.cjs   # 调试文件清理
│   ├── mcp-start.cjs             # MCP 服务启动
│   └── migrate-users.ts          # 用户迁移脚本 🆕
└── screenshots/                  # 测试截图存储
```

### 核心技术栈

#### 前端技术
- **React 18**: 现代化前端框架
- **TypeScript**: 类型安全的JavaScript
- **Ant Design**: 企业级 UI 组件库 🆕
- **Tailwind CSS**: 实用优先的CSS框架
- **Framer Motion**: 动画库
- **Vite**: 快速构建工具
- **Zustand**: 轻量级状态管理

#### 后端技术
- **Node.js + Express**: 服务端运行时和Web框架
- **Prisma ORM**: 现代化数据库ORM
- **MySQL**: 关系型数据库
- **JWT**: JSON Web Token 认证 🆕
- **bcrypt**: 密码加密 🆕
- **WebSocket (ws)**: 实时通信
- **Bull**: 任务队列管理

#### AI与测试引擎
- **大模型集成**: 支持多种 AI 模型 (Claude, GPT-4 等)
- **MCP (Model Context Protocol)**: AI模型与工具的标准化协议
- **AI Parser**: 自然语言测试解析引擎
- **Playwright**: 浏览器自动化引擎

### API 接口

#### 用户认证 🆕
```bash
# 用户登录
POST /api/auth/login
{
  "username": "admin",
  "password": "admin123"
}

# 用户注册
POST /api/auth/register
{
  "username": "newuser",
  "email": "user@example.com",
  "password": "password123",
  "department": "测试部"
}

# 获取当前用户信息
GET /api/auth/me
Authorization: Bearer <token>

# 登出
POST /api/auth/logout
Authorization: Bearer <token>
```

#### 测试用例管理
```bash
# 获取测试用例 (支持系统、模块筛选)
GET /api/tests/cases?system=电商系统&module=用户管理
Authorization: Bearer <token>

# 创建测试用例
POST /api/tests/cases
Authorization: Bearer <token>
{
  "name": "用户登录测试",
  "steps": [...],
  "system": "电商系统",
  "module": "用户管理",
  "priority": "high",
  "tags": ["登录", "认证"]
}

# 更新测试用例
PUT /api/tests/cases/:id
Authorization: Bearer <token>

# 删除测试用例
DELETE /api/tests/cases/:id
Authorization: Bearer <token>
```

#### 测试套件管理
```bash
# 获取测试套件
GET /api/tests/suites
Authorization: Bearer <token>

# 创建测试套件
POST /api/tests/suites
Authorization: Bearer <token>
{
  "name": "用户模块回归测试",
  "description": "用户相关功能的完整测试",
  "testCaseIds": [1, 2, 3],
  "priority": "high"
}

# 执行测试套件
POST /api/tests/suites/:id/run
Authorization: Bearer <token>

# 获取套件运行状态
GET /api/tests/suites/:id/runs/:runId
Authorization: Bearer <token>
```

#### 执行控制
```bash
# 执行单个测试
POST /api/tests/execute
Authorization: Bearer <token>
{
  "testCaseId": 1,
  "environment": "staging"
}

# 取消测试
POST /api/tests/runs/:runId/cancel
Authorization: Bearer <token>

# 获取测试运行状态
GET /api/tests/runs/:runId
Authorization: Bearer <token>
```

#### AI批量修改
```bash
# 创建AI批量修改会话 (干跑)
POST /api/v1/ai-bulk/dry-run
Authorization: Bearer <token>
{
  "system": "电商系统",
  "module": "用户管理",
  "tagFilter": ["登录", "认证"],
  "priorityFilter": "high",
  "changeBrief": "将所有登录按钮从单击改为双击操作"
}

# 应用选中的修改提案
POST /api/v1/ai-bulk/apply
Authorization: Bearer <token>
{
  "sessionId": 123,
  "selectedProposals": [1, 2, 3]
}

# 获取修改会话详情
GET /api/v1/ai-bulk/session/:id
Authorization: Bearer <token>

# 取消修改会话
POST /api/v1/ai-bulk/cancel
Authorization: Bearer <token>
{
  "sessionId": 123
}
```

### WebSocket 事件

```typescript
// 连接认证
ws://localhost:3001?token=<jwt_token>

// 测试状态更新
{
  "type": "test_update",
  "runId": "uuid",
  "data": {
    "status": "running" | "completed" | "failed",
    "progress": 75,
    "currentStep": "点击登录按钮",
    "startTime": "2025-01-15T10:30:00Z"
  }
}

// 测试完成
{
  "type": "test_complete",
  "runId": "uuid",
  "data": {
    "status": "passed" | "failed",
    "duration": 45000,
    "screenshots": ["step1.png", "step2.png"]
  }
}
```

## 🐛 故障排除

### 1. 数据库连接问题

```bash
# 检查 MySQL 服务状态
net start mysql  # Windows
sudo systemctl start mysql  # Linux

# 测试数据库连接
npx prisma db pull

# 重新应用迁移
npx prisma migrate reset
npx prisma migrate deploy
```

### 2. 认证问题 🆕

```bash
# 检查 JWT_SECRET 是否配置
echo $JWT_SECRET  # Linux/Mac
echo %JWT_SECRET%  # Windows

# 清除浏览器缓存和 Token
# 检查 Token 是否过期

# 重新生成用户密码
node scripts/migrate-users.ts
```

### 3. MCP 服务器启动失败

```bash
# 检查 MCP 服务器状态
npx @anthropic-ai/mcp-server-playwright --version

# 重新安装 MCP 服务器
npm install @anthropic-ai/mcp-server-playwright

# 清理并重新安装
rm -rf node_modules package-lock.json
npm install
```

### 4. Playwright 浏览器问题

```bash
# 重新安装浏览器
npx playwright install chromium

# 清理缓存
npx playwright uninstall
npx playwright install

# 检查浏览器权限 (Linux)
sudo apt-get install libnss3 libatk-bridge2.0-0 libxcomposite1 libxdamage1
```

### 5. 端口占用

```bash
# Windows 查看端口占用
netstat -ano | findstr :3001
netstat -ano | findstr :5173

# Linux/Mac 查看端口占用
lsof -i :3001
lsof -i :5173

# 修改端口配置
export PORT=3002
export VITE_PORT=5174
```

### 6. WebSocket 连接失败

```bash
# 检查防火墙设置
sudo ufw allow 3001  # Linux
# Windows: 控制面板 → 系统和安全 → Windows Defender 防火墙

# 检查 Token 认证
# WebSocket 连接需要在 URL 中携带 token 参数

# 查看详细错误日志
tail -f logs/server.log
```

### 7. 性能问题

```bash
# 监控系统资源
htop  # Linux
Get-Process | Sort-Object CPU -Descending | Select-Object -First 10  # Windows PowerShell

# 清理老旧文件
node scripts/cleanup-debug-files.cjs --confirm

# 重启服务释放内存
npm run dev
```

### 常见错误代码

| 错误码 | 说明 | 解决方案 |
|--------|------|----------|
| `ECONNREFUSED` | 数据库连接被拒绝 | 检查 MySQL 服务和连接配置 |
| `EADDRINUSE` | 端口被占用 | 修改端口或终止占用进程 |
| `P1001` | 数据库服务器无法访问 | 启动 MySQL 服务 |
| `PLAYWRIGHT_TIMEOUT` | 浏览器操作超时 | 检查网络和目标网站状态 |
| `UNAUTHORIZED` | 认证失败 | 检查 Token 是否有效或已过期 |
| `FORBIDDEN` | 权限不足 | 检查用户角色和权限配置 |

## 🛣️ 开发路线图

### 第一阶段 (已完成) ✅
- [x] 基础 MCP + Playwright 集成
- [x] 现代化 Web 界面 (React 18 + TypeScript + Ant Design)
- [x] 数据持久化 (Prisma + MySQL)
- [x] **用户认证系统** - JWT认证、角色权限、部门管理 🆕
- [x] 系统模块分类管理
- [x] 测试套件管理
- [x] WebSocket 实时状态同步
- [x] 基础测试执行功能
- [x] **AI批量修改功能** - 智能批量更新测试用例
- [x] **现代化编辑界面** - 美观的提案编辑和预览
- [x] **审计日志系统** - 操作审计和追踪 🆕

### 第二阶段 (规划中) 📋
- [ ] 实时画面展示 (MJPEG 流)
- [x] 并发控制和队列管理 (Bull队列 + 用户限制) ✅
- [ ] 复盘工具 (Trace 文件 + 视频录制)
- [ ] 自动资源清理
- [ ] 性能监控和优化
- [ ] **多租户支持** - 租户隔离和数据隔离
- [ ] **SSO单点登录** - 企业级统一认证

### 第三阶段 (长期规划) 📋
- [ ] 测试用例可视化编辑器 (拖拽式)
- [ ] 更多浏览器支持 (Firefox, Safari)
- [ ] 高级分析 (趋势分析、成功率统计)
- [ ] 本地 Agent 支持 (可选弹窗调试)
- [ ] 测试报告导出 (PDF, HTML, Excel)
- [ ] **移动端 App** - iOS/Android 原生应用

### 第四阶段 (未来愿景) 🔮
- [ ] AI 增强功能
  - [ ] 自然语言转测试用例
  - [ ] 智能故障诊断
  - [ ] 自动化测试建议
  - [ ] 测试用例自动生成
- [ ] 企业级功能
  - [ ] 分布式执行
  - [ ] CI/CD 集成 (Jenkins, GitLab, GitHub Actions)
  - [ ] 多环境管理
  - [ ] 数据备份和恢复
- [ ] 高级特性
  - [ ] 接口测试支持 (REST/GraphQL)
  - [ ] 移动端测试 (Appium集成)
  - [ ] 性能测试集成
  - [ ] 可视化回归测试

## 📈 当前版本亮点

### v2.3.0 (最新) 🎉
- 🔐 **完整的用户认证系统**: JWT认证、角色权限、部门管理、API令牌支持
- ✨ **AI批量修改**: 智能批量更新测试用例，支持自然语言描述变更需求
- 🎨 **现代化 UI 升级**: Ant Design 企业级组件，美观专业
- 🤖 **智能提案系统**: AI自动生成修改提案，用户可手动调整后应用
- 📊 **系统模块分类**: 支持按系统和模块组织测试用例
- ✨ **测试套件管理**: 批量执行相关测试用例
- 🔧 **数据库增强**: 完整的数据持久化和类型安全
- 🔍 **审计日志**: 所有关键操作自动记录和追踪
- ⚙️ **特性开关**: 支持特性开关和灰度发布
- 🧹 **项目清理**: 自动清理调试文件工具

### 技术特点
- **AI 智能驱动**: 基于大模型的自然语言测试解析和执行
- **企业级安全**: JWT认证、角色权限、审计日志
- **架构先进**: MCP + AI + Playwright 完整技术栈
- **类型安全**: 完整的 TypeScript 类型定义
- **实时通信**: WebSocket 支持状态实时同步
- **数据持久化**: Prisma ORM 保证数据一致性
- **队列管理**: Bull 队列支持任务排队和并发控制

## 🤝 贡献指南

1. Fork 项目
2. 创建功能分支: `git checkout -b feature/amazing-feature`
3. 提交修改: `git commit -m 'Add amazing feature'`
4. 推送分支: `git push origin feature/amazing-feature`
5. 创建 Pull Request

### 代码规范
- 遵循 ESLint 规则
- 使用 TypeScript 严格模式
- 编写单元测试
- 添加必要的注释

## 📄 许可证

MIT License - 详见 [LICENSE](LICENSE) 文件

## 🆘 技术支持

- **问题反馈**: GitHub Issues
- **讨论交流**: GitHub Discussions
- **文档**: [在线文档](https://docs.testflow.dev) (规划中)
- **邮件联系**: support@testflow.dev

---

## 📸 产品截图

### 登录界面 🆕
```
[登录界面截图将在此处展示]
- 现代化的登录设计
- 支持"记住我"功能
- 安全的 JWT 认证
```

### 主界面 - 测试用例管理
```
[测试用例管理界面截图将在此处展示]
- 现代化的卡片式设计
- 智能筛选和搜索功能
- 系统模块分类管理
- Ant Design 专业 UI
```

### AI批量修改界面
```
[AI批量修改界面截图将在此处展示]
- 直观的修改前后对比
- 美观的提案卡片设计
- 智能编辑和实时预览
- 风险评估和版本控制
```

### 测试执行实时画面
```
[测试执行界面截图将在此处展示]
- 实时状态更新
- 详细的执行日志
- 截图和视频回放
```

---

**TestFlow** - 让自动化测试变得简单而强大！ 🚀

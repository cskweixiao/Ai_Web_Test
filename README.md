# 🔥 TestFlow - 企业级自动化测试平台

## 🎯 项目特点

- **🤖 AI 智能驱动** - 基于大模型的自然语言测试解析，通过 MCP 协议高效执行
- **📱 现代化 UI** - React 18 + TypeScript + Tailwind CSS，响应式设计，体验流畅
- **⚡ 实时更新** - WebSocket 支持，测试执行状态实时同步
- **🎭 标准协议** - 基于 MCP (Model Context Protocol) 标准化设计，AI模型与工具无缝集成
- **📊 数据驱动** - Prisma ORM + MySQL，完整的测试数据管理和统计分析
- **🏢 企业就绪** - 支持系统模块分类、测试套件管理，适合团队协作
- **🔧 易于扩展** - 模块化架构，支持插件式功能扩展

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
│ │ Tailwind    │ │ │ Prisma ORM    │ │ │ MCP Client            │ │
│ └─────────────┘ │ └───────────────┘ │ └───────────────────────┘ │
│                 │                   │             │             │
│ ┌─────────────┐ │ ┌───────────────┐ │ ┌───────────┼───────────┐ │
│ │ 测试管理    │ │ │ 数据存储      │ │ │ 大模型API │ Playwright │ │
│ │ 用例编辑    │ │ │ 状态同步      │ │ │ 自然语言  │ 浏览器执行│ │
│ │ 套件管理    │ │ │ API 服务      │ │ │ 智能解析  │ 截图保存  │ │
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

# 3. 同时启动前后端
npm run dev

# 或分别启动
npm run dev:frontend  # 前端 (端口 5173)
npm run dev:server    # 后端 (端口 3001)
```

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

### 1. 启动系统
启动成功后访问: **http://localhost:5173**

### 2. 测试用例管理
#### 创建测试用例
- 点击 "测试用例管理" → "创建测试用例"
- 填写基本信息：名称、步骤、断言预期
- **新功能**: 设置系统分类（如：电商系统、CRM系统）
- **新功能**: 设置模块分类（如：用户管理、商品管理）
- 设置优先级和状态
- 添加标签便于筛选

#### 管理测试用例
- 支持按系统、模块、标签、优先级筛选
- 实时搜索功能
- 批量操作支持

### 3. 测试套件管理
#### 创建测试套件
- 切换到 "测试套件" 标签页
- 选择多个相关测试用例组合成套件
- 设置套件名称和描述
- 支持优先级和标签管理

#### 执行测试套件
- 一键执行整个测试套件
- 批量执行相关测试用例
- 查看套件执行进度

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
- **批量操作**: 支持全选、筛选和批量应用
- **智能重置**: 随时恢复为AI原始建议

#### 安全应用
- **预览确认**: 应用前可详细预览所有变更
- **选择性应用**: 只应用选中的提案，灵活控制
- **实时反馈**: 显示应用进度和结果统计

### 5. 结果分析
- 查看详细的执行日志和截图  
- 基础的测试运行记录
- 测试结果状态跟踪

## 🔧 配置说明

### 数据库配置 (`.env`)

```bash
# 数据库连接
DATABASE_URL="mysql://username:password@localhost:3306/testflow"

# 应用配置
PORT=3001                           # 后端端口
VITE_PORT=5173                     # 前端端口
NODE_ENV=development               # 环境模式

# Playwright 设置
PLAYWRIGHT_HEADLESS=true           # 无头模式
PLAYWRIGHT_BROWSER=chromium        # 浏览器类型

# 测试执行配置
TEST_TIMEOUT=600000                # 测试超时时间 (10分钟)

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
│   │   └── TestResult.tsx        # 测试结果组件
│   ├── pages/                    # 页面组件
│   │   ├── TestCases.tsx         # 测试用例管理 (已增强)
│   │   ├── TestRuns.tsx          # 测试运行页面
│   │   └── Dashboard.tsx         # 仪表板
│   ├── services/                 # API 服务
│   │   └── testService.ts        # 测试服务客户端
│   └── types/                    # TypeScript 类型定义
│       └── test.ts               # 测试相关类型 (已扩展)
├── server/                       # 后端源码
│   ├── services/                 # 业务服务层
│   │   ├── testExecution.ts      # 测试执行服务 (已增强)
│   │   ├── mcpClient.ts          # MCP 客户端
│   │   └── websocket.ts          # WebSocket 管理
│   ├── routes/                   # API 路由层
│   │   ├── test.ts               # 测试相关路由
│   │   └── suite.ts              # 测试套件路由
│   └── types/                    # 后端类型定义
├── prisma/                       # 数据库相关
│   ├── schema.prisma             # 数据库模式 (已扩展)
│   └── migrations/               # 数据库迁移文件
├── scripts/                      # 工具脚本
│   ├── start.cjs                 # 启动脚本
│   ├── cleanup-debug-files.cjs   # 调试文件清理
│   └── mcp-start.cjs             # MCP 服务启动
└── screenshots/                  # 测试截图存储
```

### 核心技术栈

#### 前端技术
- **React 18**: 现代化前端框架
- **TypeScript**: 类型安全的JavaScript
- **Tailwind CSS**: 实用优先的CSS框架
- **Framer Motion**: 动画库
- **Vite**: 快速构建工具

#### 后端技术  
- **Node.js + Express**: 服务端运行时和Web框架
- **Prisma ORM**: 现代化数据库ORM
- **MySQL**: 关系型数据库
- **WebSocket**: 实时通信
#### AI与测试引擎
- **大模型集成**: 支持多种 AI 模型 (Claude, GPT-4o 等)
- **MCP (Model Context Protocol)**: AI模型与工具的标准化协议
- **AI Parser**: 自然语言测试解析引擎
- **Playwright**: 浏览器自动化引擎

### API 接口

#### 测试用例管理
```bash
# 获取测试用例 (支持系统、模块筛选)
GET /api/tests/cases?system=电商系统&module=用户管理

# 创建测试用例 (支持系统、模块字段)
POST /api/tests/cases
{
  "name": "用户登录测试",
  "steps": "1. 打开登录页面...",
  "assertions": "页面跳转成功",
  "system": "电商系统",
  "module": "用户管理",
  "priority": "high",
  "tags": ["登录", "认证"]
}

# 更新测试用例
PUT /api/tests/cases/:id

# 删除测试用例
DELETE /api/tests/cases/:id
```

#### 测试套件管理
```bash
# 获取测试套件
GET /api/tests/suites

# 创建测试套件
POST /api/tests/suites
{
  "name": "用户模块回归测试",
  "description": "用户相关功能的完整测试",
  "testCaseIds": [1, 2, 3],
  "priority": "high"
}

# 执行测试套件
POST /api/tests/suites/:id/run

# 获取套件运行状态
GET /api/tests/suites/:id/runs/:runId
```


#### 执行控制
```bash
# 执行单个测试
POST /api/tests/execute
{
  "testCaseId": 1,
  "environment": "staging"
}

# 取消测试
POST /api/tests/runs/:runId/cancel

# 获取测试运行状态
GET /api/tests/runs/:runId
```

#### AI批量修改
```bash
# 创建AI批量修改会话 (干跑)
POST /api/v1/ai-bulk/dry-run
{
  "system": "电商系统",
  "module": "用户管理", 
  "tagFilter": ["登录", "认证"],
  "priorityFilter": "high",
  "changeBrief": "将所有登录按钮从单击改为双击操作"
}

# 应用选中的修改提案
POST /api/v1/ai-bulk/apply
{
  "sessionId": 123,
  "selectedProposals": [1, 2, 3]
}

# 获取修改会话详情
GET /api/v1/ai-bulk/session/:id

# 取消修改会话
POST /api/v1/ai-bulk/cancel
{
  "sessionId": 123
}
```

### WebSocket 事件

```typescript
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

### 2. MCP 服务器启动失败

```bash
# 检查 MCP 服务器状态
npx @anthropic-ai/mcp-server-playwright --version

# 重新安装 MCP 服务器
npm install @anthropic-ai/mcp-server-playwright

# 清理并重新安装
rm -rf node_modules package-lock.json
npm install
```

### 3. Playwright 浏览器问题

```bash
# 重新安装浏览器
npx playwright install chromium

# 清理缓存
npx playwright uninstall
npx playwright install

# 检查浏览器权限 (Linux)
sudo apt-get install libnss3 libatk-bridge2.0-0 libxcomposite1 libxdamage1
```

### 4. 端口占用

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

### 5. WebSocket 连接失败

```bash
# 检查防火墙设置
sudo ufw allow 3001  # Linux
# Windows: 控制面板 → 系统和安全 → Windows Defender 防火墙

# 检查服务状态
curl -I http://localhost:3001/api/health

# 查看详细错误日志
tail -f logs/server.log
```

### 6. 性能问题

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

## 🛣️ 开发路线图

### 第一阶段 (已完成) ✅
- [x] 基础 MCP + Playwright 集成
- [x] 现代化 Web 界面 (React 18 + TypeScript)
- [x] 数据持久化 (Prisma + MySQL)
- [x] 系统模块分类管理
- [x] 测试套件管理
- [x] WebSocket 实时状态同步
- [x] 基础测试执行功能
- [x] **AI批量修改功能** - 智能批量更新测试用例
- [x] **现代化编辑界面** - 美观的提案编辑和预览

### 第二阶段 (规划中) 📋
- [ ] 实时画面展示 (MJPEG 流)
- [ ] 并发控制和队列管理 (6并发 + 用户限制)
- [ ] 复盘工具 (Trace 文件 + 视频录制)
- [ ] 自动资源清理
- [ ] 性能监控和优化

### 第三阶段 (长期规划) 📋
- [ ] 测试用例可视化编辑器
- [ ] 更多浏览器支持 (Firefox, Safari)
- [ ] 高级分析 (趋势分析、成功率统计)
- [ ] 本地 Agent 支持 (可选弹窗调试)
- [ ] 测试报告导出 (PDF, HTML)

### 第四阶段 (未来愿景) 🔮
- [ ] AI 增强功能
  - [ ] 自然语言转测试用例
  - [ ] 智能故障诊断
  - [ ] 自动化测试建议
- [ ] 企业级功能
  - [ ] 分布式执行
  - [ ] CI/CD 集成 (Jenkins, GitLab)
  - [ ] 多环境管理
  - [ ] SSO 集成
- [ ] 高级特性
  - [ ] 接口测试支持
  - [ ] 移动端测试
  - [ ] 性能测试集成

## 📈 当前版本亮点

### v2.2.0 (最新) 🎉
- ✨ **AI批量修改**: 智能批量更新测试用例，支持自然语言描述变更需求
- 🎨 **现代化编辑界面**: 全新设计的美观编辑弹窗，支持内联编辑和实时预览
- 🤖 **智能提案系统**: AI自动生成修改提案，用户可手动调整后应用
- 📊 **系统模块分类**: 支持按系统和模块组织测试用例
- ✨ **测试套件管理**: 批量执行相关测试用例
- 🔧 **数据库增强**: 完整的数据持久化和类型安全
- 🧹 **项目清理**: 自动清理调试文件工具

### 技术特点
- **AI 智能驱动**: 基于大模型的自然语言测试解析和执行
- **架构先进**: MCP + AI + Playwright 完整技术栈
- **类型安全**: 完整的 TypeScript 类型定义
- **实时通信**: WebSocket 支持状态实时同步
- **数据持久化**: Prisma ORM 保证数据一致性

## 🤝 贡献指南

1. Fork 项目
2. 创建功能分支: `git checkout -b feature/amazing-feature`
3. 提交修改: `git commit -m 'Add amazing feature'`
4. 推送分支: `git push origin feature/amazing-feature`
5. 创建 Pull Request

## 📄 许可证

MIT License - 详见 [LICENSE](LICENSE) 文件

## 🆘 技术支持

- **问题反馈**: GitHub Issues
- **讨论交流**: GitHub Discussions
- **邮件联系**: support@testflow.dev

---

## 📸 产品截图

### 主界面 - 测试用例管理
```
[测试用例管理界面截图将在此处展示]
- 现代化的卡片式设计
- 智能筛选和搜索功能
- 系统模块分类管理
```

### AI批量修改界面
```
[AI批量修改界面截图将在此处展示] 
- 直观的修改前后对比
- 美观的提案卡片设计
- 智能编辑和实时预览
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
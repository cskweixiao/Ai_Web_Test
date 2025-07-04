# 🔥 TestFlow - 无大模型的 MCP + Playwright 自动化测试平台

## 🎯 项目特点

- **🚀 无需大模型** - 直接通过 MCP 协议调用 Playwright，性能更好
- **📱 现代化 UI** - React + TypeScript + Tailwind CSS，界面美观
- **⚡ 实时更新** - WebSocket 支持，测试执行状态实时同步
- **🎭 标准协议** - 基于 MCP (Model Context Protocol) 标准化设计
- **🔧 易于扩展** - 模块化架构，后续可无缝接入 AI 能力

## 🏗️ 架构设计

```
前端 React App ─→ 后端 Express API ─→ MCP Client ─→ Playwright MCP Server ─→ 浏览器自动化
       ↓                    ↓
   WebSocket ←────────────────┘
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

- **Node.js** >= 18.0.0
- **NPM** >= 8.0.0
- **操作系统**: Windows 10+, macOS 10.15+, Linux
- **内存**: 最少 4GB RAM (推荐 8GB+)

## 🎮 使用方法

### 1. 打开界面
启动成功后访问: **http://localhost:5173**

### 2. 查看测试用例
- 左侧菜单点击 "测试用例管理"
- 查看预置的测试用例 (登录测试、购物车测试等)

### 3. 执行测试
- 点击测试用例卡片右上角的 **播放按钮** ▶️
- 实时查看执行状态和日志
- 支持取消正在运行的测试

### 4. 查看结果
- 切换到 "测试执行" 页面
- 查看详细的执行日志和截图
- 支持下载测试报告

## 🔧 配置说明

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
    "screenshot": true
  }
}
```

### 环境变量

```bash
# 后端端口 (默认 3001)
PORT=3001

# 前端端口 (默认 5173)
VITE_PORT=5173

# Playwright 设置
PLAYWRIGHT_HEADLESS=true
PLAYWRIGHT_BROWSER=chromium
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
├── src/                    # 前端源码
│   ├── components/         # React 组件
│   ├── pages/             # 页面组件
│   ├── services/          # API 服务
│   └── types/             # TypeScript 类型
├── server/                # 后端源码
│   ├── services/          # 业务服务
│   │   ├── mcpClient.ts   # MCP 客户端
│   │   ├── testExecution.ts # 测试执行
│   │   └── websocket.ts   # WebSocket 管理
│   └── routes/            # API 路由
├── scripts/               # 启动脚本
└── screenshots/           # 测试截图
```

### API 接口

```bash
# 获取测试用例
GET /api/tests/cases

# 执行测试
POST /api/tests/execute
{
  "testCaseId": 1,
  "environment": "staging"
}

# 获取测试运行状态
GET /api/tests/runs/:runId

# 取消测试
POST /api/tests/runs/:runId/cancel
```

### WebSocket 事件

```typescript
// 测试状态更新
{
  "type": "test_update",
  "runId": "uuid",
  "data": { /* TestRun 对象 */ }
}

// 测试完成
{
  "type": "test_complete", 
  "runId": "uuid",
  "data": { /* 最终结果 */ }
}

// 实时日志
{
  "type": "log",
  "runId": "uuid", 
  "data": { /* 日志信息 */ }
}
```

## 🐛 故障排除

### 1. MCP 服务器启动失败

```bash
# 检查 MCP 服务器状态
npx @anthropic-ai/mcp-server-playwright --version

# 重新安装 MCP 服务器
npm install @anthropic-ai/mcp-server-playwright
```

### 2. Playwright 浏览器问题

```bash
# 重新安装浏览器
npx playwright install chromium

# 清理缓存
npx playwright uninstall
npx playwright install
```

### 3. 端口占用

```bash
# 查看端口占用
netstat -ano | findstr :3001
netstat -ano | findstr :5173

# 或修改端口配置
export PORT=3002
export VITE_PORT=5174
```

### 4. WebSocket 连接失败

- 检查防火墙设置
- 确认后端服务正常运行
- 查看浏览器控制台错误信息

## 🔮 后续扩展计划

### 第一阶段 (当前) ✅
- [x] 基础 MCP + Playwright 集成
- [x] 实时测试执行
- [x] 现代化 Web 界面

### 第二阶段 🚧
- [ ] 测试用例可视化编辑器
- [ ] 更多浏览器支持 (Firefox, Safari)
- [ ] 测试报告导出 (PDF, HTML)
- [ ] 定时任务调度

### 第三阶段 🔮
- [ ] AI 增强 (自然语言转测试用例)
- [ ] 分布式执行
- [ ] CI/CD 集成
- [ ] 多环境管理

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

**TestFlow** - 让自动化测试变得简单而强大！ 🚀 
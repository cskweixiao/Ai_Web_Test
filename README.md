# 🔥 TestFlow - 企业级 AI 驱动的自动化测试平台

<div align="center">

[![Version](https://img.shields.io/badge/version-2.5.0-blue.svg)](https://github.com/testflow/testflow)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org)
[![React](https://img.shields.io/badge/react-18.3.1-blue.svg)](https://reactjs.org)

**让测试用例编写效率提升 20-50 倍的智能测试平台**

[快速开始](#-快速启动) • [功能特性](#-核心功能) • [在线文档](https://docs.testflow.dev) • [问题反馈](https://github.com/testflow/testflow/issues)

</div>

---

## 🎯 核心亮点

### 🎨 AI 测试用例生成器 ⭐ NEW
**从 Axure 原型到测试用例,10 分钟完成 2-3 天的工作**
- 📤 自动解析 Axure HTML 文件,提取页面结构和交互逻辑
- 🧠 AI 智能生成结构化需求文档,忠实原型无编造
- ✨ 批量生成高质量测试用例,覆盖率达 85-95%
- 🔍 **RAG知识库增强**: 向量数据库检索历史经验,提升测试用例专业度
- 🔄 **多模型支持**: GPT-4o / DeepSeek / Claude / Gemini,一键切换 🆕
- 💾 一键保存到用例库,支持迭代优化

### 🤖 AI 批量修改引擎
**用自然语言描述变更,智能更新海量测试用例**
- 📝 自然语言描述修改需求
- 🔍 智能筛选相关测试用例
- ⚡ AI 生成精确修改提案
- ✅ 可视化对比与风险评估

### 🎭 MCP + Playwright 测试执行
**基于标准协议的浏览器自动化测试**
- 🌐 Playwright 驱动的浏览器自动化
- 📡 实时 WebSocket 状态推送
- 📸 自动截图和视频录制
- 🔄 并发控制和队列管理

### 🔐 完整的企业级用户体系
**安全可靠的权限管理**
- 🔑 JWT 认证 + 角色权限管理
- 🏢 部门组织架构支持
- 🎫 API Token 自动化集成
- 📋 全流程审计日志

### 📊 现代化的管理界面
**React 18 + Tailwind CSS 企业级 UI**
- 🎨 精美的视觉设计和流畅动画
- 📱 完全响应式,支持多设备
- 🚀 极速加载,优秀的用户体验
- 🎯 直观的操作流程

---

## 🏗️ 技术架构

```
┌─────────────────────────────────────────────────────────────────┐
│                        TestFlow 系统架构                         │
├─────────────────┬───────────────────┬───────────────────────────┤
│   前端层        │     后端层        │      AI 执行层            │
│                 │                   │                           │
│ ┌─────────────┐ │ ┌───────────────┐ │ ┌───────────────────────┐ │
│ │ React 18    │ │ │ Express API   │ │ │ AI Parser             │ │
│ │ TypeScript  │◄┼─┤ WebSocket     │◄┼─┤ Axure Parser          │ │
│ │ Tailwind    │ │ │ Prisma ORM    │ │ │ MCP Client            │ │
│ │ Framer      │ │ │ JWT Auth      │ │ │ Test Generator        │ │
│ └─────────────┘ │ └───────────────┘ │ └───────────────────────┘ │
│                 │                   │             │             │
│ ┌─────────────┐ │ ┌───────────────┐ │ ┌───────────┼───────────┐ │
│ │ • 测试管理  │ │ │ • 数据存储    │ │ │ • 大模型  │ Playwright│ │
│ │ • 用例编辑  │ │ │ • 用户认证    │ │ │ • AI生成  │ 浏览器    │ │
│ │ • 套件管理  │ │ │ • 状态同步    │ │ │ • 智能分析│ 自动化    │ │
│ │ • AI生成器  │ │ │ • API 服务    │ │ │ • 批量修改│ 截图保存  │ │
│ └─────────────┘ │ └───────────────┘ │ └───────────┴───────────┘ │
└─────────────────┴───────────────────┴───────────────────────────┘
                           │
                    ┌──────┴──────┐
                    │   MySQL     │
                    │   数据库    │
                    └─────────────┘
```

---

## 🚀 快速启动

### 方式一: 一键启动 (推荐)

```bash
# 克隆项目
git clone https://github.com/testflow/testflow.git
cd testflow

# 一键启动 (自动安装依赖、配置环境、启动服务)
node scripts/start.js
```

### 方式二: 手动启动

```bash
# 1. 安装依赖
npm install

# 2. 安装 Playwright 浏览器
npx playwright install chromium

# 3. 配置数据库
# 编辑 .env 文件,配置 DATABASE_URL
npx prisma migrate deploy
npx prisma generate

# 4. 同时启动前后端
npm run dev

# 或分别启动
npm run dev:frontend  # 前端 (端口 5173)
npm run dev:server    # 后端 (端口 3001)
```

### 首次登录

访问: **http://localhost:5173**

默认管理员账号:
- 用户名: `admin`
- 密码: `admin123`
- ⚠️ 首次登录后请立即修改密码

### 可选: 启用 RAG 知识库增强 🆕

如果需要使用 RAG 知识库增强功能(提升测试用例专业度):

```bash
# 1. 启动 Qdrant 向量数据库 (Docker)
docker run -d -p 6333:6333 qdrant/qdrant

# 2. 配置 Embedding API (.env)
QDRANT_URL=http://localhost:6333
EMBEDDING_PROVIDER=aliyun
EMBEDDING_API_KEY=your_aliyun_api_key  # 从阿里云获取

# 3. 重启服务,RAG 功能将自动生效
npm run dev
```

**说明**:
- RAG 功能为可选,不影响基础功能使用
- 启用后,测试用例生成质量和专业度会显著提升
- 详细配置见 [RAG 知识库增强](#6--rag-知识库增强-向量数据库-) 章节

---

## 📋 系统要求

### 基础环境
| 组件 | 版本要求 | 说明 |
|------|----------|------|
| Node.js | >= 18.0.0 | JavaScript 运行时 |
| NPM | >= 8.0.0 | 包管理器 |
| MySQL | >= 8.0 | 数据库 (推荐) |
| **Qdrant** 🆕 | **>= 1.12** | **向量数据库 (可选,用于 RAG)** |
| 操作系统 | Windows 10+ / macOS 10.15+ / Linux | - |
| 内存 | >= 8GB | 推荐 16GB+ (启用 RAG 建议 12GB+) |
| 磁盘 | >= 20GB | 可用空间 (启用 RAG 建议 30GB+) |

### 推荐配置 (10 人团队)
- **CPU**: 8 vCPU
- **内存**: 16GB RAM
- **存储**: SSD 100GB+
- **网络**: 稳定的内网环境
- **数据库**: MySQL 8.0 (utf8mb4 字符集)

---

## 💡 核心功能

### 1. 🎨 AI 测试用例生成 (Axure 原型解析) ⭐

#### 功能概述
从 Axure 原型文件一键生成完整的功能测试用例,效率提升 **20-50 倍**!

#### 三步流程

**步骤 1: 上传 Axure 原型**
- 支持 `.html` / `.htm` 格式 (Axure RP 8/9/10)
- 拖拽上传,最大 50MB
- 自动解析页面结构、交互元素、业务流程

**步骤 2: AI 生成需求文档**
- AI 理解原型结构和业务逻辑
- 生成结构化 Markdown 需求文档
- 🆕 **自动添加"页面布局与文案校验"章节** (覆盖UI/文案验证)
- 支持在线编辑和实时预览
- 完整性评分和改进建议

**步骤 3: 批量生成测试用例**
- 智能规划测试场景和批次
- 🆕 **自动为"页面布局与文案校验"章节生成测试用例** (6-8个测试点)
- 自动生成测试步骤和断言
- 质量评分 (0-100) 和优先级分配
- 一键保存到用例库

#### 核心价值

| 指标 | 传统方式 | AI 生成器 | 提升 |
|------|---------|----------|------|
| **编写时间** | 2-3 天 | 10-30 分钟 | **20-50x** |
| **功能覆盖率** | 60-70% | 85-95% | **+25-35%** |
| **UI/文案覆盖率** 🆕 | 0-20% | 80-95% | **+60-95%** |
| **规范性** | 70-80% | 95%+ | **+15-25%** |
| **人力成本节省** | 100% | 10-20% | **节省 80-90%** |

#### 使用示例

```bash
# 访问 AI 生成器页面
http://localhost:5173/functional-test-cases/generator

# 或导航到: 功能测试用例 → AI 生成器
```

---

### 2. 🤖 AI 批量修改测试用例

#### 功能概述
使用自然语言描述变更需求,AI 自动生成精确的修改提案。

#### 核心特性

**智能理解变更需求**
```
示例: 将所有登录相关的测试用例中的"点击登录按钮"改为"双击登录按钮",
因为产品交互方式发生了变化。
```

**精准筛选相关用例**
- 按系统、模块、标签、优先级筛选
- AI 智能匹配相关测试用例
- 预览影响范围和数量

**可视化修改对比**
- 直观的修改前后对比
- 支持内联编辑调整
- 风险评估 (低/中/高)
- 版本控制和回滚

**批量安全应用**
- 选择性应用提案
- 实时进度反馈
- 应用结果统计

#### 使用流程

```bash
测试用例管理 → AI 批量更新 → 描述变更 → 审核提案 → 应用修改
```

---

### 3. 🎭 MCP + Playwright 自动化测试执行

#### 核心技术
- **MCP (Model Context Protocol)**: AI 模型与工具的标准化协议
- **Playwright**: 强大的浏览器自动化引擎
- **WebSocket**: 实时双向通信

#### 支持的操作

| 操作类型 | 说明 | 参数 |
|---------|------|------|
| `navigate` | 导航到页面 | `url` |
| `click` | 点击元素 | `selector` |
| `fill` | 填充表单 | `selector`, `value` |
| `expect` | 验证断言 | `selector`, `condition` |
| `screenshot` | 截图保存 | `filename` (可选) |
| `wait` | 等待时间 | `timeout` |
| `hover` | 悬停元素 | `selector` |

#### 执行特性
- ✅ 单用例/套件批量执行
- ✅ 并发控制和队列管理
- ✅ 实时状态 WebSocket 推送
- ✅ 自动截图和视频录制
- ✅ 详细的执行日志

---

### 4. 🔐 企业级用户管理

#### 认证与授权
- **JWT Token 认证**: 安全可靠,支持过期和刷新
- **角色权限管理**: 超级管理员 / 普通用户 / 自定义角色
- **部门组织架构**: 多级部门支持,灵活分组
- **API Token**: 支持 CI/CD 集成,作用域控制

#### 审计与安全
- **操作审计日志**: 所有关键操作自动记录
- **密码加密**: bcrypt 安全加密
- **会话管理**: 自动过期和续期
- **权限验证**: 接口级别的细粒度控制

---

### 5. 📊 测试用例管理

#### 完整的生命周期管理
- **创建与编辑**: 结构化步骤编辑器,支持 JSON 格式
- **分类组织**: 系统/模块分类,标签管理
- **优先级管理**: Critical / High / Medium / Low
- **版本控制**: 自动版本快照,支持回滚
- **批量操作**: 导入/导出、批量编辑、批量删除

#### 高级筛选
- 按系统、模块筛选
- 按优先级、标签筛选
- 关键词实时搜索
- 自定义筛选条件

---

### 6. 🔍 RAG 知识库增强 (向量数据库) 🆕

#### 技术架构
- **Qdrant 向量数据库**: 高性能的向量搜索引擎
- **阿里云通义千问 Embedding**: 1024 维向量化,支持中文语义理解
- **RAG 检索流程**: 语义搜索 → 知识注入 → AI 生成增强

#### 知识分类
TestFlow 维护了四大类测试知识库:

| 分类 | 说明 | 示例 |
|------|------|------|
| **业务规则** | 常见业务逻辑和验证规则 | "金额字段必须大于0", "订单状态流转规则" |
| **测试模式** | 成熟的测试设计模式 | "查询条件功能完整测试", "列表数据展示校验" |
| **易错点** | 历史缺陷和易遗漏场景 | "特殊字符导致查询失败", "边界值未处理" |
| **风险场景** | 高风险和安全相关测试 | "SQL注入风险", "权限绕过风险" |

#### 工作原理

**1. 语义检索** (Qdrant + 通义千问 Embedding)
```
用户需求 → 向量化 (1024维) → Qdrant 检索 → Top-3 相关知识 (相似度 ≥ 0.5)
```

**2. 知识注入** (AI Prompt 增强)
```
系统提示词 + RAG 检索知识 + 用户需求 → AI 模型
```

**3. 增强生成** (专业度提升)
```
AI 结合历史经验 → 生成更专业的测试用例
```

#### 核心价值

| 指标 | 无 RAG | 有 RAG | 提升 |
|------|--------|--------|------|
| **测试覆盖率** | 70-80% | 85-95% | **+15-25%** |
| **专业准确性** | 75-85% | 90-98% | **+15-20%** |
| **边界值覆盖** | 40-60% | 80-95% | **+40-55%** |
| **风险场景识别** | 50-70% | 85-95% | **+35-45%** |

#### 使用场景

**生成测试用例时自动启用**
- 在 AI 生成测试用例的第 3 步(生成测试点)自动检索相关知识
- 无需额外配置,只要配置好 Qdrant 和 Embedding API 即可
- 日志中会显示 `[RAG模式]` 标识和检索到的知识数量

**查看检索日志**
```bash
# 查看完整 RAG 检索过程
tail -f logs/server.log | grep "RAG"

# 示例输出:
# ✅ [RAG-Step2] 向量检索完成 (耗时: 245ms)
# 📊 [RAG-Step3] 业务规则: 2条, 测试模式: 3条
# 🎯 [RAG模式] 将使用知识库增强模式生成测试用例
```

#### 配置知识库

**启动 Qdrant (Docker 推荐)**
```bash
# 使用 Docker 启动 Qdrant
docker run -p 6333:6333 qdrant/qdrant

# 或使用项目提供的启动脚本 (Windows)
start-qdrant.bat
```

**配置 Embedding API (.env)**
```bash
# 阿里云通义千问 (推荐,免费额度充足)
EMBEDDING_PROVIDER=aliyun
EMBEDDING_API_KEY=your_aliyun_api_key
EMBEDDING_MODEL=text-embedding-v4

# 获取 API Key: https://dashscope.console.aliyun.com/apiKey
```

---

### 7. 🧪 测试套件管理

#### 功能特性
- **套件创建**: 组合多个相关测试用例
- **批量执行**: 一键执行完整测试套件
- **实时监控**: WebSocket 实时进度推送
- **结果统计**: 通过率、失败率、执行时间

#### 执行控制
- 并发数量限制
- 队列排队执行
- 失败自动重试
- 超时控制

---

### 8. 📈 测试报告与统计

#### 报告类型
- **测试运行报告**: 详细的执行日志和截图
- **统计分析**: 成功率、失败趋势、耗时分析
- **缺陷分布**: 按模块、优先级统计
- **覆盖率报告**: 用例覆盖率分析

#### 可视化展示
- 趋势图表 (ECharts)
- 数据仪表板
- 实时统计更新

---

## 🎮 使用指南

### 1. 用户登录与管理

```bash
# 登录系统
http://localhost:5173/login

# 用户管理 (仅管理员)
设置 → 用户管理 → 创建/编辑用户
```

### 2. 创建测试用例

```bash
# 手动创建
测试用例管理 → 创建测试用例 → 填写信息 → 保存

# AI 生成 (推荐)
功能测试用例 → AI 生成器 → 上传 Axure → 生成并保存
```

### 3. 执行测试

```bash
# 单用例执行
测试用例详情 → 执行测试 → 查看结果

# 套件执行
测试套件 → 选择套件 → 批量执行 → 实时监控
```

### 4. 查看报告

```bash
# 测试运行历史
测试运行 → 选择运行记录 → 查看详情

# 统计报告
报告 → 选择时间范围 → 查看统计图表
```

### 5. 配置 AI 模型 🆕

TestFlow 现已支持 **4 种 AI 模型**,可在前端设置页面一键切换:

#### 支持的 AI 模型

| 模型 | 提供商 | 特点 | 成本级别 | 推荐场景 |
|------|--------|------|---------|---------|
| **GPT-4o** | OpenAI | 高性能,多模态 | 高 | 复杂测试用例生成 |
| **DeepSeek Chat V3** | DeepSeek | 高性价比,中文友好 | 低 | 日常测试,批量处理 |
| **Claude Sonnet 4.5** | Anthropic | 平衡性能,长上下文 | 中 | 大规模用例分析 |
| **Gemini 2.5 Flash (Local)** 🆕 | Google (本地) | 多模态,本地部署 | 低 | 本地环境,离线使用 |

#### 配置步骤

**方式 1: 使用 OpenRouter (GPT-4o, DeepSeek, Claude)**

```bash
# 1. 在 .env 文件中配置
OPENROUTER_API_KEY=sk-or-v1-xxxxx  # 从 https://openrouter.ai 获取

# 2. 前端设置
设置 → LLM 模型配置 → 选择模型 → 输入 API Key → 测试连接 → 保存设置
```

**方式 2: 使用本地 Gemini API**

```bash
# 1. 启动本地 Gemini API 服务 (端口 3000)
# 确保服务运行在 http://localhost:3000

# 2. 在 .env 文件中配置 (可选)
GEMINI_LOCAL_BASE_URL=http://localhost:3000/v1
GEMINI_LOCAL_API_KEY=your_api_key_here

# 3. 前端设置
设置 → LLM 模型配置 → 选择 "Gemini 2.5 Flash (Local)"
→ 输入 API Key → 测试连接 → 保存设置
```

#### 模型切换

所有模型配置保存在数据库中,支持随时切换:

```bash
# 在设置页面
设置 → LLM 模型配置 → 下拉菜单选择模型 → 保存设置

# 前后端自动同步,无需重启服务
```

#### 故障排查

**CORS 错误** (本地 Gemini API):
- ✅ 已自动处理,本地 API 不发送自定义请求头
- 确保本地 API 服务正常运行

**连接测试失败**:
1. 检查 API Key 是否正确
2. 确认网络连接 (OpenRouter 需要外网访问)
3. 查看浏览器控制台错误信息

---

## 🔧 配置说明

### 环境变量 (`.env`)

```bash
# ========== 数据库配置 ==========
DATABASE_URL="mysql://username:password@localhost:3306/testflow"

# ========== 应用配置 ==========
NODE_ENV=development               # 环境: development / production
PORT=3001                          # 后端端口
VITE_PORT=5173                     # 前端端口

# ========== JWT 认证 ==========
JWT_SECRET=your_jwt_secret_key_here_change_in_production
JWT_EXPIRES_IN=7d                  # Token 过期时间

# ========== Playwright 配置 ==========
PLAYWRIGHT_HEADLESS=true           # 无头模式: true / false
PLAYWRIGHT_BROWSER=chromium        # 浏览器: chromium / firefox / webkit

# ========== 测试执行配置 ==========
TEST_TIMEOUT=600000                # 测试超时: 10 分钟
MAX_CONCURRENT_TESTS=6             # 最大并发数

# ========== AI 模型配置 (支持多模型切换) 🆕 ==========
# TestFlow 现已支持 4 种 AI 模型,可在前端设置页面一键切换

# OpenRouter 配置 (支持 GPT-4o, DeepSeek, Claude)
OPENROUTER_API_KEY=your_openrouter_api_key_here
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
DEFAULT_MODEL=openai/gpt-4o        # 默认模型
DEFAULT_TEMPERATURE=0.3
DEFAULT_MAX_TOKENS=4000

# 本地 Gemini API 配置 (可选)
# 用于本地部署的 Gemini 2.5 Flash 模型,支持文本、图片、音频多模态输入
GEMINI_LOCAL_BASE_URL=http://localhost:3000/v1
GEMINI_LOCAL_API_KEY=your_local_api_key_here

# 代理配置 (用于访问国外 API,可选)
HTTP_PROXY=http://127.0.0.1:10808
HTTPS_PROXY=http://127.0.0.1:10808

# ========== RAG 知识库配置 (向量数据库) 🆕 ==========
QDRANT_URL=http://localhost:6333   # Qdrant 向量数据库地址
EMBEDDING_PROVIDER=aliyun          # Embedding 提供商: aliyun / gemini / openai
EMBEDDING_API_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
EMBEDDING_API_KEY=your_aliyun_key  # 阿里云通义千问 API Key
EMBEDDING_MODEL=text-embedding-v4  # 1024维向量模型

# ========== 日志配置 ==========
LOG_LEVEL=info                     # 日志级别: debug / info / warn / error
LOG_FULL_PROMPT=false              # 是否记录完整 AI Prompt
```

### 数据库迁移

```bash
# 初次设置
npx prisma migrate dev --name init

# 应用迁移
npx prisma migrate deploy

# 重新生成客户端
npx prisma generate

# 重置数据库 (⚠️ 慎用,会清空所有数据)
npx prisma migrate reset
```

---

## 📁 项目结构

详细的项目结构说明请查看 [PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md)

```
project/
├── src/                    # 前端源码
│   ├── components/         # React 组件
│   ├── pages/             # 页面组件
│   ├── services/          # API 服务
│   └── types/             # TypeScript 类型
├── server/                # 后端源码
│   ├── routes/            # API 路由
│   ├── services/          # 业务服务
│   └── middleware/        # 中间件
├── prisma/                # 数据库
│   ├── schema.prisma      # 数据库模式
│   └── migrations/        # 迁移文件
├── docs/                  # 文档目录
│   └── tech-docs/         # 技术文档
├── scripts/               # 工具脚本
└── README.md             # 本文件
```

---

## 🛠️ 核心技术栈

### 前端技术
| 技术 | 版本 | 说明 |
|------|------|------|
| React | 18.3.1 | 现代化前端框架 |
| TypeScript | 5.5.3 | 类型安全的 JavaScript |
| Tailwind CSS | 3.4.1 | 实用优先的 CSS 框架 |
| Framer Motion | 10.16.16 | 流畅的动画库 |
| Vite | 5.4.2 | 极速构建工具 |

### 后端技术
| 技术 | 版本 | 说明 |
|------|------|------|
| Node.js | >= 18 | 服务端运行时 |
| Express | 4.18.0 | Web 框架 |
| Prisma | 6.11.1 | 现代化 ORM |
| MySQL | >= 8.0 | 关系型数据库 |
| JWT | 9.0.2 | 身份认证 |
| WebSocket (ws) | 8.18.3 | 实时通信 |

### AI 与测试
| 技术 | 版本 | 说明 |
|------|------|------|
| MCP SDK | 1.0.0 | 模型上下文协议 |
| Playwright | 1.54.2 | 浏览器自动化 |
| Cheerio | 1.1.2 | HTML 解析 |
| **Qdrant** | **1.12+** | **向量数据库 (RAG)** 🆕 |
| **阿里通义 Embedding** | **v4** | **1024维向量化 (RAG)** 🆕 |

---

## 🐛 故障排除

### 1. 数据库连接问题

```bash
# 检查 MySQL 服务
net start mysql  # Windows
sudo systemctl start mysql  # Linux

# 测试连接
npx prisma db pull

# 重新应用迁移
npx prisma migrate reset
npx prisma migrate deploy
```

### 2. 认证问题

```bash
# 检查 JWT_SECRET 配置
echo $JWT_SECRET

# 重新生成管理员账号
node scripts/create-admin.ts

# 清除浏览器 Token
# 开发者工具 → Application → Local Storage → 清除
```

### 3. Playwright 浏览器问题

```bash
# 重新安装浏览器
npx playwright install chromium

# 清理缓存
npx playwright uninstall
npx playwright install
```

### 4. 端口占用

```bash
# Windows 查看端口
netstat -ano | findstr :3001
netstat -ano | findstr :5173

# 修改端口 (.env)
PORT=3002
VITE_PORT=5174
```

### 5. RAG 知识库连接失败 🆕

```bash
# 检查 Qdrant 服务状态
curl http://localhost:6333/health

# 重启 Qdrant (Docker)
docker restart <qdrant_container_id>

# 查看 RAG 检索日志
tail -f logs/server.log | grep "RAG"
```

---

## 🎓 最佳实践

### 1. Axure 原型准备建议

✅ **推荐做法**
- 原型结构清晰,页面命名规范
- 交互逻辑完整,流程闭环
- 关键业务规则体现在原型中
- 使用 Axure 标准组件

❌ **避免问题**
- 原型过于粗糙,缺少细节
- 页面命名随意 (page1, page2...)
- 交互关系缺失或混乱
- 大量使用自定义图片

### 2. 测试用例编写规范

**用例命名**
```
✅ 好: 测试用户登录功能-正常流程
✅ 好: 验证商品添加购物车-数量边界
❌ 差: test1
❌ 差: 登录
```

**步骤描述**
```
✅ 好: 在用户名输入框输入 "admin"
✅ 好: 点击"登录"按钮,等待页面跳转
❌ 差: 输入用户名
❌ 差: 登录
```

### 3. RAG 知识库使用建议 🆕

**知识质量优于数量**
```
✅ 推荐: 精心整理的 50 条高质量测试经验
❌ 避免: 批量导入 1000 条质量参差的数据
```

**定期维护知识库**
- 每月审查一次知识库内容
- 更新过时的测试模式
- 删除低相似度的检索结果
- 补充新的业务规则和风险场景

---

## 🤝 贡献指南

我们欢迎所有形式的贡献!

### 贡献流程

1. Fork 项目仓库
2. 创建特性分支: `git checkout -b feature/amazing-feature`
3. 提交代码: `git commit -m 'Add amazing feature'`
4. 推送分支: `git push origin feature/amazing-feature`
5. 创建 Pull Request

### 代码规范

- ✅ 遵循 ESLint 规则
- ✅ 使用 TypeScript 严格模式
- ✅ 编写单元测试
- ✅ 添加必要的注释和文档
- ✅ 保持代码简洁易读

---

## 📄 开源许可

本项目采用 MIT License - 详见 [LICENSE](LICENSE) 文件

---

## 🆘 技术支持

### 获取帮助

- 🐛 **Bug 反馈**: [GitHub Issues](https://github.com/testflow/testflow/issues)

### 文档资源

- [项目结构说明](PROJECT_STRUCTURE.md)
- [字体使用规范](TYPOGRAPHY_GUIDE.md)
- [Claude Code 指南](CLAUDE.md)
- [更新日志](CHANGES.md)

---

## 📸 产品截图

### 登录界面
<!-- 图片路径: docs/screenshots/login.png -->
*现代化的登录设计,支持"记住我"功能,安全的 JWT 认证*

### 测试用例管理
<!-- 图片路径: docs/screenshots/test-cases.png -->
*精美的卡片式设计,智能筛选,系统模块分类管理*

### AI 测试用例生成器 ⭐
<!-- 图片路径: docs/screenshots/ai-generator.png -->
*三步流程: 上传 Axure → 生成需求 → 批量生成测试用例*

### AI 批量修改界面
<!-- 图片路径: docs/screenshots/bulk-update.png -->
*直观的修改对比,美观的提案卡片,风险评估和版本控制*

### 测试执行监控
<!-- 图片路径: docs/screenshots/test-execution.png -->
*实时状态更新,详细执行日志,自动截图保存*

---

## 📝 更新日志

### Version 2.5.0 (Latest) 🆕
**发布日期**: 2025-11-11

**新增功能**:
- ✨ **多 AI 模型支持**: 新增支持 4 种 AI 模型 (GPT-4o, DeepSeek, Claude, Gemini Local)
- 🔄 **前端一键切换**: 在设置页面可随时切换 AI 模型,配置自动同步
- 🏠 **本地模型部署**: 支持本地 Gemini 2.5 Flash API,离线环境可用
- 🌐 **自定义 API 端点**: 支持配置自定义 baseUrl 和认证方式
- 🔧 **CORS 优化**: 智能请求头管理,本地 API 无 CORS 问题

**优化改进**:
- 🚀 AI 模型配置管理架构优化
- 📊 新增 API 端点日志输出
- 🎯 API Key 验证逻辑优化,支持自定义认证格式
- 📝 完善文档和环境变量配置示例

**技术细节**:
- 新增 `ModelDefinition` 接口字段: `customBaseUrl`, `requiresCustomAuth`
- 修改文件: `modelRegistry.ts`, `llmConfigManager.ts`, `settingsService.ts` (前后端)
- CORS 处理: 根据模型类型动态构建请求头

---

## 🌟 致谢

感谢所有为 TestFlow 做出贡献的开发者!

### 特别感谢
- [Anthropic](https://www.anthropic.com) - MCP 协议和 Claude AI
- [OpenAI](https://openai.com) - GPT-4o AI 模型
- [DeepSeek](https://www.deepseek.com) - DeepSeek Chat V3 高性价比模型
- [Google](https://ai.google.dev) - Gemini 2.5 Flash 多模态模型
- [Playwright Team](https://playwright.dev) - 浏览器自动化引擎
- [React Team](https://reactjs.org) - 现代化前端框架
- [Tailwind CSS](https://tailwindcss.com) - 实用优先的 CSS 框架

---

<div align="center">

**TestFlow - 让自动化测试变得简单而强大!** 🚀

Made with ❤️ by TestFlow Team

[⬆ 返回顶部](#-testflow---企业级-ai-驱动的自动化测试平台)

</div>

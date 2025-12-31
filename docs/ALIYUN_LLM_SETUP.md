# 阿里云 LLM 配置指南

本指南介绍如何配置阿里云通义千问作为测试用例生成的 AI 模型。

## 📋 概述

系统使用两个不同的阿里云服务：
1. **阿里云 Embedding API** - 用于知识库向量化
2. **阿里云通义千问 LLM** - 用于生成测试用例、需求文档等

两个服务可以使用**相同的 API Key**。

---

## 🔑 获取 API Key

### 步骤 1: 访问阿里云控制台

访问：https://dashscope.console.aliyun.com/apiKey

### 步骤 2: 创建 API Key

1. 登录阿里云账号
2. 点击 **"创建新的API-KEY"**
3. 复制生成的 Key（格式：`sk-xxxxxxxxxxxxx`）

### 步骤 3: 确认服务开通

确保已开通以下服务：
- ✅ 通义千问（文本生成）
- ✅ 文本向量化（Embedding）

---

## ⚙️ 配置方法

### 方法 1: 使用配置脚本（推荐）

```bash
./setup-aliyun-key.sh
```

脚本会自动配置所有必要的环境变量。

### 方法 2: 手动编辑 .env 文件

打开 `.env` 文件，添加或修改以下配置：

```bash
# ========== AI 模型配置 ==========
# 使用阿里云通义千问
DEFAULT_MODEL=qwen-plus
OPENROUTER_API_KEY=sk-你的阿里云API-Key
OPENROUTER_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
DEFAULT_TEMPERATURE=0.3
DEFAULT_MAX_TOKENS=4000

# ========== RAG 知识库配置 ==========
EMBEDDING_PROVIDER=aliyun
ALIYUN_API_KEY=sk-你的阿里云API-Key
DASHSCOPE_API_KEY=sk-你的阿里云API-Key
```

**注意：** 所有 `sk-你的阿里云API-Key` 可以使用**相同的 Key**。

---

## 🎯 可用模型

系统支持多个阿里云通义千问模型：

| 模型 ID | 模型名称 | 特点 | 推荐场景 |
|---------|---------|------|---------|
| `qwen-turbo` | 通义千问 Turbo | 速度快，成本低 | 简单测试用例生成 |
| `qwen-plus` | 通义千问 Plus | 性能强，推理好 | 复杂需求分析 ⭐ |
| `qwen-max` | 通义千问 Max | 最强性能 | 高难度任务 |

### 切换模型

在 `.env` 文件中修改 `DEFAULT_MODEL`：

```bash
# 使用 Turbo（更快）
DEFAULT_MODEL=qwen-turbo

# 使用 Plus（推荐）
DEFAULT_MODEL=qwen-plus

# 使用 Max（最强）
DEFAULT_MODEL=qwen-max
```

---

## 🔧 验证配置

### 1. 检查环境变量

```bash
node -e "require('dotenv').config(); console.log('Model:', process.env.DEFAULT_MODEL); console.log('API Key:', process.env.OPENROUTER_API_KEY?.substring(0, 15) + '...'); console.log('Base URL:', process.env.OPENROUTER_BASE_URL);"
```

预期输出：
```
Model: qwen-plus
API Key: sk-f14ef5c17b08...
Base URL: https://dashscope.aliyuncs.com/compatible-mode/v1
```

### 2. 重启服务

```bash
# 停止服务
按 Ctrl+C

# 启动服务
npm start
```

### 3. 测试功能

在 UI 中测试以下功能：
- ✅ 从 Axure 原型生成需求文档
- ✅ 生成功能测试用例
- ✅ AI 辅助优化测试用例

---

## 🆚 与其他 LLM 的对比

| 特性 | 阿里云通义千问 | OpenRouter | DeepSeek |
|------|---------------|-----------|----------|
| 国内访问速度 | ⚡ 极快 | 🐌 需要代理 | 🚀 快 |
| 免费额度 | ✅ 充足 | ❌ 需付费 | ✅ 有限 |
| 中文支持 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| 推理能力 | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| 成本 | 💰 低 | 💰💰 中 | 💰 低 |

---

## 🚨 常见问题

### 问题 1: API Key 无效

**错误信息：**
```
InvalidApiKey: Invalid API-key provided
```

**解决方法：**
1. 确认 API Key 是从阿里云控制台复制的
2. 检查 Key 是否以 `sk-` 开头
3. 确认 Key 没有多余的空格或换行符

### 问题 2: 服务未开通

**错误信息：**
```
Service not enabled
```

**解决方法：**
访问 https://dashscope.console.aliyun.com/ 开通以下服务：
- 通义千问（文本生成）
- 文本向量化（Embedding）

### 问题 3: 配置未生效

**解决方法：**
1. 确认修改的是项目根目录的 `.env` 文件
2. 重启服务（`npm start`）
3. 清除浏览器缓存

### 问题 4: 免费额度用完

**解决方法：**
1. 访问阿里云控制台查看用量
2. 开通按量付费（成本很低）
3. 或切换到其他模型（如 DeepSeek）

---

## 📊 费用说明

### 免费额度（新用户）

- 通义千问 Turbo: 100万 tokens/月
- 通义千问 Plus: 100万 tokens/月
- 文本向量化: 100万 tokens/月

### 按量付费（超出免费额度后）

| 服务 | 价格 |
|------|------|
| qwen-turbo | ¥0.0008/1K tokens |
| qwen-plus | ¥0.004/1K tokens |
| qwen-max | ¥0.04/1K tokens |
| Embedding | ¥0.0007/1K tokens |

**示例：** 生成 100 个测试用例（约 50K tokens）：
- 使用 qwen-turbo: ¥0.04
- 使用 qwen-plus: ¥0.20
- 使用 qwen-max: ¥2.00

---

## 🔗 相关文档

- [阿里云通义千问文档](https://help.aliyun.com/zh/dashscope/)
- [API 参考](https://help.aliyun.com/zh/dashscope/developer-reference/api-details)
- [定价说明](https://help.aliyun.com/zh/dashscope/developer-reference/tongyi-qianwen-metering-and-billing)

---

## 📝 总结

配置阿里云 LLM 的步骤：

1. ✅ 获取 API Key
2. ✅ 配置 `.env` 文件
3. ✅ 重启服务
4. ✅ 测试功能

**优势：**
- 🚀 国内访问速度快
- 💰 免费额度充足
- 🇨🇳 中文支持优秀
- 🔧 配置简单

如有问题，请参考 [常见问题](#🚨-常见问题) 或提交 Issue。


# Embedding 服务配置指南

本项目的知识库功能支持多种 Embedding 服务提供商。请根据您的需求选择并配置。

## 📋 支持的服务商

| Provider | 说明 | 向量维度 | 成本 | 推荐度 |
|----------|------|---------|------|--------|
| **Gemini** | Google Gemini (默认) | 768 | 免费 | ⭐⭐⭐⭐⭐ |
| **阿里云** | 阿里云通义千问 | 1024 | 按量付费 | ⭐⭐⭐⭐ |
| **OpenAI** | OpenAI 或兼容 API | 1536 | 按量付费 | ⭐⭐⭐ |

## 🔧 配置方法

### 方式一：使用阿里云（推荐国内用户）

在项目根目录的 `.env` 文件中添加：

```bash
# 选择阿里云作为 Embedding 服务商
EMBEDDING_PROVIDER=aliyun

# 阿里云 API Key（在阿里云 DashScope 控制台获取）
ALIYUN_API_KEY=sk-xxxxxxxxxxxxxxxxxx
# 或者使用
DASHSCOPE_API_KEY=sk-xxxxxxxxxxxxxxxxxx

# 可选：指定模型（默认为 text-embedding-v2）
ALIYUN_EMBEDDING_MODEL=text-embedding-v2
```

**获取阿里云 API Key：**
1. 访问 [阿里云 DashScope](https://dashscope.aliyun.com/)
2. 注册/登录账号
3. 进入 API-KEY 管理页面
4. 创建新的 API Key 并复制

### 方式二：使用 Google Gemini（推荐海外用户）

在项目根目录的 `.env` 文件中添加：

```bash
# 选择 Gemini（或者不设置，默认就是 gemini）
EMBEDDING_PROVIDER=gemini

# Google Gemini API Key（免费）
GEMINI_API_KEY=AIzaxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

**获取 Gemini API Key：**
1. 访问 [Google AI Studio](https://makersuite.google.com/app/apikey)
2. 使用 Google 账号登录
3. 创建 API Key 并复制

### 方式三：使用 OpenAI 或其他兼容 API

在项目根目录的 `.env` 文件中添加：

```bash
# 选择 OpenAI 或其他兼容服务
EMBEDDING_PROVIDER=openai

# API Key
EMBEDDING_API_KEY=sk-xxxxxxxxxxxxxxxxxx

# 可选：自定义 API Base URL
EMBEDDING_API_BASE_URL=https://api.openai.com/v1

# 可选：指定模型
EMBEDDING_MODEL=text-embedding-3-small
```

## 🔍 验证配置

配置完成后，重启服务：

```bash
npm start
```

在控制台中查看初始化日志：

- ✅ 成功示例：`🔗 知识库服务初始化: Qdrant=http://localhost:6333, System=default, Collection=test_cases, Embedding=阿里云通义千问`
- ❌ 失败示例：会提示缺少 API Key 的错误信息

## 💡 常见问题

### Q1: 如何切换 Embedding 服务商？

只需要修改 `.env` 文件中的 `EMBEDDING_PROVIDER` 值，然后重启服务即可。

### Q2: 切换服务商后，之前的知识库数据怎么办？

**注意：** 不同的 Embedding 服务商生成的向量维度不同，切换后需要：
1. 删除旧的 Qdrant 集合
2. 重新导入知识库数据

或者为不同的服务商创建独立的集合。

### Q3: 哪个服务商性能最好？

- **速度：** Gemini ≈ 阿里云 > OpenAI
- **准确度：** 差异不大，取决于具体使用场景
- **成本：** Gemini（免费） > 阿里云 > OpenAI
- **网络：** 国内用户推荐阿里云，海外用户推荐 Gemini

### Q4: 配置后还是报错？

请检查：
1. `.env` 文件是否在项目根目录
2. API Key 是否正确复制（注意不要有空格）
3. 是否已重启服务
4. 网络连接是否正常

## 📚 相关文档

- [阿里云 Embedding 设置详细文档](./docs/ALIYUN_EMBEDDING_SETUP.md)
- [多系统知识库使用指南](./docs/多系统知识库使用指南.md)


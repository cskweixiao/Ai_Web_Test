# 知识库快速开始指南

本指南帮助您快速配置和使用 Ai Web Test 的 AI 知识库功能。

## 📋 前置要求

1. ✅ Docker 已安装并运行
2. ✅ 阿里云 API Key（或 Gemini API Key）

## 🚀 快速开始（3 步）

### 步骤 1: 启动 Qdrant 向量数据库

选择以下任一方式：

**方式 A：使用管理脚本（推荐）**
```bash
./backend/scripts/qdrant-manage.sh start
```

**方式 B：使用 Docker Compose**
```bash
docker-compose up -d qdrant
```

**方式 C：手动启动**
```bash
docker run -d --name qdrant \
  -p 6333:6333 -p 6334:6334 \
  -v $(pwd)/qdrant_storage:/qdrant/storage \
  qdrant/qdrant:latest
```

验证启动成功：
```bash
curl http://localhost:6333/healthz
# 应返回: healthz check passed
```

### 步骤 2: 配置 Embedding 服务

在项目根目录的 `.env` 文件中添加：

```bash
# 选择 Embedding 服务商（推荐阿里云）
EMBEDDING_PROVIDER=aliyun

# 阿里云 API Key
ALIYUN_API_KEY=sk-your-api-key-here

# Qdrant 连接（默认配置，通常不需要修改）
QDRANT_URL=http://localhost:6333
```

**获取阿里云 API Key：**
1. 访问 https://dashscope.aliyun.com/
2. 注册/登录账号
3. 进入 API-KEY 管理
4. 创建并复制 API Key

### 步骤 3: 启动服务

```bash
npm start
```

查看日志确认知识库服务初始化成功：
```
🔗 知识库服务初始化: Qdrant=http://localhost:6333, System=default, Collection=test_cases, Embedding=阿里云通义千问
```

## ✅ 验证功能

### 1. 访问 Qdrant Dashboard
打开浏览器访问：http://localhost:6333/dashboard

### 2. 测试知识库 API
```bash
# 添加知识
curl -X POST http://localhost:3001/api/knowledge \
  -H "Content-Type: application/json" \
  -d '{
    "title": "测试知识",
    "content": "这是一个测试知识条目",
    "category": "测试分类"
  }'

# 搜索知识
curl "http://localhost:3001/api/knowledge/search?query=测试&limit=5"
```

### 3. 在前端使用
1. 登录系统：http://localhost:5173
2. 进入知识库管理页面
3. 添加、搜索知识条目

## 🔧 常用管理命令

```bash
# 查看 Qdrant 状态
./backend/scripts/qdrant-manage.sh status

# 查看 Qdrant 日志
./backend/scripts/qdrant-manage.sh logs

# 重启 Qdrant
./backend/scripts/qdrant-manage.sh restart

# 停止 Qdrant
./backend/scripts/qdrant-manage.sh stop
```

## 🎯 多系统知识库

如果需要为不同系统创建独立的知识库：

```typescript
// 为特定系统创建知识库实例
const systemA_KB = new TestCaseKnowledgeBase('SystemA');
const systemB_KB = new TestCaseKnowledgeBase('SystemB');

// 每个系统有独立的集合：test_cases_SystemA, test_cases_SystemB
```

详见：[多系统知识库使用指南](./多系统知识库使用指南.md)

## 🔄 切换 Embedding 服务商

### 切换到 Google Gemini（免费）
```bash
# .env
EMBEDDING_PROVIDER=gemini
GEMINI_API_KEY=your_gemini_api_key
```

### 切换到 OpenAI
```bash
# .env
EMBEDDING_PROVIDER=openai
EMBEDDING_API_KEY=your_openai_api_key
EMBEDDING_MODEL=text-embedding-3-small
```

**注意：** 切换服务商后，需要重新导入知识库数据，因为不同服务商的向量维度不同。

详见：[Embedding 配置指南](./EMBEDDING_CONFIG_GUIDE.md)

## ❓ 常见问题

### Q1: Qdrant 连接失败？
**错误：** `ECONNREFUSED` 或 `fetch failed`

**解决：**
```bash
# 检查 Qdrant 是否运行
docker ps | grep qdrant

# 如果没运行，启动它
./backend/scripts/qdrant-manage.sh start

# 检查端口是否被占用
lsof -i:6333
```

### Q2: Embedding API 调用失败？
**错误：** `❌ 使用阿里云 Embedding 需要配置 ALIYUN_API_KEY`

**解决：**
1. 检查 `.env` 中的 API Key 是否正确
2. 验证 API Key 是否有效：
```bash
curl -X POST https://dashscope.aliyuncs.com/api/v1/services/embeddings/text-embedding/text-embedding \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"text-embedding-v2","input":{"texts":["测试"]}}'
```

### Q3: 数据存储在哪里？
- Qdrant 数据：`./qdrant_storage/`
- 如果使用 docker-compose：Docker volume `ai_web_test_qdrant_data`

### Q4: 如何清空知识库？
```bash
# 方式 1: 删除数据目录
rm -rf qdrant_storage/

# 方式 2: 使用 Qdrant API
curl -X DELETE http://localhost:6333/collections/test_cases

# 然后重启服务，会自动重建集合
```

## 📚 相关文档

- [阿里云 Embedding 详细设置](./ALIYUN_EMBEDDING_SETUP.md)
- [Embedding 配置指南](./EMBEDDING_CONFIG_GUIDE.md)
- [多系统知识库使用指南](./多系统知识库使用指南.md)
- [知识库 API 文档](./API_KNOWLEDGE_BASE.md)

## 💡 最佳实践

1. **生产环境**
   - 使用持久化存储（Docker volume 或挂载目录）
   - 定期备份 `qdrant_storage` 目录
   - 配置 Qdrant 集群以提高可用性

2. **性能优化**
   - 批量导入知识时使用 `batchAdd` 方法
   - 合理设置搜索结果数量限制
   - 定期清理无用的知识条目

3. **安全建议**
   - 不要将 API Key 提交到版本控制
   - 使用环境变量管理敏感信息
   - 限制 Qdrant 的网络访问（仅本地或内网）

---

🎉 恭喜！您已经成功配置了 AI 知识库功能！

如有问题，请查看：
- 日志文件：`./logs/`
- Qdrant 日志：`docker logs qdrant`
- 应用日志：控制台输出


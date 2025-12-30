#!/bin/bash

echo "🔍 检查 Embedding 配置..."
echo ""

# 检查 .env 文件是否存在
if [ ! -f ".env" ]; then
    echo "❌ .env 文件不存在"
    echo "💡 请从 .env.example 复制创建"
    exit 1
fi

# 检查 EMBEDDING_PROVIDER
provider=$(grep "^EMBEDDING_PROVIDER=" .env | cut -d'=' -f2 | tr -d ' ')
if [ -z "$provider" ]; then
    echo "❌ EMBEDDING_PROVIDER 未配置或被注释"
    echo "💡 请在 .env 中添加：EMBEDDING_PROVIDER=aliyun"
    exit 1
else
    echo "✅ EMBEDDING_PROVIDER=$provider"
fi

# 检查对应的 API Key
if [ "$provider" = "aliyun" ]; then
    aliyun_key=$(grep "^ALIYUN_API_KEY=" .env | cut -d'=' -f2 | tr -d ' ')
    dashscope_key=$(grep "^DASHSCOPE_API_KEY=" .env | cut -d'=' -f2 | tr -d ' ')
    
    if [ -z "$aliyun_key" ] && [ -z "$dashscope_key" ]; then
        echo "❌ 阿里云 API Key 未配置"
        echo "💡 请在 .env 中添加："
        echo "   ALIYUN_API_KEY=sk-your-key"
        exit 1
    fi
    
    if [ "$aliyun_key" = "your_aliyun_api_key_here" ] || [ "$dashscope_key" = "your_dashscope_api_key_here" ]; then
        echo "⚠️  API Key 是占位符，需要替换为真实的 Key"
        echo "💡 请访问：https://dashscope.console.aliyun.com/apiKey"
        exit 1
    fi
    
    if [ -n "$aliyun_key" ]; then
        echo "✅ ALIYUN_API_KEY 已配置 (${aliyun_key:0:10}...)"
    fi
    if [ -n "$dashscope_key" ]; then
        echo "✅ DASHSCOPE_API_KEY 已配置 (${dashscope_key:0:10}...)"
    fi
    
elif [ "$provider" = "gemini" ]; then
    gemini_key=$(grep "^GEMINI_API_KEY=" .env | cut -d'=' -f2 | tr -d ' ')
    
    if [ -z "$gemini_key" ]; then
        echo "❌ GEMINI_API_KEY 未配置"
        echo "💡 请在 .env 中添加：GEMINI_API_KEY=your-key"
        exit 1
    fi
    
    echo "✅ GEMINI_API_KEY 已配置 (${gemini_key:0:10}...)"
    
elif [ "$provider" = "openai" ]; then
    openai_key=$(grep "^EMBEDDING_API_KEY=" .env | cut -d'=' -f2 | tr -d ' ')
    
    if [ -z "$openai_key" ]; then
        echo "❌ EMBEDDING_API_KEY 未配置"
        echo "💡 请在 .env 中添加：EMBEDDING_API_KEY=your-key"
        exit 1
    fi
    
    echo "✅ EMBEDDING_API_KEY 已配置 (${openai_key:0:10}...)"
fi

# 检查 Qdrant
echo ""
echo "🔍 检查 Qdrant 状态..."
if curl -s http://localhost:6333/healthz > /dev/null 2>&1; then
    echo "✅ Qdrant 运行正常"
else
    echo "❌ Qdrant 未运行"
    echo "💡 运行：./backend/scripts/qdrant-manage.sh start"
    exit 1
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ 配置检查完成！"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "现在可以启动服务了："
echo "  npm start"
echo ""
echo "启动后应该看到："
echo "  🔗 知识库服务初始化: ... Embedding=$provider"
echo ""


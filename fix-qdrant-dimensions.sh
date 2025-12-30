#!/bin/bash

# 修复 Qdrant 向量维度不匹配问题
# 删除所有使用旧维度 (768) 的 collection，让系统自动重新创建 (1024)

set -e

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔧 修复 Qdrant 向量维度不匹配问题"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

QDRANT_URL="${QDRANT_URL:-http://localhost:6333}"

# 检查 Qdrant 是否运行
if ! curl -s "$QDRANT_URL/collections" > /dev/null 2>&1; then
    echo "❌ 错误: 无法连接到 Qdrant ($QDRANT_URL)"
    echo "💡 请先启动 Qdrant: docker start qdrant"
    exit 1
fi

echo "✅ Qdrant 连接成功"
echo ""

# 获取所有 test_knowledge collections
collections=$(curl -s "$QDRANT_URL/collections" | jq -r '.result.collections[] | select(.name | contains("test_knowledge")) | .name')

if [ -z "$collections" ]; then
    echo "ℹ️  没有找到 test_knowledge collections"
    exit 0
fi

echo "📋 找到以下 collections:"
echo "$collections" | while read collection; do
    echo "  - $collection"
done
echo ""

# 检查每个 collection 的向量维度
echo "🔍 检查向量维度..."
echo ""

collections_to_delete=""
while IFS= read -r collection; do
    if [ -z "$collection" ]; then
        continue
    fi
    
    # URL 编码
    encoded_collection=$(echo "$collection" | jq -sRr @uri)
    vector_size=$(curl -s "$QDRANT_URL/collections/$encoded_collection" | jq -r '.result.config.params.vectors.size')
    
    echo "  $collection: ${vector_size} 维"
    
    if [ "$vector_size" = "768" ]; then
        echo "    ⚠️  维度不匹配 (期望 1024)，需要删除"
        collections_to_delete="$collections_to_delete$collection"$'\n'
    elif [ "$vector_size" = "1024" ]; then
        echo "    ✅ 维度正确"
    else
        echo "    ⚠️  未知维度"
    fi
done <<< "$collections"

echo ""

if [ -z "$collections_to_delete" ]; then
    echo "✅ 所有 collections 维度正确，无需修复"
    exit 0
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "⚠️  警告: 将删除以下 collections (旧数据将丢失)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "$collections_to_delete"
echo ""
read -p "确认删除? (y/N): " confirm

if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
    echo "取消操作"
    exit 0
fi

echo ""
echo "🗑️  删除旧 collections..."
echo ""

while IFS= read -r collection; do
    if [ -z "$collection" ]; then
        continue
    fi
    
    # URL 编码
    encoded_collection=$(echo "$collection" | jq -sRr @uri)
    
    echo "  删除: $collection"
    result=$(curl -s -X DELETE "$QDRANT_URL/collections/$encoded_collection")
    
    if echo "$result" | jq -e '.result == true' > /dev/null 2>&1; then
        echo "    ✅ 删除成功"
    else
        echo "    ❌ 删除失败: $result"
    fi
done <<< "$collections_to_delete"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ 修复完成！"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📝 下一步:"
echo "  1. 系统会在下次添加知识时自动创建新 collection (1024 维)"
echo "  2. 重新添加知识数据"
echo ""
echo "💡 提示: 可以使用以下命令批量初始化所有系统的 collection:"
echo "  npm run knowledge:init"
echo ""


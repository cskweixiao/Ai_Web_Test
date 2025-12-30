#!/bin/bash

# 阿里云 API Key 配置脚本
# 用法: ./setup-aliyun-key.sh

set -e

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔑 阿里云 API Key 配置向导"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 检查 .env 文件是否存在
if [ ! -f ".env" ]; then
    echo "❌ 错误: .env 文件不存在"
    echo "💡 请先运行: cp .env.example .env"
    exit 1
fi

# 显示当前配置
echo "📍 当前配置:"
echo ""
grep "ALIYUN_API_KEY" .env || echo "  未找到 ALIYUN_API_KEY 配置"
echo ""

# 检查是否是占位符
current_key=$(grep "^ALIYUN_API_KEY=" .env | cut -d'=' -f2)
if [ "$current_key" = "your_aliyun_api_key_here" ] || [ -z "$current_key" ]; then
    echo "⚠️  当前使用的是占位符，需要配置真实的 API Key"
else
    echo "✅ 已配置 API Key: ${current_key:0:15}..."
    echo ""
    read -p "是否要更新 API Key? (y/N): " update_choice
    if [ "$update_choice" != "y" ] && [ "$update_choice" != "Y" ]; then
        echo "取消操作"
        exit 0
    fi
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📝 获取 API Key 步骤:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "1. 访问: https://dashscope.console.aliyun.com/apiKey"
echo "2. 登录阿里云账号"
echo "3. 点击 '创建新的API-KEY'"
echo "4. 复制生成的 Key (格式: sk-xxxxxxxxxxxxx)"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 提示用户输入
read -p "请输入您的阿里云 API Key (sk-开头): " api_key

# 验证输入
if [ -z "$api_key" ]; then
    echo "❌ 错误: API Key 不能为空"
    exit 1
fi

if [[ ! "$api_key" =~ ^sk- ]]; then
    echo "⚠️  警告: API Key 通常以 'sk-' 开头，您输入的 Key 可能不正确"
    read -p "是否继续? (y/N): " continue_choice
    if [ "$continue_choice" != "y" ] && [ "$continue_choice" != "Y" ]; then
        echo "取消操作"
        exit 0
    fi
fi

# 备份 .env 文件
cp .env .env.backup
echo "✅ 已备份 .env 文件到 .env.backup"

# 更新 .env 文件
if grep -q "^ALIYUN_API_KEY=" .env; then
    # 替换现有配置
    sed -i '' "s|^ALIYUN_API_KEY=.*|ALIYUN_API_KEY=$api_key|" .env
    echo "✅ 已更新 ALIYUN_API_KEY"
else
    # 添加新配置
    echo "" >> .env
    echo "# 阿里云 API Key" >> .env
    echo "ALIYUN_API_KEY=$api_key" >> .env
    echo "✅ 已添加 ALIYUN_API_KEY"
fi

# 同时更新 DASHSCOPE_API_KEY (如果存在)
if grep -q "^DASHSCOPE_API_KEY=" .env; then
    sed -i '' "s|^DASHSCOPE_API_KEY=.*|DASHSCOPE_API_KEY=$api_key|" .env
    echo "✅ 已同步更新 DASHSCOPE_API_KEY"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ 配置完成！"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📋 新配置:"
echo "  ALIYUN_API_KEY=${api_key:0:15}...${api_key: -5}"
echo ""
echo "⚠️  重要: 请重启服务以应用新配置"
echo ""
echo "  1. 按 Ctrl+C 停止当前服务"
echo "  2. 运行: npm start"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""


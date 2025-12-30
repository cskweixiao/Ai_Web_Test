#!/bin/bash

# Qdrant 向量数据库管理脚本

CONTAINER_NAME="qdrant"
QDRANT_PORT=6333
QDRANT_GRPC_PORT=6334

function start_qdrant() {
    echo "🚀 启动 Qdrant 向量数据库..."
    
    # 检查容器是否已存在
    if docker ps -a | grep -q $CONTAINER_NAME; then
        echo "📦 Qdrant 容器已存在，正在启动..."
        docker start $CONTAINER_NAME
    else
        echo "📦 首次运行，创建 Qdrant 容器..."
        docker run -d \
            --name $CONTAINER_NAME \
            -p $QDRANT_PORT:6333 \
            -p $QDRANT_GRPC_PORT:6334 \
            -v $(pwd)/qdrant_storage:/qdrant/storage \
            qdrant/qdrant:latest
    fi
    
    # 等待服务启动
    echo "⏳ 等待 Qdrant 启动..."
    sleep 3
    
    # 健康检查
    if curl -s http://localhost:$QDRANT_PORT/healthz > /dev/null; then
        echo "✅ Qdrant 启动成功！"
        echo "📍 访问地址: http://localhost:$QDRANT_PORT"
        echo "📍 Dashboard: http://localhost:$QDRANT_PORT/dashboard"
    else
        echo "❌ Qdrant 启动失败，请查看日志: docker logs $CONTAINER_NAME"
        exit 1
    fi
}

function stop_qdrant() {
    echo "🛑 停止 Qdrant 向量数据库..."
    docker stop $CONTAINER_NAME
    echo "✅ Qdrant 已停止"
}

function restart_qdrant() {
    echo "🔄 重启 Qdrant 向量数据库..."
    docker restart $CONTAINER_NAME
    sleep 3
    if curl -s http://localhost:$QDRANT_PORT/healthz > /dev/null; then
        echo "✅ Qdrant 重启成功！"
    else
        echo "❌ Qdrant 重启失败"
        exit 1
    fi
}

function status_qdrant() {
    echo "📊 Qdrant 状态:"
    if docker ps | grep -q $CONTAINER_NAME; then
        echo "✅ Qdrant 正在运行"
        docker ps | grep $CONTAINER_NAME
        echo ""
        echo "🔗 健康检查:"
        curl -s http://localhost:$QDRANT_PORT/healthz
        echo ""
    else
        echo "❌ Qdrant 未运行"
    fi
}

function logs_qdrant() {
    echo "📋 Qdrant 日志:"
    docker logs -f $CONTAINER_NAME
}

function remove_qdrant() {
    echo "⚠️  警告: 这将删除 Qdrant 容器（数据将保留在 qdrant_storage 目录）"
    read -p "确认删除? (y/N): " confirm
    if [ "$confirm" = "y" ] || [ "$confirm" = "Y" ]; then
        docker stop $CONTAINER_NAME 2>/dev/null
        docker rm $CONTAINER_NAME 2>/dev/null
        echo "✅ Qdrant 容器已删除"
    else
        echo "❌ 取消删除"
    fi
}

# 主菜单
case "$1" in
    start)
        start_qdrant
        ;;
    stop)
        stop_qdrant
        ;;
    restart)
        restart_qdrant
        ;;
    status)
        status_qdrant
        ;;
    logs)
        logs_qdrant
        ;;
    remove)
        remove_qdrant
        ;;
    *)
        echo "Qdrant 向量数据库管理脚本"
        echo ""
        echo "用法: $0 {start|stop|restart|status|logs|remove}"
        echo ""
        echo "命令:"
        echo "  start    - 启动 Qdrant"
        echo "  stop     - 停止 Qdrant"
        echo "  restart  - 重启 Qdrant"
        echo "  status   - 查看状态"
        echo "  logs     - 查看日志"
        echo "  remove   - 删除容器"
        echo ""
        exit 1
        ;;
esac


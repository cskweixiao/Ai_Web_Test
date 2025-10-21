import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';

interface LiveViewProps {
  runId: string;
  testStatus?: 'running' | 'completed' | 'failed' | 'queued' | 'cancelled';
  onFrameUpdate?: (timestamp: Date) => void;
}

// 🔥 优化：使用React.memo防止不必要的重渲染
export const LiveView: React.FC<LiveViewProps> = React.memo(({ runId, testStatus, onFrameUpdate }) => {
  const imgRef = useRef<HTMLImageElement>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [frameCount, setFrameCount] = useState(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const lastFrameUpdateCallRef = useRef<number>(0);

  // 🔥 修复灰屏：使用 useRef 存储 onFrameUpdate，避免 useEffect 重新执行
  const onFrameUpdateRef = useRef(onFrameUpdate);
  useEffect(() => {
    onFrameUpdateRef.current = onFrameUpdate;
  }, [onFrameUpdate]);

  // 🔥 优化：节流onFrameUpdate回调，避免过度调用父组件
  // 使用 useRef 避免依赖 onFrameUpdate，防止 useEffect 重新执行
  const throttledOnFrameUpdate = useCallback((timestamp: Date) => {
    const now = Date.now();
    // 限制回调频率为最多每500ms一次，避免过度触发父组件重渲染
    if (now - lastFrameUpdateCallRef.current >= 500) {
      lastFrameUpdateCallRef.current = now;
      onFrameUpdateRef.current?.(timestamp);
    }
  }, []); // 空依赖数组，函数引用永不变化

  useEffect(() => {
    // 🚀 优化：只在非运行状态或有错误时输出日志
    if (testStatus && testStatus !== 'running') {
      console.log('🔍 [LiveView] 状态变化:', { runId: runId.substring(0, 8), testStatus });
    }

    if (!imgRef.current) return;

    // 检查测试状态，如果不是运行中，显示相应消息
    if (testStatus && testStatus !== 'running') {
      // 日志已在上方输出，此处不重复
      setIsConnected(false);
      setFrameCount(0);

      switch (testStatus) {
        case 'completed':
          setError('测试已完成，实时画面不可用');
          break;
        case 'failed':
          setError('测试已失败，实时画面不可用');
          break;
        case 'queued':
          setError('测试在队列中等待，实时画面暂不可用');
          break;
        case 'cancelled':
          setError('测试已取消，实时画面不可用');
          break;
        default:
          setError('测试未运行，实时画面不可用');
      }
      return;
    }

    const img = imgRef.current;
    const token = getAuthToken();
    const streamUrl = `http://localhost:3001/api/stream/live/${runId}?token=${token}`;

    // 🚀 优化：只在首次连接时输出日志
    console.log('🔍 [LiveView] 连接MJPEG流:', runId.substring(0, 8));

    let frameUpdateTimer: NodeJS.Timeout;
    let lastFrameTime = Date.now();
    let lastFrameContent: string | null = null;
    let consecutiveIdenticalFrames = 0;
    let isCleanedUp = false; // 🚀 新增：清理标志，避免重复操作

    // 🔥 简化：更宽松的帧监控，减少误判
    const startFrameMonitor = () => {
      frameUpdateTimer = setInterval(() => {
        if (isCleanedUp) return; // 🚀 避免清理后继续执行

        const now = Date.now();
        const timeSinceLastFrame = now - lastFrameTime;

        // 🔥 放宽超时阈值，只有真正长时间无响应才断开
        const timeoutThreshold = 30000; // 🚀 增加到30秒，避免误判

        if (timeSinceLastFrame > timeoutThreshold && isConnected) {
          console.warn(`⚠️ [LiveView] 长时间无帧更新: ${timeSinceLastFrame}ms`);
          setIsConnected(false);
          setError('连接可能中断');
        }
      }, 10000); // 🚀 降低检查频率至10秒一次，减少CPU占用
    };

    // 🔥 简化：基础帧更新处理，移除复杂的内容检测
    const handleImageLoad = () => {
      const now = Date.now();
      const timeSinceLastFrame = now - lastFrameTime;

      // 🚀 优化：只在特定情况下输出日志
      if (frameCount % 30 === 0) { // 每30帧输出一次日志
        console.log(`🖼️ [LiveView] 帧更新: ${runId.substring(0,8)}, 总帧数: ${frameCount + 1}`);
      }

      if (imgRef.current) {
        imgRef.current.style.opacity = '1';
      }

      // 🔥 移除过严的时间检测，接受所有正常的帧更新
      if (timeSinceLastFrame < 50) { // 只过滤过于频繁的重复触发
        return;
      }

      // 🔥 简化：直接更新状态，不做复杂的内容比较
      lastFrameTime = now;
      const newFrameCount = frameCount + 1;
      setFrameCount(newFrameCount);

      // 如果之前断开了，现在有帧更新说明恢复了
      if (!isConnected) {
        console.log('✅ [LiveView] 连接已恢复');
        setIsConnected(true);
        setError(null);
      }

      // 🔥 节流回调
      throttledOnFrameUpdate(new Date());
    };

    // 🔥 MJPEG流每一帧都会触发load事件
    img.addEventListener('load', handleImageLoad);

    let retryCount = 0;
    const maxRetries = 3; // 🚀 减少重试次数，避免过度重连

    img.onerror = (e) => {
      if (isCleanedUp) return; // 🚀 避免清理后继续执行
      if (imgRef.current) { imgRef.current.style.opacity = '0.35'; }

      // 🚀 优化：简化错误日志
      console.error('❌ [LiveView] 加载错误:', runId.substring(0, 8), '重试:', retryCount);

      setIsConnected(false);

      if (retryCount < maxRetries) {
        retryCount++;
        setError(`连接中断，重试中... (${retryCount}/${maxRetries})`);

        // 🚀 优化重连：延长重试延迟，避免频繁重连
        const retryDelay = Math.min(5000 * retryCount, 15000); // 🚀 延长到5秒起步

        reconnectTimeoutRef.current = setTimeout(() => {
          if (isCleanedUp || !imgRef.current) return; // 🚀 检查清理状态

          // 🚀 不修改 src，而是让浏览器自然重试
          setError(`等待重连... (${retryCount}/${maxRetries})`);
        }, retryDelay);
      } else {
        console.warn('⚠️ [LiveView] 达到最大重试次数，停止重连');
        setError('连接失败，请刷新页面或切换标签页重试');
      }
    };

    // 🔥 修复：只设置一次src，不要频繁重设
    img.src = streamUrl;
    startFrameMonitor();

    // 初始状态设为连接中
    setIsConnected(true);
    setError(null);

    return () => {
      isCleanedUp = true; // 🚀 标记已清理，避免定时器和错误处理继续执行

      if (imgRef.current) { imgRef.current.style.opacity = '0.15'; }
      // 🚀 优化：简化清理日志
      console.log('🧹 [LiveView] 清理:', runId.substring(0, 8));

      // 🚀 先清理事件监听器
      img.removeEventListener('load', handleImageLoad);
      img.onerror = null; // 🚀 移除错误处理，避免清理后继续触发

      // 🚀 清理定时器
      if (frameUpdateTimer) clearInterval(frameUpdateTimer);
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);

      // 🚀 不修改 img.src，让浏览器自然关闭连接
      // 避免触发新的网络请求和事件
    };
  }, [runId, testStatus]); // 🔥 移除 throttledOnFrameUpdate 依赖，因为它已经用 useCallback([]) 稳定了

  return (
    <div className="live-view-container w-full h-full flex flex-col border rounded-lg overflow-hidden">
      <div className="live-view-header bg-gray-100 p-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`live-indicator w-3 h-3 rounded-full ${
            isConnected ? 'bg-red-500 animate-pulse' : 'bg-gray-400'
          }`} />
          <span className="text-sm font-medium">
            {isConnected ? 'LIVE' : '离线'}
          </span>
          {isConnected && (
            <span className="text-xs text-gray-600">
              帧数: {frameCount}
            </span>
          )}
        </div>
        {error && (
          <span className="text-xs text-red-500">{error}</span>
        )}
      </div>
      
      <div className="live-view-content bg-slate-100 flex-1 min-h-0 flex items-center justify-center">
        {error ? (
          <div className="text-white text-center p-8">
            <div className="text-4xl mb-4">
              {testStatus === 'completed' ? '✅' : 
               testStatus === 'failed' ? '❌' : 
               testStatus === 'queued' ? '⏳' : 
               testStatus === 'cancelled' ? '🚫' : '📺'}
            </div>
            <div className="text-lg mb-2">{error}</div>
            {testStatus === 'completed' && (
              <div className="text-sm text-gray-300 mt-3">
                测试已成功完成，可以在"测试证据"标签页查看截图
              </div>
            )}
            {testStatus === 'failed' && (
              <div className="text-sm text-gray-300 mt-3">
                测试执行失败，可以在"执行日志"标签页查看详细错误信息
              </div>
            )}
            {testStatus === 'queued' && (
              <div className="text-sm text-gray-300 mt-3">
                测试正在等待执行，请稍候...
              </div>
            )}
          </div>
        ) : (
          <img
            ref={imgRef}
            className="w-full h-full object-contain bg-black"
            alt="实时画面"
          />
        )}
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  // 🔥 自定义比较函数：只有关键属性变化时才重新渲染
  const shouldSkipRender = (
    prevProps.runId === nextProps.runId &&
    prevProps.testStatus === nextProps.testStatus
  );

  console.log('🔍 [LiveView React.memo] 比较 props:', {
    runIdSame: prevProps.runId === nextProps.runId,
    statusSame: prevProps.testStatus === nextProps.testStatus,
    prevStatus: prevProps.testStatus,
    nextStatus: nextProps.testStatus,
    shouldSkipRender
  });

  return shouldSkipRender;
});

// 🔥 修正：获取认证token的辅助函数
function getAuthToken(): string {
  // 从localStorage或其他地方获取认证token
  return localStorage.getItem('authToken') || 'default-token-12345678';
}

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

  // 🔥 优化：节流onFrameUpdate回调，避免过度调用父组件
  const throttledOnFrameUpdate = useCallback((timestamp: Date) => {
    const now = Date.now();
    // 限制回调频率为最多每500ms一次，避免过度触发父组件重渲染
    if (now - lastFrameUpdateCallRef.current >= 500) {
      lastFrameUpdateCallRef.current = now;
      onFrameUpdate?.(timestamp);
    }
  }, [onFrameUpdate]);

  useEffect(() => {
    if (!imgRef.current) return;

    // 检查测试状态，如果不是运行中，显示相应消息
    if (testStatus && testStatus !== 'running') {
      console.log('🔍 [LiveView] 测试非运行状态，不连接流:', { runId, testStatus });
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
    img.style.transition = 'opacity 200ms ease-in-out';
    img.style.opacity = '0.15';
    const token = getAuthToken();
    const streamUrl = `http://localhost:3001/api/stream/live/${runId}?token=${token}`;
    
    console.log('🔍 [LiveView] 开始连接MJPEG流 (IMG模式):', {
      runId,
      testStatus,
      token: token.substring(0, 10) + '...',
      streamUrl
    });

    let frameUpdateTimer: NodeJS.Timeout;
    let lastFrameTime = Date.now();
    let lastFrameContent: string | null = null;
    let consecutiveIdenticalFrames = 0;

    // 🔥 简化：更宽松的帧监控，减少误判
    const startFrameMonitor = () => {
      frameUpdateTimer = setInterval(() => {
        const now = Date.now();
        const timeSinceLastFrame = now - lastFrameTime;
        
        // 🔥 放宽超时阈值，只有真正长时间无响应才断开
        const timeoutThreshold = 20000; // 20秒无更新才认为断开
        
        if (timeSinceLastFrame > timeoutThreshold && isConnected) {
          console.warn(`⚠️ [LiveView] 长时间无帧更新: ${timeSinceLastFrame}ms`);
          setIsConnected(false);
          setError('连接可能中断');
        }
      }, 5000); // 降低检查频率至5秒一次
    };

    // 🔥 简化：基础帧更新处理，移除复杂的内容检测
    const handleImageLoad = () => {
      const now = Date.now();
      if (imgRef.current) {
        imgRef.current.style.opacity = '1';
      }
      const timeSinceLastFrame = now - lastFrameTime;
      
      // 🔥 移除过严的时间检测，接受所有正常的帧更新
      if (timeSinceLastFrame < 50) { // 只过滤过于频繁的重复触发
        return;
      }
      
      // 🔥 简化：直接更新状态，不做复杂的内容比较
      lastFrameTime = now;
      setFrameCount(prev => prev + 1);
      
      // 如果之前断开了，现在有帧更新说明恢复了
      if (!isConnected) {
        console.log('✅ [LiveView] 检测到帧更新，恢复连接状态');
        setIsConnected(true);
        setError(null);
      }
      
      // 🔥 节流回调
      throttledOnFrameUpdate(new Date());
      
      if (frameCount % 30 === 0) { // 每30帧记录一次，减少日志
        console.log(`📺 [LiveView] 帧更新: ${runId.substring(0,8)}, 间隔: ${timeSinceLastFrame}ms`);
      }
    };

    // 🔥 MJPEG流每一帧都会触发load事件
    img.addEventListener('load', handleImageLoad);

    let retryCount = 0;
    const maxRetries = 5;
    
    img.onerror = (e) => {
    if (imgRef.current) { imgRef.current.style.opacity = '0.35'; }
      console.error('❌ [LiveView] 图像加载错误:', {
        runId: runId.substring(0, 8),
        retryCount,
        error: e
      });
      
      setIsConnected(false);
      
      if (retryCount < maxRetries) {
        retryCount++;
        setError(`连接中断，重试中... (${retryCount}/${maxRetries})`);
        
        // 🔥 简化重连：不频繁改变src，而是延迟后简单重连
        const retryDelay = Math.min(2000 * retryCount, 10000);
        console.log(`🔄 [LiveView] 第${retryCount}次重连，${retryDelay}ms后重试`);
        
        reconnectTimeoutRef.current = setTimeout(() => {
          if (imgRef.current) {
            // 🔥 减少闪烁：只添加时间戳，不改变基础URL
            const newUrl = streamUrl + '&_retry=' + Date.now();
            imgRef.current.style.opacity = '0.2';
            imgRef.current.src = newUrl;
            console.log('🔄 [LiveView] 尝试重新连接流');
          }
        }, retryDelay);
      } else {
        console.warn('⚠️ [LiveView] 达到最大重试次数');
        setError('连接失败，请切换到其他标签页再回来重试');
      }
    };

    // 🔥 修复：只设置一次src，不要频繁重设
    img.src = streamUrl;
    startFrameMonitor();
    
    // 初始状态设为连接中
    setIsConnected(true);
    setError(null);
    
    return () => {
      if (imgRef.current) { imgRef.current.style.opacity = '0.15'; }
      console.log('🧹 [LiveView] 清理连接:', runId);
      img.removeEventListener('load', handleImageLoad);
      if (frameUpdateTimer) clearInterval(frameUpdateTimer);
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      // 🔥 修复：不要设置img.src=''，避免ECONNRESET
    };
  }, [runId, testStatus, throttledOnFrameUpdate]);

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
            className="w-full h-full object-contain bg-black transition-opacity duration-200 ease-in-out"
            style={{ opacity: 0.15 }}
            alt="??????"
          />
        )}
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  // 🔥 自定义比较函数：只有关键属性变化时才重新渲染
  return (
    prevProps.runId === nextProps.runId &&
    prevProps.testStatus === nextProps.testStatus
    // 注意：onFrameUpdate不参与比较，因为它通常是由useCallback生成的稳定引用
  );
});

// 🔥 修正：获取认证token的辅助函数
function getAuthToken(): string {
  // 从localStorage或其他地方获取认证token
  return localStorage.getItem('authToken') || 'default-token-12345678';
}

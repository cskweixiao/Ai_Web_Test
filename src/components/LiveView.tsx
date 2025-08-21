import React, { useEffect, useRef, useState } from 'react';

interface LiveViewProps {
  runId: string;
  testStatus?: 'running' | 'completed' | 'failed' | 'queued' | 'cancelled';
  onFrameUpdate?: (timestamp: Date) => void;
}

export const LiveView: React.FC<LiveViewProps> = ({ runId, testStatus, onFrameUpdate }) => {
  const imgRef = useRef<HTMLImageElement>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [frameCount, setFrameCount] = useState(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();

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

    // 🔥 修复：不依赖onload判定在线状态，用帧更新计时器
    const startFrameMonitor = () => {
      frameUpdateTimer = setInterval(() => {
        const now = Date.now();
        if (now - lastFrameTime > 5000) { // 5秒无帧更新认为离线
          console.warn('⚠️ [LiveView] 长时间无帧更新，可能离线');
          setIsConnected(false);
          setError('流可能已断开');
        }
      }, 2000);
    };

    // 🔥 修复MJPEG流检测：监听load事件而不是src变化
    const handleImageLoad = () => {
      lastFrameTime = Date.now();
      if (!isConnected) {
        console.log('✅ [LiveView] 检测到MJPEG帧更新，恢复在线状态');
        setIsConnected(true);
        setError(null);
      }
      setFrameCount(prev => prev + 1);
      onFrameUpdate?.(new Date());
    };

    // 🔥 MJPEG流每一帧都会触发load事件
    img.addEventListener('load', handleImageLoad);

    img.onerror = (e) => {
      console.error('❌ [LiveView] 图像加载错误:', {
        runId,
        error: e,
        currentSrc: img.src
      });
      
      setIsConnected(false);
      setError('连接中断，正在重连...');
      
      // 🔥 修复：更智能的重连策略
      const maxRetries = 10;
      const currentRetries = frameCount % maxRetries;
      
      if (currentRetries < maxRetries) {
        const retryDelay = Math.min(1000 * Math.pow(1.5, currentRetries), 8000);
        console.log(`🔄 [LiveView] 第${currentRetries + 1}次重连，${retryDelay}ms后重试`);
        
        reconnectTimeoutRef.current = setTimeout(() => {
          console.log('🔄 [LiveView] 正在重新连接...');
          // 🔥 修复：添加时间戳和重试计数避免缓存
          img.src = streamUrl + '&t=' + Date.now() + '&retry=' + currentRetries;
        }, retryDelay);
      } else {
        console.warn('⚠️ [LiveView] 达到最大重试次数，停止重连');
        setError('连接失败，请刷新页面重试');
      }
    };

    // 🔥 修复：只设置一次src，不要频繁重设
    img.src = streamUrl;
    startFrameMonitor();
    
    // 初始状态设为连接中
    setIsConnected(true);
    setError(null);
    
    return () => {
      console.log('🧹 [LiveView] 清理连接:', runId);
      img.removeEventListener('load', handleImageLoad);
      if (frameUpdateTimer) clearInterval(frameUpdateTimer);
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      // 🔥 修复：不要设置img.src=''，避免ECONNRESET
    };
  }, [runId, testStatus]);

  return (
    <div className="live-view-container border rounded-lg overflow-hidden">
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
      
      <div className="live-view-content bg-black flex items-center justify-center">
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
            className="max-w-full max-h-full object-contain"
            alt="实时测试画面"
            style={{ minHeight: '300px' }}
          />
        )}
      </div>
    </div>
  );
};

// 🔥 修正：获取认证token的辅助函数
function getAuthToken(): string {
  // 从localStorage或其他地方获取认证token
  return localStorage.getItem('authToken') || 'default-token-12345678';
}
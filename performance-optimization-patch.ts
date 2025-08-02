// 🚀 性能优化补丁 - 智能延迟系统

export class SmartDelayManager {
  private lastOperationTime: number = 0;
  private operationHistory: Array<{ action: string; timestamp: number; success: boolean }> = [];

  /**
   * 智能延迟 - 根据操作类型和历史成功率动态调整
   */
  async smartDelay(action: string, context: 'before' | 'after' = 'after'): Promise<void> {
    const now = Date.now();
    const timeSinceLastOp = now - this.lastOperationTime;
    
    // 基础延迟配置（大幅减少）
    const baseDelays = {
      navigate: { before: 0, after: 1500 },      // 导航仍需较长等待
      click: { before: 0, after: 300 },          // 点击大幅减少
      fill: { before: 0, after: 200 },           // 输入几乎无延迟
      type: { before: 0, after: 200 },
      wait: { before: 0, after: 100 },
      default: { before: 0, after: 500 }
    };

    const actionKey = action.replace('browser_', '');
    const delayConfig = baseDelays[actionKey] || baseDelays.default;
    let targetDelay = delayConfig[context];

    // 🔥 智能优化：如果上次操作刚完成，减少延迟
    if (timeSinceLastOp < 1000) {
      targetDelay = Math.max(targetDelay * 0.5, 100); // 减半但不少于100ms
    }

    // 🔥 成功率优化：根据历史成功率调整
    const recentHistory = this.operationHistory.slice(-5);
    const successRate = recentHistory.length > 0 
      ? recentHistory.filter(h => h.success).length / recentHistory.length 
      : 1;

    if (successRate > 0.8) {
      targetDelay *= 0.7; // 成功率高时减少延迟
    } else if (successRate < 0.5) {
      targetDelay *= 1.5; // 成功率低时增加延迟
    }

    // 最小延迟保护
    targetDelay = Math.max(targetDelay, 50);

    if (targetDelay > 50) {
      await new Promise(resolve => setTimeout(resolve, targetDelay));
    }

    this.lastOperationTime = Date.now();
  }

  /**
   * 记录操作结果，用于智能调整
   */
  recordOperation(action: string, success: boolean): void {
    this.operationHistory.push({
      action,
      timestamp: Date.now(),
      success
    });

    // 保持历史记录在合理范围内
    if (this.operationHistory.length > 20) {
      this.operationHistory = this.operationHistory.slice(-15);
    }
  }
}

// 🚀 快照缓存管理器
export class SnapshotCacheManager {
  private cache: Map<string, { snapshot: any; timestamp: number }> = new Map();
  private readonly CACHE_TTL = 2000; // 2秒缓存时间

  /**
   * 获取缓存的快照或获取新快照
   */
  async getCachedSnapshot(mcpClient: any, forceRefresh: boolean = false): Promise<any> {
    const cacheKey = 'current';
    const cached = this.cache.get(cacheKey);
    const now = Date.now();

    // 如果有有效缓存且不强制刷新，返回缓存
    if (!forceRefresh && cached && (now - cached.timestamp) < this.CACHE_TTL) {
      console.log('📸 使用缓存快照');
      return cached.snapshot;
    }

    // 获取新快照
    console.log('📸 获取新快照');
    const snapshot = await mcpClient.getSnapshot();
    this.cache.set(cacheKey, { snapshot, timestamp: now });
    
    return snapshot;
  }

  /**
   * 清除缓存
   */
  clearCache(): void {
    this.cache.clear();
  }
}

// 🚀 AI解析批处理管理器
export class AIBatchProcessor {
  private pendingRequests: Array<{
    steps: string;
    resolve: (result: any) => void;
    reject: (error: any) => void;
  }> = [];
  private processingTimer: NodeJS.Timeout | null = null;

  /**
   * 批量处理AI解析请求
   */
  async batchParseSteps(steps: string, aiParser: any, snapshot: any, runId: string): Promise<any> {
    return new Promise((resolve, reject) => {
      this.pendingRequests.push({ steps, resolve, reject });

      // 如果没有正在处理的定时器，启动一个
      if (!this.processingTimer) {
        this.processingTimer = setTimeout(async () => {
          await this.processBatch(aiParser, snapshot, runId);
        }, 100); // 100ms内的请求会被批处理
      }
    });
  }

  private async processBatch(aiParser: any, snapshot: any, runId: string): Promise<void> {
    const requests = [...this.pendingRequests];
    this.pendingRequests = [];
    this.processingTimer = null;

    // 如果只有一个请求，直接处理
    if (requests.length === 1) {
      try {
        const result = await aiParser.parseNextStep(requests[0].steps, snapshot, runId);
        requests[0].resolve(result);
      } catch (error) {
        requests[0].reject(error);
      }
      return;
    }

    // 批量处理多个请求
    try {
      const batchPrompt = requests.map((req, index) => 
        `步骤组${index + 1}: ${req.steps}`
      ).join('\n\n');

      const batchResult = await aiParser.parseNextStep(batchPrompt, snapshot, runId);
      
      // 简单分发结果（实际实现需要更复杂的解析）
      requests.forEach(req => req.resolve(batchResult));
    } catch (error) {
      requests.forEach(req => req.reject(error));
    }
  }
}
// 🚀 浏览器会话复用优化

export class BrowserSessionManager {
  private static instance: BrowserSessionManager;
  private activeSessions: Map<string, {
    mcpClient: any;
    lastUsed: number;
    testCount: number;
  }> = new Map();
  private readonly SESSION_TIMEOUT = 5 * 60 * 1000; // 5分钟超时
  private readonly MAX_TESTS_PER_SESSION = 10; // 每个会话最多10个测试

  static getInstance(): BrowserSessionManager {
    if (!BrowserSessionManager.instance) {
      BrowserSessionManager.instance = new BrowserSessionManager();
    }
    return BrowserSessionManager.instance;
  }

  /**
   * 获取或创建浏览器会话
   */
  async getSession(sessionKey: string = 'default'): Promise<any> {
    const existing = this.activeSessions.get(sessionKey);
    const now = Date.now();

    // 检查现有会话是否可用
    if (existing && 
        (now - existing.lastUsed) < this.SESSION_TIMEOUT &&
        existing.testCount < this.MAX_TESTS_PER_SESSION) {
      
      existing.lastUsed = now;
      existing.testCount++;
      console.log(`♻️ 复用浏览器会话 ${sessionKey} (第${existing.testCount}次使用)`);
      return existing.mcpClient;
    }

    // 清理旧会话
    if (existing) {
      try {
        await existing.mcpClient.close();
      } catch (error) {
        console.warn('清理旧会话失败:', error);
      }
    }

    // 创建新会话
    console.log(`🚀 创建新浏览器会话 ${sessionKey}`);
    const mcpClient = new (await import('../server/services/mcpClient.js')).PlaywrightMcpClient();
    await mcpClient.initialize({ reuseSession: false });

    this.activeSessions.set(sessionKey, {
      mcpClient,
      lastUsed: now,
      testCount: 1
    });

    return mcpClient;
  }

  /**
   * 释放会话
   */
  async releaseSession(sessionKey: string): Promise<void> {
    const session = this.activeSessions.get(sessionKey);
    if (session) {
      try {
        await session.mcpClient.close();
      } catch (error) {
        console.warn('释放会话失败:', error);
      }
      this.activeSessions.delete(sessionKey);
    }
  }

  /**
   * 清理超时会话
   */
  async cleanupExpiredSessions(): Promise<void> {
    const now = Date.now();
    const expiredKeys: string[] = [];

    for (const [key, session] of this.activeSessions.entries()) {
      if ((now - session.lastUsed) > this.SESSION_TIMEOUT ||
          session.testCount >= this.MAX_TESTS_PER_SESSION) {
        expiredKeys.push(key);
      }
    }

    for (const key of expiredKeys) {
      await this.releaseSession(key);
      console.log(`🧹 清理过期会话: ${key}`);
    }
  }
}

// 🚀 优化后的测试执行服务
export class OptimizedTestExecution {
  private delayManager = new SmartDelayManager();
  private snapshotCache = new SnapshotCacheManager();
  private aiBatchProcessor = new AIBatchProcessor();
  private sessionManager = BrowserSessionManager.getInstance();

  /**
   * 优化后的测试执行方法
   */
  async executeOptimizedTest(testCase: any, runId: string): Promise<void> {
    // 1. 使用会话管理器获取浏览器
    const mcpClient = await this.sessionManager.getSession('test-session');
    
    // 2. 预处理：批量解析所有步骤（可选）
    const allSteps = await this.preParseAllSteps(testCase.steps, runId);
    
    let stepIndex = 0;
    for (const step of allSteps) {
      stepIndex++;
      
      // 3. 智能延迟（大幅减少等待时间）
      await this.delayManager.smartDelay(step.action, 'before');
      
      // 4. 使用缓存快照（减少快照获取次数）
      const snapshot = await this.snapshotCache.getCachedSnapshot(
        mcpClient, 
        stepIndex === 1 || step.action === 'navigate' // 只在首步和导航时强制刷新
      );
      
      // 5. 执行步骤
      const success = await this.executeStep(step, mcpClient, runId);
      
      // 6. 记录结果用于智能调整
      this.delayManager.recordOperation(step.action, success);
      
      // 7. 智能延迟（根据成功率调整）
      await this.delayManager.smartDelay(step.action, 'after');
      
      // 8. 选择性截图（只在关键步骤截图）
      if (this.shouldTakeScreenshot(step, stepIndex, allSteps.length)) {
        await this.takeScreenshot(runId, stepIndex, step.description);
      }
    }
  }

  /**
   * 预解析所有步骤（可选优化）
   */
  private async preParseAllSteps(stepsText: string, runId: string): Promise<any[]> {
    // 简单分割步骤，避免逐步AI解析
    const lines = stepsText.split('\n').filter(line => line.trim());
    return lines.map((line, index) => ({
      id: `step-${index + 1}`,
      action: this.inferActionFromText(line),
      description: line.trim(),
      order: index + 1
    }));
  }

  /**
   * 从文本推断操作类型（避免AI解析）
   */
  private inferActionFromText(text: string): string {
    const lowerText = text.toLowerCase();
    
    if (lowerText.includes('打开') || lowerText.includes('访问') || lowerText.includes('导航')) {
      return 'navigate';
    } else if (lowerText.includes('点击') || lowerText.includes('按钮')) {
      return 'click';
    } else if (lowerText.includes('输入') || lowerText.includes('填写')) {
      return 'fill';
    } else if (lowerText.includes('等待')) {
      return 'wait';
    }
    
    return 'click'; // 默认操作
  }

  /**
   * 智能截图策略
   */
  private shouldTakeScreenshot(step: any, stepIndex: number, totalSteps: number): boolean {
    // 只在以下情况截图：
    // 1. 第一步和最后一步
    // 2. 导航操作
    // 3. 每5步截图一次
    return stepIndex === 1 || 
           stepIndex === totalSteps || 
           step.action === 'navigate' ||
           stepIndex % 5 === 0;
  }
}
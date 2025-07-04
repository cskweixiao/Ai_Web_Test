import { v4 as uuidv4 } from 'uuid';
import { TestSuite, TestSuiteRun, SuiteExecutionOptions } from '../types/tests.js';
import { TestExecutionService } from './testExecution.js';
import { WebSocketManager } from './websocket.js';

// 🔥 测试套件服务：负责套件管理和批量执行
export class SuiteExecutionService {
  private wsManager: WebSocketManager;
  private testExecutionService: TestExecutionService;
  private runningSuites: Map<string, TestSuiteRun> = new Map();
  private externalSuiteFinder?: (id: number) => TestSuite | null;
  
  constructor(wsManager: WebSocketManager, testExecutionService: TestExecutionService) {
    this.wsManager = wsManager;
    this.testExecutionService = testExecutionService;
  }

  public setExternalSuiteFinder(finder: (id: number) => TestSuite | null) {
    this.externalSuiteFinder = finder;
  }

  // 🔥 执行整个测试套件
  public async runSuite(
    suiteId: number, 
    options: SuiteExecutionOptions = {}
  ): Promise<string> {
    const {
      environment = 'staging',
      executionMode = 'interactive',
      concurrency = 1,
      continueOnFailure = true
    } = options;

    console.log(`🚀 [SuiteExecution] 开始执行测试套件 ID: ${suiteId}`);
    
    const suite = await this.findSuiteById(suiteId);
    if (!suite) {
      throw new Error('Test suite not found');
    }

    if (!suite.testCaseIds || suite.testCaseIds.length === 0) {
      throw new Error('Test suite contains no test cases');
    }

    const suiteRunId = uuidv4();
    this.createSuiteRun(suiteRunId, suite, environment);

    // 🔥 异步执行套件，不阻塞API返回
    this.executeSuiteAsync(suiteRunId, suite, environment, executionMode, continueOnFailure)
      .catch(error => {
        console.error('❌ 套件执行失败:', error);
        this.updateSuiteStatus(suiteRunId, 'failed', `Suite execution failed: ${error.message}`);
      });

    return suiteRunId;
  }

  // 🔥 获取套件执行状态
  public getSuiteRun(suiteRunId: string): TestSuiteRun | null {
    return this.runningSuites.get(suiteRunId) || null;
  }

  // 🔥 获取所有运行中的套件
  public getAllRunningSuites(): TestSuiteRun[] {
    return Array.from(this.runningSuites.values());
  }

  private async findSuiteById(id: number): Promise<TestSuite | null> {
    if (this.externalSuiteFinder) {
      return this.externalSuiteFinder(id);
    }
    
    // 🔥 默认测试套件（实际应该从数据库读取）
    const testSuites: TestSuite[] = [
      {
        id: 1,
        name: '登录模块回归测试',
        description: '登录相关功能的完整回归测试',
        testCaseIds: [1], // 暂时只包含一个测试用例
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        owner: '测试团队',
        tags: ['login', 'regression'],
        priority: 'high',
        status: 'active'
      }
    ];
    
    return testSuites.find(suite => suite.id === id) || null;
  }

  private createSuiteRun(suiteRunId: string, suite: TestSuite, environment: string) {
    const suiteRun: TestSuiteRun = {
      id: suiteRunId,
      suiteId: suite.id,
      suiteName: suite.name,
      status: 'queued',
      progress: 0,
      startTime: new Date(),
      duration: '0s',
      totalCases: suite.testCaseIds.length,
      completedCases: 0,
      passedCases: 0,
      failedCases: 0,
      executor: '系统',
      environment,
      testRuns: []
    };

    this.runningSuites.set(suiteRunId, suiteRun);
    this.broadcastSuiteUpdate(suiteRunId, suiteRun);
    
    console.log(`✅ 创建套件执行记录: ${suite.name} (${suiteRunId})`);
  }

  private async executeSuiteAsync(
    suiteRunId: string,
    suite: TestSuite,
    environment: string,
    executionMode: string,
    continueOnFailure: boolean
  ) {
    this.updateSuiteStatus(suiteRunId, 'running');
    
    const suiteRun = this.runningSuites.get(suiteRunId);
    if (!suiteRun) return;

    try {
      console.log(`🚀 [Suite ${suiteRunId}] 开始串行执行 ${suite.testCaseIds.length} 个测试用例`);
      
      // 🔥 串行执行所有测试用例，确保不会相互干扰
      for (let i = 0; i < suite.testCaseIds.length; i++) {
        const testCaseId = suite.testCaseIds[i];
        
        console.log(`🎬 [Suite ${suiteRunId}] 执行测试用例 ${i + 1}/${suite.testCaseIds.length}: ${testCaseId}`);
        
        try {
          // 🔥 调用现有的测试执行服务
          const testRunId = await this.testExecutionService.runTest(testCaseId, environment, executionMode);
          suiteRun.testRuns.push(testRunId);
          
          // 🔥 等待单个测试完成并获取结果
          console.log(`⏳ [Suite ${suiteRunId}] 等待测试用例 ${testCaseId} (${testRunId}) 执行完成...`);
          const testResult = await this.waitForTestCompletion(testRunId);
          
          suiteRun.completedCases++;
          
          if (testResult.success) {
            suiteRun.passedCases++;
            console.log(`✅ [Suite ${suiteRunId}] 测试用例 ${testCaseId} 执行成功`);
          } else {
            suiteRun.failedCases++;
            console.log(`❌ [Suite ${suiteRunId}] 测试用例 ${testCaseId} 执行失败: ${testResult.error}`);
            
            if (!continueOnFailure) {
              throw new Error(`Test case ${testCaseId} failed: ${testResult.error}`);
            }
          }
          
        } catch (testError: any) {
          console.error(`❌ [Suite ${suiteRunId}] 测试用例 ${testCaseId} 启动失败:`, testError.message);
          
          suiteRun.completedCases++;
          suiteRun.failedCases++;
          
          if (!continueOnFailure) {
            throw new Error(`Test case ${testCaseId} failed to start: ${testError.message}`);
          }
        }
        
        // 🔥 更新进度
        suiteRun.progress = Math.round((suiteRun.completedCases / suiteRun.totalCases) * 100);
        this.broadcastSuiteUpdate(suiteRunId, suiteRun);
        
        // 🔥 测试用例间添加短暂间隔，确保资源释放
        if (i < suite.testCaseIds.length - 1) {
          console.log(`⏱️ [Suite ${suiteRunId}] 测试用例间隔等待 2 秒...`);
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
      
      // 🔥 套件执行完成
      this.updateSuiteStatus(suiteRunId, 'completed');
      console.log(`🎉 [Suite ${suiteRunId}] 套件执行完成: ${suiteRun.passedCases}/${suiteRun.totalCases} 通过`);
      
    } catch (error: any) {
      this.updateSuiteStatus(suiteRunId, 'failed', error.message);
    }
  }

  private async waitForTestCompletion(testRunId: string): Promise<{ success: boolean; error?: string }> {
    // 🔥 轮询测试状态直到完成
    return new Promise((resolve) => {
      const pollInterval = 1000; // 每秒检查一次
      const maxWaitTime = 5 * 60 * 1000; // 最多等待5分钟
      const startTime = Date.now();
      
      const pollStatus = () => {
        // 检查是否超时
        if (Date.now() - startTime > maxWaitTime) {
          console.log(`⏰ [waitForTest] 测试 ${testRunId} 等待超时`);
          resolve({ success: false, error: 'Test execution timeout' });
          return;
        }
        
        // 从测试执行服务获取测试状态
        const allTests = this.testExecutionService.getAllTestRuns();
        const testRun = allTests.find(test => test.runId === testRunId);
        
        if (!testRun) {
          console.log(`❓ [waitForTest] 测试 ${testRunId} 不存在，可能已被清理`);
          resolve({ success: false, error: 'Test run not found' });
          return;
        }
        
        console.log(`🔍 [waitForTest] 测试 ${testRunId} 状态: ${testRun.status}`);
        
        if (testRun.status === 'completed') {
          console.log(`✅ [waitForTest] 测试 ${testRunId} 执行成功`);
          resolve({ success: true });
        } else if (testRun.status === 'failed' || testRun.status === 'cancelled') {
          console.log(`❌ [waitForTest] 测试 ${testRunId} 执行失败: ${testRun.status}`);
          resolve({ success: false, error: testRun.error || `Test ${testRun.status}` });
        } else {
          // 继续等待
          setTimeout(pollStatus, pollInterval);
        }
      };
      
      // 开始轮询
      pollStatus();
    });
  }

  private updateSuiteStatus(suiteRunId: string, status: TestSuiteRun['status'], error?: string) {
    const suiteRun = this.runningSuites.get(suiteRunId);
    if (suiteRun) {
      suiteRun.status = status;
      if (error) {
        suiteRun.error = error;
      }
      if (status === 'completed' || status === 'failed') {
        suiteRun.endTime = new Date();
        const duration = suiteRun.endTime.getTime() - suiteRun.startTime.getTime();
        suiteRun.duration = `${Math.round(duration / 1000)}s`;
      }
      this.broadcastSuiteUpdate(suiteRunId, suiteRun);
    }
  }

  private broadcastSuiteUpdate(suiteRunId: string, suiteRun: TestSuiteRun) {
    this.wsManager.sendToAll(JSON.stringify({
      type: 'suiteUpdate',
      suiteRunId,
      suiteRun
    }));
  }

  // 🔥 取消套件执行
  public async cancelSuite(suiteRunId: string): Promise<boolean> {
    const suiteRun = this.runningSuites.get(suiteRunId);
    if (!suiteRun || suiteRun.status !== 'running') {
      return false;
    }

    this.updateSuiteStatus(suiteRunId, 'cancelled');
    console.log(`🛑 [Suite ${suiteRunId}] 套件执行已取消`);
    return true;
  }

  // 🔥 清理已完成的套件记录（防止内存泄漏）
  public cleanupCompletedSuites(olderThanHours: number = 24) {
    const cutoffTime = new Date(Date.now() - olderThanHours * 60 * 60 * 1000);
    
    for (const [suiteRunId, suiteRun] of this.runningSuites.entries()) {
      if (
        (suiteRun.status === 'completed' || suiteRun.status === 'failed' || suiteRun.status === 'cancelled') &&
        suiteRun.endTime &&
        suiteRun.endTime < cutoffTime
      ) {
        this.runningSuites.delete(suiteRunId);
        console.log(`🗑️ 清理过期套件记录: ${suiteRunId}`);
      }
    }
  }
} 
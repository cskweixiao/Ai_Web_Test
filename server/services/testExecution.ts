import { PrismaClient, Prisma } from '../../src/generated/prisma';
import { v4 as uuidv4 } from 'uuid';
import { WebSocketManager } from './websocket.js';
import { AITestParser } from './aiParser.js';
import { PlaywrightMcpClient } from './mcpClient.js';
import { testRunStore } from '../../lib/TestRunStore.js';
import type { TestRun, TestStep, TestLog, TestCase, TestRunStatus } from '../../src/types/test.js';

const prisma = new PrismaClient();

export class TestExecutionService {
  private wsManager: WebSocketManager;
  private aiParser: AITestParser;
  private mcpClient: PlaywrightMcpClient;
  private sharedContext: Map<string, any> = new Map();

  constructor(wsManager: WebSocketManager, aiParser: AITestParser, mcpClient: PlaywrightMcpClient) {
    this.wsManager = wsManager;
    this.aiParser = aiParser;
    this.mcpClient = mcpClient;
    this.aiParser.extendMcpClientWithCustomConditions(this.mcpClient);
    console.log('✅ MCP客户端已增强，支持自定义断言条件');
  }

  // #region Test Case Management
  private dbTestCaseToApp(dbCase: { id: number; title: string; steps: Prisma.JsonValue | null; tags: Prisma.JsonValue | null; created_at: Date | null; }): TestCase {
    let steps = '';
    let assertions = '';
    if (typeof dbCase.steps === 'string' && dbCase.steps) {
        try {
            const stepsObj = JSON.parse(dbCase.steps);
            if (stepsObj && typeof stepsObj === 'object') {
                assertions = stepsObj.assertions || '';
                steps = stepsObj.steps || '';
            } else {
              steps = dbCase.steps;
            }
        } catch (e) { 
          steps = dbCase.steps;
        }
    }
    
    return {
        id: dbCase.id,
        name: dbCase.title,
        steps: steps,
        assertions: assertions,
        tags: (Array.isArray(dbCase.tags) ? dbCase.tags : []) as string[],
        created: dbCase.created_at?.toISOString(),
        priority: 'medium',
        status: 'active',
        author: 'System',
    };
  }

  public async findTestCaseById(id: number): Promise<TestCase | null> {
    const testCase = await prisma.test_cases.findUnique({ where: { id } });
    return testCase ? this.dbTestCaseToApp(testCase) : null;
  }
  
  public async getTestCases(): Promise<TestCase[]> {
      const testCases = await prisma.test_cases.findMany();
      return testCases.map(this.dbTestCaseToApp);
  }

  public async addTestCase(testCaseData: Partial<TestCase>): Promise<TestCase> {
    const stepsData = JSON.stringify({
      steps: testCaseData.steps || '',
      assertions: testCaseData.assertions || ''
    });
    
    const newTestCase = await prisma.test_cases.create({
      data: {
        title: testCaseData.name || 'Untitled Test Case',
        steps: stepsData,
        tags: (testCaseData.tags as Prisma.JsonValue) || Prisma.JsonNull,
      },
    });
    return this.dbTestCaseToApp(newTestCase);
  }

  public async updateTestCase(id: number, testCaseData: Partial<TestCase>): Promise<TestCase | null> {
    try {
      const existingCase = await this.findTestCaseById(id);
      if (!existingCase) return null;

      const newSteps = testCaseData.steps ?? existingCase.steps;
      const newAssertions = testCaseData.assertions ?? existingCase.assertions;
      const stepsData = JSON.stringify({ steps: newSteps, assertions: newAssertions });
      
      const dataToUpdate: any = {
        title: testCaseData.name,
        steps: stepsData,
      };

      if (testCaseData.tags) {
        dataToUpdate.tags = testCaseData.tags;
      }
      
      const updatedTestCase = await prisma.test_cases.update({
        where: { id },
        data: dataToUpdate,
      });
      return this.dbTestCaseToApp(updatedTestCase);
    } catch (error) {
      console.error(`Failed to update test case ${id}:`, error);
      return null;
    }
  }

  public async deleteTestCase(id: number): Promise<boolean> {
    try {
      await prisma.test_cases.delete({ where: { id } });
      return true;
    } catch (error) {
      console.error(`Failed to delete test case ${id}:`, error);
      return false;
    }
  }
  // #endregion

  // #region Test Execution
  public async runTest(
    testCaseId: number, 
    environment: string,
    executionMode: string = 'standard',
    options: {
      reuseBrowser?: boolean,
      suiteId?: string,
      contextState?: any
    } = {}
  ): Promise<string> {
    const runId = uuidv4();
    const testRun: TestRun = {
      id: runId, runId, testCaseId, environment, executionMode,
      status: 'queued',
      logs: [],
      steps: [],
      successfulSteps: [],
      startedAt: new Date(),
      ...options
    };
    
    testRunStore.set(runId, testRun);
    this.addLog(runId, `测试 #${testCaseId} 已加入队列，环境: ${environment}${options.reuseBrowser ? '，复用浏览器' : ''}`);
    if (options.contextState) this.addLog(runId, `已接收上下文状态`);
    
    this.executeTest(runId).catch(error => {
      console.error(`[${runId}] 执行过程中发生致命错误:`, error);
      this.updateTestRunStatus(runId, 'error', `执行过程中发生致命错误: ${error.message}`);
    });

    return runId;
  }
  
  private async executeTest(runId: string) {
    const testRun = testRunStore.get(runId);
    if (!testRun) {
      console.error(`❌ [${runId}] 测试运行记录未找到`);
      return;
    }

    console.log(`🚀 [${runId}] ======= 开始执行测试 =======`);
    console.log(`📝 [${runId}] 测试用例ID: ${testRun.testCaseId}`);
    console.log(`🎯 [${runId}] 执行模式: ${testRun.executionMode}`);
    console.log(`🌍 [${runId}] 运行环境: ${testRun.environment}`);

    // 查找测试用例
    const testCase = await this.findTestCaseById(testRun.testCaseId);
    if (!testCase || !testCase.steps) {
      console.error(`❌ [${runId}] 测试用例 #${testRun.testCaseId} 未找到或没有步骤`);
      this.updateTestRunStatus(runId, 'failed', `测试用例 #${testRun.testCaseId} 未找到或没有步骤。`);
      return;
    }

    console.log(`✅ [${runId}] 找到测试用例: ${testCase.name}`);
    console.log(`📋 [${runId}] 原始步骤内容:`);
    console.log(`${testCase.steps}`);
    console.log(`📋 [${runId}] 断言内容:`);
    console.log(`${testCase.assertions || '无断言'}`);

    try {
      await this.mcpClient.initialize({
        reuseSession: testRun.reuseBrowser,
        contextState: testRun.contextState
      });

      this.updateTestRunStatus(runId, 'running', '开始解析测试步骤...');
      this.addLog(runId, `🤖 开始AI解析测试步骤`, 'info');

      console.log(`🤖 [${runId}] === 开始AI解析 ===`);
      console.log(`📄 [${runId}] 待解析内容: ${testCase.steps}`);

      // AI解析步骤
      const parseResult = await this.aiParser.parseTestDescription(testCase.steps, testCase.name, runId, null);
      
      if (!parseResult.success || !parseResult.steps || parseResult.steps.length === 0) {
        console.error(`❌ [${runId}] AI解析失败: ${parseResult.error || '没有解析出任何步骤'}`);
        this.updateTestRunStatus(runId, 'failed', `AI解析失败: ${parseResult.error || '没有解析出有效的测试步骤'}`);
        return;
      }

      const parsedSteps = parseResult.steps;
      
      console.log(`🎉 [${runId}] AI解析完成，共解析出 ${parsedSteps.length} 个步骤:`);
      parsedSteps.forEach((step, index) => {
        console.log(`  ${index + 1}. [${step.action}] ${step.description}`);
        if (step.selector) console.log(`     选择器: ${step.selector}`);
        if (step.url) console.log(`     URL: ${step.url}`);
        if (step.value) console.log(`     值: ${step.value}`);
      });

      this.addLog(runId, `✅ AI解析成功，共${parsedSteps.length}个步骤`, 'success');

      // 执行步骤
      console.log(`⚡ [${runId}] === 开始执行步骤 ===`);
      this.updateTestRunStatus(runId, 'running', `开始执行 ${parsedSteps.length} 个步骤...`);

      for (let i = 0; i < parsedSteps.length; i++) {
        const step = this.processParsedStep(parsedSteps[i], i + 1, runId, testRun);
        
        console.log(`\n🎬 [${runId}] === 执行第 ${i + 1}/${parsedSteps.length} 步 ===`);
        console.log(`📝 [${runId}] 步骤: ${step.description}`);
        
        this.addLog(runId, `执行步骤 ${i + 1}/${parsedSteps.length}: ${step.description}`, 'info');
        this.updateTestRunStatus(runId, 'running', `执行步骤 ${i + 1}/${parsedSteps.length}: ${step.description}`);

        try {
          const result = await this.executeStepWithRetry(step, testRun);
          if (result.success) {
            console.log(`✅ [${runId}] 第 ${i + 1} 步执行成功`);
            this.addLog(runId, `✅ 步骤 ${i + 1} 执行成功`, 'success');
          } else {
            console.error(`❌ [${runId}] 第 ${i + 1} 步执行失败: ${result.error}`);
            this.addLog(runId, `❌ 步骤 ${i + 1} 执行失败: ${result.error}`, 'error');
            this.updateTestRunStatus(runId, 'failed', `步骤 ${i + 1} 执行失败: ${result.error}`);
            return;
          }
        } catch (error: any) {
          console.error(`💥 [${runId}] 第 ${i + 1} 步执行异常:`, error);
          this.addLog(runId, `💥 步骤 ${i + 1} 执行异常: ${error.message}`, 'error');
          this.updateTestRunStatus(runId, 'failed', `步骤 ${i + 1} 执行异常: ${error.message}`);
          return;
        }
      }

      console.log(`🎉 [${runId}] === 所有步骤执行完成 ===`);
      this.addLog(runId, `🎉 所有 ${parsedSteps.length} 个步骤执行完成`, 'success');

      // 处理上下文共享
      await this.handleContextSharingOnSuccess(testRun);

      this.updateTestRunStatus(runId, 'completed', `测试执行成功，共执行 ${parsedSteps.length} 个步骤`);
      this.addLog(runId, '✅ 测试执行成功完成', 'success');

      console.log(`🏆 [${runId}] ======= 测试执行成功 =======\n`);

    } catch (error: any) {
      console.error(`💥 [${runId}] 测试执行失败:`, error);
      console.error(`💥 [${runId}] 错误堆栈:`, error.stack);
      this.addLog(runId, `💥 测试执行失败: ${error.message}`, 'error');
      this.updateTestRunStatus(runId, 'failed', `测试执行失败: ${error.message}`);
    } finally {
      await this.finalizeTestRun(runId);
    }
  }

  private processParsedStep(step: TestStep, order: number, runId: string, testRun: TestRun): TestStep {
    step.id = `step-${order}`;
    step.order = order;
    // @ts-ignore
    step.testExecutionId = runId;
    testRun.steps.push(step);
    this.addLog(runId, `📝 AI成功解析步骤: ${step.description}`);
    this.wsManager.broadcast({ type: 'test_update', runId, data: { steps: testRun.steps } });
    return step;
  }

  private async executeStepWithRetry(step: TestStep, testRun: TestRun) {
    const runId = testRun.id;
    const maxRetries = 1;
    let attempt = 0;

    while (attempt < maxRetries) {
      try {
        this.addLog(runId, `🔍 [步骤 ${step.order}] 开始执行: ${step.description}`);
        await this.mcpClient.executeStep(step, runId);
        this.addLog(runId, `✅ [步骤 ${step.order}] 执行成功`, 'success');
        testRun.successfulSteps.push(step.id);
        this.wsManager.broadcast({ type: 'test_update', runId, data: { successfulSteps: testRun.successfulSteps } });
        return { success: true }; // Indicate success for the loop
      } catch (error: any) {
        attempt++;
        this.addLog(runId, `⚠️ [步骤 ${step.order}] 失败 (尝试 ${attempt}/${maxRetries}): ${error.message}`, 'warning');
      }
    }
    return { success: false, error: `步骤 ${step.order} 执行失败，达到最大重试次数。` };
  }

  private async attemptSelfHeal(step: TestStep, testRun: TestRun) {
    const runId = testRun.id;
    this.addLog(runId, `🤖 [步骤 ${step.order}] 正在尝试AI自愈...`);
    const snapshot = await this.mcpClient.getSnapshot();
    const fixResult = await this.aiParser.fixStepSelector(step, "Selector failed", snapshot, runId);

    if (fixResult.success && fixResult.steps.length > 0) {
      const newSelector = fixResult.steps[0].selector;
      this.addLog(runId, `✅ AI修正完成，新选择器: ${newSelector}`, 'success');
      step.selector = newSelector;
      testRun.steps[step.order - 1] = step;
      this.wsManager.broadcast({ type: 'test_update', runId, data: { steps: testRun.steps } });
      
      this.addLog(runId, `🔍 [步骤 ${step.order}] AI自愈后重试...`);
      await this.mcpClient.executeStep(step, runId);
      this.addLog(runId, `✅ [步骤 ${step.order}] AI自愈后重试成功`, 'success');
      testRun.successfulSteps.push(step.id);
      this.wsManager.broadcast({ type: 'test_update', runId, data: { successfulSteps: testRun.successfulSteps } });
    } else {
      const finalErrorMsg = `[步骤 ${step.order}] AI自愈失败`;
      await this.mcpClient.takeScreenshot(`${runId}-${step.id}-failed.png`);
      throw new Error(finalErrorMsg);
    }
  }
  
  private async handleContextSharingOnSuccess(testRun: TestRun) {
    if(testRun.reuseBrowser && testRun.suiteId) {
      const finalContextState = await this.mcpClient.getContextState();
      if (finalContextState) {
        this.setSharedContext(testRun.suiteId, finalContextState);
        this.addLog(testRun.id, '✅ 成功保存共享上下文状态', 'success');
      }
    }
  }

  private async finalizeTestRun(runId: string) {
    const testRun = testRunStore.get(runId);
    if(testRun){
        this.addLog(runId, `🔍 测试流程结束`);
        testRun.endedAt = new Date();
        const duration = this.calculateDuration(testRun.startedAt, testRun.endedAt);
        this.wsManager.broadcast({ type: 'test_update', runId, data: { status: testRun.status, endedAt: testRun.endedAt, duration } });
        if (!testRun.reuseBrowser) {
          await this.mcpClient.close();
        }
    }
  }
  // #endregion

  // #region Test Run Management
  public getTestRun(runId: string) { return testRunStore.get(runId); }
  public getAllTestRuns() { return testRunStore.all(); }
  public async cancelTest(runId: string): Promise<boolean> {
    const testRun = this.getTestRun(runId);
    if (testRun && ['queued', 'running'].includes(testRun.status)) {
      this.updateTestRunStatus(runId, 'cancelled', '测试已被用户取消');
      if (!testRun.reuseBrowser) await this.mcpClient.close();
      return true;
    }
    return false;
  }
  // #endregion

  // #region Utilities
  private updateTestRunStatus(runId: string, status: TestRunStatus, message?: string) {
    const testRun = testRunStore.get(runId);
    if (testRun) {
      testRun.status = status;
      const logLevel = (status === 'failed' || status === 'error') ? 'error' : 'info';
      if (message) {
        this.addLog(runId, message, logLevel);
      }
      this.wsManager.broadcast({ type: 'test_update', runId, data: { status: testRun.status } });
    }
  }

  private addLog(runId: string, message: string, level?: 'info' | 'success' | 'warning' | 'error') {
    const testRun = testRunStore.get(runId);
    if (testRun) {
      const logEntry: TestLog = { id: uuidv4(), timestamp: new Date(), message, level: level || 'info' };
      testRun.logs.push(logEntry);
      this.wsManager.broadcast({ type: 'log', runId, data: { log: logEntry } });
    } else {
      console.warn(`[${runId}] 尝试记录日志失败，未找到测试运行。`);
    }
  }

  public setSharedContext(suiteId: string, contextState: any) { this.sharedContext.set(suiteId, contextState); }
  public getSharedContext(suiteId: string): any { return this.sharedContext.get(suiteId); }
  public clearSharedContext(suiteId: string): void { this.sharedContext.delete(suiteId); }
  private calculateDuration(startTime: Date, endTime: Date): string {
    return ((endTime.getTime() - startTime.getTime()) / 1000).toFixed(2) + 's';
  }
  // #endregion
} 
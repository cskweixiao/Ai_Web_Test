import { PrismaClient, Prisma } from '../../src/generated/prisma';
import { v4 as uuidv4 } from 'uuid';
import { WebSocketManager } from './websocket.js';
import { PlaywrightMcpClient } from './mcpClient.js';
import { AITestParser } from './aiParser.js';
import { testRunStore } from '../../lib/TestRunStore.js';
import type { TestRun, TestStep, TestLog, TestCase, TestRunStatus } from '../../src/types/test.js';

const prisma = new PrismaClient();

// 重构后的测试执行服务：完全基于MCP的新流程
export class TestExecutionService {
  private wsManager: WebSocketManager;
  private mcpClient: PlaywrightMcpClient;

  private aiParser: AITestParser;

  constructor(wsManager: WebSocketManager, aiParser: AITestParser, mcpClient: PlaywrightMcpClient) {
    this.wsManager = wsManager;
    this.aiParser = aiParser;
    this.mcpClient = mcpClient;
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
      console.error(`更新测试用例 ${id} 失败:`, error);
      return null;
    }
  }

  public async deleteTestCase(id: number): Promise<boolean> {
    try {
      await prisma.test_cases.delete({ where: { id } });
      return true;
    } catch (error) {
      console.error(`删除测试用例 ${id} 失败:`, error);
      return false;
    }
  }
  // #endregion

  // #region Test Execution - 新流程实现
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
    this.addLog(runId, `测试 #${testCaseId} 已加入队列，环境: ${environment}`);
    
    this.executeTest(runId).catch(error => {
      console.error(`[${runId}] 执行过程中发生错误:`, error);
      this.updateTestRunStatus(runId, 'error', `执行过程中发生错误: ${error.message}`);
    });

    return runId;
  }
  
  private async executeTest(runId: string) {
    const testRun = testRunStore.get(runId);
    if (!testRun) {
      console.error(`❌ [${runId}] 测试运行记录未找到`);
      return;
    }

    const testCase = await this.findTestCaseById(testRun.testCaseId);
    if (!testCase || !testCase.steps) {
      this.updateTestRunStatus(runId, 'failed', `测试用例未找到`);
      return;
    }

    console.log(`🚀 [${runId}] 开始执行 [${testCase.name}]`);

    try {
      // 🔥 初始化MCP客户端
      console.log(`🚀 [${runId}] 正在初始化MCP客户端...`);
      console.log(`📊 [${runId}] MCP客户端状态: isInitialized=${this.mcpClient['isInitialized']}`);
      
      try {
        await this.mcpClient.initialize({
          reuseSession: false,
          headless: false,
          contextState: null
        });
        console.log(`✅ [${runId}] MCP客户端初始化成功`);
      } catch (initError) {
        console.error(`❌ [${runId}] MCP初始化失败:`, initError);
        this.updateTestRunStatus(runId, 'failed', `MCP初始化失败: ${initError.message}`);
        return;
      }

      let remainingSteps = testCase.steps;
      let stepIndex = 0;

      // 🔥 AI闭环执行
      while (remainingSteps?.trim()) {
        stepIndex++;
        
        const snapshot = await this.mcpClient.getSnapshot();
        const aiResult = await this.aiParser.parseNextStep(remainingSteps, snapshot, runId);
        
        if (!aiResult.success || !aiResult.step) {
          this.updateTestRunStatus(runId, 'failed', `AI解析失败: ${aiResult.error}`);
          return;
        }

        const step = aiResult.step;
        this.updateTestRunStatus(runId, 'running', `步骤 ${stepIndex}: ${step.description}`);

        try {
          const result = await this.executeMcpCommand(step, runId);
          if (!result.success) {
            this.updateTestRunStatus(runId, 'failed', `步骤 ${stepIndex} 失败: ${result.error}`);
            return;
          }
        } catch (error: any) {
          this.updateTestRunStatus(runId, 'failed', `步骤 ${stepIndex} 异常: ${error.message}`);
          return;
        }

        remainingSteps = aiResult.remaining || '';
      }

      // 🔥 AI断言阶段
      if (testCase.assertions?.trim()) {
        const assertionSnapshot = await this.mcpClient.getSnapshot();
        const aiAssertions = await this.aiParser.parseAssertions(
          testCase.assertions, 
          assertionSnapshot, 
          runId
        );

        if (!aiAssertions.success) {
          throw new Error(`AI断言解析失败: ${aiAssertions.error}`);
        }

        for (let i = 0; i < aiAssertions.steps.length; i++) {
          const assertion = aiAssertions.steps[i];
          try {
            const result = await this.executeMcpCommand(assertion, runId);
            if (!result.success) {
              this.updateTestRunStatus(runId, 'failed', `断言 ${i + 1} 失败: ${result.error}`);
              return;
            }
          } catch (error: any) {
            this.updateTestRunStatus(runId, 'failed', `断言 ${i + 1} 异常: ${error.message}`);
            return;
          }
        }
      }

      console.log(`✅ [${runId}] 完成 [${testCase.name}]`);
      this.updateTestRunStatus(runId, 'completed', '测试执行完成');

    } catch (error: any) {
      console.error(`💥 [${runId}] 测试失败:`, error.message);
      this.addLog(runId, `💥 测试执行失败: ${error.message}`, 'error');
      this.updateTestRunStatus(runId, 'failed', `测试执行失败: ${error.message}`);
    } finally {
      try {
        console.log(`🧹 [${runId}] 正在清理MCP客户端...`);
        await this.mcpClient.close();
        console.log(`✅ [${runId}] MCP客户端已关闭`);
      } catch (cleanupError) {
        console.warn(`⚠️ [${runId}] 关闭MCP客户端时出错:`, cleanupError);
      }
      await this.finalizeTestRun(runId);
    }
  }

  // 🔥 解析测试步骤
  private parseTestSteps(stepsText: string): TestStep[] {
    if (!stepsText?.trim()) return [];
    
    const lines = stepsText.split('\n').filter(line => line.trim());
    return lines.map((line, index) => ({
      id: `step-${index + 1}`,
      action: 'execute', // 默认执行动作
      description: line.trim(),
      order: index + 1,
      selector: '',
      value: ''
    }));
  }

  // 🔥 解析断言
  private parseAssertions(assertionsText: string): TestStep[] {
    if (!assertionsText?.trim()) return [];
    
    const lines = assertionsText.split('\n').filter(line => line.trim());
    return lines.map((line, index) => ({
      id: `assertion-${index + 1}`,
      action: 'expect', // 断言动作
      description: line.trim(),
      order: index + 1,
      selector: '',
      condition: 'visible',
      text: ''
    }));
  }

  // 🔥 执行步骤（带重试）
  private async executeStepWithRetry(step: TestStep, runId: string) {
    const maxRetries = 2;
    let attempt = 0;

    while (attempt < maxRetries) {
      try {
        this.addLog(runId, `[步骤 ${step.order}] 开始执行: ${step.description}`, 'info');
        
        // 根据步骤描述生成MCP命令并执行
        const result = await this.executeMcpCommand(step, runId);
        
        if (result.success) {
          this.addLog(runId, `✅ [步骤 ${step.order}] 执行成功`, 'success');
          return { success: true };
        } else {
          throw new Error(result.error);
        }
      } catch (error: any) {
        attempt++;
        if (attempt < maxRetries) {
          this.addLog(runId, `⚠️ [步骤 ${step.order}] 失败，重试 ${attempt}/${maxRetries}: ${error.message}`, 'warning');
          await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
        } else {
          this.addLog(runId, `❌ [步骤 ${step.order}] 执行失败: ${error.message}`, 'error');
          return { success: false, error: error.message };
        }
      }
    }
    
    return { success: false, error: '达到最大重试次数' };
  }

  // 🔥 执行MCP命令
  private async executeMcpCommand(step: TestStep, runId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const description = step.description.toLowerCase();
      
      // 获取当前页面快照用于决策
      const snapshot = await this.mcpClient.getSnapshot();
      
      // 🔥 根据描述生成MCP命令
      let mcpCommand = null;
      
      if (description.includes('打开') || description.includes('访问') || description.includes('导航到')) {
        // 提取URL
        const urlMatch = description.match(/https?:\/\/[^\s\u4e00-\u9fff]+/);
        const url = urlMatch ? urlMatch[0] : 'https://k8s-saas-tmp.ycb51.cn';
        
        mcpCommand = {
          name: 'navigate',
          arguments: { url }
        };
      } else if (description.includes('点击')) {
        // 提取点击目标
        const target = this.extractTargetFromDescription(description);
        mcpCommand = {
          name: 'click',
          arguments: { selector: target }
        };
      } else if (description.includes('输入') || description.includes('填写')) {
        // 提取输入信息
        const { selector, value } = this.extractInputFromDescription(description);
        mcpCommand = {
          name: 'fill',
          arguments: { selector, value }
        };
      } else if (step.action === 'expect') {
        // 断言处理
        const { selector, condition, text } = this.extractAssertionFromDescription(description);
        mcpCommand = {
          name: 'expect',
          arguments: { selector, condition, text }
        };
      } else {
        // 默认等待
        mcpCommand = {
          name: 'wait',
          arguments: { timeout: 1000 }
        };
      }

      if (mcpCommand) {
        const result = await this.mcpClient.callTool(mcpCommand);
        return { success: true };
      }
      
      return { success: false, error: '无法解析步骤描述' };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  // 🔥 从描述中提取目标
  private extractTargetFromDescription(description: string): string {
    const text = description.toLowerCase();
    
    if (text.includes('登录')) return 'text=登录';
    if (text.includes('商品管理')) return 'text=商品管理';
    if (text.includes('用户管理')) return 'text=用户管理';
    if (text.includes('提交')) return 'text=提交';
    if (text.includes('保存')) return 'text=保存';
    
    return 'body'; // 默认选择器
  }

  // 🔥 从描述中提取输入信息
  private extractInputFromDescription(description: string): { selector: string; value: string } {
    const text = description.toLowerCase();
    
    let selector = 'input[type="text"]';
    let value = '';
    
    if (text.includes('用户名') || text.includes('账号')) {
      selector = 'input[name="username"], input[placeholder*="用户"], input[placeholder*="账号"]';
      value = text.includes('admin') ? 'admin' : 'testuser';
    } else if (text.includes('密码') || text.includes('password')) {
      selector = 'input[type="password"], input[placeholder*="密码"]';
      value = text.includes('123456') ? '123456' : 'password';
    } else {
      // 提取引号中的内容作为值
      const valueMatch = description.match(/["']([^"']+)["']/);
      value = valueMatch ? valueMatch[1] : 'test';
    }
    
    return { selector, value };
  }

  // 🔥 从描述中提取断言信息
  private extractAssertionFromDescription(description: string): { selector: string; condition: string; text: string } {
    const text = description.toLowerCase();
    
    let selector = 'body';
    let condition = 'visible';
    let expectedText = '';
    
    if (text.includes('页面')) {
      selector = 'body';
      condition = 'visible';
    } else if (text.includes('提示') || text.includes('消息')) {
      selector = '.message, .alert, .notification';
      condition = 'contains_text';
      expectedText = '成功';
    } else {
      condition = 'visible';
    }
    
    return { selector, condition, text: expectedText };
  }

  // #region Test Run Management
  public getTestRun(runId: string) { return testRunStore.get(runId); }
  public getAllTestRuns() { return testRunStore.all(); }
  public async cancelTest(runId: string): Promise<boolean> {
    const testRun = this.getTestRun(runId);
    if (testRun && ['queued', 'running'].includes(testRun.status)) {
      this.updateTestRunStatus(runId, 'cancelled', '测试已被用户取消');
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
    }
  }

  private async finalizeTestRun(runId: string) {
    const testRun = testRunStore.get(runId);
    if(testRun){
      testRun.endedAt = new Date();
      const duration = this.calculateDuration(testRun.startedAt, testRun.endedAt);
      this.wsManager.broadcast({ type: 'test_update', runId, data: { status: testRun.status, endedAt: testRun.endedAt, duration } });
    }
  }

  private calculateDuration(startTime: Date, endTime: Date): string {
    return ((endTime.getTime() - startTime.getTime()) / 1000).toFixed(2) + 's';
  }
  // #endregion
}
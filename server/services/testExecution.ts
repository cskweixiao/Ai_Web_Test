import { v4 as uuidv4 } from 'uuid';
import { PlaywrightMcpClient, TestStep, McpExecutionResult } from './mcpClient.js';
import { WebSocketManager } from './websocket.js';
import { AITestParser } from './aiParser.js';

export interface TestCase {
  id: number;
  name: string;
  description?: string;
  steps: string;           // 原始步骤文本 
  assertions: string;      // 原始断言文本1111
  tags?: string[];
  priority?: 'high' | 'medium' | 'low';
  status?: 'active' | 'draft' | 'disabled';
  author?: string;
  created?: string;
  lastRun?: string;
  success_rate?: number;
  parsedSteps?: TestStep[];     // AI解析后的步骤
  parsedAssertions?: TestStep[]; // AI解析后的断言
  totalSteps?: number;
}

export interface TestRun {
  id: string;
  testCaseId: number;
  name: string;
  status: TestRunStatus;
  progress: number;
  startTime: Date;
  endTime?: Date;
  duration: string;
  totalSteps: number;
  completedSteps: number;
  passedSteps: number;
  failedSteps: number;
  executor: string;
  environment: string;
  logs: TestLog[];
  screenshots: string[];
  error?: string;
}

export type TestRunStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface TestLog {
  id: string;
  timestamp: Date;
  level: 'info' | 'success' | 'warning' | 'error';
  message: string;
  stepId?: string;
}

// ExtendedTestCase 接口已并入 TestCase 接口

interface Assertion {
    success: boolean;
    steps: TestStep[];
}

const concurrency = 1; // 每次只处理一个测试

export class TestExecutionService {
  private wsManager: WebSocketManager;
  private aiParser: AITestParser;
  private runningTests: Map<string, any> = new Map();
  private clients: Map<string, PlaywrightMcpClient> = new Map();
  private externalTestCaseFinder?: (id: number) => TestCase | null;

  constructor(wsManager: WebSocketManager) {
    this.wsManager = wsManager;
    this.aiParser = new AITestParser();

    this.wsManager.on('executeTest', (data) => this.handleExecuteTest(data));
  }

  public setExternalTestCaseFinder(finder: (id: number) => TestCase | null) {
    this.externalTestCaseFinder = finder;
  }

  private async handleExecuteTest({ testCaseId, environment, executionMode }) {
    console.log(`🔥🔥🔥 [API] 收到执行测试请求`);
    console.log(`🔥🔥🔥 [API] 请求体:`, { testCaseId, environment, executionMode });

    const testCase = await this.findTestCaseById(testCaseId);
    if (!testCase) {
      this.wsManager.sendToAll(JSON.stringify({ type: 'error', message: 'Test case not found' }));
      return;
    }

    const runId = uuidv4();
    this.createTestRun(runId, testCase);

    if (executionMode === 'interactive') {
      this.executeTestWithInteractiveParsing(testCase, runId).catch(error => {
        console.error('❌ 交互式测试启动出错:', error);
        this.updateRunStatus(runId, 'failed', `Test failed to start: ${error.message}`);
      });
    } else {
      this.executeTestWithAssertions(testCase, runId).catch(error => {
        console.error('❌ 测试启动出错:', error);
        this.updateRunStatus(runId, 'failed', `Test failed to start: ${error.message}`);
      });
    }
    
    this.wsManager.sendToAll(JSON.stringify({ type: 'testQueued', runId, testCaseId }));
  }

  private async findTestCaseById(id: number): Promise<TestCase | null> {
    if (this.externalTestCaseFinder) {
      return this.externalTestCaseFinder(id);
    }
    
    const testCases: TestCase[] = [
        { id: 1, name: '测试', steps: '、打开https://supply-test.ycb51.cn/voperate_admin/login 账号zengqian 密码 a123456 点击登入', assertions: '校验是否登入成功' },
    ];
    return testCases.find(tc => tc.id === id) || null;
  }

  private createTestRun(runId: string, testCase: TestCase) {
    const testRun = {
      runId,
      testCaseId: testCase.id,
      name: testCase.name,
      status: 'queued',
      logs: [],
      startTime: new Date(),
    };
    this.runningTests.set(runId, testRun);
    this.addLog(runId, `测试任务 '${testCase.name}' 已创建，运行ID: ${runId}`);
  }

  private updateRunStatus(runId: string, status: string, error?: string) {
    const testRun = this.runningTests.get(runId);
    if (testRun) {
      testRun.status = status;
      if (error) {
        testRun.error = error;
        this.addLog(runId, error, 'error');
      }
      if (status === 'completed' || status === 'failed') {
        testRun.endTime = new Date();
      }
      this.wsManager.sendTestUpdate(runId, testRun);
    }
  }

  private addLog(runId: string, message: string, level = 'info') {
    const testRun = this.runningTests.get(runId);
    if (testRun) {
      const logEntry = {
        timestamp: new Date().toISOString(),
        message,
        level,
      };
      testRun.logs.push(logEntry);
      console.log(`[${runId}] ${message}`);
      this.wsManager.sendTestLog(runId, logEntry);
    }
  }

  private async executeTestWithAssertions(testCase: TestCase, runId: string): Promise<void> {
    this.addLog(runId, `[模式: 标准] 开始运行测试，ID: ${testCase.id}`);

    const stepsText = testCase.steps;
    if (!stepsText) {
      this.addLog(runId, '❌ [Error] 找不到测试步骤文本，测试中止。', 'error');
      this.updateRunStatus(runId, 'failed', 'Missing steps text');
      return;
    }

    const { steps: parsedSteps, success: stepsSuccess } = await this.aiParser.parseSteps(stepsText, runId);
    if (!stepsSuccess || !parsedSteps || parsedSteps.length === 0) {
      this.addLog(runId, `❌ [Error] AI无法解析测试步骤: ${stepsText}`, 'error');
      this.updateRunStatus(runId, 'failed', 'AI parsing failed');
      return;
    }

    let assertions: Assertion = { success: true, steps: [] };
    if (testCase.assertions) {
      // In standard mode, we don't have a live snapshot for assertion parsing.
      assertions = await this.aiParser.parseAssertions(testCase.assertions, {}, runId);
    }

    this.addLog(runId, `🚀 直接执行 ${parsedSteps.length} 个测试步骤和 ${assertions.steps.length} 个断言步骤.`);

    // 🔥 直接执行标准测试，不使用队列
    this.processStandardTestJob({ data: { runId, steps: parsedSteps, assertions } }).catch(error => {
      console.error('❌ 标准测试执行失败:', error);
      this.updateRunStatus(runId, 'failed', `Standard test failed: ${error.message}`);
    });
  }

  public async executeTestWithInteractiveParsing(testCase: TestCase, runId: string): Promise<void> {
    this.addLog(runId, `[模式: 交互式] 开始运行测试，ID: ${testCase.id}`);

    if (!testCase.steps) {
      this.addLog(runId, '❌ [Error] 找不到测试步骤文本，测试中止。', 'error');
      this.updateRunStatus(runId, 'failed', 'Missing steps text');
      return;
    }

    // 🔥 直接执行交互式测试，不使用队列
    this.addLog(runId, `🚀 直接启动交互式测试: ${testCase.name}`);
    this.processInteractiveTestJob({ data: { testCase, runId } }).catch(error => {
      console.error('❌ 交互式测试执行失败:', error);
      this.updateRunStatus(runId, 'failed', `Interactive test failed: ${error.message}`);
    });
  }

  private async processJob(job: Job): Promise<void> {
    const { testCase, runId, interactive } = job.data;
    if (interactive) {
        await this.processInteractiveTestJob(job);
    } else {
        await this.processStandardTestJob(job);
    }
  }
  
  private async processStandardTestJob(job: Job): Promise<void> {
    const { runId, steps, assertions } = job.data;
    const mcpClient = new PlaywrightMcpClient();
    this.clients.set(runId, mcpClient);
    this.updateRunStatus(runId, 'running');

    try {
      await mcpClient.initialize();

      for (const step of steps) {
        const result = await mcpClient.executeStep(step);
        this.logStepResult(runId, step, result);
        if (!result.success) throw new Error(`步骤执行失败: ${step.description}`);
      }

      if (assertions && assertions.steps) {
        for (const assertionStep of assertions.steps) {
          const result = await mcpClient.executeStep(assertionStep);
          this.logStepResult(runId, assertionStep, result);
          if (!result.success) throw new Error(`断言执行失败: ${assertionStep.description}`);
        }
      }
      this.updateRunStatus(runId, 'completed');
    } catch (error: any) {
      this.addLog(runId, `❌ 测试执行异常: ${error.message}`, 'error');
      this.updateRunStatus(runId, 'failed', `Test execution failed: ${error.message}`);
    } finally {
      await mcpClient.cleanup();
      this.clients.delete(runId);
    }
  }

  private async processInteractiveTestJob(job: Job): Promise<void> {
    const { testCase, runId } = job.data;
    const mcpClient = new PlaywrightMcpClient();
    this.clients.set(runId, mcpClient);
    this.updateRunStatus(runId, 'running');

    try {
      await mcpClient.initialize();

      let remainingStepsText = testCase.steps;
      let stepCounter = 1;

      while (remainingStepsText && remainingStepsText.trim().length > 0) {
        this.addLog(runId, `\n🎬 [Step ${stepCounter}] 待解析文本: "${remainingStepsText}"`);

        // 🔥 每次解析前先扫描页面元素
        this.addLog(runId, `🔍 [Step ${stepCounter}] 正在扫描当前页面元素...`);
        
        try {
          const pageElements = await mcpClient.getPageInteractiveElements();
          this.addLog(runId, `✅ [Step ${stepCounter}] 扫描完成，发现 ${pageElements.length} 个可交互元素`);
          
          // 详细记录前5个主要元素
          if (pageElements.length > 0) {
            const topElements = pageElements.slice(0, 5);
            this.addLog(runId, `📋 [Step ${stepCounter}] 主要可交互元素:`);
            topElements.forEach((el, index) => {
              const elementDesc = this.formatElementDescription(el);
              this.addLog(runId, `   ${index + 1}. ${elementDesc}`);
            });
            
            if (pageElements.length > 5) {
              this.addLog(runId, `   ... 还有 ${pageElements.length - 5} 个其他元素`);
            }
          } else {
            this.addLog(runId, `⚠️ [Step ${stepCounter}] 当前页面未找到可交互元素`);
          }
        } catch (elementError: any) {
          this.addLog(runId, `❌ [Step ${stepCounter}] 扫描页面元素失败: ${elementError.message}`, 'warning');
        }

        // 获取完整的页面快照（包含元素信息）
        const snapshot = await mcpClient.getSnapshot();
        
        // 🔥 基于页面元素信息解析下一步操作
        this.addLog(runId, `🤖 [Step ${stepCounter}] 基于页面元素信息解析下一步操作...`);
        const { step, remaining } = await this.aiParser.parseNextStep(remainingStepsText, snapshot, runId);

        if (step) {
          this.addLog(runId, `✅ [Step ${stepCounter}] AI解析成功: ${step.action} - ${step.description}`);
          
          // 如果有选择器，显示更多信息
          if (step.selector) {
            this.addLog(runId, `🎯 [Step ${stepCounter}] 目标选择器: ${step.selector}`);
          }
          if (step.value) {
            this.addLog(runId, `📝 [Step ${stepCounter}] 输入值: ${step.value}`);
          }
          if (step.url) {
            this.addLog(runId, `🌐 [Step ${stepCounter}] 目标URL: ${step.url}`);
          }

          // 执行步骤
          this.addLog(runId, `⚡ [Step ${stepCounter}] 开始执行操作...`);
          const result = await mcpClient.executeStep(step);
          this.logStepResult(runId, step, result);
          
          if (!result.success) {
            throw new Error(`步骤 ${stepCounter} 执行失败: ${step.description} - ${result.error}`);
          }
          
          this.addLog(runId, `🎉 [Step ${stepCounter}] 执行成功！`);
        } else {
          this.addLog(runId, `🤔 [Step ${stepCounter}] AI未能从 "${remainingStepsText}" 中解析出下一步操作，测试步骤结束。`);
          break;
        }

        // 检查剩余文本是否有变化，避免无限循环
        if (remaining && remaining.trim() === remainingStepsText.trim()) {
          this.addLog(runId, `🛑 [Step ${stepCounter}] AI无法继续解析，剩余文本没有变化。终止执行。`, 'error');
          break;
        }
        
        remainingStepsText = remaining;
        stepCounter++;
        
        // 🔥 步骤间添加短暂延迟，确保页面状态稳定
        if (remainingStepsText && remainingStepsText.trim().length > 0) {
          this.addLog(runId, `⏱️ [Step ${stepCounter-1}] 等待页面状态稳定...`);
          await new Promise(resolve => setTimeout(resolve, 1500));
        }
      }

      this.addLog(runId, `✅ 所有测试步骤执行完毕，共执行 ${stepCounter - 1} 个步骤。`);

      // 🔥 执行断言前也先扫描页面元素
      if (testCase.assertions) {
        this.addLog(runId, `\n🎯 开始解析并执行断言...`);
        
        this.addLog(runId, `🔍 [断言] 正在扫描页面元素用于断言验证...`);
        try {
          const finalPageElements = await mcpClient.getPageInteractiveElements();
          this.addLog(runId, `✅ [断言] 扫描完成，发现 ${finalPageElements.length} 个可交互元素`);
          
          // 记录断言阶段的页面状态
          if (finalPageElements.length > 0) {
            const importantElements = finalPageElements.slice(0, 3);
            this.addLog(runId, `📋 [断言] 关键页面元素:`);
            importantElements.forEach((el, index) => {
              const elementDesc = this.formatElementDescription(el);
              this.addLog(runId, `   ${index + 1}. ${elementDesc}`);
            });
          }
        } catch (elementError: any) {
          this.addLog(runId, `❌ [断言] 扫描页面元素失败: ${elementError.message}`, 'warning');
        }
        
        const snapshot = await mcpClient.getSnapshot();
        const { steps: assertionSteps } = await this.aiParser.parseAssertions(testCase.assertions, snapshot, runId);

        if (assertionSteps && assertionSteps.length > 0) {
          this.addLog(runId, `🎯 [断言] 开始执行 ${assertionSteps.length} 个断言步骤`);
          for (const [index, assertionStep] of assertionSteps.entries()) {
            this.addLog(runId, `🔍 [断言 ${index + 1}] ${assertionStep.description}`);
            const result = await mcpClient.executeStep(assertionStep);
            this.logStepResult(runId, assertionStep, result);
            if (!result.success) throw new Error(`断言失败: ${assertionStep.description} - ${result.error}`);
            this.addLog(runId, `✅ [断言 ${index + 1}] 验证通过`);
          }
          this.addLog(runId, `🎉 所有断言验证完成！`);
        } else {
          this.addLog(runId, `🤔 AI未能解析出任何断言步骤。`);
        }
      }

      this.updateRunStatus(runId, 'completed');
    } catch (error: any) {
      this.addLog(runId, `❌ 交互式测试执行异常: ${error.message}`, 'error');
      this.updateRunStatus(runId, 'failed', `Test execution failed: ${error.message}`);
    } finally {
      await mcpClient.cleanup();
      this.clients.delete(runId);
    }
  }
  
  private logStepResult(runId: string, step: TestStep, result: McpExecutionResult) {
      if (result.success) {
          this.addLog(runId, `✅ ${step.action} 成功: ${step.description}`);
      } else {
          this.addLog(runId, `❌ ${step.action} 失败: ${step.description} - ${result.error}`, 'error');
      }
  }

  private setupQueueProcessor(): void {
    this.testQueue.process('*', concurrency, async (job: Job) => {
      await this.processJob(job);
    });

    this.testQueue.on('failed', (job, err) => {
      const { runId } = job.data;
      this.addLog(runId, `队列任务失败: ${err.message}`, 'error');
      this.updateRunStatus(runId, 'failed', err.message);
    });
  }

  // 🔥 新增：格式化元素描述的辅助方法
  private formatElementDescription(element: any): string {
    const parts = [];
    
    if (element.tag) {
      parts.push(`<${element.tag}>`);
    }
    
    if (element.id) {
      parts.push(`id="${element.id}"`);
    }
    
    if (element['data-testid']) {
      parts.push(`data-testid="${element['data-testid']}"`);
    }
    
    if (element.name) {
      parts.push(`name="${element.name}"`);
    }
    
    if (element.text && element.text.length > 0) {
      const truncatedText = element.text.length > 30 ? element.text.substring(0, 30) + '...' : element.text;
      parts.push(`text="${truncatedText}"`);
    }
    
    if (element.placeholder) {
      parts.push(`placeholder="${element.placeholder}"`);
    }

    return parts.join(' ');
  }

  // 🔥 新增：提供给API调用的runTest方法
  public async runTest(testCaseId: number, environment: string = 'staging', executionMode: string = 'interactive'): Promise<string> {
    console.log(`🚀 [runTest] 开始执行测试用例 ID: ${testCaseId}, 模式: ${executionMode}`);
    
    // 直接调用内部的handleExecuteTest方法
    const data = { testCaseId, environment, executionMode };
    await this.handleExecuteTest(data);
    
    // 由于测试是异步执行的，我们需要返回一个临时的runId
    // 实际的runId会在handleExecuteTest中生成
    return `temp-${testCaseId}-${Date.now()}`;
  }
} 